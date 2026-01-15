import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { loadUserBranches, buildShipmentBranchFilter, buildTransportBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';
import logger from '../utils/logger';
import {
  createDeliverySchema,
  updateDeliverySchema,
  updateDeliveryStatusSchema,
  deliveryFiltersSchema,
  readyForDeliveryFiltersSchema,
  createTransportCompanySchema,
  updateTransportCompanySchema,
  transportCompanyFiltersSchema,
} from '../validators/landTransport';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Load user branches for filtering
router.use(loadUserBranches);

// Roles that can access land transport module (per permissions matrix)
// Admin, Exec: full access; Logistics, Inventory: full access; Clearance, Accounting: read access
const LAND_TRANSPORT_ROLES = ['Admin', 'Exec', 'Logistics', 'Inventory', 'Clearance', 'Accounting', 'Internal_Logistics'];

// ========== READY FOR DELIVERY ==========

/**
 * GET /api/land-transport/ready-for-delivery
 * Get shipments that are cleared and ready for outbound delivery
 * These are shipments with status 'delivered' (arrived at warehouse) or 'arrived'
 * that have a customs_clearance_date set
 * 
 * ASSIGNMENT RULES:
 * - User "cuma" sees only cross-border shipments (is_cross_border = true)
 * - User "I.bozkurt" sees only domestic shipments (is_cross_border = false or null)
 * - Admin/Exec users see all shipments
 */
router.get('/ready-for-delivery', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const filters = readyForDeliveryFiltersSchema.parse(req.query);
    const { page, limit, search } = filters;
    const offset = (page - 1) * limit;
    
    // Get current user info for assignment filtering
    const currentUser = (req as any).user;
    const username = currentUser?.username?.toLowerCase() || '';
    const userRole = currentUser?.role || '';

    // Build branch filter for shipments
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');

    let whereClause = `
      s.is_deleted = FALSE
      AND s.customs_clearance_date IS NOT NULL
    `;
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;

    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      whereClause += ` AND ${branchFilter.clause}`;
    }
    
    // Apply user-based assignment filter (except for Admin/Exec who see all)
    const isGlobalUser = ['Admin', 'Exec'].includes(userRole);
    if (!isGlobalUser) {
      if (username === 'cuma') {
        // Cuma sees only cross-border shipments
        whereClause += ` AND s.is_cross_border = TRUE`;
        logger.info(`User ${username} filtered to cross-border shipments only`);
      } else if (username === 'i.bozkurt') {
        // I.bozkurt sees only domestic (non-cross-border) shipments
        whereClause += ` AND (s.is_cross_border = FALSE OR s.is_cross_border IS NULL)`;
        logger.info(`User ${username} filtered to domestic shipments only`);
      }
      // Other users see all shipments in their branch (no additional filter)
    }

    // Search filter
    if (search) {
      whereClause += ` AND (
        s.sn ILIKE $${paramIndex}
        OR s.product_text ILIKE $${paramIndex}
        OR s.bl_no ILIKE $${paramIndex}
        OR s.booking_no ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM logistics.v_shipments_complete s
      WHERE ${whereClause}
    `;

    // Main query - get shipments with containers from both JSONB column and shipment_containers table
    const dataQuery = `
      SELECT 
        s.id,
        s.sn,
        s.product_text,
        s.subject,
        s.status,
        s.container_count,
        s.containers as containers_jsonb,
        s.weight_ton,
        s.customs_clearance_date,
        s.bl_no,
        s.booking_no,
        pol.name as pol_name,
        pol.country as pol_country,
        pod.name as pod_name,
        pod.country as pod_country,
        s.final_beneficiary_name,
        s.final_beneficiary_company_id,
        sup.name as supplier_name,
        -- Final destination for route display (POD → Final Destination)
        COALESCE(
          s.final_destination->>'delivery_place',
          s.final_destination->>'name',
          s.final_beneficiary_name
        ) as final_destination_place,
        -- Border crossing info for cross-border shipments
        s.is_cross_border,
        s.primary_border_crossing_id,
        s.primary_border_name,
        s.primary_border_name_ar,
        (
          SELECT COUNT(*) 
          FROM logistics.outbound_deliveries od 
          WHERE od.shipment_id = s.id AND od.is_deleted = FALSE
        ) as delivery_count,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', sc.id,
            'container_number', COALESCE(sc.container_number, sc.container_no),
            'seal_number', COALESCE(sc.seal_number, sc.seal_no),
            'gross_weight_kg', sc.gross_weight_kg,
            'net_weight_kg', sc.net_weight_kg,
            'package_count', COALESCE(sc.package_count, sc.bags_count),
            'size_code', sc.size_code
          )), '[]'::json)
          FROM logistics.shipment_containers sc 
          WHERE sc.shipment_id = s.id
        ) as containers_from_table,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', od.id,
            'container_id', od.container_id,
            'delivery_number', od.delivery_number,
            'status', od.status,
            'driver_name', od.driver_name,
            'truck_plate_number', od.truck_plate_number,
            'destination', od.destination,
            'transport_company_name', od.transport_company_name,
            'transport_cost', od.transport_cost,
            'transport_currency', od.transport_currency,
            'insurance_cost', od.insurance_cost,
            'insurance_company', od.insurance_company
          )), '[]'::json)
          FROM logistics.outbound_deliveries od
          WHERE od.shipment_id = s.id AND od.is_deleted = FALSE
        ) as assigned_deliveries
      FROM logistics.v_shipments_complete s
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.companies sup ON s.supplier_id = sup.id
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

    // Transform shipments to include properly formatted containers
    // Check both JSONB column (shipment_cargo.containers) and separate table (shipment_containers)
    const shipmentsWithContainers = dataResult.rows.map((shipment: any) => {
      let containers: any[] = [];
      
      // First try: containers from the shipment_containers table
      if (shipment.containers_from_table && Array.isArray(shipment.containers_from_table) && shipment.containers_from_table.length > 0) {
        containers = shipment.containers_from_table.map((c: any, idx: number) => ({
          id: c.id || `temp-${shipment.id}-${idx}`,
          container_number: c.container_number || null,
          net_weight_kg: c.net_weight_kg ? Number(c.net_weight_kg) : null,
          gross_weight_kg: c.gross_weight_kg ? Number(c.gross_weight_kg) : null,
          package_count: c.package_count ? Number(c.package_count) : null,
          seal_number: c.seal_number || null,
          size_code: c.size_code || null,
        }));
      }
      // Fallback: containers from JSONB column (shipment_cargo.containers)
      else if (shipment.containers_jsonb) {
        const rawContainers = typeof shipment.containers_jsonb === 'string' 
          ? JSON.parse(shipment.containers_jsonb) 
          : shipment.containers_jsonb;
        
        if (Array.isArray(rawContainers) && rawContainers.length > 0) {
          containers = rawContainers.map((c: any, idx: number) => {
            const parseNumericField = (val: any) => {
              if (val === '' || val === null || val === undefined) return null;
              const num = Number(val);
              return isNaN(num) ? null : num;
            };
            
            return {
              id: c.id || `temp-${shipment.id}-${idx}`,
              container_number: c.container_number || c.containerNumber || null,
              net_weight_kg: parseNumericField(c.net_weight_kg || c.netWeightKg),
              gross_weight_kg: parseNumericField(c.gross_weight_kg || c.grossWeightKg),
              package_count: parseNumericField(c.package_count || c.packageCount || c.packages),
              seal_number: c.seal_number || c.sealNumber || null,
            };
          });
        }
      }
      
      // Get assigned deliveries for this shipment (to mark containers that already have transport assigned)
      const assignedDeliveries = shipment.assigned_deliveries || [];
      const assignedContainerIds = new Set(
        assignedDeliveries.map((d: any) => d.container_id?.toLowerCase()).filter(Boolean)
      );
      
      // Mark containers that already have deliveries assigned
      const containersWithDeliveryInfo = containers.map((c: any) => ({
        ...c,
        has_delivery: c.container_number 
          ? assignedContainerIds.has(c.container_number.toLowerCase())
          : false,
        delivery_info: c.container_number 
          ? assignedDeliveries.find((d: any) => d.container_id?.toLowerCase() === c.container_number?.toLowerCase())
          : null,
      }));
      
      // Remove the raw fields and add properly formatted containers
      const { containers_jsonb, containers_from_table, assigned_deliveries, ...shipmentData } = shipment;
      return {
        ...shipmentData,
        containers: containersWithDeliveryInfo,
        assigned_deliveries: assignedDeliveries,
      };
    });

    res.json({
      data: shipmentsWithContainers,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching ready for delivery:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch shipments ready for delivery' });
  }
});

// ========== DELIVERIES CRUD ==========

/**
 * GET /api/land-transport/deliveries
 * List all deliveries with filters and pagination
 */
router.get('/deliveries', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const filters = deliveryFiltersSchema.parse(req.query);
    const { page, limit, search, status, transport_company_id, destination, date_from, date_to, shipment_id, sort_by, sort_dir } = filters;
    const offset = (page - 1) * limit;

    // Build branch filter (filter deliveries based on linked shipment's branch)
    const branchFilter = buildTransportBranchFilter(branchReq, 'd');
    
    let whereClause = 'd.is_deleted = FALSE';
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      whereClause += ` AND ${branchFilter.clause}`;
    }

    // Search filter
    if (search) {
      whereClause += ` AND (
        d.delivery_number ILIKE $${paramIndex}
        OR d.customer_name ILIKE $${paramIndex}
        OR d.customer_reference ILIKE $${paramIndex}
        OR d.destination ILIKE $${paramIndex}
        OR d.driver_name ILIKE $${paramIndex}
        OR d.truck_plate_number ILIKE $${paramIndex}
        OR d.container_id ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Status filter
    if (status) {
      whereClause += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Transport company filter
    if (transport_company_id) {
      whereClause += ` AND d.transport_company_id = $${paramIndex}`;
      params.push(transport_company_id);
      paramIndex++;
    }

    // Destination filter
    if (destination) {
      whereClause += ` AND d.destination ILIKE $${paramIndex}`;
      params.push(`%${destination}%`);
      paramIndex++;
    }

    // Date range filters
    if (date_from) {
      whereClause += ` AND d.delivery_date >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      whereClause += ` AND d.delivery_date <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }

    // Shipment filter
    if (shipment_id) {
      whereClause += ` AND d.shipment_id = $${paramIndex}`;
      params.push(shipment_id);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM logistics.outbound_deliveries d
      WHERE ${whereClause}
    `;

    // Validate sort column
    const validSortColumns: Record<string, string> = {
      delivery_date: 'd.delivery_date',
      delivery_number: 'd.delivery_number',
      destination: 'd.destination',
      status: 'd.status',
      created_at: 'd.created_at',
    };
    const sortColumn = validSortColumns[sort_by] || 'd.delivery_date';

    // Main query
    const dataQuery = `
      SELECT 
        d.*,
        tc.name as transport_company_name,
        tc.phone as transport_company_phone,
        s.sn as shipment_sn,
        s.product_text as shipment_product
      FROM logistics.outbound_deliveries d
      LEFT JOIN master_data.transport_companies tc ON d.transport_company_id = tc.id
      LEFT JOIN logistics.v_shipments_complete s ON d.shipment_id = s.id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sort_dir.toUpperCase()}
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
  } catch (error: any) {
    logger.error('Error fetching deliveries:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch deliveries' });
  }
});

