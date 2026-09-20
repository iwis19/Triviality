"""Exercise the real workflow against a real local experiment HTTP service."""
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from http.server import HTTPServer
import test_research
from test_research import FixtureBackend

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "experiment-worker"))
from server import Service, handler


class ExperimentWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_inapplicable_experiment_does_not_call_service(self):
        backend = FixtureBackend(stop=True)
        original = backend.run

        async def scripted(prompt, opts, schema_json, **kwargs):
            if "experiment" in schema_json["properties"]:
                return test_research.engine.AgentResult(structured={"rationale": "No supported polynomial claim", "experiment": None}, tokens=0)
            return await original(prompt, opts, schema_json, **kwargs)

        backend.run = scripted
        with patch.dict(os.environ, EXPERIMENT_API_URL="http://127.0.0.1:1"), patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("No experiment requested")):
            result, _ = await test_research.WorkflowTests().run_flow(backend, exploration_rounds=1)
        self.assertFalse(any(d["kind"] == "experiment" for d in result["discoveries"]))

    async def test_evidence_is_reviewed_and_persisted(self):
        with tempfile.TemporaryDirectory() as directory:
            server = HTTPServer(("127.0.0.1", 0), handler(Service(Path(directory)/"jobs.db"), "a"*32))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            backend = FixtureBackend(stop=True)
            original = backend.run

            async def scripted(prompt, opts, schema_json, **kwargs):
                if "experiment" in schema_json["properties"]:
                    from test_research import engine
                    backend.prompts.append(prompt)
                    return engine.AgentResult(structured={"rationale": "Test polynomial primality",
                        "experiment": dict(coefficients=[41, 1, 1], start=0, end=100, property="prime")}, tokens=0)
                return await original(prompt, opts, schema_json, **kwargs)

            backend.run = scripted
            try:
                with patch.dict(os.environ, EXPERIMENT_API_URL=f"http://127.0.0.1:{server.server_port}", EXPERIMENT_API_KEY="a"*32):
                    result, _ = await test_research.WorkflowTests().run_flow(backend, exploration_rounds=1)
                evidence = [d for d in result["discoveries"] if d["kind"] == "experiment"]
                self.assertEqual(len(evidence), 3)
                self.assertEqual(evidence[0]["experiment"]["witness"]["value"], 1681)
                reviews = [p for p in backend.prompts if p.startswith("Actively challenge")]
                self.assertTrue(all('"counterexample_found"' in p for p in reviews))
                self.assertEqual(backend.proofs, 0)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()


if __name__ == "__main__":
    unittest.main()
