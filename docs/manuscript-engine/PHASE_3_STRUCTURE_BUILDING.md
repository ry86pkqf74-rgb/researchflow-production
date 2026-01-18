# Phase 3: Manuscript Structure Building (Tasks 41-60)

## Prerequisites

- Phase 1 & 2 completed (Data & Literature Integration)
- Citation types and services available
- Data mapping services functional

## Integration Points

- `packages/ai-router/` - For AI-assisted content generation
- `services/web/` - React components for UI
- `packages/manuscript-engine/src/templates/` - Template storage

---

## Task 41: IMRaD Templates

**File**: `packages/manuscript-engine/src/templates/imrad-templates.ts`

```typescript
import type { IMRaDSection, WordCountLimits, TemplatePlaceholder } from '../types/imrad.types';

export interface ManuscriptTemplate {
  id: string;
  name: string;
  type: 'imrad' | 'case_report' | 'systematic_review' | 'meta_analysis' | 'letter' | 'editorial';
  sections: TemplateSectionConfig[];
  wordLimits: WordCountLimits;
  requiredSections: IMRaDSection[];
  optionalSections: IMRaDSection[];
}

export interface TemplateSectionConfig {
  section: IMRaDSection;
  title: string;
  order: number;
  subsections?: SubsectionConfig[];
  placeholders: TemplatePlaceholder[];
  guidance: string;
  examples?: string[];
}

export interface SubsectionConfig {
  id: string;
  title: string;
  order: number;
  guidance: string;
  placeholders: TemplatePlaceholder[];
}

// Standard IMRaD Template
export const IMRAD_TEMPLATE: ManuscriptTemplate = {
  id: 'imrad-standard',
  name: 'Standard IMRaD Article',
  type: 'imrad',
  wordLimits: {
    abstract: { min: 200, max: 300 },
    introduction: { max: 800 },
    methods: { max: 1500 },
    results: { max: 1500 },
    discussion: { max: 1500 },
    total: { min: 3000, max: 5000 }
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments', 'appendices', 'supplementary'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [
        { id: 'title', label: 'Article Title', description: 'Concise, informative title (max 15 words)', required: true }
      ],
      guidance: 'Title should be specific, concise, and capture the main finding or topic.'
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      subsections: [
        { id: 'background', title: 'Background', order: 1, guidance: 'Context and rationale', placeholders: [] },
        { id: 'methods', title: 'Methods', order: 2, guidance: 'Study design and approach', placeholders: [] },
        { id: 'results', title: 'Results', order: 3, guidance: 'Key findings with numbers', placeholders: [] },
        { id: 'conclusions', title: 'Conclusions', order: 4, guidance: 'Main takeaway', placeholders: [] }
      ],
      placeholders: [
        { id: 'study_design', label: 'Study Design', description: 'e.g., randomized controlled trial', required: true },
        { id: 'sample_size', label: 'Sample Size', description: 'Total N', required: true, dataBinding: 'metadata.sampleSize' },
        { id: 'primary_outcome', label: 'Primary Outcome', description: 'Main result', required: true }
      ],
      guidance: 'Structured abstract with Background, Methods, Results, Conclusions. Max 300 words.'
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [
        { id: 'background', label: 'Background', description: 'What is known about the topic', required: true },
        { id: 'gap', label: 'Knowledge Gap', description: 'What remains unknown', required: true },
        { id: 'objective', label: 'Study Objective', description: 'What this study aims to do', required: true }
      ],
      guidance: 'Move from general to specific. End with clear study objective.',
      examples: [
        'Background: [Topic] is a significant health concern affecting [population].',
        'Gap: However, [specific aspect] remains poorly understood.',
        'Objective: We aimed to [specific objective] in [population].'
      ]
    },
    {
      section: 'methods',
      title: 'Methods',
      order: 4,
      subsections: [
        { id: 'study_design', title: 'Study Design and Setting', order: 1, guidance: 'Describe design, dates, location', placeholders: [] },
        { id: 'participants', title: 'Participants', order: 2, guidance: 'Inclusion/exclusion criteria', placeholders: [] },
        { id: 'variables', title: 'Variables', order: 3, guidance: 'Exposures, outcomes, covariates', placeholders: [] },
        { id: 'data_sources', title: 'Data Sources', order: 4, guidance: 'How data was collected', placeholders: [] },
        { id: 'statistical_methods', title: 'Statistical Methods', order: 5, guidance: 'Analysis approach', placeholders: [] },
        { id: 'ethics', title: 'Ethics', order: 6, guidance: 'IRB approval, consent', placeholders: [] }
      ],
      placeholders: [
        { id: 'design', label: 'Study Design', description: 'e.g., retrospective cohort', required: true },
        { id: 'setting', label: 'Setting', description: 'Institution, dates', required: true },
        { id: 'inclusion', label: 'Inclusion Criteria', description: 'Who was included', required: true },
        { id: 'exclusion', label: 'Exclusion Criteria', description: 'Who was excluded', required: false },
        { id: 'primary_outcome', label: 'Primary Outcome', description: 'Main outcome variable', required: true },
        { id: 'statistical_tests', label: 'Statistical Tests', description: 'Tests used', required: true }
      ],
      guidance: 'Sufficient detail for replication. Use past tense, passive voice.'
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      subsections: [
        { id: 'participant_flow', title: 'Participant Flow', order: 1, guidance: 'Screening, enrollment, follow-up', placeholders: [] },
        { id: 'baseline', title: 'Baseline Characteristics', order: 2, guidance: 'Table 1 description', placeholders: [] },
        { id: 'primary', title: 'Primary Outcomes', order: 3, guidance: 'Main findings', placeholders: [] },
        { id: 'secondary', title: 'Secondary Outcomes', order: 4, guidance: 'Other findings', placeholders: [] }
      ],
      placeholders: [
        { id: 'total_n', label: 'Total Analyzed', description: 'Final sample size', required: true, dataBinding: 'results.sampleSize' },
        { id: 'primary_result', label: 'Primary Result', description: 'Main finding with statistics', required: true }
      ],
      guidance: 'Present results without interpretation. Include exact p-values and confidence intervals.'
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      subsections: [
        { id: 'key_findings', title: 'Key Findings', order: 1, guidance: 'Summarize main results', placeholders: [] },
        { id: 'comparison', title: 'Comparison with Literature', order: 2, guidance: 'How results compare', placeholders: [] },
        { id: 'strengths', title: 'Strengths', order: 3, guidance: 'Study advantages', placeholders: [] },
        { id: 'limitations', title: 'Limitations', order: 4, guidance: 'Study weaknesses', placeholders: [] },
        { id: 'implications', title: 'Implications', order: 5, guidance: 'Clinical/research implications', placeholders: [] }
      ],
      placeholders: [
        { id: 'main_finding', label: 'Main Finding', description: 'Most important result', required: true },
        { id: 'limitations', label: 'Key Limitations', description: 'Main limitations', required: true }
      ],
      guidance: 'Interpret findings in context. Do not overstate conclusions.'
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'Format according to journal style. Check all citations are referenced and vice versa.'
    }
  ]
};

// Case Report Template
export const CASE_REPORT_TEMPLATE: ManuscriptTemplate = {
  id: 'case-report',
  name: 'Case Report',
  type: 'case_report',
  wordLimits: {
    abstract: { min: 100, max: 200 },
    total: { min: 1000, max: 2500 }
  },
  requiredSections: ['title', 'abstract', 'introduction', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [
        { id: 'title', label: 'Case Title', description: 'e.g., "A case of [condition] presenting with [unusual feature]"', required: true }
      ],
      guidance: 'Include diagnosis and key unique feature.'
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      placeholders: [],
      guidance: 'Brief summary: Introduction, Case Presentation, Conclusion.'
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [
        { id: 'condition', label: 'Condition', description: 'The condition being reported', required: true },
        { id: 'significance', label: 'Case Significance', description: 'Why this case is worth reporting', required: true }
      ],
      guidance: 'Brief background on condition. State why case is unique/educational.'
    },
    // Case Presentation (custom section)
    {
      section: 'methods', // Reusing methods section for case presentation
      title: 'Case Presentation',
      order: 4,
      subsections: [
        { id: 'demographics', title: 'Patient Demographics', order: 1, guidance: 'Age, sex, relevant history', placeholders: [] },
        { id: 'presentation', title: 'Presenting Complaint', order: 2, guidance: 'Chief complaint, timeline', placeholders: [] },
        { id: 'workup', title: 'Diagnostic Workup', order: 3, guidance: 'Labs, imaging, procedures', placeholders: [] },
        { id: 'treatment', title: 'Treatment', order: 4, guidance: 'Interventions performed', placeholders: [] },
        { id: 'outcome', title: 'Outcome', order: 5, guidance: 'Patient outcome, follow-up', placeholders: [] }
      ],
      placeholders: [],
      guidance: 'Chronological presentation. Include relevant negatives.'
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 5,
      placeholders: [],
      guidance: 'Compare with literature. Highlight learning points.'
    },
    {
      section: 'references',
      title: 'References',
      order: 6,
      placeholders: [],
      guidance: 'Typically 10-15 references maximum.'
    }
  ]
};

// Systematic Review Template
export const SYSTEMATIC_REVIEW_TEMPLATE: ManuscriptTemplate = {
  id: 'systematic-review',
  name: 'Systematic Review',
  type: 'systematic_review',
  wordLimits: {
    abstract: { min: 250, max: 400 },
    total: { min: 5000, max: 10000 }
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments', 'appendices', 'supplementary'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [],
      guidance: 'Include "systematic review" and/or "meta-analysis" in title.'
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      placeholders: [],
      guidance: 'PRISMA-compliant structured abstract.'
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [
        { id: 'rationale', label: 'Rationale', description: 'Why this review is needed', required: true },
        { id: 'objectives', label: 'Objectives', description: 'Review question (PICO format)', required: true }
      ],
      guidance: 'State rationale and objectives. Include PROSPERO registration if applicable.'
    },
    {
      section: 'methods',
      title: 'Methods',
      order: 4,
      subsections: [
        { id: 'protocol', title: 'Protocol and Registration', order: 1, guidance: 'PROSPERO ID, protocol publication', placeholders: [] },
        { id: 'eligibility', title: 'Eligibility Criteria', order: 2, guidance: 'PICO criteria', placeholders: [] },
        { id: 'sources', title: 'Information Sources', order: 3, guidance: 'Databases, dates searched', placeholders: [] },
        { id: 'search', title: 'Search Strategy', order: 4, guidance: 'Full search strategy (appendix)', placeholders: [] },
        { id: 'selection', title: 'Study Selection', order: 5, guidance: 'Screening process', placeholders: [] },
        { id: 'extraction', title: 'Data Extraction', order: 6, guidance: 'What data was extracted', placeholders: [] },
        { id: 'quality', title: 'Quality Assessment', order: 7, guidance: 'Risk of bias tool used', placeholders: [] },
        { id: 'synthesis', title: 'Data Synthesis', order: 8, guidance: 'Meta-analysis methods if applicable', placeholders: [] }
      ],
      placeholders: [],
      guidance: 'Follow PRISMA guidelines. Sufficient detail for replication.'
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      subsections: [
        { id: 'selection', title: 'Study Selection', order: 1, guidance: 'PRISMA flow diagram', placeholders: [] },
        { id: 'characteristics', title: 'Study Characteristics', order: 2, guidance: 'Summary of included studies', placeholders: [] },
        { id: 'quality', title: 'Quality Assessment', order: 3, guidance: 'Risk of bias results', placeholders: [] },
        { id: 'synthesis', title: 'Synthesis of Results', order: 4, guidance: 'Main findings, forest plots', placeholders: [] },
        { id: 'heterogeneity', title: 'Heterogeneity', order: 5, guidance: 'I² and subgroup analyses', placeholders: [] }
      ],
      placeholders: [],
      guidance: 'Include PRISMA flow diagram. Report heterogeneity.'
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      subsections: [
        { id: 'summary', title: 'Summary of Evidence', order: 1, guidance: 'Main findings', placeholders: [] },
        { id: 'strengths', title: 'Strengths and Limitations', order: 2, guidance: 'Review-level assessment', placeholders: [] },
        { id: 'implications', title: 'Implications', order: 3, guidance: 'For practice and research', placeholders: [] }
      ],
      placeholders: [],
      guidance: 'Discuss certainty of evidence. Address limitations at review level.'
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'Distinguish between included studies and other references.'
    }
  ]
};

// Export all templates
export const MANUSCRIPT_TEMPLATES: Record<string, ManuscriptTemplate> = {
  'imrad-standard': IMRAD_TEMPLATE,
  'case-report': CASE_REPORT_TEMPLATE,
  'systematic-review': SYSTEMATIC_REVIEW_TEMPLATE
};

export function getTemplate(templateId: string): ManuscriptTemplate | null {
  return MANUSCRIPT_TEMPLATES[templateId] || null;
}

export function getTemplateForType(type: ManuscriptTemplate['type']): ManuscriptTemplate | null {
  return Object.values(MANUSCRIPT_TEMPLATES).find(t => t.type === type) || null;
}
```

