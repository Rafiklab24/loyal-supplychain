#!/usr/bin/env ts-node
/**
 * Clean CSV Import Script
 * 
 * Imports data from Final.csv (extracted from البضاعة القادمة محدث.xlsx) into 
 * the Loyal Supply Chain system.
 * 
 * Features:
 * - Parses CSV organized by sections with different destinations/beneficiaries
 * - Detects PENDING contracts (no ETA AND no tracking) vs ACTIVE contracts with shipments
 * - Groups split shipments (e.g., 390-A, 390-B) under base contract 390
 * - Handles complex values: "6+4" containers, "150+100" weights
 * - Maps paper status (الآوراق) to track document location/phase
 * - Copies document folders and creates document records
 * - Clears all existing data for a fresh start
 * 
 * Usage:
 *   # Dry run - preview what will be created
 *   npx ts-node tools/import-csv-clean.ts --dry-run
 * 
 *   # Live import
 *   npx ts-node tools/import-csv-clean.ts
 */

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Configuration
// ============================================================

const DB_URL = process.env.DATABASE_URL || 'postgresql://rafik@localhost:5432/loyal_supplychain';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || path.join(PROJECT_ROOT, 'storage', 'documents');
const CSV_FILE = path.join(PROJECT_ROOT, 'data', 'Final .csv');
const DOCS_FOLDER = path.join(PROJECT_ROOT, 'data', 'شركة لويال 2');

// ============================================================
// Section Configuration (Final Destination & Beneficiary)
// ============================================================

interface SectionConfig {
  name: string;
  beneficiary: string;
  destination: string;
  startRow: number;
  endRow: number;
}

// Map section names to branches/warehouses in master_data.branches
// Type is 'branch' for warehouse destinations (not 'customer')
const SECTION_MARKERS: Record<string, { 
  beneficiary: string; 
  destination: string;
  branch_id: string;      // Parent region ID
  warehouse_id: string;   // Child warehouse ID
}> = {
  'Loyal North Mahmut, Sarmada 1': { 
    beneficiary: 'Loyal North Mahmut', 
    destination: 'Sarmada 1',
    branch_id: '5c111ac7-32d9-4177-bb34-d02a24f5aac2',    // Loyal Syria North (Mahmut)
    warehouse_id: 'e765b024-86f8-4863-bc5a-cf0af0c30ae9' // Sarmada Warehouse 1
  },
  'Loyal Turkey, Internal/Domestic Warehouse': { 
    beneficiary: 'Loyal Turkey', 
    destination: 'Internal/Domestic Warehouse',
    branch_id: '5392e93b-3ff8-4ad4-b513-ce5a2e1bf5a5',    // Loyal Turkey
    warehouse_id: '9bdc3dde-14eb-4664-b3d7-8341d0e9ab0c'  // Turkey Internal Warehouse
  },
  'Loyal Coast, Lattakia Warehouse': { 
    beneficiary: 'Loyal Coast', 
    destination: 'Lattakia Warehouse',
    branch_id: '3be9877e-0815-45e3-bca9-c10e8249173f',    // Loyal Coast (Freezone & Ports)
    warehouse_id: '56a4db61-2561-44c7-9129-34aad6c90155'  // Lattakia Warehouse
  },
};

// ============================================================
// Types
// ============================================================

interface ProductLine {
  product_text: string;
  weight_ton: number | null;
  price_per_ton: number | null;
  container_count: number | null;
  currency: string;
}

interface ParsedRecord {
  sn: string;                    // Full SN like "255-1"
  baseContractNo: string;        // Base contract number like "255"
  isShipment: boolean;           // true if has ETA AND tracking
  contractStatus: 'PENDING' | 'ACTIVE';
  productLines: ProductLine[];
  totalContainers: number;
  totalWeight: number;
  pol: string;
  pod: string;
  eta: string | null;
  status: string;
  paperworkStatus: string;
  balanceUsd: number | null;
  tracking: string;
  shippingCompany: string;
  freeTimeDays: number | null;
  documentFolder: string | null;
  // Section context
  beneficiary: string;
  destination: string;
  sectionName: string;
  branch_id: string;
  warehouse_id: string;
}

interface AggregatedContract {
  contractNo: string;
  status: 'PENDING' | 'ACTIVE';
  productLines: ProductLine[];
  totalContainers: number;
  totalWeight: number;
  pol: string;
  pod: string;
  shipmentRecords: ParsedRecord[];
  beneficiary: string;
  destination: string;
  branch_id: string;
  warehouse_id: string;
}

interface ImportStats {
  portsCreated: number;
  shippingCompaniesCreated: number;
  branchesCreated: number;
  pendingContractsCreated: number;
  activeContractsCreated: number;
  shipmentsCreated: number;
  contractLinesCreated: number;
  shipmentLinesCreated: number;
  documentsLinked: number;
  documentsCopied: number;
}

interface Lookups {
  ports: Map<string, string>;
  shippingCompanies: Map<string, string>;
  branches: Map<string, string>;
  existingContracts: Map<string, string>;
}

// ============================================================
// Status Mapping (Arabic → Database values)
// ============================================================

const STATUS_MAP: Record<string, string> = {
  'تم الوصول': 'arrived',
  'تم التخليص': 'cleared',
  'transit': 'sailed',
  'TRANSIT': 'sailed',
  'TT': 'sailed',
  'CAD': 'sailed',
  'INV': 'planning',
  'DEPO': 'gate_in',
  'depo': 'gate_in',
  'قيد الشحن': 'loading',
  'RE-EXPORT': 'planning',
  '': 'planning',
};

