/**
 * WebSocket Module
 *
 * Real-time event system for ResearchFlow using WebSocket.
 * Provides event schemas, connection management, and event broadcasting.
 *
 * @module websocket
 */

// Event types and schemas
export * from './events';

// Connection manager
export { webSocketManager, default as WebSocketManager } from './manager';

// Event broadcaster
export { runEventBroadcaster, default as RunEventBroadcaster } from './broadcaster';
