/**
 * WorkflowProgressionService - Auto-Complete Notifications Based on Workflow Progression
 * 
 * This service evaluates pending notifications against configurable rules stored in the database.
 * When a user progresses past a workflow step (e.g., shipment status advances), corresponding
 * notifications are automatically marked as completed.
 * 
 * Supported condition types:
 * - status_in: Entity status is in a list of values
 * - status_gte: Entity status >= threshold (based on workflow order)
 * - field_not_null: A field has a non-null value
 * - field_lte / field_gte: Numeric field comparisons
 * - doc_count_gte: Document count check
 * - related_entity_status: Check status of a related entity
 * - any_of / all_of: Logical operators for combining conditions
 */

import logger from '../utils/logger';
import { pool } from '../db/client';

// ============================================================
// TYPES
// ============================================================

interface ProgressionRule {
  id: string;
  notification_type: string;
  rule_name: string;
  rule_name_ar: string | null;
  entity_type: string;
  conditions: any;
  priority: number;
  is_active: boolean;
  description: string | null;
  description_ar: string | null;
}

interface PendingNotification {
  id: string;
  notification_type: string;
  shipment_id: string | null;
  contract_id: string | null;
}

interface EntityData {
  id: string;
  status?: string;
  [key: string]: any;
}

// Status order mappings for comparison
// Updated to reflect the new automatic status engine workflow
const SHIPMENT_STATUS_ORDER: Record<string, number> = {
  // New status engine values
  'planning': 1,
  'delayed': 2,
  'sailed': 3,
  'awaiting_clearance': 4,
  'loaded_to_final': 5,
  'received': 6,
  'quality_issue': 7,
  // Legacy status mappings for backwards compatibility
  'booked': 1,      // Maps to planning
  'gate_in': 1,     // Maps to planning
  'loaded': 3,      // Maps to sailed
  'arrived': 4,     // Maps to awaiting_clearance
  'delivered': 6,   // Maps to received
  'invoiced': 6,    // Maps to received
};

const CONTRACT_STATUS_ORDER: Record<string, number> = {
  'DRAFT': 1,
  'PENDING': 2,
  'ACTIVE': 3,
  'FULFILLED': 4,
  'COMPLETED': 5,
  'CANCELLED': 6,
};

const QUALITY_INCIDENT_STATUS_ORDER: Record<string, number> = {
  'draft': 1,
  'submitted': 2,
  'under_review': 3,
  'action_set': 4,
  'closed': 5,
};

const CUSTOMS_CLEARANCE_STATUS_ORDER: Record<string, number> = {
  'pending': 1,
  'arrived': 2,
  'in_progress': 3,
  'cleared': 4,
  'cancelled': 5,
};

// ============================================================
// SERVICE CLASS
// ============================================================

export class WorkflowProgressionService {
  
  /**
   * Main entry point - check all pending notifications and auto-complete where applicable
   */
  async checkAndAutoComplete(): Promise<{processed: number; autoCompleted: number}> {
    logger.info('🔄 Checking workflow progression for auto-completion...');
    
    let processed = 0;
    let autoCompleted = 0;
    
    try {
      // Load active rules
      const rules = await this.loadActiveRules();
      if (rules.length === 0) {
        logger.info('  No active progression rules found');
        return { processed, autoCompleted };
      }
      logger.info(`  Loaded ${rules.length} active progression rules`);
      
      // Load pending notifications that have action_required but not completed
      const notifications = await this.loadPendingNotifications();
      if (notifications.length === 0) {
        logger.info('  No pending notifications to check');
        return { processed, autoCompleted };
      }
      logger.info(`  Checking ${notifications.length} pending notifications`);
      
      // Group rules by notification_type for quick lookup
      const rulesByType = this.groupRulesByType(rules);
      
      // Process each notification
      for (const notification of notifications) {
        processed++;
        
        // Find matching rules for this notification type
        const matchingRules = rulesByType.get(notification.notification_type);
        if (!matchingRules || matchingRules.length === 0) {
          continue; // No rules for this notification type
        }
        
        // Load entity data
        const entityData = await this.loadEntityData(notification, matchingRules[0].entity_type);
        if (!entityData) {
          continue; // Entity not found or deleted
        }
        
        // Evaluate each rule (stop at first match)
        for (const rule of matchingRules) {
          try {
            const result = await this.evaluateCondition(rule.conditions, entityData, notification);
            
            if (result) {
              // Mark notification as auto-completed
              await this.markAutoCompleted(notification.id, rule);
              autoCompleted++;
              logger.info(`  ✅ Auto-completed: ${notification.notification_type} (${rule.rule_name})`);
              break; // Don't check other rules for this notification
            }
          } catch (error) {
            logger.error(`  ❌ Error evaluating rule ${rule.id}:`, error);
          }
        }
      }
      
      logger.info(`✅ Workflow progression check complete: ${autoCompleted}/${processed} auto-completed`);
      
    } catch (error) {
      logger.error('❌ Error in workflow progression check:', error);
    }
    
    return { processed, autoCompleted };
  }
  
