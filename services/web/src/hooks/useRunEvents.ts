/**
 * useRunEvents Hook
 *
 * React hook for subscribing to real-time research run events via WebSocket.
 * Handles connection management, event subscription, and automatic cleanup.
 *
 * Features:
 * - Automatic WebSocket connection
 * - Event type filtering
 * - Reconnection with exponential backoff
 * - TypeScript-safe event handling
 * - Memory leak prevention with proper cleanup
 *
 * @module hooks/useRunEvents
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Event handler callback type
 */
export type EventHandler<T = any> = (event: T) => void;

/**
 * WebSocket message types
 */
interface WebSocketMessage {
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

/**
 * Connection state
 */
enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

/**
 * Hook options
 */
export interface UseRunEventsOptions {
  runId?: string;
  projectId?: string;
  userId?: string;
  eventTypes?: string[];
  eventCategories?: string[];
  onError?: (error: Error) => void;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

/**
 * Hook return value
 */
export interface UseRunEventsReturn {
  isConnected: boolean;
  connectionState: ConnectionState;
  error: Error | null;
  subscribe: (eventType: string, handler: EventHandler) => () => void;
  unsubscribe: (eventType: string, handler: EventHandler) => void;
  subscribe_category: (
    category: string,
    handler: EventHandler
  ) => () => void;
  unsubscribe_category: (category: string, handler: EventHandler) => void;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * useRunEvents Hook
 *
 * Manages WebSocket connection and event subscriptions for a research run.
 *
 * @example
 * ```tsx
 * const { isConnected, subscribe } = useRunEvents({
 *   runId: 'run-123',
 *   userId: 'user-456',
 * });
 *
 * useEffect(() => {
 *   const unsubscribe = subscribe('run.started', (event) => {
 *     console.log('Run started:', event);
 *   });
 *
 *   return unsubscribe;
 * }, [subscribe]);
 * ```
 */
export function useRunEvents(options: UseRunEventsOptions = {}): UseRunEventsReturn {
  const {
    runId,
    projectId,
    userId,
    eventTypes = [],
    eventCategories = [],
    onError,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [connectionState, setConnectionState] = useState(
    ConnectionState.DISCONNECTED
  );
  const [error, setError] = useState<Error | null>(null);

  const isConnected = connectionState === ConnectionState.CONNECTED;

  /**
   * Get WebSocket URL from environment or construct from window location
   */
  const getWebSocketUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';

    // Try to get from env variable first
    const envUrl = process.env.REACT_APP_WEBSOCKET_URL ||
      process.env.VITE_WEBSOCKET_URL;
    if (envUrl) {
      return envUrl;
    }

    // Construct from window location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }, []);

  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;

      // Route message to registered handlers
      const handlers = handlersRef.current.get(message.type);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(message);
          } catch (err) {
            console.error(`Error in event handler for ${message.type}:`, err);
          }
        });
      }

      // Also emit to 'all' handlers
      const allHandlers = handlersRef.current.get('all');
      if (allHandlers) {
        allHandlers.forEach((handler) => {
          try {
            handler(message);
          } catch (err) {
            console.error('Error in all-events handler:', err);
          }
        });
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setConnectionState(ConnectionState.CONNECTING);
    setError(null);

    try {
      const url = getWebSocketUrl();
      if (!url) {
        throw new Error('WebSocket URL not configured');
      }

      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[useRunEvents] WebSocket connected');
        setConnectionState(ConnectionState.CONNECTED);
        reconnectCountRef.current = 0;

        // Send authentication if credentials provided
        if (userId) {
          ws.send(
            JSON.stringify({
              type: 'auth',
              payload: {
                userId,
                projectId,
                runId,
              },
            })
          );
        }

        // Subscribe to requested event types
        eventTypes.forEach((eventType) => {
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              payload: { eventType },
            })
          );
        });

        // Subscribe to requested event categories
        eventCategories.forEach((category) => {
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              payload: { eventCategory: category },
            })
          );
        });

        // Start ping interval to detect stale connections
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // 30 seconds
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        const err = new Error('WebSocket error');
        console.error('[useRunEvents] WebSocket error:', err);
        setError(err);
        onError?.(err);
      };

      ws.onclose = () => {
        console.log('[useRunEvents] WebSocket closed');
        setConnectionState(ConnectionState.DISCONNECTED);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt reconnection
        if (
          autoConnect &&
          reconnectCountRef.current < reconnectAttempts
        ) {
          const delay = reconnectDelay * Math.pow(2, reconnectCountRef.current);
          reconnectCountRef.current++;
          setConnectionState(ConnectionState.RECONNECTING);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setConnectionState(ConnectionState.ERROR);
      onError?.(error);
    }
  }, [
    getWebSocketUrl,
    handleMessage,
    userId,
    projectId,
    runId,
    eventTypes,
    eventCategories,
    onError,
    autoConnect,
    reconnectAttempts,
    reconnectDelay,
  ]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    wsRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
  }, []);

  /**
   * Reconnect to WebSocket
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectCountRef.current = 0;
    connect();
  }, [connect, disconnect]);

  /**
   * Subscribe to event type
   */
  const subscribe = useCallback(
    (eventType: string, handler: EventHandler): (() => void) => {
      // Initialize handler set if needed
      if (!handlersRef.current.has(eventType)) {
        handlersRef.current.set(eventType, new Set());
      }

      const handlers = handlersRef.current.get(eventType)!;
      handlers.add(handler);

      // Also request subscription on server if connected
      if (
        wsRef.current?.readyState === WebSocket.OPEN &&
        eventType !== 'all'
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: 'subscribe',
            payload: { eventType },
          })
        );
      }

      // Return unsubscribe function
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(eventType);
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'unsubscribe',
              payload: { eventType },
            })
          );
        }
      };
    },
    []
  );

  /**
   * Unsubscribe from event type
   */
  const unsubscribe = useCallback((eventType: string, handler: EventHandler) => {
    const handlers = handlersRef.current.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        handlersRef.current.delete(eventType);
      }
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'unsubscribe',
          payload: { eventType },
        })
      );
    }
  }, []);

  /**
   * Subscribe to event category
   */
  const subscribe_category = useCallback(
    (category: string, handler: EventHandler): (() => void) => {
      const categoryKey = `category:${category}`;

      if (!handlersRef.current.has(categoryKey)) {
        handlersRef.current.set(categoryKey, new Set());
      }

      const handlers = handlersRef.current.get(categoryKey)!;
      handlers.add(handler);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'subscribe',
            payload: { eventCategory: category },
          })
        );
      }

      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(categoryKey);
        }
      };
    },
    []
  );

  /**
   * Unsubscribe from event category
   */
  const unsubscribe_category = useCallback(
    (category: string, handler: EventHandler) => {
      const categoryKey = `category:${category}`;
      const handlers = handlersRef.current.get(categoryKey);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(categoryKey);
        }
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'unsubscribe',
            payload: { eventCategory: category },
          })
        );
      }
    },
    []
  );

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [autoConnect, connect]);

  return {
    isConnected,
    connectionState,
    error,
    subscribe,
    unsubscribe,
    subscribe_category,
    unsubscribe_category,
    reconnect,
    disconnect,
  };
}

export default useRunEvents;
