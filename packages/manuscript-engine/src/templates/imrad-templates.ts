/**
 * IMRaD Templates
 * Task T41: Standard manuscript structure templates
 */

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

/**
 * Standard IMRaD Template
 * Used for original research articles
 */
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
    total: { min: 3000, max: 5000 },
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments', 'appendices', 'supplementary'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [
        {
          id: 'title',
          label: 'Article Title',
          description: 'Concise, informative title (max 15 words)',
          required: true,
        },
      ],
      guidance: 'Title should be specific, concise, and capture the main finding or topic.',
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      subsections: [
        {
          id: 'background',
          title: 'Background',
          order: 1,
          guidance: 'Context and rationale for the study',
          placeholders: [],
        },
        {
          id: 'methods',
          title: 'Methods',
          order: 2,
          guidance: 'Study design and approach',
          placeholders: [],
        },
        {
          id: 'results',
          title: 'Results',
          order: 3,
          guidance: 'Key findings with specific numbers',
          placeholders: [],
        },
        {
          id: 'conclusions',
          title: 'Conclusions',
          order: 4,
          guidance: 'Main takeaway and implications',
          placeholders: [],
        },
      ],
      placeholders: [
        {
          id: 'study_design',
          label: 'Study Design',
          description: 'e.g., randomized controlled trial, cohort study',
          required: true,
        },
        {
          id: 'sample_size',
          label: 'Sample Size',
          description: 'Total N',
          required: true,
          dataBinding: 'metadata.sampleSize',
        },
        {
          id: 'primary_outcome',
          label: 'Primary Outcome',
          description: 'Main result with statistics',
          required: true,
        },
      ],
      guidance: 'Structured abstract with Background, Methods, Results, Conclusions. Max 300 words.',
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [
        {
          id: 'background',
          label: 'Background',
          description: 'What is known about the topic',
          required: true,
        },
        {
          id: 'gap',
          label: 'Knowledge Gap',
          description: 'What remains unknown or unclear',
          required: true,
        },
        {
          id: 'objective',
          label: 'Study Objective',
          description: 'What this study aims to do',
          required: true,
        },
      ],
      guidance: 'Move from general to specific. End with clear study objective.',
      examples: [
        'Background: [Topic] is a significant health concern affecting [population].',
        'Gap: However, [specific aspect] remains poorly understood.',
        'Objective: We aimed to [specific objective] in [population].',
      ],
    },
    {
      section: 'methods',
      title: 'Methods',
      order: 4,
      subsections: [
        {
          id: 'study_design',
          title: 'Study Design and Setting',
          order: 1,
          guidance: 'Describe study design, enrollment dates, and location',
          placeholders: [],
        },
        {
          id: 'participants',
          title: 'Participants',
          order: 2,
          guidance: 'Inclusion and exclusion criteria',
          placeholders: [],
        },
        {
          id: 'variables',
          title: 'Variables',
          order: 3,
          guidance: 'Exposures, outcomes, and covariates',
          placeholders: [],
        },
        {
          id: 'data_sources',
          title: 'Data Sources',
          order: 4,
          guidance: 'How data was collected or obtained',
          placeholders: [],
        },
        {
          id: 'statistical_methods',
          title: 'Statistical Methods',
          order: 5,
          guidance: 'Analysis approach and software used',
          placeholders: [],
        },
        {
          id: 'ethics',
          title: 'Ethics',
          order: 6,
          guidance: 'IRB approval and informed consent',
          placeholders: [],
        },
      ],
      placeholders: [
        {
          id: 'design',
          label: 'Study Design',
          description: 'e.g., retrospective cohort study',
          required: true,
        },
        {
          id: 'setting',
          label: 'Setting',
          description: 'Institution and enrollment dates',
          required: true,
        },
        {
          id: 'inclusion',
          label: 'Inclusion Criteria',
          description: 'Who was eligible',
          required: true,
        },
        {
          id: 'exclusion',
          label: 'Exclusion Criteria',
          description: 'Who was excluded',
          required: false,
        },
        {
          id: 'primary_outcome',
          label: 'Primary Outcome',
          description: 'Main outcome variable',
          required: true,
        },
        {
          id: 'statistical_tests',
          label: 'Statistical Tests',
          description: 'Statistical tests performed',
          required: true,
        },
      ],
      guidance: 'Sufficient detail for replication. Use past tense, passive voice.',
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      subsections: [
        {
          id: 'participant_flow',
          title: 'Participant Flow',
          order: 1,
          guidance: 'Screening, enrollment, and follow-up',
          placeholders: [],
        },
        {
          id: 'baseline',
          title: 'Baseline Characteristics',
          order: 2,
          guidance: 'Describe Table 1',
          placeholders: [],
        },
        {
          id: 'primary',
          title: 'Primary Outcomes',
          order: 3,
          guidance: 'Main findings with statistics',
          placeholders: [],
        },
        {
          id: 'secondary',
          title: 'Secondary Outcomes',
          order: 4,
          guidance: 'Additional findings',
          placeholders: [],
        },
      ],
      placeholders: [
        {
          id: 'total_n',
          label: 'Total Analyzed',
          description: 'Final sample size',
          required: true,
          dataBinding: 'results.sampleSize',
        },
        {
          id: 'primary_result',
          label: 'Primary Result',
          description: 'Main finding with statistics',
          required: true,
        },
      ],
      guidance: 'Present results without interpretation. Include exact p-values and confidence intervals.',
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      subsections: [
        {
          id: 'key_findings',
          title: 'Key Findings',
          order: 1,
          guidance: 'Summarize main results in 2-3 sentences',
          placeholders: [],
        },
        {
          id: 'comparison',
          title: 'Comparison with Literature',
          order: 2,
          guidance: 'How results compare to prior studies',
          placeholders: [],
        },
        {
          id: 'strengths',
          title: 'Strengths',
          order: 3,
          guidance: 'Study advantages and unique contributions',
          placeholders: [],
        },
        {
          id: 'limitations',
          title: 'Limitations',
          order: 4,
          guidance: 'Weaknesses and potential biases',
          placeholders: [],
        },
        {
          id: 'implications',
          title: 'Implications',
          order: 5,
          guidance: 'Clinical and research implications',
          placeholders: [],
        },
      ],
      placeholders: [
        {
          id: 'main_finding',
          label: 'Main Finding',
          description: 'Most important result',
          required: true,
        },
        {
          id: 'limitations',
          label: 'Key Limitations',
          description: 'Main limitations of the study',
          required: true,
        },
      ],
      guidance: 'Interpret findings in context. Do not overstate conclusions.',
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'Format according to journal style. Verify all citations are referenced and vice versa.',
    },
  ],
};

