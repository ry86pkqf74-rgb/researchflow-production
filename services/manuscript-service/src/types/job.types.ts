/**
 * Job Types for Manuscript Service
 * Phase B Task definitions with Zod validation schemas
 */

import { z } from 'zod';

// Job types mapping to Phase B tasks
export const ManuscriptJobType = {
  GENERATE_OUTLINE: 'generate_outline',           // Task 70
  DRAFT_INTRO_WITH_LIT: 'draft_intro_with_lit',   // Task 51 + 60 + 69
  EMBED_CHARTS: 'embed_charts',                   // Task 52 + 45/88
  SIMULATE_PEER_REVIEW: 'simulate_peer_review',   // Task 61 + 65
  SUMMARIZE_COMMENTS: 'summarize_comments',       // Task 84
  EXPORT_MANUSCRIPT: 'export_manuscript',         // Task 58 + 68 + 85
  BILINGUAL_EXPORT: 'bilingual_export',           // Task 75
  PLAGIARISM_CHECK: 'plagiarism_check',           // Task 81
  CLAIM_VERIFY: 'claim_verify',                   // Task 56 + 90
  OVERLEAF_SYNC: 'overleaf_sync',                 // Task 76
  ORCID_PULL: 'orcid_pull',                       // Task 86
  SUBMISSION_PREPARE: 'submission_prepare',       // Task 66
  WCAG_CHECK: 'wcag_check',                       // Task 95
  ANALYZE_TONE: 'analyze_tone',                   // Task 73
  SUGGEST_TRANSITIONS: 'suggest_transitions',     // Task 71
} as const;

export type ManuscriptJobTypeValue = typeof ManuscriptJobType[keyof typeof ManuscriptJobType];

// Word limit constraints (Task 59)
export const SectionWordLimitsSchema = z.object({
  abstract: z.number().max(350).default(250),
  introduction: z.number().max(1500).default(800),
  methods: z.number().max(3000).default(1500),
  results: z.number().max(4000).default(2000),
  discussion: z.number().max(2500).default(1500),
  conclusion: z.number().max(500).default(300),
});

export const ManuscriptLimitsSchema = z.object({
  totalWords: z.number().max(10000).default(5000),
  maxReferences: z.number().max(100).default(50),
  maxFigures: z.number().max(10).default(6),
  maxTables: z.number().max(10).default(6),
  sectionLimits: SectionWordLimitsSchema.optional(),
});

// Base job payload
export const BaseJobPayloadSchema = z.object({
  manuscriptId: z.string().uuid(),
  userId: z.string().uuid(),
  researchId: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  metadata: z.record(z.unknown()).optional(),
});

// Generate Outline Job (Task 70)
export const GenerateOutlineJobSchema = BaseJobPayloadSchema.extend({
  type: z.literal(ManuscriptJobType.GENERATE_OUTLINE),
  templateType: z.enum(['research_article', 'case_report', 'review', 'letter', 'meta_analysis']).default('research_article'),
  journalTarget: z.string().optional(),
  researchBriefId: z.string().uuid().optional(),
});

// Draft Introduction Job (Task 51 + 60)
export const DraftIntroJobSchema = BaseJobPayloadSchema.extend({
  type: z.literal(ManuscriptJobType.DRAFT_INTRO_WITH_LIT),
  section: z.enum(['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion']),
  citationCacheKey: z.string().optional(),
  literatureIds: z.array(z.string()).optional(),
  wordLimit: z.number().max(3000).optional(),
});

// Export Job (Task 58 + 68 + 85)
export const ExportJobSchema = BaseJobPayloadSchema.extend({
  type: z.literal(ManuscriptJobType.EXPORT_MANUSCRIPT),
  format: z.enum(['pdf', 'docx', 'latex', 'markdown', 'html']),
  blinded: z.boolean().default(false),
  includeLineNumbers: z.boolean().default(false),
  doubleSpaced: z.boolean().default(true),
  templateId: z.string().optional(),
});

// Peer Review Job (Task 61 + 65)
export const PeerReviewJobSchema = BaseJobPayloadSchema.extend({
  type: z.literal(ManuscriptJobType.SIMULATE_PEER_REVIEW),
  reviewerProfiles: z.array(z.enum(['methodology', 'clinical', 'statistical', 'general'])).default(['methodology', 'clinical']),
  focusSections: z.array(z.string()).optional(),
});

// Plagiarism Check Job (Task 81)
export const PlagiarismCheckJobSchema = BaseJobPayloadSchema.extend({
  type: z.literal(ManuscriptJobType.PLAGIARISM_CHECK),
  checkScope: z.enum(['full', 'introduction', 'methods', 'discussion']).default('full'),
  checkAgainst: z.enum(['existing_citations', 'pubmed_corpus', 'manuscript_database', 'all']).default('all'),
});

// Claim Verify Job (Task 56 + 90)
export const ClaimVerifyJobSchema = BaseJobPayloadSchema.extend({
  type: z.literal(ManuscriptJobType.CLAIM_VERIFY),
  sections: z.array(z.string()).optional(),
  verifyAgainstPubmed: z.boolean().default(true),
});

// Export all job schemas
export type GenerateOutlineJob = z.infer<typeof GenerateOutlineJobSchema>;
export type DraftIntroJob = z.infer<typeof DraftIntroJobSchema>;
export type ExportJob = z.infer<typeof ExportJobSchema>;
export type PeerReviewJob = z.infer<typeof PeerReviewJobSchema>;
export type PlagiarismCheckJob = z.infer<typeof PlagiarismCheckJobSchema>;
export type ClaimVerifyJob = z.infer<typeof ClaimVerifyJobSchema>;

export type ManuscriptJob =
  | GenerateOutlineJob
  | DraftIntroJob
  | ExportJob
  | PeerReviewJob
  | PlagiarismCheckJob
  | ClaimVerifyJob;

// Job status
export const JobStatusSchema = z.object({
  jobId: z.string(),
  manuscriptId: z.string(),
  type: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  progress: z.number().min(0).max(100),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
  result: z.record(z.unknown()).optional(),
});

export type JobStatus = z.infer<typeof JobStatusSchema>;
