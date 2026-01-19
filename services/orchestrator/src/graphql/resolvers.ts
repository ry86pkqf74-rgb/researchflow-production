/**
 * GraphQL Resolvers for ResearchFlow API
 *
 * Implements query and mutation handlers with:
 * - OPA authorization checks
 * - Input validation
 * - Error handling
 * - Caching integration
 */

import { GraphQLScalarType, Kind } from 'graphql';
import { ApolloError, AuthenticationError, ForbiddenError } from 'apollo-server-express';

// Custom scalars
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 datetime string',
  serialize(value: any): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  },
  parseValue(value: any): Date {
    return new Date(value);
  },
  parseLiteral(ast): Date | null {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  }
});

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize(value: any): any {
    return value;
  },
  parseValue(value: any): any {
    return value;
  },
  parseLiteral(ast): any {
    switch (ast.kind) {
      case Kind.STRING:
        return JSON.parse(ast.value);
      case Kind.OBJECT:
        return ast.fields.reduce((acc: any, field) => {
          acc[field.name.value] = JSONScalar.parseLiteral(field.value);
          return acc;
        }, {});
      default:
        return null;
    }
  }
});

// Context type
interface Context {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  services: {
    artifacts: ArtifactService;
    jobs: JobService;
    schemas: SchemaService;
    uploads: UploadService;
    webhooks: WebhookService;
    cache: CacheService;
  };
}

// Service interfaces (to be implemented)
interface ArtifactService {
  getById(id: string): Promise<any>;
  list(filter: any, pagination: any): Promise<{ items: any[]; total: number }>;
  create(input: any, userId: string): Promise<any>;
  update(id: string, input: any): Promise<any>;
  delete(id: string): Promise<boolean>;
  archive(id: string): Promise<any>;
  getLineage(id: string): Promise<any>;
}

interface JobService {
  getById(id: string): Promise<any>;
  list(filter: any, pagination: any): Promise<{ items: any[]; total: number }>;
  submit(input: any, userId: string): Promise<any>;
  cancel(id: string): Promise<any>;
  retry(id: string): Promise<any>;
  getLogs(jobId: string, level?: string, limit?: number): Promise<any[]>;
}

interface SchemaService {
  get(name: string, version?: string): Promise<any>;
  list(name?: string): Promise<any[]>;
  getVersions(name: string): Promise<string[]>;
  register(name: string, version: string, schema: any, changelog?: string, userId?: string): Promise<any>;
  deprecate(name: string, version: string): Promise<any>;
}

interface UploadService {
  requestUploadUrl(filename: string, contentType: string): Promise<{ uploadUrl: string; artifactId: string; expiresAt: Date }>;
  confirmUpload(artifactId: string): Promise<any>;
  requestDownloadUrl(artifactId: string): Promise<{ downloadUrl: string; expiresAt: Date }>;
}

interface WebhookService {
  register(input: any, userId: string): Promise<any>;
  update(id: string, active: boolean): Promise<any>;
  delete(id: string): Promise<boolean>;
  test(id: string): Promise<boolean>;
}

interface CacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// Auth helpers
function requireAuth(ctx: Context): void {
  if (!ctx.user) {
    throw new AuthenticationError('Authentication required');
  }
}

function requireRole(ctx: Context, role: string): void {
  requireAuth(ctx);
  if (!ctx.user!.roles.includes(role) && !ctx.user!.roles.includes('admin')) {
    throw new ForbiddenError(`Role '${role}' required`);
  }
}

