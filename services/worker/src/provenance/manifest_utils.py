"""Utilities for loading and summarizing provenance run manifests.

The provenance system writes append-only JSON Lines (JSONL) files to
``.tmp/provenance/run_provenance.jsonl`` during pipeline execution. Each line
represents a `ProvenanceEvent` object (see ``src/provenance/logging.py``) in
JSON format. These utilities simplify reading the manifest and converting
entries into dictionaries for display or analysis.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Iterator, Dict, Any


def load_manifest(file_path: str | Path) -> Iterator[Dict[str, Any]]:
    """Yield each event from a provenance run manifest.

    Args:
        file_path: Path to the JSONL manifest file.

    Yields:
        Dictionaries representing each provenance event.

    Notes:
        This function does not attempt to parse the schema; it simply loads
        each JSON object. If the file does not exist, it yields nothing.
    """
    path = Path(file_path)
    if not path.exists():
        return iter([])  # empty iterator
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                # Skip malformed lines
                continue
