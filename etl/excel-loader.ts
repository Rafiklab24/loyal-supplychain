#!/usr/bin/env ts-node
/**
 * ETL: البضاعة القادمة محدث.xlsx → logistics.shipments
 * 
 * Usage: ts-node etl/excel-loader.ts --file "/path/البضاعة القادمة محدث.xlsx"
 */

import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import { existsSync } from 'fs';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Arabic status → database enum mapping
const STATUS_MAP: Record<string, string> = {
  'محجوز': 'booked',
  'دخل الميناء': 'gate_in',
  'تحميل': 'loaded',
  'أبحرت': 'sailed',
  'وصلت': 'arrived',
  'مُسلمة': 'delivered',
  'مفوترة': 'invoiced',
  'تخطيط': 'planning',
};

// Column mapping: Arabic Excel headers → English
const COLUMN_MAP: Record<string, string> = {
  // Original expected column names
  'SN': 'sn',
  'نوع البضاعة': 'product_text',
  'عدد الحاويات': 'container_count',
  'الوزن/طن': 'weight_ton',
  'التثبيت $': 'fixed_price_usd_per_ton',
  'POL': 'pol',
  'POD': 'pod',
  'ETA': 'eta',
  'FREE TIME / السماح': 'free_time_days',
  'الحالة': 'status',
  'الرصيد/$': 'balance_value_usd',
  'الآوراق': 'paperwork_status',
  'شركة الشحن': 'shipping_line',
  'التعقب': 'booking_no',
  'رقم البوليصة': 'bl_no',
  'تاريخ الرعبون': 'deposit_date',
  'تاريخ الشحن حسب العقد': 'contract_ship_date',
  'تاريخ البوليصة': 'bl_date',
  
  // Actual column names from the Excel file
  'رقم العقد': 'sn',  // Contract number - use as unique identifier
  'الرقم': 'row_number',  // Sequential row number
  'نوع البضاعة ': 'product_text',  // Note: has trailing space!
  'حاوية': 'container_count',  // Container
  'الكمية طن': 'weight_ton',  // Quantity in tons
  'سعر الطن': 'fixed_price_usd_per_ton',  // Price per ton
  'المنشأ': 'pol',  // Origin/POL
  'الجهة': 'pod',  // Destination/POD
  'الشركة المصدرة': 'shipping_line',  // Exporting company
  // Note: الإجمالي, مدفوع, الباقي للدفع are informational only in Excel
  // The database calculates these via triggers from finance.transfers table
};

interface RawRow {
  [key: string]: any;
}

interface ShipmentData {
  sn?: string;
  product_text?: string;
  container_count?: number;
  weight_ton?: number;
  fixed_price_usd_per_ton?: number;
  pol?: string;
  pod?: string;
  eta?: Date | null;
  free_time_days?: number;
  status?: string;
  paperwork_status?: string;
  shipping_line?: string;
  booking_no?: string;
  bl_no?: string;
  deposit_date?: Date | null;
  contract_ship_date?: Date | null;
  bl_date?: Date | null;
  pol_id?: string;
  pod_id?: string;
  shipping_line_id?: string;
  total_value_usd?: number;
}

/**
 * Normalize Arabic text (trim, normalize spaces)
 */
function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';
  return text.toString().trim().replace(/\s+/g, ' ');
}

/**
 * Parse Excel date or date string
 */
function parseDate(value: any): Date | null {
  if (!value) return null;
  
  // Excel numeric date
  if (typeof value === 'number') {
    return XLSX.SSF.parse_date_code(value);
  }
  
  // String date
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Handle placeholder text like "شهر 10" (Month 10) or "شهر 9" (Month 9)
    // Format: "شهر" followed by month number
    const monthPlaceholder = trimmed.match(/شهر\s*(\d+)/);
    if (monthPlaceholder) {
      const month = parseInt(monthPlaceholder[1]);
      if (month >= 1 && month <= 12) {
        // Use current year (2025) and set to first day of that month
        return new Date(2025, month - 1, 1);
      }
    }
    
    // Handle regular date formats
    const datePattern = /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/;
    
    if (!datePattern.test(trimmed)) {
      // String doesn't look like a date format
      return null;
    }
    
    const parsed = new Date(trimmed);
    // Validate the year is reasonable (2000-2100)
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100) {
      return parsed;
    }
  }
  
  return null;
}

/**
 * Lookup or insert port by name, returns UUID
 */
async function upsertPort(portName: string): Promise<string | null> {
  if (!portName) return null;
  
  const name = normalizeArabic(portName);
  if (!name) return null;
  
  const result = await pool.query(
    `INSERT INTO master_data.ports (name, country)
     VALUES ($1, '')
     ON CONFLICT (lower(name), coalesce(lower(country), ''))
     DO UPDATE SET updated_at = now()
     RETURNING id`,
    [name]
  );
  
  return result.rows[0]?.id || null;
}

