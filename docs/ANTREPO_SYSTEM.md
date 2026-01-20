# Antrepo (Customs Warehouse) System

## Overview

The Antrepo system is a comprehensive customs warehouse management module integrated into the Loyal Supply Chain application. It enables the Antrepo Master (Hamza) to manage goods stored under customs supervision, track inventory, record entries/exits, and perform handling activities.

### Legal Definition

Under the **Customs Warehousing Procedure (Gümrük Antrepo Rejimi)**, goods can be placed into a customs warehouse:
- **Non-free-circulation goods** (not yet customs-cleared) without being subject to import duties and trade policy measures while they remain in the warehouse
- **Free-circulation goods** may also be warehoused when export-related measures are relevant

A **gümrük antreposu** is defined as a place established to store goods under customs supervision, with conditions/qualities set by secondary legislation.

---

## Implementation Summary

### 1. Database Schema (Migration 144)

**File:** `app/src/db/migrations/144_antrepo_system.sql`

#### New Tables Created:

| Table | Purpose |
|-------|---------|
| `logistics.antrepo_lots` | Physical storage sections/lots within the antrepo |
| `logistics.antrepo_inventory` | Goods currently stored in the antrepo |
| `logistics.antrepo_exits` | Records of goods exiting the antrepo |
| `logistics.antrepo_handling_activities` | Elleçleme (handling) activities performed on goods |
| `logistics.antrepo_storage_fees` | Storage fee tracking |
| `master_data.antrepo_activity_types` | Reference table for allowed handling activities |

#### Columns Added to `logistics.shipments`:

| Column | Type | Purpose |
|--------|------|---------|
| `goes_to_antrepo` | BOOLEAN | Flag indicating shipment is destined for antrepo |
| `assigned_antrepo_id` | UUID | Reference to the assigned antrepo (branch) |
| `assigned_lot_id` | UUID | Pre-assigned storage lot |

#### Database Trigger:

A trigger `trg_auto_set_goes_to_antrepo` automatically sets `goes_to_antrepo = TRUE` when a shipment's Final Destination matches an Antrepo branch.

#### Views Created:

- `logistics.v_antrepo_current_stock` - Current inventory with calculated days in storage
- `logistics.v_antrepo_pending_arrivals` - Shipments flagged for antrepo but not yet entered
- `logistics.v_antrepo_activity_log` - Combined activity log (entries, exits, handling)

---

### 2. Lot Structure (Migration 145)

**File:** `app/src/db/migrations/145_antrepo_lots_update.sql`

Physical lot dimensions configured:

| Lot Code | Name | Capacity (M²) |
|----------|------|---------------|
| A | Section A | 2,700 |
| B | Section B | 2,700 |
| M | Section M | 2,880 |
| L | Section L | 1,400 |
| K | Section K | 770 |
| S | Section S | 1,540 |
| D1 | Section D1 | 400 |
| D2 | Section D2 | 400 |

---

### 3. Backend API

**File:** `app/src/routes/antrepo.ts`

#### Endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/antrepo/dashboard` | Dashboard summary statistics |
| GET | `/api/v1/antrepo/lots` | List all antrepo lots |
| POST | `/api/v1/antrepo/lots` | Create new lot |
| PUT | `/api/v1/antrepo/lots/:id` | Update lot |
| GET | `/api/v1/antrepo/inventory` | List inventory with filters |
| GET | `/api/v1/antrepo/inventory/:id` | Get single inventory item details |
| POST | `/api/v1/antrepo/inventory` | Record goods entry |
| GET | `/api/v1/antrepo/pending-arrivals` | Get shipments awaiting antrepo entry |
| POST | `/api/v1/antrepo/exits` | Record goods exit |
| POST | `/api/v1/antrepo/handling` | Record handling activity |
| GET | `/api/v1/antrepo/activity-log` | Get activity history |
| GET | `/api/v1/antrepo/activity-types` | Get allowed handling activity types |

#### Pending Arrivals Query Features:
- Fetches from `logistics.shipments` with proper joins
- Includes cargo info (weight, containers, bags)
- Includes package details from `shipment_lines`
- Includes container numbers from `shipment_containers` as JSON array
- Filters out shipments already entered into antrepo

---

### 4. Permissions & Roles

**File:** `app/src/middleware/permissions.ts`

#### New Role: `Antrepo`

```typescript
Antrepo: {
  antrepo: 'full',      // Full access to antrepo management
  shipments: 'read',    // View shipments
  inventory: 'read',    // View inventory
  customs: 'read',      // View customs info
  land_transport: 'read', // View transport for transit exits
  dashboard: 'read',
  // ... other modules as 'none'
}
```

#### Module Access Updates:
- Added `antrepo` module to the system
- Updated Admin, Exec, Logistics, Clearance roles with appropriate antrepo access

---

### 5. Frontend Implementation

#### Pages:

| File | Purpose |
|------|---------|
| `vibe/src/pages/AntrepoDashboardPage.tsx` | Main dashboard with tabs for stock, arrivals, activity |
| `vibe/src/pages/AntrepoLotsPage.tsx` | CRUD interface for managing physical lots |

#### Components:

| File | Purpose |
|------|---------|
| `vibe/src/components/antrepo/AntrepoEntryModal.tsx` | Record goods entry into antrepo |
| `vibe/src/components/antrepo/AntrepoExitModal.tsx` | Record goods exit from antrepo |
| `vibe/src/components/antrepo/AntrepoHandlingModal.tsx` | Record handling activities |

