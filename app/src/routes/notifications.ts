import { Router } from 'express';
import { pool } from '../db/client';
import { notificationService } from '../services/notificationService';
import { workflowProgressionService } from '../services/workflowProgressionService';
import { loadUserBranches, buildShipmentBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';
import logger from '../utils/logger';

const router = Router();

// Load user branches for filtering
router.use(loadUserBranches);

// GET /api/notifications - Get all notifications
router.get('/', async (req, res, next) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const { isRead, type, limit = '50', offset = '0' } = req.query;
    
    // Build branch filter (filter notifications based on linked shipment's branch)
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');
    
    // Using v_shipments_complete view which joins all normalized shipment tables
    let query = `
      SELECT n.*,
        s.sn, s.product_text, s.eta,
        pol.name as pol_name,
        pod.name as pod_name
      FROM logistics.notifications n
      LEFT JOIN logistics.v_shipments_complete s ON n.shipment_id = s.id
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      WHERE 1=1
    `;
    
    const params: any[] = [...branchFilter.params];
    let paramIndex = branchFilter.params.length;
    
    // Apply branch filter (only show notifications for shipments user can access)
    if (branchFilter.clause !== '1=1') {
      query += ` AND (n.shipment_id IS NULL OR ${branchFilter.clause})`;
    }
    
    if (isRead !== undefined) {
      paramIndex++;
      params.push(isRead === 'true');
      query += ` AND n.is_read = $${paramIndex}`;
    }
    
    if (type) {
      paramIndex++;
      params.push(type);
      query += ` AND n.type = $${paramIndex}`;
    }
    
    query += ` ORDER BY n.created_at DESC`;
    
    paramIndex++;
    params.push(Number(limit));
    query += ` LIMIT $${paramIndex}`;
    
    paramIndex++;
    params.push(Number(offset));
    query += ` OFFSET $${paramIndex}`;
    
    const result = await pool.query(query, params);
    
    // Get unread count (filtered by branch)
    let countQuery = `
      SELECT COUNT(*) as unread_count 
      FROM logistics.notifications n
      LEFT JOIN logistics.v_shipments_complete s ON n.shipment_id = s.id
      WHERE n.is_read = false
    `;
    const countParams: any[] = [...branchFilter.params];
    
    if (branchFilter.clause !== '1=1') {
      countQuery += ` AND (n.shipment_id IS NULL OR ${branchFilter.clause})`;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      notifications: result.rows,
      unreadCount: parseInt(countResult.rows[0].unread_count),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/:id/read - Mark notification as read
router.post('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE logistics.notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/read-all - Mark all notifications as read
router.post('/read-all', async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE logistics.notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE is_read = false`
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/generate - Manually trigger notification generation
router.post('/generate', async (req, res, next) => {
  try {
    await pool.query('SELECT logistics.generate_shipment_notifications()');
    
    res.json({ message: 'Notifications generated successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/check - Manual refresh (comprehensive check)
router.post('/check', async (req, res, next) => {
  try {
    logger.info('🔔 Manual notification check triggered by user');
    await notificationService.checkAndGenerateNotifications();
    
    res.json({ 
      success: true, 
      message: 'Notification check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in manual notification check:', error);
    next(error);
  }
});

// PUT /api/notifications/:id/complete - Mark action as completed
router.put('/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE logistics.notifications 
       SET action_completed = TRUE, 
           action_completed_at = NOW(),
           is_read = TRUE,
           read_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ 
      success: true, 
      notification: result.rows[0],
      message: 'Action marked as completed'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/pending - Get actionable items
router.get('/pending', async (req, res, next) => {
  try {
    // Using v_shipments_complete view which joins all normalized shipment tables
    const result = await pool.query(`
      SELECT n.*,
        s.sn, s.product_text, s.eta, s.status as shipment_status,
        c.contract_no,
        pol.name as pol_name,
        pod.name as pod_name,
        CASE 
          WHEN n.due_date IS NULL THEN 999
          WHEN n.due_date < CURRENT_DATE THEN -1
          ELSE (n.due_date::date - CURRENT_DATE)::integer
        END as days_until_due
      FROM logistics.notifications n
      LEFT JOIN logistics.v_shipments_complete s ON n.shipment_id = s.id
      LEFT JOIN logistics.contracts c ON n.contract_id = c.id
      LEFT JOIN master_data.ports pol ON s.pol_id = pol.id
      LEFT JOIN master_data.ports pod ON s.pod_id = pod.id
      WHERE n.action_required IS NOT NULL 
        AND n.action_completed = FALSE
      ORDER BY 
        CASE n.severity
          WHEN 'error' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'info' THEN 3
          ELSE 4
        END,
        n.due_date ASC NULLS LAST,
        n.created_at DESC
    `);
    
    // Group by severity for frontend
    const grouped = {
      critical: result.rows.filter(n => n.severity === 'error'),
      warning: result.rows.filter(n => n.severity === 'warning'),
      info: result.rows.filter(n => n.severity === 'info'),
    };
    
    res.json({
      total: result.rows.length,
      tasks: result.rows,
      grouped,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE severity = 'error') as critical,
        COUNT(*) FILTER (WHERE severity = 'warning') as warnings,
        COUNT(*) FILTER (WHERE action_required IS NOT NULL AND action_completed = FALSE) as pending_actions,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND action_completed = FALSE) as overdue
      FROM logistics.notifications
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);
    
    res.json(stats.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM logistics.notifications WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// WORKFLOW PROGRESSION RULES ENDPOINTS
// ============================================================

// GET /api/notifications/progression-rules - Get all workflow progression rules
router.get('/progression-rules', async (req, res, next) => {
  try {
    const rules = await workflowProgressionService.getAllRules();
    res.json({
      rules,
      total: rules.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/progression-rules/stats - Get auto-completion statistics
router.get('/progression-rules/stats', async (req, res, next) => {
  try {
    const stats = await workflowProgressionService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/progression-rules/:id - Update a progression rule
router.put('/progression-rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { conditions, is_active, priority, description, description_ar } = req.body;
    
    const rule = await workflowProgressionService.updateRule(id, {
      conditions,
      is_active,
      priority,
      description,
      description_ar
    });
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json({
      success: true,
      rule
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/progression-rules/check - Manually trigger auto-completion check
router.post('/progression-rules/check', async (req, res, next) => {
  try {
    logger.info('🔄 Manual workflow progression check triggered');
    const result = await workflowProgressionService.checkAndAutoComplete();
    
    res.json({
      success: true,
      processed: result.processed,
      autoCompleted: result.autoCompleted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/auto-completed - Get auto-completed notifications
router.get('/auto-completed', async (req, res, next) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    
    const result = await pool.query(`
      SELECT 
        n.*,
        r.rule_name,
        r.rule_name_ar,
        s.sn as shipment_sn,
        c.contract_no
      FROM logistics.notifications n
      LEFT JOIN logistics.workflow_progression_rules r ON n.auto_completed_rule_id = r.id
      LEFT JOIN logistics.v_shipments_complete s ON n.shipment_id = s.id
      LEFT JOIN logistics.contracts c ON n.contract_id = c.id
      WHERE n.auto_completed = TRUE
      ORDER BY n.auto_completed_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit as string), parseInt(offset as string)]);
    
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM logistics.notifications
      WHERE auto_completed = TRUE
    `);
    
    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    next(error);
  }
});

export default router;

