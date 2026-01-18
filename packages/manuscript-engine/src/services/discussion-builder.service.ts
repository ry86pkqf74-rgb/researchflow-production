/**
 * Discussion Builder Service
 * Task T46: Build Discussion section structure
 */

export interface DiscussionBuilderRequest {
  manuscriptId: string;
  mainFinding: string;
  studyStrengths?: string[];
  studyLimitations?: string[];
  comparisonCitations?: string[]; // Citations for literature comparison
  implications?: {
    clinical?: string;
    research?: string;
    policy?: string;
  };
}

export interface BuiltDiscussion {
  manuscriptId: string;
  sections: DiscussionSection[];
  fullText: string;
  wordCount: number;
  structure: 'standard' | 'strengths_limitations' | 'narrative';
  citationPlaceholders: number;
  createdAt: Date;
}

export interface DiscussionSection {
  type: 'key_findings' | 'comparison' | 'strengths' | 'limitations' | 'implications' | 'conclusions';
  heading: string;
  content: string;
  wordCount: number;
  order: number;
}

/**
 * Discussion Builder Service
 * Constructs Discussion section following standard structure
 */
export class DiscussionBuilderService {
  async buildDiscussion(request: DiscussionBuilderRequest): Promise<BuiltDiscussion> {
    const sections: DiscussionSection[] = [];

    // 1. Key Findings (1-2 paragraphs)
    sections.push(this.buildKeyFindingsSection(request));

    // 2. Comparison with Literature (2-3 paragraphs)
    sections.push(this.buildComparisonSection(request));

    // 3. Strengths
    sections.push(this.buildStrengthsSection(request));

    // 4. Limitations
    sections.push(this.buildLimitationsSection(request));

    // 5. Implications
    sections.push(this.buildImplicationsSection(request));

    // 6. Conclusions (final paragraph)
    sections.push(this.buildConclusionsSection(request));

    const fullText = sections.map(s => `### ${s.heading}\n\n${s.content}`).join('\n\n');
    const wordCount = fullText.split(/\s+/).length;
    const citationPlaceholders = (fullText.match(/\[\d+\]/g) || []).length;

    return {
      manuscriptId: request.manuscriptId,
      sections,
      fullText,
      wordCount,
      structure: 'standard',
      citationPlaceholders,
      createdAt: new Date(),
    };
  }

  private buildKeyFindingsSection(request: DiscussionBuilderRequest): DiscussionSection {
    return {
      type: 'key_findings',
      heading: 'Key Findings',
      content: `In this study, we found that ${request.mainFinding}. This finding [is/is not] consistent with our hypothesis and [adds to/challenges] current understanding of [topic]. [Restate main result without introducing new data or statistics.]`,
      wordCount: 0,
      order: 1,
    };
  }

  private buildComparisonSection(request: DiscussionBuilderRequest): DiscussionSection {
    const content = request.comparisonCitations && request.comparisonCitations.length > 0
      ? `Our findings are consistent with [Author et al. [1]] who reported [similar finding]. However, [Author et al. [2]] found [different result], which may be explained by [methodological differences, different populations, etc.]. [Synthesize how your results fit into the broader literature.]`
      : `[Compare your findings with prior studies. Explain similarities and differences. Provide potential explanations for discrepancies. Cite relevant literature.]`;

    return {
      type: 'comparison',
      heading: 'Comparison with Literature',
      content,
      wordCount: 0,
      order: 2,
    };
  }

  private buildStrengthsSection(request: DiscussionBuilderRequest): DiscussionSection {
    let content = '';

    if (request.studyStrengths && request.studyStrengths.length > 0) {
      const strengthsList = request.studyStrengths.map(s => `• ${s}`).join('\n');
      content = `This study has several strengths:\n\n${strengthsList}\n\n[Explain why each strength is important and how it enhances confidence in results.]`;
    } else {
      content = `This study has several strengths. [List 2-4 key strengths: large sample size, prospective design, validated measures, diverse population, long follow-up, etc. Explain why each matters.]`;
    }

    return {
      type: 'strengths',
      heading: 'Strengths',
      content,
      wordCount: 0,
      order: 3,
    };
  }

  private buildLimitationsSection(request: DiscussionBuilderRequest): DiscussionSection {
    let content = '';

    if (request.studyLimitations && request.studyLimitations.length > 0) {
      const limitationsList = request.studyLimitations.map(l => `• ${l}`).join('\n');
      content = `This study has limitations that should be acknowledged:\n\n${limitationsList}\n\n[Explain how each limitation may affect interpretation of results. Discuss potential for bias or confounding.]`;
    } else {
      content = `This study has several limitations. First, [limitation and its impact]. Second, [limitation and its impact]. Third, [limitation and its impact]. [Be honest and specific. Explain how limitations affect generalizability or internal validity.]`;
    }

    return {
      type: 'limitations',
      heading: 'Limitations',
      content,
      wordCount: 0,
      order: 4,
    };
  }

  private buildImplicationsSection(request: DiscussionBuilderRequest): DiscussionSection {
    let content = 'Our findings have important implications.\n\n';

    if (request.implications?.clinical) {
      content += `**Clinical Implications**: ${request.implications.clinical}\n\n`;
    } else {
      content += `**Clinical Implications**: [How might these findings change clinical practice? What should clinicians do differently?]\n\n`;
    }

    if (request.implications?.research) {
      content += `**Research Implications**: ${request.implications.research}\n\n`;
    } else {
      content += `**Research Implications**: [What future studies are needed? What questions remain unanswered?]\n\n`;
    }

    if (request.implications?.policy) {
      content += `**Policy Implications**: ${request.implications.policy}`;
    }

    return {
      type: 'implications',
      heading: 'Implications',
      content,
      wordCount: 0,
      order: 5,
    };
  }

  private buildConclusionsSection(request: DiscussionBuilderRequest): DiscussionSection {
    return {
      type: 'conclusions',
      heading: 'Conclusions',
      content: `In conclusion, ${request.mainFinding}. These findings [clinical or research significance]. Further research is needed to [future directions]. [Keep brief, 2-3 sentences. Do not introduce new information. Avoid overstating conclusions.]`,
      wordCount: 0,
      order: 6,
    };
  }
}

export const discussionBuilderService = new DiscussionBuilderService();
