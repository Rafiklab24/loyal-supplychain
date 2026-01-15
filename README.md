# Loyal Supply Chain

Supply chain management system with ETL pipeline and API.

## Structure

- `app/` - Node.js/TypeScript API
- `vibe/` - React frontend (Vite)
- `etl/` - Excel ingestion utilities
- `docs/` - Core documentation (`docs/archive/` holds historical reports)
- `scripts/` - Helper shell scripts (start, setup, tests)
- `tools/` - Developer utilities (one-off JS/TS/SQL helpers)

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for caching)
- Docker & Docker Compose (optional, for containerized setup)

### Option 1: Docker (Recommended)

```bash
# Start all services (database, redis, backend, frontend)
docker-compose up -d

# Run migrations
docker-compose exec backend npm run db:up

# View logs
docker-compose logs -f backend
```

### Option 2: Local Development

#### 1. Database Setup

```bash
cd app
npm install
cp .env.example .env  # Configure DATABASE_URL
npm run db:up         # Run migrations
```

### 2. ETL Data Import

```bash
# Install ETL dependencies (from project root)
npm install

# Import arrivals board data
npm run etl:excel -- --file "/path/البضاعة القادمة محدث.xlsx"

# Import suppliers data (multiple files supported)
npm run etl:suppliers -- --files "LOYAL- SUPPLIER INDEX modified.xlsx,WorldFood 2025 Suppliers.xlsx"

# Import transfers/payments data
npm run etl:transfers -- --file "/path/حوالات2025.xlsx"

# Run data quality checks
npm run etl:qa

# Or run directly:
ts-node etl/excel-loader.ts --file "/path/البضاعة القادمة محدث.xlsx"
ts-node etl/suppliers-loader.ts --files "file1.xlsx,file2.xlsx"
ts-node etl/transfers-loader.ts --file "/path/حوالات.xlsx" --dry-run
ts-node etl/qa-checks.ts
```

### 3. API Server

Start the REST API server:

```bash
cd app
npm run dev  # Start development server on port 3000
```

The API will be available at `http://localhost:3000/api`

#### Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Get dashboard stats
curl http://localhost:3000/api/health/stats

# List shipments
curl "http://localhost:3000/api/shipments?limit=10"

