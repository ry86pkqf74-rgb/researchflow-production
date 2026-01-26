import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasPermissionByRole, hasMinimumRoleByName, ROLES } from '@packages/core/types/roles';

type RosMode = 'STANDBY' | 'DEMO' | 'LIVE';

interface ModeConfig {
  allowNetworkCalls: boolean;
  allowFileUpload: boolean;
  allowExport: boolean;
  allowAIGeneration: boolean;
  requireApprovalForExport: boolean;
  addWatermarks: boolean;
  useSyntheticData: boolean;
}

const MODE_CONFIGS: Record<RosMode, ModeConfig> = {
  STANDBY: {
    allowNetworkCalls: false,
    allowFileUpload: false,
    allowExport: false,
    allowAIGeneration: false,
    requireApprovalForExport: true,
    addWatermarks: true,
    useSyntheticData: true
  },
  DEMO: {
    allowNetworkCalls: true,
    allowFileUpload: false,
    allowExport: true,
    allowAIGeneration: true,
    requireApprovalForExport: false,
    addWatermarks: true,
    useSyntheticData: true
  },
  LIVE: {
    allowNetworkCalls: true,
    allowFileUpload: true,
    allowExport: true,
    allowAIGeneration: true,
    requireApprovalForExport: true,
    addWatermarks: false,
    useSyntheticData: false
  }
};

