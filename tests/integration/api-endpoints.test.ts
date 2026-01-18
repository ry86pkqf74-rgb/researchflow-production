/**
 * API Endpoints Integration Tests
 * Tests for SAP, Conference, PHI, and Topic endpoints with RBAC enforcement
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { TEST_USERS, getRoleHeader } from '../utils/rbac-mock';
import type { Role } from '@packages/core/types/roles';

describe('API Endpoints Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    process.env.ROS_MODE = 'STANDBY';
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
  // SAP ENDPOINTS
  // ==========================================
  describe('SAP Endpoints', () => {
    describe('POST /api/ros/sap - Create SAP', () => {
      it('should reject VIEWER role (insufficient permissions)', async () => {
        const sapData = {
          topicId: 'topic-123',
          researchId: 'research-456',
        };

        const response = await request(app)
          .post('/api/ros/sap')
          .set(getRoleHeader('VIEWER'))
          .send(sapData);

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });

      it('should return correct error structure for insufficient role', async () => {
        const response = await request(app)
          .post('/api/ros/sap')
          .set(getRoleHeader('VIEWER'))
          .send({ topicId: 'test', researchId: 'test' });

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
        expect(response.body).toHaveProperty('required');
        expect(response.body.required).toBe('RESEARCHER');
      });
    });

    describe('POST /api/ros/sap/:sapId/approve - Approve SAP', () => {
      it('should reject RESEARCHER role (insufficient for approval)', async () => {
        const response = await request(app)
          .post('/api/ros/sap/sap-123/approve')
          .set(getRoleHeader('RESEARCHER'))
          .send({ justification: 'Attempting to approve' });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });

      it('should reject VIEWER role', async () => {
        const response = await request(app)
          .post('/api/ros/sap/sap-123/approve')
          .set(getRoleHeader('VIEWER'))
          .send({ justification: 'Viewer approval attempt' });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });

      it('should require STEWARD role minimum', async () => {
        const response = await request(app)
          .post('/api/ros/sap/sap-123/approve')
          .set(getRoleHeader('RESEARCHER'))
          .send({ justification: 'Test justification' });

        expect(response.body.required).toBe('STEWARD');
      });
    });

    describe('POST /api/ros/sap/:sapId/generate-methods - Generate Methods Text', () => {
      it('should reject VIEWER role', async () => {
        const response = await request(app)
          .post('/api/ros/sap/sap-123/generate-methods')
          .set(getRoleHeader('VIEWER'))
          .send({});

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });
    });
  });

  // ==========================================
  // CONFERENCE ENDPOINTS
  // ==========================================
  describe('Conference Endpoints', () => {
    describe('GET /api/ros/conference/requirements - Get Predefined Conferences', () => {
      it('should return conference requirements (public endpoint)', async () => {
        const response = await request(app)
          .get('/api/ros/conference/requirements');

        expect(response.status).toBe(200);
        expect(response.body.conferences).toBeDefined();
        expect(Array.isArray(response.body.conferences)).toBe(true);
        expect(response.body.conferences.length).toBeGreaterThan(0);
      });

      it('should include expected conference data structure', async () => {
        const response = await request(app)
          .get('/api/ros/conference/requirements');

        expect(response.status).toBe(200);
        const conference = response.body.conferences[0];
        expect(conference.id).toBeDefined();
        expect(conference.conferenceName).toBeDefined();
        expect(conference.abstractWordLimit).toBeDefined();
        expect(conference.presentationType).toBeDefined();
      });

      it('should include ATA conference', async () => {
        const response = await request(app)
          .get('/api/ros/conference/requirements');

        expect(response.status).toBe(200);
        const ata = response.body.conferences.find(
          (c: any) => c.conferenceAcronym === 'ATA'
        );
        expect(ata).toBeDefined();
        expect(ata.conferenceName).toContain('Thyroid');
      });

      it('should include poster dimensions for conferences', async () => {
        const response = await request(app)
          .get('/api/ros/conference/requirements');

        expect(response.status).toBe(200);
        const conferenceWithDimensions = response.body.conferences.find(
          (c: any) => c.posterDimensions
        );
        expect(conferenceWithDimensions).toBeDefined();
        expect(conferenceWithDimensions.posterDimensions).toHaveProperty('width');
        expect(conferenceWithDimensions.posterDimensions).toHaveProperty('height');
        expect(conferenceWithDimensions.posterDimensions).toHaveProperty('unit');
      });

      it('should include mode indicator in response', async () => {
        const response = await request(app)
          .get('/api/ros/conference/requirements');

        expect(response.status).toBe(200);
        expect(response.body.mode).toBeDefined();
      });
    });

    describe('POST /api/ros/conference/export - Export Conference Materials', () => {
      it('should reject VIEWER role', async () => {
        const exportData = {
          stage_id: 17,
          title: 'Viewer Attempt'
        };

        const response = await request(app)
          .post('/api/ros/conference/export')
          .set(getRoleHeader('VIEWER'))
          .send(exportData);

        expect(response.status).toBe(403);
        expect(response.body.error).toBeDefined();
      });
    });
  });

  // ==========================================
  // PHI ENDPOINTS
  // ==========================================
  describe('PHI Endpoints', () => {
    describe('POST /api/ros/phi/scan - Scan Content for PHI', () => {
      it('should reject VIEWER role', async () => {
        const response = await request(app)
          .post('/api/ros/phi/scan')
          .set(getRoleHeader('VIEWER'))
          .send({ content: 'Viewer attempting scan' });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });

      it('should require RESEARCHER role minimum', async () => {
        const response = await request(app)
          .post('/api/ros/phi/scan')
          .set(getRoleHeader('VIEWER'))
          .send({ content: 'Test' });

        expect(response.body.required).toBe('RESEARCHER');
      });
    });

    describe('POST /api/ros/phi/override - Request Override', () => {
      it('should reject RESEARCHER role (insufficient for override)', async () => {
        const response = await request(app)
          .post('/api/ros/phi/override')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            scanId: 'scan-123',
            justification: 'Researcher attempting override',
            approverRole: 'RESEARCHER'
          });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });

      it('should reject VIEWER role', async () => {
        const response = await request(app)
          .post('/api/ros/phi/override')
          .set(getRoleHeader('VIEWER'))
          .send({
            scanId: 'scan-123',
            justification: 'Viewer attempting override',
            approverRole: 'VIEWER'
          });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });

      it('should require STEWARD role minimum', async () => {
        const response = await request(app)
          .post('/api/ros/phi/override')
          .set(getRoleHeader('RESEARCHER'))
          .send({
            scanId: 'scan-123',
            justification: 'Override attempt',
            approverRole: 'RESEARCHER'
          });

        expect(response.body.required).toBe('STEWARD');
      });
    });
  });

  // ==========================================
  // TOPIC ENDPOINTS
  // ==========================================
  describe('Topic Endpoints', () => {
    describe('POST /api/topics - Create Topic', () => {
      it('should return 400 for missing researchId', async () => {
        const response = await request(app)
          .post('/api/topics')
          .set(getRoleHeader('RESEARCHER'))
          .send({ title: 'Test Topic' });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('MISSING_RESEARCH_ID');
      });

      it('should return 400 for missing title', async () => {
        const response = await request(app)
          .post('/api/topics')
          .set(getRoleHeader('RESEARCHER'))
          .send({ researchId: 'research-123' });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('MISSING_TITLE');
      });

      it('should return proper error structure for missing fields', async () => {
        const response = await request(app)
          .post('/api/topics')
          .set(getRoleHeader('RESEARCHER'))
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
      });
    });

    describe('POST /api/ros/topics/:topicId/lock - Lock Topic', () => {
      it('should reject VIEWER role for locking', async () => {
        const response = await request(app)
          .post('/api/ros/topics/topic-123/lock')
          .set(getRoleHeader('VIEWER'))
          .send({});

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('INSUFFICIENT_ROLE');
      });

      it('should require RESEARCHER role minimum', async () => {
        const response = await request(app)
          .post('/api/ros/topics/topic-123/lock')
          .set(getRoleHeader('VIEWER'))
          .send({});

        expect(response.body.required).toBe('RESEARCHER');
      });
    });
  });

  // ==========================================
  // RBAC ROLE HIERARCHY VERIFICATION
  // ==========================================
  describe('RBAC Role Hierarchy Verification', () => {
    it('VIEWER should be rejected from RESEARCHER+ SAP endpoint', async () => {
      const response = await request(app)
        .post('/api/ros/sap')
        .set(getRoleHeader('VIEWER'))
        .send({ topicId: 'test', researchId: 'test' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_ROLE');
    });

    it('RESEARCHER should be rejected from STEWARD-only SAP approve endpoint', async () => {
      const response = await request(app)
        .post('/api/ros/sap/test/approve')
        .set(getRoleHeader('RESEARCHER'))
        .send({ justification: 'Researcher attempt' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_ROLE');
    });

    it('error responses should include required role information', async () => {
      const response = await request(app)
        .post('/api/ros/sap/test/approve')
        .set(getRoleHeader('VIEWER'))
        .send({ justification: 'Test' });

      expect(response.status).toBe(403);
      expect(response.body.required).toBe('STEWARD');
      expect(response.body.userRole).toBe('VIEWER');
    });

    it('all unauthorized responses should have consistent structure', async () => {
      const testCases = [
        { path: '/api/ros/sap', body: { topicId: 'test', researchId: 'test' }, requiredRole: 'RESEARCHER' },
        { path: '/api/ros/sap/test/approve', body: { justification: 'Test' }, requiredRole: 'STEWARD' },
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post(testCase.path)
          .set(getRoleHeader('VIEWER'))
          .send(testCase.body);

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code', 'INSUFFICIENT_ROLE');
        expect(response.body).toHaveProperty('required', testCase.requiredRole);
        expect(response.body).toHaveProperty('userRole', 'VIEWER');
      }
    });
  });

  // ==========================================
  // RESPONSE STRUCTURE TESTS
  // ==========================================
  describe('Response Structure Tests', () => {
    it('conference requirements should have proper data types', async () => {
      const response = await request(app)
        .get('/api/ros/conference/requirements');

      expect(response.status).toBe(200);
      
      const conference = response.body.conferences[0];
      expect(typeof conference.id).toBe('string');
      expect(typeof conference.conferenceName).toBe('string');
      expect(typeof conference.abstractWordLimit).toBe('number');
      expect(typeof conference.presentationType).toBe('string');
    });

    it('conference requirements should include required sections array', async () => {
      const response = await request(app)
        .get('/api/ros/conference/requirements');

      expect(response.status).toBe(200);
      
      const conference = response.body.conferences[0];
      expect(Array.isArray(conference.requiredSections)).toBe(true);
      expect(conference.requiredSections.length).toBeGreaterThan(0);
    });

    it('RBAC error responses should have correct HTTP status', async () => {
      const response = await request(app)
        .post('/api/ros/sap')
        .set(getRoleHeader('VIEWER'))
        .send({ topicId: 'test', researchId: 'test' });

      expect(response.status).toBe(403);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  // ==========================================
  // INPUT VALIDATION TESTS  
  // ==========================================
  describe('Input Validation Tests', () => {
    describe('Topic Creation Validation', () => {
      it('should validate researchId is required', async () => {
        const response = await request(app)
          .post('/api/topics')
          .set(getRoleHeader('RESEARCHER'))
          .send({ title: 'Valid Title' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('researchId');
      });

      it('should validate title is required', async () => {
        const response = await request(app)
          .post('/api/topics')
          .set(getRoleHeader('RESEARCHER'))
          .send({ researchId: 'valid-research-id' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('title');
      });
    });
  });
});
