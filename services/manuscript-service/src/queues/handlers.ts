/**
 * Job Handlers for Manuscript Service
 * Implements Phase B task handlers using manuscript-engine services
 */

import { v4 as uuidv4 } from 'uuid';
import { getModelRouter } from '@researchflow/ai-router';
import {
  ManuscriptJobType,
  type ManuscriptJob,
  type GenerateOutlineJob,
  type DraftIntroJob,
  type ExportJob,
  type PeerReviewJob,
  type PlagiarismCheckJob,
  type ClaimVerifyJob,
} from '../types/job.types';
import { manuscriptStore } from '../services/manuscript-store';
import { sanitizePhiFindings, sanitizePlagiarismResults, sanitizeClaimResults } from '../services/phi-sanitize';

// Type for progress callback
type ProgressCallback = (progress: number) => void;

/**
 * Main job handler - routes to specific handlers based on job type
 */
export async function handleManuscriptJob(
  job: ManuscriptJob,
  onProgress: ProgressCallback
): Promise<Record<string, unknown>> {
  switch (job.type) {
    case ManuscriptJobType.GENERATE_OUTLINE:
      return handleGenerateOutline(job as GenerateOutlineJob, onProgress);

    case ManuscriptJobType.DRAFT_INTRO_WITH_LIT:
      return handleDraftIntro(job as DraftIntroJob, onProgress);

    case ManuscriptJobType.EXPORT_MANUSCRIPT:
      return handleExport(job as ExportJob, onProgress);

    case ManuscriptJobType.SIMULATE_PEER_REVIEW:
      return handlePeerReview(job as PeerReviewJob, onProgress);

    case ManuscriptJobType.PLAGIARISM_CHECK:
      return handlePlagiarismCheck(job as PlagiarismCheckJob, onProgress);

    case ManuscriptJobType.CLAIM_VERIFY:
      return handleClaimVerify(job as ClaimVerifyJob, onProgress);

    default:
      throw new Error(`Unknown job type: ${(job as any).type}`);
  }
}

/**
 * Generate Outline Handler (Task 70)
 */
async function handleGenerateOutline(
  job: GenerateOutlineJob,
  onProgress: ProgressCallback
): Promise<Record<string, unknown>> {
  onProgress(10);

  // Get manuscript
  const manuscript = await manuscriptStore.getManuscript(job.manuscriptId);
  if (!manuscript) {
    throw new Error(`Manuscript not found: ${job.manuscriptId}`);
  }

  onProgress(20);

  // Use ai-router to generate outline
  const router = getModelRouter();
  const response = await router.route({
    taskType: 'draft_section',
    prompt: `Generate a detailed manuscript outline for a ${job.templateType} paper titled "${manuscript.content.title}".

Include the following sections with key points to cover:
1. Abstract (structured: Background, Methods, Results, Conclusion)
2. Introduction (3-4 key paragraphs)
3. Methods (study design, population, variables, analysis)
4. Results (primary outcomes, secondary outcomes, subgroup analyses)
5. Discussion (main findings, comparison to literature, limitations, implications)
6. Conclusion

Format as JSON with sections array, each containing: name, points[], wordLimit.`,
    responseFormat: 'json',
    metadata: {
      manuscriptId: job.manuscriptId,
      templateType: job.templateType,
    },
  });

  onProgress(70);

  // Parse outline
  const outline = response.parsed || JSON.parse(response.content);

  // Update manuscript with outline
  const updatedContent = {
    ...manuscript.content,
    metadata: {
      ...manuscript.content.metadata,
      outline,
      templateType: job.templateType,
    },
  };

  await manuscriptStore.updateManuscript({
    artifactId: job.manuscriptId,
    userId: job.userId,
    content: updatedContent,
    changeDescription: 'Generated manuscript outline',
  });

  onProgress(100);

  return {
    success: true,
    outline,
    versionCreated: true,
  };
}

/**
 * Draft Introduction Handler (Task 51 + 60)
 */
