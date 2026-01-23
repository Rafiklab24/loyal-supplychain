/**
 * Elleçleme (Handling) Management Validation Schemas
 */

import { z } from 'zod';

// ============================================================
// ENUMS
// ============================================================

export const elleclemeStatusEnum = z.enum([
  'draft',
  'pending_permit',
  'approved',
  'in_progress',
  'pending_confirmation', // Ragıp completed, waiting for Hamza to confirm
  'completed',
  'cancelled',
  'rejected',
]);

export const permitStatusEnum = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'expired',
]);

export const costTypeEnum = z.enum([
  'labor',
  'materials',
  'external_service',
  'equipment',
  'lab_testing',
  'other',
]);

export const documentTypeEnum = z.enum([
  'permit_application',
  'permit_approval',
  'photo_before',
  'photo_after',
  'lab_report',
  'tutanak',
  'other',
]);

export const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

// Package type enum for validation
export const packageTypeEnum = z.enum(['bag', 'box', 'bundle', 'pallet', 'bulk', 'container', 'other']);

// ============================================================
// REQUEST SCHEMAS
// ============================================================

export const createRequestSchema = z.object({
  inventory_id: z.string().uuid(),
  activity_code: z.string().min(2).max(2), // '01' to '19'
  priority: priorityEnum.default('normal'),
  quantity_mt: z.number().positive().optional(),
  quantity_bags: z.number().int().nonnegative().optional(),
  reason: z.string().max(1000).optional(),
  description: z.string().max(2000).optional(),
  customer_requirement: z.string().max(1000).optional(),
  original_gtip: z.string().max(20).optional(),
  planned_execution_date: z.string().optional(), // DATE string
  // Before/After descriptions
  before_description: z.string().max(2000).optional(),
  after_description: z.string().max(2000).optional(),
  // GTİP change tracking
  new_gtip: z.string().max(20).optional(),
  gtip_changed: z.boolean().default(false),
  // BEFORE packaging details
  before_package_type: packageTypeEnum.optional(),
  before_weight_per_package: z.number().positive().optional(),
  before_pieces_per_package: z.number().int().positive().optional(),
  before_package_count: z.number().int().positive().optional(),
  before_packages_per_pallet: z.number().int().positive().optional(),
  before_total_pallets: z.number().int().nonnegative().optional(),
  // AFTER packaging details
  after_package_type: packageTypeEnum.optional(),
  after_weight_per_package: z.number().positive().optional(),
  after_pieces_per_package: z.number().int().positive().optional(),
  after_package_count: z.number().int().positive().optional(),
  after_packages_per_pallet: z.number().int().positive().optional(),
  after_total_pallets: z.number().int().nonnegative().optional(),
});

export const updateRequestSchema = z.object({
  activity_code: z.string().min(2).max(2).optional(),
  priority: priorityEnum.optional(),
  quantity_mt: z.number().positive().optional(),
  quantity_bags: z.number().int().nonnegative().optional(),
  reason: z.string().max(1000).optional(),
  description: z.string().max(2000).optional(),
  customer_requirement: z.string().max(1000).optional(),
  original_gtip: z.string().max(20).optional(),
  planned_execution_date: z.string().optional(),
});

