import OpenAI from "openai";

// Get OpenAI API key with fallback
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn('[AI-Research] WARNING: No OpenAI API key configured. AI features will fail.');
  console.warn('[AI-Research] Set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY in .env');
}

const openai = new OpenAI({
  apiKey: apiKey || 'missing-key-will-fail',
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
});

export interface ResearchBrief {
  studyObjectives: string[];
  population: string;
  exposure: string;
  comparator: string;
  outcomes: string[];
  timeframe: string;
  candidateEndpoints: { name: string; definition: string }[];
  keyConfounders: string[];
  minimumDatasetFields: { field: string; reason: string }[];
  clarifyingPrompts: string[];
}

export interface EvidenceGapMap {
  knowns: { finding: string; evidence: string; sources: string[] }[];
  unknowns: { gap: string; importance: string; researchable: boolean }[];
  commonMethods: { method: string; description: string; applicability: string }[];
  commonPitfalls: { pitfall: string; mitigation: string }[];
  searchStrategies: { database: string; query: string }[];
}

export interface DataContribution {
  contributionStatements: { statement: string; dataSupport: string }[];
  claimBoundary: {
    canSay: string[];
    cannotSay: string[];
  };
  limitations: { limitation: string; impact: string; mitigation: string }[];
}

export interface TargetJournal {
  name: string;
  impactFactor: number;
  acceptanceLikelihood: "high" | "medium" | "low";
  alignment: string[];
  potentialGaps: string[];
  wordLimit: number;
  figureLimit: number;
  audience: string;
  whyThisJournal: string;
}

export interface StudyCard {
  id: number;
  title: string;
  researchQuestion: string;
  hypothesis: string;
  cohortDefinition: string;
  indexDate: string;
  exposures: string[];
  outcomes: string[];
  covariates: string[];
  plannedMethod: string;
  feasibilityScore: number;
  threatsToValidity: { threat: string; mitigation: string }[];
  expectedFigures: string[];
  expectedTables: string[];
  targetJournals: TargetJournal[];
}

export interface DecisionMatrix {
  proposals: {
    id: number;
    title: string;
    novelty: number;
    feasibility: number;
    clinicalImportance: number;
    timeToExecute: string;
    confoundingRisk: "low" | "medium" | "high";
    overallScore: number;
  }[];
  recommendedPick: number;
  reasons: string[];
}

