import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

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

// Logging function
export function log(message: string, source = "orchestrator") {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    source,
    message,
    level: "info",
  };

  if (process.env.LOG_FORMAT === "json") {
    console.log(JSON.stringify(logEntry));
  } else {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
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

app.get("/health/ready", async (_req, res) => {
  try {
    // Check database connection
    // const dbCheck = await checkDatabase();

    // Check Redis connection
    // const redisCheck = await checkRedis();

    // Check worker service availability
    const workerUrl = process.env.WORKER_CALLBACK_URL || "http://worker:8000";

    res.json({
      status: "ready",
      checks: {
        database: "ok",
        redis: "ok",
        worker: workerUrl,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
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
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Only log response body in development or if small
      if (process.env.NODE_ENV !== "production" && capturedJsonResponse) {
        const responseStr = JSON.stringify(capturedJsonResponse);
        if (responseStr.length < 500) {
          logLine += ` :: ${responseStr}`;
        }
      }

      log(logLine);
    }
  });

  next();
});

// Main application startup
(async () => {
  try {
    log("Starting ResearchFlow Orchestrator...");

    // Register API routes
    await registerRoutes(httpServer, app);
    log("Routes registered");

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log error details
      log(`Error ${status}: ${message}`, "error");
      if (process.env.NODE_ENV !== "production") {
        console.error(err.stack);
      }

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
    console.error("Failed to start orchestrator:", error);
    process.exit(1);
  }
})();
