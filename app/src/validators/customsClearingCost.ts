import { z } from 'zod';

/**
 * Validators for Customs Clearing Cost operations
 */

// Base schema for customs clearing cost
const customsClearingCostBaseSchema = z.object({
  file_number: z.string().min(1, 'File number is required').max(100),
  shipment_id: z.string().uuid().optional().nullable(),
  
  // New split fields
  transaction_type: z.string().max(200).optional().nullable(),
  goods_type: z.string().max(300).optional().nullable(),
  containers_cars_count: z.string().max(100).optional().nullable(),
  goods_weight: z.string().max(100).optional().nullable(),
  cost_description: z.string().optional().nullable(),
  
  // Legacy field (deprecated, kept for backward compatibility)
  transaction_description: z.string().optional().nullable(),
  
  destination_final_beneficiary: z.string().max(500).optional().nullable(),
  bol_number: z.string().max(100).optional().nullable(),
  car_plate: z.string().max(200).optional().nullable(),
  
  // New fields
  cost_responsibility: z.string().max(200).optional().nullable(),
  original_clearing_amount: z.number().min(0).optional().nullable(),
  
  // Legacy cost breakdown fields (deprecated, kept for backward compatibility)
  cost_paid_by_company: z.number().min(0).optional().nullable(),
  cost_paid_by_fb: z.number().min(0).optional().nullable(),
  
  extra_cost_amount: z.number().min(0).optional().nullable(),
  extra_cost_description: z.string().optional().nullable(),
  total_clearing_cost: z.number().min(0, 'Total clearing cost must be positive'),
  
  client_name: z.string().max(500).optional().nullable(),
  invoice_amount: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).default('USD'),
  invoice_number: z.string().max(100).optional().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.date()).optional().nullable(),
  
  clearance_type: z.string().max(100).optional().nullable(), // Free text with suggestions: 'inbound', 'outbound', 'transit', 'border_crossing'
  payment_status: z.enum(['pending', 'paid', 'partial']).default('pending'),
  notes: z.string().optional().nullable(),
  
  // Border crossing fields (for internal route clearances)
  border_crossing_id: z.string().uuid().optional().nullable(),
  stage_order: z.number().int().min(1).max(10).optional().nullable(),
  arrival_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.date()).optional().nullable(),
  clearance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.date()).optional().nullable(),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
  clearance_status: z.enum(['pending', 'arrived', 'in_progress', 'cleared', 'cancelled']).optional().nullable(),
});

// Validation: Check that at least one cost field is set
const validateCostFields = (data: any) => {
  // Check new fields first
  const hasOriginalAmount = data.original_clearing_amount !== null && 
                            data.original_clearing_amount !== undefined && 
                            data.original_clearing_amount > 0;
  const hasExtraCost = data.extra_cost_amount !== null && 
                       data.extra_cost_amount !== undefined && 
                       data.extra_cost_amount > 0;
  
  // Check legacy fields for backward compatibility
  const hasLegacyCompany = data.cost_paid_by_company !== null && 
                           data.cost_paid_by_company !== undefined && 
                           data.cost_paid_by_company > 0;
  const hasLegacyFB = data.cost_paid_by_fb !== null && 
                      data.cost_paid_by_fb !== undefined && 
                      data.cost_paid_by_fb > 0;
  
  // Validate mutual exclusivity for legacy fields
  if (hasLegacyCompany && hasLegacyFB) {
    return false;
  }
  
  // At least one cost field should be set (new or legacy)
  if (!hasOriginalAmount && !hasExtraCost && !hasLegacyCompany && !hasLegacyFB) {
    return false;
  }
  
  return true;
};

// Create schema with refinement
export const createCustomsClearingCostSchema = customsClearingCostBaseSchema.refine(
  validateCostFields,
  {
    message: 'At least one cost field must be specified (original amount or extra cost). For legacy fields: either company or final beneficiary should pay, not both.',
    path: ['original_clearing_amount'],
  }
);

// Update schema - more lenient, only validates if cost fields are actually being changed
export const updateCustomsClearingCostSchema = customsClearingCostBaseSchema.partial();

