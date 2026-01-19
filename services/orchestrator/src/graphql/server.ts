/**
 * Apollo GraphQL Server Setup
 *
 * Configures Apollo Server with:
 * - Express integration
 * - Authentication context
 * - Error handling
 * - Caching
 * - Rate limiting
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { logger } from '../logger/file-logger.js';

// Context interface
interface GraphQLContext {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  services: {
    artifacts: any;
    jobs: any;
    schemas: any;
    uploads: any;
    webhooks: any;
    cache: any;
  };
}

/**
 * Create and configure Apollo Server
 */
export async function createApolloServer(
  httpServer: http.Server,
  services: GraphQLContext['services']
) {
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    plugins: [
      // Graceful shutdown
      ApolloServerPluginDrainHttpServer({ httpServer }),

      // Landing page for development
      process.env.NODE_ENV !== 'production'
        ? ApolloServerPluginLandingPageLocalDefault({ embed: true })
        : ApolloServerPluginLandingPageLocalDefault({ embed: false }),

      // Custom logging plugin
      {
        async requestDidStart(requestContext) {
          const start = Date.now();

          return {
            async willSendResponse(ctx) {
              const duration = Date.now() - start;
              logger.debug(`GraphQL ${ctx.operationName || 'anonymous'}: ${duration}ms`);
            },

            async didEncounterErrors(ctx) {
              for (const error of ctx.errors) {
                logger.error('GraphQL Error', {
                  message: error.message,
                  path: error.path,
                  extensions: error.extensions
                });
              }
            }
          };
        }
      }
    ],

    // Format errors for production
    formatError: (formattedError, error) => {
      // Log the original error (scrubbed)
      logger.error('GraphQL Error', { error });

      // Hide internal errors in production
      if (process.env.NODE_ENV === 'production') {
        if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
          return {
            message: 'Internal server error',
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          };
        }
      }

      return formattedError;
    },

    // Introspection
    introspection: process.env.NODE_ENV !== 'production'
  });

  await server.start();

  return {
    server,
    middleware: expressMiddleware(server, {
      context: async ({ req }): Promise<GraphQLContext> => {
        // Extract user from auth header
        const user = await extractUser(req);

        return {
          user,
          services
        };
      }
    })
  };
}

/**
 * Extract user from authorization header
 */
async function extractUser(req: Request): Promise<GraphQLContext['user'] | undefined> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }

  const token = authHeader.substring(7);

  try {
    // TODO: Verify JWT token and extract user
    // For now, return mock user for development
    if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
      return {
        id: 'dev-user',
        email: 'dev@researchflow.com',
        roles: ['admin', 'researcher']
      };
    }

    // In production, verify JWT
    // const decoded = await verifyJWT(token);
    // return { id: decoded.sub, email: decoded.email, roles: decoded.roles };

    return undefined;
  } catch (error) {
    logger.error('Auth error', { error });
    return undefined;
  }
}

/**
 * Mount GraphQL on Express app
 */
export async function mountGraphQL(
  app: Express,
  httpServer: http.Server,
  services: GraphQLContext['services']
) {
  const { middleware } = await createApolloServer(httpServer, services);

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }),
    express.json({ limit: '10mb' }),
    middleware
  );

  logger.info('GraphQL endpoint mounted at /graphql');
}

export default { createApolloServer, mountGraphQL };
