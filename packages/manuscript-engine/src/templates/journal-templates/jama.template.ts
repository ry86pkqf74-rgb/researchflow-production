/**
 * JAMA (Journal of the American Medical Association) Template
 * Task T53: Journal-specific manuscript template
 */

import type { ManuscriptTemplate } from '../imrad-templates';

export const JAMA_TEMPLATE: ManuscriptTemplate = {
  id: 'jama-original-investigation',
  name: 'JAMA Original Investigation',
  type: 'imrad',
  wordLimits: {
    abstract: { min: 300, max: 350 },
    introduction: { max: 800 },
    methods: { max: 1500 },
    results: { max: 1500 },
    discussion: { max: 1500 },
    total: { min: 3000, max: 3500 },
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments', 'supplementary'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [],
      guidance: 'Declarative sentence summarizing main finding. Max 150 characters.',
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      subsections: [
        { id: 'importance', title: 'Importance', order: 1, guidance: 'Why this matters', placeholders: [] },
        { id: 'objective', title: 'Objective', order: 2, guidance: 'Research question', placeholders: [] },
        { id: 'design', title: 'Design, Setting, and Participants', order: 3, guidance: 'Study design details', placeholders: [] },
        { id: 'interventions', title: 'Interventions/Exposures', order: 4, guidance: 'If applicable', placeholders: [] },
        { id: 'main_outcomes', title: 'Main Outcomes and Measures', order: 5, guidance: 'Primary outcome', placeholders: [] },
        { id: 'results', title: 'Results', order: 6, guidance: 'Key findings', placeholders: [] },
        { id: 'conclusions', title: 'Conclusions and Relevance', order: 7, guidance: 'Implications', placeholders: [] },
      ],
      placeholders: [],
      guidance: 'Structured abstract with all 7 headings. Max 350 words.',
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [],
      guidance: 'Context and objective. End with clear research question in final paragraph.',
    },
    {
      section: 'methods',
      title: 'Methods',
      order: 4,
      subsections: [
        { id: 'study_design', title: 'Study Design and Setting', order: 1, guidance: 'IRB approval first', placeholders: [] },
        { id: 'participants', title: 'Participants', order: 2, guidance: 'Eligibility and recruitment', placeholders: [] },
        { id: 'interventions', title: 'Interventions', order: 3, guidance: 'If applicable', placeholders: [] },
        { id: 'outcomes', title: 'Outcomes', order: 4, guidance: 'Primary and secondary', placeholders: [] },
        { id: 'statistical_analysis', title: 'Statistical Analysis', order: 5, guidance: 'Specify software', placeholders: [] },
      ],
      placeholders: [],
      guidance: 'Include trial registration if applicable. JAMA requires detailed statistical methods.',
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      placeholders: [],
      guidance: 'Start with participant flow. Report primary outcome first. Include effect sizes and CIs.',
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      placeholders: [],
      guidance: 'Start with answer to research question. Address limitations. Clinical implications.',
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'AMA style. Limit to 50 references. Use DOIs when available.',
    },
  ],
};
