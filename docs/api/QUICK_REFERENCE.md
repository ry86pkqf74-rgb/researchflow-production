# ResearchFlow API - Quick Reference Guide

## Base URL
```
Production:  https://api.researchflow.io/api
Development: http://localhost:5000/api
Docker:      http://orchestrator:5000/api
```

## Authentication
All requests (except public endpoints) require JWT Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

Public endpoints:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/status`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

## Authentication Endpoints

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "displayName": "John Doe",
  "firstName": "John",
  "lastName": "Doe"
}
```
Response: `201 Created` - Returns user object + accessToken

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```
Response: `200 OK` - Returns user object + accessToken

### Get Current User
```http
GET /auth/user
Authorization: Bearer <token>
```
Response: `200 OK` - Returns user object

### Refresh Token
```http
POST /auth/refresh
Authorization: Bearer <token>
```
Response: `200 OK` - Returns new accessToken

### Logout
```http
POST /auth/logout
Authorization: Bearer <token>
```
Response: `200 OK` - Clears cookies

### Logout All Devices
```http
POST /auth/logout-all
Authorization: Bearer <token>
```
Response: `200 OK` - Revokes all tokens

## Organization Endpoints

### Create Organization
```http
POST /org
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Research Lab",
  "slug": "my-research-lab",
  "description": "Optional description",
  "billingEmail": "billing@example.com"
}
```
Response: `201 Created` - Returns organization object

### List Organizations
```http
GET /org
Authorization: Bearer <token>
```
Response: `200 OK` - Returns array of organizations

### Get Organization Details
```http
GET /org/{orgId}
Authorization: Bearer <token>
```
Response: `200 OK` - Returns organization object

### Update Organization
```http
PATCH /org/{orgId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```
Response: `200 OK` - Returns updated organization

### Delete Organization
```http
DELETE /org/{orgId}
Authorization: Bearer <token>
```
Response: `204 No Content`

### List Organization Members
```http
GET /org/{orgId}/members
Authorization: Bearer <token>
```
Response: `200 OK` - Returns array of members

## Paper Endpoints

### List Papers
```http
GET /papers?limit=20&offset=0
Authorization: Bearer <token>
```
Query Parameters:
- `limit`: 1-100 (default: 20)
- `offset`: Starting position (default: 0)
- `collectionId`: Filter by collection (optional)

Response: `200 OK` - Returns paginated papers

### Search Papers
```http
GET /papers/search?q=diabetes&sort=created_at&order=desc&limit=20
Authorization: Bearer <token>
```
Query Parameters:
- `q`: Search query
- `tags`: Array of tag names
- `yearFrom`, `yearTo`: Year range
- `readStatus`: unread|reading|read
- `sort`: created_at|title|year|rating
- `order`: asc|desc
- `limit`: 1-100
- `offset`: Starting position

Response: `200 OK` - Returns paginated search results

### Upload Paper
```http
POST /papers/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary PDF>
title: "Paper Title" (optional)
```
Response: `201 Created` - Returns paper object

### Import Paper from DOI/PMID
```http
POST /papers/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "doi": "10.1234/example.doi"
}
```
or
```json
{
  "pmid": "12345678"
}
```
Response: `201 Created` - Returns paper object

### Get Paper Details
```http
GET /papers/{paperId}
Authorization: Bearer <token>
```
Response: `200 OK` - Returns paper object

### Update Paper
```http
PATCH /papers/{paperId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "abstract": "Updated abstract",
  "year": 2024,
  "rating": 5,
  "readStatus": "read",
  "notes": "My notes"
}
```
Response: `200 OK` - Returns updated paper

### Delete Paper
```http
DELETE /papers/{paperId}
Authorization: Bearer <token>
```
Response: `204 No Content`

### Add Tag to Paper
```http
POST /papers/{paperId}/tags
Authorization: Bearer <token>
Content-Type: application/json

{
  "tag": "diabetes-research",
  "color": "#FF5733"
}
```
Response: `200 OK` - Returns paper with new tag

### Remove Tag from Paper
```http
DELETE /papers/{paperId}/tags/{tag}
Authorization: Bearer <token>
```
Response: `200 OK` - Returns paper without tag

### Get Extracted Text
```http
GET /papers/{paperId}/text
Authorization: Bearer <token>
```
Response: `200 OK` - Returns extracted text object

## Analysis Endpoints

### Extract Clinical Data
```http
POST /analysis/extract
Authorization: Bearer <token>
Content-Type: application/json

{
  "cells": [
    {
      "text": "Patient with Type 2 Diabetes",
      "metadata": {"source": "EHR"}
    }
  ],
  "parameters": {
    "extract_diagnoses": true,
    "extract_procedures": true,
    "extract_medications": true,
    "extract_labs": true,
    "batch_concurrency": 5,
    "forceTier": null
  },
  "researchId": "optional-id",
  "jobId": "optional-job-id"
}
```
Response: `200 OK` - Returns extraction results

### Run Analysis
```http
POST /analysis/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "analysisType": "statistical",
  "data": {...},
  "parameters": {...},
  "researchId": "optional-id"
}
```
Analysis Types: exploratory|statistical|correlation|distribution|regression|clustering|clinical_extraction

Response: `200 OK` - Returns analysis results

## AI Insights Endpoints

### Generate Research Brief
```http
POST /ai/research-brief
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "Impact of telemedicine on diabetes management in rural areas",
  "population": "Rural adults with Type 2 Diabetes",
  "outcomes": ["HbA1c reduction", "medication adherence"]
}
```
Response: `200 OK` - Returns PICO-structured research brief

### Generate Evidence Gap Map
```http
POST /ai/evidence-gap-map
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "Telemedicine in diabetes management",
  "population": "Rural populations",
  "outcomes": ["clinical outcomes", "patient satisfaction"]
}
```
Response: `200 OK` - Returns evidence gap analysis

### Generate Study Proposals
```http
POST /ai/study-cards
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "Telemedicine in diabetes management",
  "researchBrief": {...},
  "count": 7
}
```
Count: 3-10 (default: 7)

Response: `200 OK` - Returns array of study cards

### Generate Decision Matrix
```http
POST /ai/decision-matrix
Authorization: Bearer <token>
Content-Type: application/json

