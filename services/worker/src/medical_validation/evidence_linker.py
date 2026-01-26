"""
Evidence Linker

Links surgical claims to supporting PubMed evidence.

Use cases:
- ERAS protocol validation
- Antibiotic prophylaxis guidelines
- VTE prophylaxis recommendations
- Drain management practices
- Hemostasis techniques
- Anastomotic leak prevention

Based on document_pdf.pdf specification (page 11).

Example:
    linker = EvidenceLinker(pubmed_client)
    result = linker.find_for_surgical_claim(
        procedure="laparoscopic cholecystectomy",
        topic="antibiotic prophylaxis",
        optional_keywords=["single dose", "cefazolin"]
    )
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .pubmed_client import PubMedClient

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EvidenceResult:
    """
    Result of an evidence search.

    Attributes:
        query: The PubMed query that was executed
        pmids: List of matching PubMed IDs
        summary: ESummary response with article metadata
        articles: Simplified list of article info
    """
    query: str
    pmids: List[str]
    summary: Dict[str, Any]

    @property
    def count(self) -> int:
        """Number of articles found."""
        return len(self.pmids)

    @property
    def articles(self) -> List[Dict[str, Any]]:
        """
        Extract simplified article list from summary.

        Returns list of dicts with:
        - pmid: PubMed ID
        - title: Article title
        - authors: Author list
        - journal: Journal name
        - year: Publication year
        """
        result = self.summary.get("result", {})
        articles = []

        for pmid in self.pmids:
            article = result.get(pmid, {})
            if not article:
                continue

            # Extract authors
            author_list = article.get("authors", [])
            authors = [a.get("name", "") for a in author_list if a.get("name")]

            # Extract year from pubdate
            pubdate = article.get("pubdate", "")
            year = pubdate[:4] if pubdate else None

            articles.append({
                "pmid": pmid,
                "title": article.get("title", ""),
                "authors": authors,
                "journal": article.get("fulljournalname", article.get("source", "")),
                "year": year,
                "doi": article.get("elocationid", ""),
            })

        return articles


class EvidenceLinker:
    """
    Links surgical claims to PubMed evidence.

    Builds targeted PubMed queries based on procedure and topic,
    then retrieves supporting evidence.
    """

    # Common surgical evidence topics
    TOPIC_TEMPLATES = {
        "antibiotics": '("{procedure}"[Title/Abstract]) AND ("antibiotic prophylaxis"[Title/Abstract] OR "surgical prophylaxis"[Title/Abstract])',
        "eras": '("{procedure}"[Title/Abstract]) AND ("ERAS"[Title/Abstract] OR "enhanced recovery"[Title/Abstract])',
        "vte": '("{procedure}"[Title/Abstract]) AND ("VTE prophylaxis"[Title/Abstract] OR "thromboprophylaxis"[Title/Abstract])',
        "drains": '("{procedure}"[Title/Abstract]) AND ("surgical drain"[Title/Abstract] OR "drain management"[Title/Abstract])',
        "hemostasis": '("{procedure}"[Title/Abstract]) AND ("hemostasis"[Title/Abstract] OR "bleeding control"[Title/Abstract])',
        "outcomes": '("{procedure}"[Title/Abstract]) AND ("surgical outcomes"[Title/Abstract] OR "complications"[Title/Abstract])',
    }

    def __init__(self, pubmed: PubMedClient) -> None:
        """
        Initialize evidence linker.

        Args:
            pubmed: Configured PubMed client
        """
        self.pubmed = pubmed

    def find_for_surgical_claim(
        self,
        *,
        procedure: str,
        topic: str,
        optional_keywords: Optional[List[str]] = None,
        retmax: int = 5,
    ) -> EvidenceResult:
        """
        Find evidence for a surgical claim.

        Builds a targeted PubMed query combining procedure and topic,
        then retrieves matching articles.

        Args:
            procedure: Procedure name (e.g., "laparoscopic cholecystectomy")
            topic: Evidence topic (e.g., "antibiotic prophylaxis", "ERAS")
            optional_keywords: Additional search terms
            retmax: Maximum number of articles to retrieve

        Returns:
            EvidenceResult with query, PMIDs, and article summaries
        """
        # Build query
        keywords = " ".join(optional_keywords or [])

        # Check if topic matches a template
        topic_lower = topic.lower()
        if topic_lower in self.TOPIC_TEMPLATES:
            query = self.TOPIC_TEMPLATES[topic_lower].format(procedure=procedure)
            if keywords:
                query = f"{query} {keywords}"
        else:
            # Generic query format
            query = f'("{procedure}"[Title/Abstract]) AND ("{topic}"[Title/Abstract])'
            if keywords:
                query = f"{query} {keywords}"

        query = query.strip()

        logger.info(f"Evidence search: {query}")

        # Search PubMed
        pmids = self.pubmed.esearch(query, retmax=retmax)

        # Get summaries
        summary = self.pubmed.esummary(pmids) if pmids else {"result": {}}

        return EvidenceResult(
            query=query,
            pmids=pmids,
            summary=summary,
        )

    def find_for_topic(
        self,
        procedure: str,
        topic_key: str,
        retmax: int = 5,
    ) -> EvidenceResult:
        """
        Find evidence using a predefined topic template.

        Available topics:
        - antibiotics: Antibiotic prophylaxis
        - eras: Enhanced recovery protocols
        - vte: VTE prophylaxis
        - drains: Drain management
        - hemostasis: Hemostasis/bleeding control
        - outcomes: Surgical outcomes/complications

        Args:
            procedure: Procedure name
            topic_key: Template key from TOPIC_TEMPLATES
            retmax: Maximum results

        Returns:
            EvidenceResult

        Raises:
            ValueError: If topic_key is not recognized
        """
        if topic_key.lower() not in self.TOPIC_TEMPLATES:
            valid = ", ".join(self.TOPIC_TEMPLATES.keys())
            raise ValueError(f"Unknown topic key: {topic_key}. Valid: {valid}")

        return self.find_for_surgical_claim(
            procedure=procedure,
            topic=topic_key,
            retmax=retmax,
        )

    def validate_claim(
        self,
        claim: str,
        procedure: str,
        topic: str,
        *,
        min_evidence: int = 1,
    ) -> Dict[str, Any]:
        """
        Validate a surgical claim by finding supporting evidence.

        Args:
            claim: The claim to validate (for logging/tracking)
            procedure: Related procedure
            topic: Evidence topic
            min_evidence: Minimum articles needed for validation

        Returns:
            Dict with validation result and evidence
        """
        result = self.find_for_surgical_claim(
            procedure=procedure,
            topic=topic,
        )

        is_supported = result.count >= min_evidence

        return {
            "claim": claim,
            "procedure": procedure,
            "topic": topic,
            "is_supported": is_supported,
            "evidence_count": result.count,
            "query": result.query,
            "articles": result.articles,
        }
