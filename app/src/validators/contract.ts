/**
 * Contract Validation Schemas
 * Uses Zod for runtime type validation and schema parsing
 */

import { z } from 'zod';

// ========== CONTRACT LINE SCHEMA ==========
// Updated to accept the actual fields from the wizard (type_of_goods, quantity_mt, etc.)

export const ContractLineSchema = z.object({
  // Product identification - either product_id OR type_of_goods
  product_id: z.string().uuid('Invalid product UUID').optional().nullable(),
  type_of_goods: z.string().optional().nullable(),
  product_name: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  trademark: z.string().optional().nullable(),
  
  // Packaging
  kind_of_packages: z.string().optional().nullable(),
  number_of_packages: z.number().optional().nullable(),
  package_size: z.number().optional().nullable(),
  package_size_unit: z.string().optional().nullable(),
  unit_size: z.number().positive().optional().nullable(),
  
  // Quantity - either planned_qty OR quantity_mt
  planned_qty: z.number().positive('Planned quantity must be positive').optional().nullable(),
  quantity_mt: z.number().optional().nullable(),
  uom: z.string().optional().nullable().default('ton'),
  
  // Pricing
  pricing_method: z.string().optional().nullable(),
  unit_price: z.number().nonnegative('Unit price must be non-negative').optional().nullable(),
  rate_usd_per_mt: z.number().optional().nullable(),
  amount_usd: z.number().optional().nullable(),
  
  // Other
  tolerance_pct: z.number().min(0).max(100).optional().nullable(),
  marks: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  extra_json: z.record(z.any()).optional().nullable(),
});

export type ContractLineInput = z.infer<typeof ContractLineSchema>;

// ========== CONTRACT BASE SCHEMA ==========

const ContractBaseSchema = z.object({
  contract_no: z.string()
    .min(1, 'Contract number is required')
    .max(100, 'Contract number too long')
    .regex(/^[A-Z0-9\-_\/\.\s]+$/i, 'Contract number must be alphanumeric (letters, numbers, dashes, underscores, slashes, dots, spaces allowed)'),
  
  // Accept either company IDs or names
  buyer_company_id: z.string().uuid('Invalid buyer company UUID').optional(),
  buyer_company_name: z.string().optional(),
  seller_company_id: z.string().uuid('Invalid seller company UUID').optional(),
  seller_company_name: z.string().optional(),
  
  // Direction and subject
  direction: z.enum(['incoming', 'outgoing']).default('incoming'),
  subject: z.string().max(500, 'Subject too long').optional(),
  
  incoterm_code: z.enum([
    'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',  // Any mode
    'FAS', 'FOB', 'CFR', 'CIF',  // Sea & inland waterway
  ]).optional(),
  
  currency_code: z.string()
    .length(3, 'Currency code must be 3 characters (ISO 4217)')
    .default('USD'),
  
  signed_at: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .or(z.date())
    .optional(),
  
  valid_from: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .or(z.date())
    .optional(),
  
  valid_to: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .or(z.date())
    .optional(),
  
  status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'FULFILLED', 'COMPLETED', 'CANCELLED'])
    .default('ACTIVE'),
  
  notes: z.string().max(5000, 'Notes too long').optional(),
  extra_json: z.record(z.any()).optional(),
  
  // Optional: include lines directly in create request
  lines: z.array(ContractLineSchema).optional(),
  
  // Nested objects (stored in extra_json)
  commercial_parties: z.record(z.any()).optional(),
  shipping: z.record(z.any()).optional(),
  terms: z.record(z.any()).optional(),
  banking_docs: z.record(z.any()).optional(),
});

// ========== CONTRACT CREATE SCHEMA ==========

