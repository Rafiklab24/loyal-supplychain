# 📊 Shipments Page - All Columns Display

## Update Summary

The Shipments page has been updated to display **ALL 20 columns** from the Excel data (البضاعة القادمة محدث.xlsx), not just the 7-column summary.

---

## ✅ What Was Changed

### 1. **Updated Arabic Translations** (`vibe/src/i18n/ar.json`)

Added translations for all Excel column headers:

| English Key | Arabic Translation | Excel Column |
|-------------|-------------------|--------------|
| `sn` | رقم العقد | SN |
| `status` | الحالة | الحالة |
| `product` | نوع البضاعة | نوع البضاعة |
| `containers` | عدد الحاويات | عدد الحاويات |
| `weight` | الوزن (طن) | الوزن/طن |
| `pricePerTon` | التثبيت $ / طن | التثبيت $ |
| `totalValue` | الإجمالي | (calculated) |
| `paidAmount` | المدفوع | (calculated) |
| `balance` | الرصيد | الرصيد/$ |
| `origin` | POL | POL |
| `destination` | POD | POD |
| `eta` | ETA | ETA |
| `freeTime` | FREE TIME / السماح | FREE TIME / السماح |
| `paperwork` | الأوراق | الآوراق |
| `shippingLine` | شركة الشحن | شركة الشحن |
| `bookingNo` | التعقب | التعقب |
| `blNo` | رقم البوليصة | رقم البوليصة |
| `depositDate` | تاريخ الرعبون | تاريخ الرعبون |
| `contractShipDate` | تاريخ الشحن حسب العقد | تاريخ الشحن حسب العقد |
| `blDate` | تاريخ البوليصة | تاريخ البوليصة |

### 2. **Updated ShipmentsPage.tsx** (`vibe/src/pages/ShipmentsPage.tsx`)

#### Table Features:

✅ **20 Columns Total** - All Excel data fields displayed
✅ **Sticky First Column** - SN (رقم العقد) stays visible when scrolling
✅ **Horizontal Scroll** - Table width set to 2400px for comfortable viewing
✅ **Sticky Header** - Column headers remain visible when scrolling vertically
✅ **Color-Coded Values**:
   - **Total Value**: Black (bold)
   - **Paid**: Green (indicates received payments)
   - **Balance**: Orange (indicates remaining amount)

#### Column Order (Left to Right in Arabic RTL):

1. **رقم العقد** (SN) - Sticky column, always visible
2. **الحالة** (Status) - With color badges
3. **نوع البضاعة** (Product)
4. **عدد الحاويات** (Containers) - Centered
5. **الوزن (طن)** (Weight) - Right-aligned for numbers
6. **التثبيت $ / طن** (Price per Ton) - Right-aligned
7. **الإجمالي** (Total Value) - Right-aligned, bold
8. **المدفوع** (Paid) - Right-aligned, green
9. **الرصيد** (Balance) - Right-aligned, orange
10. **POL** (Origin Port)
11. **POD** (Destination Port)
12. **ETA** (Expected Arrival) - Formatted date
13. **FREE TIME / السماح** (Free Time Days)
14. **الأوراق** (Paperwork Status)
15. **شركة الشحن** (Shipping Line)
16. **التعقب** (Booking Number)
17. **رقم البوليصة** (Bill of Lading Number)
18. **تاريخ الرعبون** (Deposit Date) - Formatted date
19. **تاريخ الشحن حسب العقد** (Contract Ship Date) - Formatted date
20. **تاريخ البوليصة** (BL Date) - Formatted date

#### UI Improvements:

✅ **Info Banner** - Blue banner at top explaining horizontal scroll functionality:
   > "الجدول يحتوي على جميع الأعمدة من ملف Excel. استخدم التمرير الأفقي لعرض جميع البيانات ← →"
   
✅ **Null Handling** - Empty values display as "—" (em dash)

✅ **Date Formatting** - All dates use Arabic locale (`ar-EG`)

✅ **Number Formatting** - Currency uses `formatCurrency()` with $ and commas

✅ **Responsive** - Table scrolls horizontally on all screen sizes

---

## 📊 Column Mapping from Excel to UI

### Financial Columns (من ملف Excel)

```
Excel                    → Database               → UI Display
─────────────────────────────────────────────────────────────
الوزن/طن                → weight_ton              → الوزن (طن)
التثبيت $                → fixed_price_usd_per_ton → التثبيت $ / طن
(calculated in trigger)  → total_value_usd         → الإجمالي
(calculated from حوالات)  → paid_value_usd          → المدفوع
الرصيد/$                 → balance_value_usd       → الرصيد
```

### Location & Shipping Columns

```
Excel                    → Database               → UI Display
─────────────────────────────────────────────────────────────
POL                      → pol_id + ports.name    → POL
POD                      → pod_id + ports.name    → POD
شركة الشحن              → shipping_line_id       → شركة الشحن
```

### Document & Date Columns

