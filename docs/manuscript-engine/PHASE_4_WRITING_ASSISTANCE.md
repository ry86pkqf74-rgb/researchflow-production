# Phase 4: Writing Assistance Tools (Tasks 61-80)

## Prerequisites

- Phases 1-3 completed
- AI router integration configured
- Manuscript structure services functional

## Integration Points

- `packages/ai-router/` - For all AI-assisted writing
- `services/orchestrator/` - API routes for writing tools
- `packages/phi-engine/` - PHI scanning on all generated content

---

## Task 61: OpenAI Drafter Service

**File**: `packages/manuscript-engine/src/services/openai-drafter.service.ts`

```typescript
import type { IMRaDSection } from '../types/imrad.types';

export interface DraftRequest {
  manuscriptId: string;
  section: IMRaDSection;
  context: DraftContext;
  style: WritingStyle;
  maxTokens?: number;
}

export interface DraftContext {
  previousSections?: Record<string, string>;
  dataPoints?: DataPointReference[];
  citations?: CitationReference[];
  outline?: string[];
  instructions?: string;
}

export interface DataPointReference {
  id: string;
  description: string;
  value: string | number;
  source: string;
}

export interface CitationReference {
  id: string;
  shortRef: string; // e.g., "Smith et al., 2023"
  relevantFindings?: string;
}

export interface WritingStyle {
  tone: 'formal' | 'semi_formal';
  voice: 'active' | 'passive' | 'mixed';
  tense: 'past' | 'present';
  complexity: 'expert' | 'general_medical' | 'general_audience';
}

export interface DraftResult {
  content: string;
  wordCount: number;
  tokensUsed: number;
  citations: string[]; // Citation IDs used
  dataPoints: string[]; // Data point IDs referenced
  confidence: number; // 0-1
  warnings: string[];
}

export class OpenAIDrafterService {
  private readonly defaultStyle: WritingStyle = {
    tone: 'formal',
    voice: 'passive',
    tense: 'past',
    complexity: 'expert'
  };

  /**
   * Generate draft for a section
   */
  async generateDraft(request: DraftRequest): Promise<DraftResult> {
    const prompt = this.buildPrompt(request);
    const systemPrompt = this.buildSystemPrompt(request.style);

    // Call AI router
    const response = await this.callAIRouter({
      model: 'gpt-4',
      systemPrompt,
      userPrompt: prompt,
      maxTokens: request.maxTokens || 1000,
      temperature: 0.7
    });

    // Post-process response
    const content = this.postProcess(response.content, request);
    const warnings = this.validateDraft(content, request);

    return {
      content,
      wordCount: this.countWords(content),
      tokensUsed: response.tokensUsed,
      citations: this.extractCitationReferences(content, request.context.citations || []),
      dataPoints: this.extractDataReferences(content, request.context.dataPoints || []),
      confidence: this.calculateConfidence(response),
      warnings
    };
  }

  /**
   * Expand bullet points into prose
   */
  async expandOutline(
    outline: string[],
    context: DraftContext,
    style: WritingStyle
  ): Promise<string> {
    const prompt = `Expand the following outline into well-written academic prose:

