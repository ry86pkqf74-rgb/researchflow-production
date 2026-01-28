/**
 * WebSocket Connection Manager
 *
 * Manages WebSocket server lifecycle, client connections, and message routing.
 * Integrates with the EventBus to broadcast events to connected clients.
 *
 * Features:
 * - Multi-client connection management
 * - Event subscription filtering per client
 * - Graceful connection handling (open, message, close, error)
 * - Heartbeat/ping-pong to detect stale connections
 * - PHI-safe message validation before sending
 *
 * @module websocket/manager
 */

import { WebSocketServer, WebSocket as WsSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { eventBus, AppEvent } from '../services/event-bus';
import {
  AnyWebSocketEvent,
  isValidWebSocketEvent,
  EventCategories,
  EventCategory,
} from './events';

/**
 * WebSocket client connection state
 */
interface ClientConnection {
  id: string;
  ws: WsSocket;
  subscriptions: Set<string>;
  isAuthenticated: boolean;
  userId?: string;
  projectId?: string;
  runId?: string;
  lastHeartbeat: number;
  messageCount: number;
}

/**
 * WebSocket Server Manager
 */
class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private httpServer: HttpServer | null = null;
  private isShuttingDown = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60 seconds
  private eventBusUnsubscribe: (() => void) | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HttpServer): void {
    if (this.wss) {
      console.warn('[WebSocketManager] Already initialized');
      return;
    }

    this.httpServer = httpServer;

    // Create WebSocket server attached to HTTP server
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    // Handle new connections
    this.wss.on('connection', (ws: WsSocket, req) => {
      this.handleConnection(ws, req);
    });

    // Subscribe to event bus for real-time event broadcasting
    this.eventBusUnsubscribe = eventBus.subscribe('all', (event: AppEvent) => {
      this.broadcastEvent(event);
    });

    // Start heartbeat to detect stale connections
    this.startHeartbeat();

    console.log('[WebSocketManager] WebSocket server initialized at /ws');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WsSocket, req: any): void {
    const clientId = this.generateClientId();
    const connection: ClientConnection = {
      id: clientId,
      ws,
      subscriptions: new Set(['all']), // Subscribe to all by default
      isAuthenticated: false,
      lastHeartbeat: Date.now(),
      messageCount: 0,
    };

    this.clients.set(clientId, connection);

    console.log(
      `[WebSocketManager] Client connected: ${clientId} (total: ${this.clients.size})`
    );

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection.established',
      timestamp: new Date().toISOString(),
      payload: {
        clientId,
        version: '1.0',
        supportedEventCategories: Object.keys(EventCategories),
      },
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WebSocketManager] Client error (${clientId}):`, error.message);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle pong response (heartbeat)
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastHeartbeat = Date.now();
      }
    });
  }

  /**
   * Handle incoming messages from client
   */
  private handleMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.messageCount++;

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: new Date().toISOString(),
            payload: {},
          });
          break;

        case 'auth':
          this.handleAuthMessage(clientId, message);
          break;

        case 'subscribe':
          this.handleSubscribeMessage(clientId, message);
          break;

        case 'unsubscribe':
          this.handleUnsubscribeMessage(clientId, message);
          break;

        case 'get_status':
          this.sendToClient(clientId, {
            type: 'status',
            timestamp: new Date().toISOString(),
            payload: {
              clientId,
              subscriptions: Array.from(client.subscriptions),
              messageCount: client.messageCount,
              authenticated: client.isAuthenticated,
            },
          });
          break;

        default:
          console.debug(`[WebSocketManager] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(
        `[WebSocketManager] Failed to process message from ${clientId}:`,
        error
      );
      this.sendToClient(clientId, {
        type: 'error',
        timestamp: new Date().toISOString(),
        payload: {
          message: 'Invalid message format',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Handle authentication message
   */
  private handleAuthMessage(
    clientId: string,
    message: any
  ): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { userId, projectId, runId } = message.payload || {};

    if (userId) {
      client.userId = userId;
      client.projectId = projectId;
      client.runId = runId;
      client.isAuthenticated = true;

      this.sendToClient(clientId, {
        type: 'auth.success',
        timestamp: new Date().toISOString(),
        payload: {
          userId,
          projectId,
          runId,
        },
      });

      console.log(
        `[WebSocketManager] Client authenticated: ${clientId} (user: ${userId})`
      );
    } else {
      this.sendToClient(clientId, {
        type: 'auth.failed',
        timestamp: new Date().toISOString(),
        payload: {
          message: 'Authentication failed: missing userId',
        },
      });
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribeMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { eventType, eventCategory } = message.payload || {};

    if (eventType && typeof eventType === 'string') {
      client.subscriptions.add(eventType);
      this.sendToClient(clientId, {
        type: 'subscription.added',
        timestamp: new Date().toISOString(),
        payload: {
          eventType,
          subscriptions: Array.from(client.subscriptions),
        },
      });
    } else if (eventCategory) {
      const category = EventCategories[eventCategory as EventCategory];
      if (category) {
        (category as readonly string[]).forEach((event) => {
          client.subscriptions.add(event);
        });
        this.sendToClient(clientId, {
          type: 'subscription.added',
          timestamp: new Date().toISOString(),
          payload: {
            eventCategory,
            subscriptions: Array.from(client.subscriptions),
          },
        });
      }
    }
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribeMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { eventType, eventCategory } = message.payload || {};

    if (eventType && typeof eventType === 'string') {
      client.subscriptions.delete(eventType);
      this.sendToClient(clientId, {
        type: 'subscription.removed',
        timestamp: new Date().toISOString(),
        payload: {
          eventType,
          subscriptions: Array.from(client.subscriptions),
        },
      });
    } else if (eventCategory) {
      const category = EventCategories[eventCategory as EventCategory];
      if (category) {
        (category as readonly string[]).forEach((event) => {
          client.subscriptions.delete(event);
        });
        this.sendToClient(clientId, {
          type: 'subscription.removed',
          timestamp: new Date().toISOString(),
          payload: {
            eventCategory,
            subscriptions: Array.from(client.subscriptions),
          },
        });
      }
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    console.log(
      `[WebSocketManager] Client disconnected: ${clientId} (total: ${this.clients.size})`
    );
  }

  /**
   * Broadcast event from EventBus to subscribed clients
   */
  private broadcastEvent(event: AppEvent): void {
    const wsEvent = event as unknown as AnyWebSocketEvent;

    if (!isValidWebSocketEvent(wsEvent)) {
      return; // Skip invalid events
    }

    const eventType = wsEvent.type;

    // Broadcast to all subscribed clients
    for (const [clientId, client] of this.clients) {
      // Check if client is subscribed to this event type
      if (client.subscriptions.has(eventType) || client.subscriptions.has('all')) {
        this.sendToClient(clientId, wsEvent);
      }
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, event: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WsSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(event));
    } catch (error) {
      console.error(
        `[WebSocketManager] Failed to send message to ${clientId}:`,
        error
      );
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcastToAll(event: any): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, event);
    }
  }

  /**
   * Broadcast message to specific run subscribers
   */
  public broadcastToRun(runId: string, event: any): void {
    for (const [clientId, client] of this.clients) {
      if (client.runId === runId) {
        this.sendToClient(clientId, event);
      }
    }
  }

  /**
   * Broadcast message to specific project subscribers
   */
  public broadcastToProject(projectId: string, event: any): void {
    for (const [clientId, client] of this.clients) {
      if (client.projectId === projectId) {
        this.sendToClient(clientId, event);
      }
    }
  }

  /**
   * Broadcast message to specific user
   */
  public broadcastToUser(userId: string, event: any): void {
    for (const [clientId, client] of this.clients) {
      if (client.userId === userId) {
        this.sendToClient(clientId, event);
      }
    }
  }

  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleClients: string[] = [];

      for (const [clientId, client] of this.clients) {
        if (now - client.lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
          staleClients.push(clientId);
        } else if (client.ws.readyState === WsSocket.OPEN) {
          // Send ping to active clients
          client.ws.ping();
        }
      }

      // Close stale connections
      for (const clientId of staleClients) {
        const client = this.clients.get(clientId);
        if (client) {
          console.warn(`[WebSocketManager] Closing stale connection: ${clientId}`);
          client.ws.close(1000, 'Heartbeat timeout');
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    subscriptions: Map<string, number>;
  } {
    let authenticatedCount = 0;
    const subscriptionCounts = new Map<string, number>();

    for (const client of this.clients.values()) {
      if (client.isAuthenticated) {
        authenticatedCount++;
      }

      for (const sub of client.subscriptions) {
        subscriptionCounts.set(sub, (subscriptionCounts.get(sub) || 0) + 1);
      }
    }

    return {
      totalConnections: this.clients.size,
      authenticatedConnections: authenticatedCount,
      subscriptions: subscriptionCounts,
    };
  }

  /**
   * Graceful shutdown
   */
  public shutdown(): void {
    this.isShuttingDown = true;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.eventBusUnsubscribe) {
      this.eventBusUnsubscribe();
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WsSocket.OPEN) {
        client.ws.close(1001, 'Server shutting down');
      }
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        console.log('[WebSocketManager] WebSocket server closed');
      });
      this.wss = null;
    }

    this.clients.clear();
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const webSocketManager = new WebSocketManager();

export default webSocketManager;
