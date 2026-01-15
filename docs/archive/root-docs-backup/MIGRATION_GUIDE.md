# Contracts & Proforma Invoices - Migration Guide

## 🚀 Quick Setup (Automated)

```bash
# Run the automated setup script
./scripts/SETUP_CONTRACTS.sh
```

This script will:
1. ✅ Run all 3 new migrations (012, 013, 014)
2. ✅ Verify migration success
3. ✅ Restart the backend with new routes
4. ✅ Test all new endpoints

---

## 📝 Manual Setup (Step by Step)

If you prefer to run each step manually:

### Step 1: Apply Migrations

```bash
cd app

# Load environment variables and run migrations
source .env
npm run db:up
```

**Expected Output:**
```
Migration 012: Contracts & Shipments Refactor - SUCCESS
  ✓ logistics.contracts (0 rows)
  ✓ logistics.contract_lines
  ✓ logistics.proforma_invoices (0 rows)
  ...

Migration 013: Backfill Complete
  • Contracts created: ~150
  • Shipments linked: ~165
  • Shipment lines created: ~165
  • Documents linked: ~50

Migration 014: Audit Triggers - SUCCESS
  ✓ Enhanced audit function created
  ✓ Audit triggers attached: 8
```

### Step 2: Verify Migration Success

```bash
# Check new tables
psql $DATABASE_URL -c "
  SELECT COUNT(*) as contracts FROM logistics.contracts;
"

psql $DATABASE_URL -c "
  SELECT COUNT(*) as linked_shipments 
  FROM logistics.shipments 
  WHERE contract_id IS NOT NULL;
"

# Check audit system
psql $DATABASE_URL -c "
  SELECT * FROM security.v_audit_summary;
"
```

### Step 3: Restart Backend

```bash
# Stop current backend
lsof -ti:3000 | xargs kill

# Start fresh with new routes
cd app
npm run dev &

# Wait for startup
sleep 5
```

### Step 4: Test New Endpoints

```bash
# Test health
curl http://localhost:3000/api/health

# Test contracts (should return 200)
curl http://localhost:3000/api/contracts | jq '.'

# Test proformas
curl http://localhost:3000/api/proformas | jq '.'

# Test shipment lines (pick a shipment ID)
SHIPMENT_ID=$(curl -s http://localhost:3000/api/shipments?limit=1 | jq -r '.data[0].id')
curl http://localhost:3000/api/shipments/$SHIPMENT_ID/lines | jq '.'
```

---

## 🧪 Testing the Complete Workflow

### Create a Contract

```bash
# 1. Get a buyer and seller company ID
BUYER_ID=$(curl -s "http://localhost:3000/api/companies?limit=1" | jq -r '.data[0].id')
SELLER_ID=$(curl -s "http://localhost:3000/api/companies?limit=1&page=2" | jq -r '.data[0].id')

# 2. Get a product ID
PRODUCT_ID=$(curl -s "http://localhost:3000/api/companies?limit=1" | jq -r '.data[0].id')

# 3. Create contract
curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d "{
    \"contract_no\": \"TEST-$(date +%s)\",
    \"buyer_company_id\": \"$BUYER_ID\",
    \"seller_company_id\": \"$SELLER_ID\",
    \"currency_code\": \"USD\",
    \"status\": \"ACTIVE\",
    \"notes\": \"Test contract created via API\"
  }" | jq '.'
```

### Create a Proforma

```bash
# 1. Get a contract ID
CONTRACT_ID=$(curl -s "http://localhost:3000/api/contracts?limit=1" | jq -r '.data[0].id')

# 2. Create proforma
curl -X POST http://localhost:3000/api/proformas \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"PI-TEST-$(date +%s)\",
    \"contract_id\": \"$CONTRACT_ID\",
    \"issued_at\": \"$(date +%Y-%m-%d)\",
    \"status\": \"DRAFT\",
    \"notes\": \"Test proforma\"
  }" | jq '.'
```

