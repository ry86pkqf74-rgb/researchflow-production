import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { topics } from "@researchflow/core/schema";
import { asyncHandler } from "../middleware/errorHandler";
import { requireRole, logAuditEvent, ROLES } from "../middleware/rbac";
import {
  createTopic,
  updateTopic,
  lockTopic,
  getTopicVersionHistory,
  getCurrentTopic,
  getTopicById,
} from "../services/topicService";
import {
  convertQuickEntryToPICO,
  detectEffectiveEntryMode,
  hasValidQuickEntryFields,
} from "../services/topic-converter";
import type { PICOConversionRequest } from "@researchflow/core/types/topic-declaration";

const router = Router();

router.get(
  "/:researchId",
  asyncHandler(async (req, res) => {
    const { researchId } = req.params;

    const topic = await getCurrentTopic(researchId);

    if (!topic) {
      res.status(404).json({
        error: "No topic found for this research project",
        code: "TOPIC_NOT_FOUND",
        researchId,
      });
      return;
    }

    res.json(topic);
  })
);

router.get(
  "/:researchId/history",
  asyncHandler(async (req, res) => {
    const { researchId } = req.params;

    const history = await getTopicVersionHistory(researchId);

    res.json({
      researchId,
      versions: history,
      total: history.length,
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { researchId, title, description, picoElements, keywords } = req.body;
    const userId = req.user?.id || "anonymous";

    if (!researchId) {
      res.status(400).json({
        error: "researchId is required",
        code: "MISSING_RESEARCH_ID",
      });
      return;
    }

    if (!title) {
      res.status(400).json({
        error: "title is required",
        code: "MISSING_TITLE",
      });
      return;
    }

    const existingTopic = await getCurrentTopic(researchId);
    if (existingTopic) {
      res.status(409).json({
        error: "A topic already exists for this research project. Use PUT to update.",
        code: "TOPIC_EXISTS",
        existingTopicId: existingTopic.id,
      });
      return;
    }

    const topic = await createTopic({
      researchId,
      title,
      description,
      picoElements,
      keywords,
      createdBy: userId,
    });

    res.status(201).json(topic);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, picoElements, keywords } = req.body;
    const userId = req.user?.id || "anonymous";

    const existingTopic = await getTopicById(id);
    if (!existingTopic) {
      res.status(404).json({
        error: "Topic not found",
        code: "TOPIC_NOT_FOUND",
        topicId: id,
      });
      return;
    }

    try {
      const topic = await updateTopic(
        id,
        { title, description, picoElements, keywords },
        userId
      );

      res.json(topic);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update failed";
      
      if (message.includes("locked") || message.includes("superseded")) {
        res.status(409).json({
          error: message,
          code: "UPDATE_NOT_ALLOWED",
          topicId: id,
        });
        return;
      }

      throw error;
    }
  })
);

router.post(
  "/:id/lock",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id || "anonymous";

    const existingTopic = await getTopicById(id);
    if (!existingTopic) {
      res.status(404).json({
        error: "Topic not found",
        code: "TOPIC_NOT_FOUND",
        topicId: id,
      });
      return;
    }

    try {
      const topic = await lockTopic(id, userId);

      res.json({
        message: "Topic locked successfully",
        topic,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lock failed";

      if (message.includes("already locked") || message.includes("superseded")) {
        res.status(409).json({
          error: message,
          code: "LOCK_NOT_ALLOWED",
          topicId: id,
        });
        return;
      }

      throw error;
    }
  })
);

/**
 * Convert Quick Entry topic to PICO mode
 * POST /api/topics/:id/convert-to-pico
 *
 * Takes Quick Entry fields and converts them to structured PICO format.
 * Optional overrides can be provided for comparator and timeframe.
 */
router.post(
  "/:id/convert-to-pico",
  requireRole(ROLES.RESEARCHER),
  logAuditEvent("TOPIC_CONVERT_TO_PICO", "topic"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comparator, timeframe, population, intervention }: PICOConversionRequest = req.body;

    const existingTopic = await getTopicById(id);
    if (!existingTopic) {
      res.status(404).json({
        error: "Topic not found",
        code: "TOPIC_NOT_FOUND",
        topicId: id,
      });
      return;
    }

    // Check if topic is locked
    if (existingTopic.status === "LOCKED") {
      res.status(409).json({
        error: "Cannot convert locked topic",
        code: "TOPIC_LOCKED",
        topicId: id,
      });
      return;
    }

    // Check if already in PICO mode
    const currentMode = detectEffectiveEntryMode(existingTopic);
    if (currentMode === "pico" && existingTopic.entryMode === "pico") {
      res.status(400).json({
        error: "Topic is already in PICO mode",
        code: "ALREADY_PICO_MODE",
        topicId: id,
      });
      return;
    }

    // Check if topic has Quick Entry fields to convert
    if (!hasValidQuickEntryFields(existingTopic)) {
      res.status(400).json({
        error: "Topic has no Quick Entry fields to convert",
        code: "NO_QUICK_ENTRY_FIELDS",
        topicId: id,
      });
      return;
    }

    if (!db) {
      throw new Error('Database not initialized');
    }

    // Convert Quick Entry to PICO
    const picoElements = convertQuickEntryToPICO(existingTopic, {
      comparator,
      timeframe,
    });

    // Apply any explicit overrides
    if (population) picoElements.population = population;
    if (intervention) picoElements.intervention = intervention;

    // Update topic with PICO elements and change entry mode
    await db
      .update(topics)
      .set({
        entryMode: "pico",
        picoElements,
        updatedAt: new Date(),
      } as any)
      .where(eq(topics.id, id));

    // Fetch updated topic
    const updatedTopic = await getTopicById(id);

    res.json({
      success: true,
      message: "Topic converted to PICO mode",
      topic: updatedTopic,
      picoElements,
    });
  })
);

/**
 * Get topic entry mode info
 * GET /api/topics/:id/entry-mode
 */
router.get(
  "/:id/entry-mode",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const topic = await getTopicById(id);
    if (!topic) {
      res.status(404).json({
        error: "Topic not found",
        code: "TOPIC_NOT_FOUND",
        topicId: id,
      });
      return;
    }

    const effectiveMode = detectEffectiveEntryMode(topic);
    const hasQuickEntry = hasValidQuickEntryFields(topic);
    const hasPico = topic.picoElements !== null;

    res.json({
      topicId: id,
      storedEntryMode: topic.entryMode,
      effectiveEntryMode: effectiveMode,
      hasQuickEntryFields: hasQuickEntry,
      hasPicoElements: hasPico,
      canConvertToPico: hasQuickEntry && effectiveMode === "quick",
    });
  })
);

export default router;
