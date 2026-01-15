# Original Clearance Amount Column Added

**Date:** November 26, 2025  
**Status:** ✅ Complete  

---

## Summary

Added "Original Clearance Amount" column to the customs clearing costs interface, positioned between "Cost Responsibility" and "Client Name" columns.

---

## What is "Original Clearance Amount"?

The **Original Clearance Amount** represents the base clearing cost **before** any extra/unusual costs are added:

- Shows either `cost_paid_by_company` OR `cost_paid_by_fb` (whichever is filled)
- This is the fundamental clearing expense
- Does NOT include `extra_cost_amount`
- The formula: `Total Clearing Cost = Original Clearance Amount + Extra Cost Amount`

---

## Column Position

The columns appear in this order:

1. Cost Description
2. Final Destination
3. **Cost Responsibility** (Company/Client badge)
4. **Original Clearance Amount** ← Base cost before extras
5. **Extra Cost Amount** ← Additional/unusual costs
6. **Total Clearing Cost** ← Final total (Original + Extra)
7. **Client Name**
8. Invoice Amount
9. Currency
10. Invoice Number
11. Invoice Date
12. BOL Number
13. Car Plate
14. Payment Status

---

## Changes Made

### Frontend

**File:** `vibe/src/pages/CustomsClearingCostsPage.tsx`
- Added new table header column
- Added new table body cell with conditional logic:
  ```tsx
  {item.cost_paid_by_company && item.cost_paid_by_company > 0
    ? formatCurrency(item.cost_paid_by_company, item.currency)
    : item.cost_paid_by_fb && item.cost_paid_by_fb > 0
    ? formatCurrency(item.cost_paid_by_fb, item.currency)
    : <span className="text-gray-400">—</span>
  }
  ```
- Right-aligned with currency formatting
- Shows "—" if neither value exists

### Translations

**File:** `vibe/src/i18n/en.json`
```json
"originalClearanceAmount": "Original Clearance Amount"
```

**File:** `vibe/src/i18n/ar.json`
```json
"originalClearanceAmount": "مبلغ التخليص الأصلي"
```

### Excel Export

**File:** `app/src/services/excelExportService.ts`
- Renamed column from "Cost Amount" to "Original Clearance Amount"
- Reordered columns to match UI:
  - Cost Paid By
  - **Original Clearance Amount** ← Updated
  - **Client Name** (moved up)
  - BOL Number (moved down)
  - Car Plate (moved down)
- Updated column width definitions

---

## Display Logic

```typescript
// If company pays:
cost_paid_by_company > 0 → Show company amount

// If client pays:
cost_paid_by_fb > 0 → Show client amount

// If neither:
→ Show "—"
```

---

## Example Values

| Cost Responsibility | Original Clearance Amount |
|---------------------|---------------------------|
| Company             | $2,500.00                 |
| Client              | $1,800.00                 |
| —                   | —                         |

---

## Benefits

✅ **Clearer Financial Breakdown** - Separates base cost from extras  
✅ **Better Accounting** - Easy to see what was quoted vs. what was added  
✅ **Logical Flow** - Original → Extra → Total (left to right progression)  
✅ **Quick Analysis** - Cost breakdown columns grouped together  
✅ **Consistent with Batches** - Matches batch export structure  
✅ **Audit Trail** - Clear visibility of original agreed amount  
✅ **Bilingual** - Full English and Arabic support

## Column Grouping Logic

The reordered columns create a logical financial flow:

**Cost Breakdown Section:**
- Original Clearance Amount (base)
- Extra Cost Amount (additions)
- Total Clearing Cost (sum)

**Invoice/Client Section:**
- Client Name
- Invoice Amount
- Currency
- Invoice Number
- Invoice Date

**Physical Reference Section:**
- BOL Number
- Car Plate  

---

## Testing

- [x] Column appears in correct position
- [x] Displays company costs correctly
- [x] Displays client costs correctly
- [x] Shows "—" for empty values
- [x] Currency formatting works
- [x] Translations work (EN/AR)
- [x] Excel export includes column
- [x] Excel column order matches UI
- [ ] Manual test: View existing records
- [ ] Manual test: Create new record
- [ ] Manual test: Export batch to Excel

---

**Implementation Complete:** November 26, 2025  
**Last Updated:** November 26, 2025 (Column reordering)  
**Status:** ✅ Ready for Testing

## Update Log

**v1.1 - Column Reordering**
- Moved Extra Cost Amount and Total Clearing Cost to appear immediately after Original Clearance Amount
- Creates logical financial flow: Original → Extra → Total
- Updated Excel batch export to match new column order
- Groups cost-related columns together for easier analysis

