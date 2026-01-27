"""Known guideline sources mapping for Stage 20 integration.

This module provides URL mappings for medical/surgical guidelines
that can be fetched and parsed by the guideline engine.
"""
from typing import Optional, Dict, Any

GUIDELINE_SOURCES: Dict[str, Dict[str, Any]] = {
    # ==========================================================================
    # Oncology - Staging
    # ==========================================================================
    "tnm colorectal": {
        "url": "https://www.cancer.org/cancer/types/colon-rectal-cancer/detection-diagnosis-staging/staged.html",
        "type": "html",
        "field": "oncology",
        "category": "staging",
        "description": "TNM staging for colorectal cancer"
    },
    "ajcc breast": {
        "url": "https://www.cancer.org/cancer/types/breast-cancer/understanding-a-breast-cancer-diagnosis/stages-of-breast-cancer.html",
        "type": "html",
        "field": "oncology",
        "category": "staging",
        "description": "AJCC staging for breast cancer"
    },
    "ajcc melanoma": {
        "url": "https://www.cancer.org/cancer/types/melanoma-skin-cancer/detection-diagnosis-staging/melanoma-skin-cancer-stages.html",
        "type": "html",
        "field": "oncology",
        "category": "staging",
        "description": "AJCC staging for melanoma"
    },
    "ajcc lung": {
        "url": "https://www.cancer.org/cancer/types/lung-cancer/detection-diagnosis-staging/lung-cancer-stages.html",
        "type": "html",
        "field": "oncology",
        "category": "staging",
        "description": "AJCC staging for lung cancer"
    },
    "ajcc prostate": {
        "url": "https://www.cancer.org/cancer/types/prostate-cancer/detection-diagnosis-staging/staging.html",
        "type": "html",
        "field": "oncology",
        "category": "staging",
        "description": "AJCC staging for prostate cancer"
    },

    # ==========================================================================
    # Surgery - Complications
    # ==========================================================================
    "clavien-dindo": {
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC1360123/",
        "type": "html",
        "field": "surgery",
        "category": "grading",
        "description": "Clavien-Dindo classification of surgical complications"
    },
    "clavien-dindo surgical complications": {
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC1360123/",
        "type": "html",
        "field": "surgery",
        "category": "grading",
        "description": "Clavien-Dindo classification of surgical complications"
    },
    "accordion severity": {
        "url": "https://pubmed.ncbi.nlm.nih.gov/19638912/",
        "type": "html",
        "field": "surgery",
        "category": "grading",
        "description": "ACCORDION severity classification"
    },

    # ==========================================================================
    # Anesthesia
    # ==========================================================================
    "asa physical status": {
        "url": "https://www.asahq.org/standards-and-practice-parameters/statement-on-asa-physical-status-classification-system",
        "type": "html",
        "field": "anesthesia",
        "category": "classification",
        "description": "ASA Physical Status Classification"
    },
    "asa classification": {
        "url": "https://www.asahq.org/standards-and-practice-parameters/statement-on-asa-physical-status-classification-system",
        "type": "html",
        "field": "anesthesia",
        "category": "classification",
        "description": "ASA Physical Status Classification"
    },

    # ==========================================================================
    # Performance Status
    # ==========================================================================
    "ecog performance status": {
        "url": "https://ecog-acrin.org/resources/ecog-performance-status/",
        "type": "html",
        "field": "oncology",
        "category": "classification",
        "description": "ECOG Performance Status"
    },
    "who performance status": {
        "url": "https://ecog-acrin.org/resources/ecog-performance-status/",
        "type": "html",
        "field": "oncology",
        "category": "classification",
        "description": "WHO/ECOG Performance Status"
    },
    "karnofsky performance": {
        "url": "https://www.ncbi.nlm.nih.gov/books/NBK538293/",
        "type": "html",
        "field": "oncology",
        "category": "classification",
        "description": "Karnofsky Performance Status"
    },

    # ==========================================================================
    # Liver Disease
    # ==========================================================================
    "child-pugh": {
        "url": "https://www.mdcalc.com/calc/340/child-pugh-score-cirrhosis-mortality",
        "type": "html",
        "field": "hepatology",
        "category": "staging",
        "description": "Child-Pugh classification for cirrhosis"
    },
    "meld score": {
        "url": "https://www.mdcalc.com/calc/78/meld-score-model-end-stage-liver-disease-12-older",
        "type": "html",
        "field": "hepatology",
        "category": "score",
        "description": "MELD Score for liver disease"
    },

    # ==========================================================================
    # Cardiac
    # ==========================================================================
    "nyha classification": {
        "url": "https://www.heart.org/en/health-topics/heart-failure/what-is-heart-failure/classes-of-heart-failure",
        "type": "html",
        "field": "cardiology",
        "category": "classification",
        "description": "NYHA Functional Classification for heart failure"
    },
    "cha2ds2-vasc": {
        "url": "https://www.mdcalc.com/calc/801/cha2ds2-vasc-score-atrial-fibrillation-stroke-risk",
        "type": "html",
        "field": "cardiology",
        "category": "score",
        "description": "CHA2DS2-VASc Score for stroke risk"
    },

    # ==========================================================================
    # Trauma
    # ==========================================================================
    "injury severity score": {
        "url": "https://www.ncbi.nlm.nih.gov/books/NBK519528/",
        "type": "html",
        "field": "trauma",
        "category": "score",
        "description": "Injury Severity Score (ISS)"
    },
    "glasgow coma scale": {
        "url": "https://www.glasgowcomascale.org/",
        "type": "html",
        "field": "neurology",
        "category": "score",
        "description": "Glasgow Coma Scale"
    },

    # ==========================================================================
    # Nephrology
    # ==========================================================================
    "ckd staging": {
        "url": "https://www.kidney.org/professionals/kdoqi/gfr_calculator",
        "type": "html",
        "field": "nephrology",
        "category": "staging",
        "description": "CKD staging by GFR"
    },
    "aki staging": {
        "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4777769/",
        "type": "html",
        "field": "nephrology",
        "category": "staging",
        "description": "KDIGO AKI staging"
    },
}


