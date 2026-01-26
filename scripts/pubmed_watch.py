#!/usr/bin/env python3
"""
PubMed Watch Script

Periodically scans PubMed for new papers on surgical documentation standards,
operative note structures, ICD coding consistency, etc.

Based on integrations_4.pdf specification.

Usage:
    python scripts/pubmed_watch.py
    
Environment Variables:
    NCBI_API_KEY: Required for higher rate limits (10 rps vs 3 rps)
    
Cron Schedule (via GitHub Actions):
    Mondays 09:00 UTC - see .github/workflows/pubmed-scan-and-pr.yml
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "worker"))

# Import the existing PubMed provider
try:
    from src.online_literature.provider import PubMedProvider, PaperMetadata
except ImportError:
    print("Warning: Could not import PubMedProvider, using fallback")
    PubMedProvider = None

# Output paths
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "evals" / "pubmed_scans"


# PubMed search query for surgical documentation
QUERY = (
    '(operative note[Title/Abstract] OR surgical note[Title/Abstract] OR '
    '"operative report"[Title/Abstract]) '
    'AND (documentation[Title/Abstract] OR guideline*[Title/Abstract] OR '
    'standard*[Title/Abstract] OR ICD[Title/Abstract] OR coding[Title/Abstract])'
)


def scan_pubmed(
    days_back: int = 30,
    max_results: int = 50
) -> List[Dict[str, Any]]:
    """
    Scan PubMed for recent papers matching our query.
    
    Args:
        days_back: Number of days to look back
        max_results: Maximum number of results
        
    Returns:
        List of paper metadata dictionaries
    """
    api_key = os.environ.get("NCBI_API_KEY")
    if not api_key:
        print("Warning: NCBI_API_KEY not set. Using lower rate limits.")
    
    if PubMedProvider is None:
        print("Error: PubMedProvider not available")
        return []
    
    provider = PubMedProvider(api_key=api_key, timeout=30)
    
    try:
        papers = provider.search(QUERY, max_results=max_results)
        return [p.to_dict() for p in papers]
    except Exception as e:
        print(f"Error scanning PubMed: {e}")
        return []


def load_previous_scan() -> Dict[str, Any]:
    """Load the most recent scan results for comparison."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    scan_files = sorted(OUTPUT_DIR.glob("scan_*.json"), reverse=True)
    if scan_files:
        with open(scan_files[0]) as f:
            return json.load(f)
    return {"papers": []}


def identify_new_papers(
    current: List[Dict[str, Any]],
    previous: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Identify papers that are new since the last scan.
    
    Args:
        current: Current scan results
        previous: Previous scan results
        
    Returns:
        List of new papers
    """
    # Create set of previous paper identifiers (DOI or title)
    prev_ids = set()
    for p in previous:
        if p.get("doi"):
            prev_ids.add(p["doi"])
        else:
            prev_ids.add(p.get("title", "").lower())
    
    # Find new papers
    new_papers = []
    for p in current:
        paper_id = p.get("doi") or p.get("title", "").lower()
        if paper_id and paper_id not in prev_ids:
            new_papers.append(p)
    
    return new_papers


def generate_change_memo(new_papers: List[Dict[str, Any]]) -> str:
    """
    Generate a change memo summarizing new papers.
    
    This memo will be used by propose_prompt_update.py to
    suggest prompt modifications.
    
    Args:
        new_papers: List of new papers
        
    Returns:
        Markdown-formatted change memo
    """
    if not new_papers:
        return "No new papers found since last scan."
    
    lines = [
        f"# PubMed Scan Change Memo",
        f"**Date:** {date.today().isoformat()}",
        f"**New Papers Found:** {len(new_papers)}",
        "",
        "## Summary",
        "",
    ]
    
    for i, paper in enumerate(new_papers[:10], 1):  # Limit to 10
        title = paper.get("title", "Unknown Title")
        year = paper.get("year", "")
        authors = ", ".join(paper.get("authors", [])[:3])
        if len(paper.get("authors", [])) > 3:
            authors += " et al."
        
        lines.append(f"### {i}. {title}")
        lines.append(f"**Authors:** {authors}")
        lines.append(f"**Year:** {year}")
        
        abstract = paper.get("abstract", "")
        if abstract:
            # Truncate abstract
            if len(abstract) > 300:
                abstract = abstract[:297] + "..."
            lines.append(f"**Abstract:** {abstract}")
        
        lines.append("")
    
    lines.extend([
        "## Potential Impact on Extraction",
        "",
        "Review the above papers for:",
        "- New documentation standards",
        "- Updated ICD coding guidelines",
        "- Changes to operative note structure",
        "- Best practices for surgical documentation",
        "",
        "If significant changes are identified, run `propose_prompt_update.py`.",
    ])
    
    return "
".join(lines)


def save_scan_results(
    papers: List[Dict[str, Any]],
    new_papers: List[Dict[str, Any]],
    memo: str
) -> Path:
    """Save scan results to file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    scan_date = date.today().isoformat()
    result = {
        "scan_date": scan_date,
        "query": QUERY,
        "total_papers": len(papers),
        "new_papers": len(new_papers),
        "papers": papers,
        "new_paper_ids": [p.get("doi") or p.get("title") for p in new_papers],
        "memo": memo
    }
    
    output_file = OUTPUT_DIR / f"scan_{scan_date}.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)
    
    return output_file


def main():
    """Main entry point."""
    print("=" * 60)
    print("PubMed Watch - Scanning for new surgical documentation papers")
    print("=" * 60)
    
    # Load previous scan
    previous = load_previous_scan()
    prev_papers = previous.get("papers", [])
    print(f"Previous scan had {len(prev_papers)} papers")
    
    # Run new scan
    print(f"
Running PubMed search...")
    print(f"Query: {QUERY[:80]}...")
    papers = scan_pubmed(days_back=30, max_results=50)
    print(f"Found {len(papers)} papers")
    
    # Identify new papers
    new_papers = identify_new_papers(papers, prev_papers)
    print(f"New papers since last scan: {len(new_papers)}")
    
    # Generate change memo
    memo = generate_change_memo(new_papers)
    
    # Save results
    output_file = save_scan_results(papers, new_papers, memo)
    print(f"
Results saved to: {output_file}")
    
    # Print memo
    print("
" + "=" * 60)
    print("CHANGE MEMO")
    print("=" * 60)
    print(memo)
    
    # Return status for CI
    return 0 if len(new_papers) > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
