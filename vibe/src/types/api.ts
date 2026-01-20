// API Types for Loyal Supply Chain

/**
 * Shipment Status - Automatically calculated by the status engine
 */
export type ShipmentStatus = 'planning' | 'delayed' | 'sailed' | 'awaiting_clearance' | 'pending_transport' | 'loaded_to_final' | 'arrived' | 'delivered' | 'received' | 'quality_issue';

export interface Shipment {
  id: string;
  sn: string;
  direction: 'incoming' | 'outgoing';
  transaction_type?: 'incoming' | 'outgoing'; // Alias for direction (database uses this)
  subject?: string | null;
  product_text: string;
  supplier_id?: string | null;
  supplier_name?: string | null;  // Joined from companies table
  customer_id?: string | null;
  customer_name?: string | null;  // Joined from companies table
  // Buyer/Importer - The party receiving goods for documentation (certificates, customs, etc.)
  buyer_id?: string | null;
  buyer_name?: string | null;  // Stored directly in shipment_parties
  buyer_company_name?: string | null;  // Joined from companies table via buyer_id
  has_broker?: boolean;
  broker_name?: string | null;
  final_beneficiary_name?: string | null;  // From shipment_parties table
  
  // Commercial terms
  cargo_type?: string | null;
  tanker_type?: string | null;
  contract_id?: string | null;
  contract_no?: string | null; // Linked contract number (joined from contracts table)
  container_count: number | null;
  weight_ton: string | number | null;
  weight_unit?: string;
  weight_unit_custom?: string | null;
  barrels?: number | null;
  fixed_price_usd_per_ton: string | number | null;
  fixed_price_usd_per_barrel?: string | number | null;
  selling_price_usd_per_ton?: string | number | null;
  selling_price_usd_per_barrel?: string | number | null;
  currency_code?: string | null;
  usd_equivalent_rate?: number | null;
  payment_terms?: string | null;
  incoterms?: string | null;
  
  // Financial details
  down_payment_type?: string | null;
  down_payment_percentage?: number | null;
  down_payment_amount?: number | null;
  payment_method?: string | null;
  payment_method_other?: string | null;
  swift_code?: string | null;
  lc_number?: string | null;
  lc_issuing_bank?: string | null;
  beneficiary_name?: string | null;
  beneficiary_bank_name?: string | null;
  beneficiary_bank_address?: string | null;
  beneficiary_account_number?: string | null;
  beneficiary_iban?: string | null;
  intermediary_bank?: string | null;
  payment_schedule?: any[];
  additional_costs?: any[];
  payment_beneficiaries?: any[];
  
  // Logistics
  is_split_shipment?: boolean;
  batches?: any; // JSONB field, can be string or array
  pol_id: string | null;
  pod_id: string | null;
  pol_name?: string;
  pol_country?: string;
  pod_name?: string;
  pod_country?: string;
  etd?: string | null;
  eta: string | null;
  free_time_days: number | string | null;
  customs_clearance_date: string | null;
  shipping_line_id: string | null;
  shipping_line_name?: string;
  shipping_line_country?: string;
  booking_no: string | null;
  bl_no: string | null;
  transportation_cost?: number | string | null;
  bol_numbers?: string[];
  container_number?: string | null;
  container_numbers?: string[];
  vessel_name?: string | null;
  vessel_imo?: string | null;
  truck_plate_number?: string | null;
  cmr?: string | null;
  tanker_name?: string | null;
  tanker_imo?: string | null;
  country_of_export?: string | null;
  
  // Final Destination
  has_final_destination?: boolean | null;
  final_destination?: {
    type?: string;
    branch_id?: string;
    warehouse_id?: string;
    name?: string;
    delivery_place?: string;
    address?: string;
    contact?: string;
    selling_price?: number | string;
    place?: string;
  } | null;
  
  // Internal Route / Border Crossing
  is_cross_border?: boolean | null;
  primary_border_crossing_id?: string | null;
  primary_border_name?: string | null;
  primary_border_name_ar?: string | null;
  border_country_from?: string | null;
  border_country_to?: string | null;
  transit_countries?: string[] | null;
  internal_transport_mode?: string | null;
  clearance_category?: 'transit' | 'domestic' | 'custom_clearance' | null;
  
  // Documents
  documents?: any[];
  document_count?: number;
  