${outline.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Guidelines:
- Write in ${style.tone} academic tone
- Use ${style.voice} voice predominantly
- Each point should become a well-developed sentence or paragraph
- Ensure smooth transitions between points
- Maintain scientific accuracy`;

    const response = await this.callAIRouter({
      model: 'gpt-4',
      systemPrompt: this.buildSystemPrompt(style),
      userPrompt: prompt,
      maxTokens: 1500,
      temperature: 0.6
    });

    return response.content;
  }

  /**
   * Continue writing from existing content
   */
  async continueWriting(
    existingContent: string,
    direction: string,
    style: WritingStyle,
    maxWords: number = 200
  ): Promise<string> {
    const prompt = `Continue writing the following text. ${direction}

Existing text:
"""
${existingContent}
"""

Continue from where the text ends. Write approximately ${maxWords} words.`;

    const response = await this.callAIRouter({
      model: 'gpt-4',
      systemPrompt: this.buildSystemPrompt(style),
      userPrompt: prompt,
      maxTokens: Math.ceil(maxWords * 1.5),
      temperature: 0.7
    });

    return response.content;
  }

  private buildPrompt(request: DraftRequest): string {
    const parts: string[] = [];

    parts.push(`Generate the ${request.section} section of a medical research manuscript.`);

    // Add context from previous sections
    if (request.context.previousSections) {
      parts.push('\n## Context from other sections:');
      for (const [section, content] of Object.entries(request.context.previousSections)) {
        parts.push(`\n### ${section}:\n${content.substring(0, 500)}...`);
      }
    }

    // Add data points to reference
    if (request.context.dataPoints && request.context.dataPoints.length > 0) {
      parts.push('\n## Data points to incorporate:');
      for (const dp of request.context.dataPoints) {
        parts.push(`- ${dp.description}: ${dp.value} (Source: ${dp.source})`);
      }
    }

    // Add citations to use
    if (request.context.citations && request.context.citations.length > 0) {
      parts.push('\n## Citations to reference:');
      for (const cite of request.context.citations) {
        parts.push(`- ${cite.shortRef}${cite.relevantFindings ? `: ${cite.relevantFindings}` : ''}`);
      }
    }

    // Add outline if provided
    if (request.context.outline && request.context.outline.length > 0) {
      parts.push('\n## Outline to follow:');
      request.context.outline.forEach((item, i) => {
        parts.push(`${i + 1}. ${item}`);
      });
    }

    // Add specific instructions
    if (request.context.instructions) {
      parts.push(`\n## Additional instructions:\n${request.context.instructions}`);
    }

    return parts.join('\n');
  }

  private buildSystemPrompt(style: WritingStyle): string {
    return `You are an expert medical manuscript writer with extensive experience in academic publishing.

Writing Style Requirements:
- Tone: ${style.tone}
- Voice: ${style.voice} voice (${style.voice === 'passive' ? 'e.g., "Data were analyzed..."' : 'e.g., "We analyzed..."'})
- Tense: ${style.tense} tense for methods and results
- Target audience: ${style.complexity === 'expert' ? 'Medical specialists' : style.complexity === 'general_medical' ? 'General medical audience' : 'Educated lay audience'}

Critical Requirements:
- Report statistics accurately with appropriate precision
- Never fabricate data or citations
- Use hedging language appropriately ("may", "suggests", "appears to")
- Flag any uncertainty with [VERIFY] tags
- Maintain scientific objectivity
- Do not include patient-identifiable information`;
  }

  private async callAIRouter(params: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    temperature: number;
  }): Promise<{ content: string; tokensUsed: number }> {
    // TODO: Integrate with actual ai-router package
    return {
      content: 'AI-generated content would appear here.',
      tokensUsed: 100
    };
  }

  private postProcess(content: string, request: DraftRequest): string {
    let processed = content;

    // Remove any markdown formatting that slipped through
    processed = processed.replace(/#{1,6}\s/g, '');
    processed = processed.replace(/\*\*/g, '');
    processed = processed.replace(/\*/g, '');

    // Standardize citation format
    processed = processed.replace(/\((\w+)\s+et\s+al\.,?\s*(\d{4})\)/g, '($1 et al., $2)');

    // Ensure proper sentence spacing
    processed = processed.replace(/\.(?=[A-Z])/g, '. ');

    return processed.trim();
  }

  private validateDraft(content: string, request: DraftRequest): string[] {
    const warnings: string[] = [];

    // Check for [VERIFY] tags
    const verifyCount = (content.match(/\[VERIFY\]/g) || []).length;
    if (verifyCount > 0) {
      warnings.push(`${verifyCount} items flagged for verification`);
    }

    // Check for data point usage
    if (request.context.dataPoints && request.context.dataPoints.length > 0) {
      const unusedData = request.context.dataPoints.filter(
        dp => !content.includes(String(dp.value))
      );
      if (unusedData.length > 0) {
        warnings.push(`${unusedData.length} data points may not have been incorporated`);
      }
    }

    // Check for citation usage
    if (request.context.citations && request.context.citations.length > 0) {
      const unusedCitations = request.context.citations.filter(
        cite => !content.includes(cite.shortRef.split(',')[0])
      );
      if (unusedCitations.length > request.context.citations.length * 0.5) {
        warnings.push('Many provided citations were not used');
      }
    }

    return warnings;
  }

  private extractCitationReferences(content: string, citations: CitationReference[]): string[] {
    const usedIds: string[] = [];
    for (const cite of citations) {
      const authorName = cite.shortRef.split(' ')[0];
      if (content.includes(authorName)) {
        usedIds.push(cite.id);
      }
    }
    return usedIds;
  }

  private extractDataReferences(content: string, dataPoints: DataPointReference[]): string[] {
    const usedIds: string[] = [];
    for (const dp of dataPoints) {
      if (content.includes(String(dp.value))) {
        usedIds.push(dp.id);
      }
    }
    return usedIds;
  }

  private calculateConfidence(response: { content: string; tokensUsed: number }): number {
    // Simple heuristic - would be more sophisticated in production
    const verifyTags = (response.content.match(/\[VERIFY\]/g) || []).length;
    const uncertainPhrases = (response.content.match(/\b(may|might|possibly|unclear|uncertain)\b/gi) || []).length;
    
    let confidence = 0.9;
    confidence -= verifyTags * 0.1;
    confidence -= uncertainPhrases * 0.02;
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

export const openAIDrafterService = new OpenAIDrafterService();
```

---

## Task 62: Claude Writer Service

**File**: `packages/manuscript-engine/src/services/claude-writer.service.ts`

```typescript
import type { IMRaDSection } from '../types/imrad.types';
import type { WritingStyle, DraftContext, DraftResult } from './openai-drafter.service';

export interface ClaudeWriterConfig {
  model: 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku';
  extendedThinking?: boolean;
}

export interface ReasonedWritingRequest {
  manuscriptId: string;
  section: IMRaDSection;
  context: DraftContext;
  style: WritingStyle;
  requireReasoning: boolean;
}

export interface ReasonedDraftResult extends DraftResult {
  reasoning?: string;
  alternatives?: string[];
  uncertainties?: string[];
}

export class ClaudeWriterService {
  private config: ClaudeWriterConfig;

  constructor(config: ClaudeWriterConfig = { model: 'claude-3-sonnet' }) {
    this.config = config;
  }

  /**
   * Generate draft with reasoning about writing decisions
   */
  async generateWithReasoning(request: ReasonedWritingRequest): Promise<ReasonedDraftResult> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.callClaude(systemPrompt, userPrompt);

    // Parse response for content and reasoning
    const { content, reasoning, alternatives, uncertainties } = this.parseResponse(response);

    return {
      content,
      wordCount: this.countWords(content),
      tokensUsed: response.tokensUsed,
      citations: [],
      dataPoints: [],
      confidence: this.calculateConfidence(uncertainties),
      warnings: this.generateWarnings(uncertainties),
      reasoning,
      alternatives,
      uncertainties
    };
  }

  /**
   * Improve existing text with explanations
   */
  async improveWithExplanation(
    text: string,
    improvementType: 'clarity' | 'precision' | 'flow' | 'conciseness',
    style: WritingStyle
  ): Promise<{
    improved: string;
    changes: { original: string; revised: string; reason: string }[];
  }> {
    const prompt = `Improve the following text for ${improvementType}. 
For each change you make, explain why.

Original text:
"""
${text}
"""

Provide your response in JSON format:
{
  "improved": "the improved text",
  "changes": [
    {"original": "original phrase", "revised": "revised phrase", "reason": "why changed"}
  ]
}`;

    const response = await this.callClaude(
      this.buildSystemPrompt({ ...this.getDefaultRequest(), style }),
      prompt
    );

    try {
      const parsed = JSON.parse(response.content);
      return {
        improved: parsed.improved,
        changes: parsed.changes || []
      };
    } catch {
      return {
        improved: text,
        changes: []
      };
    }
  }

  /**
   * Generate multiple writing options
   */
  async generateOptions(
    context: DraftContext,
    section: IMRaDSection,
    numOptions: number = 3
  ): Promise<{
    options: { text: string; approach: string; strengths: string[] }[];
  }> {
    const prompt = `Generate ${numOptions} different ways to write the ${section} section.
Each should take a different approach (e.g., more direct, more detailed, more focused on implications).

Context:
${JSON.stringify(context, null, 2)}

For each option, provide:
1. The text
2. The approach taken
3. Key strengths of that approach

Respond in JSON format:
{
  "options": [
    {"text": "...", "approach": "...", "strengths": ["...", "..."]}
  ]
}`;

    const response = await this.callClaude(
      'You are an expert medical writer. Generate diverse writing options.',
      prompt
    );

    try {
      return JSON.parse(response.content);
    } catch {
      return { options: [] };
    }
  }

  /**
   * Analyze and critique a draft
   */
  async critiqueDraft(
    draft: string,
    section: IMRaDSection
  ): Promise<{
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  }> {
    const prompt = `Critically analyze this ${section} section of a medical manuscript:

"""
${draft}
"""

Evaluate:
1. Scientific accuracy and precision
2. Clarity and readability
3. Appropriate use of evidence
4. Logical flow and structure
5. Adherence to academic conventions

Provide:
- Overall score (1-10)
- Key strengths
- Key weaknesses
- Specific suggestions for improvement

Respond in JSON format.`;

    const response = await this.callClaude(
      'You are a senior medical journal editor reviewing a manuscript.',
      prompt
    );

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        overallScore: 0,
        strengths: [],
        weaknesses: ['Unable to analyze'],
        suggestions: []
      };
    }
  }

  private buildSystemPrompt(request: ReasonedWritingRequest): string {
    return `You are Claude, an expert medical and scientific writer with deep knowledge of academic publishing conventions.

Your writing characteristics:
- Precise and accurate scientific language
- Appropriate hedging when evidence is uncertain
- Clear logical structure
- Proper use of citations and data references

${request.requireReasoning ? `
When writing, you should:
1. First reason through the best approach
2. Consider alternative framings
3. Note any uncertainties
4. Then provide the final text

Structure your response with <reasoning>, <uncertainties>, and <content> sections.
` : ''}

Writing style for this task:
- Tone: ${request.style.tone}
- Voice: ${request.style.voice}
- Tense: ${request.style.tense}
- Audience: ${request.style.complexity}`;
  }

  private buildUserPrompt(request: ReasonedWritingRequest): string {
    let prompt = `Write the ${request.section} section for a medical research manuscript.\n\n`;

    if (request.context.previousSections) {
      prompt += 'Context from other sections:\n';
      for (const [section, content] of Object.entries(request.context.previousSections)) {
        prompt += `${section}: ${content.substring(0, 300)}...\n`;
      }
      prompt += '\n';
    }

    if (request.context.outline) {
      prompt += 'Follow this outline:\n';
      prompt += request.context.outline.map((item, i) => `${i + 1}. ${item}`).join('\n');
      prompt += '\n\n';
    }

    if (request.context.instructions) {
      prompt += `Additional instructions: ${request.context.instructions}\n`;
    }

    return prompt;
  }

  private async callClaude(
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ content: string; tokensUsed: number }> {
    // TODO: Integrate with actual Claude API via ai-router
    return {
      content: 'Claude-generated content would appear here.',
      tokensUsed: 150
    };
  }

  private parseResponse(response: { content: string; tokensUsed: number }): {
    content: string;
    reasoning?: string;
    alternatives?: string[];
    uncertainties?: string[];
  } {
    const content = response.content;

    // Try to extract structured sections
    const reasoningMatch = content.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
    const uncertaintiesMatch = content.match(/<uncertainties>([\s\S]*?)<\/uncertainties>/);
    const contentMatch = content.match(/<content>([\s\S]*?)<\/content>/);

    if (contentMatch) {
      return {
        content: contentMatch[1].trim(),
        reasoning: reasoningMatch?.[1].trim(),
        uncertainties: uncertaintiesMatch?.[1].split('\n').filter(s => s.trim())
      };
    }

    return { content };
  }

  private calculateConfidence(uncertainties?: string[]): number {
    if (!uncertainties || uncertainties.length === 0) return 0.9;
    return Math.max(0.5, 0.9 - uncertainties.length * 0.1);
  }

  private generateWarnings(uncertainties?: string[]): string[] {
    if (!uncertainties) return [];
    return uncertainties.map(u => `Uncertainty: ${u}`);
  }

  private getDefaultRequest(): ReasonedWritingRequest {
    return {
      manuscriptId: '',
      section: 'introduction',
      context: {},
      style: { tone: 'formal', voice: 'passive', tense: 'past', complexity: 'expert' },
      requireReasoning: false
    };
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

export const claudeWriterService = new ClaudeWriterService();
```

---

## Task 63: Grammar Checker Service

**File**: `packages/manuscript-engine/src/services/grammar-checker.service.ts`

```typescript
export interface GrammarIssue {
  type: 'grammar' | 'spelling' | 'punctuation' | 'style' | 'clarity';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  context: string;
  offset: number;
  length: number;
  replacements: string[];
  rule?: string;
}

export interface GrammarCheckResult {
  issues: GrammarIssue[];
  score: number; // 0-100
  statistics: {
    errors: number;
    warnings: number;
    suggestions: number;
  };
}

export class GrammarCheckerService {
  // Medical terms that should not be flagged as spelling errors
  private readonly medicalExceptions = new Set([
    'etiology', 'aetiology', 'hemoglobin', 'haemoglobin',
    'tumor', 'tumour', 'pediatric', 'paediatric',
    'randomized', 'randomised', 'analyzed', 'analysed',
    'hemorrhage', 'haemorrhage', 'leukocyte', 'leucocyte',
    'anemia', 'anaemia', 'edema', 'oedema',
    'esophagus', 'oesophagus', 'fetus', 'foetus',
    'orthopedic', 'orthopaedic', 'sulfate', 'sulphate'
  ]);

  // Common medical abbreviations
  private readonly medicalAbbreviations = new Set([
    'BMI', 'CI', 'OR', 'RR', 'HR', 'SD', 'SE', 'IQR',
    'ECG', 'EKG', 'MRI', 'CT', 'PET', 'EEG', 'EMG',
    'ICU', 'ED', 'ER', 'OR', 'NICU', 'PICU',
    'HIV', 'AIDS', 'COVID', 'SARS', 'MERS',
    'DNA', 'RNA', 'PCR', 'ELISA', 'mRNA',
    'mg', 'kg', 'ml', 'mL', 'mcg', 'ng', 'pg',
    'mmHg', 'kPa', 'mmol', 'μmol', 'IU'
  ]);

  /**
   * Check text for grammar issues
   */
  async check(text: string): Promise<GrammarCheckResult> {
    // In production, this would call LanguageTool API or similar
    const issues = await this.runChecks(text);
    
    // Filter out medical exceptions
    const filteredIssues = issues.filter(issue => !this.isMedicalException(issue));

    const statistics = {
      errors: filteredIssues.filter(i => i.severity === 'error').length,
      warnings: filteredIssues.filter(i => i.severity === 'warning').length,
      suggestions: filteredIssues.filter(i => i.severity === 'suggestion').length
    };

    const score = this.calculateScore(text, filteredIssues);

    return { issues: filteredIssues, score, statistics };
  }

  /**
   * Check for medical writing specific issues
   */
  checkMedicalStyle(text: string): GrammarIssue[] {
    const issues: GrammarIssue[] = [];

    // Check for undefined abbreviations
    const abbreviations = text.match(/\b[A-Z]{2,}\b/g) || [];
    for (const abbrev of abbreviations) {
      if (!this.medicalAbbreviations.has(abbrev)) {
        // Check if it's defined earlier in the text
        const definitionPattern = new RegExp(`\\(${abbrev}\\)|${abbrev}\\s*[=:]`, 'i');
        if (!definitionPattern.test(text.substring(0, text.indexOf(abbrev)))) {
          const offset = text.indexOf(abbrev);
          issues.push({
            type: 'style',
            severity: 'warning',
            message: `Abbreviation "${abbrev}" may not be defined on first use`,
            context: this.getContext(text, offset),
            offset,
            length: abbrev.length,
            replacements: [],
            rule: 'UNDEFINED_ABBREVIATION'
          });
        }
      }
    }

    // Check for absolute statements without hedging
    const absolutePatterns = [
      { pattern: /\bproves?\b/gi, suggestion: 'suggests' },
      { pattern: /\bdefinitely\b/gi, suggestion: 'likely' },
      { pattern: /\balways\b/gi, suggestion: 'typically' },
      { pattern: /\bnever\b/gi, suggestion: 'rarely' }
    ];

    for (const { pattern, suggestion } of absolutePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        issues.push({
          type: 'style',
          severity: 'suggestion',
          message: `Consider hedging language instead of absolute statements`,
          context: this.getContext(text, match.index),
          offset: match.index,
          length: match[0].length,
          replacements: [suggestion],
          rule: 'HEDGING_LANGUAGE'
        });
      }
    }

    // Check for first person in methods/results (where passive is often preferred)
    const firstPersonPatterns = /\b(I|we|our|my)\s+(analyzed|performed|conducted|measured)/gi;
    let match;
    while ((match = firstPersonPatterns.exec(text)) !== null) {
      issues.push({
        type: 'style',
        severity: 'suggestion',
        message: 'Consider passive voice for methods/results sections',
        context: this.getContext(text, match.index),
        offset: match.index,
        length: match[0].length,
        replacements: [this.toPassiveVoice(match[0])],
        rule: 'PASSIVE_VOICE_SUGGESTION'
      });
    }

    return issues;
  }

  /**
   * Fix common issues automatically
   */
  autoFix(text: string, issues: GrammarIssue[]): string {
    // Sort issues by offset descending to fix from end to beginning
    const sortedIssues = [...issues]
      .filter(i => i.replacements.length > 0 && i.severity === 'error')
      .sort((a, b) => b.offset - a.offset);

    let fixed = text;
    for (const issue of sortedIssues) {
      const before = fixed.substring(0, issue.offset);
      const after = fixed.substring(issue.offset + issue.length);
      fixed = before + issue.replacements[0] + after;
    }

    return fixed;
  }

  private async runChecks(text: string): Promise<GrammarIssue[]> {
    const issues: GrammarIssue[] = [];

    // Basic checks (would be replaced with LanguageTool API)
    
    // Double spaces
    let match;
    const doubleSpace = /  +/g;
    while ((match = doubleSpace.exec(text)) !== null) {
      issues.push({
        type: 'punctuation',
        severity: 'error',
        message: 'Multiple spaces detected',
        context: this.getContext(text, match.index),
        offset: match.index,
        length: match[0].length,
        replacements: [' '],
        rule: 'DOUBLE_SPACE'
      });
    }

    // Missing space after period
    const missingSentenceSpace = /\.[A-Z]/g;
    while ((match = missingSentenceSpace.exec(text)) !== null) {
      issues.push({
        type: 'punctuation',
        severity: 'error',
        message: 'Missing space after period',
        context: this.getContext(text, match.index),
        offset: match.index,
        length: 2,
        replacements: [match[0][0] + ' ' + match[0][1]],
        rule: 'MISSING_SPACE_AFTER_PERIOD'
      });
    }

    // Common typos in medical writing
    const typos: [RegExp, string][] = [
      [/\bpateint\b/gi, 'patient'],
      [/\bstuides\b/gi, 'studies'],
      [/\bsignficant\b/gi, 'significant'],
      [/\bstatisically\b/gi, 'statistically'],
      [/\bcomparsion\b/gi, 'comparison'],
      [/\boccured\b/gi, 'occurred'],
      [/\brecieved\b/gi, 'received']
    ];

    for (const [pattern, correction] of typos) {
      while ((match = pattern.exec(text)) !== null) {
        issues.push({
          type: 'spelling',
          severity: 'error',
          message: `Possible typo: "${match[0]}"`,
          context: this.getContext(text, match.index),
          offset: match.index,
          length: match[0].length,
          replacements: [correction],
          rule: 'TYPO'
        });
      }
    }

    return issues;
  }

  private isMedicalException(issue: GrammarIssue): boolean {
    // Check if the flagged text is a known medical term or abbreviation
    const word = issue.context.substring(
      issue.context.indexOf('>>>') + 3,
      issue.context.indexOf('<<<')
    ).trim();

    return this.medicalExceptions.has(word.toLowerCase()) ||
           this.medicalAbbreviations.has(word);
  }

  private getContext(text: string, offset: number, windowSize: number = 30): string {
    const start = Math.max(0, offset - windowSize);
    const end = Math.min(text.length, offset + windowSize);
    
    let context = text.substring(start, end);
    
    // Mark the issue location
    const localOffset = offset - start;
    context = context.substring(0, localOffset) + '>>>' + 
              context.substring(localOffset);
    
    return context;
  }

  private toPassiveVoice(text: string): string {
    const conversions: Record<string, string> = {
      'we analyzed': 'were analyzed',
      'we performed': 'were performed',
      'we conducted': 'was conducted',
      'we measured': 'were measured',
      'I analyzed': 'were analyzed',
      'I performed': 'were performed'
    };

    return conversions[text.toLowerCase()] || text;
  }

  private calculateScore(text: string, issues: GrammarIssue[]): number {
    const wordCount = text.split(/\s+/).length;
    const errorWeight = 10;
    const warningWeight = 3;
    const suggestionWeight = 1;

    const penaltyPoints = 
      issues.filter(i => i.severity === 'error').length * errorWeight +
      issues.filter(i => i.severity === 'warning').length * warningWeight +
      issues.filter(i => i.severity === 'suggestion').length * suggestionWeight;

    // Score based on issues per 100 words
    const issuesPerHundred = (penaltyPoints / wordCount) * 100;
    return Math.max(0, Math.min(100, 100 - issuesPerHundred));
  }
}

