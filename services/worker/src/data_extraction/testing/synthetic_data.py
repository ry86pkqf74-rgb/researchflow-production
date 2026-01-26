"""
Synthetic Clinical Data Generator - Generate realistic clinical notes for testing.

This module generates synthetic clinical notes with known ground truth for:
- Testing extraction accuracy
- Benchmarking tier performance
- Validating PHI scanning
- Training and validation datasets

Usage:
    from data_extraction.testing import SyntheticNoteGenerator
    
    generator = SyntheticNoteGenerator(seed=42)
    note, ground_truth = generator.generate_operative_note()
"""

import random
import string
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum


class NoteType(str, Enum):
    """Types of clinical notes."""
    OPERATIVE = "operative_note"
    DISCHARGE = "discharge_summary"
    PROGRESS = "progress_note"
    CONSULT = "consultation"
    H_AND_P = "history_and_physical"


@dataclass
class GroundTruth:
    """Ground truth extraction for a synthetic note."""
    note_type: str
    diagnoses: List[Dict[str, Any]] = field(default_factory=list)
    procedures: List[Dict[str, Any]] = field(default_factory=list)
    medications: List[Dict[str, Any]] = field(default_factory=list)
    outcomes: List[Dict[str, Any]] = field(default_factory=list)
    complications: List[Dict[str, Any]] = field(default_factory=list)
    study_fields: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "note_type": self.note_type,
            "diagnoses": self.diagnoses,
            "procedures": self.procedures,
            "medications": self.medications,
            "outcomes": self.outcomes,
            "complications": self.complications,
            "study_fields": self.study_fields,
        }


@dataclass
class SyntheticNote:
    """A synthetic clinical note with ground truth."""
    text: str
    ground_truth: GroundTruth
    note_id: str
    complexity: str  # simple, moderate, complex
    has_phi: bool = False
    phi_locations: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "note_id": self.note_id,
            "text": self.text,
            "ground_truth": self.ground_truth.to_dict(),
            "complexity": self.complexity,
            "has_phi": self.has_phi,
            "phi_locations": self.phi_locations,
        }


