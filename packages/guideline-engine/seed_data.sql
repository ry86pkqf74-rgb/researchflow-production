-- =============================================================================
-- Guideline Engine Seed Data
-- Clinical Scoring Systems for ResearchFlow
-- =============================================================================
-- This seed data includes well-known clinical scoring/staging systems.
-- Each system has a SystemCard, RuleSpec(s), and EvidenceStatements.
-- =============================================================================

-- =============================================================================
-- 1. CHA2DS2-VASc Score (Stroke Risk in Atrial Fibrillation)
-- =============================================================================

INSERT INTO system_cards (
  id, name, display_name, description, system_type, specialty, intended_use,
  input_variables, output_definition, interpretation,
  source_guideline, source_year, doi, pmid, status, is_verified
) VALUES (
  'cha2ds2-vasc-2019',
  'CHA2DS2-VASc',
  'CHA2DS2-VASc Stroke Risk Score',
  'Estimates stroke risk in patients with atrial fibrillation. Used to guide anticoagulation therapy decisions.',
  'score',
  'cardiology',
  'risk_stratification',
  '[
    {"name": "age", "type": "number", "description": "Patient age in years", "required": true, "unit": "years"},
    {"name": "sex", "type": "categorical", "description": "Biological sex", "required": true, "allowedValues": ["male", "female"]},
    {"name": "chf_history", "type": "boolean", "description": "Congestive heart failure history", "required": true},
    {"name": "hypertension", "type": "boolean", "description": "Hypertension history", "required": true},
    {"name": "stroke_tia_history", "type": "boolean", "description": "Prior stroke/TIA/thromboembolism", "required": true},
    {"name": "vascular_disease", "type": "boolean", "description": "Vascular disease (MI, PAD, aortic plaque)", "required": true},
    {"name": "diabetes", "type": "boolean", "description": "Diabetes mellitus", "required": true}
  ]'::jsonb,
  '{"type": "integer", "range": {"min": 0, "max": 9}, "unit": "points", "description": "CHA2DS2-VASc score"}'::jsonb,
  '[
    {"value_min": 0, "value_max": 0, "label": "Low Risk", "description": "Annual stroke risk ~0%. Anticoagulation generally not recommended."},
    {"value_min": 1, "value_max": 1, "label": "Low-Moderate Risk", "description": "Annual stroke risk ~1.3%. Consider anticoagulation based on individual factors."},
    {"value_min": 2, "value_max": 9, "label": "Moderate-High Risk", "description": "Annual stroke risk ≥2.2%. Oral anticoagulation recommended."}
  ]'::jsonb,
  '2019 AHA/ACC/HRS Focused Update on Atrial Fibrillation',
  2019,
  '10.1016/j.jacc.2019.01.011',
  '30703431',
  'active',
  true
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  input_variables = EXCLUDED.input_variables,
  output_definition = EXCLUDED.output_definition,
  interpretation = EXCLUDED.interpretation;

-- CHA2DS2-VASc Rule Spec
INSERT INTO rule_specs (
  id, system_card_id, rule_type, rule_definition, test_cases
) VALUES (
  'cha2ds2-vasc-rule-v1',
  'cha2ds2-vasc-2019',
  'formula',
  '{
    "formula": "(age >= 75 ? 2 : (age >= 65 ? 1 : 0)) + (sex == \"female\" ? 1 : 0) + (chf_history ? 1 : 0) + (hypertension ? 1 : 0) + (stroke_tia_history ? 2 : 0) + (vascular_disease ? 1 : 0) + (diabetes ? 1 : 0)",
    "variables": ["age", "sex", "chf_history", "hypertension", "stroke_tia_history", "vascular_disease", "diabetes"],
    "description": "Sum of risk factors: Age 65-74 (+1), Age ≥75 (+2), Female sex (+1), CHF (+1), HTN (+1), Stroke/TIA (+2), Vascular disease (+1), Diabetes (+1)"
  }'::jsonb,
  '[
    {"inputs": {"age": 45, "sex": "male", "chf_history": false, "hypertension": false, "stroke_tia_history": false, "vascular_disease": false, "diabetes": false}, "expected_output": 0, "description": "Healthy 45yo male"},
    {"inputs": {"age": 72, "sex": "female", "chf_history": true, "hypertension": true, "stroke_tia_history": false, "vascular_disease": false, "diabetes": false}, "expected_output": 4, "description": "72yo female with CHF and HTN"},
    {"inputs": {"age": 80, "sex": "male", "chf_history": true, "hypertension": true, "stroke_tia_history": true, "vascular_disease": true, "diabetes": true}, "expected_output": 8, "description": "High-risk 80yo male"}
  ]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  rule_definition = EXCLUDED.rule_definition,
  test_cases = EXCLUDED.test_cases;

