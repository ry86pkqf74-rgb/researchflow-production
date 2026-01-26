/**
 * Readability Service
 *
 * Calculates readability metrics: Flesch-Kincaid, Gunning Fog, etc.
 */

import type { ReadabilityMetrics } from '../types';

export class ReadabilityService {
  /**
   * Calculate comprehensive readability metrics
   */
  calculateMetrics(text: string): ReadabilityMetrics {
    const sentences = this.countSentences(text);
    const words = this.countWords(text);
    const syllables = this.countSyllables(text);
    const complexWords = this.countComplexWords(text);
    const characters = this.countCharacters(text);

    const avgSentenceLength = words / sentences;
    const avgWordLength = characters / words;
    const complexWordPct = (complexWords / words) * 100;

    return {
      fleschKincaidGrade: this.calculateFleschKincaidGrade(
        words,
        sentences,
        syllables
      ),
      fleschReadingEase: this.calculateFleschReadingEase(words, sentences, syllables),
      gunningFogIndex: this.calculateGunningFog(words, sentences, complexWords),
      colemanLiauIndex: this.calculateColemanLiau(words, sentences, characters),
      smogIndex: this.calculateSMOG(sentences, complexWords),
      automatedReadabilityIndex: this.calculateARI(words, sentences, characters),
      averageSentenceLength: avgSentenceLength,
      averageWordLength: avgWordLength,
      complexWordPercentage: complexWordPct,
      recommendation: this.generateRecommendation({
        fleschKincaidGrade: 0,
        fleschReadingEase: 0,
        gunningFogIndex: 0,
        colemanLiauIndex: 0,
        smogIndex: 0,
        automatedReadabilityIndex: 0,
        averageSentenceLength: avgSentenceLength,
        averageWordLength: avgWordLength,
        complexWordPercentage: complexWordPct,
        recommendation: '',
      }),
    };
  }

  /**
   * Flesch-Kincaid Grade Level
   */
  private calculateFleschKincaidGrade(
    words: number,
    sentences: number,
    syllables: number
  ): number {
    if (sentences === 0 || words === 0) return 0;
    return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  }

  /**
   * Flesch Reading Ease
   */
  private calculateFleschReadingEase(
    words: number,
    sentences: number,
    syllables: number
  ): number {
    if (sentences === 0 || words === 0) return 0;
    return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  }

  /**
   * Gunning Fog Index
   */
  private calculateGunningFog(
    words: number,
    sentences: number,
    complexWords: number
  ): number {
    if (sentences === 0 || words === 0) return 0;
    return 0.4 * ((words / sentences) + 100 * (complexWords / words));
  }

  /**
   * Coleman-Liau Index
   */
  private calculateColemanLiau(
    words: number,
    sentences: number,
    characters: number
  ): number {
    if (words === 0) return 0;
    const L = (characters / words) * 100; // Average characters per 100 words
    const S = (sentences / words) * 100; // Average sentences per 100 words
    return 0.0588 * L - 0.296 * S - 15.8;
  }

  /**
   * SMOG Index
   */
  private calculateSMOG(sentences: number, complexWords: number): number {
    if (sentences === 0) return 0;
    return 1.0430 * Math.sqrt(complexWords * (30 / sentences)) + 3.1291;
  }

  /**
   * Automated Readability Index
   */
  private calculateARI(words: number, sentences: number, characters: number): number {
    if (sentences === 0 || words === 0) return 0;
    return 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43;
  }

  /**
   * Count sentences
   */
  private countSentences(text: string): number {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    return Math.max(sentences.length, 1);
  }

  /**
   * Count words
   */
  private countWords(text: string): number {
    const words = text.match(/\b\w+\b/g);
    return words ? words.length : 0;
  }

  /**
   * Count syllables (simplified algorithm)
   */
  private countSyllables(text: string): number {
    const words = text.match(/\b\w+\b/g);
    if (!words) return 0;

    return words.reduce((total, word) => {
      return total + this.countSyllablesInWord(word.toLowerCase());
    }, 0);
  }