// ============================================================
// Data Transformation Functions
// ============================================================

/**
 * Parse date string in various formats
 */
function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  const trimmed = dateStr.trim();
  
  // ISO format: 2025-12-23
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Slash format: 2025/09/29
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const [, year, month, day] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle "شهر X" or "شحن X" (month placeholder)
  const monthPlaceholder = trimmed.match(/(?:شهر|شحن)\s*(\d{1,2})/);
  if (monthPlaceholder) {
    const month = parseInt(monthPlaceholder[1]);
    if (month >= 1 && month <= 12) {
      return `2026-${String(month).padStart(2, '0')}-15`;
    }
    return null;
  }
  
  // Handle "شحن شهر 11" style
  const shipMonthMatch = trimmed.match(/شحن\s*شهر\s*(\d{1,2})/);
  if (shipMonthMatch) {
    const month = parseInt(shipMonthMatch[1]);
    if (month >= 1 && month <= 12) {
      return `2026-${String(month).padStart(2, '0')}-15`;
    }
    return null;
  }
  
  // Handle range "شحن 10-12" or "شهر 10-11"
  const rangeMatch = trimmed.match(/(?:شحن|شهر)\s*(\d{1,2})-(\d{1,2})/);
  if (rangeMatch) {
    const startMonth = parseInt(rangeMatch[1]);
    if (startMonth >= 1 && startMonth <= 12) {
      return `2026-${String(startMonth).padStart(2, '0')}-15`;
    }
    return null;
  }
  
  return null;
}

/**
 * Parse complex value like "6+4" or "150+100" or "44-66" or "20-5"
 * Returns total sum and array of individual values
 */
function parseComplexValue(value: string): { total: number; parts: number[]; currency: string } {
  if (!value || typeof value !== 'string') {
    const numVal = parseFloat(String(value || ''));
    if (!isNaN(numVal)) {
      return { total: numVal, parts: [numVal], currency: 'USD' };
    }
    return { total: 0, parts: [], currency: 'USD' };
  }
  
  let cleaned = value.trim();
  let currency = 'USD';
  
  // Detect currency
  if (cleaned.includes('€') || cleaned.toLowerCase().includes('eur')) {
    currency = 'EUR';
    cleaned = cleaned.replace(/€/g, '').replace(/EUR/gi, '');
  }
  if (cleaned.includes('$')) {
    currency = 'USD';
    cleaned = cleaned.replace(/\$/g, '');
  }
  
  // Remove spaces and commas (except European decimal separator)
  cleaned = cleaned.replace(/\s/g, '').replace(/,(?=\d{3})/g, '');
  
  // Handle European format: 1,05 (comma as decimal)
  if (cleaned.match(/^\d+,\d{1,2}$/)) {
    cleaned = cleaned.replace(',', '.');
  }
  
  // Handle "X+Y" format
  if (cleaned.includes('+')) {
    const parts = cleaned.split('+').map(p => parseFloat(p)).filter(n => !isNaN(n));
    const total = parts.reduce((sum, n) => sum + n, 0);
    return { total, parts, currency };
  }
  
  // Handle "X-Y" format (usually two different products, take both)
  if (cleaned.includes('-') && !cleaned.startsWith('-')) {
    const parts = cleaned.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
    if (parts.length > 0) {
      const total = parts.reduce((sum, n) => sum + n, 0);
      return { total, parts, currency };
    }
  }
  
  // Simple number
  const numVal = parseFloat(cleaned);
  if (!isNaN(numVal)) {
    return { total: numVal, parts: [numVal], currency };
  }
  
  return { total: 0, parts: [], currency };
}

/**
 * Parse price which may be in format "$1,050.00" or "€ 453.00" or "1105 $ فوب"
 */
function parsePrice(value: string): { price: number | null; currency: string } {
  if (!value) return { price: null, currency: 'USD' };
  
  let cleaned = value.trim();
  let currency = 'USD';
  
  // Detect currency
  if (cleaned.includes('€')) {
    currency = 'EUR';
  }
  
  // Remove currency symbols and text
  cleaned = cleaned.replace(/[$€]/g, '')
    .replace(/فوب|FOB|CFR/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Handle comma as thousands separator: $1,050.00
  if (cleaned.match(/\d{1,3}(,\d{3})+(\.\d+)?$/)) {
    cleaned = cleaned.replace(/,/g, '');
  }
  // Handle comma as decimal: €453,00
  else if (cleaned.match(/\d+,\d{2}$/)) {
    cleaned = cleaned.replace(',', '.');
  }
  
  const numVal = parseFloat(cleaned);
  return {
    price: !isNaN(numVal) ? numVal : null,
    currency
  };
}

/**
 * Normalize Arabic text
 */
function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';
  return text.toString().trim().replace(/\s+/g, ' ');
}

/**
 * Map Arabic status to database status
 */
function mapStatus(arabicStatus: string): string {
  const normalized = normalizeArabic(arabicStatus).toLowerCase();
  
  // Check exact matches first
  for (const [arabic, english] of Object.entries(STATUS_MAP)) {
    if (normalized === arabic.toLowerCase()) {
      return english;
    }
  }
  
  // Check partial matches
  if (normalized.includes('وصول') || normalized.includes('وصل')) return 'arrived';
  if (normalized.includes('تخليص') || normalized.includes('خلص') || normalized.includes('مخلص')) return 'cleared';
  if (normalized.includes('transit') || normalized.includes('ترانزيت')) return 'sailed';
  if (normalized.includes('شحن')) return 'loading';
  
  return 'planning';
}

