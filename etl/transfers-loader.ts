#!/usr/bin/env ts-node
/**
 * ETL: حوالات (Transfers) Excel files → finance.transfers
 * 
 * Usage:
 *   ts-node etl/transfers-loader.ts --file "/path/الحوالات2025.xlsx"
 *   ts-node etl/transfers-loader.ts --file "/path/الحوالات2025.xlsx" --dry-run
 */

import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import { existsSync } from 'fs';
import { basename } from 'path';
import { beginImport, finishImport } from './lib/import-log';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Direction mapping: Arabic/English → database enum
const DIRECTION_MAP: Record<string, string> = {
  'وارد': 'received',
  'مدفوع': 'paid',
  'received': 'received',
  'paid': 'paid',
  'in': 'received',
  'out': 'paid',
};

// Column mapping patterns (case-insensitive, English/Arabic)
const COLUMN_PATTERNS = {
  transfer_date: ['التاريخ', 'Date', 'تاريخ', 'التاريخ الميلادي'],
  amount: ['المبلغ', 'Amount', 'القيمة'],
  currency: ['العملة', 'Currency', 'عملة'],
  bank_name: ['البنك', 'Bank', 'اسم البنك'],
  bank_account: ['الحساب', 'Account', 'رقم الحساب'],
  sender: ['المرسل', 'Sender', 'من'],
  receiver: ['المستلم', 'Receiver', 'إلى', 'المستفيد'],
  reference: ['المرجع', 'Reference', 'Ref', 'المرجع/ملاحظة'],
  notes: ['ملاحظة', 'Notes', 'ملاحظات', 'Note'],
  sn: ['SN', 'المرجع الداخلي', 'رقم الشحنة', 'Shipment'],
  direction: ['النوع', 'Type', 'Direction', 'الاتجاه'],
};

interface RawRow {
  [key: string]: any;
}

interface TransferData {
  transfer_date: Date | null;
  amount: number | null;
  currency: string;
  bank_name?: string;
  bank_account?: string;
  sender?: string;
  receiver?: string;
  reference?: string;
  notes?: string;
  sn?: string;
  direction: string | null;
  shipment_id?: string | null;
}

interface ImportStats {
  totalRows: number;
  insertedCount: number;
  skippedCount: number;
  unknownSnCount: number;
  totalsByDirectionCurrency: Map<string, number>;
  errors: string[];
}

/**
 * Normalize text
 */
function normalize(text: string | null | undefined): string {
  if (!text) return '';
  return text.toString().trim().replace(/\s+/g, ' ');
}

/**
 * Find column value by trying multiple header patterns
 */
function findColumnValue(row: RawRow, patterns: string[]): string | undefined {
  const headers = Object.keys(row);
  
  for (const pattern of patterns) {
    // Exact match (case-insensitive)
    const exactMatch = headers.find(h => 
      h.toLowerCase().trim() === pattern.toLowerCase()
    );
    if (exactMatch && row[exactMatch] !== null && row[exactMatch] !== undefined && row[exactMatch] !== '') {
      return normalize(row[exactMatch]);
    }
    
    // Partial match
    const partialMatch = headers.find(h => 
      h.toLowerCase().includes(pattern.toLowerCase())
    );
    if (partialMatch && row[partialMatch] !== null && row[partialMatch] !== undefined && row[partialMatch] !== '') {
      return normalize(row[partialMatch]);
    }
  }
  
  return undefined;
}

/**
 * Parse Excel date or string date
 */
function parseDate(value: any): Date | null {
  if (!value) return null;
  
  // Excel numeric date
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }
  
  // String date
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
}

/**
 * Parse amount (handle different number formats)
 */
function parseAmount(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Already a number
  if (typeof value === 'number') {
    return value;
  }
  
  // String - remove formatting
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,،]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

/**
 * Map direction value to enum
 */
function mapDirection(value: string | null | undefined): string | null {
  if (!value) return null;
  
  const normalized = normalize(value).toLowerCase();
  
  for (const [key, mapped] of Object.entries(DIRECTION_MAP)) {
    if (normalized.includes(key.toLowerCase())) {
      return mapped;
    }
  }
  
  return null;
}

/**
 * Transform raw Excel row to transfer data
 */
function transformRow(rawRow: RawRow): TransferData | null {
  const dateStr = findColumnValue(rawRow, COLUMN_PATTERNS.transfer_date);
  const amountStr = findColumnValue(rawRow, COLUMN_PATTERNS.amount);
  const directionStr = findColumnValue(rawRow, COLUMN_PATTERNS.direction);
  
  const transfer_date = parseDate(dateStr);
  const amount = parseAmount(amountStr);
  const direction = mapDirection(directionStr);
  
  // Skip rows without essential data
  if (!transfer_date || amount === null || !direction) {
    return null;
  }
  
  const data: TransferData = {
    transfer_date,
    amount,
    currency: findColumnValue(rawRow, COLUMN_PATTERNS.currency) || 'USD',
    bank_name: findColumnValue(rawRow, COLUMN_PATTERNS.bank_name),
    bank_account: findColumnValue(rawRow, COLUMN_PATTERNS.bank_account),
    sender: findColumnValue(rawRow, COLUMN_PATTERNS.sender),
    receiver: findColumnValue(rawRow, COLUMN_PATTERNS.receiver),
    reference: findColumnValue(rawRow, COLUMN_PATTERNS.reference),
    notes: findColumnValue(rawRow, COLUMN_PATTERNS.notes),
    sn: findColumnValue(rawRow, COLUMN_PATTERNS.sn),
    direction,
  };
  
  return data;
}

/**
 * Lookup shipment ID by SN
 */
