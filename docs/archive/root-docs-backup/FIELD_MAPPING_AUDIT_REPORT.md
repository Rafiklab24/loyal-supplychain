# Field Mapping Audit Report

**Generated**: 2025-12-06T07:34:32.082Z  
**Version**: 1.0.0

---

## Summary

| Metric | Count |
|--------|-------|
| Total Components Audited | 25 |
| Total Fields Found | 253 |
| Mismatches | 6 |

### By Status

| Status | Count |
|--------|-------|
| approved | 247 |
| mismatch | 6 |

### By Module (Aligned with Sidebar)

| Module | Arabic Name | Fields | Notes |
|--------|-------------|--------|-------|
| Shipments | الشحنات | 84 |  |
| Contracts | العقود | 73 |  |
| Products | المنتجات | 25 |  |
| Tasks | المهام | 0 | Read-only (auto-generated) |
| Companies | الشركات | 10 |  |
| Finance | المالية | 22 |  |
| Accounting | المحاسبة | 0 | Read-only (display-only) |
| CustomsClearance | التخليص الجمركي | 21 |  |
| LandTransport | النقل البري | 18 |  |
| Analytics | تحليل البيانات | 0 | Read-only (display-only) |

---

## Mismatches (Require Attention)




### DeliveryPaymentTerms.tsx - `special_clauses`

| Property | Value |
|----------|-------|
| Module | Shipments |
| Frontend Field | `special_clauses` |
| Expected API Field | `special_clauses` |
| Expected DB Table | UNKNOWN |
| Status | **mismatch** |
| Notes | DB column not found in schema |


### Step3TermsPayment.tsx - `special_clauses`

| Property | Value |
|----------|-------|
| Module | Contracts |
| Frontend Field | `special_clauses` |
| Expected API Field | `special_clauses` |
| Expected DB Table | UNKNOWN |
| Status | **mismatch** |
| Notes | DB column not found in schema |


### Step5BankingDocs.tsx - `lines[].document_type`

| Property | Value |
|----------|-------|
| Module | Contracts |
| Frontend Field | `lines[].document_type` |
| Expected API Field | `document_type` |
| Expected DB Table | UNKNOWN |
| Status | **mismatch** |
| Notes | Nested field inside lines[] array (JSONB) |


### Step5BankingDocs.tsx - `lines[].attested_by`

| Property | Value |
|----------|-------|
| Module | Contracts |
| Frontend Field | `lines[].attested_by` |
| Expected API Field | `attested_by` |
| Expected DB Table | UNKNOWN |
| Status | **mismatch** |
| Notes | Nested field inside lines[] array (JSONB) |


### Step5BankingDocs.tsx - `lines[].required`

| Property | Value |
|----------|-------|
| Module | Contracts |
| Frontend Field | `lines[].required` |
| Expected API Field | `required` |
| Expected DB Table | UNKNOWN |
| Status | **mismatch** |
| Notes | Nested field inside lines[] array (JSONB) |


### Step5BankingDocs.tsx - `lines[].legalization_required`

| Property | Value |
|----------|-------|
| Module | Contracts |
| Frontend Field | `lines[].legalization_required` |
| Expected API Field | `legalization_required` |
| Expected DB Table | UNKNOWN |
| Status | **mismatch** |
| Notes | Nested field inside lines[] array (JSONB) |


---

## Component Details


### Shipments: Step1BasicInfo.tsx

**Path**: `vibe/src/components/shipments/wizard/Step1BasicInfo.tsx`  
**Fields Found**: 10

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `transaction_type` | `transaction_type` | logistics.shipments | transaction_type | VARCHAR | approved |
| `customer_id` | `customer_id` | logistics.shipment_parties | customer_id | UUID | approved |
| `supplier_id` | `supplier_id` | logistics.shipment_parties | supplier_id | UUID | approved |
| `has_sales_contract` | `has_sales_contract` | logistics.shipments | has_sales_contract | BOOLEAN | approved |
| `contract_id` | `contract_id` | logistics.shipments | contract_id | UUID | approved |
| `sn` | `sn` | logistics.shipments | sn | TEXT | approved |
| `subject` | `subject` | logistics.shipments | subject | TEXT | approved |
| `has_broker` | `has_broker` | logistics.shipment_parties | has_broker | BOOLEAN | approved |
| `broker_name` | `broker_name` | logistics.shipment_parties | broker_name | VARCHAR | approved |
| `final_destination` | `final_destination` | logistics.shipment_logistics | final_destination | JSONB | approved |


### Shipments: Step2ProductLines.tsx

