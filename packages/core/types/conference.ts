import { z } from 'zod';

export const PresentationTypeSchema = z.enum([
  'poster',
  'oral',
  'symposium',
  'workshop',
  'lightning',
  'panel'
]);
export type PresentationType = z.infer<typeof PresentationTypeSchema>;

export const DimensionUnitSchema = z.enum(['inches', 'cm']);
export type DimensionUnit = z.infer<typeof DimensionUnitSchema>;

export const FileFormatSchema = z.enum([
  'pdf',
  'pptx',
  'docx',
  'png',
  'jpg',
  'svg',
  'html'
]);
export type FileFormat = z.infer<typeof FileFormatSchema>;

export const PosterDimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  unit: DimensionUnitSchema
});
export type PosterDimensions = z.infer<typeof PosterDimensionsSchema>;

export const SlideCountSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().positive()
});
export type SlideCount = z.infer<typeof SlideCountSchema>;

export const ConferenceRequirementsSchema = z.object({
  id: z.string(),
  conferenceName: z.string().min(1),
  conferenceAcronym: z.string().optional(),
  abstractWordLimit: z.number().int().positive(),
  posterDimensions: PosterDimensionsSchema.optional(),
  slideCount: SlideCountSchema.optional(),
  submissionDeadline: z.string(),
  presentationType: PresentationTypeSchema,
  requiredSections: z.array(z.string()),
  fileFormats: z.array(FileFormatSchema),
  disclosureRequired: z.boolean().default(true),
  fundingStatementRequired: z.boolean().default(true),
  authorLimitPerPresentation: z.number().int().positive().optional(),
  speakingTimeMinutes: z.number().positive().optional(),
  qaSeparateMinutes: z.number().nonnegative().optional(),
  additionalRequirements: z.array(z.string()).optional(),
  websiteUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
});
export type ConferenceRequirements = z.infer<typeof ConferenceRequirementsSchema>;

export const CreateConferenceRequirementsSchema = ConferenceRequirementsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type CreateConferenceRequirements = z.infer<typeof CreateConferenceRequirementsSchema>;

export const ChecklistItemStatusSchema = z.enum([
  'complete',
  'incomplete',
  'not_applicable'
]);
export type ChecklistItemStatus = z.infer<typeof ChecklistItemStatusSchema>;

export const ChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(['content', 'format', 'submission', 'logistics']),
  required: z.boolean(),
  status: ChecklistItemStatusSchema,
  description: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  completedBy: z.string().optional()
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ComplianceChecklistSchema = z.object({
  id: z.string(),
  conferenceId: z.string(),
  researchId: z.string(),
  stageId: z.number().int().min(17).max(20),
  items: z.array(ChecklistItemSchema),
  overallStatus: z.enum(['complete', 'incomplete', 'blocked']),
  completedItems: z.number().int().nonnegative(),
  totalItems: z.number().int().positive(),
  requiredItems: z.number().int().nonnegative(),
  requiredCompleted: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
});
export type ComplianceChecklist = z.infer<typeof ComplianceChecklistSchema>;

export const AbstractSubmissionSchema = z.object({
  id: z.string(),
  conferenceId: z.string(),
  researchId: z.string(),
  title: z.string().min(1),
  abstract: z.string().min(1),
  wordCount: z.number().int().positive(),
  authors: z.array(z.object({
    name: z.string(),
    affiliation: z.string(),
    email: z.string().email().optional(),
    isPresenter: z.boolean().default(false),
    order: z.number().int().positive()
  })),
  keywords: z.array(z.string()),
  disclosures: z.string().optional(),
  fundingStatement: z.string().optional(),
  presentationType: PresentationTypeSchema,
  status: z.enum(['draft', 'submitted', 'accepted', 'rejected', 'withdrawn']),
  submittedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
});
export type AbstractSubmission = z.infer<typeof AbstractSubmissionSchema>;

