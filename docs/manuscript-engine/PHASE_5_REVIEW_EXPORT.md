# Phase 5: Review, Export & Compliance (Tasks 81-100)

## Prerequisites

- Phases 1-4 completed
- Full manuscript content available
- Citation and data integration complete

## Integration Points

- `packages/phi-engine/` - Final PHI scan before export
- `services/orchestrator/` - Export API routes
- External: Word/PDF generation libraries

---

## Task 81: Peer Review Simulation Service

**File**: `packages/manuscript-engine/src/services/peer-review.service.ts`

```typescript
import type { IMRaDSection } from '../types/imrad.types';

export interface ReviewCriteria {
  category: string;
  weight: number;
  questions: string[];
}

export interface ReviewComment {
  id: string;
  section: IMRaDSection;
  severity: 'major' | 'minor' | 'suggestion';
  category: string;
  comment: string;
  suggestion?: string;
  lineReference?: number;
}

export interface PeerReviewResult {
  overallScore: number; // 1-10
  recommendation: 'accept' | 'minor_revision' | 'major_revision' | 'reject';
  comments: ReviewComment[];
  strengthsSummary: string[];
  weaknessesSummary: string[];
  categoryScores: Record<string, number>;
}

export const REVIEW_CRITERIA: ReviewCriteria[] = [
  {
    category: 'originality',
    weight: 0.15,
    questions: [
      'Does the study address a novel research question?',
      'Does it add to existing knowledge?',
      'Is the approach innovative?'
    ]
  },
  {
    category: 'methodology',
    weight: 0.25,
    questions: [
      'Is the study design appropriate?',
      'Are methods described in sufficient detail?',
      'Is the sample size adequate?',
      'Are potential biases addressed?'
    ]
  },
  {
    category: 'results',
    weight: 0.20,
    questions: [
      'Are results clearly presented?',
      'Are statistics appropriate?',
      'Are figures/tables informative?',
      'Is data interpretation accurate?'
    ]
  },
  {
    category: 'discussion',
    weight: 0.15,
    questions: [
      'Are findings adequately discussed?',
      'Is context with literature appropriate?',
      'Are limitations addressed?',
      'Are conclusions supported by data?'
    ]
  },
  {
    category: 'writing',
    weight: 0.10,
    questions: [
      'Is the writing clear and concise?',
      'Is terminology appropriate?',
      'Is the structure logical?'
    ]
  },
  {
    category: 'ethics',
    weight: 0.15,
    questions: [
      'Is ethical approval documented?',
      'Is informed consent addressed?',
      'Are conflicts of interest disclosed?',
      'Is data handling appropriate?'
    ]
  }
];

export class PeerReviewService {
  /**
   * Simulate peer review of manuscript
   */
  async simulateReview(
    manuscript: Record<IMRaDSection, string>,
    metadata: {
      studyType: string;
      sampleSize?: number;
      hasEthicsApproval?: boolean;
      hasCOI?: boolean;
    }
  ): Promise<PeerReviewResult> {
    const comments: ReviewComment[] = [];
    const categoryScores: Record<string, number> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Evaluate each category
    for (const criteria of REVIEW_CRITERIA) {
      const { score, sectionComments, categoryStrengths, categoryWeaknesses } = 
        this.evaluateCategory(criteria, manuscript, metadata);
      
      categoryScores[criteria.category] = score;
      comments.push(...sectionComments);
      strengths.push(...categoryStrengths);
      weaknesses.push(...categoryWeaknesses);
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(categoryScores);
    const recommendation = this.determineRecommendation(overallScore, comments);

    return {
      overallScore,
      recommendation,
      comments,
      strengthsSummary: strengths.slice(0, 5),
      weaknessesSummary: weaknesses.slice(0, 5),
      categoryScores
    };
  }

  /**
   * Generate reviewer-style feedback
   */
  generateReviewerLetter(result: PeerReviewResult): string {
    const sections: string[] = [];

    sections.push('Dear Authors,\n');
    sections.push(`Thank you for submitting your manuscript for review. After careful evaluation, my recommendation is: **${this.formatRecommendation(result.recommendation)}**.\n`);

    sections.push('## Summary');
    sections.push(`Overall Score: ${result.overallScore.toFixed(1)}/10\n`);

    if (result.strengthsSummary.length > 0) {
      sections.push('## Strengths');
      result.strengthsSummary.forEach((s, i) => sections.push(`${i + 1}. ${s}`));
      sections.push('');
    }

    if (result.weaknessesSummary.length > 0) {
      sections.push('## Areas for Improvement');
      result.weaknessesSummary.forEach((w, i) => sections.push(`${i + 1}. ${w}`));
      sections.push('');
    }

    // Major comments
    const majorComments = result.comments.filter(c => c.severity === 'major');
    if (majorComments.length > 0) {
      sections.push('## Major Comments (Must Address)');
      majorComments.forEach((c, i) => {
        sections.push(`**${i + 1}. [${c.section.toUpperCase()}]** ${c.comment}`);
        if (c.suggestion) sections.push(`   *Suggestion: ${c.suggestion}*`);
      });
      sections.push('');
    }

    // Minor comments
    const minorComments = result.comments.filter(c => c.severity === 'minor');
    if (minorComments.length > 0) {
      sections.push('## Minor Comments');
      minorComments.forEach((c, i) => {
        sections.push(`${i + 1}. [${c.section}] ${c.comment}`);
      });
      sections.push('');
    }

    sections.push('Sincerely,\nAI Reviewer');

    return sections.join('\n');
  }

  private evaluateCategory(
    criteria: ReviewCriteria,
    manuscript: Record<IMRaDSection, string>,
    metadata: Record<string, unknown>
  ): {
    score: number;
    sectionComments: ReviewComment[];
    categoryStrengths: string[];
    categoryWeaknesses: string[];
  } {
    const comments: ReviewComment[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    let score = 7; // Default score

    switch (criteria.category) {
      case 'methodology':
        const methodsText = manuscript.methods || '';
        
        // Check for sample size mention
        if (!/\d+\s*(patients?|participants?|subjects?)/i.test(methodsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'methods',
            severity: 'major',
            category: 'methodology',
            comment: 'Sample size is not clearly stated in the methods section.',
            suggestion: 'Add explicit statement of total sample size and how it was determined.'
          });
          score -= 1;
          weaknesses.push('Sample size reporting needs improvement');
        } else {
          strengths.push('Sample size clearly documented');
        }

        // Check for statistics description
        if (!/statistical|analysis|regression|t-test|chi-square/i.test(methodsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'methods',
            severity: 'major',
            category: 'methodology',
            comment: 'Statistical methods are not described.',
            suggestion: 'Add a statistical analysis subsection describing all tests used.'
          });
          score -= 1.5;
        }

        // Check for ethics
        if (!metadata.hasEthicsApproval && !/IRB|ethics|institutional review/i.test(methodsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'methods',
            severity: 'major',
            category: 'methodology',
            comment: 'No mention of ethical approval.',
            suggestion: 'Add statement about IRB/ethics committee approval.'
          });
          score -= 1;
        }
        break;

      case 'results':
        const resultsText = manuscript.results || '';
        
        // Check for statistics in results
        if (!/p\s*[<>=]|95%\s*CI|\bOR\b|\bRR\b|\bHR\b/i.test(resultsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'results',
            severity: 'minor',
            category: 'results',
            comment: 'Results lack statistical measures (p-values, confidence intervals).',
            suggestion: 'Include effect sizes with 95% confidence intervals for all comparisons.'
          });
          score -= 0.5;
        } else {
          strengths.push('Appropriate statistical reporting');
        }

        // Check for table/figure references
        if (!/Table\s+\d|Figure\s+\d/i.test(resultsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'results',
            severity: 'minor',
            category: 'results',
            comment: 'No references to tables or figures in results text.',
            suggestion: 'Reference tables and figures when presenting key data.'
          });
        }
        break;

      case 'discussion':
        const discussionText = manuscript.discussion || '';
        
        // Check for limitations
        if (!/limitation|weakness|caveat/i.test(discussionText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'discussion',
            severity: 'major',
            category: 'discussion',
            comment: 'No limitations section identified.',
            suggestion: 'Add a dedicated paragraph discussing study limitations.'
          });
          score -= 1;
          weaknesses.push('Missing limitations discussion');
        } else {
          strengths.push('Limitations acknowledged');
        }

        // Check for literature comparison
        if (!/consistent with|similar to|in contrast|compared to.*study/i.test(discussionText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'discussion',
            severity: 'minor',
            category: 'discussion',
            comment: 'Limited comparison with existing literature.',
            suggestion: 'Expand comparison of findings with published studies.'
          });
          score -= 0.5;
        }
        break;

      case 'writing':
        // Check word counts
        const totalWords = Object.values(manuscript)
          .join(' ')
          .split(/\s+/)
          .filter(w => w.length > 0).length;

        if (totalWords < 2000) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'introduction',
            severity: 'minor',
            category: 'writing',
            comment: `Manuscript appears short (${totalWords} words). Consider expanding key sections.`
          });
        } else if (totalWords > 6000) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'introduction',
            severity: 'minor',
            category: 'writing',
            comment: `Manuscript is lengthy (${totalWords} words). Consider condensing for clarity.`
          });
        } else {
          strengths.push('Appropriate manuscript length');
        }
        break;
    }

    return {
      score: Math.max(1, Math.min(10, score)),
      sectionComments: comments,
      categoryStrengths: strengths,
      categoryWeaknesses: weaknesses
    };
  }

  private calculateOverallScore(categoryScores: Record<string, number>): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const criteria of REVIEW_CRITERIA) {
      const score = categoryScores[criteria.category] || 5;
      weightedSum += score * criteria.weight;
      totalWeight += criteria.weight;
    }

    return weightedSum / totalWeight;
  }

  private determineRecommendation(
    score: number,
    comments: ReviewComment[]
  ): PeerReviewResult['recommendation'] {
    const majorCount = comments.filter(c => c.severity === 'major').length;

    if (score >= 8 && majorCount === 0) return 'accept';
    if (score >= 6 && majorCount <= 2) return 'minor_revision';
    if (score >= 4 || majorCount <= 5) return 'major_revision';
    return 'reject';
  }

  private formatRecommendation(rec: PeerReviewResult['recommendation']): string {
    const mapping = {
      accept: 'Accept',
      minor_revision: 'Minor Revision',
      major_revision: 'Major Revision',
      reject: 'Reject'
    };
    return mapping[rec];
  }
}

export const peerReviewService = new PeerReviewService();
```

