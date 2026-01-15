import { Router } from 'express';
import { pool } from '../db/client';
import { authorizeModuleAuto, requireRead } from '../middleware/auth';
import { loadUserBranches, buildFinanceBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';
import { withTransaction } from '../utils/transactions';
import logger from '../utils/logger';

const router = Router();

// Apply branch loading middleware to all routes
router.use(loadUserBranches);

// ========== GET /api/finance/transactions - List all transactions with filters ==========
router.get('/transactions', requireRead('finance'), async (req, res, next) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const {
      dateFrom,
      dateTo,
      direction,
      fund,
      party,
      contract_id,
      shipment_id,
      transaction_type,
      page = '1',
      limit = '50',
      includeArchived = 'false',
    } = req.query;

    // Build branch filter for transactions
    const branchFilter = buildFinanceBranchFilter(branchReq, 't');

    let query = `
      SELECT 
        t.*,
        f.fund_name,
        f.fund_type,
        c.contract_no,
        s.sn as shipment_sn
      FROM finance.transactions t
      LEFT JOIN finance.funds f ON t.fund_id = f.id
      LEFT JOIN logistics.contracts c ON t.contract_id = c.id
      LEFT JOIN logistics.v_shipments_complete s ON t.shipment_id = s.id
      WHERE t.is_deleted = false
    `;

    const params: any[] = [...branchFilter.params];
    let paramIndex = params.length + 1;
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      query += ` AND ${branchFilter.clause}`;
    }

    if (dateFrom) {
      query += ` AND t.transaction_date >= $${paramIndex++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND t.transaction_date <= $${paramIndex++}`;
      params.push(dateTo);
    }

    if (direction) {
      query += ` AND t.direction = $${paramIndex++}`;
      params.push(direction);
    }

    if (fund) {
      query += ` AND t.fund_source ILIKE $${paramIndex++}`;
      params.push(`%${fund}%`);
    }

    if (party) {
      query += ` AND t.party_name ILIKE $${paramIndex++}`;
      params.push(`%${party}%`);
    }

    if (contract_id) {
      query += ` AND t.contract_id = $${paramIndex++}`;
      params.push(contract_id);
    }

    if (shipment_id) {
      query += ` AND t.shipment_id = $${paramIndex++}`;
      params.push(shipment_id);
    }

    if (transaction_type) {
      query += ` AND t.transaction_type = $${paramIndex++}`;
      params.push(transaction_type);
    }

    // Count total for pagination
    const countQuery = query.replace(
      /SELECT.*FROM/s,
      'SELECT COUNT(*) as total FROM'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, (parseInt(page as string) - 1) * parseInt(limit as string));

    const result = await pool.query(query, params);

    res.json({
      transactions: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    next(error);
  }
});

// ========== GET /api/finance/transactions/:id - Get single transaction ==========
router.get('/transactions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        t.*,
        f.fund_name as fund_name,
        f.fund_type as fund_type,
        c.contract_no,
        s.sn as shipment_sn
      FROM finance.transactions t
      LEFT JOIN finance.funds f ON t.fund_id = f.id
      LEFT JOIN logistics.contracts c ON t.contract_id = c.id
      LEFT JOIN logistics.v_shipments_complete s ON t.shipment_id = s.id
      WHERE t.id = $1 AND t.is_deleted = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching transaction:', error);
    next(error);
  }
});

