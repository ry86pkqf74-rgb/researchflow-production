/**
 * Blinding Service
 * Phase 5.3: Manuscript blinding for peer review
 * 
 * Features:
 * - Author information removal
 * - Institutional reference redaction
 * - Acknowledgments anonymization
 * - Self-citation detection and flagging
 * - Reversible blinding with audit trail
 */

import { db } from '../../db';
import { logAction } from '../services/audit-service';
import crypto from 'crypto';

export interface Author {
  name: string;
  email?: string;
  affiliation?: string;
  orcid?: string;
  isCorresponding?: boolean;
}

export interface ManuscriptSections {
  title?: string;
  abstract?: string;
  introduction?: string;
  methods?: string;
  results?: string;
  discussion?: string;
  conclusion?: string;
  acknowledgments?: string;
  references?: string;
  [key: string]: string | undefined;
}

export interface Manuscript {
  id: string;
  title: string;
  authors: Author[];
  sections: ManuscriptSections;
  figures?: { caption: string; altText?: string }[];
  tables?: { caption: string }[];
  metadata?: Record<string, any>;
}

export interface BlindedManuscript extends Manuscript {
  blindingId: string;
  blindedAt: string;
  blindingLevel: 'single' | 'double';
  redactionCount: number;
}

export interface BlindingRecord {
  id: string;
  manuscriptId: string;
  blindingLevel: 'single' | 'double';
  originalHash: string;
  blindedHash: string;
  redactionMap: Record<string, string>;
  redactionCount: number;
  createdBy: string;
  createdAt: Date;
  unblindedAt?: Date;
  unblindedBy?: string;
}

/**
 * Patterns for identifying information
 */
