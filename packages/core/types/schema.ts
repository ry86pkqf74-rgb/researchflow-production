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
  branch: varchar("branch", { length: 100 }).notNull().default("main"),
  parentVersionId: varchar("parent_version_id"),
  metadata: jsonb("metadata").notNull().default({}),
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
  orgId: varchar("org_id"), // Phase E: Multi-tenancy FK to organizations
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

export type ApprovalGateRecord = typeof approvalGates.$inferSelect;
export type InsertApprovalGate = z.infer<typeof insertApprovalGateSchema>;

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

export type Topic = typeof topics.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;

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

export type StatisticalPlanRecord = typeof statisticalPlans.$inferSelect;
export type InsertStatisticalPlan = z.infer<typeof insertStatisticalPlanSchema>;

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

export type ResearchBriefRecord = typeof researchBriefs.$inferSelect;
export type InsertResearchBrief = z.infer<typeof insertResearchBriefSchema>;

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

// =====================
// PHASE D: AI ETHICS & SECURITY TABLES
// =====================

// Ethics Approvals Table (Task 62)
export const ETHICS_CATEGORIES = ["bias_review", "data_usage", "patient_impact", "model_safety", "consent_verification"] as const;
export type EthicsCategory = (typeof ETHICS_CATEGORIES)[number];

export const ETHICS_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type EthicsRiskLevel = (typeof ETHICS_RISK_LEVELS)[number];