export async function generateResearchBrief(topic: string, subtopic?: string): Promise<ResearchBrief> {
  const prompt = `You are a research methodology expert. Convert this research topic into a structured Research Brief.

Topic: ${topic}
${subtopic ? `Subtopic: ${subtopic}` : ""}

Generate a comprehensive research brief in JSON format with these exact fields:
- studyObjectives: array of 2-4 clear study objectives
- population: target population description (PICO P)
- exposure: intervention or exposure of interest (PICO I)
- comparator: comparison group (PICO C)
- outcomes: array of primary and secondary outcomes (PICO O)
- timeframe: study timeframe
- candidateEndpoints: array of {name, definition} for measurable endpoints
- keyConfounders: array of potential confounding variables to control
- minimumDatasetFields: array of {field, reason} for required dataset fields
- clarifyingPrompts: array of 3-5 questions to refine the research scope (e.g., "Primary outcome: time-to-event vs binary vs continuous?", "Index date definition?")

Return only valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export async function generateEvidenceGapMap(
  topic: string,
  population: string,
  outcomes: string[]
): Promise<EvidenceGapMap> {
  const prompt = `You are a systematic review expert. Generate an evidence gap map for this research topic.

Topic: ${topic}
Population: ${population}
Outcomes: ${outcomes.join(", ")}

Generate a comprehensive evidence gap map in JSON format with these exact fields:
- knowns: array of {finding, evidence, sources} for established evidence (3-5 items)
- unknowns: array of {gap, importance, researchable} for research gaps (3-5 items)
- commonMethods: array of {method, description, applicability} for methods used in this field
- commonPitfalls: array of {pitfall, mitigation} for methodological pitfalls
- searchStrategies: array of {database, query} with PubMed/Scholar style search queries

For sources, use realistic journal name patterns like "JAMA 2023", "Lancet 2022".
Return only valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 2500,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export async function generateDataContribution(
  topic: string,
  datasetSummary: {
    records: number;
    variables: number;
    dateRange: string;
    followUp: string;
    uniqueFeatures: string[];
  },
  evidenceGaps: string[]
): Promise<DataContribution> {
  const prompt = `You are a research contribution expert. Analyze how this dataset can contribute to the research field.

Topic: ${topic}
Dataset: ${datasetSummary.records} records, ${datasetSummary.variables} variables
Date Range: ${datasetSummary.dateRange}
Follow-up Period: ${datasetSummary.followUp}
Unique Features: ${datasetSummary.uniqueFeatures.join(", ")}
Known Evidence Gaps: ${evidenceGaps.join("; ")}

Generate contribution analysis in JSON format with these exact fields:
- contributionStatements: array of 3-7 {statement, dataSupport} describing what this data adds
- claimBoundary: object with {canSay: array of valid claims, cannotSay: array of limitations}
- limitations: array of {limitation, impact, mitigation} for study limitations

Return only valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export async function generateStudyCards(
  topic: string,
  researchBrief: ResearchBrief,
  datasetFields: string[],
  count: number = 7
): Promise<StudyCard[]> {
  const prompt = `You are a research methodology expert. Generate ${count} feasible manuscript study proposals.

Topic: ${topic}
Research Brief:
- Objectives: ${researchBrief.studyObjectives.join("; ")}
- Population: ${researchBrief.population}
- Exposure: ${researchBrief.exposure}
- Outcomes: ${researchBrief.outcomes.join(", ")}
- Timeframe: ${researchBrief.timeframe}

Available Dataset Fields: ${datasetFields.join(", ")}

For each proposal, generate a study card in JSON format. Return an array of ${count} objects, each with:
- id: sequential number 1-${count}
- title: compelling research paper title
- researchQuestion: specific research question
- hypothesis: testable hypothesis
- cohortDefinition: who is included/excluded
- indexDate: definition of time zero
- exposures: array of exposure variables
- outcomes: array of outcome variables
- covariates: array of confounders/covariates
- plannedMethod: statistical method (PSM/IPTW, Cox, GLM, etc.)
- feasibilityScore: 0-100 based on data availability
- threatsToValidity: array of 3-5 {threat, mitigation}
- expectedFigures: array of figure types (e.g., "Kaplan-Meier curve")
- expectedTables: array of table types (e.g., "Table 1 Demographics")
- targetJournals: array of 3 {name, impactFactor, acceptanceLikelihood, alignment, potentialGaps, wordLimit, figureLimit, audience, whyThisJournal}

For targetJournals:
- acceptanceLikelihood must be "high", "medium", or "low"
- alignment: array of 2-3 reasons why study fits the journal
- potentialGaps: array of 1-2 areas that may need strengthening
- impactFactor: realistic number (e.g., NEJM ~170, JAMA ~120, specialty journals 3-10)

Return only valid JSON array, no markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 8000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.proposals || parsed.studyCards || [];
}

export interface LiteraturePaper {
  id: number;
  title: string;
  authors: string;
  journal: string;
  year: number;
  pmid: string;
  doi: string;
  abstract: string;
  keyFindings: string[];
  methodology: string;
  sampleSize: string;
  relevanceScore: number;
  citationCount: number;
}

export interface LiteratureSearchResult {
  query: string;
  totalPapersFound: number;
  searchDatabases: string[];
  papers: LiteraturePaper[];
  thematicClusters: { theme: string; paperIds: number[]; summary: string }[];
  keyInsights: string[];
  researchGaps: string[];
  suggestedSearchExpansions: string[];
}

export async function generateLiteratureSearch(
  topic: string,
  population?: string,
  outcomes?: string
): Promise<LiteratureSearchResult> {
  const prompt = `You are a medical librarian and systematic review expert. Conduct a comprehensive literature search for this research topic.

Topic: ${topic}
${population ? `Population: ${population}` : ""}
${outcomes ? `Outcomes of interest: ${outcomes}` : ""}

Generate a realistic literature search result in JSON format with these exact fields:
- query: the optimized PubMed/MEDLINE search query you would use
- totalPapersFound: realistic number of papers found (typically 50-200 for focused topics)
- searchDatabases: array of databases searched ["PubMed", "Embase", "Cochrane Library", "Web of Science"]
- papers: array of 8-12 most relevant papers, each with:
  - id: sequential number
  - title: realistic academic paper title
  - authors: author string in format "Smith JA, Jones RB, et al."
  - journal: real medical journal name (JAMA, NEJM, Lancet, BMJ, specialty journals)
  - year: publication year (2018-2024)
  - pmid: realistic 8-digit PubMed ID
  - doi: realistic DOI format "10.xxxx/journal.xxxxx"
  - abstract: 2-3 sentence abstract summary
  - keyFindings: array of 2-3 main findings
  - methodology: study design (RCT, cohort study, meta-analysis, etc.)
  - sampleSize: sample size description (e.g., "n=1,234")
  - relevanceScore: 70-100 based on topic alignment
  - citationCount: realistic citation count
- thematicClusters: array of 3-4 themes grouping papers by topic
- keyInsights: array of 4-6 major insights from the literature
- researchGaps: array of 3-4 identified gaps in current research
- suggestedSearchExpansions: array of 2-3 related search terms to expand the review

Make the papers realistic with proper academic formatting. Include mix of recent papers and seminal older works.
Return only valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 6000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export interface ExtractionVariable {
  name: string;
  category: 'demographic' | 'clinical' | 'laboratory' | 'outcome' | 'covariate' | 'exposure';
  dataType: 'continuous' | 'categorical' | 'binary' | 'date' | 'ordinal';
  description: string;
  sourceInLiterature: string;
  statisticalUse: string;
  priority: 'required' | 'recommended' | 'optional';
}

export interface PlannedExtractionResult {
  researchObjective: string;
  primaryExposure: { variable: string; definition: string; rationale: string };
  primaryOutcome: { variable: string; definition: string; timeframe: string };
  secondaryOutcomes: { variable: string; definition: string }[];
  extractionVariables: ExtractionVariable[];
  suggestedCovariates: { variable: string; reason: string; adjustmentMethod: string }[];
  dataQualityChecks: { check: string; purpose: string }[];
  missingDataStrategy: { variable: string; expectedMissingness: string; handlingApproach: string }[];
  statisticalConsiderations: string[];
  sampleSizeNotes: string;
}

export async function generatePlannedExtraction(
  topic: string,
  literatureSummary?: string,
  researchGaps?: string[]
): Promise<PlannedExtractionResult> {
  const prompt = `You are a clinical research methodologist and biostatistician. Based on the research topic and literature review, create a comprehensive data extraction plan for statistical analysis.

Research Topic: ${topic}
${literatureSummary ? `Literature Summary: ${literatureSummary}` : ""}
${researchGaps?.length ? `Research Gaps to Address: ${researchGaps.join("; ")}` : ""}

Generate a planned extraction document in JSON format with these exact fields:
- researchObjective: clear statement of the primary research objective
- primaryExposure: object with {variable, definition, rationale} for the main exposure/intervention
- primaryOutcome: object with {variable, definition, timeframe} for the primary endpoint
- secondaryOutcomes: array of 3-4 secondary outcomes with {variable, definition}
- extractionVariables: array of 12-18 variables to extract, each with:
  - name: variable name (e.g., "age_at_baseline", "bmi", "hba1c_baseline")
  - category: one of "demographic", "clinical", "laboratory", "outcome", "covariate", "exposure"
  - dataType: one of "continuous", "categorical", "binary", "date", "ordinal"
  - description: what this variable represents
  - sourceInLiterature: which studies informed this variable choice
  - statisticalUse: how it will be used in analysis (e.g., "adjustment covariate", "effect modifier", "sensitivity analysis")
  - priority: one of "required", "recommended", "optional"
- suggestedCovariates: array of 5-8 covariates with {variable, reason, adjustmentMethod}
- dataQualityChecks: array of 4-6 quality checks with {check, purpose}
- missingDataStrategy: array of 3-4 strategies with {variable, expectedMissingness, handlingApproach}
- statisticalConsiderations: array of 4-6 important statistical considerations
- sampleSizeNotes: notes on sample size requirements based on literature

Make the extraction plan realistic and aligned with clinical research best practices.
Return only valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 6000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export async function generateDecisionMatrix(studyCards: StudyCard[]): Promise<DecisionMatrix> {
  const summaries = studyCards.map((c) => ({
    id: c.id,
    title: c.title,
    feasibilityScore: c.feasibilityScore,
    method: c.plannedMethod,
    threatCount: c.threatsToValidity.length,
  }));

  const prompt = `You are a research prioritization expert. Create a decision matrix for these manuscript proposals.

Proposals:
${JSON.stringify(summaries, null, 2)}

Generate a decision matrix in JSON format with:
- proposals: array of objects for each proposal with {id, title, novelty (0-100), feasibility (0-100), clinicalImportance (0-100), timeToExecute ("1-2 weeks", "3-4 weeks", etc.), confoundingRisk ("low"/"medium"/"high"), overallScore (0-100)}
- recommendedPick: id of the recommended proposal
- reasons: array of 3-4 reasons for the recommendation

Base scores on the feasibility and method complexity. Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export interface JournalRecommendation {
  id: string;
  name: string;
  impactFactor: number;
  acceptanceRate: string;
  reviewTime: string;
  strengths: string[];
  weaknesses: string[];
  fitScore: number;
  openAccess: boolean;
  publicationFee?: string;
  audience: string;
  focusAreas: string[];
}

export interface JournalSubmissionRequirements {
  journal: string;
  guidelinesUrl: string;
  manuscriptFormat: {
    wordLimit: number;
    abstractWordLimit: number;
    referenceLimit: number;
    tableLimit: number;
    figureLimit: number;
    structuredAbstract: boolean;
    sectionHeadings: string[];
  };
  requiredDocuments: {
    name: string;
    description: string;
    required: boolean;
    template?: string;
  }[];
  coverLetterRequirements: string[];
  disclosureRequirements: string[];
  ethicsRequirements: string[];
  dataAvailabilityPolicy: string;
  authorshipCriteria: string;
  checklist: {
    item: string;
    category: string;
    description: string;
  }[];
}

export async function generateJournalRecommendations(
  manuscriptTitle: string,
  manuscriptDescription: string,
  researchDomain: string,
  targetJournals?: string[]
): Promise<JournalRecommendation[]> {
  const prompt = `You are an expert academic publishing advisor. Based on the research manuscript details, recommend the best journals for submission.

Manuscript Title: ${manuscriptTitle}
Description: ${manuscriptDescription}
Research Domain: ${researchDomain}
${targetJournals?.length ? `Initial Journal Suggestions: ${targetJournals.join(", ")}` : ""}

Generate a list of 5-7 recommended journals in JSON format. Each journal should have:
- id: lowercase hyphenated identifier (e.g., "lancet-diabetes-endo")
- name: full journal name
- impactFactor: approximate 2024 impact factor (realistic number)
- acceptanceRate: acceptance rate as string (e.g., "15-20%")
- reviewTime: typical review time (e.g., "4-6 weeks", "2-3 months")
- strengths: array of 3-4 reasons why this journal is a good fit
- weaknesses: array of 2-3 potential challenges or mismatches
- fitScore: 0-100 score indicating how well the manuscript fits
- openAccess: boolean
- publicationFee: if open access, the approximate APC (e.g., "$3,500")
- audience: primary readership (e.g., "clinical endocrinologists", "academic researchers")
- focusAreas: array of 3-4 key focus areas of the journal

Order journals by fitScore (highest first). Include a mix of high-impact, mid-tier, and specialty journals.
Return only valid JSON as an array of journal objects.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  return parsed.journals || parsed;
}

export async function generateSubmissionRequirements(
  journalName: string,
  manuscriptType: string = "Original Research"
): Promise<JournalSubmissionRequirements> {
  const prompt = `You are an expert in academic journal submission requirements. Generate detailed submission requirements for ${journalName}.

Manuscript Type: ${manuscriptType}

Generate submission requirements in JSON format with these exact fields:
- journal: the journal name
- guidelinesUrl: realistic author guidelines URL (e.g., "https://journalname.com/author-guidelines")
- manuscriptFormat: object with:
  - wordLimit: maximum word count for main text (number)
  - abstractWordLimit: abstract word limit (number)
  - referenceLimit: maximum references (number or null if unlimited)
  - tableLimit: maximum tables (number or null)
  - figureLimit: maximum figures (number or null)
  - structuredAbstract: boolean (whether abstract needs IMRAD sections)
  - sectionHeadings: array of required section headings (e.g., ["Introduction", "Methods", "Results", "Discussion"])
- requiredDocuments: array of documents needed, each with:
  - name: document name
  - description: what it should contain
  - required: boolean
  - template: optional template text or guidelines
- coverLetterRequirements: array of 4-6 specific elements required in cover letter
- disclosureRequirements: array of 3-5 disclosure types needed (conflicts of interest, funding, etc.)
- ethicsRequirements: array of 3-4 ethics statements needed
- dataAvailabilityPolicy: string describing the journal's data sharing requirements
- authorshipCriteria: ICMJE or journal-specific authorship requirements
- checklist: array of 15-20 checklist items, each with:
  - item: short name
  - category: one of "Manuscript", "Ethics", "Figures", "Tables", "References", "Supplementary", "Administrative"
  - description: what needs to be checked/included

Make requirements realistic and consistent with major medical/scientific journals.
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 5000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export async function generateSubmissionDocuments(
  journalName: string,
  manuscriptTitle: string,
  manuscriptAbstract: string,
  authors: string[],
  correspondingAuthor: string,
  requirements: JournalSubmissionRequirements
): Promise<{
  coverLetter: string;
  titlePage: string;
  highlightsPoints: string[];
  conflictOfInterest: string;
  authorContributions: string;
  dataAvailabilityStatement: string;
  ethicsStatement: string;
}> {
  const prompt = `You are an expert academic writer. Generate submission documents for a manuscript submission.

Journal: ${journalName}
Manuscript Title: ${manuscriptTitle}
Abstract: ${manuscriptAbstract}
Authors: ${authors.join(", ")}
Corresponding Author: ${correspondingAuthor}

Cover Letter Requirements: ${requirements.coverLetterRequirements.join("; ")}
Disclosure Requirements: ${requirements.disclosureRequirements.join("; ")}
Ethics Requirements: ${requirements.ethicsRequirements.join("; ")}
Data Availability Policy: ${requirements.dataAvailabilityPolicy}

Generate the following submission documents in JSON format:
- coverLetter: professional cover letter (300-400 words) addressed to the Editor-in-Chief, highlighting significance and novelty
- titlePage: formatted title page with title, authors, affiliations, corresponding author details, word count, keywords
- highlightsPoints: array of 3-5 key highlights/bullet points (each 85 characters or less)
- conflictOfInterest: conflict of interest disclosure statement
- authorContributions: CRediT-style author contributions statement
- dataAvailabilityStatement: appropriate data availability statement
- ethicsStatement: ethics and consent statement appropriate for the study

Make all documents professional and publication-ready.
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

// ====================================================================
// STAGE 3: IRB PROPOSAL GENERATION
// ====================================================================
export interface IRBProposalResult {
  protocolTitle: string;
  studySummary: string;
  background: string;
  objectives: { primary: string; secondary: string[] };
  studyDesign: string;
  population: {
    inclusion: string[];
    exclusion: string[];
    estimatedSize: string;
  };
  dataCollection: {
    sources: string[];
    variables: string[];
    timeline: string;
  };
  riskAssessment: {
    riskLevel: 'minimal' | 'moderate' | 'greater than minimal';
    risks: string[];
    mitigations: string[];
  };
  consentConsiderations: {
    consentType: string;
    waiverJustification?: string;
    consentProcess: string;
  };
  privacyProtection: string[];
  limitations: string[];
}

export async function generateIRBProposal(
  topic: string,
  population: string,
  intervention: string,
  outcomes: string,
  timeframe?: string,
  studyDesign?: string
): Promise<IRBProposalResult> {
  const prompt = `You are a clinical research ethics expert. Generate a comprehensive IRB proposal draft for this research study.

Research Topic: ${topic}
Population: ${population}
Intervention/Exposure: ${intervention}
Primary Outcomes: ${outcomes}
${timeframe ? `Timeframe: ${timeframe}` : ""}
${studyDesign ? `Study Design: ${studyDesign}` : "Study Design: Retrospective cohort study"}

Generate a detailed IRB proposal in JSON format with these fields:
- protocolTitle: formal protocol title
- studySummary: 150-200 word summary of the study
- background: 2-3 paragraph background section with rationale
- objectives: object with "primary" (single statement) and "secondary" (array of 2-3 objectives)
- studyDesign: detailed description of the study design and methodology
- population: object with "inclusion" (array of 4-6 criteria), "exclusion" (array of 3-5 criteria), "estimatedSize" (sample size rationale)
- dataCollection: object with "sources" (data sources), "variables" (key variables), "timeline" (data collection period)
- riskAssessment: object with "riskLevel" (one of "minimal", "moderate", "greater than minimal"), "risks" (array of potential risks), "mitigations" (array of mitigation strategies)
- consentConsiderations: object with "consentType" (e.g., "waiver of consent", "written consent"), "waiverJustification" (if applicable), "consentProcess" (description)
- privacyProtection: array of 4-6 privacy/confidentiality protection measures
- limitations: array of 3-4 study limitations

Make the proposal realistic, comprehensive, and aligned with Common Rule (45 CFR 46) requirements.
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 5000,
  });

  const contentIRB = response.choices[0]?.message?.content || "{}";
  return JSON.parse(contentIRB);
}

// ====================================================================
// STAGE 10: GAP ANALYSIS
// ====================================================================
export interface GapAnalysisResult {
  populationGaps: { gap: string; explanation: string; opportunity: string }[];
  methodologyGaps: { gap: string; explanation: string; opportunity: string }[];
  outcomeGaps: { gap: string; explanation: string; opportunity: string }[];
  temporalGaps: { gap: string; explanation: string; opportunity: string }[];
  opportunityMatrix: {
    area: string;
    feasibility: 'high' | 'medium' | 'low';
    novelty: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    score: number;
    recommendation: string;
  }[];
  strategicPositioning: string;
  keyDifferentiators: string[];
}

export async function generateGapAnalysis(
  topic: string,
  population: string,
  outcomes: string,
  literatureSummary?: string
): Promise<GapAnalysisResult> {
  const prompt = `You are a research strategist and systematic review expert. Analyze the research gaps for this study topic.

Research Topic: ${topic}
Study Population: ${population}
Primary Outcomes: ${outcomes}
${literatureSummary ? `Literature Summary: ${literatureSummary}` : ""}

Generate a comprehensive gap analysis in JSON format with these fields:
- populationGaps: array of 2-3 population-related gaps, each with "gap", "explanation", "opportunity"
- methodologyGaps: array of 2-3 methodology gaps, each with "gap", "explanation", "opportunity"
- outcomeGaps: array of 2-3 outcome-related gaps, each with "gap", "explanation", "opportunity"
- temporalGaps: array of 1-2 temporal/timeframe gaps, each with "gap", "explanation", "opportunity"
- opportunityMatrix: array of 4-6 research opportunities, each with:
  - area: research area/opportunity name
  - feasibility: "high", "medium", or "low"
  - novelty: "high", "medium", or "low"
  - impact: "high", "medium", or "low"
  - score: 0-100 overall priority score
  - recommendation: specific recommendation
- strategicPositioning: 2-3 sentences on how to position this research
- keyDifferentiators: array of 3-4 unique aspects of this study

Make the analysis actionable and specific to the research context.
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 4000,
  });

  const contentGap = response.choices[0]?.message?.content || "{}";
  return JSON.parse(contentGap);
}

// ====================================================================
// STAGE 13: STATISTICAL ANALYSIS
// ====================================================================
export interface StatisticalAnalysisResult {
  analysisOverview: string;
  primaryAnalysis: {
    method: string;
    model: string;
    results: string;
    interpretation: string;
  };
  secondaryAnalyses: {
    name: string;
    method: string;
    results: string;
  }[];
  subgroupAnalyses: {
    subgroup: string;
    result: string;
    pInteraction: string;
  }[];
  sensitivityAnalyses: {
    analysis: string;
    result: string;
    conclusion: string;
  }[];
  tables: {
    tableNumber: number;
    title: string;
    content: string;
  }[];
  keyFindings: string[];
  limitations: string[];
}

export async function generateStatisticalAnalysis(
  topic: string,
  population: string,
  intervention: string,
  comparator: string,
  outcomes: string,
  sampleSize?: number
): Promise<StatisticalAnalysisResult> {
  const prompt = `You are a biostatistician conducting analysis for a clinical research study. Generate realistic statistical analysis results.

Research Topic: ${topic}
Population: ${population}
Exposure/Intervention: ${intervention}
Comparator: ${comparator}
Primary Outcomes: ${outcomes}
${sampleSize ? `Sample Size: ${sampleSize}` : "Sample Size: Generate realistic N based on study type"}

Generate statistical analysis results in JSON format with:
- analysisOverview: 2-3 sentence summary of analytical approach
- primaryAnalysis: object with "method" (e.g., Cox regression), "model" (model specification), "results" (effect estimate with 95% CI and p-value), "interpretation" (clinical interpretation)
- secondaryAnalyses: array of 2-3 secondary analyses with "name", "method", "results"
- subgroupAnalyses: array of 3-4 subgroup results with "subgroup", "result" (HR/OR with CI), "pInteraction"
- sensitivityAnalyses: array of 3-4 sensitivity analyses with "analysis", "result", "conclusion"
- tables: array of 2-3 results tables with "tableNumber", "title", "content" (formatted table as string)
- keyFindings: array of 4-5 key statistical findings
- limitations: array of 3-4 statistical limitations

Generate realistic statistical results that would be plausible for this research question.
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 5000,
  });

  const contentStats = response.choices[0]?.message?.content || "{}";
  return JSON.parse(contentStats);
}

// ====================================================================
// STAGE 14: MANUSCRIPT DRAFT
// ====================================================================
export interface ManuscriptDraftResult {
  title: string;
  abstract: {
    background: string;
    methods: string;
    results: string;
    conclusions: string;
    wordCount: number;
  };
  introduction: string;
  methods: string;
  results: string;
  discussion: string;
  conclusions: string;
  keywords: string[];
  wordCount: number;
  suggestedFigures: { number: number; title: string; description: string }[];
  suggestedTables: { number: number; title: string; description: string }[];
}

export async function generateManuscriptDraft(
  topic: string,
  population: string,
  intervention: string,
  comparator: string,
  outcomes: string,
  statisticalResults?: string,
  literatureSummary?: string
): Promise<ManuscriptDraftResult> {
  const prompt = `You are a medical writer drafting a research manuscript. Generate a complete first draft.

Research Topic: ${topic}
Population: ${population}
Intervention/Exposure: ${intervention}
Comparator: ${comparator}
Outcomes: ${outcomes}
${statisticalResults ? `Key Statistical Results: ${statisticalResults}` : ""}
${literatureSummary ? `Literature Context: ${literatureSummary}` : ""}

Generate a complete manuscript draft in JSON format with:
- title: concise, descriptive title (15-20 words)
- abstract: object with "background" (2-3 sentences), "methods" (3-4 sentences), "results" (3-4 sentences), "conclusions" (2-3 sentences), "wordCount" (should be 200-300)
- introduction: 3-4 paragraph introduction with background, gap, and objectives (400-500 words)
- methods: detailed methods section covering study design, population, exposures, outcomes, statistical analysis (500-700 words)
- results: results section with baseline characteristics, primary analysis, secondary analyses (500-700 words)
- discussion: 4-5 paragraph discussion with key findings, comparison to literature, implications, limitations, future directions (600-800 words)
- conclusions: final conclusions paragraph (100-150 words)
- keywords: array of 5-6 MeSH terms/keywords
- wordCount: total manuscript word count (target 3000-4000)
- suggestedFigures: array of 2-3 suggested figures with "number", "title", "description"
- suggestedTables: array of 2-3 suggested tables with "number", "title", "description"

Write in formal academic style appropriate for peer-reviewed publication.
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",  // Use more capable model for manuscript writing
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 8000,
  });

  const contentDraft = response.choices[0]?.message?.content || "{}";
  return JSON.parse(contentDraft);
}

