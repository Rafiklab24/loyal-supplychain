import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { loadUserBranches, buildCustomsBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';
import logger from '../utils/logger';
import {
  createCustomsClearingCostSchema,
  updateCustomsClearingCostSchema,
  customsClearingCostFiltersSchema,
  exportCustomsClearingCostsSchema,
  customsClearingCostIdSchema,
  pendingClearancesFiltersSchema,
  createCostFromPendingSchema,
} from '../validators/customsClearingCost';
import {
  exportCustomsClearingCostsToExcel,
  exportCustomsClearingCostsWithSummary,
  generateExportFilename,
} from '../services/excelExportService';
import type { CustomsClearingCostDTO, CustomsClearingCostSummaryDTO } from '../types/dto';

const router = Router();

// Load user branches for filtering
router.use(loadUserBranches);

// Note: Authentication is handled at the app level for /api/customs-clearing-costs routes

/**
 * @route GET /api/v1/customs-clearing-costs
 * @desc Get list of customs clearing costs with filters, pagination, sorting
 * @access Private (Clearance, Accounting, Exec, Admin)
 */
router.get(
  '/',
  validateQuery(customsClearingCostFiltersSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Clearance', 'Accounting', 'Exec', 'Admin', 'Administrator'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const {
        page = 1,
        limit = 50,
        sort_by = 'created_at',
        sort_order = 'desc',
        file_number,
        shipment_id,
        bol_number,
        invoice_number,
        client_name,
        clearance_type,
        clearance_category,
        destination,
        payment_status,
        invoice_date_from,
        invoice_date_to,
        search,
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Build branch filter (filter by linked shipment's branch)
      const branchReq = req as BranchFilterRequest;
      const branchFilter = buildCustomsBranchFilter(branchReq, 'c');

      // Build WHERE clause (with table alias 'c' for customs_clearing_costs)
      const conditions: string[] = ['c.is_deleted = FALSE'];
      const params: any[] = [...branchFilter.params];
      let paramIndex = branchFilter.params.length + 1;
      
      // Apply branch filter
      if (branchFilter.clause !== '1=1') {
        conditions.push(branchFilter.clause);
      }

      if (file_number) {
        conditions.push(`c.file_number ILIKE $${paramIndex}`);
        params.push(`%${file_number}%`);
        paramIndex++;
      }

      if (shipment_id) {
        conditions.push(`c.shipment_id = $${paramIndex}`);
        params.push(shipment_id);
        paramIndex++;
      }

      if (bol_number) {
        conditions.push(`c.bol_number ILIKE $${paramIndex}`);
        params.push(`%${bol_number}%`);
        paramIndex++;
      }

      if (invoice_number) {
        conditions.push(`c.invoice_number ILIKE $${paramIndex}`);
        params.push(`%${invoice_number}%`);
        paramIndex++;
      }

      if (client_name) {
        conditions.push(`c.client_name ILIKE $${paramIndex}`);
        params.push(`%${client_name}%`);
        paramIndex++;
      }

      if (clearance_type) {
        conditions.push(`c.clearance_type = $${paramIndex}`);
        params.push(clearance_type);
        paramIndex++;
      }

      if (clearance_category) {
        conditions.push(`s.clearance_category = $${paramIndex}`);
        params.push(clearance_category);
        paramIndex++;
      }

      if (destination) {
        conditions.push(`c.destination_final_beneficiary ILIKE $${paramIndex}`);
        params.push(`%${destination}%`);
        paramIndex++;
      }

      if (payment_status) {
        conditions.push(`c.payment_status = $${paramIndex}`);
        params.push(payment_status);
        paramIndex++;
      }

      if (invoice_date_from) {
        conditions.push(`c.invoice_date >= $${paramIndex}`);
        params.push(invoice_date_from);
        paramIndex++;
      }

      if (invoice_date_to) {
        conditions.push(`c.invoice_date <= $${paramIndex}`);
        params.push(invoice_date_to);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(
          c.file_number ILIKE $${paramIndex} OR
          c.bol_number ILIKE $${paramIndex} OR
          c.invoice_number ILIKE $${paramIndex} OR
          c.client_name ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total 
         FROM finance.customs_clearing_costs c
         LEFT JOIN logistics.v_shipments_complete s ON c.shipment_id = s.id AND (s.is_deleted = FALSE OR s.is_deleted IS NULL)
         ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated data with shipment info
      const validSortColumns = ['file_number', 'invoice_date', 'total_clearing_cost', 'clearance_type', 'payment_status', 'created_at'];
      let sortExpression: string;
      if (sort_by === 'clearance_category') {
        sortExpression = 's.clearance_category';
      } else {
        sortExpression = `c.${validSortColumns.includes(sort_by as string) ? sort_by : 'created_at'}`;
      }
      const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

      params.push(limit, offset);
      const dataResult = await pool.query(
        `SELECT 
          c.*,
          s.sn as shipment_sn,
          s.product_text as shipment_product,
          s.clearance_category as shipment_clearance_category
        FROM finance.customs_clearing_costs c
        LEFT JOIN logistics.v_shipments_complete s ON c.shipment_id = s.id AND (s.is_deleted = FALSE OR s.is_deleted IS NULL)
        ${whereClause}
        ORDER BY ${sortExpression} ${sortDirection} NULLS LAST
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
      logger.error('Error fetching customs clearing costs:', error);
      res.status(500).json({ error: 'Failed to fetch customs clearing costs' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-costs/summary
 * @desc Get summary statistics for customs clearing costs
 * @access Private (Clearance, Accounting, Exec, Admin)
 */
router.get(
  '/summary',
  async (req: Request, res: Response) => {
    try {
      const summaryResult = await pool.query(`
        SELECT 
          COUNT(*) as total_records,
          COALESCE(SUM(total_clearing_cost), 0) as total_clearing_cost,
          COALESCE(SUM(cost_paid_by_company), 0) as total_paid_by_company,
          COALESCE(SUM(cost_paid_by_fb), 0) as total_paid_by_fb,
          COALESCE(SUM(extra_cost_amount), 0) as total_extra_costs,
          
          COUNT(*) FILTER (WHERE clearance_type = 'inbound') as inbound_count,
          COALESCE(SUM(total_clearing_cost) FILTER (WHERE clearance_type = 'inbound'), 0) as inbound_total,
          
          COUNT(*) FILTER (WHERE clearance_type = 'outbound') as outbound_count,
          COALESCE(SUM(total_clearing_cost) FILTER (WHERE clearance_type = 'outbound'), 0) as outbound_total,
          
          COUNT(*) FILTER (WHERE payment_status = 'pending') as pending_count,
          COALESCE(SUM(total_clearing_cost) FILTER (WHERE payment_status = 'pending'), 0) as pending_total,
          
          COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count,
          COALESCE(SUM(total_clearing_cost) FILTER (WHERE payment_status = 'paid'), 0) as paid_total,
          
          COUNT(*) FILTER (WHERE payment_status = 'partial') as partial_count,
          COALESCE(SUM(total_clearing_cost) FILTER (WHERE payment_status = 'partial'), 0) as partial_total
        FROM finance.customs_clearing_costs
        WHERE is_deleted = FALSE
      `);

      const row = summaryResult.rows[0];
      
      const summary: CustomsClearingCostSummaryDTO = {
        total_records: parseInt(row.total_records, 10),
        total_clearing_cost: parseFloat(row.total_clearing_cost),
        total_paid_by_company: parseFloat(row.total_paid_by_company),
        total_paid_by_fb: parseFloat(row.total_paid_by_fb),
        total_extra_costs: parseFloat(row.total_extra_costs),
        by_clearance_type: {
          inbound: {
            count: parseInt(row.inbound_count, 10),
            total: parseFloat(row.inbound_total),
          },
          outbound: {
            count: parseInt(row.outbound_count, 10),
            total: parseFloat(row.outbound_total),
          },
        },
        by_payment_status: {
          pending: {
            count: parseInt(row.pending_count, 10),
            total: parseFloat(row.pending_total),
          },
          paid: {
            count: parseInt(row.paid_count, 10),
            total: parseFloat(row.paid_total),
          },
          partial: {
            count: parseInt(row.partial_count, 10),
            total: parseFloat(row.partial_total),
          },
        },
      };

      res.json(summary);
    } catch (error) {
      logger.error('Error fetching summary:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-costs/my-assignments
 * @desc Get clearance costs assigned to the current user (for field agents)
 * @access Private (all authenticated users with assignments)
 */
router.get(
  '/my-assignments',
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { status, border_crossing_id } = req.query;

      const conditions: string[] = [
        'c.is_deleted = FALSE',
        'c.assigned_to_user_id = $1'
      ];
      const params: any[] = [user.id];
      let paramIndex = 2;

      // Filter by status
      if (status) {
        conditions.push(`c.clearance_status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      // Filter by border crossing
      if (border_crossing_id) {
        conditions.push(`c.border_crossing_id = $${paramIndex}`);
        params.push(border_crossing_id);
        paramIndex++;
      }

      const result = await pool.query(
        `SELECT 
          c.*,
          s.sn AS shipment_sn,
          s.status AS shipment_status,
          sc.product_text,
          sc.weight_ton,
          sc.container_count,
          sl.pod_id,
          pod.name AS pod_name,
          sl.final_destination,
          bc.name AS border_crossing_name,
          bc.name_ar AS border_crossing_name_ar,
          bc.country_from AS border_country_from,
          bc.country_to AS border_country_to
        FROM finance.customs_clearing_costs c
        LEFT JOIN logistics.shipments s ON s.id = c.shipment_id
        LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
        LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
        LEFT JOIN master_data.ports pod ON pod.id = sl.pod_id
        LEFT JOIN master_data.border_crossings bc ON bc.id = c.border_crossing_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY 
          CASE c.clearance_status 
            WHEN 'pending' THEN 1 
            WHEN 'arrived' THEN 2 
            WHEN 'in_progress' THEN 3 
            ELSE 4 
          END,
          c.arrival_date ASC NULLS LAST,
          c.created_at DESC`,
        params
      );

      // Summary counts
      const summary = {
        pending: result.rows.filter(r => r.clearance_status === 'pending').length,
        arrived: result.rows.filter(r => r.clearance_status === 'arrived').length,
        in_progress: result.rows.filter(r => r.clearance_status === 'in_progress').length,
        cleared: result.rows.filter(r => r.clearance_status === 'cleared').length,
      };

      res.json({
        success: true,
        data: result.rows,
        summary,
        total: result.rowCount,
      });
    } catch (error) {
      logger.error('Error fetching assigned clearances:', error);
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  }
);

/**
 * @route PATCH /api/v1/customs-clearing-costs/:id/status
 * @desc Update clearance status (for field agents)
 * @access Private (assigned user or admin)
 */
router.patch(
  '/:id/status',
  validateParams(customsClearingCostIdSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { clearance_status, notes } = req.body;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate status
      const validStatuses = ['pending', 'arrived', 'in_progress', 'cleared', 'cancelled'];
      if (!validStatuses.includes(clearance_status)) {
        return res.status(400).json({ error: 'Invalid clearance status' });
      }

      // Check if user is assigned or is admin
      const checkResult = await pool.query(
        `SELECT assigned_to_user_id FROM finance.customs_clearing_costs WHERE id = $1`,
        [id]
      );

      if (checkResult.rowCount === 0) {
        return res.status(404).json({ error: 'Clearance cost not found' });
      }

      const isAssigned = checkResult.rows[0].assigned_to_user_id === user.id;
      const isAdmin = ['Admin', 'Administrator', 'Exec'].includes(user.role);

      if (!isAssigned && !isAdmin) {
        return res.status(403).json({ error: 'Not authorized to update this clearance' });
      }

      // Update status
      const updateFields: string[] = ['clearance_status = $1', 'updated_at = NOW()'];
      const updateParams: any[] = [clearance_status];
      let paramIndex = 2;

      // Auto-set clearance_date when status changes to 'cleared'
      if (clearance_status === 'cleared') {
        updateFields.push(`clearance_date = COALESCE(clearance_date, CURRENT_DATE)`);
      }

      // Auto-set arrival_date when status changes to 'arrived'
      if (clearance_status === 'arrived') {
        updateFields.push(`arrival_date = COALESCE(arrival_date, CURRENT_DATE)`);
      }

      // Add notes if provided
      if (notes) {
        updateFields.push(`notes = COALESCE(notes || E'\\n', '') || $${paramIndex}`);
        updateParams.push(`[${new Date().toISOString()}] ${notes}`);
        paramIndex++;
      }

      updateParams.push(id);

      const result = await pool.query(
        `UPDATE finance.customs_clearing_costs 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateParams
      );

      res.json({
        success: true,
        data: result.rows[0],
        message: `Status updated to ${clearance_status}`,
      });
    } catch (error) {
      logger.error('Error updating clearance status:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-costs/export
 * @desc Export customs clearing costs to Excel
 * @access Private (Clearance, Accounting, Exec, Admin)
 */
router.get(
  '/export',
  validateQuery(exportCustomsClearingCostsSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        file_number,
        shipment_id,
        bol_number,
        invoice_number,
        client_name,
        clearance_type,
        payment_status,
        invoice_date_from,
        invoice_date_to,
        search,
      } = req.query;

      // Build WHERE clause (same as GET /)
      const conditions: string[] = ['is_deleted = FALSE'];
      const params: any[] = [];
      let paramIndex = 1;

      if (file_number) {
        conditions.push(`file_number ILIKE $${paramIndex}`);
        params.push(`%${file_number}%`);
        paramIndex++;
      }

      if (shipment_id) {
        conditions.push(`shipment_id = $${paramIndex}`);
        params.push(shipment_id);
        paramIndex++;
      }

      if (bol_number) {
        conditions.push(`bol_number ILIKE $${paramIndex}`);
        params.push(`%${bol_number}%`);
        paramIndex++;
      }

      if (invoice_number) {
        conditions.push(`invoice_number ILIKE $${paramIndex}`);
        params.push(`%${invoice_number}%`);
        paramIndex++;
      }

      if (client_name) {
        conditions.push(`client_name ILIKE $${paramIndex}`);
        params.push(`%${client_name}%`);
        paramIndex++;
      }

      if (clearance_type) {
        conditions.push(`clearance_type = $${paramIndex}`);
        params.push(clearance_type);
        paramIndex++;
      }

      if (payment_status) {
        conditions.push(`payment_status = $${paramIndex}`);
        params.push(payment_status);
        paramIndex++;
      }

      if (invoice_date_from) {
        conditions.push(`invoice_date >= $${paramIndex}`);
        params.push(invoice_date_from);
        paramIndex++;
      }

      if (invoice_date_to) {
        conditions.push(`invoice_date <= $${paramIndex}`);
        params.push(invoice_date_to);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(
          file_number ILIKE $${paramIndex} OR
          bol_number ILIKE $${paramIndex} OR
          invoice_number ILIKE $${paramIndex} OR
          client_name ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get all matching records
      const dataResult = await pool.query(
        `SELECT * FROM finance.customs_clearing_costs ${whereClause} ORDER BY invoice_date DESC, created_at DESC`,
        params
      );

      // Generate Excel file
      const excelBuffer = exportCustomsClearingCostsWithSummary(dataResult.rows);
      const filename = generateExportFilename();

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      logger.error('Error exporting customs clearing costs:', error);
      res.status(500).json({ error: 'Failed to export customs clearing costs' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-costs/pending-clearances
 * @desc Get shipments with clearance date but no cost entry yet
 * @access Private (Clearance, Admin)
 */
router.get(
  '/pending-clearances',
  validateQuery(pendingClearancesFiltersSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Clearance', 'Admin', 'Administrator', 'Accounting', 'Exec'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const {
        page = 1,
        limit = 50,
        sort_by = 'customs_clearance_date',
        sort_order = 'desc',
        clearance_date_from,
        clearance_date_to,
        clearance_category,
        pod_name,
        search,
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Build WHERE clause
      const conditions: string[] = [
        's.is_deleted = FALSE',
        's.customs_clearance_date IS NOT NULL',
      ];
      const params: any[] = [];
      let paramIndex = 1;

      if (clearance_date_from) {
        conditions.push(`s.customs_clearance_date >= $${paramIndex}`);
        params.push(clearance_date_from);
        paramIndex++;
      }

      if (clearance_date_to) {
        conditions.push(`s.customs_clearance_date <= $${paramIndex}`);
        params.push(clearance_date_to);
        paramIndex++;
      }

      if (clearance_category) {
        conditions.push(`s.clearance_category = $${paramIndex}`);
        params.push(clearance_category);
        paramIndex++;
      }

      if (pod_name) {
        conditions.push(`pod.name ILIKE $${paramIndex}`);
        params.push(`%${pod_name}%`);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(
          s.sn ILIKE $${paramIndex} OR
          s.product_text ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count - shipments without cost entry
      const countResult = await pool.query(
        `SELECT COUNT(*) as total 
         FROM logistics.v_shipments_complete s
         LEFT JOIN finance.customs_clearing_costs c ON c.shipment_id = s.id AND c.is_deleted = FALSE
         WHERE ${whereClause} AND c.id IS NULL`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated data
      const validSortColumns = ['sn', 'product_text', 'customs_clearance_date', 'weight_ton', 'container_count', 'eta', 'clearance_category'];
      // Handle sorting by joined columns
      let sortExpression: string;
      if (sort_by === 'pol_name') {
        sortExpression = 'pol.name';
      } else if (sort_by === 'pod_name') {
        sortExpression = 'pod.name';
      } else {
        sortExpression = `s.${validSortColumns.includes(sort_by as string) ? sort_by : 'customs_clearance_date'}`;
      }
      const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

      params.push(limit, offset);
      const dataResult = await pool.query(
        `SELECT 
          s.id,
          s.sn,
          s.product_text,
          s.customs_clearance_date,
          s.weight_ton,
          s.container_count,
          s.eta,
          s.free_time_days,
          s.status,
          COALESCE(s.bol_numbers->>0, s.bl_no) as bl_no,
          s.bol_numbers,
          s.booking_no,
          s.total_value_usd,
          s.subject,
          s.transaction_type,
          pol.name as pol_name,
          pol.country as pol_country,
          pod.name as pod_name,
          pod.country as pod_country,
          sl.name as shipping_line_name,
          -- Final destination for route display (POD → Final Destination)
          COALESCE(
            s.final_destination->>'delivery_place',
            s.final_destination->>'name',
            s.final_beneficiary_name
          ) as final_destination_name,
          s.final_destination->>'branch_id' as final_destination_branch_id,
          -- Border crossing info for cross-border shipments
          s.is_cross_border,
          s.primary_border_name,
          s.primary_border_name_ar,
          -- Clearance category (transit/domestic/custom_clearance)
          s.clearance_category
        FROM logistics.v_shipments_complete s
        LEFT JOIN finance.customs_clearing_costs c ON c.shipment_id = s.id AND c.is_deleted = FALSE
        LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
        LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
        LEFT JOIN master_data.companies sl ON s.shipping_line_id = sl.id
        WHERE ${whereClause} AND c.id IS NULL
        ORDER BY ${sortExpression} ${sortDirection} NULLS LAST
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
      logger.error('Error fetching pending clearances:', error);
      res.status(500).json({ error: 'Failed to fetch pending clearances' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-costs/search-shipments
 * @desc Search shipments by BOL number or Shipment ID for linking to customs costs
 * @access Private (Clearance, Admin)
 */
router.get(
  '/search-shipments',
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Clearance', 'Admin', 'Administrator', 'Accounting', 'Exec'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { q, limit = 20 } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json({ data: [] });
      }

      const searchTerm = q.trim();

      // Search shipments by BOL, SN, or ID
      // Only return shipments that don't already have a customs clearing cost entry
      const result = await pool.query(
        `SELECT 
          s.id,
          s.sn,
          s.product_text,
          s.subject,
          s.bl_no,
          s.booking_no,
          s.customs_clearance_date,
          s.weight_ton,
          s.container_count,
          s.status,
          s.direction,
          s.eta,
          s.total_value_usd,
          pol.name as pol_name,
          pol.country as pol_country,
          pod.name as pod_name,
          pod.country as pod_country,
          sl.name as shipping_line_name,
          sup.name as supplier_name,
          fb.name as final_beneficiary_name,
          CASE WHEN c.id IS NOT NULL THEN true ELSE false END as has_cost_entry
        FROM logistics.v_shipments_complete s
        LEFT JOIN finance.customs_clearing_costs c ON c.shipment_id = s.id AND c.is_deleted = FALSE
        LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
        LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
        LEFT JOIN master_data.companies sl ON s.shipping_line_id = sl.id
        LEFT JOIN master_data.companies sup ON s.supplier_id = sup.id
        LEFT JOIN master_data.companies fb ON s.final_beneficiary_company_id = fb.id
        WHERE s.is_deleted = FALSE
          AND (
            s.bl_no ILIKE $1
            OR s.sn ILIKE $1
            OR s.id::text ILIKE $1
            OR s.booking_no ILIKE $1
            OR s.product_text ILIKE $1
          )
        ORDER BY 
          CASE WHEN c.id IS NULL THEN 0 ELSE 1 END,
          s.customs_clearance_date DESC NULLS LAST,
          s.created_at DESC
        LIMIT $2`,
        [`%${searchTerm}%`, limit]
      );

      res.json({ data: result.rows });
    } catch (error) {
      logger.error('Error searching shipments:', error);
      res.status(500).json({ error: 'Failed to search shipments' });
    }
  }
);

/**
 * @route GET /api/v1/customs-clearing-costs/:id
 * @desc Get single customs clearing cost by ID
 * @access Private (Clearance, Accounting, Exec, Admin)
 */
router.get(
  '/:id',
  validateParams(customsClearingCostIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT 
          c.*,
          s.sn as shipment_sn,
          s.product_text as shipment_product
        FROM finance.customs_clearing_costs c
        LEFT JOIN logistics.v_shipments_complete s ON c.shipment_id = s.id AND (s.is_deleted = FALSE OR s.is_deleted IS NULL)
        WHERE c.id = $1 AND c.is_deleted = FALSE`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customs clearing cost not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching customs clearing cost:', error);
      res.status(500).json({ error: 'Failed to fetch customs clearing cost' });
    }
  }
);

/**
 * @route POST /api/v1/customs-clearing-costs/from-pending
 * @desc Create customs clearing cost from pending shipment
 * @access Private (Clearance, Admin)
 */
router.post(
  '/from-pending',
  validateBody(createCostFromPendingSchema),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check role access
      const allowedRoles = ['Clearance', 'Admin', 'Administrator', 'Accounting', 'Exec'];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const data = req.body;

      // Get shipment details
      const shipmentResult = await pool.query(
        `SELECT s.*, 
          pol.name as pol_name,
          pod.name as pod_name
         FROM logistics.v_shipments_complete s
         LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
         LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
         WHERE s.id = $1 AND s.is_deleted = FALSE`,
        [data.shipment_id]
      );

      if (shipmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      const shipment = shipmentResult.rows[0];

      // Check if cost entry already exists
      const existingCost = await pool.query(
        'SELECT id FROM finance.customs_clearing_costs WHERE shipment_id = $1 AND is_deleted = FALSE',
        [data.shipment_id]
      );

      if (existingCost.rows.length > 0) {
        return res.status(400).json({ error: 'Cost entry already exists for this shipment' });
      }

      // Use provided file_number or generate based on shipment SN or sequential
      let file_number = data.file_number; // Use provided file_number first
      if (!file_number) {
      if (shipment.sn) {
        file_number = shipment.sn;
      } else {
        // Generate sequential number
        const countResult = await pool.query(
          'SELECT COUNT(*) as count FROM finance.customs_clearing_costs WHERE is_deleted = FALSE'
        );
        const count = parseInt(countResult.rows[0].count, 10) + 1;
        file_number = `LIN-${count}`;
        }
      }

      // Calculate total cost
      const originalAmount = data.original_clearing_amount || 0;
      const extraAmount = data.extra_cost_amount || 0;
      const total_clearing_cost = originalAmount + extraAmount;

      // Auto-populate fields from shipment if not provided
      const transaction_type = data.transaction_type || 'تخليص + نقل';
      const goods_type = data.goods_type || shipment.product_text;
      const containers_cars_count = data.containers_cars_count || 
        (shipment.container_count ? `${shipment.container_count} حاوية` : null);
      const goods_weight = data.goods_weight || 
        (shipment.weight_ton ? `${shipment.weight_ton} طن` : null);
      
      // Auto-populate Final Destination from shipment's final_destination field
      let destination_final_beneficiary = data.destination_final_beneficiary || null;
      if (!destination_final_beneficiary && shipment.final_destination) {
        const finalDest = typeof shipment.final_destination === 'string' 
          ? JSON.parse(shipment.final_destination) 
          : shipment.final_destination;
        // Use delivery_place first, then fall back to name
        destination_final_beneficiary = finalDest.delivery_place || finalDest.name || null;
      }

      // Build transaction_description from combined fields (for legacy NOT NULL constraint)
      const transactionDescription = [
        transaction_type,
        goods_type,
        containers_cars_count,
        goods_weight
      ].filter(Boolean).join(' - ') || 'تخليص جمركي';

      // Create the cost entry
      const result = await pool.query(
        `INSERT INTO finance.customs_clearing_costs (
          file_number, shipment_id, transaction_description,
          transaction_type, goods_type, containers_cars_count, goods_weight, cost_description,
          destination_final_beneficiary, bol_number, car_plate, 
          cost_responsibility, original_clearing_amount,
          extra_cost_amount, extra_cost_description, total_clearing_cost,
          client_name, invoice_amount, currency, invoice_number, invoice_date,
          clearance_type, payment_status, notes, created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        ) RETURNING *`,
        [
          file_number,
          data.shipment_id,
          transactionDescription,
          transaction_type,
          goods_type,
          containers_cars_count,
          goods_weight,
          data.cost_description || null,
          destination_final_beneficiary,
          data.bol_number || shipment.bl_no || (shipment.bol_numbers && shipment.bol_numbers[0]) || null,
          data.car_plate || null,
          data.cost_responsibility || null,
          data.original_clearing_amount || null,
          data.extra_cost_amount || null,
          data.extra_cost_description || null,
          total_clearing_cost,
          data.client_name || null,
          data.invoice_amount || null,
          data.currency || 'USD',
          data.invoice_number || null,
          data.invoice_date || null,
          data.clearance_type || 'inbound',
          data.payment_status || 'pending',
          data.notes || null,
          user.username || 'system',
          user.username || 'system',
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      logger.error('Error creating cost from pending:', error);
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: 'Failed to create cost from pending shipment',
        details: error.message || 'Unknown error'
      });
    }
  }
);

/**
 * @route POST /api/v1/customs-clearing-costs
 * @desc Create new customs clearing cost
 * @access Private (Clearance, Accounting, Admin)
 */
router.post(
  '/',
  validateBody(createCustomsClearingCostSchema),
  async (req: Request, res: Response) => {
    try {
      const data = req.body;

      const result = await pool.query(
        `INSERT INTO finance.customs_clearing_costs (
          file_number, shipment_id, 
          transaction_type, goods_type, containers_cars_count, goods_weight, cost_description,
          transaction_description, destination_final_beneficiary,
          bol_number, car_plate, 
          cost_responsibility, original_clearing_amount,
          cost_paid_by_company, cost_paid_by_fb,
          extra_cost_amount, extra_cost_description, total_clearing_cost,
          client_name, invoice_amount, currency, invoice_number, invoice_date,
          clearance_type, payment_status, notes, created_by, updated_by,
          border_crossing_id, stage_order, arrival_date, clearance_date, assigned_to_user_id, clearance_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34
        ) RETURNING *`,
        [
          data.file_number,
          data.shipment_id || null,
          data.transaction_type || null,
          data.goods_type || null,
          data.containers_cars_count || null,
          data.goods_weight || null,
          data.cost_description || null,
          data.transaction_description || null,
          data.destination_final_beneficiary || null,
          data.bol_number || null,
          data.car_plate || null,
          data.cost_responsibility || null,
          data.original_clearing_amount || null,
          data.cost_paid_by_company || null,
          data.cost_paid_by_fb || null,
          data.extra_cost_amount || null,
          data.extra_cost_description || null,
          data.total_clearing_cost,
          data.client_name || null,
          data.invoice_amount || null,
          data.currency || 'USD',
          data.invoice_number || null,
          data.invoice_date || null,
          data.clearance_type || null,
          data.payment_status || 'pending',
          data.notes || null,
          'system',
          'system',
          data.border_crossing_id || null,
          data.stage_order || 1,
          data.arrival_date || null,
          data.clearance_date || null,
          data.assigned_to_user_id || null,
          data.clearance_status || 'pending',
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Error creating customs clearing cost:', error);
      res.status(500).json({ error: 'Failed to create customs clearing cost' });
    }
  }
);

/**
 * @route PUT /api/v1/customs-clearing-costs/:id
 * @desc Update existing customs clearing cost
 * @access Private (Clearance, Accounting, Admin)
 */
router.put(
  '/:id',
  validateParams(customsClearingCostIdSchema),
  validateBody(updateCustomsClearingCostSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      logger.info('PUT /api/customs-clearing-costs/:id - Received data:', JSON.stringify(data, null, 2));

      // Check if record exists
      const checkResult = await pool.query(
        'SELECT id FROM finance.customs_clearing_costs WHERE id = $1 AND is_deleted = FALSE',
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Customs clearing cost not found' });
      }

      // Build UPDATE query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;

      const updatableFields = [
        'file_number', 'shipment_id', 
        'transaction_type', 'goods_type', 'containers_cars_count', 'goods_weight', 'cost_description',
        'transaction_description', 'destination_final_beneficiary',
        'bol_number', 'car_plate', 
        'cost_responsibility', 'original_clearing_amount',
        'cost_paid_by_company', 'cost_paid_by_fb',
        'extra_cost_amount', 'extra_cost_description', 'total_clearing_cost',
        'client_name', 'invoice_amount', 'currency', 'invoice_number', 'invoice_date',
        'clearance_type', 'payment_status', 'notes',
        // Border crossing fields
        'border_crossing_id', 'stage_order', 'arrival_date', 'clearance_date', 
        'assigned_to_user_id', 'clearance_status',
      ];

      for (const field of updatableFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = $${valueIndex}`);
          values.push(data[field]);
          valueIndex++;
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Add updated_by and updated_at
      updates.push(`updated_by = $${valueIndex}`);
      values.push('system');
      valueIndex++;

      updates.push(`updated_at = NOW()`);

      values.push(id);

      const result = await pool.query(
        `UPDATE finance.customs_clearing_costs 
         SET ${updates.join(', ')}
         WHERE id = $${valueIndex}
         RETURNING *`,
        values
      );

      res.json(result.rows[0]);
    } catch (error: any) {
      logger.error('Error updating customs clearing cost:', error);
      logger.error('Error stack:', error.stack);
      logger.error('Error message:', error.message);
      res.status(500).json({ 
        error: 'Failed to update customs clearing cost',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

/**
 * @route DELETE /api/v1/customs-clearing-costs/:id
 * @desc Soft delete customs clearing cost
 * @access Private (Clearance, Admin)
 */
router.delete(
  '/:id',
  validateParams(customsClearingCostIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE finance.customs_clearing_costs 
         SET is_deleted = TRUE, updated_by = $1, updated_at = NOW()
         WHERE id = $2 AND is_deleted = FALSE
         RETURNING id`,
        ['system', id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customs clearing cost not found' });
      }

      res.json({ message: 'Customs clearing cost deleted successfully', id });
    } catch (error) {
      logger.error('Error deleting customs clearing cost:', error);
      res.status(500).json({ error: 'Failed to delete customs clearing cost' });
    }
  }
);

export default router;

