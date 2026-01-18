/**
 * Section Reorder Types
 * Task T52: Types for manuscript section reordering
 */

import { z } from 'zod';
import type { IMRaDSection } from './imrad.types';

export const SectionMoveOperationSchema = z.object({
  manuscriptId: z.string().uuid(),
  sectionId: z.string(),
  fromOrder: z.number().int().min(0),
  toOrder: z.number().int().min(0),
  timestamp: z.date(),
});
export type SectionMoveOperation = z.infer<typeof SectionMoveOperationSchema>;

export const SectionReorderRequestSchema = z.object({
  manuscriptId: z.string().uuid(),
  operations: z.array(SectionMoveOperationSchema).min(1),
});
export type SectionReorderRequest = z.infer<typeof SectionReorderRequestSchema>;

export const ReorderedSectionSchema = z.object({
  sectionId: z.string(),
  sectionType: z.string(),
  newOrder: z.number().int().min(0),
  previousOrder: z.number().int().min(0),
});
export type ReorderedSection = z.infer<typeof ReorderedSectionSchema>;

export const SectionReorderResultSchema = z.object({
  manuscriptId: z.string().uuid(),
  reorderedSections: z.array(ReorderedSectionSchema),
  success: z.boolean(),
  errors: z.array(z.string()),
  updatedAt: z.date(),
});
export type SectionReorderResult = z.infer<typeof SectionReorderResultSchema>;
