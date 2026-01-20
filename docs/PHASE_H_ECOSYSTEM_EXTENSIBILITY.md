# Phase H: Ecosystem & Extensibility

## Overview

Phase H (Tasks 136-150) implements ecosystem integrations, extensibility frameworks, and developer-focused features that enable third-party integrations and community contributions to ResearchFlow Canvas.

## Features Implemented

### Task 136: Interactive API Documentation (Swagger/OpenAPI)

**Service:** `openApiService.ts`
**Route:** `/api/help/api`, `/api/help/openapi.json`

- Generates OpenAPI 3.0.3 specification dynamically
- Serves Swagger UI at `/api/help/api`
- Supports multiple export formats (JSON, YAML)
- Includes security scheme documentation (Bearer JWT)
- Auto-registers routes with descriptions

```typescript
// Register a route in the OpenAPI spec
registerRoute({
  path: '/api/research/{id}',
  method: 'GET',
  summary: 'Get research project',
  description: 'Retrieve a research project by ID',
  tags: ['Research'],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: { '200': { description: 'Success' } },
});
```

### Task 137: Plugin Marketplace

**Service:** `pluginMarketplaceService.ts`
**Route:** `/api/plugins`

- Full plugin lifecycle management (install, enable, disable, uninstall)
- Permission-based plugin system with scopes:
  - `STAGE_EXTENSION` - Extend workflow stages
  - `AI_MODEL_PROVIDER` - Provide AI models
  - `IMPORT_CONNECTOR` - Data import sources
  - `EXPORT_CONNECTOR` - Export destinations
  - `ANALYSIS_TOOL` - Analysis capabilities
  - `VISUALIZATION` - Visualization widgets
  - `NOTIFICATION_HANDLER` - Custom notifications
  - `WEBHOOK_HANDLER` - Webhook processing
- Plugin verification and integrity checking (SHA-256)
- Audit logging for all plugin actions
- Category-based browsing

```typescript
// Install a plugin
const installation = installPlugin('stat-analysis-plugin', tenantId, userId, {
  apiKey: 'optional-config-value',
});
```

### Task 138: API Key Rotation

**Service:** `apiKeyRotationService.ts`
**Route:** `/api/profile/api-keys`

- Complete API key lifecycle management
- Automatic rotation reminders based on configurable intervals
- Scope-based permissions:
  - `READ`, `WRITE`, `ADMIN`
  - `RESEARCH_READ`, `RESEARCH_WRITE`
  - `ARTIFACT_READ`, `ARTIFACT_WRITE`
  - `WORKFLOW_EXECUTE`, `EXPORT`
- Key history and audit trail
- Expiration tracking with urgency levels

```typescript
// Create an API key
const { key, secretKey } = createApiKey({
  userId: 'user-123',
  tenantId: 'tenant-abc',
  label: 'Production API Key',
  scopes: ['READ', 'WORKFLOW_EXECUTE'],
  rotationIntervalDays: 90,
  expiresInDays: 365,
});

// Get rotation reminders
const reminders = getRotationReminders({ userId: 'user-123', daysThreshold: 14 });
```

### Task 139: Overleaf Integration

**Service:** `overleafService.ts`
**Route:** `/api/integrations/overleaf`

- Export manuscripts to Overleaf-compatible ZIP format
- LaTeX generation with configurable document classes
- BibTeX reference export
- Figure and table management
- Multiple template support (article, report, book, letter, beamer)
- Version tracking for export history

```typescript
// Export to Overleaf format
const package = generateOverleafPackage(manuscript, {
  manuscriptId: 'ms-123',
  documentClass: 'article',
  includeBibliography: true,
  includeFigures: true,
  includeAppendices: true,
});
```

### Task 140: Community Links & Help Center

**Service:** `communityService.ts`
**Route:** `/api/help`

- Community link management (GitHub, Discord, Twitter)
- Contribution guide system
- Footer section configuration
- Help center settings
- Pre-populated guides:
  - Getting Started
  - Code of Conduct
  - Contributing Guide
  - Security Policy
  - Development Setup
  - Architecture Overview

### Task 141: Custom AI Model Hooks

**Service:** `aiProviderService.ts`
**Route:** `/api/ai`

- Multi-provider AI model abstraction
- Built-in providers: Anthropic, OpenAI, Together AI, Cohere
- Custom provider registration
- Unified invoke interface for:
  - Text generation
  - Chat completions
  - Embeddings
- Provider configuration per tenant
- Automatic fallback handling