class SyntheticNoteGenerator:
    """
    Generate synthetic clinical notes with known ground truth.
    
    All generated content uses clearly synthetic identifiers to ensure
    no confusion with real patient data.
    """
    
    # Diagnosis pools by specialty
    DIAGNOSES = {
        "general_surgery": [
            ("acute appendicitis", "K35.80"),
            ("symptomatic cholelithiasis", "K80.20"),
            ("inguinal hernia", "K40.90"),
            ("umbilical hernia", "K42.9"),
            ("bowel obstruction", "K56.60"),
            ("diverticulitis", "K57.32"),
            ("GERD", "K21.0"),
        ],
        "orthopedics": [
            ("rotator cuff tear", "M75.10"),
            ("ACL tear", "S83.51"),
            ("hip osteoarthritis", "M16.9"),
            ("knee osteoarthritis", "M17.9"),
            ("lumbar disc herniation", "M51.16"),
            ("carpal tunnel syndrome", "G56.00"),
        ],
        "cardiology": [
            ("coronary artery disease", "I25.10"),
            ("atrial fibrillation", "I48.91"),
            ("heart failure", "I50.9"),
            ("hypertension", "I10"),
            ("aortic stenosis", "I35.0"),
        ],
    }
    
    # Procedure pools
    PROCEDURES = {
        "general_surgery": [
            ("laparoscopic appendectomy", "0DTJ4ZZ"),
            ("laparoscopic cholecystectomy", "0FB44ZZ"),
            ("open inguinal hernia repair", "0YQ50ZZ"),
            ("laparoscopic umbilical hernia repair", "0WQF4ZZ"),
            ("exploratory laparotomy", "0WJG0ZZ"),
        ],
        "orthopedics": [
            ("arthroscopic rotator cuff repair", "0MQ24ZZ"),
            ("ACL reconstruction", "0MQG4ZZ"),
            ("total hip arthroplasty", "0SR9019"),
            ("total knee arthroplasty", "0SRD019"),
            ("lumbar discectomy", "0SB20ZZ"),
        ],
    }
    
    # Medication pools
    MEDICATIONS = {
        "antibiotics": [
            {"name": "cefazolin", "dose": "2g", "route": "IV", "frequency": "q8h"},
            {"name": "metronidazole", "dose": "500mg", "route": "IV", "frequency": "q8h"},
            {"name": "ciprofloxacin", "dose": "400mg", "route": "IV", "frequency": "q12h"},
            {"name": "vancomycin", "dose": "1g", "route": "IV", "frequency": "q12h"},
        ],
        "pain": [
            {"name": "acetaminophen", "dose": "1000mg", "route": "PO", "frequency": "q6h PRN"},
            {"name": "ibuprofen", "dose": "600mg", "route": "PO", "frequency": "q8h"},
            {"name": "hydrocodone/acetaminophen", "dose": "5/325mg", "route": "PO", "frequency": "q4h PRN"},
            {"name": "ketorolac", "dose": "30mg", "route": "IV", "frequency": "q6h"},
            {"name": "morphine", "dose": "2mg", "route": "IV", "frequency": "q4h PRN"},
        ],
        "antiemetic": [
            {"name": "ondansetron", "dose": "4mg", "route": "IV", "frequency": "q8h PRN"},
        ],
        "dvt_prophylaxis": [
            {"name": "enoxaparin", "dose": "40mg", "route": "SC", "frequency": "daily"},
            {"name": "heparin", "dose": "5000 units", "route": "SC", "frequency": "q8h"},
        ],
    }
    
    # Complication pools
    COMPLICATIONS = {
        "minor": [
            ("nausea", "I"),
            ("urinary retention", "I"),
            ("wound seroma", "I"),
            ("superficial wound infection", "II"),
            ("UTI", "II"),
            ("ileus", "II"),
        ],
        "major": [
            ("deep wound infection", "IIIa"),
            ("anastomotic leak", "IIIb"),
            ("bleeding requiring transfusion", "II"),
            ("pulmonary embolism", "IVa"),
            ("sepsis", "IVb"),
        ],
    }
    
    # Outcome templates
    OUTCOMES = [
        "Patient tolerated procedure well",
        "Discharged home in stable condition",
        "Transferred to floor in stable condition",
        "Admitted to ICU for monitoring",
        "Uneventful postoperative course",
    ]
    
    # PHI templates for testing PHI scanning
    PHI_TEMPLATES = {
        "ssn": "SSN: {ssn}",
        "mrn": "MRN: {mrn}",
        "phone": "Phone: {phone}",
        "email": "Email: {email}",
        "name": "Patient: {name}",
        "dob": "DOB: {dob}",
        "address": "Address: {address}",
    }
    
    def __init__(self, seed: Optional[int] = None):
        """
        Initialize the generator.
        
        Args:
            seed: Random seed for reproducibility
        """
        self.rng = random.Random(seed)
        self._note_counter = 0
    
    def _generate_id(self) -> str:
        """Generate a unique note ID."""
        self._note_counter += 1
        return f"SYN-{self._note_counter:06d}"
    
    def _random_age(self, min_age: int = 18, max_age: int = 90) -> int:
        """Generate random patient age."""
        return self.rng.randint(min_age, max_age)
    
    def _random_gender(self) -> str:
        """Generate random gender."""
        return self.rng.choice(["male", "female"])
    
    def _random_bmi(self, min_bmi: float = 18.5, max_bmi: float = 45.0) -> float:
        """Generate random BMI."""
        return round(self.rng.uniform(min_bmi, max_bmi), 1)
    
    def _random_asa(self, max_asa: int = 4) -> str:
        """Generate random ASA class."""
        weights = [0.3, 0.4, 0.2, 0.1][:max_asa]
        return self.rng.choices(["I", "II", "III", "IV"][:max_asa], weights=weights)[0]
    
    def _random_ebl(self, procedure_type: str = "laparoscopic") -> int:
        """Generate random estimated blood loss."""
        if "laparoscopic" in procedure_type.lower():
            return self.rng.randint(5, 100)
        else:
            return self.rng.randint(50, 500)
    
    def _random_or_time(self, complexity: str = "moderate") -> int:
        """Generate random operative time in minutes."""
        ranges = {
            "simple": (15, 45),
            "moderate": (30, 120),
            "complex": (90, 300),
        }
        min_t, max_t = ranges.get(complexity, (30, 120))
        return self.rng.randint(min_t, max_t)
    
    def _random_los(self, procedure_type: str = "laparoscopic", complicated: bool = False) -> int:
        """Generate random length of stay in days."""
        if complicated:
            return self.rng.randint(3, 14)
        if "laparoscopic" in procedure_type.lower():
            return self.rng.choices([0, 1, 2], weights=[0.4, 0.5, 0.1])[0]
        else:
            return self.rng.randint(2, 7)
    
    def _generate_phi(self) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Generate synthetic PHI for testing PHI scanners.
        
        Returns synthetic, clearly fake identifiers that should trigger PHI detection.
        """
        phi_text_parts = []
        phi_locations = []
        
        # Generate fake SSN
        ssn = f"{self.rng.randint(100, 999)}-{self.rng.randint(10, 99)}-{self.rng.randint(1000, 9999)}"
        ssn_text = f"SSN: {ssn}"
        phi_locations.append({"type": "ssn", "text_hash": hash(ssn) % 10000})
        phi_text_parts.append(ssn_text)
        
        # Generate fake MRN
        mrn = f"SYN{self.rng.randint(1000000, 9999999)}"
        mrn_text = f"MRN: {mrn}"
        phi_locations.append({"type": "mrn", "text_hash": hash(mrn) % 10000})
        phi_text_parts.append(mrn_text)
        
        # Generate fake phone
        phone = f"({self.rng.randint(200, 999)}) {self.rng.randint(100, 999)}-{self.rng.randint(1000, 9999)}"
        phone_text = f"Phone: {phone}"
        phi_locations.append({"type": "phone", "text_hash": hash(phone) % 10000})
        phi_text_parts.append(phone_text)
        
        return "\n".join(phi_text_parts), phi_locations
    
    def generate_operative_note(
        self,
        specialty: str = "general_surgery",
        complexity: str = "moderate",
        include_complications: bool = False,
        include_phi: bool = False,
    ) -> SyntheticNote:
        """
        Generate a synthetic operative note.
        
        Args:
            specialty: Medical specialty (general_surgery, orthopedics)
            complexity: Note complexity (simple, moderate, complex)
            include_complications: Whether to include complications
            include_phi: Whether to include PHI for testing PHI scanners
        
        Returns:
            SyntheticNote with text and ground truth
        """
        note_id = self._generate_id()
        
        # Patient demographics
        age = self._random_age()
        gender = self._random_gender()
        bmi = self._random_bmi()
        asa = self._random_asa()
        
        # Select diagnosis and procedure
        diagnoses_pool = self.DIAGNOSES.get(specialty, self.DIAGNOSES["general_surgery"])
        procedures_pool = self.PROCEDURES.get(specialty, self.PROCEDURES["general_surgery"])
        
        primary_dx = self.rng.choice(diagnoses_pool)
        primary_proc = self.rng.choice(procedures_pool)
        
        # Generate study fields
        ebl = self._random_ebl(primary_proc[0])
        or_time = self._random_or_time(complexity)
        los = self._random_los(primary_proc[0], include_complications)
        
        # Build ground truth
        ground_truth = GroundTruth(
            note_type="operative_note",
            diagnoses=[{"text": primary_dx[0], "icd10": primary_dx[1]}],
            procedures=[{"text": primary_proc[0], "cpt": primary_proc[1]}],
            medications=[],
            outcomes=[],
            complications=[],
            study_fields={
                "asa_class": asa,
                "bmi": bmi,
                "estimated_blood_loss_ml": ebl,
                "operative_time_minutes": or_time,
                "length_of_stay_days": los,
                "conversion_to_open": False,
            },
        )
        
        # Add medications
        antibiotic = self.rng.choice(self.MEDICATIONS["antibiotics"])
        ground_truth.medications.append(antibiotic)
        
        # Add complications if requested
        complication_text = ""
        if include_complications:
            complication = self.rng.choice(self.COMPLICATIONS["minor"])
            ground_truth.complications.append({
                "text": complication[0],
                "clavien_dindo": complication[1],
            })
            complication_text = f"\nCOMPLICATIONS: {complication[0]}"
        else:
            complication_text = "\nCOMPLICATIONS: None"
        
        # Add outcome
        outcome = self.rng.choice(self.OUTCOMES)
        ground_truth.outcomes.append({"text": outcome})
        
        # Build note text
        note_parts = [
            "OPERATIVE REPORT",
            f"[SYNTHETIC NOTE ID: {note_id}]",
            "",
            f"PROCEDURE: {primary_proc[0]}",
            "",
            f"PREOPERATIVE DIAGNOSIS: {primary_dx[0]}",
            f"POSTOPERATIVE DIAGNOSIS: Same",
            "",
            f"INDICATION: {age}-year-old {gender} with {primary_dx[0]}.",
            "",
            f"ANESTHESIA: General",
            f"ASA Classification: {asa}",
            f"BMI: {bmi}",
            "",
            "PROCEDURE DETAILS:",
            f"The patient was brought to the operating room and placed supine on the table. ",
            f"General anesthesia was induced. The abdomen was prepped and draped in sterile fashion. ",
            f"Prophylactic {antibiotic['name']} {antibiotic['dose']} {antibiotic['route']} was administered. ",
            f"The procedure was performed without difficulty.",
            "",
            f"ESTIMATED BLOOD LOSS: {ebl} mL",
            f"OPERATIVE TIME: {or_time} minutes",
            complication_text,
            "",
            f"DISPOSITION: {outcome}",
            f"EXPECTED LENGTH OF STAY: {los} days" if los > 0 else "DISPOSITION: Same-day discharge",
        ]
        
        # Add PHI if requested
        phi_locations = []
        if include_phi:
            phi_text, phi_locations = self._generate_phi()
            note_parts.insert(2, phi_text)
        
        note_text = "\n".join(note_parts)
        
        return SyntheticNote(
            text=note_text,
            ground_truth=ground_truth,
            note_id=note_id,
            complexity=complexity,
            has_phi=include_phi,
            phi_locations=phi_locations,
        )
    
    def generate_discharge_summary(
        self,
        specialty: str = "general_surgery",
        complexity: str = "moderate",
        include_phi: bool = False,
    ) -> SyntheticNote:
        """
        Generate a synthetic discharge summary.
        
        Args:
            specialty: Medical specialty
            complexity: Note complexity
            include_phi: Whether to include PHI
        
        Returns:
            SyntheticNote with text and ground truth
        """
        note_id = self._generate_id()
        
        # Patient demographics
        age = self._random_age()
        gender = self._random_gender()
        
        # Diagnosis
        diagnoses_pool = self.DIAGNOSES.get(specialty, self.DIAGNOSES["general_surgery"])
        primary_dx = self.rng.choice(diagnoses_pool)
        
        # Medications
        discharge_meds = [
            self.rng.choice(self.MEDICATIONS["pain"]),
            self.rng.choice(self.MEDICATIONS["antibiotics"]),
        ]
        
        los = self._random_los("open", False)
        
        ground_truth = GroundTruth(
            note_type="discharge_summary",
            diagnoses=[{"text": primary_dx[0], "icd10": primary_dx[1]}],
            procedures=[],
            medications=discharge_meds,
            outcomes=[{"text": "Discharged home in stable condition"}],
            complications=[],
            study_fields={
                "length_of_stay_days": los,
                "readmission_30day": False,
            },
        )
        
        # Build note text
        med_text = "\n".join([
            f"  - {m['name']} {m['dose']} {m['route']} {m['frequency']}"
            for m in discharge_meds
        ])
        
        note_parts = [
            "DISCHARGE SUMMARY",
            f"[SYNTHETIC NOTE ID: {note_id}]",
            "",
            f"ADMISSION DIAGNOSIS: {primary_dx[0]}",
            f"DISCHARGE DIAGNOSIS: Same",
            "",
            f"HOSPITAL COURSE:",
            f"{age}-year-old {gender} admitted for {primary_dx[0]}. ",
            f"Hospital course was uncomplicated. Patient tolerated diet and ambulated independently.",
            "",
            f"LENGTH OF STAY: {los} days",
            "",
            "DISCHARGE MEDICATIONS:",
            med_text,
            "",
            "DISCHARGE INSTRUCTIONS:",
            "- Follow up with surgeon in 2 weeks",
            "- Activity as tolerated",
            "- Call if fever >101.5F, worsening pain, or wound drainage",
            "",
            "DISPOSITION: Discharged home in stable condition",
        ]
        
        phi_locations = []
        if include_phi:
            phi_text, phi_locations = self._generate_phi()
            note_parts.insert(2, phi_text)
        
        note_text = "\n".join(note_parts)
        
        return SyntheticNote(
            text=note_text,
            ground_truth=ground_truth,
            note_id=note_id,
            complexity=complexity,
            has_phi=include_phi,
            phi_locations=phi_locations,
        )
    
    def generate_batch(
        self,
        count: int = 10,
        note_types: Optional[List[str]] = None,
        complexity_distribution: Optional[Dict[str, float]] = None,
        phi_ratio: float = 0.0,
        complication_ratio: float = 0.2,
    ) -> List[SyntheticNote]:
        """
        Generate a batch of synthetic notes.
        
        Args:
            count: Number of notes to generate
            note_types: List of note types to include (default: operative, discharge)
            complexity_distribution: Distribution of complexity levels
            phi_ratio: Ratio of notes to include PHI (0.0-1.0)
            complication_ratio: Ratio of operative notes with complications
        
        Returns:
            List of SyntheticNote objects
        """
        note_types = note_types or ["operative_note", "discharge_summary"]
        complexity_distribution = complexity_distribution or {
            "simple": 0.3,
            "moderate": 0.5,
            "complex": 0.2,
        }
        
        notes = []
        for _ in range(count):
            note_type = self.rng.choice(note_types)
            complexity = self.rng.choices(
                list(complexity_distribution.keys()),
                weights=list(complexity_distribution.values()),
            )[0]
            include_phi = self.rng.random() < phi_ratio
            include_complications = self.rng.random() < complication_ratio
            
            if note_type == "operative_note":
                note = self.generate_operative_note(
                    complexity=complexity,
                    include_complications=include_complications,
                    include_phi=include_phi,
                )
            else:
                note = self.generate_discharge_summary(
                    complexity=complexity,
                    include_phi=include_phi,
                )
            
            notes.append(note)
        
        return notes
    
    def generate_gold_standard_cases(self) -> List[SyntheticNote]:
        """
        Generate a fixed set of gold standard test cases.
        
        These are deterministic cases with known, verified ground truth
        for validating extraction accuracy.
        
        Returns:
            List of gold standard SyntheticNote objects
        """
        # Reset RNG for reproducibility
        old_rng = self.rng
        self.rng = random.Random(12345)
        
        gold_cases = []
        
        # Case 1: Simple appendectomy
        gold_cases.append(self._gold_case_simple_appendectomy())
        
        # Case 2: Cholecystectomy with complications
        gold_cases.append(self._gold_case_complicated_chole())
        
        # Case 3: Discharge summary with multiple meds
        gold_cases.append(self._gold_case_discharge_multi_meds())
        
        # Case 4: Note with PHI
        gold_cases.append(self._gold_case_with_phi())
        
        # Restore RNG
        self.rng = old_rng
        
        return gold_cases
    
    def _gold_case_simple_appendectomy(self) -> SyntheticNote:
        """Gold case: Simple laparoscopic appendectomy."""
        note_id = "GOLD-001"
        
        ground_truth = GroundTruth(
            note_type="operative_note",
            diagnoses=[{"text": "acute appendicitis", "icd10": "K35.80"}],
            procedures=[{"text": "laparoscopic appendectomy", "cpt": "0DTJ4ZZ"}],
            medications=[{"name": "cefazolin", "dose": "2g", "route": "IV", "frequency": "preop"}],
            outcomes=[{"text": "To PACU in stable condition"}],
            complications=[],
            study_fields={
                "asa_class": "II",
                "bmi": 24.5,
                "estimated_blood_loss_ml": 15,
                "operative_time_minutes": 38,
                "length_of_stay_days": 0,
                "conversion_to_open": False,
            },
        )
        
        text = """OPERATIVE REPORT