---

## Task 42: Abstract Generator Service

**File**: `packages/manuscript-engine/src/services/abstract-generator.service.ts`

```typescript
import type { StructuredAbstract, WordCountLimits } from '../types/imrad.types';
import { buildAbstractPrompt, ABSTRACT_SYSTEM_PROMPT } from '../prompts/abstract-generator.prompt';

export interface AbstractGeneratorConfig {
  manuscriptId: string;
  structured: boolean;
  wordLimit: number;
  studyType: string;
}

export interface AbstractInput {
  objectives: string;
  methods: string;
  keyResults: string[];
  primaryConclusion: string;
  sampleSize: number;
}

export interface GeneratedAbstract {
  text: string;
  structured?: StructuredAbstract;
  wordCount: number;
  warnings: string[];
}

export class AbstractGeneratorService {
  /**
   * Generate abstract from manuscript content
   */
  async generateFromContent(
    config: AbstractGeneratorConfig,
    input: AbstractInput
  ): Promise<GeneratedAbstract> {
    const prompt = buildAbstractPrompt({
      studyType: config.studyType,
      objectives: input.objectives,
      methods: input.methods,
      keyResults: input.keyResults,
      primaryConclusion: input.primaryConclusion,
      sampleSize: input.sampleSize,
      wordLimit: config.wordLimit
    }, config.structured);

    // This would call AI router in production
    const generatedText = await this.callAIRouter(prompt);
    
    const wordCount = this.countWords(generatedText);
    const warnings = this.validateAbstract(generatedText, config.wordLimit);

    if (config.structured) {
      const structured = this.parseStructuredAbstract(generatedText);
      return {
        text: this.combineStructuredAbstract(structured),
        structured,
        wordCount,
        warnings
      };
    }

    return {
      text: generatedText,
      wordCount,
      warnings
    };
  }

  /**
   * Extract abstract data from manuscript sections
   */
  extractAbstractData(manuscriptContent: Record<string, string>): AbstractInput {
    return {
      objectives: this.extractObjective(manuscriptContent.introduction || ''),
      methods: this.summarizeMethods(manuscriptContent.methods || ''),
      keyResults: this.extractKeyResults(manuscriptContent.results || ''),
      primaryConclusion: this.extractConclusion(manuscriptContent.discussion || ''),
      sampleSize: this.extractSampleSize(manuscriptContent.methods || manuscriptContent.results || '')
    };
  }

  /**
   * Validate abstract against guidelines
   */
  validateAbstract(text: string, wordLimit: number): string[] {
    const warnings: string[] = [];
    const wordCount = this.countWords(text);

    if (wordCount > wordLimit) {
      warnings.push(`Abstract exceeds word limit (${wordCount}/${wordLimit})`);
    }

    if (wordCount < wordLimit * 0.7) {
      warnings.push(`Abstract may be too short (${wordCount}/${wordLimit})`);
    }

    // Check for common issues
    if (text.includes('significant') && !text.includes('p')) {
      warnings.push('Claims of significance should include p-values');
    }

    if (text.includes('et al.') || text.includes('[')) {
      warnings.push('Abstracts should not contain citations');
    }

    if (/\b[A-Z]{2,}\b/.test(text) && !text.includes('(')) {
      warnings.push('Abbreviations should be defined on first use');
    }

    return warnings;
  }

  /**
   * Optimize abstract for word count
   */
  async optimizeForWordCount(
    text: string,
    targetWordCount: number
  ): Promise<string> {
    const currentCount = this.countWords(text);
    
    if (currentCount <= targetWordCount) {
      return text;
    }

    // Strategies for shortening:
    // 1. Remove redundant phrases
    // 2. Combine sentences
    // 3. Use more concise language
    
    // This would use AI in production
    return text; // Placeholder
  }

  private async callAIRouter(prompt: string): Promise<string> {
    // TODO: Integrate with ai-router package
    // For now, return a placeholder
    return 'Generated abstract text would appear here.';
  }

  private parseStructuredAbstract(text: string): StructuredAbstract {
    // Try to parse JSON response from AI
    try {
      const parsed = JSON.parse(text);
      return {
        background: parsed.background,
        objectives: parsed.objectives,
        methods: parsed.methods,
        results: parsed.results,
        conclusions: parsed.conclusions,
        trialRegistration: parsed.trialRegistration
      };
    } catch {
      // Fall back to section extraction
      return {
        methods: '',
        results: '',
        conclusions: ''
      };
    }
  }

  private combineStructuredAbstract(abstract: StructuredAbstract): string {
    const sections: string[] = [];
    
    if (abstract.background) {
      sections.push(`BACKGROUND: ${abstract.background}`);
    }
    if (abstract.objectives) {
      sections.push(`OBJECTIVES: ${abstract.objectives}`);
    }
    sections.push(`METHODS: ${abstract.methods}`);
    sections.push(`RESULTS: ${abstract.results}`);
    sections.push(`CONCLUSIONS: ${abstract.conclusions}`);
    
    if (abstract.trialRegistration) {
      sections.push(`TRIAL REGISTRATION: ${abstract.trialRegistration}`);
    }

    return sections.join('\n\n');
  }

  private extractObjective(introduction: string): string {
    // Look for objective statements
    const patterns = [
      /(?:we aimed to|our objective was to|this study aimed to|we sought to)\s+([^.]+)/i,
      /(?:the purpose of this study was to)\s+([^.]+)/i,
      /(?:objectives?:?\s*)([^.]+)/i
    ];

    for (const pattern of patterns) {
      const match = introduction.match(pattern);
      if (match) return match[1].trim();
    }

    // Return last sentence of introduction as fallback
    const sentences = introduction.split(/[.!?]+/).filter(s => s.trim());
    return sentences[sentences.length - 1]?.trim() || '';
  }

  private summarizeMethods(methods: string): string {
    // Extract key methodological elements
    const elements: string[] = [];

    // Study design
    const designMatch = methods.match(/(?:this was a|we conducted a|this)\s+([\w\s]+(?:study|trial|analysis))/i);
    if (designMatch) elements.push(designMatch[1]);

    // Sample size
    const sampleMatch = methods.match(/(\d+)\s*(?:patients?|participants?|subjects?)/i);
    if (sampleMatch) elements.push(`${sampleMatch[1]} participants`);

    return elements.join('. ') + '.';
  }

  private extractKeyResults(results: string): string[] {
    const keyResults: string[] = [];
    
    // Look for sentences with statistics
    const sentences = results.split(/[.!?]+/).filter(s => s.trim());
    
    for (const sentence of sentences) {
      if (/\d+\.?\d*\s*%|\bp\s*[<>=]|\bCI\b|\bOR\b|\bRR\b|\bHR\b/i.test(sentence)) {
        keyResults.push(sentence.trim());
      }
    }

    return keyResults.slice(0, 3); // Return top 3 results
  }

  private extractConclusion(discussion: string): string {
    // Look for conclusion statements
    const patterns = [
      /(?:in conclusion|we conclude that|our findings suggest|these results indicate)\s*,?\s*([^.]+)/i,
      /(?:conclusion:?\s*)([^.]+)/i
    ];

    for (const pattern of patterns) {
      const match = discussion.match(pattern);
      if (match) return match[1].trim();
    }

    // Return last sentence as fallback
    const sentences = discussion.split(/[.!?]+/).filter(s => s.trim());
    return sentences[sentences.length - 1]?.trim() || '';
  }

  private extractSampleSize(text: string): number {
    const patterns = [
      /(?:n\s*=\s*)(\d+)/i,
      /(\d+)\s*(?:patients?|participants?|subjects?)\s*(?:were|was)/i,
      /sample\s*(?:size|of)\s*(?:was\s*)?(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseInt(match[1], 10);
    }

    return 0;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

export const abstractGeneratorService = new AbstractGeneratorService();
```

