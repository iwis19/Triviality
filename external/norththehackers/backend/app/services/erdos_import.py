"""Bulk atlas ingestion of the Erdős problems.

Two Apache-2.0 community datasets are combined per problem number:

* `teorth/erdosproblems` `data/problems.yaml` — the status table (informal state, whether a
  solution is Lean-formalized, tags, prize), each state carrying a `last_update` date.
* `google-deepmind/formal-conjectures` `FormalConjectures/ErdosProblems/<n>.lean` — a Lean
  statement of the problem whose docstring is the informal statement.

The status table's state is stored as a dated, unreviewed source assertion; the erdosproblems.com
page is the primary source URL. A Lean statement from formal-conjectures is kept as a *reference
formalization* (it targets that project's own library, not the lab's checker) and never as the
lab's approved formal target.
"""

from __future__ import annotations

import html
import re
import time
from dataclasses import dataclass, field
from datetime import date

import httpx
import yaml

from .atlas_import import TOP_AREA_NAMES

STATUS_TABLE_URL = "https://raw.githubusercontent.com/teorth/erdosproblems/main/data/problems.yaml"
STATUS_TABLE_PAGE = "https://github.com/teorth/erdosproblems/blob/main/data/problems.yaml"
FORMAL_RAW = (
    "https://raw.githubusercontent.com/google-deepmind/formal-conjectures/main/"
    "FormalConjectures/ErdosProblems/{n}.lean"
)
FORMAL_PAGE = (
    "https://github.com/google-deepmind/formal-conjectures/blob/main/"
    "FormalConjectures/ErdosProblems/{n}.lean"
)
PROBLEM_PAGE = "https://www.erdosproblems.com/{n}"

# Informal states the community table treats as "still open" (some with a known finite route).
OPEN_STATES = {
    "open",
    "falsifiable",
    "verifiable",
    "decidable",
    "not provable",
    "not disprovable",
}
RESOLVED_STATES = {"proved", "disproved", "solved", "independent"}

# erdosproblems.com tag -> (top-level lab area slug, child slug, child name)
_NT = "number-theory"
_ADD = (_NT, "additive-number-theory", "Additive and combinatorial number theory")
_PRIME = (_NT, "prime-distribution", "Distribution of primes")
_MULT = (_NT, "multiplicative-number-theory", "Multiplicative number theory")
_DIOPH = (_NT, "diophantine", "Diophantine problems")
_TRANS = (_NT, "transcendence", "Irrationality and transcendence")
_GRAPH = ("combinatorics", "graph-theory", "Graph theory")
_EXTSET = ("combinatorics", "extremal-set-theory", "Extremal set theory")
_DGEOM = ("geometry-topology", "discrete-geometry", "Discrete and combinatorial geometry")
_ANALYSIS = ("analysis", "analysis-general", "Analysis (general)")
_SETTH = ("logic-foundations", "set-theory", "Set theory")
TAG_AREAS: dict[str, tuple[str, str, str]] = {
    "number theory": (_NT, "number-theory-general", "Number theory (general)"),
    "additive combinatorics": _ADD,
    "additive basis": _ADD,
    "sidon sets": _ADD,
    "sumsets": _ADD,
    "arithmetic progressions": _ADD,
    "primes": _PRIME,
    "prime gaps": _PRIME,
    "divisors": _MULT,
    "factorials": _MULT,
    "covering systems": (_NT, "covering-systems", "Covering systems"),
    "diophantine equations": _DIOPH,
    "unit fractions": _DIOPH,
    "egyptian fractions": _DIOPH,
    "irrationality": _TRANS,
    "transcendence": _TRANS,
    "graph theory": _GRAPH,
    "chromatic number": _GRAPH,
    "hypergraphs": ("combinatorics", "hypergraphs", "Hypergraphs"),
    "ramsey theory": ("combinatorics", "ramsey-theory", "Ramsey theory"),
    "combinatorics": ("combinatorics", "combinatorics-general", "Combinatorics (general)"),
    "intersecting family": _EXTSET,
    "set systems": _EXTSET,
    "extremal combinatorics": ("combinatorics", "extremal-combinatorics", "Extremal combinatorics"),
    "discrete geometry": _DGEOM,
    "geometry": _DGEOM,
    "incidence geometry": _DGEOM,
    "analysis": _ANALYSIS,
    "polynomials": ("analysis", "polynomials", "Polynomials"),
    "power series": _ANALYSIS,
    "probability": ("probability-statistics", "probability-theory", "Probability theory"),
    "random graphs": ("probability-statistics", "random-structures", "Random discrete structures"),
    "set theory": _SETTH,
    "infinite combinatorics": _SETTH,
    "group theory": ("algebra", "group-theory", "Group theory"),
    "algebra": ("algebra", "algebra-general", "Algebra (general)"),
}
FALLBACK_AREA = ("number-theory", "erdos-uncategorised", "Erdős problems (uncategorised)")

