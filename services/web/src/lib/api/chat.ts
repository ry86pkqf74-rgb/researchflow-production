/**
 * Chat API Client
 *
 * Client-side API for interacting with chat agent endpoints
 */

import type {
  AgentType,
  ChatSession,
  ChatMessage,
  ChatAction,
  SendMessageResponse,
  GetMessagesResponse,
  ActionResponse,
} from '@/components/chat/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Get headers including auth and governance mode
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add governance mode
    const governanceMode = localStorage.getItem('governance_mode') || 'DEMO';
    headers['X-App-Mode'] = governanceMode;
  }

  return headers;
}

/**
 * Create or get an active chat session
 */
export async function createOrGetSession(
  agentType: AgentType,
  artifactType: string,
  artifactId: string,
  options?: {
    projectId?: string;
    title?: string;
  }
): Promise<ChatSession> {
  const response = await fetch(
    `${API_BASE}/api/chat/${agentType}/${artifactType}/${artifactId}/sessions`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(options || {}),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create session');
  }

  const data = await response.json();
  return data.session;
}

/**
 * Get messages for a session
 */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(
    `${API_BASE}/api/chat/sessions/${sessionId}/messages`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get messages');
  }

  const data: GetMessagesResponse = await response.json();
  return data.messages;
}

/**
 * Send a message to the chat agent
 */
export async function sendMessage(
  agentType: AgentType,
  artifactType: string,
  artifactId: string,
  content: string,
  context?: {
    artifactContent?: string;
    artifactMetadata?: Record<string, unknown>;
    projectContext?: Record<string, unknown>;
  }
): Promise<SendMessageResponse> {
  const response = await fetch(
    `${API_BASE}/api/chat/${agentType}/${artifactType}/${artifactId}/message`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content, context }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      session: {} as SendMessageResponse['session'],
      userMessage: {} as ChatMessage,
      assistantMessage: {} as ChatMessage,
      governance: { mode: 'DEMO', phiDetected: false, phiWarning: null },
      error: data.error,
    };
  }

  return data;
}

/**
 * Approve a proposed action
 */
export async function approveAction(actionId: string): Promise<ActionResponse> {
  const response = await fetch(
    `${API_BASE}/api/chat/actions/${actionId}/approve`,
    {
      method: 'POST',
      headers: getHeaders(),
    }
  );

  const data = await response.json();
  return data;
}

/**
 * Reject a proposed action
 */
export async function rejectAction(
  actionId: string,
  reason?: string
): Promise<ActionResponse> {
  const response = await fetch(
    `${API_BASE}/api/chat/actions/${actionId}/reject`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    }
  );

  const data = await response.json();
  return data;
}

/**
 * Execute an approved action
 */
export async function executeAction(
  actionId: string,
  artifactContent: string,
  artifactMetadata?: Record<string, unknown>
): Promise<ActionResponse> {
  const response = await fetch(
    `${API_BASE}/api/chat/actions/${actionId}/execute`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ artifactContent, artifactMetadata }),
    }
  );

  const data = await response.json();
  return data;
}

/**
 * Get pending actions for an artifact
 */
export async function getPendingActions(
  artifactType: string,
  artifactId: string
): Promise<ChatAction[]> {
  const response = await fetch(
    `${API_BASE}/api/chat/${artifactType}/${artifactId}/pending-actions`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get pending actions');
  }

  const data = await response.json();
  return data.actions;
}

export default {
  createOrGetSession,
  getSessionMessages,
  sendMessage,
  approveAction,
  rejectAction,
  executeAction,
  getPendingActions,
};
