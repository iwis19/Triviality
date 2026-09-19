import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Area, Problem, ProblemArea, Relation, Source, SourceAssertion
from ..services.atlas_import import normalize_url
from ..services.events import emit

SEED_PATH = Path(__file__).with_name("atlas_seed.json")


def load_seed(db: Session, path: Path = SEED_PATH) -> dict:
    return load_atlas_document(db, json.loads(path.read_text()))


def load_atlas_document(db: Session, data: dict) -> dict:
    """Idempotent: areas by slug, problems by slug, sources by URL. A new slug whose own
    (non-aggregate) source URL is already asserted for another problem is treated as a
    duplicate listing of that problem and skipped."""
    retrieved = data["retrieved_date"]
    origin = data.get("origin", "literature")
    counts = {"areas": 0, "problems": 0, "sources": 0, "duplicates": 0, "refreshed": 0}

    areas: dict[str, Area] = {a.slug: a for a in db.scalars(select(Area))}

    def ensure_area(slug: str, name: str, parent: Area | None, depth: int) -> Area:
        area = areas.get(slug)
        if area is None:
            area = Area(slug=slug, name=name, parent_id=parent.id if parent else None, depth=depth)
            db.add(area)
            db.flush()
            areas[slug] = area
            counts["areas"] += 1
            emit(db, "area.created", record_type="area", record_id=area.id, visibility="public")
        return area

    for raw in data["areas"]:
        top = ensure_area(raw["slug"], raw["name"], None, 0)
        for child in raw.get("children", []):
            ensure_area(child["slug"], child["name"], top, 1)

    existing_problems = {p.slug: p for p in db.scalars(select(Problem))}
    sources_by_url = {normalize_url(s.url): s for s in db.scalars(select(Source))}
    asserted_urls = {
        normalize_url(a.source.url)
        for a in db.scalars(select(SourceAssertion))
        if a.problem_id is not None
    }
    for raw in data["problems"]:
        problem = existing_problems.get(raw["slug"])
        if problem is not None:
            if problem.origin == "bulk_import" and _refresh_content(problem, raw):
                counts["refreshed"] += 1
                emit(
                    db,
                    "problem.refreshed",
                    record_type="problem",
                    record_id=problem.id,
                    visibility="public",
                )
            continue
        own_urls = {normalize_url(s["url"]) for s in raw["sources"] if not s.get("aggregate")}
        if own_urls & asserted_urls:
            counts["duplicates"] += 1
            continue
        problem = Problem(
            slug=raw["slug"],
            title=raw["title"],
            statement=raw["statement"],
            definitions=raw.get("definitions", ""),
            assumptions=raw.get("assumptions", ""),
            origin=origin,
            attribution=raw.get("attribution", ""),
            status=raw.get("status_override", "reported_open"),
            status_checked_at=retrieved,
            formal_target=raw.get("formal_target", ""),
            formal_target_status="proposed" if raw.get("formal_target") else "absent",
            coverage=(
                {"reference_formalization": raw["reference_formalization"]}
                if raw.get("reference_formalization")
                else {}
            ),
        )
        db.add(problem)
        db.flush()
        existing_problems[problem.slug] = problem
        asserted_urls |= own_urls
        counts["problems"] += 1
        for i, slug in enumerate(raw["areas"]):
            db.add(ProblemArea(problem_id=problem.id, area_id=areas[slug].id, primary=(i == 0)))
            db.add(
                Relation(
                    layer="atlas",
                    kind="classified_in",
                    source_type="problem",
                    source_id=problem.id,
                    target_type="area",
                    target_id=areas[slug].id,
                    status="checked",
                    provenance={"seed": True},
                )
            )
        for s in raw["sources"]:
            source = sources_by_url.get(normalize_url(s["url"]))
            if source is None:
                source = Source(
                    title=s["title"],
                    url=s["url"],
                    retrieved_date=retrieved,
                    reuse_policy=s.get("reuse_policy", "cite-only"),
                )
                db.add(source)
                db.flush()
                sources_by_url[normalize_url(s["url"])] = source
                counts["sources"] += 1
            db.add(
                SourceAssertion(
                    source_id=source.id,
                    problem_id=problem.id,
                    location=s.get("location", ""),
                    asserted_status=s["asserted_status"],
                    asserted_at=retrieved,
                    review_state="unreviewed",
                    notes=s.get("notes", ""),
                )
            )
        emit(
            db,
            "problem.created",
            record_type="problem",
            record_id=problem.id,
            visibility="public",
        )
    db.commit()
    return counts


def _refresh_content(problem: Problem, raw: dict) -> bool:
    """Re-imports may correct a bulk record's text and reference formalization; status,
    assertions and reviews are never touched."""
    changed = False
    statement = raw.get("statement", "")
    if statement and statement != problem.statement:
        problem.statement = statement
        changed = True
    definitions = raw.get("definitions", "")
    if definitions and definitions != problem.definitions:
        problem.definitions = definitions
        changed = True
    attribution = raw.get("attribution", "")
    if attribution and attribution != problem.attribution:
        problem.attribution = attribution
        changed = True
    reference = raw.get("reference_formalization")
    if reference and problem.coverage.get("reference_formalization") != reference:
        problem.coverage = {**problem.coverage, "reference_formalization": reference}
        changed = True
    return changed
