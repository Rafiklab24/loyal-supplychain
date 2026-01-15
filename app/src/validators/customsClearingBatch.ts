import { z } from 'zod';

/**
 * Validators for Customs Clearing Batch operations
 */

// Create batch schema
export const createBatchSchema = z.object({
  batch_number: z.string().min(1, 'Batch number is required').max(100),
  customs_cost_ids: z.array(z.string().uuid()).min(1, 'At least one item must be selected'),
  notes: z.string().optional().nullable(),
});

// Update batch status schema
export const updateBatchStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'archived']),
  notes: z.string().optional().nullable(),
});

// Batch filters schema
export const batchFiltersSchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  
  // Sorting
  sort_by: z.enum([
    'batch_number',
    'status',
    'total_clearing_cost',
    'item_count',
    'created_at',
    'submitted_at',
    'reviewed_at',
  ]).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  
  // Filters
  status: z.enum(['pending', 'approved', 'archived']).optional(),
  created_by: z.string().optional(),
  reviewed_by: z.string().optional(),
  
  // Date range
  created_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  created_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  
  // Search
  search: z.string().optional(), // Search across batch_number, notes
});

// Export filters schema
export const exportBatchFiltersSchema = batchFiltersSchema.omit({
  page: true,
  limit: true,
});

// ID parameter schema
export const batchIdSchema = z.object({
  id: z.string().uuid('Invalid batch ID'),
});

// Type exports
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchStatusInput = z.infer<typeof updateBatchStatusSchema>;
export type BatchFilters = z.infer<typeof batchFiltersSchema>;
export type ExportBatchFilters = z.infer<typeof exportBatchFiltersSchema>;