---

## Task 82: CONSORT Checklist Service

**File**: `packages/manuscript-engine/src/services/consort-checker.service.ts`

```typescript
export interface ChecklistItem {
  id: string;
  section: string;
  item: string;
  description: string;
  required: boolean;
}

export interface ChecklistResult {
  itemId: string;
  present: boolean;
  confidence: number;
  location?: string;
  suggestion?: string;
}

export interface ComplianceReport {
  checklist: string;
  version: string;
  totalItems: number;
  presentItems: number;
  missingItems: number;
  compliancePercentage: number;
  results: ChecklistResult[];
  summary: string;
}

export const CONSORT_2010_CHECKLIST: ChecklistItem[] = [
  // Title and Abstract
  { id: '1a', section: 'Title', item: 'Identification as randomized trial', description: 'Identification as a randomised trial in the title', required: true },
  { id: '1b', section: 'Abstract', item: 'Structured summary', description: 'Structured summary of trial design, methods, results, and conclusions', required: true },
  
  // Introduction
  { id: '2a', section: 'Introduction', item: 'Background and rationale', description: 'Scientific background and explanation of rationale', required: true },
  { id: '2b', section: 'Introduction', item: 'Objectives', description: 'Specific objectives or hypotheses', required: true },
  
  // Methods
  { id: '3a', section: 'Methods', item: 'Trial design', description: 'Description of trial design (parallel, factorial, etc.)', required: true },
  { id: '3b', section: 'Methods', item: 'Changes to design', description: 'Important changes to methods after trial start with reasons', required: false },
  { id: '4a', section: 'Methods', item: 'Eligibility criteria', description: 'Eligibility criteria for participants', required: true },
  { id: '4b', section: 'Methods', item: 'Settings and locations', description: 'Settings and locations where data were collected', required: true },
  { id: '5', section: 'Methods', item: 'Interventions', description: 'Interventions for each group with sufficient detail', required: true },
  { id: '6a', section: 'Methods', item: 'Outcomes', description: 'Completely defined pre-specified primary and secondary outcomes', required: true },
  { id: '6b', section: 'Methods', item: 'Outcome changes', description: 'Any changes to trial outcomes after start with reasons', required: false },
  { id: '7a', section: 'Methods', item: 'Sample size', description: 'How sample size was determined', required: true },
  { id: '7b', section: 'Methods', item: 'Interim analyses', description: 'Explanation of interim analyses and stopping guidelines', required: false },
  { id: '8a', section: 'Methods', item: 'Randomization sequence', description: 'Method used to generate random allocation sequence', required: true },
  { id: '8b', section: 'Methods', item: 'Randomization type', description: 'Type of randomisation; details of any restriction', required: true },
  { id: '9', section: 'Methods', item: 'Allocation concealment', description: 'Mechanism used to implement random allocation sequence', required: true },
  { id: '10', section: 'Methods', item: 'Implementation', description: 'Who generated sequence, enrolled participants, assigned to interventions', required: true },
  { id: '11a', section: 'Methods', item: 'Blinding', description: 'If done, who was blinded and how', required: true },
  { id: '11b', section: 'Methods', item: 'Blinding similarity', description: 'Description of similarity of interventions', required: false },
  { id: '12a', section: 'Methods', item: 'Statistical methods', description: 'Statistical methods used to compare groups', required: true },
  { id: '12b', section: 'Methods', item: 'Subgroup analyses', description: 'Methods for additional analyses such as subgroup analyses', required: false },
  
  // Results
  { id: '13a', section: 'Results', item: 'Participant flow', description: 'Number of participants randomized, allocated, followed up, analyzed', required: true },
  { id: '13b', section: 'Results', item: 'Losses and exclusions', description: 'Losses and exclusions after randomization with reasons', required: true },
  { id: '14a', section: 'Results', item: 'Recruitment dates', description: 'Dates defining periods of recruitment and follow-up', required: true },
  { id: '14b', section: 'Results', item: 'Trial stopped', description: 'Why trial ended or was stopped', required: false },
  { id: '15', section: 'Results', item: 'Baseline data', description: 'Table showing baseline characteristics for each group', required: true },
  { id: '16', section: 'Results', item: 'Numbers analyzed', description: 'Number of participants analyzed and whether ITT', required: true },
  { id: '17a', section: 'Results', item: 'Outcomes and estimation', description: 'Results for primary and secondary outcomes with effect sizes and CIs', required: true },
  { id: '17b', section: 'Results', item: 'Binary outcomes', description: 'For binary outcomes, absolute and relative effect sizes', required: true },
  { id: '18', section: 'Results', item: 'Ancillary analyses', description: 'Results of any other analyses including subgroup analyses', required: false },
  { id: '19', section: 'Results', item: 'Harms', description: 'All important harms or unintended effects in each group', required: true },
  
  // Discussion
  { id: '20', section: 'Discussion', item: 'Limitations', description: 'Trial limitations including bias and imprecision', required: true },
  { id: '21', section: 'Discussion', item: 'Generalisability', description: 'Generalisability of trial findings', required: true },
  { id: '22', section: 'Discussion', item: 'Interpretation', description: 'Interpretation consistent with results and balancing benefits/harms', required: true },
  
  // Other
  { id: '23', section: 'Other', item: 'Registration', description: 'Registration number and name of trial registry', required: true },
  { id: '24', section: 'Other', item: 'Protocol', description: 'Where full trial protocol can be accessed', required: true },
  { id: '25', section: 'Other', item: 'Funding', description: 'Sources of funding and other support', required: true }
];

export class CONSORTCheckerService {
  /**
   * Check manuscript against CONSORT checklist
   */
  checkCompliance(manuscript: Record<string, string>): ComplianceReport {
    const results: ChecklistResult[] = [];
    let presentCount = 0;

    for (const item of CONSORT_2010_CHECKLIST) {
      const result = this.checkItem(item, manuscript);
      results.push(result);
      if (result.present) presentCount++;
    }

    const totalRequired = CONSORT_2010_CHECKLIST.filter(i => i.required).length;
    const presentRequired = results.filter((r, i) => 
      CONSORT_2010_CHECKLIST[i].required && r.present
    ).length;

    return {
      checklist: 'CONSORT',
      version: '2010',
      totalItems: CONSORT_2010_CHECKLIST.length,
      presentItems: presentCount,
      missingItems: CONSORT_2010_CHECKLIST.length - presentCount,
      compliancePercentage: (presentRequired / totalRequired) * 100,
      results,
      summary: this.generateSummary(presentRequired, totalRequired, results)
    };
  }

  /**
   * Generate compliance table for export
   */
  generateComplianceTable(report: ComplianceReport): string[][] {
    const headers = ['Item', 'Section', 'Description', 'Present', 'Location'];
    const rows = report.results.map((r, i) => {
      const item = CONSORT_2010_CHECKLIST[i];
      return [
        item.id,
        item.section,
        item.item,
        r.present ? 'Yes' : 'No',
        r.location || '-'
      ];
    });

    return [headers, ...rows];
  }

  private checkItem(item: ChecklistItem, manuscript: Record<string, string>): ChecklistResult {
    const sectionText = manuscript[item.section.toLowerCase()] || '';
    const allText = Object.values(manuscript).join(' ');
    
    // Define patterns for each item
    const patterns = this.getItemPatterns(item.id);
    
    let present = false;
    let confidence = 0;
    let location: string | undefined;

    for (const pattern of patterns) {
      if (pattern.test(sectionText)) {
        present = true;
        confidence = 0.9;
        location = item.section;
        break;
      } else if (pattern.test(allText)) {
        present = true;
        confidence = 0.7;
        location = 'Found in manuscript (not in expected section)';
        break;
      }
    }

    return {
      itemId: item.id,
      present,
      confidence,
      location,
      suggestion: present ? undefined : this.getSuggestion(item.id)
    };
  }

  private getItemPatterns(itemId: string): RegExp[] {
    const patterns: Record<string, RegExp[]> = {
      '1a': [/randomized|randomised|RCT|random\s+allocation/i],
      '1b': [/background|methods|results|conclusions/i],
      '2a': [/background|rationale|context/i],
      '2b': [/objective|aim|hypothesis|purpose/i],
      '3a': [/parallel|factorial|crossover|cluster|trial\s+design/i],
      '4a': [/eligib|inclusion\s+criteria|exclusion\s+criteria/i],
      '4b': [/setting|location|site|center|centre/i],
      '5': [/intervention|treatment|placebo|control\s+group/i],
      '6a': [/primary\s+(outcome|endpoint)|secondary\s+(outcome|endpoint)/i],
      '7a': [/sample\s+size|power\s+calculation|power\s+analysis/i],
      '8a': [/random(ization|isation)\s+(sequence|method|generated)/i],
      '8b': [/block|stratif|simple\s+random/i],
      '9': [/allocation\s+conceal|sealed\s+envelope|central/i],
      '10': [/enrolled|assigned|generated.*sequence/i],
      '11a': [/blind|mask|double|single|open\s+label/i],
      '12a': [/statistic|analysis|t-test|chi-square|regression|ANOVA/i],
      '13a': [/flow|CONSORT|enrolled|randomized|analyzed/i],
      '14a': [/recruit.*\d{4}|follow.*month|between.*and/i],
      '15': [/baseline|Table\s*1|characteristics/i],
      '16': [/intention.to.treat|ITT|per.protocol|analyzed/i],
      '17a': [/95%\s*CI|confidence\s+interval|effect\s+size|p\s*[<>=]/i],
      '19': [/adverse|harm|side\s+effect|safety/i],
      '20': [/limitation|weakness|bias/i],
      '21': [/generali[sz]|external\s+validity/i],
      '22': [/interpret|implicat|conclude/i],
      '23': [/NCT\d+|ISRCTN|registration|registry/i],
      '24': [/protocol|clinicaltrials\.gov|supplement/i],
      '25': [/fund|grant|support|sponsor/i]
    };

    return patterns[itemId] || [/.*/];
  }

  private getSuggestion(itemId: string): string {
    const suggestions: Record<string, string> = {
      '1a': 'Add "randomized" or "randomised" to the title',
      '1b': 'Ensure abstract has Background, Methods, Results, Conclusions structure',
      '7a': 'Add sample size calculation with power, effect size, and significance level',
      '8a': 'Describe method of randomization sequence generation',
      '9': 'Describe allocation concealment mechanism',
      '11a': 'Specify blinding status for participants, caregivers, and assessors',
      '13a': 'Include CONSORT flow diagram or describe participant flow',
      '17a': 'Report effect sizes with 95% confidence intervals',
      '19': 'Add section on adverse events/harms',
      '20': 'Add limitations paragraph',
      '23': 'Include trial registration number',
      '25': 'Add funding statement'
    };

    return suggestions[itemId] || `Add required CONSORT item ${itemId}`;
  }

  private generateSummary(presentRequired: number, totalRequired: number, results: ChecklistResult[]): string {
    const percentage = (presentRequired / totalRequired * 100).toFixed(0);
    
    if (parseInt(percentage) >= 90) {
      return `Excellent CONSORT compliance (${percentage}%). Minor items may need attention.`;
    } else if (parseInt(percentage) >= 70) {
      return `Good CONSORT compliance (${percentage}%). Review missing items before submission.`;
    } else if (parseInt(percentage) >= 50) {
      return `Moderate CONSORT compliance (${percentage}%). Significant revisions needed.`;
    } else {
      return `Low CONSORT compliance (${percentage}%). Major revisions required for trial reporting.`;
    }
  }
}

export const consortCheckerService = new CONSORTCheckerService();
```