export const submitForPermitSchema = z.object({
  permit_type: z.enum(['standard', 'special', 'blanket']).default('standard'),
  customs_office: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const startExecutionSchema = z.object({
  actual_start_date: z.string().optional(), // DATE string, defaults to today
  execution_notes: z.string().max(2000).optional(),
});

export const completeRequestSchema = z.object({
  before_description: z.string().max(2000).optional(),
  after_description: z.string().max(2000).optional(),
  new_gtip: z.string().max(20).optional(),
  gtip_changed: z.boolean().default(false),
  actual_completion_date: z.string().optional(), // DATE string, defaults to today
  execution_notes: z.string().max(2000).optional(),
  // BEFORE packaging details
  before_package_type: packageTypeEnum.optional(),
  before_weight_per_package: z.number().positive().optional(),
  before_pieces_per_package: z.number().int().positive().optional(),
  before_package_count: z.number().int().positive().optional(),
  before_packages_per_pallet: z.number().int().positive().optional(),
  before_total_pallets: z.number().int().nonnegative().optional(),
  // AFTER packaging details
  after_package_type: packageTypeEnum.optional(),
  after_weight_per_package: z.number().positive().optional(),
  after_pieces_per_package: z.number().int().positive().optional(),
  after_package_count: z.number().int().positive().optional(),
  after_packages_per_pallet: z.number().int().positive().optional(),
  after_total_pallets: z.number().int().nonnegative().optional(),
});

export const cancelRequestSchema = z.object({
  cancelled_reason: z.string().max(1000),
});

export const pickupRequestSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const confirmResultSchema = z.object({
  confirmation_notes: z.string().max(2000).optional(),
});

export const rejectResultSchema = z.object({
  rejection_reason: z.string().max(1000),
});

export const requestIdSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// PERMIT SCHEMAS
// ============================================================

export const createPermitSchema = z.object({
  request_id: z.string().uuid(),
  permit_type: z.enum(['standard', 'special', 'blanket']).default('standard'),
  application_date: z.string().optional(), // DATE string
  application_ref: z.string().max(100).optional(),
  customs_office: z.string().max(200).optional(),
  customs_officer_name: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const updatePermitSchema = z.object({
  application_date: z.string().optional(),
  application_ref: z.string().max(100).optional(),
  customs_office: z.string().max(200).optional(),
  customs_officer_name: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const approvePermitSchema = z.object({
  approval_date: z.string().optional(), // DATE string, defaults to today
  approval_ref: z.string().max(100),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const rejectPermitSchema = z.object({
  rejection_date: z.string().optional(), // DATE string, defaults to today
  rejection_reason: z.string().max(1000),
});

export const permitIdSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// COST SCHEMAS
// ============================================================

export const createCostSchema = z.object({
  request_id: z.string().uuid(),
  cost_type: costTypeEnum,
  description: z.string().max(500),
  description_ar: z.string().max(500).optional(),
  description_tr: z.string().max(500).optional(),
  amount: z.number().positive(),
  currency: z.string().max(3).default('TRY'),
  // Labor-specific fields
  labor_hours: z.number().positive().optional(),
  labor_rate: z.number().positive().optional(),
  worker_count: z.number().int().positive().optional(),
  // Material-specific fields
  material_quantity: z.number().positive().optional(),
  material_unit: z.string().max(50).optional(),
  material_unit_price: z.number().positive().optional(),
  // Customs value impact
  include_in_customs_value: z.boolean().default(false),
  customs_value_justification: z.string().max(1000).optional(),
  // External vendor
  vendor_name: z.string().max(200).optional(),
  invoice_no: z.string().max(100).optional(),
  invoice_date: z.string().optional(),
});

export const updateCostSchema = createCostSchema.partial().omit({ request_id: true });

export const costIdSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// DOCUMENT SCHEMAS
// ============================================================

export const createDocumentSchema = z.object({
  request_id: z.string().uuid(),
  document_type: documentTypeEnum,
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  taken_at: z.string().optional(), // For photos
  location_description: z.string().max(500).optional(),
});

export const documentIdSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// FILTER SCHEMAS
// ============================================================

export const requestFiltersSchema = z.object({
  inventory_id: z.string().uuid().optional(),
  status: elleclemeStatusEnum.optional(),
  activity_code: z.string().optional(),
  priority: priorityEnum.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
  lot_id: z.string().uuid().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export const permitFiltersSchema = z.object({
  request_id: z.string().uuid().optional(),
  status: permitStatusEnum.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export const costFiltersSchema = z.object({
  request_id: z.string().uuid().optional(),
  cost_type: costTypeEnum.optional(),
  include_in_customs_value: z.string().transform(v => v === 'true').optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export const reportFiltersSchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  activity_code: z.string().optional(),
  status: elleclemeStatusEnum.optional(),
  lot_id: z.string().uuid().optional(),
  inventory_id: z.string().uuid().optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ElleclemeStatus = z.infer<typeof elleclemeStatusEnum>;
export type PermitStatus = z.infer<typeof permitStatusEnum>;
export type CostType = z.infer<typeof costTypeEnum>;
export type DocumentType = z.infer<typeof documentTypeEnum>;
export type Priority = z.infer<typeof priorityEnum>;
export type PackageType = z.infer<typeof packageTypeEnum>;

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type SubmitForPermitInput = z.infer<typeof submitForPermitSchema>;
export type StartExecutionInput = z.infer<typeof startExecutionSchema>;
export type CompleteRequestInput = z.infer<typeof completeRequestSchema>;
export type CancelRequestInput = z.infer<typeof cancelRequestSchema>;
export type PickupRequestInput = z.infer<typeof pickupRequestSchema>;
export type ConfirmResultInput = z.infer<typeof confirmResultSchema>;
export type RejectResultInput = z.infer<typeof rejectResultSchema>;

export type CreatePermitInput = z.infer<typeof createPermitSchema>;
export type UpdatePermitInput = z.infer<typeof updatePermitSchema>;
export type ApprovePermitInput = z.infer<typeof approvePermitSchema>;
export type RejectPermitInput = z.infer<typeof rejectPermitSchema>;

export type CreateCostInput = z.infer<typeof createCostSchema>;
export type UpdateCostInput = z.infer<typeof updateCostSchema>;

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export type RequestFilters = z.infer<typeof requestFiltersSchema>;
export type PermitFilters = z.infer<typeof permitFiltersSchema>;
export type CostFilters = z.infer<typeof costFiltersSchema>;
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