[GOLD STANDARD CASE: GOLD-001]

PROCEDURE: Laparoscopic appendectomy

PREOPERATIVE DIAGNOSIS: Acute appendicitis
POSTOPERATIVE DIAGNOSIS: Same

INDICATION: 34-year-old female with 2-day history of RLQ pain, CT showing acute appendicitis.

ASA Classification: II
BMI: 24.5

PROCEDURE DETAILS:
Patient placed under general anesthesia. Cefazolin 2g IV given preop. Three-port laparoscopic approach. 
Appendix visualized with inflammation. Mesoappendix divided with LigaSure. Appendix transected with 
endoscopic stapler. Specimen removed in bag.

ESTIMATED BLOOD LOSS: 15 mL
OPERATIVE TIME: 38 minutes
COMPLICATIONS: None

DISPOSITION: To PACU in stable condition. Plan for same-day discharge."""
        
        return SyntheticNote(
            text=text,
            ground_truth=ground_truth,
            note_id=note_id,
            complexity="simple",
            has_phi=False,
        )
    
    def _gold_case_complicated_chole(self) -> SyntheticNote:
        """Gold case: Cholecystectomy with conversion."""
        note_id = "GOLD-002"
        
        ground_truth = GroundTruth(
            note_type="operative_note",
            diagnoses=[
                {"text": "acute cholecystitis", "icd10": "K81.0"},
                {"text": "cholelithiasis", "icd10": "K80.20"},
            ],
            procedures=[{"text": "open cholecystectomy", "cpt": "47600"}],
            medications=[
                {"name": "piperacillin-tazobactam", "dose": "3.375g", "route": "IV", "frequency": "q6h"},
            ],
            outcomes=[{"text": "To surgical floor in stable condition"}],
            complications=[{"text": "conversion to open due to dense adhesions", "clavien_dindo": "I"}],
            study_fields={
                "asa_class": "III",
                "bmi": 38.2,
                "estimated_blood_loss_ml": 250,
                "operative_time_minutes": 145,
                "length_of_stay_days": 4,
                "conversion_to_open": True,
            },
        )
        
        text = """OPERATIVE REPORT
