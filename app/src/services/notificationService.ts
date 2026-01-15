/**
 * NotificationService - Buyer Workflow Notification System
 * 
 * Generates color-coded notifications for the entire shipment lifecycle:
 * - Contract creation and documentation
 * - Advance payments
 * - Shipping deadlines
 * - Document requests
 * - Balance payments (2 weeks and 8 days critical)
 * - Customs clearance
 * - Delivery confirmation
 * - Quality checks and issue follow-up
 */

import { pool } from '../db/client';
import { calculateDemurrageStatus, isClearanceEntryOverdue } from '../utils/demurrageCalculator';
import { workflowProgressionService } from './workflowProgressionService';
import logger from '../utils/logger';

interface NotificationRule {
  type: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  actionRequired?: string;
  actionRequired_ar?: string;
  dueDate?: Date;
  autoEscalateHours?: number;
}

interface Contract {
  id: string;
  contract_no: string;
  status: string;
  buyer_company_id: string;
  seller_company_id: string;
  signed_at?: Date;
  valid_from?: Date;
  valid_to?: Date;
  created_at: Date;
  notification_metadata?: any;
}

interface Shipment {
  id: string;
  sn: string;
  transaction_type?: 'incoming' | 'outgoing'; // renamed from 'direction'
  contract_id?: string;
  product_text?: string;
  status?: string;
  eta?: Date;
  contract_ship_date?: Date;
  bl_date?: Date;
  deposit_date?: Date;
  created_at?: Date;
  total_value_usd?: number;
  paid_value_usd?: number;
  balance_value_usd?: number;
  paperwork_status?: string;
  free_time_days?: number;
  customs_clearance_date?: Date;
  notification_metadata?: any;
}

interface PaymentSchedule {
  id: string;
  contract_id: string;
  seq: number;
  basis: string;
  days_after?: number;
  percent?: number;
  amount?: number;
  is_deferred: boolean;
}

export class NotificationService {
  
  /**
   * Check all contracts and shipments for notification triggers
   */
  async checkAndGenerateNotifications(): Promise<void> {
    logger.info('🔔 Running comprehensive notification check...');
    
    try {
      // Check all active contracts
      await this.checkAllContracts();
      
      // Check all shipments
      await this.checkAllShipments();
      
      // Auto-complete notifications based on workflow progression
      await this.checkAndAutoCompleteNotifications();
      
      logger.info('✅ Notification check completed');
    } catch (error) {
      logger.error('❌ Error in notification check:', error);
      throw error;
    }
  }
  
  /**
   * Auto-complete notifications when workflow progression is detected
   * This runs after generating new notifications to clean up obsolete ones
   */
  private async checkAndAutoCompleteNotifications(): Promise<void> {
    try {
      const result = await workflowProgressionService.checkAndAutoComplete();
      if (result.autoCompleted > 0) {
        logger.info(`📋 Auto-completed ${result.autoCompleted} notifications based on workflow progression`);
      }
    } catch (error) {
      logger.error('❌ Error in workflow progression check:', error);
      // Don't throw - auto-completion failure shouldn't block notification generation
    }
  }
  
  /**
   * Check all active contracts (limited to most recent)
   */
  private async checkAllContracts(): Promise<void> {
    // Limit to 30 most recent active contracts
    const result = await pool.query<Contract>(`
      SELECT * FROM logistics.contracts
      WHERE is_deleted = FALSE
        AND status IN ('ACTIVE', 'DRAFT')
      ORDER BY created_at DESC
      LIMIT 30
    `);
    
    logger.info(`Checking ${result.rows.length} contracts for notifications...`);
    
    for (const contract of result.rows) {
      await this.checkContractNotifications(contract.id);
    }
  }
  
  /**
   * Check all shipments (limited to most urgent)
   */
  private async checkAllShipments(): Promise<void> {
    // Limit to 50 most urgent shipments to prevent overwhelming the system
    // NOTE: Use v_shipments_complete view for SELECT (base table was normalized)
    const result = await pool.query<Shipment>(`
      SELECT * FROM logistics.v_shipments_complete
      WHERE is_deleted = FALSE
        AND status NOT IN ('delivered', 'invoiced')
      ORDER BY 
        CASE 
          WHEN eta IS NOT NULL AND eta < NOW() + INTERVAL '7 days' THEN 0
          WHEN contract_ship_date IS NOT NULL AND contract_ship_date < NOW() + INTERVAL '7 days' THEN 1
          ELSE 2
        END,
        eta ASC NULLS LAST,
        created_at DESC
      LIMIT 50
    `);
    
    logger.info(`Checking ${result.rows.length} shipments for notifications...`);
    
    for (const shipment of result.rows) {
      await this.checkShipmentNotifications(shipment.id);
    }
  }
  
  /**
   * Check contract-specific notifications
   */
  async checkContractNotifications(contractId: string): Promise<void> {
    const contractResult = await pool.query<Contract>(`
      SELECT * FROM logistics.contracts WHERE id = $1 AND is_deleted = FALSE
    `, [contractId]);
    
    if (contractResult.rows.length === 0) return;
    
    const contract = contractResult.rows[0];
    
    // Check for contract creation notification
    await this.checkContractCreatedNotification(contract);
    
    // Check for advance payment due notification
    await this.checkAdvancePaymentNotification(contract);
    
    // Update last notification check
    await pool.query(`
      UPDATE logistics.contracts
      SET last_notification_check = NOW()
      WHERE id = $1
    `, [contractId]);
  }
  
