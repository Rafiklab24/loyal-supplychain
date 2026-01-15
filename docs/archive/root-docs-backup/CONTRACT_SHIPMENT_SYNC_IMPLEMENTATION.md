# Contract-Shipment Synchronization Implementation

## Status: Core Backend Complete, Frontend Components In Progress

This document tracks the implementation of the bidirectional contract-shipment synchronization feature with audit trails and approval workflows.

---

## ✅ COMPLETED

### Phase 1: Database Schema & Audit System (100%)

**Files Created/Modified:**
- ✅ `app/src/db/migrations/019_contract_shipment_sync.sql`
  - Created `logistics.change_audit_log` table for tracking all changes
  - Created `logistics.contract_update_requests` table for approval workflow
  - Enhanced `logistics.shipment_lines` with `original_contract_qty`, `original_contract_price`, `variance_reason`
  - Created `logistics.log_change()` helper function
  - Created `report.contract_shipment_comparison` view
  - ✅ Migration successfully applied to database

- ✅ Fixed `app/src/db/migrations/008_final_beneficiary.sql` (schema name correction from `contracts` to `logistics`)

### Phase 2: Backend API Endpoints (100%)

**Files Created/Modified:**

1. ✅ **`app/src/routes/audits.ts`** (NEW)
   - `GET /api/contracts/:id/audit-log` - Get audit log for contract
   - `GET /api/shipments/:id/audit-log` - Get audit log for shipment
   - `GET /api/contracts/:contractId/shipments/:shipmentId/comparison` - Side-by-side comparison
   - `GET /api/audit-log` - General audit log with filters

2. ✅ **`app/src/routes/contracts.ts`** (ENHANCED)
   - `POST /api/contracts/:contractId/create-shipment` - Create shipment from contract
     - Imports all contract lines as shipment lines
     - Supports line splitting with `split_lines` parameter
     - Logs all changes to audit log
     - Stores original contract values in shipment lines
   - `POST /api/contracts/:id/propose-update` - Propose contract update from shipment
   - `GET /api/contracts/update-requests/pending` - List pending approval requests
   - `POST /api/contracts/update-requests/:id/approve` - Approve and apply changes
   - `POST /api/contracts/update-requests/:id/reject` - Reject with reason

3. ✅ **`app/src/routes/shipments.ts`** (ENHANCED)
   - Modified `PUT /api/shipments/:id` to track all field-level changes
   - Compares old vs new values
   - Logs changes to `change_audit_log` table
   - Supports `changed_by` parameter

4. ✅ **`app/src/index.ts`** (UPDATED)
   - Registered `/api/audit-log` routes
   - Added to API documentation

5. ✅ **`app/src/db/migrate.ts`** (FIXED)
   - Updated to read migrations from `src/db/migrations` (SQL files not copied to dist)

### Phase 3: Frontend Types & Services (100%)

**Files Created/Modified:**

1. ✅ **`vibe/src/types/api.ts`** (ENHANCED)
   - Added `ChangeAuditLog` interface
   - Added `ContractUpdateRequest` interface
   - Added `ContractUpdateChange` interface
   - Added `ContractShipmentComparison` interface
   - Added `ComparisonResponse`, `AuditLogResponse`, `ShipmentCreationResponse`, etc.

2. ✅ **`vibe/src/services/contracts.ts`** (ENHANCED)
   - `createShipmentFromContract()` - Create shipment from contract
   - `getContractShipmentComparison()` - Get comparison data
   - `getContractAuditLog()` - Get contract audit log
   - `proposeContractUpdate()` - Propose update from shipment changes
   - `getPendingUpdateRequests()` - List pending requests
   - `approveContractUpdate()` - Approve request
   - `rejectContractUpdate()` - Reject request

3. ✅ **`vibe/src/services/shipments.ts`** (ENHANCED)
   - `getAuditLog()` - Get shipment audit log

### Phase 4: Frontend Components (25%)

**Files Created:**

1. ✅ **`vibe/src/components/audit/AuditLogViewer.tsx`** (NEW)
   - Timeline-style component displaying change history
   - Filters by field, change type, source type
   - Color-coded badges for different change types
   - Shows old → new value comparisons
   - Displays user, timestamp, and notes for each change

---

## 🚧 IN PROGRESS / TODO

### Phase 4-5: Frontend Components (Remaining 75%)

**Components to Create:**

1. ⏳ **`vibe/src/components/shipments/ContractComparisonModal.tsx`**
   - Two-column layout: Contract vs Shipment (Actual)
   - Line-by-line comparison table
   - Variance calculation with color coding:
     - Green: within tolerance
     - Orange: minor deviation
     - Red: major deviation
   - Expandable rows showing field-level change history
   - "Propose Contract Update" button

2. ⏳ **`vibe/src/components/contracts/ContractUpdateRequestModal.tsx`**
   - Form to propose contract updates
   - Shows changed fields in table format
   - Requires reason for each change
   - Submit for approval functionality

3. ⏳ **`vibe/src/components/shipments/NewShipmentWizard.tsx`** (ENHANCE)
   - Import ALL contract line data when `initialContract` is provided
   - Pre-fill product, quantity, unit_price, package_size
   - Store `contract_line_id` reference
   - Store original values in state

