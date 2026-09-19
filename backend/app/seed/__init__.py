import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Area, Problem, ProblemArea, Relation, Source, SourceAssertion
from ..services.events import emit

SEED_PATH = Path(__file__).with_name("atlas_seed.json")


def load_seed(db: Session, path: Path = SEED_PATH) -> dict:
    """Idempotent: areas by slug, problems by slug, sources by URL."""
    data = json.loads(path.read_text())
    retrieved = data["retrieved_date"]
    counts = {"areas": 0, "problems": 0, "sources": 0}

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
    sources_by_url = {s.url: s for s in db.scalars(select(Source))}
    for raw in data["problems"]:
        problem = existing_problems.get(raw["slug"])
        if problem is None:
            problem = Problem(
                slug=raw["slug"],
                title=raw["title"],
                statement=raw["statement"],
                definitions=raw.get("definitions", ""),
                assumptions=raw.get("assumptions", ""),
                origin="literature",
                attribution=raw.get("attribution", ""),
                status=raw.get("status_override", "reported_open"),
                status_checked_at=retrieved,
                formal_target=raw.get("formal_target", ""),
                formal_target_status="proposed" if raw.get("formal_target") else "absent",
            )
            db.add(problem)
            db.flush()
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
                source = sources_by_url.get(s["url"])
                if source is None:
                    source = Source(
                        title=s["title"],
                        url=s["url"],
                        retrieved_date=retrieved,
                        reuse_policy=s.get("reuse_policy", "cite-only"),
                    )
                    db.add(source)
                    db.flush()
                    sources_by_url[s["url"]] = source
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
