/**
 * Artifact Endpoint Integration Tests
 * INF-12: Integration tests for artifact CRUD with RBAC enforcement
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createServer } from 'http';
import { syntheticArtifacts, SYNTHETIC_RESEARCH_ID } from '../fixtures/synthetic-artifacts';
import { TEST_USERS, ALL_ROLES, getRoleHeader } from '../utils/rbac-mock';
import { computeSha256 } from '../utils/hash-determinism';
import type { Role } from '@packages/core/types/roles';
import { ROLES } from '@packages/core/types/roles';
import { requireRole } from '@apps/api-node/src/middleware/rbac';

/**
 * Artifact Endpoints Integration Tests
 * 
 * Note: These tests use a simplified express setup to avoid passport session
 * middleware interference. The mock auth middleware sets req.user based on
 * x-user-role header for testing RBAC-protected endpoints.
 */
describe('Artifact Endpoints Integration Tests', () => {
  let app: Express;
  const artifacts: Map<string, any> = new Map();
  let artifactIdCounter = 1;

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
    
    app.get('/api/ros/artifacts/:researchId',
      requireRole(ROLES.RESEARCHER),
      (req, res) => {
        const researchArtifacts = Array.from(artifacts.values())
          .filter(a => a.researchId === req.params.researchId);
        res.json({ artifacts: researchArtifacts });
      }
    );
    
    app.post('/api/ros/artifacts',
      requireRole(ROLES.RESEARCHER),
      (req, res) => {
        const { researchId, stageId, artifactType, filename, mimeType, content, createdBy } = req.body;
        
        if (!researchId || !stageId || !artifactType || !filename || !content) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const sha256Hash = computeSha256(content);
        const artifact = {
          id: `artifact-${artifactIdCounter++}`,
          researchId,
          stageId,
          artifactType,
          filename,
          mimeType,
          content,
          createdBy,
          sha256Hash,
          createdAt: new Date().toISOString(),
        };
        
        artifacts.set(artifact.id, artifact);
        res.status(201).json({ artifact });
      }
    );
    
    app.post('/api/ros/artifact/:id/version',
      requireRole(ROLES.RESEARCHER),
      (req, res) => {
        const { versionNumber, content, createdBy, changeDescription } = req.body;
        const version = {
          id: `version-${Date.now()}`,
          artifactId: req.params.id,
          versionNumber,
          content,
          createdBy,
          changeDescription,
          sha256Hash: computeSha256(content),
          createdAt: new Date().toISOString(),
        };
        res.status(201).json({ version });
      }
    );
  });

  describe('GET /api/ros/artifacts/:researchId', () => {
    it('should return empty array for new research ID', async () => {
      const response = await request(app)
        .get('/api/ros/artifacts/NEW-RESEARCH-ID')
        .set(getRoleHeader('RESEARCHER'));

      expect(response.status).toBe(200);
      expect(response.body.artifacts).toEqual([]);
    });

    it('should require RESEARCHER role minimum (VIEWER blocked)', async () => {
      const response = await request(app)
        .get(`/api/ros/artifacts/${SYNTHETIC_RESEARCH_ID}`)
        .set(getRoleHeader('VIEWER'));

      expect(response.status).toBe(403);
    });

    it('should allow RESEARCHER role', async () => {
      const response = await request(app)
        .get(`/api/ros/artifacts/${SYNTHETIC_RESEARCH_ID}`)
        .set(getRoleHeader('RESEARCHER'));

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/ros/artifacts', () => {
    it('should create artifact with RESEARCHER role', async () => {
      const artifact = syntheticArtifacts[0];
      
      const response = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('RESEARCHER'))
        .send(artifact);

      expect(response.status).toBe(201);
      expect(response.body.artifact).toBeDefined();
      expect(response.body.artifact.researchId).toBe(artifact.researchId);
      expect(response.body.artifact.sha256Hash).toBeDefined();
    });

    it('should compute correct SHA-256 hash', async () => {
      const artifact = {
        ...syntheticArtifacts[1],
        researchId: 'HASH-TEST-001',
      };
      
      const response = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('RESEARCHER'))
        .send(artifact);

      expect(response.status).toBe(201);
      const expectedHash = computeSha256(artifact.content);
      expect(response.body.artifact.sha256Hash).toBe(expectedHash);
    });

    it('should reject creation with VIEWER role', async () => {
      const response = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('VIEWER'))
        .send(syntheticArtifacts[0]);

      expect(response.status).toBe(403);
    });

    it('should reject invalid payload', async () => {
      const response = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('RESEARCHER'))
        .send({ invalid: 'payload' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ros/artifact/:id/version', () => {
    it('should create artifact and then add new version with RESEARCHER role', async () => {
      const artifact = {
        ...syntheticArtifacts[0],
        researchId: 'VERSION-TEST-002',
      };
      
      const createResponse = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('RESEARCHER'))
        .send(artifact);

      expect(createResponse.status).toBe(201);
      const createdArtifactId = createResponse.body.artifact.id;

      const versionPayload = {
        artifactId: createdArtifactId,
        versionNumber: 2,
        content: 'Updated content for version 2',
        createdBy: 'test-researcher',
        changeDescription: 'Added new section',
      };

      const response = await request(app)
        .post(`/api/ros/artifact/${createdArtifactId}/version`)
        .set(getRoleHeader('RESEARCHER'))
        .send(versionPayload);

      expect(response.status).toBe(201);
      expect(response.body.version).toBeDefined();
      expect(response.body.version.versionNumber).toBe(2);
    });
  });

  describe('RBAC Enforcement', () => {
    const testArtifact = {
      ...syntheticArtifacts[2],
      researchId: 'RBAC-TEST-001',
    };

    ALL_ROLES.forEach(role => {
      it(`should handle ${role} role appropriately for artifact creation`, async () => {
        const response = await request(app)
          .post('/api/ros/artifacts')
          .set(getRoleHeader(role))
          .send({ ...testArtifact, researchId: `RBAC-${role}-001` });

        if (role === 'VIEWER') {
          expect(response.status).toBe(403);
        } else {
          expect(response.status).toBe(201);
        }
      });
    });
  });

  describe('Hash Stability', () => {
    it('should produce identical hashes for identical content', async () => {
      const content = 'Deterministic content test';
      const artifact1 = {
        researchId: 'HASH-STABLE-001',
        stageId: 'stage-1',
        artifactType: 'manuscript' as const,
        filename: 'hash-test-1.md',
        mimeType: 'text/markdown',
        content,
        createdBy: 'test-researcher',
      };
      
      const artifact2 = {
        ...artifact1,
        researchId: 'HASH-STABLE-002',
        filename: 'hash-test-2.md',
      };

      const response1 = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('RESEARCHER'))
        .send(artifact1);

      const response2 = await request(app)
        .post('/api/ros/artifacts')
        .set(getRoleHeader('RESEARCHER'))
        .send(artifact2);

      expect(response1.body.artifact.sha256Hash).toBe(response2.body.artifact.sha256Hash);
    });
  });
});