**Path**: `vibe/src/components/shipments/wizard/Step2ProductLines.tsx`  
**Fields Found**: 14

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `lines` | `lines` | logistics.shipment_cargo | lines | JSONB | approved |
| `lines[].product_id` | `product_id` | logistics.shipment_cargo.lines[] | product_id | JSONB | approved |
| `lines[].product_name` | `product_name` | logistics.shipment_cargo.lines[] | product_name | JSONB | approved |
| `lines[].type_of_goods` | `type_of_goods` | logistics.shipment_cargo.lines[] | type_of_goods | JSONB | approved |
| `lines[].brand` | `brand` | logistics.shipment_cargo.lines[] | brand | JSONB | approved |
| `lines[].kind_of_packages` | `kind_of_packages` | logistics.shipment_cargo.lines[] | kind_of_packages | JSONB | approved |
| `lines[].number_of_packages` | `number_of_packages` | logistics.shipment_cargo.lines[] | number_of_packages | JSONB | approved |
| `lines[].package_size` | `package_size` | logistics.shipment_cargo.lines[] | package_size | JSONB | approved |
| `lines[].package_size_unit` | `package_size_unit` | logistics.shipment_cargo.lines[] | package_size_unit | JSONB | approved |
| `quantity_mt` | `quantity_mt` | logistics.shipment_cargo.lines[] | quantity_mt | JSONB | approved |
| `pricing_method` | `pricing_method` | logistics.shipment_cargo.lines[] | pricing_method | JSONB | approved |
| `number_of_barrels` | `number_of_barrels` | logistics.shipment_cargo.lines[] | number_of_barrels | JSONB | approved |
| `unit_price` | `unit_price` | logistics.shipment_cargo.lines[] | unit_price | JSONB | approved |
| `amount_usd` | `amount_usd` | logistics.shipment_cargo.lines[] | amount_usd | JSONB | approved |


### Shipments: Step3DeliveryTerms.tsx

**Path**: `vibe/src/components/shipments/wizard/Step3DeliveryTerms.tsx`  
**Fields Found**: 0

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|



### Shipments: DeliveryPaymentTerms.tsx

**Path**: `vibe/src/components/common/DeliveryPaymentTerms.tsx`  
**Fields Found**: 15

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `terms` | `terms` | logistics.shipment_financials (embedded in payment fields) | terms | JSONB | approved |
| `cargo_type` | `cargo_type` | logistics.shipment_cargo | cargo_type | VARCHAR | approved |
| `tanker_type` | `tanker_type` | logistics.shipment_cargo | tanker_type | VARCHAR | approved |
| `barrels` | `barrels` | logistics.shipment_cargo | barrels | INTEGER | approved |
| `weight_ton` | `weight_ton` | logistics.shipment_cargo | weight_ton | NUMERIC | approved |
| `weight_unit` | `weight_unit` | logistics.shipment_cargo | weight_unit | VARCHAR | approved |
| `weight_unit_custom` | `weight_unit_custom` | logistics.shipment_cargo | weight_unit_custom | VARCHAR | approved |
| `container_count` | `container_count` | logistics.shipment_cargo | container_count | INTEGER | approved |
| `delivery_terms_detail` | `delivery_terms_detail` | logistics.contracts (extra_json.terms) | delivery_terms_detail | JSONB | approved |
| `currency_code` | `currency_code` | logistics.contracts | currency_code | VARCHAR | approved |
| `payment_method` | `payment_method` | logistics.shipment_financials | payment_method | VARCHAR | approved |
| `usd_equivalent_rate` | `usd_equivalent_rate` | logistics.contracts (extra_json.terms) | usd_equivalent_rate | JSONB | approved |
| `payment_terms` | `payment_terms` | logistics.contracts (extra_json.terms) | payment_terms | JSONB | approved |
| `special_clauses` | `special_clauses` | UNKNOWN | special_clauses | UNKNOWN | mismatch |
| `description` | `description` | logistics.shipment_cargo.lines[] | description | JSONB | approved |


### Shipments: Step4Logistics.tsx

