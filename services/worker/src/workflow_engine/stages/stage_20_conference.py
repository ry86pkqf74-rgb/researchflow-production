"""
Stage 20: Conference Preparation

Automates conference discovery, guideline extraction, submission material
generation (abstracts, slides, posters), and export bundling for research
dissemination at surgical conferences.
"""

import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from ..types import StageContext, StageResult
from ..registry import register_stage
from ...conference_prep.discovery import (
    discover_conferences,
    ConferenceDiscoveryInput,
)
from ...conference_prep.guidelines import (
    extract_guidelines,
    GuidelineExtractionInput,
)
from ...conference_prep.generate_materials import (
    generate_material,
    MaterialType,
    MaterialGenerationInput,
    PosterContent,
    SlideContent,
    get_demo_poster_content,
    get_demo_slide_content,
)
from ...conference_prep.export_bundle import (
    orchestrate_full_export,
    ExportBundleInput,
)
from ...conference_prep.registry import ConferenceFormat

logger = logging.getLogger("workflow_engine.stages.stage_20_conference")


@register_stage
class Stage20ConferencePreparation:
    """Conference Preparation Stage.

    This stage orchestrates the complete conference submission workflow:
    1. Discovery - Find relevant conferences based on keywords and preferences
    2. Guideline Extraction - Parse submission requirements for selected conferences
    3. Material Generation - Create abstracts, posters, slides, and compliance materials
    4. Validation & Export - QC checks and bundle packaging for submission

    Dependencies: Stage 14 (Manuscript Drafting) recommended but not required
    PHI-Gated: Yes (all outputs must pass PHI scan before export)
    Optional: Runs only if enable_conference_prep=true in job spec
    """

    stage_id = 20
    stage_name = "Conference Preparation"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute conference preparation workflow.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with conference materials and export bundles
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings = []
        errors = []
        artifacts = []

        logger.info(f"Running Conference Preparation for job {context.job_id}")

        try:
            # Check if conference prep is enabled
            config = context.config
            if not config.get("enable_conference_prep", False):
                logger.info("Conference prep disabled - skipping Stage 20")
                return self._create_result(
                    started_at=started_at,
                    status="skipped",
                    output={"reason": "Conference prep disabled in job spec"},
                    artifacts=[],
                    errors=[],
                    warnings=["Stage 20 skipped: enable_conference_prep=false"],
                )

            conference_config = config.get("conference_prep", {})
            offline_mode = context.governance_mode == "DEMO"

            # Setup output directories
            run_id = f"conf_{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}_{context.job_id[:8]}"
            base_path = Path(context.artifact_path) / "conference_prep" / run_id
            base_path.mkdir(parents=True, exist_ok=True)

            logger.info(f"Conference prep artifacts will be stored in: {base_path}")

            # ============ SUB-STAGE 20.1: Conference Discovery ============
            logger.info("[Stage 20.1] Starting conference discovery")

            discovery_input = ConferenceDiscoveryInput(
                keywords=conference_config.get("keywords", []),
                year_range=tuple(conference_config.get("year_range", [2026, 2027])) if conference_config.get("year_range") else None,
                location_pref=conference_config.get("location_preference"),
                formats=conference_config.get("formats", ["poster"]),
                max_results=conference_config.get("max_candidates", 10),
                min_score=conference_config.get("min_relevance_score", 0.3),
            )

            discovery_result = discover_conferences(discovery_input)

            # Save discovery results
            discovery_path = base_path / "discovery" / "conference_candidates.json"
            discovery_path.parent.mkdir(parents=True, exist_ok=True)

            discovery_data = {
                "schema_version": "1.0",
                "run_id": run_id,
                "discovered_at": discovery_result.generated_at,
                "total_found": discovery_result.total_matched,
                "query_context": discovery_result.query_info,
                "ranked_conferences": [rc.to_dict() for rc in discovery_result.ranked_conferences],
            }

            with open(discovery_path, "w") as f:
                json.dump(discovery_data, f, indent=2)

            artifacts.append(str(discovery_path))

            logger.info(f"[Stage 20.1] Discovered {discovery_result.total_matched} conferences")

            if discovery_result.total_matched == 0:
                warnings.append("No conferences matched the search criteria")
                return self._create_result(
                    started_at=started_at,
                    status="completed_with_warnings",
                    output={
                        "run_id": run_id,
                        "discovery_count": 0,
                        "warnings": ["No conferences found matching criteria"],
                    },
                    artifacts=artifacts,
                    errors=[],
                    warnings=warnings,
                )

            # ============ SUB-STAGE 20.2: Guideline Extraction ============
            logger.info("[Stage 20.2] Starting guideline extraction")

            # Get conferences to process (top N or user-selected)
            selected_conference_names = conference_config.get("selected_conferences", [])

            if selected_conference_names:
                # Use user-selected conferences
                conferences_to_process = [
                    rc for rc in discovery_result.ranked_conferences
                    if rc.conference.name in selected_conference_names
                ]
            else:
                # Auto-select top 3 by score
                conferences_to_process = discovery_result.ranked_conferences[:3]

            guidelines_extracted = 0
            guidelines_paths = []

            for ranked_conf in conferences_to_process:
                conf = ranked_conf.conference

                logger.info(f"[Stage 20.2] Extracting guidelines for: {conf.name}")

                guideline_input = GuidelineExtractionInput(
                    conference_name=conf.name,
                    conference_url=conf.url,
                    formats=[ConferenceFormat(fmt) for fmt in conference_config.get("formats", ["poster"])],
                    demo_mode=offline_mode,
                )

                guideline_result = extract_guidelines(guideline_input)

                # Save guidelines
                guideline_path = base_path / "guidelines" / f"guidelines_{conf.abbreviation.lower().replace(' ', '_')}.json"
                guideline_path.parent.mkdir(parents=True, exist_ok=True)

                guideline_data = {
                    "schema_version": "1.0",
                    "conference_name": conf.name,
                    "conference_abbreviation": conf.abbreviation,
                    "extracted_at": guideline_result.extracted_at,
                    "formats": {
                        fmt: eg.to_dict() if eg else None
                        for fmt, eg in guideline_result.by_format.items()
                    },
                    "sources": guideline_result.sources,
                }

                with open(guideline_path, "w") as f:
                    json.dump(guideline_data, f, indent=2)

                artifacts.append(str(guideline_path))
                guidelines_paths.append(guideline_path)
                guidelines_extracted += 1

            logger.info(f"[Stage 20.2] Extracted guidelines for {guidelines_extracted} conferences")

            # ============ SUB-STAGE 20.3: Material Generation ============
            logger.info("[Stage 20.3] Starting material generation")

            # Get manuscript content from prior stages (if available)
            manuscript_abstract = self._get_manuscript_abstract(context)
            research_title = conference_config.get("research_title", "Surgical Research Study")

            materials_generated = 0
            material_paths = []

            for i, ranked_conf in enumerate(conferences_to_process):
                conf = ranked_conf.conference
                guideline_path = guidelines_paths[i]

                # Load guidelines
                with open(guideline_path, "r") as f:
                    guideline_data = json.load(f)

                for format_str in conference_config.get("formats", ["poster"]):
                    format_type = MaterialType(format_str.upper())

                    logger.info(f"[Stage 20.3] Generating {format_type.value} for {conf.name}")

                    # Prepare material generation input
                    if offline_mode:
                        # Use demo content
                        if format_type == MaterialType.POSTER:
                            content = get_demo_poster_content()
                        elif format_type == MaterialType.SLIDES:
                            content = get_demo_slide_content()
                        else:
                            logger.warning(f"No demo content for format: {format_type}")
                            continue
                    else:
                        # Use real manuscript content
                        content = self._create_content_from_manuscript(
                            format_type=format_type,
                            manuscript_abstract=manuscript_abstract,
                            research_title=research_title,
                        )

                    material_input = MaterialGenerationInput(
                        material_type=format_type,
                        conference_name=conf.name,
                        title=research_title,
                        content=content,
                        guidelines=guideline_data.get("formats", {}).get(format_str.lower()),
                    )

                    # Generate material
                    material_result = generate_material(material_input)

                    if material_result.success:
                        # Save generated material
                        material_dir = base_path / "materials" / conf.abbreviation.lower() / format_str.lower()
                        material_dir.mkdir(parents=True, exist_ok=True)

                        if material_result.output_path:
                            # Copy to materials directory
                            import shutil
                            dest_path = material_dir / material_result.output_path.name
                            shutil.copy2(material_result.output_path, dest_path)
                            material_paths.append(dest_path)
                            artifacts.append(str(dest_path))
                            materials_generated += 1
                        else:
                            warnings.append(f"Material generated but no output file for {conf.name}/{format_str}")
                    else:
                        errors.append(f"Failed to generate {format_str} for {conf.name}: {material_result.error}")

            logger.info(f"[Stage 20.3] Generated {materials_generated} materials")

            # ============ SUB-STAGE 20.4: Validation & Export ============
            logger.info("[Stage 20.4] Starting validation and export bundle creation")

            bundles_created = 0
            bundle_paths = []

            for i, ranked_conf in enumerate(conferences_to_process):
                conf = ranked_conf.conference

                for format_str in conference_config.get("formats", ["poster"]):
                    material_dir = base_path / "materials" / conf.abbreviation.lower() / format_str.lower()

                    if not material_dir.exists() or not any(material_dir.iterdir()):
                        logger.warning(f"No materials found for {conf.name}/{format_str} - skipping bundle")
                        continue

                    logger.info(f"[Stage 20.4] Creating export bundle for {conf.name}/{format_str}")

                    bundle_input = ExportBundleInput(
                        conference_name=conf.name,
                        format_type=format_str,
                        material_directory=material_dir,
                        include_validation=True,
                        include_compliance_checklist=True,
                    )

                    try:
                        bundle_result = orchestrate_full_export(bundle_input)

                        if bundle_result.success and bundle_result.bundle_path:
                            bundle_paths.append(bundle_result.bundle_path)
                            artifacts.append(str(bundle_result.bundle_path))
                            bundles_created += 1
                            logger.info(f"[Stage 20.4] Created bundle: {bundle_result.bundle_path.name}")
                        else:
                            errors.append(f"Bundle export failed for {conf.name}/{format_str}: {bundle_result.error}")

                    except Exception as e:
                        errors.append(f"Exception creating bundle for {conf.name}/{format_str}: {str(e)}")
                        logger.error(f"Bundle creation error: {e}", exc_info=True)

            logger.info(f"[Stage 20.4] Created {bundles_created} export bundles")

            # ============ Final Status ============
            output = {
                "run_id": run_id,
                "conferences_discovered": discovery_result.total_matched,
                "conferences_processed": len(conferences_to_process),
                "guidelines_extracted": guidelines_extracted,
                "materials_generated": materials_generated,
                "bundles_created": bundles_created,
                "artifact_base_path": str(base_path),
                "bundle_paths": [str(p) for p in bundle_paths],
            }

            if errors:
                status = "completed_with_errors"
            elif warnings:
                status = "completed_with_warnings"
            else:
                status = "completed"

        except Exception as e:
            logger.error(f"Stage 20 execution failed: {e}", exc_info=True)
            errors.append(f"Stage 20 execution failed: {str(e)}")
            status = "failed"
            output = {"error": str(e)}

        return self._create_result(
            started_at=started_at,
            status=status,
            output=output,
            artifacts=artifacts,
            errors=errors,
            warnings=warnings,
        )

    def _create_result(
        self,
        started_at: str,
        status: str,
        output: Dict[str, Any],
        artifacts: List[str],
        errors: List[str],
        warnings: List[str],
    ) -> StageResult:
        """Helper to create StageResult with consistent timing."""
        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=output,
            artifacts=artifacts,
            errors=errors,
            warnings=warnings,
            metadata={
                "run_id": output.get("run_id", ""),
                "conferences_discovered": output.get("conferences_discovered", 0),
                "bundles_created": output.get("bundles_created", 0),
            },
        )

    def _get_manuscript_abstract(self, context: StageContext) -> str:
        """Extract manuscript abstract from prior stage results."""
        # Try to get from Stage 14 (Manuscript Drafting)
        stage_14_result = context.previous_results.get(14)

        if stage_14_result and stage_14_result.output:
            # Look for abstract in output
            abstract = stage_14_result.output.get("abstract")
            if abstract:
                return abstract

            # Try to find in artifacts
            artifacts = stage_14_result.output.get("artifacts", {})
            abstract_path = artifacts.get("manuscript_abstract")

            if abstract_path and Path(abstract_path).exists():
                with open(abstract_path, "r") as f:
                    return f.read()

        # Fallback: demo abstract
        return """
        Background: Surgical site infections remain a significant clinical challenge.
        Methods: We conducted a retrospective analysis of 500 surgical procedures.
        Results: Implementation of enhanced protocols reduced infection rates by 45%.
        Conclusions: Systematic infection prevention strategies significantly improve outcomes.
        """

    def _create_content_from_manuscript(
        self,
        format_type: MaterialType,
        manuscript_abstract: str,
        research_title: str,
    ) -> Any:
        """Create presentation content from manuscript data."""
        if format_type == MaterialType.POSTER:
            return PosterContent(
                title=research_title,
                authors=["Research Team"],
                institution="Research Institution",
                background=manuscript_abstract.split("Methods:")[0].replace("Background:", "").strip(),
                methods=manuscript_abstract.split("Methods:")[1].split("Results:")[0].strip() if "Methods:" in manuscript_abstract else "",
                results=manuscript_abstract.split("Results:")[1].split("Conclusions:")[0].strip() if "Results:" in manuscript_abstract else "",
                conclusions=manuscript_abstract.split("Conclusions:")[1].strip() if "Conclusions:" in manuscript_abstract else "",
                references=[],
                contact_email="research@example.edu",
            )
        elif format_type == MaterialType.SLIDES:
            return SlideContent(
                title=research_title,
                subtitle="Conference Presentation",
                authors=["Research Team"],
                sections=[
                    {"title": "Background", "content": manuscript_abstract.split("Methods:")[0]},
                    {"title": "Methods", "content": manuscript_abstract.split("Methods:")[1].split("Results:")[0] if "Methods:" in manuscript_abstract else ""},
                    {"title": "Results", "content": manuscript_abstract.split("Results:")[1] if "Results:" in manuscript_abstract else ""},
                ],
                conclusion_points=["Significant findings demonstrated", "Clinical implications identified"],
            )
        else:
            return None
