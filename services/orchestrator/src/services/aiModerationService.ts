/**
 * AI Moderation Service (Task 94)
 * Async LLM-based moderation for forums and comments
 *
 * Security:
 * - No PHI passed to moderation LLM
 * - Only text content is analyzed
 * - Toxicity and scope enforcement
 */

import { z } from 'zod';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ModerationCategorySchema = z.enum([
  'TOXICITY',
  'HARASSMENT',
  'HATE_SPEECH',
  'SPAM',
  'OFF_TOPIC',
  'MISINFORMATION',
  'PHI_LEAK',
  'SELF_PROMOTION',
  'VIOLENCE',
  'SEXUALLY_EXPLICIT',
]);
export type ModerationCategory = z.infer<typeof ModerationCategorySchema>;

export const ModerationActionSchema = z.enum([
  'APPROVE',
  'FLAG',
  'HIDE',
  'REJECT',
  'ESCALATE',
]);
export type ModerationAction = z.infer<typeof ModerationActionSchema>;

export const ModerationStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'FLAGGED',
  'HIDDEN',
  'REJECTED',
  'ESCALATED',
  'APPEALED',
]);
export type ModerationStatus = z.infer<typeof ModerationStatusSchema>;

export const ContentTypeSchema = z.enum([
  'COMMENT',
  'FORUM_POST',
  'FORUM_REPLY',
  'CLAIM_TEXT',
  'TASK_DESCRIPTION',
  'PROFILE_BIO',
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ModerationRequestSchema = z.object({
  id: z.string().uuid(),
  contentType: ContentTypeSchema,
  contentId: z.string().uuid(),
  content: z.string().max(10000),
  authorId: z.string().uuid(),
  researchId: z.string().uuid().optional(),
  requestedAt: z.string().datetime(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
});
export type ModerationRequest = z.infer<typeof ModerationRequestSchema>;

export const ModerationResultSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  status: ModerationStatusSchema,
  action: ModerationActionSchema,
  categories: z.array(ModerationCategorySchema),
  scores: z.record(ModerationCategorySchema, z.number().min(0).max(1)),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  suggestedEdit: z.string().optional(),
  moderatedAt: z.string().datetime(),
  moderatorType: z.enum(['AI', 'HUMAN', 'SYSTEM']),
  moderatorId: z.string().optional(),
  appealable: z.boolean().default(true),
});
export type ModerationResult = z.infer<typeof ModerationResultSchema>;

export const ModerationAppealSchema = z.object({
  id: z.string().uuid(),
  resultId: z.string().uuid(),
  appealerId: z.string().uuid(),
  reason: z.string().max(2000),
  appealedAt: z.string().datetime(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reviewedBy: z.string().uuid().optional(),
  reviewedAt: z.string().datetime().optional(),
  reviewNotes: z.string().max(2000).optional(),
});
export type ModerationAppeal = z.infer<typeof ModerationAppealSchema>;

export const ModerationConfigSchema = z.object({
  researchId: z.string().uuid().optional(), // If null, global config
  thresholds: z.record(ModerationCategorySchema, z.number().min(0).max(1)).optional(),
  defaultThreshold: z.number().min(0).max(1).default(0.7),
  autoApproveThreshold: z.number().min(0).max(1).default(0.3),
  autoRejectThreshold: z.number().min(0).max(1).default(0.9),
  enabledCategories: z.array(ModerationCategorySchema).optional(),
  requireHumanReview: z.boolean().default(false),
  allowAppeals: z.boolean().default(true),
  appealWindow: z.number().int().min(0).default(72), // Hours
});
export type ModerationConfig = z.infer<typeof ModerationConfigSchema>;

// ---------------------------------------------------------------------------
// In-Memory Storage (would be database in production)
// ---------------------------------------------------------------------------

const requests = new Map<string, ModerationRequest>();
const results = new Map<string, ModerationResult>();
const appeals = new Map<string, ModerationAppeal>();
const configs = new Map<string, ModerationConfig>();

// Queue for async processing
const moderationQueue: string[] = [];

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ModerationConfig = {
  defaultThreshold: 0.7,
  autoApproveThreshold: 0.3,
  autoRejectThreshold: 0.9,
  requireHumanReview: false,
  allowAppeals: true,
  appealWindow: 72,
};

// ---------------------------------------------------------------------------
// Keyword-based Detection (would be ML/LLM in production)
// ---------------------------------------------------------------------------

const TOXICITY_PATTERNS = [
  /\b(stupid|idiot|moron|dumb)\b/gi,
  /\b(hate|kill|die|destroy)\s+(you|them|him|her)\b/gi,
  /\b(f+u+c+k|s+h+i+t|a+s+s+h+o+l+e)\b/gi,
];

const HARASSMENT_PATTERNS = [
  /\b(you\s+are\s+(worthless|useless|pathetic))\b/gi,
  /\b(shut\s+up|go\s+away|get\s+lost)\b/gi,
  /\b(nobody\s+cares|no\s+one\s+asked)\b/gi,
];

const SPAM_PATTERNS = [
  /\b(click\s+here|free\s+money|earn\s+\$\d+)\b/gi,
  /\b(buy\s+now|limited\s+offer|act\s+fast)\b/gi,
  /(http[s]?:\/\/){3,}/gi, // Multiple URLs
  /(.)\1{10,}/g, // Repeated characters
];

const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{9}\b/, // SSN without dashes
  /\bMRN[:\s]?\d+/i, // Medical Record Number
  /\bpatient\s+(id|identifier)[:\s]?\w+/i,
  /\bDOB[:\s]?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i,
];

const OFF_TOPIC_KEYWORDS = [
  'politics', 'election', 'vote', 'president', 'congress',
  'crypto', 'bitcoin', 'nft', 'stonks',
  'sports', 'game', 'score', 'team',
];

function detectPatterns(
  content: string,
  patterns: RegExp[],
  weight: number = 1.0
): { score: number; matches: string[] } {
  const matches: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const pattern of patterns) {
    const found = lowerContent.match(pattern);
    if (found) {
      matches.push(...found);
    }
  }

  // Score based on number of matches, capped at 1.0
  const score = Math.min(1.0, (matches.length * 0.2 * weight));
  return { score, matches };
}

