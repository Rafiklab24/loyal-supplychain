import { apiClient } from './api';
import type {
  CustomsClearingCost,
  CustomsClearingCostFilters,
  CustomsClearingCostSummary,
  CustomsClearingCostsResponse,
  PendingClearanceFilters,
  PendingClearancesResponse,
  CreateCostFromPendingInput,
} from '../types/api';

const BASE_URL = '/v1/customs-clearing-costs';

/**
 * Customs Clearing Costs API Service
 */

/**
 * Fetch list of customs clearing costs with filters
 */
export async function fetchCustomsClearingCosts(
  filters: CustomsClearingCostFilters = {}
): Promise<CustomsClearingCostsResponse> {
  const response = await apiClient.get(BASE_URL, { params: filters });
  return response.data;
}

/**
 * Fetch single customs clearing cost by ID
 */
export async function fetchCustomsClearingCostById(id: string): Promise<CustomsClearingCost> {
  const response = await apiClient.get(`${BASE_URL}/${id}`);
  return response.data;
}

/**
 * Create new customs clearing cost
 */
export async function createCustomsClearingCost(
  data: Partial<CustomsClearingCost>
): Promise<CustomsClearingCost> {
  const response = await apiClient.post(BASE_URL, data);
  return response.data;
}

/**
 * Update existing customs clearing cost
 */
export async function updateCustomsClearingCost(
  id: string,
  data: Partial<CustomsClearingCost>
): Promise<CustomsClearingCost> {
  const response = await apiClient.put(`${BASE_URL}/${id}`, data);
  return response.data;
}

/**
 * Delete (soft delete) customs clearing cost
 */
export async function deleteCustomsClearingCost(id: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/${id}`);
}

/**
 * Fetch summary statistics
 */
export async function fetchCustomsClearingCostsSummary(): Promise<CustomsClearingCostSummary> {
  const response = await apiClient.get(`${BASE_URL}/summary`);
  return response.data;
}

/**
 * Export customs clearing costs to Excel
 * Returns a Blob that can be downloaded
 */
export async function exportCustomsClearingCosts(
  filters: Omit<CustomsClearingCostFilters, 'page' | 'limit'> = {}
): Promise<Blob> {
  const response = await apiClient.get(`${BASE_URL}/export`, {
    params: filters,
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Download Excel file
 */
export function downloadExcelFile(blob: Blob, filename: string = 'customs_clearing_costs.xlsx'): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Export and download customs clearing costs
 */
export async function exportAndDownloadCustomsClearingCosts(
  filters: Omit<CustomsClearingCostFilters, 'page' | 'limit'> = {}
): Promise<void> {
  const blob = await exportCustomsClearingCosts(filters);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `customs_clearing_costs_${timestamp}.xlsx`;
  downloadExcelFile(blob, filename);
}

/**
 * Fetch shipments with clearance date but no cost entry yet
 */
export async function fetchPendingClearances(
  filters: PendingClearanceFilters = {}
): Promise<PendingClearancesResponse> {
  const response = await apiClient.get(`${BASE_URL}/pending-clearances`, { params: filters });
  return response.data;
}

/**
 * Create customs clearing cost from pending shipment
 */
export async function createCostFromPending(
  data: CreateCostFromPendingInput
): Promise<CustomsClearingCost> {
  const response = await apiClient.post(`${BASE_URL}/from-pending`, data);
  return response.data;
}

/**
 * Fetch customs clearing costs by shipment ID
 */
export async function fetchCustomsClearingCostsByShipment(
  shipmentId: string
): Promise<CustomsClearingCost[]> {
  const response = await apiClient.get(BASE_URL, { 
    params: { shipment_id: shipmentId, limit: 100 } 
  });
  return response.data?.data || [];
}

/**
 * Search shipments by BOL or Shipment ID for linking
 */
export interface ShipmentSearchResult {
  id: string;
  sn: string;
  product_text: string;
  subject: string | null;
  bl_no: string | null;
  booking_no: string | null;
  customs_clearance_date: string | null;
  weight_ton: number | null;
  container_count: number | null;
  status: string | null;
  direction: 'incoming' | 'outgoing';
  eta: string | null;
  total_value_usd: number | null;
  pol_name: string | null;
  pol_country: string | null;
  pod_name: string | null;
  pod_country: string | null;
  shipping_line_name: string | null;
  supplier_name: string | null;
  final_beneficiary_name: string | null;
  has_cost_entry: boolean;
}

export async function searchShipmentsForLinking(
  query: string
): Promise<{ data: ShipmentSearchResult[] }> {
  const response = await apiClient.get(`${BASE_URL}/search-shipments`, {
    params: { q: query },
  });
  return response.data;
}

