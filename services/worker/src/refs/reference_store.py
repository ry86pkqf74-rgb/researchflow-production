from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping, Sequence


def _slug(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "ref"


@dataclass(frozen=True)
class Reference:
    key: str
    title: str
    authors: tuple[str, ...]
    year: int | None = None
    doi: str | None = None
    url: str | None = None
    abstract: str | None = None
    source: str | None = None


def normalize_reference(d: Mapping[str, Any]) -> Reference:
    title = str(d.get("title") or d.get("paper_title") or "").strip()
    if not title:
        title = "Untitled"
    authors_raw = d.get("authors") or d.get("author_list") or []
    if isinstance(authors_raw, str):
        authors = tuple(a.strip() for a in authors_raw.split(",") if a.strip())
    elif isinstance(authors_raw, list):
        authors = tuple(str(a).strip() for a in authors_raw if str(a).strip())
    else:
        authors = ()
    year = d.get("year") or d.get("pub_year")
    year_i = (
        int(year)
        if isinstance(year, int)
        else (int(year) if str(year).isdigit() else None)
    )
    doi = str(d.get("doi")).strip() if d.get("doi") else None
    url = str(d.get("url")).strip() if d.get("url") else None
    abstract = str(d.get("abstract")).strip() if d.get("abstract") else None
    source = str(d.get("source")).strip() if d.get("source") else None

    # Deterministic key: first author + year + slug(title)
    first_author = authors[0].split()[-1] if authors else "anon"
    y = str(year_i) if year_i else "nd"
    key = f"{_slug(first_author)}{y}{_slug(title)[:40]}"
    return Reference(
        key=key,
        title=title,
        authors=authors,
        year=year_i,
        doi=doi,
        url=url,
        abstract=abstract,
        source=source,
    )


def to_bibtex(refs: Sequence[Reference]) -> str:
    """
    Minimal BibTeX writer (metadata-only).
    Deterministic ordering by key for reproducibility.
    """
    out: list[str] = []
    for r in sorted(refs, key=lambda x: x.key):
        out.append(f"@article{{{r.key},")
        out.append(f"  title = {{{r.title}}},")
        if r.authors:
            out.append(f"  author = {{{' and '.join(r.authors)}}},")
        if r.year:
            out.append(f"  year = {{{r.year}}},")
        if r.doi:
            out.append(f"  doi = {{{r.doi}}},")
        if r.url:
            out.append(f"  url = {{{r.url}}},")
        out.append("}")
        out.append("")
    return "\n".join(out).rstrip() + "\n"
