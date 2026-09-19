"""Idempotent ingestion of worker output into the research graph.

Workers propose; the lab records. Worker-submitted evidence is stored uncertified. Only the lab's
Lean checker (and, later, collaborator review) can certify. A worker-reported refutation becomes
`unresolved_conflict` until independently checked.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from sqlalchemy.orm import Session

from ..models import Attempt, Campaign, Claim, Evidence, Idea, IdeaParent, Relation
from .artifacts import store_artifact
from .events import emit
from .lean_checker import LeanChecker

WORKER_STATUS_MAP: dict[tuple[str, str], str] = {
    ("counterexample_search", "supports"): "counterexample_checked",
    ("counterexample_search", "refutes"): "unresolved_conflict",
    ("numerical_experiment", "supports"): "empirically_supported",
    ("numerical_experiment", "refutes"): "unresolved_conflict",
    ("construction", "supports"): "empirically_supported",
    ("construction", "refutes"): "unresolved_conflict",
    ("proof_sketch", "supports"): "proof_sketch",
    ("informal_proof", "supports"): "informal_proof_candidate",
    ("informal_proof", "refutes"): "unresolved_conflict",
    ("lean_attempt", "supports"): "lean_formalization_in_progress",
    ("lean_attempt", "inconclusive"): "lean_formalization_in_progress",
    ("lean_attempt", "refutes"): "lean_formalization_in_progress",
}

# Evidence statuses ordered by strength; ingestion never downgrades certified statuses.
STRENGTH = [
    "refuted",
    "untested",
    "unresolved_conflict",
    "empirically_supported",
    "counterexample_checked",
    "proof_sketch",
    "informal_proof_candidate",
    "lean_formalization_in_progress",
    "lean_verified",
]


def content_hash(*parts: str) -> str:
    return hashlib.sha256("\u241f".join(parts).encode()).hexdigest()


def stronger(current: str, proposed: str) -> str:
    if current == "lean_verified" or current == "refuted":
        return current
    if proposed in {"refuted", "lean_verified"}:
        return proposed
    return proposed if STRENGTH.index(proposed) > STRENGTH.index(current) else current


class Ingestor:
    def __init__(self, artifact_root: Path, lean_checker: LeanChecker):
        self.artifact_root = artifact_root
        self.lean_checker = lean_checker

    def ingest(self, db: Session, attempt: Attempt, output: dict, *, partial: bool = False) -> dict:
        """Merge one structured-output payload. Safe to call repeatedly: ideas are keyed by
        (attempt, title) and evidence by (attempt, target, check_type, summary)."""
        campaign = db.get(Campaign, attempt.campaign_id)
        assert campaign is not None
        created = {"ideas": 0, "claims": 0, "evidence": 0, "lean_checks": 0}
        id_map: dict[str, str] = {}

        for raw in output.get("ideas", []) or []:
            idea = self._upsert_idea(db, attempt, campaign, raw)
            if idea is None:
                continue
            created["ideas"] += 1
            id_map[raw.get("title", "")] = idea.id
            for raw_claim in raw.get("claims", []) or []:
                if self._upsert_claim(db, campaign, idea, raw_claim):
                    created["claims"] += 1

        for raw in output.get("evidence", []) or []:
            outcome = self._upsert_evidence(db, attempt, campaign, raw, id_map)
            created["evidence"] += outcome[0]
            created["lean_checks"] += outcome[1]

        if not partial:
            attempt.result = {
                "gaps": output.get("gaps", []),
                "self_reported_models": output.get("self_reported_models", ""),
                "counts": created,
            }
            attempt.result_ingested = True
        emit(
            db,
            "attempt.ingested",
            record_type="attempt",
            record_id=attempt.id,
            payload={"campaign_id": campaign.id, "counts": created, "partial": partial},
        )
        return created

    # -- ideas -------------------------------------------------------------------------------

    def _upsert_idea(
        self, db: Session, attempt: Attempt, campaign: Campaign, raw: dict
    ) -> Idea | None:
        title = (raw.get("title") or "").strip()
        approach = (raw.get("approach") or "").strip()
        if not title or not approach:
            return None
        existing = (
            db.query(Idea)
            .filter(Idea.produced_by_attempt_id == attempt.id, Idea.title == title)
            .one_or_none()
        )
        if existing:
            return existing
        parent_ids = [p for p in raw.get("parent_idea_ids", []) or [] if isinstance(p, str)]
        parents = [
            p
            for p in (db.get(Idea, pid) for pid in parent_ids)
            if p is not None and p.campaign_id == campaign.id
        ]
        if not parents and attempt.idea_id:
            assigned = db.get(Idea, attempt.idea_id)
            if assigned is not None:
                parents = [assigned]
        if not parents:
            # worker omitted lineage: fall back to the parents frozen into the assignment
            assigned_ids = attempt.model_metadata.get("parent_idea_ids", [])
            parents = [
                p
                for p in (db.get(Idea, pid) for pid in assigned_ids)
                if p is not None and p.campaign_id == campaign.id
            ]
        idea = Idea(
            campaign_id=campaign.id,
            title=title,
            approach=approach,
            mechanism=raw.get("mechanism", "") or "",
            next_experiment=raw.get("next_experiment", "") or "",
            novelty_rationale=raw.get("novelty_rationale", "") or "",
            method_tags=[t for t in raw.get("method_tags", []) or [] if isinstance(t, str)][:8],
            generation=campaign.generation,
            depth=(1 + max(p.depth for p in parents)) if parents else 0,
            produced_by_attempt_id=attempt.id,
        )
        db.add(idea)
        db.flush()
        for parent in parents:
            kind = "combined_from" if len(parents) > 1 else "refined_from"
            db.add(IdeaParent(child_id=idea.id, parent_id=parent.id, kind=kind))
            db.add(
                Relation(
                    layer="lineage",
                    kind=kind,
                    source_type="idea",
                    source_id=idea.id,
                    target_type="idea",
                    target_id=parent.id,
                    status="checked",
                    provenance={"attempt_id": attempt.id},
                )
            )
        if not parents:
            db.add(
                Relation(
                    layer="lineage",
                    kind="proposed_for",
                    source_type="idea",
                    source_id=idea.id,
                    target_type="problem",
                    target_id=campaign.problem_id,
                    status="checked",
                    provenance={"attempt_id": attempt.id},
                )
            )
        emit(
            db,
            "idea.created",
            record_type="idea",
            record_id=idea.id,
            payload={"campaign_id": campaign.id, "generation": idea.generation},
        )
        return idea

    def _upsert_claim(self, db: Session, campaign: Campaign, idea: Idea, raw: dict) -> bool:
        statement = (raw.get("statement") or "").strip()
        if not statement:
            return False
        lean_decl = (raw.get("lean_declaration") or "").strip()
        digest = content_hash(statement, raw.get("scope", "") or "", lean_decl)
        if db.query(Claim).filter(Claim.idea_id == idea.id, Claim.content_hash == digest).first():
            return False
        claim = Claim(
            campaign_id=campaign.id,
            idea_id=idea.id,
            statement=statement,
            scope=raw.get("scope", "") or "",
            lean_declaration=lean_decl,
            content_hash=digest,
            formalization_status="target_proposed" if lean_decl else "absent",
        )
        db.add(claim)
        db.flush()
        db.add(
            Relation(
                layer="dependency",
                kind="addresses",
                source_type="idea",
                source_id=idea.id,
                target_type="claim",
                target_id=claim.id,
                status="checked",
            )
        )
        emit(
            db,
            "claim.created",
            record_type="claim",
            record_id=claim.id,
            payload={"campaign_id": campaign.id},
        )
        return True

    # -- evidence ----------------------------------------------------------------------------

    def _resolve_target(
        self, db: Session, attempt: Attempt, target: str, id_map: dict[str, str]
    ) -> tuple[Idea | None, Claim | None]:
        if target == "self" and attempt.idea_id:
            return db.get(Idea, attempt.idea_id), None
        if target in id_map:
            return db.get(Idea, id_map[target]), None
        idea = db.get(Idea, target)
        if idea is not None and idea.campaign_id == attempt.campaign_id:
            return idea, None
        claim = db.get(Claim, target)
        if claim is not None and claim.campaign_id == attempt.campaign_id:
            return claim.idea, claim
        return None, None

    def _upsert_evidence(
        self, db: Session, attempt: Attempt, campaign: Campaign, raw: dict, id_map: dict[str, str]
    ) -> tuple[int, int]:
        check_type = raw.get("check_type", "")
        result = raw.get("result", "")
        summary = (raw.get("summary") or "").strip()
        if check_type not in {k for k, _ in WORKER_STATUS_MAP} | {"critique", "literature_check"}:
            return 0, 0
        if result not in {"supports", "refutes", "inconclusive"} or not summary:
            return 0, 0
        idea, claim = self._resolve_target(db, attempt, raw.get("target", "self"), id_map)
        if idea is None and claim is None:
            return 0, 0
        existing = (
            db.query(Evidence)
            .filter(
                Evidence.produced_by_attempt_id == attempt.id,
                Evidence.check_type == check_type,
                Evidence.summary == summary,
            )
            .first()
        )
        if existing:
            return 0, 0

        artifact = None
        artifact_raw = raw.get("artifact")
        if isinstance(artifact_raw, dict) and artifact_raw.get("content"):
            artifact = store_artifact(
                db,
                self.artifact_root,
                filename=str(artifact_raw.get("filename", "artifact.txt"))[:300],
                content=str(artifact_raw["content"]),
                media_type=str(artifact_raw.get("media_type", "text/plain")),
                producer_attempt_id=attempt.id,
                manifest={"requested_mode": attempt.requested_mode, "role": attempt.role},
            )
        evidence = Evidence(
            idea_id=idea.id if idea else None,
            claim_id=claim.id if claim else None,
            claim_version=claim.version if claim else 0,
            check_type=check_type,
            result=result,
            summary=summary,
            coverage=raw.get("coverage", "") or "",
            verifier=f"worker:{attempt.provider}:{attempt.requested_mode}",
            verifier_version=attempt.provider_session_id or "",
            certified=False,
            details={"assumptions": raw.get("assumptions", []) or []},
            artifact_id=artifact.id if artifact else None,
            produced_by_attempt_id=attempt.id,
        )
        db.add(evidence)
        db.flush()
        emit(
            db,
            "evidence.created",
            record_type="evidence",
            record_id=evidence.id,
            payload={"campaign_id": campaign.id, "certified": False},
        )

        if idea is not None:
            proposed = WORKER_STATUS_MAP.get((check_type, result))
            if proposed:
                idea.evidence_status = stronger(idea.evidence_status, proposed)
            if check_type == "critique" and idea.review_status == "unreviewed":
                idea.review_status = "ai_critiqued"
            if check_type == "lean_attempt" and idea.formalization_status in {
                "absent",
                "target_proposed",
            }:
                idea.formalization_status = "in_progress"

        lean_checks = 0
        if (
            check_type == "lean_attempt"
            and artifact is not None
            and artifact_raw is not None
            and claim is not None
        ):
            lean_checks = self._run_lean_check(
                db, attempt, claim, idea, str(artifact_raw["content"]), artifact.id
            )
        return 1, lean_checks

    def _run_lean_check(
        self,
        db: Session,
        attempt: Attempt,
        claim: Claim,
        idea: Idea | None,
        source: str,
        artifact_id: str,
    ) -> int:
        target_decl = _declaration_name(claim.lean_declaration)
        if not target_decl:
            return 0
        approved = _declaration_signature(claim.lean_declaration)
        outcome = self.lean_checker.check(source, target_decl, approved)
        verified = outcome.status == "verified"
        result = (
            "verified"
            if verified
            else ("rejected" if outcome.status == "rejected" else "inconclusive")
        )
        check = Evidence(
            idea_id=idea.id if idea else None,
            claim_id=claim.id,
            claim_version=claim.version,
            check_type="lean_check",
            result=result,
            summary="; ".join(outcome.reasons)
            if outcome.reasons
            else "Lean checked the approved target",
            verifier="lab-lean-checker",
            verifier_version=outcome.toolchain,
            certified=verified,
            details=outcome.as_details(),
            artifact_id=artifact_id,
            produced_by_attempt_id=attempt.id,
        )
        db.add(check)
        db.flush()
        if verified:
            claim.formalization_status = "complete"
            if idea is not None:
                idea.evidence_status = "lean_verified"
                idea.formalization_status = "complete"
                db.add(
                    Relation(
                        layer="dependency",
                        kind="proves",
                        source_type="idea",
                        source_id=idea.id,
                        target_type="claim",
                        target_id=claim.id,
                        status="checked",
                        provenance={"evidence_id": check.id},
                    )
                )
        elif outcome.status == "rejected":
            claim.formalization_status = "blocked"
            if idea is not None and idea.formalization_status != "complete":
                idea.formalization_status = "blocked"
        emit(
            db,
            "evidence.created",
            record_type="evidence",
            record_id=check.id,
            payload={
                "campaign_id": attempt.campaign_id,
                "certified": verified,
                "lean_status": outcome.status,
            },
        )
        return 1


def _declaration_name(lean_declaration: str) -> str:
    import re

    match = re.match(r"\s*(?:theorem|lemma)\s+([A-Za-z_][\w.']*)", lean_declaration)
    return match.group(1) if match else ""


def _declaration_signature(lean_declaration: str) -> str:
    """Return everything between the declaration name and `:=` (binders and statement)."""
    import re

    match = re.match(
        r"\s*(?:theorem|lemma)\s+[A-Za-z_][\w.']*\s*(.*?)\s*(?::=.*)?$", lean_declaration, re.S
    )
    return match.group(1) if match else ""
