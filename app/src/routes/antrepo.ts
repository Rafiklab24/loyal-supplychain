/**
 * Antrepo (Customs Warehouse) Management API Routes
 * 
 * Endpoints for managing:
 * - Lots (physical storage locations)
 * - Inventory (goods currently stored)
 * - Exits (transit, port, domestic)
 * - Handling activities (elleçleme)
 * - Storage fees (for third-party goods)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { loadUserBranches, BranchFilterRequest, buildAntrepoBranchFilter, getUserAntrepoBranches } from '../middleware/branchFilter';
import logger from '../utils/logger';

import {
  createLotSchema,
  updateLotSchema,
  lotIdSchema,
  createInventorySchema,
  updateInventorySchema,
  inventoryIdSchema,
  transferInventorySchema,
  createExitSchema,
  exitIdSchema,
  createHandlingActivitySchema,
  handlingIdSchema,
  createStorageFeeSchema,
  updateStorageFeeSchema,
  feeIdSchema,
  inventoryFiltersSchema,
  exitsFiltersSchema,
  activityLogFiltersSchema,
} from '../validators/antrepo';

const router = Router();

// Apply authentication and branch filtering to all routes
router.use(authenticateToken);
router.use(loadUserBranches);

// ============================================================
// USER'S ACCESSIBLE ANTREPOS
// ============================================================

/**
 * @route GET /api/antrepo/my-warehouses
 * @desc Get list of antrepo warehouses the current user can access
 */
router.get('/my-warehouses', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const warehouses = await getUserAntrepoBranches(branchReq);
    
    res.json({
      data: warehouses,
      hasGlobalAccess: branchReq.hasGlobalAccess,
    });
  } catch (error) {
    logger.error('Error getting user warehouses:', error);
    res.status(500).json({ error: 'Failed to get warehouses' });
  }
});

// ============================================================
// DASHBOARD
// ============================================================

/**
 * @route GET /api/antrepo/dashboard
 * @desc Get dashboard summary data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const { antrepo_id } = req.query;
    
    // Build branch filter
    const branchFilter = buildAntrepoBranchFilter(branchReq, 'al');
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.paramStartIndex;
    
    // Additional filter by specific antrepo_id (for global users selecting a warehouse)
    let antrepoFilter = '';
    if (antrepo_id) {
      params.push(antrepo_id);
      antrepoFilter = `AND al.antrepo_id = $${paramIndex++}`;
    }

    // Summary statistics
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT ai.id) AS total_items,
        COALESCE(SUM(ai.current_quantity_mt), 0) AS total_quantity_mt,
        COUNT(DISTINCT ai.id) FILTER (WHERE ai.is_third_party = TRUE) AS third_party_items,
        COALESCE(SUM(ai.current_quantity_mt) FILTER (WHERE ai.is_third_party = TRUE), 0) AS third_party_quantity_mt,
        COUNT(DISTINCT al.id) AS lots_in_use
      FROM logistics.antrepo_inventory ai
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      WHERE ai.is_deleted = FALSE 
        AND ai.status IN ('in_stock', 'partial_exit')
        AND ${branchFilter.clause}
        ${antrepoFilter}
    `, params);

    // By lot breakdown
    const byLotResult = await pool.query(`
      SELECT 
        al.id AS lot_id,
        al.code AS lot_code,
        al.name AS lot_name,
        al.capacity_mt,
        COUNT(ai.id) AS item_count,
        COALESCE(SUM(ai.current_quantity_mt), 0) AS current_quantity_mt
      FROM logistics.antrepo_lots al
      LEFT JOIN logistics.antrepo_inventory ai ON ai.lot_id = al.id 
        AND ai.is_deleted = FALSE 
        AND ai.status IN ('in_stock', 'partial_exit')
      WHERE al.is_active = TRUE
        AND ${branchFilter.clause}
        ${antrepoFilter}
      GROUP BY al.id, al.code, al.name, al.capacity_mt
      ORDER BY al.sort_order, al.code
    `, params);

    // Recent exits (last 30 days)
    const recentExitsResult = await pool.query(`
      SELECT 
        ae.exit_type,
        COUNT(*) AS exit_count,
        COALESCE(SUM(ae.quantity_mt), 0) AS total_quantity_mt
      FROM logistics.antrepo_exits ae
      JOIN logistics.antrepo_inventory ai ON ae.inventory_id = ai.id
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      WHERE ae.is_deleted = FALSE
        AND ae.exit_date >= CURRENT_DATE - INTERVAL '30 days'
        AND ${branchFilter.clause}
        ${antrepoFilter}
      GROUP BY ae.exit_type
    `, params);

    // Pending arrivals count (shipments marked for antrepo but not yet entered)
    // Build pending arrivals filter based on branch access
    let pendingParams: any[] = [];
    let pendingBranchFilter = '1=1';
    if (!branchReq.hasGlobalAccess && branchReq.userBranchIds && branchReq.userBranchIds.length > 0) {
      pendingParams.push(branchReq.userBranchIds);
      pendingBranchFilter = 's.assigned_antrepo_id = ANY($1::uuid[])';
    }
    if (antrepo_id) {
      pendingParams.push(antrepo_id);
      pendingBranchFilter += ` AND s.assigned_antrepo_id = $${pendingParams.length}`;
    }
    
    const pendingArrivalsResult = await pool.query(`
      SELECT COUNT(*) AS pending_count
      FROM logistics.shipments s
      WHERE s.goes_to_antrepo = TRUE
        AND s.is_deleted = FALSE
        AND s.status NOT IN ('received', 'quality_issue', 'cancelled', 'delivered')
        AND NOT EXISTS (
          SELECT 1 FROM logistics.antrepo_inventory ai 
          WHERE ai.shipment_id = s.id AND ai.is_deleted = FALSE
        )
        AND ${pendingBranchFilter}
    `, pendingParams);

    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        by_lot: byLotResult.rows,
        recent_exits: recentExitsResult.rows,
        pending_arrivals_count: parseInt(pendingArrivalsResult.rows[0]?.pending_count || '0'),
      },
    });
  } catch (error) {
    logger.error('Error fetching antrepo dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ============================================================
// LOTS
// ============================================================

/**
 * @route GET /api/antrepo/lots
 * @desc List all lots with current occupancy
 */
