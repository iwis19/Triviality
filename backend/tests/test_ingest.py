"""Ingestion resolves worker-side handles (local_id, leading labels, titles) to lab records."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.deps import get_scheduler
from app.models import Attempt, Evidence
from tests.conftest import OWNER
from tests.test_research_loop import _run_ticks, _setup_campaign

OUTPUT = {
    "ideas": [
        {
            "local_id": "I1",
            "title": "I1. Sum-denominator lemma",
            "approach": "crossing times",
            "claims": [{"local_id": "C1", "statement": "max attained at a/(v_i+v_j)"}],
        },
        {"title": "H2: uniform SOS degree", "approach": "certificates"},
    ],
    "evidence": [
        {"target": "I1", "check_type": "informal_proof", "result": "supports", "summary": "sketch"},
        {
            "target": "c1",
            "check_type": "numerical_experiment",
            "result": "supports",
            "summary": "n",
        },
        {"target": "H2", "check_type": "critique", "result": "inconclusive", "summary": "weak"},
        {
            "target": "H2: uniform SOS degree",
            "check_type": "counterexample_search",
            "result": "refutes",
            "summary": "naive variant fails",
        },
        {
            "target": "problem",
            "check_type": "literature_check",
            "result": "supports",
            "summary": "o",
        },
        {"target": "I9", "check_type": "critique", "result": "supports", "summary": "dangling"},
    ],
    "gaps": ["everything"],
}


def test_targets_resolve_by_local_id_label_and_title(client: TestClient) -> None:
    campaign_id = _setup_campaign(client)
    _run_ticks(client, 1)
    attempt_id = client.get(f"/private/campaigns/{campaign_id}/attempts", headers=OWNER).json()[0][
        "id"
    ]
    with SessionLocal() as db:
        attempt = db.get(Attempt, attempt_id)
        assert attempt is not None
        counts = get_scheduler().ingestor.ingest(db, attempt, OUTPUT)
        db.commit()
        assert counts == {"ideas": 2, "claims": 1, "evidence": 5, "lean_checks": 0}
        assert attempt.result is not None
        assert [u["target"] for u in attempt.result["unattached_evidence"]] == ["I9"]
        assert attempt.result["raw"] == OUTPUT
        by_type = {e.check_type: e for e in db.query(Evidence).all()}
        assert by_type["numerical_experiment"].claim is not None
        assert by_type["numerical_experiment"].claim.statement.startswith("max attained")
        assert by_type["critique"].idea is not None
        assert by_type["critique"].idea.title.startswith("H2")
        assert by_type["counterexample_search"].idea_id == by_type["critique"].idea_id
        assert by_type["literature_check"].problem_id == attempt.campaign.problem_id
        assert by_type["literature_check"].idea_id is None

        # idempotent: a second pass adds nothing
        again = get_scheduler().ingestor.ingest(db, attempt, OUTPUT)
        assert again == {"ideas": 0, "claims": 0, "evidence": 0, "lean_checks": 0}

    r = client.post(f"/private/attempts/{attempt_id}/reingest", headers=OWNER)
    assert r.status_code == 200, r.text
    assert r.json()["added"]["ideas"] == 0

    problem = client.get("/public/problems/goldbach-conjecture").json()
    problem_level = [e for e in problem["evidence"] if e["problem_id"] and not e["idea_id"]]
    assert [e["check_type"] for e in problem_level] == ["literature_check"]
    assert problem_level[0]["certified"] is False


def test_create_schema_adds_missing_columns(tmp_path: Path) -> None:
    from sqlalchemy import inspect, text

    from app.db import Base, create_schema, make_engine

    engine = make_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:  # pre-release shape of the table, before problem_id existed
        conn.execute(text("CREATE TABLE evidence (id VARCHAR(32) PRIMARY KEY, summary TEXT)"))
    Base.metadata.create_all(engine)
    assert "problem_id" not in {c["name"] for c in inspect(engine).get_columns("evidence")}
    create_schema(engine)
    assert "problem_id" in {c["name"] for c in inspect(engine).get_columns("evidence")}
