/**
 * Data Transfer Objects (DTOs)
 * TypeScript type definitions for API request/response payloads
 */

// ========== CONTRACT DTOs ==========

export interface ContractDTO {
  id: string;
  contract_no: string;
  buyer_company_id: string;
  seller_company_id: string;
  incoterm_code?: string;
  currency_code: string;
  signed_at?: string;
  valid_from?: string;
  valid_to?: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted: boolean;
}

export interface ContractLineDTO {
  id: string;
  contract_id: string;
  product_id: string;
  unit_size?: number;
  uom: string;
  planned_qty: number;
  unit_price: number;
  tolerance_pct?: number;
  notes?: string;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ContractWithLinesDTO extends ContractDTO {
  lines: ContractLineDTO[];
  buyer_company?: CompanyBasicDTO;
  seller_company?: CompanyBasicDTO;
}

// ========== PROFORMA DTOs ==========

export interface ProformaInvoiceDTO {
  id: string;
  number: string;
  contract_id: string;
  issued_at?: string;
  valid_until?: string;
  currency_code: string;
  status: 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'INVOICED' | 'CANCELLED';
  notes?: string;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted: boolean;
}

export interface ProformaLineDTO {
  id: string;
  proforma_id: string;
  product_id: string;
  unit_size?: number;
  qty: number;
  unit_price: number;
  notes?: string;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProformaWithLinesDTO extends ProformaInvoiceDTO {
  lines: ProformaLineDTO[];
  contract?: ContractDTO;
  total_value?: number;
}

// ========== SHIPMENT DTOs ==========

export interface ShipmentDTO {
  id: string;
  contract_id?: string;
  proforma_id?: string;
  sn?: string;
  direction: 'incoming' | 'outgoing';
  subject?: string;
  product_text?: string;
  
  // Quantities
  container_count?: number;
  bags_count?: number;
  weight_ton?: number;
  gross_weight_kg?: number;
  net_weight_kg?: number;
  
  // Pricing
  fixed_price_usd_per_ton?: number;
  selling_price_usd_per_ton?: number;
  total_value_usd?: number;
  paid_value_usd?: number;
  balance_value_usd?: number;
  
  // Logistics
  pol_id?: string;
  pod_id?: string;
  shipping_line_id?: string;
  eta?: string;
  etd?: string;
  free_time_days?: number;
  customs_clearance_date?: string; // ISO date when cleared by customs
  status?: string;
  booking_no?: string;
  bl_no?: string;
  
  // Cargo details
  cargo_type?: string;
  vessel_name?: string;
  vessel_imo?: string;
  
  // Financial
  transportation_cost?: number;
  
  // Split shipment
  is_split_shipment: boolean;
  batches?: any[];
  
