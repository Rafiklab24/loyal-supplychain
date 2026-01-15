import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { loadUserBranches, buildShipmentBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';
import { z } from 'zod';
import logger from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Load user branches for filtering
router.use(loadUserBranches);

// Roles that can access E-Fatura module
const E_FATURA_ROLES = ['Admin', 'Exec', 'Logistics', 'Inventory', 'Clearance', 'Accounting', 'Internal_Logistics'];

// Validation schemas
const pendingFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
});

const archiveFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  cross_border_only: z.coerce.boolean().default(false),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

const saveEFaturaSchema = z.object({
  e_fatura_number: z.string().min(1).max(100),
});

const saveBeyanameSchema = z.object({
  beyaname_number: z.string().min(1).max(100),
  beyaname_date: z.string().optional(),
});

const beyanameFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  status: z.enum(['pending', 'issued', 'completed', 'all']).default('pending'),
});

// ========== GET E-FATURA SUMMARY COUNTS ==========

/**
 * GET /api/e-fatura/summary
 * Get counts for pending and archive tabs
 */
router.get('/summary', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    let branchClause = '';
    if (branchFilter.clause !== '1=1') {
      branchClause = ` AND ${branchFilter.clause}`;
    }

    const summaryQuery = `
      SELECT 
        -- Pending: Cross-border OR selling shipments without E-Fatura
        COUNT(DISTINCT CASE 
          WHEN (s.is_cross_border = TRUE OR s.transaction_type = 'outgoing')
            AND (s.e_fatura_number IS NULL OR s.e_fatura_number = '')
          THEN s.id 
        END) AS pending_count,
        -- Archive: Has E-Fatura + Non-cross-border incoming
        COUNT(DISTINCT CASE 
          WHEN (s.e_fatura_number IS NOT NULL AND s.e_fatura_number != '')
            OR (COALESCE(s.is_cross_border, FALSE) = FALSE AND s.transaction_type = 'incoming')
          THEN s.id 
        END) AS archive_count,
        -- Completed: Has E-Fatura assigned
        COUNT(DISTINCT CASE 
          WHEN s.e_fatura_number IS NOT NULL AND s.e_fatura_number != ''
          THEN s.id 
        END) AS completed_count,
        -- Not required: Non-cross-border incoming only
        COUNT(DISTINCT CASE 
          WHEN COALESCE(s.is_cross_border, FALSE) = FALSE AND s.transaction_type = 'incoming'
          THEN s.id 
        END) AS not_required_count,
        -- Sales pending: Outgoing shipments without E-Fatura
        COUNT(DISTINCT CASE 
          WHEN s.transaction_type = 'outgoing'
            AND (s.e_fatura_number IS NULL OR s.e_fatura_number = '')
          THEN s.id 
        END) AS sales_pending_count
      FROM logistics.v_shipments_complete s
      WHERE s.is_deleted = FALSE
        AND (s.customs_clearance_date IS NOT NULL OR s.transaction_type = 'outgoing')
        ${branchClause}
    `;

    const result = await pool.query(summaryQuery, branchFilter.params);

    res.json({
      pending: parseInt(result.rows[0].pending_count) || 0,
      archive: parseInt(result.rows[0].archive_count) || 0,
      completed: parseInt(result.rows[0].completed_count) || 0,
      not_required: parseInt(result.rows[0].not_required_count) || 0,
      sales_pending: parseInt(result.rows[0].sales_pending_count) || 0,
    });
  } catch (error) {
    logger.error('Error fetching E-Fatura summary:', error);
    res.status(500).json({ error: 'Failed to fetch E-Fatura summary' });
  }
});

// ========== GET PENDING E-FATURA SHIPMENTS ==========

/**
 * GET /api/e-fatura/pending
 * Get cross-border shipments that are cleared and need E-Fatura assignment
 * Only shows shipments where is_cross_border = TRUE (mandatory E-Fatura)
 * Includes all delivery information for internal transportation
 */