[GOLD STANDARD CASE: GOLD-002]

PROCEDURE: Open cholecystectomy (converted from laparoscopic)

PREOPERATIVE DIAGNOSIS: Acute cholecystitis with cholelithiasis
POSTOPERATIVE DIAGNOSIS: Same

INDICATION: 58-year-old male with acute cholecystitis refractory to medical management.

ASA Classification: III
BMI: 38.2

PROCEDURE DETAILS:
Laparoscopic approach initially attempted. Dense adhesions in the hepatocystic triangle precluded 
safe visualization. Decision made to convert to open. Right subcostal incision. Retrograde 
cholecystectomy performed. Piperacillin-tazobactam 3.375g IV q6h started.

ESTIMATED BLOOD LOSS: 250 mL
OPERATIVE TIME: 145 minutes
COMPLICATIONS: Conversion to open due to dense adhesions

DISPOSITION: To surgical floor in stable condition
EXPECTED LENGTH OF STAY: 4 days"""
        
        return SyntheticNote(
            text=text,
            ground_truth=ground_truth,
            note_id=note_id,
            complexity="complex",
            has_phi=False,
        )
    
    def _gold_case_discharge_multi_meds(self) -> SyntheticNote:
        """Gold case: Discharge summary with multiple medications."""
        note_id = "GOLD-003"
        
        ground_truth = GroundTruth(
            note_type="discharge_summary",
            diagnoses=[{"text": "inguinal hernia repair", "icd10": "K40.90"}],
            procedures=[],
            medications=[
                {"name": "hydrocodone/acetaminophen", "dose": "5/325mg", "route": "PO", "frequency": "q4-6h PRN"},
                {"name": "ibuprofen", "dose": "600mg", "route": "PO", "frequency": "q8h with food"},
                {"name": "docusate", "dose": "100mg", "route": "PO", "frequency": "BID"},
            ],
            outcomes=[{"text": "Discharged home in stable condition"}],
            complications=[],
            study_fields={
                "length_of_stay_days": 1,
                "readmission_30day": False,
            },
        )
        
        text = """DISCHARGE SUMMARY
