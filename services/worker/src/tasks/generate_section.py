"""Generate manuscript sections using AI prompts.

Each section has a corresponding prompt template with medical/surgical tone.
All inputs and outputs are PHI-scanned before processing.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

from src.security.phi_guard import assert_no_phi, PhiBlocked

logger = logging.getLogger(__name__)

# Section to prompt mapping
SECTION_TO_PROMPT: Dict[str, str] = {
    "TITLE": "manuscript/title_v1",
    "ABSTRACT": "manuscript/abstract_v1",
    "INTRODUCTION": "manuscript/introduction_v1",
    "METHODS": "manuscript/methods_v1",
    "RESULTS": "manuscript/results_v1",
    "DISCUSSION": "manuscript/discussion_v1",
    "ACKNOWLEDGEMENTS": "manuscript/acknowledgements_v1",
    "CONFLICTS": "manuscript/conflicts_v1",
}

# Medical/surgical tone system prompts
SECTION_SYSTEM_PROMPTS: Dict[str, str] = {
    "INTRODUCTION": """You are a medical research co-author writing in a concise academic surgical tone.
Write an INTRODUCTION section with:
1) Background (what is known about this topic)
2) Gap (what is currently unknown or debated)
3) Study objective (clear, measurable aims)

Rules:
- Never include patient identifiers or PHI
- Prefer active voice, precise endpoints, and standard surgical terminology
- Avoid speculation - use cautious language ("may suggest", "appears to")
- Use placeholders like [CITATION_1] when a citation is implied
- Do not invent data or statistics""",

    "ABSTRACT": """You are a medical research co-author writing a structured abstract.
Write an ABSTRACT section with:
1) Background/Purpose
2) Methods (study design, population, interventions)
3) Results (key findings with statistics)
4) Conclusions

Rules:
- Maximum 250-350 words depending on journal style
- Never include patient identifiers
- Be precise with statistics (p-values, confidence intervals)
- Use past tense for methods and results
- Use present tense for conclusions""",

    "METHODS": """You are a medical research co-author writing a Methods section.
Write a METHODS section with:
1) Study Design
2) Participants/Population
3) Interventions/Exposures
4) Outcomes (primary, secondary)
5) Statistical Analysis

Rules:
- Use past tense throughout
- Include IRB/ethics approval reference placeholder
- Specify inclusion/exclusion criteria clearly
- Detail statistical tests used
- Reference data analysis tools used""",

    "RESULTS": """You are a medical research co-author writing a Results section.
Write a RESULTS section that:
1) Describes the study population
2) Presents primary outcomes first
3) Presents secondary outcomes
4) Reports statistical findings with precision

Rules:
- Use past tense throughout
- Include confidence intervals, not just p-values
- Reference tables and figures (e.g., "Table 1", "Figure 2")
- Report exact p-values when possible (p=0.023 not p<0.05)
- Do not interpret results - save that for Discussion""",

    "DISCUSSION": """You are a medical research co-author writing a Discussion section.
Write a DISCUSSION section with:
1) Summary of key findings
2) Comparison with existing literature
3) Strengths of the study
4) Limitations
5) Clinical implications
6) Future directions

Rules:
- Start with the main finding
- Use hedged language for interpretations
- Acknowledge limitations honestly
- Connect findings to clinical practice
- Reference [CITATION_N] for literature comparisons""",
}


def build_context(inputs: Dict[str, Any]) -> str:
    """Build context string from input references.

    Fetches internal summaries and metadata from reference pointers.
    All data should already be de-identified.
    """
    context_parts = []

    # Literature summary references
    if inputs.get("litSummaryRefs"):
        context_parts.append("## Literature Context")
        for ref in inputs["litSummaryRefs"]:
            # In production, fetch actual summary from storage
            context_parts.append(f"- Reference: {ref}")

    # Data metadata references
    if inputs.get("dataMetadataRefs"):
        context_parts.append("\n## Dataset Context")
        for ref in inputs["dataMetadataRefs"]:
            # In production, fetch de-identified metadata
            context_parts.append(f"- Dataset: {ref}")

    # Artifact references (figures, tables)
    if inputs.get("artifactRefs"):
        context_parts.append("\n## Artifacts Available")
        for ref in inputs["artifactRefs"]:
            context_parts.append(f"- Artifact: {ref}")

    # Journal style hint
    if inputs.get("journalStyleId"):
        context_parts.append(f"\n## Target Journal: {inputs['journalStyleId']}")

    return "\n".join(context_parts) if context_parts else "No additional context provided."


def run_prompt(
    prompt_id: str,
    context: str,
    constraints: Optional[Dict[str, Any]] = None
) -> str:
    """Run an AI prompt with the given context.

    This is a stub that should integrate with the actual AI router.
    """
    # Import AI router (adjust path as needed)
    try:
        from src.llm.providers.anthropic_provider import AnthropicProvider
        from src.llm.providers.openai_provider import OpenAIProvider
    except ImportError:
        logger.warning("AI providers not available, using stub response")
        return _stub_response(prompt_id, context, constraints)

    # Get section from prompt_id
    section = prompt_id.split("/")[1].split("_")[0].upper()
    system_prompt = SECTION_SYSTEM_PROMPTS.get(section, "You are a medical research assistant.")

    # Build user prompt
    user_prompt = f"""Based on the following context, generate a {section} section for a medical manuscript.

