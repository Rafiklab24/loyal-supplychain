/**
 * Elleçleme (Handling) Service
 * API client for Elleçleme management
 */

import { apiClient } from './api';

// ============================================================
// TYPES
// ============================================================

export type ElleclemeStatus = 
  | 'draft' 
  | 'pending_permit' 
  | 'approved' 
  | 'in_progress' 
  | 'pending_confirmation'
  | 'completed' 
  | 'cancelled' 
  | 'rejected';

export type PermitStatus = 
  | 'draft' 
  | 'submitted' 
  | 'approved' 
  | 'rejected' 
  | 'expired';

export type CostType = 
  | 'labor' 
  | 'materials' 
  | 'external_service' 
  | 'equipment' 
  | 'lab_testing' 
  | 'other';

export type DocumentType = 
  | 'permit_application' 
  | 'permit_approval' 
  | 'photo_before' 
  | 'photo_after' 
  | 'lab_report' 
  | 'tutanak' 
  | 'other';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface ElleclemeRequest {
  id: string;
  request_number: string;
  inventory_id: string;
  activity_code: string;
  activity_name?: string;
  activity_name_ar?: string;
  activity_name_tr?: string;
  status: ElleclemeStatus;
  priority: Priority;
  quantity_mt?: number;
  quantity_bags?: number;
  reason?: string;
  description?: string;
  customer_requirement?: string;
  original_gtip?: string;
  gtip_may_change: boolean;
  new_gtip?: string;
  gtip_changed: boolean;
  requested_date: string;
  planned_execution_date?: string;
  actual_start_date?: string;
  actual_completion_date?: string;
  before_description?: string;
  after_description?: string;
  cancelled_reason?: string;
  rejected_reason?: string;
  executed_by_user_id?: string;
  execution_notes?: string;
  // Inventory info
  product_text?: string;
  origin_country?: string;
  inventory_entry_date?: string;
  inventory_current_mt?: number;
  lot_code?: string;
  lot_name?: string;
  // Shipment info
  shipment_sn?: string;
  supplier_name?: string;
  // Permit info
  permit_id?: string;
  permit_status?: PermitStatus;
  permit_application_date?: string;
  permit_approval_date?: string;
  permit_approval_ref?: string;
  // Cost summary
  total_cost: number;
  total_customs_value_cost: number;
  cost_currency?: string;
  // Document counts
  document_count: number;
  photo_count: number;
  // Workflow tracking
  requested_by_user_id?: string;
  processed_by_user_id?: string;
  confirmed_by_user_id?: string;
  picked_up_at?: string;
  confirmed_at?: string;
  confirmation_notes?: string;
  result_rejected?: boolean;
  result_rejection_reason?: string;
  result_rejected_at?: string;
  // User names
  requested_by_name?: string;
  processed_by_name?: string;
  confirmed_by_name?: string;
  // Created by
  created_by_name?: string;
  executed_by_name?: string;
  created_at: string;
  updated_at: string;
  // Full details (when fetching single)
  permits?: ElleclemePermit[];
  costs?: ElleçlemeCost[];
  documents?: ElleclemeDocument[];
}

export interface ShipmentElleclemeHistory {
  id: string;
  request_number: string;
  activity_code: string;
  activity_name?: string;
  activity_name_ar?: string;
  activity_name_tr?: string;
  status: ElleclemeStatus;
  quantity_mt?: number;
  original_gtip?: string;
  new_gtip?: string;
  gtip_changed?: boolean;
  before_description?: string;
  after_description?: string;
  requested_date: string;
  actual_completion_date?: string;
  confirmed_at?: string;
  result_rejected?: boolean;
  result_rejection_reason?: string;
  created_at: string;
  product_text?: string;
  origin_country?: string;
  lot_code?: string;
  lot_name?: string;
  requested_by_name?: string;
  processed_by_name?: string;
  confirmed_by_name?: string;
  total_cost?: number;
  cost_currency?: string;
}

