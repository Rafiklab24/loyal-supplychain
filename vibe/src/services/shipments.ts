import { apiClient } from './api';
import type { Shipment, PaginatedResponse, ContractShipmentFullComparison } from '../types/api';

export const shipmentsService = {
  // List shipments with filters
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    product?: string;
    sn?: string;
    pol?: string;
    pod?: string;
    branchId?: string; // Filter by final destination branch
    destinationType?: string; // Filter by final destination type (branch, customer, consignment)
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Shipment>> => {
    const { data } = await apiClient.get('/shipments', { params });
    return data;
  },

  // Get single shipment
  getById: async (id: string): Promise<Shipment> => {
    const { data } = await apiClient.get(`/shipments/${id}`);
    return data;
  },

  // Get shipments by contract number
  getBySN: async (sn: string): Promise<{ sn: string; count: number; shipments: Shipment[] }> => {
    const { data } = await apiClient.get(`/shipments/sn/${sn}`);
    return data;
  },

  // Get transfers for shipment
  getTransfers: async (id: string) => {
    const { data } = await apiClient.get(`/shipments/${id}/transfers`);
    return data;
  },

  // Get shipment product lines
  getLines: async (id: string): Promise<{
    shipment_id: string;
    count: number;
    lines: Array<{
      id: string;
      product_name?: string;
      type_of_goods?: string;
      quantity_mt?: number;
      qty?: number;
      unit_price?: number;
      rate_usd_per_mt?: number;
      currency_code?: string;
      amount_usd?: number;
      pricing_method?: string;
      number_of_packages?: number;
      package_size?: number;
      package_size_unit?: string;
    }>;
    total_value?: number;
  }> => {
    const { data } = await apiClient.get(`/shipments/${id}/lines`);
    return data;
  },

  // Add milestone
  addMilestone: async (id: string, milestone: { code: string; notes?: string }) => {
    const { data } = await apiClient.post(`/shipments/${id}/milestone`, milestone);
    return data;
  },

  // Create new shipment
  create: async (shipmentData: Partial<Shipment>): Promise<Shipment> => {
    const { data } = await apiClient.post('/shipments', shipmentData);
    return data;
  },

  // Update existing shipment
  update: async (id: string, shipmentData: Partial<Shipment>): Promise<Shipment> => {
    const { data } = await apiClient.put(`/shipments/${id}`, shipmentData);
    return data;
  },

  // ========== AUDIT & SYNC METHODS ==========

  /**
   * Get audit log for shipment
   */
  getAuditLog: async (id: string): Promise<any> => {
    const { data } = await apiClient.get(`audit-log/shipments/${id}/audit-log`);
    return data;
  },

  /**
   * Delete a single shipment (soft delete)
   */
  delete: async (id: string): Promise<{ success: boolean; message: string; id: string }> => {
    const { data } = await apiClient.delete(`/shipments/${id}`);
    return data;
  },

  /**
   * Bulk delete shipments (soft delete)
   */
  bulkDelete: async (ids: string[]): Promise<{ success: boolean; message: string; count: number }> => {
    const { data } = await apiClient.delete('/shipments/bulk', { data: { ids } });
    return data;
  },

  // ========== STATUS OVERRIDE METHODS ==========

  /**
   * Manually override shipment status
   */
  overrideStatus: async (id: string, status: string, reason: string): Promise<any> => {
    const { data } = await apiClient.post(`/shipments/${id}/override-status`, { status, reason });
    return data;
  },

  /**
   * Clear manual status override and revert to automatic calculation
   */
  clearOverride: async (id: string): Promise<any> => {
    const { data } = await apiClient.post(`/shipments/${id}/clear-override`);
    return data;
  },

  /**
   * Get status history for a shipment
   */
  getStatusHistory: async (id: string): Promise<any> => {
    const { data } = await apiClient.get(`/shipments/${id}/status-history`);
    return data;
  },

  // ========== CONTRACT COMPARISON METHODS ==========

  /**
   * Get full contract vs shipment comparison
   * Compares all fields: parties, commercial terms, logistics, and product lines
   * Returns header-level and line-level variances with audit history
   */
  getContractComparison: async (id: string): Promise<ContractShipmentFullComparison> => {
    const { data } = await apiClient.get(`/shipments/${id}/contract-comparison`);
    return data;
  },
};

// Export convenience functions
export const createShipment = shipmentsService.create;
export const updateShipment = shipmentsService.update;
export const deleteShipment = shipmentsService.delete;
export const bulkDeleteShipments = shipmentsService.bulkDelete;

