import type { Citation } from '../types/citation.types';

export interface LitReviewConfig {
  manuscriptId: string;
  topic: string;
  citations: Citation[];
  style: 'narrative' | 'thematic' | 'chronological' | 'methodological';
  maxLength: number; // words
  includeGapAnalysis?: boolean;
}

export interface LitReviewSection {
  heading?: string;
  content: string;
  citationIds: string[];
  wordCount: number;
}

export interface GeneratedLitReview {
  sections: LitReviewSection[];
  gapAnalysis?: string;
  totalWordCount: number;
  citationsUsed: string[];
  suggestedAdditionalCitations?: string[];
}

export interface ThemeCluster {
  theme: string;
  citations: Citation[];
  summary: string;
  consensus?: string;
  controversies?: string[];
}

export class LitReviewService {
  async generateReview(config: LitReviewConfig): Promise<GeneratedLitReview> {
    const clusters = this.clusterByTheme(config.citations);
    const sections = await this.generateSections(clusters, config);

    let gapAnalysis: string | undefined;
    if (config.includeGapAnalysis) {
      gapAnalysis = await this.generateGapAnalysis(config.topic, config.citations);
    }

    return {
      sections: sections.map(s => ({
        ...s,
        wordCount: this.countWords(s.content)
      })),
      gapAnalysis,
      totalWordCount: sections.reduce((sum, s) => sum + this.countWords(s.content), 0),
      citationsUsed: config.citations.map(c => c.id),
      suggestedAdditionalCitations: []
    };
  }

  clusterByTheme(citations: Citation[]): ThemeCluster[] {
    const termFrequency = new Map<string, Citation[]>();

    for (const citation of citations) {
      const terms = [
        ...(citation.keywords || []),
        ...(citation.meshTerms || [])
      ];

      for (const term of terms) {
        const normalized = term.toLowerCase();
        const existing = termFrequency.get(normalized) || [];
        existing.push(citation);
        termFrequency.set(normalized, existing);
      }
    }

    const themes: ThemeCluster[] = [];
    const usedCitations = new Set<string>();

    const sortedTerms = Array.from(termFrequency.entries())
      .filter(([_, cites]) => cites.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [theme, themeCitations] of sortedTerms) {
      const newCitations = themeCitations.filter(c => !usedCitations.has(c.id));

      if (newCitations.length >= 2) {
        newCitations.forEach(c => usedCitations.add(c.id));

        themes.push({
          theme: this.formatThemeName(theme),
          citations: newCitations,
          summary: this.summarizeTheme(newCitations)
        });
      }

      if (themes.length >= 5) break;
    }

    const remaining = citations.filter(c => !usedCitations.has(c.id));
    if (remaining.length > 0) {
      themes.push({
        theme: 'Other Relevant Studies',
        citations: remaining,
        summary: this.summarizeTheme(remaining)
      });
    }

    return themes;
  }

  private async generateSections(
    clusters: ThemeCluster[],
    config: LitReviewConfig
  ): Promise<LitReviewSection[]> {
    switch (config.style) {
      case 'thematic':
        return this.generateThematicSections(clusters);
      case 'chronological':
        return this.generateChronologicalSections(config.citations);
      case 'methodological':
        return this.generateMethodologicalSections(config.citations);
      case 'narrative':
      default:
        return this.generateNarrativeSections(clusters, config.topic);
    }
  }

  private generateThematicSections(clusters: ThemeCluster[]): LitReviewSection[] {
    return clusters.map(cluster => ({
      heading: cluster.theme,
      content: this.writeThematicParagraph(cluster),
      citationIds: cluster.citations.map(c => c.id),
      wordCount: 0
    }));
  }

