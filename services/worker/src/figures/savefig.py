"""
Deterministic figure saving with preflight checks and metadata tracking.

This module ensures all saved figures are:
- Reproducible (deterministic hashing)
- Metadata-tagged (creation date, git commit, parameters)
- Quality-checked (resolution, format, size)
- Tracked (logged to manifest)

Usage:
    import matplotlib.pyplot as plt
    from src.figures.savefig import save_figure

    fig, ax = plt.subplots()
    ax.plot(x, y)

    save_figure(
        fig,
        "thyroid_prevalence_by_age.png",
        description="Thyroid disease prevalence stratified by age group",
        tags=["prevalence", "age", "thyroid"],
    )
"""

import hashlib
import json
import logging
import subprocess
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Literal

import matplotlib.pyplot as plt
from matplotlib.figure import Figure

from src.validation.phi_detector import PHIDetector, PHIScanResult

# Import ProvenanceLogger for provenance tracking
# Define as None if import fails so patching works in tests
try:
    from src.provenance.logger import ProvenanceLogger
except ImportError:
    ProvenanceLogger = None

# Setup logging
logger = logging.getLogger(__name__)

# Constants
DEFAULT_OUTPUT_DIR = Path(".tmp/figures")  # Changed to .tmp/ for quarantine boundary
DEFAULT_QUARANTINE_DIR = None  # Will be set relative to output_dir
ALLOWED_FORMATS = ["png", "pdf", "svg", "jpg", "tiff"]
MIN_DPI = 300
RECOMMENDED_DPI = 600


@dataclass
class FigureMetadata:
    """Metadata for a saved figure."""

    filename: str
    filepath: str
    description: str
    tags: List[str]
    format: str
    dpi: int
    width_inches: float
    height_inches: float
    width_pixels: int
    height_pixels: int
    file_size_bytes: int
    sha256_hash: str
    git_commit: Optional[str]
    git_branch: Optional[str]
    git_dirty: bool
    created_at: str
    run_id: Optional[str]  # Added for provenance linkage
    figure_id: Optional[str]  # Added for identification
    python_script: Optional[str]
    notebook: Optional[str]
    dependencies: Dict[str, str]
    custom_metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=2)


