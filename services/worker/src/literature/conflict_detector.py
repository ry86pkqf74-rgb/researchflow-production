"""
Literature Conflict Detector

Identifies conflicts and inconsistencies across literature sources:
- Contradictory findings
- Statistical discrepancies
- Methodology differences
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class Conflict:
    """A detected conflict between sources"""
    conflict_type: str  # statistical, methodological, finding, temporal
    severity: str  # low, medium, high
    paper_ids: List[str]
    description: str
    evidence: List[str]
    resolution_hint: Optional[str] = None


@dataclass
class ConflictReport:
    """Conflict detection report"""
    conflicts: List[Conflict]
    total_papers: int
    papers_with_conflicts: int
    conflict_summary: Dict[str, int]


def _extract_statistics(text: str) -> List[Dict[str, Any]]:
    """Extract statistical values from text"""
    stats = []

    # P-values
    p_pattern = r'p\s*[<>=]\s*(\d+\.?\d*)'
    for match in re.finditer(p_pattern, text.lower()):
        stats.append({
            'type': 'p_value',
            'value': float(match.group(1)),
            'raw': match.group(0)
        })

    # Confidence intervals
    ci_pattern = r'(\d+)%\s*(?:CI|confidence interval)[:\s]*\[?(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)\]?'
    for match in re.finditer(ci_pattern, text, re.IGNORECASE):
        stats.append({
            'type': 'confidence_interval',
            'confidence': int(match.group(1)),
            'lower': float(match.group(2)),
            'upper': float(match.group(3)),
            'raw': match.group(0)
        })

    # Odds ratios / Hazard ratios
    or_pattern = r'(?:OR|HR|RR)[:\s]*(\d+\.?\d*)'
    for match in re.finditer(or_pattern, text, re.IGNORECASE):
        stats.append({
            'type': 'effect_size',
            'value': float(match.group(1)),
            'raw': match.group(0)
        })

    # Sample sizes
    n_pattern = r'(?:n|N)\s*[=:]\s*(\d+)'
    for match in re.finditer(n_pattern, text):
        stats.append({
            'type': 'sample_size',
            'value': int(match.group(1)),
            'raw': match.group(0)
        })

    return stats


def _extract_findings(text: str) -> List[str]:
    """Extract key findings from abstract/text"""
    findings = []

    # Look for conclusion indicators
    conclusion_patterns = [
        r'(?:conclude|found|demonstrate|show|indicate|suggest)[sd]?\s+that\s+([^.]+)',
        r'(?:results|findings)\s+(?:show|indicate|suggest)\s+([^.]+)',
        r'(?:significantly|notably)\s+([^.]+)',
    ]

    for pattern in conclusion_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            findings.append(match.group(1).strip())

    return findings


def _check_statistical_conflict(
    stats1: List[Dict],
    stats2: List[Dict],
    paper_id1: str,
    paper_id2: str
) -> List[Conflict]:
    """Check for statistical conflicts between two papers"""
    conflicts = []

    # Compare effect sizes (OR, HR, RR)
    effects1 = [s for s in stats1 if s['type'] == 'effect_size']
    effects2 = [s for s in stats2 if s['type'] == 'effect_size']

    for e1 in effects1:
        for e2 in effects2:
            # Check if effect directions conflict (one >1, one <1)
            if (e1['value'] > 1 and e2['value'] < 1) or (e1['value'] < 1 and e2['value'] > 1):
                conflicts.append(Conflict(
                    conflict_type='statistical',
                    severity='high',
                    paper_ids=[paper_id1, paper_id2],
                    description='Conflicting effect directions detected',
                    evidence=[e1['raw'], e2['raw']],
                    resolution_hint='Review study populations and methodologies for differences'
                ))
            # Check for large magnitude differences
            elif e1['value'] > 0 and e2['value'] > 0:
                ratio = max(e1['value'], e2['value']) / min(e1['value'], e2['value'])
                if ratio > 2:
                    conflicts.append(Conflict(
                        conflict_type='statistical',
                        severity='medium',
                        paper_ids=[paper_id1, paper_id2],
                        description=f'Effect size magnitude differs by {ratio:.1f}x',
                        evidence=[e1['raw'], e2['raw']],
                        resolution_hint='Consider heterogeneity in study design or population'
                    ))

    return conflicts


def _check_finding_conflict(
    findings1: List[str],
    findings2: List[str],
    paper_id1: str,
    paper_id2: str
) -> List[Conflict]:
    """Check for conflicting findings"""
    conflicts = []

    # Contradiction indicators
    positive_terms = {'effective', 'beneficial', 'improved', 'increased', 'positive', 'significant'}
    negative_terms = {'ineffective', 'harmful', 'worsened', 'decreased', 'negative', 'no significant'}

    for f1 in findings1:
        f1_lower = f1.lower()
        f1_positive = any(term in f1_lower for term in positive_terms)
        f1_negative = any(term in f1_lower for term in negative_terms)

        for f2 in findings2:
            f2_lower = f2.lower()
            f2_positive = any(term in f2_lower for term in positive_terms)
            f2_negative = any(term in f2_lower for term in negative_terms)

            # Check for contradiction
            if (f1_positive and f2_negative) or (f1_negative and f2_positive):
                conflicts.append(Conflict(
                    conflict_type='finding',
                    severity='high',
                    paper_ids=[paper_id1, paper_id2],
                    description='Contradictory findings detected',
                    evidence=[f1[:100], f2[:100]],
                    resolution_hint='Examine study design, population, and timeframe differences'
                ))

    return conflicts


def detect_conflicts(
    papers: List[Dict[str, Any]],
    check_statistics: bool = True,
    check_findings: bool = True,
    check_methodology: bool = True
) -> ConflictReport:
    """
    Detect conflicts across a set of papers.

    Args:
        papers: List of paper dictionaries with 'title', 'abstract', etc.
        check_statistics: Check for statistical conflicts
        check_findings: Check for finding conflicts
        check_methodology: Check for methodology conflicts

    Returns:
        ConflictReport with detected conflicts
    """
    all_conflicts: List[Conflict] = []
    papers_with_conflicts: Set[str] = set()

    # Extract features from each paper
    paper_features = []
    for paper in papers:
        paper_id = paper.get('pmid') or paper.get('doi') or paper.get('paperId') or paper.get('title', '')[:30]
        abstract = paper.get('abstract', '') or ''

        features = {
            'id': paper_id,
            'stats': _extract_statistics(abstract) if check_statistics else [],
            'findings': _extract_findings(abstract) if check_findings else [],
            'year': paper.get('year'),
            'title': paper.get('title', '')
        }
        paper_features.append(features)

    # Compare pairs
    for i, p1 in enumerate(paper_features):
        for j, p2 in enumerate(paper_features[i+1:], i+1):
            # Statistical conflicts
            if check_statistics and p1['stats'] and p2['stats']:
                stat_conflicts = _check_statistical_conflict(
                    p1['stats'], p2['stats'], p1['id'], p2['id']
                )
                all_conflicts.extend(stat_conflicts)
                if stat_conflicts:
                    papers_with_conflicts.add(p1['id'])
                    papers_with_conflicts.add(p2['id'])

            # Finding conflicts
            if check_findings and p1['findings'] and p2['findings']:
                finding_conflicts = _check_finding_conflict(
                    p1['findings'], p2['findings'], p1['id'], p2['id']
                )
                all_conflicts.extend(finding_conflicts)
                if finding_conflicts:
                    papers_with_conflicts.add(p1['id'])
                    papers_with_conflicts.add(p2['id'])

            # Temporal conflicts (newer contradicts older)
            if p1['year'] and p2['year'] and abs(p1['year'] - p2['year']) > 5:
                # Check if there are existing conflicts and mark as temporal
                for conflict in all_conflicts:
                    if set(conflict.paper_ids) == {p1['id'], p2['id']}:
                        if conflict.resolution_hint:
                            conflict.resolution_hint += f" (Note: {abs(p1['year'] - p2['year'])} year gap)"

    # Summarize conflicts by type
    summary = defaultdict(int)
    for conflict in all_conflicts:
        summary[conflict.conflict_type] += 1

    return ConflictReport(
        conflicts=all_conflicts,
        total_papers=len(papers),
        papers_with_conflicts=len(papers_with_conflicts),
        conflict_summary=dict(summary)
    )


def generate_conflict_matrix(
    papers: List[Dict[str, Any]],
    report: ConflictReport
) -> Dict[str, Any]:
    """
    Generate a conflict matrix showing paper-to-paper conflicts.

    Args:
        papers: List of papers
        report: ConflictReport from detect_conflicts

    Returns:
        Dictionary with matrix data suitable for visualization
    """
    # Create paper ID list
    paper_ids = []
    for paper in papers:
        pid = paper.get('pmid') or paper.get('doi') or paper.get('paperId') or paper.get('title', '')[:30]
        paper_ids.append(pid)

    # Build adjacency matrix
    n = len(paper_ids)
    matrix = [[0] * n for _ in range(n)]

    id_to_idx = {pid: idx for idx, pid in enumerate(paper_ids)}

    for conflict in report.conflicts:
        if len(conflict.paper_ids) >= 2:
            id1, id2 = conflict.paper_ids[0], conflict.paper_ids[1]
            if id1 in id_to_idx and id2 in id_to_idx:
                i, j = id_to_idx[id1], id_to_idx[id2]
                severity_score = {'low': 1, 'medium': 2, 'high': 3}.get(conflict.severity, 1)
                matrix[i][j] = max(matrix[i][j], severity_score)
                matrix[j][i] = max(matrix[j][i], severity_score)

    return {
        'paper_ids': paper_ids,
        'matrix': matrix,
        'legend': {'0': 'No conflict', '1': 'Low', '2': 'Medium', '3': 'High'}
    }