---

## Task 43: Introduction Builder Service

**File**: `packages/manuscript-engine/src/services/introduction-builder.service.ts`

```typescript
import type { Citation } from '../types/citation.types';

export interface IntroductionStructure {
  background: IntroductionParagraph[];
  rationale: IntroductionParagraph;
  objectives: IntroductionParagraph;
}

export interface IntroductionParagraph {
  content: string;
  citations: string[]; // Citation IDs
  wordCount: number;
  type: 'general_background' | 'specific_background' | 'gap' | 'rationale' | 'objective';
}

export interface IntroductionBuilderInput {
  topic: string;
  specificFocus: string;
  researchGap: string;
  studyObjective: string;
  hypothesis?: string;
  relatedCitations: Citation[];
}

export class IntroductionBuilderService {
  /**
   * Build introduction from components
   */
  buildIntroduction(input: IntroductionBuilderInput): IntroductionStructure {
    const background = this.buildBackground(input);
    const rationale = this.buildRationale(input);
    const objectives = this.buildObjectives(input);

    return { background, rationale, objectives };
  }

  /**
   * Generate introduction text
   */
  generateIntroductionText(structure: IntroductionStructure): string {
    const paragraphs: string[] = [];

    // Background paragraphs (general to specific)
    for (const para of structure.background) {
      paragraphs.push(para.content);
    }

    // Rationale/gap paragraph
    paragraphs.push(structure.rationale.content);

    // Objectives paragraph
    paragraphs.push(structure.objectives.content);

    return paragraphs.join('\n\n');
  }

  /**
   * Validate introduction structure
   */
  validateIntroduction(structure: IntroductionStructure): {
    valid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for required components
    if (structure.background.length === 0) {
      issues.push('Missing background context');
    }

    if (!structure.rationale.content) {
      issues.push('Missing rationale/gap statement');
    }

    if (!structure.objectives.content) {
      issues.push('Missing study objectives');
    }

    // Check citation distribution
    const totalCitations = [
      ...structure.background.flatMap(b => b.citations),
      ...structure.rationale.citations,
      ...structure.objectives.citations
    ];

    if (totalCitations.length < 5) {
      suggestions.push('Consider adding more supporting citations');
    }

    // Check word count balance
    const bgWords = structure.background.reduce((sum, p) => sum + p.wordCount, 0);
    const totalWords = bgWords + structure.rationale.wordCount + structure.objectives.wordCount;

    if (bgWords > totalWords * 0.7) {
      suggestions.push('Background may be too long relative to rationale and objectives');
    }

    // Check flow from general to specific
    if (structure.background.length > 1) {
      const firstPara = structure.background[0];
      const lastPara = structure.background[structure.background.length - 1];
      
      if (firstPara.type !== 'general_background') {
        suggestions.push('Consider starting with broader context');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Suggest citations for introduction
   */
  suggestCitations(
    input: IntroductionBuilderInput,
    availableCitations: Citation[]
  ): {
    forBackground: Citation[];
    forRationale: Citation[];
  } {
    // Score citations by relevance to different parts
    const backgroundCitations: Citation[] = [];
    const rationaleCitations: Citation[] = [];

    for (const citation of availableCitations) {
      const titleLower = citation.title.toLowerCase();
      const abstractLower = (citation.abstract || '').toLowerCase();
      const topicLower = input.topic.toLowerCase();
      const gapLower = input.researchGap.toLowerCase();

      // Check relevance to background (reviews, epidemiology, general topic)
      const isReview = /review|meta-analysis|systematic/i.test(titleLower);
      const isEpid = /prevalence|incidence|burden|epidemiology/i.test(titleLower);
      const matchesTopic = titleLower.includes(topicLower) || abstractLower.includes(topicLower);

      if (isReview || isEpid || matchesTopic) {
        backgroundCitations.push(citation);
      }

      // Check relevance to gap/rationale
      const mentionsGap = abstractLower.includes(gapLower) || 
                          /limitation|gap|further research|needed/i.test(abstractLower);
      
      if (mentionsGap) {
        rationaleCitations.push(citation);
      }
    }

    return {
      forBackground: backgroundCitations.slice(0, 10),
      forRationale: rationaleCitations.slice(0, 5)
    };
  }

  private buildBackground(input: IntroductionBuilderInput): IntroductionParagraph[] {
    const paragraphs: IntroductionParagraph[] = [];

    // General background paragraph
    paragraphs.push({
      content: `${input.topic} represents an important area of clinical and research interest.`,
      citations: [],
      wordCount: 10,
      type: 'general_background'
    });

    // Specific background paragraph
    if (input.specificFocus) {
      paragraphs.push({
        content: `Specifically, ${input.specificFocus} has been the subject of increasing investigation.`,
        citations: [],
        wordCount: 12,
        type: 'specific_background'
      });
    }

    return paragraphs;
  }

  private buildRationale(input: IntroductionBuilderInput): IntroductionParagraph {
    const content = input.researchGap
      ? `However, ${input.researchGap}. This gap in knowledge limits our understanding and clinical decision-making in this area.`
      : 'Despite prior research, gaps remain in our understanding of this topic.';

    return {
      content,
      citations: [],
      wordCount: this.countWords(content),
      type: 'gap'
    };
  }

  private buildObjectives(input: IntroductionBuilderInput): IntroductionParagraph {
    let content = `Therefore, the objective of this study was to ${input.studyObjective}.`;
    
    if (input.hypothesis) {
      content += ` We hypothesized that ${input.hypothesis}.`;
    }

    return {
      content,
      citations: [],
      wordCount: this.countWords(content),
      type: 'objective'
    };
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

export const introductionBuilderService = new IntroductionBuilderService();
```

