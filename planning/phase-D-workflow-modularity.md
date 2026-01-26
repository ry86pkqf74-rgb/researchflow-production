# Phase D: Python Workflow Modularity (P1)

## Objective
Ensure the Python workflow engine uses a clean, plugin-based architecture.

## Current State Analysis

The workflow engine already has good foundations:
- `services/worker/src/workflow_engine/` exists with:
  - `__init__.py` - exports registry, runner, types
  - `registry.py` - `@register_stage` decorator, `get_stage()`, `list_stages()`
  - `types.py` - `StageContext`, `StageResult`, `Stage` protocol
  - `runner.py` - `run_stages()` function with PHI sanitization

### What's Already Done:
1. Stage Protocol defined with `stage_id`, `stage_name`, `execute()` method
2. Decorator-based registration (`@register_stage`)
3. Runner with `stop_on_failure` support
4. PHI sanitization in error messages

### What Needs Improvement:
1. **Stage files organization** - need individual stage files
2. **main.py integration** - need to use runner instead of numeric loop
3. **Metadata-only results** - ensure no raw data in results

## Implementation Plan

### Step 1: Create stage directory structure
**Directory:** `services/worker/src/workflow_engine/stages/`

Create stage files:
```
stages/
  __init__.py           # Import all stages to trigger registration
  stage_01_upload.py    # Stage 1: File upload handling
  stage_04_phi_scan.py  # Stage 4: PHI scanning
  stage_05_validate.py  # Stage 5: Validation
  ...
```

### Step 2: Implement example stages
Create 3-5 representative stages to demonstrate the pattern:

**stage_01_upload.py:**
```python
from ..registry import register_stage
from ..types import Stage, StageContext, StageResult

@register_stage
class UploadStage:
    stage_id = 1
    stage_name = "File Upload Processing"

    async def execute(self, context: StageContext) -> StageResult:
        # Implementation
        pass
```

**stage_04_phi_scan.py:**
```python
@register_stage
class PhiScanStage:
    stage_id = 4
    stage_name = "PHI Scanning"

    async def execute(self, context: StageContext) -> StageResult:
        # Use generated PHI patterns
        # Return hash-only findings
        pass
```

### Step 3: Update stages/__init__.py
**File:** `services/worker/src/workflow_engine/stages/__init__.py`

```python
# Import all stages to trigger registration
from .stage_01_upload import UploadStage
from .stage_04_phi_scan import PhiScanStage
from .stage_05_validate import ValidateStage
# ... etc
```

### Step 4: Update main.py to use WorkflowRunner
**File:** `services/worker/src/main.py`

Current pattern (to replace):
```python
for stage_id in range(1, 20):
    run_stage(stage_id)
```

New pattern:
```python
from workflow_engine import run_stages, StageContext

context = StageContext(
    job_id=job_id,
    config=config,
    governance_mode=governance_mode,
)

result = await run_stages(
    stage_ids=configured_stage_ids,
    context=context,
)
```

### Step 5: Ensure metadata-only results
Update `StageResult` usage:
- `output` contains only metadata (counts, hashes, status)
- No raw data in `artifacts` (only paths)
- `errors` are PHI-sanitized (already done in runner.py)

## Files Created/Modified
1. `services/worker/src/workflow_engine/stages/__init__.py` (new)
2. `services/worker/src/workflow_engine/stages/stage_01_upload.py` (new)
3. `services/worker/src/workflow_engine/stages/stage_04_phi_scan.py` (new)
4. `services/worker/src/workflow_engine/stages/stage_05_validate.py` (new)
5. `services/worker/src/main.py` (update)
6. `services/worker/src/workflow_engine/__init__.py` (update imports)

## Commit Message
```
refactor(worker): introduce modular workflow stage runner

- Create individual stage files with @register_stage decorator
- Update main.py to use run_stages() with StageContext
- Ensure all stage results are metadata-only (no raw data)
- PHI patterns use generated definitions from canonical registry
```

## Verification
- [ ] pytest passes
- [ ] Stages register correctly
- [ ] run_stages() executes ordered subset
- [ ] Results contain no raw data
- [ ] PHI sanitization works in error messages
