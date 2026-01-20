# User Acceptance Testing Guide

## Overview

This document outlines the User Acceptance Testing (UAT) procedures for ResearchFlow. UAT ensures that all features meet user requirements and function correctly in real-world scenarios.

## Test Environment Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 14+
- Valid test credentials

### Environment Configuration

```bash
# Clone and setup
git clone https://github.com/your-org/researchflow-production.git
cd researchflow-production

# Configure environment
cp .env.example .env.uat
# Edit .env.uat with UAT-specific settings

# Start UAT environment
docker-compose -f docker-compose.yml up -d
```

## Test Scenarios

### 1. Authentication & Authorization

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AUTH-001 | User login with valid credentials | Successful login, JWT issued |
| AUTH-002 | User login with invalid credentials | Error message displayed |
| AUTH-003 | Password reset flow | Reset email sent, new password works |
| AUTH-004 | Role-based access control | Unauthorized actions blocked |

### 2. Research Workflow

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| RW-001 | Create new research project | Project created with unique ID |
| RW-002 | Upload data file | File validated and stored |
| RW-003 | Execute 19-stage workflow | All stages complete successfully |
| RW-004 | Generate manuscript sections | AI-generated content appears |
| RW-005 | Export to DOCX/PDF | Valid document downloaded |

### 3. PHI Governance

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PHI-001 | Upload file with PHI in DEMO mode | PHI detected, upload blocked |
| PHI-002 | AI prompt with PHI | PHI redacted from output |
| PHI-003 | Audit trail generation | All PHI events logged |
| PHI-004 | LIVE mode approval workflow | Approval required for PHI access |

### 4. AI Router

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AI-001 | Simple task routing | Routes to NANO tier |
| AI-002 | Complex task routing | Routes to FRONTIER tier |
| AI-003 | Quality gate failure | Automatic tier escalation |
| AI-004 | Cost tracking | Token usage recorded |

### 5. Manuscript Engine

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| MS-001 | Section generation | Content generated per template |
| MS-002 | Section revision history | Versions tracked correctly |
| MS-003 | Claim verification | Citations validated |
| MS-004 | Journal template selection | Formatting applied correctly |

## Test Execution

### Running UAT Tests

```bash
# Run all UAT tests
npm run test:uat

# Run specific test suite
npm run test:uat -- --grep "Authentication"

# Generate UAT report
npm run test:uat -- --reporter html
```

### Test Data

Use the synthetic test data provided in `tests/fixtures/`:
- `synthetic_clinical_data.csv` - Sample clinical dataset
- `synthetic_survey_data.csv` - Sample survey responses
- `thyroid_case_study_synthetic.csv` - Case study data

## Acceptance Criteria

### Pass Criteria

- All critical tests (AUTH, PHI, RW core) pass
- No blocking defects
- Performance within SLO targets
- Accessibility compliance (WCAG 2.1 AA)

### Sign-off Process

1. QA team completes all test scenarios
2. Product owner reviews test results
3. Stakeholders sign acceptance document
4. Release approved for production

## Defect Reporting

Report issues using the standard template:

```markdown
## Defect Report

**Test ID:** [e.g., AUTH-001]
**Severity:** [Critical/High/Medium/Low]
**Environment:** [UAT/Staging]

### Steps to Reproduce
1. Step one
2. Step two
3. Step three

### Expected Result
What should happen

### Actual Result
What actually happened

### Screenshots/Logs
[Attach relevant evidence]
```

## Contact

- UAT Coordinator: qa@researchflow.example.com
- Technical Support: support@researchflow.example.com
