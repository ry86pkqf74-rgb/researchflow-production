/**
 * Evidence Service
 *
 * Manages evidence cards for RAG (Retrieval Augmented Generation).
 * Provides top-k evidence retrieval for AI prompts instead of raw papers.
 */

import crypto from 'crypto';

/**
 * Paper reference
 */
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  abstract?: string;
  fullText?: string;
}

/**
 * Structured extract from a paper
 */
export interface StructuredExtract {
  paperId: string;
  extractType: 'claim' | 'method' | 'result' | 'conclusion';
  content: string;
  location: string;
  pageNumber?: number;
  section?: string;
}

/**
 * Evidence card for RAG
 */
export interface EvidenceCard {
  id: string;
  cardId: string;
  projectId?: string;
  researchId?: string;
  paperId: string;
  paperTitle?: string;
  paperAuthors?: string;
  paperYear?: number;
  paperDoi?: string;
  claim: string;
  quote: string;
  location: string;
  pageNumber?: number;
  section?: string;
  confidence: number;
  relevanceScore?: number;
  extractionMethod?: string;
  tags?: string[];
  createdBy?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Evidence card creation input
 */
export interface CreateEvidenceCardInput {
  projectId?: string;
  researchId?: string;
  paper: Paper;
  claim: string;
  quote: string;
  location: string;
  pageNumber?: number;
  section?: string;
  confidence: number;
  extractionMethod?: string;
  tags?: string[];
  createdBy?: string;
}

/**
 * Evidence retrieval options
 */
export interface RetrievalOptions {
  projectId?: string;
  researchId?: string;
  topK?: number;
  minConfidence?: number;
  tags?: string[];
  includeUnverified?: boolean;
}

// In-memory store for development (use database in production)
const evidenceCards = new Map<string, EvidenceCard>();
const cardsByProject = new Map<string, Set<string>>();
const cardsByResearch = new Map<string, Set<string>>();

/**
 * Evidence Service
 *
 * Manages evidence cards for retrieval-augmented generation.
 */
export class EvidenceService {
  /**
   * Create an evidence card from a paper and extract
   */
  createCard(input: CreateEvidenceCardInput): EvidenceCard {
    const cardId = `evc_${crypto.randomBytes(12).toString('hex')}`;

    const card: EvidenceCard = {
      id: cardId,
      cardId,
      projectId: input.projectId,
      researchId: input.researchId,
      paperId: input.paper.id,
      paperTitle: input.paper.title,
      paperAuthors: input.paper.authors.join(', '),
      paperYear: input.paper.year,
      paperDoi: input.paper.doi,
      claim: input.claim,
      quote: input.quote,
      location: input.location,
      pageNumber: input.pageNumber,
      section: input.section,
      confidence: Math.max(0, Math.min(1, input.confidence)),
      extractionMethod: input.extractionMethod,
      tags: input.tags,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store card
    evidenceCards.set(cardId, card);

    // Index by project
    if (input.projectId) {
      if (!cardsByProject.has(input.projectId)) {
        cardsByProject.set(input.projectId, new Set());
      }
      cardsByProject.get(input.projectId)!.add(cardId);
    }

    // Index by research
    if (input.researchId) {
      if (!cardsByResearch.has(input.researchId)) {
        cardsByResearch.set(input.researchId, new Set());
      }
      cardsByResearch.get(input.researchId)!.add(cardId);
    }

    return card;
  }

  /**
   * Create multiple evidence cards from a paper
   */
  createCardsFromPaper(
    paper: Paper,
    extracts: StructuredExtract[],
    options: {
      projectId?: string;
      researchId?: string;
      createdBy?: string;
    } = {}
  ): EvidenceCard[] {
    return extracts.map((extract) =>
      this.createCard({
        projectId: options.projectId,
        researchId: options.researchId,
        paper,
        claim: extract.extractType === 'claim' ? extract.content : '',
        quote: extract.content,
        location: extract.location,
        pageNumber: extract.pageNumber,
        section: extract.section,
        confidence: 0.7, // Default confidence for automated extraction
        extractionMethod: 'automated',
        tags: [extract.extractType],
        createdBy: options.createdBy,
      })
    );
  }

  /**
   * Get an evidence card by ID
   */
  getCard(cardId: string): EvidenceCard | undefined {
    return evidenceCards.get(cardId);
  }

  /**
   * Retrieve top-k evidence cards for a query
   *
   * Uses simple keyword matching for development.
   * In production, use vector embeddings for semantic search.
   */
  retrieveTopK(query: string, options: RetrievalOptions = {}): EvidenceCard[] {
    const {
      projectId,
      researchId,
      topK = 5,
      minConfidence = 0,
      tags,
      includeUnverified = true,
    } = options;

    // Get candidate cards
    let candidates: EvidenceCard[] = [];

    if (projectId) {
      const cardIds = cardsByProject.get(projectId);
      if (cardIds) {
        candidates = Array.from(cardIds)
          .map((id) => evidenceCards.get(id))
          .filter((c): c is EvidenceCard => c !== undefined);
      }
    } else if (researchId) {
      const cardIds = cardsByResearch.get(researchId);
      if (cardIds) {
        candidates = Array.from(cardIds)
          .map((id) => evidenceCards.get(id))
          .filter((c): c is EvidenceCard => c !== undefined);
      }
    } else {
      candidates = Array.from(evidenceCards.values());
    }

    // Filter by confidence
    candidates = candidates.filter((c) => c.confidence >= minConfidence);

    // Filter by verification
    if (!includeUnverified) {
      candidates = candidates.filter((c) => c.verifiedAt !== undefined);
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      candidates = candidates.filter(
        (c) => c.tags && tags.some((t) => c.tags!.includes(t))
      );
    }

    // Score by relevance (simple keyword matching)
    const queryTerms = query.toLowerCase().split(/\s+/);
    const scored = candidates.map((card) => {
      const text = `${card.claim} ${card.quote} ${card.paperTitle || ''}`.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        if (text.includes(term)) {
          score += 1;
        }
      }
      return { card, score: score / queryTerms.length };
    });

    // Sort by score and confidence
    scored.sort((a, b) => {
      const scoreA = a.score * 0.7 + a.card.confidence * 0.3;
      const scoreB = b.score * 0.7 + b.card.confidence * 0.3;
      return scoreB - scoreA;
    });

    // Return top-k
    return scored.slice(0, topK).map((s) => {
      s.card.relevanceScore = s.score;
      return s.card;
    });
  }

