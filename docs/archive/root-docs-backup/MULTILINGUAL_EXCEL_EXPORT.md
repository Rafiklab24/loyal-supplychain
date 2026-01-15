# Multilingual Excel Export Feature

**Date:** November 26, 2025  
**Status:** ✅ Complete  
**Version:** 2.0  

---

## Overview

The Excel export now automatically matches the UI language - if you're viewing the app in Arabic, the Excel file exports in Arabic. If English, then English!

---

## How It Works

### Automatic Language Detection
- The system detects your current UI language
- Passes it to the backend during export
- Backend generates Excel with translated headers and values

### Supported Languages
- ✅ **English (EN)**
- ✅ **Arabic (AR)**

---

## What Gets Translated

### Column Headers
All 22 column headers are translated:
- File Number → رقم الملف
- Transaction Type → نوع المعاملة
- Goods Type → نوع البضائع
- Containers/Cars → عدد الحاويات/السيارات
- Weight → وزن البضائع
- Clearance Type → نوع التخليص
- Cost Description → وصف التكلفة
- Destination/FB → الوجهة/المستفيد النهائي
- Cost Paid By → الجهة المسؤولة عن التكلفة
- Original Clearance Amount → مبلغ التخليص الأصلي
- Extra Cost → تكلفة إضافية
- Total Clearing Cost → إجمالي تكلفة التخليص
- Client Name → اسم العميل
- Invoice Amount → مبلغ الفاتورة
- Currency → العملة
- Invoice Number → رقم الفاتورة
- Invoice Date → تاريخ الفاتورة
- BOL Number → رقم البوليصة
- Car Plate → رقم السيارة
- Extra Cost Description → وصف التكلفة الإضافية
- Payment Status → حالة الدفع
- Notes → ملاحظات

### Sheet Names
- Batch Summary → ملخص الدفعة
- Batch Items → عناصر الدفعة
- Totals Breakdown → تفصيل الإجماليات

### Values
Enum values are also translated:
- **Status:**
  - Pending → قيد الانتظار
  - Approved → موافق عليها
  - Archived → مؤرشفة

- **Clearance Type:**
  - Inbound → وارد
  - Outbound → صادر

- **Payment Status:**
  - Pending → قيد الانتظار
  - Paid → مدفوع
  - Partial → جزئي

- **Cost Paid By:**
  - Company → الشركة
  - Client → العميل

---

## Example Export

### English UI → English Excel:
```
Sheet 1: Batch Summary
Field                    | Value
-------------------------|------------------
Batch Number             | ATB-142
Status                   | PENDING
Number of Items          | 5
Total Clearing Cost      | $15,250.00
```

### Arabic UI → Arabic Excel:
```
Sheet 1: ملخص الدفعة
الحقل                    | القيمة
-------------------------|------------------
رقم الدفعة               | ATB-142
الحالة                   | قيد الانتظار
عدد العناصر              | 5
إجمالي تكلفة التخليص     | $15,250.00
```

---

## Technical Implementation

### Files Created/Modified:

1. **app/src/services/excelTranslations.ts** (NEW)
   - Contains all EN and AR translations
   - Helper functions for translating status, clearance type, payment status
   - Type-safe translation keys

2. **app/src/services/excelExportService.ts** (MODIFIED)
   - Updated `exportCustomsClearingBatch()` to accept language parameter
   - All headers use translation function
   - All enum values translated
   - Numeric fields properly converted with `Number()`

3. **app/src/routes/customsClearingBatches.ts** (MODIFIED)
   - Export endpoint accepts `?lang=ar` or `?lang=en` query parameter
   - Defaults to 'en' if not specified
   - Passes language to export function

4. **vibe/src/services/customsClearingBatchService.ts** (MODIFIED)
   - `exportBatch()` now accepts language parameter
   - Passes language as query param to backend

5. **vibe/src/hooks/useCustomsClearingBatches.ts** (MODIFIED)
   - Uses `useTranslation()` to get current language
   - Automatically detects if UI is in Arabic or English
   - Passes language to service

---

## How to Use

### For End Users:
**No action needed!** The export automatically matches your UI language.

1. Switch UI to Arabic → Excel exports in Arabic
2. Switch UI to English → Excel exports in English

### For Developers:
To add new translations, edit `app/src/services/excelTranslations.ts`:

```typescript
export const excelTranslations = {
  en: {
    newField: 'New Field Name',
  },
  ar: {
    newField: 'اسم الحقل الجديد',
  },
};
```

---

## Benefits

✅ **Professional** - Reports match the language preferences  
✅ **User-Friendly** - No confusion about what columns mean  
✅ **Accounting Ready** - Arabic-speaking accountants get Arabic reports  
✅ **Flexible** - Supports both languages seamlessly  
✅ **Automatic** - No manual language selection needed  
✅ **Consistent** - UI and exports always match  

---

## Testing Checklist

- [x] Backend accepts language parameter
- [x] Frontend passes current language
- [x] English headers work
- [x] Arabic headers work
- [x] Status values translated
- [x] Clearance type values translated
- [x] Payment status values translated
- [x] Sheet names translated
- [ ] Manual test: Export in English
- [ ] Manual test: Switch to Arabic, export in Arabic
- [ ] Manual test: Verify all columns are correctly translated

---

**Implementation Complete:** November 26, 2025  
**Status:** ✅ Ready for Testing

**Note:** The $0.00 values in your test batches are accurate - those items (LIN-723, LIN-722) have zero costs. Create a batch with real clearing cost entries to see actual amounts!