  /**
   * Count syllables in a single word
   */
  private countSyllablesInWord(word: string): number {
    word = word.toLowerCase();

    if (word.length <= 3) return 1;

    // Remove silent 'e'
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');

    // Remove trailing y preceded by consonant
    word = word.replace(/^y/, '');

    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]{1,2}/g);
    return vowelGroups ? vowelGroups.length : 1;
  }

  /**
   * Count complex words (3+ syllables)
   */
  private countComplexWords(text: string): number {
    const words = text.match(/\b\w+\b/g);
    if (!words) return 0;

    return words.filter((word) => this.countSyllablesInWord(word.toLowerCase()) >= 3)
      .length;
  }

  /**
   * Count characters (excluding spaces)
   */
  private countCharacters(text: string): number {
    return text.replace(/\s/g, '').length;
  }

  /**
   * Generate recommendation based on metrics
   */
  private generateRecommendation(metrics: ReadabilityMetrics): string {
    const fkGrade = this.calculateFleschKincaidGrade(
      this.countWords(''),
      this.countSentences(''),
      this.countSyllables('')
    );

    // Medical manuscripts typically target 12-16 grade level
    if (fkGrade < 10) {
      return 'Text may be too simple for a medical research manuscript. Consider using more technical terminology where appropriate.';
    } else if (fkGrade >= 10 && fkGrade <= 16) {
      return 'Readability is appropriate for a medical research manuscript.';
    } else if (fkGrade > 16 && fkGrade <= 20) {
      return 'Text is quite complex. Ensure clarity is not sacrificed for technical language.';
    } else {
      return 'Text is very complex. Consider simplifying sentence structures while maintaining scientific rigor.';
    }
  }

  /**
   * Get readability grade interpretation
   */
  getGradeInterpretation(grade: number): string {
    if (grade < 6) return 'Elementary school level';
    if (grade < 9) return 'Middle school level';
    if (grade < 13) return 'High school level';
    if (grade < 16) return 'College level';
    if (grade < 18) return 'Graduate level';
    return 'Professional/Academic level';
  }

  /**
   * Get Flesch Reading Ease interpretation
   */
  getReadingEaseInterpretation(score: number): string {
    if (score >= 90) return 'Very Easy (5th grade)';
    if (score >= 80) return 'Easy (6th grade)';
    if (score >= 70) return 'Fairly Easy (7th grade)';
    if (score >= 60) return 'Standard (8th-9th grade)';
    if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
    if (score >= 30) return 'Difficult (College)';
    return 'Very Difficult (Graduate)';
  }

  /**
   * Compare metrics to target ranges for medical manuscripts
   */
  compareToTarget(metrics: ReadabilityMetrics): {
    metric: string;
    value: number;
    target: string;
    status: 'below' | 'within' | 'above';
  }[] {
    const comparisons = [
      {
        metric: 'Flesch-Kincaid Grade',
        value: metrics.fleschKincaidGrade,
        target: '12-16',
        status: this.getStatus(metrics.fleschKincaidGrade, 12, 16),
      },
      {
        metric: 'Average Sentence Length',
        value: metrics.averageSentenceLength,
        target: '15-25 words',
        status: this.getStatus(metrics.averageSentenceLength, 15, 25),
      },
      {
        metric: 'Complex Word Percentage',
        value: metrics.complexWordPercentage,
        target: '20-40%',
        status: this.getStatus(metrics.complexWordPercentage, 20, 40),
      },
    ];

    return comparisons;
  }

  /**
   * Get status relative to target range
   */
  private getStatus(value: number, min: number, max: number): 'below' | 'within' | 'above' {
    if (value < min) return 'below';
    if (value > max) return 'above';
    return 'within';
  }

  /**
   * Generate comprehensive readability report
   */
  generateReport(metrics: ReadabilityMetrics): string {
    let report = `Readability Analysis Report\n\n`;

    report += `Core Metrics:\n`;
    report += `- Flesch-Kincaid Grade Level: ${metrics.fleschKincaidGrade.toFixed(
      1
    )} (${this.getGradeInterpretation(metrics.fleschKincaidGrade)})\n`;
    report += `- Flesch Reading Ease: ${metrics.fleschReadingEase.toFixed(
      1
    )} (${this.getReadingEaseInterpretation(metrics.fleschReadingEase)})\n`;
    report += `- Gunning Fog Index: ${metrics.gunningFogIndex.toFixed(1)}\n`;
    report += `- Coleman-Liau Index: ${metrics.colemanLiauIndex.toFixed(1)}\n`;
    report += `- SMOG Index: ${metrics.smogIndex.toFixed(1)}\n`;
    report += `- Automated Readability Index: ${metrics.automatedReadabilityIndex.toFixed(
      1
    )}\n\n`;

    report += `Text Statistics:\n`;
    report += `- Average Sentence Length: ${metrics.averageSentenceLength.toFixed(
      1
    )} words\n`;
    report += `- Average Word Length: ${metrics.averageWordLength.toFixed(1)} characters\n`;
    report += `- Complex Words: ${metrics.complexWordPercentage.toFixed(1)}%\n\n`;

    report += `Recommendation:\n${metrics.recommendation}\n\n`;

    const comparisons = this.compareToTarget(metrics);
    report += `Target Comparison (Medical Manuscript Standards):\n`;
    comparisons.forEach((comp) => {
      const status =
        comp.status === 'within' ? '✓' : comp.status === 'below' ? '↓' : '↑';
      report += `${status} ${comp.metric}: ${comp.value.toFixed(1)} (Target: ${
        comp.target
      })\n`;
    });

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: ReadabilityService | null = null;

export function getReadability(): ReadabilityService {
  if (!instance) {
    instance = new ReadabilityService();
  }
  return instance;
}
