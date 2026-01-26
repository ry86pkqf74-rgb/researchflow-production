"""
Stage 19: Dissemination

Handles publication and sharing preparation including:
- Submission package generation for target publications
- Plain language summaries for different audiences
- PHI checks on all public-facing content
- Multi-format export preparation

This stage ensures research outputs are ready for safe dissemination
to various stakeholders while maintaining HIPAA compliance.
"""

import hashlib
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stages.stage_19_dissemination")


# PHI patterns for public content scanning
# These are simplified patterns - production would use the full PHI pattern library
PHI_PATTERNS = [
    (r"\b\d{3}-\d{2}-\d{4}\b", "ssn", "Social Security Number"),
    (r"\b\d{9}\b", "ssn_no_dash", "Social Security Number (no dashes)"),
    (r"\b[A-Z]{2}\d{6,8}\b", "mrn", "Medical Record Number"),
    (r"\b\d{3}-\d{3}-\d{4}\b", "phone", "Phone Number"),
    (r"\b\d{10}\b", "phone_no_dash", "Phone Number (no dashes)"),
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "email", "Email Address"),
    (r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", "date", "Date (potential DOB)"),
    (r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b", "date_written", "Written Date"),
    (r"\b\d{5}(?:-\d{4})?\b", "zip", "ZIP Code"),
    (r"\b(?:Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b", "name_with_title", "Name with Title"),
    (r"\bPatient\s+[A-Z][a-z]+\b", "patient_name", "Patient Name Reference"),
    (r"\b[A-Z][a-z]+,\s+[A-Z][a-z]+\s+(?:MD|DO|RN|NP|PA)\b", "provider_name", "Provider Name"),
]

# Publication targets and their requirements
PUBLICATION_TARGETS = {
    "journal_submission": {
        "name": "Academic Journal",
        "required_components": ["manuscript", "abstract", "cover_letter", "author_info", "disclosures"],
        "optional_components": ["supplementary_materials", "data_availability", "code_availability"],
        "format": "docx",
        "phi_strictness": "high",
    },
    "preprint": {
        "name": "Preprint Server",
        "required_components": ["manuscript", "abstract", "author_info"],
        "optional_components": ["supplementary_materials"],
        "format": "pdf",
        "phi_strictness": "high",
    },
    "institutional_repository": {
        "name": "Institutional Repository",
        "required_components": ["manuscript", "abstract", "metadata"],
        "optional_components": ["supplementary_materials", "data_files"],
        "format": "pdf",
        "phi_strictness": "medium",
    },
    "press_release": {
        "name": "Press Release",
        "required_components": ["plain_summary", "key_findings", "contact_info"],
        "optional_components": ["images", "infographics"],
        "format": "docx",
        "phi_strictness": "very_high",
    },
    "patient_facing": {
        "name": "Patient Education Materials",
        "required_components": ["lay_summary", "key_takeaways", "resources"],
        "optional_components": ["faq", "glossary"],
        "format": "pdf",
        "phi_strictness": "very_high",
    },
    "policy_brief": {
        "name": "Policy Brief",
        "required_components": ["executive_summary", "recommendations", "evidence_summary"],
        "optional_components": ["cost_analysis", "implementation_guide"],
        "format": "pdf",
        "phi_strictness": "high",
    },
}

# Audience types for plain language summaries
AUDIENCE_TYPES = {
    "scientific": {
        "reading_level": "graduate",
        "technical_terms": True,
        "statistics_detail": "full",
        "length": "detailed",
    },
    "clinical": {
        "reading_level": "professional",
        "technical_terms": True,
        "statistics_detail": "summary",
        "length": "moderate",
    },
    "general_public": {
        "reading_level": "8th_grade",
        "technical_terms": False,
        "statistics_detail": "simplified",
        "length": "brief",
    },
    "patient": {
        "reading_level": "6th_grade",
        "technical_terms": False,
        "statistics_detail": "minimal",
        "length": "brief",
    },
    "media": {
        "reading_level": "10th_grade",
        "technical_terms": False,
        "statistics_detail": "headline",
        "length": "brief",
    },
    "policy_maker": {
        "reading_level": "professional",
        "technical_terms": "defined",
        "statistics_detail": "summary",
        "length": "moderate",
    },
}


def hash_phi_match(text: str) -> str:
    """Compute SHA256 hash of matched PHI text.

    CRITICAL: Never store raw PHI. Only hashes for deduplication.

    Args:
        text: Matched PHI text

    Returns:
        First 12 characters of SHA256 hash
    """
    return hashlib.sha256(text.encode()).hexdigest()[:12]


def scan_content_for_phi(
    content: str,
    strictness: str = "high",
) -> Tuple[bool, List[Dict[str, Any]]]:
    """Scan text content for PHI patterns.

    Args:
        content: Text content to scan
        strictness: Scan strictness level (medium, high, very_high)

    Returns:
        Tuple of (is_clean, findings_list)
        findings_list contains hash-only records, no raw PHI
    """
    findings: List[Dict[str, Any]] = []

    for pattern, category, description in PHI_PATTERNS:
        matches = re.finditer(pattern, content, re.IGNORECASE)
        for match in matches:
            # CRITICAL: Hash immediately, never store raw match
            match_text = match.group()
            findings.append({
                "category": category,
                "description": description,
                "match_hash": hash_phi_match(match_text),
                "match_length": len(match_text),
                "position": {
                    "start": match.start(),
                    "end": match.end(),
                },
                "context_hash": hash_phi_match(
                    content[max(0, match.start() - 20):min(len(content), match.end() + 20)]
                ),
            })

    # Determine if content is clean based on strictness
    if strictness == "very_high":
        is_clean = len(findings) == 0
    elif strictness == "high":
        # Allow some false positives like dates in citations
        non_date_findings = [f for f in findings if f["category"] not in ("date", "date_written")]
        is_clean = len(non_date_findings) == 0
    else:  # medium
        # Only flag high-confidence PHI
        high_risk_categories = {"ssn", "ssn_no_dash", "mrn", "patient_name", "provider_name"}
        high_risk_findings = [f for f in findings if f["category"] in high_risk_categories]
        is_clean = len(high_risk_findings) == 0

    return is_clean, findings


def generate_submission_package(
    publication_target: str,
    research_content: Dict[str, Any],
    author_info: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate a submission package for the target publication type.

    Args:
        publication_target: Target publication type
        research_content: Research content from prior stages
        author_info: Author information

    Returns:
        Dictionary containing submission package components
    """
    target_config = PUBLICATION_TARGETS.get(publication_target, PUBLICATION_TARGETS["journal_submission"])

    package = {
        "target": publication_target,
        "target_name": target_config["name"],
        "format": target_config["format"],
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "components": {},
        "checklist": [],
        "status": "draft",
    }

    # Generate required components
    for component in target_config["required_components"]:
        package["components"][component] = _generate_component(
            component, research_content, author_info
        )
        package["checklist"].append({
            "component": component,
            "required": True,
            "status": "generated",
        })

    # Mark optional components
    for component in target_config["optional_components"]:
        package["checklist"].append({
            "component": component,
            "required": False,
            "status": "not_generated",
        })

    return package


def _generate_component(
    component: str,
    research_content: Dict[str, Any],
    author_info: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate a specific submission component.

    Args:
        component: Component type
        research_content: Research content
        author_info: Author information

    Returns:
        Component data dictionary
    """
    component_generators = {
        "manuscript": lambda: {
            "title": research_content.get("title", "Research Manuscript"),
            "word_count": research_content.get("word_count", 5000),
            "sections": ["Introduction", "Methods", "Results", "Discussion", "Conclusion"],
            "references_count": research_content.get("references_count", 30),
        },
        "abstract": lambda: {
            "structured": True,
            "word_count": min(300, research_content.get("abstract_length", 250)),
            "sections": ["Background", "Methods", "Results", "Conclusions"],
        },
        "cover_letter": lambda: {
            "addressed_to": "Editor-in-Chief",
            "highlights": research_content.get("key_findings", []),
            "word_count": 400,
        },
        "author_info": lambda: {
            "corresponding_author": author_info.get("corresponding", {}),
            "co_authors": author_info.get("co_authors", []),
            "affiliations": author_info.get("affiliations", []),
            "orcid_ids": author_info.get("orcid_ids", {}),
        },
        "disclosures": lambda: {
            "conflicts_of_interest": author_info.get("coi", "None declared"),
            "funding_sources": author_info.get("funding", []),
            "ethics_approval": research_content.get("ethics_approval", "IRB approved"),
            "data_sharing": research_content.get("data_sharing_statement", "Available upon request"),
        },
        "plain_summary": lambda: {
            "reading_level": "10th_grade",
            "word_count": 200,
            "key_points": research_content.get("key_findings", [])[:3],
        },
        "lay_summary": lambda: {
            "reading_level": "6th_grade",
            "word_count": 150,
            "avoiding_jargon": True,
        },
        "key_findings": lambda: {
            "bullet_points": research_content.get("key_findings", []),
            "significance": research_content.get("significance", "Clinical implications"),
        },
        "key_takeaways": lambda: {
            "for_patients": ["Simple summary point 1", "Simple summary point 2"],
            "action_items": research_content.get("patient_actions", []),
        },
        "contact_info": lambda: {
            "media_contact": author_info.get("media_contact", {}),
            "institution": author_info.get("institution", ""),
        },
        "resources": lambda: {
            "links": research_content.get("resource_links", []),
            "support_contacts": research_content.get("support_contacts", []),
        },
        "metadata": lambda: {
            "keywords": research_content.get("keywords", []),
            "mesh_terms": research_content.get("mesh_terms", []),
            "subject_areas": research_content.get("subject_areas", []),
        },
        "executive_summary": lambda: {
            "word_count": 500,
            "policy_relevance": research_content.get("policy_relevance", ""),
        },
        "recommendations": lambda: {
            "policy_recommendations": research_content.get("recommendations", []),
            "implementation_timeline": "Short-term",
        },
        "evidence_summary": lambda: {
            "evidence_level": research_content.get("evidence_level", "Level II"),
            "study_design": research_content.get("study_design", "Cohort study"),
            "sample_size": research_content.get("sample_size", 0),
        },
    }

    generator = component_generators.get(component, lambda: {"placeholder": True})
    return generator()


def generate_plain_language_summary(
    research_content: Dict[str, Any],
    audience: str,
) -> Dict[str, Any]:
    """Generate a plain language summary for a specific audience.

    Args:
        research_content: Research content from prior stages
        audience: Target audience type

    Returns:
        Dictionary containing the plain language summary
    """
    audience_config = AUDIENCE_TYPES.get(audience, AUDIENCE_TYPES["general_public"])

    # Determine target word count based on length preference
    length_map = {"brief": 150, "moderate": 300, "detailed": 500}
    target_words = length_map.get(audience_config["length"], 200)

    summary = {
        "audience": audience,
        "reading_level": audience_config["reading_level"],
        "word_count_target": target_words,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "content": {
            "title": _simplify_title(
                research_content.get("title", "Research Study"),
                audience_config["technical_terms"]
            ),
            "main_question": _generate_main_question(research_content, audience),
            "what_we_did": _generate_methods_summary(research_content, audience_config),
            "what_we_found": _generate_findings_summary(research_content, audience_config),
            "why_it_matters": _generate_significance_summary(research_content, audience),
        },
        "metadata": {
            "flesch_kincaid_target": _get_reading_level_score(audience_config["reading_level"]),
            "jargon_free": not audience_config["technical_terms"],
        },
    }

    return summary


def _simplify_title(title: str, allow_technical: bool) -> str:
    """Simplify title based on audience requirements."""
    if allow_technical:
        return title
    # In production, would use NLP to simplify
    return title.replace("Retrospective", "").replace("Prospective", "").strip()


def _generate_main_question(content: Dict[str, Any], audience: str) -> str:
    """Generate the main research question for the audience."""
    base_question = content.get("research_question", "What did this study investigate?")
    if audience in ("patient", "general_public"):
        return f"We wanted to find out: {base_question.lower()}"
    return base_question


def _generate_methods_summary(content: Dict[str, Any], config: Dict[str, Any]) -> str:
    """Generate methods summary appropriate for audience."""
    base_methods = content.get("methods_summary", "We conducted a research study.")
    if not config["technical_terms"]:
        return f"We looked at information from {content.get('sample_size', 'many')} people to answer our question."
    return base_methods


def _generate_findings_summary(content: Dict[str, Any], config: Dict[str, Any]) -> str:
    """Generate findings summary appropriate for audience."""
    findings = content.get("key_findings", ["The study found important results."])
    if config["statistics_detail"] == "minimal":
        return findings[0] if findings else "The study found important results."
    return " ".join(findings[:3])


def _generate_significance_summary(content: Dict[str, Any], audience: str) -> str:
    """Generate significance statement for audience."""
    significance = content.get("significance", "This research may help improve healthcare.")
    if audience == "patient":
        return f"This could mean better care for you: {significance}"
    elif audience == "policy_maker":
        return f"Policy implications: {significance}"
    return significance


def _get_reading_level_score(level: str) -> float:
    """Get Flesch-Kincaid grade level target for reading level."""
    level_scores = {
        "6th_grade": 6.0,
        "8th_grade": 8.0,
        "10th_grade": 10.0,
        "professional": 12.0,
        "graduate": 16.0,
    }
    return level_scores.get(level, 10.0)


@register_stage
class Stage19Dissemination:
    """Dissemination Stage.

    This stage prepares research for publication and sharing including:
    - Generating submission packages for target publications
    - Creating plain language summaries for different audiences
    - Performing PHI checks on all public-facing content
    - Preparing multi-format exports

    Dependencies: Stage 14 (Manuscript), Stage 18 (Impact Assessment) recommended
    PHI-Gated: Yes (all outputs must pass PHI scan before export)
    """

    stage_id = 19
    stage_name = "Dissemination"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute dissemination preparation.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with submission packages, summaries, and PHI check results
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings: List[str] = []
        errors: List[str] = []
        artifacts: List[str] = []

        logger.info(f"Running Dissemination for job {context.job_id}")

        try:
            # Get dissemination configuration
            publication_target = context.config.get("publication_target", "journal_submission")
            audience = context.config.get("audience", "scientific")

            # Validate publication target
            if publication_target not in PUBLICATION_TARGETS:
                warnings.append(
                    f"Unknown publication target '{publication_target}', using 'journal_submission'"
                )
                publication_target = "journal_submission"

            # Validate audience
            if audience not in AUDIENCE_TYPES:
                warnings.append(
                    f"Unknown audience '{audience}', using 'general_public'"
                )
                audience = "general_public"

            target_config = PUBLICATION_TARGETS[publication_target]
            logger.info(f"Preparing dissemination for target: {target_config['name']}")

            # Get research content from prior stages or config
            research_content = self._get_research_content(context)
            author_info = context.config.get("author_info", {})

            # Generate submission package
            logger.info("Generating submission package")
            submission_package = generate_submission_package(
                publication_target=publication_target,
                research_content=research_content,
                author_info=author_info,
            )

            # Generate plain language summaries for multiple audiences
            logger.info("Generating plain language summaries")
            summaries = {}

            # Always generate for the requested audience
            summaries[audience] = generate_plain_language_summary(research_content, audience)

            # Also generate patient-facing summary if target requires it
            if publication_target in ("patient_facing", "press_release") and audience != "patient":
                summaries["patient"] = generate_plain_language_summary(research_content, "patient")

            # Generate general public summary if not already done
            if audience not in ("general_public", "patient"):
                summaries["general_public"] = generate_plain_language_summary(
                    research_content, "general_public"
                )

            # Perform PHI check on all public-facing content
            logger.info("Performing PHI check on public-facing content")
            phi_check_result = self._perform_phi_check(
                submission_package=submission_package,
                summaries=summaries,
                strictness=target_config["phi_strictness"],
            )

            # Handle PHI findings
            if not phi_check_result["is_clean"]:
                if context.governance_mode == "PRODUCTION":
                    errors.append(
                        f"PHI detected in public-facing content. "
                        f"Found {phi_check_result['total_findings']} potential PHI instances. "
                        f"Manual review required before dissemination."
                    )
                else:
                    warnings.append(
                        f"DEMO mode: PHI detected ({phi_check_result['total_findings']} findings) "
                        f"but processing continues. Production would require manual review."
                    )

            # Build output
            output = {
                "submission_package": submission_package,
                "summaries": summaries,
                "phi_check_result": phi_check_result,
                "dissemination_status": {
                    "publication_target": publication_target,
                    "target_name": target_config["name"],
                    "audience": audience,
                    "ready_for_submission": phi_check_result["is_clean"],
                    "requires_review": not phi_check_result["is_clean"],
                },
                "next_steps": self._generate_next_steps(
                    phi_check_result["is_clean"],
                    publication_target,
                ),
            }

            # Determine status
            if errors:
                status = "failed"
            elif warnings:
                status = "completed"  # Warnings don't prevent completion
            else:
                status = "completed"

        except Exception as e:
            logger.error(f"Stage 19 execution failed: {e}", exc_info=True)
            errors.append(f"Dissemination preparation failed: {str(e)}")
            status = "failed"
            output = {"error": str(e)}

        # Calculate duration
        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=output,
            artifacts=artifacts,
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "publication_target": publication_target if 'publication_target' in dir() else None,
                "audience": audience if 'audience' in dir() else None,
                "phi_scan_performed": True,
            },
        )

    def _get_research_content(self, context: StageContext) -> Dict[str, Any]:
        """Extract research content from prior stages or config.

        Args:
            context: Stage context with previous results

        Returns:
            Dictionary containing research content
        """
        content = {}

        # Try to get from Stage 14 (Manuscript)
        stage_14_result = context.previous_results.get(14)
        if stage_14_result and stage_14_result.output:
            content.update({
                "title": stage_14_result.output.get("title", ""),
                "abstract": stage_14_result.output.get("abstract", ""),
                "key_findings": stage_14_result.output.get("key_findings", []),
                "word_count": stage_14_result.output.get("word_count", 0),
            })

        # Try to get from Stage 18 (Impact Assessment)
        stage_18_result = context.previous_results.get(18)
        if stage_18_result and stage_18_result.output:
            content["impact_metrics"] = stage_18_result.output.get("impact_metrics", {})

        # Merge with config overrides
        config_content = context.config.get("research_content", {})
        content.update(config_content)

        # Provide defaults for required fields
        if not content.get("title"):
            content["title"] = "Research Study"
        if not content.get("key_findings"):
            content["key_findings"] = [
                "Finding 1: Primary outcome observed",
                "Finding 2: Secondary outcomes measured",
                "Finding 3: Clinical implications identified",
            ]

        return content

    def _perform_phi_check(
        self,
        submission_package: Dict[str, Any],
        summaries: Dict[str, Any],
        strictness: str,
    ) -> Dict[str, Any]:
        """Perform PHI check on all public-facing content.

        Args:
            submission_package: Generated submission package
            summaries: Generated plain language summaries
            strictness: PHI scan strictness level

        Returns:
            Dictionary containing PHI check results (no raw PHI)
        """
        all_findings: List[Dict[str, Any]] = []
        components_checked = 0
        components_clean = 0

        # Convert content to string for scanning
        def content_to_string(obj: Any, prefix: str = "") -> List[Tuple[str, str]]:
            """Recursively extract string content from nested structures."""
            results = []
            if isinstance(obj, str):
                results.append((prefix, obj))
            elif isinstance(obj, dict):
                for key, value in obj.items():
                    results.extend(content_to_string(value, f"{prefix}.{key}"))
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    results.extend(content_to_string(item, f"{prefix}[{i}]"))
            return results

        # Scan submission package
        package_content = content_to_string(submission_package, "submission_package")
        for path, content in package_content:
            if content and len(content) > 10:  # Skip very short strings
                components_checked += 1
                is_clean, findings = scan_content_for_phi(content, strictness)
                if is_clean:
                    components_clean += 1
                else:
                    for finding in findings:
                        finding["source_path"] = path
                        all_findings.append(finding)

        # Scan summaries
        summary_content = content_to_string(summaries, "summaries")
        for path, content in summary_content:
            if content and len(content) > 10:
                components_checked += 1
                is_clean, findings = scan_content_for_phi(content, strictness)
                if is_clean:
                    components_clean += 1
                else:
                    for finding in findings:
                        finding["source_path"] = path
                        all_findings.append(finding)

        # Aggregate findings by category (no raw PHI)
        categories_found: Dict[str, int] = {}
        for finding in all_findings:
            cat = finding["category"]
            categories_found[cat] = categories_found.get(cat, 0) + 1

        return {
            "is_clean": len(all_findings) == 0,
            "strictness": strictness,
            "components_checked": components_checked,
            "components_clean": components_clean,
            "total_findings": len(all_findings),
            "categories_found": categories_found,
            "findings": all_findings,  # Hash-only, no raw PHI
            "scan_timestamp": datetime.utcnow().isoformat() + "Z",
            "recommendation": (
                "Ready for dissemination"
                if len(all_findings) == 0
                else f"Review and remediate {len(all_findings)} potential PHI instances before dissemination"
            ),
        }

    def _generate_next_steps(
        self,
        is_clean: bool,
        publication_target: str,
    ) -> List[str]:
        """Generate next steps based on dissemination status.

        Args:
            is_clean: Whether PHI check passed
            publication_target: Target publication type

        Returns:
            List of next step recommendations
        """
        steps = []

        if not is_clean:
            steps.append("Review and remediate PHI findings in the generated content")
            steps.append("Re-run dissemination stage after PHI remediation")
            return steps

        target_steps = {
            "journal_submission": [
                "Review submission package for completeness",
                "Verify author information and ORCID IDs",
                "Check journal-specific formatting requirements",
                "Submit via journal submission portal",
            ],
            "preprint": [
                "Review preprint for formatting",
                "Select appropriate preprint server (medRxiv, bioRxiv, etc.)",
                "Upload manuscript and supplementary materials",
                "Share preprint link with collaborators",
            ],
            "institutional_repository": [
                "Add required metadata and keywords",
                "Select appropriate access level",
                "Submit to institutional repository",
                "Obtain persistent identifier (DOI)",
            ],
            "press_release": [
                "Review plain language summary for accuracy",
                "Coordinate with institutional communications",
                "Prepare spokesperson for media inquiries",
                "Schedule release timing",
            ],
            "patient_facing": [
                "Review lay summary with patient advocates",
                "Ensure reading level is appropriate",
                "Add relevant resources and support contacts",
                "Distribute through patient channels",
            ],
            "policy_brief": [
                "Review policy recommendations with stakeholders",
                "Identify target policy makers",
                "Prepare executive briefing materials",
                "Schedule policy briefings",
            ],
        }

        steps.extend(target_steps.get(publication_target, [
            "Review generated materials",
            "Proceed with target-specific submission process",
        ]))

        return steps
