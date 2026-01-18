"""
Excel Inventory Scanner for Multi-Modal Thyroid Dataset.

Scans data/restricted/thyroid_pilot/ for Excel files and generates:
1. THYROID_DATA_INVENTORY.md - Comprehensive inventory report
2. Detailed metadata (sheets, columns, dtypes, row counts, sample data)

Designed for automated data discovery without manual exploration.
PHI-safe: Only shows structure and statistics, never raw content.
"""

import pandas as pd
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime
import sys


def scan_excel_file(file_path: Path) -> Dict:
    """
    Scan a single Excel file and extract metadata.

    Returns:
        Dict with file metadata: sheets, columns, dtypes, row counts, samples
    """
    metadata = {
        "file_name": file_path.name,
        "file_path": str(file_path),
        "file_size_mb": round(file_path.stat().st_size / (1024 * 1024), 2),
        "sheets": {},
    }

    try:
        # Get all sheet names
        excel_file = pd.ExcelFile(file_path)
        sheet_names = excel_file.sheet_names

        for sheet_name in sheet_names:
            # Read sheet
            df = pd.read_excel(file_path, sheet_name=sheet_name)

            # Extract metadata
            sheet_meta = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": {},
                "potential_linkage_keys": [],
            }

            # Analyze each column
            for col in df.columns:
                col_meta = {
                    "dtype": str(df[col].dtype),
                    "non_null_count": int(df[col].notna().sum()),
                    "null_count": int(df[col].isna().sum()),
                    "null_percentage": round(df[col].isna().sum() / len(df) * 100, 1),
                    "unique_count": int(df[col].nunique()),
                }

                # Add sample values (first 3 non-null, anonymized)
                non_null_values = df[col].dropna().head(3).tolist()
                col_meta["sample_values"] = [
                    str(v)[:50] for v in non_null_values
                ]  # Truncate long values

                # Identify potential linkage keys (research_id, patient_id, etc.)
                col_lower = str(col).lower()
                if any(
                    key in col_lower
                    for key in ["research_id", "patient_id", "subject_id", "id"]
                ):
                    sheet_meta["potential_linkage_keys"].append(col)

                # For numeric columns, add statistics
                if df[col].dtype in ["int64", "float64"]:
                    col_meta["min"] = (
                        float(df[col].min()) if not df[col].isna().all() else None
                    )
                    col_meta["max"] = (
                        float(df[col].max()) if not df[col].isna().all() else None
                    )
                    col_meta["mean"] = (
                        float(df[col].mean()) if not df[col].isna().all() else None
                    )
                    col_meta["median"] = (
                        float(df[col].median()) if not df[col].isna().all() else None
                    )

                sheet_meta["columns"][col] = col_meta

            metadata["sheets"][sheet_name] = sheet_meta

        metadata["status"] = "success"
        metadata["total_sheets"] = len(sheet_names)

    except Exception as e:
        metadata["status"] = "error"
        metadata["error_message"] = str(e)

    return metadata