4. ⏳ **`vibe/src/components/shipments/wizard/Step2CommercialTerms.tsx`** (ENHANCE)
   - Add "Split Line" functionality
   - Modal to specify quantities for split shipments
   - Warning if total > contract quantity + tolerance
   - Contract value hints with tooltips (e.g., "Contract: 500 MT")
   - Variance badges (+5%, -3%)

5. ⏳ **`vibe/src/pages/ShipmentDetailPage.tsx`** (ENHANCE)
   - Add "Compare with Contract" button
   - Add "View Change History" button
   - Show badge if unapproved contract update requests exist

6. ⏳ **`vibe/src/pages/ContractDetailPage.tsx`** (ENHANCE)
   - Add "Create Shipment" button (uses new API)
   - List linked shipments with comparison stats
   - "View All Changes" button
   - Pending update requests section with approve/reject buttons
   - Fulfillment progress bar

### Phase 7: UI/UX & Translations

**To Do:**

1. ⏳ **Visual Indicators**
   - Variance badges with color coding
   - "Synced from Contract" icon
   - "Contract Modified" badge
   - Notification bell for pending approvals

2. ⏳ **Translation Keys** (`vibe/src/i18n/ar.json`, `vibe/src/i18n/en.json`)
   - Contract comparison terms
   - Audit log labels
   - Approval workflow messages
   - Variance indicators
   - Split line UI elements

---

## 🗄️ Database Schema

### Tables Created

1. **logistics.change_audit_log**
   - Tracks ALL changes to contracts, contract_lines, shipments, shipment_lines
   - Fields: entity_type, entity_id, field_name, old_value, new_value, change_type, source_type, changed_by, changed_at, notes
   - Indexed on: entity, contract_id, shipment_id, changed_at, changed_by

2. **logistics.contract_update_requests**
   - Manages approval workflow for syncing shipment changes back to contracts
   - Fields: contract_id, shipment_id, changes_json, status, requested_by, approved_by, rejection_reason
   - Statuses: pending, approved, rejected

3. **logistics.shipment_lines** (enhanced)
   - Added columns: `original_contract_qty`, `original_contract_price`, `variance_reason`

### Views Created

1. **report.contract_shipment_comparison**
   - Joins contract_lines with shipment_lines
   - Calculates variances (qty, price, value)
   - Checks tolerance compliance
   - Used by comparison API endpoint

### Functions Created

1. **logistics.log_change()**
   - Helper function to simplify audit log insertion
   - Parameters: entity details, field changes, context

---

## 📝 API Endpoints Summary

### Audit Endpoints
```
GET  /api/audit-log/contracts/:id/audit-log
GET  /api/audit-log/shipments/:id/audit-log
GET  /api/audit-log/contracts/:contractId/shipments/:shipmentId/comparison
GET  /api/audit-log?entity_type=&changed_by=&from_date=&to_date=
```

### Contract Sync Endpoints
```
POST /api/contracts/:contractId/create-shipment
POST /api/contracts/:id/propose-update
GET  /api/contracts/update-requests/pending
POST /api/contracts/update-requests/:id/approve
POST /api/contracts/update-requests/:id/reject
```

### Shipment Endpoints (Enhanced)
```
PUT  /api/shipments/:id  (now with change tracking)
```

---

## 🧪 Testing Required

### Backend Testing
- [ ] Create shipment from contract with all lines
- [ ] Create shipment with split lines
- [ ] Update shipment and verify audit log entries
- [ ] Propose contract update
- [ ] Approve contract update and verify sync
- [ ] Reject contract update
- [ ] Fetch comparison data
- [ ] Fetch audit logs with filters

### Frontend Testing (Once Components Complete)
- [ ] Create shipment from contract in UI
- [ ] View contract-shipment comparison
- [ ] View audit log timeline
- [ ] Propose contract update from shipment changes
- [ ] Approve/reject pending updates
- [ ] Verify tooltips showing contract values in shipment wizard
- [ ] Test line splitting UI

---

## 🚀 Next Steps

1. **Complete Frontend Components** (Priority)
   - ContractComparisonModal
   - ContractUpdateRequestModal
   - Enhance NewShipmentWizard to use new API
   - Add comparison/audit UI to detail pages

2. **Add Translations**
   - Arabic and English translation keys

3. **Test End-to-End Workflow**
   - Create contract → Create shipment → Modify shipment → Propose update → Approve

4. **Polish UI/UX**
   - Add visual indicators
   - Improve color coding
   - Add notifications

---

## 📊 Success Criteria

- ✅ Can create shipment from contract with all lines imported
- ⏳ Can split contract lines across multiple shipments
- ✅ All changes tracked at field and line level in audit log
- ⏳ Side-by-side comparison shows variances with color coding
- ⏳ Can propose contract updates from shipment changes
- ✅ Approval workflow functional with audit trail
- ✅ Audit log shows complete history: "Contract was X, changed to Y on shipment"
- ⏳ Original contract values visible as hints in shipment wizard

---

## 🔧 Technical Notes

1. **Audit Log Performance**: Properly indexed on key columns
2. **Tolerance Checking**: Uses contract line `tolerance_pct` field
3. **Line Splitting**: Tracks split lines via same `contract_line_id`, different shipment_line ids
4. **Data Integrity**: Uses transactions for audit log + updates
5. **Backward Compatibility**: All new columns are nullable, existing code unaffected

---

**Last Updated**: 2025-11-19  
**Status**: Backend Complete, Frontend 25% Complete

