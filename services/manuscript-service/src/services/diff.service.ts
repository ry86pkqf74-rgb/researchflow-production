/**
 * Diff Service
 * Generates diffs between manuscript versions (Task 64)
 */

import { diffLines, diffWords } from 'diff';
import type { ManuscriptContent } from '../types/api.types';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffSummary {
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  addedWords: number;
  removedWords: number;
}

export interface DiffResult {
  diff: DiffLine[];
  summary: DiffSummary;
  sectionDiffs: Record<string, DiffLine[]>;
}

export class DiffService {
  /**
   * Generate diff between two manuscript versions
   */
  generateDiff(oldContent: ManuscriptContent, newContent: ManuscriptContent): DiffResult {
    const sectionDiffs: Record<string, DiffLine[]> = {};
    const allDiffs: DiffLine[] = [];
    let totalAddedLines = 0;
    let totalRemovedLines = 0;
    let totalUnchangedLines = 0;
    let totalAddedWords = 0;
    let totalRemovedWords = 0;

    // Compare title
    if (oldContent.title !== newContent.title) {
      const titleDiff = this.diffSection('title', oldContent.title, newContent.title);
      sectionDiffs.title = titleDiff.lines;
      allDiffs.push(...titleDiff.lines);
      totalAddedLines += titleDiff.added;
      totalRemovedLines += titleDiff.removed;
      totalAddedWords += titleDiff.addedWords;
      totalRemovedWords += titleDiff.removedWords;
    }

    // Compare each section
    const sections = ['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion', 'acknowledgements'] as const;

    for (const section of sections) {
      const oldText = oldContent.sections?.[section] || '';
      const newText = newContent.sections?.[section] || '';

      if (oldText !== newText) {
        const sectionDiff = this.diffSection(section, oldText, newText);
        sectionDiffs[section] = sectionDiff.lines;
        allDiffs.push(...sectionDiff.lines);
        totalAddedLines += sectionDiff.added;
        totalRemovedLines += sectionDiff.removed;
        totalUnchangedLines += sectionDiff.unchanged;
        totalAddedWords += sectionDiff.addedWords;
        totalRemovedWords += sectionDiff.removedWords;
      }
    }

    return {
      diff: allDiffs,
      summary: {
        addedLines: totalAddedLines,
        removedLines: totalRemovedLines,
        unchangedLines: totalUnchangedLines,
        addedWords: totalAddedWords,
        removedWords: totalRemovedWords,
      },
      sectionDiffs,
    };
  }

  /**
   * Diff a single section
   */
  private diffSection(sectionName: string, oldText: string, newText: string): {
    lines: DiffLine[];
    added: number;
    removed: number;
    unchanged: number;
    addedWords: number;
    removedWords: number;
  } {
    const lines: DiffLine[] = [];
    let addedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;
    let addedWords = 0;
    let removedWords = 0;

    // Add section header
    lines.push({
      type: 'unchanged',
      content: `=== ${sectionName.toUpperCase()} ===`,
    });

    // Line-based diff
    const lineDiffs = diffLines(oldText, newText);
    let oldLineNum = 1;
    let newLineNum = 1;

    for (const part of lineDiffs) {
      const partLines = part.value.split('\n').filter(line => line !== '' || part.value === '\n');

      for (const line of partLines) {
        if (part.added) {
          lines.push({
            type: 'added',
            content: line,
            newLineNumber: newLineNum++,
          });
          addedCount++;
          addedWords += this.countWords(line);
        } else if (part.removed) {
          lines.push({
            type: 'removed',
            content: line,
            oldLineNumber: oldLineNum++,
          });
          removedCount++;
          removedWords += this.countWords(line);
        } else {
          lines.push({
            type: 'unchanged',
            content: line,
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++,
          });
          unchangedCount++;
        }
      }
    }

    return {
      lines,
      added: addedCount,
      removed: removedCount,
      unchanged: unchangedCount,
      addedWords,
      removedWords,
    };
  }

  /**
   * Count words in a string
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Generate inline word diff for a line
   */
  generateInlineDiff(oldLine: string, newLine: string): Array<{
    type: 'added' | 'removed' | 'unchanged';
    value: string;
  }> {
    const wordDiffs = diffWords(oldLine, newLine);
    return wordDiffs.map(part => ({
      type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
      value: part.value,
    }));
  }

  /**
   * Generate a summary string for the diff
   */
  generateSummaryText(summary: DiffSummary): string {
    const parts: string[] = [];

    if (summary.addedLines > 0) {
      parts.push(`+${summary.addedLines} lines added`);
    }
    if (summary.removedLines > 0) {
      parts.push(`-${summary.removedLines} lines removed`);
    }
    if (summary.addedWords > 0) {
      parts.push(`+${summary.addedWords} words`);
    }
    if (summary.removedWords > 0) {
      parts.push(`-${summary.removedWords} words`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No changes';
  }
}

export const diffService = new DiffService();
