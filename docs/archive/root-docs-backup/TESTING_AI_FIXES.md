# Testing AI Extraction Fixes - Quick Guide

## 🎯 What Was Fixed

1. **Correction UI Modal** - Now opens and displays extracted data
2. **AI Prompt** - Better instructions for package size extraction
3. **Validation** - Automatic warnings for calculation errors
4. **Training Data** - Enhanced metadata with error categorization

---

## 🧪 How to Test

### Test 1: Correction Modal UI

1. Go to **Contracts** → **New Contract**
2. Click **"Upload Proforma/Sales Contract"**
3. Upload any proforma invoice (try the peanuts invoice from training_data)
4. Wait for extraction to complete
5. Look for the floating **"🔧 Correct AI Extraction"** button
6. Click it → **Modal should now open!** ✅
7. Try editing any product line values
8. Click **"Save Corrections"**

**Expected:**
- Modal opens with all extracted data
- Can edit package sizes, quantities, amounts
- Corrections are saved to training_data folder

---

### Test 2: Improved Package Size Extraction

**Test Case 1: Peanuts Invoice**
```
Product: ROASTED AND SALTED PEANUTS
Weight: 26 MT
Packing: IN 10KGS CARTONS
Unit Price: USD 1,675/MT
Amount: USD 43,550.00
```

**Expected AI Extraction:**
- ✅ package_size_kg: 10 (not 520!)
- ✅ number_of_packages: 2,600 (not 10!)
- ✅ quantity_mt: 26
- ✅ amount: 43,550

**How to Test:**
1. Upload this invoice
2. Check the extraction results
3. Verify package size is 10kg
4. Verify number of packages is 2,600

---

### Test 3: Validation Warnings

Upload an invoice and check the **warnings** array in the extraction result:

```json
{
  "success": true,
  "data": { ... },
  "confidence": 85,
  "warnings": [
    "Product line 1: Package size 520kg seems unusually large - please verify",
    "Product line 1: Package count mismatch - expected ~2600 packages",
    "Product line 1: Amount mismatch - expected $43,550.00 but got $8,710.00"
  ]
}
```

**Expected:**
- Warnings appear for suspicious values
- Clear messages about what's wrong
- Helps user know what to correct

---

### Test 4: Training Data Collection

After making corrections:

1. Go to `/Users/rafik/loyal-supplychain/app/training_data/`
2. Find the latest entry directory (UUID format)
3. Open `corrections.json`

**Expected Structure:**
```json
{
  "corrections": { /* user's manual changes */ },
  "finalData": { /* corrected extraction */ },
  "timestamp": "2025-11-18T...",
  "fieldDiffs": [
    {
      "lineIndex": 0,
      "changes": [
        {
          "field": "package_size_kg",
          "original": 520,
          "corrected": 10
        }
      ]
    }
  ],
  "errorCategories": [
    "package_size_error",
    "package_count_error"
  ],
  "metadata": {
    "totalChanges": 3,
    "primaryErrors": ["package_size_error"],
    "correctionQuality": "user_verified"
  }
}
```

---

## 📊 Check Backend Logs

While testing, monitor the backend logs:

```bash
tail -f /Users/rafik/loyal-supplychain/app/backend.log
```

**Look for:**
```
🔧 Opening correction modal with data: { ... }
✅ Corrected data initialized with 1 product lines
✅ User corrections saved for: abc-123-def
   - Total changes: 3
   - Error categories: package_size_error, package_count_error
```

---

## 🎨 UI Features to Verify

### Correction Modal Features:
- ✅ Opens when clicking "Correct AI Extraction" button
- ✅ Shows all product lines with editable fields
- ✅ Highlights critical fields (package_size_kg has yellow background)
- ✅ Can delete product lines
- ✅ Shows warning emoji ⚠️ next to error-prone fields
- ✅ Saves corrections and closes modal
- ✅ Shows "✓ Corrected" badge on button after saving

### Empty State:
- If no products extracted, shows helpful message
- User can still proceed to manual entry

---

## 🔍 Specific Test Cases

### Test Case 1: Simple Bags
```
"50 MT PACKED IN 25KG BAGS"
```
**Expected:**
- package_size_kg: 25
- number_of_packages: 2,000

### Test Case 2: Multiple X Pattern
```
"40 × 50KG POLYPROPYLENE BAGS"
```
**Expected:**
- package_size_kg: 50
- number_of_packages: 40

### Test Case 3: Cartons
```
"100 MT IN 10KGS CARTONS"
```
**Expected:**
- package_size_kg: 10
- number_of_packages: 10,000

### Test Case 4: Large Bulk Bags
```
"20 MT IN 1000KG BULK BAGS"
```
**Expected:**
- package_size_kg: 1000
- number_of_packages: 20

---

## 🐛 Common Issues to Check

### Issue 1: Modal Doesn't Open
- Check browser console for errors
- Verify `extractionResult` has data
- Check backend returned valid JSON

### Issue 2: Corrections Not Saving
- Check `ENABLE_DATA_COLLECTION=true` in backend .env
- Check `training_data` directory is writable
- Monitor backend logs for save errors

### Issue 3: Validation Warnings Not Appearing
- Check extraction result includes `warnings` array
- Verify backend rebuilt after changes (npm run build)
- Check openai.ts validateProductLines is being called

---

## ✅ Success Criteria

After testing, you should see:

1. **Modal Works:**
   - ✅ Opens reliably
   - ✅ Shows all data
   - ✅ Can edit and save

2. **Extraction Improved:**
   - ✅ Package sizes correctly identified
   - ✅ Number of packages calculated correctly
   - ✅ Amounts match expected values

3. **Validation Active:**
   - ✅ Warnings appear for suspicious values
   - ✅ Help users identify errors

4. **Training Data Rich:**
   - ✅ Field-level diffs captured
   - ✅ Error categories tracked
   - ✅ Ready for fine-tuning

---

## 📈 Next Steps After Testing

1. **Collect More Examples:**
   - Upload 10-15 different invoices
   - Correct any errors
   - Build diverse training dataset

2. **Analyze Error Patterns:**
   - Check most common error categories
   - Identify if certain product types cause more errors
   - Refine prompt further if needed

3. **Prepare for Fine-Tuning:**
   - Once you have 20-30 corrected examples
   - Convert to OpenAI training format
   - Fine-tune GPT-4 Vision model

---

## 🚀 Quick Start

```bash
# 1. Servers should already be running
# Backend: http://localhost:3000
# Frontend: http://localhost:5173

# 2. Navigate to Contracts
# http://localhost:5173/contracts

# 3. Click "New Contract"

# 4. Upload a proforma invoice

# 5. Click "Correct AI Extraction" when it appears

# 6. Edit any incorrect values

# 7. Save corrections

# 8. Check training_data folder for results
```

---

## 📞 Support

If you encounter any issues:
1. Check browser console (F12)
2. Check backend logs: `tail -f app/backend.log`
3. Verify servers are running: `curl http://localhost:3000/api/health`
4. Check training data directory permissions

Happy testing! 🎉

