# Pandera Schemas

## Purpose

These Pandera schemas define Tier-1 data contracts for tabular data in staging and conform tables. They specify structure, types, constraints, and validation rules for DataFrames at each stage of the data pipeline.

## Relationship to JSONSchema Contracts

- **Pandera schemas** (here) validate data table structure and content (DataFrames)
- **JSON Schemas** (`schemas/jsonschema/`) validate artifact metadata and run outputs (JSON files)

Both are complementary: Pandera ensures data quality and conformance; JSONSchema ensures artifact contract compliance.

## Usage

Pandera schemas are executed in:
- Local QA runners (`automations/run_minimal_schema_checks.py`)
- CI validation pipelines (`.github/workflows/qa.yml`)
- n8n automation workflows (future implementation)

## Design Principles

Schemas are project-agnostic templates. Real projects adapt these based on:
- Extraction specifications (`docs/planning/extraction_spec/`)
- Conform rules (`src/conform/`)
- Institutional data dictionaries and governance policies

## Available Schemas

### Core Entity Schemas
- **patients_schema.py**: Generic patient demographics schema (patient_id, sex, dob)
- **events_schema.py**: Generic event-based research schema (event_id, patient_id, event_date, event_type)

### Dataset-Specific Schemas
- **heart_disease_schema.py**: UCI Heart Disease dataset structure (age, sex, clinical measurements, target)
  - Used with: `data/sample/heart_disease_sample.csv`
  - Validates 14 columns with appropriate types and bounds
  - Suitable for cardiovascular research datasets
