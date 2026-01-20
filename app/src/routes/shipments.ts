import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { pool } from '../db/client';
import { notificationService } from '../services/notificationService';
import { 
  recalculateShipmentStatus, 
  shouldRecalculateStatus, 
  STATUS_TRIGGER_FIELDS 
} from '../services/shipmentStatusEngine';
import { AuthRequest, authorizeModuleAuto, requireWrite } from '../middleware/auth';
import { loadUserBranches, buildShipmentBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';
import { validateShipmentLogic } from '../validators/shipmentLogic';
import logger from '../utils/logger';
import { withTransaction } from '../utils/transactions';
import { getFirstRowOrNull } from '../types/database';
import { parsePagination, createPaginatedResponse } from '../utils/pagination';

const router = Router();

// Apply branch loading middleware to all routes
router.use(loadUserBranches);

// Configure multer for BOL file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads/temp');
  },
  filename: (req, file, cb) => {
    // Preserve the file extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `bol-upload-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, PNG, and WEBP are allowed.'));
    }
  },
});

// GET /api/shipments - List all shipments with filtering and pagination
router.get('/', async (req, res, next) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const { 
      status, 
      pol, // Can be comma-separated list: "India,China"
      pod, // Can be comma-separated list: "Iraq,UAE"
      product, 
      excludeProduct, // Products to exclude (comma-separated)
      sn,
      search, // Universal search across all fields
      etaMonth, // Filter by ETA month (1-12)
      etaYear, // Filter by ETA year (e.g., 2025)
      etaFrom, // Date range start (YYYY-MM-DD)
      etaTo, // Date range end (YYYY-MM-DD)
      branchId, // Filter by final destination branch (for UI branch filter buttons)
      destinationType, // Filter by final destination type (branch, customer, consignment)
      // Numeric filters with operators
      totalValueOp, // Operator for total value (<, >, <=, >=, =)
      totalValue, // Value for total value comparison
      containerCountOp, // Operator for container count
      containerCount, // Value for container count comparison
      weightOp, // Operator for weight
      weight, // Value for weight comparison
      balanceOp, // Operator for balance
      balance, // Value for balance comparison
      sortBy = 'eta', // Column to sort by
      sortDir = 'asc', // Sort direction
      includeDelivered = 'false'
    } = req.query;
    
    // Parse pagination using utility
    const pagination = parsePagination(req);
    
    // Parse array parameters (comma-separated strings)
    const polList = pol ? (pol as string).split(',').map(p => p.trim()).filter(p => p) : [];
    const podList = pod ? (pod as string).split(',').map(p => p.trim()).filter(p => p) : [];
    const excludeProductList = excludeProduct ? (excludeProduct as string).split(',').map(p => p.trim()).filter(p => p) : [];
    
    // Build branch filter
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');
    
    // Using v_shipments_complete view which JOINs all normalized tables
    let query = `
      SELECT s.*,
        pol.name as pol_name, 
        pol.country as pol_country,
        pod.name as pod_name,
        pod.country as pod_country,
        c.name as shipping_line_name,
        con.contract_no as contract_no
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      LEFT JOIN logistics.contracts con ON s.contract_id = con.id
      WHERE 1=1
    `;
    const params: any[] = [...branchFilter.params];
    
    // Apply branch filter (if user doesn't have global access)
    if (branchFilter.clause !== '1=1') {
      query += ` AND ${branchFilter.clause}`;
    }
    
    // By default, exclude delivered/cleared shipments (grey-highlighted rows)
    // unless specifically filtering by status or includeDelivered=true
    if (!status && includeDelivered !== 'true') {
      query += ` AND (s.status IS NULL OR s.status != 'delivered')`;
    }
    
    // Universal search - searches across multiple fields with fuzzy matching
    if (search) {
      const searchTerm = search as string;
      // Remove special characters from search term for better matching
      const normalizedSearch = searchTerm.replace(/[-_\s]/g, '').toLowerCase();
      
      params.push(`%${normalizedSearch}%`);
      const normalizedParam = params.length;
      params.push(`%${searchTerm}%`);
      const originalParam = params.length;
      
      query += ` AND (
        REPLACE(REPLACE(REPLACE(LOWER(s.sn), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(s.product_text), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(s.booking_no), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(s.bl_no), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(s.paperwork_status), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        LOWER(pol.name) LIKE LOWER($${originalParam}) OR
        LOWER(pod.name) LIKE LOWER($${originalParam}) OR
        LOWER(c.name) LIKE LOWER($${originalParam})
      )`;
    }
    
    // Apply specific filters (work alongside universal search)
    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }
    
    // Branch filter (for UI branch filter buttons)
    if (branchId) {
      params.push(branchId);
      query += ` AND (s.final_destination->>'branch_id' = $${params.length} OR s.final_destination->>'warehouse_id' = $${params.length})`;
    }
    
    // Destination type filter (branch, customer, consignment)
    if (destinationType) {
      params.push(destinationType);
      query += ` AND s.final_destination->>'type' = $${params.length}`;
    }
    
    // Multiple POL filter (OR condition)
    if (polList.length > 0) {
      const polConditions = polList.map(p => {
        params.push(`%${p}%`);
        return `pol.name ILIKE $${params.length}`;
      }).join(' OR ');
      query += ` AND (${polConditions})`;
    }
    
    // Multiple POD filter (OR condition)
    if (podList.length > 0) {
      const podConditions = podList.map(p => {
        params.push(`%${p}%`);
        return `pod.name ILIKE $${params.length}`;
      }).join(' OR ');
      query += ` AND (${podConditions})`;
    }
    
    // Product filter (if provided directly)
    if (product) {
      params.push(`%${product}%`);
      query += ` AND s.product_text ILIKE $${params.length}`;
    }
    
    // Exclude products (NOT condition)
    if (excludeProductList.length > 0) {
      const excludeConditions = excludeProductList.map(p => {
        params.push(`%${p}%`);
        return `s.product_text NOT ILIKE $${params.length}`;
      }).join(' AND ');
      query += ` AND (${excludeConditions})`;
    }
    
    if (sn) {
      params.push(`%${sn}%`);
      query += ` AND s.sn ILIKE $${params.length}`;
    }
    
    // Date filtering - Date range takes precedence over month/year
    if (etaFrom || etaTo) {
      if (etaFrom) {
        params.push(etaFrom);
        query += ` AND s.eta >= $${params.length}`;
      }
      if (etaTo) {
        params.push(etaTo);
        query += ` AND s.eta <= $${params.length}`;
      }
    } else {
      // Single month/year filters (only if no date range)
      if (etaMonth) {
        const month = parseInt(etaMonth as string);
        if (month >= 1 && month <= 12) {
          params.push(month);
          query += ` AND EXTRACT(MONTH FROM s.eta) = $${params.length}`;
        }
      }
      
      if (etaYear) {
        const year = parseInt(etaYear as string);
        if (year >= 2000 && year <= 2100) {
          params.push(year);
          query += ` AND EXTRACT(YEAR FROM s.eta) = $${params.length}`;
        }
      }
    }
    
    // Numeric filtering with operators
    const validOperators = ['<', '>', '<=', '>=', '='];
    
    // Total value filter
    if (totalValue && totalValueOp && validOperators.includes(totalValueOp as string)) {
      const val = parseFloat(totalValue as string);
      if (!isNaN(val)) {
        params.push(val);
        query += ` AND s.total_value_usd ${totalValueOp} $${params.length}`;
      }
    }
    
    // Container count filter
    if (containerCount && containerCountOp && validOperators.includes(containerCountOp as string)) {
      const val = parseInt(containerCount as string);
      if (!isNaN(val)) {
        params.push(val);
        query += ` AND s.container_count ${containerCountOp} $${params.length}`;
      }
    }
    
    // Weight filter
    if (weight && weightOp && validOperators.includes(weightOp as string)) {
      const val = parseFloat(weight as string);
      if (!isNaN(val)) {
        params.push(val);
        query += ` AND s.weight_ton ${weightOp} $${params.length}`;
      }
    }
    
    // Balance filter
    if (balance && balanceOp && validOperators.includes(balanceOp as string)) {
      const val = parseFloat(balance as string);
      if (!isNaN(val)) {
        params.push(val);
        query += ` AND s.balance_value_usd ${balanceOp} $${params.length}`;
      }
    }
    
    // Add sorting
    const validSortColumns = ['sn', 'product_text', 'eta', 'etd', 'weight_ton', 'total_value_usd', 'fixed_price_usd_per_ton', 'container_count', 'balance_value_usd', 'status', 'created_at', 'updated_at'];
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'created_at';
    const sortDirection = sortDir === 'desc' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY `;
    if (sortColumn === 'eta' || sortColumn === 'etd') {
      // Special handling for date fields - push nulls to end
      query += `s.${sortColumn} ${sortDirection} NULLS LAST, s.created_at DESC`;
    } else {
      query += `s.${sortColumn} ${sortDirection} NULLS LAST`;
    }
    
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pagination.limit, pagination.offset);
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) 
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE 1=1
    `;
    // Start with branch filter params (same as main query)
    const countParams: any[] = [...branchFilter.params];
    
    // Apply branch filter to count query (MUST match main query)
    if (branchFilter.clause !== '1=1') {
      countQuery += ` AND ${branchFilter.clause}`;
    }
    
    // Exclude delivered shipments from count (same logic as main query)
    if (!status && includeDelivered !== 'true') {
      countQuery += ` AND (s.status IS NULL OR s.status != 'delivered')`;
    }
    
    // Universal search in count query
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (
        s.sn ILIKE $${countParams.length} OR
        s.product_text ILIKE $${countParams.length} OR
        pol.name ILIKE $${countParams.length} OR
        pod.name ILIKE $${countParams.length} OR
        c.name ILIKE $${countParams.length} OR
        s.booking_no ILIKE $${countParams.length} OR
        s.bl_no ILIKE $${countParams.length} OR
        s.paperwork_status ILIKE $${countParams.length}
      )`;
    }
    
    if (status) {
      countParams.push(status);
      countQuery += ` AND s.status = $${countParams.length}`;
    }
    
    // Branch filter in count query
    if (branchId) {
      countParams.push(branchId);
      countQuery += ` AND (s.final_destination->>'branch_id' = $${countParams.length} OR s.final_destination->>'warehouse_id' = $${countParams.length})`;
    }
    
    // Multiple POL filter in count query
    if (polList.length > 0) {
      const polConditions = polList.map(p => {
        countParams.push(`%${p}%`);
        return `pol.name ILIKE $${countParams.length}`;
      }).join(' OR ');
      countQuery += ` AND (${polConditions})`;
    }
    
    // Multiple POD filter in count query
    if (podList.length > 0) {
      const podConditions = podList.map(p => {
        countParams.push(`%${p}%`);
        return `pod.name ILIKE $${countParams.length}`;
      }).join(' OR ');
      countQuery += ` AND (${podConditions})`;
    }
    
    if (product) {
      countParams.push(`%${product}%`);
      countQuery += ` AND s.product_text ILIKE $${countParams.length}`;
    }
    
    // Exclude products in count query
    if (excludeProductList.length > 0) {
      const excludeConditions = excludeProductList.map(p => {
        countParams.push(`%${p}%`);
        return `s.product_text NOT ILIKE $${countParams.length}`;
      }).join(' AND ');
      countQuery += ` AND (${excludeConditions})`;
    }
    
    if (sn) {
      countParams.push(`%${sn}%`);
      countQuery += ` AND s.sn ILIKE $${countParams.length}`;
    }
    
    // Date filtering in count query (same as main query)
    if (etaFrom || etaTo) {
      if (etaFrom) {
        countParams.push(etaFrom);
        countQuery += ` AND s.eta >= $${countParams.length}`;
      }
      if (etaTo) {
        countParams.push(etaTo);
        countQuery += ` AND s.eta <= $${countParams.length}`;
      }
    } else {
      if (etaMonth) {
        const month = parseInt(etaMonth as string);
        if (month >= 1 && month <= 12) {
          countParams.push(month);
          countQuery += ` AND EXTRACT(MONTH FROM s.eta) = $${countParams.length}`;
        }
      }
      
      if (etaYear) {
        const year = parseInt(etaYear as string);
        if (year >= 2000 && year <= 2100) {
          countParams.push(year);
          countQuery += ` AND EXTRACT(YEAR FROM s.eta) = $${countParams.length}`;
        }
      }
    }
    
    // Numeric filtering in count query (same as main query)
    if (totalValue && totalValueOp && validOperators.includes(totalValueOp as string)) {
      const val = parseFloat(totalValue as string);
      if (!isNaN(val)) {
        countParams.push(val);
        countQuery += ` AND s.total_value_usd ${totalValueOp} $${countParams.length}`;
      }
    }
    
    if (containerCount && containerCountOp && validOperators.includes(containerCountOp as string)) {
      const val = parseInt(containerCount as string);
      if (!isNaN(val)) {
        countParams.push(val);
        countQuery += ` AND s.container_count ${containerCountOp} $${countParams.length}`;
      }
    }
    
    if (weight && weightOp && validOperators.includes(weightOp as string)) {
      const val = parseFloat(weight as string);
      if (!isNaN(val)) {
        countParams.push(val);
        countQuery += ` AND s.weight_ton ${weightOp} $${countParams.length}`;
      }
    }
    
    if (balance && balanceOp && validOperators.includes(balanceOp as string)) {
      const val = parseFloat(balance as string);
      if (!isNaN(val)) {
        countParams.push(val);
        countQuery += ` AND s.balance_value_usd ${balanceOp} $${countParams.length}`;
      }
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = Number(countResult.rows[0].count);
    
    res.json(createPaginatedResponse(result.rows, total, pagination));
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/suggestions - Get filter suggestions
// IMPORTANT: This must come BEFORE /:id route to avoid route conflicts
router.get('/suggestions', async (req, res, next) => {
  try {
    // Get active filters from query params
    const { origin, destination, product, shippingLine, valueRange, dateRange } = req.query;
    
    // Build dynamic WHERE conditions based on active filters
    const buildFilterConditions = (excludeField?: string) => {
      const conditions: string[] = ['1=1', '(s.status IS NULL OR s.status != \'delivered\')'];
      const params: any[] = [];
      
      if (origin && excludeField !== 'origin') {
        params.push(origin);
        conditions.push(`pol.name = $${params.length}`);
      }
      
      if (destination && excludeField !== 'destination') {
        params.push(destination);
        conditions.push(`pod.name = $${params.length}`);
      }
      
      if (product && excludeField !== 'product') {
        params.push(product);
        conditions.push(`s.product_text = $${params.length}`);
      }
      
      if (shippingLine && excludeField !== 'shippingLine') {
        params.push(shippingLine);
        conditions.push(`c.name = $${params.length}`);
      }
      
      if (valueRange) {
        const range = valueRange as string;
        if (range.startsWith('<')) {
          const value = parseInt(range.substring(1));
          conditions.push(`s.total_value_usd < ${value}`);
        } else if (range.startsWith('>')) {
          const value = parseInt(range.substring(1));
          conditions.push(`s.total_value_usd > ${value}`);
        } else if (range.includes('-')) {
          const [min, max] = range.split('-').map(v => parseInt(v));
          conditions.push(`s.total_value_usd BETWEEN ${min} AND ${max}`);
        }
      }
      
      if (dateRange) {
        const today = new Date();
        let etaFrom: Date | null = null;
        let etaTo: Date | null = null;
        
        switch (dateRange) {
          case 'thisMonth':
            etaFrom = new Date(today.getFullYear(), today.getMonth(), 1);
            etaTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
          case 'lastMonth':
            etaFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            etaTo = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
          case 'thisQuarter':
            const currentQuarter = Math.floor(today.getMonth() / 3);
            etaFrom = new Date(today.getFullYear(), currentQuarter * 3, 1);
            etaTo = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
            break;
          case 'thisYear':
            etaFrom = new Date(today.getFullYear(), 0, 1);
            etaTo = new Date(today.getFullYear(), 11, 31);
            break;
        }
        
        if (etaFrom && etaTo) {
          conditions.push(`s.eta BETWEEN '${etaFrom.toISOString().split('T')[0]}' AND '${etaTo.toISOString().split('T')[0]}'`);
        }
      }
      
      return { conditions: conditions.join(' AND '), params };
    };
    
    // Get top origins (POL) - exclude origin from filter
    const originsFilter = buildFilterConditions('origin');
    const topOriginsQuery = `
      SELECT pol.name, COUNT(*) as count
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE pol.name IS NOT NULL AND ${originsFilter.conditions}
      GROUP BY pol.name
      ORDER BY count DESC
      LIMIT 10
    `;
    
    // Get top destinations (POD) - exclude destination from filter
    const destinationsFilter = buildFilterConditions('destination');
    const topDestinationsQuery = `
      SELECT pod.name, COUNT(*) as count
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE pod.name IS NOT NULL AND ${destinationsFilter.conditions}
      GROUP BY pod.name
      ORDER BY count DESC
      LIMIT 10
    `;
    
    // Get top products - exclude product from filter
    const productsFilter = buildFilterConditions('product');
    const topProductsQuery = `
      SELECT product_text as name, COUNT(*) as count
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE product_text IS NOT NULL AND ${productsFilter.conditions}
      GROUP BY product_text
      ORDER BY count DESC
      LIMIT 10
    `;
    
    // Get shipping lines - exclude shippingLine from filter
    const shippingLinesFilter = buildFilterConditions('shippingLine');
    const shippingLinesQuery = `
      SELECT c.name, COUNT(*) as count
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE c.name IS NOT NULL AND ${shippingLinesFilter.conditions}
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const [topOrigins, topDestinations, topProducts, shippingLines] = await Promise.all([
      pool.query(topOriginsQuery, originsFilter.params),
      pool.query(topDestinationsQuery, destinationsFilter.params),
      pool.query(topProductsQuery, productsFilter.params),
      pool.query(shippingLinesQuery, shippingLinesFilter.params),
    ]);
    
    res.json({
      topOrigins: topOrigins.rows,
      topDestinations: topDestinations.rows,
      topProducts: topProducts.rows,
      shippingLines: shippingLines.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/autocomplete - Get autocomplete suggestions
router.get('/autocomplete', async (req, res, next) => {
  try {
    const { type, query } = req.query;
    
    if (!type || !query) {
      return res.status(400).json({ error: 'Type and query parameters required' });
    }
    
    const searchTerm = `%${query}%`;
    let results: any[] = [];
    
    switch (type) {
      case 'product':
        const normalizedProduct = searchTerm.replace(/%/g, '').replace(/[-_\s]/g, '').toLowerCase();
        const productResult = await pool.query(
          `SELECT DISTINCT product_text as value, COUNT(*) as frequency
           FROM logistics.v_shipments_complete
           WHERE REPLACE(REPLACE(REPLACE(LOWER(product_text), '-', ''), '_', ''), ' ', '') LIKE $1 OR
                 product_text ILIKE $2
             AND (status IS NULL OR status != 'delivered')
           GROUP BY product_text
           ORDER BY frequency DESC, product_text
           LIMIT 10`,
          [`%${normalizedProduct}%`, searchTerm]
        );
        results = productResult.rows;
        break;
        
      case 'port':
        const normalizedPort = searchTerm.replace(/%/g, '').replace(/[-_\s]/g, '').toLowerCase();
        const portResult = await pool.query(
          `SELECT DISTINCT p.id, 
                  p.name as value, 
                  p.country, 
                  1 as frequency
           FROM master_data.ports p
           WHERE REPLACE(REPLACE(REPLACE(LOWER(p.name), '-', ''), '_', ''), ' ', '') LIKE $1 OR
                 LOWER(p.name) LIKE LOWER($2)
           ORDER BY p.name
           LIMIT 15`,
          [`%${normalizedPort}%`, searchTerm]
        );
        results = portResult.rows;
        break;
        
      case 'shippingLine':
        const normalizedShipping = searchTerm.replace(/%/g, '').replace(/[-_\s]/g, '').toLowerCase();
        const shippingLineResult = await pool.query(
          `SELECT DISTINCT c.id, c.name as value, c.country, 1 as frequency
           FROM master_data.companies c
           WHERE c.is_shipping_line = true
             AND c.is_deleted = false
             AND (REPLACE(REPLACE(REPLACE(LOWER(c.name), '-', ''), '_', ''), ' ', '') LIKE $1 OR
                  LOWER(c.name) LIKE LOWER($2))
           ORDER BY c.name
           LIMIT 10`,
          [`%${normalizedShipping}%`, searchTerm]
        );
        results = shippingLineResult.rows;
        break;
        
      case 'supplier':
        const normalizedSupplier = searchTerm.replace(/%/g, '').replace(/[-_\s]/g, '').toLowerCase();
        const supplierResult = await pool.query(
          `SELECT DISTINCT c.id, c.name as value, c.country, 1 as frequency
           FROM master_data.companies c
           WHERE c.is_supplier = true
             AND c.is_deleted = false
             AND (REPLACE(REPLACE(REPLACE(LOWER(c.name), '-', ''), '_', ''), ' ', '') LIKE $1 OR
                  LOWER(c.name) LIKE LOWER($2))
           ORDER BY c.name
           LIMIT 10`,
          [`%${normalizedSupplier}%`, searchTerm]
        );
        results = supplierResult.rows;
        break;
        
      case 'customer':
        const normalizedCustomer = searchTerm.replace(/%/g, '').replace(/[-_\s]/g, '').toLowerCase();
        const customerResult = await pool.query(
          `SELECT DISTINCT c.id, c.name as value, c.country, 1 as frequency
           FROM master_data.companies c
           WHERE c.is_customer = true
             AND c.is_deleted = false
             AND (REPLACE(REPLACE(REPLACE(LOWER(c.name), '-', ''), '_', ''), ' ', '') LIKE $1 OR
                  LOWER(c.name) LIKE LOWER($2))
           ORDER BY c.name
           LIMIT 10`,
          [`%${normalizedCustomer}%`, searchTerm]
        );
        results = customerResult.rows;
        break;
        
      case 'contract':
        const normalizedContract = searchTerm.replace(/%/g, '').replace(/[-_\s]/g, '').toLowerCase();
        const contractResult = await pool.query(
          `SELECT 
             c.id, 
             c.contract_no as value, 
             c.status,
             b.name as buyer_name,
             s.name as seller_name,
             1 as frequency
           FROM logistics.contracts c
           LEFT JOIN master_data.companies b ON c.buyer_company_id = b.id
           LEFT JOIN master_data.companies s ON c.seller_company_id = s.id
           WHERE c.is_deleted = false
             AND (
               REPLACE(REPLACE(REPLACE(LOWER(c.contract_no), '-', ''), '_', ''), ' ', '') LIKE $1 OR
               LOWER(c.contract_no) LIKE LOWER($2)
             )
           ORDER BY c.created_at DESC
           LIMIT 15`,
          [`%${normalizedContract}%`, searchTerm]
        );
        results = contractResult.rows;
        break;
        
      case 'country':
        // Get unique countries from ports and companies
        const normalizedCountry = searchTerm.replace(/%/g, '').replace(/[-_\s]/g, '').toLowerCase();
        const countryResult = await pool.query(
          `SELECT DISTINCT country as value, COUNT(*) as frequency
           FROM (
             SELECT country FROM master_data.ports WHERE country IS NOT NULL
             UNION ALL
             SELECT country FROM master_data.companies WHERE country IS NOT NULL AND is_deleted = false
           ) countries
           WHERE REPLACE(REPLACE(REPLACE(LOWER(country), '-', ''), '_', ''), ' ', '') LIKE $1 OR
                 LOWER(country) LIKE LOWER($2)
           GROUP BY country
           ORDER BY frequency DESC, country
           LIMIT 15`,
          [`%${normalizedCountry}%`, searchTerm]
        );
        results = countryResult.rows;
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid type parameter' });
    }
    
    res.json({ suggestions: results });
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/compare - Compare shipments
router.get('/compare', async (req, res, next) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ error: 'ids parameter required (comma-separated)' });
    }
    
    const idList = (ids as string).split(',').map(id => id.trim());
    
    if (idList.length < 2 || idList.length > 5) {
      return res.status(400).json({ error: 'Please provide 2-5 shipment IDs to compare' });
    }
    
    const result = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, pol.country as pol_country,
        pod.name as pod_name, pod.country as pod_country,
        c.name as shipping_line_name
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.id = ANY($1)
      ORDER BY s.eta`,
      [idList]
    );
    
    res.json({ shipments: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/analytics/price-trends - Get price trends by product
router.get('/analytics/price-trends', async (req, res, next) => {
  try {
    const { product, startDate, endDate } = req.query;
    
    if (!product) {
      return res.status(400).json({ error: 'product parameter required' });
    }
    
    let query = `
      SELECT 
        DATE_TRUNC('month', eta) as month,
        product_text,
        AVG(fixed_price_usd_per_ton) as avg_price,
        MIN(fixed_price_usd_per_ton) as min_price,
        MAX(fixed_price_usd_per_ton) as max_price,
        COUNT(*) as shipment_count
      FROM logistics.v_shipments_complete
      WHERE (
        REPLACE(REPLACE(REPLACE(LOWER(product_text), '-', ''), '_', ''), ' ', '') LIKE $1 OR
        product_text ILIKE $2
      )
        AND fixed_price_usd_per_ton IS NOT NULL
        AND eta IS NOT NULL
    `;
    
    const normalizedProductPrice = (product as string).replace(/[-_\s]/g, '').toLowerCase();
    const params: any[] = [`%${normalizedProductPrice}%`, `%${product}%`];
    
    if (startDate) {
      params.push(startDate);
      query += ` AND eta >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND eta <= $${params.length}`;
    }
    
    query += `
      GROUP BY DATE_TRUNC('month', eta), product_text
      ORDER BY month DESC
      LIMIT 24
    `;
    
    const result = await pool.query(query, params);
    
    res.json({ trends: result.rows });
  } catch (error) {
    next(error);
  }
});

// Helper function to normalize port name (trim, title case)
function normalizePortName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Helper function to resolve or create port by name
async function resolveOrCreatePort(portValue: string | null): Promise<string | null> {
  if (!portValue) return null;
  
  // If it's already a valid UUID, return as-is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(portValue)) {
    return portValue;
  }
  
  // If it starts with "new:", extract the name and create new port
  let portName = portValue;
  if (portValue.startsWith('new:')) {
    portName = portValue.substring(4); // Remove "new:" prefix
  }
  
  // Normalize the port name (trim spaces, title case)
  portName = normalizePortName(portName);
  
  // Try to find existing port by name (case-insensitive, trim whitespace)
  const existingPort = await pool.query(
    `SELECT id FROM master_data.ports 
     WHERE LOWER(TRIM(name)) = LOWER($1)
     LIMIT 1`,
    [portName]
  );
  
  if (existingPort.rows.length > 0) {
    return existingPort.rows[0].id;
  }
  
  // Create new port with normalized name
  const newPort = await pool.query(
    `INSERT INTO master_data.ports (name) 
     VALUES ($1) 
     RETURNING id`,
    [portName]
  );
  
  logger.info(`✅ Created new port: ${portName} with ID: ${newPort.rows[0].id}`);
  return newPort.rows[0].id;
}

// Helper function to resolve or create shipping line (company) by name
async function resolveOrCreateShippingLine(shippingLineValue: string | null): Promise<string | null> {
  if (!shippingLineValue) return null;
  
  // If it's already a valid UUID, return as-is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(shippingLineValue)) {
    return shippingLineValue;
  }
  
  // If it starts with "new:", extract the name and create new shipping line
  let shippingLineName = shippingLineValue;
  if (shippingLineValue.startsWith('new:')) {
    shippingLineName = shippingLineValue.substring(4); // Remove "new:" prefix
  }
  
  // Try to find existing shipping line by name (case-insensitive)
  const existingShippingLine = await pool.query(
    `SELECT id FROM master_data.companies 
     WHERE LOWER(name) = LOWER($1)
     LIMIT 1`,
    [shippingLineName]
  );
  
  if (existingShippingLine.rows.length > 0) {
    // If company exists but isn't marked as shipping line, update it
    await pool.query(
      `UPDATE master_data.companies SET is_shipping_line = true WHERE id = $1`,
      [existingShippingLine.rows[0].id]
    );
    return existingShippingLine.rows[0].id;
  }
  
  // Create new shipping line company
  const newShippingLine = await pool.query(
    `INSERT INTO master_data.companies (name, is_shipping_line) 
     VALUES ($1, true) 
     RETURNING id`,
    [shippingLineName]
  );
  
  logger.info(`✅ Created new shipping line: ${shippingLineName} with ID: ${newShippingLine.rows[0].id}`);
  return newShippingLine.rows[0].id;
}

// Helper function to resolve or create supplier (company) by name
async function resolveOrCreateSupplier(supplierValue: string | null): Promise<string | null> {
  if (!supplierValue) return null;
  
  // If it's already a valid UUID, return as-is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(supplierValue)) {
    return supplierValue;
  }
  
  // If it starts with "new:", extract the name and create new supplier
  let supplierName = supplierValue;
  if (supplierValue.startsWith('new:')) {
    supplierName = supplierValue.substring(4); // Remove "new:" prefix
  }
  
  // Try to find existing supplier by name (case-insensitive)
  const existingSupplier = await pool.query(
    `SELECT id FROM master_data.companies 
     WHERE LOWER(name) = LOWER($1)
     LIMIT 1`,
    [supplierName]
  );
  
  if (existingSupplier.rows.length > 0) {
    // If company exists but isn't marked as supplier, update it
    await pool.query(
      `UPDATE master_data.companies SET is_supplier = true WHERE id = $1`,
      [existingSupplier.rows[0].id]
    );
    return existingSupplier.rows[0].id;
  }
  
  // Create new supplier company
  const newSupplier = await pool.query(
    `INSERT INTO master_data.companies (name, is_supplier) 
     VALUES ($1, true) 
     RETURNING id`,
    [supplierName]
  );
  
  logger.info(`✅ Created new supplier: ${supplierName} with ID: ${newSupplier.rows[0].id}`);
  return newSupplier.rows[0].id;
}

// Helper function to resolve or create customer (company) by name
async function resolveOrCreateCustomer(customerValue: string | null): Promise<string | null> {
  if (!customerValue) return null;
  
  // If it's already a valid UUID, return as-is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(customerValue)) {
    return customerValue;
  }
  
  // If it starts with "new:", extract the name and create new customer
  let customerName = customerValue;
  if (customerValue.startsWith('new:')) {
    customerName = customerValue.substring(4); // Remove "new:" prefix
  }
  
  // Try to find existing customer by name (case-insensitive)
  const existingCustomer = await pool.query(
    `SELECT id FROM master_data.companies 
     WHERE LOWER(name) = LOWER($1)
     LIMIT 1`,
    [customerName]
  );
  
  if (existingCustomer.rows.length > 0) {
    // If company exists but isn't marked as customer, update it
    await pool.query(
      `UPDATE master_data.companies SET is_customer = true WHERE id = $1`,
      [existingCustomer.rows[0].id]
    );
    return existingCustomer.rows[0].id;
  }
  
  // Create new customer company
  const newCustomer = await pool.query(
    `INSERT INTO master_data.companies (name, is_customer) 
     VALUES ($1, true) 
     RETURNING id`,
    [customerName]
  );
  
  logger.info(`✅ Created new customer: ${customerName} with ID: ${newCustomer.rows[0].id}`);
  return newCustomer.rows[0].id;
}

// PUT /api/shipments/:id - Update existing shipment
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { changed_by = 'system' } = updateData;

    // Debug logging
    logger.info('📦 PUT /api/shipments/:id - Received update data:', {
      id,
      customs_clearance_date: updateData.customs_clearance_date,
      has_customs_field: updateData.hasOwnProperty('customs_clearance_date'),
      pol_id: updateData.pol_id,
      pod_id: updateData.pod_id,
      all_fields: Object.keys(updateData)
    });

    // Handle port creation for new ports (prefixed with "new:")
    if (updateData.pol_id) {
      updateData.pol_id = await resolveOrCreatePort(updateData.pol_id);
    }
    if (updateData.pod_id) {
      updateData.pod_id = await resolveOrCreatePort(updateData.pod_id);
    }
    
    // Handle shipping line creation for new shipping lines (prefixed with "new:")
    if (updateData.shipping_line_id) {
      updateData.shipping_line_id = await resolveOrCreateShippingLine(updateData.shipping_line_id);
    }
    
    // Handle supplier creation for new suppliers (prefixed with "new:")
    if (updateData.supplier_id) {
      updateData.supplier_id = await resolveOrCreateSupplier(updateData.supplier_id);
    }
    
    // Handle customer creation for new customers (prefixed with "new:")
    if (updateData.customer_id) {
      updateData.customer_id = await resolveOrCreateCustomer(updateData.customer_id);
    }

    // Check if shipment exists and get current values for audit log
    // Using unified view to get all fields from normalized tables
    const existingShipment = await pool.query(
      'SELECT * FROM logistics.v_shipments_complete WHERE id = $1',
      [id]
    );

    if (existingShipment.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'Shipment not found' 
      });
    }
    
    const oldValues = existingShipment.rows[0];

    // Map fields to their normalized tables
    // NOTE: 'status' is REMOVED - status is auto-calculated by shipmentStatusEngine
    const fieldTableMap: Record<string, string> = {
      // Core shipments fields (status excluded - auto-calculated)
      'sn': 'shipments', 'subject': 'shipments', 'notes': 'shipments',
      'paperwork_status': 'shipments', 'transaction_type': 'shipments', 'contract_id': 'shipments',
      // Party fields
      'supplier_id': 'shipment_parties', 'customer_id': 'shipment_parties', 
      'buyer_id': 'shipment_parties', 'buyer_name': 'shipment_parties',
      'shipping_line_id': 'shipment_parties', 'has_broker': 'shipment_parties', 'broker_name': 'shipment_parties',
      // Cargo fields (NOTE: lines, containers, batches now handled via normalized tables, not JSONB)
      'product_text': 'shipment_cargo', 'cargo_type': 'shipment_cargo', 'tanker_type': 'shipment_cargo',
      'container_count': 'shipment_cargo', 'truck_count': 'shipment_cargo', 'weight_ton': 'shipment_cargo', 'weight_unit': 'shipment_cargo',
      'weight_unit_custom': 'shipment_cargo', 'barrels': 'shipment_cargo', 'bags_count': 'shipment_cargo',
      'gross_weight_kg': 'shipment_cargo', 'net_weight_kg': 'shipment_cargo',
      'is_split_shipment': 'shipment_cargo', 'country_of_export': 'shipment_cargo',
      // Logistics fields (includes agreed_shipping_date for status engine)
      'pol_id': 'shipment_logistics', 'pod_id': 'shipment_logistics', 'eta': 'shipment_logistics', 'etd': 'shipment_logistics',
      'free_time_days': 'shipment_logistics', 'customs_clearance_date': 'shipment_logistics', 'agreed_shipping_date': 'shipment_logistics',
      'booking_no': 'shipment_logistics', 'bl_no': 'shipment_logistics', 'bol_numbers': 'shipment_logistics',
      'vessel_name': 'shipment_logistics', 'vessel_imo': 'shipment_logistics',
      'tanker_name': 'shipment_logistics', 'tanker_imo': 'shipment_logistics',
      'truck_plate_number': 'shipment_logistics', 'cmr': 'shipment_logistics',
      'has_final_destination': 'shipment_logistics', 'final_destination': 'shipment_logistics',
      'is_cross_border': 'shipment_logistics', 'primary_border_crossing_id': 'shipment_logistics',
      'internal_transport_mode': 'shipment_logistics', 'clearance_category': 'shipment_logistics',
      // Financial fields
      'fixed_price_usd_per_ton': 'shipment_financials', 'fixed_price_usd_per_barrel': 'shipment_financials',
      'selling_price_usd_per_ton': 'shipment_financials', 'selling_price_usd_per_barrel': 'shipment_financials',
      'currency_code': 'shipment_financials', 'usd_equivalent_rate': 'shipment_financials',
      'transportation_cost': 'shipment_financials', 'transport_cost_responsibility': 'shipment_financials',
      'down_payment_type': 'shipment_financials', 'down_payment_percentage': 'shipment_financials', 'down_payment_amount': 'shipment_financials',
      'payment_method': 'shipment_financials', 'payment_method_other': 'shipment_financials',
      'swift_code': 'shipment_financials', 'lc_number': 'shipment_financials', 'lc_issuing_bank': 'shipment_financials',
      'lc_type': 'shipment_financials', 'lc_expiry_date': 'shipment_financials',
      'payment_term_days': 'shipment_financials', 'transfer_reference': 'shipment_financials',
      'beneficiary_name': 'shipment_financials', 'beneficiary_bank_name': 'shipment_financials',
      'beneficiary_bank_address': 'shipment_financials', 'beneficiary_account_number': 'shipment_financials',
      'beneficiary_iban': 'shipment_financials', 'intermediary_bank': 'shipment_financials',
      'payment_schedule': 'shipment_financials', 'additional_costs': 'shipment_financials', 'payment_beneficiaries': 'shipment_financials',
      // Turkish customs fields
      'price_on_paper_usd': 'shipment_financials', 'price_on_paper_try': 'shipment_financials',
      'tax_usd': 'shipment_financials', 'tax_try': 'shipment_financials',
    };

    // NOTE: lines, containers, batches removed - now handled via normalized tables
    const jsonbFields = ['payment_schedule', 'additional_costs', 'payment_beneficiaries', 'bol_numbers', 'final_destination', 'documents'];
    const updatableFields = Object.keys(fieldTableMap);
    
    // Group fields by table
    const tableUpdates: Record<string, { fields: string[], values: any[] }> = {
      'shipments': { fields: [], values: [] },
      'shipment_parties': { fields: [], values: [] },
      'shipment_cargo': { fields: [], values: [] },
      'shipment_logistics': { fields: [], values: [] },
      'shipment_financials': { fields: [], values: [] },
    };
    
    // Categorize fields by table
    for (const field of updatableFields) {
      if (updateData.hasOwnProperty(field)) {
        const table = fieldTableMap[field];
        if (table && tableUpdates[table]) {
          const paramNum = tableUpdates[table].values.length + 1;
          tableUpdates[table].fields.push(`${field} = $${paramNum}`);
          
          // Handle JSONB fields
          if (jsonbFields.includes(field)) {
            tableUpdates[table].values.push(JSON.stringify(updateData[field]));
          } else {
            tableUpdates[table].values.push(updateData[field] === '' ? null : updateData[field]);
          }
        }
      }
    }
    
    // Check if any fields to update
    const totalFields = Object.values(tableUpdates).reduce((sum, t) => sum + t.fields.length, 0);
    if (totalFields === 0) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'No fields to update' 
      });
    }

    // Execute updates in a transaction
    const updatedShipment = await withTransaction(async (client) => {
      // Update each table that has changes
      for (const [table, data] of Object.entries(tableUpdates)) {
        if (data.fields.length > 0) {
          // Add updated_at and shipment_id param
          const paramNum = data.values.length + 1;
          data.fields.push(`updated_at = NOW()`);
          data.values.push(id);
          
          const whereClause = table === 'shipments' ? `id = $${paramNum}` : `shipment_id = $${paramNum}`;
          const query = `UPDATE logistics.${table} SET ${data.fields.join(', ')} WHERE ${whereClause}`;
          
          logger.info(`🔧 Updating ${table}:`, { fields: data.fields.length - 1 });
          await client.query(query, data.values);
        }
      }

      // ========== NORMALIZED TABLES: Handle lines, containers, batches ==========
      
      // Handle product lines - delete existing and insert new
      if (updateData.lines && Array.isArray(updateData.lines)) {
        logger.info(`🔧 Updating shipment_lines: ${updateData.lines.length} lines`);
        await client.query('DELETE FROM logistics.shipment_lines WHERE shipment_id = $1', [id]);
        
        for (const line of updateData.lines) {
          await client.query(`
            INSERT INTO logistics.shipment_lines (
              shipment_id, product_id, contract_line_id, type_of_goods, product_name,
              brand, trademark, country_of_origin, kind_of_packages, number_of_packages, package_size,
              package_size_unit, unit_size, qty, quantity_mt, quantity_kg,
              pricing_method, unit_price, rate_usd_per_mt, currency_code, amount_usd,
              bags_count, marks, notes, volume_cbm, volume_liters,
              number_of_barrels, number_of_pallets, number_of_containers,
              tolerance_percentage, description, hs_code, category, uom, extra_json,
              created_by, updated_by
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
              $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
              $31, $32, $33, $34, $35, $36, $37
            )
          `, [
            id,
            line.product_id || null,
            line.contract_line_id || null,
            line.type_of_goods || null,
            line.product_name || null,
            line.brand || null,
            line.trademark || null,
            line.country_of_origin || null,
            line.kind_of_packages || null,
            line.number_of_packages || null,
            line.package_size || null,
            line.package_size_unit || null,
            line.unit_size || null,
            line.qty || line.quantity || null,
            line.quantity_mt || null,
            line.quantity_kg || null,
            line.pricing_method || null,
            line.unit_price || null,
            line.rate_usd_per_mt || null,
            line.currency_code || 'USD',
            line.amount_usd || null,
            line.bags_count || null,
            line.marks || null,
            line.notes || null,
            line.volume_cbm || null,
            line.volume_liters || null,
            line.number_of_barrels || null,
            line.number_of_pallets || null,
            line.number_of_containers || null,
            line.tolerance_percentage || null,
            line.description || null,
            line.hs_code || null,
            line.category || null,
            line.uom || 'MT',
            JSON.stringify(line.extra_json || {}),
            changed_by,
            changed_by
          ]);
        }
        
        // Recalculate and update total_value_usd from product lines
        // This ensures consistency with the frontend calculation in Step2ProductLines.tsx
        const calculatedTotalValueUsd = updateData.lines.reduce((sum: number, line: any) => {
          return sum + (Number(line.amount_usd) || 0);
        }, 0);
        logger.info(`💰 Recalculated total_value_usd from ${updateData.lines.length} lines: ${calculatedTotalValueUsd}`);
        
        await client.query(
          `UPDATE logistics.shipment_financials SET total_value_usd = $1, updated_at = NOW() WHERE shipment_id = $2`,
          [calculatedTotalValueUsd, id]
        );
      }

      // Handle containers - delete existing and insert new
      if (updateData.containers && Array.isArray(updateData.containers)) {
        logger.info(`🔧 Updating shipment_containers: ${updateData.containers.length} containers`);
        await client.query('DELETE FROM logistics.shipment_containers WHERE shipment_id = $1', [id]);
        
        for (const container of updateData.containers) {
          await client.query(`
            INSERT INTO logistics.shipment_containers (
              shipment_id, container_no, container_number, size_code,
              seal_no, seal_number, gross_weight_kg, net_weight_kg,
              tare_weight_kg, bags_count, package_count, notes, extra_json,
              created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            id,
            container.container_no || container.container_number || null,
            container.container_number || null,
            container.size_code || null,
            container.seal_no || container.seal_number || null,
            container.seal_number || null,
            container.gross_weight_kg || null,
            container.net_weight_kg || null,
            container.tare_weight_kg || null,
            container.bags_count || null,
            container.package_count || null,
            container.notes || null,
            JSON.stringify(container.extra_json || {}),
            changed_by,
            changed_by
          ]);
        }
        
        // SYNC: Update container_count in shipment_cargo to match actual containers
        await client.query(`
          UPDATE logistics.shipment_cargo
          SET container_count = $1, updated_at = NOW()
          WHERE shipment_id = $2
        `, [updateData.containers.length, id]);
        logger.info(`✅ Synced container_count to ${updateData.containers.length}`);
      }

      // Handle batches - delete existing and insert new
      if (updateData.batches && Array.isArray(updateData.batches)) {
        logger.info(`🔧 Updating shipment_batches: ${updateData.batches.length} batches`);
        await client.query('DELETE FROM logistics.shipment_batches WHERE shipment_id = $1', [id]);
        
        for (const batch of updateData.batches) {
          await client.query(`
            INSERT INTO logistics.shipment_batches (
              shipment_id, batch_number, batch_name, quantity_mt, weight_kg,
              packages_count, bags_count, container_numbers, notes, extra_json,
              created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            id,
            batch.batch_number || null,
            batch.batch_name || null,
            batch.quantity_mt || null,
            batch.weight_kg || null,
            batch.packages_count || null,
            batch.bags_count || null,
            batch.container_numbers || null,
            batch.notes || null,
            JSON.stringify(batch.extra_json || {}),
            changed_by,
            changed_by
          ]);
        }
      }
      
      // Fetch updated shipment from view
      const result = await client.query(
        'SELECT * FROM logistics.v_shipments_complete WHERE id = $1',
        [id]
      );
      return result.rows[0];
    });

    // Log changes to audit log
    const changedFields = updatableFields.filter(field => {
      if (!updateData.hasOwnProperty(field)) return false;
      const oldVal = oldValues[field];
      const newVal = updateData[field];
      // Compare values (handle nulls and JSON fields)
      if (oldVal === newVal) return false;
      if (oldVal == null && newVal === '') return false;
      if (typeof oldVal === 'object' && typeof newVal === 'object') {
        return JSON.stringify(oldVal) !== JSON.stringify(newVal);
      }
      return true;
    });
    
    // Log each changed field with note indicating shipment-level change
    // This helps distinguish changes made via shipment edit from contract-level changes
    const auditNote = updatedShipment.contract_id 
      ? `Shipment-level change (SN: ${updatedShipment.sn || id}). Contract values remain unchanged.`
      : null;
    
    for (const field of changedFields) {
      const oldVal = oldValues[field];
      const newVal = updateData[field];
      
      await pool.query(
        `SELECT logistics.log_change($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'shipment',
          id,
          field,
          oldVal ? String(oldVal) : null,
          newVal ? String(newVal) : null,
          'updated',
          'manual',
          changed_by,
          auditNote, // notes - indicates this is a shipment-level change
          updatedShipment.contract_id, // related_contract_id
          id, // related_shipment_id
        ]
      );
    }

    // Fetch the complete shipment with joined data
    const shipment = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, 
        pol.country as pol_country,
        pod.name as pod_name,
        pod.country as pod_country,
        c.name as shipping_line_name
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.id = $1`,
      [id]
    );

    // Auto-recalculate status if any status-relevant fields changed
    const statusChangedFields = Object.keys(updateData);
    if (shouldRecalculateStatus(statusChangedFields)) {
      try {
        const user = (req as AuthRequest).user;
        const statusResult = await recalculateShipmentStatus(id, user?.username || 'api');
        if (statusResult) {
          logger.info(`📊 Status recalculated for ${id}: ${statusResult.status} - ${statusResult.reason}`);
        }
      } catch (statusError) {
        logger.error('Error recalculating shipment status:', statusError);
        // Don't fail the update if status calculation fails
      }
    }
    
    // Trigger notification check after update
    notificationService.checkShipmentNotifications(id).catch(err => {
      logger.error('Error generating notifications for updated shipment:', err);
    });

    // Re-fetch shipment to include updated status and document count
    const finalShipment = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, pol.country as pol_country,
        pod.name as pod_name, pod.country as pod_country,
        c.name as shipping_line_name,
        (SELECT COUNT(*) FROM archive.documents d WHERE d.shipment_id = s.id AND (d.is_deleted IS NULL OR d.is_deleted = false)) as document_count
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.id = $1`,
      [id]
    );

    res.json(finalShipment.rows[0] || shipment.rows[0]);
  } catch (error) {
    logger.error('Error updating shipment:', error);
    next(error);
  }
});

