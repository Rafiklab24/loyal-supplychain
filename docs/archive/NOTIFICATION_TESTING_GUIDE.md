# Buyer Notification System - Testing Guide

## How to Test All Notification Rules

This guide will help you test all 12 notification types from the original requirements.

## Prerequisites
1. Backend server running (`npm run dev` in `/app`)
2. Frontend running (`npm run dev` in `/vibe`)
3. Access to PostgreSQL database

## Testing Method
We'll create test shipments and contracts with specific dates to trigger each notification type.

---

## 🧪 Test Scenarios

### Test 1: Contract Creation Notification
**Rule**: When contract is created, remind to send documents to supplier

**SQL to Create Test Contract:**
```sql
INSERT INTO logistics.contracts (
  contract_no, 
  buyer_company_id, 
  seller_company_id, 
  status, 
  currency_code,
  signed_at,
  created_at
) VALUES (
  'TEST-CONTRACT-001',
  (SELECT id FROM master_data.companies LIMIT 1),
  (SELECT id FROM master_data.companies OFFSET 1 LIMIT 1),
  'ACTIVE',
  'USD',
  NOW(),
  NOW()
) RETURNING id;
```

**Expected Notification:**
- Type: `send_contract_to_supplier`
- Severity: `info` (Blue)
- Action: "Send to supplier: 1. Signed proforma invoice, 2. Product markings/labels, 3. Shipping instructions"

**How to Trigger:**
- Create a new contract via UI, OR
- Run the SQL above, then click refresh in notifications

---

### Test 2: Advance Payment Due
**Rule**: Remind about advance payment based on payment schedule

**SQL to Create Test:**
```sql
-- First, create a contract
INSERT INTO logistics.contracts (contract_no, status) 
VALUES ('TEST-ADV-PAY-001', 'ACTIVE') 
RETURNING id;

-- Then add payment schedule with advance payment
INSERT INTO finance.payment_schedules (
  contract_id,
  seq,
  basis,
  days_after,
  percent,
  is_deferred
) VALUES (
  '[CONTRACT_ID_FROM_ABOVE]',
  1,
  'ON_BOOKING',
  7,
  30,
  false
);
```

**Expected Notification:**
- Type: `advance_payment_due`
- Severity: `warning` or `error` (Orange/Red depending on days left)
- Action: "Process advance payment and confirm with supplier"

---

### Test 3: Shipping Deadline Approaching (7 days warning)
**Rule**: If shipping deadline is within 7 days and not shipped

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  contract_ship_date,
  status,
  pol_id,
  pod_id,
  created_at
) VALUES (
  'TEST-SHIP-DEADLINE-7D',
  'Test Product - Deadline 7 days',
  CURRENT_DATE + INTERVAL '6 days', -- 6 days from now
  'planning',
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  NOW()
);
```

**Expected Notification:**
- Type: `shipping_deadline_approaching`
- Severity: `warning` (Orange)
- Title: "Shipping deadline approaching"
- Action: "Contact supplier to confirm shipping schedule"

---

### Test 4: Shipping Deadline CRITICAL (2 days)
**Rule**: If shipping deadline is within 2 days - CRITICAL

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  contract_ship_date,
  status,
  pol_id,
  pod_id,
  created_at
) VALUES (
  'TEST-SHIP-DEADLINE-2D',
  'Test Product - URGENT Deadline',
  CURRENT_DATE + INTERVAL '1 day', -- Tomorrow
  'planning',
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  NOW()
);
```

**Expected Notification:**
- Type: `shipping_deadline_approaching`
- Severity: `error` (Red)
- Title: "🚨 URGENT: Shipping deadline critical"
- Action: "Immediate action: Contact supplier NOW to confirm shipping status"

---

### Test 5: Documents Needed (After Booking)
**Rule**: Shipment is booked/loaded but no documents uploaded

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  status,
  pol_id,
  pod_id,
  eta,
  created_at
) VALUES (
  'TEST-DOCS-NEEDED',
  'Test Product - Need Docs',
  'booked', -- or 'loaded' or 'sailed'
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  CURRENT_DATE + INTERVAL '10 days',
  NOW()
);
```

**Expected Notification:**
- Type: `documents_needed`
- Severity: `warning` if sailed, `info` otherwise
- Action: "Request from supplier: 1. Bill of Lading (BL), 2. Packing List, 3. Loading photos, 4. Quality photos, 5. Certificate of Origin, 6. Certificate of Analysis"

---

### Test 6: Balance Payment Planning (14 days before ETA)
**Rule**: ETA is in 14 days, remind to plan balance payment

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  status,
  pol_id,
  pod_id,
  eta,
  total_value_usd,
  paid_value_usd,
  balance_value_usd,
  created_at
) VALUES (
  'TEST-BALANCE-14D',
  'Test Product - Balance Planning',
  'sailed',
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  CURRENT_DATE + INTERVAL '14 days',
  100000,
  30000,
  70000,
  NOW()
);
```

