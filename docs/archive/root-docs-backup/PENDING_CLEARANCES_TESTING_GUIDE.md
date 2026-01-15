# Pending Clearances Interface - Testing Guide

## Overview
This guide explains how to test the new Pending Clearances feature that allows customs clearing officers to efficiently enter costs for shipments that have a clearance date set by SCLM.

## Implementation Summary

### What Was Implemented

1. **Backend API Endpoints**
   - `GET /api/customs-clearing-costs/pending-clearances` - Fetch shipments with clearance date but no cost entry
   - `POST /api/customs-clearing-costs/from-pending` - Create cost entry from pending shipment
   - Added validators for both endpoints

2. **Frontend Components**
   - `PendingClearancesTable` - Interactive table with inline editing
   - Tab system in CustomsClearingCostsPage (Customs Costs | Pending Clearances)
   - React hooks for data fetching and mutations

3. **Translations**
   - English and Arabic translations for all UI elements

## Testing Workflow

### Prerequisites
1. Backend server running on port 3000
2. Frontend server running on port 5173
3. Database with at least one shipment that has a `customs_clearance_date` set

### Step 1: Setup Test Data (SCLM Role)

1. **Login as SCLM user** (or user with shipment editing permissions)
2. Navigate to **Shipments** page
3. Select a shipment or create a new one
4. In the shipment wizard, go to **Step 3: Logistics**
5. Set the **Customs Clearance Date** field to any date
6. Save the shipment

### Step 2: Access Pending Clearances (Clearance Officer Role)

1. **Login as Clearance officer** or Admin
2. Navigate to **Customs Clearing Costs** page (from sidebar)
3. Click on the **"Pending Clearances"** tab
4. You should see the shipment from Step 1 in the table

### Step 3: Enter Cost Inline

1. In the Pending Clearances table, find the shipment
2. Click the **"Enter Cost"** button on the row
3. The row will become editable with input fields:
   - **Original Cost**: Enter the base clearance cost (e.g., 1500)
   - **Extra Cost**: Enter any additional costs (e.g., 250)
   - **Total Cost**: Automatically calculated (1750)
4. Click the **green checkmark (✓)** to save
5. The shipment should disappear from the pending list (it now has a cost entry)

### Step 4: Verify Cost Entry

1. Switch back to the **"Customs Costs"** tab
2. Search for the shipment (by SN or product)
3. You should see the newly created cost entry with:
   - Auto-generated file number (based on shipment SN)
   - Linked shipment_id
   - Original clearing amount: 1500
   - Extra cost amount: 250
   - Total clearing cost: 1750

### Step 5: Test Edge Cases

#### Empty Costs
1. Go back to Pending Clearances tab
2. Create another test shipment with clearance date
3. Try to save without entering any costs
4. **Expected**: Alert message "At least one cost field must be greater than zero"

#### Search Functionality
1. In Pending Clearances tab
2. Enter a shipment SN or product name in search box
3. Click Search button
4. **Expected**: Table filters to matching shipments only

#### Pagination
1. If you have more than 50 pending shipments
2. **Expected**: Pagination controls appear at bottom
3. Test navigation between pages

### Step 6: Test in Arabic

1. Switch language to Arabic (العربية) using language toggle
2. Navigate to تكاليف التخليص الجمركي (Customs Clearing Costs)
3. Click on التخاليص المعلقة (Pending Clearances) tab
4. **Expected**: All labels and messages in Arabic
5. Verify UI displays correctly in RTL mode

## API Testing (Optional)

### Test Pending Clearances Endpoint

```bash
# Get pending clearances
curl -X GET "http://localhost:3000/api/customs-clearing-costs/pending-clearances?page=1&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "sn": "LIN-736",
      "product_text": "Corn",
      "customs_clearance_date": "2025-01-15",
      "weight_ton": 25,
      "container_count": 1,
      "pol_name": "Port A",
      "pod_name": "Port B",
      "bl_no": "BL123",
      "booking_no": "BK456"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "pages": 1
  }
}
```

### Test Create Cost from Pending

```bash
# Create cost from pending shipment
curl -X POST "http://localhost:3000/api/customs-clearing-costs/from-pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipment_id": "YOUR_SHIPMENT_ID",
    "original_clearing_amount": 1500,
    "extra_cost_amount": 250,
    "extra_cost_description": "Additional port fees",
    "clearance_type": "inbound",
    "payment_status": "pending"
  }'
```

Expected Response:
```json
{
  "id": "uuid",
  "file_number": "LIN-736",
  "shipment_id": "YOUR_SHIPMENT_ID",
  "original_clearing_amount": 1500,
  "extra_cost_amount": 250,
  "total_clearing_cost": 1750,
  "clearance_type": "inbound",
  "payment_status": "pending",
  "created_at": "2025-11-27T...",
  ...
}
```

## Known Behavior

1. **Auto-Generated File Number**: File number is automatically set to the shipment's SN
2. **Auto-Population**: Some fields like `goods_type` and `goods_weight` are auto-populated from shipment data
3. **Single Entry Per Shipment**: Each shipment can only have one pending clearance cost entry
4. **Real-Time Updates**: Once cost is entered, the shipment immediately disappears from pending list

## Troubleshooting

### Shipment Not Appearing in Pending List

**Possible Causes:**
1. Clearance date not set on shipment
2. Cost entry already exists for this shipment
3. Shipment is marked as deleted (`is_deleted = TRUE`)

**Solution:**
- Check shipment details in Shipments page
- Verify clearance date is set
- Check if cost entry already exists in Customs Costs tab

### Unable to Save Cost

**Possible Causes:**
1. Both original and extra costs are 0 or empty
2. Network error
3. Insufficient permissions (not Clearance or Admin role)

**Solution:**
- Enter at least one non-zero cost value
- Check browser console for errors
- Verify user role

### Cost Entry Not Showing in Customs Costs Tab

**Possible Causes:**
1. Page needs refresh
2. Filters applied on Customs Costs tab
3. Database sync issue

**Solution:**
- Click refresh button or reload page
- Clear filters on Customs Costs tab
- Check database directly if issue persists

## Success Criteria

✅ Shipments with clearance date appear in Pending Clearances tab
✅ Clearance officer can enter costs inline
✅ Total cost calculates automatically
✅ Cost entry creates successfully
✅ Shipment disappears from pending list after save
✅ Cost entry appears in Customs Costs tab
✅ All UI elements display in both English and Arabic
✅ Search and pagination work correctly
✅ Error messages display for invalid inputs

## Next Steps

After testing, this interface can be integrated with:
1. **Batch System**: Created cost entries can be added to batches for approval
2. **Notifications**: Notify SCLM when clearance officer enters cost
3. **Reports**: Add pending clearances count to dashboard
4. **Mobile**: Optimize table for mobile responsiveness