function detectKeywords(
  content: string,
  keywords: string[],
  weight: number = 1.0
): { score: number; matches: string[] } {
  const matches: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const keyword of keywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      matches.push(keyword);
    }
  }

  const score = Math.min(1.0, (matches.length * 0.15 * weight));
  return { score, matches };
}

// ---------------------------------------------------------------------------
// AI Moderation Simulation
// ---------------------------------------------------------------------------

interface ModerationScores {
  toxicity: number;
  harassment: number;
  spam: number;
  offTopic: number;
  phiLeak: number;
  confidence: number;
  detectedIssues: string[];
}

function analyzeContent(content: string, contentType: ContentType): ModerationScores {
  const detectedIssues: string[] = [];

  // Toxicity detection
  const toxicityResult = detectPatterns(content, TOXICITY_PATTERNS);
  if (toxicityResult.matches.length > 0) {
    detectedIssues.push(`Toxicity: ${toxicityResult.matches.slice(0, 3).join(', ')}`);
  }

  // Harassment detection
  const harassmentResult = detectPatterns(content, HARASSMENT_PATTERNS);
  if (harassmentResult.matches.length > 0) {
    detectedIssues.push(`Harassment: ${harassmentResult.matches.slice(0, 3).join(', ')}`);
  }

  // Spam detection
  const spamResult = detectPatterns(content, SPAM_PATTERNS);
  if (spamResult.matches.length > 0) {
    detectedIssues.push(`Spam indicators: ${spamResult.matches.length} found`);
  }

  // Off-topic detection (context-dependent)
  const offTopicResult = detectKeywords(content, OFF_TOPIC_KEYWORDS, 0.5);
  if (offTopicResult.matches.length > 2) {
    detectedIssues.push(`Off-topic keywords: ${offTopicResult.matches.slice(0, 3).join(', ')}`);
  }

  // PHI leak detection
  const phiResult = detectPatterns(content, PHI_PATTERNS, 2.0);
  if (phiResult.matches.length > 0) {
    detectedIssues.push(`Potential PHI detected: ${phiResult.matches.length} patterns`);
  }

  // Calculate confidence based on content length and detection certainty
  const contentLengthFactor = Math.min(1.0, content.length / 500);
  const detectionFactor = detectedIssues.length > 0 ? 0.8 : 0.9;
  const confidence = contentLengthFactor * detectionFactor;

  return {
    toxicity: toxicityResult.score,
    harassment: harassmentResult.score,
    spam: spamResult.score,
    offTopic: offTopicResult.score,
    phiLeak: phiResult.score,
    confidence,
    detectedIssues,
  };
}

