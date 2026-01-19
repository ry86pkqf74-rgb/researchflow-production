"""Claim verification using embeddings-based cross-check.

Verifies claims in manuscript sections against evidence from
literature summaries and data artifacts.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from src.security.phi_guard import assert_no_phi, PhiBlocked

logger = logging.getLogger(__name__)


@dataclass
class ClaimFinding:
    """A finding from claim verification."""
    sentence: str
    section_key: str
    severity: str  # low, medium, high
    evidence_refs: List[str]
    note: str
    start_index: Optional[int] = None
    end_index: Optional[int] = None


def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences for claim analysis."""
    # Simple sentence splitting - could be improved with NLP
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip() and len(s.strip()) > 10]


def is_claim_sentence(sentence: str) -> bool:
    """Determine if a sentence contains a verifiable claim."""
    # Sentences that are likely claims (contain data/findings)
    claim_indicators = [
        r'\d+%',  # Percentages
        r'p\s*[<=]\s*0\.\d+',  # P-values
        r'significantly',
        r'associated with',
        r'correlated',
        r'reduced',
        r'increased',
        r'improved',
        r'showed',
        r'demonstrated',
        r'found that',
        r'compared to',
        r'higher than',
        r'lower than',
        r'risk ratio',
        r'odds ratio',
        r'hazard ratio',
        r'confidence interval',
        r'CI',
    ]

    pattern = '|'.join(claim_indicators)
    return bool(re.search(pattern, sentence, re.IGNORECASE))


def retrieve_evidence(claim: str, evidence_index: Optional[Any] = None) -> Dict[str, Any]:
    """Retrieve evidence for a claim using embeddings search.

    In production, this would:
    1. Embed the claim using a model like BioBERT
    2. Search against an evidence index (literature summaries, data artifacts)
    3. Return matching evidence with similarity scores
    """
    # Stub implementation
    # In production, use vector similarity search

    # Check for citation references
    has_citation = bool(re.search(r'\[CITATION_\d+\]|\[\d+\]', claim))

    if has_citation:
        return {
            "found": True,
            "score": 0.85,
            "refs": ["existing_citation"],
            "note": "Claim has citation reference",
        }

    # Check for statistical claims without citations
    has_stats = bool(re.search(r'\d+%|p\s*[<=]\s*0\.\d+|CI|confidence interval', claim, re.IGNORECASE))

    if has_stats:
        return {
            "found": False,
            "score": 0.3,
            "refs": [],
            "note": "Statistical claim may need citation or data reference",
        }

    return {
        "found": False,
        "score": 0.5,
        "refs": [],
        "note": "No strong evidence match found",
    }


def verify_claims_for_manuscript(
    manuscript_id: str,
    sections: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Verify claims across all manuscript sections.

    Args:
        manuscript_id: Manuscript identifier
        sections: Dict of section_key -> content_md (if not provided, fetches from storage)

    Returns:
        Dict with findings and summary statistics
    """
    findings: List[Dict[str, Any]] = []
    total_claims = 0
    verified_claims = 0

    # If sections not provided, would fetch from storage
    if not sections:
        logger.warning(f"No sections provided for manuscript {manuscript_id}")
        return {
            "manuscriptId": manuscript_id,
            "findings": [],
            "totalClaims": 0,
            "verifiedClaims": 0,
            "unsubstantiatedClaims": 0,
        }

    for section_key, content in sections.items():
        if not content:
            continue

        try:
            # PHI scan the content
            assert_no_phi(f"verify:{section_key}", content)
        except PhiBlocked as e:
            findings.append({
                "sentence": "[PHI BLOCKED]",
                "sectionKey": section_key,
                "severity": "high",
                "evidenceRefs": [],
                "note": f"PHI detected in section - cannot verify",
            })
            continue

        sentences = split_into_sentences(content)

        for sentence in sentences:
            if not is_claim_sentence(sentence):
                continue

            total_claims += 1
            evidence = retrieve_evidence(sentence)

            if evidence["found"] and evidence["score"] >= 0.6:
                verified_claims += 1
                # Only report low-confidence verifications
                if evidence["score"] < 0.8:
                    findings.append({
                        "sentence": sentence[:200] + "..." if len(sentence) > 200 else sentence,
                        "sectionKey": section_key,
                        "severity": "low",
                        "evidenceRefs": evidence["refs"],
                        "note": evidence["note"],
                    })
            else:
                # Determine severity based on claim type
                severity = "high" if re.search(r'significantly|p\s*[<=]\s*0', sentence, re.IGNORECASE) else "medium"

                findings.append({
                    "sentence": sentence[:200] + "..." if len(sentence) > 200 else sentence,
                    "sectionKey": section_key,
                    "severity": severity,
                    "evidenceRefs": evidence["refs"],
                    "note": evidence["note"],
                })

    return {
        "manuscriptId": manuscript_id,
        "findings": findings,
        "totalClaims": total_claims,
        "verifiedClaims": verified_claims,
        "unsubstantiatedClaims": total_claims - verified_claims,
    }


def verify_single_claim(
    claim: str,
    section_key: str,
) -> Dict[str, Any]:
    """Verify a single claim.

    Args:
        claim: The claim text to verify
        section_key: The section this claim is from

    Returns:
        Verification result
    """
    try:
        assert_no_phi("claim", claim)
    except PhiBlocked:
        return {
            "verified": False,
            "severity": "high",
            "note": "PHI detected in claim",
        }

    evidence = retrieve_evidence(claim)

    return {
        "verified": evidence["found"] and evidence["score"] >= 0.6,
        "score": evidence["score"],
        "severity": "low" if evidence["score"] >= 0.6 else "medium",
        "evidenceRefs": evidence["refs"],
        "note": evidence["note"],
    }
