"""
Apple Health Import Service - Task 198

Parses Apple Health export XML files.
Note: Users must manually export their health data from the iPhone Health app.
There is no backend API to directly access Apple HealthKit data.

Reference: https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios
"""

import logging
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Union

logger = logging.getLogger(__name__)


@dataclass
class HealthRecord:
    """A single health record from Apple Health export"""
    record_type: str
    source_name: str
    source_version: Optional[str]
    unit: Optional[str]
    value: Optional[str]
    creation_date: Optional[datetime]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    device: Optional[str]
    metadata: Dict[str, Any]


@dataclass
class WorkoutRecord:
    """A workout record from Apple Health export"""
    workout_type: str
    duration: float  # seconds
    duration_unit: str
    total_distance: Optional[float]
    total_energy_burned: Optional[float]
    source_name: str
    creation_date: Optional[datetime]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    metadata: Dict[str, Any]


@dataclass
class AppleHealthExport:
    """Parsed Apple Health export data"""
    export_date: Optional[datetime]
    locale: Optional[str]
    records: List[HealthRecord]
    workouts: List[WorkoutRecord]
    activity_summaries: List[Dict[str, Any]]
    clinical_records: List[Dict[str, Any]]
    me_record: Optional[Dict[str, Any]]
    stats: Dict[str, int]


