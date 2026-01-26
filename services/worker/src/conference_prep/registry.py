"""
Conference Registry Module

Curated list of major surgical conferences with metadata for discovery and matching.
This registry is designed for offline/DEMO mode operation.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Set
from enum import Enum


class ConferenceFormat(str, Enum):
    """Supported presentation formats at conferences."""
    POSTER = "poster"
    ORAL = "oral"
    SYMPOSIUM = "symposium"
    PANEL = "panel"
    WORKSHOP = "workshop"
    VIDEO = "video"
    QUICKSHOT = "quickshot"


@dataclass
class Conference:
    """Conference metadata for discovery and matching."""

    # Core identifiers
    name: str
    abbreviation: str
    url: str

    # Timing information
    typical_month: int  # 1-12 representing typical month held
    typical_abstract_window: str  # Description of abstract submission window
    abstract_deadline_months_before: int  # Months before conference abstracts are due

    # Format support
    supported_formats: List[ConferenceFormat]

    # Classification tags
    tags: Set[str] = field(default_factory=set)
    keywords: Set[str] = field(default_factory=set)

    # Geographic and scope info
    location: str = "United States"  # Primary location/region
    scope: str = "national"  # national, international, regional

    # Additional metadata
    organization: str = ""
    description: str = ""
    impact_score: float = 0.8  # 0-1 scale for conference importance/prestige

    def matches_keyword(self, keyword: str) -> bool:
        """Check if conference matches a keyword (case-insensitive)."""
        keyword_lower = keyword.lower()
        return (
            keyword_lower in self.name.lower() or
            keyword_lower in self.abbreviation.lower() or
            any(keyword_lower in tag.lower() for tag in self.tags) or
            any(keyword_lower in kw.lower() for kw in self.keywords)
        )

    def matches_format(self, fmt: ConferenceFormat) -> bool:
        """Check if conference supports a presentation format."""
        return fmt in self.supported_formats

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "name": self.name,
            "abbreviation": self.abbreviation,
            "url": self.url,
            "typical_month": self.typical_month,
            "typical_abstract_window": self.typical_abstract_window,
            "abstract_deadline_months_before": self.abstract_deadline_months_before,
            "supported_formats": [f.value for f in self.supported_formats],
            "tags": list(self.tags),
            "keywords": list(self.keywords),
            "location": self.location,
            "scope": self.scope,
            "organization": self.organization,
            "description": self.description,
            "impact_score": self.impact_score,
        }


# ============ Curated Conference Registry ============

CONFERENCE_REGISTRY: List[Conference] = [
    # Major General Surgery Conferences
    Conference(
        name="SAGES Annual Meeting",
        abbreviation="SAGES",
        url="https://www.sages.org/meetings/annual-meeting/",
        typical_month=4,  # April
        typical_abstract_window="September - November (6 months before)",
        abstract_deadline_months_before=6,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
            ConferenceFormat.QUICKSHOT,
        ],
        tags={"minimally_invasive", "laparoscopy", "robotics", "endoscopy", "bariatric", "hernia"},
        keywords={"MIS", "foregut", "GERD", "hiatal", "cholecystectomy", "appendectomy"},
        location="United States (rotating cities)",
        scope="international",
        organization="Society of American Gastrointestinal and Endoscopic Surgeons",
        description="Premier meeting for minimally invasive and GI surgery",
        impact_score=0.95,
    ),

    Conference(
        name="ACS Clinical Congress",
        abbreviation="ACS",
        url="https://www.facs.org/clincon/",
        typical_month=10,  # October
        typical_abstract_window="March - May (5-6 months before)",
        abstract_deadline_months_before=5,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.PANEL,
            ConferenceFormat.VIDEO,
        ],
        tags={"general_surgery", "trauma", "oncology", "education", "outcomes", "quality"},
        keywords={"ACS-NSQIP", "surgical_education", "acute_care", "surgical_outcomes"},
        location="United States (rotating cities)",
        scope="international",
        organization="American College of Surgeons",
        description="Largest surgical meeting in the United States",
        impact_score=0.98,
    ),

    Conference(
        name="Society of University Surgeons Annual Meeting",
        abbreviation="SUS",
        url="https://www.susweb.org/annual-meeting",
        typical_month=2,  # February
        typical_abstract_window="October - November (3-4 months before)",
        abstract_deadline_months_before=4,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.SYMPOSIUM,
        ],
        tags={"academic", "research", "education", "outcomes", "innovation"},
        keywords={"academic_surgery", "surgical_research", "residents", "fellows"},
        location="United States",
        scope="national",
        organization="Society of University Surgeons",
        description="Focus on academic surgical research and education",
        impact_score=0.90,
    ),

    # Hepatobiliary/Pancreas
    Conference(
        name="AHPBA Annual Meeting",
        abbreviation="AHPBA",
        url="https://www.ahpba.org/annual-meeting/",
        typical_month=3,  # March
        typical_abstract_window="October - December (3-4 months before)",
        abstract_deadline_months_before=4,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
            ConferenceFormat.SYMPOSIUM,
        ],
        tags={"hepatobiliary", "pancreas", "liver", "oncology", "transplant"},
        keywords={"HCC", "cholangiocarcinoma", "PDAC", "Whipple", "hepatectomy", "bile_duct"},
        location="United States",
        scope="international",
        organization="Americas Hepato-Pancreato-Biliary Association",
        description="Premier HPB surgery meeting in the Americas",
        impact_score=0.92,
    ),

    # Colorectal
    Conference(
        name="ASCRS Annual Scientific Meeting",
        abbreviation="ASCRS",
        url="https://www.fascrs.org/meeting",
        typical_month=6,  # June
        typical_abstract_window="December - January (5-6 months before)",
        abstract_deadline_months_before=5,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
            ConferenceFormat.SYMPOSIUM,
        ],
        tags={"colorectal", "colon", "rectal", "IBD", "oncology", "pelvic_floor"},
        keywords={"colectomy", "proctectomy", "TME", "IPAA", "hemorrhoids", "fistula"},
        location="United States (rotating cities)",
        scope="international",
        organization="American Society of Colon and Rectal Surgeons",
        description="Largest colorectal surgery meeting in North America",
        impact_score=0.94,
    ),

    # Endocrine Surgery
    Conference(
        name="AAES Annual Meeting",
        abbreviation="AAES",
        url="https://www.endocrinesurgery.org/meeting",
        typical_month=4,  # April
        typical_abstract_window="November - January (3-4 months before)",
        abstract_deadline_months_before=4,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
        ],
        tags={"endocrine", "thyroid", "parathyroid", "adrenal", "neuroendocrine"},
        keywords={"thyroidectomy", "parathyroidectomy", "adrenalectomy", "MEN", "pheochromocytoma"},
        location="United States",
        scope="national",
        organization="American Association of Endocrine Surgeons",
        description="Premier endocrine surgery meeting",
        impact_score=0.88,
    ),

    # Hernia
    Conference(
        name="Americas Hernia Society Annual Meeting",
        abbreviation="AHS",
        url="https://americasherniasociety.org/annual-meeting/",
        typical_month=3,  # March
        typical_abstract_window="September - November (4-5 months before)",
        abstract_deadline_months_before=5,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
            ConferenceFormat.WORKSHOP,
        ],
        tags={"hernia", "abdominal_wall", "mesh", "robotics", "minimally_invasive"},
        keywords={"inguinal", "ventral", "incisional", "TAR", "Rives-Stoppa", "component_separation"},
        location="United States",
        scope="international",
        organization="Americas Hernia Society",
        description="Focused meeting on hernia and abdominal wall reconstruction",
        impact_score=0.86,
    ),

    # Trauma/Acute Care
    Conference(
        name="AAST Annual Meeting",
        abbreviation="AAST",
        url="https://www.aast.org/annual-meeting",
        typical_month=9,  # September
        typical_abstract_window="March - May (4-5 months before)",
        abstract_deadline_months_before=5,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.PANEL,
            ConferenceFormat.QUICKSHOT,
        ],
        tags={"trauma", "acute_care", "emergency", "critical_care", "injury"},
        keywords={"damage_control", "resuscitation", "REBOA", "hemorrhage", "EGS"},
        location="United States (rotating cities)",
        scope="national",
        organization="American Association for the Surgery of Trauma",
        description="Leading trauma and acute care surgery meeting",
        impact_score=0.91,
    ),

    # Bariatric/Metabolic
    Conference(
        name="ASMBS Annual Meeting",
        abbreviation="ASMBS",
        url="https://asmbs.org/professional-education/annual-meeting",
        typical_month=11,  # November
        typical_abstract_window="April - June (5-6 months before)",
        abstract_deadline_months_before=6,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
            ConferenceFormat.SYMPOSIUM,
        ],
        tags={"bariatric", "metabolic", "obesity", "weight_loss", "diabetes"},
        keywords={"gastric_bypass", "sleeve_gastrectomy", "RYGB", "SADI", "revision"},
        location="United States (rotating cities)",
        scope="international",
        organization="American Society for Metabolic and Bariatric Surgery",
        description="Premier bariatric and metabolic surgery meeting",
        impact_score=0.93,
    ),

    # Surgical Oncology
    Conference(
        name="SSO Annual Cancer Symposium",
        abbreviation="SSO",
        url="https://www.surgonc.org/meetings/annual-meeting/",
        typical_month=3,  # March
        typical_abstract_window="September - November (4-5 months before)",
        abstract_deadline_months_before=5,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.SYMPOSIUM,
            ConferenceFormat.QUICKSHOT,
        ],
        tags={"oncology", "cancer", "breast", "melanoma", "sarcoma", "GI_oncology"},
        keywords={"sentinel_node", "mastectomy", "gastrectomy", "cytoreduction", "HIPEC"},
        location="United States (rotating cities)",
        scope="international",
        organization="Society of Surgical Oncology",
        description="Premier surgical oncology meeting",
        impact_score=0.94,
    ),

    # Transplant
    Conference(
        name="ASTS Winter Symposium",
        abbreviation="ASTS",
        url="https://asts.org/meetings-and-events/winter-symposium",
        typical_month=1,  # January
        typical_abstract_window="August - October (3-4 months before)",
        abstract_deadline_months_before=4,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.SYMPOSIUM,
        ],
        tags={"transplant", "liver", "kidney", "pancreas", "immunosuppression"},
        keywords={"living_donor", "deceased_donor", "allocation", "rejection", "DCD"},
        location="United States",
        scope="national",
        organization="American Society of Transplant Surgeons",
        description="Focused transplant surgery meeting",
        impact_score=0.89,
    ),

    # Pediatric Surgery
    Conference(
        name="APSA Annual Meeting",
        abbreviation="APSA",
        url="https://www.eapsa.org/meetings/",
        typical_month=5,  # May
        typical_abstract_window="October - December (5-6 months before)",
        abstract_deadline_months_before=5,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
        ],
        tags={"pediatric", "congenital", "neonatal", "trauma", "oncology"},
        keywords={"appendicitis", "pyloric_stenosis", "Hirschsprung", "neuroblastoma"},
        location="United States (rotating cities)",
        scope="national",
        organization="American Pediatric Surgical Association",
        description="Premier pediatric surgery meeting",
        impact_score=0.88,
    ),

    # Vascular
    Conference(
        name="SVS Vascular Annual Meeting",
        abbreviation="SVS",
        url="https://vascular.org/vam",
        typical_month=6,  # June
        typical_abstract_window="November - January (5-6 months before)",
        abstract_deadline_months_before=5,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
            ConferenceFormat.SYMPOSIUM,
        ],
        tags={"vascular", "aortic", "carotid", "peripheral", "venous", "endovascular"},
        keywords={"AAA", "EVAR", "CEA", "bypass", "PAD", "DVT"},
        location="United States (rotating cities)",
        scope="international",
        organization="Society for Vascular Surgery",
        description="Premier vascular surgery meeting",
        impact_score=0.93,
    ),

    # Thoracic
    Conference(
        name="STS Annual Meeting",
        abbreviation="STS",
        url="https://www.sts.org/meetings/sts-annual-meeting",
        typical_month=1,  # January
        typical_abstract_window="July - September (4-5 months before)",
        abstract_deadline_months_before=5,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.VIDEO,
            ConferenceFormat.SYMPOSIUM,
        ],
        tags={"thoracic", "cardiac", "esophageal", "lung", "mediastinal"},
        keywords={"lobectomy", "VATS", "esophagectomy", "CABG", "valve"},
        location="United States (rotating cities)",
        scope="international",
        organization="Society of Thoracic Surgeons",
        description="Premier cardiothoracic surgery meeting",
        impact_score=0.96,
    ),

    # Quality/Outcomes
    Conference(
        name="Academic Surgical Congress",
        abbreviation="ASC",
        url="https://www.academicsurgicalcongress.org/",
        typical_month=2,  # February
        typical_abstract_window="September - October (4-5 months before)",
        abstract_deadline_months_before=4,
        supported_formats=[
            ConferenceFormat.POSTER,
            ConferenceFormat.ORAL,
            ConferenceFormat.QUICKSHOT,
        ],
        tags={"academic", "research", "outcomes", "education", "residents"},
        keywords={"surgical_education", "simulation", "quality_improvement", "HSR"},
        location="United States",
        scope="national",
        organization="Association for Academic Surgery / Society of University Surgeons",
        description="Combined academic surgery research meeting",
        impact_score=0.87,
    ),
]


# ============ Registry Helper Functions ============

def get_conference_by_name(name: str) -> Optional[Conference]:
    """Get a conference by name or abbreviation (case-insensitive)."""
    name_lower = name.lower()
    for conf in CONFERENCE_REGISTRY:
        if conf.name.lower() == name_lower or conf.abbreviation.lower() == name_lower:
            return conf
    return None


def get_conferences_by_tag(tag: str) -> List[Conference]:
    """Get all conferences matching a specific tag."""
    tag_lower = tag.lower()
    return [
        conf for conf in CONFERENCE_REGISTRY
        if any(tag_lower in t.lower() for t in conf.tags)
    ]


def get_conferences_by_format(fmt: ConferenceFormat) -> List[Conference]:
    """Get all conferences supporting a specific format."""
    return [conf for conf in CONFERENCE_REGISTRY if fmt in conf.supported_formats]


def get_conferences_by_month(month: int) -> List[Conference]:
    """Get all conferences typically held in a specific month (1-12)."""
    return [conf for conf in CONFERENCE_REGISTRY if conf.typical_month == month]


def get_all_conferences() -> List[Conference]:
    """Get the full conference registry."""
    return CONFERENCE_REGISTRY.copy()


def search_conferences(query: str) -> List[Conference]:
    """Search conferences by keyword in name, abbreviation, tags, or keywords."""
    query_lower = query.lower()
    results = []
    for conf in CONFERENCE_REGISTRY:
        if (
            query_lower in conf.name.lower() or
            query_lower in conf.abbreviation.lower() or
            any(query_lower in tag.lower() for tag in conf.tags) or
            any(query_lower in kw.lower() for kw in conf.keywords)
        ):
            results.append(conf)
    return results
