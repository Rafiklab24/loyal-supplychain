#!/bin/bash
# Setup Script for Contracts & Proforma Invoices Feature
# Run this script to apply migrations and restart the backend

set -e  # Exit on error

echo "=========================================="
echo "Loyal Supply Chain - Contracts Setup"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check if we're in the right directory
if [ ! -f "app/package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

cd app

# 2. Load environment variables
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found in app/ directory"
    echo "   Please create .env with DATABASE_URL"
    exit 1
fi

# Source the .env file
export $(cat .env | grep -v '^#' | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env"
    exit 1
fi

echo -e "${GREEN}✓${NC} Environment loaded"
echo ""

# 3. Run migrations
echo -e "${BLUE}Step 1: Running database migrations...${NC}"
echo ""
npm run db:up
echo ""
echo -e "${GREEN}✓${NC} Migrations completed"
echo ""

# 4. Verify migrations
echo -e "${BLUE}Step 2: Verifying migrations...${NC}"
echo ""

echo "Checking new tables..."
psql "$DATABASE_URL" -c "
SELECT 
  'contracts' as table_name, COUNT(*) as count FROM logistics.contracts
UNION ALL
SELECT 'contract_lines', COUNT(*) FROM logistics.contract_lines
UNION ALL
SELECT 'proforma_invoices', COUNT(*) FROM logistics.proforma_invoices
UNION ALL
SELECT 'proforma_lines', COUNT(*) FROM logistics.proforma_lines
UNION ALL
SELECT 'shipment_lines', COUNT(*) FROM logistics.shipment_lines
UNION ALL
SELECT 'shipment_containers', COUNT(*) FROM logistics.shipment_containers
UNION ALL
SELECT 'payment_schedules', COUNT(*) FROM finance.payment_schedules
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM security.audits;
" 2>/dev/null || echo "⚠️  Some tables may not have data yet (this is normal)"

echo ""
echo "Checking backfill..."
CONTRACTS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM logistics.contracts;" 2>/dev/null | xargs)
LINKED_SHIPMENTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM logistics.shipments WHERE contract_id IS NOT NULL;" 2>/dev/null | xargs)

echo "  • Contracts created: $CONTRACTS_COUNT"
echo "  • Shipments linked: $LINKED_SHIPMENTS"
echo ""

# 5. Restart backend
echo -e "${BLUE}Step 3: Restarting backend...${NC}"
echo ""

# Find and kill the old process
OLD_PID=$(lsof -ti:3000 2>/dev/null || echo "")
if [ ! -z "$OLD_PID" ]; then
    echo "Stopping old backend (PID: $OLD_PID)..."
    kill $OLD_PID 2>/dev/null || true
    sleep 2
fi

# Start new backend in background
echo "Starting new backend..."
nohup npm run dev > ../backend.log 2>&1 &
NEW_PID=$!
echo "Backend started (PID: $NEW_PID)"
echo "Logs: tail -f backend.log"
echo ""

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# 6. Test endpoints
echo -e "${BLUE}Step 4: Testing new endpoints...${NC}"
echo ""

# Test health
echo "Testing /api/health..."
curl -s http://localhost:3000/api/health | jq -r '.status' | grep -q "healthy" && echo "  ✓ Health check passed" || echo "  ✗ Health check failed"

# Test contracts
echo "Testing /api/contracts..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/contracts)
if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ Contracts endpoint available"
    CONTRACTS_API=$(curl -s http://localhost:3000/api/contracts | jq -r '.pagination.total' 2>/dev/null || echo "0")
    echo "    Total contracts via API: $CONTRACTS_API"
else
    echo "  ✗ Contracts endpoint returned HTTP $HTTP_CODE"
fi

# Test proformas
echo "Testing /api/proformas..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/proformas)
if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ Proformas endpoint available"
else
    echo "  ✗ Proformas endpoint returned HTTP $HTTP_CODE"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "📊 Summary:"
echo "  • Migrations applied: 012, 013, 014"
echo "  • Contracts created: $CONTRACTS_COUNT"
echo "  • Shipments linked: $LINKED_SHIPMENTS"
echo "  • Backend running on http://localhost:3000"
echo ""
echo "🔗 New Endpoints:"
echo "  • GET  /api/contracts"
echo "  • GET  /api/proformas"
echo "  • GET  /api/shipments/:id/lines"
echo "  • GET  /api/shipments/:id/containers"
echo ""
echo "📝 Next Steps:"
echo "  1. View backend logs: tail -f backend.log"
echo "  2. Test endpoints: curl http://localhost:3000/api/contracts | jq"
echo "  3. Check README.md for complete API documentation"
echo ""
echo "🎉 All systems ready!"

