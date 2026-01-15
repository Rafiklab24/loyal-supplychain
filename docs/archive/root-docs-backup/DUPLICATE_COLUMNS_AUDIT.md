# Duplicate Columns Audit Report

This report identifies columns that exist in **BOTH** `logistics.shipments` AND the normalized tables.

## 🚀 Migration Files Created

| File | Purpose |
|------|---------|
| `066_create_unified_shipments_view.sql` | Creates `v_shipments_complete` view (JOINs all tables) |
| `067_strip_shipments_duplicates.sql` | Removes 86 duplicate columns from `shipments` |
| `067_strip_shipments_duplicates_DOWN.sql` | ROLLBACK - Re-adds columns if needed |

### To Run Migration:
```bash
cd app
npm run db:up
```

### To Rollback (if needed):
```bash
psql -d loyal_supplychain -f app/src/db/migrations/067_strip_shipments_duplicates_DOWN.sql
```

---

## Summary

| Normalized Table | Duplicate Columns | 
|-----------------|-------------------|
| `shipment_parties` | 12 |
| `shipment_cargo` | 15 |
| `shipment_logistics` | 22 |
| `shipment_financials` | 26 |
| `shipment_documents` | 11 |
| **TOTAL** | **86 duplicate columns** |

---

## Detailed Duplicate List

### 1. `shipment_parties` Duplicates (12 columns)

| Column in `shipments` | Also in `shipment_parties` |
|-----------------------|---------------------------|
| `supplier_id` | ✅ `supplier_id` |
| `customer_id` | ✅ `customer_id` |
| `shipping_line_id` | ✅ `shipping_line_id` |
| `has_broker` | ✅ `has_broker` |
| `broker_name` | ✅ `broker_name` |
| `final_beneficiary_company_id` | ✅ `final_beneficiary_company_id` |
| `final_beneficiary_name` | ✅ `final_beneficiary_name` |
| `final_beneficiary_account_no` | ✅ `final_beneficiary_account_no` |
| `final_beneficiary_bank_name` | ✅ `final_beneficiary_bank_name` |
| `final_beneficiary_bank_address` | ✅ `final_beneficiary_bank_address` |
| `final_beneficiary_swift_code` | ✅ `final_beneficiary_swift_code` |
| `final_beneficiary_notes` | ✅ `final_beneficiary_notes` |

---

### 2. `shipment_cargo` Duplicates (15 columns)

| Column in `shipments` | Also in `shipment_cargo` |
|-----------------------|-------------------------|
| `product_text` | ✅ `product_text` |
| `cargo_type` | ✅ `cargo_type` |
| `tanker_type` | ✅ `tanker_type` |
| `container_count` | ✅ `container_count` |
| `weight_ton` | ✅ `weight_ton` |
| `weight_unit` | ✅ `weight_unit` |
| `weight_unit_custom` | ✅ `weight_unit_custom` |
| `barrels` | ✅ `barrels` |
| `bags_count` | ✅ `bags_count` |
| `gross_weight_kg` | ✅ `gross_weight_kg` |
| `net_weight_kg` | ✅ `net_weight_kg` |
| `is_split_shipment` | ✅ `is_split_shipment` |
| `batches` | ✅ `batches` |
| `lines` | ✅ `lines` |
| `containers` | ✅ `containers` |

---

### 3. `shipment_logistics` Duplicates (22 columns)

| Column in `shipments` | Also in `shipment_logistics` |
|-----------------------|-----------------------------|
| `pol_id` | ✅ `pol_id` |
| `pod_id` | ✅ `pod_id` |
| `eta` | ✅ `eta` |
| `etd` | ✅ `etd` |
| `free_time_days` | ✅ `free_time_days` |
| `deposit_date` | ✅ `deposit_date` |
| `contract_ship_date` | ✅ `contract_ship_date` |
| `bl_date` | ✅ `bl_date` |
| `customs_clearance_date` | ✅ `customs_clearance_date` |
| `booking_no` | ✅ `booking_no` |
| `bl_no` | ✅ `bl_no` |
| `bol_numbers` | ✅ `bol_numbers` |
| `vessel_name` | ✅ `vessel_name` |
| `vessel_imo` | ✅ `vessel_imo` |
| `tanker_name` | ✅ `tanker_name` |
| `tanker_imo` | ✅ `tanker_imo` |
| `truck_plate_number` | ✅ `truck_plate_number` |
| `cmr` | ✅ `cmr` |
| `container_number` | ✅ `container_number` (legacy) |
| `has_final_destination` | ✅ `has_final_destination` |
| `final_destination` | ✅ `final_destination` |
| `incoterms` | ✅ `incoterms` |

---

### 4. `shipment_financials` Duplicates (26 columns)

