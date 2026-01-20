## Summary

<!-- Briefly describe what this PR does (1-3 sentences) -->

## Changes

<!-- List the key changes made in this PR -->

-

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactor (code changes that neither fix a bug nor add a feature)
- [ ] Documentation update
- [ ] CI/CD or infrastructure change

## Testing

<!-- Describe the tests you ran and/or created -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

**Test commands run:**
```bash
npm test
pytest
```

## PHI Safety Checklist

<!-- MANDATORY: All PHI-related changes must complete this checklist -->

- [ ] No raw PHI values are stored, logged, or returned in API responses
- [ ] All PHI matches use hash-only output (SHA256 first 12 chars + length)
- [ ] PHI patterns use canonical source (`shared/phi/phi_patterns.v1.json`)
- [ ] Error messages are PHI-sanitized before logging
- [ ] N/A - This PR does not touch PHI-related code

## PR Size Acknowledgment

<!-- PRs > 2500 LOC require the large-pr-approved label -->

- [ ] This PR is under 2500 lines of changes
- [ ] This PR exceeds 2500 LOC and has `large-pr-approved` label with justification:
  <!-- If applicable, explain why this PR cannot be split -->

## Related Issues

<!-- Link any related issues -->

Closes #

## Screenshots/Recordings

<!-- If applicable, add screenshots or recordings to demonstrate the changes -->

## Reviewer Notes

<!-- Any specific areas you'd like reviewers to focus on -->

---

**By submitting this PR, I confirm that:**
- [ ] I have reviewed my own code
- [ ] My changes follow the project's coding standards
- [ ] I have updated documentation as needed
- [ ] All CI checks pass locally