-- CHA2DS2-VASc Evidence
INSERT INTO evidence_statements (
  id, system_card_id, statement_type, statement_text,
  source_anchor, evidence_grade, supporting_citations
) VALUES (
  'cha2ds2-vasc-ev-1',
  'cha2ds2-vasc-2019',
  'validation',
  'CHA2DS2-VASc score has been validated in multiple large cohorts with consistent predictive performance for stroke risk.',
  '{"section": "Methods", "page": 4, "excerpt": "The CHA2DS2-VASc score demonstrated good discrimination (c-statistic 0.67)"}'::jsonb,
  'A',
  '["10.1016/j.jacc.2019.01.011", "10.1161/CIRCULATIONAHA.114.014299"]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  statement_text = EXCLUDED.statement_text,
  evidence_grade = EXCLUDED.evidence_grade;

-- =============================================================================
-- 2. MELD Score (Model for End-Stage Liver Disease)
-- =============================================================================

INSERT INTO system_cards (
  id, name, display_name, description, system_type, specialty, intended_use,
  input_variables, output_definition, interpretation,
  source_guideline, source_year, doi, pmid, status, is_verified
) VALUES (
  'meld-score-2016',
  'MELD',
  'Model for End-Stage Liver Disease (MELD) Score',
  'Predicts 3-month mortality in patients with end-stage liver disease. Used for liver transplant allocation.',
  'score',
  'hepatology',
  'prognosis',
  '[
    {"name": "creatinine", "type": "number", "description": "Serum creatinine", "required": true, "unit": "mg/dL", "range": {"min": 0.1, "max": 15}},
    {"name": "bilirubin", "type": "number", "description": "Total bilirubin", "required": true, "unit": "mg/dL", "range": {"min": 0.1, "max": 50}},
    {"name": "inr", "type": "number", "description": "International Normalized Ratio", "required": true, "range": {"min": 0.8, "max": 10}},
    {"name": "sodium", "type": "number", "description": "Serum sodium (for MELD-Na)", "required": false, "unit": "mEq/L", "range": {"min": 100, "max": 160}},
    {"name": "on_dialysis", "type": "boolean", "description": "On dialysis twice in past week", "required": true}
  ]'::jsonb,
  '{"type": "number", "range": {"min": 6, "max": 40}, "unit": "points", "description": "MELD score (capped at 40)"}'::jsonb,
  '[
    {"value_min": 6, "value_max": 9, "label": "Low", "description": "3-month mortality ~2%"},
    {"value_min": 10, "value_max": 19, "label": "Moderate", "description": "3-month mortality ~6%"},
    {"value_min": 20, "value_max": 29, "label": "High", "description": "3-month mortality ~20%"},
    {"value_min": 30, "value_max": 40, "label": "Very High", "description": "3-month mortality >50%"}
  ]'::jsonb,
  'OPTN/UNOS Policy for Liver Allocation',
  2016,
  '10.1002/hep.28150',
  '26600221',
  'active',
  true
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  input_variables = EXCLUDED.input_variables,
  output_definition = EXCLUDED.output_definition,
  interpretation = EXCLUDED.interpretation;