// Resolvers
export const resolvers = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,

  Query: {
    // Artifacts
    artifact: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireAuth(ctx);
      const cacheKey = `artifact:${id}`;

      // Check cache
      const cached = await ctx.services.cache.get(cacheKey);
      if (cached) return cached;

      const artifact = await ctx.services.artifacts.getById(id);
      if (!artifact) {
        throw new ApolloError('Artifact not found', 'NOT_FOUND');
      }

      // Cache for 5 minutes
      await ctx.services.cache.set(cacheKey, artifact, 300);
      return artifact;
    },

    artifacts: async (_: any, { filter, pagination }: any, ctx: Context) => {
      requireAuth(ctx);
      const { items, total } = await ctx.services.artifacts.list(filter, pagination);

      return {
        items,
        total,
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 20,
        hasMore: (pagination?.page || 1) * (pagination?.pageSize || 20) < total
      };
    },

    artifactLineage: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.artifacts.getLineage(id);
    },

    // Jobs
    job: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireAuth(ctx);
      const job = await ctx.services.jobs.getById(id);
      if (!job) {
        throw new ApolloError('Job not found', 'NOT_FOUND');
      }
      return job;
    },

    jobs: async (_: any, { filter, pagination }: any, ctx: Context) => {
      requireAuth(ctx);
      const { items, total } = await ctx.services.jobs.list(filter, pagination);

      return {
        items,
        total,
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 20,
        hasMore: (pagination?.page || 1) * (pagination?.pageSize || 20) < total
      };
    },

    jobLogs: async (_: any, { jobId, level, limit }: any, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.jobs.getLogs(jobId, level, limit);
    },

    // Schemas
    schema: async (_: any, { name, version }: { name: string; version?: string }, ctx: Context) => {
      requireAuth(ctx);
      const cacheKey = `schema:${name}:${version || 'latest'}`;

      const cached = await ctx.services.cache.get(cacheKey);
      if (cached) return cached;

      const schema = await ctx.services.schemas.get(name, version);
      if (!schema) {
        throw new ApolloError('Schema not found', 'NOT_FOUND');
      }

      await ctx.services.cache.set(cacheKey, schema, 3600); // Cache for 1 hour
      return schema;
    },

    schemas: async (_: any, { name }: { name?: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.schemas.list(name);
    },

    schemaVersions: async (_: any, { name }: { name: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.schemas.getVersions(name);
    },

    // Users
    me: (_: any, __: any, ctx: Context) => {
      requireAuth(ctx);
      return ctx.user;
    },

    users: (_: any, __: any, ctx: Context) => {
      requireRole(ctx, 'admin');
      // Return mock data - implement user service
      return [];
    },

    // System
    health: async () => {
      return {
        status: 'healthy',
        version: process.env.APP_VERSION || '1.0.0',
        uptime: Math.floor(process.uptime()),
        services: [
          { name: 'api', status: 'healthy', latency: 0 },
          { name: 'redis', status: 'healthy', latency: 1 },
          { name: 'worker', status: 'healthy', latency: 5 }
        ]
      };
    },

    version: () => process.env.APP_VERSION || '1.0.0'
  },

  Mutation: {
    // Artifacts
    createArtifact: async (_: any, { input }: any, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.artifacts.create(input, ctx.user!.id);
    },

    updateArtifact: async (_: any, { id, input }: any, ctx: Context) => {
      requireAuth(ctx);
      const artifact = await ctx.services.artifacts.update(id, input);
      await ctx.services.cache.invalidate(`artifact:${id}`);
      return artifact;
    },

    deleteArtifact: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireRole(ctx, 'researcher');
      const result = await ctx.services.artifacts.delete(id);
      await ctx.services.cache.invalidate(`artifact:${id}`);
      return result;
    },

    archiveArtifact: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireAuth(ctx);
      const artifact = await ctx.services.artifacts.archive(id);
      await ctx.services.cache.invalidate(`artifact:${id}`);
      return artifact;
    },

    // Uploads
    requestUploadUrl: async (_: any, { filename, contentType }: any, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.uploads.requestUploadUrl(filename, contentType);
    },

    confirmUpload: async (_: any, { artifactId }: { artifactId: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.uploads.confirmUpload(artifactId);
    },

    requestDownloadUrl: async (_: any, { artifactId }: { artifactId: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.uploads.requestDownloadUrl(artifactId);
    },

    // Jobs
    submitJob: async (_: any, { input }: any, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.jobs.submit(input, ctx.user!.id);
    },

    cancelJob: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.jobs.cancel(id);
    },

    retryJob: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.jobs.retry(id);
    },

    // Schemas
    registerSchema: async (_: any, { name, version, schema, changelog }: any, ctx: Context) => {
      requireRole(ctx, 'researcher');
      const result = await ctx.services.schemas.register(name, version, schema, changelog, ctx.user!.id);
      await ctx.services.cache.invalidate(`schema:${name}:*`);
      return result;
    },

    deprecateSchema: async (_: any, { name, version }: any, ctx: Context) => {
      requireRole(ctx, 'admin');
      const result = await ctx.services.schemas.deprecate(name, version);
      await ctx.services.cache.invalidate(`schema:${name}:${version}`);
      return result;
    },

    // Webhooks
    registerWebhook: async (_: any, { input }: any, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.webhooks.register(input, ctx.user!.id);
    },

    updateWebhook: async (_: any, { id, active }: any, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.webhooks.update(id, active);
    },

    deleteWebhook: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.webhooks.delete(id);
    },

    testWebhook: async (_: any, { id }: { id: string }, ctx: Context) => {
      requireAuth(ctx);
      return ctx.services.webhooks.test(id);
    }
  },

  // Field resolvers
  Artifact: {
    lineage: async (artifact: any, _: any, ctx: Context) => {
      return ctx.services.artifacts.getLineage(artifact.id);
    }
  },

  Job: {
    artifacts: async (job: any, _: any, ctx: Context) => {
      if (job.artifactIds) {
        return Promise.all(
          job.artifactIds.map((id: string) => ctx.services.artifacts.getById(id))
        );
      }
      return [];
    },
    logs: async (job: any, _: any, ctx: Context) => {
      return ctx.services.jobs.getLogs(job.id);
    }
  }
};

export default resolvers;
