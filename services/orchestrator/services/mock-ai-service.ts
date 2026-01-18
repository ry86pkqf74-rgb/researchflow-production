/**
 * Mock AI Service for DEMO mode
 * Provides realistic sample responses without making real AI API calls
 */

import { AppMode } from '@researchflow/core';

/**
 * Mock AI responses for different workflow stages
 */
export const MOCK_AI_RESPONSES = {
  topicDeclaration: {
    researchBrief: `[DEMO MODE - Sample Research Brief]

**Research Topic:** Impact of Telemedicine on Diabetes Management

**Study Design:** Retrospective cohort study, 2020-2024

**Population:** Adult patients (≥18 years) with Type 2 Diabetes Mellitus

**Exposure:** Enrollment in telemedicine program vs. traditional in-person care

**Comparator:** Standard care with in-person visits only

**Primary Outcome:** Change in HbA1c from baseline to 12 months

**Secondary Outcomes:**
- Healthcare utilization (ED visits, hospitalizations)
- Medication adherence
- Patient satisfaction scores

**Key Confounders to Consider:**
- Baseline HbA1c
- Age, sex, race/ethnicity
- Insurance type
- Comorbidity burden (Charlson Comorbidity Index)
- Socioeconomic status (ZIP code-level median income)
- Duration of diabetes

**Suggested Refinements:**
- Consider stratifying by rural vs. urban status (telemedicine may have differential effects)
- Address selection bias in telemedicine adoption through propensity score methods
- Plan for missing A1C values (~15% expected) - use multiple imputation
- Define index date clearly (first telemedicine visit vs. matched calendar time)

**Alternative Design Considerations:**
- Propensity score matching to create balanced comparison groups
- Difference-in-differences if pre-telemedicine data available
- Instrumental variable approach if strong instrument exists

**Minimum Dataset Requirements:**
- Patient demographics (age, sex, race/ethnicity)
- Clinical measures (HbA1c, BMI, blood pressure)
- Encounter data (dates, types, locations)
- Medication records (prescriptions, fills)
- Comorbidity codes (ICD-10)
- Insurance/payer information`,

    suggestedDataPoints: [
      'HbA1c measurements (baseline and follow-up)',
      'Telemedicine encounter dates and types',
      'In-person visit dates',
      'Patient demographics',
      'Comorbidity diagnoses',
      'Medication prescriptions and fills',
      'Healthcare utilization events'
    ],

    clarifyingQuestions: [
      'Do you have pre-telemedicine baseline data for comparison?',
      'What is your minimum required follow-up duration?',
      'Should we exclude patients who switch between groups?',
      'Are you interested in cost-effectiveness outcomes?'
    ]
  },

  evidenceGapMap: {
    knowns: [
      {
        finding: 'Telemedicine improves access to care in rural areas',
        evidence: 'Strong evidence from multiple systematic reviews',
        sources: ['Smith et al. 2023', 'Johnson et al. 2022']
      },
      {
        finding: 'Remote glucose monitoring can improve glycemic control',
        evidence: 'Moderate evidence from RCTs',
        sources: ['Lee et al. 2024', 'Chen et al. 2023']
      }
    ],
    unknowns: [
      {
        gap: 'Long-term sustainability of telemedicine effects',
        importance: 'High - critical for policy decisions',
        researchable: true
      },
      {
        gap: 'Differential effectiveness by socioeconomic status',
        importance: 'High - equity considerations',
        researchable: true
      }
    ],
    commonMethods: [
      {
        method: 'Propensity score matching',
        description: 'Match telemedicine users to non-users on baseline characteristics',
        applicability: 'Well-suited for this observational study'
      },
      {
        method: 'Difference-in-differences',
        description: 'Compare pre-post changes between telemedicine and control groups',
        applicability: 'Requires pre-intervention data'
      }
    ],
    searchStrategies: [
      {
        database: 'PubMed',
        query: '(telemedicine OR telehealth) AND (diabetes OR "glycemic control") AND (outcomes OR effectiveness)'
      },
      {
        database: 'Cochrane',
        query: 'telemedicine AND diabetes'
      }
    ]
  },

  literatureSearch: {
    results: [
      {
        title: '[DEMO] Effectiveness of Telemedicine in Managing Type 2 Diabetes: A Systematic Review',
        authors: 'Smith J, Johnson M, Williams K',
        year: 2024,
        journal: 'JAMA Network Open',
        relevance: 'High',
        keyFindings: 'Telemedicine associated with 0.5% reduction in HbA1c compared to usual care',
        methodology: 'Systematic review and meta-analysis of 24 RCTs',
        citation: 'JAMA Netw Open. 2024;7(1):e2352891'
      },
      {
        title: '[DEMO] Telemedicine Adoption and Health Outcomes in Chronic Disease Management',
        authors: 'Chen L, Rodriguez A, Park S',
        year: 2023,
        journal: 'Annals of Internal Medicine',
        relevance: 'High',
        keyFindings: 'Similar effectiveness to in-person care, higher patient satisfaction',
        methodology: 'Retrospective cohort study, N=15,432',
        citation: 'Ann Intern Med. 2023;176(8):1034-1042'
      },
      {
        title: '[DEMO] Digital Health Interventions for Diabetes: Real-World Evidence',
        authors: 'Lee H, Thompson R, Davis C',
        year: 2023,
        journal: 'Diabetes Care',
        relevance: 'Medium',
        keyFindings: 'Remote monitoring improved medication adherence by 22%',
        methodology: 'Pragmatic randomized trial, N=892',
        citation: 'Diabetes Care. 2023;46(4):847-854'
      }
    ],
    summary: '[DEMO] Found 3 highly relevant studies. Evidence suggests telemedicine is effective for diabetes management with potential benefits in glycemic control and medication adherence.'
  },

  statisticalAnalysis: {
    summary: `[DEMO MODE - Statistical Analysis Output]

**Primary Analysis: Propensity Score Matched Cohort**

**Sample Size:**
- Telemedicine group: N=1,245
- Control group: N=1,245 (matched 1:1)

**Baseline Balance (after matching):**
All standardized differences <0.1, indicating good balance

**Primary Outcome: Change in HbA1c at 12 months**
- Telemedicine: -0.62% (95% CI: -0.71 to -0.53)
- Control: -0.31% (95% CI: -0.40 to -0.22)
- Difference: -0.31% (95% CI: -0.44 to -0.18), p<0.001

**Secondary Outcomes:**
- ED visits: RR 0.78 (95% CI: 0.64-0.95), p=0.012
- Hospitalizations: RR 0.82 (95% CI: 0.66-1.03), p=0.088
- Medication adherence: +12% absolute increase, p<0.001

**Sensitivity Analyses:**
1. Multiple imputation for missing HbA1c: Results robust
2. Per-protocol analysis: Stronger effect (difference -0.41%)
3. Subgroup by baseline HbA1c: Greater benefit in poorly controlled patients (HbA1c >9%)`,

    tables: [
      '[DEMO] Table 1: Baseline Characteristics (before and after propensity score matching)',
      '[DEMO] Table 2: Primary and Secondary Outcomes',
      '[DEMO] Table 3: Subgroup Analyses by Age, Sex, and Baseline HbA1c',
      '[DEMO] Table 4: Sensitivity Analyses'
    ],

    figures: [
      '[DEMO] Figure 1: Propensity score distribution before and after matching',
      '[DEMO] Figure 2: Change in HbA1c over time by study group',
      '[DEMO] Figure 3: Subgroup analysis forest plot'
    ]
  },

  manuscriptDraft: {
    text: `[DEMO MODE - Manuscript Draft Preview]

# Impact of Telemedicine on Glycemic Control in Type 2 Diabetes: A Propensity-Matched Cohort Study

## Abstract

**Background:** Telemedicine has emerged as a promising approach for chronic disease management, but real-world evidence on its effectiveness for diabetes care remains limited.

**Objective:** To evaluate the impact of telemedicine on glycemic control and healthcare utilization among patients with Type 2 Diabetes Mellitus.

**Design:** Retrospective propensity score-matched cohort study.

**Setting:** Large integrated healthcare system, 2020-2024.

**Participants:** 2,490 adults with Type 2 Diabetes (1,245 telemedicine users matched 1:1 to traditional care controls).

**Main Outcomes:** Primary outcome was change in HbA1c at 12 months. Secondary outcomes included emergency department visits, hospitalizations, and medication adherence.

**Results:** Telemedicine was associated with a significantly greater reduction in HbA1c compared to traditional care (-0.62% vs -0.31%, difference -0.31%, 95% CI: -0.44 to -0.18, p<0.001). Telemedicine users also had fewer emergency department visits (RR 0.78, 95% CI: 0.64-0.95) and higher medication adherence (+12%, p<0.001). Benefits were most pronounced among patients with baseline HbA1c >9%.

**Conclusions:** Telemedicine is an effective alternative to traditional in-person care for diabetes management, with particular benefits for patients with poor baseline glycemic control.

## Introduction

[DEMO MODE - This section would contain a comprehensive introduction with literature review and study rationale...]

## Methods

[DEMO MODE - Detailed methods section would appear here, including study design, population, exposure definition, outcomes, statistical analysis plan...]

*Note: This is a demonstration. In LIVE mode, the full manuscript draft would be generated based on your actual research data and analysis.*`,

    sections: [
      'Abstract',
      'Introduction',
      'Methods',
      'Results',
      'Discussion',
      'Conclusions',
      'References'
    ],

    wordCount: '[DEMO] ~4,500 words (target journal: 3,000-5,000 words)',
    targetJournal: 'JAMA Network Open'
  },

  phiScan: {
    status: 'PASS',
    detected: [],
    message: '[DEMO MODE] PHI scan simulation - no sensitive data detected',
    scannedFields: ['patient_id', 'visit_date', 'diagnosis_codes'],
    recommendations: [
      'All fields appear to be properly de-identified',
      'Consider adding random noise to dates for extra protection',
      'Verify geographic granularity (ZIP codes should be 3-digit only)'
    ]
  },

  journalRecommendations: [
    {
      id: 'jama-network-open',
      name: 'JAMA Network Open',
      impactFactor: 13.8,
      acceptanceRate: '15%',
      reviewTime: '6-8 weeks',
      strengths: [
        'High visibility for health services research',
        'Open access increases dissemination',
        'Rigorous peer review enhances credibility'
      ],
      weaknesses: [
        'High submission fees (~$3,000)',
        'Competitive acceptance rate',
        'Strict word limits'
      ],
      fitScore: 92,
      openAccess: true,
      publicationFee: '$3,000'
    },
    {
      id: 'diabetes-care',
      name: 'Diabetes Care',
      impactFactor: 16.2,
      acceptanceRate: '20%',
      reviewTime: '4-6 weeks',
      strengths: [
        'Premier diabetes journal',
        'Read by clinical and research audiences',
        'Faster review process'
      ],
      weaknesses: [
        'May prefer clinical trials over observational studies',
        'Limited space for health services research'
      ],
      fitScore: 88,
      openAccess: false,
      publicationFee: 'Optional ($3,500 for open access)'
    }
  ]
};

/**
 * Get mock AI response for a specific stage
 */
export function getMockAIResponse(stage: string, input?: any): any {
  const stageKey = stage as keyof typeof MOCK_AI_RESPONSES;

  if (MOCK_AI_RESPONSES[stageKey]) {
    return {
      mode: AppMode.DEMO,
      mockResponse: true,
      stage,
      data: MOCK_AI_RESPONSES[stageKey],
      timestamp: new Date().toISOString(),
      note: 'This is a demonstration response. Switch to LIVE mode for real AI-powered analysis.'
    };
  }

  // Default mock response for unknown stages
  return {
    mode: AppMode.DEMO,
    mockResponse: true,
    stage,
    message: `Demo mode active for stage: ${stage}`,
    note: 'Real AI functionality is disabled in DEMO mode',
    timestamp: new Date().toISOString()
  };
}

/**
 * Simulate AI processing delay (for realistic UX in demo mode)
 */
export async function simulateAIDelay(minMs: number = 500, maxMs: number = 1500): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Get mock response with simulated delay
 */
export async function getMockAIResponseWithDelay(stage: string, input?: any): Promise<any> {
  await simulateAIDelay();
  return getMockAIResponse(stage, input);
}