[GOLD STANDARD CASE: GOLD-003]

ADMISSION DIAGNOSIS: Right inguinal hernia
DISCHARGE DIAGNOSIS: Status post right inguinal hernia repair

HOSPITAL COURSE:
45-year-old male underwent uncomplicated open right inguinal hernia repair. 
Postoperative course uneventful. Tolerated diet, voided, ambulated.

LENGTH OF STAY: 1 day

DISCHARGE MEDICATIONS:
1. Hydrocodone/acetaminophen 5/325mg PO q4-6h PRN for pain
2. Ibuprofen 600mg PO q8h with food for pain
3. Docusate 100mg PO BID for constipation prevention

DISPOSITION: Discharged home in stable condition"""
        
        return SyntheticNote(
            text=text,
            ground_truth=ground_truth,
            note_id=note_id,
            complexity="moderate",
            has_phi=False,
        )
    
    def _gold_case_with_phi(self) -> SyntheticNote:
        """Gold case: Note with PHI for testing PHI scanning."""
        note_id = "GOLD-004-PHI"
        
        ground_truth = GroundTruth(
            note_type="progress_note",
            diagnoses=[{"text": "postoperative day 1 after appendectomy"}],
            procedures=[],
            medications=[],
            outcomes=[{"text": "Progressing well, plan for discharge"}],
            complications=[],
            study_fields={},
        )
        
        text = """PROGRESS NOTE