```typescript
// Invoke an AI model
const response = await invoke(tenantId, {
  model: 'claude-3-sonnet',
  messages: [{ role: 'user', content: 'Summarize this research...' }],
  maxTokens: 1000,
  temperature: 0.7,
});
```

### Task 142: Workflow Templates Gallery

**Note:** Partially pre-existing. Enhanced with template metadata and discoverability.

### Task 143: Git Sync Integration

**Service:** `gitSyncService.ts`
**Route:** `/api/integrations/git`

- Multi-provider support:
  - GitHub
  - GitLab
  - Bitbucket
  - Azure DevOps
  - Custom Git servers
- Automatic sync on publish
- Branch management
- Sync history tracking
- Connection testing
- Artifact-to-file conversion

```typescript
// Create a Git integration
const integration = createIntegration({
  projectId: 'proj-123',
  tenantId: 'tenant-abc',
  provider: 'GITHUB',
  repoUrl: 'https://github.com/org/research-repo',
  accessToken: 'ghp_xxx',
  defaultBranch: 'main',
  autoSync: true,
  syncOnPublish: true,
});

// Sync to repository
const result = await syncToRepository(integrationId, files, {
  branch: 'main',
  commitMessage: 'Update research artifacts',
});
```

### Task 144: Data Import Wizards

**Service:** `dataImportService.ts`
**Route:** `/api/integrations/import`

- Multi-source import support:
  - CSV files
  - Excel spreadsheets (XLSX, XLS)
  - JSON files
  - REDCap API
  - Amazon S3
  - SQL databases
- Schema detection and preview
- PHI detection with pattern matching:
  - SSN, MRN, DOB
  - Email, Phone, Name, Address
- Column mapping and transformation
- Import job management (create, execute, cancel)

```typescript
// Preview a data source
const preview = await previewSource('CSV', {
  content: csvData,
}, {
  detectPhi: true,
});

// Create and execute import job
const job = createImportJob({
  name: 'Patient Data Import',
  sourceType: 'CSV',
  sourceConfig: { content: csvData },
  targetType: 'NEW_DATASET',
  columnMapping: {
    'patient_id': { targetColumn: 'id', transform: 'TO_STRING' },
    'age': { targetColumn: 'patient_age', transform: 'TO_NUMBER' },
  },
}, userId, tenantId);

await executeImport(job.id);
```

### Task 145: Tutorial Code Sandboxes

**Service:** `tutorialSandboxService.ts`
**Route:** `/api/tutorials/sandbox`

- Interactive code execution for tutorials
- Language support: Python, JavaScript, R, SQL
- Execution timeout limits
- User progress tracking
- Demo datasets for practice
- Sample tutorials with executable snippets

```typescript
// Execute code in sandbox
const result = await executeCode({
  tutorialId: 'data-loading-basics',
  snippetId: 'load-csv',
  code: 'import pandas as pd\ndf = pd.read_csv("sample.csv")',
  userId: 'user-123',
});
```

### Task 146: Partner Badges

**Note:** Partially pre-existing with organization badges.

### Task 147: Open-Source Contribution Guides

Integrated into Community Service (Task 140).

### Task 148: Feedback Analytics

**Note:** Partially pre-existing. Enhanced with session tracking and AI-specific metrics.

### Task 149: Scientific Notation Localization

**Service:** `scientificNotationService.ts`

- Multiple formatting styles:
  - Scientific (1.23 × 10⁶)
  - Engineering (1.23 × 10⁶ with powers of 3)
  - E-notation (1.23e6)
  - Plain (1,234,567)
  - SI prefix (1.23 M)
  - LaTeX (1.23 \\times 10^{6})
- Unit conversion with SI prefixes
- Locale-aware formatting (decimal/thousands separators)
- Scientific notation parsing

```typescript
// Format a number
const formatted = formatScientific(1234567, {
  style: 'SCIENTIFIC',
  precision: 2,
});

// Format with unit and SI prefix
const withUnit = formatWithUnit(1500, 'm', { style: 'SI_PREFIX' }); // "1.5 km"

// Convert units
const kilometers = convertUnit(1500, 'm', 'km'); // 1.5
```

### Task 150: Future-Proofing Checklists

**Service:** `futureProofingService.ts`
**Route:** `/api/admin/upgrades`

- Upgrade checklists by version range
- Check categories:
  - Database migrations
  - API compatibility
  - Security patches
  - Dependencies
  - Configuration changes
  - Data migrations
  - Plugin compatibility
  - Performance benchmarks
  - Documentation updates
