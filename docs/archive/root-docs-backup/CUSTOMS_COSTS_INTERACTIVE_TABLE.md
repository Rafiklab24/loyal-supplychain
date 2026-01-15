# Customs Clearing Costs - Interactive Table Implementation

## Overview
The Customs Clearing Costs page now features inline editing capabilities with instant row creation, providing a streamlined data entry experience for customs officers.

## Features Implemented

### 1. Interactive Rows (Click-to-Edit)
- **Click any row** to enter edit mode instantly
- All fields become editable inline (no modal required)
- Visual indicators:
  - Light blue background when editing
  - Blue left border
  - Disabled checkbox during edit
- **Save/Cancel buttons** appear in the Actions column:
  - ✓ Green checkmark to save changes
  - ✗ Red X to cancel and revert

### 2. Instant Row Addition
- **"+ إضافة قيد جديد" button** creates an empty editable row at the top of the table
- Visual indicators for new rows:
  - Green left border
  - "NEW" label in green
  - Light green background
- Fill in all fields and click save to persist the new record

### 3. Field Updates

#### Original Clearance Amount (مبلغ التخليص الأصلي)
- **Before**: Two separate fields (Company / Client)
- **After**: Single unified field
- Accepts any numeric value
- Auto-calculates total with extra costs

#### Cost Responsibility (الجهة المسؤولة عن التكلفة)
- **Before**: Auto-calculated badge (Company/Client)
- **After**: Free-text editable field
- Enter any value (e.g., "Company", "Client", "Shared", "Partner", etc.)

#### Clearance Type (نوع التخليص)
- **Before**: Dropdown with "Inbound/Outbound"
- **After**: Autocomplete text field with Arabic suggestions:
  - **تخليص** (Clearance)
  - **تحميل** (Loading)
  - **تخليص + تحميل** (Clearance + Loading)
  - **إدخالات** (Entries/Imports)
  - **اخراجات** (Exits/Exports)
- Type 1-2 letters to see matching suggestions
- Can also enter custom values

## Technical Implementation

### Database Changes
- **Migration 026**: Added new columns
  - `cost_responsibility` (TEXT)
  - `original_clearing_amount` (NUMERIC)
  - Split transaction_description into separate fields
- **Migration 027**: Migrated existing data
  - Copied `cost_paid_by_company` → `original_clearing_amount`
  - Copied `cost_paid_by_fb` → `original_clearing_amount`
  - Set default `cost_responsibility` based on old fields

### Frontend Changes
- State management for inline editing
- Support for temporary IDs for new rows
- Auto-calculation of totals
- Date format handling (ISO → YYYY-MM-DD)
- Validation before save

### Backend Changes
- Updated route handlers to accept new fields
- Updated validators to support both new and legacy fields
- Backward compatibility maintained

## User Workflow

### Adding a New Record
1. Click "إضافة قيد جديد" (green + button)
2. New empty row appears at top with all editable fields
3. Fill in the required fields:
   - **رقم الملف** (File Number) - REQUIRED
   - **مبلغ التخليص الأصلي** (Original Amount) - At least one cost field required
4. Fill in optional fields as needed
5. Click ✓ (checkmark) to save
6. Click ✗ (X) to cancel and remove the empty row

### Editing an Existing Record
1. Click anywhere on the row
2. Row enters edit mode with all fields editable
3. Make your changes
4. Click ✓ (checkmark) to save
5. Click ✗ (X) to cancel and revert changes

## Data Validation
- **Required**: File number
- **Required**: At least one cost amount (Original Clearing Amount or Extra Cost)
- **Date Format**: YYYY-MM-DD (auto-converted)
- **Currency**: Defaults to USD
- **Payment Status**: Defaults to "pending"

## Notes
- Only one row can be in edit mode at a time (for existing rows)
- Multiple new rows can be added simultaneously
- Checkbox selection is disabled while editing
- All changes are saved to the database immediately upon clicking save
- Page auto-refreshes after successful save

## Legacy Field Support
The old fields (`cost_paid_by_company`, `cost_paid_by_fb`) are still stored in the database for backward compatibility but are deprecated in favor of the new unified approach.