export interface ElleclemePermit {
  id: string;
  request_id: string;
  permit_number?: string;
  permit_type: 'standard' | 'special' | 'blanket';
  application_date?: string;
  application_ref?: string;
  application_document_id?: string;
  customs_office?: string;
  customs_officer_name?: string;
  status: PermitStatus;
  approval_date?: string;
  approval_ref?: string;
  approval_document_id?: string;
  valid_from?: string;
  valid_until?: string;
  rejection_date?: string;
  rejection_reason?: string;
  notes?: string;
  // Joined fields
  request_number?: string;
  activity_code?: string;
  activity_name?: string;
  product_text?: string;
  lot_code?: string;
  shipment_sn?: string;
  created_at: string;
}

export interface ElleçlemeCost {
  id: string;
  request_id: string;
  cost_type: CostType;
  description: string;
  description_ar?: string;
  description_tr?: string;
  amount: number;
  currency: string;
  labor_hours?: number;
  labor_rate?: number;
  worker_count?: number;
  material_quantity?: number;
  material_unit?: string;
  material_unit_price?: number;
  include_in_customs_value: boolean;
  customs_value_justification?: string;
  vendor_name?: string;
  invoice_no?: string;
  invoice_date?: string;
  // Joined
  request_number?: string;
  created_at: string;
}

export interface ElleclemeDocument {
  id: string;
  request_id: string;
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  title?: string;
  description?: string;
  taken_at?: string;
  location_description?: string;
  uploaded_by?: string;
  uploaded_at: string;
}

export interface ActivityType {
  code: string;
  name: string;
  name_ar?: string;
  name_tr?: string;
  description?: string;
  description_ar?: string;
  description_tr?: string;
  may_change_gtip: boolean;
  requires_permission: boolean;
  sort_order: number;
}

export interface DashboardSummary {
  draft_count: number;
  pending_permit_count: number;
  approved_count: number;
  in_progress_count: number;
  pending_confirmation_count: number;
  completed_count: number;
  rejected_count: number;
  cancelled_count: number;
  total_requests: number;
  active_requests: number;
  this_month_count: number;
  overdue_count: number;
  total_costs: number;
}

// ============================================================
// INPUT TYPES
// ============================================================

export interface CreateRequestInput {
  inventory_id: string;
  activity_code: string;
  priority?: Priority;
  quantity_mt?: number;
  quantity_bags?: number;
  reason?: string;
  description?: string;
  customer_requirement?: string;
  original_gtip?: string;
  planned_execution_date?: string;
}

export interface UpdateRequestInput {
  activity_code?: string;
  priority?: Priority;
  quantity_mt?: number;
  quantity_bags?: number;
  reason?: string;
  description?: string;
  customer_requirement?: string;
  original_gtip?: string;
  planned_execution_date?: string;
}

export interface SubmitForPermitInput {
  permit_type?: 'standard' | 'special' | 'blanket';
  customs_office?: string;
  notes?: string;
}

export interface StartExecutionInput {
  actual_start_date?: string;
  execution_notes?: string;
}

export interface CompleteRequestInput {
  before_description?: string;
  after_description?: string;
  new_gtip?: string;
  gtip_changed?: boolean;
  actual_completion_date?: string;
  execution_notes?: string;
}

export interface ApprovePermitInput {
  approval_date?: string;
  approval_ref: string;
  valid_from?: string;
  valid_until?: string;
  notes?: string;
}

export interface RejectPermitInput {
  rejection_date?: string;
  rejection_reason: string;
}

export interface CreateCostInput {
  request_id: string;
  cost_type: CostType;
  description: string;
  description_ar?: string;
  description_tr?: string;
  amount: number;
  currency?: string;
  labor_hours?: number;
  labor_rate?: number;
  worker_count?: number;
  material_quantity?: number;
  material_unit?: string;
  material_unit_price?: number;
  include_in_customs_value?: boolean;
  customs_value_justification?: string;
  vendor_name?: string;
  invoice_no?: string;
  invoice_date?: string;
}

