#!/bin/bash

# Reimport shipments from the correct Excel sheet
# جدول وصول البضائع - the main arrivals schedule

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║     🔄 RE-IMPORTING SHIPMENTS FROM CORRECT SHEET         ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Setting default..."
    export DATABASE_URL="postgresql://rafik@localhost:5432/loyal_supplychain"
fi

echo "📡 Database: $DATABASE_URL"
echo ""

# Step 1: Clear existing shipments
echo "🗑️  Step 1: Clearing existing shipments..."
psql "$DATABASE_URL" -c "TRUNCATE logistics.shipments CASCADE;" 2>&1 | grep -v "^TRUNCATE" || true
echo "✅ Old data cleared"
echo ""

# Step 2: Find the Excel file
EXCEL_FILE="data/البضاعة القادمة محدث.xlsx"

if [ ! -f "$EXCEL_FILE" ]; then
    echo "❌ Excel file not found: $EXCEL_FILE"
    echo "Please provide the path to the Excel file:"
    read -p "File path: " EXCEL_FILE
fi

echo "📂 Using file: $EXCEL_FILE"
echo ""

# Step 3: Run the ETL import
echo "📥 Step 2: Importing from sheet 'جدول وصول البضائع'..."
echo ""
npx ts-node etl/excel-loader.ts --file "$EXCEL_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 4: Verify import
echo "📊 Step 3: Verifying import..."
echo ""
psql "$DATABASE_URL" -c "
SELECT 
    COUNT(*) as total_shipments,
    COUNT(DISTINCT sn) as unique_contracts,
    COUNT(*) FILTER (WHERE eta IS NOT NULL) as shipments_with_eta,
    MIN(eta) as earliest_eta,
    MAX(eta) as latest_eta
FROM logistics.shipments;
" | head -7

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Re-import complete!"
echo ""
echo "🌐 Refresh your browser at http://localhost:5173 to see updated data"
echo ""

