/**
 * File Storage Service
 * Handles document storage, path building, naming, and archiving
 */

import fs from 'fs/promises';
import path from 'path';
import { pool } from '../db/client';
import logger from '../utils/logger';

// Get documents path from environment or use absolute path to app root
// In Docker: __dirname = /app/dist/services → going up 2 levels = /app → /app/storage/documents
// In dev: __dirname = /path/to/loyal-supplychain/app/dist/services → /path/to/loyal-supplychain/app/storage/documents
const APP_ROOT = path.resolve(__dirname, '..', '..');
const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || path.join(APP_ROOT, 'storage', 'documents');

// Entity types for folder organization
export type EntityType = 'shipment' | 'contract' | 'finance' | 'customs' | 'company';

// Document type mapping for filename prefixes
const DOC_TYPE_PREFIXES: Record<string, string> = {
  // Commercial Documents
  proforma_invoice: 'PI',
  commercial_invoice: 'CI',
  packing_list: 'PL',
  bill_of_lading: 'BL',
  bill_of_lading_draft: 'BL_DRAFT',
  bill_of_lading_final: 'BL_FINAL',
  certificate_of_origin: 'COO',
  certificate_of_analysis: 'COA',
  
  // Quality & Compliance
  phytosanitary_certificate: 'PHYTO',
  fumigation_certificate: 'FUMIG',
  health_certificate: 'HEALTH',
  quality_certificate: 'QC',
  halal_certificate: 'HALAL',
  insurance_certificate: 'INS',
  
  // Trade Documents
  purchase_order: 'PO',
  sales_contract: 'SC',
  import_license: 'IMP_LIC',
  export_license: 'EXP_LIC',
  customs_declaration: 'CUSTOMS',
  goods_receipt_note: 'GRN',
  shipping_instructions: 'SI',
  product_specification: 'SPEC',
  
  // Financial
  letter_of_credit: 'LC',
  bank_guarantee: 'BG',
  payment_receipt: 'PAYMENT',
  
  // E-Fatura
  e_fatura: 'EFATURA',
  
  // Other
  other: 'DOC',
};

/**
 * Sanitize filename - remove special characters, replace spaces
 */
export function sanitizeFilename(filename: string): string {
  // Get the extension
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  
  // Sanitize: replace spaces with underscores, remove special chars
  const sanitized = name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '') // Keep alphanumeric, underscores, hyphens, and Arabic
    .substring(0, 100); // Limit length
  
  return sanitized + ext.toLowerCase();
}

/**
 * Generate structured filename: {doctype}_{date}_{original}.{ext}
 */
export function generateFilename(
  docType: string,
  originalFilename: string,
  isDraft: boolean = false,
  customDate?: Date
): string {
  const prefix = DOC_TYPE_PREFIXES[docType] || 'DOC';
  const date = customDate || new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const sanitizedOriginal = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitizedOriginal);
  const nameWithoutExt = path.basename(sanitizedOriginal, ext);
  
  const draftSuffix = isDraft ? '_draft' : '';
  
  return `${prefix}_${dateStr}${draftSuffix}_${nameWithoutExt}${ext}`;
}

/**
 * Build folder path for an entity
 */
export async function buildFolderPath(
  entityType: EntityType,
  entityRef: string,  // SN for shipment, contract_no for contract, etc.
  year?: number
): Promise<string> {
  const currentYear = year || new Date().getFullYear();
  
  switch (entityType) {
    case 'shipment':
      return path.join(DOCUMENTS_PATH, 'shipments', String(currentYear), entityRef, 'docs');
    case 'contract':
      return path.join(DOCUMENTS_PATH, 'contracts', String(currentYear), entityRef, 'docs');
    case 'finance':
      return path.join(DOCUMENTS_PATH, 'finance', String(currentYear), entityRef, 'docs');
    case 'customs':
      return path.join(DOCUMENTS_PATH, 'customs', String(currentYear), entityRef, 'docs');
    case 'company':
      return path.join(DOCUMENTS_PATH, 'companies', sanitizeFilename(entityRef), 'docs');
    default:
      return path.join(DOCUMENTS_PATH, 'other', String(currentYear), entityRef, 'docs');
  }
}

