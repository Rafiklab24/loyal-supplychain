/**
 * Shipments CSV Import Script
 * 
 * Imports Arabic shipment CSV data into the normalized shipment tables.
 * 
 * Features:
 * - Dry-run mode: Preview all changes without database modification
 * - Transaction safety: All-or-nothing import (rollback on any error)
 * - Data backup: Export existing data before replacement
 * - Validation: Check required fields, formats, and references
 * - Multi-line handling: Combine product continuation rows into JSON arrays
 * 
 * Usage:
 *   npx ts-node tools/import-shipments-csv.ts --dry-run --file data/Untitled\ 3.csv
 *   npx ts-node tools/import-shipments-csv.ts --backup --file data/Untitled\ 3.csv
 */

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Configuration
// ============================================================

const DB_URL = process.env.DATABASE_URL || 'postgresql://rafik@localhost:5432/loyal_supplychain';

// ============================================================
// Types
// ============================================================

interface CSVRow {
  rowNum: string;           // رقم
  contractNo: string;       // رقم العقد
  invoiceNo: string;        // رقم الفاتورة
  status: string;           // الحالة
  productType: string;      // نوع البضاعة
  subject: string;          // موضوع الشحنة
  containerCount: string;   // عدد الحاويات
  weightTon: string;        // الوزن (طن)
  pricePerTon: string;      // التثبيت $/ طن
  totalValue: string;       // الإجمالي
  paidValue: string;        // المدفوع
  balance: string;          // الرصيد
  pol: string;              // POL
  pod: string;              // POD
  eta: string;              // ETA
  freeTime: string;         // FREE TIME
  customsClearanceDate: string; // تاريخ التخليص الجمركي
  delayStatus: string;      // حالة التأخير
  documents: string;        // الأوراق
  shippingCompany: string;  // شركة الشحن
  tracking: string;         // التعقب (vessel)
  blNo: string;             // رقم البوليصة
  downPaymentDate: string;  // تاريخ الرعبون
  contractShipDate: string; // تاريخ الشحن حسب العقد
  blDate: string;           // تاريخ البوليصة
  finalBeneficiary: string; // المالك الفعلي
  finalDestination: string; // الوجهة النهائية
  notes: string;            // ملاحظة
}

interface ProductLine {
  product_text: string;
  weight_ton: number | null;
  price_per_ton: number | null;
  container_count: number | null;
}