**Path**: `vibe/src/components/shipments/wizard/Step4Logistics.tsx`  
**Fields Found**: 23

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `containers` | `containers` | logistics.shipment_cargo | containers | JSONB | approved |
| `bol_numbers` | `bol_numbers` | logistics.shipment_logistics | bol_numbers | JSONB | approved |
| `pol_id` | `pol_id` | logistics.shipment_logistics | pol_id | UUID | approved |
| `pol_name` | `pol_name` | UI-ONLY (lookup from pol_id) | pol_name | DERIVED | approved |
| `pod_id` | `pod_id` | logistics.shipment_logistics | pod_id | UUID | approved |
| `pod_name` | `pod_name` | UI-ONLY (lookup from pod_id) | pod_name | DERIVED | approved |
| `etd` | `etd` | logistics.shipment_logistics | etd | DATE | approved |
| `eta` | `eta` | logistics.shipment_logistics | eta | DATE | approved |
| `free_time_days` | `free_time_days` | logistics.shipment_logistics | free_time_days | INTEGER | approved |
| `customs_clearance_date` | `customs_clearance_date` | logistics.shipment_logistics | customs_clearance_date | DATE | approved |
| `shipping_line_id` | `shipping_line_id` | logistics.shipment_parties | shipping_line_id | UUID | approved |
| `transportation_cost` | `transportation_cost` | logistics.shipment_financials | transportation_cost | NUMERIC | approved |
| `booking_no` | `booking_no` | logistics.shipment_logistics | booking_no | TEXT | approved |
| `bl_no` | `bl_no` | logistics.shipment_logistics | bl_no | TEXT | approved |
| `vessel_name` | `vessel_name` | logistics.shipment_logistics | vessel_name | VARCHAR | approved |
| `vessel_imo` | `vessel_imo` | logistics.shipment_logistics | vessel_imo | VARCHAR | approved |
| `truck_plate_number` | `truck_plate_number` | logistics.shipment_logistics | truck_plate_number | VARCHAR | approved |
| `cmr` | `cmr` | logistics.shipment_logistics | cmr | VARCHAR | approved |
| `tanker_name` | `tanker_name` | logistics.shipment_logistics | tanker_name | VARCHAR | approved |
| `tanker_imo` | `tanker_imo` | logistics.shipment_logistics | tanker_imo | VARCHAR | approved |
| `is_split_shipment` | `is_split_shipment` | logistics.shipment_cargo | is_split_shipment | BOOLEAN | approved |
| `batches` | `batches` | logistics.shipment_cargo | batches | JSONB | approved |
| `notes` | `notes` | logistics.shipments | notes | TEXT | approved |


### Shipments: Step5Documents.tsx

**Path**: `vibe/src/components/shipments/wizard/Step5Documents.tsx`  
**Fields Found**: 1

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `documents` | `documents` | logistics.shipment_documents | documents | JSONB | approved |


### Shipments: Step2Financial.tsx

**Path**: `vibe/src/components/shipments/wizard/Step2Financial.tsx`  
**Fields Found**: 0

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|



### Shipments: Step5BankingDocs.tsx

**Path**: `vibe/src/components/shipments/wizard/Step5BankingDocs.tsx`  
**Fields Found**: 0

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|



### Shipments: BatchManagement.tsx

**Path**: `vibe/src/components/shipments/wizard/BatchManagement.tsx`  
**Fields Found**: 21

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `lines[].batch_name` | `batch_name` | logistics.shipment_cargo.batches[] | batch_name | JSONB | approved |
| `lines[].status` | `status` | logistics.shipments | status | VARCHAR | approved |
| `lines[].weight_ton` | `weight_ton` | logistics.shipment_cargo | weight_ton | NUMERIC | approved |
| `lines[].container_count` | `container_count` | logistics.shipment_cargo | container_count | INTEGER | approved |
| `lines[].barrels` | `barrels` | logistics.shipment_cargo | barrels | INTEGER | approved |
| `lines[].pol_id` | `pol_id` | logistics.shipment_logistics | pol_id | UUID | approved |
| `lines[].pod_id` | `pod_id` | logistics.shipment_logistics | pod_id | UUID | approved |
| `lines[].etd` | `etd` | logistics.shipment_logistics | etd | DATE | approved |
| `lines[].eta` | `eta` | logistics.shipment_logistics | eta | DATE | approved |
| `lines[].shipping_line_id` | `shipping_line_id` | logistics.shipment_parties | shipping_line_id | UUID | approved |
| `lines[].booking_no` | `booking_no` | logistics.shipment_logistics | booking_no | TEXT | approved |
| `lines[].bl_no` | `bl_no` | logistics.shipment_logistics | bl_no | TEXT | approved |
| `lines[].container_number` | `container_number` | logistics.shipment_logistics | container_number | VARCHAR | approved |
| `lines[].vessel_name` | `vessel_name` | logistics.shipment_logistics | vessel_name | VARCHAR | approved |
| `lines[].vessel_imo` | `vessel_imo` | logistics.shipment_logistics | vessel_imo | VARCHAR | approved |
| `lines[].truck_plate_number` | `truck_plate_number` | logistics.shipment_logistics | truck_plate_number | VARCHAR | approved |
| `lines[].cmr` | `cmr` | logistics.shipment_logistics | cmr | VARCHAR | approved |
| `lines[].tanker_name` | `tanker_name` | logistics.shipment_logistics | tanker_name | VARCHAR | approved |
| `lines[].tanker_imo` | `tanker_imo` | logistics.shipment_logistics | tanker_imo | VARCHAR | approved |
| `lines[].documents` | `documents` | logistics.shipment_documents | documents | JSONB | approved |
| `lines[].notes` | `notes` | logistics.shipments | notes | TEXT | approved |