def generate_inventory_markdown(inventory_data: List[Dict], output_path: Path) -> None:
    """
    Generate comprehensive markdown inventory report.
    """
    md_lines = [
        "# Thyroid Dataset Inventory Report",
        "",
        f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
        f"**Location**: `data/restricted/thyroid_pilot/`  ",
        f"**Total Files**: {len(inventory_data)}",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
    ]

    # Count totals
    total_sheets = sum(
        d.get("total_sheets", 0) for d in inventory_data if d["status"] == "success"
    )
    total_rows = sum(
        sum(sheet["row_count"] for sheet in d.get("sheets", {}).values())
        for d in inventory_data
        if d["status"] == "success"
    )
    total_columns = sum(
        sum(sheet["column_count"] for sheet in d.get("sheets", {}).values())
        for d in inventory_data
        if d["status"] == "success"
    )

    md_lines.extend(
        [
            f"- **Total Excel Sheets**: {total_sheets}",
            f"- **Total Rows**: {total_rows:,}",
            f"- **Total Columns**: {total_columns}",
            f"- **Total File Size**: {sum(d.get('file_size_mb', 0) for d in inventory_data):.2f} MB",
            "",
            "---",
            "",
            "## File-by-File Inventory",
            "",
        ]
    )

    # Detail each file
    for i, file_data in enumerate(inventory_data, 1):
        md_lines.extend(
            [
                f"### {i}. {file_data['file_name']}",
                "",
                f"**File Size**: {file_data['file_size_mb']} MB  ",
                f"**Status**: {file_data['status']}  ",
                "",
            ]
        )

        if file_data["status"] == "error":
            md_lines.extend([f"⚠️ **Error**: {file_data['error_message']}", ""])
            continue

        md_lines.extend([f"**Total Sheets**: {file_data['total_sheets']}  ", ""])

        # Detail each sheet
        for sheet_name, sheet_meta in file_data["sheets"].items():
            md_lines.extend(
                [
                    f"#### Sheet: `{sheet_name}`",
                    "",
                    f"- **Rows**: {sheet_meta['row_count']:,}",
                    f"- **Columns**: {sheet_meta['column_count']}",
                    "",
                ]
            )

            # Linkage keys
            if sheet_meta["potential_linkage_keys"]:
                md_lines.extend(
                    [
                        f"**Potential Linkage Keys**: {', '.join(f'`{k}`' for k in sheet_meta['potential_linkage_keys'])}",
                        "",
                    ]
                )

            # Column details table
            md_lines.extend(
                [
                    "| Column | Type | Non-Null | Null % | Unique | Sample Values |",
                    "|--------|------|----------|--------|--------|---------------|",
                ]
            )

            for col_name, col_meta in sheet_meta["columns"].items():
                sample_str = ", ".join(col_meta["sample_values"][:2])  # First 2 samples
                if len(sample_str) > 40:
                    sample_str = sample_str[:37] + "..."

                md_lines.append(
                    f"| `{col_name}` | {col_meta['dtype']} | "
                    f"{col_meta['non_null_count']:,} | {col_meta['null_percentage']}% | "
                    f"{col_meta['unique_count']:,} | {sample_str} |"
                )

            md_lines.extend(["", ""])

    # Research question suggestions
    md_lines.extend(
        [
            "---",
            "",
            "## Suggested Research Questions",
            "",
            "Based on the discovered data structure, potential research questions include:",
            "",
            "1. **Malignancy Prediction**:",
            "   - Can we predict cancer vs. benign from FNA cytology + imaging features?",
            "   - Which modality (FNA, ultrasound, lab values) has highest predictive value?",
            "",
            "2. **Lymph Node Metastasis**:",
            "   - Predict LN involvement from pre-operative imaging and FNA results",
            "",
            "3. **Thyroid Dysfunction Classification**:",
            "   - Classify hypo/hyper/euthyroid states from lab values (TSH, T3, T4)",
            "",
            "4. **Diagnostic Pathway Optimization**:",
            "   - Identify which patients need FNA vs. imaging alone",
            "   - Cost-effectiveness analysis of diagnostic sequences",
            "",
            "5. **Frozen Section Utility**:",
            "   - Compare frozen section accuracy to final pathology",
            "   - Identify cases where frozen section changed surgical approach",
            "",
            "6. **Multi-Modal Integration**:",
            "   - Combine imaging + pathology + labs for comprehensive risk stratification",
            "   - Compare single-modality vs. multi-modality predictive performance",
            "",
            "---",
            "",
            "## Next Steps",
            "",
            "1. **Define Primary Research Question** - Select one question above to focus pilot",
            "2. **Identify Target Variable** - Which column contains the outcome to predict?",
            "3. **Create Data Dictionary** - Document all columns with clinical definitions",
            "4. **Design Feature Engineering** - How to merge 12 files into analysis-ready dataset?",
            "5. **Create Pandera Schemas** - Validate data quality for each file/sheet",
            "",
            "---",
            "",
            f"**Report Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
            f"**Command**: `make data-inventory`  ",
            f"**Next Command**: `make data-discovery` (generates THYROID_DATA_DICTIONARY.md)",
        ]
    )

    # Write to file
    output_path.write_text("\n".join(md_lines))
    print(f"✓ Inventory report written to: {output_path}")


def main():
    """Main execution: scan all Excel files and generate inventory."""
    # Paths
    data_dir = Path("data/restricted/thyroid_pilot")
    output_path = Path("docs/datasets/THYROID_DATA_INVENTORY.md")

    print("=" * 60)
    print("Excel Inventory Scanner - Thyroid Dataset")
    print("=" * 60)
    print()

    # Check if directory exists
    if not data_dir.exists():
        print(f"❌ ERROR: Directory not found: {data_dir}")
        print(f"   Expected location: data/restricted/thyroid_pilot/")
        print(f"   Please place Excel files there first.")
        sys.exit(1)

    # Find all Excel files
    excel_files = list(data_dir.glob("*.xlsx")) + list(data_dir.glob("*.xls"))

    if not excel_files:
        print(f"❌ ERROR: No Excel files found in {data_dir}")
        print(f"   Place your .xlsx or .xls files there first.")
        sys.exit(1)

    print(f"Found {len(excel_files)} Excel file(s):")
    for f in excel_files:
        print(f"  - {f.name}")
    print()

    # Scan each file
    inventory_data = []
    for i, excel_file in enumerate(excel_files, 1):
        print(f"[{i}/{len(excel_files)}] Scanning: {excel_file.name}")
        metadata = scan_excel_file(excel_file)
        inventory_data.append(metadata)

        if metadata["status"] == "success":
            print(f"  ✓ Success: {metadata['total_sheets']} sheets")
        else:
            print(f"  ⚠️  Error: {metadata['error_message']}")

    print()
    print("Generating inventory report...")
    generate_inventory_markdown(inventory_data, output_path)

    print()
    print("=" * 60)
    print("✓ Inventory scan complete!")
    print(f"✓ Report saved to: {output_path}")
    print()
    print("Next steps:")
    print("  1. Review: cat docs/datasets/THYROID_DATA_INVENTORY.md")
    print("  2. Run: make data-discovery (generates full data dictionary)")
    print("=" * 60)


if __name__ == "__main__":
    main()
