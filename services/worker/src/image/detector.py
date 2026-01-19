"""
Image Feature Detection

Detects features in images using OpenCV (optional).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Feature flag
ENABLE_OPENCV = os.getenv('ENABLE_OPENCV', '0') == '1'


@dataclass
class DetectedObject:
    """A detected object in an image"""
    label: str
    confidence: float
    bbox: Optional[Tuple[int, int, int, int]] = None  # x, y, w, h
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ImageDetectionResult:
    """Image detection result"""
    success: bool
    image_path: str
    width: Optional[int] = None
    height: Optional[int] = None
    channels: Optional[int] = None
    objects: List[DetectedObject] = field(default_factory=list)
    features: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


def detect_image_features(
    image_path: str,
    detect_faces: bool = False,
    detect_text: bool = False,
    detect_edges: bool = True,
    detect_colors: bool = True
) -> ImageDetectionResult:
    """
    Detect features in an image.

    Args:
        image_path: Path to image file
        detect_faces: Whether to detect faces
        detect_text: Whether to detect text regions
        detect_edges: Whether to detect edges
        detect_colors: Whether to analyze color distribution

    Returns:
        ImageDetectionResult with detected features
    """
    if not os.path.exists(image_path):
        return ImageDetectionResult(
            success=False,
            image_path=image_path,
            error=f"Image not found: {image_path}"
        )

    if not ENABLE_OPENCV:
        # Return basic result without OpenCV
        return _basic_image_info(image_path)

    try:
        import cv2
        import numpy as np

        # Load image
        img = cv2.imread(image_path)

        if img is None:
            return ImageDetectionResult(
                success=False,
                image_path=image_path,
                error="Failed to load image"
            )

        height, width = img.shape[:2]
        channels = img.shape[2] if len(img.shape) > 2 else 1

        result = ImageDetectionResult(
            success=True,
            image_path=image_path,
            width=width,
            height=height,
            channels=channels
        )

        features = {}

        # Detect faces (if requested and haarcascade available)
        if detect_faces:
            try:
                face_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                face_cascade = cv2.CascadeClassifier(face_cascade_path)

                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, 1.1, 4)

                for (x, y, w, h) in faces:
                    result.objects.append(DetectedObject(
                        label='face',
                        confidence=1.0,  # Haar doesn't provide confidence
                        bbox=(x, y, w, h)
                    ))

                features['face_count'] = len(faces)
            except Exception as e:
                logger.warning(f"Face detection failed: {e}")

        # Detect edges
        if detect_edges:
            try:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                edges = cv2.Canny(gray, 100, 200)
                edge_density = np.sum(edges > 0) / (width * height)
                features['edge_density'] = float(edge_density)
            except Exception as e:
                logger.warning(f"Edge detection failed: {e}")

        # Analyze colors
        if detect_colors:
            try:
                # Convert to HSV
                hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

                # Calculate color histograms
                h_hist = cv2.calcHist([hsv], [0], None, [12], [0, 180])
                s_hist = cv2.calcHist([hsv], [1], None, [8], [0, 256])

                # Normalize
                h_hist = h_hist.flatten() / h_hist.sum()
                s_hist = s_hist.flatten() / s_hist.sum()

                # Get dominant hue
                dominant_hue = int(np.argmax(h_hist))
                hue_names = ['red', 'orange', 'yellow', 'lime', 'green', 'cyan',
                             'blue', 'purple', 'magenta', 'pink', 'rose', 'red']
                features['dominant_color'] = hue_names[dominant_hue]

                # Saturation level
                avg_saturation = float(np.average(np.arange(8), weights=s_hist) / 8)
                features['saturation_level'] = avg_saturation

                # Brightness
                avg_brightness = float(np.mean(hsv[:, :, 2]) / 255)
                features['brightness'] = avg_brightness

            except Exception as e:
                logger.warning(f"Color analysis failed: {e}")

        # Detect text regions (using MSER)
        if detect_text:
            try:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                mser = cv2.MSER_create()
                regions, _ = mser.detectRegions(gray)

                # Filter for text-like regions
                text_regions = 0
                for region in regions:
                    x, y, w, h = cv2.boundingRect(region.reshape(-1, 1, 2))
                    aspect = w / h if h > 0 else 0
                    if 0.1 < aspect < 10 and 10 < h < height * 0.5:
                        text_regions += 1

                features['text_region_count'] = text_regions
                features['has_text'] = text_regions > 10

            except Exception as e:
                logger.warning(f"Text detection failed: {e}")

        result.features = features
        return result

    except ImportError:
        logger.warning("OpenCV not installed, returning basic image info")
        return _basic_image_info(image_path)

    except Exception as e:
        logger.exception(f"Image detection failed: {e}")
        return ImageDetectionResult(
            success=False,
            image_path=image_path,
            error=str(e)
        )


def _basic_image_info(image_path: str) -> ImageDetectionResult:
    """Get basic image info without OpenCV"""
    try:
        from PIL import Image

        with Image.open(image_path) as img:
            width, height = img.size
            mode = img.mode
            channels = len(mode) if mode else 1

            return ImageDetectionResult(
                success=True,
                image_path=image_path,
                width=width,
                height=height,
                channels=channels,
                features={'format': img.format, 'mode': mode}
            )

    except ImportError:
        return ImageDetectionResult(
            success=False,
            image_path=image_path,
            error="Neither OpenCV nor PIL available"
        )
    except Exception as e:
        return ImageDetectionResult(
            success=False,
            image_path=image_path,
            error=str(e)
        )


def extract_tables_from_image(image_path: str) -> List[Dict[str, Any]]:
    """
    Attempt to extract table structures from an image.

    Args:
        image_path: Path to image containing tables

    Returns:
        List of detected table structures
    """
    if not ENABLE_OPENCV:
        logger.warning("OpenCV not enabled, cannot extract tables")
        return []

    try:
        import cv2
        import numpy as np

        img = cv2.imread(image_path)
        if img is None:
            return []

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Threshold
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)

        # Detect horizontal and vertical lines
        horizontal = np.copy(thresh)
        vertical = np.copy(thresh)

        cols = horizontal.shape[1]
        rows = vertical.shape[0]

        # Horizontal lines
        horizontal_size = cols // 30
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horizontal_size, 1))
        horizontal = cv2.erode(horizontal, h_kernel)
        horizontal = cv2.dilate(horizontal, h_kernel)

        # Vertical lines
        vertical_size = rows // 30
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, vertical_size))
        vertical = cv2.erode(vertical, v_kernel)
        vertical = cv2.dilate(vertical, v_kernel)

        # Combine
        combined = cv2.add(horizontal, vertical)

        # Find contours
        contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        tables = []
        for i, contour in enumerate(contours):
            x, y, w, h = cv2.boundingRect(contour)

            # Filter for table-like regions
            if w > 50 and h > 50:
                tables.append({
                    'index': i,
                    'bbox': (x, y, w, h),
                    'area': w * h
                })

        return tables

    except Exception as e:
        logger.warning(f"Table extraction failed: {e}")
        return []
