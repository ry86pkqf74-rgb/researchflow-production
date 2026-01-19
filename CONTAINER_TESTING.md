# Container Testing with Auto-Approve

This repository includes a containerized testing environment with auto-approve enabled for automated test execution.

## Quick Start

### Run Tests in Container
```bash
./test-manuscript-engine.sh test
```

### Watch Mode (Auto-Rerun on Changes)
```bash
./test-manuscript-engine.sh watch
```

### Generate Coverage Report
```bash
./test-manuscript-engine.sh coverage
```

## Why Use Containers?

✅ **Consistent Environment** - Same Node version, dependencies everywhere
✅ **Isolated** - Doesn't affect your local system
✅ **Auto-Approve** - Tests run without manual prompts
✅ **CI-Ready** - Same container works locally and in CI/CD
✅ **Fast Setup** - No local dependency installation needed

## Available Commands

```bash
./test-manuscript-engine.sh test       # Run all tests once
./test-manuscript-engine.sh watch      # Watch mode (auto-rerun)
./test-manuscript-engine.sh coverage   # Generate coverage report
./test-manuscript-engine.sh build      # Build the container
./test-manuscript-engine.sh rebuild    # Rebuild from scratch
./test-manuscript-engine.sh shell      # Open interactive shell
./test-manuscript-engine.sh clean      # Clean up everything
```

## Current Test Status

**Manuscript Engine Package:**
- **Total Tests**: 302
- **Passing**: 302 ✓
- **Coverage**: 23.15%
- **Target**: 80%

### Test Breakdown
- Phase 5 Services: 188 tests
  - export.service.ts: 47 tests
  - compliance-checker.service.ts: 61 tests
  - peer-review.service.ts: 31 tests
  - final-phi-scan.service.ts: 50 tests
- PHI Guard: 38 tests
- Phase 4 AI Services: 53 tests
  - grammar-checker.service.ts: 26 tests
  - claim-verifier.service.ts: 27 tests
- Core Services: 22 tests

## Auto-Approve Configuration

Auto-approve is enabled in `packages/manuscript-engine/.claude/settings.json`:

```json
{
  "permissions": {
    "autoApprove": true,
    "allowedTools": ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
    "allowedCommands": [
      "npm test",
      "npm run test:coverage",
      "git status",
      "git diff"
    ]
  }
}
```

This means:
- ✓ Tests run automatically without prompts
- ✓ File operations don't require approval
- ✓ Git commands execute immediately
- ✓ Coverage generation is automatic

## Development Workflow

### 1. Start Watch Mode
```bash
./test-manuscript-engine.sh watch
```

### 2. Edit Source Files
Changes to `packages/manuscript-engine/src/**/*.ts` automatically trigger test reruns.

### 3. Check Coverage
```bash
./test-manuscript-engine.sh coverage
open packages/manuscript-engine/coverage/index.html
```

### 4. Debug in Container
```bash
./test-manuscript-engine.sh shell
npm test -- --reporter=verbose
npm test -- --grep="specific test name"
```

## Fixing Test Failures

If you encounter test failures:

### 1. Run Tests to See Failures
```bash
./test-manuscript-engine.sh test
```

### 2. Debug Specific Test
```bash
./test-manuscript-engine.sh shell
npm test -- --grep="test name"
```

### 3. Fix and Verify
Edit the source files, then:
```bash
./test-manuscript-engine.sh test
```

### 4. Check Coverage Impact
```bash
./test-manuscript-engine.sh coverage
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Manuscript Engine

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run tests in container
        run: ./test-manuscript-engine.sh test

      - name: Generate coverage
        run: ./test-manuscript-engine.sh coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: packages/manuscript-engine/coverage
```

## Troubleshooting

### Container Won't Build
```bash
./test-manuscript-engine.sh rebuild
```

### Tests Fail in Container But Pass Locally
```bash
# Check environment differences
./test-manuscript-engine.sh shell
env | grep NODE
```

### Slow Performance
```bash
# Clean up old containers and volumes
./test-manuscript-engine.sh clean
./test-manuscript-engine.sh build
```

### Permission Errors
```bash
chmod +x test-manuscript-engine.sh
```

## Container Architecture

```
┌─────────────────────────────────────┐
│  ResearchFlow Monorepo              │
├─────────────────────────────────────┤
│  packages/                          │
│  ├── core/           (built first)  │
│  ├── phi-engine/    (built second) │
│  ├── ai-router/     (built third)  │
│  └── manuscript-engine/ (tested)   │
└─────────────────────────────────────┘
           ↓
    Docker Container
           ↓
┌─────────────────────────────────────┐
│  Node 20 Alpine                     │
│  + All dependencies installed       │
│  + All packages built               │
│  + Tests running in isolation       │
└─────────────────────────────────────┘
```

## Next Steps

To reach 80% coverage, add tests for:

1. **Remaining Phase 4 AI Services** (~20 services)
   - claude-writer.service.ts
   - medical-nlp.service.ts
   - readability-analyzer.service.ts
   - etc.

2. **Phase 1-3 Services** (~30 services)
   - data-mapper.service.ts (needs more coverage)
   - citation-formatter.service.ts
   - abstract-generator.service.ts
   - etc.

3. **Integration Tests**
   - Full manuscript generation workflow
   - End-to-end PHI protection
   - Export pipeline testing

## Benefits Summary

| Feature | Local Testing | Container Testing |
|---------|--------------|------------------|
| Environment Consistency | ❌ Varies by machine | ✅ Always the same |
| Dependency Installation | ⏱️ Slow, manual | ⚡ Cached, automatic |
| Auto-Approve | ❌ Manual prompts | ✅ Fully automatic |
| CI/CD Ready | ⚠️ May differ | ✅ Identical |
| Clean State | ❌ Hard to reset | ✅ One command |
| Isolation | ❌ Affects local system | ✅ Fully isolated |

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Run `./test-manuscript-engine.sh clean` and retry
3. Check container logs with `./test-manuscript-engine.sh shell`
4. Review `DOCKER_TESTING.md` in manuscript-engine package
