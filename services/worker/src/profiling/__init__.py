"""
Data Profiling Module

Generates profiling reports using ydata-profiling.
Gated by ENABLE_PROFILING environment variable (default: false).
"""

import os

ENABLE_PROFILING = os.getenv("ENABLE_PROFILING", "false").lower() == "true"

from .profile_report import generate_profile_report, ProfileResult

__all__ = [
    'generate_profile_report',
    'ProfileResult',
    'ENABLE_PROFILING',
]
