import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import net from "net";
import { pool } from "./db";
import { createLogger, type LogLevel } from "./src/utils/logger";
import {
  createDefaultLimiter,
  createAuthLimiter,
  createApiLimiter,
  closeRedisClient,
} from "./src/middleware/rateLimit";
import {
  configureSecurityHeaders,
  cspViolationReporter,
  apiSecurityHeaders,
  initializeSecurityHeadersLogging,
} from "./src/middleware/securityHeaders";

// Load environment variables
dotenv.config();

// Create logger instance
const logger = createLogger('orchestrator');

const app = express();
const httpServer = createServer(app);

// CORS configuration for production
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// Security headers middleware
app.use(configureSecurityHeaders());
app.use(apiSecurityHeaders());

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

/**
 * Legacy log function - wraps structured logger for backward compatibility
 * @deprecated Use createLogger() from src/utils/logger.ts instead
 */
export function log(message: string, level: string = "info") {
  const logLevel = level as LogLevel;
  switch (logLevel) {
    case 'debug':
      logger.debug(message);
      break;
    case 'warn':
      logger.warn(message);
      break;
    case 'error':
      logger.error(message);
      break;
    default:
      logger.info(message);
  }
}

// Health check helper functions
async function checkPostgres(): Promise<{ ok: boolean; error?: string }> {
  if (!pool) {
    return { ok: false, error: "No database pool configured" };
  }
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return { ok: true };
    } finally {
      client.release();
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function checkRedis(): Promise<{ ok: boolean; error?: string }> {
  const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
  try {
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = parseInt(url.port || "6379", 10);

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ ok: false, error: "Connection timeout" });
      }, 2000);

      socket.connect(port, host, () => {
        // Send PING command using RESP protocol
        socket.write("*1\r\n$4\r\nPING\r\n");
      });

      socket.on("data", (data) => {
        clearTimeout(timeout);
        const response = data.toString();
        // Redis responds with +PONG\r\n for successful PING
        if (response.includes("PONG")) {
          socket.destroy();
          resolve({ ok: true });
        } else {
          socket.destroy();
          resolve({ ok: false, error: `Unexpected response: ${response}` });
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: false, error: err.message });
      });
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid Redis URL" };
  }
}

async function checkWorker(): Promise<{ ok: boolean; error?: string }> {
  const workerUrl = process.env.WORKER_CALLBACK_URL || "http://worker:8000";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${workerUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      return { ok: true };
    }
    return { ok: false, error: `HTTP ${response.status}` };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Connection timeout" };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Health check endpoints
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "orchestrator",
    version: process.env.npm_package_version || "1.0.0",
    timestamp: new Date().toISOString(),
    governanceMode: process.env.GOVERNANCE_MODE || "DEMO",
  });
});

// Alias for Docker healthchecks
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "orchestrator",
    version: process.env.npm_package_version || "1.0.0",
    timestamp: new Date().toISOString(),
    governanceMode: process.env.GOVERNANCE_MODE || "DEMO",
  });
});

app.get("/health/ready", async (_req, res) => {
  const [dbCheck, redisCheck, workerCheck] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkWorker(),
  ]);

  const checks = {
    db: dbCheck.ok ? "ok" : `failed: ${dbCheck.error}`,
    redis: redisCheck.ok ? "ok" : `failed: ${redisCheck.error}`,
    worker: workerCheck.ok ? "ok" : `failed: ${workerCheck.error}`,
  };

  const allOk = dbCheck.ok && redisCheck.ok && workerCheck.ok;

  const response = {
    status: allOk ? "ready" : "not_ready",
    checks,
    mode: {
      ros_mode: process.env.ROS_MODE || "DEMO",
      no_network: process.env.NO_NETWORK === "true",
      mock_only: process.env.MOCK_ONLY === "true",
    },
  };

  if (allOk) {
    res.json(response);
  } else {
    res.status(503).json(response);
  }
});