---

## Tasks 44-60: Summary Table

| Task | File | Description |
|------|------|-------------|
| 44 | `services/methods-populator.service.ts` | Auto-populate from data metadata |
| 45 | `services/results-scaffold.service.ts` | Create Results outline with embeds |
| 46 | `services/discussion-builder.service.ts` | Build Discussion structure |
| 47 | `services/references-builder.service.ts` | Auto-compile references |
| 48 | `services/acknowledgments.service.ts` | Funding, contributors, ethics |
| 49 | `types/figure-table-inserter.types.ts` | Figure/table insertion types |
| 50 | `services/word-count-tracker.service.ts` | Section word count limits |
| 51 | `services/outline-expander.service.ts` | Expand bullets to prose |
| 52 | `types/section-reorder.types.ts` | Section reordering types |
| 53 | `templates/journal-templates/` | NEJM, JAMA, Lancet, BMJ templates |
| 54 | `services/keyword-generator.service.ts` | Generate MeSH keywords |
| 55 | `services/coi-disclosure.service.ts` | ICMJE conflict of interest |
| 56 | `services/appendices-builder.service.ts` | Supplementary materials |
| 57 | `services/title-generator.service.ts` | Generate title options |
| 58 | `services/author-manager.service.ts` | ORCID, affiliations |
| 59 | `services/branch-manager.service.ts` | Versioned branching |
| 60 | `__tests__/integration/structure.test.ts` | Full IMRaD assembly tests |

