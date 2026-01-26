#!/usr/bin/env python3
"""
Feature Engineering for Malignancy Prediction

This script processes the multi-modal thyroid dataset to derive features for
malignancy prediction. It integrates data from:
- FNA cytology (Bethesda classification)
- Imaging (TI-RADS, nodule characteristics)
- Pathology (tumor characteristics, AJCC8 staging)
- Laboratory values (TSH, thyroglobulin, anti-Tg antibody)
- Clinical measurements (thyroid volumes, weights)

Outputs:
- malignancy_labels.parquet: Ground truth labels (benign vs. malignant)
- aggregated_labs.parquet: Summary statistics for longitudinal lab values
- imaging_features.parquet: TI-RADS scores, nodule sizes, volumes
- clinical_features.parquet: Demographics, surgery types, gland measurements
- feature_matrix.parquet: Integrated feature matrix for modeling

Author: Research Operating System
Date: 2025-12-22
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import warnings

warnings.filterwarnings("ignore")

# Add project root to path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))


class FeatureEngineer:
    """Feature engineering pipeline for malignancy prediction."""

    def __init__(self, interim_dir: Path = None, output_dir: Path = None):
        """
        Initialize feature engineer.

        Args:
            interim_dir: Directory containing ingested Parquet files
            output_dir: Directory to save derived features
        """
        self.interim_dir = interim_dir or project_root / "data" / "interim"
        self.output_dir = output_dir or project_root / "data" / "processed" / "marts"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.datasets = {}
        self.features = {}

    def load_datasets(self):
        """Load all relevant Parquet files."""
        print(f"\n{'='*80}")
        print("  Loading Datasets for Feature Engineering")
        print(f"{'='*80}\n")

        # Define required datasets
        dataset_files = {
            "fna": "fna_results.parquet",
            "benign_path": "benign_pathology.parquet",
            "tumor_path": "tumor_pathology.parquet",
            "ultrasound": "ultrasound_reports.parquet",
            "thyroid_sizes": "thyroid_sizes.parquet",
            "thyroid_weights": "thyroid_weight_data.parquet",
            "anti_tg": "anti_thyroglobulin_antibody_wide.parquet",
            "thyroglobulin": "thyroglobulin_wide.parquet",
            "ct_reports": "ct_reports.parquet",
            "mri_reports": "mri_reports.parquet",
            "nuclear_med": "nuclear_medicine.parquet",
        }

        for key, filename in dataset_files.items():
            filepath = self.interim_dir / filename
            if filepath.exists():
                self.datasets[key] = pd.read_parquet(filepath)
                print(f"✓ Loaded {key}: {len(self.datasets[key]):,} rows")
            else:
                print(f"⚠ Warning: {filename} not found (skipping)")
                self.datasets[key] = None

        print(f"\n{'='*80}\n")

    def derive_malignancy_labels(self) -> pd.DataFrame:
        """
        Derive ground truth malignancy labels from pathology data.

        Strategy:
        1. Tumor pathology → Malignant (has malignant diagnosis)
        2. Benign pathology → Benign (has benign diagnosis, no tumor path record)
        3. FNA Bethesda VI (Malignant) + no pathology → Presumed malignant
        4. FNA Bethesda II (Benign) + no pathology → Presumed benign

        Returns:
            DataFrame with columns: research_id, malignancy_label, label_source, confidence
        """
        print("Deriving malignancy labels...")

        labels = []

        # 1. Extract malignant cases from tumor pathology
        if self.datasets["tumor_path"] is not None:
            tumor_df = self.datasets["tumor_path"].copy()

            # Identify linkage key (handle variations)
            id_col = self._find_id_column(tumor_df)

            if id_col:
                malignant_ids = tumor_df[id_col].unique()
                for rid in malignant_ids:
                    labels.append(
                        {
                            "research_id": self._normalize_id(rid),
                            "malignancy_label": 1,  # Malignant
                            "label_source": "tumor_pathology",
                            "confidence": "definitive",
                            "diagnosis_type": "pathology_confirmed",
                        }
                    )
                print(
                    f"  ✓ {len(malignant_ids):,} malignant cases from tumor pathology"
                )

        # 2. Extract benign cases from benign pathology
        if self.datasets["benign_path"] is not None:
            benign_df = self.datasets["benign_path"].copy()

            id_col = self._find_id_column(benign_df)

            if id_col:
                benign_ids = benign_df[id_col].unique()

                # Exclude IDs already marked as malignant
                malignant_set = {l["research_id"] for l in labels}
                benign_only = [
                    rid
                    for rid in benign_ids
                    if self._normalize_id(rid) not in malignant_set
                ]

                for rid in benign_only:
                    labels.append(
                        {
                            "research_id": self._normalize_id(rid),
                            "malignancy_label": 0,  # Benign
                            "label_source": "benign_pathology",
                            "confidence": "definitive",
                            "diagnosis_type": "pathology_confirmed",
                        }
                    )
                print(f"  ✓ {len(benign_only):,} benign cases from benign pathology")

        # 3. Add presumptive labels from FNA Bethesda (for cases without pathology)
        if self.datasets["fna"] is not None:
            fna_df = self.datasets["fna"].copy()

            id_col = self._find_id_column(fna_df)

            if id_col and "bethesda_2023_num" in fna_df.columns:
                labeled_ids = {l["research_id"] for l in labels}

                # Bethesda VI (Malignant) - score 6
                bethesda_6 = fna_df[fna_df["bethesda_2023_num"] == 6.0]
                for rid in bethesda_6[id_col].unique():
                    norm_id = self._normalize_id(rid)
                    if norm_id not in labeled_ids:
                        labels.append(
                            {
                                "research_id": norm_id,
                                "malignancy_label": 1,
                                "label_source": "fna_bethesda_vi",
                                "confidence": "high",
                                "diagnosis_type": "fna_presumptive",
                            }
                        )
                        labeled_ids.add(norm_id)

                # Bethesda II (Benign) - score 2
                bethesda_2 = fna_df[fna_df["bethesda_2023_num"] == 2.0]
                for rid in bethesda_2[id_col].unique():
                    norm_id = self._normalize_id(rid)
                    if norm_id not in labeled_ids:
                        labels.append(
                            {
                                "research_id": norm_id,
                                "malignancy_label": 0,
                                "label_source": "fna_bethesda_ii",
                                "confidence": "high",
                                "diagnosis_type": "fna_presumptive",
                            }
                        )
                        labeled_ids.add(norm_id)

                print(f"  ✓ Added presumptive labels from FNA Bethesda")

        labels_df = pd.DataFrame(labels)

        if len(labels_df) > 0:
            print(f"\n  Total labeled cases: {len(labels_df):,}")
            print(f"    - Malignant: {(labels_df['malignancy_label'] == 1).sum():,}")
            print(f"    - Benign: {(labels_df['malignancy_label'] == 0).sum():,}")
            print(
                f"    - Definitive: {(labels_df['confidence'] == 'definitive').sum():,}"
            )
            print(f"    - Presumptive: {(labels_df['confidence'] == 'high').sum():,}")

        return labels_df

    def aggregate_labs(self) -> pd.DataFrame:
        """
        Aggregate longitudinal lab values into summary features.

        Features derived:
        - Thyroglobulin: mean, median, min, max, std, first, last, trend
        - Anti-Tg antibody: mean, median, min, max, std, first, last, trend
        - Test frequency: number of tests, time span

        Returns:
            DataFrame with aggregated lab features per patient
        """
        print("\nAggregating laboratory values...")

        lab_features = []

        # Process Anti-Tg antibody
        if self.datasets["anti_tg"] is not None:
            anti_tg_df = self.datasets["anti_tg"].copy()
            id_col = self._find_id_column(anti_tg_df)

            if id_col:
                for rid in anti_tg_df[id_col].unique():
                    patient_labs = anti_tg_df[anti_tg_df[id_col] == rid].iloc[0]

                    # Extract lab results (lab1_result through labN_result)
                    result_cols = [
                        c
                        for c in anti_tg_df.columns
                        if c.startswith("lab") and c.endswith("_result")
                    ]
                    date_cols = [
                        c
                        for c in anti_tg_df.columns
                        if c.startswith("lab") and c.endswith("_specimen_collect_dt")
                    ]

                    results = []
                    dates = []

                    for res_col, date_col in zip(result_cols, date_cols):
                        if pd.notna(patient_labs.get(res_col)):
                            # Parse numeric value (handle <, >, inequalities)
                            val = self._parse_lab_value(str(patient_labs[res_col]))
                            if val is not None:
                                results.append(val)
                                if pd.notna(patient_labs.get(date_col)):
                                    dates.append(patient_labs[date_col])

                    if results:
                        features = self._compute_lab_stats(
                            self._normalize_id(rid), results, dates, "anti_tg"
                        )
                        lab_features.append(features)

                print(
                    f"  ✓ Aggregated anti-Tg antibody for {len(lab_features):,} patients"
                )

        # Process Thyroglobulin
        if self.datasets["thyroglobulin"] is not None:
            tg_df = self.datasets["thyroglobulin"].copy()
            id_col = self._find_id_column(tg_df)

            if id_col:
                tg_count = 0
                for rid in tg_df[id_col].unique():
                    patient_labs = tg_df[tg_df[id_col] == rid].iloc[0]

                    result_cols = [
                        c
                        for c in tg_df.columns
                        if c.startswith("lab") and c.endswith("_result")
                    ]
                    date_cols = [
                        c
                        for c in tg_df.columns
                        if c.startswith("lab") and c.endswith("_specimen_collect_dt")
                    ]

                    results = []
                    dates = []

                    for res_col, date_col in zip(result_cols, date_cols):
                        if pd.notna(patient_labs.get(res_col)):
                            val = self._parse_lab_value(str(patient_labs[res_col]))
                            if val is not None:
                                results.append(val)
                                if pd.notna(patient_labs.get(date_col)):
                                    dates.append(patient_labs[date_col])

                    if results:
                        norm_id = self._normalize_id(rid)
                        features = self._compute_lab_stats(
                            norm_id, results, dates, "thyroglobulin"
                        )

                        # Merge with existing record or create new
                        existing = next(
                            (f for f in lab_features if f["research_id"] == norm_id),
                            None,
                        )
                        if existing:
                            existing.update(features)
                        else:
                            lab_features.append(features)
                        tg_count += 1

                print(f"  ✓ Aggregated thyroglobulin for {tg_count:,} patients")

        labs_df = pd.DataFrame(lab_features)

        if len(labs_df) > 0:
            print(f"\n  Total patients with lab features: {len(labs_df):,}")

        return labs_df

    def extract_imaging_features(self) -> pd.DataFrame:
        """
        Extract imaging features from ultrasound, CT, MRI.

        Features:
        - TI-RADS scores (from ultrasound)
        - Nodule sizes, volumes, counts
        - Thyroid dimensions and volumes
        - Imaging findings (calcifications, vascularity, etc.)

        Returns:
            DataFrame with imaging features per patient
        """
        print("\nExtracting imaging features...")

        imaging_features = []

        # Extract TI-RADS from ultrasound
        if self.datasets["ultrasound"] is not None:
            us_df = self.datasets["ultrasound"].copy()
            id_col = self._find_id_column(us_df)

            if id_col:
                # Group by patient and aggregate TI-RADS scores
                tirads_cols = [
                    c
                    for c in us_df.columns
                    if "tirads" in c.lower() or "ti-rads" in c.lower()
                ]

                for rid in us_df[id_col].unique():
                    patient_us = us_df[us_df[id_col] == rid]

                    features = {"research_id": self._normalize_id(rid)}

                    # Extract TI-RADS scores (if available)
                    for col in tirads_cols:
                        if col in patient_us.columns:
                            # Get max TI-RADS score (worst nodule)
                            scores = pd.to_numeric(
                                patient_us[col], errors="coerce"
                            ).dropna()
                            if len(scores) > 0:
                                features[f"{col}_max"] = scores.max()
                                features[f"{col}_mean"] = scores.mean()

                    # Nodule characteristics
                    nodule_cols = [c for c in us_df.columns if "nodule" in c.lower()]
                    features["nodule_count"] = len(patient_us)

                    # Size features (if available)
                    size_cols = [
                        c
                        for c in us_df.columns
                        if "size" in c.lower() or "dimension" in c.lower()
                    ]
                    for col in size_cols:
                        if col in patient_us.columns:
                            sizes = pd.to_numeric(
                                patient_us[col], errors="coerce"
                            ).dropna()
                            if len(sizes) > 0:
                                features[f"{col}_max"] = sizes.max()
                                features[f"{col}_mean"] = sizes.mean()

                    imaging_features.append(features)

                print(
                    f"  ✓ Extracted ultrasound features for {len(imaging_features):,} patients"
                )

        # Extract thyroid volume measurements
        if self.datasets["thyroid_sizes"] is not None:
            sizes_df = self.datasets["thyroid_sizes"].copy()
            id_col = self._find_id_column(sizes_df)

            if id_col:
                volume_cols = [
                    c
                    for c in sizes_df.columns
                    if "volume" in c.lower() and "cm3" in c.lower()
                ]

                for rid in sizes_df[id_col].unique():
                    patient_sizes = sizes_df[sizes_df[id_col] == rid].iloc[0]
                    norm_id = self._normalize_id(rid)

                    # Find or create feature record
                    existing = next(
                        (f for f in imaging_features if f["research_id"] == norm_id),
                        None,
                    )
                    if not existing:
                        existing = {"research_id": norm_id}
                        imaging_features.append(existing)

                    # Extract volume features
                    for col in volume_cols:
                        if col in patient_sizes.index and pd.notna(patient_sizes[col]):
                            existing[col] = patient_sizes[col]

                print(f"  ✓ Added thyroid volume features")

        imaging_df = pd.DataFrame(imaging_features)

        if len(imaging_df) > 0:
            print(f"\n  Total patients with imaging features: {len(imaging_df):,}")

        return imaging_df

    def extract_clinical_features(self) -> pd.DataFrame:
        """
        Extract clinical features from pathology and demographics.

        Features:
        - Age at diagnosis/surgery
        - Gender
        - Surgery type
        - Gland weight and dimensions
        - Tumor characteristics (size, capsular invasion, etc.)

        Returns:
            DataFrame with clinical features per patient
        """
        print("\nExtracting clinical features...")

        clinical_features = []

        # Extract from benign pathology
        if self.datasets["benign_path"] is not None:
            benign_df = self.datasets["benign_path"].copy()
            id_col = self._find_id_column(benign_df)

            if id_col:
                for rid in benign_df[id_col].unique():
                    patient_path = benign_df[benign_df[id_col] == rid].iloc[0]

                    features = {"research_id": self._normalize_id(rid)}

                    # Demographics
                    if "age_at_surgery" in patient_path.index:
                        features["age_at_surgery"] = patient_path["age_at_surgery"]
                    if "sex" in patient_path.index or "gender" in patient_path.index:
                        gender_col = "sex" if "sex" in patient_path.index else "gender"
                        features["gender"] = patient_path[gender_col]

                    # Surgery type
                    if "surgery_type" in patient_path.index:
                        features["surgery_type"] = patient_path["surgery_type"]

                    # Gland measurements
                    weight_cols = [
                        c for c in benign_df.columns if "weight" in c.lower()
                    ]
                    dim_cols = [c for c in benign_df.columns if "dim" in c.lower()]

                    for col in weight_cols + dim_cols:
                        if col in patient_path.index and pd.notna(patient_path[col]):
                            features[col] = patient_path[col]

                    clinical_features.append(features)

                print(
                    f"  ✓ Extracted clinical features from benign pathology: {len(clinical_features):,} patients"
                )

        # Extract from tumor pathology (malignant cases)
        if self.datasets["tumor_path"] is not None:
            tumor_df = self.datasets["tumor_path"].copy()
            id_col = self._find_id_column(tumor_df)

            if id_col:
                tumor_count = 0
                for rid in tumor_df[id_col].unique():
                    patient_tumor = tumor_df[tumor_df[id_col] == rid].iloc[0]
                    norm_id = self._normalize_id(rid)

                    # Find or create feature record
                    existing = next(
                        (f for f in clinical_features if f["research_id"] == norm_id),
                        None,
                    )
                    if not existing:
                        existing = {"research_id": norm_id}
                        clinical_features.append(existing)

                    # Tumor characteristics (tumor_1 features)
                    tumor_cols = [
                        "tumor_1_size_cm",
                        "tumor_1_histology",
                        "tumor_1_capsular_invasion",
                        "tumor_1_lymphatic_invasion",
                        "tumor_1_vascular_invasion",
                        "tumor_1_gross_ete",
                        "histology_1_T_stage_ajcc8",
                        "histology_1_N_stage_ajcc8",
                        "histology_1_M_stage_ajcc8",
                        "histology_1_overall_stage_ajcc8",
                    ]

                    for col in tumor_cols:
                        if col in patient_tumor.index and pd.notna(patient_tumor[col]):
                            existing[col] = patient_tumor[col]

                    tumor_count += 1

                print(f"  ✓ Added tumor characteristics for {tumor_count:,} patients")

        # Extract from FNA for Bethesda scores
        if self.datasets["fna"] is not None:
            fna_df = self.datasets["fna"].copy()
            id_col = self._find_id_column(fna_df)

            if id_col:
                fna_count = 0
                for rid in fna_df[id_col].unique():
                    patient_fna = fna_df[fna_df[id_col] == rid]
                    norm_id = self._normalize_id(rid)

                    # Find or create feature record
                    existing = next(
                        (f for f in clinical_features if f["research_id"] == norm_id),
                        None,
                    )
                    if not existing:
                        existing = {"research_id": norm_id}
                        clinical_features.append(existing)

                    # Bethesda scores (use most recent or max)
                    bethesda_cols = [
                        "bethesda_2023_num",
                        "bethesda_2015_num",
                        "bethesda_2010_num",
                    ]
                    for col in bethesda_cols:
                        if col in patient_fna.columns:
                            scores = patient_fna[col].dropna()
                            if len(scores) > 0:
                                existing[f"{col}_max"] = scores.max()
                                existing[f"{col}_latest"] = scores.iloc[-1]

                    fna_count += 1

                print(f"  ✓ Added FNA Bethesda scores for {fna_count:,} patients")

        clinical_df = pd.DataFrame(clinical_features)

        if len(clinical_df) > 0:
            print(f"\n  Total patients with clinical features: {len(clinical_df):,}")

        return clinical_df

    def create_feature_matrix(
        self,
        labels_df: pd.DataFrame,
        labs_df: pd.DataFrame,
        imaging_df: pd.DataFrame,
        clinical_df: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Integrate all feature sources into a single feature matrix.

        Args:
            labels_df: Malignancy labels
            labs_df: Aggregated lab features
            imaging_df: Imaging features
            clinical_df: Clinical features

        Returns:
            Integrated feature matrix with all features per patient
        """
        print("\nCreating integrated feature matrix...")

        # Start with labels as base
        feature_matrix = labels_df.copy()

        # Merge lab features
        if len(labs_df) > 0:
            feature_matrix = feature_matrix.merge(labs_df, on="research_id", how="left")
            print(f"  ✓ Merged lab features: {len(labs_df.columns)-1} columns")

        # Merge imaging features
        if len(imaging_df) > 0:
            feature_matrix = feature_matrix.merge(
                imaging_df, on="research_id", how="left"
            )
            print(f"  ✓ Merged imaging features: {len(imaging_df.columns)-1} columns")

        # Merge clinical features
        if len(clinical_df) > 0:
            feature_matrix = feature_matrix.merge(
                clinical_df, on="research_id", how="left"
            )
            print(f"  ✓ Merged clinical features: {len(clinical_df.columns)-1} columns")

        print(
            f"\n  Final feature matrix: {len(feature_matrix):,} patients × {len(feature_matrix.columns)} features"
        )

        # Feature completeness report
        completeness = (
            feature_matrix.notna().sum() / len(feature_matrix) * 100
        ).sort_values(ascending=False)
        print(f"\n  Feature completeness (top 10):")
        for col, pct in completeness.head(10).items():
            print(f"    - {col}: {pct:.1f}%")

        return feature_matrix

    def save_features(
        self,
        labels_df: pd.DataFrame,
        labs_df: pd.DataFrame,
        imaging_df: pd.DataFrame,
        clinical_df: pd.DataFrame,
        feature_matrix: pd.DataFrame,
    ):
        """Save all derived features to Parquet files."""
        print(f"\n{'='*80}")
        print("  Saving Derived Features")
        print(f"{'='*80}\n")

        outputs = {
            "malignancy_labels.parquet": labels_df,
            "aggregated_labs.parquet": labs_df,
            "imaging_features.parquet": imaging_df,
            "clinical_features.parquet": clinical_df,
            "feature_matrix.parquet": feature_matrix,
        }

        for filename, df in outputs.items():
            if len(df) > 0:
                filepath = self.output_dir / filename
                df.to_parquet(filepath, index=False)
                print(
                    f"✓ Saved {filename}: {len(df):,} rows × {len(df.columns)} columns"
                )
            else:
                print(f"⚠ Skipped {filename}: No data")

        print(f"\n{'='*80}\n")

    def run(self):
        """Execute full feature engineering pipeline."""
        print(f"\n{'='*80}")
        print("  FEATURE ENGINEERING PIPELINE")
        print(f"  Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*80}\n")

        # Load data
        self.load_datasets()

        # Derive features
        labels_df = self.derive_malignancy_labels()
        labs_df = self.aggregate_labs()
        imaging_df = self.extract_imaging_features()
        clinical_df = self.extract_clinical_features()

        # Create integrated matrix
        feature_matrix = self.create_feature_matrix(
            labels_df, labs_df, imaging_df, clinical_df
        )

        # Save outputs
        self.save_features(labels_df, labs_df, imaging_df, clinical_df, feature_matrix)

        print("✅ Feature engineering complete!\n")

        return feature_matrix

    # Helper methods

    def _find_id_column(self, df: pd.DataFrame) -> Optional[str]:
        """Find the patient ID column (handles naming variations)."""
        id_patterns = [
            "research_id_number",
            "research_id",
            "researchid",
            "record_id",
            "patient_id",
        ]

        for pattern in id_patterns:
            matches = [c for c in df.columns if pattern in c.lower()]
            if matches:
                return matches[0]

        return None

    def _normalize_id(self, rid) -> str:
        """Normalize patient ID (handles case, leading zeros, spacing)."""
        if pd.isna(rid):
            return None

        # Convert to string
        rid_str = str(rid).strip().upper()

        # Remove leading zeros
        if rid_str.isdigit():
            rid_str = str(int(rid_str))

        return rid_str

    def _parse_lab_value(self, value_str: str) -> Optional[float]:
        """Parse lab result value (handles <, >, inequalities)."""
        if pd.isna(value_str) or value_str == "":
            return None

        # Remove inequality symbols
        value_str = str(value_str).strip()
        value_str = (
            value_str.replace("<", "")
            .replace(">", "")
            .replace("≤", "")
            .replace("≥", "")
        )

        try:
            return float(value_str)
        except ValueError:
            return None

    def _compute_lab_stats(
        self, research_id: str, results: List[float], dates: List, lab_type: str
    ) -> Dict:
        """Compute summary statistics for longitudinal lab values."""
        features = {
            "research_id": research_id,
            f"{lab_type}_mean": np.mean(results),
            f"{lab_type}_median": np.median(results),
            f"{lab_type}_min": np.min(results),
            f"{lab_type}_max": np.max(results),
            f"{lab_type}_std": np.std(results),
            f"{lab_type}_count": len(results),
            f"{lab_type}_first": results[0],
            f"{lab_type}_last": results[-1],
        }

        # Compute trend (if multiple values)
        if len(results) >= 2:
            features[f"{lab_type}_trend"] = results[-1] - results[0]
            features[f"{lab_type}_trend_pct"] = (
                ((results[-1] - results[0]) / results[0] * 100)
                if results[0] != 0
                else 0
            )

        # Time span (if dates available)
        if len(dates) >= 2:
            dates_sorted = sorted([pd.to_datetime(d) for d in dates])
            time_span = (dates_sorted[-1] - dates_sorted[0]).days
            features[f"{lab_type}_timespan_days"] = time_span

        return features


def main():
    """Main execution function."""
    engineer = FeatureEngineer()
    feature_matrix = engineer.run()

    print("Feature engineering pipeline completed successfully.")
    print(f"Output directory: {engineer.output_dir}")

    return feature_matrix


if __name__ == "__main__":
    main()
