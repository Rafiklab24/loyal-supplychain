/**
 * Antrepo (Customs Warehouse) Service
 * API client for antrepo management
 */

import { apiClient } from './api';

// ============================================================
// TYPES
// ============================================================

export interface AntrepoLot {
  id: string;
  antrepo_id: string;
  antrepo_name?: string;
  antrepo_name_ar?: string;
  code: string;
  name: string;
  name_ar?: string;
  description?: string;
  capacity_mt?: number;
  current_occupancy_mt?: number;
  lot_type: 'standard' | 'cold_storage' | 'hazmat' | 'outdoor';
  is_active: boolean;
  sort_order: number;
  item_count?: number;
  created_at: string;
}

export interface AntrepoInventory {
  id: string;
  shipment_id?: string;
  shipment_sn?: string;
  shipment_line_id?: string;
  lot_id: string;
  lot_code?: string;
  lot_name?: string;
  lot_name_ar?: string;
  antrepo_id?: string;
  antrepo_name?: string;
  antrepo_name_ar?: string;
  entry_date: string;
  expected_exit_date?: string;
  entry_declaration_no?: string;
  original_quantity_mt: number;
  current_quantity_mt: number;
  quantity_bags?: number;
  quantity_containers?: number;
  product_text?: string;
  product_gtip?: string;
  origin_country?: string;
  is_third_party: boolean;
  third_party_owner?: string;
  third_party_contact?: string;
  third_party_ref?: string;
  status: 'in_stock' | 'partial_exit' | 'exited' | 'transferred';
  notes?: string;
  supplier_name?: string;
  days_in_antrepo?: number;
  total_exited_mt?: number;
  exit_count?: number;
  created_at: string;
  // Full details (when fetching single item)
  exits?: AntrepoExit[];
  handling_activities?: AntrepoHandlingActivity[];
  storage_fees?: AntrepoStorageFee[];
}

export type ExitType = 'transit' | 'port' | 'domestic';

export interface AntrepoExit {
  id: string;
  inventory_id: string;
  exit_date: string;
  quantity_mt: number;
  quantity_bags?: number;
  exit_type: ExitType;
  // Transit fields
  border_crossing_id?: string;
  border_crossing_name?: string;
  delivery_id?: string;
  transit_destination?: string;
  // Port fields
  destination_port_id?: string;
  destination_port_name?: string;
  vessel_name?: string;
  bl_no?: string;
  export_country?: string;
  // Domestic fields
  beyaname_no?: string;
  beyaname_date?: string;
  tax_amount?: number;
  tax_currency?: string;
  customs_clearing_cost_id?: string;
  // Common
  declaration_no?: string;
  declaration_date?: string;
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  // Related info
  product_text?: string;
  shipment_sn?: string;
  lot_code?: string;
}

export interface AntrepoHandlingActivity {
  id: string;
  inventory_id: string;
  activity_code: string;
  activity_name: string;
  activity_name_ar?: string;
  activity_name_tr?: string;
  performed_date: string;
  performed_by_user_id?: string;
  performed_by_name?: string;
  customs_permission_ref?: string;
  quantity_affected_mt?: number;
  before_description?: string;
  after_description?: string;
  gtip_changed: boolean;
  old_gtip?: string;
  new_gtip?: string;
  may_change_gtip?: boolean;
  notes?: string;
  created_at: string;
  // Related info
  product_text?: string;
  shipment_sn?: string;
  lot_code?: string;
}

export interface AntrepoStorageFee {
  id: string;
  inventory_id: string;
  fee_period_start: string;
  fee_period_end: string;
  days_stored?: number;
  rate_per_day_mt?: number;
  quantity_mt?: number;
  total_amount: number;
  currency: string;
  invoice_no?: string;
  invoice_date?: string;
  payment_status: 'pending' | 'invoiced' | 'paid';
  payment_date?: string;
  notes?: string;
  created_at: string;
  // Related info
  product_text?: string;
  third_party_owner?: string;
  shipment_sn?: string;
}

export interface ActivityType {
  code: string;
  name: string;
  name_ar?: string;
  name_tr?: string;
  description?: string;
  description_ar?: string;
  may_change_gtip: boolean;
  requires_permission: boolean;
  sort_order: number;
}

// Container details from shipment_containers table
export interface ShipmentContainer {
  container_no?: string;
  size_code?: string;
  seal_no?: string;
  gross_weight_kg?: number;
  bags_count?: number;
}

