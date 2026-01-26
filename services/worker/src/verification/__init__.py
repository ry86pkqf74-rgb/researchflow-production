"""
Layered Verification Framework for ROS

Provides multi-layer quality assurance:
- Layer 1: Schema validation (Pandera)
- Layer 2: Concordance checks (clinical agreement)
- Layer 3: Anomaly detection (statistical outliers)
- Layer 4: Audit trail verification (hash chain integrity)
- Layer 5: Explainable diagnostics (AI-powered QA)

Each layer builds on the previous, providing comprehensive quality gates.
"""

from .layered_verifier import (
    LayeredVerifier,
    VerificationResult,
    VerificationLayer,
    run_verification_pipeline,
    generate_qa_report,
)

from .schema_validator import SchemaValidator, validate_schema, get_schema_errors

from .concordance_checker import (
    ConcordanceChecker,
    check_concordance,
    get_concordance_metrics,
)

from .anomaly_detector import AnomalyDetector, detect_anomalies, get_anomaly_report

from .audit_verifier import (
    AuditVerifier,
    verify_audit_trail,
    check_hash_chain_integrity,
)

from .explainable_diagnostics import (
    ExplainableDiagnostics,
    generate_diagnostic_report,
    get_failure_explanations,
)

from .hybrid_ai_qa import (
    HybridAIQA,
    run_structural_checks_claude,
    run_narrative_qa_chatgpt,
    generate_hybrid_qa_log,
)

__all__ = [
    # Core verifier
    "LayeredVerifier",
    "VerificationResult",
    "VerificationLayer",
    "run_verification_pipeline",
    "generate_qa_report",
    # Layer 1: Schema validation
    "SchemaValidator",
    "validate_schema",
    "get_schema_errors",
    # Layer 2: Concordance checks
    "ConcordanceChecker",
    "check_concordance",
    "get_concordance_metrics",
    # Layer 3: Anomaly detection
    "AnomalyDetector",
    "detect_anomalies",
    "get_anomaly_report",
    # Layer 4: Audit trail
    "AuditVerifier",
    "verify_audit_trail",
    "check_hash_chain_integrity",
    # Layer 5: Explainable diagnostics
    "ExplainableDiagnostics",
    "generate_diagnostic_report",
    "get_failure_explanations",
    # Hybrid AI QA
    "HybridAIQA",
    "run_structural_checks_claude",
    "run_narrative_qa_chatgpt",
    "generate_hybrid_qa_log",
]

__version__ = "1.0.0"
