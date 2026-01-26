/**
 * Manuscript Generation Routes
 * Phase 3.1: Pipeline integration for IMRaD structure
 * 
 * Wires together:
 * - ResultsScaffoldService
 * - DiscussionBuilderService
 * - TitleGeneratorService
 * - KeywordGeneratorService
 * 
 * Endpoints:
 * - POST /api/manuscript/generate/results
 * - POST /api/manuscript/generate/discussion
 * - POST /api/manuscript/generate/title-keywords
 * - POST /api/manuscript/generate/full
 * - POST /api/manuscript/validate/section
 */

import { Router, Request, Response } from 'express';
import { logAction } from '../services/audit-service';
import { validateWordBudget, DEFAULT_BUDGETS } from '@researchflow/manuscript-engine';

const router = Router();

// Worker service URL
const WORKER_URL = process.env.WORKER_URL || 'http://worker:8000';

/**
 * Generate Results section scaffold
 */
router.post('/generate/results', async (req: Request, res: Response) => {
  try {
    const { manuscriptId, datasetId, analysisResults, options } = req.body;
    const userId = (req as any).user?.id;
    
    if (!manuscriptId || !analysisResults) {
      return res.status(400).json({ 
        error: 'manuscriptId and analysisResults are required' 
      });
    }
    
    // Call worker service
    const response = await fetch(`${WORKER_URL}/api/manuscript/scaffold/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id: datasetId,
        analysis_results: analysisResults,
        options: {
          include_tables: options?.includeTables ?? true,
          include_figures: options?.includeFigures ?? true,
          statistical_detail: options?.statisticalDetail ?? 'standard',
          ...options
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Worker error: ${error}`);
    }
    
    const result = await response.json();
    
    // Validate word budget
    const validation = validateWordBudget(result.content, 'results');
    
    // Log action
    await logAction({
      eventType: 'RESULTS_GENERATED',
      action: 'GENERATE',
      resourceType: 'MANUSCRIPT_SECTION',
      resourceId: manuscriptId,
      userId,
      details: { 
        wordCount: validation.wordCount,
        withinBudget: validation.valid,
        tablesCount: result.tables?.length || 0,
        figuresCount: result.figures?.length || 0
      }
    });
    
    res.json({
      section: 'results',
      content: result.content,
      tables: result.tables || [],
      figures: result.figures || [],
      statistics: result.statistics || {},
      validation,
      metadata: {
        generatedAt: new Date().toISOString(),
        datasetId,
        version: result.version || 1
      }
    });
  } catch (error) {
    console.error('[ManuscriptGen] Results generation failed:', error);
    res.status(500).json({ error: 'Failed to generate results section' });
  }
});

/**
 * Generate Discussion section
 */
router.post('/generate/discussion', async (req: Request, res: Response) => {
  try {
    const { manuscriptId, resultsSection, literatureContext, options } = req.body;
    const userId = (req as any).user?.id;
    
    if (!manuscriptId || !resultsSection) {
      return res.status(400).json({ 
        error: 'manuscriptId and resultsSection are required' 
      });
    }
    
    // Call worker service
    const response = await fetch(`${WORKER_URL}/api/manuscript/build/discussion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results_section: resultsSection,
        literature_context: literatureContext || [],
        options: {
          include_limitations: options?.includeLimitations ?? true,
          include_future_directions: options?.includeFutureDirections ?? true,
          comparison_depth: options?.comparisonDepth ?? 'moderate',
          ...options
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Worker error: ${error}`);
    }
    
    const result = await response.json();
    
    // Validate word budget
    const validation = validateWordBudget(result.content, 'discussion');
    
    // Log action
    await logAction({
      eventType: 'DISCUSSION_GENERATED',
      action: 'GENERATE',
      resourceType: 'MANUSCRIPT_SECTION',
      resourceId: manuscriptId,
      userId,
      details: { 
        wordCount: validation.wordCount,
        withinBudget: validation.valid,
        citationsUsed: result.citationsUsed?.length || 0
      }
    });
    
    res.json({
      section: 'discussion',
      content: result.content,
      subsections: result.subsections || {},
      citationsUsed: result.citationsUsed || [],
      validation,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: result.version || 1
      }
    });
  } catch (error) {
    console.error('[ManuscriptGen] Discussion generation failed:', error);
    res.status(500).json({ error: 'Failed to generate discussion section' });
  }
});

/**
 * Generate Title and Keywords
 */
router.post('/generate/title-keywords', async (req: Request, res: Response) => {
  try {
    const { manuscriptId, abstract, sections, options } = req.body;
    const userId = (req as any).user?.id;
    
    if (!manuscriptId || !abstract) {
      return res.status(400).json({ 
        error: 'manuscriptId and abstract are required' 
      });
    }
    
    // Generate titles
    const titleResponse = await fetch(`${WORKER_URL}/api/manuscript/generate/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        abstract,
        sections: sections || {},
        options: {
          count: options?.titleCount ?? 5,
          style: options?.titleStyle ?? 'descriptive',
          max_length: options?.maxTitleLength ?? 150
        }
      })
    });
    
    // Generate keywords
    const keywordResponse = await fetch(`${WORKER_URL}/api/manuscript/generate/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        abstract,
        sections: sections || {},
        options: {
          count: options?.keywordCount ?? 6,
          include_mesh: options?.includeMeSH ?? true
        }
      })
    });
    
    if (!titleResponse.ok || !keywordResponse.ok) {
      throw new Error('Worker generation failed');
    }
    
    const titles = await titleResponse.json();
    const keywords = await keywordResponse.json();
    
    // Log action
    await logAction({
      eventType: 'TITLE_KEYWORDS_GENERATED',
      action: 'GENERATE',
      resourceType: 'MANUSCRIPT',
      resourceId: manuscriptId,
      userId,
      details: { 
        titlesGenerated: titles.suggestions?.length || 0,
        keywordsGenerated: keywords.keywords?.length || 0
      }
    });
    
    res.json({
      titles: titles.suggestions || [],
      keywords: keywords.keywords || [],
      meshTerms: keywords.meshTerms || [],
      metadata: {
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[ManuscriptGen] Title/Keywords generation failed:', error);
    res.status(500).json({ error: 'Failed to generate title and keywords' });
  }
});

