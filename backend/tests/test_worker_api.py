"""Attempt-scoped worker routes: context, Lean dry-run, and the formalization stage."""

from fastapi.testclient import TestClient

from app.deps import get_scheduler
from app.models import Campaign
from app.services.devin_client import MockDevinClient
from tests.conftest import OWNER
from tests.test_research_loop import _run_ticks, _setup_campaign

DECL = "theorem mock_lemma : 1 + 1 = 2"


def _running_attempt(client: TestClient, campaign_id: str) -> tuple[dict, dict]:
    attempts = client.get(f"/private/campaigns/{campaign_id}/attempts", headers=OWNER).json()
    running = next(a for a in attempts if a["status"] == "running")
    mock = get_scheduler().client
    assert isinstance(mock, MockDevinClient)
    token = mock._sessions[running["provider_session_id"]]["worker_token"]
    return running, {"X-Worker-Token": token}


def test_context_exposes_lean_environment_and_schema(client: TestClient) -> None:
    campaign_id = _setup_campaign(client)
    _run_ticks(client, 1)
    attempt, headers = _running_attempt(client, campaign_id)
    ctx = client.get(f"/worker/attempts/{attempt['id']}/context", headers=headers).json()
    assert ctx["role"] == "hypothesis_generator"
    assert "lean" in ctx and ctx["lean"]["available"] is False  # tests run without lake
    assert ctx["output_schema"]["required"] == ["ideas", "evidence", "gaps"]
    assert "worker_token_hash" not in ctx and "prompt" not in ctx


def test_lean_check_is_a_dry_run_with_static_gate(client: TestClient) -> None:
    campaign_id = _setup_campaign(client)
    _run_ticks(client, 1)
    attempt, headers = _running_attempt(client, campaign_id)
    url = f"/worker/attempts/{attempt['id']}/lean-check"

    assert client.post(url, json={"source": "x", "declaration": DECL}).status_code == 401
    r = client.post(url, json={"source": "x", "declaration": "def f := 1"}, headers=headers)
    assert r.status_code == 422

    r = client.post(
        url, json={"source": f"{DECL} := by sorry", "declaration": DECL}, headers=headers
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "rejected"
    assert any("forbidden construct" in reason for reason in body["reasons"])

    r = client.post(
        url,
        json={"source": "theorem mock_lemma : 1 + 1 = 3 := rfl", "declaration": DECL},
        headers=headers,
    )
    assert r.json()["status"] == "rejected"
    assert any("differs from approved target" in reason for reason in r.json()["reasons"])

    r = client.post(url, json={"source": f"{DECL} := rfl", "declaration": DECL}, headers=headers)
    assert r.json()["status"] == "checker_unavailable"  # static gate passed, no lake here

    # dry runs never create evidence or artifacts
    problem = client.get("/public/problems/goldbach-conjecture").json()
    assert problem["evidence"] == []


def test_acu_limit_prefers_role_then_campaign_then_deployment(client: TestClient) -> None:
    scheduler = get_scheduler()
    campaign = Campaign(policy={})
    assert scheduler._acu_limit(campaign, "critic") == scheduler.settings.devin_max_acu_limit
    assert scheduler._acu_limit(campaign, "prover_formalizer") == 15
    campaign = Campaign(policy={"max_acu_limit": 7, "role_acu_limits": {"critic": 3}})
    assert scheduler._acu_limit(campaign, "critic") == 3
    assert scheduler._acu_limit(campaign, "experimenter") == 7


def test_formalizer_runs_on_promoted_ideas_and_never_self_certifies(client: TestClient) -> None:
    campaign_id = _setup_campaign(client)
    _run_ticks(client, 40)
    attempts = client.get(f"/private/campaigns/{campaign_id}/attempts", headers=OWNER).json()
    formalizers = [a for a in attempts if a["role"] == "prover_formalizer"]
    assert formalizers, "survivors of the first cull should get a formalization pass"
    assert all(a["requested_mode"] == "ultra" for a in formalizers)
    problem = client.get("/public/problems/goldbach-conjecture").json()
    sub_lemmas = [i for i in problem["ideas"] if "Formalizable sub-lemma" in i["title"]]
    assert sub_lemmas and all(i["parent_ids"] and i["depth"] >= 1 for i in sub_lemmas)
    checks = [e for e in problem["evidence"] if e["check_type"] == "lean_check"]
    assert checks, "the lab runs its own check on every lean_attempt artifact"
    for ev in checks:
        assert ev["result"] == "inconclusive" and ev["certified"] is False
        assert ev["check_status"] == "checker_unavailable"
        assert ev["target_origin"] == "worker_proposed"
        assert ev["approved_target"] == DECL
    assert not any(i["evidence_label"] == "Lean verified" for i in problem["ideas"])
