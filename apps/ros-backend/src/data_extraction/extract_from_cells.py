"""
Cell Extraction Module - LLM-powered clinical data extraction.
All LLM calls go through the AI Router for governance compliance.
"""

import os
import json
import asyncio
import hashlib
import time
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
import httpx
from pydantic import ValidationError

from .schemas import (
    ClinicalExtraction, NoteClassification, NoteType,
    ExtractionResponse, get_clinical_extraction_schema, get_note_classification_schema,
)

AI_ROUTER_URL = os.getenv("AI_ROUTER_URL", "http://localhost:3001/api/ai/route")
REQUEST_TIMEOUT = int(os.getenv("EXTRACTION_TIMEOUT_SECONDS", "60"))
NANO_MAX_CHARS = 400
MINI_MAX_CHARS = 3000


class ExtractionError(Exception):
    def __init__(self, message: str, tier: str, request_id: Optional[str] = None):
        super().__init__(message)
        self.tier = tier
        self.request_id = request_id


def choose_tier(text: str, force_tier: Optional[str] = None) -> str:
    if force_tier and force_tier in ("NANO", "MINI", "FRONTIER"):
        return force_tier
    n = len(text)
    if n < NANO_MAX_CHARS:
        return "NANO"
    if n < MINI_MAX_CHARS:
        return "MINI"
    return "FRONTIER"


def get_escalation_tier(current_tier: str) -> Optional[str]:
    return {"NANO": "MINI", "MINI": "FRONTIER", "FRONTIER": None}.get(current_tier)


def generate_request_id() -> str:
    timestamp = datetime.utcnow().isoformat()
    random_bytes = os.urandom(8).hex()
    return f"ext_{hashlib.sha256(f'{timestamp}{random_bytes}'.encode()).hexdigest()[:16]}"


async def ai_route_json(
    task: str, text: str, schema: dict, tier: str, metadata: Dict[str, Any], request_id: str,
) -> Tuple[dict, dict]:
    payload = {
        "task": task, "tier": tier, "input": text, "schema": schema,
        "metadata": {**metadata, "request_id": request_id, "timestamp": datetime.utcnow().isoformat()},
        "return_format": "json",
    }
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            response = await client.post(AI_ROUTER_URL, json=payload, headers={"X-Request-ID": request_id})
            response.raise_for_status()
            result = response.json()
            return result.get("output", {}), {
                "tier_used": result.get("tier_used", tier),
                "provider": result.get("provider", "unknown"),
                "model": result.get("model", "unknown"),
                "tokens": result.get("tokens", {"input": 0, "output": 0}),
                "cost_usd": result.get("cost_usd", 0.0),
            }
        except httpx.HTTPStatusError as e:
            raise ExtractionError(f"AI Router error: {e.response.status_code}", tier, request_id)
        except httpx.RequestError as e:
            raise ExtractionError(f"Connection error: {str(e)}", tier, request_id)


def repair_json(malformed: str) -> dict:
    import re
    cleaned = malformed.strip()
    for fence in ["```json", "```"]:
        if cleaned.startswith(fence):
            cleaned = cleaned[len(fence):]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    try:
        fixed = re.sub(r",\s*}", "}", cleaned)
        fixed = re.sub(r",\s*]", "]", fixed)
        return json.loads(fixed)
    except json.JSONDecodeError:
        return {}


async def classify_note_type(text: str, metadata: Dict[str, Any], request_id: str) -> NoteClassification:
    output, _ = await ai_route_json(
        "note_type_classify", text[:1000], get_note_classification_schema(),
        "NANO", {**metadata, "pass": "A_classify"}, request_id,
    )
    try:
        return NoteClassification.model_validate(output)
    except ValidationError:
        return NoteClassification(note_type=NoteType.OTHER, rationale="Classification failed", confidence=0.0)


async def extract_clinical_from_cell(
    cell_text: str, metadata: Optional[Dict[str, Any]] = None,
    force_tier: Optional[str] = None, skip_classification: bool = False,
) -> ExtractionResponse:
    start_time = time.time()
    request_id = generate_request_id()
    metadata = metadata or {}
    
    note_type = None
    if not skip_classification and len(cell_text) > 200:
        try:
            classification = await classify_note_type(cell_text, metadata, request_id)
            note_type = classification.note_type
        except ExtractionError:
            pass
    
    tier = choose_tier(cell_text, force_tier)
    schema = get_clinical_extraction_schema()
    extraction = None
    response_meta = None
    
    for attempt in range(3):
        try:
            output, response_meta = await ai_route_json(
                "clinical_cell_extract", cell_text, schema, tier,
                {**metadata, "pass": "B_extract", "attempt": attempt + 1}, request_id,
            )
            try:
                extraction = ClinicalExtraction.model_validate(output)
                if note_type and not extraction.note_type:
                    extraction.note_type = note_type
                break
            except ValidationError:
                repaired = repair_json(json.dumps(output) if isinstance(output, dict) else str(output))
                if repaired:
                    try:
                        extraction = ClinicalExtraction.model_validate(repaired)
                        extraction.warnings.append("JSON repair was required")
                        break
                    except ValidationError:
                        pass
                next_tier = get_escalation_tier(tier)
                if next_tier:
                    tier = next_tier
                else:
                    extraction = ClinicalExtraction(confidence=0.1, warnings=["Validation failed"])
                    break
        except ExtractionError:
            next_tier = get_escalation_tier(tier)
            if next_tier:
                tier = next_tier
            else:
                raise
    
    return ExtractionResponse(
        extraction=extraction or ClinicalExtraction(confidence=0.0, warnings=["Extraction failed"]),
        tier_used=response_meta.get("tier_used", tier) if response_meta else tier,
        provider=response_meta.get("provider", "unknown") if response_meta else "unknown",
        model=response_meta.get("model", "unknown") if response_meta else "unknown",
        tokens=response_meta.get("tokens", {"input": 0, "output": 0}) if response_meta else {"input": 0, "output": 0},
        cost_usd=response_meta.get("cost_usd", 0.0) if response_meta else 0.0,
        request_id=request_id,
        processing_time_ms=int((time.time() - start_time) * 1000),
    )


async def extract_batch(cells: list[dict], concurrency: int = 5) -> list[ExtractionResponse]:
    semaphore = asyncio.Semaphore(concurrency)
    async def extract_one(cell: dict) -> ExtractionResponse:
        async with semaphore:
            return await extract_clinical_from_cell(cell.get("text", ""), cell.get("metadata", {}))
    return await asyncio.gather(*[extract_one(cell) for cell in cells])


def extract_sync(cell_text: str, metadata: Optional[Dict[str, Any]] = None) -> ExtractionResponse:
    return asyncio.run(extract_clinical_from_cell(cell_text, metadata))
