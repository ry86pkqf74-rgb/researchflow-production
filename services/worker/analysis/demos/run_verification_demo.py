#!/usr/bin/env python3
"""
Verification System Demo

Demonstrates the layered verification framework with hybrid AI QA on linkage data.

Usage:
    python run_verification_demo.py
"""

import sys
from pathlib import Path
import pandas as pd
import logging
from datetime import datetime

# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from verification import (
    LayeredVerifier,
    VerificationLayer,
    generate_qa_report,
    HybridAIQA,
    generate_hybrid_qa_log,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_demo_data():
    """
    Load demo linkage data from previous demonstration.

    Returns
    -------
    tuple
        (linkage_df, audit_log_df)
    """
    logger.info("Loading demo linkage data...")

    # Simulated linkage data (from previous molecular-imaging linkage demo)
    linkage_data = {
        "linkage_id": list(range(1, 236)),  # 235 linkages total
        "patient_id": [f"P{1000 + i % 100}" for i in range(235)],
        "modality": (
            ["CT"] * 85
            + ["FNA"] * 90  # CT linkages
            + ["Molecular"] * 60  # FNA linkages  # Molecular linkages
        ),
        "imaging_date": pd.date_range("2023-01-01", periods=235, freq="D"),
        "linkage_date": pd.date_range("2023-02-01", periods=235, freq="D"),
        "time_gap_days": [40.5] * 85 + [7.6] * 90 + [16.1] * 60,
        "nodule_size_mm": [12.5 + i * 0.1 for i in range(235)],
        "tirads_score": [3] * 50 + [4] * 100 + [5] * 85,
        "bethesda_category": [2] * 60 + [3] * 80 + [4] * 50 + [5] * 30 + [6] * 15,
        "ete_reported": [False] * 200 + [True] * 35,
        "ete_confirmed": [False] * 205 + [True] * 30,
        "malignancy_outcome": [False] * 150 + [True] * 85,
    }

    linkage_df = pd.DataFrame(linkage_data)

    # Simulated audit log
    audit_data = {
        "audit_id": [f"AUDIT_{i:06d}" for i in range(1, 236)],
        "operation": ["LINKAGE_CREATE"] * 235,
        "timestamp": pd.date_range("2023-01-01", periods=235, freq="H"),
        "user": ["system"] * 235,
        "log_hash": [f"hash_{i:06d}" for i in range(1, 236)],
        "prev_log_hash": ["genesis"] + [f"hash_{i:06d}" for i in range(1, 235)],
    }

    audit_log_df = pd.DataFrame(audit_data)

    logger.info(
        f"Loaded {len(linkage_df)} linkage records and {len(audit_log_df)} audit entries"
    )
    return linkage_df, audit_log_df