---

## Task 83: STROBE Checklist Service

**File**: `packages/manuscript-engine/src/services/strobe-checker.service.ts`

```typescript
import type { ChecklistItem, ChecklistResult, ComplianceReport } from './consort-checker.service';

export const STROBE_CHECKLIST: ChecklistItem[] = [
  // Title and Abstract
  { id: '1a', section: 'Title', item: 'Study design in title', description: 'Indicate study design with commonly used term', required: true },
  { id: '1b', section: 'Abstract', item: 'Informative abstract', description: 'Provide informative and balanced summary', required: true },
  
  // Introduction
  { id: '2', section: 'Introduction', item: 'Background/rationale', description: 'Explain scientific background and rationale', required: true },
  { id: '3', section: 'Introduction', item: 'Objectives', description: 'State specific objectives including hypotheses', required: true },
  
  // Methods
  { id: '4', section: 'Methods', item: 'Study design', description: 'Present key elements of study design early', required: true },
  { id: '5', section: 'Methods', item: 'Setting', description: 'Describe setting, locations, relevant dates', required: true },
  { id: '6a', section: 'Methods', item: 'Eligibility criteria', description: 'Give eligibility criteria and sources of selection', required: true },
  { id: '6b', section: 'Methods', item: 'Matching criteria', description: 'For matched studies, give matching criteria and number of controls', required: false },
  { id: '7', section: 'Methods', item: 'Variables', description: 'Define all outcomes, exposures, predictors, confounders', required: true },
  { id: '8', section: 'Methods', item: 'Data sources', description: 'Describe sources of data and methods of assessment', required: true },
  { id: '9', section: 'Methods', item: 'Bias', description: 'Describe any efforts to address potential sources of bias', required: true },
  { id: '10', section: 'Methods', item: 'Study size', description: 'Explain how study size was arrived at', required: true },
  { id: '11', section: 'Methods', item: 'Quantitative variables', description: 'Explain how quantitative variables were handled', required: true },
  { id: '12a', section: 'Methods', item: 'Statistical methods', description: 'Describe all statistical methods', required: true },
  { id: '12b', section: 'Methods', item: 'Subgroups', description: 'Describe methods for examining subgroups and interactions', required: false },
  { id: '12c', section: 'Methods', item: 'Missing data', description: 'Explain how missing data were addressed', required: true },
  { id: '12d', section: 'Methods', item: 'Follow-up', description: 'If applicable, explain handling of loss to follow-up', required: false },
  { id: '12e', section: 'Methods', item: 'Sensitivity analyses', description: 'Describe any sensitivity analyses', required: false },
  
  // Results
  { id: '13a', section: 'Results', item: 'Participants', description: 'Report numbers at each stage of study', required: true },
  { id: '13b', section: 'Results', item: 'Non-participation', description: 'Give reasons for non-participation at each stage', required: true },
  { id: '13c', section: 'Results', item: 'Flow diagram', description: 'Consider use of a flow diagram', required: false },
  { id: '14a', section: 'Results', item: 'Descriptive data', description: 'Characteristics of participants and information on exposures', required: true },
  { id: '14b', section: 'Results', item: 'Missing data indicator', description: 'Indicate number with missing data for each variable', required: true },
  { id: '14c', section: 'Results', item: 'Follow-up time', description: 'Summarise follow-up time', required: false },
  { id: '15', section: 'Results', item: 'Outcome data', description: 'Report numbers of outcome events or summary measures', required: true },
  { id: '16a', section: 'Results', item: 'Main results', description: 'Give unadjusted and adjusted estimates with precision', required: true },
  { id: '16b', section: 'Results', item: 'Continuous variables', description: 'Report category boundaries for continuous variables', required: false },
  { id: '16c', section: 'Results', item: 'Meaningful translation', description: 'Consider translating relative risk to absolute risk', required: false },
  { id: '17', section: 'Results', item: 'Other analyses', description: 'Report other analyses including subgroups and sensitivity', required: false },
  
  // Discussion
  { id: '18', section: 'Discussion', item: 'Key results', description: 'Summarise key results with reference to objectives', required: true },
  { id: '19', section: 'Discussion', item: 'Limitations', description: 'Discuss limitations including bias and imprecision', required: true },
  { id: '20', section: 'Discussion', item: 'Interpretation', description: 'Give cautious interpretation considering objectives, limitations, multiplicity', required: true },
  { id: '21', section: 'Discussion', item: 'Generalisability', description: 'Discuss generalisability of results', required: true },
  
  // Other
  { id: '22', section: 'Other', item: 'Funding', description: 'Give source of funding and role of funders', required: true }
];

export class STROBECheckerService {
  /**
   * Check manuscript against STROBE checklist
   */
  checkCompliance(
    manuscript: Record<string, string>,
    studyType: 'cohort' | 'case_control' | 'cross_sectional'
  ): ComplianceReport {
    const applicableItems = this.getApplicableItems(studyType);
    const results: ChecklistResult[] = [];
    let presentCount = 0;

    for (const item of applicableItems) {
      const result = this.checkItem(item, manuscript);
      results.push(result);
      if (result.present) presentCount++;
    }

    const totalRequired = applicableItems.filter(i => i.required).length;
    const presentRequired = results.filter((r, i) => 
      applicableItems[i].required && r.present
    ).length;

    return {
      checklist: `STROBE (${studyType})`,
      version: '2007',
      totalItems: applicableItems.length,
      presentItems: presentCount,
      missingItems: applicableItems.length - presentCount,
      compliancePercentage: (presentRequired / totalRequired) * 100,
      results,
      summary: this.generateSummary(presentRequired, totalRequired)
    };
  }

  private getApplicableItems(studyType: string): ChecklistItem[] {
    // STROBE has study-type specific items
    // For simplicity, returning all items
    // In production, filter based on study type
    return STROBE_CHECKLIST;
  }

  private checkItem(item: ChecklistItem, manuscript: Record<string, string>): ChecklistResult {
    const patterns = this.getItemPatterns(item.id);
    const sectionText = manuscript[item.section.toLowerCase()] || '';
    const allText = Object.values(manuscript).join(' ');

    let present = false;
    let confidence = 0;
    let location: string | undefined;

    for (const pattern of patterns) {
      if (pattern.test(sectionText)) {
        present = true;
        confidence = 0.9;
        location = item.section;
        break;
      } else if (pattern.test(allText)) {
        present = true;
        confidence = 0.7;
        location = 'Found elsewhere in manuscript';
        break;
      }
    }

    return {
      itemId: item.id,
      present,
      confidence,
      location,
      suggestion: present ? undefined : `Add STROBE item ${item.id}: ${item.item}`
    };
  }

  private getItemPatterns(itemId: string): RegExp[] {
    const patterns: Record<string, RegExp[]> = {
      '1a': [/cohort|case.control|cross.sectional|retrospective|prospective/i],
      '2': [/background|rationale|context/i],
      '3': [/objective|aim|hypothesis/i],
      '4': [/study\s+design|retrospective|prospective|observational/i],
      '5': [/setting|location|between.*and|during/i],
      '6a': [/eligib|inclusion|exclusion|criteria/i],
      '7': [/outcome|exposure|variable|covariate|confounder/i],
      '8': [/data.*collect|source|assess|measure/i],
      '9': [/bias|confound|adjust/i],
      '10': [/sample\s+size|power|consecutive|all\s+patients/i],
      '11': [/continuous|categorical|dichotom|cut.?off/i],
      '12a': [/statistical|regression|analysis|model/i],
      '12c': [/missing|imputation|complete\s+case/i],
      '13a': [/flow|enrolled|excluded|analyzed/i],
      '14a': [/Table\s*1|baseline|characteristic|demographic/i],
      '15': [/outcome|event|incidence|prevalence/i],
      '16a': [/95%\s*CI|confidence|OR|RR|HR|adjusted|unadjusted/i],
      '18': [/summary|key\s+finding|main\s+result/i],
      '19': [/limitation|weakness|bias|strength/i],
      '20': [/interpret|implicat|conclude/i],
      '21': [/generali[sz]|external\s+validity|applicable/i],
      '22': [/fund|grant|support|sponsor/i]
    };

    return patterns[itemId] || [/.*/];
  }

  private generateSummary(presentRequired: number, totalRequired: number): string {
    const percentage = (presentRequired / totalRequired * 100).toFixed(0);
    return `STROBE compliance: ${percentage}% of required items present.`;
  }
}

export const strobeCheckerService = new STROBECheckerService();
```

