import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
from http.server import HTTPServer
from compute import compute, validate
from server import Service, handler

REQUEST = dict(coefficients=[41, 1, 1], start=0, end=100, property="prime")
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("experiments", ROOT / "swarm-skills/math-research/scripts/experiments.py")
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class Tests(unittest.TestCase):
    def test_exact_witness(self):
        result = compute(REQUEST)
        self.assertEqual(result["witness"], dict(n=40, value=1681, factor=41))
        self.assertEqual(result["tested"], 41)

    def test_bounded_negative_result_and_domains(self):
        self.assertEqual(compute({**REQUEST, "end": 39})["outcome"], "no_counterexample_in_bounds")
        self.assertEqual(compute(dict(coefficients=[0, 1], start=-1, end=1, property="nonnegative"))["witness"]["n"], -1)
        self.assertEqual(compute(dict(coefficients=[1], start=0, end=0, property="prime"))["outcome"], "counterexample_found")
        self.assertEqual(compute(dict(coefficients=[0], start=0, end=0, property="zero"))["outcome"], "no_counterexample_in_bounds")
        self.assertEqual(compute(dict(coefficients=[0], start=0, end=0, property="positive"))["outcome"], "counterexample_found")

    def test_reject_unbounded_or_executable_inputs(self):
        for data in [{**REQUEST, "code": "import os"}, {**REQUEST, "coefficients": ["__import__('os')"]},
                     {**REQUEST, "start": True}, {**REQUEST, "end": 10001},
                     {**REQUEST, "start": 10, "end": 1}, {**REQUEST, "coefficients": [1]*10}]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                validate(data)

    def test_timeout_and_durable_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "jobs.db"
            service = Service(path)
            result = service.execute(REQUEST)
            with patch("server.subprocess.run", side_effect=AssertionError("Cache must prevent execution")):
                self.assertEqual(Service(path).execute(REQUEST), result)
            with patch("server.subprocess.run", side_effect=subprocess.TimeoutExpired("compute", 6)):
                failed = service.execute({**REQUEST, "end": 99})
            self.assertEqual(failed["outcome"], "execution_error")
            self.assertFalse(failed["verified"])

    def test_http_auth_validation_and_client(self):
        with tempfile.TemporaryDirectory() as directory:
            server = HTTPServer(("127.0.0.1", 0), handler(Service(Path(directory)/"jobs.db"), "a"*32))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            url = f"http://127.0.0.1:{server.server_port}"
            try:
                with patch.dict("os.environ", EXPERIMENT_API_URL=url, EXPERIMENT_API_KEY="a"*32):
                    result = client.execute(REQUEST)
                    self.assertEqual(result["outcome"], "counterexample_found")
                    self.assertEqual(result["request"], REQUEST)
                with patch.dict("os.environ", EXPERIMENT_API_URL=url, EXPERIMENT_API_KEY="wrong"):
                    self.assertEqual(client.execute(REQUEST)["outcome"], "execution_error")
                req = urllib.request.Request(url+"/experiments", data=b'{"code":"print(1)"}',
                                             headers={"Authorization": "Bearer " + "a"*32})
                with self.assertRaises(urllib.error.HTTPError) as caught:
                    urllib.request.urlopen(req)
                self.assertEqual(caught.exception.code, 400)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

    def test_incomplete_job_recovered_on_resubmission(self):
        import hashlib
        import sqlite3
        from contextlib import closing
        from compute import VERSION
        with tempfile.TemporaryDirectory() as directory:
            service = Service(Path(directory)/"jobs.db")
            body = json.dumps(REQUEST, sort_keys=True, separators=(",", ":"))
            job_id = hashlib.sha256((VERSION+body).encode()).hexdigest()
            with closing(sqlite3.connect(service.database)) as db, db:
                db.execute("INSERT INTO jobs VALUES (?, ?, NULL)", (job_id, body))
            self.assertEqual(service.execute(REQUEST)["outcome"], "counterexample_found")

    def test_client_unavailable_is_not_negative_evidence(self):
        with patch.dict("os.environ", EXPERIMENT_API_URL="http://127.0.0.1:1", EXPERIMENT_API_KEY="a"*32):
            result = client.execute(REQUEST)
        self.assertEqual(result["outcome"], "execution_error")
        self.assertFalse(result["verified"])

    def test_value_limit_is_not_a_counterexample(self):
        result = compute(dict(coefficients=[0, 0, 1000000], start=100, end=100, property="prime"))
        self.assertEqual(result["outcome"], "execution_error")


if __name__ == "__main__":
    unittest.main()
