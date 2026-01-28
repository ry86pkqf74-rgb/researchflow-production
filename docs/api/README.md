# ResearchFlow API Documentation

## Overview

This directory contains comprehensive OpenAPI 3.0 documentation for the ResearchFlow Orchestrator Service API. The documentation includes the complete API specification, detailed reference guides, and quick reference materials for developers.

## Files in This Directory

### 1. `openapi.yaml` (52 KB, 1,997 lines)
**The Complete OpenAPI 3.0 Specification**

The canonical API specification in YAML format following OpenAPI 3.0.3 standards. This file contains:
- Complete API definition with all 30+ endpoints
- Detailed request/response schemas
- Authentication and security schemes
- Server configurations
- Error handling specifications
- Examples and use cases

**Use this file for:**
- Generating interactive API documentation (Swagger UI, ReDoc)
- Auto-generating client SDK code
- Validating API implementations
- Importing into API testing tools (Postman, Insomnia)
- CI/CD pipeline integration

### 2. `OPENAPI_DOCUMENTATION.md` (15 KB, 585 lines)
**Comprehensive API Documentation Guide**

Detailed explanations of the OpenAPI specification including:
- API structure and organization
- All 5 endpoint categories with descriptions
- Request/response schemas explained
- HTTP status codes reference
- Security considerations
- Integration instructions with various tools
- Usage examples with cURL and JavaScript/TypeScript
- Endpoint coverage summary
- Future enhancement roadmap

**Use this file for:**
- Understanding the API structure
- Learning about security implementation
- Integrating with documentation tools
- Understanding authentication flows
- Planning client implementations

### 3. `QUICK_REFERENCE.md` (13 KB, 589 lines)
**Developer Quick Reference Guide**

Quick-lookup reference with:
- All endpoints organized by category
- HTTP request examples for each endpoint
- cURL command snippets
- Query parameters and filters
- Common HTTP status codes
- Error response formats
- User and organization roles
- File upload constraints
- Complete workflow examples
- Environment variable setup
- Testing tool recommendations

**Use this file for:**
- Quick endpoint lookups
- Copy-paste ready cURL commands
- Understanding request/response formats
- Complete workflow examples
- Local development setup

## API Structure

The ResearchFlow API is organized into 5 main categories with 30+ endpoints:

```
ResearchFlow API (30+ Endpoints)
├── Authentication (10 endpoints)
│   ├── POST   /auth/register
│   ├── POST   /auth/login
│   ├── POST   /auth/refresh
│   ├── POST   /auth/logout
│   ├── POST   /auth/logout-all
│   ├── GET    /auth/user
│   ├── GET    /auth/status
│   ├── POST   /auth/forgot-password
│   ├── POST   /auth/reset-password
│   └── POST   /auth/change-password
│
├── Organizations (6 endpoints)
│   ├── POST   /org
│   ├── GET    /org
│   ├── GET    /org/{orgId}
│   ├── PATCH  /org/{orgId}
│   ├── DELETE /org/{orgId}
│   └── GET    /org/{orgId}/members
│
├── Papers (11 endpoints)
│   ├── GET    /papers/ping
│   ├── GET    /papers
│   ├── GET    /papers/search
│   ├── POST   /papers/upload
│   ├── POST   /papers/import
│   ├── GET    /papers/{paperId}
│   ├── PATCH  /papers/{paperId}
│   ├── DELETE /papers/{paperId}
│   ├── POST   /papers/{paperId}/tags
│   ├── DELETE /papers/{paperId}/tags/{tag}
│   └── GET    /papers/{paperId}/text
│
├── Analysis (2 endpoints)
│   ├── POST   /analysis/extract
│   └── POST   /analysis/analyze
│
└── AI Insights (4 endpoints)
    ├── POST   /ai/research-brief
    ├── POST   /ai/evidence-gap-map
    ├── POST   /ai/study-cards
    └── POST   /ai/decision-matrix
```

## Authentication

All endpoints (except public ones) require JWT Bearer token authentication:

```
Authorization: Bearer <your-jwt-token>
```

**Public Endpoints:**
- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `GET /auth/status` - Check auth status
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password

## Quick Start

### 1. View the Specification

**Option A: Text Editor**
```bash
cat docs/api/openapi.yaml
```

**Option B: Swagger UI (Docker)**
```bash
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/docs/openapi.yaml \
  -v $(pwd)/docs/api:/docs \
  swaggerapi/swagger-ui
# Open http://localhost:8080
```