function determineAction(
  scores: ModerationScores,
  config: ModerationConfig
): { action: ModerationAction; categories: ModerationCategory[] } {
  const categories: ModerationCategory[] = [];
  const threshold = config.defaultThreshold;
  const autoApprove = config.autoApproveThreshold;
  const autoReject = config.autoRejectThreshold;

  // Check each category
  if (scores.toxicity >= threshold) categories.push('TOXICITY');
  if (scores.harassment >= threshold) categories.push('HARASSMENT');
  if (scores.spam >= threshold) categories.push('SPAM');
  if (scores.offTopic >= threshold) categories.push('OFF_TOPIC');
  if (scores.phiLeak > 0) categories.push('PHI_LEAK'); // Any PHI is flagged

  // PHI leaks are always escalated
  if (categories.includes('PHI_LEAK')) {
    return { action: 'ESCALATE', categories };
  }

  // Determine action based on max score
  const maxScore = Math.max(
    scores.toxicity,
    scores.harassment,
    scores.spam,
    scores.offTopic
  );

  if (maxScore >= autoReject) {
    return { action: 'REJECT', categories };
  }

  if (maxScore >= threshold) {
    return { action: 'FLAG', categories };
  }

  if (maxScore <= autoApprove && categories.length === 0) {
    return { action: 'APPROVE', categories };
  }

  // Default to flag for human review
  return { action: 'FLAG', categories };
}

// ---------------------------------------------------------------------------
// Moderation Operations
// ---------------------------------------------------------------------------

export async function submitForModeration(
  input: Omit<ModerationRequest, 'id' | 'requestedAt'>
): Promise<ModerationRequest> {
  const request: ModerationRequest = {
    id: crypto.randomUUID(),
    ...input,
    requestedAt: new Date().toISOString(),
  };

  requests.set(request.id, request);
  moderationQueue.push(request.id);

  // In production, this would be processed by a background worker
  // For demo, process immediately
  await processModerationRequest(request.id);

  return request;
}