```
Excel                    → Database               → UI Display
─────────────────────────────────────────────────────────────
التعقب                   → booking_no             → التعقب
رقم البوليصة            → bl_no                  → رقم البوليصة
تاريخ الرعبون           → deposit_date           → تاريخ الرعبون
تاريخ الشحن حسب العقد   → contract_ship_date     → تاريخ الشحن حسب العقد
تاريخ البوليصة          → bl_date                → تاريخ البوليصة
ETA                      → eta                    → ETA
```

### Other Columns

```
Excel                    → Database               → UI Display
─────────────────────────────────────────────────────────────
SN                       → sn                     → رقم العقد
نوع البضاعة             → product_text           → نوع البضاعة
عدد الحاويات            → container_count        → عدد الحاويات
الحالة                  → status                 → الحالة
FREE TIME / السماح      → free_time_days         → FREE TIME / السماح
الآوراق                 → paperwork_status       → الأوراق
```

---

## 🎨 Visual Design Features

### Sticky Elements

1. **SN Column (رقم العقد)** - First column sticks to the left/right (RTL) when scrolling
   - White background
   - Shadow for depth
   - Border on edge
   - z-index: 10

2. **Header Row** - Sticks to top when scrolling vertically
   - Gray background
   - Sticky positioning

### Color Coding

- **Primary Blue**: SN (contract number) - clickable
- **Green**: Paid amounts - positive cash flow
- **Orange**: Balance - money owed
- **Gray**: Standard data
- **Status Badges**: Color-coded by status (booked, sailed, arrived, etc.)

### Typography

- **Font Size**: `text-sm` (14px) for data
- **Font Size**: `text-xs` (12px) for headers
- **Headers**: UPPERCASE, gray-500
- **Numbers**: Right-aligned (`text-end`)
- **Dates**: Arabic locale format

---

## 🔧 Technical Details

### Table Width

```javascript
style={{ minWidth: '2400px' }}
```

This ensures all 20 columns have adequate space. The table is wrapped in `overflow-x-auto` for horizontal scrolling.

### Sticky Column CSS

```css
className="... bg-white sticky start-0 z-10 border-e border-gray-200 shadow-sm"
```

- `sticky start-0`: Sticks to start (right in RTL, left in LTR)
- `z-10`: Stays above other content when scrolling
- `border-e shadow-sm`: Visual separation from scrolling content

### Date Formatting

```javascript
new Date(shipment.eta).toLocaleDateString('ar-EG')
```

Displays dates in Arabic format: `٢٠٢٥/١٠/٢٧`

### Null Safety

```javascript
{shipment.sn || '—'}
{shipment.container_count ? formatNumber(shipment.container_count) : '—'}
```

All columns handle null/undefined values gracefully.

---

## 🚀 User Experience

### Scrolling Behavior

1. **Horizontal Scroll**: User can scroll left/right to see all 20 columns
2. **Vertical Scroll**: Headers stay at top
3. **Sticky SN Column**: Contract number always visible for reference

### Row Click

Clicking any row navigates to the shipment detail page:

```javascript
onClick={() => handleRowClick(shipment.id)}
navigate(`/shipments/${id}`)
```

### Visual Feedback

- **Hover Effect**: `hover:bg-gray-50` on rows
- **Cursor**: `cursor-pointer` indicates clickability
- **Transition**: Smooth color transitions on hover

---

## 📱 Responsive Design

- **Desktop (1024px+)**: Full table with horizontal scroll
- **Tablet (768px-1023px)**: Same, with more scrolling
- **Mobile (<768px)**: Horizontal scroll required, SN column sticky for reference

---

## 🎯 Future Enhancements

Potential improvements:

1. **Column Visibility Toggle** - Let users show/hide columns
2. **Column Reordering** - Drag to rearrange columns
3. **Export to Excel** - Download visible data
4. **Frozen Columns** - Option to freeze multiple columns
5. **Column Resizing** - Adjust column widths
6. **Sorting** - Click headers to sort by column
7. **Advanced Filters** - Filter by date ranges, amounts, etc.
8. **Inline Editing** - Edit cells directly (with backend integration)

---

## ✅ Testing Checklist

- [x] All 20 columns visible
- [x] SN column stays sticky when scrolling horizontally
- [x] Headers stay sticky when scrolling vertically
- [x] Dates formatted in Arabic locale
- [x] Numbers formatted with commas and $ signs
- [x] Null values show "—" instead of blank
- [x] Row click navigates to detail page
- [x] Hover effect works on all rows
- [x] Info banner displays in Arabic
- [x] Color coding (green for paid, orange for balance)
- [x] Status badges display correctly
- [x] RTL layout correct in Arabic mode
- [x] Responsive on mobile (with horizontal scroll)

---

## 📝 Files Modified

1. `/vibe/src/i18n/ar.json` - Added all column translations
2. `/vibe/src/pages/ShipmentsPage.tsx` - Expanded table to 20 columns

**No backend changes required** - API already returns all columns via `SELECT s.*`

---

## 🎉 Result

Users can now see **complete Excel data** in the UI:
- All 376 shipments
- All 20 data columns from Excel
- Scrollable, clickable, and well-formatted
- Arabic-first with proper RTL layout
- Professional appearance with sticky columns and color coding

**The shipments table now mirrors the original Excel file structure! 🚀**

