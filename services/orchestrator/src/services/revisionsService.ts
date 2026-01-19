/**
 * Revisions Service
 *
 * Manages section revisions with append-only versioning and rollback support.
 */

import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import type {
  SectionRevision,
  ManuscriptSectionKey,
} from '../../../../shared/contracts/manuscripts';
import type { ManuscriptAuditEvent, AuditEventType } from '../../../../shared/contracts/audit';

// In-memory stores for development; replace with DB in production
const revisionStore = new Map<string, SectionRevision>();
const auditStore = new Map<string, ManuscriptAuditEvent>();

export interface CommitRevisionParams {
  manuscriptId: string;
  sectionKey: ManuscriptSectionKey;
  contentMd: string;
  contentJson?: Record<string, unknown>;
  actor: string;
  commitMessage?: string;
  parentRevisionId?: string;
}

/**
 * Calculate word count from markdown content
 */
function calculateWordCount(content: string): number {
  return content
    .replace(/[#*_\[\]()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Calculate hash for audit chain
 */
function calculateAuditHash(
  manuscriptId: string,
  eventType: string,
  actor: string,
  details: Record<string, unknown>,
  previousHash?: string
): string {
  const payload = JSON.stringify({
    manuscriptId,
    eventType,
    actor,
    details,
    previousHash: previousHash || '',
    timestamp: new Date().toISOString(),
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Get the latest version number for a section
 */
async function getLatestVersionNumber(
  manuscriptId: string,
  sectionKey: ManuscriptSectionKey
): Promise<number> {
  const revisions = Array.from(revisionStore.values())
    .filter((r) => r.manuscriptId === manuscriptId && r.sectionKey === sectionKey)
    .sort((a, b) => b.version - a.version);

  return revisions.length > 0 ? revisions[0].version : 0;
}

/**
 * Get the latest audit hash for a manuscript
 */
async function getLatestAuditHash(manuscriptId: string): Promise<string | undefined> {
  const events = Array.from(auditStore.values())
    .filter((e) => e.manuscriptId === manuscriptId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return events.length > 0 ? events[0].currentHash : undefined;
}

/**
 * Create an audit event
 */
async function createAuditEvent(
  manuscriptId: string,
  eventType: AuditEventType,
  actor: string,
  details: Record<string, unknown>
): Promise<ManuscriptAuditEvent> {
  const previousHash = await getLatestAuditHash(manuscriptId);
  const currentHash = calculateAuditHash(manuscriptId, eventType, actor, details, previousHash);

  const event: ManuscriptAuditEvent = {
    id: uuid(),
    manuscriptId,
    eventType,
    actor,
    detailsJson: details,
    previousHash,
    currentHash,
    createdAt: new Date().toISOString(),
  };

  auditStore.set(event.id, event);

  // TODO: Persist to database

  return event;
}

/**
 * Commit a new section revision (append-only)
 */
export async function commitSectionRevision(
  params: CommitRevisionParams
): Promise<{ id: string; version: number }> {
  const latestVersion = await getLatestVersionNumber(params.manuscriptId, params.sectionKey);
  const newVersion = latestVersion + 1;

  const revision: SectionRevision = {
    id: uuid(),
    manuscriptId: params.manuscriptId,
    sectionKey: params.sectionKey,
    version: newVersion,
    contentMd: params.contentMd,
    contentJson: params.contentJson,
    wordCount: calculateWordCount(params.contentMd),
    createdAt: new Date().toISOString(),
    createdBy: params.actor,
    commitMessage: params.commitMessage,
    parentRevisionId: params.parentRevisionId,
  };

  revisionStore.set(revision.id, revision);

  // Create audit event
  await createAuditEvent(params.manuscriptId, 'SECTION_EDITED', params.actor, {
    sectionKey: params.sectionKey,
    revisionId: revision.id,
    version: newVersion,
    wordCount: revision.wordCount,
    commitMessage: params.commitMessage,
  });

  // TODO: Persist to database

  return { id: revision.id, version: newVersion };
}

/**
 * Get a revision by ID
 */
export async function getRevision(revisionId: string): Promise<SectionRevision | null> {
  return revisionStore.get(revisionId) || null;
}

/**
 * Get the latest revision for a section
 */
export async function getLatestRevision(
  manuscriptId: string,
  sectionKey: ManuscriptSectionKey
): Promise<SectionRevision | null> {
  const revisions = Array.from(revisionStore.values())
    .filter((r) => r.manuscriptId === manuscriptId && r.sectionKey === sectionKey)
    .sort((a, b) => b.version - a.version);

  return revisions.length > 0 ? revisions[0] : null;
}

/**
 * Get all revisions for a section
 */
export async function getRevisionHistory(
  manuscriptId: string,
  sectionKey: ManuscriptSectionKey
): Promise<SectionRevision[]> {
  return Array.from(revisionStore.values())
    .filter((r) => r.manuscriptId === manuscriptId && r.sectionKey === sectionKey)
    .sort((a, b) => b.version - a.version);
}

/**
 * Rollback to a specific revision (creates new revision copying content)
 */
export async function rollbackToRevision(
  manuscriptId: string,
  sectionKey: ManuscriptSectionKey,
  targetRevisionId: string,
  actor: string
): Promise<{ id: string; version: number }> {
  const targetRevision = await getRevision(targetRevisionId);

  if (!targetRevision) {
    throw new Error(`Revision ${targetRevisionId} not found`);
  }

  if (targetRevision.manuscriptId !== manuscriptId) {
    throw new Error('Revision does not belong to this manuscript');
  }

  // Create new revision copying content from target
  const result = await commitSectionRevision({
    manuscriptId,
    sectionKey,
    contentMd: targetRevision.contentMd,
    contentJson: targetRevision.contentJson,
    actor,
    commitMessage: `Rollback to version ${targetRevision.version}`,
    parentRevisionId: targetRevisionId,
  });

  // Create specific rollback audit event
  await createAuditEvent(manuscriptId, 'SECTION_ROLLBACK', actor, {
    sectionKey,
    targetRevisionId,
    targetVersion: targetRevision.version,
    newRevisionId: result.id,
    newVersion: result.version,
  });

  return result;
}

/**
 * Get all revisions for a manuscript (all sections)
 */
export async function getAllRevisions(manuscriptId: string): Promise<SectionRevision[]> {
  return Array.from(revisionStore.values())
    .filter((r) => r.manuscriptId === manuscriptId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get word counts for all sections
 */
export async function getSectionWordCounts(
  manuscriptId: string
): Promise<Record<ManuscriptSectionKey, number>> {
  const sections: ManuscriptSectionKey[] = [
    'TITLE',
    'ABSTRACT',
    'INTRODUCTION',
    'METHODS',
    'RESULTS',
    'DISCUSSION',
    'REFERENCES',
    'FIGURES',
    'TABLES',
    'SUPPLEMENT',
    'ACKNOWLEDGEMENTS',
    'CONFLICTS',
  ];

  const counts: Partial<Record<ManuscriptSectionKey, number>> = {};

  for (const section of sections) {
    const latest = await getLatestRevision(manuscriptId, section);
    counts[section] = latest?.wordCount || 0;
  }

  return counts as Record<ManuscriptSectionKey, number>;
}

/**
 * Get audit trail for a manuscript
 */
export async function getAuditTrail(
  manuscriptId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ events: ManuscriptAuditEvent[]; total: number }> {
  const allEvents = Array.from(auditStore.values())
    .filter((e) => e.manuscriptId === manuscriptId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const offset = options?.offset || 0;
  const limit = options?.limit || 50;
  const events = allEvents.slice(offset, offset + limit);

  return { events, total: allEvents.length };
}

export default {
  commitSectionRevision,
  getRevision,
  getLatestRevision,
  getRevisionHistory,
  rollbackToRevision,
  getAllRevisions,
  getSectionWordCounts,
  getAuditTrail,
  createAuditEvent,
};
