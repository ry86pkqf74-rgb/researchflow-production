/**
 * Chat Routes - REST endpoints for workflow chat agents
 *
 * Provides artifact-scoped chat functionality with:
 * - Session management (create/get)
 * - Message history retrieval
 * - AI message processing with governance
 * - Action approval/rejection
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { chatRepository } from '../repositories/chat.repository';
import type { ChatSession, ChatMessage, ChatAction } from '../repositories/chat.repository';
import { chatAgentService, ChatAgentError } from '../services/chat-agent';
import { executeAction } from '../services/chat-agent/action-executor';
import type { AgentType } from '../services/chat-agent';

const router = Router();

// Validation schemas
const AgentTypeSchema = z.enum(['irb', 'analysis', 'manuscript']);

const CreateSessionSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().optional(),
});

const SendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
});

// Helper to extract governance mode from headers
function getGovernanceMode(req: Request): 'DEMO' | 'LIVE' {
  const mode = req.headers['x-app-mode'] as string;
  return mode?.toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
}

// Helper to get user ID (mock for now)
function getUserId(req: Request): string {
  return (req as Request & { user?: { id: string } }).user?.id || 'anonymous';
}

/**
 * POST /api/chat/:agentType/:artifactType/:artifactId/sessions
 * Create or get active session for an artifact
 */
router.post(
  '/:agentType/:artifactType/:artifactId/sessions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentType, artifactType, artifactId } = req.params;

      // Validate agent type
      const validatedAgentType = AgentTypeSchema.parse(agentType);

      // Validate body
      const body = CreateSessionSchema.parse(req.body || {});

      const session = await chatRepository.findOrCreateSession({
        projectId: body.projectId,
        artifactType,
        artifactId,
        agentType: validatedAgentType,
        title: body.title,
        createdBy: getUserId(req),
      });

      res.json({
        success: true,
        session: {
          id: session.id,
          projectId: session.projectId,
          artifactType: session.artifactType,
          artifactId: session.artifactId,
          agentType: session.agentType,
          title: session.title,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat/sessions/:sessionId/messages
 * Get messages for a session
 */
router.get(
  '/sessions/:sessionId/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const messages = await chatRepository.getSessionMessages(sessionId);

      // Get actions for each assistant message
      const messagesWithActions = await Promise.all(
        messages.map(async (message) => {
          if (message.role === 'assistant') {
            const actions = await chatRepository.getMessageActions(message.id);
            return {
              ...formatMessage(message),
              actions: actions.map(formatAction),
            };
          }
          return formatMessage(message);
        })
      );

      res.json({
        success: true,
        messages: messagesWithActions,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat/sessions/:sessionId
 * Get session details
 */
router.get(
  '/sessions/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const session = await chatRepository.getSessionById(sessionId);

      res.json({
        success: true,
        session: {
          id: session.id,
          projectId: session.projectId,
          artifactType: session.artifactType,
          artifactId: session.artifactId,
          agentType: session.agentType,
          title: session.title,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat/:agentType/:artifactType/:artifactId/message
 * Send a message and get AI response
 *
 * This endpoint handles:
 * 1. PHI scanning (governance gate)
 * 2. Session lookup/creation
 * 3. User message storage
 * 4. AI response generation
 * 5. Assistant message + action storage
 */
router.post(
  '/:agentType/:artifactType/:artifactId/message',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentType, artifactType, artifactId } = req.params;

      // Validate
      const validatedAgentType = AgentTypeSchema.parse(agentType) as AgentType;
      const body = SendMessageSchema.parse(req.body);

      // Use ChatAgentService for full AI processing
      const result = await chatAgentService.sendMessage({
        agentType: validatedAgentType,
        artifactType,
        artifactId,
        content: body.content,
        userId: getUserId(req),
        context: body.context as {
          artifactContent?: string;
          artifactMetadata?: Record<string, unknown>;
          projectContext?: Record<string, unknown>;
        },
      });

      res.json({
        success: true,
        session: {
          id: result.session.id,
          artifactType: result.session.artifactType,
          artifactId: result.session.artifactId,
          agentType: result.session.agentType,
        },
        userMessage: formatMessage(result.userMessage),
        assistantMessage: {
          ...formatMessage(result.assistantMessage),
          actions: result.actions.map(formatAction),
        },
        governance: {
          mode: result.governance.mode,
          phiDetected: result.governance.phiScan.hasPHI,
          phiWarning: result.governance.decision.warning || null,
        },
      });
    } catch (error) {
      // Handle ChatAgentError specifically
      if (error instanceof ChatAgentError) {
        if (error.code === 'PHI_BLOCKED') {
          return res.status(403).json({
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
        }
        return res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      next(error);
    }
  }
);

/**
 * POST /api/chat/actions/:actionId/approve
 * Approve a proposed action
 */
router.post(
  '/actions/:actionId/approve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actionId } = req.params;

      // Get current action
      const action = await chatRepository.getActionById(actionId);

      if (action.status !== 'proposed') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot approve action with status: ${action.status}`,
          },
        });
      }

      // Update to approved
      const updatedAction = await chatRepository.updateActionStatus(
        actionId,
        'approved',
        { approvedBy: getUserId(req), approvedAt: new Date().toISOString() }
      );

      res.json({
        success: true,
        action: formatAction(updatedAction),
        message: 'Action approved. Use /api/chat/actions/:actionId/execute to apply changes.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat/actions/:actionId/execute
 * Execute an approved action against the artifact
 */
router.post(
  '/actions/:actionId/execute',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actionId } = req.params;
      const { artifactContent, artifactMetadata } = req.body || {};

      // Artifact context is required for execution
      if (!artifactContent) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ARTIFACT',
            message: 'artifactContent is required to execute action',
          },
        });
      }

      // Execute the action
      const result = await executeAction(
        actionId,
        {
          content: artifactContent,
          metadata: artifactMetadata || {},
        }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          action: formatAction(result.action),
          error: result.error,
        });
      }

      res.json({
        success: true,
        action: formatAction(result.action),
        changes: result.changes,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat/actions/:actionId/reject
 * Reject a proposed action
 */
router.post(
  '/actions/:actionId/reject',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actionId } = req.params;
      const { reason } = req.body || {};

      // Get current action
      const action = await chatRepository.getActionById(actionId);

      if (action.status !== 'proposed') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot reject action with status: ${action.status}`,
          },
        });
      }

      // Update to rejected
      const updatedAction = await chatRepository.updateActionStatus(
        actionId,
        'rejected',
        { rejectedBy: getUserId(req), rejectedAt: new Date().toISOString(), reason }
      );

      res.json({
        success: true,
        action: formatAction(updatedAction),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat/:artifactType/:artifactId/pending-actions
 * Get all pending actions for an artifact
 */
router.get(
  '/:artifactType/:artifactId/pending-actions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { artifactType, artifactId } = req.params;

      const actions = await chatRepository.getPendingActions(artifactType, artifactId);

      res.json({
        success: true,
        actions: actions.map(formatAction),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper functions for formatting responses
function formatMessage(message: ChatMessage) {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    authorId: message.authorId,
    content: message.content,
    metadata: message.metadata,
    phiDetected: message.phiDetected,
    createdAt: message.createdAt.toISOString(),
  };
}

function formatAction(action: ChatAction) {
  return {
    id: action.id,
    messageId: action.messageId,
    actionType: action.actionType,
    status: action.status,
    payload: action.payload,
    result: action.result,
    createdAt: action.createdAt.toISOString(),
    executedAt: action.executedAt?.toISOString() || null,
  };
}

export default router;