router.get('/pending', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const filters = pendingFiltersSchema.parse(req.query);
    const { page, limit, search } = filters;
    const offset = (page - 1) * limit;

    // Build branch filter for shipments
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    // Show shipments that need E-Fatura:
    // 1. Cross-border incoming shipments with customs clearance
    // 2. ALL selling (outgoing) shipments
    let whereClause = `
      s.is_deleted = FALSE
      AND (s.e_fatura_number IS NULL OR s.e_fatura_number = '')
      AND (
        (s.customs_clearance_date IS NOT NULL AND s.is_cross_border = TRUE)
        OR s.transaction_type = 'outgoing'
      )
    `;

    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;

    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      whereClause += ` AND ${branchFilter.clause}`;
    }

    // Search filter
    if (search) {
      whereClause += ` AND (
        s.sn ILIKE $${paramIndex}
        OR s.product_text ILIKE $${paramIndex}
        OR supplier.name ILIKE $${paramIndex}
        OR s.buyer_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.companies supplier ON s.supplier_id = supplier.id
      LEFT JOIN logistics.contracts c ON s.contract_id = c.id
      LEFT JOIN logistics.contract_parties cp ON cp.contract_id = c.id
      LEFT JOIN master_data.companies buyer ON cp.buyer_company_id = buyer.id
      WHERE ${whereClause}
    `;

    // Main query - get shipments with all E-Fatura required fields
    const dataQuery = `
      SELECT 
        s.id,
        s.sn AS commercial_invoice_number,
        s.customs_clearance_date,
        s.contract_id,
        s.e_fatura_number,
        s.e_fatura_created_at,
        -- Transaction type (incoming/outgoing) for badge display
        COALESCE(s.transaction_type, 'incoming') AS transaction_type,
        -- Cross-border status (determines if E-Fatura is mandatory)
        COALESCE(s.is_cross_border, FALSE) AS is_cross_border,
        CASE WHEN s.is_cross_border = TRUE OR s.transaction_type = 'outgoing' THEN TRUE ELSE FALSE END AS e_fatura_required,
        -- Supplier info
        supplier.id AS supplier_id,
        supplier.name AS supplier_name,
        -- Buyer info (from view - already resolved)
        s.buyer_id AS buyer_id,
        COALESCE(s.buyer_name, s.buyer_company_name) AS buyer_name,
        -- Weight info
        COALESCE(s.net_weight_kg, s.weight_ton * 1000) AS net_weight_kg,
        COALESCE(s.gross_weight_kg, s.weight_ton * 1000) AS gross_weight_kg,
        s.weight_ton,
        -- Total value
        s.total_value_usd,
        COALESCE(sf.currency_code, 'USD') AS currency_code,
        -- Package count
        COALESCE(
          s.bags_count,
          (SELECT SUM(COALESCE(sc.package_count, sc.bags_count, 0))::integer 
           FROM logistics.shipment_containers sc 
           WHERE sc.shipment_id = s.id),
          s.container_count
        ) AS package_count,
        -- Country of origin (from export country or POL country)
        COALESCE(
          s.country_of_export,
          s.pol_country,
          pol.country
        ) AS country_of_origin,
        -- Port info for reference
        pol.name AS pol_name,
        pod.name AS pod_name,
        -- Internal route (POD → Final Destination)
        COALESCE(
          s.final_destination->>'delivery_place',
          NULLIF(s.final_destination->>'name', ''),
          sp.final_beneficiary_name,
          s.final_beneficiary_name
        ) AS final_destination_place,
        s.final_destination->>'branch_id' AS final_destination_branch_id,
        -- Product info
        s.product_text,
        -- Deliveries (internal transportation) as JSON array with container weights
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', od.id,
            'delivery_number', od.delivery_number,
            'delivery_date', od.delivery_date,
            'truck_plate_number', od.truck_plate_number,
            'origin', od.origin,
            'destination', od.destination,
            'route', CONCAT(COALESCE(od.origin, pod.name, 'Origin'), ' → ', od.destination),
            'weight_kg', od.weight_kg,
            'gross_weight_kg', COALESCE(sc_del.gross_weight_kg, od.weight_kg),
            'net_weight_kg', sc_del.net_weight_kg,
            'container_number', sc_del.container_number,
            'driver_name', od.driver_name,
            'transport_company_name', COALESCE(tc.name, od.transport_company_name),
            'status', od.status
          ) ORDER BY od.delivery_date DESC, od.created_at DESC), '[]'::json)
          FROM logistics.outbound_deliveries od
          LEFT JOIN master_data.transport_companies tc ON od.transport_company_id = tc.id
          LEFT JOIN logistics.shipment_containers sc_del ON (
            sc_del.shipment_id = od.shipment_id AND 
            (LOWER(sc_del.container_number) = LOWER(od.container_id) OR 
             LOWER(COALESCE(sc_del.container_no, '')) = LOWER(od.container_id) OR
             sc_del.id::text = od.container_id)
          )
          WHERE od.shipment_id = s.id AND od.is_deleted = FALSE
        ) AS deliveries,
        -- Delivery count for display
        (
          SELECT COUNT(*) 
          FROM logistics.outbound_deliveries od 
          WHERE od.shipment_id = s.id AND od.is_deleted = FALSE
        ) AS delivery_count,
        -- Containers (for showing in E-Fatura when no deliveries exist yet)
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', sc.id,
            'container_number', COALESCE(sc.container_number, sc.container_no),
            'gross_weight_kg', sc.gross_weight_kg,
            'net_weight_kg', sc.net_weight_kg,
            'package_count', COALESCE(sc.package_count, sc.bags_count),
            'seal_number', COALESCE(sc.seal_number, sc.seal_no)
          ) ORDER BY COALESCE(sc.container_number, sc.container_no)), '[]'::json)
          FROM logistics.shipment_containers sc
          WHERE sc.shipment_id = s.id
        ) AS containers,
        -- Container count for display
        (
          SELECT COUNT(*) 
          FROM logistics.shipment_containers sc 
          WHERE sc.shipment_id = s.id
        ) AS container_count,
        -- E-Fatura documents (for download)
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', d.id,
            'filename', d.filename,
            'original_filename', d.original_filename,
            'file_size', d.file_size,
            'upload_ts', d.upload_ts,
            'uploaded_by', uploader.name
          ) ORDER BY d.upload_ts DESC), '[]'::json)
          FROM archive.documents d
          LEFT JOIN security.users uploader ON d.uploaded_by = uploader.id
          WHERE d.shipment_id = s.id 
            AND d.doc_type = 'e_fatura'
            AND d.is_deleted = FALSE
        ) AS e_fatura_documents
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.companies supplier ON s.supplier_id = supplier.id
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN logistics.contracts c ON s.contract_id = c.id
      LEFT JOIN logistics.contract_parties cp ON cp.contract_id = c.id
      LEFT JOIN logistics.contract_shipping cs ON cs.contract_id = c.id
      LEFT JOIN master_data.companies buyer ON cp.buyer_company_id = buyer.id
      LEFT JOIN logistics.shipment_financials sf ON sf.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      WHERE ${whereClause}
      ORDER BY s.customs_clearance_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, params.slice(0, paramIndex - 1)),
      pool.query(dataQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    logger.error('Error fetching E-Fatura pending shipments:', error);
    res.status(500).json({ error: 'Failed to fetch pending E-Fatura shipments' });
  }
});

// ========== GET ARCHIVE E-FATURA SHIPMENTS ==========

/**
 * GET /api/e-fatura/archive
 * Get completed/archived E-Fatura shipments:
 * - Cross-border shipments that have E-Fatura assigned (completed)
 * - Non-cross-border shipments (don't require E-Fatura, auto-archived)
 */
router.get('/archive', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const filters = archiveFiltersSchema.parse(req.query);
    const { page, limit, search, cross_border_only, date_from, date_to } = filters;
    const offset = (page - 1) * limit;

    // Build branch filter for shipments
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    // Archive shows:
    // 1. Cross-border shipments WITH E-Fatura (completed)
    // 2. Non-cross-border shipments (don't need E-Fatura)
    let whereClause = `
      s.is_deleted = FALSE
      AND s.customs_clearance_date IS NOT NULL
      AND (
        (s.is_cross_border = TRUE AND s.e_fatura_number IS NOT NULL AND s.e_fatura_number != '')
        OR (COALESCE(s.is_cross_border, FALSE) = FALSE)
      )
    `;

    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;

    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      whereClause += ` AND ${branchFilter.clause}`;
    }

    // Filter by cross-border only
    if (cross_border_only) {
      whereClause += ` AND s.is_cross_border = TRUE`;
    }

    // Date range filters (on customs_clearance_date)
    if (date_from) {
      whereClause += ` AND s.customs_clearance_date >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      whereClause += ` AND s.customs_clearance_date <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }

    // Search filter
    if (search) {
      whereClause += ` AND (
        s.sn ILIKE $${paramIndex}
        OR s.product_text ILIKE $${paramIndex}
        OR supplier.name ILIKE $${paramIndex}
        OR s.buyer_name ILIKE $${paramIndex}
        OR s.e_fatura_number ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.companies supplier ON s.supplier_id = supplier.id
      LEFT JOIN logistics.contracts c ON s.contract_id = c.id
      LEFT JOIN logistics.contract_parties cp ON cp.contract_id = c.id
      LEFT JOIN master_data.companies buyer ON cp.buyer_company_id = buyer.id
      WHERE ${whereClause}
    `;

    // Main query - get archived shipments
    const dataQuery = `
      SELECT 
        s.id,
        s.sn AS commercial_invoice_number,
        s.customs_clearance_date,
        s.contract_id,
        s.e_fatura_number,
        s.e_fatura_created_at,
        -- Transaction type for display
        COALESCE(s.transaction_type, 'incoming') AS transaction_type,
        -- Cross-border status
        COALESCE(s.is_cross_border, FALSE) AS is_cross_border,
        CASE WHEN s.is_cross_border = TRUE OR s.transaction_type = 'outgoing' THEN TRUE ELSE FALSE END AS e_fatura_required,
        -- Archive status
        CASE 
          WHEN s.e_fatura_number IS NOT NULL AND s.e_fatura_number != '' THEN 'completed'
          WHEN s.transaction_type = 'outgoing' THEN 'sale_pending'
          WHEN COALESCE(s.is_cross_border, FALSE) = FALSE THEN 'not_required'
          ELSE 'pending'
        END AS archive_status,
        -- Supplier info
        supplier.id AS supplier_id,
        supplier.name AS supplier_name,
        -- Buyer info (from view - already resolved)
        s.buyer_id AS buyer_id,
        COALESCE(s.buyer_name, s.buyer_company_name) AS buyer_name,
        -- Weight info
        COALESCE(s.net_weight_kg, s.weight_ton * 1000) AS net_weight_kg,
        COALESCE(s.gross_weight_kg, s.weight_ton * 1000) AS gross_weight_kg,
        s.weight_ton,
        -- Total value
        s.total_value_usd,
        COALESCE(sf.currency_code, 'USD') AS currency_code,
        -- Country of origin
        COALESCE(s.country_of_export, s.pol_country, pol.country) AS country_of_origin,
        -- Port info
        pol.name AS pol_name,
        pod.name AS pod_name,
        -- Internal route (POD → Final Destination)
        COALESCE(
          s.final_destination->>'delivery_place',
          NULLIF(s.final_destination->>'name', ''),
          sp.final_beneficiary_name,
          s.final_beneficiary_name
        ) AS final_destination_place,
        -- Product info
        s.product_text,
        -- Delivery count for display
        (
          SELECT COUNT(*) 
          FROM logistics.outbound_deliveries od 
          WHERE od.shipment_id = s.id AND od.is_deleted = FALSE
        ) AS delivery_count,
        -- Container count for display
        (
          SELECT COUNT(*) 
          FROM logistics.shipment_containers sc 
          WHERE sc.shipment_id = s.id
        ) AS container_count,
        -- E-Fatura documents (for download)
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', d.id,
            'filename', d.filename,
            'original_filename', d.original_filename,
            'file_size', d.file_size,
            'upload_ts', d.upload_ts,
            'uploaded_by', uploader.name
          ) ORDER BY d.upload_ts DESC), '[]'::json)
          FROM archive.documents d
          LEFT JOIN security.users uploader ON d.uploaded_by = uploader.id
          WHERE d.shipment_id = s.id 
            AND d.doc_type = 'e_fatura'
            AND d.is_deleted = FALSE
        ) AS e_fatura_documents
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.companies supplier ON s.supplier_id = supplier.id
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN logistics.contracts c ON s.contract_id = c.id
      LEFT JOIN logistics.contract_parties cp ON cp.contract_id = c.id
      LEFT JOIN master_data.companies buyer ON cp.buyer_company_id = buyer.id
      LEFT JOIN logistics.shipment_financials sf ON sf.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      WHERE ${whereClause}
      ORDER BY s.customs_clearance_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, params.slice(0, paramIndex - 1)),
      pool.query(dataQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    logger.error('Error fetching E-Fatura archive:', error);
    res.status(500).json({ error: 'Failed to fetch E-Fatura archive' });
  }
});

