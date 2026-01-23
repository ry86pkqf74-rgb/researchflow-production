#!/usr/bin/env python3
"""
Prompt Update Proposal Script

Generates candidate prompt updates based on:
1. PubMed change memos from pubmed_watch.py
2. User feedback from the feedback database
3. Quality check failures

Based on integrations_4.pdf specification.

Usage:
    python scripts/propose_prompt_update.py
    python scripts/propose_prompt_update.py --from-feedback  # Use feedback only
    python scripts/propose_prompt_update.py --from-pubmed    # Use PubMed only
    
Environment Variables:
    OPENAI_API_KEY or ANTHROPIC_API_KEY: Required for LLM-assisted authoring
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

# Paths
ROOT = Path(__file__).resolve().parents[1]
PROMPTS_DIR = ROOT / "prompts" / "refiner"
CANDIDATES_DIR = PROMPTS_DIR / "candidates"
PUBMED_SCANS_DIR = ROOT / "evals" / "pubmed_scans"


def load_active_prompt() -> tuple[str, str]:
    """Load the currently active prompt and its version."""
    import yaml
    
    active_yaml = PROMPTS_DIR / "active.yaml"
    with open(active_yaml) as f:
        config = yaml.safe_load(f)
    
    version = config["active_version"]
    prompt_file = PROMPTS_DIR / f"{version}.md"
    
    return version, prompt_file.read_text()


def load_latest_pubmed_memo() -> Optional[str]:
    """Load the most recent PubMed scan memo."""
    PUBMED_SCANS_DIR.mkdir(parents=True, exist_ok=True)
    
    scan_files = sorted(PUBMED_SCANS_DIR.glob("scan_*.json"), reverse=True)
    if not scan_files:
        return None
    
    with open(scan_files[0]) as f:
        data = json.load(f)
    
    return data.get("memo")


def load_recent_feedback() -> List[Dict[str, Any]]:
    """
    Load recent feedback records.
    
    In production, this would query the database.
    For now, we look for exported feedback files.
    """
    feedback_dir = ROOT / "evals" / "feedback"
    feedback_dir.mkdir(parents=True, exist_ok=True)
    
    feedback_files = sorted(feedback_dir.glob("feedback_*.json"), reverse=True)
    if not feedback_files:
        return []
    
    # Load most recent
    with open(feedback_files[0]) as f:
        return json.load(f)


def analyze_feedback(feedback: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze feedback to identify common issues.
    
    Returns:
        Analysis summary with improvement suggestions
    """
    if not feedback:
        return {"issues": [], "suggestions": []}
    
    # Count issues by category
    issue_counts = {}
    for record in feedback:
        if not record.get("overall_passed", True):
            for check in record.get("quality_checks", []):
                if not check.get("passed", True):
                    name = check.get("check_name", "unknown")
                    issue_counts[name] = issue_counts.get(name, 0) + 1
    
    # Sort by frequency
    sorted_issues = sorted(issue_counts.items(), key=lambda x: -x[1])
    
    # Generate suggestions based on common issues
    suggestions = []
    for issue, count in sorted_issues[:5]:  # Top 5 issues
        if "citation" in issue.lower():
            suggestions.append(
                f"Issue '{issue}' occurred {count} times. "
                "Consider adding stronger citation requirements."
            )
        elif "length" in issue.lower():
            suggestions.append(
                f"Issue '{issue}' occurred {count} times. "
                "Adjust length bounds or add more specific guidance."
            )
        elif "confidence" in issue.lower():
            suggestions.append(
                f"Issue '{issue}' occurred {count} times. "
                "Add instructions to avoid uncertain language."
            )
        else:
            suggestions.append(
                f"Issue '{issue}' occurred {count} times. "
                "Review prompt for improvements."
            )
    
    return {
        "issues": sorted_issues,
        "suggestions": suggestions,
        "total_failures": sum(issue_counts.values())
    }