export const ethicsApprovals = pgTable("ethics_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskType: text("task_type").notNull(),
  ethicsCategory: text("ethics_category").notNull(),
  riskLevel: text("risk_level").notNull().default("LOW"),
  requestedById: varchar("requested_by_id").notNull().references(() => users.id),
  requestedByRole: text("requested_by_role").notNull(),
  approvedById: varchar("approved_by_id").references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  riskAssessment: jsonb("risk_assessment"),
  conditions: jsonb("conditions"),
  justification: text("justification"),
  governanceMode: text("governance_mode").notNull(),
  phiRiskLevel: text("phi_risk_level"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertEthicsApprovalSchema = createInsertSchema(ethicsApprovals).omit({
  id: true,
  createdAt: true,
});

export type EthicsApprovalRecord = typeof ethicsApprovals.$inferSelect;
export type InsertEthicsApproval = z.infer<typeof insertEthicsApprovalSchema>;

// AI Invocations Table (Task 64 - Explainability)
export const AI_INVOCATION_STATUSES = ["SUCCESS", "FAILED", "BLOCKED", "TIMEOUT"] as const;
export type AIInvocationStatus = (typeof AI_INVOCATION_STATUSES)[number];

export const aiInvocations = pgTable("ai_invocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  auditEventId: integer("audit_event_id").references(() => auditLogs.id),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  taskType: text("task_type").notNull(),
  workflowStage: integer("workflow_stage"),
  promptTemplateId: varchar("prompt_template_id"),
  promptTemplateVersion: integer("prompt_template_version"),
  promptHash: varchar("prompt_hash").notNull(),
  promptTokenCount: integer("prompt_token_count").notNull(),
  responseHash: varchar("response_hash").notNull(),
  responseTokenCount: integer("response_token_count").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  phiScanPassed: boolean("phi_scan_passed").notNull(),
  phiRiskLevel: text("phi_risk_level"),
  initialTier: text("initial_tier").notNull(),
  finalTier: text("final_tier").notNull(),
  escalated: boolean("escalated").notNull().default(false),
  escalationCount: integer("escalation_count").default(0),
  escalationReason: text("escalation_reason"),
  qualityGatePassed: boolean("quality_gate_passed").notNull(),
  qualityChecks: jsonb("quality_checks"),
  estimatedCostUsd: text("estimated_cost_usd"),
  reasoningTrace: jsonb("reasoning_trace"),
  ethicsApprovalId: varchar("ethics_approval_id").references(() => ethicsApprovals.id),
  status: text("status").notNull().default("SUCCESS"),
  errorMessage: text("error_message"),
  researchId: varchar("research_id"),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAiInvocationSchema = createInsertSchema(aiInvocations).omit({
  id: true,
  createdAt: true,
});

export type AiInvocationRecord = typeof aiInvocations.$inferSelect;
export type InsertAiInvocation = z.infer<typeof insertAiInvocationSchema>;

// AI Output Feedback Table (Task 65)
export const FEEDBACK_TYPES = ["accuracy", "relevance", "safety", "quality", "bias", "completeness"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const aiOutputFeedback = pgTable("ai_output_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invocationId: varchar("invocation_id").notNull().references(() => aiInvocations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  feedbackType: text("feedback_type").notNull(),
  tags: jsonb("tags"),
  comment: text("comment"),
  isUsefulForTraining: boolean("is_useful_for_training").default(false),
  reviewedByAdmin: boolean("reviewed_by_admin").default(false),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAiOutputFeedbackSchema = createInsertSchema(aiOutputFeedback).omit({
  id: true,
  createdAt: true,
});

export type AiOutputFeedbackRecord = typeof aiOutputFeedback.$inferSelect;
export type InsertAiOutputFeedback = z.infer<typeof insertAiOutputFeedbackSchema>;

// User Consents Table (Task 73 - GDPR)
export const CONSENT_TYPES = ["data_processing", "ai_usage", "phi_access", "marketing", "research_participation", "data_sharing"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const LEGAL_BASES = ["consent", "legitimate_interest", "contract", "legal_obligation", "vital_interest", "public_task"] as const;
export type LegalBasis = (typeof LEGAL_BASES)[number];

export const userConsents = pgTable("user_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  consentType: text("consent_type").notNull(),
  consentVersion: varchar("consent_version").notNull(),
  granted: boolean("granted").notNull(),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  legalBasis: text("legal_basis"),
  purpose: text("purpose"),
  dataCategories: jsonb("data_categories"),
  retentionPeriodDays: integer("retention_period_days"),
  expiresAt: timestamp("expires_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserConsentSchema = createInsertSchema(userConsents).omit({
  id: true,
  createdAt: true,
});

export type UserConsentRecord = typeof userConsents.$inferSelect;
export type InsertUserConsent = z.infer<typeof insertUserConsentSchema>;

// User Quotas Table (Task 75)
export const QUOTA_TYPES = ["ai_calls_per_minute", "ai_calls_per_day", "tokens_per_day", "storage_mb", "exports_per_day", "concurrent_jobs"] as const;
export type QuotaType = (typeof QUOTA_TYPES)[number];

export const RESET_PERIODS = ["minute", "hour", "day", "week", "month"] as const;
export type ResetPeriod = (typeof RESET_PERIODS)[number];

export const userQuotas = pgTable("user_quotas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  quotaType: text("quota_type").notNull(),
  maxValue: integer("max_value").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  resetPeriod: text("reset_period").notNull(),
  lastResetAt: timestamp("last_reset_at").default(sql`CURRENT_TIMESTAMP`),
  customLimit: integer("custom_limit"),
  customLimitSetBy: varchar("custom_limit_set_by").references(() => users.id),
  customLimitReason: text("custom_limit_reason"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserQuotaSchema = createInsertSchema(userQuotas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserQuotaRecord = typeof userQuotas.$inferSelect;
export type InsertUserQuota = z.infer<typeof insertUserQuotaSchema>;

// MFA Enrollments Table (Task 79)
export const MFA_TYPES = ["totp", "webauthn", "sms", "email"] as const;
export type MfaType = (typeof MFA_TYPES)[number];

export const mfaEnrollments = pgTable("mfa_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  mfaType: text("mfa_type").notNull().default("totp"),
  secretEncrypted: varchar("secret_encrypted").notNull(),
  backupCodesEncrypted: text("backup_codes_encrypted"),
  backupCodesUsed: jsonb("backup_codes_used"),
  isActive: boolean("is_active").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  lastUsedAt: timestamp("last_used_at"),
  failedAttempts: integer("failed_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  enrolledAt: timestamp("enrolled_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  verifiedAt: timestamp("verified_at"),
});

export const insertMfaEnrollmentSchema = createInsertSchema(mfaEnrollments).omit({
  id: true,
  enrolledAt: true,
});

export type MfaEnrollmentRecord = typeof mfaEnrollments.$inferSelect;
export type InsertMfaEnrollment = z.infer<typeof insertMfaEnrollmentSchema>;

// Security Anomalies Table (Task 67)
export const ANOMALY_TYPES = ["brute_force", "unusual_access", "phi_spike", "privilege_escalation", "geographic_anomaly", "rate_limit_abuse"] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export const ANOMALY_SEVERITIES = ["INFO", "WARNING", "ALERT", "CRITICAL"] as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

export const securityAnomalies = pgTable("security_anomalies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  anomalyType: text("anomaly_type").notNull(),
  severity: text("severity").notNull().default("WARNING"),
  userId: varchar("user_id").references(() => users.id),
  ipAddress: varchar("ip_address"),
  description: text("description").notNull(),
  detectionScore: text("detection_score"),
  evidence: jsonb("evidence"),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  falsePositive: boolean("false_positive").default(false),
  detectedAt: timestamp("detected_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSecurityAnomalySchema = createInsertSchema(securityAnomalies).omit({
  id: true,
  detectedAt: true,
});

export type SecurityAnomalyRecord = typeof securityAnomalies.$inferSelect;
export type InsertSecurityAnomaly = z.infer<typeof insertSecurityAnomalySchema>;

// =====================
// PHASE E: MULTI-TENANCY TABLES (Tasks 81-100)
// =====================

// Note: ORG_ROLES and SUBSCRIPTION_TIERS are defined in organization.ts
// Types re-declared here for schema use only (not exported to avoid conflicts)
const ORG_ROLES_INTERNAL = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
const SUBSCRIPTION_TIERS_INTERNAL = ["FREE", "PRO", "TEAM", "ENTERPRISE"] as const;

// Invite Statuses
export const INVITE_STATUSES = ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

// Integration Types
export const INTEGRATION_TYPES = ["slack", "notion", "github", "salesforce", "zoom"] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

// Organizations Table (Task 81)
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  settings: jsonb("settings").default({}),
  billingEmail: varchar("billing_email", { length: 255 }),
  subscriptionTier: varchar("subscription_tier", { length: 50 }).notNull().default("FREE"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrganizationRecord = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// Org Memberships Table (Task 81)
export const orgMemberships = pgTable("org_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgRole: varchar("org_role", { length: 50 }).notNull().default("MEMBER"),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  invitedBy: varchar("invited_by").references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertOrgMembershipSchema = createInsertSchema(orgMemberships).omit({
  id: true,
  joinedAt: true,
});

export type OrgMembershipRecord = typeof orgMemberships.$inferSelect;
export type InsertOrgMembership = z.infer<typeof insertOrgMembershipSchema>;

// Org Invites Table (Task 83)
export const orgInvites = pgTable("org_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  orgRole: varchar("org_role", { length: 50 }).notNull().default("MEMBER"),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOrgInviteSchema = createInsertSchema(orgInvites).omit({
  id: true,
  createdAt: true,
});

export type OrgInviteRecord = typeof orgInvites.$inferSelect;
export type InsertOrgInvite = z.infer<typeof insertOrgInviteSchema>;

// Org Subscriptions Table (Task 84)
export const orgSubscriptions = pgTable("org_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  tier: varchar("tier", { length: 50 }).notNull().default("FREE"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOrgSubscriptionSchema = createInsertSchema(orgSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrgSubscriptionRecord = typeof orgSubscriptions.$inferSelect;
export type InsertOrgSubscription = z.infer<typeof insertOrgSubscriptionSchema>;

// Org Integrations Table (Task 85-86, 99)
export const orgIntegrations = pgTable("org_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  integrationType: varchar("integration_type", { length: 50 }).notNull(),
  config: jsonb("config").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  syncStatus: varchar("sync_status", { length: 50 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOrgIntegrationSchema = createInsertSchema(orgIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrgIntegrationRecord = typeof orgIntegrations.$inferSelect;
export type InsertOrgIntegration = z.infer<typeof insertOrgIntegrationSchema>;

// Review Sessions Table (Task 87 - Zoom)
export const REVIEW_SESSION_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;
export type ReviewSessionStatus = (typeof REVIEW_SESSION_STATUSES)[number];

export const reviewSessions = pgTable("review_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  researchId: varchar("research_id"),
  zoomMeetingId: varchar("zoom_meeting_id", { length: 100 }),
  topic: varchar("topic", { length: 500 }),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  participants: jsonb("participants"),
  recordingUrl: text("recording_url"),
  transcriptUrl: text("transcript_url"),
  status: varchar("status", { length: 50 }).notNull().default("scheduled"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertReviewSessionSchema = createInsertSchema(reviewSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ReviewSessionRecord = typeof reviewSessions.$inferSelect;
export type InsertReviewSession = z.infer<typeof insertReviewSessionSchema>;

// Badges Table (Task 92 - Gamification)
export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  category: varchar("category", { length: 50 }),
  criteria: jsonb("criteria"),
  points: integer("points").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});

export type BadgeRecord = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;

// User Badges Table (Task 92)
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: varchar("badge_id").notNull().references(() => badges.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: "set null" }),
  awardedAt: timestamp("awarded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  awardedBy: varchar("awarded_by").references(() => users.id),
  metadata: jsonb("metadata"),
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  awardedAt: true,
});

export type UserBadgeRecord = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

// User Onboarding Table (Task 97)
export const userOnboarding = pgTable("user_onboarding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: "set null" }),
  stepsCompleted: jsonb("steps_completed").default([]),
  currentStep: integer("current_step").default(0),
  completedAt: timestamp("completed_at"),
  skipped: boolean("skipped").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserOnboardingSchema = createInsertSchema(userOnboarding).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserOnboardingRecord = typeof userOnboarding.$inferSelect;
export type InsertUserOnboarding = z.infer<typeof insertUserOnboardingSchema>;

// Notion Mappings Table (Task 86)
export const notionMappings = pgTable("notion_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  artifactId: varchar("artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  notionPageId: varchar("notion_page_id", { length: 100 }),
  notionDatabaseId: varchar("notion_database_id", { length: 100 }),
  syncDirection: varchar("sync_direction", { length: 20 }).default("push"),
  lastSyncedAt: timestamp("last_synced_at"),
  syncStatus: varchar("sync_status", { length: 50 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertNotionMappingSchema = createInsertSchema(notionMappings).omit({
  id: true,
  createdAt: true,
});

export type NotionMappingRecord = typeof notionMappings.$inferSelect;
export type InsertNotionMapping = z.infer<typeof insertNotionMappingSchema>;

// ============================================================
// DOCS-FIRST PHASE 1 TABLES (Migration 010)
// ============================================================

// Ideas Table - Research idea backlog
export const ideas = pgTable("ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("BACKLOG").notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  orgId: varchar("org_id", { length: 255 }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;

// Idea Scorecards Table - Scoring criteria for evaluating ideas
export const ideaScorecards = pgTable("idea_scorecards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  noveltyScore: integer("novelty_score"),
  feasibilityScore: integer("feasibility_score"),
  impactScore: integer("impact_score"),
  alignmentScore: integer("alignment_score"),
  totalScore: integer("total_score"),  // Computed by database trigger
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertIdeaScorecardSchema = createInsertSchema(ideaScorecards).omit({
  id: true,
  totalScore: true,  // Computed field
  createdAt: true,
  updatedAt: true,
});

export type IdeaScorecard = typeof ideaScorecards.$inferSelect;
export type InsertIdeaScorecard = z.infer<typeof insertIdeaScorecardSchema>;

// Topic Briefs Table - Structured research planning documents with PICO framework
export const topicBriefs = pgTable("topic_briefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id", { length: 255 }).notNull(),
  ideaId: varchar("idea_id").references(() => ideas.id, { onDelete: "set null" }),
  title: varchar("title", { length: 500 }).notNull(),
  versionNumber: integer("version_number").default(1).notNull(),

  // PICO Framework
  population: text("population"),
  intervention: text("intervention"),
  comparison: text("comparison"),
  outcomes: text("outcomes").array(),

  // Research structure
  researchQuestion: text("research_question").notNull(),
  hypothesis: text("hypothesis"),
  background: text("background"),
  methodsOverview: text("methods_overview"),
  expectedFindings: text("expected_findings"),

  status: varchar("status", { length: 20 }).default("DRAFT").notNull(),
  frozenAt: timestamp("frozen_at"),
  frozenBy: varchar("frozen_by", { length: 255 }),

  createdBy: varchar("created_by", { length: 255 }).notNull(),
  orgId: varchar("org_id", { length: 255 }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertTopicBriefSchema = createInsertSchema(topicBriefs).omit({
  id: true,
  versionNumber: true,  // Auto-managed
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type TopicBrief = typeof topicBriefs.$inferSelect;
export type InsertTopicBrief = z.infer<typeof insertTopicBriefSchema>;

// Venues Table - Target publication/presentation venues
export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 500 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  impactFactor: text("impact_factor"),  // Using text for DECIMAL compatibility
  acceptanceRate: text("acceptance_rate"),

  // Requirements
  wordLimit: integer("word_limit"),
  abstractLimit: integer("abstract_limit"),
  guidelinesUrl: text("guidelines_url"),
  submissionDeadline: timestamp("submission_deadline"),

  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertVenueSchema = createInsertSchema(venues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type Venue = typeof venues.$inferSelect;
export type InsertVenue = z.infer<typeof insertVenueSchema>;

// Doc Kits Table - Document preparation kits per venue
export const docKits = pgTable("doc_kits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicBriefId: varchar("topic_brief_id").notNull().references(() => topicBriefs.id, { onDelete: "cascade" }),
  venueId: varchar("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).default("IN_PROGRESS").notNull(),

  createdBy: varchar("created_by", { length: 255 }).notNull(),
  orgId: varchar("org_id", { length: 255 }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertDocKitSchema = createInsertSchema(docKits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type DocKit = typeof docKits.$inferSelect;
export type InsertDocKit = z.infer<typeof insertDocKitSchema>;

// Doc Kit Items Table - Individual documents in a kit
export const docKitItems = pgTable("doc_kit_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  docKitId: varchar("doc_kit_id").notNull().references(() => docKits.id, { onDelete: "cascade" }),
  itemType: varchar("item_type", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  content: text("content"),
  artifactId: varchar("artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).default("NOT_STARTED").notNull(),
  required: boolean("required").default(true).notNull(),
  displayOrder: integer("display_order").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertDocKitItemSchema = createInsertSchema(docKitItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type DocKitItem = typeof docKitItems.$inferSelect;
export type InsertDocKitItem = z.infer<typeof insertDocKitItemSchema>;

// Doc Anchors Table - Hash chain for immutable scope freeze snapshots
export const docAnchors = pgTable("doc_anchors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicBriefId: varchar("topic_brief_id").notNull().references(() => topicBriefs.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  snapshotData: jsonb("snapshot_data").notNull(),
  previousHash: varchar("previous_hash", { length: 64 }),
  currentHash: varchar("current_hash", { length: 64 }).notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDocAnchorSchema = createInsertSchema(docAnchors).omit({
  id: true,
  createdAt: true,
});

export type DocAnchor = typeof docAnchors.$inferSelect;
export type InsertDocAnchor = z.infer<typeof insertDocAnchorSchema>;

// ============================================================
// PHASE F: UI/UX ENHANCEMENTS TABLES (Migration 011, Tasks 101-110)
// ============================================================

// =====================
// FEATURE FLAGS & EXPERIMENTS (Task 110)
// =====================

// Feature Flags Table
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flagKey: varchar("flag_key", { length: 100 }).unique().notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  description: text("description"),
  tierRequired: varchar("tier_required", { length: 20 }), // 'FREE', 'TEAM', 'ENTERPRISE'
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// Experiments Table (A/B Testing)
export const EXPERIMENT_STATUSES = ["DRAFT", "RUNNING", "PAUSED", "COMPLETE"] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export const experiments = pgTable("experiments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  experimentKey: varchar("experiment_key", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  variants: jsonb("variants").notNull(), // [{"key": "control", "weight": 50}, {"key": "variant_a", "weight": 50}]
  status: varchar("status", { length: 20 }).default("DRAFT").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertExperimentSchema = createInsertSchema(experiments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;

// Experiment Assignments Table
export const experimentAssignments = pgTable("experiment_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  experimentId: varchar("experiment_id").notNull().references(() => experiments.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  variantKey: varchar("variant_key", { length: 100 }).notNull(),
  assignedAt: timestamp("assigned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertExperimentAssignmentSchema = createInsertSchema(experimentAssignments).omit({
  id: true,
  assignedAt: true,
});

export type ExperimentAssignment = typeof experimentAssignments.$inferSelect;
export type InsertExperimentAssignment = z.infer<typeof insertExperimentAssignmentSchema>;

// =====================
// CUSTOM FIELDS (Task 101)
// =====================

// Org Custom Fields Schema Table
export const orgCustomFields = pgTable("org_custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id", { length: 255 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // 'project', 'dataset', 'artifact'
  schemaJson: jsonb("schema_json").notNull(), // Array of field definitions
  version: integer("version").default(1).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOrgCustomFieldSchema = createInsertSchema(orgCustomFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrgCustomField = typeof orgCustomFields.$inferSelect;
export type InsertOrgCustomField = z.infer<typeof insertOrgCustomFieldSchema>;

// Entity Custom Field Values Table
export const entityCustomFieldValues = pgTable("entity_custom_field_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  orgId: varchar("org_id", { length: 255 }).notNull(),
  valuesJson: jsonb("values_json").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertEntityCustomFieldValueSchema = createInsertSchema(entityCustomFieldValues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EntityCustomFieldValue = typeof entityCustomFieldValues.$inferSelect;
export type InsertEntityCustomFieldValue = z.infer<typeof insertEntityCustomFieldValueSchema>;

// =====================
// SEMANTIC SEARCH (Task 107)
// =====================

// Artifact Embeddings Table (PHI-safe metadata embeddings)
export const artifactEmbeddings = pgTable("artifact_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  orgId: varchar("org_id", { length: 255 }).notNull(),
  embeddingVector: jsonb("embedding_vector").notNull(), // Store as JSON array (or use pgvector if available)
  modelName: varchar("model_name", { length: 100 }).default("text-embedding-3-small").notNull(),
  metadataHash: varchar("metadata_hash", { length: 64 }).notNull(), // SHA-256 of metadata
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertArtifactEmbeddingSchema = createInsertSchema(artifactEmbeddings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ArtifactEmbedding = typeof artifactEmbeddings.$inferSelect;
export type InsertArtifactEmbedding = z.infer<typeof insertArtifactEmbeddingSchema>;

// =====================
// TUTORIALS (Task 108)
// =====================

// Tutorial Assets Table
export const tutorialAssets = pgTable("tutorial_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorialKey: varchar("tutorial_key", { length: 100 }).unique().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: text("video_url"), // YouTube/Vimeo/self-hosted
  steps: jsonb("steps").notNull(), // [{"title": "Step 1", "content": "...", "targetSelector": ".upload-button"}]
  enabled: boolean("enabled").default(true),
  orgId: varchar("org_id", { length: 255 }), // Null = global; set = org-specific override
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTutorialAssetSchema = createInsertSchema(tutorialAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TutorialAsset = typeof tutorialAssets.$inferSelect;
export type InsertTutorialAsset = z.infer<typeof insertTutorialAssetSchema>;
// ============================================================
// PHASE G: CUSTOM WORKFLOW BUILDER TABLES (Migration 0007)
// ============================================================

// =====================
// WORKFLOW STATUSES
// =====================
export const WORKFLOW_STATUSES_G = ["draft", "published", "archived"] as const;
export type WorkflowStatusG = (typeof WORKFLOW_STATUSES_G)[number];

export const RUN_STATUSES = ["running", "paused", "completed", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// =====================
// WORKFLOWS TABLE
// =====================
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id", { length: 255 }).references(() => organizations.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WorkflowRecord = typeof workflows.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;

// =====================
// WORKFLOW VERSIONS TABLE
// =====================
export const workflowVersions = pgTable("workflow_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id", { length: 255 }).notNull().references(() => workflows.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  definition: jsonb("definition").notNull(),
  changelog: text("changelog"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWorkflowVersionSchema = createInsertSchema(workflowVersions).omit({
  id: true,
  createdAt: true,
});

export type WorkflowVersionRecord = typeof workflowVersions.$inferSelect;
export type InsertWorkflowVersion = z.infer<typeof insertWorkflowVersionSchema>;

// =====================
// WORKFLOW TEMPLATES TABLE
// =====================
export const workflowTemplates = pgTable("workflow_templates", {
  key: varchar("key", { length: 100 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  definition: jsonb("definition").notNull(),
  category: varchar("category", { length: 100 }).default("general"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates).omit({
  createdAt: true,
});

export type WorkflowTemplateRecord = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;

// =====================
// WORKFLOW POLICIES TABLE
// =====================
export const workflowPolicies = pgTable("workflow_policies", {
  workflowId: varchar("workflow_id", { length: 255 }).primaryKey().references(() => workflows.id, { onDelete: "cascade" }),
  policy: jsonb("policy").notNull().default({}),
  updatedBy: varchar("updated_by", { length: 255 }).references(() => users.id),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWorkflowPolicySchema = createInsertSchema(workflowPolicies).omit({
  updatedAt: true,
});

export type WorkflowPolicyRecord = typeof workflowPolicies.$inferSelect;
export type InsertWorkflowPolicy = z.infer<typeof insertWorkflowPolicySchema>;

// =====================
// WORKFLOW RUN CHECKPOINTS TABLE
// =====================
export const workflowRunCheckpoints = pgTable("workflow_run_checkpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id", { length: 255 }).notNull(),
  workflowId: varchar("workflow_id", { length: 255 }).notNull().references(() => workflows.id, { onDelete: "cascade" }),
  workflowVersion: integer("workflow_version").notNull(),
  currentNodeId: varchar("current_node_id", { length: 255 }).notNull(),
  completedNodes: jsonb("completed_nodes").notNull().default([]),
  nodeOutputs: jsonb("node_outputs").notNull().default({}),
  status: varchar("status", { length: 50 }).notNull().default("running"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWorkflowRunCheckpointSchema = createInsertSchema(workflowRunCheckpoints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WorkflowRunCheckpointRecord = typeof workflowRunCheckpoints.$inferSelect;
export type InsertWorkflowRunCheckpoint = z.infer<typeof insertWorkflowRunCheckpointSchema>;

// =====================
// DOCUMENT LIFECYCLE TABLES (Phase H)
// =====================

// Artifact Edge Relation Types
export const ARTIFACT_EDGE_RELATIONS = [
  'derived_from',
  'references', 
  'supersedes',
  'uses',
  'generated_from',
  'exported_to',
  'annotates'
] as const;
export type ArtifactEdgeRelation = (typeof ARTIFACT_EDGE_RELATIONS)[number];

// Artifact Edges (Provenance Graph)
export const artifactEdges = pgTable("artifact_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id").notNull(),
  sourceArtifactId: varchar("source_artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  targetArtifactId: varchar("target_artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  relationType: varchar("relation_type", { length: 50 }).notNull(),
  transformationType: varchar("transformation_type", { length: 100 }),
  transformationConfig: jsonb("transformation_config").notNull().default({}),
  sourceVersionId: varchar("source_version_id").references(() => artifactVersions.id, { onDelete: "set null" }),
  targetVersionId: varchar("target_version_id").references(() => artifactVersions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
  metadata: jsonb("metadata").notNull().default({}),
});

export const insertArtifactEdgeSchema = createInsertSchema(artifactEdges).omit({
  id: true,
  createdAt: true,
});

export type ArtifactEdge = typeof artifactEdges.$inferSelect;
export type InsertArtifactEdge = z.infer<typeof insertArtifactEdgeSchema>;

// Comment Anchor Types
export const COMMENT_ANCHOR_TYPES = [
  'text_selection',
  'entire_section',
  'table_cell',
  'figure_region',
  'slide_region'
] as const;
export type CommentAnchorType = (typeof COMMENT_ANCHOR_TYPES)[number];

// PHI Scan Statuses
export const PHI_SCAN_STATUSES = ['PASS', 'FAIL', 'PENDING', 'OVERRIDE'] as const;
export type PhiScanStatus = (typeof PHI_SCAN_STATUSES)[number];

// Comments Table
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id").notNull(),
  artifactId: varchar("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  versionId: varchar("version_id").references(() => artifactVersions.id, { onDelete: "set null" }),
  parentCommentId: varchar("parent_comment_id"),
  threadId: varchar("thread_id").notNull(),
  anchorType: varchar("anchor_type", { length: 50 }).notNull(),
  anchorData: jsonb("anchor_data").notNull(),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
  phiScanStatus: varchar("phi_scan_status", { length: 20 }).default('PENDING'),
  phiFindings: jsonb("phi_findings").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

// Claim Status Types
export const CLAIM_STATUSES = ['draft', 'verified', 'disputed', 'retracted'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// Claims Table
export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id").notNull(),
  manuscriptArtifactId: varchar("manuscript_artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  versionId: varchar("version_id").references(() => artifactVersions.id, { onDelete: "set null" }),
  section: varchar("section", { length: 50 }),
  claimText: text("claim_text").notNull(),
  claimTextHash: varchar("claim_text_hash", { length: 64 }),
  anchor: jsonb("anchor").notNull().default({}),
  status: varchar("status", { length: 20 }).default('draft'),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  phiScanStatus: varchar("phi_scan_status", { length: 20 }).default('PENDING'),
  phiFindings: jsonb("phi_findings").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  deletedAt: timestamp("deleted_at"),
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  createdAt: true,
});

export type Claim = typeof claims.$inferSelect;
export type InsertClaim = z.infer<typeof insertClaimSchema>;

// Evidence Types
export const EVIDENCE_TYPES = ['citation', 'artifact', 'pdf_highlight', 'url'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// Claim Evidence Links Table
// Evidence Types for Claims
export const CLAIM_EVIDENCE_TYPES = ['citation', 'data_artifact', 'figure', 'table', 'external_url'] as const;
export type ClaimEvidenceType = (typeof CLAIM_EVIDENCE_TYPES)[number];

export const claimEvidenceLinks = pgTable("claim_evidence_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  evidenceType: varchar("evidence_type", { length: 30 }).notNull(),
  evidenceArtifactId: varchar("evidence_artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  citationId: varchar("citation_id"),
  externalUrl: text("external_url"),
  locator: jsonb("locator").notNull().default({}),
  linkedBy: varchar("linked_by").notNull(),
  linkedAt: timestamp("linked_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  notes: text("notes"),
  metadata: jsonb("metadata").notNull().default({}),
  deletedAt: timestamp("deleted_at"),
});

export const insertClaimEvidenceLinkSchema = createInsertSchema(claimEvidenceLinks).omit({
  id: true,
  linkedAt: true,
});

export type ClaimEvidenceLink = typeof claimEvidenceLinks.$inferSelect;
export type InsertClaimEvidenceLink = z.infer<typeof insertClaimEvidenceLinkSchema>;

// Share Permissions
export const SHARE_PERMISSIONS = ['read', 'comment'] as const;
export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

// Artifact Shares Table
export const artifactShares = pgTable("artifact_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  permission: varchar("permission", { length: 20 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  revokedAt: timestamp("revoked_at"),
  metadata: jsonb("metadata").notNull().default({}),
});

export const insertArtifactShareSchema = createInsertSchema(artifactShares).omit({
  id: true,
  createdAt: true,
});

export type ArtifactShare = typeof artifactShares.$inferSelect;
export type InsertArtifactShare = z.infer<typeof insertArtifactShareSchema>;

// Submission Target Kinds
export const SUBMISSION_TARGET_KINDS = ['journal', 'conference'] as const;
export type SubmissionTargetKind = (typeof SUBMISSION_TARGET_KINDS)[number];

// Submission Targets Table
export const submissionTargets = pgTable("submission_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: text("name").notNull(),
  kind: varchar("kind", { length: 20 }).notNull(),
  websiteUrl: text("website_url"),
  requirementsArtifactId: varchar("requirements_artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").notNull().default({}),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSubmissionTargetSchema = createInsertSchema(submissionTargets).omit({
  id: true,
  createdAt: true,
});

export type SubmissionTarget = typeof submissionTargets.$inferSelect;
export type InsertSubmissionTarget = z.infer<typeof insertSubmissionTargetSchema>;

// Submission Statuses
export const SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'revise',
  'accepted',
  'rejected',
  'withdrawn',
  'camera_ready'
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// Submissions Table
export const submissions = pgTable("submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchId: varchar("research_id").notNull(),
  targetId: varchar("target_id").notNull().references(() => submissionTargets.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 30 }).notNull().default('draft'),
  currentManuscriptArtifactId: varchar("current_manuscript_artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  currentManuscriptVersionId: varchar("current_manuscript_version_id").references(() => artifactVersions.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at"),
  decisionAt: timestamp("decision_at"),
  externalTrackingId: varchar("external_tracking_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSubmissionSchema = createInsertSchema(submissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

// Reviewer Point Statuses
export const REVIEWER_POINT_STATUSES = ['open', 'resolved'] as const;
export type ReviewerPointStatus = (typeof REVIEWER_POINT_STATUSES)[number];

// Reviewer Points Table
export const reviewerPoints = pgTable("reviewer_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  reviewerLabel: varchar("reviewer_label", { length: 50 }).default('reviewer_1'),
  body: text("body").notNull(),
  anchorData: jsonb("anchor_data").notNull().default({}),
  status: varchar("status", { length: 20 }).notNull().default('open'),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  phiScanStatus: varchar("phi_scan_status", { length: 20 }).default('PENDING'),
  phiFindings: jsonb("phi_findings").notNull().default([]),
});

export const insertReviewerPointSchema = createInsertSchema(reviewerPoints).omit({
  id: true,
  createdAt: true,
});

export type ReviewerPoint = typeof reviewerPoints.$inferSelect;
export type InsertReviewerPoint = z.infer<typeof insertReviewerPointSchema>;

// Rebuttal Responses Table
export const rebuttalResponses = pgTable("rebuttal_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewerPointId: varchar("reviewer_point_id").notNull().references(() => reviewerPoints.id, { onDelete: "cascade" }),
  responseBody: text("response_body").notNull(),
  linkedVersionId: varchar("linked_version_id").references(() => artifactVersions.id, { onDelete: "set null" }),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  phiScanStatus: varchar("phi_scan_status", { length: 20 }).default('PENDING'),
  phiFindings: jsonb("phi_findings").notNull().default([]),
});

export const insertRebuttalResponseSchema = createInsertSchema(rebuttalResponses).omit({
  id: true,
  createdAt: true,
});

export type RebuttalResponse = typeof rebuttalResponses.$inferSelect;
export type InsertRebuttalResponse = z.infer<typeof insertRebuttalResponseSchema>;

// Submission Package Types
export const SUBMISSION_PACKAGE_TYPES = ['initial', 'rebuttal', 'camera_ready', 'conference_bundle'] as const;
export type SubmissionPackageType = (typeof SUBMISSION_PACKAGE_TYPES)[number];

// Submission Packages Table
export const submissionPackages = pgTable("submission_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  packageType: varchar("package_type", { length: 30 }).notNull(),
  artifactIds: jsonb("artifact_ids").notNull(),
  manifest: jsonb("manifest").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSubmissionPackageSchema = createInsertSchema(submissionPackages).omit({
  id: true,
  createdAt: true,
});

export type SubmissionPackage = typeof submissionPackages.$inferSelect;
export type InsertSubmissionPackage = z.infer<typeof insertSubmissionPackageSchema>;

// Manuscript Yjs Snapshots Table
export const manuscriptYjsSnapshots = pgTable("manuscript_yjs_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  manuscriptArtifactId: varchar("manuscript_artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  snapshotClock: integer("snapshot_clock").notNull(),
  snapshot: text("snapshot").notNull(), // Base64 encoded for BYTEA
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertManuscriptYjsSnapshotSchema = createInsertSchema(manuscriptYjsSnapshots).omit({
  id: true,
  createdAt: true,
});

export type ManuscriptYjsSnapshot = typeof manuscriptYjsSnapshots.$inferSelect;
export type InsertManuscriptYjsSnapshot = z.infer<typeof insertManuscriptYjsSnapshotSchema>;

// Manuscript Yjs Updates Table
export const manuscriptYjsUpdates = pgTable("manuscript_yjs_updates", {
  id: serial("id").primaryKey(),
  manuscriptArtifactId: varchar("manuscript_artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  clock: integer("clock").notNull(),
  updateData: text("update_data").notNull(), // Base64 encoded for BYTEA
  userId: varchar("user_id").references(() => users.id),
  appliedAt: timestamp("applied_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertManuscriptYjsUpdateSchema = createInsertSchema(manuscriptYjsUpdates).omit({
  id: true,
  appliedAt: true,
});

export type ManuscriptYjsUpdate = typeof manuscriptYjsUpdates.$inferSelect;
export type InsertManuscriptYjsUpdate = z.infer<typeof insertManuscriptYjsUpdateSchema>;

// =====================
// PHASE F: OBSERVABILITY + FEATURE FLAGS
// =====================

// Governance Mode Types
export const GOVERNANCE_MODES = ['STANDBY', 'DEMO', 'LIVE'] as const;
export type GovernanceMode = (typeof GOVERNANCE_MODES)[number];

// Feature Flag Scope Types
export const FEATURE_FLAG_SCOPES = ['product', 'governance'] as const;
export type FeatureFlagScope = (typeof FEATURE_FLAG_SCOPES)[number];

// Governance Config Table (DB-backed mode configuration)
export const governanceConfig = pgTable("governance_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertGovernanceConfigSchema = createInsertSchema(governanceConfig).omit({
  createdAt: true,
  updatedAt: true,
});

export type GovernanceConfig = typeof governanceConfig.$inferSelect;
export type InsertGovernanceConfig = z.infer<typeof insertGovernanceConfigSchema>;

// Feature Flags Table
export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 100 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  scope: varchar("scope", { length: 50 }).notNull().default('product'),
  requiredModes: jsonb("required_modes").default([]),
  rolloutPercent: integer("rollout_percent").notNull().default(100),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  createdAt: true,
  updatedAt: true,
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// Experiments Table (A/B Testing)
export const experiments = pgTable("experiments", {
  key: varchar("key", { length: 100 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  variants: jsonb("variants").notNull().default({}),
  allocation: jsonb("allocation").notNull().default({}),
  requiredModes: jsonb("required_modes").default([]),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertExperimentSchema = createInsertSchema(experiments).omit({
  createdAt: true,
  updatedAt: true,
});

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;

// Experiment Assignments Table (Deterministic assignment tracking)
export const experimentAssignments = pgTable("experiment_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  experimentKey: varchar("experiment_key", { length: 100 }).notNull().references(() => experiments.key, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id"),
  variant: varchar("variant", { length: 50 }).notNull(),
  assignedAt: timestamp("assigned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertExperimentAssignmentSchema = createInsertSchema(experimentAssignments).omit({
  id: true,
  assignedAt: true,
});

export type ExperimentAssignment = typeof experimentAssignments.$inferSelect;
export type InsertExperimentAssignment = z.infer<typeof insertExperimentAssignmentSchema>;

// Analytics Events Table (PHI-safe, opt-in only)
// PHI-safe by design: only stores IDs, counts, booleans, timings, feature identifiers
// No raw dataset values, no manuscript content, no user-entered free text
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventName: varchar("event_name", { length: 120 }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id"),
  researchId: varchar("research_id"),
  mode: varchar("mode", { length: 20 }).notNull(),
  properties: jsonb("properties").default({}),
  ipHash: varchar("ip_hash", { length: 64 }), // SHA256(ip + salt), never raw IP
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

// Allowed analytics event names (PHI-safe allowlist)
export const ANALYTICS_EVENT_NAMES = [
  'ui.page_view',
  'ui.button_click',
  'governance.console_view',
  'governance.mode_changed',
  'governance.flag_changed',
  'job.started',
  'job.progress',
  'job.completed',
  'job.failed',
  'experiment.assigned',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
