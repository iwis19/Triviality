import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runner import ModelBackend
from devin_backend import run_session
from test_research import FixtureBackend
import test_research


class RoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_provider_credentials_do_not_cross_routes(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "openai-fixture", "GEMINI_API_KEY": "gemini-fixture"}, clear=True):
            backend = ModelBackend()
            self.assertEqual(backend.route("openai/gpt-5.6-sol")[0], "openai-fixture")
            self.assertEqual(backend.route("gemini/gemini-2.5-pro")[0], "gemini-fixture")
            with self.assertRaisesRegex(RuntimeError, "DEEPSEEK_API_KEY"):
                backend.route("deepseek/deepseek-v4-pro")

    async def test_gemini_uses_selected_model_and_compatible_payload(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "fixture"}, clear=True):
            backend = ModelBackend()
            response = {"choices": [{"message": {"content": '{"ok": true}'}}], "usage": {"total_tokens": 12}}
            with patch.object(backend, "request", return_value=response) as request:
                result = await backend.run("Test", {"model": "gemini/gemini-2.5-flash"}, {"type": "object"})
            payload, route = request.call_args.args
            self.assertEqual(payload["model"], "gemini-2.5-flash")
            self.assertIn("max_tokens", payload)
            self.assertNotIn("max_completion_tokens", payload)
            self.assertEqual(route[0], "fixture")
            self.assertTrue(result.structured["ok"])

    async def test_every_role_and_revision_keeps_its_assignment(self):
        backend = FixtureBackend()
        captured = []
        original = backend.run
        async def capture(prompt, opts, schema, **kwargs):
            captured.append((prompt, opts.get("model")))
            return await original(prompt, opts, schema, **kwargs)
        backend.run = capture
        roles = {role: role + "-model" for role in ["coordinator", "researcher_1", "researcher_2", "researcher_3", "challenger", "proof_writer"]}
        with patch.dict(os.environ, {"SWARM_LEAN_BIN": "nonexistent-lean-for-test"}):
            await test_research.WorkflowTests().run_flow(backend, role_models=roles)
        self.assertEqual({model for _, model in captured}, set(roles.values()))
        for prompt, model in captured:
            if prompt.startswith("Actively challenge"):
                self.assertEqual(model, "challenger-model")
            if prompt.startswith("Write a Lean"):
                self.assertEqual(model, "proof_writer-model")


class DevinTests(unittest.IsolatedAsyncioTestCase):
    async def test_structured_result_and_session_reuse(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"DEVIN_ORG_ID": "test-org"}):
            replies = [{"session_id": "devin-test"}, {"status": "exit", "structured_output": {"evidence": "test"}, "acus_consumed": 0.1}]
            events = []
            with patch("devin_backend.request", side_effect=replies) as request:
                result = await run_session("test", {"type": "object"}, ("key", "https://fixture", "agent", "devin"), directory, "call", lambda *a, **kw: events.append((a, kw)))
            self.assertEqual(result, {"evidence": "test"})
            self.assertTrue(request.call_args_list[0].args[4]["structured_output_required"])
            self.assertEqual(events[-1][1]["unit"], "ACU")
            with patch("devin_backend.request", return_value=replies[-1]) as request:
                await run_session("test", {}, ("key", "https://fixture", "agent", "devin"), directory, "call", lambda *a, **kw: None)
            self.assertEqual(len(request.call_args_list), 1)
            self.assertEqual(len(request.call_args.args), 3)  # GET only, no duplicate POST.

    async def test_waiting_for_user_terminates_session_and_fails(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"DEVIN_ORG_ID": "test-org"}):
            with patch("devin_backend.request", side_effect=[{"session_id": "devin-test"}, {"status": "running", "status_detail": "waiting_for_user"}, {}]) as request:
                with self.assertRaisesRegex(RuntimeError, "needs attention"):
                    await run_session("test", {}, ("key", "https://fixture", "agent", "devin"), directory, "call", lambda *a, **kw: None)
            self.assertEqual(request.call_args.args[-1], "DELETE")
