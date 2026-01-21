/**
 * Contracts API Routes
 * Handles CRUD operations for contracts and contract lines
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { pool } from '../db/client';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  ContractCreateSchema,
  ContractUpdateSchema,
  ContractQuerySchema,
  PaymentScheduleSchema,
} from '../validators/contract';
import { notificationService } from '../services/notificationService';
import { requireRead, requireWrite } from '../middleware/auth';
import { loadUserBranches, buildContractBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';
import { findBestMatches, normalizeCompanyName } from '../utils/stringMatch';
import logger from '../utils/logger';
import { withTransaction } from '../utils/transactions';
import { withTimeout } from '../middleware/timeout';

const router = Router();

// Apply branch loading middleware to all routes
router.use(loadUserBranches);

// Configure multer for file uploads with proper file extensions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads/temp');
  },
  filename: (req, file, cb) => {
    // Preserve the file extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage, // Use custom storage instead of dest
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    logger.info('📎 Uploaded file mimetype:', file.mimetype);
    logger.info('📎 Uploaded file name:', file.originalname);
    
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp', // Add webp support
    ];
    
    // Also check file extension as fallback
    const fileExt = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt || '')) {
      cb(null, true);
    } else {
      logger.info('❌ Rejected file type:', file.mimetype);
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, JPG, PNG, and WEBP allowed.`));
    }
  },
});

// ========== GET /api/contracts - List contracts ==========

router.get('/', validateQuery(ContractQuerySchema), async (req, res, next) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const {
      page,
      limit,
      contract_no,
      buyer_company_id,
      seller_company_id,
      status,
      currency_code,
      product,
      search,
      sortBy,
      sortDir,
    } = req.query as any;

    // Build branch filter for contracts
    const branchFilter = buildContractBranchFilter(branchReq, 'c');

    // Build query
    let query = `
      SELECT 
        c.*,
        b.name as buyer_name,
        seller.name as seller_name,
        cs.estimated_shipment_date,
        (SELECT COUNT(*) FROM logistics.contract_lines WHERE contract_id = c.id) as line_count,
        (SELECT COUNT(*) FROM logistics.shipments WHERE contract_id = c.id AND is_deleted = false) as shipment_count,
        (SELECT json_agg(shipment_data)
         FROM (
           SELECT json_build_object('id', sh.id, 'sn', sh.sn, 'status', sh.status, 'eta', sh.eta) as shipment_data
           FROM logistics.v_shipments_complete sh 
           WHERE sh.contract_id = c.id AND sh.is_deleted = false
           ORDER BY sh.eta DESC NULLS LAST
           LIMIT 5
         ) subq
        ) as linked_shipments,
        -- Aggregated product info
        (SELECT STRING_AGG(DISTINCT COALESCE(cl.type_of_goods, cl.product_name), ', ') 
         FROM logistics.contract_lines cl WHERE cl.contract_id = c.id) as products_summary,
        (SELECT SUM(COALESCE(cl.quantity_mt, 0)) 
         FROM logistics.contract_lines cl WHERE cl.contract_id = c.id) as total_quantity_mt,
        (SELECT SUM(COALESCE(cl.amount_usd, 0)) 
         FROM logistics.contract_lines cl WHERE cl.contract_id = c.id) as total_amount_usd,
        -- Fulfillment tracking data
        fulfillment.total_shipped_mt,
        fulfillment.fulfillment_percentage
      FROM logistics.contracts c
      LEFT JOIN LATERAL (
        SELECT 
          COALESCE(SUM(shipped.shipped_mt), 0) as total_shipped_mt,
          CASE 
            WHEN COALESCE(SUM(cl2.quantity_mt), 0) = 0 THEN 0
            ELSE ROUND((COALESCE(SUM(shipped.shipped_mt), 0) / SUM(cl2.quantity_mt) * 100)::numeric, 1)
          END as fulfillment_percentage
        FROM logistics.contract_lines cl2
        LEFT JOIN LATERAL (
          SELECT SUM(COALESCE(sl.quantity_mt, sl.qty, 0)) as shipped_mt
          FROM logistics.shipment_lines sl
          JOIN logistics.shipments s ON sl.shipment_id = s.id AND s.is_deleted = false
          WHERE sl.contract_line_id = cl2.id
        ) shipped ON true
        WHERE cl2.contract_id = c.id
      ) fulfillment ON true
      LEFT JOIN master_data.companies b ON c.buyer_company_id = b.id
      LEFT JOIN master_data.companies seller ON c.seller_company_id = seller.id
      LEFT JOIN logistics.contract_shipping cs ON cs.contract_id = c.id
      WHERE c.is_deleted = false
    `;
    const params: any[] = [...branchFilter.params];
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      query += ` AND ${branchFilter.clause}`;
    }

    // Apply filters
    if (contract_no) {
      const normalized = (contract_no as string).replace(/[-_\s]/g, '').toLowerCase();
      params.push(`%${normalized}%`);
      const normalizedParam = params.length;
      params.push(`%${contract_no}%`);
      const originalParam = params.length;
      query += ` AND (REPLACE(REPLACE(REPLACE(LOWER(c.contract_no), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR c.contract_no ILIKE $${originalParam})`;
    }

    if (buyer_company_id) {
      params.push(buyer_company_id);
      query += ` AND c.buyer_company_id = $${params.length}`;
    }

    if (seller_company_id) {
      params.push(seller_company_id);
      query += ` AND c.seller_company_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }

    if (currency_code) {
      params.push(currency_code);
      query += ` AND c.currency_code = $${params.length}`;
    }

    if (product) {
      params.push(`%${product}%`);
      query += ` AND EXISTS (
        SELECT 1 FROM logistics.contract_lines cl 
        WHERE cl.contract_id = c.id 
        AND (cl.type_of_goods ILIKE $${params.length} OR cl.product_name ILIKE $${params.length})
      )`;
    }

    if (search) {
      const normalized = (search as string).replace(/[-_\s]/g, '').toLowerCase();
      params.push(`%${normalized}%`);
      const normalizedParam = params.length;
      params.push(`%${search}%`);
      const originalParam = params.length;
      query += ` AND (
        REPLACE(REPLACE(REPLACE(LOWER(c.contract_no), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(c.notes), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        c.contract_no ILIKE $${originalParam} OR
        c.notes ILIKE $${originalParam}
      )`;
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Apply sorting
    query += ` ORDER BY c.${sortBy} ${sortDir}`;

    // Apply pagination
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    // Execute query
    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/contracts/update-requests/pending - List Pending Approval Requests ==========
// NOTE: Must come BEFORE /:id routes to avoid route conflicts
router.get('/update-requests/pending', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
        cur.*,
        c.contract_no,
        s.sn as shipment_sn,
        b.name as buyer_name,
        sel.name as seller_name
      FROM logistics.contract_update_requests cur
      JOIN logistics.contracts c ON c.id = cur.contract_id
      JOIN logistics.v_shipments_complete s ON s.id = cur.shipment_id
      LEFT JOIN master_data.companies b ON c.buyer_company_id = b.id
      LEFT JOIN master_data.companies sel ON c.seller_company_id = sel.id
      WHERE cur.status = 'pending'
      ORDER BY cur.created_at DESC`
    );
    
    res.json({
      total: result.rows.length,
      requests: result.rows,
    });
    
  } catch (error) {
    logger.error('Error fetching pending update requests:', error);
    next(error);
  }
});

// ========== DELETE /api/contracts/:id - Soft delete contract ==========
// NOTE: Must come BEFORE GET /:id to avoid route conflicts

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE logistics.contracts
      SET is_deleted = true, updated_at = NOW(), updated_by = $2
      WHERE id = $1 AND is_deleted = false
      RETURNING id, contract_no
      `,
      [id, 'api'] // TODO: Replace with actual user from auth
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json({
      success: true,
      message: 'Contract deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ========== PATCH /api/contracts/:id - Partial update contract ==========
// NOTE: Must come BEFORE GET /:id to avoid route conflicts

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Build dynamic UPDATE query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Fields that are direct columns on contracts table
    const directFields = [
      'contract_no',
      'buyer_company_id',
      'seller_company_id',
      'signed_at',
      'valid_from',
      'valid_to',
      'status',
      'notes',
    ];

    // Fields that should be stored in extra_json
    const extraJsonFields = ['incoterm_code', 'currency_code'];
    
    // Build extra_json updates if any extra_json fields are provided
    let extraJsonUpdate: any = updateData.extra_json || {};
    for (const field of extraJsonFields) {
      if (updateData[field] !== undefined) {
        extraJsonUpdate[field] = updateData[field];
      }
    }

    for (const field of directFields) {
      if (updateData[field] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(updateData[field]);
        paramIndex++;
      }
    }
    
    // If there are extra_json updates, merge them with existing extra_json
    if (Object.keys(extraJsonUpdate).length > 0 || updateData.extra_json !== undefined) {
      fields.push(`extra_json = COALESCE(extra_json, '{}'::jsonb) || $${paramIndex}::jsonb`);
      values.push(JSON.stringify(extraJsonUpdate));
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add updated_at and updated_by
    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${paramIndex}`);
    values.push('api'); // TODO: Replace with actual user from auth
    paramIndex++;

    // Add WHERE clause
    values.push(id);

    const query = `
      UPDATE logistics.contracts
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND is_deleted = false
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/contracts/:id - Get single contract ==========
// NORMALIZED: Returns structured data from v_contracts_complete view + nested objects for frontend

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get contract from complete view with company names
    const contractResult = await pool.query(
      `SELECT vc.*, 
        b.name as buyer_name,
        b.country as buyer_country,
        s.name as seller_name,
        s.country as seller_country,
        exp.name as exporter_name,
        con.name as consignee_name,
        pol.name as port_of_loading_name,
        fd.name as final_destination_name_port
      FROM logistics.v_contracts_complete vc
      LEFT JOIN master_data.companies b ON vc.buyer_company_id = b.id
      LEFT JOIN master_data.companies s ON vc.seller_company_id = s.id
      LEFT JOIN master_data.companies exp ON vc.exporter_company_id = exp.id
      LEFT JOIN master_data.companies con ON vc.consignee_company_id = con.id
      LEFT JOIN master_data.ports pol ON vc.port_of_loading_id = pol.id
      LEFT JOIN master_data.ports fd ON vc.final_destination_id = fd.id
      WHERE vc.id = $1 AND vc.is_deleted = false`,
      [id]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contractData = contractResult.rows[0];

    // Get contract lines with fulfillment data (shipped quantities from linked shipment_lines)
    const linesResult = await pool.query(
      `SELECT 
        cl.*, 
        p.name as product_name, 
        p.hs_code, 
        p.category,
        -- Fulfillment tracking: sum quantities from non-deleted shipment lines
        COALESCE(fulfillment.shipped_quantity_mt, 0) as shipped_quantity_mt,
        COALESCE(cl.quantity_mt, 0) - COALESCE(fulfillment.shipped_quantity_mt, 0) as pending_quantity_mt,
        CASE 
          WHEN COALESCE(cl.quantity_mt, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(fulfillment.shipped_quantity_mt, 0) / cl.quantity_mt * 100)::numeric, 2)
        END as fulfillment_percentage,
        fulfillment.shipment_count,
        fulfillment.linked_shipment_ids
      FROM logistics.contract_lines cl
      LEFT JOIN master_data.products p ON cl.product_id = p.id
      LEFT JOIN LATERAL (
        SELECT 
          SUM(COALESCE(sl.quantity_mt, sl.qty, 0)) as shipped_quantity_mt,
          COUNT(DISTINCT sl.shipment_id) as shipment_count,
          ARRAY_AGG(DISTINCT sl.shipment_id) FILTER (WHERE sl.shipment_id IS NOT NULL) as linked_shipment_ids
        FROM logistics.shipment_lines sl
        JOIN logistics.shipments s ON sl.shipment_id = s.id AND s.is_deleted = false
        WHERE sl.contract_line_id = cl.id
      ) fulfillment ON true
      WHERE cl.contract_id = $1
      ORDER BY cl.created_at`,
      [id]
    );

    // Get payment schedules
    const schedulesResult = await pool.query(
      `SELECT * FROM finance.payment_schedules WHERE contract_id = $1 ORDER BY seq`,
      [id]
    );

    // Get linked shipments
    const shipmentsResult = await pool.query(
      `SELECT s.id, s.sn, s.product_text, s.subject, s.status, s.eta,
        s.weight_ton, s.container_count,
        pol.name as origin_port, pod.name as destination_port, s.created_at
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      WHERE s.contract_id = $1 AND s.is_deleted = false
      ORDER BY s.eta DESC NULLS LAST, s.created_at DESC`,
      [id]
    );

    // Structure the response with nested objects for frontend wizard compatibility
    const result = {
      // Core contract fields
      id: contractData.id,
      contract_no: contractData.contract_no,
      status: contractData.status,
      direction: contractData.direction,
      subject: contractData.subject,
      notes: contractData.notes,
      buyer_company_id: contractData.buyer_company_id,
      seller_company_id: contractData.seller_company_id,
      buyer_name: contractData.buyer_name,
      buyer_country: contractData.buyer_country,
      seller_name: contractData.seller_name,
      seller_country: contractData.seller_country,
      signed_at: contractData.signed_at,
      valid_from: contractData.valid_from,
      valid_to: contractData.valid_to,
      created_at: contractData.created_at,
      updated_at: contractData.updated_at,
      
      // Lines and related data
      lines: linesResult.rows,
      payment_schedules: schedulesResult.rows,
      linked_shipments: shipmentsResult.rows,
      
      // STRUCTURED NESTED OBJECTS for frontend wizard
      commercial_parties: {
        proforma_number: contractData.proforma_number,
        invoice_date: contractData.invoice_date,
        other_reference: contractData.other_reference,
        exporter_company_id: contractData.exporter_company_id,
        exporter_name: contractData.exporter_name,
        buyer_company_id: contractData.buyer_company_id,
        buyer_name: contractData.buyer_name,
        consignee_same_as_buyer: contractData.consignee_same_as_buyer,
        consignee_company_id: contractData.consignee_company_id,
        consignee_name: contractData.consignee_name,
        has_broker: contractData.has_broker,
        broker_buying_name: contractData.broker_buying_name,
        broker_selling_name: contractData.broker_selling_name,
      },
      shipping: {
        country_of_export: contractData.country_of_export,
        country_of_final_destination: contractData.country_of_final_destination,
        port_of_loading_id: contractData.port_of_loading_id,
        port_of_loading_name: contractData.port_of_loading_name,
        final_destination_id: contractData.final_destination_id,
        final_destination_name: contractData.final_destination_name_port,
        pre_carriage_by: contractData.pre_carriage_by,
        place_of_receipt: contractData.place_of_receipt,
        vessel_flight_no: contractData.vessel_flight_no,
        estimated_shipment_date: contractData.estimated_shipment_date,
      },
      terms: {
        cargo_type: contractData.cargo_type,
        tanker_type: contractData.tanker_type,
        barrels: contractData.barrels,
        weight_ton: contractData.weight_ton,
        weight_unit: contractData.weight_unit,
        weight_unit_custom: contractData.weight_unit_custom,
        container_count: contractData.container_count,
        incoterm: contractData.incoterm,
        delivery_terms_detail: contractData.delivery_terms_detail,
        payment_terms: contractData.payment_terms,
        payment_method: contractData.payment_method,
        currency_code: contractData.currency_code,
        usd_equivalent_rate: contractData.usd_equivalent_rate,
        special_clauses: contractData.special_clauses,
      },
      banking_docs: {
        beneficiary_name: contractData.beneficiary_name,
        beneficiary_address: contractData.beneficiary_address,
        beneficiary_account_no: contractData.beneficiary_account_no,
        beneficiary_bank_name: contractData.beneficiary_bank_name,
        beneficiary_bank_address: contractData.beneficiary_bank_address,
        beneficiary_swift_code: contractData.beneficiary_swift_code,
        correspondent_bank: contractData.correspondent_bank,
        has_final_destination: contractData.has_final_destination,
        final_destination_type: contractData.final_destination_type,
        final_destination_company_id: contractData.final_destination_company_id,
        final_destination_name: contractData.final_destination_name,
        final_destination_delivery_place: contractData.final_destination_delivery_place,
        final_destination_address: contractData.final_destination_address,
        final_destination_contact: contractData.final_destination_contact,
        final_destination_selling_price: contractData.final_destination_selling_price,
        final_destination_notes: contractData.final_destination_notes,
        documentation: contractData.documentation,
        documentation_responsibility: contractData.documentation_responsibility,
        documentation_notes: contractData.documentation_notes,
      },
      
      // Fulfillment summary - calculated from lines
      fulfillment: (() => {
        const lines = linesResult.rows;
        const totalContractedMt = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.quantity_mt) || 0), 0);
        const totalShippedMt = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.shipped_quantity_mt) || 0), 0);
        const totalPendingMt = totalContractedMt - totalShippedMt;
        const overallPercentage = totalContractedMt > 0 ? Math.round((totalShippedMt / totalContractedMt) * 100 * 100) / 100 : 0;
        const isFullyShipped = totalPendingMt <= 0 && totalContractedMt > 0;
        const uniqueShipmentIds = [...new Set(lines.flatMap((l: any) => l.linked_shipment_ids || []))];
        
        return {
          total_contracted_mt: totalContractedMt,
          total_shipped_mt: totalShippedMt,
          total_pending_mt: totalPendingMt,
          overall_percentage: overallPercentage,
          is_fully_shipped: isFullyShipped,
          shipment_count: uniqueShipmentIds.length,
        };
      })(),
      
      // Keep extra_json for backward compatibility
      extra_json: contractData.extra_json || {},
    };

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/contracts/:id/fulfillment-status - Get detailed fulfillment status ==========
router.get('/:id/fulfillment-status', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get contract basic info
    const contractResult = await pool.query(
      `SELECT c.id, c.contract_no, c.status, c.direction
       FROM logistics.contracts c
       WHERE c.id = $1 AND c.is_deleted = false`,
      [id]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contractResult.rows[0];

    // Get fulfillment data per line
    const linesResult = await pool.query(
      `SELECT 
        cl.id,
        cl.type_of_goods,
        cl.product_name,
        cl.brand,
        COALESCE(cl.quantity_mt, 0) as contracted_quantity_mt,
        COALESCE(fulfillment.shipped_quantity_mt, 0) as shipped_quantity_mt,
        COALESCE(cl.quantity_mt, 0) - COALESCE(fulfillment.shipped_quantity_mt, 0) as pending_quantity_mt,
        CASE 
          WHEN COALESCE(cl.quantity_mt, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(fulfillment.shipped_quantity_mt, 0) / cl.quantity_mt * 100)::numeric, 2)
        END as fulfillment_percentage,
        COALESCE(fulfillment.shipment_count, 0) as shipment_count,
        COALESCE(fulfillment.shipments, '[]'::json) as shipments
      FROM logistics.contract_lines cl
      LEFT JOIN LATERAL (
        SELECT 
          SUM(COALESCE(sl.quantity_mt, sl.qty, 0)) as shipped_quantity_mt,
          COUNT(DISTINCT sl.shipment_id) as shipment_count,
          json_agg(DISTINCT jsonb_build_object(
            'shipment_id', s.id,
            'sn', s.sn,
            'quantity_mt', COALESCE(sl.quantity_mt, sl.qty, 0),
            'status', s.status,
            'eta', s.eta,
            'created_at', s.created_at
          )) FILTER (WHERE s.id IS NOT NULL) as shipments
        FROM logistics.shipment_lines sl
        JOIN logistics.v_shipments_complete s ON sl.shipment_id = s.id AND s.is_deleted = false
        WHERE sl.contract_line_id = cl.id
      ) fulfillment ON true
      WHERE cl.contract_id = $1
      ORDER BY cl.created_at`,
      [id]
    );

    // Calculate overall summary
    const lines = linesResult.rows;
    const totalContractedMt = lines.reduce((sum: number, l: any) => sum + parseFloat(l.contracted_quantity_mt || 0), 0);
    const totalShippedMt = lines.reduce((sum: number, l: any) => sum + parseFloat(l.shipped_quantity_mt || 0), 0);
    const totalPendingMt = totalContractedMt - totalShippedMt;
    const overallPercentage = totalContractedMt > 0 ? Math.round((totalShippedMt / totalContractedMt) * 100 * 100) / 100 : 0;
    const isFullyShipped = totalPendingMt <= 0 && totalContractedMt > 0;

    // Get all linked shipments with their total quantities
    const shipmentsResult = await pool.query(
      `SELECT 
        s.id,
        s.sn,
        s.status,
        s.eta,
        s.created_at,
        COALESCE(SUM(COALESCE(sl.quantity_mt, sl.qty, 0)), 0) as total_quantity_mt
       FROM logistics.v_shipments_complete s
       LEFT JOIN logistics.shipment_lines sl ON sl.shipment_id = s.id
       WHERE s.contract_id = $1 AND s.is_deleted = false
       GROUP BY s.id, s.sn, s.status, s.eta, s.created_at
       ORDER BY s.created_at DESC`,
      [id]
    );

    res.json({
      contract_id: contract.id,
      contract_no: contract.contract_no,
      contract_status: contract.status,
      summary: {
        total_contracted_mt: totalContractedMt,
        total_shipped_mt: totalShippedMt,
        total_pending_mt: totalPendingMt,
        overall_percentage: overallPercentage,
        is_fully_shipped: isFullyShipped,
        shipment_count: shipmentsResult.rows.length,
      },
      lines: lines.map((l: any) => ({
        ...l,
        contracted_quantity_mt: parseFloat(l.contracted_quantity_mt),
        shipped_quantity_mt: parseFloat(l.shipped_quantity_mt),
        pending_quantity_mt: parseFloat(l.pending_quantity_mt),
        fulfillment_percentage: parseFloat(l.fulfillment_percentage),
      })),
      shipments: shipmentsResult.rows.map((s: any) => ({
        ...s,
        total_quantity_mt: parseFloat(s.total_quantity_mt),
      })),
    });
  } catch (error) {
    logger.error('Error fetching contract fulfillment status:', error);
    next(error);
  }
});

// ========== GET /api/contracts/:id/traceability - Get full traceability chain ==========
router.get('/:id/traceability', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get contract basic info
    const contractResult = await pool.query(
      `SELECT c.id, c.contract_no, c.status
       FROM logistics.contracts c
       WHERE c.id = $1 AND c.is_deleted = false`,
      [id]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contractResult.rows[0];

    // Get full traceability chain for each contract line
    const chainResult = await pool.query(
      `SELECT 
        -- Contract line info
        cl.id as contract_line_id,
        COALESCE(cl.type_of_goods, cl.product_name) as product_name,
        cl.quantity_mt as contracted_mt,
        
        -- Shipment info (aggregated)
        (
          SELECT json_agg(json_build_object(
            'shipment_id', s.id,
            'shipment_sn', s.sn,
            'shipment_status', s.status,
            'shipment_line_id', sl.id,
            'shipped_mt', COALESCE(sl.quantity_mt, sl.qty, 0),
            'clearance', (
              SELECT json_agg(json_build_object(
                'clearance_id', cc.id,
                'file_number', cc.file_number,
                'clearance_type', cc.clearance_type,
                'total_cost', cc.total_clearing_cost,
                'payment_status', cc.payment_status
              ))
              FROM finance.customs_clearing_costs cc
              WHERE (cc.shipment_id = s.id OR cc.shipment_line_id = sl.id) AND cc.is_deleted = false
            ),
            'deliveries', (
              SELECT json_agg(json_build_object(
                'delivery_id', od.id,
                'delivery_number', od.delivery_number,
                'status', od.status,
                'destination', od.destination,
                'delivery_date', od.delivery_date,
                'total_cost', od.total_cost
              ))
              FROM logistics.outbound_deliveries od
              WHERE (od.shipment_id = s.id OR od.shipment_line_id = sl.id) AND od.is_deleted = false
            )
          ))
          FROM logistics.shipment_lines sl
          JOIN logistics.shipments s ON sl.shipment_id = s.id AND s.is_deleted = false
          WHERE sl.contract_line_id = cl.id
        ) as shipment_chain
        
      FROM logistics.contract_lines cl
      WHERE cl.contract_id = $1
      ORDER BY cl.created_at`,
      [id]
    );

    // Calculate summary stats
    const lines = chainResult.rows;
    let totalShipments = 0;
    let totalClearances = 0;
    let totalDeliveries = 0;

    const processedLines = lines.map((line: any) => {
      const chain = line.shipment_chain || [];
      chain.forEach((shipment: any) => {
        totalShipments++;
        if (shipment.clearance) totalClearances += shipment.clearance.length;
        if (shipment.deliveries) totalDeliveries += shipment.deliveries.length;
      });
      return {
        ...line,
        shipment_count: chain.length,
        has_clearance: chain.some((s: any) => s.clearance && s.clearance.length > 0),
        has_delivery: chain.some((s: any) => s.deliveries && s.deliveries.length > 0),
      };
    });

    res.json({
      contract_id: contract.id,
      contract_no: contract.contract_no,
      contract_status: contract.status,
      summary: {
        line_count: lines.length,
        total_shipments: totalShipments,
        total_clearances: totalClearances,
        total_deliveries: totalDeliveries,
      },
      lines: processedLines,
    });
  } catch (error) {
    logger.error('Error fetching contract traceability:', error);
    next(error);
  }
});

// ========== POST /api/contracts - Create contract ==========
// NORMALIZED: Inserts into contracts + contract_parties + contract_shipping + contract_terms + contract_products + contract_lines

router.post('/', validateBody(ContractCreateSchema), async (req, res, next) => {
  try {
    const contract = await withTransaction(async (client) => {

    let {
      contract_no,
      buyer_company_id,
      buyer_company_name,
      seller_company_id,
      seller_company_name,
      incoterm_code,
      currency_code,
      signed_at,
      valid_from,
      valid_to,
      status,
      direction,
      subject,
      notes,
      extra_json,
      lines,
      // Nested objects - NOW GO TO NORMALIZED TABLES
      commercial_parties,
      shipping,
      terms,
      banking_docs,
    } = req.body;

    logger.info('📝 Creating contract with normalized tables...');
    logger.info('  req.body keys:', Object.keys(req.body));
    logger.info('  commercial_parties:', commercial_parties ? JSON.stringify(commercial_parties).substring(0, 200) : 'null/undefined');
    logger.info('  shipping:', shipping ? JSON.stringify(shipping).substring(0, 200) : 'null/undefined');
    logger.info('  terms:', terms ? JSON.stringify(terms).substring(0, 200) : 'null/undefined');
    logger.info('  banking_docs:', banking_docs ? JSON.stringify(banking_docs).substring(0, 200) : 'null/undefined');
    logger.info('  lines:', lines?.length || 0, 'lines');
    logger.info('  buyer_company_id:', buyer_company_id, '| buyer_company_name:', buyer_company_name);
    logger.info('  seller_company_id:', seller_company_id, '| seller_company_name:', seller_company_name);

    // Helper function to normalize date formats (YYYY-MM -> YYYY-MM-01)
    const normalizeDate = (dateStr: string | null | undefined): string | null => {
      if (!dateStr) return null;
      // If it's YYYY-MM format, convert to YYYY-MM-01
      if (/^\d{4}-\d{2}$/.test(dateStr)) {
        return `${dateStr}-01`;
      }
      // If it's already YYYY-MM-DD, return as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      // Otherwise return null to avoid DB errors
      return null;
    };

    // Helper function to find or create company (with fuzzy matching to prevent duplicates)
    const findOrCreateCompany = async (companyId: string | undefined, companyName: string | undefined): Promise<string> => {
      // Handle empty strings as undefined
      if (companyId && companyId.trim() !== '') return companyId;
      if (companyName) {
        // First check for exact match (case-insensitive)
        const exactMatch = await client.query(
          `SELECT id, name FROM master_data.companies 
           WHERE LOWER(name) = LOWER($1) AND is_deleted = false LIMIT 1`,
          [companyName]
        );
        if (exactMatch.rows.length > 0) {
          logger.info(`✅ Found existing company (exact match): "${companyName}" → "${exactMatch.rows[0].name}"`);
          return exactMatch.rows[0].id;
        }
        
        // No exact match - check for fuzzy match using 70% threshold
        const normalizedName = normalizeCompanyName(companyName);
        const searchTokens = normalizedName.split(' ').filter(t => t.length > 2);
        
        if (searchTokens.length > 0) {
          // Fetch candidates that might be similar (using first token for efficiency)
          const firstToken = searchTokens[0];
          const candidatesResult = await client.query(
            `SELECT id, name FROM master_data.companies 
             WHERE is_deleted = false AND (
               LOWER(name) LIKE $1 OR LOWER(name) LIKE $2
             ) LIMIT 200`,
            [`${firstToken}%`, `%${firstToken}%`]
          );
          
          if (candidatesResult.rows.length > 0) {
            const matches = findBestMatches(
              companyName,
              candidatesResult.rows.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
              0.70,  // 70% similarity threshold - blocks duplicates
              1
            );
            
            if (matches.length > 0) {
              const bestMatch = candidatesResult.rows.find((c: { id: string }) => c.id === matches[0].id);
              logger.info(`✅ Found existing company (fuzzy match ${(matches[0].score * 100).toFixed(1)}%): "${companyName}" → "${bestMatch.name}"`);
              return bestMatch.id;
            }
          }
        }
        
        // No match found - create new company
        const newCompany = await client.query(
          `INSERT INTO master_data.companies (name) VALUES ($1) RETURNING id`,
          [companyName]
        );
        logger.info(`✅ Created new company: ${companyName}`);
        return newCompany.rows[0].id;
      }
      throw new Error('Either company ID or name must be provided');
    };

    // Resolve buyer and seller company IDs
    buyer_company_id = await findOrCreateCompany(buyer_company_id, buyer_company_name);
    seller_company_id = await findOrCreateCompany(seller_company_id, seller_company_name);

    if (buyer_company_id === seller_company_id) {
      throw new Error('Buyer and seller cannot be the same company');
    }

    // ========== PRE-CHECK: Verify contract_no is unique ==========
    if (contract_no) {
      const existingContract = await client.query(
        `SELECT id, contract_no FROM logistics.contracts 
         WHERE contract_no = $1 AND is_deleted = false LIMIT 1`,
        [contract_no]
      );
      if (existingContract.rows.length > 0) {
        const error: any = new Error(`Contract number "${contract_no}" already exists. Please use a different contract number or edit the existing contract.`);
        error.statusCode = 409;
        throw error;
      }
    }

    // ========== 1. INSERT INTO contracts (core table) ==========
    const contractResult = await client.query(
      `INSERT INTO logistics.contracts (
        contract_no, buyer_company_id, seller_company_id,
        signed_at, valid_from, valid_to,
        status, direction, subject, notes, extra_json, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        contract_no,
        buyer_company_id,
        seller_company_id,
        signed_at,
        valid_from,
        valid_to,
        status || 'ACTIVE',
        direction || 'incoming',
        subject,
        notes,
        JSON.stringify(extra_json || {}),
        'api',
      ]
    );
    const contract = contractResult.rows[0];
    logger.info(`✅ Created contract: ${contract.id}`);

    // ========== 2. INSERT INTO contract_parties ==========
    if (commercial_parties) {
      // Resolve consignee company ID if name provided
      let consignee_company_id = commercial_parties.consignee_company_id;
      if (!consignee_company_id && commercial_parties.consignee_name) {
        consignee_company_id = await findOrCreateCompany(undefined, commercial_parties.consignee_name);
      }

      await client.query(
        `INSERT INTO logistics.contract_parties (
          contract_id, proforma_number, invoice_date, other_reference,
          exporter_company_id, buyer_company_id, 
          consignee_same_as_buyer, consignee_company_id,
          has_broker, broker_buying_name, broker_selling_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          contract.id,
          commercial_parties.proforma_number || contract_no,
          commercial_parties.invoice_date || null,
          commercial_parties.other_reference || null,
          commercial_parties.exporter_company_id || seller_company_id,
          commercial_parties.buyer_company_id || buyer_company_id,
          commercial_parties.consignee_same_as_buyer ?? true,
          consignee_company_id || null,
          commercial_parties.has_broker || false,
          commercial_parties.broker_buying_name || null,
          commercial_parties.broker_selling_name || null,
        ]
      );
      logger.info('✅ Inserted contract_parties');
    }

    // ========== 3. INSERT INTO contract_shipping ==========
    if (shipping) {
      logger.info('📍 Saving shipping data:', {
        port_of_loading_id: shipping.port_of_loading_id,
        port_of_loading_name: shipping.port_of_loading_name,
        final_destination_id: shipping.final_destination_id,
        final_destination_name: shipping.final_destination_name,
        country_of_export: shipping.country_of_export,
        country_of_final_destination: shipping.country_of_final_destination,
      });
      
      // Helper to find or create port by name
      const findOrCreatePort = async (portId: string | undefined, portName: string | undefined): Promise<string | null> => {
        if (portId) return portId;
        if (!portName) return null;
        
        // Try to find existing port by name
        const existingPort = await client.query(
          `SELECT id FROM master_data.ports WHERE LOWER(name) = LOWER($1) LIMIT 1`,
          [portName]
        );
        if (existingPort.rows.length > 0) {
          logger.info(`✅ Found existing port: ${portName}`);
          return existingPort.rows[0].id;
        }
        
        // Create new port
        const newPort = await client.query(
          `INSERT INTO master_data.ports (name) VALUES ($1) RETURNING id`,
          [portName]
        );
        logger.info(`✅ Created new port: ${portName}`);
        return newPort.rows[0].id;
      };
      
      // Resolve port IDs from names if needed
      const polId = await findOrCreatePort(shipping.port_of_loading_id, shipping.port_of_loading_name);
      const podId = await findOrCreatePort(shipping.final_destination_id, shipping.final_destination_name);
      
      await client.query(
        `INSERT INTO logistics.contract_shipping (
          contract_id, country_of_export, country_of_final_destination,
          port_of_loading_id, final_destination_id,
          pre_carriage_by, place_of_receipt, vessel_flight_no, estimated_shipment_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          contract.id,
          shipping.country_of_export || null,
          shipping.country_of_final_destination || null,
          polId,
          podId,
          shipping.pre_carriage_by || null,
          shipping.place_of_receipt || null,
          shipping.vessel_flight_no || null,
          normalizeDate(shipping.estimated_shipment_date),
        ]
      );
      logger.info('✅ Inserted contract_shipping with ports:', {
        port_of_loading_id: polId || 'NULL',
        final_destination_id: podId || 'NULL',
      });
    }

    // ========== 4. INSERT INTO contract_terms ==========
    if (terms) {
      await client.query(
        `INSERT INTO logistics.contract_terms (
          contract_id, cargo_type, tanker_type, barrels,
          weight_ton, weight_unit, weight_unit_custom, container_count,
          incoterm, delivery_terms_detail, payment_terms, payment_method,
          currency_code, usd_equivalent_rate, special_clauses
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          contract.id,
          terms.cargo_type || null,
          terms.tanker_type || null,
          terms.barrels || null,
          terms.weight_ton || null,
          terms.weight_unit || 'tons',
          terms.weight_unit_custom || null,
          terms.container_count || null,
          terms.incoterm || incoterm_code || null,
          terms.delivery_terms_detail || null,
          terms.payment_terms || null,
          terms.payment_method || null,
          terms.currency_code || currency_code || 'USD',
          terms.usd_equivalent_rate || null,
          JSON.stringify(terms.special_clauses || []),
        ]
      );
      logger.info('✅ Inserted contract_terms');
    }

    // ========== 5. INSERT INTO contract_products (banking & final destination) ==========
    if (banking_docs) {
      // Resolve and validate final destination company ID based on type
      let final_destination_company_id = banking_docs.final_destination_company_id;
      const destType = banking_docs.final_destination_type;
      
      // Validate the ID exists based on destination type
      if (final_destination_company_id) {
        const tableName = destType === 'branch' ? 'master_data.branches' : 'master_data.companies';
        const whereClause = destType === 'branch' ? 'id = $1' : 'id = $1 AND is_deleted = false';
        const idExists = await client.query(
          `SELECT id FROM ${tableName} WHERE ${whereClause}`,
          [final_destination_company_id]
        );
        if (idExists.rows.length === 0) {
          logger.info(`⚠️ final_destination_company_id ${final_destination_company_id} not found in ${tableName}, will try by name`);
          final_destination_company_id = undefined;
        }
      }
      
      // For customer type, try to find/create company by name if ID not valid
      if (!final_destination_company_id && banking_docs.final_destination_name && destType === 'customer') {
        final_destination_company_id = await findOrCreateCompany(undefined, banking_docs.final_destination_name);
      }

      // Auto-detect has_final_destination based on whether any final destination fields are populated
      const hasFinalDestination = !!(
        banking_docs.has_final_destination ||
        banking_docs.final_destination_type ||
        banking_docs.final_destination_name ||
        banking_docs.final_destination_delivery_place ||
        banking_docs.final_destination_address ||
        final_destination_company_id
      );

      await client.query(
        `INSERT INTO logistics.contract_products (
          contract_id,
          beneficiary_name, beneficiary_address, beneficiary_account_no,
          beneficiary_bank_name, beneficiary_bank_address, beneficiary_swift_code, correspondent_bank,
          has_final_destination, final_destination_type, final_destination_company_id,
          final_destination_name, final_destination_delivery_place, final_destination_address,
          final_destination_contact, final_destination_selling_price, final_destination_notes,
          documentation, documentation_responsibility, documentation_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          contract.id,
          banking_docs.beneficiary_name || null,
          banking_docs.beneficiary_address || null,
          banking_docs.beneficiary_account_no || null,
          banking_docs.beneficiary_bank_name || null,
          banking_docs.beneficiary_bank_address || null,
          banking_docs.beneficiary_swift_code || null,
          banking_docs.correspondent_bank || null,
          hasFinalDestination,
          banking_docs.final_destination_type || null,
          final_destination_company_id || null,
          banking_docs.final_destination_name || null,
          banking_docs.final_destination_delivery_place || null,
          banking_docs.final_destination_address || null,
          banking_docs.final_destination_contact || null,
          banking_docs.final_destination_selling_price || null,
          banking_docs.final_destination_notes || null,
          JSON.stringify(banking_docs.documentation || []),
          banking_docs.documentation_responsibility || 'exporter',
          banking_docs.documentation_notes || null,
        ]
      );
      logger.info('✅ Inserted contract_products (banking & final destination), has_final_destination:', hasFinalDestination);
    }

    // ========== 6. INSERT INTO contract_lines ==========
    if (lines && lines.length > 0) {
      for (const line of lines) {
        const lineExtraJson = {
          ...(line.extra_json || {}),
          uom: line.uom,
          planned_qty: line.planned_qty,
          tolerance_pct: line.tolerance_pct,
          unit_size: line.unit_size,
          volume_cbm: line.volume_cbm,
          volume_liters: line.volume_liters,
        };
        
        await client.query(
          `INSERT INTO logistics.contract_lines (
            contract_id, product_id, type_of_goods, product_name, brand, trademark,
            country_of_origin, kind_of_packages, number_of_packages, package_size, package_size_unit,
            quantity_mt, pricing_method, unit_price, rate_usd_per_mt, amount_usd,
            marks, notes, extra_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            contract.id,
            line.product_id || null,
            line.type_of_goods || null,
            line.product_name || null,
            line.brand || null,
            line.trademark || null,
            line.country_of_origin || null,
            line.kind_of_packages || null,
            line.number_of_packages || null,
            line.package_size || null,
            line.package_size_unit || null,
            line.quantity_mt || null,
            line.pricing_method || 'per_mt',
            line.unit_price || null,
            line.rate_usd_per_mt || null,
            line.amount_usd || null,
            line.marks || null,
            line.notes || null,
            JSON.stringify(lineExtraJson),
          ]
        );
      }
      logger.info(`✅ Inserted ${lines.length} contract_lines`);
    }

      // Return contract for use after transaction
      return contract;
    });

    // ========== Fetch complete contract using v_contracts_complete view ==========
    const completeResult = await pool.query(
      `SELECT vc.*, 
        b.name as buyer_name, 
        s.name as seller_name,
        exp.name as exporter_name,
        con.name as consignee_name
      FROM logistics.v_contracts_complete vc
      LEFT JOIN master_data.companies b ON vc.buyer_company_id = b.id
      LEFT JOIN master_data.companies s ON vc.seller_company_id = s.id
      LEFT JOIN master_data.companies exp ON vc.exporter_company_id = exp.id
      LEFT JOIN master_data.companies con ON vc.consignee_company_id = con.id
      WHERE vc.id = $1`,
      [contract.id]
    );

    const linesResult = await pool.query(
      `SELECT cl.*, p.name as product_name
      FROM logistics.contract_lines cl
      LEFT JOIN master_data.products p ON cl.product_id = p.id
      WHERE cl.contract_id = $1
      ORDER BY cl.created_at`,
      [contract.id]
    );

    // Structure the response with nested objects for frontend compatibility
    const contractData = completeResult.rows[0];
    const result = {
      ...contractData,
      lines: linesResult.rows,
      // Structure data for frontend wizard compatibility
      commercial_parties: {
        proforma_number: contractData.proforma_number,
        invoice_date: contractData.invoice_date,
        other_reference: contractData.other_reference,
        exporter_company_id: contractData.exporter_company_id,
        exporter_name: contractData.exporter_name,
        buyer_company_id: contractData.buyer_company_id,
        buyer_name: contractData.buyer_name,
        consignee_same_as_buyer: contractData.consignee_same_as_buyer,
        consignee_company_id: contractData.consignee_company_id,
        consignee_name: contractData.consignee_name,
        has_broker: contractData.has_broker,
        broker_buying_name: contractData.broker_buying_name,
        broker_selling_name: contractData.broker_selling_name,
      },
      shipping: {
        country_of_origin: contractData.country_of_origin,
        country_of_final_destination: contractData.country_of_final_destination,
        port_of_loading_id: contractData.port_of_loading_id,
        final_destination_id: contractData.final_destination_id,
        pre_carriage_by: contractData.pre_carriage_by,
        place_of_receipt: contractData.place_of_receipt,
        vessel_flight_no: contractData.vessel_flight_no,
        estimated_shipment_date: contractData.estimated_shipment_date,
      },
      terms: {
        cargo_type: contractData.cargo_type,
        tanker_type: contractData.tanker_type,
        barrels: contractData.barrels,
        weight_ton: contractData.weight_ton,
        weight_unit: contractData.weight_unit,
        weight_unit_custom: contractData.weight_unit_custom,
        container_count: contractData.container_count,
        incoterm: contractData.incoterm,
        delivery_terms_detail: contractData.delivery_terms_detail,
        payment_terms: contractData.payment_terms,
        payment_method: contractData.payment_method,
        currency_code: contractData.currency_code,
        usd_equivalent_rate: contractData.usd_equivalent_rate,
        special_clauses: contractData.special_clauses,
      },
      banking_docs: {
        beneficiary_name: contractData.beneficiary_name,
        beneficiary_address: contractData.beneficiary_address,
        beneficiary_account_no: contractData.beneficiary_account_no,
        beneficiary_bank_name: contractData.beneficiary_bank_name,
        beneficiary_bank_address: contractData.beneficiary_bank_address,
        beneficiary_swift_code: contractData.beneficiary_swift_code,
        correspondent_bank: contractData.correspondent_bank,
        has_final_destination: contractData.has_final_destination,
        final_destination_type: contractData.final_destination_type,
        final_destination_company_id: contractData.final_destination_company_id,
        final_destination_name: contractData.final_destination_name,
        final_destination_delivery_place: contractData.final_destination_delivery_place,
        final_destination_address: contractData.final_destination_address,
        final_destination_contact: contractData.final_destination_contact,
        final_destination_selling_price: contractData.final_destination_selling_price,
        final_destination_notes: contractData.final_destination_notes,
        documentation: contractData.documentation,
        documentation_responsibility: contractData.documentation_responsibility,
        documentation_notes: contractData.documentation_notes,
      },
    };

    // Trigger notification check
    notificationService.checkContractNotifications(contract.id).catch(err => {
      logger.error('Error generating notifications for new contract:', err);
    });

    logger.info('✅ Contract created successfully with all normalized tables!');
    res.status(201).json(result);
  } catch (error) {
    logger.error('❌ Error creating contract:', error);
    next(error);
  }
});

// ========== PUT /api/contracts/:id - Update contract ==========
// NORMALIZED: Updates contracts + UPSERTS into contract_parties, contract_shipping, contract_terms, contract_products

router.put('/:id', validateBody(ContractUpdateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      contract_no,
      buyer_company_id,
      seller_company_id,
      signed_at,
      valid_from,
      valid_to,
      status,
      direction,
      subject,
      notes,
      extra_json,
      lines,
      commercial_parties,
      shipping,
      terms,
      banking_docs,
    } = req.body;
    
    await withTransaction(async (client) => {

    logger.info('📝 Updating contract with normalized tables:', id);
    logger.info('📦 banking_docs received:', JSON.stringify(banking_docs, null, 2));

    // ========== 1. UPDATE contracts (core table) ==========
    const contractResult = await client.query(
      `UPDATE logistics.contracts SET
        contract_no = COALESCE($1, contract_no),
        buyer_company_id = COALESCE($2, buyer_company_id),
        seller_company_id = COALESCE($3, seller_company_id),
        signed_at = COALESCE($4, signed_at),
        valid_from = COALESCE($5, valid_from),
        valid_to = COALESCE($6, valid_to),
        status = COALESCE($7, status),
        direction = COALESCE($8, direction),
        subject = COALESCE($9, subject),
        notes = COALESCE($10, notes),
        extra_json = COALESCE($11, extra_json),
        updated_at = NOW(),
        updated_by = 'api'
      WHERE id = $12 AND is_deleted = false
      RETURNING *`,
      [
        contract_no || null,
        buyer_company_id || null,
        seller_company_id || null,
        signed_at || null,
        valid_from || null,
        valid_to || null,
        status || null,
        direction || null,
        subject || null,
        notes || null,
        extra_json ? JSON.stringify(extra_json) : null,
        id,
      ]
    );

    if (contractResult.rows.length === 0) {
      return null; // Will be handled below
    }
    logger.info('✅ Updated contract core');

    // ========== 2. UPSERT contract_parties ==========
    if (commercial_parties) {
      await client.query(
        `INSERT INTO logistics.contract_parties (
          contract_id, proforma_number, invoice_date, other_reference,
          exporter_company_id, buyer_company_id, 
          consignee_same_as_buyer, consignee_company_id,
          has_broker, broker_buying_name, broker_selling_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (contract_id) DO UPDATE SET
          proforma_number = EXCLUDED.proforma_number,
          invoice_date = EXCLUDED.invoice_date,
          other_reference = EXCLUDED.other_reference,
          exporter_company_id = EXCLUDED.exporter_company_id,
          buyer_company_id = EXCLUDED.buyer_company_id,
          consignee_same_as_buyer = EXCLUDED.consignee_same_as_buyer,
          consignee_company_id = EXCLUDED.consignee_company_id,
          has_broker = EXCLUDED.has_broker,
          broker_buying_name = EXCLUDED.broker_buying_name,
          broker_selling_name = EXCLUDED.broker_selling_name,
          updated_at = NOW()`,
        [
          id,
          commercial_parties.proforma_number || null,
          commercial_parties.invoice_date || null,
          commercial_parties.other_reference || null,
          commercial_parties.exporter_company_id || null,
          commercial_parties.buyer_company_id || null,
          commercial_parties.consignee_same_as_buyer ?? true,
          commercial_parties.consignee_company_id || null,
          commercial_parties.has_broker || false,
          commercial_parties.broker_buying_name || null,
          commercial_parties.broker_selling_name || null,
        ]
      );
      logger.info('✅ Upserted contract_parties');
    }

    // ========== 3. UPSERT contract_shipping ==========
    if (shipping) {
      logger.info('📍 Updating shipping data:', {
        port_of_loading_id: shipping.port_of_loading_id,
        port_of_loading_name: shipping.port_of_loading_name,
        final_destination_id: shipping.final_destination_id,
        final_destination_name: shipping.final_destination_name,
        estimated_shipment_date: shipping.estimated_shipment_date,
        estimated_shipment_date_normalized: shipping.estimated_shipment_date ? 
          (/^\d{4}-\d{2}$/.test(shipping.estimated_shipment_date) ? `${shipping.estimated_shipment_date}-01` : shipping.estimated_shipment_date) 
          : null,
      });
      
      // Helper to find or create port by name
      const findOrCreatePort = async (portId: string | undefined, portName: string | undefined): Promise<string | null> => {
        if (portId) return portId;
        if (!portName) return null;
        
        // Try to find existing port by name
        const existingPort = await client.query(
          `SELECT id FROM master_data.ports WHERE LOWER(name) = LOWER($1) LIMIT 1`,
          [portName]
        );
        if (existingPort.rows.length > 0) {
          logger.info(`✅ Found existing port: ${portName}`);
          return existingPort.rows[0].id;
        }
        
        // Create new port
        const newPort = await client.query(
          `INSERT INTO master_data.ports (name) VALUES ($1) RETURNING id`,
          [portName]
        );
        logger.info(`✅ Created new port: ${portName}`);
        return newPort.rows[0].id;
      };
      
      // Resolve port IDs from names if needed
      const polId = await findOrCreatePort(shipping.port_of_loading_id, shipping.port_of_loading_name);
      const podId = await findOrCreatePort(shipping.final_destination_id, shipping.final_destination_name);
      
      await client.query(
        `INSERT INTO logistics.contract_shipping (
          contract_id, country_of_export, country_of_final_destination,
          port_of_loading_id, final_destination_id,
          pre_carriage_by, place_of_receipt, vessel_flight_no, estimated_shipment_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (contract_id) DO UPDATE SET
          country_of_export = EXCLUDED.country_of_export,
          country_of_final_destination = EXCLUDED.country_of_final_destination,
          port_of_loading_id = EXCLUDED.port_of_loading_id,
          final_destination_id = EXCLUDED.final_destination_id,
          pre_carriage_by = EXCLUDED.pre_carriage_by,
          place_of_receipt = EXCLUDED.place_of_receipt,
          vessel_flight_no = EXCLUDED.vessel_flight_no,
          estimated_shipment_date = EXCLUDED.estimated_shipment_date,
          updated_at = NOW()`,
        [
          id,
          shipping.country_of_export || null,
          shipping.country_of_final_destination || null,
          polId,
          podId,
          shipping.pre_carriage_by || null,
          shipping.place_of_receipt || null,
          shipping.vessel_flight_no || null,
          // Normalize date format (YYYY-MM -> YYYY-MM-01)
          shipping.estimated_shipment_date ? 
            (/^\d{4}-\d{2}$/.test(shipping.estimated_shipment_date) ? `${shipping.estimated_shipment_date}-01` : shipping.estimated_shipment_date) 
            : null,
        ]
      );
      logger.info('✅ Upserted contract_shipping');
    }

    // ========== 4. UPSERT contract_terms ==========
    if (terms) {
      await client.query(
        `INSERT INTO logistics.contract_terms (
          contract_id, cargo_type, tanker_type, barrels,
          weight_ton, weight_unit, weight_unit_custom, container_count,
          incoterm, delivery_terms_detail, payment_terms, payment_method,
          currency_code, usd_equivalent_rate, special_clauses
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (contract_id) DO UPDATE SET
          cargo_type = EXCLUDED.cargo_type,
          tanker_type = EXCLUDED.tanker_type,
          barrels = EXCLUDED.barrels,
          weight_ton = EXCLUDED.weight_ton,
          weight_unit = EXCLUDED.weight_unit,
          weight_unit_custom = EXCLUDED.weight_unit_custom,
          container_count = EXCLUDED.container_count,
          incoterm = EXCLUDED.incoterm,
          delivery_terms_detail = EXCLUDED.delivery_terms_detail,
          payment_terms = EXCLUDED.payment_terms,
          payment_method = EXCLUDED.payment_method,
          currency_code = EXCLUDED.currency_code,
          usd_equivalent_rate = EXCLUDED.usd_equivalent_rate,
          special_clauses = EXCLUDED.special_clauses,
          updated_at = NOW()`,
        [
          id,
          terms.cargo_type || null,
          terms.tanker_type || null,
          terms.barrels || null,
          terms.weight_ton || null,
          terms.weight_unit || 'tons',
          terms.weight_unit_custom || null,
          terms.container_count || null,
          terms.incoterm || null,
          terms.delivery_terms_detail || null,
          terms.payment_terms || null,
          terms.payment_method || null,
          terms.currency_code || 'USD',
          terms.usd_equivalent_rate || null,
          JSON.stringify(terms.special_clauses || []),
        ]
      );
      logger.info('✅ Upserted contract_terms');
    }

    // ========== 5. UPSERT contract_products (banking & final destination) ==========
    if (banking_docs) {
      // Validate final_destination_company_id based on type
      let validatedCompanyId = banking_docs.final_destination_company_id || null;
      const destType = banking_docs.final_destination_type;
      
      if (validatedCompanyId) {
        const tableName = destType === 'branch' ? 'master_data.branches' : 'master_data.companies';
        const validationQuery = await client.query(
          `SELECT id FROM ${tableName} WHERE id = $1`,
          [validatedCompanyId]
        );
        if (validationQuery.rows.length === 0) {
          logger.info(`⚠️ final_destination_company_id ${validatedCompanyId} not found in ${tableName}, setting to null`);
          validatedCompanyId = null;
        }
      }
      
      // For customer type, try to find existing company by name (with fuzzy matching) or create new
      if (!validatedCompanyId && banking_docs.final_destination_name && destType === 'customer') {
        const companyName = banking_docs.final_destination_name;
        
        // First check for exact match (case-insensitive)
        const exactMatch = await client.query(
          `SELECT id, name FROM master_data.companies 
           WHERE LOWER(name) = LOWER($1) AND is_deleted = false LIMIT 1`,
          [companyName]
        );
        
        if (exactMatch.rows.length > 0) {
          logger.info(`✅ Found existing company (exact match): "${companyName}" → "${exactMatch.rows[0].name}"`);
          validatedCompanyId = exactMatch.rows[0].id;
        } else {
          // No exact match - check for fuzzy match using 70% threshold
          const normalizedName = normalizeCompanyName(companyName);
          const searchTokens = normalizedName.split(' ').filter(t => t.length > 2);
          
          if (searchTokens.length > 0) {
            const firstToken = searchTokens[0];
            const candidatesResult = await client.query(
              `SELECT id, name FROM master_data.companies 
               WHERE is_deleted = false AND (
                 LOWER(name) LIKE $1 OR LOWER(name) LIKE $2
               ) LIMIT 200`,
              [`${firstToken}%`, `%${firstToken}%`]
            );
            
            if (candidatesResult.rows.length > 0) {
              const matches = findBestMatches(
                companyName,
                candidatesResult.rows.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
                0.70,  // 70% similarity threshold
                1
              );
              
              if (matches.length > 0) {
                const bestMatch = candidatesResult.rows.find((c: { id: string }) => c.id === matches[0].id);
                logger.info(`✅ Found existing company (fuzzy match ${(matches[0].score * 100).toFixed(1)}%): "${companyName}" → "${bestMatch.name}"`);
                validatedCompanyId = bestMatch.id;
              }
            }
          }
          
          // No match found - create new company
          if (!validatedCompanyId) {
            const newCompany = await client.query(
              `INSERT INTO master_data.companies (name, is_customer) VALUES ($1, true) RETURNING id`,
              [companyName]
            );
            logger.info(`✅ Created new customer company: ${companyName}`);
            validatedCompanyId = newCompany.rows[0].id;
          }
        }
      }

      // Auto-detect has_final_destination based on whether any final destination fields are populated
      const hasFinalDestination = !!(
        banking_docs.has_final_destination ||
        banking_docs.final_destination_type ||
        banking_docs.final_destination_name ||
        banking_docs.final_destination_delivery_place ||
        banking_docs.final_destination_address ||
        validatedCompanyId
      );

      await client.query(
        `INSERT INTO logistics.contract_products (
          contract_id,
          beneficiary_name, beneficiary_address, beneficiary_account_no,
          beneficiary_bank_name, beneficiary_bank_address, beneficiary_swift_code, correspondent_bank,
          has_final_destination, final_destination_type, final_destination_company_id,
          final_destination_name, final_destination_delivery_place, final_destination_address,
          final_destination_contact, final_destination_selling_price, final_destination_notes,
          documentation, documentation_responsibility, documentation_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT (contract_id) DO UPDATE SET
          beneficiary_name = EXCLUDED.beneficiary_name,
          beneficiary_address = EXCLUDED.beneficiary_address,
          beneficiary_account_no = EXCLUDED.beneficiary_account_no,
          beneficiary_bank_name = EXCLUDED.beneficiary_bank_name,
          beneficiary_bank_address = EXCLUDED.beneficiary_bank_address,
          beneficiary_swift_code = EXCLUDED.beneficiary_swift_code,
          correspondent_bank = EXCLUDED.correspondent_bank,
          has_final_destination = EXCLUDED.has_final_destination,
          final_destination_type = EXCLUDED.final_destination_type,
          final_destination_company_id = EXCLUDED.final_destination_company_id,
          final_destination_name = EXCLUDED.final_destination_name,
          final_destination_delivery_place = EXCLUDED.final_destination_delivery_place,
          final_destination_address = EXCLUDED.final_destination_address,
          final_destination_contact = EXCLUDED.final_destination_contact,
          final_destination_selling_price = EXCLUDED.final_destination_selling_price,
          final_destination_notes = EXCLUDED.final_destination_notes,
          documentation = EXCLUDED.documentation,
          documentation_responsibility = EXCLUDED.documentation_responsibility,
          documentation_notes = EXCLUDED.documentation_notes,
          updated_at = NOW()`,
        [
          id,
          banking_docs.beneficiary_name || null,
          banking_docs.beneficiary_address || null,
          banking_docs.beneficiary_account_no || null,
          banking_docs.beneficiary_bank_name || null,
          banking_docs.beneficiary_bank_address || null,
          banking_docs.beneficiary_swift_code || null,
          banking_docs.correspondent_bank || null,
          hasFinalDestination,
          banking_docs.final_destination_type || null,
          validatedCompanyId,
          banking_docs.final_destination_name || null,
          banking_docs.final_destination_delivery_place || null,
          banking_docs.final_destination_address || null,
          banking_docs.final_destination_contact || null,
          banking_docs.final_destination_selling_price || null,
          banking_docs.final_destination_notes || null,
          JSON.stringify(banking_docs.documentation || []),
          banking_docs.documentation_responsibility || 'exporter',
          banking_docs.documentation_notes || null,
        ]
      );
      logger.info('✅ Upserted contract_products, has_final_destination:', hasFinalDestination, 'company_id:', validatedCompanyId);
    }

    // ========== 6. Replace contract_lines ==========
    if (lines && Array.isArray(lines)) {
      // Delete existing lines
      await client.query(`DELETE FROM logistics.contract_lines WHERE contract_id = $1`, [id]);
      
      // Insert new lines
      for (const line of lines) {
        const lineExtraJson = {
          ...(line.extra_json || {}),
          uom: line.uom,
          planned_qty: line.planned_qty,
          tolerance_pct: line.tolerance_pct,
          unit_size: line.unit_size,
          volume_cbm: line.volume_cbm,
          volume_liters: line.volume_liters,
        };
        
        await client.query(
          `INSERT INTO logistics.contract_lines (
            contract_id, product_id, type_of_goods, product_name, brand, trademark,
            country_of_origin, kind_of_packages, number_of_packages, package_size, package_size_unit,
            quantity_mt, pricing_method, unit_price, rate_usd_per_mt, amount_usd,
            marks, notes, extra_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            id,
            line.product_id || null,
            line.type_of_goods || null,
            line.product_name || null,
            line.brand || null,
            line.trademark || null,
            line.country_of_origin || null,
            line.kind_of_packages || null,
            line.number_of_packages || null,
            line.package_size || null,
            line.package_size_unit || null,
            line.quantity_mt || null,
            line.pricing_method || 'per_mt',
            line.unit_price || null,
            line.rate_usd_per_mt || null,
            line.amount_usd || null,
            line.marks || null,
            line.notes || null,
            JSON.stringify(lineExtraJson),
          ]
        );
      }
      logger.info(`✅ Replaced ${lines.length} contract_lines`);
    }

    return id; // Return contract ID for fetching after transaction
    });

    // ========== Fetch complete contract ==========
    const completeResult = await pool.query(
      `SELECT vc.*, 
        b.name as buyer_name, 
        s.name as seller_name,
        exp.name as exporter_name,
        con.name as consignee_name
      FROM logistics.v_contracts_complete vc
      LEFT JOIN master_data.companies b ON vc.buyer_company_id = b.id
      LEFT JOIN master_data.companies s ON vc.seller_company_id = s.id
      LEFT JOIN master_data.companies exp ON vc.exporter_company_id = exp.id
      LEFT JOIN master_data.companies con ON vc.consignee_company_id = con.id
      WHERE vc.id = $1`,
      [id]
    );

    const linesResult = await pool.query(
      `SELECT cl.*, p.name as product_name
      FROM logistics.contract_lines cl
      LEFT JOIN master_data.products p ON cl.product_id = p.id
      WHERE cl.contract_id = $1
      ORDER BY cl.created_at`,
      [id]
    );

    // Structure response
    const contractData = completeResult.rows[0];
    const result = {
      ...contractData,
      lines: linesResult.rows,
      commercial_parties: {
        proforma_number: contractData.proforma_number,
        invoice_date: contractData.invoice_date,
        other_reference: contractData.other_reference,
        exporter_company_id: contractData.exporter_company_id,
        exporter_name: contractData.exporter_name,
        buyer_company_id: contractData.buyer_company_id,
        buyer_name: contractData.buyer_name,
        consignee_same_as_buyer: contractData.consignee_same_as_buyer,
        consignee_company_id: contractData.consignee_company_id,
        consignee_name: contractData.consignee_name,
        has_broker: contractData.has_broker,
        broker_buying_name: contractData.broker_buying_name,
        broker_selling_name: contractData.broker_selling_name,
      },
      shipping: {
        country_of_origin: contractData.country_of_origin,
        country_of_final_destination: contractData.country_of_final_destination,
        port_of_loading_id: contractData.port_of_loading_id,
        final_destination_id: contractData.final_destination_id,
        pre_carriage_by: contractData.pre_carriage_by,
        place_of_receipt: contractData.place_of_receipt,
        vessel_flight_no: contractData.vessel_flight_no,
        estimated_shipment_date: contractData.estimated_shipment_date,
      },
      terms: {
        cargo_type: contractData.cargo_type,
        tanker_type: contractData.tanker_type,
        barrels: contractData.barrels,
        weight_ton: contractData.weight_ton,
        weight_unit: contractData.weight_unit,
        weight_unit_custom: contractData.weight_unit_custom,
        container_count: contractData.container_count,
        incoterm: contractData.incoterm,
        delivery_terms_detail: contractData.delivery_terms_detail,
        payment_terms: contractData.payment_terms,
        payment_method: contractData.payment_method,
        currency_code: contractData.currency_code,
        usd_equivalent_rate: contractData.usd_equivalent_rate,
        special_clauses: contractData.special_clauses,
      },
      banking_docs: {
        beneficiary_name: contractData.beneficiary_name,
        beneficiary_address: contractData.beneficiary_address,
        beneficiary_account_no: contractData.beneficiary_account_no,
        beneficiary_bank_name: contractData.beneficiary_bank_name,
        beneficiary_bank_address: contractData.beneficiary_bank_address,
        beneficiary_swift_code: contractData.beneficiary_swift_code,
        correspondent_bank: contractData.correspondent_bank,
        has_final_destination: contractData.has_final_destination,
        final_destination_type: contractData.final_destination_type,
        final_destination_company_id: contractData.final_destination_company_id,
        final_destination_name: contractData.final_destination_name,
        final_destination_delivery_place: contractData.final_destination_delivery_place,
        final_destination_address: contractData.final_destination_address,
        final_destination_contact: contractData.final_destination_contact,
        final_destination_selling_price: contractData.final_destination_selling_price,
        final_destination_notes: contractData.final_destination_notes,
        documentation: contractData.documentation,
        documentation_responsibility: contractData.documentation_responsibility,
        documentation_notes: contractData.documentation_notes,
      },
    };

    // Trigger notification check if status changed
    if (status) {
      notificationService.checkContractNotifications(id).catch(err => {
        logger.error('Error generating notifications for updated contract:', err);
      });
    }

    if (!result) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    logger.info('✅ Contract updated successfully!');
    res.json(result);
  } catch (error) {
    logger.error('❌ Error updating contract:', error);
    next(error);
  }
});

// ========== GET /api/contracts/:id/lines - Get contract lines ==========

router.get('/:id/lines', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        cl.*,
        p.name as product_name,
        p.hs_code,
        p.category,
        p.uom as product_uom
      FROM logistics.contract_lines cl
      LEFT JOIN master_data.products p ON cl.product_id = p.id
      WHERE cl.contract_id = $1
      ORDER BY cl.created_at
      `,
      [id]
    );

    res.json({
      contract_id: id,
      count: result.rows.length,
      lines: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ========== POST /api/contracts/:id/payment-schedules - Add payment schedule ==========

router.post(
  '/:id/payment-schedules',
  validateBody(PaymentScheduleSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { seq, basis, days_after, percent, amount, is_deferred, notes, extra_json } = req.body;

      // Verify contract exists
      const contractCheck = await pool.query(
        'SELECT id FROM logistics.contracts WHERE id = $1 AND is_deleted = false',
        [id]
      );

      if (contractCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Insert payment schedule
      const result = await pool.query(
        `
        INSERT INTO finance.payment_schedules (
          contract_id, seq, basis, days_after, percent, amount,
          is_deferred, notes, extra_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          id,
          seq,
          basis,
          days_after,
          percent,
          amount,
          is_deferred || false,
          notes,
          JSON.stringify(extra_json || {}),
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// ========== GET /api/contracts/:id/payment-schedules - Get payment schedules ==========

router.get('/:id/payment-schedules', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT * FROM finance.payment_schedules
      WHERE contract_id = $1
      ORDER BY seq
      `,
      [id]
    );

    res.json({
      contract_id: id,
      count: result.rows.length,
      schedules: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/contracts/:id/summary - Get contract overview with payments ==========

router.get('/:id/summary', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get contract overview from report view
    const overviewResult = await pool.query(
      'SELECT * FROM report.contract_overview WHERE contract_id = $1',
      [id]
    );

    if (overviewResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Contract not found',
        timestamp: new Date().toISOString(),
      });
    }

    const overview = overviewResult.rows[0];

    // Get top 5 upcoming payments
    const paymentsResult = await pool.query(
      `SELECT * FROM report.contract_payment_status 
       WHERE contract_id = $1 
       AND is_active = true
       AND computed_due_date IS NOT NULL
       ORDER BY computed_due_date ASC
       LIMIT 5`,
      [id]
    );

    res.json({
      overview: overview,
      upcoming_payments: paymentsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/contracts/:id/consumption - Get contract line fulfillment ==========

router.get('/:id/consumption', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM report.contract_line_fulfillment 
       WHERE contract_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      contract_id: id,
      count: result.rows.length,
      lines: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/contracts/:id/documents - Get contract documents ==========

router.get('/:id/documents', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get documents linked to contract and its shipments
    const result = await pool.query(
      `SELECT 
        d.*,
        CASE 
          WHEN d.shipment_id IS NOT NULL THEN 'shipment'
          WHEN d.contract_id IS NOT NULL THEN 'contract'
          ELSE 'other'
        END as source_type,
        s.sn as shipment_sn,
        s.bl_no as shipment_bl_no
      FROM archive.documents d
      LEFT JOIN logistics.v_shipments_complete s ON d.shipment_id = s.id
      WHERE d.contract_id = $1
         OR d.shipment_id IN (
           SELECT id FROM logistics.shipments WHERE contract_id = $1
         )
      ORDER BY d.created_at DESC`,
      [id]
    );

    res.json({
      contract_id: id,
      count: result.rows.length,
      documents: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ========== POST /api/contracts/extract-from-proforma - AI Document Extraction ==========

router.post(
  '/extract-from-proforma',
  withTimeout(120000), // 2 minute timeout for AI processing
  upload.single('file'),
  async (req, res, next) => {
    logger.info('🚀 Extract endpoint hit!');
    logger.info('📦 Request body:', req.body);
    logger.info('📎 File present:', !!req.file);
    
    try {
      if (!req.file) {
        logger.info('❌ No file in request');
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      logger.info(`📄 Processing file: ${req.file.originalname}`);

      // Dynamically import the extraction service
      const { processProformaDocument } = await import('../services/documentExtraction');

      // Process the document
      const result = await processProformaDocument(req.file.path, {
        collectTrainingData: true,
        userId: (req as any).user?.id, // Assuming auth middleware sets req.user
      });

      // Log extraction to database if successful
      if (result.success) {
        try {
          await pool.query(
            `INSERT INTO logistics.ai_extraction_logs (
              original_filename,
              file_size,
              file_type,
              success,
              confidence_score,
              processing_time_ms,
              extracted_data,
              warnings,
              model_used,
              uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              req.file.originalname,
              req.file.size,
              req.file.mimetype,
              result.success,
              result.confidence,
              result.processingTime,
              JSON.stringify(result.data),
              result.warnings,
              process.env.OPENAI_MODEL || 'gpt-4-vision-preview',
              (req as any).user?.id || null,
            ]
          );
        } catch (logError) {
          logger.warn('Failed to log extraction to database:', logError);
          // Don't fail the request if logging fails
        }
      }

      // Cleanup uploaded file after processing
      fs.unlink(req.file.path).catch(err => 
        logger.warn('Failed to cleanup uploaded file:', err)
      );

      // Return extraction result
      res.json({
        success: result.success,
        data: result.data,
        confidence: result.confidence,
        warnings: result.warnings,
        processingTime: result.processingTime,
        trainingDataId: result.trainingDataId,
        tokensUsed: result.tokensUsed,
        estimatedCost: result.estimatedCost,
        message: result.success
          ? 'Document processed successfully'
          : 'Document processing failed',
      });
      
    } catch (error: any) {
      logger.error('❌ Extraction endpoint error:', error);
      
      // Cleanup file on error
      if (req.file) {
        fs.unlink(req.file.path).catch(() => {});
      }
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
);

// ========== POST /api/contracts/:contractId/create-shipment - Create Shipment from Contract ==========
router.post('/:contractId/create-shipment', async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const { shipment_data = {}, split_lines = [] } = req.body;
    
    // Fetch contract with all lines
    const contractResult = await pool.query(
      `SELECT c.*, 
        b.name as buyer_name,
        s.name as seller_name
      FROM logistics.contracts c
      LEFT JOIN master_data.companies b ON c.buyer_company_id = b.id
      LEFT JOIN master_data.companies s ON c.seller_company_id = s.id
      WHERE c.id = $1 AND c.is_deleted = false`,
      [contractId]
    );
    
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const contract = contractResult.rows[0];
    
    // Fetch contract lines
    const linesResult = await pool.query(
      `SELECT cl.*, p.name as product_name, p.hs_code
      FROM logistics.contract_lines cl
      LEFT JOIN master_data.products p ON p.id = cl.product_id
      WHERE cl.contract_id = $1
      ORDER BY cl.created_at`,
      [contractId]
    );
    
    const contractLines = linesResult.rows;
    
    if (contractLines.length === 0) {
      return res.status(400).json({ error: 'Contract has no lines' });
    }
    
    const result = await withTransaction(async (client) => {
      // Generate shipment SN from contract number
      const shipmentSN = shipment_data.sn || `${contract.contract_no}-SHIP-${Date.now().toString().slice(-6)}`;
      
      // Create shipment record
      const shipmentInsert = await client.query(
        `INSERT INTO logistics.shipments (
          sn, 
          direction, 
          contract_id,
          subject,
          supplier_id, 
          customer_id,
          incoterms,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          shipmentSN,
          shipment_data.direction || 'incoming',
          contractId,
          shipment_data.subject || `Shipment for ${contract.contract_no}`,
          contract.seller_company_id, // supplier is the seller
          contract.buyer_company_id, // customer is the buyer
          contract.extra_json?.incoterm_code || null,
          shipment_data.created_by || 'system',
        ]
      );
      
      const shipment = shipmentInsert.rows[0];
      
      // Log shipment creation
      await client.query(
        `SELECT logistics.log_change($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'shipment',
          shipment.id,
          'shipment',
          null,
          shipmentSN,
          'created',
          'contract_import',
          shipment_data.created_by || 'system',
          `Created from contract ${contract.contract_no}`,
          contractId,
          shipment.id,
        ]
      );
      
      // Create shipment lines from contract lines
      const shipmentLines = [];
      
      for (const contractLine of contractLines) {
        // Check if this line should be split
        const splitInfo = split_lines.find((s: any) => s.contract_line_id === contractLine.id);
        const qty = splitInfo ? splitInfo.qty : contractLine.planned_qty;
        
        const lineInsert = await client.query(
          `INSERT INTO logistics.shipment_lines (
            shipment_id,
            contract_line_id,
            product_id,
            qty,
            unit_price,
            uom,
            unit_size,
            original_contract_qty,
            original_contract_price,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            shipment.id,
            contractLine.id,
            contractLine.product_id,
            qty,
            contractLine.unit_price,
            contractLine.uom,
            contractLine.unit_size,
            contractLine.planned_qty, // Store original contract qty
            contractLine.unit_price, // Store original contract price
            splitInfo ? `Split from contract line (${qty} of ${contractLine.planned_qty} ${contractLine.uom})` : null,
          ]
        );
        
        const shipmentLine = lineInsert.rows[0];
        shipmentLines.push(shipmentLine);
        
        // Log line creation
        await client.query(
          `SELECT logistics.log_change($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            'shipment_line',
            shipmentLine.id,
            'qty',
            null,
            qty.toString(),
            'created',
            'contract_import',
            shipment_data.created_by || 'system',
            `Imported from contract line: ${contractLine.product_name}`,
            contractId,
            shipment.id,
          ]
        );
        
        if (splitInfo) {
          // Log the split
          await client.query(
            `SELECT logistics.log_change($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              'shipment_line',
              shipmentLine.id,
              'qty',
              contractLine.planned_qty.toString(),
              qty.toString(),
              'split',
              'manual',
              shipment_data.created_by || 'system',
              `Line split: ${qty} of ${contractLine.planned_qty} ${contractLine.uom}`,
              contractId,
              shipment.id,
            ]
          );
        }
      }
      
      return {
        shipment,
        shipmentLines,
        shipmentSN,
      };
    });
    
    res.status(201).json({
      success: true,
      shipment: {
        ...result.shipment,
        lines: result.shipmentLines,
      },
      message: `Shipment ${result.shipmentSN} created from contract ${contract.contract_no}`,
    });
  } catch (error) {
    logger.error('Error creating shipment from contract:', error);
    next(error);
  }
});

// ========== POST /api/contracts/:id/propose-update - Propose Contract Update ==========
router.post('/:id/propose-update', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shipment_id, changes, notes, requested_by = 'system' } = req.body;
    
    if (!shipment_id || !changes || !Array.isArray(changes)) {
      return res.status(400).json({ 
        error: 'Missing required fields: shipment_id and changes array' 
      });
    }
    
    // Verify contract and shipment exist
    const verifyResult = await pool.query(
      `SELECT c.id as contract_id, s.id as shipment_id, c.contract_no, s.sn
      FROM logistics.contracts c
      JOIN logistics.v_shipments_complete s ON s.id = $2
      WHERE c.id = $1 AND c.is_deleted = false`,
      [id, shipment_id]
    );
    
    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract or shipment not found' });
    }
    
    // Create update request
    const result = await pool.query(
      `INSERT INTO logistics.contract_update_requests (
        contract_id,
        shipment_id,
        changes_json,
        requested_by,
        notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [id, shipment_id, JSON.stringify(changes), requested_by, notes]
    );
    
    res.status(201).json({
      success: true,
      request: result.rows[0],
      message: 'Contract update request submitted for approval',
    });
    
  } catch (error) {
    logger.error('Error proposing contract update:', error);
    next(error);
  }
});

// ========== POST /api/contract-update-requests/:id/approve - Approve Contract Update ==========
router.post('/update-requests/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approved_by = 'system' } = req.body;
    
    await withTransaction(async (client) => {
      // Get the update request
      const requestResult = await client.query(
        `SELECT * FROM logistics.contract_update_requests WHERE id = $1`,
        [id]
      );
      
      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Update request not found' });
      }
      
      const request = requestResult.rows[0];
      
      if (request.status !== 'pending') {
        return res.status(400).json({ error: `Request already ${request.status}` });
      }
      
      const changes = request.changes_json;
      
      // Apply each change to contract lines
      for (const change of changes) {
        const { line_id, field, new_value, old_value, reason } = change;
        
        // Update the contract line field
        await client.query(
          `UPDATE logistics.contract_lines 
           SET ${field} = $1, updated_at = NOW()
           WHERE id = $2`,
          [new_value, line_id]
        );
        
        // Log the sync change
        await client.query(
          `SELECT logistics.log_change($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            'contract_line',
            line_id,
            field,
            old_value?.toString(),
            new_value?.toString(),
            'updated',
            'sync',
            approved_by,
            reason || 'Synced from shipment',
            request.contract_id,
            request.shipment_id,
          ]
        );
      }
      
      // Mark request as approved
      await client.query(
        `UPDATE logistics.contract_update_requests
         SET status = 'approved', 
             approved_by = $1, 
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [approved_by, id]
      );
      
    });
    
    res.json({
      success: true,
      message: 'Contract update approved and applied',
    });
  } catch (error) {
    logger.error('Error approving contract update:', error);
    next(error);
  }
});

// ========== POST /api/contract-update-requests/:id/reject - Reject Contract Update ==========
router.post('/update-requests/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejection_reason, approved_by = 'system' } = req.body;
    
    if (!rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    const result = await pool.query(
      `UPDATE logistics.contract_update_requests
       SET status = 'rejected',
           approved_by = $1,
           approved_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [approved_by, rejection_reason, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Update request not found or not pending' 
      });
    }
    
    res.json({
      success: true,
      message: 'Contract update rejected',
      request: result.rows[0],
    });
    
  } catch (error) {
    logger.error('Error rejecting contract update:', error);
    next(error);
  }
});

// ========== POST /api/contracts/save-corrections - Save User Corrections ==========

router.post('/save-corrections', async (req, res, next) => {
  try {
    const { trainingDataId, corrections, finalData } = req.body;

    if (!trainingDataId || !finalData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: trainingDataId and finalData',
      });
    }

    // Dynamically import the data collector
    const { saveUserCorrections } = await import('../utils/dataCollector');
    
    await saveUserCorrections(trainingDataId, corrections, finalData);

    // Update extraction log in database
    try {
      await pool.query(
        `UPDATE logistics.ai_extraction_logs 
         SET user_corrected = true,
             corrections = $1,
             correction_timestamp = NOW()
         WHERE id = (
           SELECT id FROM logistics.ai_extraction_logs 
           WHERE extracted_data->>'trainingDataId' = $2
           LIMIT 1
         )`,
        [JSON.stringify(corrections), trainingDataId]
      );
    } catch (logError) {
      logger.warn('Failed to update extraction log:', logError);
    }

    res.json({
      success: true,
      message: 'Corrections saved successfully',
    });
  } catch (error: any) {
    logger.error('❌ Save corrections error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ========== GET /api/contracts/extraction-stats - Get AI Extraction Statistics ==========

router.get('/extraction-stats', async (req, res, next) => {
  try {
    // Get stats from database
    const result = await pool.query(`
      SELECT * FROM report.ai_extraction_analytics
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY date DESC
      LIMIT 30
    `);

    // Get training data stats
    const { getTrainingDataStats } = await import('../utils/dataCollector');
    const trainingStats = await getTrainingDataStats();

    // Get OpenAI usage stats
    const { getUsageMetrics } = await import('../services/openai');
    const usageMetrics = getUsageMetrics();

    res.json({
      dailyStats: result.rows,
      trainingDataStats: trainingStats,
      usageMetrics: usageMetrics,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