export interface RequestFilters {
  inventory_id?: string;
  status?: ElleclemeStatus;
  activity_code?: string;
  priority?: Priority;
  date_from?: string;
  date_to?: string;
  search?: string;
  lot_id?: string;
  page?: number;
  limit?: number;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export const getStatusColor = (status: ElleclemeStatus): string => {
  const colors: Record<ElleclemeStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    pending_permit: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    pending_confirmation: 'bg-purple-100 text-purple-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-slate-200 text-slate-600',
    rejected: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-slate-100 text-slate-700';
};

export const getPriorityColor = (priority: Priority): string => {
  const colors: Record<Priority, string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return colors[priority] || 'bg-slate-100 text-slate-600';
};

export const getPermitStatusColor = (status: PermitStatus): string => {
  const colors: Record<PermitStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    submitted: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-slate-200 text-slate-500',
  };
  return colors[status] || 'bg-slate-100 text-slate-700';
};

export const getCostTypeIcon = (type: CostType): string => {
  const icons: Record<CostType, string> = {
    labor: '👷',
    materials: '📦',
    external_service: '🏢',
    equipment: '🔧',
    lab_testing: '🔬',
    other: '📋',
  };
  return icons[type] || '📋';
};

// ============================================================
// API FUNCTIONS
// ============================================================

// Dashboard
export const fetchDashboard = async () => {
  const response = await apiClient.get('/v1/ellecleme/dashboard');
  return response.data.data;
};

// Requests
export const fetchRequests = async (filters: RequestFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.inventory_id) params.append('inventory_id', filters.inventory_id);
  if (filters.status) params.append('status', filters.status);
  if (filters.activity_code) params.append('activity_code', filters.activity_code);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);
  if (filters.search) params.append('search', filters.search);
  if (filters.lot_id) params.append('lot_id', filters.lot_id);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  
  const response = await apiClient.get(`/v1/ellecleme/requests?${params.toString()}`);
  return response.data;
};

export const fetchRequest = async (id: string) => {
  const response = await apiClient.get(`/v1/ellecleme/requests/${id}`);
  return response.data.data;
};

export const createRequest = async (data: CreateRequestInput) => {
  const response = await apiClient.post('/v1/ellecleme/requests', data);
  return response.data.data;
};

export const updateRequest = async (id: string, data: UpdateRequestInput) => {
  const response = await apiClient.put(`/v1/ellecleme/requests/${id}`, data);
  return response.data.data;
};

export const submitForPermit = async (id: string, data: SubmitForPermitInput) => {
  const response = await apiClient.post(`/v1/ellecleme/requests/${id}/submit`, data);
  return response.data.data;
};

export const startExecution = async (id: string, data: StartExecutionInput = {}) => {
  const response = await apiClient.post(`/v1/ellecleme/requests/${id}/start`, data);
  return response.data.data;
};

export const completeRequest = async (id: string, data: CompleteRequestInput) => {
  const response = await apiClient.post(`/v1/ellecleme/requests/${id}/complete`, data);
  return response.data.data;
};

export const cancelRequest = async (id: string, reason: string) => {
  const response = await apiClient.post(`/v1/ellecleme/requests/${id}/cancel`, { cancelled_reason: reason });
  return response.data.data;
};

// Workflow actions
export const pickupRequest = async (id: string, notes?: string) => {
  const response = await apiClient.post(`/v1/ellecleme/requests/${id}/pickup`, { notes });
  return response.data.data;
};

export const confirmResult = async (id: string, confirmation_notes?: string) => {
  const response = await apiClient.post(`/v1/ellecleme/requests/${id}/confirm`, { confirmation_notes });
  return response.data.data;
};

export const rejectResult = async (id: string, rejection_reason: string) => {
  const response = await apiClient.post(`/v1/ellecleme/requests/${id}/reject-result`, { rejection_reason });
  return response.data.data;
};

// Shipment history
export const fetchShipmentElleclemeHistory = async (shipmentId: string): Promise<ShipmentElleclemeHistory[]> => {
  const response = await apiClient.get(`/v1/ellecleme/shipments/${shipmentId}/history`);
  return response.data.data;
};