  private generateChronologicalSections(citations: Citation[]): LitReviewSection[] {
    const sorted = [...citations].sort((a, b) => a.year - b.year);
    const periods = new Map<string, Citation[]>();

    for (const citation of sorted) {
      const period = Math.floor(citation.year / 5) * 5;
      const key = `${period}-${period + 4}`;
      const existing = periods.get(key) || [];
      existing.push(citation);
      periods.set(key, existing);
    }

    return Array.from(periods.entries()).map(([period, cites]) => ({
      heading: `Studies from ${period}`,
      content: this.writeChronologicalParagraph(cites),
      citationIds: cites.map(c => c.id),
      wordCount: 0
    }));
  }

  private generateMethodologicalSections(citations: Citation[]): LitReviewSection[] {
    const designs = new Map<string, Citation[]>();

    for (const citation of citations) {
      const design = this.inferStudyDesign(citation);
      const existing = designs.get(design) || [];
      existing.push(citation);
      designs.set(design, existing);
    }

    return Array.from(designs.entries()).map(([design, cites]) => ({
      heading: `${design} Studies`,
      content: this.writeMethodologicalParagraph(design, cites),
      citationIds: cites.map(c => c.id),
      wordCount: 0
    }));
  }

  private generateNarrativeSections(clusters: ThemeCluster[], topic: string): LitReviewSection[] {
    const sections: LitReviewSection[] = [];

    sections.push({
      heading: undefined,
      content: `The literature on ${topic} has evolved considerably over recent years. ` +
               `This review synthesizes findings from ${clusters.reduce((sum, c) => sum + c.citations.length, 0)} studies.`,
      citationIds: [],
      wordCount: 0
    });

    for (const cluster of clusters) {
      sections.push({
        heading: cluster.theme,
        content: this.writeThematicParagraph(cluster),
        citationIds: cluster.citations.map(c => c.id),
        wordCount: 0
      });
    }

    return sections;
  }

  private async generateGapAnalysis(topic: string, citations: Citation[]): Promise<string> {
    const coveredAreas = new Set<string>();

    for (const citation of citations) {
      (citation.keywords || []).forEach(k => coveredAreas.add(k.toLowerCase()));
      (citation.meshTerms || []).forEach(m => coveredAreas.add(m.toLowerCase()));
    }

    return `Based on the reviewed literature, several gaps remain in our understanding of ${topic}. ` +
           `Future research should address these limitations to provide more comprehensive evidence.`;
  }

  private writeThematicParagraph(cluster: ThemeCluster): string {
    const citations = cluster.citations;
    const firstAuthor = citations[0]?.authors[0]?.lastName || 'Authors';

    let paragraph = `Research on ${cluster.theme.toLowerCase()} has been examined by several investigators. `;

    if (citations.length === 1) {
      paragraph += `${firstAuthor} et al. (${citations[0].year}) reported findings in this area.`;
    } else {
      paragraph += `${firstAuthor} et al. (${citations[0].year}) and others have contributed to this body of knowledge.`;
    }

    return paragraph;
  }

  private writeChronologicalParagraph(citations: Citation[]): string {
    const firstAuthor = citations[0]?.authors[0]?.lastName || 'Authors';
    return `During this period, ${citations.length} studies were published, including ${firstAuthor} et al. (${citations[0].year}).`;
  }

  private writeMethodologicalParagraph(design: string, citations: Citation[]): string {
    return `${design} studies (n=${citations.length}) have provided valuable insights into this topic.`;
  }

  private inferStudyDesign(citation: Citation): string {
    const abstract = citation.abstract?.toLowerCase() || '';
    const title = citation.title.toLowerCase();

    if (abstract.includes('randomized') || title.includes('rct')) return 'Randomized Controlled Trial';
    if (abstract.includes('cohort')) return 'Cohort';
    if (abstract.includes('case-control')) return 'Case-Control';
    if (abstract.includes('systematic review')) return 'Systematic Review';
    if (abstract.includes('meta-analysis')) return 'Meta-Analysis';

    return 'Observational';
  }

  private formatThemeName(theme: string): string {
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  }

  private summarizeTheme(citations: Citation[]): string {
    return `${citations.length} studies examined this theme.`;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

export const litReviewService = new LitReviewService();