// ====================================================================
// STAGE 15: MANUSCRIPT POLISH
// ====================================================================
export interface ManuscriptPolishResult {
  revisionSummary: string;
  languageCorrections: { original: string; corrected: string; reason: string }[];
  structuralImprovements: string[];
  clarityEnhancements: string[];
  consistencyChecks: { issue: string; resolution: string }[];
  referenceFormatting: string;
  readabilityScore: number;
  wordCountFinal: number;
  checklist: { item: string; status: 'complete' | 'needs attention'; notes: string }[];
}

export async function generateManuscriptPolish(
  manuscriptDraft: string,
  targetJournal?: string
): Promise<ManuscriptPolishResult> {
  const draftSummary = manuscriptDraft.length > 2000
    ? manuscriptDraft.substring(0, 2000) + "..."
    : manuscriptDraft;

  const prompt = `You are a professional medical editor polishing a manuscript for submission.

Manuscript Summary: ${draftSummary}
${targetJournal ? `Target Journal: ${targetJournal}` : ""}

Generate a manuscript polish report in JSON format with:
- revisionSummary: overview of revisions made (100-150 words)
- languageCorrections: array of 5-8 example corrections with "original", "corrected", "reason"
- structuralImprovements: array of 4-6 structural improvements made
- clarityEnhancements: array of 4-6 clarity improvements
- consistencyChecks: array of 3-4 consistency issues with "issue", "resolution"
- referenceFormatting: description of reference style applied
- readabilityScore: Flesch-Kincaid grade level (typically 12-16 for academic writing)
- wordCountFinal: final word count after editing
- checklist: array of 8-10 submission checklist items with "item", "status" ("complete" or "needs attention"), "notes"

Provide actionable feedback for manuscript improvement.
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 3000,
  });

  const contentPolish = response.choices[0]?.message?.content || "{}";
  return JSON.parse(contentPolish);
}
