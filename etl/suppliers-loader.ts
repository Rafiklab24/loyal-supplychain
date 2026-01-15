#!/usr/bin/env ts-node
/**
 * ETL: Supplier Excel files → master_data.companies
 * 
 * Loads:
 * - LOYAL- SUPPLIER INDEX modified.xlsx
 * - WorldFood 2025 Suppliers.xlsx
 * 
 * Usage: ts-node etl/suppliers-loader.ts --files "file1.xlsx,file2.xlsx"
 */

import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import { existsSync } from 'fs';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Possible column name variations for supplier data (case-insensitive)
const COLUMN_PATTERNS = {
  name: [
    'company',
    'supplier',
    'company name',
    'supplier name',
    'name',
    'اسم الشركة',
    'المورد',
  ],
  country: [
    'country',
    'الدولة',
    'البلد',
  ],
  city: [
    'city',
    'المدينة',
  ],
  address: [
    'address',
    'العنوان',
  ],
  phone: [
    'phone',
    'whatsapp',
    'phone/whatsapp',
    'mobile',
    'tel',
    'هاتف',
    'واتساب',
  ],
  email: [
    'email',
    'e-mail',
    'البريد الإلكتروني',
  ],
  website: [
    'website',
    'web',
    'url',
    'الموقع',
  ],
};

interface SupplierData {
  name: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface RawRow {
  [key: string]: any;
}

/**
 * Normalize text (trim, normalize spaces)
 */
function normalize(text: string | null | undefined): string {
  if (!text) return '';
  return text.toString().trim().replace(/\s+/g, ' ');
}

/**
 * Find column value by trying multiple possible header names (case-insensitive)
 */
function findColumnValue(row: RawRow, patterns: string[]): string | undefined {
  const headers = Object.keys(row);
  
  for (const pattern of patterns) {
    // Try exact match (case-insensitive)
    const exactMatch = headers.find(h => 
      h.toLowerCase().trim() === pattern.toLowerCase()
    );
    if (exactMatch && row[exactMatch]) {
      return normalize(row[exactMatch]);
    }
    
    // Try partial match (contains pattern)
    const partialMatch = headers.find(h => 
      h.toLowerCase().includes(pattern.toLowerCase())
    );
    if (partialMatch && row[partialMatch]) {
      return normalize(row[partialMatch]);
    }
  }
  
  return undefined;
}

/**
 * Transform raw Excel row to supplier data
 */
function transformRow(rawRow: RawRow): SupplierData | null {
  const name = findColumnValue(rawRow, COLUMN_PATTERNS.name);
  
  // Skip rows without a company name
  if (!name) {
    return null;
  }
  
  const data: SupplierData = {
    name,
    country: findColumnValue(rawRow, COLUMN_PATTERNS.country),
    city: findColumnValue(rawRow, COLUMN_PATTERNS.city),
    address: findColumnValue(rawRow, COLUMN_PATTERNS.address),
    phone: findColumnValue(rawRow, COLUMN_PATTERNS.phone),
    email: findColumnValue(rawRow, COLUMN_PATTERNS.email),
    website: findColumnValue(rawRow, COLUMN_PATTERNS.website),
  };
  
  return data;
}

/**
 * Upsert supplier into database
 * Strategy: Insert new, or update existing ONLY if field is NULL (preserve existing data)
 */
async function upsertSupplier(data: SupplierData): Promise<void> {
  if (!data.name) {
    console.warn('⚠️  Skipping row without name');
    return;
  }
  
  const name = data.name;
  const country = data.country || '';
  
  // First, try to insert
  const insertResult = await pool.query(
    `INSERT INTO master_data.companies (
      name, country, city, address, phone, email, website,
      is_supplier, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'etl-suppliers')
    ON CONFLICT (lower(name), coalesce(lower(country), ''))
    DO NOTHING
    RETURNING id`,
    [name, country, data.city, data.address, data.phone, data.email, data.website]
  );
  
  // If inserted (new record), we're done
  if (insertResult.rows.length > 0) {
    console.log(`✓ Inserted supplier: ${name}${country ? ' (' + country + ')' : ''}`);
    return;
  }
  
  // If not inserted, record exists - update only NULL fields
  // Build dynamic UPDATE query to only update NULL fields
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (data.city) {
    updates.push(`city = COALESCE(city, $${paramIndex})`);
    values.push(data.city);
    paramIndex++;
  }
  
  if (data.address) {
    updates.push(`address = COALESCE(address, $${paramIndex})`);
    values.push(data.address);
    paramIndex++;
  }
  
  if (data.phone) {
    updates.push(`phone = COALESCE(phone, $${paramIndex})`);
    values.push(data.phone);
    paramIndex++;
  }
  
  if (data.email) {
    updates.push(`email = COALESCE(email, $${paramIndex})`);
    values.push(data.email);
    paramIndex++;
  }
  
  if (data.website) {
    updates.push(`website = COALESCE(website, $${paramIndex})`);
    values.push(data.website);
    paramIndex++;
  }
  
  // Always ensure is_supplier is true and update metadata
  updates.push('is_supplier = true');
  updates.push('updated_at = now()');
  updates.push(`updated_by = 'etl-suppliers'`);
  
  // Add WHERE clause parameters
  values.push(name);
  const nameParam = paramIndex++;
  values.push(country);
  const countryParam = paramIndex++;
  
  if (updates.length > 0) {
    const query = `
      UPDATE master_data.companies
      SET ${updates.join(', ')}
      WHERE lower(name) = lower($${nameParam})
        AND coalesce(lower(country), '') = coalesce(lower($${countryParam}), '')
    `;
    
    await pool.query(query, values);
    console.log(`✓ Updated supplier: ${name}${country ? ' (' + country + ')' : ''}`);
  }
}

/**
 * Load a single Excel file
 */
async function loadExcelFile(filePath: string): Promise<{ success: number; errors: number }> {
  console.log(`\n📊 Loading Excel file: ${filePath}`);
  
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Read Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  console.log(`📄 Reading sheet: ${sheetName}`);
  
  // Convert to JSON (array of objects with headers as keys)
  const rawData: RawRow[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });
  