  /**
   * Format evidence cards for AI prompt context
   */
  formatForPrompt(cards: EvidenceCard[]): string {
    if (cards.length === 0) {
      return 'No relevant evidence found.';
    }

    const formatted = cards.map((card, index) => {
      const citation = card.paperDoi
        ? `DOI: ${card.paperDoi}`
        : card.paperTitle || card.paperId;

      return `[${index + 1}] ${card.claim}
   Source: ${citation} (${card.paperYear || 'n.d.'})
   Quote: "${card.quote}"
   Location: ${card.location}
   Confidence: ${(card.confidence * 100).toFixed(0)}%`;
    });

    return `EVIDENCE (${cards.length} sources):\n${formatted.join('\n\n')}`;
  }

  /**
   * Verify an evidence card
   */
  verifyCard(cardId: string, verifiedBy: string): EvidenceCard {
    const card = evidenceCards.get(cardId);
    if (!card) {
      throw new Error(`Evidence card not found: ${cardId}`);
    }

    card.verifiedBy = verifiedBy;
    card.verifiedAt = new Date();
    card.updatedAt = new Date();
    evidenceCards.set(cardId, card);

    return card;
  }

  /**
   * Update evidence card confidence
   */
  updateConfidence(cardId: string, confidence: number): EvidenceCard {
    const card = evidenceCards.get(cardId);
    if (!card) {
      throw new Error(`Evidence card not found: ${cardId}`);
    }

    card.confidence = Math.max(0, Math.min(1, confidence));
    card.updatedAt = new Date();
    evidenceCards.set(cardId, card);

    return card;
  }

  /**
   * Delete an evidence card
   */
  deleteCard(cardId: string): boolean {
    const card = evidenceCards.get(cardId);
    if (!card) {
      return false;
    }

    // Remove from indexes
    if (card.projectId) {
      cardsByProject.get(card.projectId)?.delete(cardId);
    }
    if (card.researchId) {
      cardsByResearch.get(card.researchId)?.delete(cardId);
    }

    evidenceCards.delete(cardId);
    return true;
  }

  /**
   * List evidence cards
   */
  listCards(options: {
    projectId?: string;
    researchId?: string;
    limit?: number;
    offset?: number;
  } = {}): EvidenceCard[] {
    let cards: EvidenceCard[] = [];

    if (options.projectId) {
      const cardIds = cardsByProject.get(options.projectId);
      if (cardIds) {
        cards = Array.from(cardIds)
          .map((id) => evidenceCards.get(id))
          .filter((c): c is EvidenceCard => c !== undefined);
      }
    } else if (options.researchId) {
      const cardIds = cardsByResearch.get(options.researchId);
      if (cardIds) {
        cards = Array.from(cardIds)
          .map((id) => evidenceCards.get(id))
          .filter((c): c is EvidenceCard => c !== undefined);
      }
    } else {
      cards = Array.from(evidenceCards.values());
    }

    // Sort by creation date (newest first)
    cards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options.offset || 0;
    const limit = options.limit || 50;

    return cards.slice(offset, offset + limit);
  }

  /**
   * Get statistics for evidence cards
   */
  getStats(options: { projectId?: string; researchId?: string } = {}): {
    totalCards: number;
    verifiedCards: number;
    averageConfidence: number;
    byExtractionMethod: Record<string, number>;
  } {
    const cards = this.listCards(options);

    const verifiedCards = cards.filter((c) => c.verifiedAt !== undefined);
    const averageConfidence =
      cards.length > 0
        ? cards.reduce((sum, c) => sum + c.confidence, 0) / cards.length
        : 0;

    const byExtractionMethod: Record<string, number> = {};
    for (const card of cards) {
      const method = card.extractionMethod || 'unknown';
      byExtractionMethod[method] = (byExtractionMethod[method] || 0) + 1;
    }

    return {
      totalCards: cards.length,
      verifiedCards: verifiedCards.length,
      averageConfidence,
      byExtractionMethod,
    };
  }
}

/**
 * Singleton instance
 */
let instance: EvidenceService | null = null;

export function getEvidenceService(): EvidenceService {
  if (!instance) {
    instance = new EvidenceService();
  }
  return instance;
}
