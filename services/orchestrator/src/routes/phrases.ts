/**
 * Phrase Library Routes
 * Phase 4.2: API endpoints for phrase management
 * 
 * Endpoints:
 * - GET /api/phrases - Search phrases
 * - GET /api/phrases/popular - Get popular phrases
 * - GET /api/phrases/categories - Get category stats
 * - GET /api/phrases/:id - Get phrase by ID
 * - POST /api/phrases - Create phrase
 * - PUT /api/phrases/:id - Update phrase
 * - DELETE /api/phrases/:id - Delete phrase
 * - POST /api/phrases/:id/use - Record phrase usage
 * - POST /api/phrases/bulk - Bulk import phrases
 */

import { Router, Request, Response } from 'express';
import { phraseLibraryService, PHRASE_CATEGORIES } from '../services/PhraseLibraryService';

const router = Router();

/**
 * Search phrases
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      query,
      category,
      tags,
      limit = '20',
      offset = '0',
      sortBy = 'usage_count',
      sortOrder = 'desc'
    } = req.query;
    
    const result = await phraseLibraryService.search({
      query: query as string,
      category: category as string,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Phrases] Search failed:', error);
    res.status(500).json({ error: 'Failed to search phrases' });
  }
});

/**
 * Get popular phrases
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const phrases = await phraseLibraryService.getPopular(limit);
    
    res.json({ phrases });
  } catch (error) {
    console.error('[Phrases] Get popular failed:', error);
    res.status(500).json({ error: 'Failed to get popular phrases' });
  }
});

/**
 * Get category statistics
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const stats = await phraseLibraryService.getCategoryStats();
    
    res.json({
      categories: Object.values(PHRASE_CATEGORIES),
      stats
    });
  } catch (error) {
    console.error('[Phrases] Get categories failed:', error);
    res.status(500).json({ error: 'Failed to get category stats' });
  }
});

/**
 * Get phrases by category
 */
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const phrases = await phraseLibraryService.getByCategory(category, limit);
    
    res.json({
      category,
      phrases,
      count: phrases.length
    });
  } catch (error) {
    console.error('[Phrases] Get by category failed:', error);
    res.status(500).json({ error: 'Failed to get phrases by category' });
  }
});

/**
 * Get phrase by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const phrase = await phraseLibraryService.getById(id);
    
    if (!phrase) {
      return res.status(404).json({ error: 'Phrase not found' });
    }
    
    res.json(phrase);
  } catch (error) {
    console.error('[Phrases] Get by ID failed:', error);
    res.status(500).json({ error: 'Failed to get phrase' });
  }
});

/**
 * Create a new phrase
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { phrase, category, tags, rationale } = req.body;
    const userId = (req as any).user?.id;
    
    if (!phrase || !category) {
      return res.status(400).json({ error: 'phrase and category are required' });
    }
    
    // Validate category
    if (!Object.values(PHRASE_CATEGORIES).includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category',
        validCategories: Object.values(PHRASE_CATEGORIES)
      });
    }
    
    const created = await phraseLibraryService.create(
      { phrase, category, tags, rationale },
      userId
    );
    
    res.status(201).json(created);
  } catch (error) {
    console.error('[Phrases] Create failed:', error);
    res.status(500).json({ error: 'Failed to create phrase' });
  }
});

/**
 * Update a phrase
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { phrase, category, tags, rationale } = req.body;
    const userId = (req as any).user?.id;
    
    // Validate category if provided
    if (category && !Object.values(PHRASE_CATEGORIES).includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category',
        validCategories: Object.values(PHRASE_CATEGORIES)
      });
    }
    
    const updated = await phraseLibraryService.update(
      id,
      { phrase, category, tags, rationale },
      userId
    );
    
    if (!updated) {
      return res.status(404).json({ error: 'Phrase not found' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('[Phrases] Update failed:', error);
    res.status(500).json({ error: 'Failed to update phrase' });
  }
});

/**
 * Delete a phrase
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const deleted = await phraseLibraryService.delete(id, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Phrase not found' });
    }
    
    res.json({ success: true, message: 'Phrase deleted' });
  } catch (error) {
    console.error('[Phrases] Delete failed:', error);
    res.status(500).json({ error: 'Failed to delete phrase' });
  }
});

/**
 * Record phrase usage
 */
router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    // Verify phrase exists
    const phrase = await phraseLibraryService.getById(id);
    if (!phrase) {
      return res.status(404).json({ error: 'Phrase not found' });
    }
    
    await phraseLibraryService.recordUsage(id, userId);
    
    res.json({ 
      success: true, 
      message: 'Usage recorded',
      newUsageCount: phrase.usageCount + 1
    });
  } catch (error) {
    console.error('[Phrases] Record usage failed:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
});

/**
 * Bulk import phrases
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { phrases } = req.body;
    const userId = (req as any).user?.id;
    
    if (!Array.isArray(phrases) || phrases.length === 0) {
      return res.status(400).json({ error: 'phrases array is required' });
    }
    
    // Validate all phrases have required fields
    for (const [index, p] of phrases.entries()) {
      if (!p.phrase || !p.category) {
        return res.status(400).json({ 
          error: `Phrase at index ${index} missing required fields (phrase, category)` 
        });
      }
    }
    
    const result = await phraseLibraryService.bulkImport(phrases, userId);
    
    res.json({
      success: true,
      imported: result.imported,
      total: phrases.length,
      errors: result.errors.length > 0 ? result.errors : undefined
    });
  } catch (error) {
    console.error('[Phrases] Bulk import failed:', error);
    res.status(500).json({ error: 'Failed to bulk import phrases' });
  }
});

export default router;
