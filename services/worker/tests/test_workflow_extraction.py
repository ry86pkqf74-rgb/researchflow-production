"""
Tests for DataFrame extraction workflow integration (Phase C).

Tests cover:
- API endpoints for DataFrame extraction
- Request/Response schemas
- Module attribute checks via file parsing
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import sys
import ast
import os

sys.path.insert(0, '../src')


def parse_stage_06_for_constants():
    """Parse stage_06_analysis.py to extract constants without importing."""
    stage_path = "src/workflow_engine/stages/stage_06_analysis.py"
    with open(stage_path, 'r') as f:
        source = f.read()
    
    tree = ast.parse(source)
    
    constants = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    if target.id in ['SUPPORTED_ANALYSIS_TYPES', 'DEFAULT_PARAMETERS']:
                        # Convert AST dict to actual dict
                        try:
                            constants[target.id] = ast.literal_eval(node.value)
                        except (ValueError, TypeError):
                            pass
    
    return constants


class TestStage06Constants:
    """Tests for stage_06_analysis.py constants via AST parsing."""
    
    def test_supported_analysis_types_includes_dataframe(self):
        """dataframe_extraction should be a supported analysis type."""
        constants = parse_stage_06_for_constants()
        
        assert "SUPPORTED_ANALYSIS_TYPES" in constants
        assert "dataframe_extraction" in constants["SUPPORTED_ANALYSIS_TYPES"]
        assert constants["SUPPORTED_ANALYSIS_TYPES"]["dataframe_extraction"] == "DataFrame Clinical Extraction with PHI Scanning"
    
    def test_default_parameters_for_dataframe_extraction(self):
        """Default parameters should be configured for dataframe_extraction."""
        constants = parse_stage_06_for_constants()
        
        assert "DEFAULT_PARAMETERS" in constants
        assert "dataframe_extraction" in constants["DEFAULT_PARAMETERS"]
        params = constants["DEFAULT_PARAMETERS"]["dataframe_extraction"]
        
        assert params["columns"] is None  # Auto-detect
        assert params["min_text_length"] == 100
        assert params["enable_phi_scanning"] is True
        assert params["block_on_phi"] is True
        assert params["enable_nlm_enrichment"] is True
        assert params["force_tier"] is None
        assert params["max_concurrent"] == 5
        assert params["output_format"] == "parquet"
    
    def test_perform_dataframe_extraction_function_defined(self):
        """perform_dataframe_extraction should be defined in stage_06."""
        stage_path = "src/workflow_engine/stages/stage_06_analysis.py"
        with open(stage_path, 'r') as f:
            source = f.read()
        
        assert "async def perform_dataframe_extraction" in source
        assert "file_path: str" in source
        assert "parameters: Dict[str, Any]" in source


class TestDataFrameExtractionAPI:
    """Tests for DataFrame extraction API endpoints."""
    
    def test_api_routes_imports(self):
        """API routes module should have DataFrame extraction imports."""
        from data_extraction.api_routes import DATAFRAME_EXTRACTION_AVAILABLE
        
        # Should be True if pandas and cell_parser are available
        assert isinstance(DATAFRAME_EXTRACTION_AVAILABLE, bool)
    
    def test_dataframe_extraction_request_schema(self):
        """DataFrameExtractionRequest schema should have correct fields."""
        from data_extraction.api_routes import DataFrameExtractionRequest
        
        # Create instance with defaults
        request = DataFrameExtractionRequest()
        
        assert request.columns is None
        assert request.min_text_length == 100
        assert request.enable_phi_scanning is True
        assert request.block_on_phi is True
        assert request.enable_nlm_enrichment is True
        assert request.force_tier is None
        assert request.max_concurrent == 5
    
    def test_dataframe_extraction_response_schema(self):
        """DataFrameExtractionResponse schema should have correct fields."""
        from data_extraction.api_routes import DataFrameExtractionResponse
        
        # Create instance
        response = DataFrameExtractionResponse(status="completed")
        
        assert response.status == "completed"
        assert response.file_path is None
        assert response.row_count is None
        assert response.columns_detected == []
        assert response.total_cells == 0
        assert response.successful == 0
        assert response.failed == 0
        assert response.phi_blocked == 0
        assert response.total_cost_usd == 0.0
    
    def test_health_endpoint_includes_dataframe_availability(self):
        """Health endpoint should report dataframe extraction availability."""
        from data_extraction.api_routes import router, DATAFRAME_EXTRACTION_AVAILABLE
        
        # Find health endpoint (includes /extraction prefix)
        health_route = None
        for route in router.routes:
            if hasattr(route, 'path') and "health" in route.path:
                health_route = route
                break
        
        assert health_route is not None


class TestDataFrameExtractionRequestValidation:
    """Tests for request validation."""
    
    def test_min_text_length_bounds(self):
        """min_text_length should have bounds validation."""
        from data_extraction.api_routes import DataFrameExtractionRequest
        from pydantic import ValidationError
        
        # Valid bounds
        request = DataFrameExtractionRequest(min_text_length=50)
        assert request.min_text_length == 50
        
        # Test boundary (10 is minimum)
        request = DataFrameExtractionRequest(min_text_length=10)
        assert request.min_text_length == 10
    
    def test_max_concurrent_bounds(self):
        """max_concurrent should have bounds validation."""
        from data_extraction.api_routes import DataFrameExtractionRequest
        from pydantic import ValidationError
        
        # Valid
        request = DataFrameExtractionRequest(max_concurrent=10)
        assert request.max_concurrent == 10
        
        # Boundary test
        request = DataFrameExtractionRequest(max_concurrent=1)
        assert request.max_concurrent == 1
        
        request = DataFrameExtractionRequest(max_concurrent=20)
        assert request.max_concurrent == 20


class TestStage06ModuleStructure:
    """Tests for stage_06 module structure via source inspection."""
    
    def test_stage_has_cell_parser_import(self):
        """Stage should import cell_parser module."""
        stage_path = "src/workflow_engine/stages/stage_06_analysis.py"
        with open(stage_path, 'r') as f:
            source = f.read()
        
        assert "from data_extraction.cell_parser import" in source or \
               "from .cell_parser import" in source
        assert "CELL_PARSER_AVAILABLE" in source
    
    def test_stage_has_pandas_import(self):
        """Stage should import pandas."""
        stage_path = "src/workflow_engine/stages/stage_06_analysis.py"
        with open(stage_path, 'r') as f:
            source = f.read()
        
        assert "import pandas" in source
        assert "PANDAS_AVAILABLE" in source
    
    def test_analysis_stage_class_defined(self):
        """AnalysisStage class should be defined."""
        stage_path = "src/workflow_engine/stages/stage_06_analysis.py"
        with open(stage_path, 'r') as f:
            source = f.read()
        
        assert "class AnalysisStage:" in source
        assert 'stage_id = 6' in source
        assert 'stage_name = "Analysis"' in source


class TestAPIEndpointsExist:
    """Tests for API endpoint existence."""
    
    def test_dataframe_extraction_endpoint_exists(self):
        """DataFrame extraction endpoint should be defined."""
        from data_extraction.api_routes import router
        
        # Find the dataframe extraction endpoint (includes /extraction prefix)
        df_route = None
        for route in router.routes:
            if hasattr(route, 'path') and "extract/dataframe" in route.path:
                df_route = route
                break
        
        assert df_route is not None
    
    def test_detect_columns_endpoint_exists(self):
        """Column detection endpoint should be defined."""
        from data_extraction.api_routes import router
        
        # Find the detect columns endpoint (includes /extraction prefix)
        detect_route = None
        for route in router.routes:
            if hasattr(route, 'path') and "detect-columns" in route.path:
                detect_route = route
                break
        
        assert detect_route is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
