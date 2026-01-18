"""Runtime for online literature search (ACTIVE track)."""

from __future__ import annotations

import hashlib
import json
import warnings
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, TYPE_CHECKING

from .cache import compute_cache_key, load_cache, write_cache
from .network_gates import NetworkBlockedError, ensure_network_allowed
from .provider import (
    OnlineLiteratureError,
    OnlineLiteratureProvider,
    PaperMetadata,
    PubMedProvider,
    ensure_topic_safe,
)
from src.ros_irb.gate import require_irb_submission

# Import providers registry for runtime provider selection
from . import providers as provider_registry

if TYPE_CHECKING:
    from src.runtime_config import RuntimeConfig

# Re-export for convenience.
__all__ = [
    "run_online_literature",
    "OnlineLiteratureRunHandle",
    "NetworkBlockedError",
    "OnlineLiteratureError",
]


@dataclass(frozen=True)
class OnlineLiteratureRunHandle:
    """Handle returned by run_online_literature."""

    run_id: str
    ready: bool
    provider: str
    cached: bool
    output_dir: str


def run_online_literature(
    topic: str,
    *,
    provider: OnlineLiteratureProvider | None = None,
    max_results: int = 20,
    tmp_root: Path = Path(".tmp"),
    skip_network_check_for_testing: bool = False,
    config: "RuntimeConfig | None" = None,
    _skip_network_check: bool | None = None,
) -> OnlineLiteratureRunHandle:
    """Run online literature search and write metadata-only artifacts.

    Args:
        topic: Search topic (will be checked for PHI)
        provider: Literature provider (defaults to provider from config)
        max_results: Maximum number of results
        tmp_root: Root directory for outputs
        skip_network_check_for_testing: TESTING ONLY - bypasses network mode check
        config: Runtime configuration (loaded from env if not provided)
        _skip_network_check: TESTING ONLY - backward compatible alias

    Raises:
        NetworkBlockedError: If NO_NETWORK=1 or runtime mode is not 'online'
        OnlineLiteratureError: If topic is empty or contains PHI
    """
    if _skip_network_check is not None:
        skip_network_check_for_testing = _skip_network_check

    # CRITICAL: Enforce network mode gate at runtime entry point
    # Can be bypassed for testing with mock providers only
    if not skip_network_check_for_testing:
        ensure_network_allowed()

    # IRB gate: Must have IRB submission before online literature search
    require_irb_submission()

    ensure_topic_safe(topic)

    # Resolve provider: explicit > config > fallback
    if provider is None:
        # Load config if not provided
        if config is None:
            from src.runtime_config import RuntimeConfig

            config = RuntimeConfig.from_env_and_optional_yaml()

        provider_name = config.literature_provider

        if provider_registry.has_provider(provider_name):
            provider = provider_registry.get(provider_name)
        else:
            # Fallback to pubmed with warning
            warnings.warn(
                f"Configured provider '{provider_name}' not found. "
                f"Available: {provider_registry.list_providers()}. "
                f"Falling back to 'pubmed'.",
                UserWarning,
            )
            provider = provider_registry.get("pubmed")

    cache_root = tmp_root / "online_literature_cache"
    cache_key = compute_cache_key(provider.name, topic, {"max_results": max_results})
    cache_entry = load_cache(cache_root, cache_key)

    if cache_entry and isinstance(cache_entry.get("results"), list):
        papers = [PaperMetadata.from_dict(p) for p in cache_entry["results"]]
        cached = True
    else:
        papers = provider.search(topic, max_results=max_results)
        cached = False
        write_cache(
            cache_root,
            cache_key,
            {
                "provider": provider.name,
                "query": topic,
                "params": {"max_results": max_results},
                "results": [p.to_dict() for p in papers],
            },
        )

    run_id = _generate_run_id(provider.name, topic)
    output_dir = tmp_root / "online_literature_runs" / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    papers_path = output_dir / "papers.json"
    overview_path = output_dir / "overview.md"
    bib_path = output_dir / "library.bib"

    _atomic_write_json(papers_path, [p.to_dict() for p in papers])
    _atomic_write_text(overview_path, _build_overview(topic, provider.name, papers))
    _atomic_write_text(bib_path, _build_bibtex(papers))

    return OnlineLiteratureRunHandle(
        run_id=run_id,
        ready=True,
        provider=provider.name,
        cached=cached,
        output_dir=str(output_dir),
    )