### Contracts: Step1CommercialParties.tsx

**Path**: `vibe/src/components/contracts/wizard/Step1CommercialParties.tsx`  
**Fields Found**: 18

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `commercial_parties` | `commercial_parties` | logistics.contracts (extra_json) | commercial_parties | JSONB | approved |
| `shipping` | `shipping` | logistics.contracts (extra_json) | shipping | JSONB | approved |
| `terms` | `terms` | logistics.contracts (extra_json) | terms | JSONB | approved |
| `banking_docs` | `banking_docs` | logistics.contracts (extra_json) | banking_docs | JSONB | approved |
| `direction` | `direction` | logistics.contracts | direction | VARCHAR | approved |
| `proforma_number` | `proforma_number` | logistics.contracts (extra_json.commercial_parties) | proforma_number | JSONB | approved |
| `invoice_date` | `invoice_date` | logistics.contracts (extra_json.commercial_parties) | invoice_date | JSONB | approved |
| `other_reference` | `other_reference` | logistics.contracts (extra_json.commercial_parties) | other_reference | JSONB | approved |
| `exporter_company_id` | `exporter_company_id` | logistics.contracts (extra_json.commercial_parties) | exporter_company_id | JSONB | approved |
| `exporter_name` | `exporter_name` | logistics.contracts (extra_json.commercial_parties) | exporter_name | JSONB | approved |
| `buyer_company_id` | `buyer_company_id` | logistics.contracts | buyer_company_id | UUID | approved |
| `buyer_name` | `buyer_name` | logistics.contracts (extra_json.commercial_parties) | buyer_name | JSONB | approved |
| `consignee_same_as_buyer` | `consignee_same_as_buyer` | logistics.contracts (extra_json.commercial_parties) | consignee_same_as_buyer | JSONB | approved |
| `consignee_company_id` | `consignee_company_id` | logistics.contracts (extra_json.commercial_parties) | consignee_company_id | JSONB | approved |
| `consignee_name` | `consignee_name` | logistics.contracts (extra_json.commercial_parties) | consignee_name | JSONB | approved |
| `has_broker` | `has_broker` | logistics.contracts (extra_json.commercial_parties) | has_broker | JSONB | approved |
| `broker_buying_name` | `broker_buying_name` | logistics.contracts (extra_json.commercial_parties) | broker_buying_name | JSONB | approved |
| `broker_selling_name` | `broker_selling_name` | logistics.contracts (extra_json.commercial_parties) | broker_selling_name | JSONB | approved |


### Contracts: Step2ShippingGeography.tsx

**Path**: `vibe/src/components/contracts/wizard/Step2ShippingGeography.tsx`  
**Fields Found**: 11

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `shipping` | `shipping` | logistics.contracts (extra_json) | shipping | JSONB | approved |
| `country_of_origin` | `country_of_origin` | logistics.contracts (extra_json.shipping) | country_of_origin | JSONB | approved |
| `country_of_final_destination` | `country_of_final_destination` | logistics.contracts (extra_json.shipping) | country_of_final_destination | JSONB | approved |
| `port_of_loading_id` | `port_of_loading_id` | logistics.contracts (extra_json.shipping) | port_of_loading_id | JSONB | approved |
| `port_of_loading_name` | `port_of_loading_name` | logistics.contracts (extra_json.shipping) | port_of_loading_name | JSONB | approved |
| `final_destination_id` | `final_destination_id` | logistics.contracts (extra_json.shipping) | final_destination_id | JSONB | approved |
| `final_destination_name` | `final_destination_name` | logistics.contracts (extra_json.shipping) | final_destination_name | JSONB | approved |
| `pre_carriage_by` | `pre_carriage_by` | logistics.contracts (extra_json.shipping) | pre_carriage_by | JSONB | approved |
| `place_of_receipt` | `place_of_receipt` | logistics.contracts (extra_json.shipping) | place_of_receipt | JSONB | approved |
| `vessel_flight_no` | `vessel_flight_no` | logistics.contracts (extra_json.shipping) | vessel_flight_no | JSONB | approved |
| `estimated_shipment_date` | `estimated_shipment_date` | logistics.contracts (extra_json.shipping) | estimated_shipment_date | JSONB | approved |


### Contracts: Step3TermsPayment.tsx