async function lookupShipmentId(sn: string | undefined): Promise<string | null> {
  if (!sn) return null;
  
  const result = await pool.query(
    'SELECT id FROM logistics.shipments WHERE lower(sn) = lower($1) LIMIT 1',
    [sn]
  );
  
  return result.rows[0]?.id || null;
}

/**
 * Insert transfer into database
 */
async function insertTransfer(data: TransferData, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    return true;
  }
  
  await pool.query(
    `INSERT INTO finance.transfers (
      direction, amount, currency, transfer_date,
      bank_name, bank_account, sender, receiver, reference, notes,
      shipment_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
    [
      data.direction,
      data.amount,
      data.currency,
      data.transfer_date,
      data.bank_name,
      data.bank_account,
      data.sender,
      data.receiver,
      data.reference,
      data.notes,
      data.shipment_id,
    ]
  );
  
  return true;
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Print summary report
 */
function printSummary(
  fileName: string,
  stats: ImportStats,
  dryRun: boolean,
  elapsedMs: number
): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 حوالات ETL – File: ${fileName}`);
  if (dryRun) {
    console.log(`🔍 DRY RUN MODE - No data inserted`);
  }
  console.log(`${'='.repeat(60)}`);
  console.log(`✓ Parsed: ${stats.totalRows} rows`);
  console.log(`✓ Inserted: ${stats.insertedCount}`);
  console.log(`⊗ Skipped: ${stats.skippedCount}`);
  
  if (stats.unknownSnCount > 0) {
    console.log(`⚠️  Unknown SNs: ${stats.unknownSnCount}`);
  }
  
  if (stats.errors.length > 0) {
    console.log(`✗ Errors: ${stats.errors.length}`);
    stats.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
    if (stats.errors.length > 5) {
      console.log(`  ... and ${stats.errors.length - 5} more`);
    }
  }
  
  console.log(`\nTotals by Direction & Currency:`);
  if (stats.totalsByDirectionCurrency.size === 0) {
    console.log(`  (none)`);
  } else {
    for (const [key, total] of stats.totalsByDirectionCurrency.entries()) {
      const [direction, currency] = key.split(':');
      const label = direction === 'received' ? '⬇️  received' : '⬆️  paid';
      console.log(`  ${label} ${currency}: ${formatNumber(total)}`);
    }
  }
  
  console.log(`\n✅ Import complete in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main ETL function
 */
async function loadTransfers(filePath: string, dryRun: boolean): Promise<void> {
  const startTime = Date.now();
  const fileName = basename(filePath);
  
  console.log(`\n📊 Loading transfers from: ${filePath}`);
  if (dryRun) {
    console.log(`🔍 DRY RUN MODE enabled\n`);
  }
  
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Read Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  console.log(`📄 Reading sheet: ${sheetName}`);
  
  const rawData: RawRow[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });
  
  console.log(`📋 Found ${rawData.length} rows\n`);
  
  const stats: ImportStats = {
    totalRows: rawData.length,
    insertedCount: 0,
    skippedCount: 0,
    unknownSnCount: 0,
    totalsByDirectionCurrency: new Map(),
    errors: [],
  };
  
  // Begin import log (skip in dry-run)
  let importId: number | null = null;
  const client = await pool.connect();
  
  try {
    if (!dryRun) {
      importId = await beginImport(client, filePath);
    }
    
    // Process each row
    for (let i = 0; i < rawData.length; i++) {
      const rawRow = rawData[i];
      
      try {
        const transferData = transformRow(rawRow);
        
        if (!transferData) {
          stats.skippedCount++;
          continue;
        }
        
        // Lookup shipment ID if SN provided
        if (transferData.sn) {
          transferData.shipment_id = await lookupShipmentId(transferData.sn);
          
          if (!transferData.shipment_id) {
            console.warn(`⚠️  Row ${i + 2}: SN "${transferData.sn}" not found in shipments`);
            stats.unknownSnCount++;
          }
        }
        
        // Insert transfer
        const success = await insertTransfer(transferData, dryRun);
        
        if (success) {
          stats.insertedCount++;
          
          // Track totals
          if (transferData.direction && transferData.amount) {
            const key = `${transferData.direction}:${transferData.currency}`;
            const current = stats.totalsByDirectionCurrency.get(key) || 0;
            stats.totalsByDirectionCurrency.set(key, current + transferData.amount);
          }
          
          if ((i + 1) % 50 === 0) {
            console.log(`  Processed ${i + 1}/${rawData.length} rows...`);
          }
        }
      } catch (error) {
        stats.skippedCount++;
        const errMsg = `Row ${i + 2}: ${error instanceof Error ? error.message : error}`;
        stats.errors.push(errMsg);
        console.error(`✗ ${errMsg}`);
      }
    }
    
    // Finish import log
    if (!dryRun && importId !== null) {
      await finishImport(client, importId, {
        rowCount: stats.totalRows,
        okCount: stats.insertedCount,
        errCount: stats.skippedCount,
        notes: `Unknown SNs: ${stats.unknownSnCount}`,
      });
    }
  } finally {
    client.release();
  }
  
  const elapsedMs = Date.now() - startTime;
  
  // Print summary
  printSummary(fileName, stats, dryRun, elapsedMs);
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const dryRun = args.includes('--dry-run');
  
  if (fileIndex === -1 || !args[fileIndex + 1]) {
    console.error('Usage: ts-node etl/transfers-loader.ts --file "/path/الحوالات2025.xlsx" [--dry-run]');
    console.error('\nOptions:');
    console.error('  --file     Path to Excel file (required)');
    console.error('  --dry-run  Parse and validate only, skip database inserts');
    process.exit(1);
  }
  
  const filePath = args[fileIndex + 1];
  
  try {
    await loadTransfers(filePath, dryRun);
  } catch (error) {
    console.error('\n✗ ETL failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { loadTransfers, transformRow };