/**
 * GET /api/land-transport/deliveries/:id
 * Get single delivery by ID
 */
router.get('/deliveries/:id', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        d.*,
        tc.name as transport_company_name,
        tc.phone as transport_company_phone,
        tc.contact_person as transport_company_contact,
        s.sn as shipment_sn,
        s.product_text as shipment_product,
        s.weight_ton as shipment_weight,
        s.container_count as shipment_containers,
        s.final_beneficiary_name,
        s.final_beneficiary_company_id
      FROM logistics.outbound_deliveries d
      LEFT JOIN master_data.transport_companies tc ON d.transport_company_id = tc.id
      LEFT JOIN logistics.v_shipments_complete s ON d.shipment_id = s.id
      WHERE d.id = $1 AND d.is_deleted = FALSE
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error fetching delivery:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch delivery' });
  }
});

/**
 * POST /api/land-transport/deliveries
 * Create new delivery
 */
router.post('/deliveries', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const data = createDeliverySchema.parse(req.body);
    const username = (req as any).user?.username || 'system';

    const result = await pool.query(`
      INSERT INTO logistics.outbound_deliveries (
        delivery_date, origin, destination,
        shipment_id, container_id,
        transport_company_id, transport_company_name, driver_name, driver_phone, truck_plate_number, vehicle_type,
        transport_cost, transport_currency, insurance_cost, insurance_company,
        package_count, weight_kg, goods_description,
        customer_name, customer_phone, customer_reference,
        selling_price, currency, status, notes,
        created_by,
        border_crossing_id, border_eta, delivery_leg
      ) VALUES (
        COALESCE($1, CURRENT_DATE), $2, $3,
        $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24, $25,
        $26,
        $27, $28, $29
      )
      RETURNING *
    `, [
      data.delivery_date, data.origin, data.destination,
      data.shipment_id, data.container_id,
      data.transport_company_id, data.transport_company_name, data.driver_name, data.driver_phone, data.truck_plate_number, data.vehicle_type,
      data.transport_cost, data.transport_currency || 'USD', data.insurance_cost, data.insurance_company,
      data.package_count, data.weight_kg, data.goods_description,
      data.customer_name, data.customer_phone, data.customer_reference,
      data.selling_price, data.currency, data.status, data.notes,
      username,
      data.border_crossing_id, data.border_eta, data.delivery_leg,
    ]);

    // If this is a cross-border shipment delivery, update the shipment's border_stage to 'on_the_way'
    if (data.shipment_id) {
      await pool.query(`
        UPDATE logistics.shipments s
        SET border_stage = 'on_the_way',
            updated_at = NOW()
        WHERE s.id = $1
          AND s.border_stage IN ('pending_at_pod', NULL)
          AND EXISTS (
            SELECT 1 FROM logistics.shipment_logistics sl
            WHERE sl.shipment_id = s.id AND sl.is_cross_border = TRUE
          )
      `, [data.shipment_id]);

      // Trigger shipment status recalculation if truck is assigned
      // This will move status from pending_transport to loaded_to_final
      if (data.truck_plate_number) {
        try {
          const { recalculateShipmentStatus } = await import('../services/shipmentStatusEngine');
          await recalculateShipmentStatus(data.shipment_id, username);
          logger.info(`Recalculated shipment status after transport assignment for ${data.shipment_id}`);
        } catch (err) {
          logger.warn(`Failed to recalculate status after delivery creation: ${err}`);
        }
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error creating delivery:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to create delivery' });
  }
});

