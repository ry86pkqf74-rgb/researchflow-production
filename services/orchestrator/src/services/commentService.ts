/**
 * Comment Service
 * 
 * Manages inline/threaded comments on artifacts with:
 * - PHI scanning before storage (location-only findings)
 * - Thread management
 * - Resolution workflow
 * - Assignment
 */
import { db } from "../../db";
import { comments, artifacts, artifactVersions } from "@researchflow/core/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { scan as scanPhi, hasPhi } from "@researchflow/phi-engine";
import crypto from "crypto";

export type CommentAnchorType = 
  | 'text_selection' 
  | 'entire_section' 
  | 'table_cell' 
  | 'figure_region' 
  | 'slide_region';

export interface TextSelectionAnchor {
  startOffset: number;
  endOffset: number;
  selectedText?: string; // Will be hashed, never stored raw
}

export interface SectionAnchor {
  sectionId: string;
  sectionName: string;
}

export interface TableCellAnchor {
  tableId: string;
  row: number;
  col: number;
}

export interface FigureRegionAnchor {
  figureId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlideRegionAnchor {
  slideIndex: number;
  shapeId?: string;
  x?: number;
  y?: number;
}

export type AnchorData = 
  | TextSelectionAnchor 
  | SectionAnchor 
  | TableCellAnchor 
  | FigureRegionAnchor 
  | SlideRegionAnchor;

export interface CreateCommentParams {
  researchId: string;
  artifactId: string;
  versionId?: string;
  parentCommentId?: string;
  threadId?: string;
  anchorType: CommentAnchorType;
  anchorData: AnchorData;
  body: string;
  assignedTo?: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
  overridePhiCheck?: boolean; // Steward override
}

export interface PhiFindingLocation {
  type: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  exampleHash: string; // SHA256 hash of matched text (first 12 chars)
}

export interface CommentWithThread {
  id: string;
  researchId: string;
  artifactId: string;
  versionId: string | null;
  parentCommentId: string | null;
  threadId: string;
  anchorType: CommentAnchorType;
  anchorData: AnchorData;
  body: string;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  assignedTo: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  phiScanStatus: string;
  replies?: CommentWithThread[];
}

/**
 * Hash a sample of PHI for audit purposes (never store raw PHI).
 */
function hashSample(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

/**
 * Scan text for PHI and return location-only findings.
 * Never returns the actual matched text.
 */
export function scanTextForPhiLocations(text: string): PhiFindingLocation[] {
  const findings = scanPhi(text);
  return findings.map(f => ({
    type: f.type,
    startIndex: f.startIndex,
    endIndex: f.endIndex,
    confidence: f.confidence,
    exampleHash: hashSample(f.value),
  }));
}

/**
 * Create a new comment with PHI scanning.
 * Returns 409 conflict if PHI is detected and no override is provided.
 */
export async function createComment(params: CreateCommentParams): Promise<{
  success: boolean;
  comment?: CommentWithThread;
  error?: string;
  phiFindings?: PhiFindingLocation[];
}> {
  // PHI scan the body
  const phiDetected = hasPhi(params.body);
  const phiFindings = phiDetected ? scanTextForPhiLocations(params.body) : [];

  if (phiDetected && !params.overridePhiCheck) {
    return {
      success: false,
      error: "PHI detected in comment body. Review findings and request steward override if necessary.",
      phiFindings,
    };
  }

  const commentId = nanoid();
  const threadId = params.threadId || params.parentCommentId || commentId;

  // Sanitize anchor data - hash any text selections
  const sanitizedAnchorData = sanitizeAnchorData(params.anchorData);

  try {
    await db.insert(comments).values({
      id: commentId,
      researchId: params.researchId,
      artifactId: params.artifactId,
      versionId: params.versionId || null,
      parentCommentId: params.parentCommentId || null,
      threadId,
      anchorType: params.anchorType,
      anchorData: sanitizedAnchorData,
      body: params.body,
      resolved: false,
      assignedTo: params.assignedTo || null,
      createdBy: params.createdBy,
      phiScanStatus: phiDetected ? 'OVERRIDE' : 'PASS',
      phiFindings: phiFindings,
      metadata: params.metadata || {},
    });

    const [created] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId));

    return {
      success: true,
      comment: mapToCommentWithThread(created),
    };
  } catch (error: any) {
    console.error("[commentService] Error creating comment:", error);
    throw error;
  }
}

/**
 * Sanitize anchor data to remove any potential PHI.
 */