// ========== POST /api/finance/transactions - Create new transaction ==========
router.post('/transactions', async (req, res, next) => {
  try {
    const {
      transaction_date,
      amount_usd,
      amount_other,
      currency,
      transaction_type,
      direction,
      fund_source,
      party_name,
      description,
      contract_id,
      shipment_id,
    } = req.body;

    // Validate required fields
    if (!transaction_date || amount_usd === undefined || amount_usd === null || !fund_source || !party_name || !direction) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          transaction_date: !transaction_date ? 'required' : 'ok',
          amount_usd: (amount_usd === undefined || amount_usd === null) ? 'required' : 'ok',
          fund_source: !fund_source ? 'required' : 'ok',
          party_name: !party_name ? 'required' : 'ok',
          direction: !direction ? 'required' : 'ok',
        }
      });
    }

    const result = await withTransaction(async (client) => {
      // Get or create fund
      let fundId = null;
      const fundResult = await client.query(
        'SELECT id FROM finance.funds WHERE fund_name = $1',
        [fund_source]
      );

      if (fundResult.rows.length > 0) {
        fundId = fundResult.rows[0].id;
      } else {
        // Create new fund
        const newFundResult = await client.query(
          `INSERT INTO finance.funds (fund_name, fund_type, currency_code)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [fund_source, 'bank_account', currency || 'USD']
        );
        fundId = newFundResult.rows[0].id;
      }

      // Check if party exists in financial_parties, if not create it
      const partyResult = await client.query(
        'SELECT id FROM finance.financial_parties WHERE name = $1',
        [party_name]
      );

      if (partyResult.rows.length === 0) {
        // Insert new party - no ON CONFLICT since we already checked it doesn't exist
        await client.query(
          `INSERT INTO finance.financial_parties (name, type)
           VALUES ($1, $2)`,
          [party_name, 'other']
        );
      }

      // Insert transaction
      const transactionResult = await client.query(
        `INSERT INTO finance.transactions (
          transaction_date, amount_usd, amount_other, currency,
          transaction_type, direction, fund_source, party_name,
          description, contract_id, shipment_id, fund_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          transaction_date,
          amount_usd,
          amount_other,
          currency || 'USD',
          transaction_type,
          direction,
          fund_source,
          party_name,
          description,
          contract_id || null,
          shipment_id || null,
          fundId,
        ]
      );

      return transactionResult.rows[0];
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// ========== PUT /api/finance/transactions/:id - Update transaction ==========
router.put('/transactions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      transaction_date,
      amount_usd,
      amount_other,
      currency,
      transaction_type,
      direction,
      fund_source,
      party_name,
      description,
      contract_id,
      shipment_id,
    } = req.body;

    const result = await withTransaction(async (client) => {
      // Get or create fund
      let fundId = null;
      if (fund_source) {
        const fundResult = await client.query(
          'SELECT id FROM finance.funds WHERE fund_name = $1',
          [fund_source]
        );

        if (fundResult.rows.length > 0) {
          fundId = fundResult.rows[0].id;
        } else {
          const newFundResult = await client.query(
            `INSERT INTO finance.funds (fund_name, fund_type, currency_code)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [fund_source, 'bank_account', currency || 'USD']
          );
          fundId = newFundResult.rows[0].id;
        }
      }

      // Update transaction
      const updateResult = await client.query(
        `UPDATE finance.transactions SET
          transaction_date = COALESCE($1, transaction_date),
          amount_usd = COALESCE($2, amount_usd),
          amount_other = $3,
          currency = COALESCE($4, currency),
          transaction_type = COALESCE($5, transaction_type),
          direction = COALESCE($6, direction),
          fund_source = COALESCE($7, fund_source),
          party_name = COALESCE($8, party_name),
          description = COALESCE($9, description),
          contract_id = $10,
          shipment_id = $11,
          fund_id = $12,
          updated_at = NOW()
        WHERE id = $13 AND is_deleted = false
        RETURNING *`,
        [
          transaction_date,
          amount_usd,
          amount_other,
          currency,
          transaction_type,
          direction,
          fund_source,
          party_name,
          description,
          contract_id,
          shipment_id,
          fundId,
          id,
        ]
      );

      if (updateResult.rows.length === 0) {
        return null; // Will be handled below
      }

      return updateResult.rows[0];
    });

    if (!result) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ========== DELETE /api/finance/transactions/:id - Soft delete transaction ==========
router.delete('/transactions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE finance.transactions SET is_deleted = true, updated_at = NOW()
       WHERE id = $1 AND is_deleted = false
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    logger.error('Error deleting transaction:', error);
    next(error);
  }
});

// ========== POST /api/finance/transactions/bulk-delete - Bulk soft delete transactions ==========
router.post('/transactions/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty ids array' });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `UPDATE finance.transactions SET is_deleted = true, updated_at = NOW()
       WHERE id IN (${placeholders}) AND is_deleted = false
       RETURNING id`,
      ids
    );

    res.json({ 
      message: `${result.rowCount} transaction(s) deleted successfully`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    logger.error('Error bulk deleting transactions:', error);
    next(error);
  }
});

// ========== POST /api/finance/transactions/bulk-archive - Bulk archive transactions ==========
router.post('/transactions/bulk-archive', async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty ids array' });
    }

    // Check if archive column exists, if not add it
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Try to add is_archived column if it doesn't exist
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'finance' 
            AND table_name = 'transactions' 
            AND column_name = 'is_archived'
          ) THEN
            ALTER TABLE finance.transactions ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
          END IF;
        END $$;
      `);

      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const result = await client.query(
        `UPDATE finance.transactions SET is_archived = true, updated_at = NOW()
         WHERE id IN (${placeholders}) AND is_deleted = false
         RETURNING id`,
        ids
      );

      await client.query('COMMIT');

      res.json({ 
        message: `${result.rowCount} transaction(s) archived successfully`,
        archivedCount: result.rowCount
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error bulk archiving transactions:', error);
    next(error);
  }
});

// ========== GET /api/finance/funds - List all funds ==========
router.get('/funds', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, fund_name, fund_type, currency_code, current_balance as balance
       FROM finance.funds 
       WHERE is_active = TRUE
       ORDER BY fund_type, fund_name`
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching funds:', error);
    next(error);
  }
});

// ========== POST /api/finance/funds - Create new fund ==========
router.post('/funds', async (req, res, next) => {
  try {
    const { name, type, currency } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Missing required fields: name, type' });
    }

    // Map type to match existing schema
    const fundType = type === 'exchange' ? 'cash' : type === 'cash_fund' ? 'cash' : 'bank_account';

    const result = await pool.query(
      `INSERT INTO finance.funds (fund_name, fund_type, currency_code)
       VALUES ($1, $2, $3)
       RETURNING id, fund_name as name, fund_type as type, currency_code as currency`,
      [name, fundType, currency || 'USD']
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique constraint violation
      return res.status(409).json({ error: 'Fund with this name already exists' });
    }
    logger.error('Error creating fund:', error);
    next(error);
  }
});

// ========== GET /api/finance/funds/:id/balance - Calculate balance for a fund ==========
router.get('/funds/:id/balance', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        f.id,
        f.fund_name as name,
        f.fund_type as type,
        f.currency_code as currency,
        COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount_usd ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN t.direction = 'out' THEN t.amount_usd ELSE 0 END), 0) as total_out,
        COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount_usd ELSE -t.amount_usd END), 0) as balance
      FROM finance.funds f
      LEFT JOIN finance.transactions t ON t.fund_id = f.id AND t.is_deleted = false
      WHERE f.id = $1
      GROUP BY f.id, f.fund_name, f.fund_type, f.currency_code`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fund not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error calculating fund balance:', error);
    next(error);
  }
});

// ========== GET /api/finance/parties - List all financial parties ==========
router.get('/parties', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM finance.financial_parties ORDER BY name`
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching parties:', error);
    next(error);
  }
});

// ========== POST /api/finance/parties - Create new party ==========
router.post('/parties', async (req, res, next) => {
  try {
    const { name, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }

    const result = await pool.query(
      `INSERT INTO finance.financial_parties (name, type)
       VALUES ($1, $2)
       RETURNING *`,
      [name, type || 'other']
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Party with this name already exists' });
    }
    logger.error('Error creating party:', error);
    next(error);
  }
});

// ========== GET /api/finance/parties/search - Search parties (includes companies) ==========
router.get('/parties/search', async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.json([]);
    }

    // Search in both financial_parties and companies with fuzzy matching
    const normalized = (q as string).replace(/[-_\s]/g, '').toLowerCase();
    const result = await pool.query(
      `SELECT 'party' as source, id, name, type, null as country
       FROM finance.financial_parties
       WHERE REPLACE(REPLACE(REPLACE(LOWER(name), '-', ''), '_', ''), ' ', '') LIKE $1 OR
             LOWER(name) LIKE LOWER($2)
       UNION ALL
       SELECT 'company' as source, id::text, name, type, country
       FROM master_data.companies
       WHERE REPLACE(REPLACE(REPLACE(LOWER(name), '-', ''), '_', ''), ' ', '') LIKE $1 OR
             LOWER(name) LIKE LOWER($2)
       ORDER BY name
       LIMIT 20`,
      [`%${normalized}%`, `%${q}%`]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error searching parties:', error);
    next(error);
  }
});

// ========== GET /api/finance/top-used - Get most frequently used funds and parties ==========
router.get('/top-used', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 4;

    // Get top funds by transaction count
    const topFundsResult = await pool.query(
      `SELECT fund_source, COUNT(*) as usage_count
       FROM finance.transactions
       WHERE is_deleted = false AND fund_source IS NOT NULL AND fund_source != ''
       GROUP BY fund_source
       ORDER BY usage_count DESC
       LIMIT $1`,
      [limit]
    );

    // Get top parties by transaction count
    const topPartiesResult = await pool.query(
      `SELECT party_name, COUNT(*) as usage_count
       FROM finance.transactions
       WHERE is_deleted = false AND party_name IS NOT NULL AND party_name != ''
       GROUP BY party_name
       ORDER BY usage_count DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      topFunds: topFundsResult.rows.map(r => r.fund_source),
      topParties: topPartiesResult.rows.map(r => r.party_name),
    });
  } catch (error) {
    logger.error('Error fetching top used:', error);
    next(error);
  }
});

