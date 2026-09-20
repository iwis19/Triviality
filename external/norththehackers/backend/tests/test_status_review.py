"""Problem status: a worker's literature check can only flag a claimed resolution; a
collaborator's review moves the status and records which source assertions were checked."""

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.deps import get_scheduler
from app.models import Attempt, Campaign
from tests.conftest import OWNER
from tests.test_research_loop import _run_ticks, _setup_campaign

REFUTING = {
    "ideas": [],
    "evidence": [
        {
            "target": "problem",
            "check_type": "literature_check",
            "result": "refutes",
            "summary": "a 2031 preprint claims a full proof",
        }
    ],
    "gaps": [],
}


def test_worker_flags_claimed_resolution_and_scheduler_pauses(client: TestClient) -> None:
    campaign_id = _setup_campaign(client)
    _run_ticks(client, 1)
    attempt_id = client.get(f"/private/campaigns/{campaign_id}/attempts", headers=OWNER).json()[0][
        "id"
    ]
    with SessionLocal() as db:
        attempt = db.get(Attempt, attempt_id)
        assert attempt is not None
        get_scheduler().ingestor.ingest(db, attempt, REFUTING)
        db.commit()
        assert attempt.campaign.problem.status == "resolution_claimed"

    _run_ticks(client, 3)
    problem = client.get("/public/problems/goldbach-conjecture").json()
    assert problem["problem"]["status"] == "resolution_claimed"
    assert problem["problem"]["evidence_label"] == "Resolution claimed — under review"
    with SessionLocal() as db:
        campaign = db.get(Campaign, campaign_id)
        assert campaign is not None
        assert campaign.state == "paused"  # no new paid work until a human reviews


def test_collaborator_review_updates_status_and_assertions(client: TestClient) -> None:
    client.post("/private/seed", headers=OWNER)
    before = client.get("/public/problems/goldbach-conjecture").json()["problem"]
    assert before["status"] == "reported_open"
    assert all(s["review_state"] == "unreviewed" for s in before["sources"])

    r = client.post(f"/private/problems/{before['id']}/review", json={"status": "solved"})
    assert r.status_code == 401
    r = client.post(
        f"/private/problems/{before['id']}/review", json={"status": "solved"}, headers=OWNER
    )
    assert r.status_code == 422

    r = client.post(
        f"/private/problems/{before['id']}/review",
        json={"status": "disputed", "note": "preprint withdrawn; checked both sources"},
        headers=OWNER,
    )
    assert r.status_code == 200, r.text
    assert r.json()["assertions_reviewed"] == len(before["sources"])

    after = client.get("/public/problems/goldbach-conjecture").json()["problem"]
    assert after["status"] == "disputed"
    assert after["evidence_label"] == "Status disputed"
    assert all(s["review_state"] == "reviewed" for s in after["sources"])
    assert after["status_reviews"][-1]["to"] == "disputed"
    assert after["status_reviews"][-1]["from"] == "reported_open"
    assert after["status_reviews"][-1]["note"].startswith("preprint withdrawn")