**Path**: `vibe/src/components/contracts/wizard/Step3TermsPayment.tsx`  
**Fields Found**: 10

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `terms` | `terms` | logistics.contracts (extra_json) | terms | JSONB | approved |
| `incoterm` | `incoterm` | logistics.contracts (extra_json.terms) | incoterm | JSONB | approved |
| `delivery_terms_detail` | `delivery_terms_detail` | logistics.contracts (extra_json.terms) | delivery_terms_detail | JSONB | approved |
| `payment_method` | `payment_method` | logistics.contracts (extra_json.terms) | payment_method | JSONB | approved |
| `currency_code` | `currency_code` | logistics.contracts | currency_code | VARCHAR | approved |
| `payment_terms` | `payment_terms` | logistics.contracts (extra_json.terms) | payment_terms | JSONB | approved |
| `lines[].type` | `type` | logistics.contracts (extra_json.lines[]) | type | JSONB | approved |
| `lines[].tolerance_percentage` | `tolerance_percentage` | logistics.contracts (extra_json.lines[]) | tolerance_percentage | JSONB | approved |
| `lines[].description` | `description` | logistics.contracts (extra_json.lines[]) | description | JSONB | approved |
| `special_clauses` | `special_clauses` | UNKNOWN | special_clauses | UNKNOWN | mismatch |


### Contracts: Step4ProductLines.tsx

**Path**: `vibe/src/components/contracts/wizard/Step4ProductLines.tsx`  
**Fields Found**: 18

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `lines[].quantity_mt` | `quantity_mt` | logistics.contracts (extra_json.lines[]) | quantity_mt | JSONB | approved |
| `lines[].unit_size` | `unit_size` | logistics.contracts (extra_json.lines[]) | unit_size | JSONB | approved |
| `lines[].amount_usd` | `amount_usd` | logistics.contracts (extra_json.lines[]) | amount_usd | JSONB | approved |
| `lines[].rate_usd_per_mt` | `rate_usd_per_mt` | logistics.contracts (extra_json.lines[]) | rate_usd_per_mt | JSONB | approved |
| `lines[].pricing_method` | `pricing_method` | logistics.contracts (extra_json.lines[]) | pricing_method | JSONB | approved |
| `lines[].unit_price` | `unit_price` | logistics.contract_lines | unit_price | NUMERIC | approved |
| `lines[].number_of_pallets` | `number_of_pallets` | logistics.contracts (extra_json.lines[]) | number_of_pallets | JSONB | approved |
| `lines[].product_id` | `product_id` | logistics.contract_lines | product_id | UUID | approved |
| `lines[].product_name` | `product_name` | logistics.contract_lines | product_name | VARCHAR | approved |
| `lines[].type_of_goods` | `type_of_goods` | logistics.contracts (extra_json.lines[]) | type_of_goods | JSONB | approved |
| `lines[].brand` | `brand` | logistics.contracts (extra_json.lines[]) | brand | JSONB | approved |
| `lines[].kind_of_packages` | `kind_of_packages` | logistics.contracts (extra_json.lines[]) | kind_of_packages | JSONB | approved |
| `lines[].number_of_packages` | `number_of_packages` | logistics.contracts (extra_json.lines[]) | number_of_packages | JSONB | approved |
| `lines[].package_size` | `package_size` | logistics.contracts (extra_json.lines[]) | package_size | JSONB | approved |
| `lines[].package_size_unit` | `package_size_unit` | logistics.contracts (extra_json.lines[]) | package_size_unit | JSONB | approved |
| `lines` | `lines` | logistics.contracts (extra_json) | lines | JSONB | approved |
| `volume_cbm` | `volume_cbm` | logistics.contracts (extra_json.lines[]) | volume_cbm | JSONB | approved |
| `volume_liters` | `volume_liters` | logistics.contracts (extra_json.lines[]) | volume_liters | JSONB | approved |


### Contracts: Step5BankingDocs.tsx

**Path**: `vibe/src/components/contracts/wizard/Step5BankingDocs.tsx`  
**Fields Found**: 16

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `banking_docs` | `banking_docs` | logistics.contracts (extra_json) | banking_docs | JSONB | approved |
| `beneficiary_name` | `beneficiary_name` | logistics.contracts (extra_json.banking_docs) | beneficiary_name | JSONB | approved |
| `beneficiary_address` | `beneficiary_address` | logistics.contracts (extra_json.banking_docs) | beneficiary_address | JSONB | approved |
| `beneficiary_account_no` | `beneficiary_account_no` | logistics.contracts (extra_json.banking_docs) | beneficiary_account_no | JSONB | approved |
| `beneficiary_swift_code` | `beneficiary_swift_code` | logistics.contracts (extra_json.banking_docs) | beneficiary_swift_code | JSONB | approved |
| `beneficiary_bank_name` | `beneficiary_bank_name` | logistics.contracts (extra_json.banking_docs) | beneficiary_bank_name | JSONB | approved |
| `beneficiary_bank_address` | `beneficiary_bank_address` | logistics.contracts (extra_json.banking_docs) | beneficiary_bank_address | JSONB | approved |
| `correspondent_bank` | `correspondent_bank` | logistics.contracts (extra_json.banking_docs) | correspondent_bank | JSONB | approved |
| `documentation_responsibility` | `documentation_responsibility` | logistics.contracts (extra_json.banking_docs) | documentation_responsibility | JSONB | approved |
| `documentation_notes` | `documentation_notes` | logistics.contracts (extra_json.banking_docs) | documentation_notes | JSONB | approved |
| `lines[].document_type` | `document_type` | UNKNOWN | document_type | UNKNOWN | mismatch |
| `lines[].attested_by` | `attested_by` | UNKNOWN | attested_by | UNKNOWN | mismatch |
| `lines[].quantity` | `quantity` | logistics.contracts (extra_json.lines[]) | quantity | JSONB | approved |
| `lines[].required` | `required` | UNKNOWN | required | UNKNOWN | mismatch |
| `lines[].legalization_required` | `legalization_required` | UNKNOWN | legalization_required | UNKNOWN | mismatch |
| `lines[].notes` | `notes` | logistics.contracts | notes | TEXT | approved |


