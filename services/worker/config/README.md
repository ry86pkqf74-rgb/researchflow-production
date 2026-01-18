# Configuration Layout

This document describes where configuration lives in the repository and how it is typically consumed.

---

## Configuration Locations Overview

The repository has **four primary configuration locations**:

1. **`config/`** — Project configuration and registries
2. **`.streamlit/`** — Streamlit application configuration  
3. **Root-level config files** — Tooling and environment configuration
4. **`schemas/`** (root) vs **`src/schemas/`** — Data contracts at different scopes

---

## 1. `config/` Directory

`config/` contains **project configuration and registries** used by offline workflows and tooling.

**Examples:**
- **Operating mode configuration:**
  - `config/standby.yaml`, `config/phase1.yaml` — Phase and operating-mode settings
  - `config/sourcelit.yaml` — Sourcelit configuration
  
- **Ingestion and workflow configuration:**
  - `config/source_mappings.yaml` — Source-to-target field mappings
  - `config/patient_signals_ingestion.yaml` — Patient signal ingestion workflow configuration
  
- **Structured registries** (consumed by code and validations):
  - `config/reference_intervals/` — Reference interval registry (62 synthetic tests)
  - `config/linkers/` — Cross-modal linker rules (configurable windows, precedence)
  - `config/integration_rules/` — Data integration rules
  - `config/tools/` — Tool registry
  - `config/units/` — Unit conversion and standardization

**JSON schemas:**
- `config/integration_history_record.schema.json` — Integration metadata schema

**Usage:** Consumed by Python modules under `src/`, automation scripts under `automations/`, and Make targets.

---

## 2. `.streamlit/` Directory

`.streamlit/` contains **Streamlit application configuration** (Streamlit settings and runtime UI options).

**Purpose:** Used by the Streamlit frontend under `web_frontend/` to configure:
- Theme settings
- Server configuration
- Browser settings
- Performance options

**Usage:** Automatically loaded by Streamlit when running `streamlit run` commands.

---

## 3. Root-Level Config Files

The repository root contains **tooling and environment configuration** for development, testing, and deployment.

**Examples:**

- **Python environment:**
  - `pyproject.toml` — Python project metadata, dependencies, and tool configuration
  - `requirements.txt` — Python package dependencies
  - `.python-version` — Python version specification

- **Build and task automation:**
  - `Makefile`, `Makefile.platform` — Task entry points that wrap scripts and validations

- **Containerization:**
  - `docker-compose.standby.yml` — Docker composition for STANDBY mode
  - `docker/` — Dockerfile and container configuration

- **Environment and secrets:**
  - `.env.example` — Documented environment variable defaults (**never commit real secrets**)

- **Deployment configuration:**
  - `vercel.json` — Vercel deployment configuration (when applicable)
  - `Procfile` — Process configuration for deployment platforms

- **Editor and VCS:**
  - `.editorconfig` — Editor formatting rules
  - `.gitignore` — Git ignore patterns
  - `.dockerignore` — Docker ignore patterns

**Usage:** Consumed by development tools, CI/CD pipelines, and deployment platforms.

---

## 4. Schemas: `schemas/` (Root) vs `src/schemas/`

This repository contains **two schema locations** with different intent and scope:

### `schemas/` (Root Directory)

**Purpose:** **Dataset- and project-level contracts.**

This is the home for schema assets that describe:
- Research datasets
- Export bundles
- Study-level data contracts
- Relatively stable, governance-referenced contracts

**Examples:**
- `schemas/export_bundle_v1.json` — Export bundle format schema
- `schemas/template_spec_v1.json` — Template specification schema
- `schemas/schema_version_metadata.yaml` — Schema versioning metadata
- `schemas/pandera/` — Pandera DataFrameSchema definitions for research datasets
- `schemas/sql/` — SQL schema definitions

**Referenced by:** Governance docs, external tooling, validation scripts, and cross-module contracts.

### `src/schemas/` (Source Tree)

**Purpose:** **Code-adjacent runtime contracts.**

This tree contains schemas tightly coupled to specific modules under `src/`:
- Internal helper schemas for specific features
- Module-specific validation contracts
- Runtime-only schemas

**Examples:**
- `src/schemas/pandera/` — Module-specific Pandera schemas
- `src/schemas/jsonschema/` — Module-specific JSON schemas

**Referenced by:** Specific modules under `src/` using relative imports (e.g., `from src.schemas.pandera import ...`).

### Authoring Guidance

**When adding a new schema, choose the location based on scope:**

| Use `schemas/` (root) when: | Use `src/schemas/` when: |
|------------------------------|--------------------------|
| Schema describes a research dataset | Schema is internal to a module |
| Schema is referenced by governance docs | Schema is a runtime helper |
| Schema is used by external tooling | Schema is tightly coupled to one feature |
| Schema is a study-level contract | Schema changes frequently with module |

**When in doubt:**
- Follow the explicit path referenced by the script/Make target you are working on
- Check import style: `from schemas.*` vs `from src.schemas.*`
- Ask: "Will governance docs or external tools reference this schema?" If yes, use `schemas/` (root)

### Future Consolidation

Over time, a **post-checkpoint refactor** may consolidate or more strictly separate these locations. Until then, follow the explicit path referenced by the script/Make target or module you are working on.

---

## Precedence and Selection

Configuration selection is generally **explicit**:
- CLIs, scripts, and Make targets typically pass a config path (or use a documented default under `config/`)
- Environment variables may gate behavior (for example, offline/safety flags like `NO_NETWORK=1`, `MOCK_ONLY=1`)
- Environment variables are documented where used (see `.env.example` for common variables)

**No automatic precedence hierarchy** — configuration is explicitly loaded by scripts and modules.

---

## See Also

- [docs/system/FILE_PLACEMENT_RULES.md](../docs/system/FILE_PLACEMENT_RULES.md) — Where files belong in the repository
- [docs/governance/REPO_LAYOUT_CONVENTIONS.md](../docs/governance/REPO_LAYOUT_CONVENTIONS.md) — Directory naming conventions
- [automations/validate_file_placement.py](../automations/validate_file_placement.py) — File placement validation script

---

**Last Updated:** 2026-01-09
