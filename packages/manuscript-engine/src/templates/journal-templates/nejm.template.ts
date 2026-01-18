/**
 * NEJM (New England Journal of Medicine) Template
 * Task T53: Journal-specific manuscript template
 */

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
    total: { min: 2500, max: 3000 },
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['acknowledgments', 'supplementary'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [],
      guidance: 'Concise, descriptive title. Avoid abbreviations. Max 12 words preferred.',
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      subsections: [
        { id: 'background', title: 'Background', order: 1, guidance: '2-3 sentences', placeholders: [] },
        { id: 'methods', title: 'Methods', order: 2, guidance: 'Design and key methods', placeholders: [] },
        { id: 'results', title: 'Results', order: 3, guidance: 'Main findings with numbers', placeholders: [] },
        { id: 'conclusions', title: 'Conclusions', order: 4, guidance: '1-2 sentences', placeholders: [] },
      ],
      placeholders: [],
      guidance: 'Structured abstract. Max 250 words. No abbreviations except standard units.',
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [],
      guidance: 'Brief background and rationale. End with clear study objective. Max ~500 words.',
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
        { id: 'statistics', title: 'Statistical Analysis', order: 6, guidance: 'Sample size, methods', placeholders: [] },
      ],
      placeholders: [],
      guidance: 'Sufficient for replication. Include trial registration. NEJM prefers active voice.',
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      placeholders: [],
      guidance: 'Start with enrollment/baseline. Present primary outcome with CI. Limit to 6 figures/tables total.',
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      placeholders: [],
      guidance: 'Key findings, comparison with literature, limitations, implications. No new results.',
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'Vancouver style. Max 40 references typically. Use PubMed abbreviations.',
    },
  ],
};
