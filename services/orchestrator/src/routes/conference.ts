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

// =============================================================================
// SECTION E: Worker Proxy Endpoints for Stage 20 Conference Preparation
// =============================================================================

const WORKER_API_URL = process.env.WORKER_API_URL || process.env.ROS_API_URL || 'http://localhost:8000';

/**
 * POST /api/ros/conference/discover
 * Discover and rank conferences based on research keywords and preferences.
 * Proxies to worker: POST /api/ros/conference/discover
 */
router.post(
  '/discover',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    const { keywords, yearRange, locationPreference, formatPreferences } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INVALID_REQUEST',
        details: 'keywords array is required and must not be empty'
      });
      return;
    }

    // Audit log the discovery request
    console.log(`[AUDIT] Conference discovery request by ${(req.user as any)?.email || 'unknown'}`, {
      keywords,
      yearRange,
      locationPreference,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch(`${WORKER_API_URL}/api/ros/conference/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          year_range: yearRange,
          location_preference: locationPreference,
          format_preferences: formatPreferences
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        res.status(response.status).json({
          error: 'Worker request failed',
          code: 'WORKER_ERROR',
          details: errorData.detail || response.statusText
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[ERROR] Conference discover proxy failed:', error);
      res.status(503).json({
        error: 'Service unavailable',
        code: 'WORKER_UNAVAILABLE',
        details: 'Unable to reach conference discovery service'
      });
    }
  })
);

/**
 * POST /api/ros/conference/guidelines/extract
 * Extract and parse conference submission guidelines from a URL.
 * Proxies to worker: POST /api/ros/conference/guidelines/extract
 */
router.post(
  '/guidelines/extract',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    const { conferenceId, guidelinesUrl, forceRefresh } = req.body;

    if (!conferenceId) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INVALID_REQUEST',
        details: 'conferenceId is required'
      });
      return;
    }

    // Audit log the guidelines extraction request
    console.log(`[AUDIT] Guidelines extraction request by ${(req.user as any)?.email || 'unknown'}`, {
      conferenceId,
      guidelinesUrl,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch(`${WORKER_API_URL}/api/ros/conference/guidelines/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conference_id: conferenceId,
          guidelines_url: guidelinesUrl,
          force_refresh: forceRefresh
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        res.status(response.status).json({
          error: 'Worker request failed',
          code: 'WORKER_ERROR',
          details: errorData.detail || response.statusText
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[ERROR] Guidelines extract proxy failed:', error);
      res.status(503).json({
        error: 'Service unavailable',
        code: 'WORKER_UNAVAILABLE',
        details: 'Unable to reach guidelines extraction service'
      });
    }
  })
);

/**
 * POST /api/ros/conference/materials/export
 * Generate conference materials and create export bundle.
 * Proxies to worker: POST /api/ros/conference/materials/export
 */
router.post(
  '/materials/export',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    const {
      conferenceId,
      conference_id,  // snake_case alias
      topicId,
      researchId,
      research_id,    // snake_case alias
      materialTypes,
      material_types, // snake_case alias
      guidelines,
      customOptions,
      custom_options, // snake_case alias
      blinded,
      title
    } = req.body;

    // Accept both camelCase and snake_case for flexibility
    const confId = conferenceId || conference_id;
    const resId = researchId || research_id || topicId;  // researchId takes priority, fallback to topicId
    const matTypes = materialTypes || material_types || ['poster_pdf', 'slides_pptx'];
    const custOpts = customOptions || custom_options;

    // Check for demo mode
    const isDemoMode = process.env.ROS_MODE !== 'LIVE' || process.env.NO_NETWORK === 'true';

    // In DEMO mode, allow missing IDs with defaults
    if (!confId) {
      if (!isDemoMode) {
        res.status(400).json({
          error: 'Invalid request',
          code: 'INVALID_REQUEST',
          details: 'conferenceId is required'
        });
        return;
      }
    }

    // Use default researchId in DEMO mode if missing
    const effectiveResearchId = resId || (isDemoMode ? 'demo-research' : null);
    if (!effectiveResearchId) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INVALID_REQUEST',
        details: 'researchId or topicId is required'
      });
      return;
    }

    // Audit log the materials export request
    console.log(`[AUDIT] Materials export request by ${(req.user as any)?.email || 'unknown'}`, {
      conferenceId: confId,
      researchId: effectiveResearchId,
      materialTypes: matTypes,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch(`${WORKER_API_URL}/api/ros/conference/materials/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conference_id: confId || 'demo-conference',
          research_id: effectiveResearchId,
          material_types: matTypes,
          guidelines,
          custom_options: custOpts,
          blinded: blinded || false,
          title: title || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        res.status(response.status).json({
          error: 'Worker request failed',
          code: 'WORKER_ERROR',
          details: errorData.detail || response.statusText
        });
        return;
      }

      const data = await response.json();

      // Post-process response to add download URLs for files
      if (data.runId && Array.isArray(data.files)) {
        data.files = data.files.map((file: any) => ({
          ...file,
          url: file.url || `/api/ros/conference/download/${data.runId}/${file.filename || file.name}`
        }));
      }

      res.json(data);
    } catch (error) {
      console.error('[ERROR] Materials export proxy failed:', error);
      res.status(503).json({
        error: 'Service unavailable',
        code: 'WORKER_UNAVAILABLE',
        details: 'Unable to reach materials export service'
      });
    }
  })
);

/**
 * GET /api/ros/conference/download/:runId/:filename
 * Stream download of generated conference materials.
 * Implements path traversal protection.
 */
router.get(
  '/download/:runId/:filename',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    const { runId, filename } = req.params;

    // Path traversal protection: reject any path containing .. or /
    if (!runId || !filename ||
        runId.includes('..') || runId.includes('/') || runId.includes('\\') ||
        filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INVALID_PATH',
        details: 'Invalid runId or filename - path traversal not allowed'
      });
      return;
    }

    // Validate runId format (should be UUID-like or alphanumeric)
    const validIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validIdPattern.test(runId) || !validIdPattern.test(filename.replace(/\.[^.]+$/, ''))) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INVALID_FORMAT',
        details: 'Invalid runId or filename format'
      });
      return;
    }

    // Audit log the download request
    console.log(`[AUDIT] Conference material download by ${(req.user as any)?.email || 'unknown'}`, {
      runId,
      filename,
      timestamp: new Date().toISOString()
    });

    const artifactPath = `/data/artifacts/conference/${runId}/${filename}`;

    // Dynamic import for fs and path modules
    const fs = await import('fs');
    const path = await import('path');

    // Additional path validation: ensure resolved path stays within artifacts directory
    const basePath = '/data/artifacts/conference';
    const resolvedPath = path.resolve(artifactPath);
    if (!resolvedPath.startsWith(basePath)) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'PATH_VIOLATION',
        details: 'Requested path is outside allowed directory'
      });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({
        error: 'Not found',
        code: 'FILE_NOT_FOUND',
        details: `File not found: ${filename}`
      });
      return;
    }

    // Determine Content-Type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.csv': 'text/csv'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Get file stats for Content-Length
    const stats = fs.statSync(resolvedPath);

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Stream the file
    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('[ERROR] File streaming failed:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal error',
          code: 'STREAM_ERROR',
          details: 'Failed to stream file'
        });
      }
    });
  })
);

/**
 * POST /api/ros/conference/export
 * Backwards compatibility alias for /materials/export.
 * Web UI may still call this endpoint; internally forwards to /materials/export.
 */
router.post(
  '/export',
  requireRole('RESEARCHER'),
  asyncHandler(async (req, res) => {
    // Transform legacy payload format to new format
    const {
      stage_id,
      title,
      presentation_duration,
      include_handouts,
      qr_links,
      poster_dimensions,
      conferenceId,
      topicId,
      researchId,
      materialTypes
    } = req.body;

    // Build a compatible payload for /materials/export
    const exportPayload = {
      conference_id: conferenceId || title || 'legacy-export',
      research_id: researchId || topicId || 'legacy-research',
      material_types: materialTypes || ['poster_pdf', 'slides_pptx'],
      title: title || '',
      blinded: false,
      custom_options: {
        stage_id,
        presentation_duration,
        include_handouts,
        qr_links,
        poster_dimensions
      }
    };

    // Audit log
    console.log(`[AUDIT] Legacy conference export (alias) by ${(req.user as any)?.email || 'unknown'}`, {
      stage_id,
      title,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch(`${WORKER_API_URL}/api/ros/conference/materials/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        res.status(response.status).json({
          error: 'Worker request failed',
          code: 'WORKER_ERROR',
          details: errorData.detail || response.statusText
        });
        return;
      }

      const data = await response.json();

      // Post-process response to add download URLs for files
      if (data.runId && Array.isArray(data.files)) {
        data.files = data.files.map((file: any) => ({
          ...file,
          url: file.url || `/api/ros/conference/download/${data.runId}/${file.filename || file.name}`
        }));
      }

      res.json(data);
    } catch (error) {
      console.error('[ERROR] Legacy export proxy failed:', error);
      res.status(503).json({
        error: 'Service unavailable',
        code: 'WORKER_UNAVAILABLE',
        details: 'Unable to reach materials export service'
      });
    }
  })
);

export default router;
