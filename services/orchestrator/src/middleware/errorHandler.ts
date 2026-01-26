/**
 * Centralized Error Handler Middleware
 *
 * Catches all errors thrown in route handlers and provides consistent
 * error responses. Logs detailed errors in development mode.
 *
 * Priority: P0 - CRITICAL (Phase 2 Integration)
 */

import { Request, Response, NextFunction } from 'express';
import { OperationNotAllowedError } from "@researchflow/core/types/classification"
import { createLogger } from '../utils/logger';

const logger = createLogger('error-handler');

interface ErrorWithStatus extends Error {
  status?: number;
  code?: string;
}

/**
 * Express error handler middleware
 * Must have 4 parameters to be recognized as error handler
 */
export function errorHandler(
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error details using structured logger
  logger.error(`Request error: ${err.message}`, {
    method: req.method,
    path: req.path,
    statusCode: err.status || 500,
    errorCode: err.code,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    }),
  });

  // Handle specific error types
  if (err instanceof OperationNotAllowedError) {
    res.status(403).json({
      error: err.message,
      code: 'OPERATION_NOT_ALLOWED',
      classification: err.classification,
      operation: err.operation,
      datasetId: err.datasetId
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: err.message,
      code: 'VALIDATION_ERROR'
    });
    return;
  }

  // Handle not found errors
  if (err.status === 404) {
    res.status(404).json({
      error: err.message || 'Resource not found',
      code: err.code || 'NOT_FOUND'
    });
    return;
  }

  // Handle unauthorized errors
  if (err.status === 401) {
    res.status(401).json({
      error: err.message || 'Unauthorized',
      code: err.code || 'UNAUTHORIZED'
    });
    return;
  }

  // Handle forbidden errors
  if (err.status === 403) {
    res.status(403).json({
      error: err.message || 'Forbidden',
      code: err.code || 'FORBIDDEN'
    });
    return;
  }

  // Default to 500 server error
  const statusCode = err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: errorCode,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
}

/**
 * Async handler wrapper to catch promise rejections
 * Use this to wrap async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
