"""
Geospatial Data Parser

Parses geospatial files using GeoPandas (GeoJSON, Shapefiles, etc.).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import BaseParser, ParseResult

logger = logging.getLogger(__name__)


class GeospatialParser(BaseParser):
    """Parser for geospatial data formats using GeoPandas."""

    @property
    def name(self) -> str:
        return "geospatial"

    @property
    def supported_extensions(self) -> List[str]:
        return ["geojson", "shp", "gpkg", "kml", "gml"]

    @property
    def supported_mimetypes(self) -> List[str]:
        return [
            "application/geo+json",
            "application/vnd.geo+json",
            "application/x-shapefile",
            "application/geopackage+sqlite3",
        ]

    def parse(
        self,
        file_path: Path,
        include_geometry: bool = True,
        max_features: Optional[int] = None,
        **options
    ) -> ParseResult:
        """
        Parse a geospatial file.

        Args:
            file_path: Path to the geospatial file
            include_geometry: Whether to include geometry in output
            max_features: Maximum features to load
            **options: Additional options

        Returns:
            ParseResult with parsed data
        """
        try:
            import geopandas as gpd
        except ImportError:
            return ParseResult(
                success=False,
                format=self.name,
                errors=["geopandas not installed. Install with: pip install geopandas"],
            )

        try:
            # Load geospatial data
            if max_features:
                gdf = gpd.read_file(file_path, rows=max_features)
            else:
                gdf = gpd.read_file(file_path)

            # Extract CRS info
            crs_info = None
            if gdf.crs:
                crs_info = {
                    "name": str(gdf.crs),
                    "is_geographic": gdf.crs.is_geographic,
                    "is_projected": gdf.crs.is_projected,
                }
                if hasattr(gdf.crs, "to_epsg"):
                    crs_info["epsg"] = gdf.crs.to_epsg()

            # Get bounds
            bounds = None
            try:
                total_bounds = gdf.total_bounds
                bounds = {
                    "minx": float(total_bounds[0]),
                    "miny": float(total_bounds[1]),
                    "maxx": float(total_bounds[2]),
                    "maxy": float(total_bounds[3]),
                }
            except Exception:
                pass

            # Extract geometry types
            geom_types = gdf.geometry.geom_type.value_counts().to_dict()

            # Extract schema
            schema_info = {
                "properties": {
                    col: str(gdf[col].dtype)
                    for col in gdf.columns
                    if col != "geometry"
                },
                "geometry_type": list(geom_types.keys()),
            }

            # Prepare data output
            data = None
            if include_geometry:
                # Convert to GeoJSON-like structure
                try:
                    features = json.loads(gdf.to_json())
                    data = features.get("features", [])
                except Exception:
                    pass
            else:
                # Just attributes without geometry
                data = gdf.drop(columns=["geometry"], errors="ignore").to_dict(orient="records")

            return ParseResult(
                success=True,
                format=self.name,
                record_count=len(gdf),
                columns=[col for col in gdf.columns if col != "geometry"],
                schema=schema_info,
                data=data[:1000] if data else None,  # Limit output size
                metadata={
                    "crs": crs_info,
                    "bounds": bounds,
                    "geometry_types": geom_types,
                    "total_features": len(gdf),
                    "file_format": file_path.suffix.lower(),
                },
            )

        except Exception as e:
            logger.exception(f"Error parsing geospatial file: {e}")
            return ParseResult(
                success=False,
                format=self.name,
                errors=[str(e)],
            )


def is_geopandas_available() -> bool:
    """Check if GeoPandas is available."""
    try:
        import geopandas
        return True
    except ImportError:
        return False


def read_geospatial_file(
    file_path: Path,
    max_features: Optional[int] = None,
) -> Optional[Any]:
    """
    Read a geospatial file into a GeoDataFrame.

    Args:
        file_path: Path to the file
        max_features: Maximum features to load

    Returns:
        GeoDataFrame or None if error
    """
    if not is_geopandas_available():
        return None

    try:
        import geopandas as gpd
        if max_features:
            return gpd.read_file(file_path, rows=max_features)
        return gpd.read_file(file_path)
    except Exception as e:
        logger.error(f"Error reading geospatial file: {e}")
        return None


def get_bounds(gdf) -> Dict[str, float]:
    """
    Get bounding box of a GeoDataFrame.

    Args:
        gdf: GeoDataFrame

    Returns:
        Dict with minx, miny, maxx, maxy
    """
    try:
        bounds = gdf.total_bounds
        return {
            "minx": float(bounds[0]),
            "miny": float(bounds[1]),
            "maxx": float(bounds[2]),
            "maxy": float(bounds[3]),
        }
    except Exception:
        return {}


def reproject(gdf, target_crs: str = "EPSG:4326"):
    """
    Reproject a GeoDataFrame to a different CRS.

    Args:
        gdf: GeoDataFrame
        target_crs: Target coordinate reference system

    Returns:
        Reprojected GeoDataFrame
    """
    try:
        return gdf.to_crs(target_crs)
    except Exception as e:
        logger.error(f"Error reprojecting: {e}")
        return gdf
