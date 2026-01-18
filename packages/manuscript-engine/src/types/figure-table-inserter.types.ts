/**
 * Figure and Table Inserter Types
 * Task T49: Types for figure/table insertion in manuscripts
 */

import { z } from 'zod';

export const FigureTypeSchema = z.enum([
  'chart',
  'graph',
  'flowchart',
  'image',
  'diagram',
  'screenshot',
  'other',
]);
export type FigureType = z.infer<typeof FigureTypeSchema>;

export const TableTypeSchema = z.enum([
  'baseline_characteristics',
  'outcomes',
  'subgroup_analysis',
  'adverse_events',
  'quality_assessment',
  'other',
]);
export type TableType = z.infer<typeof TableTypeSchema>;

export const FigureInsertionRequestSchema = z.object({
  manuscriptId: z.string().uuid(),
  sectionId: z.string(),
  figureType: FigureTypeSchema,
  title: z.string(),
  caption: z.string(),
  dataBinding: z.string().optional(),
  imageUrl: z.string().url().optional(),
  position: z.enum(['before_paragraph', 'after_paragraph', 'end_of_section']),
  paragraphIndex: z.number().int().min(0).optional(),
});
export type FigureInsertionRequest = z.infer<typeof FigureInsertionRequestSchema>;

export const TableInsertionRequestSchema = z.object({
  manuscriptId: z.string().uuid(),
  sectionId: z.string(),
  tableType: TableTypeSchema,
  title: z.string(),
  caption: z.string(),
  dataBinding: z.string(),
  position: z.enum(['before_paragraph', 'after_paragraph', 'end_of_section']),
  paragraphIndex: z.number().int().min(0).optional(),
});
export type TableInsertionRequest = z.infer<typeof TableInsertionRequestSchema>;

export const InsertedFigureSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  sectionId: z.string(),
  number: z.number().int().min(1),
  type: FigureTypeSchema,
  title: z.string(),
  caption: z.string(),
  imageUrl: z.string().url().optional(),
  dataBinding: z.string().optional(),
  insertedAt: z.date(),
});
export type InsertedFigure = z.infer<typeof InsertedFigureSchema>;

export const InsertedTableSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  sectionId: z.string(),
  number: z.number().int().min(1),
  type: TableTypeSchema,
  title: z.string(),
  caption: z.string(),
  dataBinding: z.string(),
  insertedAt: z.date(),
});
export type InsertedTable = z.infer<typeof InsertedTableSchema>;
