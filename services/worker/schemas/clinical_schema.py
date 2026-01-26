"""
Clinical Data Schemas

Defines standard clinical biomarker schemas with reference ranges
for RAIR (Radioactive Iodine Refractory) thyroid cancer research.
"""
from typing import Any

# Thyroid biomarkers with reference ranges (RAIR/DTC focused)
THYROID_BIOMARKERS: dict[str, dict[str, Any]] = {
    "TSH": {
        "name": "Thyroid Stimulating Hormone",
        "unit": "mIU/L",
        "ref_range": [0.4, 4.0],
        "critical_low": 0.1,
        "critical_high": 10.0,
        "suppression_target": 0.1,  # For DTC patients on suppression therapy
        "description": "Primary marker for thyroid function"
    },
    "Tg": {
        "name": "Thyroglobulin",
        "unit": "ng/mL",
        "ref_range": [0, 55],
        "post_thyroidectomy_target": 0.2,
        "elevated_threshold": 10.0,
        "description": "Tumor marker for differentiated thyroid cancer"
    },
    "FT3": {
        "name": "Free Triiodothyronine",
        "unit": "pg/mL",
        "ref_range": [2.3, 4.2],
        "critical_low": 1.5,
        "critical_high": 6.0,
        "description": "Active thyroid hormone"
    },
    "FT4": {
        "name": "Free Thyroxine",
        "unit": "ng/dL",
        "ref_range": [0.8, 1.8],
        "critical_low": 0.5,
        "critical_high": 3.0,
        "description": "Primary thyroid hormone"
    },
    "Anti_Tg": {
        "name": "Anti-Thyroglobulin Antibodies",
        "unit": "IU/mL",
        "threshold": 4.0,
        "positive_indicator": True,
        "description": "Can interfere with Tg measurements"
    },
    "Anti_TPO": {
        "name": "Anti-Thyroid Peroxidase Antibodies",
        "unit": "IU/mL",
        "threshold": 9.0,
        "positive_indicator": True,
        "description": "Marker for autoimmune thyroid disease"
    },
    "RAIR_status": {
        "name": "Radioactive Iodine Refractory Status",
        "type": "categorical",
        "values": ["sensitive", "refractory", "indeterminate"],
        "criteria": {
            "refractory": [
                "No iodine uptake on diagnostic scan",
                "Loss of uptake after prior response",
                "Progression despite RAI treatment",
                "Cumulative RAI dose >600 mCi without response"
            ]
        },
        "description": "Classification for RAI therapy response"
    },
    "Calcitonin": {
        "name": "Calcitonin",
        "unit": "pg/mL",
        "ref_range": [0, 10],
        "elevated_threshold": 100,
        "description": "Marker for medullary thyroid cancer (MTC)"
    },
    "CEA": {
        "name": "Carcinoembryonic Antigen",
        "unit": "ng/mL",
        "ref_range": [0, 5],
        "description": "Secondary marker for MTC, prognostic value"
    }
}

# HIPAA 18 identifiers for PHI detection
HIPAA_18_IDENTIFIERS: list[dict[str, Any]] = [
    {"id": 1, "name": "Name", "pattern": "name", "risk": "high"},
    {"id": 2, "name": "Geographic Data", "pattern": "address|zip|city|state", "risk": "high"},
    {"id": 3, "name": "Dates", "pattern": "dob|birth|admit|discharge", "risk": "medium"},
    {"id": 4, "name": "Phone Numbers", "pattern": "phone|tel|mobile", "risk": "high"},
    {"id": 5, "name": "Fax Numbers", "pattern": "fax", "risk": "medium"},
    {"id": 6, "name": "Email Addresses", "pattern": "email", "risk": "high"},
    {"id": 7, "name": "SSN", "pattern": "ssn|social", "risk": "critical"},
    {"id": 8, "name": "MRN", "pattern": "mrn|medical_record|patient_id", "risk": "critical"},
    {"id": 9, "name": "Health Plan ID", "pattern": "insurance|plan_id|member_id", "risk": "high"},
    {"id": 10, "name": "Account Numbers", "pattern": "account", "risk": "medium"},
    {"id": 11, "name": "Certificate/License", "pattern": "license|certificate", "risk": "medium"},
    {"id": 12, "name": "Vehicle IDs", "pattern": "vin|vehicle|plate", "risk": "low"},
    {"id": 13, "name": "Device IDs", "pattern": "device|serial", "risk": "medium"},
    {"id": 14, "name": "URLs", "pattern": "url|website", "risk": "low"},
    {"id": 15, "name": "IP Addresses", "pattern": "ip_address", "risk": "medium"},
    {"id": 16, "name": "Biometric IDs", "pattern": "fingerprint|retina|voice", "risk": "high"},
    {"id": 17, "name": "Photos", "pattern": "photo|image|face", "risk": "high"},
    {"id": 18, "name": "Other Unique IDs", "pattern": "unique_id|identifier", "risk": "medium"}
]


def get_biomarker_info(biomarker_code: str) -> dict[str, Any] | None:
    """
    Get detailed information about a specific biomarker.
    
    Args:
        biomarker_code: The biomarker code (e.g., "TSH", "Tg")
        
    Returns:
        Biomarker information dictionary or None if not found
    """
    return THYROID_BIOMARKERS.get(biomarker_code)


def validate_biomarker_value(biomarker_code: str, value: float) -> dict[str, Any]:
    """
    Validate a biomarker value against reference ranges.
    
    Args:
        biomarker_code: The biomarker code
        value: The numeric value to validate
        
    Returns:
        Validation result with status and interpretation
    """
    biomarker = THYROID_BIOMARKERS.get(biomarker_code)
    if not biomarker:
        return {"valid": False, "error": f"Unknown biomarker: {biomarker_code}"}
    
    if "ref_range" not in biomarker:
        return {"valid": True, "status": "no_range", "message": "Categorical or non-numeric marker"}
    
    low, high = biomarker["ref_range"]
    
    result = {
        "valid": True,
        "biomarker": biomarker_code,
        "value": value,
        "unit": biomarker.get("unit", ""),
        "ref_range": biomarker["ref_range"]
    }
    
    if value < low:
        result["status"] = "low"
        result["interpretation"] = f"Below reference range ({low}-{high} {biomarker.get('unit', '')})"
        if "critical_low" in biomarker and value < biomarker["critical_low"]:
            result["status"] = "critical_low"
            result["alert"] = True
    elif value > high:
        result["status"] = "high"
        result["interpretation"] = f"Above reference range ({low}-{high} {biomarker.get('unit', '')})"
        if "critical_high" in biomarker and value > biomarker["critical_high"]:
            result["status"] = "critical_high"
            result["alert"] = True
    else:
        result["status"] = "normal"
        result["interpretation"] = "Within reference range"
    
    return result


def get_all_biomarkers() -> dict[str, dict[str, Any]]:
    """
    Get all defined thyroid biomarkers.
    """
    return THYROID_BIOMARKERS.copy()


def get_biomarker_reference_ranges() -> dict[str, dict[str, Any]]:
    """
    Get biomarker reference ranges for API consumption.
    Returns a simplified view of biomarker data for the reference endpoint.
    """
    return {
        code: {
            "name": info["name"],
            "unit": info.get("unit", ""),
            "ref_range": info.get("ref_range"),
            "threshold": info.get("threshold"),
            "type": info.get("type", "numeric"),
            "values": info.get("values"),
            "description": info.get("description", "")
        }
        for code, info in THYROID_BIOMARKERS.items()
    }