**Option C: ReDoc (Docker)**
```bash
docker run -p 8080:8080 \
  -e SPEC_URL=/docs/openapi.yaml \
  -v $(pwd)/docs/api:/docs \
  redocly/redoc
# Open http://localhost:8080
```

### 2. Generate Interactive Documentation

Using Stoplight Elements (recommended):
```bash
npm install -D @stoplight/elements

# Add to your HTML or use with a static site generator
npx elements --spec docs/api/openapi.yaml --port 3000
```

### 3. Import into Testing Tools

**Postman:**
1. Click "Import"
2. Select "Link" tab
3. Paste URL or upload `openapi.yaml`
4. Create environment with `base_url` and `token`

**Insomnia:**
1. Click "+" to create workspace
2. Import from file → select `openapi.yaml`
3. Set up JWT Bearer auth in collection

### 4. Generate Client Code

Using OpenAPI Generator:
```bash
# Install
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g typescript-fetch \
  -o src/generated

# Or using @hey-api/openapi-ts
npx @hey-api/openapi-ts -i docs/api/openapi.yaml -o src/generated
```

## Key Features

### 1. Authentication & Security
- JWT Bearer token authentication
- Refresh token rotation
- Password reset flows
- Multi-device session management
- HTTP-only secure cookies
- Audit logging for all auth events

### 2. Organization Management
- Hierarchical organization structure
- Role-based access control (OWNER, ADMIN, MEMBER)
- Team collaboration
- Member management
- Organization settings

### 3. Paper Library
- PDF upload (up to 50MB)
- Import from external sources (DOI, PMID, arXiv)
- Full-text search with filters
- Tagging system
- Reading status tracking
- User ratings and notes
- Text extraction from PDFs

### 4. Data Analysis
- Clinical data extraction
- Batch processing (1-100 cells)
- Multiple analysis types
- AI tier selection
- MeSH enrichment support
- Request tracking

### 5. AI Insights
- PICO-structured research briefs
- Evidence gap mapping
- Study proposal generation
- Decision matrix ranking
- Clinical importance scoring
- Feasibility assessment

## Common Tasks

### View API Documentation
```bash
# Quick reference (copy-paste ready)
cat docs/api/QUICK_REFERENCE.md

# Comprehensive guide
cat docs/api/OPENAPI_DOCUMENTATION.md

# Full specification
cat docs/api/openapi.yaml
```

### Test an Endpoint with cURL
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123",
    "displayName": "Test User"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123"
  }'
```

### Validate the Specification
```bash
# Install validator
npm install -D @stoplight/spectral-cli

# Validate
spectral lint docs/api/openapi.yaml

# Or with swagger-cli
npx @apidevtools/swagger-cli validate docs/api/openapi.yaml
```

### Generate TypeScript Types
```bash
# Using @hey-api/openapi-ts (recommended)
npx @hey-api/openapi-ts \
  -i docs/api/openapi.yaml \
  -o src/generated \
  -c fetch

# Generated files will include:
# - types/
# - services/
# - schemas/
```

## Endpoint Summary by Category

### Authentication (10 endpoints)
- User registration and login
- Token refresh and logout
- Password reset flows
- Session management
- Multi-device logout

### Organizations (6 endpoints)
- Create and manage organizations
- Organization settings
- Member management
- Role-based permissions

### Papers (11 endpoints)
- Upload and import papers
- Search with advanced filters
- Manage paper metadata
- Add/remove tags
- Extract text from PDFs

### Analysis (2 endpoints)
- Extract clinical data from cells
- Run various analysis types

### AI Insights (4 endpoints)
- Generate research briefs
- Map evidence gaps
- Create study proposals
- Rank proposals with decision matrix

## Technical Stack

- **Specification Format:** OpenAPI 3.0.3 (YAML)
- **Authentication:** JWT Bearer + Refresh tokens
- **Content Type:** application/json (application/octet-stream for uploads)
- **Status Codes:** Standard HTTP (200, 201, 204, 400, 401, 403, 404, 409, 413, 500)

## Integration Examples

### Express.js/Node.js Backend
```typescript
import { Router } from 'express';
import { openapi } from './openapi.yaml';

// Serve OpenAPI spec
app.get('/api/spec', (req, res) => {
  res.json(openapi);
});

// Auto-generate docs
app.use('/api/docs', swaggerUi.serve);
app.get('/api/docs', swaggerUi.setup(openapi));
```

### React Frontend
```typescript
// Generate types from spec
// npm install -D @hey-api/openapi-ts

import { AuthService, PapersService } from './generated';

