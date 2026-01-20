# Small PR Policy

## Overview

This document outlines our policy for keeping Pull Requests (PRs) small and focused. Small PRs are easier to review, less likely to introduce bugs, and enable faster iteration cycles.

## Size Limits

**Maximum PR Size: 1500 lines of code (LOC) changed**

This limit includes both additions and deletions. PRs exceeding this threshold will be automatically flagged by our CI/CD pipeline and require special approval.

### Why 1500 LOC?

- **Review Quality**: Studies show that review effectiveness drops significantly after ~400-500 lines, with diminishing returns beyond that
- **Context Switching**: Smaller PRs allow reviewers to maintain mental context
- **Risk Management**: Smaller changes are easier to revert if issues arise
- **Faster Feedback**: Smaller PRs get reviewed and merged faster

## Strategies for Splitting PRs

### 1. Feature Flags

Use feature flags to merge incomplete features incrementally:

```typescript
if (featureFlags.newSearchEnabled) {
  // New implementation
} else {
  // Existing implementation
}
```

### 2. Extract Refactors First

Before adding new features, submit refactoring changes separately:

1. **PR 1**: Refactor existing code to prepare for new feature
2. **PR 2**: Add the actual feature on top of the refactored code

### 3. Stacked PRs

Create a chain of dependent PRs:

1. **PR 1**: Base infrastructure changes (merge first)
2. **PR 2**: Build on PR 1 with core logic
3. **PR 3**: Build on PR 2 with UI components

### 4. Horizontal Slicing

Split by layer of the application:

1. **PR 1**: Database schema changes and migrations
2. **PR 2**: Backend API endpoints
3. **PR 3**: Frontend components

### 5. Vertical Slicing

Split by minimal end-to-end functionality:

1. **PR 1**: Basic CRUD for single entity
2. **PR 2**: Add validation and error handling
3. **PR 3**: Add advanced features

## Exception Handling

### When Exceptions May Be Granted

- **Generated Code**: Auto-generated files (migrations, type definitions)
- **Bulk Renames**: Large-scale refactoring that touches many files minimally
- **Dependency Updates**: Package lock file changes
- **Initial Project Setup**: Bootstrap commits for new services

### How to Request an Exception

1. Add the `pr-size-exception` label to your PR
2. Include justification in the PR description:
   ```markdown
   ## Size Exception Request

   **Reason**: [Generated code / Bulk rename / Dependency update / Other]

   **Justification**: [Explain why this cannot be split]

   **Review Strategy**: [How reviewers should approach this large PR]
   ```
3. Get approval from at least two reviewers
4. Tag a team lead for final sign-off

### Exceptions Do NOT Apply To

- "I'm in a hurry" - Plan better next time
- "It's all related" - Find the seams and split
- "Tests make it big" - Tests are valuable; split the feature

## Best Practices

### Before Starting Work

1. **Plan the split**: Before coding, identify natural break points
2. **Create tracking issue**: Document the full scope and PR breakdown
3. **Communicate**: Let the team know about your PR strategy

### During Development

1. **Commit early, commit often**: Small commits make splitting easier
2. **Keep PRs independent**: Each PR should be deployable on its own
3. **Write good PR descriptions**: Help reviewers understand the context

### When Reviewing

1. **Check the size first**: Large PRs deserve extra scrutiny
2. **Review in stages**: For larger PRs, review file-by-file
3. **Provide actionable feedback**: Suggest how to split if needed

## Automated Enforcement

Our CI pipeline includes `pr-size-guard.yml` which:

1. Calculates total lines changed (additions + deletions)
2. Compares against the 1500 LOC threshold
3. Fails the check if exceeded
4. Provides tips for splitting the PR

### Bypassing the Check

In rare cases where an exception is approved:

1. A maintainer can manually approve the workflow run
2. The `pr-size-exception` label can be configured to skip the check

## Metrics and Goals

We track the following metrics:

- **Average PR size**: Target < 300 LOC
- **PR review time**: Target < 24 hours for small PRs
- **PR rejection rate**: Should decrease with smaller PRs

## Resources

- [Google Engineering Practices: Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)
- [The Art of Small Pull Requests](https://essenceofcode.com/2019/10/29/the-art-of-small-pull-requests/)
- [Stacked Diffs](https://newsletter.pragmaticengineer.com/p/stacked-diffs)