#### Services & Hooks:

| File | Purpose |
|------|---------|
| `vibe/src/services/antrepo.ts` | API client functions and TypeScript interfaces |
| `vibe/src/hooks/useAntrepo.ts` | React Query hooks for data fetching |

---

### 6. Entry Modal Design

The entry modal is optimized for the Antrepo workflow:

**Header Section (Read-Only for Verification):**
- Shipment number (SN) and supplier
- Product name
- Quantity (MT)
- Origin country
- Bags count with package weight (e.g., "7,776 BAGS × 25 KG")
- Container count with expandable container numbers list

**Form Fields (Editable):**
- Lot selection (dropdown)
- Beyaname number (customs declaration) - **Required**
- Entry date and time
- Notes (optional)

**Container Details Toggle:**
- Collapsible section showing individual container numbers
- Displays container number, size code, and seal number

---

### 7. Data Sync Fixes (Migration 146)

**File:** `app/src/db/migrations/146_sync_container_counts.sql`

Fixed data inconsistencies between:
- `shipment_cargo.container_count` and actual containers in `shipment_containers`
- `shipment_cargo.bags_count` and package totals in `shipment_lines`

**Backend Sync Added:**
When saving shipments (create or update), `container_count` is now automatically synced with the actual number of containers in `shipment_containers`.

---

### 8. UI/UX Improvements

#### Number Formatting:
- All numeric values display in **English numerals** (1, 2, 3...) regardless of language setting
- Prevents Arabic numeral display (١، ٢، ٣...) for consistency

#### RTL Layout Fixes:
- Fixed text direction for numeric values using `dir="ltr"` with right-alignment
- Ensures proper display order: "194.4 MT • 9 Container" (not reversed)

#### Date Formatting:
- Dates display in Gregorian format (DD/MM/YYYY)
- Uses `en-GB` locale to prevent Hijri calendar display

#### Status Translation:
- Shipment statuses are translated using `SHIPMENT_STATUS_CONFIG`
- Example: `awaiting_clearance` → `في انتظار التخليص`

---

### 9. Elleçleme (Handling Activities)

The system supports all legally permitted handling activities:

1. Ventilation, separation, drying, dust removal, basic cleaning
2. Re-arranging goods after transport
3. Stock counting, sampling, classification, weighing
4. Disposing of damaged/contaminated components
5. Preservation via pasteurization/sterilization
6. Pest treatment
7. Anti-rust treatments
8. Temperature adjustment
9. Electrostatic treatment
10. Simple operations on fruits/vegetables
11. Cleaning/cutting animal hides
12. Adding/removing accessories
13. Diluting or concentrating liquids
14. Mixing same-kind goods
15. Splitting/cutting to measure
16. Packing/unpacking/repacking
17. Testing/configuring machines
18. Processing pipe connections
19. Packing mixed goods (free/non-free circulation)

---

### 10. Exit Types Supported

| Exit Type | Arabic | Description |
|-----------|--------|-------------|
| `transit` | ترانزيت | Re-export via border crossing |
| `port` | تصدير بحري | Export via sea port |
| `domestic` | سوق محلي | Release for free circulation (domestic market) |

---

## Testing Locally

To test the Antrepo system locally:

1. **Start the database:**
   ```bash
   ./scripts/START_DATABASE.sh
   ```

2. **Apply migrations:**
   ```bash
   cd app && npm run db:up
   ```

3. **Start the backend:**
   ```bash
   cd app && npm run dev
   ```

4. **Start the frontend:**
   ```bash
   cd vibe && npm run dev
   ```

5. **Access the Antrepo Dashboard:**
   - Navigate to `/antrepo` in the application
   - Log in with an Admin or Antrepo role user

---

## Files Modified/Created

### Database Migrations:
- `app/src/db/migrations/144_antrepo_system.sql`
- `app/src/db/migrations/145_antrepo_lots_update.sql`
- `app/src/db/migrations/146_sync_container_counts.sql`

### Backend:
- `app/src/routes/antrepo.ts` (new)
- `app/src/routes/shipments.ts` (container sync fix)
- `app/src/middleware/permissions.ts` (Antrepo role)
- `app/src/index.ts` (route registration)

### Frontend:
- `vibe/src/pages/AntrepoDashboardPage.tsx` (new)
- `vibe/src/pages/AntrepoLotsPage.tsx` (new)
- `vibe/src/components/antrepo/AntrepoEntryModal.tsx` (new)
- `vibe/src/components/antrepo/AntrepoExitModal.tsx` (new)
- `vibe/src/components/antrepo/AntrepoHandlingModal.tsx` (new)
- `vibe/src/services/antrepo.ts` (new)
- `vibe/src/hooks/useAntrepo.ts` (new)
- `vibe/src/i18n/en.json` (translations)
- `vibe/src/i18n/ar.json` (translations)
- `vibe/src/components/shipments/wizard/Step1BasicInfo.tsx` (removed manual toggle)

---

## Future Enhancements

1. **Storage Fee Calculation** - Automatic fee calculation based on days stored
2. **Document Attachments** - Link entry/exit documents to inventory records
3. **Reporting** - Detailed reports for customs compliance
4. **Multi-Antrepo Support** - Full support for multiple warehouse locations
5. **Barcode/QR Scanning** - Mobile-friendly entry/exit recording

---

## Related Documentation

- [Database ERD](../DATABASE_ERD_COMPLETE.html)
- [System Architecture](./ARCHITECTURE.md)
- [Development Guide](./DEVELOPMENT.md)