**Expected Notification:**
- Type: `balance_payment_due_2w`
- Severity: `warning` (Orange)
- Title: "Balance payment planning needed"
- Action: "1. Prepare balance payment\n2. Send Proof of Payment (PoP) to supplier\n3. Request final documents"
- Due date: 8 days before ETA

---

### Test 7: Balance Payment CRITICAL (8 days before ETA)
**Rule**: ETA in 8 days or less and balance NOT paid - RED ZONE

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  status,
  pol_id,
  pod_id,
  eta,
  total_value_usd,
  paid_value_usd,
  balance_value_usd,
  created_at
) VALUES (
  'TEST-BALANCE-8D-CRITICAL',
  'Test Product - CRITICAL PAYMENT',
  'sailed',
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  CURRENT_DATE + INTERVAL '7 days', -- 7 days from now
  100000,
  30000,
  70000, -- Balance still unpaid
  NOW()
);
```

**Expected Notification:**
- Type: `balance_payment_critical_8d`
- Severity: `error` (Red)
- Title: "🚨 URGENT: Balance payment overdue"
- Message: "ETA in X days! Balance payment MUST be made NOW! Amount: $70,000.00"
- Action: "PAY BALANCE IMMEDIATELY - Shipment at risk"

---

### Test 8: Send Docs to Customs (2 days before ETA)
**Rule**: ETA in 2 days, remind to send docs to customs agent

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  status,
  pol_id,
  pod_id,
  eta,
  created_at
) VALUES (
  'TEST-CUSTOMS-DOCS',
  'Test Product - Customs Docs',
  'sailed',
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  CURRENT_DATE + INTERVAL '2 days',
  NOW()
);
```

**Expected Notification:**
- Type: `send_docs_to_customs`
- Severity: `warning` (Orange)
- Title: "Send documents to customs agent"
- Action: "Send complete document set to customs clearance agent"

---

### Test 9: POD Clearance Check (2 days after ETA)
**Rule**: Goods arrived 2 days ago, check clearance status

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  status,
  pol_id,
  pod_id,
  eta,
  created_at
) VALUES (
  'TEST-CLEARANCE-CHECK',
  'Test Product - Check Clearance',
  'arrived', -- Status must be 'arrived'
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  CURRENT_DATE - INTERVAL '2 days', -- ETA was 2 days ago
  NOW()
);
```

**Expected Notification:**
- Type: `pod_clearance_check`
- Severity: `info` (Blue)
- Title: "Check clearance status"
- Action: "Contact customs agent: When will goods be cleared from POD?"

---

### Test 10: Delivery Status Check (7 days after ETA)
**Rule**: 7 days past ETA, goods not delivered, check status

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  status,
  pol_id,
  pod_id,
  eta,
  created_at
) VALUES (
  'TEST-DELIVERY-STATUS',
  'Test Product - Delivery Status',
  'arrived', -- Not 'delivered'
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  CURRENT_DATE - INTERVAL '7 days', -- ETA was 7 days ago
  NOW()
);
```

**Expected Notification:**
- Type: `delivery_status_check`
- Severity: `warning` (Orange)
- Title: "Delivery status update needed"
- Message: "It has been 7 days since ETA. Please update delivery status."
- Action: "Confirm: Have goods reached final destination?"

---

### Test 11: Quality Check Required
**Rule**: Shipment delivered, request quality check from warehouse

**SQL to Create Test:**
```sql
INSERT INTO logistics.shipments (
  sn,
  product_text,
  status,
  pol_id,
  pod_id,
  eta,
  created_at
) VALUES (
  'TEST-QUALITY-CHECK',
  'Test Product - Quality Check',
  'delivered', -- Status must be 'delivered'
  (SELECT id FROM master_data.ports LIMIT 1),
  (SELECT id FROM master_data.ports OFFSET 1 LIMIT 1),
  CURRENT_DATE - INTERVAL '2 days',
  NOW()
);
```

**Expected Notification:**
- Type: `quality_check_needed`
- Severity: `info` (Blue)
- Title: "Quality check required"
- Action: "Contact warehouse for quality check and feedback"

---

## 🔄 How to Run Tests

### Option 1: Manual Refresh (Recommended for Testing)
1. Run any SQL command above to create test data
2. Go to the Tasks page (`/tasks`)
3. Click the "تحديث" (Refresh) button
4. Notification should appear within seconds