_DOCSTRING = re.compile(r"/--\s*(.*?)\s*-/", re.S)
_THEOREM = re.compile(r"^(?:@\[[^\]]*\]\s*)?(theorem|lemma)\s+(\S+)(.*?)\s*:=\s*by\b", re.S | re.M)
_CATEGORY = re.compile(r"@\[category\s+([^,\]]+)")
_SITE_STATEMENT = re.compile(r'<div id="content">\s*(.*?)\s*</div>', re.S)
_HTML_TAG = re.compile(r"<[^>]+>")
_LATEX_CMD = re.compile(r"\\(mathbb|mathcal|mathrm|text|operatorname)\{([^}]*)\}")
_WS = re.compile(r"\s+")


@dataclass
class ErdosEntry:
    number: str
    state: str
    state_updated: str
    formal_solution: str  # "unformalized" | "Lean"
    formal_solution_url: str
    prize: str
    tags: list[str] = field(default_factory=list)
    comments: str = ""
    statement: str = ""
    formal_statement: str = ""
    formal_declaration: str = ""
    formal_category: str = ""
    statement_source: str = ""  # formal-conjectures | erdosproblems.com
    formal_docstring: str = ""

    @property
    def is_open(self) -> bool:
        return self.state in OPEN_STATES

    @property
    def url(self) -> str:
        return PROBLEM_PAGE.format(n=self.number)


def parse_status_table(text: str) -> list[ErdosEntry]:
    rows = yaml.safe_load(text) or []
    entries = []
    for row in rows:
        informal = row.get("informal_status") or {}
        formal = row.get("formal_status") or {}
        entries.append(
            ErdosEntry(
                number=str(row["number"]),
                state=str(informal.get("state", "open")),
                state_updated=str(informal.get("last_update", "")),
                formal_solution=str(formal.get("state", "unformalized")),
                formal_solution_url=str(formal.get("url", "")),
                prize=str(row.get("prize", "no")),
                tags=[str(t) for t in row.get("tags") or []],
                comments=str(row.get("comments", "") or ""),
            )
        )
    return entries


def _plain_math(text: str) -> str:
    """Light LaTeX cleanup that leaves `<`, `>` and TeX macros intact (they are maths here,
    not markup)."""
    text = _LATEX_CMD.sub(lambda m: m.group(2), text)
    text = text.replace("\\[", " $").replace("\\]", "$ ")
    return _WS.sub(" ", text).strip(" .;,")


def _theorem_rank(name: str, category: str, number: str) -> tuple[int, int, int]:
    """Prefer the problem's own declaration, then research-open parts, then any research one."""
    own = name == f"erdos_{number}" or name.startswith(f"erdos_{number}.parts")
    variant = name.startswith(f"erdos_{number}")
    return (
        0 if "research open" in category else 1 if "research" in category else 2,
        0 if own else 1 if variant else 2,
        0,
    )


