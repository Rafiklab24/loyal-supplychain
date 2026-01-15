/**
 * Contracts API Service
 * Handles all API calls related to contracts and contract lines
 */

import { apiClient } from './api';

// ========== TYPES ==========

export interface LinkedShipment {
  id: string;
  sn: string;
  product_text?: string;
  subject?: string;
  status?: string;
  eta?: string;
  weight_ton?: number;
  container_count?: number;
  origin_port?: string;
  destination_port?: string;
  created_at: string;
}

export interface Contract {
  id: string;
  contract_no: string;
  direction?: 'incoming' | 'outgoing';  // Transaction direction: incoming = purchase, outgoing = sale
  subject?: string;
  buyer_company_id: string;
  seller_company_id: string;
  buyer_name?: string;
  seller_name?: string;
  buyer_country?: string;
  seller_country?: string;
  incoterm_code?: string;
  currency_code: string;
  signed_at?: string;
  valid_from?: string;
  valid_to?: string;
  status: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'FULFILLED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  extra_json?: Record<string, any>;
  line_count?: number;
  shipment_count?: number;
  lines?: ContractLine[];
  payment_schedules?: PaymentSchedule[];
  linked_shipments?: LinkedShipment[];
  // Fulfillment tracking (populated when fetching contract details)
  fulfillment?: ContractFulfillmentSummary;
  // Aggregated product info
  products_summary?: string;
  total_quantity_mt?: number;
  total_amount_usd?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted: boolean;
}

export interface ContractLine {
  id: string;
  contract_id: string;
  product_id: string;
  product_name?: string;
  type_of_goods?: string;
  brand?: string;
  hs_code?: string;
  category?: string;
  unit_size?: number;
  uom: string;
  planned_qty: number;
  quantity_mt?: number;
  unit_price: number;
  tolerance_pct?: number;
  notes?: string;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Fulfillment tracking (populated when fetching contract details)
  shipped_quantity_mt?: number;
  pending_quantity_mt?: number;
  fulfillment_percentage?: number;
  shipment_count?: number;
  linked_shipment_ids?: string[];
}

// ========== FULFILLMENT TYPES ==========

export interface ContractFulfillmentSummary {
  total_contracted_mt: number;
  total_shipped_mt: number;
  total_pending_mt: number;
  overall_percentage: number;
  is_fully_shipped: boolean;
  shipment_count: number;
}

export interface ContractLineFulfillment {
  id: string;
  type_of_goods?: string;
  product_name?: string;
  brand?: string;
  contracted_quantity_mt: number;
  shipped_quantity_mt: number;
  pending_quantity_mt: number;
  fulfillment_percentage: number;
  shipment_count: number;
  shipments: Array<{
    shipment_id: string;
    sn: string;
    quantity_mt: number;
    status: string;
    eta?: string;
    created_at: string;
  }>;
}

export interface ContractFulfillmentStatus {
  contract_id: string;
  contract_no: string;
  contract_status: string;
  summary: ContractFulfillmentSummary;
  lines: ContractLineFulfillment[];
  shipments: Array<{
    id: string;
    sn: string;
    status: string;
    eta?: string;
    created_at: string;
    total_quantity_mt: number;
  }>;
}

