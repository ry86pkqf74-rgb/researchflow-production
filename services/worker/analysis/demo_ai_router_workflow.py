#!/usr/bin/env python3
"""
End-to-End AI Router Demo Workflow

Demonstrates the Research Operating System's AI router capabilities using
the committed heart disease sample dataset. This workflow showcases:

1. Schema validation using Pandera
2. AI task routing with governance compliance
3. Audit logging and statistics generation
4. Offline-only operation (no external API calls)

All AI responses are mocks - this is a demonstration of governance patterns,
not actual AI model outputs.
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pandas as pd
from schemas.pandera.heart_disease_schema import HeartDiseaseSchema
from src.ai_router.stub import AIModelRouter


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{'=' * 80}")
    print(f"  {title}")
    print(f"{'=' * 80}\n")


def validate_sample_data():
    """Load and validate the heart disease sample dataset."""
    print_section("STEP 1: VALIDATE SAMPLE DATA")

    sample_path = project_root / "data" / "sample" / "heart_disease_sample.csv"
    print(f"Loading sample data from: {sample_path}")

    df = pd.read_csv(sample_path)
    print(f"✓ Loaded {len(df)} rows, {len(df.columns)} columns")

    # Validate against Pandera schema
    validated_df = HeartDiseaseSchema.validate(df)
    print(f"✓ Schema validation passed")
    print(f"✓ Age range: {validated_df['age'].min()}-{validated_df['age'].max()} years")
    print(f"✓ Target distribution: {validated_df['target'].value_counts().to_dict()}")

    return validated_df


def run_ai_tasks(df: pd.DataFrame, router: AIModelRouter):
    """Execute a series of AI tasks using the router."""
    print_section("STEP 2: ROUTE AI TASKS")

    tasks = [
        {
            "task": "summarize",
            "context": {
                "description": "Summarize cohort characteristics and key risk factors",
                "num_records": len(df),
                "age_range": f"{df['age'].min()}-{df['age'].max()}",
                "target_distribution": df["target"].value_counts().to_dict(),
            },
        },
        {
            "task": "analyze",
            "context": {
                "description": "Identify potential correlations in cardiovascular risk factors",
                "variables": ["age", "chol", "trestbps", "thalach", "target"],
                "num_records": len(df),
            },
        },
        {
            "task": "literature_screen",
            "context": {
                "description": "Generate screening criteria for heart disease prediction studies",
                "focus": "machine learning models for cardiovascular risk assessment",
                "population": "adult cohort with chest pain symptoms",
            },
        },
        {
            "task": "code_review",
            "context": {
                "description": "Review a simple analysis snippet",
                "code": "high_risk = df[df['target'] == 1].groupby('age').size()",
                "language": "python",
            },
        },
        {
            "task": "summarize",
            "context": {
                "description": "Summarize clinical measurements across the cohort",
                "measurements": ["trestbps", "chol", "thalach"],
                "stats": {
                    "trestbps_mean": float(df["trestbps"].mean()),
                    "chol_mean": float(df["chol"].mean()),
                    "thalach_mean": float(df["thalach"].mean()),
                },
            },
        },
    ]

    for i, task_spec in enumerate(tasks, 1):
        print(f"\n[Task {i}/{len(tasks)}] {task_spec['task'].upper()}")
        print(f"Context: {task_spec['context']['description']}")

        result = router.route(task_spec["task"], task_spec["context"])

        print(f"Model: {result['model']}")
        print(f"Response:\n{result['response']}")
        print(f"─" * 80)


def export_audit_artifacts(router: AIModelRouter):
    """Export audit log and display statistics."""
    print_section("STEP 3: EXPORT AUDIT ARTIFACTS")

    # Create output directory if needed
    output_dir = project_root / "reports" / "run_manifests"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Export audit log
    audit_path = output_dir / "demo_audit.json"
    router.export_audit_log(str(audit_path))
    print(f"✓ Audit log exported to: {audit_path}")

    # Display statistics
    stats = router.get_routing_statistics()
    print(f"\n📊 Routing Statistics:")
    print(f"   Total requests: {stats['total_requests']}")
    print(f"   By task: {stats['requests_by_task']}")
    print(f"   By model: {stats['requests_by_model']}")
    print(f"   Avg response length: {stats['average_response_length']} chars")

    # Show sample audit entry
    log = router.get_routing_log()
    if log:
        print(f"\n📝 Sample Audit Entry:")
        print(f"   Task: {log[0]['task']}")
        print(f"   Model: {log[0]['model']}")
        print(f"   Timestamp: {log[0]['timestamp']}")


def main():
    """Run the complete demo workflow."""
    print("\n" + "=" * 80)
    print("  RESEARCH OPERATING SYSTEM - AI ROUTER DEMO WORKFLOW")
    print("=" * 80)
    print("\n⚠️  OFFLINE DEMO MODE")
    print("All AI responses are mocks. No external API calls or network requests.")
    print("This demonstrates governance patterns and routing logic only.")

    try:
        # Step 1: Validate sample data
        df = validate_sample_data()

        # Step 2: Initialize router and run tasks
        router = AIModelRouter(enable_logging=True)
        run_ai_tasks(df, router)

        # Step 3: Export audit artifacts and statistics
        export_audit_artifacts(router)

        print_section("✅ DEMO COMPLETE")
        print("All tasks routed successfully with governance compliance.")
        print("Audit log and statistics generated for reproducibility.")

    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
