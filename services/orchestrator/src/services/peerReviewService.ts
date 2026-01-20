/**
 * Peer Review Scoring Service (Task 87)
 * Formal peer review system with scored rubrics and reviewer anonymization
 *
 * Security: Supports single-blind and double-blind review modes
 */

import { z } from 'zod';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ReviewBlindModeSchema = z.enum([
  'OPEN',           // All identities visible
  'SINGLE_BLIND',   // Author identity hidden from reviewers
  'DOUBLE_BLIND'    // Both identities hidden
]);
export type ReviewBlindMode = z.infer<typeof ReviewBlindModeSchema>;

export const ReviewStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'DECLINED',
  'EXPIRED'
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const RubricCriterionTypeSchema = z.enum([
  'SCALE',      // 1-5 or 1-10 numeric scale
  'BOOLEAN',    // Yes/No
  'GRADE',      // A-F or similar
  'TEXT',       // Free text only
  'CHECKLIST'   // Multiple items to check
]);
export type RubricCriterionType = z.infer<typeof RubricCriterionTypeSchema>;

export const RubricCriterionSchema = z.object({
  id: z.string().uuid(),
  rubricId: z.string().uuid(),
  name: z.string().max(200),
  description: z.string().max(1000).optional(),
  type: RubricCriterionTypeSchema,
  weight: z.number().min(0).max(100).default(1), // Percentage weight
  required: z.boolean().default(true),
  order: z.number().int().min(0),

  // Type-specific config
  scaleMin: z.number().optional(),
  scaleMax: z.number().optional(),
  scaleLabels: z.record(z.number(), z.string()).optional(), // e.g., { 1: "Poor", 5: "Excellent" }
  gradeOptions: z.array(z.string()).optional(), // e.g., ["A", "B", "C", "D", "F"]
  checklistItems: z.array(z.string()).optional(),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const ReviewRubricSchema = z.object({
  id: z.string().uuid(),
  researchId: z.string().uuid().optional(), // If null, it's a template
  name: z.string().max(200),
  description: z.string().max(1000).optional(),
  criteria: z.array(RubricCriterionSchema),
  isTemplate: z.boolean().default(false),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReviewRubric = z.infer<typeof ReviewRubricSchema>;

export const ReviewAssignmentSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  anonymousId: z.string(), // Used for blind reviews
  rubricId: z.string().uuid(),
  status: ReviewStatusSchema,
  blindMode: ReviewBlindModeSchema,
  dueDate: z.string().datetime().optional(),
  assignedBy: z.string().uuid(),
  assignedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  declinedAt: z.string().datetime().optional(),
  declineReason: z.string().max(500).optional(),
});
export type ReviewAssignment = z.infer<typeof ReviewAssignmentSchema>;

export const CriterionScoreSchema = z.object({
  criterionId: z.string().uuid(),
  scaleValue: z.number().optional(),
  booleanValue: z.boolean().optional(),
  gradeValue: z.string().optional(),
  textValue: z.string().max(2000).optional(),
  checklistValues: z.array(z.boolean()).optional(),
  comment: z.string().max(2000).optional(),
});
export type CriterionScore = z.infer<typeof CriterionScoreSchema>;

export const ReviewScoreSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  scores: z.array(CriterionScoreSchema),
  overallComment: z.string().max(5000).optional(),
  confidentialComment: z.string().max(2000).optional(), // Only visible to editors
  recommendation: z.enum(['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT', 'ABSTAIN']).optional(),
  confidenceLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  submittedAt: z.string().datetime(),
  lastSavedAt: z.string().datetime(),
  isComplete: z.boolean().default(false),
});
export type ReviewScore = z.infer<typeof ReviewScoreSchema>;

// ---------------------------------------------------------------------------
// In-Memory Storage (would be database in production)
// ---------------------------------------------------------------------------

const rubrics = new Map<string, ReviewRubric>();
const assignments = new Map<string, ReviewAssignment>();
const scores = new Map<string, ReviewScore>();