// ============================================================
// CSV Parsing
// ============================================================

function parseCSV(csvPath: string, docsFolder: string): ParsedRecord[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  
  console.log(`📄 Reading CSV: ${csvPath}`);
  console.log(`   Total lines: ${lines.length}`);
  
  // Get folder listing for document matching
  const folderMap = new Map<string, string>();
  if (docsFolder && fs.existsSync(docsFolder)) {
    const folders = fs.readdirSync(docsFolder);
    for (const folder of folders) {
      const numMatch = folder.match(/^(\d+)/);
      if (numMatch) {
        folderMap.set(numMatch[1], path.join(docsFolder, folder));
      }
    }
    console.log(`   Document folders found: ${folderMap.size}`);
  }
  
  const records: ParsedRecord[] = [];
  const usedSNs = new Set<string>();
  
  // Current section context - default to first section
  const defaultSection = SECTION_MARKERS['Loyal North Mahmut, Sarmada 1'];
  let currentBeneficiary = defaultSection.beneficiary;
  let currentDestination = defaultSection.destination;
  let currentBranchId = defaultSection.branch_id;
  let currentWarehouseId = defaultSection.warehouse_id;
  let currentSection = 'Loyal North Mahmut, Sarmada 1';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check for section headers
    for (const [marker, config] of Object.entries(SECTION_MARKERS)) {
      if (line.includes(marker)) {
        currentBeneficiary = config.beneficiary;
        currentDestination = config.destination;
        currentBranchId = config.branch_id;
        currentWarehouseId = config.warehouse_id;
        currentSection = marker;
        console.log(`   Section: ${marker} → ${config.beneficiary} / ${config.destination} (branch: ${config.branch_id}, warehouse: ${config.warehouse_id})`);
        break;
      }
    }
    
    // Split by semicolon
    const cols = line.split(';');
    if (cols.length < 7) continue;
    
    // Skip header rows
    const firstCol = cols[0].trim();
    if (firstCol === 'SN' || firstCol === 'تس' || firstCol === 'رقم') continue;
    if (!firstCol || /^[\s;]*$/.test(firstCol)) continue;
    
    // Skip section separator rows (empty or just column names)
    if (cols[1]?.includes('نوع البضاعة')) continue;
    
    const snRaw = firstCol;
    
    // Skip rows with obviously invalid SNs
    if (snRaw.startsWith('Column') || snRaw.startsWith('#')) continue;
    
    // Extract numeric SN for folder matching
    const snNumMatch = snRaw.match(/^(\d+)/);
    const snNum = snNumMatch ? snNumMatch[1] : null;
    
    // Generate unique SN
    let sn = snRaw;
    let counter = 1;
    while (usedSNs.has(sn)) {
      sn = `${snRaw}-dup${counter}`;
      counter++;
    }
    usedSNs.add(sn);
    
    // Parse row data
    const productType = normalizeArabic(cols[1]);
    if (!productType) continue; // Skip rows without product type
    
    const containerCount = parseComplexValue(cols[2] || '');
    const weightTon = parseComplexValue(cols[3] || '');
    const priceData = parsePrice(cols[4] || '');
    const pol = normalizeArabic(cols[5]);
    const pod = normalizeArabic(cols[6]);
    const eta = parseDate(cols[7]);
    const freeTimeStr = cols[8] || cols[9] || '';
    const freeTime = parseInt(freeTimeStr.replace(/[^\d]/g, '')) || null;
    const status = normalizeArabic(cols[10]);
    const balanceData = parsePrice(cols[11] || '');
    const paperworkStatus = normalizeArabic(cols[12]);
    
    // Shipping company and tracking - positions vary
    let shippingCompany = '';
    let tracking = '';
    
    // Try common positions
    if (cols[14]) {
      // Check if it's a shipping company name or tracking
      const val = normalizeArabic(cols[14]);
      if (val.includes('http') || val.includes('MEDU') || /^[A-Z0-9]{10,}$/.test(val)) {
        tracking = val;
        shippingCompany = normalizeArabic(cols[13] || cols[15] || '');
      } else {
        shippingCompany = val;
        tracking = normalizeArabic(cols[15] || '');
      }
    }
    
    // Fallback: try position 15
    if (!tracking && cols[15]) {
      const val = normalizeArabic(cols[15]);
      if (val.includes('http') || val.includes('MEDU') || /^[A-Z0-9]{8,}$/.test(val)) {
        tracking = val;
      }
    }
    
    // Determine if this is a shipment or pending contract
    // Rule: Has ETA OR has tracking = SHIPMENT, else PENDING
    const hasEta = eta !== null;
    const hasTracking = tracking !== '' && !tracking.startsWith('Column');
    const isShipment = hasEta || hasTracking;
    
    // Create product lines
    const productLines: ProductLine[] = [];
    const maxParts = Math.max(weightTon.parts.length, containerCount.parts.length, 1);
    
    for (let p = 0; p < maxParts; p++) {
      productLines.push({
        product_text: productType + (maxParts > 1 ? ` (Part ${p + 1})` : ''),
        weight_ton: weightTon.parts[p] || null,
        price_per_ton: priceData.price,
        container_count: containerCount.parts[p] ? Math.round(containerCount.parts[p]) : null,
        currency: priceData.currency,
      });
    }
    
    // Find matching document folder
    const documentFolder = snNum ? folderMap.get(snNum) || null : null;
    
    // Extract base contract number (e.g., "255" from "255-1", "255-A")
    const baseMatch = snRaw.match(/^(\d+)/);
    const baseContractNo = baseMatch ? baseMatch[1] : snRaw;
    
    records.push({
      sn,
      baseContractNo,
      isShipment,
      contractStatus: isShipment ? 'ACTIVE' : 'PENDING',
      productLines,
      totalContainers: containerCount.total,
      totalWeight: weightTon.total,
      pol,
      pod,
      eta,
      status: mapStatus(status),
      paperworkStatus,
      balanceUsd: balanceData.price,
      tracking,
      shippingCompany,
      freeTimeDays: freeTime,
      documentFolder,
      beneficiary: currentBeneficiary,
      destination: currentDestination,
      sectionName: currentSection,
      branch_id: currentBranchId,
      warehouse_id: currentWarehouseId,
    });
  }
  
  console.log(`   Parsed ${records.length} valid records`);
  return records;
}

