import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import {
  createBatchSchema,
  updateBatchStatusSchema,
  batchFiltersSchema,
  exportBatchFiltersSchema,
  batchIdSchema,
} from '../validators/customsClearingBatch';
import { exportCustomsClearingBatch, generateExportFilename } from '../services/excelExportService';
import type { CustomsClearingBatchDTO, CustomsClearingBatchDetailDTO, CustomsClearingBatchSummaryDTO } from '../types/dto';
import { withTransaction } from '../utils/transactions';
import logger from '../utils/logger';

const router = Router();

/**
 * @route POST /api/v1/customs-clearing-batches
 * @desc Create new batch from selected customs clearing cost entries
 * @access Private (Clearance, Admin)
 */
router.post(
  '/',
  validateBody(createBatchSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Clearance', 'Admin'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { batch_number, customs_cost_ids, notes } = req.body;

      // Check if batch number already exists
      const existingBatch = await pool.query(
        'SELECT id FROM finance.customs_clearing_batches WHERE batch_number = $1 AND is_deleted = FALSE',
        [batch_number]
      );

      if (existingBatch.rows.length > 0) {
        return res.status(400).json({ error: 'Batch number already exists' });
      }

      // Get the customs clearing costs and calculate total
      const costsResult = await pool.query(
        `SELECT id, total_clearing_cost 
         FROM finance.customs_clearing_costs 
         WHERE id = ANY($1::uuid[]) AND is_deleted = FALSE`,
        [customs_cost_ids]
      );

      if (costsResult.rows.length !== customs_cost_ids.length) {
        return res.status(400).json({ error: 'Some selected items were not found' });
      }

      // Calculate total
      const total_clearing_cost = costsResult.rows.reduce(
        (sum, row) => sum + parseFloat(row.total_clearing_cost || 0),
        0
      );

      const item_count = costsResult.rows.length;

      // Create batch in transaction
      const batch = await withTransaction(async (client) => {
        // Insert batch
        const batchResult = await client.query(
          `INSERT INTO finance.customs_clearing_batches (
            batch_number, status, total_clearing_cost, item_count,
            created_by, notes
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [batch_number, 'pending', total_clearing_cost, item_count, user.username, notes]
        );

        const batch = batchResult.rows[0];

        // Insert batch items
        const batchItemsValues = customs_cost_ids.map((costId: string) => 
          `('${batch.id}', '${costId}')`
        ).join(',');

        await client.query(
          `INSERT INTO finance.customs_clearing_batch_items (batch_id, customs_cost_id)
           VALUES ${batchItemsValues}`
        );

        return batch;
      });

      // TODO: Send notification to accountants

      res.status(201).json(batch);
    } catch (error) {
      logger.error('Error creating batch:', { error });
      res.status(500).json({ error: 'Failed to create batch' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-batches
 * @desc Get list of batches with filters and pagination
 * @access Private (Clearance, Accounting, Admin)
 */
router.get(
  '/',
  validateQuery(batchFiltersSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Clearance', 'Accounting', 'Exec', 'Admin'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const {
        page = 1,
        limit = 50,
        sort_by = 'created_at',
        sort_order = 'desc',
        status,
        created_by,
        reviewed_by,
        created_from,
        created_to,
        search,
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Build WHERE clause
      const conditions: string[] = ['is_deleted = FALSE'];
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (created_by) {
        conditions.push(`created_by = $${paramIndex}`);
        params.push(created_by);
        paramIndex++;
      }

      if (reviewed_by) {
        conditions.push(`reviewed_by = $${paramIndex}`);
        params.push(reviewed_by);
        paramIndex++;
      }

      if (created_from) {
        conditions.push(`created_at >= $${paramIndex}`);
        params.push(created_from);
        paramIndex++;
      }

      if (created_to) {
        conditions.push(`created_at <= $${paramIndex}`);
        params.push(created_to + ' 23:59:59');
        paramIndex++;
      }

      if (search) {
        conditions.push(`(
          batch_number ILIKE $${paramIndex} OR
          notes ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total 
         FROM finance.customs_clearing_batches
         ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated data
      const validSortColumns = ['batch_number', 'status', 'total_clearing_cost', 'item_count', 'created_at', 'submitted_at', 'reviewed_at'];
      const sortColumn = validSortColumns.includes(sort_by as string) ? sort_by : 'created_at';
      const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

      params.push(limit, offset);
      const dataResult = await pool.query(
        `SELECT *
        FROM finance.customs_clearing_batches
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      res.json({
        data: dataResult.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Error fetching batches:', error);
      res.status(500).json({ error: 'Failed to fetch batches' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-batches/summary
 * @desc Get summary statistics for batches
 * @access Private (Clearance, Accounting, Admin)
 */
router.get(
  '/summary',
  async (req: Request, res: Response) => {
    try {
      const summaryResult = await pool.query(`
        SELECT 
          COUNT(*) as total_batches,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
          COALESCE(SUM(total_costs) FILTER (WHERE status = 'pending'), 0) as total_pending_cost,
          COALESCE(SUM(total_costs) FILTER (WHERE status = 'approved'), 0) as total_approved_cost,
          COALESCE(SUM(total_costs) FILTER (WHERE status = 'archived'), 0) as total_archived_cost
        FROM finance.customs_clearing_batches
        WHERE is_deleted = FALSE
      `);

      const row = summaryResult.rows[0];
      
      const summary: CustomsClearingBatchSummaryDTO = {
        total_batches: parseInt(row.total_batches, 10),
        pending_count: parseInt(row.pending_count, 10),
        approved_count: parseInt(row.approved_count, 10),
        archived_count: parseInt(row.archived_count, 10),
        total_pending_cost: parseFloat(row.total_pending_cost),
        total_approved_cost: parseFloat(row.total_approved_cost),
        total_archived_cost: parseFloat(row.total_archived_cost),
      };

      res.json(summary);
    } catch (error) {
      logger.error('Error fetching summary:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-batches/:id
 * @desc Get batch details with all items
 * @access Private (Clearance, Accounting, Admin)
 */
router.get(
  '/:id',
  validateParams(batchIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get batch
      const batchResult = await pool.query(
        'SELECT * FROM finance.customs_clearing_batches WHERE id = $1 AND is_deleted = FALSE',
        [id]
      );

      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];

      // Get batch items
      const itemsResult = await pool.query(
        `SELECT c.*
         FROM finance.customs_clearing_costs c
         INNER JOIN finance.customs_clearing_batch_items bi ON c.id = bi.customs_cost_id
         WHERE bi.batch_id = $1 AND c.is_deleted = FALSE
         ORDER BY bi.added_at`,
        [id]
      );

      const batchDetail: CustomsClearingBatchDetailDTO = {
        ...batch,
        items: itemsResult.rows,
      };

      res.json(batchDetail);
    } catch (error) {
      logger.error('Error fetching batch:', error);
      res.status(500).json({ error: 'Failed to fetch batch' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-batches/:id/export
 * @desc Export batch to Excel with full details
 * @access Private (Clearance, Accounting, Admin)
 */
router.get(
  '/:id/export',
  validateParams(batchIdSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Clearance', 'Accounting', 'Exec', 'Admin'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { id } = req.params;

      // Get batch with items
      const batchResult = await pool.query(
        'SELECT * FROM finance.customs_clearing_batches WHERE id = $1 AND is_deleted = FALSE',
        [id]
      );

      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];

      // Get batch items
      const itemsResult = await pool.query(
        `SELECT c.*
         FROM finance.customs_clearing_costs c
         INNER JOIN finance.customs_clearing_batch_items bi ON c.id = bi.customs_cost_id
         WHERE bi.batch_id = $1 AND c.is_deleted = FALSE
         ORDER BY bi.added_at`,
        [id]
      );

      const batchDetail: CustomsClearingBatchDetailDTO = {
        ...batch,
        items: itemsResult.rows,
      };

      // Validate batch data
      if (!batch.batch_number) {
        throw new Error('Batch number is missing');
      }
      
      if (!itemsResult.rows || itemsResult.rows.length === 0) {
        throw new Error('No items found in batch');
      }

      // Get language from query parameter (default to 'en')
      const language = (req.query.lang as string) === 'ar' ? 'ar' : 'en';

      // Generate Excel file
      const excelBuffer = exportCustomsClearingBatch(batchDetail, language);
      const filename = generateExportFilename(`batch_${batch.batch_number}`);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      logger.error('Error exporting batch:', error);
      res.status(500).json({ 
        error: 'Failed to export batch',
        details: (error as Error).message 
      });
    }
  }
);

/**
 * @route PUT /api/v1/customs-clearing-batches/:id/approve
 * @desc Approve batch (Accountant action)
 * @access Private (Accounting, Admin)
 */
router.put(
  '/:id/approve',
  validateParams(batchIdSchema),
  validateBody(updateBatchStatusSchema.partial()),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Accounting', 'Admin'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { id } = req.params;
      const { notes } = req.body;

      // Check if batch exists and is pending
      const batchResult = await pool.query(
        'SELECT * FROM finance.customs_clearing_batches WHERE id = $1 AND is_deleted = FALSE',
        [id]
      );

      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];

      if (batch.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending batches can be approved' });
      }

      // Update batch
      const updateResult = await pool.query(
        `UPDATE finance.customs_clearing_batches
         SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), notes = COALESCE($2, notes)
         WHERE id = $3
         RETURNING *`,
        [user.username, notes, id]
      );

      // TODO: Send notification to officer who created the batch

      res.json(updateResult.rows[0]);
    } catch (error) {
      logger.error('Error approving batch:', error);
      res.status(500).json({ error: 'Failed to approve batch' });
    }
  }
);

/**
 * @route PUT /api/v1/customs-clearing-batches/:id/archive
 * @desc Archive approved batch
 * @access Private (Accounting, Admin)
 */
router.put(
  '/:id/archive',
  validateParams(batchIdSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Accounting', 'Admin'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { id } = req.params;

      // Check if batch exists and is approved
      const batchResult = await pool.query(
        'SELECT * FROM finance.customs_clearing_batches WHERE id = $1 AND is_deleted = FALSE',
        [id]
      );

      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];

      if (batch.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved batches can be archived' });
      }

      // Update batch
      const updateResult = await pool.query(
        `UPDATE finance.customs_clearing_batches
         SET status = 'archived'
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      res.json(updateResult.rows[0]);
    } catch (error) {
      logger.error('Error archiving batch:', error);
      res.status(500).json({ error: 'Failed to archive batch' });
    }
  }
);

/**
 * @route DELETE /api/v1/customs-clearing-batches/:id
 * @desc Soft delete batch (only if pending)
 * @access Private (Clearance, Admin)
 */
router.delete(
  '/:id',
  validateParams(batchIdSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Clearance', 'Admin'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { id } = req.params;

      // Check if batch exists and is pending
      const batchResult = await pool.query(
        'SELECT * FROM finance.customs_clearing_batches WHERE id = $1 AND is_deleted = FALSE',
        [id]
      );

      if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchResult.rows[0];

      if (batch.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending batches can be deleted' });
      }

      // Soft delete
      await pool.query(
        `UPDATE finance.customs_clearing_batches
         SET is_deleted = TRUE, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      res.json({ message: 'Batch deleted successfully', id });
    } catch (error) {
      logger.error('Error deleting batch:', error);
      res.status(500).json({ error: 'Failed to delete batch' });
    }
  }
);

export default router;

