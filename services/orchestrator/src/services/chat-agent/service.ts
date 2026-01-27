/**
 * Chat Agent Service
 *
 * Core service for AI-powered workflow chat agents.
 * Handles:
 * - LLM provider integration (OpenAI, Anthropic)
 * - PHI scanning and governance
 * - Session and message management
 * - Action parsing and proposal
 */

import { chatRepository, ChatSession, ChatMessage, ChatAction } from '../../repositories/chat.repository';
import { scanForPHI, getGovernanceDecision, type PHIScanResult } from '../../utils/phi-scanner';
import {
  getSystemPrompt,
  buildPrompt,
  parseActions,
  cleanResponse,
  ACTION_TYPE_MAP,
  type AgentType,
} from './prompts';

// Types
export interface ChatAgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: 'openai' | 'anthropic';
}

export interface SendMessageInput {
  agentType: AgentType;
  artifactType: string;
  artifactId: string;
  content: string;
  userId: string;
  projectId?: string;
  context?: {
    artifactContent?: string;
    artifactMetadata?: Record<string, unknown>;
    projectContext?: Record<string, unknown>;
  };
}

export interface SendMessageResult {
  session: ChatSession;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  actions: ChatAction[];
  governance: {
    mode: 'DEMO' | 'LIVE';
    phiScan: PHIScanResult;
    decision: {
      allowed: boolean;
      reason: string;
      warning?: string;
    };
  };
}

// Default configuration
const DEFAULT_CONFIG: ChatAgentConfig = {
  model: process.env.CHAT_AGENT_MODEL || 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  provider: (process.env.CHAT_AGENT_PROVIDER as 'openai' | 'anthropic') || 'openai',
};

/**
 * ChatAgentService class
 */
export class ChatAgentService {
  private config: ChatAgentConfig;
  private governanceMode: 'DEMO' | 'LIVE';

  constructor(config?: Partial<ChatAgentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.governanceMode = (process.env.GOVERNANCE_MODE?.toUpperCase() as 'DEMO' | 'LIVE') || 'DEMO';
  }

  /**
   * Send a message to the chat agent and get a response
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    // 1. PHI Scanning
    const phiScan = scanForPHI(input.content);
    const decision = getGovernanceDecision(phiScan, this.governanceMode);

    // 2. Governance check
    if (!decision.allowed) {
      throw new ChatAgentError('PHI_BLOCKED', decision.reason, { phiScan });
    }

    // 3. Get or create session
    const session = await chatRepository.findOrCreateSession({
      projectId: input.projectId,
      artifactType: input.artifactType,
      artifactId: input.artifactId,
      agentType: input.agentType,
      createdBy: input.userId,
    });

    // 4. Get conversation history
    const history = await chatRepository.getSessionMessages(session.id);

    // 5. Store user message
    const userMessage = await chatRepository.createMessage({
      sessionId: session.id,
      role: 'user',
      authorId: input.userId,
      content: input.content,
      metadata: { context: input.context },
      phiDetected: phiScan.hasPHI,
    });

    // 6. Build prompt with context
    const systemPrompt = getSystemPrompt(input.agentType);
    const userPrompt = buildPrompt(input.agentType, input.content, {
      ...input.context,
      conversationHistory: history.map(m => ({ role: m.role, content: m.content })),
    });

    // 7. Call LLM
    let aiResponse: string;
    try {
      aiResponse = await this.callLLM(systemPrompt, userPrompt, history);
    } catch (error) {
      throw new ChatAgentError(
        'LLM_ERROR',
        `Failed to get response from ${this.config.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { provider: this.config.provider }
      );
    }

    // 8. Parse actions from response
    const parsedActions = parseActions(aiResponse);
    const cleanedResponse = cleanResponse(aiResponse);

    // 9. Store assistant message
    const assistantMessage = await chatRepository.createMessage({
      sessionId: session.id,
      role: 'assistant',
      content: cleanedResponse,
      metadata: {
        model: this.config.model,
        provider: this.config.provider,
        hasActions: parsedActions.length > 0,
        rawResponse: aiResponse,
      },
    });

    // 10. Store proposed actions
    const actions: ChatAction[] = [];
    for (const action of parsedActions) {
      const dbAction = await chatRepository.createAction({
        messageId: assistantMessage.id,
        actionType: ACTION_TYPE_MAP[action.type] || action.type,
        payload: {
          type: action.type,
          section: action.section,
          name: action.name,
          content: action.content,
        },
      });
      actions.push(dbAction);
    }

    return {
      session,
      userMessage,
      assistantMessage,
      actions,
      governance: {
        mode: this.governanceMode,
        phiScan,
        decision,
      },
    };
  }

  /**
   * Call the LLM provider
   */
  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    history: ChatMessage[]
  ): Promise<string> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      { role: 'user' as const, content: userPrompt },
    ];

    if (this.config.provider === 'anthropic') {
      return this.callAnthropic(messages);
    }

    return this.callOpenAI(messages);
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Return mock response if no API key
      return this.getMockResponse(messages);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Return mock response if no API key
      return this.getMockResponse(messages);
    }

    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model?.includes('claude') ? this.config.model : 'claude-3-haiku-20240307',
        system: systemMessage,
        messages: conversationMessages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  /**
   * Get mock response for testing without API keys
   */
  private getMockResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): string {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';

    // Determine agent type from system prompt
    let agentType = 'manuscript';
    if (systemPrompt.includes('IRB')) agentType = 'irb';
    else if (systemPrompt.includes('statistical')) agentType = 'analysis';

    return `I understand your request regarding the ${agentType} document.

Based on your message: "${lastUserMessage.substring(0, 100)}${lastUserMessage.length > 100 ? '...' : ''}"

Here's my analysis and suggested approach:

1. **Initial Assessment**: Your request has been noted and I've analyzed the context.
2. **Recommendations**: I would suggest reviewing the relevant sections for potential improvements.
3. **Next Steps**: Consider the following edits to enhance clarity and compliance.

<action type="patch" section="draft">
[Suggested edit would appear here based on your specific request]
</action>

**Note**: This is a mock response. Configure OPENAI_API_KEY or ANTHROPIC_API_KEY for full AI capabilities.`;
  }

  /**
   * Get session with messages
   */
  async getSessionWithMessages(sessionId: string): Promise<{
    session: ChatSession;
    messages: Array<ChatMessage & { actions?: ChatAction[] }>;
  }> {
    const session = await chatRepository.getSessionById(sessionId);
    const messages = await chatRepository.getSessionMessages(sessionId);

    // Attach actions to assistant messages
    const messagesWithActions = await Promise.all(
      messages.map(async message => {
        if (message.role === 'assistant') {
          const actions = await chatRepository.getMessageActions(message.id);
          return { ...message, actions };
        }
        return message;
      })
    );

    return { session, messages: messagesWithActions };
  }
}

/**
 * Custom error class for chat agent errors
 */
export class ChatAgentError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ChatAgentError';
    this.code = code;
    this.details = details;
  }
}

// Export singleton instance
export const chatAgentService = new ChatAgentService();

export default chatAgentService;