| Column in `shipments` | Also in `shipment_financials` |
|-----------------------|------------------------------|
| `fixed_price_usd_per_ton` | ✅ `fixed_price_usd_per_ton` |
| `fixed_price_usd_per_barrel` | ✅ `fixed_price_usd_per_barrel` |
| `selling_price_usd_per_ton` | ✅ `selling_price_usd_per_ton` |
| `selling_price_usd_per_barrel` | ✅ `selling_price_usd_per_barrel` |
| `total_value_usd` | ✅ `total_value_usd` |
| `paid_value_usd` | ✅ `paid_value_usd` |
| `balance_value_usd` | ✅ `balance_value_usd` |
| `transportation_cost` | ✅ `transportation_cost` |
| `down_payment_type` | ✅ `down_payment_type` |
| `down_payment_percentage` | ✅ `down_payment_percentage` |
| `down_payment_amount` | ✅ `down_payment_amount` |
| `payment_method` | ✅ `payment_method` |
| `payment_method_other` | ✅ `payment_method_other` |
| `swift_code` | ✅ `swift_code` |
| `lc_number` | ✅ `lc_number` |
| `lc_issuing_bank` | ✅ `lc_issuing_bank` |
| `beneficiary_name` | ✅ `beneficiary_name` |
| `beneficiary_bank_name` | ✅ `beneficiary_bank_name` |
| `beneficiary_bank_address` | ✅ `beneficiary_bank_address` |
| `beneficiary_account_number` | ✅ `beneficiary_account_number` |
| `beneficiary_iban` | ✅ `beneficiary_iban` |
| `intermediary_bank` | ✅ `intermediary_bank` |
| `payment_schedule` | ✅ `payment_schedule` |
| `additional_costs` | ✅ `additional_costs` |
| `payment_beneficiaries` | ✅ `payment_beneficiaries` |

---

### 5. `shipment_documents` Duplicates (11 columns)

| Column in `shipments` | Also in `shipment_documents` |
|-----------------------|-----------------------------|
| `contract_file_name` | ✅ `contract_file_name` |
| `documents` | ✅ `documents` |
| `docs_draft_approved` | ✅ `docs_draft_approved` |
| `docs_draft_approved_at` | ✅ `docs_draft_approved_at` |
| `original_docs_sent` | ✅ `original_docs_sent` |
| `original_docs_sent_at` | ✅ `original_docs_sent_at` |
| `courier_address` | ✅ `courier_address` |
| `quality_feedback_requested` | ✅ `quality_feedback_requested` |
| `quality_feedback_received` | ✅ `quality_feedback_received` |
| `quality_feedback` | ✅ `quality_feedback` |
| `quality_feedback_rating` | ✅ `quality_feedback_rating` |

---

## Unique Columns in `shipments` (NOT duplicated)

These columns exist ONLY in `logistics.shipments`:

| Column | Purpose |
|--------|---------|
| `id` | Primary key |
| `sn` | Shipment number |
| `transaction_type` | incoming/outgoing |
| `status` | Shipment status |
| `paperwork_status` | Paperwork status |
| `notes` | General notes |
| `subject` | Shipment subject |
| `contract_id` | FK to contracts |
| `proforma_id` | FK to proforma invoices |
| `has_sales_contract` | Boolean flag |
| `created_at` | Timestamp |
| `updated_at` | Timestamp |
| `created_by` | Audit text |
| `updated_by` | Audit text |
| `created_by_user_id` | FK to users |
| `updated_by_user_id` | FK to users |
| `is_deleted` | Soft delete flag |
| `last_notification_check` | Notification system |
| `notification_metadata` | Notification JSONB |

---

## Legacy Fields (should be deprecated)

| Table | Column | Reason |
|-------|--------|--------|
| `shipment_logistics` | `container_number` | Now stored in `shipment_cargo.containers` JSONB array |
| `shipments` | `container_number` | Same - legacy single-container field |

---

## New Architecture (After Migration)

```
┌─────────────────────────────────────────────────────────────┐
│              logistics.shipments (SLIM)                      │
│  ~18 core columns only:                                      │
│  id, sn, transaction_type, status, notes, contract_id, etc. │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│shipment_parties│   │ shipment_cargo │   │shipment_logistics│
│               │   │                │   │                │
│• supplier_id  │   │• cargo_type    │   │• pol_id, pod_id│
│• customer_id  │   │• container_count│   │• eta, etd      │
│• broker_name  │   │• containers[]  │   │• vessel_name   │
│• shipping_line│   │• lines[]       │   │• bol_numbers   │
│• beneficiary  │   │• weights       │   │• incoterms     │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────────────────────────────┐
│shipment_financials│   │           shipment_documents            │
│               │   │                                         │
│• prices       │   │• documents[]                            │
│• payments     │   │• draft_approved                         │
│• banking info │   │• quality_feedback                       │
│• LC details   │   │• courier_address                        │
└───────────────┘   └─────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            v_shipments_complete (VIEW)                       │
│  JOINs all 5 normalized tables                               │
│  Backward compatible for READ queries                        │
│  Looks like the old 104-column table!                        │
└─────────────────────────────────────────────────────────────┘
```

### Benefits
- ✅ Single source of truth (no duplicate data)
- ✅ No sync issues between tables
- ✅ Backward compatible queries via view
- ✅ Smaller, faster core table
- ✅ Clear data ownership

---

*Generated: Field Mapping Audit*