-- MELD Rule Spec
INSERT INTO rule_specs (
  id, system_card_id, rule_type, rule_definition, test_cases
) VALUES (
  'meld-rule-v1',
  'meld-score-2016',
  'formula',
  '{
    "formula": "round(10 * (0.957 * log(max(creatinine_adj, 1)) + 0.378 * log(max(bilirubin, 1)) + 1.120 * log(max(inr, 1)) + 0.643))",
    "preprocessing": {
      "creatinine_adj": "on_dialysis ? 4.0 : min(max(creatinine, 1.0), 4.0)"
    },
    "postprocessing": "min(max(result, 6), 40)",
    "variables": ["creatinine", "bilirubin", "inr", "on_dialysis"],
    "description": "MELD = 10 × [0.957 × ln(Cr) + 0.378 × ln(Bili) + 1.120 × ln(INR) + 0.643]. Creatinine capped at 4.0 (set to 4.0 if on dialysis)."
  }'::jsonb,
  '[
    {"inputs": {"creatinine": 1.0, "bilirubin": 1.0, "inr": 1.0, "on_dialysis": false}, "expected_output": 6, "description": "Normal values"},
    {"inputs": {"creatinine": 2.0, "bilirubin": 3.0, "inr": 1.5, "on_dialysis": false}, "expected_output": 16, "description": "Moderate liver disease"},
    {"inputs": {"creatinine": 4.0, "bilirubin": 10.0, "inr": 2.5, "on_dialysis": true}, "expected_output": 33, "description": "Severe liver disease on dialysis"}
  ]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  rule_definition = EXCLUDED.rule_definition,
  test_cases = EXCLUDED.test_cases;

-- =============================================================================
-- 3. CURB-65 Score (Community-Acquired Pneumonia Severity)
-- =============================================================================

INSERT INTO system_cards (
  id, name, display_name, description, system_type, specialty, intended_use,
  input_variables, output_definition, interpretation,
  source_guideline, source_year, doi, pmid, status, is_verified
) VALUES (
  'curb65-2003',
  'CURB-65',
  'CURB-65 Pneumonia Severity Score',
  'Assesses severity of community-acquired pneumonia and guides disposition decisions (outpatient vs inpatient vs ICU).',
  'score',
  'pulmonology',
  'risk_stratification',
  '[
    {"name": "confusion", "type": "boolean", "description": "New-onset confusion (AMT ≤8 or new disorientation)", "required": true},
    {"name": "urea", "type": "number", "description": "Blood urea nitrogen", "required": true, "unit": "mg/dL"},
    {"name": "respiratory_rate", "type": "number", "description": "Respiratory rate", "required": true, "unit": "breaths/min"},
    {"name": "blood_pressure_systolic", "type": "number", "description": "Systolic blood pressure", "required": true, "unit": "mmHg"},
    {"name": "blood_pressure_diastolic", "type": "number", "description": "Diastolic blood pressure", "required": true, "unit": "mmHg"},
    {"name": "age", "type": "number", "description": "Patient age", "required": true, "unit": "years"}
  ]'::jsonb,
  '{"type": "integer", "range": {"min": 0, "max": 5}, "unit": "points", "description": "CURB-65 score"}'::jsonb,
  '[
    {"value_min": 0, "value_max": 1, "label": "Low Risk", "description": "30-day mortality <3%. Consider outpatient treatment."},
    {"value_min": 2, "value_max": 2, "label": "Moderate Risk", "description": "30-day mortality ~9%. Consider short inpatient stay or hospital-supervised outpatient."},
    {"value_min": 3, "value_max": 5, "label": "High Risk", "description": "30-day mortality 15-40%. Hospitalize, consider ICU for score ≥4."}
  ]'::jsonb,
  'BTS Guidelines for Management of Community Acquired Pneumonia',
  2003,
  '10.1136/thorax.58.5.377',
  '12728155',
  'active',
  true
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  input_variables = EXCLUDED.input_variables,
  output_definition = EXCLUDED.output_definition,
  interpretation = EXCLUDED.interpretation;

