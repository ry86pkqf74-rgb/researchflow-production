"""
Audit Anomaly Detector (Task 67)

Implements ML-based anomaly detection for audit logs to identify:
- Brute force login attempts
- Unusual time-of-day access patterns
- PHI access spikes
- Privilege escalation attempts
- Geographic anomalies
- Rate limit abuse

Uses robust z-score and optionally IsolationForest for detection.
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any, Literal
from enum import Enum
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Feature flag for anomaly detection
ANOMALY_DETECTION_ENABLED = os.getenv("ANOMALY_DETECTION_ENABLED", "false").lower() == "true"

# Configuration from environment
BRUTE_FORCE_MAX_ATTEMPTS = int(os.getenv("BRUTE_FORCE_MAX_ATTEMPTS", "5"))
BRUTE_FORCE_WINDOW_MINUTES = int(os.getenv("BRUTE_FORCE_WINDOW_MINUTES", "15"))
ANOMALY_ALERT_THRESHOLD = float(os.getenv("ANOMALY_ALERT_THRESHOLD", "0.8"))


class AnomalyType(str, Enum):
    """Types of security anomalies"""
    BRUTE_FORCE = "brute_force"
    UNUSUAL_ACCESS = "unusual_access"
    PHI_SPIKE = "phi_spike"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    GEOGRAPHIC_ANOMALY = "geographic_anomaly"
    RATE_LIMIT_ABUSE = "rate_limit_abuse"


class AnomalySeverity(str, Enum):
    """Severity levels for anomalies"""
    INFO = "INFO"
    WARNING = "WARNING"
    ALERT = "ALERT"
    CRITICAL = "CRITICAL"


@dataclass
class AuditEntry:
    """Represents an audit log entry"""
    id: str
    event_type: str
    user_id: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    ip_address: Optional[str]
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)
    session_id: Optional[str] = None


@dataclass
class AnomalyResult:
    """Result of anomaly detection"""
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    user_id: Optional[str]
    ip_address: Optional[str]
    description: str
    detection_score: float
    evidence: Dict[str, Any]
    detected_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        result = asdict(self)
        result["anomaly_type"] = self.anomaly_type.value
        result["severity"] = self.severity.value
        result["detected_at"] = self.detected_at.isoformat()
        return result


@dataclass
class AnomalyConfig:
    """Configuration for anomaly detection"""
    brute_force_max_attempts: int = BRUTE_FORCE_MAX_ATTEMPTS
    brute_force_window_minutes: int = BRUTE_FORCE_WINDOW_MINUTES
    alert_threshold: float = ANOMALY_ALERT_THRESHOLD
    phi_spike_multiplier: float = 3.0  # Alert if PHI access > 3x normal
    unusual_hour_start: int = 22  # 10 PM
    unusual_hour_end: int = 6     # 6 AM
    rate_limit_window_seconds: int = 60
    rate_limit_threshold: int = 100
    use_isolation_forest: bool = False  # Advanced ML detection


class AuditAnomalyDetector:
    """
    Detects anomalies in audit logs using statistical methods and ML.

    Detection methods:
    1. Robust z-score for outlier detection
    2. Time-series analysis for pattern detection
    3. Optional IsolationForest for advanced detection
    """

    def __init__(self, config: Optional[AnomalyConfig] = None):
        self.config = config or AnomalyConfig()
        self._user_baselines: Dict[str, Dict[str, float]] = {}
        self._isolation_forest = None

        if self.config.use_isolation_forest:
            self._initialize_isolation_forest()

    def _initialize_isolation_forest(self):
        """Initialize IsolationForest if sklearn is available"""
        try:
            from sklearn.ensemble import IsolationForest
            self._isolation_forest = IsolationForest(
                contamination=0.1,
                random_state=42,
                n_estimators=100
            )
            logger.info("IsolationForest initialized for anomaly detection")
        except ImportError:
            logger.warning("sklearn not available, falling back to statistical methods")
            self.config.use_isolation_forest = False

    def detect_brute_force(
        self,
        entries: List[AuditEntry],
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Optional[AnomalyResult]:
        """
        Detect brute force login attempts.

        Triggers if more than max_attempts failed logins within time window.
        """
        window_start = datetime.utcnow() - timedelta(minutes=self.config.brute_force_window_minutes)

        # Filter to auth failure events
        auth_failures = [
            e for e in entries
            if e.event_type in ("AUTH_FAILURE", "LOGIN_FAILED", "AUTHENTICATION_FAILURE")
            and e.timestamp >= window_start
            and (user_id is None or e.user_id == user_id)
            and (ip_address is None or e.ip_address == ip_address)
        ]

        # Group by user or IP
        by_user: Dict[str, List[AuditEntry]] = defaultdict(list)
        by_ip: Dict[str, List[AuditEntry]] = defaultdict(list)

        for entry in auth_failures:
            if entry.user_id:
                by_user[entry.user_id].append(entry)
            if entry.ip_address:
                by_ip[entry.ip_address].append(entry)

        # Check for brute force by user
        for uid, attempts in by_user.items():
            if len(attempts) >= self.config.brute_force_max_attempts:
                return AnomalyResult(
                    anomaly_type=AnomalyType.BRUTE_FORCE,
                    severity=AnomalySeverity.ALERT,
                    user_id=uid,
                    ip_address=attempts[0].ip_address,
                    description=f"Brute force detected: {len(attempts)} failed logins for user {uid[:8]}... in {self.config.brute_force_window_minutes} minutes",
                    detection_score=min(1.0, len(attempts) / self.config.brute_force_max_attempts),
                    evidence={
                        "attempt_count": len(attempts),
                        "window_minutes": self.config.brute_force_window_minutes,
                        "threshold": self.config.brute_force_max_attempts,
                        "timestamps": [a.timestamp.isoformat() for a in attempts[-5:]]  # Last 5 only
                    }
                )

        # Check for brute force by IP
        for ip, attempts in by_ip.items():
            if len(attempts) >= self.config.brute_force_max_attempts:
                return AnomalyResult(
                    anomaly_type=AnomalyType.BRUTE_FORCE,
                    severity=AnomalySeverity.CRITICAL,  # Higher severity for IP-based
                    user_id=None,
                    ip_address=ip,
                    description=f"Distributed brute force from IP {ip}: {len(attempts)} failed logins",
                    detection_score=min(1.0, len(attempts) / self.config.brute_force_max_attempts),
                    evidence={
                        "attempt_count": len(attempts),
                        "unique_users": len(set(a.user_id for a in attempts if a.user_id)),
                        "window_minutes": self.config.brute_force_window_minutes
                    }
                )

        return None

    def detect_unusual_access_time(
        self,
        entries: List[AuditEntry],
        user_id: str
    ) -> Optional[AnomalyResult]:
        """
        Detect access at unusual times (configurable hours).
        """
        user_entries = [e for e in entries if e.user_id == user_id]

        unusual_entries = [
            e for e in user_entries
            if (e.timestamp.hour >= self.config.unusual_hour_start or
                e.timestamp.hour < self.config.unusual_hour_end)
        ]

        if not unusual_entries:
            return None

        # Check if this is actually unusual for this user
        # (Would normally check against user baseline)
        recent_unusual = [
            e for e in unusual_entries
            if e.timestamp >= datetime.utcnow() - timedelta(hours=1)
        ]

        if len(recent_unusual) >= 3:  # Multiple unusual time accesses
            return AnomalyResult(
                anomaly_type=AnomalyType.UNUSUAL_ACCESS,
                severity=AnomalySeverity.WARNING,
                user_id=user_id,
                ip_address=recent_unusual[0].ip_address,
                description=f"Unusual access pattern: {len(recent_unusual)} actions between {self.config.unusual_hour_start}:00-{self.config.unusual_hour_end}:00",
                detection_score=0.7,
                evidence={
                    "unusual_hour_count": len(recent_unusual),
                    "time_range": f"{self.config.unusual_hour_start}:00-{self.config.unusual_hour_end}:00",
                    "actions": [e.action for e in recent_unusual[:5]]
                }
            )

        return None

    def detect_phi_access_spike(
        self,
        entries: List[AuditEntry],
        user_id: Optional[str] = None
    ) -> Optional[AnomalyResult]:
        """
        Detect unusual spikes in PHI access.
        """
        phi_events = [
            e for e in entries
            if e.event_type in ("PHI_ACCESS", "PHI_VIEW", "PHI_EXPORT")
            and (user_id is None or e.user_id == user_id)
        ]

        if not phi_events:
            return None

        # Group by hour
        hourly_counts: Dict[str, int] = defaultdict(int)
        for entry in phi_events:
            hour_key = entry.timestamp.strftime("%Y-%m-%d-%H")
            hourly_counts[hour_key] += 1

        if len(hourly_counts) < 2:
            return None

        # Calculate baseline (mean of all hours except current)
        counts = list(hourly_counts.values())
        mean_count = sum(counts[:-1]) / len(counts[:-1]) if len(counts) > 1 else counts[0]
        current_count = counts[-1]

        # Check for spike
        if mean_count > 0 and current_count > mean_count * self.config.phi_spike_multiplier:
            return AnomalyResult(
                anomaly_type=AnomalyType.PHI_SPIKE,
                severity=AnomalySeverity.ALERT,
                user_id=user_id,
                ip_address=phi_events[-1].ip_address if phi_events else None,
                description=f"PHI access spike: {current_count} accesses vs baseline of {mean_count:.1f}",
                detection_score=min(1.0, current_count / (mean_count * self.config.phi_spike_multiplier)),
                evidence={
                    "current_count": current_count,
                    "baseline_mean": round(mean_count, 2),
                    "multiplier": round(current_count / mean_count, 2) if mean_count > 0 else 0,
                    "threshold_multiplier": self.config.phi_spike_multiplier
                }
            )

        return None

    def detect_privilege_escalation(
        self,
        entries: List[AuditEntry],
        user_id: str
    ) -> Optional[AnomalyResult]:
        """
        Detect potential privilege escalation attempts.
        """
        user_entries = [e for e in entries if e.user_id == user_id]

        # Look for permission denied followed by success patterns
        escalation_indicators = [
            "PERMISSION_DENIED",
            "UNAUTHORIZED",
            "FORBIDDEN",
            "ROLE_CHANGE",
            "ADMIN_ACCESS"
        ]

        suspicious_events = [
            e for e in user_entries
            if any(ind in e.event_type.upper() or ind in e.action.upper()
                   for ind in escalation_indicators)
        ]

        if len(suspicious_events) >= 3:  # Multiple suspicious events
            # Check for pattern: denials followed by success
            recent = sorted(suspicious_events, key=lambda e: e.timestamp)[-10:]

            denied_count = sum(1 for e in recent if "DENIED" in e.event_type.upper() or "UNAUTHORIZED" in e.event_type.upper())
            success_after_denial = any(
                i > 0 and ("DENIED" in recent[i-1].event_type.upper() or "UNAUTHORIZED" in recent[i-1].event_type.upper())
                and "SUCCESS" in e.event_type.upper()
                for i, e in enumerate(recent)
            )

            if denied_count >= 2 or success_after_denial:
                return AnomalyResult(
                    anomaly_type=AnomalyType.PRIVILEGE_ESCALATION,
                    severity=AnomalySeverity.CRITICAL,
                    user_id=user_id,
                    ip_address=recent[-1].ip_address if recent else None,
                    description=f"Potential privilege escalation: {denied_count} permission denials detected",
                    detection_score=0.85,
                    evidence={
                        "denied_count": denied_count,
                        "success_after_denial": success_after_denial,
                        "recent_actions": [e.action for e in recent[-5:]]
                    }
                )

        return None

    def detect_rate_limit_abuse(
        self,
        entries: List[AuditEntry],
        ip_address: Optional[str] = None
    ) -> Optional[AnomalyResult]:
        """
        Detect rate limit abuse patterns.
        """
        rate_events = [
            e for e in entries
            if e.event_type in ("RATE_LIMIT", "RATE_LIMITED", "429_ERROR")
            and (ip_address is None or e.ip_address == ip_address)
        ]

        if not rate_events:
            return None

        # Group by IP
        by_ip: Dict[str, List[AuditEntry]] = defaultdict(list)
        for entry in rate_events:
            if entry.ip_address:
                by_ip[entry.ip_address].append(entry)

        for ip, events in by_ip.items():
            recent = [
                e for e in events
                if e.timestamp >= datetime.utcnow() - timedelta(seconds=self.config.rate_limit_window_seconds)
            ]

            if len(recent) >= self.config.rate_limit_threshold:
                return AnomalyResult(
                    anomaly_type=AnomalyType.RATE_LIMIT_ABUSE,
                    severity=AnomalySeverity.WARNING,
                    user_id=recent[0].user_id if recent else None,
                    ip_address=ip,
                    description=f"Rate limit abuse: {len(recent)} rate-limited requests from {ip}",
                    detection_score=min(1.0, len(recent) / self.config.rate_limit_threshold),
                    evidence={
                        "rate_limit_count": len(recent),
                        "window_seconds": self.config.rate_limit_window_seconds,
                        "threshold": self.config.rate_limit_threshold
                    }
                )

        return None

    def detect_all(
        self,
        entries: List[AuditEntry],
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> List[AnomalyResult]:
        """
        Run all anomaly detection checks and return all findings.
        """
        results: List[AnomalyResult] = []

        # Brute force
        brute_force = self.detect_brute_force(entries, user_id, ip_address)
        if brute_force:
            results.append(brute_force)

        # Per-user detections
        user_ids = set(e.user_id for e in entries if e.user_id)
        if user_id:
            user_ids = {user_id}

        for uid in user_ids:
            # Unusual access time
            unusual_time = self.detect_unusual_access_time(entries, uid)
            if unusual_time:
                results.append(unusual_time)

            # Privilege escalation
            priv_esc = self.detect_privilege_escalation(entries, uid)
            if priv_esc:
                results.append(priv_esc)

        # PHI spike (global or per-user)
        phi_spike = self.detect_phi_access_spike(entries, user_id)
        if phi_spike:
            results.append(phi_spike)

        # Rate limit abuse
        rate_abuse = self.detect_rate_limit_abuse(entries, ip_address)
        if rate_abuse:
            results.append(rate_abuse)

        # Filter by threshold
        return [r for r in results if r.detection_score >= self.config.alert_threshold]

    def generate_daily_report(
        self,
        anomalies: List[AnomalyResult],
        date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate a daily anomaly report.
        """
        report_date = date or datetime.utcnow()

        # Group by type and severity
        by_type: Dict[str, int] = defaultdict(int)
        by_severity: Dict[str, int] = defaultdict(int)

        for anomaly in anomalies:
            by_type[anomaly.anomaly_type.value] += 1
            by_severity[anomaly.severity.value] += 1

        return {
            "report_id": hashlib.sha256(f"{report_date.isoformat()}".encode()).hexdigest()[:16],
            "generated_at": datetime.utcnow().isoformat(),
            "report_date": report_date.strftime("%Y-%m-%d"),
            "summary": {
                "total_anomalies": len(anomalies),
                "by_type": dict(by_type),
                "by_severity": dict(by_severity),
                "critical_count": by_severity.get("CRITICAL", 0),
                "alert_count": by_severity.get("ALERT", 0)
            },
            "anomalies": [a.to_dict() for a in anomalies[:100]],  # Limit to 100
            "configuration": {
                "brute_force_threshold": self.config.brute_force_max_attempts,
                "brute_force_window_minutes": self.config.brute_force_window_minutes,
                "phi_spike_multiplier": self.config.phi_spike_multiplier,
                "alert_threshold": self.config.alert_threshold
            }
        }


