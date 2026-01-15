/**
 * ETL Script: Import Customs Clearing Costs from CSV
 * 
 * Usage:
 *   npx ts-node etl/customs-costs-loader.ts <path-to-csv-file>
 * 
 * Example:
 *   npx ts-node etl/customs-costs-loader.ts data/Yagan\ Cusomt\ clearing\ cost\ table\(ورقة1\)\ \(1\).csv
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { config } from 'dotenv';

// Load environment variables
config({ path: path.join(__dirname, '..', 'app', '.env') });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

interface CSVRow {
  'File Number': string;
  'Type of transaction , Number of Container/Cars , Type of Goods , Weight, Describtion of cost': string;
  'Destination/Final Beneficiary {Cost is to be paid by us}': string;
  'BOL #': string;
  'Car plate': string;
  'Final Beneficiary { Cost is to be paid by the FB}': string;
  'Extra/Iunusual Cost {With explanation}': string;
  'Total cost of clearing the transaction (Includes any extras if there is)': string;
  'Name of the client from the invoice': string;
  'invoice amount': string;
  'Currency': string;
  'Invoice/IM/AN #': string;
  'date of the invoice': string;
}

interface ParsedCost {
  fileNumber: string;
  transactionDescription: string;
  destinationFinalBeneficiary: string | null;
  bolNumber: string | null;
  carPlate: string | null;
  costPaidByCompany: number | null;
  costPaidByFB: number | null;
  extraCostAmount: number | null;
  extraCostDescription: string | null;
  totalClearingCost: number;
  clientName: string | null;
  invoiceAmount: number | null;
  currency: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
}

// Parse numeric value, handling comma separators
function parseNumber(value: string | null | undefined): number | null {
  if (!value || value.trim() === '' || value.trim() === '-') return null;
  const cleaned = value.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse date in format YYYY-MM-DD or other formats
function parseDate(value: string | undefined): string | null {
  if (!value || value.trim() === '' || value.trim() === '-') return null;
  
  try {
    // Try parsing as ISO date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (err) {
    // Ignore parse errors
  }
  
  return null;
}

// Clean string value
function cleanString(value: string | undefined): string | null {
  if (!value || value.trim() === '' || value.trim() === '-') return null;
  return value.trim();
}

// Match shipment by BOL number
async function findShipmentByBOL(bolNumber: string | null): Promise<string | null> {
  if (!bolNumber) return null;
  
  try {
    const result = await pool.query(
      `SELECT id FROM logistics.shipments WHERE bl_no ILIKE $1 AND is_deleted = FALSE LIMIT 1`,
      [bolNumber]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
  } catch (err) {
    console.warn(`Error finding shipment by BOL ${bolNumber}:`, err);
  }
  
  return null;
}

// Determine clearance type based on data
function determineClearanceType(data: ParsedCost): 'inbound' | 'outbound' | null {
  // You can add logic here to determine based on file number patterns, client names, etc.
  // For now, we'll leave it as null and let users fill it in manually
  return null;
}

// Parse CSV row to structured data
function parseRow(row: any): ParsedCost | null {
  // Handle BOM in column names - get the first column name (File Number with or without BOM)
  const fileNumberKey = Object.keys(row).find(k => k.includes('File Number')) || 'File Number';
  
  const fileNumber = cleanString(row[fileNumberKey]);
  const transactionDescription = cleanString(row['Type of transaction , Number of Container/Cars , Type of Goods , Weight, Describtion of cost']);
  
  // Skip empty rows or header rows
  if (!fileNumber || !transactionDescription) {
    return null;
  }
  
  // Skip if it looks like a header or total row
  if (fileNumber.toLowerCase().includes('file') || fileNumber.toLowerCase().includes('total')) {
    return null;
  }
  
  const destinationFB = cleanString(row['Destination/Final Beneficiary {Cost is to be paid by us}']);
  const costPaidByFBStr = cleanString(row['Final Beneficiary { Cost is to be paid by the FB}']);
  const extraCostStr = cleanString(row['Extra/Iunusual Cost {With explanation}']);
  
  // Parse costs
  const costPaidByFB = parseNumber(costPaidByFBStr);
  const totalClearingCost = parseNumber(row['Total cost of clearing the transaction (Includes any extras if there is)']) || 0;
  
  // Calculate company cost and extra costs
  let costPaidByCompany: number | null = null;
  let extraCostAmount: number | null = null;
  let extraCostDescription: string | null = null;
  
  // If FB paid, then company didn't pay for base cost
  if (costPaidByFB && costPaidByFB > 0) {
    // Check if there's a difference that could be extra costs
    const diff = totalClearingCost - costPaidByFB;
    if (diff > 0.01) { // small threshold for rounding
      extraCostAmount = diff;
      extraCostDescription = extraCostStr;
    }
  } else {
    // Company paid
    // Check if we have extra cost description
    if (extraCostStr) {
      // Try to extract amount from description if it contains a number
      const match = extraCostStr.match(/(\d+[\d,]*\.?\d*)/);
      if (match) {
        extraCostAmount = parseNumber(match[1]);
        extraCostDescription = extraCostStr;
        costPaidByCompany = totalClearingCost - (extraCostAmount || 0);
      } else {
        // No amount in extra description, assume all is company cost
        costPaidByCompany = totalClearingCost;
        extraCostDescription = extraCostStr;
      }
    } else {
      // All is company cost
      costPaidByCompany = totalClearingCost;
    }
  }
  
  return {
    fileNumber: fileNumber!,
    transactionDescription: transactionDescription!,
    destinationFinalBeneficiary: destinationFB,
    bolNumber: cleanString(row['BOL #']),
    carPlate: cleanString(row['Car plate']),
    costPaidByCompany,
    costPaidByFB,
    extraCostAmount,
    extraCostDescription,
    totalClearingCost,
    clientName: cleanString(row['Name of the client from the invoice']),
    invoiceAmount: parseNumber(row['invoice amount']),
    currency: cleanString(row['Currency']) || 'USD',
    invoiceNumber: cleanString(row['Invoice/IM/AN #']),
    invoiceDate: parseDate(row['date of the invoice']),
  };
}

// Insert customs clearing cost into database
async function insertCost(cost: ParsedCost): Promise<void> {
  // Find shipment by BOL if provided
  const shipmentId = await findShipmentByBOL(cost.bolNumber);
  const clearanceType = determineClearanceType(cost);
  
  try {
    await pool.query(
      `INSERT INTO finance.customs_clearing_costs (
        file_number, shipment_id, transaction_description, destination_final_beneficiary,
        bol_number, car_plate, cost_paid_by_company, cost_paid_by_fb,
        extra_cost_amount, extra_cost_description, total_clearing_cost,
        client_name, invoice_amount, currency, invoice_number, invoice_date,
        clearance_type, payment_status, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )`,
      [
        cost.fileNumber,
        shipmentId,
        cost.transactionDescription,
        cost.destinationFinalBeneficiary,
        cost.bolNumber,
        cost.carPlate,
        cost.costPaidByCompany,
        cost.costPaidByFB,
        cost.extraCostAmount,
        cost.extraCostDescription,
        cost.totalClearingCost,
        cost.clientName,
        cost.invoiceAmount,
        cost.currency,
        cost.invoiceNumber,
        cost.invoiceDate,
        clearanceType,
        'pending', // Default payment status
        'etl_import',
        'etl_import',
      ]
    );
    
    console.log(`✓ Imported: ${cost.fileNumber} - ${cost.totalClearingCost} ${cost.currency}`);
  } catch (err: any) {
    console.error(`✗ Error importing ${cost.fileNumber}:`, err.message);
  }
}

// Main import function
async function importCosts(csvFilePath: string): Promise<void> {
  console.log(`\n📂 Reading CSV file: ${csvFilePath}\n`);
  
  const costs: ParsedCost[] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row: CSVRow) => {
        const parsed = parseRow(row);
        if (parsed) {
          costs.push(parsed);
        }
      })
      .on('end', async () => {
        console.log(`\n📊 Parsed ${costs.length} valid records from CSV\n`);
        console.log('💾 Inserting into database...\n');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const cost of costs) {
          try {
            await insertCost(cost);
            successCount++;
          } catch (err) {
            errorCount++;
          }
        }
        
        console.log(`\n✅ Import complete!`);
        console.log(`   Success: ${successCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log(`   Total: ${costs.length}\n`);
        
        resolve();
      })
      .on('error', (err: any) => {
        console.error('Error reading CSV:', err);
        reject(err);
      });
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx ts-node etl/customs-costs-loader.ts <path-to-csv-file>');
    process.exit(1);
  }
  
  const csvFilePath = args[0];
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: File not found: ${csvFilePath}`);
    process.exit(1);
  }
  
  try {
    await importCosts(csvFilePath);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

