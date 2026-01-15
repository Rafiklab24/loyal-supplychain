/**
 * ShipmentStatusEngine - Automatic Rule-Based Status Calculation
 * 
 * This service implements a deterministic status engine for shipments.
 * Status is NEVER manually selectable - it is always derived from:
 * - System dates (current date vs ETA, agreed shipping date)
 * - Entered data (BL/AWB number, clearance date)
 * - Explicit events (warehouse confirmation)
 * 
 * Status Workflow:
 * 1. PLANNING     - Default initial state
 * 2. DELAYED      - Agreed shipping date passed, no BL/AWB
 * 3. SAILED       - BL/AWB entered AND ETA available
 * 4. AWAITING_CLEARANCE - ETA date <= current date (arrived at port)
 * 5. LOADED_TO_FINAL    - Clearance date recorded
 * 6. RECEIVED     - Warehouse confirmed without issues
 * 7. QUALITY_ISSUE - Warehouse confirmed with issues
 */

import logger from '../utils/logger';
import { pool } from '../db/client';

// ============================================================
// TYPES
// ============================================================

export type ShipmentStatus = 
  | 'planning'
  | 'delayed'
  | 'sailed'
  | 'awaiting_clearance'
  | 'pending_transport'  // Cleared, assigned to transport agent, waiting for car assignment
  | 'loaded_to_final'    // Cars assigned, on the way to final destination
  | 'received'
  | 'quality_issue';

// Selling workflow statuses (for outgoing/sales shipments)
export type SellingStatus = 
  | 'draft'           // Initial creation, quotation stage
  | 'confirmed'       // Contract signed, sale confirmed
  | 'docs_prep'       // Preparing certificates and documents
  | 'beyaname_issued' // Customs export clearance received
  | 'loading'         // Goods being loaded
  | 'in_transit'      // En route to buyer
  | 'delivered'       // Goods delivered to buyer
  | 'completed';      // Payment received, sale closed

export interface ShipmentStatusData {
  id: string;
  current_status?: string | null;
  
  // From shipment_logistics
  bl_no?: string | null;
  eta?: string | null;  // ISO date string
  agreed_shipping_date?: string | null;  // ISO date string
  customs_clearance_date?: string | null;  // ISO date string
  
  // From shipment_documents
  warehouse_receipt_confirmed?: boolean;
  warehouse_receipt_has_issues?: boolean;
  delivery_confirmed_at?: string | null;
  delivery_has_issues?: boolean;
  
  // From outbound_deliveries - for loaded_to_final trigger
  has_transport_assigned?: boolean;  // True if outbound_delivery exists with truck assigned
}

export interface StatusCalculationResult {
  status: ShipmentStatus;
  reason: string;
  reason_ar: string;  // Arabic translation
  trigger_type: 'data_change' | 'date_check' | 'warehouse_confirm' | 'initial' | 'manual_override';
  data_snapshot: Record<string, any>;
}

// Fields that trigger status recalculation when changed
export const STATUS_TRIGGER_FIELDS = [
  'bl_no',
  'eta',
  'agreed_shipping_date',
  'customs_clearance_date',
  'warehouse_receipt_confirmed',
  'warehouse_receipt_has_issues',
  'delivery_confirmed_at',
  'delivery_has_issues',
];