  // Computed values
  total_value_usd: string | null;
  paid_value_usd: string;
  balance_value_usd: string;
  
  // Status (auto-calculated by status engine)
  status: ShipmentStatus | null;
  status_reason?: string | null;  // Human-readable explanation of current status
  status_calculated_at?: string | null;  // When status was last calculated
  status_override_by?: string | null;  // Username who manually overrode (NULL if auto)
  status_override_at?: string | null;  // When manually overridden
  status_override_reason?: string | null;  // Why manually overridden
  paperwork_status: string | null;
  
  // Agreed shipping date (for delay detection)
  agreed_shipping_date?: string | null;
  
  // Warehouse receipt fields
  warehouse_receipt_confirmed?: boolean;
  warehouse_receipt_confirmed_at?: string | null;
  warehouse_receipt_has_issues?: boolean;
  warehouse_receipt_notes?: string | null;
  
  // Legacy dates (might be deprecated)
  deposit_date: string | null;
  contract_ship_date: string | null;
  bl_date: string | null;
  
  // Additional notes
  notes: string | null;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  is_deleted: boolean;
}

/**
 * Shipment Status Workflow Reference:
 * 1. planning           - Initial state when shipment is created
 * 2. delayed            - Agreed shipping date passed, no BL/AWB
 * 3. sailed             - BL/AWB entered AND ETA available
 * 4. awaiting_clearance - ETA date <= current date (arrived at port)
 * 5. pending_transport  - Cleared, assigned to transport agent, waiting for car assignment
 * 6. loaded_to_final    - Transport assigned, on way to final destination
 * 7. received           - Warehouse confirmed without issues
 * 8. quality_issue      - Warehouse confirmed with issues
 */

/** Status display configuration */
export const SHIPMENT_STATUS_CONFIG: Record<ShipmentStatus, {
  label: string;
  label_ar: string;
  color: string;
  bgColor: string;
  order: number;
  description: string;
  description_ar: string;
}> = {
  planning: {
    label: 'Planning',
    label_ar: 'تخطيط',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    order: 1,
    description: 'Shipment is being planned. Waiting for booking details.',
    description_ar: 'الشحنة قيد التخطيط. في انتظار تفاصيل الحجز.'
  },
  delayed: {
    label: 'Delayed',
    label_ar: 'متأخر',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    order: 2,
    description: 'Agreed shipping date has passed but no Bill of Lading received.',
    description_ar: 'تاريخ الشحن المتفق عليه قد مر ولم يتم استلام بوليصة الشحن.'
  },
  sailed: {
    label: 'Sailed / In Transit',
    label_ar: 'أبحرت / في الطريق',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    order: 3,
    description: 'Shipment is in transit. Bill of Lading received.',
    description_ar: 'الشحنة في الطريق. تم استلام بوليصة الشحن.'
  },
  awaiting_clearance: {
    label: 'Awaiting Clearance',
    label_ar: 'في انتظار التخليص',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    order: 4,
    description: 'Shipment has arrived at port. Waiting for customs clearance.',
    description_ar: 'وصلت الشحنة إلى الميناء. في انتظار التخليص الجمركي.'
  },
  pending_transport: {
    label: 'Pending Transport',
    label_ar: 'في انتظار تعيين النقل',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    order: 5,
    description: 'Customs cleared. Assigned to transport agent, waiting for vehicle assignment.',
    description_ar: 'تم التخليص الجمركي. في انتظار تعيين السيارات.'
  },
  loaded_to_final: {
    label: 'On Way to Final Destination',
    label_ar: 'في الطريق إلى الوجهة النهائية',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    order: 6,
    description: 'Transport assigned. Shipment is on the way to final destination.',
    description_ar: 'تم تعيين النقل. الشحنة في الطريق إلى الوجهة النهائية.'
  },
  arrived: {
    label: 'Arrived at Port',
    label_ar: 'وصلت إلى الميناء',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    order: 7,
    description: 'Shipment has arrived at the destination port.',
    description_ar: 'وصلت الشحنة إلى ميناء الوصول.'
  },
  delivered: {
    label: 'Delivered',
    label_ar: 'تم التسليم',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    order: 8,
    description: 'Shipment has been delivered to the final destination.',
    description_ar: 'تم تسليم الشحنة إلى الوجهة النهائية.'
  },
  received: {
    label: 'Received',
    label_ar: 'تم الاستلام',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    order: 9,
    description: 'Shipment received at warehouse without issues.',
    description_ar: 'تم استلام الشحنة في المستودع بدون مشاكل.'
  },
  quality_issue: {
    label: 'Quality Issue',
    label_ar: 'مشكلة جودة',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    order: 10,
    description: 'Shipment received with quality issues. Follow-up required.',
    description_ar: 'تم استلام الشحنة مع مشاكل في الجودة. مطلوب متابعة.'
  }
};