router.get('/lots', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const { antrepo_id, include_inactive } = req.query;
    
    // Build branch filter
    const branchFilter = buildAntrepoBranchFilter(branchReq, 'al');
    const conditions: string[] = [branchFilter.clause];
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.paramStartIndex;

    if (antrepo_id) {
      conditions.push(`al.antrepo_id = $${paramIndex++}`);
      params.push(antrepo_id);
    }

    if (include_inactive !== 'true') {
      conditions.push('al.is_active = TRUE');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query(`
      SELECT 
        al.*,
        b.name AS antrepo_name,
        b.name_ar AS antrepo_name_ar,
        COUNT(ai.id) AS item_count,
        COALESCE(SUM(ai.current_quantity_mt), 0) AS current_occupancy_mt
      FROM logistics.antrepo_lots al
      JOIN master_data.branches b ON al.antrepo_id = b.id
      LEFT JOIN logistics.antrepo_inventory ai ON ai.lot_id = al.id 
        AND ai.is_deleted = FALSE 
        AND ai.status IN ('in_stock', 'partial_exit')
      ${whereClause}
      GROUP BY al.id, b.name, b.name_ar
      ORDER BY al.sort_order, al.code
    `, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching lots:', error);
    res.status(500).json({ error: 'Failed to fetch lots' });
  }
});

/**
 * @route POST /api/antrepo/lots
 * @desc Create a new lot
 */
router.post('/lots', validateBody(createLotSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = req.body;

    const result = await pool.query(`
      INSERT INTO logistics.antrepo_lots (
        antrepo_id, code, name, name_ar, description,
        capacity_mt, lot_type, sort_order, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      data.antrepo_id,
      data.code,
      data.name,
      data.name_ar,
      data.description,
      data.capacity_mt,
      data.lot_type,
      data.sort_order || 0,
      user?.id,
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A lot with this code already exists in this antrepo' });
    }
    logger.error('Error creating lot:', error);
    res.status(500).json({ error: 'Failed to create lot' });
  }
});

/**
 * @route PUT /api/antrepo/lots/:id
 * @desc Update a lot
 */
router.put('/lots/:id', validateParams(lotIdSchema), validateBody(updateLotSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const fields = ['code', 'name', 'name_ar', 'description', 'capacity_mt', 'lot_type', 'is_active', 'sort_order'];
    
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
    params.push(id);

    const result = await pool.query(`
      UPDATE logistics.antrepo_lots
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lot not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A lot with this code already exists in this antrepo' });
    }
    logger.error('Error updating lot:', error);
    res.status(500).json({ error: 'Failed to update lot' });
  }
});

// ============================================================
// INVENTORY
// ============================================================

/**
 * @route GET /api/antrepo/inventory
 * @desc List inventory items
 */
