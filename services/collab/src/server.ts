/**
 * ResearchFlow Collaboration Service
 *
 * Hocuspocus WebSocket server for real-time collaborative editing.
 *
 * Features:
 * - Multi-adapter persistence (Redis > Postgres > Memory)
 * - JWT authentication with mode-aware behavior
 * - Debounced PHI scanning (not every keystroke)
 * - Fail-closed security in LIVE mode
 */

import { Hocuspocus } from "@hocuspocus/server";
import type {
  onAuthenticatePayload,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
  onConnectPayload,
  onDisconnectPayload,
  onChangePayload,
} from "@hocuspocus/server";
import * as Y from "yjs";
import { createPersistenceAdapter, type PersistenceAdapter } from "./persistence/index.js";
import { PostgresPersistenceAdapter } from "./persistence/postgres.js";
import { createAuthHandler, type AuthHandler, type AuthenticatedUser } from "./auth.js";
import { createPhiScanner, extractTextFromYDoc, type CollabPhiScanner } from "./phi-scanner.js";

/**
 * Server configuration
 */
interface ServerConfig {
  port: number;
  host: string;
  appMode: "DEMO" | "LIVE";
}

/**
 * Logger for server operations
 */
interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Create structured logger
 */
function createLogger(source: string): Logger {
  const formatLog = (level: string, message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, source, message, ...meta };

    if (process.env.LOG_FORMAT === "json") {
      return JSON.stringify(logEntry);
    }

    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `${formattedTime} [${source}] ${message}${metaStr}`;
  };

  return {
    info(message: string, meta?: Record<string, unknown>) {
      console.log(formatLog("info", message, meta));
    },
    warn(message: string, meta?: Record<string, unknown>) {
      console.warn(formatLog("warn", message, meta));
    },
    error(message: string, meta?: Record<string, unknown>) {
      console.error(formatLog("error", message, meta));
    },
  };
}

/**
 * Main collaboration server class
 */
class CollaborationServer {
  private readonly config: ServerConfig;
  private readonly logger: Logger;
  private server: Hocuspocus | null = null;
  private persistenceAdapter: PersistenceAdapter | null = null;
  private authHandler: AuthHandler | null = null;
  private phiScanner: CollabPhiScanner | null = null;

  // Track connected users per document
  private readonly documentUsers: Map<string, Set<string>> = new Map();

  // Track authenticated users by socket ID
  private readonly connectionUsers: Map<string, AuthenticatedUser | null> = new Map();

  constructor() {
    this.config = {
      port: parseInt(process.env.PORT ?? "1234", 10),
      host: process.env.HOST ?? "0.0.0.0",
      appMode: (process.env.APP_MODE ?? "DEMO").toUpperCase() as "DEMO" | "LIVE",
    };
    this.logger = createLogger("collab");
  }

