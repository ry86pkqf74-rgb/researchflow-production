# Contributing to ResearchFlow

Thank you for your interest in contributing to ResearchFlow! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Security Guidelines](#security-guidelines)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment (see below)
4. Create a feature branch from `main`

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- PostgreSQL 14+

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/researchflow-production.git
cd researchflow-production

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development services
docker-compose up -d

# Run migrations
npm run db:migrate

# Start the development server
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=packages/phi-engine

# Run with coverage
npm test -- --coverage
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(phi-engine): add HIPAA-compliant redaction for SSN patterns

- Added regex pattern for SSN detection
- Implemented redaction with configurable replacement
- Added unit tests for edge cases
```

## Pull Request Process

1. Ensure all tests pass (`npm test`)
2. Update documentation if needed
3. Add tests for new functionality
4. Request review from maintainers
5. Address feedback promptly

### PR Checklist

- [ ] Tests pass locally
- [ ] No PHI or secrets in code
- [ ] Documentation updated
- [ ] Follows coding standards
- [ ] Security guidelines followed

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Prefer functional patterns

### Python

- Follow PEP 8 style guide
- Use type hints
- Add docstrings for functions
- Use pytest for testing

### General

- Keep functions small and focused
- Write self-documenting code
- Add comments for complex logic
- Handle errors appropriately

## Security Guidelines

### Critical Requirements

1. **No Secrets in Code**: Never commit API keys, passwords, or tokens
2. **PHI Protection**: All PHI must go through phi-engine scanning
3. **Input Validation**: Validate all user inputs
4. **RBAC**: Respect role-based access controls

### Reporting Vulnerabilities

If you discover a security vulnerability:
1. Do NOT open a public issue
2. Email security@researchflow.example.com
3. Include detailed reproduction steps
4. Allow time for patch before disclosure

## Questions?

- Check existing [Issues](https://github.com/researchflow/researchflow-production/issues)
- Start a [Discussion](https://github.com/researchflow/researchflow-production/discussions)
- Review [Documentation](docs/README.md)

Thank you for contributing to ResearchFlow!