describe('Reproducibility Bundle Export', () => {
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
    
    app.get('/api/ros/export/reproducibility-bundle/:researchId',
      requireRole(ROLES.RESEARCHER),
      (req, res) => {
        res.json({ 
          researchId: req.params.researchId, 
          bundle: { files: [], metadata: {} }
        });
      }
    );
  });

  describe('GET /api/ros/export/reproducibility-bundle/:researchId', () => {
    it('should require RESEARCHER role minimum', async () => {
      const response = await request(app)
        .get('/api/ros/export/reproducibility-bundle/TEST-001')
        .set(getRoleHeader('VIEWER'));

      expect(response.status).toBe(403);
    });

    it('should allow RESEARCHER role', async () => {
      const response = await request(app)
        .get('/api/ros/export/reproducibility-bundle/DEMO-001')
        .set(getRoleHeader('RESEARCHER'));

      expect(response.status).toBe(200);
    });

    it('should allow STEWARD role', async () => {
      const response = await request(app)
        .get('/api/ros/export/reproducibility-bundle/DEMO-001')
        .set(getRoleHeader('STEWARD'));

      expect(response.status).toBe(200);
    });

    it('should allow ADMIN role', async () => {
      const response = await request(app)
        .get('/api/ros/export/reproducibility-bundle/DEMO-001')
        .set(getRoleHeader('ADMIN'));

      expect(response.status).toBe(200);
    });
  });
});