export const grammarCheckerService = new GrammarCheckerService();
```

---

## Task 64: Claim Verifier Service

**File**: `packages/manuscript-engine/src/services/claim-verifier.service.ts`

```typescript
import type { Citation } from '../types/citation.types';
import type { DataCitation } from './data-citation.service';

export interface Claim {
  id: string;
  text: string;
  type: 'statistical' | 'comparative' | 'causal' | 'descriptive';
  section: string;
  startOffset: number;
  endOffset: number;
}

export interface ClaimVerification {
  claimId: string;
  verified: boolean;
  confidence: number;
  supportingEvidence: Evidence[];
  issues: VerificationIssue[];
  suggestedAction?: string;
}

export interface Evidence {
  type: 'data' | 'citation' | 'internal';
  sourceId: string;
  sourceDescription: string;
  relevantText?: string;
  matchStrength: 'exact' | 'partial' | 'weak';
}

export interface VerificationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export class ClaimVerifierService {
  /**
   * Extract claims from text
   */
  extractClaims(text: string, section: string): Claim[] {
    const claims: Claim[] = [];
    const sentences = this.tokenizeSentences(text);

    for (const sentence of sentences) {
      const claimType = this.identifyClaimType(sentence.text);
      if (claimType) {
        claims.push({
          id: crypto.randomUUID(),
          text: sentence.text,
          type: claimType,
          section,
          startOffset: sentence.start,
          endOffset: sentence.end
        });
      }
    }

    return claims;
  }