/**
 * Lookup or insert company (shipping line), returns UUID
 */
async function upsertShippingLine(companyName: string): Promise<string | null> {
  if (!companyName) return null;
  
  const name = normalizeArabic(companyName);
  if (!name) return null;
  
  const result = await pool.query(
    `INSERT INTO master_data.companies (name, country, is_shipping_line)
     VALUES ($1, '', true)
     ON CONFLICT (lower(name), coalesce(lower(country), ''))
     DO UPDATE SET is_shipping_line = true, updated_at = now()
     RETURNING id`,
    [name]
  );
  
  return result.rows[0]?.id || null;
}

/**
 * Map Arabic status to enum value
 */
function mapStatus(arabicStatus: string | null | undefined): string | null {
  if (!arabicStatus) return null;
  
  const normalized = normalizeArabic(arabicStatus);
  
  // Try exact match
  if (STATUS_MAP[normalized]) {
    return STATUS_MAP[normalized];
  }
  
  // Try partial match (case insensitive)
  for (const [arabic, english] of Object.entries(STATUS_MAP)) {
    if (normalized.includes(arabic)) {
      return english;
    }
  }
  
  return null;
}

/**
 * Transform raw Excel row to shipment data
 */
function transformRow(rawRow: RawRow): ShipmentData {
  const data: ShipmentData = {};
  
  // Map columns
  for (const [arabicCol, englishCol] of Object.entries(COLUMN_MAP)) {
    const value = rawRow[arabicCol];
    
    if (value !== undefined && value !== null && value !== '') {
      switch (englishCol) {
        case 'sn':
        case 'product_text':
        case 'paperwork_status':
        case 'booking_no':
        case 'bl_no':
          data[englishCol] = normalizeArabic(value);
          break;
        
        case 'container_count':
        case 'free_time_days':
          const intVal = parseInt(value);
          if (!isNaN(intVal)) {
            data[englishCol] = intVal;
          }
          break;
        
        case 'weight_ton':
        case 'fixed_price_usd_per_ton':
          // Remove currency symbols, commas, and other formatting
          const cleanedValue = String(value).replace(/[$,\s]/g, '');
          const floatVal = parseFloat(cleanedValue);
          if (!isNaN(floatVal) && floatVal > 0) {
            data[englishCol] = floatVal;
          }
          break;
        
        case 'eta':
        case 'deposit_date':
        case 'contract_ship_date':
        case 'bl_date':
          data[englishCol] = parseDate(value);
          break;
        
        case 'status':
          data.status = mapStatus(value) || undefined;
          break;
        
        case 'pol':
        case 'pod':
        case 'shipping_line':
          data[englishCol] = normalizeArabic(value);
          break;
      }
    }
  }
  
  // Compute total_value_usd if we have weight and price
  if (data.weight_ton && data.fixed_price_usd_per_ton) {
    data.total_value_usd = data.weight_ton * data.fixed_price_usd_per_ton;
  }
  
  // Override status if row is marked as delivered (grey highlight in Excel)
  if (rawRow.__isDelivered === true) {
    data.status = 'delivered';
  }
  
  return data;
}

/**
 * Insert shipment into database (allows duplicate SNs as same contract can have multiple shipments)
 */
async function insertShipment(data: ShipmentData): Promise<void> {
  // Handle lookups for foreign keys
  if (data.pol) {
    data.pol_id = await upsertPort(data.pol) || undefined;
  }
  
  if (data.pod) {
    data.pod_id = await upsertPort(data.pod) || undefined;
  }
  
  if (data.shipping_line) {
    data.shipping_line_id = await upsertShippingLine(data.shipping_line) || undefined;
  }
  
  // Skip if no SN
  if (!data.sn) {
    console.warn('⚠️  Skipping row without SN');
    return;
  }
  
  // Insert shipment (allow duplicates - same contract can have multiple shipments)
  await pool.query(
    `INSERT INTO logistics.shipments (
      sn, direction, product_text, container_count, weight_ton, fixed_price_usd_per_ton,
      pol_id, pod_id, eta, free_time_days, status, paperwork_status,
      shipping_line_id, booking_no, bl_no, deposit_date, contract_ship_date, bl_date,
      total_value_usd, created_by, updated_by
    )
    VALUES (
      $1, 'incoming', $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17,
      $18, 'etl-excel', 'etl-excel'
    )`,
    [
      data.sn,
      data.product_text,
      data.container_count,
      data.weight_ton,
      data.fixed_price_usd_per_ton,
      data.pol_id,
      data.pod_id,
      data.eta,
      data.free_time_days,
      data.status,
      data.paperwork_status,
      data.shipping_line_id,
      data.booking_no,
      data.bl_no,
      data.deposit_date,
      data.contract_ship_date,
      data.bl_date,
      data.total_value_usd,
    ]
  );
  
  console.log(`✓ Inserted shipment: ${data.sn}`);
}

