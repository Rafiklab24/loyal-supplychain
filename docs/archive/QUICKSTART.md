# ⚡ Quick Start - Get Running in 5 Minutes

---

## ✅ Status Check

- ✅ **Dependencies installed** (npm packages for app and ETL)
- ⚠️  **Database needed** (PostgreSQL not detected)

---

## 🚀 Next Steps

### 1. Set up a PostgreSQL database

**Choose the fastest option for you:**

#### Option A: Homebrew (3 minutes)
```bash
brew install postgresql@16
brew services start postgresql@16
createdb loyal_supplychain
echo "DATABASE_URL=postgresql://$(whoami)@localhost:5432/loyal_supplychain" > .env
```

#### Option B: Docker (2 minutes)
```bash
docker run --name loyal-postgres -e POSTGRES_PASSWORD=loyal2025 \
  -e POSTGRES_DB=loyal_supplychain -p 5432:5432 -d postgres:16
echo "DATABASE_URL=postgresql://postgres:loyal2025@localhost:5432/loyal_supplychain" > .env
```

#### Option C: Cloud (5 minutes)
- **Supabase**: https://supabase.com (free tier, instant)
- **AWS RDS**: Professional setup (see DATABASE_SETUP.md)

**📖 Detailed instructions:** See `DATABASE_SETUP.md`

---

### 2. Run the automated test

```bash
cd /Users/rafik/loyal-supplychain
./test-workflow.sh
```

**This will:**
- ✅ Verify database connection
- ✅ Run all migrations (8 files)
- ✅ Create test data
- ✅ Verify everything works
- ✅ Run QA checks

**Expected output:**
```
🚀 Loyal Supply Chain - Complete Workflow Test
================================================

✓ DATABASE_URL is set
✓ Database connection successful

📊 Step 1: Running migrations...
✓ Applied: 001_master.sql
✓ Applied: 002_logistics.sql
... (6 more)
✅ All migrations applied successfully!

📝 Step 2: Inserting test data...
✓ Test data inserted

📊 Step 3: Verifying test data...
     sn      | total_value_usd | paid_value_usd | balance_value_usd
-------------+-----------------+----------------+------------------
 SN-TEST-001 |        20000.00 |       10000.00 |        10000.00
 SN-TEST-002 |        27000.00 |       15000.00 |        12000.00

🔍 Step 4: Running QA checks...
✅ All checks passed - no issues found!

✅ Workflow test complete!
```

---

### 3. Import your data

```bash
# Place Excel files in a data/ directory
mkdir -p data

# Import suppliers
npm run etl:suppliers -- --files "data/suppliers.xlsx"

# Import arrivals board
npm run etl:excel -- --file "data/البضاعة القادمة محدث.xlsx"

# Import transfers (validate first)
npm run etl:transfers -- --file "data/حوالات.xlsx" --dry-run

# If validation passes, import for real
npm run etl:transfers -- --file "data/حوالات.xlsx"
```

---

## 📚 Available Commands

```bash
# Database
npm run db:up              # Run migrations

# ETL Scripts
npm run etl:suppliers      # Import suppliers
npm run etl:excel          # Import arrivals board
npm run etl:transfers      # Import bank transfers
npm run etl:qa             # Run quality checks

# With files
npm run etl:excel -- --file "path/to/file.xlsx"
npm run etl:transfers -- --file "path/to/file.xlsx" --dry-run
```

---

## 🎯 System Overview

**What you have:**

1. **7 Migration Files** - Create database schema
   - 001: Master data (companies, ports, products)
   - 002: Logistics (shipments, milestones)
   - 003: Finance (transfers)
   - 004: Archive (documents)
   - 005: Communication (WhatsApp logs)
   - 006: Security (users, audits, migrations)
   - 007: Views & triggers (auto-calculations)
   - 008: Import log (ETL tracking)

2. **3 ETL Loaders** - Import Excel data
   - excel-loader.ts: Arrivals board (البضاعة القادمة)
   - suppliers-loader.ts: Supplier lists
   - transfers-loader.ts: Bank transfers (حوالات)

3. **QA Checks** - Data quality validation
   - 8 automated checks for data issues

4. **Import Logging** - Track all ETL runs
   - File hashes, row counts, timestamps

---

## 📖 Documentation

- **`DATABASE_SETUP.md`** - 5 ways to set up PostgreSQL
- **`SETUP_AND_TEST.md`** - Complete setup guide
- **`DELIVERABLES_SUMMARY.md`** - System overview
- **`etl/README.md`** - ETL script documentation
- **`README.md`** - Project overview

---

## ❓ Need Help?

**Common issues:**

1. **"DATABASE_URL not set"**
   → Create `.env` file with connection string

2. **"Cannot connect to database"**
   → Check PostgreSQL is running
   → Verify connection string in `.env`

3. **"File not found"**
   → Use full path to Excel files
   → Or place files in `data/` directory

4. **"ts-node command not found"**
   → Run `npm install` in app/ and root

---

## 🎉 You're Ready!

Once the test passes, your system can:

- ✅ Import Arabic Excel files natively
- ✅ Track shipments from planning to delivery
- ✅ Monitor payment status automatically
- ✅ Link transfers to shipments
- ✅ Audit all data changes
- ✅ Run quality checks
- ✅ Build financial reports

**Next:** Import your actual Excel files and start managing your supply chain! 🚀

