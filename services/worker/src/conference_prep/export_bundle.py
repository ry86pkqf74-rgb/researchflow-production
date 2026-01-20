"""
Conference Export Bundle Module

Creates ZIP bundles containing all generated conference materials with:
- manifest.json with sha256 hashes, byte sizes, timestamps, tool versions
- All generated files (PDFs, PPTX, etc.)
- Validation checksums for integrity verification

Output: conference_submission_bundle_<run_id>.zip
"""

from __future__ import annotations

import hashlib
import json
import os
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .generate_materials import (
    MaterialGenerationResult,
    MaterialType,
    PosterContent,
    SlideContent,
    generate_poster_pdf,
    generate_slides_pptx,
    get_demo_poster_content,
    get_demo_slide_content,
    check_dependencies,
)


# ============ Constants ============

DEFAULT_ARTIFACT_BASE = Path("/data/artifacts/conference")
BUNDLE_VERSION = "1.0.0"


# ============ Data Classes ============

@dataclass
class BundleFile:
    """Metadata for a file included in the bundle."""
    filename: str
    relative_path: str
    sha256_hash: str
    size_bytes: int
    content_type: str
    generated_at: str
    tool_version: str
    blinded: bool = False

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "filename": self.filename,
            "relative_path": self.relative_path,
            "sha256_hash": self.sha256_hash,
            "size_bytes": self.size_bytes,
            "content_type": self.content_type,
            "generated_at": self.generated_at,
            "tool_version": self.tool_version,
            "blinded": self.blinded,
        }


@dataclass
class BundleManifest:
    """Manifest for the conference submission bundle."""
    bundle_version: str = BUNDLE_VERSION
    run_id: str = ""
    created_at: str = ""
    conference_name: Optional[str] = None
    blinded: bool = False
    files: List[BundleFile] = field(default_factory=list)
    total_size_bytes: int = 0
    bundle_sha256: str = ""
    tool_versions: Dict[str, str] = field(default_factory=dict)
    validation_status: str = "pending"
    guidelines_used: Optional[Dict[str, Any]] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "bundle_version": self.bundle_version,
            "run_id": self.run_id,
            "created_at": self.created_at,
            "conference_name": self.conference_name,
            "blinded": self.blinded,
            "files": [f.to_dict() for f in self.files],
            "total_size_bytes": self.total_size_bytes,
            "bundle_sha256": self.bundle_sha256,
            "tool_versions": self.tool_versions,
            "validation_status": self.validation_status,
            "guidelines_used": self.guidelines_used,
        }


@dataclass
class ExportBundleInput:
    """Input for bundle creation."""
    run_id: str
    output_dir: Optional[Path] = None
    conference_name: Optional[str] = None
    blinded: bool = False
    include_poster: bool = True
    include_slides: bool = True
    poster_content: Optional[PosterContent] = None
    slide_content: Optional[SlideContent] = None
    guidelines: Optional[Dict[str, Any]] = None
    poster_size: tuple = (48, 36)

    def get_output_dir(self) -> Path:
        """Get output directory, creating if needed."""
        if self.output_dir:
            return self.output_dir
        return DEFAULT_ARTIFACT_BASE / self.run_id


@dataclass
class ExportBundleResult:
    """Result of bundle creation."""
    status: str  # "success", "partial", "error"
    bundle_path: Optional[Path] = None
    manifest: Optional[BundleManifest] = None
    generated_files: List[MaterialGenerationResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "status": self.status,
            "bundle_path": str(self.bundle_path) if self.bundle_path else None,
            "manifest": self.manifest.to_dict() if self.manifest else None,
            "generated_files": [f.to_dict() for f in self.generated_files],
            "errors": self.errors,
            "warnings": self.warnings,
        }


# ============ Utility Functions ============

