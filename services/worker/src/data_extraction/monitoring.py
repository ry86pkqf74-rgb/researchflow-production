"""
Extraction Monitoring Module - Production observability for clinical data extraction.

This module provides:
- Prometheus-style metrics collection
- Structured logging with context
- Health check endpoints
- Alert thresholds and notifications
- Cost tracking and budget alerts

Usage:
    from data_extraction.monitoring import ExtractionMonitor, get_monitor
    
    monitor = get_monitor()
    
    with monitor.track_extraction(tier="MINI", cell_id="123"):
        result = await extract_cell(text)
    
    metrics = monitor.get_metrics()
"""

import time
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
from contextlib import contextmanager
from collections import defaultdict
import json

logger = logging.getLogger(__name__)


class MetricType(str, Enum):
    """Types of metrics collected."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class MetricValue:
    """A single metric value with metadata."""
    name: str
    value: float
    metric_type: MetricType
    labels: Dict[str, str] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_prometheus(self) -> str:
        """Format as Prometheus metric line."""
        label_str = ""
        if self.labels:
            pairs = [f'{k}="{v}"' for k, v in self.labels.items()]
            label_str = "{" + ",".join(pairs) + "}"
        return f"{self.name}{label_str} {self.value}"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "type": self.metric_type.value,
            "labels": self.labels,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class Alert:
    """An alert triggered by threshold violation."""
    name: str
    message: str
    severity: AlertSeverity
    metric_name: str
    metric_value: float
    threshold: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "message": self.message,
            "severity": self.severity.value,
            "metric_name": self.metric_name,
            "metric_value": self.metric_value,
            "threshold": self.threshold,
            "timestamp": self.timestamp.isoformat(),
            "resolved": self.resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


@dataclass
class HealthStatus:
    """System health status."""
    healthy: bool
    status: str
    checks: Dict[str, bool] = field(default_factory=dict)
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "healthy": self.healthy,
            "status": self.status,
            "checks": self.checks,
            "details": self.details,
            "timestamp": self.timestamp.isoformat(),
        }


class ExtractionMonitor:
    """
    Production monitoring for clinical data extraction.
    
    Collects metrics on:
    - Extraction latency by tier
    - Success/failure rates
    - PHI detection rates
    - Token usage and cost
    - Error rates by type
    """
    
    # Default alert thresholds
    DEFAULT_THRESHOLDS = {
        "error_rate": 0.1,  # 10% error rate
        "phi_detection_rate": 0.05,  # 5% PHI detection
        "avg_latency_ms": 5000,  # 5 second average
        "daily_cost_usd": 100.0,  # $100 daily budget
        "hourly_cost_usd": 10.0,  # $10 hourly budget
    }
    
    def __init__(
        self,
        app_name: str = "researchflow-extraction",
        enable_alerts: bool = True,
        alert_callback: Optional[Callable[[Alert], None]] = None,
        thresholds: Optional[Dict[str, float]] = None,
    ):
        """
        Initialize the monitor.
        
        Args:
            app_name: Application name for metric labels
            enable_alerts: Whether to check thresholds and generate alerts
            alert_callback: Function to call when alert is triggered
            thresholds: Custom alert thresholds
        """
        self.app_name = app_name
        self.enable_alerts = enable_alerts
        self.alert_callback = alert_callback
        self.thresholds = {**self.DEFAULT_THRESHOLDS, **(thresholds or {})}
        
        # Metrics storage
        self._counters: Dict[str, float] = defaultdict(float)
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = defaultdict(list)
        
        # Time-windowed metrics for rates
        self._window_size = timedelta(hours=1)
        self._time_series: Dict[str, List[tuple]] = defaultdict(list)
        
        # Alerts
        self._active_alerts: Dict[str, Alert] = {}
        self._alert_history: List[Alert] = []
        
        # Thread safety
        self._lock = threading.RLock()
        
        # Cost tracking
        self._daily_cost: float = 0.0
        self._hourly_cost: float = 0.0
        self._cost_reset_day: int = datetime.utcnow().day
        self._cost_reset_hour: int = datetime.utcnow().hour
    
    def _check_cost_reset(self):
        """Reset cost counters at day/hour boundaries."""
        now = datetime.utcnow()
        if now.day != self._cost_reset_day:
            self._daily_cost = 0.0
            self._cost_reset_day = now.day
        if now.hour != self._cost_reset_hour:
            self._hourly_cost = 0.0
            self._cost_reset_hour = now.hour
    
    def _prune_time_series(self):
        """Remove old entries from time series."""
        cutoff = datetime.utcnow() - self._window_size
        for key in self._time_series:
            self._time_series[key] = [
                (ts, val) for ts, val in self._time_series[key]
                if ts > cutoff
            ]
    
    def _check_alerts(self):
        """Check thresholds and generate alerts."""
        if not self.enable_alerts:
            return
        
        metrics = self.get_metrics()
        
        # Error rate alert
        total = metrics.get("extraction_total", 0)
        errors = metrics.get("extraction_errors_total", 0)
        if total > 0:
            error_rate = errors / total
            self._check_threshold(
                "high_error_rate",
                "extraction_error_rate",
                error_rate,
                self.thresholds["error_rate"],
                f"Extraction error rate ({error_rate:.1%}) exceeds threshold ({self.thresholds['error_rate']:.1%})",
                AlertSeverity.ERROR,
            )
        
        # PHI detection rate alert
        phi_blocked = metrics.get("phi_blocked_total", 0)
        if total > 0:
            phi_rate = phi_blocked / total
            self._check_threshold(
                "high_phi_rate",
                "phi_detection_rate",
                phi_rate,
                self.thresholds["phi_detection_rate"],
                f"PHI detection rate ({phi_rate:.1%}) is unusually high",
                AlertSeverity.WARNING,
            )
        
        # Latency alert
        avg_latency = metrics.get("extraction_latency_avg_ms", 0)
        self._check_threshold(
            "high_latency",
            "extraction_latency_avg_ms",
            avg_latency,
            self.thresholds["avg_latency_ms"],
            f"Average extraction latency ({avg_latency:.0f}ms) exceeds threshold ({self.thresholds['avg_latency_ms']}ms)",
            AlertSeverity.WARNING,
        )
        
        # Cost alerts
        self._check_threshold(
            "daily_budget_exceeded",
            "daily_cost_usd",
            self._daily_cost,
            self.thresholds["daily_cost_usd"],
            f"Daily cost (${self._daily_cost:.2f}) exceeds budget (${self.thresholds['daily_cost_usd']:.2f})",
            AlertSeverity.CRITICAL,
        )
        
        self._check_threshold(
            "hourly_budget_exceeded",
            "hourly_cost_usd",
            self._hourly_cost,
            self.thresholds["hourly_cost_usd"],
            f"Hourly cost (${self._hourly_cost:.2f}) exceeds budget (${self.thresholds['hourly_cost_usd']:.2f})",
            AlertSeverity.WARNING,
        )
    
    def _check_threshold(
        self,
        alert_name: str,
        metric_name: str,
        value: float,
        threshold: float,
        message: str,
        severity: AlertSeverity,
    ):
        """Check a single threshold and manage alert state."""
        if value > threshold:
            if alert_name not in self._active_alerts:
                alert = Alert(
                    name=alert_name,
                    message=message,
                    severity=severity,
                    metric_name=metric_name,
                    metric_value=value,
                    threshold=threshold,
                )
                self._active_alerts[alert_name] = alert
                self._alert_history.append(alert)
                
                if self.alert_callback:
                    self.alert_callback(alert)
                
                logger.warning(f"Alert triggered: {alert_name} - {message}")
        else:
            if alert_name in self._active_alerts:
                alert = self._active_alerts[alert_name]
                alert.resolved = True
                alert.resolved_at = datetime.utcnow()
                del self._active_alerts[alert_name]
                logger.info(f"Alert resolved: {alert_name}")
    
    # -------------------------------------------------------------------------
    # Metric Recording Methods
    # -------------------------------------------------------------------------
    
    def increment(self, name: str, value: float = 1.0, labels: Optional[Dict[str, str]] = None):
        """Increment a counter metric."""
        with self._lock:
            key = self._make_key(name, labels)
            self._counters[key] += value
    
    def set_gauge(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """Set a gauge metric."""
        with self._lock:
            key = self._make_key(name, labels)
            self._gauges[key] = value
    
    def observe(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """Record a histogram observation."""
        with self._lock:
            key = self._make_key(name, labels)
            self._histograms[key].append(value)
            self._time_series[key].append((datetime.utcnow(), value))
    
    def _make_key(self, name: str, labels: Optional[Dict[str, str]] = None) -> str:
        """Create a unique key for a metric with labels."""
        if not labels:
            return name
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}[{label_str}]"
    
    # -------------------------------------------------------------------------
    # Extraction-Specific Recording
    # -------------------------------------------------------------------------
    
    def record_extraction(
        self,
        tier: str,
        latency_ms: float,
        success: bool,
        phi_blocked: bool = False,
        tokens_used: int = 0,
        cost_usd: float = 0.0,
        error_type: Optional[str] = None,
    ):
        """
        Record metrics for a single extraction.
        
        Args:
            tier: Model tier used (NANO, MINI, FRONTIER)
            latency_ms: Processing time in milliseconds
            success: Whether extraction succeeded
            phi_blocked: Whether extraction was blocked due to PHI
            tokens_used: Total tokens consumed
            cost_usd: Cost in USD
            error_type: Error type if failed
        """
        with self._lock:
            labels = {"tier": tier}
            
            # Total extractions
            self.increment("extraction_total", labels=labels)
            
            # Success/failure
            if success:
                self.increment("extraction_success_total", labels=labels)
            else:
                self.increment("extraction_errors_total", labels=labels)
                if error_type:
                    self.increment("extraction_errors_total", labels={"tier": tier, "error_type": error_type})
            
            # PHI blocked
            if phi_blocked:
                self.increment("phi_blocked_total", labels=labels)
            
            # Latency
            self.observe("extraction_latency_ms", latency_ms, labels=labels)
            
            # Tokens
            self.increment("tokens_total", tokens_used, labels=labels)
            
            # Cost
            self._check_cost_reset()
            self._daily_cost += cost_usd
            self._hourly_cost += cost_usd
            self.increment("cost_usd_total", cost_usd, labels=labels)
            
            # Check alerts
            self._prune_time_series()
            self._check_alerts()
    
    @contextmanager
    def track_extraction(
        self,
        tier: str,
        cell_id: Optional[str] = None,
    ):
        """
        Context manager for tracking extraction metrics.
        
        Usage:
            with monitor.track_extraction(tier="MINI", cell_id="123") as tracker:
                result = await extract(text)
                tracker.set_success(True)
                tracker.set_tokens(result.tokens)
        """
        tracker = ExtractionTracker(tier=tier, cell_id=cell_id)
        start_time = time.time()
        
        try:
            yield tracker
        except Exception as e:
            tracker.set_success(False)
            tracker.set_error_type(type(e).__name__)
            raise
        finally:
            latency_ms = (time.time() - start_time) * 1000
            self.record_extraction(
                tier=tier,
                latency_ms=latency_ms,
                success=tracker.success,
                phi_blocked=tracker.phi_blocked,
                tokens_used=tracker.tokens_used,
                cost_usd=tracker.cost_usd,
                error_type=tracker.error_type,
            )
    
    # -------------------------------------------------------------------------
    # Metric Retrieval
    # -------------------------------------------------------------------------
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all current metrics."""
        with self._lock:
            metrics = {}
            
            # Counters
            for key, value in self._counters.items():
                metrics[key] = value
            
            # Gauges
            for key, value in self._gauges.items():
                metrics[key] = value
            
            # Histogram summaries
            for key, values in self._histograms.items():
                if values:
                    sorted_vals = sorted(values)
                    metrics[f"{key}_count"] = len(values)
                    metrics[f"{key}_sum"] = sum(values)
                    metrics[f"{key}_avg"] = sum(values) / len(values)
                    metrics[f"{key}_min"] = sorted_vals[0]
                    metrics[f"{key}_max"] = sorted_vals[-1]
                    
                    # Percentiles
                    for p in [50, 90, 95, 99]:
                        idx = int(len(sorted_vals) * p / 100)
                        metrics[f"{key}_p{p}"] = sorted_vals[min(idx, len(sorted_vals) - 1)]
            
            # Cost gauges
            metrics["daily_cost_usd"] = self._daily_cost
            metrics["hourly_cost_usd"] = self._hourly_cost
            
            return metrics
    
    def get_prometheus_metrics(self) -> str:
        """Get metrics in Prometheus text format."""
        lines = []
        metrics = self.get_metrics()
        
        for name, value in metrics.items():
            if isinstance(value, (int, float)):
                lines.append(f"researchflow_{name} {value}")
        
        return "\n".join(lines)
    
    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Get currently active alerts."""
        with self._lock:
            return [alert.to_dict() for alert in self._active_alerts.values()]
    
    def get_alert_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent alert history."""
        with self._lock:
            return [alert.to_dict() for alert in self._alert_history[-limit:]]
    
    # -------------------------------------------------------------------------
    # Health Check
    # -------------------------------------------------------------------------
    
    def health_check(self) -> HealthStatus:
        """
        Perform health check on the extraction system.
        
        Returns:
            HealthStatus with overall status and individual checks
        """
        checks = {}
        details = {}
        
        # Check error rate
        metrics = self.get_metrics()
        total = metrics.get("extraction_total", 0)
        errors = metrics.get("extraction_errors_total", 0)
        
        if total > 0:
            error_rate = errors / total
            checks["error_rate"] = error_rate < self.thresholds["error_rate"]
            details["error_rate"] = f"{error_rate:.1%}"
        else:
            checks["error_rate"] = True
            details["error_rate"] = "No extractions yet"
        
        # Check latency
        avg_latency = metrics.get("extraction_latency_ms_avg", 0)
        checks["latency"] = avg_latency < self.thresholds["avg_latency_ms"]
        details["avg_latency_ms"] = f"{avg_latency:.0f}"
        
        # Check cost
        checks["daily_budget"] = self._daily_cost < self.thresholds["daily_cost_usd"]
        details["daily_cost_usd"] = f"${self._daily_cost:.2f}"
        
        # Check for active critical alerts
        critical_alerts = [
            a for a in self._active_alerts.values()
            if a.severity == AlertSeverity.CRITICAL
        ]
        checks["no_critical_alerts"] = len(critical_alerts) == 0
        details["active_alerts"] = len(self._active_alerts)
        
        # Overall status
        all_passed = all(checks.values())
        
        if all_passed:
            status = "healthy"
        elif checks.get("no_critical_alerts", True):
            status = "degraded"
        else:
            status = "unhealthy"
        
        return HealthStatus(
            healthy=all_passed,
            status=status,
            checks=checks,
            details=details,
        )
    
    def reset_metrics(self):
        """Reset all metrics (for testing)."""
        with self._lock:
            self._counters.clear()
            self._gauges.clear()
            self._histograms.clear()
            self._time_series.clear()
            self._daily_cost = 0.0
            self._hourly_cost = 0.0


