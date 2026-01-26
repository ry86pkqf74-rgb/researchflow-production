/**
 * Async Handler Middleware
 *
 * Wraps async route handlers to catch errors and pass them to Express error handler.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async function to handle promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Wrap multiple middleware functions
 */
export function asyncMiddleware(
  ...fns: Array<(req: Request, res: Response, next: NextFunction) => Promise<any>>
): RequestHandler[] {
  return fns.map(fn => asyncHandler(fn));
}

export default asyncHandler;
