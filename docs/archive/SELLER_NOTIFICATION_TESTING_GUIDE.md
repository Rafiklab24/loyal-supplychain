# Seller Notification System - Testing Guide

## ✅ Successfully Implemented!

The seller notification system is now live and generating notifications for **outgoing** shipments.

---

## 📊 Current Seller Notifications (Live Data)

### 🔴 Critical (2 notifications):
- **seller_shipping_deadline**: Shipping deadline within 1-2 days

### 🟠 Warning (4 notifications):
- **seller_goods_loaded** (3): Issue shipping documents when goods are loaded
- **seller_send_original_docs** (1): Send original documents after payment received

### 🔵 Info (2 notifications):
- **seller_booking_share** (1): Share booking details with customer
- **seller_arrival_followup** (1): Follow up with customer 2 days after arrival

---

## 🎯 All Implemented Seller Notification Types

### 1. seller_contract_created (Info/Blue)
**Trigger**: When contract is created  
**Action**: Request buyer to send signed proforma/contract, markings, shipping instructions, and advance payment  
**Recipients**: Sales team  

### 2. seller_shipping_deadline (Warning/Orange → Error/Red)
**Trigger**: 5 days before deadline (warning), 2 days before (critical)  
**Action**: Contact Ayah (Warehousing) and Khatib (Logistics) to prepare shipment  
**Severity**: Orange (5 days), Red (2 days or less)

### 3. seller_booking_share (Info/Blue)
**Trigger**: When shipment status changes to 'booked'  
**Action**: Share booking confirmation and details with customer (CT)  
**Severity**: Info

### 4. seller_goods_loaded (Warning/Orange)
**Trigger**: When shipment status is 'loaded' or 'sailed'  
**Action**:  
  1. Customs agent: Issue shipping documents  
  2. SCLM: Issue in-house docs  
  3. Share draft with customer for approval  
**Severity**: Warning

### 5. seller_payment_reminder_7d (Info/Blue)
**Trigger**: 7 days before payment due date  
**Action**: Remind customer to prepare payment  
**Severity**: Info

### 6. seller_payment_reminder_3d (Warning/Orange)
**Trigger**: 3 days before payment due date  
**Action**: Gentle reminder to customer about upcoming payment  
**Severity**: Warning

### 7. seller_payment_due_today (Error/Red)
**Trigger**: On payment due date  
**Action**: Contact customer immediately regarding payment  
**Severity**: Critical

### 8. seller_request_balance (Info/Blue)
**Trigger**: 14 days before ETA  
**Action**: Ask customer to pay balance payment  
**Severity**: Info

### 9. seller_send_original_docs (Warning/Orange)
**Trigger**: When payment received in FULL + drafts approved + docs not yet sent  
**Action**:  
  1. Confirm courier address with customer  
  2. Send original documents  
  3. Provide tracking number  
**Severity**: Warning

### 10. seller_arrival_followup (Info/Blue)
**Trigger**: 2 days after goods arrive at POD  
**Action**: Contact customer to check if shipment is cleared and if there are any issues  
**Severity**: Info

### 11. seller_quality_feedback (Info/Blue)
**Trigger**: 10 days after ETA  
**Action**: Send automated message to customer requesting quality feedback  
**Severity**: Info

### 12. seller_quality_issue (Error/Red)
**Trigger**: When negative quality feedback is received  
**Action**: Escalate to higher authorities (management)  
**Severity**: Critical

---

## 🧪 Testing Results

### Test Data Created:
- ✅ 8 seller test shipments created
- ✅ All with `direction = 'outgoing'`
- ✅ Various statuses: planning, booked, loaded, sailed, arrived, delivered

### Notifications Generated:
- ✅ 8 seller notifications created
- ✅ Correctly branching to seller workflow
- ✅ Proper color coding (Red/Orange/Blue)
- ✅ Correct action items for each notification type

---

## 🔄 How to Test

### Option 1: Use Existing Test Data
The test data is already created and notifications are live. Just:
1. Go to **http://localhost:5173/tasks**
2. Click **"تحديث"** (Refresh) button
3. You should see seller notifications mixed with buyer notifications

### Option 2: Create New Test Data
```bash
cd /Users/rafik/loyal-supplychain/app
node create-seller-test-data.js
```

This will create fresh test shipments and trigger notifications.

### Option 3: Manual API Trigger
```bash
curl -X POST http://localhost:3000/api/notifications/check
```

---

## 🔍 Filter Seller Notifications in UI

To see **only** seller notifications, you can filter by checking the shipment number prefix or notification type in the Tasks page.

Seller notifications have these characteristics:
- **Test data**: Shipment SN starts with `SELLER-TEST-`
- **Notification types**: All start with `seller_`
- **Direction**: Associated with `outgoing` shipments

---

## 📋 Key Stakeholders (Added to Database)

The following stakeholders were added to the `logistics.stakeholders` table:
1. **Ayah - Warehousing** (role: warehouse)
2. **Khatib - Logistics** (role: logistics)
3. **Customs Clearance Agent** (role: customs_agent)
4. **Management** (role: management - for escalations)

---

## 🆚 Buyer vs Seller Workflows

| Feature | Buyer Workflow | Seller Workflow |
|---------|---------------|-----------------|
| **Direction** | `incoming` | `outgoing` |
| **Shipping Deadline** | Contact supplier | Contact warehouse/logistics (Ayah & Khatib) |
| **Documents** | Request from supplier | Issue export docs + in-house docs |
| **Payment** | We pay supplier | Customer pays us |
| **Balance Payment** | We plan payment | We request payment from customer |
| **Quality Check** | We request from warehouse | We request feedback from customer |
| **POD Arrival** | Check with customs (Qadriye) | Follow up with customer |
| **Escalation** | Internal issue management | Contact customer or management |

---

## 💡 Color Coding System (Both Workflows)

- 🟢 **Green** (info): > 7 days - You have time
- 🟠 **Orange** (warning): 2-7 days - Cutting close
- 🔴 **Red** (error): < 2 days or overdue - LATE!

---

## 🧹 Clean Up Test Data

When done testing:
```bash
cd /Users/rafik/loyal-supplychain/app
node -e "
const {Pool} = require('pg');
require('dotenv').config();
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('DELETE FROM logistics.notifications WHERE message LIKE \"%SELLER-TEST%\"')
  .then(() => pool.query('DELETE FROM logistics.shipments WHERE sn LIKE \"SELLER-TEST-%\"'))
  .then(() => { console.log('✅ Seller test data cleaned up'); process.exit(0); })
"
```

---

## 🎊 Implementation Complete!

Both buyer and seller notification systems are now fully operational:

✅ **Buyer System** (incoming shipments)  
✅ **Seller System** (outgoing shipments)  
✅ **Scheduled checks** (every 30 minutes)  
✅ **Real-time triggers** (on create/update)  
✅ **Manual refresh** button  
✅ **Color-coded UI** (Red/Orange/Blue)  
✅ **Actionable tasks** with due dates  
✅ **Database tracking** with stakeholders  

**Total Notification Types**: 24 (12 buyer + 12 seller)

---

**Last Updated**: November 17, 2025  
**Status**: ✅ Production Ready

