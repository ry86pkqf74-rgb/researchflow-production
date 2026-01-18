/**
 * Governance Mode Middleware
 *
 * Controls access to operations based on the current governance mode.
 * - DEMO: Simulated data only, uploads/exports blocked
 * - STANDBY: Read operations allowed, writes blocked
 * - LIVE: All operations allowed
 *
 * Priority: P0 - CRITICAL
 */

import { Request, Response, NextFunction } from 'express';
import { getGovernanceState } from '../routes/governance.js';

export type GovernanceMode = 'DEMO' | 'STANDBY' | 'LIVE';

export function getGovernanceMode(): GovernanceMode {
  const state = getGovernanceState();
  return state.mode as GovernanceMode;
}

export function requireLiveMode(operationType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const mode = getGovernanceMode();

    if (mode === 'DEMO') {
      res.status(403).json({
        error: 'Operation blocked in DEMO mode',
        code: 'DEMO_MODE_RESTRICTED',
        operation: operationType
      });
      return;
    }

    if (mode === 'STANDBY') {
      const isReadOperation = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
      
      if (!isReadOperation) {
        res.status(403).json({
          error: 'Write operations blocked in STANDBY mode',
          code: 'STANDBY_MODE_RESTRICTED',
          operation: operationType,
          allowedMethods: ['GET', 'HEAD', 'OPTIONS']
        });
        return;
      }
    }

    next();
  };
}

export function requireDemoSafe(operationType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const mode = getGovernanceMode();

    if (mode === 'DEMO') {
      res.status(403).json({
        error: 'Operation blocked in DEMO mode',
        code: 'DEMO_MODE_RESTRICTED',
        operation: operationType
      });
      return;
    }

    next();
  };
}
