# 🚀 Environment Setup & Testing Guide

Complete guide to set up and test the Loyal Supply Chain ETL system.

---

## 📋 Prerequisites

- ✅ Node.js 20+ installed
- ✅ PostgreSQL 16+ running
- ✅ Access to a PostgreSQL database

---

## 🔧 Step 1: Environment Setup

### Check installations
```bash
node --version    # Should be v20+
npm --version
psql --version    # Should be 16+
```

### Install dependencies
```bash
# Already done! ✅
# App dependencies: /Users/rafik/loyal-supplychain/app/node_modules
# ETL dependencies: /Users/rafik/loyal-supplychain/node_modules
```

---

## 🗄️ Step 2: Database Configuration

### Option A: Local PostgreSQL

```bash
# Create database
createdb loyal_supplychain

# Test connection
psql loyal_supplychain -c "SELECT version();"

# Set environment variable
export DATABASE_URL="postgresql://$(whoami)@localhost:5432/loyal_supplychain"

# Or create .env file
echo "DATABASE_URL=postgresql://$(whoami)@localhost:5432/loyal_supplychain" > .env
```

### Option B: AWS RDS / Remote Database

```bash
# Create .env file with your RDS connection
cat > .env << 'EOF'
DATABASE_URL=postgresql://username:password@your-rds.region.rds.amazonaws.com:5432/loyal_supplychain
EOF
```

### Verify connection
```bash
# Load .env if using file
export $(cat .env | xargs)

# Test connection
psql $DATABASE_URL -c "SELECT current_database(), current_user;"
```

---

## 📊 Step 3: Run Migrations

```bash
cd /Users/rafik/loyal-supplychain/app
npm run db:up
```

**Expected output:**
```
Starting migrations...

Found 8 pending migration(s):

Applying migration: 001_master.sql
✓ Applied: 001_master.sql
Applying migration: 002_logistics.sql
✓ Applied: 002_logistics.sql
Applying migration: 003_finance.sql
✓ Applied: 003_finance.sql
Applying migration: 004_archive.sql
✓ Applied: 004_archive.sql
Applying migration: 005_comm.sql
✓ Applied: 005_comm.sql
Applying migration: 006_security.sql
✓ Applied: 006_security.sql
Applying migration: 007_views_triggers.sql
✓ Applied: 007_views_triggers.sql
Applying migration: 008_import_log.sql
✓ Applied: 008_import_log.sql

✅ All migrations applied successfully!
```

### Verify schema
```bash
psql $DATABASE_URL -c "\dt master_data.*"
psql $DATABASE_URL -c "\dt logistics.*"
psql $DATABASE_URL -c "\dt finance.*"
psql $DATABASE_URL -c "\dt security.*"
```

---

## 🧪 Step 4: Test with Sample Data

### Create test Excel files (or use your actual files)

The ETL scripts support:
- `البضاعة القادمة محدث.xlsx` - Arrivals board
- `LOYAL- SUPPLIER INDEX modified.xlsx` - Suppliers
- `WorldFood 2025 Suppliers.xlsx` - Additional suppliers
- `حوالات2025.xlsx` - Bank transfers

---

## 🔄 Step 5: Full ETL Workflow Test

```bash
cd /Users/rafik/loyal-supplychain

# 1. Load suppliers (if you have the files)
npm run etl:suppliers -- --files "path/to/suppliers1.xlsx,path/to/suppliers2.xlsx"

# 2. Load shipments/arrivals (if you have the file)
npm run etl:excel -- --file "path/to/البضاعة القادمة محدث.xlsx"

# 3. Validate transfers first (DRY RUN)
npm run etl:transfers -- --file "path/to/حوالات2025.xlsx" --dry-run

# 4. If validation passes, import transfers
npm run etl:transfers -- --file "path/to/حوالات2025.xlsx"

# 5. Run QA checks
npm run etl:qa
```

---

## 📝 Step 6: Manual Data Testing (Without Excel Files)

If you don't have Excel files yet, you can test with SQL:

```bash
# Insert test data
psql $DATABASE_URL << 'EOF'

-- Insert test ports
INSERT INTO master_data.ports (name, country) VALUES 
  ('Jeddah Port', 'Saudi Arabia'),
  ('Shanghai Port', 'China'),
  ('Rotterdam', 'Netherlands')
ON CONFLICT DO NOTHING;

-- Insert test shipping line
INSERT INTO master_data.companies (name, country, is_shipping_line) VALUES 
  ('Maersk Line', 'Denmark', true),
  ('MSC', 'Switzerland', true)
ON CONFLICT DO NOTHING;

-- Insert test supplier
INSERT INTO master_data.companies (name, country, is_supplier) VALUES 
  ('ABC Trading Co', 'Turkey', true),
  ('Global Foods Ltd', 'Egypt', true)
ON CONFLICT DO NOTHING;

-- Insert test shipment
INSERT INTO logistics.shipments (
  sn, direction, product_text, container_count, weight_ton, 
  fixed_price_usd_per_ton, status, created_by
) VALUES (
  'SN-TEST-001', 'incoming', 'Rice', 2, 40, 500, 'sailed', 'test'
);

-- Insert test transfer
INSERT INTO finance.transfers (
  direction, amount, currency, transfer_date,
  sender, receiver, shipment_id
)
SELECT 
  'received', 10000, 'USD', CURRENT_DATE,
  'ABC Trading Co', 'Our Company', s.id
FROM logistics.shipments s WHERE s.sn = 'SN-TEST-001';

-- Check results
SELECT 
  s.sn,
  s.product_text,
  s.total_value_usd,
  s.paid_value_usd,
  s.balance_value_usd
FROM logistics.shipments s
WHERE s.sn = 'SN-TEST-001';

EOF
```

