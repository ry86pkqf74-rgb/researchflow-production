"""
Compliance Module
Phase 5.2: Research reporting guideline compliance checkers

Supported checklists:
- STROBE: Strengthening the Reporting of Observational Studies in Epidemiology
- PRISMA: Preferred Reporting Items for Systematic Reviews and Meta-Analyses
"""

from .strobe import check_strobe_compliance, STROBE_ITEMS
from .prisma import check_prisma_compliance, PRISMA_ITEMS
from .compliance_report import (
    generate_compliance_report,
    ComplianceItem,
    ComplianceReport,
    ComplianceStatus
)

__all__ = [
    'check_strobe_compliance',
    'check_prisma_compliance',
    'generate_compliance_report',
    'ComplianceItem',
    'ComplianceReport',
    'ComplianceStatus',
    'STROBE_ITEMS',
    'PRISMA_ITEMS'
]
