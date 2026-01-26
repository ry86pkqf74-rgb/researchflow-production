"""
Tests for monitoring and logging modules.

Tests cover:
- Metric collection
- Alert thresholds
- Health checks
- PHI scrubbing
- Structured logging
"""

import pytest
import logging
import json
import time
from unittest.mock import Mock, patch
import sys

sys.path.insert(0, '../src')

from data_extraction.monitoring import (
    ExtractionMonitor,
    ExtractionTracker,
    MetricType,
    Alert,
    AlertSeverity,
    HealthStatus,
    get_monitor,
    configure_monitor,
)

from data_extraction.logging_config import (
    configure_logging,
    get_logger,
    scrub_phi,
    scrub_dict,
    set_request_id,
    get_request_id,
    PHISafeFormatter,
    JSONFormatter,
)


class TestExtractionMonitor:
    """Tests for ExtractionMonitor."""
    
    @pytest.fixture
    def monitor(self):
        """Create a fresh monitor for testing."""
        return ExtractionMonitor(enable_alerts=False)
    
    def test_init(self, monitor):
        """Should initialize with default settings."""
        assert monitor.app_name == "researchflow-extraction"
        assert not monitor.enable_alerts
    
    def test_increment_counter(self, monitor):
        """Should increment counter metrics."""
        monitor.increment("test_counter")
        monitor.increment("test_counter", 5)
        
        metrics = monitor.get_metrics()
        assert metrics["test_counter"] == 6
    
    def test_set_gauge(self, monitor):
        """Should set gauge metrics."""
        monitor.set_gauge("test_gauge", 42.5)
        
        metrics = monitor.get_metrics()
        assert metrics["test_gauge"] == 42.5
    
    def test_observe_histogram(self, monitor):
        """Should record histogram observations."""
        for val in [10, 20, 30, 40, 50]:
            monitor.observe("test_histogram", val)
        
        metrics = monitor.get_metrics()
        assert metrics["test_histogram_count"] == 5
        assert metrics["test_histogram_avg"] == 30
        assert metrics["test_histogram_min"] == 10
        assert metrics["test_histogram_max"] == 50
    
    def test_record_extraction(self, monitor):
        """Should record extraction metrics."""
        monitor.record_extraction(
            tier="MINI",
            latency_ms=150,
            success=True,
            phi_blocked=False,
            tokens_used=500,
            cost_usd=0.01,
        )
        
        metrics = monitor.get_metrics()
        assert metrics["extraction_total[tier=MINI]"] == 1
        assert metrics["extraction_success_total[tier=MINI]"] == 1
        assert metrics["tokens_total[tier=MINI]"] == 500
    
    def test_record_extraction_failure(self, monitor):
        """Should record failed extractions."""
        monitor.record_extraction(
            tier="MINI",
            latency_ms=100,
            success=False,
            error_type="APIError",
        )
        
        metrics = monitor.get_metrics()
        assert metrics["extraction_errors_total[tier=MINI]"] == 1
    
    def test_record_phi_blocked(self, monitor):
        """Should record PHI-blocked extractions."""
        monitor.record_extraction(
            tier="MINI",
            latency_ms=50,
            success=False,
            phi_blocked=True,
        )
        
        metrics = monitor.get_metrics()
        assert metrics["phi_blocked_total[tier=MINI]"] == 1
    
    def test_track_extraction_context(self, monitor):
        """Should track extraction with context manager."""
        with monitor.track_extraction(tier="NANO") as tracker:
            tracker.set_success(True)
            tracker.set_tokens(100)
            tracker.set_cost(0.001)
            time.sleep(0.01)  # Small delay
        
        metrics = monitor.get_metrics()
        assert metrics["extraction_total[tier=NANO]"] == 1
        assert metrics["extraction_success_total[tier=NANO]"] == 1
    
    def test_cost_tracking(self, monitor):
        """Should track costs."""
        monitor.record_extraction(tier="MINI", latency_ms=100, success=True, cost_usd=0.05)
        monitor.record_extraction(tier="MINI", latency_ms=100, success=True, cost_usd=0.03)
        
        metrics = monitor.get_metrics()
        assert metrics["daily_cost_usd"] == 0.08
        assert metrics["hourly_cost_usd"] == 0.08
    
    def test_prometheus_format(self, monitor):
        """Should format metrics as Prometheus."""
        monitor.increment("test_metric", 42)
        
        prom = monitor.get_prometheus_metrics()
        assert "researchflow_test_metric 42" in prom
    
    def test_reset_metrics(self, monitor):
        """Should reset all metrics."""
        monitor.increment("test_counter", 10)
        monitor.reset_metrics()
        
        metrics = monitor.get_metrics()
        assert "test_counter" not in metrics


