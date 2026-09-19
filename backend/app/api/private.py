"""Owner/collaborator research controls. Everything here requires X-API-Key."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import hash_key, new_api_key, require_collaborator, require_owner
from ..config import get_settings
from ..db import get_db
from ..deps import get_scheduler
from ..models import (
    Area,
    Attempt,
    Campaign,
    Collaborator,
    Evidence,
    Idea,
    Portfolio,
    Problem,
    ProblemArea,
    Publication,
    Relation,
    Source,
    SourceAssertion,
)
from ..seed import load_seed
from ..services.devin_client import DEVIN_MODES
from ..services.events import emit
from ..services.publication import withdraw
from ..services.scheduler import certify_evidence, revive_idea

router = APIRouter(
    prefix="/private", tags=["private"], dependencies=[Depends(require_collaborator)]
)


# -- schemas -------------------------------------------------------------------------------------


class SourceIn(BaseModel):
    title: str
    url: str
    location: str = ""
    asserted_status: str = "open"
    asserted_at: str = ""
    retrieved_date: str = ""
    notes: str = ""


class ProblemIn(BaseModel):
    slug: str
    title: str
    statement: str
    definitions: str = ""
    assumptions: str = ""
    attribution: str = ""
    area_slugs: list[str] = Field(default_factory=list)
    formal_target: str = ""
    sources: list[SourceIn] = Field(default_factory=list)


class PortfolioIn(BaseModel):
    name: str
    max_concurrent_sessions: int = 2


class CampaignIn(BaseModel):
    portfolio_id: str
    problem_id: str
    session_budget: int = 6
    default_mode: str = "ultra"
    policy: dict = Field(default_factory=dict)
    seed: int = 0


class AssignmentIn(BaseModel):
    role: str
    idea_id: str | None = None
    mode: str | None = None
    comparison_group: str = ""


class ReviewIn(BaseModel):
    result: str  # confirmed | confirmed_refutation | disputed
    note: str = ""


class CollaboratorIn(BaseModel):
    name: str


class WithdrawIn(BaseModel):
    reason: str


# -- atlas ---------------------------------------------------------------------------------------


@router.post("/seed")
def seed(db: Session = Depends(get_db)) -> dict:
    counts = load_seed(db)
    counts["published"] = get_scheduler().publisher.process_outbox(db)
    return counts


@router.post("/problems")
def create_problem(body: ProblemIn, db: Session = Depends(get_db)) -> dict:
    if db.scalar(select(Problem).where(Problem.slug == body.slug)):
        raise HTTPException(409, "slug exists")
    if not body.sources:
        raise HTTPException(422, "a literature problem needs at least one source")
    problem = Problem(
        slug=body.slug,
        title=body.title,
        statement=body.statement,
        definitions=body.definitions,
        assumptions=body.assumptions,
        attribution=body.attribution,
        status="reported_open",
        formal_target=body.formal_target,
        formal_target_status="proposed" if body.formal_target else "absent",
    )
    db.add(problem)
    db.flush()
    for i, slug in enumerate(body.area_slugs):
        area = db.scalar(select(Area).where(Area.slug == slug))
        if area is None:
            raise HTTPException(422, f"unknown area {slug}")
        db.add(ProblemArea(problem_id=problem.id, area_id=area.id, primary=(i == 0)))
        db.add(
            Relation(
                layer="atlas",
                kind="classified_in",
                source_type="problem",
                source_id=problem.id,
                target_type="area",
                target_id=area.id,
                status="checked",
            )
        )
    for s in body.sources:
        source = db.scalar(select(Source).where(Source.url == s.url)) or Source(
            title=s.title, url=s.url, retrieved_date=s.retrieved_date
        )
        db.add(source)
        db.flush()
        db.add(
            SourceAssertion(
                source_id=source.id,
                problem_id=problem.id,
                location=s.location,
                asserted_status=s.asserted_status,
                asserted_at=s.asserted_at,
                notes=s.notes,
            )
        )
    emit(db, "problem.created", record_type="problem", record_id=problem.id, visibility="public")
    db.commit()
    get_scheduler().publisher.process_outbox(db)
    return {"id": problem.id}


# -- portfolios & campaigns ----------------------------------------------------------------------


@router.get("/portfolios")
def list_portfolios(db: Session = Depends(get_db)) -> list[dict]:
    return [
        {
            "id": p.id,
            "name": p.name,
            "paused": p.paused,
            "max_concurrent_sessions": p.max_concurrent_sessions,
        }
        for p in db.scalars(select(Portfolio))
    ]


@router.post("/portfolios")
def create_portfolio(body: PortfolioIn, db: Session = Depends(get_db)) -> dict:
    portfolio = Portfolio(name=body.name, max_concurrent_sessions=body.max_concurrent_sessions)
    db.add(portfolio)
    db.commit()
    return {"id": portfolio.id}


@router.post("/portfolios/{portfolio_id}/pause")
def pause_portfolio(portfolio_id: str, paused: bool = True, db: Session = Depends(get_db)) -> dict:
    portfolio = db.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise HTTPException(404)
    portfolio.paused = paused
    emit(
        db,
        "portfolio.paused" if paused else "portfolio.resumed",
        record_type="portfolio",
        record_id=portfolio.id,
    )
    db.commit()
    return {"paused": portfolio.paused}


@router.get("/campaigns")
def list_campaigns(db: Session = Depends(get_db)) -> list[dict]:
    return [_campaign_view(c) for c in db.scalars(select(Campaign))]


def _campaign_view(c: Campaign) -> dict:
    return {
        "id": c.id,
        "problem_id": c.problem_id,
        "problem_title": c.problem.title,
        "portfolio_id": c.portfolio_id,
        "state": c.state,
        "generation": c.generation,
        "session_budget": c.session_budget,
        "sessions_used": c.sessions_used,
        "policy": c.policy,
        "policy_version": c.policy_version,
        "ideas": len(c.ideas),
        "attempts": len(c.attempts),
    }


@router.post("/campaigns")
def create_campaign(body: CampaignIn, db: Session = Depends(get_db)) -> dict:
    if body.default_mode not in DEVIN_MODES:
        raise HTTPException(422, f"mode must be one of {DEVIN_MODES}")
    if db.get(Portfolio, body.portfolio_id) is None or db.get(Problem, body.problem_id) is None:
        raise HTTPException(404, "portfolio or problem not found")
    campaign = Campaign(
        portfolio_id=body.portfolio_id,
        problem_id=body.problem_id,
        session_budget=body.session_budget,
        seed=body.seed,
        policy={**body.policy, "default_mode": body.default_mode},
    )
    db.add(campaign)
    db.flush()
    emit(db, "campaign.created", record_type="campaign", record_id=campaign.id, visibility="public")
    db.commit()
    get_scheduler().publisher.process_outbox(db)
    return _campaign_view(campaign)


@router.post("/campaigns/{campaign_id}/state")
def set_campaign_state(campaign_id: str, state: str, db: Session = Depends(get_db)) -> dict:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404)
    if state not in {"active", "paused", "completed"}:
        raise HTTPException(422)
    campaign.state = state
    emit(
        db,
        "campaign.state_changed",
        record_type="campaign",
        record_id=campaign.id,
        payload={"state": state},
        visibility="public",
    )
    db.commit()
    return _campaign_view(campaign)


@router.post("/campaigns/{campaign_id}/assignments")
def create_assignment(campaign_id: str, body: AssignmentIn, db: Session = Depends(get_db)) -> dict:
    """Manual bounded assignment, e.g. for the Fusion/Ultra pilot: mode is frozen at enqueue."""
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404)
    mode = body.mode or campaign.policy.get("default_mode", "ultra")
    idea = db.get(Idea, body.idea_id) if body.idea_id else None
    if body.idea_id and (idea is None or idea.campaign_id != campaign.id):
        raise HTTPException(404, "idea not in campaign")
    try:
        attempt = get_scheduler().enqueue(
            db,
            campaign,
            role=body.role,
            idea=idea,
            parents=[],
            mode=mode,
            comparison_group=body.comparison_group,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    db.commit()
    return _attempt_view(attempt)


@router.get("/campaigns/{campaign_id}/attempts")
def list_attempts(campaign_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(Attempt).where(Attempt.campaign_id == campaign_id).order_by(Attempt.created_at)
    ).all()
    return [_attempt_view(a) for a in rows]


def _attempt_view(a: Attempt) -> dict:
    return {
        "id": a.id,
        "campaign_id": a.campaign_id,
        "idea_id": a.idea_id,
        "role": a.role,
        "requested_mode": a.requested_mode,
        "reported_mode": a.reported_mode,
        "provider": a.provider,
        "provider_session_id": a.provider_session_id,
        "provider_session_url": a.provider_session_url,
        "status": a.status,
        "status_detail": a.status_detail,
        "usage": a.usage,
        "result": a.result,
        "error": a.error,
        "retries": a.retries,
        "comparison_group": a.comparison_group,
        "created_at": a.created_at.isoformat(),
        "started_at": a.started_at.isoformat() if a.started_at else None,
        "finished_at": a.finished_at.isoformat() if a.finished_at else None,
    }


@router.get("/attempts/{attempt_id}/prompt")
def attempt_prompt(attempt_id: str, db: Session = Depends(get_db)) -> dict:
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(404)
    return {"id": attempt.id, "prompt": attempt.prompt, "prompt_hash": attempt.prompt_hash}


@router.post("/attempts/{attempt_id}/cancel")
def cancel_attempt(attempt_id: str, db: Session = Depends(get_db)) -> dict:
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(404)
    if attempt.provider_session_id and attempt.status in {"running", "blocked"}:
        get_scheduler().client.terminate_session(attempt.provider_session_id)
    attempt.status = "cancelled"
    emit(db, "attempt.cancelled", record_type="attempt", record_id=attempt.id)
    db.commit()
    return _attempt_view(attempt)


@router.post("/attempts/{attempt_id}/reingest")
def reingest_attempt(attempt_id: str, db: Session = Depends(get_db)) -> dict:
    """Re-run ingestion of a completed attempt's structured output (from the stored raw
    payload, else fetched from the provider). Idempotent: only records missed earlier are added."""
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(404)
    output = (attempt.result or {}).get("raw")
    if not output and attempt.provider_session_id:
        output = get_scheduler().client.get_session(attempt.provider_session_id).structured_output
    if not output:
        raise HTTPException(409, "no structured output available for this attempt")
    counts = get_scheduler().ingestor.ingest(db, attempt, output)
    db.commit()
    get_scheduler().publisher.process_outbox(db)
    return {"added": counts, "result": attempt.result}


# -- ideas, evidence, review ---------------------------------------------------------------------


@router.post("/ideas/{idea_id}/pin")
def pin_idea(idea_id: str, pinned: bool = True, db: Session = Depends(get_db)) -> dict:
    idea = db.get(Idea, idea_id)
    if idea is None:
        raise HTTPException(404)
    idea.pinned = pinned
    emit(db, "idea.pinned", record_type="idea", record_id=idea.id, payload={"pinned": pinned})
    db.commit()
    get_scheduler().publisher.process_outbox(db)
    return {"pinned": idea.pinned}


@router.post("/ideas/{idea_id}/revive")
def revive(
    idea_id: str, reason: str = "collaborator revival", db: Session = Depends(get_db)
) -> dict:
    idea = db.get(Idea, idea_id)
    if idea is None:
        raise HTTPException(404)
    revive_idea(db, idea, reason)
    db.commit()
    get_scheduler().publisher.process_outbox(db)
    return {"scheduling_status": idea.scheduling_status, "generation": idea.generation}


@router.post("/evidence/{evidence_id}/review")
def review_evidence(
    evidence_id: str,
    body: ReviewIn,
    collaborator: Collaborator = Depends(require_collaborator),
    db: Session = Depends(get_db),
) -> dict:
    evidence = db.get(Evidence, evidence_id)
    if evidence is None:
        raise HTTPException(404)
    if body.result not in {"confirmed", "confirmed_refutation", "disputed"}:
        raise HTTPException(422)
    certify_evidence(db, evidence, reviewer=collaborator.name, result=body.result, note=body.note)
    db.commit()
    get_scheduler().publisher.process_outbox(db)
    return {"ok": True}


@router.get("/events")
def private_events(
    since_id: int = 0, limit: int = 500, db: Session = Depends(get_db)
) -> list[dict]:
    from ..models import Event

    rows = db.scalars(
        select(Event).where(Event.id > since_id).order_by(Event.id).limit(limit)
    ).all()
    return [
        {
            "id": e.id,
            "type": e.type,
            "record_type": e.record_type,
            "record_id": e.record_id,
            "payload": e.payload,
            "visibility": e.visibility,
            "created_at": e.created_at.isoformat(),
        }
        for e in rows
    ]


# -- scheduler & publication ----------------------------------------------------------------------


@router.post("/scheduler/tick")
def scheduler_tick(db: Session = Depends(get_db)) -> dict:
    return get_scheduler().tick(db)


@router.get("/scheduler/status")
def scheduler_status(db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    running = db.scalars(select(Attempt).where(Attempt.status.in_(["running", "blocked"]))).all()
    return {
        "provider": get_scheduler().client.provider_name,
        "background_enabled": settings.scheduler_enabled,
        "interval_seconds": settings.scheduler_interval_seconds,
        "lean_available": get_scheduler().ingestor.lean_checker.available(),
        "running_attempts": len(running),
        "modes": list(DEVIN_MODES),
    }


@router.post("/publications/{publication_id}/withdraw", dependencies=[Depends(require_owner)])
def withdraw_publication(
    publication_id: str, body: WithdrawIn, db: Session = Depends(get_db)
) -> dict:
    publication = db.get(Publication, publication_id)
    if publication is None:
        raise HTTPException(404)
    withdraw(db, publication, body.reason)
    db.commit()
    return {"withdrawn_at": publication.withdrawn_at}


# -- collaborators (owner only) --------------------------------------------------------------------


@router.post("/collaborators", dependencies=[Depends(require_owner)])
def add_collaborator(body: CollaboratorIn, db: Session = Depends(get_db)) -> dict:
    key = new_api_key("mlc")
    db.add(Collaborator(name=body.name, role="collaborator", api_key_hash=hash_key(key)))
    db.commit()
    return {"name": body.name, "api_key": key, "note": "shown once; store it securely"}


@router.post("/collaborators/{collaborator_id}/revoke", dependencies=[Depends(require_owner)])
def revoke_collaborator(collaborator_id: str, db: Session = Depends(get_db)) -> dict:
    c = db.get(Collaborator, collaborator_id)
    if c is None or c.role == "owner":
        raise HTTPException(404)
    c.revoked = True
    db.commit()
    return {"revoked": True}


@router.get("/collaborators", dependencies=[Depends(require_owner)])
def list_collaborators(db: Session = Depends(get_db)) -> list[dict]:
    return [
        {"id": c.id, "name": c.name, "role": c.role, "revoked": c.revoked}
        for c in db.scalars(select(Collaborator))
    ]