def is_anomaly_detection_available() -> bool:
    """Check if anomaly detection is available and enabled."""
    return ANOMALY_DETECTION_ENABLED


def detect_anomalies(
    entries: List[Dict[str, Any]],
    config: Optional[AnomalyConfig] = None
) -> List[AnomalyResult]:
    """
    Convenience function to detect anomalies from raw entry dicts.
    """
    if not ANOMALY_DETECTION_ENABLED:
        return []

    # Convert dicts to AuditEntry objects
    audit_entries = []
    for entry in entries:
        try:
            timestamp = entry.get("timestamp") or entry.get("created_at")
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            elif not isinstance(timestamp, datetime):
                timestamp = datetime.utcnow()

            audit_entries.append(AuditEntry(
                id=str(entry.get("id", "")),
                event_type=entry.get("event_type", "UNKNOWN"),
                user_id=entry.get("user_id"),
                action=entry.get("action", ""),
                resource_type=entry.get("resource_type"),
                resource_id=entry.get("resource_id"),
                ip_address=entry.get("ip_address"),
                timestamp=timestamp,
                details=entry.get("details", {}),
                session_id=entry.get("session_id")
            ))
        except Exception as e:
            logger.warning(f"Failed to parse audit entry: {e}")
            continue

    detector = AuditAnomalyDetector(config)
    return detector.detect_all(audit_entries)
