/**
 * Antrepo (Customs Warehouse) Validation Schemas
 */

import { z } from 'zod';

// ============================================================
// LOT SCHEMAS
// ============================================================

export const createLotSchema = z.object({
  antrepo_id: z.string().uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  name_ar: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  capacity_mt: z.number().positive().optional(),
  lot_type: z.enum(['standard', 'cold_storage', 'hazmat', 'outdoor']).default('standard'),
  sort_order: z.number().int().optional(),
});

export const updateLotSchema = createLotSchema.partial().omit({ antrepo_id: true });

export const lotIdSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// INVENTORY SCHEMAS
// ============================================================

export const createInventorySchema = z.object({
  shipment_id: z.string().uuid().optional(),
  shipment_line_id: z.string().uuid().optional(),
  lot_id: z.string().uuid(),
  entry_date: z.string().optional(), // DATE string
  expected_exit_date: z.string().optional(),
  entry_declaration_no: z.string().max(100).optional(),
  // Legacy field (for backward compatibility)
  original_quantity_mt: z.number().positive().optional(),
  quantity_bags: z.number().int().nonnegative().optional(),
  quantity_containers: z.number().int().nonnegative().optional(),
  // Dual Stock Fields - Customs (from paperwork)
  customs_quantity_mt: z.number().positive().optional(),
  customs_bags: z.number().int().nonnegative().optional(),
  // Dual Stock Fields - Actual (after weighing/counting)
  actual_quantity_mt: z.number().positive().optional(),
  actual_bags: z.number().int().nonnegative().optional(),
  // Discrepancy notes (optional explanation for significant differences)
  discrepancy_notes: z.string().max(2000).optional(),
  // Product info
  product_text: z.string().max(500).optional(),
  product_gtip: z.string().max(20).optional(),
  origin_country: z.string().max(100).optional(),
  is_third_party: z.boolean().default(false),
  third_party_owner: z.string().max(200).optional(),
  third_party_contact: z.string().max(200).optional(),
  third_party_ref: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateInventorySchema = z.object({
  lot_id: z.string().uuid().optional(),
  expected_exit_date: z.string().optional(),
  entry_declaration_no: z.string().max(100).optional(),
  product_gtip: z.string().max(20).optional(),
  // Dual Stock Fields can be updated if corrections needed
  customs_quantity_mt: z.number().positive().optional(),
  customs_bags: z.number().int().nonnegative().optional(),
  actual_quantity_mt: z.number().positive().optional(),
  actual_bags: z.number().int().nonnegative().optional(),
  discrepancy_notes: z.string().max(2000).optional(),
  is_third_party: z.boolean().optional(),
  third_party_owner: z.string().max(200).optional(),
  third_party_contact: z.string().max(200).optional(),
  third_party_ref: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const inventoryIdSchema = z.object({
  id: z.string().uuid(),
});

export const transferInventorySchema = z.object({
  target_lot_id: z.string().uuid(),
  quantity_mt: z.number().positive(),
  notes: z.string().max(2000).optional(),
});

// ============================================================
// EXIT SCHEMAS
// ============================================================

const baseExitSchema = z.object({
  inventory_id: z.string().uuid(),
  exit_date: z.string().optional(), // DATE string
  // Actual exit quantities (physical amount being moved)
  quantity_mt: z.number().positive(),
  quantity_bags: z.number().int().nonnegative().optional(),
  // Customs exit quantities (paperwork/declared amount for customs)
  // If not provided, defaults to same as actual quantities
  customs_quantity_mt: z.number().positive().optional(),
  customs_quantity_bags: z.number().int().nonnegative().optional(),
  declaration_no: z.string().max(100).optional(),
  declaration_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const createTransitExitSchema = baseExitSchema.extend({
  exit_type: z.literal('transit'),
  border_crossing_id: z.string().uuid().optional(),
  delivery_id: z.string().uuid().optional(),
  transit_destination: z.string().max(200).optional(),
});

export const createPortExitSchema = baseExitSchema.extend({
  exit_type: z.literal('port'),
  destination_port_id: z.string().uuid().optional(),
  vessel_name: z.string().max(200).optional(),
  bl_no: z.string().max(100).optional(),
  export_country: z.string().max(100).optional(),
});

export const createDomesticExitSchema = baseExitSchema.extend({
  exit_type: z.literal('domestic'),
  beyaname_no: z.string().max(100).optional(),
  beyaname_date: z.string().optional(),
  tax_amount: z.number().nonnegative().optional(),
  tax_currency: z.string().max(3).default('TRY'),
  customs_clearing_cost_id: z.string().uuid().optional(),
});

export const createExitSchema = z.discriminatedUnion('exit_type', [
  createTransitExitSchema,
  createPortExitSchema,
  createDomesticExitSchema,
]);

export const exitIdSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// HANDLING ACTIVITY SCHEMAS
// ============================================================

export const createHandlingActivitySchema = z.object({
  inventory_id: z.string().uuid(),
  activity_code: z.string().min(2).max(2), // '01' to '19'
  activity_name: z.string().max(200),
  activity_name_ar: z.string().max(200).optional(),
  performed_date: z.string().optional(), // DATE string
  performed_by_user_id: z.string().uuid().optional(),
  customs_permission_ref: z.string().max(100).optional(),
  quantity_affected_mt: z.number().nonnegative().optional(),
  before_description: z.string().max(1000).optional(),
  after_description: z.string().max(1000).optional(),
  gtip_changed: z.boolean().default(false),
  old_gtip: z.string().max(20).optional(),
  new_gtip: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const handlingIdSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// STORAGE FEE SCHEMAS
// ============================================================

export const createStorageFeeSchema = z.object({
  inventory_id: z.string().uuid(),
  fee_period_start: z.string(), // DATE string
  fee_period_end: z.string(), // DATE string
  rate_per_day_mt: z.number().nonnegative().optional(),
  quantity_mt: z.number().positive().optional(),
  total_amount: z.number().nonnegative(),
  currency: z.string().max(3).default('USD'),
  invoice_no: z.string().max(100).optional(),
  invoice_date: z.string().optional(),
  payment_status: z.enum(['pending', 'invoiced', 'paid']).default('pending'),
  notes: z.string().max(2000).optional(),
});

export const updateStorageFeeSchema = z.object({
  invoice_no: z.string().max(100).optional(),
  invoice_date: z.string().optional(),
  payment_status: z.enum(['pending', 'invoiced', 'paid']).optional(),
  payment_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const feeIdSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// FILTER SCHEMAS
// ============================================================

export const inventoryFiltersSchema = z.object({
  lot_id: z.string().uuid().optional(),
  antrepo_id: z.string().uuid().optional(),
  status: z.enum(['in_stock', 'partial_exit', 'exited', 'transferred']).optional(),
  is_third_party: z.string().transform(v => v === 'true').optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export const exitsFiltersSchema = z.object({
  inventory_id: z.string().uuid().optional(),
  exit_type: z.enum(['transit', 'port', 'domestic']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export const activityLogFiltersSchema = z.object({
  antrepo_id: z.string().uuid().optional(),
  lot_id: z.string().uuid().optional(),
  activity_type: z.string().optional(), // 'entry', 'exit_transit', 'exit_port', 'exit_domestic', 'handling'
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

// Type exports
export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type TransferInventoryInput = z.infer<typeof transferInventorySchema>;
export type CreateExitInput = z.infer<typeof createExitSchema>;
export type CreateHandlingActivityInput = z.infer<typeof createHandlingActivitySchema>;
export type CreateStorageFeeInput = z.infer<typeof createStorageFeeSchema>;
export type UpdateStorageFeeInput = z.infer<typeof updateStorageFeeSchema>;
