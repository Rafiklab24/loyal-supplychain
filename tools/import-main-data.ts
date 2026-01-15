/**
 * Main Data CSV Import Script v2.0
 * 
 * Comprehensive import of Arabic CSV data into the normalized database structure.
 * 
 * NEW in v2.0:
 * - Two-file import mode (contracts first, then shipments)
 * - Supplier column support (المورد)
 * - Auto-create contracts for shipped shipments without existing contract
 * - Contract status: PENDING for contracts file, ACTIVE for auto-created
 * 
 * Creates: Contracts, Shipments, Finance Transactions, Customs Clearing Costs
 * 
 * Features:
 * - Dry-run mode: Preview all changes without database modification
 * - Transaction safety: All-or-nothing import (rollback on any error)
 * - Master data upsert: Creates ports, shipping companies, suppliers, and beneficiaries
 * - Contract creation: Full normalized contract structure
 * - Multi-line handling: Combine product continuation rows
 * - Finance transactions: Creates payment records for paid amounts
 * - Customs clearing: Creates cost records for shipments with clearance dates
 * 
 * Usage:
 *   # Two-file import (recommended)
 *   npx ts-node tools/import-main-data.ts --dry-run \
 *     --contracts-file "data/Main Import (1.0)/Contracts (to be shipped).csv" \
 *     --shipments-file "data/Main Import (1.0)/Shipments.csv"
 *
 *   # Single file import (legacy)
 *   npx ts-node tools/import-main-data.ts --dry-run --file "data/Main import data .csv"
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
  supplierName: string;     // المورد (NEW in v2.0)
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
  contractNo: string;
  invoiceNo: string;
  status: string;
  subject: string;
  notes: string;
  paperworkStatus: string;
  delayStatus: string;
  // Parties
  supplierName: string;  // NEW
  shippingLine: string;
  finalBeneficiaryName: string;
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
  depositDate: string | null;
  finalDestination: string;
  // Financials
  pricePerTon: number | null;
  totalValueUsd: number | null;
  paidValueUsd: number | null;
  balanceValueUsd: number | null;
  downPaymentDate: string | null;
}

interface ParsedContract {
  contractNo: string;
  invoiceNo: string;
  status: string;  // 'PENDING' or 'ACTIVE'
  supplierName: string;  // NEW
  productLines: ProductLine[];
  totalContainers: number;
  totalWeight: number;
  totalValue: number | null;
  paidValue: number | null;  // NEW
  pol: string;
  pod: string;
  finalBeneficiaryName: string;  // NEW
  finalDestination: string;      // NEW
  shipmentIds: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ImportStats {
  portsCreated: number;
  shippingCompaniesCreated: number;
  supplierCompaniesCreated: number;  // NEW
  beneficiaryCompaniesCreated: number;
  contractsCreated: number;
  contractsFromShipments: number;  // NEW - auto-created from shipments
  shipmentsCreated: number;
  transactionsCreated: number;
  customsCostsCreated: number;
  shipmentLinesCreated: number;
  contractLinesCreated: number;
}

// ============================================================
// Status Mapping (Arabic → Database values)
// ============================================================

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

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
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
  
  // Format: Arabic month references like "شهر 10" or "شهر 11"
  const arabicMonthMatch = cleaned.match(/^شهر\s*(\d{1,2})$/);
  if (arabicMonthMatch) {
    const month = arabicMonthMatch[1].padStart(2, '0');
    const year = new Date().getFullYear();
    return `${year}-${month}-01`;
  }
  
  // Format: "شحن 10-12" or "شحن 20-12" (shipping date range)
  const arabicShipMatch = cleaned.match(/^شحن\s*(\d{1,2})-(\d{1,2})$/);
  if (arabicShipMatch) {
    const day = arabicShipMatch[1].padStart(2, '0');
    const month = arabicShipMatch[2].padStart(2, '0');
    const year = new Date().getFullYear();
    return `${year}-${month}-${day}`;
  }
  
  // Format: date like "9-11-2025" or "13-12-2025"
  const dmyMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

function parseCurrency(currencyStr: string): number | null {
  if (!currencyStr || currencyStr.trim() === '') return null;
  
  let cleaned = currencyStr.trim();
  
  // Handle special cases like "1250 + - التكلفة" or "678 FOB"
  if (cleaned.includes('التكلفة') || cleaned.includes('FOB')) {
    const numMatch = cleaned.match(/[\d,\.]+/);
    if (numMatch) {
      cleaned = numMatch[0];
    } else {
      return null;
    }
  }
  
  // Handle "-" or "$	-" values
  if (cleaned === '-' || cleaned === '$ -' || cleaned.match(/^\$\s*-\s*$/)) {
    return 0;
  }
  
  // Remove currency symbols and whitespace
  cleaned = cleaned.replace(/[$\s\t]/g, '');
  
  // Handle European format (comma as decimal, dot as thousands)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      cleaned = cleaned.replace(',', '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  }
  
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function parseWeight(weightStr: string): number | null {
  if (!weightStr || weightStr.trim() === '') return null;
  
  let cleaned = weightStr.trim().replace(/\s/g, '');
  cleaned = cleaned.replace(',', '.');
  
  // Handle range like "1800-1200"
  if (cleaned.includes('-') && !cleaned.startsWith('-')) {
    const parts = cleaned.split('-');
    if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
      // Take the first number
      cleaned = parts[0];
    }
  }
  
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function parseInt2(intStr: string): number | null {
  if (!intStr || intStr.trim() === '') return null;
  
  const value = parseInt(intStr.trim(), 10);
  return isNaN(value) ? null : value;
}

function mapStatus(arabicStatus: string): string {
  const status = arabicStatus.trim();
  return STATUS_MAP[status] || 'planning';
}

// ============================================================
// CSV Parsing
// ============================================================

function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Skip initial headers like "Shipments" or "Table 1"
  let startLine = 0;
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    if (line === 'Shipments' || line === 'Table 1' || line.match(/^Table\s+\d/)) {
      startLine = i + 1;
    }
  }
  
  // Find the actual header row (contains رقم and المورد)
  let headerStartLine = startLine;
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes('رقم') || lines[i].includes('المورد')) {
      headerStartLine = i;
      break;
    }
  }
  
  // Parse header row (may span multiple lines due to line breaks in cells)
  let headerLine = '';
  let headerEndLine = headerStartLine;
  
  for (let i = headerStartLine; i < lines.length; i++) {
    headerLine += lines[i];
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    if (semicolonCount >= 27) {
      headerEndLine = i;
      break;
    }
    headerLine += '\n';
  }
  
  const headers = parseCSVLine(headerLine);
  console.log(`📋 Found ${headers.length} columns in header`);
  
  // NEW field order with supplierName at position 2
  const fieldOrder: (keyof CSVRow)[] = [
    'rowNum', 'supplierName', 'contractNo', 'invoiceNo', 'status', 'productType', 'subject',
    'containerCount', 'weightTon', 'pricePerTon', 'totalValue', 'paidValue',
    'balance', 'pol', 'pod', 'eta', 'freeTime', 'customsClearanceDate',
    'delayStatus', 'documents', 'shippingCompany', 'tracking', 'blNo',
    'downPaymentDate', 'contractShipDate', 'blDate', 'finalBeneficiary',
    'finalDestination', 'notes'
  ];
  
  const rows: CSVRow[] = [];
  for (let i = headerEndLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Skip empty rows or rows that are just separators
    if (line.match(/^;+$/)) continue;
    
    const values = parseCSVLine(line);
    
    // Skip if all values are empty
    if (values.every(v => !v || v.trim() === '' || v.trim() === '-' || v.match(/^\$\s*-?\s*$/))) continue;
    
    const row: CSVRow = {
      rowNum: '', supplierName: '', contractNo: '', invoiceNo: '', status: '', 
      productType: '', subject: '', containerCount: '', weightTon: '', pricePerTon: '', 
      totalValue: '', paidValue: '', balance: '', pol: '', pod: '', eta: '', 
      freeTime: '', customsClearanceDate: '', delayStatus: '', documents: '', 
      shippingCompany: '', tracking: '', blNo: '', downPaymentDate: '', 
      contractShipDate: '', blDate: '', finalBeneficiary: '', finalDestination: '', notes: '',
    };
    
    for (let j = 0; j < Math.min(values.length, fieldOrder.length); j++) {
      row[fieldOrder[j]] = values[j] || '';
    }
    
    rows.push(row);
  }
  
  return rows;
}

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
  
  values.push(current.trim());
  return values;
}

// ============================================================
// Multi-line Product Handling - For Shipments
// ============================================================

function combineIntoShipments(rows: CSVRow[]): ParsedShipment[] {
  const shipments: ParsedShipment[] = [];
  let currentShipment: ParsedShipment | null = null;
  const usedSNs = new Set<string>();
  
  for (const row of rows) {
    const hasSupplier = row.supplierName.trim() !== '';
    const hasContractNo = row.contractNo.trim() !== '';
    const hasInvoiceNo = row.invoiceNo.trim() !== '';
    const hasProductType = row.productType.trim() !== '';
    const hasPol = row.pol.trim() !== '';
    const hasStatus = row.status.trim() !== '';
    const hasEta = row.eta.trim() !== '';
    const hasTotalValue = row.totalValue.trim() !== '' && !row.totalValue.trim().match(/^\$?\s*-?\s*$/);
    
    // KEY INSIGHT: In this CSV format, continuation rows have:
    // - Same supplier/contract/invoice as previous row
    // - EMPTY status (no "أبحر" etc.)
    // - Different product type
    // 
    // A NEW shipment is identified by having a STATUS value (أبحر, وصل, etc.)
    // OR by having POL/POD/ETA which indicates it's a distinct shipment
    const isNewShipment = hasStatus || (hasPol && hasEta) || (hasPol && hasTotalValue);
    
    // Continuation is when we have a product but no status and there's a current shipment
    const isContinuation = !hasStatus && hasProductType && currentShipment !== null && !hasPol;
    
    if (isNewShipment && !isContinuation) {
      if (currentShipment) {
        shipments.push(currentShipment);
      }
      
      // SN Priority: BL Number > Contract No > Invoice No > Auto-generate
      const blNo = row.blNo.trim();
      const contractNo = row.contractNo.trim();
      const invoiceNo = row.invoiceNo.trim();
      
      // Generate unique SN, handling duplicates
      let baseSn = blNo || contractNo || invoiceNo || `AUTO-${Date.now()}-${shipments.length}`;
      let sn = baseSn;
      let counter = 1;
      
      // If SN already used, append contract number or counter to make it unique
      while (usedSNs.has(sn)) {
        if (contractNo && baseSn !== contractNo) {
          sn = `${baseSn}-${contractNo}`;
        } else {
          sn = `${baseSn}-${counter}`;
          counter++;
        }
      }
      usedSNs.add(sn);
      
      // Combine notes with delay status
      let combinedNotes = row.notes.trim();
      if (row.delayStatus.trim()) {
        combinedNotes = combinedNotes 
          ? `${combinedNotes} | حالة التأخير: ${row.delayStatus.trim()}`
          : `حالة التأخير: ${row.delayStatus.trim()}`;
      }
      
      currentShipment = {
        sn,
        contractNo,
        invoiceNo,
        status: mapStatus(row.status),
        subject: row.subject.trim(),
        notes: combinedNotes,
        paperworkStatus: row.documents.trim(),
        delayStatus: row.delayStatus.trim(),
        // Parties
        supplierName: row.supplierName.trim(),  // NEW
        shippingLine: row.shippingCompany.trim(),
        finalBeneficiaryName: row.finalBeneficiary.trim(),
        // Cargo
        productLines: [],
        cargoType: 'containers',
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
        depositDate: parseDate(row.downPaymentDate),
        finalDestination: row.finalDestination.trim(),
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
    } else if ((isContinuation || hasProductType) && currentShipment) {
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
    }
  }
  
  if (currentShipment) {
    shipments.push(currentShipment);
  }
  
  return shipments;
}

// ============================================================
// Multi-line Product Handling - For Contracts (Pending)
// ============================================================

function combineIntoContracts(rows: CSVRow[], status: string): ParsedContract[] {
  const contracts: ParsedContract[] = [];
  let currentContract: ParsedContract | null = null;
  const usedContractNos = new Set<string>();
  
  for (const row of rows) {
    const hasSupplier = row.supplierName.trim() !== '';
    const hasContractNo = row.contractNo.trim() !== '';
    const hasProductType = row.productType.trim() !== '';
    const hasPol = row.pol.trim() !== '';
    const hasTotalValue = row.totalValue.trim() !== '' && !row.totalValue.trim().match(/^\$?\s*-?\s*$/);
    
    // A new contract starts when we have supplier with POL or total value
    // (indicating a distinct contract row, not a continuation)
    const isNewContract = hasSupplier && (hasPol || hasTotalValue);
    
    // Continuation is when we have product but it's clearly a sub-line
    const isContinuation = hasProductType && !hasPol && currentContract !== null;
    
    if (isNewContract && !isContinuation) {
      if (currentContract) {
        contracts.push(currentContract);
      }
      
      let contractNo = row.contractNo.trim();
      
      // Generate contract number if missing
      if (!contractNo) {
        contractNo = row.invoiceNo.trim() || `PENDING-${Date.now()}-${contracts.length}`;
      }
      
      // Handle duplicates
      let uniqueContractNo = contractNo;
      let counter = 1;
      while (usedContractNos.has(uniqueContractNo)) {
        uniqueContractNo = `${contractNo}-${counter}`;
        counter++;
      }
      usedContractNos.add(uniqueContractNo);
      
      currentContract = {
        contractNo: uniqueContractNo,
        invoiceNo: row.invoiceNo.trim(),
        status,
        supplierName: row.supplierName.trim(),
        productLines: [],
        totalContainers: 0,
        totalWeight: 0,
        totalValue: parseCurrency(row.totalValue),
        paidValue: parseCurrency(row.paidValue),
        pol: row.pol.trim(),
        pod: row.pod.trim(),
        finalBeneficiaryName: row.finalBeneficiary.trim(),
        finalDestination: row.finalDestination.trim(),
        shipmentIds: [],
      };
      
      // Add first product line
      const productLine: ProductLine = {
        product_text: row.productType.trim(),
        weight_ton: parseWeight(row.weightTon),
        price_per_ton: parseCurrency(row.pricePerTon),
        container_count: parseInt2(row.containerCount),
      };
      
      if (productLine.product_text) {
        currentContract.productLines.push(productLine);
        currentContract.totalContainers += productLine.container_count || 0;
        currentContract.totalWeight += productLine.weight_ton || 0;
      }
    } else if ((isContinuation || hasProductType) && currentContract) {
      // Add product line to current contract
      const productLine: ProductLine = {
        product_text: row.productType.trim(),
        weight_ton: parseWeight(row.weightTon),
        price_per_ton: parseCurrency(row.pricePerTon),
        container_count: parseInt2(row.containerCount),
      };
      
      if (productLine.product_text) {
        currentContract.productLines.push(productLine);
        currentContract.totalContainers += productLine.container_count || 0;
        currentContract.totalWeight += productLine.weight_ton || 0;
      }
    }
  }
  
  if (currentContract) {
    contracts.push(currentContract);
  }
  
  return contracts;
}

// ============================================================
// Create Contract from Shipment (for shipments without existing contract)
// ============================================================

function createContractFromShipment(shipment: ParsedShipment): ParsedContract {
  return {
    contractNo: shipment.contractNo || shipment.invoiceNo || shipment.sn,
    invoiceNo: shipment.invoiceNo,
    status: 'ACTIVE',  // Already shipped = active contract
    supplierName: shipment.supplierName,
    productLines: [...shipment.productLines],
    totalContainers: shipment.totalContainers,
    totalWeight: shipment.totalWeight,
    totalValue: shipment.totalValueUsd,
    paidValue: shipment.paidValueUsd,
    pol: shipment.pol,
    pod: shipment.pod,
    finalBeneficiaryName: shipment.finalBeneficiaryName,
    finalDestination: shipment.finalDestination,
    shipmentIds: [shipment.sn],
  };
}

// ============================================================
// Validation
// ============================================================

function validateShipment(shipment: ParsedShipment, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!shipment.sn) {
    errors.push('Missing shipment number (sn)');
  }
  
  if (shipment.productLines.length === 0) {
    warnings.push('No product lines found');
  }
  
  if (shipment.eta && !/^\d{4}-\d{2}-\d{2}$/.test(shipment.eta)) {
    errors.push(`Invalid ETA date format: ${shipment.eta}`);
  }
  
  if (shipment.totalValueUsd !== null && shipment.totalValueUsd < 0) {
    warnings.push(`Negative total value: ${shipment.totalValueUsd}`);
  }
  
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

function validateContract(contract: ParsedContract, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!contract.contractNo) {
    errors.push('Missing contract number');
  }
  
  if (contract.productLines.length === 0) {
    warnings.push('No product lines found');
  }
  
  if (!contract.pol) {
    warnings.push('Missing Port of Loading (POL)');
  }
  if (!contract.pod) {
    warnings.push('Missing Port of Discharge (POD)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// Database Operations - Master Data
// ============================================================

interface Lookups {
  ports: Map<string, string>;
  shippingCompanies: Map<string, string>;
  supplierCompanies: Map<string, string>;  // NEW
  beneficiaryCompanies: Map<string, string>;
  existingContracts: Map<string, string>;  // NEW - contractNo -> id
}

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
  
  // Load supplier companies (NEW)
  const supplierResult = await client.query(`
    SELECT id, name FROM master_data.companies 
    WHERE is_supplier = true AND is_deleted = false
  `);
  const supplierCompanies = new Map<string, string>();
  for (const row of supplierResult.rows) {
    if (row.name) supplierCompanies.set(row.name.toLowerCase(), row.id);
  }
  
  // Load all companies (for final beneficiaries)
  const companiesResult = await client.query(`
    SELECT id, name FROM master_data.companies WHERE is_deleted = false
  `);
  const beneficiaryCompanies = new Map<string, string>();
  for (const row of companiesResult.rows) {
    if (row.name) beneficiaryCompanies.set(row.name.toLowerCase(), row.id);
  }
  
  // Load existing contracts
  const contractsResult = await client.query(`
    SELECT id, contract_no FROM logistics.contracts WHERE is_deleted = false
  `);
  const existingContracts = new Map<string, string>();
  for (const row of contractsResult.rows) {
    if (row.contract_no) existingContracts.set(row.contract_no.toLowerCase(), row.id);
  }
  
  return { ports, shippingCompanies, supplierCompanies, beneficiaryCompanies, existingContracts };
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

// NEW: Find or create supplier company
async function findOrCreateSupplier(
  client: PoolClient,
  companyName: string,
  lookups: Lookups,
  stats: ImportStats
): Promise<string | null> {
  if (!companyName) return null;
  
  const normalized = companyName.toLowerCase().trim();
  
  // Try direct match in suppliers
  if (lookups.supplierCompanies.has(normalized)) {
    return lookups.supplierCompanies.get(normalized)!;
  }
  
  // Try partial matches in suppliers
  for (const [key, id] of lookups.supplierCompanies.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return id;
    }
  }
  
  // Try in all companies (beneficiaries)
  if (lookups.beneficiaryCompanies.has(normalized)) {
    // Update existing company to mark as supplier
    const existingId = lookups.beneficiaryCompanies.get(normalized)!;
    await client.query(`
      UPDATE master_data.companies SET is_supplier = true WHERE id = $1
    `, [existingId]);
    lookups.supplierCompanies.set(normalized, existingId);
    return existingId;
  }
  
  // Create new supplier company
  const result = await client.query(`
    INSERT INTO master_data.companies (name, is_supplier)
    VALUES ($1, true)
    RETURNING id
  `, [companyName]);
  
  const newId = result.rows[0].id;
  lookups.supplierCompanies.set(normalized, newId);
  lookups.beneficiaryCompanies.set(normalized, newId);
  stats.supplierCompaniesCreated++;
  
  return newId;
}

async function findOrCreateBeneficiaryCompany(
  client: PoolClient,
  companyName: string,
  lookups: Lookups,
  stats: ImportStats
): Promise<string | null> {
  if (!companyName) return null;
  
  const normalized = companyName.toLowerCase().trim();
  
  // Try direct match
  if (lookups.beneficiaryCompanies.has(normalized)) {
    return lookups.beneficiaryCompanies.get(normalized)!;
  }
  
  // Try partial matches
  for (const [key, id] of lookups.beneficiaryCompanies.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return id;
    }
  }
  
  // Create new company as customer
  const result = await client.query(`
    INSERT INTO master_data.companies (name, is_customer)
    VALUES ($1, true)
    RETURNING id
  `, [companyName]);
  
  const newId = result.rows[0].id;
  lookups.beneficiaryCompanies.set(normalized, newId);
  stats.beneficiaryCompaniesCreated++;
  
  return newId;
}

// ============================================================
// Database Operations - Clear Transactional Data
// ============================================================

async function clearTransactionalData(client: PoolClient): Promise<void> {
  console.log('\n🗑️  Clearing ALL transactional data (clean slate)...');
  
  // Order matters due to foreign keys - delete in dependency order
  const deleteQueries = [
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
      console.log(`  ✅ Cleared ${tableName} (${result.rowCount} rows)`);
    } catch (error: any) {
      // Table might not exist, that's ok
      if (!error.message.includes('does not exist')) {
        console.log(`  ⚠️  ${query}: ${error.message}`);
      }
    }
  }
  
  console.log('  ✅ All transactional data cleared');
}

// ============================================================
// Database Operations - Contract Import
// ============================================================

async function insertContract(
  client: PoolClient,
  contract: ParsedContract,
  lookups: Lookups,
  stats: ImportStats,
  isFromShipment: boolean = false
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
  
  // 2. Insert into logistics.contract_parties with supplier/exporter
  const supplierId = await findOrCreateSupplier(client, contract.supplierName, lookups, stats);
  
  await client.query(`
    INSERT INTO logistics.contract_parties (
      contract_id, proforma_number, exporter_company_id
    ) VALUES ($1, $2, $3)
  `, [
    contractId, 
    contract.invoiceNo || null,
    supplierId
  ]);
  
  // 3. Insert into logistics.contract_shipping
  const polId = await findOrCreatePort(client, contract.pol, lookups, stats);
  const podId = await findOrCreatePort(client, contract.pod, lookups, stats);
  
  await client.query(`
    INSERT INTO logistics.contract_shipping (
      contract_id, port_of_loading_id, final_destination_id
    ) VALUES ($1, $2, $3)
  `, [contractId, polId, podId]);
  
  // 4. Insert into logistics.contract_terms
  await client.query(`
    INSERT INTO logistics.contract_terms (
      contract_id, cargo_type, container_count, weight_ton, currency_code
    ) VALUES ($1, $2, $3, $4, $5)
  `, [
    contractId,
    'containers',
    contract.totalContainers || null,
    contract.totalWeight || null,
    'USD'
  ]);
  
  // 5. Insert into logistics.contract_products (banking info placeholder)
  await client.query(`
    INSERT INTO logistics.contract_products (contract_id)
    VALUES ($1)
  `, [contractId]);
  
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
  
  // Update lookups so shipments can find this contract
  lookups.existingContracts.set(contract.contractNo.toLowerCase(), contractId);
  
  if (isFromShipment) {
    stats.contractsFromShipments++;
  } else {
    stats.contractsCreated++;
  }
  
  return contractId;
}

// ============================================================
// Database Operations - Shipment Import
// ============================================================

async function insertShipment(
  client: PoolClient,
  shipment: ParsedShipment,
  contractId: string | null,
  lookups: Lookups,
  stats: ImportStats
): Promise<string> {
  // 1. Insert into logistics.shipments
  const shipmentResult = await client.query(`
    INSERT INTO logistics.shipments (
      sn, transaction_type, status, subject, notes, paperwork_status, 
      contract_id, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [
    shipment.sn,
    'incoming',
    shipment.status,
    shipment.subject || null,
    shipment.notes || null,
    shipment.paperworkStatus || null,
    contractId,
    'csv_import'
  ]);
  
  const shipmentId = shipmentResult.rows[0].id;
  
  // 2. Insert into logistics.shipment_parties WITH supplier
  const shippingLineId = await findOrCreateShippingCompany(
    client, shipment.shippingLine, lookups, stats
  );
  const supplierId = await findOrCreateSupplier(
    client, shipment.supplierName, lookups, stats
  );
  const beneficiaryCompanyId = await findOrCreateBeneficiaryCompany(
    client, shipment.finalBeneficiaryName, lookups, stats
  );
  
  await client.query(`
    INSERT INTO logistics.shipment_parties (
      shipment_id, supplier_id, shipping_line_id, 
      final_beneficiary_name, final_beneficiary_company_id
    ) VALUES ($1, $2, $3, $4, $5)
  `, [
    shipmentId,
    supplierId,
    shippingLineId,
    shipment.finalBeneficiaryName || null,
    beneficiaryCompanyId
  ]);
  
  // 3. Insert into logistics.shipment_cargo
  const primaryProduct = shipment.productLines[0]?.product_text || '';
  
  await client.query(`
    INSERT INTO logistics.shipment_cargo (
      shipment_id, product_text, cargo_type, container_count, 
      weight_ton, weight_unit
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    shipmentId,
    primaryProduct,
    shipment.cargoType,
    shipment.totalContainers || null,
    shipment.totalWeight || null,
    'tons'
  ]);
  
  // 4. Insert into logistics.shipment_lines (normalized table)
  for (const line of shipment.productLines) {
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
  
  // 5. Insert into logistics.shipment_logistics
  const polId = await findOrCreatePort(client, shipment.pol, lookups, stats);
  const podId = await findOrCreatePort(client, shipment.pod, lookups, stats);
  
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
    shipment.depositDate,
    !!shipment.finalDestination,
    finalDestinationJson,
    'FOB'
  ]);
  
  // 6. Insert into logistics.shipment_financials
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
// Database Operations - Finance Transactions
// ============================================================

async function insertFinanceTransaction(
  client: PoolClient,
  shipment: ParsedShipment,
  shipmentId: string,
  contractId: string | null,
  stats: ImportStats
): Promise<void> {
  if (!shipment.paidValueUsd || shipment.paidValueUsd <= 0) return;
  
  await client.query(`
    INSERT INTO finance.transactions (
      transaction_date, amount_usd, currency, transaction_type,
      direction, fund_source, party_name, description,
      shipment_id, contract_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    shipment.depositDate || new Date().toISOString().split('T')[0],
    shipment.paidValueUsd,
    'USD',
    'bank_transfer',
    'out',
    'Import Payment',
    shipment.supplierName || shipment.finalBeneficiaryName || 'Supplier',
    `Payment for ${shipment.sn} - ${shipment.productLines[0]?.product_text || 'goods'}`,
    shipmentId,
    contractId
  ]);
  
  stats.transactionsCreated++;
}

// ============================================================
// Database Operations - Customs Clearing Costs
// ============================================================

async function insertCustomsClearingCost(
  client: PoolClient,
  shipment: ParsedShipment,
  shipmentId: string,
  stats: ImportStats
): Promise<void> {
  if (!shipment.customsClearanceDate) return;
  
  const fileNumber = shipment.blNo || shipment.contractNo || shipment.sn;
  
  await client.query(`
    INSERT INTO finance.customs_clearing_costs (
      file_number, shipment_id, transaction_description, 
      bol_number, clearance_type, total_clearing_cost,
      payment_status, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    fileNumber,
    shipmentId,
    `Import clearance for ${shipment.productLines[0]?.product_text || 'goods'}`,
    shipment.blNo || null,
    'inbound',
    0,
    'pending',
    `Clearance date: ${shipment.customsClearanceDate}. Cost to be entered.`
  ]);
  
  stats.customsCostsCreated++;
}

// ============================================================
// Dry Run Preview
// ============================================================

function printDryRunPreview(
  contracts: ParsedContract[],
  shipments: ParsedShipment[],
  contractsFromShipments: ParsedContract[]
): void {
  console.log('\n' + '═'.repeat(70));
  console.log('DRY RUN PREVIEW - No changes will be made');
  console.log('═'.repeat(70));
  
  // Pending Contracts (from contracts file)
  console.log(`\n📜 PENDING CONTRACTS (from Contracts file): ${contracts.length}`);
  console.log('─'.repeat(50));
  for (let i = 0; i < Math.min(contracts.length, 10); i++) {
    const c = contracts[i];
    console.log(`  ${c.contractNo} | ${c.supplierName || 'N/A'}`);
    console.log(`    Products: ${c.productLines.length} | ${c.pol || '?'} → ${c.pod || '?'}`);
  }
  if (contracts.length > 10) {
    console.log(`  ... and ${contracts.length - 10} more`);
  }
  
  // Auto-created contracts (from shipments without existing contract)
  console.log(`\n📜 AUTO-CREATED CONTRACTS (from Shipments): ${contractsFromShipments.length}`);
  console.log('─'.repeat(50));
  for (let i = 0; i < Math.min(contractsFromShipments.length, 10); i++) {
    const c = contractsFromShipments[i];
    console.log(`  ${c.contractNo} | ${c.supplierName || 'N/A'} [ACTIVE - already shipped]`);
  }
  if (contractsFromShipments.length > 10) {
    console.log(`  ... and ${contractsFromShipments.length - 10} more`);
  }
  
  // Shipments
  console.log(`\n🚢 SHIPMENTS TO CREATE: ${shipments.length}`);
  console.log('─'.repeat(50));
  
  for (let i = 0; i < Math.min(shipments.length, 15); i++) {
    const s = shipments[i];
    console.log(`  [${i + 1}] ${s.sn}`);
    console.log(`      Supplier: ${s.supplierName || 'N/A'}`);
    console.log(`      Contract: ${s.contractNo || 'N/A'}`);
    console.log(`      Products: ${s.productLines.length} | ${s.pol || '?'} → ${s.pod || '?'}`);
    console.log(`      Status: ${s.status} | ETA: ${s.eta || 'N/A'}`);
    if (s.totalValueUsd) {
      console.log(`      Value: $${s.totalValueUsd.toLocaleString()} (Paid: $${s.paidValueUsd?.toLocaleString() || '0'})`);
    }
  }
  if (shipments.length > 15) {
    console.log(`  ... and ${shipments.length - 15} more shipments`);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log(`  Contracts (PENDING from file): ${contracts.length}`);
  console.log(`  Contracts (ACTIVE auto-created): ${contractsFromShipments.length}`);
  console.log(`  Total Contracts: ${contracts.length + contractsFromShipments.length}`);
  console.log(`  Shipments: ${shipments.length}`);
  console.log(`  Finance Transactions: ${shipments.filter(s => s.paidValueUsd && s.paidValueUsd > 0).length}`);
  console.log(`  Customs Clearing Records: ${shipments.filter(s => s.customsClearanceDate).length}`);
  
  // Unique values for master data
  const uniqueSuppliers = new Set<string>();
  const uniquePorts = new Set<string>();
  const uniqueShippingLines = new Set<string>();
  
  for (const s of shipments) {
    if (s.supplierName) uniqueSuppliers.add(s.supplierName);
    if (s.pol) uniquePorts.add(s.pol);
    if (s.pod) uniquePorts.add(s.pod);
    if (s.shippingLine) uniqueShippingLines.add(s.shippingLine);
  }
  for (const c of contracts) {
    if (c.supplierName) uniqueSuppliers.add(c.supplierName);
    if (c.pol) uniquePorts.add(c.pol);
    if (c.pod) uniquePorts.add(c.pod);
  }
  
  console.log(`\n  Master Data to Create:`);
  console.log(`    Unique Suppliers: ${uniqueSuppliers.size}`);
  console.log(`    Unique Ports: ${uniquePorts.size}`);
  console.log(`    Unique Shipping Lines: ${uniqueShippingLines.size}`);
  
  console.log('\n' + '═'.repeat(70));
  console.log('DRY RUN COMPLETE - Run without --dry-run to import');
  console.log('═'.repeat(70));
}

// ============================================================
// Main Import Function (Two-File Mode)
// ============================================================

async function importTwoFiles(
  contractsFilePath: string,
  shipmentsFilePath: string,
  options: { dryRun: boolean }
): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║           MAIN DATA CSV IMPORT SCRIPT v2.0                         ║');
  console.log('║  Two-File Mode: Contracts First, Then Shipments                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📄 Contracts File: ${contractsFilePath}`);
  console.log(`📄 Shipments File: ${shipmentsFilePath}`);
  console.log(`🔧 Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  
  // ========================================
  // PHASE 1: Parse Contracts File
  // ========================================
  console.log('\n' + '─'.repeat(50));
  console.log('📊 PHASE 1: Parsing Contracts File...');
  const contractRows = parseCSV(contractsFilePath);
  console.log(`  Found ${contractRows.length} rows`);
  
  const pendingContracts = combineIntoContracts(contractRows, 'PENDING');
  console.log(`  Combined into ${pendingContracts.length} contracts`);
  
  // Validate contracts
  let contractErrors = 0;
  for (let i = 0; i < pendingContracts.length; i++) {
    const result = validateContract(pendingContracts[i], i);
    if (!result.isValid) {
      contractErrors++;
      console.log(`  ❌ Contract ${i + 1} (${pendingContracts[i].contractNo}): ${result.errors.join(', ')}`);
    }
  }
  console.log(`  ✅ Valid contracts: ${pendingContracts.length - contractErrors}`);
  
  // ========================================
  // PHASE 2: Parse Shipments File
  // ========================================
  console.log('\n' + '─'.repeat(50));
  console.log('📊 PHASE 2: Parsing Shipments File...');
  const shipmentRows = parseCSV(shipmentsFilePath);
  console.log(`  Found ${shipmentRows.length} rows`);
  
  const shipments = combineIntoShipments(shipmentRows);
  console.log(`  Combined into ${shipments.length} shipments`);
  
  // Validate shipments
  let shipmentErrors = 0;
  for (let i = 0; i < shipments.length; i++) {
    const result = validateShipment(shipments[i], i);
    if (!result.isValid) {
      shipmentErrors++;
      console.log(`  ❌ Shipment ${i + 1} (${shipments[i].sn}): ${result.errors.join(', ')}`);
    }
  }
  console.log(`  ✅ Valid shipments: ${shipments.length - shipmentErrors}`);
  
  // ========================================
  // PHASE 3: Identify Shipments Without Contract
  // ========================================
  console.log('\n' + '─'.repeat(50));
  console.log('📊 PHASE 3: Identifying shipments without existing contract...');
  
  const pendingContractNos = new Set(pendingContracts.map(c => c.contractNo.toLowerCase()));
  const contractsToAutoCreate: ParsedContract[] = [];
  const contractNoToAutoCreate = new Set<string>();
  
  for (const shipment of shipments) {
    const contractNo = shipment.contractNo;
    if (!contractNo) continue;
    
    const normalizedContractNo = contractNo.toLowerCase();
    
    // Check if this contract is NOT in pending contracts AND not already queued for auto-creation
    if (!pendingContractNos.has(normalizedContractNo) && !contractNoToAutoCreate.has(normalizedContractNo)) {
      const autoContract = createContractFromShipment(shipment);
      contractsToAutoCreate.push(autoContract);
      contractNoToAutoCreate.add(normalizedContractNo);
    }
  }
  
  console.log(`  Shipments referencing pending contracts: ${shipments.filter(s => s.contractNo && pendingContractNos.has(s.contractNo.toLowerCase())).length}`);
  console.log(`  Contracts to auto-create (ACTIVE): ${contractsToAutoCreate.length}`);
  
  // ========================================
  // DRY RUN: Preview only
  // ========================================
  if (options.dryRun) {
    printDryRunPreview(pendingContracts, shipments, contractsToAutoCreate);
    return;
  }
  
  // ========================================
  // LIVE IMPORT
  // ========================================
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  
  const stats: ImportStats = {
    portsCreated: 0,
    shippingCompaniesCreated: 0,
    supplierCompaniesCreated: 0,
    beneficiaryCompaniesCreated: 0,
    contractsCreated: 0,
    contractsFromShipments: 0,
    shipmentsCreated: 0,
    transactionsCreated: 0,
    customsCostsCreated: 0,
    shipmentLinesCreated: 0,
    contractLinesCreated: 0,
  };
  
  try {
    // Load lookups
    console.log('\n📚 Loading master data lookups...');
    let lookups = await loadLookups(client);
    console.log(`  Ports: ${lookups.ports.size}`);
    console.log(`  Shipping Companies: ${lookups.shippingCompanies.size}`);
    console.log(`  Suppliers: ${lookups.supplierCompanies.size}`);
    console.log(`  Companies: ${lookups.beneficiaryCompanies.size}`);
    
    // Start transaction
    await client.query('BEGIN');
    console.log('\n🔄 Starting database transaction...');
    
    // Clear existing transactional data
    await clearTransactionalData(client);
    
    // Reload lookups after clearing (existingContracts will be empty now)
    lookups = await loadLookups(client);
    
    // ========================================
    // PHASE 4: Import Pending Contracts
    // ========================================
    console.log('\n📜 Importing PENDING contracts...');
    const contractIdMap = new Map<string, string>();
    
    for (let i = 0; i < pendingContracts.length; i++) {
      const contract = pendingContracts[i];
      try {
        const contractId = await insertContract(client, contract, lookups, stats, false);
        contractIdMap.set(contract.contractNo.toLowerCase(), contractId);
        console.log(`  ✅ [${i + 1}/${pendingContracts.length}] ${contract.contractNo} (PENDING)`);
      } catch (error: any) {
        console.log(`  ❌ Contract: ${contract.contractNo} - ${error.message}`);
        throw error;
      }
    }
    
    // ========================================
    // PHASE 5: Auto-Create Contracts for Shipments
    // ========================================
    console.log('\n📜 Auto-creating ACTIVE contracts from shipments...');
    
    for (let i = 0; i < contractsToAutoCreate.length; i++) {
      const contract = contractsToAutoCreate[i];
      try {
        const contractId = await insertContract(client, contract, lookups, stats, true);
        contractIdMap.set(contract.contractNo.toLowerCase(), contractId);
        console.log(`  ✅ [${i + 1}/${contractsToAutoCreate.length}] ${contract.contractNo} (ACTIVE - from shipment)`);
      } catch (error: any) {
        console.log(`  ❌ Contract: ${contract.contractNo} - ${error.message}`);
        throw error;
      }
    }
    
    // ========================================
    // PHASE 6: Import Shipments
    // ========================================
    console.log('\n🚢 Importing shipments...');
    
    for (let i = 0; i < shipments.length; i++) {
      const shipment = shipments[i];
      const contractId = shipment.contractNo 
        ? contractIdMap.get(shipment.contractNo.toLowerCase()) || null 
        : null;
      
      try {
        const shipmentId = await insertShipment(client, shipment, contractId, lookups, stats);
        console.log(`  ✅ [${i + 1}/${shipments.length}] ${shipment.sn}${contractId ? ` → Contract ${shipment.contractNo}` : ''}`);
        
        // Create finance transaction if paid
        await insertFinanceTransaction(client, shipment, shipmentId, contractId, stats);
        
        // Create customs clearing cost if clearance date exists
        await insertCustomsClearingCost(client, shipment, shipmentId, stats);
        
      } catch (error: any) {
        console.log(`  ❌ [${i + 1}/${shipments.length}] ${shipment.sn} - ${error.message}`);
        throw error;
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');
    
    // Print summary
    console.log('\n' + '═'.repeat(70));
    console.log('IMPORT COMPLETE');
    console.log('═'.repeat(70));
    console.log('\n📊 STATISTICS:');
    console.log(`  Master Data:`);
    console.log(`    Ports created: ${stats.portsCreated}`);
    console.log(`    Shipping companies created: ${stats.shippingCompaniesCreated}`);
    console.log(`    Supplier companies created: ${stats.supplierCompaniesCreated}`);
    console.log(`    Beneficiary companies created: ${stats.beneficiaryCompaniesCreated}`);
    console.log(`  Contracts:`);
    console.log(`    Contracts created (PENDING): ${stats.contractsCreated}`);
    console.log(`    Contracts created (ACTIVE from shipments): ${stats.contractsFromShipments}`);
    console.log(`    Contract lines created: ${stats.contractLinesCreated}`);
    console.log(`  Shipments:`);
    console.log(`    Shipments created: ${stats.shipmentsCreated}`);
    console.log(`    Shipment lines created: ${stats.shipmentLinesCreated}`);
    console.log(`  Finance:`);
    console.log(`    Transactions created: ${stats.transactionsCreated}`);
    console.log(`    Customs clearing costs created: ${stats.customsCostsCreated}`);
    
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
// Legacy Single-File Import
// ============================================================

async function importSingleFile(
  filePath: string,
  options: { dryRun: boolean }
): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║              MAIN DATA CSV IMPORT SCRIPT (Legacy Mode)             ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📄 File: ${filePath}`);
  console.log(`🔧 Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  console.log('\n⚠️  Legacy single-file mode. Consider using two-file mode for better control.');
  
  // Parse CSV
  console.log('\n📊 Parsing CSV file...');
  const rows = parseCSV(filePath);
  console.log(`  Found ${rows.length} rows`);
  
  // Combine into shipments
  console.log('\n🔗 Combining rows into shipments...');
  const shipments = combineIntoShipments(rows);
  console.log(`  Created ${shipments.length} shipments`);
  
  // Create contracts from shipments (all ACTIVE since they're shipped)
  const contractsMap = new Map<string, ParsedContract>();
  for (const shipment of shipments) {
    if (!shipment.contractNo) continue;
    const key = shipment.contractNo.toLowerCase();
    if (!contractsMap.has(key)) {
      contractsMap.set(key, createContractFromShipment(shipment));
    } else {
      // Aggregate product lines
      const contract = contractsMap.get(key)!;
      for (const line of shipment.productLines) {
        const existing = contract.productLines.find(l => l.product_text === line.product_text);
        if (existing) {
          existing.weight_ton = (existing.weight_ton || 0) + (line.weight_ton || 0);
          existing.container_count = (existing.container_count || 0) + (line.container_count || 0);
        } else {
          contract.productLines.push({ ...line });
        }
      }
      contract.totalContainers += shipment.totalContainers;
      contract.totalWeight += shipment.totalWeight;
      contract.totalValue = (contract.totalValue || 0) + (shipment.totalValueUsd || 0);
    }
  }
  
  const contracts = Array.from(contractsMap.values());
  console.log(`  Created ${contracts.length} contracts from shipments`);
  
  if (options.dryRun) {
    printDryRunPreview([], shipments, contracts);
    return;
  }
  
  // Live import uses the two-file logic with empty pending contracts
  // (All contracts are auto-created from shipments)
  
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  
  const stats: ImportStats = {
    portsCreated: 0,
    shippingCompaniesCreated: 0,
    supplierCompaniesCreated: 0,
    beneficiaryCompaniesCreated: 0,
    contractsCreated: 0,
    contractsFromShipments: 0,
    shipmentsCreated: 0,
    transactionsCreated: 0,
    customsCostsCreated: 0,
    shipmentLinesCreated: 0,
    contractLinesCreated: 0,
  };
  
  try {
    console.log('\n📚 Loading master data lookups...');
    let lookups = await loadLookups(client);
    
    await client.query('BEGIN');
    console.log('\n🔄 Starting database transaction...');
    
    await clearTransactionalData(client);
    lookups = await loadLookups(client);
    
    // Create contracts
    console.log('\n📜 Creating contracts...');
    const contractIdMap = new Map<string, string>();
    
    for (const contract of contracts) {
      const contractId = await insertContract(client, contract, lookups, stats, true);
      contractIdMap.set(contract.contractNo.toLowerCase(), contractId);
      console.log(`  ✅ ${contract.contractNo}`);
    }
    
    // Create shipments
    console.log('\n🚢 Creating shipments...');
    for (let i = 0; i < shipments.length; i++) {
      const shipment = shipments[i];
      const contractId = shipment.contractNo 
        ? contractIdMap.get(shipment.contractNo.toLowerCase()) || null 
        : null;
      
      const shipmentId = await insertShipment(client, shipment, contractId, lookups, stats);
      console.log(`  ✅ [${i + 1}/${shipments.length}] ${shipment.sn}`);
      
      await insertFinanceTransaction(client, shipment, shipmentId, contractId, stats);
      await insertCustomsClearingCost(client, shipment, shipmentId, stats);
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed!');
    
    // Print summary
    console.log('\n📊 STATISTICS:');
    console.log(`  Contracts: ${stats.contractsFromShipments}`);
    console.log(`  Shipments: ${stats.shipmentsCreated}`);
    console.log(`  Transactions: ${stats.transactionsCreated}`);
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('\n❌ Rolled back:', error.message);
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
Main Data CSV Import Script v2.0

Usage:
  npx ts-node tools/import-main-data.ts [options]

Options:
  --contracts-file <path>   Path to contracts CSV file (pending contracts)
  --shipments-file <path>   Path to shipments CSV file (shipped goods)
  --file <path>             Legacy: Single combined file (deprecated)
  --dry-run                 Preview changes without modifying database

Examples:
  # Two-file import (recommended)
  npx ts-node tools/import-main-data.ts --dry-run \\
    --contracts-file "data/Main Import (1.0)/Contracts (to be shipped).csv" \\
    --shipments-file "data/Main Import (1.0)/Shipments.csv"

  # Live import
  npx ts-node tools/import-main-data.ts \\
    --contracts-file "data/Main Import (1.0)/Contracts (to be shipped).csv" \\
    --shipments-file "data/Main Import (1.0)/Shipments.csv"

  # Legacy single-file mode
  npx ts-node tools/import-main-data.ts --dry-run --file "data/file.csv"
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  let contractsFile = '';
  let shipmentsFile = '';
  let legacyFile = '';
  let dryRun = false;
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--contracts-file':
        contractsFile = args[++i];
        break;
      case '--shipments-file':
        shipmentsFile = args[++i];
        break;
      case '--file':
        legacyFile = args[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }
  
  // Validate arguments
  if (contractsFile && shipmentsFile) {
    // Two-file mode
    if (!fs.existsSync(contractsFile)) {
      console.error(`Error: Contracts file not found: ${contractsFile}`);
      process.exit(1);
    }
    if (!fs.existsSync(shipmentsFile)) {
      console.error(`Error: Shipments file not found: ${shipmentsFile}`);
      process.exit(1);
    }
    
    try {
      await importTwoFiles(contractsFile, shipmentsFile, { dryRun });
    } catch (error: any) {
      console.error('\n💥 Import failed:', error.message);
      process.exit(1);
    }
  } else if (legacyFile) {
    // Legacy single-file mode
    if (!fs.existsSync(legacyFile)) {
      console.error(`Error: File not found: ${legacyFile}`);
      process.exit(1);
    }
    
    try {
      await importSingleFile(legacyFile, { dryRun });
    } catch (error: any) {
      console.error('\n💥 Import failed:', error.message);
      process.exit(1);
    }
  } else {
    console.error('Error: Must provide either --contracts-file + --shipments-file OR --file');
    printUsage();
    process.exit(1);
  }
}

main();
