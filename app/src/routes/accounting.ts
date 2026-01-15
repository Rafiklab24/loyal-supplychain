/**
 * Accounting Routes
 * Handle:
 *   - Shipment financial aggregation (backend aggregation)
 *   - Documentation (ترحيل) of accounting records
 *   - Invoice management
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import logger from '../utils/logger';
import { z } from 'zod';
import { loadUserBranches, buildShipmentBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';

const router = Router();

// Load user branches for all accounting routes
router.use(loadUserBranches);

// ========== VALIDATION SCHEMAS ==========

const documentRecordSchema = z.object({
  record_type: z.enum(['clearance_cost', 'transport', 'transaction']),
  record_id: z.string().uuid(),
  notes: z.string().optional(),
});

const getDocumentedSchema = z.object({
  record_type: z.enum(['clearance_cost', 'transport', 'transaction']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const shipmentFinancialsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  status: z.string().optional(),
  direction: z.enum(['incoming', 'outgoing']).optional(),
  hasBalance: z.enum(['true', 'false']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['sn', 'total_value_usd', 'remaining_balance', 'eta', 'created_at', 'payment_percentage', 'advance_paid', 'balance_paid', 'clearance_cost', 'internal_transport', 'total_paid']).default('created_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const invoiceSchema = z.object({
  invoice_date: z.string(),
  due_date: z.string().optional(),
  type: z.enum(['purchase', 'sales']),
  language: z.enum(['ar', 'en', 'bilingual']).default('bilingual'),
  seller_name: z.string(),
  seller_name_ar: z.string().optional(),
  seller_address: z.string().optional(),
  buyer_name: z.string(),
  buyer_name_ar: z.string().optional(),
  buyer_address: z.string().optional(),
  subtotal: z.number(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  total_amount: z.number(),
  currency: z.string().default('USD'),
  shipment_id: z.string().uuid().optional(),
  contract_id: z.string().uuid().optional(),
  invoice_data: z.any(), // Full invoice JSON
});

// ========== SHIPMENT FINANCIALS (BACKEND AGGREGATION) ==========

/**
 * GET /api/accounting/shipment-financials
 * Get aggregated financial data for shipments
 * This replaces client-side aggregation for better performance
 */
