/**
 * Open Policy Agent (OPA) Middleware
 *
 * Integrates with OPA for fine-grained authorization decisions.
 * This is a fallback for when Istio external authorization is not available.
 *
 * Phase A - Task 41: OPA Policies for Orchestrator
 */

import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { logger } from '../logger/file-logger.js';

const OPA_URL = process.env.OPA_URL || 'http://opa.researchflow.svc.cluster.local:8181';
const OPA_POLICY_PATH = process.env.OPA_POLICY_PATH || '/v1/data/envoy/authz/allow';
const ENABLE_OPA = process.env.ENABLE_OPA !== 'false';

interface OPAInput {
  attributes: {
    request: {
      http: {
        method: string;
        path: string;
        headers: Record<string, string>;
      };
    };
    source: {
      address: {
        Address: {
          SocketAddress: {
            address: string;
            port: number;
          };
        };
      };
    };
  };
}

interface OPAResponse {
  result: boolean;
  decision_log?: any;
}

/**
 * Check authorization with OPA
 */
async function checkOPA(req: Request): Promise<boolean> {
  if (!ENABLE_OPA) {
    return true; // OPA disabled, allow all
  }

  try {
    const input: OPAInput = {
      attributes: {
        request: {
          http: {
            method: req.method,
            path: req.path,
            headers: {
              authorization: req.headers.authorization || '',
              'user-agent': req.headers['user-agent'] || '',
              'x-request-id': (Array.isArray(req.headers['x-request-id']) ? req.headers['x-request-id'][0] : req.headers['x-request-id']) || '',
            },
          },
        },
        source: {
          address: {
            Address: {
              SocketAddress: {
                address: req.ip || '0.0.0.0',
                port: 0,
              },
            },
          },
        },
      },
    };

    const response = await axios.post<OPAResponse>(
      `${OPA_URL}${OPA_POLICY_PATH}`,
      { input },
      {
        timeout: 1000, // 1 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.result === true;
  } catch (error) {
    // Fail closed: deny access on OPA errors
    logger.error('OPA authorization check failed', { error });

    // In development, you might want to fail open
    if (process.env.NODE_ENV === 'development') {
      logger.warn('OPA check failed in development, allowing request');
      return true;
    }

    return false;
  }
}

/**
 * OPA Authorization Middleware
 *
 * Usage:
 *   app.use('/api', opaMiddleware);
 *   app.use('/api/admin', opaMiddleware);
 */
export async function opaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const allowed = await checkOPA(req);

    if (allowed) {
      next();
    } else {
      res.status(403).json({
        error: 'Forbidden',
        code: 'AUTHORIZATION_DENIED',
        message: 'You do not have permission to access this resource',
      });
    }
  } catch (error) {
    logger.error('OPA middleware error', { error });
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'OPA_ERROR',
      message: 'Authorization check failed',
    });
  }
}

/**
 * Check specific OPA policy
 *
 * Usage in route handlers:
 *   const allowed = await checkOPAPolicy(req, 'artifacts', 'read');
 */
export async function checkOPAPolicy(
  req: Request,
  resource: string,
  action: string
): Promise<boolean> {
  if (!ENABLE_OPA) {
    return true;
  }

  try {
    const input = {
      user: {
        id: (req as any).user?.id || 'anonymous',
        roles: (req as any).user?.roles || [],
      },
      resource,
      action,
      context: {
        ip: req.ip,
        path: req.path,
        method: req.method,
        headers: {
          authorization: req.headers.authorization || '',
        },
      },
    };

    const response = await axios.post(
      `${OPA_URL}/v1/data/authz/allow`,
      { input },
      {
        timeout: 1000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.result === true;
  } catch (error) {
    logger.error(`OPA policy check failed for ${resource}:${action}`, { error });

    // Fail closed
    if (process.env.NODE_ENV !== 'development') {
      return false;
    }

    // In development, log and allow
    logger.warn('Allowing request in development mode');
    return true;
  }
}

/**
 * Role-based authorization helper
 */
export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRoles = (req as any).user?.roles || [];

      // Check if user has any of the required roles
      const hasRole = roles.some(role => userRoles.includes(role));

      if (hasRole || userRoles.includes('admin')) {
        next();
      } else {
        res.status(403).json({
          error: 'Forbidden',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Requires one of: ${roles.join(', ')}`,
        });
      }
    } catch (error) {
      logger.error('Role check error', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        code: 'AUTHZ_ERROR',
      });
    }
  };
}
