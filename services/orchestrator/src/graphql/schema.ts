/**
 * GraphQL Schema for ResearchFlow API
 *
 * Provides a type-safe GraphQL interface for:
 * - Artifact management
 * - Job submission and tracking
 * - Schema queries
 * - User/session management
 */

import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  # ==================== Types ====================

  type Artifact {
    id: ID!
    name: String!
    type: ArtifactType!
    status: ArtifactStatus!
    schemaVersion: String
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: String!
    size: Int
    checksum: String
    lineage: Lineage
    fairMetadata: FAIRMetadata
  }

  type Lineage {
    id: ID!
    inputs: [LineageNode!]!
    transformations: [LineageNode!]!
    outputs: [LineageNode!]!
    graph: JSON
  }

  type LineageNode {
    id: ID!
    type: LineageNodeType!
    timestamp: DateTime!
    metadata: JSON
  }

  type FAIRMetadata {
    identifier: String!
    title: String!
    description: String
    keywords: [String!]!
    accessRights: AccessRights!
    license: String!
    creator: String!
    dateCreated: DateTime!
    version: String
    provenance: String
  }

  type Job {
    id: ID!
    type: JobType!
    status: JobStatus!
    priority: Int!
    progress: Float
    result: JSON
    error: String
    createdAt: DateTime!
    startedAt: DateTime
    completedAt: DateTime
    artifacts: [Artifact!]!
    logs: [JobLog!]!
  }

  type JobLog {
    timestamp: DateTime!
    level: LogLevel!
    message: String!
    metadata: JSON
  }

  type Schema {
    name: String!
    version: String!
    description: String
    columns: [SchemaColumn!]!
    createdAt: DateTime!
    createdBy: String!
    changelog: String
    deprecated: Boolean!
  }

  type SchemaColumn {
    name: String!
    type: String!
    nullable: Boolean!
    unique: Boolean!
    description: String
    constraints: JSON
  }

  type User {
    id: ID!
    email: String!
    name: String!
    roles: [String!]!
    createdAt: DateTime!
    lastLoginAt: DateTime
  }

  type PaginatedArtifacts {
    items: [Artifact!]!
    total: Int!
    page: Int!
    pageSize: Int!
    hasMore: Boolean!
  }

  type PaginatedJobs {
    items: [Job!]!
    total: Int!
    page: Int!
    pageSize: Int!
    hasMore: Boolean!
  }

  type UploadUrl {
    uploadUrl: String!
    artifactId: String!
    expiresAt: DateTime!
  }

  type DownloadUrl {
    downloadUrl: String!
    expiresAt: DateTime!
  }

  type WebhookConfig {
    id: ID!
    url: String!
    events: [WebhookEvent!]!
    secret: String!
    active: Boolean!
    createdAt: DateTime!
  }

  type HealthStatus {
    status: String!
    version: String!
    uptime: Int!
    services: [ServiceHealth!]!
  }

  type ServiceHealth {
    name: String!
    status: String!
    latency: Int
  }

  # ==================== Enums ====================

  enum ArtifactType {
    DATASET
    SCHEMA
    MANIFEST
    FIGURE
    REPORT
    EXPORT
    BUNDLE
  }

  enum ArtifactStatus {
    PENDING
    PROCESSING
    READY
    FAILED
    ARCHIVED
  }

  enum JobType {
    INGESTION
    VALIDATION
    TRANSFORMATION
    ANALYSIS
    EXPORT
    LITERATURE_REVIEW
  }

  enum JobStatus {
    QUEUED
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
  }

  enum LogLevel {
    DEBUG
    INFO
    WARN
    ERROR
  }

  enum AccessRights {
    OPEN
    RESTRICTED
    EMBARGOED
    CLOSED
  }

  enum LineageNodeType {
    INPUT
    TRANSFORMATION
    OUTPUT
    VALIDATION
  }

  enum WebhookEvent {
    JOB_COMPLETED
    JOB_FAILED
    ARTIFACT_CREATED
    ARTIFACT_UPDATED
    SCHEMA_UPDATED
  }

  enum SortOrder {
    ASC
    DESC
  }

  # ==================== Inputs ====================

  input ArtifactFilter {
    type: ArtifactType
    status: ArtifactStatus
    createdAfter: DateTime
    createdBefore: DateTime
    schemaVersion: String
    search: String
  }

  input JobFilter {
    type: JobType
    status: JobStatus
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input PaginationInput {
    page: Int = 1
    pageSize: Int = 20
    sortBy: String
    sortOrder: SortOrder = DESC
  }

  input CreateArtifactInput {
    name: String!
    type: ArtifactType!
    schemaVersion: String
    metadata: JSON
  }

  input SubmitJobInput {
    type: JobType!
    priority: Int = 5
    artifactIds: [ID!]
    parameters: JSON
    webhookUrl: String
  }

  input RegisterWebhookInput {
    url: String!
    events: [WebhookEvent!]!
    secret: String
  }

  input UpdateArtifactInput {
    name: String
    metadata: JSON
    status: ArtifactStatus
  }

  # ==================== Queries ====================

  type Query {
    # Artifacts
    artifact(id: ID!): Artifact
    artifacts(filter: ArtifactFilter, pagination: PaginationInput): PaginatedArtifacts!
    artifactLineage(id: ID!): Lineage

    # Jobs
    job(id: ID!): Job
    jobs(filter: JobFilter, pagination: PaginationInput): PaginatedJobs!
    jobLogs(jobId: ID!, level: LogLevel, limit: Int): [JobLog!]!

    # Schemas
    schema(name: String!, version: String): Schema
    schemas(name: String): [Schema!]!
    schemaVersions(name: String!): [String!]!

    # Users
    me: User
    users: [User!]!

    # System
    health: HealthStatus!
    version: String!
  }

  # ==================== Mutations ====================

  type Mutation {
    # Artifacts
    createArtifact(input: CreateArtifactInput!): Artifact!
    updateArtifact(id: ID!, input: UpdateArtifactInput!): Artifact!
    deleteArtifact(id: ID!): Boolean!
    archiveArtifact(id: ID!): Artifact!

    # Uploads
    requestUploadUrl(filename: String!, contentType: String!): UploadUrl!
    confirmUpload(artifactId: ID!): Artifact!
    requestDownloadUrl(artifactId: ID!): DownloadUrl!

    # Jobs
    submitJob(input: SubmitJobInput!): Job!
    cancelJob(id: ID!): Job!
    retryJob(id: ID!): Job!

    # Schemas
    registerSchema(name: String!, version: String!, schema: JSON!, changelog: String): Schema!
    deprecateSchema(name: String!, version: String!): Schema!

    # Webhooks
    registerWebhook(input: RegisterWebhookInput!): WebhookConfig!
    updateWebhook(id: ID!, active: Boolean!): WebhookConfig!
    deleteWebhook(id: ID!): Boolean!
    testWebhook(id: ID!): Boolean!
  }

  # ==================== Subscriptions ====================

  type Subscription {
    jobProgress(jobId: ID!): Job!
    jobCompleted(jobId: ID!): Job!
    artifactCreated: Artifact!
    artifactUpdated(id: ID!): Artifact!
  }
`;

export default typeDefs;
