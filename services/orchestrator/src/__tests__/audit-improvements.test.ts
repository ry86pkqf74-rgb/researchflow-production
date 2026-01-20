/**
 * Audit Improvements Test Suite
 *
 * Tests for the production codebase audit improvements:
 * - Section 1: Code Quality and Structure (route modularity, auth isolation)
 * - Section 2: Deployment and Production Readiness (JWT auth)
 * - Section 3: Feature Completeness (Manuscript Engine)
 * - Section 4: Interface and Integration (auth UI hooks)
 * - Section 5: Open Issues (integration tests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Section 1: Code Quality Tests
// ============================================

describe('Audit Section 1: Code Quality and Structure', () => {
  describe('Static Data Modules', () => {
    it('should export workflow stage groups with correct structure', async () => {
      const { workflowStageGroups, getAllStages, getStageById } = await import('../data/workflowStages');

      expect(workflowStageGroups).toBeDefined();
      expect(Array.isArray(workflowStageGroups)).toBe(true);
      expect(workflowStageGroups.length).toBeGreaterThan(0);

      // Check structure of first group
      const firstGroup = workflowStageGroups[0];
      expect(firstGroup).toHaveProperty('id');
      expect(firstGroup).toHaveProperty('name');
      expect(firstGroup).toHaveProperty('stages');
      expect(Array.isArray(firstGroup.stages)).toBe(true);
    });

    it('should get all stages flattened', async () => {
      const { getAllStages } = await import('../data/workflowStages');
      const stages = getAllStages();

      expect(Array.isArray(stages)).toBe(true);
      expect(stages.length).toBeGreaterThan(15); // At least 16 stages
    });

    it('should get stage by ID', async () => {
      const { getStageById } = await import('../data/workflowStages');

      const stage1 = getStageById(1);
      expect(stage1).toBeDefined();
      expect(stage1?.name).toBe('Topic Declaration');

      const nonExistent = getStageById(999);
      expect(nonExistent).toBeUndefined();
    });

    it('should export research datasets with correct structure', async () => {
      const { researchDatasets, getDatasetById } = await import('../data/researchDatasets');

      expect(researchDatasets).toBeDefined();
      expect(Array.isArray(researchDatasets)).toBe(true);
      expect(researchDatasets.length).toBeGreaterThan(0);

      // Check dataset structure
      const dataset = researchDatasets[0];
      expect(dataset).toHaveProperty('id');
      expect(dataset).toHaveProperty('name');
      expect(dataset).toHaveProperty('domain');
      expect(dataset).toHaveProperty('records');
    });

    it('should get dataset by ID', async () => {
      const { getDatasetById } = await import('../data/researchDatasets');

      const dataset = getDatasetById('thyroid-clinical-2024');
      expect(dataset).toBeDefined();
      expect(dataset?.name).toBe('Thyroid Clinical Dataset');
    });
  });

  describe('Lifecycle Service', () => {
    it('should export lifecycle service with all functions', async () => {
      const {
        lifecycleService,
        getSessionState,
        mapStageToLifecycleState,
        isAIEnabledStage,
        requiresAttestation
      } = await import('../services/lifecycleService');

      expect(lifecycleService).toBeDefined();
      expect(typeof getSessionState).toBe('function');
      expect(typeof mapStageToLifecycleState).toBe('function');
      expect(typeof isAIEnabledStage).toBe('function');
      expect(typeof requiresAttestation).toBe('function');
    });

    it('should create session state on first access', async () => {
      const { getSessionState, resetSession } = await import('../services/lifecycleService');

      // Reset to ensure clean state
      resetSession('test-session-1');

      const state = getSessionState('test-session-1');
      expect(state).toBeDefined();
      expect(state.currentLifecycleState).toBe('DRAFT');
      expect(state.approvedAIStages).toBeInstanceOf(Set);
      expect(state.completedStages).toBeInstanceOf(Set);
    });

    it('should map stages to lifecycle states correctly', async () => {
      const { mapStageToLifecycleState } = await import('../services/lifecycleService');

      expect(mapStageToLifecycleState(1)).toBe('DRAFT');
      expect(mapStageToLifecycleState(2)).toBe('SPEC_DEFINED');
      expect(mapStageToLifecycleState(4)).toBe('EXTRACTION_COMPLETE');
      expect(mapStageToLifecycleState(13)).toBe('IN_ANALYSIS');
      expect(mapStageToLifecycleState(15)).toBe('FROZEN');
    });

    it('should identify AI-enabled stages', async () => {
      const { isAIEnabledStage, AI_ENABLED_STAGES } = await import('../services/lifecycleService');

      expect(isAIEnabledStage(2)).toBe(true);
      expect(isAIEnabledStage(13)).toBe(true);
      expect(isAIEnabledStage(1)).toBe(false);
      expect(AI_ENABLED_STAGES).toContain(2);
    });

    it('should approve and revoke AI stages', async () => {
      const {
        approveAIStage,
        revokeAIStage,
        isAIApproved,
        resetSession
      } = await import('../services/lifecycleService');

      resetSession('test-session-ai');

      // Initially not approved
      expect(isAIApproved('test-session-ai', 2)).toBe(false);

      // Approve stage 2
      const result = approveAIStage('test-session-ai', 2, 'Literature Search');
      expect(result.success).toBe(true);
      expect(isAIApproved('test-session-ai', 2)).toBe(true);

      // Revoke
      revokeAIStage('test-session-ai', 2, 'Literature Search');
      expect(isAIApproved('test-session-ai', 2)).toBe(false);
    });

    it('should track audit log entries', async () => {
      const {
        addAuditLogEntry,
        getAuditLog,
        resetSession
      } = await import('../services/lifecycleService');

      resetSession('test-session-audit');

      addAuditLogEntry('test-session-audit', {
        timestamp: new Date().toISOString(),
        action: 'TEST_ACTION',
        details: 'Test entry'
      });

      const log = getAuditLog('test-session-audit');
      expect(log.length).toBeGreaterThan(0);
      expect(log.some(e => e.action === 'TEST_ACTION')).toBe(true);
    });
  });
});

// ============================================
// Section 2: Authentication Tests
// ============================================

describe('Audit Section 2: JWT Authentication', () => {
  describe('Auth Service', () => {
    it('should export auth service with all functions', async () => {
      const {
        authService,
        hashPassword,
        verifyPassword,
        generateAccessToken,
        verifyAccessToken,
        registerUser,
        loginUser
      } = await import('../services/authService');

      expect(authService).toBeDefined();
      expect(typeof hashPassword).toBe('function');
      expect(typeof verifyPassword).toBe('function');
      expect(typeof generateAccessToken).toBe('function');
      expect(typeof verifyAccessToken).toBe('function');
      expect(typeof registerUser).toBe('function');
      expect(typeof loginUser).toBe('function');
    });

    it('should hash and verify passwords', async () => {
      const { hashPassword, verifyPassword } = await import('../services/authService');

      const password = 'testPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should generate and verify access tokens', async () => {
      const { generateAccessToken, verifyAccessToken, devFallbackUser } = await import('../services/authService');

      const token = generateAccessToken(devFallbackUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts

      const payload = verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(devFallbackUser.id);
      expect(payload?.email).toBe(devFallbackUser.email);
    });

    it('should register new users', async () => {
      const { registerUser } = await import('../services/authService');

      const result = await registerUser({
        email: `test-${Date.now()}@example.com`,
        password: 'securePassword123!',
        firstName: 'Test',
        lastName: 'User'
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should prevent duplicate email registration', async () => {
      const { registerUser } = await import('../services/authService');

      const email = `duplicate-${Date.now()}@example.com`;

      // First registration
      await registerUser({
        email,
        password: 'password123!',
      });

      // Second registration with same email
      const result = await registerUser({
        email,
        password: 'password456!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });

    it('should login users with correct credentials', async () => {
      const { registerUser, loginUser } = await import('../services/authService');

      const email = `login-test-${Date.now()}@example.com`;
      const password = 'loginPassword123!';

      // Register first
      await registerUser({ email, password });

      // Login
      const result = await loginUser({ email, password });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const { registerUser, loginUser } = await import('../services/authService');

      const email = `wrong-pass-${Date.now()}@example.com`;

      await registerUser({
        email,
        password: 'correctPassword123!',
      });

      const result = await loginUser({
        email,
        password: 'wrongPassword456!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should export dev fallback user', async () => {
      const { devFallbackUser } = await import('../services/authService');

      expect(devFallbackUser).toBeDefined();
      expect(devFallbackUser.id).toBeDefined();
      expect(devFallbackUser.email).toBe('dev@researchflow.local');
      expect(devFallbackUser.role).toBe('admin');
    });
  });
});

// ============================================
// Section 3: Manuscript Engine Tests
// ============================================

describe('Audit Section 3: Manuscript Engine', () => {
  it('should export main index from manuscript-engine', async () => {
    // This tests that the index.ts we created properly exports everything
    const manuscriptEngine = await import('@researchflow/manuscript-engine');

    expect(manuscriptEngine).toBeDefined();
    expect(manuscriptEngine.VERSION).toBe('1.0.0');
    expect(manuscriptEngine.PACKAGE_NAME).toBe('@researchflow/manuscript-engine');
  });

  it('should export all Phase 4 writing services', async () => {
    const services = await import('@researchflow/manuscript-engine');

    // Check Phase 4 services exist
    expect(services.grammarCheckerService).toBeDefined();
    expect(services.readabilityService).toBeDefined();
    expect(services.toneAdjusterService).toBeDefined();
    expect(services.clarityAnalyzerService).toBeDefined();
    expect(services.paraphraseService).toBeDefined();
  });

  it('should export all Phase 5 export services', async () => {
    const services = await import('@researchflow/manuscript-engine');

    expect(services.exportService).toBeDefined();
    expect(services.complianceCheckerService).toBeDefined();
    expect(services.peerReviewService).toBeDefined();
    expect(services.finalPhiScanService).toBeDefined();
  });
});

// ============================================
// Section 4: Route Tests
// ============================================

describe('Audit Section 4: Modular Routes', () => {
  describe('Workflow Stages Routes', () => {
    it('should export workflow stages router', async () => {
      const router = await import('../routes/workflow-stages');
      expect(router.default).toBeDefined();
    });
  });

  describe('Auth Routes', () => {
    it('should export auth router', async () => {
      const router = await import('../routes/auth');
      expect(router.default).toBeDefined();
    });
  });
});

// ============================================
// Section 5: Integration Ready Tests
// ============================================

describe('Audit Section 5: Integration Readiness', () => {
  it('should have proper exports from data module index', async () => {
    const dataModule = await import('../data');

    expect(dataModule.workflowStageGroups).toBeDefined();
    expect(dataModule.researchDatasets).toBeDefined();
    expect(dataModule.getAllStages).toBeDefined();
    expect(dataModule.getDatasetById).toBeDefined();
  });

  it('should validate lifecycle state transitions', async () => {
    const { VALID_TRANSITIONS, isValidTransition } = await import('../services/lifecycleService');

    // Valid transitions
    expect(isValidTransition('DRAFT', 'SPEC_DEFINED')).toBe(true);
    expect(isValidTransition('QA_PASSED', 'ANALYSIS_READY')).toBe(true);

    // Invalid transitions
    expect(isValidTransition('DRAFT', 'FROZEN')).toBe(false);
    expect(isValidTransition('ARCHIVED', 'DRAFT')).toBe(false);

    // VALID_TRANSITIONS should be defined
    expect(VALID_TRANSITIONS).toBeDefined();
    expect(VALID_TRANSITIONS['DRAFT']).toContain('SPEC_DEFINED');
  });
});
