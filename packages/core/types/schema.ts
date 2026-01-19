import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Import users table from auth models for foreign key references
import { users, sessions } from "./auth";
import type { User as AuthUser } from "./auth";
export { users, sessions };
export type { UpsertUser } from "./auth";
// Note: We export AuthUser renamed to avoid conflicts with User from roles.ts
export type { AuthUser };

// =====================
// ROLE TYPES
// =====================
export const USER_ROLES = ["VIEWER", "RESEARCHER", "STEWARD", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "ESCALATED"] as const;
export type ApprovalStatusType = (typeof APPROVAL_STATUSES)[number];

export const OPERATION_TYPES = [
  "AI_GENERATION",
  "DATA_EXPORT", 
  "PHI_ACCESS",
  "MANUSCRIPT_PUBLISH",
  "DATASET_MODIFICATION",
  "IRB_SUBMISSION",
  "EXTERNAL_SHARE",
  "BULK_OPERATION"
] as const;
export type OperationTypeEnum = (typeof OPERATION_TYPES)[number];

export const DATA_CLASSIFICATIONS = ["SYNTHETIC", "DEIDENTIFIED", "IDENTIFIED", "UNKNOWN"] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Artifact Type Enum
export const ARTIFACT_TYPES = [
  "manuscript",
  "irb_document",
  "analysis_output",
  "dataset",
  "config_snapshot",
  "execution_log",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

// Artifacts Table (Database)
export const artifacts = pgTable("artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id").notNull(),
  stageId: varchar("stage_id").notNull(),
  artifactType: text("artifact_type").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  content: text("content").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256Hash: varchar("sha256_hash").notNull(),
  createdBy: varchar("created_by").notNull(),
  currentVersionId: varchar("current_version_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertArtifactSchema = createInsertSchema(artifacts).omit({
  id: true,
  createdAt: true,
});

export const artifactSchema = z.object({
  id: z.string(),
  researchId: z.string(),
  stageId: z.string(),
  artifactType: z.enum(ARTIFACT_TYPES),
  filename: z.string(),
  mimeType: z.string(),
  content: z.string(),
  sizeBytes: z.number().int(),
  sha256Hash: z.string(),
  createdBy: z.string(),
  currentVersionId: z.string().nullable(),
  createdAt: z.date(),
});

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;

// Artifact Versions Table (Database)
export const artifactVersions = pgTable("artifact_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256Hash: varchar("sha256_hash").notNull(),
  createdBy: varchar("created_by").notNull(),
  changeDescription: text("change_description").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertArtifactVersionSchema = createInsertSchema(artifactVersions).omit({
  id: true,
  createdAt: true,
});

export const artifactVersionSchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  versionNumber: z.number().int().positive(),
  content: z.string(),
  sizeBytes: z.number().int(),
  sha256Hash: z.string(),
  createdBy: z.string(),
  changeDescription: z.string(),
  createdAt: z.date(),
});

export type ArtifactVersion = typeof artifactVersions.$inferSelect;
export type InsertArtifactVersion = z.infer<typeof insertArtifactVersionSchema>;

// Artifact Comparisons Table (Database)
export const artifactComparisons = pgTable("artifact_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  fromVersionId: varchar("from_version_id").notNull().references(() => artifactVersions.id),
  toVersionId: varchar("to_version_id").notNull().references(() => artifactVersions.id),
  diffSummary: text("diff_summary").notNull(),
  addedLines: integer("added_lines").notNull(),
  removedLines: integer("removed_lines").notNull(),
  comparedBy: varchar("compared_by").notNull(),
  comparedAt: timestamp("compared_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertArtifactComparisonSchema = createInsertSchema(artifactComparisons).omit({
  id: true,
  comparedAt: true,
});

export type ArtifactComparison = typeof artifactComparisons.$inferSelect;
export type InsertArtifactComparison = z.infer<typeof insertArtifactComparisonSchema>;