// Status display configuration
export const STATUS_CONFIG: Record<ShipmentStatus, {
  label: string;
  label_ar: string;
  color: string;
  order: number;
  description: string;
  description_ar: string;
}> = {
  planning: {
    label: 'Planning',
    label_ar: 'تخطيط',
    color: 'gray',
    order: 1,
    description: 'Shipment is being planned. Waiting for booking details.',
    description_ar: 'الشحنة قيد التخطيط. في انتظار تفاصيل الحجز.'
  },
  delayed: {
    label: 'Delayed',
    label_ar: 'متأخر',
    color: 'red',
    order: 2,
    description: 'Agreed shipping date has passed but no Bill of Lading received.',
    description_ar: 'تاريخ الشحن المتفق عليه قد مر ولم يتم استلام بوليصة الشحن.'
  },
  sailed: {
    label: 'Sailed / In Transit',
    label_ar: 'أبحرت / في الطريق',
    color: 'blue',
    order: 3,
    description: 'Shipment is in transit. Bill of Lading received.',
    description_ar: 'الشحنة في الطريق. تم استلام بوليصة الشحن.'
  },
  awaiting_clearance: {
    label: 'Awaiting Clearance',
    label_ar: 'في انتظار التخليص',
    color: 'amber',
    order: 4,
    description: 'Shipment has arrived at port. Waiting for customs clearance.',
    description_ar: 'وصلت الشحنة إلى الميناء. في انتظار التخليص الجمركي.'
  },
  pending_transport: {
    label: 'Pending Transport',
    label_ar: 'في انتظار تعيين النقل',
    color: 'indigo',
    order: 5,
    description: 'Customs cleared. Assigned to transport agent, waiting for vehicle assignment.',
    description_ar: 'تم التخليص الجمركي. تم التعيين لوكيل النقل، في انتظار تعيين السيارات.'
  },
  loaded_to_final: {
    label: 'On Way to Final Destination',
    label_ar: 'في الطريق إلى الوجهة النهائية',
    color: 'purple',
    order: 6,
    description: 'Transport assigned. Shipment is on the way to final destination.',
    description_ar: 'تم تعيين النقل. الشحنة في الطريق إلى الوجهة النهائية.'
  },
  received: {
    label: 'Received',
    label_ar: 'تم الاستلام',
    color: 'green',
    order: 7,
    description: 'Shipment received at warehouse without issues.',
    description_ar: 'تم استلام الشحنة في المستودع بدون مشاكل.'
  },
  quality_issue: {
    label: 'Quality Issue',
    label_ar: 'مشكلة جودة',
    color: 'orange',
    order: 8,
    description: 'Shipment received with quality issues. Follow-up required.',
    description_ar: 'تم استلام الشحنة مع مشاكل في الجودة. مطلوب متابعة.'
  }
};

// Selling status display configuration (for outgoing/sales shipments)
export const SELLING_STATUS_CONFIG: Record<SellingStatus, {
  label: string;
  label_ar: string;
  color: string;
  order: number;
  description: string;
  description_ar: string;
}> = {
  draft: {
    label: 'Draft',
    label_ar: 'مسودة',
    color: 'gray',
    order: 1,
    description: 'Sale is in draft/quotation stage.',
    description_ar: 'البيع في مرحلة المسودة/العرض.'
  },
  confirmed: {
    label: 'Confirmed',
    label_ar: 'مؤكد',
    color: 'blue',
    order: 2,
    description: 'Contract signed, sale confirmed.',
    description_ar: 'تم توقيع العقد، البيع مؤكد.'
  },
  docs_prep: {
    label: 'Documents Preparation',
    label_ar: 'تحضير المستندات',
    color: 'indigo',
    order: 3,
    description: 'Preparing certificates and export documents.',
    description_ar: 'تحضير الشهادات ومستندات التصدير.'
  },
  beyaname_issued: {
    label: 'Beyaname Issued',
    label_ar: 'صدور البيانامه',
    color: 'purple',
    order: 4,
    description: 'Customs export declaration (Beyaname) has been issued.',
    description_ar: 'تم إصدار بيان التصدير الجمركي (البيانامه).'
  },
  loading: {
    label: 'Loading',
    label_ar: 'جاري التحميل',
    color: 'amber',
    order: 5,
    description: 'Goods are being loaded for transport.',
    description_ar: 'يتم تحميل البضائع للنقل.'
  },
  in_transit: {
    label: 'In Transit',
    label_ar: 'في الطريق',
    color: 'cyan',
    order: 6,
    description: 'Shipment is en route to buyer.',
    description_ar: 'الشحنة في الطريق إلى المشتري.'
  },
  delivered: {
    label: 'Delivered',
    label_ar: 'تم التسليم',
    color: 'green',
    order: 7,
    description: 'Goods delivered to buyer.',
    description_ar: 'تم تسليم البضائع للمشتري.'
  },
  completed: {
    label: 'Completed',
    label_ar: 'مكتمل',
    color: 'emerald',
    order: 8,
    description: 'Payment received, sale closed.',
    description_ar: 'تم استلام الدفعة، البيع مغلق.'
  }
};

/**
 * Get selling status display info
 */
