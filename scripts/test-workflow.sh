#!/bin/bash
set -e

# Add PostgreSQL to PATH (Homebrew installation)
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH" 2>/dev/null || export PATH="/usr/local/opt/postgresql@16/bin:$PATH" 2>/dev/null || true

echo "🚀 Loyal Supply Chain - Complete Workflow Test"
echo "================================================"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  if [ -f .env ]; then
    echo "📄 Loading .env file..."
    export $(cat .env | grep -v '^#' | xargs)
  else
    echo "❌ ERROR: DATABASE_URL not set"
    echo ""
    echo "Please either:"
    echo "  1. Export DATABASE_URL: export DATABASE_URL='postgresql://...'"
    echo "  2. Create .env file with: DATABASE_URL=postgresql://..."
    echo ""
    exit 1
  fi
fi

echo "✓ DATABASE_URL is set"
echo "  Database: $(echo $DATABASE_URL | sed 's/postgresql:\/\/.*@/postgresql:\/\/***@/')"
echo ""

# Test connection
echo "🔌 Testing database connection..."
psql $DATABASE_URL -c "SELECT current_database(), current_user, version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Database connection successful"
else
  echo "❌ Cannot connect to database"
  exit 1
fi
echo ""

# Run migrations
echo "📊 Step 1: Running migrations..."
echo "────────────────────────────────────────────────────────────"
cd /Users/rafik/loyal-supplychain/app
npm run db:up
echo ""

# Check schemas
echo "🔍 Step 2: Verifying database schema..."
echo "────────────────────────────────────────────────────────────"
cd ..
psql $DATABASE_URL << 'EOF'
SELECT 
  'Schemas created' as status,
  COUNT(*) as schema_count
FROM information_schema.schemata 
WHERE schema_name IN ('master_data', 'logistics', 'finance', 'archive', 'comm', 'security');

SELECT 
  'Migrations applied' as status,
  COUNT(*) as migration_count
FROM security.migrations;
EOF
echo ""

# Insert test data
echo "📝 Step 3: Inserting test data..."
echo "────────────────────────────────────────────────────────────"
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

-- Insert test shipments
INSERT INTO logistics.shipments (
  sn, direction, product_text, container_count, weight_ton, 
  fixed_price_usd_per_ton, status, created_by
) VALUES 
  ('SN-TEST-001', 'incoming', 'Rice', 2, 40, 500, 'sailed', 'test-script'),
  ('SN-TEST-002', 'incoming', 'Wheat', 3, 60, 450, 'arrived', 'test-script'),
  ('SN-TEST-003', 'incoming', 'Corn', 1, 25, 400, 'planning', 'test-script')
ON CONFLICT DO NOTHING;

-- Insert test transfers
INSERT INTO finance.transfers (
  direction, amount, currency, transfer_date,
  sender, receiver, shipment_id
)
SELECT 
  'received', 10000, 'USD', CURRENT_DATE - INTERVAL '5 days',
  'ABC Trading Co', 'Our Company', s.id
FROM logistics.shipments s WHERE s.sn = 'SN-TEST-001'
ON CONFLICT DO NOTHING;

INSERT INTO finance.transfers (
  direction, amount, currency, transfer_date,
  sender, receiver, shipment_id
)
SELECT 
  'received', 15000, 'USD', CURRENT_DATE - INTERVAL '3 days',
  'Global Foods Ltd', 'Our Company', s.id
FROM logistics.shipments s WHERE s.sn = 'SN-TEST-002'
ON CONFLICT DO NOTHING;

SELECT '✓ Test data inserted' as status;
EOF
echo ""

# Verify test data
echo "📊 Step 4: Verifying test data with balances..."
echo "────────────────────────────────────────────────────────────"
psql $DATABASE_URL << 'EOF'
SELECT 
  s.sn,
  s.product_text,
  s.weight_ton,
  s.fixed_price_usd_per_ton,
  s.total_value_usd,
  s.paid_value_usd,
  s.balance_value_usd,
  s.status
FROM logistics.shipments s
WHERE s.sn LIKE 'SN-TEST-%'
ORDER BY s.sn;
EOF
echo ""

# Run QA checks
echo "🔍 Step 5: Running QA checks..."
echo "────────────────────────────────────────────────────────────"
npm run etl:qa
echo ""

# Show summary
echo "📋 Step 6: System Summary"
echo "────────────────────────────────────────────────────────────"
psql $DATABASE_URL << 'EOF'
SELECT 'Companies' as table_name, COUNT(*) as count FROM master_data.companies
UNION ALL
SELECT 'Ports', COUNT(*) FROM master_data.ports
UNION ALL
SELECT 'Shipments', COUNT(*) FROM logistics.shipments
UNION ALL
SELECT 'Transfers', COUNT(*) FROM finance.transfers
UNION ALL
SELECT 'Import Logs', COUNT(*) FROM security.import_log
ORDER BY table_name;
EOF
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ Workflow test complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📚 Next steps:"
echo "  1. Place your Excel files in a data/ directory"
echo "  2. Import suppliers:"
echo "     npm run etl:suppliers -- --files 'data/suppliers.xlsx'"
echo "  3. Import arrivals board:"
echo "     npm run etl:excel -- --file 'data/البضاعة القادمة محدث.xlsx'"
echo "  4. Import transfers (dry-run first):"
echo "     npm run etl:transfers -- --file 'data/حوالات.xlsx' --dry-run"
echo "  5. Import transfers (real):"
echo "     npm run etl:transfers -- --file 'data/حوالات.xlsx'"
echo "  6. Run QA checks:"
echo "     npm run etl:qa"
echo ""
echo "📖 See SETUP_AND_TEST.md for detailed documentation"
echo ""