async function handleDraftIntro(
  job: DraftIntroJob,
  onProgress: ProgressCallback
): Promise<Record<string, unknown>> {
  onProgress(10);

  // Get manuscript
  const manuscript = await manuscriptStore.getManuscript(job.manuscriptId);
  if (!manuscript) {
    throw new Error(`Manuscript not found: ${job.manuscriptId}`);
  }

  onProgress(20);

  // Use ai-router to draft section
  const router = getModelRouter();
  const response = await router.route({
    taskType: 'draft_section',
    prompt: `Draft the ${job.section} section for a research manuscript.

Title: ${manuscript.content.title}
Template: ${manuscript.content.metadata?.templateType || 'research_article'}
Word limit: ${job.wordLimit || 1000} words

${job.section === 'introduction' ? `
The introduction should:
1. Establish the clinical/scientific context and importance
2. Review key literature briefly (will add citations later)
3. Identify the knowledge gap
4. State the study objective/hypothesis
` : ''}

Write in academic medical journal style. Be concise and evidence-focused.`,
    responseFormat: 'text',
    metadata: {
      manuscriptId: job.manuscriptId,
      section: job.section,
    },
  });

  onProgress(70);

  // Update manuscript with drafted section
  const updatedContent = {
    ...manuscript.content,
    sections: {
      ...manuscript.content.sections,
      [job.section]: response.content,
    },
  };

  await manuscriptStore.updateManuscript({
    artifactId: job.manuscriptId,
    userId: job.userId,
    content: updatedContent,
    changeDescription: `Drafted ${job.section} section`,
  });

  onProgress(100);

  return {
    success: true,
    section: job.section,
    wordCount: response.content.split(/\s+/).length,
    versionCreated: true,
  };
}

/**
 * Export Handler (Task 58 + 68 + 85)
 */
async function handleExport(
  job: ExportJob,
  onProgress: ProgressCallback
): Promise<Record<string, unknown>> {
  onProgress(10);

  // Get manuscript
  const manuscript = await manuscriptStore.getManuscript(job.manuscriptId);
  if (!manuscript) {
    throw new Error(`Manuscript not found: ${job.manuscriptId}`);
  }

  onProgress(20);

  // CRITICAL: Run PHI scan before export (Task 68)
  // Import dynamically to avoid circular dependencies
  const { finalPhiScanService } = await import('@researchflow/manuscript-engine/services/final-phi-scan.service');

  // Prepare content for PHI scan
  const contentToScan: Record<string, string> = {
    title: manuscript.content.title,
    ...manuscript.content.sections,
  };

  onProgress(40);

  const phiResult = await finalPhiScanService.performFinalScan(
    job.manuscriptId,
    contentToScan,
    job.userId
  );

  // GOVERNANCE: Sanitize PHI results before returning
  const sanitizedPhiResult = sanitizePhiFindings(phiResult);

  onProgress(60);

  // If PHI detected, block export
  if (!phiResult.passed) {
    return {
      success: false,
      blocked: true,
      reason: 'PHI detected in manuscript content',
      // GOVERNANCE: Only return detection locations/types, never values
      phiDetections: sanitizedPhiResult.phiDetections,
      requiresApproval: phiResult.attestationRequired,
    };
  }

  onProgress(80);

  // Generate export (stub - actual export would use manuscript-engine export service)
  let exportContent: string;
  const format = job.format;

  if (format === 'markdown') {
    exportContent = generateMarkdownExport(manuscript.content, job);
  } else if (format === 'latex') {
    exportContent = generateLatexExport(manuscript.content, job);
  } else {
    // For PDF/DOCX, would call external service
    exportContent = `Export format ${format} not yet implemented`;
  }

  // Store export artifact
  const artifactId = await manuscriptStore.storeExportArtifact({
    manuscriptId: job.manuscriptId,
    researchId: job.researchId || manuscript.researchId,
    userId: job.userId,
    format: job.format,
    content: exportContent,
    metadata: {
      blinded: job.blinded,
      includeLineNumbers: job.includeLineNumbers,
      doubleSpaced: job.doubleSpaced,
      phiScanPassed: true,
    },
  });

  onProgress(100);

  return {
    success: true,
    format: job.format,
    artifactId,
    phiScanPassed: true,
  };
}

