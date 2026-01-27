"""Core guideline engine: fetch, parse, and suggest.

This module provides the main entry points for the Stage 20 guideline
processing pipeline. It fetches guidelines from known sources, parses
the content, and generates AI-powered study suggestions.
"""
import re
import httpx
from typing import Optional, Dict, Any, List
from bs4 import BeautifulSoup

from .sources import discover_url, GUIDELINE_SOURCES
from . import cache

# Optional PDF support
try:
    import fitz  # PyMuPDF
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False


async def fetch_guideline(query: str, use_cache: bool = True) -> dict:
    """Fetch guideline content from URL.

    Args:
        query: Guideline query (e.g., "tnm colorectal")
        use_cache: Whether to use Redis cache

    Returns:
        Dictionary with fetch results or error
    """
    # Check cache first
    if use_cache:
        cached = cache.get("fetch", query)
        if cached:
            return {**cached, "from_cache": True}

    # Discover URL for query
    source = discover_url(query)
    if not source:
        return {
            "error": f"No source found for query: {query}",
            "query": query,
            "suggestion": "Try a more specific query or check available sources.",
        }

    url = source["url"]
    content_type = source.get("type", "html")

    try:
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                "User-Agent": "ResearchFlow/1.0 (Medical Research Platform)",
            }
        ) as client:
            response = await client.get(url)
            response.raise_for_status()

            result = {
                "url": url,
                "type": content_type,
                "field": source.get("field"),
                "category": source.get("category"),
                "description": source.get("description"),
                "status_code": response.status_code,
                "content": response.text if content_type == "html" else None,
                "content_bytes": response.content if content_type == "pdf" else None,
                "from_cache": False,
            }

            # Cache the result (excluding binary content)
            if use_cache:
                cache_data = {k: v for k, v in result.items() if k != "content_bytes"}
                cache.set("fetch", query, cache_data)

            return result

    except httpx.TimeoutException:
        return {"error": f"Timeout fetching {url}", "query": query, "url": url}
    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}: {str(e)}", "query": query, "url": url}
    except httpx.HTTPError as e:
        return {"error": str(e), "query": query, "url": url}


def parse_guideline(fetch_result: dict, query: str) -> dict:
    """Parse fetched content into structured JSON.

    Args:
        fetch_result: Result from fetch_guideline()
        query: Original query string

    Returns:
        Parsed guideline structure
    """
    if "error" in fetch_result:
        return fetch_result

    content_type = fetch_result.get("type", "html")

    if content_type == "html":
        return _parse_html(fetch_result, query)
    elif content_type == "pdf" and PDF_SUPPORT:
        return _parse_pdf(fetch_result, query)
    elif content_type == "pdf" and not PDF_SUPPORT:
        return {"error": "PDF parsing not available (PyMuPDF not installed)"}
    else:
        return {"error": f"Unsupported content type: {content_type}"}


def _parse_html(fetch_result: dict, query: str) -> dict:
    """Parse HTML content into structured data.

    Args:
        fetch_result: Fetch result with HTML content
        query: Original query string

    Returns:
        Parsed structure with title, sections, tables, stages
    """
    content = fetch_result.get("content", "")
    if not content:
        return {"error": "No content to parse"}

    soup = BeautifulSoup(content, "lxml")

    # Remove scripts, styles, navigation, etc.
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    # Extract title
    title = None
    for selector in ["h1", "title", ".title", "#title"]:
        element = soup.select_one(selector)
        if element:
            title = element.get_text(strip=True)
            break
    title = title or query

    # Extract main content sections
    sections = []
    for heading in soup.find_all(["h2", "h3", "h4"]):
        section_text = []
        for sibling in heading.find_next_siblings():
            if sibling.name in ["h2", "h3", "h4"]:
                break
            text = sibling.get_text(strip=True)
            if text:
                section_text.append(text)

        if section_text:
            sections.append({
                "heading": heading.get_text(strip=True),
                "level": int(heading.name[1]) if heading.name[1].isdigit() else 2,
                "content": " ".join(section_text)[:2000],  # Limit content length
            })

    # Extract tables (critical for staging/grading)
    tables = []
    for table in soup.find_all("table"):
        rows = []
        for tr in table.find_all("tr"):
            cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
            if cells and any(cells):  # Skip empty rows
                rows.append(cells)
        if rows:
            tables.append(rows)

    # Extract lists (often contain criteria)
    lists = []
    for ul in soup.find_all(["ul", "ol"]):
        items = [li.get_text(strip=True) for li in ul.find_all("li")]
        if items:
            lists.append(items)

    # Extract stage/grade patterns
    full_text = soup.get_text()
    stages = _extract_stages(full_text)

    return {
        "title": title,
        "url": fetch_result.get("url"),
        "field": fetch_result.get("field"),
        "category": fetch_result.get("category"),
        "sections": sections[:15],  # Limit sections
        "tables": tables[:10],  # Limit tables
        "lists": lists[:10],  # Limit lists
        "stages": stages,
        "parsed": True,
    }


