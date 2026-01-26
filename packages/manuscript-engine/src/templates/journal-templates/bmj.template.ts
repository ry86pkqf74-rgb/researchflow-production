/**
 * BMJ (British Medical Journal) Template
 * Task T53: Journal-specific manuscript template
 */

import type { ManuscriptTemplate} from '../imrad-templates';

export const BMJ_TEMPLATE: ManuscriptTemplate = {
  id: 'bmj-research',
  name: 'BMJ Research',
  type: 'imrad',
  wordLimits: {
    abstract: { min: 250, max: 300 },
    introduction: { max: 800 },
    methods: { max: 1500 },
    results: { max: 1500 },
    discussion: { max: 1500 },
    total: { min: 3000, max: 4000 },
  },
  requiredSections: ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'],
  optionalSections: ['keywords', 'acknowledgments', 'supplementary', 'what_is_already_known', 'what_this_study_adds'],
  sections: [
    {
      section: 'title',
      title: 'Title',
      order: 1,
      placeholders: [],
      guidance: 'Clear, informative title. Max 25 words.',
    },
    {
      section: 'abstract',
      title: 'Abstract',
      order: 2,
      subsections: [
        { id: 'objective', title: 'Objective', order: 1, guidance: 'Research aim', placeholders: [] },
        { id: 'design', title: 'Design', order: 2, guidance: 'Study design', placeholders: [] },
        { id: 'setting', title: 'Setting', order: 3, guidance: 'Location and context', placeholders: [] },
        { id: 'participants', title: 'Participants', order: 4, guidance: 'Who was studied', placeholders: [] },
        { id: 'interventions', title: 'Interventions', order: 5, guidance: 'If applicable', placeholders: [] },
        { id: 'main_outcome', title: 'Main outcome measures', order: 6, guidance: 'Primary outcomes', placeholders: [] },
        { id: 'results', title: 'Results', order: 7, guidance: 'Main findings', placeholders: [] },
        { id: 'conclusions', title: 'Conclusions', order: 8, guidance: 'Implications', placeholders: [] },
      ],
      placeholders: [],
      guidance: 'Structured abstract with 8 headings. Max 300 words.',
    },
    {
      section: 'introduction',
      title: 'Introduction',
      order: 3,
      placeholders: [],
      guidance: 'Background and study objectives.',
    },
    {
      section: 'methods',
      title: 'Methods',
      order: 4,
      subsections: [
        { id: 'study_design', title: 'Study design and setting', order: 1, guidance: 'Design details', placeholders: [] },
        { id: 'participants', title: 'Participants', order: 2, guidance: 'Eligibility', placeholders: [] },
        { id: 'data_collection', title: 'Data collection', order: 3, guidance: 'How data was obtained', placeholders: [] },
        { id: 'outcomes', title: 'Outcome measures', order: 4, guidance: 'Primary and secondary', placeholders: [] },
        { id: 'statistical_analysis', title: 'Statistical analysis', order: 5, guidance: 'Methods used', placeholders: [] },
      ],
      placeholders: [],
      guidance: 'BMJ emphasizes transparency. Include patient/public involvement if applicable.',
    },
    {
      section: 'results',
      title: 'Results',
      order: 5,
      placeholders: [],
      guidance: 'Present findings systematically. Use tables and figures effectively.',
    },
    {
      section: 'discussion',
      title: 'Discussion',
      order: 6,
      placeholders: [],
      guidance: 'Interpretation, strengths/limitations, clinical implications. BMJ requires "What is already known" and "What this study adds" boxes.',
    },
    {
      section: 'references',
      title: 'References',
      order: 7,
      placeholders: [],
      guidance: 'Vancouver style. BMJ limits references to 30 for research articles.',
    },
  ],
};
