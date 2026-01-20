"""
Pytest configuration and fixtures for worker service tests.
"""

import os
import sys
from pathlib import Path

import pytest

# Add the worker src directory to Python path
worker_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(worker_src))

# Set test environment variables
os.environ.setdefault("GOVERNANCE_MODE", "DEMO")
os.environ.setdefault("OCR_ENABLED", "false")
os.environ.setdefault("SCISPACY_ENABLED", "false")
os.environ.setdefault("PROFILING_ENABLED", "false")
os.environ.setdefault("TRANSCRIPTION_ENABLED", "false")
os.environ.setdefault("DASK_ENABLED", "false")
os.environ.setdefault("EMBEDDINGS_PROVIDER", "mock")


@pytest.fixture
def temp_data_dir(tmp_path):
    """Provide a temporary directory for test data."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    return data_dir


@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    from unittest.mock import MagicMock, AsyncMock

    mock = MagicMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=True)
    return mock


@pytest.fixture
def mock_llm_response():
    """Mock LLM response for testing."""
    class MockLLMResult:
        def __init__(self, text):
            self.text = text

    return MockLLMResult
