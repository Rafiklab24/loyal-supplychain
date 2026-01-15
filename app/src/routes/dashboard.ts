import { Router } from 'express';
import pool from '../db/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/dashboard/logistics-stats
 * Stats for Logistics role dashboard
 */
router.get('/logistics-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM logistics.v_shipments_complete WHERE status = 'in_transit' AND is_deleted = false) AS in_transit,
        (SELECT COUNT(*) FROM logistics.v_shipments_complete 
         WHERE eta IS NOT NULL 
         AND eta BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
         AND is_deleted = false) AS arriving_this_week,
        (SELECT COUNT(*) FROM logistics.v_shipments_complete 
         WHERE paperwork_status = 'incomplete' 
         AND is_deleted = false) AS pending_documents,
        (SELECT COUNT(*) FROM logistics.v_shipments_complete 
         WHERE status IN ('arrived', 'cleared') 
         AND is_deleted = false) AS pending_delivery
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching logistics stats:', error);
    res.status(500).json({ error: 'Failed to fetch logistics stats' });
  }
});

/**
 * GET /api/dashboard/accounting-stats
 * Stats for Accounting role dashboard
 */
router.get('/accounting-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE((SELECT SUM(amount) FROM finance.transactions WHERE type = 'payment' AND status = 'completed'), 0) AS total_paid,
        COALESCE((SELECT SUM(amount) FROM finance.transactions WHERE status = 'pending'), 0) AS total_pending,
        COALESCE((SELECT SUM(amount) FROM finance.transactions 
         WHERE type = 'payment' 
         AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS this_month_payments,
        (SELECT COUNT(*) FROM finance.customs_clearing_costs 
         WHERE payment_status IN ('unpaid', 'partial')) AS pending_clearance_costs
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching accounting stats:', error);
    res.status(500).json({ error: 'Failed to fetch accounting stats' });
  }
});

/**
 * GET /api/dashboard/clearance-stats
 * Stats for Clearance role dashboard
 */
router.get('/clearance-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM logistics.v_shipments_complete 
         WHERE status = 'arrived' 
         AND is_deleted = false) AS pending_clearance,
        (SELECT COUNT(*) FROM finance.customs_clearing_costs 
         WHERE clearance_status = 'in_progress') AS in_progress,
        (SELECT COUNT(*) FROM finance.customs_clearing_costs 
         WHERE clearance_status = 'cleared'
         AND clearance_date >= CURRENT_DATE - INTERVAL '7 days') AS cleared_this_week,
        (SELECT COUNT(*) FROM logistics.shipments 
         WHERE border_stage IN ('at_border', 'clearing')
         AND is_deleted = false) AS at_border
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching clearance stats:', error);
    res.status(500).json({ error: 'Failed to fetch clearance stats' });
  }
});

/**
 * GET /api/dashboard/inventory-stats
 * Stats for Inventory role dashboard
 */
router.get('/inventory-stats', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    // Get user's branch IDs for filtering
    const branchResult = await pool.query(
      `SELECT branch_id FROM security.user_branches WHERE user_id = $1`,
      [userId]
    );
    const branchIds = branchResult.rows.map(r => r.branch_id);

    let branchFilter = '';
    if (branchIds.length > 0) {
      branchFilter = `AND sl.final_destination->>'branch_id' = ANY($1)`;
    }

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM logistics.v_shipments_complete s
         LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
         WHERE s.status = 'cleared' AND s.is_deleted = false ${branchFilter}) AS ready_for_pickup,
        (SELECT COUNT(*) FROM logistics.quality_incidents 
         WHERE status IN ('draft', 'submitted', 'under_review')) AS pending_quality_reviews,
        (SELECT COUNT(*) FROM logistics.shipments 
         WHERE hold_status = true AND is_deleted = false) AS on_hold,
        (SELECT COUNT(*) FROM logistics.v_shipments_complete s
         LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
         WHERE s.status IN ('in_transit', 'arrived') AND s.is_deleted = false ${branchFilter}) AS incoming_shipments
    `, branchIds.length > 0 ? [branchIds] : []);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    res.status(500).json({ error: 'Failed to fetch inventory stats' });
  }
});

/**
 * GET /api/dashboard/procurement-stats
 * Stats for Procurement role dashboard
 */
router.get('/procurement-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM logistics.contracts WHERE status = 'PENDING' AND is_deleted = false) AS pending_contracts,
        (SELECT COUNT(*) FROM logistics.contracts WHERE status = 'ACTIVE' AND is_deleted = false) AS active_contracts,
        (SELECT COUNT(*) FROM logistics.contracts 
         WHERE status = 'ACTIVE' 
         AND is_deleted = false
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS new_this_month,
        (SELECT COUNT(*) FROM master_data.products WHERE is_active = true) AS total_products
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching procurement stats:', error);
    res.status(500).json({ error: 'Failed to fetch procurement stats' });
  }
});

export default router;