interface ParsedShipment {
  sn: string;
  contractNo: string;  // Original contract number (for reference)
  invoiceNo: string;
  status: string;
  subject: string;
  notes: string;
  paperworkStatus: string;  // الأوراق → shipments.paperwork_status
  delayStatus: string;      // حالة التأخير → append to notes
  // Cargo
  productLines: ProductLine[];
  cargoType: string;
  totalContainers: number;
  totalWeight: number;
  // Logistics
  pol: string;
  pod: string;
  eta: string | null;
  freeTimeDays: number | null;
  customsClearanceDate: string | null;
  blNo: string;
  vesselName: string;
  contractShipDate: string | null;
  blDate: string | null;
  depositDate: string | null;       // تاريخ الرعبون → shipment_logistics.deposit_date
  finalDestination: string;         // الوجهة النهائية → shipment_logistics.final_destination
  // Parties
  shippingLine: string;
  finalBeneficiaryName: string;
  // Financials
  pricePerTon: number | null;
  totalValueUsd: number | null;
  paidValueUsd: number | null;
  balanceValueUsd: number | null;
  downPaymentDate: string | null;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================
// Column Mapping (Arabic → English)
// ============================================================

const COLUMN_MAP: Record<string, keyof CSVRow> = {
  'رقم': 'rowNum',
  'رقم العقد': 'contractNo',
  'رقم الفاتورة': 'invoiceNo',
  'الحالة': 'status',
  'نوع البضاعة': 'productType',
  'موضوع الشحنة': 'subject',
  'عدد\nالحاويات': 'containerCount',
  'الوزن\n(طن)': 'weightTon',
  'التثبيت $/ طن': 'pricePerTon',
  'الإجمالي': 'totalValue',
  'المدفوع': 'paidValue',
  'الرصيد': 'balance',
  'POL': 'pol',
  'POD': 'pod',
  'ETA': 'eta',
  'FREE\nTIME': 'freeTime',
  'تاريخ التخليص\nالجمركي': 'customsClearanceDate',
  'حالة التأخير': 'delayStatus',
  'الأوراق': 'documents',
  'شركة الشحن ': 'shippingCompany',
  'التعقب': 'tracking',
  'رقم البوليصة': 'blNo',
  'تاريخ الرعبون': 'downPaymentDate',
  'تاريخ الشحن\nحسب العقد': 'contractShipDate',
  'تاريخ البوليصة': 'blDate',
  'المالك الفعلي': 'finalBeneficiary',
  'الوجهة النهائية': 'finalDestination',
  'ملاحظة': 'notes',
};

// Status mapping (Arabic → Database values)
const STATUS_MAP: Record<string, string> = {
  'أبحر': 'sailed',
  'تخطيط': 'planning',
  'محجوز': 'booked',
  'وصل': 'arrived',
  'تم التسليم': 'delivered',
  'قيد الشحن': 'loading',
  'في الميناء': 'gate_in',
  '': 'planning',
};

// ============================================================
// Data Transformation Functions
// ============================================================

/**
 * Parse Arabic date format (2025/12/01 or 2025-12-01) to ISO date string
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Handle various date formats
  const cleaned = dateStr.trim();
  
  // Format: 2025/12/01 or 2025.12.01
  const slashMatch = cleaned.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
  if (slashMatch) {
    const [, year, month, day] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Format: 2025-12-01
  const dashMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    const [, year, month, day] = dashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Format: Month-Year (e.g., "October-25", "November-25")
  const monthYearMatch = cleaned.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)-(\d{2})$/i);
  if (monthYearMatch) {
    const monthNames: Record<string, string> = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };
    const month = monthNames[monthYearMatch[1].toLowerCase()];
    const year = `20${monthYearMatch[2]}`;
    return `${year}-${month}-01`;
  }
  
  console.warn(`  ⚠️  Could not parse date: "${dateStr}"`);
  return null;
}

/**
 * Parse currency value ($635,00 or $635.00 or 635,00) to number
 */
function parseCurrency(currencyStr: string): number | null {
  if (!currencyStr || currencyStr.trim() === '') return null;
  
  let cleaned = currencyStr.trim();
  
  // Handle special cases like "1250 + - التكلفة" or "678 FOB"
  if (cleaned.includes('التكلفة') || cleaned.includes('FOB')) {
    // Extract just the number
    const numMatch = cleaned.match(/[\d,\.]+/);
    if (numMatch) {
      cleaned = numMatch[0];
    } else {
      return null;
    }
  }
  
  // Remove currency symbols and whitespace
  cleaned = cleaned.replace(/[$\s\t]/g, '');
  
  // Handle European format (comma as decimal, dot as thousands)
  // vs American format (dot as decimal, comma as thousands)
  
  // If has both comma and dot, determine which is decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // If comma comes after dot, comma is decimal (European: 1.234,56)
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot comes after comma, dot is decimal (American: 1,234.56)
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma - could be decimal or thousands
    // If 3 digits after comma, it's thousands separator
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      cleaned = cleaned.replace(',', '');
    } else {
      // Assume comma is decimal separator
      cleaned = cleaned.replace(',', '.');
    }
  }
  
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Parse weight value (can have comma as decimal separator)
 */