### Contracts: ContractUpdateRequestModal.tsx

**Path**: `vibe/src/components/contracts/ContractUpdateRequestModal.tsx`  
**Fields Found**: 0

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|



### Products: ProductFormModal.tsx

**Path**: `vibe/src/components/products/ProductFormModal.tsx`  
**Fields Found**: 9

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `name` | `name` | master_data.products | name | VARCHAR | approved |
| `sku` | `sku` | master_data.products | sku | VARCHAR | approved |
| `hs_code` | `hs_code` | master_data.products | hs_code | VARCHAR | approved |
| `category_type` | `category_type` | master_data.products | category_type | VARCHAR | approved |
| `brand` | `brand` | master_data.products | brand | VARCHAR | approved |
| `uom` | `uom` | master_data.products | uom | VARCHAR | approved |
| `pack_type` | `pack_type` | master_data.products | pack_type | VARCHAR | approved |
| `is_seasonal` | `is_seasonal` | master_data.products | is_seasonal | BOOLEAN | approved |
| `description` | `description` | master_data.products | description | TEXT | approved |


### Products: PriceBenchmarkModal.tsx

**Path**: `vibe/src/components/products/PriceBenchmarkModal.tsx`  
**Fields Found**: 6

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `price_usd_per_mt` | `price_usd_per_mt` | master_data.product_price_benchmarks | price_usd_per_mt | NUMERIC | approved |
| `price_date` | `price_date` | master_data.product_price_benchmarks | price_date | DATE | approved |
| `origin_country` | `origin_country` | master_data.product_price_benchmarks | origin_country | TEXT | approved |
| `incoterm` | `incoterm` | master_data.product_price_benchmarks | incoterm | TEXT | approved |
| `price_source` | `price_source` | master_data.product_price_benchmarks | price_source | TEXT | approved |
| `notes` | `notes` | master_data.product_price_benchmarks | notes | TEXT | approved |


### Products: SeasonFormModal.tsx

**Path**: `vibe/src/components/products/SeasonFormModal.tsx`  
**Fields Found**: 10

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `origin_country` | `origin_country` | master_data.product_seasons | origin_country | TEXT | approved |
| `planting_start_month` | `planting_start_month` | master_data.product_seasons | planting_start_month | INTEGER | approved |
| `planting_end_month` | `planting_end_month` | master_data.product_seasons | planting_end_month | INTEGER | approved |
| `harvest_start_month` | `harvest_start_month` | master_data.product_seasons | harvest_start_month | INTEGER | approved |
| `harvest_end_month` | `harvest_end_month` | master_data.product_seasons | harvest_end_month | INTEGER | approved |
| `peak_start_month` | `peak_start_month` | master_data.product_seasons | peak_start_month | INTEGER | approved |
| `peak_end_month` | `peak_end_month` | master_data.product_seasons | peak_end_month | INTEGER | approved |
| `off_season_start_month` | `off_season_start_month` | master_data.product_seasons | off_season_start_month | INTEGER | approved |
| `off_season_end_month` | `off_season_end_month` | master_data.product_seasons | off_season_end_month | INTEGER | approved |
| `notes` | `notes` | master_data.product_seasons | notes | TEXT | approved |


### Companies: BankingInfoForm.tsx