def save_figure(
    fig: Figure,
    filename: str,
    description: str,
    tags: Optional[List[str]] = None,
    output_dir: Optional[Path] = None,
    format: Optional[Literal["png", "pdf", "svg", "jpg", "tiff"]] = None,
    dpi: Optional[int] = None,
    bbox_inches: str = "tight",
    pad_inches: float = 0.1,
    custom_metadata: Optional[Dict[str, Any]] = None,
    overwrite: bool = False,
    preflight_check: bool = True,
    log_to_manifest: bool = True,
    enable_phi_detection: bool = True,
    quarantine_dir: Optional[Path] = None,
    run_id: Optional[str] = None,
    figure_id: Optional[str] = None,
) -> FigureMetadata:
    """
    Save a figure with metadata tracking and preflight checks.

    Args:
        fig: Matplotlib figure to save
        filename: Output filename (with or without extension)
        description: Human-readable description of the figure
        tags: List of tags for categorization (e.g., ["prevalence", "thyroid"])
        output_dir: Output directory (default: .tmp/figures)
        format: Output format (inferred from filename if not specified)
        dpi: DPI for raster formats (default: 300, recommended: 600)
        bbox_inches: Bounding box mode for tight layout
        pad_inches: Padding around figure
        custom_metadata: Additional metadata to store
        overwrite: Allow overwriting existing files
        preflight_check: Run quality checks before saving
        log_to_manifest: Log to manifest.jsonl with run_id
        enable_phi_detection: Scan figure for PHI/PII before saving (default: True)
        quarantine_dir: Directory for quarantining PHI-flagged figures (default: <output_dir>/quarantine)
        run_id: Run identifier for provenance tracking (required for manifest)
        figure_id: Figure identifier (e.g., "fig1_prevalence")

    Returns:
        FigureMetadata object with all metadata

    Raises:
        ValueError: If preflight checks fail or PHI detected
        FileExistsError: If file exists and overwrite=False

    Examples:
        # Save PNG with default settings
        save_figure(fig, "prevalence.png", "Thyroid prevalence by age")

        # Save PDF for publication
        save_figure(
            fig,
            "figure1.pdf",
            "Main study results",
            tags=["main", "results"],
            dpi=600,
        )

        # Save with custom metadata
        save_figure(
            fig,
            "supplemental_s1.png",
            "Supplemental analysis",
            custom_metadata={"panel": "S1", "version": 2},
        )
    """
    # Setup
    if output_dir is None:
        output_dir = DEFAULT_OUTPUT_DIR
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if tags is None:
        tags = []
    if custom_metadata is None:
        custom_metadata = {}

    # Infer format from filename
    path = Path(filename)
    if format is None:
        format = path.suffix.lstrip(".").lower()
        if not format:
            format = "png"
            filename = f"{filename}.png"
    else:
        # Ensure filename has correct extension
        if not filename.endswith(f".{format}"):
            filename = f"{path.stem}.{format}"

    # Validate format
    if format not in ALLOWED_FORMATS:
        raise ValueError(
            f"Format '{format}' not allowed. Must be one of {ALLOWED_FORMATS}"
        )

    # Set DPI
    if dpi is None:
        dpi = RECOMMENDED_DPI if format in ["png", "jpg", "tiff"] else 300

    # Preflight checks
    if preflight_check:
        _run_preflight_checks(fig, format, dpi)

    # PHI/PII detection (3-layer defense-in-depth)
    if enable_phi_detection:
        scan_result = _scan_figure_for_phi(fig, filename, description)
        if scan_result.phi_detected:
            # Quarantine the figure and block save
            if quarantine_dir is None:
                quarantine_dir = output_dir / "quarantine"
            _quarantine_figure(fig, filename, scan_result, quarantine_dir)
            # Block save and raise error
            error_msg = _format_phi_detection_error(scan_result, filename)
            logger.error(error_msg)
            raise ValueError(error_msg)

    # Build output path
    output_path = output_dir / filename

    # Check for existing file
    if output_path.exists() and not overwrite:
        raise FileExistsError(
            f"Figure already exists: {output_path}. Set overwrite=True to replace."
        )

    # Save figure
    fig.savefig(
        output_path,
        format=format,
        dpi=dpi,
        bbox_inches=bbox_inches,
        pad_inches=pad_inches,
    )

    # Collect metadata
    metadata = _collect_metadata(
        fig=fig,
        filepath=output_path,
        description=description,
        tags=tags,
        format=format,
        dpi=dpi,
        custom_metadata=custom_metadata,
        run_id=run_id,
        figure_id=figure_id,
    )

    # Save metadata sidecar
    metadata_path = output_path.with_suffix(f"{output_path.suffix}.json")
    with open(metadata_path, "w") as f:
        f.write(metadata.to_json())

    # Log to manifest
    if log_to_manifest:
        _log_to_manifest(metadata, output_dir, run_id)

    # Log to provenance (wrapped in try/except so figure saving never fails due to provenance)
    try:
        if ProvenanceLogger is not None:
            prov_logger = ProvenanceLogger()
            # Build inputs list from source_file if present and is a string
            prov_inputs = []
            source_file = custom_metadata.get("source_file")
            if source_file and isinstance(source_file, str):
                prov_inputs = [source_file]
            prov_logger.log_operation(
                operation="figure",
                inputs=prov_inputs,
                outputs=[str(output_path)],
                notes="",  # Do NOT include description/tags to avoid PHI leakage
            )
    except Exception:
        # Never fail figure saving due to provenance logging errors
        pass

    return metadata


def _run_preflight_checks(fig: Figure, format: str, dpi: int) -> None:
    """
    Run quality checks before saving.

    Args:
        fig: Figure to check
        format: Output format
        dpi: DPI setting

    Raises:
        ValueError: If checks fail
    """
    # Check DPI for raster formats
    if format in ["png", "jpg", "tiff"] and dpi < MIN_DPI:
        raise ValueError(
            f"DPI {dpi} is below minimum {MIN_DPI} for publication. "
            f"Recommended: {RECOMMENDED_DPI}"
        )

    # Check figure size
    width, height = fig.get_size_inches()
    if width < 3 or height < 2:
        raise ValueError(
            f"Figure size ({width:.1f}x{height:.1f} inches) is too small. "
            "Minimum recommended: 3x2 inches"
        )

    if width > 20 or height > 20:
        raise ValueError(
            f"Figure size ({width:.1f}x{height:.1f} inches) is too large. "
            "Maximum recommended: 20x20 inches"
        )

    # Check for empty axes
    axes = fig.get_axes()
    if not axes:
        raise ValueError("Figure has no axes. Cannot save empty figure.")

    for ax in axes:
        if not ax.lines and not ax.collections and not ax.patches and not ax.images:
            raise ValueError("Figure contains empty axes. All axes must have content.")