def _parse_pdf(fetch_result: dict, query: str) -> dict:
    """Parse PDF content using PyMuPDF.

    Args:
        fetch_result: Fetch result with PDF bytes
        query: Original query string

    Returns:
        Parsed structure
    """
    content_bytes = fetch_result.get("content_bytes")
    if not content_bytes:
        return {"error": "No PDF content to parse"}

    try:
        doc = fitz.open(stream=content_bytes, filetype="pdf")
        text_blocks = []

        for page_num, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                text_blocks.append({
                    "page": page_num + 1,
                    "text": text[:3000],  # Limit per page
                })

        full_text = " ".join([b["text"] for b in text_blocks])
        stages = _extract_stages(full_text)

        return {
            "title": query,
            "url": fetch_result.get("url"),
            "field": fetch_result.get("field"),
            "category": fetch_result.get("category"),
            "pages": len(doc),
            "text_blocks": text_blocks[:30],  # Limit blocks
            "stages": stages,
            "parsed": True,
        }
    except Exception as e:
        return {"error": f"PDF parsing failed: {str(e)}"}


def _extract_stages(text: str) -> List[str]:
    """Extract stage/grade patterns from text.

    Args:
        text: Full text content

    Returns:
        List of unique stages/grades found
    """
    stages = []

    # Stage patterns (0, I, II, III, IV, etc.)
    stage_patterns = [
        r"Stage\s+(0|I{1,3}V?|IV[ABC]?|[0-4][ABC]?)",
        r"T([0-4]|is|x)\s*N([0-3]|x)\s*M([0-1]|x)",  # TNM notation
    ]

    for pattern in stage_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            stage = match.group(0).strip()
            if stage and stage not in stages:
                stages.append(stage)

    # Grade patterns (I, II, III, IV, V, 1, 2, 3, etc.)
    grade_pattern = r"Grade\s+(I{1,3}V?|V|[1-5]|[A-D])"
    for match in re.finditer(grade_pattern, text, re.IGNORECASE):
        grade = f"Grade {match.group(1).upper()}"
        if grade not in stages:
            stages.append(grade)

    # Class patterns (for ASA, NYHA, etc.)
    class_pattern = r"Class\s+(I{1,3}V?|[1-4]|[A-E])"
    for match in re.finditer(class_pattern, text, re.IGNORECASE):
        cls = f"Class {match.group(1).upper()}"
        if cls not in stages:
            stages.append(cls)

    # Score/Level patterns
    level_pattern = r"Level\s+([1-5]|[A-E])"
    for match in re.finditer(level_pattern, text, re.IGNORECASE):
        level = f"Level {match.group(1).upper()}"
        if level not in stages:
            stages.append(level)

    return stages[:20]  # Limit to prevent excessive results