def parse_formal_conjecture(source: str, number: str = "") -> tuple[str, str, str, str]:
    """Return (informal docstring, `theorem name binders : statement`, declaration name,
    category) for the file's main open statement, or empty strings when absent."""
    best: tuple[tuple[int, int, int], int, re.Match[str]] | None = None
    for i, m in enumerate(_THEOREM.finditer(source)):
        cat = _CATEGORY.search(m.group(0))
        category = cat.group(1).strip() if cat else ""
        rank = _theorem_rank(m.group(2), category, number)
        if best is None or (rank, i) < (best[0], best[1]):
            best = (rank, i, m)
    if best is None:
        return "", "", "", ""
    m = best[2]
    kind, name, rest = m.group(1), m.group(2), m.group(3)
    docs = [d for d in _DOCSTRING.finditer(source) if d.end() <= m.start()]
    statement = _plain_math(docs[-1].group(1)) if docs else ""
    formal = _WS.sub(" ", f"{kind} {name}{rest}").strip()
    cat = _CATEGORY.search(m.group(0))
    return statement, formal, name, cat.group(1).strip() if cat else ""


def fetch_status_table(timeout: float = 30.0) -> str:
    with httpx.Client(timeout=timeout, headers=_headers(), follow_redirects=True) as client:
        r = client.get(STATUS_TABLE_URL)
        r.raise_for_status()
        return r.text


def fetch_formal_conjectures(numbers: list[str], timeout: float = 30.0) -> dict[str, str]:
    """Lean sources by problem number; numbers without a file are omitted."""
    out: dict[str, str] = {}
    with httpx.Client(timeout=timeout, headers=_headers(), follow_redirects=True) as client:
        for n in numbers:
            r = client.get(FORMAL_RAW.format(n=n))
            if r.status_code == 200:
                out[n] = r.text
            elif r.status_code != 404:
                r.raise_for_status()
    return out


def parse_site_statement(page_html: str) -> str:
    """The problem statement block of an erdosproblems.com problem page."""
    m = _SITE_STATEMENT.search(page_html)
    if m is None:
        return ""
    return _plain_math(html.unescape(_HTML_TAG.sub(" ", m.group(1))))


def fetch_site_statements(
    numbers: list[str], timeout: float = 30.0, pause: float = 0.25
) -> dict[str, str]:
    """Statements scraped from erdosproblems.com pages, politely paced; misses are omitted."""
    out: dict[str, str] = {}
    with httpx.Client(timeout=timeout, headers=_headers(), follow_redirects=True) as client:
        for n in numbers:
            r = client.get(PROBLEM_PAGE.format(n=n))
            if r.status_code == 200:
                statement = parse_site_statement(r.text)
                if statement:
                    out[n] = statement
            elif r.status_code != 404:
                r.raise_for_status()
            time.sleep(pause)
    return out


def _headers() -> dict[str, str]:
    return {
        "User-Agent": "MathLabAtlasBot/0.1 (https://github.com/sharonbasovich/norththehackers) "
        f"python-httpx/{httpx.__version__}"
    }


def attach_formalizations(entries: list[ErdosEntry], sources: dict[str, str]) -> None:
    """Reference Lean statements; their docstring serves as the statement until the problem
    page's own text is attached."""
    for e in entries:
        src = sources.get(e.number)
        if src is None:
            continue
        e.statement, e.formal_statement, e.formal_declaration, e.formal_category = (
            parse_formal_conjecture(src, e.number)
        )
        e.formal_docstring = e.statement
        if e.statement:
            e.statement_source = "formal-conjectures"


def attach_site_statements(entries: list[ErdosEntry], statements: dict[str, str]) -> None:
    """The erdosproblems.com page text is the canonical statement and overrides a docstring."""
    for e in entries:
        if statements.get(e.number):
            e.statement = statements[e.number]
            e.statement_source = "erdosproblems.com"


