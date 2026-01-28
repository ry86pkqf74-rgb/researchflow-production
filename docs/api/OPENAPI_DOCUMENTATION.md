# OpenAPI 3.0 Documentation - ResearchFlow API

## Overview

A comprehensive OpenAPI 3.0 specification has been created for the ResearchFlow Orchestrator Service API. This document serves as a reference guide for the generated `openapi.yaml` specification.

**File Location:** `/docs/api/openapi.yaml`

## Specification Details

### API Information
- **Title:** ResearchFlow API
- **Version:** 1.0.0
- **Specification Version:** OpenAPI 3.0.3
- **Base Path:** `/api`

### Server Configurations
The specification includes three server configurations:
1. **Production:** `https://api.researchflow.io/api`
2. **Development:** `http://localhost:5000/api`
3. **Docker:** `http://orchestrator:5000/api`

### Authentication Schemes
Two security schemes are defined:
- **BearerAuth (JWT):** HTTP Bearer token authentication
  - Format: `Authorization: Bearer <jwt-token>`
  - Token validity: 1 hour
  - Refresh tokens: 7 days (HTTP-only cookie)

- **CookieAuth:** HTTP-only cookie for refresh tokens
  - Cookie name: `refreshToken`
  - Secure flag enabled in production
  - SameSite strict policy

## API Structure

### 5 Main Endpoint Categories

#### 1. Authentication (`/api/auth/*`)
User authentication and session management endpoints.

**Endpoints:**
- `POST /auth/register` - Create new user account
- `POST /auth/login` - Login with credentials
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout from current device
- `POST /auth/logout-all` - Logout from all devices
- `GET /auth/user` - Get current user profile
- `GET /auth/status` - Check authentication status (public)
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- `POST /auth/change-password` - Change password (authenticated)

**Key Features:**
- JWT-based authentication
- Refresh token rotation
- Password reset flow with email verification
- Multi-device session management
- Audit logging for all auth events

#### 2. Organizations (`/api/org/*`)
Organization management and team collaboration endpoints.

**Endpoints:**
- `POST /org` - Create new organization
- `GET /org` - List user's organizations
- `GET /org/{orgId}` - Get organization details
- `PATCH /org/{orgId}` - Update organization (admin)
- `DELETE /org/{orgId}` - Delete organization (owner)
- `GET /org/{orgId}/members` - List organization members

**Key Features:**
- Role-based access control (OWNER, ADMIN, MEMBER)
- Organization hierarchy
- Member management
- Subscription tier tracking
- Settings and configuration per organization

#### 3. Papers (`/api/papers/*`)
Research paper library and annotation management endpoints.

**Endpoints:**
- `GET /papers/ping` - Health check
- `GET /papers` - List user's papers (paginated)
- `GET /papers/search` - Full-text search with advanced filters
- `POST /papers/upload` - Upload PDF (max 50MB)
- `POST /papers/import` - Import from DOI/PMID/arXiv
- `GET /papers/{paperId}` - Get paper details
- `PATCH /papers/{paperId}` - Update paper metadata
- `DELETE /papers/{paperId}` - Delete paper
- `POST /papers/{paperId}/tags` - Add tag to paper
- `DELETE /papers/{paperId}/tags/{tag}` - Remove tag
- `GET /papers/{paperId}/text` - Extract and retrieve text

**Search Filters:**
- Query text search
- Filter by tags, year range, read status
- Multiple sort options (created_at, title, year, rating)
- Pagination (limit: 1-100, offset)
- Collection filtering

**Paper Metadata:**
- Title, abstract, authors, year
- Journal, DOI, PMID, arXiv ID
- Read status (unread/reading/read)
- User rating (1-5)
- Custom notes and tags

#### 4. Analysis (`/api/analysis/*`)
Data extraction and statistical analysis endpoints.

**Endpoints:**
- `POST /analysis/extract` - Extract clinical data from cells
- `POST /analysis/analyze` - Run analysis on data

**Extraction Features:**
- Batch processing (1-100 cells per request)
- Configurable extraction parameters:
  - Extract diagnoses, procedures, medications, labs
  - MeSH enrichment support
  - Batch concurrency control (1-20)
  - AI tier selection (NANO/MINI/FRONTIER)
- Research/job ID tracking
- Response includes processing time

**Analysis Types:**
- Exploratory analysis
- Statistical analysis
- Correlation analysis
- Distribution analysis
- Regression analysis
- Clustering analysis
- Clinical extraction

#### 5. AI Insights (`/api/ai/*`)
AI-powered research insights and recommendations.

**Endpoints:**
- `POST /ai/research-brief` - Generate PICO-structured brief
- `POST /ai/evidence-gap-map` - Analyze research landscape
- `POST /ai/study-cards` - Generate study proposals (3-10)
- `POST /ai/decision-matrix` - Rank proposals

