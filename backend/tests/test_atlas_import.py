"""Bulk atlas import: parsing a Wikipedia list page and loading it with provenance."""

from fastapi.testclient import TestClient

from app.services.atlas_import import clean_wikitext, parse_unsolved_list, to_atlas_document
from tests.conftest import OWNER

WIKITEXT = """
== Notable lists ==
* [[Hilbert's problems]] – not an open-problem listing
== Unsolved problems ==
=== Combinatorics ===
{{Main|Combinatorics}}
* The [[lonely runner conjecture]] – if <math>k</math> runners run round a track, will every
 runner be lonely?<ref>{{cite journal|title=x}}</ref>
* [[Frankl's conjecture|Union-closed sets conjecture]] – for any family of sets closed under
 unions, some element lies in at least half the sets.<ref name="a"/>
=== Number theory ===
==== Prime numbers ====
* [[Goldbach's conjecture]]: every even integer greater than 2 is the sum of two primes.
* [[Landau's problems]] – four problems about primes
==== Diophantine equations ====
* Is 33 the sum of three cubes? ''(trivial marker)''
=== Unknown heading ===
* [[Something ignored]] – unmapped section
== Problems solved since 2015 ==
=== Combinatorics ===
* [[Sensitivity conjecture]] – solved
"""


def test_parse_only_open_sections_with_section_paths() -> None:
    listed = parse_unsolved_list(WIKITEXT)
    titles = [p.title for p in listed]
    assert "Lonely runner conjecture" in titles
    assert "Union-closed sets conjecture" in titles
    assert "Goldbach's conjecture" in titles
    assert "Sensitivity conjecture" not in titles  # solved section is excluded
    assert "Hilbert's problems" not in titles  # not under "Unsolved problems"
    assert "Something ignored" not in titles  # unmapped heading
    goldbach = next(p for p in listed if p.title == "Goldbach's conjecture")
    assert goldbach.section_path == ["Number theory", "Prime numbers"]
    assert goldbach.areas == ["number-theory", "prime-numbers"]
    assert goldbach.url == "https://en.wikipedia.org/wiki/Goldbach's_conjecture"
    assert "sum of two primes" in goldbach.statement
    ucs = next(p for p in listed if p.title == "Union-closed sets conjecture")
    assert ucs.article == "Frankl's conjecture"
    assert "<ref" not in ucs.statement and "[[" not in ucs.statement


def test_clean_wikitext_strips_markup() -> None:
    assert clean_wikitext("''x'' and <math>k</math> [[a|b]] {{t|1}}<ref>r</ref>.") == "x and k b"


def test_document_has_provenance_and_import_is_idempotent(client: TestClient) -> None:
    listed = parse_unsolved_list(WIKITEXT)
    doc = to_atlas_document(listed, page="List_of_unsolved_problems_in_mathematics")
    assert doc["origin"] == "bulk_import"
    entry = next(p for p in doc["problems"] if p["slug"] == "landau-s-problems")
    assert entry["sources"][0]["aggregate"] is True
    assert entry["sources"][0]["location"].startswith("Unsolved problems > Number theory")
    assert entry["sources"][1]["url"] == "https://en.wikipedia.org/wiki/Landau's_problems"

    client.post("/private/seed", headers=OWNER)
    before = len(client.get("/public/problems").json())
    r = client.post(
        "/private/atlas/import/wikipedia",
        json={"wikitext": WIKITEXT, "dry_run": True},
        headers=OWNER,
    )
    assert r.status_code == 200 and r.json()["dry_run"] is True
    assert len(client.get("/public/problems").json()) == before

    r = client.post("/private/atlas/import/wikipedia", json={"wikitext": WIKITEXT}, headers=OWNER)
    assert r.status_code == 200, r.text
    counts = r.json()
    # lonely runner matches the seed slug (gets a second assertion); Goldbach has a new slug
    # but the same article URL -> duplicate, skipped
    assert counts["duplicates"] == 1
    assert counts["problems"] >= 2
    problems = client.get("/public/problems").json()
    slugs = {p["slug"] for p in problems}
    assert "landau-s-problems" in slugs and "union-closed-sets-conjecture" in slugs
    assert len([s for s in slugs if "lonely-runner" in s]) == 1
    assert "goldbach-s-conjecture" not in slugs and "goldbach-conjecture" in slugs

    again = client.post(
        "/private/atlas/import/wikipedia", json={"wikitext": WIKITEXT}, headers=OWNER
    ).json()
    assert again["problems"] == 0
    assert len(client.get("/public/problems").json()) == len(problems)

    detail = client.get("/public/problems/landau-s-problems").json()
    assert detail["problem"]["status"] == "reported_open"
    assert client.post("/private/atlas/import/wikipedia", json={}).status_code == 401
