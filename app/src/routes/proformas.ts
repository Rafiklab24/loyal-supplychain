/**
 * Proforma Invoices API Routes
 * Handles CRUD operations for proforma invoices and their lines
 */

import { Router } from 'express';
import { pool } from '../db/client';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  ProformaCreateSchema,
  ProformaUpdateSchema,
  ProformaQuerySchema,
} from '../validators/proforma';
import { withTransaction } from '../utils/transactions';

const router = Router();

// ========== GET /api/proformas - List proforma invoices ==========

router.get('/', validateQuery(ProformaQuerySchema), async (req, res, next) => {
  try {
    const {
      page,
      limit,
      number,
      contract_id,
      status,
      currency_code,
      search,
      sortBy,
      sortDir,
    } = req.query as any;

    // Build query
    let query = `
      SELECT 
        p.*,
        c.contract_no,
        c.buyer_company_id,
        c.seller_company_id,
        b.name as buyer_name,
        s.name as seller_name,
        (SELECT COUNT(*) FROM logistics.proforma_lines WHERE proforma_id = p.id) as line_count,
        (
          SELECT SUM(pl.qty * pl.unit_price) 
          FROM logistics.proforma_lines pl 
          WHERE pl.proforma_id = p.id
        ) as total_value
      FROM logistics.proforma_invoices p
      LEFT JOIN logistics.contracts c ON p.contract_id = c.id
      LEFT JOIN master_data.companies b ON c.buyer_company_id = b.id
      LEFT JOIN master_data.companies s ON c.seller_company_id = s.id
      WHERE p.is_deleted = false
    `;
    const params: any[] = [];

    // Apply filters
    if (number) {
      const normalized = (number as string).replace(/[-_\s]/g, '').toLowerCase();
      params.push(`%${normalized}%`);
      const normalizedParam = params.length;
      params.push(`%${number}%`);
      const originalParam = params.length;
      query += ` AND (REPLACE(REPLACE(REPLACE(LOWER(p.number), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR p.number ILIKE $${originalParam})`;
    }

    if (contract_id) {
      params.push(contract_id);
      query += ` AND p.contract_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    }

    if (currency_code) {
      params.push(currency_code);
      query += ` AND p.currency_code = $${params.length}`;
    }

    if (search) {
      const normalized = (search as string).replace(/[-_\s]/g, '').toLowerCase();
      params.push(`%${normalized}%`);
      const normalizedParam = params.length;
      params.push(`%${search}%`);
      const originalParam = params.length;
      query += ` AND (
        REPLACE(REPLACE(REPLACE(LOWER(p.number), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(p.notes), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(c.contract_no), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        p.number ILIKE $${originalParam} OR
        p.notes ILIKE $${originalParam} OR
        c.contract_no ILIKE $${originalParam}
      )`;
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Apply sorting
    query += ` ORDER BY p.${sortBy} ${sortDir}`;

    // Apply pagination
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    // Execute query
    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/proformas/:id - Get single proforma invoice ==========

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get proforma with contract and company details
    const proformaResult = await pool.query(
      `
      SELECT 
        p.*,
        c.contract_no,
        c.buyer_company_id,
        c.seller_company_id,
        c.incoterm_code,
        b.name as buyer_name,
        b.country as buyer_country,
        s.name as seller_name,
        s.country as seller_country
      FROM logistics.proforma_invoices p
      LEFT JOIN logistics.contracts c ON p.contract_id = c.id
      LEFT JOIN master_data.companies b ON c.buyer_company_id = b.id
      LEFT JOIN master_data.companies s ON c.seller_company_id = s.id
      WHERE p.id = $1 AND p.is_deleted = false
      `,
      [id]
    );

    if (proformaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proforma invoice not found' });
    }

    const proforma = proformaResult.rows[0];

    // Get proforma lines
    const linesResult = await pool.query(
      `
      SELECT 
        pl.*,
        p.name as product_name,
        p.hs_code,
        p.category,
        (pl.qty * pl.unit_price) as line_total
      FROM logistics.proforma_lines pl
      LEFT JOIN master_data.products p ON pl.product_id = p.id
      WHERE pl.proforma_id = $1
      ORDER BY pl.created_at
      `,
      [id]
    );

    proforma.lines = linesResult.rows;
    proforma.total_value = linesResult.rows.reduce(
      (sum: number, line: any) => sum + parseFloat(line.line_total || 0),
      0
    );

    res.json(proforma);
  } catch (error) {
    next(error);
  }
});

// ========== POST /api/proformas - Create proforma invoice ==========

router.post('/', validateBody(ProformaCreateSchema), async (req, res, next) => {
  try {
    const {
      number,
      contract_id,
      issued_at,
      valid_until,
      currency_code,
      status,
      notes,
      extra_json,
      lines,
    } = req.body;

    const proforma = await withTransaction(async (client) => {
      // Verify contract exists
      const contractCheck = await client.query(
        'SELECT id, currency_code FROM logistics.contracts WHERE id = $1 AND is_deleted = false',
        [contract_id]
      );

      if (contractCheck.rows.length === 0) {
        return null; // Will be handled below
      }

      // Use contract's currency if not specified
      const finalCurrency = currency_code || contractCheck.rows[0].currency_code || 'USD';

      // Insert proforma invoice
      const proformaResult = await client.query(
        `
        INSERT INTO logistics.proforma_invoices (
          number, contract_id, issued_at, valid_until,
          currency_code, status, notes, extra_json, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          number,
          contract_id,
          issued_at,
          valid_until,
          finalCurrency,
          status || 'DRAFT',
          notes,
          JSON.stringify(extra_json || {}),
          'api', // TODO: Replace with actual user from auth
        ]
      );

      const proforma = proformaResult.rows[0];

      // Insert proforma lines if provided
      if (lines && lines.length > 0) {
        for (const line of lines) {
          await client.query(
            `
            INSERT INTO logistics.proforma_lines (
              proforma_id, product_id, unit_size, qty,
              unit_price, notes, extra_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              proforma.id,
              line.product_id,
              line.unit_size,
              line.qty,
              line.unit_price,
              line.notes,
              JSON.stringify(line.extra_json || {}),
            ]
          );
        }
      }

      return proforma;
    });

    if (!proforma) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Fetch complete proforma with lines
    const completeProforma = await pool.query(
      `
      SELECT 
        p.*,
        c.contract_no
      FROM logistics.proforma_invoices p
      LEFT JOIN logistics.contracts c ON p.contract_id = c.id
      WHERE p.id = $1
      `,
      [proforma.id]
    );

    const linesResult = await pool.query(
      `
      SELECT pl.*, p.name as product_name
      FROM logistics.proforma_lines pl
      LEFT JOIN master_data.products p ON pl.product_id = p.id
      WHERE pl.proforma_id = $1
      `,
      [proforma.id]
    );

    const result = { ...completeProforma.rows[0], lines: linesResult.rows };

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// ========== PUT /api/proformas/:id - Update proforma invoice ==========

router.put('/:id', validateBody(ProformaUpdateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Build dynamic UPDATE query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'number',
      'contract_id',
      'issued_at',
      'valid_until',
      'currency_code',
      'status',
      'notes',
      'extra_json',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(
          field === 'extra_json' ? JSON.stringify(updateData[field]) : updateData[field]
        );
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add updated_at and updated_by
    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${paramIndex}`);
    values.push('api'); // TODO: Replace with actual user from auth
    paramIndex++;

    // Add WHERE clause
    values.push(id);

    const query = `
      UPDATE logistics.proforma_invoices
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND is_deleted = false
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proforma invoice not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/proformas/:id/lines - Get proforma lines ==========

router.get('/:id/lines', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        pl.*,
        p.name as product_name,
        p.hs_code,
        p.category,
        p.uom as product_uom,
        (pl.qty * pl.unit_price) as line_total
      FROM logistics.proforma_lines pl
      LEFT JOIN master_data.products p ON pl.product_id = p.id
      WHERE pl.proforma_id = $1
      ORDER BY pl.created_at
      `,
      [id]
    );

    const total_value = result.rows.reduce(
      (sum: number, line: any) => sum + parseFloat(line.line_total || 0),
      0
    );

    res.json({
      proforma_id: id,
      count: result.rows.length,
      lines: result.rows,
      total_value,
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/proformas/contract/:contractId - Get proformas by contract ==========

router.get('/contract/:contractId', async (req, res, next) => {
  try {
    const { contractId } = req.params;

    const result = await pool.query(
      `
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM logistics.proforma_lines WHERE proforma_id = p.id) as line_count,
        (
          SELECT SUM(pl.qty * pl.unit_price) 
          FROM logistics.proforma_lines pl 
          WHERE pl.proforma_id = p.id
        ) as total_value
      FROM logistics.proforma_invoices p
      WHERE p.contract_id = $1 AND p.is_deleted = false
      ORDER BY p.created_at DESC
      `,
      [contractId]
    );

    res.json({
      contract_id: contractId,
      count: result.rows.length,
      proformas: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