// Alias for Docker healthchecks
app.get("/api/health/ready", async (_req, res) => {
  const [dbCheck, redisCheck, workerCheck] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkWorker(),
  ]);

  const checks = {
    db: dbCheck.ok ? "ok" : `failed: ${dbCheck.error}`,
    redis: redisCheck.ok ? "ok" : `failed: ${redisCheck.error}`,
    worker: workerCheck.ok ? "ok" : `failed: ${workerCheck.error}`,
  };

  const allOk = dbCheck.ok && redisCheck.ok && workerCheck.ok;

  const response = {
    status: allOk ? "ready" : "not_ready",
    checks,
    mode: {
      ros_mode: process.env.ROS_MODE || "DEMO",
      no_network: process.env.NO_NETWORK === "true",
      mock_only: process.env.MOCK_ONLY === "true",
    },
  };

  if (allOk) {
    res.json(response);
  } else {
    res.status(503).json(response);
  }
});

// Metrics endpoint - telemetry and runtime mode (no secrets)
import { getTelemetry } from "./src/utils/telemetry";

app.get("/api/metrics", (_req, res) => {
  const telemetry = getTelemetry();
  res.json(telemetry.getMetrics());
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Use debug level for request logging to reduce noise in production
      logger.debug(`${req.method} ${path} ${res.statusCode} in ${duration}ms`, {
        method: req.method,
        path,
        statusCode: res.statusCode,
        duration,
      });
    }
  });

  next();
});

// Main application startup
(async () => {
  try {
    log("Starting ResearchFlow Orchestrator...");

    // Initialize security headers logging
    initializeSecurityHeadersLogging();

    // Initialize rate limiters
    log("Initializing rate limiters...");
    const defaultLimiter = await createDefaultLimiter();
    const authLimiter = await createAuthLimiter();
    const apiLimiter = await createApiLimiter();

    // Apply default rate limiter globally
    app.use(defaultLimiter);

    // Apply stricter auth limiter to authentication endpoints
    app.use(/\/(auth|login|signup|refresh-token)/, authLimiter);

    // Apply API limiter to all /api routes
    app.use(/^\/api\//, apiLimiter);

    log("Rate limiters configured");

    // Register CSP violation reporter endpoint before other routes
    app.post("/api/csp-violations", express.json(), cspViolationReporter());

    // Register API routes
    await registerRoutes(httpServer, app);
    log("Routes registered");

    // Initialize governance mode from database
    try {
      const { governanceConfigService } = await import("./src/services/governance-config.service.js");
      const mode = await governanceConfigService.initializeMode();
      log(`Governance mode initialized: ${mode}`);
    } catch (error) {
      logger.warn("Failed to initialize governance mode from database", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      log("Falling back to environment variable GOVERNANCE_MODE");
    }

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log error details using structured logger
      logger.error(`Request error: ${message}`, {
        statusCode: status,
        errorCode: err.code || "INTERNAL_ERROR",
        ...(process.env.NODE_ENV !== "production" && {
          stack: err.stack?.split('\n').slice(0, 5).join('\n'),
        }),
      });

      res.status(status).json({
        error: message,
        code: err.code || "INTERNAL_ERROR",
      });
    });

    // Serve static files in production or setup Vite in development
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
      log("Static files configured");
    } else {
      try {
        const { setupVite } = await import("./vite");
        await setupVite(httpServer, app);
        log("Vite development server configured");
      } catch (e) {
        log("Vite not available, running in API-only mode");
      }
    }

    // Start the server
    const port = parseInt(process.env.PORT || "3001", 10);
    const host = process.env.HOST || "0.0.0.0";

    httpServer.listen({ port, host }, () => {
      log(`Orchestrator running on http://${host}:${port}`);
      log(`Environment: ${process.env.NODE_ENV || "development"}`);
      log(`Governance Mode: ${process.env.GOVERNANCE_MODE || "DEMO"}`);
      log(`Worker URL: ${process.env.WORKER_CALLBACK_URL || "http://worker:8000"}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      log(`Received ${signal}, shutting down gracefully...`);

      // Close Redis client for rate limiting
      await closeRedisClient();

      httpServer.close(() => {
        log("HTTP server closed");
        process.exit(0);
      });

      // Force exit after timeout
      setTimeout(() => {
        log("Forcing shutdown after timeout", "warn");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    logger.error("Failed to start orchestrator", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
})();