def _state_note(e: ErdosEntry) -> str:
    note = f"community table state '{e.state}' (last update {e.state_updated or 'n/a'})"
    if e.formal_solution == "Lean":
        note += f"; solution formalized in Lean: {e.formal_solution_url}"
    return note


def areas_for(tags: list[str]) -> list[tuple[str, str, str]]:
    found = [TAG_AREAS[t.lower()] for t in tags if t.lower() in TAG_AREAS]
    unique: list[tuple[str, str, str]] = []
    for a in found:
        if a not in unique:
            unique.append(a)
    return unique or [FALLBACK_AREA]


def to_atlas_document(
    entries: list[ErdosEntry],
    *,
    retrieved: date | None = None,
    include_resolved: bool = False,
    require_statement: bool = True,
) -> dict:
    """Shape the table as the atlas document consumed by `load_atlas_document`.

    By default only problems the community table still reports as open *and* for which an
    informal statement was recovered are included; the rest would be atlas entries with no
    mathematical content."""
    retrieved_date = (retrieved or date.today()).isoformat()
    areas: dict[str, dict] = {}
    problems = []
    for e in entries:
        if not e.is_open and not include_resolved:
            continue
        if require_statement and not e.statement:
            continue
        mapped = areas_for(e.tags)
        area_slugs: list[str] = []
        for top_slug, child_slug, child_name in mapped:
            top = areas.setdefault(
                top_slug,
                {"slug": top_slug, "name": TOP_AREA_NAMES.get(top_slug, top_slug), "children": {}},
            )
            top["children"][child_slug] = {"slug": child_slug, "name": child_name}
            for s in (top_slug, child_slug):
                if s not in area_slugs:
                    area_slugs.append(s)
        asserted = e.state if e.is_open else "resolved"
        sources = [
            {
                "title": f"Erdős Problems #{e.number} (erdosproblems.com)",
                "url": e.url,
                "location": "problem page"
                + ("; statement source" if e.statement_source == "erdosproblems.com" else ""),
                "asserted_status": asserted,
                "notes": _state_note(e),
            },
            {
                "title": "teorth/erdosproblems community status table",
                "url": STATUS_TABLE_PAGE,
                "location": f"number {e.number}",
                "asserted_status": asserted,
                "aggregate": True,
                "reuse_policy": "Apache-2.0",
                "notes": f"informal_status.state={e.state}; tags={', '.join(e.tags)}",
            },
        ]
        if e.formal_statement:
            sources.append(
                {
                    "title": f"formal-conjectures ErdosProblems/{e.number}.lean",
                    "url": FORMAL_PAGE.format(n=e.number),
                    "location": e.formal_declaration,
                    "asserted_status": "open" if "open" in e.formal_category else asserted,
                    "aggregate": True,
                    "reuse_policy": "Apache-2.0",
                    "notes": f"category {e.formal_category or 'unspecified'}; statement source",
                }
            )
        statement = e.statement or f"See erdosproblems.com/{e.number} (statement not recovered)."
        attribution = "P. Erdős" + (f"; prize {e.prize}" if e.prize and e.prize != "no" else "")
        record: dict[str, object] = {
            "slug": f"erdos-{e.number}",
            "title": f"Erdős problem #{e.number}",
            "statement": statement,
            "definitions": e.comments,
            "areas": area_slugs,
            "attribution": attribution,
            "sources": sources,
        }
        if not e.is_open:
            record["status_override"] = "resolved"
        if e.formal_statement:
            record["reference_formalization"] = {
                "url": FORMAL_PAGE.format(n=e.number),
                "docstring": e.formal_docstring,
                "library": "google-deepmind/formal-conjectures",
                "declaration": e.formal_declaration,
                "statement": e.formal_statement,
                "category": e.formal_category,
            }
        problems.append(record)
    return {
        "retrieved_date": retrieved_date,
        "origin": "bulk_import",
        "areas": [{**a, "children": list(a["children"].values())} for a in areas.values()],
        "problems": problems,
    }