/**
 * PUT /api/land-transport/deliveries/:id
 * Update delivery
 */
router.put('/deliveries/:id', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateDeliverySchema.parse(req.body);
    const username = (req as any).user?.username || 'system';

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = [
      'delivery_date', 'origin', 'destination',
      'shipment_id', 'container_id',
      'transport_company_id', 'transport_company_name', 'driver_name', 'driver_phone', 'truck_plate_number', 'vehicle_type',
      'transport_cost', 'transport_currency', 'insurance_cost', 'insurance_company',
      'package_count', 'weight_kg', 'goods_description',
      'customer_name', 'customer_phone', 'customer_reference',
      'selling_price', 'currency', 'status', 'notes',
      'border_crossing_id', 'border_eta', 'delivery_leg',
    ];

    for (const field of fields) {
      if (field in data) {
        updates.push(`${field} = $${paramIndex}`);
        values.push((data as any)[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_by = $${paramIndex}`);
    values.push(username);
    paramIndex++;

    values.push(id);

    const result = await pool.query(`
      UPDATE logistics.outbound_deliveries
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND is_deleted = FALSE
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const delivery = result.rows[0];

    // Trigger shipment status recalculation if truck was assigned or shipment changed
    if (delivery.shipment_id && (data.truck_plate_number !== undefined || data.shipment_id !== undefined)) {
      try {
        const { recalculateShipmentStatus } = await import('../services/shipmentStatusEngine');
        await recalculateShipmentStatus(delivery.shipment_id, username);
        logger.info(`Recalculated shipment status after delivery update for ${delivery.shipment_id}`);
      } catch (err) {
        logger.warn(`Failed to recalculate status after delivery update: ${err}`);
      }
    }

    res.json(delivery);
  } catch (error: any) {
    logger.error('Error updating delivery:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to update delivery' });
  }
});

/**
 * PATCH /api/land-transport/deliveries/:id/status
 * Update delivery status only
 */
router.patch('/deliveries/:id/status', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = updateDeliveryStatusSchema.parse(req.body);
    const username = (req as any).user?.username || 'system';

    const result = await pool.query(`
      UPDATE logistics.outbound_deliveries
      SET status = $1, updated_by = $2
      WHERE id = $3 AND is_deleted = FALSE
      RETURNING *
    `, [status, username, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error updating delivery status:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to update delivery status' });
  }
});

/**
 * DELETE /api/land-transport/deliveries/:id
 * Soft delete delivery
 */
router.delete('/deliveries/:id', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const username = (req as any).user?.username || 'system';

    const result = await pool.query(`
      UPDATE logistics.outbound_deliveries
      SET is_deleted = TRUE, updated_by = $1
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING id
    `, [username, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    res.json({ message: 'Delivery deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting delivery:', error);
    res.status(500).json({ error: error.message || 'Failed to delete delivery' });
  }
});

/**
 * POST /api/land-transport/deliveries/:id/generate-receipt
 * Generate receipt number for a delivery
 */
router.post('/deliveries/:id/generate-receipt', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const username = (req as any).user?.username || 'system';

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;

    const result = await pool.query(`
      UPDATE logistics.outbound_deliveries
      SET receipt_number = $1, receipt_generated_at = NOW(), updated_by = $2
      WHERE id = $3 AND is_deleted = FALSE
      RETURNING *
    `, [receiptNumber, username, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error generating receipt:', error);
    res.status(500).json({ error: error.message || 'Failed to generate receipt' });
  }
});

// ========== TRANSPORT COMPANIES ==========

/**
 * GET /api/land-transport/companies
 * List all transport companies
 */
router.get('/companies', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const filters = transportCompanyFiltersSchema.parse(req.query);
    const { page, limit, search, is_active } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'is_deleted = FALSE';
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (
        name ILIKE $${paramIndex}
        OR contact_person ILIKE $${paramIndex}
        OR city ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (is_active !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      params.push(is_active);
      paramIndex++;
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM master_data.transport_companies
      WHERE ${whereClause}
    `;

    const dataQuery = `
      SELECT *
      FROM master_data.transport_companies
      WHERE ${whereClause}
      ORDER BY name ASC
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
  } catch (error: any) {
    logger.error('Error fetching transport companies:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch transport companies' });
  }
});

/**
 * GET /api/land-transport/companies/:id
 * Get single transport company
 */
router.get('/companies/:id', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT *
      FROM master_data.transport_companies
      WHERE id = $1 AND is_deleted = FALSE
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transport company not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error fetching transport company:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch transport company' });
  }
});