-- CURB-65 Rule Spec
INSERT INTO rule_specs (
  id, system_card_id, rule_type, rule_definition, test_cases
) VALUES (
  'curb65-rule-v1',
  'curb65-2003',
  'formula',
  '{
    "formula": "(confusion ? 1 : 0) + (urea > 19 ? 1 : 0) + (respiratory_rate >= 30 ? 1 : 0) + ((blood_pressure_systolic < 90 || blood_pressure_diastolic <= 60) ? 1 : 0) + (age >= 65 ? 1 : 0)",
    "variables": ["confusion", "urea", "respiratory_rate", "blood_pressure_systolic", "blood_pressure_diastolic", "age"],
    "description": "One point each for: Confusion, Urea >19 mg/dL, Respiratory rate ≥30, BP systolic <90 or diastolic ≤60, Age ≥65"
  }'::jsonb,
  '[
    {"inputs": {"confusion": false, "urea": 15, "respiratory_rate": 18, "blood_pressure_systolic": 120, "blood_pressure_diastolic": 80, "age": 45}, "expected_output": 0, "description": "Low-risk patient"},
    {"inputs": {"confusion": true, "urea": 25, "respiratory_rate": 32, "blood_pressure_systolic": 85, "blood_pressure_diastolic": 55, "age": 70}, "expected_output": 5, "description": "High-risk patient"}
  ]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  rule_definition = EXCLUDED.rule_definition,
  test_cases = EXCLUDED.test_cases;

-- =============================================================================
-- 4. Child-Pugh Score (Liver Cirrhosis Severity)
-- =============================================================================

INSERT INTO system_cards (
  id, name, display_name, description, system_type, specialty, intended_use,
  input_variables, output_definition, interpretation,
  source_guideline, source_year, status, is_verified
) VALUES (
  'child-pugh-1973',
  'Child-Pugh',
  'Child-Pugh Classification',
  'Classifies severity of cirrhosis. Used to assess prognosis and guide treatment decisions including surgical risk.',
  'staging',
  'hepatology',
  'prognosis',
  '[
    {"name": "bilirubin", "type": "number", "description": "Total bilirubin", "required": true, "unit": "mg/dL"},
    {"name": "albumin", "type": "number", "description": "Serum albumin", "required": true, "unit": "g/dL"},
    {"name": "inr", "type": "number", "description": "INR (or PT prolongation)", "required": true},
    {"name": "ascites", "type": "categorical", "description": "Ascites severity", "required": true, "allowedValues": ["none", "mild", "moderate_severe"]},
    {"name": "encephalopathy", "type": "categorical", "description": "Hepatic encephalopathy grade", "required": true, "allowedValues": ["none", "grade_1_2", "grade_3_4"]}
  ]'::jsonb,
  '{"type": "categorical", "categories": ["A", "B", "C"], "description": "Child-Pugh class"}'::jsonb,
  '[
    {"value_min": 5, "value_max": 6, "label": "Class A", "description": "Well-compensated disease. 1-year survival ~100%, 2-year ~85%."},
    {"value_min": 7, "value_max": 9, "label": "Class B", "description": "Significant functional compromise. 1-year survival ~80%, 2-year ~60%."},
    {"value_min": 10, "value_max": 15, "label": "Class C", "description": "Decompensated disease. 1-year survival ~45%, 2-year ~35%."}
  ]'::jsonb,
  'Modified Child-Pugh Classification',
  1973,
  'active',
  true
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  input_variables = EXCLUDED.input_variables,
  output_definition = EXCLUDED.output_definition,
  interpretation = EXCLUDED.interpretation;

