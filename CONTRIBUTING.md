# Contributing to ResearchFlow

Thank you for your interest in contributing to ResearchFlow! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [PHI Safety Requirements](#phi-safety-requirements)
- [Code Style](#code-style)
- [Testing](#testing)
- [Communication](#communication)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and considerate in all communications
- Accept constructive criticism gracefully
- Focus on what is best for the project and community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ry86pkqf74-rgb/researchflow-production.git
   cd researchflow-production
   ```

2. **Install dependencies**
   ```bash
   # Install Node.js dependencies
   npm install

   # Install Python dependencies
   cd services/worker
   pip install -r requirements.txt
   cd ../..
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Start services**
   ```bash
   # Using Docker Compose
   docker-compose up -d

   # Or run services individually
   npm run dev
   ```

5. **Verify setup**
   ```bash
   # Run tests
   npm test

   # Check health endpoint
   curl http://localhost:3001/health
   ```

## Making Changes

### Branch Naming

Use descriptive branch names following this convention:

- `feature/short-description` - New features
- `fix/short-description` - Bug fixes
- `docs/short-description` - Documentation updates
- `refactor/short-description` - Code refactoring
- `test/short-description` - Test additions/updates
- `chore/short-description` - Maintenance tasks

### Commit Messages

Follow conventional commit format:

```
type(scope): short description

Longer description if needed.

Closes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

Examples:
```
feat(worker): add conference materials export endpoint
fix(web): resolve Stage 20 endpoint mismatch
docs(api): update orchestrator API documentation
```

### Pull Request Size

**Important:** PRs should be **under 2500 lines of code** to ensure thorough review. Large changes should be split into smaller, focused PRs.

## Pull Request Process

1. **Create a branch** from `develop` (not `main`)

2. **Make your changes** following the code style guidelines

3. **Write/update tests** for your changes

4. **Run the test suite**
   ```bash
   npm test
   npm run test:phi
   npm run test:governance
   ```

5. **Submit PR** with:
   - Clear title describing the change
   - Description of what changed and why
   - Link to related issue(s)
   - PHI safety checklist completed

6. **Address review feedback** promptly

7. **Wait for approval** from at least one maintainer

## PHI Safety Requirements

**CRITICAL:** ResearchFlow handles potentially sensitive medical research data. All contributions MUST follow PHI safety guidelines:

### Non-Negotiable Rules

1. **Fail-Closed**: If PHI detection fails or is uncertain, block the operation
2. **No Raw PHI**: Never return raw PHI values; only return locations, hashes, or categories
3. **DEMO Mode**: Must work completely offline using fixtures only
4. **Audit Trail**: All operations must be logged (without PHI content)

### PHI Checklist for PRs

- [ ] No hardcoded PHI/PII in code or tests
- [ ] PHI scanner passes on all new code
- [ ] DEMO mode tested offline
- [ ] Error messages don't leak PHI
- [ ] Logs sanitized (no PHI in log output)
- [ ] API responses checked for PHI exposure

### Running PHI Checks

```bash
# Run PHI scanner
npm run test:phi

# Check for PHI patterns in your changes
npm run phi:check

# Verify fail-closed behavior
npm run test:fail-closed
```

## Code Style

### TypeScript (Web/Orchestrator)

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable/function names
- Add JSDoc comments for public APIs
- Follow ESLint rules (`npm run lint`)

### Python (Worker)

- Follow PEP 8
- Use type hints
- Add docstrings for functions/classes
- Follow Bandit security recommendations

### General

- Keep functions small and focused
- Write self-documenting code
- Add comments for complex logic
- Handle errors gracefully

## Testing

### Test Types

| Type | Command | Purpose |
|------|---------|---------|
| Unit | `npm run test:unit` | Test individual functions |
| Integration | `npm run test:integration` | Test component interactions |
| E2E | `npm run test:e2e` | Test full user flows |
| PHI | `npm run test:phi` | Verify PHI handling |
| Governance | `npm run test:governance` | Test RBAC and policies |

### Writing Tests

- Place tests in `tests/` directory
- Use descriptive test names
- Test happy path AND error cases
- Mock external dependencies
- Keep tests fast and isolated

### Coverage

We aim for:
- 80%+ line coverage for critical paths
- 100% coverage for PHI handling code
- All public APIs tested

## Communication

### Channels

- **GitHub Issues**: Bug reports, feature requests
- **Pull Requests**: Code review and discussion
- **Discussions**: General questions and ideas

### Getting Help

1. Check existing documentation in `/docs`
2. Search closed issues/PRs
3. Open a new issue with the `question` label

### Reporting Security Issues

**Do NOT** open public issues for security vulnerabilities. Instead:

1. Email security concerns privately
2. Include detailed description
3. Wait for acknowledgment before disclosure

## Recognition

Contributors are recognized in:
- Release notes
- CONTRIBUTORS.md (for significant contributions)
- GitHub contributor graphs

Thank you for helping make ResearchFlow better!
