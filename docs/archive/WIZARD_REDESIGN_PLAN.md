# Contract Wizard Redesign Plan

Based on the actual proforma invoice provided, the wizard needs to be restructured into 5 comprehensive steps:

## 🎯 New 5-Step Wizard Structure

### Step 1: Commercial Parties
**Fields:**
- **Proforma Invoice Number** (e.g., BIEPL/IN/PI/24-25/ DT.11/03/2025)
- **Invoice Date**
- **Other Reference** (e.g., IEC NO.0588135545)
- **Exporter** (Company autocomplete)
- **Buyer** (Company autocomplete)
- **Consignee** (Checkbox: "Same as Buyer" or separate company autocomplete)

### Step 2: Shipping & Geography
**Fields:**
- **Country of Origin of Goods** (Dropdown)
- **Country of Final Destination** (Dropdown)
- **Port of Loading (POL)** (Autocomplete)
- **Final Destination** (Autocomplete - can be port or city)
- **Pre-Carriage By** (Optional text - e.g., truck, rail)
- **Place of Receipt** (Optional)
- **Vessel/Flight No.** (Optional)

### Step 3: Terms & Payment
**Fields:**
- **Incoterm** (Dropdown: CIF, FOB, CFR, etc.)
- **Delivery Terms Detail** (Text: e.g., "CIF MERSIN, TURKEY")
- **Payment Terms** (Text: e.g., "30 DAYS FROM ARRIVAL AT DESTINATION")
- **Payment Method** (Dropdown: L/C, T/T, CAD, etc.)
- **Currency** (Dropdown: USD, EUR, etc.)
- **Special Clauses** (Dynamic list):
  - Type (Tolerance, Payment Condition, Detention/Demurrage, Other)
  - Description (Rich text)
  - Tolerance % (if applicable)

**Example Special Clauses from Invoice:**
- Tolerance: 10% (PLUS OR MINUS) - OR - QUANTITY AND AMOUNT
- Non-payment clause
- Detention/demurrage rights

### Step 4: Product Lines (Most Important!)
**Table with columns:**
1. **Type of Goods** (Full description)
   - Example: "45X20 FT CONTAINERS 1125 M.TONS INDIAN SELLA RICE, CROP 2024, GRADE A, SORTEX CLEANED AND MOISTURE MAX 12.50%, PACKED IN LOYAL. (ADD LIGHT FRAGRANCE)"
2. **Brand** (Dropdown: LOYAL, LOYAL GOLDEN, ALMAEDA, BAN BAN)
3. **Kind of Packages** (Dropdown: BAGS, BOXES, etc.)
4. **Number of Packages** (Integer: 10000, 20000, etc.)
5. **Package Size** (Decimal: 25 KG)
6. **Quantity (M.TONS)** (Calculated or manual: number_of_packages × package_size ÷ 1000)
7. **Rate (USD/MT)** (Decimal: 835.00)
8. **Amount (USD)** (Calculated: quantity × rate)

**Quick Add Presets:**
- "Add 25kg Bag Line" (pre-fills package size)
- "Add 10kg Bag Line"
- "Add 50kg Bag Line"

**Totals Row:**
- Total Packages
- Total M.TONS
- Total Amount USD

### Step 5: Banking & Documentation
**Banking Details (Beneficiary):**
- **Beneficiary Name**
- **Beneficiary Address** (Multi-line)
- **Account Number**
- **Bank Name**
- **Bank Address** (Multi-line)
- **Swift Code**
- **Correspondent Bank** (Optional)

**Documentation Requirements:**
- **Responsibility** (Radio: Exporter, Buyer, Shared)
- **Document Checklist** (Dynamic table):
  - Document Type (Invoice, Certificate of Origin, B/L, Packing List, Phyto, Fumigation, etc.)
  - Required (Checkbox)
  - Attested By (Chamber of Commerce, Embassy, etc.)
  - Legalization Required (Checkbox)
  - Number of Copies (Integer)
  - Notes

**Example from Invoice:**
"WE WILL PROVIDE: INVOICE, CERT. OF ORIGIN ATTESTED BY CHAMBER OF COMMERCE ALONGWITH B/L, PACKING LIST, PHYTO. & FUMIGATION WITHOUT LEGALIZATION, ONLY CHAMBER"

This translates to:
- Invoice: Required, No attestation, No legalization
- Certificate of Origin: Required, Attested by Chamber of Commerce, No legalization
- B/L: Required, No attestation, No legalization
- Packing List: Required, No attestation, No legalization
- Phytosanitary Certificate: Required, No attestation, No legalization
- Fumigation Certificate: Required, No attestation, No legalization

---

## 📋 Implementation Order

1. ✅ Create new types (types_v2.ts) - DONE
2. ⏳ Create Step1CommercialParties.tsx
3. ⏳ Create Step2ShippingGeography.tsx
4. ⏳ Create Step3TermsPayment.tsx
5. ⏳ Create Step4ProductLines.tsx
6. ⏳ Create Step5BankingDocs.tsx
7. ⏳ Create ContractWizardV2.tsx (main orchestrator)
8. ⏳ Update routing to use new wizard
9. ⏳ Add translations for all new fields
10. ⏳ Test with actual proforma invoice data

---

## 🔄 Migration Strategy

**Option A: Replace old wizard completely**
- Rename old wizard files to *_old.tsx
- Create new wizard
- Update routing

**Option B: Keep both wizards (Simple vs Advanced)**
- Add toggle in ContractsPage: "Simple Contract" vs "Full Proforma Invoice"
- Keep both wizards available

**Recommendation**: Option A (Replace) - The new wizard is comprehensive enough to handle all cases.

---

## 🎨 UI Improvements for Step 4 (Product Lines)

Since this is the most complex step, special attention needed:

**Features:**
1. **Inline editing** - Click to edit cells directly
2. **Auto-calculation** - Quantity auto-calculates from packages × size
3. **Copy line** - Duplicate button to copy a line with different brand
4. **Import from template** - Load common product configurations
5. **Total validation** - Warning if total doesn't match expected amount
6. **Real-time totals** - Footer shows running totals

**Example Layout:**
```
[Quick Add: 25kg Bag | 10kg Bag | 50kg Bag] [+ Add Custom Line]

┌─────────────────────────────────────────────────────────────────────┐
│ # │ Type of Goods  │ Brand  │ Pkg Type │ # Pkgs │ Size │ MT │ Rate │ Amount │ Actions │
├───┼────────────────┼────────┼──────────┼────────┼──────┼────┼──────┼────────┼─────────┤
│ 1 │ 1121 CREAMY... │ LOYAL  │ BAGS     │ 10000  │ 25kg │ 250│ 835  │208750  │ 📋 🗑️  │
│ 2 │ 1121 GOLDEN... │ LOYAL..│ BAGS     │ 20000  │ 25kg │ 500│ 885  │442500  │ 📋 🗑️  │
└─────────────────────────────────────────────────────────────────────┘
                                         TOTALS: │ 30000 │    │ 750│      │651250  │
```

---

## 📝 Next Steps

Please confirm:
1. ✅ Should I proceed with the full redesign?
2. ✅ Any additional fields you need that aren't in the proforma invoice?
3. ✅ Any fields from the invoice that you DON'T need?
4. ✅ Should special clauses support rich text or plain text?
5. ✅ Do you want to import product descriptions from a master list or always enter manually?

Once confirmed, I'll build the complete new wizard!