-- Child-Pugh Rule Spec
INSERT INTO rule_specs (
  id, system_card_id, rule_type, rule_definition, test_cases
) VALUES (
  'child-pugh-rule-v1',
  'child-pugh-1973',
  'lookup_table',
  '{
    "tables": {
      "bilirubin_score": {"<2": 1, "2-3": 2, ">3": 3},
      "albumin_score": {">3.5": 1, "2.8-3.5": 2, "<2.8": 3},
      "inr_score": {"<1.7": 1, "1.7-2.3": 2, ">2.3": 3},
      "ascites_score": {"none": 1, "mild": 2, "moderate_severe": 3},
      "encephalopathy_score": {"none": 1, "grade_1_2": 2, "grade_3_4": 3}
    },
    "scoring_logic": "sum(bilirubin_score, albumin_score, inr_score, ascites_score, encephalopathy_score)",
    "classification": {"5-6": "A", "7-9": "B", "10-15": "C"},
    "description": "Sum points for each parameter, then classify based on total score"
  }'::jsonb,
  '[
    {"inputs": {"bilirubin": 1.5, "albumin": 4.0, "inr": 1.2, "ascites": "none", "encephalopathy": "none"}, "expected_output": "A", "description": "Well-compensated cirrhosis"},
    {"inputs": {"bilirubin": 2.5, "albumin": 3.0, "inr": 2.0, "ascites": "mild", "encephalopathy": "grade_1_2"}, "expected_output": "B", "description": "Moderate cirrhosis"},
    {"inputs": {"bilirubin": 5.0, "albumin": 2.5, "inr": 2.8, "ascites": "moderate_severe", "encephalopathy": "grade_3_4"}, "expected_output": "C", "description": "Severe cirrhosis"}
  ]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  rule_definition = EXCLUDED.rule_definition,
  test_cases = EXCLUDED.test_cases;

-- =============================================================================
-- 5. Wells Score for DVT
-- =============================================================================

INSERT INTO system_cards (
  id, name, display_name, description, system_type, specialty, intended_use,
  input_variables, output_definition, interpretation,
  source_guideline, source_year, doi, pmid, status, is_verified
) VALUES (
  'wells-dvt-2003',
  'Wells-DVT',
  'Wells Score for Deep Vein Thrombosis',
  'Clinical prediction rule for estimating pretest probability of deep vein thrombosis (DVT).',
  'score',
  'hematology',
  'diagnosis',
  '[
    {"name": "active_cancer", "type": "boolean", "description": "Active cancer (treatment within 6mo or palliative)", "required": true},
    {"name": "paralysis_paresis_immobilization", "type": "boolean", "description": "Paralysis, paresis, or recent plaster immobilization of lower extremity", "required": true},
    {"name": "bedridden", "type": "boolean", "description": "Bedridden >3 days or major surgery within 12 weeks", "required": true},
    {"name": "tenderness", "type": "boolean", "description": "Localized tenderness along deep venous system", "required": true},
    {"name": "entire_leg_swollen", "type": "boolean", "description": "Entire leg swollen", "required": true},
    {"name": "calf_swelling", "type": "boolean", "description": "Calf swelling >3cm compared to asymptomatic leg", "required": true},
    {"name": "pitting_edema", "type": "boolean", "description": "Pitting edema (greater in symptomatic leg)", "required": true},
    {"name": "collateral_veins", "type": "boolean", "description": "Collateral superficial veins (non-varicose)", "required": true},
    {"name": "previous_dvt", "type": "boolean", "description": "Previously documented DVT", "required": true},
    {"name": "alternative_diagnosis", "type": "boolean", "description": "Alternative diagnosis at least as likely as DVT", "required": true}
  ]'::jsonb,
  '{"type": "number", "range": {"min": -2, "max": 9}, "unit": "points", "description": "Wells DVT score"}'::jsonb,
  '[
    {"value_min": -2, "value_max": 0, "label": "Low Probability", "description": "DVT probability ~5%. Consider D-dimer; if negative, DVT ruled out."},
    {"value_min": 1, "value_max": 2, "label": "Moderate Probability", "description": "DVT probability ~17%. D-dimer + ultrasound recommended."},
    {"value_min": 3, "value_max": 9, "label": "High Probability", "description": "DVT probability ~53%. Ultrasound recommended; treat presumptively if high suspicion."}
  ]'::jsonb,
  'Wells et al. Value of Assessment of Pretest Probability of DVT',
  2003,
  '10.1016/S0140-6736(97)08140-3',
  '9486574',
  'active',
  true
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  input_variables = EXCLUDED.input_variables,
  output_definition = EXCLUDED.output_definition,
  interpretation = EXCLUDED.interpretation;

