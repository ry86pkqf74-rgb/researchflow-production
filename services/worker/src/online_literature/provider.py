"""Online literature provider implementations."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any, Protocol

from web_frontend.phi_scan import scan_text_high_confidence

from .network_gates import (
    NetworkBlockedError,
    OnlineLiteratureError,
    ensure_network_allowed,
)


class PhiViolationError(OnlineLiteratureError):
    """Raised when PHI-like patterns are detected in a topic."""


@dataclass(frozen=True)
class PaperMetadata:
    """Metadata-only paper record."""

    title: str
    authors: list[str]
    year: int | None
    venue: str | None
    doi: str | None
    url: str | None
    abstract: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "authors": list(self.authors),
            "year": self.year,
            "venue": self.venue,
            "doi": self.doi,
            "url": self.url,
            "abstract": self.abstract,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PaperMetadata":
        year_value = data.get("year")
        if isinstance(year_value, str):
            try:
                year_value = int(year_value)
            except ValueError:
                year_value = None
        return cls(
            title=data.get("title") or "",
            authors=list(data.get("authors") or []),
            year=year_value,
            venue=data.get("venue"),
            doi=data.get("doi"),
            url=data.get("url"),
            abstract=data.get("abstract"),
        )


class OnlineLiteratureProvider(Protocol):
    """Interface for online literature providers."""

    name: str

    def search(self, topic: str, max_results: int = 20) -> list[PaperMetadata]:
        """Search for papers and return metadata-only results."""


class PubMedProvider:
    """PubMed E-utilities provider (metadata-only)."""

    name = "pubmed"

    def __init__(self, *, api_key: str | None = None, timeout: int = 10) -> None:
        self._api_key = api_key or os.getenv("NCBI_API_KEY")
        self._timeout = timeout

    def search(self, topic: str, max_results: int = 20) -> list[PaperMetadata]:
        # Defense-in-depth: provider gate stays even with runtime gate since providers
        # may be called directly outside the runtime entry point.
        ensure_network_allowed()
        ensure_topic_safe(topic)

        if max_results < 1:
            return []

        try:
            import urllib.parse
            import urllib.request
            import xml.etree.ElementTree as ET

            search_params = {
                "db": "pubmed",
                "term": topic,
                "retmax": str(max_results),
                "retmode": "xml",
                "sort": "relevance",
                "tool": "ros_online_literature",
            }
            if self._api_key:
                search_params["api_key"] = self._api_key

            search_url = (
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?"
                + urllib.parse.urlencode(search_params)
            )

            request = urllib.request.Request(
                search_url,
                headers={"User-Agent": "ROS-OnlineLiterature/1.0"},
            )

            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                search_xml = response.read()

            root = ET.fromstring(search_xml)
            id_list = [
                elem.text
                for elem in root.findall(".//IdList/Id")
                if elem is not None and elem.text
            ]

            if not id_list:
                return []

            fetch_params = {
                "db": "pubmed",
                "id": ",".join(id_list),
                "retmode": "xml",
                "tool": "ros_online_literature",
            }
            if self._api_key:
                fetch_params["api_key"] = self._api_key

            fetch_url = (
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?"
                + urllib.parse.urlencode(fetch_params)
            )

            fetch_request = urllib.request.Request(
                fetch_url,
                headers={"User-Agent": "ROS-OnlineLiterature/1.0"},
            )

            with urllib.request.urlopen(
                fetch_request, timeout=self._timeout
            ) as response:
                fetch_xml = response.read()

            fetch_root = ET.fromstring(fetch_xml)

            results: list[PaperMetadata] = []
            for article in fetch_root.findall(".//PubmedArticle"):
                results.append(_parse_pubmed_article(article))

            return results
        except PhiViolationError:
            raise
        except Exception as exc:
            raise OnlineLiteratureError("PubMed query failed") from exc


def ensure_topic_safe(topic: str) -> None:
    if not topic or not topic.strip():
        raise OnlineLiteratureError("Topic cannot be empty")

    findings = scan_text_high_confidence(topic)
    if findings:
        patterns = ", ".join(findings)
        raise PhiViolationError(f"PHI-like patterns detected in topic: {patterns}")


def _parse_pubmed_article(article: Any) -> PaperMetadata:
    title = _text_or_empty(article.find(".//ArticleTitle"))
    venue = _text_or_none(article.find(".//Journal/Title"))

    year = _extract_year(article)
    authors = _extract_authors(article)
    doi = _extract_doi(article)

    abstract = _extract_abstract(article)

    if doi:
        url = f"https://doi.org/{doi}"
    else:
        pmid = _text_or_none(article.find(".//PMID"))
        url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else None

    return PaperMetadata(
        title=title,
        authors=authors,
        year=year,
        venue=venue,
        doi=doi,
        url=url,
        abstract=abstract,
    )


def _text_or_empty(element: Any) -> str:
    if element is None or element.text is None:
        return ""
    return element.text.strip()


def _text_or_none(element: Any) -> str | None:
    if element is None or element.text is None:
        return None
    text = element.text.strip()
    return text or None


def _extract_year(article: Any) -> int | None:
    year_text = _text_or_none(article.find(".//JournalIssue/PubDate/Year"))
    if not year_text:
        year_text = _text_or_none(article.find(".//ArticleDate/Year"))
    if not year_text:
        medline_date = _text_or_none(
            article.find(".//JournalIssue/PubDate/MedlineDate")
        )
        if medline_date:
            match = re.search(r"(19|20)\d{2}", medline_date)
            if match:
                year_text = match.group(0)
    if not year_text:
        return None
    try:
        return int(year_text)
    except ValueError:
        return None


def _extract_authors(article: Any) -> list[str]:
    authors: list[str] = []
    for author in article.findall(".//AuthorList/Author"):
        collective = _text_or_none(author.find("CollectiveName"))
        if collective:
            authors.append(collective)
            continue

        last_name = _text_or_none(author.find("LastName"))
        fore_name = _text_or_none(author.find("ForeName"))

        if last_name and fore_name:
            authors.append(f"{fore_name} {last_name}")
        elif last_name:
            authors.append(last_name)
        elif fore_name:
            authors.append(fore_name)

    return authors


def _extract_doi(article: Any) -> str | None:
    for article_id in article.findall(".//ArticleIdList/ArticleId"):
        id_type = article_id.attrib.get("IdType")
        if id_type == "doi" and article_id.text:
            return article_id.text.strip()
    return None


def _extract_abstract(article: Any) -> str | None:
    abstract_parts: list[str] = []
    for abstract in article.findall(".//Abstract/AbstractText"):
        if abstract.text:
            abstract_parts.append(abstract.text.strip())
    if not abstract_parts:
        return None
    return " ".join(part for part in abstract_parts if part)