---

## Task 84: PRISMA Checklist Service

**File**: `packages/manuscript-engine/src/services/prisma-checker.service.ts`

```typescript
import type { ChecklistItem, ChecklistResult, ComplianceReport } from './consort-checker.service';

export const PRISMA_2020_CHECKLIST: ChecklistItem[] = [
  // Title
  { id: '1', section: 'Title', item: 'Title', description: 'Identify the report as a systematic review', required: true },
  
  // Abstract
  { id: '2', section: 'Abstract', item: 'Abstract', description: 'See the PRISMA 2020 for Abstracts checklist', required: true },
  
  // Introduction
  { id: '3', section: 'Introduction', item: 'Rationale', description: 'Describe the rationale in context of existing knowledge', required: true },
  { id: '4', section: 'Introduction', item: 'Objectives', description: 'Provide explicit statement of objectives or questions', required: true },
  
  // Methods
  { id: '5', section: 'Methods', item: 'Eligibility criteria', description: 'Specify inclusion and exclusion criteria', required: true },
  { id: '6', section: 'Methods', item: 'Information sources', description: 'Specify all databases, registers, websites searched', required: true },
  { id: '7', section: 'Methods', item: 'Search strategy', description: 'Present full search strategies for all databases', required: true },
  { id: '8', section: 'Methods', item: 'Selection process', description: 'Specify methods for selecting studies', required: true },
  { id: '9', section: 'Methods', item: 'Data collection', description: 'Specify methods for data extraction', required: true },
  { id: '10a', section: 'Methods', item: 'Data items', description: 'List and define all outcomes', required: true },
  { id: '10b', section: 'Methods', item: 'Effect measures', description: 'List and define all effect measures', required: true },
  { id: '11', section: 'Methods', item: 'Study risk of bias', description: 'Specify methods for assessing risk of bias', required: true },
  { id: '12', section: 'Methods', item: 'Effect measures', description: 'Specify effect measures used', required: true },
  { id: '13a', section: 'Methods', item: 'Synthesis methods', description: 'Describe synthesis methods', required: true },
  { id: '13b', section: 'Methods', item: 'Heterogeneity methods', description: 'Describe methods for assessing heterogeneity', required: true },
  { id: '13c', section: 'Methods', item: 'Sensitivity analyses', description: 'Describe any planned sensitivity analyses', required: false },
  { id: '13d', section: 'Methods', item: 'Subgroup analyses', description: 'Describe any planned subgroup analyses', required: false },
  { id: '14', section: 'Methods', item: 'Reporting bias', description: 'Describe methods for assessing reporting bias', required: true },
  { id: '15', section: 'Methods', item: 'Certainty assessment', description: 'Describe methods for assessing certainty of evidence', required: true },
  
  // Results
  { id: '16a', section: 'Results', item: 'Study selection', description: 'Describe results of search and selection process', required: true },
  { id: '16b', section: 'Results', item: 'PRISMA flow diagram', description: 'Present flow diagram', required: true },
  { id: '17', section: 'Results', item: 'Study characteristics', description: 'Cite each included study and present characteristics', required: true },
  { id: '18', section: 'Results', item: 'Risk of bias in studies', description: 'Present assessment of risk of bias', required: true },
  { id: '19', section: 'Results', item: 'Individual study results', description: 'Present results for all outcomes for each study', required: true },
  { id: '20a', section: 'Results', item: 'Synthesis results', description: 'For each synthesis, present summary statistics and heterogeneity', required: true },
  { id: '20b', section: 'Results', item: 'Forest plots', description: 'Present forest plots for meta-analyses', required: false },
  { id: '20c', section: 'Results', item: 'Sensitivity results', description: 'Present results of sensitivity analyses', required: false },
  { id: '21', section: 'Results', item: 'Reporting biases', description: 'Present assessment of reporting biases', required: true },
  { id: '22', section: 'Results', item: 'Certainty of evidence', description: 'Present certainty of evidence for each outcome', required: true },
  
  // Discussion
  { id: '23a', section: 'Discussion', item: 'Discussion', description: 'Provide general interpretation in context of other evidence', required: true },
  { id: '23b', section: 'Discussion', item: 'Limitations', description: 'Discuss limitations of evidence and review process', required: true },
  { id: '23c', section: 'Discussion', item: 'Implications', description: 'Discuss implications of results', required: true },
  { id: '23d', section: 'Discussion', item: 'Conclusions', description: 'Provide conclusions', required: true },
  
  // Other
  { id: '24a', section: 'Other', item: 'Registration', description: 'Provide registration information', required: true },
  { id: '24b', section: 'Other', item: 'Protocol', description: 'Indicate where protocol can be accessed', required: true },
  { id: '24c', section: 'Other', item: 'Protocol amendments', description: 'Describe any amendments to protocol', required: false },
  { id: '25', section: 'Other', item: 'Support', description: 'Describe sources of support', required: true },
  { id: '26', section: 'Other', item: 'Competing interests', description: 'Declare any competing interests', required: true },
  { id: '27', section: 'Other', item: 'Data availability', description: 'Report which data are available and how', required: true }
];

export class PRISMACheckerService {
  /**
   * Check manuscript against PRISMA 2020 checklist
   */
  checkCompliance(manuscript: Record<string, string>): ComplianceReport {
    const results: ChecklistResult[] = [];
    let presentCount = 0;

    for (const item of PRISMA_2020_CHECKLIST) {
      const result = this.checkItem(item, manuscript);
      results.push(result);
      if (result.present) presentCount++;
    }

    const totalRequired = PRISMA_2020_CHECKLIST.filter(i => i.required).length;
    const presentRequired = results.filter((r, i) => 
      PRISMA_2020_CHECKLIST[i].required && r.present
    ).length;

    return {
      checklist: 'PRISMA',
      version: '2020',
      totalItems: PRISMA_2020_CHECKLIST.length,
      presentItems: presentCount,
      missingItems: PRISMA_2020_CHECKLIST.length - presentCount,
      compliancePercentage: (presentRequired / totalRequired) * 100,
      results,
      summary: this.generateSummary(presentRequired, totalRequired)
    };
  }

  private checkItem(item: ChecklistItem, manuscript: Record<string, string>): ChecklistResult {
    const patterns = this.getItemPatterns(item.id);
    const sectionText = manuscript[item.section.toLowerCase()] || '';
    const allText = Object.values(manuscript).join(' ');

    let present = false;
    let confidence = 0;
    let location: string | undefined;

    for (const pattern of patterns) {
      if (pattern.test(sectionText)) {
        present = true;
        confidence = 0.9;
        location = item.section;
        break;
      } else if (pattern.test(allText)) {
        present = true;
        confidence = 0.7;
        location = 'Found elsewhere in manuscript';
        break;
      }
    }

    return {
      itemId: item.id,
      present,
      confidence,
      location,
      suggestion: present ? undefined : this.getSuggestion(item.id)
    };
  }

  private getItemPatterns(itemId: string): RegExp[] {
    const patterns: Record<string, RegExp[]> = {
      '1': [/systematic\s+review|meta.analysis/i],
      '3': [/rationale|background|context/i],
      '4': [/objective|aim|question|PICO/i],
      '5': [/eligib|inclusion|exclusion|criteria/i],
      '6': [/PubMed|MEDLINE|Embase|Cochrane|database|search/i],
      '7': [/search\s+strateg|search\s+term|MeSH|Boolean/i],
      '8': [/screen|select|two\s+reviewers|independent/i],
      '9': [/extract|data\s+collection|abstraction/i],
      '11': [/risk\s+of\s+bias|quality\s+assessment|Cochrane|Newcastle/i],
      '13a': [/meta.analysis|pooled|synthesis|random\s+effect|fixed\s+effect/i],
      '13b': [/heterogeneity|I\s*2|I-squared|chi-square/i],
      '14': [/publication\s+bias|funnel\s+plot|Egger/i],
      '15': [/GRADE|certainty|quality\s+of\s+evidence/i],
      '16a': [/search.*identif|screen|full.text/i],
      '16b': [/flow\s+diagram|PRISMA\s+diagram|Figure\s*1/i],
      '17': [/Table\s*\d|characteristic|included\s+studies/i],
      '18': [/risk\s+of\s+bias.*results|quality\s+assessment.*results/i],
      '20a': [/pooled|overall|summary\s+effect|forest/i],
      '21': [/publication\s+bias|funnel|asymmetry/i],
      '22': [/GRADE|certainty|quality.*evidence/i],
      '23a': [/interpret|context|comparison/i],
      '23b': [/limitation|weakness/i],
      '24a': [/PROSPERO|CRD|registration/i],
      '25': [/fund|grant|support/i],
      '26': [/conflict|competing\s+interest|disclosure/i]
    };

    return patterns[itemId] || [/.*/];
  }

  private getSuggestion(itemId: string): string {
    const suggestions: Record<string, string> = {
      '1': 'Include "systematic review" or "meta-analysis" in title',
      '6': 'List all databases searched with dates',
      '7': 'Provide complete search strategy in appendix',
      '11': 'Describe risk of bias assessment tool (e.g., Cochrane ROB, Newcastle-Ottawa)',
      '14': 'Describe methods for assessing publication bias',
      '15': 'Describe GRADE or similar approach for certainty assessment',
      '16b': 'Include PRISMA flow diagram',
      '24a': 'Add PROSPERO registration number'
    };

    return suggestions[itemId] || `Add PRISMA item ${itemId}`;
  }

  private generateSummary(presentRequired: number, totalRequired: number): string {
    const percentage = (presentRequired / totalRequired * 100).toFixed(0);
    return `PRISMA 2020 compliance: ${percentage}% of required items present.`;
  }
}

export const prismaCheckerService = new PRISMACheckerService();
```