/**
 * Peer Review Handler (Task 61 + 65)
 */
async function handlePeerReview(
  job: PeerReviewJob,
  onProgress: ProgressCallback
): Promise<Record<string, unknown>> {
  onProgress(10);

  // Get manuscript
  const manuscript = await manuscriptStore.getManuscript(job.manuscriptId);
  if (!manuscript) {
    throw new Error(`Manuscript not found: ${job.manuscriptId}`);
  }

  onProgress(20);

  // Use ai-router to simulate peer review
  const router = getModelRouter();
  const reviews: Array<{
    reviewerType: string;
    overallScore: number;
    categoryScores: Record<string, number>;
    comments: Array<{ section: string; type: string; comment: string }>;
    recommendation: string;
  }> = [];

  for (let i = 0; i < job.reviewerProfiles.length; i++) {
    const profile = job.reviewerProfiles[i];
    onProgress(20 + (i + 1) * (60 / job.reviewerProfiles.length));

    const response = await router.route({
      taskType: 'peer_review',
      prompt: `Act as a ${profile} peer reviewer for a medical journal. Review this manuscript:

Title: ${manuscript.content.title}
Abstract: ${manuscript.content.sections?.abstract || 'Not provided'}
Introduction: ${manuscript.content.sections?.introduction || 'Not provided'}
Methods: ${manuscript.content.sections?.methods || 'Not provided'}
Results: ${manuscript.content.sections?.results || 'Not provided'}
Discussion: ${manuscript.content.sections?.discussion || 'Not provided'}

Provide your review in JSON format with:
- overallScore: 1-10
- categoryScores: { originality, methodology, clarity, significance }
- comments: array of { section, type: 'major'|'minor'|'suggestion', comment }
- recommendation: 'accept' | 'minor_revision' | 'major_revision' | 'reject'`,
      responseFormat: 'json',
      metadata: {
        manuscriptId: job.manuscriptId,
        reviewerProfile: profile,
      },
    });

    const review = response.parsed || JSON.parse(response.content);
    reviews.push({
      reviewerType: profile,
      ...review,
    });
  }

  onProgress(90);

  // Calculate aggregate scores
  const aggregateScore = reviews.reduce((sum, r) => sum + r.overallScore, 0) / reviews.length;

  onProgress(100);

  return {
    success: true,
    reviews,
    aggregateScore,
    recommendedDecision: getRecommendedDecision(reviews),
  };
}

/**
 * Plagiarism Check Handler (Task 81)
 */
async function handlePlagiarismCheck(
  job: PlagiarismCheckJob,
  onProgress: ProgressCallback
): Promise<Record<string, unknown>> {
  onProgress(10);

  // Get manuscript
  const manuscript = await manuscriptStore.getManuscript(job.manuscriptId);
  if (!manuscript) {
    throw new Error(`Manuscript not found: ${job.manuscriptId}`);
  }

  onProgress(20);

  // Import plagiarism service
  const { plagiarismCheckService } = await import('@researchflow/manuscript-engine/services/plagiarism-check.service');

  // Prepare text to check based on scope
  let textToCheck = '';
  if (job.checkScope === 'full') {
    textToCheck = Object.values(manuscript.content.sections || {}).filter(Boolean).join('\n\n');
  } else {
    textToCheck = manuscript.content.sections?.[job.checkScope] || '';
  }

  onProgress(40);

  // Run plagiarism check
  const result = await plagiarismCheckService.checkForPlagiarism({
    manuscriptId: job.manuscriptId,
    textToCheck,
    sectionType: job.checkScope === 'full' ? 'introduction' : job.checkScope,
    checkAgainst: job.checkAgainst,
  });

  onProgress(80);

  // GOVERNANCE: Sanitize results - remove matchedText
  const sanitizedResult = sanitizePlagiarismResults(result);

  onProgress(100);

  return {
    success: true,
    ...sanitizedResult,
  };
}

/**
 * Claim Verify Handler (Task 56 + 90)
 */
