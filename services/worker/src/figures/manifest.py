"""
Figure manifest generation and tracking.

This module provides utilities for:
- Reading manifest.jsonl
- Querying figures by tags, date, etc.
- Generating summary reports
- Detecting duplicate/missing figures

Usage:
    from src.figures.manifest import FigureManifest

    manifest = FigureManifest.load("reports/publication/figures/manifest.jsonl")

    # Query by tag
    thyroid_figs = manifest.filter_by_tag("thyroid")

    # Get summary
    print(manifest.summary())

    # Check for issues
    issues = manifest.check_integrity()
"""

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Set

from .savefig import FigureMetadata


class FigureManifest:
    """
    Collection of figure metadata with query and validation capabilities.
    """

    def __init__(self, figures: Optional[List[FigureMetadata]] = None):
        """
        Initialize manifest.

        Args:
            figures: List of FigureMetadata objects
        """
        self.figures = figures or []

    @classmethod
    def load(cls, manifest_path: Path) -> "FigureManifest":
        """
        Load manifest from JSONL file.

        Args:
            manifest_path: Path to manifest.jsonl

        Returns:
            FigureManifest object

        Examples:
            manifest = FigureManifest.load("reports/publication/figures/manifest.jsonl")
        """
        manifest_path = Path(manifest_path)

        if not manifest_path.exists():
            return cls([])

        figures = []
        with open(manifest_path, "r") as f:
            for line in f:
                if line.strip():
                    data = json.loads(line)
                    # Convert dict to FigureMetadata
                    figures.append(FigureMetadata(**data))

        return cls(figures)

    def save(self, manifest_path: Path) -> None:
        """
        Save manifest to JSONL file.

        Args:
            manifest_path: Output path
        """
        manifest_path = Path(manifest_path)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)

        with open(manifest_path, "w") as f:
            for fig in self.figures:
                f.write(json.dumps(fig.to_dict()) + "\n")

    def add(self, metadata: FigureMetadata) -> None:
        """Add figure to manifest."""
        self.figures.append(metadata)

    def filter_by_tag(self, tag: str) -> "FigureManifest":
        """
        Filter figures by tag.

        Args:
            tag: Tag to filter by

        Returns:
            New FigureManifest with filtered figures
        """
        filtered = [fig for fig in self.figures if tag in fig.tags]
        return FigureManifest(filtered)

    def filter_by_tags(
        self, tags: List[str], require_all: bool = False
    ) -> "FigureManifest":
        """
        Filter figures by multiple tags.

        Args:
            tags: List of tags
            require_all: If True, require all tags; if False, require any tag

        Returns:
            New FigureManifest with filtered figures
        """
        if require_all:
            filtered = [
                fig for fig in self.figures if all(tag in fig.tags for tag in tags)
            ]
        else:
            filtered = [
                fig for fig in self.figures if any(tag in fig.tags for tag in tags)
            ]
        return FigureManifest(filtered)

    def filter_by_date_range(
        self,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> "FigureManifest":
        """
        Filter figures by creation date range.

        Args:
            start: Start date (inclusive)
            end: End date (inclusive)

        Returns:
            New FigureManifest with filtered figures
        """
        filtered = []
        for fig in self.figures:
            created = datetime.fromisoformat(fig.created_at.rstrip("Z"))

            if start and created < start:
                continue
            if end and created > end:
                continue

            filtered.append(fig)

        return FigureManifest(filtered)

    def filter_by_format(self, format: str) -> "FigureManifest":
        """Filter figures by format (png, pdf, svg, etc.)."""
        filtered = [fig for fig in self.figures if fig.format == format]
        return FigureManifest(filtered)

    def get_by_filename(self, filename: str) -> Optional[FigureMetadata]:
        """Get figure by filename."""
        for fig in self.figures:
            if fig.filename == filename:
                return fig
        return None

    def get_all_tags(self) -> Set[str]:
        """Get set of all unique tags."""
        tags = set()
        for fig in self.figures:
            tags.update(fig.tags)
        return tags

    def summary(self) -> Dict[str, Any]:
        """
        Generate summary statistics.

        Returns:
            Dictionary with summary statistics
        """
        if not self.figures:
            return {
                "total_figures": 0,
                "formats": {},
                "tags": [],
                "total_size_mb": 0,
                "avg_dpi": 0,
                "git_commits": [],
            }

        # Count formats
        formats = {}
        for fig in self.figures:
            formats[fig.format] = formats.get(fig.format, 0) + 1

        # Total size
        total_size = sum(fig.file_size_bytes for fig in self.figures)

        # Average DPI
        avg_dpi = sum(fig.dpi for fig in self.figures) / len(self.figures)

        # Unique git commits
        git_commits = list(
            set(fig.git_commit for fig in self.figures if fig.git_commit)
        )

        return {
            "total_figures": len(self.figures),
            "formats": formats,
            "tags": sorted(list(self.get_all_tags())),
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "avg_dpi": round(avg_dpi),
            "git_commits": git_commits,
        }

    def check_integrity(self) -> List[Dict[str, Any]]:
        """
        Check manifest integrity and detect issues.

        Returns:
            List of issues found
        """
        issues = []

        # Check for duplicate filenames
        filenames = [fig.filename for fig in self.figures]
        duplicates = [name for name in filenames if filenames.count(name) > 1]
        if duplicates:
            issues.append(
                {
                    "type": "duplicate_filename",
                    "severity": "error",
                    "message": f"Duplicate filenames found: {set(duplicates)}",
                }
            )

        # Check for missing files
        for fig in self.figures:
            filepath = Path(fig.filepath)
            if not filepath.exists():
                issues.append(
                    {
                        "type": "missing_file",
                        "severity": "error",
                        "filename": fig.filename,
                        "message": f"File not found: {filepath}",
                    }
                )

        # Check for figures with low DPI
        for fig in self.figures:
            if fig.format in ["png", "jpg", "tiff"] and fig.dpi < 300:
                issues.append(
                    {
                        "type": "low_dpi",
                        "severity": "warning",
                        "filename": fig.filename,
                        "dpi": fig.dpi,
                        "message": f"Figure has low DPI ({fig.dpi}), recommended 300+",
                    }
                )

        # Check for dirty git state
        for fig in self.figures:
            if fig.git_dirty:
                issues.append(
                    {
                        "type": "dirty_git",
                        "severity": "warning",
                        "filename": fig.filename,
                        "message": "Figure created from uncommitted changes",
                    }
                )

        # Check for missing descriptions
        for fig in self.figures:
            if not fig.description or len(fig.description) < 10:
                issues.append(
                    {
                        "type": "missing_description",
                        "severity": "info",
                        "filename": fig.filename,
                        "message": "Figure has no or minimal description",
                    }
                )

        # Check for untagged figures
        for fig in self.figures:
            if not fig.tags:
                issues.append(
                    {
                        "type": "no_tags",
                        "severity": "info",
                        "filename": fig.filename,
                        "message": "Figure has no tags",
                    }
                )

        return issues

    def to_markdown(self) -> str:
        """
        Generate Markdown table of all figures.

        Returns:
            Markdown string
        """
        if not self.figures:
            return "No figures in manifest.\n"

        lines = [
            "# Figure Manifest",
            "",
            f"**Total Figures**: {len(self.figures)}",
            "",
            "| Filename | Description | Format | DPI | Size (KB) | Tags | Created |",
            "|----------|-------------|--------|-----|-----------|------|---------|",
        ]

        for fig in self.figures:
            size_kb = fig.file_size_bytes / 1024
            created = fig.created_at.split("T")[0]  # Just date
            tags_str = ", ".join(fig.tags[:3])  # First 3 tags
            if len(fig.tags) > 3:
                tags_str += f" (+{len(fig.tags) - 3})"

            desc = fig.description[:50]
            if len(fig.description) > 50:
                desc += "..."

            lines.append(
                f"| {fig.filename} | {desc} | {fig.format} | {fig.dpi} | "
                f"{size_kb:.1f} | {tags_str} | {created} |"
            )

        return "\n".join(lines) + "\n"

    def to_html(self) -> str:
        """
        Generate HTML table of all figures with thumbnails.

        Returns:
            HTML string
        """
        if not self.figures:
            return "<p>No figures in manifest.</p>"

        html = ['<div class="figure-manifest">']
        html.append(f"<h2>Figure Manifest ({len(self.figures)} figures)</h2>")
        html.append('<table class="table">')
        html.append("<thead><tr>")
        html.append("<th>Thumbnail</th><th>Filename</th><th>Description</th>")
        html.append("<th>Format</th><th>DPI</th><th>Size</th><th>Tags</th>")
        html.append("</tr></thead>")
        html.append("<tbody>")

        for fig in self.figures:
            size_kb = fig.file_size_bytes / 1024
            tags_html = ", ".join(
                f'<span class="badge">{tag}</span>' for tag in fig.tags
            )

            # Generate thumbnail (if PNG/JPG)
            thumb = ""
            if fig.format in ["png", "jpg"]:
                thumb = f'<img src="{fig.filepath}" width="100" alt="{fig.filename}">'

            html.append("<tr>")
            html.append(f"<td>{thumb}</td>")
            html.append(f"<td><code>{fig.filename}</code></td>")
            html.append(f"<td>{fig.description}</td>")
            html.append(f"<td>{fig.format}</td>")
            html.append(f"<td>{fig.dpi}</td>")
            html.append(f"<td>{size_kb:.1f} KB</td>")
            html.append(f"<td>{tags_html}</td>")
            html.append("</tr>")

        html.append("</tbody></table>")
        html.append("</div>")

        return "\n".join(html)


def generate_manifest(
    figures_dir: Path,
    output_path: Optional[Path] = None,
) -> FigureManifest:
    """
    Generate manifest from existing manifest.jsonl or directory scan.

    Args:
        figures_dir: Directory containing figures
        output_path: Optional output path for regenerated manifest

    Returns:
        FigureManifest object

    Examples:
        # Load existing manifest
        manifest = generate_manifest("reports/publication/figures")

        # Generate summary
        print(manifest.summary())

        # Check integrity
        issues = manifest.check_integrity()
        if issues:
            for issue in issues:
                print(f"[{issue['severity']}] {issue['message']}")
    """
    figures_dir = Path(figures_dir)
    manifest_path = figures_dir / "manifest.jsonl"

    # Load existing manifest
    manifest = FigureManifest.load(manifest_path)

    # Optionally save to new location
    if output_path:
        manifest.save(output_path)

    return manifest


def check_manifest_qa(manifest_path: Path) -> Dict[str, Any]:
    """
    Run QA checks on manifest and return report.

    Args:
        manifest_path: Path to manifest.jsonl

    Returns:
        QA report dictionary
    """
    manifest = FigureManifest.load(manifest_path)
    issues = manifest.check_integrity()
    summary = manifest.summary()

    # Count issues by severity
    error_count = sum(1 for i in issues if i["severity"] == "error")
    warning_count = sum(1 for i in issues if i["severity"] == "warning")
    info_count = sum(1 for i in issues if i["severity"] == "info")

    return {
        "manifest_path": str(manifest_path),
        "total_figures": summary["total_figures"],
        "total_size_mb": summary["total_size_mb"],
        "formats": summary["formats"],
        "tags": summary["tags"],
        "issues": issues,
        "error_count": error_count,
        "warning_count": warning_count,
        "info_count": info_count,
        "qa_pass": error_count == 0,
    }
