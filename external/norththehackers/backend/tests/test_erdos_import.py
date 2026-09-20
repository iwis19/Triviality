"""Erdős problems import: status table + formal-conjectures statements, with provenance."""

from fastapi.testclient import TestClient

from app.services.erdos_import import (
    attach_formalizations,
    attach_site_statements,
    parse_formal_conjecture,
    parse_site_statement,
    parse_status_table,
    to_atlas_document,
)
from tests.conftest import OWNER

TABLE = """
- number: "1"
  prize: "$500"
  informal_status: {state: "disproved", last_update: "2025-08-31"}
  formal_status: {state: "Lean", last_update: "2026-09-03", url: "https://example.org/1"}
  tags: ["number theory", "additive combinatorics"]
- number: "3"
  prize: "$5000"
  informal_status: {state: "open", last_update: "2025-07-01"}
  formal_status: {state: "unformalized"}
  tags: ["number theory", "arithmetic progressions"]
- number: "10"
  prize: "no"
  informal_status: {state: "falsifiable", last_update: "2025-07-01"}
  formal_status: {state: "unformalized"}
  tags: ["primes"]
  comments: "Known for small cases."
- number: "999"
  prize: "no"
  informal_status: {state: "open", last_update: "2025-07-01"}
  formal_status: {state: "unformalized"}
  tags: ["quantum widgets"]
"""

LEAN_3 = """
module

public import FormalConjecturesUtil

/-!
# Erdős Problem 3

*Reference:* [erdosproblems.com/3](https://www.erdosproblems.com/3)
-/

@[expose] public section

namespace Erdos3

/--
If $A \\subset \\mathbb{N}$ has $\\sum_{n \\in A}\\frac 1 n = \\infty$, then must $A$ contain
arbitrarily long arithmetic progressions?
-/
@[category research open, AMS 11]
theorem erdos_3 : answer(sorry) ↔ ∀ A : Set ℕ,
    (¬ Summable fun a : A ↦ 1 / (a : ℝ)) →
    ∃ᶠ (k : ℕ) in Filter.atTop, ∃ S ⊆ A, S.IsAPOfLength k := by
  sorry

end Erdos3
"""

LEAN_10 = """
/-- Is every large prime $p$ a widget? -/
@[category research open, AMS 11]
theorem erdos_10 (p : ℕ) (hp : p.Prime) : True := by
  trivial
"""


SITE_999 = """
<div class="problem-text" id="open">
    <div id="content">
Let $A$ be an infinite set with $a_1&lt;a_2&lt;\\cdots$ such that $b,c&#62;a$.<br><br>
Is\\[\\sum_{n\\in A}\\frac{1}{n}&#60;\\infty?\\]
    </div>
    <div id="problem_id"><a href="/999">#999</a></div>
</div>
"""


def test_site_statement_is_a_fallback_with_its_own_provenance() -> None:
    statement = parse_site_statement(SITE_999)
    assert statement.startswith(
        "Let $A$ be an infinite set with $a_1<a_2<\\cdots$ such that $b,c>a$. Is $\\sum"
    )
    assert "\\frac{1}{n}<\\infty?$" in statement
    entries = parse_status_table(TABLE)
    attach_formalizations(entries, {"3": LEAN_3})
    attach_site_statements(entries, {"3": "Canonical page text for #3.", "999": statement})
    doc = to_atlas_document(entries)
    by_slug = {p["slug"]: p for p in doc["problems"]}
    assert by_slug["erdos-3"]["statement"] == "Canonical page text for #3."  # page wins
    assert by_slug["erdos-3"]["reference_formalization"]["docstring"].startswith("If $A")
    assert by_slug["erdos-999"]["statement"] == statement
    assert by_slug["erdos-999"]["sources"][0]["location"] == "problem page; statement source"
    assert "reference_formalization" not in by_slug["erdos-999"]


LEAN_12 = """
/-- The set of $p^2$ is an example of a good set. -/
@[category textbook, AMS 11]
theorem isGood_example : IsGood {p ^ 2 | (p : ℕ)} := by
  sorry

/-- Part (i): is there a good set with positive lower density? -/
@[category research solved, AMS 11]
theorem erdos_12.parts.i : answer(True) ↔ ∃ (A : Set ℕ), IsGood A := by
  sorry

/-- Part (iii): is $\\sum_{n\\in A} 1/n < \\infty$ for every good set? -/
@[category research open, AMS 11]
theorem erdos_12.parts.iii : answer(sorry) ↔ ∀ A, IsGood A → Summable (fun n : A => 1 / n) := by
  sorry
"""


def test_main_theorem_is_the_open_part_not_the_first_declaration() -> None:
    statement, formal, name, category = parse_formal_conjecture(LEAN_12, "12")
    assert name == "erdos_12.parts.iii"
    assert category == "research open"
    assert statement.startswith("Part (iii)")
    assert formal.startswith("theorem erdos_12.parts.iii : answer(sorry)")


