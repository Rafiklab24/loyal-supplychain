# Customs Clearing Batches - Quick Start Guide

## 🚀 How to Use the New Batch System

### For Clearance Officers:

#### Step 1: Select Items for Batch
1. Navigate to **Customs Clearing Costs** page
2. Check the boxes next to completed entries you want to batch
3. Notice the "Create Batch (N)" button appears showing how many items are selected

#### Step 2: Create the Batch
1. Click **"Create Batch (N)"** button
2. Enter a batch number (e.g., "ATB-142")
3. Review the summary:
   - Number of items: 10
   - Total clearing cost: $15,420.50
4. Add optional notes (e.g., "November batch for ATB client")
5. Click **"Create Batch"**
6. ✅ Batch created! It's now pending review by accounting

### For Accountants:

#### Step 1: View Pending Batches
1. Navigate to **Customs Clearing Batches** page
2. You'll see the "Pending Review" tab (default view)
3. Summary cards show:
   - How many pending batches
   - Total cost of pending batches

#### Step 2: Review Batch Details
1. Click the **expand arrow** (▶️) next to any batch
2. View all items in the batch with full details
3. See the calculated total at the bottom
4. Review any notes from the officer

#### Step 3: Approve the Batch
1. If everything looks good, click the **✓ Approve** button
2. Confirm the approval
3. ✅ Batch moves to "Approved" tab
4. Officer receives notification (when connected)

#### Step 4: Archive Approved Batches
1. Go to **"Approved"** tab
2. Click the **📦 Archive** button
3. Confirm archiving
4. ✅ Batch moves to "Archived" tab for permanent record

### For Both Roles:

#### Export Batch to Excel
- Click the **⬇ Export** button next to any batch
- Excel file downloads with:
  - Batch summary (number, dates, totals)
  - All line items with full details
  - Perfect for accounting records

#### Delete Pending Batch (Clearance/Admin only)
- Click the **🗑 Delete** button (only visible for pending batches)
- Confirm deletion
- Batch is removed (can be recreated if needed)

---

## 📊 Where to Find the Pages

1. **Customs Clearing Costs** - `/customs-clearing-costs`
   - This is where you enter individual clearing cost entries
   - Now has checkboxes to select items for batching

2. **Customs Clearing Batches** - `/customs-clearing-batches`
   - NEW page for managing batches
   - Three tabs: Pending | Approved | Archived
   - Expandable rows with full details

---

## 🎨 Status Colors

- **🟡 Yellow (Pending)** - Waiting for accounting review
- **🟢 Green (Approved)** - Reviewed and approved by accounting
- **⚪ Gray (Archived)** - Completed and archived for records

---

## 🔐 Permissions Summary

| Action | Clearance | Accounting | Admin | Exec |
|--------|-----------|------------|-------|------|
| Create Batch | ✅ | ❌ | ✅ | ❌ |
| View Batches | ✅ (Own) | ✅ (All) | ✅ | ✅ |
| Approve Batch | ❌ | ✅ | ✅ | ❌ |
| Archive Batch | ❌ | ✅ | ✅ | ❌ |
| Export Batch | ✅ | ✅ | ✅ | ✅ |
| Delete Pending | ✅ | ❌ | ✅ | ❌ |
| Edit Items | ✅ | ✅ | ✅ | ❌ |

---

## 💡 Pro Tips

1. **Batch Naming Convention**: Use consistent naming like "CLIENT-SEQUENCE" (e.g., ATB-142, LAG-1872)
2. **Add Helpful Notes**: Include dates, special instructions, or client info in notes
3. **Review Before Submit**: Double-check selections before creating batch
4. **Export for Records**: Export approved batches before archiving
5. **Regular Archiving**: Archive approved batches regularly to keep lists clean

---

## ⚠️ Important Notes

- Items can be edited even after being added to a batch
- Only pending batches can be deleted
- Once archived, batches become read-only but can still be exported
- Batch totals are calculated automatically - no manual calculation needed
- Each item can only be in ONE batch at a time

---

## 🆘 Troubleshooting

### "Create Batch button doesn't appear"
- Make sure you've checked at least one checkbox
- Refresh the page if needed

### "Cannot approve batch"
- Only Accounting role can approve
- Make sure you're logged in with correct role

### "Batch number already exists"
- Choose a different unique batch number
- Follow your naming convention

### "Items not showing in expanded view"
- Click the expand arrow (▶️) to load details
- Wait for loading to complete

---

## 📞 Support

For questions or issues with the batch system, contact the system administrator or refer to the full technical documentation in:
- `CUSTOMS_CLEARING_BATCHES_IMPLEMENTATION_COMPLETE.md`

