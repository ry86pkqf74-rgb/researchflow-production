/**
 * WebSocket Server for Real-time Collaboration
 *
 * Handles Yjs CRDT synchronization for collaborative editing.
 * Manages user presence and awareness updates.
 *
 * Features:
 * - Yjs WebSocket sync protocol
 * - PostgreSQL persistence for updates
 * - User presence tracking
 * - Room-based isolation
 * - Auto-cleanup of old updates
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { Server as HTTPServer } from 'http';
import { YjsPersistence } from './yjs-persistence';
import { PresenceService } from './presence-service';

interface Room {
  name: string;
  doc: Y.Doc;
  clients: Set<WebSocket>;
  lastActivity: number;
}

interface ClientData {
  roomName: string;
  userId: string;
  userName: string;
}

export class CollaborationWebSocketServer {
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map();
  private clientData: WeakMap<WebSocket, ClientData> = new WeakMap();
  private persistence: YjsPersistence;
  private presenceService: PresenceService;

  // Cleanup interval (every 5 minutes)
  private cleanupInterval: NodeJS.Timeout;
  private readonly ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/collaboration' });
    this.persistence = new YjsPersistence();
    this.presenceService = new PresenceService();

    this.setupConnectionHandler();
    this.startCleanupInterval();

    console.log('[CollaborationWS] WebSocket server initialized at /collaboration');
  }

  /**
   * Setup WebSocket connection handler
   */
  private setupConnectionHandler() {
    this.wss.on('connection', async (ws: WebSocket, req) => {
      console.log('[CollaborationWS] New connection');

      // Extract room name and user info from query params
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const roomName = url.searchParams.get('room');
      const userId = url.searchParams.get('userId') || 'anonymous';
      const userName = url.searchParams.get('userName') || 'Anonymous';

      if (!roomName) {
        ws.close(1008, 'Room name required');
        return;
      }

      // Store client data
      this.clientData.set(ws, { roomName, userId, userName });

      // Get or create room
      const room = await this.getOrCreateRoom(roomName);

      // Add client to room
      room.clients.add(ws);
      room.lastActivity = Date.now();

      // Track presence
      await this.presenceService.userJoined(roomName, userId, userName);

      console.log(
        `[CollaborationWS] User ${userName} joined room ${roomName} (${room.clients.size} clients)`
      );

      // Send sync step 1 (full document state)
      const stateVector = Y.encodeStateVector(room.doc);
      const syncMessage = this.createSyncMessage(1, stateVector);
      ws.send(syncMessage);

      // Setup message handler
      ws.on('message', async (data: Buffer) => {
        await this.handleMessage(ws, room, data);
      });

      // Setup close handler
      ws.on('close', () => {
        this.handleDisconnect(ws, room);
      });

      // Setup error handler
      ws.on('error', (error) => {
        console.error('[CollaborationWS] WebSocket error:', error);
      });

      // Broadcast presence to other clients
      this.broadcastPresence(room, userId, 'joined');
    });
  }

  /**
   * Get or create a room
   */
  private async getOrCreateRoom(roomName: string): Promise<Room> {
    let room = this.rooms.get(roomName);

    if (!room) {
      // Create new room
      const doc = new Y.Doc();

      // Load persisted updates from database
      const updates = await this.persistence.getUpdates(roomName);

      if (updates.length > 0) {
        // Apply updates to doc
        Y.applyUpdate(doc, Y.mergeUpdates(updates));
        console.log(`[CollaborationWS] Loaded ${updates.length} updates for room ${roomName}`);
      }

      // Setup update handler to persist changes
      doc.on('update', async (update: Uint8Array, origin: any) => {
        // Don't persist updates that came from database
        if (origin !== 'database') {
          await this.persistence.storeUpdate(roomName, update);
        }
      });

      room = {
        name: roomName,
        doc,
        clients: new Set(),
        lastActivity: Date.now(),
      };

      this.rooms.set(roomName, room);
      console.log(`[CollaborationWS] Created new room: ${roomName}`);
    }

    return room;
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(ws: WebSocket, room: Room, data: Buffer) {
    room.lastActivity = Date.now();

    try {
      // Parse Yjs message
      const message = new Uint8Array(data);
      const messageType = message[0];

      switch (messageType) {
        case 0: // Sync step 1
          this.handleSyncStep1(ws, room, message);
          break;

        case 1: // Sync step 2
          this.handleSyncStep2(ws, room, message);
          break;

        case 2: // Update
          await this.handleUpdate(ws, room, message);
          break;

        case 3: // Awareness
          this.handleAwareness(ws, room, message);
          break;

        default:
          console.warn('[CollaborationWS] Unknown message type:', messageType);
      }
    } catch (error) {
      console.error('[CollaborationWS] Error handling message:', error);
    }
  }

  /**
   * Handle sync step 1 (client sends state vector)
   */
  private handleSyncStep1(ws: WebSocket, room: Room, message: Uint8Array) {
    const stateVector = message.slice(1);
    const update = Y.encodeStateAsUpdate(room.doc, stateVector);

    // Send sync step 2 with missing updates
    const syncMessage = this.createSyncMessage(2, update);
    ws.send(syncMessage);
  }

  /**
   * Handle sync step 2 (server sends missing updates)
   */
  private handleSyncStep2(ws: WebSocket, room: Room, message: Uint8Array) {
    const update = message.slice(1);
    Y.applyUpdate(room.doc, update, 'client');
  }

  /**
   * Handle update message
   */
  private async handleUpdate(ws: WebSocket, room: Room, message: Uint8Array) {
    const update = message.slice(1);

    // Apply update to room's document
    Y.applyUpdate(room.doc, update, 'client');

    // Broadcast to other clients in the room
    const updateMessage = this.createSyncMessage(2, update);
    this.broadcast(room, updateMessage, ws);
  }

  /**
   * Handle awareness message (presence)
   */
  private handleAwareness(ws: WebSocket, room: Room, message: Uint8Array) {
    // Broadcast awareness to other clients
    this.broadcast(room, message, ws);

    // Update presence in database
    const clientData = this.clientData.get(ws);
    if (clientData) {
      this.presenceService.updatePresence(
        room.name,
        clientData.userId,
        clientData.userName
      );
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(ws: WebSocket, room: Room) {
    const clientData = this.clientData.get(ws);

    room.clients.delete(ws);

    if (clientData) {
      console.log(
        `[CollaborationWS] User ${clientData.userName} left room ${room.name} (${room.clients.size} clients)`
      );

      // Track presence
      this.presenceService.userLeft(room.name, clientData.userId);

      // Broadcast presence to other clients
      this.broadcastPresence(room, clientData.userId, 'left');
    }

    // Clean up empty rooms
    if (room.clients.size === 0) {
      console.log(`[CollaborationWS] Room ${room.name} is empty, scheduling cleanup`);
      // Don't delete immediately - keep for a while in case user reconnects
    }
  }

  /**
   * Broadcast message to all clients in room except sender
   */
  private broadcast(room: Room, message: Uint8Array | Buffer, exclude?: WebSocket) {
    room.clients.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast presence update
   */
  private broadcastPresence(room: Room, userId: string, action: 'joined' | 'left') {
    const presenceMessage = JSON.stringify({
      type: 'presence',
      userId,
      action,
      timestamp: Date.now(),
    });

    room.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(presenceMessage);
      }
    });
  }

  /**
   * Create Yjs sync message
   */
  private createSyncMessage(type: number, payload: Uint8Array): Uint8Array {
    const message = new Uint8Array(1 + payload.length);
    message[0] = type;
    message.set(payload, 1);
    return message;
  }

  /**
   * Start cleanup interval for inactive rooms
   */
  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean up inactive rooms
   */
  private async cleanupInactiveRooms() {
    const now = Date.now();
    const roomsToDelete: string[] = [];

    this.rooms.forEach((room, roomName) => {
      // Delete rooms with no clients that have been inactive
      if (room.clients.size === 0 && now - room.lastActivity > this.ROOM_TIMEOUT) {
        roomsToDelete.push(roomName);
      }
    });

    for (const roomName of roomsToDelete) {
      console.log(`[CollaborationWS] Cleaning up inactive room: ${roomName}`);

      // Create final snapshot before cleanup
      const room = this.rooms.get(roomName);
      if (room) {
        const snapshot = Y.encodeStateAsUpdate(room.doc);
        await this.persistence.storeSnapshot(roomName, snapshot);
      }

      this.rooms.delete(roomName);
    }

    if (roomsToDelete.length > 0) {
      console.log(`[CollaborationWS] Cleaned up ${roomsToDelete.length} inactive rooms`);
    }
  }

  /**
   * Shutdown server
   */
  async shutdown() {
    console.log('[CollaborationWS] Shutting down...');

    clearInterval(this.cleanupInterval);

    // Close all connections
    this.wss.clients.forEach((client) => {
      client.close(1001, 'Server shutting down');
    });

    // Store final snapshots for all rooms
    for (const [roomName, room] of this.rooms.entries()) {
      const snapshot = Y.encodeStateAsUpdate(room.doc);
      await this.persistence.storeSnapshot(roomName, snapshot);
    }

    this.wss.close();
    console.log('[CollaborationWS] Shutdown complete');
  }
}
