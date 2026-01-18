import { z } from 'zod';

export const CitationSourceTypeSchema = z.enum([
  'pubmed', 'doi', 'pmcid', 'arxiv', 'isbn', 'url', 'manual'
]);
export type CitationSourceType = z.infer<typeof CitationSourceTypeSchema>;

export const CitationSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  sourceType: CitationSourceTypeSchema,
  externalId: z.string(),
  title: z.string(),
  authors: z.array(z.object({
    lastName: z.string(),
    firstName: z.string().optional(),
    initials: z.string().optional()
  })),
  journal: z.string().optional(),
  year: z.number().int(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  url: z.string().url().optional(),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  meshTerms: z.array(z.string()).optional(),
  sections: z.array(z.string()),
  orderInDocument: z.number().int().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type Citation = z.infer<typeof CitationSchema>;

export const LitSearchResultSchema = z.object({
  query: z.string(),
  source: z.enum(['pubmed', 'semantic_scholar', 'arxiv']),
  totalResults: z.number().int(),
  results: z.array(z.object({
    externalId: z.string(),
    title: z.string(),
    authors: z.array(z.string()),
    year: z.number().int(),
    abstract: z.string().optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    citationCount: z.number().int().optional()
  })),
  searchedAt: z.date()
});
export type LitSearchResult = z.infer<typeof LitSearchResultSchema>;