class ExtractionTracker:
    """Helper class for tracking a single extraction."""
    
    def __init__(self, tier: str, cell_id: Optional[str] = None):
        self.tier = tier
        self.cell_id = cell_id
        self.success = True
        self.phi_blocked = False
        self.tokens_used = 0
        self.cost_usd = 0.0
        self.error_type: Optional[str] = None
    
    def set_success(self, success: bool):
        self.success = success
    
    def set_phi_blocked(self, blocked: bool = True):
        self.phi_blocked = blocked
    
    def set_tokens(self, tokens: int):
        self.tokens_used = tokens
    
    def set_cost(self, cost: float):
        self.cost_usd = cost
    
    def set_error_type(self, error_type: str):
        self.error_type = error_type


# Module-level singleton
_default_monitor: Optional[ExtractionMonitor] = None
_monitor_lock = threading.Lock()


def get_monitor() -> ExtractionMonitor:
    """Get or create the default monitor singleton."""
    global _default_monitor
    with _monitor_lock:
        if _default_monitor is None:
            _default_monitor = ExtractionMonitor()
        return _default_monitor


def configure_monitor(
    app_name: str = "researchflow-extraction",
    enable_alerts: bool = True,
    alert_callback: Optional[Callable[[Alert], None]] = None,
    thresholds: Optional[Dict[str, float]] = None,
) -> ExtractionMonitor:
    """Configure and return the default monitor."""
    global _default_monitor
    with _monitor_lock:
        _default_monitor = ExtractionMonitor(
            app_name=app_name,
            enable_alerts=enable_alerts,
            alert_callback=alert_callback,
            thresholds=thresholds,
        )
        return _default_monitor


# Exports
__all__ = [
    "ExtractionMonitor",
    "ExtractionTracker",
    "MetricType",
    "MetricValue",
    "Alert",
    "AlertSeverity",
    "HealthStatus",
    "get_monitor",
    "configure_monitor",
]
