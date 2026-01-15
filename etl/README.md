# ETL Scripts

Data ingestion scripts for Loyal Supply Chain Management system.

## Prerequisites

```bash
# From project root
npm install

# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:pass@host:5432/loyal_supplychain"
```

## Excel Loader - Arrivals Board

Imports `البضاعة القادمة محدث.xlsx` into `logistics.shipments`.

### Features

- ✅ Arabic column name mapping to English database fields
- ✅ Automatic lookup/upsert for ports (POL/POD)
- ✅ Automatic lookup/upsert for shipping line companies
- ✅ Arabic status mapping to database enums
- ✅ Automatic `total_value_usd` calculation (weight × price)
- ✅ Upsert by `sn` field (insert or update existing)
- ✅ All shipments default to `direction = 'incoming'`

### Usage

```bash
# From project root
ts-node etl/excel-loader.ts --file "/path/to/البضاعة القادمة محدث.xlsx"

# Or using npm script
npm run etl:excel -- --file "/path/to/البضاعة القادمة محدث.xlsx"
```

### Column Mapping

| Excel Column (Arabic)           | Database Field            | Notes                                      |
|---------------------------------|---------------------------|--------------------------------------------|
| SN                              | `sn`                      | Unique key for upsert                      |
| نوع البضاعة                     | `product_text`            |                                            |
| عدد الحاويات                    | `container_count`         |                                            |
| الوزن/طن                        | `weight_ton`              |                                            |
| التثبيت $                       | `fixed_price_usd_per_ton` |                                            |
| POL                             | `pol_id`                  | Lookup/insert in `master_data.ports`       |
| POD                             | `pod_id`                  | Lookup/insert in `master_data.ports`       |
| ETA                             | `eta`                     |                                            |
| FREE TIME / السماح              | `free_time_days`          |                                            |
| الحالة                          | `status`                  | Maps Arabic → enum (see below)             |
| الآوراق                         | `paperwork_status`        |                                            |
| شركة الشحن                      | `shipping_line_id`        | Lookup/insert with `is_shipping_line=true` |
| التعقب                          | `booking_no`              |                                            |
| رقم البوليصة                    | `bl_no`                   |                                            |
| تاريخ الرعبون                   | `deposit_date`            |                                            |
| تاريخ الشحن حسب العقد           | `contract_ship_date`      |                                            |
| تاريخ البوليصة                  | `bl_date`                 |                                            |

### Status Mapping

| Arabic Status  | Database Enum |
|----------------|---------------|
| تخطيط          | `planning`    |
| محجوز          | `booked`      |
| دخل الميناء    | `gate_in`     |
| تحميل          | `loaded`      |
| أبحرت          | `sailed`      |
| وصلت           | `arrived`     |
| مُسلمة         | `delivered`   |
| مفوترة         | `invoiced`    |

## Suppliers Loader

Imports supplier data from Excel files into `master_data.companies`.

### Features

- ✅ Flexible column name matching (handles variations)
- ✅ Multi-file support (load multiple Excel files at once)
- ✅ Smart upsert by `lower(name), lower(country)`
- ✅ Preserves existing data (only fills NULL fields)
- ✅ Sets `is_supplier=true` automatically
- ✅ Handles both English and Arabic column headers

### Usage

```bash
# Single file
ts-node etl/suppliers-loader.ts --files "LOYAL- SUPPLIER INDEX modified.xlsx"

# Multiple files (comma-separated)
ts-node etl/suppliers-loader.ts --files "LOYAL- SUPPLIER INDEX modified.xlsx,WorldFood 2025 Suppliers.xlsx"

# Or using npm script
npm run etl:suppliers -- --files "file1.xlsx,file2.xlsx"
```

### Column Mapping

The loader intelligently matches columns by trying multiple patterns (case-insensitive):

| Field    | Recognized Column Names                                      |
|----------|--------------------------------------------------------------|
| name     | Company, Supplier, Company Name, Supplier Name, Name, اسم الشركة, المورد |
| country  | Country, الدولة, البلد                                       |
| city     | City, المدينة                                                |
| address  | Address, العنوان                                             |
| phone    | Phone, WhatsApp, Phone/WhatsApp, Mobile, Tel, هاتف, واتساب  |
| email    | Email, E-mail, البريد الإلكتروني                            |
| website  | Website, Web, URL, الموقع                                    |

### Data Preservation Strategy

- **New records**: All fields are inserted
- **Existing records**: 
  - Only NULL fields are updated with new data
  - Existing non-null values are preserved
  - `is_supplier` is always set to `true`
  - `updated_at` and `updated_by` are refreshed

## Transfers Loader

Imports حوالات (bank transfers) from Excel files into `finance.transfers`.

### Features