/**
 * Build archive folder path
 */
export function buildArchivePath(folderPath: string): string {
  // Replace /docs with /archive
  return folderPath.replace(/\/docs$/, '/archive');
}

/**
 * Ensure folder exists, create if not
 */
export async function ensureFolderExists(folderPath: string): Promise<void> {
  try {
    await fs.mkdir(folderPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Save a file to the storage system
 */
export async function saveFile(
  buffer: Buffer,
  entityType: EntityType,
  entityRef: string,
  docType: string,
  originalFilename: string,
  isDraft: boolean = false,
  year?: number
): Promise<{ filePath: string; filename: string }> {
  // Build the folder path
  const folderPath = await buildFolderPath(entityType, entityRef, year);
  
  // Ensure folder exists
  await ensureFolderExists(folderPath);
  
  // Generate structured filename
  const filename = generateFilename(docType, originalFilename, isDraft);
  
  // Full file path
  const filePath = path.join(folderPath, filename);
  
  // Check if file already exists - add counter if needed
  let finalPath = filePath;
  let counter = 1;
  while (await fileExists(finalPath)) {
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    finalPath = path.join(folderPath, `${nameWithoutExt}_${counter}${ext}`);
    counter++;
  }
  
  // Write the file
  await fs.writeFile(finalPath, buffer);
  
  logger.info(`📄 Saved document: ${finalPath}`);
  
  return {
    filePath: finalPath,
    filename: path.basename(finalPath),
  };
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Archive an existing document (for versioning)
 */
export async function archiveDocument(
  currentPath: string,
  version: number
): Promise<string> {
  const folderPath = path.dirname(currentPath);
  const archivePath = buildArchivePath(folderPath);
  
  // Ensure archive folder exists
  await ensureFolderExists(archivePath);
  
  // Build archive filename with version
  const ext = path.extname(currentPath);
  const nameWithoutExt = path.basename(currentPath, ext);
  const archivedFilename = `${nameWithoutExt}_v${version}${ext}`;
  const archivedPath = path.join(archivePath, archivedFilename);
  
  // Move file to archive
  await fs.rename(currentPath, archivedPath);
  
  logger.info(`📦 Archived document: ${currentPath} -> ${archivedPath}`);
  
  return archivedPath;
}

/**
 * Create symlink from contract folder to shipment folder
 */
export async function createContractShipmentLink(
  contractNo: string,
  shipmentSn: string,
  shipmentYear: number,
  contractYear?: number
): Promise<void> {
  const cYear = contractYear || new Date().getFullYear();
  
  // Contract folder path
  const contractFolderPath = path.join(
    DOCUMENTS_PATH,
    'contracts',
    String(cYear),
    contractNo,
    'shipments'
  );
  
  // Ensure contract shipments folder exists
  await ensureFolderExists(contractFolderPath);
  
  // Shipment folder path (target of symlink)
  const shipmentFolderPath = path.join(
    DOCUMENTS_PATH,
    'shipments',
    String(shipmentYear),
    shipmentSn
  );
  
  // Symlink path
  const symlinkPath = path.join(contractFolderPath, shipmentSn);
  
  try {
    // Check if symlink already exists
    const stats = await fs.lstat(symlinkPath);
    if (stats.isSymbolicLink()) {
      logger.info(`🔗 Symlink already exists: ${symlinkPath}`);
      return;
    }
  } catch {
    // Symlink doesn't exist, create it
  }
  
  try {
    // Create relative symlink
    const relativePath = path.relative(contractFolderPath, shipmentFolderPath);
    await fs.symlink(relativePath, symlinkPath);
    logger.info(`🔗 Created symlink: ${symlinkPath} -> ${relativePath}`);
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      logger.error(`Failed to create symlink: ${error.message}`);
    }
  }
}

/**
 * Delete a file (move to trash or permanent delete)
 */
export async function deleteFile(filePath: string, permanent: boolean = false): Promise<void> {
  if (permanent) {
    await fs.unlink(filePath);
    logger.info(`🗑️ Permanently deleted: ${filePath}`);
  } else {
    // Move to archive with deleted prefix
    const folderPath = path.dirname(filePath);
    const archivePath = buildArchivePath(folderPath);
    await ensureFolderExists(archivePath);
    
    const filename = path.basename(filePath);
    const deletedFilename = `DELETED_${Date.now()}_${filename}`;
    const deletedPath = path.join(archivePath, deletedFilename);
    
    await fs.rename(filePath, deletedPath);
    logger.info(`🗑️ Moved to trash: ${filePath} -> ${deletedPath}`);
  }
}

/**
 * Read a file from storage
 */
export async function readFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

/**
 * Get file stats
 */
export async function getFileStats(filePath: string): Promise<{
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}> {
  const stats = await fs.stat(filePath);
  return {
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
}

/**
 * Get entity reference from database for path building
 */
export async function getEntityRef(
  entityType: EntityType,
  entityId: string
): Promise<{ ref: string; year: number; contractId?: string; contractNo?: string }> {
  switch (entityType) {
    case 'shipment': {
      const result = await pool.query(
        `SELECT sn, contract_id, EXTRACT(YEAR FROM created_at)::int as year 
         FROM logistics.shipments WHERE id = $1`,
        [entityId]
      );
      if (result.rows.length === 0) throw new Error('Shipment not found');
      
      const { sn, contract_id, year } = result.rows[0];
      
      // Get contract number if linked
      let contractNo: string | undefined;
      if (contract_id) {
        const contractResult = await pool.query(
          'SELECT contract_no FROM logistics.contracts WHERE id = $1',
          [contract_id]
        );
        if (contractResult.rows.length > 0) {
          contractNo = contractResult.rows[0].contract_no;
        }
      }
      
      return { ref: sn, year, contractId: contract_id, contractNo };
    }
    
    case 'contract': {
      const result = await pool.query(
        `SELECT contract_no, EXTRACT(YEAR FROM created_at)::int as year 
         FROM logistics.contracts WHERE id = $1`,
        [entityId]
      );
      if (result.rows.length === 0) throw new Error('Contract not found');
      return { ref: result.rows[0].contract_no, year: result.rows[0].year };
    }
    
    case 'finance': {
      const result = await pool.query(
        `SELECT id::text as ref, EXTRACT(YEAR FROM transaction_date)::int as year 
         FROM finance.transactions WHERE id = $1`,
        [entityId]
      );
      if (result.rows.length === 0) throw new Error('Transaction not found');
      return { ref: result.rows[0].ref, year: result.rows[0].year };
    }
    
    case 'customs': {
      const result = await pool.query(
        `SELECT batch_name, EXTRACT(YEAR FROM batch_date)::int as year 
         FROM finance.customs_clearing_batches WHERE id = $1`,
        [entityId]
      );
      if (result.rows.length === 0) throw new Error('Customs batch not found');
      return { ref: result.rows[0].batch_name, year: result.rows[0].year };
    }
    
    case 'company': {
      const result = await pool.query(
        'SELECT name FROM master_data.companies WHERE id = $1',
        [entityId]
      );
      if (result.rows.length === 0) throw new Error('Company not found');
      return { ref: result.rows[0].name, year: new Date().getFullYear() };
    }
    
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Initialize storage directories
 */
export async function initializeStorage(): Promise<void> {
  const folders = [
    path.join(DOCUMENTS_PATH, 'shipments'),
    path.join(DOCUMENTS_PATH, 'contracts'),
    path.join(DOCUMENTS_PATH, 'finance'),
    path.join(DOCUMENTS_PATH, 'customs'),
    path.join(DOCUMENTS_PATH, 'companies'),
  ];
  
  for (const folder of folders) {
    await ensureFolderExists(folder);
  }
  
  logger.info(`📁 Document storage initialized at: ${DOCUMENTS_PATH}`);
}

// Export the documents path for reference
export { DOCUMENTS_PATH };

