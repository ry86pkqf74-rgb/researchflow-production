/**
 * Conference Readiness API Routes
 *
 * Endpoints for conference preparation tools including slide generation,
 * compliance checklist management, and submission validation.
 *
 * Priority: P1 - HIGH (Phase 3 Conference Features)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireRole } from '../middleware/rbac';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const router = Router();

interface Slide {
  id: string;
  slideNumber: number;
  title: string;
  content: string;
  speakerNotes: string;
  type: 'title' | 'content' | 'conclusion' | 'references';
}

interface ChecklistItem {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  checked: boolean;
  checkedAt?: string;
  checkedBy?: string;
}

interface ValidationResult {
  field: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  suggestion?: string;
  currentValue?: number | string;
  limit?: number | string;
}

interface ManuscriptSection {
  name: string;
  content: string;
}

const mockChecklists: Record<string, { items: ChecklistItem[]; conferenceName: string }> = {};

const defaultChecklistItems: Omit<ChecklistItem, 'checked' | 'checkedAt' | 'checkedBy'>[] = [
  { id: 'abstract-approved', name: 'Abstract approved/accepted', description: 'Confirmation of abstract acceptance from conference', required: true },
  { id: 'registration', name: 'Conference registration complete', description: 'Paid registration and received confirmation', required: true },
  { id: 'author-disclosure', name: 'Author disclosures submitted', description: 'COI and funding disclosures', required: true },
  { id: 'title-final', name: 'Title finalized', description: 'Final title matching abstract submission', required: true },
  { id: 'authors-confirmed', name: 'Author list confirmed', description: 'All authors and affiliations verified', required: true },
  { id: 'key-findings', name: 'Key findings summarized', description: '3-5 main takeaway points identified', required: true },
  { id: 'figures-tables', name: 'Figures and tables prepared', description: 'High-resolution graphics ready', required: true },
  { id: 'references-formatted', name: 'References formatted', description: 'Citations in conference style', required: false },
  { id: 'poster-template', name: 'Poster template applied', description: 'Using conference-provided or approved template', required: true },
  { id: 'dimension-check', name: 'Dimensions verified', description: 'Poster/slides meet size requirements', required: true },
  { id: 'font-readability', name: 'Font readability checked', description: 'Text readable from expected viewing distance', required: true },
  { id: 'color-accessibility', name: 'Color accessibility verified', description: 'Color-blind friendly palette', required: false },
  { id: 'travel-booked', name: 'Travel arrangements', description: 'Flights/hotel booked', required: false },
  { id: 'printing-arranged', name: 'Poster printing arranged', description: 'Print vendor selected, timeline confirmed', required: false },
  { id: 'backup-files', name: 'Backup files prepared', description: 'USB drive, cloud backup, PDF versions', required: true },
];

function generateSlideId(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * POST /api/ros/slides/generate
 * Generate presentation slides from manuscript content
 */
router.post(
  '/slides/generate',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    const { manuscript, conferenceRequirements } = req.body;

    if (!manuscript?.title || !manuscript?.abstract) {
      res.status(400).json({
        error: 'Invalid manuscript data',
        code: 'INVALID_MANUSCRIPT',
        details: 'Manuscript must include title and abstract'
      });
      return;
    }

    if (!conferenceRequirements?.maxSlides || !conferenceRequirements?.speakingTimeMinutes) {
      res.status(400).json({
        error: 'Invalid conference requirements',
        code: 'INVALID_REQUIREMENTS',
        details: 'Conference requirements must include maxSlides and speakingTimeMinutes'
      });
      return;
    }

    const { maxSlides, minSlides = 5, speakingTimeMinutes, requiredSections = [] } = conferenceRequirements;
    const sections: ManuscriptSection[] = manuscript.sections || [];

    const slides: Slide[] = [];

    slides.push({
      id: generateSlideId(),
      slideNumber: 1,
      title: manuscript.title,
      content: `Presented at ${conferenceRequirements.conferenceName || 'Conference'}\n\n${manuscript.authors?.join(', ') || 'Research Team'}`,
      speakerNotes: 'Introduction: Thank the audience, introduce yourself and your team. Briefly mention the significance of the research.',
      type: 'title'
    });

    slides.push({
      id: generateSlideId(),
      slideNumber: 2,
      title: 'Background & Motivation',
      content: manuscript.abstract.split('.').slice(0, 2).join('.') + '.',
      speakerNotes: 'Explain the problem space and why this research matters. Connect to audience interests.',
      type: 'content'
    });

    if (requiredSections.includes('Methods') || sections.some(s => s.name?.toLowerCase().includes('method'))) {
      slides.push({
        id: generateSlideId(),
        slideNumber: slides.length + 1,
        title: 'Methods',
        content: sections.find(s => s.name?.toLowerCase().includes('method'))?.content?.substring(0, 300) || 
          'Study design and methodology overview',
        speakerNotes: 'Describe the key methodological choices. Keep technical details accessible.',
        type: 'content'
      });
    }

    slides.push({
      id: generateSlideId(),
      slideNumber: slides.length + 1,
      title: 'Results',
      content: sections.find(s => s.name?.toLowerCase().includes('result'))?.content?.substring(0, 300) || 
        'Key findings from the study',
      speakerNotes: 'Present the main findings clearly. Use visuals to support key points.',
      type: 'content'
    });

    slides.push({
      id: generateSlideId(),
      slideNumber: slides.length + 1,
      title: 'Discussion',
      content: sections.find(s => s.name?.toLowerCase().includes('discussion'))?.content?.substring(0, 300) || 
        'Interpretation and implications of findings',
      speakerNotes: 'Explain what the results mean. Address potential limitations proactively.',
      type: 'content'
    });

    slides.push({
      id: generateSlideId(),
      slideNumber: slides.length + 1,
      title: 'Conclusions',
      content: '• Key takeaway 1\n• Key takeaway 2\n• Key takeaway 3\n• Future directions',
      speakerNotes: 'Summarize the main contributions. End with a clear call to action or next steps.',
      type: 'conclusion'
    });

    slides.push({
      id: generateSlideId(),
      slideNumber: slides.length + 1,
      title: 'Acknowledgments & References',
      content: 'Funding: [Grant information]\n\nKey References:\n1. Reference 1\n2. Reference 2',
      speakerNotes: 'Thank collaborators and funding sources. Have backup slides for detailed questions.',
      type: 'references'
    });

    const minutesPerSlide = speakingTimeMinutes / slides.length;
    const estimatedDuration = slides.length * minutesPerSlide;

    const warnings: string[] = [];
    if (slides.length > maxSlides) {
      warnings.push(`Slide count (${slides.length}) exceeds maximum allowed (${maxSlides})`);
    }
    if (slides.length < minSlides) {
      warnings.push(`Slide count (${slides.length}) is below minimum recommended (${minSlides})`);
    }

    res.json({
      slides,
      estimatedDuration,
      minutesPerSlide: Math.round(minutesPerSlide * 10) / 10,
      warnings,
      generatedAt: new Date().toISOString(),
      generatedBy: (req.user as any)?.email || 'system'
    });
  })
);

