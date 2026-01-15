/**
 * Accounting API Service
 * Uses backend aggregation for better performance
 */

import { apiClient } from './api';
import type { FinancialTransaction, Shipment } from '../types/api';

// Raw data types for individual tables
export interface ClearanceCostRow {
  id: string;
  file_number: string;
  shipment_id: string | null;
  shipment_sn: string | null;
  shipment_product: string | null;
  transaction_description: string;
  bol_number: string | null;
  car_plate: string | null;
  cost_paid_by_company: number | null;
  cost_paid_by_fb: number | null;
  extra_cost_amount: number | null;
  total_clearing_cost: number;
  clearance_type: string | null;
  payment_status: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  customs_clearance_date: string | null; // From shipment
  created_at: string;
  is_documented?: boolean;
  documented_at?: string | null;
  documented_by?: string | null;
}

export interface TransportRow {
  id: string;
  shipment_id: string | null;
  shipment_sn: string | null;
  delivery_number: string | null;
  driver_name: string | null;
  truck_plate: string | null;
  trailer_plate: string | null;
  origin: string | null;
  destination: string | null;
  transport_cost: number | null;
  insurance_company: string | null;
  insurance_cost: number | null;
  total_cost: number | null;
  status: string | null;
  departure_date: string | null;
  arrival_date: string | null;
  transport_company: string | null;
  created_at: string;
  is_documented?: boolean;
  documented_at?: string | null;
  documented_by?: string | null;
}

export interface TransactionRow {
  id: string;
  shipment_id: string | null;
  shipment_sn: string | null;
  transaction_type: string;
  amount: number;
  amount_usd: number;
  amount_other: number | null;  // Original amount in other currency (manually entered)
  currency: string;
  direction: 'in' | 'out';  // Direction of money flow: 'out' = paying, 'in' = receiving
  transaction_date: string;
  description: string | null;
  reference_number: string | null;
  party_name: string | null;
  fund_source: string | null;  // Our internal fund/bank account
  payment_method: string | null;
  status: string | null;
  created_at: string;
  is_documented?: boolean;
  documented_at?: string | null;
  documented_by?: string | null;
}

// Documentation (ترحيل) types
export type RecordType = 'clearance_cost' | 'transport' | 'transaction';

export interface DocumentedRecord {
  id: string;
  record_type: RecordType;
  record_id: string;
  documented_at: string;
  documented_by: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface DocumentRecordParams {
  record_type: RecordType;
  record_id: string;
  notes?: string;
}

// Types for accounting data
export interface ShipmentFinancialSummary {
  shipment_id: string;
  sn: string;
  product_text: string;
  subject: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  direction: 'incoming' | 'outgoing';
  status: string | null;
  
  // Contract info
  contract_no: string | null;
  contract_id: string | null;
  
  // Final Beneficiary / Destination
  final_owner: string | null;
  final_place: string | null;
  
  // Shipment values
  total_value_usd: number;
  weight_ton: number | null;
  container_count: number | null;
  
  // Port info
  pod_name: string | null;
  pol_name: string | null;
  
  // Financial breakdown
  advance_paid: number;
  balance_paid: number;
  clearance_cost: number;
  internal_transport: number;
  other_costs: number;
  
  // Calculated fields
  total_paid: number;
  remaining_balance: number;
  payment_percentage: number;
  
  // Dates
  eta: string | null;
  customs_clearance_date: string | null;
  created_at: string;
}

export interface AccountingFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  direction?: 'incoming' | 'outgoing';
  dateFrom?: string;
  dateTo?: string;
  hasBalance?: boolean; // Filter shipments with remaining balance
  supplier_id?: string;
  customer_id?: string;
  sortBy?: 'sn' | 'total_value_usd' | 'remaining_balance' | 'eta' | 'created_at' | 'payment_percentage' | 'advance_paid' | 'balance_paid' | 'clearance_cost' | 'internal_transport' | 'total_paid';
  sortDir?: 'asc' | 'desc';
}

export interface AccountingSummary {
  total_shipments: number;
  total_value: number;
  total_advance_paid: number;
  total_balance_paid: number;
  total_clearance_costs: number;
  total_internal_transport: number;
  total_other_costs: number;
  total_paid: number;
  total_remaining: number;
  average_payment_percentage: number;
}

