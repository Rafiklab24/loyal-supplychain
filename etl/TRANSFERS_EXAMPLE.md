# Transfers Loader - Example Usage & Output

## Example Excel Structure

### File: "حوالات 2025.xlsx"

| التاريخ    | المبلغ    | العملة | البنك      | المرسل         | المستلم      | SN          | النوع |
|-----------|----------|--------|------------|----------------|-------------|-------------|-------|
| 2025-01-15| 50000    | USD    | Bank ABC   | Supplier Ltd   | Our Company | SN-2024-001 | وارد  |
| 2025-01-20| 25000    | USD    | Bank XYZ   | Our Company    | Freight Co  | SN-2024-001 | مدفوع |
| 2025-01-22| 75000    | USD    | Bank ABC   | Customer Inc   | Our Company | SN-2024-002 | وارد  |
| 2025-01-25| 10000    | EUR    | Bank 123   | Our Company    | Customs     |             | مدفوع |

## Running the Loader

### Normal Import

```bash
ts-node etl/transfers-loader.ts --file "حوالات 2025.xlsx"
```

**Output:**

```
📊 Loading transfers from: حوالات 2025.xlsx
📄 Reading sheet: Sheet1
📋 Found 4 rows

  Processed 4/4 rows...

============================================================
📊 حوالات ETL – File: حوالات 2025.xlsx
============================================================
✓ Parsed: 4 rows
✓ Inserted: 4
⊗ Skipped: 0
⚠️  Unknown SNs: 0

Totals by Direction & Currency:
  ⬇️  received USD: 125,000.00
  ⬆️  paid USD: 25,000.00
  ⬆️  paid EUR: 10,000.00

✅ Import complete in 0.8s
============================================================
```

### Dry-Run Mode

```bash
ts-node etl/transfers-loader.ts --file "حوالات 2025.xlsx" --dry-run
```

**Output:**

```
📊 Loading transfers from: حوالات 2025.xlsx
🔍 DRY RUN MODE enabled

📄 Reading sheet: Sheet1
📋 Found 4 rows

  Processed 4/4 rows...

============================================================
📊 حوالات ETL – File: حوالات 2025.xlsx
🔍 DRY RUN MODE - No data inserted
============================================================
✓ Parsed: 4 rows
✓ Inserted: 4
⊗ Skipped: 0
⚠️  Unknown SNs: 0

Totals by Direction & Currency:
  ⬇️  received USD: 125,000.00
  ⬆️  paid USD: 25,000.00
  ⬆️  paid EUR: 10,000.00

✅ Import complete in 0.6s
============================================================
```

## With Unknown SNs

If Excel contains SNs that don't exist in `logistics.shipments`:

**Excel:**
| التاريخ    | المبلغ    | SN          | النوع |
|-----------|----------|-------------|-------|
| 2025-01-15| 50000    | SN-9999-BAD | وارد  |

**Output:**

```
📊 Loading transfers from: test.xlsx
📄 Reading sheet: Sheet1
📋 Found 1 rows

⚠️  Row 2: SN "SN-9999-BAD" not found in shipments

============================================================
📊 حوالات ETL – File: test.xlsx
============================================================
✓ Parsed: 1 rows
✓ Inserted: 1
⊗ Skipped: 0
⚠️  Unknown SNs: 1

Totals by Direction & Currency:
  ⬇️  received USD: 50,000.00

✅ Import complete in 0.4s
============================================================
```

The transfer is still inserted but with `shipment_id = NULL`.

## Database Results

After import, `finance.transfers` contains:

| id | transfer_date | direction | amount   | currency | sender         | receiver    | shipment_id                          |
|----|---------------|-----------|----------|----------|----------------|-------------|--------------------------------------|
| 1  | 2025-01-15    | received  | 50000.00 | USD      | Supplier Ltd   | Our Company | abc123...                            |
| 2  | 2025-01-20    | paid      | 25000.00 | USD      | Our Company    | Freight Co  | abc123...                            |
| 3  | 2025-01-22    | received  | 75000.00 | USD      | Customer Inc   | Our Company | def456...                            |
| 4  | 2025-01-25    | paid      | 10000.00 | EUR      | Our Company    | Customs     | NULL                                 |

## Automatic Balance Updates

The database triggers automatically update shipment balances:

**Before transfers import:**
```sql
SELECT sn, total_value_usd, paid_value_usd, balance_value_usd 
FROM logistics.shipments 
WHERE sn = 'SN-2024-001';
```
| sn          | total_value_usd | paid_value_usd | balance_value_usd |
|-------------|-----------------|----------------|-------------------|
| SN-2024-001 | 100000.00       | 0.00           | 100000.00         |

**After transfers import (50,000 received):**
| sn          | total_value_usd | paid_value_usd | balance_value_usd |
|-------------|-----------------|----------------|-------------------|
| SN-2024-001 | 100000.00       | 50000.00       | 50000.00          |

## Import Log Tracking

Each import is automatically logged to `security.import_log`:

```sql
SELECT * FROM security.import_log ORDER BY started_at DESC LIMIT 3;
```

| id | file_name          | file_sha256 | row_count | ok_count | err_count | started_at          | finished_at         | notes           |
|----|--------------------|-------------|-----------|----------|-----------|---------------------|---------------------|-----------------|
| 3  | حوالات 2025.xlsx   | 3a4f5b...   | 4         | 4        | 0         | 2025-01-26 10:30:00 | 2025-01-26 10:30:01 | Unknown SNs: 0  |
| 2  | حوالات 2024.xlsx   | 8c2d1e...   | 156       | 150      | 6         | 2025-01-25 15:20:00 | 2025-01-25 15:20:12 | Unknown SNs: 8  |
| 1  | test.xlsx          | 1b9f3a...   | 1         | 1        | 0         | 2025-01-25 09:15:00 | 2025-01-25 09:15:00 | Unknown SNs: 1  |

## Column Name Flexibility

The loader handles many variations:

### English Headers Work:
```
Date | Amount | Currency | Bank | Sender | Receiver | SN | Type
```

### Arabic Headers Work:
```
التاريخ | المبلغ | العملة | البنك | المرسل | المستلم | SN | النوع
```

### Mixed or Partial Matches Work:
```
تاريخ | Amount | عملة | Bank Name | From | To | المرجع الداخلي | Direction
```

### Case-Insensitive:
```
DATE | AMOUNT | Currency | bank | SENDER | receiver | sn | type
```

## Error Handling

### Invalid Date:
```
⚠️  Row 5: Cannot parse date "invalid-date"
```
Row is skipped, import continues.

### Missing Required Fields:
```
✗ Row 7: Missing required field: amount
```
Row is skipped, import continues.

### Invalid Direction:
```
✗ Row 9: Invalid direction "unknown" - must be received/paid or وارد/مدفوع
```
Row is skipped, import continues.

### Final Summary Shows All Issues:
```
============================================================
✓ Parsed: 100 rows
✓ Inserted: 92
⊗ Skipped: 8
⚠️  Unknown SNs: 5

✗ Errors: 8
  - Row 5: Cannot parse date "invalid-date"
  - Row 7: Missing required field: amount
  - Row 9: Invalid direction "unknown"
  - Row 12: Amount must be a number
  - Row 23: Missing required field: transfer_date
  ... and 3 more

✅ Import complete in 3.2s
============================================================
```

## Best Practices

1. **Always run with --dry-run first** to validate your data
2. **Check for Unknown SNs** and fix them in source data if needed
3. **Review import_log** table after each run
4. **Run QA checks** after bulk imports: `npm run etl:qa`
5. **Use consistent column headers** across all transfer files