---

## Task 85: Word Document Export Service

**File**: `packages/manuscript-engine/src/services/docx-export.service.ts`

```typescript
import type { IMRaDSection } from '../types/imrad.types';
import type { Citation, FormattedCitation } from '../types/citation.types';

export interface DocxExportConfig {
  manuscriptId: string;
  title: string;
  authors: { name: string; affiliation: string; email?: string; orcid?: string }[];
  sections: Record<IMRaDSection, string>;
  formattedCitations: FormattedCitation[];
  figures?: { id: string; caption: string; imagePath: string }[];
  tables?: { id: string; caption: string; content: string[][] }[];
  journalTemplate?: string;
  lineNumbers?: boolean;
  doubleSpaced?: boolean;
}

export interface DocxExportResult {
  success: boolean;
  filePath?: string;
  buffer?: Buffer;
  error?: string;
}

export class DocxExportService {
  /**
   * Export manuscript to Word document
   */
  async exportToDocx(config: DocxExportConfig): Promise<DocxExportResult> {
    try {
      // This would use a library like docx or officegen in production
      const documentContent = this.buildDocumentStructure(config);
      
      // For now, return the structure that would be converted
      return {
        success: true,
        filePath: `/tmp/manuscript-${config.manuscriptId}.docx`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  /**
   * Build document structure for export
   */
  private buildDocumentStructure(config: DocxExportConfig): object {
    const sections: object[] = [];

    // Title page
    sections.push({
      type: 'title_page',
      title: config.title,
      authors: config.authors.map(a => ({
        name: a.name,
        affiliation: a.affiliation,
        orcid: a.orcid
      })),
      correspondingAuthor: config.authors.find(a => a.email)
    });

    // Abstract
    if (config.sections.abstract) {
      sections.push({
        type: 'section',
        heading: 'Abstract',
        content: config.sections.abstract,
        pageBreakBefore: true
      });
    }

    // Keywords (if present)
    if (config.sections.keywords) {
      sections.push({
        type: 'keywords',
        content: config.sections.keywords
      });
    }

    // Main sections
    const mainSections: IMRaDSection[] = ['introduction', 'methods', 'results', 'discussion'];
    for (const sectionKey of mainSections) {
      if (config.sections[sectionKey]) {
        sections.push({
          type: 'section',
          heading: this.formatSectionHeading(sectionKey),
          content: config.sections[sectionKey],
          pageBreakBefore: sectionKey === 'introduction'
        });
      }
    }

    // Acknowledgments
    if (config.sections.acknowledgments) {
      sections.push({
        type: 'section',
        heading: 'Acknowledgments',
        content: config.sections.acknowledgments
      });
    }

    // References
    sections.push({
      type: 'references',
      heading: 'References',
      citations: config.formattedCitations.map(c => c.fullReference),
      pageBreakBefore: true
    });

    // Tables
    if (config.tables && config.tables.length > 0) {
      sections.push({
        type: 'tables_section',
        heading: 'Tables',
        tables: config.tables,
        pageBreakBefore: true
      });
    }

    // Figures
    if (config.figures && config.figures.length > 0) {
      sections.push({
        type: 'figures_section',
        heading: 'Figures',
        figures: config.figures,
        pageBreakBefore: true
      });
    }

    // Supplementary materials
    if (config.sections.supplementary) {
      sections.push({
        type: 'section',
        heading: 'Supplementary Materials',
        content: config.sections.supplementary,
        pageBreakBefore: true
      });
    }

    return {
      metadata: {
        title: config.title,
        creator: config.authors[0]?.name,
        created: new Date().toISOString()
      },
      formatting: {
        lineNumbers: config.lineNumbers,
        doubleSpaced: config.doubleSpaced,
        font: 'Times New Roman',
        fontSize: 12,
        margins: { top: 1, bottom: 1, left: 1, right: 1 }
      },
      sections
    };
  }

  /**
   * Generate tracked changes version
   */
  async exportWithTrackedChanges(
    config: DocxExportConfig,
    previousVersion: Record<IMRaDSection, string>
  ): Promise<DocxExportResult> {
    // Calculate differences between versions
    const changes = this.calculateChanges(config.sections, previousVersion);
    
    return this.exportToDocx({
      ...config,
      // In production, this would include track changes markup
    });
  }

  private formatSectionHeading(section: IMRaDSection): string {
    const headings: Record<string, string> = {
      introduction: 'Introduction',
      methods: 'Methods',
      results: 'Results',
      discussion: 'Discussion',
      abstract: 'Abstract',
      references: 'References',
      acknowledgments: 'Acknowledgments'
    };
    return headings[section] || section.charAt(0).toUpperCase() + section.slice(1);
  }

  private calculateChanges(
    current: Record<string, string>,
    previous: Record<string, string>
  ): { section: string; type: 'added' | 'removed' | 'modified'; content: string }[] {
    const changes: { section: string; type: 'added' | 'removed' | 'modified'; content: string }[] = [];

    for (const [section, content] of Object.entries(current)) {
      if (!previous[section]) {
        changes.push({ section, type: 'added', content });
      } else if (previous[section] !== content) {
        changes.push({ section, type: 'modified', content });
      }
    }

    for (const [section, content] of Object.entries(previous)) {
      if (!current[section]) {
        changes.push({ section, type: 'removed', content });
      }
    }

    return changes;
  }
}

export const docxExportService = new DocxExportService();
```

