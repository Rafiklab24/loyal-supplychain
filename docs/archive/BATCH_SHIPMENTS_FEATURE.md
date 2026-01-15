# Batch/Split Shipments Feature

## Overview
This feature allows users to split a single purchase order or sales contract into multiple batches, where each batch can be shipped separately with different vessels, containers, dates, and tracking information.

## Use Case
In supply chain management, it's common for a single order (e.g., 1000 tons of rice) to be shipped in multiple batches over time:
- **Batch 1**: 400 tons on Vessel A, departing March 15
- **Batch 2**: 350 tons on Vessel B, departing April 2
- **Batch 3**: 250 tons on Container C, departing April 20

This feature enables tracking each batch independently while maintaining the parent shipment relationship.

## Current Implementation Status

### ✅ Completed (Frontend)
1. **Type Definitions** (`vibe/src/components/shipments/wizard/types.ts`)
   - Added `ShipmentBatch` interface with full logistics details
   - Added `is_split_shipment` boolean to `ShipmentFormData`
   - Added `batches: ShipmentBatch[]` array to `ShipmentFormData`

2. **Batch Management Component** (`vibe/src/components/shipments/wizard/BatchManagement.tsx`)
   - Collapsible/expandable batch cards
   - Add/remove batch functionality
   - Individual logistics details per batch (POL, POD, ETD, ETA, etc.)
   - Cargo-specific tracking fields per batch
   - BOL numbers per batch
   - Status tracking per batch (planning, in_transit, arrived, delivered)
   - Real-time totals display (total batches, total weight, total containers, total barrels)

3. **Wizard Integration** (`vibe/src/components/shipments/wizard/Step3Logistics.tsx`)
   - Toggle switch to enable/disable split shipment mode
   - Conditional rendering: shows `BatchManagement` when enabled, standard form when disabled

4. **Review Step** (`vibe/src/components/shipments/wizard/Step4Review.tsx`)
   - Displays batch information in review step
   - Shows each batch with all details (weight, containers, dates, tracking info)
   - Conditional rendering based on `is_split_shipment`

### ⚠️ Pending (Backend & Database)

#### Database Migration Needed
The `logistics.shipments` table needs to be updated to store batch data. Two approaches:

**Option 1: JSONB Column (Simpler, Flexible)**
```sql
ALTER TABLE logistics.shipments
ADD COLUMN is_split_shipment BOOLEAN DEFAULT FALSE,
ADD COLUMN batches JSONB;

CREATE INDEX IF NOT EXISTS shipments_split_idx 
  ON logistics.shipments USING gin (batches);
```

**Option 2: Separate Table (Relational, More Complex)**
```sql
CREATE TABLE IF NOT EXISTS logistics.shipment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES logistics.shipments(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  batch_name TEXT,
  
  -- Quantities
  weight_ton NUMERIC(18,3),
  container_count INTEGER,
  barrels NUMERIC(18,2),
  
  -- Logistics
  pol_id UUID REFERENCES master_data.ports(id),
  pod_id UUID REFERENCES master_data.ports(id),
  etd DATE,
  eta DATE,
  shipping_line_id UUID REFERENCES master_data.companies(id),
  booking_no TEXT,
  bl_no TEXT,
  bol_numbers TEXT[], -- Array of BOL numbers
  
  -- Cargo-specific tracking
  container_number TEXT,
  vessel_name TEXT,
  vessel_imo TEXT,
  truck_plate_number TEXT,
  cmr TEXT,
  tanker_name TEXT,
  tanker_imo TEXT,
  
  -- Status
  status logistics.shipment_status_enum,
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS shipment_batches_shipment_idx 
  ON logistics.shipment_batches (shipment_id);

CREATE INDEX IF NOT EXISTS shipment_batches_eta_idx 
  ON logistics.shipment_batches (eta);
```

#### Backend Updates Needed (`app/src/routes/shipments.ts`)

Currently, the POST endpoint accepts `is_split_shipment` and `batches` but doesn't persist them. After the migration:

1. **Update POST /api/shipments**
   ```typescript
   // If using JSONB approach
   const result = await pool.query(
     `INSERT INTO logistics.shipments 
      (sn, product_text, ..., is_split_shipment, batches, ...)
      VALUES ($1, $2, ..., $n, $n+1, ...)`,
     [..., is_split_shipment, JSON.stringify(batches), ...]
   );
   
   // If using separate table approach
   const shipmentResult = await pool.query(`INSERT INTO logistics.shipments ...`);
   const shipmentId = shipmentResult.rows[0].id;
   
   if (is_split_shipment && batches && batches.length > 0) {
     for (const batch of batches) {
       await pool.query(
         `INSERT INTO logistics.shipment_batches 
          (shipment_id, batch_number, batch_name, weight_ton, ...)
          VALUES ($1, $2, $3, $4, ...)`,
         [shipmentId, batch.batch_number, batch.batch_name, batch.weight_ton, ...]
       );
     }
   }
   ```