**Path**: `vibe/src/components/companies/BankingInfoForm.tsx`  
**Fields Found**: 10

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `account_holder_name` | `account_holder_name` | master_data.companies (extra_json.banking) | account_holder_name | JSONB | approved |
| `bank_name` | `bank_name` | master_data.companies (extra_json.banking) | bank_name | JSONB | approved |
| `branch` | `branch` | master_data.companies (extra_json.banking) | branch | JSONB | approved |
| `account_number` | `account_number` | master_data.companies (extra_json.banking) | account_number | JSONB | approved |
| `iban` | `iban` | master_data.companies (extra_json.banking) | iban | JSONB | approved |
| `swift_code` | `swift_code` | master_data.companies (extra_json.banking) | swift_code | JSONB | approved |
| `currency` | `currency` | master_data.companies (extra_json.banking) | currency | JSONB | approved |
| `bank_address` | `bank_address` | master_data.companies (extra_json.banking) | bank_address | JSONB | approved |
| `intermediary_bank` | `intermediary_bank` | master_data.companies (extra_json.banking) | intermediary_bank | JSONB | approved |
| `notes` | `notes` | master_data.companies (extra_json.banking) | notes | JSONB | approved |


### Finance: NewTransactionWizard.tsx

**Path**: `vibe/src/components/finance/NewTransactionWizard.tsx`  
**Fields Found**: 11

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `contract_id` | `contract_id` | finance.transactions | contract_id | UUID | approved |
| `shipment_id` | `shipment_id` | finance.transactions | shipment_id | UUID | approved |
| `description` | `description` | finance.transactions | description | TEXT | approved |
| `transaction_date` | `transaction_date` | finance.transactions | transaction_date | DATE | approved |
| `amount_usd` | `amount_usd` | finance.transactions | amount_usd | NUMERIC | approved |
| `amount_other` | `amount_other` | finance.transactions | amount_other | NUMERIC | approved |
| `currency` | `currency` | finance.transactions | currency | VARCHAR | approved |
| `transaction_type` | `transaction_type` | finance.transactions | transaction_type | VARCHAR | approved |
| `direction` | `direction` | finance.transactions | direction | VARCHAR | approved |
| `fund_source` | `fund_source` | finance.transactions | fund_source | VARCHAR | approved |
| `party_name` | `party_name` | finance.transactions | party_name | VARCHAR | approved |


### Finance: FinancialWizard.tsx

**Path**: `vibe/src/components/finance/FinancialWizard.tsx`  
**Fields Found**: 11

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `transaction_date` | `transaction_date` | finance.transactions | transaction_date | DATE | approved |
| `transaction_type` | `transaction_type` | finance.transactions | transaction_type | VARCHAR | approved |
| `direction` | `direction` | finance.transactions | direction | VARCHAR | approved |
| `amount_usd` | `amount_usd` | finance.transactions | amount_usd | NUMERIC | approved |
| `amount_other` | `amount_other` | finance.transactions | amount_other | NUMERIC | approved |
| `currency` | `currency` | finance.transactions | currency | VARCHAR | approved |
| `fund_source` | `fund_source` | finance.transactions | fund_source | VARCHAR | approved |
| `party_name` | `party_name` | finance.transactions | party_name | VARCHAR | approved |
| `description` | `description` | finance.transactions | description | TEXT | approved |
| `contract_id` | `contract_id` | finance.transactions | contract_id | UUID | approved |
| `shipment_id` | `shipment_id` | finance.transactions | shipment_id | UUID | approved |


### CustomsClearance: CustomsClearingCostModal.tsx

**Path**: `vibe/src/components/customs/CustomsClearingCostModal.tsx`  
**Fields Found**: 21

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `file_number` | `file_number` | finance.customs_clearing_costs | file_number | VARCHAR | approved |
| `clearance_type` | `clearance_type` | finance.customs_clearing_costs | clearance_type | VARCHAR | approved |
| `transaction_type` | `transaction_type` | finance.customs_clearing_costs | transaction_type | VARCHAR | approved |
| `goods_type` | `goods_type` | finance.customs_clearing_costs | goods_type | VARCHAR | approved |
| `containers_cars_count` | `containers_cars_count` | finance.customs_clearing_costs | containers_cars_count | VARCHAR | approved |
| `goods_weight` | `goods_weight` | finance.customs_clearing_costs | goods_weight | VARCHAR | approved |
| `cost_description` | `cost_description` | finance.customs_clearing_costs | cost_description | TEXT | approved |
| `destination_final_beneficiary` | `destination_final_beneficiary` | finance.customs_clearing_costs | destination_final_beneficiary | VARCHAR | approved |
| `bol_number` | `bol_number` | finance.customs_clearing_costs | bol_number | VARCHAR | approved |
| `car_plate` | `car_plate` | finance.customs_clearing_costs | car_plate | VARCHAR | approved |
| `original_clearing_amount` | `original_clearing_amount` | finance.customs_clearing_costs | original_clearing_amount | NUMERIC | approved |
| `extra_cost_amount` | `extra_cost_amount` | finance.customs_clearing_costs | extra_cost_amount | NUMERIC | approved |
| `cost_responsibility` | `cost_responsibility` | finance.customs_clearing_costs | cost_responsibility | VARCHAR | approved |
| `extra_cost_description` | `extra_cost_description` | finance.customs_clearing_costs | extra_cost_description | TEXT | approved |
| `client_name` | `client_name` | finance.customs_clearing_costs | client_name | VARCHAR | approved |
| `invoice_number` | `invoice_number` | finance.customs_clearing_costs | invoice_number | VARCHAR | approved |
| `invoice_amount` | `invoice_amount` | finance.customs_clearing_costs | invoice_amount | NUMERIC | approved |
| `currency` | `currency` | finance.customs_clearing_costs | currency | VARCHAR | approved |
| `invoice_date` | `invoice_date` | finance.customs_clearing_costs | invoice_date | DATE | approved |
| `payment_status` | `payment_status` | finance.customs_clearing_costs | payment_status | VARCHAR | approved |
| `notes` | `notes` | finance.customs_clearing_costs | notes | TEXT | approved |