// ========== SAVE E-FATURA NUMBER ==========

/**
 * PUT /api/e-fatura/:shipmentId
 * Save the E-Fatura number for a shipment
 */
router.put('/:shipmentId', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const data = saveEFaturaSchema.parse(req.body);
    const user = (req as any).user;

    // Verify shipment exists and has clearance date
    const shipmentCheck = await pool.query(
      `SELECT s.id, sl.customs_clearance_date 
       FROM logistics.shipments s
       LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
       WHERE s.id = $1 AND s.is_deleted = FALSE`,
      [shipmentId]
    );

    if (shipmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (!shipmentCheck.rows[0].customs_clearance_date) {
      return res.status(400).json({ error: 'Shipment has not been cleared yet' });
    }

    // Update or insert the E-Fatura number in shipment_documents
    const result = await pool.query(
      `INSERT INTO logistics.shipment_documents (shipment_id, e_fatura_number, e_fatura_created_at, e_fatura_created_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (shipment_id) 
       DO UPDATE SET 
         e_fatura_number = $2,
         e_fatura_created_at = NOW(),
         e_fatura_created_by = $3,
         updated_at = NOW()
       RETURNING id, e_fatura_number, e_fatura_created_at`,
      [shipmentId, data.e_fatura_number, user?.id]
    );

    res.json({
      success: true,
      message: 'E-Fatura number saved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    logger.error('Error saving E-Fatura number:', error);
    res.status(500).json({ error: 'Failed to save E-Fatura number' });
  }
});

// ========== CLEAR E-FATURA NUMBER ==========

/**
 * DELETE /api/e-fatura/:shipmentId
 * Clear/remove the E-Fatura number for a shipment (mark as pending again)
 */
router.delete('/:shipmentId', authorizeRoles('Admin', 'Exec'), async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;

    const result = await pool.query(
      `UPDATE logistics.shipment_documents 
       SET e_fatura_number = NULL,
           e_fatura_created_at = NULL,
           e_fatura_created_by = NULL,
           updated_at = NOW()
       WHERE shipment_id = $1
       RETURNING id`,
      [shipmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment document record not found' });
    }

    res.json({
      success: true,
      message: 'E-Fatura number cleared successfully',
    });
  } catch (error) {
    logger.error('Error clearing E-Fatura number:', error);
    res.status(500).json({ error: 'Failed to clear E-Fatura number' });
  }
});

