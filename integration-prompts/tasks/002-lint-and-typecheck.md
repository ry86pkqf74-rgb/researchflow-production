# Task 002: Lint and Type Check

## Context
Code quality checks must pass before merging any changes.

## Goal
Run all linting and type checking tools, then fix any auto-fixable issues.

## Steps
1. Run `npm run lint` - Check for ESLint errors
2. Run `npm run typecheck` - Run TypeScript type checking
3. Run `npm run lint:fix` - Auto-fix ESLint issues
4. Run `npm run format` - Format code with Prettier
5. Re-run checks to verify fixes

## Constraints
- Only use auto-fix capabilities (--fix flag)
- Do not manually modify files to fix type errors
- Report any issues that cannot be auto-fixed

## Success Criteria
- [ ] ESLint runs without errors (or only unfixable warnings)
- [ ] TypeScript compiles without errors
- [ ] Prettier formatting applied
- [ ] All changes documented

## Output Format
```
## Lint/Type Check Results

### ESLint
- Errors: X (Y auto-fixed)
- Warnings: X

### TypeScript
- Errors: X
- Files checked: Y

### Prettier
- Files formatted: X

### Unfixable Issues
[List any issues requiring manual intervention]
```