/**
 * Aggregate records into contracts (one contract per base number)
 */
function aggregateIntoContracts(records: ParsedRecord[]): AggregatedContract[] {
  const contractMap = new Map<string, AggregatedContract>();
  
  for (const record of records) {
    const existing = contractMap.get(record.baseContractNo);
    
    if (existing) {
      // Add product lines (avoid duplicates by name)
      for (const line of record.productLines) {
        const exists = existing.productLines.some(l => l.product_text === line.product_text);
        if (!exists) {
          existing.productLines.push(line);
        } else {
          // Aggregate quantities
          const existingLine = existing.productLines.find(l => l.product_text === line.product_text);
          if (existingLine) {
            existingLine.weight_ton = (existingLine.weight_ton || 0) + (line.weight_ton || 0);
            existingLine.container_count = (existingLine.container_count || 0) + (line.container_count || 0);
          }
        }
      }
      existing.totalContainers += record.totalContainers;
      existing.totalWeight += record.totalWeight;
      existing.shipmentRecords.push(record);
      
      // Contract is ACTIVE if ANY shipment exists
      if (record.isShipment) {
        existing.status = 'ACTIVE';
      }
      
      // Use first POL/POD if not set
      if (!existing.pol && record.pol) existing.pol = record.pol;
      if (!existing.pod && record.pod) existing.pod = record.pod;
    } else {
      // Create new contract entry
      contractMap.set(record.baseContractNo, {
        contractNo: record.baseContractNo,
        status: record.isShipment ? 'ACTIVE' : 'PENDING',
        productLines: [...record.productLines],
        totalContainers: record.totalContainers,
        totalWeight: record.totalWeight,
        pol: record.pol,
        pod: record.pod,
        shipmentRecords: [record],
        beneficiary: record.beneficiary,
        destination: record.destination,
        branch_id: record.branch_id,
        warehouse_id: record.warehouse_id,
      });
    }
  }
  
  return Array.from(contractMap.values());
}

// ============================================================
// Database Operations - Master Data
// ============================================================

async function loadLookups(client: PoolClient): Promise<Lookups> {
  // Load ports
  const portsResult = await client.query(`
    SELECT id, name, country FROM master_data.ports
  `);
  const ports = new Map<string, string>();
  for (const row of portsResult.rows) {
    if (row.name) ports.set(row.name.toLowerCase(), row.id);
    if (row.country) ports.set(row.country.toLowerCase(), row.id);
  }
  
  // Load shipping companies
  const shippingResult = await client.query(`
    SELECT id, name FROM master_data.companies 
    WHERE is_shipping_line = true AND is_deleted = false
  `);
  const shippingCompanies = new Map<string, string>();
  for (const row of shippingResult.rows) {
    if (row.name) shippingCompanies.set(row.name.toLowerCase(), row.id);
  }
  
  // Load branches (for final destination)
  const branchesResult = await client.query(`
    SELECT id, name FROM master_data.branches WHERE is_active = true
  `);
  const branches = new Map<string, string>();
  for (const row of branchesResult.rows) {
    if (row.name) branches.set(row.name.toLowerCase(), row.id);
  }
  
  // Load existing contracts
  const contractsResult = await client.query(`
    SELECT id, contract_no FROM logistics.contracts WHERE is_deleted = false
  `);
  const existingContracts = new Map<string, string>();
  for (const row of contractsResult.rows) {
    if (row.contract_no) existingContracts.set(row.contract_no.toLowerCase(), row.id);
  }
  
  return { ports, shippingCompanies, branches, existingContracts };
}

async function findOrCreatePort(
  client: PoolClient,
  portName: string,
  lookups: Lookups,
  stats: ImportStats
): Promise<string | null> {
  if (!portName) return null;
  
  const normalized = portName.toLowerCase().trim();
  
  // Try direct match
  if (lookups.ports.has(normalized)) {
    return lookups.ports.get(normalized)!;
  }
  
  // Try partial matches
  for (const [key, id] of lookups.ports.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return id;
    }
  }
  
  // Create new port
  const result = await client.query(`
    INSERT INTO master_data.ports (name, country)
    VALUES ($1, $2)
    RETURNING id
  `, [portName, portName]);
  
  const newId = result.rows[0].id;
  lookups.ports.set(normalized, newId);
  stats.portsCreated++;
  
  return newId;
}

async function findOrCreateShippingCompany(
  client: PoolClient,
  companyName: string,
  lookups: Lookups,
  stats: ImportStats
): Promise<string | null> {
  if (!companyName) return null;
  
  const normalized = companyName.toLowerCase().trim();
  
  // Try direct match
  if (lookups.shippingCompanies.has(normalized)) {
    return lookups.shippingCompanies.get(normalized)!;
  }
  
  // Try partial matches
  for (const [key, id] of lookups.shippingCompanies.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return id;
    }
  }
  
  // Create new shipping company
  const result = await client.query(`
    INSERT INTO master_data.companies (name, is_shipping_line)
    VALUES ($1, true)
    RETURNING id
  `, [companyName]);
  
  const newId = result.rows[0].id;
  lookups.shippingCompanies.set(normalized, newId);
  stats.shippingCompaniesCreated++;
  
  return newId;
}