export interface PaymentSchedule {
  id: string;
  contract_id: string;
  seq: number;
  basis: 'ON_BOOKING' | 'ON_BL' | 'ON_ARRIVAL' | 'ON_DELIVERY' | 'DEFERRED' | 'CUSTOM';
  days_after?: number;
  percent?: number;
  amount?: number;
  is_deferred: boolean;
  notes?: string;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ContractCreateInput {
  contract_no: string;
  buyer_company_id: string;
  seller_company_id: string;
  incoterm_code?: string;
  currency_code?: string;
  signed_at?: string;
  valid_from?: string;
  valid_to?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  extra_json?: Record<string, any>;
  lines?: Array<{
    product_id: string;
    unit_size?: number;
    uom?: string;
    planned_qty: number;
    unit_price: number;
    tolerance_pct?: number;
    notes?: string;
    extra_json?: Record<string, any>;
  }>;
}

export interface ContractFilters {
  page?: number;
  limit?: number;
  contract_no?: string;
  buyer_company_id?: string;
  seller_company_id?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  currency_code?: string;
  product?: string;  // Filter by type of goods/product
  search?: string;
  sortBy?: 'contract_no' | 'signed_at' | 'valid_from' | 'valid_to' | 'created_at' | 'updated_at';
  sortDir?: 'asc' | 'desc';
}

export interface ContractListResponse {
  data: Contract[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ========== API SERVICE ==========

const contractsService = {
  /**
   * Get list of contracts with filtering and pagination
   */
  async getContracts(filters: ContractFilters = {}): Promise<ContractListResponse> {
    const { data } = await apiClient.get('contracts', { params: filters });
    return data;
  },

  /**
   * Get single contract by ID with lines and payment schedules
   */
  async getContract(id: string): Promise<Contract> {
    const { data } = await apiClient.get(`contracts/${id}`);
    return data;
  },

  /**
   * Create new contract
   */
  async createContract(data: ContractCreateInput): Promise<Contract> {
    const { data: result } = await apiClient.post('contracts', data);
    return result;
  },

  /**
   * Update contract
   */
  async updateContract(id: string, data: Partial<ContractCreateInput>): Promise<Contract> {
    const { data: result } = await apiClient.put(`contracts/${id}`, data);
    return result;
  },

  /**
   * Patch contract (partial update)
   */
  async patchContract(id: string, data: Partial<ContractCreateInput>): Promise<Contract> {
    const { data: result } = await apiClient.patch(`contracts/${id}`, data);
    return result;
  },

  /**
   * Delete contract (soft delete)
   */
  async deleteContract(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete(`contracts/${id}`);
    return data;
  },

  /**
   * Get contract lines
   */
  async getContractLines(contractId: string): Promise<{ contract_id: string; count: number; lines: ContractLine[] }> {
    const { data } = await apiClient.get(`contracts/${contractId}/lines`);
    return data;
  },

  /**
   * Get payment schedules for a contract
   */
  async getPaymentSchedules(contractId: string): Promise<{ contract_id: string; count: number; schedules: PaymentSchedule[] }> {
    const { data } = await apiClient.get(`contracts/${contractId}/payment-schedules`);
    return data;
  },

  /**
   * Get fulfillment status for a contract
   * Returns detailed breakdown of shipped vs pending quantities per line
   */
  async getFulfillmentStatus(contractId: string): Promise<ContractFulfillmentStatus> {
    const { data } = await apiClient.get(`contracts/${contractId}/fulfillment-status`);
    return data;
  },

  /**
   * Add payment schedule to contract
   */
  async addPaymentSchedule(contractId: string, data: {
    seq: number;
    basis: string;
    days_after?: number;
    percent?: number;
    amount?: number;
    is_deferred?: boolean;
    notes?: string;
  }): Promise<PaymentSchedule> {
    const { data: result } = await apiClient.post(`contracts/${contractId}/payment-schedules`, data);
    return result;
  },

  // ========== AUDIT & SYNC METHODS ==========

  /**
   * Create shipment from contract with all lines
   */
  async createShipmentFromContract(
    contractId: string,
    shipmentData?: {
      sn?: string;
      direction?: string;
      subject?: string;
      created_by?: string;
    },
    splitLines?: Array<{ contract_line_id: string; qty: number }>
  ): Promise<any> {
    const { data } = await apiClient.post(`contracts/${contractId}/create-shipment`, {
      shipment_data: shipmentData || {},
      split_lines: splitLines || [],
    });
    return data;
  },

  /**
   * Get contract-shipment comparison
   */
  async getContractShipmentComparison(contractId: string, shipmentId: string): Promise<any> {
    const { data } = await apiClient.get(`audit-log/contracts/${contractId}/shipments/${shipmentId}/comparison`);
    return data;
  },

  /**
   * Get audit log for contract
   */
  async getContractAuditLog(contractId: string): Promise<any> {
    const { data } = await apiClient.get(`audit-log/contracts/${contractId}/audit-log`);
    return data;
  },

  /**
   * Propose contract update from shipment changes
   */
  async proposeContractUpdate(
    contractId: string,
    shipmentId: string,
    changes: Array<{ line_id: string; field: string; old_value: any; new_value: any; reason?: string }>,
    notes?: string,
    requestedBy?: string
  ): Promise<any> {
    const { data } = await apiClient.post(`contracts/${contractId}/propose-update`, {
      shipment_id: shipmentId,
      changes,
      notes,
      requested_by: requestedBy || 'system',
    });
    return data;
  },

  /**
   * Get pending contract update requests
   */
  async getPendingUpdateRequests(): Promise<any> {
    const { data } = await apiClient.get('contracts/update-requests/pending');
    return data;
  },

  /**
   * Approve contract update request
   */
  async approveContractUpdate(requestId: string, approvedBy?: string): Promise<any> {
    const { data } = await apiClient.post(`contracts/update-requests/${requestId}/approve`, {
      approved_by: approvedBy || 'system',
    });
    return data;
  },

  /**
   * Reject contract update request
   */
  async rejectContractUpdate(requestId: string, rejectionReason: string, approvedBy?: string): Promise<any> {
    const { data } = await apiClient.post(`contracts/update-requests/${requestId}/reject`, {
      rejection_reason: rejectionReason,
      approved_by: approvedBy || 'system',
    });
    return data;
  },
};

export default contractsService;

