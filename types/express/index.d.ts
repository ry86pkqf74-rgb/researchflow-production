/**
 * Express Request type extensions
 * Declares custom properties on the Express Request object
 */

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      username: string;
      role: string;
      email: string;
      isActive: boolean;
    };
  }
}
