"""
STROBE Compliance Checker
Strengthening the Reporting of Observational Studies in Epidemiology

22-item checklist for cohort, case-control, and cross-sectional studies.
Reference: https://www.strobe-statement.org/
"""

import re
from dataclasses import dataclass
from typing import List, Dict, Optional
from enum import Enum

class StudyType(Enum):
    COHORT = "cohort"
    CASE_CONTROL = "case_control"
    CROSS_SECTIONAL = "cross_sectional"

@dataclass
class STROBEItem:
    number: str
    section: str
    item: str
    description: str
    keywords: List[str]
    required_for: List[StudyType]

# STROBE 22-item checklist
STROBE_ITEMS: List[STROBEItem] = [
    # Title and Abstract
    STROBEItem("1a", "title", "Study design", 
               "Indicate study design with commonly used term in title or abstract",
               ["cohort", "case-control", "cross-sectional", "retrospective", "prospective", "observational"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("1b", "abstract", "Informative abstract",
               "Provide informative and balanced summary of what was done and found",
               ["objective", "methods", "results", "conclusions", "background"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    
    # Introduction
    STROBEItem("2", "introduction", "Background/rationale",
               "Explain scientific background and rationale for investigation",
               ["background", "rationale", "previous studies", "literature", "gap", "unknown"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("3", "introduction", "Objectives",
               "State specific objectives, including any prespecified hypotheses",
               ["objective", "aim", "purpose", "hypothesis", "research question"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    
    # Methods
    STROBEItem("4", "methods", "Study design",
               "Present key elements of study design early in the paper",
               ["study design", "cohort", "case-control", "cross-sectional", "prospective", "retrospective"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("5", "methods", "Setting",
               "Describe setting, locations, relevant dates",
               ["setting", "location", "dates", "period", "recruitment", "follow-up", "exposure", "data collection"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("6a", "methods", "Participants - eligibility",
               "Give eligibility criteria and sources/methods of selection",
               ["eligibility", "inclusion", "exclusion", "criteria", "selection"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("6b", "methods", "Participants - matching",
               "For matched studies, give matching criteria and number of controls",
               ["matching", "matched", "controls per case"],
               [StudyType.CASE_CONTROL]),
    STROBEItem("7", "methods", "Variables",
               "Clearly define all outcomes, exposures, predictors, confounders",
               ["outcome", "exposure", "predictor", "confounder", "variable", "definition", "measured"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("8", "methods", "Data sources/measurement",
               "Give sources of data and details of assessment methods",
               ["data source", "measurement", "assessment", "instrument", "questionnaire", "medical record", "laboratory"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("9", "methods", "Bias",
               "Describe any efforts to address potential sources of bias",
               ["bias", "confounding", "selection bias", "information bias", "misclassification"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("10", "methods", "Study size",
               "Explain how study size was arrived at",
               ["sample size", "power", "calculation", "participants", "subjects", "patients"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("11", "methods", "Quantitative variables",
               "Explain how quantitative variables were handled",
               ["continuous", "categorical", "grouping", "cutoff", "threshold"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("12a", "methods", "Statistical methods - main",
               "Describe all statistical methods including confounding control",
               ["statistical", "analysis", "regression", "adjusted", "multivariate", "confounding"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("12b", "methods", "Statistical methods - subgroups",
               "Describe methods for examining subgroups and interactions",
               ["subgroup", "interaction", "stratified", "effect modification"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("12c", "methods", "Statistical methods - missing",
               "Explain how missing data were addressed",
               ["missing", "imputation", "complete case", "sensitivity analysis"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("12d", "methods", "Statistical methods - loss to follow-up",
               "If applicable, explain how loss to follow-up was addressed",
               ["loss to follow-up", "attrition", "dropout", "censoring"],
               [StudyType.COHORT]),
    STROBEItem("12e", "methods", "Statistical methods - sensitivity",
               "Describe any sensitivity analyses",
               ["sensitivity analysis", "robustness"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    
    # Results
    STROBEItem("13a", "results", "Participants - numbers",
               "Report numbers at each stage of study",
               ["enrolled", "eligible", "included", "excluded", "analyzed", "flow"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("13b", "results", "Participants - non-participation",
               "Give reasons for non-participation at each stage",
               ["excluded", "refused", "ineligible", "lost", "reasons"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("13c", "results", "Participants - flow diagram",
               "Consider use of a flow diagram",
               ["flow diagram", "flowchart", "figure"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("14a", "results", "Descriptive data - characteristics",
               "Give characteristics of participants and information on exposures",
               ["table 1", "baseline", "characteristics", "demographic", "exposure"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("14b", "results", "Descriptive data - missing",
               "Indicate number of participants with missing data",
               ["missing", "available", "complete"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("14c", "results", "Descriptive data - follow-up",
               "Summarise follow-up time",
               ["follow-up", "person-years", "median follow-up"],
               [StudyType.COHORT]),
    STROBEItem("15", "results", "Outcome data",
               "Report numbers of outcome events or summary measures",
               ["outcome", "events", "incidence", "prevalence", "cases"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("16a", "results", "Main results - unadjusted",
               "Give unadjusted estimates and their precision",
               ["unadjusted", "crude", "confidence interval", "95% CI"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("16b", "results", "Main results - adjusted",
               "Report adjusted estimates and confounders adjusted for",
               ["adjusted", "multivariate", "confounders", "covariates"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("16c", "results", "Main results - continuous",
               "If continuous, report meaningful reference category",
               ["continuous", "per unit", "reference"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("17", "results", "Other analyses",
               "Report other analyses done—subgroups, interactions, sensitivity",
               ["subgroup", "interaction", "sensitivity", "additional"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    
    # Discussion
    STROBEItem("18", "discussion", "Key results",
               "Summarise key results with reference to study objectives",
               ["summary", "main finding", "key result", "principal finding"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("19", "discussion", "Limitations",
               "Discuss limitations including sources of potential bias",
               ["limitation", "bias", "weakness", "shortcoming"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("20", "discussion", "Interpretation",
               "Give cautious overall interpretation considering objectives, limitations",
               ["interpretation", "implication", "suggest", "indicate", "conclude"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    STROBEItem("21", "discussion", "Generalisability",
               "Discuss generalisability (external validity)",
               ["generalisability", "generalizability", "external validity", "applicable"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
    
    # Other
    STROBEItem("22", "other", "Funding",
               "Give source of funding and role of funders",
               ["funding", "support", "grant", "sponsor", "conflict of interest"],
               [StudyType.COHORT, StudyType.CASE_CONTROL, StudyType.CROSS_SECTIONAL]),
]


def check_strobe_compliance(
    manuscript: Dict,
    study_type: StudyType = StudyType.COHORT
) -> List[Dict]:
    """
    Check manuscript compliance with STROBE checklist.
    
    Args:
        manuscript: Dict with 'sections' containing title, abstract, 
                   introduction, methods, results, discussion
        study_type: Type of observational study
    
    Returns:
        List of compliance check results
    """
    results = []
    sections = manuscript.get('sections', {})
    
    for item in STROBE_ITEMS:
        # Skip items not required for this study type
        if study_type not in item.required_for:
            results.append({
                'number': item.number,
                'section': item.section,
                'item': item.item,
                'status': 'na',
                'evidence': 'Not applicable for this study type'
            })
            continue
        
        # Get relevant section text
        section_text = sections.get(item.section, '')
        if item.section == 'title':
            section_text = manuscript.get('title', '')
        
        # Check for keywords
        found_keywords = []
        text_lower = section_text.lower()
        
        for keyword in item.keywords:
            if keyword.lower() in text_lower:
                found_keywords.append(keyword)
        
        # Determine status
        if len(found_keywords) >= 2:
            status = 'pass'
            evidence = f"Found relevant terms: {', '.join(found_keywords[:5])}"
        elif len(found_keywords) == 1:
            status = 'partial'
            evidence = f"Partially addressed. Found: {found_keywords[0]}"
        else:
            status = 'fail'
            evidence = f"Missing. Consider addressing: {item.description}"
        
        results.append({
            'number': item.number,
            'section': item.section,
            'item': item.item,
            'description': item.description,
            'status': status,
            'evidence': evidence,
            'keywords_found': found_keywords
        })
    
    return results


def get_strobe_score(results: List[Dict]) -> Dict:
    """Calculate STROBE compliance score."""
    applicable = [r for r in results if r['status'] != 'na']
    passed = sum(1 for r in applicable if r['status'] == 'pass')
    partial = sum(1 for r in applicable if r['status'] == 'partial')
    failed = sum(1 for r in applicable if r['status'] == 'fail')
    
    score = (passed + 0.5 * partial) / len(applicable) if applicable else 0
    
    return {
        'checklist': 'STROBE',
        'total_items': len(STROBE_ITEMS),
        'applicable_items': len(applicable),
        'passed': passed,
        'partial': partial,
        'failed': failed,
        'score': round(score * 100, 1),
        'grade': _get_grade(score)
    }


def _get_grade(score: float) -> str:
    if score >= 0.9:
        return 'A'
    elif score >= 0.8:
        return 'B'
    elif score >= 0.7:
        return 'C'
    elif score >= 0.6:
        return 'D'
    else:
        return 'F'