  console.log(`📋 Found ${rawData.length} rows`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < rawData.length; i++) {
    const rawRow = rawData[i];
    
    try {
      const supplierData = transformRow(rawRow);
      
      // Skip empty rows
      if (!supplierData) {
        continue;
      }
      
      await upsertSupplier(supplierData);
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`✗ Error processing row ${i + 2}:`, error instanceof Error ? error.message : error);
    }
  }
  
  return { success: successCount, errors: errorCount };
}

/**
 * Main ETL function - load multiple files
 */
async function loadSuppliers(filePaths: string[]): Promise<void> {
  console.log(`\n📦 Suppliers ETL - Loading ${filePaths.length} file(s)\n`);
  
  let totalSuccess = 0;
  let totalErrors = 0;
  
  for (const filePath of filePaths) {
    try {
      const result = await loadExcelFile(filePath);
      totalSuccess += result.success;
      totalErrors += result.errors;
    } catch (error) {
      console.error(`✗ Failed to load file ${filePath}:`, error instanceof Error ? error.message : error);
      totalErrors++;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ All files processed`);
  console.log(`   Total successful: ${totalSuccess}`);
  console.log(`   Total errors: ${totalErrors}`);
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const filesIndex = args.indexOf('--files');
  
  if (filesIndex === -1 || !args[filesIndex + 1]) {
    console.error('Usage: ts-node etl/suppliers-loader.ts --files "file1.xlsx,file2.xlsx"');
    console.error('\nExample:');
    console.error('  ts-node etl/suppliers-loader.ts --files "LOYAL- SUPPLIER INDEX modified.xlsx,WorldFood 2025 Suppliers.xlsx"');
    process.exit(1);
  }
  
  const filesArg = args[filesIndex + 1];
  const filePaths = filesArg.split(',').map(f => f.trim()).filter(f => f.length > 0);
  
  if (filePaths.length === 0) {
    console.error('Error: No files specified');
    process.exit(1);
  }
  
  try {
    await loadSuppliers(filePaths);
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

export { loadSuppliers, transformRow, upsertSupplier };
