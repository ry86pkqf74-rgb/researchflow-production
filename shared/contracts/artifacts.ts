/**
 * Artifacts Contracts - Phase B
 *
 * Type definitions for manuscript artifacts (figures, tables, exports).
 * All artifacts must have manifest entries with content hashes.
 */

export type ArtifactKind = "figure" | "table" | "export" | "supplement" | "data" | "code" | "bundle";

export type ArtifactFormat =
  | "png"
  | "svg"
  | "pdf"
  | "csv"
  | "json"
  | "docx"
  | "latex"
  | "html"
  | "zip"
  | "plotly_json";

export interface ManuscriptArtifact {
  id: string;
  manuscriptId: string;
  kind: ArtifactKind;
  format: ArtifactFormat;
  name: string;
  caption?: string;
  /** Path relative to shared volume: /artifacts/manuscripts/<manuscriptId>/... */
  path: string;
  /** SHA-256 hash of file contents */
  contentHash: string;
  /** File size in bytes */
  sizeBytes: number;
  /** MIME type */
  mimeType: string;
  /** Metadata specific to artifact type */
  metadata?: ArtifactMetadata;
  createdAt: string;
  createdBy: string;
}

export interface ArtifactMetadata {
  /** For figures: dimensions */
  width?: number;
  height?: number;
  /** For tables: row/column counts */
  rowCount?: number;
  columnCount?: number;
  /** For exports: journal style */
  journalStyleId?: string;
  /** For exports: double-blind status */
  doubleBlind?: boolean;
  /** For interactive figures: plotly config */
  plotlyConfig?: Record<string, unknown>;
  /** For code: language */
  language?: string;
  /** For bundles: included file list */
  includedFiles?: string[];
}

export interface ManuscriptManifest {
  manuscriptId: string;
  version: number;
  artifacts: ManuscriptArtifact[];
  /** Hash of entire manifest for integrity */
  manifestHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactUploadRequest {
  manuscriptId: string;
  kind: ArtifactKind;
  format: ArtifactFormat;
  name: string;
  caption?: string;
  metadata?: ArtifactMetadata;
}

export interface ArtifactUploadResponse {
  artifactId: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface ArtifactListResponse {
  artifacts: ManuscriptArtifact[];
  manifest: ManuscriptManifest;
}

export interface ArtifactEmbedNode {
  kind: ArtifactKind;
  ref: string;
  caption?: string;
  alt?: string;
}

export interface FigureGenerationRequest {
  manuscriptId: string;
  figureType: "bar" | "line" | "scatter" | "heatmap" | "boxplot" | "forest" | "kaplan_meier";
  dataRef: string;
  config: FigureConfig;
}

export interface FigureConfig {
  title?: string;
  xLabel?: string;
  yLabel?: string;
  colorScheme?: string;
  interactive?: boolean;
  /** Convert matplotlib/seaborn to plotly */
  convertToPlotly?: boolean;
}

export interface FigureGenerationResponse {
  jobId: string;
  statusUrl: string;
}

export interface ReproducibilityBundle {
  id: string;
  manuscriptId: string;
  /** Manuscript markdown content */
  manuscriptMd: string;
  /** All manifests */
  manifests: ManuscriptManifest[];
  /** Environment info */
  environment: EnvironmentInfo;
  /** Analysis scripts (if allowed) */
  scripts?: string[];
  /** Random seeds used */
  seeds?: Record<string, number>;
  /** Docker compose config */
  dockerCompose?: string;
  /** Image digests */
  imageDigests?: Record<string, string>;
  createdAt: string;
  contentHash: string;
}

export interface EnvironmentInfo {
  pythonVersion?: string;
  nodeVersion?: string;
  pipFreeze?: string;
  npmPackageLock?: string;
  osInfo?: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: ManifestValidationError[];
}

export interface ManifestValidationError {
  artifactId: string;
  error: "MISSING_FILE" | "HASH_MISMATCH" | "INVALID_SCHEMA" | "MISSING_REQUIRED_FIELD";
  details: string;
}
