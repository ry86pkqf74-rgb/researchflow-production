"""
GROBID PDF Parser

Integrates with GROBID service for machine-learning based PDF parsing.
Extracts structured data from scientific documents.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import xml.etree.ElementTree as ET

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)

# GROBID service configuration
GROBID_URL = os.getenv('GROBID_URL', 'http://localhost:8070')
ENABLE_GROBID = os.getenv('ENABLE_GROBID', '0') == '1'


@dataclass
class GrobidAuthor:
    """Parsed author information"""
    first_name: str
    last_name: str
    email: Optional[str] = None
    affiliation: Optional[str] = None


@dataclass
class GrobidReference:
    """Parsed bibliographic reference"""
    title: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    year: Optional[int] = None
    journal: Optional[str] = None
    volume: Optional[str] = None
    pages: Optional[str] = None
    doi: Optional[str] = None


@dataclass
class GrobidResult:
    """GROBID parsing result"""
    success: bool
    title: Optional[str] = None
    abstract: Optional[str] = None
    authors: List[GrobidAuthor] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    sections: Dict[str, str] = field(default_factory=dict)
    references: List[GrobidReference] = field(default_factory=list)
    raw_tei: Optional[str] = None
    error: Optional[str] = None


def _parse_tei_xml(tei_xml: str) -> Dict[str, Any]:
    """Parse TEI XML output from GROBID"""
    try:
        root = ET.fromstring(tei_xml)

        # Define namespace
        ns = {'tei': 'http://www.tei-c.org/ns/1.0'}

        result = {
            'title': None,
            'abstract': None,
            'authors': [],
            'keywords': [],
            'sections': {},
            'references': []
        }

        # Extract title
        title_elem = root.find('.//tei:titleStmt/tei:title', ns)
        if title_elem is not None and title_elem.text:
            result['title'] = title_elem.text.strip()

        # Extract abstract
        abstract_elem = root.find('.//tei:abstract', ns)
        if abstract_elem is not None:
            abstract_text = ET.tostring(abstract_elem, encoding='unicode', method='text')
            result['abstract'] = abstract_text.strip()

        # Extract authors
        for author_elem in root.findall('.//tei:sourceDesc//tei:author', ns):
            first_name = ''
            last_name = ''

            forename = author_elem.find('.//tei:forename', ns)
            surname = author_elem.find('.//tei:surname', ns)

            if forename is not None and forename.text:
                first_name = forename.text.strip()
            if surname is not None and surname.text:
                last_name = surname.text.strip()

            if first_name or last_name:
                email = None
                email_elem = author_elem.find('.//tei:email', ns)
                if email_elem is not None and email_elem.text:
                    email = email_elem.text.strip()

                affiliation = None
                aff_elem = author_elem.find('.//tei:affiliation', ns)
                if aff_elem is not None:
                    affiliation = ET.tostring(aff_elem, encoding='unicode', method='text').strip()

                result['authors'].append({
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': email,
                    'affiliation': affiliation
                })

        # Extract keywords
        for kw_elem in root.findall('.//tei:keywords//tei:term', ns):
            if kw_elem.text:
                result['keywords'].append(kw_elem.text.strip())

        # Extract body sections
        for div_elem in root.findall('.//tei:body/tei:div', ns):
            head = div_elem.find('tei:head', ns)
            if head is not None and head.text:
                section_name = head.text.strip()
                section_text = ET.tostring(div_elem, encoding='unicode', method='text')
                # Remove the heading from the section text
                section_text = section_text.replace(section_name, '', 1).strip()
                result['sections'][section_name] = section_text

        # Extract references
        for bib_elem in root.findall('.//tei:listBibl/tei:biblStruct', ns):
            ref = {'authors': []}

            # Title
            title_elem = bib_elem.find('.//tei:title[@level="a"]', ns)
            if title_elem is not None and title_elem.text:
                ref['title'] = title_elem.text.strip()

            # Authors
            for author in bib_elem.findall('.//tei:author', ns):
                surname = author.find('tei:surname', ns)
                if surname is not None and surname.text:
                    ref['authors'].append(surname.text.strip())

            # Year
            date_elem = bib_elem.find('.//tei:date', ns)
            if date_elem is not None:
                when = date_elem.get('when', '')
                if when and len(when) >= 4:
                    try:
                        ref['year'] = int(when[:4])
                    except ValueError:
                        pass

            # DOI
            doi_elem = bib_elem.find('.//tei:idno[@type="DOI"]', ns)
            if doi_elem is not None and doi_elem.text:
                ref['doi'] = doi_elem.text.strip()

            result['references'].append(ref)

        return result

    except ET.ParseError as e:
        logger.warning(f"Failed to parse TEI XML: {e}")
        return {}


def parse_pdf_with_grobid(
    pdf_path: str,
    consolidate_citations: bool = True,
    fail_closed: bool = True
) -> GrobidResult:
    """
    Parse a PDF using GROBID service.

    Args:
        pdf_path: Path to PDF file
        consolidate_citations: Whether to consolidate citations
        fail_closed: If True, redact content with PHI

    Returns:
        GrobidResult with parsed content
    """
    if not ENABLE_GROBID:
        return GrobidResult(
            success=False,
            error="GROBID is not enabled. Set ENABLE_GROBID=1 to enable."
        )

    try:
        import requests

        # Call GROBID service
        url = f"{GROBID_URL}/api/processFulltextDocument"

        with open(pdf_path, 'rb') as f:
            files = {'input': f}
            params = {
                'consolidateCitations': '1' if consolidate_citations else '0',
                'consolidateHeader': '1',
                'teiCoordinates': 'false'
            }

            response = requests.post(url, files=files, data=params, timeout=120)

        if response.status_code != 200:
            return GrobidResult(
                success=False,
                error=f"GROBID returned status {response.status_code}"
            )

        tei_xml = response.text

        # Parse TEI XML
        parsed = _parse_tei_xml(tei_xml)

        if not parsed:
            return GrobidResult(
                success=False,
                error="Failed to parse GROBID TEI output",
                raw_tei=tei_xml
            )

        # PHI guard on title and abstract
        title = parsed.get('title')
        abstract = parsed.get('abstract')

        if fail_closed and title:
            _, findings = guard_text(title, fail_closed=True)
            if findings:
                title = "[REDACTED - PHI detected]"

        if fail_closed and abstract:
            _, findings = guard_text(abstract, fail_closed=True)
            if findings:
                abstract = "[REDACTED - PHI detected]"

        # Build authors list
        authors = [
            GrobidAuthor(
                first_name=a.get('first_name', ''),
                last_name=a.get('last_name', ''),
                email=a.get('email'),
                affiliation=a.get('affiliation')
            )
            for a in parsed.get('authors', [])
        ]

        # Build references list
        references = [
            GrobidReference(
                title=r.get('title'),
                authors=r.get('authors', []),
                year=r.get('year'),
                journal=r.get('journal'),
                doi=r.get('doi')
            )
            for r in parsed.get('references', [])
        ]

        return GrobidResult(
            success=True,
            title=title,
            abstract=abstract,
            authors=authors,
            keywords=parsed.get('keywords', []),
            sections=parsed.get('sections', {}),
            references=references,
            raw_tei=tei_xml
        )

    except ImportError:
        return GrobidResult(
            success=False,
            error="requests library not installed"
        )
    except Exception as e:
        logger.exception(f"GROBID parsing failed: {e}")
        return GrobidResult(
            success=False,
            error=str(e)
        )


def extract_citations_from_pdf(pdf_path: str) -> List[GrobidReference]:
    """
    Extract only citations from a PDF using GROBID.

    Args:
        pdf_path: Path to PDF file

    Returns:
        List of GrobidReference objects
    """
    if not ENABLE_GROBID:
        logger.warning("GROBID not enabled, returning empty citations")
        return []

    try:
        import requests

        url = f"{GROBID_URL}/api/processReferences"

        with open(pdf_path, 'rb') as f:
            files = {'input': f}
            params = {'consolidateCitations': '1'}

            response = requests.post(url, files=files, data=params, timeout=60)

        if response.status_code != 200:
            logger.warning(f"GROBID citations extraction failed: {response.status_code}")
            return []

        # Parse response
        parsed = _parse_tei_xml(f"<root>{response.text}</root>")
        references = []

        for r in parsed.get('references', []):
            references.append(GrobidReference(
                title=r.get('title'),
                authors=r.get('authors', []),
                year=r.get('year'),
                doi=r.get('doi')
            ))

        return references

    except Exception as e:
        logger.warning(f"Citation extraction failed: {e}")
        return []
