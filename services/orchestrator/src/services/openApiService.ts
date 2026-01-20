/**
 * OpenAPI/Swagger Service
 * Task 136 - Interactive API docs using Swagger in help sections
 *
 * Generates OpenAPI 3.0 specification from registered routes
 * with full schema definitions and examples
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export const OpenApiInfoSchema = z.object({
  title: z.string(),
  version: z.string(),
  description: z.string().optional(),
  contact: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
  }).optional(),
  license: z.object({
    name: z.string(),
    url: z.string().url().optional(),
  }).optional(),
});

export const OpenApiServerSchema = z.object({
  url: z.string(),
  description: z.string().optional(),
});

export const OpenApiTagSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const OpenApiParameterSchema = z.object({
  name: z.string(),
  in: z.enum(['query', 'header', 'path', 'cookie']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  schema: z.record(z.unknown()),
});

export const OpenApiResponseSchema = z.object({
  description: z.string(),
  content: z.record(z.object({
    schema: z.record(z.unknown()),
    examples: z.record(z.unknown()).optional(),
  })).optional(),
});

export const OpenApiOperationSchema = z.object({
  operationId: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  parameters: z.array(OpenApiParameterSchema).optional(),
  requestBody: z.object({
    description: z.string().optional(),
    required: z.boolean().optional(),
    content: z.record(z.object({
      schema: z.record(z.unknown()),
      examples: z.record(z.unknown()).optional(),
    })),
  }).optional(),
  responses: z.record(OpenApiResponseSchema),
  security: z.array(z.record(z.array(z.string()))).optional(),
  deprecated: z.boolean().optional(),
});

export type OpenApiInfo = z.infer<typeof OpenApiInfoSchema>;
export type OpenApiServer = z.infer<typeof OpenApiServerSchema>;
export type OpenApiTag = z.infer<typeof OpenApiTagSchema>;
export type OpenApiOperation = z.infer<typeof OpenApiOperationSchema>;

interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  operation: OpenApiOperation;
}

// ─────────────────────────────────────────────────────────────
// OpenAPI Document Store
// ─────────────────────────────────────────────────────────────

const routes: RouteDefinition[] = [];
const schemas: Map<string, Record<string, unknown>> = new Map();

// ─────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────

export function registerRoute(definition: RouteDefinition): void {
  routes.push(definition);
}

export function registerSchema(name: string, schema: Record<string, unknown>): void {
  schemas.set(name, schema);
}

// ─────────────────────────────────────────────────────────────
// Pre-registered Routes for ResearchFlow
// ─────────────────────────────────────────────────────────────

function registerCoreRoutes(): void {
  // Auth routes
  registerRoute({
    method: 'post',
    path: '/api/auth/login',
    operation: {
      operationId: 'authLogin',
      summary: 'Authenticate user',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                  user: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
        '401': { description: 'Invalid credentials' },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/auth/logout',
    operation: {
      operationId: 'authLogout',
      summary: 'Logout user',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Logout successful' },
      },
    },
  });

  // Research routes
  registerRoute({
    method: 'get',
    path: '/api/research',
    operation: {
      operationId: 'listResearch',
      summary: 'List all research projects',
      tags: ['Research'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] } },
      ],
      responses: {
        '200': {
          description: 'List of research projects',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: { type: 'array', items: { $ref: '#/components/schemas/Research' } },
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/research',
    operation: {
      operationId: 'createResearch',
      summary: 'Create a new research project',
      tags: ['Research'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateResearchInput' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Research project created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Research' },
            },
          },
        },
        '400': { description: 'Invalid input' },
      },
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/research/{id}',
    operation: {
      operationId: 'getResearch',
      summary: 'Get a research project by ID',
      tags: ['Research'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Research project details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Research' },
            },
          },
        },
        '404': { description: 'Research not found' },
      },
    },
  });

  // Artifacts routes
  registerRoute({
    method: 'get',
    path: '/api/artifacts',
    operation: {
      operationId: 'listArtifacts',
      summary: 'List artifacts for a research project',
      tags: ['Artifacts'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'researchId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['DATASET', 'CODE', 'FIGURE', 'TABLE', 'DOCUMENT', 'MODEL'] } },
      ],
      responses: {
        '200': {
          description: 'List of artifacts',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Artifact' },
              },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/artifacts',
    operation: {
      operationId: 'createArtifact',
      summary: 'Create a new artifact',
      tags: ['Artifacts'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateArtifactInput' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Artifact created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Artifact' },
            },
          },
        },
      },
    },
  });

  // Workflows routes
  registerRoute({
    method: 'get',
    path: '/api/workflows/templates',
    operation: {
      operationId: 'listWorkflowTemplates',
      summary: 'List available workflow templates',
      tags: ['Workflows'],
      parameters: [
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'tag', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'List of workflow templates',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/WorkflowTemplate' },
              },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/workflows',
    operation: {
      operationId: 'createWorkflow',
      summary: 'Create a workflow from template or scratch',
      tags: ['Workflows'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateWorkflowInput' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Workflow created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Workflow' },
            },
          },
        },
      },
    },
  });

  // Plugins routes
  registerRoute({
    method: 'get',
    path: '/api/plugins',
    operation: {
      operationId: 'listPlugins',
      summary: 'List available plugins from marketplace',
      tags: ['Plugins'],
      parameters: [
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'installed', in: 'query', schema: { type: 'boolean' } },
      ],
      responses: {
        '200': {
          description: 'List of plugins',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Plugin' },
              },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/plugins/{id}/install',
    operation: {
      operationId: 'installPlugin',
      summary: 'Install a plugin',
      tags: ['Plugins'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: 'Plugin installed' },
        '400': { description: 'Installation failed' },
      },
    },
  });

  // AI Models routes
  registerRoute({
    method: 'get',
    path: '/api/ai/providers',
    operation: {
      operationId: 'listAiProviders',
      summary: 'List registered AI model providers',
      tags: ['AI Models'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'List of AI providers',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/AiProvider' },
              },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/ai/providers',
    operation: {
      operationId: 'registerAiProvider',
      summary: 'Register a custom AI model provider',
      tags: ['AI Models'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RegisterAiProviderInput' },
          },
        },
      },
      responses: {
        '201': { description: 'Provider registered' },
      },
    },
  });

  // Integrations routes
  registerRoute({
    method: 'get',
    path: '/api/integrations',
    operation: {
      operationId: 'listIntegrations',
      summary: 'List configured integrations',
      tags: ['Integrations'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'List of integrations',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Integration' },
              },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/integrations/overleaf/export',
    operation: {
      operationId: 'exportToOverleaf',
      summary: 'Export manuscript to Overleaf-compatible ZIP',
      tags: ['Integrations'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['manuscriptId'],
              properties: {
                manuscriptId: { type: 'string', format: 'uuid' },
                includeReferences: { type: 'boolean', default: true },
                includeFigures: { type: 'boolean', default: true },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Overleaf ZIP package',
          content: {
            'application/zip': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/integrations/git/sync',
    operation: {
      operationId: 'syncToGit',
      summary: 'Sync artifacts to Git repository',
      tags: ['Integrations'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['researchId'],
              properties: {
                researchId: { type: 'string', format: 'uuid' },
                branch: { type: 'string', default: 'main' },
                commitMessage: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Sync successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  commitSha: { type: 'string' },
                  branch: { type: 'string' },
                  filesUpdated: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  });

  // API Keys routes
  registerRoute({
    method: 'get',
    path: '/api/profile/api-keys',
    operation: {
      operationId: 'listApiKeys',
      summary: 'List user API keys',
      tags: ['Profile'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'List of API keys',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/ApiKey' },
              },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/profile/api-keys',
    operation: {
      operationId: 'createApiKey',
      summary: 'Create a new API key',
      tags: ['Profile'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['label'],
              properties: {
                label: { type: 'string' },
                expiresInDays: { type: 'integer', default: 90 },
                scopes: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'API key created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  key: { type: 'string', description: 'Only shown once' },
                },
              },
            },
          },
        },
      },
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/profile/api-keys/{id}/rotate',
    operation: {
      operationId: 'rotateApiKey',
      summary: 'Rotate an API key',
      tags: ['Profile'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'New key generated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  key: { type: 'string', description: 'Only shown once' },
                },
              },
            },
          },
        },
      },
    },
  });

  // Feedback routes
  registerRoute({
    method: 'post',
    path: '/api/feedback/events',
    operation: {
      operationId: 'submitFeedback',
      summary: 'Submit feedback event',
      tags: ['Feedback'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/FeedbackEvent' },
          },
        },
      },
      responses: {
        '201': { description: 'Feedback recorded' },
      },
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/admin/analytics/feedback',
    operation: {
      operationId: 'getFeedbackAnalytics',
      summary: 'Get feedback analytics dashboard data',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: {
        '200': {
          description: 'Analytics data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackAnalytics' },
            },
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Schema Definitions
// ─────────────────────────────────────────────────────────────

function registerCoreSchemas(): void {
  registerSchema('User', {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      name: { type: 'string' },
      role: { type: 'string', enum: ['USER', 'ADMIN', 'REVIEWER'] },
      tenantId: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  });

  registerSchema('Research', {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] },
      ownerId: { type: 'string', format: 'uuid' },
      tenantId: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  });

  registerSchema('CreateResearchInput', {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 500 },
      description: { type: 'string', maxLength: 5000 },
      templateKey: { type: 'string' },
    },
  });

  registerSchema('Artifact', {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      researchId: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['DATASET', 'CODE', 'FIGURE', 'TABLE', 'DOCUMENT', 'MODEL'] },
      name: { type: 'string' },
      version: { type: 'integer' },
      contentHash: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  });

  registerSchema('CreateArtifactInput', {
    type: 'object',
    required: ['researchId', 'type', 'name'],
    properties: {
      researchId: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['DATASET', 'CODE', 'FIGURE', 'TABLE', 'DOCUMENT', 'MODEL'] },
      name: { type: 'string' },
      content: { type: 'string' },
      metadata: { type: 'object' },
    },
  });

  registerSchema('WorkflowTemplate', {
    type: 'object',
    properties: {
      key: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      stages: { type: 'array', items: { $ref: '#/components/schemas/WorkflowStage' } },
    },
  });

  registerSchema('WorkflowStage', {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      config: { type: 'object' },
    },
  });

  registerSchema('Workflow', {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      researchId: { type: 'string', format: 'uuid' },
      templateKey: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] },
      stages: { type: 'array', items: { $ref: '#/components/schemas/WorkflowStage' } },
      createdAt: { type: 'string', format: 'date-time' },
    },
  });

  registerSchema('CreateWorkflowInput', {
    type: 'object',
    required: ['researchId'],
    properties: {
      researchId: { type: 'string', format: 'uuid' },
      templateKey: { type: 'string' },
      stages: { type: 'array', items: { $ref: '#/components/schemas/WorkflowStage' } },
    },
  });

  registerSchema('Plugin', {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      version: { type: 'string' },
      description: { type: 'string' },
      author: { type: 'string' },
      category: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' } },
      installed: { type: 'boolean' },
      enabled: { type: 'boolean' },
    },
  });

  registerSchema('AiProvider', {
    type: 'object',
    properties: {
      id: { type: 'string' },
      displayName: { type: 'string' },
      capabilities: { type: 'array', items: { type: 'string', enum: ['CHAT', 'EMBEDDINGS', 'RERANK', 'TOOLS'] } },
      models: { type: 'array', items: { type: 'string' } },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ERROR'] },
    },
  });

  registerSchema('RegisterAiProviderInput', {
    type: 'object',
    required: ['id', 'displayName', 'capabilities', 'endpoint'],
    properties: {
      id: { type: 'string', pattern: '^[a-z0-9-]+$' },
      displayName: { type: 'string' },
      capabilities: { type: 'array', items: { type: 'string' } },
      endpoint: { type: 'string', format: 'uri' },
      authType: { type: 'string', enum: ['API_KEY', 'OAUTH', 'NONE'] },
    },
  });

  registerSchema('Integration', {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['OVERLEAF', 'GITHUB', 'GITLAB', 'SLACK', 'ZOOM'] },
      status: { type: 'string', enum: ['CONNECTED', 'DISCONNECTED', 'ERROR'] },
      lastSyncAt: { type: 'string', format: 'date-time' },
    },
  });

  registerSchema('ApiKey', {
    type: 'object',
    properties: {
      id: { type: 'string' },
      label: { type: 'string' },
      prefix: { type: 'string', description: 'First 8 chars of key' },
      scopes: { type: 'array', items: { type: 'string' } },
      createdAt: { type: 'string', format: 'date-time' },
      lastRotatedAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
      rotationDue: { type: 'boolean' },
      daysUntilExpiry: { type: 'integer' },
    },
  });

  registerSchema('FeedbackEvent', {
    type: 'object',
    required: ['eventType'],
    properties: {
      eventType: { type: 'string', enum: ['BUG', 'FEATURE', 'NPS', 'RATING', 'GENERAL'] },
      page: { type: 'string' },
      payload: { type: 'object', description: 'Must not contain PHI' },
      rating: { type: 'integer', minimum: 1, maximum: 5 },
    },
  });

  registerSchema('FeedbackAnalytics', {
    type: 'object',
    properties: {
      totalEvents: { type: 'integer' },
      byType: { type: 'object' },
      byPage: { type: 'object' },
      trend: { type: 'array', items: { type: 'object' } },
      averageRating: { type: 'number' },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// OpenAPI Document Generation
// ─────────────────────────────────────────────────────────────

export function generateOpenApiSpec(): Record<string, unknown> {
  // Register all routes and schemas on first call
  if (routes.length === 0) {
    registerCoreRoutes();
    registerCoreSchemas();
  }

  // Build paths object
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const openApiPath = route.path.replace(/:([^/]+)/g, '{$1}');
    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }
    paths[openApiPath][route.method] = route.operation;
  }

  // Build schemas object
  const schemaComponents: Record<string, unknown> = {};
  for (const [name, schema] of schemas) {
    schemaComponents[name] = schema;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'ResearchFlow API',
      version: process.env.APP_VERSION ?? '1.0.0',
      description: `
ResearchFlow Production API - A comprehensive platform for managing research workflows,
artifacts, collaborations, and integrations.

## Authentication
Most endpoints require Bearer token authentication. Obtain a token via the /api/auth/login endpoint.

## Rate Limits
- Standard users: 1000 requests/hour
- Premium users: 10000 requests/hour

## PHI Compliance
This API is designed to be PHI-safe. Ensure no Protected Health Information is included in:
- Feedback payloads
- Plugin configurations
- Public-facing fields
      `.trim(),
      contact: {
        name: 'ResearchFlow Support',
        email: 'support@researchflow.io',
        url: 'https://github.com/ry86pkqf74-rgb/researchflow-production',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL ?? 'http://localhost:3000',
        description: 'Current environment',
      },
      {
        url: 'https://api.researchflow.io',
        description: 'Production',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Research', description: 'Research project management' },
      { name: 'Artifacts', description: 'Research artifact management' },
      { name: 'Workflows', description: 'Workflow templates and execution' },
      { name: 'Plugins', description: 'Plugin marketplace and management' },
      { name: 'AI Models', description: 'Custom AI model providers' },
      { name: 'Integrations', description: 'External service integrations' },
      { name: 'Profile', description: 'User profile and settings' },
      { name: 'Feedback', description: 'User feedback and analytics' },
      { name: 'Admin', description: 'Administrative endpoints' },
    ],
    paths,
    components: {
      schemas: schemaComponents,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for programmatic access',
        },
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  generateOpenApiSpec,
  registerRoute,
  registerSchema,
};
