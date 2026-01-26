/**
 * AI Router Package
 *
 * Cost-optimized multi-model routing with quality gating and PHI protection.
 *
 * @packageDocumentation
 */

// Types
export * from './src/types';

// Services
export { ModelRouterService, getModelRouter } from './src/model-router.service';
export { QualityGateService, getQualityGate } from './src/quality-gate.service';
export type { QualityGateResult } from './src/quality-gate.service';
export { PhiGateService, getPhiGate } from './src/phi-gate.service';
export {
  PromptCacheService,
  getPromptCache,
  initializeDefaultTemplates,
  DEFAULT_TEMPLATES,
} from './src/prompt-cache.service';
export type { StructuredPrompt, PromptTemplate } from './src/prompt-cache.service';

// Package version
export const AI_ROUTER_VERSION = '2.0.0';

/**
 * Quick start helper - creates a configured router instance
 */
export function createRouter(config?: {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  defaultTier?: 'NANO' | 'MINI' | 'FRONTIER';
  escalationEnabled?: boolean;
  maxEscalations?: number;
}) {
  const { getModelRouter } = require('./src/model-router.service');
  return getModelRouter(config);
}

/**
 * Default export for convenience
 */
export default {
  createRouter,
  getModelRouter: () => require('./src/model-router.service').getModelRouter(),
  getQualityGate: () => require('./src/quality-gate.service').getQualityGate(),
  getPhiGate: () => require('./src/phi-gate.service').getPhiGate(),
  getPromptCache: () => require('./src/prompt-cache.service').getPromptCache(),
};