// ========== GET SINGLE SHIPMENT E-FATURA DETAILS ==========

/**
 * GET /api/e-fatura/:shipmentId
 * Get detailed E-Fatura information for a specific shipment
 */
router.get('/:shipmentId', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;

    const result = await pool.query(
      `SELECT 
        s.id,
        s.sn AS commercial_invoice_number,
        s.customs_clearance_date,
        s.e_fatura_number,
        s.e_fatura_created_at,
        -- Cross-border status
        COALESCE(s.is_cross_border, FALSE) AS is_cross_border,
        CASE WHEN s.is_cross_border = TRUE THEN TRUE ELSE FALSE END AS e_fatura_required,
        -- Supplier info
        supplier.name AS supplier_name,
        -- Buyer info (from view)
        COALESCE(s.buyer_name, s.buyer_company_name) AS buyer_name,
        -- Weight info
        COALESCE(s.net_weight_kg, s.weight_ton * 1000) AS net_weight_kg,
        COALESCE(s.gross_weight_kg, s.weight_ton * 1000) AS gross_weight_kg,
        -- Total value
        s.total_value_usd,
        COALESCE(sf.currency_code, 'USD') AS currency_code,
        -- Package count
        COALESCE(
          s.bags_count,
          (SELECT SUM(COALESCE(sc.package_count, sc.bags_count, 0))::integer 
           FROM logistics.shipment_containers sc 
           WHERE sc.shipment_id = s.id)
        ) AS package_count,
        -- Country of origin (from shipment view, fallback to POL country)
        COALESCE(s.country_of_export, s.pol_country, pol.country) AS country_of_origin,
        -- Port info for internal route
        pod.name AS pod_name,
        -- Internal route (POD → Final Destination)
        COALESCE(
          s.final_destination->>'delivery_place',
          NULLIF(s.final_destination->>'name', ''),
          sp.final_beneficiary_name,
          s.final_beneficiary_name
        ) AS final_destination_place,
        -- Product info
        s.product_text,
        -- Deliveries
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', od.id,
            'delivery_number', od.delivery_number,
            'truck_plate_number', od.truck_plate_number,
            'origin', od.origin,
            'destination', od.destination,
            'route', CONCAT(COALESCE(od.origin, ''), ' → ', od.destination),
            'weight_kg', od.weight_kg,
            'driver_name', od.driver_name,
            'status', od.status
          ) ORDER BY od.delivery_date DESC), '[]'::json)
          FROM logistics.outbound_deliveries od
          WHERE od.shipment_id = s.id AND od.is_deleted = FALSE
        ) AS deliveries,
        -- E-Fatura documents (for download)
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', d.id,
            'filename', d.filename,
            'original_filename', d.original_filename,
            'file_size', d.file_size,
            'upload_ts', d.upload_ts,
            'uploaded_by', uploader.name
          ) ORDER BY d.upload_ts DESC), '[]'::json)
          FROM archive.documents d
          LEFT JOIN security.users uploader ON d.uploaded_by = uploader.id
          WHERE d.shipment_id = s.id 
            AND d.doc_type = 'e_fatura'
            AND d.is_deleted = FALSE
        ) AS e_fatura_documents
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.companies supplier ON s.supplier_id = supplier.id
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN logistics.contracts c ON s.contract_id = c.id
      LEFT JOIN logistics.contract_parties cp ON cp.contract_id = c.id
      LEFT JOIN logistics.contract_shipping cs ON cs.contract_id = c.id
      LEFT JOIN master_data.companies buyer ON cp.buyer_company_id = buyer.id
      LEFT JOIN logistics.shipment_financials sf ON sf.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      WHERE s.id = $1 AND s.is_deleted = FALSE`,
      [shipmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching E-Fatura details:', error);
    res.status(500).json({ error: 'Failed to fetch E-Fatura details' });
  }
});