/**
 * Find branch by name (for final destination linking)
 * Maps CSV section names to existing branches
 */
function findBranch(
  branchName: string,
  lookups: Lookups
): string | null {
  if (!branchName) return null;
  
  const normalized = branchName.toLowerCase().trim();
  
  // Try direct match
  if (lookups.branches.has(normalized)) {
    return lookups.branches.get(normalized)!;
  }
  
  // Try partial matches - map CSV names to DB branches
  const mappings: Record<string, string[]> = {
    'sarmada 1': ['sarmada warehouse 1', 'sarmada'],
    'sarmada': ['sarmada warehouse 1'],
    'internal/domestic warehouse': ['turkey internal warehouse', 'antrepo'],
    'lattakia warehouse': ['lattakia warehouse', 'lattakia'],
  };
  
  const candidates = mappings[normalized] || [];
  for (const candidate of candidates) {
    if (lookups.branches.has(candidate)) {
      return lookups.branches.get(candidate)!;
    }
  }
  
  // Try partial match on any branch
  for (const [key, id] of lookups.branches.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return id;
    }
  }
  
  return null;
}

// ============================================================
// Database Operations - Contract Import
// ============================================================

async function insertContract(
  client: PoolClient,
  contract: AggregatedContract,
  lookups: Lookups,
  stats: ImportStats
): Promise<string> {
  // 1. Insert into logistics.contracts
  const contractResult = await client.query(`
    INSERT INTO logistics.contracts (
      contract_no, status, direction, created_by
    ) VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [
    contract.contractNo,
    contract.status,
    'incoming',
    'csv_import'
  ]);
  
  const contractId = contractResult.rows[0].id;
  
  // 2. Insert into logistics.contract_parties
  await client.query(`
    INSERT INTO logistics.contract_parties (contract_id)
    VALUES ($1)
  `, [contractId]);
  
  // 3. Insert into logistics.contract_shipping
  const polId = await findOrCreatePort(client, contract.pol, lookups, stats);
  const podId = await findOrCreatePort(client, contract.pod, lookups, stats);
  
  await client.query(`
    INSERT INTO logistics.contract_shipping (
      contract_id, port_of_loading_id, country_of_final_destination
    ) VALUES ($1, $2, $3)
  `, [contractId, polId, contract.destination]);
  
  // 4. Insert into logistics.contract_terms
  const primaryCurrency = contract.productLines[0]?.currency || 'USD';
  
  await client.query(`
    INSERT INTO logistics.contract_terms (
      contract_id, cargo_type, container_count, weight_ton, currency_code
    ) VALUES ($1, $2, $3, $4, $5)
  `, [
    contractId,
    'containers',
    contract.totalContainers ? Math.round(contract.totalContainers) : null,
    contract.totalWeight || null,
    primaryCurrency
  ]);
  
  // 5. Insert into logistics.contract_products with beneficiary and final destination (warehouse)
  // Use the warehouse_id directly since we have it from the section mapping
  await client.query(`
    INSERT INTO logistics.contract_products (
      contract_id, beneficiary_name, has_final_destination,
      final_destination_company_id, final_destination_name
    ) VALUES ($1, $2, $3, $4, $5)
  `, [
    contractId,
    contract.beneficiary,
    true,
    contract.warehouse_id,  // Use warehouse_id directly from section mapping
    contract.destination
  ]);
  
  // 6. Insert into logistics.contract_lines
  for (const line of contract.productLines) {
    await client.query(`
      INSERT INTO logistics.contract_lines (
        contract_id, product_name, type_of_goods, quantity_mt, 
        rate_usd_per_mt, unit_price
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      contractId,
      line.product_text,
      line.product_text,
      line.weight_ton,
      line.price_per_ton,
      line.price_per_ton
    ]);
    stats.contractLinesCreated++;
  }
  
  // Update lookups
  lookups.existingContracts.set(contract.contractNo.toLowerCase(), contractId);
  
  if (contract.status === 'PENDING') {
    stats.pendingContractsCreated++;
  } else {
    stats.activeContractsCreated++;
  }
  
  return contractId;
}

// ============================================================
// Database Operations - Shipment Import
// ============================================================

