/**
 * Test Application Factory
 * INF-12: Creates Express app instances for integration testing
 * 
 * Configures a test-ready Express app with mock authentication
 * and isolated storage for each test run.
 */

import express, { Express } from 'express';
import { createServer } from 'http';
import type { Role } from '../../packages/core/types/roles';

/**
 * Creates a test Express application with the specified role
 */
export async function createTestApp(options: {
  userRole?: Role | null;
  mockMode?: boolean;
}): Promise<Express> {
  const app = express();
  app.use(express.json());
  
  if (options.userRole) {
    app.use((req, _res, next) => {
      req.user = {
        id: `test-${options.userRole?.toLowerCase()}-001`,
        username: `test_${options.userRole?.toLowerCase()}`,
        role: options.userRole!,
        email: `${options.userRole?.toLowerCase()}@test.com`,
        isActive: true,
      };
      next();
    });
  }
  
  if (options.mockMode !== false) {
    process.env.ROS_MODE = 'STANDBY';
    process.env.NO_NETWORK = 'true';
  }
  
  const httpServer = createServer(app);
  const { registerRoutes } = await import('../../apps/api-node/routes');
  await registerRoutes(httpServer, app);
  
  return app;
}

/**
 * Cleanup function to reset environment after tests
 */
export function cleanupTestEnv(): void {
  delete process.env.ROS_MODE;
  delete process.env.NO_NETWORK;
}

/**
 * Test environment configuration
 */
export const TEST_CONFIG = {
  STANDBY_MODE: {
    ROS_MODE: 'STANDBY',
    NO_NETWORK: 'true',
  },
  SANDBOX_MODE: {
    ROS_MODE: 'SANDBOX',
    NO_NETWORK: 'true',
  },
  LIVE_MODE: {
    ROS_MODE: 'LIVE',
    NO_NETWORK: 'false',
  },
} as const;

/**
 * Sets environment for specific test mode
 */
export function setTestMode(mode: keyof typeof TEST_CONFIG): void {
  const config = TEST_CONFIG[mode];
  Object.entries(config).forEach(([key, value]) => {
    process.env[key] = value;
  });
}