export const ContractCreateSchema = ContractBaseSchema
  .refine(
    (data) => data.buyer_company_id || data.buyer_company_name,
    {
      message: 'Buyer company ID or name is required',
      path: ['buyer_company_id'],
    }
  )
  .refine(
    (data) => data.seller_company_id || data.seller_company_name,
    {
      message: 'Seller company ID or name is required',
      path: ['seller_company_id'],
    }
  )
  .refine(
    (data) => {
      // If both have IDs, check IDs are different
      if (data.buyer_company_id && data.seller_company_id) {
        return data.buyer_company_id !== data.seller_company_id;
      }
      // If both have names, check names are different
      if (data.buyer_company_name && data.seller_company_name) {
        return data.buyer_company_name.toLowerCase() !== data.seller_company_name.toLowerCase();
      }
      // Otherwise, they're different (one has ID, other has name)
      return true;
    },
    {
      message: 'Buyer and seller cannot be the same company',
      path: ['seller_company_id'],
    }
  );

export type ContractCreateInput = z.infer<typeof ContractCreateSchema>;

// ========== CONTRACT UPDATE SCHEMA ==========

export const ContractUpdateSchema = ContractBaseSchema.partial().extend({
  id: z.string().uuid('Invalid contract UUID').optional(),
});

export type ContractUpdateInput = z.infer<typeof ContractUpdateSchema>;

// ========== CONTRACT QUERY FILTERS SCHEMA ==========

export const ContractQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  
  contract_no: z.string().optional(),
  buyer_company_id: z.string().uuid().optional(),
  seller_company_id: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'FULFILLED', 'COMPLETED', 'CANCELLED']).optional(),
  currency_code: z.string().length(3).optional(),
  product: z.string().optional(),  // Filter by type of goods/product
  
  search: z.string().optional(),  // Universal search
  
  sortBy: z.enum(['contract_no', 'signed_at', 'valid_from', 'valid_to', 'created_at', 'updated_at'])
    .default('created_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type ContractQueryInput = z.infer<typeof ContractQuerySchema>;

// ========== PAYMENT SCHEDULE SCHEMA ==========

export const PaymentScheduleSchema = z.object({
  contract_id: z.string().uuid('Invalid contract UUID'),
  seq: z.number().int().positive('Sequence must be a positive integer'),
  
  basis: z.enum([
    'ON_BOOKING',
    'ON_BL',
    'ON_ARRIVAL',
    'ON_DELIVERY',
    'DEFERRED',
    'CUSTOM',
  ], {
    errorMap: () => ({ message: 'Invalid payment basis' }),
  }),
  
  days_after: z.number().int().nonnegative().optional(),
  
  // Either percent or amount, not both
  percent: z.number().min(0).max(100).optional(),
  amount: z.number().nonnegative().optional(),
  
  is_deferred: z.boolean().default(false),
  
  notes: z.string().max(1000).optional(),
  extra_json: z.record(z.any()).optional(),
})
.refine(
  (data) => (data.percent !== undefined) !== (data.amount !== undefined),
  {
    message: 'Must specify either percent OR amount, not both',
    path: ['amount'],
  }
);

export type PaymentScheduleInput = z.infer<typeof PaymentScheduleSchema>;

// ========== VALIDATION HELPERS ==========

/**
 * Validate that total payment schedule percentages don't exceed 100%
 */
export function validatePaymentScheduleTotal(schedules: PaymentScheduleInput[]): boolean {
  const totalPercent = schedules
    .filter(s => s.percent !== undefined)
    .reduce((sum, s) => sum + (s.percent || 0), 0);
  
  return totalPercent <= 100;
}

/**
 * Validate contract date ranges
 */
export function validateContractDates(contract: ContractCreateInput | ContractUpdateInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (contract.valid_from && contract.valid_to) {
    const from = new Date(contract.valid_from);
    const to = new Date(contract.valid_to);
    
    if (from > to) {
      errors.push('valid_from must be before valid_to');
    }
  }
  
  if (contract.signed_at && contract.valid_from) {
    const signed = new Date(contract.signed_at);
    const from = new Date(contract.valid_from);
    
    if (signed > from) {
      errors.push('Contract cannot be signed after its validity start date');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

