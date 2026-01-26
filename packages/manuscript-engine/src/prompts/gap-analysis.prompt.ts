/**
 * Gap Analysis Prompts for AI-Assisted Literature Review
 * Task T25: AI prompts for identifying research gaps in literature
 */

export interface GapAnalysisPromptParams {
  existingFindings: string[];
  researchQuestion: string;
  studyDesign: string;
  citations: Array<{
    title: string;
    abstract: string;
    findings: string;
  }>;
}

export const GAP_ANALYSIS_SYSTEM_PROMPT = `You are an expert medical research analyst specializing in systematic literature reviews. Your task is to identify research gaps, inconsistencies, and opportunities for future research based on a corpus of existing literature.

Focus on:
1. **Methodological Gaps**: Study designs not yet attempted, populations not studied, outcome measures not examined
2. **Knowledge Gaps**: Unanswered questions, conflicting findings, under-researched areas
3. **Practical Gaps**: Translation to clinical practice, cost-effectiveness, implementation barriers
4. **Temporal Gaps**: Outdated studies that need replication with modern methods

Provide evidence-based gap analysis with specific citations and actionable research directions.`;

export function buildGapAnalysisPrompt(params: GapAnalysisPromptParams): string {
  const citationSummaries = params.citations
    .map((c, idx) => `[${idx + 1}] ${c.title}\nKey finding: ${c.findings}`)
    .join('\n\n');

  return `Research Question: ${params.researchQuestion}

Proposed Study Design: ${params.studyDesign}

Existing Findings in the Literature:
${params.existingFindings.map((f, idx) => `${idx + 1}. ${f}`).join('\n')}

Citation Details:
${citationSummaries}

Task: Analyze the above literature and identify:

1. METHODOLOGICAL GAPS
   - What study designs have NOT been used?
   - What populations are underrepresented?
   - What outcome measures are missing?

2. KNOWLEDGE GAPS
   - What questions remain unanswered?
   - Where do findings conflict?
   - What mechanisms are poorly understood?

3. PRACTICAL GAPS
   - What barriers exist to clinical implementation?
   - What cost-effectiveness data is missing?
   - What real-world evidence is needed?

4. TEMPORAL GAPS
   - Which older studies need replication with modern methods?
   - What emerging technologies have not been evaluated?

For each gap identified:
- Cite specific studies [use numbers from citation list]
- Explain why this represents a true gap vs. negative results
- Suggest 1-2 specific research directions to address the gap

Format your response as structured JSON:
{
  "methodological": [{"gap": "...", "citations": [1, 3], "suggestion": "..."}],
  "knowledge": [...],
  "practical": [...],
  "temporal": [...]
}`;
}

export function buildConflictAnalysisPrompt(conflictingFindings: Array<{
  finding: string;
  citations: string[];
  studyDesign: string;
}>): string {
  const conflicts = conflictingFindings
    .map((cf, idx) =>
      `Conflict ${idx + 1}:
Finding: ${cf.finding}
Study Design: ${cf.studyDesign}
Citations: ${cf.citations.join(', ')}`
    )
    .join('\n\n');

  return `The following conflicting findings have been identified in the literature:

${conflicts}

Task: For each conflict, analyze:

1. METHODOLOGICAL DIFFERENCES
   - Do study designs explain the discrepancy?
   - Are populations different?
   - Were outcome measures comparable?

2. STATISTICAL CONSIDERATIONS
   - Are confidence intervals overlapping?
   - Could heterogeneity explain differences?
   - Are effect sizes clinically meaningful?

3. PUBLICATION BIAS
   - Are negative studies under-represented?
   - Do older vs. newer studies show different patterns?

4. RESOLUTION STRATEGY
   - What additional research would resolve the conflict?
   - Can meta-analysis reconcile findings?
   - Should subgroup analyses be performed?

Provide evidence-based explanation for conflicts and suggest resolution strategies.`;
}

export const THEMATIC_SYNTHESIS_PROMPT = `Given the following studies and their key findings, perform thematic synthesis:

1. IDENTIFY THEMES
   - Group findings into 3-5 major themes
   - Each theme should represent a distinct research focus

2. ASSESS THEME MATURITY
   - Emerging: <5 studies, conflicting findings
   - Developing: 5-10 studies, some consensus
   - Established: >10 studies, strong consensus

3. IDENTIFY CROSS-THEME GAPS
   - What connections between themes are unexplored?
   - What interdisciplinary research is needed?

4. PRIORITIZE RESEARCH DIRECTIONS
   - Rank themes by research need (high/medium/low)
   - Consider clinical impact, feasibility, and current evidence gaps

Format response as structured analysis with theme names, supporting citations, maturity level, and priority ranking.`;

export function buildLiteratureQualityPrompt(citations: Array<{
  title: string;
  journal: string;
  year: number;
  studyDesign: string;
  sampleSize?: number;
  hasBlinding?: boolean;
  hasRandomization?: boolean;
}>): string {
  const citationList = citations
    .map((c, idx) =>
      `[${idx + 1}] ${c.title}
Journal: ${c.journal} (${c.year})
Design: ${c.studyDesign}
Sample Size: ${c.sampleSize ?? 'Not reported'}
Blinding: ${c.hasBlinding ? 'Yes' : 'No'}
Randomization: ${c.hasRandomization ? 'Yes' : 'No'}`
    )
    .join('\n\n');

  return `Assess the quality and strength of the following evidence base:

${citationList}

Provide:

1. OVERALL QUALITY ASSESSMENT
   - Strength of evidence (high/moderate/low/very low) per GRADE criteria
   - Risk of bias across studies
   - Consistency of findings

2. INDIVIDUAL STUDY CRITIQUES
   - Identify high-quality vs. low-quality studies
   - Note methodological strengths and weaknesses
   - Flag studies with critical flaws

3. EVIDENCE SYNTHESIS
   - Can findings be pooled for meta-analysis?
   - Do high-quality studies agree with lower-quality studies?
   - What level of confidence can we have in conclusions?

4. RECOMMENDATIONS
   - What type of studies would strengthen evidence base?
   - Should low-quality studies be excluded from synthesis?
   - Is current evidence sufficient for clinical guidelines?

Use evidence-based medicine principles and cite specific studies by number.`;
}

export const GAP_ANALYSIS_PROMPTS = {
  system: GAP_ANALYSIS_SYSTEM_PROMPT,
  gapAnalysis: buildGapAnalysisPrompt,
  conflictAnalysis: buildConflictAnalysisPrompt,
  thematicSynthesis: THEMATIC_SYNTHESIS_PROMPT,
  qualityAssessment: buildLiteratureQualityPrompt,
} as const;