def discover_url(query: str) -> Optional[Dict[str, Any]]:
    """Find URL and metadata for a guideline query.

    Args:
        query: Search query (e.g., "tnm colorectal", "clavien-dindo")

    Returns:
        Source dictionary with url, type, field, category, or None if not found
    """
    query_lower = query.lower().strip()

    # Exact match
    if query_lower in GUIDELINE_SOURCES:
        return GUIDELINE_SOURCES[query_lower]

    # Partial match - check if query is contained in any key
    for key, value in GUIDELINE_SOURCES.items():
        if query_lower in key or key in query_lower:
            return value

    # Fuzzy match - check individual words
    query_words = set(query_lower.split())
    best_match = None
    best_score = 0

    for key, value in GUIDELINE_SOURCES.items():
        key_words = set(key.split())
        overlap = len(query_words & key_words)
        if overlap > best_score:
            best_score = overlap
            best_match = value

    if best_score >= 1:
        return best_match

    return None


def list_sources(field: Optional[str] = None, category: Optional[str] = None) -> list:
    """List available guideline sources with optional filtering.

    Args:
        field: Filter by field (e.g., "oncology", "surgery")
        category: Filter by category (e.g., "staging", "grading")

    Returns:
        List of source dictionaries
    """
    sources = []

    for key, value in GUIDELINE_SOURCES.items():
        if field and value.get("field") != field:
            continue
        if category and value.get("category") != category:
            continue

        sources.append({
            "query": key,
            "field": value.get("field"),
            "category": value.get("category"),
            "url": value.get("url"),
            "description": value.get("description", ""),
        })

    return sources


def list_fields() -> list:
    """List all available medical fields."""
    fields = set()
    for value in GUIDELINE_SOURCES.values():
        if value.get("field"):
            fields.add(value["field"])
    return sorted(fields)


def list_categories() -> list:
    """List all available guideline categories."""
    categories = set()
    for value in GUIDELINE_SOURCES.values():
        if value.get("category"):
            categories.add(value["category"])
    return sorted(categories)