/**
 * Case Report Template
 * Used for clinical case reports
 */
export const CASE_REPORT_TEMPLATE: ManuscriptTemplate = {
  id: 'case-report',
  name: 'Case Report',
  type: 'case_report',
  wordLimits: {
    abstract: { min: 100, max: 200 },
    total: { min: 1000, max: 2500 },
  },
  requiredSections: ['title', 'abstract', 'introduction', 'case_presentation', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [
        {
          id: 'title',
          label: 'Case Title',
          description: 'e.g., "A case of [condition] presenting with [unusual feature]"',
          required: true,
        },
      ],
      guidance: 'Include diagnosis and key unique feature.',
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      placeholders: [],
      guidance: 'Brief summary including patient demographics, presentation, diagnosis, and outcome. Max 200 words.',
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [],
      guidance: 'Why this case is noteworthy. Brief background on the condition.',
    },
    {
      section: 'case_presentation',
      title: 'Case Presentation',
      order: 4,
      subsections: [
        {
          id: 'history',
          title: 'History',
          order: 1,
          guidance: 'Chief complaint, history of present illness, past medical history',
          placeholders: [],
        },
        {
          id: 'examination',
          title: 'Physical Examination',
          order: 2,
          guidance: 'Relevant physical findings',
          placeholders: [],
        },
        {
          id: 'investigations',
          title: 'Investigations',
          order: 3,
          guidance: 'Lab results, imaging, other tests',
          placeholders: [],
        },
        {
          id: 'treatment',
          title: 'Treatment',
          order: 4,
          guidance: 'Interventions performed',
          placeholders: [],
        },
        {
          id: 'outcome',
          title: 'Outcome',
          order: 5,
          guidance: 'Patient outcome and follow-up',
          placeholders: [],
        },
      ],
      placeholders: [],
      guidance: 'Chronological presentation. Remove PHI. Use past tense.',
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 5,
      placeholders: [],
      guidance: 'What makes this case unique? Comparison with similar cases. Learning points.',
    },
    {
      section: 'references',
      title: 'References',
      order: 6,
      placeholders: [],
      guidance: 'Relevant literature. Typically 5-10 references for case reports.',
    },
  ],
};

/**
 * Systematic Review Template
 * Used for systematic reviews and meta-analyses
 */
