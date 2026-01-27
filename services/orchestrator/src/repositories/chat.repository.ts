/**
 * Chat Repository - Database operations for chat sessions, messages, and actions
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface ChatSession {
  id: string;
  projectId: string | null;
  artifactType: string;
  artifactId: string;
  agentType: 'irb' | 'analysis' | 'manuscript';
  title: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'system' | 'user' | 'assistant';
  authorId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  phiDetected: boolean;
  createdAt: Date;
}

export interface ChatAction {
  id: string;
  messageId: string;
  actionType: string;
  status: 'proposed' | 'approved' | 'executed' | 'failed' | 'rejected';
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: Date;
  executedAt: Date | null;
}

export interface CreateSessionInput {
  projectId?: string;
  artifactType: string;
  artifactId: string;
  agentType: 'irb' | 'analysis' | 'manuscript';
  title?: string;
  createdBy: string;
}

export interface CreateMessageInput {
  sessionId: string;
  role: 'system' | 'user' | 'assistant';
  authorId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  phiDetected?: boolean;
}

export interface CreateActionInput {
  messageId: string;
  actionType: string;
  payload: Record<string, unknown>;
}

/**
 * Chat Repository class for database operations
 */
export class ChatRepository {
  /**
   * Find or create an active session for an artifact
   */
  async findOrCreateSession(input: CreateSessionInput): Promise<ChatSession> {
    // First, try to find an existing session
    const existingResult = await db.execute(sql`
      SELECT id, project_id, artifact_type, artifact_id, agent_type,
             title, created_by, created_at, updated_at
      FROM chat_sessions
      WHERE artifact_type = ${input.artifactType}
        AND artifact_id = ${input.artifactId}
        AND agent_type = ${input.agentType}
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (existingResult.rows.length > 0) {
      const row = existingResult.rows[0] as Record<string, unknown>;
      return this.mapSessionRow(row);
    }

    // Create new session
    const id = uuidv4();
    await db.execute(sql`
      INSERT INTO chat_sessions (id, project_id, artifact_type, artifact_id, agent_type, title, created_by)
      VALUES (${id}, ${input.projectId || null}, ${input.artifactType}, ${input.artifactId},
              ${input.agentType}, ${input.title || null}, ${input.createdBy})
    `);

    return this.getSessionById(id);
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<ChatSession> {
    const result = await db.execute(sql`
      SELECT id, project_id, artifact_type, artifact_id, agent_type,
             title, created_by, created_at, updated_at
      FROM chat_sessions
      WHERE id = ${sessionId}
    `);

    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return this.mapSessionRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Get messages for a session
   */
  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const result = await db.execute(sql`
      SELECT id, session_id, role, author_id, content, metadata, phi_detected, created_at
      FROM chat_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `);

    return result.rows.map(row => this.mapMessageRow(row as Record<string, unknown>));
  }

  /**
   * Create a new message
   */
  async createMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const id = uuidv4();
    await db.execute(sql`
      INSERT INTO chat_messages (id, session_id, role, author_id, content, metadata, phi_detected)
      VALUES (${id}, ${input.sessionId}, ${input.role}, ${input.authorId || null},
              ${input.content}, ${JSON.stringify(input.metadata || {})}, ${input.phiDetected || false})
    `);

    return this.getMessageById(id);
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string): Promise<ChatMessage> {
    const result = await db.execute(sql`
      SELECT id, session_id, role, author_id, content, metadata, phi_detected, created_at
      FROM chat_messages
      WHERE id = ${messageId}
    `);

    if (result.rows.length === 0) {
      throw new Error(`Message not found: ${messageId}`);
    }

    return this.mapMessageRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Create a proposed action
   */
  async createAction(input: CreateActionInput): Promise<ChatAction> {
    const id = uuidv4();
    await db.execute(sql`
      INSERT INTO chat_actions (id, message_id, action_type, payload)
      VALUES (${id}, ${input.messageId}, ${input.actionType}, ${JSON.stringify(input.payload)})
    `);

    return this.getActionById(id);
  }

  /**
   * Get action by ID
   */
  async getActionById(actionId: string): Promise<ChatAction> {
    const result = await db.execute(sql`
      SELECT id, message_id, action_type, status, payload, result, created_at, executed_at
      FROM chat_actions
      WHERE id = ${actionId}
    `);

    if (result.rows.length === 0) {
      throw new Error(`Action not found: ${actionId}`);
    }

    return this.mapActionRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Get actions for a message
   */
  async getMessageActions(messageId: string): Promise<ChatAction[]> {
    const result = await db.execute(sql`
      SELECT id, message_id, action_type, status, payload, result, created_at, executed_at
      FROM chat_actions
      WHERE message_id = ${messageId}
      ORDER BY created_at ASC
    `);

    return result.rows.map(row => this.mapActionRow(row as Record<string, unknown>));
  }

  /**
   * Update action status
   */
  async updateActionStatus(
    actionId: string,
    status: ChatAction['status'],
    result?: Record<string, unknown>
  ): Promise<ChatAction> {
    const executedAt = ['executed', 'failed'].includes(status) ? new Date() : null;

    await db.execute(sql`
      UPDATE chat_actions
      SET status = ${status},
          result = ${JSON.stringify(result || {})},
          executed_at = ${executedAt}
      WHERE id = ${actionId}
    `);

    return this.getActionById(actionId);
  }

  /**
   * Get pending actions for an artifact
   */
  async getPendingActions(artifactType: string, artifactId: string): Promise<ChatAction[]> {
    const result = await db.execute(sql`
      SELECT a.id, a.message_id, a.action_type, a.status, a.payload, a.result, a.created_at, a.executed_at
      FROM chat_actions a
      JOIN chat_messages m ON m.id = a.message_id
      JOIN chat_sessions s ON s.id = m.session_id
      WHERE s.artifact_type = ${artifactType}
        AND s.artifact_id = ${artifactId}
        AND a.status = 'proposed'
      ORDER BY a.created_at ASC
    `);

    return result.rows.map(row => this.mapActionRow(row as Record<string, unknown>));
  }

  // Helper methods for row mapping
  private mapSessionRow(row: Record<string, unknown>): ChatSession {
    return {
      id: row.id as string,
      projectId: row.project_id as string | null,
      artifactType: row.artifact_type as string,
      artifactId: row.artifact_id as string,
      agentType: row.agent_type as 'irb' | 'analysis' | 'manuscript',
      title: row.title as string | null,
      createdBy: row.created_by as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapMessageRow(row: Record<string, unknown>): ChatMessage {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      role: row.role as 'system' | 'user' | 'assistant',
      authorId: row.author_id as string | null,
      content: row.content as string,
      metadata: (row.metadata as Record<string, unknown>) || {},
      phiDetected: row.phi_detected as boolean,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapActionRow(row: Record<string, unknown>): ChatAction {
    return {
      id: row.id as string,
      messageId: row.message_id as string,
      actionType: row.action_type as string,
      status: row.status as ChatAction['status'],
      payload: (row.payload as Record<string, unknown>) || {},
      result: (row.result as Record<string, unknown>) || {},
      createdAt: new Date(row.created_at as string),
      executedAt: row.executed_at ? new Date(row.executed_at as string) : null,
    };
  }
}

// Export singleton instance
export const chatRepository = new ChatRepository();