function sanitizeAnchorData(anchorData: AnchorData): Record<string, unknown> {
  const data = anchorData as any;
  
  // Hash any selected text in text selection anchors
  if (data.selectedText) {
    return {
      ...data,
      selectedTextHash: hashSample(data.selectedText),
      selectedText: undefined, // Remove raw text
    };
  }
  
  return data;
}

/**
 * List comments for an artifact with optional filters.
 */
export async function listComments(
  artifactId: string,
  options?: {
    status?: 'open' | 'resolved' | 'all';
    threadId?: string;
    versionId?: string;
  }
): Promise<CommentWithThread[]> {
  let baseQuery = db
    .select()
    .from(comments)
    .where(and(
      eq(comments.artifactId, artifactId),
      isNull(comments.deletedAt)
    ))
    .orderBy(comments.createdAt);

  const rows = await baseQuery;

  // Filter by status
  let filtered = rows;
  if (options?.status === 'open') {
    filtered = rows.filter(r => !r.resolved);
  } else if (options?.status === 'resolved') {
    filtered = rows.filter(r => r.resolved);
  }

  // Filter by thread
  if (options?.threadId) {
    filtered = filtered.filter(r => r.threadId === options.threadId);
  }

  // Filter by version
  if (options?.versionId) {
    filtered = filtered.filter(r => r.versionId === options.versionId);
  }

  // Build threaded structure - return root comments with nested replies
  const commentMap = new Map<string, CommentWithThread>();
  const rootComments: CommentWithThread[] = [];

  for (const row of filtered) {
    const comment = mapToCommentWithThread(row);
    commentMap.set(comment.id, comment);
  }

  for (const comment of commentMap.values()) {
    if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
      const parent = commentMap.get(comment.parentCommentId)!;
      parent.replies = parent.replies || [];
      parent.replies.push(comment);
    } else {
      rootComments.push(comment);
    }
  }

  return rootComments;
}

/**
 * Get a single comment by ID.
 */
export async function getComment(commentId: string): Promise<CommentWithThread | null> {
  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;
  return mapToCommentWithThread(rows[0]);
}

/**
 * Update a comment (body only, with PHI re-scan).
 */
export async function updateComment(
  commentId: string,
  body: string,
  overridePhiCheck?: boolean
): Promise<{
  success: boolean;
  comment?: CommentWithThread;
  error?: string;
  phiFindings?: PhiFindingLocation[];
}> {
  // PHI scan the new body
  const phiDetected = hasPhi(body);
  const phiFindings = phiDetected ? scanTextForPhiLocations(body) : [];

  if (phiDetected && !overridePhiCheck) {
    return {
      success: false,
      error: "PHI detected in comment body. Review findings and request steward override if necessary.",
      phiFindings,
    };
  }

  await db
    .update(comments)
    .set({
      body,
      updatedAt: new Date(),
      phiScanStatus: phiDetected ? 'OVERRIDE' : 'PASS',
      phiFindings: phiFindings,
    })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));

  return { success: true, comment: await getComment(commentId) || undefined };
}

/**
 * Resolve a comment thread.
 */
export async function resolveComment(
  commentId: string,
  resolvedBy: string
): Promise<CommentWithThread | null> {
  await db
    .update(comments)
    .set({
      resolved: true,
      resolvedBy,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));

  return getComment(commentId);
}

/**
 * Unresolve a comment thread.
 */
export async function unresolveComment(commentId: string): Promise<CommentWithThread | null> {
  await db
    .update(comments)
    .set({
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));

  return getComment(commentId);
}

/**
 * Soft delete a comment.
 */
export async function deleteComment(commentId: string): Promise<boolean> {
  const result = await db
    .update(comments)
    .set({ deletedAt: new Date() })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Assign a comment to a user.
 */
export async function assignComment(
  commentId: string,
  assignedTo: string | null
): Promise<CommentWithThread | null> {
  await db
    .update(comments)
    .set({
      assignedTo,
      updatedAt: new Date(),
    })
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));

  return getComment(commentId);
}

/**
 * Map database row to CommentWithThread interface.
 */
function mapToCommentWithThread(row: any): CommentWithThread {
  return {
    id: row.id,
    researchId: row.researchId,
    artifactId: row.artifactId,
    versionId: row.versionId,
    parentCommentId: row.parentCommentId,
    threadId: row.threadId,
    anchorType: row.anchorType as CommentAnchorType,
    anchorData: row.anchorData as AnchorData,
    body: row.body,
    resolved: row.resolved,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt,
    assignedTo: row.assignedTo,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    phiScanStatus: row.phiScanStatus,
  };
}