def generate_candidate_prompt(
    current_prompt: str,
    pubmed_memo: Optional[str],
    feedback_analysis: Dict[str, Any]
) -> str:
    """
    Generate a candidate prompt with improvements.
    
    In production, this would use an LLM to intelligently
    modify the prompt. For now, we append suggestions.
    """
    lines = current_prompt.split("
")
    
    # Find insertion point (after ## Instructions section)
    insert_idx = len(lines)
    for i, line in enumerate(lines):
        if line.startswith("## Quality Requirements"):
            insert_idx = i
            break
    
    # Build additions
    additions = [
        "",
        "## Recent Updates",
        f"*Auto-generated: {date.today().isoformat()}*",
        "",
    ]
    
    if pubmed_memo and "No new papers" not in pubmed_memo:
        additions.extend([
            "### Literature Updates",
            "Recent papers may affect extraction guidelines. Review:",
            pubmed_memo[:500] + "..." if len(pubmed_memo) > 500 else pubmed_memo,
            "",
        ])
    
    if feedback_analysis.get("suggestions"):
        additions.extend([
            "### Feedback-Driven Improvements",
            ""
        ])
        for suggestion in feedback_analysis["suggestions"]:
            additions.append(f"- {suggestion}")
        additions.append("")
    
    # Insert additions
    new_lines = lines[:insert_idx] + additions + lines[insert_idx:]
    
    return "
".join(new_lines)


def save_candidate(prompt: str) -> Path:
    """Save candidate prompt with unique identifier."""
    CANDIDATES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Generate hash from content
    content_hash = hashlib.sha256(prompt.encode()).hexdigest()[:8]
    
    # Create filename
    scan_date = date.today().isoformat()
    filename = f"{scan_date}-{content_hash}.md"
    
    output_path = CANDIDATES_DIR / filename
    output_path.write_text(prompt)
    
    return output_path


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Generate prompt update proposals")
    parser.add_argument("--from-feedback", action="store_true", help="Use feedback only")
    parser.add_argument("--from-pubmed", action="store_true", help="Use PubMed only")
    parser.add_argument("--dry-run", action="store_true", help="Don't save candidate")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Prompt Update Proposal Generator")
    print("=" * 60)
    
    # Load current prompt
    version, current_prompt = load_active_prompt()
    print(f"Current prompt version: {version}")
    
    # Load PubMed memo
    pubmed_memo = None
    if not args.from_feedback:
        pubmed_memo = load_latest_pubmed_memo()
        if pubmed_memo:
            print("✓ Loaded PubMed change memo")
        else:
            print("○ No PubMed memo available")
    
    # Load feedback
    feedback_analysis = {"issues": [], "suggestions": []}
    if not args.from_pubmed:
        feedback = load_recent_feedback()
        if feedback:
            print(f"✓ Loaded {len(feedback)} feedback records")
            feedback_analysis = analyze_feedback(feedback)
            print(f"  Found {feedback_analysis['total_failures']} quality failures")
        else:
            print("○ No feedback available")
    
    # Check if we have anything to work with
    if not pubmed_memo and not feedback_analysis["suggestions"]:
        print("
⚠ No changes to propose. Exiting.")
        return 0
    
    # Generate candidate
    print("
Generating candidate prompt...")
    candidate = generate_candidate_prompt(
        current_prompt,
        pubmed_memo,
        feedback_analysis
    )
    
    if args.dry_run:
        print("
[DRY RUN] Would create candidate:")
        print("-" * 40)
        print(candidate[:1000] + "..." if len(candidate) > 1000 else candidate)
        return 0
    
    # Save candidate
    output_path = save_candidate(candidate)
    print(f"
✓ Candidate saved: {output_path}")
    print(f"  Relative: prompts/refiner/candidates/{output_path.name}")
    
    print("
" + "=" * 60)
    print("NEXT STEPS")
    print("=" * 60)
    print("1. Run evaluation: python -m evals.run_evals --candidate " + output_path.stem)
    print("2. If metrics pass, create PR to promote to active")
    print("3. Update prompts/refiner/active.yaml after merge")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