  /**
   * Verify claim against data and citations
   */
  async verifyClaim(
    claim: Claim,
    dataCitations: DataCitation[],
    literatureCitations: Citation[]
  ): Promise<ClaimVerification> {
    const evidence: Evidence[] = [];
    const issues: VerificationIssue[] = [];

    // Extract statistics from claim
    const claimStats = this.extractStatistics(claim.text);

    // Check against data citations
    for (const dataCite of dataCitations) {
      const match = this.matchClaimToData(claim, dataCite, claimStats);
      if (match) {
        evidence.push(match);
      }
    }

    // Check against literature citations
    for (const litCite of literatureCitations) {
      const match = this.matchClaimToLiterature(claim, litCite);
      if (match) {
        evidence.push(match);
      }
    }

    // Identify issues
    if (evidence.length === 0) {
      issues.push({
        severity: 'warning',
        message: 'No supporting evidence found for this claim',
        suggestion: 'Add data citation or literature reference'
      });
    }

    if (claim.type === 'causal' && !evidence.some(e => e.matchStrength === 'exact')) {
      issues.push({
        severity: 'warning',
        message: 'Causal claims require strong supporting evidence',
        suggestion: 'Consider using hedging language (e.g., "may", "suggests")'
      });
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(evidence, issues);

    return {
      claimId: claim.id,
      verified: confidence > 0.6 && issues.filter(i => i.severity === 'error').length === 0,
      confidence,
      supportingEvidence: evidence,
      issues,
      suggestedAction: this.suggestAction(issues)
    };
  }

  /**
   * Verify all claims in a section
   */
  async verifySection(
    text: string,
    section: string,
    dataCitations: DataCitation[],
    literatureCitations: Citation[]
  ): Promise<{
    claims: Claim[];
    verifications: ClaimVerification[];
    summary: {
      total: number;
      verified: number;
      unverified: number;
      warnings: number;
    };
  }> {
    const claims = this.extractClaims(text, section);
    const verifications = await Promise.all(
      claims.map(claim => this.verifyClaim(claim, dataCitations, literatureCitations))
    );

    const summary = {
      total: claims.length,
      verified: verifications.filter(v => v.verified).length,
      unverified: verifications.filter(v => !v.verified).length,
      warnings: verifications.reduce((sum, v) => sum + v.issues.filter(i => i.severity === 'warning').length, 0)
    };

    return { claims, verifications, summary };
  }

  /**
   * Generate audit log entry for verification
   */
  createAuditEntry(verification: ClaimVerification): object {
    return {
      claimId: verification.claimId,
      verified: verification.verified,
      confidence: verification.confidence,
      evidenceCount: verification.supportingEvidence.length,
      issueCount: verification.issues.length,
      timestamp: new Date().toISOString()
    };
  }

  private tokenizeSentences(text: string): { text: string; start: number; end: number }[] {
    const sentences: { text: string; start: number; end: number }[] = [];
    const regex = /[^.!?]+[.!?]+/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      sentences.push({
        text: match[0].trim(),
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return sentences;
  }

  private identifyClaimType(sentence: string): Claim['type'] | null {
    const lower = sentence.toLowerCase();

    // Statistical claims
    if (/\d+\.?\d*\s*%|p\s*[<>=]|odds ratio|relative risk|hazard ratio|mean|median/i.test(sentence)) {
      return 'statistical';
    }

    // Causal claims
    if (/\bcause[ds]?\b|\bresult(?:s|ed)? in\b|\blead(?:s)? to\b|\bdue to\b/i.test(lower)) {
      return 'causal';
    }

    // Comparative claims
    if (/\bcompared?\b|\bversus\b|\bgreater\b|\bless\b|\bmore\b|\bfewer\b|\bhigher\b|\blower\b/i.test(lower)) {
      return 'comparative';
    }

    // Descriptive claims (general statements)
    if (/\bis\b|\bare\b|\bwas\b|\bwere\b/i.test(lower) && sentence.length > 30) {
      return 'descriptive';
    }

    return null;
  }

  private extractStatistics(text: string): {
    values: number[];
    pValues: number[];
    percentages: number[];
    ranges: [number, number][];
  } {
    const values: number[] = [];
    const pValues: number[] = [];
    const percentages: number[] = [];
    const ranges: [number, number][] = [];

    // Extract numbers
    const numberMatches = text.match(/\d+\.?\d*/g) || [];
    for (const match of numberMatches) {
      values.push(parseFloat(match));
    }

    // Extract p-values
    const pValueMatches = text.match(/p\s*[<>=]\s*(\d+\.?\d*)/gi) || [];
    for (const match of pValueMatches) {
      const value = parseFloat(match.replace(/p\s*[<>=]\s*/i, ''));
      if (value <= 1) pValues.push(value);
    }

    // Extract percentages
    const percentMatches = text.match(/(\d+\.?\d*)\s*%/g) || [];
    for (const match of percentMatches) {
      percentages.push(parseFloat(match));
    }

    // Extract ranges (95% CI, etc.)
    const rangeMatches = text.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/g) || [];
    for (const match of rangeMatches) {
      const parts = match.split(/[-–]/).map(p => parseFloat(p.trim()));
      if (parts.length === 2) {
        ranges.push([parts[0], parts[1]]);
      }
    }

    return { values, pValues, percentages, ranges };
  }

  private matchClaimToData(
    claim: Claim,
    dataCite: DataCitation,
    claimStats: ReturnType<typeof this.extractStatistics>
  ): Evidence | null {
    // Check if any statistics from the claim match the data citation
    // This is a simplified check - would be more sophisticated in production
    
    if (claimStats.values.length > 0) {
      return {
        type: 'data',
        sourceId: dataCite.id,
        sourceDescription: `Data from ${dataCite.datasetName}`,
        matchStrength: 'partial'
      };
    }

    return null;
  }

  private matchClaimToLiterature(claim: Claim, citation: Citation): Evidence | null {
    // Check if claim text references this citation
    const authorName = citation.authors[0]?.lastName;
    if (authorName && claim.text.includes(authorName)) {
      return {
        type: 'citation',
        sourceId: citation.id,
        sourceDescription: `${authorName} et al., ${citation.year}`,
        relevantText: citation.abstract?.substring(0, 200),
        matchStrength: 'exact'
      };
    }

    // Check for year reference
    if (claim.text.includes(String(citation.year))) {
      return {
        type: 'citation',
        sourceId: citation.id,
        sourceDescription: `${authorName} et al., ${citation.year}`,
        matchStrength: 'weak'
      };
    }

    return null;
  }

  private calculateConfidence(evidence: Evidence[], issues: VerificationIssue[]): number {
    let confidence = 0.5; // Base confidence

    // Add confidence for evidence
    for (const e of evidence) {
      if (e.matchStrength === 'exact') confidence += 0.2;
      else if (e.matchStrength === 'partial') confidence += 0.1;
      else confidence += 0.05;
    }

    // Subtract for issues
    for (const issue of issues) {
      if (issue.severity === 'error') confidence -= 0.3;
      else if (issue.severity === 'warning') confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private suggestAction(issues: VerificationIssue[]): string | undefined {
    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length > 0) {
      return errors[0].suggestion;
    }

    const warnings = issues.filter(i => i.severity === 'warning');
    if (warnings.length > 0) {
      return warnings[0].suggestion;
    }

    return undefined;
  }
}

export const claimVerifierService = new ClaimVerifierService();
```

---

## Tasks 65-80: Summary Table

| Task | File | Description |
|------|------|-------------|
| 65 | `services/transition-suggester.service.ts` | Context-aware academic transitions |
| 66 | `services/tone-adjuster.service.ts` | Adjust formal/clinical tone |
| 67 | `services/synonym-finder.service.ts` | Medical terminology synonyms |
| 68 | `services/medical-nlp.service.ts` | BioBERT entity recognition |
| 69 | `types/collaborative-editor.types.ts` | Real-time multi-user types |
| 70 | `services/clarity-analyzer.service.ts` | Clarity scoring and suggestions |
| 71 | `prompts/section-prompts/` | Section-specific writing prompts |
| 72 | `services/sentence-builder.service.ts` | Build sentences from data |
| 73 | `services/lit-paraphrase.service.ts` | Ethical paraphrasing |
| 74 | `services/abbreviation.service.ts` | Abbreviation management |
| 75 | `services/readability.service.ts` | Flesch-Kincaid scoring |
| 76 | `types/co-writer-mode.types.ts` | Live AI suggestion types |
| 77 | `services/citation-suggester.service.ts` | Context-based suggestions |
| 78 | `services/claim-highlighter.service.ts` | Highlight unsubstantiated claims |
| 79 | `templates/phrase-library.ts` | Medical phrase templates |
| 80 | `__tests__/integration/writing-tools.test.ts` | AI feature tests with PHI check |

---

## Task 75: Readability Service

**File**: `packages/manuscript-engine/src/services/readability.service.ts`

```typescript
export interface ReadabilityMetrics {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFog: number;
  smogIndex: number;
  automatedReadabilityIndex: number;
  averageSentenceLength: number;
  averageWordLength: number;
  averageSyllablesPerWord: number;
}

export interface ReadabilityReport {
  metrics: ReadabilityMetrics;
  interpretation: {
    level: 'very_easy' | 'easy' | 'standard' | 'difficult' | 'very_difficult';
    appropriateFor: string;
    recommendations: string[];
  };
  perSectionMetrics?: Record<string, ReadabilityMetrics>;
}

export class ReadabilityService {
  /**
   * Calculate all readability metrics
   */
  analyze(text: string): ReadabilityMetrics {
    const words = this.getWords(text);
    const sentences = this.getSentences(text);
    const syllables = this.countSyllables(text);

    const wordCount = words.length;
    const sentenceCount = sentences.length;
    const syllableCount = syllables;
    const complexWords = this.countComplexWords(words);

    const avgSentenceLength = wordCount / sentenceCount;
    const avgSyllablesPerWord = syllableCount / wordCount;
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount;

    return {
      fleschReadingEase: this.fleschReadingEase(avgSentenceLength, avgSyllablesPerWord),
      fleschKincaidGrade: this.fleschKincaidGrade(avgSentenceLength, avgSyllablesPerWord),
      gunningFog: this.gunningFog(avgSentenceLength, complexWords / wordCount),
      smogIndex: this.smogIndex(complexWords, sentenceCount),
      automatedReadabilityIndex: this.automatedReadabilityIndex(wordCount, sentenceCount, text.length),
      averageSentenceLength: avgSentenceLength,
      averageWordLength: avgWordLength,
      averageSyllablesPerWord: avgSyllablesPerWord
    };
  }

  /**
   * Generate full readability report
   */
  generateReport(text: string): ReadabilityReport {
    const metrics = this.analyze(text);
    const interpretation = this.interpret(metrics);

    return {
      metrics,
      interpretation
    };
  }

  /**
   * Analyze text by sections
   */
  analyzeBySection(sections: Record<string, string>): ReadabilityReport {
    const combinedText = Object.values(sections).join(' ');
    const overallMetrics = this.analyze(combinedText);
    
    const perSectionMetrics: Record<string, ReadabilityMetrics> = {};
    for (const [section, text] of Object.entries(sections)) {
      if (text.trim().length > 0) {
        perSectionMetrics[section] = this.analyze(text);
      }
    }

    return {
      metrics: overallMetrics,
      interpretation: this.interpret(overallMetrics),
      perSectionMetrics
    };
  }

  /**
   * Suggest improvements for readability
   */
  suggestImprovements(text: string, targetGradeLevel: number = 12): string[] {
    const metrics = this.analyze(text);
    const suggestions: string[] = [];

    // Sentence length
    if (metrics.averageSentenceLength > 25) {
      suggestions.push(
        `Average sentence length (${metrics.averageSentenceLength.toFixed(1)} words) is high. ` +
        `Consider breaking long sentences for clarity.`
      );
    }

    // Word complexity
    if (metrics.averageSyllablesPerWord > 2) {
      suggestions.push(
        `Text uses many complex words (${metrics.averageSyllablesPerWord.toFixed(1)} syllables/word average). ` +
        `Consider simpler alternatives where possible.`
      );
    }

    // Grade level
    if (metrics.fleschKincaidGrade > targetGradeLevel) {
      suggestions.push(
        `Reading level (grade ${metrics.fleschKincaidGrade.toFixed(1)}) exceeds target (grade ${targetGradeLevel}). ` +
        `Simplify vocabulary and sentence structure.`
      );
    }

    // Flesch score
    if (metrics.fleschReadingEase < 30) {
      suggestions.push(
        `Flesch Reading Ease score (${metrics.fleschReadingEase.toFixed(0)}) indicates very difficult text. ` +
        `Medical journals typically target 30-50 for expert audiences.`
      );
    }

    if (suggestions.length === 0) {
      suggestions.push('Readability is appropriate for the target audience.');
    }

    return suggestions;
  }

  // Flesch Reading Ease: 206.835 - 1.015(ASL) - 84.6(ASW)
  private fleschReadingEase(avgSentenceLength: number, avgSyllablesPerWord: number): number {
    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  }

  // Flesch-Kincaid Grade: 0.39(ASL) + 11.8(ASW) - 15.59
  private fleschKincaidGrade(avgSentenceLength: number, avgSyllablesPerWord: number): number {
    return (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;
  }

  // Gunning Fog: 0.4(ASL + PHW)
  private gunningFog(avgSentenceLength: number, percentHardWords: number): number {
    return 0.4 * (avgSentenceLength + (100 * percentHardWords));
  }

  // SMOG Index: 1.0430 * sqrt(30 * complex/sentences) + 3.1291
  private smogIndex(complexWordCount: number, sentenceCount: number): number {
    return 1.0430 * Math.sqrt((complexWordCount * 30) / sentenceCount) + 3.1291;
  }

  // ARI: 4.71(chars/words) + 0.5(words/sentences) - 21.43
  private automatedReadabilityIndex(wordCount: number, sentenceCount: number, charCount: number): number {
    return (4.71 * (charCount / wordCount)) + (0.5 * (wordCount / sentenceCount)) - 21.43;
  }

  private getWords(text: string): string[] {
    return text.toLowerCase().match(/[a-z]+/g) || [];
  }

  private getSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private countSyllables(text: string): number {
    const words = this.getWords(text);
    return words.reduce((sum, word) => sum + this.syllablesInWord(word), 0);
  }

  private syllablesInWord(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    // Remove silent e
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');

    // Count vowel groups
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private countComplexWords(words: string[]): number {
    // Complex words have 3+ syllables and are not proper nouns or compound words
    return words.filter(word => {
      const syllables = this.syllablesInWord(word);
      const isProperNoun = word[0] === word[0].toUpperCase();
      const isCompound = word.includes('-');
      return syllables >= 3 && !isProperNoun && !isCompound;
    }).length;
  }

  private interpret(metrics: ReadabilityMetrics): ReadabilityReport['interpretation'] {
    const fre = metrics.fleschReadingEase;
    let level: ReadabilityReport['interpretation']['level'];
    let appropriateFor: string;
    const recommendations: string[] = [];

    if (fre >= 70) {
      level = 'easy';
      appropriateFor = 'General public, patients';
    } else if (fre >= 50) {
      level = 'standard';
      appropriateFor = 'High school educated readers, general medical audience';
    } else if (fre >= 30) {
      level = 'difficult';
      appropriateFor = 'Medical professionals, academic audience';
    } else {
      level = 'very_difficult';
      appropriateFor = 'Specialists, advanced academic readers';
    }

    // Medical writing specific recommendations
    if (metrics.fleschKincaidGrade > 16) {
      recommendations.push('Consider simplifying for broader readership');
    }

    if (metrics.averageSentenceLength > 30) {
      recommendations.push('Break up very long sentences');
    }

    if (metrics.gunningFog > 18) {
      recommendations.push('Reduce jargon where possible');
    }

    return { level, appropriateFor, recommendations };
  }
}

export const readabilityService = new ReadabilityService();
```

---

## Task 79: Medical Phrase Library

**File**: `packages/manuscript-engine/src/templates/phrase-library.ts`

```typescript
export interface PhraseTemplate {
  id: string;
  category: string;
  subcategory: string;
  template: string;
  placeholders: string[];
  examples: string[];
  notes?: string;
}

export const METHODS_PHRASES: PhraseTemplate[] = [
  // Study Design
  {
    id: 'design-retrospective',
    category: 'methods',
    subcategory: 'study_design',
    template: 'This {study_type} study was conducted at {institution} between {start_date} and {end_date}.',
    placeholders: ['study_type', 'institution', 'start_date', 'end_date'],
    examples: [
      'This retrospective cohort study was conducted at Massachusetts General Hospital between January 2018 and December 2022.'
    ]
  },
  {
    id: 'design-prospective',
    category: 'methods',
    subcategory: 'study_design',
    template: 'We prospectively enrolled patients from {setting} over a {duration} period.',
    placeholders: ['setting', 'duration'],
    examples: [
      'We prospectively enrolled patients from the emergency department over a 24-month period.'
    ]
  },
  // Sample Selection
  {
    id: 'inclusion-criteria',
    category: 'methods',
    subcategory: 'participants',
    template: 'Patients were included if they {criteria_list}.',
    placeholders: ['criteria_list'],
    examples: [
      'Patients were included if they were aged ≥18 years, had confirmed diagnosis of type 2 diabetes, and had at least 12 months of follow-up data.'
    ]
  },
  {
    id: 'exclusion-criteria',
    category: 'methods',
    subcategory: 'participants',
    template: 'Exclusion criteria included {criteria_list}.',
    placeholders: ['criteria_list'],
    examples: [
      'Exclusion criteria included pregnancy, active malignancy, and prior organ transplantation.'
    ]
  },
  // Statistical Analysis
  {
    id: 'stats-continuous',
    category: 'methods',
    subcategory: 'statistics',
    template: 'Continuous variables were expressed as {measure} and compared using {test}.',
    placeholders: ['measure', 'test'],
    examples: [
      'Continuous variables were expressed as mean ± standard deviation and compared using Student\'s t-test.',
      'Continuous variables were expressed as median (interquartile range) and compared using Mann-Whitney U test.'
    ]
  },
  {
    id: 'stats-categorical',
    category: 'methods',
    subcategory: 'statistics',
    template: 'Categorical variables were presented as frequencies and percentages and analyzed using {test}.',
    placeholders: ['test'],
    examples: [
      'Categorical variables were presented as frequencies and percentages and analyzed using chi-square test or Fisher\'s exact test as appropriate.'
    ]
  },
  {
    id: 'stats-regression',
    category: 'methods',
    subcategory: 'statistics',
    template: '{regression_type} regression was used to assess the association between {exposure} and {outcome}, adjusting for {covariates}.',
    placeholders: ['regression_type', 'exposure', 'outcome', 'covariates'],
    examples: [
      'Multivariable logistic regression was used to assess the association between statin use and cardiovascular events, adjusting for age, sex, BMI, hypertension, and baseline LDL cholesterol.'
    ]
  },
  {
    id: 'stats-significance',
    category: 'methods',
    subcategory: 'statistics',
    template: 'A two-sided P value <{threshold} was considered statistically significant.',
    placeholders: ['threshold'],
    examples: [
      'A two-sided P value <0.05 was considered statistically significant.'
    ]
  },
  {
    id: 'stats-software',
    category: 'methods',
    subcategory: 'statistics',
    template: 'All analyses were performed using {software} version {version}.',
    placeholders: ['software', 'version'],
    examples: [
      'All analyses were performed using R version 4.2.1 (R Foundation for Statistical Computing, Vienna, Austria).',
      'All analyses were performed using Stata version 17 (StataCorp, College Station, TX).'
    ]
  }
];

export const RESULTS_PHRASES: PhraseTemplate[] = [
  // Sample Description
  {
    id: 'sample-size',
    category: 'results',
    subcategory: 'participants',
    template: 'A total of {n} patients were included in the analysis.',
    placeholders: ['n'],
    examples: [
      'A total of 1,247 patients were included in the analysis.'
    ]
  },
  {
    id: 'sample-flow',
    category: 'results',
    subcategory: 'participants',
    template: 'Of {screened} patients screened, {excluded} were excluded ({exclusion_reasons}), leaving {final_n} for analysis.',
    placeholders: ['screened', 'excluded', 'exclusion_reasons', 'final_n'],
    examples: [
      'Of 2,500 patients screened, 453 were excluded (312 did not meet inclusion criteria, 141 declined participation), leaving 2,047 for analysis.'
    ]
  },
  // Statistical Results
  {
    id: 'result-continuous',
    category: 'results',
    subcategory: 'outcomes',
    template: 'The mean {variable} was {value} ({measure}: {range}) in the {group1} group compared to {value2} ({measure}: {range2}) in the {group2} group (P{comparison}{p_value}).',
    placeholders: ['variable', 'value', 'measure', 'range', 'group1', 'value2', 'range2', 'group2', 'comparison', 'p_value'],
    examples: [
      'The mean systolic blood pressure was 142.3 (SD: 18.5) mmHg in the treatment group compared to 151.7 (SD: 19.2) mmHg in the control group (P<0.001).'
    ]
  },
  {
    id: 'result-binary',
    category: 'results',
    subcategory: 'outcomes',
    template: '{outcome} occurred in {n1} ({pct1}%) patients in the {group1} group and {n2} ({pct2}%) in the {group2} group ({measure} {value}, 95% CI {ci_lower}-{ci_upper}; P{comparison}{p_value}).',
    placeholders: ['outcome', 'n1', 'pct1', 'group1', 'n2', 'pct2', 'group2', 'measure', 'value', 'ci_lower', 'ci_upper', 'comparison', 'p_value'],
    examples: [
      'Mortality occurred in 45 (12.3%) patients in the intervention group and 78 (21.4%) in the control group (RR 0.57, 95% CI 0.41-0.80; P=0.001).'
    ]
  },
  {
    id: 'result-nonsignificant',
    category: 'results',
    subcategory: 'outcomes',
    template: 'There was no significant difference in {outcome} between groups ({value1} vs {value2}, P={p_value}).',
    placeholders: ['outcome', 'value1', 'value2', 'p_value'],
    examples: [
      'There was no significant difference in length of stay between groups (5.2 vs 5.8 days, P=0.34).'
    ]
  }
];

export const DISCUSSION_PHRASES: PhraseTemplate[] = [
  // Key Findings
  {
    id: 'finding-main',
    category: 'discussion',
    subcategory: 'key_findings',
    template: 'In this {study_type} of {n} {population}, we found that {main_finding}.',
    placeholders: ['study_type', 'n', 'population', 'main_finding'],
    examples: [
      'In this retrospective cohort study of 5,234 patients with heart failure, we found that early initiation of SGLT2 inhibitors was associated with reduced 30-day readmission rates.'
    ]
  },
  // Comparison with Literature
  {
    id: 'comparison-consistent',
    category: 'discussion',
    subcategory: 'comparison',
    template: 'Our findings are consistent with {author} et al., who reported {finding}.',
    placeholders: ['author', 'finding'],
    examples: [
      'Our findings are consistent with Smith et al., who reported similar reductions in cardiovascular events with intensive blood pressure control.'
    ]
  },
  {
    id: 'comparison-contrast',
    category: 'discussion',
    subcategory: 'comparison',
    template: 'In contrast to {author} et al., who found {finding}, our study demonstrated {our_finding}. This discrepancy may be explained by {explanation}.',
    placeholders: ['author', 'finding', 'our_finding', 'explanation'],
    examples: [
      'In contrast to Johnson et al., who found no benefit of the intervention, our study demonstrated significant improvement. This discrepancy may be explained by differences in patient selection and follow-up duration.'
    ]
  },
  // Limitations
  {
    id: 'limitation-design',
    category: 'discussion',
    subcategory: 'limitations',
    template: 'This study has several limitations. First, the {design} design precludes establishing causality.',
    placeholders: ['design'],
    examples: [
      'This study has several limitations. First, the observational design precludes establishing causality.'
    ]
  },
  {
    id: 'limitation-confounding',
    category: 'discussion',
    subcategory: 'limitations',
    template: 'Despite adjustment for multiple confounders, residual confounding from unmeasured variables cannot be excluded.',
    placeholders: [],
    examples: [
      'Despite adjustment for multiple confounders, residual confounding from unmeasured variables cannot be excluded.'
    ]
  },
  {
    id: 'limitation-generalizability',
    category: 'discussion',
    subcategory: 'limitations',
    template: 'The findings may not be generalizable to {populations} given that our study was conducted in {setting}.',
    placeholders: ['populations', 'setting'],
    examples: [
      'The findings may not be generalizable to community-based populations given that our study was conducted in a tertiary academic medical center.'
    ]
  }
];

// Export combined library
export const PHRASE_LIBRARY: PhraseTemplate[] = [
  ...METHODS_PHRASES,
  ...RESULTS_PHRASES,
  ...DISCUSSION_PHRASES
];

/**
 * Get phrases by category
 */
export function getPhrasesByCategory(category: string): PhraseTemplate[] {
  return PHRASE_LIBRARY.filter(p => p.category === category);
}

/**
 * Get phrases by subcategory
 */
export function getPhrasesBySubcategory(category: string, subcategory: string): PhraseTemplate[] {
  return PHRASE_LIBRARY.filter(p => p.category === category && p.subcategory === subcategory);
}

/**
 * Fill placeholders in template
 */
export function fillTemplate(template: PhraseTemplate, values: Record<string, string>): string {
  let result = template.template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return result;
}
```

---

## Verification Checklist - Phase 4

- [ ] OpenAI drafter generates section content
- [ ] Claude writer produces reasoned output
- [ ] Grammar checker identifies medical writing issues
- [ ] Claim verifier links claims to evidence
- [ ] Readability service calculates all metrics
- [ ] Phrase library covers methods/results/discussion
- [ ] All services integrate with PHI scanning
- [ ] AI outputs are logged for audit

## Next Phase

Proceed to **PHASE_5_REVIEW_EXPORT.md** for Tasks 81-100.