export interface PendingArrival {
  id: string;
  sn: string;
  status: string;
  goes_to_antrepo: boolean;
  assigned_antrepo_id?: string;
  assigned_lot_id?: string;
  antrepo_name?: string;
  antrepo_name_ar?: string;
  lot_code?: string;
  lot_name?: string;
  // Cargo info
  product_text?: string;
  weight_ton?: number;
  container_count?: number;
  bags_count?: number;
  origin_country?: string;
  // Package/Bag details from shipment_lines
  number_of_packages?: number;
  kind_of_packages?: string;
  package_size?: number;
  package_size_unit?: string;
  // Container details
  containers?: ShipmentContainer[];
  // Logistics info
  eta?: string;
  etd?: string;
  pod_id?: string;
  pod_name?: string;
  pol_name?: string;
  booking_no?: string;
  bl_no?: string;
  vessel_name?: string;
  // Party info
  supplier_name?: string;
  supplier_name_ar?: string;
  // Misc
  notes?: string;
  created_at?: string;
  already_entered: boolean;
}

export interface ActivityLogEntry {
  activity_type: string;
  reference_id: string;
  lot_id: string;
  lot_code: string;
  activity_date: string;
  quantity_mt?: number;
  product_text?: string;
  shipment_sn?: string;
  reference_no: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  notes?: string;
}

export interface DashboardSummary {
  total_items: number;
  total_quantity_mt: number;
  third_party_items: number;
  third_party_quantity_mt: number;
  lots_in_use: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  by_lot: Array<{
    lot_id: string;
    lot_code: string;
    lot_name: string;
    capacity_mt?: number;
    item_count: number;
    current_quantity_mt: number;
  }>;
  recent_exits: Array<{
    exit_type: ExitType;
    exit_count: number;
    total_quantity_mt: number;
  }>;
  pending_arrivals_count: number;
}

// ============================================================
// INPUT TYPES
// ============================================================

export interface CreateLotInput {
  antrepo_id: string;
  code: string;
  name: string;
  name_ar?: string;
  description?: string;
  capacity_mt?: number;
  lot_type?: 'standard' | 'cold_storage' | 'hazmat' | 'outdoor';
  sort_order?: number;
}

export interface UpdateLotInput {
  code?: string;
  name?: string;
  name_ar?: string;
  description?: string;
  capacity_mt?: number;
  lot_type?: 'standard' | 'cold_storage' | 'hazmat' | 'outdoor';
  is_active?: boolean;
  sort_order?: number;
}

export interface CreateInventoryInput {
  shipment_id?: string;
  shipment_line_id?: string;
  lot_id: string;
  entry_date?: string;
  expected_exit_date?: string;
  entry_declaration_no?: string;
  original_quantity_mt: number;
  quantity_bags?: number;
  quantity_containers?: number;
  product_text?: string;
  product_gtip?: string;
  origin_country?: string;
  is_third_party?: boolean;
  third_party_owner?: string;
  third_party_contact?: string;
  third_party_ref?: string;
  notes?: string;
}

export interface UpdateInventoryInput {
  lot_id?: string;
  expected_exit_date?: string;
  entry_declaration_no?: string;
  product_gtip?: string;
  is_third_party?: boolean;
  third_party_owner?: string;
  third_party_contact?: string;
  third_party_ref?: string;
  notes?: string;
}

export interface TransferInventoryInput {
  target_lot_id: string;
  quantity_mt: number;
  notes?: string;
}

interface BaseExitInput {
  inventory_id: string;
  exit_date?: string;
  quantity_mt: number;
  quantity_bags?: number;
  declaration_no?: string;
  declaration_date?: string;
  notes?: string;
}

export interface TransitExitInput extends BaseExitInput {
  exit_type: 'transit';
  border_crossing_id?: string;
  delivery_id?: string;
  transit_destination?: string;
}

export interface PortExitInput extends BaseExitInput {
  exit_type: 'port';
  destination_port_id?: string;
  vessel_name?: string;
  bl_no?: string;
  export_country?: string;
}

export interface DomesticExitInput extends BaseExitInput {
  exit_type: 'domestic';
  beyaname_no?: string;
  beyaname_date?: string;
  tax_amount?: number;
  tax_currency?: string;
  customs_clearing_cost_id?: string;
}

export type CreateExitInput = TransitExitInput | PortExitInput | DomesticExitInput;

