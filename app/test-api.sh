#!/bin/bash

# Loyal Supply Chain API Test Script
# Tests all main endpoints

BASE_URL="http://localhost:3000/api"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          Loyal Supply Chain - API Test Suite             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

test_endpoint() {
  local name=$1
  local endpoint=$2
  
  echo -n "Testing $name... "
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
  
  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
  fi
}

# Test endpoints
test_endpoint "Health Check" "/health"
test_endpoint "Stats" "/health/stats"
test_endpoint "Shipments List" "/shipments?limit=5"
test_endpoint "Single Shipment" "/shipments/$(curl -s $BASE_URL/shipments?limit=1 | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"][0]["id"])')"
test_endpoint "Companies List" "/companies?limit=5"
test_endpoint "Suppliers" "/companies/type/suppliers?limit=5"
test_endpoint "Shipping Lines" "/companies/type/shipping-lines?limit=5"
test_endpoint "Ports List" "/ports?limit=5"
test_endpoint "Transfers List" "/transfers?limit=5"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    Test Results                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Sample data tests
echo "📊 Sample Data:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "1. Health & Stats:"
curl -s "$BASE_URL/health/stats" | python3 -m json.tool | head -15

echo ""
echo "2. Latest Shipments:"
curl -s "$BASE_URL/shipments?limit=3" | python3 -m json.tool | grep -E '"sn"|"product_text"|"total_value_usd"' | head -9

echo ""
echo "3. Top Suppliers:"
curl -s "$BASE_URL/companies/type/suppliers?limit=3" | python3 -m json.tool | grep -E '"name"|"country"' | head -6

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test suite complete!"
echo ""