export interface CompanyBankingInfo {
  bank_name?: string;
  account_number?: string;
  iban?: string;
  swift_code?: string;
  bank_address?: string;
  account_holder_name?: string;
  intermediary_bank?: string;
  branch?: string;
  currency?: string;
  notes?: string;
  // Audit fields
  last_updated?: string;
  updated_by?: string;
}

export interface Company {
  id: string;
  name: string;
  country: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  is_supplier: boolean;
  is_customer: boolean;
  is_shipping_line: boolean;
  is_forwarder: boolean;
  is_bank: boolean;
  extra_json?: {
    banking?: CompanyBankingInfo;
    product_categories?: string[];
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  is_deleted: boolean;
  // Computed fields (from API)
  last_product?: string;
  last_purchase_date?: string;
}

export interface Port {
  id: string;
  name: string;
  country: string;
  unlocode?: string;
  code?: string;
  created_at: string;
  updated_at: string;
}

export interface Transfer {
  id: string;
  direction: 'received' | 'paid';
  amount: string;
  currency: string;
  transfer_date: string;
  bank_name?: string;
  bank_account?: string;
  sender?: string;
  receiver?: string;
  reference?: string;
  notes?: string;
  shipment_id?: string;
  shipment_sn?: string;
  pi_no?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

export interface Stats {
  overview: {
    total_shipments: string;
    unique_contracts: string;
    total_containers: string;
    total_weight_tons: string;
    total_value_usd: string;
    total_suppliers: string;
    total_shipping_lines: string;
    total_ports: string;
    total_transfers: string;
  };
  shipmentsByStatus: Array<{ status: string; count: string }>;
  topOrigins: Array<{ port: string; shipment_count: string }>;
  topDestinations: Array<{ port: string; shipment_count: string }>;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: 'connected' | 'disconnected';
  uptime: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: string;
}

// ========== Audit & Change Tracking ==========

export interface ChangeAuditLog {
  id: string;
  entity_type: 'contract' | 'contract_line' | 'shipment' | 'shipment_line';
  entity_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: 'created' | 'updated' | 'split' | 'deleted';
  source_type: 'manual' | 'contract_import' | 'sync' | 'system';
  changed_by: string;
  changed_at: string;
  notes?: string | null;
  related_contract_id?: string | null;
  related_shipment_id?: string | null;
  // Joined fields
  contract_no?: string;
  shipment_sn?: string;
  contract_product_name?: string;
  shipment_product_name?: string;
  product_name?: string;
}

export interface ContractUpdateRequest {
  id: string;
  contract_id: string;
  shipment_id: string;
  changes_json: ContractUpdateChange[];
  requested_by: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  contract_no?: string;
  shipment_sn?: string;
  buyer_name?: string;
  seller_name?: string;
}

export interface ContractUpdateChange {
  line_id: string;
  field: string;
  old_value: any;
  new_value: any;
  reason?: string;
}

export interface ContractShipmentComparison {
  contract_line_id: string;
  contract_id: string;
  contract_no: string;
  shipment_id: string;
  shipment_sn: string;
  product_id: string;
  product_name: string;
  uom: string;
  // Contract values
  contract_qty: number;
  contract_price: number;
  contract_value: number;
  tolerance_pct?: number | null;
  // Shipment values
  shipped_qty: number;
  actual_price: number;
  shipped_value: number;
  // Variances
  variance_qty: number;
  variance_qty_pct: number;
  variance_price: number;
  variance_price_pct: number;
  within_tolerance: boolean;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ComparisonResponse {
  contract_id: string;
  shipment_id: string;
  comparison: ContractShipmentComparison[];
  change_history: ChangeAuditLog[];
}

// ========== Contract vs Shipment Full Comparison ==========

/** A single field comparison between contract (planned) and shipment (actual) values */
export interface FieldComparison {
  field_name: string;
  field_order: number;
  contract_value: string | null;
  shipment_value: string | null;
  has_variance: boolean;
}

/** Line-level comparison for product lines */
export interface LineComparison {
  contract_line_id: string;
  product_name: string | null;
  contract_quantity_mt: number | null;
  shipment_quantity_mt: number | null;
  contract_unit_price: number | null;
  shipment_unit_price: number | null;
  contract_amount_usd: number | null;
  shipment_amount_usd: number | null;
  contract_brand: string | null;
  shipment_brand: string | null;
  contract_packages: number | null;
  shipment_packages: number | null;
  quantity_variance: number | null;
  amount_variance: number | null;
  variance_status: 'match' | 'over_shipped' | 'under_shipped' | 'not_shipped' | 'unknown';
}

/** Full comparison response for contract vs shipment */
export interface ContractShipmentFullComparison {
  shipment_id: string;
  shipment_sn: string;
  contract_id: string | null;
  has_contract: boolean;
  /** Header-level field comparisons (supplier, incoterms, POL, etc.) */
  header: FieldComparison[];
  /** Line-level product comparisons */
  lines: LineComparison[];
  /** Audit history of changes */
  change_history: ChangeAuditLog[];
}

export interface AuditLogResponse {
  contract_id?: string;
  shipment_id?: string;
  total: number;
  logs: ChangeAuditLog[];
}

export interface ShipmentCreationResponse {
  success: boolean;
  shipment: Shipment & {
    lines?: any[];
  };
  message: string;
}

export interface UpdateRequestResponse {
  success: boolean;
  request?: ContractUpdateRequest;
  message: string;
}

export interface PendingRequestsResponse {
  total: number;
  requests: ContractUpdateRequest[];
}

// ========== Financial Transactions ==========

export interface FinancialTransaction {
  id: string;
  transaction_date: string;
  amount_usd: number;
  amount_other?: number | null;
  currency: string;
  transaction_type: string;
  direction: 'in' | 'out';
  fund_source: string;
  party_name: string;
  description: string;
  contract_id?: string | null;
  shipment_id?: string | null;
  company_id?: string | null;
  fund_id?: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  // Joined fields
  fund_name?: string;
  fund_type?: string;
  contract_no?: string;
  shipment_sn?: string;
  company_name?: string;
}

export interface Fund {
  id: string;
  name: string;
  fund_name: string; // Alias for name for backwards compatibility
  type: 'bank' | 'cash_fund' | 'exchange';
  fund_type: 'bank_account' | 'cash' | 'investment' | 'petty_cash'; // Database type
  currency: string;
  currency_code: string; // Alias for currency
  account_number?: string;
  bank_name?: string;
  current_balance?: number;
  description?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  // Calculated fields
  total_in?: number;
  total_out?: number;
  balance?: number;
}

export interface FinancialParty {
  id: string;
  name: string;
  type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartySearchResult {
  source: 'party' | 'company';
  id: string;
  name: string;
  type?: string | null;
  country?: string | null;
}

export interface FinancialSummary {
  total_income: number;
  total_expenses: number;
  net_balance: number;
}

export interface TransactionsResponse {
  transactions: FinancialTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface FinanceSummaryResponse {
  summary: FinancialSummary;
  fund_balances: Fund[];
}

// ========== Contract & Shipment Search Results ==========

export interface ContractSearchResult {
  id: string;
  contract_no: string;
  subject?: string | null;
  buyer_name?: string | null;
  seller_name?: string | null;
  beneficiary_name?: string | null;
  contract_date?: string | null;
  status?: string | null;
  direction?: 'incoming' | 'outgoing' | null;
}

export interface ShipmentSearchResult {
  id: string;
  sn: string;
  product_text?: string | null;
  subject?: string | null;
  origin_port?: string | null;
  destination_port?: string | null;
  eta?: string | null;
  status?: string | null;
}

// ========== Customs Clearing Costs ==========

export interface CustomsClearingCost {
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
  
