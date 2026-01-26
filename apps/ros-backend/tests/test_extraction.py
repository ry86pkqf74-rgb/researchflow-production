"""
Unit tests for the data extraction module.

These tests verify the extraction logic, schema validation, and
error handling without making actual API calls.
"""

import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

# Import the modules we're testing
import sys
sys.path.insert(0, '../src')

from data_extraction.schemas import (
    ClinicalExtraction,
    NoteClassification,
    NoteType,
    Evidence,
    CodedTerm,
    MedicationEntry,
    ExtractionRequest,
    ExtractionResponse,
    get_clinical_extraction_schema,
    get_note_classification_schema,
)
from data_extraction.extract_from_cells import (
    choose_tier,
    get_escalation_tier,
    repair_json,
    generate_request_id,
)


class TestSchemas:
    """Test Pydantic schema validation."""
    
    def test_evidence_creation(self):
        """Evidence model should accept valid data."""
        evidence = Evidence(
            quote="Patient underwent surgery",
            start=10,
            end=35,
        )
        assert evidence.quote == "Patient underwent surgery"
        assert evidence.start == 10
        assert evidence.end == 35
    
    def test_evidence_optional_positions(self):
        """Evidence positions should be optional."""
        evidence = Evidence(quote="Some text")
        assert evidence.quote == "Some text"
        assert evidence.start is None
        assert evidence.end is None
    
    def test_coded_term_creation(self):
        """CodedTerm should accept valid clinical terms."""
        term = CodedTerm(
            text="acute cholecystitis",
            normalized="Acute Cholecystitis",
            mesh_id="D041881",
            mesh_label="Cholecystitis, Acute",
            mesh_confidence=0.95,
            evidence=[Evidence(quote="diagnosed with acute cholecystitis")],
        )
        assert term.text == "acute cholecystitis"
        assert term.mesh_id == "D041881"
        assert len(term.evidence) == 1
    
    def test_clinical_extraction_defaults(self):
        """ClinicalExtraction should have sensible defaults."""
        extraction = ClinicalExtraction()
        assert extraction.diagnoses == []
        assert extraction.procedures == []
        assert extraction.medications == []
        assert extraction.confidence == 0.5
        assert extraction.warnings == []
        assert extraction.extraction_version == "1.0.0"
    
    def test_clinical_extraction_full(self):
        """ClinicalExtraction should accept complete data."""
        extraction = ClinicalExtraction(
            note_type=NoteType.OPERATIVE_NOTE,
            diagnoses=[CodedTerm(text="cholecystitis")],
            procedures=[CodedTerm(text="cholecystectomy")],
            study_fields={"asa_class": "II", "ebl_ml": 50},
            confidence=0.9,
        )
        assert extraction.note_type == NoteType.OPERATIVE_NOTE
        assert len(extraction.diagnoses) == 1
        assert extraction.study_fields["asa_class"] == "II"
    
    def test_note_type_enum(self):
        """NoteType enum should have expected values."""
        assert NoteType.OPERATIVE_NOTE.value == "operative_note"
        assert NoteType.DISCHARGE_SUMMARY.value == "discharge_summary"
        assert NoteType.OTHER.value == "other"
    
    def test_medication_entry(self):
        """MedicationEntry should capture drug details."""
        med = MedicationEntry(
            name="Metformin",
            dose="500mg",
            route="PO",
            frequency="BID",
            indication="Type 2 diabetes",
        )
        assert med.name == "Metformin"
        assert med.dose == "500mg"
        assert med.route == "PO"
    
    def test_extraction_request_validation(self):
        """ExtractionRequest should validate input."""
        request = ExtractionRequest(
            text="Patient presented with...",
            metadata={"file_id": "123"},
        )
        assert request.text == "Patient presented with..."
        assert request.metadata["file_id"] == "123"
    
    def test_get_clinical_extraction_schema(self):
        """Should return valid JSON schema."""
        schema = get_clinical_extraction_schema()
        assert "properties" in schema
        assert "diagnoses" in schema["properties"]
        assert "procedures" in schema["properties"]
    
    def test_get_note_classification_schema(self):
        """Should return valid JSON schema for classification."""
        schema = get_note_classification_schema()
        assert "properties" in schema
        assert "note_type" in schema["properties"]
        assert "confidence" in schema["properties"]


class TestTierSelection:
    """Test tier selection logic."""
    
    def test_choose_tier_nano_short_text(self):
        """Short text should use NANO tier."""
        text = "Patient has fever."
        assert choose_tier(text) == "NANO"
    
    def test_choose_tier_mini_medium_text(self):
        """Medium text should use MINI tier."""
        text = "A" * 500  # 500 chars
        assert choose_tier(text) == "MINI"
    
    def test_choose_tier_frontier_long_text(self):
        """Long text should use FRONTIER tier."""
        text = "A" * 4000  # 4000 chars
        assert choose_tier(text) == "FRONTIER"
    
    def test_choose_tier_force_override(self):
        """Force tier should override automatic selection."""
        short_text = "Hi"
        assert choose_tier(short_text, force_tier="FRONTIER") == "FRONTIER"
    
    def test_choose_tier_boundary_nano(self):
        """Text at NANO boundary should be NANO."""
        text = "A" * 399  # Just under 400
        assert choose_tier(text) == "NANO"
    
    def test_choose_tier_boundary_mini(self):
        """Text at MINI boundary should be MINI."""
        text = "A" * 400  # At 400
        assert choose_tier(text) == "MINI"


