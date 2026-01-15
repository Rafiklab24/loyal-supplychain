/**
 * Inventory API Routes
 * FB Interface for Final Beneficiary (Branch) users
 * 
 * Features:
 * - List shipments headed to user's branch
 * - Mark shipments as delivered
 * - Get cost breakdown (purchase + CC + transport + freight)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';
import { authenticateToken } from '../middleware/auth';
import { withTransaction } from '../utils/transactions';

const router = Router();

// ============================================================
// TYPES
// ============================================================

interface CostBreakdown {
  purchase_price: number;
  customs_clearing: number;
  internal_transport: number;
  external_freight: number;
  total_landed_cost: number;
}

interface LatestIncident {
  id: string;
  status: 'draft' | 'submitted' | 'under_review' | 'action_set' | 'closed';
  issue_type: string;
  samples_completed: number;
  created_at: string;
}

interface InventoryShipment {
  id: string;
  sn: string;
  status: string;
  hold_status: boolean;
  hold_reason: string | null;
  supplier_name: string;
  product_text: string;
  weight_ton: number;
  container_count: number;
  bags_count: number;
  origin_country: string;
  pol_name: string;
  pod_name: string;
  eta: string;
  final_destination: any;
  purchase_price: number;
  costs: CostBreakdown;
  delivery_confirmed_at: string | null;
  delivery_has_issues: boolean;
  quality_incident_count: number;
  latest_incident: LatestIncident | null;
}

// ============================================================
// GET /api/inventory/shipments
// List shipments for user's branch with costs
// ============================================================

router.get('/shipments',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      // Get user's assigned branches
      const branchResult = await pool.query(`
        SELECT branch_id FROM security.user_branches WHERE user_id = $1
      `, [user.id]);
      
      const branchIds = branchResult.rows.map(r => r.branch_id);
      
      // Build query - filter by branch if user has branch assignments
      // Admins and Execs can see all if no branch filter
      let branchFilter = '';
      const params: any[] = [];
      
      if (branchIds.length > 0 && !['Admin', 'Exec'].includes(user.role)) {
        branchFilter = `AND (
          s.final_destination->>'branch_id' = ANY($1::text[])
          OR s.final_destination->>'branch_id' IS NULL
        )`;
        params.push(branchIds);
      }
      
      // Optional filters from query params
      const { status, search, delivered, sort } = req.query;
      
      let statusFilter = '';
      if (status) {
        params.push(status);
        statusFilter = `AND s.status = $${params.length}`;
      }
      
      let searchFilter = '';
      if (search) {
        params.push(`%${search}%`);
        searchFilter = `AND (
          s.sn ILIKE $${params.length} OR 
          vis.product_text ILIKE $${params.length} OR
          vis.supplier_name ILIKE $${params.length}
        )`;
      }
      
      let deliveredFilter = '';
      if (delivered === 'true') {
        deliveredFilter = 'AND vis.delivery_confirmed_at IS NOT NULL';
      } else if (delivered === 'false') {
        deliveredFilter = 'AND vis.delivery_confirmed_at IS NULL';
      }
      
      // Sorting options
      let orderBy = 'vis.eta ASC NULLS LAST, vis.created_at DESC'; // default: earliest arrival
      switch (sort) {
        case 'eta_asc':
          orderBy = 'vis.eta ASC NULLS LAST, vis.created_at DESC';
          break;
        case 'eta_desc':
          orderBy = 'vis.eta DESC NULLS LAST, vis.created_at DESC';
          break;
        case 'weight_desc':
          orderBy = 'vis.weight_ton DESC NULLS LAST, vis.created_at DESC';
          break;
        case 'weight_asc':
          orderBy = 'vis.weight_ton ASC NULLS LAST, vis.created_at DESC';
          break;
        case 'price_desc':
          orderBy = 'vis.total_value_usd DESC NULLS LAST, vis.created_at DESC';
          break;
        case 'price_asc':
          orderBy = 'vis.total_value_usd ASC NULLS LAST, vis.created_at DESC';
          break;
        case 'newest':
          orderBy = 'vis.created_at DESC';
          break;
        case 'oldest':
          orderBy = 'vis.created_at ASC';
          break;
      }
      
      const query = `
        SELECT 
          vis.*,
          
          -- Calculate customs clearing costs
          COALESCE((
            SELECT SUM(ccc.total_clearing_cost)
            FROM finance.customs_clearing_costs ccc
            WHERE ccc.shipment_id = vis.id AND ccc.is_deleted = FALSE
          ), 0) as customs_clearing_total,
          
          -- Calculate internal transport costs
          COALESCE((
            SELECT SUM(od.transport_cost)
            FROM logistics.outbound_deliveries od
            WHERE od.shipment_id = vis.id AND od.is_deleted = FALSE
          ), 0) as internal_transport_total,
          
          -- Get latest incident details (for editing/continuing)
          (
            SELECT jsonb_build_object(
              'id', qi.id,
              'status', qi.status,
              'issue_type', qi.issue_type,
              'samples_completed', qi.samples_completed,
              'created_at', qi.created_at
            )
            FROM logistics.quality_incidents qi
            WHERE qi.shipment_id = vis.id
            ORDER BY qi.created_at DESC
            LIMIT 1
          ) as latest_incident
          
        FROM logistics.v_inventory_shipments vis
        JOIN logistics.shipments s ON s.id = vis.id
        WHERE 1=1
          ${branchFilter}
          ${statusFilter}
          ${searchFilter}
          ${deliveredFilter}
        ORDER BY ${orderBy}
      `;
      
      const result = await pool.query(query, params);
      
      // Transform to include cost breakdown
      const shipments: InventoryShipment[] = result.rows.map(row => {
        const purchasePrice = parseFloat(row.total_value_usd) || 0;
        const customsClearing = parseFloat(row.customs_clearing_total) || 0;
        const internalTransport = parseFloat(row.internal_transport_total) || 0;
        const externalFreight = parseFloat(row.transportation_cost) || 0;
        
        return {
          id: row.id,
          sn: row.sn,
          status: row.status,
          hold_status: row.hold_status || false,
          hold_reason: row.hold_reason,
          supplier_name: row.supplier_name,
          product_text: row.product_text,
          weight_ton: parseFloat(row.weight_ton) || 0,
          container_count: row.container_count || 0,
          bags_count: row.bags_count || 0,
          origin_country: row.origin_country,
          pol_name: row.pol_name,
          pod_name: row.pod_name,
          eta: row.eta,
          final_destination: row.final_destination,
          purchase_price: purchasePrice,
          costs: {
            purchase_price: purchasePrice,
            customs_clearing: customsClearing,
            internal_transport: internalTransport,
            external_freight: externalFreight,
            total_landed_cost: purchasePrice + customsClearing + internalTransport + externalFreight
          },
          delivery_confirmed_at: row.delivery_confirmed_at,
          delivery_has_issues: row.delivery_has_issues || false,
          latest_incident: row.latest_incident || null,
          quality_incident_count: parseInt(row.quality_incident_count) || 0
        };
      });
      
      res.json({
        shipments,
        total: shipments.length
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// GET /api/inventory/shipments/:id
// Get single shipment with full details and costs
// ============================================================

router.get('/shipments/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const query = `
        SELECT 
          vis.*,
          
          -- Customs clearing costs breakdown
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', ccc.id,
              'file_number', ccc.file_number,
              'cost_description', ccc.cost_description,
              'total_clearing_cost', ccc.total_clearing_cost,
              'clearance_type', ccc.clearance_type,
              'clearance_date', ccc.clearance_date
            ))
            FROM finance.customs_clearing_costs ccc
            WHERE ccc.shipment_id = vis.id AND ccc.is_deleted = FALSE
          ), '[]'::jsonb) as customs_costs,
          
          -- Internal transport breakdown
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', od.id,
              'delivery_number', od.delivery_number,
              'destination', od.destination,
              'transport_cost', od.transport_cost,
              'delivery_date', od.delivery_date,
              'status', od.status
            ))
            FROM logistics.outbound_deliveries od
            WHERE od.shipment_id = vis.id AND od.is_deleted = FALSE
          ), '[]'::jsonb) as transport_deliveries,
          
          -- Sum totals
          COALESCE((
            SELECT SUM(ccc.total_clearing_cost)
            FROM finance.customs_clearing_costs ccc
            WHERE ccc.shipment_id = vis.id AND ccc.is_deleted = FALSE
          ), 0) as customs_clearing_total,
          
          COALESCE((
            SELECT SUM(od.transport_cost)
            FROM logistics.outbound_deliveries od
            WHERE od.shipment_id = vis.id AND od.is_deleted = FALSE
          ), 0) as internal_transport_total
          
        FROM logistics.v_inventory_shipments vis
        WHERE vis.id = $1
      `;
      
      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      
      const row = result.rows[0];
      const purchasePrice = parseFloat(row.total_value_usd) || 0;
      const customsClearing = parseFloat(row.customs_clearing_total) || 0;
      const internalTransport = parseFloat(row.internal_transport_total) || 0;
      const externalFreight = parseFloat(row.transportation_cost) || 0;
      
      res.json({
        shipment: {
          ...row,
          costs: {
            purchase_price: purchasePrice,
            customs_clearing: customsClearing,
            internal_transport: internalTransport,
            external_freight: externalFreight,
            total_landed_cost: purchasePrice + customsClearing + internalTransport + externalFreight,
            customs_costs_detail: row.customs_costs,
            transport_detail: row.transport_deliveries
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// GET /api/inventory/shipments/:id/costs
// Get detailed cost breakdown for a shipment
// ============================================================

router.get('/shipments/:id/costs',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Get shipment base values
      const shipmentResult = await pool.query(`
        SELECT 
          f.total_value_usd as purchase_price,
          f.transportation_cost as external_freight,
          f.currency_code
        FROM logistics.shipment_financials f
        WHERE f.shipment_id = $1
      `, [id]);
      
      if (shipmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      
      // Get customs clearing costs
      const customsResult = await pool.query(`
        SELECT 
          id, file_number, cost_description, clearance_type,
          original_clearing_amount, extra_cost_amount, total_clearing_cost,
          clearance_date, payment_status
        FROM finance.customs_clearing_costs
        WHERE shipment_id = $1 AND is_deleted = FALSE
        ORDER BY created_at
      `, [id]);
      
      // Get internal transport costs
      const transportResult = await pool.query(`
        SELECT 
          id, delivery_number, destination, transport_cost,
          delivery_date, status, driver_name, truck_plate
        FROM logistics.outbound_deliveries
        WHERE shipment_id = $1 AND is_deleted = FALSE
        ORDER BY created_at
      `, [id]);
      
      const purchasePrice = parseFloat(shipmentResult.rows[0].purchase_price) || 0;
      const externalFreight = parseFloat(shipmentResult.rows[0].external_freight) || 0;
      const customsTotal = customsResult.rows.reduce((sum, r) => sum + (parseFloat(r.total_clearing_cost) || 0), 0);
      const transportTotal = transportResult.rows.reduce((sum, r) => sum + (parseFloat(r.transport_cost) || 0), 0);
      
      res.json({
        summary: {
          purchase_price: purchasePrice,
          customs_clearing: customsTotal,
          internal_transport: transportTotal,
          external_freight: externalFreight,
          total_landed_cost: purchasePrice + customsTotal + transportTotal + externalFreight
        },
        details: {
          customs_clearing: customsResult.rows,
          internal_transport: transportResult.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// POST /api/inventory/shipments/:id/delivered
// Mark shipment as delivered (with or without issues)
// ============================================================

router.post('/shipments/:id/delivered',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { has_issues } = req.body;
      const user = (req as any).user;
      
      // Validate shipment exists
      const shipmentResult = await pool.query(`
        SELECT s.id, s.sn, p.supplier_id, sup.name as supplier_name
        FROM logistics.shipments s
        LEFT JOIN logistics.shipment_parties p ON p.shipment_id = s.id
        LEFT JOIN master_data.companies sup ON sup.id = p.supplier_id
        WHERE s.id = $1 AND s.is_deleted = FALSE
      `, [id]);
      
      if (shipmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      
      const shipment = shipmentResult.rows[0];
      
      // Start transaction
      await withTransaction(async (client) => {
        // Update shipment_documents with delivery confirmation
        await client.query(`
          UPDATE logistics.shipment_documents
          SET 
            delivery_confirmed_at = NOW(),
            delivery_confirmed_by = $2,
            delivery_has_issues = $3,
            updated_at = NOW()
          WHERE shipment_id = $1
        `, [id, user.id, has_issues || false]);
        
        // Update shipment status to 'delivered'
        await client.query(`
          UPDATE logistics.shipments
          SET 
            status = 'delivered',
            updated_at = NOW(),
            updated_by = $2
          WHERE id = $1
        `, [id, user.username]);
        
        // Record supplier delivery (success tracking)
        await client.query(`
          INSERT INTO logistics.supplier_delivery_records (
            shipment_id, supplier_id, supplier_name, 
            delivery_date, has_quality_issues, 
            final_outcome, confirmed_by_user_id
          ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6)
          ON CONFLICT (shipment_id) DO UPDATE SET
            has_quality_issues = $4,
            final_outcome = CASE WHEN $4 THEN 'partial_issue' ELSE 'successful' END,
            confirmed_by_user_id = $6
        `, [
          id, 
          shipment.supplier_id, 
          shipment.supplier_name,
          has_issues || false,
          has_issues ? 'partial_issue' : 'successful',
          user.id
        ]);
        
        // If has_issues = true, apply hold status (will be managed by quality incident)
        if (has_issues) {
          await client.query(`
            UPDATE logistics.shipments
            SET 
              hold_status = TRUE,
              hold_reason = 'Quality issues reported - pending incident submission'
            WHERE id = $1
          `, [id]);
        }
      });
      
      res.json({
        success: true,
        message: has_issues 
          ? 'Delivery confirmed with issues. Please complete quality incident report.'
          : 'Delivery confirmed successfully. Supplier success recorded.',
        shipment_id: id,
        has_issues,
        hold_applied: has_issues
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// GET /api/inventory/supplier-stats/:supplierId
// Get supplier delivery statistics (for reputation display)
// ============================================================

router.get('/supplier-stats/:supplierId',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplierId } = req.params;
      
      const result = await pool.query(`
        SELECT 
          supplier_name,
          COUNT(*) as total_deliveries,
          COUNT(*) FILTER (WHERE final_outcome = 'successful') as successful,
          COUNT(*) FILTER (WHERE final_outcome = 'partial_issue') as partial_issues,
          COUNT(*) FILTER (WHERE final_outcome = 'major_issue') as major_issues,
          COUNT(*) FILTER (WHERE final_outcome = 'rejected') as rejected,
          ROUND(
            (COUNT(*) FILTER (WHERE final_outcome = 'successful')::NUMERIC / 
            NULLIF(COUNT(*), 0)) * 100, 1
          ) as success_rate
        FROM logistics.supplier_delivery_records
        WHERE supplier_id = $1
        GROUP BY supplier_name
      `, [supplierId]);
      
      if (result.rows.length === 0) {
        return res.json({
          supplier_id: supplierId,
          total_deliveries: 0,
          successful: 0,
          partial_issues: 0,
          major_issues: 0,
          rejected: 0,
          success_rate: null
        });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