- Automated check execution
- Deprecation notice management
- API version lifecycle (current → deprecated → sunset)

```typescript
// Create upgrade checklist
const checklist = createUpgradeChecklist('1.0.0', '2.0.0', 'admin-user');

// Run automated checks
const results = await runAutomatedChecks(checklist.id, 'admin-user');

// Create deprecation notice
const notice = createDeprecationNotice({
  feature: 'legacyEndpoint',
  deprecatedIn: '2.0.0',
  removedIn: '3.0.0',
  reason: 'Replaced by new API',
  migration: 'Use /api/v2/endpoint instead',
  documentationUrl: 'https://docs.example.com/migration',
});
```

## API Endpoints Summary

### Help & Documentation
- `GET /api/help/api` - Swagger UI
- `GET /api/help/openapi.json` - OpenAPI spec (JSON)
- `GET /api/help/openapi.yaml` - OpenAPI spec (YAML)
- `GET /api/help/community` - Community links
- `GET /api/help/contributing` - Contribution guides

### Plugins
- `GET /api/plugins` - List available plugins
- `POST /api/plugins/install` - Install a plugin
- `DELETE /api/plugins/:id/uninstall` - Uninstall a plugin
- `POST /api/plugins/:id/enable` - Enable a plugin
- `POST /api/plugins/:id/disable` - Disable a plugin

### AI Providers
- `GET /api/ai/providers` - List AI providers
- `POST /api/ai/providers` - Register custom provider
- `POST /api/ai/invoke` - Invoke AI model
- `POST /api/ai/chat` - Chat completion
- `POST /api/ai/embeddings` - Generate embeddings

### Integrations
- `POST /api/integrations/overleaf/export` - Export to Overleaf
- `GET /api/integrations/git` - List Git integrations
- `POST /api/integrations/git` - Create Git integration
- `POST /api/integrations/git/:id/sync` - Sync to Git
- `POST /api/integrations/import/preview` - Preview import source
- `POST /api/integrations/import/jobs` - Create import job
- `POST /api/integrations/import/jobs/:id/execute` - Execute import

### API Keys
- `GET /api/profile/api-keys` - List user's API keys
- `POST /api/profile/api-keys` - Create API key
- `POST /api/profile/api-keys/:id/rotate` - Rotate key
- `POST /api/profile/api-keys/:id/revoke` - Revoke key
- `GET /api/profile/api-keys/reminders` - Get rotation reminders

### Tutorial Sandboxes
- `GET /api/tutorials/sandbox` - List tutorials
- `GET /api/tutorials/sandbox/:id` - Get tutorial
- `POST /api/tutorials/sandbox/:tutorialId/snippets/:snippetId/execute` - Execute code
- `GET /api/tutorials/sandbox/progress/me` - Get user progress

### Future-Proofing
- `GET /api/admin/upgrades/checklists` - List checklists
- `POST /api/admin/upgrades/checklists` - Create checklist
- `POST /api/admin/upgrades/checklists/:id/run-automated` - Run checks
- `POST /api/admin/upgrades/checklists/:id/approve` - Approve checklist
- `GET /api/admin/upgrades/deprecations` - List deprecations
- `GET /api/admin/upgrades/api-versions` - List API versions

## Security Considerations

1. **Plugin Sandboxing**: Plugins run with limited permissions based on their manifest
2. **PHI Detection**: Data imports are scanned for PHI patterns before processing
3. **API Key Security**: Keys are hashed using SHA-256, only shown once at creation
4. **Token Encryption**: AI provider tokens are encrypted at rest (in production)
5. **Audit Logging**: All sensitive operations are logged for compliance

## Testing

Tests are located in `services/orchestrator/src/services/__tests__/`:
- `pluginMarketplaceService.test.ts`
- `apiKeyRotationService.test.ts`
- `scientificNotationService.test.ts`
- `dataImportService.test.ts`
- `futureProofingService.test.ts`

Run tests with:
```bash
npm test -- --grep "Phase H"
```

## Migration Notes

All Phase H services use in-memory storage for development. For production deployment:

1. Migrate storage to PostgreSQL using Drizzle ORM
2. Add database migrations for new tables:
   - `plugins`, `plugin_installations`, `plugin_audit_log`
   - `api_keys`, `api_key_history`
   - `git_integrations`, `git_sync_history`
   - `import_jobs`
   - `upgrade_checklists`, `deprecation_notices`, `api_versions`
3. Configure external service credentials (GitHub, GitLab, etc.)
4. Set up AI provider API keys in environment variables
