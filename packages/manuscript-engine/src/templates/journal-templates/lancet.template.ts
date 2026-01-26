/**
 * The Lancet Template
 * Task T53: Journal-specific manuscript template
 */

import type { ManuscriptTemplate } from '../imrad-templates';

export const LANCET_TEMPLATE: ManuscriptTemplate = {
  id: 'lancet-article',
  name: 'The Lancet Article',
  type: 'imrad',
  wordLimits: {
    abstract: { min: 250, max: 300 },
    introduction: { max: 800 },
    methods: { max: 1200 },
    results: { max: 1500 },
    discussion: { max: 1500 },
    total: { min: 3000, max: 4500 },
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments', 'supplementary', 'panel'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [],
      guidance: 'Informative title. Avoid questions. Max 150 characters.',
    },
    {
      section: 'abstract',
      title: 'Summary',
      order: 2,
      subsections: [
        { id: 'background', title: 'Background', order: 1, guidance: 'Context and gap', placeholders: [] },
        { id: 'methods', title: 'Methods', order: 2, guidance: 'Design and setting', placeholders: [] },
        { id: 'findings', title: 'Findings', order: 3, guidance: 'Main results', placeholders: [] },
        { id: 'interpretation', title: 'Interpretation', order: 4, guidance: 'Conclusions', placeholders: [] },
        { id: 'funding', title: 'Funding', order: 5, guidance: 'Funding source', placeholders: [] },
      ],
      placeholders: [],
      guidance: 'The Lancet calls this "Summary" not "Abstract". Include funding source. Max 300 words.',
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [],
      guidance: 'Background, rationale, and research question. Concise but comprehensive.',
    },
    {
      section: 'methods',
      title: 'Methods',
      order: 4,
      subsections: [
        { id: 'study_design', title: 'Study design and participants', order: 1, guidance: 'Design and eligibility', placeholders: [] },
        { id: 'procedures', title: 'Procedures', order: 2, guidance: 'Interventions and data collection', placeholders: [] },
        { id: 'outcomes', title: 'Outcomes', order: 3, guidance: 'Primary and secondary', placeholders: [] },
        { id: 'statistical', title: 'Statistical analysis', order: 4, guidance: 'Analysis plan', placeholders: [] },
        { id: 'role_of_funding', title: 'Role of the funding source', order: 5, guidance: 'Funder involvement', placeholders: [] },
      ],
      placeholders: [],
      guidance: 'The Lancet requires explicit "Role of the funding source" subsection.',
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      placeholders: [],
      guidance: 'Enrollment, baseline, outcomes. Report with precision (exact p-values, CIs).',
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      placeholders: [],
      guidance: 'Interpretation, comparison with literature, strengths/limitations, implications.',
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'Vancouver style. The Lancet allows up to 40 references for Articles.',
    },
  ],
};
