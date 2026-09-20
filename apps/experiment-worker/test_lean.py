import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import HTTPServer
from unittest.mock import patch

from lean_job import checker_module, validate
from server import Service, handler

checker = checker_module()
STATEMENT = "(n : Nat) : n = n"
PROOF = "by rfl"
KEY = "a" * 32


def audited_result():
    completed = subprocess.CompletedProcess([], 0, "'triviality_target' does not depend on any axioms", "")
    with patch.object(checker.subprocess, "run", return_value=completed):
        return {**checker.check(STATEMENT, PROOF, local_only=True), "toolchain": checker.LEAN_TOOLCHAIN}


class HostedLeanTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.service = Service(Path(self.directory.name) / "jobs.db")
        self.server = HTTPServer(("127.0.0.1", 0), handler(self.service, KEY))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        self.environment = patch.dict(os.environ, LEAN_API_URL=self.url, LEAN_API_KEY=KEY)
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.directory.cleanup()

    def test_remote_audit_handoff_without_local_compiler(self):
        result = audited_result()
        with patch.object(self.service, "check_lean", return_value=result) as remote:
            with patch.object(checker.subprocess, "run", side_effect=AssertionError("No local Lean")):
                checked = checker.check(STATEMENT, PROOF)
        self.assertTrue(checked["verified"])
        self.assertEqual(checked["execution"], "remote")
        remote.assert_called_once_with({"statement": STATEMENT, "proof": PROOF})

    def test_invalid_remote_verification_is_withheld(self):
        valid = audited_result()
        for change in [{"statement": ": True"}, {"lean": "different proof"}, {"toolchain": "other"},
                       {"axioms": ["sorryAx"]}, {"log": ""}, {"verified": "true"},
                       {"log": "'triviality_target' depends on axioms: [sorryAx]", "axioms": ["sorryAx"]}]:
            with self.subTest(change=change), patch.object(self.service, "check_lean", return_value={**valid, **change}):
                self.assertFalse(checker.check(STATEMENT, PROOF)["verified"])

    def test_authentication_failure_and_outage_never_fall_back(self):
        with patch.object(checker.subprocess, "run", side_effect=AssertionError("No fallback")):
            with patch.dict(os.environ, LEAN_API_KEY="wrong"):
                self.assertFalse(checker.check(STATEMENT, PROOF)["verified"])
            with patch.dict(os.environ, LEAN_API_URL="http://127.0.0.1:1"):
                self.assertFalse(checker.check(STATEMENT, PROOF)["verified"])

    def test_unsafe_input_never_reaches_service(self):
        with patch.object(self.service, "check_lean", side_effect=AssertionError("Reject before sending")):
            for proof in ["by sorry", "by native_decide", "by run_tac pure ()"]:
                self.assertFalse(checker.check(STATEMENT, proof)["verified"])

    def test_server_checks_input_and_requires_auth(self):
        for payload, key, status in [({"statement": STATEMENT, "proof": PROOF}, "wrong", 401),
                                     ({"statement": STATEMENT, "proof": PROOF, "code": "exec"}, KEY, 400)]:
            # Auth is checked before reading a body. Avoid an unread-body TCP reset
            # on Windows when asserting the exact 401 response (client failure is tested above).
            request = urllib.request.Request(self.url + "/lean/check", data=json.dumps(payload).encode() if key == KEY else b"",
                                             headers={"Authorization": "Bearer " + key})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(error.exception.code, status)

    def test_missing_vm_compiler_remains_unverified(self):
        # Exercises the real HTTP -> isolated Python -> shared checker path.
        with patch.dict(os.environ, SWARM_LEAN_BIN="nonexistent-lean-for-test"):
            result = checker.check(STATEMENT, PROOF)
        self.assertFalse(result["verified"])
        self.assertIn("unavailable", result["checker"])

    def test_subprocess_secrets_and_retry_after_failure(self):
        request = {"statement": STATEMENT, "proof": PROOF}
        with patch.dict(os.environ, OPENAI_API_KEY="must-not-leak", EXPERIMENT_API_KEY=KEY):
            with patch("server.subprocess.run", side_effect=subprocess.TimeoutExpired("lean", 40)) as run:
                self.assertFalse(self.service.check_lean(request)["verified"])
                env = run.call_args.kwargs["env"]
                self.assertNotIn("OPENAI_API_KEY", env)
                self.assertNotIn("EXPERIMENT_API_KEY", env)
                self.assertNotIn("LEAN_API_URL", env)
        completed = subprocess.CompletedProcess([], 0, json.dumps(audited_result()), "")
        with patch("server.subprocess.run", return_value=completed) as run:
            self.assertTrue(self.service.check_lean(request)["verified"])
            run.assert_called_once()

    def test_request_bounds(self):
        for request in [{"statement": STATEMENT, "proof": "a" * 24001},
                        {"statement": False, "proof": PROOF}, {"statement": STATEMENT, "proof": ""}]:
            with self.assertRaises(ValueError):
                validate(request)


if __name__ == "__main__":
    unittest.main()
