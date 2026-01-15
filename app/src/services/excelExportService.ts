import * as XLSX from 'xlsx';
import { CustomsClearingCostDTO, CustomsClearingBatchDetailDTO } from '../types/dto.js';
import logger from '../utils/logger';
import { 
  ExcelLanguage, 
  getExcelTranslation, 
  translateStatus, 
  translateClearanceType, 
  translatePaymentStatus,
  translateCostPaidBy 
} from './excelTranslations';

/**
 * Excel Export Service
 * Generates Excel files for customs clearing costs matching the CSV structure
 */

export interface ExcelExportOptions {
  filename?: string;
  sheetName?: string;
}

/**
 * Convert customs clearing costs to Excel file
 */
export function exportCustomsClearingCostsToExcel(
  costs: CustomsClearingCostDTO[],
  options: ExcelExportOptions = {}
): Buffer {
  const { sheetName = 'Customs Clearing Costs' } = options;

  // Transform data to match CSV structure
  const rows = costs.map((cost) => ({
    'File Number': cost.file_number || '',
    'Type of transaction , Number of Container/Cars , Type of Goods , Weight, Describtion of cost':
      cost.transaction_description || '',
    'Destination/Final Beneficiary {Cost is to be paid by us}':
      cost.destination_final_beneficiary || '',
    'BOL #': cost.bol_number || '',
    'Car plate': cost.car_plate || '',
    'Final Beneficiary { Cost is to be paid by the FB}': cost.cost_paid_by_fb
      ? cost.cost_paid_by_fb.toFixed(2)
      : '',
    'Extra/Iunusual Cost {With explanation}': cost.extra_cost_description || '',
    'Total cost of clearing the transaction (Includes any extras if there is)':
      cost.total_clearing_cost.toFixed(2),
    'Name of the client from the invoice': cost.client_name || '',
    'invoice amount': cost.invoice_amount ? cost.invoice_amount.toFixed(2) : '',
    Currency: cost.currency || 'USD',
    'Invoice/IM/AN #': cost.invoice_number || '',
    'date of the invoice': cost.invoice_date || '',
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  const columnWidths = [
    { wch: 15 }, // File Number
    { wch: 60 }, // Transaction Description
    { wch: 25 }, // Destination/Final Beneficiary
    { wch: 20 }, // BOL #
    { wch: 15 }, // Car plate
    { wch: 15 }, // FB Cost
    { wch: 30 }, // Extra Cost Description
    { wch: 15 }, // Total Cost
    { wch: 30 }, // Client Name
    { wch: 15 }, // Invoice Amount
    { wch: 10 }, // Currency
    { wch: 20 }, // Invoice Number
    { wch: 15 }, // Invoice Date
  ];
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return buffer as Buffer;
}

/**
 * Generate filename with timestamp
 */
export function generateExportFilename(prefix: string = 'customs_clearing_costs'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}_${timestamp}.xlsx`;
}

/**
 * Export customs clearing costs with summary sheet
 */
export function exportCustomsClearingCostsWithSummary(
  costs: CustomsClearingCostDTO[],
  options: ExcelExportOptions = {}
): Buffer {
  const { sheetName = 'Customs Clearing Costs' } = options;

  // Transform data for main sheet
  const rows = costs.map((cost) => ({
    'File Number': cost.file_number || '',
    'Transaction Description': cost.transaction_description || '',
    'Destination/FB': cost.destination_final_beneficiary || '',
    'BOL #': cost.bol_number || '',
    'Car Plate': cost.car_plate || '',
    'Cost Paid by Company': cost.cost_paid_by_company || 0,
    'Cost Paid by FB': cost.cost_paid_by_fb || 0,
    'Extra Cost': cost.extra_cost_amount || 0,
    'Extra Cost Description': cost.extra_cost_description || '',
    'Total Cost': cost.total_clearing_cost,
    'Client Name': cost.client_name || '',
    'Invoice Amount': cost.invoice_amount || '',
    Currency: cost.currency || 'USD',
    'Invoice Number': cost.invoice_number || '',
    'Invoice Date': cost.invoice_date || '',
    'Clearance Type': cost.clearance_type || '',
    'Payment Status': cost.payment_status || 'pending',
    Notes: cost.notes || '',
  }));

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add main data sheet
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 15 }, // File Number
    { wch: 60 }, // Transaction Description
    { wch: 25 }, // Destination/FB
    { wch: 20 }, // BOL
    { wch: 15 }, // Car Plate
    { wch: 15 }, // Cost by Company
    { wch: 15 }, // Cost by FB
    { wch: 12 }, // Extra Cost
    { wch: 30 }, // Extra Description
    { wch: 12 }, // Total Cost
    { wch: 30 }, // Client
    { wch: 15 }, // Invoice Amount
    { wch: 8 }, // Currency
    { wch: 20 }, // Invoice Number
    { wch: 12 }, // Invoice Date
    { wch: 12 }, // Clearance Type
    { wch: 12 }, // Payment Status
    { wch: 30 }, // Notes
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Calculate summary
  const totalCost = costs.reduce((sum, cost) => sum + cost.total_clearing_cost, 0);
  const totalByCompany = costs.reduce(
    (sum, cost) => sum + (cost.cost_paid_by_company || 0),
    0
  );
  const totalByFB = costs.reduce((sum, cost) => sum + (cost.cost_paid_by_fb || 0), 0);
  const totalExtra = costs.reduce((sum, cost) => sum + (cost.extra_cost_amount || 0), 0);

  const inboundCosts = costs.filter((c) => c.clearance_type === 'inbound');
  const outboundCosts = costs.filter((c) => c.clearance_type === 'outbound');

  const summaryData = [
    { Metric: 'Total Records', Value: costs.length },
    { Metric: 'Total Clearing Cost', Value: totalCost.toFixed(2) },
    { Metric: 'Total Paid by Company', Value: totalByCompany.toFixed(2) },
    { Metric: 'Total Paid by Final Beneficiary', Value: totalByFB.toFixed(2) },
    { Metric: 'Total Extra Costs', Value: totalExtra.toFixed(2) },
    { Metric: '', Value: '' },
    { Metric: 'Inbound Records', Value: inboundCosts.length },
    {
      Metric: 'Inbound Total Cost',
      Value: inboundCosts.reduce((sum, c) => sum + c.total_clearing_cost, 0).toFixed(2),
    },
    { Metric: 'Outbound Records', Value: outboundCosts.length },
    {
      Metric: 'Outbound Total Cost',
      Value: outboundCosts.reduce((sum, c) => sum + c.total_clearing_cost, 0).toFixed(2),
    },
  ];

  // Add summary sheet
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return buffer as Buffer;
}

/**
 * Export customs clearing batch with all items
 */
export function exportCustomsClearingBatch(
  batch: CustomsClearingBatchDetailDTO,
  language: ExcelLanguage = 'en'
): Buffer {
  try {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Batch Summary
    const t = (key: string) => getExcelTranslation(language, key);
    const summaryData = [
      { [t('field') || 'Field']: t('batchNumber'), [t('value') || 'Value']: batch.batch_number || t('notAvailable') },
      { [t('field') || 'Field']: t('status'), [t('value') || 'Value']: translateStatus(batch.status || 'pending', language) },
      { [t('field') || 'Field']: t('numberOfItems'), [t('value') || 'Value']: batch.item_count || 0 },
      { [t('field') || 'Field']: t('totalClearingCost'), [t('value') || 'Value']: `$${Number(batch.total_clearing_cost || 0).toFixed(2)}` },
      { [t('field') || 'Field']: '', [t('value') || 'Value']: '' },
      { [t('field') || 'Field']: t('createdBy'), [t('value') || 'Value']: batch.created_by || t('notAvailable') },
      { [t('field') || 'Field']: t('createdDate'), [t('value') || 'Value']: batch.created_at ? new Date(batch.created_at).toLocaleDateString('en-GB') : t('notAvailable') },
      { [t('field') || 'Field']: t('submittedDate'), [t('value') || 'Value']: batch.submitted_at ? new Date(batch.submitted_at).toLocaleDateString('en-GB') : t('notAvailable') },
      { [t('field') || 'Field']: '', [t('value') || 'Value']: '' },
      { [t('field') || 'Field']: t('reviewedBy'), [t('value') || 'Value']: batch.reviewed_by || t('notAvailable') },
      { [t('field') || 'Field']: t('reviewedDate'), [t('value') || 'Value']: batch.reviewed_at ? new Date(batch.reviewed_at).toLocaleDateString('en-GB') : t('notAvailable') },
      { [t('field') || 'Field']: '', [t('value') || 'Value']: '' },
      { [t('field') || 'Field']: t('notes'), [t('value') || 'Value']: batch.notes || '' },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, t('batchSummary'));

    // Sheet 2: Batch Items - FULL DETAILS
    const itemRows = batch.items.map((item, index) => {
      const row = {
        [t('fileNumber')]: item.file_number || '',
      [t('transactionType')]: item.transaction_type || '',
      [t('goodsType')]: item.goods_type || '',
      [t('containersOrCars')]: item.containers_cars_count || '',
      [t('weight')]: item.goods_weight || '',
      [t('clearanceType')]: translateClearanceType(item.clearance_type || null, language),
      [t('costDescription')]: item.cost_description || item.transaction_description || '',
      [t('destinationFB')]: item.destination_final_beneficiary || '',
      [t('costPaidBy')]: translateCostPaidBy(item, language),
      [t('originalClearanceAmount')]: Number(item.cost_paid_by_company || item.cost_paid_by_fb || 0).toFixed(2),
      [t('extraCost')]: Number(item.extra_cost_amount || 0).toFixed(2),
      [t('totalCost')]: Number(item.total_clearing_cost || 0).toFixed(2),
      [t('clientName')]: item.client_name || '',
      [t('invoiceAmount')]: item.invoice_amount ? Number(item.invoice_amount).toFixed(2) : '',
      [t('currency')]: item.currency || 'USD',
      [t('invoiceNumber')]: item.invoice_number || '',
      [t('invoiceDate')]: item.invoice_date || '',
      [t('bolNumber')]: item.bol_number || '',
      [t('carPlate')]: item.car_plate || '',
      [t('extraCostDescription')]: item.extra_cost_description || '',
        [t('paymentStatus')]: translatePaymentStatus(item.payment_status || 'pending', language),
        [t('notes')]: item.notes || '',
      };
      
      return row;
    });

    const itemsSheet = XLSX.utils.json_to_sheet(itemRows);
    itemsSheet['!cols'] = [
      { wch: 15 }, // File Number
      { wch: 20 }, // Transaction Type
      { wch: 25 }, // Goods Type
      { wch: 15 }, // Containers/Cars
      { wch: 15 }, // Weight
      { wch: 15 }, // Clearance Type
      { wch: 40 }, // Cost Description
      { wch: 25 }, // Destination/FB
      { wch: 12 }, // Cost Paid By
      { wch: 18 }, // Original Clearance Amount
      { wch: 12 }, // Extra Cost
      { wch: 18 }, // Total Clearing Cost
      { wch: 30 }, // Client Name
      { wch: 15 }, // Invoice Amount
      { wch: 10 }, // Currency
      { wch: 20 }, // Invoice Number
      { wch: 15 }, // Invoice Date
      { wch: 18 }, // BOL Number
      { wch: 15 }, // Car Plate
      { wch: 30 }, // Extra Cost Description
      { wch: 12 }, // Payment Status
      { wch: 30 }, // Notes
    ];
    XLSX.utils.book_append_sheet(workbook, itemsSheet, t('batchItems'));

    // Sheet 3: Totals Breakdown
    const totalsByCompany = batch.items.reduce((sum, item) => sum + Number(item.cost_paid_by_company || 0), 0);
    const totalsByFB = batch.items.reduce((sum, item) => sum + Number(item.cost_paid_by_fb || 0), 0);
    const totalsExtra = batch.items.reduce((sum, item) => sum + Number(item.extra_cost_amount || 0), 0);

    const totalsData = [
      { [t('category') || 'Category']: t('costPaidByCompany'), [t('amount') || 'Amount']: totalsByCompany.toFixed(2), [t('currency')]: 'USD' },
      { [t('category') || 'Category']: t('costPaidByClient'), [t('amount') || 'Amount']: totalsByFB.toFixed(2), [t('currency')]: 'USD' },
      { [t('category') || 'Category']: t('extraUnusualCosts'), [t('amount') || 'Amount']: totalsExtra.toFixed(2), [t('currency')]: 'USD' },
      { [t('category') || 'Category']: '', [t('amount') || 'Amount']: '', [t('currency')]: '' },
      { [t('category') || 'Category']: t('totalClearingCostLabel'), [t('amount') || 'Amount']: Number(batch.total_clearing_cost || 0).toFixed(2), [t('currency')]: 'USD' },
    ];

    const totalsSheet = XLSX.utils.json_to_sheet(totalsData);
    totalsSheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, totalsSheet, t('totalsBreakdown'));

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return buffer as Buffer;
  } catch (error) {
    logger.error('Excel export error:', error);
    throw new Error(`Excel export failed: ${(error as Error).message}`);
  }
}

