/**
 * Proforma Invoice Validation Schemas
 * Uses Zod for runtime type validation
 */

import { z } from 'zod';

// ========== PROFORMA LINE SCHEMA ==========

export const ProformaLineSchema = z.object({
  product_id: z.string().uuid('Invalid product UUID'),
  unit_size: z.number().positive().optional(),
  qty: z.number().positive('Quantity must be positive'),
  unit_price: z.number().nonnegative('Unit price must be non-negative'),
  notes: z.string().optional(),
  extra_json: z.record(z.any()).optional(),
});

export type ProformaLineInput = z.infer<typeof ProformaLineSchema>;

// ========== PROFORMA BASE SCHEMA ==========

const ProformaBaseSchema = z.object({
  number: z.string()
    .min(1, 'Proforma number is required')
    .max(100, 'Proforma number too long')
    .regex(/^[A-Z0-9\-_]+$/i, 'Proforma number must be alphanumeric with dashes/underscores'),
  
  contract_id: z.string().uuid('Invalid contract UUID'),
  
  issued_at: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .or(z.date())
    .optional(),
  
  valid_until: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .or(z.date())
    .optional(),
  
  currency_code: z.string()
    .length(3, 'Currency code must be 3 characters (ISO 4217)')
    .default('USD'),
  
  status: z.enum(['DRAFT', 'ISSUED', 'ACCEPTED', 'INVOICED', 'CANCELLED'])
    .default('DRAFT'),
  
  notes: z.string().max(5000, 'Notes too long').optional(),
  extra_json: z.record(z.any()).optional(),
  
  // Optional: include lines directly in create request
  lines: z.array(ProformaLineSchema).optional(),
});

// ========== PROFORMA CREATE SCHEMA ==========

export const ProformaCreateSchema = ProformaBaseSchema.refine(
  (data) => {
    if (data.issued_at && data.valid_until) {
      const issued = new Date(data.issued_at);
      const valid = new Date(data.valid_until);
      return issued <= valid;
    }
    return true;
  },
  {
    message: 'issued_at must be before or equal to valid_until',
    path: ['valid_until'],
  }
);

export type ProformaCreateInput = z.infer<typeof ProformaCreateSchema>;

// ========== PROFORMA UPDATE SCHEMA ==========

export const ProformaUpdateSchema = ProformaBaseSchema.partial().extend({
  id: z.string().uuid('Invalid proforma UUID'),
});

export type ProformaUpdateInput = z.infer<typeof ProformaUpdateSchema>;

// ========== PROFORMA QUERY FILTERS SCHEMA ==========

export const ProformaQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  
  number: z.string().optional(),
  contract_id: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'ACCEPTED', 'INVOICED', 'CANCELLED']).optional(),
  currency_code: z.string().length(3).optional(),
  
  search: z.string().optional(),  // Universal search
  
  sortBy: z.enum(['number', 'issued_at', 'valid_until', 'created_at', 'updated_at'])
    .default('created_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type ProformaQueryInput = z.infer<typeof ProformaQuerySchema>;

// ========== VALIDATION HELPERS ==========

/**
 * Validate proforma line quantities against contract
 */
export function validateProformaQuantities(
  proformaLines: ProformaLineInput[],
  contractLines: Array<{ product_id: string; planned_qty: number; tolerance_pct?: number }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const pLine of proformaLines) {
    const cLine = contractLines.find(c => c.product_id === pLine.product_id);
    
    if (!cLine) {
      errors.push(`Product ${pLine.product_id} not found in contract`);
      continue;
    }
    
    const tolerance = cLine.tolerance_pct || 0;
    const minQty = cLine.planned_qty * (1 - tolerance / 100);
    const maxQty = cLine.planned_qty * (1 + tolerance / 100);
    
    if (pLine.qty < minQty || pLine.qty > maxQty) {
      errors.push(
        `Product ${pLine.product_id} quantity ${pLine.qty} exceeds contract tolerance (${minQty.toFixed(2)} - ${maxQty.toFixed(2)})`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate proforma total value
 */
export function calculateProformaTotal(lines: ProformaLineInput[]): number {
  return lines.reduce((sum, line) => sum + (line.qty * line.unit_price), 0);
}