// File Uploads Table (for real file upload functionality)
export const fileUploads = pgTable("file_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id"),
  originalFilename: text("original_filename").notNull(),
  storedFilename: text("stored_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256Hash: varchar("sha256_hash").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  status: text("status").notNull().default("pending"),
  phiScanStatus: text("phi_scan_status").default("pending"),
  phiScanResult: jsonb("phi_scan_result"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({
  id: true,
  createdAt: true,
});

export type FileUpload = typeof fileUploads.$inferSelect;
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;

// Research Sessions Table (for workflow state persistence)
export const researchSessions = pgTable("research_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id").notNull(),
  userId: varchar("user_id").notNull(),
  currentStageId: integer("current_stage_id").notNull().default(1),
  stageProgress: jsonb("stage_progress"),
  workflowState: jsonb("workflow_state"),
  lastActiveAt: timestamp("last_active_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertResearchSessionSchema = createInsertSchema(researchSessions).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true,
});

export type ResearchSession = typeof researchSessions.$inferSelect;
export type InsertResearchSession = z.infer<typeof insertResearchSessionSchema>;

// =====================
// GOVERNANCE TABLES
// =====================

// Research Projects Table
export const researchProjects = pgTable("research_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id").notNull().unique(),
  sessionId: varchar("session_id"),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  dataClassification: text("data_classification").notNull().default("UNKNOWN"),
  status: text("status").notNull().default("ACTIVE"),
  irbApprovalNumber: varchar("irb_approval_number"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertResearchProjectSchema = createInsertSchema(researchProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ResearchProject = typeof researchProjects.$inferSelect;
export type InsertResearchProject = z.infer<typeof insertResearchProjectSchema>;

// User Roles Table (for RBAC)
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("VIEWER"),
  grantedBy: varchar("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  grantedAt: true,
});

export type UserRoleRecord = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

// Approval Mode Types
export const APPROVAL_MODES = ["AUTO_APPROVE", "REQUIRE_EACH", "BATCH_REVIEW"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

// Approval Gates Table
export const approvalGates = pgTable("approval_gates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operationType: text("operation_type").notNull(),
  resourceId: varchar("resource_id").notNull(),
  resourceType: text("resource_type").notNull(),
  approvalMode: text("approval_mode").notNull().default("REQUIRE_EACH"),
  requestedById: varchar("requested_by_id").notNull().references(() => users.id),
  requestedByRole: text("requested_by_role").notNull(),
  requestedByEmail: varchar("requested_by_email"),
  requestedByName: varchar("requested_by_name"),
  approvedById: varchar("approved_by_id").references(() => users.id),
  approvedByRole: text("approved_by_role"),
  approvedByEmail: varchar("approved_by_email"),
  approvedByName: varchar("approved_by_name"),
  status: text("status").notNull().default("PENDING"),
  reason: text("reason"),
  rejectionReason: text("rejection_reason"),
  conditions: jsonb("conditions"),
  metadata: jsonb("metadata"),
  sessionId: varchar("session_id"),
  ipAddress: varchar("ip_address"),
  escalatedAt: timestamp("escalated_at"),
  escalatedTo: varchar("escalated_to").references(() => users.id),
  isOverride: boolean("is_override").default(false),
  overrideJustification: text("override_justification"),
  overrideConfirmedBy: varchar("override_confirmed_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  requestedAt: timestamp("requested_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  reviewedAt: timestamp("reviewed_at"),
  completedAt: timestamp("completed_at"),
});

export const insertApprovalGateSchema = createInsertSchema(approvalGates).omit({
  id: true,
  requestedAt: true,
});

export const updateApprovalGateSchema = createInsertSchema(approvalGates).omit({
  id: true,
}).partial();

export type ApprovalGateRecord = typeof approvalGates.$inferSelect;
export type InsertApprovalGate = z.infer<typeof insertApprovalGateSchema>;
export type UpdateApprovalGate = z.infer<typeof updateApprovalGateSchema>;

// Approval Audit Entries Table (linked to approval gates)
export const APPROVAL_ACTIONS = ["CREATED", "APPROVED", "REJECTED", "ESCALATED", "EXPIRED", "VIEWED"] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const approvalAuditEntries = pgTable("approval_audit_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gateId: varchar("gate_id").notNull().references(() => approvalGates.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  performedById: varchar("performed_by_id").references(() => users.id),
  performedByRole: text("performed_by_role"),
  performedByEmail: varchar("performed_by_email"),
  performedByName: varchar("performed_by_name"),
  reason: text("reason"),
  details: jsonb("details"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  performedAt: timestamp("performed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertApprovalAuditEntrySchema = createInsertSchema(approvalAuditEntries).omit({
  id: true,
  performedAt: true,
});

export type ApprovalAuditEntryRecord = typeof approvalAuditEntries.$inferSelect;
export type InsertApprovalAuditEntry = z.infer<typeof insertApprovalAuditEntrySchema>;

// Audit Logs Table (with hash chain for immutable audit trail)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  userId: varchar("user_id").references(() => users.id),
  resourceType: text("resource_type"),
  resourceId: varchar("resource_id"),
  action: text("action").notNull(),
  details: jsonb("details"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  researchId: varchar("research_id"),
  previousHash: varchar("previous_hash"),
  entryHash: varchar("entry_hash"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// PHI Incidents Table
export const phiIncidents = pgTable("phi_incidents", {
  id: serial("id").primaryKey(),
  incidentId: varchar("incident_id").notNull().unique(),
  severity: text("severity").notNull().default("LOW"),
  description: text("description").notNull(),
  detectedBy: varchar("detected_by").references(() => users.id),
  affectedResearchId: varchar("affected_research_id"),
  affectedDatasetId: varchar("affected_dataset_id"),
  phiType: text("phi_type"),
  status: text("status").notNull().default("OPEN"),
  remediationSteps: jsonb("remediation_steps"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPhiIncidentSchema = createInsertSchema(phiIncidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PhiIncident = typeof phiIncidents.$inferSelect;
export type InsertPhiIncident = z.infer<typeof insertPhiIncidentSchema>;

// Handoff Packs Table (for structured AI outputs)
export const handoffPacks = pgTable("handoff_packs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packId: varchar("pack_id").notNull().unique(),
  packType: text("pack_type").notNull(),
  version: varchar("version").notNull().default("1.0.0"),
  researchId: varchar("research_id").notNull(),
  stageId: varchar("stage_id").notNull(),
  stageName: text("stage_name").notNull(),
  sessionId: varchar("session_id"),
  modelId: varchar("model_id"),
  modelVersion: varchar("model_version"),
  promptHash: varchar("prompt_hash").notNull(),
  responseHash: varchar("response_hash").notNull(),
  content: jsonb("content"),
  contentSchema: text("content_schema"),
  tokenUsageInput: integer("token_usage_input").notNull().default(0),
  tokenUsageOutput: integer("token_usage_output").notNull().default(0),
  tokenUsageTotal: integer("token_usage_total").notNull().default(0),
  latencyMs: integer("latency_ms"),
  costCents: integer("cost_cents").default(0),
  approvalGateId: varchar("approval_gate_id").references(() => approvalGates.id),
  parentPackId: varchar("parent_pack_id"),
  tags: jsonb("tags"),
  isValid: boolean("is_valid").default(true),
  validationErrors: jsonb("validation_errors"),
  validationWarnings: jsonb("validation_warnings"),
  signature: varchar("signature"),
  generatedAt: timestamp("generated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at"),
});

export const insertHandoffPackSchema = createInsertSchema(handoffPacks).omit({
  id: true,
  createdAt: true,
  generatedAt: true,
});

export type HandoffPackRecord = typeof handoffPacks.$inferSelect;
export type InsertHandoffPack = z.infer<typeof insertHandoffPackSchema>;

// =====================
// TOPIC VERSIONING TABLES
// =====================

export const TOPIC_STATUSES = ["DRAFT", "LOCKED", "SUPERSEDED"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

// Note: TOPIC_ENTRY_MODES and TopicEntryMode are exported from ./topic-declaration.ts
// to avoid duplicate exports

export const topics = pgTable("topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id").notNull(),
  version: integer("version").notNull().default(1),
  title: text("title").notNull(),
  description: text("description"),

  // Entry mode: 'quick' for rapid topic definition, 'pico' for structured protocols
  entryMode: text("entry_mode").notNull().default("pico"),

  // Quick Entry fields (always stored, may be empty for PICO mode)
  generalTopic: text("general_topic"),
  scope: text("scope"),
  datasetSource: text("dataset_source"),
  cohortInclusion: text("cohort_inclusion"),
  cohortExclusion: text("cohort_exclusion"),
  exposures: jsonb("exposures"),
  covariates: jsonb("covariates"),
  constraints: text("constraints"),

  // PICO elements (structured format for protocols)
  picoElements: jsonb("pico_elements"),

  // Shared fields
  keywords: jsonb("keywords"),
  outcomes: jsonb("outcomes"),

  // Version tracking
  versionHash: varchar("version_hash").notNull(),
  contentHash: varchar("content_hash"),
  versionHistory: jsonb("version_history"),
  previousVersionId: varchar("previous_version_id"),
  createdBy: varchar("created_by").notNull(),
  status: text("status").notNull().default("DRAFT"),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTopicSchema = createInsertSchema(topics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTopicSchema = createInsertSchema(topics).omit({
  id: true,
  createdAt: true,
}).partial();

export type Topic = typeof topics.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type UpdateTopic = z.infer<typeof updateTopicSchema>;

// =====================
// STATISTICAL ANALYSIS PLAN TABLES
// =====================

export const SAP_STATUSES = ["draft", "approved", "executed"] as const;
export type SAPStatus = (typeof SAP_STATUSES)[number];

export const MODEL_TYPES = ["linear", "logistic", "cox", "poisson", "mixed", "ordinal", "negative_binomial"] as const;
export type ModelType = (typeof MODEL_TYPES)[number];

export const MULTIPLICITY_CORRECTIONS = ["none", "bonferroni", "fdr", "hierarchical", "holm"] as const;
export type MultiplicityCorrection = (typeof MULTIPLICITY_CORRECTIONS)[number];

export const statisticalPlans = pgTable("statistical_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  topicVersion: integer("topic_version").notNull(),
  researchId: varchar("research_id").notNull(),
  primaryAnalyses: jsonb("primary_analyses").notNull(),
  secondaryAnalyses: jsonb("secondary_analyses"),
  covariateStrategy: jsonb("covariate_strategy").notNull(),
  sensitivityAnalyses: jsonb("sensitivity_analyses"),
  missingDataPlan: jsonb("missing_data_plan").notNull(),
  multiplicityCorrection: text("multiplicity_correction").notNull().default("none"),
  assumptionChecks: jsonb("assumption_checks"),
  subgroupAnalyses: jsonb("subgroup_analyses"),
  alphaLevel: text("alpha_level").notNull().default("0.05"),
  randomSeed: integer("random_seed").notNull(),
  status: text("status").notNull().default("draft"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  executionResult: jsonb("execution_result"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertStatisticalPlanSchema = createInsertSchema(statisticalPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStatisticalPlanSchema = createInsertSchema(statisticalPlans).omit({
  id: true,
  createdAt: true,
}).partial();

export type StatisticalPlanRecord = typeof statisticalPlans.$inferSelect;
export type InsertStatisticalPlan = z.infer<typeof insertStatisticalPlanSchema>;
export type UpdateStatisticalPlan = z.infer<typeof updateStatisticalPlanSchema>;

// =====================
// RESEARCH BRIEFS TABLE
// =====================

// Note: RESEARCH_BRIEF_STATUSES and ResearchBriefStatus are exported from ./research-brief.ts
// to avoid duplicate exports

export const researchBriefs = pgTable("research_briefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  topicVersion: integer("topic_version").notNull(),
  researchId: varchar("research_id").notNull(),

  // Entry mode info (preserved from topic)
  entryMode: text("entry_mode"),
  convertedPico: jsonb("converted_pico"),

  // Core brief content
  summary: text("summary"),
  studyObjectives: jsonb("study_objectives").notNull(),
  population: text("population").notNull(),
  exposure: text("exposure").notNull(),
  comparator: text("comparator"),
  outcomes: jsonb("outcomes").notNull(),
  timeframe: text("timeframe"),
  candidateEndpoints: jsonb("candidate_endpoints").notNull(),
  keyConfounders: jsonb("key_confounders").notNull(),
  minimumDatasetFields: jsonb("minimum_dataset_fields").notNull(),
  clarifyingPrompts: jsonb("clarifying_prompts").notNull(),

  // AI-generated refinement suggestions
  refinementSuggestions: jsonb("refinement_suggestions"),

  // AI generation metadata
  modelUsed: varchar("model_used").notNull(),
  promptVersion: varchar("prompt_version").notNull(),
  artifactHash: varchar("artifact_hash").notNull(),
  tokenUsageInput: integer("token_usage_input"),
  tokenUsageOutput: integer("token_usage_output"),
  generationLatencyMs: integer("generation_latency_ms"),

  // Status tracking
  status: text("status").notNull().default("draft"),
  createdBy: varchar("created_by").notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertResearchBriefSchema = createInsertSchema(researchBriefs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateResearchBriefSchema = createInsertSchema(researchBriefs).omit({
  id: true,
  createdAt: true,
}).partial();

export type ResearchBriefRecord = typeof researchBriefs.$inferSelect;
export type InsertResearchBrief = z.infer<typeof insertResearchBriefSchema>;
export type UpdateResearchBrief = z.infer<typeof updateResearchBriefSchema>;

// =====================
// CONFERENCE MATERIALS TABLES
// =====================

export const PRESENTATION_TYPES = ["poster", "oral", "symposium", "workshop", "lightning", "panel"] as const;
export type PresentationType = (typeof PRESENTATION_TYPES)[number];

export const MATERIAL_TYPES = ["poster", "slides", "handout", "speaker_notes", "qr_codes"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const conferenceRequirements = pgTable("conference_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conferenceName: text("conference_name").notNull(),
  conferenceAcronym: varchar("conference_acronym"),
  abstractWordLimit: integer("abstract_word_limit").notNull(),
  posterDimensions: jsonb("poster_dimensions"),
  slideCount: jsonb("slide_count"),
  submissionDeadline: text("submission_deadline").notNull(),
  presentationType: text("presentation_type").notNull(),
  requiredSections: jsonb("required_sections").notNull(),
  fileFormats: jsonb("file_formats").notNull(),
  disclosureRequired: boolean("disclosure_required").notNull().default(true),
  fundingStatementRequired: boolean("funding_statement_required").notNull().default(true),
  authorLimitPerPresentation: integer("author_limit_per_presentation"),
  speakingTimeMinutes: integer("speaking_time_minutes"),
  qaSeparateMinutes: integer("qa_separate_minutes"),
  additionalRequirements: jsonb("additional_requirements"),
  websiteUrl: text("website_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConferenceRequirementsSchema = createInsertSchema(conferenceRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ConferenceRequirementsRecord = typeof conferenceRequirements.$inferSelect;
export type InsertConferenceRequirements = z.infer<typeof insertConferenceRequirementsSchema>;

export const conferenceMaterials = pgTable("conference_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conferenceId: varchar("conference_id").references(() => conferenceRequirements.id),
  researchId: varchar("research_id").notNull(),
  stageId: integer("stage_id").notNull(),
  materialType: text("material_type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  fileUrl: text("file_url"),
  fileFormat: text("file_format"),
  fileSizeBytes: integer("file_size_bytes"),
  dimensions: jsonb("dimensions"),
  slideCount: integer("slide_count"),
  generatedFromManuscript: boolean("generated_from_manuscript").notNull().default(true),
  manuscriptVersion: varchar("manuscript_version"),
  phiStatus: text("phi_status").notNull().default("UNCHECKED"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConferenceMaterialSchema = createInsertSchema(conferenceMaterials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ConferenceMaterialRecord = typeof conferenceMaterials.$inferSelect;
export type InsertConferenceMaterial = z.infer<typeof insertConferenceMaterialSchema>;

export const complianceChecklists = pgTable("compliance_checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conferenceId: varchar("conference_id").references(() => conferenceRequirements.id),
  researchId: varchar("research_id").notNull(),
  stageId: integer("stage_id").notNull(),
  items: jsonb("items").notNull(),
  overallStatus: text("overall_status").notNull().default("incomplete"),
  completedItems: integer("completed_items").notNull().default(0),
  totalItems: integer("total_items").notNull(),
  requiredItems: integer("required_items").notNull().default(0),
  requiredCompleted: integer("required_completed").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertComplianceChecklistSchema = createInsertSchema(complianceChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComplianceChecklistRecord = typeof complianceChecklists.$inferSelect;
export type InsertComplianceChecklist = z.infer<typeof insertComplianceChecklistSchema>;

// =====================
// PHI SCAN RESULTS TABLE
// =====================

export const phiScanResults = pgTable("phi_scan_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scanId: varchar("scan_id").notNull().unique(),
  researchId: varchar("research_id"),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  context: text("context").notNull(),
  riskLevel: text("risk_level").notNull(),
  detected: jsonb("detected").notNull(),
  summary: jsonb("summary").notNull(),
  contentLength: integer("content_length").notNull(),
  requiresOverride: boolean("requires_override").notNull().default(false),
  overrideApproved: boolean("override_approved"),
  overrideApprovedBy: varchar("override_approved_by").references(() => users.id),
  overrideApprovedAt: timestamp("override_approved_at"),
  overrideJustification: text("override_justification"),
  overrideConditions: jsonb("override_conditions"),
  overrideExpiresAt: timestamp("override_expires_at"),
  scannedBy: varchar("scanned_by").references(() => users.id),
  scannedAt: timestamp("scanned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPhiScanResultSchema = createInsertSchema(phiScanResults).omit({
  id: true,
  scannedAt: true,
});

export type PhiScanResultRecord = typeof phiScanResults.$inferSelect;
export type InsertPhiScanResult = z.infer<typeof insertPhiScanResultSchema>;

// =====================
// DATASETS TABLE - Core data storage with PHI protection
// =====================

export const datasets = pgTable("datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: varchar("filename", { length: 255 }).notNull(),
  classification: varchar("classification", { length: 50 }).notNull().default("UNKNOWN"),
  riskScore: integer("risk_score").default(0),
  format: varchar("format", { length: 50 }),
  sizeBytes: integer("size_bytes"),
  rowCount: integer("row_count"),
  columnCount: integer("column_count"),
  encryptedAtRest: boolean("encrypted_at_rest").default(false),
  encryptionKeyId: varchar("encryption_key_id", { length: 100 }),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  metadata: jsonb("metadata"),
  phiFlags: jsonb("phi_flags"),
});

export const insertDatasetSchema = createInsertSchema(datasets).omit({
  id: true,
  uploadedAt: true,
});

export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = z.infer<typeof insertDatasetSchema>;

// =====================
// STORAGE FILES TABLE - File tracking with encryption metadata
// =====================

export const storageFiles = pgTable("storage_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 500 }).notNull().unique(),
  backend: varchar("backend", { length: 20 }).default("local"),
  bucketName: varchar("bucket_name", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  contentType: varchar("content_type", { length: 100 }),
  encrypted: boolean("encrypted").default(false),
  encryptionKeyId: varchar("encryption_key_id", { length: 100 }),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
});

export const insertStorageFileSchema = createInsertSchema(storageFiles).omit({
  id: true,
  uploadedAt: true,
});

export type StorageFile = typeof storageFiles.$inferSelect;
export type InsertStorageFile = z.infer<typeof insertStorageFileSchema>;

// =====================
// APPROVALS TABLE - For governance gates
// =====================

export const approvals = pgTable("approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id").notNull(),
  requestedBy: varchar("requested_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  status: varchar("status", { length: 20 }).default("pending"),
  reason: text("reason"),
  approvalType: varchar("approval_type", { length: 50 }),
  requestedAt: timestamp("requested_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  resolvedAt: timestamp("resolved_at"),
  metadata: jsonb("metadata"),
});

export const insertApprovalSchema = createInsertSchema(approvals).omit({
  id: true,
  requestedAt: true,
});

export type Approval = typeof approvals.$inferSelect;
export type InsertApproval = z.infer<typeof insertApprovalSchema>;