/**
 * POST /api/land-transport/companies
 * Create new transport company
 */
router.post('/companies', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const data = createTransportCompanySchema.parse(req.body);
    const username = (req as any).user?.username || 'system';

    const result = await pool.query(`
      INSERT INTO master_data.transport_companies (
        name, country, city, address, phone, contact_person,
        vehicle_types, service_areas, is_active, notes,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11
      )
      RETURNING *
    `, [
      data.name, data.country, data.city, data.address, data.phone, data.contact_person,
      JSON.stringify(data.vehicle_types), JSON.stringify(data.service_areas), data.is_active, data.notes,
      username,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error creating transport company:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A transport company with this name already exists' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to create transport company' });
  }
});

/**
 * PUT /api/land-transport/companies/:id
 * Update transport company
 */
router.put('/companies/:id', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateTransportCompanySchema.parse(req.body);
    const username = (req as any).user?.username || 'system';

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = ['name', 'country', 'city', 'address', 'phone', 'contact_person', 'is_active', 'notes'];

    for (const field of fields) {
      if (field in data) {
        updates.push(`${field} = $${paramIndex}`);
        values.push((data as any)[field]);
        paramIndex++;
      }
    }

    // Handle JSON fields separately
    if ('vehicle_types' in data) {
      updates.push(`vehicle_types = $${paramIndex}`);
      values.push(JSON.stringify(data.vehicle_types));
      paramIndex++;
    }
    if ('service_areas' in data) {
      updates.push(`service_areas = $${paramIndex}`);
      values.push(JSON.stringify(data.service_areas));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_by = $${paramIndex}`);
    values.push(username);
    paramIndex++;

    values.push(id);

    const result = await pool.query(`
      UPDATE master_data.transport_companies
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND is_deleted = FALSE
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transport company not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error updating transport company:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A transport company with this name already exists' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to update transport company' });
  }
});

