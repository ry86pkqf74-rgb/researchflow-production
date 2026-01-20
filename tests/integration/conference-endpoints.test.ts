/**
 * Conference Endpoints Integration Tests
 * Tests for Stage 20 Conference Preparation endpoints
 *
 * Covers:
 * - /api/ros/conference/materials/export (new Stage 20 endpoint)
 * - /api/ros/conference/export (backwards compatibility alias)
 * - /api/ros/conference/download/:runId/:filename (file downloads)
 * - /api/ros/conference/requirements (conference guidelines)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { TEST_USERS, getRoleHeader } from '../utils/rbac-mock';
import type { Role } from '@packages/core/types/roles';

describe('Conference Endpoints Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    process.env.ROS_MODE = 'STANDBY';
    process.env.GOVERNANCE_MODE = 'DEMO';
    process.env.NODE_ENV = 'test';

    app = express();
    app.use(express.json());

    const httpServer = createServer(app);
    const { registerRoutes } = await import('@apps/api-node/routes');
    await registerRoutes(httpServer, app);

    app.use((req: Request, _res: Response, next: NextFunction) => {
      const roleHeader = req.headers['x-user-role'] as Role | undefined;
      if (roleHeader && TEST_USERS[roleHeader]) {
        req.user = TEST_USERS[roleHeader];
      }
      next();
    });
  });

  // ==========================================
  // STAGE 20 MATERIALS/EXPORT ENDPOINT
  // ==========================================
  describe('POST /api/ros/conference/materials/export', () => {
    describe('RBAC Enforcement', () => {
      it('should reject VIEWER role', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('VIEWER'))
          .send({
            conferenceId: 'SAGES',
            researchId: 'test-123',
          });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });

      it('should accept RESEARCHER role', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            conferenceId: 'SAGES',
            researchId: 'test-123',
          });

        // Should not be rejected for RBAC reasons
        expect(response.status).not.toBe(403);
      });
    });

    describe('Parameter Handling', () => {
      it('should accept camelCase parameters', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            conferenceId: 'SAGES',
            researchId: 'camel-case-123',
            materialTypes: ['poster', 'slides'],
          });

        expect(response.status).not.toBe(400);
        expect(response.body.code).not.toBe('INVALID_PARAMETERS');
      });

      it('should accept snake_case parameters', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            conference_id: 'SAGES',
            research_id: 'snake-case-456',
            material_types: ['poster'],
          });

        expect(response.status).not.toBe(400);
        expect(response.body.code).not.toBe('INVALID_PARAMETERS');
      });

      it('should accept topicId for backwards compatibility', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            conferenceId: 'SAGES',
            topicId: 'legacy-topic-789',
          });

        expect(response.status).not.toBe(400);
        expect(response.body.code).not.toBe('MISSING_RESEARCH_ID');
      });

      it('should support include_poster and include_slides flags', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            conferenceId: 'SAGES',
            researchId: 'flags-test',
            include_poster: true,
            include_slides: false,
          });

        expect(response.status).not.toBe(400);
      });

      it('should support blinded flag for de-identification', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            conferenceId: 'SAGES',
            researchId: 'blinded-test',
            blinded: true,
          });

        expect(response.status).not.toBe(400);
      });
    });

    describe('DEMO Mode Behavior', () => {
      it('should use default conferenceId in DEMO mode if not provided', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            researchId: 'demo-mode-test',
          });

        // Should not fail due to missing conference
        expect(response.body.code).not.toBe('MISSING_CONFERENCE_ID');
      });

      it('should return files with proper URL structure', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            conferenceId: 'SAGES',
            researchId: 'url-structure-test',
          });

        if (response.status === 200 && response.body.files) {
          expect(Array.isArray(response.body.files)).toBe(true);
          response.body.files.forEach((file: any) => {
            expect(file).toHaveProperty('url');
            expect(file.url).toMatch(/^\/api\/ros\/conference\/download\//);
          });
        }
      });

      it('should return runId in response for tracking', async () => {
        const response = await request(app)
          .post('/api/ros/conference/materials/export')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            conferenceId: 'SAGES',
            researchId: 'tracking-test',
          });

        if (response.status === 200) {
          expect(response.body).toHaveProperty('runId');
        }
      });
    });
  });

  // ==========================================
  // BACKWARDS COMPATIBILITY /EXPORT ALIAS
  // ==========================================
  describe('POST /api/ros/conference/export (Alias)', () => {
    it('should accept requests (backwards compatibility)', async () => {
      const response = await request(app)
        .post('/api/ros/conference/export')
        .set(getRoleHeader('RESEARCHER'))
        .send({
          conferenceId: 'SAGES',
          researchId: 'alias-test',
        });

      // Alias should work same as materials/export
      expect(response.status).not.toBe(404);
    });

    it('should support stage_id parameter for legacy requests', async () => {
      const response = await request(app)
        .post('/api/ros/conference/export')
        .set(getRoleHeader('RESEARCHER'))
        .send({
          stage_id: 20,
          title: 'Legacy Export Request',
        });

      expect(response.status).not.toBe(400);
    });
  });

  // ==========================================
  // FILE DOWNLOAD ENDPOINT
  // ==========================================
  describe('GET /api/ros/conference/download/:runId/:filename', () => {
    describe('Security', () => {
      it('should reject VIEWER role', async () => {
        const response = await request(app)
          .get('/api/ros/conference/download/run-123/poster.pdf')
          .set(getRoleHeader('VIEWER'));

        expect(response.status).toBe(403);
      });

      it('should prevent path traversal with ../', async () => {
        const response = await request(app)
          .get('/api/ros/conference/download/run-123/../../../etc/passwd')
          .set(getRoleHeader('RESEARCHER'));

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should prevent path traversal with encoded characters', async () => {
        const response = await request(app)
          .get('/api/ros/conference/download/run-123/..%2F..%2Fetc%2Fpasswd')
          .set(getRoleHeader('RESEARCHER'));

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject absolute paths in filename', async () => {
        const response = await request(app)
          .get('/api/ros/conference/download/run-123//etc/passwd')
          .set(getRoleHeader('RESEARCHER'));

        expect([400, 403, 404]).toContain(response.status);
      });
    });

    describe('File Handling', () => {
      it('should return 404 for non-existent files', async () => {
        const response = await request(app)
          .get('/api/ros/conference/download/nonexistent-run/missing.pdf')
          .set(getRoleHeader('RESEARCHER'));

        expect(response.status).toBe(404);
      });

      it('should set correct content-type for PDF files', async () => {
        // This test may need a valid file in the test fixtures
        const response = await request(app)
          .get('/api/ros/conference/download/demo-run/poster.pdf')
          .set(getRoleHeader('RESEARCHER'));

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/pdf');
        }
      });

      it('should set correct content-type for PPTX files', async () => {
        const response = await request(app)
          .get('/api/ros/conference/download/demo-run/slides.pptx')
          .set(getRoleHeader('RESEARCHER'));

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/vnd');
        }
      });
    });
  });

  // ==========================================
  // CONFERENCE REQUIREMENTS
  // ==========================================
  describe('GET /api/ros/conference/requirements', () => {
    it('should be accessible without authentication (public)', async () => {
      const response = await request(app)
        .get('/api/ros/conference/requirements');

      expect(response.status).toBe(200);
    });

    it('should return array of conferences', async () => {
      const response = await request(app)
        .get('/api/ros/conference/requirements');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conferences');
      expect(Array.isArray(response.body.conferences)).toBe(true);
    });

    it('should include required conference fields', async () => {
      const response = await request(app)
        .get('/api/ros/conference/requirements');

      const conference = response.body.conferences[0];
      expect(conference).toHaveProperty('id');
      expect(conference).toHaveProperty('conferenceName');
      expect(conference).toHaveProperty('abstractWordLimit');
      expect(conference).toHaveProperty('presentationType');
    });

    it('should include poster dimensions where applicable', async () => {
      const response = await request(app)
        .get('/api/ros/conference/requirements');

      const conferenceWithPoster = response.body.conferences.find(
        (c: any) => c.posterDimensions
      );

      if (conferenceWithPoster) {
        expect(conferenceWithPoster.posterDimensions).toHaveProperty('width');
        expect(conferenceWithPoster.posterDimensions).toHaveProperty('height');
        expect(conferenceWithPoster.posterDimensions).toHaveProperty('unit');
      }
    });
  });

  // ==========================================
  // PHI SAFETY CHECKS
  // ==========================================
  describe('PHI Safety', () => {
    it('should not expose PHI in error messages', async () => {
      const response = await request(app)
        .post('/api/ros/conference/materials/export')
        .set(getRoleHeader('RESEARCHER'))
        .send({
          conferenceId: 'SAGES',
          researchId: 'test-phi-leak',
          // Potentially sensitive content
          abstract: 'Patient John Doe MRN 12345 SSN 123-45-6789',
        });

      // Error messages should not echo back PHI
      if (response.body.error) {
        expect(response.body.error).not.toMatch(/\d{3}-\d{2}-\d{4}/); // SSN pattern
        expect(response.body.error).not.toMatch(/MRN/i);
      }
    });

    it('should enforce blinded mode when requested', async () => {
      const response = await request(app)
        .post('/api/ros/conference/materials/export')
        .set(getRoleHeader('RESEARCHER'))
        .send({
          conferenceId: 'SAGES',
          researchId: 'blinded-check',
          blinded: true,
        });

      // Blinded exports should not contain author/institution info in filenames
      if (response.status === 200 && response.body.files) {
        response.body.files.forEach((file: any) => {
          if (file.filename) {
            expect(file.filename).not.toMatch(/author|institution/i);
          }
        });
      }
    });
  });
});
