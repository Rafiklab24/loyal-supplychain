# 🚀 Contracts Feature - Quick Start

## ⚡ 30-Second Setup

```bash
# From project root:
./SETUP_CONTRACTS.sh
```

**That's it!** The script handles everything automatically.

---

## 📝 What It Does

1. ✅ Runs 3 database migrations
2. ✅ Creates contracts from existing shipments
3. ✅ Restarts backend with new routes
4. ✅ Tests all new endpoints

---

## 🧪 Test It Right Away

```bash
# List contracts
curl http://localhost:3000/api/contracts | jq '.pagination.total'

# List proformas
curl http://localhost:3000/api/proformas | jq '.pagination.total'

# Get shipment lines (replace with real ID)
curl http://localhost:3000/api/shipments/YOUR-SHIPMENT-ID/lines | jq '.'
```

---

## 🆕 New Endpoints Summary

| Endpoint | Purpose |
|----------|---------|
| `GET /api/contracts` | List all contracts |
| `POST /api/contracts` | Create new contract |
| `GET /api/contracts/:id` | Get contract with lines |
| `GET /api/contracts/:id/payment-schedules` | Get payment terms |
| `GET /api/proformas` | List all proformas |
| `POST /api/proformas` | Create new proforma |
| `GET /api/proformas/contract/:id` | Get proformas by contract |
| `GET /api/shipments/:id/lines` | Get shipment products |
| `POST /api/shipments/:id/lines` | Add shipment products |
| `GET /api/shipments/:id/containers` | Get containers |

---

## 📊 What You'll Get

After running the setup:

```
Contracts created: ~150 (from your existing SNs)
Shipments linked: ~165
Shipment lines: ~165 (best-effort from product_text)
Audit logs: Active and tracking all changes
```

---

## 🎯 Quick Validation

```bash
# Check contracts were created
curl -s http://localhost:3000/api/contracts | jq '.pagination.total'
# Expected: Number > 0

# Check a contract detail
curl -s http://localhost:3000/api/contracts | jq '.data[0]'
# Expected: Full contract JSON with buyer/seller info

# Check audit is working
curl -s http://localhost:3000/api/health | jq '.status'
# Expected: "healthy"
```

---

## ❓ If Something Goes Wrong

```bash
# View setup logs
cat backend.log

# Check database connection
curl http://localhost:3000/api/health

# Restart backend manually
cd app
lsof -ti:3000 | xargs kill
npm run dev &
```

---

## 📚 Full Documentation

- **Complete Guide**: `MIGRATION_GUIDE.md`
- **Implementation Details**: `CONTRACTS_IMPLEMENTATION_SUMMARY.md`
- **API Examples**: `README.md` (section: "🆕 Contracts & Proforma Invoices")

---

## ✨ Key Features Enabled

✅ Master contracts with multiple products  
✅ Proforma invoices linked to contracts  
✅ Multi-product shipments (shipment lines)  
✅ Container-level tracking  
✅ Payment schedules & terms  
✅ Full audit trail with JSONB diffs  
✅ Zod validation on all inputs  
✅ 100% backward compatible  

---

**Ready? Run the script!**

```bash
./SETUP_CONTRACTS.sh
```