// Mapping for anonymous IDs (in production, stored securely in DB)
const anonymousIdMapping = new Map<string, string>(); // anonymousId -> reviewerId

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function generateAnonymousId(): string {
  // Generate a readable anonymous ID like "Reviewer-A1B2"
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Reviewer-${id}`;
}

function calculateWeightedScore(
  criterion: RubricCriterion,
  score: CriterionScore
): number | null {
  let rawScore: number | null = null;

  switch (criterion.type) {
    case 'SCALE':
      if (score.scaleValue !== undefined && criterion.scaleMax) {
        // Normalize to 0-100
        rawScore = ((score.scaleValue - (criterion.scaleMin || 0)) /
          ((criterion.scaleMax || 10) - (criterion.scaleMin || 0))) * 100;
      }
      break;

    case 'BOOLEAN':
      if (score.booleanValue !== undefined) {
        rawScore = score.booleanValue ? 100 : 0;
      }
      break;

    case 'GRADE':
      if (score.gradeValue && criterion.gradeOptions) {
        const index = criterion.gradeOptions.indexOf(score.gradeValue);
        if (index >= 0) {
          // Higher grades = higher score
          rawScore = ((criterion.gradeOptions.length - 1 - index) /
            (criterion.gradeOptions.length - 1)) * 100;
        }
      }
      break;

    case 'CHECKLIST':
      if (score.checklistValues && criterion.checklistItems) {
        const checked = score.checklistValues.filter(v => v).length;
        rawScore = (checked / criterion.checklistItems.length) * 100;
      }
      break;

    case 'TEXT':
      // Text-only criteria don't contribute to numeric score
      return null;
  }

  if (rawScore === null) return null;
  return rawScore * (criterion.weight / 100);
}

// ---------------------------------------------------------------------------
// Rubric Operations
// ---------------------------------------------------------------------------

export function createRubric(
  input: {
    name: string;
    description?: string;
    researchId?: string;
    isTemplate?: boolean;
    criteria: Array<Omit<RubricCriterion, 'id' | 'rubricId'>>;
  },
  createdBy: string
): ReviewRubric {
  const rubricId = crypto.randomUUID();
  const now = new Date().toISOString();

  const criteria: RubricCriterion[] = input.criteria.map((c, index) => ({
    ...c,
    id: crypto.randomUUID(),
    rubricId,
    order: index,
  }));

  const rubric: ReviewRubric = {
    id: rubricId,
    researchId: input.researchId,
    name: input.name,
    description: input.description,
    criteria,
    isTemplate: input.isTemplate || false,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  rubrics.set(rubricId, rubric);
  return rubric;
}

export function getRubric(rubricId: string): ReviewRubric | undefined {
  return rubrics.get(rubricId);
}

export function getRubricTemplates(): ReviewRubric[] {
  return Array.from(rubrics.values()).filter(r => r.isTemplate);
}

export function getResearchRubrics(researchId: string): ReviewRubric[] {
  return Array.from(rubrics.values())
    .filter(r => r.researchId === researchId || r.isTemplate);
}

export function copyRubricFromTemplate(
  templateId: string,
  researchId: string,
  createdBy: string
): ReviewRubric | undefined {
  const template = rubrics.get(templateId);
  if (!template || !template.isTemplate) return undefined;

  return createRubric({
    name: `${template.name} (Copy)`,
    description: template.description,
    researchId,
    isTemplate: false,
    criteria: template.criteria.map(c => ({
      name: c.name,
      description: c.description,
      type: c.type,
      weight: c.weight,
      required: c.required,
      order: c.order,
      scaleMin: c.scaleMin,
      scaleMax: c.scaleMax,
      scaleLabels: c.scaleLabels,
      gradeOptions: c.gradeOptions,
      checklistItems: c.checklistItems,
    })),
  }, createdBy);
}

// ---------------------------------------------------------------------------
// Assignment Operations
// ---------------------------------------------------------------------------

export function createReviewAssignment(
  submissionId: string,
  reviewerId: string,
  rubricId: string,
  assignedBy: string,
  options?: {
    blindMode?: ReviewBlindMode;
    dueDate?: string;
  }
): ReviewAssignment {
  const anonymousId = generateAnonymousId();

  const assignment: ReviewAssignment = {
    id: crypto.randomUUID(),
    submissionId,
    reviewerId,
    anonymousId,
    rubricId,
    status: 'PENDING',
    blindMode: options?.blindMode || 'SINGLE_BLIND',
    dueDate: options?.dueDate,
    assignedBy,
    assignedAt: new Date().toISOString(),
  };

  assignments.set(assignment.id, assignment);
  anonymousIdMapping.set(anonymousId, reviewerId);

  return assignment;
}

export function getAssignment(assignmentId: string): ReviewAssignment | undefined {
  return assignments.get(assignmentId);
}

export function getAssignmentsBySubmission(submissionId: string): ReviewAssignment[] {
  return Array.from(assignments.values())
    .filter(a => a.submissionId === submissionId);
}

export function getAssignmentsByReviewer(reviewerId: string): ReviewAssignment[] {
  return Array.from(assignments.values())
    .filter(a => a.reviewerId === reviewerId);
}

export function startReview(assignmentId: string, reviewerId: string): ReviewAssignment | undefined {
  const assignment = assignments.get(assignmentId);
  if (!assignment || assignment.reviewerId !== reviewerId) return undefined;
  if (assignment.status !== 'PENDING') return undefined;

  assignment.status = 'IN_PROGRESS';
  assignment.startedAt = new Date().toISOString();
  assignments.set(assignmentId, assignment);

  return assignment;
}

export function declineReview(
  assignmentId: string,
  reviewerId: string,
  reason?: string
): ReviewAssignment | undefined {
  const assignment = assignments.get(assignmentId);
  if (!assignment || assignment.reviewerId !== reviewerId) return undefined;
  if (assignment.status !== 'PENDING') return undefined;

  assignment.status = 'DECLINED';
  assignment.declinedAt = new Date().toISOString();
  assignment.declineReason = reason;
  assignments.set(assignmentId, assignment);

  return assignment;
}

// ---------------------------------------------------------------------------
// Score Operations
// ---------------------------------------------------------------------------

export function saveReviewScore(
  assignmentId: string,
  reviewerId: string,
  input: {
    scores: CriterionScore[];
    overallComment?: string;
    confidentialComment?: string;
    recommendation?: ReviewScore['recommendation'];
    confidenceLevel?: ReviewScore['confidenceLevel'];
  }
): ReviewScore | undefined {
  const assignment = assignments.get(assignmentId);
  if (!assignment || assignment.reviewerId !== reviewerId) return undefined;

  const rubric = rubrics.get(assignment.rubricId);
  if (!rubric) return undefined;

  // Auto-start if pending
  if (assignment.status === 'PENDING') {
    startReview(assignmentId, reviewerId);
  }

  const now = new Date().toISOString();
  const existingScore = scores.get(assignmentId);

  // Check if complete (all required criteria scored)
  const requiredCriteriaIds = new Set(
    rubric.criteria.filter(c => c.required).map(c => c.id)
  );
  const scoredCriteriaIds = new Set(input.scores.map(s => s.criterionId));
  const isComplete = [...requiredCriteriaIds].every(id => scoredCriteriaIds.has(id));

  const score: ReviewScore = {
    id: existingScore?.id || crypto.randomUUID(),
    assignmentId,
    scores: input.scores,
    overallComment: input.overallComment,
    confidentialComment: input.confidentialComment,
    recommendation: input.recommendation,
    confidenceLevel: input.confidenceLevel,
    submittedAt: existingScore?.submittedAt || now,
    lastSavedAt: now,
    isComplete,
  };

  scores.set(assignmentId, score);
  return score;
}

export function submitReviewScore(
  assignmentId: string,
  reviewerId: string
): { score: ReviewScore; assignment: ReviewAssignment } | undefined {
  const assignment = assignments.get(assignmentId);
  if (!assignment || assignment.reviewerId !== reviewerId) return undefined;

  const score = scores.get(assignmentId);
  if (!score || !score.isComplete) return undefined;

  assignment.status = 'COMPLETED';
  assignment.completedAt = new Date().toISOString();
  assignments.set(assignmentId, assignment);

  return { score, assignment };
}

export function getReviewScore(assignmentId: string): ReviewScore | undefined {
  return scores.get(assignmentId);
}

// ---------------------------------------------------------------------------
// Aggregation & Analytics
// ---------------------------------------------------------------------------

export interface ReviewSummary {
  submissionId: string;
  totalReviewers: number;
  completedReviews: number;
  pendingReviews: number;
  aggregateScore: number | null;
  recommendations: Record<NonNullable<ReviewScore['recommendation']>, number>;
  criteriaScores: Array<{
    criterionId: string;
    criterionName: string;
    averageScore: number | null;
    scores: number[];
    weight: number;
  }>;
}

export function getReviewSummary(submissionId: string): ReviewSummary | undefined {
  const submissionAssignments = getAssignmentsBySubmission(submissionId);
  if (submissionAssignments.length === 0) return undefined;

  const recommendations: Record<string, number> = {
    ACCEPT: 0,
    MINOR_REVISION: 0,
    MAJOR_REVISION: 0,
    REJECT: 0,
    ABSTAIN: 0,
  };

  const rubricId = submissionAssignments[0].rubricId;
  const rubric = rubrics.get(rubricId);
  if (!rubric) return undefined;

  // Initialize criteria scores tracking
  const criteriaScoresMap = new Map<string, number[]>();
  for (const criterion of rubric.criteria) {
    criteriaScoresMap.set(criterion.id, []);
  }

  let completedCount = 0;
  let pendingCount = 0;
  const weightedScores: number[] = [];

  for (const assignment of submissionAssignments) {
    if (assignment.status === 'COMPLETED') {
      completedCount++;

      const score = scores.get(assignment.id);
      if (score) {
        // Track recommendations
        if (score.recommendation) {
          recommendations[score.recommendation]++;
        }

        // Calculate weighted scores
        let totalWeight = 0;
        let weightedSum = 0;

        for (const criterionScore of score.scores) {
          const criterion = rubric.criteria.find(c => c.id === criterionScore.criterionId);
          if (!criterion) continue;

          const calculatedScore = calculateWeightedScore(criterion, criterionScore);
          if (calculatedScore !== null) {
            weightedSum += calculatedScore;
            totalWeight += criterion.weight;

            // Track individual criterion scores (normalized to 0-100)
            const rawScore = (calculatedScore / criterion.weight) * 100;
            criteriaScoresMap.get(criterion.id)?.push(rawScore);
          }
        }

        if (totalWeight > 0) {
          weightedScores.push((weightedSum / totalWeight) * 100);
        }
      }
    } else if (assignment.status === 'PENDING' || assignment.status === 'IN_PROGRESS') {
      pendingCount++;
    }
  }

  // Calculate criteria summaries
  const criteriaScores = rubric.criteria.map(criterion => {
    const scoresForCriterion = criteriaScoresMap.get(criterion.id) || [];
    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      averageScore: scoresForCriterion.length > 0
        ? scoresForCriterion.reduce((a, b) => a + b, 0) / scoresForCriterion.length
        : null,
      scores: scoresForCriterion,
      weight: criterion.weight,
    };
  });

  return {
    submissionId,
    totalReviewers: submissionAssignments.length,
    completedReviews: completedCount,
    pendingReviews: pendingCount,
    aggregateScore: weightedScores.length > 0
      ? weightedScores.reduce((a, b) => a + b, 0) / weightedScores.length
      : null,
    recommendations: recommendations as Record<NonNullable<ReviewScore['recommendation']>, number>,
    criteriaScores,
  };
}

// ---------------------------------------------------------------------------
// Anonymization Helpers
// ---------------------------------------------------------------------------

export function getReviewerDisplayInfo(
  assignment: ReviewAssignment,
  requestingUserId: string,
  isEditor: boolean
): { displayName: string; isAnonymous: boolean } {
  // Editors can always see real identities
  if (isEditor) {
    return { displayName: assignment.reviewerId, isAnonymous: false };
  }

  // Open reviews show real identities
  if (assignment.blindMode === 'OPEN') {
    return { displayName: assignment.reviewerId, isAnonymous: false };
  }

  // Reviewer can see their own identity
  if (requestingUserId === assignment.reviewerId) {
    return { displayName: assignment.reviewerId, isAnonymous: false };
  }

  // Otherwise, show anonymous ID
  return { displayName: assignment.anonymousId, isAnonymous: true };
}

// ---------------------------------------------------------------------------
// Pre-built Rubric Templates
// ---------------------------------------------------------------------------

export function createDefaultRubricTemplates(systemUserId: string): void {
  // Academic Paper Review Template
  createRubric({
    name: 'Academic Paper Review',
    description: 'Standard rubric for academic paper peer review',
    isTemplate: true,
    criteria: [
      {
        name: 'Originality',
        description: 'Does the paper present novel ideas or findings?',
        type: 'SCALE',
        weight: 20,
        required: true,
        order: 0,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { 1: 'Not Original', 3: 'Somewhat Original', 5: 'Highly Original' },
      },
      {
        name: 'Methodology',
        description: 'Is the methodology sound and appropriate?',
        type: 'SCALE',
        weight: 25,
        required: true,
        order: 1,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { 1: 'Poor', 3: 'Adequate', 5: 'Excellent' },
      },
      {
        name: 'Results & Analysis',
        description: 'Are the results clearly presented and properly analyzed?',
        type: 'SCALE',
        weight: 25,
        required: true,
        order: 2,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { 1: 'Unclear/Flawed', 3: 'Adequate', 5: 'Clear & Rigorous' },
      },
      {
        name: 'Writing Quality',
        description: 'Is the paper well-written and organized?',
        type: 'SCALE',
        weight: 15,
        required: true,
        order: 3,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { 1: 'Poor', 3: 'Adequate', 5: 'Excellent' },
      },
      {
        name: 'Significance',
        description: 'What is the potential impact of this work?',
        type: 'SCALE',
        weight: 15,
        required: true,
        order: 4,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { 1: 'Limited', 3: 'Moderate', 5: 'High' },
      },
      {
        name: 'Detailed Feedback',
        description: 'Provide specific feedback for the authors',
        type: 'TEXT',
        weight: 0,
        required: true,
        order: 5,
      },
    ],
  }, systemUserId);

  // Quick Checklist Review Template
  createRubric({
    name: 'Quick Quality Checklist',
    description: 'Fast checklist-based review for initial screening',
    isTemplate: true,
    criteria: [
      {
        name: 'Basic Requirements',
        description: 'Does the submission meet basic requirements?',
        type: 'CHECKLIST',
        weight: 50,
        required: true,
        order: 0,
        checklistItems: [
          'Follows formatting guidelines',
          'Includes all required sections',
          'References properly formatted',
          'Tables and figures are clear',
          'No obvious plagiarism detected',
        ],
      },
      {
        name: 'Overall Assessment',
        description: 'Initial quality grade',
        type: 'GRADE',
        weight: 50,
        required: true,
        order: 1,
        gradeOptions: ['A', 'B', 'C', 'D', 'F'],
      },
    ],
  }, systemUserId);
}