  /**
   * Load all active progression rules from database
   */
  private async loadActiveRules(): Promise<ProgressionRule[]> {
    const result = await pool.query<ProgressionRule>(`
      SELECT * FROM logistics.workflow_progression_rules
      WHERE is_active = TRUE
      ORDER BY priority ASC, notification_type ASC
    `);
    return result.rows;
  }
  
  /**
   * Load pending notifications that might need auto-completion
   */
  private async loadPendingNotifications(): Promise<PendingNotification[]> {
    const result = await pool.query<PendingNotification>(`
      SELECT 
        id,
        type as notification_type,
        shipment_id,
        contract_id
      FROM logistics.notifications
      WHERE action_required IS NOT NULL
        AND action_completed = FALSE
        AND (auto_completed IS NULL OR auto_completed = FALSE)
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 500
    `);
    return result.rows;
  }
  
  /**
   * Group rules by notification type for quick lookup
   */
  private groupRulesByType(rules: ProgressionRule[]): Map<string, ProgressionRule[]> {
    const map = new Map<string, ProgressionRule[]>();
    for (const rule of rules) {
      const existing = map.get(rule.notification_type) || [];
      existing.push(rule);
      map.set(rule.notification_type, existing);
    }
    return map;
  }
  
  /**
   * Load entity data based on notification and entity type
   */
  private async loadEntityData(
    notification: PendingNotification, 
    entityType: string
  ): Promise<EntityData | null> {
    try {
      switch (entityType) {
        case 'shipment':
          if (!notification.shipment_id) return null;
          return await this.loadShipmentData(notification.shipment_id);
          
        case 'contract':
          if (!notification.contract_id) return null;
          return await this.loadContractData(notification.contract_id);
          
        case 'quality_incident':
          // Quality incidents are linked via shipment
          if (!notification.shipment_id) return null;
          return await this.loadQualityIncidentData(notification.shipment_id);
          
        default:
          logger.warn(`  Unknown entity type: ${entityType}`);
          return null;
      }
    } catch (error) {
      logger.error(`  Error loading ${entityType} data:`, error);
      return null;
    }
  }
  
