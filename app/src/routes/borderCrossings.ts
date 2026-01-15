import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { loadUserBranches, BranchFilterRequest } from '../middleware/branchFilter';
import logger from '../utils/logger';

const router = Router();

// Load user branches for filtering
router.use(loadUserBranches);

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const borderCrossingIdSchema = z.object({
  id: z.string().uuid('Invalid border crossing ID'),
});

const createBorderCrossingSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  name_ar: z.string().max(100).optional().nullable(),
  country_from: z.string().min(1, 'Country from is required').max(100),
  country_to: z.string().min(1, 'Country to is required').max(100),
  location: z.string().max(255).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const updateBorderCrossingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  name_ar: z.string().max(100).optional().nullable(),
  country_from: z.string().min(1).max(100).optional(),
  country_to: z.string().min(1).max(100).optional(),
  location: z.string().max(255).optional().nullable(),
  is_active: z.boolean().optional(),
});

const listBorderCrossingsSchema = z.object({
  country_from: z.string().optional(),
  country_to: z.string().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

// Border shipments schemas
const borderShipmentsFiltersSchema = z.object({
  stage: z.enum(['pending_at_pod', 'on_the_way', 'arrived_at_border', 'clearing', 'cleared']).optional(),
  border_crossing_id: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.preprocess(
    (val) => (val === undefined || val === '' ? undefined : Number(val)),
    z.number().int().positive().optional().default(1)
  ),
  limit: z.preprocess(
    (val) => (val === undefined || val === '' ? undefined : Number(val)),
    z.number().int().positive().max(100).optional().default(50)
  ),
});

const shipmentIdSchema = z.object({
  id: z.string().uuid('Invalid shipment ID'),
});

const updateBorderStageSchema = z.object({
  stage: z.enum(['pending_at_pod', 'on_the_way', 'arrived_at_border', 'clearing', 'cleared']),
  notes: z.string().optional(),
});

const borderCostsSchema = z.object({
  border_clearance_cost: z.number().nonnegative(),
  internal_transport_cost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  currency: z.string().default('USD'),
});

// ============================================================
// ROUTES
// ============================================================

/**
 * @route GET /api/border-crossings
 * @desc Get list of all border crossings with optional filters
 * @access Public (all authenticated users can view)
 */
router.get(
  '/',
  validateQuery(listBorderCrossingsSchema),
  async (req: Request, res: Response) => {
    try {
      const { country_from, country_to, is_active, search } = req.query;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (country_from) {
        conditions.push(`country_from ILIKE $${paramIndex}`);
        params.push(`%${country_from}%`);
        paramIndex++;
      }

      if (country_to) {
        conditions.push(`country_to ILIKE $${paramIndex}`);
        params.push(`%${country_to}%`);
        paramIndex++;
      }

      if (is_active !== undefined) {
        conditions.push(`is_active = $${paramIndex}`);
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (search) {
        conditions.push(`(name ILIKE $${paramIndex} OR name_ar ILIKE $${paramIndex} OR location ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query(
        `SELECT 
          id, name, name_ar, country_from, country_to, location, is_active,
          created_at, updated_at
        FROM master_data.border_crossings
        ${whereClause}
        ORDER BY country_from, country_to, name`,
        params
      );

      res.json({
        success: true,
        data: result.rows,
        total: result.rowCount,
      });
    } catch (error) {
      logger.error('Error fetching border crossings:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch border crossings' 
      });
    }
  }
);

// ============================================================
// BORDER SHIPMENTS ENDPOINTS (for Border Agent Interface)
// These routes MUST be defined before /:id to prevent conflicts
// ============================================================

/**
 * @route GET /api/border-crossings/border-shipments
 * @desc Get cross-border shipments for border agent interface
 *       Auto-shows shipments based on:
 *       - is_cross_border = true
 *       - customs_clearance_date IS NOT NULL
 *       - User's branch matches shipment's final destination branch
 * @access Authenticated users with branch access
 */
router.get(
  '/border-shipments',
  validateQuery(borderShipmentsFiltersSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const branchReq = req as BranchFilterRequest;
      
      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { stage, border_crossing_id, search, page, limit } = req.query as any;
      const offset = (Number(page || 1) - 1) * Number(limit || 50);

      // Build WHERE conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filter by stage if provided
      if (stage) {
        conditions.push(`(s.border_stage = $${paramIndex} OR s.calculated_stage = $${paramIndex})`);
        params.push(stage);
        paramIndex++;
      }

      // Filter by border crossing if provided
      if (border_crossing_id) {
        conditions.push(`s.primary_border_crossing_id = $${paramIndex}`);
        params.push(border_crossing_id);
        paramIndex++;
      }

      // Search filter
      if (search) {
        conditions.push(`(
          s.sn ILIKE $${paramIndex} OR
          s.product_text ILIKE $${paramIndex} OR
          s.supplier_name ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Branch filter - filter by final destination branch
      // Admins and Execs see all, others see their branches only
      const userBranchIds = branchReq.userBranchIds || [];
      const isGlobalRole = branchReq.hasGlobalAccess;
      
      if (!isGlobalRole && userBranchIds.length > 0) {
        const branchPlaceholders = userBranchIds.map((_: string, i: number) => `$${paramIndex + i}`).join(', ');
        conditions.push(`s.final_destination_branch_id IN (${branchPlaceholders})`);
        params.push(...userBranchIds);
        paramIndex += userBranchIds.length;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM logistics.v_border_agent_shipments s ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Data query
      const actualLimit = Number(limit || 50);
      params.push(actualLimit, offset);
      const result = await pool.query(
        `SELECT 
          s.*
        FROM logistics.v_border_agent_shipments s
        ${whereClause}
        ORDER BY 
          CASE s.border_stage 
            WHEN 'pending_at_pod' THEN 1 
            WHEN 'on_the_way' THEN 2 
            WHEN 'arrived_at_border' THEN 3
            WHEN 'clearing' THEN 4
            ELSE 5 
          END,
          s.earliest_border_eta ASC NULLS LAST,
          s.customs_clearance_date DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      // Calculate summary counts
      const summaryResult = await pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE COALESCE(border_stage, calculated_stage) = 'pending_at_pod') as pending_at_pod,
          COUNT(*) FILTER (WHERE COALESCE(border_stage, calculated_stage) = 'on_the_way') as on_the_way,
          COUNT(*) FILTER (WHERE COALESCE(border_stage, calculated_stage) = 'arrived_at_border') as arrived_at_border,
          COUNT(*) FILTER (WHERE COALESCE(border_stage, calculated_stage) = 'clearing') as clearing,
          COUNT(*) FILTER (WHERE COALESCE(border_stage, calculated_stage) = 'cleared') as cleared
        FROM logistics.v_border_agent_shipments s
        ${isGlobalRole ? '' : (userBranchIds.length > 0 ? `WHERE s.final_destination_branch_id IN (${userBranchIds.map((_: string, i: number) => `$${i + 1}`).join(', ')})` : '')}`,
        isGlobalRole ? [] : userBranchIds
      );

      res.json({
        success: true,
        data: result.rows,
        summary: {
          pending_at_pod: parseInt(summaryResult.rows[0].pending_at_pod, 10),
          on_the_way: parseInt(summaryResult.rows[0].on_the_way, 10),
          arrived_at_border: parseInt(summaryResult.rows[0].arrived_at_border, 10),
          clearing: parseInt(summaryResult.rows[0].clearing, 10),
          cleared: parseInt(summaryResult.rows[0].cleared, 10),
        },
        pagination: {
          page: Number(page || 1),
          limit: actualLimit,
          total,
          pages: Math.ceil(total / actualLimit),
        },
      });
    } catch (error) {
      logger.error('Error fetching border shipments:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch border shipments' 
      });
    }
  }
);

/**
 * @route GET /api/border-crossings/border-shipments/:id
 * @desc Get single border shipment details
 * @access Authenticated users
 */
router.get(
  '/border-shipments/:id',
  validateParams(shipmentIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT * FROM logistics.v_border_agent_shipments WHERE id = $1`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Border shipment not found' 
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      logger.error('Error fetching border shipment:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch border shipment' 
      });
    }
  }
);

/**
 * @route PATCH /api/border-crossings/border-shipments/:id/stage
 * @desc Update the border stage of a shipment
 * @access Authenticated users (Border Agent, Admin)
 */
router.patch(
  '/border-shipments/:id/stage',
  validateParams(shipmentIdSchema),
  validateBody(updateBorderStageSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { stage, notes } = req.body;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if shipment exists and is cross-border
      const shipmentCheck = await pool.query(
        `SELECT s.id, s.border_stage, sl.is_cross_border 
         FROM logistics.shipments s
         JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
         WHERE s.id = $1 AND s.is_deleted = FALSE`,
        [id]
      );

      if (shipmentCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      const shipment = shipmentCheck.rows[0];
      if (!shipment.is_cross_border) {
        return res.status(400).json({ error: 'Shipment is not a cross-border shipment' });
      }

      // Validate stage transition
      const validTransitions: Record<string, string[]> = {
        'pending_at_pod': ['on_the_way'],
        'on_the_way': ['arrived_at_border'],
        'arrived_at_border': ['clearing'],
        'clearing': ['cleared'],
        'cleared': [], // Final state
      };

      const currentStage = shipment.border_stage || 'pending_at_pod';
      
      // Allow any transition for admin, or valid transitions for others
      const isAdmin = ['Admin', 'Administrator', 'Exec'].includes(user.role);
      if (!isAdmin && !validTransitions[currentStage]?.includes(stage)) {
        return res.status(400).json({ 
          error: `Invalid stage transition from ${currentStage} to ${stage}` 
        });
      }

      // Build update query
      const updates: string[] = ['border_stage = $1', 'updated_at = NOW()'];
      const updateParams: any[] = [stage];
      let paramIdx = 2;

      // Auto-set dates based on stage
      if (stage === 'arrived_at_border') {
        updates.push(`border_arrival_date = COALESCE(border_arrival_date, CURRENT_DATE)`);
      }
      if (stage === 'cleared') {
        updates.push(`border_clearance_date = COALESCE(border_clearance_date, CURRENT_DATE)`);
      }

      // Add notes if provided
      if (notes) {
        updates.push(`notes = COALESCE(notes || E'\\n', '') || $${paramIdx}`);
        updateParams.push(`[${new Date().toISOString()}] Border: ${notes}`);
        paramIdx++;
      }

      updateParams.push(id);

      const result = await pool.query(
        `UPDATE logistics.shipments 
         SET ${updates.join(', ')}
         WHERE id = $${paramIdx}
         RETURNING id, border_stage, border_arrival_date, border_clearance_date`,
        updateParams
      );

      res.json({
        success: true,
        data: result.rows[0],
        message: `Border stage updated to ${stage}`,
      });
    } catch (error) {
      logger.error('Error updating border stage:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update border stage' 
      });
    }
  }
);

/**
 * @route POST /api/border-crossings/border-shipments/:id/costs
 * @desc Enter border clearance and transport costs for a shipment
 * @access Authenticated users (Border Agent, Admin)
 */
router.post(
  '/border-shipments/:id/costs',
  validateParams(shipmentIdSchema),
  validateBody(borderCostsSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { border_clearance_cost, internal_transport_cost, notes, currency } = req.body;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get shipment info
      const shipmentResult = await pool.query(
        `SELECT 
          s.id, s.sn, s.border_stage,
          sl.primary_border_crossing_id,
          sc.product_text, sc.weight_ton,
          bc.name as border_name
         FROM logistics.shipments s
         JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
         LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
         LEFT JOIN master_data.border_crossings bc ON bc.id = sl.primary_border_crossing_id
         WHERE s.id = $1 AND s.is_deleted = FALSE`,
        [id]
      );

      if (shipmentResult.rowCount === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      const shipmentData = shipmentResult.rows[0];

      // Check if cost entry already exists for this shipment at border
      const existingCost = await pool.query(
        `SELECT id FROM finance.customs_clearing_costs 
         WHERE shipment_id = $1 
         AND clearance_type = 'border_crossing' 
         AND is_deleted = FALSE`,
        [id]
      );

      if (existingCost.rowCount && existingCost.rowCount > 0) {
        // Update existing record
        const updateResult = await pool.query(
          `UPDATE finance.customs_clearing_costs 
           SET total_clearing_cost = $1,
               extra_cost_amount = $2,
               extra_cost_description = $3,
               notes = COALESCE(notes || E'\\n', '') || $4,
               currency = $5,
               updated_at = NOW(),
               updated_by = $6
           WHERE id = $7
           RETURNING *`,
          [
            border_clearance_cost,
            internal_transport_cost || 0,
            internal_transport_cost ? 'Internal transport from border to FD' : null,
            notes ? `[${new Date().toISOString()}] ${notes}` : '',
            currency,
            user.username,
            existingCost.rows[0].id
          ]
        );

        return res.json({
          success: true,
          data: updateResult.rows[0],
          message: 'Border costs updated successfully',
          updated: true,
        });
      }

      // Generate file number
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM finance.customs_clearing_costs WHERE clearance_type = 'border_crossing'`
      );
      const count = parseInt(countResult.rows[0].count, 10) + 1;
      const fileNumber = `BC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

      // Create new cost entry
      const result = await pool.query(
        `INSERT INTO finance.customs_clearing_costs (
          file_number, shipment_id, clearance_type, 
          border_crossing_id, stage_order,
          transaction_description, goods_type, goods_weight,
          total_clearing_cost, extra_cost_amount, extra_cost_description,
          notes, currency, clearance_status, clearance_date,
          created_by, updated_by
        ) VALUES (
          $1, $2, 'border_crossing',
          $3, 2,
          $4, $5, $6,
          $7, $8, $9,
          $10, $11, 'cleared', CURRENT_DATE,
          $12, $13
        ) RETURNING *`,
        [
          fileNumber,
          id,
          shipmentData.primary_border_crossing_id,
          `Border clearance at ${shipmentData.border_name || 'border'}`,
          shipmentData.product_text,
          shipmentData.weight_ton ? `${shipmentData.weight_ton} MT` : null,
          border_clearance_cost,
          internal_transport_cost || 0,
          internal_transport_cost ? 'Internal transport from border to FD' : null,
          notes ? `[${new Date().toISOString()}] ${notes}` : null,
          currency,
          user.username,
          user.username,
        ]
      );

      // Update shipment stage to cleared if not already
      if (shipmentData.border_stage !== 'cleared') {
        await pool.query(
          `UPDATE logistics.shipments 
           SET border_stage = 'cleared',
               border_clearance_date = COALESCE(border_clearance_date, CURRENT_DATE),
               updated_at = NOW()
           WHERE id = $1`,
          [id]
        );
      }

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Border costs entered successfully',
        created: true,
      });
    } catch (error) {
      logger.error('Error entering border costs:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to enter border costs' 
      });
    }
  }
);

// ============================================================
// BORDER CROSSINGS CRUD ENDPOINTS
// ============================================================

/**
 * @route GET /api/border-crossings/:id
 * @desc Get a single border crossing by ID
 * @access Public
 */
router.get(
  '/:id',
  validateParams(borderCrossingIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT 
          id, name, name_ar, country_from, country_to, location, is_active,
          created_at, updated_at
        FROM master_data.border_crossings
        WHERE id = $1`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Border crossing not found' 
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      logger.error('Error fetching border crossing:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch border crossing' 
      });
    }
  }
);

/**
 * @route POST /api/border-crossings
 * @desc Create a new border crossing (Admin only)
 * @access Admin
 */
router.post(
  '/',
  validateBody(createBorderCrossingSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check admin access
      if (!user || !['Admin', 'Administrator', 'Exec'].includes(user.role)) {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

      const { name, name_ar, country_from, country_to, location, is_active } = req.body;

      // Check for duplicate name
      const existingCheck = await pool.query(
        `SELECT id FROM master_data.border_crossings WHERE LOWER(name) = LOWER($1)`,
        [name]
      );

      if (existingCheck.rowCount && existingCheck.rowCount > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'A border crossing with this name already exists' 
        });
      }

      const result = await pool.query(
        `INSERT INTO master_data.border_crossings 
          (name, name_ar, country_from, country_to, location, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [name, name_ar || null, country_from, country_to, location || null, is_active ?? true]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Border crossing created successfully',
      });
    } catch (error) {
      logger.error('Error creating border crossing:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create border crossing' 
      });
    }
  }
);

/**
 * @route PUT /api/border-crossings/:id
 * @desc Update a border crossing (Admin only)
 * @access Admin
 */
router.put(
  '/:id',
  validateParams(borderCrossingIdSchema),
  validateBody(updateBorderCrossingSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check admin access
      if (!user || !['Admin', 'Administrator', 'Exec'].includes(user.role)) {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

      const { id } = req.params;
      const updates = req.body;

      // Check if border crossing exists
      const existingCheck = await pool.query(
        `SELECT id FROM master_data.border_crossings WHERE id = $1`,
        [id]
      );

      if (existingCheck.rowCount === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Border crossing not found' 
        });
      }

      // Check for duplicate name if name is being updated
      if (updates.name) {
        const duplicateCheck = await pool.query(
          `SELECT id FROM master_data.border_crossings 
           WHERE LOWER(name) = LOWER($1) AND id != $2`,
          [updates.name, id]
        );

        if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'A border crossing with this name already exists' 
          });
        }
      }

      // Build dynamic UPDATE query
      const setClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      const allowedFields = ['name', 'name_ar', 'country_from', 'country_to', 'location', 'is_active'];
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          setClauses.push(`${field} = $${paramIndex}`);
          params.push(updates[field]);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No valid fields to update' 
        });
      }

      // Add updated_at
      setClauses.push(`updated_at = NOW()`);

      params.push(id);

      const result = await pool.query(
        `UPDATE master_data.border_crossings 
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        params
      );

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Border crossing updated successfully',
      });
    } catch (error) {
      logger.error('Error updating border crossing:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update border crossing' 
      });
    }
  }
);

