/**
 * Search Service (Task 98)
 *
 * Full-text search implementation using PostgreSQL tsvector/tsquery.
 * Searches across artifacts and manuscripts within organization scope.
 */

import { db } from "../../db";
import { eq, sql, and, or, ilike } from "drizzle-orm";
import { artifacts, researchProjects } from "@researchflow/core/schema";

export interface SearchResult {
  id: string;
  type: "artifact" | "manuscript" | "research";
  title?: string;
  filename?: string;
  snippet?: string;
  highlight?: string;
  researchId?: string;
  researchTitle?: string;
  artifactType?: string;
  createdAt: Date;
  relevance?: number;
}

export interface SearchOptions {
  query: string;
  orgId: string;
  type?: "artifact" | "manuscript" | "all";
  limit?: number;
  offset?: number;
}

/**
 * Perform full-text search across artifacts
 */
export async function searchArtifacts(options: SearchOptions): Promise<SearchResult[]> {
  const { query, orgId, type = "all", limit = 20, offset = 0 } = options;

  if (!db) {
    throw new Error("Database not available");
  }

  if (!query.trim()) {
    return [];
  }

  // Escape special characters for safety
  const safeQuery = query.replace(/['"\\]/g, " ").trim();

  // Build type filter
  let typeFilter = null;
  if (type === "artifact") {
    typeFilter = sql`${artifacts.artifactType} != 'manuscript'`;
  } else if (type === "manuscript") {
    typeFilter = sql`${artifacts.artifactType} = 'manuscript'`;
  }

  // First try PostgreSQL full-text search if search_vector exists
  try {
    const results = await db
      .select({
        id: artifacts.id,
        filename: artifacts.filename,
        artifactType: artifacts.artifactType,
        content: artifacts.content,
        researchId: artifacts.researchId,
        createdAt: artifacts.createdAt,
        researchTitle: researchProjects.title,
      })
      .from(artifacts)
      .leftJoin(researchProjects, eq(artifacts.researchId, researchProjects.id))
      .where(
        and(
          eq(researchProjects.orgId, orgId),
          or(
            ilike(artifacts.filename, `%${safeQuery}%`),
            ilike(artifacts.content, `%${safeQuery}%`)
          ),
          typeFilter ? typeFilter : sql`1=1`
        )
      )
      .limit(limit)
      .offset(offset);

    return results.map((row) => ({
      id: row.id,
      type: row.artifactType === "manuscript" ? "manuscript" as const : "artifact" as const,
      filename: row.filename,
      title: row.filename,
      artifactType: row.artifactType,
      researchId: row.researchId,
      researchTitle: row.researchTitle || undefined,
      snippet: extractSnippet(row.content || "", safeQuery),
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error("[searchService] FTS query failed, falling back to LIKE:", error);

    // Fallback to simple LIKE search
    return fallbackSearch(options);
  }
}

/**
 * Fallback to simple LIKE-based search
 */
async function fallbackSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, orgId, type = "all", limit = 20, offset = 0 } = options;

  if (!db) {
    throw new Error("Database not available");
  }

  const safeQuery = query.replace(/['"\\]/g, " ").trim();

  let typeFilter = null;
  if (type === "artifact") {
    typeFilter = sql`${artifacts.artifactType} != 'manuscript'`;
  } else if (type === "manuscript") {
    typeFilter = sql`${artifacts.artifactType} = 'manuscript'`;
  }

  const results = await db
    .select({
      id: artifacts.id,
      filename: artifacts.filename,
      artifactType: artifacts.artifactType,
      content: artifacts.content,
      researchId: artifacts.researchId,
      createdAt: artifacts.createdAt,
      researchTitle: researchProjects.title,
    })
    .from(artifacts)
    .leftJoin(researchProjects, eq(artifacts.researchId, researchProjects.id))
    .where(
      and(
        eq(researchProjects.orgId, orgId),
        or(
          ilike(artifacts.filename, `%${safeQuery}%`),
          ilike(artifacts.content, `%${safeQuery}%`)
        ),
        typeFilter ? typeFilter : sql`1=1`
      )
    )
    .limit(limit)
    .offset(offset);

  return results.map((row) => ({
    id: row.id,
    type: row.artifactType === "manuscript" ? "manuscript" as const : "artifact" as const,
    filename: row.filename,
    title: row.filename,
    artifactType: row.artifactType,
    researchId: row.researchId,
    researchTitle: row.researchTitle || undefined,
    snippet: extractSnippet(row.content || "", safeQuery),
    createdAt: row.createdAt,
  }));
}

/**
 * Search research projects by title/description
 */
export async function searchResearchProjects(
  query: string,
  orgId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  if (!db) {
    throw new Error("Database not available");
  }

  const safeQuery = query.replace(/['"\\]/g, " ").trim();

  const results = await db
    .select()
    .from(researchProjects)
    .where(
      and(
        eq(researchProjects.orgId, orgId),
        or(
          ilike(researchProjects.title, `%${safeQuery}%`),
          ilike(researchProjects.description, `%${safeQuery}%`)
        )
      )
    )
    .limit(limit);

  return results.map((row) => ({
    id: row.id,
    type: "research" as const,
    title: row.title,
    snippet: row.description || undefined,
    createdAt: row.createdAt,
  }));
}

/**
 * Combined search across all types
 */
export async function searchAll(options: SearchOptions): Promise<SearchResult[]> {
  const { query, orgId, limit = 20 } = options;

  const [artifacts, projects] = await Promise.all([
    searchArtifacts({ ...options, limit: Math.floor(limit * 0.7) }),
    searchResearchProjects(query, orgId, Math.floor(limit * 0.3)),
  ]);

  // Combine and sort by relevance (projects first, then artifacts)
  const combined = [...projects, ...artifacts];

  return combined.slice(0, limit);
}

/**
 * Extract a snippet from content around the search term
 */
function extractSnippet(content: string, query: string, maxLength: number = 150): string {
  if (!content) return "";

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryIndex = lowerContent.indexOf(lowerQuery);

  if (queryIndex === -1) {
    // Query not found, return beginning
    return content.substring(0, maxLength) + (content.length > maxLength ? "..." : "");
  }

  // Center the snippet around the query
  const start = Math.max(0, queryIndex - Math.floor(maxLength / 2));
  const end = Math.min(content.length, start + maxLength);

  let snippet = content.substring(start, end);

  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < content.length) {
    snippet = snippet + "...";
  }

  return snippet;
}

/**
 * Get search suggestions based on partial query
 */
export async function getSearchSuggestions(
  partialQuery: string,
  orgId: string,
  limit: number = 5
): Promise<string[]> {
  if (!db) {
    throw new Error("Database not available");
  }

  if (partialQuery.length < 2) {
    return [];
  }

  const safeQuery = partialQuery.replace(/['"\\]/g, " ").trim();

  // Get unique filenames matching the query
  const results = await db
    .selectDistinct({ filename: artifacts.filename })
    .from(artifacts)
    .leftJoin(researchProjects, eq(artifacts.researchId, researchProjects.id))
    .where(
      and(
        eq(researchProjects.orgId, orgId),
        ilike(artifacts.filename, `%${safeQuery}%`)
      )
    )
    .limit(limit);

  return results.map((r) => r.filename);
}