export const SYSTEMATIC_REVIEW_TEMPLATE: ManuscriptTemplate = {
  id: 'systematic-review',
  name: 'Systematic Review',
  type: 'systematic_review',
  wordLimits: {
    abstract: { min: 250, max: 300 },
    introduction: { max: 1000 },
    methods: { max: 2000 },
    results: { max: 3000 },
    discussion: { max: 2000 },
    total: { min: 4000, max: 8000 },
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments', 'supplementary', 'appendices'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [],
      guidance: 'Include "systematic review" or "meta-analysis" in title.',
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      subsections: [
        {
          id: 'objective',
          title: 'Objective',
          order: 1,
          guidance: 'Research question',
          placeholders: [],
        },
        {
          id: 'data_sources',
          title: 'Data Sources',
          order: 2,
          guidance: 'Databases searched',
          placeholders: [],
        },
        {
          id: 'study_selection',
          title: 'Study Selection',
          order: 3,
          guidance: 'Inclusion criteria',
          placeholders: [],
        },
        {
          id: 'data_extraction',
          title: 'Data Extraction',
          order: 4,
          guidance: 'What data was extracted',
          placeholders: [],
        },
        {
          id: 'results',
          title: 'Results',
          order: 5,
          guidance: 'Number of studies, main findings',
          placeholders: [],
        },
        {
          id: 'conclusions',
          title: 'Conclusions',
          order: 6,
          guidance: 'Main takeaway',
          placeholders: [],
        },
      ],
      placeholders: [],
      guidance: 'Structured abstract following PRISMA guidelines.',
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [],
      guidance: 'Rationale for the review. Research question in PICO format. Objectives.',
    },
    {
      section: 'methods',
      title: 'Methods',
      order: 4,
      subsections: [
        {
          id: 'protocol',
          title: 'Protocol and Registration',
          order: 1,
          guidance: 'PROSPERO or protocol paper reference',
          placeholders: [],
        },
        {
          id: 'eligibility',
          title: 'Eligibility Criteria',
          order: 2,
          guidance: 'PICO criteria',
          placeholders: [],
        },
        {
          id: 'search_strategy',
          title: 'Search Strategy',
          order: 3,
          guidance: 'Databases, dates, search terms',
          placeholders: [],
        },
        {
          id: 'selection',
          title: 'Study Selection',
          order: 4,
          guidance: 'Screening process',
          placeholders: [],
        },
        {
          id: 'data_collection',
          title: 'Data Collection',
          order: 5,
          guidance: 'Extraction form, pilot testing',
          placeholders: [],
        },
        {
          id: 'risk_of_bias',
          title: 'Risk of Bias Assessment',
          order: 6,
          guidance: 'Tool used (e.g., Cochrane RoB 2)',
          placeholders: [],
        },
        {
          id: 'synthesis',
          title: 'Synthesis Methods',
          order: 7,
          guidance: 'Meta-analysis approach, heterogeneity',
          placeholders: [],
        },
      ],
      placeholders: [],
      guidance: 'Follow PRISMA guidelines. Include search strategy in appendix.',
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      subsections: [
        {
          id: 'study_selection',
          title: 'Study Selection',
          order: 1,
          guidance: 'PRISMA flow diagram',
          placeholders: [],
        },
        {
          id: 'study_characteristics',
          title: 'Study Characteristics',
          order: 2,
          guidance: 'Table of included studies',
          placeholders: [],
        },
        {
          id: 'risk_of_bias',
          title: 'Risk of Bias',
          order: 3,
          guidance: 'Quality assessment results',
          placeholders: [],
        },
        {
          id: 'synthesis',
          title: 'Synthesis of Results',
          order: 4,
          guidance: 'Meta-analysis results, forest plots',
          placeholders: [],
        },
      ],
      placeholders: [],
      guidance: 'Include PRISMA flow diagram, summary tables, and forest plots.',
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      subsections: [
        {
          id: 'summary',
          title: 'Summary of Evidence',
          order: 1,
          guidance: 'Main findings',
          placeholders: [],
        },
        {
          id: 'limitations',
          title: 'Limitations',
          order: 2,
          guidance: 'Study and review limitations',
          placeholders: [],
        },
        {
          id: 'conclusions',
          title: 'Conclusions',
          order: 3,
          guidance: 'Implications for practice and research',
          placeholders: [],
        },
      ],
      placeholders: [],
      guidance: 'Interpret results. Grade certainty of evidence. Implications.',
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'All included studies plus background references. Often 50+ references.',
    },
  ],
};

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): ManuscriptTemplate | undefined {
  const templates = {
    'imrad-standard': IMRAD_TEMPLATE,
    'case-report': CASE_REPORT_TEMPLATE,
    'systematic-review': SYSTEMATIC_REVIEW_TEMPLATE,
  };

  return templates[templateId as keyof typeof templates];
}

/**
 * List all available templates
 */
export function listTemplates(): Array<{ id: string; name: string; type: string }> {
  return [
    { id: IMRAD_TEMPLATE.id, name: IMRAD_TEMPLATE.name, type: IMRAD_TEMPLATE.type },
    { id: CASE_REPORT_TEMPLATE.id, name: CASE_REPORT_TEMPLATE.name, type: CASE_REPORT_TEMPLATE.type },
    { id: SYSTEMATIC_REVIEW_TEMPLATE.id, name: SYSTEMATIC_REVIEW_TEMPLATE.name, type: SYSTEMATIC_REVIEW_TEMPLATE.type },
  ];
}