-- Wells DVT Rule Spec
INSERT INTO rule_specs (
  id, system_card_id, rule_type, rule_definition, test_cases
) VALUES (
  'wells-dvt-rule-v1',
  'wells-dvt-2003',
  'formula',
  '{
    "formula": "(active_cancer ? 1 : 0) + (paralysis_paresis_immobilization ? 1 : 0) + (bedridden ? 1 : 0) + (tenderness ? 1 : 0) + (entire_leg_swollen ? 1 : 0) + (calf_swelling ? 1 : 0) + (pitting_edema ? 1 : 0) + (collateral_veins ? 1 : 0) + (previous_dvt ? 1 : 0) + (alternative_diagnosis ? -2 : 0)",
    "variables": ["active_cancer", "paralysis_paresis_immobilization", "bedridden", "tenderness", "entire_leg_swollen", "calf_swelling", "pitting_edema", "collateral_veins", "previous_dvt", "alternative_diagnosis"],
    "description": "+1 each for positive criteria, -2 for alternative diagnosis equally likely"
  }'::jsonb,
  '[
    {"inputs": {"active_cancer": false, "paralysis_paresis_immobilization": false, "bedridden": false, "tenderness": false, "entire_leg_swollen": false, "calf_swelling": false, "pitting_edema": false, "collateral_veins": false, "previous_dvt": false, "alternative_diagnosis": true}, "expected_output": -2, "description": "Alternative diagnosis more likely"},
    {"inputs": {"active_cancer": true, "paralysis_paresis_immobilization": false, "bedridden": true, "tenderness": true, "entire_leg_swollen": false, "calf_swelling": true, "pitting_edema": true, "collateral_veins": false, "previous_dvt": true, "alternative_diagnosis": false}, "expected_output": 6, "description": "High probability DVT"}
  ]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  rule_definition = EXCLUDED.rule_definition,
  test_cases = EXCLUDED.test_cases;

-- =============================================================================
-- 6. APACHE II Score (ICU Severity)
-- =============================================================================

INSERT INTO system_cards (
  id, name, display_name, description, system_type, specialty, intended_use,
  input_variables, output_definition, interpretation,
  source_guideline, source_year, doi, pmid, status, is_verified
) VALUES (
  'apache2-1985',
  'APACHE-II',
  'Acute Physiology and Chronic Health Evaluation II',
  'Severity-of-disease classification system for ICU patients. Higher scores indicate more severe disease and higher mortality risk.',
  'score',
  'critical_care',
  'prognosis',
  '[
    {"name": "temperature", "type": "number", "description": "Core temperature", "required": true, "unit": "°C"},
    {"name": "mean_arterial_pressure", "type": "number", "description": "Mean arterial pressure", "required": true, "unit": "mmHg"},
    {"name": "heart_rate", "type": "number", "description": "Heart rate", "required": true, "unit": "bpm"},
    {"name": "respiratory_rate", "type": "number", "description": "Respiratory rate", "required": true, "unit": "breaths/min"},
    {"name": "fio2", "type": "number", "description": "FiO2 (fraction of inspired oxygen)", "required": true},
    {"name": "pao2", "type": "number", "description": "PaO2 (arterial oxygen)", "required": false, "unit": "mmHg"},
    {"name": "aa_gradient", "type": "number", "description": "A-a gradient (if FiO2 ≥0.5)", "required": false, "unit": "mmHg"},
    {"name": "arterial_ph", "type": "number", "description": "Arterial pH", "required": true},
    {"name": "sodium", "type": "number", "description": "Serum sodium", "required": true, "unit": "mEq/L"},
    {"name": "potassium", "type": "number", "description": "Serum potassium", "required": true, "unit": "mEq/L"},
    {"name": "creatinine", "type": "number", "description": "Serum creatinine", "required": true, "unit": "mg/dL"},
    {"name": "acute_renal_failure", "type": "boolean", "description": "Acute renal failure", "required": true},
    {"name": "hematocrit", "type": "number", "description": "Hematocrit", "required": true, "unit": "%"},
    {"name": "wbc", "type": "number", "description": "White blood cell count", "required": true, "unit": "×10³/μL"},
    {"name": "gcs", "type": "number", "description": "Glasgow Coma Scale", "required": true},
    {"name": "age", "type": "number", "description": "Patient age", "required": true, "unit": "years"},
    {"name": "chronic_health", "type": "categorical", "description": "Chronic health status", "required": true, "allowedValues": ["none", "nonoperative", "emergency_postoperative", "elective_postoperative"]}
  ]'::jsonb,
  '{"type": "integer", "range": {"min": 0, "max": 71}, "unit": "points", "description": "APACHE II score"}'::jsonb,
  '[
    {"value_min": 0, "value_max": 9, "label": "Low", "description": "Predicted mortality ~8%"},
    {"value_min": 10, "value_max": 19, "label": "Moderate", "description": "Predicted mortality ~15%"},
    {"value_min": 20, "value_max": 29, "label": "High", "description": "Predicted mortality ~35%"},
    {"value_min": 30, "value_max": 71, "label": "Very High", "description": "Predicted mortality >50%"}
  ]'::jsonb,
  'APACHE II: A severity of disease classification system',
  1985,
  '10.1097/00003246-198510000-00009',
  '3928249',
  'active',
  true
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  input_variables = EXCLUDED.input_variables,
  output_definition = EXCLUDED.output_definition,
  interpretation = EXCLUDED.interpretation;

