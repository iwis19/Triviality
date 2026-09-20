"""Serialized JSON-lines tool bridge; retrieval snapshots make resume reproducible."""
import asyncio
import hashlib
import json
from pathlib import Path
import sys


class Retrieval:
    def __init__(self, directory, emit):
        self.directory = Path(directory)
        self.emit = emit
        self.lock = asyncio.Lock()

    async def search(self, query, broad=False):
        key = hashlib.sha256(json.dumps([query, broad]).encode()).hexdigest()
        path = self.directory / ("literature-" + key + ".json")
        async with self.lock:
            if path.exists():
                return json.loads(path.read_text(encoding="utf-8"))
            self.emit("tool_request", id=key, tool="literature_search", query=query, broad=broad)
            line = await asyncio.to_thread(sys.stdin.readline)
            if not line:
                return {"papers": [], "warning": "Retrieval host disconnected"}
            response = json.loads(line)
            if response.get("id") != key:
                raise RuntimeError("Retrieval response identity mismatch")
            result = response.get("result", {"papers": [], "warning": "Retrieval failed"})
            path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
            return result
