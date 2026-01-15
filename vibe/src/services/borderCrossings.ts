import { apiClient } from './api';

// ============================================================
// TYPES
// ============================================================

export interface BorderCrossing {
  id: string;
  name: string;
  name_ar: string | null;
  country_from: string;
  country_to: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBorderCrossingData {
  name: string;
  name_ar?: string | null;
  country_from: string;
  country_to: string;
  location?: string | null;
  is_active?: boolean;
}

export interface UpdateBorderCrossingData {
  name?: string;
  name_ar?: string | null;
  country_from?: string;
  country_to?: string;
  location?: string | null;
  is_active?: boolean;
}

export interface BorderCrossingsFilters {
  country_from?: string;
  country_to?: string;
  is_active?: boolean;
  search?: string;
}

export interface BorderCrossingsResponse {
  success: boolean;
  data: BorderCrossing[];
  total: number;
}

export interface BorderCrossingResponse {
  success: boolean;
  data: BorderCrossing;
  message?: string;
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Get all border crossings with optional filters
 */
export async function getBorderCrossings(
  filters?: BorderCrossingsFilters
): Promise<BorderCrossingsResponse> {
  const params = new URLSearchParams();
  
  if (filters?.country_from) params.append('country_from', filters.country_from);
  if (filters?.country_to) params.append('country_to', filters.country_to);
  if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
  if (filters?.search) params.append('search', filters.search);

  const queryString = params.toString();
  const url = `/border-crossings${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiClient.get<BorderCrossingsResponse>(url);
  return response.data;
}

/**
 * Get a single border crossing by ID
 */
export async function getBorderCrossing(id: string): Promise<BorderCrossingResponse> {
  const response = await apiClient.get<BorderCrossingResponse>(`/border-crossings/${id}`);
  return response.data;
}

/**
 * Get border crossings for a specific route (e.g., Turkey to Iraq)
 */
export async function getBorderCrossingsByRoute(
  countryFrom: string,
  countryTo: string
): Promise<BorderCrossingsResponse> {
  const response = await apiClient.get<BorderCrossingsResponse>(
    `/border-crossings/by-route/${encodeURIComponent(countryFrom)}/${encodeURIComponent(countryTo)}`
  );
  return response.data;
}

/**
 * Create a new border crossing (Admin only)
 */
export async function createBorderCrossing(
  data: CreateBorderCrossingData
): Promise<BorderCrossingResponse> {
  const response = await apiClient.post<BorderCrossingResponse>('/border-crossings', data);
  return response.data;
}

/**
 * Update an existing border crossing (Admin only)
 */
export async function updateBorderCrossing(
  id: string,
  data: UpdateBorderCrossingData
): Promise<BorderCrossingResponse> {
  const response = await apiClient.put<BorderCrossingResponse>(`/border-crossings/${id}`, data);
  return response.data;
}

/**
 * Delete/deactivate a border crossing (Admin only)
 */
export async function deleteBorderCrossing(id: string): Promise<{
  success: boolean;
  message: string;
  deleted?: boolean;
  deactivated?: boolean;
}> {
  const response = await apiClient.delete(`/border-crossings/${id}`);
  return response.data;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get display name based on language
 */
export function getBorderCrossingDisplayName(
  borderCrossing: BorderCrossing,
  language: string
): string {
  if (language === 'ar' && borderCrossing.name_ar) {
    return borderCrossing.name_ar;
  }
  return borderCrossing.name;
}

/**
 * Format border crossing for dropdown display
 */
export function formatBorderCrossingOption(
  borderCrossing: BorderCrossing,
  language: string
): string {
  const name = getBorderCrossingDisplayName(borderCrossing, language);
  return `${name} (${borderCrossing.country_from} → ${borderCrossing.country_to})`;
}

/**
 * Common countries for filtering
 */
export const COMMON_COUNTRIES = [
  'Turkey',
  'Iraq',
  'Syria',
  'Iran',
  'Bulgaria',
  'Greece',
  'Georgia',
];

// ============================================================
// BORDER SHIPMENTS TYPES & API
// ============================================================

export interface BorderDelivery {
  id: string;
  delivery_number: string;
  status: string;
  driver_name: string | null;
  truck_plate_number: string | null;
  transport_company_name: string | null;
  border_eta: string | null;
  border_crossing_id: string | null;
  delivery_leg: string | null;
  delivery_date: string | null;
  transport_cost: number | null;
}

export interface BorderShipment {
  id: string;
  sn: string;
  shipment_status: string;
  transaction_type: string;
  border_stage: string | null;
  calculated_stage: string | null;
  border_arrival_date: string | null;
  border_clearance_date: string | null;
  product_text: string | null;
  weight_ton: number | null;
  container_count: number | null;
  customs_clearance_date: string | null;
  is_cross_border: boolean;
  primary_border_crossing_id: string | null;
  eta: string | null;
  border_crossing_name: string | null;
  border_crossing_name_ar: string | null;
  border_country_from: string | null;
  border_country_to: string | null;
  pol_name: string | null;
  pod_name: string | null;
  pod_id: string | null;
  final_destination: unknown;
  final_destination_place: string | null;
  final_destination_branch_id: string | null;
  supplier_name: string | null;
  delivery_count: number;
  deliveries: BorderDelivery[];
  earliest_border_eta: string | null;
  border_clearance_cost: number;
}

export interface BorderShipmentSummary {
  pending_at_pod: number;
  on_the_way: number;
  arrived_at_border: number;
  clearing: number;
  cleared: number;
}

export interface BorderShipmentsFilters {
  stage?: 'pending_at_pod' | 'on_the_way' | 'arrived_at_border' | 'clearing' | 'cleared';
  border_crossing_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface BorderShipmentsResponse {
  success: boolean;
  data: BorderShipment[];
  summary: BorderShipmentSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface BorderCostsData {
  border_clearance_cost: number;
  internal_transport_cost?: number;
  notes?: string;
  currency?: string;
}

/**
 * Get border shipments for border agent interface
 */
export async function getBorderShipments(
  filters?: BorderShipmentsFilters
): Promise<BorderShipmentsResponse> {
  const params = new URLSearchParams();
  
  if (filters?.stage) params.append('stage', filters.stage);
  if (filters?.border_crossing_id) params.append('border_crossing_id', filters.border_crossing_id);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const queryString = params.toString();
  const url = `/border-crossings/border-shipments${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiClient.get<BorderShipmentsResponse>(url);
  return response.data;
}

/**
 * Get single border shipment details
 */
export async function getBorderShipment(id: string): Promise<{ success: boolean; data: BorderShipment }> {
  const response = await apiClient.get(`/border-crossings/border-shipments/${id}`);
  return response.data;
}

/**
 * Update border shipment stage
 */
export async function updateBorderStage(
  shipmentId: string,
  stage: string,
  notes?: string
): Promise<{ success: boolean; data: unknown; message: string }> {
  const response = await apiClient.patch(`/border-crossings/border-shipments/${shipmentId}/stage`, {
    stage,
    notes,
  });
  return response.data;
}

/**
 * Enter border costs for a shipment
 */
export async function enterBorderCosts(
  shipmentId: string,
  data: BorderCostsData
): Promise<{ success: boolean; data: unknown; message: string }> {
  const response = await apiClient.post(`/border-crossings/border-shipments/${shipmentId}/costs`, data);
  return response.data;
}