def run_verification_demo():
    """Run complete verification demonstration"""

    print("=" * 80)
    print("LAYERED VERIFICATION SYSTEM DEMO")
    print("=" * 80)
    print()

    # Load data
    linkage_df, audit_log_df = load_demo_data()

    print(f"Dataset: {len(linkage_df)} linkage records")
    print(
        f"Modalities: CT={len(linkage_df[linkage_df['modality']=='CT'])}, "
        f"FNA={len(linkage_df[linkage_df['modality']=='FNA'])}, "
        f"Molecular={len(linkage_df[linkage_df['modality']=='Molecular'])}"
    )
    print()

    # Initialize verifier
    print("Initializing LayeredVerifier...")
    verifier = LayeredVerifier(
        stop_on_failure=False,  # Run all layers even if one fails
        stop_on_warning=False,  # Continue through warnings
        enabled_layers=[
            VerificationLayer.SCHEMA,
            VerificationLayer.CONCORDANCE,
            VerificationLayer.ANOMALY,
            VerificationLayer.AUDIT,
            VerificationLayer.DIAGNOSTIC,
        ],
    )
    print(f"Enabled layers: {', '.join(l.name for l in verifier.enabled_layers)}")
    print()

    # Run verification
    print("Running layered verification...")
    print("-" * 80)

    result = verifier.verify(
        data=linkage_df,
        schema_name=None,  # Skip schema validation for demo (no schema file)
        linkage_df=linkage_df,
        audit_log=audit_log_df,
        context={"demo_mode": True},
    )

    print()
    print("=" * 80)
    print("VERIFICATION RESULTS")
    print("=" * 80)
    print()

    # Print layer-by-layer results
    for layer in sorted(result.layers.keys(), key=lambda x: x.value):
        layer_result = result.layers[layer]
        status_emoji = (
            "✅"
            if layer_result.passed
            else ("⚠️" if layer_result.status.value == "WARNING" else "❌")
        )

        print(f"{status_emoji} Layer {layer.value}: {layer.name}")
        print(f"   Status: {layer_result.status.value}")
        print(f"   Passed: {'Yes' if layer_result.passed else 'No'}")
        print(f"   Warnings: {len(layer_result.warnings)}")
        print(f"   Errors: {len(layer_result.errors)}")
        print(f"   Execution Time: {layer_result.execution_time_ms:.1f} ms")

        if layer_result.metrics:
            print(f"   Metrics:")
            for key, value in layer_result.metrics.items():
                print(f"      - {key}: {value}")

        if layer_result.warnings:
            print(f"   Warnings:")
            for warning in layer_result.warnings[:3]:  # Show first 3
                print(f"      - {warning}")
            if len(layer_result.warnings) > 3:
                print(f"      ... and {len(layer_result.warnings) - 3} more")

        if layer_result.errors:
            print(f"   Errors:")
            for error in layer_result.errors[:3]:  # Show first 3
                print(f"      - {error}")
            if len(layer_result.errors) > 3:
                print(f"      ... and {len(layer_result.errors) - 3} more")

        print()

    # Overall summary
    print("=" * 80)
    print("OVERALL SUMMARY")
    print("=" * 80)
    print(f"Overall Status: {result.overall_status.value}")
    print(f"Overall Passed: {'✅ YES' if result.overall_passed else '❌ NO'}")
    print(f"Total Warnings: {result.total_warnings}")
    print(f"Total Errors: {result.total_errors}")
    print(f"Total Execution Time: {result.execution_time_ms:.1f} ms")
    print()

    # Generate QA report
    print("=" * 80)
    print("GENERATING QA REPORT")
    print("=" * 80)
    print()

    qa_report = generate_qa_report(result)
    print(qa_report)
    print()

    # Save QA report
    output_dir = Path("reports/qa")
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    report_path = output_dir / f"verification_report_{timestamp}.txt"
    report_path.write_text(qa_report)
    logger.info(f"QA report saved to: {report_path}")

    # Run hybrid AI QA
    print("=" * 80)
    print("RUNNING HYBRID AI QA")
    print("=" * 80)
    print()

    qa = HybridAIQA(claude_model="claude-sonnet-4", chatgpt_model="gpt-4")

    # Prepare data summary
    data_summary = {
        "row_count": len(linkage_df),
        "column_count": len(linkage_df.columns),
        "modalities": linkage_df["modality"].value_counts().to_dict(),
        "date_range": {
            "start": linkage_df["imaging_date"].min().isoformat(),
            "end": linkage_df["imaging_date"].max().isoformat(),
        },
    }

    # Run AI QA pipeline
    ai_qa_results = qa.run_qa_pipeline(
        verification_result=result,
        data_summary=data_summary,
        context={"demo_mode": True},
    )

    # Generate hybrid QA log
    hybrid_log = generate_hybrid_qa_log(
        verification_result=result, ai_qa_results=ai_qa_results
    )

    print(hybrid_log)
    print()

    # Save hybrid QA log
    hybrid_log_path = output_dir / f"hybrid_qa_log_{timestamp}.txt"
    hybrid_log_path.write_text(hybrid_log)
    logger.info(f"Hybrid QA log saved to: {hybrid_log_path}")

    # Save JSON export
    json_path = output_dir / f"verification_result_{timestamp}.json"
    json_path.write_text(result.to_json())
    logger.info(f"JSON result saved to: {json_path}")

    print("=" * 80)
    print("DEMO COMPLETE")
    print("=" * 80)
    print()
    print(f"Reports generated in: {output_dir}")
    print(f"  - QA Report: {report_path.name}")
    print(f"  - Hybrid QA Log: {hybrid_log_path.name}")
    print(f"  - JSON Export: {json_path.name}")
    print()

    return result


if __name__ == "__main__":
    try:
        result = run_verification_demo()
        sys.exit(0 if result.overall_passed else 1)
    except Exception as e:
        logger.exception("Demo failed")
        print(f"\n❌ Error: {e}")
        sys.exit(1)