def _generate_run_id(provider: str, topic: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    token = hashlib.sha256(f"{provider}|{topic}|{stamp}".encode("utf-8")).hexdigest()[
        :8
    ]
    return f"online_lit_{stamp}_{token}"


def _build_overview(topic: str, provider: str, papers: Iterable[PaperMetadata]) -> str:
    paper_list = list(papers)
    count = len(paper_list)

    years = [p.year for p in paper_list if isinstance(p.year, int)]
    if years:
        year_span = f"{min(years)}-{max(years)}"
    else:
        year_span = "unknown"

    venue_counts: dict[str, int] = {}
    for paper in paper_list:
        if paper.venue:
            venue_counts[paper.venue] = venue_counts.get(paper.venue, 0) + 1

    author_counts: dict[str, int] = {}
    for paper in paper_list:
        for author in paper.authors:
            author_counts[author] = author_counts.get(author, 0) + 1

    top_venues = _top_items(venue_counts, limit=5)
    top_authors = _top_items(author_counts, limit=5)

    lines = [
        "# Literature Overview",
        "",
        f"Topic: {topic}",
        f"Provider: {provider}",
        f"Papers returned: {count}",
        f"Publication years: {year_span}",
        "",
        "This overview is generated from metadata only (titles, authors, venues, years).",
        "No full-text content is analyzed.",
        "",
    ]

    if top_venues:
        lines.append("## Top Venues")
        for venue, qty in top_venues:
            lines.append(f"- {venue} ({qty})")
        lines.append("")

    if top_authors:
        lines.append("## Top Authors")
        for author, qty in top_authors:
            lines.append(f"- {author} ({qty})")
        lines.append("")

    lines.append("## Papers")
    for idx, paper in enumerate(paper_list[:20], start=1):
        year = paper.year if paper.year is not None else "n.d."
        venue = f" — {paper.venue}" if paper.venue else ""
        lines.append(f"{idx}. {paper.title} ({year}){venue}")

    if count > 20:
        lines.append("")
        lines.append(
            f"{count - 20} additional papers not listed to keep overview concise."
        )

    lines.append("")
    return "\n".join(lines)


def _build_bibtex(papers: Iterable[PaperMetadata]) -> str:
    entries = []
    for idx, paper in enumerate(papers, start=1):
        entry_type = "article" if paper.venue else "misc"
        cite_key = _build_cite_key(paper, idx)

        lines = [f"@{entry_type}{{{cite_key},"]
        lines.append(f"  title = {{{_escape_bibtex(paper.title)}}},")
        if paper.authors:
            author_field = " and ".join(_escape_bibtex(a) for a in paper.authors)
            lines.append(f"  author = {{{author_field}}},")
        if paper.year:
            lines.append(f"  year = {{{paper.year}}},")
        if paper.venue:
            lines.append(f"  journal = {{{_escape_bibtex(paper.venue)}}},")
        if paper.doi:
            lines.append(f"  doi = {{{_escape_bibtex(paper.doi)}}},")
        if paper.url:
            lines.append(f"  url = {{{_escape_bibtex(paper.url)}}},")
        lines.append("}")
        entries.append("\n".join(lines))

    return "\n\n".join(entries) + ("\n" if entries else "")


def _build_cite_key(paper: PaperMetadata, index: int) -> str:
    author_token = "paper"
    if paper.authors:
        author_token = _slugify(paper.authors[0].split()[-1]) or "paper"
    year_token = str(paper.year) if paper.year else "nd"
    title_token = _slugify(paper.title)[:12] or "title"
    return f"{author_token}{year_token}{title_token}{index}"


def _slugify(text: str) -> str:
    cleaned = []
    for char in text.lower():
        if char.isalnum():
            cleaned.append(char)
    return "".join(cleaned)


def _escape_bibtex(text: str) -> str:
    return text.replace("\n", " ").replace('"', "'")


def _top_items(counter: dict[str, int], limit: int = 5) -> list[tuple[str, int]]:
    return sorted(counter.items(), key=lambda item: (-item[1], item[0]))[:limit]


def _atomic_write_text(path: Path, content: str) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(content, encoding="utf-8")
    tmp_path.replace(path)


def _atomic_write_json(path: Path, payload: list[dict[str, object]]) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    tmp_path.replace(path)
