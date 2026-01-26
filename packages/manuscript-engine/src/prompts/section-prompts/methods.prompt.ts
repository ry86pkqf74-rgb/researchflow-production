/**
 * Methods Section Prompts
 *
 * Structured prompts for generating methods sections.
 */

import type { SectionPromptContext } from '../../types';

export function buildMethodsPrompt(context: SectionPromptContext): string {
  return `Generate a comprehensive Methods section for a ${context.studyType} research manuscript.

${context.objective ? `Study Objective: ${context.objective}` : ''}

${context.methodology ? `Study Design: ${context.methodology}` : ''}

${context.existingContent ? `Existing Content:\n${context.existingContent}\n` : ''}

Structure the Methods section with these subsections:

1. **Study Design and Setting**:
   - Study type (${context.studyType})
   - Time period of data collection
   - Study location/setting
   - Ethical approval and registration

2. **Participants/Subjects**:
   - Inclusion and exclusion criteria
   - Recruitment strategy
   - Sample size calculation (if applicable)
   - Consent procedures

3. **Interventions/Exposures** (if applicable):
   - Detailed description of intervention(s)
   - Control/comparison group details
   - Randomization and blinding procedures
   - Treatment protocols

4. **Data Collection**:
   - Variables measured
   - Data collection methods and instruments
   - Measurement procedures
   - Quality control measures

5. **Statistical Analysis**:
   - Primary and secondary outcomes
   - Statistical tests used
   - Significance level (typically α = 0.05)
   - Software used
   - Handling of missing data
   - Subgroup analyses

Requirements:
- Use past tense throughout
- Provide sufficient detail for replication
- Be specific about timing, dosages, and procedures
- Include manufacturer details for equipment/reagents
- Cite established methods
- Define all abbreviations at first use
- Maintain clinical tone
- Typically 2-3 pages (800-1200 words)

Critical elements:
- Reproducibility: Include all details necessary for replication
- Precision: Be specific about measurements, timing, and procedures
- Transparency: Acknowledge limitations in methods
- Ethics: Clearly state ethical approvals and patient protections`;
}

export function buildMethodsSubsectionPrompt(
  subsection: 'design' | 'participants' | 'intervention' | 'data' | 'analysis',
  context: string
): string {
  const subsectionGuides = {
    design: `Write the Study Design and Setting subsection:
- Specify study type and design
- Describe setting and time period
- Note ethical approval and registration
- Explain overall study framework`,

    participants: `Write the Participants/Study Population subsection:
- Define inclusion and exclusion criteria clearly
- Describe recruitment and screening process
- Explain consent procedures
- Report sample size calculation if applicable`,

    intervention: `Write the Interventions subsection:
- Describe intervention protocol in detail
- Specify control/comparison conditions
- Explain randomization and blinding
- Note adherence monitoring
- Include timing and dosing details`,

    data: `Write the Data Collection subsection:
- List all variables and measures
- Describe instruments and tools used
- Explain data collection procedures
- Note quality assurance measures
- Specify timing of assessments`,

    analysis: `Write the Statistical Analysis subsection:
- Define primary and secondary outcomes
- Specify statistical tests for each analysis
- State significance level and corrections
- Name statistical software
- Explain handling of missing data
- Describe any subgroup or sensitivity analyses`,
  };

  return `${subsectionGuides[subsection]}

Context: ${context}

Provide a detailed, well-structured paragraph or series of paragraphs appropriate for a medical research manuscript Methods section.`;
}

export const METHODS_TEMPLATES = {
  study_design_opener: [
    'This [prospective/retrospective] [study type] was conducted at [institution/setting] between [dates].',
    'We performed a [study design] involving [number] [participants/patients] from [setting].',
    'A [study type] was designed to [objective], approved by [IRB], and registered at [registry] ([ID]).',
  ],

  participants_criteria: [
    'Eligible participants were [age range] [individuals/patients] with [condition/criteria].',
    'Inclusion criteria required [criterion 1], [criterion 2], and [criterion 3].',
    'Patients were excluded if they had [exclusion criterion].',
    '[Number] participants were recruited through [recruitment method].',
  ],

  intervention_description: [
    'The intervention group received [treatment/intervention] at [dose/frequency] for [duration].',
    'Participants were randomized [ratio] to [group 1] or [group 2] using [randomization method].',
    '[Blinding type] was maintained throughout the study period.',
  ],

  data_collection: [
    'Data were collected at [timepoints] using [instruments/methods].',
    'The primary outcome was [outcome], measured by [method/instrument].',
    'Secondary outcomes included [outcome 1], [outcome 2], and [outcome 3].',
    'All assessments were performed by [trained personnel/description] blinded to [group assignment/exposure].',
  ],

  statistical_analysis: [
    'Statistical analyses were performed using [Software Name] version [X].',
    'Continuous variables were compared using [statistical test] and categorical variables using [statistical test].',
    'A p-value < 0.05 was considered statistically significant.',
    'Sample size was calculated to detect a [effect size] with [power]% power at α = [significance level].',
    'Missing data were handled using [multiple imputation/complete case analysis/other method].',
  ],
};

export function getMethodsKeywords(): string[] {
  return [
    'design',
    'prospective',
    'retrospective',
    'randomized',
    'controlled',
    'blinded',
    'participants',
    'inclusion',
    'exclusion',
    'recruitment',
    'intervention',
    'protocol',
    'outcomes',
    'measures',
    'analysis',
    'statistical',
    'significance',
    'power',
  ];
}
