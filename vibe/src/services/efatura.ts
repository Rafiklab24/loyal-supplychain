/**
 * E-Fatura Service
 * API client for Turkish electronic invoice (E-Fatura) functionality
 */

import { apiClient } from './api';

export interface EFaturaDelivery {
  id: string;
  delivery_number: string | null;
  delivery_date: string | null;
  truck_plate_number: string | null;
  origin: string | null;
  destination: string | null;
  route: string;
  weight_kg: number | null;
  gross_weight_kg: number | null;
  net_weight_kg: number | null;
  container_number: string | null;
  driver_name: string | null;
  transport_company_name: string | null;
  status: string | null;
}

export interface EFaturaContainer {
  id: string;
  container_number: string | null;
  gross_weight_kg: number | null;
  net_weight_kg: number | null;
  package_count: number | null;
  seal_number: string | null;
}

export interface EFaturaDocument {
  id: string;
  filename: string;
  original_filename: string | null;
  file_size: number | null;
  upload_ts: string;
  uploaded_by: string | null;
}

export interface EFaturaShipment {
  id: string;
  commercial_invoice_number: string; // This is the shipment SN
  customs_clearance_date: string;
  contract_id: string | null;
  e_fatura_number: string | null;
  e_fatura_created_at: string | null;
  // Transaction type (incoming/outgoing)
  transaction_type: 'incoming' | 'outgoing';
  // Cross-border status (determines if E-Fatura is mandatory)
  is_cross_border: boolean;
  e_fatura_required: boolean;
  // Archive status (for archive view)
  archive_status?: 'completed' | 'not_required' | 'pending' | 'sale_pending';
  // Supplier
  supplier_id: string | null;
  supplier_name: string | null;
  // Buyer (from contract)
  buyer_id: string | null;
  buyer_name: string | null;
  // Weight
  net_weight_kg: number | null;
  gross_weight_kg: number | null;
  weight_ton: number | null;
  // Value
  total_value_usd: number | null;
  currency_code: string | null;
  // Package
  package_count: number | null;
  // Origin
  country_of_origin: string | null;
  // Ports
  pol_name: string | null;
  pod_name: string | null;
  // Internal route (POD → Final Destination)
  final_destination_place: string | null;
  final_destination_branch_id: string | null;
  // Product
  product_text: string | null;
  // Deliveries
  deliveries?: EFaturaDelivery[];
  delivery_count: number;
  // Containers (for when no deliveries exist yet)
  containers?: EFaturaContainer[];
  container_count: number;
  // E-Fatura documents (for download)
  e_fatura_documents?: EFaturaDocument[];
}

