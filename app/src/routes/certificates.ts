/**
 * Certificates API Routes
 * Handles certificate templates, sale certificates, and sale-import linkages
 * Part of the selling workflow system
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';
import { parsePagination, createPaginatedResponse } from '../utils/pagination';

const router = Router();

// ============================================
// CERTIFICATE TEMPLATES
// ============================================

/**
 * GET /api/certificates/templates - List all certificate templates
 */
router.get('/templates', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, active_only = 'true' } = req.query;
    
    let query = `
      SELECT 
        id, name, name_ar, certificate_type, description,
        template_content, template_variables, is_active,
        created_at, updated_at
      FROM logistics.certificate_templates
      WHERE is_deleted = FALSE
    `;
    const params: any[] = [];
    
    if (active_only === 'true') {
      query += ' AND is_active = TRUE';
    }
    
    if (type) {
      params.push(type);
      query += ` AND certificate_type = $${params.length}`;
    }
    
    query += ' ORDER BY certificate_type, name';
    
    const result = await pool.query(query, params);
    
    res.json({
      templates: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/certificates/templates/:id - Get single template
 */
router.get('/templates/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM logistics.certificate_templates WHERE id = $1 AND is_deleted = FALSE`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/certificates/templates - Create certificate template
 */
router.post('/templates', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    const {
      name,
      name_ar,
      certificate_type,
      description,
      template_content,
      template_variables,
      is_active = true
    } = req.body;
    
    // Validate required fields
    if (!name || !certificate_type || !template_content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, certificate_type, and template_content are required'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO logistics.certificate_templates 
        (name, name_ar, certificate_type, description, template_content, template_variables, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, name_ar, certificate_type, description, template_content, 
       JSON.stringify(template_variables || []), is_active, user?.id]
    );
    
    logger.info(`Certificate template created: ${result.rows[0].id} - ${name}`);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/certificates/templates/:id - Update certificate template
 */
router.put('/templates/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const {
      name,
      name_ar,
      certificate_type,
      description,
      template_content,
      template_variables,
      is_active
    } = req.body;
    
    // Check template exists
    const existing = await pool.query(
      'SELECT id FROM logistics.certificate_templates WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const result = await pool.query(
      `UPDATE logistics.certificate_templates 
       SET name = COALESCE($1, name),
           name_ar = COALESCE($2, name_ar),
           certificate_type = COALESCE($3, certificate_type),
           description = COALESCE($4, description),
           template_content = COALESCE($5, template_content),
           template_variables = COALESCE($6, template_variables),
           is_active = COALESCE($7, is_active),
           updated_by = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, name_ar, certificate_type, description, template_content,
       template_variables ? JSON.stringify(template_variables) : null, 
       is_active, user?.id, id]
    );
    
    logger.info(`Certificate template updated: ${id}`);
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/certificates/templates/:id - Soft delete template
 */
router.delete('/templates/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    
    const result = await pool.query(
      `UPDATE logistics.certificate_templates 
       SET is_deleted = TRUE, updated_by = $1, updated_at = NOW()
       WHERE id = $2 AND is_deleted = FALSE
       RETURNING id`,
      [user?.id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    logger.info(`Certificate template deleted: ${id}`);
    
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SALE CERTIFICATES (Generated from templates)
// ============================================

/**
 * GET /api/certificates/shipment/:shipmentId - Get certificates for a shipment
 */
router.get('/shipment/:shipmentId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shipmentId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        sc.*,
        ct.name as template_name,
        ct.name_ar as template_name_ar
       FROM logistics.sale_certificates sc
       LEFT JOIN logistics.certificate_templates ct ON ct.id = sc.template_id
       WHERE sc.shipment_id = $1 AND sc.is_deleted = FALSE
       ORDER BY sc.created_at DESC`,
      [shipmentId]
    );
    
    res.json({
      certificates: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/certificates/generate - Generate certificate from template
 */
router.post('/generate', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    const {
      shipment_id,
      template_id,
      certificate_type,
      certificate_number,
      variables, // Object with variable values like { product_name: "Rice", quantity: 100 }
      issued_date,
      expiry_date,
      issued_by
    } = req.body;
    
    // Validate required fields
    if (!shipment_id || !certificate_type) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'shipment_id and certificate_type are required'
      });
    }
    
    // Get template if provided
    let templateContent = '';
    if (template_id) {
      const templateResult = await pool.query(
        'SELECT template_content FROM logistics.certificate_templates WHERE id = $1 AND is_deleted = FALSE',
        [template_id]
      );
      
      if (templateResult.rows.length > 0) {
        templateContent = templateResult.rows[0].template_content;
      }
    }
    
    // Process template variables
    let content = templateContent;
    if (variables && typeof variables === 'object') {
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(placeholder, String(value || ''));
      }
    }
    
    const result = await pool.query(
      `INSERT INTO logistics.sale_certificates
        (shipment_id, template_id, certificate_type, certificate_number, content, 
         issued_date, expiry_date, issued_by, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
       RETURNING *`,
      [shipment_id, template_id, certificate_type, certificate_number, content,
       issued_date, expiry_date, issued_by, user?.id]
    );
    
    logger.info(`Certificate generated for shipment ${shipment_id}: ${certificate_type}`);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/certificates/:id - Update certificate
 */
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const {
      certificate_number,
      content,
      issued_date,
      expiry_date,
      issued_by,
      status,
      s3_key
    } = req.body;
    
    const result = await pool.query(
      `UPDATE logistics.sale_certificates
       SET certificate_number = COALESCE($1, certificate_number),
           content = COALESCE($2, content),
           issued_date = COALESCE($3, issued_date),
           expiry_date = COALESCE($4, expiry_date),
           issued_by = COALESCE($5, issued_by),
           status = COALESCE($6, status),
           s3_key = COALESCE($7, s3_key),
           updated_by = $8,
           updated_at = NOW()
       WHERE id = $9 AND is_deleted = FALSE
       RETURNING *`,
      [certificate_number, content, issued_date, expiry_date, issued_by, status, s3_key, user?.id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    logger.info(`Certificate updated: ${id}`);
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/certificates/:id - Soft delete certificate
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    
    const result = await pool.query(
      `UPDATE logistics.sale_certificates
       SET is_deleted = TRUE, updated_by = $1, updated_at = NOW()
       WHERE id = $2 AND is_deleted = FALSE
       RETURNING id`,
      [user?.id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    res.json({ success: true, message: 'Certificate deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SALE-IMPORT LINKS (Quantity Tracking)
// ============================================

/**
 * GET /api/certificates/source-imports - Get available source imports for sales
 * Returns imports with remaining quantities available for sale
 * Searches by: SN, subject, booking number, BL number, product text, supplier name
 */
router.get('/source-imports', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, min_remaining = '0' } = req.query;
    
    logger.info(`Searching source imports: search="${search}", min_remaining=${min_remaining}`);
    
    // Check if sale_import_links table exists (migration might not have run)
    let saleLinksTableExists = false;
    try {
      await pool.query(`SELECT 1 FROM logistics.sale_import_links LIMIT 1`);
      saleLinksTableExists = true;
    } catch (e) {
      logger.warn('sale_import_links table does not exist yet - returning all shipments without sold quantity tracking');
    }
    
    // Build query - handle case where sale_import_links table might not exist
    const soldSubquery = saleLinksTableExists 
      ? `LEFT JOIN (
          SELECT 
            source_shipment_id,
            SUM(quantity_sold) AS total_sold
          FROM logistics.sale_import_links
          GROUP BY source_shipment_id
        ) sold ON sold.source_shipment_id = s.id`
      : '';
    
    const soldSelect = saleLinksTableExists
      ? `COALESCE(sold.total_sold, 0) AS quantity_sold,
         (COALESCE(sc.weight_ton, 0) - COALESCE(sold.total_sold, 0)) AS quantity_remaining`
      : `0 AS quantity_sold,
         COALESCE(sc.weight_ton, 0) AS quantity_remaining`;
    
    // Direct query instead of view - more reliable and searchable
    let query = `
      SELECT 
        s.id AS shipment_id,
        s.sn,
        s.subject,
        sl.booking_no,
        sl.bl_no,
        sc.product_text,
        sc.weight_ton AS total_quantity,
        sc.weight_unit,
        sp.supplier_id,
        sup.name AS supplier_name,
        ${soldSelect},
        s.created_at,
        sl.eta,
        sl.etd
      FROM logistics.shipments s
      LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN master_data.companies sup ON sup.id = sp.supplier_id
      ${soldSubquery}
      WHERE s.transaction_type = 'incoming'
        AND s.is_deleted = FALSE
    `;
    const params: any[] = [];
    
    // Only filter by min_remaining if explicitly requested
    const minRemaining = parseFloat(min_remaining as string) || 0;
    if (minRemaining > 0) {
      params.push(minRemaining);
      if (saleLinksTableExists) {
        query += ` AND (COALESCE(sc.weight_ton, 0) - COALESCE(sold.total_sold, 0)) > $${params.length}`;
      } else {
        query += ` AND COALESCE(sc.weight_ton, 0) > $${params.length}`;
      }
    }
    
    if (search) {
      const searchTerm = (search as string).trim();
      params.push(`%${searchTerm}%`);
      // Search across multiple identifying fields
      query += ` AND (
        s.sn ILIKE $${params.length} OR 
        s.subject ILIKE $${params.length} OR 
        COALESCE(sl.booking_no, '') ILIKE $${params.length} OR 
        COALESCE(sl.bl_no, '') ILIKE $${params.length} OR 
        COALESCE(sc.product_text, '') ILIKE $${params.length} OR 
        COALESCE(sup.name, '') ILIKE $${params.length}
      )`;
    }
    
    query += ' ORDER BY s.created_at DESC LIMIT 50';
    
    logger.info(`Executing query with ${params.length} params`);
    const result = await pool.query(query, params);
    logger.info(`Found ${result.rows.length} source imports`);
    
    // Format response with a display label combining available info
    const imports = result.rows.map(row => ({
      ...row,
      // Create a display label for the search results
      display_label: [
        row.sn,
        row.booking_no,
        row.bl_no,
        row.product_text
      ].filter(Boolean).join(' - ') || 'Unnamed Import'
    }));
    
    res.json({
      imports,
      total: imports.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/certificates/sale-links/:saleShipmentId - Get import links for a sale
 */
router.get('/sale-links/:saleShipmentId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { saleShipmentId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        sil.*,
        s.sn as source_sn,
        s.subject as source_subject,
        sc.product_text as source_product,
        sc.weight_ton as source_total_quantity
       FROM logistics.sale_import_links sil
       JOIN logistics.shipments s ON s.id = sil.source_shipment_id
       LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
       WHERE sil.sale_shipment_id = $1
       ORDER BY sil.created_at`,
      [saleShipmentId]
    );
    
    res.json({
      links: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/certificates/source-sales/:sourceShipmentId - Get all sales from a source import
 */
router.get('/source-sales/:sourceShipmentId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceShipmentId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        sil.*,
        s.sn as sale_sn,
        s.subject as sale_subject,
        s.selling_status,
        sp.customer_id,
        c.name as customer_name
       FROM logistics.sale_import_links sil
       JOIN logistics.shipments s ON s.id = sil.sale_shipment_id
       LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
       LEFT JOIN master_data.companies c ON c.id = sp.customer_id
       WHERE sil.source_shipment_id = $1
       ORDER BY sil.created_at`,
      [sourceShipmentId]
    );
    
    // Also get total quantities
    const totals = await pool.query(
      `SELECT 
        SUM(quantity_sold) as total_sold,
        (SELECT weight_ton FROM logistics.shipment_cargo WHERE shipment_id = $1) as total_available
       FROM logistics.sale_import_links
       WHERE source_shipment_id = $1`,
      [sourceShipmentId]
    );
    
    res.json({
      sales: result.rows,
      total: result.rows.length,
      quantity_summary: totals.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/certificates/sale-links - Create sale-import link
 */
router.post('/sale-links', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    const {
      sale_shipment_id,
      source_shipment_id,
      quantity_sold,
      quantity_unit = 'MT',
      notes
    } = req.body;
    
    // Validate required fields
    if (!sale_shipment_id || !source_shipment_id || !quantity_sold) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'sale_shipment_id, source_shipment_id, and quantity_sold are required'
      });
    }
    
    // Check source shipment exists and is incoming
    const sourceCheck = await pool.query(
      `SELECT s.id, s.sn, sc.weight_ton, 
        COALESCE((SELECT SUM(quantity_sold) FROM logistics.sale_import_links WHERE source_shipment_id = s.id), 0) as already_sold
       FROM logistics.shipments s
       LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
       WHERE s.id = $1 AND s.transaction_type = 'incoming' AND s.is_deleted = FALSE`,
      [source_shipment_id]
    );
    
    if (sourceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Source import shipment not found' });
    }
    
    const source = sourceCheck.rows[0];
    const remaining = (source.weight_ton || 0) - (source.already_sold || 0);
    
    if (quantity_sold > remaining) {
      return res.status(400).json({
        error: 'Insufficient Quantity',
        message: `Only ${remaining} ${quantity_unit} available from this import. Already sold: ${source.already_sold}`
      });
    }
    
    // Create the link
    const result = await pool.query(
      `INSERT INTO logistics.sale_import_links
        (sale_shipment_id, source_shipment_id, source_ci_number, quantity_sold, quantity_unit, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sale_shipment_id, source_shipment_id, source.sn, quantity_sold, quantity_unit, notes, user?.id]
    );
    
    logger.info(`Sale-import link created: ${sale_shipment_id} ← ${source_shipment_id} (${quantity_sold} ${quantity_unit})`);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/certificates/sale-links/:id - Update sale-import link quantity
 */
router.put('/sale-links/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { quantity_sold, quantity_unit, notes } = req.body;
    
    // Get existing link
    const existing = await pool.query(
      'SELECT * FROM logistics.sale_import_links WHERE id = $1',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    const link = existing.rows[0];
    
    // If changing quantity, validate availability
    if (quantity_sold && quantity_sold !== link.quantity_sold) {
      const sourceCheck = await pool.query(
        `SELECT 
          sc.weight_ton,
          COALESCE((SELECT SUM(quantity_sold) FROM logistics.sale_import_links 
                   WHERE source_shipment_id = $1 AND id != $2), 0) as other_sales
         FROM logistics.shipment_cargo sc
         WHERE sc.shipment_id = $1`,
        [link.source_shipment_id, id]
      );
      
      const source = sourceCheck.rows[0];
      const available = (source?.weight_ton || 0) - (source?.other_sales || 0);
      
      if (quantity_sold > available) {
        return res.status(400).json({
          error: 'Insufficient Quantity',
          message: `Only ${available} available (excluding current sale)`
        });
      }
    }
    
    const result = await pool.query(
      `UPDATE logistics.sale_import_links
       SET quantity_sold = COALESCE($1, quantity_sold),
           quantity_unit = COALESCE($2, quantity_unit),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [quantity_sold, quantity_unit, notes, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/certificates/sale-links/:id - Delete sale-import link
 */
router.delete('/sale-links/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM logistics.sale_import_links WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    res.json({ success: true, message: 'Link deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// BEYANAME TRACKING
// ============================================

/**
 * PUT /api/certificates/beyaname/:shipmentId - Update Beyaname information
 */
router.put('/beyaname/:shipmentId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shipmentId } = req.params;
    const { beyaname_number, beyaname_date, beyaname_status } = req.body;
    
    // Update or insert beyaname info in shipment_documents
    const result = await pool.query(
      `UPDATE logistics.shipment_documents
       SET beyaname_number = COALESCE($1, beyaname_number),
           beyaname_date = COALESCE($2, beyaname_date),
           beyaname_status = COALESCE($3, beyaname_status),
           updated_at = NOW()
       WHERE shipment_id = $4
       RETURNING *`,
      [beyaname_number, beyaname_date, beyaname_status, shipmentId]
    );
    
    if (result.rows.length === 0) {
      // Insert if not exists
      await pool.query(
        `INSERT INTO logistics.shipment_documents (shipment_id, beyaname_number, beyaname_date, beyaname_status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (shipment_id) DO UPDATE SET
           beyaname_number = COALESCE($2, logistics.shipment_documents.beyaname_number),
           beyaname_date = COALESCE($3, logistics.shipment_documents.beyaname_date),
           beyaname_status = COALESCE($4, logistics.shipment_documents.beyaname_status),
           updated_at = NOW()`,
        [shipmentId, beyaname_number, beyaname_date, beyaname_status]
      );
    }
    
    logger.info(`Beyaname updated for shipment ${shipmentId}: ${beyaname_number}`);
    
    // If beyaname is issued, potentially update selling status
    if (beyaname_status === 'issued') {
      await pool.query(
        `UPDATE logistics.shipments 
         SET selling_status = 'beyaname_issued'
         WHERE id = $1 AND transaction_type = 'outgoing' AND selling_status IN ('draft', 'confirmed', 'docs_prep')`,
        [shipmentId]
      );
    }
    
    // Return updated shipment documents
    const updated = await pool.query(
      'SELECT * FROM logistics.shipment_documents WHERE shipment_id = $1',
      [shipmentId]
    );
    
    res.json(updated.rows[0] || { shipment_id: shipmentId, beyaname_number, beyaname_date, beyaname_status });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/certificates/beyaname/:shipmentId - Get Beyaname information
 */
router.get('/beyaname/:shipmentId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shipmentId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        sd.beyaname_number,
        sd.beyaname_date,
        sd.beyaname_status,
        s.sn,
        s.subject,
        -- Get linked source imports
        (SELECT json_agg(json_build_object(
          'source_ci', sil.source_ci_number,
          'quantity_sold', sil.quantity_sold,
          'source_shipment_id', sil.source_shipment_id
        ))
        FROM logistics.sale_import_links sil
        WHERE sil.sale_shipment_id = s.id) as source_imports
       FROM logistics.shipments s
       LEFT JOIN logistics.shipment_documents sd ON sd.shipment_id = s.id
       WHERE s.id = $1`,
      [shipmentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;

