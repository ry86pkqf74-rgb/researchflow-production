"""Literature runtime layer (PR9B-1 + PR9B-2)

Governance-first, SANDBOX-only, offline-only ingestion of literature inputs.
Produces metadata-only, runtime-only artifacts under `.tmp/literature_runtime/`.

SAFETY INVARIANTS:
- SANDBOX-only
- Offline-only (NO_NETWORK=1)
- Runtime-only artifacts (writes only under `.tmp/`)
- Metadata-only (no raw text persisted by default)
- Provenance decisions-only (no paths, no filenames, no content)

Last Updated: 2026-01-09
"""

from .normalize import NormalizedDocument, normalize_document
from .parsers import ParserError, ParsedDocument, parse_html, parse_pdf, parse_text
from .runtime import (
    LiteratureRuntimeError,
    LiteratureRunHandle,
    ingest_literature_runtime,
)

__all__ = [
    "LiteratureRuntimeError",
    "LiteratureRunHandle",
    "ingest_literature_runtime",
]

__version__ = "1.0.0"