// Permits
export const fetchPermits = async (filters: { request_id?: string; status?: PermitStatus } = {}) => {
  const params = new URLSearchParams();
  if (filters.request_id) params.append('request_id', filters.request_id);
  if (filters.status) params.append('status', filters.status);
  
  const response = await apiClient.get(`/v1/ellecleme/permits?${params.toString()}`);
  return response.data.data;
};

export const approvePermit = async (id: string, data: ApprovePermitInput) => {
  const response = await apiClient.put(`/v1/ellecleme/permits/${id}/approve`, data);
  return response.data.data;
};

export const rejectPermit = async (id: string, data: RejectPermitInput) => {
  const response = await apiClient.put(`/v1/ellecleme/permits/${id}/reject`, data);
  return response.data.data;
};

// Costs
export const fetchCosts = async (filters: { request_id?: string } = {}) => {
  const params = new URLSearchParams();
  if (filters.request_id) params.append('request_id', filters.request_id);
  
  const response = await apiClient.get(`/v1/ellecleme/costs?${params.toString()}`);
  return response.data.data;
};

export const fetchCostSummary = async (request_id?: string) => {
  const params = request_id ? `?request_id=${request_id}` : '';
  const response = await apiClient.get(`/v1/ellecleme/costs/summary${params}`);
  return response.data.data;
};

export const createCost = async (data: CreateCostInput) => {
  const response = await apiClient.post('/v1/ellecleme/costs', data);
  return response.data.data;
};

export const deleteCost = async (id: string) => {
  await apiClient.delete(`/v1/ellecleme/costs/${id}`);
};

// Documents
export const fetchDocuments = async (request_id: string) => {
  const response = await apiClient.get(`/v1/ellecleme/documents?request_id=${request_id}`);
  return response.data.data;
};

export const uploadDocument = async (data: FormData) => {
  const response = await apiClient.post('/v1/ellecleme/documents', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
};

export const deleteDocument = async (id: string) => {
  await apiClient.delete(`/v1/ellecleme/documents/${id}`);
};

// Activity Types
export const fetchActivityTypes = async (): Promise<ActivityType[]> => {
  const response = await apiClient.get('/v1/ellecleme/activity-types');
  return response.data.data;
};

// Reports
export const fetchReportSummary = async (filters: {
  date_from?: string;
  date_to?: string;
  activity_code?: string;
  status?: ElleclemeStatus;
  lot_id?: string;
  inventory_id?: string;
} = {}) => {
  const params = new URLSearchParams();
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);
  if (filters.activity_code) params.append('activity_code', filters.activity_code);
  if (filters.status) params.append('status', filters.status);
  if (filters.lot_id) params.append('lot_id', filters.lot_id);
  if (filters.inventory_id) params.append('inventory_id', filters.inventory_id);
  
  const response = await apiClient.get(`/v1/ellecleme/reports/summary?${params.toString()}`);
  return response.data.data;
};

// Tutanak (Handling Protocol)
export interface TutanakData {
  request_number: string;
  generated_at: string;
  activity_code: string;
  activity_name: string;
  activity_name_tr?: string;
  lot_code: string;
  lot_name?: string;
  product_text?: string;
  shipment_sn?: string;
  supplier_name?: string;
  origin_country?: string;
  quantity_mt: number;
  quantity_bags?: number;
  original_gtip?: string;
  gtip_changed: boolean;
  new_gtip?: string;
  requested_date: string;
  actual_start_date?: string;
  actual_completion_date?: string;
  before_description?: string;
  after_description?: string;
  execution_notes?: string;
  executed_by_name?: string;
  permit?: any;
  costs: { cost_type: string; total: number; currency: string }[];
  total_cost: number;
  customs_value_cost: number;
  documents: { document_type: string; count: number }[];
}

export const fetchTutanak = async (requestId: string): Promise<TutanakData> => {
  const response = await apiClient.get(`/v1/ellecleme/reports/tutanak/${requestId}`);
  return response.data.data;
};