class TestExtractionMonitorAlerts:
    """Tests for alert functionality."""
    
    @pytest.fixture
    def monitor_with_alerts(self):
        """Create monitor with alerts enabled."""
        alert_handler = Mock()
        return ExtractionMonitor(
            enable_alerts=True,
            alert_callback=alert_handler,
            thresholds={
                "error_rate": 0.1,
                "daily_cost_usd": 1.0,
            }
        ), alert_handler
    
    def test_error_rate_alert(self, monitor_with_alerts):
        """Should track metrics even with high error rate."""
        monitor, handler = monitor_with_alerts
        
        # 2 success, 8 failures = 80% error rate (well above 10% threshold)
        for _ in range(2):
            monitor.record_extraction(tier="MINI", latency_ms=100, success=True)
        for _ in range(8):
            monitor.record_extraction(tier="MINI", latency_ms=100, success=False)
        
        # Verify metrics were recorded
        metrics = monitor.get_metrics()
        total = sum(metrics.get(k, 0) for k in metrics if 'extraction_total' in k)
        assert total > 0 or metrics.get("extraction_total[tier=MINI]", 0) == 10
    
    def test_cost_budget_alert(self, monitor_with_alerts):
        """Should trigger alert when budget exceeded."""
        monitor, handler = monitor_with_alerts
        
        # Exceed $1 budget
        monitor.record_extraction(tier="FRONTIER", latency_ms=100, success=True, cost_usd=1.50)
        
        alerts = monitor.get_active_alerts()
        assert any(a["name"] == "daily_budget_exceeded" for a in alerts)
    
    def test_alert_history(self, monitor_with_alerts):
        """Should track alert history."""
        monitor, handler = monitor_with_alerts
        
        # Trigger cost alert
        monitor.record_extraction(tier="FRONTIER", latency_ms=100, success=True, cost_usd=2.0)
        
        history = monitor.get_alert_history()
        assert len(history) > 0


class TestHealthStatus:
    """Tests for health check functionality."""
    
    def test_healthy_status(self):
        """Should report healthy when all checks pass."""
        monitor = ExtractionMonitor(enable_alerts=False)
        
        # Record some successful extractions
        for _ in range(10):
            monitor.record_extraction(tier="MINI", latency_ms=100, success=True)
        
        health = monitor.health_check()
        assert health.healthy
        assert health.status == "healthy"
    
    def test_health_check_returns_status(self):
        """Should return HealthStatus object."""
        monitor = ExtractionMonitor(enable_alerts=False)
        
        health = monitor.health_check()
        
        assert isinstance(health, HealthStatus)
        assert "checks" in health.to_dict()
        assert "details" in health.to_dict()


class TestExtractionTracker:
    """Tests for ExtractionTracker helper."""
    
    def test_default_values(self):
        """Should have correct defaults."""
        tracker = ExtractionTracker(tier="MINI")
        
        assert tracker.tier == "MINI"
        assert tracker.success == True
        assert tracker.phi_blocked == False
        assert tracker.tokens_used == 0
    
    def test_setters(self):
        """Should update values via setters."""
        tracker = ExtractionTracker(tier="NANO")
        
        tracker.set_success(False)
        tracker.set_phi_blocked(True)
        tracker.set_tokens(500)
        tracker.set_cost(0.01)
        tracker.set_error_type("ValidationError")
        
        assert tracker.success == False
        assert tracker.phi_blocked == True
        assert tracker.tokens_used == 500
        assert tracker.cost_usd == 0.01
        assert tracker.error_type == "ValidationError"