  // Additional
  notes?: string;
  extra_json?: Record<string, any>;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted: boolean;
}

export interface ShipmentLineDTO {
  id: string;
  shipment_id: string;
  product_id: string;
  unit_size?: number;
  qty: number;
  unit_price: number;
  currency_code: string;
  bags_count?: number;
  notes?: string;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ShipmentContainerDTO {
  id: string;
  shipment_id: string;
  container_no?: string;
  size_code?: string;
  seal_no?: string;
  gross_weight_kg?: number;
  net_weight_kg?: number;
  bags_count?: number;
  notes?: string;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ShipmentWithDetailsDTO extends ShipmentDTO {
  lines: ShipmentLineDTO[];
  containers: ShipmentContainerDTO[];
  contract?: ContractDTO;
  proforma?: ProformaInvoiceDTO;
  pol_name?: string;
  pod_name?: string;
  shipping_line_name?: string;
}

// ========== PAYMENT SCHEDULE DTOs ==========

export interface PaymentScheduleDTO {
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

// ========== COMPANY DTOs ==========

export interface CompanyBasicDTO {
  id: string;
  name: string;
  country?: string;
  city?: string;
  is_supplier: boolean;
  is_customer: boolean;
  is_shipping_line: boolean;
}

export interface CompanyDTO extends CompanyBasicDTO {
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  is_forwarder: boolean;
  is_bank: boolean;
  extra_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

// ========== PRODUCT DTOs ==========

export interface ProductDTO {
  id: string;
  sku?: string;
  name: string;
  hs_code?: string;
  category?: string;
  uom?: string;
  pack_type?: string;
  net_weight_kg?: number;
  spec_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ========== PORT DTOs ==========

export interface PortDTO {
  id: string;
  name: string;
  country?: string;
  unlocode?: string;
  code?: string;
  created_at: string;
  updated_at: string;
}

// ========== PAGINATION DTOs ==========

export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  pages?: number;
}

export interface PaginatedResponseDTO<T> {
  data: T[];
  pagination: PaginationDTO;
}

// ========== ERROR DTOs ==========

export interface ErrorResponseDTO {
  error: string;
  details?: any;
  timestamp: string;
}

export interface ValidationErrorDTO {
  error: string;
  details: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
  timestamp: string;
}

// ========== AUDIT DTOs ==========

export interface AuditLogDTO {
  id: number;
  table_name: string;
  row_id?: string;
  action: 'insert' | 'update' | 'delete';
  old_json?: Record<string, any>;
  new_json?: Record<string, any>;
  actor?: string;
  ts: string;
}

export interface AuditChangeDTO {
  field: string;
  old_value: any;
  new_value: any;
}

export interface AuditSummaryDTO {
  entity_id: string;
  entity_type: string;
  total_changes: number;
  last_modified: string;
  last_modified_by?: string;
  changes: AuditChangeDTO[];
}

// ========== CUSTOMS CLEARING COST DTOs ==========

export interface CustomsClearingCostDTO {
  id: string;
  
  // Reference & Linkage
  file_number: string;
  shipment_id?: string | null;
  
  // Transaction Details (split into separate fields)
  transaction_type?: string | null;          // Type of transaction
  goods_type?: string | null;                // Type of goods
  containers_cars_count?: string | null;     // Number of containers/cars
  goods_weight?: string | null;              // Weight of the goods
  cost_description?: string | null;          // Description of the cost
  
  // Legacy field (deprecated, kept for backward compatibility)
  transaction_description?: string | null;
  
  destination_final_beneficiary?: string | null;
  bol_number?: string | null;
  car_plate?: string | null;
  
  // Cost Breakdown (either company OR FB pays, not both)
  cost_paid_by_company?: number | null;
  cost_paid_by_fb?: number | null;
  extra_cost_amount?: number | null;
  extra_cost_description?: string | null;
  total_clearing_cost: number;
  
  // Invoice Information
  client_name?: string | null;
  invoice_amount?: number | null;
  currency: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  
  // Metadata
  clearance_type?: 'inbound' | 'outbound' | null;
  payment_status: 'pending' | 'paid' | 'partial';
  notes?: string | null;
  
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  is_deleted: boolean;
}

export interface CustomsClearingCostWithRelationsDTO extends CustomsClearingCostDTO {
  shipment?: ShipmentDTO;
  shipment_sn?: string;
  shipment_product?: string;
}

export interface CustomsClearingCostSummaryDTO {
  total_records: number;
  total_clearing_cost: number;
  total_paid_by_company: number;
  total_paid_by_fb: number;
  total_extra_costs: number;
  by_clearance_type: {
    inbound: {
      count: number;
      total: number;
    };
    outbound: {
      count: number;
      total: number;
    };
  };
  by_payment_status: {
    pending: { count: number; total: number };
    paid: { count: number; total: number };
    partial: { count: number; total: number };
  };
}

// Customs Clearing Batch DTOs
export interface CustomsClearingBatchDTO {
  id: string;
  batch_number: string;
  status: 'pending' | 'approved' | 'archived';
  total_clearing_cost: number;
  item_count: number;
  created_by: string;
  created_at: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  is_deleted: boolean;
}

export interface CustomsClearingBatchDetailDTO extends CustomsClearingBatchDTO {
  items: CustomsClearingCostDTO[];
}

export interface CustomsClearingBatchSummaryDTO {
  total_batches: number;
  pending_count: number;
  approved_count: number;
  archived_count: number;
  total_pending_cost: number;
  total_approved_cost: number;
  total_archived_cost: number;
}