class TestEscalation:
    """Test tier escalation logic."""
    
    def test_escalate_nano_to_mini(self):
        """NANO should escalate to MINI."""
        assert get_escalation_tier("NANO") == "MINI"
    
    def test_escalate_mini_to_frontier(self):
        """MINI should escalate to FRONTIER."""
        assert get_escalation_tier("MINI") == "FRONTIER"
    
    def test_escalate_frontier_none(self):
        """FRONTIER should not escalate further."""
        assert get_escalation_tier("FRONTIER") is None


class TestJSONRepair:
    """Test JSON repair functionality."""
    
    def test_repair_valid_json(self):
        """Valid JSON should pass through unchanged."""
        valid = '{"key": "value"}'
        result = repair_json(valid)
        assert result == {"key": "value"}
    
    def test_repair_markdown_fences(self):
        """Should strip markdown code fences."""
        with_fences = '```json\n{"key": "value"}\n```'
        result = repair_json(with_fences)
        assert result == {"key": "value"}
    
    def test_repair_trailing_comma_object(self):
        """Should fix trailing commas in objects."""
        malformed = '{"key": "value",}'
        result = repair_json(malformed)
        assert result == {"key": "value"}
    
    def test_repair_trailing_comma_array(self):
        """Should fix trailing commas in arrays."""
        malformed = '{"arr": [1, 2, 3,]}'
        result = repair_json(malformed)
        assert result == {"arr": [1, 2, 3]}
    
    def test_repair_returns_empty_on_failure(self):
        """Should return empty dict on complete failure."""
        garbage = "this is not json at all {{{{["
        result = repair_json(garbage)
        assert result == {}


class TestRequestID:
    """Test request ID generation."""
    
    def test_generate_request_id_format(self):
        """Request IDs should have expected format."""
        rid = generate_request_id()
        assert rid.startswith("ext_")
        assert len(rid) == 20  # "ext_" + 16 hex chars
    
    def test_generate_request_id_unique(self):
        """Request IDs should be unique."""
        ids = [generate_request_id() for _ in range(100)]
        assert len(set(ids)) == 100  # All unique


class TestExtractionResponse:
    """Test extraction response construction."""
    
    def test_extraction_response_creation(self):
        """ExtractionResponse should accept all fields."""
        response = ExtractionResponse(
            extraction=ClinicalExtraction(confidence=0.8),
            tier_used="MINI",
            provider="anthropic",
            model="claude-sonnet",
            tokens={"input": 100, "output": 50},
            cost_usd=0.01,
            request_id="ext_abc123",
            processing_time_ms=500,
        )
        assert response.tier_used == "MINI"
        assert response.cost_usd == 0.01
        assert response.processing_time_ms == 500


# Integration-style tests (with mocked AI Router)
class TestExtractionIntegration:
    """Integration tests with mocked AI Router."""
    
    @pytest.fixture
    def mock_ai_router_response(self):
        """Create a mock AI Router response."""
        return {
            "output": {
                "note_type": "operative_note",
                "diagnoses": [
                    {"text": "acute cholecystitis", "evidence": []}
                ],
                "procedures": [
                    {"text": "laparoscopic cholecystectomy", "evidence": []}
                ],
                "confidence": 0.85,
                "warnings": [],
            },
            "tier_used": "MINI",
            "provider": "anthropic",
            "model": "claude-sonnet",
            "tokens": {"input": 150, "output": 80},
            "cost_usd": 0.005,
        }
    
    @pytest.mark.asyncio
    async def test_extraction_with_mocked_router(self, mock_ai_router_response):
        """Test extraction flow with mocked AI Router."""
        from data_extraction.extract_from_cells import extract_clinical_from_cell
        
        with patch('data_extraction.extract_from_cells.ai_route_json') as mock_route:
            mock_route.return_value = (
                mock_ai_router_response["output"],
                {
                    "tier_used": mock_ai_router_response["tier_used"],
                    "provider": mock_ai_router_response["provider"],
                    "model": mock_ai_router_response["model"],
                    "tokens": mock_ai_router_response["tokens"],
                    "cost_usd": mock_ai_router_response["cost_usd"],
                }
            )
            
            result = await extract_clinical_from_cell(
                cell_text="Patient underwent laparoscopic cholecystectomy for acute cholecystitis.",
                metadata={"test": True},
                skip_classification=True,
            )
            
            assert result.extraction.note_type == NoteType.OPERATIVE_NOTE
            assert len(result.extraction.diagnoses) == 1
            assert result.extraction.diagnoses[0].text == "acute cholecystitis"
            assert result.tier_used == "MINI"
            assert result.cost_usd == 0.005


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
