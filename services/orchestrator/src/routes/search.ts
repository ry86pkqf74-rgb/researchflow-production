/**
 * Search Router (Task 98)
 *
 * API endpoints for full-text search:
 * - GET /api/search - Search artifacts and manuscripts
 * - GET /api/search/suggestions - Get search suggestions
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { resolveOrgContext, requireOrgMember } from "../middleware/org-context";
import { requireAuth as isAuthenticated } from "../services/authService";
import {
  searchAll,
  searchArtifacts,
  searchResearchProjects,
  getSearchSuggestions,
} from "../services/searchService";

const router = Router();

/**
 * Full-text search across artifacts and manuscripts
 */
router.get(
  "/",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgMember(),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, type, limit, offset } = req.query;
    const orgId = req.org!.org.id;

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        error: "Search query (q) is required",
        code: "QUERY_REQUIRED",
      });
    }

    const searchType = type as "artifact" | "manuscript" | "all" | undefined;
    const parsedLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
    const parsedOffset = parseInt(offset as string, 10) || 0;

    let results;

    if (searchType === "artifact" || searchType === "manuscript") {
      results = await searchArtifacts({
        query: q,
        orgId,
        type: searchType,
        limit: parsedLimit,
        offset: parsedOffset,
      });
    } else {
      results = await searchAll({
        query: q,
        orgId,
        limit: parsedLimit,
        offset: parsedOffset,
      });
    }

    res.json({
      query: q,
      type: searchType || "all",
      results,
      count: results.length,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  })
);

/**
 * Get search suggestions for autocomplete
 */
router.get(
  "/suggestions",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgMember(),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit } = req.query;
    const orgId = req.org!.org.id;

    if (!q || typeof q !== "string" || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 5, 10);
    const suggestions = await getSearchSuggestions(q, orgId, parsedLimit);

    res.json({ suggestions });
  })
);

/**
 * Search within a specific research project
 */
router.get(
  "/research/:researchId",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgMember(),
  asyncHandler(async (req: Request, res: Response) => {
    const { researchId } = req.params;
    const { q, limit } = req.query;
    const orgId = req.org!.org.id;

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        error: "Search query (q) is required",
        code: "QUERY_REQUIRED",
      });
    }

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 20, 100);

    // Search only within this research project's artifacts
    const results = await searchArtifacts({
      query: q,
      orgId,
      limit: parsedLimit,
    });

    // Filter to only this research project
    const filteredResults = results.filter((r) => r.researchId === researchId);

    res.json({
      query: q,
      researchId,
      results: filteredResults,
      count: filteredResults.length,
    });
  })
);

export default router;