/**
 * Generate full manuscript structure
 */
router.post('/generate/full', async (req: Request, res: Response) => {
  try {
    const { 
      manuscriptId, 
      datasetId, 
      analysisResults, 
      literatureContext,
      existingAbstract,
      options 
    } = req.body;
    const userId = (req as any).user?.id;
    
    if (!manuscriptId || !analysisResults) {
      return res.status(400).json({ 
        error: 'manuscriptId and analysisResults are required' 
      });
    }
    
    const results: Record<string, any> = {};
    const errors: string[] = [];
    
    // 1. Generate Results
    try {
      const resultsResponse = await fetch(`${WORKER_URL}/api/manuscript/scaffold/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: datasetId,
          analysis_results: analysisResults,
          options: options?.results || {}
        })
      });
      results.results = await resultsResponse.json();
    } catch (e) {
      errors.push('Results generation failed');
    }
    
    // 2. Generate Discussion (using results)
    if (results.results) {
      try {
        const discussionResponse = await fetch(`${WORKER_URL}/api/manuscript/build/discussion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results_section: results.results.content,
            literature_context: literatureContext || [],
            options: options?.discussion || {}
          })
        });
        results.discussion = await discussionResponse.json();
      } catch (e) {
        errors.push('Discussion generation failed');
      }
    }
    
    // 3. Generate Title and Keywords
    const abstractText = existingAbstract || 
      `${results.results?.content?.substring(0, 500) || ''} ${results.discussion?.content?.substring(0, 500) || ''}`;
    
    try {
      const [titleRes, keywordRes] = await Promise.all([
        fetch(`${WORKER_URL}/api/manuscript/generate/title`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abstract: abstractText, options: options?.title || {} })
        }),
        fetch(`${WORKER_URL}/api/manuscript/generate/keywords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abstract: abstractText, options: options?.keywords || {} })
        })
      ]);
      
      results.titles = await titleRes.json();
      results.keywords = await keywordRes.json();
    } catch (e) {
      errors.push('Title/Keywords generation failed');
    }
    
    // Validate all sections
    const validations: Record<string, any> = {};
    if (results.results?.content) {
      validations.results = validateWordBudget(results.results.content, 'results');
    }
    if (results.discussion?.content) {
      validations.discussion = validateWordBudget(results.discussion.content, 'discussion');
    }
    
    // Log action
    await logAction({
      eventType: 'FULL_MANUSCRIPT_GENERATED',
      action: 'GENERATE',
      resourceType: 'MANUSCRIPT',
      resourceId: manuscriptId,
      userId,
      details: { 
        sectionsGenerated: Object.keys(results).length,
        errors: errors.length,
        validations
      }
    });
    
    res.json({
      manuscriptId,
      sections: results,
      validations,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        generatedAt: new Date().toISOString(),
        datasetId,
        complete: errors.length === 0
      }
    });
  } catch (error) {
    console.error('[ManuscriptGen] Full generation failed:', error);
    res.status(500).json({ error: 'Failed to generate manuscript' });
  }
});

/**
 * Validate a section against word budget
 */
router.post('/validate/section', async (req: Request, res: Response) => {
  try {
    const { content, section, customBudget } = req.body;
    
    if (!content || !section) {
      return res.status(400).json({ 
        error: 'content and section are required' 
      });
    }
    
    const budgets = customBudget ? [customBudget] : DEFAULT_BUDGETS;
    const validation = validateWordBudget(content, section, budgets);
    
    res.json({
      section,
      ...validation,
      budget: budgets.find(b => b.section === section) || null
    });
  } catch (error) {
    console.error('[ManuscriptGen] Validation failed:', error);
    res.status(500).json({ error: 'Failed to validate section' });
  }
});

/**
 * Get word budgets configuration
 */
router.get('/budgets', async (_req: Request, res: Response) => {
  res.json({
    budgets: DEFAULT_BUDGETS,
    description: 'Default word budgets for manuscript sections'
  });
});

/**
 * Update word budgets for a manuscript
 */
router.put('/budgets/:manuscriptId', async (req: Request, res: Response) => {
  try {
    const { manuscriptId } = req.params;
    const { budgets } = req.body;
    const userId = (req as any).user?.id;
    
    // Validate budget format
    for (const budget of budgets) {
      if (!budget.section || typeof budget.min !== 'number' || typeof budget.max !== 'number') {
        return res.status(400).json({ 
          error: 'Each budget must have section, min, and max' 
        });
      }
      if (budget.min >= budget.max) {
        return res.status(400).json({ 
          error: `Invalid budget for ${budget.section}: min must be less than max` 
        });
      }
    }
    
    // Store custom budgets (would use DB in production)
    // For now, return the validated budgets
    
    await logAction({
      eventType: 'BUDGETS_UPDATED',
      action: 'UPDATE',
      resourceType: 'MANUSCRIPT',
      resourceId: manuscriptId,
      userId,
      details: { budgets }
    });
    
    res.json({
      manuscriptId,
      budgets,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ManuscriptGen] Budget update failed:', error);
    res.status(500).json({ error: 'Failed to update budgets' });
  }
});

export default router;
