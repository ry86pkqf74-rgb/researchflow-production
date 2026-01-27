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
 * 4. AI response generation (placeholder for Phase 3)
 * 5. Assistant message + action storage
 */
router.post(
  '/:agentType/:artifactType/:artifactId/message',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentType, artifactType, artifactId } = req.params;
      const governanceMode = getGovernanceMode(req);

      // Validate
      const validatedAgentType = AgentTypeSchema.parse(agentType);
      const body = SendMessageSchema.parse(req.body);

      // Get or create session
      const session = await chatRepository.findOrCreateSession({
        artifactType,
        artifactId,
        agentType: validatedAgentType,
        createdBy: getUserId(req),
      });

      // PHI scanning (placeholder - will be implemented in Phase 3)
      const phiDetected = false; // TODO: import and use PHI scanner

      // Governance check
      if (phiDetected && governanceMode === 'LIVE') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PHI_BLOCKED',
            message: 'Protected Health Information detected. Cannot proceed in LIVE mode.',
          },
        });
      }

      // Store user message
      const userMessage = await chatRepository.createMessage({
        sessionId: session.id,
        role: 'user',
        authorId: getUserId(req),
        content: body.content,
        metadata: body.context || {},
        phiDetected,
      });

      // Generate AI response (placeholder - will be implemented in Phase 3)
      // For now, return a mock response
      const aiResponseContent = `I understand you're asking about ${artifactType}. As the ${agentType} agent, I'm here to help. This is a placeholder response - the full AI integration will be implemented in Phase 3.`;

      // Store assistant message
      const assistantMessage = await chatRepository.createMessage({
        sessionId: session.id,
        role: 'assistant',
        content: aiResponseContent,
        metadata: {
          model: 'placeholder',
          context: body.context,
        },
      });

      // Create placeholder action (example)
      // In Phase 3, actions will be parsed from AI response
      const action = await chatRepository.createAction({
        messageId: assistantMessage.id,
        actionType: 'suggest_edit',
        payload: {
          type: 'patch',
          description: 'Placeholder action - full implementation in Phase 4',
        },
      });

      res.json({
        success: true,
        userMessage: formatMessage(userMessage),
        assistantMessage: {
          ...formatMessage(assistantMessage),
          actions: [formatAction(action)],
        },
        governance: {
          mode: governanceMode,
          phiDetected,
          phiWarning: phiDetected && governanceMode === 'DEMO'
            ? 'PHI detected in message. Proceeding in DEMO mode.'
            : null,
        },
      });
    } catch (error) {
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

      // Update to approved (execution handled in Phase 4)
      const updatedAction = await chatRepository.updateActionStatus(
        actionId,
        'approved',
        { approvedBy: getUserId(req), approvedAt: new Date().toISOString() }
      );

      res.json({
        success: true,
        action: formatAction(updatedAction),
        message: 'Action approved. Execution will be implemented in Phase 4.',
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
