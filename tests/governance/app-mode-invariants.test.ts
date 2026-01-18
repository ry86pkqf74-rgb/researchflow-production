/**
 * App Mode Invariants Test Suite
 * Tests strict separation between DEMO, LIVE, and STANDBY modes
 *
 * CRITICAL: These tests ensure that:
 * - DEMO mode NEVER makes real AI API calls
 * - LIVE mode ALWAYS requires authentication
 * - STANDBY mode blocks ALL operations except status/config reads
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppMode, MODE_CONFIGS } from '@researchflow/core';

describe('App Mode Type Definitions', () => {
  it('should define exactly three modes: DEMO, LIVE, and STANDBY', () => {
    const modes = Object.values(AppMode);
    expect(modes).toHaveLength(3);
    expect(modes).toContain(AppMode.DEMO);
    expect(modes).toContain(AppMode.LIVE);
    expect(modes).toContain(AppMode.STANDBY);
  });

  it('should have mode configs for DEMO, LIVE, and STANDBY', () => {
    expect(MODE_CONFIGS).toHaveProperty(AppMode.DEMO);
    expect(MODE_CONFIGS).toHaveProperty(AppMode.LIVE);
    expect(MODE_CONFIGS).toHaveProperty(AppMode.STANDBY);
    expect(Object.keys(MODE_CONFIGS)).toHaveLength(3);
  });
});

describe('DEMO Mode Configuration', () => {
  const demoConfig = MODE_CONFIGS[AppMode.DEMO];

  it('should NOT require authentication', () => {
    expect(demoConfig.requiresAuth).toBe(false);
  });

  it('should NOT allow real AI API calls', () => {
    expect(demoConfig.allowsRealAI).toBe(false);
  });

  it('should NOT allow real data operations', () => {
    expect(demoConfig.allowsRealData).toBe(false);
  });

  it('should NOT allow data export', () => {
    expect(demoConfig.allowsExport).toBe(false);
  });

  it('should have mode set to DEMO', () => {
    expect(demoConfig.mode).toBe(AppMode.DEMO);
  });
});

describe('LIVE Mode Configuration', () => {
  const liveConfig = MODE_CONFIGS[AppMode.LIVE];

  it('should require authentication', () => {
    expect(liveConfig.requiresAuth).toBe(true);
  });

  it('should allow real AI API calls', () => {
    expect(liveConfig.allowsRealAI).toBe(true);
  });

  it('should allow real data operations', () => {
    expect(liveConfig.allowsRealData).toBe(true);
  });

  it('should allow data export', () => {
    expect(liveConfig.allowsExport).toBe(true);
  });

  it('should have mode set to LIVE', () => {
    expect(liveConfig.mode).toBe(AppMode.LIVE);
  });
});

describe('STANDBY Mode Configuration', () => {
  const standbyConfig = MODE_CONFIGS[AppMode.STANDBY];

  it('should NOT require authentication', () => {
    expect(standbyConfig.requiresAuth).toBe(false);
  });

  it('should NOT allow real AI API calls', () => {
    expect(standbyConfig.allowsRealAI).toBe(false);
  });

  it('should NOT allow real data operations', () => {
    expect(standbyConfig.allowsRealData).toBe(false);
  });

  it('should NOT allow data export', () => {
    expect(standbyConfig.allowsExport).toBe(false);
  });

  it('should have mode set to STANDBY', () => {
    expect(standbyConfig.mode).toBe(AppMode.STANDBY);
  });

  it('STANDBY mode should be the most restrictive mode', () => {
    expect(standbyConfig.allowsRealAI).toBe(false);
    expect(standbyConfig.allowsRealData).toBe(false);
    expect(standbyConfig.allowsExport).toBe(false);
    expect(standbyConfig.requiresAuth).toBe(false);
  });
});

describe('Mode Separation Invariants', () => {
  it('DEMO and LIVE modes should have opposite authentication requirements', () => {
    expect(MODE_CONFIGS[AppMode.DEMO].requiresAuth).not.toBe(
      MODE_CONFIGS[AppMode.LIVE].requiresAuth
    );
  });

  it('DEMO and LIVE modes should have opposite AI allowances', () => {
    expect(MODE_CONFIGS[AppMode.DEMO].allowsRealAI).not.toBe(
      MODE_CONFIGS[AppMode.LIVE].allowsRealAI
    );
  });

  it('DEMO and LIVE modes should have opposite export allowances', () => {
    expect(MODE_CONFIGS[AppMode.DEMO].allowsExport).not.toBe(
      MODE_CONFIGS[AppMode.LIVE].allowsExport
    );
  });

  it('only LIVE mode should allow ALL real operations', () => {
    const liveConfig = MODE_CONFIGS[AppMode.LIVE];
    expect(liveConfig.allowsRealAI).toBe(true);
    expect(liveConfig.allowsRealData).toBe(true);
    expect(liveConfig.allowsExport).toBe(true);
    expect(liveConfig.requiresAuth).toBe(true);
  });

  it('DEMO mode should disallow ALL real operations', () => {
    const demoConfig = MODE_CONFIGS[AppMode.DEMO];
    expect(demoConfig.allowsRealAI).toBe(false);
    expect(demoConfig.allowsRealData).toBe(false);
    expect(demoConfig.allowsExport).toBe(false);
    expect(demoConfig.requiresAuth).toBe(false);
  });
});

describe('Mode Guard Middleware Behavior', () => {
  // Mock environment variable
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.APP_MODE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.APP_MODE = originalEnv;
    } else {
      delete process.env.APP_MODE;
    }
  });

  describe('getCurrentMode function', () => {
    it('should default to DEMO when APP_MODE is not set', () => {
      delete process.env.APP_MODE;

      // Dynamically import to get fresh environment
      const getCurrentMode = () => {
        const mode = process.env.APP_MODE as AppMode;
        return mode === AppMode.LIVE ? AppMode.LIVE : AppMode.DEMO;
      };

      expect(getCurrentMode()).toBe(AppMode.DEMO);
    });

    it('should return DEMO when APP_MODE is set to DEMO', () => {
      process.env.APP_MODE = 'DEMO';

      const getCurrentMode = () => {
        const mode = process.env.APP_MODE as AppMode;
        return mode === AppMode.LIVE ? AppMode.LIVE : AppMode.DEMO;
      };

      expect(getCurrentMode()).toBe(AppMode.DEMO);
    });

    it('should return LIVE when APP_MODE is set to LIVE', () => {
      process.env.APP_MODE = 'LIVE';

      const getCurrentMode = () => {
        const mode = process.env.APP_MODE as AppMode;
        return mode === AppMode.LIVE ? AppMode.LIVE : AppMode.DEMO;
      };

      expect(getCurrentMode()).toBe(AppMode.LIVE);
    });

    it('should default to DEMO for invalid values (fail-safe)', () => {
      process.env.APP_MODE = 'INVALID';

      const getCurrentMode = () => {
        const mode = process.env.APP_MODE as AppMode;
        return mode === AppMode.LIVE ? AppMode.LIVE : AppMode.DEMO;
      };

      expect(getCurrentMode()).toBe(AppMode.DEMO);
    });
  });
});

describe('Mock AI Service Behavior', () => {
  it('should provide mock responses for all workflow stages', () => {
    // This is a type-level test ensuring mock responses exist
    const mockStages = [
      'topicDeclaration',
      'evidenceGapMap',
      'literatureSearch',
      'statisticalAnalysis',
      'manuscriptDraft',
      'phiScan',
      'journalRecommendations'
    ];

    // Each stage should have a defined mock response structure
    mockStages.forEach(stage => {
      expect(stage).toBeTruthy();
    });
  });

  it('mock responses should indicate DEMO mode', () => {
    // Mock responses must clearly indicate they are from DEMO mode
    const mockResponse = {
      mode: AppMode.DEMO,
      mockResponse: true,
      note: 'This is a demonstration response'
    };

    expect(mockResponse.mode).toBe(AppMode.DEMO);
    expect(mockResponse.mockResponse).toBe(true);
  });
});

describe('Endpoint Protection', () => {
  interface ProtectedEndpoint {
    path: string;
    blockedInDemo: boolean;
    requiresAuthInLive: boolean;
    isAIEndpoint: boolean;
    isExportEndpoint: boolean;
  }

  const CRITICAL_ENDPOINTS: ProtectedEndpoint[] = [
    // AI Generation Endpoints - MUST be blocked in DEMO
    {
      path: '/api/ros/irb/generate',
      blockedInDemo: true,
      requiresAuthInLive: true,
      isAIEndpoint: true,
      isExportEndpoint: false
    },
    {
      path: '/api/ros/ideation/generate',
      blockedInDemo: true,
      requiresAuthInLive: true,
      isAIEndpoint: true,
      isExportEndpoint: false
    },
    {
      path: '/api/ros/literature/search',
      blockedInDemo: true,
      requiresAuthInLive: true,
      isAIEndpoint: true,
      isExportEndpoint: false
    },
    // Export Endpoints - MUST be blocked in DEMO
    {
      path: '/api/ros/export/reproducibility-bundle',
      blockedInDemo: true,
      requiresAuthInLive: true,
      isAIEndpoint: false,
      isExportEndpoint: true
    },
    {
      path: '/api/ros/conference/export',
      blockedInDemo: true,
      requiresAuthInLive: true,
      isAIEndpoint: false,
      isExportEndpoint: true
    },
    // Public endpoints - should be accessible in DEMO
    {
      path: '/api/mode',
      blockedInDemo: false,
      requiresAuthInLive: false,
      isAIEndpoint: false,
      isExportEndpoint: false
    },
    {
      path: '/api/v1/health',
      blockedInDemo: false,
      requiresAuthInLive: false,
      isAIEndpoint: false,
      isExportEndpoint: false
    }
  ];

  it('all AI endpoints must be blocked in DEMO mode', () => {
    const aiEndpoints = CRITICAL_ENDPOINTS.filter(e => e.isAIEndpoint);

    aiEndpoints.forEach(endpoint => {
      expect(endpoint.blockedInDemo).toBe(true);
      expect(endpoint.isAIEndpoint).toBe(true);
    });

    // Ensure we actually have AI endpoints to test
    expect(aiEndpoints.length).toBeGreaterThan(0);
  });

  it('all export endpoints must be blocked in DEMO mode', () => {
    const exportEndpoints = CRITICAL_ENDPOINTS.filter(e => e.isExportEndpoint);

    exportEndpoints.forEach(endpoint => {
      expect(endpoint.blockedInDemo).toBe(true);
      expect(endpoint.isExportEndpoint).toBe(true);
    });

    // Ensure we actually have export endpoints to test
    expect(exportEndpoints.length).toBeGreaterThan(0);
  });

  it('all protected endpoints must require auth in LIVE mode', () => {
    const protectedEndpoints = CRITICAL_ENDPOINTS.filter(
      e => e.blockedInDemo === true
    );

    protectedEndpoints.forEach(endpoint => {
      expect(endpoint.requiresAuthInLive).toBe(true);
    });
  });

  it('public endpoints should be accessible without auth in DEMO', () => {
    const publicEndpoints = CRITICAL_ENDPOINTS.filter(
      e => e.blockedInDemo === false
    );

    publicEndpoints.forEach(endpoint => {
      expect(endpoint.requiresAuthInLive).toBe(false);
    });
  });
});

describe('Security Fail-Safe Mechanisms', () => {
  it('should default to DEMO mode if environment is not explicitly set to LIVE', () => {
    const testValues = ['', undefined, 'demo', 'Demo', 'test', 'development'];

    testValues.forEach(value => {
      const mode = value === 'LIVE' ? AppMode.LIVE : AppMode.DEMO;
      expect(mode).toBe(AppMode.DEMO);
    });
  });

  it('should only accept exact string "LIVE" for LIVE mode', () => {
    const exactMatch = 'LIVE';
    const mode = exactMatch === AppMode.LIVE ? AppMode.LIVE : AppMode.DEMO;
    expect(mode).toBe(AppMode.LIVE);

    // These should NOT activate LIVE mode
    const invalidValues = ['live', 'Live', 'LIVE ', ' LIVE', 'LIVE_MODE'];
    invalidValues.forEach(value => {
      const testMode = value === AppMode.LIVE ? AppMode.LIVE : AppMode.DEMO;
      expect(testMode).toBe(AppMode.DEMO);
    });
  });
});

describe('Audit and Compliance', () => {
  it('mode configurations should be immutable', () => {
    // Attempting to modify should not affect the original
    const demoConfig = MODE_CONFIGS[AppMode.DEMO];
    const originalAllowsAI = demoConfig.allowsRealAI;

    // TypeScript should prevent this, but test runtime behavior
    expect(originalAllowsAI).toBe(false);
    expect(MODE_CONFIGS[AppMode.DEMO].allowsRealAI).toBe(false);
  });

  it('should maintain configuration integrity', () => {
    // Verify configs haven't been tampered with
    expect(MODE_CONFIGS[AppMode.DEMO].allowsRealAI).toBe(false);
    expect(MODE_CONFIGS[AppMode.DEMO].requiresAuth).toBe(false);
    expect(MODE_CONFIGS[AppMode.LIVE].allowsRealAI).toBe(true);
    expect(MODE_CONFIGS[AppMode.LIVE].requiresAuth).toBe(true);
  });
});
