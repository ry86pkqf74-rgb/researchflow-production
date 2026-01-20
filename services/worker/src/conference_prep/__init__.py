"""
Conference Preparation Module

Provides conference discovery, ranking, guideline extraction, and material
generation for surgical research conferences. Supports DEMO mode with
offline-only curated registry and fixture data.

Features:
- Conference discovery and ranking based on keywords and preferences
- Guideline extraction with PII/PHI sanitization
- Poster PDF generation using reportlab
- Slides PPTX generation using python-pptx
- Export bundling with manifest and validation
"""

from .registry import (
    CONFERENCE_REGISTRY,
    Conference,
    ConferenceFormat,
    get_conference_by_name,
    get_conferences_by_tag,
    get_all_conferences,
)

from .discovery import (
    discover_conferences,
    ConferenceDiscoveryInput,
    ConferenceDiscoveryResult,
    RankedConference,
)

from .guidelines import (
    extract_guidelines,
    extract_guidelines_from_text,
    sanitize_text,
    ExtractedGuidelines,
    GuidelineExtractionInput,
    GuidelineExtractionResult,
    get_demo_guidelines,
    list_demo_conferences,
    DEMO_GUIDELINES,
)

from .generate_materials import (
    MaterialType,
    PosterContent,
    SlideContent,
    MaterialGenerationInput,
    MaterialGenerationResult,
    generate_poster_pdf,
    generate_slides_pptx,
    generate_material,
    check_dependencies,
    get_demo_poster_content,
    get_demo_slide_content,
)

from .export_bundle import (
    BundleFile,
    BundleManifest,
    ExportBundleInput,
    ExportBundleResult,
    create_conference_bundle,
    validate_bundle,
    list_bundle_contents,
    orchestrate_full_export,
)

__all__ = [
    # Registry
    "CONFERENCE_REGISTRY",
    "Conference",
    "ConferenceFormat",
    "get_conference_by_name",
    "get_conferences_by_tag",
    "get_all_conferences",
    # Discovery
    "discover_conferences",
    "ConferenceDiscoveryInput",
    "ConferenceDiscoveryResult",
    "RankedConference",
    # Guidelines
    "extract_guidelines",
    "extract_guidelines_from_text",
    "sanitize_text",
    "ExtractedGuidelines",
    "GuidelineExtractionInput",
    "GuidelineExtractionResult",
    "get_demo_guidelines",
    "list_demo_conferences",
    "DEMO_GUIDELINES",
    # Material Generation
    "MaterialType",
    "PosterContent",
    "SlideContent",
    "MaterialGenerationInput",
    "MaterialGenerationResult",
    "generate_poster_pdf",
    "generate_slides_pptx",
    "generate_material",
    "check_dependencies",
    "get_demo_poster_content",
    "get_demo_slide_content",
    # Export Bundle
    "BundleFile",
    "BundleManifest",
    "ExportBundleInput",
    "ExportBundleResult",
    "create_conference_bundle",
    "validate_bundle",
    "list_bundle_contents",
    "orchestrate_full_export",
]
