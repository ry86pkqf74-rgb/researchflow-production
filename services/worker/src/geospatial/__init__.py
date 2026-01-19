"""
Geospatial Module

Geographic data processing and analysis.
"""

from .geo_utils import (
    parse_coordinates,
    geocode_location,
    GeoLocation,
    GeocodingResult,
)

__all__ = [
    'parse_coordinates',
    'geocode_location',
    'GeoLocation',
    'GeocodingResult',
]
