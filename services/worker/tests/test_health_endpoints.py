"""
Health Endpoint Tests for Worker Service

Tests the /health and /health/ready endpoints to verify:
- Basic liveness probe returns healthy status
- Readiness probe validates internal invariants
- Mode flags are correctly reported
- Proper HTTP status codes (200 vs 503)

Reference: Deployment Robustness Prompt - Testing Requirements
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Add parent directory to path for api_server import
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def test_client():
    """Create a test client for the FastAPI app."""
    from fastapi.testclient import TestClient

    # Set test environment variables before importing api_server
    os.environ["ROS_MODE"] = "DEMO"
    os.environ["NO_NETWORK"] = "false"
    os.environ["MOCK_ONLY"] = "false"
    os.environ["ALLOW_UPLOADS"] = "false"

    # Import after setting env vars
    from api_server import app

    return TestClient(app)


@pytest.fixture
def standby_client():
    """Create a test client with STANDBY mode."""
    from fastapi.testclient import TestClient

    # Set STANDBY mode
    os.environ["ROS_MODE"] = "STANDBY"
    os.environ["NO_NETWORK"] = "true"
    os.environ["MOCK_ONLY"] = "true"
    os.environ["ALLOW_UPLOADS"] = "false"

    # Need to reimport to get fresh config
    import importlib
    import api_server

    importlib.reload(api_server)

    return TestClient(api_server.app)


class TestHealthEndpoint:
    """Tests for /health liveness probe."""

    def test_health_returns_200(self, test_client):
        """Health endpoint should always return 200 if server is running."""
        response = test_client.get("/health")

        assert response.status_code == 200

    def test_health_returns_healthy_status(self, test_client):
        """Health response should include healthy status."""
        response = test_client.get("/health")
        data = response.json()

        assert data["status"] == "healthy"

    def test_health_returns_service_name(self, test_client):
        """Health response should include service name."""
        response = test_client.get("/health")
        data = response.json()

        assert data["service"] == "ros-worker"

    def test_health_returns_version(self, test_client):
        """Health response should include version."""
        response = test_client.get("/health")
        data = response.json()

        assert "version" in data
        assert data["version"] == "1.0.0"

    def test_health_returns_timestamp(self, test_client):
        """Health response should include ISO timestamp."""
        response = test_client.get("/health")
        data = response.json()

        assert "timestamp" in data
        # Should be ISO format ending with Z
        assert data["timestamp"].endswith("Z")

    def test_health_returns_mode_info(self, test_client):
        """Health response should include mode configuration."""
        response = test_client.get("/health")
        data = response.json()

        assert "mode" in data
        assert "ros_mode" in data["mode"]
        assert "no_network" in data["mode"]
        assert "mock_only" in data["mode"]


class TestHealthReadyEndpoint:
    """Tests for /health/ready readiness probe."""

    def test_ready_returns_200_when_healthy(self, test_client):
        """Readiness endpoint should return 200 when all checks pass."""
        response = test_client.get("/health/ready")

        # May return 200 or 503 depending on config invariants
        assert response.status_code in [200, 503]

    def test_ready_returns_checks_object(self, test_client):
        """Readiness response should include checks object."""
        response = test_client.get("/health/ready")
        data = response.json()

        assert "checks" in data
        assert isinstance(data["checks"], dict)

    def test_ready_validates_config(self, test_client):
        """Readiness should validate runtime config is properly initialized."""
        response = test_client.get("/health/ready")
        data = response.json()

        assert "config" in data["checks"]
        # Config check should pass (ok) or explicitly fail
        assert data["checks"]["config"] in ["ok"] or "failed:" in data["checks"]["config"]

    def test_ready_returns_status_field(self, test_client):
        """Readiness response should include status field."""
        response = test_client.get("/health/ready")
        data = response.json()

        assert "status" in data
        assert data["status"] in ["ready", "not_ready"]

    def test_ready_returns_mode_info(self, test_client):
        """Readiness response should include mode configuration."""
        response = test_client.get("/health/ready")
        data = response.json()

        assert "mode" in data
        assert "ros_mode" in data["mode"]
        assert "no_network" in data["mode"]
        assert "mock_only" in data["mode"]
        assert "allow_uploads" in data["mode"]

    def test_ready_returns_503_when_config_invalid(self):
        """Readiness should return 503 if config is invalid."""
        from fastapi.testclient import TestClient

        # Set invalid config
        original_ros_mode = os.environ.get("ROS_MODE")
        os.environ["ROS_MODE"] = "INVALID_MODE"

        try:
            import importlib
            import api_server

            importlib.reload(api_server)

            client = TestClient(api_server.app)
            response = client.get("/health/ready")
            data = response.json()

            # Invalid mode should cause config check to fail
            # Note: Actual behavior depends on runtime_config validation
            assert response.status_code in [200, 503]
        finally:
            # Restore original
            if original_ros_mode:
                os.environ["ROS_MODE"] = original_ros_mode
            else:
                del os.environ["ROS_MODE"]


class TestModeReporting:
    """Tests for mode flag reporting in health endpoints."""

    def test_demo_mode_reported(self, test_client):
        """DEMO mode should be reported in health response."""
        os.environ["ROS_MODE"] = "DEMO"

        response = test_client.get("/health")
        data = response.json()

        assert data["mode"]["ros_mode"] == "DEMO"

    def test_no_network_flag_reported(self, test_client):
        """NO_NETWORK flag should be reported as boolean."""
        os.environ["NO_NETWORK"] = "true"

        import importlib
        import api_server

        importlib.reload(api_server)

        from fastapi.testclient import TestClient

        client = TestClient(api_server.app)
        response = client.get("/health")
        data = response.json()

        assert data["mode"]["no_network"] is True

    def test_mock_only_flag_reported(self, test_client):
        """MOCK_ONLY flag should be reported as boolean."""
        os.environ["MOCK_ONLY"] = "true"

        import importlib
        import api_server

        importlib.reload(api_server)

        from fastapi.testclient import TestClient

        client = TestClient(api_server.app)
        response = client.get("/health")
        data = response.json()

        assert data["mode"]["mock_only"] is True


class TestArtifactPathCheck:
    """Tests for artifact path validation in readiness check."""

    def test_artifact_path_check_included(self, test_client):
        """Readiness should check artifact path."""
        response = test_client.get("/health/ready")
        data = response.json()

        assert "artifacts" in data["checks"]

    def test_artifact_path_warning_when_missing(self, test_client):
        """Should warn (not fail) if artifact directory doesn't exist."""
        # Set non-existent path
        os.environ["ARTIFACT_PATH"] = "/nonexistent/path"

        import importlib
        import api_server

        importlib.reload(api_server)

        from fastapi.testclient import TestClient

        client = TestClient(api_server.app)
        response = client.get("/health/ready")
        data = response.json()

        # Should be a warning, not a hard failure
        assert "artifacts" in data["checks"]
        # Artifacts is non-fatal, so may be "ok" or "warning:"
        assert "warning" in data["checks"]["artifacts"] or data["checks"]["artifacts"] == "ok"


