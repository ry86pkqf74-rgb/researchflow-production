/**
 * AI Providers Module
 *
 * Wrapped AI provider clients with automatic Notion logging.
 */

// Claude / Anthropic
export {
  ClaudeProvider,
  getClaudeProvider,
  claudeComplete,
  type ClaudeRequestOptions,
  type ClaudeResponse,
} from './claude';

// OpenAI
export {
  OpenAIProvider,
  getOpenAIProvider,
  openaiComplete,
  openaiCompleteJSON,
  type OpenAIRequestOptions,
  type OpenAIResponse,
} from './openai';
