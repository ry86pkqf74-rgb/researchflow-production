# JSONSchema Contracts

## Purpose

These JSON Schemas define machine-readable contracts for run manifests and QA metrics artifacts produced by validation pipelines and automation workflows.

## Relationship to Pandera Schemas

- **Pandera schemas** (in `src/validation/`) validate data table structure and content (DataFrames)
- **JSON Schemas** (here) validate artifact metadata and run outputs (JSON files)

Both are complementary: Pandera ensures data quality; JSONSchema ensures artifact conformance.

## Artifact Locations

- **Run manifests:** `reports/run_manifests/`
- **QA metrics:** `reports/qa/`

## Validation Points

Artifacts are validated against these schemas during:
- GitHub Actions CI runs (`.github/workflows/qa.yml`)
- n8n nightly automation (`docs/n8n/WORKFLOWS/WF_NIGHTLY_QA.json`)

See `docs/validation/QA_ARTIFACT_CONTRACT.md` for output requirements.
