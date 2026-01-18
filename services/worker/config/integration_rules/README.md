# Integration Rules Contract

**Purpose:** Define deterministic, reproducible rules for cross-modal event linkage without introducing new execution paths.

**Status:** SPECIFICATION ONLY — No automated execution permitted until governance review.

---

## Overview

Integration rules provide a governed contract for linking clinical events across modalities:

- **Imaging → Surgery:** Link pre-operative imaging studies to surgical procedures
- **Molecular → Pathology:** Link molecular assay results to pathology specimens

These rules are **additive specifications** that document the expected behavior of future linking implementations. They do not execute any data transformations.

---

## Determinism Guarantee

All linkage operations defined here produce **deterministic, reproducible results**. Given identical input data, the same linkages will always be produced.

### How Determinism Is Achieved

1. **Explicit Time Windows:** Each rule set defines exact day offsets (min/max) relative to a reference point.
2. **Ordered Tie-Breakers:** When multiple candidates match, tie-breakers are applied in strict sequential order until exactly one candidate remains.
3. **Declared Deduplication:** After tie-breaking, the deduplication strategy defines exactly which record to retain.
4. **No Randomness:** No random selection, sampling, or non-deterministic operations are permitted.

### Example: Imaging → Surgery Tie-Breaking

When multiple imaging studies could link to a surgery:

```
1. laterality_match     → Keep only exact laterality matches (discard bilateral if exact exists)
2. anatomic_site_match  → Keep only studies targeting the surgical site (e.g., neck level)
3. nearest_date         → Keep the imaging study closest in time to surgery

Result: Exactly one imaging study selected (or zero if no candidates)
```

---

## Tie-Breaker Reference

| Strategy | Description | Field Required |
|----------|-------------|----------------|
| `laterality_match` | Prefer exact laterality over bilateral/NA | No |
| `anatomic_site_match` | Prefer matching anatomic region | Yes (`field`) |
| `nearest_date` | Prefer closest date to reference | No |
| `exact_specimen_match` | Prefer exact specimen ID match | Yes (`field`) |
| `specimen_accession_match` | Prefer matching accession number | Yes (`field`) |
| `highest_value` | Prefer highest value (e.g., VAF) | Yes (`field`) |
| `lowest_value` | Prefer lowest value | Yes (`field`) |
| `most_recent` | Prefer most recent date | No |
| `earliest` | Prefer earliest date | No |

---

## Deduplication Strategies

After tie-breaking, if multiple records remain linked:

| Strategy | Behavior |
|----------|----------|
| `keep_first` | Keep highest-ranked candidate after tie-breaking |
| `keep_last` | Keep lowest-ranked candidate |
| `keep_highest_value` | Keep record with highest value in specified field |
| `keep_lowest_value` | Keep record with lowest value in specified field |
| `keep_all` | Retain all valid linkages (1:N relationship) |
| `merge` | Combine multiple records (requires merge logic) |

---

## Time Window Semantics

Time windows define valid date ranges for linkage candidates:

```yaml
time_windows:
  default:
    min_days: -90  # Source can be up to 90 days BEFORE target
    max_days: 30   # Source can be up to 30 days AFTER target
    reference_point: target_date
```

- **Negative values:** Source event occurs BEFORE the reference point
- **Positive values:** Source event occurs AFTER the reference point
- **reference_point:** Which date the offset is calculated from (`target_date` or `source_date`)

### Fallback Windows

If no candidates match within the default window, the fallback window is used:

```yaml
fallback:
  min_days: -180
  max_days: 30
```

Fallback matches are assigned lower confidence scores.

---

## Versioning Policy

### Schema Version vs Configuration Version

- **`schema_version`:** Version of the JSON Schema this file conforms to
- **`metadata.version`:** Version of this specific configuration file

### Version Bumping Rules

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| New rule set added | Minor (x.Y.0) | Adding `cytology_to_molecular` |
| Tie-breaker order changed | Major (X.0.0) | Reordering strategies affects output |
| Time window changed | Major (X.0.0) | Changing `-90/+30` to `-60/+14` |
| Description updated | Patch (x.y.Z) | Clarifying documentation |
| New optional field added to schema | Minor (x.Y.0) | Adding `confidence_thresholds` |

### Changelog Requirements

All changes must be documented in `metadata.changelog`:

```yaml
changelog:
  - version: "1.1.0"
    date: "2025-02-01"
    changes:
      - "Added cytology_to_molecular rule set"
      - "Expanded anatomic_site_rule options"
```

---

## File Structure

```
config/integration_rules/
├── README.md                        # This file
├── integration_rules.schema.json    # JSON Schema (validation contract)
└── integration_rules.example.yaml   # Example configuration
```

---

## Validation

Validate configuration files against the schema:

```bash
python scripts/validate_integration_rules.py config/integration_rules/integration_rules.example.yaml
```

Exit codes:
- `0`: Validation passed
- `1`: Validation failed (see error output)

---

## Governance

This contract is governed by:

- **SSAP v1.0:** Statistical Analysis Plan
- **FILE_PLACEMENT_RULES.md:** Repository organization standards

Changes to integration rules require:

1. Schema validation passing
2. Changelog entry added
3. Version bump following semantic versioning
4. No execution until `execution_permitted: true` is set by governance review

---

## Related Documents

- [config/linkers/linker_rules.yaml](../linkers/linker_rules.yaml) — Cross-modal linker specifications
- [docs/system/FILE_PLACEMENT_RULES.md](../../docs/system/FILE_PLACEMENT_RULES.md) — File placement standards
