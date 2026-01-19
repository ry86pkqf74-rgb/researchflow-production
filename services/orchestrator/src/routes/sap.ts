/**
 * Statistical Analysis Plan (SAP) API Routes
 * Endpoints for creating, managing, and executing SAPs
 */

import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';
import { db } from '../../db';
import { statisticalPlans, topics, artifacts } from '@researchflow/core/schema';
import { logger } from '../logger/file-logger.js';
import {
  generateSAPFromTopic,
  validateSAP,
  suggestSubgroupAnalyses,
  type TopicDeclarationForSAP
} from '../services/sap-generator';
import {
  generateFullMethodsText,
  generateStatisticalMethodsDocument
} from '../../utils/methods-generator';
import { blockAIInDemo } from '../../middleware/mode-guard';
import type { StatisticalPlan, CreateSAPRequest, UpdateSAPRequest } from '@researchflow/core/types/sap';

const router = Router();

/**
 * Generate new SAP from Topic Declaration
 * POST /api/sap/generate
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { topicId, researchId } = req.body as { topicId: string; researchId: string };
    const userId = req.user?.id || 'anonymous';

    if (!db) {
      throw new Error('Database not initialized');
    }

    if (!topicId || !researchId) {
      return res.status(400).json({
        error: 'topicId and researchId are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Fetch topic declaration
    const topic = await db.query.topics.findFirst({
      where: eq(topics.id, topicId)
    });

    if (!topic) {
      return res.status(404).json({
        error: 'Topic declaration not found',
        code: 'TOPIC_NOT_FOUND',
        topicId
      });
    }

    // Convert topic to required format
    const picoElements = (topic.picoElements as any) || {};
    const topicForSAP: TopicDeclarationForSAP = {
      id: topic.id,
      version: topic.version || 1,
      researchQuestion: topic.description || 'Research question',
      population: picoElements.population || 'Study population',
      outcomes: Array.isArray(picoElements.outcomes)
        ? picoElements.outcomes
        : ['Primary outcome'],
      exposures: Array.isArray(picoElements.intervention)
        ? [picoElements.intervention]
        : ['Primary exposure'],
      covariates: [], // Will be specified by user
      studyDesign: picoElements.studyType,
      timeframe: picoElements.timeframe
    };

    // Generate SAP
    const generatedSAP = generateSAPFromTopic(topicForSAP, userId, researchId);

    // Save to database
    const sapRecord = {
      id: generatedSAP.id,
      topicId: topic.id,
      topicVersion: topic.version || 1,
      researchId,
      primaryAnalyses: generatedSAP.primaryAnalyses,
      secondaryAnalyses: generatedSAP.secondaryAnalyses || null,
      covariateStrategy: generatedSAP.covariateStrategy,
      sensitivityAnalyses: generatedSAP.sensitivityAnalyses || null,
      missingDataPlan: generatedSAP.missingDataPlan,
      multiplicityCorrection: generatedSAP.multiplicityCorrection,
      assumptionChecks: generatedSAP.assumptionChecks || null,
      subgroupAnalyses: generatedSAP.subgroupAnalyses || null,
      alphaLevel: generatedSAP.alphaLevel.toString(),
      randomSeed: generatedSAP.randomSeed,
      status: generatedSAP.status,
      approvedBy: null,
      approvedAt: null,
      executedAt: null,
      executionResult: null,
      createdBy: userId
    };

    await db.insert(statisticalPlans).values(sapRecord);

    res.json({
      success: true,
      sap: generatedSAP,
      message: 'SAP generated successfully. Review and modify as needed before approval.'
    });
  } catch (error) {
    logger.error('Error generating SAP:', error);
    res.status(500).json({
      error: 'Failed to generate SAP',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get SAP by ID
 * GET /api/sap/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const sap = await db.query.statisticalPlans.findFirst({
      where: eq(statisticalPlans.id, id)
    });

    if (!sap) {
      return res.status(404).json({
        error: 'SAP not found',
        code: 'SAP_NOT_FOUND',
        sapId: id
      });
    }

    res.json(sap);
  } catch (error) {
    logger.error('Error fetching SAP:', error);
    res.status(500).json({
      error: 'Failed to fetch SAP',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all SAPs for a research project
 * GET /api/sap/research/:researchId
 */
