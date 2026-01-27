"""
Institution template registry and factory.

Provides a registry of available institution templates and
factory functions for creating template instances.
"""

from typing import Dict, Type, List
from .base import InstitutionTemplate, TemplateConfig
from .generic import GenericTemplate
from .emory import EmoryTemplate


# Registry mapping institution IDs to template classes
TEMPLATE_REGISTRY: Dict[str, Type[InstitutionTemplate]] = {
    "generic": GenericTemplate,
    "emory": EmoryTemplate,
}


def get_template(institution_id: str) -> InstitutionTemplate:
    """
    Get an institution template by ID.

    Falls back to GenericTemplate if institution not found.

    Args:
        institution_id: The institution identifier (case-insensitive)

    Returns:
        An instance of the appropriate InstitutionTemplate
    """
    template_class = TEMPLATE_REGISTRY.get(institution_id.lower(), GenericTemplate)
    return template_class()


def get_available_institutions() -> Dict[str, TemplateConfig]:
    """
    Get configurations for all available institutions.

    Returns:
        Dictionary mapping institution IDs to their configurations
    """
    return {
        inst_id: template_class().get_config()
        for inst_id, template_class in TEMPLATE_REGISTRY.items()
    }


def get_institution_ids() -> List[str]:
    """Get list of available institution IDs."""
    return list(TEMPLATE_REGISTRY.keys())


def register_template(
    institution_id: str,
    template_class: Type[InstitutionTemplate],
) -> None:
    """
    Register a new institution template.

    Args:
        institution_id: Unique identifier for the institution
        template_class: Template class implementing InstitutionTemplate
    """
    TEMPLATE_REGISTRY[institution_id.lower()] = template_class


def is_institution_supported(institution_id: str) -> bool:
    """Check if an institution is supported."""
    return institution_id.lower() in TEMPLATE_REGISTRY


__all__ = [
    # Classes
    "InstitutionTemplate",
    "TemplateConfig",
    "GenericTemplate",
    "EmoryTemplate",
    # Functions
    "get_template",
    "get_available_institutions",
    "get_institution_ids",
    "register_template",
    "is_institution_supported",
    # Registry
    "TEMPLATE_REGISTRY",
]
