"""
PRISMA Compliance Checker
Preferred Reporting Items for Systematic Reviews and Meta-Analyses

27-item checklist for systematic reviews.
Reference: http://www.prisma-statement.org/
"""

from dataclasses import dataclass
from typing import List, Dict

@dataclass
class PRISMAItem:
    number: str
    section: str
    topic: str
    description: str
    keywords: List[str]

# PRISMA 2020 checklist (27 items)
PRISMA_ITEMS: List[PRISMAItem] = [
    # Title
    PRISMAItem("1", "title", "Title",
               "Identify the report as a systematic review",
               ["systematic review", "meta-analysis", "scoping review"]),
    
    # Abstract
    PRISMAItem("2", "abstract", "Abstract",
               "Provide structured summary including background, objectives, methods, results, conclusions",
               ["background", "objective", "methods", "results", "conclusion", "structured"]),
    
    # Introduction
    PRISMAItem("3", "introduction", "Rationale",
               "Describe rationale for review in context of existing knowledge",
               ["rationale", "background", "existing", "knowledge gap", "previous reviews"]),
    PRISMAItem("4", "introduction", "Objectives",
               "Provide explicit statement of objectives, addressing PICO",
               ["objective", "aim", "PICO", "population", "intervention", "comparator", "outcome"]),
    
    # Methods
    PRISMAItem("5", "methods", "Eligibility criteria",
               "Specify inclusion and exclusion criteria",
               ["eligibility", "inclusion", "exclusion", "criteria", "PICO"]),
    PRISMAItem("6", "methods", "Information sources",
               "Specify all databases, registers, and other sources searched",
               ["database", "PubMed", "MEDLINE", "Embase", "Cochrane", "search", "sources"]),
    PRISMAItem("7", "methods", "Search strategy",
               "Present full search strategies for all databases",
               ["search strategy", "search terms", "MeSH", "keywords", "Boolean"]),
    PRISMAItem("8", "methods", "Selection process",
               "Specify methods used to select studies",
               ["screening", "selection", "independent", "reviewers", "disagreement"]),
    PRISMAItem("9", "methods", "Data collection process",
               "Specify methods of data collection from reports",
               ["data extraction", "data collection", "form", "pilot"]),
    PRISMAItem("10a", "methods", "Data items - outcomes",
               "List and define all outcomes for which data were sought",
               ["outcome", "primary", "secondary", "definition"]),
    PRISMAItem("10b", "methods", "Data items - other",
               "List and define all other variables for which data were sought",
               ["variable", "study characteristics", "participant", "intervention"]),
    PRISMAItem("11", "methods", "Study risk of bias assessment",
               "Specify methods used for assessing risk of bias",
               ["risk of bias", "quality assessment", "Cochrane", "ROB", "Newcastle-Ottawa"]),
    PRISMAItem("12", "methods", "Effect measures",
               "Specify for each outcome the effect measure used",
               ["effect measure", "odds ratio", "risk ratio", "hazard ratio", "mean difference"]),
    PRISMAItem("13a", "methods", "Synthesis methods - eligibility",
               "Describe processes to decide which studies were eligible for each synthesis",
               ["synthesis", "meta-analysis", "pooling", "eligible"]),
    PRISMAItem("13b", "methods", "Synthesis methods - tabulation",
               "Describe any methods to tabulate or visually display results",
               ["forest plot", "table", "figure", "display"]),
    PRISMAItem("13c", "methods", "Synthesis methods - meta-analysis",
               "Describe any methods used to synthesize results",
               ["meta-analysis", "random effects", "fixed effects", "pooled"]),
    PRISMAItem("13d", "methods", "Synthesis methods - heterogeneity",
               "Describe methods to explore heterogeneity",
               ["heterogeneity", "I2", "I-squared", "Q statistic", "subgroup"]),
    PRISMAItem("13e", "methods", "Synthesis methods - sensitivity",
               "Describe any sensitivity analyses conducted",
               ["sensitivity analysis", "robustness", "leave-one-out"]),
    PRISMAItem("13f", "methods", "Reporting bias assessment",
               "Describe methods to assess risk of reporting bias",
               ["publication bias", "funnel plot", "Egger", "reporting bias"]),
    PRISMAItem("14", "methods", "Certainty assessment",
               "Describe methods to assess certainty of evidence",
               ["GRADE", "certainty", "quality of evidence", "confidence"]),
    
    # Results
    PRISMAItem("15", "results", "Study selection",
               "Describe results of search and selection process, ideally with flow diagram",
               ["PRISMA flow", "flow diagram", "identified", "screened", "included", "excluded"]),
    PRISMAItem("16", "results", "Study characteristics",
               "Cite each study and present characteristics",
               ["study characteristics", "table", "author", "year", "population", "intervention"]),
    PRISMAItem("17", "results", "Risk of bias in studies",
               "Present assessments of risk of bias for each study",
               ["risk of bias", "quality", "high risk", "low risk", "unclear"]),
    PRISMAItem("18", "results", "Results of individual studies",
               "Present results of all individual studies",
               ["individual studies", "effect estimate", "confidence interval"]),
    PRISMAItem("19", "results", "Results of syntheses",
               "Present results of each synthesis conducted",
               ["pooled", "overall effect", "forest plot", "meta-analysis result"]),
    PRISMAItem("20a", "results", "Reporting biases",
               "Present assessments of risk of reporting bias",
               ["funnel plot", "publication bias", "asymmetry"]),
    PRISMAItem("20b", "results", "Certainty of evidence",
               "Present assessments of certainty of evidence",
               ["GRADE", "certainty", "very low", "low", "moderate", "high"]),
    
    # Discussion
    PRISMAItem("21", "discussion", "Discussion - summary",
               "Provide general interpretation in context of other evidence",
               ["summary", "interpretation", "context", "prior studies"]),
    PRISMAItem("22", "discussion", "Discussion - limitations",
               "Discuss limitations at study and outcome level",
               ["limitation", "bias", "weakness", "heterogeneity"]),
    PRISMAItem("23", "discussion", "Discussion - implications",
               "Provide implications for practice, policy, future research",
               ["implication", "practice", "policy", "future research", "recommendation"]),
    
    # Other
    PRISMAItem("24", "other", "Registration and protocol",
               "Provide registration information and protocol access",
               ["PROSPERO", "registration", "protocol", "registered"]),
    PRISMAItem("25", "other", "Support",
               "Describe sources of support",
               ["funding", "support", "grant", "sponsor"]),
    PRISMAItem("26", "other", "Competing interests",
               "Declare competing interests",
               ["conflict of interest", "competing interest", "disclosure"]),
    PRISMAItem("27", "other", "Availability of data",
               "Report which data are available and how to access them",
               ["data availability", "supplementary", "repository", "available upon request"]),
]