**Research Brief Output:**
- PICO structure (Population, Intervention, Comparator, Outcomes)
- Timeframe specification
- Study objectives
- Clarifying prompts for refinement

**Evidence Gap Map Output:**
- Known findings with evidence levels
- Unknown gaps with importance ratings
- Methodological approaches
- Potential pitfalls and mitigations

**Study Cards Output:**
- Multiple proposal cards (3-10)
- Research question and hypothesis
- Planned methods
- Cohort definitions
- Feasibility scoring
- Threats to validity
- Target journal recommendations

**Decision Matrix Output:**
- Recommended pick (study ID)
- Reasoning
- Ranked proposals with scores:
  - Novelty score
  - Feasibility score
  - Clinical importance score
  - Time to execute estimate
  - Overall score

## Common Response Schemas

### Success Responses
```json
{
  "message": "Operation successful",
  "data": { /* operation-specific data */ }
}
```

### Error Responses
```json
{
  "error": "Error message",
  "details": { /* additional context */ },
  "code": "ERROR_CODE",
  "request_id": "correlation-id"
}
```

### Paginated Responses
```json
{
  "data": [ /* array of items */ ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

## HTTP Status Codes

| Code | Meaning | Use Cases |
|------|---------|-----------|
| 200 | OK | Successful GET, PATCH operations |
| 201 | Created | Successful POST operations |
| 204 | No Content | Successful DELETE operations |
| 400 | Bad Request | Validation failures, malformed requests |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (e.g., slug taken) |
| 413 | Payload Too Large | File upload exceeds limit |
| 500 | Internal Error | Server errors |

## Request/Response Examples

### Authentication Flow

**Register:**
```
POST /auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "displayName": "John Doe"
}
```

**Login:**
```
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "RESEARCHER"
  },
  "accessToken": "jwt-token"
}
```

### Paper Upload

**Request:**
```
POST /papers/upload
Content-Type: multipart/form-data

file: <binary PDF data>
title: "Research Paper Title"
```

**Response:**
```json
{
  "id": "paper-uuid",
  "title": "Research Paper Title",
  "fileUrl": "https://...",
  "createdAt": "2024-01-28T12:00:00Z"
}
```

### Extract Clinical Data

**Request:**
```
POST /analysis/extract
{
  "cells": [
    {
      "text": "Patient diagnosed with Type 2 Diabetes Mellitus",
      "metadata": { "source": "EHR" }
    }
  ],
  "parameters": {
    "extract_diagnoses": true,
    "extract_procedures": true,
    "batch_concurrency": 5
  }
}
```

**Response:**
```json
{
  "requestId": "request-uuid",
  "results": [
    {
      "text": "Patient diagnosed with Type 2 Diabetes Mellitus",
      "extractions": {
        "diagnoses": [
          {
            "text": "Type 2 Diabetes Mellitus",
            "code": "E11",
            "confidence": 0.95
          }
        ]
      }
    }
  ],
  "processingTime": 234
}
```

### Generate Research Brief

**Request:**
```
POST /ai/research-brief
{
  "topic": "Impact of telemedicine on diabetes management outcomes in rural populations",
  "population": "Rural adults with Type 2 Diabetes",
  "outcomes": ["HbA1c levels", "medication adherence", "healthcare access"]
}
```

**Response:**
```json
{
  "population": "Rural adults with Type 2 Diabetes",
  "exposure": "Telemedicine intervention",
  "comparator": "Standard in-person care",
  "outcomes": ["HbA1c reduction", "improved adherence", "increased access"],
  "timeframe": "12 months",
  "studyObjectives": [
    "Evaluate effectiveness of telemedicine on HbA1c control",
    "Assess patient satisfaction and adherence rates"
  ],
  "clarifyingPrompts": [
    "What is the definition of rural in this context?",
    "Are we including type 1 diabetes patients?"
  ]
}
```

## Security Considerations

### Authentication
- All endpoints (except public ones) require JWT Bearer token
- Tokens expire after 1 hour
- Refresh tokens stored in HTTP-only secure cookies
- Password reset tokens valid for 1 hour

### Authorization
- Role-based access control (RBAC)
- Organization-level permissions
- Permission checks on sensitive operations:
  - Organization deletion (OWNER only)
  - Admin operations (ORG_ADMIN+ required)

### Data Protection
- Sensitive data encrypted in transit (HTTPS)
- No sensitive data in URLs
- HTTP-only cookies prevent XSS attacks
- SameSite strict policy prevents CSRF
- Audit logging for all authentication events

### Rate Limiting
- Per-endpoint rate limiting recommended
- Batch operations support concurrency parameters
- File upload size limits (50MB max)

## OpenAPI Tools Integration

The specification can be used with various tools:

### Documentation Generation
- **Swagger UI:** `https://swagger.io/tools/swagger-ui/`
- **ReDoc:** `https://redoc.ly/`
- **DapperDox:** Generates beautiful documentation
- **Stoplight Elements:** Component-based documentation

