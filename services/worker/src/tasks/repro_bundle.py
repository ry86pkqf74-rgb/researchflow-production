"""Reproducibility bundle export.

Creates a complete reproducibility package including:
- Manuscript markdown
- All manifests and artifacts
- Environment lockfiles
- Docker configuration
- Analysis scripts (if allowed)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.security.phi_guard import assert_no_phi, PhiBlocked

logger = logging.getLogger(__name__)

ARTIFACTS_BASE = os.getenv("ARTIFACTS_PATH", "/data/artifacts")


def get_environment_info() -> Dict[str, Any]:
    """Gather environment information for reproducibility."""
    env_info: Dict[str, Any] = {}

    # Python version
    try:
        import sys
        env_info["pythonVersion"] = sys.version
    except Exception:
        pass

    # Node version
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            env_info["nodeVersion"] = result.stdout.strip()
    except Exception:
        pass

    # pip freeze
    try:
        result = subprocess.run(
            ["pip", "freeze"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            env_info["pipFreeze"] = result.stdout
    except Exception:
        pass

    # OS info
    try:
        import platform
        env_info["osInfo"] = f"{platform.system()} {platform.release()}"
    except Exception:
        pass

    return env_info


def calculate_content_hash(content: bytes) -> str:
    """Calculate SHA-256 hash of content."""
    return hashlib.sha256(content).hexdigest()


def create_repro_bundle(
    manuscript_id: str,
    manuscript_md: str,
    manifests: Optional[List[Dict[str, Any]]] = None,
    include_scripts: bool = False,
    include_docker: bool = True,
) -> Dict[str, Any]:
    """Create a reproducibility bundle.

    Args:
        manuscript_id: Manuscript identifier
        manuscript_md: Manuscript content in markdown
        manifests: List of artifact manifests
        include_scripts: Whether to include analysis scripts
        include_docker: Whether to include Docker configuration

    Returns:
        Bundle creation result with path
    """
    # PHI scan manuscript
    try:
        assert_no_phi("repro_bundle_manuscript", manuscript_md)
    except PhiBlocked as e:
        return {
            "status": "BLOCKED",
            "error": "PHI_BLOCKED",
            "locations": [loc.__dict__ for loc in e.locations],
        }

    # Create output directory
    output_dir = Path(ARTIFACTS_BASE) / "manuscripts" / manuscript_id / "bundles"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    bundle_name = f"repro_bundle_{manuscript_id}_{timestamp}"
    bundle_path = output_dir / f"{bundle_name}.zip"

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)

            # Create bundle structure
            (tmp_path / "manuscript").mkdir()
            (tmp_path / "manifests").mkdir()
            (tmp_path / "environment").mkdir()

            # Write manuscript
            (tmp_path / "manuscript" / "manuscript.md").write_text(manuscript_md)

            # Write manifests
            if manifests:
                for i, manifest in enumerate(manifests):
                    manifest_path = tmp_path / "manifests" / f"manifest_{i}.json"
                    manifest_path.write_text(json.dumps(manifest, indent=2))

            # Environment info
            env_info = get_environment_info()
            (tmp_path / "environment" / "environment.json").write_text(
                json.dumps(env_info, indent=2)
            )

            # pip requirements
            if env_info.get("pipFreeze"):
                (tmp_path / "environment" / "requirements.txt").write_text(
                    env_info["pipFreeze"]
                )

            # Docker configuration
            if include_docker:
                docker_compose = """version: '3.8'
services:
  analysis:
    image: python:3.11-slim
    volumes:
      - ./:/workspace
    working_dir: /workspace
    command: ["python", "scripts/run_analysis.py"]
"""
                (tmp_path / "docker-compose.yml").write_text(docker_compose)

                dockerfile = """FROM python:3.11-slim
WORKDIR /workspace
COPY environment/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "scripts/run_analysis.py"]
"""
                (tmp_path / "Dockerfile").write_text(dockerfile)

            # Analysis scripts placeholder
            (tmp_path / "scripts").mkdir()
            if include_scripts:
                script_placeholder = """#!/usr/bin/env python
\"\"\"
Analysis script for reproducibility bundle.
Replace this with your actual analysis code.
\"\"\"

def main():
    print("Running analysis...")
    # Your analysis code here
    print("Analysis complete.")

if __name__ == "__main__":
    main()
"""
                (tmp_path / "scripts" / "run_analysis.py").write_text(script_placeholder)

            # README
            readme = f"""# Reproducibility Bundle

Manuscript ID: {manuscript_id}
Created: {datetime.utcnow().isoformat()}

## Contents

- `manuscript/` - Manuscript markdown
- `manifests/` - Artifact manifests
- `environment/` - Environment information
- `scripts/` - Analysis scripts
- `docker-compose.yml` - Docker configuration
- `Dockerfile` - Docker image definition

## Usage

### With Docker

```bash
docker-compose up
```

### Without Docker

```bash
pip install -r environment/requirements.txt
python scripts/run_analysis.py
```

## Notes

This bundle was automatically generated for reproducibility purposes.
Ensure all PHI has been removed before sharing.
"""
            (tmp_path / "README.md").write_text(readme)

            # Create bundle metadata
            metadata = {
                "manuscriptId": manuscript_id,
                "createdAt": datetime.utcnow().isoformat(),
                "environment": env_info,
                "includesScripts": include_scripts,
                "includesDocker": include_docker,
            }
            (tmp_path / "bundle_metadata.json").write_text(
                json.dumps(metadata, indent=2)
            )

            # Create zip file
            with zipfile.ZipFile(bundle_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for file_path in tmp_path.rglob('*'):
                    if file_path.is_file():
                        arcname = file_path.relative_to(tmp_path)
                        zf.write(file_path, arcname)

        # Calculate hash
        with open(bundle_path, 'rb') as f:
            content_hash = calculate_content_hash(f.read())

        return {
            "status": "SUCCEEDED",
            "bundlePath": str(bundle_path),
            "bundleName": f"{bundle_name}.zip",
            "contentHash": content_hash,
            "sizeBytes": bundle_path.stat().st_size,
            "createdAt": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.exception(f"Failed to create reproducibility bundle: {e}")
        return {
            "status": "FAILED",
            "error": str(e),
        }


def run_repro_bundle_job(
    job_id: str,
    manuscript_id: str,
    manuscript_md: str,
    manifests: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Run reproducibility bundle creation as a job."""
    result = create_repro_bundle(
        manuscript_id=manuscript_id,
        manuscript_md=manuscript_md,
        manifests=manifests,
        include_scripts=True,
        include_docker=True,
    )

    return {
        "jobId": job_id,
        "manuscriptId": manuscript_id,
        **result,
    }