  /**
   * Load shipment data including related info
   */
  private async loadShipmentData(shipmentId: string): Promise<EntityData | null> {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.status,
        s.contract_id,
        f.balance_value_usd,
        l.customs_clearance_date,
        d.quality_feedback_requested,
        (
          SELECT COUNT(*) 
          FROM archive.documents doc 
          WHERE doc.shipment_id = s.id 
            AND doc.doc_type IN ('BL_DRAFT', 'BL_FINAL', 'PL', 'COO', 'COA')
            AND doc.is_deleted = FALSE
        ) as doc_count
      FROM logistics.shipments s
      LEFT JOIN logistics.shipment_financials f ON f.shipment_id = s.id
      LEFT JOIN logistics.shipment_logistics l ON l.shipment_id = s.id
      LEFT JOIN logistics.shipment_documents d ON d.shipment_id = s.id
      WHERE s.id = $1 AND s.is_deleted = FALSE
    `, [shipmentId]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Load contract data including related shipments
   */
  private async loadContractData(contractId: string): Promise<EntityData | null> {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.status,
        (
          SELECT MAX(logistics.get_shipment_status_order(s.status))
          FROM logistics.shipments s
          WHERE s.contract_id = c.id AND s.is_deleted = FALSE
        ) as max_shipment_status_order,
        (
          SELECT s.status
          FROM logistics.shipments s
          WHERE s.contract_id = c.id AND s.is_deleted = FALSE
          ORDER BY logistics.get_shipment_status_order(s.status) DESC
          LIMIT 1
        ) as most_advanced_shipment_status
      FROM logistics.contracts c
      WHERE c.id = $1 AND c.is_deleted = FALSE
    `, [contractId]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Load quality incident data for a shipment
   */
  private async loadQualityIncidentData(shipmentId: string): Promise<EntityData | null> {
    const result = await pool.query(`
      SELECT 
        qi.id,
        qi.status,
        qi.shipment_id
      FROM logistics.quality_incidents qi
      WHERE qi.shipment_id = $1
      ORDER BY qi.created_at DESC
      LIMIT 1
    `, [shipmentId]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Evaluate a condition against entity data
   */
  private async evaluateCondition(
    condition: any, 
    entityData: EntityData,
    notification: PendingNotification
  ): Promise<boolean> {
    if (!condition || typeof condition !== 'object') {
      return false;
    }
    
    // Handle logical operators
    if (condition.any_of) {
      // Any condition matches = true
      for (const subCondition of condition.any_of) {
        if (await this.evaluateCondition(subCondition, entityData, notification)) {
          return true;
        }
      }
      return false;
    }
    
    if (condition.all_of) {
      // All conditions must match
      for (const subCondition of condition.all_of) {
        if (!(await this.evaluateCondition(subCondition, entityData, notification))) {
          return false;
        }
      }
      return true;
    }
    
    // Handle status_in: check if status is in list
    if (condition.status_in) {
      const statuses = Array.isArray(condition.status_in) ? condition.status_in : [condition.status_in];
      return statuses.includes(entityData.status);
    }
    
    // Handle status_gte: check if status >= threshold
    if (condition.status_gte) {
      return this.isStatusGte(entityData.status, condition.status_gte, entityData);
    }
    
    // Handle field_not_null: check if field has a value
    if (condition.field_not_null) {
      const fieldName = condition.field_not_null;
      const value = entityData[fieldName];
      return value !== null && value !== undefined && value !== '';
    }
    
    // Handle field_lte: numeric less than or equal
    if (condition.field_lte) {
      const { field, value } = condition.field_lte;
      const fieldValue = parseFloat(entityData[field]) || 0;
      return fieldValue <= value;
    }
    
    // Handle field_gte: numeric greater than or equal
    if (condition.field_gte) {
      const { field, value } = condition.field_gte;
      const fieldValue = parseFloat(entityData[field]) || 0;
      return fieldValue >= value;
    }
    
    // Handle doc_count_gte: document count check
    if (condition.doc_count_gte) {
      const { min } = condition.doc_count_gte;
      const docCount = parseInt(entityData.doc_count) || 0;
      return docCount >= min;
    }
    
    // Handle related_entity_status: check status of related entity
    if (condition.related_entity_status) {
      return await this.evaluateRelatedEntityStatus(condition.related_entity_status, entityData, notification);
    }
    
    // Unknown condition type
    logger.warn(`  Unknown condition type:`, Object.keys(condition));
    return false;
  }
  
  /**
   * Check if current status >= threshold status
   */
  private isStatusGte(currentStatus: string | undefined, thresholdStatus: string, entityData: EntityData): boolean {
    if (!currentStatus) return false;
    
    // Determine which status order to use based on context
    let statusOrder: Record<string, number>;
    
    // Check if this is a contract with shipment status check
    if (entityData.most_advanced_shipment_status !== undefined) {
      // This is a contract checking its shipments' status
      const shipmentStatus = entityData.most_advanced_shipment_status;
      if (!shipmentStatus) return false;
      
      const currentOrder = SHIPMENT_STATUS_ORDER[shipmentStatus] || 0;
      const thresholdOrder = SHIPMENT_STATUS_ORDER[thresholdStatus] || 0;
      return currentOrder >= thresholdOrder;
    }
    
    // Otherwise use the entity's own status
    if (SHIPMENT_STATUS_ORDER[currentStatus] !== undefined) {
      statusOrder = SHIPMENT_STATUS_ORDER;
    } else if (CONTRACT_STATUS_ORDER[currentStatus.toUpperCase()] !== undefined) {
      statusOrder = CONTRACT_STATUS_ORDER;
      currentStatus = currentStatus.toUpperCase();
      thresholdStatus = thresholdStatus.toUpperCase();
    } else if (QUALITY_INCIDENT_STATUS_ORDER[currentStatus] !== undefined) {
      statusOrder = QUALITY_INCIDENT_STATUS_ORDER;
    } else if (CUSTOMS_CLEARANCE_STATUS_ORDER[currentStatus] !== undefined) {
      statusOrder = CUSTOMS_CLEARANCE_STATUS_ORDER;
    } else {
      // Unknown status type, try shipment order as default
      statusOrder = SHIPMENT_STATUS_ORDER;
    }
    
    const currentOrder = statusOrder[currentStatus] || 0;
    const thresholdOrder = statusOrder[thresholdStatus] || 0;
    
    return currentOrder >= thresholdOrder;
  }
  
  /**
   * Evaluate related entity status condition
   */
  private async evaluateRelatedEntityStatus(
    config: { table: string; link_field: string; status_gte?: string; status_in?: string[] },
    entityData: EntityData,
    notification: PendingNotification
  ): Promise<boolean> {
    const { table, link_field, status_gte, status_in } = config;
    
    // For contracts, check if any related shipment meets the status condition
    if (table === 'shipments' && link_field === 'contract_id') {
      // Use the pre-loaded most_advanced_shipment_status if available
      if (entityData.most_advanced_shipment_status) {
        if (status_gte) {
          const currentOrder = SHIPMENT_STATUS_ORDER[entityData.most_advanced_shipment_status] || 0;
          const thresholdOrder = SHIPMENT_STATUS_ORDER[status_gte] || 0;
          return currentOrder >= thresholdOrder;
        }
        if (status_in) {
          return status_in.includes(entityData.most_advanced_shipment_status);
        }
      }
      
      // Fallback: query the database
      const contractId = notification.contract_id || entityData.id;
      if (!contractId) return false;
      
      const result = await pool.query(`
        SELECT status FROM logistics.shipments
        WHERE contract_id = $1 AND is_deleted = FALSE
        ORDER BY logistics.get_shipment_status_order(status) DESC
        LIMIT 1
      `, [contractId]);
      
      if (result.rows.length === 0) return false;
      
      const shipmentStatus = result.rows[0].status;
      
      if (status_gte) {
        const currentOrder = SHIPMENT_STATUS_ORDER[shipmentStatus] || 0;
        const thresholdOrder = SHIPMENT_STATUS_ORDER[status_gte] || 0;
        return currentOrder >= thresholdOrder;
      }
      
      if (status_in) {
        return status_in.includes(shipmentStatus);
      }
    }
    
    return false;
  }
  
  /**
   * Mark a notification as auto-completed
   */
  private async markAutoCompleted(notificationId: string, rule: ProgressionRule): Promise<void> {
    await pool.query(`
      UPDATE logistics.notifications
      SET 
        action_completed = TRUE,
        action_completed_at = NOW(),
        auto_completed = TRUE,
        auto_completed_at = NOW(),
        auto_completed_reason = $2,
        auto_completed_rule_id = $3,
        is_read = TRUE,
        read_at = COALESCE(read_at, NOW())
      WHERE id = $1
    `, [
      notificationId,
      rule.description || rule.rule_name,
      rule.id
    ]);
  }
  
  /**
   * Get all rules (for admin UI)
   */
  async getAllRules(): Promise<ProgressionRule[]> {
    const result = await pool.query<ProgressionRule>(`
      SELECT * FROM logistics.workflow_progression_rules
      ORDER BY notification_type, priority
    `);
    return result.rows;
  }
  
  /**
   * Update a rule (for admin UI)
   */
  async updateRule(
    ruleId: string, 
    updates: Partial<Pick<ProgressionRule, 'conditions' | 'is_active' | 'priority' | 'description' | 'description_ar'>>
  ): Promise<ProgressionRule | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [ruleId];
    let paramIndex = 1;
    
    if (updates.conditions !== undefined) {
      paramIndex++;
      setClauses.push(`conditions = $${paramIndex}`);
      params.push(JSON.stringify(updates.conditions));
    }
    
    if (updates.is_active !== undefined) {
      paramIndex++;
      setClauses.push(`is_active = $${paramIndex}`);
      params.push(updates.is_active);
    }
    
    if (updates.priority !== undefined) {
      paramIndex++;
      setClauses.push(`priority = $${paramIndex}`);
      params.push(updates.priority);
    }
    
    if (updates.description !== undefined) {
      paramIndex++;
      setClauses.push(`description = $${paramIndex}`);
      params.push(updates.description);
    }
    
    if (updates.description_ar !== undefined) {
      paramIndex++;
      setClauses.push(`description_ar = $${paramIndex}`);
      params.push(updates.description_ar);
    }
    
    const result = await pool.query<ProgressionRule>(`
      UPDATE logistics.workflow_progression_rules
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Get auto-completion statistics
   */
  async getStats(): Promise<{
    totalRules: number;
    activeRules: number;
    autoCompletedToday: number;
    autoCompletedThisWeek: number;
    topRules: Array<{rule_name: string; count: number}>;
  }> {
    const [rulesResult, statsResult, topRulesResult] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = TRUE) as active
        FROM logistics.workflow_progression_rules
      `),
      pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE auto_completed_at >= CURRENT_DATE) as today,
          COUNT(*) FILTER (WHERE auto_completed_at >= CURRENT_DATE - INTERVAL '7 days') as week
        FROM logistics.notifications
        WHERE auto_completed = TRUE
      `),
      pool.query(`
        SELECT r.rule_name, COUNT(*) as count
        FROM logistics.notifications n
        JOIN logistics.workflow_progression_rules r ON n.auto_completed_rule_id = r.id
        WHERE n.auto_completed = TRUE
          AND n.auto_completed_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY r.rule_name
        ORDER BY count DESC
        LIMIT 5
      `)
    ]);
    
    return {
      totalRules: parseInt(rulesResult.rows[0].total),
      activeRules: parseInt(rulesResult.rows[0].active),
      autoCompletedToday: parseInt(statsResult.rows[0].today),
      autoCompletedThisWeek: parseInt(statsResult.rows[0].week),
      topRules: topRulesResult.rows
    };
  }
}

// Export singleton instance
export const workflowProgressionService = new WorkflowProgressionService();







