# Financial Management System - Testing Guide

## 🚀 Quick Start

1. **Navigate to Shipments Page**
   - Open http://localhost:5173
   - Click on "الشحنات" (Shipments) in the sidebar

2. **Click "شحنة جديدة" (New Shipment)**
   - The wizard will now have **5 steps** instead of 4

---

## 📋 Testing Steps

### Step 1: Basic Information ✅
1. Choose transaction direction:
   - **Purchase (Buyer)** - incoming
   - **Sale (Seller)** - outgoing
2. Enter SN (Shipment Number)
3. Enter Product Name
4. Enter Supplier (for buyer) or Customer (for seller)

### Step 2: Commercial Terms ✅
1. Select Cargo Type
2. Enter quantity (weight or barrels)
3. Enter cost price per unit
4. **For Sellers**: Enter selling price per unit
   - Watch the profit margin appear!

### Step 3: Financial Details ⭐ **NEW!**

#### A. Financial Summary Dashboard
- Observe the colorful summary cards at the top
- **Contract Value** (blue)
- **Selling Value** (green) - sellers only
- **Profit Margin** (emerald/red) - sellers only
- **Down Payment** (purple) - when set
- **Remaining Balance** (gray/red)
- **Net Profit** (teal/red) - sellers with costs

#### B. Down Payment Testing
1. Click "**Percentage**" button
   - Enter a percentage (e.g., 30)
   - Watch the amount calculate automatically
   - See it appear in the summary cards

2. Click "**Fixed Amount**" button
   - Enter an amount (e.g., 10000)
   - Watch the percentage calculate automatically

3. Try "**None**" to skip down payment

**Validation to Test:**
- Enter percentage > 100 → Should show error
- Enter amount > contract value → Should show error

#### C. Payment Method Testing
1. Select "**SWIFT Transfer**"
   - Form expands to show banking fields
   - Fill in SWIFT code, bank name, account number, IBAN
   - Enter intermediary bank (optional)

2. Select "**Letter of Credit (LC)**"
   - Form expands to show LC fields
   - Fill in LC number, amount, issuing bank, advising bank
   - Set expiry date

3. Try other methods:
   - Local Bank Transfer
   - Through 3rd Party
   - Cash
   - Multiple Methods

#### D. Payment Schedule Testing
1. Click "**+ Add Payment**" button
2. For each payment:
   - Select milestone (Down Payment, Upon BL, Upon Arrival, etc.)
   - Enter percentage OR amount
   - Watch the other field calculate automatically
   - Set due date
   - Set status (Pending, Paid, Overdue)
   - Add notes (optional)

3. Add multiple payments
   - The system tracks the running total
   - Watch the "Remaining Balance" card update
   - If total exceeds contract value, warning appears

**Example Payment Schedule:**
```
Payment 1: Down Payment - 30% - Due: 2024-01-15
Payment 2: Upon BL Receipt - 40% - Due: 2024-02-15
Payment 3: Upon Arrival - 30% - Due: 2024-03-15
```

**Validation to Test:**
- Total payments > contract value → Warning appears
- Missing milestone label for custom milestone → Warning

#### E. Cost Breakdown Testing (Sellers Only)
**Only visible when direction = "Seller/Outgoing"**

1. Click "**+ Add Cost**" button
2. For each cost:
   - Select category (Freight, Insurance, Customs, Port Charges, etc.)
   - Enter description
   - Enter amount
   - Select currency (USD, EUR, GBP, AED, SAR)

3. Add multiple costs
   - Watch the "Net Profit" card update
   - System deducts costs from profit margin

**Example Costs:**
```
Freight: Shipping to UAE - $5,000 USD
Insurance: Cargo insurance - $1,500 USD
Customs: Import duties - $2,000 USD
Port Charges: Jebel Ali port fees - $800 USD
```

**Validation to Test:**
- If costs exceed profit → Warning appears
- Net profit goes negative → Card turns red

#### F. Payment Beneficiaries Testing
1. Click "**+ Add Beneficiary**" button
2. For each beneficiary:
   - Enter name
   - Select role (Supplier, Freight Forwarder, Customs Broker, etc.)
   - Enter amount and currency
   - Enter payment method
   - Set due date
   - Set status (Pending, Paid, Cancelled)
   - Enter bank details
   - Add notes

3. Add multiple beneficiaries
   - System tracks total payables
   - For sellers, deducts from net profit

**Example Beneficiaries:**
```
Name: ABC Shipping LLC
Role: Freight Forwarder
Amount: $5,000 USD
Method: Bank Transfer
Due: 2024-02-15
Status: Pending
Bank: HSBC UAE - Account: 1234567890
```

**Validation to Test:**
- Total payables > contract value → Error appears

### Step 4: Logistics Details ✅
(Same as before - no changes)

### Step 5: Review & Submit ⭐ **ENHANCED!**

#### Financial Details Section
Now displays comprehensive financial overview:

1. **Down Payment** (if set)
   - Type, Amount, Due Date, Status
   - Highlighted in blue box

2. **Payment Method**
   - Shows selected method with icon
   - Displays SWIFT or LC details (if applicable)
   - Shows additional notes

3. **Payment Schedule**
   - Lists all payment milestones
   - Color-coded status badges
   - Shows percentage, amount, and due dates

4. **Cost Breakdown** (sellers only)
   - Categorized list of costs
   - Total per currency

5. **Payment Beneficiaries**
   - Lists all payables
   - Shows roles, amounts, and statuses
   - Displays bank details

#### Submit
- Click "**Create Shipment**"
- System validates all financial data
- If errors exist, submission prevented
- If only warnings, can still submit

