# Loyal Supply Chain - Master Context Document

**Last Updated:** January 16, 2026 (Branch-Restricted Exec Role)  
**Purpose:** Single source of truth for all agents working on this codebase

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Database Architecture](#database-architecture)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Key Design Decisions](#key-design-decisions)
6. [Current State](#current-state)
7. [Known Issues](#known-issues)
8. [Session Log](#session-log)
9. [Critical Rules for Agents](#critical-rules-for-agents)
10. [Production Deployment (DigitalOcean)](#production-deployment-digitalocean)

---

## System Overview

**Loyal Supply Chain** is a comprehensive import/export management system for agricultural commodities trading. It handles:

- **Shipments** - Track goods from purchase to delivery
- **Contracts** - Manage purchase/sales agreements
- **Finance** - Track payments, transactions, fund management
- **Customs Clearing** - Handle customs costs and batch processing (POD + border crossings)
- **Land Transport** - Manage outbound deliveries
- **E-Fatura** - Turkish electronic invoice tracking (post-clearance)
- **Border Crossings** - Manage border crossing points for internal routes (Turkey → Iraq/Syria)
- **Border Agent Interface** - Mobile-friendly interface for field agents at borders
- **Inventory Dashboard (FB Interface)** - Final Beneficiary shipment tracking with delivery confirmation
- **Quality Incident System** - Quality issue reporting wizard with photo evidence, measurements, and HOLD control
- **User Access Control** - Role-based and branch-based permissions
- **Cafeteria Voting System** - Daily lunch voting for employees with chef dashboard

### Access Points

| Service | URL | Port |
|---------|-----|------|
| Frontend | http://localhost:5173 | 5173 |
| Backend API | http://localhost:3000 | 3000 |
| Database | postgresql://rafik@localhost:5432/loyal_supplychain | 5432 |

### WiFi Sharing (for colleagues on same network)

The system is now configured for **automatic** local network access. No manual CORS editing needed!

**1. Get your local IP address:**
```bash
ipconfig getifaddr en0  # macOS WiFi
# Example output: 192.168.1.114
```

**2. Update Frontend `.env` file** (`vibe/.env`):
```bash
# Change from localhost to your IP
VITE_API_BASE_URL=http://192.168.1.114:3000/api
```

**3. Backend CORS** - Already configured to accept any local network IP:
```typescript
// app/src/index.ts - Dynamic CORS (already implemented!)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.includes('localhost') || origin.match(/^http:\/\/192\.168\.\d+\.\d+:\d+$/)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  // ...
}));
```

**4. Vite network access** - Already enabled in `vibe/vite.config.ts`:
```typescript
  server: {
    host: true, // Allow access from network (WiFi)
  },
```

**5. Restart frontend** after updating `.env`:
```bash
cd /Users/rafik/loyal-supplychain/vibe && npm run dev
```

**Share these URLs with colleagues:**
- Frontend: `http://192.168.1.114:5173`
- Backend API: `http://192.168.1.114:3000`

**Test Accounts:**
| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin123!` | Admin |
| `colleague` | `Welcome123!` | Admin |

⚠️ **Important:** Revert `.env` back to `localhost` for normal development.

### Start Commands

```bash
# Start everything
cd /Users/rafik/loyal-supplychain && ./START.sh

# Or manually:
# Terminal 1 - Backend
cd /Users/rafik/loyal-supplychain/app && npm run dev

# Terminal 2 - Frontend
cd /Users/rafik/loyal-supplychain/vibe && npm run dev

# Database (if needed)
brew services start postgresql@16
```

---

## Tech Stack

### Backend
- **Runtime:** Node.js with Express
- **Language:** TypeScript
- **Database:** PostgreSQL 16
- **Auth:** JWT tokens
- **Build:** `npm run build` → `dist/`

### Frontend
- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** React Query for server state
- **Routing:** React Router

### Key Directories

```
loyal-supplychain/
├── app/                    # Backend
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth, permissions, branch filtering
│   │   ├── services/       # Business logic (OpenAI, notifications)
│   │   ├── db/migrations/  # Database migrations
│   │   └── validators/     # Zod schemas
│   └── dist/               # Compiled output
├── vibe/                   # Frontend
│   └── src/
│       ├── components/     # React components
│       ├── pages/          # Page components
│       ├── contexts/       # React contexts
│       └── hooks/          # Custom hooks
├── tools/                  # Utility scripts
├── data/                   # Source data files
└── scripts/                # Shell scripts
```

---

## Database Architecture

### Schemas

| Schema | Purpose |
|--------|---------|
| `master_data` | Reference data (companies, ports, products, branches, **border_crossings**) |
| `logistics` | Core business (shipments, contracts, deliveries) |
| `finance` | Financial (transactions, funds, customs clearing) |
| `archive` | Document metadata storage (files stored externally) |
| `security` | Users, audits, user_branches |
| `system` | Maintenance mode, blackday shutdowns |

### E-Fatura Storage

E-Fatura (Turkish electronic invoice) data is stored in `logistics.shipment_documents`:

| Column | Type | Purpose |
|--------|------|---------|
| `e_fatura_number` | TEXT | The E-Fatura invoice number |
| `e_fatura_created_at` | TIMESTAMPTZ | When the E-Fatura was created |
| `e_fatura_created_by` | UUID | User who created/saved it |

**API:** `/api/e-fatura/pending` - Lists cleared shipments needing E-Fatura  
**Route:** `app/src/routes/efatura.ts`

### Document/File Storage

**Files are NOT stored in the database.** The `archive.documents` table stores **metadata only**:

```sql
archive.documents (
  id, shipment_id, contract_id,
  doc_type,      -- 'PI', 'CI', 'PL', 'BL_DRAFT', etc.
  filename,
  s3_key,        -- Reference to S3 storage
  file_path,     -- Reference to filesystem
  file_size, mime_type, uploaded_by, upload_ts
)
```

Files are stored externally (S3 or filesystem), DB only stores references.

### Border Crossings & Route Management

**International Route:** POL (Port of Loading) → POD (Port of Discharge)
**Internal Route:** POD → Final Destination (may cross border)

```sql
-- Border crossings master data
master_data.border_crossings (
  id, name, name_ar,
  country_from,     -- e.g., 'Turkey'
  country_to,       -- e.g., 'Iraq', 'Syria'
  location,         -- GPS/description
  is_active
)

-- Seed data includes: Habur, Oncupinar, Cilvegözü, Nusaybin, Kapikule, Ibrahim Khalil

-- Internal route fields on shipment_logistics
logistics.shipment_logistics (
  ...existing fields...,
  is_cross_border BOOLEAN,              -- Auto-calculated from POD country vs FD country
  primary_border_crossing_id UUID,      -- FK to border_crossings
  transit_countries TEXT[],             -- Rare: multi-country transit
  internal_transport_mode TEXT          -- 'truck', 'rail', 'sea', 'air', 'other'
)

-- Multi-stage clearance fields on customs_clearing_costs
finance.customs_clearing_costs (
  ...existing fields...,
  border_crossing_id UUID,              -- FK to border_crossings (for border clearances)
  stage_order INTEGER,                  -- 1=POD, 2=Border1, 3=Border2
  arrival_date DATE,                    -- When goods arrived at customs/border
  clearance_date DATE,                  -- When clearance completed
  assigned_to_user_id UUID,             -- Field agent assignment
  clearance_status TEXT                 -- 'pending', 'arrived', 'in_progress', 'cleared', 'cancelled'
)
```

**API Endpoints:**
- `GET /api/border-crossings` - List all border crossings
- `GET /api/border-crossings/by-route/:country_from/:country_to` - Get crossings for specific route
- `GET /api/border-crossings/border-shipments` - Get shipments for border agent (filtered by stage/branch)
- `GET /api/border-crossings/border-shipments/:id` - Get single border shipment details
- `PATCH /api/border-crossings/border-shipments/:id/stage` - Update shipment border stage
- `POST /api/border-crossings/border-shipments/:id/costs` - Enter border clearance costs

**Frontend Pages:**
- `/border-crossings` - Admin page for managing border crossings
- `/border-agent` - Mobile-friendly interface for field agents (stage-based workflow)

**Border Agent Workflow Stages:**
1. `pending_at_pod` - Shipment cleared at POD, waiting for internal transport assignment
2. `on_the_way` - Transport assigned, showing ETA to border
3. `at_border` - Arrived at border, waiting for clearance
4. `clearing` - Customs clearance in progress
5. `cleared` - Clearance complete, costs entered

### Normalized Shipment Tables (CRITICAL)

Shipments are stored across multiple normalized tables. **ALWAYS use `v_shipments_complete` view** for queries that need full shipment data.

```
logistics.shipments              -- Core shipment record (id, sn, status, contract_id, etc.)
  └── logistics.shipment_logistics    -- Dates, ports, final_destination, border info (1:1)
  └── logistics.shipment_cargo        -- Weight, quantity, value totals (1:1)
  └── logistics.shipment_parties      -- Suppliers, shipping line references (1:1)
  └── logistics.shipment_documents    -- BL number, e-fatura, paperwork status (1:1)
  └── logistics.shipment_financials   -- Payment terms, currency, advance info (1:1)
  └── logistics.shipment_lines        -- Product lines array (1:many)
  └── logistics.shipment_containers   -- Container numbers (1:many)
```

**Key Columns by Table:**
| Column | Table | Notes |
|--------|-------|-------|
| `final_destination` | `shipment_logistics` | JSONB with `branch_id`, `warehouse_id`, `name` |
| `eta`, `etd` | `shipment_logistics` | DATE type |
| `pol_id`, `pod_id` | `shipment_logistics` | FK to `master_data.ports` |
| `weight_ton`, `container_count` | `shipment_cargo` | Numeric |
| `total_value_usd` | `shipment_cargo` | Numeric |
| `supplier_company_id` | `shipment_parties` | FK to companies |
| `shipping_line_id` | `shipment_parties` | FK to companies |
| `bl_no`, `booking_no` | `shipment_documents` | Text |
| `contract_id` | `shipments` (base) | FK to contracts (currently NULL for all) |

**View:** `logistics.v_shipments_complete` - Aggregates all tables with JOINs, use this for listing/detail queries.

### Quality Incidents & Inventory System

```sql
-- Quality incidents table
logistics.quality_incidents (
  id, shipment_id, created_by_user_id, branch_id,
  status: 'draft'|'submitted'|'under_review'|'action_set'|'closed',
  issue_type,           -- Comma-separated values: 'broken,mold,moisture,foreign_matter,wrong_spec,damaged'
  issue_subtype,
  description_short,
  affected_estimate_min, affected_estimate_max, affected_estimate_mode,
  container_moisture_seen, container_bad_smell, container_torn_bags, container_torn_bags_count, container_condensation,
  sample_weight_g, broken_g, mold_g, foreign_g, other_g, moisture_pct, total_defect_pct,  -- Measurements
  hold_applied_at, submitted_at, closed_at
)

-- Sample cards (for detailed sampling - optional)
logistics.quality_sample_cards (
  id, incident_id, sample_id: 'F'|'M'|'B',
  group: 'front'|'middle'|'back',
  sample_weight_g, broken_g, mold_g, foreign_g, other_g,
  broken_pct, mold_pct, foreign_pct, total_defect_pct,
  is_complete
)

-- Media uploads (photos/videos)
logistics.quality_media (
  id, incident_id, sample_card_id,
  media_type: 'photo'|'video',
  slot: 'F'|'M'|'B'|'container'|'other',
  file_path, created_by_user_id
)

-- Review actions (supervisor/HQ decisions)
logistics.quality_review_actions (
  id, incident_id, by_user_id, by_role,
  action_type: 'request_resample'|'keep_hold'|'clear_hold'|'close',
  notes, target_sample_ids
)

-- Supplier delivery tracking
logistics.supplier_delivery_records (
  id, shipment_id, supplier_id,
  delivery_successful: TRUE (no issues) | FALSE (had quality incident),
  incident_id, delivered_at
)

-- Shipment enhancement for HOLD status
logistics.shipments (
  ...existing fields...,
  hold_status BOOLEAN DEFAULT FALSE,
  hold_reason TEXT
)

-- Shipment documents enhancement for delivery tracking
logistics.shipment_documents (
  ...existing fields...,
  delivery_confirmed_at TIMESTAMPTZ,
  delivery_confirmed_by UUID
)
```

**Views:**
- `logistics.v_inventory_shipments` - Shipments for FB interface with costs and latest incident
- `logistics.v_quality_incidents_complete` - Full incident details with aggregated stats

**API Endpoints:**
- `GET /api/inventory/shipments` - List shipments for user's branch (with sorting)
- `POST /api/inventory/shipments/:id/delivered` - Mark shipment as delivered
- `GET /api/quality-incidents` - List incidents (filtered by branch/status)
- `POST /api/quality-incidents` - Create new incident (applies HOLD)
- `GET /api/quality-incidents/:id` - Get incident with media
- `PUT /api/quality-incidents/:id` - Update incident
- `POST /api/quality-incidents/:id/submit` - Submit for review
- `POST /api/quality-incidents/:id/media` - Upload photo/video

**Frontend Pages:**
- `/inventory` - Inventory Dashboard for Final Beneficiaries
- `/quality-incidents` - Quality Review Page for supervisors/HQ
- `/quality-incident/:id` - Quality Incident Wizard (draft) or Report View (submitted)

### Shipments - Fully Normalized Structure

The `logistics.shipments` table is **slim** (~19 columns). All business data is in normalized tables:

```
logistics.shipments (core)
├── logistics.shipment_parties    (supplier, customer, broker, beneficiary)
├── logistics.shipment_cargo      (product_text, weight, cargo_type, country_of_origin - NO JSONB)
├── logistics.shipment_logistics  (ports, dates, vessel, final_destination)
├── logistics.shipment_financials (pricing, payments, banking)
├── logistics.shipment_documents  (files, quality feedback)
├── logistics.shipment_lines      (product lines - NORMALIZED, NOT JSONB)
├── logistics.shipment_containers (container details - NORMALIZED, NOT JSONB)
└── logistics.shipment_batches    (batch/split shipments - NORMALIZED, NOT JSONB)
```

**CRITICAL:** 
- **SELECT queries** must use `logistics.v_shipments_complete` view (aggregates normalized tables into JSON for frontend)
- **INSERT/UPDATE/DELETE** go to base `logistics.shipments` table + normalized tables
- **Product lines, containers, batches** are now in their own tables (no more JSONB in shipment_cargo)

### Contract Fulfillment & Traceability

The system tracks partial shipments and provides full traceability from contracts to final delivery:

```sql
-- Fulfillment tracking uses existing shipment_lines linkage:
logistics.shipment_lines.contract_line_id → logistics.contract_lines.id

-- Traceability chain (added in migration 122):
finance.customs_clearing_costs.shipment_line_id → logistics.shipment_lines.id
logistics.outbound_deliveries.customs_clearing_cost_id → finance.customs_clearing_costs.id
logistics.outbound_deliveries.shipment_line_id → logistics.shipment_lines.id

-- Traceability view for querying full chain:
CREATE VIEW logistics.v_traceability_chain AS
SELECT
    cl.id AS contract_line_id,
    cl.contract_id,
    sl.id AS shipment_line_id,
    sl.shipment_id,
    ccc.id AS customs_cost_id,
    od.id AS delivery_id
FROM logistics.contract_lines cl
LEFT JOIN logistics.shipment_lines sl ON cl.id = sl.contract_line_id
LEFT JOIN logistics.shipments s ON sl.shipment_id = s.id AND s.is_deleted = FALSE
LEFT JOIN finance.customs_clearing_costs ccc ON sl.id = ccc.shipment_line_id
LEFT JOIN logistics.outbound_deliveries od ON ccc.id = od.customs_clearing_cost_id;
```

**Contract Status Values:**
- `DRAFT` - Initial state
- `PENDING` - Awaiting shipment (0% shipped)
- `ACTIVE` - Being fulfilled (has shipments)
- `FULFILLED` - 100% shipped (auto-set by system)
- `COMPLETED` - Manually closed
- `CANCELLED` - Cancelled

**API Endpoints:**
- `GET /api/contracts/:id/fulfillment-status` - Per-line fulfillment breakdown
- `GET /api/contracts/:id/traceability` - Full chain with summary stats

### Contracts - Normalized Structure (⚠️ Has JSONB Duplicate Issue)

```
logistics.contracts (core)
├── logistics.contract_parties    (exporter, buyer, consignee, broker)
├── logistics.contract_shipping   (countries, ports, dates)
├── logistics.contract_terms      (incoterm, payment, cargo details)
├── logistics.contract_products   (banking info, final destination, ⚠️ has JSONB lines column)
└── logistics.contract_lines      (product lines - NORMALIZED ✅)
```

**View:** `logistics.v_contracts_complete`

**⚠️ KNOWN ISSUE:** `contract_products.lines` JSONB column still exists and is being written to, duplicating data in `contract_lines` table. See Known Issues section for fix instructions.

### Key Column Names

| Correct Name | NOT This | Table |
|--------------|----------|-------|
| `transaction_type` | ~~direction~~ | shipments |
| `fund_name` | ~~name~~ | funds |
| `fund_type` | ~~type~~ | funds |
| `currency_code` | ~~currency~~ | funds |

---

## User Roles & Permissions

### Available Roles

| Role | Arabic | Description |
|------|--------|-------------|
| **Admin** | مدير | Full system access, user management, all modules |
| **Exec** | تنفيذي | Read-only global access for executives/oversight |
| **Correspondence** | مراسلات | Contracts and shipments viewing for documentation |
| **Logistics** | لوجستيات | Shipments, contracts, and land transport management |
| **Procurement** | مشتريات | Contracts and products management for purchasing |
| **Inventory** | مخزون | Warehouse operations, land transport, quality incidents |
| **Clearance** | تخليص | Customs clearing operations and shipment viewing |
| **Accounting** | محاسبة | Financial transactions, customs costs, audit logs |
| **Cafe** | كافتيريا | Cafeteria menu management and voting system |

### Permission Levels

- **full** - Create, read, update, delete (CRUD)
- **read** - View only, no modifications
- **none** - No access to module

### Role-to-Module Permission Matrix

| Module | Admin | Exec | Correspondence | Logistics | Procurement | Inventory | Clearance | Accounting | Cafe |
|--------|-------|------|----------------|-----------|-------------|-----------|-----------|------------|------|
| **users** | full | none | none | none | none | none | none | none | none |
| **dashboard** | full | read | read | read | read | read | read | read | read |
| **contracts** | full | read | read | full | full | read | read | read | none |
| **shipments** | full | read | read | full | read | read | read | read | none |
| **finance** | full | read | none | none | none | none | none | full | none |
| **customs** | full | read | none | none | none | none | full | read | none |
| **land_transport** | full | read | none | full | none | full | read | read | none |
| **companies** | full | none | none | none | none | none | none | none | none |
| **products** | full | read | none | read | full | full | none | none | none |
| **analytics** | full | read | none | read | read | read | read | read | none |
| **accounting** | full | read | none | none | none | none | none | full | none |
| **audit_logs** | full | read | none | none | none | none | none | read | none |
| **inventory** | full | read | none | none | none | full | none | none | none |
| **quality** | full | full | none | none | none | full | none | none | none |
| **cafe** | full | read | read | read | read | read | read | read | full |

### Role Descriptions & Use Cases

#### 👑 Admin
- **Purpose:** System administrators with full control
- **Can Access:** All modules with full CRUD permissions
- **Special Powers:** 
  - User management (create/edit/delete users)
  - Company management (suppliers, customers, shipping lines)
  - Branch management and assignments
- **Branch Filtering:** Global access (sees all branches)
- **Typical Users:** IT administrators, system managers

#### 📊 Exec (Executive)
- **Purpose:** Management oversight with read-only access
- **Can Access:** All operational modules (view only)
- **Cannot Access:** User management, company management
- **Special Powers:**
  - Quality incident review and approval
  - Global data visibility for reporting
- **Branch Filtering:** Global access (sees all branches)
- **Typical Users:** CEOs, directors, department heads

#### 📝 Correspondence
- **Purpose:** Documentation and communication staff
- **Can Access:** Contracts (read), Shipments (read), Dashboard
- **Cannot Access:** Finance, customs, transport, analytics
- **Branch Filtering:** Branch-restricted (sees assigned branches only)
- **Typical Users:** Document coordinators, administrative assistants

#### 🚛 Logistics
- **Purpose:** Shipment and transport operations
- **Can Access:** 
  - Contracts (full) - Create and manage contracts
  - Shipments (full) - Full shipment management
  - Land Transport (full) - Delivery scheduling
  - Products (read), Analytics (read)
- **Cannot Access:** Finance, customs, user management
- **Branch Filtering:** Branch-restricted
- **Typical Users:** Logistics coordinators, shipping managers

#### 🛒 Procurement
- **Purpose:** Purchasing and supplier management
- **Can Access:**
  - Contracts (full) - Create purchase contracts
  - Products (full) - Product catalog management
  - Shipments (read) - Track incoming goods
  - Analytics (read)
- **Cannot Access:** Finance, customs, transport
- **Branch Filtering:** Branch-restricted
- **Typical Users:** Procurement officers, buyers

#### 📦 Inventory
- **Purpose:** Warehouse and stock management
- **Can Access:**
  - Inventory Dashboard (full) - FB interface for delivery confirmation
  - Quality Incidents (full) - Create and manage quality reports
  - Land Transport (full) - Outbound delivery coordination
  - Products (full) - Stock updates
  - Shipments (read), Contracts (read)
- **Cannot Access:** Finance, customs (clearance side), analytics
- **Branch Filtering:** Branch-restricted (sees only their warehouse's shipments)
- **Typical Users:** Warehouse managers, stock controllers, final beneficiaries

#### 🏛️ Clearance
- **Purpose:** Customs clearing operations
- **Can Access:**
  - Customs (full) - Clearance costs and batch management
  - Shipments (read) - View shipment status
  - Land Transport (read) - Coordinate with transport
  - Analytics (read)
- **Cannot Access:** Finance, contracts editing, products
- **Branch Filtering:** Branch-restricted
- **Typical Users:** Customs brokers, clearance agents

#### 💰 Accounting
- **Purpose:** Financial management and reporting
- **Can Access:**
  - Finance (full) - Transactions, funds, payments
  - Accounting (full) - Financial reports
  - Customs (read) - View clearance costs
  - Audit Logs (read) - Financial audit trail
  - Shipments (read), Contracts (read), Land Transport (read)
- **Cannot Access:** User management, products, companies
- **Branch Filtering:** Branch-restricted (but can see transactions across branches)
- **Typical Users:** Accountants, finance officers, bookkeepers

#### 🍽️ Cafe
- **Purpose:** Cafeteria management
- **Can Access:**
  - Cafe (full) - Post menus, manage votes, view suggestions
  - Dashboard (read) - Basic access
- **Cannot Access:** All business modules
- **Branch Filtering:** N/A (cafe is company-wide)
- **Typical Users:** Chef, cafeteria staff

### Multi-Role Support

Users can be assigned **multiple roles** to combine permissions. When a user has multiple roles:
- Permission checks use the **highest permission level** across all roles
- If ANY role grants `full` access → user has `full` access
- If ANY role grants `read` access (and none grant `full`) → user has `read` access
- Branch filtering uses the **most permissive** rule (if any role has global access, user has global access)

**Example:** A user with both `Logistics` and `Clearance` roles can:
- Create/edit shipments (from Logistics)
- Create/edit customs clearances (from Clearance)
- Manage land transport (from Logistics)

### Branch-Based Access Control

Beyond role permissions, users are also restricted by **branch assignments**:

| Role | Branch Filtering |
|------|------------------|
| Admin | Always Global (sees all) |
| Exec | **Conditional** - Global if no branches assigned; Branch-restricted if branches assigned |
| All Others | Branch-restricted |

**Exec Conditional Global Access (January 2026):**
- If an Exec user has **NO branch assignments** → Global access (company-wide CFO, CEO)
- If an Exec user has **branch assignments** → Restricted to those branches (e.g., Turkish COO)

This allows flexibility for C-level executives who may be responsible for only specific regions.

**Example Use Cases:**
- **Company-wide CFO:** Exec role with no branch assignments → sees all data
- **Turkish COO:** Exec role with "Loyal Turkey" branch assigned → only sees Turkish branch data

Branch-restricted users only see data where:
- `shipment_logistics.final_destination->>'branch_id'` matches their assigned branch
- Exception: Contracts are NOT branch-filtered (role permissions only)

### Database Schema for Roles

```sql
-- Users table stores primary role (legacy) and new roles array
security.users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  role TEXT,              -- Legacy single role (kept for backward compatibility)
  roles TEXT[],           -- NEW: Array of roles for multi-role support
  email TEXT,
  phone TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  failed_login_attempts INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- User-to-branch assignments
security.user_branches (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES security.users(id),
  branch_id UUID REFERENCES master_data.branches(id),
  access_level TEXT DEFAULT 'full',  -- 'full' or 'read_only'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, branch_id)
)
```

### Key Permission Files

| File | Purpose |
|------|---------|
| `app/src/middleware/permissions.ts` | Backend role-to-module permission matrix |
| `vibe/src/contexts/PermissionContext.tsx` | Frontend permission checking hooks |
| `app/src/routes/auth.ts` | User authentication and management |
| `app/src/middleware/branchFilter.ts` | Branch-based data filtering |

---

## Key Design Decisions

### 1. Normalized Tables with Views
- Business data split into domain-specific tables
- Views provide backward-compatible unified access
- Routes read from views, write to base tables

### 2. JSONB Being Phased Out → Normalized Tables
**SHIPMENTS: ✅ FULLY NORMALIZED**
- `lines` → `logistics.shipment_lines` table
- `containers` → `logistics.shipment_containers` table
- `batches` → `logistics.shipment_batches` table

**CONTRACTS: ⚠️ PARTIALLY NORMALIZED (needs cleanup)**
- `lines` → `logistics.contract_lines` table (but also duplicated in `contract_products.lines` JSONB)

**Still Using JSONB (acceptable):**
- `final_destination` - Nested object with branch/delivery info
- `extra_json` - Legacy catch-all (being phased out)
- `bol_numbers` - Simple array of strings
- `payment_schedule`, `additional_costs` - Complex nested structures

### 3. Branch-Based Access Control
- Users assigned to branches via `security.user_branches`
- Admin/Exec have global access
- Other roles see only data from assigned branches
- Filtering based on `final_destination.branch_id`

### 4. AI OCR Extraction
- Proforma invoices can be uploaded for AI extraction
- Uses OpenAI GPT-4o Vision API
- Extracts product lines, pricing, quantities
- Results stored in `logistics.ai_extraction_logs`

**Document Types Supported:**
| Type | Primary Document | Fallback Sources |
|------|------------------|------------------|
| **Commercial Invoice (CI)** | Commercial Invoice | B/L, Packing List, Certificate of Origin, Proforma Invoice |
| **Bill of Lading (B/L)** | Bill of Lading, CMR, Sea Waybill | Commercial Invoice, Packing List, Certificate of Origin |

**Fallback Extraction Behavior (January 2026):**
- If primary document type not found, AI aggressively extracts data from ANY available document
- Fallback results marked with `document_info.document_type: "FALLBACK"` and `document_info.data_source: "fallback"`
- UI shows warning banner but still auto-fills form fields
- User can upload B/L to CI section (or vice versa) and still get useful data extracted
- Only returns `NOT_FOUND` if file is truly empty or contains no trade/shipping information

**Key Files:**
- `app/src/services/openai.ts` - AI extraction prompts and logic
- `app/src/routes/extraction.ts` - Extraction API endpoints
- `vibe/src/components/shipment/CIUploadSection.tsx` - CI upload UI
- `vibe/src/components/shipment/BOLUploadSection.tsx` - B/L upload UI

### 5. Date Handling (IMPORTANT)
**PostgreSQL dates are returned as raw strings**, not JavaScript Date objects. This prevents timezone conversion issues.

```typescript
// In app/src/db/client.ts
types.setTypeParser(1082, (val: string) => val); // DATE returns "2025-02-15"
types.setTypeParser(1114, (val: string) => val); // TIMESTAMP returns raw string
types.setTypeParser(1184, (val: string) => val); // TIMESTAMPTZ returns raw string
```

**Why:** The server is in Asia/Riyadh timezone (UTC+3). Without this fix, dates sent as "2025-02-15" would be stored as "2025-02-14" due to JS Date timezone conversion.

### 6. E2E Field Mapping Test
A comprehensive E2E test validates that all 56 fields across Shipments, Contracts, and Products are correctly:
1. Sent to API
2. Stored in database
3. Retrieved via API

**Run with:** `npx ts-node tools/field-mapping-e2e-test.ts`

**Current status:** 100% pass rate (56/56 fields)

---

## Current State (Manual Data Entry: January 1, 2026)

### Database Status
```
Database: Connected ✅
Migrations Applied: 100_clean_slate.sql, 001_master.sql, 104_normalize_shipment_data.sql, 105_normalize_contract_lines.sql, 107_e_fatura_tracking.sql, 115_route_border_system.sql, 120_quality_incidents.sql, 121_incident_measurements.sql, 122_traceability_chain.sql, 125_border_agent_workflow.sql, 130_cafe_system.sql, 131_loyal_ceramics_branch.sql
```

### Table Counts (Manual Entry in Progress)
| Table | Count | Status |
|-------|-------|--------|
| contracts | 0 | Pending - shipments entered first |
| shipments | 22 | ✅ Manually entered |
| shipment_parties | 22 | ✅ |
| shipment_cargo | 22 | ✅ |
| shipment_logistics | 22 | ✅ |
| shipment_financials | 22 | ✅ |
| shipment_documents | 22 | ✅ |
| **shipment_lines** | 29 | ✅ Multi-product shipments |
| **shipment_containers** | 0 | - |
| **shipment_batches** | 0 | - |
| contract_parties | 0 | - |
| contract_shipping | 0 | - |
| contract_terms | 0 | - |
| contract_products | 0 | - |
| **contract_lines** | 0 | - |
| archive.documents | 35 | ✅ Documents uploaded |
| transactions | 0 | - |
| funds | 0 | - |
| ports | 131 | ✅ Master data intact |
| branches | 21 | ✅ Master data intact (includes Loyal Ceramics) |
| companies (suppliers) | 1984 | ✅ Master data intact |
| users | 5 | ✅ (includes `colleague` for WiFi testing) |
| user_branches | 3 | ✅ |
| **quality_incidents** | 0 | ✅ System ready |
| **quality_sample_cards** | 0 | ✅ System ready |
| **quality_media** | 0 | ✅ System ready |
| **quality_review_actions** | 0 | ✅ System ready |
| **cafe_menu_options** | 0 | ✅ System ready |
| **cafe_votes** | 0 | ✅ System ready |
| **cafe_menu_results** | 0 | ✅ System ready |
| **cafe_suggestions** | 0 | ✅ System ready |
| **cafe_settings** | 4 | ✅ System settings configured |

**Note:** System was reset on December 31, 2025. User began manual data entry on January 1, 2026. 22 shipments with 29 product lines and 35 documents have been entered. OCR fallback extraction enhancement added to assist with document uploads.

### Schema Status
- ✅ `logistics.shipments` has 19 columns (slim, normalized)
- ✅ `transaction_type` column exists (not `direction`)
- ✅ `v_shipments_complete` view exists (aggregates from normalized tables)
- ✅ `shipment_cargo` NO LONGER has lines/containers/batches columns
- ✅ `shipment_lines`, `shipment_containers`, `shipment_batches` tables are PRIMARY storage
- ✅ `contract_products` NO LONGER has `lines` column (DROPPED)
- ✅ `contract_lines` table is PRIMARY storage for contract product lines
- ✅ `v_contracts_complete` view aggregates from `contract_lines` table

### Running Services
- ✅ Backend on port 3000
- ✅ Frontend on port 5173
- ✅ PostgreSQL connected

### Build Status
- ✅ Backend compiles without errors
- ✅ Frontend compiles with **0 errors and 0 warnings**

---

## Known Issues (Priority Order)

### 🟢 RESOLVED - Previously Critical

#### 1. Frontend TypeScript Errors ✅ FULLY RESOLVED
All TypeScript errors AND warnings have been cleaned up. Build is completely clean.

#### 12. Date Timezone Bug (eta/etd off by 1 day) ✅ FIXED (December 11, 2025)
- **Problem:** Dates like `eta` and `etd` were stored 1 day earlier than sent
- **Cause:** Node.js `pg` driver converted DATE to JS Date, causing timezone shift (Asia/Riyadh UTC+3)
- **Solution:** Added type parsers in `app/src/db/client.ts` to return raw date strings
- **Status:** E2E test confirms 100% pass rate on all date fields

#### 13. Shipments API Missing Fields ✅ FIXED (December 11, 2025)
- **Problem:** 12 fields not being saved to database (has_sales_contract, has_broker, broker_name, cargo_type, lines, etd, vessel_name, incoterms, payment_method, lc_number, etc.)
- **Solution:** Added all missing fields to respective INSERT statements in `app/src/routes/shipments.ts`
- **Status:** E2E test confirms all 33 shipment fields now pass

#### 11. Internal Transportation Route Display ✅ FIXED (December 11, 2025)
- **Problem:** Route column (المسار) in inventory transactions table showed "Mersin → Vietnam" (origin country) instead of actual delivery destination
- **Cause:** SQL COALESCE was falling back to `final_destination->>'place'` which contained origin country
- **Solution:** Updated query to use `delivery_place`, `name`, and `final_beneficiary_name` as fallbacks, avoiding the problematic `place` field
- **File:** `app/src/routes/accounting.ts`

#### 14. Contracts List Stale Estimated Shipping Date ✅ FIXED (December 12, 2025)
- **Problem:** After editing a contract's estimated shipping date via wizard, the contracts list page showed the old value (e.g., "January 2026" instead of "February 2026")
- **Cause:** Contracts list endpoint was reading from old `extra_json` JSONB location while updates went to normalized `contract_shipping` table
- **Solution:** Updated list query to JOIN with `contract_shipping` and read `estimated_shipment_date` from there
- **File:** `app/src/routes/contracts.ts`

#### 2. Migrations Status ✅ VERIFIED
The `security.migrations` table shows:
- `100_clean_slate.sql` - Created complete schema from scratch
- `001_master.sql` - Applied master data

The clean slate migration created the complete normalized schema. Files 101-103 exist but weren't needed after clean slate.

#### 3. CONTRACT LINES DUPLICATE STORAGE ✅ FIXED (December 9, 2025)
**Problem:** Contracts were storing product lines in TWO places (JSONB and normalized table)
**Solution:** Removed JSONB writes from `contracts.ts`, updated view to aggregate from `contract_lines`, dropped `lines` column from `contract_products`
**Migration:** `105_normalize_contract_lines.sql`

### 🟡 MODERATE - Should Fix

#### 4. Routes Using Base Table ✅ VERIFIED OK
Found 7 queries that use `FROM logistics.shipments` directly:
- 4 in `shipments.ts` (existence checks - OK for ID lookups)
- 2 in `contracts.ts` (subqueries - OK)
- 1 in `blackday.ts` (COUNT(*) - OK, doesn't need columns)

**Status:** All usages are appropriate. Base table OK for COUNT and ID lookups.

#### 5. Field Mapping Approvals Lost
The `tools/field-mappings.json` was regenerated, losing all manual approvals.

#### 6. Branch Filtering ✅ FIXED (January 3, 2026)
Branch filtering middleware is in `app/src/middleware/branchFilter.ts`.

**CRITICAL: Database Schema for Branch Filtering**
- `final_destination` column is in `logistics.shipment_logistics`, NOT `logistics.shipments`
- All 77 shipments have corresponding `shipment_logistics` entries (1:1 relationship)
- 73 of 77 shipments have `branch_id` set in `final_destination`

**CRITICAL: Contract-Shipment Independence**
- In the current database, **NO shipments have `contract_id` set** (all NULL)
- Contracts and shipments are independent entities
- Branch filtering for contracts was failing because it looked for linked shipments

**Branch Filtering Rules (as of Jan 3, 2026):**

| Data Type | Branch Filtered? | Filter Logic |
|-----------|------------------|--------------|
| **Shipments** | ✅ Yes | `shipment_logistics.final_destination->>'branch_id'` |
| **Contracts** | ❌ No | Role permissions only (contracts are not linked to shipments) |
| **Finance** | ✅ Yes | Via linked shipment's `final_destination` |
| **Customs** | ✅ Yes | Via linked shipment's `final_destination` |
| **Transport** | ✅ Yes | Via linked shipment's `final_destination` |

**Global Access Roles:** Admin, Exec (bypass all branch filtering)

### 🟢 MINOR - Nice to Fix

#### 6. Legacy `extra_json` in Old Contracts
Some old contracts have data in `extra_json` instead of normalized tables.

#### 7. Empty Tables
- `finance.transactions` = 0 records
- `finance.funds` = 0 records

This may be intentional (test environment) or data was lost in clean slate.

### 🟢 RESOLVED - January 3, 2026

#### 16. Shipment Wizard Review Section Incomplete ✅ FIXED (January 3, 2026)
- **Problem:** Step 6 (Review) was missing critical fields: Supplier, Buyer, Final Owner, Final Destination
- **Solution:** Added "Commercial & Ownership Summary" card with all required fields, missing-data warnings with Edit links, and submission validation
- **Files:** `Step6Review.tsx`, `NewShipmentWizard.tsx`, `EditShipmentWizard.tsx`, `ar.json`, `en.json`
- **Status:** Review section now complete with validation blocking incomplete submissions

### 🟢 RESOLVED - December 8, 2025

#### 8. Edit Shipment Wizard Not Importing Contract Data ✅ FIXED
- **Problem:** When editing a shipment linked to a contract, the wizard didn't pre-fill data from the contract
- **Solution:** Added fallback contract data fetch in `EditShipmentWizard.tsx`, imports data for all wizard steps
- **Status:** All contract data now imports correctly (product lines, commercial terms, logistics, banking)

#### 9. Final Destination Dropdown Not Selecting Saved Value ✅ FIXED
- **Problem:** The delivery place dropdown showed placeholder instead of saved value
- **Solution:** Updated `Step1BasicInfo.tsx` to match `delivery_place` text against warehouse names
- **Status:** Dropdown now correctly selects saved delivery place

#### 10. `name_en` Column Error on Shipment Update ✅ FIXED
- **Problem:** Updating shipments failed with "column name_en does not exist"
- **Solution:** Removed references to non-existent `name_en` column in `shipments.ts` port resolution
- **Status:** Shipment updates work correctly

#### 15. Shipment Wizard Fields Not Saving (Supplier, POL, POD, Shipping Line, Internal Route) ✅ FIXED (December 29, 2025)
- **Problem:** In shipment wizard (create & edit), supplier, POL, POD, shipping company, and internal route fields were not saving/displaying correctly
- **Cause:** Multiple issues:
  1. Frontend `isValidUUID` checks were blocking "new:" prefixed values from reaching backend
  2. Backend `shipment_logistics` INSERT was missing internal route fields
  3. `useShipment` hook was making API calls with non-UUID IDs like "new"
  4. No route for `/shipments/new` caused 500 errors
- **Solution:** 
  1. Removed `isValidUUID` filter on `pol_id`, `pod_id`, `shipping_line_id` in `NewShipmentWizard.tsx` and `EditShipmentWizard.tsx`
  2. Added `is_cross_border`, `primary_border_crossing_id`, `internal_transport_mode` to `shipment_logistics` INSERT
  3. Added UUID validation to `useShipment` hook to prevent API calls with invalid IDs
  4. Added redirect route for `/shipments/new` → `/shipments`
- **Files:** `app/src/routes/shipments.ts`, `vibe/src/components/shipments/NewShipmentWizard.tsx`, `vibe/src/components/shipments/EditShipmentWizard.tsx`, `vibe/src/hooks/useShipments.ts`, `vibe/src/App.tsx`
- **Status:** All fields now save and load correctly

---

## Session Log

### December 8, 2025 - Session: Cross-Reference Audit & Cleanup
**Agent:** Claude
**Work Done:**
1. Analyzed 9 handoff documents for counter-interference
2. Found migration 100 destroyed work from migrations 039-067
3. Identified column naming inconsistencies (`direction` vs `transaction_type`)
4. Created this master context document
5. Deleted 9 redundant handoff documents
6. Ran comprehensive system diagnostics

**Diagnostics Results:**
- Database: Connected, normalized schema working
- Backend: Builds ✅
- Frontend: 140 TypeScript errors ❌
- Main issue: `direction` → `transaction_type` rename not complete in frontend

**Issues Found:**
- Clean slate migration (100) conflicted with incremental approach
- `direction` vs `transaction_type` column naming confusion in frontend
- Routes not updated before column stripping (historical)
- Field mapping audit tool run without permission (historical)

### December 8, 2025 - Session: TypeScript Error Resolution
**Agent:** Claude Opus 4.5
**Work Done:**
1. Fixed 140+ TypeScript errors in frontend
2. Resolved `direction` → `transaction_type` rename inconsistencies
3. Fixed type import issues (`ReactNode`, `Transaction`, etc.)
4. Added missing `contract_line_id` to `ProductLine` interface
5. Extended `Badge` component to support `orange` and `amber` colors
6. Fixed `AuditLogViewer` to support both inline and modal modes
7. Fixed `formatNumber` to accept optional decimals parameter
8. Resolved JSONB property access issues in `ContractDetailPage`
9. Removed duplicate object keys in `FieldHighlighter` and `FieldMappingManager`
10. Fixed `CustomsClearingCostsPage` type assertions

**Results:**
- Critical type errors: 0 ✅
- Remaining warnings: 37 (unused imports - don't affect runtime)
- Database: All schemas and views intact ✅
- Branch filtering: Properly implemented ✅

**Status Summary:**
- Frontend: Can build with warnings only
- Backend: Builds ✅
- Database: Properly normalized with views

### December 8, 2025 - Session: Warning Cleanup
**Agent:** Claude Opus 4.5
**Work Done:**
Cleaned up all 37 remaining TypeScript warnings (unused imports/variables) across 27 files:

**Files Fixed:**
1. `DeliveryPaymentTerms.tsx` - Removed unused `BanknotesIcon`
2. `ContractUpdateRequestModal.tsx` - Removed unused `isRtl`
3. `Step4ProductLines.tsx` - Removed unused `getQuantityForPricing` and `updateLineField`
4. `FileFirstCostEntry.tsx` - Removed unused `TruckIcon`, `CurrencyDollarIcon`
5. `PendingClearancesTable.tsx` - Removed unused `LinkIcon` and `getStatusBadge`
6. `NewTransactionWizard.tsx` - Removed unused `handleProceedFromInitialQuestion` and `totalSteps`
7. `OutboundDeliveriesTable.tsx` - Removed unused `isRTL` and `isNewDelivery`
8. `TransportCompanySelect.tsx` - Removed unused `BuildingOfficeIcon` and `TransportCompany`
9. `ExcelImportModal.tsx` - Removed unused `data` param
10. `ProductDetailPanel.tsx` - Removed unused `ProductDetail` type
11. `ProductFormModal.tsx` - Removed unused `DocumentTextIcon` and `ProductSpecs`
12. `DemurrageStatusBadge.tsx` - Removed unused `status` parameter
13. `Step2ProductLines.tsx` - Removed unused `getQuantityForPricing`
14. `Step4Logistics.tsx` - Removed unused `DemurrageStatusBadge`
15. `useAccounting.ts` - Removed unused `InventoryTransactionRow`
16. `useLandTransport.ts` - Removed unused `fetchTransportCompanyById`
17. `AccountingPage.tsx` - Removed unused `saveInvoiceMutation` and `useSaveInvoice`
18. `CustomsClearingCostsPage.tsx` - Removed unused `handleEdit` and `handleAddNew`
19. `UsersPage.tsx` - Removed unused `t` from destructuring
20. `customsClearingCostsService.ts` - Removed unused `PendingClearanceShipment`
21. `invoice.ts` - Removed unused `language` parameter
22. `landTransportService.ts` - Removed unused `ReadyForDeliveryShipment`
23. `financeSearchParser.ts` - Removed unused keyword constants and `from` variable
24. `format.ts` - Removed unused `locale` parameter
25. `pdfGenerator.ts` - Removed unused `imgHeight`

**Results:**
- TypeScript errors: 0 ✅
- TypeScript warnings: 0 ✅
- Build: Fully clean ✅

### December 8, 2025 - Session: Edit Shipment Wizard Data Import Fix
**Agent:** Claude Opus 4.5
**Work Done:**

#### Problem Summary
When editing a shipment that was created from a contract, the Edit Shipment Wizard was not importing:
1. Product lines from the contract
2. Contract data for other wizard steps (Commercial Terms, Logistics, Banking)
3. Final Destination delivery place was not properly selecting in dropdown
4. Shipment update failed with `column "name_en" does not exist` error

#### Fixes Applied

**1. Product Lines Import Fix** (`EditShipmentWizard.tsx`)
- Added fallback logic to fetch contract data when shipment has a `contract_id` but empty `lines`
- Fixed `contractsService.getById` → `contractsService.getContract` method name
- Added normalization for imported contract lines

**2. Contract Data Import for All Steps** (`EditShipmentWizard.tsx`)
- Updated the contract fallback fetch to import data for all wizard steps:
  - **Step 3 (Commercial Terms):** `incoterms`, `currency_code`, `cargo_type`, `tanker_type`, `container_count`, `weight_ton`, `barrels`, `payment_terms`, `payment_method`
  - **Step 4 (Logistics):** `pol_id`, `pod_id`, `etd`
  - **Step 5 (Banking):** `beneficiary_name`, `beneficiary_bank_name`, `beneficiary_account_number`, `beneficiary_iban`, `beneficiary_bank_address`, `beneficiary_swift_code`, `has_final_destination`, `final_destination`
- Data is correctly extracted from contract's nested `terms`, `shipping`, and `banking_docs` objects

**3. Final Destination Dropdown Fix** (`Step1BasicInfo.tsx`)
- The delivery place dropdown was using `warehouse_id` to select values, but database only stored `delivery_place` (text)
- Updated the dropdown's `value` logic to:
  1. First try `warehouse_id` if available
  2. Fall back to searching for a warehouse whose name matches the saved `delivery_place` text

```typescript
value={
  formData.final_destination?.warehouse_id || 
  (formData.final_destination?.delivery_place && formData.final_destination?.branch_id
    ? branchesData?.branches
        .filter(b => b.parent_id === formData.final_destination?.branch_id)
        .find(w => 
          w.name === formData.final_destination?.delivery_place || 
          w.name_ar === formData.final_destination?.delivery_place
        )?.id || ''
    : ''
  )
}
```

**4. `name_en` Column Error Fix** (`app/src/routes/shipments.ts`)
- The `resolveOrCreatePort` function was referencing a non-existent `name_en` column in `master_data.ports` table
- Removed `name_en` references from:
  - SELECT query (port lookup by name)
  - INSERT query (port creation)

```typescript
// BEFORE (broken):
WHERE LOWER(name) = LOWER($1) OR LOWER(COALESCE(name_en, '')) = LOWER($1)
INSERT INTO master_data.ports (name, name_en) VALUES ($1, $1)

// AFTER (fixed):
WHERE LOWER(name) = LOWER($1)
INSERT INTO master_data.ports (name) VALUES ($1)
```

**Files Modified:**
| File | Changes |
|------|---------|
| `vibe/src/components/shipments/EditShipmentWizard.tsx` | Contract data import for all wizard steps |
| `vibe/src/components/shipments/wizard/Step1BasicInfo.tsx` | Final destination dropdown value matching |
| `app/src/routes/shipments.ts` | Removed `name_en` column references |

**Results:**
- Edit Shipment Wizard now imports all contract data ✅
- Final Destination dropdown correctly selects saved delivery place ✅
- Shipment update works without `name_en` error ✅
- All contract-linked data is preserved when editing ✅

### December 8, 2025 - Session: Complete Shipment Data Normalization
**Agent:** Claude Opus 4.5
**Work Done:**

Migrated shipment lines, containers, and batches from JSONB columns to normalized relational tables.

#### Changes Made

**1. Database Migration** (`app/src/db/migrations/104_normalize_shipment_data.sql`)
- Created `logistics.shipment_batches` table with proper indexes and triggers
- Added missing columns to `shipment_lines` table (rate_usd_per_mt, volume_cbm, etc.)
- Migrated existing JSONB data from `shipment_cargo.lines/containers/batches` to normalized tables
- Updated `logistics.v_shipments_complete` view to aggregate from normalized tables
- Updated `report.contract_shipment_comparison` view to use `shipment_lines` table
- Dropped JSONB columns from `shipment_cargo` (lines, containers, batches)

**2. Backend Route Updates** (`app/src/routes/shipments.ts`)
- Updated PUT `/api/shipments/:id` to write to normalized tables (delete + insert pattern)
- Updated POST `/api/shipments` to insert into normalized tables
- Removed lines/containers/batches from JSONB field mapping

**3. Frontend Type Updates** (`vibe/src/components/shipments/wizard/types.ts`)
- Enhanced `ProductLine` interface with all normalized table columns
- Enhanced `ContainerDetail` interface with all normalized table columns
- Added shipment_id, extra_json, timestamps, and audit fields

**Database Schema Changes:**
| Table | Status |
|-------|--------|
| `logistics.shipment_lines` | Now used (was empty, migrated 5 rows) |
| `logistics.shipment_containers` | Now used (was empty, migrated 5 rows) |
| `logistics.shipment_batches` | Created (new table) |
| `logistics.shipment_cargo.lines` | DROPPED |
| `logistics.shipment_cargo.containers` | DROPPED |
| `logistics.shipment_cargo.batches` | DROPPED |

**Results:**
- All shipment product lines stored in normalized `shipment_lines` table ✅
- All container details stored in normalized `shipment_containers` table ✅
- Batch data ready for normalized `shipment_batches` table ✅
- View aggregates normalized data into JSON for frontend compatibility ✅
- No more JSONB columns for lines/containers/batches ✅

### December 11, 2025 - Session: Shipments API Bug Fixes & E2E Testing
**Agent:** Claude Opus 4.5
**Work Done:**

Fixed 12 failing fields in the Shipments API identified by E2E testing and resolved a critical date timezone bug.

#### Shipments API Missing Fields Fixed (`app/src/routes/shipments.ts`)
Added the following fields to their respective INSERT statements:

| Field | Table | Status |
|-------|-------|--------|
| `has_sales_contract` | `logistics.shipments` | ✅ Fixed |
| `has_broker` | `logistics.shipment_parties` | ✅ Fixed |
| `broker_name` | `logistics.shipment_parties` | ✅ Fixed |
| `cargo_type` | `logistics.shipment_cargo` | ✅ Fixed |
| `lines` | `logistics.shipment_cargo` | ✅ Fixed |
| `is_split_shipment` | `logistics.shipment_cargo` | ✅ Fixed |
| `batches` | `logistics.shipment_cargo` | ✅ Fixed |
| `etd` | `logistics.shipment_logistics` | ✅ Fixed |
| `vessel_name` | `logistics.shipment_logistics` | ✅ Fixed |
| `incoterms` | `logistics.shipment_logistics` | ✅ Fixed |
| `payment_method` | `logistics.shipment_financials` | ✅ Fixed |
| `lc_number` | `logistics.shipment_financials` | ✅ Fixed |

#### Date Timezone Bug Fixed (`app/src/db/client.ts`)
**Problem:** Dates like `eta` and `etd` were being stored 1 day earlier than sent (e.g., sent "2025-02-15", stored "2025-02-14").

**Root Cause:** Node.js `pg` driver converts PostgreSQL DATE types to JavaScript Date objects, which causes timezone conversion issues (server was in Asia/Riyadh timezone, UTC+3).

**Solution:** Added type parsers to return raw date strings instead of JS Date objects:
```typescript
import { Pool, types } from 'pg';

// Override default date parsers to prevent timezone conversion
types.setTypeParser(1082, (val: string) => val); // DATE
types.setTypeParser(1114, (val: string) => val); // TIMESTAMP without timezone
types.setTypeParser(1184, (val: string) => val); // TIMESTAMP with timezone
```

#### E2E Test Results
- **Before fixes:** 73.9% pass rate (12 failures)
- **After fixes:** 100% pass rate (56/56 fields passing)

**Files Modified:**
| File | Changes |
|------|---------|
| `app/src/routes/shipments.ts` | Added 12 missing fields to INSERT statements |
| `app/src/db/client.ts` | Added DATE/TIMESTAMP type parsers |
| `tools/field-mapping-e2e-test.ts` | Enhanced comparison logic for numeric strings |

---

### December 11, 2025 - Session: JWT Token Expiry Diagnosis
**Agent:** Claude Opus 4.5
**Work Done:**

Diagnosed E-Fatura page 403 Forbidden errors.

#### Problem
All requests to `/api/e-fatura/pending` were returning 403 Forbidden errors with "Request failed with status code 40" in the console.

#### Root Cause
JWT tokens were expired. Added logging to `app/src/middleware/auth.ts` which confirmed:
```
JWT verification failed: jwt expired Token prefix: eyJhbGciOiJIUzI1NiIs
```

#### Resolution
User needs to **log out and log back in** to get a fresh JWT token. This is normal security behavior - tokens expire and require re-authentication.

#### Logging Added (`app/src/middleware/auth.ts`)
```typescript
} catch (error) {
  console.error('JWT verification failed:', (error as Error).message, 'Token prefix:', token.substring(0, 20));
  return res.status(403).json({
    error: 'Forbidden',
    message: 'Invalid or expired token',
  });
}
```

---

### December 11, 2025 - Session: Internal Transportation Route Display Fix
**Agent:** Claude Opus 4.5
**Work Done:**

Fixed incorrect route display in the internal transportation table (حركة البضاعة / inventory transactions) on the Accounting page.

#### Problem
The route column (المسار) was displaying incorrect data like "Mersin → Vietnam" where:
- Mersin = POD (Port of Discharge) - ✅ Correct
- Vietnam = Final Destination - ❌ Wrong (was showing origin country instead of actual delivery place)

#### Root Cause
The SQL query in `app/src/routes/accounting.ts` used this COALESCE pattern:
```sql
COALESCE(s.final_destination->>'delivery_place', s.final_destination->>'place', s.final_destination->>'address')
```

The `final_destination->>'place'` field contained the **origin country** ("Vietnam") instead of the actual delivery location, causing the route to show origin information instead of destination.

#### Fix Applied (`app/src/routes/accounting.ts`)
Updated the `final_destination_place` SELECT to use more appropriate fallback fields:

```sql
-- BEFORE (broken):
COALESCE(s.final_destination->>'delivery_place', s.final_destination->>'place', s.final_destination->>'address')

-- AFTER (fixed):
COALESCE(
  s.final_destination->>'delivery_place',  -- Primary: actual delivery location
  NULLIF(s.final_destination->>'name', ''),  -- Fallback: destination name (warehouse/company)
  sp.final_beneficiary_name,                 -- Fallback: final beneficiary from shipment parties
  s.final_beneficiary_name,                  -- Fallback: final beneficiary from shipment
  s.final_destination->>'address'            -- Last resort: address
)
```

Also updated the `final_owner` field to use inline JSON access instead of the removed LATERAL join:
```sql
-- BEFORE:
COALESCE(sp.final_beneficiary_name, s.final_beneficiary_name, fd.name) AS final_owner

-- AFTER:
COALESCE(sp.final_beneficiary_name, s.final_beneficiary_name, s.final_destination->>'name') AS final_owner
```

Removed the now-unused LATERAL join that was previously extracting `fd.name`.

**Results:**
- Route now correctly shows "POD → Final Destination" (e.g., "Mersin → Baghdad" or "Mersin → [warehouse name]") ✅
- Avoids the problematic `place` field that contained origin country ✅
- Falls back to useful alternatives (beneficiary name, destination name) when delivery_place is empty ✅

---

### December 9, 2025 - Session: Contract Lines Normalization Complete
**Agent:** Claude Opus 4.5
**Work Done:**

Completed the contract lines normalization that was identified as a priority issue in the previous session.

#### Changes Made

**1. Backend Route Updates** (`app/src/routes/contracts.ts`)
- Removed `lines` from the INSERT column list for `contract_products` (both CREATE and UPDATE paths)
- Removed `JSON.stringify(lines || [])` parameter from both INSERT queries
- Removed `lines = EXCLUDED.lines` from the ON CONFLICT UPDATE clause
- The `contract_lines` table inserts were already correct - no changes needed there

**2. Database Migration** (`app/src/db/migrations/105_normalize_contract_lines.sql`)
- Updated `logistics.v_contracts_complete` view to aggregate lines from `contract_lines` table using COALESCE and jsonb_agg
- Both `contract_lines` and `product_lines` columns now return the same aggregated data from the normalized table
- Dropped the redundant `lines` JSONB column from `contract_products` table
- Added migration record to `security.migrations`

**Database Schema Changes:**
| Table | Status |
|-------|--------|
| `logistics.contract_products.lines` | DROPPED ✅ |
| `logistics.contract_lines` | Now PRIMARY storage ✅ |
| `logistics.v_contracts_complete` | Updated to aggregate from contract_lines ✅ |

**Results:**
- Contract product lines stored ONLY in normalized `contract_lines` table ✅
- No more duplicate JSONB storage ✅
- View correctly aggregates 3 lines for test contract 288HVTR25 ✅
- Backend compiles without errors ✅
- Frontend displays contracts correctly ✅

---

### December 12, 2025 - Session: Route Display & RTL Arrow Fixes
**Agent:** Claude Opus 4.5
**Work Done:**

Fixed route display across multiple pages to show correct **POD → Final Destination** format with RTL-aware arrow direction.

#### 1. E-Fatura Container Display Fix

**Problem:** E-Fatura page didn't show Internal Transport section for shipments with containers but no outbound deliveries.

**Solution:** Updated API and frontend to show containers even when no formal deliveries exist.

**Files Modified:**
| File | Changes |
|------|---------|
| `app/src/routes/efatura.ts` | Added `containers` and `container_count` to API response |
| `vibe/src/services/efatura.ts` | Added `EFaturaContainer` interface, updated `EFaturaShipment` type |
| `vibe/src/components/efatura/EFaturaCard.tsx` | Added `ContainerCard` component, show containers when no deliveries |

**Results:**
- E-Fatura shows containers (amber) when no deliveries assigned ✅
- Shows deliveries (blue) when they exist ✅
- Shows "No internal transportation" only when neither exist ✅

---

#### 2. Customs Clearing Costs - Pending Section Route Fix

**Problem:** Route column showed "POL → POD" instead of "POD → Final Destination".

**Solution:** Updated backend to return `final_destination_name` and frontend to construct route correctly.

**Files Modified:**
| File | Changes |
|------|---------|
| `app/src/routes/customsClearingCosts.ts` | Added `final_destination_name` and `final_destination_branch_id` to query |
| `vibe/src/types/api.ts` | Added fields to `PendingClearanceShipment` interface |
| `vibe/src/components/customs/PendingClearancesTable.tsx` | Changed route from POL→POD to POD→Final Destination, added RTL arrow support |

**Results:**
- Route now shows POD → Final Destination ✅
- Arrow flips based on UI language (← for RTL, → for LTR) ✅

---

#### 3. Internal Transport (Accounting Page) Route Fix

**Problem:** Route was pre-built in backend with hardcoded "→" arrow.

**Solution:** Send `pod` and `final_destination_place` separately, let frontend construct route with correct arrow.

**Files Modified:**
| File | Changes |
|------|---------|
| `app/src/routes/accounting.ts` | Changed from sending `route` to sending `pod` + `final_destination_place` separately |
| `vibe/src/services/accounting.ts` | Changed `route` to `final_destination_place` in `InventoryTransactionRow` |
| `vibe/src/pages/AccountingPage.tsx` | Construct route dynamically with RTL-aware arrow |

**Results:**
- Route shows POD → Final Destination ✅
- Arrow flips correctly based on language ✅

---

#### 4. Land Transport Page Route Fix

**Problem:** Route showed "POL → POD" (e.g., "Vietnam → Mersin") instead of "POD → Final Destination".

**Solution:** Added `final_destination_place` to API and updated frontend display.

**Files Modified:**
| File | Changes |
|------|---------|
| `app/src/routes/landTransport.ts` | Added `final_destination_place` to ready-for-delivery query |
| `vibe/src/types/api.ts` | Added `final_destination_place` to `ReadyForDeliveryShipment` |
| `vibe/src/components/land-transport/ReadyForDeliveryTable.tsx` | Changed route to POD→Final Destination, added RTL arrow support |

**Results:**
- Route now shows POD → Final Destination (e.g., "Mersin → مستودع حلب 2") ✅
- Arrow flips based on UI language ✅

---

#### Summary of RTL Arrow Implementation

All route displays now use this pattern:
```tsx
const isRtl = i18n.language === 'ar';
// ...
<span>{pod_name}</span>
<span>{isRtl ? '←' : '→'}</span>
<span>{final_destination_place}</span>
```

| Page | Before | After |
|------|--------|-------|
| Customs Clearing Costs | POL → POD | POD → Final Destination |
| Accounting (Inventory) | POD → (wrong place) | POD → Final Destination |
| Land Transport | POL → POD | POD → Final Destination |
| E-Fatura | (containers not shown) | Shows containers with weights |

All arrows now flip correctly:
- **English (LTR):** `Mersin → مستودع حلب 2`
- **Arabic (RTL):** `Mersin ← مستودع حلب 2`

---

### December 12, 2025 - Session: Main Data CSV Import & AutocompleteInput Fix
**Agent:** Claude Opus 4.5
**Work Done:**

#### 1. Main Data CSV Import Script (`tools/import-main-data.ts`)

Created a comprehensive import script to import the main business data from CSV into the normalized database structure.

**Features:**
- Dry-run mode for preview without database changes
- Transaction safety (all-or-nothing with rollback on error)
- Clears transactional data while keeping master data (ports, companies)
- Creates contracts with all normalized tables (contract_parties, contract_shipping, contract_terms, contract_products, contract_lines)
- Creates shipments with all normalized tables (shipment_parties, shipment_cargo, shipment_lines, shipment_logistics, shipment_financials, shipment_documents)
- Creates finance.transactions for paid amounts
- Creates finance.customs_clearing_costs for shipments with clearance dates
- Auto-creates ports and shipping companies if not found
- Handles multi-product continuation rows (combines into single shipment with multiple lines)
- Handles duplicate BL numbers by appending contract number or counter

**Import Results:**
| Entity | Count |
|--------|-------|
| Contracts | 58 |
| Contract Lines | 79 |
| Shipments | 82 |
| Shipment Lines | 91 |
| Finance Transactions | 43 |
| Ports Created | 19 |
| Shipping Companies Created | 15 |
| Beneficiary Companies Created | 1 |

**Usage:**
```bash
# Dry run (preview)
npx ts-node tools/import-main-data.ts --dry-run --file "data/Main import data .csv"

# Live import
npx ts-node tools/import-main-data.ts --file "data/Main import data .csv"
```

#### 2. AutocompleteInput Null Reference Fix

**Problem:** White screen when editing contracts/shipments, console showed:
```
Uncaught TypeError: Cannot read properties of null (reading 'length')
at useAutocomplete (useAutocomplete.ts:66:20)
```

**Root Cause:** The `useAutocomplete` hook received `null` for the `query` parameter when `inputValue` was undefined/null in `AutocompleteInput` component.

**Files Modified:**
| File | Changes |
|------|---------|
| `vibe/src/hooks/useAutocomplete.ts` | Added null/undefined handling: `query: string \| null \| undefined`, `const safeQuery = query ?? ''` |
| `vibe/src/components/common/AutocompleteInput.tsx` | Ensured `inputValue` always initialized as string: `useState(displayValue \|\| value \|\| '')` |

**Results:**
- Contract/shipment edit wizards no longer crash with white screen ✅
- Autocomplete fields handle null values gracefully ✅

---

### December 13, 2025 - Session: Document Filing System UI Components Complete
**Agent:** Claude Opus 4.5
**Work Done:**

Completed the pending Document Filing System UI components that were outlined in the previous session.

#### 1. DocumentUploadModal (`vibe/src/components/documents/DocumentUploadModal.tsx`)
Multi-file upload modal with:
- Drag & drop zone for file uploads
- Support for uploading multiple files at once
- Per-file document type selection with auto-detection from filename
- Draft/Final toggle for each file
- Progress indicator showing upload status per file
- Retry functionality for failed uploads

#### 2. DocumentPermissionsModal (`vibe/src/components/documents/DocumentPermissionsModal.tsx`)
Per-document access control modal with:
- View current permissions for a document
- Add permission by: user, branch, or role
- Permission levels: view, download, edit, delete, manage
- Remove existing permissions
- Uses existing API endpoints: `GET/POST/DELETE /api/documents/:id/permissions`

#### 3. DocumentsPage (`vibe/src/pages/DocumentsPage.tsx`)
Central documents browser with:
- List all documents with pagination
- Filters: document type, status (draft/final), sort options
- Search by filename
- Bulk selection and actions (download selected, delete selected)
- Click to download or manage permissions
- Route added: `/documents`

#### 4. Detail Page Integration
Integrated DocumentPanel into:
- `ShipmentDetailPage.tsx` - Shows documents for the shipment
- `ContractDetailPage.tsx` - Shows documents for the contract

Both pages now display an interactive document panel with:
- Upload new documents
- Download existing documents
- Delete documents
- Documents grouped by type

#### Files Created/Modified

**New Files:**
| File | Purpose |
|------|---------|
| `vibe/src/components/documents/DocumentUploadModal.tsx` | Multi-file upload modal |
| `vibe/src/components/documents/DocumentPermissionsModal.tsx` | Permissions management modal |
| `vibe/src/pages/DocumentsPage.tsx` | Central documents browser page |

**Modified Files:**
| File | Changes |
|------|---------|
| `vibe/src/components/documents/index.ts` | Added exports for new modals |
| `vibe/src/App.tsx` | Added `/documents` route |
| `vibe/src/pages/ShipmentDetailPage.tsx` | Replaced old documents section with DocumentPanel |
| `vibe/src/pages/ContractDetailPage.tsx` | Added DocumentPanel for contract documents |

#### Build Results
- ✅ Frontend compiles without errors
- ✅ Backend compiles without errors

---

### December 12, 2025 - Session: Estimated Shipping Date Display Fix
**Agent:** Claude Opus 4.5
**Work Done:**

Fixed contract list page showing stale `estimated_shipment_date` values after editing via the wizard.

#### Problem
After updating a contract's "Estimated Shipping Date" via the Contract Edit Wizard:
- **Edit Wizard:** Showed correct updated value (February 2026) ✅
- **Contracts List:** Showed stale old value (January 2026) ❌

#### Root Cause: Data Migration Inconsistency
During database normalization, `estimated_shipment_date` moved from JSONB to a normalized table:

| Location | Old (Legacy) | New (Normalized) |
|----------|--------------|------------------|
| Storage | `contracts.extra_json->'shipping'->>'estimated_shipment_date'` | `contract_shipping.estimated_shipment_date` |
| Type | Text inside JSONB | Proper DATE column |

The **contracts list endpoint** was still reading from the old `extra_json` location while:
- The **single contract endpoint** (GET `/contracts/:id`) - ✅ Reads from `contract_shipping`
- The **update endpoint** (PUT `/contracts/:id`) - ✅ Writes to `contract_shipping`

This meant old values in `extra_json` were never updated when editing, causing a read/write mismatch.

#### Fix Applied (`app/src/routes/contracts.ts`)

Changed the list query from reading `extra_json` to joining with `contract_shipping`:

```sql
-- BEFORE (broken - reading from stale JSONB):
SELECT 
  c.*,
  c.extra_json->'shipping'->>'estimated_shipment_date' as estimated_shipment_date,
  ...
FROM logistics.contracts c

-- AFTER (fixed - reading from normalized table):
SELECT 
  c.*,
  cs.estimated_shipment_date,
  ...
FROM logistics.contracts c
LEFT JOIN logistics.contract_shipping cs ON cs.contract_id = c.id
```

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/routes/contracts.ts` | Changed contracts list query to read `estimated_shipment_date` from `contract_shipping` table instead of `extra_json` JSONB |

#### Results
- Contracts list now shows correct `estimated_shipment_date` from normalized table ✅
- Consistent data between list view, detail view, and edit wizard ✅
- No more stale JSONB values displayed ✅

#### Lesson Learned
When normalizing database schema (moving from JSONB to relational tables), ensure **ALL read paths** are updated, not just:
- Write paths (INSERT/UPDATE)
- Single record reads (GET by ID)

List/search endpoints often have their own queries that need updating too.

### December 16, 2025 - Session: Document Storage Path Fix
**Agent:** Claude Opus 4.5
**Work Done:**

Fixed document storage path issue where uploaded files were not being stored in the correct location or properly renamed.

#### Problem
When uploading documents through the DocumentPanel (e.g., on ShipmentDetailPage):
1. Files were uploaded successfully (200 response)
2. Database record showed correct renamed filename and path
3. But actual file was stored in wrong location with original name

#### Root Cause
The `DOCUMENTS_PATH` in `app/src/services/fileStorage.ts` was set as a relative path (`./storage/documents`), which resolved relative to where the Node process was started (`app/dist/`), not the project root.

#### Fix Applied (`app/src/services/fileStorage.ts`)
Changed from relative to absolute path:
```typescript
// BEFORE (incorrect):
const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || './storage/documents';

// AFTER (correct):
const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || path.resolve(__dirname, '../../storage/documents');
```

The `path.resolve(__dirname, '../../storage/documents')` correctly resolves from `app/dist/services/` up to project root's `storage/documents/`.

#### Document Upload in Wizards - Status Check
| Wizard | Has Document Upload | Details |
|--------|---------------------|---------|
| NewShipmentWizard | ✅ Yes | Step 5 allows document selection, uploads after shipment creation |
| EditShipmentWizard | ✅ Yes | New documents uploaded after shipment update |
| ContractWizard | ❌ No (by design) | Documents are primarily tied to shipments. The proforma invoice is uploaded when creating the shipment, not the contract |

**Design Decision:** Contract Wizard intentionally does NOT have document upload because:
1. At contract phase, only the proforma invoice exists
2. Documents (BL, COO, PL, etc.) are generated during shipment phase
3. Users can upload contract-related documents via ContractDetailPage's DocumentPanel if needed

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/services/fileStorage.ts` | Changed `DOCUMENTS_PATH` to use absolute path |

#### Results
- Documents now stored in correct location: `/storage/documents/{entity_type}/{year}/{ref}/docs/` ✅
- Files renamed correctly: `{doctype}_{date}_{original}.ext` ✅
- Backend rebuilt and restarted ✅

---

### December 13, 2025 - Session: Document Filing System Implementation
**Agent:** Claude Opus 4.5
**Work Done:**

Implemented a comprehensive document filing system with local filesystem storage, structured naming, versioning, and per-document permissions.

#### 1. Database Migration (`app/src/db/migrations/110_documents_system.sql`)
- Enhanced `archive.documents` table with new columns:
  - `transaction_id`, `company_id`, `customs_batch_id` - Links to other entities
  - `version`, `is_draft`, `replaced_by` - Versioning support
  - `original_filename`, `notes` - Metadata
  - `is_deleted`, `deleted_at`, `deleted_by` - Soft delete
- Created `archive.document_permissions` table for per-document access control
- Created `archive.document_folders` table for tracking folder structure
- Created `archive.v_documents_complete` view for querying

#### 2. Backend File Storage Service (`app/src/services/fileStorage.ts`)
- Path building: `/storage/documents/{entity_type}/{year}/{ref}/docs/`
- Structured file naming: `{doctype}_{date}_{original}.pdf` (e.g., `BL_2025-12-13_bill_of_lading.pdf`)
- Version archiving: Old versions moved to `/archive/` subfolder with version suffix
- Contract-shipment symlinks: When uploading to a shipment linked to a contract, creates symlink in contract folder
- Helper functions: `saveFile`, `archiveDocument`, `deleteFile`, `getEntityRef`, etc.

#### 3. Documents API (`app/src/routes/documents.ts`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List documents with filters |
| `/api/documents` | POST | Upload single document |
| `/api/documents/bulk` | POST | Multi-file upload |
| `/api/documents/:id` | GET | Get document metadata |
| `/api/documents/:id/download` | GET | Download file |
| `/api/documents/:id` | PUT | Update metadata/replace file |
| `/api/documents/:id` | DELETE | Soft delete |
| `/api/documents/:id/permissions` | GET/POST/DELETE | Manage access |

#### 4. Frontend Documents Service (`vibe/src/services/documents.ts`)
- Complete TypeScript API client with types for all operations
- Helper functions: `getDocumentTypeName`, `formatFileSize`, `getDocumentTypeIcon`
- Support for 27+ document types (PI, CI, BL, COO, etc.)

#### 5. Shipment Wizard Integration (FIXED - Documents Now Save!)
**Before:** Documents selected in Step 5 were stored in memory and lost when shipment was saved.
**After:** Documents are now uploaded to the filing system after shipment creation.

**Files Modified:**
- `vibe/src/components/shipments/NewShipmentWizard.tsx` - Added document upload after `createShipment()`
- `vibe/src/components/shipments/EditShipmentWizard.tsx` - Added document upload after `updateShipment()`

#### 6. E-Fatura Integration (FIXED - File Upload Now Works!)
**Before:** Line 99 had `// TODO: If file is provided, upload it first`
**After:** E-Fatura documents are now uploaded with type `e_fatura` when marking complete.

**File Modified:** `vibe/src/pages/EFaturaPage.tsx`

#### 7. DocumentPanel Component (`vibe/src/components/documents/DocumentPanel.tsx`)
Inline document viewer component for detail pages:
- Shows documents grouped by type
- Upload new documents with type selection
- Download and delete functionality
- Compact and full view modes

#### Storage Folder Structure Created
```
/storage/documents/
├── shipments/
│   └── {year}/{sn}/docs/
├── contracts/
│   └── {year}/{contract_no}/docs/
├── finance/
│   └── {year}/{ref}/docs/
├── customs/
│   └── {year}/{batch_name}/docs/
└── companies/
    └── {company_name}/docs/
```

**Files Created:**
| File | Purpose |
|------|---------|
| `app/src/db/migrations/110_documents_system.sql` | Database schema changes |
| `app/src/services/fileStorage.ts` | File storage service |
| `app/src/routes/documents.ts` | Documents API endpoints |
| `vibe/src/services/documents.ts` | Frontend API service |
| `vibe/src/components/documents/DocumentPanel.tsx` | Inline document viewer |
| `vibe/src/components/documents/index.ts` | Component exports |

**Results:**
- Backend compiles ✅
- Frontend compiles ✅
- Storage directory created at `/storage/documents/` ✅
- Migration applied to database ✅

---

### December 16, 2025 - Session: Route Management & Border Crossing System
**Agent:** Claude Opus 4.5
**Work Done:**

Implemented a comprehensive route management system to handle:
1. **International Route:** POL (Port of Loading) → POD (Port of Discharge)
2. **Internal Route:** POD → Final Destination (may cross land border)

#### Phase 1: Database Schema Changes

**Migration:** `app/src/db/migrations/115_route_border_system.sql`

| Table | Changes |
|-------|---------|
| `master_data.border_crossings` | NEW - Border crossing master data with seed data (Habur, Oncupinar, Cilvegözü, Nusaybin, Kapikule, Ibrahim Khalil) |
| `finance.customs_clearing_costs` | Added `border_crossing_id`, `stage_order`, `arrival_date`, `clearance_date`, `assigned_to_user_id`, `clearance_status` |
| `logistics.shipment_logistics` | Added `is_cross_border`, `primary_border_crossing_id`, `transit_countries`, `internal_transport_mode` |
| `logistics.v_shipments_complete` | Updated to include new route fields with border crossing JOIN |

#### Phase 2: Backend API

**New File:** `app/src/routes/borderCrossings.ts`
- `GET /api/border-crossings` - List all with filters
- `GET /api/border-crossings/:id` - Get single
- `POST /api/border-crossings` - Create (admin only)
- `PUT /api/border-crossings/:id` - Update (admin only)
- `DELETE /api/border-crossings/:id` - Delete/deactivate (admin only)
- `GET /api/border-crossings/by-route/:country_from/:country_to` - Get by route

**Extended:** `app/src/routes/customsClearingCosts.ts`
- `GET /api/customs-clearing-costs/my-assignments` - Field agent assignments
- `PATCH /api/customs-clearing-costs/:id/status` - Update clearance status
- Updated create/update to include border crossing fields

**Updated:** `app/src/validators/customsClearingCost.ts`
- Added validation for `border_crossing_id`, `stage_order`, `arrival_date`, `clearance_date`, `assigned_to_user_id`, `clearance_status`

#### Phase 3: Frontend - Route Display Updates

| File | Changes |
|------|---------|
| `vibe/src/pages/ShipmentDetailPage.tsx` | Added "Route Information" section with International Route and Internal Route |
| `vibe/src/types/api.ts` | Added route fields (`is_cross_border`, `primary_border_crossing_id`, `primary_border_name`, etc.) and `final_destination` type |

#### Phase 4: Shipment Wizard Updates

| File | Changes |
|------|---------|
| `vibe/src/components/shipments/wizard/Step4Logistics.tsx` | Added Internal Route section with transport mode and border crossing selection |
| `vibe/src/components/shipments/wizard/types.ts` | Added route fields to wizard form data |
| `vibe/src/components/common/AutocompleteInput.tsx` | Added `borderCrossing` type support |
| `vibe/src/hooks/useAutocomplete.ts` | Added border crossing API integration |

#### Phase 5: Mobile Border Agent Interface

**New Files:**
- `vibe/src/pages/BorderAgentPage.tsx` - Mobile-first responsive page for field agents
  - Large touch-friendly shipment cards
  - Status progression buttons (Arrived → In Progress → Cleared)
  - Quick cost entry modal (bottom sheet on mobile)
  - Filter by clearance status
  - Summary stats header

**Features:**
- Cards show shipment info, route (POD → Border → FD), weight, containers
- One-tap status updates
- Cost entry with large numeric input
- Filter by pending/arrived/in_progress/cleared
- Bilingual support (EN/AR)

#### Phase 6: Admin UI

**New Files:**
- `vibe/src/pages/BorderCrossingsPage.tsx` - Admin management page
- `vibe/src/services/borderCrossings.ts` - Frontend API service
- `vibe/src/hooks/useBorderCrossings.ts` - React Query hooks

**Features:**
- List border crossings grouped by origin country
- Add/Edit/Delete with modal form
- Search and filter functionality
- Active/inactive status management

#### Phase 7: Analytics Integration

**Updated:** `vibe/src/pages/AnalyticsPage.tsx`
- Added "Route-Based Cost Analysis" section
- Cost breakdown by clearance type (POD vs Border)
- Detailed view by border crossing location
- Total, count, and average cost metrics

#### Updated Files Summary

| Category | Files |
|----------|-------|
| **Backend** | `borderCrossings.ts` (new), `customsClearingCosts.ts`, `customsClearingCost.ts` (validator), `index.ts` |
| **Frontend Pages** | `BorderAgentPage.tsx` (new), `BorderCrossingsPage.tsx` (new), `ShipmentDetailPage.tsx`, `AnalyticsPage.tsx` |
| **Frontend Components** | `Step4Logistics.tsx`, `AutocompleteInput.tsx`, `Sidebar.tsx` |
| **Frontend Services** | `borderCrossings.ts` (new), |
| **Frontend Hooks** | `useBorderCrossings.ts` (new), `useAutocomplete.ts` |
| **Types** | `api.ts`, `wizard/types.ts` |
| **Translations** | `en.json`, `ar.json` |
| **App Router** | `App.tsx` |
| **Database** | `115_route_border_system.sql` (new) |

**New Routes in App.tsx:**
- `/border-crossings` - Admin page (protected by `users` module)
- `/border-agent` - Field agent interface (protected by `shipments` module)

**Results:**
- Backend compiles ✅
- Frontend compiles ✅
- Migration applied ✅
- 6 border crossings seeded (Turkey borders with Iraq, Syria, Bulgaria) ✅

---

### December 19, 2025 - Session: FB Interface + Quality Incident System
**Agent:** Claude Opus 4.5
**Work Done:**

Implemented a comprehensive Final Beneficiary (Inventory) interface and Quality Incident reporting system.

#### Phase 1: Database Schema

**Migration:** `app/src/db/migrations/120_quality_incidents.sql`
- Created `logistics.quality_incidents` table
- Created `logistics.quality_sample_cards` table
- Created `logistics.quality_media` table
- Created `logistics.quality_review_actions` table
- Created `logistics.supplier_delivery_records` table
- Added `hold_status`, `hold_reason` to `logistics.shipments`
- Added `delivery_confirmed_at`, `delivery_confirmed_by` to `logistics.shipment_documents`
- Created `logistics.v_inventory_shipments` view
- Created `logistics.v_quality_incidents_complete` view

**Migration:** `app/src/db/migrations/121_incident_measurements.sql`
- Added measurement columns: `sample_weight_g`, `broken_g`, `mold_g`, `foreign_g`, `other_g`, `moisture_pct`, `total_defect_pct`
- Removed `issue_type` CHECK constraint to allow comma-separated values (multi-select)
- Updated `v_quality_incidents_complete` view with correct joins

#### Phase 2: Backend API

**New File:** `app/src/routes/inventory.ts`
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inventory/shipments` | GET | List shipments for user's branch with costs, sorting |
| `/api/inventory/shipments/:id` | GET | Get single shipment details |
| `/api/inventory/shipments/:id/delivered` | POST | Mark shipment as delivered |

**New File:** `app/src/routes/qualityIncidents.ts`
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/quality-incidents` | GET | List incidents (filtered by branch/status) |
| `/api/quality-incidents` | POST | Create incident (applies HOLD) |
| `/api/quality-incidents/:id` | GET | Get incident with samples and media |
| `/api/quality-incidents/:id` | PUT | Update incident |
| `/api/quality-incidents/:id/submit` | POST | Submit for review |
| `/api/quality-incidents/:id/media` | POST | Upload media (multer) |

**Static File Serving:** Added `/quality-media` static route for uploaded photos/videos

#### Phase 3: Frontend - Inventory Dashboard

**New Page:** `vibe/src/pages/InventoryDashboardPage.tsx`
- Mobile-first responsive design
- Large shipment cards with: SN, product, weight, containers, prices, origin, route, ETA
- Status badges (In Transit, Arrived, Received, etc.)
- Sorting options: Earliest/Latest ETA, Biggest/Smallest shipment, Highest/Lowest price, Newest/Oldest
- "Mark Delivered" button → Modal asks "Any quality issues?"
  - **No** → Confirms delivery + Records supplier success
  - **Yes** → Opens Quality Incident Wizard + HOLD applied
- "Continue Report" button for incomplete incidents
- "View Quality Report" button for submitted incidents

**New Service:** `vibe/src/services/inventory.ts`
**New Service:** `vibe/src/services/qualityIncidents.ts`

#### Phase 4: Quality Incident Wizard

**New Component:** `vibe/src/components/quality/QualityIncidentWizard.tsx`

**Wizard Steps:**
1. **Problem Type Selection** - Multi-select icons for: Mold, Broken, Moisture, Foreign Matter, Wrong Spec, Damaged
2. **Photo Capture** - 3 locations (Front, Middle, Back) with 3 photos each (9 total)
3. **Measurements** - Numeric inputs for defect weights (g), moisture %
4. **Container Condition** - Yes/No toggles (moisture, smell, torn bags, condensation)
5. **Summary & Submit** - Auto-generated stats, HOLD banner, submit button

**Key Features:**
- Supports multi-select problem types (e.g., "Moisture + Mold")
- Simplified sampling: 3 locations × 3 photos = 9 photos
- Camera capture with location watermarks
- Numeric keypad for measurements
- Auto-calculates defect percentages
- HOLD status automatically applied when incident created

**Read-Only Report View:**
- When viewing a submitted incident (not draft), shows read-only summary
- Status banner color-coded: blue=submitted, amber=under_review, purple=action_set, green=closed
- Displays issue types, measurements, photos gallery, container condition

**Sub-components:**
- `vibe/src/components/quality/ProblemTypeSelector.tsx` - Icon-based multi-select
- `vibe/src/components/quality/SampleCardForm.tsx` - Photo capture + weighing

#### Phase 5: Quality Review Page

**New Page:** `vibe/src/pages/QualityReviewPage.tsx`
- For Supervisor + HQ SCLM (Exec) roles
- Incident list with status filters
- Incident detail view with:
  - Shipment info (supplier, product, qty)
  - Issue type with severity indicator
  - HOLD status banner
  - Defect % summary (min/max/avg)
  - Media gallery
  - Timeline/audit trail
- Action buttons: Request Resampling, Keep HOLD, Clear HOLD, Close

#### Phase 6: Permissions & Routing

**Updated:** `vibe/src/contexts/PermissionContext.tsx`
- Added `inventory` module with permissions: `view`, `delivery`, `quality`
- Added `quality` module with permissions: `view`, `create`, `review`, `approve`

**Updated:** `vibe/src/App.tsx`
- `/inventory` - Inventory Dashboard (Inventory role)
- `/quality-incidents` - Quality Review Page (Exec, Admin roles)
- `/quality-incident/:id` - Quality Incident Wizard/View

**Updated:** `vibe/src/components/layout/Sidebar.tsx`
- Added "المستودع" (Inventory) menu item
- Added "مراجعة الجودة" (Quality Review) menu item

#### Phase 7: Translations

**Updated:** `vibe/src/i18n/en.json`, `vibe/src/i18n/ar.json`
- Added translations for inventory dashboard, quality wizard, and review page

#### Bug Fixes During Implementation

| Issue | Fix |
|-------|-----|
| `column total_packages does not exist` | Used `bags_count` from `shipment_cargo` |
| `column freight_cost does not exist` | Used `transportation_cost` from `shipment_financials` |
| `authenticate` not exported | Changed to `authenticateToken` |
| 404 on new API routes | Rebuilt backend and restarted server |
| 403 Forbidden on wizard submit | JWT token expired - user re-logged in |
| `issue_type` validation failed | Removed CHECK constraint, accept comma-separated values |
| `toFixed is not a function` | Wrapped NUMERIC fields with `Number()` |
| Wrong route for "View Report" | Changed `/quality-incidents/:id` to `/quality-incident/:id` |
| Status showing "Draft" for submitted | Added `action_set` status to display logic |

#### Files Created

| File | Purpose |
|------|---------|
| `app/src/db/migrations/120_quality_incidents.sql` | Main schema |
| `app/src/db/migrations/121_incident_measurements.sql` | Measurement columns |
| `app/src/routes/inventory.ts` | Inventory API |
| `app/src/routes/qualityIncidents.ts` | Quality Incidents API |
| `vibe/src/pages/InventoryDashboardPage.tsx` | FB Interface |
| `vibe/src/pages/QualityReviewPage.tsx` | Supervisor/HQ review |
| `vibe/src/components/quality/QualityIncidentWizard.tsx` | Multi-step wizard |
| `vibe/src/components/quality/ProblemTypeSelector.tsx` | Icon selector |
| `vibe/src/components/quality/SampleCardForm.tsx` | Sample evidence form |
| `vibe/src/services/inventory.ts` | Frontend API client |
| `vibe/src/services/qualityIncidents.ts` | Frontend API client |

#### Files Modified

| File | Changes |
|------|---------|
| `app/src/index.ts` | Registered new routes, added static file serving |
| `vibe/src/App.tsx` | Added routes |
| `vibe/src/contexts/PermissionContext.tsx` | Added inventory/quality modules |
| `vibe/src/components/layout/Sidebar.tsx` | Added menu items |
| `vibe/src/i18n/en.json` | English translations |
| `vibe/src/i18n/ar.json` | Arabic translations |

**Results:**
- Backend compiles ✅
- Frontend compiles ✅
- Inventory Dashboard functional ✅
- Quality Incident Wizard functional (multi-select, photo capture, measurements) ✅
- Read-only report view for submitted incidents ✅

---

### December 19, 2025 - Session: WiFi Sharing Improvements
**Agent:** Claude Opus 4.5
**Work Done:**

Improved WiFi sharing for colleague collaboration with dynamic CORS and simplified setup.

#### 1. Dynamic CORS Configuration (`app/src/index.ts`)

**Before:** Had to manually add each IP address to CORS whitelist:
```typescript
origin: [
  'http://localhost:5173',
  'http://192.168.1.75:5173',  // Hardcoded IP
]
```

**After:** Accepts any local network IP automatically:
```typescript
origin: (origin, callback) => {
  if (!origin) return callback(null, true);
  if (origin.includes('localhost') || origin.match(/^http:\/\/192\.168\.\d+\.\d+:\d+$/)) {
    return callback(null, true);
  }
  callback(new Error('Not allowed by CORS'));
},
```

#### 2. Frontend API Configuration (`vibe/.env`)
Updated to use current network IP:
```
VITE_API_BASE_URL=http://192.168.1.114:3000/api
```

#### 3. Fixed Hardcoded localhost in UsersPage (`vibe/src/pages/UsersPage.tsx`)
Changed hardcoded `http://localhost:3000/api` URLs to use environment variable:
```typescript
// Before
fetch('http://localhost:3000/api/auth/users', ...)

// After  
fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/auth/users`, ...)
```

#### 4. Created Test Account for Colleague
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "colleague", "password": "Welcome123!", "name": "Colleague", "role": "Admin"}'
```

#### Colleague Access URLs
| Service | URL |
|---------|-----|
| Frontend | http://192.168.1.114:5173 |
| Backend API | http://192.168.1.114:3000 |

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/index.ts` | Dynamic CORS for local network IPs |
| `vibe/.env` | Updated API URL to network IP |
| `vibe/src/pages/UsersPage.tsx` | Fixed hardcoded localhost URLs |

**Results:**
- Colleagues can access webapp from any device on same WiFi ✅
- No manual CORS editing needed when IP changes ✅
- Test account created for collaboration ✅

---

### December 19, 2025 - Session: Fresh Data Import v2.0
**Agent:** Claude Opus 4.5
**Work Done:**

Performed a clean slate data import with updated CSV files and enhanced import script.

#### Import Script v2.0 (`tools/import-main-data.ts`)

**New Features:**
- Two-file import mode: Contracts file + Shipments file
- Supplier column support (المورد) - column 2 in new CSV format
- Auto-create contracts for shipped shipments without existing contract
- Contract status logic: PENDING (from contracts file) vs ACTIVE (auto-created from shipments)
- Improved multi-product continuation row detection

**Usage:**
```bash
# Dry run (preview)
npx ts-node tools/import-main-data.ts --dry-run \
  --contracts-file "data/Main Import (1.0)/Contracts (to be shipped).csv" \
  --shipments-file "data/Main Import (1.0)/Shipments.csv"

# Live import
npx ts-node tools/import-main-data.ts \
  --contracts-file "data/Main Import (1.0)/Contracts (to be shipped).csv" \
  --shipments-file "data/Main Import (1.0)/Shipments.csv"
```

#### Import Results

| Entity | Count | Source |
|--------|-------|--------|
| Contracts (PENDING) | 70 | Contracts (to be shipped).csv |
| Contracts (ACTIVE) | 52 | Auto-created from Shipments.csv |
| Shipments | 77 | Shipments.csv |
| Contract Lines | 158 | Multi-product rows |
| Shipment Lines | 94 | Multi-product rows |
| Transactions | 44 | Paid shipments |
| Supplier Companies | 76 | Auto-created |
| Ports | 9 | Auto-created |

#### CSV Column Order (29 columns)
```
1. رقم → rowNum
2. المورد → supplierName (NEW!)
3. رقم العقد → contractNo
4. رقم الفاتورة → invoiceNo
5. الحالة → status
6-29. (same as before)
```

#### Files Modified
| File | Changes |
|------|---------|
| `tools/import-main-data.ts` | Complete rewrite for v2.0 with two-file support |

#### Data Files Used
- `data/Main Import (1.0)/Contracts (to be shipped).csv` - 89 rows → 70 pending contracts
- `data/Main Import (1.0)/Shipments.csv` - 95 rows → 77 shipments

**Results:**
- Clean slate import successful ✅
- All contracts properly categorized (PENDING vs ACTIVE) ✅
- Suppliers auto-created and linked ✅
- Multi-product rows correctly combined ✅

---

### December 20, 2025 - Session: E-Fatura Fix & UI Label Updates
**Agent:** Claude Opus 4.5
**Work Done:**

#### 1. E-Fatura Page 500 Error Fix

**Problem:** E-Fatura page was returning 500 Internal Server Errors with message:
```
column s.currency_code does not exist
```

**Root Cause:** The E-Fatura API query was referencing `s.currency_code` from the `v_shipments_complete` view, but this column is stored in the `shipment_financials` table and was not exposed in the view.

**Fix Applied (`app/src/routes/efatura.ts`):**
1. Added JOIN to `logistics.shipment_financials`:
   ```sql
   LEFT JOIN logistics.shipment_financials sf ON sf.shipment_id = s.id
   ```
2. Changed column reference from `s.currency_code` to:
   ```sql
   COALESCE(sf.currency_code, 'USD') AS currency_code
   ```

Applied to both `/pending` endpoint and `/:shipmentId` endpoint queries.

**Results:**
- E-Fatura page loads correctly ✅
- All pending shipments display with currency info ✅

#### 2. Contract Wizard Label Update

**Change:** Updated field label in Contract Wizard Step 2 (Shipping & Geography) from "Country of Final Destination" to "Country of Port of Discharge".

**Files Modified:**
| File | Changes |
|------|---------|
| `vibe/src/i18n/en.json` | `"countryOfDestination": "Country of Port of Discharge"` |
| `vibe/src/i18n/ar.json` | `"countryOfDestination": "بلد ميناء التفريغ"` |

**Results:**
- English label: "Country of Port of Discharge" ✅
- Arabic label: "بلد ميناء التفريغ" ✅

---

### December 20, 2025 - Session: Contract Wizard & List Improvements
**Agent:** Claude Opus 4.5
**Work Done:**

#### 1. Removed "Who is responsible for documents" Question

**Reason:** The supplier is always responsible for documents. Who the supplier is depends on the transaction direction:
- If we're **selling** (outgoing) → We are the supplier → We provide docs
- If we're **buying** (incoming) → The other party is the supplier → They provide docs

The `direction` field already captures this, making the responsibility question redundant.

**Files Modified:**
| File | Changes |
|------|---------|
| `vibe/src/components/contracts/wizard/Step5BankingDocs.tsx` | Removed yellow "Responsibility" section with radio buttons |
| `vibe/src/components/contracts/wizard/types.ts` | Removed `documentation_responsibility` from interface |
| `vibe/src/components/contracts/wizard/ContractWizard.tsx` | Removed `documentation_responsibility` initialization |

**Note:** Backend still stores the field for backward compatibility with existing contracts.

#### 2. Added Product Info to Contracts List Table

**New Columns Added:**
1. **Type of Goods** - Aggregated list of products from contract lines
2. **Quantity (MT)** - Total quantity in metric tons
3. **Price (USD)** - Total contract value (green color for visibility)

**Columns Removed (to make space):**
- Subject
- Signed At
- Currency

**New Filter Added:**
- **Product Filter** - Text input to search/filter contracts by type of goods or product name

**Backend Changes:**
| File | Changes |
|------|---------|
| `app/src/validators/contract.ts` | Added `product` filter parameter |
| `app/src/routes/contracts.ts` | Added aggregated product subqueries (`products_summary`, `total_quantity_mt`, `total_amount_usd`) and product filter |

**Frontend Changes:**
| File | Changes |
|------|---------|
| `vibe/src/services/contracts.ts` | Added `product` to `ContractFilters`, new fields to `Contract` interface |
| `vibe/src/pages/ContractsPage.tsx` | Added product filter, new columns for goods/quantity/price |
| `vibe/src/i18n/en.json` | Added `filterByProduct`, `price` translations |
| `vibe/src/i18n/ar.json` | Added Arabic translations |

**Results:**
- Contracts table now shows key business info: goods, quantity, price ✅
- Can filter contracts by product/goods type ✅
- Documentation responsibility question removed from wizard ✅

---

### December 23, 2025 - Session: Partial Shipment System & Contract Fulfillment Tracking
**Agent:** Claude Opus 4.5
**Work Done:**

Implemented a comprehensive partial shipment system allowing contracts to be fulfilled across multiple shipments with full traceability.

#### Core Feature: Partial Shipments

**Use Case:** A contract for 100 tons can be shipped in multiple shipments (e.g., 30 tons + 40 tons + 30 tons), with the system tracking fulfillment per product line.

**Key Decisions:**
- **Exceeding pending quantity:** Shows warning but allows override (for tolerance/flexibility)
- **Multiple products:** Tracks fulfillment per product line (e.g., "Rice: 30/50 shipped, Sugar: 20/30 shipped")
- **Auto-complete:** Automatically marks contract as `FULFILLED` when all lines are 100% shipped

#### Phase 1: Backend API Enhancements

**Modified:** `app/src/routes/contracts.ts`

| Endpoint | Changes |
|----------|---------|
| `GET /contracts/:id` | Added `shipped_quantity_mt`, `pending_quantity_mt`, `fulfillment_percentage` per line |
| `GET /contracts/:id` | Added `fulfillment` object with overall summary |
| `GET /contracts` (list) | Added `fulfillment_percentage` and `fulfillment_status` columns |
| `GET /contracts/:id/fulfillment-status` | NEW - Detailed fulfillment breakdown |
| `GET /contracts/:id/traceability` | NEW - Full traceability chain |

**Modified:** `app/src/routes/shipments.ts`
- Added quantity validation against contract line pending amounts
- Returns warnings array if quantity exceeds pending
- **Auto-fulfillment:** After shipment creation, checks if contract is fully shipped and updates status to `FULFILLED`

#### Phase 2: Database Migration

**New Migration:** `app/src/db/migrations/122_traceability_chain.sql`

| Table | Changes |
|-------|---------|
| `finance.customs_clearing_costs` | Added `shipment_line_id` FK for traceability |
| `logistics.outbound_deliveries` | Added `customs_clearing_cost_id` and `shipment_line_id` FKs |
| `logistics.v_traceability_chain` | NEW VIEW - Unified traceability from contract line to delivery |

### Cafeteria Voting System

```sql
-- Chef posts 3 options for tomorrow's lunch
system.cafe_menu_options (
  id, menu_date, option_number,
  dish_name, dish_name_ar,
  description, description_ar,
  image_path, created_by, created_at
)

-- Employee votes (one per user per day)
system.cafe_votes (
  id, menu_date, user_id, option_id, voted_at
)

-- Daily winner
system.cafe_menu_results (
  id, menu_date, winning_option_id,
  total_votes, was_tie, decided_by, finalized_at
)

-- Food suggestions (when chef opens suggestion mode)
system.cafe_suggestions (
  id, suggestion_text, suggested_by, is_active, created_at
)

-- Suggestion upvotes
system.cafe_suggestion_upvotes (
  suggestion_id, user_id, upvoted_at
)

-- Settings (suggestions_open, voting_deadline)
system.cafe_settings (
  key, value, updated_by, updated_at
)
```

**Views:**
- `system.v_cafe_today_menu` - Today's winning dish
- `system.v_cafe_tomorrow_options` - Tomorrow's options with vote counts
- `system.v_cafe_suggestions` - Active suggestions with upvote counts
- `system.v_cafe_menu_history` - Past menu winners

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cafe/today` | GET | Get today's menu (winner) |
| `/api/cafe/tomorrow` | GET | Get tomorrow's options + voting status |
| `/api/cafe/status` | GET | Widget status info |
| `/api/cafe/vote` | POST | Submit/change vote |
| `/api/cafe/my-vote` | GET | User's current vote |
| `/api/cafe/suggestions` | GET/POST | View/submit suggestions |
| `/api/cafe/suggestions/:id/upvote` | POST/DELETE | Upvote toggle |
| `/api/cafe/menu` | POST | Post 3 options (chef only) |
| `/api/cafe/menu/:id` | PUT/DELETE | Edit/delete option (chef only) |
| `/api/cafe/votes/count` | GET | Live vote counts (chef only) |
| `/api/cafe/close-voting` | POST | Close voting (chef only) |
| `/api/cafe/decide-tie` | POST | Break tie (chef only) |
| `/api/cafe/history` | GET | Past menus (chef only) |
| `/api/cafe/suggestions/open\|close` | POST | Toggle suggestions mode (chef only) |

**Frontend Pages:**
- Floating `CafeWidget` - Bottom-right widget on all pages (vote, view today's menu)
- `/cafe` - Chef Dashboard (post menu, view votes, manage suggestions, history)

**Scheduled Jobs:**
- 5:30 PM (weekdays) - Reminder notification for users who haven't voted
- 6:00 PM (weekdays) - Close voting, announce winner (or notify chef of tie)

#### Phase 3: Frontend - Shipment Wizard UX Improvements

**Both Create and Edit Wizards now show:**
- Contract Line Info Card (contracted quantity, shipped, pending)
- Progress bar with fulfillment percentage
- Color-coded quantity input (blue=normal, yellow=at limit, red=exceeds)
- Projected fulfillment after this shipment
- Warning if exceeding pending amount

**Files Modified:**
| File | Changes |
|------|---------|
| `vibe/src/components/shipments/wizard/Step2ProductLines.tsx` | Enhanced UX with fulfillment info card, progress bar, color-coded inputs |
| `vibe/src/components/shipments/NewShipmentWizard.tsx` | Pre-fill quantities with pending amounts from contract |
| `vibe/src/components/shipments/EditShipmentWizard.tsx` | Fetches fulfillment data on load, accounts for current shipment's quantity |

**Edit Wizard Smart Logic:**
When editing an existing shipment linked to a contract, the wizard:
1. Fetches current contract fulfillment status
2. Subtracts THIS shipment's quantity from "shipped" total (to avoid double-counting)
3. Shows accurate pending amounts for editing

#### Phase 4: Contract Detail Page Enhancement

**Added:** `vibe/src/pages/ContractDetailPage.tsx`
- **Fulfillment Progress Card:** Overall progress bar + per-line table (Contracted, Shipped, Pending, Progress %)
- **Traceability Chain Card:** Visual chain showing Contract Line → Shipment → Clearance → Transport
- Status badge now includes `FULFILLED` with emerald color

#### Phase 5: Contracts List Page Enhancement

**Added:** `vibe/src/pages/ContractsPage.tsx`
- **Fulfillment column:** Mini progress bar with percentage
- **Status filter:** Added PARTIAL and FULFILLED options
- Color-coded: emerald (100%), amber (partial), gray (pending)

#### Phase 6: Frontend Services & Types

**Modified:** `vibe/src/services/contracts.ts`
- Added `ContractFulfillmentSummary`, `ContractLineFulfillment`, `ContractFulfillmentStatus` interfaces
- Added `TraceabilitySummary`, `TraceabilityShipment`, `TraceabilityClearance`, `TraceabilityDelivery`, `TraceabilityLine`, `ContractTraceability` interfaces
- Added `getFulfillmentStatus(contractId)` method
- Added `getTraceabilityChain(contractId)` method
- Updated `ContractStatus` type to include `'FULFILLED'`

#### Phase 7: Translations

**Updated:** `vibe/src/i18n/en.json`, `vibe/src/i18n/ar.json`
- Added: `statusFulfilled`, `statusPartial`, `fulfillment`, `traceabilityChain`, `traceabilityDescription`
- Added: `contractLines`, `shipments`, `clearances`, `deliveries`, `thisShipment`, `afterThis`

#### Bug Fixes During Implementation

| Issue | Fix |
|-------|-----|
| Fulfillment not updating after shipment | Backend TypeScript not compiled - ran `npm run build` |
| API 403 errors | JWT token expired after server restart - re-login fixed |
| `toFixed is not a function` | Backend returning strings, added `Number()` conversion in frontend |

#### Traceability Chain Structure

```
Contract
└── Contract Lines
    └── Shipments (via shipment_lines.contract_line_id)
        └── Customs Clearances (via customs_clearing_costs.shipment_line_id)
            └── Transport/Deliveries (via outbound_deliveries.customs_clearing_cost_id)
```

#### Files Created/Modified Summary

| Category | Files |
|----------|-------|
| **Backend Routes** | `contracts.ts`, `shipments.ts` |
| **Database** | `122_traceability_chain.sql` |
| **Frontend Pages** | `ContractDetailPage.tsx`, `ContractsPage.tsx` |
| **Frontend Components** | `Step2ProductLines.tsx`, `NewShipmentWizard.tsx`, `EditShipmentWizard.tsx` |
| **Frontend Services** | `contracts.ts` |
| **Translations** | `en.json`, `ar.json` |

**Results:**
- Partial shipments tracked per contract line ✅
- Auto-fulfillment when 100% shipped ✅
- Improved wizard UX in both create AND edit modes ✅
- Fulfillment % visible in contracts list ✅
- Full traceability chain from contract to delivery ✅

---

### December 23, 2025 - Session: Bug Fixes & UX Improvements
**Agent:** Claude Opus 4.5
**Work Done:**

#### 1. Contract Validator Missing Statuses Fix
**Problem:** Editing contracts with `PENDING` status failed with validation error:
```
status: Invalid enum value. Expected 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; received 'PENDING'
```

**Solution:** Updated `app/src/validators/contract.ts` to include all valid statuses:
```typescript
status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'FULFILLED', 'COMPLETED', 'CANCELLED'])
```

#### 2. Contract Update Requests API Fix
**Problem:** `/api/contracts/update-requests/pending` endpoint had two issues:
1. Frontend URL had double `/api/api/` prefix (404 error)
2. SQL query referenced non-existent `cur.requested_at` column (500 error)

**Solution:**
- Fixed `ContractDetailPage.tsx`: Changed `/api/contracts/update-requests/pending` → `/contracts/update-requests/pending`
- Fixed `app/src/routes/contracts.ts`: Changed `ORDER BY cur.requested_at` → `ORDER BY cur.created_at`

#### 3. Frontend API Configuration Fix
**Problem:** Frontend `.env` was pointing to old network IP (`192.168.1.173`) causing connection failures.

**Solution:** Updated `vibe/.env` to use `localhost`:
```
VITE_API_BASE_URL=http://localhost:3000/api
```

#### 4. Wheel Scroll Disabled on Number Inputs
**Problem:** Number input fields in product lines tables were accidentally changing values when users scrolled with mouse wheel.

**Solution:** Added `onWheel={(e) => e.currentTarget.blur()}` to all editable number inputs in:
- `vibe/src/components/contracts/wizard/Step4ProductLines.tsx` (7 inputs)
- `vibe/src/components/shipments/wizard/Step2ProductLines.tsx` (1 input in split modal)

**Inputs Fixed:**
- Number of Packages
- Package Size
- Number of Pallets
- Volume CBM / Liters
- Unit Price
- Amount USD
- Split modal quantity

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/validators/contract.ts` | Added `PENDING` and `FULFILLED` to status enum |
| `app/src/routes/contracts.ts` | Fixed `requested_at` → `created_at` column, added banking_docs logging |
| `vibe/src/pages/ContractDetailPage.tsx` | Fixed double `/api` in URL |
| `vibe/src/components/contracts/wizard/Step4ProductLines.tsx` | Added `onWheel` handlers to number inputs |
| `vibe/src/components/shipments/wizard/Step2ProductLines.tsx` | Added `onWheel` handler to split modal input |
| `vibe/.env` | Fixed API URL to localhost |

**Results:**
- Contract editing works for all statuses (DRAFT, PENDING, ACTIVE, FULFILLED, COMPLETED, CANCELLED) ✅
- Update requests endpoint no longer errors ✅
- Number inputs no longer change on scroll ✅
- Frontend connects to backend properly ✅

---

### December 23, 2025 - Session: Finance Wizard Auto-Populate Party from Contract
**Agent:** Claude Opus 4.5
**Work Done:**

#### 1. Finance Wizard "ذمة" Auto-Population from Contract
**Problem:** When creating a financial transaction linked to a contract, the "الذمة" (counterparty/liability) field on Step 2 was not being auto-populated from the contract data.

**Initial Fix:** Added `setPartySearch()` call to update the UI state when a contract is selected.

**Refinement:** User pointed out that `beneficiary_name` (bank beneficiary) was being used instead of the actual trading counterparty. For contract AGT01:
- Buyer: LOYAL
- Seller: AGT Foods
- Beneficiary Name: LDSA (bank account name, NOT the counterparty)

The ذمة should be "AGT Foods" (the seller/supplier), not "LDSA".

**Final Solution:** Updated the party determination logic in `NewTransactionWizard.tsx`:

```typescript
// The ذمة is the trading counterparty (not the bank beneficiary)
// For imports (incoming): ذمة = seller (supplier we're paying)
// For exports (outgoing): ذمة = buyer (customer paying us)
if (contract.direction === 'incoming') {
  partyName = contract.seller_name || '';
} else if (contract.direction === 'outgoing') {
  partyName = contract.buyer_name || '';
} else {
  // Direction not set - default to seller since most transactions are import payments
  partyName = contract.seller_name || contract.buyer_name || '';
}
```

**Backend Enhancement:** Updated finance contract search endpoints to also return `beneficiary_name` (for reference, though not used for party):
- `GET /api/finance/contracts/search` - Joins with `v_contracts_complete` to get beneficiary_name
- `GET /api/finance/contracts/recent` - Same enhancement

#### Files Modified
| File | Changes |
|------|---------|
| `vibe/src/components/finance/NewTransactionWizard.tsx` | Fixed party (ذمة) auto-population logic to use seller_name/buyer_name instead of beneficiary_name; added setPartySearch() call |
| `vibe/src/types/api.ts` | Added `beneficiary_name` to `ContractSearchResult` interface |
| `app/src/routes/finance.ts` | Added `beneficiary_name` to contract search and recent endpoints |

**Business Logic:**
- **Import contracts** (direction = 'incoming'): We are buying → ذمة = seller (supplier)
- **Export contracts** (direction = 'outgoing'): We are selling → ذمة = buyer (customer)
- **Direction not set**: Default to seller_name (most common case is import payments)

**Results:**
- Selecting contract AGT01 now correctly populates "AGT Foods" as the ذمة ✅
- Party field is auto-populated on Step 2 when navigating from contract selection ✅
- Works for contracts with buyer/seller company data ✅

---

### December 23, 2025 - Session: Cleared Shipments Table (International Tracking Completion)
**Agent:** Claude Opus 4.5
**Work Done:**

#### Cleared Shipments Table - End of International Tracking
**User Request:** Add a table in contract tracking that shows only shipments with Customs Clearing (CC) entered, as this marks when the international tracking process ends.

**Implementation:**
Added a new "Cleared Shipments" card to the Contract Detail Page that:
1. Filters shipments to show ONLY those with at least one customs clearing entry
2. Displays key information: Shipment No., Product, Quantity, Clearance File #, Type, CC Cost, Payment Status
3. Shows totals for cleared shipments count, total MT cleared, and total clearance cost
4. Clickable rows navigate to shipment detail page
5. Clear visual indication with emerald green theme to signify completion

**Location:** Appears BEFORE the Traceability Chain section on the Contract Detail Page

**Columns in Cleared Shipments Table:**
| Column | Description |
|--------|-------------|
| Shipment No. | Shipment SN with truck icon |
| Product | Product name from contract line |
| Qty (MT) | Shipped quantity in metric tons |
| Clearance File # | Customs clearing file number (monospace) |
| Type | POD (inbound) or Border (border_crossing) |
| CC Cost | Total clearance cost in USD |
| Payment | Payment status badge (paid/partial/unpaid) |

**Files Modified:**
| File | Changes |
|------|---------|
| `vibe/src/pages/ContractDetailPage.tsx` | Added "Cleared Shipments" card with filtered table |
| `vibe/src/i18n/en.json` | Added 11 translation keys for cleared shipments |
| `vibe/src/i18n/ar.json` | Added 11 Arabic translations |

**New Translation Keys:**
- `clearedShipments` - Section title
- `clearedShipmentsDescription` - Explanation text
- `loadClearedShipments` - Button text
- `noClearedShipments` - Empty state message
- `clearanceMarksCompletion` - Explanation of CC significance
- `shipmentNo` - Column header
- `clearanceFile` - Column header
- `clearanceType` - Column header
- `clearanceCost` - Column header
- `paymentStatus` - Column header

**Results:**
- Contract Detail Page now shows "Cleared Shipments" section ✅
- Only shipments with CC entered are displayed (international tracking complete) ✅
- Totals shown: shipment count, total MT, total CC cost ✅
- Uses existing traceability data (no new API calls required) ✅
- Bilingual support (EN/AR) ✅

---

### December 23, 2025 - Session: Shipment Tracking Interface UX Improvements
**Agent:** Claude Opus 4.5
**Work Done:**

#### 1. Enhanced Tracking Number Copy Button
**Problem:** User wanted tracking number to be more obviously copyable.

**Solution:** Enhanced the tracking number button with:
- More visible "COPY" badge label
- Visual animation on successful copy (scale effect + color change to green)
- Improved tooltip with emoji for clarity
- Truncation for long tracking numbers with max-width
- Animated checkmark pulse on copy confirmation

#### 2. Made Clearance Date Editable
**Problem:** Clearance date was read-only in the tracking interface, requiring users to navigate to shipment details to update it.

**Solution:** Added inline editing for `customs_clearance_date`, similar to existing ETA editing:
- Click on clearance date cell to enter edit mode
- Date picker input with green styling (matching customs theme)
- Save/Cancel buttons with keyboard shortcuts (Enter/Escape)
- Loading spinner during save
- Shows "Not set" placeholder when no date exists
- Query invalidation to refresh data after save

#### Files Modified
| File | Changes |
|------|---------|
| `vibe/src/pages/ShipmentTrackingPage.tsx` | Added clearance date editing (state, mutation, handlers, UI); enhanced tracking number copy button styling; added missing imports (`useBranches`, `BuildingOffice2Icon`) |
| `vibe/src/pages/ContractDetailPage.tsx` | Fixed unused `idx` variable in cleared shipments map |

#### Info Banner Update
Updated the workflow instructions banner to mention that clearance date is now editable:
- EN: "Click ETA, Customs Date, or document status to update directly"
- AR: "انقر على موعد الوصول أو تاريخ التخليص أو حالة الأوراق لتحديثهم مباشرة"

**Results:**
- Tracking number has clear "COPY" badge and visual feedback on copy ✅
- Clearance date is now inline-editable (green theme, matches customs) ✅
- Both features work with keyboard shortcuts ✅
- Frontend builds successfully ✅

---

### December 23, 2025 - Session: E-Fatura Internal Route Display
**Agent:** Claude Opus 4.5
**Work Done:**

Added the internal route (POD → Final Destination) display to the E-Fatura interface, matching the implementation in other pages like Customs Clearing Costs, Land Transport, and Accounting.

#### 1. Backend API Enhancement (`app/src/routes/efatura.ts`)

Added the following fields to both `/api/e-fatura/pending` and `/api/e-fatura/:shipmentId` endpoints:

| Field | Description |
|-------|-------------|
| `final_destination_place` | COALESCE of delivery_place, name, final_beneficiary_name |
| `final_destination_branch_id` | Branch ID for the final destination |

Added JOIN to `logistics.shipment_parties` for `final_beneficiary_name` fallback.

#### 2. Frontend Service Update (`vibe/src/services/efatura.ts`)

Added new fields to `EFaturaShipment` interface:
- `final_destination_place: string | null`
- `final_destination_branch_id: string | null`

#### 3. EFaturaCard Component Enhancement (`vibe/src/components/efatura/EFaturaCard.tsx`)

Added Internal Route display section:
- Shows POD → Final Destination with RTL-aware arrow (← for Arabic, → for English)
- Indigo-themed styling (consistent with route display)
- MapPin icon for visual clarity
- Positioned between the shipment fields grid and the internal transport section

**Route Display Pattern:**
```tsx
<div className="flex items-center gap-2 text-base font-medium text-indigo-900">
  <span>{shipment.pod_name || '—'}</span>
  <span className="text-indigo-500">{isRtl ? '←' : '→'}</span>
  <span>{shipment.final_destination_place || '—'}</span>
</div>
```

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/routes/efatura.ts` | Added `final_destination_place`, `final_destination_branch_id` to both queries; added JOIN to `shipment_parties` |
| `vibe/src/services/efatura.ts` | Added route fields to `EFaturaShipment` interface |
| `vibe/src/components/efatura/EFaturaCard.tsx` | Added Internal Route display section with MapPinIcon; RTL-aware arrow direction |

**Results:**
- E-Fatura cards now show the internal route prominently ✅
- Route arrow flips correctly based on language direction ✅
- Consistent styling with other route displays in the system ✅
- Backend compiles successfully ✅

---

### December 24, 2025 - Session: Internal Route Border Crossing Display & Outbound Deliveries Enhancement
**Agent:** Claude Opus 4.5
**Work Done:**

#### 1. Border Crossing Display in Internal Transportation Routes
**User Request:** Add the border crossing that a shipment is using to internal transportation displays.

**Implementation:**
Updated all internal route displays to show the border crossing inline in the route path:
- **Format:** `POD → 🚧 Border Crossing → Final Destination` (for cross-border shipments)
- **Format:** `POD → Final Destination` (for non-cross-border shipments)

**Backend Changes:**
- `landTransport.ts` - Added `is_cross_border`, `primary_border_name`, `primary_border_name_ar` to ready-for-delivery query
- `customsClearingCosts.ts` - Added border crossing fields to pending-clearances query  
- `accounting.ts` - Added border crossing fields to inventory-transactions query and response mapping

**Frontend Changes:**
- `ReadyForDeliveryTable.tsx` - Route column now shows border crossing with amber styling
- `PendingClearancesTable.tsx` - Route display includes border crossing
- `AccountingPage.tsx` - Inventory tab route shows border crossing
- `ShipmentDetailPage.tsx` - Enhanced internal route section to show border inline

**Styling:**
- Cross-border routes use amber color scheme
- Border crossing shown with 🚧 emoji and amber badge
- RTL-aware: uses Arabic border name when available in Arabic mode

#### 2. Outbound Deliveries Table Enhancements
**User Request:** Add type of goods to outbound deliveries and handle cancelled deliveries properly.

**Implementation:**

**Product Column Added:**
- New "Product" column header added to the deliveries table
- Shows `shipment_product` from the linked shipment

**Cancelled Deliveries Handling:**
- Cancelled rows are visually distinct: grayed out (opacity-60), red-tinted background
- All text in cancelled rows has strikethrough styling
- Cancelled deliveries cannot be edited (inline editing disabled)
- Actions column shows only "Cancelled" label and delete button
- Receipt generation and editing buttons hidden for cancelled deliveries

| File | Changes |
|------|---------|
| `app/src/routes/landTransport.ts` | Already returns `shipment_product`; added border fields |
| `app/src/routes/customsClearingCosts.ts` | Added border crossing fields |
| `app/src/routes/accounting.ts` | Added border crossing fields to query and response |
| `vibe/src/components/land-transport/ReadyForDeliveryTable.tsx` | Border crossing in route display |
| `vibe/src/components/land-transport/OutboundDeliveriesTable.tsx` | Added Product column; cancelled delivery handling |
| `vibe/src/components/customs/PendingClearancesTable.tsx` | Border crossing in route display |
| `vibe/src/pages/AccountingPage.tsx` | Border crossing in inventory route display |
| `vibe/src/pages/ShipmentDetailPage.tsx` | Enhanced internal route with inline border |

**Results:**
- Internal routes now show border crossing when applicable ✅
- Outbound deliveries table shows product type ✅
- Cancelled deliveries are clearly distinguished and restricted ✅
- No linting errors ✅

---

### December 29, 2025 - Session: Shipment Wizard Autocomplete & Save Fixes
**Agent:** Claude Opus 4.5
**Work Done:**

Fixed multiple issues preventing shipment wizard fields from saving/displaying correctly.

#### Problem Description
User reported that in the shipment wizard (both create and edit modes), the following fields were not showing/saving:
- Supplier field
- POL (Port of Loading)
- POD (Port of Discharge)
- Shipping Company
- Internal Route (border crossing, transport mode)

#### Root Causes Identified

1. **UUID Validation Blocking New Entries**
   - Frontend `NewShipmentWizard.tsx` and `EditShipmentWizard.tsx` were filtering out `pol_id`, `pod_id`, and `shipping_line_id` values that weren't valid UUIDs
   - The `AutocompleteInput` component sends "new:PortName" for new entries, but these were being stripped

2. **Missing Internal Route Fields in Backend INSERT**
   - `shipment_logistics` INSERT statement was missing `is_cross_border`, `primary_border_crossing_id`, `internal_transport_mode`
   - These fields existed in the database but weren't being saved on shipment creation

3. **Route Mismatch for `/shipments/new`**
   - Navigating to `/shipments/new` caused a 500 error because React Router matched it to `/shipments/:id` with id="new"
   - The `useShipment` hook tried to fetch `/api/shipments/new` which failed

#### Fixes Applied

**1. Frontend - NewShipmentWizard.tsx**
- Removed `isValidUUID` check when constructing `shipmentData` for `pol_id`, `pod_id`, `shipping_line_id`
- Backend's `resolveOrCreatePort` and `resolveOrCreateShippingLine` handle the "new:" prefix

**2. Frontend - EditShipmentWizard.tsx**
- Removed `isValidUUID` check for `shipping_line_id`
- Ensures existing values and new entries both pass through correctly

**3. Backend - shipments.ts (POST /)**
- Added `is_cross_border`, `primary_border_crossing_id`, `internal_transport_mode` to destructuring
- Updated `shipment_logistics` INSERT to include these fields ($14, $15, $16)

**4. Frontend - useShipments.ts**
- Added `isValidUUID` helper function
- Updated `useShipment` hook to only enable query when ID is a valid UUID
- Prevents API calls with invalid IDs like "new"

**5. Frontend - App.tsx**
- Added redirect route: `/shipments/new` → `/shipments`
- New shipment wizard is opened as a modal from ShipmentsPage, not as a separate route

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/routes/shipments.ts` | Added internal route fields to POST destructuring and INSERT |
| `vibe/src/components/shipments/NewShipmentWizard.tsx` | Removed UUID filter on pol_id, pod_id, shipping_line_id |
| `vibe/src/components/shipments/EditShipmentWizard.tsx` | Removed UUID filter on shipping_line_id |
| `vibe/src/hooks/useShipments.ts` | Added UUID validation to useShipment hook |
| `vibe/src/App.tsx` | Added redirect route for /shipments/new |

**Results:**
- POL, POD, and shipping line fields now save correctly ✅
- Internal route fields (border crossing, transport mode) now save ✅
- Navigation to /shipments/new redirects cleanly instead of 500 error ✅
- Autocomplete "new:" prefix flows through to backend for new entry creation ✅

---

### December 29, 2025 - Session: Cafeteria Voting System Implementation
**Agent:** Claude Opus 4.5
**Work Done:**

Implemented a complete cafeteria voting system where employees can vote for tomorrow's lunch.

#### Feature Overview
- Chef posts 3 lunch options each day
- Employees vote for tomorrow's lunch via floating widget
- Voting closes at 6:00 PM (auto-scheduled)
- Winner is announced and served the next day
- Chef can open suggestions mode when unsure what to cook

#### Phase 1: Database Migration (`130_cafe_system.sql`)
| Table | Purpose |
|-------|---------|
| `system.cafe_menu_options` | Chef's daily 3 options |
| `system.cafe_votes` | User votes (one per user per day) |
| `system.cafe_menu_results` | Daily winner records |
| `system.cafe_suggestions` | User food suggestions |
| `system.cafe_suggestion_upvotes` | Upvote tracking |
| `system.cafe_settings` | Configuration (suggestions_open, voting_deadline) |

**Views Created:**
- `v_cafe_today_menu` - Today's winning dish
- `v_cafe_tomorrow_options` - Tomorrow's options with vote counts
- `v_cafe_suggestions` - Active suggestions with upvote counts
- `v_cafe_menu_history` - Past menu winners

#### Phase 2: Backend API (`app/src/routes/cafe.ts`)
**Public endpoints (all authenticated users):**
- `GET /api/cafe/today` - Today's menu (winner)
- `GET /api/cafe/tomorrow` - Tomorrow's options + voting status
- `GET /api/cafe/status` - Widget status info
- `POST /api/cafe/vote` - Submit/change vote
- `GET /api/cafe/my-vote` - User's current vote
- `GET /api/cafe/suggestions` - Active suggestions
- `POST /api/cafe/suggestions` - Submit suggestion
- `POST/DELETE /api/cafe/suggestions/:id/upvote` - Upvote toggle

**Chef-only endpoints (Cafe role):**
- `POST /api/cafe/menu` - Post 3 options
- `PUT/DELETE /api/cafe/menu/:id` - Edit/delete option
- `GET /api/cafe/votes/count` - Live vote counts
- `POST /api/cafe/close-voting` - Manually close voting
- `POST /api/cafe/decide-tie` - Break ties
- `GET /api/cafe/history` - Past menus
- `POST /api/cafe/suggestions/open|close` - Toggle suggestions mode

#### Phase 3: Permissions System
- Added **Cafe** role with full cafe access
- Added **cafe** module to all roles (read permission for voting)
- Updated `PERMISSIONS`, `PATH_TO_MODULE`, `API_ROUTE_TO_MODULE` in both backend and frontend

#### Phase 4: Frontend Components

**CafeWidget (`vibe/src/components/cafe/CafeWidget.tsx`):**
- Floating bottom-right widget on all pages
- Collapsible (click to expand/collapse)
- Shows today's winning dish (emerald theme)
- Shows tomorrow's voting options (indigo theme)
- Radio buttons for voting with instant submit
- Countdown to 6 PM deadline
- After 6 PM: shows results with vote counts (violet theme)
- Access to suggestions when open (amber theme)

**CafeSuggestionsModal:**
- Submit new food suggestions
- View and upvote existing suggestions
- Sorted by upvote count

**CafeDashboardPage (`/cafe`):**
- **Post Menu tab** - 3 input fields for tomorrow's options (EN + AR)
- **Voting Status tab** - Live vote counts with progress bars
- **Suggestions tab** - View/manage user suggestions
- **History tab** - Table of past menus with winners

#### Phase 5: Scheduler Jobs (`app/src/services/scheduler.ts`)
- **5:30 PM reminder** (weekdays) - Notifies users who haven't voted
- **6:00 PM voting close** (weekdays) - Auto-closes voting, announces winner
- Handles ties by notifying Cafe role users to decide
- Timezone: Asia/Riyadh

#### Phase 6: React Query Hooks (`vibe/src/hooks/useCafe.ts`)
- `useCafeStatus`, `useTodayMenu`, `useTomorrowOptions`
- `useSubmitVote`, `useSuggestions`, `useUpvoteSuggestion`
- `usePostMenu`, `useVoteCounts`, `useCloseVoting`, `useDecideTie`
- `useMenuHistory`, `useOpenSuggestions`, `useCloseSuggestions`

#### Phase 7: Translations
- Full English and Arabic translations for all cafe strings
- Nav item: "Cafeteria" / "الكافتيريا"

#### Files Created
| File | Purpose |
|------|---------|
| `app/src/db/migrations/130_cafe_system.sql` | Database schema |
| `app/src/routes/cafe.ts` | API endpoints |
| `app/src/validators/cafe.ts` | Zod validation schemas |
| `vibe/src/services/cafe.ts` | Frontend API service |
| `vibe/src/hooks/useCafe.ts` | React Query hooks |
| `vibe/src/components/cafe/CafeWidget.tsx` | Floating widget |
| `vibe/src/components/cafe/CafeSuggestionsModal.tsx` | Suggestions modal |
| `vibe/src/components/cafe/index.ts` | Component exports |
| `vibe/src/pages/CafeDashboardPage.tsx` | Chef management page |

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/middleware/permissions.ts` | Added Cafe role + cafe module |
| `app/src/services/scheduler.ts` | Added 5:30 PM + 6:00 PM cafe jobs |
| `app/src/index.ts` | Registered cafe routes |
| `vibe/src/contexts/PermissionContext.tsx` | Added Cafe role + cafe module |
| `vibe/src/components/layout/Layout.tsx` | Added CafeWidget to layout |
| `vibe/src/components/layout/Sidebar.tsx` | Added cafe menu item |
| `vibe/src/App.tsx` | Added `/cafe` route |
| `vibe/src/i18n/en.json` | English translations |
| `vibe/src/i18n/ar.json` | Arabic translations |

**Results:**
- Floating widget visible on all pages ✅
- Voting works with instant feedback ✅
- Chef dashboard fully functional ✅
- Scheduled jobs configured ✅
- Bilingual support ✅

---

### December 26, 2025 - Session: Border Agent Workflow & Edit Wizard Fix
**Agent:** Claude Opus 4.5
**Work Done:**

#### 1. New Border Agent Workflow Implementation
**User Request:** Replace the `assigned_to_user_id` trigger with a stage-based workflow for border shipments.

**New Workflow:**
1. **Pending at POD** - When shipment is cross-border with CC date, appears as "pending" (waiting for transport)
2. **On the Way** - When internal transport assigns cars, updates to "on the way" with ETA
3. **At Border** - Border agent confirms arrival at border
4. **Clearing** - Customs clearance in progress
5. **Cleared** - Clearance complete, costs entered

**Database Changes (Migration 125):**
- Added `border_stage` column to `logistics.shipments` (stages: pending_at_pod, on_the_way, at_border, clearing, cleared)
- Added `border_arrival_date` and `border_clearance_date` to `logistics.shipments`
- Added `border_crossing_id`, `border_eta`, `delivery_leg` to `logistics.outbound_deliveries`
- Created `logistics.v_border_agent_shipments` view for efficient querying

**Backend Changes:**
- `borderCrossings.ts` - New endpoints: `/border-shipments`, `/border-shipments/:id`, `/border-shipments/:id/stage`, `/border-shipments/:id/costs`
- `landTransport.ts` - Auto-updates `border_stage` to 'on_the_way' when delivery created for cross-border shipment
- `shipments.ts` - Added `is_cross_border` and `primary_border_crossing_id` to field mapping for proper saving

**Frontend Changes:**
- `BorderAgentPage.tsx` - Complete rewrite with stage-based filtering, mobile-first design
- `DeliveryFormModal.tsx` - Added border crossing selection for cross-border shipments
- `borderCrossings.ts` service - New API methods for border shipments

#### 2. Edit Wizard Border Crossing Fix
**User Request:** Border crossing not showing in wizard when editing shipment, despite being saved in backend.

**Root Cause:** The `convertShipmentToFormData` function in `EditShipmentWizard.tsx` was not loading `is_cross_border`, `primary_border_crossing_id`, and `primary_border_name` from the shipment object.

**Fix:**
```typescript
// Added to convertShipmentToFormData in EditShipmentWizard.tsx
const base: ShipmentFormData = {
  ...initialFormData,
  is_cross_border: shipment.is_cross_border || false,
  primary_border_crossing_id: shipment.primary_border_crossing_id || '',
  primary_border_name: shipment.primary_border_name || '',
  // ... rest of fields
};
```

#### 3. RTL Arrow Fix for Route Displays
**User Request:** Fix arrows showing wrong direction in Arabic UI (RTL mode).

**Solution:** Added `dir="ltr"` to all route display containers to force left-to-right rendering of route paths (POD → Border → FD).

**Files Fixed:**
- `Step4Logistics.tsx` - Wizard route preview
- `ReadyForDeliveryTable.tsx` - Land transport table
- `EFaturaCard.tsx` - E-Fatura card
- `ShipmentDetailPage.tsx` - Shipment detail routes
- `PendingClearancesTable.tsx` - Customs clearances table
- `AccountingPage.tsx` - Accounting page routes
- `InventoryDashboardPage.tsx` - Inventory dashboard routes

| File | Changes |
|------|---------|
| `app/src/db/migrations/125_border_agent_workflow.sql` | New migration for border stage fields and view |
| `app/src/routes/borderCrossings.ts` | New border-shipments endpoints |
| `app/src/routes/landTransport.ts` | Auto-update border_stage on delivery creation |
| `app/src/routes/shipments.ts` | Fixed field mapping for border crossing fields |
| `app/src/validators/landTransport.ts` | Added border crossing fields to delivery schemas |
| `vibe/src/pages/BorderAgentPage.tsx` | Rewritten with stage-based workflow |
| `vibe/src/components/land-transport/DeliveryFormModal.tsx` | Border crossing selection |
| `vibe/src/components/shipments/EditShipmentWizard.tsx` | Fixed border crossing loading |
| `vibe/src/components/shipments/wizard/Step4Logistics.tsx` | RTL arrow fix |
| Multiple route display files | RTL arrow fixes with dir="ltr" |

**Results:**
- Border agent workflow now stage-based (not user-assignment based) ✅
- Cross-border shipments appear automatically when CC date set ✅
- Transport assignment updates stage to "on the way" with ETA ✅
- Border crossing properly saves and loads in shipment wizard ✅
- Route arrows display correctly in both LTR and RTL modes ✅

---

### December 30, 2025 - Session: Add Loyal Ceramics Branch
**Agent:** Claude Opus 4.5
**Work Done:**

Added Loyal Ceramics as a new final beneficiary region with two warehouses.

**Migration:** `app/src/db/migrations/131_loyal_ceramics_branch.sql`

**New Branches Added:**
| Name | Arabic Name | Type | City | Country |
|------|-------------|------|------|---------|
| Loyal Ceramics | لويال سيراميك | region | — | Syria |
| Idlib Warehouse | مستودع إدلب | warehouse | Idlib | Syria |
| Aleppo Warehouse | مستودع حلب | warehouse | Aleppo | Syria |

**Branch Hierarchy:**
```
Loyal Holding
├── ... (existing branches)
└── Loyal Ceramics (لويال سيراميك) [region, sort_order: 60]
    ├── Idlib Warehouse (مستودع إدلب) [warehouse, sort_order: 61]
    └── Aleppo Warehouse (مستودع حلب) [warehouse, sort_order: 62]
```

**Results:**
- Loyal Ceramics appears in Final Destination dropdown ✅
- Two warehouses available for selection ✅
- Total branches in system: 21 ✅

---

### December 30-31, 2025 - Session: CSV Import Attempts & System Reset
**Agent:** Claude Opus 4.5
**Work Done:**

#### Import Script Development
Created `tools/import-csv-clean.ts` to import data from Arabic Excel/CSV files:
- Parses semicolon-delimited CSV files
- Detects section headers to extract final destination & beneficiary
- Maps to warehouse branches (not external customers)
- Handles split shipments (255-A, 255-B → contract 255)
- Distinguishes PENDING contracts (no ETA/tracking) from ACTIVE (with shipments)
- Parses complex values ("6+4" containers, "150+100" weights)
- Links document folders from `/data/شركة لويال 2`

**Section Mapping (for future reference):**
```typescript
const SECTION_MARKERS = {
  'Loyal North Mahmut, Sarmada 1': { 
    branch_id: '5c111ac7-32d9-4177-bb34-d02a24f5aac2',    // Loyal Syria North (Mahmut)
    warehouse_id: 'e765b024-86f8-4863-bc5a-cf0af0c30ae9'  // Sarmada Warehouse 1
  },
  'Loyal Turkey, Internal/Domestic Warehouse': { 
    branch_id: '5392e93b-3ff8-4ad4-b513-ce5a2e1bf5a5',    // Loyal Turkey
    warehouse_id: '9bdc3dde-14eb-4664-b3d7-8341d0e9ab0c'  // Turkey Internal Warehouse
  },
  'Loyal Coast, Lattakia Warehouse': { 
    branch_id: '3be9877e-0815-45e3-bca9-c10e8249173f',    // Loyal Coast
    warehouse_id: '56a4db61-2561-44c7-9129-34aad6c90155'  // Lattakia Warehouse
  },
};
```

#### Issues Encountered
Multiple import attempts resulted in data quality issues:
1. Initial import set all destinations as "external customer" instead of "warehouse"
2. Fixed to use `type: 'branch'` with proper `branch_id` and `warehouse_id`
3. User determined imported data was still not accurate enough

#### System Reset (User Request)
Per user request, all transactional data was cleared for manual entry:
```sql
DELETE FROM archive.documents;           -- 320 rows
DELETE FROM logistics.shipment_*;        -- 112 shipments + related
DELETE FROM logistics.contract_*;        -- 120 contracts + related
```

**Master Data Preserved:**
- 111 ports
- 1,872 shipping companies  
- 21 branches (including Loyal Ceramics)
- 78+ suppliers
- 5 users

**Final State:**
- System is empty and ready for manual data entry
- All forms, wizards, and features work correctly
- Master data intact for dropdowns and selections

---

### January 1, 2026 - Session: OCR Fallback Extraction Enhancement
**Agent:** Claude Opus 4.5
**Work Done:**

#### Problem Identified
User reported that uploading a Bill of Lading document to the Commercial Invoice (CI) extraction section failed, even though the system should extract useful trade data from any available document. The error was:
```
No Commercial Invoice found in the provided file. The file may contain other documents (B/L, Certificate of Origin, etc.) but no Commercial Invoice.
```

Similarly, after fixing CI, the B/L extraction showed the opposite problem - it would fail when given a non-B/L document.

#### Solution Implemented
Enhanced both CI and B/L AI extraction prompts to be more aggressive about fallback extraction:

**1. Updated CI Extraction Prompt (`buildCIExtractionPrompt`):**
- Added explicit instructions to ALWAYS extract useful trade data
- Prioritizes CI but falls back to: Proforma Invoice, Packing List, Certificate of Origin, B/L
- Sets `document_type: "FALLBACK"` with source document type when using alternate documents
- Only returns `NOT_FOUND` if file is completely empty/corrupted

**2. Updated B/L Extraction Prompt (`buildBOLExtractionPrompt`):**
- Same aggressive fallback behavior
- Falls back to: Commercial Invoice, Packing List, Certificate of Origin
- Extracts container numbers, ports, vessel, weights, dates from any source

**3. Updated Extraction Result Handling:**
Both `extractFromCommercialInvoice` and `extractFromBOL` now:
- Accept `document_type: "FALLBACK"` as successful extraction
- Log which fallback document was used
- Return success with warnings instead of failing
- Auto-fill form fields with extracted data

#### Code Changes
**File:** `app/src/services/openai.ts`
- `buildCIExtractionPrompt()` - Enhanced fallback instructions (lines ~200-230)
- `extractFromCommercialInvoice()` - Handle FALLBACK as success (lines ~350-380)
- `buildBOLExtractionPrompt()` - Enhanced fallback instructions (lines ~700-730)
- `extractFromBOL()` - Handle FALLBACK as success (lines ~620-640)

#### Testing
- Uploaded B/L document to CI section → Successfully extracted trade data with fallback warning ✅
- Uploaded CI document to B/L section → Successfully extracted shipping data with fallback warning ✅
- Both sections now accept any trade/shipping document and extract maximum useful data

**Key Learning:** Users don't always have the "correct" document type. The system should be helpful and extract whatever useful information is available, rather than being strict about document types.

---

### January 2, 2026 - Session: OCR Fuzzy Matching for Company Names
**Agent:** Claude Opus 4.5
**Work Done:**

#### Problem Identified
User reported that OCR extraction was creating duplicate company records because slightly different variations of the same company name (e.g., "BAYRAK GROUP GIDA SANAYI VE TİCARET LİMİTED ŞİRKETİ" vs "Bayrak Group Gida Sanayi Ve Ticaret Limited Sirketi") were not being matched.

#### Solution Implemented
Implemented a comprehensive fuzzy matching system for company names during OCR extraction.

**1. Created String Similarity Utilities (`app/src/utils/stringMatch.ts`):**
- `normalizeCompanyName()` - Normalizes Turkish chars, removes legal suffixes (Ltd, Şirketi, etc.)
- `levenshteinSimilarity()` - Edit distance-based similarity
- `tokenSimilarity()` - Jaccard similarity on word tokens
- `bigramSimilarity()` - Character bigram comparison (catches OCR typos)
- `tokenSubsetScore()` - Handles short vs long name matching
- `firstWordsMatch()` - Prioritizes matching of first distinguishing words
- `calculateSimilarity()` - Weighted combination of all metrics with adaptive weights
- `findBestMatches()` - Returns best matches above threshold

**2. Added Fuzzy Match Endpoint (`GET /api/companies/fuzzy-match`):**
- Query params: `name`, `threshold` (default 0.6), `limit` (default 5), `type` (supplier/customer/shipping_line)
- Returns matches with similarity scores and breakdown
- Pre-filters candidates using first token for performance

**3. Enhanced Company Create Endpoint (`POST /api/companies`):**
- Now performs fuzzy matching before creating new company
- If 70%+ match found, returns existing company instead of creating duplicate
- Response includes `matched: true`, `matchType: 'fuzzy'`, `matchScore`

**4. Updated Frontend OCR Handlers:**
- `CIUploadSection.tsx` - Uses fuzzy match for supplier/buyer from Commercial Invoice
- `BOLUploadSection.tsx` - Uses fuzzy match for shipper/consignee from B/L
- `ContractWizard.tsx` - Uses fuzzy match for exporter/buyer during proforma extraction

#### Similarity Algorithm
The algorithm uses adaptive weights based on whether it's comparing short vs long names:

**For short-to-long comparisons (e.g., "Bayrak Group" vs "Bayrak Group Gida Sanayi..."):**
- Higher weight on `tokenSubset` (100% if all search tokens found in candidate)
- Higher weight on `firstWords` (matching first distinguishing words)

**For similar-length comparisons:**
- Higher weight on `token` (Jaccard similarity)
- Higher weight on `bigram` (catches typos)

**Turkish Character Handling:**
- Normalizes ş→s, ğ→g, ü→u, ö→o, ç→c, ı→i, İ→i
- Removes legal suffixes: Ltd, Limited, Şirketi, Sanayi, Ticaret, etc.

#### Test Results
```
"Bayrak Group" → "Bayrak Group Gida Sanayi Ve Ticaret Limited Sirketi" = 74.5% ✅
"BAYRAK GROUP GIDA SANAYI VE TİCARET LİMİTED ŞİRKETİ" → exact match = 100% ✅
"bayrak" → "BAYRAK GRUP GIDA SANAYI" = 68.3% (below 70% threshold, shown as suggestion)
```

#### Files Created/Modified
| File | Changes |
|------|---------|
| `app/src/utils/stringMatch.ts` | NEW - String similarity utilities |
| `app/src/routes/companies.ts` | Added fuzzy-match endpoint, enhanced POST with fuzzy matching |
| `vibe/src/components/shipments/wizard/CIUploadSection.tsx` | Uses fuzzy match for supplier/buyer |
| `vibe/src/components/shipments/wizard/BOLUploadSection.tsx` | Uses fuzzy match for shipper/consignee |
| `vibe/src/components/contracts/wizard/ContractWizard.tsx` | Uses fuzzy match for exporter/buyer |

**Results:**
- OCR-extracted company names now match existing companies at 70%+ similarity ✅
- Short names like "Bayrak Group" match longer canonical names ✅
- Turkish character variations handled correctly ✅
- No more duplicate company records from OCR ✅

---

### January 3, 2026 - Session: Shipment Wizard Review Section (Step 6) Complete Overhaul
**Agent:** Claude Opus 4.5
**Work Done:**

#### Problem Identified
The Review section (Step 6) of the New Shipment Wizard was missing critical fields that users needed to verify before submission:
- Supplier name (اسم المورد)
- Buyer name (اسم المشتري)
- Final Owner (المالك النهائي)
- Final Destination (الوجهة النهائية)

#### Solution Implemented

**1. Added "Commercial & Ownership Summary" Card (`Step6Review.tsx`):**
New dedicated section displaying:
- **المورد (Supplier):** Name + ID + contact info (for incoming transactions)
- **المشتري (Buyer):** Name + ID + contact info (for outgoing transactions)
- **المالك النهائي (Final Owner):** Entity type (branch/customer/consignment) + name
- **الوجهة النهائية (Final Destination):** Destination type + location details (warehouse/delivery place)

**2. Missing Data Handling:**
- Fields without data show "غير محدد" (Not set) in warning style (amber background)
- Each missing field has an "Edit" button that deep-links to the correct wizard step
- Uses `onNavigateToStep` prop passed from parent wizard

**3. Submission Validation (`NewShipmentWizard.tsx`, `EditShipmentWizard.tsx`):**
- Added `validateReviewStep()` function that checks:
  - Supplier set for incoming transactions
  - Buyer set for outgoing transactions
  - Final Owner properly configured
  - Final Destination complete
- Blocks submission with detailed Arabic error banner listing missing fields
- Error banner: "لا يمكن إرسال الشحنة. الحقول التالية مفقودة: ..."

**4. Added Translations (`ar.json`, `en.json`):**
```json
"commercialOwnershipSummary": "ملخص التجارة والملكية"
"finalOwner": "المالك النهائي"
"finalDestination": "الوجهة النهائية"
"missingRequiredFields": "حقول مطلوبة مفقودة"
"missingRequiredFieldsError": "لا يمكن إرسال الشحنة. الحقول التالية مفقودة:"
"common.notSet": "غير محدد"
```

**5. Additional Fields Added to Shipment Submission:**
- `truck_count`: Number of trucks when `cargo_type = 'trucks'`
- `lc_type`, `lc_expiry_date`: Letter of Credit details
- `payment_term_days`, `transfer_reference`: Payment tracking
- `transportation_cost`, `transport_cost_responsibility`: Transport cost tracking

**6. Step 3 Validation Enhancement:**
- Added truck count validation when `cargo_type = 'trucks'`
- Requires integer ≥ 1

#### Files Modified
| File | Changes |
|------|---------|
| `vibe/src/components/shipments/wizard/Step6Review.tsx` | Complete rewrite with Commercial & Ownership Summary, missing data warnings, Edit links |
| `vibe/src/components/shipments/NewShipmentWizard.tsx` | Added `validateReviewStep()`, `onNavigateToStep` prop, truck count validation, new submission fields |
| `vibe/src/components/shipments/EditShipmentWizard.tsx` | Same changes as NewShipmentWizard for consistency |
| `vibe/src/i18n/ar.json` | Added Arabic translations for new labels |
| `vibe/src/i18n/en.json` | Added English translations for new labels |

#### Acceptance Criteria Met
1. ✅ Complete shipment: All fields display correctly, submit works
2. ✅ Missing supplier: Shows "المورد: غير محدد" + Edit link, submit blocked
3. ✅ Final owner default: Internal branch shipment shows branch as final owner
4. ✅ External customer flow: External entity names display correctly
5. ✅ Navigation: Edit links navigate to correct wizard steps

**Results:**
- Review section now shows complete Commercial & Ownership Summary ✅
- Missing fields clearly indicated with warning styling ✅
- Submission blocked for incomplete shipments with clear error message ✅
- Edit links enable quick navigation to fix issues ✅
- Build passes cleanly ✅

---

### January 3, 2026 - Session: Combined Document Upload Feature (Step 5 Enhancement)
**Agent:** Claude Opus 4.5
**Work Done:**

#### Feature Overview
Implemented a new document upload mode in the New Shipment Wizard - Section 5 (Document Upload) that allows users to upload all required documents as a single combined file, while maintaining compatibility with existing per-document uploads.

#### Upload Mode Toggle
Added a toggle UI in Step 5 with two options:
- **رفع كل مستند بشكل منفصل** (Upload Each Document Separately) - Default mode, existing behavior
- **رفع كامل المستندات في ملف واحد** (Upload All Documents in One File) - New combined mode

#### Combined Mode Features
1. **Single File Uploader:**
   - Large drop zone with emerald/teal gradient styling
   - Supports PDF, JPG, PNG, DOCX (up to 50MB)
   - Preview with file name, size, and upload date
   - Replace and Remove buttons
   - Preview button for PDFs (opens in new tab)

2. **Optional Document Types Tagging:**
   - Collapsible section to tag which document types are contained
   - Checkboxes for each relevant document type
   - Visual tags displayed in the file preview
   - Non-blocking - not required for submission

3. **Metadata Saved:**
   - File name, upload timestamp, file type/size
   - uploadedBy (user ID)
   - containedDocTypes[] (optional tagging)
   - Stored as `doc_type: 'combined_documents'`

#### Files Created/Modified
| File | Changes |
|------|---------|
| `vibe/src/components/shipments/wizard/Step5Documents.tsx` | Complete rewrite with upload mode toggle, combined uploader UI |
| `vibe/src/components/shipments/wizard/types.ts` | Added `DocumentUploadMode`, `CombinedDocumentBundle` interfaces |
| `vibe/src/components/shipments/NewShipmentWizard.tsx` | Updated submit handler for combined mode |
| `vibe/src/services/documents.ts` | Added `combined_documents` to DocumentType union |

#### Type Definitions Added (`types.ts`)
```typescript
export type DocumentUploadMode = 'separate' | 'combined';

export interface CombinedDocumentBundle {
  file: File | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadDate: string;
  uploadedBy?: string;
  containedDocTypes: DocumentType[];
  notes: string;
}

// Added to ShipmentFormData:
documentUploadMode: DocumentUploadMode;  // default: 'separate'
combinedDocumentBundle: CombinedDocumentBundle | null;
```

#### Arabic UX Copy
- Toggle label: "طريقة رفع المستندات"
- Separate option: "رفع كل مستند بشكل منفصل"
- Combined option: "رفع كامل المستندات في ملف واحد"
- Combined uploader label: "ملف المستندات الكامل"
- Helper: "يفضل رفع ملف PDF واحد يحتوي على جميع المستندات المطلوبة"

#### Validation Rules
- **Separate mode:** Existing per-document validation maintained
- **Combined mode:** Individual document uploads not enforced; combined file required when docs needed
- Helper text warns: "يفضل أن يكون الملف PDF ويشمل جميع المستندات المطلوبة"

#### Downstream Compatibility
- Combined documents appear in document lists as "ملف المستندات الكامل (Combined Documents)"
- Uses 📚 icon in document panels
- Works with existing document retrieval APIs
- Access control matches existing document rules

**Results:**
- Default behavior unchanged (separate mode) ✅
- Combined mode upload works ✅
- Build successful with no errors ✅
- Backward compatible with existing shipments ✅

---

### January 6, 2026 - Session: Grant Logistics Role Contract Edit Access
**Agent:** Claude Opus 4.5
**Work Done:**

#### Problem
User a.alobid with "Logistics" role was denied access to edit contracts via the contract wizard. The system showed "Access Denied - You do not have permission to modify this resource".

#### Root Cause
The Logistics role had only `'read'` access to the `contracts` module, which allowed viewing but not creating/editing contracts.

#### Solution
Updated the Logistics role permissions from `contracts: 'read'` to `contracts: 'full'` in both:
- `app/src/middleware/permissions.ts` (backend)
- `vibe/src/contexts/PermissionContext.tsx` (frontend)

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/middleware/permissions.ts` | Logistics role: `contracts: 'read'` → `contracts: 'full'` |
| `vibe/src/contexts/PermissionContext.tsx` | Logistics role: `contracts: 'read'` → `contracts: 'full'` |

**Results:**
- Logistics role users can now create and edit contracts ✅
- Backend rebuilt successfully ✅

---

### January 6, 2026 - Session: Fix Supplier Name Showing UUID Instead of Name
**Agent:** Claude Opus 4.5
**Work Done:**

#### Problem Identified
User reported that the Shipment Detail Page was showing supplier UUID (`86b8f382-f8b7-45da-a007-be89a1de2762`) instead of the actual company name in the "المورد" (Supplier) field.

#### Root Cause
Migration 140 (`140_truck_count_transport_responsibility.sql`) recreated the `v_shipments_complete` view but accidentally omitted the JOIN statements that resolved company names from UUIDs:
- Missing: `supplier_name` (from `master_data.companies`)
- Missing: `customer_name` (from `master_data.companies`)
- Missing: `shipping_line_name` (from `master_data.companies`)
- Missing: `pol_name`, `pod_name` (from `master_data.ports`)
- Missing: `contract_no` (from `logistics.contracts`)

Migration 132 had correctly added these columns, but migration 140 used `CREATE OR REPLACE VIEW` with the full view definition but forgot to include the company/port name JOINs.

#### Solution Implemented
Created migration 141 (`141_fix_view_name_columns.sql`) that:
1. Drops and recreates `v_shipments_complete` view
2. Restores all missing JOINs to resolve names from UUIDs:
   - `LEFT JOIN master_data.companies sup ON sup.id = p.supplier_id`
   - `LEFT JOIN master_data.companies cust ON cust.id = p.customer_id`
   - `LEFT JOIN master_data.companies ship_line ON ship_line.id = p.shipping_line_id`
   - `LEFT JOIN master_data.companies buyer_comp ON buyer_comp.id = p.buyer_id`
   - `LEFT JOIN master_data.ports pol ON pol.id = l.pol_id`
   - `LEFT JOIN master_data.ports pod ON pod.id = l.pod_id`
   - `LEFT JOIN logistics.contracts con ON con.id = s.contract_id`
3. Adds all name columns to the SELECT statement

#### Files Created
| File | Purpose |
|------|---------|
| `app/src/db/migrations/141_fix_view_name_columns.sql` | Fixes v_shipments_complete view to include name columns |

#### Verification
After applying the migration, shipment CIV-102492 now correctly shows:
- `supplier_name: "AGT Foods"` instead of UUID

All name columns verified working:
- `supplier_name`, `customer_name`, `shipping_line_name` from companies table
- `pol_name`, `pod_name` from ports table
- `contract_no` from contracts table

**Results:**
- Supplier shows actual company name instead of UUID ✅
- All other name columns restored ✅
- Frontend will display correctly after page refresh ✅

---

### January 6, 2026 - Session: Bank Transfer Order Generation System
**Agent:** Claude Opus 4.5
**Work Done:**

#### Feature Overview
Built a system to generate bank transfer orders for Yapi Kredi Bank using the bank's official DOCX template. The system fills placeholders in the template while preserving the bank's logo, formatting, and exact structure.

#### Implementation Details

**Backend (`app/src/routes/transfers.ts`):**
- `POST /api/transfers/generate-order` - Generates filled DOCX from template
- `POST /api/transfers/generate-order-pdf` - Generates DOCX then converts to PDF using LibreOffice
- Uses `docxtemplater` library to fill placeholders in DOCX template
- Uses LibreOffice headless mode for DOCX→PDF conversion

**Frontend (`vibe/src/components/transfers/TransferOrderModal.tsx`):**
- Form with all transfer order fields (currency, amount, beneficiary, bank details, etc.)
- Auto-populates from supplier banking info and shipment data
- Preview panel using `docx-preview` library to render the filled DOCX
- "Download DOCX" button - downloads the filled template
- "Download PDF" button - converts DOCX to PDF and downloads

**Template System (`app/templates/`):**
- `yapi_kredi_transfer_template.docx` - Bank's official template with placeholders
- Script: `app/scripts/create-bank-template.js` - Creates template with placeholders from empty bank form

**Template Placeholders:**
| Placeholder | Field |
|-------------|-------|
| `{{amount}}` | Transfer amount (formatted with commas) |
| `{{transfer_date}}` | Transfer date |
| `{{sender_name}}` | Sender company name |
| `{{sender_customer_number}}` | Bank customer number |
| `{{beneficiary_name}}` | Beneficiary/supplier name |
| `{{beneficiary_address}}` | Beneficiary address |
| `{{bank_info}}` | Bank name, branch, country |
| `{{swift_code}}` | SWIFT/BIC code |
| `{{iban_or_account}}` | IBAN or account number |
| `{{correspondent_bank}}` | Intermediary bank |
| `{{invoice_info}}` | Invoice/proforma reference |
| `{{payment_details}}` | Payment description |
| `{{sha_checked}}` | ☑/☐ for SHA charge type |
| `{{our_checked}}` | ☑/☐ for OUR charge type |
| `{{ben_checked}}` | ☑/☐ for BEN charge type |

#### Dependencies Added
- **Backend:** `docxtemplater`, `pizzip` (npm packages)
- **Frontend:** `docx-preview` (npm package)
- **System:** LibreOffice (for PDF conversion) - installed via `brew install --cask libreoffice`

#### Files Created/Modified
| File | Purpose |
|------|---------|
| `app/src/routes/transfers.ts` | Added DOCX/PDF generation endpoints |
| `app/scripts/create-bank-template.js` | Script to create template with placeholders |
| `app/templates/yapi_kredi_transfer_template.docx` | Bank template with placeholders |
| `vibe/src/components/transfers/TransferOrderModal.tsx` | Modal with form, preview, and download buttons |
| `vibe/src/components/transfers/TransferOrderPDF.tsx` | (Legacy HTML PDF - no longer used) |
| `vibe/src/components/transfers/index.ts` | Export file |
| `vibe/src/pages/ShipmentDetailPage.tsx` | Added "Transfer Order" button |

#### Access Point
- **Shipment Detail Page** → "Transfer Order" button (visible when shipment has a supplier with banking info)

#### Future Expansion
This system is designed to support multiple bank templates. To add a new bank:
1. Get the empty DOCX template from the bank
2. Create a placeholder script similar to `create-bank-template.js`
3. Add the template to `app/templates/`
4. Update the backend route to select template based on bank
5. Update the frontend to allow bank selection

**Results:**
- DOCX generation with bank's exact template ✅
- PDF conversion via LibreOffice ✅
- Preview using docx-preview library ✅
- Auto-populate from supplier/shipment data ✅

---

### January 9, 2026 - Session: Shared Warehouse Access System (LOYAL Antrepo)
**Agent:** Claude Opus 4.5
**Work Done:**

Implemented a shared warehouse access system allowing warehouses to be accessible by multiple branches.

#### Problem
The Antrepo warehouse was only accessible by Loyal HQ (its parent branch). Business requirement was to make it accessible by:
- Loyal HQ
- Loyal Turkey
- Loyal Syria North (Mahmut)

#### Solution: Shared Warehouse Access System

**1. Database Schema Changes (Migration 142):**
- Created `master_data.warehouse_branch_access` junction table
- Added `is_shared` column to `master_data.branches`
- Created `master_data.v_warehouse_access` view for querying access
- Renamed "Antrepo" to "LOYAL Antrepo" with Turkish location data

**2. Backend API Updates (`app/src/routes/branches.ts`):**
- Enhanced `/api/branches/warehouses` endpoint to include:
  - `is_shared` boolean flag
  - `shared_with_branches` array of branch IDs

**3. Frontend Updates:**
- Updated `Branch` interface in `useBranches.ts` with `is_shared` and `shared_with_branches`
- Updated warehouse filtering logic in:
  - `Step1BasicInfo.tsx` (Shipment Wizard)
  - `Step1CommercialParties.tsx` (Contract Wizard)
  - `ETAVerificationModal.tsx`
- Shared warehouses now show with ⭐ indicator in dropdowns

#### New Database Tables/Views

```sql
-- Junction table for shared warehouse access
master_data.warehouse_branch_access (
  id, warehouse_id, branch_id, created_at, created_by, notes
)

-- View showing all warehouse access (parent + shared)
master_data.v_warehouse_access (
  warehouse_id, warehouse_name, warehouse_name_ar, is_shared,
  accessible_by_branch_id, accessible_by_branch_name, access_type
)
```

#### Access Logic

A warehouse is accessible by a branch if:
1. **Parent relationship:** `warehouse.parent_id = branch.id` (standard)
2. **Shared access:** Entry exists in `warehouse_branch_access` table

Frontend filtering logic:
```typescript
const getAccessibleWarehouses = (branchId: string) => {
  return branches.filter(b => 
    b.branch_type === 'warehouse' && (
      b.parent_id === branchId ||
      (b.is_shared && b.shared_with_branches?.includes(branchId))
    )
  );
};
```

#### LOYAL Antrepo Access

| Branch | Access Type |
|--------|-------------|
| Loyal HQ | Parent (primary owner) |
| Loyal Turkey | Shared |
| Loyal Syria North (Mahmut) | Shared |

#### Files Created/Modified

| File | Changes |
|------|---------|
| `app/src/db/migrations/142_shared_warehouse_access.sql` | New migration |
| `app/src/routes/branches.ts` | Added `is_shared`, `shared_with_branches` to response |
| `vibe/src/hooks/useBranches.ts` | Updated `Branch` interface |
| `vibe/src/components/shipments/wizard/Step1BasicInfo.tsx` | Added `getAccessibleWarehouses()` helper |
| `vibe/src/components/contracts/wizard/Step1CommercialParties.tsx` | Updated warehouse filtering |
| `vibe/src/components/tracking/ETAVerificationModal.tsx` | Updated warehouse filtering |

#### Edge Cases Handled

1. **Filtering by branch:** Warehouse dropdowns now include both direct children AND shared warehouses
2. **Visual indicator:** Shared warehouses show ⭐ suffix in dropdown options
3. **Backward compatibility:** Existing warehouses with `parent_id` continue to work normally
4. **Adding more shared access:** Simply insert into `warehouse_branch_access` table

**Results:**
- LOYAL Antrepo accessible by 3 branches ✅
- Shared warehouse system extensible for future use ✅
- No breaking changes to existing functionality ✅

---

### January 16, 2026 - Session: Branch-Restricted Exec Role
**Agent:** Claude Opus 4.5
**Work Done:**

Implemented conditional global access for Exec users, allowing C-level executives to be optionally restricted to specific branches.

#### Problem
Previously, all Exec users had global access (could see all data across all branches). This didn't support the use case of a regional executive (e.g., Turkish COO) who should only see data for their specific region.

#### Solution
Changed from role-based global access to conditional global access:
- **Admin:** Always has global access (unchanged)
- **Exec:** Conditional - global access only if NO branches assigned; branch-restricted if branches ARE assigned
- **Other roles:** Always branch-restricted (unchanged)

#### Implementation

**1. Backend Permissions (`app/src/middleware/permissions.ts`):**
- Changed `GLOBAL_ACCESS_ROLES` from `['Admin', 'Exec']` to `['Admin']`
- Added `CONDITIONAL_GLOBAL_ROLES: Role[] = ['Exec']`
- Added `hasConditionalGlobalAccess()` helper function

**2. Backend Branch Filter (`app/src/middleware/branchFilter.ts`):**
- Updated `loadUserBranches` middleware to check branch assignments for Exec users
- If Exec has no branches → global access
- If Exec has branches → restrict to those branches

**3. Backend Auth Response (`app/src/routes/auth.ts`):**
- Added `computeHasGlobalAccess()` helper function
- Added `has_global_access` boolean to login and /me endpoint responses
- Updated `/me/branches` endpoint to use new logic

**4. Frontend Permission Context (`vibe/src/contexts/PermissionContext.tsx`):**
- Updated `hasGlobalAccess()` to use backend-computed `has_global_access` field
- Maintains backward compatibility with fallback logic

#### Usage
**Make an Exec branch-restricted:**
1. Go to Users page → Edit the Exec user
2. Assign them to specific branches (e.g., "Loyal Turkey")
3. Save - they will now only see Turkish branch data

**Make an Exec company-wide:**
1. Go to Users page → Edit the Exec user
2. Remove all branch assignments (leave empty)
3. Save - they will see all data globally

#### Files Modified
| File | Changes |
|------|---------|
| `app/src/middleware/permissions.ts` | Separated global and conditional global roles |
| `app/src/middleware/branchFilter.ts` | Check Exec branch assignments |
| `app/src/routes/auth.ts` | Added `has_global_access` to responses |
| `vibe/src/contexts/PermissionContext.tsx` | Use backend-computed global access |

**Results:**
- Exec users can now be branch-restricted ✅
- Backward compatible - existing Exec users without branches retain global access ✅
- Frontend correctly shows/hides data based on computed access ✅

---

## Next Steps for Fresh Agent

### All Major Normalization Complete ✅
Both shipments and contracts are now fully normalized:
- **Shipments:** lines, containers, batches → normalized tables
- **Contracts:** lines → normalized table

### Partial Shipment & Contract Fulfillment System ✅
The partial shipment system is fully implemented:
- **Backend:** Fulfillment calculations in contracts API, auto-fulfillment in shipments API
- **Frontend:** Improved wizard UX (both create and edit), fulfillment progress in contract detail page
- **Traceability:** Full chain from Contract Line → Shipment → Clearance → Transport
- **Auto-status:** Contracts automatically marked `FULFILLED` when 100% shipped

**Key Endpoints:**
- `GET /contracts/:id` - Includes per-line fulfillment data
- `GET /contracts/:id/fulfillment-status` - Detailed fulfillment breakdown
- `GET /contracts/:id/traceability` - Full traceability chain
- `POST /shipments` - Validates quantities, warns on exceed, auto-fulfills contract

**Wizard UX Features:**
- Shows contracted/shipped/pending quantities per line
- Progress bar with fulfillment percentage
- Color-coded quantity inputs (blue/yellow/red)
- Projected fulfillment after this shipment
- Works in both NewShipmentWizard AND EditShipmentWizard

### Document Filing System ✅
The document filing system is fully implemented:
- **Backend:** API routes, file storage service with structured naming
- **Frontend:** DocumentPanel, DocumentUploadModal, DocumentPermissionsModal, DocumentsPage
- **Integration:** ShipmentDetailPage, ContractDetailPage, NewShipmentWizard, EditShipmentWizard, EFaturaPage

**Design Note:** Contract Wizard does NOT have document upload - this is intentional. Documents are primarily associated with shipments. The proforma invoice (used to create contracts) is uploaded when creating the shipment. Contract-related documents can be uploaded via the ContractDetailPage if needed.

### Route Management & Border Crossing System ✅
The multi-stage clearance system is fully implemented:
- **Master Data:** Border crossings table with seed data for Turkey borders
- **Shipment Logistics:** Extended with `is_cross_border`, `primary_border_crossing_id`, `internal_transport_mode`
- **Shipment Border Stage:** New `border_stage` field tracks shipment progress through border workflow
- **Outbound Deliveries:** Extended with `border_crossing_id`, `border_eta`, `delivery_leg`
- **Admin UI:** Border crossings management page at `/border-crossings`
- **Mobile UI:** Field agent interface at `/border-agent` with stage-based workflow
- **Analytics:** Route-based cost breakdown in Analytics page

**Route Types:**
1. **International Route:** POL → POD (sea/air freight)
2. **Internal Route:** POD → Final Destination (land transport, may cross border)

**Border Agent Workflow (Stage-Based):**
1. `pending_at_pod` - Cross-border shipment with CC date, waiting for transport
2. `on_the_way` - Internal transport assigned, ETA to border visible
3. `at_border` - Arrived at border, waiting for clearance
4. `clearing` - Customs clearance in progress
5. `cleared` - Clearance complete, costs entered

**Automatic Stage Transitions:**
- Shipment set to cross-border + CC date → `pending_at_pod`
- Outbound delivery created for cross-border shipment → `on_the_way`
- Border agent confirms arrival → `at_border`
- Border agent starts clearance → `clearing`
- Border agent enters costs → `cleared`

### Cafeteria Voting System ✅
The cafeteria voting system is fully implemented:
- **Cafe role:** Full access to post menus, view votes, manage suggestions
- **All users:** Can vote, view today's menu, submit suggestions
- **Floating widget:** Appears on all pages (CafeWidget in Layout)
- **Chef dashboard:** `/cafe` page for menu management
- **Scheduler:** 5:30 PM reminder + 6:00 PM voting close (weekdays)

**Workflow:**
1. Chef posts 3 options for tomorrow via dashboard
2. Employees vote via floating widget
3. At 6 PM voting closes automatically
4. Winner announced (or tie notification sent to chef)
5. Winner displayed in today's menu section

### OCR Fallback Extraction ✅
The AI document extraction system now supports aggressive fallback behavior:

**Key Features:**
- CI extraction accepts: B/L, Packing List, Certificate of Origin, Proforma Invoice
- B/L extraction accepts: Commercial Invoice, Packing List, Certificate of Origin
- Auto-fills form fields with data from ANY available document
- Shows warning banner indicating fallback source
- Only fails if document is truly empty/corrupted

**User Benefit:** Users can upload whatever document they have available. The system extracts maximum useful data instead of failing with "wrong document type" errors.

**Implementation:** `app/src/services/openai.ts` - `buildCIExtractionPrompt()`, `buildBOLExtractionPrompt()`, `extractFromCommercialInvoice()`, `extractFromBOL()`

### Bank Transfer Order Generation ✅
System for generating bank transfer orders using the bank's official DOCX templates:

**Current Banks Supported:**
- Yapi Kredi Bank (Turkey) - Import Transfer Form

**How It Works:**
1. User clicks "Transfer Order" button on Shipment Detail Page
2. Form opens with data auto-populated from supplier banking info + shipment
3. User reviews/edits fields as needed
4. "Refresh" shows preview of filled template using `docx-preview`
5. "Download DOCX" generates filled template using `docxtemplater`
6. "Download PDF" converts DOCX to PDF via LibreOffice

**Key Files:**
| File | Purpose |
|------|---------|
| `app/templates/yapi_kredi_transfer_template.docx` | Yapi Kredi template with placeholders |
| `app/scripts/create-bank-template.js` | Script to add placeholders to bank template |
| `app/src/routes/transfers.ts` | Backend endpoints for DOCX/PDF generation |
| `vibe/src/components/transfers/TransferOrderModal.tsx` | Frontend modal with form and preview |

**Adding New Bank Templates:**
1. Obtain empty DOCX template from the bank
2. Analyze XML structure: `unzip template.docx -d temp && cat temp/word/document.xml`
3. Create script to identify empty cells and add `{{placeholder}}` tags
4. Run script to generate `app/templates/{bank}_transfer_template.docx`
5. Update backend to select template based on bank parameter
6. Update frontend to allow bank selection

**Dependencies:**
- Backend: `docxtemplater`, `pizzip`
- Frontend: `docx-preview`
- System: LibreOffice (for PDF conversion)

### FB Interface + Quality Incident System ✅
The Final Beneficiary inventory interface and quality incident reporting system is fully implemented:

**Inventory Dashboard (`/inventory`):**
- Shipment list for user's assigned branch
- Display: SN, goods, quantity, containers, purchase price, total landed cost, origin, route, ETA
- Sorting: by ETA, weight, price, creation date
- "Mark Delivered" button with quality check modal
- "Continue Report" for incomplete incidents
- "View Quality Report" for submitted incidents

**Quality Incident Wizard (`/quality-incident/:id`):**
- Multi-select problem types (Mold, Broken, Moisture, Foreign Matter, Wrong Spec, Damaged)
- Simplified 3-location photo capture (Front, Middle, Back) with 3 photos each
- Defect measurements (broken_g, mold_g, foreign_g, other_g, moisture_pct)
- Container condition assessment (toggles)
- Auto-calculated defect percentages
- Automatic HOLD status when incident created
- Read-only report view for submitted incidents

**Quality Review Page (`/quality-incidents`):**
- For Supervisor and HQ SCLM roles
- Incident list with status filters
- Action buttons: Request Resampling, Keep HOLD, Clear HOLD, Close

**Delivery Flow:**
1. Goods arrive → "Mark Delivered" clicked
2. Modal asks "Any quality issues?"
3. **No issues:** Delivery confirmed, supplier credited for successful delivery
4. **Has issues:** Quality Incident Wizard opens, HOLD applied
5. After wizard submission: Delivery confirmed with incident, supervisor notified

### Optional Improvements
1. **Clean up old `extra_json` data** in legacy contracts
2. **Add indexes** if query performance becomes an issue
3. **Add foreign key constraints** between contract_lines and products table if needed
4. **Add more border crossings** as needed (Iran, Georgia, etc.)
5. **Add push notifications** for border agents when shipments reach their border
6. **Add 48-hour reminder** for quality feedback after delivery
7. **Add PDF export** for quality incident reports
8. **Add offline support** for Quality Incident Wizard (PWA)
9. **Contract Wizard border crossing** - Ensure contract wizard loads border crossing on edit (similar to shipment wizard fix)

---

## Critical Rules for Agents

### 🔴 NEVER DO THIS

1. **Never run `npx ts-node tools/field-mapping-audit.ts`** without explicit user approval - it regenerates field-mappings.json and destroys approval states

2. **Never query `logistics.shipments` directly** for SELECT - always use `logistics.v_shipments_complete`

3. **Never create "clean slate" migrations** that drop all tables - use incremental migrations

4. **Never change database schema** without updating all consuming routes first

5. **Never use `direction` column** - it's `transaction_type` now

6. **Never run `import-main-data.ts` without `--dry-run` first** - it clears all transactional data (shipments, contracts, transactions) before importing. Use two-file mode: `--contracts-file` + `--shipments-file`

### ✅ ALWAYS DO THIS

1. **Check this document first** before making major changes

2. **Use views for SELECT, base tables for INSERT/UPDATE/DELETE**

3. **Test changes locally** before committing

4. **Update this document** after completing significant work

5. **Add session log entry** summarizing what was done

### Database Query Patterns

```typescript
// ✅ CORRECT - SELECT from view
const result = await pool.query(`
  SELECT s.sn, s.product_text, s.eta, s.transaction_type
  FROM logistics.v_shipments_complete s
  WHERE s.id = $1
`, [id]);

// ❌ WRONG - SELECT from base table (missing columns!)
const result = await pool.query(`
  SELECT s.sn, s.product_text, s.eta
  FROM logistics.shipments s
  WHERE s.id = $1
`, [id]);

// ✅ CORRECT - INSERT to base table
await pool.query(`
  INSERT INTO logistics.shipments (sn, status, transaction_type)
  VALUES ($1, $2, $3)
`, [sn, 'planning', 'incoming']);
```

---

## Quick Reference

### Common File Locations

| What | Where |
|------|-------|
| Shipments routes | `app/src/routes/shipments.ts` |
| Contracts routes | `app/src/routes/contracts.ts` |
| E-Fatura routes | `app/src/routes/efatura.ts` |
| Land Transport routes | `app/src/routes/landTransport.ts` |
| Customs Clearing Costs routes | `app/src/routes/customsClearingCosts.ts` |
| Accounting routes | `app/src/routes/accounting.ts` |
| New Shipment wizard | `vibe/src/components/shipments/NewShipmentWizard.tsx` |
| Edit Shipment wizard | `vibe/src/components/shipments/EditShipmentWizard.tsx` |
| Wizard Step 1 (Basic Info) | `vibe/src/components/shipments/wizard/Step1BasicInfo.tsx` |
| Wizard Step 6 (Review) | `vibe/src/components/shipments/wizard/Step6Review.tsx` |
| Contract wizard | `vibe/src/components/contracts/wizard/ContractWizard.tsx` |
| E-Fatura Card | `vibe/src/components/efatura/EFaturaCard.tsx` |
| Pending Clearances Table | `vibe/src/components/customs/PendingClearancesTable.tsx` |
| Ready For Delivery Table | `vibe/src/components/land-transport/ReadyForDeliveryTable.tsx` |
| Accounting Page | `vibe/src/pages/AccountingPage.tsx` |
| Auth middleware | `app/src/middleware/auth.ts` |
| Branch filtering | `app/src/middleware/branchFilter.ts` |
| Permissions | `app/src/middleware/permissions.ts` |
| Database client | `app/src/db/client.ts` |
| Database migrations | `app/src/db/migrations/` |
| Contracts service | `vibe/src/services/contracts.ts` |
| E-Fatura service | `vibe/src/services/efatura.ts` |
| Accounting service | `vibe/src/services/accounting.ts` |
| Transfer Order routes | `app/src/routes/transfers.ts` |
| Transfer Order templates | `app/templates/` |
| Transfer Order template script | `app/scripts/create-bank-template.js` |
| Transfer Order modal | `vibe/src/components/transfers/TransferOrderModal.tsx` |
| E2E Field Mapping Test | `tools/field-mapping-e2e-test.ts` |
| Field Mapping Audit | `tools/field-mapping-audit.ts` |
| Main Data CSV Import | `tools/import-main-data.ts` |
| Shipments CSV Import (old) | `tools/import-shipments-csv.ts` |
| useAutocomplete Hook | `vibe/src/hooks/useAutocomplete.ts` |
| AutocompleteInput Component | `vibe/src/components/common/AutocompleteInput.tsx` |
| **Document Filing System** | |
| Documents API routes | `app/src/routes/documents.ts` |
| File Storage Service | `app/src/services/fileStorage.ts` |
| Documents Frontend Service | `vibe/src/services/documents.ts` |
| DocumentPanel Component | `vibe/src/components/documents/DocumentPanel.tsx` |
| DocumentUploadModal | `vibe/src/components/documents/DocumentUploadModal.tsx` |
| DocumentPermissionsModal | `vibe/src/components/documents/DocumentPermissionsModal.tsx` |
| DocumentsPage | `vibe/src/pages/DocumentsPage.tsx` |
| Documents Migration | `app/src/db/migrations/110_documents_system.sql` |
| Storage Directory | `/storage/documents/` |
| **Route Management & Border Crossing System** | |
| Border Crossings API | `app/src/routes/borderCrossings.ts` |
| Border Crossings Service | `vibe/src/services/borderCrossings.ts` |
| Border Crossings Hook | `vibe/src/hooks/useBorderCrossings.ts` |
| Border Crossings Admin Page | `vibe/src/pages/BorderCrossingsPage.tsx` |
| Border Agent Page (Mobile) | `vibe/src/pages/BorderAgentPage.tsx` |
| Route Migration | `app/src/db/migrations/115_route_border_system.sql` |
| Shipment Wizard Logistics | `vibe/src/components/shipments/wizard/Step4Logistics.tsx` |
| **FB Interface & Quality Incident System** | |
| Inventory API | `app/src/routes/inventory.ts` |
| Quality Incidents API | `app/src/routes/qualityIncidents.ts` |
| Inventory Service | `vibe/src/services/inventory.ts` |
| Quality Incidents Service | `vibe/src/services/qualityIncidents.ts` |
| Inventory Dashboard Page | `vibe/src/pages/InventoryDashboardPage.tsx` |
| Quality Review Page | `vibe/src/pages/QualityReviewPage.tsx` |
| Quality Incident Wizard | `vibe/src/components/quality/QualityIncidentWizard.tsx` |
| Problem Type Selector | `vibe/src/components/quality/ProblemTypeSelector.tsx` |
| Sample Card Form | `vibe/src/components/quality/SampleCardForm.tsx` |
| Quality Incidents Migration | `app/src/db/migrations/120_quality_incidents.sql` |
| Measurements Migration | `app/src/db/migrations/121_incident_measurements.sql` |
| Quality Media Storage | `/storage/quality-media/` |
| **Cafeteria Voting System** | |
| Cafe API routes | `app/src/routes/cafe.ts` |
| Cafe validators | `app/src/validators/cafe.ts` |
| Cafe frontend service | `vibe/src/services/cafe.ts` |
| Cafe React Query hooks | `vibe/src/hooks/useCafe.ts` |
| CafeWidget component | `vibe/src/components/cafe/CafeWidget.tsx` |
| CafeSuggestionsModal | `vibe/src/components/cafe/CafeSuggestionsModal.tsx` |
| Chef Dashboard page | `vibe/src/pages/CafeDashboardPage.tsx` |
| Cafe migration | `app/src/db/migrations/130_cafe_system.sql` |
| Scheduler (cafe jobs) | `app/src/services/scheduler.ts` |
| **OCR Fuzzy Matching** | |
| String Similarity Utilities | `app/src/utils/stringMatch.ts` |
| Companies API (fuzzy-match endpoint) | `app/src/routes/companies.ts` |
| **Partial Shipment & Fulfillment System** | |
| Contracts API (fulfillment endpoints) | `app/src/routes/contracts.ts` |
| Shipments API (auto-fulfillment) | `app/src/routes/shipments.ts` |
| Traceability Migration | `app/src/db/migrations/122_traceability_chain.sql` |
| Contracts Service (fulfillment methods) | `vibe/src/services/contracts.ts` |
| Shipment Wizard Step 2 | `vibe/src/components/shipments/wizard/Step2ProductLines.tsx` |
| Edit Shipment Wizard | `vibe/src/components/shipments/EditShipmentWizard.tsx` |
| Contract Detail Page | `vibe/src/pages/ContractDetailPage.tsx` |
| Contracts List Page | `vibe/src/pages/ContractsPage.tsx` |

### Useful Commands

```bash
# Build backend
cd /Users/rafik/loyal-supplychain/app && npm run build

# Run database query
psql -U rafik -d loyal_supplychain -c "YOUR_QUERY"

# Check migration status
psql -U rafik -d loyal_supplychain -c "SELECT name FROM security.migrations ORDER BY name"

# Check shipment count
psql -U rafik -d loyal_supplychain -c "SELECT COUNT(*) FROM logistics.v_shipments_complete WHERE is_deleted = false"

# Run E2E field mapping test
cd /Users/rafik/loyal-supplychain && npx ts-node tools/field-mapping-e2e-test.ts

# Import main CSV data v2.0 (two-file mode - dry run first!)
cd /Users/rafik/loyal-supplychain && npx ts-node tools/import-main-data.ts --dry-run \
  --contracts-file "data/Main Import (1.0)/Contracts (to be shipped).csv" \
  --shipments-file "data/Main Import (1.0)/Shipments.csv"

# Import main CSV data v2.0 (live import - clears existing transactional data)
cd /Users/rafik/loyal-supplychain && npx ts-node tools/import-main-data.ts \
  --contracts-file "data/Main Import (1.0)/Contracts (to be shipped).csv" \
  --shipments-file "data/Main Import (1.0)/Shipments.csv"

# Legacy single-file import (deprecated)
# npx ts-node tools/import-main-data.ts --file "data/file.csv"

# Check documents count
psql -U rafik -d loyal_supplychain -c "SELECT COUNT(*) FROM archive.documents WHERE is_deleted = false"

# List document folders
ls -la /Users/rafik/loyal-supplychain/storage/documents/

# Check border crossings
psql -U rafik -d loyal_supplychain -c "SELECT name, country_from, country_to FROM master_data.border_crossings"

# Check clearances assigned to field agents
psql -U rafik -d loyal_supplychain -c "SELECT clearance_status, COUNT(*) FROM finance.customs_clearing_costs WHERE assigned_to_user_id IS NOT NULL GROUP BY clearance_status"

# Check quality incidents
psql -U rafik -d loyal_supplychain -c "SELECT status, COUNT(*) FROM logistics.quality_incidents GROUP BY status"

# Check shipments on HOLD
psql -U rafik -d loyal_supplychain -c "SELECT sn, hold_status, hold_reason FROM logistics.shipments WHERE hold_status = TRUE"

# List quality media files
ls -la /Users/rafik/loyal-supplychain/storage/quality-media/

# Check contract fulfillment status
psql -U rafik -d loyal_supplychain -c "
SELECT c.contract_no, 
       SUM(cl.quantity_mt) as total_contracted_mt,
       COALESCE(SUM(shipped.shipped_mt), 0) as total_shipped_mt,
       CASE 
         WHEN SUM(cl.quantity_mt) > 0 THEN ROUND((COALESCE(SUM(shipped.shipped_mt), 0) / SUM(cl.quantity_mt) * 100)::numeric, 1)
         ELSE 0 
       END as fulfillment_pct
FROM logistics.contracts c
JOIN logistics.contract_lines cl ON cl.contract_id = c.id
LEFT JOIN LATERAL (
  SELECT SUM(sl.quantity_mt) as shipped_mt
  FROM logistics.shipment_lines sl
  JOIN logistics.shipments s ON sl.shipment_id = s.id AND s.is_deleted = false
  WHERE sl.contract_line_id = cl.id
) shipped ON true
WHERE c.is_deleted = false
GROUP BY c.id, c.contract_no
ORDER BY fulfillment_pct DESC
LIMIT 10"

# Check contracts marked as FULFILLED
psql -U rafik -d loyal_supplychain -c "SELECT contract_no, status, updated_at FROM logistics.contracts WHERE status = 'FULFILLED'"

# Check cafe menu options for tomorrow
psql -U rafik -d loyal_supplychain -c "SELECT option_number, dish_name, dish_name_ar FROM system.cafe_menu_options WHERE menu_date = CURRENT_DATE + 1"

# Check cafe votes for tomorrow
psql -U rafik -d loyal_supplychain -c "SELECT COUNT(*) as total_votes FROM system.cafe_votes WHERE menu_date = CURRENT_DATE + 1"

# Check cafe settings
psql -U rafik -d loyal_supplychain -c "SELECT key, value FROM system.cafe_settings"
```

---

## Production Deployment (DigitalOcean)

The system is deployed on a DigitalOcean Droplet using Docker containers with Caddy as the reverse proxy.

### Server Information

| Item | Value |
|------|-------|
| **Server IP** | `209.38.237.125` |
| **Live URL** | http://209.38.237.125 |
| **SSH Access** | `ssh root@209.38.237.125` |
| **App Directory** | `/opt/loyal-supplychain` |
| **Deployment Method** | Docker Compose |

### Docker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Caddy (Port 80/443)                      │
│                    Reverse Proxy + SSL                      │
└─────────────────────────────────────────────────────────────┘
                    │                    │
         /api/*     │                    │    /*
                    ▼                    ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   Backend (Port 3000)   │  │  Frontend (Nginx:80)    │
│   Node.js + Express     │  │  Static React Build     │
└─────────────────────────┘  └─────────────────────────┘
         │                              
         ▼                              
┌─────────────────────────┐  ┌─────────────────────────┐
│  PostgreSQL (5432)      │  │     Redis (6379)        │
│  loyal_supplychain DB   │  │     Session Cache       │
└─────────────────────────┘  └─────────────────────────┘
```

### Container Names

| Container | Service | Purpose |
|-----------|---------|---------|
| `loyal-backend` | backend | Node.js API server |
| `loyal-frontend` | frontend | Nginx serving React build |
| `loyal-postgres` | postgres | PostgreSQL database |
| `loyal-redis` | redis | Redis cache |
| `loyal-caddy` | caddy | Reverse proxy |

### How to Deploy Changes

#### Standard Deployment (Code Changes)

After pushing changes to GitHub, deploy to production:

```bash
# SSH into the server
ssh root@209.38.237.125

# Navigate to app directory
cd /opt/loyal-supplychain

# Pull latest code
git pull

# Rebuild and restart containers
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build backend

# For frontend changes, rebuild frontend too:
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build frontend
```

#### Quick One-Liner (from local machine)

```bash
# Deploy backend changes
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && git pull && docker compose -f docker-compose.production.yml --env-file .env.production up -d --build backend"

# Deploy all changes (backend + frontend)
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && git pull && docker compose -f docker-compose.production.yml --env-file .env.production up -d --build"
```

#### After Container Recreation

When containers are recreated, fix uploads directory permissions:

```bash
ssh root@209.38.237.125 "docker exec -u root loyal-backend mkdir -p /app/uploads/temp && docker exec -u root loyal-backend chown -R nodejs:nodejs /app/uploads"
```

### Database Operations

#### Run SQL on Production Database

```bash
# Single SQL command
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production exec -T postgres psql -U postgres -d loyal_supplychain -c \"YOUR_SQL_HERE\""

# Multi-line SQL
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production exec -T postgres psql -U postgres -d loyal_supplychain << 'EOF'
CREATE TABLE IF NOT EXISTS schema.table_name (
    id SERIAL PRIMARY KEY,
    column_name TEXT
);
EOF"
```

#### Add Missing Column

```bash
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production exec -T postgres psql -U postgres -d loyal_supplychain -c \"ALTER TABLE schema.table_name ADD COLUMN IF NOT EXISTS column_name TYPE;\""
```

#### Create Missing Table

```bash
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production exec -T postgres psql -U postgres -d loyal_supplychain << 'EOF'
CREATE TABLE IF NOT EXISTS security.table_name (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_table_column ON security.table_name(column);
EOF"
```

### Useful Commands

#### Check Container Status

```bash
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production ps"
```

#### View Backend Logs

```bash
# Last 50 lines
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production logs backend --tail=50"

# Follow logs in real-time
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production logs -f backend"

# Search for errors
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production logs backend --tail=100 2>&1 | grep -E 'error|Error|500'"
```

#### Restart Services

```bash
# Restart backend only
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production restart backend"

# Restart Caddy (after Caddyfile changes)
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production restart caddy"
```

#### Execute Command Inside Container

```bash
# Check if a tool exists
ssh root@209.38.237.125 "docker exec loyal-backend which pdftoppm"

# Run command as root in container
ssh root@209.38.237.125 "docker exec -u root loyal-backend COMMAND"

# Check environment variables
ssh root@209.38.237.125 "docker exec loyal-backend env | grep OPENAI"
```

### Environment Variables

The `.env.production` file on the server contains:

```bash
# Server
DOMAIN=209.38.237.125
NODE_ENV=production

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secret>
POSTGRES_DB=loyal_supplychain

# Security
JWT_SECRET=<secret>
ALLOWED_ORIGINS=http://209.38.237.125

# API
VITE_API_BASE_URL=/api
LOG_LEVEL=info

# OpenAI (for AI OCR)
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=4096
```

To view current env file:
```bash
ssh root@209.38.237.125 "cat /opt/loyal-supplychain/.env.production"
```

To add a new environment variable:
```bash
ssh root@209.38.237.125 "echo 'NEW_VAR=value' >> /opt/loyal-supplychain/.env.production"
# Then restart backend to pick up changes
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production restart backend"
```

### Known Production Issues & Fixes

#### Missing Database Tables/Columns

When code references tables/columns that don't exist in production:

**Symptom:** 500 errors with `"column X does not exist"` or `"relation X does not exist"`

**Solution:** Add the missing schema:
```bash
# Check what's missing in logs
ssh root@209.38.237.125 "cd /opt/loyal-supplychain && docker compose -f docker-compose.production.yml --env-file .env.production logs backend --tail=50 2>&1 | grep 'does not exist'"

# Add the missing column/table (see Database Operations above)
```

**Tables/columns added to production (January 2026):**
- `security.token_usage` - Token theft detection
- `security.suspicious_activity` - IP blocking
- `logistics.shipments.final_destination` (JSONB) - Destination branch info

#### Gateway Timeout on AI Operations

**Symptom:** 504 Gateway Timeout when using AI extraction

**Solution:** The extraction route has a 2-minute timeout. Caddy has 180s read/write timeout. If still timing out, check OpenAI API key is valid.

#### File Upload Permission Denied

**Symptom:** `ENOENT: no such file or directory` or `EACCES: permission denied` for uploads

**Solution:**
```bash
ssh root@209.38.237.125 "docker exec -u root loyal-backend mkdir -p /app/uploads/temp && docker exec -u root loyal-backend chown -R nodejs:nodejs /app/uploads"
```

### Deployment Checklist for Agents

Before deploying:
1. ✅ Commit and push all changes to GitHub
2. ✅ Ensure code compiles locally (`cd app && npm run build`)

After deploying:
1. ✅ Check container status: `docker compose ... ps`
2. ✅ Check for errors in logs: `docker compose ... logs backend --tail=50`
3. ✅ Fix uploads permissions if container was recreated
4. ✅ Test the affected feature on http://209.38.237.125

If errors occur:
1. 📋 Check backend logs for specific error message
2. 🔍 If "does not exist" → Add missing table/column
3. 🔍 If permission error → Fix file permissions
4. 🔍 If timeout → Check route timeout settings

### Troubleshooting

#### All API requests returning 403 Forbidden
**Symptom:** Multiple requests fail with 403 errors, console shows "jwt expired"  
**Cause:** JWT token has expired  
**Solution:** Log out and log back in to get a fresh token

Backend logs will confirm if this is the issue:
```
JWT verification failed: jwt expired Token prefix: eyJhbGciOiJIUzI1NiIs
```

#### Documents uploaded but stored in wrong location
**Symptom:** Document upload returns 200, database shows correct path/filename, but file is stored with original name in a different location (e.g., `/app/storage/documents/` instead of project root)  
**Cause:** `DOCUMENTS_PATH` in `fileStorage.ts` was relative, resolving from where Node runs (`app/dist/`)  
**Solution:** Ensure `DOCUMENTS_PATH` uses an absolute path via `path.resolve(__dirname, '../../storage/documents')`

**Fixed in:** December 16, 2025 session

#### WiFi sharing - Login fails for colleague with CORS error
**Symptom:** Colleague on same WiFi can see the login page, but login fails. Console shows:
```
Access to XMLHttpRequest at 'http://192.168.x.x:3000/api/auth/login' from origin 'http://192.168.x.x:5173' has been blocked by CORS policy
```
**Cause:** Backend CORS not configured for local network (should be fixed now!)  
**Solution:** Backend now has dynamic CORS that accepts any `192.168.x.x` origin. If still failing:
1. Rebuild backend: `cd app && npm run build`
2. Restart backend: `node dist/index.js`

#### WiFi sharing - API calls go to localhost on colleague's machine
**Symptom:** Frontend loads but all API calls fail. Network tab shows requests to `localhost:3000` instead of your IP.  
**Cause:** Frontend `.env` still has `VITE_API_BASE_URL=http://localhost:3000/api`  
**Solution:** Update `vibe/.env` to use your IP address, then restart the Vite dev server:
```bash
# Get your IP first
ipconfig getifaddr en0
# Update .env
echo 'VITE_API_BASE_URL=http://YOUR_IP:3000/api' > vibe/.env
# Restart frontend - MUST restart for .env changes to take effect
cd vibe && npm run dev
```

**Better Solution (January 3, 2026):** Delete the `.env` file entirely. The frontend now uses dynamic API URL detection from `vibe/src/config/api.ts`:
```typescript
// Automatically derives API URL from browser hostname
const { protocol, hostname } = window.location;
return `${protocol}//${hostname}:3000/api`;
```
This means colleagues accessing `http://192.168.1.110:5173` will automatically call `http://192.168.1.110:3000/api`.

#### WiFi sharing - Colleague sees 0 shipments/contracts after login
**Symptom:** Colleague can log in successfully, but sees "0 شحنة" (0 shipments) or empty contracts page.  
**Cause 1:** Missing database function `security.get_user_branch_ids()`  
**Solution 1:** Create the function:
```sql
CREATE OR REPLACE FUNCTION security.get_user_branch_ids(p_user_id uuid)
RETURNS text[] AS $$
DECLARE
  branch_ids text[];
BEGIN
  SELECT ARRAY_AGG(branch_id::text)
  INTO branch_ids
  FROM security.user_branches
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(branch_ids, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql STABLE;
```

**Cause 2:** Branch filter queries referencing wrong table  
**Solution 2:** The `final_destination` column is in `shipment_logistics`, not `shipments`. Ensure all branch filter queries JOIN with `shipment_logistics`:
```sql
-- WRONG (will fail)
SELECT ... FROM logistics.shipments s WHERE s.final_destination->>'branch_id' = ...

-- CORRECT
SELECT ... FROM logistics.shipments s
JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
WHERE sl.final_destination->>'branch_id' = ...
```

**Cause 3:** Contracts show 0 because branch filter looks for linked shipments  
**Solution 3:** In current database, contracts have no linked shipments (`contract_id` is NULL for all shipments). The `buildContractBranchFilter()` function was updated to not filter contracts by branch - access is controlled by role permissions only.

#### Backend 500 errors on /api/contracts
**Symptom:** Contracts page shows "Request failed with status code 500"  
**Cause:** Branch filter query references `ship.final_destination` which doesn't exist on base `shipments` table  
**Solution:** Check `app/src/middleware/branchFilter.ts` - all queries using base `shipments` table must JOIN with `shipment_logistics` to access `final_destination`

---

*This document should be updated by every agent after completing significant work.*