// GET /api/shipments/:id - Get single shipment by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, pol.country as pol_country,
        pod.name as pod_name, pod.country as pod_country,
        c.name as shipping_line_name,
        c.country as shipping_line_country,
        (SELECT COUNT(*) FROM archive.documents d WHERE d.shipment_id = s.id AND (d.is_deleted IS NULL OR d.is_deleted = false)) as document_count
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.id = $1`,
      [id]
    );
    
    const shipment = result.rows.length > 0 ? result.rows[0] : null;
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    res.json(shipment);
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/sn/:sn - Get shipments by contract number
router.get('/sn/:sn', async (req, res, next) => {
  try {
    const { sn } = req.params;
    
    const result = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, pol.country as pol_country,
        pod.name as pod_name, pod.country as pod_country,
        c.name as shipping_line_name
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.sn = $1
      ORDER BY s.created_at DESC`,
      [sn]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No shipments found with this contract number' });
    }
    
    res.json({
      sn,
      count: result.rows.length,
      shipments: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/:id/transfers - Get transfers for a shipment
router.get('/:id/transfers', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM finance.transfers 
       WHERE shipment_id = $1 
       ORDER BY transfer_date DESC`,
      [id]
    );
    
    res.json({
      shipment_id: id,
      count: result.rows.length,
      transfers: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/:id/contract-comparison - Get full contract vs shipment comparison
router.get('/:id/contract-comparison', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verify shipment exists
    const shipmentCheck = await pool.query(
      'SELECT id, contract_id, sn FROM logistics.shipments WHERE id = $1',
      [id]
    );
    
    if (shipmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    const shipment = shipmentCheck.rows[0];
    
    // Get comprehensive comparison using the database function
    const comparisonResult = await pool.query(
      'SELECT report.get_contract_shipment_comparison_json($1::uuid) AS comparison',
      [id]
    );
    
    const comparison = comparisonResult.rows[0]?.comparison || {
      has_contract: false,
      shipment_id: id,
      header: [],
      lines: []
    };
    
    // Get audit history for this shipment-contract pair
    let changeHistory: any[] = [];
    if (shipment.contract_id) {
      const historyResult = await pool.query(
        `SELECT 
          cal.*,
          c.contract_no,
          s.sn as shipment_sn,
          p_contract.name as contract_product_name,
          p_shipment.name as shipment_product_name
        FROM logistics.change_audit_log cal
        LEFT JOIN logistics.contracts c ON c.id = cal.related_contract_id
        LEFT JOIN logistics.v_shipments_complete s ON s.id = cal.related_shipment_id
        LEFT JOIN logistics.contract_lines cl ON cl.id = cal.entity_id AND cal.entity_type = 'contract_line'
        LEFT JOIN master_data.products p_contract ON p_contract.id = cl.product_id
        LEFT JOIN logistics.shipment_lines sl ON sl.id = cal.entity_id AND cal.entity_type = 'shipment_line'
        LEFT JOIN master_data.products p_shipment ON p_shipment.id = sl.product_id
        WHERE cal.related_shipment_id = $1
          OR (cal.related_contract_id = $2 AND cal.related_shipment_id IS NOT NULL)
        ORDER BY cal.changed_at DESC
        LIMIT 100`,
        [id, shipment.contract_id]
      );
      changeHistory = historyResult.rows;
    }
    
    res.json({
      shipment_id: id,
      shipment_sn: shipment.sn,
      contract_id: shipment.contract_id,
      ...comparison,
      change_history: changeHistory
    });
  } catch (error) {
    logger.error('Error fetching contract comparison:', error);
    next(error);
  }
});

// POST /api/shipments/:id/milestone - Add milestone to shipment
router.post('/:id/milestone', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, notes } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Milestone code is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO logistics.milestones (shipment_id, code, notes, ts)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [id, code, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/shipments - Create new shipment
router.post('/', async (req, res, next) => {
  try {
    const { 
      transaction_type,
      sn,
      subject,
      product_text, 
      contract_id,
      supplier_id,
      supplier_name,
      customer_id,
      customer_name,
      // Buyer/Importer fields
      buyer_id,
      buyer_name,
      container_count, 
      weight_ton,
      fixed_price_usd_per_ton, 
      pol_id, 
      pod_id, 
      eta,
      etd,
      shipping_line_id,
      booking_no, 
      bl_no, 
      notes,
      free_time_days,
      customs_clearance_date,
      // Batch/Split Shipment fields
      is_split_shipment,
      batches,
      // Additional fields
      has_sales_contract,
      has_broker,
      broker_name,
      cargo_type,
      truck_count,
      lines,
      containers,
      vessel_name,
      incoterms,
      payment_method,
      lc_number,
      lc_issuing_bank,
      lc_type,
      lc_expiry_date,
      payment_term_days,
      transfer_reference,
      transportation_cost,
      transport_cost_responsibility,
      // Internal route fields
      is_cross_border,
      primary_border_crossing_id,
      internal_transport_mode,
      has_final_destination,
      final_destination,
      // Export country field (country of port of loading)
      country_of_export,
      // Selling workflow fields (for outgoing shipments)
      transport_mode,
      selling_status,
      source_imports,
      beyaname_number,
      beyaname_date,
      beyaname_status,
      // Selling costs - Sea
      vgm_cost,
      fumigation_cost,
      container_loading_cost,
      port_handling_cost,
      sea_freight_cost,
      customs_export_cost,
      sea_insurance_cost,
      // Selling costs - Land
      truck_transport_cost,
      loading_unloading_cost,
      border_crossing_cost,
      land_customs_cost,
      transit_fees_cost,
      land_insurance_cost,
      total_selling_costs
    } = req.body;

    // Validation
    if (!sn || !product_text) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'SN and product are required fields' 
      });
    }

    // Validate transaction_type if provided
    const shipmentTransactionType = transaction_type || 'incoming'; // Default to incoming (purchase)
    if (!['incoming', 'outgoing'].includes(shipmentTransactionType)) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'Transaction type must be either "incoming" (purchase) or "outgoing" (sale)' 
      });
    }
    
    // ========== SMART LOGIC VALIDATION ==========
    // Run validation for illogical data combinations
    const logicValidation = validateShipmentLogic({
      cargo_type,
      container_count,
      truck_count,
      weight_ton,
      etd,
      eta,
      customs_clearance_date,
      payment_method,
      lc_number,
      lc_expiry_date,
      fixed_price_usd_per_ton,
      lines,
    });
    
    // Block on hard errors
    if (!logicValidation.valid) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Shipment data contains logic errors',
        validationErrors: logicValidation.errors,
      });
    }
    
    // Log warnings (but allow the shipment to proceed)
    if (logicValidation.warnings.length > 0) {
      logger.info(`⚠️ Shipment ${sn} created with ${logicValidation.warnings.length} warning(s):`,
        logicValidation.warnings.map(w => w.message)
      );
    }

    // Resolve or create ports if provided (handle "new:PortName" format)
    let resolvedPolId = pol_id;
    if (pol_id) {
      resolvedPolId = await resolveOrCreatePort(pol_id);
    }
    
    let resolvedPodId = pod_id;
    if (pod_id) {
      resolvedPodId = await resolveOrCreatePort(pod_id);
    }
    
    // Resolve or create shipping line if provided
    let resolvedShippingLineId = shipping_line_id;
    if (shipping_line_id) {
      resolvedShippingLineId = await resolveOrCreateShippingLine(shipping_line_id);
    }
    
    // Resolve or create supplier if provided (handles "new:SupplierName" format)
    let resolvedSupplierId = supplier_id;
    if (supplier_id) {
      resolvedSupplierId = await resolveOrCreateSupplier(supplier_id);
    }
    
    // Resolve or create customer if provided (handles "new:CustomerName" format)
    let resolvedCustomerId = customer_id;
    if (customer_id) {
      resolvedCustomerId = await resolveOrCreateCustomer(customer_id);
    }

    // ========== PARTIAL SHIPMENT VALIDATION ==========
    // Check if any lines exceed their pending quantities (warning only, not blocking)
    const fulfillmentWarnings: Array<{
      contract_line_id: string;
      product_name: string;
      contracted_mt: number;
      already_shipped_mt: number;
      pending_mt: number;
      requested_mt: number;
      excess_mt: number;
    }> = [];

    if (contract_id && lines && Array.isArray(lines) && lines.length > 0) {
      // Get fulfillment status for all contract lines
      const fulfillmentResult = await pool.query(
        `SELECT 
          cl.id as contract_line_id,
          COALESCE(cl.type_of_goods, cl.product_name, 'Unknown Product') as product_name,
          COALESCE(cl.quantity_mt, 0) as contracted_mt,
          COALESCE(shipped.shipped_mt, 0) as already_shipped_mt,
          COALESCE(cl.quantity_mt, 0) - COALESCE(shipped.shipped_mt, 0) as pending_mt
         FROM logistics.contract_lines cl
         LEFT JOIN LATERAL (
           SELECT SUM(COALESCE(sl.quantity_mt, sl.qty, 0)) as shipped_mt
           FROM logistics.shipment_lines sl
           JOIN logistics.shipments s ON sl.shipment_id = s.id AND s.is_deleted = false
           WHERE sl.contract_line_id = cl.id
         ) shipped ON true
         WHERE cl.contract_id = $1`,
        [contract_id]
      );

      const fulfillmentMap = new Map(
        fulfillmentResult.rows.map((row: any) => [row.contract_line_id, row])
      );

      // Check each line that has a contract_line_id
      for (const line of lines) {
        if (line.contract_line_id) {
          const fulfillment = fulfillmentMap.get(line.contract_line_id);
          if (fulfillment) {
            const requestedMt = parseFloat(line.quantity_mt) || parseFloat(line.qty) || 0;
            const pendingMt = parseFloat(fulfillment.pending_mt) || 0;
            
            if (requestedMt > pendingMt && pendingMt >= 0) {
              fulfillmentWarnings.push({
                contract_line_id: line.contract_line_id,
                product_name: fulfillment.product_name,
                contracted_mt: parseFloat(fulfillment.contracted_mt) || 0,
                already_shipped_mt: parseFloat(fulfillment.already_shipped_mt) || 0,
                pending_mt: pendingMt,
                requested_mt: requestedMt,
                excess_mt: requestedMt - pendingMt,
              });
            }
          }
        }
      }

      if (fulfillmentWarnings.length > 0) {
        logger.info(`⚠️ Shipment exceeds pending quantities for ${fulfillmentWarnings.length} line(s):`, 
          fulfillmentWarnings.map(w => `${w.product_name}: ${w.requested_mt}/${w.pending_mt} MT`)
        );
      }
    }

    // Insert shipment using normalized tables structure
    // Use a transaction to ensure all inserts succeed or none do
    const client = await pool.connect();
    let result;
    
    try {
      await client.query('BEGIN');
      
      // 1. Insert core fields into shipments table
      const createdByUsername = (req as any).user?.username || null;
      const createdByUserId = (req as any).user?.id || null;
      
      const shipmentResult = await client.query(
        `INSERT INTO logistics.shipments 
         (sn, subject, notes, contract_id, status, transaction_type, has_sales_contract, selling_status, transport_mode, created_by, created_by_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'planning', $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING id`,
        [
          sn,
          subject || null,
          notes || null,
          contract_id || null,
          shipmentTransactionType,
          has_sales_contract || null,
          shipmentTransactionType === 'outgoing' ? (selling_status || 'draft') : null,
          transport_mode || null,
          createdByUsername,
          createdByUserId
        ]
      );
      const shipmentId = shipmentResult.rows[0].id;
      
      // 2. Insert party fields into shipment_parties
      await client.query(
        `INSERT INTO logistics.shipment_parties 
         (shipment_id, supplier_id, customer_id, buyer_id, buyer_name, shipping_line_id, has_broker, broker_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          shipmentId,
          resolvedSupplierId || null,
          resolvedCustomerId || null,
          buyer_id || null,
          buyer_name || null,
          resolvedShippingLineId || null,
          has_broker || false,
          broker_name || null
        ]
      );
      
      // 3. Insert cargo fields into shipment_cargo (lines, containers, batches now in normalized tables)
      await client.query(
        `INSERT INTO logistics.shipment_cargo 
         (shipment_id, product_text, container_count, truck_count, weight_ton, cargo_type, is_split_shipment, country_of_export, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          shipmentId,
          product_text,
          container_count || null,
          truck_count || null,
          weight_ton || null,
          cargo_type || null,
          is_split_shipment || false,
          country_of_export || null
        ]
      );
      
      // 4. Insert logistics fields into shipment_logistics (includes agreed_shipping_date for status engine)
      await client.query(
        `INSERT INTO logistics.shipment_logistics 
         (shipment_id, pol_id, pod_id, eta, etd, vessel_name, incoterms, booking_no, bl_no, free_time_days, 
          customs_clearance_date, agreed_shipping_date, has_final_destination, final_destination, is_cross_border, primary_border_crossing_id, internal_transport_mode, clearance_category, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())`,
        [
          shipmentId,
          resolvedPolId || null,  // Use resolved port ID (handles "new:PortName" format)
          resolvedPodId || null,  // Use resolved port ID (handles "new:PortName" format)
          eta || null,
          etd || null,
          vessel_name || null,
          incoterms || null,
          booking_no || null,
          bl_no || null,
          free_time_days || null,
          customs_clearance_date || null,
          req.body.agreed_shipping_date || null,  // For status engine delay detection
          has_final_destination || false,
          final_destination ? JSON.stringify(final_destination) : null,
          is_cross_border || false,
          primary_border_crossing_id || null,
          internal_transport_mode || null,
          req.body.clearance_category || null,  // Transit, Domestic, or Custom Clearance
        ]
      );
      
      // 5. Insert financial fields into shipment_financials
      // Calculate total_value_usd from product lines (sum of all line.amount_usd)
      // This ensures consistency with the frontend calculation in Step2ProductLines.tsx
      let calculatedTotalValueUsd: number | null = null;
      if (lines && Array.isArray(lines) && lines.length > 0) {
        calculatedTotalValueUsd = lines.reduce((sum: number, line: any) => {
          return sum + (Number(line.amount_usd) || 0);
        }, 0);
        logger.info(`💰 Calculated total_value_usd from ${lines.length} lines: ${calculatedTotalValueUsd}`);
      }
      
      await client.query(
        `INSERT INTO logistics.shipment_financials 
         (shipment_id, fixed_price_usd_per_ton, payment_method, lc_number, lc_issuing_bank, lc_type, lc_expiry_date, 
          payment_term_days, transfer_reference, transportation_cost, transport_cost_responsibility, total_value_usd,
          vgm_cost, fumigation_cost, container_loading_cost, port_handling_cost, sea_freight_cost, customs_export_cost, sea_insurance_cost,
          truck_transport_cost, loading_unloading_cost, border_crossing_cost, land_customs_cost, transit_fees_cost, land_insurance_cost, total_selling_costs,
          created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW())`,
        [
          shipmentId,
          fixed_price_usd_per_ton || null,
          payment_method || null,
          lc_number || null,
          lc_issuing_bank || null,
          lc_type || null,
          lc_expiry_date || null,
          payment_term_days || null,
          transfer_reference || null,
          transportation_cost || null,
          transport_cost_responsibility || null,
          calculatedTotalValueUsd,
          // Selling costs - Sea
          vgm_cost || null,
          fumigation_cost || null,
          container_loading_cost || null,
          port_handling_cost || null,
          sea_freight_cost || null,
          customs_export_cost || null,
          sea_insurance_cost || null,
          // Selling costs - Land
          truck_transport_cost || null,
          loading_unloading_cost || null,
          border_crossing_cost || null,
          land_customs_cost || null,
          transit_fees_cost || null,
          land_insurance_cost || null,
          total_selling_costs || null
        ]
      );
      
      // 6. Insert document record for shipment_documents (with beyaname fields for outgoing)
      await client.query(
        `INSERT INTO logistics.shipment_documents 
         (shipment_id, beyaname_number, beyaname_date, beyaname_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [
          shipmentId,
          beyaname_number || null,
          beyaname_date || null,
          beyaname_status || null
        ]
      );

      // ========== NORMALIZED TABLES: Insert lines, containers, batches ==========
      const created_by = (req as any).user?.username || 'api';
      
      // 7. Insert product lines into shipment_lines
      if (lines && Array.isArray(lines) && lines.length > 0) {
        logger.info(`📦 Inserting ${lines.length} product lines for shipment ${shipmentId}`);
        for (const line of lines) {
          await client.query(`
            INSERT INTO logistics.shipment_lines (
              shipment_id, product_id, contract_line_id, type_of_goods, product_name,
              brand, trademark, country_of_origin, kind_of_packages, number_of_packages, package_size,
              package_size_unit, unit_size, qty, quantity_mt, quantity_kg,
              pricing_method, unit_price, rate_usd_per_mt, currency_code, amount_usd,
              bags_count, marks, notes, volume_cbm, volume_liters,
              number_of_barrels, number_of_pallets, number_of_containers,
              tolerance_percentage, description, hs_code, category, uom, extra_json,
              created_by, updated_by
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
              $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
              $31, $32, $33, $34, $35, $36, $37
            )
          `, [
            shipmentId,
            line.product_id || null,
            line.contract_line_id || null,
            line.type_of_goods || null,
            line.product_name || null,
            line.brand || null,
            line.trademark || null,
            line.country_of_origin || null,
            line.kind_of_packages || null,
            line.number_of_packages || null,
            line.package_size || null,
            line.package_size_unit || null,
            line.unit_size || null,
            line.qty || line.quantity || null,
            line.quantity_mt || null,
            line.quantity_kg || null,
            line.pricing_method || null,
            line.unit_price || null,
            line.rate_usd_per_mt || null,
            line.currency_code || 'USD',
            line.amount_usd || null,
            line.bags_count || null,
            line.marks || null,
            line.notes || null,
            line.volume_cbm || null,
            line.volume_liters || null,
            line.number_of_barrels || null,
            line.number_of_pallets || null,
            line.number_of_containers || null,
            line.tolerance_percentage || null,
            line.description || null,
            line.hs_code || null,
            line.category || null,
            line.uom || 'MT',
            JSON.stringify(line.extra_json || {}),
            created_by,
            created_by
          ]);
        }
      }

      // 8. Insert containers into shipment_containers
      if (containers && Array.isArray(containers) && containers.length > 0) {
        logger.info(`📦 Inserting ${containers.length} containers for shipment ${shipmentId}`);
        for (const container of containers) {
          await client.query(`
            INSERT INTO logistics.shipment_containers (
              shipment_id, container_no, container_number, size_code,
              seal_no, seal_number, gross_weight_kg, net_weight_kg,
              tare_weight_kg, bags_count, package_count, notes, extra_json,
              created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            shipmentId,
            container.container_no || container.container_number || null,
            container.container_number || null,
            container.size_code || null,
            container.seal_no || container.seal_number || null,
            container.seal_number || null,
            container.gross_weight_kg || null,
            container.net_weight_kg || null,
            container.tare_weight_kg || null,
            container.bags_count || null,
            container.package_count || null,
            container.notes || null,
            JSON.stringify(container.extra_json || {}),
            created_by,
            created_by
          ]);
        }
        
        // SYNC: Update container_count in shipment_cargo to match actual containers
        await client.query(`
          UPDATE logistics.shipment_cargo
          SET container_count = $1, updated_at = NOW()
          WHERE shipment_id = $2
        `, [containers.length, shipmentId]);
        logger.info(`✅ Synced container_count to ${containers.length}`);
      }

      // 9. Insert batches into shipment_batches
      if (batches && Array.isArray(batches) && batches.length > 0) {
        logger.info(`📦 Inserting ${batches.length} batches for shipment ${shipmentId}`);
        for (const batch of batches) {
          await client.query(`
            INSERT INTO logistics.shipment_batches (
              shipment_id, batch_number, batch_name, quantity_mt, weight_kg,
              packages_count, bags_count, container_numbers, notes, extra_json,
              created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            shipmentId,
            batch.batch_number || null,
            batch.batch_name || null,
            batch.quantity_mt || null,
            batch.weight_kg || null,
            batch.packages_count || null,
            batch.bags_count || null,
            batch.container_numbers || null,
            batch.notes || null,
            JSON.stringify(batch.extra_json || {}),
            created_by,
            created_by
          ]);
        }
      }

      // 10. Insert sale-import links for outgoing shipments
      if (shipmentTransactionType === 'outgoing' && source_imports && Array.isArray(source_imports) && source_imports.length > 0) {
        logger.info(`📦 Inserting ${source_imports.length} sale-import links for shipment ${shipmentId}`);
        for (const link of source_imports) {
          // Get the source CI number if not provided
          let sourceCiNumber = link.source_ci_number;
          if (!sourceCiNumber && link.source_shipment_id) {
            const sourceResult = await client.query(
              'SELECT sn FROM logistics.shipments WHERE id = $1',
              [link.source_shipment_id]
            );
            if (sourceResult.rows.length > 0) {
              sourceCiNumber = sourceResult.rows[0].sn;
            }
          }
          
          await client.query(`
            INSERT INTO logistics.sale_import_links (
              sale_shipment_id, source_shipment_id, source_ci_number, 
              quantity_sold, quantity_unit, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            shipmentId,
            link.source_shipment_id,
            sourceCiNumber || null,
            link.quantity_sold || 0,
            link.quantity_unit || 'MT',
            link.notes || null,
            createdByUserId
          ]);
        }
      }
      
      await client.query('COMMIT');
      result = { rows: [{ id: shipmentId }] };
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // ========== AUTO-COMPLETE CONTRACT IF FULLY SHIPPED ==========
    // Check if this shipment is linked to a contract and if contract is now fully shipped
    if (contract_id) {
      try {
        // Calculate fulfillment status for the contract
        const fulfillmentResult = await pool.query(
          `SELECT 
            SUM(COALESCE(cl.quantity_mt, 0)) as total_contracted_mt,
            SUM(COALESCE(shipped.shipped_mt, 0)) as total_shipped_mt
           FROM logistics.contract_lines cl
           LEFT JOIN LATERAL (
             SELECT SUM(COALESCE(sl.quantity_mt, sl.qty, 0)) as shipped_mt
             FROM logistics.shipment_lines sl
             JOIN logistics.shipments s ON sl.shipment_id = s.id AND s.is_deleted = false
             WHERE sl.contract_line_id = cl.id
           ) shipped ON true
           WHERE cl.contract_id = $1`,
          [contract_id]
        );
        
        if (fulfillmentResult.rows.length > 0) {
          const { total_contracted_mt, total_shipped_mt } = fulfillmentResult.rows[0];
          const contracted = parseFloat(total_contracted_mt) || 0;
          const shipped = parseFloat(total_shipped_mt) || 0;
          
          // If fully shipped (shipped >= contracted), auto-mark contract as FULFILLED
          if (contracted > 0 && shipped >= contracted) {
            await pool.query(
              `UPDATE logistics.contracts 
               SET status = 'FULFILLED', updated_at = NOW(), updated_by = $1 
               WHERE id = $2 AND status NOT IN ('FULFILLED', 'COMPLETED', 'CANCELLED') AND is_deleted = false`,
              [(req as any).user?.username || 'system', contract_id]
            );
            logger.info(`📋 Contract ${contract_id} auto-fulfilled - fully shipped (${shipped}/${contracted} MT)`);
          }
        }
      } catch (autoCompleteError) {
        // Log but don't fail the shipment creation
        logger.error('Warning: Failed to check/update contract fulfillment status:', autoCompleteError);
      }
    }

    // Fetch the complete shipment with joined data
    const shipment = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, 
        pol.country as pol_country,
        pod.name as pod_name,
        pod.country as pod_country,
        c.name as shipping_line_name
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.id = $1`,
      [result.rows[0]?.id]
    );
    
    // Get shipment ID
    const shipmentId = result.rows[0]?.id;
    if (!shipmentId) {
      return res.status(500).json({ error: 'Failed to create shipment' });
    }
    
    // Auto-calculate initial status based on provided data
    try {
      const user = (req as AuthRequest).user;
      const statusResult = await recalculateShipmentStatus(shipmentId, user?.username || 'api');
      if (statusResult) {
        logger.info(`📊 Initial status calculated for ${shipmentId}: ${statusResult.status} - ${statusResult.reason}`);
      }
    } catch (statusError) {
      logger.error('Error calculating initial shipment status:', statusError);
      // Don't fail shipment creation if status calculation fails
    }
    
    // Trigger immediate notification check for new shipment
    notificationService.checkShipmentNotifications(shipmentId).catch(err => {
      logger.error('Error generating notifications for new shipment:', err);
    });
    
    // Include fulfillment warnings in response if any
    const responseData = {
      ...shipment.rows[0],
      ...(fulfillmentWarnings.length > 0 && {
        _fulfillment_warnings: fulfillmentWarnings,
        _warning_message: `This shipment exceeds pending quantities for ${fulfillmentWarnings.length} line(s). The contract may be over-shipped.`,
      }),
    };
    
    res.status(201).json(responseData);
  } catch (error) {
    next(error);
  }
});

// ========== NEW CONTRACT-BASED ENDPOINTS ==========

// POST /api/shipments - Enhanced with contract_id support
// Note: The existing POST endpoint above needs to be updated to resolve contract_no to contract_id
// TODO: Update the POST handler to include contract resolution logic

// GET /api/shipments/:id/lines - Get shipment lines (multi-product support)
router.get('/:id/lines', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify shipment exists
    const shipmentCheck = await pool.query(
      'SELECT id FROM logistics.shipments WHERE id = $1',
      [id]
    );

    if (shipmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Get shipment lines
    // IMPORTANT: Use stored amount_usd which is pre-calculated with correct pricing method
    // (per_mt, per_package, per_barrel, etc.) and multi-currency conversion
    const result = await pool.query(
      `
      SELECT 
        sl.*,
        p.name as product_name,
        p.hs_code,
        p.category,
        COALESCE(sl.amount_usd, sl.qty * sl.unit_price) as line_total
      FROM logistics.shipment_lines sl
      LEFT JOIN master_data.products p ON sl.product_id = p.id
      WHERE sl.shipment_id = $1
      ORDER BY sl.created_at
      `,
      [id]
    );

    // Use amount_usd (pre-calculated) for total, fallback to line_total if needed
    const total_value = result.rows.reduce(
      (sum: number, line: any) => sum + parseFloat(line.amount_usd || line.line_total || 0),
      0
    );

    res.json({
      shipment_id: id,
      count: result.rows.length,
      lines: result.rows,
      total_value,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/shipments/:id/lines - Add shipment lines
router.post('/:id/lines', async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { lines } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Lines array is required' });
    }

    // Verify shipment exists
    const shipmentCheck = await client.query(
      'SELECT id FROM logistics.shipments WHERE id = $1',
      [id]
    );

    if (shipmentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Insert each line
    const insertedLines = [];
    for (const line of lines) {
      const result = await client.query(
        `
        INSERT INTO logistics.shipment_lines (
          shipment_id, product_id, unit_size, qty,
          unit_price, currency_code, bags_count, notes, extra_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          id,
          line.product_id,
          line.unit_size,
          line.qty,
          line.unit_price,
          line.currency_code || 'USD',
          line.bags_count,
          line.notes,
          JSON.stringify(line.extra_json || {}),
        ]
      );
      insertedLines.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      shipment_id: id,
      count: insertedLines.length,
      lines: insertedLines,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// GET /api/shipments/:id/containers - Get shipment containers
router.get('/:id/containers', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT * FROM logistics.shipment_containers
      WHERE shipment_id = $1
      ORDER BY created_at
      `,
      [id]
    );

    res.json({
      shipment_id: id,
      count: result.rows.length,
      containers: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/shipments/:id/containers - Add shipment containers
router.post('/:id/containers', async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { containers } = req.body;

    if (!containers || !Array.isArray(containers) || containers.length === 0) {
      return res.status(400).json({ error: 'Containers array is required' });
    }

    // Verify shipment exists
    const shipmentCheck = await client.query(
      'SELECT id FROM logistics.shipments WHERE id = $1',
      [id]
    );

    if (shipmentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Insert each container
    const insertedContainers = [];
    for (const container of containers) {
      const result = await client.query(
        `
        INSERT INTO logistics.shipment_containers (
          shipment_id, container_no, size_code, seal_no,
          gross_weight_kg, net_weight_kg, bags_count, notes, extra_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          id,
          container.container_no,
          container.size_code,
          container.seal_no,
          container.gross_weight_kg,
          container.net_weight_kg,
          container.bags_count,
          container.notes,
          JSON.stringify(container.extra_json || {}),
        ]
      );
      insertedContainers.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      shipment_id: id,
      count: insertedContainers.length,
      containers: insertedContainers,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Helper function: Resolve contract_no to contract_id
async function resolveContractId(contractNoOrId: string): Promise<string | null> {
  try {
    // Check if it's already a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(contractNoOrId)) {
      // Verify it exists
      const result = await pool.query(
        'SELECT id FROM logistics.contracts WHERE id = $1 AND is_deleted = false',
        [contractNoOrId]
      );
      return result.rows.length > 0 ? contractNoOrId : null;
    }

    // Try to find by contract_no
    const result = await pool.query(
      'SELECT id FROM logistics.contracts WHERE contract_no = $1 AND is_deleted = false',
      [contractNoOrId]
    );

    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch (error) {
    logger.error('Error resolving contract:', error);
    return null;
  }
}

// ========== POST /api/shipments/:id/lines/link - Link shipment lines to contract lines ==========

router.post('/:id/lines/link', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { links } = req.body;

    if (!links || !Array.isArray(links)) {
      return res.status(400).json({
        error: 'links array is required',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate shipment exists and get its contract_id
    const shipmentResult = await pool.query(
      'SELECT id, contract_id FROM logistics.shipments WHERE id = $1',
      [id]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Shipment not found',
        timestamp: new Date().toISOString(),
      });
    }

    const shipmentContractId = shipmentResult.rows[0].contract_id;

    // Validate all links and check they belong to the same contract
    for (const link of links) {
      if (!link.line_id || !link.contract_line_id) {
        return res.status(400).json({
          error: 'Each link must have line_id and contract_line_id',
          timestamp: new Date().toISOString(),
        });
      }

      // Verify shipment line belongs to this shipment
      const shipmentLineResult = await pool.query(
        'SELECT id FROM logistics.shipment_lines WHERE id = $1 AND shipment_id = $2',
        [link.line_id, id]
      );

      if (shipmentLineResult.rows.length === 0) {
        return res.status(400).json({
          error: `Shipment line ${link.line_id} not found or does not belong to this shipment`,
          timestamp: new Date().toISOString(),
        });
      }

      // Verify contract line belongs to the shipment's contract
      const contractLineResult = await pool.query(
        'SELECT id, contract_id FROM logistics.contract_lines WHERE id = $1',
        [link.contract_line_id]
      );

      if (contractLineResult.rows.length === 0) {
        return res.status(400).json({
          error: `Contract line ${link.contract_line_id} not found`,
          timestamp: new Date().toISOString(),
        });
      }

      if (shipmentContractId && contractLineResult.rows[0].contract_id !== shipmentContractId) {
        return res.status(400).json({
          error: `Contract line ${link.contract_line_id} does not belong to shipment's contract`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update shipment lines with contract_line_id
    const updatePromises = links.map((link: any) =>
      pool.query(
        `UPDATE logistics.shipment_lines 
         SET contract_line_id = $1, updated_at = NOW(), updated_by = 'api' 
         WHERE id = $2`,
        [link.contract_line_id, link.line_id]
      )
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      linked_count: links.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ========== POST /api/shipments/extract-from-bol - AI BOL Document Extraction ==========

router.post(
  '/extract-from-bol',
  upload.single('file'),
  async (req, res, next) => {
    logger.info('🚀 BOL Extract endpoint hit!');
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

      logger.info(`📄 Processing BOL file: ${req.file.originalname}`);

      // Dynamically import the extraction service
      const { processBOLDocument } = await import('../services/documentExtraction');

      // Process the BOL document
      const result = await processBOLDocument(req.file.path, {
        collectTrainingData: true,
        userId: (req as any).user?.id,
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
              uploaded_by,
              document_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
              'BOL', // Document type for BOL extraction
            ]
          );
        } catch (logError) {
          logger.warn('Failed to log BOL extraction to database:', logError);
          // Don't fail the request if logging fails
        }
      }

      // Cleanup uploaded file after processing
      fs.unlink(req.file.path).catch(err => 
        logger.warn('Failed to cleanup uploaded BOL file:', err)
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
          ? 'BOL document processed successfully'
          : 'BOL document processing failed',
      });
      
    } catch (error: any) {
      logger.error('❌ BOL Extraction endpoint error:', error);
      
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

// ========== POST /api/shipments/extract-from-ci - AI Commercial Invoice Document Extraction ==========

router.post(
  '/extract-from-ci',
  upload.single('file'),
  async (req, res, next) => {
    logger.info('🚀 Commercial Invoice Extract endpoint hit!');
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

      logger.info(`📄 Processing Commercial Invoice file: ${req.file.originalname}`);

      // Dynamically import the extraction service
      const { processCommercialInvoiceDocument } = await import('../services/documentExtraction');

      // Process the Commercial Invoice document
      const result = await processCommercialInvoiceDocument(req.file.path, {
        collectTrainingData: true,
        userId: (req as any).user?.id,
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
              uploaded_by,
              document_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
              'COMMERCIAL_INVOICE', // Document type for Commercial Invoice extraction
            ]
          );
        } catch (logError) {
          logger.warn('Failed to log Commercial Invoice extraction to database:', logError);
          // Don't fail the request if logging fails
        }
      }

      // Cleanup uploaded file after processing
      fs.unlink(req.file.path).catch(err => 
        logger.warn('Failed to cleanup uploaded Commercial Invoice file:', err)
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
          ? 'Commercial Invoice document processed successfully'
          : 'Commercial Invoice document processing failed',
      });
      
    } catch (error: any) {
      logger.error('❌ Commercial Invoice Extraction endpoint error:', error);
      
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

// GET /api/shipments/:id/summary - Get lightweight shipment summary for hover popup
router.get('/:id/summary', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        s.id,
        s.sn,
        s.product_text,
        s.weight_ton,
        s.container_count,
        s.total_value_usd,
        s.fixed_price_usd_per_ton,
        s.selling_price_usd_per_ton,
        s.transaction_type,
        s.status,
        pol.name AS pol_name,
        pol.country AS pol_country,
        pod.name AS pod_name,
        pod.country AS pod_country,
        sp.supplier_id,
        sup.name AS supplier_name,
        sp.final_beneficiary_name,
        s.final_destination->>'name' AS final_destination_name,
        s.final_destination->>'delivery_place' AS delivery_place
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON sp.supplier_id = sup.id
      WHERE s.id = $1 AND s.is_deleted = false
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    const row = result.rows[0];
    
    res.json({
      id: row.id,
      sn: row.sn,
      product_text: row.product_text,
      weight_ton: parseFloat(row.weight_ton) || 0,
      container_count: row.container_count || 0,
      total_value_usd: parseFloat(row.total_value_usd) || 0,
      fixed_price_usd_per_ton: parseFloat(row.fixed_price_usd_per_ton) || null,
      selling_price_usd_per_ton: parseFloat(row.selling_price_usd_per_ton) || null,
      transaction_type: row.transaction_type,
      status: row.status,
      source: {
        pol_name: row.pol_name,
        pol_country: row.pol_country,
        supplier_name: row.supplier_name,
      },
      destination: {
        pod_name: row.pod_name,
        pod_country: row.pod_country,
        final_beneficiary: row.final_beneficiary_name || row.final_destination_name,
        delivery_place: row.delivery_place,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/shipments/:id - Soft delete a shipment
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedBy = (req as any).user?.username || 'system';
    const deletedByUserId = (req as any).user?.id || null;

    // Check if shipment exists
    const checkResult = await pool.query(
      'SELECT id, sn FROM logistics.shipments WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = checkResult.rows[0];

    // Soft delete the shipment
    await pool.query(
      `UPDATE logistics.shipments 
       SET is_deleted = true, 
           deleted_at = NOW(), 
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, deletedBy]
    );

    logger.info(`🗑️ Shipment ${shipment.sn} (${id}) soft-deleted by ${deletedBy}`);

    res.json({ 
      success: true, 
      message: `Shipment ${shipment.sn} has been deleted`,
      id: id 
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/shipments/bulk - Bulk soft delete shipments
router.delete('/bulk', async (req, res, next) => {
  try {
    const { ids } = req.body;
    const deletedBy = (req as any).user?.username || 'system';

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No shipment IDs provided' });
    }

    // Soft delete all shipments
    const result = await pool.query(
      `UPDATE logistics.shipments 
       SET is_deleted = true, 
           deleted_at = NOW(), 
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = ANY($1) AND is_deleted = false
       RETURNING id, sn`,
      [ids, deletedBy]
    );

    logger.info(`🗑️ Bulk deleted ${result.rowCount} shipments by ${deletedBy}`);

    res.json({ 
      success: true, 
      message: `${result.rowCount} shipment(s) have been deleted`,
      deleted: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    next(error);
  }
});


// ========== SHIPMENT STATUS ENGINE ENDPOINTS ==========

// GET /api/shipments/:id/status - Get shipment status with explanation
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const { loadShipmentStatusData, calculateShipmentStatus, getStatusDisplayInfo } = await import('../services/shipmentStatusEngine');
    
    const data = await loadShipmentStatusData(id);
    if (!data) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    const result = calculateShipmentStatus(data);
    const displayInfo = getStatusDisplayInfo(result.status);
    
    res.json({
      shipment_id: id,
      status: result.status,
      status_label: displayInfo.label,
      status_label_ar: displayInfo.label_ar,
      status_color: displayInfo.color,
      status_order: displayInfo.order,
      reason: result.reason,
      reason_ar: result.reason_ar,
      description: displayInfo.description,
      description_ar: displayInfo.description_ar,
      trigger_type: result.trigger_type,
      data: result.data_snapshot
    });
  } catch (error) {
    next(error);
  }
});


// POST /api/shipments/:id/warehouse-receipt - Confirm warehouse receipt (event-based status trigger)
// This is the ONLY way to transition a shipment to 'received' or 'quality_issue' status
router.post('/:id/warehouse-receipt', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { has_issues, notes } = req.body;
    const user = (req as AuthRequest).user;
    
    if (typeof has_issues !== 'boolean') {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'has_issues must be a boolean (true for issues, false for no issues)'
      });
    }
    
    // Verify shipment exists and is in valid state for warehouse receipt
    const shipmentCheck = await pool.query(
      `SELECT s.id, s.status, d.warehouse_receipt_confirmed
       FROM logistics.shipments s
       LEFT JOIN logistics.shipment_documents d ON d.shipment_id = s.id
       WHERE s.id = $1 AND s.is_deleted = FALSE`,
      [id]
    );
    
    if (shipmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    const shipment = shipmentCheck.rows[0];
    
    // Check if already confirmed
    if (shipment.warehouse_receipt_confirmed) {
      return res.status(400).json({
        error: 'Already Confirmed',
        message: 'Warehouse receipt has already been confirmed for this shipment'
      });
    }
    
    // Confirm warehouse receipt (this will auto-calculate status)
    const { confirmWarehouseReceipt } = await import('../services/shipmentStatusEngine');
    const result = await confirmWarehouseReceipt(
      id,
      has_issues,
      user?.id || 'system',
      notes
    );
    
    logger.info(`📦 Warehouse receipt confirmed for ${id}: ${has_issues ? 'WITH ISSUES' : 'OK'} → ${result.status}`);
    
    // Return updated shipment
    const updatedShipment = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, pol.country as pol_country,
        pod.name as pod_name, pod.country as pod_country,
        c.name as shipping_line_name
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      message: has_issues 
        ? 'Warehouse receipt confirmed with issues. Status updated to Quality Issue.'
        : 'Warehouse receipt confirmed. Status updated to Received.',
      shipment: updatedShipment.rows[0],
      status_result: {
        status: result.status,
        reason: result.reason,
        trigger_type: result.trigger_type
      }
    });
  } catch (error) {
    next(error);
  }
});


// POST /api/shipments/:id/override-status - Manual status override with required reason
// Allows users to temporarily override automatic status. System can still recalculate later.
router.post('/:id/override-status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const user = (req as AuthRequest).user;
    
    // Validate required fields
    if (!status) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'status is required'
      });
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'reason is required and must be at least 10 characters. Please explain why you are overriding the status.'
      });
    }
    
    // Validate status is a valid value
    const validStatuses = ['planning', 'delayed', 'sailed', 'awaiting_clearance', 'loaded_to_final', 'received', 'quality_issue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Verify shipment exists
    const shipmentCheck = await pool.query(
      'SELECT id, status FROM logistics.shipments WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );
    
    if (shipmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    const previousStatus = shipmentCheck.rows[0].status;
    
    // Perform manual override
    const { manualStatusOverride } = await import('../services/shipmentStatusEngine');
    const result = await manualStatusOverride(
      id,
      status,
      reason.trim(),
      user?.username || user?.id || 'api'
    );
    
    logger.info(`📝 Manual status override: ${id} ${previousStatus} → ${status} by ${user?.username}`);
    
    // Return updated shipment
    const updatedShipment = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, pol.country as pol_country,
        pod.name as pod_name, pod.country as pod_country,
        c.name as shipping_line_name
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      message: `Status manually overridden to "${status}". This override is temporary - the system may recalculate later when data changes.`,
      shipment: updatedShipment.rows[0],
      override: {
        previous_status: previousStatus,
        new_status: result.status,
        reason: result.reason,
        overridden_by: user?.username,
        overridden_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    if (error.message?.includes('at least 10 characters')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    next(error);
  }
});


// POST /api/shipments/:id/clear-override - Clear manual override and return to automatic status
router.post('/:id/clear-override', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    
    // Verify shipment exists and has an override
    const shipmentCheck = await pool.query(
      'SELECT id, status, status_override_by FROM logistics.shipments WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );
    
    if (shipmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    if (!shipmentCheck.rows[0].status_override_by) {
      return res.status(400).json({ 
        error: 'No Override',
        message: 'This shipment does not have a manual override to clear'
      });
    }
    
    const previousStatus = shipmentCheck.rows[0].status;
    
    // Clear override and recalculate
    const { clearManualOverride } = await import('../services/shipmentStatusEngine');
    const result = await clearManualOverride(id, user?.username || 'api');
    
    if (!result) {
      return res.status(500).json({ error: 'Failed to recalculate status' });
    }
    
    logger.info(`🔄 Manual override cleared: ${id} ${previousStatus} → ${result.status} (auto-calculated)`);
    
    // Return updated shipment
    const updatedShipment = await pool.query(
      `SELECT s.*,
        pol.name as pol_name, pol.country as pol_country,
        pod.name as pod_name, pod.country as pod_country,
        c.name as shipping_line_name
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies c ON s.shipping_line_id = c.id
      WHERE s.id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Manual override cleared. Status has been recalculated automatically.',
      shipment: updatedShipment.rows[0],
      status_result: {
        previous_status: previousStatus,
        new_status: result.status,
        reason: result.reason,
        trigger_type: result.trigger_type
      }
    });
  } catch (error) {
    next(error);
  }
});


// POST /api/shipments/:id/recalculate-status - Force status recalculation (admin/debug)
router.post('/:id/recalculate-status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    
    const result = await recalculateShipmentStatus(id, user?.username || 'api');
    
    if (!result) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    res.json({
      success: true,
      shipment_id: id,
      status: result.status,
      reason: result.reason,
      trigger_type: result.trigger_type
    });
  } catch (error) {
    next(error);
  }
});


// GET /api/shipments/:id/status-history - Get status change history
router.get('/:id/status-history', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        id,
        previous_status,
        new_status,
        status_reason,
        trigger_type,
        trigger_details,
        calculated_at,
        calculated_by
      FROM logistics.shipment_status_audit
      WHERE shipment_id = $1
      ORDER BY calculated_at DESC
      LIMIT 50
    `, [id]);
    
    res.json({
      shipment_id: id,
      history: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});


export default router;