def suggest_validation_and_ideation(parsed_json: dict, field: Optional[str] = None) -> dict:
    """Generate study suggestions based on parsed guideline.

    This provides placeholder/rule-based suggestions. For AI-powered
    suggestions, integrate with the AI Router.

    Args:
        parsed_json: Parsed guideline structure
        field: Optional field override

    Returns:
        Dictionary with manuscript ideas, validation studies, etc.
    """
    if "error" in parsed_json:
        return parsed_json

    title = parsed_json.get("title", "Unknown Guideline")
    category = parsed_json.get("category", "classification")
    stages = parsed_json.get("stages", [])
    field = field or parsed_json.get("field", "general")

    suggestions = {
        "title": title,
        "field": field,
        "category": category,
        "manuscript_ideas": [],
        "validation_studies": [],
        "questions_to_consider": [],
        "reporting_checklist": [],
        "statistical_methods": [],
    }

    # Category-specific suggestions
    if category == "staging":
        suggestions["manuscript_ideas"] = [
            f"External validation of {title} in [your population]",
            f"Prognostic accuracy of {title} for [outcome] prediction",
            f"Comparison of {title} with alternative staging systems",
            f"Stage migration analysis using {title}",
            f"Real-world validation of {title} staging criteria",
        ]
        suggestions["validation_studies"] = [
            {"type": "External validation", "metrics": ["C-index", "Calibration slope", "Brier score"]},
            {"type": "Temporal validation", "metrics": ["AUC stability over time"]},
            {"type": "Subgroup analysis", "metrics": ["Discrimination by subgroup"]},
            {"type": "Stage migration", "metrics": ["Migration patterns", "Stage-specific survival"]},
        ]
        suggestions["reporting_checklist"] = ["TRIPOD", "STROBE"]
        suggestions["statistical_methods"] = [
            "Kaplan-Meier survival analysis",
            "Cox proportional hazards regression",
            "Harrell's C-index",
            "Calibration plots",
        ]

    elif category == "grading":
        suggestions["manuscript_ideas"] = [
            f"Inter-rater reliability of {title} classification",
            f"Association between {title} grades and [outcome]",
            f"Institutional comparison of {title} distribution",
            f"Predictive validity of {title} for complications",
            f"Implementation of {title} in clinical practice",
        ]
        suggestions["validation_studies"] = [
            {"type": "Reliability study", "metrics": ["Kappa coefficient", "ICC", "Agreement percentage"]},
            {"type": "Predictive validity", "metrics": ["OR/HR per grade", "C-statistic"]},
            {"type": "Construct validity", "metrics": ["Correlation with outcomes"]},
        ]
        suggestions["reporting_checklist"] = ["STROBE", "RECORD"]
        suggestions["statistical_methods"] = [
            "Weighted kappa for inter-rater agreement",
            "Intraclass correlation coefficient (ICC)",
            "Ordinal logistic regression",
        ]

    elif category == "classification":
        suggestions["manuscript_ideas"] = [
            f"Clinical utility of {title} in treatment decisions",
            f"Outcome prediction using {title} categories",
            f"Validation of {title} in [specific population]",
            f"Simplification or modification of {title}",
            f"Implementation study of {title} adoption",
        ]
        suggestions["validation_studies"] = [
            {"type": "Criterion validity", "metrics": ["Sensitivity", "Specificity", "PPV", "NPV"]},
            {"type": "Predictive validity", "metrics": ["AUC-ROC", "Decision curve analysis"]},
            {"type": "Clinical utility", "metrics": ["Net benefit", "NNT/NNH"]},
        ]
        suggestions["reporting_checklist"] = ["STROBE", "TRIPOD"]
        suggestions["statistical_methods"] = [
            "ROC curve analysis",
            "Decision curve analysis",
            "Net reclassification improvement (NRI)",
        ]

    elif category == "score":
        suggestions["manuscript_ideas"] = [
            f"External validation of {title} in new cohort",
            f"Recalibration of {title} for contemporary practice",
            f"Head-to-head comparison of {title} with alternatives",
            f"Machine learning enhancement of {title}",
            f"Risk threshold optimization for {title}",
        ]
        suggestions["validation_studies"] = [
            {"type": "Discrimination", "metrics": ["AUC-ROC", "C-statistic"]},
            {"type": "Calibration", "metrics": ["Hosmer-Lemeshow", "Calibration plots"]},
            {"type": "Clinical usefulness", "metrics": ["Decision curve analysis"]},
        ]
        suggestions["reporting_checklist"] = ["TRIPOD", "PROBAST"]
        suggestions["statistical_methods"] = [
            "Model calibration assessment",
            "Discrimination analysis",
            "Risk reclassification analysis",
        ]

    # Add stage-specific questions
    if stages:
        stage_list = ", ".join(stages[:5])
        suggestions["questions_to_consider"] = [
            f"What is the distribution of {stage_list} in your cohort?",
            "How does stage migration affect outcome analysis?",
            "Are there sufficient events per stage for reliable estimates?",
            "Should stages be collapsed for analysis?",
            "How do your staging patterns compare to reference populations?",
        ]
    else:
        suggestions["questions_to_consider"] = [
            "What is the distribution of categories in your cohort?",
            "Are there sufficient events per category for analysis?",
            "How do your patterns compare to published benchmarks?",
        ]

    return suggestions


async def process_query(query: str, use_cache: bool = True) -> dict:
    """Main entry point: fetch, parse, and suggest.

    Args:
        query: Guideline query string
        use_cache: Whether to use Redis cache

    Returns:
        Complete result with parsed data and suggestions
    """
    # Fetch guideline content
    fetch_result = await fetch_guideline(query, use_cache=use_cache)
    if "error" in fetch_result:
        return fetch_result

    # Parse the content
    parsed = parse_guideline(fetch_result, query)
    if "error" in parsed:
        return parsed

    # Generate suggestions
    suggestions = suggest_validation_and_ideation(parsed)

    return {
        "query": query,
        "parsed": parsed,
        "suggestions": suggestions,
        "from_cache": fetch_result.get("from_cache", False),
    }