async function insertShipment(
  client: PoolClient,
  record: ParsedRecord,
  contractId: string,
  lookups: Lookups,
  stats: ImportStats
): Promise<string> {
  // 1. Insert into logistics.shipments
  const shipmentResult = await client.query(`
    INSERT INTO logistics.shipments (
      sn, transaction_type, status, paperwork_status, 
      contract_id, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [
    record.sn,
    'incoming',
    record.status,
    record.paperworkStatus || null,
    contractId,
    'csv_import'
  ]);
  
  const shipmentId = shipmentResult.rows[0].id;
  
  // 2. Insert into logistics.shipment_parties
  const shippingLineId = await findOrCreateShippingCompany(
    client, record.shippingCompany, lookups, stats
  );
  
  await client.query(`
    INSERT INTO logistics.shipment_parties (
      shipment_id, shipping_line_id
    ) VALUES ($1, $2)
  `, [shipmentId, shippingLineId]);
  
  // 3. Insert into logistics.shipment_cargo
  const primaryProduct = record.productLines[0]?.product_text || '';
  
  await client.query(`
    INSERT INTO logistics.shipment_cargo (
      shipment_id, product_text, cargo_type, container_count, 
      weight_ton, weight_unit
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    shipmentId,
    primaryProduct,
    'containers',
    record.totalContainers ? Math.round(record.totalContainers) : null,
    record.totalWeight || null,
    'tons'
  ]);
  
  // 4. Insert into logistics.shipment_lines
  for (const line of record.productLines) {
    await client.query(`
      INSERT INTO logistics.shipment_lines (
        shipment_id, product_name, type_of_goods, quantity_mt,
        rate_usd_per_mt, unit_price, uom
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      shipmentId,
      line.product_text,
      line.product_text,
      line.weight_ton,
      line.price_per_ton,
      line.price_per_ton,
      'MT'
    ]);
    stats.shipmentLinesCreated++;
  }
  
  // 5. Insert into logistics.shipment_logistics with final_destination
  const polId = await findOrCreatePort(client, record.pol, lookups, stats);
  const podId = await findOrCreatePort(client, record.pod, lookups, stats);
  
  // Build final_destination JSON for branch/warehouse destinations
  // All imported shipments go to warehouses, not external customers
  const hasFinalDestination = !!(record.branch_id && record.warehouse_id);
  const finalDestination = hasFinalDestination ? {
    type: 'branch',
    branch_id: record.branch_id,
    warehouse_id: record.warehouse_id,
    name: record.beneficiary || '',
    delivery_place: record.destination || ''
  } : {};
  
  await client.query(`
    INSERT INTO logistics.shipment_logistics (
      shipment_id, pol_id, pod_id, eta, free_time_days, booking_no, incoterms,
      has_final_destination, final_destination
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    shipmentId,
    polId,
    podId,
    record.eta,
    record.freeTimeDays,
    record.tracking || null,
    'FOB',
    hasFinalDestination,
    JSON.stringify(finalDestination)
  ]);
  
  // 6. Insert into logistics.shipment_financials with price per ton
  const pricePerTon = record.productLines[0]?.price_per_ton || null;
  
  await client.query(`
    INSERT INTO logistics.shipment_financials (
      shipment_id, fixed_price_usd_per_ton, balance_value_usd, payment_method
    ) VALUES ($1, $2, $3, $4)
  `, [
    shipmentId,
    pricePerTon,
    record.balanceUsd,
    'swift'
  ]);
  
  // 7. Insert into logistics.shipment_documents
  await client.query(`
    INSERT INTO logistics.shipment_documents (shipment_id)
    VALUES ($1)
  `, [shipmentId]);
  
  stats.shipmentsCreated++;
  return shipmentId;
}

// ============================================================
// Document Linking
// ============================================================

function detectDocType(filename: string): string {
  const upper = filename.toUpperCase();
  
  if (upper.includes('CONTRACT') || upper.includes('PI') || upper.includes('PROFORMA')) return 'proforma_invoice';
  if (upper.includes('BL') || upper.includes('PRESTATMENT') || upper.includes('LADING')) return 'bill_of_lading';
  if (upper.includes('PHYTO')) return 'phytosanitary_certificate';
  if (upper.includes('INVOICE') || upper.includes('CI')) return 'commercial_invoice';
  if (upper.includes('PACKING') || upper.includes('PL')) return 'packing_list';
  if (upper.includes('COO') || upper.includes('ORIGIN')) return 'certificate_of_origin';
  if (upper.includes('COA') || upper.includes('ANALYSIS')) return 'certificate_of_analysis';
  if (upper.includes('FUMIG')) return 'fumigation_certificate';
  if (upper.includes('HEALTH')) return 'health_certificate';
  if (upper.includes('HALAL')) return 'halal_certificate';
  if (upper.includes('BOOKING') || upper.includes('EBKG')) return 'shipping_instructions';
  
  return 'other';
}

async function linkDocumentFolder(
  client: PoolClient,
  record: ParsedRecord,
  contractId: string,
  shipmentId: string | null,
  stats: ImportStats,
  dryRun: boolean
): Promise<void> {
  if (!record.documentFolder || !fs.existsSync(record.documentFolder)) {
    return;
  }
  
  const files = fs.readdirSync(record.documentFolder);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  if (pdfFiles.length === 0) return;
  
  const year = new Date().getFullYear();
  const targetFolder = path.join(
    DOCUMENTS_PATH,
    'contracts',
    String(year),
    record.baseContractNo.replace(/[^\w\-]/g, '_'),
    'docs'
  );
  
  for (const pdfFile of pdfFiles) {
    const sourcePath = path.join(record.documentFolder, pdfFile);
    const docType = detectDocType(pdfFile);
    
    if (dryRun) {
      console.log(`      📄 Would link: ${pdfFile} (${docType})`);
      stats.documentsLinked++;
      continue;
    }
    
    // Create target folder
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    
    // Copy file
    const targetPath = path.join(targetFolder, pdfFile);
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
      stats.documentsCopied++;
    }
    
    // Get file size
    const fileStats = fs.statSync(sourcePath);
    
    // Create document record
    await client.query(`
      INSERT INTO archive.documents (
        shipment_id, contract_id, doc_type, filename, 
        file_path, file_size, mime_type, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      shipmentId,
      contractId,
      docType,
      pdfFile,
      targetPath,
      fileStats.size,
      'application/pdf',
      'csv_import'
    ]);
    
    stats.documentsLinked++;
  }
}

// ============================================================
// Clear All Transactional Data
// ============================================================

async function clearAllData(client: PoolClient): Promise<void> {
  console.log('\n🗑️  Clearing ALL existing transactional data (fresh start)...');
  
  const deleteQueries = [
    'DELETE FROM archive.documents',
    'DELETE FROM finance.customs_clearing_costs',
    'DELETE FROM finance.transactions',
    'DELETE FROM logistics.shipment_documents',
    'DELETE FROM logistics.shipment_financials',
    'DELETE FROM logistics.shipment_logistics',
    'DELETE FROM logistics.shipment_lines',
    'DELETE FROM logistics.shipment_containers',
    'DELETE FROM logistics.shipment_batches',
    'DELETE FROM logistics.shipment_cargo',
    'DELETE FROM logistics.shipment_parties',
    'DELETE FROM logistics.shipments',
    'DELETE FROM logistics.contract_lines',
    'DELETE FROM logistics.contract_products',
    'DELETE FROM logistics.contract_terms',
    'DELETE FROM logistics.contract_shipping',
    'DELETE FROM logistics.contract_parties',
    'DELETE FROM logistics.contracts',
  ];
  
  for (const query of deleteQueries) {
    try {
      const result = await client.query(query);
      const tableName = query.match(/FROM\s+(\S+)/)?.[1] || 'unknown';
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  ✅ Cleared ${tableName} (${result.rowCount} rows)`);
      }
    } catch (error: any) {
      if (!error.message.includes('does not exist')) {
        console.log(`  ⚠️  ${query}: ${error.message}`);
      }
    }
  }
  
  console.log('  ✅ All transactional data cleared');
}

