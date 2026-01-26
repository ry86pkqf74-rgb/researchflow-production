# Docker Testing Setup for Manuscript Engine

This document describes how to run tests in a containerized environment with auto-approve enabled for Claude Code.

## Quick Start

### Run Tests Once
```bash
./docker-test.sh test
```

### Run Tests in Watch Mode
```bash
./docker-test.sh test-watch
```

### Generate Coverage Report
```bash
./docker-test.sh coverage
```

## Available Commands

| Command | Description |
|---------|-------------|
| `./docker-test.sh test` | Run all tests once |
| `./docker-test.sh test-watch` | Run tests in watch mode (auto-rerun on changes) |
| `./docker-test.sh coverage` | Run tests with coverage report |
| `./docker-test.sh build` | Build the test container |
| `./docker-test.sh rebuild` | Rebuild container from scratch (no cache) |
| `./docker-test.sh shell` | Open interactive shell in container |
| `./docker-test.sh clean` | Remove containers and volumes |
| `./docker-test.sh logs` | Show container logs |

## Container Features

### Auto-Approve Mode
Claude Code is configured with auto-approve in `.claude/settings.json`:
- Automatically approves read/write operations
- Automatically runs test commands
- Automatically runs git operations

### Volume Mounts
- `./src` - Source code (live-reloaded)
- `./coverage` - Coverage reports (persisted)
- `node_modules` - Cached in named volume for faster startups

### Environment Variables
- `NODE_ENV=test` - Test environment
- `CI=true` - CI mode for consistent test output

## Using Docker Compose Directly

If you prefer using Docker Compose directly:

```bash
# Run tests once
docker-compose -f docker-compose.test.yml run --rm manuscript-engine-test

# Run tests in watch mode
docker-compose -f docker-compose.test.yml run --rm manuscript-engine-dev

# Generate coverage
docker-compose -f docker-compose.test.yml run --rm manuscript-engine-coverage

# Clean up
docker-compose -f docker-compose.test.yml down -v
```

## Troubleshooting

### Tests Not Running
```bash
# Rebuild the container
./docker-test.sh rebuild
```

### Permission Issues
```bash
# Make the script executable
chmod +x docker-test.sh
```

### Container Won't Start
```bash
# Clean up and rebuild
./docker-test.sh clean
./docker-test.sh build
```

### Node Modules Issues
```bash
# Remove the volume and rebuild
docker volume rm manuscript-engine_manuscript-node-modules
./docker-test.sh rebuild
```

## CI/CD Integration

This setup works seamlessly in CI/CD environments:

```yaml
# Example GitHub Actions workflow
name: Test Manuscript Engine
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run tests in container
        run: |
          cd packages/manuscript-engine
          ./docker-test.sh test

      - name: Generate coverage
        run: |
          cd packages/manuscript-engine
          ./docker-test.sh coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: packages/manuscript-engine/coverage
```

## Development Workflow

### 1. Make Changes to Source Code
Edit files in `./src` - changes are immediately reflected in the container.

### 2. Run Tests in Watch Mode
```bash
./docker-test.sh test-watch
```

Tests automatically rerun when you save files.

### 3. Check Coverage
```bash
./docker-test.sh coverage
open coverage/index.html  # View coverage report
```

### 4. Debug in Container
```bash
./docker-test.sh shell
npm test -- --reporter=verbose
```

## Auto-Approve Configuration

Claude Code auto-approve is configured in `.claude/settings.json`:

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

This means Claude Code will automatically:
- Run tests without prompting
- Read and write files
- Execute git commands
- Generate coverage reports

## Benefits of Container Testing

✅ **Consistent Environment** - Same Node version, dependencies across all machines
✅ **Isolated** - Tests don't affect your local system
✅ **Fast** - Cached dependencies in named volumes
✅ **CI-Ready** - Same container runs locally and in CI
✅ **Auto-Approve** - Claude Code works without manual approval
✅ **Clean State** - Easy to reset with `./docker-test.sh clean`

## Current Test Status

- **Total Tests**: 302
- **Passing**: 302
- **Coverage**: 23.15%
- **Target Coverage**: 80%

## Next Steps

To reach 80% coverage, add tests for:
- Remaining Phase 4 AI services (~20 services)
- Phase 1-3 services (~30 services)
- Integration tests for full workflows