### Code Generation
- **OpenAPI Generator:** Generate client/server code
- **Swagger Codegen:** Official code generation
- **Speakeasy:** Modern SDK generation

### Testing & Validation
- **Postman:** Import and test API
- **Insomnia:** API client testing
- **Prism:** Mock server for development
- **Dredd:** API testing framework

### CI/CD Integration
```bash
# Validate specification
npx @stoplight/spectral lint docs/api/openapi.yaml

# Generate types
npx @hey-api/openapi-ts -i docs/api/openapi.yaml -o generated

# Generate client
openapi-generator-cli generate -i docs/api/openapi.yaml -g typescript-fetch -o generated-client
```

## Usage Examples

### With cURL
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Upload paper
curl -X POST http://localhost:5000/api/papers/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@paper.pdf" \
  -F "title=My Research Paper"

# Extract data
curl -X POST http://localhost:5000/api/analysis/extract \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cells": [{"text": "Patient with diabetes"}],
    "parameters": {"extract_diagnoses": true}
  }'
```

### With JavaScript/TypeScript
```typescript
// Authenticate
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { accessToken } = await loginResponse.json();

// Upload paper
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('title', 'My Research Paper');

const uploadResponse = await fetch('/api/papers/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: formData
});

// Generate research brief
const briefResponse = await fetch('/api/ai/research-brief', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    topic: 'Telemedicine in diabetes management'
  })
});
```

## Endpoint Coverage

The OpenAPI specification documents **30+ core endpoints** across **5 main categories**:

### By Category
- **Authentication:** 10 endpoints
- **Organizations:** 6 endpoints
- **Papers:** 11 endpoints
- **Analysis:** 2 endpoints
- **AI Insights:** 4 endpoints

### Coverage
- ✅ All authentication flows (register, login, password reset, multi-device logout)
- ✅ Full organization management (create, read, update, delete, member listing)
- ✅ Complete paper library (upload, import, search, metadata management, tagging)
- ✅ Data extraction and analysis operations
- ✅ AI-powered insights generation
- ✅ Request validation schemas
- ✅ Response schemas with examples
- ✅ Error handling and status codes
- ✅ Security and authentication requirements

## Future Enhancements

Potential endpoints not yet documented (for future phases):
- Paper annotations (`/api/papers/{paperId}/annotations/*`)
- Paper copilot features (`/api/papers/{paperId}/copilot/*`)
- Project management (`/api/projects/*`)
- Workflow management (`/api/workflows/*`)
- Collections management (`/api/collections/*`)
- Governance and peer review (`/api/governance/*`)
- Manuscript management (`/api/manuscripts/*`)
- Advanced collaboration features

## File Information

- **File:** `docs/api/openapi.yaml`
- **Size:** ~52KB
- **Format:** YAML
- **Version:** OpenAPI 3.0.3
- **Last Updated:** January 28, 2024

## Validation

To validate the OpenAPI specification:

```bash
# Using Spectral
npm install -D @stoplight/spectral-cli
spectral lint docs/api/openapi.yaml

# Using swagger-cli
npm install -g swagger-cli
swagger-cli validate docs/api/openapi.yaml
```

## Integration with Documentation Sites

### Swagger UI Hosting
```bash
# Docker
docker run -p 80:8080 \
  -e SWAGGER_JSON=/docs/openapi.yaml \
  -v $(pwd)/docs/api:/docs \
  swaggerapi/swagger-ui
```

### ReDoc Hosting
```html
<html>
  <head>
    <title>ResearchFlow API Docs</title>
    <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
  </head>
  <body>
    <redoc spec-url='/docs/api/openapi.yaml'></redoc>
  </body>
</html>
```

## Quick Start

1. **View the specification:**
   - Open `docs/api/openapi.yaml` in any text editor

2. **Generate interactive documentation:**
   ```bash
   npm install -D @stoplight/elements
   # Use with your documentation generator
   ```

3. **Test endpoints:**
   - Import into Postman/Insomnia
   - Use Swagger UI or ReDoc for interactive docs

4. **Generate client code:**
   ```bash
   npx @hey-api/openapi-ts -i docs/api/openapi.yaml -o src/generated
   ```

## Support & References

- OpenAPI Specification: https://spec.openapis.org/oas/v3.0.3
- OpenAPI Tooling: https://openapi.tools/
- ResearchFlow Documentation: See `docs/` directory
- Backend Guide: See `docs/BACKEND_DEPLOYMENT_GUIDE.md`