  /**
   * Initialize and start the server
   */
  async start(): Promise<void> {
    this.logger.info("Starting ResearchFlow Collaboration Service...", {
      port: this.config.port,
      host: this.config.host,
      appMode: this.config.appMode,
    });

    try {
      // Initialize components
      await this.initializeComponents();

      // Create Hocuspocus server
      this.server = new Hocuspocus({
        port: this.config.port,
        address: this.config.host,
        name: "researchflow-collab",

        // Quiet mode - we handle our own logging
        quiet: true,

        // Connection timeout
        timeout: 30000,

        // Debounce document saving (in addition to our PHI scan debounce)
        debounce: 2000,
        maxDebounce: 10000,

        // Handlers
        onAuthenticate: this.handleAuthenticate.bind(this),
        onConnect: this.handleConnect.bind(this),
        onDisconnect: this.handleDisconnect.bind(this),
        onLoadDocument: this.handleLoadDocument.bind(this),
        onStoreDocument: this.handleStoreDocument.bind(this),
        onChange: this.handleChange.bind(this),
      });

      // Start listening
      await this.server.listen();

      this.logger.info("Collaboration server started successfully", {
        port: this.config.port,
        host: this.config.host,
        appMode: this.config.appMode,
        persistence: this.persistenceAdapter?.name ?? "none",
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      this.logger.error("Failed to start collaboration server", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Initialize all required components
   */
  private async initializeComponents(): Promise<void> {
    // Initialize persistence adapter
    this.persistenceAdapter = await createPersistenceAdapter(undefined, {
      info: (msg, meta) => this.logger.info(msg, meta),
      warn: (msg, meta) => this.logger.warn(msg, meta),
      error: (msg, meta) => this.logger.error(msg, meta),
    });

    // Initialize auth handler
    this.authHandler = createAuthHandler({
      info: (msg, meta) => this.logger.info(msg, meta),
      warn: (msg, meta) => this.logger.warn(msg, meta),
      error: (msg, meta) => this.logger.error(msg, meta),
    });

    // Initialize PHI scanner
    this.phiScanner = await createPhiScanner({
      debounceMs: 30000, // 30 seconds
      logger: {
        info: (msg, meta) => this.logger.info(msg, meta),
        warn: (msg, meta) => this.logger.warn(msg, meta),
        error: (msg, meta) => this.logger.error(msg, meta),
      },
    });
  }

  /**
   * Handle authentication
   *
   * In DEMO mode: Permissive, allows anonymous
   * In LIVE mode: Strict, fail-closed
   */
  private async handleAuthenticate(data: onAuthenticatePayload): Promise<void> {
    const { token, documentName, connection, socketId } = data;

    if (!this.authHandler) {
      throw new Error("Auth handler not initialized");
    }

    // Authenticate the token
    const authResult = this.authHandler.authenticate(token);

    if (!authResult.success) {
      this.logger.error("Authentication failed", {
        documentName,
        error: authResult.error,
        socketId,
      });
      throw new Error(authResult.error ?? "Authentication failed");
    }

    // Store user info for this connection using socketId
    this.connectionUsers.set(socketId, authResult.user);

    // Check document permissions
    const permissionResult = await this.authHandler.checkDocumentPermission(
      authResult.user,
      documentName,
      "write"
    );

    if (!permissionResult.allowed) {
      this.logger.error("Permission denied", {
        documentName,
        userId: authResult.user?.id,
        reason: permissionResult.reason,
      });
      throw new Error(permissionResult.reason ?? "Permission denied");
    }

    // Set read-only mode for read-only users
    if (permissionResult.level === "read") {
      connection.readOnly = true;
    }

    this.logger.info("User authenticated", {
      documentName,
      userId: authResult.user?.id ?? "anonymous",
      isAnonymous: authResult.isAnonymous,
      permissionLevel: permissionResult.level,
      readOnly: connection.readOnly,
      socketId,
    });
  }

  /**
   * Handle new connection
   */
  private async handleConnect(data: onConnectPayload): Promise<void> {
    const { documentName, socketId } = data;

    // Track user in document
    let users = this.documentUsers.get(documentName);
    if (!users) {
      users = new Set();
      this.documentUsers.set(documentName, users);
    }
    users.add(socketId);

    this.logger.info("Client connected", {
      documentName,
      socketId,
      totalConnections: users.size,
    });
  }

  /**
   * Handle disconnection
   */
  private async handleDisconnect(data: onDisconnectPayload): Promise<void> {
    const { documentName, socketId } = data;

    // Remove user from document tracking
    const users = this.documentUsers.get(documentName);
    if (users) {
      users.delete(socketId);
      if (users.size === 0) {
        this.documentUsers.delete(documentName);

        // Clear PHI scanner state when no users are connected
        this.phiScanner?.clearDocumentState(documentName);
      }
    }

    // Clean up connection user info
    this.connectionUsers.delete(socketId);

    this.logger.info("Client disconnected", {
      documentName,
      socketId,
      remainingConnections: users?.size ?? 0,
    });
  }

  /**
   * Handle document load
   *
   * Load from persistence or create new document
   */
  private async handleLoadDocument(data: onLoadDocumentPayload): Promise<void> {
    const { documentName, document } = data;

    if (!this.persistenceAdapter) {
      this.logger.warn("No persistence adapter, document will not be saved", {
        documentName,
      });
      return;
    }

    try {
      const state = await this.persistenceAdapter.fetchDocument(documentName);

      if (state) {
        Y.applyUpdate(document, state);
        this.logger.info("Document loaded from persistence", {
          documentName,
          stateSize: state.length,
        });
      } else {
        this.logger.info("New document created", { documentName });
      }
    } catch (error) {
      this.logger.error("Failed to load document", {
        documentName,
        error: error instanceof Error ? error.message : String(error),
      });

      // In LIVE mode, fail closed - don't allow editing if we can't load
      if (this.config.appMode === "LIVE") {
        throw new Error("Failed to load document from persistence");
      }

      // In DEMO mode, continue with empty document
      this.logger.warn("DEMO mode: continuing with empty document after load failure", {
        documentName,
      });
    }
  }

  /**
   * Handle document store
   *
   * Persist document state and optionally create revision snapshot
   */
  private async handleStoreDocument(data: onStoreDocumentPayload): Promise<void> {
    const { documentName, document, context } = data;

    if (!this.persistenceAdapter) {
      return;
    }

    try {
      const state = Y.encodeStateAsUpdate(document);

      // Store document state
      await this.persistenceAdapter.storeDocument(documentName, state);

      this.logger.info("Document stored", {
        documentName,
        stateSize: state.length,
      });

      // Force PHI scan on store (this is like a "commit revision" point)
      if (this.phiScanner) {
        const content = extractTextFromYDoc(document);
        const scanResult = await this.phiScanner.forceScan(documentName, content);

        if (scanResult.riskLevel === "high") {
          this.logger.warn("High-risk PHI detected on document store", {
            documentName,
            findingsCount: scanResult.findingsCount,
            findingsByType: scanResult.findingsByType,
          });
        }
      }

      // Check for revision commit context
      if (context?.commitRevision && this.persistenceAdapter instanceof PostgresPersistenceAdapter) {
        const userId = context.userId as string | undefined;
        const changeDescription = (context.changeDescription as string) ?? "Collaborative edit";
        const contentMap = document.getMap("content");
        const content = contentMap ? contentMap.toJSON() : {};

        await this.persistenceAdapter.saveRevisionSnapshot(
          documentName,
          content as Record<string, unknown>,
          userId ?? "unknown",
          changeDescription
        );

        this.logger.info("Revision snapshot saved", {
          documentName,
          userId,
          changeDescription,
        });
      }
    } catch (error) {
      this.logger.error("Failed to store document", {
        documentName,
        error: error instanceof Error ? error.message : String(error),
      });

      // In LIVE mode, this is a critical error
      if (this.config.appMode === "LIVE") {
        throw error;
      }
    }
  }

  /**
   * Handle document change
   *
   * Schedule debounced PHI scan (not on every keystroke)
   */
  private async handleChange(data: onChangePayload): Promise<void> {
    const { documentName, document } = data;

    // Schedule debounced PHI scan
    if (this.phiScanner) {
      this.phiScanner.scheduleScan(documentName, () => extractTextFromYDoc(document));
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string): Promise<void> => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        // Stop accepting new connections
        if (this.server) {
          await this.server.destroy();
          this.logger.info("Hocuspocus server stopped");
        }

        // Clear PHI scanner state
        if (this.phiScanner) {
          this.phiScanner.clearAll();
          this.logger.info("PHI scanner cleared");
        }

        // Close persistence connection
        if (this.persistenceAdapter) {
          await this.persistenceAdapter.close();
          this.logger.info("Persistence connection closed");
        }

        this.logger.info("Graceful shutdown complete");
        process.exit(0);
      } catch (error) {
        this.logger.error("Error during shutdown", {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      this.logger.error("Uncaught exception", {
        error: error.message,
        stack: error.stack,
      });

      // In LIVE mode, exit on uncaught exception
      if (this.config.appMode === "LIVE") {
        process.exit(1);
      }
    });

    process.on("unhandledRejection", (reason) => {
      this.logger.error("Unhandled rejection", {
        reason: reason instanceof Error ? reason.message : String(reason),
      });

      // In LIVE mode, exit on unhandled rejection
      if (this.config.appMode === "LIVE") {
        process.exit(1);
      }
    });
  }

  /**
   * Get server health status
   */
  async getHealth(): Promise<{
    status: "healthy" | "unhealthy";
    persistence: string;
    persistenceHealthy: boolean;
    appMode: string;
    connectedDocuments: number;
    totalConnections: number;
  }> {
    const persistenceHealthy = (await this.persistenceAdapter?.isHealthy()) ?? false;

    let totalConnections = 0;
    for (const users of this.documentUsers.values()) {
      totalConnections += users.size;
    }

    return {
      status: persistenceHealthy ? "healthy" : "unhealthy",
      persistence: this.persistenceAdapter?.name ?? "none",
      persistenceHealthy,
      appMode: this.config.appMode,
      connectedDocuments: this.documentUsers.size,
      totalConnections,
    };
  }
}

// Main entry point
const server = new CollaborationServer();
server.start().catch((error) => {
  console.error("Failed to start collaboration server:", error);
  process.exit(1);
});