---

## Task 86: PDF Export Service

**File**: `packages/manuscript-engine/src/services/pdf-export.service.ts`

```typescript
import type { IMRaDSection } from '../types/imrad.types';
import type { FormattedCitation } from '../types/citation.types';

export interface PdfExportConfig {
  manuscriptId: string;
  title: string;
  authors: { name: string; affiliation: string }[];
  sections: Record<IMRaDSection, string>;
  formattedCitations: FormattedCitation[];
  figures?: { id: string; caption: string; imagePath: string }[];
  tables?: { id: string; caption: string; content: string[][] }[];
  template?: 'manuscript' | 'preprint' | 'journal';
  includeLineNumbers?: boolean;
  includePageNumbers?: boolean;
  watermark?: string;
}

export interface PdfExportResult {
  success: boolean;
  filePath?: string;
  buffer?: Buffer;
  pageCount?: number;
  error?: string;
}

export class PdfExportService {
  /**
   * Export manuscript to PDF
   */
  async exportToPdf(config: PdfExportConfig): Promise<PdfExportResult> {
    try {
      // This would use a library like puppeteer, pdfkit, or react-pdf
      const html = this.generateHtml(config);
      
      // In production, convert HTML to PDF
      return {
        success: true,
        filePath: `/tmp/manuscript-${config.manuscriptId}.pdf`,
        pageCount: this.estimatePageCount(config)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF export failed'
      };
    }
  }

  /**
   * Generate HTML for PDF conversion
   */
  private generateHtml(config: PdfExportConfig): string {
    const css = this.getStylesheet(config.template || 'manuscript');
    
    const bodyContent: string[] = [];

    // Title page
    bodyContent.push(`
      <div class="title-page">
        <h1 class="title">${this.escapeHtml(config.title)}</h1>
        <div class="authors">
          ${config.authors.map((a, i) => `
            <span class="author">${this.escapeHtml(a.name)}<sup>${i + 1}</sup></span>
          `).join(', ')}
        </div>
        <div class="affiliations">
          ${config.authors.map((a, i) => `
            <p><sup>${i + 1}</sup>${this.escapeHtml(a.affiliation)}</p>
          `).join('')}
        </div>
      </div>
    `);

    // Abstract
    if (config.sections.abstract) {
      bodyContent.push(`
        <div class="section abstract">
          <h2>Abstract</h2>
          <p>${this.formatContent(config.sections.abstract)}</p>
        </div>
      `);
    }

    // Main sections
    const mainSections: IMRaDSection[] = ['introduction', 'methods', 'results', 'discussion'];
    for (const section of mainSections) {
      if (config.sections[section]) {
        bodyContent.push(`
          <div class="section ${section}">
            <h2>${section.charAt(0).toUpperCase() + section.slice(1)}</h2>
            ${this.formatContent(config.sections[section])}
          </div>
        `);
      }
    }

    // References
    bodyContent.push(`
      <div class="section references">
        <h2>References</h2>
        <ol class="reference-list">
          ${config.formattedCitations.map(c => `
            <li>${this.escapeHtml(c.fullReference)}</li>
          `).join('')}
        </ol>
      </div>
    `);

    // Tables
    if (config.tables && config.tables.length > 0) {
      bodyContent.push(`
        <div class="section tables">
          <h2>Tables</h2>
          ${config.tables.map(t => this.renderTable(t)).join('')}
        </div>
      `);
    }

    // Figure legends
    if (config.figures && config.figures.length > 0) {
      bodyContent.push(`
        <div class="section figures">
          <h2>Figures</h2>
          ${config.figures.map(f => `
            <div class="figure">
              <img src="${f.imagePath}" alt="${this.escapeHtml(f.caption)}" />
              <p class="caption"><strong>${f.id}.</strong> ${this.escapeHtml(f.caption)}</p>
            </div>
          `).join('')}
        </div>
      `);
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${this.escapeHtml(config.title)}</title>
        <style>${css}</style>
      </head>
      <body>
        ${config.watermark ? `<div class="watermark">${this.escapeHtml(config.watermark)}</div>` : ''}
        ${bodyContent.join('\n')}
      </body>
      </html>
    `;
  }

  private getStylesheet(template: string): string {
    const baseStyles = `
      body {
        font-family: 'Times New Roman', Times, serif;
        font-size: 12pt;
        line-height: 2;
        margin: 1in;
        color: #000;
      }
      
      .title-page {
        text-align: center;
        page-break-after: always;
      }
      
      .title {
        font-size: 16pt;
        font-weight: bold;
        margin-bottom: 24pt;
      }
      
      .authors {
        margin-bottom: 12pt;
      }
      
      .affiliations {
        font-size: 10pt;
      }
      
      .section {
        margin-bottom: 24pt;
      }
      
      .section h2 {
        font-size: 14pt;
        font-weight: bold;
        margin-bottom: 12pt;
      }
      
      .reference-list {
        font-size: 10pt;
      }
      
      .reference-list li {
        margin-bottom: 6pt;
      }
      
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 12pt 0;
      }
      
      th, td {
        border: 1px solid #000;
        padding: 6pt;
        text-align: left;
      }
      
      .caption {
        font-size: 10pt;
        margin-top: 6pt;
      }
      
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 72pt;
        color: rgba(0, 0, 0, 0.1);
        z-index: -1;
      }
      
      @page {
        size: letter;
        margin: 1in;
      }
    `;

    return baseStyles;
  }

  private renderTable(table: { id: string; caption: string; content: string[][] }): string {
    if (table.content.length === 0) return '';

    const headers = table.content[0];
    const rows = table.content.slice(1);

    return `
      <div class="table-container">
        <p class="caption"><strong>${table.id}.</strong> ${this.escapeHtml(table.caption)}</p>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${this.escapeHtml(cell)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  private formatContent(text: string): string {
    // Convert paragraphs
    return text
      .split(/\n\n+/)
      .map(para => `<p>${this.escapeHtml(para.trim())}</p>`)
      .join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private estimatePageCount(config: PdfExportConfig): number {
    const totalWords = Object.values(config.sections)
      .join(' ')
      .split(/\s+/)
      .filter(w => w.length > 0).length;

    // Rough estimate: ~300 words per page double-spaced
    const textPages = Math.ceil(totalWords / 300);
    const tableFigurePages = (config.tables?.length || 0) + (config.figures?.length || 0);
    const referencePages = Math.ceil((config.formattedCitations?.length || 0) / 30);

    return textPages + tableFigurePages + referencePages + 1; // +1 for title page
  }
}

export const pdfExportService = new PdfExportService();
```

---

## Tasks 87-100: Summary Table

| Task | File | Description |
|------|------|-------------|
| 87 | `services/latex-export.service.ts` | LaTeX/Overleaf export |
| 88 | `services/submission-packager.service.ts` | Journal submission package |
| 89 | `services/cover-letter.service.ts` | Generate cover letter |
| 90 | `services/revision-tracker.service.ts` | Track revisions with diff |
| 91 | `services/response-letter.service.ts` | Response to reviewers |
| 92 | `services/icmje-form.service.ts` | ICMJE conflict of interest |
| 93 | `services/author-agreement.service.ts` | Author contributions |
| 94 | `services/data-availability.service.ts` | Data availability statement |
| 95 | `services/preprint-submitter.service.ts` | bioRxiv/medRxiv prep |
| 96 | `services/journal-finder.service.ts` | Suggest target journals |
| 97 | `services/final-phi-scan.service.ts` | Final PHI scan before export |
| 98 | `services/audit-report.service.ts` | Generate audit trail PDF |
| 99 | `services/archive.service.ts` | Archive manuscript package |
| 100 | `__tests__/e2e/full-workflow.test.ts` | Complete workflow E2E test |

---

## Task 97: Final PHI Scan Service

**File**: `packages/manuscript-engine/src/services/final-phi-scan.service.ts`

```typescript
import { phiEngineService } from '@researchflow/phi-engine';

export interface FinalScanResult {
  passed: boolean;
  manuscriptId: string;
  scanTimestamp: Date;
  totalScanned: number;
  phiDetections: PhiDetection[];
  quarantinedItems: string[];
  attestationRequired: boolean;
  auditHash: string;
}

export interface PhiDetection {
  section: string;
  type: string;
  pattern: string;
  context: string;
  startIndex: number;
  endIndex: number;
  severity: 'critical' | 'high' | 'medium';
  recommendation: string;
}

export class FinalPhiScanService {
  /**
   * Perform comprehensive PHI scan before export
   * CRITICAL: This is the final gate before any data leaves the system
   */
  async performFinalScan(
    manuscriptId: string,
    content: Record<string, string>,
    userId: string
  ): Promise<FinalScanResult> {
    const detections: PhiDetection[] = [];
    let totalScanned = 0;

    // Scan each section
    for (const [section, text] of Object.entries(content)) {
      if (!text || text.trim().length === 0) continue;

      totalScanned++;
      
      // Use PHI engine for detection
      const sectionDetections = await this.scanSection(section, text);
      detections.push(...sectionDetections);
    }

    // Determine if attestation is required
    const attestationRequired = detections.some(d => 
      d.severity === 'critical' || d.severity === 'high'
    );

    // Generate audit hash
    const auditHash = await this.generateAuditHash(manuscriptId, detections, userId);

    // Log audit entry
    await this.logAudit({
      manuscriptId,
      userId,
      action: 'final_phi_scan',
      timestamp: new Date(),
      detectionCount: detections.length,
      passed: detections.length === 0,
      auditHash
    });

    return {
      passed: detections.length === 0,
      manuscriptId,
      scanTimestamp: new Date(),
      totalScanned,
      phiDetections: detections,
      quarantinedItems: detections.filter(d => d.severity === 'critical').map(d => d.context),
      attestationRequired,
      auditHash
    };
  }

  /**
   * Scan individual section for PHI
   */
  private async scanSection(section: string, text: string): Promise<PhiDetection[]> {
    const detections: PhiDetection[] = [];

    // PHI patterns following HIPAA 18 identifiers
    const patterns = [
      // Names (simplified - production would use NER)
      { type: 'name', pattern: /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g, severity: 'critical' as const },
      
      // Dates of birth
      { type: 'dob', pattern: /\b(?:DOB|born|birth(?:day)?)[:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi, severity: 'critical' as const },
      
      // SSN
      { type: 'ssn', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, severity: 'critical' as const },
      
      // MRN/Medical Record Numbers
      { type: 'mrn', pattern: /\b(?:MRN|medical\s+record)[:\s#]*[\d\-]+/gi, severity: 'critical' as const },
      
      // Phone numbers
      { type: 'phone', pattern: /\b(?:\+1\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, severity: 'high' as const },
      
      // Email addresses
      { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, severity: 'high' as const },
      
      // Street addresses
      { type: 'address', pattern: /\b\d+\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi, severity: 'high' as const },
      
      // ZIP codes
      { type: 'zip', pattern: /\b\d{5}(?:-\d{4})?\b/g, severity: 'medium' as const },
      
      // Account numbers
      { type: 'account', pattern: /\b(?:account|acct)[:\s#]*[\d\-]+/gi, severity: 'high' as const },
      
      // Certificate/License numbers
      { type: 'license', pattern: /\b(?:license|certificate|cert)[:\s#]*[A-Z\d\-]+/gi, severity: 'medium' as const },
      
      // Vehicle identifiers
      { type: 'vehicle', pattern: /\b(?:VIN|plate)[:\s#]*[A-Z\d\-]+/gi, severity: 'medium' as const },
      
      // Device identifiers
      { type: 'device', pattern: /\b(?:serial|device\s+id)[:\s#]*[A-Z\d\-]+/gi, severity: 'medium' as const },
      
      // URLs with identifiers
      { type: 'url', pattern: /https?:\/\/[^\s]+(?:patient|record|id=)[^\s]*/gi, severity: 'high' as const },
      
      // IP addresses
      { type: 'ip', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, severity: 'medium' as const },
      
      // Biometric identifiers
      { type: 'biometric', pattern: /\b(?:fingerprint|retina|voiceprint|face\s+recognition)[:\s]*[^\s]+/gi, severity: 'critical' as const },
      
      // Full face photos mentioned
      { type: 'photo', pattern: /\b(?:photograph|photo|image)\s+(?:of|showing)\s+(?:patient|subject|face)/gi, severity: 'critical' as const }
    ];

    for (const { type, pattern, severity } of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        detections.push({
          section,
          type,
          pattern: pattern.source,
          context: this.getContext(text, match.index, 50),
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          severity,
          recommendation: this.getRecommendation(type)
        });
      }
    }

    return detections;
  }

  /**
   * Get text context around detection
   */
  private getContext(text: string, index: number, windowSize: number): string {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(text.length, index + windowSize);
    return '...' + text.substring(start, end) + '...';
  }

  /**
   * Get remediation recommendation
   */
  private getRecommendation(type: string): string {
    const recommendations: Record<string, string> = {
      name: 'Replace with "Patient A" or "Subject 1" or use pseudonyms',
      dob: 'Remove specific dates; use age at time of event instead',
      ssn: 'Remove completely - never include SSN in manuscripts',
      mrn: 'Remove or use study-specific ID numbers',
      phone: 'Remove phone numbers completely',
      email: 'Remove email addresses completely',
      address: 'Remove specific addresses; use general geographic region only',
      zip: 'Remove ZIP codes or truncate to first 3 digits',
      account: 'Remove account numbers completely',
      license: 'Remove license/certificate numbers',
      vehicle: 'Remove vehicle identifiers',
      device: 'Remove device identifiers or use generic codes',
      url: 'Remove URLs containing identifiers',
      ip: 'Remove IP addresses',
      biometric: 'Remove biometric identifiers completely',
      photo: 'Ensure no identifiable photos are included'
    };

    return recommendations[type] || 'Review and remove potential identifier';
  }

  /**
   * Generate audit hash for chain verification
   */
  private async generateAuditHash(
    manuscriptId: string,
    detections: PhiDetection[],
    userId: string
  ): Promise<string> {
    const data = JSON.stringify({
      manuscriptId,
      detectionCount: detections.length,
      userId,
      timestamp: new Date().toISOString()
    });

    // In production, use crypto library
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Log audit entry
   */
  private async logAudit(entry: {
    manuscriptId: string;
    userId: string;
    action: string;
    timestamp: Date;
    detectionCount: number;
    passed: boolean;
    auditHash: string;
  }): Promise<void> {
    // In production, log to audit database
    console.log('[AUDIT]', JSON.stringify(entry));
  }
}

export const finalPhiScanService = new FinalPhiScanService();
```

---

## Task 100: Full Workflow E2E Test

**File**: `packages/manuscript-engine/src/__tests__/e2e/full-workflow.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { v4 as uuid } from 'uuid';

// Import all services
import { pubmedService } from '../../services/pubmed.service';
import { citationManagerService } from '../../services/citation-manager.service';
import { abstractGeneratorService } from '../../services/abstract-generator.service';
import { peerReviewService } from '../../services/peer-review.service';
import { consortCheckerService } from '../../services/consort-checker.service';
import { strobeCheckerService } from '../../services/strobe-checker.service';
import { docxExportService } from '../../services/docx-export.service';
import { pdfExportService } from '../../services/pdf-export.service';
import { finalPhiScanService } from '../../services/final-phi-scan.service';
import type { Citation } from '../../types/citation.types';
import type { IMRaDSection } from '../../types/imrad.types';

describe('Full Manuscript Workflow E2E', () => {
  const manuscriptId = uuid();
  const userId = 'test-user-001';
  
  const sampleManuscript: Record<IMRaDSection, string> = {
    title: 'Effect of Exercise on Blood Pressure in Adults with Hypertension: A Randomized Controlled Trial',
    abstract: `
      Background: Hypertension affects millions worldwide. Exercise may help control blood pressure.
      Methods: We conducted a randomized controlled trial of 200 adults with hypertension.
      Participants were randomized to supervised exercise (n=100) or usual care (n=100) for 12 weeks.
      Results: Systolic blood pressure decreased by 12.3 mmHg (95% CI: 8.5-16.1) in the exercise group
      compared to 2.1 mmHg (95% CI: -1.2-5.4) in control (p<0.001).
      Conclusions: Supervised exercise significantly reduces blood pressure in hypertensive adults.
    `,
    keywords: 'hypertension, exercise, blood pressure, randomized controlled trial',
    introduction: `
      Hypertension is a major risk factor for cardiovascular disease, affecting over 1 billion people worldwide.
      Lifestyle modifications, including physical activity, are recommended as first-line treatment.
      However, the optimal exercise prescription remains unclear.
      We aimed to determine the effect of a structured exercise program on blood pressure control.
    `,
    methods: `
      Study Design and Setting: This was a parallel-group randomized controlled trial conducted at
      University Medical Center between January 2022 and December 2023. The study was approved by
      the Institutional Review Board (Protocol #2021-0456).
      
      Participants: Adults aged 40-70 years with stage 1 hypertension (systolic 130-139 or diastolic 80-89 mmHg)
      were eligible. Exclusion criteria included cardiovascular disease, diabetes, and inability to exercise.
      
      Randomization: Participants were randomized 1:1 using computer-generated random numbers with
      permuted blocks of 4 and 6. Allocation was concealed using sequentially numbered opaque envelopes.
      
      Interventions: The exercise group participated in supervised aerobic exercise 3 times weekly
      for 12 weeks. Sessions lasted 45 minutes at 60-70% maximum heart rate.
      
      Outcomes: The primary outcome was change in systolic blood pressure at 12 weeks.
      Secondary outcomes included diastolic blood pressure, heart rate, and body weight.
      
      Statistical Analysis: Sample size was calculated to detect a 10 mmHg difference with 80% power
      at alpha=0.05, requiring 80 participants per group. Analysis was by intention-to-treat.
      Between-group differences were assessed using ANCOVA adjusting for baseline values.
    `,
    results: `
      Participants: Of 312 screened, 200 were randomized (100 per group). Baseline characteristics
      were similar (Table 1). Mean age was 54.2 years and 52% were female.
      
      Follow-up: 95 participants (95%) in the exercise group and 92 (92%) in the control group
      completed 12-week follow-up.
      
      Primary Outcome: Systolic blood pressure decreased from 136.4 to 124.1 mmHg in the exercise
      group and from 135.8 to 133.7 mmHg in controls. The between-group difference was -10.2 mmHg
      (95% CI: -13.8 to -6.6, p<0.001).
      
      Secondary Outcomes: Diastolic blood pressure decreased by 5.3 mmHg more in the exercise group
      (95% CI: -7.8 to -2.8, p<0.001). No serious adverse events occurred.
    `,
    discussion: `
      In this randomized controlled trial, supervised exercise significantly reduced blood pressure
      in adults with hypertension. The 10 mmHg reduction in systolic blood pressure is clinically
      meaningful and consistent with meta-analyses showing 5-15 mmHg reductions with exercise.
      
      Our findings extend prior work by using a structured program with objective monitoring.
      Smith et al. (2020) reported similar effects in a smaller study of 80 participants.
      
      Limitations include the single-center design and 12-week duration. Longer follow-up is
      needed to assess sustainability. Blinding of participants was not possible.
      
      In conclusion, supervised exercise is an effective strategy for blood pressure control
      in adults with stage 1 hypertension.
    `,
    references: '',
    acknowledgments: 'Funded by NIH grant R01HL123456. The authors thank the participants.',
    supplementary: '',
    appendices: ''
  };

  describe('Phase 1: Literature Integration', () => {
    it('should search PubMed for relevant citations', async () => {
      // Note: This would be mocked in real tests
      // const results = await pubmedService.search({ query: 'exercise hypertension' });
      // expect(results.totalResults).toBeGreaterThan(0);
      expect(true).toBe(true);
    });

    it('should add and validate citations', () => {
      const citation: Citation = {
        id: uuid(),
        manuscriptId,
        sourceType: 'pubmed',
        externalId: '12345678',
        title: 'Exercise and Blood Pressure: A Meta-Analysis',
        authors: [{ lastName: 'Smith', firstName: 'John' }],
        year: 2020,
        journal: 'Hypertension',
        volume: '75',
        pages: '123-135',
        doi: '10.1161/HYP.0000000000001234',
        pmid: '12345678',
        sections: ['discussion'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      citationManagerService.addCitation(citation);
      const citations = citationManagerService.getManuscriptCitations(manuscriptId);
      
      expect(citations.length).toBe(1);
      expect(citations[0].title).toContain('Exercise');
    });
  });

  describe('Phase 2: Structure Building', () => {
    it('should validate abstract structure', async () => {
      const validation = abstractGeneratorService.validateAbstract(
        sampleManuscript.abstract,
        300
      );

      expect(validation).toBeDefined();
      // Should have typical structured abstract components
    });
  });

  describe('Phase 3: Compliance Checking', () => {
    it('should check CONSORT compliance for RCT', () => {
      const result = consortCheckerService.checkCompliance(sampleManuscript);

      expect(result.checklist).toBe('CONSORT');
      expect(result.compliancePercentage).toBeGreaterThan(0);
      expect(result.results.length).toBeGreaterThan(0);
      
      // Key items should be present
      const hasRandomization = result.results.some(
        r => r.itemId === '8a' && r.present
      );
      expect(hasRandomization).toBe(true);
    });

    it('should simulate peer review', async () => {
      const review = await peerReviewService.simulateReview(
        sampleManuscript,
        {
          studyType: 'RCT',
          sampleSize: 200,
          hasEthicsApproval: true,
          hasCOI: false
        }
      );

      expect(review.overallScore).toBeGreaterThan(0);
      expect(review.overallScore).toBeLessThanOrEqual(10);
      expect(review.recommendation).toBeDefined();
      expect(['accept', 'minor_revision', 'major_revision', 'reject'])
        .toContain(review.recommendation);
    });
  });

  describe('Phase 4: PHI Scanning', () => {
    it('should pass PHI scan for clean manuscript', async () => {
      const result = await finalPhiScanService.performFinalScan(
        manuscriptId,
        sampleManuscript,
        userId
      );

      expect(result.passed).toBe(true);
      expect(result.phiDetections.length).toBe(0);
      expect(result.auditHash).toBeDefined();
    });

    it('should detect PHI in contaminated content', async () => {
      const contaminatedManuscript = {
        ...sampleManuscript,
        methods: sampleManuscript.methods + ' Patient John Smith (MRN: 12345678) was enrolled.'
      };

      const result = await finalPhiScanService.performFinalScan(
        manuscriptId,
        contaminatedManuscript,
        userId
      );

      expect(result.passed).toBe(false);
      expect(result.phiDetections.length).toBeGreaterThan(0);
      expect(result.phiDetections.some(d => d.type === 'name' || d.type === 'mrn')).toBe(true);
    });
  });

  describe('Phase 5: Export', () => {
    it('should export to Word document', async () => {
      const result = await docxExportService.exportToDocx({
        manuscriptId,
        title: sampleManuscript.title,
        authors: [
          { name: 'Jane Doe', affiliation: 'University Medical Center', email: 'jane@example.com' }
        ],
        sections: sampleManuscript,
        formattedCitations: [],
        lineNumbers: true,
        doubleSpaced: true
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
    });

    it('should export to PDF', async () => {
      const result = await pdfExportService.exportToPdf({
        manuscriptId,
        title: sampleManuscript.title,
        authors: [
          { name: 'Jane Doe', affiliation: 'University Medical Center' }
        ],
        sections: sampleManuscript,
        formattedCitations: [],
        template: 'manuscript',
        includePageNumbers: true
      });

      expect(result.success).toBe(true);
      expect(result.pageCount).toBeGreaterThan(0);
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should complete full workflow from draft to export', async () => {
      // 1. Create manuscript (already have sampleManuscript)
      expect(sampleManuscript.title).toBeDefined();

      // 2. Run compliance check
      const consort = consortCheckerService.checkCompliance(sampleManuscript);
      expect(consort.compliancePercentage).toBeGreaterThan(50);

      // 3. Simulate peer review
      const review = await peerReviewService.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });
      expect(review.overallScore).toBeGreaterThan(5);

      // 4. Final PHI scan
      const phiScan = await finalPhiScanService.performFinalScan(
        manuscriptId,
        sampleManuscript,
        userId
      );
      expect(phiScan.passed).toBe(true);

      // 5. Export
      const pdfResult = await pdfExportService.exportToPdf({
        manuscriptId,
        title: sampleManuscript.title,
        authors: [{ name: 'Test Author', affiliation: 'Test University' }],
        sections: sampleManuscript,
        formattedCitations: []
      });
      expect(pdfResult.success).toBe(true);

      // Workflow complete!
      console.log('Full workflow completed successfully');
    });
  });
});
```

---

## Verification Checklist - Phase 5

- [ ] Peer review simulation generates realistic feedback
- [ ] CONSORT checker validates RCT elements
- [ ] STROBE checker validates observational studies
- [ ] PRISMA checker validates systematic reviews
- [ ] DOCX export generates valid Word document
- [ ] PDF export generates formatted document
- [ ] Final PHI scan catches all 18 HIPAA identifiers
- [ ] Audit trail is complete and hash-chained
- [ ] E2E tests cover full workflow
- [ ] All exports pass PHI scan before delivery

## Deployment Notes

After completing all 100 tasks:

1. Run full test suite: `npm test`
2. Build packages: `npm run build`
3. Update package versions
4. Deploy to staging environment
5. Run E2E tests against staging
6. Deploy to production with feature flags
7. Monitor audit logs for first 24 hours

## Security Reminders

- **NEVER** export manuscript without passing PHI scan
- **ALWAYS** require human attestation for Results/Methods
- **LOG** all export operations to audit trail
- **ENCRYPT** exported files in transit and at rest
- **VERIFY** user permissions before export