def test_parse_status_table_and_formal_conjecture() -> None:
    entries = parse_status_table(TABLE)
    assert [e.number for e in entries] == ["1", "3", "10", "999"]
    assert not entries[0].is_open and entries[0].formal_solution == "Lean"
    assert entries[2].is_open  # falsifiable still counts as reported open

    statement, formal, name, category = parse_formal_conjecture(LEAN_3, "3")
    assert statement.startswith("If A ⊂ N has") or statement.startswith("If $A \\subset N$")
    assert "arithmetic progressions?" in statement
    assert formal.startswith("theorem erdos_3 : answer(sorry) ↔ ∀ A : Set ℕ")
    assert formal.endswith("S.IsAPOfLength k")
    assert name == "erdos_3"
    assert category == "research open"


def test_document_keeps_states_as_assertions_and_skips_unstated() -> None:
    entries = parse_status_table(TABLE)
    attach_formalizations(entries, {"3": LEAN_3, "10": LEAN_10})
    doc = to_atlas_document(entries)
    slugs = [p["slug"] for p in doc["problems"]]
    assert slugs == ["erdos-3", "erdos-10"]  # #1 resolved, #999 has no statement

    p3 = next(p for p in doc["problems"] if p["slug"] == "erdos-3")
    assert p3["areas"][:2] == ["number-theory", "number-theory-general"]
    assert "additive-number-theory" in p3["areas"]
    assert p3["attribution"] == "P. Erdős; prize $5000"
    assert p3["sources"][0]["url"] == "https://www.erdosproblems.com/3"
    assert p3["sources"][0]["asserted_status"] == "open"
    assert all(s["asserted_status"] == "open" for s in p3["sources"])
    assert p3["reference_formalization"]["declaration"] == "erdos_3"
    assert "formal_target" not in p3  # external statement is never the approved target

    p10 = next(p for p in doc["problems"] if p["slug"] == "erdos-10")
    assert p10["sources"][0]["asserted_status"] == "falsifiable"
    assert p10["definitions"] == "Known for small cases."
    assert p10["areas"][:2] == ["number-theory", "prime-distribution"]

    with_resolved = to_atlas_document(entries, include_resolved=True, require_statement=False)
    p1 = next(p for p in with_resolved["problems"] if p["slug"] == "erdos-1")
    assert p1["status_override"] == "resolved"
    assert p1["sources"][0]["asserted_status"] == "resolved"
    assert "Lean" in p1["sources"][0]["notes"]
    p999 = next(p for p in with_resolved["problems"] if p["slug"] == "erdos-999")
    assert p999["areas"] == ["number-theory", "erdos-uncategorised"]


def test_import_route_dedupes_seed_and_publishes_reference(client: TestClient) -> None:
    client.post("/private/seed", headers=OWNER)
    body = {
        "status_table": TABLE,
        "formal_sources": {"1": LEAN_3, "3": LEAN_3, "10": LEAN_10},
        "site_statements": {},
    }

    r = client.post("/private/atlas/import/erdos", json={**body, "dry_run": True}, headers=OWNER)
    assert r.status_code == 200
    assert r.json()["importable"] == 2
    assert client.get("/public/problems/erdos-3").status_code == 404

    r = client.post("/private/atlas/import/erdos", json=body, headers=OWNER)
    assert r.status_code == 200
    assert r.json()["problems"] == 2 and r.json()["published"] >= 2

    detail = client.get("/public/problems/erdos-3").json()["problem"]
    assert detail["status"] == "reported_open"
    assert detail["reference_formalization"]["library"] == "google-deepmind/formal-conjectures"
    assert detail["formal_target"] == ""
    assert {s["review_state"] for s in detail["sources"]} == {"unreviewed"}

    refreshed = client.post(
        "/private/atlas/import/erdos",
        json={**body, "site_statements": {"3": "Page text for #3."}},
        headers=OWNER,
    ).json()
    assert refreshed["problems"] == 0 and refreshed["refreshed"] == 1
    detail = client.get("/public/problems/erdos-3").json()["problem"]
    assert detail["statement"] == "Page text for #3."
    assert detail["status"] == "reported_open"
    assert len(detail["sources"]) == 3  # assertions are not duplicated by a refresh

    # the seed already asserts erdosproblems.com/1 -> a resolved re-import is a duplicate
    r = client.post(
        "/private/atlas/import/erdos", json={**body, "include_resolved": True}, headers=OWNER
    )
    assert r.json()["problems"] == 0 and r.json()["duplicates"] == 1
    assert client.get("/public/problems/erdos-1").status_code == 404

    assert client.post("/private/atlas/import/erdos", json={}).status_code == 401