---

## Task 53: Journal Templates

**File**: `packages/manuscript-engine/src/templates/journal-templates/nejm.template.ts`

```typescript
import type { ManuscriptTemplate } from '../imrad-templates';

export const NEJM_TEMPLATE: ManuscriptTemplate = {
  id: 'nejm-original-article',
  name: 'NEJM Original Article',
  type: 'imrad',
  wordLimits: {
    abstract: { min: 200, max: 250 },
    introduction: { max: 500 },
    methods: { max: 1000 },
    results: { max: 1500 },
    discussion: { max: 1500 },
    total: { min: 2500, max: 3000 }
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['acknowledgments', 'supplementary'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [],
      guidance: 'Concise, descriptive title. Avoid abbreviations. Max 12 words preferred.'
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      subsections: [
        { id: 'background', title: 'Background', order: 1, guidance: '2-3 sentences', placeholders: [] },
        { id: 'methods', title: 'Methods', order: 2, guidance: 'Design and key methods', placeholders: [] },
        { id: 'results', title: 'Results', order: 3, guidance: 'Main findings with numbers', placeholders: [] },
        { id: 'conclusions', title: 'Conclusions', order: 4, guidance: '1-2 sentences', placeholders: [] }
      ],
      placeholders: [],
      guidance: 'Structured abstract. Max 250 words. No abbreviations except standard units.'
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [],
      guidance: 'Brief background and rationale. End with clear study objective. Max ~500 words.'
    },
    {
      section: 'methods',
      title: 'Methods',
      order: 4,
      subsections: [
        { id: 'oversight', title: 'Study Oversight', order: 1, guidance: 'IRB, funding, author roles', placeholders: [] },
        { id: 'patients', title: 'Patients', order: 2, guidance: 'Eligibility criteria', placeholders: [] },
        { id: 'design', title: 'Study Design', order: 3, guidance: 'Design, randomization', placeholders: [] },
        { id: 'procedures', title: 'Procedures', order: 4, guidance: 'Interventions', placeholders: [] },
        { id: 'outcomes', title: 'Outcomes', order: 5, guidance: 'Primary and secondary', placeholders: [] },
        { id: 'statistics', title: 'Statistical Analysis', order: 6, guidance: 'Sample size, methods', placeholders: [] }
      ],
      placeholders: [],
      guidance: 'Sufficient for replication. Include trial registration.'
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      placeholders: [],
      guidance: 'Start with enrollment/baseline. Present primary outcome with CI. Limit to 6 figures/tables total.'
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      placeholders: [],
      guidance: 'Key findings, comparison with literature, limitations, implications. No new results.'
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'Vancouver style. Max 40 references typically.'
    }
  ]
};
```