export function getSellingStatusDisplayInfo(status: SellingStatus | string) {
  const normalizedStatus = status as SellingStatus;
  return SELLING_STATUS_CONFIG[normalizedStatus] || SELLING_STATUS_CONFIG.draft;
}

// ============================================================
// CORE STATUS ENGINE
// ============================================================

/**
 * Calculate the shipment status based on current data.
 * This is the SINGLE SOURCE OF TRUTH for status determination.
 * 
 * Rule evaluation order (later rules take precedence):
 * 1. Default: planning
 * 2. Check delayed: agreed_date passed & no BL
 * 3. Check sailed: BL + ETA exist
 * 4. Check awaiting_clearance: ETA <= today
 * 5. Check loaded_to_final: clearance_date exists
 * 6. Check received/quality_issue: warehouse confirmation
 */
export function calculateShipmentStatus(data: ShipmentStatusData): StatusCalculationResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);  // Normalize to start of day
  
  const snapshot: Record<string, any> = {
    calculated_at: new Date().toISOString(),
    today: today.toISOString().split('T')[0],
    bl_no: data.bl_no,
    eta: data.eta,
    agreed_shipping_date: data.agreed_shipping_date,
    customs_clearance_date: data.customs_clearance_date,
    warehouse_receipt_confirmed: data.warehouse_receipt_confirmed,
    warehouse_receipt_has_issues: data.warehouse_receipt_has_issues,
    has_transport_assigned: data.has_transport_assigned,
    // Legacy fields
    delivery_confirmed_at: data.delivery_confirmed_at,
    delivery_has_issues: data.delivery_has_issues,
  };
  
  // Helper to parse dates safely
  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };
  
  const eta = parseDate(data.eta);
  const agreedDate = parseDate(data.agreed_shipping_date);
  const clearanceDate = parseDate(data.customs_clearance_date);
  const hasBL = !!data.bl_no && data.bl_no.trim().length > 0;
  
  // Check warehouse confirmation (highest priority - event-based)
  // Support both new fields and legacy fields
  const warehouseConfirmed = data.warehouse_receipt_confirmed || !!data.delivery_confirmed_at;
  const hasQualityIssues = data.warehouse_receipt_has_issues || data.delivery_has_issues;
  
  if (warehouseConfirmed) {
    if (hasQualityIssues) {
      return {
        status: 'quality_issue',
        reason: 'Warehouse confirmed receipt with quality issues.',
        reason_ar: 'المستودع أكد الاستلام مع وجود مشاكل في الجودة.',
        trigger_type: 'warehouse_confirm',
        data_snapshot: snapshot
      };
    }
    return {
      status: 'received',
      reason: 'Warehouse confirmed receipt without issues.',
      reason_ar: 'المستودع أكد الاستلام بدون مشاكل.',
      trigger_type: 'warehouse_confirm',
      data_snapshot: snapshot
    };
  }
  
  // Check if customs cleared (clearance date exists)
  if (clearanceDate) {
    // Check if transport has been assigned (outbound_delivery with truck)
    if (data.has_transport_assigned) {
      return {
        status: 'loaded_to_final',
        reason: `Transport assigned. On the way to final destination.`,
        reason_ar: `تم تعيين النقل. في الطريق إلى الوجهة النهائية.`,
        trigger_type: 'data_change',
        data_snapshot: snapshot
      };
    }
    // Customs cleared but waiting for transport assignment
    return {
      status: 'pending_transport',
      reason: `Customs cleared on ${data.customs_clearance_date}. Assigned to transport agent, waiting for vehicle assignment.`,
      reason_ar: `تم التخليص الجمركي في ${data.customs_clearance_date}. في انتظار تعيين السيارات.`,
      trigger_type: 'data_change',
      data_snapshot: snapshot
    };
  }
  
  // Check if arrived at port (ETA <= today and has BL)
  if (hasBL && eta && eta <= today) {
    return {
      status: 'awaiting_clearance',
      reason: `Arrived at port on ${data.eta}. Awaiting customs clearance.`,
      reason_ar: `وصلت إلى الميناء في ${data.eta}. في انتظار التخليص الجمركي.`,
      trigger_type: 'date_check',
      data_snapshot: snapshot
    };
  }
  
  // Check if sailed (BL + ETA exist)
  if (hasBL && eta) {
    return {
      status: 'sailed',
      reason: `Bill of Lading received. ETA: ${data.eta}.`,
      reason_ar: `تم استلام بوليصة الشحن. الوصول المتوقع: ${data.eta}.`,
      trigger_type: 'data_change',
      data_snapshot: snapshot
    };
  }
  
  // Check if delayed (agreed date passed & no BL)
  if (agreedDate && agreedDate < today && !hasBL) {
    const daysLate = Math.floor((today.getTime() - agreedDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'delayed',
      reason: `Agreed shipping date (${data.agreed_shipping_date}) passed ${daysLate} days ago. No Bill of Lading received.`,
      reason_ar: `تاريخ الشحن المتفق عليه (${data.agreed_shipping_date}) مر منذ ${daysLate} يوم. لم يتم استلام بوليصة الشحن.`,
      trigger_type: 'date_check',
      data_snapshot: snapshot
    };
  }
  
  // Default: Planning
  let reason = 'Shipment is in planning phase.';
  let reason_ar = 'الشحنة في مرحلة التخطيط.';
  
  if (!hasBL && !eta) {
    reason = 'Waiting for Bill of Lading and ETA.';
    reason_ar = 'في انتظار بوليصة الشحن وتاريخ الوصول المتوقع.';
  } else if (!hasBL) {
    reason = 'Waiting for Bill of Lading.';
    reason_ar = 'في انتظار بوليصة الشحن.';
  } else if (!eta) {
    reason = 'Waiting for ETA.';
    reason_ar = 'في انتظار تاريخ الوصول المتوقع.';
  }
  
  return {
    status: 'planning',
    reason,
    reason_ar,
    trigger_type: 'initial',
    data_snapshot: snapshot
  };
}