export interface EFaturaPendingResponse {
  data: EFaturaShipment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface EFaturaPendingParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface EFaturaArchiveParams {
  page?: number;
  limit?: number;
  search?: string;
  cross_border_only?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface EFaturaSummary {
  pending: number;
  archive: number;
  completed: number;
  not_required: number;
  sales_pending?: number;
}

// ========== BEYANAME TYPES ==========

export interface BeyanameDocument {
  id: string;
  file_name: string;
  document_type: string;
  created_at: string;
}

export interface BeyanameShipment {
  id: string;
  commercial_invoice_number: string;
  subject: string | null;
  status: string;
  transaction_type: string;
  // Dates
  customs_clearance_date: string | null;
  eta: string | null;
  etd: string | null;
  // Beyaname fields
  beyaname_number: string | null;
  beyaname_date: string | null;
  beyaname_status: 'pending' | 'issued' | 'completed';
  beyaname_created_at: string | null;
  // Antrepo info
  antrepo_id: string | null;
  antrepo_name: string | null;
  antrepo_name_ar: string | null;
  final_destination_name: string | null;
  // Supplier
  supplier_id: string | null;
  supplier_name: string | null;
  // Cargo
  product_text: string | null;
  weight_kg: number | null;
  weight_ton: number | null;
  // Ports
  pol_name: string | null;
  pol_country: string | null;
  pod_name: string | null;
  pod_country: string | null;
  // Contract
  contract_id: string | null;
  contract_no: string | null;
  // Financial
  total_value_usd: number | null;
  currency_code: string | null;
  // Counts
  container_count: number;
  // Documents
  beyaname_documents: BeyanameDocument[];
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface BeyanamePendingResponse {
  data: BeyanameShipment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface BeyanamePendingParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'pending' | 'issued' | 'completed' | 'all';
}

export interface BeyanameSummary {
  pending: number;
  issued: number;
  completed: number;
  total: number;
}

/**
 * Get E-Fatura summary counts for tabs
 */
export async function getEFaturaSummary(): Promise<EFaturaSummary> {
  const response = await apiClient.get<EFaturaSummary>('/e-fatura/summary');
  return response.data;
}

/**
 * Get pending E-Fatura shipments (cross-border shipments that need E-Fatura)
 */
export async function getPendingEFatura(params: EFaturaPendingParams = {}): Promise<EFaturaPendingResponse> {
  const response = await apiClient.get<EFaturaPendingResponse>('/e-fatura/pending', { params });
  return response.data;
}

/**
 * Get archived E-Fatura shipments (completed + non-cross-border)
 */
export async function getArchiveEFatura(params: EFaturaArchiveParams = {}): Promise<EFaturaPendingResponse> {
  const response = await apiClient.get<EFaturaPendingResponse>('/e-fatura/archive', { params });
  return response.data;
}

/**
 * Get single shipment E-Fatura details
 */
export async function getEFaturaDetails(shipmentId: string): Promise<EFaturaShipment> {
  const response = await apiClient.get<EFaturaShipment>(`/e-fatura/${shipmentId}`);
  return response.data;
}

/**
 * Save E-Fatura number for a shipment
 */
export async function saveEFaturaNumber(shipmentId: string, eFaturaNumber: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.put<{ success: boolean; message: string }>(`/e-fatura/${shipmentId}`, {
    e_fatura_number: eFaturaNumber,
  });
  return response.data;
}

/**
 * Clear E-Fatura number (mark as pending again)
 */
export async function clearEFaturaNumber(shipmentId: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(`/e-fatura/${shipmentId}`);
  return response.data;
}

// ========== BEYANAME API FUNCTIONS ==========

/**
 * Get Beyaname summary counts
 */
export async function getBeyanameSummary(): Promise<BeyanameSummary> {
  const response = await apiClient.get<BeyanameSummary>('/e-fatura/beyaname/summary');
  return response.data;
}

/**
 * Get pending Beyaname shipments (imports to Antrepo)
 */
export async function getBeyanamePending(params: BeyanamePendingParams = {}): Promise<BeyanamePendingResponse> {
  const response = await apiClient.get<BeyanamePendingResponse>('/e-fatura/beyaname/pending', { params });
  return response.data;
}

/**
 * Save Beyaname number for a shipment
 */
export async function saveBeyaname(
  shipmentId: string, 
  beyanameNumber: string, 
  beyanameDate?: string
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.put<{ success: boolean; message: string }>(`/e-fatura/beyaname/${shipmentId}`, {
    beyaname_number: beyanameNumber,
    beyaname_date: beyanameDate,
  });
  return response.data;
}

/**
 * Update Beyaname status
 */
export async function updateBeyanameStatus(
  shipmentId: string, 
  status: 'pending' | 'issued' | 'completed'
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.patch<{ success: boolean; message: string }>(
    `/e-fatura/beyaname/${shipmentId}/status`,
    { status }
  );
  return response.data;
}

/**
 * Clear Beyaname (mark as pending again)
 */
export async function clearBeyaname(shipmentId: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(`/e-fatura/beyaname/${shipmentId}`);
  return response.data;
}

export default {
  // E-Fatura
  getEFaturaSummary,
  getPendingEFatura,
  getArchiveEFatura,
  getEFaturaDetails,
  saveEFaturaNumber,
  clearEFaturaNumber,
  // Beyaname
  getBeyanameSummary,
  getBeyanamePending,
  saveBeyaname,
  updateBeyanameStatus,
  clearBeyaname,
};
