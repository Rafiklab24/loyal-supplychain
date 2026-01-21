/**
 * Elleçleme (Handling) Management API Routes
 * 
 * Comprehensive system for managing customs warehouse handling
 * operations per Ek-63 regulations with:
 * - Request workflow management
 * - Individual permit tracking
 * - Cost tracking
 * - Document management
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { loadUserBranches, BranchFilterRequest, buildAntrepoBranchFilter } from '../middleware/branchFilter';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import {
  createRequestSchema,
  updateRequestSchema,
  submitForPermitSchema,
  startExecutionSchema,
  completeRequestSchema,
  cancelRequestSchema,
  pickupRequestSchema,
  confirmResultSchema,
  rejectResultSchema,
  requestIdSchema,
  createPermitSchema,
  updatePermitSchema,
  approvePermitSchema,
  rejectPermitSchema,
  permitIdSchema,
  createCostSchema,
  updateCostSchema,
  costIdSchema,
  createDocumentSchema,
  documentIdSchema,
  requestFiltersSchema,
  permitFiltersSchema,
  costFiltersSchema,
  reportFiltersSchema,
} from '../validators/ellecleme';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(loadUserBranches);

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'storage', 'documents', 'ellecleme');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP and PDF are allowed.'));
    }
  },
});

// ============================================================
// DASHBOARD
// ============================================================

/**
 * @route GET /api/v1/ellecleme/dashboard
 * @desc Get dashboard summary statistics
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM logistics.v_ellecleme_dashboard
    `);

    // Get recent requests
    const recentRequests = await pool.query(`
      SELECT 
        er.id,
        er.request_number,
        er.activity_code,
        er.activity_name,
        er.activity_name_ar,
        er.activity_name_tr,
        er.status,
        er.priority,
        er.requested_date,
        er.planned_execution_date,
        ai.product_text,
        al.code AS lot_code,
        s.sn AS shipment_sn
      FROM logistics.ellecleme_requests er
      JOIN logistics.antrepo_inventory ai ON er.inventory_id = ai.id
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      WHERE er.is_deleted = FALSE
      ORDER BY er.created_at DESC
      LIMIT 10
    `);

    // Get pending permits count
    const pendingPermits = await pool.query(`
      SELECT COUNT(*) AS count
      FROM logistics.ellecleme_permits
      WHERE status = 'submitted'
    `);

    res.json({
      success: true,
      data: {
        summary: result.rows[0],
        recent_requests: recentRequests.rows,
        pending_permits_count: parseInt(pendingPermits.rows[0]?.count || '0'),
      },
    });
  } catch (error) {
    logger.error('Error fetching ellecleme dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ============================================================
// REQUESTS
// ============================================================

/**
 * @route GET /api/v1/ellecleme/requests
 * @desc List all requests with filters
 */
