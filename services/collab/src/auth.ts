/**
 * Authentication Middleware for Collaboration Service
 *
 * Handles JWT validation with mode-aware behavior:
 * - DEMO mode: Permissive auth, logs access but allows anonymous
 * - LIVE mode: Strict auth, fail-closed on any error
 */

import jwt from "jsonwebtoken";

/**
 * Application modes
 */
export type AppMode = "DEMO" | "LIVE";

/**
 * Decoded JWT payload structure
 */
export interface JWTPayload {
  /** User ID */
  sub: string;
  /** User email */
  email?: string;
  /** User display name */
  name?: string;
  /** User roles */
  roles?: string[];
  /** Token expiration (Unix timestamp) */
  exp?: number;
  /** Token issued at (Unix timestamp) */
  iat?: number;
  /** Session ID */
  sessionId?: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Whether authentication succeeded */
  success: boolean;
  /** Authenticated user info (null if anonymous/failed) */
  user: AuthenticatedUser | null;
  /** Error message if authentication failed */
  error?: string;
  /** Whether user is in demo/anonymous mode */
  isAnonymous: boolean;
}

/**
 * Authenticated user information
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
  roles: string[];
  sessionId?: string;
}

/**
 * Document permission levels
 */
export type PermissionLevel = "none" | "read" | "write" | "admin";

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  level: PermissionLevel;
  reason?: string;
}

/**
 * Logger interface for auth operations
 */
export interface AuthLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console-based logger
 */
const defaultLogger: AuthLogger = {
  info(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.log(
      JSON.stringify({ timestamp, level: "info", source: "collab-auth", message, ...meta })
    );
  },
  warn(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.warn(
      JSON.stringify({ timestamp, level: "warn", source: "collab-auth", message, ...meta })
    );
  },
  error(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.error(
      JSON.stringify({ timestamp, level: "error", source: "collab-auth", message, ...meta })
    );
  },
};

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** JWT secret for token verification */
  jwtSecret?: string;
  /** Application mode (DEMO or LIVE) */
  appMode: AppMode;
  /** Logger instance */
  logger?: AuthLogger;
}

/**
 * Authentication handler class
 */
export class AuthHandler {
  private readonly jwtSecret: string | null;
  private readonly appMode: AppMode;
  private readonly logger: AuthLogger;

  constructor(config: AuthConfig) {
    this.jwtSecret = config.jwtSecret ?? null;
    this.appMode = config.appMode;
    this.logger = config.logger ?? defaultLogger;
  }

  /**
   * Get current app mode
   */
  getAppMode(): AppMode {
    return this.appMode;
  }

  /**
   * Authenticate a token
   *
   * Behavior varies by mode:
   * - DEMO: Allows anonymous access, logs warning
   * - LIVE: Requires valid token, fails closed on any error
   */
  authenticate(token: string | null | undefined): AuthResult {
    // No token provided
    if (!token) {
      return this.handleMissingToken();
    }

    // Clean token (remove "Bearer " prefix if present)
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;

    // No JWT secret configured
    if (!this.jwtSecret) {
      return this.handleNoSecret(cleanToken);
    }

    // Verify JWT
    try {
      const decoded = jwt.verify(cleanToken, this.jwtSecret) as JWTPayload;

      // Validate required fields
      if (!decoded.sub) {
        this.logger.error("JWT missing 'sub' claim", { hasToken: true });
        return this.failClosed("Invalid token: missing subject");
      }

      const user: AuthenticatedUser = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        roles: decoded.roles ?? [],
        sessionId: decoded.sessionId,
      };

      this.logger.info("User authenticated successfully", {
        userId: user.id,
        roles: user.roles,
        sessionId: user.sessionId,
      });

      return {
        success: true,
        user,
        isAnonymous: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("JWT verification failed", { error: message });
      return this.failClosed(`Token verification failed: ${message}`);
    }
  }

