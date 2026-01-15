# Field Mapping E2E Test Report

**Generated**: 2025-12-05T14:51:02.770Z

---

## Summary

| Metric | Count |
|--------|-------|
| Total Fields Tested | 56 |
| ✅ Passed | 56 |
| ❌ Failed | 0 |
| ⚠️ Warnings | 0 |
| Success Rate | 100.0% |

---

## Module Results

### Shipments

| Metric | Count |
|--------|-------|
| Fields Tested | 33 |
| Passed | 33 |
| Failed | 0 |
| Warnings | 0 |

✅ All fields passed!

### Contracts

| Metric | Count |
|--------|-------|
| Fields Tested | 15 |
| Passed | 15 |
| Failed | 0 |
| Warnings | 0 |

✅ All fields passed!

### Products

| Metric | Count |
|--------|-------|
| Fields Tested | 8 |
| Passed | 8 |
| Failed | 0 |
| Warnings | 0 |

✅ All fields passed!

---

## All Test Results

### Shipments - Detailed Results

| Status | Field | Sent Value | DB Value | API Value |
|--------|-------|------------|----------|-----------|
| ✅ | `transaction_type` | `"incoming"` | `"incoming"` | `"incoming"` |
| ✅ | `sn` | `"E2E-TEST-1764946262690"` | `"E2E-TEST-1764946262690"` | `"E2E-TEST-1764946262690"` |
| ✅ | `subject` | `"Test Shipment E2E-TEST-176494` | `"Test Shipment E2E-TEST-176494` | `"Test Shipment E2E-TEST-176494` |
| ✅ | `has_sales_contract` | `true` | `true` | `true` |
| ✅ | `supplier_id` | `"e51bdfdf-f481-43dc-a56c-56eaa` | `"e51bdfdf-f481-43dc-a56c-56eaa` | `"e51bdfdf-f481-43dc-a56c-56eaa` |
| ✅ | `customer_id` | `"04e330eb-a98f-43e9-902b-94dac` | `"04e330eb-a98f-43e9-902b-94dac` | `"04e330eb-a98f-43e9-902b-94dac` |
| ✅ | `has_broker` | `true` | `true` | `true` |
| ✅ | `broker_name` | `"Test Broker Company"` | `"Test Broker Company"` | `"Test Broker Company"` |
| ✅ | `cargo_type` | `"container"` | `"container"` | `"container"` |
| ✅ | `container_count` | `2` | `2` | `2` |
| ✅ | `weight_ton` | `50` | `50` | `"50.000"` |
| ✅ | `lines` | `1` | `1` | `1` |
| ✅ | `pol_id` | `"faeed464-b74f-4932-a9d5-6a2fd` | `"faeed464-b74f-4932-a9d5-6a2fd` | `"faeed464-b74f-4932-a9d5-6a2fd` |
| ✅ | `pod_id` | `"654b78df-a1ab-4807-8f63-75fe5` | `"654b78df-a1ab-4807-8f63-75fe5` | `"654b78df-a1ab-4807-8f63-75fe5` |
| ✅ | `eta` | `"2025-02-15"` | `"2025-02-14"` | `"2025-02-14"` |
| ✅ | `etd` | `"2025-02-01"` | `"2025-01-31"` | `"2025-01-31"` |
| ✅ | `booking_no` | `"BK-E2E-TEST-1764946262690"` | `"BK-E2E-TEST-1764946262690"` | `"BK-E2E-TEST-1764946262690"` |
| ✅ | `bl_no` | `"BL-E2E-TEST-1764946262690"` | `"BL-E2E-TEST-1764946262690"` | `"BL-E2E-TEST-1764946262690"` |
| ✅ | `vessel_name` | `"Test Vessel"` | `"Test Vessel"` | `"Test Vessel"` |
| ✅ | `incoterms` | `"CIF"` | `"CIF"` | `"CIF"` |
| ✅ | `payment_method` | `"lc"` | `"lc"` | `"lc"` |
| ✅ | `lc_number` | `"LC-E2E-TEST-1764946262690"` | `"LC-E2E-TEST-1764946262690"` | `"LC-E2E-TEST-1764946262690"` |
| ✅ | `notes` | `"Test shipment notes for E2E t` | `"Test shipment notes for E2E t` | `"Test shipment notes for E2E t` |
| ✅ | `lines[0].product_name` | `"Test Product"` | `"Test Product"` | `"Test Product"` |
| ✅ | `lines[0].type_of_goods` | `"Bulk Cargo"` | `"Bulk Cargo"` | `"Bulk Cargo"` |
| ✅ | `lines[0].brand` | `"Test Brand"` | `"Test Brand"` | `"Test Brand"` |
| ✅ | `lines[0].kind_of_packages` | `"bags"` | `"bags"` | `"bags"` |
| ✅ | `lines[0].number_of_packages` | `1000` | `1000` | `1000` |
| ✅ | `lines[0].quantity_mt` | `50` | `50` | `50` |
| ✅ | `lines[0].unit_price` | `500` | `500` | `500` |
| ✅ | `lines[0].amount_usd` | `25000` | `25000` | `25000` |
| ✅ | `lines[0].volume_cbm` | `100` | `100` | `100` |
| ✅ | `lines[0].volume_liters` | `100000` | `100000` | `100000` |

