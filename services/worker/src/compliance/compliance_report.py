"""
Compliance Report Aggregator
Phase 5.2: Generate comprehensive compliance reports

Supports multiple checklists and generates actionable recommendations.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Union
from enum import Enum
from datetime import datetime
import json

from .strobe import check_strobe_compliance, get_strobe_score, StudyType
from .prisma import check_prisma_compliance, get_prisma_score


class ComplianceStatus(Enum):
    PASS = "pass"
    PARTIAL = "partial"
    FAIL = "fail"
    NOT_APPLICABLE = "na"


@dataclass
class ComplianceItem:
    """Individual compliance check result."""
    number: str
    section: str
    requirement: str
    status: ComplianceStatus
    evidence: str
    keywords_found: List[str] = field(default_factory=list)
    recommendation: Optional[str] = None


@dataclass
class ComplianceReport:
    """Complete compliance report for a manuscript."""
    manuscript_id: str
    checklist_type: str
    study_type: Optional[str]
    generated_at: str
    overall_score: float
    grade: str
    items: List[ComplianceItem]
    summary: Dict
    recommendations: List[str]
    metadata: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            'manuscript_id': self.manuscript_id,
            'checklist_type': self.checklist_type,
            'study_type': self.study_type,
            'generated_at': self.generated_at,
            'overall_score': self.overall_score,
            'grade': self.grade,
            'items': [
                {
                    'number': item.number,
                    'section': item.section,
                    'requirement': item.requirement,
                    'status': item.status.value,
                    'evidence': item.evidence,
                    'keywords_found': item.keywords_found,
                    'recommendation': item.recommendation
                }
                for item in self.items
            ],
            'summary': self.summary,
            'recommendations': self.recommendations,
            'metadata': self.metadata
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


def generate_compliance_report(
    manuscript: Dict,
    checklist_type: str = 'STROBE',
    study_type: Optional[str] = None,
    include_recommendations: bool = True
) -> ComplianceReport:
    """
    Generate comprehensive compliance report.
    
    Args:
        manuscript: Dict with manuscript content
        checklist_type: 'STROBE' or 'PRISMA'
        study_type: For STROBE: 'cohort', 'case_control', 'cross_sectional'
        include_recommendations: Whether to generate improvement recommendations
    
    Returns:
        ComplianceReport object
    """
    manuscript_id = manuscript.get('id', 'unknown')
    
    if checklist_type.upper() == 'STROBE':
        st = StudyType(study_type) if study_type else StudyType.COHORT
        raw_results = check_strobe_compliance(manuscript, st)
        score_info = get_strobe_score(raw_results)
    elif checklist_type.upper() == 'PRISMA':
        raw_results = check_prisma_compliance(manuscript)
        score_info = get_prisma_score(raw_results)
    else:
        raise ValueError(f"Unknown checklist type: {checklist_type}")
    
    # Convert to ComplianceItem objects
    items = []
    for r in raw_results:
        status = ComplianceStatus(r['status'])
        item = ComplianceItem(
            number=r['number'],
            section=r['section'],
            requirement=r.get('item') or r.get('topic', ''),
            status=status,
            evidence=r['evidence'],
            keywords_found=r.get('keywords_found', []),
            recommendation=_generate_recommendation(r) if include_recommendations and status == ComplianceStatus.FAIL else None
        )
        items.append(item)
    
    # Generate overall recommendations
    recommendations = []
    if include_recommendations:
        recommendations = _generate_overall_recommendations(items, checklist_type)
    
    # Build summary
    summary = {
        'total_items': score_info['total_items'],
        'applicable_items': score_info['applicable_items'],
        'passed': score_info['passed'],
        'partial': score_info['partial'],
        'failed': score_info['failed'],
        'by_section': _summarize_by_section(items)
    }
    
    return ComplianceReport(
        manuscript_id=manuscript_id,
        checklist_type=checklist_type.upper(),
        study_type=study_type,
        generated_at=datetime.utcnow().isoformat() + 'Z',
        overall_score=score_info['score'],
        grade=score_info['grade'],
        items=items,
        summary=summary,
        recommendations=recommendations,
        metadata={
            'version': '1.0',
            'checker': f'{checklist_type.upper()} Compliance Checker'
        }
    )


def _generate_recommendation(result: Dict) -> str:
    """Generate specific recommendation for failed item."""
    section = result['section']
    description = result.get('description', result.get('item', ''))
    
    templates = {
        'title': f"Update your title to clearly indicate the study design. {description}",
        'abstract': f"Ensure your abstract addresses: {description}",
        'introduction': f"In your Introduction, make sure to: {description}",
        'methods': f"Add to your Methods section: {description}",
        'results': f"Include in your Results: {description}",
        'discussion': f"Address in your Discussion: {description}",
        'other': f"Consider adding: {description}"
    }
    
    return templates.get(section, f"Address the following: {description}")


def _generate_overall_recommendations(
    items: List[ComplianceItem],
    checklist_type: str
) -> List[str]:
    """Generate prioritized overall recommendations."""
    recommendations = []
    
    # Group failures by section
    section_failures = {}
    for item in items:
        if item.status == ComplianceStatus.FAIL:
            if item.section not in section_failures:
                section_failures[item.section] = []
            section_failures[item.section].append(item)
    
    # Priority sections
    priority_order = ['methods', 'results', 'introduction', 'discussion', 'abstract', 'title', 'other']
    
    for section in priority_order:
        if section in section_failures:
            failures = section_failures[section]
            if len(failures) == 1:
                recommendations.append(
                    f"{section.title()}: Address item {failures[0].number} - {failures[0].requirement}"
                )
            else:
                items_list = ', '.join([f.number for f in failures])
                recommendations.append(
                    f"{section.title()}: Address items {items_list} ({len(failures)} issues)"
                )
    
    # Add general guidance
    if len(recommendations) > 5:
        recommendations.insert(0, 
            f"Your manuscript has {len([i for i in items if i.status == ComplianceStatus.FAIL])} "
            f"items needing attention. Focus on Methods and Results sections first."
        )
    
    return recommendations[:10]  # Limit to top 10


def _summarize_by_section(items: List[ComplianceItem]) -> Dict:
    """Summarize compliance by section."""
    sections = {}
    for item in items:
        if item.section not in sections:
            sections[item.section] = {'pass': 0, 'partial': 0, 'fail': 0, 'na': 0}
        sections[item.section][item.status.value] += 1
    return sections


def compare_reports(
    report1: ComplianceReport,
    report2: ComplianceReport
) -> Dict:
    """
    Compare two compliance reports (e.g., before/after revision).
    
    Returns dict with changes summary.
    """
    changes = {
        'score_change': report2.overall_score - report1.overall_score,
        'grade_change': f"{report1.grade} → {report2.grade}",
        'improved_items': [],
        'regressed_items': [],
        'unchanged_items': 0
    }
    
    # Create lookup for report1 items
    report1_items = {item.number: item for item in report1.items}
    
    for item2 in report2.items:
        item1 = report1_items.get(item2.number)
        if not item1:
            continue
        
        # Compare status
        status_order = {
            ComplianceStatus.FAIL: 0,
            ComplianceStatus.PARTIAL: 1,
            ComplianceStatus.PASS: 2,
            ComplianceStatus.NOT_APPLICABLE: -1
        }
        
        s1 = status_order.get(item1.status, -1)
        s2 = status_order.get(item2.status, -1)
        
        if s2 > s1:
            changes['improved_items'].append({
                'number': item2.number,
                'requirement': item2.requirement,
                'old_status': item1.status.value,
                'new_status': item2.status.value
            })
        elif s2 < s1:
            changes['regressed_items'].append({
                'number': item2.number,
                'requirement': item2.requirement,
                'old_status': item1.status.value,
                'new_status': item2.status.value
            })
        else:
            changes['unchanged_items'] += 1
    
    return changes


def export_checklist_template(checklist_type: str, format: str = 'markdown') -> str:
    """
    Export empty checklist template for manual completion.
    
    Args:
        checklist_type: 'STROBE' or 'PRISMA'
        format: 'markdown' or 'csv'
    
    Returns:
        Formatted checklist template
    """
    if checklist_type.upper() == 'STROBE':
        from .strobe import STROBE_ITEMS
        items = STROBE_ITEMS
        title = "STROBE Checklist"
    elif checklist_type.upper() == 'PRISMA':
        from .prisma import PRISMA_ITEMS
        items = PRISMA_ITEMS
        title = "PRISMA 2020 Checklist"
    else:
        raise ValueError(f"Unknown checklist type: {checklist_type}")
    
    if format == 'csv':
        lines = ['Number,Section,Item,Page Number,Notes']
        for item in items:
            desc = getattr(item, 'item', None) or getattr(item, 'topic', '')
            lines.append(f'"{item.number}","{item.section}","{desc}","",""')
        return '\n'.join(lines)
    
    else:  # markdown
        lines = [f"# {title}\n"]
        current_section = None
        
        for item in items:
            if item.section != current_section:
                current_section = item.section
                lines.append(f"\n## {current_section.title()}\n")
            
            desc = getattr(item, 'item', None) or getattr(item, 'topic', '')
            lines.append(f"- [ ] **{item.number}** {desc}")
            lines.append(f"  - {item.description}")
            lines.append(f"  - Page: _____")
        
        return '\n'.join(lines)