// ========================================================================
// ==================== BEYANAME ENDPOINTS ====================
// ========================================================================

// ========== GET BEYANAME SUMMARY COUNTS ==========

/**
 * GET /api/e-fatura/beyaname/summary
 * Get counts for beyaname pending and completed
 */
router.get('/beyaname/summary', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    let branchClause = '';
    if (branchFilter.clause !== '1=1') {
      branchClause = ` AND ${branchFilter.clause}`;
    }

    const summaryQuery = `
      SELECT 
        -- Pending: Antrepo shipments without Beyaname
        COUNT(DISTINCT CASE 
          WHEN (sd.beyaname_status IS NULL OR sd.beyaname_status = 'pending')
            AND (sd.beyaname_number IS NULL OR sd.beyaname_number = '')
          THEN s.id 
        END) AS pending_count,
        -- Issued: Beyaname number assigned but not completed
        COUNT(DISTINCT CASE 
          WHEN sd.beyaname_number IS NOT NULL AND sd.beyaname_number != ''
            AND sd.beyaname_status = 'issued'
          THEN s.id 
        END) AS issued_count,
        -- Completed: Beyaname fully processed
        COUNT(DISTINCT CASE 
          WHEN sd.beyaname_status = 'completed'
          THEN s.id 
        END) AS completed_count,
        -- Total Antrepo shipments
        COUNT(DISTINCT s.id) AS total_count
      FROM logistics.shipments s
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN logistics.shipment_documents sd ON sd.shipment_id = s.id
      LEFT JOIN master_data.branches b ON 
        sl.final_destination->>'warehouse_id' IS NOT NULL 
        AND sl.final_destination->>'warehouse_id' != ''
        AND (sl.final_destination->>'warehouse_id')::uuid = b.id
      WHERE s.is_deleted = FALSE
        AND s.transaction_type = 'incoming'
        AND b.is_antrepo = TRUE
        ${branchClause}
    `;

    const result = await pool.query(summaryQuery, branchFilter.params);

    res.json({
      pending: parseInt(result.rows[0].pending_count) || 0,
      issued: parseInt(result.rows[0].issued_count) || 0,
      completed: parseInt(result.rows[0].completed_count) || 0,
      total: parseInt(result.rows[0].total_count) || 0,
    });
  } catch (error) {
    logger.error('Error fetching Beyaname summary:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    res.status(500).json({ 
      error: 'Failed to fetch Beyaname summary',
      details: (error as Error).message,
    });
  }
});