class AppleHealthParser:
    """Parser for Apple Health export.xml files"""

    # Map of Apple Health record types to normalized names
    RECORD_TYPE_MAP = {
        "HKQuantityTypeIdentifierHeartRate": "heart_rate",
        "HKQuantityTypeIdentifierStepCount": "steps",
        "HKQuantityTypeIdentifierDistanceWalkingRunning": "distance_walking_running",
        "HKQuantityTypeIdentifierActiveEnergyBurned": "active_energy_burned",
        "HKQuantityTypeIdentifierBasalEnergyBurned": "basal_energy_burned",
        "HKQuantityTypeIdentifierFlightsClimbed": "flights_climbed",
        "HKQuantityTypeIdentifierAppleExerciseTime": "exercise_time",
        "HKQuantityTypeIdentifierAppleStandTime": "stand_time",
        "HKQuantityTypeIdentifierBloodPressureSystolic": "blood_pressure_systolic",
        "HKQuantityTypeIdentifierBloodPressureDiastolic": "blood_pressure_diastolic",
        "HKQuantityTypeIdentifierBloodGlucose": "blood_glucose",
        "HKQuantityTypeIdentifierBodyMass": "body_mass",
        "HKQuantityTypeIdentifierBodyMassIndex": "bmi",
        "HKQuantityTypeIdentifierHeight": "height",
        "HKQuantityTypeIdentifierBodyFatPercentage": "body_fat_percentage",
        "HKQuantityTypeIdentifierOxygenSaturation": "oxygen_saturation",
        "HKQuantityTypeIdentifierBodyTemperature": "body_temperature",
        "HKQuantityTypeIdentifierRespiratoryRate": "respiratory_rate",
        "HKQuantityTypeIdentifierRestingHeartRate": "resting_heart_rate",
        "HKQuantityTypeIdentifierVO2Max": "vo2_max",
        "HKQuantityTypeIdentifierWalkingHeartRateAverage": "walking_heart_rate_avg",
        "HKCategoryTypeIdentifierSleepAnalysis": "sleep_analysis",
        "HKCategoryTypeIdentifierMindfulSession": "mindful_session",
    }

    WORKOUT_TYPE_MAP = {
        "HKWorkoutActivityTypeRunning": "running",
        "HKWorkoutActivityTypeWalking": "walking",
        "HKWorkoutActivityTypeCycling": "cycling",
        "HKWorkoutActivityTypeSwimming": "swimming",
        "HKWorkoutActivityTypeYoga": "yoga",
        "HKWorkoutActivityTypeFunctionalStrengthTraining": "strength_training",
        "HKWorkoutActivityTypeHighIntensityIntervalTraining": "hiit",
        "HKWorkoutActivityTypeElliptical": "elliptical",
        "HKWorkoutActivityTypeRowing": "rowing",
        "HKWorkoutActivityTypeStairClimbing": "stair_climbing",
    }

    def __init__(self, max_records: Optional[int] = None):
        """
        Initialize parser.

        Args:
            max_records: Maximum number of records to parse (for memory limits)
        """
        self.max_records = max_records

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse Apple Health date format"""
        if not date_str:
            return None
        try:
            # Format: "2024-01-15 10:30:00 -0500"
            return datetime.strptime(date_str[:19], "%Y-%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            return None

    def _normalize_record_type(self, apple_type: str) -> str:
        """Convert Apple Health record type to normalized name"""
        return self.RECORD_TYPE_MAP.get(apple_type, apple_type)

    def _normalize_workout_type(self, apple_type: str) -> str:
        """Convert Apple Health workout type to normalized name"""
        return self.WORKOUT_TYPE_MAP.get(apple_type, apple_type)

    def _parse_record(self, elem: ET.Element) -> HealthRecord:
        """Parse a Record element"""
        return HealthRecord(
            record_type=self._normalize_record_type(elem.get("type", "")),
            source_name=elem.get("sourceName", ""),
            source_version=elem.get("sourceVersion"),
            unit=elem.get("unit"),
            value=elem.get("value"),
            creation_date=self._parse_date(elem.get("creationDate")),
            start_date=self._parse_date(elem.get("startDate")),
            end_date=self._parse_date(elem.get("endDate")),
            device=elem.get("device"),
            metadata={
                child.get("key", ""): child.get("value", "")
                for child in elem.findall("MetadataEntry")
            },
        )

    def _parse_workout(self, elem: ET.Element) -> WorkoutRecord:
        """Parse a Workout element"""
        return WorkoutRecord(
            workout_type=self._normalize_workout_type(elem.get("workoutActivityType", "")),
            duration=float(elem.get("duration", 0)),
            duration_unit=elem.get("durationUnit", "min"),
            total_distance=float(elem.get("totalDistance", 0)) if elem.get("totalDistance") else None,
            total_energy_burned=float(elem.get("totalEnergyBurned", 0)) if elem.get("totalEnergyBurned") else None,
            source_name=elem.get("sourceName", ""),
            creation_date=self._parse_date(elem.get("creationDate")),
            start_date=self._parse_date(elem.get("startDate")),
            end_date=self._parse_date(elem.get("endDate")),
            metadata={
                child.get("key", ""): child.get("value", "")
                for child in elem.findall("MetadataEntry")
            },
        )

    def parse_xml(self, xml_content: Union[str, bytes]) -> AppleHealthExport:
        """
        Parse Apple Health export.xml content.

        Args:
            xml_content: XML content as string or bytes

        Returns:
            AppleHealthExport with parsed data
        """
        if isinstance(xml_content, str):
            xml_content = xml_content.encode("utf-8")

        root = ET.fromstring(xml_content)

        records: List[HealthRecord] = []
        workouts: List[WorkoutRecord] = []
        activity_summaries: List[Dict[str, Any]] = []
        clinical_records: List[Dict[str, Any]] = []
        me_record: Optional[Dict[str, Any]] = None

        stats = {
            "total_records": 0,
            "total_workouts": 0,
            "total_activity_summaries": 0,
            "total_clinical_records": 0,
        }

        # Parse ExportDate
        export_date = None
        export_elem = root.find("ExportDate")
        if export_elem is not None:
            export_date = self._parse_date(export_elem.get("value"))

        # Parse Me record
        me_elem = root.find("Me")
        if me_elem is not None:
            me_record = dict(me_elem.attrib)

        # Parse records
        for record_elem in root.iter("Record"):
            stats["total_records"] += 1
            if self.max_records and len(records) >= self.max_records:
                continue
            records.append(self._parse_record(record_elem))

        # Parse workouts
        for workout_elem in root.iter("Workout"):
            stats["total_workouts"] += 1
            workouts.append(self._parse_workout(workout_elem))

        # Parse activity summaries
        for summary_elem in root.iter("ActivitySummary"):
            stats["total_activity_summaries"] += 1
            activity_summaries.append(dict(summary_elem.attrib))

        # Parse clinical records
        for clinical_elem in root.iter("ClinicalRecord"):
            stats["total_clinical_records"] += 1
            clinical_records.append(dict(clinical_elem.attrib))

        return AppleHealthExport(
            export_date=export_date,
            locale=root.get("locale"),
            records=records,
            workouts=workouts,
            activity_summaries=activity_summaries,
            clinical_records=clinical_records,
            me_record=me_record,
            stats=stats,
        )

    def parse_zip(self, zip_path: Union[str, Path, BytesIO]) -> AppleHealthExport:
        """
        Parse Apple Health export.zip file.

        Args:
            zip_path: Path to zip file or BytesIO object

        Returns:
            AppleHealthExport with parsed data
        """
        with zipfile.ZipFile(zip_path, "r") as zf:
            # Find export.xml in the zip
            xml_path = None
            for name in zf.namelist():
                if name.endswith("export.xml"):
                    xml_path = name
                    break

            if not xml_path:
                raise ValueError("No export.xml found in Apple Health export zip")

            xml_content = zf.read(xml_path)
            return self.parse_xml(xml_content)

    def stream_records(
        self, xml_path: Union[str, Path]
    ) -> Generator[HealthRecord, None, None]:
        """
        Stream parse records from a large XML file (memory efficient).

        Args:
            xml_path: Path to export.xml

        Yields:
            HealthRecord objects
        """
        context = ET.iterparse(xml_path, events=("end",))
        count = 0

        for event, elem in context:
            if elem.tag == "Record":
                yield self._parse_record(elem)
                count += 1

                if self.max_records and count >= self.max_records:
                    break

                # Clear processed elements to save memory
                elem.clear()


def parse_apple_health_export(
    file_input: Union[str, Path, bytes, BytesIO],
    max_records: Optional[int] = None,
) -> AppleHealthExport:
    """
    Parse an Apple Health export file (zip or xml).

    Args:
        file_input: Path to file, bytes, or BytesIO
        max_records: Maximum number of records to parse

    Returns:
        AppleHealthExport with parsed data
    """
    parser = AppleHealthParser(max_records=max_records)

    if isinstance(file_input, (str, Path)):
        path = Path(file_input)
        if path.suffix == ".zip":
            return parser.parse_zip(path)
        elif path.suffix == ".xml":
            with open(path, "rb") as f:
                return parser.parse_xml(f.read())
        else:
            raise ValueError(f"Unsupported file type: {path.suffix}")

    elif isinstance(file_input, bytes):
        # Try to detect if it's a zip or xml
        if file_input[:4] == b"PK\x03\x04":
            return parser.parse_zip(BytesIO(file_input))
        else:
            return parser.parse_xml(file_input)

    elif isinstance(file_input, BytesIO):
        # Check if zip
        file_input.seek(0)
        header = file_input.read(4)
        file_input.seek(0)

        if header == b"PK\x03\x04":
            return parser.parse_zip(file_input)
        else:
            return parser.parse_xml(file_input.read())

    else:
        raise ValueError(f"Unsupported input type: {type(file_input)}")


def normalize_health_data_to_schema(export: AppleHealthExport) -> Dict[str, Any]:
    """
    Normalize Apple Health export to ResearchFlow schema format.

    Returns a dictionary compatible with the research data extraction schema.
    """
    return {
        "source": "apple_health",
        "export_date": export.export_date.isoformat() if export.export_date else None,
        "subject": export.me_record,
        "metrics": {
            "total_records": export.stats["total_records"],
            "total_workouts": export.stats["total_workouts"],
            "record_types": list(set(r.record_type for r in export.records)),
            "workout_types": list(set(w.workout_type for w in export.workouts)),
            "date_range": _compute_date_range(export),
        },
        "records": [_record_to_dict(r) for r in export.records[:1000]],  # Limit for API
        "workouts": [_workout_to_dict(w) for w in export.workouts],
        "activity_summaries": export.activity_summaries[:365],  # Last year
    }


def _compute_date_range(export: AppleHealthExport) -> Dict[str, Optional[str]]:
    """Compute the date range of all records"""
    dates = [r.start_date for r in export.records if r.start_date]
    dates.extend(w.start_date for w in export.workouts if w.start_date)

    if not dates:
        return {"start": None, "end": None}

    return {
        "start": min(dates).isoformat(),
        "end": max(dates).isoformat(),
    }


def _record_to_dict(record: HealthRecord) -> Dict[str, Any]:
    """Convert HealthRecord to dictionary"""
    return {
        "type": record.record_type,
        "value": record.value,
        "unit": record.unit,
        "source": record.source_name,
        "start_date": record.start_date.isoformat() if record.start_date else None,
        "end_date": record.end_date.isoformat() if record.end_date else None,
    }


def _workout_to_dict(workout: WorkoutRecord) -> Dict[str, Any]:
    """Convert WorkoutRecord to dictionary"""
    return {
        "type": workout.workout_type,
        "duration_seconds": workout.duration * (60 if workout.duration_unit == "min" else 1),
        "distance": workout.total_distance,
        "energy_burned": workout.total_energy_burned,
        "source": workout.source_name,
        "start_date": workout.start_date.isoformat() if workout.start_date else None,
        "end_date": workout.end_date.isoformat() if workout.end_date else None,
    }