### Option 2: Wait for Scheduled Check
- Scheduler runs every 30 minutes automatically
- Check backend logs for: `Running scheduled notification check...`

### Option 3: API Call
```bash
curl -X POST http://localhost:3000/api/notifications/check
```

---

## 🔍 Verify Notifications

### Check in UI
1. **Notification Bell**: Look at the bell icon color
   - 🔴 Red + pulse = Critical (error)
   - 🟠 Orange = Warning
   - ⚫ Gray = Info

2. **Tasks Page** (`/tasks`): Filter by:
   - All
   - Critical (Red)
   - Warning (Orange)
   - Info (Blue)

### Check in Database
```sql
-- View all notifications
SELECT 
  type,
  title,
  severity,
  action_required,
  due_date,
  created_at
FROM logistics.notifications
ORDER BY created_at DESC
LIMIT 20;

-- Count by type
SELECT type, COUNT(*), severity
FROM logistics.notifications
GROUP BY type, severity
ORDER BY COUNT(*) DESC;

-- View pending actions
SELECT 
  type,
  title,
  action_completed,
  days_until_due
FROM logistics.notifications
WHERE action_required IS NOT NULL
  AND action_completed = FALSE
ORDER BY due_date ASC;
```

### Check Backend Logs
```bash
cd /Users/rafik/loyal-supplychain
tail -f app/backend.log | grep -E "(notification|Created|Checking)"
```

---

## 🧹 Clean Up Test Data

After testing, remove test notifications:
```sql
-- Delete test notifications
DELETE FROM logistics.notifications
WHERE message LIKE '%Test Product%'
   OR title LIKE '%TEST-%';

-- Delete test shipments
DELETE FROM logistics.shipments
WHERE sn LIKE 'TEST-%';

-- Delete test contracts
DELETE FROM logistics.contracts
WHERE contract_no LIKE 'TEST-%';
```

---

## ✅ Expected Results Summary

| Test # | Notification Type | Severity | Timing | Color |
|--------|------------------|----------|--------|-------|
| 1 | Contract Created | info | Immediate | 🔵 Blue |
| 2 | Advance Payment | warning/error | Based on schedule | 🟠/🔴 |
| 3 | Shipping Deadline (7d) | warning | 7 days before | 🟠 Orange |
| 4 | Shipping Deadline (2d) | error | 2 days before | 🔴 Red |
| 5 | Documents Needed | info/warning | After booking | 🔵/🟠 |
| 6 | Balance Payment (14d) | warning | 14 days before ETA | 🟠 Orange |
| 7 | Balance Payment (8d) | error | 8 days before ETA | 🔴 Red |
| 8 | Send to Customs | warning | 2 days before ETA | 🟠 Orange |
| 9 | Clearance Check | info | 2 days after ETA | 🔵 Blue |
| 10 | Delivery Status | warning | 7 days after ETA | 🟠 Orange |
| 11 | Quality Check | info | On delivery | 🔵 Blue |

---

## 🐛 Troubleshooting

### No notifications appearing?
1. Check backend logs: `tail -f app/backend.log`
2. Verify database has test data: `SELECT * FROM logistics.shipments WHERE sn LIKE 'TEST-%';`
3. Manually trigger: Click refresh or call API
4. Check browser console for errors

### Wrong severity/color?
- Check `days_until_due` calculation in notification
- Verify dates in test data are correct
- Check `determineSeverity()` logic in `notificationService.ts`

### Action not completing?
- Check network tab for API call to `/api/notifications/:id/complete`
- Verify button click handler is working
- Check database: `action_completed` should be TRUE

---

## 📊 Monitoring Dashboard

View real-time statistics:
```bash
curl http://localhost:3000/api/notifications/stats | jq '.'
```

Expected output:
```json
{
  "total": "15",
  "unread": "12",
  "critical": "3",
  "warnings": "5",
  "pending_actions": "10",
  "overdue": "1"
}
```

---

## 🎯 Success Criteria

✅ All 11+ notification types generate correctly
✅ Color coding works (Red/Orange/Blue)
✅ Due dates calculate properly
✅ Actions can be marked as completed
✅ Manual refresh works
✅ Scheduled checks run every 30 minutes
✅ Real-time triggers work on create/update
✅ Database stores all required fields
✅ UI displays in both English and Arabic
✅ No duplicate notifications for same event

---

**Testing Date**: November 17, 2025
**Test Duration**: ~30-45 minutes for full test suite
**Database Impact**: Creates 11 test records (can be cleaned up)

