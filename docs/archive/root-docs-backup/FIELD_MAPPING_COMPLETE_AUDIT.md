# Complete Field Mapping Audit

## Summary

| Category | Count |
|----------|-------|
| Core columns (STAY in `shipments`) | 16 |
| Duplicate columns (exist in BOTH) | 88 |
| **Total columns in `shipments`** | 104 |

---

## 1. CORE COLUMNS - Stay in `shipments` ✅

These columns are UNIQUE to `shipments` and should remain:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `sn` | TEXT | Shipment number |
| `transaction_type` | ENUM | incoming/outgoing |
| `status` | ENUM | Shipment status |
| `paperwork_status` | TEXT | Paperwork status |
| `notes` | TEXT | General notes |
| `subject` | VARCHAR | Shipment subject |
| `contract_id` | UUID | FK to contracts |
| `proforma_id` | UUID | FK to proforma invoices |
| `has_sales_contract` | BOOLEAN | Flag |
| `is_deleted` | BOOLEAN | Soft delete |
| `created_at` | TIMESTAMP | Created timestamp |
| `updated_at` | TIMESTAMP | Updated timestamp |
| `created_by` | TEXT | Audit |
| `updated_by` | TEXT | Audit |
| `created_by_user_id` | UUID | FK to users |
| `updated_by_user_id` | UUID | FK to users |
| `last_notification_check` | TIMESTAMP | Notification system |
| `notification_metadata` | JSONB | Notification system |

---

## 2. DUPLICATE COLUMNS - Currently Written to `shipments`

### Current Architecture (PROBLEM):
```
Frontend → API → INSERT/UPDATE logistics.shipments → Trigger syncs to normalized tables
                          ↓
                 API reads from shipments (NOT normalized!)
```

### Columns Being Written to BOTH Tables:

#### Party Fields (→ should go to `shipment_parties`)

| Column | API Writes To | API Reads From | Status |
|--------|--------------|----------------|--------|
| `supplier_id` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `customer_id` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `shipping_line_id` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `has_broker` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `broker_name` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `final_beneficiary_*` (7 cols) | `shipments` | `shipments` | ⚠️ DUPLICATE |

#### Cargo Fields (→ should go to `shipment_cargo`)

| Column | API Writes To | API Reads From | Status |
|--------|--------------|----------------|--------|
| `product_text` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `cargo_type` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `tanker_type` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `container_count` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `weight_ton` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `weight_unit` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `weight_unit_custom` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `barrels` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `bags_count` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `gross_weight_kg` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `net_weight_kg` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `is_split_shipment` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `batches` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `lines` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `containers` | `shipments` | `shipments` | ⚠️ DUPLICATE |

#### Logistics Fields (→ should go to `shipment_logistics`)

| Column | API Writes To | API Reads From | Status |
|--------|--------------|----------------|--------|
| `pol_id` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `pod_id` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `eta` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `etd` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `free_time_days` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `deposit_date` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `contract_ship_date` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `bl_date` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `customs_clearance_date` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `booking_no` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `bl_no` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `bol_numbers` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `vessel_name` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `vessel_imo` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `tanker_name` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `tanker_imo` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `truck_plate_number` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `cmr` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `container_number` | `shipments` | `shipments` | ⚠️ LEGACY - also in containers JSONB |
| `has_final_destination` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `final_destination` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `incoterms` | `shipments` | `shipments` | ⚠️ DUPLICATE |

#### Financial Fields (→ should go to `shipment_financials`)

| Column | API Writes To | API Reads From | Status |
|--------|--------------|----------------|--------|
| `fixed_price_usd_per_ton` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `fixed_price_usd_per_barrel` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `selling_price_usd_per_ton` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `selling_price_usd_per_barrel` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `total_value_usd` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `paid_value_usd` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `balance_value_usd` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `transportation_cost` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `down_payment_type` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `down_payment_percentage` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `down_payment_amount` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `payment_method` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `payment_method_other` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `swift_code` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `lc_number` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `lc_issuing_bank` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `beneficiary_name` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `beneficiary_bank_name` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `beneficiary_bank_address` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `beneficiary_account_number` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `beneficiary_iban` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `intermediary_bank` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `payment_schedule` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `additional_costs` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `payment_beneficiaries` | `shipments` | `shipments` | ⚠️ DUPLICATE |

#### Document Fields (→ should go to `shipment_documents`)

| Column | API Writes To | API Reads From | Status |
|--------|--------------|----------------|--------|
| `contract_file_name` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `documents` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `docs_draft_approved` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `docs_draft_approved_at` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `original_docs_sent` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `original_docs_sent_at` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `courier_address` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `quality_feedback_requested` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `quality_feedback_received` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `quality_feedback` | `shipments` | `shipments` | ⚠️ DUPLICATE |
| `quality_feedback_rating` | `shipments` | `shipments` | ⚠️ DUPLICATE |

---

## 3. DATA SYNC MECHANISM

There IS a trigger keeping data in sync:

```sql
tr_sync_to_normalized → logistics.fn_sync_shipments_to_normalized()
```

**Flow:**
1. Frontend sends data to API
2. API writes to `logistics.shipments`
3. Trigger copies data to normalized tables
4. Normalized tables have the SAME data

**Verified:** Data is identical between `shipments` and normalized tables ✅

---

## 4. CONCLUSION

### Are any duplicates mapped differently?

**NO** - All duplicates have the SAME data because of the sync trigger.

### What needs to happen to clean up?

| Step | Description |
|------|-------------|
| 1 | Create `v_shipments_complete` view (JOINs all normalized tables) |
| 2 | Update API SELECTs to use the view instead of `s.*` |
| 3 | Update API INSERTs to write to normalized tables |
| 4 | Update API UPDATEs to write to normalized tables |
| 5 | Remove the sync trigger |
| 6 | Remove duplicate columns from `shipments` |

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Data loss | LOW | Data is synced, removing duplicates loses nothing |
| API breaks | HIGH | Must update ALL API queries first |
| Frontend breaks | LOW | API returns same data shape via view |

---

## 5. FILES TO UPDATE

| File | Changes Needed |
|------|----------------|
| `app/src/routes/shipments.ts` | Update all SELECT, INSERT, UPDATE queries |
| `app/src/routes/contracts.ts` | Update shipment-related queries |
| `app/src/routes/accounting.ts` | Already uses normalized tables ✅ |

---

*Generated: Field Mapping Audit*









