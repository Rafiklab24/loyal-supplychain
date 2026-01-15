# Price per MT Equivalent Feature

## Overview

This feature adds a standardized **Price per MT (Metric Ton) Equivalent** calculation to the Contract Wizard, Step 4 (Product Lines page). This ensures that no matter what pricing method is used (per LB, per Bag, per Container, etc.), the CFO can see a consistent MT-based price for accurate financial analysis and comparison across all contracts.

## Business Need

The CFO requested this feature to ensure all pricing can be compared on a standardized basis (Metric Tons) for:
- Accurate financial analysis
- Price trend tracking across different contracts
- Comparison of deals regardless of how they were originally priced
- Standard reporting and analytics

## Implementation Details

### Location
- **File**: `/vibe/src/components/contracts/wizard/Step4ProductLinesV2.tsx`
- **Step**: Step 4 - Product Lines (4th page of contract wizard)

### Key Features

1. **Automatic Calculation**: For every product line, the system automatically calculates the equivalent price per MT based on the pricing method used.

2. **Pricing Method Support**: Works with all pricing methods:
   - **Weight-based**: per MT, per KG, per LB, per TON (US)
   - **Package-based**: per Package/Bag, per Piece, per Pallet
   - **Container-based**: per Container
   - **Volume-based**: per CBM, per Liter
   - **Custom**: Total amount (manual entry)

3. **Calculation Logic**:

   **For Weight-Based Pricing** (Direct Conversion):
   ```javascript
   - per_mt: Price per MT = Unit Price
   - per_kg: Price per MT = Unit Price × 1000
   - per_lb: Price per MT = Unit Price × 2204.62
   - per_ton: Price per MT = Unit Price ÷ 1.10231
   ```

   **For All Other Pricing Methods** (Derived):
   ```javascript
   Price per MT = Total Amount ÷ Quantity in MT
   ```

4. **UI Display**:
   - **Column**: Added a new highlighted column "Price per MT 💎" in the product lines table
   - **Styling**: Yellow background with border to stand out
   - **Read-only**: Automatically calculated, cannot be edited
   - **Footer**: Shows average price per MT across all product lines

5. **Information Box**: Added a prominent yellow info box below the table with:
   - Explanation of the feature
   - Three real-world examples showing conversions
   - Visual emphasis for CFO awareness

## Examples

### Example 1: Weight-Based Pricing
```
Input: $2.20 per LB
Calculation: $2.20 × 2204.62 LB/MT
Result: $4,850.16 per MT
```

### Example 2: Package-Based Pricing
```
Input: $25 per 25kg Bag
Quantity: 1000 bags = 25 MT
Total: $25,000
Calculation: $25,000 ÷ 25 MT
Result: $1,000 per MT
```

### Example 3: Container-Based Pricing
```
Input: $25,000 per Container
Container holds: 25 MT
Calculation: $25,000 ÷ 25 MT
Result: $1,000 per MT
```

## User Interface

### Table View
```
+-------------+---------------+-----------------+-------------+
| Unit Price  | Price per MT  | Amount (USD)    |   Actions   |
+-------------+---------------+-----------------+-------------+
| $2.20/LB    | $4,850.16     | $121,254.00     |  Copy Del   |
| $25/Bag     | $1,000.00     | $25,000.00      |  Copy Del   |
+-------------+---------------+-----------------+-------------+
```

### Info Box
The page displays a prominent yellow box explaining:
- Purpose of the feature
- How it benefits the CFO
- Real examples of conversions
- Visual emphasis with 💎 emoji

## Translation Support

The feature is fully translated in both English and Arabic:

### English Keys
- `contracts.pricePerMT`: "Price per MT"
- `contracts.pricePerMTEquivalent`: "Equivalent price per Metric Ton - standardized for CFO analysis"
- `contracts.pricePerMTStandardized`: "Price per MT - Standardized for CFO Analysis"
- `contracts.pricePerMTDescription`: Full explanation text

### Arabic Keys
- `contracts.pricePerMT`: "السعر لكل طن متري"
- `contracts.pricePerMTEquivalent`: "السعر المكافئ لكل طن متري - موحد لتحليل المدير المالي"
- `contracts.pricePerMTStandardized`: "السعر لكل طن متري - موحد لتحليل المدير المالي"
- `contracts.pricePerMTDescription`: Full explanation in Arabic

## Technical Details

### Function
```typescript
const calculatePricePerMT = (line: ProductLine): number => {
  if (!line.quantity_mt || line.quantity_mt <= 0) {
    return 0;
  }
  
  switch (line.pricing_method) {
    case 'per_mt':
      return line.unit_price;
    case 'per_kg':
      return line.unit_price * 1000;
    case 'per_lb':
      return line.unit_price * 2204.62;
    case 'per_ton':
      return line.unit_price / 1.10231;
    default:
      // For all other methods (package, container, cbm, etc.)
      return line.amount_usd / line.quantity_mt;
  }
};
```

### UI Component
- **Column Position**: Between "Unit Price" and "Amount (USD)"
- **Width**: Auto-calculated based on content
- **Min Table Width**: Increased from 1600px to 1750px
- **Highlight**: Yellow background (#FEF3C7) with yellow border (#FBBF24)

## Benefits

1. **Standardization**: All contracts can be compared on the same basis (per MT)
2. **Accuracy**: Eliminates manual conversion errors
3. **Efficiency**: Automatic calculation saves time
4. **Visibility**: Prominent display ensures CFO sees standardized pricing
5. **Flexibility**: Works with any pricing method the business uses

## Future Enhancements

Potential improvements for future versions:
1. Export functionality showing MT-equivalent pricing
2. Analytics dashboard using MT-equivalent pricing
3. Price trend reports based on MT pricing
4. Alerts for pricing anomalies based on MT equivalent

## Testing

To test this feature:
1. Navigate to Contracts → New Contract
2. Complete Steps 1-3
3. On Step 4 (Product Lines), add a product line
4. Try different pricing methods:
   - Set pricing to "per LB" with unit price $2.20
   - Observe the "Price per MT" column automatically shows $4,850.16
   - Try "per Package" pricing
   - Observe the calculation based on total amount ÷ MT quantity
5. Check that the footer shows average price per MT

## Files Modified

1. `/vibe/src/components/contracts/wizard/Step4ProductLinesV2.tsx`
   - Added `calculatePricePerMT()` function
   - Added new table column for Price per MT
   - Added information box explaining the feature
   - Updated table footer with average MT price

2. `/vibe/src/i18n/en.json`
   - Added English translation keys

3. `/vibe/src/i18n/ar.json`
   - Added Arabic translation keys

## Date Implemented
November 19, 2025

## Related Documentation
- `COMPREHENSIVE_UNITS_SYSTEM.md` - Units and conversions
- `API.md` - Contract API documentation
- `docs/SYSTEM_DESIGN.md` - Overall system architecture

