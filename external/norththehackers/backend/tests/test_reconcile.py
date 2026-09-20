"""Reconcile: an attempt whose session can no longer be polled (e.g. it belongs to a
provider account we lost access to) still times out when its lease expires."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.deps import get_scheduler
from app.models import Attempt, utcnow
from tests.conftest import OWNER
from tests.test_research_loop import _run_ticks, _setup_campaign


def test_unpollable_attempt_times_out_on_lease_expiry(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    campaign_id = _setup_campaign(client)
    _run_ticks(client, 1)
    attempt_id = client.get(f"/private/campaigns/{campaign_id}/attempts", headers=OWNER).json()[0][
        "id"
    ]
    with SessionLocal() as db:
        attempt = db.get(Attempt, attempt_id)
        assert attempt is not None and attempt.provider_session_id
        attempt.status = "running"
        attempt.lease_expires_at = utcnow() - timedelta(minutes=1)
        db.commit()

    def forbidden(session_id: str) -> None:
        raise RuntimeError("403 Forbidden")

    monkeypatch.setattr(get_scheduler().client, "get_session", forbidden)
    _run_ticks(client, 1)

    with SessionLocal() as db:
        attempt = db.get(Attempt, attempt_id)
        assert attempt is not None
        assert attempt.status == "timed_out"
        assert attempt.finished_at is not None
        assert attempt.error is not None and "403" in attempt.error