  // Cost Responsibility (free text field)
  cost_responsibility?: string | null;
  
  // Cost Breakdown
  original_clearing_amount?: number | null;  // Single field for original clearance cost
  extra_cost_amount?: number | null;
  extra_cost_description?: string | null;
  total_clearing_cost: number;
  
  // Legacy cost fields (deprecated, kept for backward compatibility)
  /** @deprecated Use original_clearing_amount instead */
  cost_paid_by_company?: number | null;
  /** @deprecated Use original_clearing_amount instead */
  cost_paid_by_fb?: number | null;
  
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
  
  // Joined fields
  shipment_sn?: string;
  shipment_product?: string;
  shipment_clearance_category?: 'transit' | 'domestic' | 'custom_clearance' | null;
}

export interface CustomsClearingCostFilters {
  page?: number;
  limit?: number;
  sort_by?: 'file_number' | 'invoice_date' | 'total_clearing_cost' | 'clearance_type' | 'clearance_category' | 'payment_status' | 'created_at';
  sort_order?: 'asc' | 'desc';
  
  file_number?: string;
  shipment_id?: string;
  bol_number?: string;
  invoice_number?: string;
  client_name?: string;
  clearance_type?: 'inbound' | 'outbound';
  clearance_category?: 'transit' | 'domestic' | 'custom_clearance';
  destination?: string;
  payment_status?: 'pending' | 'paid' | 'partial';
  