/**
 * GET /api/ros/checklist/:projectId
 * Get checklist items for a project
 */
router.get(
  '/checklist/:projectId',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    if (!mockChecklists[projectId]) {
      mockChecklists[projectId] = {
        items: defaultChecklistItems.map(item => ({
          ...item,
          checked: false
        })),
        conferenceName: 'Default Conference'
      };
    }

    res.json({
      projectId,
      items: mockChecklists[projectId].items,
      conferenceName: mockChecklists[projectId].conferenceName
    });
  })
);

/**
 * POST /api/ros/checklist/:projectId/check
 * Check or uncheck a checklist item
 */
router.post(
  '/checklist/:projectId/check',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { itemId, checked } = req.body;

    if (!itemId || typeof checked !== 'boolean') {
      res.status(400).json({
        error: 'Invalid request body',
        code: 'INVALID_REQUEST',
        details: 'Request must include itemId and checked (boolean)'
      });
      return;
    }

    if (!mockChecklists[projectId]) {
      mockChecklists[projectId] = {
        items: defaultChecklistItems.map(item => ({
          ...item,
          checked: false
        })),
        conferenceName: 'Default Conference'
      };
    }

    const item = mockChecklists[projectId].items.find(i => i.id === itemId);
    
    if (!item) {
      res.status(404).json({
        error: 'Checklist item not found',
        code: 'ITEM_NOT_FOUND',
        itemId
      });
      return;
    }

    item.checked = checked;
    item.checkedAt = checked ? new Date().toISOString() : undefined;
    item.checkedBy = checked ? (req.user as any)?.email : undefined;

    const completedRequired = mockChecklists[projectId].items.filter(i => i.required && i.checked).length;
    const totalRequired = mockChecklists[projectId].items.filter(i => i.required).length;

    res.json({
      success: true,
      item,
      progress: {
        completedRequired,
        totalRequired,
        readyToSubmit: completedRequired === totalRequired
      }
    });
  })
);

/**
 * POST /api/ros/submission/validate
 * Validate submission against conference requirements
 */