### Contracts - Detailed Results

| Status | Field | Sent Value | DB Value | API Value |
|--------|-------|------------|----------|-----------|
| ✅ | `contract_no` | `"CONTRACT-E2E-TEST-17649462627` | `"CONTRACT-E2E-TEST-17649462627` | `"CONTRACT-E2E-TEST-17649462627` |
| ✅ | `buyer_company_id` | `"04e330eb-a98f-43e9-902b-94dac` | `"04e330eb-a98f-43e9-902b-94dac` | `"04e330eb-a98f-43e9-902b-94dac` |
| ✅ | `seller_company_id` | `"e51bdfdf-f481-43dc-a56c-56eaa` | `"e51bdfdf-f481-43dc-a56c-56eaa` | `"e51bdfdf-f481-43dc-a56c-56eaa` |
| ✅ | `status` | `"DRAFT"` | `"DRAFT"` | `"DRAFT"` |
| ✅ | `direction` | `"incoming"` | `"incoming"` | `"incoming"` |
| ✅ | `subject` | `"Test Contract E2E-TEST-176494` | `"Test Contract E2E-TEST-176494` | `"Test Contract E2E-TEST-176494` |
| ✅ | `currency_code (extra_json)` | `"USD"` | `"USD"` | `"USD"` |
| ✅ | `notes` | `"Test contract notes"` | `"Test contract notes"` | `"Test contract notes"` |
| ✅ | `commercial_parties.proforma_number` | `"PF-E2E-TEST-1764946262738"` | `"PF-E2E-TEST-1764946262738"` | `"PF-E2E-TEST-1764946262738"` |
| ✅ | `commercial_parties.has_broker` | `true` | `true` | `true` |
| ✅ | `shipping.country_of_origin` | `"Turkey"` | `"Turkey"` | `"Turkey"` |
| ✅ | `shipping.country_of_final_destination` | `"Syria"` | `"Syria"` | `"Syria"` |
| ✅ | `terms.incoterm` | `"CIF"` | `"CIF"` | `"CIF"` |
| ✅ | `terms.payment_terms` | `"LC at sight"` | `"LC at sight"` | `"LC at sight"` |
| ✅ | `banking_docs.beneficiary_name` | `"Test Beneficiary"` | `"Test Beneficiary"` | `"Test Beneficiary"` |

### Products - Detailed Results

| Status | Field | Sent Value | DB Value | API Value |
|--------|-------|------------|----------|-----------|
| ✅ | `name` | `"Test Product E2E-TEST-1764946` | `"Test Product E2E-TEST-1764946` | `"Test Product E2E-TEST-1764946` |
| ✅ | `sku` | `"SKU-E2E-TEST-1764946262759"` | `"SKU-E2E-TEST-1764946262759"` | `"SKU-E2E-TEST-1764946262759"` |
| ✅ | `category_type` | `"commodity"` | `"commodity"` | `"commodity"` |
| ✅ | `hs_code` | `"1001.99"` | `"1001.99"` | `"1001.99"` |
| ✅ | `is_active` | `true` | `true` | `true` |
| ✅ | `brand` | `"Test Brand"` | `"Test Brand"` | `"Test Brand"` |
| ✅ | `uom` | `"MT"` | `"MT"` | `"MT"` |
| ✅ | `is_seasonal` | `true` | `true` | `true` |

---

*Report generated by Field Mapping E2E Test*
