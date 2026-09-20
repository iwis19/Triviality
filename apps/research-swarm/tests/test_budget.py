import asyncio
import json
import os
import subprocess
import threading
import unittest
import uuid
from unittest.mock import patch

from test_research import FixtureBackend, TARGET, WORKFLOW, engine
from runner import ModelBackend, execute


class BudgetTests(unittest.IsolatedAsyncioTestCase):
    def backend(self, limit):
        backend = ModelBackend()
        backend.bind_budget(engine.BudgetLedger(total=limit))
        backend.bind_workflow_budget(engine.BudgetLedger(total=limit))
        backend.route = lambda _: ("fixture", "http://unused", "fixture", "openai")
        return backend

    async def test_concurrent_requests_respect_research_reserve(self):
        backend = self.backend(10000)
        calls = []
        def request(payload, route):
            calls.append(payload)
            usage = len(json.dumps(payload["messages"], ensure_ascii=False).encode()) + payload["max_completion_tokens"]
            return {"usage": {"total_tokens": usage}, "choices": [{"message": {"content": "{}"}}]}
        backend.request = request
        results = await asyncio.gather(*(backend.run("x" * 1000, {}, {}) for _ in range(3)))
        self.assertLessEqual(backend.budget.spent, 6500)
        self.assertEqual(backend.reserved, 0)
        self.assertTrue(any(r.skipped for r in results))
        before = backend.budget.spent
        proof = await backend.run("proof", {"label": "Proof writer 1"}, {})
        self.assertFalse(proof.skipped)
        self.assertGreater(backend.budget.spent, before)
        self.assertLessEqual(backend.budget.spent, 10000)

    async def test_transport_failure_releases_reservation(self):
        backend = self.backend(60000)
        backend.request = lambda *_: (_ for _ in ()).throw(RuntimeError("offline"))
        with self.assertRaisesRegex(RuntimeError, "offline"):
            await backend.run("test", {}, {})
        self.assertEqual(backend.reserved, 0)
        self.assertEqual(backend.budget.spent, 0)

    async def test_cancelled_request_keeps_reservation_until_usage_is_recorded(self):
        backend = self.backend(60000)
        started, release = threading.Event(), threading.Event()
        def request(*_):
            started.set()
            release.wait(5)
            return {"usage": {"total_tokens": 100}, "choices": [{"message": {"content": "{}"}}]}
        backend.request = request
        task = asyncio.create_task(backend.run("test", {}, {}))
        await asyncio.to_thread(started.wait, 5)
        task.cancel()
        await asyncio.sleep(0)
        self.assertGreater(backend.reserved, 0)
        release.set()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(backend.budget.spent, 100)
        self.assertEqual(backend.reserved, 0)

    async def test_per_run_limit_overrides_environment(self):
        with patch.dict(os.environ, {"SWARM_TOKEN_BUDGET": "60000"}):
            result = await execute({"episode_id": "fixture-budget-" + uuid.uuid4().hex,
                                    "statement": "Order", "lean_statement": TARGET, "token_budget": 65},
                                   backend=FixtureBackend(stop=True, complete=False), progress=lambda _: None)
        self.assertEqual(result["token_usage"]["limit"], 65)
        self.assertEqual(result["stop_reason"], "token_budget")
        self.assertTrue(result["discoveries"])

    async def test_reserve_reaches_lean_without_another_exploration_round(self):
        backend = FixtureBackend()
        passed = subprocess.CompletedProcess([], 0, "'triviality_target' does not depend on any axioms", "")
        with patch("subprocess.run", return_value=passed):
            result = await engine.run_workflow(str(WORKFLOW),
                args={"statement": "Order", "lean_statement": TARGET}, backend=backend, cap=3,
                budget=engine.BudgetLedger(total=65), workflow_budget=engine.BudgetLedger(total=65))
        self.assertEqual(result["status"], "verified")
        self.assertEqual(sum(p.startswith("Investigate") for p in backend.prompts), 3)
        self.assertEqual(backend.proofs, 1)

    async def test_failed_proof_repairs_immediately(self):
        backend = FixtureBackend(bad_first_proof=True)
        failed = subprocess.CompletedProcess([], 1, "error: tactic failed", "")
        passed = subprocess.CompletedProcess([], 0, "'triviality_target' does not depend on any axioms", "")
        with patch("subprocess.run", side_effect=[failed, passed]):
            result = await engine.run_workflow(str(WORKFLOW),
                args={"statement": "Order", "lean_statement": TARGET, "proof_attempts": 4}, backend=backend)
        self.assertEqual(result["status"], "verified")
        self.assertTrue(all(p.startswith("Write a Lean") for p in backend.prompts[-2:]))
        self.assertIn("error: tactic failed", backend.prompts[-1])
        self.assertEqual(result["proof"]["statement"], TARGET)
