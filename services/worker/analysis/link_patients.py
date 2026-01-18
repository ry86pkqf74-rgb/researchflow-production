#!/usr/bin/env python3
"""
Patient Linkage Analysis for Multi-Modal Thyroid Dataset

This script analyzes patient linkage across the 12 ingested modalities:
1. Identifies common linkage keys (research_id_number)
2. Generates cohort overlap statistics
3. Analyzes modality availability per patient
4. Creates linkage quality report

Outputs:
- reports/qa/patient_linkage_analysis.json: Structured linkage statistics
- reports/qa/patient_linkage_report.md: Human-readable report
- data/processed/linkage_tables/patient_modality_matrix.parquet: Patient x Modality matrix
"""

import sys
from pathlib import Path
import pandas as pd
import json
from datetime import datetime
from typing import Dict, List, Set, Tuple
from collections import defaultdict

# Add project root to path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))


class PatientLinkageAnalyzer:
    """Analyzes patient linkage across multi-modal thyroid dataset."""

    def __init__(self, interim_dir: Path = Path("data/interim")):
        """
        Initialize analyzer.

        Args:
            interim_dir: Directory containing ingested Parquet files
        """
        self.interim_dir = interim_dir
        self.datasets = {}
        self.linkage_stats = {}
        self.patient_ids = {}

    def load_datasets(self):
        """Load all Parquet files from interim directory."""
        print(f"\n{'='*80}")
        print("  Loading Ingested Datasets")
        print(f"{'='*80}\n")

        parquet_files = sorted(self.interim_dir.glob("*.parquet"))

        if not parquet_files:
            print(f"❌ ERROR: No Parquet files found in {self.interim_dir}")
            print("   Run 'make data-ingest' first")
            sys.exit(1)

        print(f"Found {len(parquet_files)} Parquet files:\n")

        for file_path in parquet_files:
            dataset_name = file_path.stem
            try:
                df = pd.read_parquet(file_path)
                self.datasets[dataset_name] = df
                print(
                    f"  ✓ {dataset_name:30s} {len(df):>8,} rows × {len(df.columns):>4} columns"
                )
            except Exception as e:
                print(f"  ❌ {dataset_name:30s} ERROR: {str(e)}")

        print(f"\n✓ Loaded {len(self.datasets)} datasets successfully")

    def identify_linkage_keys(self) -> Dict[str, List[str]]:
        """
        Identify potential linkage keys across datasets.

        Returns:
            Dictionary mapping dataset names to list of potential ID columns
        """
        print(f"\n{'='*80}")
        print("  Identifying Linkage Keys")
        print(f"{'='*80}\n")

        id_patterns = [
            "research_id",
            "patient_id",
            "mrn",
            "id",
            "subject_id",
            "research_id_number",
            "patient_number",
        ]

        linkage_keys = {}

        for dataset_name, df in self.datasets.items():
            # Find columns matching ID patterns (case-insensitive)
            potential_keys = []
            for col in df.columns:
                col_lower = col.lower()
                if any(pattern in col_lower for pattern in id_patterns):
                    potential_keys.append(col)

            if potential_keys:
                linkage_keys[dataset_name] = potential_keys
                print(f"  {dataset_name:30s} → {potential_keys}")

        if not linkage_keys:
            print("  ⚠️  WARNING: No obvious linkage keys found")
            print("     Manual inspection required")

        return linkage_keys

    def normalize_patient_id(self, id_value) -> str:
        """
        Normalize patient ID to standard format.

        Handles:
        - String/integer conversion
        - Leading/trailing whitespace
        - Case normalization (lowercase)
        - Leading zeros removal
        - NaN/None/empty values

        Args:
            id_value: Raw ID value (any type)

        Returns:
            Normalized ID string, or None if invalid
        """
        # Handle None, NaN, empty
        if pd.isna(id_value) or id_value == "":
            return None

        # Convert to string
        id_str = str(id_value).strip()

        # Remove common invalid values
        if id_str.lower() in ["nan", "none", "null", ""]:
            return None

        # Normalize case
        id_str = id_str.lower()

        # Try to convert to integer (removes leading zeros and decimal points)
        try:
            # If it's a number, convert to int to remove leading zeros
            # Example: "00123" → 123, "123.0" → 123
            id_float = float(id_str)
            id_int = int(id_float)
            return str(id_int)
        except (ValueError, OverflowError):
            # If not numeric, just return cleaned string
            return id_str

    def extract_patient_ids(self, linkage_keys: Dict[str, List[str]]):
        """
        Extract unique patient IDs from each dataset with robust normalization.

        Args:
            linkage_keys: Dictionary of dataset names to ID column lists
        """
        print(f"\n{'='*80}")
        print("  Extracting Patient IDs (with robust normalization)")
        print(f"{'='*80}\n")

        for dataset_name, id_cols in linkage_keys.items():
            df = self.datasets[dataset_name]

            # Use first ID column if multiple found
            primary_id = id_cols[0]

            # Extract unique IDs with normalization
            try:
                # Apply normalization to all IDs
                normalized_ids = df[primary_id].apply(self.normalize_patient_id)

                # Remove None values and get unique IDs
                valid_ids = normalized_ids.dropna().unique()

                # Store as set for fast intersection operations
                self.patient_ids[dataset_name] = set(valid_ids)

                print(
                    f"  {dataset_name:30s} {len(valid_ids):>8,} unique patients (via '{primary_id}')"
                )
            except Exception as e:
                print(f"  ❌ {dataset_name:30s} ERROR: {str(e)}")
                self.patient_ids[dataset_name] = set()

    def analyze_cohort_overlap(self) -> Dict:
        """
        Analyze cohort overlap across modalities.

        Returns:
            Dictionary with overlap statistics
        """
        print(f"\n{'='*80}")
        print("  Analyzing Cohort Overlap")
        print(f"{'='*80}\n")

        if not self.patient_ids:
            print("  ⚠️  No patient IDs extracted")
            return {}

        # Get union of all patient IDs
        all_patients = set()
        for ids in self.patient_ids.values():
            all_patients.update(ids)

        print(f"Total unique patients across all modalities: {len(all_patients):,}\n")

        # Calculate overlap statistics
        overlap_stats = {
            "total_unique_patients": len(all_patients),
            "datasets": {},
            "pairwise_overlap": {},
            "modality_combinations": {},
        }

        # Per-dataset stats
        for dataset_name, ids in self.patient_ids.items():
            overlap_stats["datasets"][dataset_name] = {
                "unique_patients": len(ids),
                "coverage_percentage": (
                    round(len(ids) / len(all_patients) * 100, 2) if all_patients else 0
                ),
            }

        # Pairwise overlap (sample - full matrix would be large)
        dataset_names = list(self.patient_ids.keys())
        for i, ds1 in enumerate(dataset_names[:5]):  # Limit to first 5 for readability
            for ds2 in dataset_names[i + 1 : 6]:
                overlap = len(self.patient_ids[ds1] & self.patient_ids[ds2])
                key = f"{ds1}__x__{ds2}"
                overlap_stats["pairwise_overlap"][key] = overlap
                print(f"  {ds1:25s} ∩ {ds2:25s} = {overlap:>6,} patients")

        # Common patients across key modalities
        key_modalities = [
            "fna_results",
            "tumor_pathology",
            "ultrasound_reports",
            "ct_reports",
        ]
        available_key_modalities = [m for m in key_modalities if m in self.patient_ids]

        if len(available_key_modalities) >= 2:
            print(f"\n{'─'*80}")
            print("  Multi-Modal Coverage:")
            print(f"{'─'*80}\n")

            # Patients with at least 2 modalities
            multi_modal_patients = set()
            for patient in all_patients:
                modality_count = sum(
                    1 for ids in self.patient_ids.values() if patient in ids
                )
                if modality_count >= 2:
                    multi_modal_patients.add(patient)

            print(
                f"  Patients with ≥2 modalities: {len(multi_modal_patients):,} ({len(multi_modal_patients)/len(all_patients)*100:.1f}%)"
            )

            # Patients with at least 3 modalities
            tri_modal_patients = set()
            for patient in all_patients:
                modality_count = sum(
                    1 for ids in self.patient_ids.values() if patient in ids
                )
                if modality_count >= 3:
                    tri_modal_patients.add(patient)

            print(
                f"  Patients with ≥3 modalities: {len(tri_modal_patients):,} ({len(tri_modal_patients)/len(all_patients)*100:.1f}%)"
            )

            overlap_stats["modality_combinations"] = {
                "two_or_more_modalities": len(multi_modal_patients),
                "three_or_more_modalities": len(tri_modal_patients),
            }

        return overlap_stats

    def create_patient_modality_matrix(self) -> pd.DataFrame:
        """
        Create patient x modality matrix.

        Returns:
            DataFrame with patients as rows, modalities as columns (boolean)
        """
        print(f"\n{'='*80}")
        print("  Creating Patient-Modality Matrix")
        print(f"{'='*80}\n")

        # Get all unique patients
        all_patients = set()
        for ids in self.patient_ids.values():
            all_patients.update(ids)

        all_patients = sorted(all_patients)

        # Create binary matrix
        matrix_data = {}
        for dataset_name, ids in self.patient_ids.items():
            matrix_data[dataset_name] = [
                1 if patient in ids else 0 for patient in all_patients
            ]

        matrix_df = pd.DataFrame(matrix_data, index=all_patients)
        matrix_df.index.name = "patient_id"

        # Add modality count column
        matrix_df["total_modalities"] = matrix_df.sum(axis=1)

        print(
            f"  Matrix shape: {matrix_df.shape[0]:,} patients × {matrix_df.shape[1]} columns"
        )
        print(f"  Modality count distribution:")
        print(
            f"    {matrix_df['total_modalities'].value_counts().sort_index().to_dict()}"
        )

        return matrix_df

    def generate_report(self, overlap_stats: Dict, matrix_df: pd.DataFrame):
        """
        Generate human-readable linkage report.

        Args:
            overlap_stats: Overlap statistics dictionary
            matrix_df: Patient-modality matrix
        """
        print(f"\n{'='*80}")
        print("  Generating Linkage Report")
        print(f"{'='*80}\n")

        output_dir = Path("reports/qa")
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save JSON stats
        json_path = output_dir / "patient_linkage_analysis.json"
        with open(json_path, "w") as f:
            json.dump(
                {
                    **overlap_stats,
                    "generated": datetime.now().isoformat(),
                    "datasets_analyzed": len(self.datasets),
                },
                f,
                indent=2,
            )
        print(f"  ✓ JSON: {json_path}")

        # Generate markdown report
        md_path = output_dir / "patient_linkage_report.md"

        report_lines = [
            "# Patient Linkage Analysis Report",
            "",
            f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
            f"**Datasets Analyzed**: {len(self.datasets)}  ",
            f"**Total Unique Patients**: {overlap_stats['total_unique_patients']:,}",
            "",
            "---",
            "",
            "## Per-Modality Coverage",
            "",
            "| Modality | Unique Patients | Coverage % |",
            "|----------|----------------|------------|",
        ]

        for dataset_name, stats in overlap_stats["datasets"].items():
            report_lines.append(
                f"| `{dataset_name}` | {stats['unique_patients']:,} | {stats['coverage_percentage']:.1f}% |"
            )

        report_lines.extend(["", "---", "", "## Multi-Modal Coverage", ""])

        if "modality_combinations" in overlap_stats:
            total = overlap_stats["total_unique_patients"]
            two_plus = overlap_stats["modality_combinations"]["two_or_more_modalities"]
            three_plus = overlap_stats["modality_combinations"][
                "three_or_more_modalities"
            ]

            report_lines.extend(
                [
                    f"- **Patients with ≥2 modalities**: {two_plus:,} ({two_plus/total*100:.1f}%)",
                    f"- **Patients with ≥3 modalities**: {three_plus:,} ({three_plus/total*100:.1f}%)",
                    "",
                ]
            )

        report_lines.extend(["## Modality Count Distribution", "", "```"])

        dist = matrix_df["total_modalities"].value_counts().sort_index()
        for count, freq in dist.items():
            report_lines.append(
                f"{count} modalities: {freq:>6,} patients ({freq/len(matrix_df)*100:>5.1f}%)"
            )

        report_lines.extend(
            [
                "```",
                "",
                "---",
                "",
                "## Research Implications",
                "",
                "Based on discovered linkage patterns:",
                "",
                "1. **Multi-Modal Predictive Models**: ",
            ]
        )

        if "modality_combinations" in overlap_stats:
            two_plus_pct = two_plus / total * 100
            if two_plus_pct > 50:
                report_lines.append(
                    f"   - {two_plus_pct:.0f}% of patients have ≥2 modalities → strong potential for multi-modal integration"
                )
            else:
                report_lines.append(
                    f"   - {two_plus_pct:.0f}% of patients have ≥2 modalities → focus on single-modality analyses first"
                )

        report_lines.extend(
            [
                "",
                "2. **Recommended Analysis Paths**:",
                "   - Single-modality analyses: Use datasets with highest coverage",
                "   - Two-modal analyses: Focus on modalities with strong pairwise overlap",
                f"   - Three-modal analyses: Limited to {three_plus:,} patients with comprehensive data",
                "",
                "3. **Data Gaps Identified**:",
                "   - Review modalities with <50% coverage for data collection opportunities",
                "   - Prioritize linkage quality improvement for high-value low-coverage modalities",
                "",
                "---",
                "",
                f"**Next Steps**: Build feature engineering pipeline using patient-modality matrix at `data/processed/linkage_tables/patient_modality_matrix.parquet`",
            ]
        )

        with open(md_path, "w") as f:
            f.write("\n".join(report_lines))

        print(f"  ✓ Report: {md_path}")

        # Save patient-modality matrix
        matrix_dir = Path("data/processed/linkage_tables")
        matrix_dir.mkdir(parents=True, exist_ok=True)
        matrix_path = matrix_dir / "patient_modality_matrix.parquet"
        matrix_df.to_parquet(matrix_path)
        print(f"  ✓ Matrix: {matrix_path}")
        print(f"\n✓ Linkage analysis complete!")


def main():
    """Run patient linkage analysis pipeline."""
    analyzer = PatientLinkageAnalyzer()

    # Load datasets
    analyzer.load_datasets()

    # Identify linkage keys
    linkage_keys = analyzer.identify_linkage_keys()

    if not linkage_keys:
        print("\n❌ No linkage keys found. Manual inspection required.")
        sys.exit(1)

    # Extract patient IDs
    analyzer.extract_patient_ids(linkage_keys)

    # Analyze overlap
    overlap_stats = analyzer.analyze_cohort_overlap()

    # Create matrix
    matrix_df = analyzer.create_patient_modality_matrix()

    # Generate report
    analyzer.generate_report(overlap_stats, matrix_df)


if __name__ == "__main__":
    main()