export const ConferenceMaterialSchema = z.object({
  id: z.string(),
  conferenceId: z.string(),
  researchId: z.string(),
  stageId: z.number().int().min(17).max(20),
  materialType: z.enum(['poster', 'slides', 'handout', 'speaker_notes', 'qr_codes']),
  title: z.string(),
  content: z.string().optional(),
  fileUrl: z.string().optional(),
  fileFormat: FileFormatSchema.optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  dimensions: PosterDimensionsSchema.optional(),
  slideCount: z.number().int().positive().optional(),
  generatedFromManuscript: z.boolean().default(true),
  manuscriptVersion: z.string().optional(),
  phiStatus: z.enum(['PASS', 'FAIL', 'UNCHECKED', 'OVERRIDDEN']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
});
export type ConferenceMaterial = z.infer<typeof ConferenceMaterialSchema>;

export interface ConferenceExportRequest {
  stageId: 17 | 18 | 19 | 20;
  conferenceId: string;
  researchId: string;
  title: string;
  presentationDuration?: number;
  includeHandouts?: boolean;
  qrLinks?: string[];
  posterDimensions?: PosterDimensions;
}

export interface ConferenceExportResult {
  success: boolean;
  materials: ConferenceMaterial[];
  checklistComplete: boolean;
  warnings: string[];
  downloadUrls: Record<string, string>;
}

// =============================================================================
// STAGE 20: CONFERENCE DISCOVERY SCHEMAS
// =============================================================================

export const ConferenceDiscoveryRequestSchema = z.object({
  researchId: z.string(),
  manuscriptId: z.string().optional(),
  keywords: z.array(z.string()).min(1),
  researchDomain: z.string().optional(),
  preferredPresentationType: PresentationTypeSchema.optional(),
  deadlineAfter: z.string().datetime().optional(),
  deadlineBefore: z.string().datetime().optional(),
  maxResults: z.number().int().positive().default(10)
});
export type ConferenceDiscoveryRequest = z.infer<typeof ConferenceDiscoveryRequestSchema>;

export const DiscoveredConferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  acronym: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  submissionDeadline: z.string().datetime().optional(),
  conferenceDate: z.string().datetime().optional(),
  location: z.string().optional(),
  presentationTypes: z.array(PresentationTypeSchema),
  abstractWordLimit: z.number().int().positive().optional(),
  relevanceScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  estimatedAcceptanceRate: z.number().min(0).max(1).optional(),
  impactFactor: z.number().positive().optional(),
  guidelinesExtracted: z.boolean().default(false)
});
export type DiscoveredConference = z.infer<typeof DiscoveredConferenceSchema>;

export const ConferenceDiscoveryResultSchema = z.object({
  requestId: z.string(),
  researchId: z.string(),
  discoveredAt: z.string().datetime(),
  conferences: z.array(DiscoveredConferenceSchema),
  totalFound: z.number().int().nonnegative(),
  searchCriteria: ConferenceDiscoveryRequestSchema.omit({ researchId: true }),
  shortlisted: z.array(z.string()).default([]),
  bundleGenerated: z.boolean().default(false),
  bundleUrl: z.string().url().optional()
});
export type ConferenceDiscoveryResult = z.infer<typeof ConferenceDiscoveryResultSchema>;

export const PREDEFINED_CONFERENCES: Omit<ConferenceRequirements, 'id' | 'createdAt'>[] = [
  {
    conferenceName: 'American Thyroid Association Annual Meeting',
    conferenceAcronym: 'ATA',
    abstractWordLimit: 250,
    posterDimensions: { width: 48, height: 36, unit: 'inches' },
    slideCount: { min: 10, max: 20 },
    submissionDeadline: '2025-06-01',
    presentationType: 'poster',
    requiredSections: ['Background', 'Methods', 'Results', 'Conclusions'],
    fileFormats: ['pdf', 'pptx'],
    disclosureRequired: true,
    fundingStatementRequired: true,
    speakingTimeMinutes: 12,
    qaSeparateMinutes: 3
  },
  {
    conferenceName: 'Endocrine Society Annual Meeting',
    conferenceAcronym: 'ENDO',
    abstractWordLimit: 300,
    posterDimensions: { width: 44, height: 36, unit: 'inches' },
    slideCount: { min: 8, max: 15 },
    submissionDeadline: '2025-05-15',
    presentationType: 'oral',
    requiredSections: ['Introduction', 'Methods', 'Results', 'Discussion', 'Conclusions'],
    fileFormats: ['pdf', 'pptx'],
    disclosureRequired: true,
    fundingStatementRequired: true,
    speakingTimeMinutes: 15,
    qaSeparateMinutes: 5
  },
  {
    conferenceName: 'American Diabetes Association Scientific Sessions',
    conferenceAcronym: 'ADA',
    abstractWordLimit: 250,
    posterDimensions: { width: 36, height: 48, unit: 'inches' },
    slideCount: { min: 10, max: 25 },
    submissionDeadline: '2025-04-01',
    presentationType: 'poster',
    requiredSections: ['Objective', 'Research Design and Methods', 'Results', 'Conclusions'],
    fileFormats: ['pdf'],
    disclosureRequired: true,
    fundingStatementRequired: true,
    speakingTimeMinutes: 10,
    qaSeparateMinutes: 2
  }
];
