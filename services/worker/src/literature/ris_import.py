"""
RIS/EndNote Import

Parses RIS format bibliography files.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from pathlib import Path

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)


@dataclass
class RISEntry:
    """A parsed RIS entry"""
    entry_type: str
    title: str
    authors: List[str] = field(default_factory=list)
    year: Optional[int] = None
    journal: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    doi: Optional[str] = None
    abstract: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    url: Optional[str] = None
    raw_data: Dict[str, List[str]] = field(default_factory=dict)


# RIS tag mappings
RIS_TAGS = {
    'TY': 'type',
    'TI': 'title',
    'T1': 'title',
    'AU': 'author',
    'A1': 'author',
    'PY': 'year',
    'Y1': 'year',
    'DA': 'date',
    'JO': 'journal',
    'JF': 'journal',
    'T2': 'journal',
    'VL': 'volume',
    'IS': 'issue',
    'SP': 'start_page',
    'EP': 'end_page',
    'DO': 'doi',
    'AB': 'abstract',
    'N2': 'abstract',
    'KW': 'keyword',
    'UR': 'url',
    'L1': 'url',
    'ER': 'end',
}


def _parse_ris_content(content: str) -> List[Dict[str, List[str]]]:
    """Parse RIS content into list of entries"""
    entries = []
    current_entry: Dict[str, List[str]] = {}
    current_tag = None

    for line in content.split('\n'):
        line = line.rstrip()

        if not line:
            continue

        # Check for tag line (e.g., "TY  - JOUR")
        match = re.match(r'^([A-Z][A-Z0-9])\s{2}-\s*(.*)$', line)

        if match:
            tag, value = match.groups()
            current_tag = tag

            if tag == 'ER':
                # End of record
                if current_entry:
                    entries.append(current_entry)
                current_entry = {}
                current_tag = None
            elif tag == 'TY':
                # Start of new record
                current_entry = {'TY': [value]}
            else:
                if tag not in current_entry:
                    current_entry[tag] = []
                current_entry[tag].append(value)
        elif current_tag and line.startswith('      '):
            # Continuation line
            if current_tag in current_entry and current_entry[current_tag]:
                current_entry[current_tag][-1] += ' ' + line.strip()

    # Don't forget last entry if no ER tag
    if current_entry:
        entries.append(current_entry)

    return entries


def _convert_to_ris_entry(raw: Dict[str, List[str]], fail_closed: bool = True) -> Optional[RISEntry]:
    """Convert raw RIS data to RISEntry"""
    try:
        # Get title
        title = ''
        for tag in ['TI', 'T1']:
            if tag in raw:
                title = ' '.join(raw[tag])
                break

        if not title:
            return None

        # PHI guard title
        if fail_closed:
            _, findings = guard_text(title, fail_closed=True)
            if findings:
                logger.warning("PHI detected in RIS title, skipping entry")
                return None

        # Get authors
        authors = []
        for tag in ['AU', 'A1']:
            if tag in raw:
                authors.extend(raw[tag])

        # Get year
        year = None
        for tag in ['PY', 'Y1', 'DA']:
            if tag in raw:
                year_str = raw[tag][0]
                # Extract 4-digit year
                match = re.search(r'(\d{4})', year_str)
                if match:
                    year = int(match.group(1))
                    break

        # Get journal
        journal = None
        for tag in ['JO', 'JF', 'T2']:
            if tag in raw:
                journal = ' '.join(raw[tag])
                break

        # Get abstract
        abstract = None
        for tag in ['AB', 'N2']:
            if tag in raw:
                abstract = ' '.join(raw[tag])
                break

        if abstract and fail_closed:
            _, findings = guard_text(abstract, fail_closed=True)
            if findings:
                abstract = "[REDACTED - PHI detected]"

        # Get DOI
        doi = raw.get('DO', [None])[0] if 'DO' in raw else None

        # Get keywords
        keywords = raw.get('KW', [])

        # Get URL
        url = None
        for tag in ['UR', 'L1']:
            if tag in raw:
                url = raw[tag][0]
                break

        # Get pages
        pages = None
        if 'SP' in raw:
            start = raw['SP'][0]
            end = raw.get('EP', [''])[0]
            pages = f"{start}-{end}" if end else start

        return RISEntry(
            entry_type=raw.get('TY', ['JOUR'])[0],
            title=title,
            authors=authors,
            year=year,
            journal=journal,
            volume=raw.get('VL', [None])[0] if 'VL' in raw else None,
            issue=raw.get('IS', [None])[0] if 'IS' in raw else None,
            pages=pages,
            doi=doi,
            abstract=abstract,
            keywords=keywords,
            url=url,
            raw_data=raw
        )

    except Exception as e:
        logger.warning(f"Failed to convert RIS entry: {e}")
        return None


def import_ris_file(
    file_path: str,
    fail_closed: bool = True
) -> List[RISEntry]:
    """
    Import references from a RIS file.

    Args:
        file_path: Path to RIS file
        fail_closed: If True, skip entries with PHI

    Returns:
        List of parsed RISEntry objects
    """
    try:
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Try different encodings
        content = None
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                with open(path, 'r', encoding=encoding) as f:
                    content = f.read()
                break
            except UnicodeDecodeError:
                continue

        if content is None:
            raise ValueError("Could not decode file with any supported encoding")

        # Parse content
        raw_entries = _parse_ris_content(content)

        # Convert to RISEntry objects
        entries = []
        for raw in raw_entries:
            entry = _convert_to_ris_entry(raw, fail_closed)
            if entry:
                entries.append(entry)

        logger.info(f"Imported {len(entries)} entries from RIS file")
        return entries

    except Exception as e:
        logger.exception(f"RIS import failed: {e}")
        return []


def ris_entries_to_papers(entries: List[RISEntry]) -> List[Dict[str, Any]]:
    """
    Convert RIS entries to standard paper format.

    Args:
        entries: List of RISEntry objects

    Returns:
        List of paper dictionaries compatible with other literature functions
    """
    papers = []

    for entry in entries:
        papers.append({
            'title': entry.title,
            'authors': entry.authors,
            'year': entry.year,
            'journal': entry.journal,
            'doi': entry.doi,
            'abstract': entry.abstract,
            'url': entry.url,
            'source': 'ris_import',
        })

    return papers
