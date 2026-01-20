# ResearchFlow Integration Execution Plan

## Memory Log (State Tracking)

```python
memory_log = {
    'completed_tasks': [
        'Prompt 1: Code Structure Optimization (5 commits pushed to main)'
    ],
    'in_progress': [
        'Prompt 2: Playwright E2E Critical Journeys (Claude Terminal)'
    ],
    'pending_tasks': [
        'Prompt 3: Load & Performance Testing',
        'Prompt 4: Governance & Maintainability Refactor',
        'Prompt 5: Stage 20 Conference Preparation',
        'Prompt 6: Deployment Robustness & Performance',
        'Prompt 7: Scalability & Throughput Optimization',
        'Prompt 8: Observability + Analytics + Feature Flags'
    ],
    'summaries': {},
    'errors': [],
    'dependencies': {}
}
```

---

## Prompt Inventory (8 Total)

| # | Prompt Name | Priority | Est. Commits | Dependencies |
|---|-------------|----------|--------------|--------------|
| 1 | Code Structure Optimization | ✅ DONE | 5 | None |
| 2 | Playwright E2E Critical Journeys | P0 | 1-2 | None |
| 3 | Load & Performance Testing | P1 | 5 | Prompt 1 (PHI scanner) |
| 4 | Governance & Maintainability Refactor | P1 | 5 | Prompt 1 (overlaps) |
| 5 | Stage 20: Conference Preparation | P2 | 3 | None |
| 6 | Deployment Robustness | P1 | 4 | None |
| 7 | Scalability Optimization | P2 | 6 | Prompt 6 (health endpoints) |
| 8 | Observability + Feature Flags | P2 | 6 | Prompt 6, 7 |

---

## Dependency Graph

```
Prompt 1 (DONE) ─────┐
                     ├──> Prompt 3 (Load Testing)
                     └──> Prompt 4 (Governance - partial overlap)

Prompt 2 (In Progress) ──> Independent

Prompt 5 (Conference) ──> Independent (can parallel)

Prompt 6 (Deployment) ────┐
                          ├──> Prompt 7 (Scalability)
                          └──> Prompt 8 (Observability)
```

---

## Overlap Analysis

### Prompts 1 & 4 (HIGH OVERLAP)
- PR guardrails: Already done in Prompt 1
- PHI scanner deduplication: Already done in Prompt 1
- Python workflow modularity: Already done in Prompt 1
- **Skip in Prompt 4**: A, B, D, E sections (done)
- **Execute in Prompt 4**: C (Canonical PHI Registry + Codegen) - NEW

### Prompts 3 & 6 (MEDIUM OVERLAP)
- Health endpoints: Both mention
- Mode toggling: Both mention
- **Execute once in Prompt 6**, skip in Prompt 3

### Prompts 6, 7, 8 (SEQUENTIAL)
- Must execute in order
- 6 establishes health/readiness
- 7 builds on 6 with HPA/caching
- 8 adds observability on top

---

## Recommended Execution Order

### Phase A: Foundation (Parallel)
1. **Prompt 2** - E2E Tests (Claude Terminal - in progress)
2. **Prompt 5** - Stage 20 Conference (Cowork - can parallel)
3. **Prompt 6** - Deployment Robustness (Cowork - can parallel)

### Phase B: Infrastructure
4. **Prompt 3** - Load Testing (after Prompt 6 health endpoints)
5. **Prompt 4** - Only Section C: Canonical PHI Registry

### Phase C: Scalability
6. **Prompt 7** - Scalability Optimization
7. **Prompt 8** - Observability + Feature Flags

---

## Prompt File Locations

| Prompt | Path |
|--------|------|
| 2 | `/workspace/integration-prompts/tasks/prompt-002-playwright-e2e-journeys.md` |
| 3 | `/workspace/integration-prompts/tasks/prompt-003-load-performance-testing.md` |
| 4 | `/workspace/integration-prompts/tasks/prompt-004-governance-maintainability-refactor.md` |
| 5 | `/workspace/integration-prompts/tasks/prompt-005-stage20-conference-prep.md` |
| 6 | `/workspace/integration-prompts/tasks/prompt-006-deployment-robustness.md` |
| 7 | `/workspace/integration-prompts/tasks/prompt-007-scalability-optimization.md` |
| 8 | `/workspace/integration-prompts/tasks/prompt-008-observability-featureflags.md` |

---

## Execution Status

| Prompt | Status | Executor | Commits |
|--------|--------|----------|---------|
| 1 | ✅ Complete | Cowork | 5 pushed |
| 2 | 🔄 In Progress | Claude Terminal | - |
| 3 | ⏳ Pending | - | - |
| 4 | ⏳ Pending (partial) | - | - |
| 5 | ⏳ Pending | - | - |
| 6 | ⏳ Pending | - | - |
| 7 | ⏳ Pending | - | - |
| 8 | ⏳ Pending | - | - |