function parseWeight(weightStr: string): number | null {
  if (!weightStr || weightStr.trim() === '') return null;
  
  let cleaned = weightStr.trim().replace(/\s/g, '');
  
  // Replace comma with dot for decimal
  cleaned = cleaned.replace(',', '.');
  
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Parse integer value
 */
function parseInt2(intStr: string): number | null {
  if (!intStr || intStr.trim() === '') return null;
  
  const value = parseInt(intStr.trim(), 10);
  return isNaN(value) ? null : value;
}

/**
 * Map Arabic status to database status
 */
function mapStatus(arabicStatus: string): string {
  const status = arabicStatus.trim();
  return STATUS_MAP[status] || 'planning';
}

// ============================================================
// CSV Parsing
// ============================================================

/**
 * Parse CSV file with semicolon delimiter
 */
function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Skip "Table 1" header if present
  let startLine = 0;
  if (lines[0].trim() === 'Table 1') {
    startLine = 1;
  }
  
  // Parse header row (may span multiple lines due to multiline headers)
  let headerLine = '';
  let headerEndLine = startLine;
  
  // Collect header (first row after "Table 1")
  for (let i = startLine; i < lines.length; i++) {
    headerLine += lines[i];
    // Check if we have all expected columns (28 columns = 27 semicolons)
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    if (semicolonCount >= 27) {
      headerEndLine = i;
      break;
    }
    headerLine += '\n';
  }
  
  // Parse headers
  const headers = parseCSVLine(headerLine);
  console.log(`📋 Found ${headers.length} columns in header`);
  
  // Map headers to field names
  const headerMap: number[] = [];
  const fieldOrder: (keyof CSVRow)[] = [
    'rowNum', 'contractNo', 'invoiceNo', 'status', 'productType', 'subject',
    'containerCount', 'weightTon', 'pricePerTon', 'totalValue', 'paidValue',
    'balance', 'pol', 'pod', 'eta', 'freeTime', 'customsClearanceDate',
    'delayStatus', 'documents', 'shippingCompany', 'tracking', 'blNo',
    'downPaymentDate', 'contractShipDate', 'blDate', 'finalBeneficiary',
    'finalDestination', 'notes'
  ];
  
  // Parse data rows
  const rows: CSVRow[] = [];
  for (let i = headerEndLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    
    // Create row object
    const row: CSVRow = {
      rowNum: '',
      contractNo: '',
      invoiceNo: '',
      status: '',
      productType: '',
      subject: '',
      containerCount: '',
      weightTon: '',
      pricePerTon: '',
      totalValue: '',
      paidValue: '',
      balance: '',
      pol: '',
      pod: '',
      eta: '',
      freeTime: '',
      customsClearanceDate: '',
      delayStatus: '',
      documents: '',
      shippingCompany: '',
      tracking: '',
      blNo: '',
      downPaymentDate: '',
      contractShipDate: '',
      blDate: '',
      finalBeneficiary: '',
      finalDestination: '',
      notes: '',
    };
    
    // Map values to fields
    for (let j = 0; j < Math.min(values.length, fieldOrder.length); j++) {
      row[fieldOrder[j]] = values[j] || '';
    }
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse a single CSV line (handling quoted fields with semicolons)
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last value
  values.push(current.trim());
  
  return values;
}

// ============================================================
// Multi-line Product Handling
// ============================================================

/**
 * Combine CSV rows into shipments (handling multi-line products)
 */
function combineIntoShipments(rows: CSVRow[]): ParsedShipment[] {
  const shipments: ParsedShipment[] = [];
  let currentShipment: ParsedShipment | null = null;
  
  for (const row of rows) {
    // Check if this is a new shipment or a continuation line
    const hasContractNo = row.contractNo.trim() !== '';
    const hasInvoiceNo = row.invoiceNo.trim() !== '';
    const hasProductType = row.productType.trim() !== '';
    
    // A new shipment starts when we have either contract number or (invoice + product)
    const isNewShipment = hasContractNo || (hasInvoiceNo && hasProductType && row.pol.trim() !== '');
    
    // Check if this is a continuation row (only has product info)
    const isContinuation = !hasContractNo && !hasInvoiceNo && hasProductType;
    
    if (isNewShipment && !isContinuation) {
      // Save previous shipment
      if (currentShipment) {
        shipments.push(currentShipment);
      }
      
      // Determine SN: BOL first, then contract number, then auto-generate
      // Option 1: BOL as primary identifier when available
      const blNo = row.blNo.trim();
      const contractNo = row.contractNo.trim();
      const invoiceNo = row.invoiceNo.trim();
      const sn = blNo || contractNo || invoiceNo || `AUTO-${Date.now()}-${shipments.length}`;
      
      // Combine notes with delay status if present
      let combinedNotes = row.notes.trim();
      if (row.delayStatus.trim()) {
        combinedNotes = combinedNotes 
          ? `${combinedNotes} | حالة التأخير: ${row.delayStatus.trim()}`
          : `حالة التأخير: ${row.delayStatus.trim()}`;
      }
      
      // Start new shipment
      currentShipment = {
        sn,
        contractNo,  // Keep original contract number for reference
        invoiceNo,
        status: mapStatus(row.status),
        subject: row.subject.trim(),
        notes: combinedNotes,
        paperworkStatus: row.documents.trim(),  // الأوراق
        delayStatus: row.delayStatus.trim(),    // حالة التأخير (also stored separately)
        // Cargo
        productLines: [],
        cargoType: 'containers', // Default
        totalContainers: 0,
        totalWeight: 0,
        // Logistics
        pol: row.pol.trim(),
        pod: row.pod.trim(),
        eta: parseDate(row.eta),
        freeTimeDays: parseInt2(row.freeTime),
        customsClearanceDate: parseDate(row.customsClearanceDate),
        blNo,
        vesselName: row.tracking.trim(),
        contractShipDate: parseDate(row.contractShipDate),
        blDate: parseDate(row.blDate),
        depositDate: parseDate(row.downPaymentDate),      // تاريخ الرعبون → deposit_date
        finalDestination: row.finalDestination.trim(),    // الوجهة النهائية
        // Parties
        shippingLine: row.shippingCompany.trim(),
        finalBeneficiaryName: row.finalBeneficiary.trim(),
        // Financials
        pricePerTon: parseCurrency(row.pricePerTon),
        totalValueUsd: parseCurrency(row.totalValue),
        paidValueUsd: parseCurrency(row.paidValue),
        balanceValueUsd: parseCurrency(row.balance),
        downPaymentDate: parseDate(row.downPaymentDate),
      };
      
      // Add first product line
      const productLine: ProductLine = {
        product_text: row.productType.trim(),
        weight_ton: parseWeight(row.weightTon),
        price_per_ton: parseCurrency(row.pricePerTon),
        container_count: parseInt2(row.containerCount),
      };
      
      if (productLine.product_text) {
        currentShipment.productLines.push(productLine);
        currentShipment.totalContainers += productLine.container_count || 0;
        currentShipment.totalWeight += productLine.weight_ton || 0;
      }
    } else if (isContinuation && currentShipment) {
      // Add product line to current shipment
      const productLine: ProductLine = {
        product_text: row.productType.trim(),
        weight_ton: parseWeight(row.weightTon),
        price_per_ton: parseCurrency(row.pricePerTon),
        container_count: parseInt2(row.containerCount),
      };
      
      if (productLine.product_text) {
        currentShipment.productLines.push(productLine);
        currentShipment.totalContainers += productLine.container_count || 0;
        currentShipment.totalWeight += productLine.weight_ton || 0;
      }
    } else if (hasProductType && currentShipment) {
      // Might be a row with just product additions
      const productLine: ProductLine = {
        product_text: row.productType.trim(),
        weight_ton: parseWeight(row.weightTon),
        price_per_ton: parseCurrency(row.pricePerTon),
        container_count: parseInt2(row.containerCount),
      };
      
      if (productLine.product_text) {
        currentShipment.productLines.push(productLine);
        currentShipment.totalContainers += productLine.container_count || 0;
        currentShipment.totalWeight += productLine.weight_ton || 0;
      }
    }
  }
  
  // Don't forget the last shipment
  if (currentShipment) {
    shipments.push(currentShipment);
  }
  
  return shipments;
}

// ============================================================
// Validation
// ============================================================

function validateShipment(shipment: ParsedShipment, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!shipment.sn) {
    errors.push('Missing shipment number (sn)');
  }
  
  if (shipment.productLines.length === 0) {
    warnings.push('No product lines found');
  }
  
  // Date validations
  if (shipment.eta && !/^\d{4}-\d{2}-\d{2}$/.test(shipment.eta)) {
    errors.push(`Invalid ETA date format: ${shipment.eta}`);
  }
  
  // Numeric validations
  if (shipment.totalValueUsd !== null && shipment.totalValueUsd < 0) {
    warnings.push(`Negative total value: ${shipment.totalValueUsd}`);
  }
  
  // Port warnings
  if (!shipment.pol) {
    warnings.push('Missing Port of Loading (POL)');
  }
  if (!shipment.pod) {
    warnings.push('Missing Port of Discharge (POD)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// Database Operations
// ============================================================

interface PortLookup {
  [key: string]: string; // port name -> port id
}

interface CompanyLookup {
  [key: string]: string; // company name -> company id
}

async function loadPortLookup(client: PoolClient): Promise<PortLookup> {
  const result = await client.query(`
    SELECT id, name, country, city 
    FROM master_data.ports
  `);
  
  const lookup: PortLookup = {};
  for (const row of result.rows) {
    // Index by name, city, and country for flexible matching
    lookup[row.name?.toLowerCase()] = row.id;
    lookup[row.city?.toLowerCase()] = row.id;
    lookup[row.country?.toLowerCase()] = row.id;
  }
  
  return lookup;
}

async function loadCompanyLookup(client: PoolClient): Promise<CompanyLookup> {
  const result = await client.query(`
    SELECT id, name 
    FROM master_data.companies 
    WHERE is_shipping_line = true OR is_forwarder = true
  `);
  
  const lookup: CompanyLookup = {};
  for (const row of result.rows) {
    lookup[row.name?.toLowerCase()] = row.id;
  }
  
  return lookup;
}

function findPortId(portName: string, lookup: PortLookup): string | null {
  if (!portName) return null;
  
  const normalized = portName.toLowerCase().trim();
  
  // Direct match
  if (lookup[normalized]) return lookup[normalized];
  
  // Try partial matches
  for (const [key, id] of Object.entries(lookup)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return id;
    }
  }
  
  return null;
}

function findCompanyId(companyName: string, lookup: CompanyLookup): string | null {
  if (!companyName) return null;
  
  const normalized = companyName.toLowerCase().trim();
  
  // Direct match
  if (lookup[normalized]) return lookup[normalized];
  
  // Try partial matches
  for (const [key, id] of Object.entries(lookup)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return id;
    }
  }
  
  return null;
}

async function insertShipment(
  client: PoolClient,
  shipment: ParsedShipment,
  portLookup: PortLookup,
  companyLookup: CompanyLookup
): Promise<string> {
  // 1. Insert into logistics.shipments (with paperwork_status)
  const shipmentResult = await client.query(`
    INSERT INTO logistics.shipments (
      sn, transaction_type, status, subject, notes, paperwork_status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [
    shipment.sn,
    'incoming', // Default transaction type
    shipment.status,
    shipment.subject || null,
    shipment.notes || null,
    shipment.paperworkStatus || null,  // الأوراق
    'csv_import'
  ]);
  
  const shipmentId = shipmentResult.rows[0].id;
  
  // 2. Insert into logistics.shipment_parties
  const shippingLineId = findCompanyId(shipment.shippingLine, companyLookup);
  
  await client.query(`
    INSERT INTO logistics.shipment_parties (
      shipment_id, shipping_line_id, final_beneficiary_name
    ) VALUES ($1, $2, $3)
  `, [
    shipmentId,
    shippingLineId,
    shipment.finalBeneficiaryName || null
  ]);
  
  // 3. Insert into logistics.shipment_cargo
  const primaryProduct = shipment.productLines[0]?.product_text || '';
  const linesJson = JSON.stringify(shipment.productLines);
  
  await client.query(`
    INSERT INTO logistics.shipment_cargo (
      shipment_id, product_text, cargo_type, container_count, 
      weight_ton, weight_unit, lines
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    shipmentId,
    primaryProduct,
    shipment.cargoType,
    shipment.totalContainers || null,
    shipment.totalWeight || null,
    'tons',
    linesJson
  ]);
  
  // 4. Insert into logistics.shipment_logistics (with deposit_date and final_destination)
  const polId = findPortId(shipment.pol, portLookup);
  const podId = findPortId(shipment.pod, portLookup);
  
  // Build final_destination JSONB if provided
  const finalDestinationJson = shipment.finalDestination 
    ? JSON.stringify({ name: shipment.finalDestination })
    : '{}';
  
  await client.query(`
    INSERT INTO logistics.shipment_logistics (
      shipment_id, pol_id, pod_id, eta, free_time_days,
      customs_clearance_date, bl_no, vessel_name,
      contract_ship_date, bl_date, deposit_date,
      has_final_destination, final_destination, incoterms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  `, [
    shipmentId,
    polId,
    podId,
    shipment.eta,
    shipment.freeTimeDays,
    shipment.customsClearanceDate,
    shipment.blNo || null,
    shipment.vesselName || null,
    shipment.contractShipDate,
    shipment.blDate,
    shipment.depositDate,                              // تاريخ الرعبون
    !!shipment.finalDestination,                       // has_final_destination
    finalDestinationJson,                              // الوجهة النهائية (as JSONB)
    'FOB' // Default incoterm
  ]);
  
  // 5. Insert into logistics.shipment_financials
  await client.query(`
    INSERT INTO logistics.shipment_financials (
      shipment_id, fixed_price_usd_per_ton, total_value_usd,
      paid_value_usd, balance_value_usd, payment_method
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    shipmentId,
    shipment.pricePerTon,
    shipment.totalValueUsd,
    shipment.paidValueUsd,
    shipment.balanceValueUsd,
    'swift' // Default payment method
  ]);
  
  // 6. Insert into logistics.shipment_documents
  await client.query(`
    INSERT INTO logistics.shipment_documents (shipment_id)
    VALUES ($1)
  `, [shipmentId]);
  
  return shipmentId;
}

async function backupExistingData(client: PoolClient): Promise<void> {
  console.log('\n📦 Backing up existing shipment data...');
  
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Backup each table
  const tables = [
    'logistics.shipments',
    'logistics.shipment_parties',
    'logistics.shipment_cargo',
    'logistics.shipment_logistics',
    'logistics.shipment_financials',
    'logistics.shipment_documents'
  ];
  
  for (const table of tables) {
    const result = await client.query(`SELECT * FROM ${table}`);
    const filename = `${table.replace('.', '_')}_${timestamp}.json`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(result.rows, null, 2));
    console.log(`  ✅ Backed up ${result.rowCount} rows from ${table}`);
  }
  
  console.log(`  📁 Backups saved to: ${backupDir}`);
}

async function clearExistingData(client: PoolClient): Promise<void> {
  console.log('\n🗑️  Clearing existing shipment data...');
  
  // Delete in reverse order of dependencies
  await client.query('DELETE FROM logistics.shipment_documents');
  await client.query('DELETE FROM logistics.shipment_financials');
  await client.query('DELETE FROM logistics.shipment_logistics');
  await client.query('DELETE FROM logistics.shipment_cargo');
  await client.query('DELETE FROM logistics.shipment_parties');
  await client.query('DELETE FROM logistics.shipments');
  
  console.log('  ✅ All existing shipment data cleared');
}

// ============================================================
// Main Import Function
// ============================================================

async function importShipments(
  filePath: string,
  options: { dryRun: boolean; backup: boolean }
): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           SHIPMENTS CSV IMPORT SCRIPT                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📄 File: ${filePath}`);
  console.log(`🔧 Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  console.log(`💾 Backup: ${options.backup ? 'Yes' : 'No'}`);
  
  // Parse CSV
  console.log('\n📊 Parsing CSV file...');
  const rows = parseCSV(filePath);
  console.log(`  Found ${rows.length} rows`);
  
  // Combine into shipments
  console.log('\n🔗 Combining rows into shipments...');
  const shipments = combineIntoShipments(rows);
  console.log(`  Created ${shipments.length} shipments`);
  
  // Validate
  console.log('\n✅ Validating shipments...');
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < shipments.length; i++) {
    const result = validateShipment(shipments[i], i);
    if (result.isValid) {
      validCount++;
      if (result.warnings.length > 0) {
        warningCount += result.warnings.length;
      }
    } else {
      errorCount++;
      console.log(`  ❌ Shipment ${i + 1} (${shipments[i].sn}):`);
      result.errors.forEach(e => console.log(`     - ${e}`));
    }
  }
  
  console.log(`  ✅ Valid: ${validCount}`);
  console.log(`  ⚠️  Warnings: ${warningCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  
  // Dry run preview
  if (options.dryRun) {
    console.log('\n' + '═'.repeat(60));
    console.log('DRY RUN PREVIEW - No changes will be made');
    console.log('═'.repeat(60));
    
    for (let i = 0; i < shipments.length; i++) {
      const s = shipments[i];
      // Show SN source (BOL or Contract#)
      const snSource = s.blNo && s.sn === s.blNo ? '(from BOL)' : s.contractNo && s.sn === s.contractNo ? '(from Contract#)' : '(auto)';
      console.log(`\n[${i + 1}/${shipments.length}] Shipment: ${s.sn} ${snSource}`);
      if (s.contractNo && s.sn !== s.contractNo) {
        console.log(`  Contract#: ${s.contractNo}`);
      }
      console.log(`  Status: ${s.status}`);
      console.log(`  Products: ${s.productLines.length} line(s)`);
      s.productLines.forEach((p, j) => {
        console.log(`    ${j + 1}. ${p.product_text} (${p.weight_ton || '?'} tons @ $${p.price_per_ton || '?'}/ton)`);
      });
      console.log(`  Route: ${s.pol || '?'} → ${s.pod || '?'}`);
      console.log(`  ETA: ${s.eta || 'N/A'}`);
      console.log(`  BL: ${s.blNo || 'N/A'}`);
      console.log(`  Shipping Line: ${s.shippingLine || 'N/A'}`);
      console.log(`  Value: $${s.totalValueUsd?.toLocaleString() || '0'} (Paid: $${s.paidValueUsd?.toLocaleString() || '0'}, Balance: $${s.balanceValueUsd?.toLocaleString() || '0'})`);
      // New fields
      if (s.paperworkStatus) {
        console.log(`  Paperwork: ${s.paperworkStatus}`);
      }
      if (s.depositDate) {
        console.log(`  Deposit Date: ${s.depositDate}`);
      }
      if (s.finalDestination) {
        console.log(`  Final Destination: ${s.finalDestination}`);
      }
      if (s.finalBeneficiaryName) {
        console.log(`  Final Beneficiary: ${s.finalBeneficiaryName}`);
      }
      if (s.notes) {
        console.log(`  Notes: ${s.notes}`);
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('DRY RUN COMPLETE - Run without --dry-run to import');
    console.log('═'.repeat(60));
    return;
  }
  
  // Live import
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  
  try {
    // Load lookups
    console.log('\n📚 Loading port and company lookups...');
    const portLookup = await loadPortLookup(client);
    const companyLookup = await loadCompanyLookup(client);
    console.log(`  Found ${Object.keys(portLookup).length} port entries`);
    console.log(`  Found ${Object.keys(companyLookup).length} shipping company entries`);
    
    // Start transaction
    await client.query('BEGIN');
    console.log('\n🔄 Starting database transaction...');
    
    // Backup if requested
    if (options.backup) {
      await backupExistingData(client);
    }
    
    // Clear existing data
    await clearExistingData(client);
    
    // Import shipments
    console.log('\n📥 Importing shipments...');
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < shipments.length; i++) {
      const shipment = shipments[i];
      try {
        const shipmentId = await insertShipment(client, shipment, portLookup, companyLookup);
        successCount++;
        console.log(`  ✅ [${i + 1}/${shipments.length}] ${shipment.sn} → ${shipmentId}`);
      } catch (error: any) {
        failCount++;
        console.log(`  ❌ [${i + 1}/${shipments.length}] ${shipment.sn} - ${error.message}`);
        throw error; // Re-throw to trigger rollback
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');
    
    console.log('\n' + '═'.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log('═'.repeat(60));
    console.log(`  ✅ Imported: ${successCount} shipments`);
    console.log(`  ❌ Failed: ${failCount} shipments`);
    
  } catch (error: any) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ Transaction rolled back due to error:');
    console.error(`   ${error.message}`);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// ============================================================
// CLI
// ============================================================

function printUsage(): void {
  console.log(`
Usage: npx ts-node tools/import-shipments-csv.ts [options]

Options:
  --file <path>    Path to the CSV file (required)
  --dry-run        Preview changes without modifying database
  --backup         Backup existing data before import

Examples:
  # Preview import (safe)
  npx ts-node tools/import-shipments-csv.ts --dry-run --file data/Untitled\\ 3.csv

  # Import with backup
  npx ts-node tools/import-shipments-csv.ts --backup --file data/Untitled\\ 3.csv
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let filePath = '';
  let dryRun = false;
  let backup = false;
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
        filePath = args[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--backup':
        backup = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }
  
  // Validate
  if (!filePath) {
    console.error('Error: --file is required');
    printUsage();
    process.exit(1);
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  // Run import
  try {
    await importShipments(filePath, { dryRun, backup });
  } catch (error: any) {
    console.error('\n💥 Import failed:', error.message);
    process.exit(1);
  }
}

main();