### CustomsClearance: FileFirstCostEntry.tsx

**Path**: `vibe/src/components/customs/FileFirstCostEntry.tsx`  
**Fields Found**: 0

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|



### CustomsClearance: CreateBatchModal.tsx

**Path**: `vibe/src/components/customs/CreateBatchModal.tsx`  
**Fields Found**: 0

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|



### LandTransport: DeliveryFormModal.tsx

**Path**: `vibe/src/components/land-transport/DeliveryFormModal.tsx`  
**Fields Found**: 18

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
| `destination` | `destination` | logistics.deliveries | destination | VARCHAR | approved |
| `delivery_date` | `delivery_date` | logistics.deliveries | delivery_date | DATE | approved |
| `status` | `status` | logistics.deliveries | status | VARCHAR | approved |
| `origin` | `origin` | logistics.deliveries | origin | VARCHAR | approved |
| `transport_company_id` | `transport_company_id` | logistics.deliveries | transport_company_id | UUID | approved |
| `vehicle_type` | `vehicle_type` | logistics.deliveries | vehicle_type | VARCHAR | approved |
| `truck_plate_number` | `truck_plate_number` | logistics.deliveries | truck_plate_number | VARCHAR | approved |
| `driver_name` | `driver_name` | logistics.deliveries | driver_name | VARCHAR | approved |
| `driver_phone` | `driver_phone` | logistics.deliveries | driver_phone | VARCHAR | approved |
| `goods_description` | `goods_description` | logistics.deliveries | goods_description | TEXT | approved |
| `container_id` | `container_id` | logistics.deliveries | container_id | UUID | approved |
| `package_count` | `package_count` | logistics.deliveries | package_count | INTEGER | approved |
| `weight_kg` | `weight_kg` | logistics.deliveries | weight_kg | NUMERIC | approved |
| `customer_name` | `customer_name` | logistics.deliveries | customer_name | VARCHAR | approved |
| `customer_phone` | `customer_phone` | logistics.deliveries | customer_phone | VARCHAR | approved |
| `transport_cost` | `transport_cost` | logistics.deliveries | transport_cost | NUMERIC | approved |
| `selling_price` | `selling_price` | logistics.deliveries | selling_price | NUMERIC | approved |
| `notes` | `notes` | logistics.deliveries | notes | TEXT | approved |


---

## Mapping Quick Reference

### Shipments Module

| Frontend (camelCase) | API/DB (snake_case) | Normalized Table |
|---------------------|---------------------|------------------|
| supplierCompanyId | supplier_id | shipment_parties |
| customerCompanyId | customer_id | shipment_parties |
| shippingLineId | shipping_line_id | shipment_parties |
| cargoType | cargo_type | shipment_cargo |
| containerCount | container_count | shipment_cargo |
| weightTon | weight_ton | shipment_cargo |
| polId | pol_id | shipment_logistics |
| podId | pod_id | shipment_logistics |
| eta | eta | shipment_logistics |
| etd | etd | shipment_logistics |
| fixedPriceUsdPerTon | fixed_price_usd_per_ton | shipment_financials |
| paymentMethod | payment_method | shipment_financials |

### Contracts Module

| Frontend (camelCase) | API/DB (snake_case) | Table |
|---------------------|---------------------|-------|
| contractNo | contract_no | contracts |
| buyerCompanyId | buyer_company_id | contracts |
| sellerCompanyId | seller_company_id | contracts |
| currencyCode | currency_code | contracts |

### Finance Module

| Frontend (camelCase) | API/DB (snake_case) | Table |
|---------------------|---------------------|-------|
| transactionDate | transaction_date | transactions |
| amountUsd | amount_usd | transactions |
| fundSource | fund_source | transactions |
| partyName | party_name | transactions |

---

*Report generated by Field Mapping Audit Tool*