2. **Update GET /api/shipments**
   - Include batch data when fetching shipments
   - If JSONB: Simply select the column
   - If separate table: JOIN with `shipment_batches` table

3. **Update GET /api/shipments/:id**
   - Include full batch details

4. **Add batch-specific endpoints (optional)**
   - `PATCH /api/shipments/:id/batches/:batchId` - Update a specific batch
   - `GET /api/shipments/:id/batches` - List all batches for a shipment

## UI Features

### Batch Management UI
- **Add Batch Button**: Creates a new batch with pre-filled parent shipment details
- **Collapsible Cards**: Each batch is a card that can be expanded/collapsed
- **Batch Numbering**: Automatic numbering (Batch 1, Batch 2, etc.)
- **Custom Batch Names**: Users can provide descriptive names (e.g., "First Vessel", "Container A")
- **Status Badges**: Visual status indicators (Planning, In Transit, Arrived, Delivered)
- **Totals Display**: Real-time aggregation of quantities across all batches
- **Delete Batch**: Remove individual batches
- **Per-Batch Details**:
  - Weight, Container Count, Barrels (depending on cargo type)
  - POL/POD with autocomplete
  - ETD/ETA date pickers
  - Shipping line selection
  - Booking & BL numbers
  - Multiple BOL numbers
  - Cargo-specific tracking (vessel, truck, tanker info)
  - Notes field

### Review Step Display
When reviewing a split shipment:
- Shows a summary banner: "Split Shipment - X Batches"
- Lists each batch with key details
- Color-coded status badges
- Displays tracking information per batch

## Testing the Feature

### Manual Testing Steps
1. Navigate to **Shipments** page
2. Click **"New Shipment"**
3. Fill in basic information (SN, Product, Direction)
4. Fill in commercial details (Cargo Type, Weight, Price)
5. Navigate to **Logistics** step (Step 4)
6. **Enable** the "Split into Multiple Batches" toggle
7. Click **"Add Batch"** to create batches
8. Fill in logistics details for each batch
9. Expand/collapse batches to verify UI
10. Navigate to **Review** step to see batch summary
11. Click **"Create Shipment"**
12. Check browser console for: `⚠️  Split shipment with X batches received. Batch data not yet persisted (DB migration pending).`

### Expected Behavior (Current)
- ✅ User can create split shipments with multiple batches
- ✅ Each batch can have independent logistics details
- ✅ UI correctly aggregates totals
- ✅ Review step displays all batch information
- ⚠️  Shipment is saved to database BUT batch data is NOT persisted
- ⚠️  Console warning is logged when split shipments are submitted

### Expected Behavior (After Migration)
- ✅ All batch data is persisted to the database
- ✅ Fetching a shipment includes batch details
- ✅ Each batch can be updated independently
- ✅ Batch status can be tracked separately

## Recommendations

### Immediate Next Steps
1. **Decision**: Choose JSONB or separate table approach
   - **JSONB**: Faster to implement, more flexible for evolving requirements
   - **Separate Table**: Better for complex queries and reporting on batches

2. **Create Migration**: Write the SQL migration file (`010_batch_shipments.sql`)

3. **Update Backend**: Implement batch persistence in the POST endpoint

4. **Update GET Endpoints**: Include batch data in responses

5. **Test**: Verify end-to-end functionality (create, read, update split shipments)

### Future Enhancements
- **Batch Analytics**: Dashboard showing batch-level statistics
- **Batch Timeline**: Visual timeline of batch shipping/arrival dates
- **Batch Notifications**: Alerts when a batch status changes
- **Partial Delivery Tracking**: Track which batches have been delivered
- **Batch Documents**: Link documents to specific batches (not just the parent shipment)
- **Batch Financial Tracking**: Split payments across batches

## File References

### Frontend Files
- `vibe/src/components/shipments/wizard/types.ts` - Type definitions
- `vibe/src/components/shipments/wizard/BatchManagement.tsx` - Batch UI component
- `vibe/src/components/shipments/wizard/Step3Logistics.tsx` - Wizard integration
- `vibe/src/components/shipments/wizard/Step4Review.tsx` - Review display

### Backend Files
- `app/src/routes/shipments.ts` - API endpoints (lines 790-860)
- `app/src/db/migrations/002_logistics.sql` - Current shipments table schema

### Documentation
- `BATCH_SHIPMENTS_FEATURE.md` - This file

## Notes
- The frontend is fully functional and ready to use
- Users can interact with split shipments in the UI immediately
- Backend accepts batch data but doesn't persist it (logged to console)
- Database migration is the only blocking item for full functionality
- This is a non-breaking change - existing shipments continue to work as before

