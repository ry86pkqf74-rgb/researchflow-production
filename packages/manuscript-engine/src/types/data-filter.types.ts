import { z } from 'zod';

export const FilterOperatorSchema = z.enum([
  'equals', 'not_equals', 'greater_than', 'less_than', 'between', 'contains', 'in_list', 'is_null', 'is_not_null'
]);

export const DataFilterSchema = z.object({
  id: z.string().uuid(),
  column: z.string(),
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.array(z.string()), z.array(z.number())]).optional(),
  valueTo: z.number().optional()
});
export type DataFilter = z.infer<typeof DataFilterSchema>;

export const DataSelectionSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  datasetId: z.string().uuid(),
  targetSection: z.string(),
  selectedColumns: z.array(z.string()),
  filters: z.array(DataFilterSchema),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().positive().optional(),
  createdAt: z.date(),
  createdBy: z.string().uuid()
});
export type DataSelection = z.infer<typeof DataSelectionSchema>;
