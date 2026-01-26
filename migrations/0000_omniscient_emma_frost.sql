CREATE TABLE "approval_audit_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_id" varchar NOT NULL,
	"action" text NOT NULL,
	"performed_by_id" varchar,
	"performed_by_role" text,
	"performed_by_email" varchar,
	"performed_by_name" varchar,
	"reason" text,
	"details" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"session_id" varchar,
	"performed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_gates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_type" text NOT NULL,
	"resource_id" varchar NOT NULL,
	"resource_type" text NOT NULL,
	"approval_mode" text DEFAULT 'REQUIRE_EACH' NOT NULL,
	"requested_by_id" varchar NOT NULL,
	"requested_by_role" text NOT NULL,
	"requested_by_email" varchar,
	"requested_by_name" varchar,
	"approved_by_id" varchar,
	"approved_by_role" text,
	"approved_by_email" varchar,
	"approved_by_name" varchar,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"rejection_reason" text,
	"conditions" jsonb,
	"metadata" jsonb,
	"session_id" varchar,
	"ip_address" varchar,
	"escalated_at" timestamp,
	"escalated_to" varchar,
	"is_override" boolean DEFAULT false,
	"override_justification" text,
	"override_confirmed_by" varchar,
	"expires_at" timestamp,
	"requested_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"reviewed_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar NOT NULL,
	"requested_by" varchar,
	"approved_by" varchar,
	"status" varchar(20) DEFAULT 'pending',
	"reason" text,
	"approval_type" varchar(50),
	"requested_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"resolved_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "artifact_comparisons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" varchar NOT NULL,
	"from_version_id" varchar NOT NULL,
	"to_version_id" varchar NOT NULL,
	"diff_summary" text NOT NULL,
	"added_lines" integer NOT NULL,
	"removed_lines" integer NOT NULL,
	"compared_by" varchar NOT NULL,
	"compared_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256_hash" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"change_description" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_id" varchar NOT NULL,
	"stage_id" varchar NOT NULL,
	"artifact_type" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"content" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256_hash" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"current_version_id" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"user_id" varchar,
	"resource_type" text,
	"resource_id" varchar,
	"action" text NOT NULL,
	"details" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"session_id" varchar,
	"research_id" varchar,
	"previous_hash" varchar,
	"entry_hash" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conference_id" varchar,
	"research_id" varchar NOT NULL,
	"stage_id" integer NOT NULL,
	"items" jsonb NOT NULL,
	"overall_status" text DEFAULT 'incomplete' NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"total_items" integer NOT NULL,
	"required_items" integer DEFAULT 0 NOT NULL,
	"required_completed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conference_materials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conference_id" varchar,
	"research_id" varchar NOT NULL,
	"stage_id" integer NOT NULL,
	"material_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"file_url" text,
	"file_format" text,
	"file_size_bytes" integer,
	"dimensions" jsonb,
	"slide_count" integer,
	"generated_from_manuscript" boolean DEFAULT true NOT NULL,
	"manuscript_version" varchar,
	"phi_status" text DEFAULT 'UNCHECKED' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conference_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conference_name" text NOT NULL,
	"conference_acronym" varchar,
	"abstract_word_limit" integer NOT NULL,
	"poster_dimensions" jsonb,
	"slide_count" jsonb,
	"submission_deadline" text NOT NULL,
	"presentation_type" text NOT NULL,
	"required_sections" jsonb NOT NULL,
	"file_formats" jsonb NOT NULL,
	"disclosure_required" boolean DEFAULT true NOT NULL,
	"funding_statement_required" boolean DEFAULT true NOT NULL,
	"author_limit_per_presentation" integer,
	"speaking_time_minutes" integer,
	"qa_separate_minutes" integer,
	"additional_requirements" jsonb,
	"website_url" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"classification" varchar(50) DEFAULT 'UNKNOWN' NOT NULL,
	"risk_score" integer DEFAULT 0,
	"format" varchar(50),
	"size_bytes" integer,
	"row_count" integer,
	"column_count" integer,
	"encrypted_at_rest" boolean DEFAULT false,
	"encryption_key_id" varchar(100),
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_accessed_at" timestamp,
	"metadata" jsonb,
	"phi_flags" jsonb
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_id" varchar,
	"original_filename" text NOT NULL,
	"stored_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256_hash" varchar NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"phi_scan_status" text DEFAULT 'pending',
	"phi_scan_result" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handoff_packs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" varchar NOT NULL,
	"pack_type" text NOT NULL,
	"version" varchar DEFAULT '1.0.0' NOT NULL,
	"research_id" varchar NOT NULL,
	"stage_id" varchar NOT NULL,
	"stage_name" text NOT NULL,
	"session_id" varchar,
	"model_id" varchar,
	"model_version" varchar,
	"prompt_hash" varchar NOT NULL,
	"response_hash" varchar NOT NULL,
	"content" jsonb,
	"content_schema" text,
	"token_usage_input" integer DEFAULT 0 NOT NULL,
	"token_usage_output" integer DEFAULT 0 NOT NULL,
	"token_usage_total" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"cost_cents" integer DEFAULT 0,
	"approval_gate_id" varchar,
	"parent_pack_id" varchar,
	"tags" jsonb,
	"is_valid" boolean DEFAULT true,
	"validation_errors" jsonb,
	"validation_warnings" jsonb,
	"signature" varchar,
	"generated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "handoff_packs_pack_id_unique" UNIQUE("pack_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phi_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" varchar NOT NULL,
	"severity" text DEFAULT 'LOW' NOT NULL,
	"description" text NOT NULL,
	"detected_by" varchar,
	"affected_research_id" varchar,
	"affected_dataset_id" varchar,
	"phi_type" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"remediation_steps" jsonb,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "phi_incidents_incident_id_unique" UNIQUE("incident_id")
);
--> statement-breakpoint
CREATE TABLE "phi_scan_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" varchar NOT NULL,
	"research_id" varchar,
	"resource_type" text NOT NULL,
	"resource_id" varchar,
	"context" text NOT NULL,
	"risk_level" text NOT NULL,
	"detected" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"content_length" integer NOT NULL,
	"requires_override" boolean DEFAULT false NOT NULL,
	"override_approved" boolean,
	"override_approved_by" varchar,
	"override_approved_at" timestamp,
	"override_justification" text,
	"override_conditions" jsonb,
	"override_expires_at" timestamp,
	"scanned_by" varchar,
	"scanned_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "phi_scan_results_scan_id_unique" UNIQUE("scan_id")
);
--> statement-breakpoint
CREATE TABLE "research_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_id" varchar NOT NULL,
	"session_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"owner_id" varchar NOT NULL,
	"data_classification" text DEFAULT 'UNKNOWN' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"irb_approval_number" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "research_projects_research_id_unique" UNIQUE("research_id")
);
--> statement-breakpoint
CREATE TABLE "research_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"current_stage_id" integer DEFAULT 1 NOT NULL,
	"stage_progress" jsonb,
	"workflow_state" jsonb,
	"last_active_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statistical_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" varchar NOT NULL,
	"topic_version" integer NOT NULL,
	"research_id" varchar NOT NULL,
	"primary_analyses" jsonb NOT NULL,
	"secondary_analyses" jsonb,
	"covariate_strategy" jsonb NOT NULL,
	"sensitivity_analyses" jsonb,
	"missing_data_plan" jsonb NOT NULL,
	"multiplicity_correction" text DEFAULT 'none' NOT NULL,
	"assumption_checks" jsonb,
	"subgroup_analyses" jsonb,
	"alpha_level" text DEFAULT '0.05' NOT NULL,
	"random_seed" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"executed_at" timestamp,
	"execution_result" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(500) NOT NULL,
	"backend" varchar(20) DEFAULT 'local',
	"bucket_name" varchar(100),
	"size_bytes" integer,
	"content_hash" varchar(64) NOT NULL,
	"content_type" varchar(100),
	"encrypted" boolean DEFAULT false,
	"encryption_key_id" varchar(100),
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_accessed_at" timestamp,
	CONSTRAINT "storage_files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_id" varchar NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"pico_elements" jsonb,
	"keywords" jsonb,
	"version_hash" varchar NOT NULL,
	"content_hash" varchar,
	"version_history" jsonb,
	"previous_version_id" varchar,
	"created_by" varchar NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"locked_at" timestamp,
	"locked_by" varchar,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'VIEWER' NOT NULL,
	"granted_by" varchar,
	"granted_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approval_audit_entries" ADD CONSTRAINT "approval_audit_entries_gate_id_approval_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."approval_gates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_audit_entries" ADD CONSTRAINT "approval_audit_entries_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_gates" ADD CONSTRAINT "approval_gates_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_gates" ADD CONSTRAINT "approval_gates_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_gates" ADD CONSTRAINT "approval_gates_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_gates" ADD CONSTRAINT "approval_gates_override_confirmed_by_users_id_fk" FOREIGN KEY ("override_confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_comparisons" ADD CONSTRAINT "artifact_comparisons_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_comparisons" ADD CONSTRAINT "artifact_comparisons_from_version_id_artifact_versions_id_fk" FOREIGN KEY ("from_version_id") REFERENCES "public"."artifact_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_comparisons" ADD CONSTRAINT "artifact_comparisons_to_version_id_artifact_versions_id_fk" FOREIGN KEY ("to_version_id") REFERENCES "public"."artifact_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checklists" ADD CONSTRAINT "compliance_checklists_conference_id_conference_requirements_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conference_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conference_materials" ADD CONSTRAINT "conference_materials_conference_id_conference_requirements_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conference_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_packs" ADD CONSTRAINT "handoff_packs_approval_gate_id_approval_gates_id_fk" FOREIGN KEY ("approval_gate_id") REFERENCES "public"."approval_gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phi_incidents" ADD CONSTRAINT "phi_incidents_detected_by_users_id_fk" FOREIGN KEY ("detected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phi_incidents" ADD CONSTRAINT "phi_incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phi_scan_results" ADD CONSTRAINT "phi_scan_results_override_approved_by_users_id_fk" FOREIGN KEY ("override_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phi_scan_results" ADD CONSTRAINT "phi_scan_results_scanned_by_users_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statistical_plans" ADD CONSTRAINT "statistical_plans_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statistical_plans" ADD CONSTRAINT "statistical_plans_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_files" ADD CONSTRAINT "storage_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");