/**
 * DELETE /api/land-transport/companies/:id
 * Soft delete transport company
 */
router.delete('/companies/:id', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const username = (req as any).user?.username || 'system';

    const result = await pool.query(`
      UPDATE master_data.transport_companies
      SET is_deleted = TRUE, updated_by = $1
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING id
    `, [username, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transport company not found' });
    }

    res.json({ message: 'Transport company deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting transport company:', error);
    res.status(500).json({ error: error.message || 'Failed to delete transport company' });
  }
});

// ========== ONGOING TRANSPORTS BOARD ==========

/**
 * GET /api/land-transport/ongoing
 * Get all ongoing internal transports for the board view
 * Shows all deliveries with status: pending, in_transit
 * Includes rich route information (POD → Border → Final Destination)
 */
router.get('/ongoing', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build branch filter (filter deliveries based on linked shipment's branch)
    const branchFilter = buildTransportBranchFilter(branchReq, 'd');
    
    let whereClause = `d.is_deleted = FALSE AND d.status IN ('pending', 'in_transit')`;
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length + 1;
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      whereClause += ` AND ${branchFilter.clause}`;
    }

    // Optional: filter by specific status (pending or in_transit)
    if (status && (status === 'pending' || status === 'in_transit')) {
      whereClause = whereClause.replace(
        `d.status IN ('pending', 'in_transit')`,
        `d.status = $${paramIndex}`
      );
      params.push(status);
      paramIndex++;
    }

    // Search filter
    if (search) {
      whereClause += ` AND (
        d.delivery_number ILIKE $${paramIndex}
        OR d.container_id ILIKE $${paramIndex}
        OR d.destination ILIKE $${paramIndex}
        OR d.driver_name ILIKE $${paramIndex}
        OR d.truck_plate_number ILIKE $${paramIndex}
        OR s.sn ILIKE $${paramIndex}
        OR s.product_text ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM logistics.outbound_deliveries d
      LEFT JOIN logistics.v_shipments_complete s ON d.shipment_id = s.id
      WHERE ${whereClause}
    `;

    // Main query - comprehensive ongoing transport data
    const dataQuery = `
      SELECT 
        d.id,
        d.delivery_number,
        d.delivery_date,
        d.status,
        d.origin,
        d.destination,
        d.container_id,
        d.driver_name,
        d.driver_phone,
        d.truck_plate_number,
        d.vehicle_type,
        d.transport_company_id,
        d.transport_company_name,
        d.transport_cost,
        d.transport_currency,
        d.insurance_cost,
        d.insurance_company,
        d.package_count,
        d.weight_kg,
        d.goods_description,
        d.customer_name,
        d.customer_phone,
        d.notes,
        d.border_crossing_id,
        d.border_eta,
        d.delivery_leg,
        d.created_at,
        d.updated_at,
        d.created_by,
        -- Shipment info
        s.id as shipment_id,
        s.sn as shipment_sn,
        s.product_text as shipment_product,
        s.weight_ton as shipment_weight_ton,
        s.container_count as shipment_container_count,
        s.customs_clearance_date,
        s.bl_no,
        s.booking_no,
        s.supplier_name,
        -- Route info: POD
        pod.name as pod_name,
        pod.country as pod_country,
        -- Route info: Final Destination
        COALESCE(
          s.final_destination->>'delivery_place',
          s.final_destination->>'name',
          s.final_beneficiary_name
        ) as final_destination_place,
        s.final_destination->>'branch_id' as final_destination_branch_id,
        -- Route info: Border Crossing (from delivery or shipment)
        COALESCE(d.border_crossing_id, s.primary_border_crossing_id) as effective_border_crossing_id,
        COALESCE(bc.name, s.primary_border_name) as border_crossing_name,
        COALESCE(bc.name_ar, s.primary_border_name_ar) as border_crossing_name_ar,
        COALESCE(bc.country_from, s.border_country_from) as border_country_from,
        COALESCE(bc.country_to, s.border_country_to) as border_country_to,
        s.is_cross_border,
        -- Transport company details
        tc.phone as transport_company_phone,
        tc.contact_person as transport_company_contact
      FROM logistics.outbound_deliveries d
      LEFT JOIN logistics.v_shipments_complete s ON d.shipment_id = s.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      LEFT JOIN master_data.border_crossings bc ON COALESCE(d.border_crossing_id, s.primary_border_crossing_id) = bc.id
      LEFT JOIN master_data.transport_companies tc ON d.transport_company_id = tc.id
      WHERE ${whereClause}
      ORDER BY 
        CASE d.status 
          WHEN 'in_transit' THEN 1 
          WHEN 'pending' THEN 2 
        END,
        d.delivery_date DESC,
        d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(Number(limit), offset);

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, params.slice(0, paramIndex - 1)),
      pool.query(dataQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / Number(limit));

    // Summary stats
    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE d.status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE d.status = 'in_transit') as in_transit_count,
        COUNT(*) as total_ongoing
      FROM logistics.outbound_deliveries d
      ${branchFilter.clause !== '1=1' ? `WHERE d.is_deleted = FALSE AND ${branchFilter.clause}` : 'WHERE d.is_deleted = FALSE'}
        AND d.status IN ('pending', 'in_transit')
    `;
    const statsResult = await pool.query(statsQuery, branchFilter.params);

    res.json({
      data: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages,
      },
      stats: statsResult.rows[0],
    });
  } catch (error: any) {
    logger.error('Error fetching ongoing transports:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch ongoing transports' });
  }
});