router.get('/shipment-financials', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const validation = shipmentFinancialsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { page, limit, search, status, direction, hasBalance, dateFrom, dateTo, sortBy, sortDir } = validation.data;
    const offset = (page - 1) * limit;

    // Build branch filter
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    // Build WHERE clause
    const conditions: string[] = ['s.is_deleted = false'];
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      conditions.push(branchFilter.clause);
    }

    if (search) {
      conditions.push(`(
        s.sn ILIKE $${paramIndex} OR 
        s.product_text ILIKE $${paramIndex} OR 
        s.subject ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      conditions.push(`s.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (direction) {
      conditions.push(`s.transaction_type = $${paramIndex}`);
      params.push(direction);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`s.created_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`s.created_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Main aggregation query
    const dataQuery = `
      WITH shipment_transactions AS (
        SELECT 
          t.shipment_id,
          COALESCE(SUM(CASE 
            WHEN t.transaction_type ILIKE '%advance%' 
              OR t.transaction_type ILIKE '%down_payment%'
              OR t.transaction_type ILIKE '%دفعة مقدمة%'
            THEN t.amount_usd ELSE 0
          END), 0) AS advance_paid,
          COALESCE(SUM(CASE 
            WHEN t.transaction_type ILIKE '%balance%' 
              OR t.transaction_type ILIKE '%final%'
              OR t.transaction_type ILIKE '%رصيد%'
            THEN t.amount_usd ELSE 0
          END), 0) AS balance_paid,
          COALESCE(SUM(CASE 
            WHEN t.direction = 'out'
              AND t.transaction_type NOT ILIKE '%advance%' 
              AND t.transaction_type NOT ILIKE '%down_payment%'
              AND t.transaction_type NOT ILIKE '%balance%'
              AND t.transaction_type NOT ILIKE '%final%'
            THEN t.amount_usd ELSE 0
          END), 0) AS other_costs
        FROM finance.transactions t
        WHERE t.is_deleted = false
        GROUP BY t.shipment_id
      ),
      shipment_clearance AS (
        SELECT 
          shipment_id,
          COALESCE(SUM(total_clearing_cost), 0) AS clearance_cost
        FROM finance.customs_clearing_costs
        GROUP BY shipment_id
      ),
      shipment_transport AS (
        SELECT 
          shipment_id,
          COALESCE(SUM(COALESCE(total_cost, transport_cost, 0)), 0) AS transport_cost
        FROM logistics.outbound_deliveries
        GROUP BY shipment_id
      )
      SELECT 
        s.id AS shipment_id,
        s.sn,
        s.product_text,
        s.subject,
        s.transaction_type AS direction,
        s.status,
        s.eta,
        s.customs_clearance_date,
        COALESCE(s.total_value_usd, 0)::numeric AS total_value_usd,
        s.weight_ton,
        s.container_count,
        s.contract_id,
        s.final_destination,
        s.created_at,
        pol.name AS pol_name,
        pod.name AS pod_name,
        COALESCE(st.advance_paid, 0) AS advance_paid,
        COALESCE(st.balance_paid, 0) AS balance_paid,
        COALESCE(sc.clearance_cost, 0) AS clearance_cost,
        COALESCE(stp.transport_cost, 0) AS internal_transport,
        COALESCE(st.other_costs, 0) AS other_costs,
        (COALESCE(st.advance_paid, 0) + COALESCE(st.balance_paid, 0)) AS total_paid,
        GREATEST(0, COALESCE(s.total_value_usd, 0) - COALESCE(st.advance_paid, 0) - COALESCE(st.balance_paid, 0)) AS remaining_balance,
        CASE 
          WHEN COALESCE(s.total_value_usd, 0) > 0 
          THEN ((COALESCE(st.advance_paid, 0) + COALESCE(st.balance_paid, 0)) / s.total_value_usd * 100)
          ELSE 0 
        END AS payment_percentage
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN shipment_transactions st ON st.shipment_id = s.id
      LEFT JOIN shipment_clearance sc ON sc.shipment_id = s.id
      LEFT JOIN shipment_transport stp ON stp.shipment_id = s.id
      WHERE ${whereClause}
      ${hasBalance === 'true' ? 'AND (COALESCE(s.total_value_usd, 0) - COALESCE(st.advance_paid, 0) - COALESCE(st.balance_paid, 0)) > 0' : ''}
      ${hasBalance === 'false' ? 'AND (COALESCE(s.total_value_usd, 0) - COALESCE(st.advance_paid, 0) - COALESCE(st.balance_paid, 0)) <= 0' : ''}
      ORDER BY ${sortBy === 'sn' ? 's.sn' : sortBy === 'total_value_usd' ? 's.total_value_usd' : sortBy === 'eta' ? 's.eta' : sortBy === 'created_at' ? 's.created_at' : sortBy} ${sortDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Count query (without pagination)
    const countQuery = `
      WITH shipment_transactions AS (
        SELECT 
          t.shipment_id,
          COALESCE(SUM(CASE 
            WHEN t.transaction_type ILIKE '%advance%' 
              OR t.transaction_type ILIKE '%down_payment%'
            THEN t.amount_usd ELSE 0
          END), 0) AS advance_paid,
          COALESCE(SUM(CASE 
            WHEN t.transaction_type ILIKE '%balance%' 
              OR t.transaction_type ILIKE '%final%'
            THEN t.amount_usd ELSE 0
          END), 0) AS balance_paid
        FROM finance.transactions t
        WHERE t.is_deleted = false
        GROUP BY t.shipment_id
      )
      SELECT COUNT(*) as total
      FROM logistics.v_shipments_complete s
      LEFT JOIN shipment_transactions st ON st.shipment_id = s.id
      WHERE ${whereClause}
      ${hasBalance === 'true' ? 'AND (COALESCE(s.total_value_usd, 0) - COALESCE(st.advance_paid, 0) - COALESCE(st.balance_paid, 0)) > 0' : ''}
      ${hasBalance === 'false' ? 'AND (COALESCE(s.total_value_usd, 0) - COALESCE(st.advance_paid, 0) - COALESCE(st.balance_paid, 0)) <= 0' : ''}
    `;

    // Summary query
    const summaryQuery = `
      WITH shipment_transactions AS (
        SELECT 
          t.shipment_id,
          COALESCE(SUM(CASE 
            WHEN t.transaction_type ILIKE '%advance%' 
              OR t.transaction_type ILIKE '%down_payment%'
            THEN t.amount_usd ELSE 0
          END), 0) AS advance_paid,
          COALESCE(SUM(CASE 
            WHEN t.transaction_type ILIKE '%balance%' 
              OR t.transaction_type ILIKE '%final%'
            THEN t.amount_usd ELSE 0
          END), 0) AS balance_paid,
          COALESCE(SUM(CASE 
            WHEN t.direction = 'out'
              AND t.transaction_type NOT ILIKE '%advance%' 
              AND t.transaction_type NOT ILIKE '%down_payment%'
              AND t.transaction_type NOT ILIKE '%balance%'
            THEN t.amount_usd ELSE 0
          END), 0) AS other_costs
        FROM finance.transactions t
        WHERE t.is_deleted = false
        GROUP BY t.shipment_id
      ),
      shipment_clearance AS (
        SELECT 
          shipment_id,
          COALESCE(SUM(total_clearing_cost), 0) AS clearance_cost
        FROM finance.customs_clearing_costs
        GROUP BY shipment_id
      ),
      shipment_transport AS (
        SELECT 
          shipment_id,
          COALESCE(SUM(COALESCE(total_cost, transport_cost, 0)), 0) AS transport_cost
        FROM logistics.outbound_deliveries
        GROUP BY shipment_id
      )
      SELECT 
        COUNT(*) as total_shipments,
        COALESCE(SUM(s.total_value_usd), 0) as total_value,
        COALESCE(SUM(st.advance_paid), 0) as total_advance_paid,
        COALESCE(SUM(st.balance_paid), 0) as total_balance_paid,
        COALESCE(SUM(sc.clearance_cost), 0) as total_clearance_costs,
        COALESCE(SUM(stp.transport_cost), 0) as total_internal_transport,
        COALESCE(SUM(st.other_costs), 0) as total_other_costs,
        COALESCE(SUM(st.advance_paid), 0) + COALESCE(SUM(st.balance_paid), 0) as total_paid,
        COALESCE(SUM(s.total_value_usd), 0) - COALESCE(SUM(st.advance_paid), 0) - COALESCE(SUM(st.balance_paid), 0) as total_remaining
      FROM logistics.v_shipments_complete s
      LEFT JOIN shipment_transactions st ON st.shipment_id = s.id
      LEFT JOIN shipment_clearance sc ON sc.shipment_id = s.id
      LEFT JOIN shipment_transport stp ON stp.shipment_id = s.id
      WHERE ${whereClause}
      ${hasBalance === 'true' ? 'AND (COALESCE(s.total_value_usd, 0) - COALESCE(st.advance_paid, 0) - COALESCE(st.balance_paid, 0)) > 0' : ''}
      ${hasBalance === 'false' ? 'AND (COALESCE(s.total_value_usd, 0) - COALESCE(st.advance_paid, 0) - COALESCE(st.balance_paid, 0)) <= 0' : ''}
    `;

    // Execute queries in parallel
    const [dataResult, countResult, summaryResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)), // Exclude LIMIT/OFFSET params
      pool.query(summaryQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const summaryRow = summaryResult.rows[0];

    // Parse final_destination JSON for each row
    const data = dataResult.rows.map(row => {
      let finalOwner = null;
      let finalPlace = null;
      
      if (row.final_destination) {
        try {
          const fd = typeof row.final_destination === 'string' 
            ? JSON.parse(row.final_destination) 
            : row.final_destination;
          finalOwner = fd.name || fd.owner || null;
          finalPlace = fd.delivery_place || fd.place || fd.address || null;
        } catch (e) {
          // Ignore parse errors
        }
      }

      return {
        ...row,
        final_owner: finalOwner,
        final_place: finalPlace,
        total_value_usd: parseFloat(row.total_value_usd) || 0,
        advance_paid: parseFloat(row.advance_paid) || 0,
        balance_paid: parseFloat(row.balance_paid) || 0,
        clearance_cost: parseFloat(row.clearance_cost) || 0,
        internal_transport: parseFloat(row.internal_transport) || 0,
        other_costs: parseFloat(row.other_costs) || 0,
        total_paid: parseFloat(row.total_paid) || 0,
        remaining_balance: parseFloat(row.remaining_balance) || 0,
        payment_percentage: parseFloat(row.payment_percentage) || 0,
      };
    });

    // Calculate average payment percentage
    const avgPaymentPercentage = data.length > 0
      ? data.reduce((sum, d) => sum + d.payment_percentage, 0) / data.length
      : 0;

    res.json({
      data,
      summary: {
        total_shipments: parseInt(summaryRow.total_shipments) || 0,
        total_value: parseFloat(summaryRow.total_value) || 0,
        total_advance_paid: parseFloat(summaryRow.total_advance_paid) || 0,
        total_balance_paid: parseFloat(summaryRow.total_balance_paid) || 0,
        total_clearance_costs: parseFloat(summaryRow.total_clearance_costs) || 0,
        total_internal_transport: parseFloat(summaryRow.total_internal_transport) || 0,
        total_other_costs: parseFloat(summaryRow.total_other_costs) || 0,
        total_paid: parseFloat(summaryRow.total_paid) || 0,
        total_remaining: parseFloat(summaryRow.total_remaining) || 0,
        average_payment_percentage: avgPaymentPercentage,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching shipment financials:', error);
    res.status(500).json({ error: 'Failed to fetch shipment financials' });
  }
});

// ========== INVENTORY TRANSACTIONS (حركة البضاعة) ==========

/**
 * GET /api/accounting/inventory-transactions
 * Get aggregated inventory/goods movement data from shipments
 * Maps to the CSV columns: نوع الفاتورة, اسم الصنف, التعبئة, عدد العبوات, الكمية, etc.
 */
router.get('/inventory-transactions', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const invoiceType = req.query.invoice_type as string; // 'شراء' or 'مبيع'
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    // Build branch filter
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    // Build WHERE clause
    const conditions: string[] = ['s.is_deleted = false'];
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      conditions.push(branchFilter.clause);
    }

    if (search) {
      conditions.push(`(
        s.sn ILIKE $${paramIndex} OR 
        COALESCE(sc.product_text, s.product_text) ILIKE $${paramIndex} OR 
        sup.name ILIKE $${paramIndex} OR
        sp.final_beneficiary_name ILIKE $${paramIndex} OR
        s.notes ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filter by invoice type (transaction_type)
    if (invoiceType === 'شراء' || invoiceType === 'purchase') {
      conditions.push(`s.transaction_type = 'incoming'`);
    } else if (invoiceType === 'مبيع' || invoiceType === 'sale') {
      conditions.push(`s.transaction_type = 'outgoing'`);
    }

    // Date range filter (using ETA as arrival date)
    if (dateFrom) {
      conditions.push(`COALESCE(sl.eta, s.eta) >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`COALESCE(sl.eta, s.eta) <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Main query - Join all relevant tables
    // Note: v_shipments_complete already has all cargo/financial data embedded,
    // but we still join for supplier lookups
    // IMPORTANT: Product line items are the source of truth for quantity, not BOL weight
    const dataQuery = `
      SELECT 
        s.id,
        s.sn,
        CASE s.transaction_type::text 
          WHEN 'incoming' THEN 'شراء' 
          WHEN 'outgoing' THEN 'مبيع'
          ELSE s.transaction_type::text 
        END AS invoice_type,
        s.product_text AS product_name,
        s.lines AS packaging_info,
        -- Product line items are source of truth for package count
        COALESCE(lines_agg.total_packages, s.bags_count, s.container_count) AS package_count,
        -- Product line items are source of truth for quantity (MT)
        COALESCE(lines_agg.total_quantity_mt, s.weight_ton) AS quantity,
        -- Unit from product lines or fallback to shipment level
        COALESCE(lines_agg.quantity_unit, s.weight_unit, 'MT') AS unit,
        -- BOL weight kept as reference for logistics
        s.weight_ton AS bol_weight_mt,
        s.fixed_price_usd_per_ton AS purchase_price,
        s.total_value_usd AS total,
        sup.name AS supplier,
        COALESCE(sl.eta, s.eta) AS arrival_date,
        COALESCE(sp.final_beneficiary_name, s.final_beneficiary_name, s.final_destination->>'name') AS final_owner,
        s.selling_price_usd_per_ton AS sale_price,
        s.notes,
        s.container_count,
        s.status,
        s.created_at,
        pod.name AS pod_name,
        -- Route: POD → Final Destination (delivery_place, or final beneficiary name, or destination name)
        -- Note: Avoid using 'place' field as it may contain origin country
        COALESCE(
          s.final_destination->>'delivery_place',
          NULLIF(s.final_destination->>'name', ''),
          sp.final_beneficiary_name,
          s.final_beneficiary_name,
          s.final_destination->>'address'
        ) AS final_destination_place,
        -- Border crossing info for cross-border shipments
        s.is_cross_border,
        s.primary_border_name,
        s.primary_border_name_ar,
        -- Include line item details for detailed display
        lines_agg.line_items_summary
      FROM logistics.v_shipments_complete s
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON COALESCE(sp.supplier_id, s.supplier_id) = sup.id
      LEFT JOIN master_data.ports pod ON COALESCE(sl.pod_id, s.pod_id) = pod.id
      -- Aggregate quantities from shipment_lines (source of truth for commercial quantity)
      LEFT JOIN LATERAL (
        SELECT 
          SUM(sline.quantity_mt) AS total_quantity_mt,
          SUM(sline.number_of_packages) AS total_packages,
          'MT' AS quantity_unit,
          json_agg(json_build_object(
            'type_of_goods', sline.type_of_goods,
            'quantity_mt', sline.quantity_mt,
            'number_of_packages', sline.number_of_packages,
            'kind_of_packages', sline.kind_of_packages,
            'unit_price', sline.unit_price,
            'amount_usd', sline.amount_usd
          )) AS line_items_summary
        FROM logistics.shipment_lines sline
        WHERE sline.shipment_id = s.id
      ) lines_agg ON true
      WHERE ${whereClause}
      ORDER BY COALESCE(sl.eta, s.eta, s.created_at) DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Count query - simplified since v_shipments_complete has all data
    const countQuery = `
      SELECT COUNT(*) as total
      FROM logistics.v_shipments_complete s
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON COALESCE(sp.supplier_id, s.supplier_id) = sup.id
      WHERE ${whereClause}
    `;

    // Summary query - uses product line items as source of truth for quantity
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE s.transaction_type = 'incoming') as purchase_count,
        COUNT(*) FILTER (WHERE s.transaction_type = 'outgoing') as sale_count,
        COALESCE(SUM(s.total_value_usd), 0) as total_value,
        COALESCE(SUM(CASE WHEN s.transaction_type = 'incoming' THEN s.total_value_usd ELSE 0 END), 0) as total_purchases,
        COALESCE(SUM(CASE WHEN s.transaction_type = 'outgoing' THEN s.total_value_usd ELSE 0 END), 0) as total_sales,
        -- Product line items are source of truth for quantity (fallback to weight_ton)
        COALESCE(SUM(COALESCE(lines_total.total_quantity_mt, s.weight_ton)), 0) as total_quantity,
        -- BOL weight kept as reference
        COALESCE(SUM(s.weight_ton), 0) as total_bol_weight_mt
      FROM logistics.v_shipments_complete s
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON COALESCE(sp.supplier_id, s.supplier_id) = sup.id
      LEFT JOIN LATERAL (
        SELECT SUM(sline.quantity_mt) AS total_quantity_mt
        FROM logistics.shipment_lines sline
        WHERE sline.shipment_id = s.id
      ) lines_total ON true
      WHERE ${whereClause}
    `;

    // Execute queries in parallel
    const [dataResult, countResult, summaryResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
      pool.query(summaryQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const summaryRow = summaryResult.rows[0];

    // Process data to extract packaging info from JSONB
    const data = dataResult.rows.map((row: any, index: number) => {
      let packaging = '';
      let packageCount = row.package_count;

      // Try to extract packaging from lines JSONB
      if (row.packaging_info && Array.isArray(row.packaging_info) && row.packaging_info.length > 0) {
        const firstLine = row.packaging_info[0];
        packaging = firstLine.packaging || firstLine.pack_type || firstLine.unit || '';
        if (!packageCount && firstLine.quantity) {
          packageCount = firstLine.quantity;
        }
      }

        // Get POD and Final Destination separately for frontend to construct route with correct arrow direction
        const podName = row.pod_name || '';
        const finalPlace = row.final_destination_place || '';

        return {
          row_number: (page - 1) * limit + index + 1,
          id: row.id,
          sn: row.sn,
          invoice_type: row.invoice_type,
          product_name: row.product_name || '',
          packaging: packaging,
          package_count: packageCount || row.container_count || 0,
          quantity: parseFloat(row.quantity) || 0,
          unit: row.unit || 'طن',
          purchase_price: parseFloat(row.purchase_price) || 0,
          total: parseFloat(row.total) || 0,
          supplier: row.supplier || '',
          arrival_date: row.arrival_date,
          final_owner: row.final_owner || '',
          sale_price: parseFloat(row.sale_price) || 0,
          notes: row.notes || '',
          status: row.status,
          created_at: row.created_at,
          pod: podName,
          final_destination_place: finalPlace,
          // Border crossing info for cross-border shipments
          is_cross_border: row.is_cross_border || false,
          primary_border_name: row.primary_border_name || null,
          primary_border_name_ar: row.primary_border_name_ar || null,
        };
    });

    res.json({
      data,
      summary: {
        total_records: parseInt(summaryRow.total_records) || 0,
        purchase_count: parseInt(summaryRow.purchase_count) || 0,
        sale_count: parseInt(summaryRow.sale_count) || 0,
        total_value: parseFloat(summaryRow.total_value) || 0,
        total_purchases: parseFloat(summaryRow.total_purchases) || 0,
        total_sales: parseFloat(summaryRow.total_sales) || 0,
        total_quantity: parseFloat(summaryRow.total_quantity) || 0,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching inventory transactions:', error);
    res.status(500).json({ error: 'Failed to fetch inventory transactions' });
  }
});

// ========== CLEARANCE COSTS WITH SQL FILTERING ==========

/**
 * GET /api/accounting/clearance-costs
 * Get clearance costs with proper SQL-level documentation filtering
 */
router.get('/clearance-costs', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const documented = req.query.documented as string;

    // Build branch filter (filter by linked shipment's branch)
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      conditions.push(branchFilter.clause);
    }

    if (search) {
      conditions.push(`(
        c.file_number ILIKE $${paramIndex} OR 
        c.bol_number ILIKE $${paramIndex} OR 
        c.transaction_description ILIKE $${paramIndex} OR
        s.sn ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add documentation filter at SQL level
    let docJoin = '';
    if (documented === 'true') {
      docJoin = `INNER JOIN finance.documented_records dr 
        ON dr.record_type = 'clearance_cost' AND dr.record_id = c.id AND dr.is_active = true`;
    } else if (documented === 'false') {
      docJoin = `LEFT JOIN finance.documented_records dr 
        ON dr.record_type = 'clearance_cost' AND dr.record_id = c.id AND dr.is_active = true`;
      conditions.push('dr.id IS NULL');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main query
    const dataQuery = `
      SELECT 
        c.*,
        s.sn AS shipment_sn,
        s.product_text AS shipment_product,
        s.customs_clearance_date,
        ${documented !== undefined ? 'true' : 'CASE WHEN dr.id IS NOT NULL THEN true ELSE false END'} AS is_documented,
        dr.documented_at,
        dr.documented_by
      FROM finance.customs_clearing_costs c
      LEFT JOIN logistics.v_shipments_complete s ON c.shipment_id = s.id
      ${documented === undefined ? `LEFT JOIN finance.documented_records dr 
        ON dr.record_type = 'clearance_cost' AND dr.record_id = c.id AND dr.is_active = true` : docJoin}
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM finance.customs_clearing_costs c
      LEFT JOIN logistics.v_shipments_complete s ON c.shipment_id = s.id
      ${docJoin}
      ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching clearance costs:', error);
    res.status(500).json({ error: 'Failed to fetch clearance costs' });
  }
});

// ========== TRANSPORT DELIVERIES WITH SQL FILTERING ==========

/**
 * GET /api/accounting/transport-deliveries
 * Get transport deliveries with proper SQL-level documentation filtering
 */
router.get('/transport-deliveries', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const documented = req.query.documented as string;

    // Build branch filter (filter by linked shipment's branch)
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      conditions.push(branchFilter.clause);
    }

    if (search) {
      conditions.push(`(
        d.delivery_number ILIKE $${paramIndex} OR 
        d.driver_name ILIKE $${paramIndex} OR 
        d.truck_plate ILIKE $${paramIndex} OR
        s.sn ILIKE $${paramIndex} OR
        tc.name ILIKE $${paramIndex} OR
        d.transport_company_name ILIKE $${paramIndex} OR
        d.insurance_company ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add documentation filter at SQL level
    let docJoin = '';
    if (documented === 'true') {
      docJoin = `INNER JOIN finance.documented_records dr 
        ON dr.record_type = 'transport' AND dr.record_id = d.id AND dr.is_active = true`;
    } else if (documented === 'false') {
      docJoin = `LEFT JOIN finance.documented_records dr 
        ON dr.record_type = 'transport' AND dr.record_id = d.id AND dr.is_active = true`;
      conditions.push('dr.id IS NULL');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main query
    // If delivery_date is not set, fallback to shipment's customs_clearance_date (they're usually the same)
    const dataQuery = `
      SELECT 
        d.id, d.shipment_id, d.delivery_number, d.driver_name, d.truck_plate_number AS truck_plate,
        d.origin, d.destination, d.transport_cost, d.insurance_cost, d.insurance_company, d.total_cost, d.status, d.created_at,
        COALESCE(d.delivery_date::text, s.customs_clearance_date::text) AS departure_date,
        s.sn AS shipment_sn,
        COALESCE(tc.name, d.transport_company_name) AS transport_company,
        ${documented !== undefined ? 'true' : 'CASE WHEN dr.id IS NOT NULL THEN true ELSE false END'} AS is_documented,
        dr.documented_at,
        dr.documented_by
      FROM logistics.outbound_deliveries d
      LEFT JOIN logistics.v_shipments_complete s ON d.shipment_id = s.id
      LEFT JOIN master_data.transport_companies tc ON d.transport_company_id = tc.id
      ${documented === undefined ? `LEFT JOIN finance.documented_records dr 
        ON dr.record_type = 'transport' AND dr.record_id = d.id AND dr.is_active = true` : docJoin}
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM logistics.outbound_deliveries d
      LEFT JOIN logistics.v_shipments_complete s ON d.shipment_id = s.id
      LEFT JOIN master_data.transport_companies tc ON d.transport_company_id = tc.id
      ${docJoin}
      ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching transport deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch transport deliveries' });
  }
});

// ========== TRANSACTIONS WITH SQL FILTERING ==========

/**
 * GET /api/accounting/transactions
 * Get transactions with proper SQL-level documentation filtering
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const documented = req.query.documented as string;
    const shipment_id = req.query.shipment_id as string;

    // Build branch filter (filter by linked shipment's branch)
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    // Build WHERE clause
    const conditions: string[] = ['t.is_deleted = false'];
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      conditions.push(branchFilter.clause);
    }

    if (search) {
      conditions.push(`(
        t.reference_number ILIKE $${paramIndex} OR 
        t.description ILIKE $${paramIndex} OR 
        t.party_name ILIKE $${paramIndex} OR
        s.sn ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (shipment_id) {
      conditions.push(`t.shipment_id = $${paramIndex}`);
      params.push(shipment_id);
      paramIndex++;
    }

    // Add documentation filter at SQL level
    let docJoin = '';
    if (documented === 'true') {
      docJoin = `INNER JOIN finance.documented_records dr 
        ON dr.record_type = 'transaction' AND dr.record_id = t.id AND dr.is_active = true`;
    } else if (documented === 'false') {
      docJoin = `LEFT JOIN finance.documented_records dr 
        ON dr.record_type = 'transaction' AND dr.record_id = t.id AND dr.is_active = true`;
      conditions.push('dr.id IS NULL');
    }

    const whereClause = conditions.join(' AND ');

    // Main query
    const dataQuery = `
      SELECT 
        t.*,
        s.sn AS shipment_sn,
        ${documented !== undefined ? 'true' : 'CASE WHEN dr.id IS NOT NULL THEN true ELSE false END'} AS is_documented,
        dr.documented_at,
        dr.documented_by
      FROM finance.transactions t
      LEFT JOIN logistics.v_shipments_complete s ON t.shipment_id = s.id
      ${documented === undefined ? `LEFT JOIN finance.documented_records dr 
        ON dr.record_type = 'transaction' AND dr.record_id = t.id AND dr.is_active = true` : docJoin}
      WHERE ${whereClause}
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM finance.transactions t
      LEFT JOIN logistics.v_shipments_complete s ON t.shipment_id = s.id
      ${docJoin}
      WHERE ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ========== DOCUMENTATION (ترحيل) ENDPOINTS ==========

/**
 * POST /api/accounting/document
 * Mark a record as documented (ترحيل)
 */
router.post('/document', async (req: Request, res: Response) => {
  try {
    const validation = documentRecordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { record_type, record_id, notes } = validation.data;
    const documented_by = (req as any).user?.username || 'unknown';

    // Verify the record exists in its source table
    const tableMap: Record<string, { schema: string; table: string }> = {
      'clearance_cost': { schema: 'finance', table: 'customs_clearing_costs' },
      'transport': { schema: 'logistics', table: 'outbound_deliveries' },
      'transaction': { schema: 'finance', table: 'transactions' },
    };

    const sourceTable = tableMap[record_type];
    if (!sourceTable) {
      return res.status(400).json({ error: 'Invalid record type' });
    }

    // Check if record exists
    const existsResult = await pool.query(
      `SELECT id FROM ${sourceTable.schema}.${sourceTable.table} WHERE id = $1`,
      [record_id]
    );

    if (existsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found in source table' });
    }

    // Insert or update documented record (reactivate if previously undocumented)
    const result = await pool.query(
      `INSERT INTO finance.documented_records (record_type, record_id, documented_by, notes, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (record_type, record_id) 
       DO UPDATE SET 
         documented_at = NOW(), 
         documented_by = $3, 
         notes = $4,
         is_active = true,
         undocumented_at = NULL,
         undocumented_by = NULL
       RETURNING *`,
      [record_type, record_id, documented_by, notes || null]
    );

    logger.info(`[Accounting] Record documented: ${record_type}/${record_id} by ${documented_by}`);

    res.json({
      success: true,
      message: 'Record documented successfully',
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error documenting record:', error);
    res.status(500).json({ error: 'Failed to document record' });
  }
});

/**
 * POST /api/accounting/undocument
 * Remove documentation status from a record (إلغاء الترحيل)
 * Now uses soft delete for audit trail
 */
router.post('/undocument', async (req: Request, res: Response) => {
  try {
    const validation = documentRecordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { record_type, record_id } = validation.data;
    const undocumented_by = (req as any).user?.username || 'unknown';

    // Soft delete - mark as inactive instead of deleting
    const result = await pool.query(
      `UPDATE finance.documented_records 
       SET is_active = false, undocumented_at = NOW(), undocumented_by = $3
       WHERE record_type = $1 AND record_id = $2 AND is_active = true
       RETURNING *`,
      [record_type, record_id, undocumented_by]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documented record not found' });
    }

    logger.info(`[Accounting] Record undocumented: ${record_type}/${record_id} by ${undocumented_by}`);

    res.json({
      success: true,
      message: 'Record undocumented successfully',
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error undocumenting record:', error);
    res.status(500).json({ error: 'Failed to undocument record' });
  }
});

/**
 * GET /api/accounting/documented
 * Get list of documented records
 */
router.get('/documented', async (req: Request, res: Response) => {
  try {
    const validation = getDocumentedSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { record_type, page, limit } = validation.data;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE is_active = true';
    const params: any[] = [];
    let paramIndex = 1;

    if (record_type) {
      whereClause += ` AND record_type = $${paramIndex}`;
      params.push(record_type);
      paramIndex++;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM finance.documented_records ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated data
    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT * FROM finance.documented_records 
       ${whereClause}
       ORDER BY documented_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching documented records:', error);
    res.status(500).json({ error: 'Failed to fetch documented records' });
  }
});

/**
 * GET /api/accounting/documented/ids
 * Get list of documented record IDs (for filtering)
 */
router.get('/documented/ids', async (req: Request, res: Response) => {
  try {
    const record_type = req.query.record_type as string;
    
    if (!record_type || !['clearance_cost', 'transport', 'transaction'].includes(record_type)) {
      return res.status(400).json({ error: 'Invalid or missing record_type' });
    }

    const result = await pool.query(
      `SELECT record_id FROM finance.documented_records WHERE record_type = $1 AND is_active = true`,
      [record_type]
    );

    res.json({
      record_type,
      documented_ids: result.rows.map((r: { record_id: string }) => r.record_id),
    });
  } catch (error) {
    logger.error('Error fetching documented IDs:', error);
    res.status(500).json({ error: 'Failed to fetch documented IDs' });
  }
});

/**
 * GET /api/accounting/is-documented/:recordType/:recordId
 * Check if a specific record is documented
 */
router.get('/is-documented/:recordType/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordType, recordId } = req.params;

    if (!['clearance_cost', 'transport', 'transaction'].includes(recordType)) {
      return res.status(400).json({ error: 'Invalid record type' });
    }

    const result = await pool.query(
      `SELECT * FROM finance.documented_records 
       WHERE record_type = $1 AND record_id = $2 AND is_active = true`,
      [recordType, recordId]
    );

    res.json({
      is_documented: result.rows.length > 0,
      data: result.rows[0] || null,
    });
  } catch (error) {
    logger.error('Error checking documented status:', error);
    res.status(500).json({ error: 'Failed to check documented status' });
  }
});

// ========== INVOICE ENDPOINTS ==========

/**
 * POST /api/accounting/invoices
 * Create and save a new invoice
 */
router.post('/invoices', async (req: Request, res: Response) => {
  try {
    const validation = invoiceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const data = validation.data;
    const created_by = (req as any).user?.username || 'unknown';

    // Generate unique invoice number using sequence
    const seqResult = await pool.query("SELECT nextval('finance.invoice_number_seq')");
    const seq = seqResult.rows[0].nextval;
    const year = new Date().getFullYear();
    const prefix = data.type === 'purchase' ? 'PI' : 'SI';
    const invoiceNumber = `${prefix}-${year}-${String(seq).padStart(5, '0')}`;

    const result = await pool.query(
      `INSERT INTO finance.invoices (
        invoice_number, invoice_date, due_date, type, language,
        seller_name, seller_name_ar, seller_address,
        buyer_name, buyer_name_ar, buyer_address,
        subtotal, discount, tax, total_amount, currency,
        shipment_id, contract_id, invoice_data, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        invoiceNumber,
        data.invoice_date,
        data.due_date || null,
        data.type,
        data.language,
        data.seller_name,
        data.seller_name_ar || null,
        data.seller_address || null,
        data.buyer_name,
        data.buyer_name_ar || null,
        data.buyer_address || null,
        data.subtotal,
        data.discount || 0,
        data.tax || 0,
        data.total_amount,
        data.currency,
        data.shipment_id || null,
        data.contract_id || null,
        JSON.stringify(data.invoice_data),
        created_by,
      ]
    );

    logger.info(`[Accounting] Invoice created: ${invoiceNumber} by ${created_by}`);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

/**
 * GET /api/accounting/invoices
 * List invoices with filters
 */
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const { type, status, shipment_id, contract_id, dateFrom, dateTo, search } = req.query;

    const conditions: string[] = ['is_deleted = false'];
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (shipment_id) {
      conditions.push(`shipment_id = $${paramIndex}`);
      params.push(shipment_id);
      paramIndex++;
    }

    if (contract_id) {
      conditions.push(`contract_id = $${paramIndex}`);
      params.push(contract_id);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`invoice_date >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`invoice_date <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        invoice_number ILIKE $${paramIndex} OR
        seller_name ILIKE $${paramIndex} OR
        buyer_name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM finance.invoices WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query
    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT * FROM finance.invoices 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/accounting/invoices/:id
 * Get single invoice by ID
 */
router.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM finance.invoices WHERE id = $1 AND is_deleted = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * PUT /api/accounting/invoices/:id/status
 * Update invoice status
 */
router.put('/invoices/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, cancelled_reason } = req.body;

    if (!['draft', 'sent', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    let updateFields = 'status = $2, updated_at = NOW()';
    const params: any[] = [id, status];
    let paramIndex = 3;

    if (status === 'sent') {
      updateFields += `, sent_at = NOW()`;
    } else if (status === 'paid') {
      updateFields += `, paid_at = NOW()`;
    } else if (status === 'cancelled') {
      updateFields += `, cancelled_at = NOW(), cancelled_reason = $${paramIndex}`;
      params.push(cancelled_reason || null);
    }

    const result = await pool.query(
      `UPDATE finance.invoices SET ${updateFields}
       WHERE id = $1 AND is_deleted = false
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      success: true,
      message: `Invoice status updated to ${status}`,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

/**
 * DELETE /api/accounting/invoices/:id
 * Soft delete an invoice
 */
router.delete('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE finance.invoices SET is_deleted = true, updated_at = NOW()
       WHERE id = $1 AND is_deleted = false
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;
