# Suppliers Loader - Example Usage

## Example Excel Structure

### File 1: "LOYAL- SUPPLIER INDEX modified.xlsx"

| Company Name          | Country | City     | Phone         | Email                    |
|-----------------------|---------|----------|---------------|--------------------------|
| ABC Trading Co.       | Turkey  | Istanbul | +90 123 4567  | info@abctrading.com      |
| XYZ Foods Ltd         | Egypt   | Cairo    | +20 555 1234  | sales@xyzfoods.com       |
| Global Supplies Inc   | USA     | New York | +1 555 0100   | contact@globalsupply.com |

### File 2: "WorldFood 2025 Suppliers.xlsx"

| Supplier              | Country | City      | Address           | Website               |
|-----------------------|---------|-----------|-------------------|-----------------------|
| ABC Trading Co.       | Turkey  | Istanbul  | Ataturk Blvd 123  | www.abctrading.com    |
| Fresh Produce LLC     | Spain   | Barcelona | Rambla St 45      | www.freshproduce.es   |

## Running the Loader

```bash
ts-node etl/suppliers-loader.ts --files "LOYAL- SUPPLIER INDEX modified.xlsx,WorldFood 2025 Suppliers.xlsx"
```

## Expected Output

```
📦 Suppliers ETL - Loading 2 file(s)

📊 Loading Excel file: LOYAL- SUPPLIER INDEX modified.xlsx
📄 Reading sheet: Sheet1
📋 Found 3 rows
✓ Inserted supplier: ABC Trading Co. (Turkey)
✓ Inserted supplier: XYZ Foods Ltd (Egypt)
✓ Inserted supplier: Global Supplies Inc (USA)

📊 Loading Excel file: WorldFood 2025 Suppliers.xlsx
📄 Reading sheet: Sheet1
📋 Found 2 rows
✓ Updated supplier: ABC Trading Co. (Turkey)
✓ Inserted supplier: Fresh Produce LLC (Spain)

============================================================
✅ All files processed
   Total successful: 5
   Total errors: 0
============================================================
```

## What Happened

1. **First file loaded**:
   - ABC Trading Co. (Turkey) - **INSERTED** with phone, email
   - XYZ Foods Ltd (Egypt) - **INSERTED** with phone, email
   - Global Supplies Inc (USA) - **INSERTED** with phone, email

2. **Second file loaded**:
   - ABC Trading Co. (Turkey) - **UPDATED** (added address & website, kept existing phone & email)
   - Fresh Produce LLC (Spain) - **INSERTED** with address, website

## Database Result

After loading, `master_data.companies` contains:

| name                  | country | city      | phone         | email                    | website               | is_supplier |
|-----------------------|---------|-----------|---------------|--------------------------|----------------------|-------------|
| ABC Trading Co.       | Turkey  | Istanbul  | +90 123 4567  | info@abctrading.com      | www.abctrading.com   | true        |
| XYZ Foods Ltd         | Egypt   | Cairo     | +20 555 1234  | sales@xyzfoods.com       | NULL                 | true        |
| Global Supplies Inc   | USA     | New York  | +1 555 0100   | contact@globalsupply.com | NULL                 | true        |
| Fresh Produce LLC     | Spain   | Barcelona | NULL          | NULL                     | www.freshproduce.es  | true        |

## Key Features Demonstrated

1. **Upsert by (name, country)**: ABC Trading Co. from Turkey appears in both files → merged into one record
2. **Data preservation**: ABC Trading's phone/email from file 1 were preserved when file 2 added address/website
3. **NULL field filling**: File 2 filled the empty address and website fields for ABC Trading
4. **Multiple files**: Both files processed in sequence
5. **Automatic flagging**: All records have `is_supplier = true`

## Column Flexibility

The loader recognizes many column name variations:

### Works with English headers:
- "Company Name", "Supplier Name", "Name"
- "Country", "City", "Address"
- "Phone", "WhatsApp", "Mobile"
- "Email", "E-mail"
- "Website", "URL"

### Works with Arabic headers:
- "اسم الشركة", "المورد"
- "الدولة", "البلد"
- "المدينة"
- "العنوان"
- "هاتف", "واتساب"
- "البريد الإلكتروني"
- "الموقع"

### Case-insensitive and partial matching:
- "COMPANY NAME" ✓
- "company_name" ✓
- "Phone/WhatsApp" ✓
- "supplier" ✓

