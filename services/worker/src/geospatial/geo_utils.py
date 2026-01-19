"""
Geospatial Utilities

Basic geospatial operations for location data.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Feature flag
ENABLE_GEOCODING = os.getenv('ENABLE_GEOCODING', '0') == '1'


@dataclass
class GeoLocation:
    """A geographic location"""
    latitude: float
    longitude: float
    name: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    raw_input: Optional[str] = None


@dataclass
class GeocodingResult:
    """Geocoding result"""
    success: bool
    location: Optional[GeoLocation] = None
    alternatives: List[GeoLocation] = field(default_factory=list)
    error: Optional[str] = None


def parse_coordinates(
    text: str
) -> Optional[Tuple[float, float]]:
    """
    Parse coordinates from text.

    Supports formats:
    - Decimal degrees: 40.7128, -74.0060
    - DMS: 40°42'46"N 74°0'22"W

    Args:
        text: Text containing coordinates

    Returns:
        Tuple of (latitude, longitude) or None
    """
    # Try decimal degrees format
    decimal_pattern = r'(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)'
    match = re.search(decimal_pattern, text)

    if match:
        lat = float(match.group(1))
        lon = float(match.group(2))

        # Basic validation
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return (lat, lon)

    # Try DMS format (degrees minutes seconds)
    dms_pattern = r'(\d+)[°]\s*(\d+)[\'′]\s*(\d+\.?\d*)[\"″]?\s*([NS])\s+(\d+)[°]\s*(\d+)[\'′]\s*(\d+\.?\d*)[\"″]?\s*([EW])'
    match = re.search(dms_pattern, text, re.IGNORECASE)

    if match:
        lat_d, lat_m, lat_s, lat_dir = match.groups()[:4]
        lon_d, lon_m, lon_s, lon_dir = match.groups()[4:]

        lat = float(lat_d) + float(lat_m) / 60 + float(lat_s) / 3600
        lon = float(lon_d) + float(lon_m) / 60 + float(lon_s) / 3600

        if lat_dir.upper() == 'S':
            lat = -lat
        if lon_dir.upper() == 'W':
            lon = -lon

        return (lat, lon)

    return None


def geocode_location(
    query: str,
    return_alternatives: bool = False
) -> GeocodingResult:
    """
    Geocode a location name to coordinates.

    Args:
        query: Location name or address
        return_alternatives: Return alternative matches

    Returns:
        GeocodingResult with location data
    """
    if not query or not query.strip():
        return GeocodingResult(
            success=False,
            error="Empty query provided"
        )

    # First try to parse as coordinates
    coords = parse_coordinates(query)
    if coords:
        return GeocodingResult(
            success=True,
            location=GeoLocation(
                latitude=coords[0],
                longitude=coords[1],
                raw_input=query
            )
        )

    if not ENABLE_GEOCODING:
        return GeocodingResult(
            success=False,
            error="Geocoding is not enabled. Set ENABLE_GEOCODING=1"
        )

    # Try geocoding service
    return _geocode_nominatim(query, return_alternatives)


def _geocode_nominatim(
    query: str,
    return_alternatives: bool
) -> GeocodingResult:
    """Geocode using OpenStreetMap Nominatim"""
    try:
        import requests

        url = 'https://nominatim.openstreetmap.org/search'
        params = {
            'q': query,
            'format': 'json',
            'limit': 5 if return_alternatives else 1,
            'addressdetails': 1
        }
        headers = {
            'User-Agent': 'ResearchFlow/1.0'
        }

        response = requests.get(url, params=params, headers=headers, timeout=10)

        if response.status_code != 200:
            return GeocodingResult(
                success=False,
                error=f"Nominatim error: {response.status_code}"
            )

        results = response.json()

        if not results:
            return GeocodingResult(
                success=False,
                error="No results found"
            )

        locations = []
        for r in results:
            address = r.get('address', {})
            loc = GeoLocation(
                latitude=float(r['lat']),
                longitude=float(r['lon']),
                name=r.get('display_name'),
                country=address.get('country'),
                region=address.get('state') or address.get('region'),
                city=address.get('city') or address.get('town') or address.get('village'),
                raw_input=query
            )
            locations.append(loc)

        return GeocodingResult(
            success=True,
            location=locations[0],
            alternatives=locations[1:] if return_alternatives else []
        )

    except ImportError:
        return GeocodingResult(
            success=False,
            error="requests library not installed"
        )
    except Exception as e:
        logger.warning(f"Geocoding failed: {e}")
        return GeocodingResult(
            success=False,
            error=str(e)
        )


def calculate_distance(
    point1: Tuple[float, float],
    point2: Tuple[float, float]
) -> float:
    """
    Calculate distance between two points using Haversine formula.

    Args:
        point1: (latitude, longitude) tuple
        point2: (latitude, longitude) tuple

    Returns:
        Distance in kilometers
    """
    import math

    lat1, lon1 = point1
    lat2, lon2 = point2

    # Earth radius in km
    R = 6371.0

    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    # Haversine formula
    a = math.sin(dlat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def extract_locations_from_text(text: str) -> List[str]:
    """
    Extract potential location names from text.

    Args:
        text: Text to analyze

    Returns:
        List of potential location strings
    """
    locations = []

    # Look for common location patterns
    patterns = [
        # City, State/Country patterns
        r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b',
        # Countries
        r'\b(United States|United Kingdom|Germany|France|Japan|China|Canada|Australia|Brazil|India)\b',
        # US States
        r'\b(California|Texas|Florida|New York|Illinois|Pennsylvania|Ohio|Georgia|Michigan|North Carolina)\b',
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            locations.append(match.group(0))

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for loc in locations:
        if loc not in seen:
            seen.add(loc)
            unique.append(loc)

    return unique


def create_geojson_point(location: GeoLocation) -> Dict[str, Any]:
    """
    Create a GeoJSON Point feature from a location.

    Args:
        location: GeoLocation object

    Returns:
        GeoJSON Feature dictionary
    """
    return {
        'type': 'Feature',
        'geometry': {
            'type': 'Point',
            'coordinates': [location.longitude, location.latitude]
        },
        'properties': {
            'name': location.name,
            'country': location.country,
            'region': location.region,
            'city': location.city
        }
    }