router.get('/research/:researchId', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const saps = await db.query.statisticalPlans.findMany({
      where: eq(statisticalPlans.researchId, researchId),
      orderBy: [desc(statisticalPlans.createdAt)]
    });

    res.json({
      researchId,
      saps,
      total: saps.length
    });
  } catch (error) {
    logger.error('Error fetching SAPs:', error);
    res.status(500).json({
      error: 'Failed to fetch SAPs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update SAP (only if status is 'draft')
 * PUT /api/sap/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<UpdateSAPRequest>;

    if (!db) {
      throw new Error('Database not initialized');
    }

    // Check if SAP exists and is editable
    const existing = await db.query.statisticalPlans.findFirst({
      where: eq(statisticalPlans.id, id)
    });

    if (!existing) {
      return res.status(404).json({
        error: 'SAP not found',
        code: 'SAP_NOT_FOUND',
        sapId: id
      });
    }

    if (existing.status === 'approved') {
      return res.status(400).json({
        error: 'Cannot modify approved SAP',
        code: 'SAP_LOCKED',
        message: 'Create a new version or modify before approval',
        currentStatus: existing.status
      });
    }

    if (existing.status === 'executed') {
      return res.status(400).json({
        error: 'Cannot modify executed SAP',
        code: 'SAP_EXECUTED',
        message: 'SAP has already been executed and cannot be changed',
        currentStatus: existing.status
      });
    }

    // Update SAP
    const updateData: any = {
      ...updates,
      updatedAt: new Date()
    };

    // Convert numeric alpha level to string for database
    if (updates.alphaLevel !== undefined) {
      updateData.alphaLevel = updates.alphaLevel.toString();
    }

    await db.update(statisticalPlans)
      .set(updateData)
      .where(eq(statisticalPlans.id, id));

    const updated = await db.query.statisticalPlans.findFirst({
      where: eq(statisticalPlans.id, id)
    });

    res.json({
      success: true,
      sap: updated,
      message: 'SAP updated successfully'
    });
  } catch (error) {
    logger.error('Error updating SAP:', error);
    res.status(500).json({
      error: 'Failed to update SAP',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Approve/Finalize SAP (locks it from further edits)
 * POST /api/sap/:id/approve
 * Requires STEWARD or ADMIN role
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'system';

    if (!db) {
      throw new Error('Database not initialized');
    }

    const sap = await db.query.statisticalPlans.findFirst({
      where: eq(statisticalPlans.id, id)
    });

    if (!sap) {
      return res.status(404).json({
        error: 'SAP not found',
        code: 'SAP_NOT_FOUND',
        sapId: id
      });
    }

    if (sap.status === 'approved') {
      return res.status(400).json({
        error: 'SAP already approved',
        code: 'ALREADY_APPROVED',
        approvedBy: sap.approvedBy,
        approvedAt: sap.approvedAt
      });
    }

    if (sap.status === 'executed') {
      return res.status(400).json({
        error: 'SAP already executed',
        code: 'ALREADY_EXECUTED',
        executedAt: sap.executedAt
      });
    }

    // Validate SAP before approval
    const sapObj: StatisticalPlan = {
      id: sap.id,
      topicDeclarationId: sap.topicId,
      topicVersion: sap.topicVersion,
      createdAt: sap.createdAt.toISOString(),
      updatedAt: sap.updatedAt?.toISOString(),
      status: sap.status as any,
      alphaLevel: parseFloat(sap.alphaLevel),
      randomSeed: sap.randomSeed,
      primaryAnalyses: sap.primaryAnalyses as any,
      secondaryAnalyses: sap.secondaryAnalyses as any,
      covariateStrategy: sap.covariateStrategy as any,
      sensitivityAnalyses: sap.sensitivityAnalyses as any,
      missingDataPlan: sap.missingDataPlan as any,
      multiplicityCorrection: sap.multiplicityCorrection as any,
      assumptionChecks: sap.assumptionChecks as any,
      subgroupAnalyses: sap.subgroupAnalyses as any,
      approvedBy: sap.approvedBy || undefined,
      approvedAt: sap.approvedAt?.toISOString(),
      executedAt: sap.executedAt?.toISOString()
    };

    const validation = validateSAP(sapObj);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'SAP validation failed',
        code: 'VALIDATION_FAILED',
        errors: validation.errors
      });
    }

    // Approve SAP
    await db.update(statisticalPlans)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(statisticalPlans.id, id));

    const approved = await db.query.statisticalPlans.findFirst({
      where: eq(statisticalPlans.id, id)
    });

    res.json({
      success: true,
      sap: approved,
      message: 'SAP approved and locked. No further modifications allowed.'
    });
  } catch (error) {
    logger.error('Error approving SAP:', error);
    res.status(500).json({
      error: 'Failed to approve SAP',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate statistical methods narrative from SAP
 * POST /api/sap/:id/generate-methods
 */
router.post('/:id/generate-methods', blockAIInDemo, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { executionResult } = req.body;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const sapRecord = await db.query.statisticalPlans.findFirst({
      where: eq(statisticalPlans.id, id)
    });

    if (!sapRecord) {
      return res.status(404).json({
        error: 'SAP not found',
        code: 'SAP_NOT_FOUND',
        sapId: id
      });
    }

    // Convert database record to StatisticalPlan type
    const sap: StatisticalPlan = {
      id: sapRecord.id,
      topicDeclarationId: sapRecord.topicId,
      topicVersion: sapRecord.topicVersion,
      createdAt: sapRecord.createdAt.toISOString(),
      updatedAt: sapRecord.updatedAt?.toISOString(),
      status: sapRecord.status as any,
      alphaLevel: parseFloat(sapRecord.alphaLevel),
      randomSeed: sapRecord.randomSeed,
      primaryAnalyses: sapRecord.primaryAnalyses as any,
      secondaryAnalyses: sapRecord.secondaryAnalyses as any,
      covariateStrategy: sapRecord.covariateStrategy as any,
      sensitivityAnalyses: sapRecord.sensitivityAnalyses as any,
      missingDataPlan: sapRecord.missingDataPlan as any,
      multiplicityCorrection: sapRecord.multiplicityCorrection as any,
      assumptionChecks: sapRecord.assumptionChecks as any,
      subgroupAnalyses: sapRecord.subgroupAnalyses as any,
      approvedBy: sapRecord.approvedBy || undefined,
      approvedAt: sapRecord.approvedAt?.toISOString(),
      executedAt: sapRecord.executedAt?.toISOString()
    };

    // Generate methods document
    const methodsDoc = generateStatisticalMethodsDocument(sap, executionResult);
    const methodsText = generateFullMethodsText(sap, executionResult);

    // Save as artifact
    const artifactId = uuid();
    const contentHash = createHash('sha256').update(methodsText).digest('hex');

    await db.insert(artifacts).values({
      id: artifactId,
      researchId: sapRecord.researchId,
      stageId: 'statistical_methods',
      artifactType: 'analysis_output',
      filename: `statistical_methods_${sap.id}.md`,
      mimeType: 'text/markdown',
      content: methodsText,
      sizeBytes: Buffer.byteLength(methodsText, 'utf8'),
      sha256Hash: contentHash,
      createdBy: req.user?.id || 'system',
      currentVersionId: null
    });

    res.json({
      success: true,
      methods: methodsDoc,
      methodsText,
      artifactId,
      message: 'Statistical methods narrative generated successfully'
    });
  } catch (error) {
    logger.error('Error generating methods:', error);
    res.status(500).json({
      error: 'Failed to generate methods',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get suggested subgroup analyses for a topic
 * GET /api/sap/suggestions/subgroups/:topicId
 */
router.get('/suggestions/subgroups/:topicId', async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const topic = await db.query.topics.findFirst({
      where: eq(topics.id, topicId)
    });

    if (!topic) {
      return res.status(404).json({
        error: 'Topic not found',
        code: 'TOPIC_NOT_FOUND',
        topicId
      });
    }

    const picoElems = (topic.picoElements as any) || {};
    const topicForSAP: TopicDeclarationForSAP = {
      id: topic.id,
      version: topic.version || 1,
      researchQuestion: topic.description || 'Research question',
      population: picoElems.population || 'Study population',
      outcomes: Array.isArray(picoElems.outcomes)
        ? picoElems.outcomes
        : [],
      exposures: Array.isArray(picoElems.intervention)
        ? [picoElems.intervention]
        : [],
      covariates: []
    };

    const suggestions = suggestSubgroupAnalyses(topicForSAP);

    res.json({
      topicId,
      suggestions,
      message: 'Suggested subgroup analyses based on topic characteristics'
    });
  } catch (error) {
    logger.error('Error generating subgroup suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Validate SAP
 * POST /api/sap/:id/validate
 */
router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const sapRecord = await db.query.statisticalPlans.findFirst({
      where: eq(statisticalPlans.id, id)
    });

    if (!sapRecord) {
      return res.status(404).json({
        error: 'SAP not found',
        code: 'SAP_NOT_FOUND',
        sapId: id
      });
    }

    const sap: StatisticalPlan = {
      id: sapRecord.id,
      topicDeclarationId: sapRecord.topicId,
      topicVersion: sapRecord.topicVersion,
      createdAt: sapRecord.createdAt.toISOString(),
      updatedAt: sapRecord.updatedAt?.toISOString(),
      status: sapRecord.status as any,
      alphaLevel: parseFloat(sapRecord.alphaLevel),
      randomSeed: sapRecord.randomSeed,
      primaryAnalyses: sapRecord.primaryAnalyses as any,
      secondaryAnalyses: sapRecord.secondaryAnalyses as any,
      covariateStrategy: sapRecord.covariateStrategy as any,
      sensitivityAnalyses: sapRecord.sensitivityAnalyses as any,
      missingDataPlan: sapRecord.missingDataPlan as any,
      multiplicityCorrection: sapRecord.multiplicityCorrection as any,
      assumptionChecks: sapRecord.assumptionChecks as any,
      subgroupAnalyses: sapRecord.subgroupAnalyses as any,
      approvedBy: sapRecord.approvedBy || undefined,
      approvedAt: sapRecord.approvedAt?.toISOString(),
      executedAt: sapRecord.executedAt?.toISOString()
    };

    const validation = validateSAP(sap);

    res.json({
      sapId: id,
      ...validation,
      message: validation.valid
        ? 'SAP is valid and ready for approval'
        : 'SAP validation failed. Please address errors before approval.'
    });
  } catch (error) {
    logger.error('Error validating SAP:', error);
    res.status(500).json({
      error: 'Failed to validate SAP',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