export async function processModerationRequest(requestId: string): Promise<ModerationResult | undefined> {
  const request = requests.get(requestId);
  if (!request) return undefined;

  // Get config (research-specific or global)
  const config = request.researchId
    ? (configs.get(request.researchId) || DEFAULT_CONFIG)
    : DEFAULT_CONFIG;

  // Analyze content
  const scores = analyzeContent(request.content, request.contentType);

  // Determine action
  const { action, categories } = determineAction(scores, config);

  // Create result
  const result: ModerationResult = {
    id: crypto.randomUUID(),
    requestId,
    status: actionToStatus(action),
    action,
    categories,
    scores: {
      TOXICITY: scores.toxicity,
      HARASSMENT: scores.harassment,
      SPAM: scores.spam,
      OFF_TOPIC: scores.offTopic,
      PHI_LEAK: scores.phiLeak,
      HATE_SPEECH: 0,
      MISINFORMATION: 0,
      SELF_PROMOTION: 0,
      VIOLENCE: 0,
      SEXUALLY_EXPLICIT: 0,
    },
    confidence: scores.confidence,
    reasoning: scores.detectedIssues.length > 0
      ? `Detected issues: ${scores.detectedIssues.join('; ')}`
      : 'No issues detected',
    moderatedAt: new Date().toISOString(),
    moderatorType: 'AI',
    appealable: config.allowAppeals && action !== 'APPROVE',
  };

  results.set(result.id, result);

  // Remove from queue
  const queueIndex = moderationQueue.indexOf(requestId);
  if (queueIndex > -1) {
    moderationQueue.splice(queueIndex, 1);
  }

  return result;
}

function actionToStatus(action: ModerationAction): ModerationStatus {
  switch (action) {
    case 'APPROVE': return 'APPROVED';
    case 'FLAG': return 'FLAGGED';
    case 'HIDE': return 'HIDDEN';
    case 'REJECT': return 'REJECTED';
    case 'ESCALATE': return 'ESCALATED';
  }
}

export function getModerationResult(requestId: string): ModerationResult | undefined {
  for (const result of results.values()) {
    if (result.requestId === requestId) {
      return result;
    }
  }
  return undefined;
}

export function getModerationResultById(resultId: string): ModerationResult | undefined {
  return results.get(resultId);
}

export function getContentModerationHistory(contentId: string): ModerationResult[] {
  const contentRequests = Array.from(requests.values())
    .filter(r => r.contentId === contentId);

  const history: ModerationResult[] = [];
  for (const request of contentRequests) {
    const result = getModerationResult(request.id);
    if (result) {
      history.push(result);
    }
  }

  return history.sort((a, b) => a.moderatedAt.localeCompare(b.moderatedAt));
}

// ---------------------------------------------------------------------------
// Human Review Operations
// ---------------------------------------------------------------------------

export function humanReview(
  resultId: string,
  reviewerId: string,
  decision: ModerationAction,
  notes?: string
): ModerationResult | undefined {
  const result = results.get(resultId);
  if (!result) return undefined;

  result.action = decision;
  result.status = actionToStatus(decision);
  result.moderatorType = 'HUMAN';
  result.moderatorId = reviewerId;
  result.reasoning = notes || result.reasoning;
  result.moderatedAt = new Date().toISOString();

  results.set(resultId, result);
  return result;
}

export function getPendingReviews(): Array<{ request: ModerationRequest; result: ModerationResult }> {
  const pending: Array<{ request: ModerationRequest; result: ModerationResult }> = [];

  for (const result of results.values()) {
    if (result.status === 'FLAGGED' || result.status === 'ESCALATED') {
      const request = requests.get(result.requestId);
      if (request) {
        pending.push({ request, result });
      }
    }
  }

  return pending.sort((a, b) => {
    // Escalated first, then by date
    if (a.result.status === 'ESCALATED' && b.result.status !== 'ESCALATED') return -1;
    if (b.result.status === 'ESCALATED' && a.result.status !== 'ESCALATED') return 1;
    return a.result.moderatedAt.localeCompare(b.result.moderatedAt);
  });
}

// ---------------------------------------------------------------------------
// Appeal Operations
// ---------------------------------------------------------------------------

export function submitAppeal(
  resultId: string,
  appealerId: string,
  reason: string
): ModerationAppeal | undefined {
  const result = results.get(resultId);
  if (!result || !result.appealable) return undefined;

  const appeal: ModerationAppeal = {
    id: crypto.randomUUID(),
    resultId,
    appealerId,
    reason,
    appealedAt: new Date().toISOString(),
    status: 'PENDING',
  };

  appeals.set(appeal.id, appeal);

  // Update result status
  result.status = 'APPEALED';
  results.set(resultId, result);

  return appeal;
}

