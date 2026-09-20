"""Private, single-worker HTTP service with durable, content-addressed results."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import sqlite3
from contextlib import closing
import subprocess
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from compute import VERSION, validate


class Service:
    def __init__(self, database):
        self.database = str(database)
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, request TEXT, result TEXT)")

    def execute(self, request):
        validate(request)
        body = json.dumps(request, sort_keys=True, separators=(",", ":"))
        job_id = hashlib.sha256((VERSION + body).encode()).hexdigest()
        with closing(sqlite3.connect(self.database)) as db, db:
            row = db.execute("SELECT result FROM jobs WHERE id=?", (job_id,)).fetchone()
            if row and row[0]:
                return json.loads(row[0])
            db.execute("INSERT OR IGNORE INTO jobs VALUES (?, ?, NULL)", (job_id, body))
        started = time.monotonic()
        try:
            with tempfile.TemporaryDirectory() as directory:
                completed = subprocess.run([sys.executable, str(Path(__file__).with_name("compute.py"))],
                    input=body, capture_output=True, text=True, timeout=6, cwd=directory,
                    env={key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "PATH") if key in os.environ})
            result = json.loads(completed.stdout) if completed.returncode == 0 else {
                "outcome": "execution_error", "diagnostic": "Computation failed or exceeded resource limits"}
        except subprocess.TimeoutExpired:
            result = dict(outcome="execution_error", diagnostic="Computation exceeded six-second deadline")
        except (OSError, ValueError):
            result = dict(outcome="execution_error", diagnostic="Computation could not complete")
        result.update(job_id=job_id, engine=VERSION, request=request,
                      duration_ms=round((time.monotonic()-started)*1000), verified=False)
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute("UPDATE jobs SET result=? WHERE id=?", (json.dumps(result), job_id))
        return result


def handler(service, key):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def respond(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            self.respond(200 if self.path == "/health" else 404,
                         {"service": "experiment-worker", "engine": VERSION})

        def do_POST(self):
            if not hmac.compare_digest(self.headers.get("Authorization", "").encode(), ("Bearer " + key).encode()):
                return self.respond(401, {"error": "Unauthorized"})
            if self.path != "/experiments":
                return self.respond(404, {"error": "Unknown endpoint"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 8192 or self.headers.get("Transfer-Encoding"):
                    return self.respond(413, {"error": "Use a JSON body of at most 8192 bytes"})
                request = json.loads(self.rfile.read(length))
                validate(request)
            except (ValueError, TypeError):
                return self.respond(400, {"error": "Invalid bounded polynomial experiment"})
            self.respond(200, service.execute(request))

        def log_message(self, *args):
            pass  # Never log credentials or mathematical request bodies.
    return Handler


if __name__ == "__main__":
    key = os.environ.get("EXPERIMENT_API_KEY", "")
    if len(key) < 32 or not key.isascii():
        raise SystemExit("Set EXPERIMENT_API_KEY to a random ASCII secret of at least 32 characters")
    directory = Path(os.environ.get("EXPERIMENT_DATA_DIR", ".data/experiments"))
    directory.mkdir(parents=True, exist_ok=True)
    server = HTTPServer((os.environ.get("EXPERIMENT_HOST", "127.0.0.1"),
                         int(os.environ.get("EXPERIMENT_PORT", "8090"))),
                        handler(Service(directory / "jobs.sqlite3"), key))
    server.serve_forever()
