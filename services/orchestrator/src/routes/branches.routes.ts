/**
 * Branch Management Routes
 * Phase 3.3: API endpoints for manuscript version control
 * 
 * Endpoints:
 * - POST /api/branches - Create branch
 * - GET /api/branches/:manuscriptId - List branches
 * - GET /api/branches/:manuscriptId/:branchName - Get branch
 * - POST /api/branches/:branchId/revisions - Create revision
 * - GET /api/branches/:branchId/revisions - List revisions
 * - POST /api/branches/:branchId/merge - Merge branch
 * - PUT /api/branches/:branchId/archive - Archive branch
 * - GET /api/branches/:branchId/compare - Compare revisions
 */

import { Router, Request, Response } from 'express';
import { branchPersistenceService } from './branch-persistence.service';

const router = Router();

/**
 * Create a new branch
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { manuscriptId, branchName, parentBranch, description } = req.body;
    const userId = (req as any).user?.id;
    
    if (!manuscriptId || !branchName) {
      return res.status(400).json({ error: 'manuscriptId and branchName are required' });
    }
    
    const branch = await branchPersistenceService.createBranch({
      manuscriptId,
      branchName,
      parentBranch,
      description,
      createdBy: userId
    });
    
    res.status(201).json(branch);
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('[Branches] Create failed:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

/**
 * List branches for a manuscript
 */
router.get('/:manuscriptId', async (req: Request, res: Response) => {
  try {
    const { manuscriptId } = req.params;
    const includeArchived = req.query.includeArchived === 'true';
    
    const branches = await branchPersistenceService.listBranches(manuscriptId, includeArchived);
    
    res.json({
      manuscriptId,
      branches,
      count: branches.length
    });
  } catch (error) {
    console.error('[Branches] List failed:', error);
    res.status(500).json({ error: 'Failed to list branches' });
  }
});

/**
 * Get branch by name
 */
router.get('/:manuscriptId/:branchName', async (req: Request, res: Response) => {
  try {
    const { manuscriptId, branchName } = req.params;
    
    const branch = await branchPersistenceService.getBranchByName(manuscriptId, branchName);
    
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    // Get latest revision
    const latestRevision = await branchPersistenceService.getLatestRevision(branch.id);
    
    res.json({
      ...branch,
      latestRevision: latestRevision ? {
        revisionNumber: latestRevision.revisionNumber,
        wordCount: latestRevision.wordCount,
        commitMessage: latestRevision.commitMessage,
        createdAt: latestRevision.createdAt
      } : null
    });
  } catch (error) {
    console.error('[Branches] Get failed:', error);
    res.status(500).json({ error: 'Failed to get branch' });
  }
});

/**
 * Create a new revision
 */
router.post('/:branchId/revisions', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const { content, commitMessage } = req.body;
    const userId = (req as any).user?.id;
    
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'content object is required' });
    }
    
    const revision = await branchPersistenceService.createRevision({
      branchId,
      content,
      commitMessage,
      createdBy: userId
    });
    
    res.status(201).json(revision);
  } catch (error) {
    console.error('[Branches] Create revision failed:', error);
    res.status(500).json({ error: 'Failed to create revision' });
  }
});

/**
 * List revisions for a branch
 */
router.get('/:branchId/revisions', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const revisions = await branchPersistenceService.listRevisions(branchId, limit);
    
    res.json({
      branchId,
      revisions,
      count: revisions.length
    });
  } catch (error) {
    console.error('[Branches] List revisions failed:', error);
    res.status(500).json({ error: 'Failed to list revisions' });
  }
});

/**
 * Get specific revision
 */
router.get('/:branchId/revisions/:revisionNumber', async (req: Request, res: Response) => {
  try {
    const { branchId, revisionNumber } = req.params;
    
    const revision = await branchPersistenceService.getRevision(
      branchId, 
      parseInt(revisionNumber)
    );
    
    if (!revision) {
      return res.status(404).json({ error: 'Revision not found' });
    }
    
    res.json(revision);
  } catch (error) {
    console.error('[Branches] Get revision failed:', error);
    res.status(500).json({ error: 'Failed to get revision' });
  }
});

/**
 * Merge branch
 */
router.post('/:branchId/merge', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const { targetBranchId, mergeType } = req.body;
    const userId = (req as any).user?.id;
    
    if (!targetBranchId) {
      return res.status(400).json({ error: 'targetBranchId is required' });
    }
    
    const result = await branchPersistenceService.mergeBranch({
      sourceBranchId: branchId,
      targetBranchId,
      mergeType,
      mergedBy: userId
    });
    
    if (!result.success) {
      return res.status(409).json({
        error: 'Merge conflicts detected',
        conflicts: result.conflicts
      });
    }
    
    res.json({
      success: true,
      message: `Branch merged successfully using ${mergeType || 'fast_forward'}`
    });
  } catch (error: any) {
    console.error('[Branches] Merge failed:', error);
    res.status(500).json({ error: error.message || 'Failed to merge branch' });
  }
});

/**
 * Archive branch
 */
router.put('/:branchId/archive', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const userId = (req as any).user?.id;
    
    await branchPersistenceService.archiveBranch(branchId, userId);
    
    res.json({ success: true, message: 'Branch archived' });
  } catch (error) {
    console.error('[Branches] Archive failed:', error);
    res.status(500).json({ error: 'Failed to archive branch' });
  }
});

/**
 * Compare revisions
 */
router.get('/:branchId/compare', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const from = parseInt(req.query.from as string);
    const to = parseInt(req.query.to as string);
    
    if (isNaN(from) || isNaN(to)) {
      return res.status(400).json({ error: 'from and to revision numbers are required' });
    }
    
    const comparison = await branchPersistenceService.compareRevisions(branchId, from, to);
    
    res.json({
      branchId,
      fromRevision: from,
      toRevision: to,
      ...comparison
    });
  } catch (error: any) {
    console.error('[Branches] Compare failed:', error);
    res.status(500).json({ error: error.message || 'Failed to compare revisions' });
  }
});

export default router;
