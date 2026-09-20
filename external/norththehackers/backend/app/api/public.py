"""Anonymous read API. Serves only the public projection (Publication rows) plus atlas structure.
Nothing here can launch work or reveal private records."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Area, Event, Publication, Relation

router = APIRouter(prefix="/public", tags=["public"])


def _latest_publications(db: Session, record_type: str | None = None) -> list[Publication]:
    """Latest non-withdrawn version per record."""
    stmt = select(Publication).where(Publication.withdrawn_at.is_(None))
    if record_type:
        stmt = stmt.where(Publication.record_type == record_type)
    rows = db.scalars(stmt.order_by(Publication.published_at)).all()
    latest: dict[tuple[str, str], Publication] = {}
    for row in rows:
        latest[(row.record_type, row.record_id)] = row
    return list(latest.values())


def _serialize(pub: Publication) -> dict:
    return {
        "record_type": pub.record_type,
        "record_id": pub.record_id,
        "version": pub.record_version,
        "evidence_label": pub.evidence_label,
        "policy_version": pub.policy_version,
        "published_at": pub.published_at.isoformat(),
        **pub.public_payload,
    }


@router.get("/areas")
def list_areas(db: Session = Depends(get_db)) -> list[dict]:
    areas = db.scalars(select(Area).order_by(Area.depth, Area.name)).all()
    counts: dict[str, int] = {
        target_id: n
        for target_id, n in db.execute(
            select(Relation.target_id, func.count())
            .where(Relation.layer == "atlas", Relation.kind == "classified_in")
            .group_by(Relation.target_id)
        ).all()
    }
    return [
        {
            "id": a.id,
            "slug": a.slug,
            "name": a.name,
            "description": a.description,
            "parent_id": a.parent_id,
            "depth": a.depth,
            "problem_count": counts.get(a.id, 0),
        }
        for a in areas
    ]


@router.get("/problems")
def list_problems(area: str | None = None, db: Session = Depends(get_db)) -> list[dict]:
    pubs = [_serialize(p) for p in _latest_publications(db, "problem")]
    if area:
        pubs = [p for p in pubs if any(a["slug"] == area for a in p.get("areas", []))]
    return sorted(pubs, key=lambda p: p["title"])


@router.get("/problems/{slug}")
def get_problem(slug: str, db: Session = Depends(get_db)) -> dict:
    for pub in _latest_publications(db, "problem"):
        if pub.public_payload.get("slug") == slug:
            problem = _serialize(pub)
            problem_id = pub.record_id
            campaigns = [
                _serialize(c)
                for c in _latest_publications(db, "campaign")
                if c.public_payload.get("problem_id") == problem_id
            ]
            ideas = [
                _serialize(i)
                for i in _latest_publications(db, "idea")
                if i.public_payload.get("problem_id") == problem_id
            ]
            idea_ids = {i["id"] for i in ideas}
            claims = [
                _serialize(c)
                for c in _latest_publications(db, "claim")
                if c.public_payload.get("idea_id") in idea_ids
            ]
            evidence = [
                _serialize(e)
                for e in _latest_publications(db, "evidence")
                if e.public_payload.get("idea_id") in idea_ids
                or e.public_payload.get("problem_id") == problem_id
            ]
            return {
                "problem": problem,
                "campaigns": campaigns,
                "ideas": ideas,
                "claims": claims,
                "evidence": evidence,
            }
    raise HTTPException(404, "No published problem with that slug")


@router.get("/ideas/{idea_id}")
def get_idea(idea_id: str, db: Session = Depends(get_db)) -> dict:
    idea = next((p for p in _latest_publications(db, "idea") if p.record_id == idea_id), None)
    if idea is None:
        raise HTTPException(404, "No published idea with that id")
    claims = [
        _serialize(c)
        for c in _latest_publications(db, "claim")
        if c.public_payload.get("idea_id") == idea_id
    ]
    evidence = [
        _serialize(e)
        for e in _latest_publications(db, "evidence")
        if e.public_payload.get("idea_id") == idea_id
    ]
    return {"idea": _serialize(idea), "claims": claims, "evidence": evidence}


@router.get("/graph")
def graph(
    layers: str = Query("atlas,lineage,dependency,association"),
    problem: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """Four-layer graph restricted to published records. Geometry is chosen by the client; it is
    never a mathematical distance (docs/plan.md §8.2)."""
    wanted = set(layers.split(","))
    nodes: dict[str, dict] = {}
    areas = db.scalars(select(Area)).all()
    if "atlas" in wanted:
        for a in areas:
            nodes[a.id] = {
                "id": a.id,
                "type": "area",
                "label": a.name,
                "slug": a.slug,
                "depth": a.depth,
                "parent_id": a.parent_id,
            }
    problems = _latest_publications(db, "problem")
    if problem:
        problems = [p for p in problems if p.public_payload.get("slug") == problem]
    problem_ids = {p.record_id for p in problems}
    for p in problems:
        nodes[p.record_id] = {
            "id": p.record_id,
            "type": "problem",
            "label": p.public_payload["title"],
            "slug": p.public_payload["slug"],
            "status": p.public_payload["status"],
            "evidence_label": p.evidence_label,
            "areas": [a["slug"] for a in p.public_payload.get("areas", [])],
        }
    ideas = [
        i
        for i in _latest_publications(db, "idea")
        if i.public_payload.get("problem_id") in problem_ids
    ]
    for i in ideas:
        pl = i.public_payload
        nodes[i.record_id] = {
            "id": i.record_id,
            "type": "idea",
            "label": pl["title"],
            "problem_id": pl["problem_id"],
            "generation": pl["generation"],
            "depth": pl["depth"],
            "evidence_status": pl["evidence_status"],
            "scheduling_status": pl["scheduling_status"],
            "formalization_status": pl["formalization_status"],
            "evidence_label": i.evidence_label,
            "score": pl["score"],
            "method_tags": pl["method_tags"],
        }
    idea_ids = {i.record_id for i in ideas}
    claims = [
        c for c in _latest_publications(db, "claim") if c.public_payload.get("idea_id") in idea_ids
    ]
    for c in claims:
        nodes[c.record_id] = {
            "id": c.record_id,
            "type": "claim",
            "label": c.public_payload["statement"][:80],
            "idea_id": c.public_payload["idea_id"],
            "evidence_label": c.evidence_label,
            "formalization_status": c.public_payload["formalization_status"],
        }

    links: list[dict] = []
    if "atlas" in wanted:
        for a in areas:
            if a.parent_id and a.parent_id in nodes:
                links.append(
                    {"source": a.id, "target": a.parent_id, "layer": "atlas", "kind": "subfield_of"}
                )
    relations = db.scalars(select(Relation).where(Relation.layer.in_(wanted))).all()
    for r in relations:
        if r.source_id in nodes and r.target_id in nodes:
            links.append(
                {
                    "source": r.source_id,
                    "target": r.target_id,
                    "layer": r.layer,
                    "kind": r.kind,
                    "status": r.status,
                }
            )
    return {"nodes": list(nodes.values()), "links": links, "layers": sorted(wanted)}


@router.get("/events")
def public_events(
    since_id: int = 0, limit: int = Query(200, le=1000), db: Session = Depends(get_db)
) -> list[dict]:
    """Public timeline for replay. Only events written with visibility=public are visible; their
    payloads are constructed without private fields."""
    rows = db.scalars(
        select(Event)
        .where(Event.visibility == "public", Event.id > since_id)
        .order_by(Event.id)
        .limit(limit)
    ).all()
    return [
        {
            "id": e.id,
            "type": e.type,
            "record_type": e.record_type,
            "record_id": e.record_id,
            "payload": e.payload,
            "created_at": e.created_at.isoformat(),
        }
        for e in rows
    ]


@router.get("/labels")
def labels() -> dict:
    from ..services.publication import EVIDENCE_LABELS, PROBLEM_STATUS_LABELS

    return {"evidence": EVIDENCE_LABELS, "problem_status": PROBLEM_STATUS_LABELS}
