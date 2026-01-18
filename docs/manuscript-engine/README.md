# ResearchFlow Manuscript Engine - Ralph Loop Implementation

This package contains everything needed to implement the `manuscript-engine` package (100 tasks) using the Ralph Wiggum autonomous loop technique.

## Files Included

| File | Description |
|------|-------------|
| `MANUSCRIPT_ENGINE_PRD.md` | Main PRD with all 100 tasks in Ralph-compatible format |
| `PHASE_0_PACKAGE_SETUP.md` | Package scaffolding and type definitions |
| `PHASE_1_DATA_INTEGRATION.md` | Tasks 1-20: Data mapping, PHI guard, versioning |
| `PHASE_2_LITERATURE_INTEGRATION.md` | Tasks 21-40: PubMed, citations, plagiarism check |
| `PHASE_3_STRUCTURE_BUILDING.md` | Tasks 41-60: IMRaD templates, generators |
| `PHASE_4_WRITING_ASSISTANCE.md` | Tasks 61-80: AI drafting, grammar, claims |
| `PHASE_5_REVIEW_EXPORT.md` | Tasks 81-100: Peer review, CONSORT, export |
| `start-ralph-manuscript-engine.sh` | Quick-start script |
| `claude-settings.json` | Sandbox settings (copy to `.claude/settings.json`) |

## Prerequisites

1. **Install Claude Code**:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Install Ralph Wiggum Plugin**:
   ```bash
   claude
   /plugin install ralph-wiggum
   ```

3. **Clone Your Repository**:
   ```bash
   git clone https://github.com/ry86pkqf74rgb/researchflow-production
   cd researchflow-production
   ```

## Setup

1. **Copy all files to your project root**:
   ```bash
   cp MANUSCRIPT_ENGINE_PRD.md /path/to/researchflow-production/
   cp PHASE_*.md /path/to/researchflow-production/
   ```

2. **Configure sandbox settings** (optional but recommended):
   ```bash
   mkdir -p .claude
   cp claude-settings.json .claude/settings.json
   ```

3. **Verify existing packages** are working:
   ```bash
   npm install
   npm run build
   npm test
   ```

## Running the Ralph Loop

### Option 1: Quick Start Script

```bash
chmod +x start-ralph-manuscript-engine.sh
./start-ralph-manuscript-engine.sh /path/to/researchflow-production
```

### Option 2: Manual Execution

```bash
cd /path/to/researchflow-production
claude
```

Then in Claude Code:
```
/ralph-loop "Read MANUSCRIPT_ENGINE_PRD.md and all PHASE_*.md files. Work through tasks in order, marking passes: true when complete. Output <promise>MANUSCRIPT_ENGINE_COMPLETE</promise> when ALL tasks pass." --max-iterations 150 --completion-promise "MANUSCRIPT_ENGINE_COMPLETE"
```

### Option 3: Phase-by-Phase (More Control)

Run each phase separately with shorter iteration limits:

```bash
# Phase 0: Setup
/ralph-loop "Read MANUSCRIPT_ENGINE_PRD.md and PHASE_0_PACKAGE_SETUP.md. Complete tasks P0-1 through P0-6. Output <promise>PHASE0_DONE</promise>" --max-iterations 15 --completion-promise "PHASE0_DONE"

# Phase 1: Data Integration
/ralph-loop "Read MANUSCRIPT_ENGINE_PRD.md and PHASE_1_DATA_INTEGRATION.md. Complete tasks T1 through T20. Output <promise>PHASE1_DONE</promise>" --max-iterations 30 --completion-promise "PHASE1_DONE"

# Continue for remaining phases...
```

## Monitoring Progress

The PRD file includes an **Activity Log** section that gets updated after each iteration. Monitor progress by:

```bash
# Watch for task completion
grep -E '"passes": true' MANUSCRIPT_ENGINE_PRD.md | wc -l

# Check activity log
head -50 MANUSCRIPT_ENGINE_PRD.md
```

## If the Loop Gets Stuck

1. **Check the Activity Log** in `MANUSCRIPT_ENGINE_PRD.md`
2. **Review Claude Code output** for specific errors
3. **Common issues**:
   - Missing dependencies: Run `npm install` in the package
   - Type errors: Check `tsconfig.json` references
   - Test failures: Check test output for specifics

4. **Resume from checkpoint**:
   ```
   /ralph-loop "Continue from where you left off in MANUSCRIPT_ENGINE_PRD.md. The last completed task was [TASK_ID]. Complete remaining tasks." --max-iterations 50 --completion-promise "MANUSCRIPT_ENGINE_COMPLETE"
   ```

## Cost Estimation

Based on typical Ralph loop executions:
- **Estimated iterations**: 80-120
- **Estimated API cost**: $30-80 (varies by model and context size)
- **Estimated time**: 4-8 hours (can run overnight)

## Safety Features

The implementation includes critical safety features:
- **PHI Guard**: Blocks all 18 HIPAA identifiers before data insertion
- **Final PHI Scan**: Mandatory scan before any export
- **Audit Logging**: Hash-chained audit trail for all operations
- **Human Attestation**: Required for sensitive sections (Results, Methods)

## Completion Criteria

The loop completes when:
1. All 100 tasks have `passes: true` in the PRD
2. `npm run build` succeeds with no errors
3. `npm test` passes with >80% coverage
4. No TypeScript compilation errors
5. PHI scanning integrated at all data insertion points

## Support

If you encounter issues:
1. Check the phase files for exact specifications
2. Review the existing codebase structure in `packages/core`, `packages/phi-engine`, etc.
3. Ensure workspace references are correctly configured