// ========== UTILITY ENDPOINTS ==========

/**
 * GET /api/land-transport/destinations/suggestions
 * Get common destination suggestions
 */
router.get('/destinations/suggestions', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    // Get most used destinations
    const result = await pool.query(`
      SELECT destination, COUNT(*) as usage_count
      FROM logistics.outbound_deliveries
      WHERE is_deleted = FALSE AND destination IS NOT NULL AND destination != ''
      GROUP BY destination
      ORDER BY usage_count DESC
      LIMIT 20
    `);

    // Add some default suggestions if not enough data
    const defaultSuggestions = [
      'مرسین',  // Mersin
      'سوریا',  // Syria
      'العراق', // Iraq
      'المستودع الداخلي', // Internal Warehouse
      'مستودع العبور', // Transit Warehouse
    ];

    const suggestions = result.rows.map((r: any) => r.destination);
    
    // Add defaults that aren't already in suggestions
    for (const def of defaultSuggestions) {
      if (!suggestions.includes(def)) {
        suggestions.push(def);
      }
    }

    res.json({ suggestions: suggestions.slice(0, 20) });
  } catch (error: any) {
    logger.error('Error fetching destination suggestions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch suggestions' });
  }
});

/**
 * GET /api/land-transport/stats
 * Get delivery statistics
 */
router.get('/stats', authorizeRoles(...LAND_TRANSPORT_ROLES), async (req: Request, res: Response) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const branchFilter = buildTransportBranchFilter(branchReq, 'd');
    
    let whereClause = 'd.is_deleted = FALSE';
    const params: any[] = [...branchFilter.params];
    
    // Apply branch filter
    if (branchFilter.clause !== '1=1') {
      whereClause += ` AND ${branchFilter.clause}`;
    }
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE d.status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE d.status = 'in_transit') as in_transit_count,
        COUNT(*) FILTER (WHERE d.status = 'delivered') as delivered_count,
        COUNT(*) FILTER (WHERE d.status = 'cancelled') as cancelled_count,
        COUNT(*) as total_count,
        SUM(COALESCE(d.total_cost, 0)) FILTER (WHERE d.status != 'cancelled') as total_transport_cost
      FROM logistics.outbound_deliveries d
      WHERE ${whereClause}
    `, params);

    res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

export default router;