// ========== GET /api/finance/summary - Get financial summary ==========
router.get('/summary', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;

    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      dateFilter += ` AND t.transaction_date >= $${paramIndex++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      dateFilter += ` AND t.transaction_date <= $${paramIndex++}`;
      params.push(dateTo);
    }

    // Overall summary
    const summaryResult = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_usd ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN direction = 'out' THEN amount_usd ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_usd ELSE -amount_usd END), 0) as net_balance
      FROM finance.transactions t
      WHERE is_deleted = false ${dateFilter}`,
      params
    );

    // Balance by fund
    const fundBalanceResult = await pool.query(
      `SELECT 
        f.id,
        f.fund_name as name,
        f.fund_type as type,
        f.currency_code as currency,
        COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount_usd ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN t.direction = 'out' THEN t.amount_usd ELSE 0 END), 0) as total_out,
        COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount_usd ELSE -t.amount_usd END), 0) as balance
      FROM finance.funds f
      LEFT JOIN finance.transactions t ON t.fund_id = f.id AND t.is_deleted = false ${dateFilter.replace('t.transaction_date', 'transaction_date')}
      WHERE f.is_active = TRUE
      GROUP BY f.id, f.fund_name, f.fund_type, f.currency_code
      ORDER BY f.fund_type, f.fund_name`,
      params
    );

    res.json({
      summary: summaryResult.rows[0],
      fund_balances: fundBalanceResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching financial summary:', error);
    next(error);
  }
});