// ========== GET BEYANAME PENDING SHIPMENTS ==========

/**
 * GET /api/e-fatura/beyaname/pending
 * Get incoming shipments destined to Antrepo that need Beyaname
 */
router.get('/beyaname/pending', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const filters = beyanameFiltersSchema.parse(req.query);
    const { page, limit, search, status } = filters;
    const offset = (page - 1) * limit;

    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    // Build where clause for Antrepo shipments
    let whereClause = `
      s.is_deleted = FALSE
      AND s.transaction_type = 'incoming'
      AND b.is_antrepo = TRUE
    `;

    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;

    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      whereClause += ` AND ${branchFilter.clause}`;
    }

    // Status filter
    if (status === 'pending') {
      whereClause += ` AND (sd.beyaname_status IS NULL OR sd.beyaname_status = 'pending') AND (sd.beyaname_number IS NULL OR sd.beyaname_number = '')`;
    } else if (status === 'issued') {
      whereClause += ` AND sd.beyaname_number IS NOT NULL AND sd.beyaname_number != '' AND sd.beyaname_status = 'issued'`;
    } else if (status === 'completed') {
      whereClause += ` AND sd.beyaname_status = 'completed'`;
    }
    // 'all' shows everything

    // Search filter
    if (search) {
      whereClause += ` AND (
        s.sn ILIKE $${paramIndex}
        OR sc.product_text ILIKE $${paramIndex}
        OR sup.name ILIKE $${paramIndex}
        OR sd.beyaname_number ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM logistics.shipments s
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN logistics.shipment_documents sd ON sd.shipment_id = s.id
      LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON sp.supplier_id = sup.id
      LEFT JOIN master_data.branches b ON 
        sl.final_destination->>'warehouse_id' IS NOT NULL 
        AND sl.final_destination->>'warehouse_id' != ''
        AND (sl.final_destination->>'warehouse_id')::uuid = b.id
      WHERE ${whereClause}
    `;

    // Main data query
    const dataQuery = `
      SELECT 
        s.id,
        s.sn AS commercial_invoice_number,
        s.subject,
        s.status,
        s.transaction_type,
        -- Dates
        sl.customs_clearance_date,
        sl.eta,
        sl.etd,
        -- Beyaname fields
        sd.beyaname_number,
        sd.beyaname_date,
        COALESCE(sd.beyaname_status, 'pending') AS beyaname_status,
        sd.beyaname_created_at,
        -- Antrepo info
        b.id AS antrepo_id,
        b.name AS antrepo_name,
        b.name_ar AS antrepo_name_ar,
        sl.final_destination->>'name' AS final_destination_name,
        -- Supplier info
        sp.supplier_id,
        sup.name AS supplier_name,
        -- Cargo info
        sc.product_text,
        sc.weight_ton AS weight_kg,
        sc.weight_ton,
        -- Port info
        pol.name AS pol_name,
        pol.country AS pol_country,
        pod.name AS pod_name,
        pod.country AS pod_country,
        -- Contract info
        s.contract_id,
        c.contract_no,
        -- Financial
        sf.total_value_usd,
        sf.currency_code,
        -- Container count
        (SELECT COUNT(*) FROM logistics.shipment_containers sc2 WHERE sc2.shipment_id = s.id) AS container_count,
        -- Documents attached (to check if beyaname doc uploaded)
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', d.id,
            'file_name', d.filename,
            'document_type', d.doc_type,
            'created_at', d.upload_ts
          )), '[]'::json)
          FROM archive.documents d
          WHERE d.shipment_id = s.id 
            AND d.is_deleted = FALSE
            AND d.doc_type = 'beyaname'
        ) AS beyaname_documents,
        s.created_at,
        s.updated_at
      FROM logistics.shipments s
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN logistics.shipment_documents sd ON sd.shipment_id = s.id
      LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN logistics.shipment_financials sf ON sf.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON sp.supplier_id = sup.id
      LEFT JOIN master_data.branches b ON 
        sl.final_destination->>'warehouse_id' IS NOT NULL 
        AND sl.final_destination->>'warehouse_id' != ''
        AND (sl.final_destination->>'warehouse_id')::uuid = b.id
      LEFT JOIN master_data.ports pol ON sl.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON sl.pod_id = pod.id
      LEFT JOIN logistics.contracts c ON s.contract_id = c.id
      WHERE ${whereClause}
      ORDER BY sl.customs_clearance_date DESC NULLS LAST, s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, params.slice(0, paramIndex - 1)),
      pool.query(dataQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    logger.error('Error fetching Beyaname pending shipments:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    res.status(500).json({ 
      error: 'Failed to fetch Beyaname pending shipments',
      details: (error as Error).message,
    });
  }
});

// ========== SAVE BEYANAME NUMBER ==========

/**
 * PUT /api/e-fatura/beyaname/:shipmentId
 * Save the Beyaname number and date for a shipment
 */
router.put('/beyaname/:shipmentId', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const data = saveBeyanameSchema.parse(req.body);
    const user = (req as any).user;

    // Verify shipment exists and is going to Antrepo
    const shipmentCheck = await pool.query(
      `SELECT s.id, s.transaction_type, sl.final_destination, b.is_antrepo
       FROM logistics.shipments s
       LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
       LEFT JOIN master_data.branches b ON 
         sl.final_destination->>'warehouse_id' IS NOT NULL 
         AND sl.final_destination->>'warehouse_id' != ''
         AND (sl.final_destination->>'warehouse_id')::uuid = b.id
       WHERE s.id = $1 AND s.is_deleted = FALSE`,
      [shipmentId]
    );

    if (shipmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (shipmentCheck.rows[0].transaction_type !== 'incoming') {
      return res.status(400).json({ error: 'Only incoming shipments can have Beyaname' });
    }

    if (!shipmentCheck.rows[0].is_antrepo) {
      return res.status(400).json({ error: 'Shipment is not destined to an Antrepo warehouse' });
    }

    // Update or insert the Beyaname info in shipment_documents
    const result = await pool.query(
      `INSERT INTO logistics.shipment_documents (shipment_id, beyaname_number, beyaname_date, beyaname_status, beyaname_created_at, beyaname_created_by)
       VALUES ($1, $2, $3, 'issued', NOW(), $4)
       ON CONFLICT (shipment_id) 
       DO UPDATE SET 
         beyaname_number = $2,
         beyaname_date = $3,
         beyaname_status = 'issued',
         beyaname_created_at = NOW(),
         beyaname_created_by = $4,
         updated_at = NOW()
       RETURNING id, beyaname_number, beyaname_date, beyaname_status, beyaname_created_at`,
      [shipmentId, data.beyaname_number, data.beyaname_date || null, user?.id]
    );

    res.json({
      success: true,
      message: 'Beyaname number saved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    logger.error('Error saving Beyaname number:', error);
    res.status(500).json({ error: 'Failed to save Beyaname number' });
  }
});

// ========== UPDATE BEYANAME STATUS ==========

/**
 * PATCH /api/e-fatura/beyaname/:shipmentId/status
 * Update the Beyaname status (mark as completed)
 */
router.patch('/beyaname/:shipmentId/status', authorizeRoles(...E_FATURA_ROLES), async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const { status } = req.body;

    if (!['pending', 'issued', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, issued, or completed' });
    }

    const result = await pool.query(
      `UPDATE logistics.shipment_documents 
       SET beyaname_status = $2,
           updated_at = NOW()
       WHERE shipment_id = $1
       RETURNING id, beyaname_number, beyaname_status`,
      [shipmentId, status]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment document record not found' });
    }

    res.json({
      success: true,
      message: `Beyaname status updated to ${status}`,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating Beyaname status:', error);
    res.status(500).json({ error: 'Failed to update Beyaname status' });
  }
});

// ========== CLEAR BEYANAME ==========

/**
 * DELETE /api/e-fatura/beyaname/:shipmentId
 * Clear/remove the Beyaname number for a shipment
 */
router.delete('/beyaname/:shipmentId', authorizeRoles('Admin', 'Exec'), async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;

    const result = await pool.query(
      `UPDATE logistics.shipment_documents 
       SET beyaname_number = NULL,
           beyaname_date = NULL,
           beyaname_status = 'pending',
           beyaname_created_at = NULL,
           beyaname_created_by = NULL,
           updated_at = NOW()
       WHERE shipment_id = $1
       RETURNING id`,
      [shipmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment document record not found' });
    }

    res.json({
      success: true,
      message: 'Beyaname cleared successfully',
    });
  } catch (error) {
    logger.error('Error clearing Beyaname:', error);
    res.status(500).json({ error: 'Failed to clear Beyaname' });
  }
});

export default router;
