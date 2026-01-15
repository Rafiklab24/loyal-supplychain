import { Router, Response } from 'express';
import { pool } from '../db/client';
import { AuthRequest, authorizeRoles } from '../middleware/auth';
import logger from '../utils/logger';
import {
  recordTransactionSchema,
  transferSchema,
  openingBalanceSchema,
  listTransactionsSchema,
} from '../validators/cashbox';

const router = Router();

// ============================================
// GET /api/cashbox
// List all cash boxes with current balances
// ============================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        name,
        name_ar,
        currency_code,
        opening_balance,
        opening_date,
        is_active,
        total_in,
        total_out,
        current_balance,
        transaction_count,
        last_transaction_date,
        created_at,
        updated_at
      FROM finance.v_cash_box_balances
      ORDER BY 
        CASE currency_code 
          WHEN 'USD' THEN 1 
          WHEN 'EUR' THEN 2 
          WHEN 'TRY' THEN 3 
          ELSE 4 
        END
    `);

    res.json({
      cash_boxes: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching cash boxes:', error);
    res.status(500).json({ error: 'Failed to fetch cash boxes' });
  }
});

// ============================================
// GET /api/cashbox/transactions
// List all transactions with filters
// ============================================
router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const validation = listTransactionsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { cash_box_id, transaction_type, from_date, to_date, party_name, page, limit } = validation.data;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (cash_box_id) {
      conditions.push(`cash_box_id = $${paramIndex++}`);
      params.push(cash_box_id);
    }

    if (transaction_type) {
      conditions.push(`transaction_type = $${paramIndex++}`);
      params.push(transaction_type);
    }

    if (from_date) {
      conditions.push(`transaction_date >= $${paramIndex++}`);
      params.push(from_date);
    }

    if (to_date) {
      conditions.push(`transaction_date <= $${paramIndex++}`);
      params.push(to_date);
    }

    if (party_name) {
      conditions.push(`party_name ILIKE $${paramIndex++}`);
      params.push(`%${party_name}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM finance.v_cash_box_transactions_complete
      ${whereClause}
    `, params);

    // Get paginated results
    const result = await pool.query(`
      SELECT * 
      FROM finance.v_cash_box_transactions_complete
      ${whereClause}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);

    res.json({
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ============================================
// GET /api/cashbox/:id
// Get single cash box with recent transactions
// ============================================
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get cash box with balance
    const boxResult = await pool.query(`
      SELECT * FROM finance.v_cash_box_balances WHERE id = $1
    `, [id]);

    if (boxResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cash box not found' });
    }

    // Get recent transactions (last 20)
    const txnResult = await pool.query(`
      SELECT * FROM finance.v_cash_box_transactions_complete
      WHERE cash_box_id = $1
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT 20
    `, [id]);

    res.json({
      cash_box: boxResult.rows[0],
      recent_transactions: txnResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching cash box:', error);
    res.status(500).json({ error: 'Failed to fetch cash box' });
  }
});

// ============================================
// GET /api/cashbox/:id/transactions
// Get all transactions for a specific cash box
// ============================================
router.get('/:id/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = listTransactionsSchema.safeParse({ ...req.query, cash_box_id: id });
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { transaction_type, from_date, to_date, party_name, page, limit } = validation.data;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['cash_box_id = $1'];
    const params: (string | number)[] = [id];
    let paramIndex = 2;

    if (transaction_type) {
      conditions.push(`transaction_type = $${paramIndex++}`);
      params.push(transaction_type);
    }

    if (from_date) {
      conditions.push(`transaction_date >= $${paramIndex++}`);
      params.push(from_date);
    }

    if (to_date) {
      conditions.push(`transaction_date <= $${paramIndex++}`);
      params.push(to_date);
    }

    if (party_name) {
      conditions.push(`party_name ILIKE $${paramIndex++}`);
      params.push(`%${party_name}%`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM finance.v_cash_box_transactions_complete
      ${whereClause}
    `, params);

    // Get paginated results
    const result = await pool.query(`
      SELECT * 
      FROM finance.v_cash_box_transactions_complete
      ${whereClause}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);

    res.json({
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching cash box transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ============================================
// PUT /api/cashbox/:id/opening-balance
// Set or update opening balance (Admin only)
// ============================================
router.put('/:id/opening-balance', authorizeRoles('Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = openingBalanceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { opening_balance, opening_date } = validation.data;
    const userId = req.user?.id;

    // Check if cash box exists
    const checkResult = await pool.query(
      'SELECT id FROM finance.cash_boxes WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cash box not found' });
    }

    // Update opening balance
    const result = await pool.query(`
      UPDATE finance.cash_boxes
      SET 
        opening_balance = $1,
        opening_date = COALESCE($2, opening_date, CURRENT_DATE),
        updated_by = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [opening_balance, opening_date || null, userId, id]);

    // Log the change
    logger.info(`Opening balance updated for cash box ${id} by user ${userId}: ${opening_balance}`);

    res.json({
      message: 'Opening balance updated successfully',
      cash_box: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating opening balance:', error);
    res.status(500).json({ error: 'Failed to update opening balance' });
  }
});

// ============================================
// POST /api/cashbox/transaction
// Record an IN or OUT transaction
// ============================================
router.post('/transaction', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const validation = recordTransactionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { 
      cash_box_id, 
      transaction_type, 
      amount, 
      party_name, 
      description, 
      reference_type, 
      reference_id,
      transaction_date 
    } = validation.data;
    const userId = req.user?.id;

    await client.query('BEGIN');

    // Get current balance from view
    const balanceResult = await client.query(`
      SELECT current_balance FROM finance.v_cash_box_balances WHERE id = $1
    `, [cash_box_id]);

    if (balanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cash box not found' });
    }

    const currentBalance = parseFloat(balanceResult.rows[0].current_balance);
    
    // Calculate new running balance
    let newBalance: number;
    if (transaction_type === 'in') {
      newBalance = currentBalance + amount;
    } else {
      newBalance = currentBalance - amount;
      // Check for negative balance (warning but allow)
      if (newBalance < 0) {
        logger.warn(`Cash box ${cash_box_id} going negative: ${newBalance}`);
      }
    }

    // Insert transaction
    const result = await client.query(`
      INSERT INTO finance.cash_box_transactions (
        cash_box_id,
        transaction_type,
        amount,
        running_balance,
        party_name,
        description,
        reference_type,
        reference_id,
        recorded_by,
        transaction_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, CURRENT_DATE))
      RETURNING *
    `, [
      cash_box_id,
      transaction_type,
      amount,
      newBalance,
      party_name,
      description || null,
      reference_type || null,
      reference_id || null,
      userId,
      transaction_date || null,
    ]);

    await client.query('COMMIT');

    logger.info(`Transaction recorded: ${transaction_type} ${amount} to cash box ${cash_box_id} by user ${userId}`);

    res.status(201).json({
      message: 'Transaction recorded successfully',
      transaction: result.rows[0],
      new_balance: newBalance,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error recording transaction:', error);
    res.status(500).json({ error: 'Failed to record transaction' });
  } finally {
    client.release();
  }
});

// ============================================
// POST /api/cashbox/transfer
// Transfer between cash boxes
// ============================================
router.post('/transfer', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const validation = transferSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { 
      from_cash_box_id, 
      to_cash_box_id, 
      from_amount, 
      to_amount, 
      description,
      transaction_date 
    } = validation.data;
    const userId = req.user?.id;

    await client.query('BEGIN');

    // Get current balances for both boxes
    const balanceResult = await client.query(`
      SELECT id, current_balance, currency_code 
      FROM finance.v_cash_box_balances 
      WHERE id IN ($1, $2)
    `, [from_cash_box_id, to_cash_box_id]);

    if (balanceResult.rows.length !== 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or both cash boxes not found' });
    }

    const fromBox = balanceResult.rows.find(r => r.id === from_cash_box_id);
    const toBox = balanceResult.rows.find(r => r.id === to_cash_box_id);

    if (!fromBox || !toBox) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cash box not found' });
    }

    const fromCurrentBalance = parseFloat(fromBox.current_balance);
    const toCurrentBalance = parseFloat(toBox.current_balance);

    // Calculate new balances
    const fromNewBalance = fromCurrentBalance - from_amount;
    const toNewBalance = toCurrentBalance + to_amount;

    // Check for negative balance on source (warning but allow)
    if (fromNewBalance < 0) {
      logger.warn(`Cash box ${from_cash_box_id} going negative after transfer: ${fromNewBalance}`);
    }

    // Generate transfer pair ID
    const transferPairId = crypto.randomUUID();

    // Build description for transfer
    const transferDescription = description || 
      `Transfer: ${fromBox.currency_code} → ${toBox.currency_code}`;

    // Insert transfer_out transaction (from source box)
    const fromResult = await client.query(`
      INSERT INTO finance.cash_box_transactions (
        cash_box_id,
        transaction_type,
        amount,
        running_balance,
        party_name,
        description,
        transfer_pair_id,
        recorded_by,
        transaction_date
      ) VALUES ($1, 'transfer_out', $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE))
      RETURNING *
    `, [
      from_cash_box_id,
      from_amount,
      fromNewBalance,
      `Transfer to ${toBox.currency_code} Box`,
      transferDescription,
      transferPairId,
      userId,
      transaction_date || null,
    ]);

    // Insert transfer_in transaction (to destination box)
    const toResult = await client.query(`
      INSERT INTO finance.cash_box_transactions (
        cash_box_id,
        transaction_type,
        amount,
        running_balance,
        party_name,
        description,
        transfer_pair_id,
        recorded_by,
        transaction_date
      ) VALUES ($1, 'transfer_in', $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE))
      RETURNING *
    `, [
      to_cash_box_id,
      to_amount,
      toNewBalance,
      `Transfer from ${fromBox.currency_code} Box`,
      transferDescription,
      transferPairId,
      userId,
      transaction_date || null,
    ]);

    await client.query('COMMIT');

    logger.info(`Transfer recorded: ${from_amount} ${fromBox.currency_code} → ${to_amount} ${toBox.currency_code} by user ${userId}`);

    res.status(201).json({
      message: 'Transfer recorded successfully',
      transfer_pair_id: transferPairId,
      from_transaction: fromResult.rows[0],
      to_transaction: toResult.rows[0],
      from_new_balance: fromNewBalance,
      to_new_balance: toNewBalance,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error recording transfer:', error);
    res.status(500).json({ error: 'Failed to record transfer' });
  } finally {
    client.release();
  }
});

export default router;