/**
 * Main ETL function
 */
async function loadExcel(filePath: string): Promise<void> {
  console.log(`\n📊 Loading Excel file: ${filePath}\n`);
  
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Read Excel file with cell styles to detect background colors
  const workbook = XLSX.readFile(filePath, { cellStyles: true });
  
  // Look for the specific sheet: "جدول وصول البضائع"
  const targetSheetName = 'جدول وصول البضائع';
  let sheetName = targetSheetName;
  
  // If target sheet doesn't exist, fall back to first sheet
  if (!workbook.SheetNames.includes(targetSheetName)) {
    console.log(`⚠️  Sheet "${targetSheetName}" not found. Available sheets:`);
    workbook.SheetNames.forEach((name, idx) => console.log(`   ${idx}: ${name}`));
    sheetName = workbook.SheetNames[0];
    console.log(`📄 Using first sheet: ${sheetName}\n`);
  } else {
    console.log(`📄 Reading sheet: ${sheetName}`);
  }
  
  const sheet = workbook.Sheets[sheetName];
  
  // For "جدول وصول البضائع", skip the first row (date header) and use row 2 as headers
  let rawData: RawRow[];
  let deliveredCount = 0;
  
  if (sheetName === 'جدول وصول البضائع') {
    // Read all rows first
    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
    // Row 0 is date, Row 1 is headers, Row 2+ is data
    const headers = allRows[1] as string[];
    const dataRows = allRows.slice(2);
    
    // Helper function to detect if a cell has grey/dark background
    function isGreyRow(rowIndex: number): boolean {
      const excelRowNum = rowIndex + 3; // +2 for header rows, +1 for Excel 1-based indexing
      
      // Check columns A and B (SN and product - these usually have cell styling)
      const columnsToCheck = ['A', 'B'];
      
      for (const col of columnsToCheck) {
        const cellAddress = `${col}${excelRowNum}`;
        const cell = sheet[cellAddress];
        
        if (cell && cell.s) {
          const style = cell.s;
          
          // Check for grey tint on theme color (Excel dark grey highlighting)
          // Grey cells have: fgColor.theme = 0, fgColor.tint ≈ -0.5
          if (style.fgColor && style.fgColor.theme === 0 && style.fgColor.tint) {
            // Tint of -0.5 makes white (theme 0) into grey
            if (style.fgColor.tint < -0.3) {
              return true;
            }
          }
          
          // Also check for direct RGB grey values
          if (style.fgColor && style.fgColor.rgb) {
            const rgb = style.fgColor.rgb.toLowerCase();
            // Grey colors: C0C0C0, D3D3D3, 999999, 808080, A9A9A9, etc.
            if (rgb.startsWith('c0c0c0') || rgb.startsWith('d3d3d3') || 
                rgb.startsWith('999') || rgb.startsWith('808080') || 
                rgb.startsWith('a9a9a9') || rgb.startsWith('969696')) {
              return true;
            }
          }
          
          // Check indexed color for grey shades
          if (style.fgColor && style.fgColor.indexed && 
              (style.fgColor.indexed === 22 || style.fgColor.indexed === 56)) {
            return true;
          }
        }
      }
      
      return false;
    }
    
    // Convert to objects using headers and detect grey rows
    rawData = dataRows.map((row, idx) => {
      const obj: any = {};
      headers.forEach((header, headerIdx) => {
        obj[header] = row[headerIdx] || null;
      });
      
      // Check if this row has grey background (delivered/cleared)
      if (isGreyRow(idx)) {
        obj.__isDelivered = true;
        deliveredCount++;
      }
      
      return obj;
    });
    
    console.log(`   (Skipped 2 header rows, using ${dataRows.length} data rows)`);
    if (deliveredCount > 0) {
      console.log(`   🔒 Detected ${deliveredCount} cleared/delivered shipments (grey highlight)`);
    }
  } else {
    // Standard: first row is headers
    rawData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });
  }
  
  console.log(`📋 Found ${rawData.length} rows\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < rawData.length; i++) {
    const rawRow = rawData[i];
    
    try {
      const shipmentData = transformRow(rawRow);
      
      // Skip completely empty rows
      if (!shipmentData.sn && !shipmentData.product_text) {
        continue;
      }
      
      await insertShipment(shipmentData);
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`✗ Error processing row ${i + 2}:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log(`\n✅ Import complete: ${successCount} successful, ${errorCount} errors`);
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  
  if (fileIndex === -1 || !args[fileIndex + 1]) {
    console.error('Usage: ts-node etl/excel-loader.ts --file "/path/البضاعة القادمة محدث.xlsx"');
    process.exit(1);
  }
  
  const filePath = args[fileIndex + 1];
  
  try {
    await loadExcel(filePath);
  } catch (error) {
    console.error('ETL failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { loadExcel, transformRow, insertShipment };
