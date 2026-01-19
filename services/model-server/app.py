"""
Model Server for BioBERT Medical Entity Recognition
Phase A - Task 7: Host Hugging Face Models Locally

Provides REST API for medical entity extraction using BioBERT.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
import torch
from typing import List, Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ResearchFlow Model Server",
    description="BioBERT-based medical entity recognition service",
    version="1.0.0"
)

# Global model pipeline (loaded once at startup)
ner_pipeline = None
MODEL_NAME = "dmis-lab/biobert-base-cased-v1.1"


class EntityExtractionRequest(BaseModel):
    """Request model for entity extraction"""
    text: str = Field(..., min_length=1, max_length=10000, description="Text to extract entities from")
    aggregation_strategy: str = Field(default="simple", description="How to aggregate tokens into entities")


class Entity(BaseModel):
    """Individual extracted entity"""
    word: str
    entity_group: str
    score: float
    start: int
    end: int


class EntityExtractionResponse(BaseModel):
    """Response model for entity extraction"""
    entities: List[Entity]
    model: str
    text_length: int


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model: str
    device: str


@app.on_event("startup")
async def load_model():
    """Load BioBERT model at startup"""
    global ner_pipeline

    try:
        logger.info(f"Loading model: {MODEL_NAME}")

        # Load tokenizer and model
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        model = AutoModelForTokenClassification.from_pretrained(MODEL_NAME)

        # Determine device (CPU for now, GPU if available)
        device = 0 if torch.cuda.is_available() else -1
        device_name = "cuda" if device == 0 else "cpu"

        # Create NER pipeline
        ner_pipeline = pipeline(
            "ner",
            model=model,
            tokenizer=tokenizer,
            device=device,
            aggregation_strategy="simple"
        )

        logger.info(f"Model loaded successfully on {device_name}")

    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    if ner_pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    device_name = "cuda" if torch.cuda.is_available() else "cpu"

    return HealthResponse(
        status="ok",
        model=MODEL_NAME,
        device=device_name
    )


@app.post("/extract", response_model=EntityExtractionResponse)
async def extract_entities(request: EntityExtractionRequest):
    """
    Extract medical entities from text using BioBERT

    Entity types include:
    - DISEASE: Medical conditions, diseases, syndromes
    - DRUG: Medications, treatments
    - SYMPTOM: Clinical symptoms
    - GENE: Gene names
    - PROTEIN: Protein names
    """
    if ner_pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        # Run entity extraction
        logger.info(f"Processing text of length {len(request.text)}")

        entities = ner_pipeline(request.text, aggregation_strategy=request.aggregation_strategy)

        # Convert to response model
        entity_objects = [
            Entity(
                word=ent["word"],
                entity_group=ent["entity_group"],
                score=ent["score"],
                start=ent["start"],
                end=ent["end"]
            )
            for ent in entities
        ]

        logger.info(f"Extracted {len(entity_objects)} entities")

        return EntityExtractionResponse(
            entities=entity_objects,
            model=MODEL_NAME,
            text_length=len(request.text)
        )

    except Exception as e:
        logger.error(f"Entity extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Entity extraction failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ResearchFlow Model Server",
        "model": MODEL_NAME,
        "endpoints": {
            "health": "/health",
            "extract": "/extract (POST)",
            "docs": "/docs"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
