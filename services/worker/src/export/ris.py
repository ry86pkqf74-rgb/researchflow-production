"""
RIS Export Service

Converts literature references to RIS format for import into
reference managers (Zotero, EndNote, Mendeley, etc.).

Based on integrations_4.pdf specification.

RIS Format Reference:
- TY: Type of reference (JOUR = Journal Article)
- AU: Author
- PY: Publication year
- TI: Title
- JO: Journal name
- DO: DOI
- AN: Accession number (e.g., PMID)
- AB: Abstract
- ER: End of reference
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


def ris_escape(s: str) -> str:
    """
    Escape string for RIS format.
    
    RIS doesn't allow carriage returns or newlines in fields.
    """
    if not s:
        return ""
    return s.replace("", " ").replace("
", " ").strip()


def to_ris_article(
    *,
    title: str,
    authors: List[str],
    year: str | int | None,
    journal: str | None = None,
    abstract: str | None = None,
    doi: str | None = None,
    pmid: str | None = None,
    url: str | None = None,
    volume: str | None = None,
    issue: str | None = None,
    pages: str | None = None,
    keywords: List[str] | None = None,
) -> str:
    """
    Convert a journal article to RIS format.
    
    Args:
        title: Article title
        authors: List of author names ("Last, First" format preferred)
        year: Publication year
        journal: Journal name
        abstract: Article abstract
        doi: Digital Object Identifier
        pmid: PubMed ID
        url: Article URL
        volume: Journal volume
        issue: Journal issue
        pages: Page range (e.g., "123-145")
        keywords: List of keywords
        
    Returns:
        RIS formatted string
        
    Example:
        >>> ris = to_ris_article(
        ...     title="Example Article",
        ...     authors=["Doe, Jane", "Smith, John"],
        ...     year=2025,
        ...     journal="Journal of Examples",
        ...     pmid="12345678"
        ... )
        >>> print(ris)
        TY  - JOUR
        AU  - Doe, Jane
        AU  - Smith, John
        PY  - 2025
        TI  - Example Article
        JO  - Journal of Examples
        AN  - 12345678
        ER  -
    """
    lines = []
    
    # Type (Journal Article)
    lines.append("TY  - JOUR")
    
    # Authors (one per line)
    for author in authors:
        lines.append(f"AU  - {ris_escape(author)}")
    
    # Year
    if year:
        lines.append(f"PY  - {ris_escape(str(year))}")
    
    # Title
    lines.append(f"TI  - {ris_escape(title)}")
    
    # Journal
    if journal:
        lines.append(f"JO  - {ris_escape(journal)}")
    
    # Volume, Issue, Pages
    if volume:
        lines.append(f"VL  - {ris_escape(volume)}")
    if issue:
        lines.append(f"IS  - {ris_escape(issue)}")
    if pages:
        lines.append(f"SP  - {ris_escape(pages)}")
    
    # DOI
    if doi:
        lines.append(f"DO  - {ris_escape(doi)}")
    
    # PMID (as Accession Number)
    if pmid:
        lines.append(f"AN  - {ris_escape(pmid)}")
    
    # URL
    if url:
        lines.append(f"UR  - {ris_escape(url)}")
    
    # Abstract
    if abstract:
        lines.append(f"AB  - {ris_escape(abstract)}")
    
    # Keywords
    if keywords:
        for kw in keywords:
            lines.append(f"KW  - {ris_escape(kw)}")
    
    # End of reference
    lines.append("ER  -")
    
    # RIS uses CRLF line endings
    return "
".join(lines) + "
"


def to_ris_batch(articles: List[dict]) -> str:
    """
    Convert multiple articles to RIS format.
    
    Args:
        articles: List of article dictionaries with keys:
            title, authors, year, journal, abstract, doi, pmid, url
            
    Returns:
        RIS formatted string with all articles
    """
    ris_entries = []
    
    for article in articles:
        ris = to_ris_article(
            title=article.get("title", ""),
            authors=article.get("authors", []),
            year=article.get("year"),
            journal=article.get("journal") or article.get("venue"),
            abstract=article.get("abstract"),
            doi=article.get("doi"),
            pmid=article.get("pmid"),
            url=article.get("url"),
            volume=article.get("volume"),
            issue=article.get("issue"),
            pages=article.get("pages"),
            keywords=article.get("keywords"),
        )
        ris_entries.append(ris)
    
    return "
".join(ris_entries)


@dataclass
class RISExportResult:
    """Result of RIS export operation."""
    content: str
    article_count: int
    filename: str
    
    @property
    def content_type(self) -> str:
        return "application/x-research-info-systems"
    
    @property
    def content_disposition(self) -> str:
        return f'attachment; filename="{self.filename}"'


def export_to_ris(
    articles: List[dict],
    filename: str = "export.ris"
) -> RISExportResult:
    """
    Export articles to RIS format for download.
    
    Args:
        articles: List of article dictionaries
        filename: Output filename
        
    Returns:
        RISExportResult with content and metadata
    """
    content = to_ris_batch(articles)
    
    return RISExportResult(
        content=content,
        article_count=len(articles),
        filename=filename
    )