// ========== GET /api/finance/contracts/search - Search contracts ==========
router.get('/contracts/search', async (req, res, next) => {
  try {
    const { q = '', limit = '10' } = req.query;
    
    let query = `
      SELECT 
        c.id,
        c.contract_no,
        c.subject,
        c.signed_at as contract_date,
        c.status,
        buyer.name as buyer_name,
        seller.name as seller_name,
        c.extra_json->>'direction' as direction,
        vc.beneficiary_name
      FROM logistics.contracts c
      LEFT JOIN master_data.companies buyer ON c.buyer_company_id = buyer.id
      LEFT JOIN master_data.companies seller ON c.seller_company_id = seller.id
      LEFT JOIN logistics.v_contracts_complete vc ON c.id = vc.id
      WHERE c.is_deleted = false
    `;
    
    const params: any[] = [];
    
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.trim();
      // Remove special characters from search term for better matching
      const normalizedSearch = searchTerm.replace(/[-_\s]/g, '');
      
      // Split search into words for better matching
      const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
      
      if (words.length === 1) {
        // Single word search - use simple pattern matching with special char removal
        query += ` AND (
          REPLACE(REPLACE(REPLACE(LOWER(c.contract_no), '-', ''), '_', ''), ' ', '') LIKE $1 OR
          REPLACE(REPLACE(REPLACE(LOWER(c.subject), '-', ''), '_', ''), ' ', '') LIKE $1 OR
          LOWER(buyer.name) LIKE LOWER($2) OR
          LOWER(seller.name) LIKE LOWER($2)
        )`;
        params.push(`%${normalizedSearch.toLowerCase()}%`);
        params.push(`%${searchTerm}%`);
      } else {
        // Multiple words - each word must match at least one field
        const wordConditions = words.map((word) => {
          const normalizedWord = word.replace(/[-_\s]/g, '');
          params.push(`%${normalizedWord.toLowerCase()}%`);
          const normalizedParam = params.length;
          params.push(`%${word}%`);
          const originalParam = params.length;
          return `(
            REPLACE(REPLACE(REPLACE(LOWER(c.contract_no), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
            REPLACE(REPLACE(REPLACE(LOWER(c.subject), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
            LOWER(buyer.name) LIKE LOWER($${originalParam}) OR
            LOWER(seller.name) LIKE LOWER($${originalParam})
          )`;
        }).join(' AND ');
        query += ` AND (${wordConditions})`;
      }
    }
    
    query += ` ORDER BY c.signed_at DESC NULLS LAST, c.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit as string) || 10);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error searching contracts:', error);
    next(error);
  }
});

// ========== GET /api/finance/contracts/recent - Get recent contracts ==========
router.get('/contracts/recent', async (req, res, next) => {
  try {
    const { limit = '5' } = req.query;
    
    const result = await pool.query(
      `SELECT 
        c.id,
        c.contract_no,
        c.subject,
        c.signed_at as contract_date,
        c.status,
        buyer.name as buyer_name,
        seller.name as seller_name,
        c.extra_json->>'direction' as direction,
        vc.beneficiary_name
      FROM logistics.contracts c
      LEFT JOIN master_data.companies buyer ON c.buyer_company_id = buyer.id
      LEFT JOIN master_data.companies seller ON c.seller_company_id = seller.id
      LEFT JOIN logistics.v_contracts_complete vc ON c.id = vc.id
      WHERE c.is_deleted = false
      ORDER BY c.signed_at DESC NULLS LAST, c.created_at DESC
      LIMIT $1`,
      [parseInt(limit as string) || 5]
    );
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching recent contracts:', error);
    next(error);
  }
});

// ========== GET /api/finance/shipments/search - Search shipments ==========
router.get('/shipments/search', async (req, res, next) => {
  try {
    const { q = '', limit = '10' } = req.query;
    
    let query = `
      SELECT 
        s.id,
        s.sn,
        s.product_text,
        s.subject,
        s.contract_id,
        pol.name as origin_port,
        pod.name as destination_port,
        s.eta,
        s.status,
        s.booking_no,
        s.bl_no
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      WHERE s.is_deleted = false
    `;
    
    const params: any[] = [];
    
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.trim();
      // Remove special characters from search term for better matching
      const normalizedSearch = searchTerm.replace(/[-_\s]/g, '');
      
      // Split search into words for better matching
      const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
      
      if (words.length === 1) {
        // Single word search - use simple pattern matching with special char removal
        query += ` AND (
          REPLACE(REPLACE(REPLACE(LOWER(s.sn), '-', ''), '_', ''), ' ', '') LIKE $1 OR
          REPLACE(REPLACE(REPLACE(LOWER(s.product_text), '-', ''), '_', ''), ' ', '') LIKE $1 OR
          REPLACE(REPLACE(REPLACE(LOWER(s.subject), '-', ''), '_', ''), ' ', '') LIKE $1 OR
          REPLACE(REPLACE(REPLACE(LOWER(s.booking_no), '-', ''), '_', ''), ' ', '') LIKE $1 OR
          REPLACE(REPLACE(REPLACE(LOWER(s.bl_no), '-', ''), '_', ''), ' ', '') LIKE $1 OR
          LOWER(pol.name) LIKE LOWER($2) OR
          LOWER(pod.name) LIKE LOWER($2)
        )`;
        params.push(`%${normalizedSearch.toLowerCase()}%`);
        params.push(`%${searchTerm}%`);
      } else {
        // Multiple words - each word must match at least one field
        const wordConditions = words.map((word) => {
          const normalizedWord = word.replace(/[-_\s]/g, '');
          params.push(`%${normalizedWord.toLowerCase()}%`);
          const normalizedParam = params.length;
          params.push(`%${word}%`);
          const originalParam = params.length;
          return `(
            REPLACE(REPLACE(REPLACE(LOWER(s.sn), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
            REPLACE(REPLACE(REPLACE(LOWER(s.product_text), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
            REPLACE(REPLACE(REPLACE(LOWER(s.subject), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
            REPLACE(REPLACE(REPLACE(LOWER(s.booking_no), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
            REPLACE(REPLACE(REPLACE(LOWER(s.bl_no), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
            LOWER(pol.name) LIKE LOWER($${originalParam}) OR
            LOWER(pod.name) LIKE LOWER($${originalParam})
          )`;
        }).join(' AND ');
        query += ` AND (${wordConditions})`;
      }
    }
    
    query += ` ORDER BY s.eta DESC NULLS LAST, s.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit as string) || 10);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error searching shipments:', error);
    next(error);
  }
});

// ========== GET /api/finance/shipments/recent - Get recent shipments ==========
router.get('/shipments/recent', async (req, res, next) => {
  try {
    const { limit = '5' } = req.query;
    
    const result = await pool.query(
      `SELECT 
        s.id,
        s.sn,
        s.product_text,
        s.subject,
        pol.name as origin_port,
        pod.name as destination_port,
        s.eta,
        s.status
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      WHERE s.is_deleted = false
      ORDER BY s.eta DESC NULLS LAST, s.created_at DESC
      LIMIT $1`,
      [parseInt(limit as string) || 5]
    );
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching recent shipments:', error);
    next(error);
  }
});

export default router;
