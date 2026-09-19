"""Bulk atlas ingestion from structured public lists of reported-open problems.

Every imported problem keeps per-record provenance: the list page, the section path it was
listed under, the retrieval date, and `asserted_status="open"` recorded as an *unreviewed*
source assertion. Being listed is a dated claim about status, not a verified fact.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from urllib.parse import unquote

import httpx

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
DEFAULT_PAGE = "List_of_unsolved_problems_in_mathematics"
OPEN_SECTION = "Unsolved problems"

# Wikipedia section heading -> (top-level lab area slug, child area name)
SECTION_AREAS: dict[str, tuple[str, str]] = {
    "Algebra": ("algebra", "Algebra (general)"),
    "Analysis": ("analysis", "Analysis (general)"),
    "Combinatorics": ("combinatorics", "Combinatorics (general)"),
    "Dynamical systems": ("analysis", "Dynamical systems"),
    "Games and puzzles": ("combinatorics", "Games and puzzles"),
    "Geometry": ("geometry-topology", "Geometry (general)"),
    "Graph theory": ("combinatorics", "Graph theory"),
    "Model theory and formal languages": ("logic-foundations", "Model theory"),
    "Probability theory": ("probability-statistics", "Probability theory"),
    "Number theory": ("number-theory", "Number theory (general)"),
    "Set theory": ("logic-foundations", "Set theory"),
    "Topology": ("geometry-topology", "Topology"),
}

TOP_AREA_NAMES = {
    "algebra": "Algebra",
    "analysis": "Analysis",
    "combinatorics": "Combinatorics",
    "geometry-topology": "Geometry and topology",
    "logic-foundations": "Logic and foundations",
    "probability-statistics": "Probability and statistics",
    "number-theory": "Number theory",
}

_HEADING = re.compile(r"^(={2,4})\s*(.*?)\s*\1\s*$", re.M)
_REF = re.compile(r"<ref[^>/]*/>|<ref[^>]*>.*?</ref>", re.S)
_TEMPLATE = re.compile(r"\{\{(?:[^{}]|\{\{[^{}]*\}\})*\}\}", re.S)
_LINK = re.compile(r"\[\[([^\]|]*)(?:\|([^\]]*))?\]\]")
_EXT_LINK = re.compile(r"\[https?://\S+\s+([^\]]*)\]")
_MATH = re.compile(r"<math[^>]*>(.*?)</math>", re.S)
_TAG = re.compile(r"<[^>]+>")
_QUOTES = re.compile(r"'{2,3}")
_SLUG_STRIP = re.compile(r"[^a-z0-9]+")


def normalize_url(url: str) -> str:
    """Compare source URLs modulo percent-encoding and Wikipedia's first-letter case."""
    url = unquote(url.strip()).rstrip("/")
    prefix = "https://en.wikipedia.org/wiki/"
    if url.startswith(prefix) and len(url) > len(prefix):
        rest = url[len(prefix) :]
        url = prefix + rest[0].upper() + rest[1:]
    return url


def slugify(text: str) -> str:
    return _SLUG_STRIP.sub("-", text.lower()).strip("-")[:80]


def clean_wikitext(text: str) -> str:
    text = _REF.sub("", text)
    for _ in range(3):
        text = _TEMPLATE.sub("", text)
    text = _MATH.sub(lambda m: m.group(1).strip(), text)
    text = _LINK.sub(lambda m: (m.group(2) or m.group(1)).strip(), text)
    text = _EXT_LINK.sub(lambda m: m.group(1), text)
    text = _TAG.sub("", text)
    text = _QUOTES.sub("", text)
    return re.sub(r"\s+", " ", text).strip(" .;,–-")


@dataclass
class ListedProblem:
    title: str
    statement: str
    article: str  # wikipedia article title of the first wikilink, if any
    section_path: list[str]
    areas: list[str] = field(default_factory=list)

    @property
    def slug(self) -> str:
        return slugify(self.title)

    @property
    def url(self) -> str:
        if self.article:
            return normalize_url("https://en.wikipedia.org/wiki/" + self.article.replace(" ", "_"))
        return ""