  /**
   * Check shipment-specific notifications
   */
  async checkShipmentNotifications(shipmentId: string): Promise<void> {
    // NOTE: Use v_shipments_complete view for SELECT (base table was normalized)
    const shipmentResult = await pool.query<Shipment>(`
      SELECT * FROM logistics.v_shipments_complete WHERE id = $1 AND is_deleted = FALSE
    `, [shipmentId]);
    
    if (shipmentResult.rows.length === 0) return;
    
    const shipment = shipmentResult.rows[0];
    
    // Branch based on shipment transaction_type (renamed from direction)
    if (shipment.transaction_type === 'outgoing') {
      // SELLER WORKFLOW: Check seller-specific notifications
      await this.checkSellerContractCreatedNotification(shipment);
      await this.checkSellerShippingDeadlineNotification(shipment);
      await this.checkSellerBookingShareNotification(shipment);
      await this.checkSellerGoodsLoadedNotification(shipment);
      await this.checkSellerPaymentReminders(shipment);
      await this.checkSellerSendOriginalDocsNotification(shipment);
      await this.checkSellerArrivalFollowupNotification(shipment);
      await this.checkSellerQualityFeedbackNotification(shipment);
    } else {
      // BUYER WORKFLOW: Check buyer-specific notifications
      await this.checkShippingDeadlineNotification(shipment);
      await this.checkDocumentsNeededNotification(shipment);
      await this.checkBalancePaymentNotifications(shipment);
      await this.checkCustomsClearanceNotification(shipment);
      await this.checkDeliveryStatusNotification(shipment);
      await this.checkQualityCheckNotification(shipment);
      // Demurrage-related notifications
      await this.checkClearanceEntryOverdueNotification(shipment);
      await this.checkDemurrageWarningNotification(shipment);
      await this.checkDemurrageExceededNotification(shipment);
    }
    
    // Update last notification check
    await pool.query(`
      UPDATE logistics.shipments
      SET last_notification_check = NOW()
      WHERE id = $1
    `, [shipmentId]);
  }
  
