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

/**
 * Global search including hub entities (pages, tasks, goals)
 * This endpoint is designed for the global search dialog in the frontend.
 */
router.get(
  "/global",
  isAuthenticated,
  asyncHandler(async (req: Request, res: Response) => {
    const { q, types = "all", limit = "20" } = req.query;
    const userId = (req as any).user?.id;

    if (!q || typeof q !== "string" || q.length < 2) {
      return res.status(400).json({
        error: "Query must be at least 2 characters",
        code: "QUERY_TOO_SHORT",
      });
    }

    const searchTerm = `%${q.toLowerCase()}%`;
    const results: any[] = [];
    const typeList =
      types === "all"
        ? ["projects", "pages", "tasks", "goals"]
        : (types as string).split(",");
    const parsedLimit = Math.min(parseInt(limit as string, 10) || 20, 50);

    // Import pool for raw queries
    const { db: pool } = await import("../../db");

    // Search projects
    if (typeList.includes("projects")) {
      try {
        const projects = await pool.query(
          `SELECT id, name, description, 'project' as type
           FROM projects
           WHERE (owner_id = $1 OR id IN (SELECT project_id FROM project_members WHERE user_id = $1))
           AND (LOWER(name) LIKE $2 OR LOWER(COALESCE(description, '')) LIKE $2)
           LIMIT $3`,
          [userId, searchTerm, parsedLimit]
        );
        results.push(...projects.rows);
      } catch (e) {
        // Projects table may not exist
        console.log("[search/global] Projects search failed:", e);
      }
    }

    // Search hub pages
    if (typeList.includes("pages")) {
      try {
        const pages = await pool.query(
          `SELECT hp.id, hp.title as name, 'page' as type, hp.project_id
           FROM hub_pages hp
           LEFT JOIN projects p ON hp.project_id = p.id
           WHERE (p.owner_id = $1 OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1) OR hp.created_by = $1)
           AND LOWER(hp.title) LIKE $2
           AND hp.is_archived = FALSE
           LIMIT $3`,
          [userId, searchTerm, parsedLimit]
        );
        results.push(...pages.rows);
      } catch (e) {
        console.log("[search/global] Pages search failed:", e);
      }
    }

    // Search hub tasks
    if (typeList.includes("tasks")) {
      try {
        const tasks = await pool.query(
          `SELECT ht.id, ht.title as name, 'task' as type, ht.project_id, ht.status
           FROM hub_tasks ht
           LEFT JOIN projects p ON ht.project_id = p.id
           WHERE (p.owner_id = $1 OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1) OR ht.created_by = $1)
           AND LOWER(ht.title) LIKE $2
           LIMIT $3`,
          [userId, searchTerm, parsedLimit]
        );
        results.push(...tasks.rows);
      } catch (e) {
        console.log("[search/global] Tasks search failed:", e);
      }
    }

    // Search hub goals
    if (typeList.includes("goals")) {
      try {
        const goals = await pool.query(
          `SELECT hg.id, hg.title as name, 'goal' as type, hg.project_id, hg.status, hg.progress
           FROM hub_goals hg
           LEFT JOIN projects p ON hg.project_id = p.id
           WHERE (p.owner_id = $1 OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $1) OR hg.created_by = $1)
           AND LOWER(hg.title) LIKE $2
           LIMIT $3`,
          [userId, searchTerm, parsedLimit]
        );
        results.push(...goals.rows);
      } catch (e) {
        console.log("[search/global] Goals search failed:", e);
      }
    }

    res.json({
      query: q,
      results,
      total: results.length,
    });
  })
);

export default router;