# Run full test suite
cd app && ./test-api.sh
```

#### API Endpoints

- `GET /api/health` - Health check
- `GET /api/health/stats` - Dashboard statistics
- `GET /api/shipments` - List shipments (with filtering)
- `GET /api/shipments/:id` - Get single shipment
- `GET /api/shipments/sn/:sn` - Get by contract number
- `GET /api/companies` - List companies
- `GET /api/companies/type/suppliers` - List suppliers
- `GET /api/companies/type/shipping-lines` - List shipping lines
- `GET /api/transfers` - List financial transfers
- `GET /api/ports` - List ports

See [API.md](./API.md) for complete API documentation.

## Documentation

### Core Documentation

- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development setup and workflow
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment guide
- **[docs/API.md](docs/API.md)** - Complete REST API reference (or use `/api-docs` for Swagger UI)
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture overview
- **[docs/SECURITY.md](docs/SECURITY.md)** - Security best practices
- **[docs/SECRETS.md](docs/SECRETS.md)** - Secrets management guide
- **[docs/TESTING.md](docs/TESTING.md)** - Testing guide
- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** - Contribution guidelines

### Legacy Documentation

- **[API_SURFACE_MAP.md](./API_SURFACE_MAP.md)** - Endpoint inventory & sequence diagrams
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Local/production database options
- **[ENV_FILES_GUIDE.md](./ENV_FILES_GUIDE.md)** - Required environment variables
- **[ERD_DETAILED.md](./ERD_DETAILED.md)** - Entity-relationship diagrams
- **[HOW_TO_START.md](./HOW_TO_START.md)** - Step-by-step startup guide
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Contracts/proforma migration instructions
- Legacy and milestone reports live under `docs/archive/`.

## Data Summary

After running the ETL scripts, you should have:

- **376 shipments** from arrivals board
- **74 suppliers** from supplier index files
- **208 shipping lines** auto-created from shipments
- **61 ports** auto-created from shipments
- **Transfers** (if imported from حوالات file)

## Features

✅ **Database Migrations** - Idempotent PostgreSQL migrations  
✅ **ETL Pipeline** - Excel → PostgreSQL data import  
✅ **REST API** - Express/TypeScript API server  
✅ **Data Quality Checks** - Automated QA audits  
✅ **Arabic Support** - Proper UTF-8 handling  
✅ **Financial Calculations** - Automatic trigger-based calculations  
✅ **Import Logging** - Track all ETL runs  

## Tech Stack

- **Backend**: Node.js 20 + TypeScript + Express
- **Frontend**: React 19 + Vite + TypeScript
- **Database**: PostgreSQL 15+
- **Cache**: Redis (optional)
- **ETL**: xlsx library for Excel parsing
- **API**: RESTful JSON API with pagination, versioning (`/api/v1/*`)
- **Documentation**: Swagger/OpenAPI (`/api-docs`)
- **Monitoring**: Prometheus metrics (`/metrics`)
- **Containerization**: Docker & Docker Compose

## Development

### Prerequisites

- Node.js 18+ 
- PostgreSQL 16+
- TypeScript 5+

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/loyal_supplychain
PORT=3000
NODE_ENV=development
```

### Running Tests

```bash
# Database migrations
cd app && npm run db:up

# ETL test workflow
./scripts/test-workflow.sh

# API tests
cd app && ./test-api.sh
```

## Deployment

### Docker Deployment

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Or build and run manually
docker build -t loyal-supplychain-backend .
docker build -f Dockerfile.frontend -t loyal-supplychain-frontend .
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

### CI/CD

The project includes GitHub Actions workflows:
- **CI Pipeline** (`.github/workflows/ci.yml`) - Runs on every PR
- **Deploy Pipeline** (`.github/workflows/deploy.yml`) - Deploys on version tags
- **Test Pipeline** (`.github/workflows/test.yml`) - Runs test suite

### Database Options

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for production database setup options:
- Homebrew PostgreSQL (local)
- Docker containers
- AWS RDS
- Cloud providers

## Contributing

1. Run migrations first: `cd app && npm run db:up`
2. Import test data: `npm run etl:excel -- --file "test-data.xlsx"`
3. Start API server: `cd app && npm run dev`
4. Make changes and test
5. Run QA checks: `npm run etl:qa`

## License

Proprietary - Loyal Supply Chain

## 🆕 Contracts & Proforma Invoices (New Features)

### Overview

The system now supports **first-class contracts** and **proforma invoices**, enabling:
- Master contracts with multiple products (contract lines)
- Proforma invoices linked to contracts
- Shipments linked to contracts (replacing the simple `sn` field)
- Multi-product shipments (shipment lines)
- Payment schedules tied to contracts
- Comprehensive audit logging for all changes

### Database Migrations

Three new migrations extend the schema:

#### **Migration 012**: Core Schema
```bash
cd app
npm run db:up
```

Creates:
- `logistics.contracts` - Master sales/purchase agreements
- `logistics.contract_lines` - Products within contracts
- `logistics.proforma_invoices` - Proforma invoices
- `logistics.proforma_lines` - Products within proformas
- `logistics.shipment_lines` - Multi-product shipment support
- `logistics.shipment_containers` - Container-level tracking
- `finance.payment_schedules` - Payment milestones
- Extends `logistics.shipments` with `contract_id`, `proforma_id`, weights, bags
- Extends `archive.documents` with `contract_id`, `proforma_id`

#### **Migration 013**: Data Backfill
Automatically backfills contracts from existing shipment `sn` data:
- Creates one contract per unique `sn`
- Links all shipments to their contracts
- Attempts to create shipment lines from `product_text`
- Links documents to contracts

**Safe to rerun** - idempotent and backward compatible.

#### **Migration 014**: Audit Triggers
Adds comprehensive audit logging:
- Tracks INSERT/UPDATE/DELETE on contracts, shipments, proformas
- Stores full JSONB before/after snapshots
- Helper views: `security.v_recent_audits`, `security.v_audit_summary`
- Helper function: `security.get_entity_audit_history(table, id)`

### New API Endpoints

#### **Contracts API** (`/api/contracts`)

```bash
# List contracts
curl "http://localhost:3000/api/contracts?page=1&limit=20"

# Get single contract with lines
curl http://localhost:3000/api/contracts/:id

# Create contract
curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "contract_no": "SN-2025-001",
    "buyer_company_id": "uuid-buyer",
    "seller_company_id": "uuid-seller",
    "currency_code": "USD",
    "incoterm_code": "CIF",
    "status": "ACTIVE",
    "lines": [{
      "product_id": "uuid-product",
      "uom": "ton",
      "planned_qty": 1000,
      "unit_price": 450,
      "tolerance_pct": 5
    }]
  }'

# Update contract
curl -X PUT http://localhost:3000/api/contracts/:id \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}'

# Get contract lines
curl http://localhost:3000/api/contracts/:id/lines

# Add payment schedule
curl -X POST http://localhost:3000/api/contracts/:id/payment-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "seq": 1,
    "basis": "ON_BOOKING",
    "percent": 30
  }'

# Get payment schedules
curl http://localhost:3000/api/contracts/:id/payment-schedules
```

#### **Proforma Invoices API** (`/api/proformas`)

```bash
# List proformas
curl "http://localhost:3000/api/proformas?contract_id=uuid&status=ISSUED"

# Get single proforma with lines
curl http://localhost:3000/api/proformas/:id

# Create proforma
curl -X POST http://localhost:3000/api/proformas \
  -H "Content-Type: application/json" \
  -d '{
    "number": "PI-2025-001",
    "contract_id": "uuid-contract",
    "issued_at": "2025-01-15",
    "valid_until": "2025-02-15",
    "status": "ISSUED",
    "lines": [{
      "product_id": "uuid-product",
      "qty": 500,
      "unit_price": 450
    }]
  }'

# Get proformas by contract
curl http://localhost:3000/api/proformas/contract/:contractId
```

#### **Enhanced Shipments API** (New Endpoints)

```bash
# Create shipment with contract (existing POST now accepts contract_id or contract_no)
curl -X POST http://localhost:3000/api/shipments \
  -H "Content-Type: application/json" \
  -d '{
    "contract_id": "uuid-contract",
    "proforma_id": "uuid-proforma",
    "direction": "incoming",
    "eta": "2025-02-15",
    "pol_id": "uuid-port",
    "pod_id": "uuid-port"
  }'

# Get shipment lines (multi-product support)
curl http://localhost:3000/api/shipments/:id/lines

# Add shipment lines
curl -X POST http://localhost:3000/api/shipments/:id/lines \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [{
      "product_id": "uuid-product",
      "qty": 500,
      "unit_price": 450,
      "currency_code": "USD",
      "bags_count": 2000
    }]
  }'

# Get shipment containers
curl http://localhost:3000/api/shipments/:id/containers

# Add shipment containers
curl -X POST http://localhost:3000/api/shipments/:id/containers \
  -H "Content-Type: application/json" \
  -d '{
    "containers": [{
      "container_no": "MSCU1234567",
      "size_code": "40HC",
      "seal_no": "SEAL123",
      "gross_weight_kg": 28000,
      "net_weight_kg": 25000
    }]
  }'
```

### Validation (Zod)

All new endpoints use **Zod** for request validation. Invalid requests return:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "contract_no",
      "message": "Contract number is required",
      "code": "invalid_type"
    }
  ],
  "timestamp": "2025-01-13T12:00:00.000Z"
}
```

### Workflow Example

**Create a full contract → proforma → shipment flow:**

```bash
# 1. Create contract
CONTRACT_ID=$(curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "contract_no": "SN-2025-100",
    "buyer_company_id": "buyer-uuid",
    "seller_company_id": "seller-uuid",
    "currency_code": "USD",
    "lines": [{
      "product_id": "product-uuid",
      "uom": "ton",
      "planned_qty": 1000,
      "unit_price": 450
    }]
  }' | jq -r '.id')

# 2. Create proforma against contract
PROFORMA_ID=$(curl -X POST http://localhost:3000/api/proformas \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"PI-2025-100\",
    \"contract_id\": \"$CONTRACT_ID\",
    \"issued_at\": \"2025-01-15\",
    \"lines\": [{
      \"product_id\": \"product-uuid\",
      \"qty\": 500,
      \"unit_price\": 450
    }]
  }" | jq -r '.id')

# 3. Create shipment linked to contract & proforma
SHIPMENT_ID=$(curl -X POST http://localhost:3000/api/shipments \
  -H "Content-Type: application/json" \
  -d "{
    \"contract_id\": \"$CONTRACT_ID\",
    \"proforma_id\": \"$PROFORMA_ID\",
    \"direction\": \"incoming\",
    \"pol_id\": \"pol-uuid\",
    \"pod_id\": \"pod-uuid\",
    \"eta\": \"2025-02-15\"
  }" | jq -r '.id')

# 4. Add shipment lines (products in this shipment)
curl -X POST http://localhost:3000/api/shipments/$SHIPMENT_ID/lines \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [{
      "product_id": "product-uuid",
      "qty": 500,
      "unit_price": 450,
      "currency_code": "USD"
    }]
  }'

# 5. View audit history
curl http://localhost:3000/api/health/stats  # Updated with contract stats
```

### Audit Queries

```sql
-- View recent changes
SELECT * FROM security.v_recent_audits;

-- Get audit history for a contract
SELECT * FROM security.get_entity_audit_history('logistics.contracts', 'contract-uuid');

-- View audit summary (last 30 days)
SELECT * FROM security.v_audit_summary;
```

### Migration Runbook

**Fresh Install:**
```bash
cd app
npm install  # Installs Zod
npm run db:up  # Runs all migrations including 012, 013, 014
```

**Existing Database:**
```bash
cd app
npm install  # Installs Zod
npm run db:up  # Runs new migrations only (idempotent)
```

**Post-Migration Checks:**
```bash
# Verify backfill
psql $DATABASE_URL -c "SELECT COUNT(*) FROM logistics.contracts;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM logistics.shipments WHERE contract_id IS NOT NULL;"

# Check audit logs
psql $DATABASE_URL -c "SELECT COUNT(*) FROM security.audits;"
```

### Breaking Changes

**None!** The refactoring is **backward compatible**:
- Existing `sn` field is preserved
- Old shipments without `contract_id` still work
- All existing API endpoints unchanged
- New fields are nullable

### Future Work (TODOs)

- [ ] Update frontend to use contracts API
- [ ] Add contract document templates
- [ ] Implement automatic proforma generation from contracts
- [ ] Add contract renewal/amendment workflow
- [ ] Link invoices to proformas
- [ ] Add contract analytics dashboard

---

## Support

For issues or questions:
1. Check [QUICKSTART.md](./QUICKSTART.md) for common setup issues
2. Review [API.md](./API.md) for API usage
3. See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for current implementation status
4. For contract/proforma features, see the new endpoints section above