export function reviewAppeal(
  appealId: string,
  reviewerId: string,
  decision: 'APPROVED' | 'REJECTED',
  notes?: string
): ModerationAppeal | undefined {
  const appeal = appeals.get(appealId);
  if (!appeal) return undefined;

  appeal.status = decision;
  appeal.reviewedBy = reviewerId;
  appeal.reviewedAt = new Date().toISOString();
  appeal.reviewNotes = notes;

  appeals.set(appealId, appeal);

  // Update result if appeal approved
  if (decision === 'APPROVED') {
    const result = results.get(appeal.resultId);
    if (result) {
      result.action = 'APPROVE';
      result.status = 'APPROVED';
      results.set(appeal.resultId, result);
    }
  }

  return appeal;
}

export function getPendingAppeals(): ModerationAppeal[] {
  return Array.from(appeals.values())
    .filter(a => a.status === 'PENDING')
    .sort((a, b) => a.appealedAt.localeCompare(b.appealedAt));
}

// ---------------------------------------------------------------------------
// Configuration Operations
// ---------------------------------------------------------------------------

export function setModerationConfig(
  researchId: string | null,
  config: Partial<ModerationConfig>
): ModerationConfig {
  const key = researchId || 'global';
  const existing = configs.get(key) || DEFAULT_CONFIG;

  const updated: ModerationConfig = {
    ...existing,
    ...config,
    researchId: researchId || undefined,
  };

  configs.set(key, updated);
  return updated;
}

export function getModerationConfig(researchId?: string): ModerationConfig {
  if (researchId) {
    const specific = configs.get(researchId);
    if (specific) return specific;
  }
  return configs.get('global') || DEFAULT_CONFIG;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface ModerationStats {
  totalRequests: number;
  byStatus: Record<ModerationStatus, number>;
  byAction: Record<ModerationAction, number>;
  byCategory: Record<ModerationCategory, number>;
  averageConfidence: number;
  appealRate: number;
  appealApprovalRate: number;
  averageProcessingTime: number; // ms
}

export function getModerationStats(researchId?: string): ModerationStats {
  let filteredRequests = Array.from(requests.values());
  if (researchId) {
    filteredRequests = filteredRequests.filter(r => r.researchId === researchId);
  }

  const filteredResults = filteredRequests
    .map(r => getModerationResult(r.id))
    .filter((r): r is ModerationResult => r !== undefined);

  const filteredAppeals = Array.from(appeals.values())
    .filter(a => {
      const result = results.get(a.resultId);
      const request = result ? requests.get(result.requestId) : undefined;
      return !researchId || request?.researchId === researchId;
    });

  const byStatus: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let totalConfidence = 0;

  for (const result of filteredResults) {
    byStatus[result.status] = (byStatus[result.status] || 0) + 1;
    byAction[result.action] = (byAction[result.action] || 0) + 1;
    totalConfidence += result.confidence;

    for (const category of result.categories) {
      byCategory[category] = (byCategory[category] || 0) + 1;
    }
  }

  const approvedAppeals = filteredAppeals.filter(a => a.status === 'APPROVED').length;

  return {
    totalRequests: filteredRequests.length,
    byStatus: byStatus as Record<ModerationStatus, number>,
    byAction: byAction as Record<ModerationAction, number>,
    byCategory: byCategory as Record<ModerationCategory, number>,
    averageConfidence: filteredResults.length > 0 ? totalConfidence / filteredResults.length : 0,
    appealRate: filteredResults.length > 0 ? (filteredAppeals.length / filteredResults.length) * 100 : 0,
    appealApprovalRate: filteredAppeals.length > 0 ? (approvedAppeals / filteredAppeals.length) * 100 : 0,
    averageProcessingTime: 0, // Would be calculated from request/result timestamps in production
  };
}