  /**
   * Check if user has permission to access a document
   *
   * This is a stub implementation - in production, this should
   * query the database to check manuscript permissions.
   */
  async checkDocumentPermission(
    user: AuthenticatedUser | null,
    documentName: string,
    requestedLevel: "read" | "write"
  ): Promise<PermissionResult> {
    // In DEMO mode, allow everything with a warning
    if (this.appMode === "DEMO") {
      this.logger.warn("DEMO mode: granting permissive access", {
        documentName,
        userId: user?.id ?? "anonymous",
        requestedLevel,
      });

      return {
        allowed: true,
        level: "write", // Full access in demo mode
        reason: "DEMO mode: permissive access",
      };
    }

    // LIVE mode: require authenticated user
    if (!user) {
      return {
        allowed: false,
        level: "none",
        reason: "Authentication required",
      };
    }

    // Extract manuscript ID from document name
    const manuscriptMatch = documentName.match(/^manuscript:([a-f0-9-]+)$/i);
    if (!manuscriptMatch) {
      // Non-manuscript documents - check if user has any role
      if (user.roles.length > 0) {
        return {
          allowed: true,
          level: requestedLevel,
          reason: "User has authenticated access",
        };
      }
      return {
        allowed: false,
        level: "none",
        reason: "No access to this document",
      };
    }

    // TODO: In production, query manuscript_authors or manuscript permissions
    // For now, authenticated users can access manuscripts

    // Check for admin role
    if (user.roles.includes("ADMIN") || user.roles.includes("admin")) {
      return {
        allowed: true,
        level: "admin",
        reason: "Admin access",
      };
    }

    // Check for steward role (read-only on manuscripts they don't own)
    if (user.roles.includes("STEWARD") || user.roles.includes("steward")) {
      return {
        allowed: true,
        level: "read",
        reason: "Steward oversight access",
      };
    }

    // Default: allow authenticated researchers to access
    if (
      user.roles.includes("RESEARCHER") ||
      user.roles.includes("researcher") ||
      user.roles.length === 0 // Default to researcher
    ) {
      return {
        allowed: true,
        level: "write",
        reason: "Researcher access",
      };
    }

    // Viewer role - read only
    return {
      allowed: requestedLevel === "read",
      level: "read",
      reason: "Viewer access (read-only)",
    };
  }

  /**
   * Handle missing token based on app mode
   */
  private handleMissingToken(): AuthResult {
    if (this.appMode === "DEMO") {
      this.logger.warn("DEMO mode: allowing anonymous access (no token provided)");
      return {
        success: true,
        user: null,
        isAnonymous: true,
      };
    }

    // LIVE mode: fail closed
    this.logger.error("LIVE mode: authentication required, no token provided");
    return {
      success: false,
      user: null,
      error: "Authentication required",
      isAnonymous: false,
    };
  }

  /**
   * Handle case where no JWT secret is configured
   */
  private handleNoSecret(token: string): AuthResult {
    if (this.appMode === "DEMO") {
      this.logger.warn("DEMO mode: JWT secret not configured, allowing access", {
        tokenLength: token.length,
      });

      // Try to decode without verification for user info
      try {
        const decoded = jwt.decode(token) as JWTPayload | null;
        if (decoded?.sub) {
          return {
            success: true,
            user: {
              id: decoded.sub,
              email: decoded.email,
              name: decoded.name,
              roles: decoded.roles ?? [],
              sessionId: decoded.sessionId,
            },
            isAnonymous: false,
          };
        }
      } catch {
        // Ignore decode errors in demo mode
      }

      return {
        success: true,
        user: null,
        isAnonymous: true,
      };
    }

    // LIVE mode: fail closed if secret not configured
    this.logger.error("LIVE mode: JWT secret not configured, cannot verify token");
    return {
      success: false,
      user: null,
      error: "Server configuration error: authentication unavailable",
      isAnonymous: false,
    };
  }

  /**
   * Fail closed - return authentication failure
   */
  private failClosed(reason: string): AuthResult {
    if (this.appMode === "DEMO") {
      this.logger.warn(`DEMO mode: auth failed but allowing anonymous access: ${reason}`);
      return {
        success: true,
        user: null,
        isAnonymous: true,
      };
    }

    return {
      success: false,
      user: null,
      error: reason,
      isAnonymous: false,
    };
  }
}

/**
 * Create auth handler from environment configuration
 */
export function createAuthHandler(logger?: AuthLogger): AuthHandler {
  const appMode = (process.env.APP_MODE ?? "DEMO").toUpperCase() as AppMode;
  const jwtSecret = process.env.JWT_SECRET;

  return new AuthHandler({
    jwtSecret,
    appMode: appMode === "LIVE" ? "LIVE" : "DEMO",
    logger,
  });
}
