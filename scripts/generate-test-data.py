#!/usr/bin/env python3
"""
Generate Test Data for ResearchFlow Statistical Analysis
=========================================================
Creates realistic clinical trial datasets for testing:
- test-clinical.csv: General clinical data with demographics, vitals, outcomes
- test-survival.csv: Survival analysis data with time-to-event
- test-treatment.csv: Treatment comparison data for inferential tests
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# Ensure reproducibility
np.random.seed(42)

# Output directory
DATA_DIR = os.environ.get('DATA_DIR', '/data')
os.makedirs(DATA_DIR, exist_ok=True)


def generate_clinical_data(n=500):
    """Generate general clinical trial dataset."""

    # Demographics
    ages = np.random.normal(55, 15, n).clip(18, 90).astype(int)
    genders = np.random.choice(['Male', 'Female'], n, p=[0.52, 0.48])
    races = np.random.choice(
        ['White', 'Black', 'Asian', 'Hispanic', 'Other'],
        n, p=[0.60, 0.15, 0.12, 0.10, 0.03]
    )

    # Treatment groups
    treatment_groups = np.random.choice(['Treatment', 'Control'], n, p=[0.5, 0.5])

    # Baseline measurements
    bmi = np.random.normal(28, 5, n).clip(16, 50).round(1)
    systolic_bp = np.random.normal(130, 15, n).clip(90, 200).astype(int)
    diastolic_bp = np.random.normal(82, 10, n).clip(60, 120).astype(int)
    heart_rate = np.random.normal(72, 12, n).clip(50, 120).astype(int)

    # Lab values
    cholesterol = np.random.normal(200, 40, n).clip(100, 400).round(1)
    hdl = np.random.normal(50, 15, n).clip(20, 100).round(1)
    ldl = np.random.normal(120, 35, n).clip(50, 250).round(1)
    triglycerides = np.random.normal(150, 80, n).clip(50, 500).round(1)
    glucose = np.random.normal(100, 25, n).clip(60, 300).round(1)
    hba1c = np.random.normal(5.8, 1.2, n).clip(4.0, 14.0).round(1)
    creatinine = np.random.normal(1.0, 0.3, n).clip(0.4, 4.0).round(2)

    # Treatment effect on outcomes (treatment group has better outcomes)
    treatment_effect = np.where(treatment_groups == 'Treatment', 1, 0)

    # Primary outcome (continuous - e.g., change in biomarker)
    outcome_score = (
        np.random.normal(50, 10, n) +
        treatment_effect * np.random.normal(8, 3, n)  # Treatment effect
    ).round(1)

    # Secondary outcomes
    response_rate = np.random.random(n)
    responder = (response_rate + treatment_effect * 0.15 > 0.55).astype(int)

    # Adverse events
    adverse_event = np.random.choice([0, 1], n, p=[0.85, 0.15])
    severity = np.where(
        adverse_event == 1,
        np.random.choice(['Mild', 'Moderate', 'Severe'], n, p=[0.6, 0.3, 0.1]),
        None
    )

    # Quality of life (0-100 scale)
    qol_baseline = np.random.normal(60, 15, n).clip(0, 100).round(1)
    qol_final = (
        qol_baseline +
        np.random.normal(5, 8, n) +
        treatment_effect * np.random.normal(10, 4, n)
    ).clip(0, 100).round(1)
    qol_change = (qol_final - qol_baseline).round(1)

    # Disease stage
    disease_stage = np.random.choice(['Stage I', 'Stage II', 'Stage III', 'Stage IV'], n, p=[0.25, 0.35, 0.25, 0.15])

    # Smoking status
    smoking_status = np.random.choice(['Never', 'Former', 'Current'], n, p=[0.45, 0.35, 0.20])

    df = pd.DataFrame({
        'patient_id': [f'PT{str(i+1).zfill(4)}' for i in range(n)],
        'age': ages,
        'gender': genders,
        'race': races,
        'treatment_group': treatment_groups,
        'bmi': bmi,
        'systolic_bp': systolic_bp,
        'diastolic_bp': diastolic_bp,
        'heart_rate': heart_rate,
        'cholesterol': cholesterol,
        'hdl': hdl,
        'ldl': ldl,
        'triglycerides': triglycerides,
        'glucose': glucose,
        'hba1c': hba1c,
        'creatinine': creatinine,
        'disease_stage': disease_stage,
        'smoking_status': smoking_status,
        'outcome_score': outcome_score,
        'responder': responder,
        'adverse_event': adverse_event,
        'ae_severity': severity,
        'qol_baseline': qol_baseline,
        'qol_final': qol_final,
        'qol_change': qol_change,
    })

    return df


def generate_survival_data(n=400):
    """Generate survival analysis dataset."""

    # Patient demographics
    ages = np.random.normal(60, 12, n).clip(30, 85).astype(int)
    genders = np.random.choice(['Male', 'Female'], n, p=[0.55, 0.45])

    # Treatment groups
    treatment_groups = np.random.choice(['Drug A', 'Drug B', 'Placebo'], n, p=[0.35, 0.35, 0.30])

    # Risk factors
    ecog_status = np.random.choice([0, 1, 2, 3], n, p=[0.30, 0.40, 0.20, 0.10])
    tumor_size = np.random.exponential(3, n).clip(0.5, 15).round(1)
    metastatic = np.random.choice([0, 1], n, p=[0.65, 0.35])
    prior_therapy = np.random.choice([0, 1, 2, 3], n, p=[0.20, 0.35, 0.30, 0.15])

    # Biomarkers
    marker_a = np.random.lognormal(2, 0.8, n).round(2)
    marker_b = np.random.normal(100, 30, n).clip(10, 250).round(1)

    # Generate survival times
    # Base hazard modified by treatment and risk factors
    base_time = np.random.exponential(24, n)  # months

    # Treatment effects (Drug A and B reduce hazard)
    treatment_modifier = np.where(
        treatment_groups == 'Drug A', 1.3,
        np.where(treatment_groups == 'Drug B', 1.2, 1.0)
    )

    # Risk factor effects
    risk_modifier = (
        1.0 -
        0.1 * ecog_status -
        0.05 * metastatic -
        0.02 * tumor_size
    ).clip(0.3, 1.0)

    survival_time = (base_time * treatment_modifier * risk_modifier).clip(0.5, 60).round(1)

    # Generate censoring
    max_followup = 48  # months
    censoring_time = np.random.uniform(12, max_followup, n)

    # Observed time is min of survival and censoring
    time = np.minimum(survival_time, censoring_time).round(1)
    event = (survival_time <= censoring_time).astype(int)

    # Enrollment dates
    base_date = datetime(2020, 1, 1)
    enrollment_dates = [
        base_date + timedelta(days=int(np.random.uniform(0, 365)))
        for _ in range(n)
    ]

    df = pd.DataFrame({
        'patient_id': [f'SV{str(i+1).zfill(4)}' for i in range(n)],
        'enrollment_date': enrollment_dates,
        'age': ages,
        'gender': genders,
        'treatment_group': treatment_groups,
        'ecog_status': ecog_status,
        'tumor_size_cm': tumor_size,
        'metastatic': metastatic,
        'prior_therapy_lines': prior_therapy,
        'marker_a': marker_a,
        'marker_b': marker_b,
        'time_months': time,
        'event': event,  # 1 = event occurred, 0 = censored
    })

    return df


def generate_treatment_comparison_data(n=300):
    """Generate data for treatment comparison (inferential tests)."""

    # Three treatment arms
    arms = ['Arm A', 'Arm B', 'Arm C']
    n_per_arm = n // 3

    data = []
    for arm in arms:
        # Each arm has slightly different distributions
        if arm == 'Arm A':
            values = np.random.normal(25, 5, n_per_arm)
            response_prob = 0.65
        elif arm == 'Arm B':
            values = np.random.normal(28, 6, n_per_arm)
            response_prob = 0.55
        else:
            values = np.random.normal(22, 5, n_per_arm)
            response_prob = 0.45

        for i, val in enumerate(values):
            data.append({
                'subject_id': f'{arm[4]}{str(i+1).zfill(3)}',
                'treatment_arm': arm,
                'primary_endpoint': round(val, 2),
                'binary_response': int(np.random.random() < response_prob),
                'pain_score_baseline': np.random.randint(3, 9),
                'pain_score_week4': max(0, np.random.randint(1, 7) - (1 if arm == 'Arm A' else 0)),
                'adverse_events_count': np.random.poisson(1.5),
                'days_on_treatment': np.random.randint(20, 90),
            })

    # Add paired data columns (same subjects, two timepoints)
    df = pd.DataFrame(data)
    df['measurement_t1'] = np.random.normal(100, 15, len(df)).round(1)
    df['measurement_t2'] = (df['measurement_t1'] + np.random.normal(5, 8, len(df))).round(1)

    # Categorical outcome
    df['outcome_category'] = np.random.choice(
        ['Complete', 'Partial', 'Stable', 'Progressive'],
        len(df), p=[0.20, 0.35, 0.30, 0.15]
    )

    return df


def main():
    print("Generating test datasets for ResearchFlow...")
    print(f"Output directory: {DATA_DIR}")

    # Generate and save datasets
    print("\n1. Generating clinical data (n=500)...")
    clinical_df = generate_clinical_data(500)
    clinical_path = os.path.join(DATA_DIR, 'test-clinical.csv')
    clinical_df.to_csv(clinical_path, index=False)
    print(f"   Saved: {clinical_path}")
    print(f"   Columns: {list(clinical_df.columns)}")

    print("\n2. Generating survival data (n=400)...")
    survival_df = generate_survival_data(400)
    survival_path = os.path.join(DATA_DIR, 'test-survival.csv')
    survival_df.to_csv(survival_path, index=False)
    print(f"   Saved: {survival_path}")
    print(f"   Columns: {list(survival_df.columns)}")

    print("\n3. Generating treatment comparison data (n=300)...")
    treatment_df = generate_treatment_comparison_data(300)
    treatment_path = os.path.join(DATA_DIR, 'test-treatment.csv')
    treatment_df.to_csv(treatment_path, index=False)
    print(f"   Saved: {treatment_path}")
    print(f"   Columns: {list(treatment_df.columns)}")

    # Summary statistics
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"\ntest-clinical.csv:")
    print(f"  Rows: {len(clinical_df)}")
    print(f"  Treatment groups: {clinical_df['treatment_group'].value_counts().to_dict()}")
    print(f"  Mean outcome (Treatment): {clinical_df[clinical_df['treatment_group']=='Treatment']['outcome_score'].mean():.2f}")
    print(f"  Mean outcome (Control): {clinical_df[clinical_df['treatment_group']=='Control']['outcome_score'].mean():.2f}")

    print(f"\ntest-survival.csv:")
    print(f"  Rows: {len(survival_df)}")
    print(f"  Events: {survival_df['event'].sum()} ({100*survival_df['event'].mean():.1f}%)")
    print(f"  Median time: {survival_df['time_months'].median():.1f} months")

    print(f"\ntest-treatment.csv:")
    print(f"  Rows: {len(treatment_df)}")
    print(f"  Arms: {treatment_df['treatment_arm'].value_counts().to_dict()}")

    print("\n" + "="*60)
    print("Test data generation complete!")
    print("="*60)


if __name__ == '__main__':
    main()