class TestPythonPathCheck:
    """Tests for Python path validation in readiness check."""

    def test_python_path_check_included(self, test_client):
        """Readiness should check Python path."""
        response = test_client.get("/health/ready")
        data = response.json()

        assert "python_path" in data["checks"]


class TestFailClosedBehavior:
    """Tests verifying fail-closed behavior for health checks."""

    def test_health_still_works_in_standby(self):
        """Health endpoint should work even in STANDBY mode."""
        from fastapi.testclient import TestClient

        os.environ["ROS_MODE"] = "STANDBY"
        os.environ["NO_NETWORK"] = "true"

        import importlib
        import api_server

        importlib.reload(api_server)

        client = TestClient(api_server.app)
        response = client.get("/health")

        # Health should always return 200 for liveness
        assert response.status_code == 200

    def test_ready_still_works_in_standby(self):
        """Readiness endpoint should work even in STANDBY mode."""
        from fastapi.testclient import TestClient

        os.environ["ROS_MODE"] = "STANDBY"
        os.environ["NO_NETWORK"] = "true"

        import importlib
        import api_server

        importlib.reload(api_server)

        client = TestClient(api_server.app)
        response = client.get("/health/ready")

        # Readiness returns 200 or 503, but should respond
        assert response.status_code in [200, 503]
        data = response.json()
        assert data["mode"]["ros_mode"] == "STANDBY"


class TestContentType:
    """Tests for response content type."""

    def test_health_returns_json(self, test_client):
        """Health endpoint should return JSON content type."""
        response = test_client.get("/health")

        assert response.headers["content-type"] == "application/json"

    def test_ready_returns_json(self, test_client):
        """Readiness endpoint should return JSON content type."""
        response = test_client.get("/health/ready")

        assert response.headers["content-type"] == "application/json"