/**
 * @route DELETE /api/border-crossings/:id
 * @desc Soft delete a border crossing (Admin only) - actually just deactivates it
 * @access Admin
 */
router.delete(
  '/:id',
  validateParams(borderCrossingIdSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check admin access
      if (!user || !['Admin', 'Administrator', 'Exec'].includes(user.role)) {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

      const { id } = req.params;

      // Check if border crossing exists
      const existingCheck = await pool.query(
        `SELECT id FROM master_data.border_crossings WHERE id = $1`,
        [id]
      );

      if (existingCheck.rowCount === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Border crossing not found' 
        });
      }

      // Check if border crossing is in use
      const usageCheck = await pool.query(
        `SELECT COUNT(*) as count FROM (
          SELECT id FROM logistics.shipment_logistics WHERE primary_border_crossing_id = $1
          UNION ALL
          SELECT id FROM finance.customs_clearing_costs WHERE border_crossing_id = $1
        ) AS usage`,
        [id]
      );

      const usageCount = parseInt(usageCheck.rows[0].count, 10);

      if (usageCount > 0) {
        // If in use, just deactivate instead of delete
        await pool.query(
          `UPDATE master_data.border_crossings 
           SET is_active = FALSE, updated_at = NOW()
           WHERE id = $1`,
          [id]
        );

        return res.json({
          success: true,
          message: 'Border crossing deactivated (in use by existing records)',
          deactivated: true,
        });
      }

      // If not in use, actually delete
      await pool.query(
        `DELETE FROM master_data.border_crossings WHERE id = $1`,
        [id]
      );

      res.json({
        success: true,
        message: 'Border crossing deleted successfully',
        deleted: true,
      });
    } catch (error) {
      logger.error('Error deleting border crossing:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete border crossing' 
      });
    }
  }
);

/**
 * @route GET /api/border-crossings/by-route/:country_from/:country_to
 * @desc Get border crossings for a specific route (e.g., Turkey to Iraq)
 * @access Public
 */
router.get(
  '/by-route/:country_from/:country_to',
  async (req: Request, res: Response) => {
    try {
      const { country_from, country_to } = req.params;

      const result = await pool.query(
        `SELECT 
          id, name, name_ar, country_from, country_to, location, is_active
        FROM master_data.border_crossings
        WHERE country_from ILIKE $1 
          AND country_to ILIKE $2
          AND is_active = TRUE
        ORDER BY name`,
        [country_from, country_to]
      );

      res.json({
        success: true,
        data: result.rows,
        total: result.rowCount,
      });
    } catch (error) {
      logger.error('Error fetching border crossings by route:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch border crossings' 
      });
    }
  }
);

export default router;
