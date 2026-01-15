import { z } from 'zod';

/**
 * Schema for recording an IN or OUT transaction
 */
export const recordTransactionSchema = z.object({
  cash_box_id: z.string().uuid('Invalid cash box ID'),
  transaction_type: z.enum(['in', 'out'], {
    errorMap: () => ({ message: 'Transaction type must be "in" or "out"' }),
  }),
  amount: z.number().positive('Amount must be positive'),
  party_name: z.string().min(1, 'Party name is required').max(255),
  description: z.string().max(1000).optional(),
  reference_type: z.enum(['shipment', 'contract', 'invoice']).nullable().optional(),
  reference_id: z.string().uuid().nullable().optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
});

export type RecordTransactionInput = z.infer<typeof recordTransactionSchema>;

/**
 * Schema for transferring between cash boxes
 */
export const transferSchema = z.object({
  from_cash_box_id: z.string().uuid('Invalid source cash box ID'),
  to_cash_box_id: z.string().uuid('Invalid destination cash box ID'),
  from_amount: z.number().positive('Source amount must be positive'),
  to_amount: z.number().positive('Destination amount must be positive'),
  description: z.string().max(1000).optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
}).refine(data => data.from_cash_box_id !== data.to_cash_box_id, {
  message: 'Cannot transfer to the same cash box',
  path: ['to_cash_box_id'],
});

export type TransferInput = z.infer<typeof transferSchema>;

/**
 * Schema for setting/updating opening balance (Admin only)
 */
export const openingBalanceSchema = z.object({
  opening_balance: z.number().min(0, 'Opening balance cannot be negative'),
  opening_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
});

export type OpeningBalanceInput = z.infer<typeof openingBalanceSchema>;

/**
 * Schema for listing transactions with filters
 */
export const listTransactionsSchema = z.object({
  cash_box_id: z.string().uuid().optional(),
  transaction_type: z.enum(['in', 'out', 'transfer_in', 'transfer_out']).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  party_name: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;

