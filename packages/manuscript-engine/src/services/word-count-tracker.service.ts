/**
 * Word Count Tracker Service
 * Task T50: Track word counts against section limits
 */

import type { SectionContent, WordCountLimits } from '../types';

// Re-export for consumers
export type { SectionContent, WordCountLimits };

export interface WordCountTrackerRequest {
  manuscriptId: string;
  sections: SectionContent[];
  limits: WordCountLimits;
}

export interface WordCountReport {
  manuscriptId: string;
  sections: SectionWordCount[];
  totalWords: number;
  totalLimit?: { min?: number; max?: number };
  withinLimits: boolean;
  warnings: string[];
  createdAt: Date;
}

export interface SectionWordCount {
  sectionType: string;
  wordCount: number;
  characterCount: number;
  limit?: { min?: number; max?: number };
  status: 'under' | 'within' | 'over';
  percentage?: number; // Percentage of limit used
}

/**
 * Word Count Tracker Service
 * Tracks manuscript word counts against journal limits
 */
export class WordCountTrackerService {
  trackWordCount(request: WordCountTrackerRequest): WordCountReport {
    const sections: SectionWordCount[] = [];
    let totalWords = 0;

    for (const section of request.sections) {
      const wordCount = this.countWords(section.content);
      const characterCount = section.content.length;
      totalWords += wordCount;

      const limit = request.limits[section.sectionType as keyof WordCountLimits] as { min?: number; max?: number } | undefined;

      let status: SectionWordCount['status'] = 'within';
      let percentage: number | undefined;

      if (limit) {
        if (limit.min && wordCount < limit.min) {
          status = 'under';
        } else if (limit.max && wordCount > limit.max) {
          status = 'over';
        }

        if (limit.max) {
          percentage = (wordCount / limit.max) * 100;
        }
      }

      sections.push({
        sectionType: section.sectionType,
        wordCount,
        characterCount,
        limit,
        status,
        percentage,
      });
    }

    const warnings = this.generateWarnings(sections, totalWords, request.limits.total);
    const withinLimits = warnings.length === 0;

    return {
      manuscriptId: request.manuscriptId,
      sections,
      totalWords,
      totalLimit: request.limits.total,
      withinLimits,
      warnings,
      createdAt: new Date(),
    };
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  private generateWarnings(
    sections: SectionWordCount[],
    totalWords: number,
    totalLimit?: { min?: number; max?: number }
  ): string[] {
    const warnings: string[] = [];

    // Check section limits
    for (const section of sections) {
      if (section.status === 'over') {
        warnings.push(`${section.sectionType} exceeds limit: ${section.wordCount}/${section.limit?.max} words`);
      } else if (section.status === 'under') {
        warnings.push(`${section.sectionType} under minimum: ${section.wordCount}/${section.limit?.min} words`);
      }
    }

    // Check total limit
    if (totalLimit) {
      if (totalLimit.min && totalWords < totalLimit.min) {
        warnings.push(`Total word count under minimum: ${totalWords}/${totalLimit.min} words`);
      }
      if (totalLimit.max && totalWords > totalLimit.max) {
        warnings.push(`Total word count exceeds maximum: ${totalWords}/${totalLimit.max} words`);
      }
    }

    return warnings;
  }

  /**
   * Get real-time word count for live editing
   */
  getRealTimeCount(text: string): { words: number; characters: number; charactersNoSpaces: number } {
    const words = this.countWords(text);
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s+/g, '').length;

    return { words, characters, charactersNoSpaces };
  }

  /**
   * Estimate reading time
   */
  estimateReadingTime(wordCount: number): { minutes: number; seconds: number } {
    const wordsPerMinute = 200; // Average reading speed
    const totalSeconds = Math.ceil((wordCount / wordsPerMinute) * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return { minutes, seconds };
  }
}

export const wordCountTrackerService = new WordCountTrackerService();