export interface CreateHandlingActivityInput {
  inventory_id: string;
  activity_code: string;
  activity_name?: string;
  activity_name_ar?: string;
  performed_date?: string;
  performed_by_user_id?: string;
  customs_permission_ref?: string;
  quantity_affected_mt?: number;
  before_description?: string;
  after_description?: string;
  gtip_changed?: boolean;
  old_gtip?: string;
  new_gtip?: string;
  notes?: string;
}

export interface CreateStorageFeeInput {
  inventory_id: string;
  fee_period_start: string;
  fee_period_end: string;
  rate_per_day_mt?: number;
  quantity_mt?: number;
  total_amount: number;
  currency?: string;
  invoice_no?: string;
  invoice_date?: string;
  payment_status?: 'pending' | 'invoiced' | 'paid';
  notes?: string;
}

export interface UpdateStorageFeeInput {
  invoice_no?: string;
  invoice_date?: string;
  payment_status?: 'pending' | 'invoiced' | 'paid';
  payment_date?: string;
  notes?: string;
}

// ============================================================
// FILTER TYPES
// ============================================================

export interface InventoryFilters {
  lot_id?: string;
  antrepo_id?: string;
  status?: 'in_stock' | 'partial_exit' | 'exited' | 'transferred';
  is_third_party?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ExitsFilters {
  inventory_id?: string;
  exit_type?: ExitType;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface ActivityLogFilters {
  antrepo_id?: string;
  lot_id?: string;
  activity_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// ============================================================
// API FUNCTIONS
// ============================================================

const BASE_URL = '/antrepo';

// Dashboard
export const getDashboard = async (antrepo_id?: string): Promise<DashboardData> => {
  const params = antrepo_id ? { antrepo_id } : {};
  const response = await apiClient.get(`${BASE_URL}/dashboard`, { params });
  return response.data.data;
};

// Lots
export const getLots = async (antrepo_id?: string, include_inactive?: boolean): Promise<AntrepoLot[]> => {
  const params: Record<string, any> = {};
  if (antrepo_id) params.antrepo_id = antrepo_id;
  if (include_inactive) params.include_inactive = 'true';
  const response = await apiClient.get(`${BASE_URL}/lots`, { params });
  return response.data.data;
};

export const createLot = async (data: CreateLotInput): Promise<AntrepoLot> => {
  const response = await apiClient.post(`${BASE_URL}/lots`, data);
  return response.data.data;
};

export const updateLot = async (id: string, data: UpdateLotInput): Promise<AntrepoLot> => {
  const response = await apiClient.put(`${BASE_URL}/lots/${id}`, data);
  return response.data.data;
};

// Inventory
export const getInventory = async (filters: InventoryFilters = {}): Promise<{
  data: AntrepoInventory[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> => {
  const response = await apiClient.get(`${BASE_URL}/inventory`, { params: filters });
  return response.data;
};

export const getInventoryItem = async (id: string): Promise<AntrepoInventory> => {
  const response = await apiClient.get(`${BASE_URL}/inventory/${id}`);
  return response.data.data;
};

export const createInventory = async (data: CreateInventoryInput): Promise<AntrepoInventory> => {
  const response = await apiClient.post(`${BASE_URL}/inventory`, data);
  return response.data.data;
};

export const updateInventory = async (id: string, data: UpdateInventoryInput): Promise<AntrepoInventory> => {
  const response = await apiClient.put(`${BASE_URL}/inventory/${id}`, data);
  return response.data.data;
};

export const transferInventory = async (id: string, data: TransferInventoryInput): Promise<{ message: string }> => {
  const response = await apiClient.post(`${BASE_URL}/inventory/${id}/transfer`, data);
  return response.data;
};

export const deleteInventory = async (id: string): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/inventory/${id}`);
};

// Exits
export const getExits = async (filters: ExitsFilters = {}): Promise<{
  data: AntrepoExit[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> => {
  const response = await apiClient.get(`${BASE_URL}/exits`, { params: filters });
  return response.data;
};

export const getExit = async (id: string): Promise<AntrepoExit> => {
  const response = await apiClient.get(`${BASE_URL}/exits/${id}`);
  return response.data.data;
};

export const createExit = async (data: CreateExitInput): Promise<AntrepoExit> => {
  const response = await apiClient.post(`${BASE_URL}/exits`, data);
  return response.data.data;
};

// Handling Activities
export const getHandlingActivities = async (inventory_id?: string, activity_code?: string): Promise<AntrepoHandlingActivity[]> => {
  const params: Record<string, any> = {};
  if (inventory_id) params.inventory_id = inventory_id;
  if (activity_code) params.activity_code = activity_code;
  const response = await apiClient.get(`${BASE_URL}/handling`, { params });
  return response.data.data;
};

export const getActivityTypes = async (): Promise<ActivityType[]> => {
  const response = await apiClient.get(`${BASE_URL}/handling/activity-types`);
  return response.data.data;
};

export const createHandlingActivity = async (data: CreateHandlingActivityInput): Promise<AntrepoHandlingActivity> => {
  const response = await apiClient.post(`${BASE_URL}/handling`, data);
  return response.data.data;
};

// Storage Fees
export const getStorageFees = async (inventory_id?: string, payment_status?: string): Promise<AntrepoStorageFee[]> => {
  const params: Record<string, any> = {};
  if (inventory_id) params.inventory_id = inventory_id;
  if (payment_status) params.payment_status = payment_status;
  const response = await apiClient.get(`${BASE_URL}/fees`, { params });
  return response.data.data;
};

export const createStorageFee = async (data: CreateStorageFeeInput): Promise<AntrepoStorageFee> => {
  const response = await apiClient.post(`${BASE_URL}/fees`, data);
  return response.data.data;
};

export const updateStorageFee = async (id: string, data: UpdateStorageFeeInput): Promise<AntrepoStorageFee> => {
  const response = await apiClient.put(`${BASE_URL}/fees/${id}`, data);
  return response.data.data;
};

// Pending Arrivals
export const getPendingArrivals = async (antrepo_id?: string): Promise<PendingArrival[]> => {
  const params = antrepo_id ? { antrepo_id } : {};
  const response = await apiClient.get(`${BASE_URL}/pending-arrivals`, { params });
  return response.data.data;
};

// Activity Log
export const getActivityLog = async (filters: ActivityLogFilters = {}): Promise<ActivityLogEntry[]> => {
  const response = await apiClient.get(`${BASE_URL}/activity-log`, { params: filters });
  return response.data.data;
};

// Helper functions
export const getExitTypeLabel = (type: ExitType, lang: 'en' | 'ar' = 'en'): string => {
  const labels: Record<ExitType, { en: string; ar: string }> = {
    transit: { en: 'Transit (Border)', ar: 'ترانزيت (الحدود)' },
    port: { en: 'Port (Re-export)', ar: 'ميناء (إعادة تصدير)' },
    domestic: { en: 'Domestic (Beyaname)', ar: 'محلي (بيانامة)' },
  };
  return labels[type]?.[lang] || type;
};

export const getStatusLabel = (status: string, lang: 'en' | 'ar' = 'en'): string => {
  const labels: Record<string, { en: string; ar: string }> = {
    in_stock: { en: 'In Stock', ar: 'في المخزون' },
    partial_exit: { en: 'Partial Exit', ar: 'خروج جزئي' },
    exited: { en: 'Exited', ar: 'تم الخروج' },
    transferred: { en: 'Transferred', ar: 'تم النقل' },
  };
  return labels[status]?.[lang] || status;
};

export const getLotTypeLabel = (type: string, lang: 'en' | 'ar' = 'en'): string => {
  const labels: Record<string, { en: string; ar: string }> = {
    standard: { en: 'Standard', ar: 'قياسي' },
    cold_storage: { en: 'Cold Storage', ar: 'تبريد' },
    hazmat: { en: 'Hazardous Materials', ar: 'مواد خطرة' },
    outdoor: { en: 'Outdoor', ar: 'خارجي' },
  };
  return labels[type]?.[lang] || type;
};

// Archive inventory entry (revert the operation)
export interface ArchiveInventoryInput {
  reason?: string;
}

export interface ArchiveInventoryResponse {
  success: boolean;
  message: string;
  archived_inventory_id: string;
  reverted_shipment_id?: string;
}

export const archiveInventory = async (id: string, data?: ArchiveInventoryInput): Promise<ArchiveInventoryResponse> => {
  const response = await apiClient.post(`${BASE_URL}/inventory/${id}/archive`, data || {});
  return response.data;
};

// User's accessible warehouses
export interface UserWarehouse {
  id: string;
  name: string;
  name_ar: string;
}

export interface UserWarehousesResponse {
  data: UserWarehouse[];
  hasGlobalAccess: boolean;
}

export const getMyWarehouses = async (): Promise<UserWarehousesResponse> => {
  const response = await apiClient.get(`${BASE_URL}/my-warehouses`);
  return response.data;
};