  invoice_date_from?: string;
  invoice_date_to?: string;
  
  search?: string;
}

export interface CustomsClearingCostSummary {
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

export interface CustomsClearingCostsResponse {
  data: CustomsClearingCost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Pending Clearances interfaces
export interface PendingClearanceShipment {
  id: string;
  sn: string;
  product_text: string;
  customs_clearance_date: string;
  weight_ton: number | null;
  container_count: number | null;
  eta: string | null;
  free_time_days: number | null;
  status: string | null;
  bl_no: string | null;
  bol_numbers: string[] | null;
  booking_no: string | null;
  total_value_usd: number | null;
  subject: string | null;
  transaction_type: 'incoming' | 'outgoing';
  pol_name: string | null;
  pol_country: string | null;
  pod_name: string | null;
  pod_country: string | null;
  shipping_line_name: string | null;
  // Final destination for route display
  final_destination_name: string | null;
  final_destination_branch_id: string | null;
  // Border crossing info
  is_cross_border: boolean | null;
  primary_border_name: string | null;
  primary_border_name_ar: string | null;
  // Clearance category (transit/domestic/custom_clearance)
  clearance_category: 'transit' | 'domestic' | 'custom_clearance' | null;
}

export interface PendingClearanceFilters {
  page?: number;
  limit?: number;
  sort_by?: 'sn' | 'product_text' | 'customs_clearance_date' | 'weight_ton' | 'container_count' | 'eta' | 'pol_name' | 'pod_name' | 'clearance_category';
  sort_order?: 'asc' | 'desc';
  search?: string;
  clearance_date_from?: string;
  clearance_date_to?: string;
  clearance_category?: 'transit' | 'domestic' | 'custom_clearance';
  pod_name?: string;
}

export interface PendingClearancesResponse {
  data: PendingClearanceShipment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateCostFromPendingInput {
  shipment_id: string;
  file_number?: string;
  original_clearing_amount?: number | null;
  extra_cost_amount?: number | null;
  extra_cost_description?: string | null;
  clearance_type?: string | null;
  payment_status?: 'pending' | 'paid' | 'partial';
  bol_number?: string | null;
  car_plate?: string | null;
  cost_responsibility?: string | null;
  transaction_type?: string | null;
  goods_type?: string | null;
  containers_cars_count?: string | null;
  goods_weight?: string | null;
  cost_description?: string | null;
  client_name?: string | null;
  invoice_amount?: number | null;
  currency?: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  notes?: string | null;
}

// Customs Clearing Batch interfaces
export interface CustomsClearingBatch {
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

export interface CustomsClearingBatchDetail extends CustomsClearingBatch {
  items: CustomsClearingCost[];
}

export interface CustomsClearingBatchSummary {
  total_batches: number;
  pending_count: number;
  approved_count: number;
  archived_count: number;
  total_pending_cost: number;
  total_approved_cost: number;
  total_archived_cost: number;
}

export interface CustomsClearingBatchFilters {
  page?: number;
  limit?: number;
  sort_by?: 'batch_number' | 'status' | 'total_clearing_cost' | 'item_count' | 'created_at' | 'submitted_at' | 'reviewed_at';
  sort_order?: 'asc' | 'desc';
  status?: 'pending' | 'approved' | 'archived';
  created_by?: string;
  reviewed_by?: string;
  created_from?: string;
  created_to?: string;
  search?: string;
}

export interface CustomsClearingBatchesResponse {
  data: CustomsClearingBatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ========== LAND TRANSPORT TYPES ==========

export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered' | 'cancelled';

export interface TransportCompany {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  contact_person: string | null;
  vehicle_types: string[];
  service_areas: string[];
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  is_deleted: boolean;
}

export interface OutboundDelivery {
  id: string;
  delivery_number: string;
  delivery_date: string;
  origin: string | null;
  destination: string;
  shipment_id: string | null;
  container_id: string | null;
  transport_company_id: string | null;
  transport_company_name?: string | null;
  transport_company_phone?: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  truck_plate_number: string | null;
  vehicle_type: string | null;
  transport_cost: number | null;
  transport_currency: string | null; // Currency for transport/insurance costs (USD, TRY, EUR)
  insurance_cost: number | null;
  total_cost: number | null;
  package_count: number | null;
  weight_kg: number | null;
  goods_description: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_reference: string | null;
  selling_price: number | null;
  currency: string;
  status: DeliveryStatus;
  receipt_number: string | null;
  receipt_generated_at: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  // Border crossing fields
  border_crossing_id?: string | null;
  border_eta?: string | null;
  delivery_leg?: 'pod_to_border' | 'border_to_fd' | 'pod_to_fd';
  // Joined fields
  shipment_sn?: string | null;
  shipment_product?: string | null;
}

// Container detail for Ready for Delivery (matches wizard ContainerDetail)
export interface ContainerDetailAPI {
  id: string;
  container_number: string;
  net_weight_kg: number | null;
  gross_weight_kg: number | null;
  package_count: number | null;
  seal_number?: string | null;
  // Delivery assignment info
  has_delivery?: boolean;
  delivery_info?: {
    id: string;
    container_id: string;
    delivery_number: string | null;
    status: string;
    driver_name: string | null;
    truck_plate_number: string | null;
    destination: string | null;
    transport_company_name: string | null;
    transport_cost: number | null;
    transport_currency: string | null;
    insurance_cost: number | null;
    insurance_company: string | null;
  } | null;
}

export interface ReadyForDeliveryShipment {
  id: string;
  sn: string;
  product_text: string;
  subject: string | null;
  status: string | null;
  container_count: number | null;
  container_number: string | null;
  containers: ContainerDetailAPI[] | null; // Detailed container info
  weight_ton: number | null;
  customs_clearance_date: string;
  bl_no: string | null;
  booking_no: string | null;
  pol_name: string | null;
  pol_country: string | null;
  pod_name: string | null;
  pod_country: string | null;
  final_beneficiary_name: string | null;
  final_beneficiary_company_id: string | null;
  supplier_name: string | null;
  delivery_count: number;
  // Final destination for route display
  final_destination_place: string | null;
  // Border crossing info
  is_cross_border: boolean | null;
  primary_border_crossing_id: string | null;
  primary_border_name: string | null;
  primary_border_name_ar: string | null;
}

export interface DeliveryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: DeliveryStatus;
  transport_company_id?: string;
  destination?: string;
  date_from?: string;
  date_to?: string;
  shipment_id?: string;
  sort_by?: 'delivery_date' | 'delivery_number' | 'destination' | 'status' | 'created_at';
  sort_dir?: 'asc' | 'desc';
}

export interface ReadyForDeliveryFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface TransportCompanyFilters {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}

export interface CreateDeliveryInput {
  delivery_date?: string;
  origin?: string;
  destination: string;
  shipment_id?: string | null;
  container_id?: string | null;
  transport_company_id?: string | null;
  transport_company_name?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  truck_plate_number?: string | null;
  vehicle_type?: string | null;
  transport_cost?: number | null;
  transport_currency?: string; // Currency for transport/insurance costs (USD, TRY, EUR)
  insurance_cost?: number | null;
  insurance_company?: string | null;
  package_count?: number | null;
  weight_kg?: number | null;
  goods_description?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_reference?: string | null;
  selling_price?: number | null;
  currency?: string;
  status?: DeliveryStatus;
  notes?: string | null;
  // Border crossing fields
  border_crossing_id?: string | null;
  border_eta?: string | null;
  delivery_leg?: 'pod_to_border' | 'border_to_fd' | 'pod_to_fd';
}

export interface UpdateDeliveryInput extends Partial<CreateDeliveryInput> {}

export interface CreateTransportCompanyInput {
  name: string;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  vehicle_types?: string[];
  service_areas?: string[];
  is_active?: boolean;
  notes?: string | null;
}

export interface UpdateTransportCompanyInput extends Partial<CreateTransportCompanyInput> {}

export interface DeliveriesResponse {
  data: OutboundDelivery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ReadyForDeliveryResponse {
  data: ReadyForDeliveryShipment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TransportCompaniesResponse {
  data: TransportCompany[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DeliveryStats {
  pending_count: number;
  in_transit_count: number;
  delivered_count: number;
  cancelled_count: number;
  total_count: number;
  total_transport_cost: number | null;
}

// ========== ONGOING TRANSPORT BOARD TYPES ==========

/** Ongoing transport item for the board view */
export interface OngoingTransport {
  // Delivery info
  id: string;
  delivery_number: string;
  delivery_date: string;
  status: 'pending' | 'in_transit';
  origin: string | null;
  destination: string;
  container_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  truck_plate_number: string | null;
  vehicle_type: string | null;
  transport_company_id: string | null;
  transport_company_name: string | null;
  transport_company_phone: string | null;
  transport_company_contact: string | null;
  transport_cost: number | null;
  transport_currency: string | null;
  insurance_cost: number | null;
  insurance_company: string | null;
  package_count: number | null;
  weight_kg: number | null;
  goods_description: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  border_crossing_id: string | null;
  border_eta: string | null;
  delivery_leg: 'pod_to_border' | 'border_to_fd' | 'pod_to_fd' | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Shipment info
  shipment_id: string | null;
  shipment_sn: string | null;
  shipment_product: string | null;
  shipment_weight_ton: number | null;
  shipment_container_count: number | null;
  customs_clearance_date: string | null;
  bl_no: string | null;
  booking_no: string | null;
  supplier_name: string | null;
  // Route info: POD
  pod_name: string | null;
  pod_country: string | null;
  // Route info: Final Destination
  final_destination_place: string | null;
  final_destination_branch_id: string | null;
  // Route info: Border Crossing
  effective_border_crossing_id: string | null;
  border_crossing_name: string | null;
  border_crossing_name_ar: string | null;
  border_country_from: string | null;
  border_country_to: string | null;
  is_cross_border: boolean | null;
}

export interface OngoingTransportFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'pending' | 'in_transit';
}

export interface OngoingTransportStats {
  pending_count: number;
  in_transit_count: number;
  total_ongoing: number;
}

export interface OngoingTransportResponse {
  data: OngoingTransport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: OngoingTransportStats;
}

// ========== BANK TRANSFER ORDER TYPES ==========

export type TransferOrderType = 'import' | 'domestic_international';
export type ChargeType = 'SHA' | 'OUR' | 'BEN';

export interface TransferOrderData {
  // Transfer Details
  transfer_type: TransferOrderType;
  currency: string;
  amount: number;
  transfer_date: string;
  value_date?: string;
  
  // Sender Info (Loyal International - typically fixed)
  sender_name: string;
  sender_customer_number: string;
  sender_branch: string;
  
  // Beneficiary Info (from supplier)
  beneficiary_name: string;
  beneficiary_address: string;
  
  // Beneficiary Bank Info
  bank_name: string;
  bank_branch?: string;
  bank_country?: string;
  bank_address?: string;
  swift_code: string;
  iban_unknown?: boolean;
  iban_or_account: string;
  correspondent_bank?: string;
  
  // Invoice/Payment Details
  invoice_info: string;
  payment_details?: string;
  
  // Charges
  charge_type: ChargeType;
}

// Default sender info for Loyal International
export const LOYAL_INTERNATIONAL_SENDER = {
  name: 'LOYAL INTERNATIONAL GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
  customer_number: '78265692',
  branch: 'MERSİN / Mersin Ticari Şube Müdürlüğü\'ne',
};