def _collect_metadata(
    fig: Figure,
    filepath: Path,
    description: str,
    tags: List[str],
    format: str,
    dpi: int,
    custom_metadata: Dict[str, Any],
    run_id: Optional[str] = None,
    figure_id: Optional[str] = None,
) -> FigureMetadata:
    """
    Collect all metadata for the saved figure.

    Args:
        fig: Matplotlib figure
        filepath: Path to saved figure
        description: Figure description
        tags: Figure tags
        format: Output format
        dpi: DPI setting
        custom_metadata: Additional metadata

    Returns:
        FigureMetadata object
    """
    # File info
    file_size = filepath.stat().st_size
    sha256 = _compute_file_hash(filepath)

    # Figure dimensions
    width_inches, height_inches = fig.get_size_inches()
    width_pixels = int(width_inches * dpi)
    height_pixels = int(height_inches * dpi)

    # Git info
    git_commit, git_branch, git_dirty = _get_git_info()

    # Python context
    python_script = _get_calling_script()
    notebook = _get_notebook_name()

    # Dependencies
    dependencies = _get_dependencies()

    return FigureMetadata(
        filename=filepath.name,
        filepath=str(filepath),
        description=description,
        tags=tags,
        format=format,
        dpi=dpi,
        width_inches=width_inches,
        height_inches=height_inches,
        width_pixels=width_pixels,
        height_pixels=height_pixels,
        file_size_bytes=file_size,
        sha256_hash=sha256,
        git_commit=git_commit,
        git_branch=git_branch,
        git_dirty=git_dirty,
        created_at=datetime.utcnow().isoformat() + "Z",
        run_id=run_id,
        figure_id=figure_id,
        python_script=python_script,
        notebook=notebook,
        dependencies=dependencies,
        custom_metadata=custom_metadata,
    )


