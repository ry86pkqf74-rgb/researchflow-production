"""
Medical Validation Module

Evidence-based validation via PubMed (NCBI E-utilities).

Provides:
- PubMed search via ESearch/ESummary APIs
- Evidence linker for surgical claim validation
- Redis caching for repeated queries

Based on document_pdf.pdf specification (pages 9-11).

Usage:
    from medical_validation.pubmed_client import PubMedClient
    from medical_validation.evidence_linker import EvidenceLinker

    client = PubMedClient.from_env()
    pmids = client.esearch("laparoscopic cholecystectomy ERAS")
    summaries = client.esummary(pmids)

    linker = EvidenceLinker(client)
    result = linker.find_for_surgical_claim(
        procedure="laparoscopic cholecystectomy",
        topic="antibiotic prophylaxis"
    )
"""

from .pubmed_client import PubMedClient
from .evidence_linker import EvidenceLinker, EvidenceResult

__all__ = ["PubMedClient", "EvidenceLinker", "EvidenceResult"]
