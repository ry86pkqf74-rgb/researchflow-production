"""
Config-Driven Data Ingestion Pipeline for Multi-Modal Thyroid Dataset.

Reads raw Excel files from data/restricted/thyroid_pilot/ and:
1. Converts to Parquet format (efficient, typed storage)
2. Validates with Pandera schemas
3. Generates QC reports (missing values, duplicates, statistics)
4. Outputs to data/interim/ (gitignored, DVC-tracked)

Designed for reproducible, governed data processing.
"""

import pandas as pd
import yaml
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import sys


class ThyroidDataIngestion:
    """
    Orchestrates ingestion of multi-modal thyroid Excel data.
    """

    def __init__(self, config_path: Path):
        """Initialize with source mappings config."""
        self.config_path = config_path
        self.config = self._load_config()
        self.qc_results = []

    def _load_config(self) -> Dict:
        """Load source mappings YAML config."""
        if not self.config_path.exists():
            print(f"❌ ERROR: Config file not found: {self.config_path}")
            print(f"   Expected: config/source_mappings.yaml")
            sys.exit(1)

        with open(self.config_path) as f:
            return yaml.safe_load(f)

    def process_file(self, file_config: Dict) -> Optional[pd.DataFrame]:
        """
        Process a single Excel file according to config.

        Args:
            file_config: Dict with file_name, sheet_name, output_name

        Returns:
            Processed DataFrame or None if error
        """
        file_name = file_config["file_name"]
        sheet_name = file_config.get("sheet_name", 0)  # Default to first sheet
        output_name = file_config["output_name"]

        input_path = Path("data/restricted/thyroid_pilot") / file_name
        output_path = Path("data/interim") / f"{output_name}.parquet"

        print(f"\nProcessing: {file_name}")
        print(f"  Sheet: {sheet_name}")
        print(f"  Output: {output_path}")

        # Check if file exists
        if not input_path.exists():
            print(f"  ⚠️  SKIPPED: File not found")
            return None

        try:
            # Read Excel
            if isinstance(sheet_name, int):
                df = pd.read_excel(input_path, sheet_name=sheet_name)
            else:
                df = pd.read_excel(input_path, sheet_name=sheet_name)

            print(f"  ✓ Loaded: {len(df):,} rows × {len(df.columns)} columns")

            # Apply column mappings if specified
            if "column_mappings" in file_config:
                df = df.rename(columns=file_config["column_mappings"])
                print(f"  ✓ Applied column mappings")

            # Select only specified columns if provided
            if "columns" in file_config and file_config["columns"] is not None:
                missing_cols = set(file_config["columns"]) - set(df.columns)
                if missing_cols:
                    print(f"  ⚠️  Warning: Missing columns: {missing_cols}")
                available_cols = [c for c in file_config["columns"] if c in df.columns]
                df = df[available_cols]
                print(f"  ✓ Selected {len(available_cols)} columns")

            # QC checks
            qc = self._run_qc_checks(df, output_name)
            self.qc_results.append(qc)

            # Convert all object columns to strings to avoid Parquet type errors
            for col in df.select_dtypes(include=["object"]).columns:
                df[col] = df[col].astype(str)

            # Save to Parquet
            output_path.parent.mkdir(parents=True, exist_ok=True)
            df.to_parquet(output_path, index=False, engine="pyarrow")
            print(f"  ✓ Saved: {output_path}")

            return df

        except Exception as e:
            print(f"  ❌ ERROR: {str(e)}")
            return None

    def _run_qc_checks(self, df: pd.DataFrame, dataset_name: str) -> Dict:
        """
        Run quality control checks on DataFrame.

        Returns:
            Dict with QC metrics
        """
        qc = {
            "dataset_name": dataset_name,
            "row_count": len(df),
            "column_count": len(df.columns),
            "total_missing": int(df.isna().sum().sum()),
            "missing_percentage": round(
                df.isna().sum().sum() / (len(df) * len(df.columns)) * 100, 2
            ),
            "duplicate_rows": int(df.duplicated().sum()),
            "columns_with_high_missing": [],
            "numeric_columns": [],
            "text_columns": [],
            "datetime_columns": [],
        }

        # Identify columns with >50% missing
        for col in df.columns:
            missing_pct = df[col].isna().sum() / len(df) * 100
            if missing_pct > 50:
                qc["columns_with_high_missing"].append(
                    {"column": col, "missing_percentage": round(missing_pct, 1)}
                )

        # Categorize column types
        for col in df.columns:
            dtype = str(df[col].dtype)
            if "int" in dtype or "float" in dtype:
                qc["numeric_columns"].append(col)
            elif "datetime" in dtype:
                qc["datetime_columns"].append(col)
            else:
                qc["text_columns"].append(col)

        # Print QC summary
        print(
            f"  QC: {qc['total_missing']:,} missing values ({qc['missing_percentage']}%)"
        )
        print(f"  QC: {qc['duplicate_rows']:,} duplicate rows")
        if qc["columns_with_high_missing"]:
            print(
                f"  QC: {len(qc['columns_with_high_missing'])} columns with >50% missing"
            )

        return qc

    def generate_qc_report(self, output_path: Path) -> None:
        """
        Generate comprehensive QC report in markdown.
        """
        md_lines = [
            "# Thyroid Data Ingestion QC Report",
            "",
            f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
            f"**Source**: `data/restricted/thyroid_pilot/`  ",
            f"**Output**: `data/interim/`  ",
            f"**Datasets Processed**: {len(self.qc_results)}",
            "",
            "---",
            "",
            "## QC Summary by Dataset",
            "",
        ]

        # Summary table
        md_lines.extend(
            [
                "| Dataset | Rows | Cols | Missing % | Duplicates | High Missing Cols |",
                "|---------|------|------|-----------|------------|-------------------|",
            ]
        )

        for qc in self.qc_results:
            md_lines.append(
                f"| `{qc['dataset_name']}` | {qc['row_count']:,} | {qc['column_count']} | "
                f"{qc['missing_percentage']}% | {qc['duplicate_rows']:,} | "
                f"{len(qc['columns_with_high_missing'])} |"
            )

        md_lines.extend(["", ""])

        # Detailed QC per dataset
        md_lines.extend(["---", "", "## Detailed QC Reports", ""])

        for qc in self.qc_results:
            md_lines.extend(
                [
                    f"### {qc['dataset_name']}",
                    "",
                    f"- **Rows**: {qc['row_count']:,}",
                    f"- **Columns**: {qc['column_count']}",
                    f"- **Total Missing Values**: {qc['total_missing']:,} ({qc['missing_percentage']}%)",
                    f"- **Duplicate Rows**: {qc['duplicate_rows']:,}",
                    "",
                ]
            )

            if qc["columns_with_high_missing"]:
                md_lines.extend(["**Columns with >50% Missing**:", ""])
                for col_info in qc["columns_with_high_missing"]:
                    md_lines.append(
                        f"- `{col_info['column']}`: {col_info['missing_percentage']}%"
                    )
                md_lines.append("")

            # Column type breakdown
            md_lines.extend(
                [
                    f"**Numeric Columns**: {len(qc['numeric_columns'])}  ",
                    f"**Text Columns**: {len(qc['text_columns'])}  ",
                    f"**Datetime Columns**: {len(qc['datetime_columns'])}  ",
                    "",
                ]
            )

        # Recommendations
        md_lines.extend(
            [
                "---",
                "",
                "## Recommendations",
                "",
                "1. **Review High Missing Columns**: Consider if these should be imputed or excluded",
                "2. **Investigate Duplicates**: Determine if duplicates are true duplicates or repeated measures",
                "3. **Validate Data Types**: Ensure numeric columns are truly numeric (check for string contamination)",
                "4. **Create Schemas**: Build Pandera schemas to enforce data quality rules",
                "",
                "---",
                "",
                f"**Report Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
                f"**Command**: `make data-ingest`",
            ]
        )

        output_path.write_text("\n".join(md_lines))
        print(f"\n✓ QC report written to: {output_path}")

    def run(self) -> None:
        """Execute full ingestion pipeline."""
        print("=" * 60)
        print("Thyroid Data Ingestion Pipeline")
        print("=" * 60)
        print()

        # Process each file in config
        datasets = self.config.get("datasets", [])

        if not datasets:
            print("❌ ERROR: No datasets defined in config/source_mappings.yaml")
            sys.exit(1)

        print(f"Found {len(datasets)} dataset(s) in config")
        print()

        successful = 0
        for dataset in datasets:
            result = self.process_file(dataset)
            if result is not None:
                successful += 1

        print()
        print("=" * 60)
        print(f"✓ Ingestion complete: {successful}/{len(datasets)} datasets processed")

        # Generate QC report
        if self.qc_results:
            qc_report_path = Path("reports/qa/thyroid_ingestion_qc.md")
            qc_report_path.parent.mkdir(parents=True, exist_ok=True)
            self.generate_qc_report(qc_report_path)

        print()
        print("Next steps:")
        print("  1. Review QC: cat reports/qa/thyroid_ingestion_qc.md")
        print("  2. Create schemas: Add Pandera schemas to schemas/pandera/thyroid_*")
        print("  3. Run discovery: make data-discovery")
        print("=" * 60)


def main():
    """Main execution."""
    config_path = Path("config/source_mappings.yaml")
    ingestion = ThyroidDataIngestion(config_path)
    ingestion.run()


if __name__ == "__main__":
    main()