// Use generated types and services
const user = await AuthService.login({
  email: 'user@example.com',
  password: 'password123'
});
```

### CI/CD Pipeline
```yaml
# .github/workflows/api-validation.yml
- name: Validate OpenAPI Spec
  run: |
    npx @stoplight/spectral-cli lint docs/api/openapi.yaml

- name: Generate Types
  run: |
    npx @hey-api/openapi-ts -i docs/api/openapi.yaml -o src/generated

- name: Build Types
  run: npx tsc --noEmit
```

## Best Practices

### When Using the API
1. **Always use HTTPS in production** - Ensure secure transmission
2. **Never expose tokens** - Keep JWT tokens in secure storage
3. **Use refresh tokens** - Don't hardcode access tokens
4. **Implement error handling** - Handle all error codes properly
5. **Add request timeouts** - Prevent hanging requests
6. **Log important events** - Track API usage for debugging
7. **Rate limit clients** - Prevent abuse and resource exhaustion
8. **Validate input** - Follow request schema validation

### When Updating the API
1. **Keep spec in sync** - Update OpenAPI spec with code changes
2. **Use semantic versioning** - Version API endpoints appropriately
3. **Provide migration path** - Deprecate endpoints gradually
4. **Document breaking changes** - Maintain changelog
5. **Validate spec** - Run validation before deployment

## Related Documentation

- **Backend Deployment:** `docs/BACKEND_DEPLOYMENT_GUIDE.md`
- **Architecture Overview:** `docs/ARCHITECTURE_OVERVIEW.md`
- **Implementation Plan:** `docs/IMPLEMENTATION_PLAN.md`
- **Contributing Guide:** `CONTRIBUTING.md`

## Support Resources

### Documentation
- OpenAPI Spec: `docs/api/openapi.yaml`
- Reference Guide: `docs/api/QUICK_REFERENCE.md`
- Full Documentation: `docs/api/OPENAPI_DOCUMENTATION.md`

### Tools
- **Swagger UI:** Interactive API documentation
- **ReDoc:** Beautiful API documentation
- **Postman:** API client for testing
- **Insomnia:** REST client with environment management

### Learning Resources
- OpenAPI 3.0 Specification: https://spec.openapis.org/oas/v3.0.3
- OpenAPI Tools: https://openapi.tools/
- JSON Schema: https://json-schema.org/

## Version Information

- **API Version:** 1.0.0
- **OpenAPI Version:** 3.0.3
- **Last Updated:** January 28, 2024
- **Endpoints Documented:** 30+
- **Specification Size:** 52 KB (1,997 lines)

## File Directory Structure

```
docs/
└── api/
    ├── README.md (this file)
    ├── openapi.yaml (complete specification)
    ├── OPENAPI_DOCUMENTATION.md (detailed guide)
    ├── QUICK_REFERENCE.md (quick lookup guide)
    └── [future: code examples, tutorials, etc.]
```

## Next Steps

1. **Review the specification:** Open `openapi.yaml` in your editor
2. **Read the quick reference:** See `QUICK_REFERENCE.md` for endpoints
3. **View detailed docs:** Read `OPENAPI_DOCUMENTATION.md` for deep dives
4. **Test endpoints:** Use Postman or cURL to test
5. **Generate code:** Create client SDK from specification
6. **Set up docs site:** Host interactive documentation

## Troubleshooting

### Invalid YAML Syntax
```bash
# Validate YAML
npx @apidevtools/swagger-cli validate docs/api/openapi.yaml
```

### Type Generation Failures
```bash
# Check OpenAPI spec version
head -5 docs/api/openapi.yaml  # Should show openapi: 3.0.3

# Try different generator
npx openapi-generator-cli generate -i docs/api/openapi.yaml -g typescript-fetch
```

### Swagger UI Not Displaying
```bash
# Check spec is valid JSON/YAML
node -e "console.log(require('js-yaml').load(require('fs').readFileSync('docs/api/openapi.yaml')))"
```

## Contributing

To update the API documentation:

1. **Update specification:** Modify `openapi.yaml` directly
2. **Update reference:** Update `QUICK_REFERENCE.md` with examples
3. **Update docs:** Update `OPENAPI_DOCUMENTATION.md` with details
4. **Validate changes:** Run spectral lint validation
5. **Test changes:** Verify with Swagger UI or ReDoc

## License

This API documentation is part of the ResearchFlow project.
See LICENSE file for details.

---

**For more information, please refer to the individual documentation files or contact the development team.**