// ============================================================
// Dry Run Preview
// ============================================================

function printDryRunPreview(records: ParsedRecord[], contracts: AggregatedContract[]): void {
  const pendingContracts = contracts.filter(c => c.status === 'PENDING');
  const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
  const shipments = records.filter(r => r.isShipment);
  const withDocs = records.filter(r => r.documentFolder);
  
  console.log('\n' + '═'.repeat(70));
  console.log('DRY RUN PREVIEW - No changes will be made');
  console.log('═'.repeat(70));
  
  // Group by section/beneficiary
  const bySection = new Map<string, ParsedRecord[]>();
  for (const r of records) {
    const key = `${r.beneficiary} → ${r.destination}`;
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(r);
  }
  
  console.log(`\n📍 SECTIONS (Final Destination & Beneficiary):`);
  console.log('─'.repeat(50));
  for (const [section, recs] of bySection) {
    console.log(`  ${section}: ${recs.length} records`);
  }
  
  console.log(`\n📜 PENDING CONTRACTS (no shipments yet): ${pendingContracts.length}`);
  console.log('─'.repeat(50));
  for (let i = 0; i < Math.min(pendingContracts.length, 8); i++) {
    const c = pendingContracts[i];
    console.log(`  Contract ${c.contractNo} | ${c.productLines[0]?.product_text || 'N/A'}`);
    console.log(`    ${c.pol || '?'} → ${c.pod || '?'} | ${c.beneficiary}`);
  }
  if (pendingContracts.length > 8) {
    console.log(`  ... and ${pendingContracts.length - 8} more`);
  }
  
  console.log(`\n📦 ACTIVE CONTRACTS (with shipments): ${activeContracts.length}`);
  console.log('─'.repeat(50));
  for (let i = 0; i < Math.min(activeContracts.length, 8); i++) {
    const c = activeContracts[i];
    const shipmentCount = c.shipmentRecords.filter(r => r.isShipment).length;
    console.log(`  Contract ${c.contractNo} → ${shipmentCount} shipment(s)`);
    console.log(`    ${c.productLines[0]?.product_text || 'N/A'} | ${c.beneficiary}`);
  }
  if (activeContracts.length > 8) {
    console.log(`  ... and ${activeContracts.length - 8} more`);
  }
  
  console.log(`\n🚢 SHIPMENTS TOTAL: ${shipments.length}`);
  console.log('─'.repeat(50));
  for (let i = 0; i < Math.min(shipments.length, 8); i++) {
    const r = shipments[i];
    console.log(`  ${r.sn} | ${r.productLines[0]?.product_text || 'N/A'}`);
    console.log(`    ETA: ${r.eta || 'N/A'} | Status: ${r.status} | Papers: ${r.paperworkStatus || 'N/A'}`);
  }
  if (shipments.length > 8) {
    console.log(`  ... and ${shipments.length - 8} more`);
  }
  
  console.log(`\n📁 RECORDS WITH DOCUMENT FOLDERS: ${withDocs.length}`);
  
  // Unique values
  const uniquePorts = new Set<string>();
  const uniqueShipping = new Set<string>();
  const paperStatuses = new Map<string, number>();
  
  for (const r of records) {
    if (r.pol) uniquePorts.add(r.pol);
    if (r.pod) uniquePorts.add(r.pod);
    if (r.shippingCompany) uniqueShipping.add(r.shippingCompany);
    if (r.paperworkStatus) {
      paperStatuses.set(r.paperworkStatus, (paperStatuses.get(r.paperworkStatus) || 0) + 1);
    }
  }
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`  Total Records: ${records.length}`);
  console.log(`  Unique Contracts: ${contracts.length}`);
  console.log(`  PENDING Contracts: ${pendingContracts.length}`);
  console.log(`  ACTIVE Contracts: ${activeContracts.length}`);
  console.log(`  Total Shipments: ${shipments.length}`);
  console.log(`  With Document Folders: ${withDocs.length}`);
  console.log(`  Unique Ports: ${uniquePorts.size}`);
  console.log(`  Unique Shipping Companies: ${uniqueShipping.size}`);
  
  console.log(`\n📄 PAPER STATUS DISTRIBUTION:`);
  const sortedStatuses = [...paperStatuses.entries()].sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sortedStatuses.slice(0, 10)) {
    console.log(`  ${count.toString().padStart(5)} : ${status}`);
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('DRY RUN COMPLETE - Run without --dry-run to import');
  console.log('═'.repeat(70));
}