router.get('/inventory', validateQuery(inventoryFiltersSchema), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const { lot_id, antrepo_id, status, is_third_party, search, page, limit } = req.query as any;
    
    // Build branch filter
    const branchFilter = buildAntrepoBranchFilter(branchReq, 'al');
    const conditions: string[] = ['ai.is_deleted = FALSE', branchFilter.clause];
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.paramStartIndex;

    if (lot_id) {
      conditions.push(`ai.lot_id = $${paramIndex++}`);
      params.push(lot_id);
    }

    if (antrepo_id) {
      conditions.push(`al.antrepo_id = $${paramIndex++}`);
      params.push(antrepo_id);
    }

    if (status) {
      conditions.push(`ai.status = $${paramIndex++}`);
      params.push(status);
    } else {
      // Default to in_stock and partial_exit
      conditions.push(`ai.status IN ('in_stock', 'partial_exit')`);
    }

    if (is_third_party !== undefined) {
      conditions.push(`ai.is_third_party = $${paramIndex++}`);
      params.push(is_third_party);
    }

    if (search) {
      conditions.push(`(
        ai.product_text ILIKE $${paramIndex} OR
        ai.entry_declaration_no ILIKE $${paramIndex} OR
        s.sn ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Count total
    const countResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM logistics.antrepo_inventory ai
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      WHERE ${whereClause}
    `, params);

    // Get data
    params.push(limit, offset);
    const dataResult = await pool.query(`
      SELECT 
        ai.*,
        al.code AS lot_code,
        al.name AS lot_name,
        al.name_ar AS lot_name_ar,
        b.name AS antrepo_name,
        b.name_ar AS antrepo_name_ar,
        s.sn AS shipment_sn,
        sup.name AS supplier_name,
        (CURRENT_DATE - ai.entry_date) AS days_in_antrepo,
        COALESCE(exits.total_exited_mt, 0) AS total_exited_mt,
        COALESCE(exits.exit_count, 0) AS exit_count
      FROM logistics.antrepo_inventory ai
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      JOIN master_data.branches b ON al.antrepo_id = b.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON sp.supplier_id = sup.id
      LEFT JOIN LATERAL (
        SELECT SUM(ae.quantity_mt) AS total_exited_mt, COUNT(*) AS exit_count
        FROM logistics.antrepo_exits ae
        WHERE ae.inventory_id = ai.id AND ae.is_deleted = FALSE
      ) exits ON TRUE
      WHERE ${whereClause}
      ORDER BY ai.entry_date DESC, ai.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
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
    logger.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

/**
 * @route GET /api/antrepo/inventory/:id
 * @desc Get single inventory item with full details
 */
router.get('/inventory/:id', validateParams(inventoryIdSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        ai.*,
        al.code AS lot_code,
        al.name AS lot_name,
        al.name_ar AS lot_name_ar,
        b.id AS antrepo_id,
        b.name AS antrepo_name,
        b.name_ar AS antrepo_name_ar,
        s.sn AS shipment_sn,
        sup.name AS supplier_name,
        (CURRENT_DATE - ai.entry_date) AS days_in_antrepo
      FROM logistics.antrepo_inventory ai
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      JOIN master_data.branches b ON al.antrepo_id = b.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON sp.supplier_id = sup.id
      WHERE ai.id = $1 AND ai.is_deleted = FALSE
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Get exits
    const exitsResult = await pool.query(`
      SELECT ae.*, 
        bc.name AS border_crossing_name,
        p.name AS destination_port_name
      FROM logistics.antrepo_exits ae
      LEFT JOIN master_data.border_crossings bc ON ae.border_crossing_id = bc.id
      LEFT JOIN master_data.ports p ON ae.destination_port_id = p.id
      WHERE ae.inventory_id = $1 AND ae.is_deleted = FALSE
      ORDER BY ae.exit_date DESC
    `, [id]);

    // Get handling activities
    const handlingResult = await pool.query(`
      SELECT aha.*, u.name AS performed_by_name
      FROM logistics.antrepo_handling_activities aha
      LEFT JOIN security.users u ON aha.performed_by_user_id = u.id
      WHERE aha.inventory_id = $1
      ORDER BY aha.performed_date DESC
    `, [id]);

    // Get storage fees (if third-party)
    const feesResult = await pool.query(`
      SELECT * FROM logistics.antrepo_storage_fees
      WHERE inventory_id = $1
      ORDER BY fee_period_start DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        exits: exitsResult.rows,
        handling_activities: handlingResult.rows,
        storage_fees: feesResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching inventory item:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
});

/**
 * @route POST /api/antrepo/inventory
 * @desc Record goods entry into antrepo
 */
router.post('/inventory', validateBody(createInventorySchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = req.body;

    // If shipment_id provided, get product info
    let productText = data.product_text;
    let originCountry = data.origin_country;
    
    if (data.shipment_id && !productText) {
      const shipmentResult = await pool.query(`
        SELECT sc.product_text, sc.country_of_origin
        FROM logistics.shipment_cargo sc
        WHERE sc.shipment_id = $1
      `, [data.shipment_id]);
      
      if (shipmentResult.rows[0]) {
        productText = shipmentResult.rows[0].product_text;
        originCountry = shipmentResult.rows[0].country_of_origin;
      }
    }

    const result = await pool.query(`
      INSERT INTO logistics.antrepo_inventory (
        shipment_id, shipment_line_id, lot_id,
        entry_date, expected_exit_date, entry_declaration_no,
        original_quantity_mt, current_quantity_mt,
        quantity_bags, quantity_containers,
        product_text, product_gtip, origin_country,
        is_third_party, third_party_owner, third_party_contact, third_party_ref,
        notes, created_by
      ) VALUES (
        $1, $2, $3,
        COALESCE($4, CURRENT_DATE), $5, $6,
        $7, $7,
        $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18
      )
      RETURNING *
    `, [
      data.shipment_id,
      data.shipment_line_id,
      data.lot_id,
      data.entry_date,
      data.expected_exit_date,
      data.entry_declaration_no,
      data.original_quantity_mt,
      data.quantity_bags,
      data.quantity_containers,
      productText,
      data.product_gtip,
      originCountry,
      data.is_third_party,
      data.third_party_owner,
      data.third_party_contact,
      data.third_party_ref,
      data.notes,
      user?.id,
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating inventory entry:', error);
    res.status(500).json({ error: 'Failed to record inventory entry' });
  }
});

/**
 * @route PUT /api/antrepo/inventory/:id
 * @desc Update inventory item
 */
router.put('/inventory/:id', validateParams(inventoryIdSchema), validateBody(updateInventorySchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const fields = [
      'lot_id', 'expected_exit_date', 'entry_declaration_no', 'product_gtip',
      'is_third_party', 'third_party_owner', 'third_party_contact', 'third_party_ref', 'notes'
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
    params.push(id);

    const result = await pool.query(`
      UPDATE logistics.antrepo_inventory
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND is_deleted = FALSE
      RETURNING *
    `, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

/**
 * @route POST /api/antrepo/inventory/:id/archive
 * @desc Archive (soft-delete) inventory entry and revert shipment status
 * This reverts the entire entry operation:
 * - Marks inventory as deleted
 * - Reverts shipment status from 'delivered' back to previous state
 * - Removes delivery confirmation records
 */
router.post('/inventory/:id/archive', validateParams(inventoryIdSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { reason } = req.body;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get inventory entry with shipment info
      const inventoryResult = await client.query(`
        SELECT ai.*, s.status as shipment_status, s.goes_to_antrepo
        FROM logistics.antrepo_inventory ai
        LEFT JOIN logistics.shipments s ON s.id = ai.shipment_id
        WHERE ai.id = $1 AND ai.is_deleted = FALSE
      `, [id]);

      if (inventoryResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Inventory entry not found' });
      }

      const inventory = inventoryResult.rows[0];

      // Archive the inventory entry
      await client.query(`
        UPDATE logistics.antrepo_inventory
        SET 
          is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2,
          notes = COALESCE(notes, '') || E'\n[ARCHIVED: ' || COALESCE($3, 'No reason provided') || ']'
        WHERE id = $1
      `, [id, user?.id, reason]);

      // If there's a linked shipment, revert its status
      if (inventory.shipment_id) {
        // Revert shipment status to appropriate state
        // If it goes to antrepo, set it back to 'arrived' (waiting for antrepo entry)
        // Otherwise set it back to 'arrived'
        const newStatus = inventory.goes_to_antrepo ? 'arrived' : 'arrived';
        
        await client.query(`
          UPDATE logistics.shipments
          SET 
            status = $2,
            hold_status = FALSE,
            hold_reason = NULL,
            updated_at = NOW(),
            updated_by = $3
          WHERE id = $1
        `, [inventory.shipment_id, newStatus, user?.username]);

        // Clear delivery confirmation from shipment_documents
        await client.query(`
          UPDATE logistics.shipment_documents
          SET 
            delivery_confirmed_at = NULL,
            delivery_confirmed_by = NULL,
            delivery_has_issues = NULL,
            updated_at = NOW()
          WHERE shipment_id = $1
        `, [inventory.shipment_id]);

        // Remove supplier delivery record
        await client.query(`
          DELETE FROM logistics.supplier_delivery_records
          WHERE shipment_id = $1
        `, [inventory.shipment_id]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Inventory entry archived and shipment status reverted',
        archived_inventory_id: id,
        reverted_shipment_id: inventory.shipment_id,
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error archiving inventory:', error);
    res.status(500).json({ error: 'Failed to archive inventory entry' });
  }
});

/**
 * @route POST /api/antrepo/inventory/:id/transfer
 * @desc Transfer inventory to a different lot
 */
router.post('/inventory/:id/transfer', validateParams(inventoryIdSchema), validateBody(transferInventorySchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { target_lot_id, quantity_mt, notes } = req.body;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current inventory
      const currentResult = await client.query(`
        SELECT * FROM logistics.antrepo_inventory
        WHERE id = $1 AND is_deleted = FALSE AND status IN ('in_stock', 'partial_exit')
      `, [id]);

      if (currentResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Inventory item not found or not available for transfer' });
      }

      const current = currentResult.rows[0];

      if (quantity_mt > current.current_quantity_mt) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Transfer quantity exceeds available quantity' });
      }

      // Check target lot exists and is in same antrepo
      const targetLotResult = await client.query(`
        SELECT al.* FROM logistics.antrepo_lots al
        JOIN logistics.antrepo_lots source ON source.id = $1
        WHERE al.id = $2 AND al.antrepo_id = source.antrepo_id AND al.is_active = TRUE
      `, [current.lot_id, target_lot_id]);

      if (targetLotResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Target lot not found or not in the same antrepo' });
      }

      // If transferring all, just update the lot
      if (quantity_mt >= current.current_quantity_mt) {
        await client.query(`
          UPDATE logistics.antrepo_inventory
          SET lot_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [target_lot_id, id]);
      } else {
        // Partial transfer - reduce original and create new entry
        await client.query(`
          UPDATE logistics.antrepo_inventory
          SET current_quantity_mt = current_quantity_mt - $1,
              status = 'partial_exit',
              updated_at = NOW()
          WHERE id = $2
        `, [quantity_mt, id]);

        // Create new inventory entry in target lot
        await client.query(`
          INSERT INTO logistics.antrepo_inventory (
            shipment_id, shipment_line_id, lot_id,
            entry_date, expected_exit_date, entry_declaration_no,
            original_quantity_mt, current_quantity_mt,
            quantity_bags, quantity_containers,
            product_text, product_gtip, origin_country,
            is_third_party, third_party_owner, third_party_contact, third_party_ref,
            notes, created_by
          )
          SELECT 
            shipment_id, shipment_line_id, $1,
            CURRENT_DATE, expected_exit_date, entry_declaration_no,
            $2, $2,
            NULL, NULL,
            product_text, product_gtip, origin_country,
            is_third_party, third_party_owner, third_party_contact, third_party_ref,
            $3, $4
          FROM logistics.antrepo_inventory WHERE id = $5
        `, [target_lot_id, quantity_mt, notes || `Transferred from lot`, user?.id, id]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Transferred ${quantity_mt} MT to new lot`,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error transferring inventory:', error);
    res.status(500).json({ error: 'Failed to transfer inventory' });
  }
});

/**
 * @route DELETE /api/antrepo/inventory/:id
 * @desc Soft delete inventory item
 */
router.delete('/inventory/:id', validateParams(inventoryIdSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE logistics.antrepo_inventory
      SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING id
    `, [user?.id, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({ success: true, message: 'Inventory item deleted' });
  } catch (error) {
    logger.error('Error deleting inventory:', error);
    res.status(500).json({ error: 'Failed to delete inventory' });
  }
});

// ============================================================
// EXITS
// ============================================================

/**
 * @route GET /api/antrepo/exits
 * @desc List exit transactions
 */
router.get('/exits', validateQuery(exitsFiltersSchema), async (req: Request, res: Response) => {
  try {
    const { inventory_id, exit_type, date_from, date_to, page, limit } = req.query as any;
    
    const conditions: string[] = ['ae.is_deleted = FALSE'];
    const params: any[] = [];
    let paramIndex = 1;

    if (inventory_id) {
      conditions.push(`ae.inventory_id = $${paramIndex++}`);
      params.push(inventory_id);
    }

    if (exit_type) {
      conditions.push(`ae.exit_type = $${paramIndex++}`);
      params.push(exit_type);
    }

    if (date_from) {
      conditions.push(`ae.exit_date >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`ae.exit_date <= $${paramIndex++}`);
      params.push(date_to);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    const countResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM logistics.antrepo_exits ae
      WHERE ${whereClause}
    `, params);

    params.push(limit, offset);
    const dataResult = await pool.query(`
      SELECT 
        ae.*,
        ai.product_text,
        ai.shipment_id,
        s.sn AS shipment_sn,
        al.code AS lot_code,
        bc.name AS border_crossing_name,
        p.name AS destination_port_name,
        u.name AS created_by_name
      FROM logistics.antrepo_exits ae
      JOIN logistics.antrepo_inventory ai ON ae.inventory_id = ai.id
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      LEFT JOIN master_data.border_crossings bc ON ae.border_crossing_id = bc.id
      LEFT JOIN master_data.ports p ON ae.destination_port_id = p.id
      LEFT JOIN security.users u ON ae.created_by = u.id
      WHERE ${whereClause}
      ORDER BY ae.exit_date DESC, ae.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
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
    logger.error('Error fetching exits:', error);
    res.status(500).json({ error: 'Failed to fetch exits' });
  }
});

/**
 * @route POST /api/antrepo/exits
 * @desc Record an exit from antrepo
 */
router.post('/exits', validateBody(createExitSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = req.body;

    // Verify inventory exists and has sufficient quantity
    const inventoryResult = await pool.query(`
      SELECT * FROM logistics.antrepo_inventory
      WHERE id = $1 AND is_deleted = FALSE AND status IN ('in_stock', 'partial_exit')
    `, [data.inventory_id]);

    if (inventoryResult.rowCount === 0) {
      return res.status(404).json({ error: 'Inventory item not found or not available for exit' });
    }

    const inventory = inventoryResult.rows[0];
    if (data.quantity_mt > inventory.current_quantity_mt) {
      return res.status(400).json({ 
        error: `Exit quantity (${data.quantity_mt} MT) exceeds available quantity (${inventory.current_quantity_mt} MT)` 
      });
    }

    // Build insert based on exit type
    let result;
    
    if (data.exit_type === 'transit') {
      result = await pool.query(`
        INSERT INTO logistics.antrepo_exits (
          inventory_id, exit_date, quantity_mt, quantity_bags,
          exit_type, border_crossing_id, delivery_id, transit_destination,
          declaration_no, declaration_date, notes, created_by
        ) VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        data.inventory_id, data.exit_date, data.quantity_mt, data.quantity_bags,
        'transit', data.border_crossing_id, data.delivery_id, data.transit_destination,
        data.declaration_no, data.declaration_date, data.notes, user?.id,
      ]);
    } else if (data.exit_type === 'port') {
      result = await pool.query(`
        INSERT INTO logistics.antrepo_exits (
          inventory_id, exit_date, quantity_mt, quantity_bags,
          exit_type, destination_port_id, vessel_name, bl_no, export_country,
          declaration_no, declaration_date, notes, created_by
        ) VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        data.inventory_id, data.exit_date, data.quantity_mt, data.quantity_bags,
        'port', data.destination_port_id, data.vessel_name, data.bl_no, data.export_country,
        data.declaration_no, data.declaration_date, data.notes, user?.id,
      ]);
    } else if (data.exit_type === 'domestic') {
      result = await pool.query(`
        INSERT INTO logistics.antrepo_exits (
          inventory_id, exit_date, quantity_mt, quantity_bags,
          exit_type, beyaname_no, beyaname_date, tax_amount, tax_currency, customs_clearing_cost_id,
          declaration_no, declaration_date, notes, created_by
        ) VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        data.inventory_id, data.exit_date, data.quantity_mt, data.quantity_bags,
        'domestic', data.beyaname_no, data.beyaname_date, data.tax_amount, data.tax_currency, data.customs_clearing_cost_id,
        data.declaration_no, data.declaration_date, data.notes, user?.id,
      ]);
    }

    // Note: The trigger will automatically update inventory quantity and status

    res.status(201).json({
      success: true,
      data: result?.rows[0],
    });
  } catch (error) {
    logger.error('Error creating exit:', error);
    res.status(500).json({ error: 'Failed to record exit' });
  }
});

/**
 * @route GET /api/antrepo/exits/:id
 * @desc Get exit details
 */
router.get('/exits/:id', validateParams(exitIdSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        ae.*,
        ai.product_text,
        ai.shipment_id,
        ai.lot_id,
        s.sn AS shipment_sn,
        al.code AS lot_code,
        al.name AS lot_name,
        bc.name AS border_crossing_name,
        bc.name_ar AS border_crossing_name_ar,
        p.name AS destination_port_name,
        u.name AS created_by_name
      FROM logistics.antrepo_exits ae
      JOIN logistics.antrepo_inventory ai ON ae.inventory_id = ai.id
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      LEFT JOIN master_data.border_crossings bc ON ae.border_crossing_id = bc.id
      LEFT JOIN master_data.ports p ON ae.destination_port_id = p.id
      LEFT JOIN security.users u ON ae.created_by = u.id
      WHERE ae.id = $1 AND ae.is_deleted = FALSE
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Exit not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching exit:', error);
    res.status(500).json({ error: 'Failed to fetch exit' });
  }
});

// ============================================================
// HANDLING ACTIVITIES
// ============================================================

/**
 * @route GET /api/antrepo/handling
 * @desc List handling activities
 */
router.get('/handling', async (req: Request, res: Response) => {
  try {
    const { inventory_id, activity_code, page = '1', limit = '50' } = req.query;
    
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (inventory_id) {
      conditions.push(`aha.inventory_id = $${paramIndex++}`);
      params.push(inventory_id);
    }

    if (activity_code) {
      conditions.push(`aha.activity_code = $${paramIndex++}`);
      params.push(activity_code);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    params.push(parseInt(limit as string), offset);
    const result = await pool.query(`
      SELECT 
        aha.*,
        ai.product_text,
        s.sn AS shipment_sn,
        al.code AS lot_code,
        u.name AS performed_by_name,
        aat.name_tr AS activity_name_tr,
        aat.may_change_gtip
      FROM logistics.antrepo_handling_activities aha
      JOIN logistics.antrepo_inventory ai ON aha.inventory_id = ai.id
      JOIN logistics.antrepo_lots al ON ai.lot_id = al.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      LEFT JOIN security.users u ON aha.performed_by_user_id = u.id
      LEFT JOIN master_data.antrepo_activity_types aat ON aha.activity_code = aat.code
      ${whereClause}
      ORDER BY aha.performed_date DESC, aha.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching handling activities:', error);
    res.status(500).json({ error: 'Failed to fetch handling activities' });
  }
});

/**
 * @route GET /api/antrepo/handling/activity-types
 * @desc Get list of Ek-63 activity types
 */
router.get('/handling/activity-types', async (req: Request, res: Response) => {
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

/**
 * @route POST /api/antrepo/handling
 * @desc Record a handling activity
 */
router.post('/handling', validateBody(createHandlingActivitySchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = req.body;

    // Verify inventory exists
    const inventoryResult = await pool.query(`
      SELECT id FROM logistics.antrepo_inventory
      WHERE id = $1 AND is_deleted = FALSE
    `, [data.inventory_id]);

    if (inventoryResult.rowCount === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Get activity name from reference table if not provided
    let activityName = data.activity_name;
    let activityNameAr = data.activity_name_ar;
    
    if (!activityName) {
      const activityResult = await pool.query(`
        SELECT name, name_ar FROM master_data.antrepo_activity_types WHERE code = $1
      `, [data.activity_code]);
      
      if (activityResult.rows[0]) {
        activityName = activityResult.rows[0].name;
        activityNameAr = activityResult.rows[0].name_ar;
      }
    }

    const result = await pool.query(`
      INSERT INTO logistics.antrepo_handling_activities (
        inventory_id, activity_code, activity_name, activity_name_ar,
        performed_date, performed_by_user_id, customs_permission_ref,
        quantity_affected_mt, before_description, after_description,
        gtip_changed, old_gtip, new_gtip, notes, created_by
      ) VALUES (
        $1, $2, $3, $4,
        COALESCE($5, CURRENT_DATE), $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14, $15
      )
      RETURNING *
    `, [
      data.inventory_id, data.activity_code, activityName, activityNameAr,
      data.performed_date, data.performed_by_user_id || user?.id, data.customs_permission_ref,
      data.quantity_affected_mt, data.before_description, data.after_description,
      data.gtip_changed, data.old_gtip, data.new_gtip, data.notes, user?.id,
    ]);

    // If GTIP changed, update inventory
    if (data.gtip_changed && data.new_gtip) {
      await pool.query(`
        UPDATE logistics.antrepo_inventory
        SET product_gtip = $1, updated_at = NOW()
        WHERE id = $2
      `, [data.new_gtip, data.inventory_id]);
    }

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating handling activity:', error);
    res.status(500).json({ error: 'Failed to record handling activity' });
  }
});

// ============================================================
// STORAGE FEES
// ============================================================

/**
 * @route GET /api/antrepo/fees
 * @desc List storage fees
 */
router.get('/fees', async (req: Request, res: Response) => {
  try {
    const { inventory_id, payment_status, page = '1', limit = '50' } = req.query;
    
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (inventory_id) {
      conditions.push(`asf.inventory_id = $${paramIndex++}`);
      params.push(inventory_id);
    }

    if (payment_status) {
      conditions.push(`asf.payment_status = $${paramIndex++}`);
      params.push(payment_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    params.push(parseInt(limit as string), offset);
    const result = await pool.query(`
      SELECT 
        asf.*,
        ai.product_text,
        ai.third_party_owner,
        s.sn AS shipment_sn
      FROM logistics.antrepo_storage_fees asf
      JOIN logistics.antrepo_inventory ai ON asf.inventory_id = ai.id
      LEFT JOIN logistics.shipments s ON ai.shipment_id = s.id
      ${whereClause}
      ORDER BY asf.fee_period_start DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching storage fees:', error);
    res.status(500).json({ error: 'Failed to fetch storage fees' });
  }
});

/**
 * @route POST /api/antrepo/fees
 * @desc Record a storage fee
 */
router.post('/fees', validateBody(createStorageFeeSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = req.body;

    // Verify inventory exists and is third-party
    const inventoryResult = await pool.query(`
      SELECT is_third_party FROM logistics.antrepo_inventory
      WHERE id = $1 AND is_deleted = FALSE
    `, [data.inventory_id]);

    if (inventoryResult.rowCount === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    if (!inventoryResult.rows[0].is_third_party) {
      return res.status(400).json({ error: 'Storage fees only apply to third-party goods' });
    }

    const result = await pool.query(`
      INSERT INTO logistics.antrepo_storage_fees (
        inventory_id, fee_period_start, fee_period_end,
        rate_per_day_mt, quantity_mt, total_amount, currency,
        invoice_no, invoice_date, payment_status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      data.inventory_id, data.fee_period_start, data.fee_period_end,
      data.rate_per_day_mt, data.quantity_mt, data.total_amount, data.currency,
      data.invoice_no, data.invoice_date, data.payment_status, data.notes, user?.id,
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating storage fee:', error);
    res.status(500).json({ error: 'Failed to record storage fee' });
  }
});

/**
 * @route PUT /api/antrepo/fees/:id
 * @desc Update storage fee (payment status, invoice info)
 */
router.put('/fees/:id', validateParams(feeIdSchema), validateBody(updateStorageFeeSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const fields = ['invoice_no', 'invoice_date', 'payment_status', 'payment_date', 'notes'];
    
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(data[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    const result = await pool.query(`
      UPDATE logistics.antrepo_storage_fees
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Storage fee not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating storage fee:', error);
    res.status(500).json({ error: 'Failed to update storage fee' });
  }
});

// ============================================================
// PENDING ARRIVALS
// ============================================================

/**
 * @route GET /api/antrepo/pending-arrivals
 * @desc Get shipments headed to antrepo (assigned via goes_to_antrepo flag)
 */
router.get('/pending-arrivals', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const { antrepo_id } = req.query;

    const conditions: string[] = [
      's.goes_to_antrepo = TRUE',
      's.is_deleted = FALSE',
      // Only show shipments not yet received/completed
      `s.status NOT IN ('received', 'quality_issue', 'cancelled', 'delivered')`,
    ];
    const params: any[] = [];
    let paramIndex = 1;

    // Apply branch filter for non-global users
    if (!branchReq.hasGlobalAccess && branchReq.userBranchIds && branchReq.userBranchIds.length > 0) {
      conditions.push(`s.assigned_antrepo_id = ANY($${paramIndex++}::uuid[])`);
      params.push(branchReq.userBranchIds);
    }

    // Additional filter by specific antrepo_id
    if (antrepo_id) {
      conditions.push(`s.assigned_antrepo_id = $${paramIndex++}`);
      params.push(antrepo_id);
    }

    const whereClause = conditions.join(' AND ');

    // Query shipments directly with proper joins
    const result = await pool.query(`
      SELECT 
        s.id,
        s.sn,
        s.status,
        s.goes_to_antrepo,
        s.assigned_antrepo_id,
        s.assigned_lot_id,
        s.notes,
        s.created_at,
        -- Antrepo info
        b.name AS antrepo_name,
        b.name_ar AS antrepo_name_ar,
        -- Lot info (if pre-assigned)
        al.code AS lot_code,
        al.name AS lot_name,
        -- Cargo info
        sc.product_text,
        sc.weight_ton,
        sc.container_count,
        sc.bags_count,
        sc.country_of_export AS origin_country,
        -- Shipment lines info (packages/bags details)
        slines.number_of_packages,
        slines.kind_of_packages,
        slines.package_size,
        slines.package_size_unit,
        -- Logistics info
        sl.eta,
        sl.etd,
        sl.pod_id,
        sl.booking_no,
        sl.bl_no,
        sl.vessel_name,
        pod.name AS pod_name,
        pol.name AS pol_name,
        -- Party info (supplier from companies table)
        sup.name AS supplier_name,
        -- Container details
        scontainers.containers,
        -- Check if already entered into antrepo inventory
        (EXISTS (
          SELECT 1 FROM logistics.antrepo_inventory ai 
          WHERE ai.shipment_id = s.id AND ai.is_deleted = FALSE
        )) AS already_entered
      FROM logistics.shipments s
      LEFT JOIN master_data.branches b ON s.assigned_antrepo_id = b.id
      LEFT JOIN logistics.antrepo_lots al ON s.assigned_lot_id = al.id
      LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN master_data.ports pod ON sl.pod_id = pod.id
      LEFT JOIN master_data.ports pol ON sl.pol_id = pol.id
      -- Get first shipment line for package details (or aggregate if multiple)
      LEFT JOIN LATERAL (
        SELECT 
          SUM(sline.number_of_packages) AS number_of_packages,
          MAX(sline.kind_of_packages) AS kind_of_packages,
          MAX(sline.package_size) AS package_size,
          MAX(sline.package_size_unit) AS package_size_unit
        FROM logistics.shipment_lines sline
        WHERE sline.shipment_id = s.id
      ) slines ON TRUE
      -- Get container numbers as JSON array
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'container_no', COALESCE(scon.container_no, scon.container_number),
              'size_code', scon.size_code,
              'seal_no', COALESCE(scon.seal_no, scon.seal_number),
              'gross_weight_kg', scon.gross_weight_kg,
              'bags_count', scon.bags_count
            ) ORDER BY scon.created_at
          ) FILTER (WHERE scon.id IS NOT NULL),
          '[]'::json
        ) AS containers
        FROM logistics.shipment_containers scon
        WHERE scon.shipment_id = s.id
      ) scontainers ON TRUE
      LEFT JOIN master_data.companies sup ON sp.supplier_id = sup.id
      WHERE ${whereClause}
      ORDER BY sl.eta ASC NULLS LAST, s.created_at DESC
    `, params);

    // Filter out shipments already entered into antrepo
    const pendingArrivals = result.rows.filter((row: any) => !row.already_entered);

    res.json({
      success: true,
      data: pendingArrivals,
    });
  } catch (error) {
    logger.error('Error fetching pending arrivals:', error);
    res.status(500).json({ error: 'Failed to fetch pending arrivals' });
  }
});

// ============================================================
// ACTIVITY LOG
// ============================================================

/**
 * @route GET /api/antrepo/activity-log
 * @desc Get combined activity log (entries, exits, handling)
 */
router.get('/activity-log', validateQuery(activityLogFiltersSchema), async (req: Request, res: Response) => {
  try {
    const { antrepo_id, lot_id, activity_type, date_from, date_to, page, limit } = req.query as any;
    
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build a CTE query with filters
    let baseQuery = `
      WITH activity_log AS (
        SELECT * FROM logistics.v_antrepo_activity_log
      )
      SELECT * FROM activity_log
    `;

    if (lot_id) {
      conditions.push(`lot_id = $${paramIndex++}`);
      params.push(lot_id);
    }

    if (activity_type) {
      conditions.push(`activity_type = $${paramIndex++}`);
      params.push(activity_type);
    }

    if (date_from) {
      conditions.push(`activity_date >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`activity_date <= $${paramIndex++}`);
      params.push(date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);
    const result = await pool.query(`
      ${baseQuery}
      ${whereClause}
      ORDER BY activity_date DESC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

export default router;