def _compute_file_hash(filepath: Path) -> str:
    """Compute SHA256 hash of file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def _get_git_info() -> tuple[Optional[str], Optional[str], bool]:
    """
    Get current git commit, branch, and dirty status.

    Returns:
        (commit_hash, branch_name, is_dirty)
    """
    try:
        # Get commit hash
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        commit = result.stdout.strip()

        # Get branch name
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        branch = result.stdout.strip()

        # Check if dirty
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            check=True,
        )
        dirty = bool(result.stdout.strip())

        return commit, branch, dirty

    except (subprocess.CalledProcessError, FileNotFoundError):
        return None, None, False


def _get_calling_script() -> Optional[str]:
    """Get the name of the Python script that called save_figure."""
    import inspect

    frame = inspect.currentframe()
    try:
        # Walk up the stack to find the first non-library frame
        while frame is not None:
            frame_info = inspect.getframeinfo(frame)
            filename = frame_info.filename

            # Skip library code
            if "site-packages" not in filename and "figures" not in filename:
                return str(Path(filename).relative_to(Path.cwd()))

            frame = frame.f_back

        return None

    finally:
        del frame


def _get_notebook_name() -> Optional[str]:
    """Get Jupyter notebook name if running in notebook."""
    try:
        from IPython import get_ipython

        ipython = get_ipython()

        if ipython is not None and "IPKernelApp" in ipython.config:
            # Running in Jupyter
            import ipykernel
            import json
            from pathlib import Path

            connection_file = Path(ipython.config["IPKernelApp"]["connection_file"])
            kernel_id = connection_file.stem.split("-", 1)[1]

            # Try to get notebook name from Jupyter server
            # This is a heuristic and may not always work
            return f"notebook-{kernel_id}.ipynb"

        return None

    except (ImportError, KeyError, AttributeError):
        return None


def _get_dependencies() -> Dict[str, str]:
    """Get versions of key dependencies."""
    dependencies = {}

    try:
        import matplotlib

        dependencies["matplotlib"] = matplotlib.__version__
    except ImportError:
        pass

    try:
        import numpy

        dependencies["numpy"] = numpy.__version__
    except ImportError:
        pass

    try:
        import pandas

        dependencies["pandas"] = pandas.__version__
    except ImportError:
        pass

    try:
        import seaborn

        dependencies["seaborn"] = seaborn.__version__
    except ImportError:
        pass

    return dependencies


def _log_to_manifest(
    metadata: FigureMetadata, output_dir: Path, run_id: Optional[str] = None
) -> None:
    """
    Log figure metadata to manifest JSON.

    Args:
        metadata: Figure metadata
        output_dir: Directory containing manifest
        run_id: Optional run identifier for manifest filename
    """
    # Use run_id in manifest filename if provided
    if run_id:
        manifest_path = output_dir / f"figures_manifest_{run_id}.json"
    else:
        manifest_path = output_dir / "figures_manifest.json"

    # Load existing manifest or create new
    if manifest_path.exists():
        with open(manifest_path, "r") as f:
            manifest_data = json.load(f)
    else:
        manifest_data = {
            "figures": [],
            "created_at": datetime.utcnow().isoformat() + "Z",
            "run_id": run_id,
        }

    # Append figure metadata
    manifest_data["figures"].append(metadata.to_dict())
    manifest_data["updated_at"] = datetime.utcnow().isoformat() + "Z"

    # Write manifest
    with open(manifest_path, "w") as f:
        json.dump(manifest_data, f, indent=2)


def _extract_text_from_figure(fig: Figure) -> List[str]:
    """
    Extract all text elements from a matplotlib figure.

    This function extracts text from:
    - Figure title (suptitle)
    - Axes titles
    - Axes labels (x, y, z)
    - Legend text
    - Tick labels (x and y axes)
    - Text annotations
    - Text objects added to axes

    Args:
        fig: Matplotlib figure

    Returns:
        List of text strings found in the figure (sorted for determinism)
    """
    text_elements = []

    # Figure-level title
    if fig._suptitle is not None:
        text_elements.append(fig._suptitle.get_text())

    # Iterate through all axes
    for ax in fig.get_axes():
        # Axes title
        title = ax.get_title()
        if title:
            text_elements.append(title)

        # Axes labels
        xlabel = ax.get_xlabel()
        if xlabel:
            text_elements.append(xlabel)

        ylabel = ax.get_ylabel()
        if ylabel:
            text_elements.append(ylabel)

        # Z-label for 3D plots
        try:
            zlabel = ax.get_zlabel()
            if zlabel:
                text_elements.append(zlabel)
        except AttributeError:
            pass  # Not a 3D axes

        # Legend
        legend = ax.get_legend()
        if legend is not None:
            for text in legend.get_texts():
                text_elements.append(text.get_text())

        # Tick labels
        for label in ax.get_xticklabels():
            text = label.get_text()
            if text:
                text_elements.append(text)

        for label in ax.get_yticklabels():
            text = label.get_text()
            if text:
                text_elements.append(text)

        # Text annotations
        for text_obj in ax.texts:
            text_elements.append(text_obj.get_text())

    # Filter out empty strings and sort for determinism
    text_elements = [t.strip() for t in text_elements if t and t.strip()]
    text_elements.sort()

    return text_elements


def _scan_figure_for_phi(fig: Figure, filename: str, description: str) -> PHIScanResult:
    """
    Scan figure for PHI/PII in all text elements.

    This implements a 3-layer defense-in-depth approach:
    1. Scan filename for PHI keywords
    2. Scan description for PHI patterns
    3. Scan all figure text elements (titles, labels, annotations) for PHI patterns

    Args:
        fig: Matplotlib figure to scan
        filename: Figure filename (basename only is scanned to avoid path leakage)
        description: Figure description

    Returns:
        PHIScanResult with detection details
    """
    detector = PHIDetector()

    # Extract all text from figure
    text_elements = _extract_text_from_figure(fig)

    # Scan only basename to avoid leaking directory structure
    filename_basename = Path(filename).name

    # Combine all text for scanning
    all_text_pieces = [filename_basename, description] + text_elements

    # Scan each piece of text and collect detections
    all_detections = []
    flagged_elements = []

    for i, text in enumerate(all_text_pieces):
        if text and text.strip():
            detections = detector.scan_value(text)
            if detections:
                all_detections.extend(detections)
                source = (
                    "filename"
                    if i == 0
                    else "description" if i == 1 else f"figure_text_{i-2}"
                )
                flagged_elements.append(source)

    # Build result
    phi_detected = len(all_detections) > 0
    result = PHIScanResult(
        phi_detected=phi_detected,
        flagged_columns=flagged_elements,
        flagged_rows=[0] if phi_detected else [],
        detection_details={"figure": all_detections} if all_detections else {},
        total_rows_scanned=1,
        total_columns_scanned=len(all_text_pieces),
    )

    # Add detections attribute for compatibility
    result.detections = all_detections

    # Log scan result (use basename only to avoid path leakage)
    if result.phi_detected:
        logger.warning(
            f"PHI detected in figure '{filename_basename}': {len(all_detections)} patterns found"
        )
    else:
        logger.debug(f"Figure '{filename_basename}' PHI scan passed (no PHI detected)")

    return result


def _quarantine_figure(
    fig: Figure,
    filename: str,
    scan_result: PHIScanResult,
    quarantine_dir: Path,
) -> Path:
    """
    Quarantine a figure flagged for PHI/PII.

    Creates a quarantine directory and saves:
    - Figure metadata (filename, PHI detections)
    - Remediation instructions
    - Timestamp

    CRITICAL: Does NOT echo raw PHI tokens in reports to avoid PHI leakage.

    Args:
        fig: Figure that was flagged (NOT saved)
        filename: Original filename
        scan_result: PHI scan result with detections
        quarantine_dir: Directory for quarantine files

    Returns:
        Path to quarantine metadata file
    """
    # Create quarantine directory
    quarantine_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique quarantine filename (use basename only)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename_basename = Path(filename).name
    quarantine_base = f"{Path(filename_basename).stem}_PHI_DETECTED_{timestamp}"

    # Get detections (avoid echoing raw PHI)
    detections = getattr(scan_result, "detections", [])

    # Save quarantine metadata (NO raw PHI tokens, basename only to avoid path leakage)
    # CRITICAL: Do NOT include text_elements or any raw figure content to prevent PHI leakage
    metadata = {
        "original_filename": filename_basename,
        "quarantine_timestamp": datetime.utcnow().isoformat() + "Z",
        "phi_detected": True,
        "detection_count": len(detections),
        "detection_summary": f"Detected {len(detections)} PHI pattern(s)",
        "detected_patterns": [
            {
                "pattern_type": phi_type.value,
                # Redact actual matched text to avoid PHI leakage
                "matched_text_redacted": "[REDACTED]",
            }
            for phi_type, _ in detections
        ],
        "detected_pattern_types": [phi_type.value for phi_type, _ in detections],
        "flagged_sources": scan_result.flagged_columns,
        "remediation_steps": [
            "1. Review detected PHI pattern types listed above",
            "2. Identify source of PHI in figure (title, labels, annotations, legend, or filename/description)",
            "3. Apply redaction:",
            "   - Remove or generalize dates (e.g., '2023-05-15' → 'Study Day 0')",
            "   - Remove phone numbers, emails, medical record numbers",
            "   - Remove patient names or identifiers",
            "   - Remove addresses or geographic identifiers smaller than state",
            "4. Regenerate figure with redacted content",
            "5. Re-run save_figure() with enable_phi_detection=True",
            "6. Verify no PHI in output",
        ],
    }

    metadata_path = quarantine_dir / f"{quarantine_base}.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.warning(
        f"Figure quarantined: {metadata_path}\n"
        f"Detected {len(detections)} PHI patterns. "
        f"Review quarantine file for remediation steps."
    )

    return metadata_path


def _format_phi_detection_error(scan_result: PHIScanResult, filename: str) -> str:
    """
    Format PHI detection error message for user.

    CRITICAL: Does NOT echo raw PHI tokens to avoid leakage in error messages.

    Args:
        scan_result: PHI scan result
        filename: Figure filename (basename only shown to avoid path leakage)

    Returns:
        Formatted error message
    """
    detections = getattr(scan_result, "detections", [])

    # Use basename only to avoid path leakage
    filename_basename = Path(filename).name

    error_lines = [
        "=" * 70,
        "⚠️  PHI/PII DETECTED IN FIGURE - SAVE BLOCKED",
        "=" * 70,
        f"Figure: {filename_basename}",
        f"Detected: {len(detections)} PHI/PII pattern(s)",
        "",
        "Detected PHI types:",
    ]

    # Group by pattern type (NO raw tokens)
    from collections import defaultdict

    by_type = defaultdict(int)
    for phi_type, _ in detections:
        by_type[phi_type.value] += 1

    for pattern_type, count in sorted(by_type.items()):
        error_lines.append(f"  - {pattern_type}: {count} instance(s)")

    error_lines.extend(
        [
            "",
            "Action Required:",
            "1. Review figure content (titles, labels, annotations, legend, filename, description)",
            "2. Remove or redact all PHI/PII (dates, names, IDs, contact info)",
            "3. Regenerate figure with redacted content",
            "4. Re-run save_figure()",
            "",
            "Figure has been quarantined for review.",
            "See quarantine directory for detailed detection report.",
            "=" * 70,
        ]
    )

    return "\n".join(error_lines)

    return "\n".join(error_lines)