-- =============================================================================
-- 7. TNM Staging (Generic Template - Breast Cancer Example)
-- =============================================================================

INSERT INTO system_cards (
  id, name, display_name, description, system_type, specialty, intended_use,
  input_variables, output_definition, interpretation,
  source_guideline, source_year, status, is_verified
) VALUES (
  'tnm-breast-8th',
  'TNM-Breast-8th',
  'TNM Staging for Breast Cancer (8th Edition)',
  'AJCC 8th Edition TNM staging for breast cancer. Incorporates anatomic and prognostic staging.',
  'staging',
  'oncology',
  'staging',
  '[
    {"name": "tumor_size", "type": "categorical", "description": "Primary tumor (T)", "required": true, "allowedValues": ["Tis", "T1mi", "T1a", "T1b", "T1c", "T2", "T3", "T4a", "T4b", "T4c", "T4d"]},
    {"name": "nodes", "type": "categorical", "description": "Regional lymph nodes (N)", "required": true, "allowedValues": ["N0", "N1mi", "N1", "N2a", "N2b", "N3a", "N3b", "N3c"]},
    {"name": "metastasis", "type": "categorical", "description": "Distant metastasis (M)", "required": true, "allowedValues": ["M0", "M1"]},
    {"name": "grade", "type": "categorical", "description": "Histologic grade", "required": false, "allowedValues": ["G1", "G2", "G3"]},
    {"name": "er_status", "type": "categorical", "description": "Estrogen receptor status", "required": false, "allowedValues": ["positive", "negative"]},
    {"name": "pr_status", "type": "categorical", "description": "Progesterone receptor status", "required": false, "allowedValues": ["positive", "negative"]},
    {"name": "her2_status", "type": "categorical", "description": "HER2 status", "required": false, "allowedValues": ["positive", "negative"]}
  ]'::jsonb,
  '{"type": "categorical", "categories": ["0", "IA", "IB", "IIA", "IIB", "IIIA", "IIIB", "IIIC", "IV"], "description": "AJCC Stage"}'::jsonb,
  '[
    {"value_min": 0, "value_max": 0, "label": "Stage 0", "description": "Carcinoma in situ (DCIS)"},
    {"value_min": 1, "value_max": 1, "label": "Stage I", "description": "Small tumor, no lymph node involvement"},
    {"value_min": 2, "value_max": 2, "label": "Stage II", "description": "Larger tumor or limited lymph node involvement"},
    {"value_min": 3, "value_max": 3, "label": "Stage III", "description": "Locally advanced disease"},
    {"value_min": 4, "value_max": 4, "label": "Stage IV", "description": "Metastatic disease"}
  ]'::jsonb,
  'AJCC Cancer Staging Manual, 8th Edition',
  2017,
  'active',
  true
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  input_variables = EXCLUDED.input_variables,
  output_definition = EXCLUDED.output_definition,
  interpretation = EXCLUDED.interpretation;