def parse_unsolved_list(wikitext: str) -> list[ListedProblem]:
    """Parse the bullet items under `== Unsolved problems ==` of the Wikipedia list page."""
    problems: list[ListedProblem] = []
    in_open = False
    path: list[str] = []
    # refs and citation templates span lines; strip them before line-wise parsing
    wikitext = _REF.sub("", wikitext)
    for _ in range(3):
        wikitext = _TEMPLATE.sub("", wikitext)
    lines = wikitext.splitlines()
    for line in lines:
        head = _HEADING.match(line)
        if head:
            level, title = len(head.group(1)), head.group(2)
            if level == 2:
                in_open = title == OPEN_SECTION
                path = []
                continue
            if not in_open:
                continue
            path = path[: level - 3] + [title]
            continue
        if not in_open or not path or not line.startswith("*"):
            continue
        body = line.lstrip("*").strip()
        first_link = _LINK.search(body)
        article = ""
        if first_link and not first_link.group(1).startswith(("File:", "Image:")):
            article = first_link.group(1).split("#")[0].strip()
        text = clean_wikitext(body)
        if not text or text.endswith(":"):  # group header whose sub-bullets follow
            continue
        title = ""
        if first_link:
            title = clean_wikitext(first_link.group(2) or first_link.group(1))
        if not title or len(title) > 120:
            title = re.split(r"\s+[–-]\s+|:\s+", text, maxsplit=1)[0][:120]
        title = re.sub(r"^(the|The)\s+", "", title).strip()
        if len(title) < 4:
            continue
        title = title[0].upper() + title[1:]
        top = SECTION_AREAS.get(path[0])
        if top is None:
            continue
        top_slug, child_name = top
        child_slug = slugify(path[-1] if len(path) > 1 else child_name)
        problems.append(
            ListedProblem(
                title=title,
                statement=text,
                article=article,
                section_path=list(path),
                areas=[top_slug, child_slug],
            )
        )
    return problems


def fetch_wikitext(page: str, timeout: float = 30.0) -> str:
    params = {
        "action": "parse",
        "page": page,
        "prop": "wikitext",
        "format": "json",
        "formatversion": "2",
    }
    # Wikimedia's robot policy requires an identifying UA with a contact URL.
    headers = {
        "User-Agent": "MathLabAtlasBot/0.1 (https://github.com/sharonbasovich/norththehackers) "
        f"python-httpx/{httpx.__version__}"
    }
    with httpx.Client(timeout=timeout, headers=headers) as client:
        r = client.get(WIKIPEDIA_API, params=params)
        r.raise_for_status()
        return str(r.json()["parse"]["wikitext"])


def to_atlas_document(
    problems: list[ListedProblem], *, page: str, retrieved: date | None = None
) -> dict:
    """Shape a parsed list as the seed/atlas document consumed by `load_atlas_document`."""
    retrieved_date = (retrieved or date.today()).isoformat()
    page_url = "https://en.wikipedia.org/wiki/" + page
    areas: dict[str, dict] = {}
    for top_slug, _ in SECTION_AREAS.values():
        areas.setdefault(
            top_slug,
            {"slug": top_slug, "name": TOP_AREA_NAMES.get(top_slug, top_slug), "children": {}},
        )
    entries = []
    seen: set[str] = set()
    for p in problems:
        top_slug, child_slug = p.areas
        slug = p.slug
        if slug in seen:  # same name in two sections (e.g. two Hadwiger conjectures)
            slug = f"{slug}-{child_slug}"[:80]
            if slug in seen:
                continue
        seen.add(slug)
        child_name = p.section_path[-1] if len(p.section_path) > 1 else None
        if child_name is None:
            child_name = SECTION_AREAS[p.section_path[0]][1]
        areas[top_slug]["children"][child_slug] = {"slug": child_slug, "name": child_name}
        sources = [
            {
                "title": f"Wikipedia: {page.replace('_', ' ')}",
                "url": page_url,
                "location": " > ".join([OPEN_SECTION, *p.section_path]),
                "asserted_status": "open",
                "aggregate": True,
                "notes": "listed under unsolved problems; unreviewed bulk import",
            }
        ]
        if p.url and p.url != page_url:
            sources.append(
                {
                    "title": f"Wikipedia: {p.article}",
                    "url": p.url,
                    "asserted_status": "open",
                    "notes": "linked article from the list page; unreviewed",
                }
            )
        entries.append(
            {
                "slug": slug,
                "title": p.title,
                "statement": p.statement,
                "areas": [top_slug, child_slug],
                "attribution": "",
                "sources": sources,
            }
        )
    return {
        "retrieved_date": retrieved_date,
        "origin": "bulk_import",
        "areas": [
            {**a, "children": list(a["children"].values())} for a in areas.values() if a["children"]
        ],
        "problems": entries,
    }