**Expected output:**
```
     sn      | product_text | total_value_usd | paid_value_usd | balance_value_usd 
-------------+--------------+-----------------+----------------+-------------------
 SN-TEST-001 | Rice         |        20000.00 |       10000.00 |         10000.00
```

---

## ✅ Step 7: Run QA Checks

```bash
cd /Users/rafik/loyal-supplychain
npm run etl:qa
```

**Expected output:**
```
============================================================
📋 QA CHECKS SUMMARY
============================================================

✓ [1] Missing SN ...........................   0
✓ [2] Incomplete price/weight ..............   0
✓ [3] Late ETA not arrived .................   0
✓ [4] Transfers w/o shipment ...............   0
✓ [5] Suspicious ports .....................   0
✓ [6] Suspicious shipping lines.............   0
✓ [7] Orphaned milestones...................   0
✓ [8] Duplicate SNs.........................   0

============================================================
✅ All checks passed - no issues found!
============================================================
```

---

## 🔍 Step 8: Verify Import Log

```bash
psql $DATABASE_URL << 'EOF'
SELECT 
  id,
  file_name,
  row_count,
  ok_count,
  err_count,
  started_at,
  finished_at,
  EXTRACT(EPOCH FROM (finished_at - started_at))::numeric(10,2) as duration_sec
FROM security.import_log
ORDER BY started_at DESC
LIMIT 10;
EOF
```

---

## 🎯 Quick Test Script

Save this as `test-workflow.sh` and run it:

```bash
#!/bin/bash
set -e

echo "🚀 Loyal Supply Chain - Complete Workflow Test"
echo "================================================"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  echo "   Please export DATABASE_URL or create .env file"
  exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Run migrations
echo "📊 Step 1: Running migrations..."
cd /Users/rafik/loyal-supplychain/app
npm run db:up
echo ""

# Insert test data
echo "📝 Step 2: Inserting test data..."
cd ..
psql $DATABASE_URL << 'EOF'
-- Insert test data (shown above)
INSERT INTO master_data.ports (name, country) VALUES 
  ('Test Port A', 'Country A'),
  ('Test Port B', 'Country B')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.shipments (
  sn, direction, product_text, weight_ton, 
  fixed_price_usd_per_ton, status, created_by
) VALUES (
  'TEST-SN-001', 'incoming', 'Test Product', 50, 400, 'planning', 'test-script'
) ON CONFLICT DO NOTHING;

SELECT 'Test data inserted' as status;
EOF
echo ""

# Run QA checks
echo "🔍 Step 3: Running QA checks..."
npm run etl:qa
echo ""

# Check import log
echo "📋 Step 4: Checking migration log..."
psql $DATABASE_URL -c "SELECT COUNT(*) as migration_count FROM security.migrations;"
echo ""

echo "✅ Workflow test complete!"
echo ""
echo "Next steps:"
echo "  1. Add your Excel files to a data/ directory"
echo "  2. Run: npm run etl:suppliers -- --files 'data/suppliers.xlsx'"
echo "  3. Run: npm run etl:excel -- --file 'data/arrivals.xlsx'"
echo "  4. Run: npm run etl:transfers -- --file 'data/transfers.xlsx'"
```

---

## 📚 Available NPM Scripts

```bash
# Database
npm run db:up          # Run migrations

# ETL Scripts
npm run etl:excel      # Import arrivals board
npm run etl:suppliers  # Import suppliers
npm run etl:transfers  # Import bank transfers
npm run etl:qa         # Run data quality checks

# Examples with files
npm run etl:excel -- --file "data/arrivals.xlsx"
npm run etl:suppliers -- --files "data/s1.xlsx,data/s2.xlsx"
npm run etl:transfers -- --file "data/transfers.xlsx" --dry-run
```

---

## 🐛 Troubleshooting

### Database connection fails
```bash
# Check if PostgreSQL is running
pg_isready

# Check connection string
echo $DATABASE_URL

# Test with psql
psql $DATABASE_URL -c "SELECT 1;"
```

### ts-node not found
```bash
# Install dependencies
cd /Users/rafik/loyal-supplychain/app && npm install
cd .. && npm install
```

### Permission errors
```bash
# Check database permissions
psql $DATABASE_URL -c "SELECT current_user, current_database();"

# Ensure user has CREATE permissions
psql $DATABASE_URL -c "CREATE SCHEMA IF NOT EXISTS test_schema; DROP SCHEMA test_schema;"
```

---

## ✅ Success Checklist

- [ ] Node.js and PostgreSQL installed
- [ ] Database created
- [ ] DATABASE_URL configured
- [ ] Dependencies installed (app & root)
- [ ] Migrations run successfully (8 migrations)
- [ ] Test data inserted
- [ ] QA checks pass
- [ ] Ready to import Excel files

---

## 🎉 System Ready!

Your Loyal Supply Chain ETL system is now fully configured and ready to process:
- Arabic Excel files
- Multi-source supplier data
- Bank transfer records
- Automated data quality checks

For production use, see `DELIVERABLES_SUMMARY.md` for detailed documentation.

