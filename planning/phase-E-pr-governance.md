# Phase E: PR Hygiene & Governance (P1)

## Objective
Enforce smaller, auditable changes and improve PR review quality.

## Current State Analysis

### Existing:
1. **PR Size Guard** (`.github/workflows/pr-size-guard.yml`)
   - Current limit: 1500 lines
   - No label bypass
   - Basic error message

2. **PR Template** (`.github/pull_request_template.md`)
   - Basic structure
   - Missing PHI safety checklist
   - Missing size acknowledgment

## Implementation Plan

### Step 1: Update PR Size Guard
**File:** `.github/workflows/pr-size-guard.yml`

Changes:
- Increase limit to 2500 LOC (as specified)
- Add `large-pr-approved` label bypass
- Add instructional comment on failure
- Improve error message

```yaml
name: PR Size Guard

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]

env:
  MAX_CHANGED_LINES: 2500

jobs:
  check-pr-size:
    runs-on: ubuntu-latest
    steps:
      - name: Check for override label
        id: check-label
        run: |
          if [[ "${{ contains(github.event.pull_request.labels.*.name, 'large-pr-approved') }}" == "true" ]]; then
            echo "override=true" >> $GITHUB_OUTPUT
          else
            echo "override=false" >> $GITHUB_OUTPUT
          fi

      - name: Checkout
        if: steps.check-label.outputs.override != 'true'
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check PR Size
        if: steps.check-label.outputs.override != 'true'
        run: |
          # Size check logic with instructional message
```

### Step 2: Update PR Template
**File:** `.github/pull_request_template.md`

New template:
```markdown
## Summary
<!-- Brief description of changes (1-3 sentences) -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation
- [ ] Infrastructure/CI
- [ ] Other: ___

## PHI Safety Checklist
> **REQUIRED for any code touching data processing**

- [ ] No raw PHI in logs, errors, or API responses
- [ ] PHI scan outputs use hash + location only (no matchedText)
- [ ] Tested with synthetic data fixtures
- [ ] Reviewed PHI patterns from canonical registry

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed (describe below if applicable)

### Test Commands Run
```bash
# List commands run to verify changes
```

## PR Size Acknowledgment
- [ ] PR is under 2500 LOC changed
- [ ] If over limit: Justification provided and `large-pr-approved` label requested

## Breaking Changes
<!-- List any breaking changes or migration steps needed -->

## Related Issues
<!-- Link to related issues: Fixes #123, Related to #456 -->

## Screenshots/Recordings
<!-- If applicable, add screenshots or recordings -->
```

### Step 3: Create PR size warning comment action
**File:** `.github/workflows/pr-size-guard.yml` (update)

Add step to post comment:
```yaml
- name: Post size warning comment
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `## PR Size Warning ⚠️

This PR exceeds the ${process.env.MAX_CHANGED_LINES} line limit.

**Options:**
1. Split into smaller, focused PRs
2. Use feature flags to land incrementally
3. Request \`large-pr-approved\` label with justification

**Why this matters:**
- Smaller PRs are easier to review thoroughly
- Reduces risk of regressions
- Faster iteration and feedback`
      })
```

## Files Modified
1. `.github/workflows/pr-size-guard.yml`
2. `.github/pull_request_template.md`

## Commit Message
```
chore(governance): enforce PR size guardrails

- Update PR size limit to 2500 LOC
- Add large-pr-approved label bypass
- Post instructional comment on size violation
- Add PHI safety checklist to PR template
- Add testing and breaking changes sections
```

## Verification
- [ ] PR size guard triggers on PRs > 2500 LOC
- [ ] `large-pr-approved` label bypasses check
- [ ] Comment is posted on size violation
- [ ] PR template renders correctly
- [ ] All checklist items are actionable