router.post(
  '/submission/validate',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    const { submissionData, conferenceRequirements } = req.body;

    if (!submissionData) {
      res.status(400).json({
        error: 'Invalid submission data',
        code: 'INVALID_SUBMISSION',
        details: 'submissionData is required'
      });
      return;
    }

    if (!conferenceRequirements) {
      res.status(400).json({
        error: 'Invalid conference requirements',
        code: 'INVALID_REQUIREMENTS',
        details: 'conferenceRequirements is required'
      });
      return;
    }

    const results: ValidationResult[] = [];
    type OverallStatus = 'pass' | 'warning' | 'fail';
    let overallStatus: OverallStatus = 'pass';

    const { abstractText = '', figures = 0, tables = 0, authors = [] } = submissionData;
    const { 
      abstractWordLimit = 250, 
      abstractWordWarningThreshold = 0.9,
      maxFigures = 6, 
      maxTables = 4, 
      authorFormatPattern = '^[A-Z][a-z]+,\\s[A-Z][a-z]+(\\s[A-Z]\\.)?$',
      authorFormatDescription = 'Last, First M.'
    } = conferenceRequirements;

    const wordCount = abstractText.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
    const warningThreshold = Math.floor(abstractWordLimit * abstractWordWarningThreshold);
    
    if (wordCount > abstractWordLimit) {
      results.push({
        field: 'abstract',
        status: 'fail',
        message: `Abstract exceeds word limit (${wordCount}/${abstractWordLimit})`,
        suggestion: `Remove ${wordCount - abstractWordLimit} words to meet the limit`,
        currentValue: wordCount,
        limit: abstractWordLimit
      });
      overallStatus = 'fail';
    } else if (wordCount > warningThreshold) {
      results.push({
        field: 'abstract',
        status: 'warning',
        message: `Abstract approaching word limit (${wordCount}/${abstractWordLimit})`,
        currentValue: wordCount,
        limit: abstractWordLimit
      });
      if ((overallStatus as string) !== 'fail') overallStatus = 'warning';
    } else {
      results.push({
        field: 'abstract',
        status: 'pass',
        message: `Abstract word count within limit (${wordCount}/${abstractWordLimit})`,
        currentValue: wordCount,
        limit: abstractWordLimit
      });
    }

    if (figures > maxFigures) {
      results.push({
        field: 'figures',
        status: 'fail',
        message: `Figure count exceeds limit (${figures}/${maxFigures})`,
        suggestion: `Remove ${figures - maxFigures} figure(s) or combine figures`,
        currentValue: figures,
        limit: maxFigures
      });
      overallStatus = 'fail';
    } else {
      results.push({
        field: 'figures',
        status: 'pass',
        message: `Figure count within limit (${figures}/${maxFigures})`,
        currentValue: figures,
        limit: maxFigures
      });
    }

    if (tables > maxTables) {
      results.push({
        field: 'tables',
        status: 'fail',
        message: `Table count exceeds limit (${tables}/${maxTables})`,
        suggestion: `Remove ${tables - maxTables} table(s) or combine tables`,
        currentValue: tables,
        limit: maxTables
      });
      overallStatus = 'fail';
    } else {
      results.push({
        field: 'tables',
        status: 'pass',
        message: `Table count within limit (${tables}/${maxTables})`,
        currentValue: tables,
        limit: maxTables
      });
    }

    const pattern = typeof authorFormatPattern === 'string' 
      ? new RegExp(authorFormatPattern) 
      : authorFormatPattern;
    
    const invalidAuthors = authors.filter((author: { name: string }) => !pattern.test(author.name || ''));
    
    if (invalidAuthors.length > 0) {
      results.push({
        field: 'authors',
        status: 'fail',
        message: `${invalidAuthors.length} author(s) have incorrect name format`,
        suggestion: `Use format: ${authorFormatDescription}`,
        currentValue: invalidAuthors.map((a: { name: string }) => a.name).join(', ')
      });
      overallStatus = 'fail';
    } else if (authors.length > 0) {
      results.push({
        field: 'authors',
        status: 'pass',
        message: `All ${authors.length} author names are properly formatted`,
        currentValue: authors.length
      });
    }

    res.json({
      success: overallStatus !== 'fail',
      results,
      overallStatus,
      timestamp: new Date().toISOString(),
      validatedBy: (req.user as any)?.email || 'system'
    });
  })
);

/**
 * GET /api/ros/conference/requirements
 * Get predefined conference requirements templates
 */
router.get(
  '/requirements',
  asyncHandler(async (_req, res) => {
    const conferences = [
      {
        id: 'aha-2025',
        conferenceName: 'American Heart Association Scientific Sessions 2025',
        conferenceAcronym: 'AHA 2025',
        abstractWordLimit: 250,
        posterDimensions: { width: 48, height: 36, unit: 'inches' },
        slideCount: { min: 8, max: 12 },
        presentationType: 'oral',
        requiredSections: ['Background', 'Methods', 'Results', 'Conclusions'],
        speakingTimeMinutes: 12
      },
      {
        id: 'asco-2025',
        conferenceName: 'American Society of Clinical Oncology Annual Meeting 2025',
        conferenceAcronym: 'ASCO 2025',
        abstractWordLimit: 300,
        posterDimensions: { width: 44, height: 44, unit: 'inches' },
        slideCount: { min: 10, max: 15 },
        presentationType: 'poster',
        requiredSections: ['Background', 'Methods', 'Results', 'Conclusions', 'Funding'],
        speakingTimeMinutes: 10
      },
      {
        id: 'aacr-2025',
        conferenceName: 'American Association for Cancer Research Annual Meeting 2025',
        conferenceAcronym: 'AACR 2025',
        abstractWordLimit: 350,
        posterDimensions: { width: 48, height: 48, unit: 'inches' },
        slideCount: { min: 8, max: 10 },
        presentationType: 'poster',
        requiredSections: ['Introduction', 'Methods', 'Results', 'Discussion'],
        speakingTimeMinutes: 8
      }
    ];

    res.json({
      conferences,
      mode: process.env.GOVERNANCE_MODE || 'DEMO'
    });
  })
);

export default router;
