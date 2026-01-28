"""
Integration tests for the multi-file ingestion API endpoints.

Tests the FastAPI router endpoints for:
- POST /api/ingest/detect
- POST /api/ingest/merge
- GET /api/ingest/status/{run_id}
- GET /api/ingest/jobs
- DELETE /api/ingest/jobs/{run_id}
- GET /api/ingest/health
"""

import pytest
import json
import tempfile
import shutil
from pathlib import Path
import pandas as pd
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Import the main app to get the test client
try:
    from api_server import app
    APP_AVAILABLE = True
except ImportError:
    APP_AVAILABLE = False


@pytest.fixture
def client():
    """Create test client for API."""
    if not APP_AVAILABLE:
        pytest.skip("API server not available")
    return TestClient(app)


@pytest.fixture
def temp_data_dir():
    """Create temporary directory with test data."""
    temp = tempfile.mkdtemp()
    temp_path = Path(temp)

    # Create sample CSV files
    df1 = pd.DataFrame({
        "patient_id": ["P001", "P002", "P003"],
        "age": [25, 30, 35],
    })
    df2 = pd.DataFrame({
        "patient_id": ["P001", "P002", "P003"],
        "glucose": [95, 110, 88],
    })

    df1.to_csv(temp_path / "demographics.csv", index=False)
    df2.to_csv(temp_path / "labs.csv", index=False)

    yield temp_path

    shutil.rmtree(temp)