{
  "studyCards": [
    {
      "id": 1,
      "title": "Study 1",
      ...
    }
  ]
}
```
Response: `200 OK` - Returns ranked proposals with recommendations

## Common HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 413 | Payload Too Large | File too large (max 50MB) |
| 500 | Server Error | Internal server error |

## Error Response Format

```json
{
  "error": "Validation failed",
  "details": {
    "field": "message"
  },
  "code": "VALIDATION_ERROR",
  "request_id": "req-uuid"
}
```

## Common Request Headers

```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
Accept: application/json
User-Agent: MyApp/1.0
```

## Common Response Headers

```http
Content-Type: application/json
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
Cache-Control: no-cache, no-store, must-revalidate
```

## User Roles

- **ADMIN** - System administrator, full access
- **RESEARCHER** - Can create and manage papers, organizations
- **VIEWER** - Read-only access

## Organization Roles

- **OWNER** - Can manage org, delete org, all permissions
- **ADMIN** - Can manage org settings and members
- **MEMBER** - Can access org resources

## Pagination

All list endpoints use offset/limit pagination:

```
?limit=20&offset=0  # First 20 items
?limit=20&offset=20 # Next 20 items
?limit=20&offset=40 # And so on...
```

Maximum limit: 100
Default limit: 20

## Rate Limiting

Recommended per-endpoint rate limits:
- Authentication: 5 requests/minute per IP
- Search: 100 requests/minute per user
- Upload: 10 requests/minute per user
- Analysis: 20 requests/minute per user
- General: 100 requests/minute per user

## File Upload Constraints

- **Max file size:** 50MB
- **Allowed types:** PDF only
- **Endpoint:** `POST /papers/upload`
- **Content-Type:** multipart/form-data

## Example Workflows

### Complete Registration & Upload Paper

```bash
# 1. Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "researcher@example.com",
    "password": "SecurePassword123",
    "displayName": "Dr. Smith"
  }' > auth.json

# Extract token
TOKEN=$(jq -r '.accessToken' auth.json)

# 2. Create organization
curl -X POST http://localhost:5000/api/org \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research Lab",
    "slug": "research-lab"
  }' > org.json

# 3. Upload paper
curl -X POST http://localhost:5000/api/papers/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@research.pdf" \
  -F "title=My Research Paper"

# 4. Search papers
curl -X GET "http://localhost:5000/api/papers/search?q=diabetes&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Generate Research Insights

```bash
# Generate research brief
curl -X POST http://localhost:5000/api/ai/research-brief \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Telemedicine in diabetes management",
    "population": "Rural populations"
  }' > brief.json

# Generate study cards
curl -X POST http://localhost:5000/api/ai/study-cards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Telemedicine in diabetes management",
    "count": 7
  }' > cards.json

# Generate decision matrix
curl -X POST http://localhost:5000/api/ai/decision-matrix \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studyCards\": $(jq '.studyCards' cards.json)
  }" > matrix.json
```

## Environment Variables

For local development:

```bash
# API Server
API_URL=http://localhost:5000/api
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# File Uploads
PAPER_UPLOAD_DIR=/app/uploads/papers
MAX_FILE_SIZE=52428800  # 50MB in bytes

# Database
DATABASE_URL=postgresql://user:pass@localhost/researchflow

# Worker Service
WORKER_URL=http://worker:8000
```

## Testing with Postman

1. Import `docs/api/openapi.yaml` into Postman
2. Create a new environment with:
   - `base_url`: http://localhost:5000/api
   - `token`: (leave empty initially)
3. In Auth Tests:
   - Call `/auth/login` or `/auth/register`
   - Extract token using `pm.environment.set("token", responseData.accessToken)`
4. All subsequent requests will use the token automatically

## Useful Tools

- **Swagger UI:** View/test API interactively
- **Postman:** API client for testing
- **cURL:** Command-line HTTP client
- **Insomnia:** REST API client
- **Thunder Client:** VS Code API client
- **REST Client:** VS Code extension

## Documentation Files

- `docs/api/openapi.yaml` - Full OpenAPI specification
- `docs/api/OPENAPI_DOCUMENTATION.md` - Detailed documentation
- `docs/api/QUICK_REFERENCE.md` - This file
- `docs/BACKEND_DEPLOYMENT_GUIDE.md` - Deployment instructions

## Support & Contact

For API support:
- Email: api-support@researchflow.io
- Documentation: https://researchflow.io/docs
- Issues: https://github.com/researchflow/issues

## Version History

- **1.0.0** (2024-01-28) - Initial OpenAPI specification
  - 30+ core endpoints
  - 5 main categories
  - Full authentication flows
  - Organization management
  - Paper library
  - Analysis operations
  - AI insights generation
