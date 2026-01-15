import { Router } from 'express';
import { pool } from '../db/client';
import logger from '../utils/logger';

const router = Router();

// ========== GET /api/contracts/:id/audit-log - Get audit log for contract ==========
router.get('/contracts/:id/audit-log', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
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
      WHERE cal.related_contract_id = $1
      ORDER BY cal.changed_at DESC`,
      [id]
    );
    
    res.json({
      contract_id: id,
      total: result.rows.length,
      logs: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching contract audit log:', error);
    next(error);
  }
});

// ========== GET /api/shipments/:id/audit-log - Get audit log for shipment ==========
router.get('/shipments/:id/audit-log', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
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
      ORDER BY cal.changed_at DESC`,
      [id]
    );
    
    res.json({
      shipment_id: id,
      total: result.rows.length,
      logs: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching shipment audit log:', error);
    next(error);
  }
});

// ========== GET /api/contracts/:contractId/shipments/:shipmentId/comparison ==========
router.get('/contracts/:contractId/shipments/:shipmentId/comparison', async (req, res, next) => {
  try {
    const { contractId, shipmentId } = req.params;
    
    // Get comparison data from view
    const result = await pool.query(
      `SELECT * FROM report.contract_shipment_comparison
       WHERE contract_id = $1 AND shipment_id = $2
       ORDER BY product_name`,
      [contractId, shipmentId]
    );
    
    // Get change history for this contract-shipment pair
    const historyResult = await pool.query(
      `SELECT 
        cal.*,
        p.name as product_name
      FROM logistics.change_audit_log cal
      LEFT JOIN logistics.shipment_lines sl ON sl.id = cal.entity_id AND cal.entity_type = 'shipment_line'
      LEFT JOIN master_data.products p ON p.id = sl.product_id
      WHERE cal.related_contract_id = $1 
        AND cal.related_shipment_id = $2
      ORDER BY cal.changed_at DESC`,
      [contractId, shipmentId]
    );
    
    res.json({
      contract_id: contractId,
      shipment_id: shipmentId,
      comparison: result.rows,
      change_history: historyResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching contract-shipment comparison:', error);
    next(error);
  }
});

// ========== GET /api/audit-log - Get general audit log with filters ==========
router.get('/', async (req, res, next) => {
  try {
    const { 
      entity_type, 
      entity_id, 
      changed_by, 
      source_type,
      from_date,
      to_date,
      limit = '100',
      offset = '0'
    } = req.query;
    
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (entity_type) {
      conditions.push(`cal.entity_type = $${paramIndex++}`);
      params.push(entity_type);
    }
    
    if (entity_id) {
      conditions.push(`cal.entity_id = $${paramIndex++}`);
      params.push(entity_id);
    }
    
    if (changed_by) {
      conditions.push(`cal.changed_by = $${paramIndex++}`);
      params.push(changed_by);
    }
    
    if (source_type) {
      conditions.push(`cal.source_type = $${paramIndex++}`);
      params.push(source_type);
    }
    
    if (from_date) {
      conditions.push(`cal.changed_at >= $${paramIndex++}`);
      params.push(from_date);
    }
    
    if (to_date) {
      conditions.push(`cal.changed_at <= $${paramIndex++}`);
      params.push(to_date);
    }
    
    const query = `
      SELECT 
        cal.*,
        c.contract_no,
        s.sn as shipment_sn
      FROM logistics.change_audit_log cal
      LEFT JOIN logistics.contracts c ON c.id = cal.related_contract_id
      LEFT JOIN logistics.v_shipments_complete s ON s.id = cal.related_shipment_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY cal.changed_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM logistics.change_audit_log cal
      WHERE ${conditions.join(' AND ')}
    `;
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    logger.error('Error fetching audit log:', error);
    next(error);
  }
});

export default router;