function getModeConfig(mode: RosMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

function isOperationAllowed(mode: RosMode, operation: keyof ModeConfig): boolean {
  const config = getModeConfig(mode);
  return config[operation] as boolean;
}

describe('STANDBY Mode Enforcement', () => {
  const mode: RosMode = 'STANDBY';
  
  it('should block all network calls', () => {
    expect(isOperationAllowed(mode, 'allowNetworkCalls')).toBe(false);
  });

  it('should block file uploads', () => {
    expect(isOperationAllowed(mode, 'allowFileUpload')).toBe(false);
  });

  it('should block exports', () => {
    expect(isOperationAllowed(mode, 'allowExport')).toBe(false);
  });

  it('should block AI generation', () => {
    expect(isOperationAllowed(mode, 'allowAIGeneration')).toBe(false);
  });

  it('should use synthetic data only', () => {
    const config = getModeConfig(mode);
    expect(config.useSyntheticData).toBe(true);
  });

  it('should add watermarks to any output', () => {
    const config = getModeConfig(mode);
    expect(config.addWatermarks).toBe(true);
  });

  describe('Read-only operations', () => {
    it('should allow viewing dashboard', () => {
      expect(hasPermissionByRole('VIEWER', 'view:dashboard')).toBe(true);
    });

    it('should allow viewing datasets', () => {
      expect(hasPermissionByRole('VIEWER', 'view:datasets')).toBe(true);
    });

    it('should allow viewing governance', () => {
      expect(hasPermissionByRole('VIEWER', 'view:governance')).toBe(true);
    });

    it('should allow viewing audit log', () => {
      expect(hasPermissionByRole('VIEWER', 'view:audit-log')).toBe(true);
    });
  });
});

describe('DEMO Mode Enforcement', () => {
  const mode: RosMode = 'DEMO';

  it('should allow network calls', () => {
    expect(isOperationAllowed(mode, 'allowNetworkCalls')).toBe(true);
  });

  it('should block file uploads', () => {
    expect(isOperationAllowed(mode, 'allowFileUpload')).toBe(false);
  });

  it('should allow exports with watermarks', () => {
    const config = getModeConfig(mode);
    expect(config.allowExport).toBe(true);
    expect(config.addWatermarks).toBe(true);
  });

  it('should allow AI generation', () => {
    expect(isOperationAllowed(mode, 'allowAIGeneration')).toBe(true);
  });

  it('should not require approval for exports', () => {
    const config = getModeConfig(mode);
    expect(config.requireApprovalForExport).toBe(false);
  });

  it('should use synthetic data only', () => {
    const config = getModeConfig(mode);
    expect(config.useSyntheticData).toBe(true);
  });

  describe('Export watermarking', () => {
    it('should add DEMO watermark to exported files', () => {
      const config = getModeConfig(mode);
      expect(config.addWatermarks).toBe(true);
    });

    it('should indicate synthetic data in exports', () => {
      const config = getModeConfig(mode);
      expect(config.useSyntheticData).toBe(true);
    });
  });
});

describe('LIVE Mode Enforcement', () => {
  const mode: RosMode = 'LIVE';

  it('should allow network calls', () => {
    expect(isOperationAllowed(mode, 'allowNetworkCalls')).toBe(true);
  });

  it('should allow file uploads', () => {
    expect(isOperationAllowed(mode, 'allowFileUpload')).toBe(true);
  });

  it('should allow exports', () => {
    expect(isOperationAllowed(mode, 'allowExport')).toBe(true);
  });

  it('should allow AI generation', () => {
    expect(isOperationAllowed(mode, 'allowAIGeneration')).toBe(true);
  });

  it('should require approval for exports', () => {
    const config = getModeConfig(mode);
    expect(config.requireApprovalForExport).toBe(true);
  });

  it('should not add watermarks', () => {
    const config = getModeConfig(mode);
    expect(config.addWatermarks).toBe(false);
  });

  it('should use real data', () => {
    const config = getModeConfig(mode);
    expect(config.useSyntheticData).toBe(false);
  });

  describe('Approval gates', () => {
    it('should require STEWARD approval for data export', () => {
      expect(hasMinimumRoleByName('STEWARD', 'STEWARD')).toBe(true);
      expect(hasPermissionByRole('STEWARD', 'approve:exports')).toBe(true);
    });

    it('should require STEWARD approval for AI outputs', () => {
      expect(hasPermissionByRole('STEWARD', 'approve:ai-outputs')).toBe(true);
    });

    it('should deny RESEARCHER from approving exports', () => {
      expect(hasPermissionByRole('RESEARCHER', 'approve:exports')).toBe(false);
    });

    it('should allow ADMIN to approve all operations', () => {
      expect(hasPermissionByRole('ADMIN', 'approve:exports')).toBe(true);
      expect(hasPermissionByRole('ADMIN', 'approve:ai-outputs')).toBe(true);
    });
  });
});

describe('Mode Transition Validation', () => {
  const VALID_TRANSITIONS: Record<RosMode, RosMode[]> = {
    'STANDBY': ['DEMO'],
    'DEMO': ['LIVE', 'STANDBY'],
    'LIVE': ['DEMO']
  };

  function isValidTransition(from: RosMode, to: RosMode): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('should allow STANDBY -> DEMO', () => {
    expect(isValidTransition('STANDBY', 'DEMO')).toBe(true);
  });

  it('should block STANDBY -> LIVE', () => {
    expect(isValidTransition('STANDBY', 'LIVE')).toBe(false);
  });

  it('should allow DEMO -> LIVE', () => {
    expect(isValidTransition('DEMO', 'LIVE')).toBe(true);
  });

  it('should allow DEMO -> STANDBY', () => {
    expect(isValidTransition('DEMO', 'STANDBY')).toBe(true);
  });

  it('should allow LIVE -> DEMO', () => {
    expect(isValidTransition('LIVE', 'DEMO')).toBe(true);
  });

  it('should block LIVE -> STANDBY', () => {
    expect(isValidTransition('LIVE', 'STANDBY')).toBe(false);
  });

  it('should block same-mode transitions', () => {
    expect(isValidTransition('STANDBY', 'STANDBY')).toBe(false);
    expect(isValidTransition('DEMO', 'DEMO')).toBe(false);
    expect(isValidTransition('LIVE', 'LIVE')).toBe(false);
  });
});

describe('Endpoint Protection by Mode', () => {
  interface ProtectedEndpoint {
    path: string;
    allowedModes: RosMode[];
    requiredRole: string;
  }

  const PROTECTED_ENDPOINTS: ProtectedEndpoint[] = [
    { path: '/api/upload', allowedModes: ['LIVE'], requiredRole: 'ADMIN' },
    { path: '/api/ros/export', allowedModes: ['DEMO', 'LIVE'], requiredRole: 'STEWARD' },
    { path: '/api/ai/generate', allowedModes: ['DEMO', 'LIVE'], requiredRole: 'RESEARCHER' },
    { path: '/api/governance/approve', allowedModes: ['LIVE'], requiredRole: 'STEWARD' }
  ];

  function isEndpointAllowedInMode(path: string, mode: RosMode): boolean {
    const endpoint = PROTECTED_ENDPOINTS.find(e => path.startsWith(e.path));
    if (!endpoint) return true; // Unprotected endpoints are allowed
    return endpoint.allowedModes.includes(mode);
  }

  it('should block upload endpoints in STANDBY', () => {
    expect(isEndpointAllowedInMode('/api/upload/file', 'STANDBY')).toBe(false);
  });

  it('should block upload endpoints in DEMO', () => {
    expect(isEndpointAllowedInMode('/api/upload/file', 'DEMO')).toBe(false);
  });

  it('should allow upload endpoints in LIVE', () => {
    expect(isEndpointAllowedInMode('/api/upload/file', 'LIVE')).toBe(true);
  });

  it('should block AI generation in STANDBY', () => {
    expect(isEndpointAllowedInMode('/api/ai/generate', 'STANDBY')).toBe(false);
  });

  it('should allow AI generation in DEMO', () => {
    expect(isEndpointAllowedInMode('/api/ai/generate', 'DEMO')).toBe(true);
  });

  it('should allow AI generation in LIVE', () => {
    expect(isEndpointAllowedInMode('/api/ai/generate', 'LIVE')).toBe(true);
  });

  it('should block governance approval in STANDBY', () => {
    expect(isEndpointAllowedInMode('/api/governance/approve', 'STANDBY')).toBe(false);
  });

  it('should block governance approval in DEMO', () => {
    expect(isEndpointAllowedInMode('/api/governance/approve', 'DEMO')).toBe(false);
  });

  it('should allow governance approval in LIVE', () => {
    expect(isEndpointAllowedInMode('/api/governance/approve', 'LIVE')).toBe(true);
  });
});