### Add Shipment Lines

```bash
# 1. Get a shipment ID
SHIPMENT_ID=$(curl -s "http://localhost:3000/api/shipments?limit=1" | jq -r '.data[0].id')

# 2. Get a product ID (you'll need a real one from your database)
# For now, this will fail validation - you need to query products first

# 3. Add lines
curl -X POST http://localhost:3000/api/shipments/$SHIPMENT_ID/lines \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [{
      "product_id": "YOUR-PRODUCT-UUID-HERE",
      "qty": 500,
      "unit_price": 450,
      "currency_code": "USD",
      "bags_count": 2000
    }]
  }' | jq '.'
```

---

## 🔍 Troubleshooting

### Issue: "Cannot GET /api/contracts"

**Solution**: Backend needs restart
```bash
cd app
lsof -ti:3000 | xargs kill
npm run dev
```

### Issue: "DATABASE_URL environment variable is required"

**Solution**: Load environment variables
```bash
cd app
source .env
npm run db:up
```

### Issue: "Shipment lines created: 0"

**Explanation**: This is normal if:
- No products exist in `master_data.products`
- `product_text` doesn't match any product names
- Shipment lines already exist

**Not a problem** - you can add lines manually via API.

### Issue: "Some shipments not linked to contracts"

**Solution**: Check for missing supplier/customer data
```sql
SELECT id, sn, supplier_id, customer_id 
FROM logistics.shipments 
WHERE sn IS NOT NULL 
  AND contract_id IS NULL;
```

Fix by updating company references, then re-run migration 013.

---

## 📊 Verification Queries

```sql
-- Check migration success
SELECT 
  'Total Contracts' as metric, 
  COUNT(*)::text as value 
FROM logistics.contracts

UNION ALL

SELECT 
  'Shipments Linked', 
  COUNT(*)::text 
FROM logistics.shipments 
WHERE contract_id IS NOT NULL

UNION ALL

SELECT 
  'Audit Logs', 
  COUNT(*)::text 
FROM security.audits

UNION ALL

SELECT 
  'Payment Schedules', 
  COUNT(*)::text 
FROM finance.payment_schedules;
```

```sql
-- View recent audit activity
SELECT * FROM security.v_recent_audits LIMIT 10;
```

```sql
-- Check backfill quality
SELECT 
  c.contract_no,
  COUNT(s.id) as shipment_count,
  MIN(s.created_at) as first_shipment,
  MAX(s.created_at) as last_shipment
FROM logistics.contracts c
LEFT JOIN logistics.shipments s ON s.contract_id = c.id
GROUP BY c.contract_no
ORDER BY shipment_count DESC
LIMIT 10;
```

---

## ✅ Success Criteria

After setup, you should have:

- ✅ **Migrations Applied**: Runs 012, 013, 014 show "SUCCESS"
- ✅ **Contracts Created**: `SELECT COUNT(*) FROM logistics.contracts;` > 0
- ✅ **Shipments Linked**: Most shipments have `contract_id` populated
- ✅ **API Responding**: `curl http://localhost:3000/api/contracts` returns JSON
- ✅ **Audit Active**: `SELECT COUNT(*) FROM security.audits;` > 0
- ✅ **Backend Logs Clean**: No errors in `backend.log`

---

## 🎯 Next Steps

1. **Frontend Integration**: Update Vibe to use new contracts API
2. **Data Cleanup**: Review any shipments that weren't linked to contracts
3. **Testing**: Create test contracts, proformas, and shipments
4. **Production**: Deploy when ready (100% backward compatible)

---

## 📞 Support

- **Documentation**: See `README.md` section "🆕 Contracts & Proforma Invoices"
- **Implementation Summary**: See `CONTRACTS_IMPLEMENTATION_SUMMARY.md`
- **API Reference**: See updated `README.md` for all endpoint examples
- **Database Schema**: Migrations have inline comments with details

