/**
 * Database Type Definitions
 * TypeScript interfaces for all database tables
 * These types match the actual PostgreSQL schema
 */

// ========== SECURITY SCHEMA ==========

export interface User {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  is_locked: boolean;
  failed_login_attempts: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBranch {
  id: string;
  user_id: string;
  branch_id: string;
  access_level: string;
  created_by?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  table_name: string;
  row_id?: string | null;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  action: string;
  actor?: string | null;
  notes?: string | null;
  related_contract_id?: string | null;
  related_shipment_id?: string | null;
  ts: string;
}

// ========== MASTER DATA SCHEMA ==========

export interface Company {
  id: string;
  name: string;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  is_supplier: boolean;
  is_customer: boolean;
  is_shipping_line: boolean;
  is_forwarder: boolean;
  is_bank: boolean;
  extra_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface Port {
  id: string;
  name: string;
  country?: string | null;
  unlocode?: string | null;
  code?: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  hs_code?: string | null;
  category_type?: string | null;
  uom?: string | null;
  pack_type?: string | null;
  net_weight_kg?: number | null;
  typical_origins?: string[] | null;
  brand?: string | null;
  is_seasonal?: boolean | null;
  description?: string | null;
  aliases?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  is_deleted: boolean;
}

export interface Branch {
  id: string;
  name: string;
  name_ar?: string | null;
  parent_id?: string | null;
  branch_type: string;
  country?: string | null;
  city?: string | null;
  is_active: boolean;
  sort_order?: number | null;
  created_at: string;
  updated_at: string;
}

// ========== LOGISTICS SCHEMA ==========

export interface Contract {
  id: string;
  contract_no: string;
  buyer_company_id: string;
  seller_company_id: string;
  incoterm_code?: string | null;
  currency_code: string;
  signed_at?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  status: string;
  direction?: string | null;
  subject?: string | null;
  notes?: string | null;
  extra_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  is_deleted: boolean;
}

export interface ContractLine {
  id: string;
  contract_id: string;
  product_id?: string | null;
  unit_size?: number | null;
  uom: string;
  planned_qty: number;
  unit_price: number;
  tolerance_pct?: number | null;
  notes?: string | null;
  extra_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  sn?: string | null;
  direction: string;
  contract_id?: string | null;
  proforma_id?: string | null;
  supplier_id?: string | null;
  customer_id?: string | null;
  subject?: string | null;
  status?: string | null;
  hold_status?: boolean | null;
  hold_reason?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  is_deleted: boolean;
}

export interface ShipmentLogistics {
  shipment_id: string;
  pol_id?: string | null;
  pod_id?: string | null;
  shipping_line_id?: string | null;
  eta?: string | null;
  etd?: string | null;
  free_time_days?: number | null;
  customs_clearance_date?: string | null;
  final_destination?: Record<string, any> | null;
  updated_at: string;
}

export interface ShipmentCargo {
  shipment_id: string;
  container_count?: number | null;
  bags_count?: number | null;
  weight_ton?: number | null;
  gross_weight_kg?: number | null;
  net_weight_kg?: number | null;
  total_value_usd?: number | null;
  paid_value_usd?: number | null;
  balance_value_usd?: number | null;
  updated_at: string;
}

export interface ShipmentParties {
  shipment_id: string;
  supplier_company_id?: string | null;
  customer_company_id?: string | null;
  shipping_line_id?: string | null;
  updated_at: string;
}

export interface ShipmentDocuments {
  shipment_id: string;
  bl_no?: string | null;
  booking_no?: string | null;
  e_fatura_no?: string | null;
  delivery_confirmed_at?: string | null;
  delivery_confirmed_by?: string | null;
  delivery_has_issues?: boolean | null;
  updated_at: string;
}

export interface ShipmentFinancials {
  shipment_id: string;
  payment_terms?: string | null;
  advance_payment_pct?: number | null;
  advance_payment_amount?: number | null;
  currency_code?: string | null;
  updated_at: string;
}

export interface ShipmentLine {
  id: string;
  shipment_id: string;
  product_id?: string | null;
  contract_line_id?: string | null;
  type_of_goods?: string | null;
  product_name?: string | null;
  brand?: string | null;
  trademark?: string | null;
  kind_of_packages?: string | null;
  number_of_packages?: number | null;
  package_size?: number | null;
  package_size_unit?: string | null;
  unit_size?: number | null;
  qty?: number | null;
  quantity_mt?: number | null;
  quantity_kg?: number | null;
  pricing_method?: string | null;
  unit_price?: number | null;
  rate_usd_per_mt?: number | null;
  currency_code?: string | null;
  amount_usd?: number | null;
  bags_count?: number | null;
  marks?: string | null;
  notes?: string | null;
  volume_cbm?: number | null;
  volume_liters?: number | null;
  number_of_barrels?: number | null;
  number_of_pallets?: number | null;
  number_of_containers?: number | null;
  tolerance_percentage?: number | null;
  description?: string | null;
  hs_code?: string | null;
  category?: string | null;
  uom?: string | null;
  extra_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ShipmentContainer {
  id: string;
  shipment_id: string;
  container_no?: string | null;
  container_number?: string | null;
  size_code?: string | null;
  seal_no?: string | null;
  seal_number?: string | null;
  gross_weight_kg?: number | null;
  net_weight_kg?: number | null;
  tare_weight_kg?: number | null;
  bags_count?: number | null;
  package_count?: number | null;
  notes?: string | null;
  extra_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ShipmentBatch {
  id: string;
  shipment_id: string;
  batch_number?: string | null;
  batch_name?: string | null;
  quantity_mt?: number | null;
  weight_kg?: number | null;
  packages_count?: number | null;
  bags_count?: number | null;
  container_numbers?: string | null;
  notes?: string | null;
  extra_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ProformaInvoice {
  id: string;
  number: string;
  contract_id: string;
  issued_at?: string | null;
  valid_until?: string | null;
  currency_code: string;
  status: string;
  notes?: string | null;
  extra_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  is_deleted: boolean;
}

export interface ProformaLine {
  id: string;
  proforma_id: string;
  product_id?: string | null;
  unit_size?: number | null;
  qty: number;
  unit_price: number;
  notes?: string | null;
  extra_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  shipment_id?: string | null;
  contract_id?: string | null;
  notification_type: string;
  severity: string;
  title_en?: string | null;
  title_ar?: string | null;
  message_en?: string | null;
  message_ar?: string | null;
  is_read: boolean;
  is_completed: boolean;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ========== FINANCE SCHEMA ==========

export interface Transaction {
  id: string;
  transaction_date: string;
  amount_usd?: number | null;
  amount_other?: number | null;
  currency?: string | null;
  transaction_type?: string | null;
  direction?: string | null;
  fund_source?: string | null;
  party_name?: string | null;
  description?: string | null;
  contract_id?: string | null;
  shipment_id?: string | null;
  fund_id?: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface Fund {
  id: string;
  fund_name: string;
  fund_type?: string | null;
  currency_code?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialParty {
  id: string;
  name: string;
  type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomsClearingCost {
  id: string;
  file_number: string;
  shipment_id?: string | null;
  transaction_type?: string | null;
  goods_type?: string | null;
  containers_cars_count?: string | null;
  goods_weight?: string | null;
  cost_description?: string | null;
  transaction_description?: string | null;
  destination_final_beneficiary?: string | null;
  bol_number?: string | null;
  car_plate?: string | null;
  cost_paid_by_company?: number | null;
  cost_paid_by_fb?: number | null;
  extra_cost_amount?: number | null;
  extra_cost_description?: string | null;
  total_clearing_cost: number;
  client_name?: string | null;
  invoice_amount?: number | null;
  currency: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  clearance_type?: string | null;
  payment_status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  is_deleted: boolean;
}

export interface CustomsClearingBatch {
  id: string;
  batch_number: string;
  status: string;
  total_clearing_cost: number;
  item_count: number;
  created_by: string;
  notes?: string | null;
  created_at: string;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  is_deleted: boolean;
}

export interface CustomsClearingBatchItem {
  id: string;
  batch_id: string;
  customs_cost_id: string;
  created_at: string;
}

// ========== QUALITY & INVENTORY ==========

export interface QualityIncident {
  id: string;
  shipment_id: string;
  branch_id: string;
  created_by_user_id: string;
  issue_type?: string | null;
  issue_subtype?: string | null;
  description_short?: string | null;
  container_moisture_seen?: boolean | null;
  container_bad_smell?: boolean | null;
  container_torn_bags?: boolean | null;
  container_torn_bags_count?: number | null;
  container_condensation?: boolean | null;
  affected_estimate_min?: number | null;
  affected_estimate_max?: number | null;
  affected_estimate_mode?: number | null;
  status: string;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualitySampleCard {
  id: string;
  incident_id: string;
  sample_id: string;
  sample_group: string;
  weighing_required: boolean;
  sample_weight_g?: number | null;
  broken_g?: number | null;
  mold_g?: number | null;
  foreign_g?: number | null;
  other_g?: number | null;
  moisture_pct?: number | null;
  total_defect_pct?: number | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierDeliveryRecord {
  id: string;
  shipment_id: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  delivery_date?: string | null;
  has_quality_issues?: boolean | null;
  final_outcome?: string | null;
  confirmed_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ========== HELPER TYPES ==========

/**
 * Generic query result row type
 * Use this when querying with typed results
 */
export type QueryResultRow = Record<string, any>;

/**
 * Helper type for query results with typed rows
 */
export interface TypedQueryResult<T extends QueryResultRow> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: any[];
}

/**
 * Helper function to safely get first row from query result
 * Throws error if no row found
 */
export function getFirstRow<T extends QueryResultRow>(
  result: TypedQueryResult<T>,
  errorMessage: string = 'Record not found'
): T {
  if (result.rows.length === 0) {
    throw new Error(errorMessage);
  }
  return result.rows[0];
}

/**
 * Helper function to safely get first row or null
 */
export function getFirstRowOrNull<T extends QueryResultRow>(
  result: TypedQueryResult<T>
): T | null {
  return result.rows.length > 0 ? result.rows[0] : null;
}