-- TNM Breast Cancer Rule Spec
INSERT INTO rule_specs (
  id, system_card_id, rule_type, rule_definition, test_cases
) VALUES (
  'tnm-breast-rule-v1',
  'tnm-breast-8th',
  'decision_tree',
  '{
    "tree": {
      "condition": "metastasis == \"M1\"",
      "true_branch": {"result": "IV"},
      "false_branch": {
        "condition": "tumor_size == \"Tis\" && nodes == \"N0\"",
        "true_branch": {"result": "0"},
        "false_branch": {
          "condition": "nodes in [\"N3a\", \"N3b\", \"N3c\"]",
          "true_branch": {"result": "IIIC"},
          "false_branch": {
            "condition": "tumor_size in [\"T4a\", \"T4b\", \"T4c\", \"T4d\"]",
            "true_branch": {"result": "IIIB"},
            "false_branch": {
              "condition": "nodes in [\"N2a\", \"N2b\"]",
              "true_branch": {"result": "IIIA"},
              "false_branch": {
                "condition": "tumor_size == \"T3\" && nodes == \"N0\"",
                "true_branch": {"result": "IIB"},
                "false_branch": {
                  "condition": "(tumor_size == \"T2\" && nodes == \"N1\") || (tumor_size == \"T3\" && nodes == \"N0\")",
                  "true_branch": {"result": "IIB"},
                  "false_branch": {
                    "condition": "(tumor_size == \"T2\" && nodes == \"N0\") || (tumor_size in [\"T1mi\", \"T1a\", \"T1b\", \"T1c\"] && nodes == \"N1\")",
                    "true_branch": {"result": "IIA"},
                    "false_branch": {
                      "condition": "tumor_size in [\"T1mi\", \"T1a\", \"T1b\", \"T1c\"] && nodes == \"N1mi\"",
                      "true_branch": {"result": "IB"},
                      "false_branch": {
                        "condition": "tumor_size in [\"T1mi\", \"T1a\", \"T1b\", \"T1c\"] && nodes == \"N0\"",
                        "true_branch": {"result": "IA"},
                        "false_branch": {"result": "Unknown"}
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "description": "AJCC 8th Edition anatomic staging decision tree for breast cancer"
  }'::jsonb,
  '[
    {"inputs": {"tumor_size": "Tis", "nodes": "N0", "metastasis": "M0"}, "expected_output": "0", "description": "DCIS"},
    {"inputs": {"tumor_size": "T1c", "nodes": "N0", "metastasis": "M0"}, "expected_output": "IA", "description": "Early stage"},
    {"inputs": {"tumor_size": "T2", "nodes": "N1", "metastasis": "M0"}, "expected_output": "IIB", "description": "Stage IIB"},
    {"inputs": {"tumor_size": "T2", "nodes": "N0", "metastasis": "M1"}, "expected_output": "IV", "description": "Metastatic"}
  ]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  rule_definition = EXCLUDED.rule_definition,
  test_cases = EXCLUDED.test_cases;

-- =============================================================================
-- Summary: 7 Clinical Scoring Systems Seeded
-- =============================================================================
-- 1. CHA2DS2-VASc (Cardiology - Stroke risk in AFib)
-- 2. MELD (Hepatology - Liver disease prognosis)
-- 3. CURB-65 (Pulmonology - Pneumonia severity)
-- 4. Child-Pugh (Hepatology - Cirrhosis staging)
-- 5. Wells DVT (Hematology - DVT probability)
-- 6. APACHE II (Critical Care - ICU mortality)
-- 7. TNM Breast Cancer (Oncology - Cancer staging)
-- =============================================================================