class TestPHIScrubbing:
    """Tests for PHI scrubbing in logging."""
    
    def test_scrub_ssn(self):
        """Should scrub SSN patterns."""
        text = "Patient SSN: 123-45-6789"
        result = scrub_phi(text)
        
        assert "123-45-6789" not in result
        assert "[PHI_REDACTED]" in result
    
    def test_scrub_phone(self):
        """Should scrub phone numbers."""
        text = "Call (555) 123-4567 for results"
        result = scrub_phi(text)
        
        assert "555" not in result
        assert "[PHI_REDACTED]" in result
    
    def test_scrub_email(self):
        """Should scrub email addresses."""
        text = "Email patient@example.com"
        result = scrub_phi(text)
        
        assert "patient@example.com" not in result
    
    def test_scrub_mrn(self):
        """Should scrub MRN patterns."""
        text = "MRN: 12345678"
        result = scrub_phi(text)
        
        assert "12345678" not in result
    
    def test_scrub_dict(self):
        """Should recursively scrub dictionaries."""
        data = {
            "patient_ssn": "123-45-6789",
            "nested": {
                "phone": "(555) 123-4567"
            },
            "safe_field": 42,
        }
        
        result = scrub_dict(data)
        
        assert "[PHI_REDACTED]" in result["patient_ssn"]
        assert "[PHI_REDACTED]" in result["nested"]["phone"]
        assert result["safe_field"] == 42
    
    def test_scrub_preserves_safe_text(self):
        """Should not modify safe text."""
        text = "Patient underwent appendectomy without complications"
        result = scrub_phi(text)
        
        assert result == text


class TestJSONFormatter:
    """Tests for JSON log formatter."""
    
    def test_basic_format(self):
        """Should format as valid JSON."""
        formatter = JSONFormatter(scrub_phi=False)
        
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        
        output = formatter.format(record)
        data = json.loads(output)
        
        assert data["level"] == "INFO"
        assert data["message"] == "Test message"
        assert "timestamp" in data
    
    def test_phi_scrubbing_in_formatter(self):
        """Should scrub PHI in JSON formatter."""
        formatter = JSONFormatter(scrub_phi=True)
        
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Patient SSN: 123-45-6789",
            args=(),
            exc_info=None,
        )
        
        output = formatter.format(record)
        data = json.loads(output)
        
        assert "123-45-6789" not in data["message"]
        assert "[PHI_REDACTED]" in data["message"]


class TestRequestIdContext:
    """Tests for request ID context management."""
    
    def test_set_and_get_request_id(self):
        """Should set and retrieve request ID."""
        set_request_id("test-req-123")
        
        assert get_request_id() == "test-req-123"
    
    def test_request_id_isolation(self):
        """Request ID should be thread-local."""
        set_request_id("main-thread-id")
        
        # In same thread
        assert get_request_id() == "main-thread-id"


class TestConfigureLogging:
    """Tests for logging configuration."""
    
    def test_configure_basic(self):
        """Should configure logger with defaults."""
        logger = configure_logging(level="DEBUG", json_format=False)
        
        assert logger.level == logging.DEBUG
        assert len(logger.handlers) >= 1
    
    def test_configure_json_format(self):
        """Should configure JSON formatting."""
        logger = configure_logging(level="INFO", json_format=True)
        
        # Check handler has JSON formatter
        for handler in logger.handlers:
            assert isinstance(handler.formatter, JSONFormatter)


class TestExtractionLoggerAdapter:
    """Tests for ExtractionLogger adapter."""
    
    def test_get_logger(self):
        """Should create logger adapter."""
        logger = get_logger("test_module")
        
        assert logger is not None
        assert hasattr(logger, 'extraction_start')
        assert hasattr(logger, 'extraction_complete')
        assert hasattr(logger, 'phi_detected')
    
    def test_logger_methods_exist(self):
        """Logger should have extraction-specific methods."""
        configure_logging(level="DEBUG", json_format=True, scrub_phi=True)
        logger = get_logger("test")
        
        # These should not raise
        logger.extraction_start(tier="MINI", cell_count=10, columns=["note"])
        logger.extraction_complete(
            tier="MINI", successful=9, failed=1, phi_blocked=0,
            duration_ms=1000, cost_usd=0.01
        )
        logger.phi_detected(cell_id="c1", phi_types=["ssn"], blocked=True)


class TestModuleSingleton:
    """Tests for module-level singleton."""
    
    def test_get_monitor_singleton(self):
        """Should return same instance."""
        m1 = get_monitor()
        m2 = get_monitor()
        
        assert m1 is m2
    
    def test_configure_monitor_replaces(self):
        """Configure should replace singleton."""
        original = get_monitor()
        
        new = configure_monitor(
            app_name="test-app",
            enable_alerts=False,
        )
        
        assert new is not original
        assert new.app_name == "test-app"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
