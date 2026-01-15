# Running Migration 015: Contract Fulfillment Tracking

## Quick Start (When Your Database is Accessible)

```bash
cd /Users/rafik/loyal-supplychain/app
source .env  # Load DATABASE_URL
npm run db:up
```

## What This Migration Does

1. ✅ Adds `contract_line_id` to `shipment_lines` (links shipment lines to contract lines)
2. ✅ Creates `logistics.milestones` table (tracks BOOKING, SAILING, ARRIVAL dates)
3. ✅ Adds indexes for performance
4. ✅ Creates 3 reporting views:
   - `report.contract_overview` - Contract-level fulfillment summary
   - `report.contract_line_fulfillment` - Line-by-line tracking
   - `report.contract_payment_status` - Payment schedule with due dates
5. ✅ Creates `finance.compute_due_date()` function for milestone-based payments

## Verification

After running the migration, check it worked:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'report';

-- Should return:
-- contract_line_fulfillment
-- contract_overview  
-- contract_payment_status

-- Check milestones table
SELECT * FROM logistics.milestones LIMIT 1;

-- Check function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'finance' AND routine_name = 'compute_due_date';
```

## Testing the New Views

```sql
-- Test contract overview
SELECT * FROM report.contract_overview LIMIT 5;

-- Test line fulfillment (should show planned vs shipped)
SELECT 
  contract_no,
  product_name,
  planned_qty,
  shipped_qty,
  remaining_qty,
  percent_fulfilled,
  within_tolerance
FROM report.contract_line_fulfillment 
ORDER BY created_at DESC 
LIMIT 10;

-- Test payment status
SELECT 
  contract_no,
  seq,
  basis,
  computed_due_date,
  is_active,
  is_overdue
FROM report.contract_payment_status
ORDER BY computed_due_date ASC NULLS LAST
LIMIT 10;
```

## Testing the New API Endpoints

Make sure backend is running, then:

```bash
# Replace YOUR-CONTRACT-ID with an actual contract UUID

# Test summary endpoint
curl http://localhost:3000/api/contracts/YOUR-CONTRACT-ID/summary | jq

# Test consumption tracking
curl http://localhost:3000/api/contracts/YOUR-CONTRACT-ID/consumption | jq

# Test documents
curl http://localhost:3000/api/contracts/YOUR-CONTRACT-ID/documents | jq
```

## If Migration Fails

The migration is **idempotent** and safe to rerun. Common issues:

### "relation already exists"
- ✅ OK! The migration checks `IF NOT EXISTS`, this is expected

### "column contract_line_id already exists"
- ✅ OK! The migration checks before adding columns

### "DATABASE_URL not found"
- ❌ Check your `.env` file in the `app/` directory
- Make sure it contains: `DATABASE_URL=postgresql://...`

### "relation logistics.shipment_lines does not exist"
- ❌ Run previous migrations first: `npm run db:up`

## Rollback (if needed)

To undo this migration:

```sql
-- Drop views
DROP VIEW IF EXISTS report.contract_payment_status;
DROP VIEW IF EXISTS report.contract_line_fulfillment;
DROP VIEW IF EXISTS report.contract_overview;

-- Drop function
DROP FUNCTION IF EXISTS finance.compute_due_date(UUID);

-- Remove column (careful - loses data!)
ALTER TABLE logistics.shipment_lines DROP COLUMN IF EXISTS contract_line_id;

-- Drop milestones table (careful - loses data!)
DROP TABLE IF EXISTS logistics.milestones;
```

## Next Steps

1. ✅ Run the migration
2. ✅ Test the API endpoints
3. ⏳ Optionally build the frontend Contract Wizard & Dashboard
4. ⏳ Add tests for the new endpoints

See `CONTRACT_FULFILLMENT_IMPLEMENTATION.md` for full details!