- ✅ Flexible column name matching (English + Arabic)
- ✅ Automatic shipment lookup by SN
- ✅ Smart direction mapping (وارد→received, مدفوع→paid)
- ✅ Date parsing (Excel serials + string formats)
- ✅ Amount parsing (handles commas and Arabic numerals)
- ✅ Dry-run mode for validation without inserting
- ✅ Automatic import logging to `security.import_log`
- ✅ Comprehensive summary with totals by direction/currency
- ✅ DB triggers auto-update shipment balances

### Usage

```bash
# Normal import
ts-node etl/transfers-loader.ts --file "/path/الحوالات2025.xlsx"

# Dry-run (validate without inserting)
ts-node etl/transfers-loader.ts --file "/path/الحوالات2025.xlsx" --dry-run

# Using npm script
npm run etl:transfers -- --file "/path/الحوالات2025.xlsx"
npm run etl:transfers -- --file "/path/الحوالات2025.xlsx" --dry-run
```

### Column Mapping

| Excel Column (Arabic/English) | Database Field  | Notes                                    |
|-------------------------------|-----------------|------------------------------------------|
| التاريخ / Date                | `transfer_date` | Required                                 |
| المبلغ / Amount               | `amount`        | Required                                 |
| العملة / Currency             | `currency`      | Defaults to "USD"                        |
| البنك / Bank                  | `bank_name`     |                                          |
| الحساب / Account              | `bank_account`  |                                          |
| المرسل / Sender               | `sender`        |                                          |
| المستلم / Receiver            | `receiver`      |                                          |
| المرجع / Reference            | `reference`     |                                          |
| ملاحظة / Notes                | `notes`         |                                          |
| SN / المرجع الداخلي           | `shipment_id`   | Lookup in `logistics.shipments` by `sn` |
| النوع / Type                  | `direction`     | Required (see mapping below)             |

### Direction Mapping

| Arabic/English Input | Database Enum |
|---------------------|---------------|
| وارد                | `received`    |
| مدفوع               | `paid`        |
| received / in       | `received`    |
| paid / out          | `paid`        |

### Output Example

```
📊 حوالات ETL – File: الحوالات2025.xlsx
============================================================
✓ Parsed: 243 rows
✓ Inserted: 235
⊗ Skipped: 0
⚠️  Unknown SNs: 8

Totals by Direction & Currency:
  ⬇️  received USD: 1,245,000.00
  ⬆️  paid USD: 450,000.00

✅ Import complete in 2.3s
============================================================
```

### Dry-Run Mode

Perfect for validating data before importing:

```bash
ts-node etl/transfers-loader.ts --file "test.xlsx" --dry-run
```

- Parses all data
- Validates dates, amounts, directions
- Performs SN lookups
- Shows complete summary
- **Does NOT insert** any data
- **Does NOT log** to import_log table

## QA Checks

Data quality audit script to identify issues in the database.

### Usage

```bash
# Run all quality checks
ts-node etl/qa-checks.ts

# Or using npm script
npm run etl:qa
```

### Checks Performed

1. **Missing SN** - Shipments without serial numbers
2. **Incomplete price/weight** - Shipments missing weight or price data
3. **Late ETA not arrived** - Shipments past ETA but not marked as arrived
4. **Transfers w/o shipment** - Transfers not linked to any shipment
5. **Suspicious ports** - Ports with very short or numeric-only names
6. **Suspicious shipping lines** - Shipping line companies with short names
7. **Orphaned milestones** - Milestones referencing deleted shipments
8. **Duplicate SNs** - Multiple shipments with same serial number

### Output Example

```
============================================================
📋 QA CHECKS SUMMARY
============================================================

✓ [1] Missing SN ........................... 0
⚠️ [2] Incomplete price/weight ............. 2
    Samples (showing up to 10):
      1. sn=SN-2024-003, product_text=Rice, weight_ton=null, fixed_price_usd_per_ton=450
      2. sn=SN-2024-007, product_text=Wheat, weight_ton=25, fixed_price_usd_per_ton=null

⚠️ [3] Late ETA not arrived ................ 5
    Samples (showing up to 10):
      1. sn=SN-2024-001, eta=2024-01-15, status=sailed, product_text=Sugar
      2. sn=SN-2024-002, eta=2024-01-20, status=loaded, product_text=Flour

⚠️ [4] Transfers w/o shipment .............. 8
✓ [5] Suspicious ports ..................... 0
✓ [6] Suspicious shipping lines............ 0
✓ [7] Orphaned milestones.................. 0
✓ [8] Duplicate SNs........................ 0

============================================================
⚠️  Found 15 total issue(s) - review samples above
============================================================
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)

## Error Handling

- Rows without `sn` are skipped with a warning
- Failed rows are logged but don't stop the entire import
- Import summary shows success/error counts
- All operations are wrapped in error handlers