  /**
   * Contract Created Notification
   * Trigger: When contract status is ACTIVE and no notification sent
   */
  private async checkContractCreatedNotification(contract: Contract): Promise<void> {
    if (contract.status !== 'ACTIVE') return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('send_contract_to_supplier', null, contract.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'send_contract_to_supplier',
      severity: 'info',
      title: 'Send contract documents to supplier',
      title_ar: 'إرسال مستندات العقد للمورد',
      message: `Contract ${contract.contract_no} is active. Send signed proforma, markings, and shipping instructions to supplier.`,
      message_ar: `العقد ${contract.contract_no} نشط. أرسل الفاتورة الأولية الموقعة والعلامات وتعليمات الشحن للمورد.`,
      actionRequired: 'Send to supplier:\n1. Signed proforma invoice\n2. Product markings/labels\n3. Shipping instructions',
      actionRequired_ar: 'أرسل للمورد:\n1. فاتورة أولية موقعة\n2. علامات/بطاقات المنتج\n3. تعليمات الشحن',
      dueDate: this.addDays(new Date(), 3), // 3 days to send docs
      autoEscalateHours: 72,
    }, null, contract.id);
  }
  
  /**
   * Advance Payment Due Notification
   */
  private async checkAdvancePaymentNotification(contract: Contract): Promise<void> {
    if (contract.status !== 'ACTIVE') return;
    
    // Get payment schedule
    const { advancePayment } = await this.getPaymentSchedule(contract.id);
    if (!advancePayment) return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('advance_payment_due', null, contract.id);
    if (exists) return;
    
    // Calculate due date based on payment schedule
    const dueDate = this.calculatePaymentDueDate(advancePayment, contract);
    if (!dueDate) return;
    
    const daysUntilDue = this.daysBetween(new Date(), dueDate);
    
    if (daysUntilDue <= 7 && daysUntilDue >= 0) {
      const severity = this.determineSeverity(daysUntilDue);
      
      await this.createNotification({
        type: 'advance_payment_due',
        severity,
        title: `Advance payment ${severity === 'error' ? 'OVERDUE' : 'due'}`,
        title_ar: severity === 'error' ? 'الدفعة المقدمة متأخرة' : 'الدفعة المقدمة مستحقة',
        message: `Contract ${contract.contract_no}: Advance payment (${advancePayment.percent}%) due in ${daysUntilDue} days.`,
        message_ar: `العقد ${contract.contract_no}: الدفعة المقدمة (${advancePayment.percent}%) مستحقة خلال ${daysUntilDue} يوم.`,
        actionRequired: 'Process advance payment and confirm with supplier',
        actionRequired_ar: 'معالجة الدفعة المقدمة والتأكيد مع المورد',
        dueDate,
        autoEscalateHours: 24,
      }, null, contract.id);
    }
  }
  
  /**
   * Shipping Deadline Approaching Notification
   */
  private async checkShippingDeadlineNotification(shipment: Shipment): Promise<void> {
    if (!shipment.contract_ship_date) return;
    if (shipment.status === 'sailed' || shipment.status === 'arrived' || shipment.status === 'delivered') return;
    
    const daysUntilDeadline = this.daysBetween(new Date(), shipment.contract_ship_date);
    
    // Only notify if deadline is approaching or passed
    if (daysUntilDeadline > 7) return;
    
    // Check if notification already sent recently
    const exists = await this.notificationExists('shipping_deadline_approaching', shipment.id);
    if (exists) return;
    
    const severity = daysUntilDeadline <= 2 ? 'error' : 'warning';
    const daysText = daysUntilDeadline < 0 ? `متأخر ${Math.abs(daysUntilDeadline)} يوم` : `${daysUntilDeadline} يوم`;
    
    await this.createNotification({
      type: 'shipping_deadline_approaching',
      severity,
      title: daysUntilDeadline <= 2 ? '🚨 URGENT: Shipping deadline critical' : 'Shipping deadline approaching',
      title_ar: daysUntilDeadline <= 2 ? '🚨 عاجل: موعد الشحن حرج' : 'موعد الشحن يقترب',
      message: `Shipment ${shipment.sn} should ship by ${this.formatDateDisplay(shipment.contract_ship_date)} (${daysUntilDeadline} days)`,
      message_ar: `الشحنة ${shipment.sn} يجب شحنها بحلول ${this.formatDateDisplay(shipment.contract_ship_date)} (${daysText})`,
      actionRequired: daysUntilDeadline <= 2 
        ? 'Immediate action: Contact supplier NOW to confirm shipping status'
        : 'Contact supplier to confirm shipping schedule',
      actionRequired_ar: daysUntilDeadline <= 2 
        ? 'إجراء فوري: تواصل مع المورد الآن لتأكيد حالة الشحن'
        : 'تواصل مع المورد لتأكيد جدول الشحن',
      dueDate: shipment.contract_ship_date,
    }, shipment.id);
  }
  
  /**
   * Documents Needed Notification
   */
  private async checkDocumentsNeededNotification(shipment: Shipment): Promise<void> {
    if (!['booked', 'loaded', 'sailed'].includes(shipment.status || '')) return;
    
    // Check if documents exist
    const docsResult = await pool.query(`
      SELECT COUNT(*) as doc_count
      FROM archive.documents
      WHERE shipment_id = $1
        AND doc_type IN ('BL_DRAFT', 'BL_FINAL', 'PL', 'COO', 'COA')
    `, [shipment.id]);
    
    const docCount = parseInt(docsResult.rows[0].doc_count);
    
    // If documents exist, no notification needed
    if (docCount >= 3) return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('documents_needed', shipment.id);
    if (exists) return;
    
    const statusAr = this.getStatusArabic(shipment.status || '');
    
    await this.createNotification({
      type: 'documents_needed',
      severity: shipment.status === 'sailed' ? 'warning' : 'info',
      title: 'Request shipping documents from supplier',
      title_ar: 'طلب مستندات الشحن من المورد',
      message: `Shipment ${shipment.sn} is ${shipment.status}. Request documents from supplier.`,
      message_ar: `الشحنة ${shipment.sn} حالتها ${statusAr}. اطلب المستندات من المورد.`,
      actionRequired: 'Request from supplier:\n1. Bill of Lading (BL)\n2. Packing List\n3. Loading photos\n4. Quality photos\n5. Certificate of Origin\n6. Certificate of Analysis',
      actionRequired_ar: 'اطلب من المورد:\n1. بوليصة الشحن\n2. قائمة التعبئة\n3. صور التحميل\n4. صور الجودة\n5. شهادة المنشأ\n6. شهادة التحليل',
      dueDate: this.addDays(new Date(), shipment.status === 'sailed' ? 2 : 5),
    }, shipment.id);
  }
  
  /**
   * Balance Payment Notifications (2 weeks and 8 days critical)
   */
  private async checkBalancePaymentNotifications(shipment: Shipment): Promise<void> {
    if (!shipment.eta) return;
    if (shipment.status === 'delivered' || shipment.status === 'invoiced') return;
    
    const daysUntilETA = this.daysBetween(new Date(), shipment.eta);
    
    // Check if balance is paid - ensure balanceRemaining is a number
    const balanceRemaining = Number(shipment.balance_value_usd) || 0;
    const isBalancePaid = balanceRemaining <= 0;
    
    // 2 weeks before ETA - Planning notification
    if (daysUntilETA === 14 && !isBalancePaid) {
      const exists = await this.notificationExists('balance_payment_due_2w', shipment.id);
      if (!exists) {
        await this.createNotification({
          type: 'balance_payment_due_2w',
          severity: 'warning',
          title: 'Balance payment planning needed',
          title_ar: 'تخطيط دفع الرصيد مطلوب',
          message: `Shipment ${shipment.sn} ETA is ${this.formatDateDisplay(shipment.eta)}. Plan balance payment.`,
          message_ar: `الشحنة ${shipment.sn} موعد الوصول ${this.formatDateDisplay(shipment.eta)}. خطط لدفع الرصيد.`,
          actionRequired: '1. Prepare balance payment\n2. Send Proof of Payment (PoP) to supplier\n3. Request final documents',
          actionRequired_ar: '1. تحضير دفع الرصيد\n2. إرسال إثبات الدفع للمورد\n3. طلب المستندات النهائية',
          dueDate: this.addDays(shipment.eta, -8), // Due 8 days before ETA
        }, shipment.id);
      }
    }
    
    // 8 days before ETA - CRITICAL if not paid
    if (daysUntilETA <= 8 && daysUntilETA >= 0 && !isBalancePaid) {
      const exists = await this.notificationExists('balance_payment_critical_8d', shipment.id);
      if (!exists) {
        await this.createNotification({
          type: 'balance_payment_critical_8d',
          severity: 'error',
          title: '🚨 URGENT: Balance payment overdue',
          title_ar: '🚨 عاجل: دفع الرصيد متأخر',
          message: `ETA in ${daysUntilETA} days! Balance payment MUST be made NOW! Amount: $${balanceRemaining.toFixed(2)}`,
          message_ar: `الوصول خلال ${daysUntilETA} يوم! يجب دفع الرصيد الآن! المبلغ: $${balanceRemaining.toFixed(2)}`,
          actionRequired: 'PAY BALANCE IMMEDIATELY - Shipment at risk',
          actionRequired_ar: 'ادفع الرصيد فوراً - الشحنة في خطر',
          dueDate: this.addDays(shipment.eta, -5), // Should be paid 5 days before ETA
          autoEscalateHours: 12,
        }, shipment.id);
      }
    }
    
    // 2 days before ETA - Send docs to customs
    if (daysUntilETA === 2) {
      const exists = await this.notificationExists('send_docs_to_customs', shipment.id);
      if (!exists) {
        await this.createNotification({
          type: 'send_docs_to_customs',
          severity: 'warning',
          title: 'Send documents to customs agent',
          title_ar: 'إرسال المستندات لوكيل الجمارك',
          message: `Shipment ${shipment.sn} ETA: ${this.formatDateDisplay(shipment.eta)}. Send original documents to Qadriye (customs agent).`,
          message_ar: `الشحنة ${shipment.sn} موعد الوصول: ${this.formatDateDisplay(shipment.eta)}. أرسل المستندات الأصلية لوكيل التخليص.`,
          actionRequired: 'Send complete document set to customs clearance agent',
          actionRequired_ar: 'إرسال مجموعة المستندات الكاملة لوكيل التخليص الجمركي',
          dueDate: shipment.eta,
        }, shipment.id);
      }
    }
  }
  
  /**
   * POD Clearance Check Notification
   */
  private async checkCustomsClearanceNotification(shipment: Shipment): Promise<void> {
    if (!shipment.eta || shipment.status !== 'arrived') return;
    
    const daysSinceETA = this.daysBetween(shipment.eta, new Date());
    
    // 2 days after arrival
    if (daysSinceETA === 2) {
      const exists = await this.notificationExists('pod_clearance_check', shipment.id);
      if (!exists) {
        await this.createNotification({
          type: 'pod_clearance_check',
          severity: 'info',
          title: 'Check clearance status',
          title_ar: 'التحقق من حالة التخليص',
          message: `Shipment ${shipment.sn} has arrived. Check with Qadriye on clearance timeline.`,
          message_ar: `وصلت الشحنة ${shipment.sn}. تحقق من جدول التخليص مع وكيل الجمارك.`,
          actionRequired: 'Contact customs agent: When will goods be cleared from POD?',
          actionRequired_ar: 'تواصل مع وكيل الجمارك: متى سيتم تخليص البضائع؟',
          dueDate: this.addDays(new Date(), 1),
        }, shipment.id);
      }
    }
  }
  
  /**
   * Delivery Status Check Notification
   */
  private async checkDeliveryStatusNotification(shipment: Shipment): Promise<void> {
    if (!shipment.eta || shipment.status === 'delivered') return;
    
    const daysSinceETA = this.daysBetween(shipment.eta, new Date());
    
    // 7 days after ETA and not delivered
    if (daysSinceETA === 7) {
      const exists = await this.notificationExists('delivery_status_check', shipment.id);
      if (!exists) {
        await this.createNotification({
          type: 'delivery_status_check',
          severity: 'warning',
          title: 'Delivery status update needed',
          title_ar: 'تحديث حالة التسليم مطلوب',
          message: `It has been 7 days since ETA for shipment ${shipment.sn}. Please update delivery status.`,
          message_ar: `مرت 7 أيام منذ موعد وصول الشحنة ${shipment.sn}. يرجى تحديث حالة التسليم.`,
          actionRequired: 'Confirm: Have goods reached final destination?',
          actionRequired_ar: 'تأكيد: هل وصلت البضائع إلى الوجهة النهائية؟',
          dueDate: this.addDays(new Date(), 1),
        }, shipment.id);
      }
    }
  }
  
  /**
   * Quality Check Notification
   */
  private async checkQualityCheckNotification(shipment: Shipment): Promise<void> {
    if (shipment.status !== 'delivered') return;
    
    // Check if quality check notification already sent
    const exists = await this.notificationExists('quality_check_needed', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'quality_check_needed',
      severity: 'info',
      title: 'Quality check required',
      title_ar: 'فحص الجودة مطلوب',
      message: `Shipment ${shipment.sn} has been delivered. Request warehouse quality inspection.`,
      message_ar: `تم تسليم الشحنة ${shipment.sn}. اطلب فحص الجودة من المستودع.`,
      actionRequired: 'Contact warehouse for quality check and feedback',
      actionRequired_ar: 'تواصل مع المستودع لفحص الجودة والملاحظات',
      dueDate: this.addDays(new Date(), 3),
    }, shipment.id);
  }
  
  // ========== SELLER NOTIFICATION METHODS (OUTGOING SHIPMENTS) ==========
  
  /**
   * SELLER: Contract Created - Ask buyer for signed docs
   */
  private async checkSellerContractCreatedNotification(shipment: Shipment): Promise<void> {
    if (!shipment.contract_id) return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('seller_contract_created', null, shipment.contract_id);
    if (exists) return;
    
    await this.createNotification({
      type: 'seller_contract_created',
      severity: 'info',
      title: 'Request documents from buyer',
      title_ar: 'طلب المستندات من المشتري',
      message: `Shipment ${shipment.sn}: Request buyer to send signed proforma/contract, markings, shipping instructions, and advance payment.`,
      message_ar: `الشحنة ${shipment.sn}: اطلب من المشتري إرسال الفاتورة/العقد الموقع، العلامات، تعليمات الشحن، والدفعة المقدمة.`,
      actionRequired: 'Contact buyer to send:\n1. Signed proforma/contract\n2. Product markings/labels\n3. Shipping instructions\n4. Advance payment (if applicable)',
      actionRequired_ar: 'تواصل مع المشتري لإرسال:\n1. فاتورة/عقد موقع\n2. علامات/بطاقات المنتج\n3. تعليمات الشحن\n4. الدفعة المقدمة (إن وجدت)',
      dueDate: this.addDays(new Date(), 3),
    }, shipment.id, shipment.contract_id);
  }
  
  /**
   * SELLER: Shipping Deadline - Remind warehouse and logistics
   */
  private async checkSellerShippingDeadlineNotification(shipment: Shipment): Promise<void> {
    if (!shipment.contract_ship_date) return;
    if (shipment.status === 'sailed' || shipment.status === 'arrived' || shipment.status === 'delivered') return;
    
    const daysUntilDeadline = this.daysBetween(new Date(), shipment.contract_ship_date);
    
    // Only notify if deadline is approaching
    if (daysUntilDeadline > 5) return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('seller_shipping_deadline', shipment.id);
    if (exists) return;
    
    const severity = daysUntilDeadline <= 2 ? 'error' : 'warning';
    const daysText = daysUntilDeadline < 0 ? `متأخر ${Math.abs(daysUntilDeadline)} يوم` : `${daysUntilDeadline} يوم`;
    
    await this.createNotification({
      type: 'seller_shipping_deadline',
      severity,
      title: daysUntilDeadline <= 2 ? '🚨 URGENT: Shipping deadline critical' : 'Shipping deadline approaching',
      title_ar: daysUntilDeadline <= 2 ? '🚨 عاجل: موعد الشحن حرج' : 'موعد الشحن يقترب',
      message: `Shipment ${shipment.sn} must ship by ${this.formatDateDisplay(shipment.contract_ship_date)} (${daysUntilDeadline} days)`,
      message_ar: `الشحنة ${shipment.sn} يجب شحنها بحلول ${this.formatDateDisplay(shipment.contract_ship_date)} (${daysText})`,
      actionRequired: 'Contact Ayah (Warehousing) and Khatib (Logistics) to prepare shipment',
      actionRequired_ar: 'تواصل مع آية (المستودع) وخطيب (اللوجستية) لتحضير الشحنة',
      dueDate: shipment.contract_ship_date,
    }, shipment.id);
  }
  
  /**
   * SELLER: Booking Details - Share with customer
   */
  private async checkSellerBookingShareNotification(shipment: Shipment): Promise<void> {
    if (shipment.status !== 'booked') return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('seller_booking_share', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'seller_booking_share',
      severity: 'info',
      title: 'Share booking details with customer',
      title_ar: 'مشاركة تفاصيل الحجز مع العميل',
      message: `Shipment ${shipment.sn} is booked. Share booking details with customer (CT).`,
      message_ar: `تم حجز الشحنة ${shipment.sn}. شارك تفاصيل الحجز مع العميل.`,
      actionRequired: 'Send booking confirmation and details to customer',
      actionRequired_ar: 'إرسال تأكيد وتفاصيل الحجز للعميل',
      dueDate: this.addDays(new Date(), 1),
    }, shipment.id);
  }
  
  /**
   * SELLER: Goods Loaded - Issue documents
   */
  private async checkSellerGoodsLoadedNotification(shipment: Shipment): Promise<void> {
    if (shipment.status !== 'loaded' && shipment.status !== 'sailed') return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('seller_goods_loaded', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'seller_goods_loaded',
      severity: 'warning',
      title: 'Issue shipping documents',
      title_ar: 'إصدار مستندات الشحن',
      message: `Shipment ${shipment.sn} is loaded. Customs agent must issue export docs. SCLM must issue in-house docs.`,
      message_ar: `تم تحميل الشحنة ${shipment.sn}. يجب على وكيل الجمارك إصدار مستندات التصدير. يجب إصدار المستندات الداخلية.`,
      actionRequired: '1. Customs agent: Issue shipping documents\n2. SCLM: Issue in-house docs\n3. Share draft with customer for approval',
      actionRequired_ar: '1. وكيل الجمارك: إصدار مستندات الشحن\n2. إصدار المستندات الداخلية\n3. مشاركة المسودة مع العميل للموافقة',
      dueDate: this.addDays(new Date(), 2),
    }, shipment.id);
  }
  
  /**
   * SELLER: Payment Reminders - 7d, 3d, and due date
   */
  private async checkSellerPaymentReminders(shipment: Shipment): Promise<void> {
    if (!shipment.eta) return;
    if (!shipment.contract_id) return;
    
    const daysUntilETA = this.daysBetween(new Date(), shipment.eta);
    
    // Get payment schedule from contract
    const { allPayments } = await this.getPaymentSchedule(shipment.contract_id);
    
    for (const payment of allPayments) {
      const dueDate = this.calculatePaymentDueDate(payment, { signed_at: shipment.created_at } as Contract);
      if (!dueDate) continue;
      
      const daysUntilDue = this.daysBetween(new Date(), dueDate);
      
      // 7 days before reminder
      if (daysUntilDue === 7) {
        const exists = await this.notificationExists('seller_payment_reminder_7d', shipment.id);
        if (!exists) {
          await this.createNotification({
            type: 'seller_payment_reminder_7d',
            severity: 'info',
            title: 'Payment due in 7 days',
            title_ar: 'الدفع مستحق خلال 7 أيام',
            message: `Shipment ${shipment.sn}: Remind customer that payment is due in 7 days.`,
            message_ar: `الشحنة ${shipment.sn}: ذكّر العميل أن الدفع مستحق خلال 7 أيام.`,
            actionRequired: `Contact customer to prepare payment (${payment.percent}% - due ${this.formatDateDisplay(dueDate)})`,
            actionRequired_ar: `تواصل مع العميل لتحضير الدفع (${payment.percent}% - مستحق ${this.formatDateDisplay(dueDate)})`,
            dueDate,
          }, shipment.id);
        }
      }
      
      // 3 days before reminder
      if (daysUntilDue === 3) {
        const exists = await this.notificationExists('seller_payment_reminder_3d', shipment.id);
        if (!exists) {
          await this.createNotification({
            type: 'seller_payment_reminder_3d',
            severity: 'warning',
            title: 'Payment due in 3 days',
            title_ar: 'الدفع مستحق خلال 3 أيام',
            message: `Shipment ${shipment.sn}: Gentle reminder - payment due in 3 days.`,
            message_ar: `الشحنة ${shipment.sn}: تذكير - الدفع مستحق خلال 3 أيام.`,
            actionRequired: `Send reminder to customer: Payment due ${this.formatDateDisplay(dueDate)}`,
            actionRequired_ar: `أرسل تذكيراً للعميل: الدفع مستحق ${this.formatDateDisplay(dueDate)}`,
            dueDate,
          }, shipment.id);
        }
      }
      
      // Due date reminder
      if (daysUntilDue === 0) {
        const exists = await this.notificationExists('seller_payment_due_today', shipment.id);
        if (!exists) {
          await this.createNotification({
            type: 'seller_payment_due_today',
            severity: 'error',
            title: '🚨 Payment due TODAY',
            title_ar: '🚨 الدفع مستحق اليوم',
            message: `Shipment ${shipment.sn}: Payment is due today!`,
            message_ar: `الشحنة ${shipment.sn}: الدفع مستحق اليوم!`,
            actionRequired: 'Contact customer immediately regarding payment',
            actionRequired_ar: 'تواصل مع العميل فوراً بخصوص الدفع',
            dueDate,
          }, shipment.id);
        }
      }
    }
    
    // Balance payment request (2 weeks before ETA)
    if (daysUntilETA === 14) {
      const exists = await this.notificationExists('seller_request_balance', shipment.id);
      if (!exists) {
        await this.createNotification({
          type: 'seller_request_balance',
          severity: 'info',
          title: 'Request balance payment from customer',
          title_ar: 'طلب دفع الرصيد من العميل',
          message: `Shipment ${shipment.sn} ETA is ${this.formatDateDisplay(shipment.eta)} (14 days). Ask customer to pay balance.`,
          message_ar: `الشحنة ${shipment.sn} موعد الوصول ${this.formatDateDisplay(shipment.eta)} (14 يوم). اطلب من العميل دفع الرصيد.`,
          actionRequired: 'Contact customer to arrange balance payment',
          actionRequired_ar: 'تواصل مع العميل لترتيب دفع الرصيد',
          dueDate: this.addDays(shipment.eta, -7), // 7 days before ETA
        }, shipment.id);
      }
    }
  }
  
  /**
   * SELLER: Send Original Documents
   */
  private async checkSellerSendOriginalDocsNotification(shipment: Shipment): Promise<void> {
    // Check if payment is received and drafts approved
    const isBalancePaid = (shipment.balance_value_usd || 0) <= 0;
    const isDraftApproved = (shipment as any).docs_draft_approved || false;
    const isDocsSent = (shipment as any).original_docs_sent || false;
    
    if (!isBalancePaid || !isDraftApproved || isDocsSent) return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('seller_send_original_docs', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'seller_send_original_docs',
      severity: 'warning',
      title: 'Send original documents to customer',
      title_ar: 'إرسال المستندات الأصلية للعميل',
      message: `Shipment ${shipment.sn}: Payment received and drafts approved. Send original documents via courier.`,
      message_ar: `الشحنة ${shipment.sn}: تم استلام الدفع والموافقة على المسودات. أرسل المستندات الأصلية عبر البريد السريع.`,
      actionRequired: '1. Confirm courier address with customer\n2. Send original documents\n3. Provide tracking number',
      actionRequired_ar: '1. تأكيد عنوان الشحن مع العميل\n2. إرسال المستندات الأصلية\n3. تقديم رقم التتبع',
      dueDate: this.addDays(new Date(), 2),
    }, shipment.id);
  }
  
  /**
   * SELLER: Arrival Follow-up
   */
  private async checkSellerArrivalFollowupNotification(shipment: Shipment): Promise<void> {
    if (!shipment.eta) return;
    if (shipment.status !== 'arrived') return;
    
    const daysSinceETA = this.daysBetween(shipment.eta, new Date());
    
    // Check 2 days after arrival
    if (daysSinceETA !== 2) return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('seller_arrival_followup', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'seller_arrival_followup',
      severity: 'info',
      title: 'Follow up on arrival',
      title_ar: 'متابعة الوصول',
      message: `Shipment ${shipment.sn} arrived 2 days ago. Check if everything is in order with customer.`,
      message_ar: `وصلت الشحنة ${shipment.sn} منذ يومين. تحقق مع العميل من أن كل شيء على ما يرام.`,
      actionRequired: 'Contact customer: Is shipment cleared? Any issues?',
      actionRequired_ar: 'تواصل مع العميل: هل تم تخليص الشحنة؟ هل توجد مشاكل؟',
      dueDate: this.addDays(new Date(), 1),
    }, shipment.id);
  }
  
  /**
   * SELLER: Quality Feedback Request
   */
  private async checkSellerQualityFeedbackNotification(shipment: Shipment): Promise<void> {
    if (!shipment.eta) return;
    
    const daysSinceETA = this.daysBetween(shipment.eta, new Date());
    
    // Request feedback 10 days after ETA
    if (daysSinceETA !== 10) return;
    
    const feedbackRequested = (shipment as any).quality_feedback_requested || false;
    if (feedbackRequested) return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('seller_quality_feedback', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'seller_quality_feedback',
      severity: 'info',
      title: 'Request quality feedback',
      title_ar: 'طلب ملاحظات الجودة',
      message: `Shipment ${shipment.sn}: 10 days since arrival. Request quality feedback from customer.`,
      message_ar: `الشحنة ${shipment.sn}: مرت 10 أيام منذ الوصول. اطلب ملاحظات الجودة من العميل.`,
      actionRequired: 'Send message to customer asking for product quality feedback',
      actionRequired_ar: 'أرسل رسالة للعميل تطلب ملاحظات على جودة المنتج',
      dueDate: this.addDays(new Date(), 3),
    }, shipment.id);
    
    // Mark as requested (quality_feedback_requested is in shipment_documents table)
    await pool.query(`
      UPDATE logistics.shipment_documents
      SET quality_feedback_requested = TRUE
      WHERE shipment_id = $1
    `, [shipment.id]);
  }
  
  /**
   * Clearance Entry Overdue Notification
   * Trigger: Shipment has arrived but no customs_clearance_date entered after 3 days
   */
  private async checkClearanceEntryOverdueNotification(shipment: Shipment): Promise<void> {
    const isOverdue = isClearanceEntryOverdue(
      shipment.status || null,
      this.toISOStringSafe(shipment.customs_clearance_date),
      this.toISOStringSafe(shipment.eta),
      3
    );
    
    if (!isOverdue) return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('clearance_overdue', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'clearance_overdue',
      severity: 'warning',
      title: 'Customs Clearance Date Missing',
      title_ar: 'تاريخ التخليص الجمركي مفقود',
      message: `Shipment ${shipment.sn} has arrived but no customs clearance date has been entered. Please contact the customs agent for the clearance date to prevent demurrage charges.`,
      message_ar: `وصلت الشحنة ${shipment.sn} لكن لم يتم إدخال تاريخ التخليص الجمركي. يرجى التواصل مع وكيل الجمارك للحصول على تاريخ التخليص لتجنب رسوم الأرضية.`,
      actionRequired: 'Enter customs clearance date',
      actionRequired_ar: 'إدخال تاريخ التخليص الجمركي',
    }, shipment.id);
  }
  
  /**
   * Demurrage Warning Notification
   * Trigger: Approaching free time deadline (within 2 days)
   */
  private async checkDemurrageWarningNotification(shipment: Shipment): Promise<void> {
    if (!shipment.eta || !shipment.free_time_days) return;
    
    const etaDate = this.formatDate(shipment.eta);
    if (!etaDate) return;
    
    const demurrageStatus = calculateDemurrageStatus(
      etaDate,
      shipment.free_time_days,
      this.formatDate(shipment.customs_clearance_date),
      ['arrived', 'delivered', 'invoiced'].includes(shipment.status || '')
    );
    
    if (demurrageStatus.status !== 'warning') return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('demurrage_warning', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'demurrage_warning',
      severity: 'warning',
      title: 'Demurrage Warning',
      title_ar: 'تحذير: رسوم أرضية',
      message: `Shipment ${shipment.sn} is approaching free time deadline. ${demurrageStatus.message}. Free time ends on ${demurrageStatus.deadlineDate}. Please ensure customs clearance is completed to avoid demurrage charges.`,
      message_ar: `الشحنة ${shipment.sn} تقترب من نهاية الوقت المجاني. ينتهي الوقت المجاني في ${demurrageStatus.deadlineDate}. يرجى التأكد من إتمام التخليص الجمركي لتجنب رسوم الأرضية.`,
      actionRequired: 'Expedite customs clearance',
      actionRequired_ar: 'تسريع التخليص الجمركي',
      dueDate: demurrageStatus.deadlineDate ? new Date(demurrageStatus.deadlineDate) : undefined,
    }, shipment.id);
  }
  
  /**
   * Demurrage Exceeded Notification
   * Trigger: Free time has been exceeded
   */
  private async checkDemurrageExceededNotification(shipment: Shipment): Promise<void> {
    if (!shipment.eta || !shipment.free_time_days) return;
    
    const etaDate = this.formatDate(shipment.eta);
    if (!etaDate) return;
    
    const demurrageStatus = calculateDemurrageStatus(
      etaDate,
      shipment.free_time_days,
      this.formatDate(shipment.customs_clearance_date),
      ['arrived', 'delivered', 'invoiced'].includes(shipment.status || '')
    );
    
    if (demurrageStatus.status !== 'exceeded') return;
    
    // Check if notification already exists
    const exists = await this.notificationExists('demurrage_exceeded', shipment.id);
    if (exists) return;
    
    await this.createNotification({
      type: 'demurrage_exceeded',
      severity: 'error',
      title: 'Demurrage Charges May Apply',
      title_ar: 'قد تُطبق رسوم أرضية',
      message: `URGENT: Shipment ${shipment.sn} has exceeded free time by ${demurrageStatus.daysOverdue} day(s). Demurrage charges are now accruing. Deadline was ${demurrageStatus.deadlineDate}. Please contact accounting to track demurrage costs.`,
      message_ar: `عاجل: الشحنة ${shipment.sn} تجاوزت الوقت المجاني بـ ${demurrageStatus.daysOverdue} يوم. رسوم الأرضية قيد التراكم الآن. كان الموعد النهائي ${demurrageStatus.deadlineDate}. يرجى التواصل مع المحاسبة لتتبع تكاليف الأرضية.`,
      actionRequired: 'Track demurrage costs and expedite clearance',
      actionRequired_ar: 'تتبع تكاليف الأرضية وتسريع التخليص',
    }, shipment.id);
  }
  
  // ========== END SELLER NOTIFICATION METHODS ==========
  
  // ========== QUALITY INCIDENT NOTIFICATION METHODS ==========
  
  /**
   * Quality Incident Created - Notify Supervisor and HQ SCLM
   */
  async notifyQualityIncidentCreated(incidentId: string, shipmentSn: string): Promise<void> {
    const exists = await this.notificationExists('quality_incident_created', null, null);
    if (exists) return;
    
    await this.createNotification({
      type: 'quality_incident_created',
      severity: 'warning',
      title: 'New Quality Incident Reported',
      title_ar: 'تم الإبلاغ عن حادثة جودة جديدة',
      message: `Quality incident reported for shipment ${shipmentSn}. Shipment is now ON HOLD. Review required.`,
      message_ar: `تم الإبلاغ عن حادثة جودة للشحنة ${shipmentSn}. الشحنة الآن محتجزة. المراجعة مطلوبة.`,
      actionRequired: 'Review incident report and take action',
      actionRequired_ar: 'مراجعة تقرير الحادثة واتخاذ إجراء',
      dueDate: this.addDays(new Date(), 1),
    });
  }
  
  /**
   * Quality Incident Submitted - Ready for Review
   */
  async notifyQualityIncidentSubmitted(incidentId: string, shipmentSn: string, issueType: string): Promise<void> {
    await this.createNotification({
      type: 'quality_incident_submitted',
      severity: 'error',
      title: `🚨 Quality Incident Awaiting Review`,
      title_ar: '🚨 حادثة جودة بانتظار المراجعة',
      message: `Quality incident (${issueType}) for shipment ${shipmentSn} has been submitted. Shipment is ON HOLD. Supervisor/HQ action required.`,
      message_ar: `تم تقديم حادثة الجودة (${issueType}) للشحنة ${shipmentSn}. الشحنة محتجزة. إجراء المشرف/المقر مطلوب.`,
      actionRequired: 'Review samples and media, then: Request Resampling / Keep HOLD / Clear HOLD / Close',
      actionRequired_ar: 'مراجعة العينات والوسائط، ثم: طلب إعادة العينات / إبقاء الاحتجاز / رفع الاحتجاز / إغلاق',
      dueDate: this.addDays(new Date(), 1),
      autoEscalateHours: 24,
    });
  }
  
  /**
   * Resampling Requested - Notify Reporter
   */
  async notifyResamplingRequested(incidentId: string, shipmentSn: string, sampleIds: string[]): Promise<void> {
    await this.createNotification({
      type: 'quality_resampling_requested',
      severity: 'warning',
      title: 'Resampling Requested',
      title_ar: 'طلب إعادة العينات',
      message: `Supervisor requested resampling for shipment ${shipmentSn}. Samples to redo: ${sampleIds.join(', ')}`,
      message_ar: `طلب المشرف إعادة العينات للشحنة ${shipmentSn}. العينات المطلوبة: ${sampleIds.join(', ')}`,
      actionRequired: 'Complete the requested samples and resubmit',
      actionRequired_ar: 'إكمال العينات المطلوبة وإعادة الإرسال',
      dueDate: this.addDays(new Date(), 2),
    });
  }
  
  /**
   * HOLD Status Changed
   */
  async notifyHoldStatusChanged(shipmentSn: string, action: 'cleared' | 'kept', reason: string): Promise<void> {
    const severity = action === 'cleared' ? 'success' : 'warning';
    const title = action === 'cleared' ? 'HOLD Cleared' : 'HOLD Maintained';
    const titleAr = action === 'cleared' ? 'تم رفع الاحتجاز' : 'تم الإبقاء على الاحتجاز';
    
    await this.createNotification({
      type: `quality_hold_${action}`,
      severity,
      title: `${title}: ${shipmentSn}`,
      title_ar: `${titleAr}: ${shipmentSn}`,
      message: action === 'cleared' 
        ? `HOLD has been cleared for shipment ${shipmentSn}. Goods can now be sold/processed. Reason: ${reason}`
        : `HOLD is maintained for shipment ${shipmentSn}. Do NOT sell or repack. Reason: ${reason}`,
      message_ar: action === 'cleared'
        ? `تم رفع الاحتجاز للشحنة ${shipmentSn}. يمكن الآن بيع/معالجة البضائع. السبب: ${reason}`
        : `تم الإبقاء على احتجاز الشحنة ${shipmentSn}. لا تبيع أو تعيد التغليف. السبب: ${reason}`,
    });
  }
  
  /**
   * Quality Incident Closed
   */
  async notifyQualityIncidentClosed(incidentId: string, shipmentSn: string, outcome: string): Promise<void> {
    await this.createNotification({
      type: 'quality_incident_closed',
      severity: 'success',
      title: 'Quality Incident Closed',
      title_ar: 'تم إغلاق حادثة الجودة',
      message: `Quality incident for shipment ${shipmentSn} has been closed. Final outcome: ${outcome}`,
      message_ar: `تم إغلاق حادثة الجودة للشحنة ${shipmentSn}. النتيجة النهائية: ${outcome}`,
    });
  }
  
  /**
   * 48-Hour Quality Feedback Reminder
   */
  async createQualityFeedbackReminder(shipmentId: string, shipmentSn: string): Promise<void> {
    const reminderDate = this.addHours(new Date(), 48);
    
    await this.createNotification({
      type: 'quality_feedback_reminder',
      severity: 'info',
      title: 'Quality Feedback Reminder',
      title_ar: 'تذكير بملاحظات الجودة',
      message: `Shipment ${shipmentSn} was marked as delivered. Please provide quality feedback within 48 hours.`,
      message_ar: `تم تسليم الشحنة ${shipmentSn}. يرجى تقديم ملاحظات الجودة خلال 48 ساعة.`,
      actionRequired: 'Check goods quality and report any issues',
      actionRequired_ar: 'فحص جودة البضائع والإبلاغ عن أي مشاكل',
      dueDate: reminderDate,
    }, shipmentId);
  }
  
  // ========== END QUALITY INCIDENT NOTIFICATION METHODS ==========
  
  /**
   * Get payment schedule for a contract
   */
  private async getPaymentSchedule(contractId: string) {
    const result = await pool.query<PaymentSchedule>(`
      SELECT * FROM finance.payment_schedules
      WHERE contract_id = $1
      ORDER BY seq
    `, [contractId]);
    
    const allPayments = result.rows;
    const advancePayment = result.rows.find(r => r.seq === 1);
    const balancePayment = result.rows.find(r => 
      r.basis === 'ON_ARRIVAL' || r.basis === 'ON_DELIVERY' || r.seq === result.rows.length
    );
    
    return { advancePayment, balancePayment, allPayments };
  }
  
  /**
   * Calculate payment due date based on payment schedule and contract
   */
  private calculatePaymentDueDate(payment: PaymentSchedule, contract: Contract): Date | null {
    if (payment.basis === 'ON_BOOKING' && contract.signed_at) {
      return this.addDays(contract.signed_at, payment.days_after || 0);
    }
    
    // For now, default to 7 days after contract signing
    if (contract.signed_at) {
      return this.addDays(contract.signed_at, 7);
    }
    
    return null;
  }
  
  /**
   * Create a notification in the database
   */
  private async createNotification(
    rule: NotificationRule,
    shipmentId: string | null = null,
    contractId: string | null = null
  ): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO logistics.notifications (
          shipment_id,
          contract_id,
          type,
          title,
          title_ar,
          message,
          message_ar,
          severity,
          action_required,
          action_required_ar,
          due_date,
          auto_escalate_at,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        shipmentId,
        contractId,
        rule.type,
        rule.title,
        rule.title_ar,
        rule.message,
        rule.message_ar,
        rule.severity,
        rule.actionRequired || null,
        rule.actionRequired_ar || null,
        rule.dueDate || null,
        rule.autoEscalateHours ? this.addHours(new Date(), rule.autoEscalateHours) : null,
        JSON.stringify({ created_by: 'notification_service' }),
      ]);
      
      logger.info(`✅ Created ${rule.severity} notification: ${rule.type}`);
    } catch (error) {
      logger.error(`❌ Failed to create notification ${rule.type}:`, error);
    }
  }
  
  /**
   * Check if a notification already exists (prevents duplicates)
   */
  private async notificationExists(
    type: string,
    shipmentId: string | null = null,
    contractId: string | null = null
  ): Promise<boolean> {
    const result = await pool.query(`
      SELECT logistics.notification_exists($1, $2, $3) as exists
    `, [type, shipmentId, contractId]);
    
    return result.rows[0].exists;
  }
  
  /**
   * Determine severity based on days remaining
   * Green (info): > 7 days
   * Orange (warning): 2-7 days
   * Red (error): < 2 days or overdue
   */
  private determineSeverity(daysUntil: number): 'info' | 'warning' | 'error' {
    if (daysUntil < 0) return 'error'; // Overdue
    if (daysUntil <= 2) return 'error'; // Critical
    if (daysUntil <= 7) return 'warning'; // Approaching
    return 'info'; // Plenty of time
  }
  
  /**
   * Calculate days between two dates
   */
  private daysBetween(date1: Date | string | null | undefined, date2: Date | string | null | undefined): number {
    if (!date1 || !date2) return 0;
    
    // Ensure dates are Date objects
    const d1 = date1 instanceof Date ? date1 : new Date(date1);
    const d2 = date2 instanceof Date ? date2 : new Date(date2);
    
    // Check for invalid dates
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((d2.getTime() - d1.getTime()) / oneDay);
  }
  
  /**
   * Add days to a date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
  
  /**
   * Add hours to a date
   */
  private addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }
  
  /**
   * Format date for internal processing - returns YYYY-MM-DD format
   */
  private formatDate(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  /**
   * Format date for user display - returns DD/MM/YYYY format
   */
  private formatDateDisplay(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return null;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return null;
    }
  }
  
  /**
   * Safely convert date to ISO string
   */
  private toISOStringSafe(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  }
  
  /**
   * Get Arabic translation for shipment status
   */
  private getStatusArabic(status: string): string {
    const statusMap: Record<string, string> = {
      'draft': 'مسودة',
      'pending': 'قيد الانتظار',
      'booked': 'محجوز',
      'loaded': 'محمّل',
      'sailed': 'أبحر',
      'arrived': 'وصل',
      'delivered': 'تم التسليم',
      'invoiced': 'مفوتر',
      'cleared': 'تم التخليص',
    };
    return statusMap[status] || status;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

