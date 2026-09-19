"""Assignment prompts for Devin research sessions. Every prompt is bounded, states the exact
problem and assumptions, and says what may and may not be claimed."""

from __future__ import annotations

from ..models import Attempt, Campaign, Idea, Problem

ROLE_INSTRUCTIONS: dict[str, str] = {
    "hypothesis_generator": (
        "Produce 3 to 5 genuinely distinct approaches to the problem. For each: the approach, the "
        "mechanism that would make it work, the single lemma or computation whose failure would "
        "falsify it, a concrete next experiment, and method tags. If parent ideas are listed, "
        "refine or recombine them rather than repeating them. Do not claim any result is proved."
    ),
    "experimenter": (
        "Implement and run the bounded experiment described for the assigned idea. Report exactly "
        "what range was checked, every assumption, and the first failure if any. Return the code "
        "and raw results as an artifact. A passing experiment is evidence, not a proof."
    ),
    "critic": (
        "Find gaps, hidden assumptions, circularity, and invalid composition steps in the "
        "assigned idea and its claims. Check whether the key lemma is already known and cite the "
        "source if so. Report `supports` only if you found no gap after a genuine attempt."
    ),
    "prover_formalizer": (
        "Formalize the assigned claim in Lean 4 in the lab's project (import MathLab.Basic; no "
        "Mathlib unless the environment provides it). The theorem name and statement must match "
        "the approved target exactly. Do not use sorry, axiom, unsafe, native_decide, or "
        "set_option. If you cannot finish, return the partial file plus a precise list of "
        "remaining obligations. The lab's checker decides verification; do not report it yourself."
    ),
    "status_researcher": (
        "Check whether the problem's reported open status still holds against later literature. "
        "Return sources with exact locations and retrieval dates. "
        "Do not change any status yourself."
    ),
}


def describe_idea(idea: Idea) -> str:
    lines = [
        f"- id: {idea.id}",
        f"  title: {idea.title}",
        f"  approach: {idea.approach}",
        f"  evidence_status: {idea.evidence_status}; review: {idea.review_status}; "
        f"formalization: {idea.formalization_status}",
        f"  method_tags: {', '.join(idea.method_tags) or 'none'}",
    ]
    if idea.next_experiment:
        lines.append(f"  next_experiment: {idea.next_experiment}")
    for claim in idea.claims:
        lines.append(f"  claim {claim.id} (v{claim.version}): {claim.statement}")
        if claim.lean_declaration:
            lines.append(f"    approved Lean target: {claim.lean_declaration}")
    return "\n".join(lines)


def build_prompt(
    *,
    attempt: Attempt,
    campaign: Campaign,
    problem: Problem,
    active_ideas: list[Idea],
    parents: list[Idea],
    worker_api_base: str,
) -> str:
    sources = (
        "\n".join(
            f"- {a.source.title} — {a.source.url} ({a.location or 'n/a'}; "
            f"asserted {a.asserted_status} on {a.asserted_at or 'unknown date'})"
            for a in problem.assertions
        )
        or "- none recorded"
    )
    areas = ", ".join(area.name for area in problem.areas) or "unclassified"
    sections = [
        "You are a research worker in a mathematics lab. Work only on the bounded assignment "
        "below and stop when the deliverable is complete.",
        f"ROLE: {attempt.role}",
        ROLE_INSTRUCTIONS.get(attempt.role, ""),
        "PROBLEM",
        f"title: {problem.title}",
        f"areas: {areas}",
        f"statement: {problem.statement}",
        f"definitions: {problem.definitions or 'as standard'}",
        f"assumptions: {problem.assumptions or 'none beyond the statement'}",
        f"reported status: {problem.status} (checked {problem.status_checked_at or 'never'})",
        "sources:\n" + sources,
    ]
    if problem.formal_target:
        sections.append(f"approved formal target:\n{problem.formal_target}")
    if parents:
        sections.append(
            "PARENT IDEAS TO REFINE OR RECOMBINE\n" + "\n".join(map(describe_idea, parents))
        )
    if active_ideas:
        sections.append(
            "CURRENT ACTIVE IDEAS (avoid duplicates)\n"
            + "\n".join(map(describe_idea, active_ideas))
        )
    if attempt.idea_id:
        sections.append(f"ASSIGNED IDEA ID: {attempt.idea_id} (use target 'self' for its evidence)")
    sections += [
        "RULES",
        "- State every assumption. Never describe anything as verified, proved, or solved; the "
        "lab's independent checker assigns those labels.",
        "- Distinguish known results (cite them) from your own reasoning.",
        "- Return reproducible artifacts (code, data, Lean files) inline in the structured output.",
        "- Fill `gaps` with what remains unresolved. Empty gaps on an open problem is a red flag.",
        "- Leave `self_reported_models` empty unless your environment explicitly states the model.",
        "- Give every new idea and claim a `local_id` (I1, I2, C1, ...) and point each evidence "
        "item's `target` at one of those, at an existing idea/claim id, or at 'self'/'problem'. "
        "Evidence that names nothing attachable is kept but cannot be published against an idea.",
        "DELIVERABLE",
        "Call provide_structured_output with the required schema (ideas, evidence, gaps).",
        f"Optional progress reporting: POST {worker_api_base}/worker/attempts/{attempt.id}/submit "
        "with header X-Worker-Token set to the LAB_WORKER_TOKEN session secret and the same JSON "
        "shape; partial submissions are merged idempotently.",
        f"campaign: {campaign.id}; generation: {campaign.generation}; attempt: {attempt.id}",
    ]
    return "\n\n".join(section for section in sections if section)
