/**
 * Inventory Service
 * API client for FB Interface (Final Beneficiary/Branch inventory)
 */

import { apiClient } from './api';

// ============================================================
// TYPES
// ============================================================

export interface CostBreakdown {
  purchase_price: number;
  customs_clearing: number;
  internal_transport: number;
  external_freight: number;
  total_landed_cost: number;
  customs_costs_detail?: CustomsCost[];
  transport_detail?: TransportDelivery[];
}

export interface CustomsCost {
  id: string;
  file_number: string;
  cost_description: string;
  total_clearing_cost: number;
  clearance_type: string;
  clearance_date: string;
}

export interface TransportDelivery {
  id: string;
  delivery_number: string;
  destination: string;
  transport_cost: number;
  delivery_date: string;
  status: string;
}

export interface FinalDestination {
  branch_id?: string;
  warehouse_id?: string;
  delivery_place?: string;
  name?: string;
  address?: string;
}

export interface LatestIncident {
  id: string;
  status: 'draft' | 'submitted' | 'under_review' | 'action_set' | 'closed';
  issue_type: string;
  samples_completed: number;
  created_at: string;
}

export interface InventoryShipment {
  id: string;
  sn: string;
  status: string;
  hold_status: boolean;
  hold_reason: string | null;
  supplier_name: string;
  product_text: string;
  weight_ton: number;
  container_count: number;
  bags_count: number;
  origin_country: string;
  pol_name: string;
  pod_name: string;
  eta: string;
  final_destination: FinalDestination | null;
  purchase_price: number;
  costs: CostBreakdown;
  delivery_confirmed_at: string | null;
  delivery_has_issues: boolean;
  quality_incident_count: number;
  latest_incident: LatestIncident | null;
}

export interface SupplierStats {
  supplier_name: string;
  total_deliveries: number;
  successful: number;
  partial_issues: number;
  major_issues: number;
  rejected: number;
  success_rate: number | null;
}

// ============================================================
// SORT OPTIONS
// ============================================================

export type SortOption = 
  | 'eta_asc'      // Earliest arrival first
  | 'eta_desc'     // Latest arrival first
  | 'weight_desc'  // Biggest shipment first
  | 'weight_asc'   // Smallest shipment first
  | 'price_desc'   // Highest value first
  | 'price_asc'    // Lowest value first
  | 'newest'       // Most recent first
  | 'oldest';      // Oldest first

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Branch information for filtering
 */
export interface BranchInfo {
  id: string;
  name: string;
  name_ar?: string;
  branch_type?: string;
  city?: string;
}

/**
 * Get branches accessible to current user for warehouse filtering
 */
export async function getMyBranches(): Promise<{
  branches: BranchInfo[];
  has_global_access: boolean;
  total: number;
}> {
  const response = await apiClient.get('/inventory/my-branches');
  return response.data;
}

/**
 * Get shipments for the current user's branch
 */
export async function getInventoryShipments(params?: {
  status?: string;
  search?: string;
  delivered?: boolean;
  sort?: SortOption;
  branch_id?: string;
}): Promise<{ shipments: InventoryShipment[]; total: number }> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.delivered !== undefined) queryParams.append('delivered', String(params.delivered));
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.branch_id) queryParams.append('branch_id', params.branch_id);
  
  const queryString = queryParams.toString();
  const url = `/inventory/shipments${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiClient.get(url);
  return response.data;
}

/**
 * Get single shipment with full details and costs
 */
export async function getInventoryShipment(id: string): Promise<{ shipment: InventoryShipment }> {
  const response = await apiClient.get(`/inventory/shipments/${id}`);
  return response.data;
}

/**
 * Get detailed cost breakdown for a shipment
 */
export async function getShipmentCosts(id: string): Promise<{
  summary: CostBreakdown;
  details: {
    customs_clearing: CustomsCost[];
    internal_transport: TransportDelivery[];
  };
}> {
  const response = await apiClient.get(`/inventory/shipments/${id}/costs`);
  return response.data;
}

/**
 * Mark shipment as delivered
 */
export async function markShipmentDelivered(
  id: string, 
  hasIssues: boolean
): Promise<{
  success: boolean;
  message: string;
  shipment_id: string;
  has_issues: boolean;
  hold_applied: boolean;
}> {
  const response = await apiClient.post(`/inventory/shipments/${id}/delivered`, {
    has_issues: hasIssues
  });
  return response.data;
}

/**
 * Get supplier delivery statistics
 */
export async function getSupplierStats(supplierId: string): Promise<SupplierStats> {
  const response = await apiClient.get(`/inventory/supplier-stats/${supplierId}`);
  return response.data;
}

