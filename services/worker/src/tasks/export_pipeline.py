"""Export pipeline for manuscript conversion.

Supports conversion to DOCX, PDF, and LaTeX formats using Pandoc.
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from src.security.phi_guard import assert_no_phi, PhiBlocked

logger = logging.getLogger(__name__)

# Shared artifacts volume path
ARTIFACTS_BASE = os.getenv("ARTIFACTS_PATH", "/data/artifacts")


def md_to_docx(md_content: str, output_path: str, template: Optional[str] = None) -> str:
    """Convert markdown to DOCX using Pandoc.

    Args:
        md_content: Markdown content
        output_path: Output file path
        template: Optional reference.docx template path

    Returns:
        Path to generated DOCX file
    """
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(md_content)
        md_path = f.name

    try:
        cmd = ["pandoc", md_path, "-o", output_path]

        if template and os.path.exists(template):
            cmd.extend(["--reference-doc", template])

        subprocess.check_call(cmd, timeout=60)
        return output_path

    finally:
        os.unlink(md_path)


def md_to_latex(md_content: str, output_path: str, standalone: bool = True) -> str:
    """Convert markdown to LaTeX using Pandoc.

    Args:
        md_content: Markdown content
        output_path: Output file path
        standalone: Whether to generate standalone document

    Returns:
        Path to generated LaTeX file
    """
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(md_content)
        md_path = f.name

    try:
        cmd = ["pandoc", md_path, "-o", output_path]

        if standalone:
            cmd.append("--standalone")

        subprocess.check_call(cmd, timeout=60)
        return output_path

    finally:
        os.unlink(md_path)


def md_to_pdf(md_content: str, output_path: str, engine: str = "pdflatex") -> str:
    """Convert markdown to PDF using Pandoc with LaTeX engine.

    Args:
        md_content: Markdown content
        output_path: Output file path
        engine: PDF engine (pdflatex, xelatex, lualatex)

    Returns:
        Path to generated PDF file
    """
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(md_content)
        md_path = f.name

    try:
        cmd = [
            "pandoc", md_path, "-o", output_path,
            f"--pdf-engine={engine}",
            "-V", "geometry:margin=1in",
        ]

        subprocess.check_call(cmd, timeout=120)
        return output_path

    finally:
        os.unlink(md_path)


def latex_bundle(
    latex_path: str,
    output_zip: str,
    include_assets: Optional[list] = None,
) -> str:
    """Create a LaTeX bundle as a zip file.

    Args:
        latex_path: Path to main.tex file
        output_zip: Output zip file path
        include_assets: Additional files to include (figures, bib, etc.)

    Returns:
        Path to generated zip file
    """
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        # Add main LaTeX file
        z.write(latex_path, arcname="main.tex")

        # Add additional assets
        if include_assets:
            for asset_path in include_assets:
                if os.path.exists(asset_path):
                    arcname = os.path.basename(asset_path)
                    z.write(asset_path, arcname=arcname)

    return output_zip


def redact_double_blind(md_content: str) -> str:
    """Remove author and affiliation information for double-blind review.

    Args:
        md_content: Original markdown content

    Returns:
        Redacted markdown content
    """
    import re

    lines = md_content.split('\n')
    redacted_lines = []
    in_author_section = False

    for line in lines:
        # Check for author-related sections
        if re.match(r'^##?\s*(Authors?|Affiliations?|Corresponding|Acknowledgements?)', line, re.IGNORECASE):
            in_author_section = True
            redacted_lines.append(line)
            redacted_lines.append("[REDACTED FOR DOUBLE-BLIND REVIEW]")
            continue

        # End author section at next major heading
        if in_author_section and re.match(r'^##?\s*\w', line):
            in_author_section = False

        if in_author_section:
            continue

        # Redact inline mentions of institutions, grant numbers, IRB IDs
        line = re.sub(r'IRB\s*#?\s*[\w-]+', '[IRB REDACTED]', line)
        line = re.sub(r'grant\s*#?\s*[\w-]+', '[GRANT REDACTED]', line, flags=re.IGNORECASE)

        redacted_lines.append(line)

    return '\n'.join(redacted_lines)


def calculate_content_hash(content: bytes) -> str:
    """Calculate SHA-256 hash of content."""
    return hashlib.sha256(content).hexdigest()


def run_export(
    job_id: str,
    manuscript_id: str,
    manuscript_md: str,
    format: str,
    journal_style_id: Optional[str] = None,
    double_blind: bool = False,
) -> Dict[str, Any]:
    """Run export job for a manuscript.

    Args:
        job_id: Job identifier
        manuscript_id: Manuscript identifier
        manuscript_md: Manuscript content in markdown
        format: Export format (docx, pdf, latex_zip)
        journal_style_id: Optional journal template
        double_blind: Whether to redact author information

    Returns:
        Job result with artifact path
    """
    # PHI scan the content
    try:
        assert_no_phi("export_input", manuscript_md)
    except PhiBlocked as e:
        return {
            "jobId": job_id,
            "status": "BLOCKED",
            "error": "PHI_BLOCKED",
            "locations": [loc.__dict__ for loc in e.locations],
        }

    # Apply double-blind redaction if requested
    if double_blind:
        manuscript_md = redact_double_blind(manuscript_md)

    # Create output directory
    output_dir = Path(ARTIFACTS_BASE) / "manuscripts" / manuscript_id / "exports"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    try:
        if format == "docx":
            output_path = str(output_dir / f"manuscript_{timestamp}.docx")
            md_to_docx(manuscript_md, output_path)
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif format == "pdf":
            output_path = str(output_dir / f"manuscript_{timestamp}.pdf")
            md_to_pdf(manuscript_md, output_path)
            mime_type = "application/pdf"

        elif format == "latex_zip":
            # First convert to LaTeX
            latex_path = str(output_dir / "main.tex")
            md_to_latex(manuscript_md, latex_path)

            # Then create bundle
            output_path = str(output_dir / f"manuscript_{timestamp}_latex.zip")
            latex_bundle(latex_path, output_path)
            mime_type = "application/zip"

        else:
            return {
                "jobId": job_id,
                "status": "FAILED",
                "error": f"Unsupported format: {format}",
            }

        # Calculate hash and size
        with open(output_path, 'rb') as f:
            content = f.read()
            content_hash = calculate_content_hash(content)
            size_bytes = len(content)

        return {
            "jobId": job_id,
            "manuscriptId": manuscript_id,
            "status": "SUCCEEDED",
            "artifactPath": output_path,
            "format": format,
            "contentHash": content_hash,
            "sizeBytes": size_bytes,
            "mimeType": mime_type,
            "doubleBlind": double_blind,
        }

    except subprocess.CalledProcessError as e:
        logger.exception(f"Export conversion failed: {e}")
        return {
            "jobId": job_id,
            "status": "FAILED",
            "error": f"Conversion failed: {str(e)}",
        }
    except FileNotFoundError as e:
        logger.error(f"Pandoc not found: {e}")
        return {
            "jobId": job_id,
            "status": "FAILED",
            "error": "Export tool (pandoc) not available",
        }
    except Exception as e:
        logger.exception(f"Export failed: {e}")
        return {
            "jobId": job_id,
            "status": "FAILED",
            "error": str(e),
        }