export interface AccountingResponse {
  data: ShipmentFinancialSummary[];
  summary: AccountingSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ShipmentTransactionDetail {
  shipment: Shipment;
  transactions: FinancialTransaction[];
  summary: {
    advance_paid: number;
    balance_paid: number;
    clearance_cost: number;
    internal_transport: number;
    other_costs: number;
    total_paid: number;
    remaining_balance: number;
  };
}

// Inventory Transactions (حركة البضاعة) types
// Line item summary from product lines (source of truth for commercial quantity)
export interface LineItemSummary {
  type_of_goods: string;
  quantity_mt: number;
  number_of_packages: number;
  kind_of_packages: string;
  unit_price: number;
  amount_usd: number;
}

export interface InventoryTransactionRow {
  row_number: number;
  id: string;
  sn: string | null;
  invoice_type: 'شراء' | 'مبيع' | string;  // Purchase or Sale
  product_name: string;
  packaging: string;
  package_count: number;
  // Product line items are the source of truth for quantity (not BOL weight)
  quantity: number;           // Aggregated from product line items
  unit: string;               // Quantity unit from product lines
  bol_weight_mt: number | null; // Bill of Lading weight (reference only for logistics)
  line_items_summary: LineItemSummary[] | null; // Detailed line items for display
  purchase_price: number;
  total: number;
  supplier: string;
  arrival_date: string | null;
  final_owner: string;
  sale_price: number;
  notes: string;
  status: string | null;
  created_at: string;
  pod: string;                    // Port of Discharge
  final_destination_place: string; // Final destination for route display
  // Border crossing info
  is_cross_border: boolean | null;
  primary_border_name: string | null;
  primary_border_name_ar: string | null;
}

export interface InventoryTransactionSummary {
  total_records: number;
  purchase_count: number;
  sale_count: number;
  total_value: number;
  total_purchases: number;
  total_sales: number;
  // Product line items are the source of truth for quantity
  total_quantity: number;         // Aggregated from product line items
  total_bol_weight_mt?: number;   // BOL weight reference (for logistics only)
}

export interface InventoryTransactionsResponse {
  data: InventoryTransactionRow[];
  summary: InventoryTransactionSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface InventoryTransactionFilters {
  page?: number;
  limit?: number;
  search?: string;
  invoice_type?: 'شراء' | 'مبيع' | 'purchase' | 'sale';
  date_from?: string;
  date_to?: string;
}

// Invoice types
export interface SavedInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  type: 'purchase' | 'sales';
  language: 'ar' | 'en' | 'bilingual';
  seller_name: string;
  seller_name_ar: string | null;
  seller_address: string | null;
  buyer_name: string;
  buyer_name_ar: string | null;
  buyer_address: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  currency: string;
  shipment_id: string | null;
  contract_id: string | null;
  invoice_data: any;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

class AccountingService {
  /**
   * Get aggregated financial data for all shipments
   * Uses backend aggregation endpoint for better performance
   */
  async getShipmentFinancials(filters: AccountingFilters = {}): Promise<AccountingResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.direction) params.append('direction', filters.direction);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.hasBalance !== undefined) params.append('hasBalance', String(filters.hasBalance));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortDir) params.append('sortDir', filters.sortDir);

      const response = await apiClient.get(`/accounting/shipment-financials?${params.toString()}`);
      console.log('[Accounting] Backend aggregation returned', response.data.data?.length, 'rows');
      return response.data;
    } catch (error: any) {
      console.error('[Accounting] Backend aggregation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed transactions for a specific shipment
   */
  async getShipmentTransactions(shipmentId: string): Promise<ShipmentTransactionDetail> {
    try {
      const response = await apiClient.get(`/accounting/shipments/${shipmentId}/transactions`);
      return response.data;
    } catch (error) {
      // Fallback: fetch shipment and transactions separately
      const [shipmentRes, transactionsRes] = await Promise.all([
        apiClient.get(`/shipments/${shipmentId}`),
        apiClient.get(`/finance/transactions?shipment_id=${shipmentId}&limit=100`),
      ]);

      const shipment = shipmentRes.data;
      const transactions = transactionsRes.data.transactions || [];

      return this.aggregateShipmentTransactions(shipment, transactions);
    }
  }

  /**
   * Get accounting summary statistics
   */
  async getSummary(filters?: { dateFrom?: string; dateTo?: string }): Promise<AccountingSummary> {
    const params = new URLSearchParams();
    
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);

    try {
      const response = await apiClient.get(`/accounting/summary?${params.toString()}`);
      return response.data;
    } catch {
      // Fallback
      const data = await this.getShipmentFinancials(filters || {});
      return data.summary;
    }
  }

  // ========== Documentation (ترحيل) Methods ==========

  /**
   * Document a record (ترحيل)
   */
  async documentRecord(params: DocumentRecordParams): Promise<{ success: boolean; data: DocumentedRecord }> {
    const response = await apiClient.post('/accounting/document', params);
    return response.data;
  }

  /**
   * Undocument a record (إلغاء الترحيل)
   */
  async undocumentRecord(params: { record_type: RecordType; record_id: string }): Promise<{ success: boolean }> {
    const response = await apiClient.post('/accounting/undocument', params);
    return response.data;
  }

  /**
   * Get documented record IDs by type
   */
  async getDocumentedIds(record_type: RecordType): Promise<string[]> {
    try {
      const response = await apiClient.get('/accounting/documented/ids', {
        params: { record_type },
      });
      return response.data.documented_ids || [];
    } catch {
      return [];
    }
  }

  /**
   * Check if a specific record is documented
   */
  async isRecordDocumented(record_type: RecordType, record_id: string): Promise<boolean> {
    try {
      const response = await apiClient.get(`/accounting/is-documented/${record_type}/${record_id}`);
      return response.data.is_documented || false;
    } catch {
      return false;
    }
  }

  /**
   * Get all customs clearing costs
   * Uses new backend endpoint with SQL-level documentation filtering
   */
  async getClearanceCosts(params: { page?: number; limit?: number; search?: string; documented?: boolean } = {}): Promise<{
    data: ClearanceCostRow[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', String(params.page));
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.search) queryParams.append('search', params.search);
      if (params.documented !== undefined) queryParams.append('documented', String(params.documented));

      const response = await apiClient.get(`/accounting/clearance-costs?${queryParams.toString()}`);

      console.log('[Accounting] Clearance costs fetched:', response.data.data?.length, `(documented filter: ${params.documented})`);
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 },
      };
    } catch (error: any) {
      console.error('[Accounting] Failed to fetch clearance costs:', error.message);
      return { data: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } };
    }
  }

  /**
   * Get all internal transport deliveries
   * Uses new backend endpoint with SQL-level documentation filtering
   */
  async getTransportDeliveries(params: { page?: number; limit?: number; search?: string; documented?: boolean } = {}): Promise<{
    data: TransportRow[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', String(params.page));
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.search) queryParams.append('search', params.search);
      if (params.documented !== undefined) queryParams.append('documented', String(params.documented));

      const response = await apiClient.get(`/accounting/transport-deliveries?${queryParams.toString()}`);

      console.log('[Accounting] Transport deliveries fetched:', response.data.data?.length, `(documented filter: ${params.documented})`);
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 },
      };
    } catch (error: any) {
      console.error('[Accounting] Failed to fetch transport deliveries:', error.message);
      return { data: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } };
    }
  }

  /**
   * Get all financial transactions
   * Uses new backend endpoint with SQL-level documentation filtering
   */
  async getFinancialTransactions(params: { page?: number; limit?: number; search?: string; shipment_id?: string; documented?: boolean } = {}): Promise<{
    data: TransactionRow[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', String(params.page));
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.search) queryParams.append('search', params.search);
      if (params.shipment_id) queryParams.append('shipment_id', params.shipment_id);
      if (params.documented !== undefined) queryParams.append('documented', String(params.documented));

      const response = await apiClient.get(`/accounting/transactions?${queryParams.toString()}`);
      
      // Map amount_usd to amount for compatibility
      const data = (response.data.data || []).map((t: any) => ({
        ...t,
        amount: parseFloat(t.amount_usd || t.amount || 0),
      }));

      console.log('[Accounting] Financial transactions fetched:', data.length, `(documented filter: ${params.documented})`);
      return {
        data,
        pagination: response.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 },
      };
    } catch (error: any) {
      console.error('[Accounting] Failed to fetch financial transactions:', error.message);
      return { data: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } };
    }
  }

  // ========== Inventory Transactions (حركة البضاعة) Methods ==========

  /**
   * Get inventory transactions aggregated from shipments
   * Maps to CSV columns: نوع الفاتورة, اسم الصنف, التعبئة, etc.
   */
  async getInventoryTransactions(params: InventoryTransactionFilters = {}): Promise<InventoryTransactionsResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', String(params.page));
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.search) queryParams.append('search', params.search);
      if (params.invoice_type) queryParams.append('invoice_type', params.invoice_type);
      if (params.date_from) queryParams.append('date_from', params.date_from);
      if (params.date_to) queryParams.append('date_to', params.date_to);

      const response = await apiClient.get(`/accounting/inventory-transactions?${queryParams.toString()}`);
      
      console.log('[Accounting] Inventory transactions fetched:', response.data.data?.length);
      return {
        data: response.data.data || [],
        summary: response.data.summary || {
          total_records: 0,
          purchase_count: 0,
          sale_count: 0,
          total_value: 0,
          total_purchases: 0,
          total_sales: 0,
          total_quantity: 0,
        },
        pagination: response.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 },
      };
    } catch (error: any) {
      console.error('[Accounting] Failed to fetch inventory transactions:', error.message);
      return {
        data: [],
        summary: {
          total_records: 0,
          purchase_count: 0,
          sale_count: 0,
          total_value: 0,
          total_purchases: 0,
          total_sales: 0,
          total_quantity: 0,
        },
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      };
    }
  }

  // ========== Invoice Methods ==========

  /**
   * Save an invoice to the database
   */
  async saveInvoice(invoiceData: any): Promise<SavedInvoice> {
    const response = await apiClient.post('/accounting/invoices', {
      invoice_date: invoiceData.invoice_date,
      due_date: invoiceData.due_date,
      type: invoiceData.type,
      language: invoiceData.language,
      seller_name: invoiceData.seller?.name || '',
      seller_name_ar: invoiceData.seller?.name_ar,
      seller_address: invoiceData.seller?.address,
      buyer_name: invoiceData.buyer?.name || '',
      buyer_name_ar: invoiceData.buyer?.name_ar,
      buyer_address: invoiceData.buyer?.address,
      subtotal: invoiceData.subtotal,
      discount: invoiceData.discount,
      tax: invoiceData.tax,
      total_amount: invoiceData.total_amount,
      currency: invoiceData.currency,
      shipment_id: invoiceData.shipment_id,
      contract_id: invoiceData.contract_id,
      invoice_data: invoiceData,
    });
    return response.data.data;
  }

  /**
   * Get list of saved invoices
   */
  async getInvoices(params: { 
    page?: number; 
    limit?: number; 
    type?: 'purchase' | 'sales'; 
    status?: string;
    shipment_id?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  } = {}): Promise<{ data: SavedInvoice[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));
    if (params.type) queryParams.append('type', params.type);
    if (params.status) queryParams.append('status', params.status);
    if (params.shipment_id) queryParams.append('shipment_id', params.shipment_id);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.search) queryParams.append('search', params.search);

    const response = await apiClient.get(`/accounting/invoices?${queryParams.toString()}`);
    return response.data;
  }

  /**
   * Get single invoice by ID
   */
  async getInvoice(id: string): Promise<SavedInvoice> {
    const response = await apiClient.get(`/accounting/invoices/${id}`);
    return response.data;
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(id: string, status: 'draft' | 'sent' | 'paid' | 'cancelled', cancelledReason?: string): Promise<SavedInvoice> {
    const response = await apiClient.put(`/accounting/invoices/${id}/status`, { 
      status,
      cancelled_reason: cancelledReason,
    });
    return response.data.data;
    }

  /**
   * Delete an invoice
   */
  async deleteInvoice(id: string): Promise<void> {
    await apiClient.delete(`/accounting/invoices/${id}`);
  }

  // ========== Private Helpers ==========

  /**
   * Aggregate transactions for a single shipment
   */
  private aggregateShipmentTransactions(
    shipment: Shipment,
    transactions: FinancialTransaction[]
  ): ShipmentTransactionDetail {
    const summary = this.calculateTransactionSummary(transactions);
    const totalValue = parseFloat(String(shipment.total_value_usd || 0));

    return {
      shipment,
      transactions,
      summary: {
        ...summary,
        remaining_balance: totalValue - summary.total_paid,
      },
    };
  }

  /**
   * Calculate transaction summary by type
   */
  private calculateTransactionSummary(transactions: FinancialTransaction[]) {
    let advance_paid = 0;
    let balance_paid = 0;
    let clearance_cost = 0;
    let internal_transport = 0;
    let other_costs = 0;

    transactions.forEach((t) => {
      const amount = Math.abs(t.amount_usd);
      const type = (t.transaction_type || '').toLowerCase();

      // Categorize by transaction type
      if (type.includes('advance') || type.includes('down_payment') || type.includes('دفعة مقدمة')) {
        advance_paid += amount;
      } else if (type.includes('balance') || type.includes('final') || type.includes('رصيد')) {
        balance_paid += amount;
      } else if (type.includes('clearance') || type.includes('customs') || type.includes('جمرك') || type.includes('تخليص')) {
        clearance_cost += amount;
      } else if (type.includes('transport') || type.includes('delivery') || type.includes('نقل') || type.includes('توصيل')) {
        internal_transport += amount;
      } else {
        // General payments and other costs
        if (t.direction === 'out') {
          other_costs += amount;
        } else {
          // Incoming payments go to balance_paid by default
          balance_paid += amount;
        }
      }
    });

    const total_paid = advance_paid + balance_paid;

    return {
      advance_paid,
      balance_paid,
      clearance_cost,
      internal_transport,
      other_costs,
      total_paid,
    };
  }
}

export const accountingService = new AccountingService();
export default accountingService;