**File**: `packages/manuscript-engine/src/templates/journal-templates/index.ts`

```typescript
import { NEJM_TEMPLATE } from './nejm.template';
import type { ManuscriptTemplate } from '../imrad-templates';

// Add other journal templates as they're created
export const JOURNAL_TEMPLATES: Record<string, ManuscriptTemplate> = {
  'nejm': NEJM_TEMPLATE,
  // 'jama': JAMA_TEMPLATE,
  // 'lancet': LANCET_TEMPLATE,
  // 'bmj': BMJ_TEMPLATE,
};

export function getJournalTemplate(journal: string): ManuscriptTemplate | null {
  const key = journal.toLowerCase().replace(/\s+/g, '-');
  return JOURNAL_TEMPLATES[key] || null;
}

export function listAvailableJournals(): string[] {
  return Object.keys(JOURNAL_TEMPLATES);
}

export { NEJM_TEMPLATE };
```

---

## Task 57: Title Generator Service

**File**: `packages/manuscript-engine/src/services/title-generator.service.ts`

```typescript
export interface TitleGeneratorInput {
  studyType: string;
  population: string;
  intervention?: string;
  comparator?: string;
  outcome: string;
  keyFinding?: string;
}

export interface GeneratedTitle {
  title: string;
  wordCount: number;
  style: 'descriptive' | 'declarative' | 'question' | 'compound';
  warnings: string[];
}

export class TitleGeneratorService {
  private readonly maxWords = 15;
  private readonly minWords = 8;

  /**
   * Generate multiple title options
   */
  generateTitles(input: TitleGeneratorInput): GeneratedTitle[] {
    const titles: GeneratedTitle[] = [];

    // Descriptive title
    titles.push(this.generateDescriptiveTitle(input));

    // Declarative title (states finding)
    if (input.keyFinding) {
      titles.push(this.generateDeclarativeTitle(input));
    }

    // Compound title (with colon)
    titles.push(this.generateCompoundTitle(input));

    return titles;
  }

  /**
   * Validate title against guidelines
   */
  validateTitle(title: string): {
    valid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const wordCount = this.countWords(title);

    // Length check
    if (wordCount > this.maxWords) {
      warnings.push(`Title exceeds recommended length (${wordCount}/${this.maxWords} words)`);
    }
    if (wordCount < this.minWords) {
      suggestions.push(`Title may be too short (${wordCount} words)`);
    }

    // Abbreviation check
    if (/\b[A-Z]{2,}\b/.test(title)) {
      warnings.push('Avoid abbreviations in titles');
    }

    // Question mark check
    if (title.includes('?')) {
      suggestions.push('Question titles can be effective but may not suit all journals');
    }

    // Starting words to avoid
    const badStarts = ['a study of', 'an analysis of', 'investigation of', 'research on'];
    for (const start of badStarts) {
      if (title.toLowerCase().startsWith(start)) {
        suggestions.push(`Consider removing "${start}" for a more direct title`);
      }
    }

    // Check for specificity
    if (!title.toLowerCase().includes('in') && !title.includes(':')) {
      suggestions.push('Consider adding population/setting for specificity');
    }

    return {
      valid: warnings.length === 0,
      warnings,
      suggestions
    };
  }

  /**
   * Shorten title to meet word limit
   */
  shortenTitle(title: string, targetWords: number): string {
    const words = title.split(/\s+/);
    if (words.length <= targetWords) return title;

    // Try removing common filler phrases
    const fillers = [
      'a study of',
      'an investigation of',
      'an analysis of',
      'the effect of',
      'the effects of',
      'the impact of',
      'the role of'
    ];

    let shortened = title;
    for (const filler of fillers) {
      if (shortened.toLowerCase().includes(filler)) {
        shortened = shortened.replace(new RegExp(filler, 'i'), '').trim();
        if (this.countWords(shortened) <= targetWords) {
          return this.capitalizeTitle(shortened);
        }
      }
    }

    // If still too long, truncate with ellipsis
    return words.slice(0, targetWords - 1).join(' ') + '...';
  }

  private generateDescriptiveTitle(input: TitleGeneratorInput): GeneratedTitle {
    let title: string;

    if (input.intervention && input.comparator) {
      title = `${input.intervention} versus ${input.comparator} for ${input.outcome} in ${input.population}`;
    } else if (input.intervention) {
      title = `${input.intervention} and ${input.outcome} in ${input.population}`;
    } else {
      title = `${input.outcome} in ${input.population}: A ${input.studyType}`;
    }

    title = this.capitalizeTitle(title);
    const validation = this.validateTitle(title);

    return {
      title,
      wordCount: this.countWords(title),
      style: 'descriptive',
      warnings: validation.warnings
    };
  }

  private generateDeclarativeTitle(input: TitleGeneratorInput): GeneratedTitle {
    const title = this.capitalizeTitle(
      `${input.keyFinding} in ${input.population}`
    );
    const validation = this.validateTitle(title);

    return {
      title,
      wordCount: this.countWords(title),
      style: 'declarative',
      warnings: validation.warnings
    };
  }

  private generateCompoundTitle(input: TitleGeneratorInput): GeneratedTitle {
    let mainPart: string;
    let subtitle: string;

    if (input.intervention) {
      mainPart = `${input.intervention} for ${input.outcome}`;
      subtitle = `A ${input.studyType} in ${input.population}`;
    } else {
      mainPart = `${input.outcome} in ${input.population}`;
      subtitle = `A ${input.studyType}`;
    }

    const title = this.capitalizeTitle(`${mainPart}: ${subtitle}`);
    const validation = this.validateTitle(title);

    return {
      title,
      wordCount: this.countWords(title),
      style: 'compound',
      warnings: validation.warnings
    };
  }

  private capitalizeTitle(title: string): string {
    const minorWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with', 'versus', 'vs'];
    
    return title.split(' ').map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0 || !minorWords.includes(lower)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return lower;
    }).join(' ');
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

export const titleGeneratorService = new TitleGeneratorService();
```

---

## Verification Checklist - Phase 3

- [ ] IMRaD template with all required sections
- [ ] Case report template with appropriate structure
- [ ] Systematic review template with PRISMA elements
- [ ] Abstract generator produces structured output
- [ ] Introduction builder creates proper funnel structure
- [ ] Journal templates (NEJM, etc.) have correct limits
- [ ] Title generator validates against guidelines
- [ ] All templates export correctly from index

## Next Phase

Proceed to **PHASE_4_WRITING_ASSISTANCE.md** for Tasks 61-80.
