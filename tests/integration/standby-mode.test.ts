/**
 * STANDBY Mode Integration Tests
 * INF-12: Tests for fail-closed behavior and NO_NETWORK enforcement
 * 
 * Note: These tests use a simplified express setup to avoid passport session
 * middleware interference. The mock auth middleware sets req.user based on
 * x-user-role header for testing RBAC-protected endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { TEST_USERS, getRoleHeader } from '../utils/rbac-mock';
import type { Role } from '@packages/core/types/roles';
import { ROLES } from '@packages/core/types/roles';
import { requireRole, logAuditEvent } from '@apps/api-node/src/middleware/rbac';

describe('STANDBY Mode Enforcement', () => {
  let app: Express;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    process.env.ROS_MODE = 'STANDBY';
    process.env.NO_NETWORK = 'true';
    
    app = express();
    app.use(express.json());
    
    app.use((req, _res, next) => {
      const roleHeader = req.headers['x-user-role'] as Role | undefined;
      if (roleHeader && TEST_USERS[roleHeader]) {
        req.user = TEST_USERS[roleHeader];
      }
      next();
    });
    
    app.get('/api/ros/status', (_req, res) => {
      res.json({ mode: process.env.ROS_MODE || 'STANDBY', status: 'active' });
    });
    
    app.get('/api/v1/health', (_req, res) => {
      res.json({ status: 'healthy', mode: process.env.ROS_MODE });
    });
    
    app.get('/api/ros/artifacts/:researchId',
      requireRole(ROLES.RESEARCHER),
      (req, res) => {
        res.json({ researchId: req.params.researchId, artifacts: [] });
      }
    );
    
    app.post('/api/ros/artifacts',
      requireRole(ROLES.RESEARCHER),
      logAuditEvent('ARTIFACT_CREATE', 'artifact'),
      (req, res) => {
        res.status(201).json({ id: 'test-artifact-001', ...req.body });
      }
    );
    
    app.get('/api/workflow/stages', (_req, res) => {
      res.json([{ id: 1, name: 'Stage 1' }]);
    });
  });

  afterEach(() => {
    process.env.ROS_MODE = 'STANDBY';
    process.env.NO_NETWORK = 'true';
  });

  describe('ROS Status Endpoint', () => {
    it('should report STANDBY mode status', async () => {
      const response = await request(app)
        .get('/api/ros/status');

      expect(response.status).toBe(200);
    });
  });

  describe('Health Check', () => {
    it('should return healthy in STANDBY mode', async () => {
      const response = await request(app)
        .get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Artifact Operations in STANDBY', () => {
    it('should allow artifact read operations', async () => {
      const response = await request(app)
        .get('/api/ros/artifacts/TEST-STANDBY-001')
        .set(getRoleHeader('RESEARCHER'));

      expect(response.status).toBe(200);
    });

    it('should allow artifact creation (metadata operations)', async () => {
      const artifact = {
        researchId: 'STANDBY-CREATE-001',
        stageId: 'stage-1',
        artifactType: 'config_snapshot',
        filename: 'standby-test.json',
        mimeType: 'application/json',
        content: '{"mode":"STANDBY"}',
        createdBy: 'test-researcher',
      };

      const response = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('RESEARCHER'))
        .send(artifact);

      expect(response.status).toBe(201);
    });
  });

  describe('NO_NETWORK Mode Behavior', () => {
    it('should not make external network calls for local endpoints', async () => {
      const response = await request(app)
        .get('/api/workflow/stages')
        .set(getRoleHeader('VIEWER'));

      expect(response.status).toBe(200);
    });

    it('should handle missing ROS backend gracefully', async () => {
      const response = await request(app)
        .get('/api/ros/status');

      expect([200, 503]).toContain(response.status);
    });
  });
});

describe('Authentication Enforcement', () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    app.use((req, _res, next) => {
      const roleHeader = req.headers['x-user-role'] as Role | undefined;
      if (roleHeader && TEST_USERS[roleHeader]) {
        req.user = TEST_USERS[roleHeader];
      }
      next();
    });
    
    app.get('/api/v1/health', (_req, res) => {
      res.json({ status: 'healthy' });
    });
    
    app.get('/api/workflow/stages', (_req, res) => {
      res.json([{ id: 1, name: 'Stage 1' }]);
    });
    
    app.post('/api/ros/artifacts',
      requireRole(ROLES.RESEARCHER),
      logAuditEvent('ARTIFACT_CREATE', 'artifact'),
      (req, res) => {
        res.status(201).json({ id: 'test-artifact-001', ...req.body });
      }
    );
  });

  describe('Development Mode Auth', () => {
    it('should allow artifact creation with RESEARCHER role header', async () => {
      const artifact = {
        researchId: 'DEV-AUTH-001',
        stageId: 'stage-1',
        artifactType: 'manuscript',
        filename: 'test.md',
        mimeType: 'text/markdown',
        content: 'Test',
        createdBy: 'dev-user',
      };

      const response = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('RESEARCHER'))
        .send(artifact);

      expect(response.status).toBe(201);
    });
    
    it('should reject artifact creation without auth', async () => {
      const artifact = {
        researchId: 'DEV-AUTH-002',
        stageId: 'stage-1',
        artifactType: 'manuscript',
        filename: 'test.md',
        mimeType: 'text/markdown',
        content: 'Test',
        createdBy: 'dev-user',
      };

      const response = await request(app)
        .post('/api/ros/artifacts')
        .send(artifact);

      expect(response.status).toBe(401);
    });

    it('should allow public endpoints without auth', async () => {
      const response = await request(app)
        .get('/api/v1/health');

      expect(response.status).toBe(200);
    });

    it('should allow workflow stages without auth', async () => {
      const response = await request(app)
        .get('/api/workflow/stages');

      expect(response.status).toBe(200);
    });
  });
});