[GOLD STANDARD CASE WITH PHI: GOLD-004-PHI]

Patient: John Synthetic-Doe
MRN: SYN1234567
DOB: 01/15/1985
SSN: 123-45-6789
Phone: (555) 123-4567

SUBJECTIVE: Patient feeling much better today. Pain well controlled.

OBJECTIVE: Afebrile, VS stable. Abdomen soft, incisions clean.

ASSESSMENT: POD1 status post laparoscopic appendectomy, progressing well.

PLAN: Advance diet, discharge home if tolerating."""
        
        phi_locations = [
            {"type": "name", "text_hash": hash("John Synthetic-Doe") % 10000},
            {"type": "mrn", "text_hash": hash("SYN1234567") % 10000},
            {"type": "dob", "text_hash": hash("01/15/1985") % 10000},
            {"type": "ssn", "text_hash": hash("123-45-6789") % 10000},
            {"type": "phone", "text_hash": hash("(555) 123-4567") % 10000},
        ]
        
        return SyntheticNote(
            text=text,
            ground_truth=ground_truth,
            note_id=note_id,
            complexity="simple",
            has_phi=True,
            phi_locations=phi_locations,
        )


# Module-level convenience functions
def generate_synthetic_note(
    note_type: str = "operative_note",
    complexity: str = "moderate",
    seed: Optional[int] = None,
) -> SyntheticNote:
    """Generate a single synthetic note."""
    generator = SyntheticNoteGenerator(seed=seed)
    if note_type == "operative_note":
        return generator.generate_operative_note(complexity=complexity)
    else:
        return generator.generate_discharge_summary(complexity=complexity)


def generate_test_batch(
    count: int = 10,
    seed: Optional[int] = None,
) -> List[SyntheticNote]:
    """Generate a batch of synthetic notes for testing."""
    generator = SyntheticNoteGenerator(seed=seed)
    return generator.generate_batch(count=count)


def get_gold_standard_cases() -> List[SyntheticNote]:
    """Get the gold standard test cases."""
    generator = SyntheticNoteGenerator(seed=12345)
    return generator.generate_gold_standard_cases()


__all__ = [
    "SyntheticNoteGenerator",
    "SyntheticNote",
    "GroundTruth",
    "NoteType",
    "generate_synthetic_note",
    "generate_test_batch",
    "get_gold_standard_cases",
]