async function handleClaimVerify(
  job: ClaimVerifyJob,
  onProgress: ProgressCallback
): Promise<Record<string, unknown>> {
  onProgress(10);

  // Get manuscript
  const manuscript = await manuscriptStore.getManuscript(job.manuscriptId);
  if (!manuscript) {
    throw new Error(`Manuscript not found: ${job.manuscriptId}`);
  }

  onProgress(20);

  // Use ai-router to identify and verify claims
  const router = getModelRouter();
  const sectionsToCheck = job.sections || ['results', 'discussion'];
  const allClaims: Array<{
    claimId: string;
    section: string;
    startIndex: number;
    endIndex: number;
    verified: boolean;
    confidence: number;
    supportingCitations: string[];
    recommendation: string;
  }> = [];

  for (let i = 0; i < sectionsToCheck.length; i++) {
    const section = sectionsToCheck[i];
    const sectionText = manuscript.content.sections?.[section as keyof typeof manuscript.content.sections] || '';

    if (!sectionText) continue;

    onProgress(20 + (i + 1) * (60 / sectionsToCheck.length));

    const response = await router.route({
      taskType: 'claim_verification',
      prompt: `Identify and verify scientific claims in this ${section} section:

${sectionText}

For each claim found, determine:
1. Is it a factual claim that can be verified?
2. Is it supported by the data/methods described?
3. What citations would support or refute it?

Return JSON array of claims with:
- claimId: unique identifier
- startIndex: character position in text
- endIndex: character position in text
- verified: true/false
- confidence: 0-1
- supportingCitations: array of suggested PMIDs/DOIs
- recommendation: string`,
      responseFormat: 'json',
      metadata: {
        manuscriptId: job.manuscriptId,
        section,
      },
    });

    const claims = response.parsed?.claims || JSON.parse(response.content).claims || [];
    allClaims.push(...claims.map((c: any) => ({
      ...c,
      section,
      claimId: c.claimId || uuidv4(),
    })));
  }

  onProgress(90);

  // GOVERNANCE: Sanitize claim results - remove claim text content
  const sanitizedClaims = sanitizeClaimResults({ claims: allClaims });

  onProgress(100);

  return {
    success: true,
    ...(sanitizedClaims as any),
    totalClaims: allClaims.length,
    verifiedClaims: allClaims.filter(c => c.verified).length,
  };
}

// Helper functions

function generateMarkdownExport(content: any, options: ExportJob): string {
  let md = `# ${content.title}\n\n`;

  if (options.blinded) {
    md += `*Authors: [BLINDED FOR REVIEW]*\n\n`;
  } else if (content.metadata?.authors?.length) {
    md += `*Authors: ${content.metadata.authors.map((a: any) => a.name).join(', ')}*\n\n`;
  }

  const sections = ['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion'];
  for (const section of sections) {
    const text = content.sections?.[section];
    if (text) {
      md += `## ${section.charAt(0).toUpperCase() + section.slice(1)}\n\n`;
      md += `${text}\n\n`;
    }
  }

  return md;
}

function generateLatexExport(content: any, options: ExportJob): string {
  let latex = `\\documentclass{article}\n\\begin{document}\n\n`;
  latex += `\\title{${content.title}}\n`;

  if (!options.blinded && content.metadata?.authors?.length) {
    latex += `\\author{${content.metadata.authors.map((a: any) => a.name).join(' \\and ')}}\n`;
  }

  latex += `\\maketitle\n\n`;

  const sections = ['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion'];
  for (const section of sections) {
    const text = content.sections?.[section];
    if (text) {
      if (section === 'abstract') {
        latex += `\\begin{abstract}\n${text}\n\\end{abstract}\n\n`;
      } else {
        latex += `\\section{${section.charAt(0).toUpperCase() + section.slice(1)}}\n${text}\n\n`;
      }
    }
  }

  latex += `\\end{document}`;
  return latex;
}

function getRecommendedDecision(reviews: Array<{ recommendation: string }>): string {
  const decisions = reviews.map(r => r.recommendation);
  if (decisions.includes('reject')) return 'reject';
  if (decisions.every(d => d === 'accept')) return 'accept';
  if (decisions.includes('major_revision')) return 'major_revision';
  return 'minor_revision';
}