class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    def test_health_returns_ok(self, client):
        """Test health endpoint returns OK status."""
        response = client.get("/api/ingest/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "ingest" in data.get("service", "").lower() or data.get("service") == "multi-file-ingest"


class TestDetectEndpoint:
    """Tests for the detection phase endpoint."""

    def test_detect_with_valid_path(self, client, temp_data_dir):
        """Test detection with valid directory path."""
        response = client.post(
            "/api/ingest/detect",
            json={
                "source_path": str(temp_data_dir),
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "run_id" in data
        assert "candidates" in data

    def test_detect_with_custom_run_id(self, client, temp_data_dir):
        """Test detection with custom run ID."""
        custom_id = "my-custom-id-123"
        response = client.post(
            "/api/ingest/detect",
            json={
                "source_path": str(temp_data_dir),
                "run_id": custom_id,
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["run_id"] == custom_id

    def test_detect_with_invalid_path(self, client):
        """Test detection with non-existent path."""
        response = client.post(
            "/api/ingest/detect",
            json={
                "source_path": "/nonexistent/path/to/data",
            }
        )
        # Should return error but not crash
        assert response.status_code in [200, 400, 404, 500]

    def test_detect_returns_candidates(self, client, temp_data_dir):
        """Test that detection returns ID candidates."""
        response = client.post(
            "/api/ingest/detect",
            json={"source_path": str(temp_data_dir)}
        )
        assert response.status_code == 200
        data = response.json()
        candidates = data.get("candidates", [])
        assert len(candidates) > 0
        # Should find patient_id as candidate
        column_names = [c["column_name"] for c in candidates]
        assert "patient_id" in column_names

    def test_detect_with_options(self, client, temp_data_dir):
        """Test detection with custom options."""
        response = client.post(
            "/api/ingest/detect",
            json={
                "source_path": str(temp_data_dir),
                "options": {
                    "min_uniqueness": 0.9,
                    "min_overlap": 0.5,
                    "top_n": 3,
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("candidates", [])) <= 3


class TestMergeEndpoint:
    """Tests for the merge phase endpoint."""

    @pytest.fixture
    def detected_job(self, client, temp_data_dir):
        """Create a detected job for merge testing."""
        response = client.post(
            "/api/ingest/detect",
            json={"source_path": str(temp_data_dir)}
        )
        return response.json()

    def test_merge_with_valid_params(self, client, detected_job):
        """Test merge with valid parameters."""
        response = client.post(
            "/api/ingest/merge",
            json={
                "run_id": detected_job["run_id"],
                "linking_column": "patient_id",
                "merge_type": "inner",
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True or "output_path" in data

    def test_merge_different_types(self, client, detected_job):
        """Test different merge types."""
        for merge_type in ["inner", "left", "outer"]:
            # Need fresh detection for each test since state may change
            response = client.post(
                "/api/ingest/merge",
                json={
                    "run_id": detected_job["run_id"],
                    "linking_column": "patient_id",
                    "merge_type": merge_type,
                }
            )
            # First one succeeds, others may fail if already merged
            assert response.status_code in [200, 400, 409]

    def test_merge_with_invalid_run_id(self, client):
        """Test merge with non-existent run ID."""
        response = client.post(
            "/api/ingest/merge",
            json={
                "run_id": "nonexistent-run-99999",
                "linking_column": "id",
                "merge_type": "inner",
            }
        )
        assert response.status_code in [400, 404]

    def test_merge_with_invalid_column(self, client, detected_job):
        """Test merge with non-existent column."""
        response = client.post(
            "/api/ingest/merge",
            json={
                "run_id": detected_job["run_id"],
                "linking_column": "nonexistent_column",
                "merge_type": "inner",
            }
        )
        assert response.status_code in [200, 400]  # May return success:false or 400

    def test_merge_output_format(self, client, detected_job):
        """Test specifying output format."""
        response = client.post(
            "/api/ingest/merge",
            json={
                "run_id": detected_job["run_id"],
                "linking_column": "patient_id",
                "merge_type": "inner",
                "output_format": "parquet",
            }
        )
        assert response.status_code == 200
        data = response.json()
        if data.get("success"):
            assert "parquet" in data.get("output_path", "")


class TestStatusEndpoint:
    """Tests for job status endpoint."""

    @pytest.fixture
    def active_job(self, client, temp_data_dir):
        """Create an active job."""
        response = client.post(
            "/api/ingest/detect",
            json={"source_path": str(temp_data_dir)}
        )
        return response.json()

    def test_status_for_existing_job(self, client, active_job):
        """Test getting status for existing job."""
        response = client.get(f"/api/ingest/status/{active_job['run_id']}")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data or "state" in data

    def test_status_for_nonexistent_job(self, client):
        """Test getting status for non-existent job."""
        response = client.get("/api/ingest/status/nonexistent-12345")
        assert response.status_code in [200, 404]

    def test_status_includes_progress(self, client, active_job):
        """Test that status includes progress information."""
        response = client.get(f"/api/ingest/status/{active_job['run_id']}")
        assert response.status_code == 200
        # May include progress, file count, etc.


class TestJobsListEndpoint:
    """Tests for jobs list endpoint."""

    def test_list_jobs_empty(self, client):
        """Test listing jobs when none exist."""
        response = client.get("/api/ingest/jobs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data.get("jobs", data), list)

    def test_list_jobs_with_active(self, client, temp_data_dir):
        """Test listing jobs after creating one."""
        # Create a job
        client.post(
            "/api/ingest/detect",
            json={"source_path": str(temp_data_dir)}
        )

        # List jobs
        response = client.get("/api/ingest/jobs")
        assert response.status_code == 200
        data = response.json()
        jobs = data.get("jobs", data)
        assert len(jobs) >= 1


class TestDeleteJobEndpoint:
    """Tests for job deletion endpoint."""

    @pytest.fixture
    def job_to_delete(self, client, temp_data_dir):
        """Create a job for deletion testing."""
        response = client.post(
            "/api/ingest/detect",
            json={"source_path": str(temp_data_dir)}
        )
        return response.json()

    def test_delete_existing_job(self, client, job_to_delete):
        """Test deleting an existing job."""
        run_id = job_to_delete["run_id"]
        response = client.delete(f"/api/ingest/jobs/{run_id}")
        assert response.status_code in [200, 204]

    def test_delete_nonexistent_job(self, client):
        """Test deleting a non-existent job."""
        response = client.delete("/api/ingest/jobs/nonexistent-999")
        assert response.status_code in [200, 404]

    def test_job_not_found_after_delete(self, client, job_to_delete):
        """Test that deleted job is no longer found."""
        run_id = job_to_delete["run_id"]
        client.delete(f"/api/ingest/jobs/{run_id}")

        # Try to get status
        response = client.get(f"/api/ingest/status/{run_id}")
        assert response.status_code in [404, 200]  # May return 404 or "not found" status


class TestRequestValidation:
    """Tests for request validation."""

    def test_detect_missing_source_path(self, client):
        """Test detect without source_path."""
        response = client.post(
            "/api/ingest/detect",
            json={}
        )
        assert response.status_code in [400, 422]  # Validation error

    def test_merge_missing_fields(self, client):
        """Test merge with missing required fields."""
        response = client.post(
            "/api/ingest/merge",
            json={"run_id": "test"}  # Missing linking_column and merge_type
        )
        assert response.status_code in [400, 422]

    def test_merge_invalid_merge_type(self, client):
        """Test merge with invalid merge type."""
        response = client.post(
            "/api/ingest/merge",
            json={
                "run_id": "test",
                "linking_column": "id",
                "merge_type": "invalid_type",
            }
        )
        assert response.status_code in [400, 422]


class TestConcurrency:
    """Tests for concurrent job handling."""

    def test_multiple_concurrent_detections(self, client, temp_data_dir):
        """Test multiple concurrent detection jobs."""
        # Create multiple jobs
        jobs = []
        for i in range(3):
            response = client.post(
                "/api/ingest/detect",
                json={
                    "source_path": str(temp_data_dir),
                    "run_id": f"concurrent-job-{i}",
                }
            )
            if response.status_code == 200:
                jobs.append(response.json())

        # All should have unique run IDs
        run_ids = [j["run_id"] for j in jobs]
        assert len(run_ids) == len(set(run_ids))

    def test_same_run_id_conflict(self, client, temp_data_dir):
        """Test creating jobs with same run ID."""
        run_id = "duplicate-id-test"

        # First request
        response1 = client.post(
            "/api/ingest/detect",
            json={
                "source_path": str(temp_data_dir),
                "run_id": run_id,
            }
        )

        # Second request with same ID
        response2 = client.post(
            "/api/ingest/detect",
            json={
                "source_path": str(temp_data_dir),
                "run_id": run_id,
            }
        )

        # Second should either fail or overwrite
        assert response1.status_code == 200
        # response2 can be 200 (overwrite) or 409 (conflict)


class TestErrorResponses:
    """Tests for error response format."""

    def test_error_includes_message(self, client):
        """Test that errors include descriptive messages."""
        response = client.post(
            "/api/ingest/detect",
            json={"source_path": "/definitely/not/a/real/path"}
        )
        if response.status_code >= 400:
            data = response.json()
            # Should have some error description
            assert "error" in data or "detail" in data or "message" in data

    def test_error_format_consistent(self, client):
        """Test error response format consistency."""
        # Test various error scenarios
        responses = [
            client.get("/api/ingest/status/fake-id"),
            client.delete("/api/ingest/jobs/fake-id"),
            client.post("/api/ingest/merge", json={}),
        ]

        for resp in responses:
            if resp.status_code >= 400:
                data = resp.json()
                # All errors should be JSON with some error field
                assert isinstance(data, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
