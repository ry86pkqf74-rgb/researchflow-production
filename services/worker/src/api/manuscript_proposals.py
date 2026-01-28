"""
Manuscript Proposal Generation Endpoint

Generates manuscript proposals using LLM with structured output.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import json
import httpx
import os
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/manuscript/generate", tags=["manuscript"])

# Configuration
AI_ROUTER_URL = os.getenv("AI_ROUTER_URL", "http://orchestrator:3001/api/ai")
DEFAULT_MODEL = os.getenv("CHAT_AGENT_MODEL", "gpt-4")


class ProposalInput(BaseModel):
    topic: str = Field(..., min_length=10, description="Research topic")
    domain: Optional[str] = Field(None, description="Research domain")
    population: Optional[str] = Field(None, description="Target population")
    outcome: Optional[str] = Field(None, description="Primary outcome")
    refinement_notes: Optional[str] = Field(None, description="Notes for refinement")
    previous_proposal_id: Optional[int] = Field(None, description="ID of proposal to refine")
    mode: str = Field("live", description="demo or live mode")


class ManuscriptProposal(BaseModel):
    id: int
    title: str
    abstract: str
    relevanceScore: int = Field(..., ge=0, le=100)
    noveltyScore: int = Field(..., ge=0, le=100)
    feasibilityScore: int = Field(..., ge=0, le=100)
    methodology: str
    expectedOutcome: str
    suggestedJournals: List[str]
    keywords: List[str]


class ProposalOutput(BaseModel):
    proposals: List[ManuscriptProposal]
    metadata: Optional[dict] = None


def build_generation_prompt(input_data: ProposalInput) -> str:
    """Build the LLM prompt for proposal generation."""

    pico_parts = []
    if input_data.population:
        pico_parts.append(f"Population: {input_data.population}")
    if input_data.outcome:
        pico_parts.append(f"Outcome: {input_data.outcome}")

    pico_section = "\n".join(pico_parts) if pico_parts else "Not specified"

    refinement_section = ""
    if input_data.refinement_notes:
        refinement_section = f"""
REFINEMENT REQUEST:
The user wants to refine the proposals based on these notes:
{input_data.refinement_notes}

Please generate new proposals that address these refinement requests.
"""

    prompt = f"""You are a research methodology expert. Generate 5 high-quality manuscript proposal ideas for the following research topic.

RESEARCH TOPIC: {input_data.topic}
RESEARCH DOMAIN: {input_data.domain or 'General Medicine/Health Sciences'}
PICO ELEMENTS:
{pico_section}
{refinement_section}

For each proposal, provide:
1. A compelling, specific title (max 200 characters)
2. A detailed abstract (150-250 words) describing the study
3. Relevance score (0-100): How relevant is this to the stated topic?
4. Novelty score (0-100): How novel/innovative is this approach?
5. Feasibility score (0-100): How feasible is this study to conduct?
6. Methodology: Brief description of study design and methods
7. Expected outcome: What the study will produce
8. Suggested journals: 2-4 appropriate target journals
9. Keywords: 4-6 relevant keywords

Generate diverse proposals covering different methodological approaches:
- At least one systematic review/meta-analysis
- At least one retrospective cohort study
- At least one with novel methodology (ML, qualitative, economic analysis)

Respond ONLY with a valid JSON object in this exact format:
{{
  "proposals": [
    {{
      "id": 1,
      "title": "...",
      "abstract": "...",
      "relevanceScore": 85,
      "noveltyScore": 78,
      "feasibilityScore": 82,
      "methodology": "...",
      "expectedOutcome": "...",
      "suggestedJournals": ["Journal 1", "Journal 2"],
      "keywords": ["keyword1", "keyword2"]
    }}
  ]
}}

IMPORTANT:
- Return ONLY the JSON object, no markdown, no explanation
- Ensure all scores are integers between 0 and 100
- Ensure IDs are sequential integers starting from 1
"""
    return prompt


async def call_ai_router(prompt: str) -> dict:
    """Call the AI router to generate proposals."""

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{AI_ROUTER_URL}/router/chat",
            json={
                "prompt": prompt,
                "model": DEFAULT_MODEL,
                "temperature": 0.7,
                "max_tokens": 4000,
            }
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"AI router error: {response.text}"
            )

        return response.json()


def parse_and_validate_response(response_text: str) -> List[ManuscriptProposal]:
    """Parse LLM response and validate against schema."""

    # Clean response (remove markdown if present)
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM response as JSON: {str(e)}"
        )

    if "proposals" not in data:
        raise HTTPException(
            status_code=500,
            detail="LLM response missing 'proposals' field"
        )

    # Validate and fix each proposal
    validated_proposals = []
    for i, proposal in enumerate(data["proposals"], start=1):
        # Ensure ID is set
        proposal["id"] = proposal.get("id", i)

        # Clamp scores to valid range
        for score_field in ["relevanceScore", "noveltyScore", "feasibilityScore"]:
            if score_field in proposal:
                proposal[score_field] = max(0, min(100, int(proposal[score_field])))
            else:
                proposal[score_field] = 75  # Default score

        # Ensure arrays exist
        if "suggestedJournals" not in proposal or not isinstance(proposal["suggestedJournals"], list):
            proposal["suggestedJournals"] = []
        if "keywords" not in proposal or not isinstance(proposal["keywords"], list):
            proposal["keywords"] = []

        try:
            validated = ManuscriptProposal(**proposal)
            validated_proposals.append(validated)
        except Exception as e:
            print(f"Warning: Proposal {i} validation failed: {e}")
            continue

    if not validated_proposals:
        raise HTTPException(
            status_code=500,
            detail="No valid proposals could be extracted from LLM response"
        )

    return validated_proposals


@router.post("/proposals", response_model=ProposalOutput)
async def generate_proposals(input_data: ProposalInput):
    """
    Generate manuscript proposals based on research topic and criteria.

    - **topic**: The main research topic (required)
    - **domain**: Research domain/specialty (optional)
    - **population**: Target population for PICO (optional)
    - **outcome**: Primary outcome measure (optional)
    - **refinement_notes**: Notes for refining previous proposals (optional)
    - **mode**: 'demo' or 'live' mode
    """

    start_time = datetime.now()

    # Build prompt
    prompt = build_generation_prompt(input_data)

    # Call AI router
    ai_response = await call_ai_router(prompt)

    # Extract generated text
    generated_text = ai_response.get("text", "") or ai_response.get("content", "")
    if not generated_text:
        raise HTTPException(
            status_code=500,
            detail="AI router returned empty response"
        )

    # Parse and validate
    proposals = parse_and_validate_response(generated_text)

    # Calculate latency
    latency_ms = int((datetime.now() - start_time).total_seconds() * 1000)

    return ProposalOutput(
        proposals=proposals,
        metadata={
            "modelUsed": ai_response.get("model", DEFAULT_MODEL),
            "tokensUsed": ai_response.get("usage", {}).get("total_tokens"),
            "latencyMs": latency_ms,
            "generatedAt": datetime.now().isoformat(),
        }
    )