def check_prisma_compliance(manuscript: Dict) -> List[Dict]:
    """
    Check manuscript compliance with PRISMA checklist.
    
    Args:
        manuscript: Dict with 'sections' containing title, abstract, 
                   introduction, methods, results, discussion
    
    Returns:
        List of compliance check results
    """
    results = []
    sections = manuscript.get('sections', {})
    
    for item in PRISMA_ITEMS:
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
            'topic': item.topic,
            'description': item.description,
            'status': status,
            'evidence': evidence,
            'keywords_found': found_keywords
        })
    
    return results


def get_prisma_score(results: List[Dict]) -> Dict:
    """Calculate PRISMA compliance score."""
    applicable = [r for r in results if r['status'] != 'na']
    passed = sum(1 for r in applicable if r['status'] == 'pass')
    partial = sum(1 for r in applicable if r['status'] == 'partial')
    failed = sum(1 for r in applicable if r['status'] == 'fail')
    
    score = (passed + 0.5 * partial) / len(applicable) if applicable else 0
    
    return {
        'checklist': 'PRISMA',
        'total_items': len(PRISMA_ITEMS),
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


def get_prisma_flow_suggestions(manuscript: Dict) -> List[str]:
    """
    Generate suggestions for PRISMA flow diagram numbers.
    
    Returns list of prompts for flow diagram values.
    """
    return [
        "Records identified through database searching: ___",
        "Additional records identified through other sources: ___",
        "Records after duplicates removed: ___",
        "Records screened: ___",
        "Records excluded: ___",
        "Full-text articles assessed for eligibility: ___",
        "Full-text articles excluded, with reasons: ___",
        "Studies included in qualitative synthesis: ___",
        "Studies included in quantitative synthesis (meta-analysis): ___"
    ]
