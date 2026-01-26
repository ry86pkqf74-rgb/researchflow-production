import { describe, it, expect } from 'vitest';
import { createPolicyEngine } from '../policy-engine';
import type { PolicyContext } from '../../types/policy';

describe('PolicyEngine', () => {
  const engine = createPolicyEngine();

  describe('DEMO mode', () => {
    const demoContext = (action: string, resource: string): PolicyContext => ({
      mode: 'DEMO',
      role: 'VIEWER',
      action,
      resource,
    });

    it('allows view actions', () => {
      const result = engine.evaluate(demoContext('view', 'workflow'));
      expect(result.allowed).toBe(true);
    });

    it('allows list actions', () => {
      const result = engine.evaluate(demoContext('list', 'workflows'));
      expect(result.allowed).toBe(true);
    });

    it('allows search actions', () => {
      const result = engine.evaluate(demoContext('search', 'data'));
      expect(result.allowed).toBe(true);
    });

    it('blocks export actions', () => {
      const result = engine.evaluate(demoContext('export', 'data'));
      expect(result.allowed).toBe(false);
    });

    it('blocks access to PHI resources', () => {
      const result = engine.evaluate(demoContext('view', 'phi-data'));
      expect(result.allowed).toBe(false);
    });

    it('blocks access to export resources', () => {
      const result = engine.evaluate(demoContext('view', 'export-config'));
      expect(result.allowed).toBe(false);
    });

    it('blocks access to audit resources', () => {
      const result = engine.evaluate(demoContext('view', 'audit-logs'));
      expect(result.allowed).toBe(false);
    });

    it('does not require audit logging', () => {
      const result = engine.evaluate(demoContext('view', 'workflow'));
      expect(result.auditRequired).toBe(false);
    });

    it('blocks PHI access', () => {
      expect(engine.canAccessPhi(demoContext('view', 'phi'))).toBe(false);
    });

    it('blocks PHI reveal', () => {
      expect(engine.canRevealPhi(demoContext('reveal', 'phi'))).toBe(false);
    });

    it('blocks data export', () => {
      expect(engine.canExportData(demoContext('export', 'data'))).toBe(false);
    });
  });

  describe('IDENTIFIED mode', () => {
    describe('VIEWER role', () => {
      it('allows view actions', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'view', resource: 'workflow' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('allows list actions', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'list', resource: 'workflows' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('blocks analyze actions', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'analyze', resource: 'data' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(false);
      });

      it('cannot access PHI', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'view', resource: 'phi' };
        expect(engine.canAccessPhi(ctx)).toBe(false);
      });

      it('cannot reveal PHI', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'reveal', resource: 'phi' };
        expect(engine.canRevealPhi(ctx)).toBe(false);
      });

      it('cannot export data', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'export', resource: 'data' };
        expect(engine.canExportData(ctx)).toBe(false);
      });

      it('cannot modify workflows', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'modify', resource: 'workflow' };
        expect(engine.canModifyWorkflow(ctx)).toBe(false);
      });
    });

    describe('ANALYST role', () => {
      it('allows analyze actions', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'analyze', resource: 'data' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('allows search actions', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'search', resource: 'data' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('allows access_phi action', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'access_phi', resource: 'data' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('can access PHI', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'view', resource: 'phi' };
        expect(engine.canAccessPhi(ctx)).toBe(true);
      });

      it('cannot reveal PHI', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'reveal', resource: 'phi' };
        expect(engine.canRevealPhi(ctx)).toBe(false);
      });

      it('cannot export data', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'export', resource: 'data' };
        expect(engine.canExportData(ctx)).toBe(false);
      });

      it('cannot modify workflows', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'modify', resource: 'workflow' };
        expect(engine.canModifyWorkflow(ctx)).toBe(false);
      });
    });

    describe('STEWARD role', () => {
      it('allows export actions', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'STEWARD', action: 'export', resource: 'data' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('allows modify actions', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'STEWARD', action: 'modify', resource: 'workflow' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('allows reveal_phi action', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'STEWARD', action: 'reveal_phi', resource: 'data' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('can access PHI', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'STEWARD', action: 'view', resource: 'phi' };
        expect(engine.canAccessPhi(ctx)).toBe(true);
      });

      it('can reveal PHI', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'STEWARD', action: 'reveal', resource: 'phi' };
        expect(engine.canRevealPhi(ctx)).toBe(true);
      });

      it('can export data', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'STEWARD', action: 'export', resource: 'data' };
        expect(engine.canExportData(ctx)).toBe(true);
      });

      it('can modify workflows', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'STEWARD', action: 'modify', resource: 'workflow' };
        expect(engine.canModifyWorkflow(ctx)).toBe(true);
      });
    });

    describe('ADMIN role', () => {
      it('allows any action (wildcard)', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ADMIN', action: 'any_action', resource: 'any_resource' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('can access PHI', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ADMIN', action: 'view', resource: 'phi' };
        expect(engine.canAccessPhi(ctx)).toBe(true);
      });

      it('can reveal PHI', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ADMIN', action: 'reveal', resource: 'phi' };
        expect(engine.canRevealPhi(ctx)).toBe(true);
      });

      it('can export data', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ADMIN', action: 'export', resource: 'data' };
        expect(engine.canExportData(ctx)).toBe(true);
      });

      it('can modify workflows', () => {
        const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ADMIN', action: 'modify', resource: 'workflow' };
        expect(engine.canModifyWorkflow(ctx)).toBe(true);
      });
    });

    it('requires audit logging', () => {
      const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'view', resource: 'workflow' };
      const result = engine.evaluate(ctx);
      expect(result.auditRequired).toBe(true);
    });
  });

  describe('PRODUCTION mode', () => {
    it('requires audit for all decisions', () => {
      const ctx: PolicyContext = { mode: 'PRODUCTION', role: 'ADMIN', action: 'view', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.auditRequired).toBe(true);
    });

    it('requires MFA for export action', () => {
      const ctx: PolicyContext = { mode: 'PRODUCTION', role: 'ADMIN', action: 'export', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.requiresMfa).toBe(true);
    });

    it('requires MFA for delete action', () => {
      const ctx: PolicyContext = { mode: 'PRODUCTION', role: 'ADMIN', action: 'delete', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.requiresMfa).toBe(true);
    });

    it('requires MFA for reveal_phi action', () => {
      const ctx: PolicyContext = { mode: 'PRODUCTION', role: 'ADMIN', action: 'reveal_phi', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.requiresMfa).toBe(true);
    });

    it('requires MFA for modify_permissions action', () => {
      const ctx: PolicyContext = { mode: 'PRODUCTION', role: 'ADMIN', action: 'modify_permissions', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.requiresMfa).toBe(true);
    });

    it('does not require MFA for view action', () => {
      const ctx: PolicyContext = { mode: 'PRODUCTION', role: 'ADMIN', action: 'view', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.requiresMfa).toBeFalsy();
    });

    it('ANALYST can reveal PHI (unlike IDENTIFIED mode)', () => {
      const ctx: PolicyContext = { mode: 'PRODUCTION', role: 'ANALYST', action: 'reveal', resource: 'phi' };
      expect(engine.canRevealPhi(ctx)).toBe(true);
    });
  });

  describe('Unknown mode', () => {
    it('denies access for unknown mode', () => {
      // @ts-expect-error - testing invalid mode
      const ctx: PolicyContext = { mode: 'UNKNOWN', role: 'ADMIN', action: 'view', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Unknown governance mode');
      expect(result.auditRequired).toBe(true);
    });
  });

  describe('Role hierarchy', () => {
    it('ADMIN can do everything', () => {
      const ctx: PolicyContext = { mode: 'PRODUCTION', role: 'ADMIN', action: 'delete', resource: 'anything' };
      const result = engine.evaluate(ctx);
      expect(result.allowed).toBe(true);
    });

    it('STEWARD has more permissions than ANALYST', () => {
      const exportCtx: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'export', resource: 'data' };
      const stewardCtx: PolicyContext = { mode: 'IDENTIFIED', role: 'STEWARD', action: 'export', resource: 'data' };
      
      expect(engine.evaluate(exportCtx).allowed).toBe(false);
      expect(engine.evaluate(stewardCtx).allowed).toBe(true);
    });

    it('ANALYST has more permissions than VIEWER', () => {
      const analyzeAsViewer: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'analyze', resource: 'data' };
      const analyzeAsAnalyst: PolicyContext = { mode: 'IDENTIFIED', role: 'ANALYST', action: 'analyze', resource: 'data' };
      
      expect(engine.evaluate(analyzeAsViewer).allowed).toBe(false);
      expect(engine.evaluate(analyzeAsAnalyst).allowed).toBe(true);
    });
  });

  describe('Policy decision includes reason', () => {
    it('includes helpful reason when access denied', () => {
      const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'VIEWER', action: 'export', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.reason).toContain('VIEWER');
      expect(result.reason).toContain('export');
    });

    it('includes helpful reason when access granted', () => {
      const ctx: PolicyContext = { mode: 'IDENTIFIED', role: 'ADMIN', action: 'view', resource: 'data' };
      const result = engine.evaluate(ctx);
      expect(result.reason).toBe('Role permits action');
    });
  });
});
