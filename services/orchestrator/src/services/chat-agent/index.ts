/**
 * Chat Agent Service - Module Exports
 */

export { ChatAgentService, chatAgentService, ChatAgentError } from './service';
export type { ChatAgentConfig, SendMessageInput, SendMessageResult } from './service';
export { getSystemPrompt, buildPrompt, parseActions, cleanResponse, SYSTEM_PROMPTS, ACTION_TYPE_MAP } from './prompts';
export type { AgentType } from './prompts';
export { executeAction, registerActionHandler } from './action-executor';
export type { ActionExecutionResult, ArtifactContext, ActionHandler } from './action-executor';
