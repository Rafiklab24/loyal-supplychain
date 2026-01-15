# 🗄️ Database Setup Guide

You need a PostgreSQL database to run the Loyal Supply Chain system. Choose one of the options below.

---

## Option 1: Local PostgreSQL (Mac) ⭐ Recommended for Development

### Install PostgreSQL using Homebrew

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Create your user's database
createdb $(whoami)

# Create the project database
createdb loyal_supplychain

# Test connection
psql loyal_supplychain -c "SELECT version();"
```

### Configure DATABASE_URL

```bash
# Create .env file
cd /Users/rafik/loyal-supplychain
echo "DATABASE_URL=postgresql://$(whoami)@localhost:5432/loyal_supplychain" > .env

# Verify
cat .env
```

### Run the test
```bash
./scripts/test-workflow.sh
```

---

## Option 2: PostgreSQL.app (Mac) 🖥️ Easiest for Mac

### Install

1. Download from: https://postgresapp.com/
2. Move to Applications folder
3. Open Postgres.app
4. Click "Initialize" to create a new server
5. Server will start automatically on port 5432

### Configure PATH

```bash
# Add to your ~/.zshrc or ~/.bash_profile
echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Create database

```bash
# Connect to default postgres database
psql postgres

# Inside psql:
CREATE DATABASE loyal_supplychain;
\q
```

### Configure DATABASE_URL

```bash
cd /Users/rafik/loyal-supplychain
echo "DATABASE_URL=postgresql://$(whoami)@localhost:5432/loyal_supplychain" > .env
```

### Run the test
```bash
./scripts/test-workflow.sh
```

---

## Option 3: Docker PostgreSQL 🐳 Portable

### Install Docker Desktop

Download from: https://www.docker.com/products/docker-desktop/

### Run PostgreSQL container

```bash
# Start PostgreSQL in Docker
docker run --name loyal-postgres \
  -e POSTGRES_PASSWORD=loyal2025 \
  -e POSTGRES_DB=loyal_supplychain \
  -p 5432:5432 \
  -d postgres:16

# Wait a few seconds for startup
sleep 5

# Test connection
docker exec loyal-postgres psql -U postgres -d loyal_supplychain -c "SELECT version();"
```

### Configure DATABASE_URL

```bash
cd /Users/rafik/loyal-supplychain
echo "DATABASE_URL=postgresql://postgres:loyal2025@localhost:5432/loyal_supplychain" > .env
```

### Run the test
```bash
./scripts/test-workflow.sh
```

### Docker commands for later

```bash
# Stop PostgreSQL
docker stop loyal-postgres

# Start PostgreSQL
docker start loyal-postgres

# Remove container (data will be lost!)
docker rm -f loyal-postgres
```

---

## Option 4: AWS RDS ☁️ Production

### Create RDS Instance

1. Go to AWS Console → RDS
2. Create database
3. Choose PostgreSQL 16
4. Configure:
   - DB instance identifier: loyal-supplychain-db
   - Master username: postgres
   - Master password: (choose a strong password)
   - Instance size: db.t3.micro (free tier eligible)
   - Storage: 20 GB
   - Public access: Yes (or use VPN)
   - Security group: Allow port 5432 from your IP

### Get connection details

After creation, note:
- Endpoint: `your-db.abc123.us-east-1.rds.amazonaws.com`
- Port: `5432`
- Username: `postgres`
- Password: (what you set)

### Configure DATABASE_URL

```bash
cd /Users/rafik/loyal-supplychain
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@your-db.abc123.us-east-1.rds.amazonaws.com:5432/postgres
EOF

# Important: Replace YOUR_PASSWORD and endpoint with your actual values
```

### Run the test
```bash
./scripts/test-workflow.sh
```

---

## Option 5: Supabase 🚀 Free Cloud PostgreSQL

### Create Supabase Project

1. Go to https://supabase.com
2. Sign up for free account
3. Create new project
4. Note your database password
5. Go to Settings → Database → Connection String

### Configure DATABASE_URL

```bash
cd /Users/rafik/loyal-supplychain
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
EOF

# Replace with your actual Supabase connection string
```

### Run the test
```bash
./scripts/test-workflow.sh
```

---

## Quick Start After Database Setup

Once your database is ready:

```bash
cd /Users/rafik/loyal-supplychain

# 1. Run the automated test workflow
./scripts/test-workflow.sh

# 2. Or run steps manually:

# Install dependencies (already done ✅)
# npm install

# Run migrations
cd app && npm run db:up && cd ..

# Run QA checks
npm run etl:qa

# Import your Excel files when ready
npm run etl:suppliers -- --files "data/suppliers.xlsx"
npm run etl:excel -- --file "data/arrivals.xlsx"
npm run etl:transfers -- --file "data/transfers.xlsx" --dry-run
```

---

## Verify Your Setup

After choosing an option, verify everything works:

```bash
# 1. Test DATABASE_URL is set
cd /Users/rafik/loyal-supplychain
export $(cat .env | xargs)
echo $DATABASE_URL

# 2. Test database connection
psql $DATABASE_URL -c "SELECT current_database(), current_user;"

# 3. Run the complete test
./scripts/test-workflow.sh
```

---

## What the Test Workflow Does

The `test-workflow.sh` script will:

1. ✅ Verify database connection
2. ✅ Run all 8 migrations (creates schemas and tables)
3. ✅ Insert test data (ports, companies, shipments, transfers)
4. ✅ Verify calculated balances work correctly
5. ✅ Run 8 data quality checks
6. ✅ Show system summary

Expected duration: **10-30 seconds**

---

## Troubleshooting

### "connection refused"
- PostgreSQL is not running
- Wrong host/port in DATABASE_URL
- Check firewall settings

### "authentication failed"
- Wrong username/password in DATABASE_URL
- User doesn't exist

### "database does not exist"
- Create the database: `createdb loyal_supplychain`
- Or use `postgres` database (default)

### "permission denied"
- User needs CREATE privileges
- Try: `psql` then `ALTER USER youruser CREATEDB;`

---

## My Recommendation 🎯

**For local development:** Use **Option 1 (Homebrew)** or **Option 2 (Postgres.app)**
- Fast, local, full control
- No internet required
- Free

**For team/cloud:** Use **Option 4 (AWS RDS)** or **Option 5 (Supabase)**
- Shareable across team
- Automatic backups
- Professional setup

---

## Need Help?

See the complete setup guide: `SETUP_AND_TEST.md`

Questions? Issues? Common problems and solutions are documented there.

