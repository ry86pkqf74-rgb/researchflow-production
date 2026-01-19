"""
Citation Formatting Service

Formats citations in multiple styles:
- APA 7th Edition
- MLA 9th Edition
- Chicago 17th Edition
- Harvard
- Vancouver
- IEEE
- AMA

Supports:
- Journal articles
- Books
- Book chapters
- Conference papers
- Websites
- Preprints
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
import re


@dataclass
class Author:
    """Represents an author"""
    family: str  # Last name
    given: str   # First name(s)
    suffix: Optional[str] = None  # Jr., III, etc.
    orcid: Optional[str] = None


@dataclass
class Citation:
    """Universal citation data structure"""
    type: str  # article, book, chapter, conference, website, preprint
    title: str
    authors: List[Author]
    year: Optional[int] = None

    # Journal article fields
    journal: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None

    # Book fields
    publisher: Optional[str] = None
    publisher_location: Optional[str] = None
    edition: Optional[str] = None
    isbn: Optional[str] = None

    # Book chapter fields
    book_title: Optional[str] = None
    editors: List[Author] = field(default_factory=list)

    # Conference fields
    conference_name: Optional[str] = None
    conference_location: Optional[str] = None

    # Website fields
    url: Optional[str] = None
    accessed_date: Optional[str] = None

    # Additional
    abstract: Optional[str] = None
    keywords: List[str] = field(default_factory=list)


class CitationFormatter:
    """Multi-style citation formatter"""

    STYLES = ['apa', 'mla', 'chicago', 'harvard', 'vancouver', 'ieee', 'ama']

    def format(self, citation: Citation, style: str = 'apa') -> str:
        """Format citation in specified style"""
        style = style.lower()
        if style not in self.STYLES:
            raise ValueError(f"Unknown style: {style}. Supported: {self.STYLES}")

        formatter = getattr(self, f'_format_{style}')
        return formatter(citation)

    def format_all(self, citation: Citation) -> Dict[str, str]:
        """Format citation in all supported styles"""
        return {style: self.format(citation, style) for style in self.STYLES}

    # ==================== APA 7th Edition ====================

    def _format_apa(self, c: Citation) -> str:
        """APA 7th Edition format"""
        parts = []

        # Authors
        authors = self._format_authors_apa(c.authors)
        parts.append(authors)

        # Year
        if c.year:
            parts.append(f"({c.year}).")
        else:
            parts.append("(n.d.).")

        # Title
        if c.type == 'article':
            parts.append(f"{c.title}.")
        else:
            parts.append(f"*{c.title}*.")

        # Source
        if c.type == 'article' and c.journal:
            source = f"*{c.journal}*"
            if c.volume:
                source += f", *{c.volume}*"
            if c.issue:
                source += f"({c.issue})"
            if c.pages:
                source += f", {c.pages}"
            source += "."
            parts.append(source)
        elif c.type == 'book' and c.publisher:
            if c.edition:
                parts.append(f"({c.edition} ed.).")
            parts.append(f"{c.publisher}.")
        elif c.type == 'chapter':
            editors = self._format_editors_apa(c.editors)
            parts.append(f"In {editors} (Eds.),")
            parts.append(f"*{c.book_title}*")
            if c.pages:
                parts.append(f"(pp. {c.pages}).")
            if c.publisher:
                parts.append(f"{c.publisher}.")

        # DOI or URL
        if c.doi:
            parts.append(f"https://doi.org/{c.doi}")
        elif c.url:
            parts.append(c.url)

        return " ".join(parts)

    def _format_authors_apa(self, authors: List[Author]) -> str:
        """Format authors for APA style"""
        if not authors:
            return ""

        formatted = []
        for i, a in enumerate(authors[:20]):  # APA shows up to 20 authors
            if i == len(authors) - 1 and len(authors) > 1:
                formatted.append(f"& {a.family}, {self._get_initials(a.given)}")
            else:
                formatted.append(f"{a.family}, {self._get_initials(a.given)}")

        if len(authors) > 20:
            formatted = formatted[:19]
            formatted.append(f"... {authors[-1].family}, {self._get_initials(authors[-1].given)}")

        return ", ".join(formatted[:-1]) + " " + formatted[-1] if len(formatted) > 1 else formatted[0]

    def _format_editors_apa(self, editors: List[Author]) -> str:
        """Format editors for APA style"""
        if not editors:
            return ""
        formatted = [f"{self._get_initials(e.given)} {e.family}" for e in editors]
        if len(formatted) > 1:
            return ", ".join(formatted[:-1]) + ", & " + formatted[-1]
        return formatted[0]

    # ==================== MLA 9th Edition ====================

    def _format_mla(self, c: Citation) -> str:
        """MLA 9th Edition format"""
        parts = []

        # Authors (Last, First format for first author)
        if c.authors:
            if len(c.authors) == 1:
                a = c.authors[0]
                parts.append(f"{a.family}, {a.given}.")
            elif len(c.authors) == 2:
                parts.append(f"{c.authors[0].family}, {c.authors[0].given}, and {c.authors[1].given} {c.authors[1].family}.")
            else:
                parts.append(f"{c.authors[0].family}, {c.authors[0].given}, et al.")

        # Title
        if c.type == 'article':
            parts.append(f'"{c.title}."')
        else:
            parts.append(f"*{c.title}*.")

        # Container (journal, book, etc.)
        if c.type == 'article' and c.journal:
            container = f"*{c.journal}*"
            if c.volume:
                container += f", vol. {c.volume}"
            if c.issue:
                container += f", no. {c.issue}"
            if c.year:
                container += f", {c.year}"
            if c.pages:
                container += f", pp. {c.pages}"
            container += "."
            parts.append(container)
        elif c.publisher:
            parts.append(f"{c.publisher}, {c.year}.")

        # DOI
        if c.doi:
            parts.append(f"https://doi.org/{c.doi}.")

        return " ".join(parts)

    # ==================== Chicago 17th Edition ====================

    def _format_chicago(self, c: Citation) -> str:
        """Chicago 17th Edition (Author-Date) format"""
        parts = []

        # Authors
        if c.authors:
            authors = []
            for i, a in enumerate(c.authors):
                if i == 0:
                    authors.append(f"{a.family}, {a.given}")
                else:
                    authors.append(f"{a.given} {a.family}")

            if len(authors) > 3:
                parts.append(f"{authors[0]}, et al.")
            elif len(authors) > 1:
                parts.append(", ".join(authors[:-1]) + ", and " + authors[-1] + ".")
            else:
                parts.append(authors[0] + ".")

        # Year
        if c.year:
            parts.append(f"{c.year}.")

        # Title
        if c.type == 'article':
            parts.append(f'"{c.title}."')
        else:
            parts.append(f"*{c.title}*.")

        # Source
        if c.type == 'article' and c.journal:
            source = f"*{c.journal}*"
            if c.volume:
                source += f" {c.volume}"
            if c.issue:
                source += f", no. {c.issue}"
            if c.pages:
                source += f": {c.pages}"
            source += "."
            parts.append(source)
        elif c.publisher:
            location = f"{c.publisher_location}: " if c.publisher_location else ""
            parts.append(f"{location}{c.publisher}.")

        if c.doi:
            parts.append(f"https://doi.org/{c.doi}.")

        return " ".join(parts)

    # ==================== Harvard ====================

    def _format_harvard(self, c: Citation) -> str:
        """Harvard format"""
        parts = []

        # Authors
        if c.authors:
            authors = [f"{a.family}, {self._get_initials(a.given)}" for a in c.authors[:3]]
            if len(c.authors) > 3:
                authors = authors[:1] + ["et al."]
            parts.append(" and ".join(authors) if len(authors) <= 2 else ", ".join(authors))

        # Year
        if c.year:
            parts.append(f"({c.year})")

        # Title
        if c.type == 'article':
            parts.append(f"'{c.title}',")
        else:
            parts.append(f"*{c.title}*,")

        # Source
        if c.type == 'article' and c.journal:
            source = f"*{c.journal}*"
            if c.volume:
                source += f", {c.volume}"
            if c.issue:
                source += f"({c.issue})"
            if c.pages:
                source += f", pp. {c.pages}"
            parts.append(source + ".")
        elif c.publisher:
            parts.append(f"{c.publisher}.")

        if c.doi:
            parts.append(f"doi: {c.doi}")

        return " ".join(parts)

    # ==================== Vancouver ====================

    def _format_vancouver(self, c: Citation) -> str:
        """Vancouver (ICMJE) format"""
        parts = []

        # Authors (up to 6, then et al.)
        if c.authors:
            authors = []
            for a in c.authors[:6]:
                authors.append(f"{a.family} {self._get_initials(a.given, sep='')}")
            if len(c.authors) > 6:
                authors.append("et al")
            parts.append(", ".join(authors) + ".")

        # Title
        parts.append(f"{c.title}.")

        # Source
        if c.type == 'article' and c.journal:
            source = c.journal
            if c.year:
                source += f". {c.year}"
            if c.volume:
                source += f";{c.volume}"
            if c.issue:
                source += f"({c.issue})"
            if c.pages:
                source += f":{c.pages}"
            source += "."
            parts.append(source)
        elif c.publisher:
            parts.append(f"{c.publisher_location or ''}: {c.publisher}; {c.year or ''}.")

        if c.doi:
            parts.append(f"doi: {c.doi}")

        return " ".join(parts)

    # ==================== IEEE ====================

    def _format_ieee(self, c: Citation) -> str:
        """IEEE format"""
        parts = []

        # Authors
        if c.authors:
            authors = []
            for a in c.authors[:6]:
                authors.append(f"{self._get_initials(a.given)} {a.family}")
            if len(c.authors) > 6:
                authors.append("et al.")
            parts.append(", ".join(authors) + ",")

        # Title
        if c.type == 'article':
            parts.append(f'"{c.title},"')
        else:
            parts.append(f"*{c.title}*,")

        # Source
        if c.type == 'article' and c.journal:
            source = f"*{c.journal}*"
            if c.volume:
                source += f", vol. {c.volume}"
            if c.issue:
                source += f", no. {c.issue}"
            if c.pages:
                source += f", pp. {c.pages}"
            if c.year:
                source += f", {c.year}"
            parts.append(source + ".")
        elif c.publisher:
            parts.append(f"{c.publisher}, {c.year}.")

        if c.doi:
            parts.append(f"doi: {c.doi}.")

        return " ".join(parts)

    # ==================== AMA ====================

    def _format_ama(self, c: Citation) -> str:
        """AMA (American Medical Association) format"""
        parts = []

        # Authors (up to 6)
        if c.authors:
            authors = []
            for a in c.authors[:6]:
                authors.append(f"{a.family} {self._get_initials(a.given, sep='')}")
            if len(c.authors) > 6:
                authors.append("et al")
            parts.append(", ".join(authors) + ".")

        # Title
        parts.append(f"{c.title}.")

        # Source
        if c.type == 'article' and c.journal:
            source = f"*{c.journal}*"
            if c.year:
                source += f". {c.year}"
            if c.volume:
                source += f";{c.volume}"
            if c.issue:
                source += f"({c.issue})"
            if c.pages:
                source += f":{c.pages}"
            source += "."
            parts.append(source)
        elif c.publisher:
            parts.append(f"{c.publisher}; {c.year}.")

        if c.doi:
            parts.append(f"doi:{c.doi}")

        return " ".join(parts)

    # ==================== Utilities ====================

    def _get_initials(self, given: str, sep: str = '. ') -> str:
        """Get initials from given name"""
        if not given:
            return ""
        parts = given.split()
        initials = [p[0].upper() + '.' for p in parts if p]
        return sep.join(initials) if sep == '. ' else ''.join(initials)

    def parse_bibtex(self, bibtex: str) -> Citation:
        """Parse BibTeX entry to Citation"""
        # Extract type
        type_match = re.search(r'@(\w+)\s*\{', bibtex)
        entry_type = type_match.group(1).lower() if type_match else 'article'

        # Map BibTeX types to our types
        type_map = {
            'article': 'article',
            'book': 'book',
            'inbook': 'chapter',
            'incollection': 'chapter',
            'inproceedings': 'conference',
            'conference': 'conference',
            'misc': 'website',
            'online': 'website'
        }
        citation_type = type_map.get(entry_type, 'article')

        # Extract fields
        def get_field(name: str) -> Optional[str]:
            pattern = rf'{name}\s*=\s*[\{{"](.*?)[\}}"]'
            match = re.search(pattern, bibtex, re.IGNORECASE | re.DOTALL)
            return match.group(1).strip() if match else None

        # Parse authors
        authors = []
        author_str = get_field('author')
        if author_str:
            for author in author_str.split(' and '):
                author = author.strip()
                if ',' in author:
                    family, given = author.split(',', 1)
                else:
                    parts = author.split()
                    family = parts[-1] if parts else ''
                    given = ' '.join(parts[:-1]) if len(parts) > 1 else ''
                authors.append(Author(family=family.strip(), given=given.strip()))

        # Parse year
        year_str = get_field('year')
        year = int(year_str) if year_str and year_str.isdigit() else None

        return Citation(
            type=citation_type,
            title=get_field('title') or '',
            authors=authors,
            year=year,
            journal=get_field('journal'),
            volume=get_field('volume'),
            issue=get_field('number'),
            pages=get_field('pages'),
            doi=get_field('doi'),
            publisher=get_field('publisher'),
            url=get_field('url')
        )

    def to_bibtex(self, citation: Citation, key: Optional[str] = None) -> str:
        """Convert Citation to BibTeX format"""
        if not key:
            first_author = citation.authors[0].family if citation.authors else 'unknown'
            key = f"{first_author.lower()}{citation.year or ''}"

        type_map = {
            'article': 'article',
            'book': 'book',
            'chapter': 'incollection',
            'conference': 'inproceedings',
            'website': 'misc'
        }
        entry_type = type_map.get(citation.type, 'misc')

        lines = [f"@{entry_type}{{{key},"]

        # Authors
        if citation.authors:
            author_str = ' and '.join(
                f"{a.family}, {a.given}" for a in citation.authors
            )
            lines.append(f"  author = {{{author_str}}},")

        lines.append(f"  title = {{{citation.title}}},")

        if citation.year:
            lines.append(f"  year = {{{citation.year}}},")
        if citation.journal:
            lines.append(f"  journal = {{{citation.journal}}},")
        if citation.volume:
            lines.append(f"  volume = {{{citation.volume}}},")
        if citation.issue:
            lines.append(f"  number = {{{citation.issue}}},")
        if citation.pages:
            lines.append(f"  pages = {{{citation.pages}}},")
        if citation.doi:
            lines.append(f"  doi = {{{citation.doi}}},")
        if citation.publisher:
            lines.append(f"  publisher = {{{citation.publisher}}},")
        if citation.url:
            lines.append(f"  url = {{{citation.url}}},")

        lines.append("}")
        return "\n".join(lines)


# Global formatter instance
formatter = CitationFormatter()


def format_citation(citation: Citation, style: str = 'apa') -> str:
    """Format a citation in the specified style"""
    return formatter.format(citation, style)


def format_citations(citations: List[Citation], style: str = 'apa') -> List[str]:
    """Format multiple citations"""
    return [formatter.format(c, style) for c in citations]


# Example usage
if __name__ == "__main__":
    # Create a sample citation
    citation = Citation(
        type='article',
        title='Advances in Thyroid Cancer Treatment',
        authors=[
            Author(family='Smith', given='John A'),
            Author(family='Johnson', given='Mary B'),
            Author(family='Williams', given='Robert C')
        ],
        year=2024,
        journal='Journal of Clinical Oncology',
        volume='42',
        issue='3',
        pages='245-258',
        doi='10.1200/JCO.2024.123456'
    )

    print("Citation in all styles:\n")
    for style in CitationFormatter.STYLES:
        print(f"{style.upper()}:")
        print(formatter.format(citation, style))
        print()