{context}

Constraints:
- Word target: {constraints.get('wordTarget', 'appropriate for section') if constraints else 'appropriate for section'}
- Citation style: {constraints.get('citationStyle', 'vancouver') if constraints else 'vancouver'}
- Tone: {constraints.get('tone', 'medical_surgical') if constraints else 'medical_surgical'}

Generate only the {section} section content. Do not include section headers."""

    # Try Anthropic first, then OpenAI
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    if anthropic_key:
        try:
            provider = AnthropicProvider()
            return provider.complete(system_prompt, user_prompt)
        except Exception as e:
            logger.warning(f"Anthropic provider failed: {e}")

    if openai_key:
        try:
            provider = OpenAIProvider()
            return provider.complete(system_prompt, user_prompt)
        except Exception as e:
            logger.warning(f"OpenAI provider failed: {e}")

    # Fallback to stub
    return _stub_response(prompt_id, context, constraints)


def _stub_response(
    prompt_id: str,
    context: str,
    constraints: Optional[Dict[str, Any]] = None
) -> str:
    """Generate a stub response for testing when AI providers are unavailable."""
    section = prompt_id.split("/")[1].split("_")[0].upper()
    word_target = constraints.get("wordTarget", 200) if constraints else 200

    stub_text = {
        "INTRODUCTION": f"""[GENERATED INTRODUCTION - {word_target} words target]

Background: This study addresses an important clinical question in surgical practice.

Gap: Current evidence regarding this topic remains limited, with conflicting findings reported across studies [CITATION_1, CITATION_2].

Objective: We aimed to investigate the relationship between the intervention and clinical outcomes in a well-defined patient population.""",

        "ABSTRACT": f"""[GENERATED ABSTRACT - {word_target} words target]

Background: [Study rationale]
Methods: [Study design and population]
Results: [Key findings with statistics]
Conclusions: [Main takeaways]""",

        "METHODS": f"""[GENERATED METHODS - {word_target} words target]

Study Design: This was a retrospective cohort study.
Population: Patients meeting inclusion criteria were enrolled.
Outcomes: Primary and secondary endpoints were defined.
Statistical Analysis: Appropriate statistical tests were used.""",

        "RESULTS": f"""[GENERATED RESULTS - {word_target} words target]

Population: A total of N patients were included.
Primary Outcome: The primary endpoint was observed in X% of patients.
Secondary Outcomes: Additional findings are presented in Table 1.""",

        "DISCUSSION": f"""[GENERATED DISCUSSION - {word_target} words target]

Our findings suggest important clinical implications.
Compared to prior literature, these results are consistent with [CITATION_N].
Limitations include the retrospective design.
Future studies should address remaining questions.""",
    }

    return stub_text.get(section, f"[GENERATED {section} CONTENT]")


def run_generate_section(job_id: str) -> Dict[str, Any]:
    """Run section generation for a manuscript job.

    Args:
        job_id: The job ID to process

    Returns:
        Result dict with generated content
    """
    # In production, fetch job from orchestrator
    # For now, we expect job data to be passed directly
    logger.info(f"Generating section for job {job_id}")

    # This would normally fetch from orchestrator
    # job = get_job(job_id)
    # req = job["request_json"]

    # For testing, return a stub result
    return {
        "jobId": job_id,
        "status": "SUCCEEDED",
        "contentMd": "[Generated content placeholder]",
    }


def generate_section(
    job_id: str,
    manuscript_id: str,
    section_key: str,
    inputs: Dict[str, Any],
    constraints: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate a manuscript section.

    Args:
        job_id: Job identifier
        manuscript_id: Manuscript identifier
        section_key: Section to generate (INTRODUCTION, ABSTRACT, etc.)
        inputs: Input references (litSummaryRefs, dataMetadataRefs, etc.)
        constraints: Generation constraints (wordTarget, tone, citationStyle)

    Returns:
        Dict with generated content and metadata

    Raises:
        PhiBlocked: If PHI is detected in inputs or outputs
    """
    prompt_id = SECTION_TO_PROMPT.get(section_key)
    if not prompt_id:
        return {
            "jobId": job_id,
            "status": "FAILED",
            "error": f"Unknown section key: {section_key}",
        }

    try:
        # Build context from input references
        context_text = build_context(inputs)

        # PHI scan context
        assert_no_phi(f"context:{section_key}", context_text)

        # Generate content
        output_md = run_prompt(prompt_id, context_text, constraints)

        # PHI scan output
        assert_no_phi(f"output:{section_key}", output_md)

        return {
            "jobId": job_id,
            "manuscriptId": manuscript_id,
            "sectionKey": section_key,
            "status": "SUCCEEDED",
            "contentMd": output_md,
            "wordCount": len(output_md.split()),
        }

    except PhiBlocked as e:
        logger.warning(f"PHI blocked in section generation: {e}")
        return {
            "jobId": job_id,
            "status": "BLOCKED",
            "error": "PHI_BLOCKED",
            "locations": [loc.__dict__ for loc in e.locations],
        }
    except Exception as e:
        logger.exception(f"Section generation failed: {e}")
        return {
            "jobId": job_id,
            "status": "FAILED",
            "error": str(e),
        }
