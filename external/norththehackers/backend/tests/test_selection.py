from app.services.selection import Candidate, select_generation


def _c(idea_id: str, tags: list[str], status: str = "untested", **kw: object) -> Candidate:
    return Candidate(
        idea_id=idea_id,
        method_tags=tags,
        evidence_status=status,
        review_status="unreviewed",
        formalization_status="absent",
        depth=1,
        **kw,  # type: ignore[arg-type]
    )


def test_refuted_and_duplicates_are_archived() -> None:
    decisions = select_generation(
        [
            _c("a", ["fourier"], "informal_proof_candidate"),
            _c("b", ["fourier"], "refuted"),
            _c("c", ["fourier"], "untested", duplicate_of="a"),
        ]
    )
    by_id = {d.idea_id: d for d in decisions}
    assert by_id["b"].decision == "archived"
    assert by_id["c"].decision == "archived"
    assert by_id["a"].decision in {"kept", "promoted"}


def test_diversity_quota_keeps_weak_cluster_representative() -> None:
    strong = [_c(f"f{i}", ["fourier"], "informal_proof_candidate") for i in range(6)]
    weak = [_c("p0", ["probabilistic"], "empirically_supported")]
    decisions = select_generation(strong + weak, keep_total=4, keep_per_cluster=2)
    kept = {d.idea_id for d in decisions if d.decision != "archived"}
    assert "p0" in kept
    assert len(kept) == 4


def test_pinned_always_kept() -> None:
    decisions = select_generation(
        [_c("pin", ["x"], "untested", pinned=True)]
        + [_c(f"s{i}", ["y"], "lean_verified") for i in range(8)],
        keep_total=3,
        keep_per_cluster=1,
    )
    pin = next(d for d in decisions if d.idea_id == "pin")
    assert pin.decision != "archived"