const REDACTION_PATTERNS = {
  // Names (First Last format)
  names: /\b[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+\b/g,
  
  // Email addresses
  emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  
  // Institutions
  institutions: /\b(?:University|College|Institute|Hospital|Center|Centre|School|Department|Faculty)\s+(?:of\s+)?[A-Z][A-Za-z\s,]+/g,
  
  // ORCID
  orcid: /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/g,
  
  // Grant numbers
  grants: /\b(?:Grant|Award|Contract)\s*(?:No\.?|Number|#)?\s*[:.]?\s*[A-Z0-9-]+/gi,
  
  // Funding agencies
  funding: /\b(?:NIH|NSF|CDC|FDA|WHO|NCI|NIMH|NHLBI|DOD|VA)\b/g,
  
  // Location patterns
  locations: /\b(?:located\s+(?:at|in)|based\s+(?:at|in)|conducted\s+at)\s+[A-Z][A-Za-z\s,]+/gi,
  
  // IRB/Ethics
  irb: /\b(?:IRB|Ethics\s+Committee|Institutional\s+Review\s+Board)\s+(?:at|of)?\s*[A-Z][A-Za-z\s]+/gi,
  
  // Self-citations (Author et al., year)
  selfCitations: /\b[A-Z][a-z]+\s+et\s+al\.\s*,?\s*\d{4}/g
};

/**
 * Blinding Service
 */
export class BlindingService {
  private static instance: BlindingService;
  
  private constructor() {}
  
  static getInstance(): BlindingService {
    if (!this.instance) {
      this.instance = new BlindingService();
    }
    return this.instance;
  }
  
  /**
   * Blind manuscript for peer review
   */
  async blindForReview(
    manuscript: Manuscript,
    options: {
      level?: 'single' | 'double';
      preserveSelfCitations?: boolean;
      userId?: string;
    } = {}
  ): Promise<BlindedManuscript> {
    const { level = 'double', preserveSelfCitations = false, userId } = options;
    
    const redactionMap: Record<string, string> = {};
    let redactionCount = 0;
    
    // Deep clone manuscript
    const blinded: any = JSON.parse(JSON.stringify(manuscript));
    
    // 1. Blind author information
    const authorNames = manuscript.authors.map(a => a.name);
    blinded.authors = manuscript.authors.map((author, index) => {
      redactionMap[author.name] = `Author ${index + 1}`;
      return {
        name: `Author ${index + 1}`,
        email: undefined,
        affiliation: level === 'double' ? 'Institution' : author.affiliation,
        orcid: undefined,
        isCorresponding: author.isCorresponding
      };
    });
    redactionCount += manuscript.authors.length;
    
    // 2. Redact sections
    const sectionsToBlind = ['methods', 'acknowledgments', 'discussion'];
    if (level === 'double') {
      sectionsToBlind.push('introduction', 'results');
    }
    
    for (const sectionKey of sectionsToBlind) {
      const section = blinded.sections[sectionKey];
      if (section) {
        const result = this.redactText(section, authorNames, preserveSelfCitations);
        blinded.sections[sectionKey] = result.text;
        redactionCount += result.count;
        Object.assign(redactionMap, result.map);
      }
    }
    
    // 3. Handle acknowledgments specially
    if (blinded.sections.acknowledgments) {
      blinded.sections.acknowledgments = this.redactAcknowledgments(
        blinded.sections.acknowledgments
      );
    }
    
    // 4. Blind figure/table captions
    if (blinded.figures) {
      for (const fig of blinded.figures) {
        const result = this.redactText(fig.caption, authorNames, preserveSelfCitations);
        fig.caption = result.text;
        redactionCount += result.count;
      }
    }
    
    if (blinded.tables) {
      for (const table of blinded.tables) {
        const result = this.redactText(table.caption, authorNames, preserveSelfCitations);
        table.caption = result.text;
        redactionCount += result.count;
      }
    }
    
    // 5. Generate hashes and record
    const originalHash = this.hashContent(manuscript);
    const blindedHash = this.hashContent(blinded);
    const blindingId = crypto.randomUUID();
    
    // Store blinding record
    await db.query(`
      INSERT INTO blinding_records 
        (id, manuscript_id, blinding_level, original_hash, blinded_hash, 
         redaction_map, redaction_count, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      blindingId,
      manuscript.id,
      level,
      originalHash,
      blindedHash,
      JSON.stringify(redactionMap),
      redactionCount,
      userId
    ]);
    
    // Audit log
    await logAction({
      eventType: 'MANUSCRIPT_BLINDED',
      action: 'CREATE',
      resourceType: 'BLINDING',
      resourceId: blindingId,
      userId,
      details: { 
        manuscriptId: manuscript.id, 
        level, 
        redactionCount 
      }
    });
    
    return {
      ...blinded,
      blindingId,
      blindedAt: new Date().toISOString(),
      blindingLevel: level,
      redactionCount
    };
  }
  
  /**
   * Redact text content
   */
  private redactText(
    text: string,
    authorNames: string[],
    preserveSelfCitations: boolean
  ): { text: string; count: number; map: Record<string, string> } {
    let result = text;
    let count = 0;
    const map: Record<string, string> = {};
    
    // Redact author names first (highest priority)
    for (const name of authorNames) {
      const regex = new RegExp(`\\b${this.escapeRegex(name)}\\b`, 'gi');
      const matches = result.match(regex);
      if (matches) {
        count += matches.length;
        map[name] = '[Author Name Redacted]';
        result = result.replace(regex, '[Author Name Redacted]');
      }
    }
    
    // Redact institutions
    const instMatches = result.match(REDACTION_PATTERNS.institutions) || [];
    for (const match of [...new Set(instMatches)]) {
      map[match] = '[Institution]';
      count++;
    }
    result = result.replace(REDACTION_PATTERNS.institutions, '[Institution]');
    
    // Redact emails
    result = result.replace(REDACTION_PATTERNS.emails, (match) => {
      map[match] = '[Email Redacted]';
      count++;
      return '[Email Redacted]';
    });
    
    // Redact ORCID
    result = result.replace(REDACTION_PATTERNS.orcid, (match) => {
      map[match] = '[ORCID Redacted]';
      count++;
      return '[ORCID Redacted]';
    });
    
    // Redact grants
    result = result.replace(REDACTION_PATTERNS.grants, (match) => {
      map[match] = '[Grant Number Redacted]';
      count++;
      return '[Grant Number Redacted]';
    });
    
    // Redact IRB references
    result = result.replace(REDACTION_PATTERNS.irb, (match) => {
      map[match] = '[Ethics Board]';
      count++;
      return '[Ethics Board]';
    });
    
    // Redact location references
    result = result.replace(REDACTION_PATTERNS.locations, (match) => {
      map[match] = '[Location Redacted]';
      count++;
      return '[Location Redacted]';
    });
    
    // Handle self-citations
    if (!preserveSelfCitations) {
      for (const name of authorNames) {
        const lastName = name.split(' ').pop() || name;
        const selfCiteRegex = new RegExp(
          `\\b${this.escapeRegex(lastName)}\\s+et\\s+al\\.\\s*,?\\s*\\d{4}`,
          'gi'
        );
        result = result.replace(selfCiteRegex, (match) => {
          map[match] = '[Self-Citation]';
          count++;
          return '[Self-Citation]';
        });
      }
    }
    
    return { text: result, count, map };
  }
  
  /**
   * Special handling for acknowledgments
   */
  private redactAcknowledgments(text: string): string {
    let result = text;
    
    // Redact all names in acknowledgments
    result = result.replace(REDACTION_PATTERNS.names, '[Name Redacted]');
    
    // Redact funding agencies
    result = result.replace(REDACTION_PATTERNS.funding, '[Funding Agency]');
    
    // Redact grants
    result = result.replace(REDACTION_PATTERNS.grants, '[Grant Redacted]');
    
    // Redact institutions
    result = result.replace(REDACTION_PATTERNS.institutions, '[Institution]');
    
    return result;
  }
  
  /**
   * Unblind manuscript (restore original)
   */
  async unblind(
    blindingId: string,
    userId: string
  ): Promise<BlindingRecord> {
    const result = await db.query(`
      UPDATE blinding_records
      SET unblinded_at = NOW(), unblinded_by = $1
      WHERE id = $2
      RETURNING *
    `, [userId, blindingId]);
    
    if (result.rows.length === 0) {
      throw new Error('Blinding record not found');
    }
    
    const record = this.mapRecord(result.rows[0]);
    
    await logAction({
      eventType: 'MANUSCRIPT_UNBLINDED',
      action: 'UPDATE',
      resourceType: 'BLINDING',
      resourceId: blindingId,
      userId,
      details: { manuscriptId: record.manuscriptId }
    });
    
    return record;
  }
  
  /**
   * Get blinding record
   */
  async getBlindingRecord(blindingId: string): Promise<BlindingRecord | null> {
    const result = await db.query(
      'SELECT * FROM blinding_records WHERE id = $1',
      [blindingId]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapRecord(result.rows[0]);
  }
  
  /**
   * List blinding records for manuscript
   */
  async listBlindingRecords(manuscriptId: string): Promise<BlindingRecord[]> {
    const result = await db.query(
      'SELECT * FROM blinding_records WHERE manuscript_id = $1 ORDER BY created_at DESC',
      [manuscriptId]
    );
    
    return result.rows.map(this.mapRecord);
  }
  
  /**
   * Detect potential self-citations in text
   */
  detectSelfCitations(text: string, authorNames: string[]): string[] {
    const detected: string[] = [];
    
    for (const name of authorNames) {
      const lastName = name.split(' ').pop() || name;
      const selfCiteRegex = new RegExp(
        `\\b${this.escapeRegex(lastName)}\\s+et\\s+al\\.\\s*,?\\s*\\d{4}`,
        'gi'
      );
      
      const matches = text.match(selfCiteRegex);
      if (matches) {
        detected.push(...matches);
      }
    }
    
    return [...new Set(detected)];
  }
  
  /**
   * Verify blinding integrity
   */
  async verifyBlinding(
    blindedManuscript: BlindedManuscript
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    const record = await this.getBlindingRecord(blindedManuscript.blindingId);
    
    if (!record) {
      return { valid: false, issues: ['Blinding record not found'] };
    }
    
    // Verify hash
    const currentHash = this.hashContent(blindedManuscript);
    if (currentHash !== record.blindedHash) {
      issues.push('Manuscript content has been modified since blinding');
    }
    
    // Check for remaining identifiers
    const fullText = JSON.stringify(blindedManuscript.sections);
    
    if (REDACTION_PATTERNS.emails.test(fullText)) {
      issues.push('Email addresses detected in blinded content');
    }
    
    if (REDACTION_PATTERNS.orcid.test(fullText)) {
      issues.push('ORCID identifiers detected in blinded content');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  // Helpers
  private hashContent(content: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
  }
  
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  private mapRecord(row: any): BlindingRecord {
    return {
      id: row.id,
      manuscriptId: row.manuscript_id,
      blindingLevel: row.blinding_level,
      originalHash: row.original_hash,
      blindedHash: row.blinded_hash,
      redactionMap: row.redaction_map,
      redactionCount: row.redaction_count,
      createdBy: row.created_by,
      createdAt: row.created_at,
      unblindedAt: row.unblinded_at,
      unblindedBy: row.unblinded_by
    };
  }
}

export const blindingService = BlindingService.getInstance();
export default blindingService;