// Query filters schema
export const customsClearingCostFiltersSchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  
  // Sorting
  sort_by: z.enum([
    'file_number',
    'invoice_date',
    'total_clearing_cost',
    'clearance_type',
    'clearance_category',
    'payment_status',
    'created_at',
  ]).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  
  // Filters
  file_number: z.string().optional(),
  shipment_id: z.string().uuid().optional(),
  bol_number: z.string().optional(),
  invoice_number: z.string().optional(),
  client_name: z.string().optional(),
  clearance_type: z.string().optional(), // Free text filter
  clearance_category: z.enum(['transit', 'domestic', 'custom_clearance']).optional(), // Shipment clearance category
  payment_status: z.enum(['pending', 'paid', 'partial']).optional(),
  destination: z.string().optional(), // Filter by final destination
  
  // Date range
  invoice_date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  invoice_date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  
  // Search
  search: z.string().optional(), // Search across file_number, bol_number, invoice_number, client_name
});

// Export filters schema
export const exportCustomsClearingCostsSchema = customsClearingCostFiltersSchema.omit({
  page: true,
  limit: true,
});

// ID parameter schema
export const customsClearingCostIdSchema = z.object({
  id: z.string().uuid('Invalid customs clearing cost ID'),
});

// Pending clearances filters schema
export const pendingClearancesFiltersSchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  
  // Sorting
  sort_by: z.enum([
    'sn',
    'product_text',
    'customs_clearance_date',
    'weight_ton',
    'container_count',
    'eta',
    'pol_name',
    'pod_name',
    'clearance_category',
  ]).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  
  // Filters
  clearance_date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  clearance_date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  clearance_category: z.enum(['transit', 'domestic', 'custom_clearance']).optional(), // Shipment clearance category
  pod_name: z.string().optional(), // Filter by port of discharge
  
  // Search
  search: z.string().optional(), // Search across sn, product_text
});

// Schema for creating cost from pending shipment
export const createCostFromPendingSchema = z.object({
  shipment_id: z.string().uuid('Shipment ID is required'),
  file_number: z.string().max(100).optional().nullable(), // Custom file number (auto-populated from SN)
  
  // Required cost fields
  original_clearing_amount: z.number().min(0, 'Original clearing amount must be non-negative').optional().nullable(),
  extra_cost_amount: z.number().min(0, 'Extra cost amount must be non-negative').optional().nullable(),
  extra_cost_description: z.string().optional().nullable(),
  
  // Optional fields
  clearance_type: z.string().max(100).optional().nullable(),
  payment_status: z.enum(['pending', 'paid', 'partial']).default('pending'),
  bol_number: z.string().max(100).optional().nullable(),
  car_plate: z.string().max(200).optional().nullable(),
  cost_responsibility: z.string().max(200).optional().nullable(),
  transaction_type: z.string().max(200).optional().nullable(),
  goods_type: z.string().max(300).optional().nullable(),
  containers_cars_count: z.string().max(100).optional().nullable(),
  goods_weight: z.string().max(100).optional().nullable(),
  cost_description: z.string().optional().nullable(),
  client_name: z.string().max(500).optional().nullable(),
  invoice_amount: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).default('USD'),
  invoice_number: z.string().max(100).optional().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.date()).optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    const hasOriginalAmount = data.original_clearing_amount !== null && 
                              data.original_clearing_amount !== undefined && 
                              data.original_clearing_amount > 0;
    const hasExtraCost = data.extra_cost_amount !== null && 
                         data.extra_cost_amount !== undefined && 
                         data.extra_cost_amount > 0;
    return hasOriginalAmount || hasExtraCost;
  },
  {
    message: 'At least one cost field must be specified (original amount or extra cost)',
    path: ['original_clearing_amount'],
  }
);

// Type exports
export type CreateCustomsClearingCostInput = z.infer<typeof createCustomsClearingCostSchema>;
export type UpdateCustomsClearingCostInput = z.infer<typeof updateCustomsClearingCostSchema>;
export type CustomsClearingCostFilters = z.infer<typeof customsClearingCostFiltersSchema>;
export type ExportCustomsClearingCostsFilters = z.infer<typeof exportCustomsClearingCostsSchema>;
export type PendingClearancesFilters = z.infer<typeof pendingClearancesFiltersSchema>;
export type CreateCostFromPendingInput = z.infer<typeof createCostFromPendingSchema>;