// ============================================================
// Main Import Function
// ============================================================

async function importCSV(dryRun: boolean): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║           CLEAN CSV IMPORT SCRIPT                                  ║');
  console.log('║  Fresh Start with Section-Based Destinations                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📄 CSV File: ${CSV_FILE}`);
  console.log(`📁 Docs Folder: ${DOCS_FOLDER}`);
  console.log(`🔧 Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE IMPORT (will delete existing data!)'}`);
  
  // Validate file exists
  if (!fs.existsSync(CSV_FILE)) {
    throw new Error(`CSV file not found: ${CSV_FILE}`);
  }
  
  // Parse CSV
  const records = parseCSV(CSV_FILE, DOCS_FOLDER);
  
  // Aggregate into contracts
  console.log(`\n📦 Aggregating into contracts...`);
  const contracts = aggregateIntoContracts(records);
  const pendingContracts = contracts.filter(c => c.status === 'PENDING');
  const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
  const totalShipments = records.filter(r => r.isShipment).length;
  
  console.log(`   Unique Contracts: ${contracts.length}`);
  console.log(`   PENDING Contracts: ${pendingContracts.length}`);
  console.log(`   ACTIVE Contracts: ${activeContracts.length}`);
  console.log(`   Total Shipments: ${totalShipments}`);
  
  // Dry run preview
  if (dryRun) {
    printDryRunPreview(records, contracts);
    return;
  }
  
  // Live import
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  
  const stats: ImportStats = {
    portsCreated: 0,
    shippingCompaniesCreated: 0,
    branchesCreated: 0,
    pendingContractsCreated: 0,
    activeContractsCreated: 0,
    shipmentsCreated: 0,
    contractLinesCreated: 0,
    shipmentLinesCreated: 0,
    documentsLinked: 0,
    documentsCopied: 0,
  };
  
  try {
    // Start transaction
    await client.query('BEGIN');
    console.log('\n🔄 Starting database transaction...');
    
    // Clear ALL existing data
    await clearAllData(client);
    
    // Load lookups (after clearing)
    console.log('\n📚 Loading master data lookups...');
    const lookups = await loadLookups(client);
    console.log(`   Ports: ${lookups.ports.size}`);
    console.log(`   Shipping Companies: ${lookups.shippingCompanies.size}`);
    console.log(`   Branches: ${lookups.branches.size}`);
    
    // Process contracts and their shipments
    console.log('\n📥 Importing contracts and shipments...');
    let processedContracts = 0;
    let processedShipments = 0;
    
    for (const contract of contracts) {
      processedContracts++;
      
      try {
        // Create contract
        const contractId = await insertContract(client, contract, lookups, stats);
        
        // Create shipments for this contract
        for (const record of contract.shipmentRecords) {
          let shipmentId: string | null = null;
          
          if (record.isShipment) {
            shipmentId = await insertShipment(client, record, contractId, lookups, stats);
            processedShipments++;
          }
          
          // Link documents (to contract, and shipment if exists)
          await linkDocumentFolder(client, record, contractId, shipmentId, stats, false);
        }
        
        // Progress indicator
        if (processedContracts % 25 === 0 || processedContracts === contracts.length) {
          const pct = ((processedContracts / contracts.length) * 100).toFixed(1);
          console.log(`   [${processedContracts}/${contracts.length}] ${pct}%`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing contract ${contract.contractNo}: ${error.message}`);
        throw error;
      }
    }
    
    console.log(`\n   ✅ Created ${processedContracts} contracts with ${processedShipments} shipments`);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');
    
    // Print summary
    console.log('\n' + '═'.repeat(70));
    console.log('IMPORT COMPLETE');
    console.log('═'.repeat(70));
    console.log('\n📊 STATISTICS:');
    console.log('  Master Data:');
    console.log(`    Ports created: ${stats.portsCreated}`);
    console.log(`    Shipping companies created: ${stats.shippingCompaniesCreated}`);
    console.log('  Contracts:');
    console.log(`    PENDING contracts: ${stats.pendingContractsCreated}`);
    console.log(`    ACTIVE contracts: ${stats.activeContractsCreated}`);
    console.log(`    Contract lines: ${stats.contractLinesCreated}`);
    console.log('  Shipments:');
    console.log(`    Shipments created: ${stats.shipmentsCreated}`);
    console.log(`    Shipment lines: ${stats.shipmentLinesCreated}`);
    console.log('  Documents:');
    console.log(`    Documents linked: ${stats.documentsLinked}`);
    console.log(`    Documents copied: ${stats.documentsCopied}`);
    
  } catch (error: any) {
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Clean CSV Import Script

Usage:
  npx ts-node tools/import-csv-clean.ts [options]

Options:
  --dry-run   Preview changes without modifying database
  --help      Show this help

Examples:
  # Dry run - preview what will be created
  npx ts-node tools/import-csv-clean.ts --dry-run

  # Live import (will DELETE all existing data first!)
  npx ts-node tools/import-csv-clean.ts
`);
    process.exit(0);
  }
  
  try {
    await importCSV(dryRun);
  } catch (error: any) {
    console.error('\n💥 Import failed:', error.message);
    process.exit(1);
  }
}

main();