/**
 * Check if any of the changed fields should trigger status recalculation
 */
export function shouldRecalculateStatus(changedFields: string[]): boolean {
  return changedFields.some(field => STATUS_TRIGGER_FIELDS.includes(field));
}


/**
 * Get status display info
 */
export function getStatusDisplayInfo(status: ShipmentStatus | string) {
  const normalizedStatus = status as ShipmentStatus;
  return STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.planning;
}


// ============================================================
// DATABASE OPERATIONS
// ============================================================

/**
 * Load shipment data needed for status calculation
 */
export async function loadShipmentStatusData(shipmentId: string): Promise<ShipmentStatusData | null> {
  const result = await pool.query(`
    SELECT 
      s.id,
      s.status as current_status,
      l.bl_no,
      l.eta,
      l.agreed_shipping_date,
      l.customs_clearance_date,
      d.warehouse_receipt_confirmed,
      d.warehouse_receipt_has_issues,
      d.delivery_confirmed_at,
      d.delivery_has_issues,
      -- Check if transport is assigned (outbound_delivery exists with truck plate number)
      EXISTS (
        SELECT 1 FROM logistics.outbound_deliveries od 
        WHERE od.shipment_id = s.id 
          AND od.is_deleted = FALSE
          AND od.truck_plate_number IS NOT NULL 
          AND od.truck_plate_number != ''
      ) as has_transport_assigned
    FROM logistics.shipments s
    LEFT JOIN logistics.shipment_logistics l ON l.shipment_id = s.id
    LEFT JOIN logistics.shipment_documents d ON d.shipment_id = s.id
    WHERE s.id = $1 AND s.is_deleted = FALSE
  `, [shipmentId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
}


/**
 * Update shipment status in database and record audit
 */
export async function updateShipmentStatus(
  shipmentId: string,
  result: StatusCalculationResult,
  calculatedBy: string = 'system'
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current status for audit
    const currentResult = await client.query(
      'SELECT status FROM logistics.shipments WHERE id = $1',
      [shipmentId]
    );
    const previousStatus = currentResult.rows[0]?.status;
    
    // Only update and audit if status actually changed
    if (previousStatus !== result.status) {
      // Update shipment status
      await client.query(`
        UPDATE logistics.shipments
        SET 
          status = $2,
          status_reason = $3,
          status_calculated_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [shipmentId, result.status, result.reason]);
      
      // Record in audit table
      await client.query(`
        INSERT INTO logistics.shipment_status_audit (
          shipment_id,
          previous_status,
          new_status,
          status_reason,
          trigger_type,
          trigger_details,
          calculated_by,
          data_snapshot
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        shipmentId,
        previousStatus,
        result.status,
        result.reason,
        result.trigger_type,
        JSON.stringify({ calculated_at: new Date().toISOString() }),
        calculatedBy,
        JSON.stringify(result.data_snapshot)
      ]);
      
      logger.info(`📊 Status updated: ${shipmentId} ${previousStatus} → ${result.status}`);
    } else {
      // Just update the reason and timestamp even if status unchanged
      await client.query(`
        UPDATE logistics.shipments
        SET 
          status_reason = $2,
          status_calculated_at = NOW()
        WHERE id = $1
      `, [shipmentId, result.reason]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


/**
 * Recalculate and update status for a shipment
 * This is the main entry point for status updates
 */
export async function recalculateShipmentStatus(
  shipmentId: string,
  calculatedBy: string = 'system'
): Promise<StatusCalculationResult | null> {
  const data = await loadShipmentStatusData(shipmentId);
  
  if (!data) {
    logger.warn(`Cannot recalculate status: Shipment ${shipmentId} not found`);
    return null;
  }
  
  const result = calculateShipmentStatus(data);
  await updateShipmentStatus(shipmentId, result, calculatedBy);
  
  return result;
}


/**
 * Batch recalculate status for shipments that need date-based transitions
 * Called by scheduled job
 */
export async function recalculateDateBasedStatuses(): Promise<{
  processed: number;
  updated: number;
  errors: number;
}> {
  logger.info('🔄 Starting date-based status recalculation...');
  
  let processed = 0;
  let updated = 0;
  let errors = 0;
  
  try {
    // Find shipments that might need status updates based on dates:
    // 1. Planning/Delayed shipments where agreed_date might have passed
    // 2. Sailed shipments where ETA might have arrived
    const result = await pool.query(`
      SELECT s.id, s.status
      FROM logistics.shipments s
      LEFT JOIN logistics.shipment_logistics l ON l.shipment_id = s.id
      WHERE s.is_deleted = FALSE
        AND s.status IN ('planning', 'delayed', 'sailed')
        AND (
          -- Check if agreed_date might trigger delay
          (s.status = 'planning' AND l.agreed_shipping_date IS NOT NULL AND l.agreed_shipping_date < CURRENT_DATE)
          OR
          -- Check if ETA might trigger awaiting_clearance
          (s.status = 'sailed' AND l.eta IS NOT NULL AND l.eta <= CURRENT_DATE)
          OR
          -- Recheck delayed shipments (might have gotten BL)
          (s.status = 'delayed')
        )
      ORDER BY s.updated_at DESC
      LIMIT 1000
    `);
    
    for (const row of result.rows) {
      processed++;
      
      try {
        const data = await loadShipmentStatusData(row.id);
        if (!data) continue;
        
        const calcResult = calculateShipmentStatus(data);
        
        if (calcResult.status !== row.status) {
          await updateShipmentStatus(row.id, calcResult, 'scheduled_job');
          updated++;
          logger.info(`  ✓ ${row.id}: ${row.status} → ${calcResult.status}`);
        }
      } catch (error) {
        errors++;
        logger.error(`  ✗ Error processing ${row.id}:`, error);
      }
    }
    
    logger.info(`✅ Date-based recalculation complete: ${updated}/${processed} updated, ${errors} errors`);
    
  } catch (error) {
    logger.error('❌ Error in date-based status recalculation:', error);
    throw error;
  }
  
  return { processed, updated, errors };
}


/**
 * Confirm warehouse receipt for a shipment
 * This is the ONLY way to transition to received/quality_issue status
 */
export async function confirmWarehouseReceipt(
  shipmentId: string,
  hasIssues: boolean,
  confirmedBy: string,
  notes?: string
): Promise<StatusCalculationResult> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update warehouse receipt fields
    await client.query(`
      UPDATE logistics.shipment_documents
      SET 
        warehouse_receipt_confirmed = TRUE,
        warehouse_receipt_confirmed_at = NOW(),
        warehouse_receipt_confirmed_by = $2,
        warehouse_receipt_has_issues = $3,
        warehouse_receipt_notes = $4,
        updated_at = NOW()
      WHERE shipment_id = $1
    `, [shipmentId, confirmedBy, hasIssues, notes]);
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  // Now recalculate status
  const result = await recalculateShipmentStatus(shipmentId, confirmedBy);
  
  if (!result) {
    throw new Error(`Failed to recalculate status for shipment ${shipmentId}`);
  }
  
  return result;
}


/**
 * Manually override shipment status with required reason
 * 
 * This allows users to temporarily override the automatic status.
 * The system can still auto-recalculate later when data changes.
 * The override reason is preserved in the audit trail.
 */
export async function manualStatusOverride(
  shipmentId: string,
  newStatus: ShipmentStatus,
  reason: string,
  overriddenBy: string
): Promise<StatusCalculationResult> {
  if (!reason || reason.trim().length < 10) {
    throw new Error('Override reason must be at least 10 characters');
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current status for audit
    const currentResult = await client.query(
      'SELECT status, status_reason FROM logistics.shipments WHERE id = $1',
      [shipmentId]
    );
    
    if (currentResult.rows.length === 0) {
      throw new Error(`Shipment ${shipmentId} not found`);
    }
    
    const previousStatus = currentResult.rows[0]?.status;
    const previousReason = currentResult.rows[0]?.status_reason;
    
    // Update shipment with manual override
    await client.query(`
      UPDATE logistics.shipments
      SET 
        status = $2,
        status_reason = $3,
        status_override_by = $4,
        status_override_at = NOW(),
        status_override_reason = $5,
        status_calculated_at = NOW(),
        updated_at = NOW(),
        updated_by = $4
      WHERE id = $1
    `, [shipmentId, newStatus, reason, overriddenBy, reason]);
    
    // Build data snapshot for audit
    const dataSnapshot = {
      previous_status: previousStatus,
      previous_reason: previousReason,
      override_by: overriddenBy,
      override_at: new Date().toISOString(),
    };
    
    // Record in audit table
    await client.query(`
      INSERT INTO logistics.shipment_status_audit (
        shipment_id,
        previous_status,
        new_status,
        status_reason,
        trigger_type,
        trigger_details,
        calculated_by,
        data_snapshot
      ) VALUES ($1, $2, $3, $4, 'manual_override', $5, $6, $7)
    `, [
      shipmentId,
      previousStatus,
      newStatus,
      reason,
      JSON.stringify({ 
        override_reason: reason,
        overridden_by: overriddenBy,
      }),
      overriddenBy,
      JSON.stringify(dataSnapshot)
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`📝 Manual override: ${shipmentId} ${previousStatus} → ${newStatus} by ${overriddenBy}`);
    logger.info(`   Reason: ${reason}`);
    
    const statusConfig = STATUS_CONFIG[newStatus];
    
    return {
      status: newStatus,
      reason: reason,
      reason_ar: reason, // User-provided reason is used as-is
      trigger_type: 'manual_override',
      data_snapshot: dataSnapshot,
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


/**
 * Clear manual override and recalculate status automatically
 * Call this when you want to return a shipment to automatic status management
 */
export async function clearManualOverride(
  shipmentId: string,
  clearedBy: string
): Promise<StatusCalculationResult | null> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Clear override fields
    await client.query(`
      UPDATE logistics.shipments
      SET 
        status_override_by = NULL,
        status_override_at = NULL,
        status_override_reason = NULL,
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $1
    `, [shipmentId, clearedBy]);
    
    await client.query('COMMIT');
    
    logger.info(`🔄 Manual override cleared for ${shipmentId} by ${clearedBy}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  // Now recalculate status automatically
  return recalculateShipmentStatus(shipmentId, clearedBy);
}


// ============================================================
// EXPORTS
// ============================================================

export const shipmentStatusEngine = {
  calculateShipmentStatus,
  shouldRecalculateStatus,
  getStatusDisplayInfo,
  loadShipmentStatusData,
  updateShipmentStatus,
  recalculateShipmentStatus,
  recalculateDateBasedStatuses,
  confirmWarehouseReceipt,
  manualStatusOverride,
  clearManualOverride,
  STATUS_CONFIG,
  STATUS_TRIGGER_FIELDS,
};

export default shipmentStatusEngine;