---

## ✅ Test Scenarios

### Scenario 1: Simple Buyer Purchase
```
Direction: Incoming (Buyer)
Product: Rice
Quantity: 100 tons
Cost: $500/ton
Total: $50,000

Financial:
- Down Payment: 30% ($15,000)
- Payment Method: LC
- LC Amount: $50,000
- Payment Schedule:
  1. Down Payment - 30% - Upon Contract
  2. Balance - 70% - Upon BL Receipt
```

### Scenario 2: Seller with Profit Tracking
```
Direction: Outgoing (Seller)
Product: Wheat
Quantity: 200 tons
Cost: $400/ton ($80,000)
Selling Price: $500/ton ($100,000)
Profit Margin: $20,000 (25%)

Financial:
- Down Payment: 20% ($20,000)
- Payment Method: SWIFT
- Payment Schedule:
  1. Down Payment - 20%
  2. Upon BL - 40%
  3. Upon Arrival - 40%

Cost Breakdown:
- Freight: $5,000
- Insurance: $2,000
- Port Charges: $1,000
- Total Costs: $8,000
- Net Profit: $12,000

Beneficiaries:
- ABC Freight: $5,000 (Freight Forwarder)
- XYZ Insurance: $2,000 (Insurance)
- Port Authority: $1,000 (Port Fees)
```

### Scenario 3: Complex Multi-Payment Schedule
```
Product: Crude Oil (Tanker)
Quantity: 50,000 barrels
Cost: $80/barrel
Total: $4,000,000

Financial:
- Down Payment: 10% ($400,000)
- Payment Schedule:
  1. Down Payment - 10% - Contract Date
  2. Upon Loading - 20% - ETD Date
  3. Upon BL - 30% - BL Date
  4. Upon Arrival - 20% - ETA Date
  5. Net 30 - 20% - 30 days after delivery
```

---

## 🎨 Visual Indicators

### Color Coding
- **Blue** = Contract/Base values
- **Green** = Income/Revenue (Selling price)
- **Emerald** = Positive profit
- **Red** = Negative values/Losses
- **Purple** = Down payment
- **Gray** = Neutral/Remaining balance
- **Teal** = Net profit (after deductions)
- **Yellow** = Warnings
- **Red (alert)** = Errors

### Status Badges
- **Pending** = Yellow badge
- **Paid** = Green badge
- **Overdue** = Red badge
- **Partial** = Blue badge
- **Cancelled** = Gray badge

---

## 🔍 Validation Examples

### Errors (Prevent Submission)
1. **Down payment exceeds contract value**
   ```
   Contract Value: $50,000
   Down Payment: $60,000
   ❌ Error: "Down payment cannot exceed the total contract value."
   ```

2. **Total payments exceed contract value**
   ```
   Contract Value: $50,000
   Down Payment: $20,000
   Payment Schedule Total: $35,000
   ❌ Error: "Payment schedule total exceeds contract value by $5,000."
   ```

3. **Total payables exceed contract value**
   ```
   Contract Value: $50,000
   Total Beneficiaries: $55,000
   ❌ Error: "Total payables to beneficiaries exceed the contract value."
   ```

### Warnings (Allow Submission)
1. **Missing recommended fields**
   ```
   Payment Method: SWIFT
   SWIFT Code: (empty)
   ⚠️ Warning: "SWIFT code is recommended for international bank transfers."
   ```

2. **Negative profit margin**
   ```
   Cost: $500/ton
   Selling Price: $450/ton
   ⚠️ Warning: "Negative profit margin: $50.00. Selling price is lower than cost."
   ```

3. **Costs exceed profit**
   ```
   Profit Margin: $10,000
   Total Costs: $12,000
   ⚠️ Warning: "Total additional costs exceed the profit margin."
   ```

---

## 📱 Responsive Testing

### Desktop (1920x1080)
- Summary cards display in 3 columns
- All forms display side-by-side in 2 columns
- Optimal viewing experience

### Tablet (768x1024)
- Summary cards display in 2 columns
- Forms adapt to single column
- Touch-friendly buttons

### Mobile (375x667)
- Summary cards stack vertically (1 column)
- All forms single column
- Compact button layout
- Swipe-friendly

---

## 🌐 Bilingual Testing

### English Mode
1. Switch language to English
2. All labels should display in English
3. Currency formatting: $1,234.56
4. Date format: MM/DD/YYYY
5. Text alignment: Left-to-right

### Arabic Mode
1. Switch language to Arabic
2. All labels should display in Arabic
3. Currency formatting: $١٬٢٣٤٫٥٦ (or $1,234.56)
4. Date format: DD/MM/YYYY
5. Text alignment: Right-to-left
6. Number inputs should still accept Arabic numerals

---

## 🌙 Dark Mode Testing

1. Toggle dark mode
2. Check all financial cards have appropriate dark backgrounds
3. Verify text contrast is sufficient
4. Ensure validation alerts are visible
5. Check input fields are properly styled

---

## 💾 Data Persistence (Future)

Currently, financial data is:
- ✅ Collected in the wizard
- ✅ Validated in real-time
- ✅ Displayed in review step
- ⏳ **NOT YET** saved to database (backend integration pending)

After backend integration:
- Financial data will be saved with shipment
- Can be edited after creation
- Payment statuses can be updated
- Financial history tracked

---

## 🐛 Known Issues

None at the moment! 🎉

If you find any issues during testing, please document:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Screenshots (if applicable)
5. Browser and OS

---

## 📞 Questions?

The implementation is complete and ready for testing. All Phase 1 features are functional and integrated into the shipment wizard.

Happy Testing! 🚀

