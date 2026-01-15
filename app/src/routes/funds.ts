/**
 * Funds API Routes
 * Handles bank accounts and funds management
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/funds
 * Fetch all active funds/bank accounts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        fund_name,
        fund_type,
        account_number,
        bank_name,
        currency_code,
        current_balance,
        description,
        is_active
      FROM finance.funds
      WHERE is_active = TRUE
      ORDER BY fund_name ASC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching funds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funds',
      message: error.message,
    });
  }
});

/**
 * GET /api/funds/:id
 * Fetch a single fund by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        id,
        fund_name,
        fund_type,
        account_number,
        bank_name,
        currency_code,
        current_balance,
        description,
        is_active,
        created_at,
        updated_at,
        extra_json
      FROM finance.funds
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Fund not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Error fetching fund:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fund',
      message: error.message,
    });
  }
});

/**
 * POST /api/funds
 * Create a new fund
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      fund_name,
      fund_type,
      account_number,
      bank_name,
      currency_code,
      description,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO finance.funds (
        fund_name,
        fund_type,
        account_number,
        bank_name,
        currency_code,
        description
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [fund_name, fund_type, account_number, bank_name, currency_code || 'USD', description]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Fund created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating fund:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create fund',
      message: error.message,
    });
  }
});

/**
 * PUT /api/funds/:id
 * Update an existing fund
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fund_name,
      fund_type,
      account_number,
      bank_name,
      currency_code,
      current_balance,
      description,
      is_active,
    } = req.body;

    const result = await pool.query(
      `UPDATE finance.funds
      SET 
        fund_name = COALESCE($1, fund_name),
        fund_type = COALESCE($2, fund_type),
        account_number = COALESCE($3, account_number),
        bank_name = COALESCE($4, bank_name),
        currency_code = COALESCE($5, currency_code),
        current_balance = COALESCE($6, current_balance),
        description = COALESCE($7, description),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *`,
      [fund_name, fund_type, account_number, bank_name, currency_code, current_balance, description, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Fund not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Fund updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating fund:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update fund',
      message: error.message,
    });
  }
});

/**
 * GET /api/funds/by-currency/:currency
 * Fetch funds by currency code
 */
router.get('/by-currency/:currency', async (req: Request, res: Response) => {
  try {
    const { currency } = req.params;

    const result = await pool.query(
      `SELECT 
        id,
        fund_name,
        fund_type,
        account_number,
        bank_name,
        currency_code,
        current_balance,
        description
      FROM finance.funds
      WHERE currency_code = $1 AND is_active = TRUE
      ORDER BY fund_name ASC`,
      [currency.toUpperCase()]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching funds by currency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funds',
      message: error.message,
    });
  }
});

export default router;