router.get('/requests', validateQuery(requestFiltersSchema), async (req: Request, res: Response) => {
  try {
    const { inventory_id, status, activity_code, priority, date_from, date_to, search, lot_id, page, limit } = req.query as any;

    const conditions: string[] = ['er.is_deleted = FALSE'];
    const params: any[] = [];
    let paramIndex = 1;

    if (inventory_id) {
      conditions.push(`er.inventory_id = $${paramIndex++}`);
      params.push(inventory_id);
    }

    if (status) {
      conditions.push(`er.status = $${paramIndex++}`);
      params.push(status);
    }

    if (activity_code) {
      conditions.push(`er.activity_code = $${paramIndex++}`);
      params.push(activity_code);
    }

    if (priority) {
      conditions.push(`er.priority = $${paramIndex++}`);
      params.push(priority);
    }

    if (date_from) {
      conditions.push(`er.requested_date >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`er.requested_date <= $${paramIndex++}`);
      params.push(date_to);
    }

    if (lot_id) {
      conditions.push(`ai.lot_id = $${paramIndex++}`);
      params.push(lot_id);
    }

    if (search) {
      conditions.push(`(
        er.request_number ILIKE $${paramIndex} OR
        ai.product_text ILIKE $${paramIndex} OR
        s.sn ILIKE $${paramIndex} OR
        er.activity_name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Count total
    const countResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM logistics.ellecleme_requests er
      JOIN logistics.antrepo_inventory ai ON er.inventory_id = ai.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      WHERE ${whereClause}
    `, params);

    // Get data
    params.push(limit, offset);
    const dataResult = await pool.query(`
      SELECT * FROM logistics.v_ellecleme_requests
      WHERE id IN (
        SELECT er.id
        FROM logistics.ellecleme_requests er
        JOIN logistics.antrepo_inventory ai ON er.inventory_id = ai.id
        LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
        WHERE ${whereClause}
        ORDER BY 
          CASE er.status
            WHEN 'in_progress' THEN 1
            WHEN 'approved' THEN 2
            WHEN 'pending_permit' THEN 3
            WHEN 'draft' THEN 4
            ELSE 5
          END,
          er.priority = 'urgent' DESC,
          er.priority = 'high' DESC,
          er.requested_date DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      )
      ORDER BY 
        CASE status
          WHEN 'in_progress' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'pending_permit' THEN 3
          WHEN 'draft' THEN 4
          ELSE 5
        END,
        priority = 'urgent' DESC,
        priority = 'high' DESC,
        requested_date DESC
    `, params);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching ellecleme requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

/**
 * @route GET /api/v1/ellecleme/requests/:id
 * @desc Get single request with full details
 */
router.get('/requests/:id', validateParams(requestIdSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get main request data from view
    const requestResult = await pool.query(`
      SELECT * FROM logistics.v_ellecleme_requests WHERE id = $1
    `, [id]);

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get all permits
    const permitsResult = await pool.query(`
      SELECT * FROM logistics.ellecleme_permits
      WHERE request_id = $1
      ORDER BY created_at DESC
    `, [id]);

    // Get all costs
    const costsResult = await pool.query(`
      SELECT * FROM logistics.ellecleme_costs
      WHERE request_id = $1
      ORDER BY created_at DESC
    `, [id]);

    // Get all documents
    const documentsResult = await pool.query(`
      SELECT * FROM logistics.ellecleme_documents
      WHERE request_id = $1 AND is_deleted = FALSE
      ORDER BY uploaded_at DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...requestResult.rows[0],
        permits: permitsResult.rows,
        costs: costsResult.rows,
        documents: documentsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching ellecleme request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

/**
 * @route POST /api/v1/ellecleme/requests
 * @desc Create new request
 */
router.post('/requests', validateBody(createRequestSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = req.body;

    // Verify inventory exists
    const inventoryResult = await pool.query(`
      SELECT ai.*, al.code AS lot_code, s.sn AS shipment_sn
      FROM logistics.antrepo_inventory ai
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      WHERE ai.id = $1 AND ai.is_deleted = FALSE
    `, [data.inventory_id]);

    if (inventoryResult.rowCount === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const inventory = inventoryResult.rows[0];

    // Create request
    const result = await pool.query(`
      INSERT INTO logistics.ellecleme_requests (
        inventory_id, activity_code, priority,
        quantity_mt, quantity_bags,
        reason, description, customer_requirement,
        original_gtip, planned_execution_date,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      data.inventory_id,
      data.activity_code,
      data.priority || 'normal',
      data.quantity_mt || inventory.current_quantity_mt,
      data.quantity_bags || inventory.quantity_bags,
      data.reason,
      data.description,
      data.customer_requirement,
      data.original_gtip || inventory.product_gtip,
      data.planned_execution_date,
      user?.id,
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating ellecleme request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

/**
 * @route PUT /api/v1/ellecleme/requests/:id
 * @desc Update request (only in draft status)
 */
router.put('/requests/:id', validateParams(requestIdSchema), validateBody(updateRequestSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    // Check request exists and is in draft status
    const existingResult = await pool.query(`
      SELECT status FROM logistics.ellecleme_requests
      WHERE id = $1 AND is_deleted = FALSE
    `, [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (existingResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Can only update requests in draft status' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const fields = [
      'activity_code', 'priority', 'quantity_mt', 'quantity_bags',
      'reason', 'description', 'customer_requirement',
      'original_gtip', 'planned_execution_date',
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(data[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(user?.id);
    params.push(id);

    const result = await pool.query(`
      UPDATE logistics.ellecleme_requests
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating ellecleme request:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

/**
 * @route POST /api/v1/ellecleme/requests/:id/submit
 * @desc Submit request for permit approval
 */
router.post('/requests/:id/submit', validateParams(requestIdSchema), validateBody(submitForPermitSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check request exists and is in draft status
      const existingResult = await client.query(`
        SELECT * FROM logistics.ellecleme_requests
        WHERE id = $1 AND is_deleted = FALSE
      `, [id]);

      if (existingResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Request not found' });
      }

      if (existingResult.rows[0].status !== 'draft') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Can only submit requests in draft status' });
      }

      // Update request status
      await client.query(`
        UPDATE logistics.ellecleme_requests
        SET status = 'pending_permit', updated_at = NOW(), updated_by = $2
        WHERE id = $1
      `, [id, user?.id]);

      // Create permit record
      const permitResult = await client.query(`
        INSERT INTO logistics.ellecleme_permits (
          request_id, permit_type, application_date,
          customs_office, status, notes, created_by
        ) VALUES ($1, $2, CURRENT_DATE, $3, 'submitted', $4, $5)
        RETURNING *
      `, [
        id,
        data.permit_type || 'standard',
        data.customs_office,
        data.notes,
        user?.id,
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          request_id: id,
          permit: permitResult.rows[0],
          message: 'Request submitted for permit approval',
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error submitting ellecleme request:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

/**
 * @route POST /api/v1/ellecleme/requests/:id/start
 * @desc Start execution (after permit approved)
 */
router.post('/requests/:id/start', validateParams(requestIdSchema), validateBody(startExecutionSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    // Check request exists and is approved
    const existingResult = await pool.query(`
      SELECT status FROM logistics.ellecleme_requests
      WHERE id = $1 AND is_deleted = FALSE
    `, [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (existingResult.rows[0].status !== 'approved') {
      return res.status(400).json({ error: 'Can only start execution on approved requests' });
    }

    const result = await pool.query(`
      UPDATE logistics.ellecleme_requests
      SET 
        status = 'in_progress',
        actual_start_date = COALESCE($2, CURRENT_DATE),
        execution_notes = $3,
        executed_by_user_id = $4,
        updated_at = NOW(),
        updated_by = $4
      WHERE id = $1
      RETURNING *
    `, [id, data.actual_start_date, data.execution_notes, user?.id]);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error starting ellecleme execution:', error);
    res.status(500).json({ error: 'Failed to start execution' });
  }
});

/**
 * @route POST /api/v1/ellecleme/requests/:id/complete
 * @desc Complete the request with results
 */
router.post('/requests/:id/complete', validateParams(requestIdSchema), validateBody(completeRequestSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check request exists and is in_progress
      const existingResult = await client.query(`
        SELECT * FROM logistics.ellecleme_requests
        WHERE id = $1 AND is_deleted = FALSE
      `, [id]);

      if (existingResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Request not found' });
      }

      if (existingResult.rows[0].status !== 'in_progress') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Can only complete requests that are in progress' });
      }

      // Update request - set to pending_confirmation so Hamza can confirm/reject
      const result = await client.query(`
        UPDATE logistics.ellecleme_requests
        SET 
          status = 'pending_confirmation',
          before_description = COALESCE($2, before_description),
          after_description = COALESCE($3, after_description),
          new_gtip = $4,
          gtip_changed = $5,
          actual_completion_date = COALESCE($6, CURRENT_DATE),
          execution_notes = COALESCE($7, execution_notes),
          updated_at = NOW(),
          updated_by = $8
        WHERE id = $1
        RETURNING *
      `, [
        id,
        data.before_description,
        data.after_description,
        data.new_gtip,
        data.gtip_changed || false,
        data.actual_completion_date,
        data.execution_notes,
        user?.id,
      ]);

      // Note: GTİP update happens only after Hamza confirms the result

      await client.query('COMMIT');

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error completing ellecleme request:', error);
    res.status(500).json({ error: 'Failed to complete request' });
  }
});

/**
 * @route POST /api/v1/ellecleme/requests/:id/cancel
 * @desc Cancel a request
 */
router.post('/requests/:id/cancel', validateParams(requestIdSchema), validateBody(cancelRequestSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    // Check request exists and is not completed
    const existingResult = await pool.query(`
      SELECT status FROM logistics.ellecleme_requests
      WHERE id = $1 AND is_deleted = FALSE
    `, [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (['completed', 'cancelled'].includes(existingResult.rows[0].status)) {
      return res.status(400).json({ error: 'Cannot cancel completed or already cancelled requests' });
    }

    const result = await pool.query(`
      UPDATE logistics.ellecleme_requests
      SET 
        status = 'cancelled',
        cancelled_reason = $2,
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $1
      RETURNING *
    `, [id, data.cancelled_reason, user?.id]);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error cancelling ellecleme request:', error);
    res.status(500).json({ error: 'Failed to cancel request' });
  }
});

/**
 * @route POST /api/v1/ellecleme/requests/:id/pickup
 * @desc Ragıp (Clearance) picks up a request to process
 */
router.post('/requests/:id/pickup', validateParams(requestIdSchema), validateBody(pickupRequestSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    // Check request exists and is in draft status
    const existingResult = await pool.query(`
      SELECT * FROM logistics.ellecleme_requests
      WHERE id = $1 AND is_deleted = FALSE
    `, [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (existingResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Can only pick up requests that are in draft status' });
    }

    const result = await pool.query(`
      UPDATE logistics.ellecleme_requests
      SET 
        processed_by_user_id = $2,
        picked_up_at = NOW(),
        status = 'pending_permit',
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $1
      RETURNING *
    `, [id, user?.id]);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error picking up ellecleme request:', error);
    res.status(500).json({ error: 'Failed to pick up request' });
  }
});

/**
 * @route POST /api/v1/ellecleme/requests/:id/confirm
 * @desc Hamza (Antrepo) confirms the result after Ragıp completes
 */
router.post('/requests/:id/confirm', validateParams(requestIdSchema), validateBody(confirmResultSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check request exists and is pending_confirmation
      const existingResult = await client.query(`
        SELECT * FROM logistics.ellecleme_requests
        WHERE id = $1 AND is_deleted = FALSE
      `, [id]);

      if (existingResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Request not found' });
      }

      if (existingResult.rows[0].status !== 'pending_confirmation') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Can only confirm requests that are pending confirmation' });
      }

      // Update request status to completed
      const result = await client.query(`
        UPDATE logistics.ellecleme_requests
        SET 
          status = 'completed',
          confirmed_by_user_id = $2,
          confirmed_at = NOW(),
          confirmation_notes = $3,
          result_rejected = FALSE,
          updated_at = NOW(),
          updated_by = $2
        WHERE id = $1
        RETURNING *
      `, [id, user?.id, data.confirmation_notes]);

      // Now apply GTİP change if applicable
      if (existingResult.rows[0].gtip_changed && existingResult.rows[0].new_gtip) {
        await client.query(`
          UPDATE logistics.antrepo_inventory
          SET product_gtip = $1, updated_at = NOW()
          WHERE id = $2
        `, [existingResult.rows[0].new_gtip, existingResult.rows[0].inventory_id]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Elleçleme result confirmed and applied to inventory',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error confirming ellecleme result:', error);
    res.status(500).json({ error: 'Failed to confirm result' });
  }
});

/**
 * @route POST /api/v1/ellecleme/requests/:id/reject-result
 * @desc Hamza (Antrepo) rejects the result after Ragıp completes
 */
router.post('/requests/:id/reject-result', validateParams(requestIdSchema), validateBody(rejectResultSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    // Check request exists and is pending_confirmation
    const existingResult = await pool.query(`
      SELECT status FROM logistics.ellecleme_requests
      WHERE id = $1 AND is_deleted = FALSE
    `, [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (existingResult.rows[0].status !== 'pending_confirmation') {
      return res.status(400).json({ error: 'Can only reject results that are pending confirmation' });
    }

    // Reject the result - returns to in_progress so Ragıp can redo
    const result = await pool.query(`
      UPDATE logistics.ellecleme_requests
      SET 
        status = 'in_progress',
        result_rejected = TRUE,
        result_rejection_reason = $2,
        result_rejected_at = NOW(),
        result_rejected_by = $3,
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $1
      RETURNING *
    `, [id, data.rejection_reason, user?.id]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Result rejected. Request returned to in-progress for revision.',
    });
  } catch (error) {
    logger.error('Error rejecting ellecleme result:', error);
    res.status(500).json({ error: 'Failed to reject result' });
  }
});

/**
 * @route GET /api/v1/ellecleme/shipments/:shipmentId/history
 * @desc Get Elleçleme history for a shipment
 */
router.get('/shipments/:shipmentId/history', async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;

    const result = await pool.query(`
      SELECT 
        er.id,
        er.request_number,
        er.activity_code,
        er.activity_name,
        er.activity_name_ar,
        er.activity_name_tr,
        er.status,
        er.quantity_mt,
        er.original_gtip,
        er.new_gtip,
        er.gtip_changed,
        er.before_description,
        er.after_description,
        er.requested_date,
        er.actual_completion_date,
        er.confirmed_at,
        er.result_rejected,
        er.result_rejection_reason,
        er.created_at,
        ai.product_text,
        ai.origin_country,
        al.code AS lot_code,
        al.name AS lot_name,
        req_user.name AS requested_by_name,
        proc_user.name AS processed_by_name,
        conf_user.name AS confirmed_by_name,
        -- Cost summary
        COALESCE(costs.total_cost, 0) AS total_cost,
        costs.cost_currency
      FROM logistics.ellecleme_requests er
      JOIN logistics.antrepo_inventory ai ON er.inventory_id = ai.id
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      LEFT JOIN security.users req_user ON er.requested_by_user_id = req_user.id
      LEFT JOIN security.users proc_user ON er.processed_by_user_id = proc_user.id
      LEFT JOIN security.users conf_user ON er.confirmed_by_user_id = conf_user.id
      LEFT JOIN LATERAL (
        SELECT 
          SUM(amount) AS total_cost,
          MAX(currency) AS cost_currency
        FROM logistics.ellecleme_costs 
        WHERE request_id = er.id
      ) costs ON TRUE
      WHERE ai.shipment_id = $1 AND er.is_deleted = FALSE
      ORDER BY er.created_at DESC
    `, [shipmentId]);

    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    logger.error('Error fetching shipment ellecleme history:', error);
    res.status(500).json({ error: 'Failed to fetch ellecleme history' });
  }
});

// ============================================================
// PERMITS
// ============================================================

/**
 * @route GET /api/v1/ellecleme/permits
 * @desc List permits
 */
router.get('/permits', validateQuery(permitFiltersSchema), async (req: Request, res: Response) => {
  try {
    const { request_id, status, date_from, date_to, page, limit } = req.query as any;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (request_id) {
      conditions.push(`ep.request_id = $${paramIndex++}`);
      params.push(request_id);
    }

    if (status) {
      conditions.push(`ep.status = $${paramIndex++}`);
      params.push(status);
    }

    if (date_from) {
      conditions.push(`ep.application_date >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`ep.application_date <= $${paramIndex++}`);
      params.push(date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT 
        ep.*,
        er.request_number,
        er.activity_code,
        er.activity_name,
        ai.product_text,
        al.code AS lot_code,
        s.sn AS shipment_sn
      FROM logistics.ellecleme_permits ep
      JOIN logistics.ellecleme_requests er ON ep.request_id = er.id
      JOIN logistics.antrepo_inventory ai ON er.inventory_id = ai.id
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      ${whereClause}
      ORDER BY ep.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching permits:', error);
    res.status(500).json({ error: 'Failed to fetch permits' });
  }
});

/**
 * @route PUT /api/v1/ellecleme/permits/:id/approve
 * @desc Approve a permit
 */
router.put('/permits/:id/approve', validateParams(permitIdSchema), validateBody(approvePermitSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = req.body;

    const result = await pool.query(`
      UPDATE logistics.ellecleme_permits
      SET 
        status = 'approved',
        approval_date = COALESCE($2, CURRENT_DATE),
        approval_ref = $3,
        valid_from = COALESCE($4, CURRENT_DATE),
        valid_until = $5,
        notes = COALESCE($6, notes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, data.approval_date, data.approval_ref, data.valid_from, data.valid_until, data.notes]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error approving permit:', error);
    res.status(500).json({ error: 'Failed to approve permit' });
  }
});

/**
 * @route PUT /api/v1/ellecleme/permits/:id/reject
 * @desc Reject a permit
 */
router.put('/permits/:id/reject', validateParams(permitIdSchema), validateBody(rejectPermitSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const result = await pool.query(`
      UPDATE logistics.ellecleme_permits
      SET 
        status = 'rejected',
        rejection_date = COALESCE($2, CURRENT_DATE),
        rejection_reason = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, data.rejection_date, data.rejection_reason]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error rejecting permit:', error);
    res.status(500).json({ error: 'Failed to reject permit' });
  }
});

// ============================================================
// COSTS
// ============================================================

/**
 * @route GET /api/v1/ellecleme/costs
 * @desc List costs
 */
router.get('/costs', validateQuery(costFiltersSchema), async (req: Request, res: Response) => {
  try {
    const { request_id, cost_type, include_in_customs_value, page, limit } = req.query as any;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (request_id) {
      conditions.push(`ec.request_id = $${paramIndex++}`);
      params.push(request_id);
    }

    if (cost_type) {
      conditions.push(`ec.cost_type = $${paramIndex++}`);
      params.push(cost_type);
    }

    if (include_in_customs_value !== undefined) {
      conditions.push(`ec.include_in_customs_value = $${paramIndex++}`);
      params.push(include_in_customs_value);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT 
        ec.*,
        er.request_number
      FROM logistics.ellecleme_costs ec
      JOIN logistics.ellecleme_requests er ON ec.request_id = er.id
      ${whereClause}
      ORDER BY ec.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching costs:', error);
    res.status(500).json({ error: 'Failed to fetch costs' });
  }
});

/**
 * @route POST /api/v1/ellecleme/costs
 * @desc Add a cost entry
 */
router.post('/costs', validateBody(createCostSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = req.body;

    // Verify request exists
    const requestResult = await pool.query(`
      SELECT id FROM logistics.ellecleme_requests
      WHERE id = $1 AND is_deleted = FALSE
    `, [data.request_id]);

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const result = await pool.query(`
      INSERT INTO logistics.ellecleme_costs (
        request_id, cost_type, description, description_ar, description_tr,
        amount, currency,
        labor_hours, labor_rate, worker_count,
        material_quantity, material_unit, material_unit_price,
        include_in_customs_value, customs_value_justification,
        vendor_name, invoice_no, invoice_date,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      data.request_id,
      data.cost_type,
      data.description,
      data.description_ar,
      data.description_tr,
      data.amount,
      data.currency || 'TRY',
      data.labor_hours,
      data.labor_rate,
      data.worker_count,
      data.material_quantity,
      data.material_unit,
      data.material_unit_price,
      data.include_in_customs_value || false,
      data.customs_value_justification,
      data.vendor_name,
      data.invoice_no,
      data.invoice_date,
      user?.id,
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating cost:', error);
    res.status(500).json({ error: 'Failed to create cost' });
  }
});

/**
 * @route DELETE /api/v1/ellecleme/costs/:id
 * @desc Delete a cost entry
 */
router.delete('/costs/:id', validateParams(costIdSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM logistics.ellecleme_costs WHERE id = $1 RETURNING id
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cost not found' });
    }

    res.json({
      success: true,
      message: 'Cost deleted',
    });
  } catch (error) {
    logger.error('Error deleting cost:', error);
    res.status(500).json({ error: 'Failed to delete cost' });
  }
});

/**
 * @route GET /api/v1/ellecleme/costs/summary
 * @desc Get cost summary by request
 */
router.get('/costs/summary', async (req: Request, res: Response) => {
  try {
    const { request_id } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (request_id) {
      conditions.push(`request_id = $${paramIndex++}`);
      params.push(request_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT 
        cost_type,
        currency,
        SUM(amount) AS total_amount,
        COUNT(*) AS entry_count,
        SUM(CASE WHEN include_in_customs_value THEN amount ELSE 0 END) AS customs_value_total
      FROM logistics.ellecleme_costs
      ${whereClause}
      GROUP BY cost_type, currency
      ORDER BY cost_type
    `, params);

    // Get grand totals
    const totalsResult = await pool.query(`
      SELECT 
        currency,
        SUM(amount) AS grand_total,
        SUM(CASE WHEN include_in_customs_value THEN amount ELSE 0 END) AS customs_value_total
      FROM logistics.ellecleme_costs
      ${whereClause}
      GROUP BY currency
    `, params);

    res.json({
      success: true,
      data: {
        by_type: result.rows,
        totals: totalsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching cost summary:', error);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

// ============================================================
// DOCUMENTS
// ============================================================

/**
 * @route GET /api/v1/ellecleme/documents
 * @desc List documents for a request
 */
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const { request_id } = req.query;

    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }

    const result = await pool.query(`
      SELECT * FROM logistics.ellecleme_documents
      WHERE request_id = $1 AND is_deleted = FALSE
      ORDER BY uploaded_at DESC
    `, [request_id]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * @route POST /api/v1/ellecleme/documents
 * @desc Upload a document
 */
router.post('/documents', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { request_id, document_type, title, description, taken_at, location_description } = req.body;

    if (!request_id) {
      // Delete uploaded file
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'request_id is required' });
    }

    // Verify request exists
    const requestResult = await pool.query(`
      SELECT id FROM logistics.ellecleme_requests
      WHERE id = $1 AND is_deleted = FALSE
    `, [request_id]);

    if (requestResult.rowCount === 0) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Request not found' });
    }

    const result = await pool.query(`
      INSERT INTO logistics.ellecleme_documents (
        request_id, document_type, file_name, file_path,
        file_size, mime_type, title, description,
        taken_at, location_description, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      request_id,
      document_type || 'other',
      file.originalname,
      file.path,
      file.size,
      file.mimetype,
      title,
      description,
      taken_at,
      location_description,
      user?.id,
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/**
 * @route DELETE /api/v1/ellecleme/documents/:id
 * @desc Delete a document (soft delete)
 */
router.delete('/documents/:id', validateParams(documentIdSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE logistics.ellecleme_documents
      SET is_deleted = TRUE, deleted_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      success: true,
      message: 'Document deleted',
    });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ============================================================
// ACTIVITY TYPES
// ============================================================

/**
 * @route GET /api/v1/ellecleme/activity-types
 * @desc Get Ek-63 activity types list
 */
router.get('/activity-types', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM master_data.antrepo_activity_types
      ORDER BY sort_order, code
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching activity types:', error);
    res.status(500).json({ error: 'Failed to fetch activity types' });
  }
});

// ============================================================
// REPORTS
// ============================================================

/**
 * @route GET /api/v1/ellecleme/reports/summary
 * @desc Get summary report for a period
 */
router.get('/reports/summary', validateQuery(reportFiltersSchema), async (req: Request, res: Response) => {
  try {
    const { date_from, date_to, activity_code, status, lot_id, inventory_id } = req.query as any;

    const conditions: string[] = ['er.is_deleted = FALSE'];
    const params: any[] = [];
    let paramIndex = 1;

    if (date_from) {
      conditions.push(`er.requested_date >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`er.requested_date <= $${paramIndex++}`);
      params.push(date_to);
    }

    if (activity_code) {
      conditions.push(`er.activity_code = $${paramIndex++}`);
      params.push(activity_code);
    }

    if (status) {
      conditions.push(`er.status = $${paramIndex++}`);
      params.push(status);
    }

    if (lot_id) {
      conditions.push(`ai.lot_id = $${paramIndex++}`);
      params.push(lot_id);
    }

    if (inventory_id) {
      conditions.push(`er.inventory_id = $${paramIndex++}`);
      params.push(inventory_id);
    }

    const whereClause = conditions.join(' AND ');

    // Summary by status
    const statusSummary = await pool.query(`
      SELECT 
        er.status,
        COUNT(*) AS count,
        SUM(er.quantity_mt) AS total_quantity_mt
      FROM logistics.ellecleme_requests er
      JOIN logistics.antrepo_inventory ai ON er.inventory_id = ai.id
      WHERE ${whereClause}
      GROUP BY er.status
    `, params);

    // Summary by activity
    const activitySummary = await pool.query(`
      SELECT 
        er.activity_code,
        er.activity_name,
        er.activity_name_ar,
        er.activity_name_tr,
        COUNT(*) AS count,
        SUM(er.quantity_mt) AS total_quantity_mt
      FROM logistics.ellecleme_requests er
      JOIN logistics.antrepo_inventory ai ON er.inventory_id = ai.id
      WHERE ${whereClause}
      GROUP BY er.activity_code, er.activity_name, er.activity_name_ar, er.activity_name_tr
      ORDER BY count DESC
    `, params);

    // Cost summary
    const costSummary = await pool.query(`
      SELECT 
        ec.cost_type,
        ec.currency,
        SUM(ec.amount) AS total_amount,
        SUM(CASE WHEN ec.include_in_customs_value THEN ec.amount ELSE 0 END) AS customs_value_total
      FROM logistics.ellecleme_costs ec
      JOIN logistics.ellecleme_requests er ON ec.request_id = er.id
      JOIN logistics.antrepo_inventory ai ON er.inventory_id = ai.id
      WHERE ${whereClause}
      GROUP BY ec.cost_type, ec.currency
    `, params);

    res.json({
      success: true,
      data: {
        by_status: statusSummary.rows,
        by_activity: activitySummary.rows,
        costs: costSummary.rows,
        filters: { date_from, date_to, activity_code, status, lot_id, inventory_id },
      },
    });
  } catch (error) {
    logger.error('Error generating summary report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * @route GET /api/v1/ellecleme/reports/tutanak/:id
 * @desc Generate Elleçleme Tutanağı (Handling Protocol) for a request
 */
router.get('/reports/tutanak/:id', validateParams(requestIdSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get full request data
    const requestResult = await pool.query(`
      SELECT * FROM logistics.v_ellecleme_requests WHERE id = $1
    `, [id]);

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Only allow tutanak for completed requests
    if (request.status !== 'completed') {
      return res.status(400).json({ error: 'Tutanak can only be generated for completed requests' });
    }

    // Get permits
    const permitsResult = await pool.query(`
      SELECT * FROM logistics.ellecleme_permits
      WHERE request_id = $1 AND status = 'approved'
      ORDER BY approval_date DESC
      LIMIT 1
    `, [id]);

    // Get costs
    const costsResult = await pool.query(`
      SELECT 
        cost_type,
        SUM(amount) as total,
        currency
      FROM logistics.ellecleme_costs
      WHERE request_id = $1
      GROUP BY cost_type, currency
    `, [id]);

    // Get documents count
    const docsResult = await pool.query(`
      SELECT 
        document_type,
        COUNT(*) as count
      FROM logistics.ellecleme_documents
      WHERE request_id = $1 AND is_deleted = FALSE
      GROUP BY document_type
    `, [id]);

    // Generate tutanak data (HTML format for now - can be converted to PDF)
    const tutanak = {
      request_number: request.request_number,
      generated_at: new Date().toISOString(),
      // Request info
      activity_code: request.activity_code,
      activity_name: request.activity_name,
      activity_name_tr: request.activity_name_tr,
      // Inventory info
      lot_code: request.lot_code,
      lot_name: request.lot_name,
      product_text: request.product_text,
      shipment_sn: request.shipment_sn,
      supplier_name: request.supplier_name,
      origin_country: request.origin_country,
      // Quantities
      quantity_mt: request.quantity_mt,
      quantity_bags: request.quantity_bags,
      // GTİP
      original_gtip: request.original_gtip,
      gtip_changed: request.gtip_changed,
      new_gtip: request.new_gtip,
      // Dates
      requested_date: request.requested_date,
      actual_start_date: request.actual_start_date,
      actual_completion_date: request.actual_completion_date,
      // Execution details
      before_description: request.before_description,
      after_description: request.after_description,
      execution_notes: request.execution_notes,
      executed_by_name: request.executed_by_name,
      // Permit
      permit: permitsResult.rows[0] || null,
      // Costs summary
      costs: costsResult.rows,
      total_cost: request.total_cost,
      customs_value_cost: request.total_customs_value_cost,
      // Documents
      documents: docsResult.rows,
    };

    res.json({
      success: true,
      data: tutanak,
    });
  } catch (error) {
    logger.error('Error generating tutanak:', error);
    res.status(500).json({ error: 'Failed to generate tutanak' });
  }
});

export default router;