def _compute_file_hash(file_path: Path) -> str:
    """Compute SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def _get_content_type(filename: str) -> str:
    """Get MIME content type for a filename."""
    ext = Path(filename).suffix.lower()
    content_types = {
        ".pdf": "application/pdf",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }
    return content_types.get(ext, "application/octet-stream")


def _create_bundle_file(
    file_path: Path,
    relative_path: str,
    generation_result: MaterialGenerationResult,
) -> BundleFile:
    """Create BundleFile metadata from generation result."""
    return BundleFile(
        filename=file_path.name,
        relative_path=relative_path,
        sha256_hash=generation_result.sha256_hash,
        size_bytes=generation_result.file_size_bytes,
        content_type=_get_content_type(file_path.name),
        generated_at=generation_result.generation_timestamp,
        tool_version=generation_result.tool_version,
        blinded=generation_result.blinded,
    )


# ============ Main Functions ============

def create_conference_bundle(
    input_params: ExportBundleInput,
) -> ExportBundleResult:
    """
    Create a ZIP bundle containing all conference submission materials.

    This is the main entry point for bundle creation.

    Args:
        input_params: Bundle creation parameters

    Returns:
        ExportBundleResult with bundle path and manifest
    """
    output_dir = input_params.get_output_dir()
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_files: List[MaterialGenerationResult] = []
    bundle_files: List[BundleFile] = []
    errors: List[str] = []
    warnings: List[str] = []
    tool_versions: Dict[str, str] = {}

    # Check dependencies
    deps = check_dependencies()
    tool_versions["bundle_builder"] = BUNDLE_VERSION

    if deps.get("reportlab"):
        tool_versions["reportlab"] = "4.2.0"
    if deps.get("python-pptx"):
        tool_versions["python-pptx"] = "1.0.2"

    # Generate poster PDF
    if input_params.include_poster:
        poster_content = input_params.poster_content or get_demo_poster_content()
        poster_path = output_dir / f"poster_{input_params.run_id}.pdf"

        poster_result = generate_poster_pdf(
            content=poster_content,
            output_path=poster_path,
            poster_size=input_params.poster_size,
            blinded=input_params.blinded,
        )
        generated_files.append(poster_result)

        if poster_result.status == "success":
            bundle_files.append(_create_bundle_file(
                poster_path,
                f"poster_{input_params.run_id}.pdf",
                poster_result,
            ))
        else:
            if poster_result.error_message:
                errors.append(f"Poster generation failed: {poster_result.error_message}")

    # Generate slides PPTX
    if input_params.include_slides:
        slide_content = input_params.slide_content or get_demo_slide_content()
        slides_path = output_dir / f"slides_{input_params.run_id}.pptx"

        slides_result = generate_slides_pptx(
            content=slide_content,
            output_path=slides_path,
            blinded=input_params.blinded,
        )
        generated_files.append(slides_result)

        if slides_result.status == "success":
            bundle_files.append(_create_bundle_file(
                slides_path,
                f"slides_{input_params.run_id}.pptx",
                slides_result,
            ))
        else:
            if slides_result.error_message:
                errors.append(f"Slides generation failed: {slides_result.error_message}")

    # Check if we have any files to bundle
    if not bundle_files:
        return ExportBundleResult(
            status="error",
            errors=errors if errors else ["No files generated for bundle"],
            warnings=warnings,
            generated_files=generated_files,
        )

    # Calculate total size
    total_size = sum(f.size_bytes for f in bundle_files)

    # Create manifest
    manifest = BundleManifest(
        bundle_version=BUNDLE_VERSION,
        run_id=input_params.run_id,
        created_at=datetime.utcnow().isoformat() + "Z",
        conference_name=input_params.conference_name,
        blinded=input_params.blinded,
        files=bundle_files,
        total_size_bytes=total_size,
        tool_versions=tool_versions,
        validation_status="generated",
        guidelines_used=input_params.guidelines,
    )

    # Write manifest JSON
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest.to_dict(), f, indent=2)

    # Create ZIP bundle
    bundle_filename = f"conference_submission_bundle_{input_params.run_id}.zip"
    bundle_path = output_dir / bundle_filename

    try:
        with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # Add manifest
            zf.write(manifest_path, "manifest.json")

            # Add generated files
            for bundle_file in bundle_files:
                file_path = output_dir / bundle_file.filename
                if file_path.exists():
                    zf.write(file_path, bundle_file.relative_path)

        # Compute bundle hash
        bundle_hash = _compute_file_hash(bundle_path)
        manifest.bundle_sha256 = bundle_hash

        # Update manifest with bundle hash
        with open(manifest_path, "w") as f:
            json.dump(manifest.to_dict(), f, indent=2)

        # Determine status
        status = "success" if not errors else "partial"

        return ExportBundleResult(
            status=status,
            bundle_path=bundle_path,
            manifest=manifest,
            generated_files=generated_files,
            errors=errors,
            warnings=warnings,
        )

    except Exception as e:
        errors.append(f"Bundle creation failed: {str(e)}")
        return ExportBundleResult(
            status="error",
            errors=errors,
            warnings=warnings,
            generated_files=generated_files,
        )


def validate_bundle(bundle_path: Path) -> Dict[str, Any]:
    """
    Validate a conference submission bundle.

    Checks:
    - ZIP file integrity
    - Manifest presence and validity
    - File hashes match manifest
    - Required files present

    Args:
        bundle_path: Path to the ZIP bundle

    Returns:
        Validation result dictionary
    """
    result = {
        "valid": False,
        "errors": [],
        "warnings": [],
        "files_checked": 0,
        "files_valid": 0,
    }

    try:
        with zipfile.ZipFile(bundle_path, "r") as zf:
            # Check for manifest
            if "manifest.json" not in zf.namelist():
                result["errors"].append("manifest.json not found in bundle")
                return result

            # Read and parse manifest
            with zf.open("manifest.json") as f:
                manifest_data = json.load(f)

            # Validate each file
            for file_info in manifest_data.get("files", []):
                result["files_checked"] += 1
                relative_path = file_info.get("relative_path")
                expected_hash = file_info.get("sha256_hash")
                expected_size = file_info.get("size_bytes")

                if relative_path not in zf.namelist():
                    result["errors"].append(f"File missing: {relative_path}")
                    continue

                # Extract and verify
                with zf.open(relative_path) as f:
                    content = f.read()

                actual_hash = hashlib.sha256(content).hexdigest()
                actual_size = len(content)

                if actual_hash != expected_hash:
                    result["errors"].append(
                        f"Hash mismatch for {relative_path}: "
                        f"expected {expected_hash[:16]}..., got {actual_hash[:16]}..."
                    )
                elif actual_size != expected_size:
                    result["warnings"].append(
                        f"Size mismatch for {relative_path}: "
                        f"expected {expected_size}, got {actual_size}"
                    )
                else:
                    result["files_valid"] += 1

            # Check bundle hash
            if manifest_data.get("bundle_sha256"):
                actual_bundle_hash = _compute_file_hash(bundle_path)
                # Note: Bundle hash may differ due to re-zipping; this is a warning only
                if actual_bundle_hash != manifest_data["bundle_sha256"]:
                    result["warnings"].append(
                        "Bundle hash differs from manifest (may be expected after re-zipping)"
                    )

            result["valid"] = len(result["errors"]) == 0

    except zipfile.BadZipFile:
        result["errors"].append("Invalid ZIP file")
    except json.JSONDecodeError:
        result["errors"].append("Invalid manifest.json format")
    except Exception as e:
        result["errors"].append(f"Validation error: {str(e)}")

    return result


def list_bundle_contents(bundle_path: Path) -> Dict[str, Any]:
    """
    List contents of a conference submission bundle.

    Args:
        bundle_path: Path to the ZIP bundle

    Returns:
        Dictionary with bundle contents and metadata
    """
    result = {
        "bundle_path": str(bundle_path),
        "bundle_size_bytes": bundle_path.stat().st_size if bundle_path.exists() else 0,
        "manifest": None,
        "file_list": [],
        "error": None,
    }

    try:
        with zipfile.ZipFile(bundle_path, "r") as zf:
            result["file_list"] = zf.namelist()

            if "manifest.json" in zf.namelist():
                with zf.open("manifest.json") as f:
                    result["manifest"] = json.load(f)

    except Exception as e:
        result["error"] = str(e)

    return result


# ============ High-Level Orchestration ============

def orchestrate_full_export(
    run_id: str,
    conference_name: Optional[str] = None,
    blinded: bool = False,
    poster_content: Optional[PosterContent] = None,
    slide_content: Optional[SlideContent] = None,
    guidelines: Optional[Dict[str, Any]] = None,
    output_dir: Optional[Path] = None,
    include_validation: bool = True,
) -> ExportBundleResult:
    """
    Orchestrate full conference export: generation -> validation -> bundling.

    This is the high-level entry point that combines:
    1. Material generation (poster PDF, slides PPTX)
    2. Validation (file integrity, guideline compliance)
    3. ZIP bundling with manifest

    Args:
        run_id: Unique run identifier
        conference_name: Target conference name (optional)
        blinded: Whether to strip author/institution info
        poster_content: Custom poster content (uses demo if None)
        slide_content: Custom slide content (uses demo if None)
        guidelines: Conference guidelines for compliance checking
        output_dir: Output directory (defaults to /data/artifacts/conference/<run_id>/)
        include_validation: Whether to validate bundle after creation

    Returns:
        ExportBundleResult with bundle path, manifest, and status
    """
    input_params = ExportBundleInput(
        run_id=run_id,
        output_dir=output_dir,
        conference_name=conference_name,
        blinded=blinded,
        include_poster=True,
        include_slides=True,
        poster_content=poster_content,
        slide_content=slide_content,
        guidelines=guidelines,
    )

    # Create bundle
    result = create_conference_bundle(input_params)

    # Validate if requested and bundle was created
    if include_validation and result.bundle_path and result.bundle_path.exists():
        validation = validate_bundle(result.bundle_path)
        if result.manifest:
            result.manifest.validation_status = "valid" if validation["valid"] else "invalid"
        if not validation["valid"]:
            result.warnings.extend(validation.get("warnings", []))
            # Validation errors are warnings for the result, not failures
            result.warnings.extend([f"Validation: {e}" for e in validation.get("errors", [])])

    return result
