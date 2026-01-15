// Container Detail interface for per-container tracking
// Matches normalized logistics.shipment_containers table
export interface ContainerDetail {
  id: string;
  shipment_id?: string;
  container_no?: string; // Alias for container_number
  container_number: string;
  size_code?: string; // 20ft, 40ft, 40HC, etc.
  seal_no?: string; // Alias for seal_number
  seal_number?: string;
  gross_weight_kg: number | '';
  net_weight_kg: number | '';
  tare_weight_kg?: number | '';
  bags_count?: number | '';
  package_count: number | '';
  notes?: string;
  extra_json?: Record<string, any>;
  created_by?: string;
  updated_by?: string;
}

// Product Line interface (from contract wizard)
// Matches normalized logistics.shipment_lines table
export interface ProductLine {
  id?: string; // Temporary for UI, or actual UUID from database
  shipment_id?: string; // Reference to parent shipment
  contract_line_id?: string; // Reference to original contract line for variance tracking
  
  // Product Description
  type_of_goods: string;
  product_id?: string;
  product_name?: string;
  brand?: string;
  trademark?: string;
  description?: string;
  hs_code?: string;
  category?: string;
  
  // Country of Origin of Goods (per product line)
  // NOTE: Different products in the same shipment can have different origins
  // Example: Mixed shipment from Dubai with Vietnamese pepper + Brazilian pepper + Indian cumin
  country_of_origin?: string;
  
  // Packaging
  kind_of_packages: string;
  packaging_mode?: 'PACKAGED' | 'BULK'; // PACKAGED = standard with packages, BULK = no packaging (loose/bulk cargo)
  number_of_packages: number;
  package_size: number;
  package_size_unit: string;
  unit_size?: number;
  bags_count?: number;
  
  // Quantities
  qty?: number; // Generic quantity
  quantity_mt: number;
  quantity_kg?: number;
  quantity_lb?: number;
  quantity_ton?: number;
  tolerance_percentage?: number;
  uom?: string; // Unit of measure (MT, KG, etc.)
  
  // Volume
  volume_liters?: number;
  volume_cbm?: number;
  volume_gallons?: number;
  
  // Shipping Units
  number_of_containers?: number;
  number_of_pallets?: number;
  number_of_barrels?: number;
  
  // Pricing
  pricing_method: 
    | 'per_mt' | 'per_kg' | 'per_lb' | 'per_ton'
    | 'per_barrel'
    | 'per_package' | 'per_piece' | 'per_pallet'
    | 'per_container' 
    | 'per_cbm' | 'per_liter'
    | 'total' | 'fixed';
  unit_price: number;
  rate_usd_per_mt?: number;
  
  // Multi-currency support
  currency_code?: string;        // Original currency (USD, EUR, GBP, AED, etc.)
  original_amount?: number;      // Amount in original currency
  exchange_rate_to_usd?: number; // Exchange rate: 1 original_currency = X USD
  amount_usd: number;            // Final amount in USD (calculated)
  
  // Additional
  marks?: string;
  notes?: string;
  extra_json?: Record<string, any>;
  
  // Timestamps (from database)
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

// Batch interface for split shipments
export interface ShipmentBatch {
  id: string;
  batch_number: string;
  batch_name: string;
  // Quantity for this batch
  weight_ton: number | '';
  container_count: number | '';
  barrels: number | ''; // For crude oil tankers
  // Logistics details for this batch
  pol_id: string;
  pod_id: string;
  etd: string;
  eta: string;
  shipping_line_id: string;
  booking_no: string;
  bl_no: string;
  bol_numbers: string[];
  // Cargo-specific tracking for this batch
  container_numbers: string[]; // Changed from container_number to support multiple containers
  container_number?: string;
  vessel_name: string;
  vessel_imo: string;
  truck_plate_number: string;
  cmr: string;
  tanker_name: string;
  tanker_imo: string;
  // Documents for this batch
  documents: ShipmentDocument[];
  // Status
  status: 'planning' | 'in_transit' | 'arrived' | 'delivered';
  notes: string;
}

// Payment-related interfaces
export interface PaymentScheduleItem {
  id: string;
  milestone: 'down_payment' | 'upon_bl' | 'upon_arrival' | 'after_delivery' | 'net_30' | 'net_60' | 'custom';
  milestone_label: string;
  percentage: number | '';
  amount: number | '';
  due_date: string; // When payment is due (تاريخ الاستحقاق)
  payment_date: string; // Actual date when payment was made (تاريخ الدفع)
  payment_fund_id: string; // Fund we're paying FROM (for buyer)
  receipt_fund_id: string; // Fund we're receiving TO (for seller)
  status: 'pending' | 'paid' | 'overdue';
  notes: string;
}

export interface CostItem {
  id: string;
  description: string;
  amount: number | '';
  currency: string;
  category: 'freight' | 'insurance' | 'customs' | 'port_charges' | 'warehouse' | 'broker' | 'bank_charges' | 'other';
}

export interface PaymentBeneficiary {
  id: string;
  name: string;
  role: 'supplier' | 'freight_forwarder' | 'customs_broker' | 'warehouse' | 'trucking_company' | 'port_fees' | 'shipping_line' | 'other';
  amount: number | '';
  currency: string;
  payment_method: string;
  due_date: string;
  status: 'pending' | 'paid' | 'cancelled';
  bank_details: string;
  notes: string;
}

// Final Destination/Owner interface for shipments (where goods are going)
export interface FinalDestination {
  type: 'branch' | 'customer' | 'consignment' | '';
  branch_id?: string; // ID of selected parent branch (when type is 'branch')
  warehouse_id?: string; // ID of selected warehouse within the branch
  name: string;
  delivery_place?: string; // Final place of delivery (since beneficiary may have multiple locations)
  address?: string;
  contact?: string;
  selling_price?: number | '';
  notes?: string;
}

export interface ShipmentFormData {
  // Step 1: Basic Information
  transaction_type: 'incoming' | 'outgoing'; // incoming = purchase (buyer), outgoing = sale (seller)
  sn: string;
  subject: string;
  product_text: string;
  supplier_id: string; // Used when transaction_type = 'incoming' (we buy)
  customer_id: string; // Used when transaction_type = 'outgoing' (we sell)
  // Buyer/Importer (the party receiving the goods - for documentation)
  buyer_id?: string;
  buyer_name?: string;
  has_sales_contract?: boolean; // Whether this shipment is linked to a sales contract
  contract_id?: string;
  supplier_company_id?: string;
  supplier_name?: string;
  customer_company_id?: string;
  customer_name?: string;
  has_broker: boolean;
  broker_name: string;
  // Final Destination/Owner (when goods go to different location/owner)
  has_final_destination: boolean;
  final_destination: FinalDestination;
  // Internal Route fields (for land transport after POD)
  is_cross_border?: boolean;
  primary_border_crossing_id?: string;
  primary_border_name?: string;
  transit_countries?: string[];
  internal_transport_mode?: string;
  // Clearance category (transit/domestic/custom_clearance)
  clearance_category?: 'transit' | 'domestic' | 'custom_clearance' | null;
  // Contract-derived helpers (for prefilling)
  currency?: string;
  country_of_export?: string; // Country of Export (port of loading country)
  weight_value?: string;
  
  // Step 2: Commercial Terms
  cargo_type: string;
  tanker_type: string; // For tankers: 'crude_oil' or 'lpg'
  container_count: number | '';
  truck_count: number | ''; // Number of trucks when cargo_type = 'trucks'
  barrels: number | ''; // For crude oil tankers
  weight_ton: number | '';
  weight_unit: string; // 'tons', 'kg', or 'other'
  weight_unit_custom: string; // Custom unit when 'other' is selected
  fixed_price_usd_per_ton: number | ''; // Cost per ton (for buyer) or Cost per ton (for seller)
  selling_price_usd_per_ton: number | ''; // Selling price per ton (only for seller/outgoing)
  fixed_price_usd_per_barrel: number | ''; // Cost per barrel (for crude oil)
  selling_price_usd_per_barrel: number | ''; // Selling price per barrel (only for seller/outgoing)
  currency_code: string; // Currency for the shipment (USD, EUR, GBP, etc.)
  usd_equivalent_rate: number | ''; // USD exchange rate when currency is not USD
  payment_terms: string;
  incoterms: string;
  payment_method_other?: string;
  
  // Step 3: Financial Details
  // Down Payment
  down_payment_type: 'none' | 'percentage' | 'fixed_amount';
  down_payment_percentage: number | '';
  down_payment_amount: number | '';
  down_payment_due_date: string;
  down_payment_status: 'pending' | 'partial' | 'paid';
  
  // Payment Schedule
  payment_schedule: PaymentScheduleItem[];
  
  // Payment Method (standardized for international trade)
  payment_method: 'cash' | 'bank_transfer' | 'letter_of_credit' | 'documentary_collection' | 'open_account' | 'advance_payment' | 'partial_advance' | 'swift' | 'local_transfer' | 'third_party' | 'multiple' | 'other';
  payment_method_details: string;
  
  // SWIFT Details
  swift_code: string;
  beneficiary_name: string;
  beneficiary_bank_name: string;
  beneficiary_bank_address: string;
  beneficiary_account_number: string;
  beneficiary_iban: string;
  intermediary_bank: string;
  
  // Letter of Credit
  lc_number: string;
  lc_issuing_bank: string;
  advising_bank: string;
  lc_expiry_date: string;
  lc_amount: number | '';
  lc_type: 'sight' | 'usance' | ''; // LC type: sight (at sight) or usance (deferred)
  
  // Payment terms for open account / bank transfer
  payment_term_days: number | ''; // Net 30, 60, 90 days
  transfer_reference: string; // Bank transfer reference number
  
  // Cost Breakdown (for sellers and detailed tracking)
  additional_costs: CostItem[];
  freight_cost: number | '';
  insurance_cost: number | '';
  customs_duties: number | '';
  port_charges: number | '';
  warehouse_fees: number | '';
  broker_commission: number | '';
  bank_charges: number | '';
  other_costs_total: number | '';
  
  // Payment Beneficiaries
  payment_beneficiaries: PaymentBeneficiary[];
  
  // Step 3: Logistics
  // Batch/Split Shipment
  is_split_shipment: boolean;
  batches: ShipmentBatch[];
  
  // Single shipment logistics (used when is_split_shipment = false)
  pol_id: string;
  pol_name: string; // Display name for POL
  pod_id: string;
  pod_name: string; // Display name for POD
  etd: string; // Estimated Time of Departure
  eta: string; // Estimated Time of Arrival
  free_time_days: number | '';
  customs_clearance_date: string;
  shipping_line_id: string;
  shipping_line_name: string; // Display name for shipping line
  booking_no: string;
  bl_no: string;
  transportation_cost: number | '';
  transport_cost_responsibility: 'ours' | 'counterparty' | 'unspecified' | ''; // Who pays for transport
  
  // Internal route toggle
  define_internal_route_now: boolean; // Whether to define internal route fields now or later
  
  // Cargo-specific tracking fields
  // Multiple BOL (for all cargo types)
  bol_numbers: string[]; // Array of Bill of Lading numbers
  // Freight Containers - detailed per-container data
  containers: ContainerDetail[]; // Detailed container info (ID, weights, packages)
  container_numbers: string[]; // Legacy: simple array of container IDs (for backwards compatibility)
  container_number?: string;
  pol?: string;
  pod?: string;
  // General Cargo
  vessel_name: string;
  vessel_imo: string;
  // Trucks
  truck_plate_number: string;
  cmr: string; // CMR (Convention relative au contrat de transport international de Marchandises par Route)
  // Tankers
  tanker_name: string;
  tanker_imo: string;
  
  // Step 4: Product Lines (from contract wizard)
  lines: ProductLine[];
  
  // Step 5: Documents
  documentUploadMode: DocumentUploadMode;
  documents: ShipmentDocument[];
  combinedDocumentBundle: CombinedDocumentBundle | null;
  
  // Additional
  notes: string;
  
  // ========== SELLING WORKFLOW FIELDS (for outgoing shipments) ==========
  // Transport mode for selling
  transport_mode?: 'sea' | 'land' | 'air' | 'multimodal';
  
  // Selling status workflow
  selling_status?: 'draft' | 'confirmed' | 'docs_prep' | 'beyaname_issued' | 'loading' | 'in_transit' | 'delivered' | 'completed';
  
  // Source import linkage (for sales from existing imports)
  source_imports?: SourceImportLink[];
  
  // Beyaname (customs export declaration)
  beyaname_number?: string;
  beyaname_date?: string;
  beyaname_status?: 'pending' | 'issued' | 'cancelled';
  
  // Selling cost currency (can be different from payment currency)
  selling_cost_currency?: string;
  
  // Sea transport costs (Deniz Yolu)
  vgm_cost?: number | '';
  fumigation_cost?: number | '';
  container_loading_cost?: number | '';
  port_handling_cost?: number | '';
  sea_freight_cost?: number | '';
  customs_export_cost?: number | '';
  sea_insurance_cost?: number | '';
  
  // Land transport costs
  truck_transport_cost?: number | '';
  loading_unloading_cost?: number | '';
  border_crossing_cost?: number | '';
  land_customs_cost?: number | '';
  transit_fees_cost?: number | '';
  land_insurance_cost?: number | '';
  
  // Total selling costs (calculated)
  total_selling_costs?: number | '';
  
  // Bank account for receiving payment (selling only)
  payment_bank_account_id?: string;
  payment_bank_name?: string;
  payment_account_number?: string;
  payment_currency?: string;
}

// Source import link for sales
export interface SourceImportLink {
  id?: string;
  source_shipment_id: string;
  source_ci_number?: string;
  quantity_sold: number;
  quantity_unit: string;
  // Display fields
  source_product?: string;
  source_total_quantity?: number;
  quantity_remaining?: number;
}

// Document type for shipment
export interface ShipmentDocument {
  id: string; // Unique ID for each document
  type: DocumentType;
  file: File | null;
  fileName: string;
  uploadDate: string;
  notes: string;
}

// Combined document bundle for "all-in-one" upload mode
export interface CombinedDocumentBundle {
  file: File | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadDate: string;
  uploadedBy?: string;
  // Optional: which document types are contained in this bundle
  containedDocTypes: DocumentType[];
  notes: string;
}

// Document upload mode
export type DocumentUploadMode = 'separate' | 'combined';

// Document types based on trade direction
export type DocumentType =
  // Common documents (both buyer and seller)
  | 'proforma_invoice'
  | 'commercial_invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'certificate_of_origin'
  | 'product_specification'
  // Import/Buying documents (when we're the buyer)
  | 'purchase_order'
  | 'import_license'
  | 'customs_declaration'
  | 'goods_receipt_note'
  // Export/Selling documents (when we're the seller)
  | 'sales_contract'
  | 'export_license'
  | 'shipping_instructions'
  // Quality & Compliance (both)
  | 'health_certificate'
  | 'phytosanitary_certificate'
  | 'fumigation_certificate'
  | 'quality_certificate'
  | 'certificate_of_analysis'
  | 'halal_certificate'
  | 'insurance_certificate'
  // Financial
  | 'letter_of_credit'
  | 'bank_guarantee'
  | 'payment_receipt'
  // Other
  | 'other';

export const initialFormData: ShipmentFormData = {
  transaction_type: 'incoming', // Default to purchase/buyer mode
  sn: '',
  subject: '',
  product_text: '',
  supplier_id: '',
  customer_id: '',
  buyer_id: '',
  buyer_name: '',
  has_sales_contract: undefined, // Not set by default - user must choose
  has_broker: false,
  broker_name: '',
  // Final Destination/Owner defaults - Always required
  has_final_destination: true,
  final_destination: {
    type: '',
    name: '',
    delivery_place: '',
    address: '',
    contact: '',
    selling_price: '',
    notes: '',
  },
  // Internal Route defaults
  is_cross_border: false,
  primary_border_crossing_id: '',
  primary_border_name: '',
  transit_countries: [],
  internal_transport_mode: 'truck',
  clearance_category: null,
  cargo_type: '',
  tanker_type: '',
  container_count: '',
  truck_count: '',
  barrels: '',
  weight_ton: '',
  weight_unit: 'tons',
  weight_unit_custom: '',
  country_of_export: '', // Country of Export (port of loading country)
  fixed_price_usd_per_ton: '',
  selling_price_usd_per_ton: '',
  fixed_price_usd_per_barrel: '',
  selling_price_usd_per_barrel: '',
  currency_code: 'USD',
  usd_equivalent_rate: '',
  payment_terms: '',
  incoterms: '',
  payment_method_other: '',
  // Financial fields
  down_payment_type: 'none',
  down_payment_percentage: '',
  down_payment_amount: '',
  down_payment_due_date: '',
  down_payment_status: 'pending',
  payment_schedule: [],
  payment_method: 'swift',
  payment_method_details: '',
  swift_code: '',
  beneficiary_name: '',
  beneficiary_bank_name: '',
  beneficiary_bank_address: '',
  beneficiary_account_number: '',
  beneficiary_iban: '',
  intermediary_bank: '',
  lc_number: '',
  lc_issuing_bank: '',
  advising_bank: '',
  lc_expiry_date: '',
  lc_amount: '',
  lc_type: '',
  payment_term_days: '',
  transfer_reference: '',
  additional_costs: [],
  freight_cost: '',
  insurance_cost: '',
  customs_duties: '',
  port_charges: '',
  warehouse_fees: '',
  broker_commission: '',
  bank_charges: '',
  other_costs_total: '',
  payment_beneficiaries: [],
  // Logistics fields
  is_split_shipment: false,
  batches: [],
  pol_id: '',
  pol_name: '',
  pod_id: '',
  pod_name: '',
  etd: '',
  eta: '',
  free_time_days: '',
  customs_clearance_date: '',
  shipping_line_id: '',
  shipping_line_name: '',
  booking_no: '',
  bl_no: '',
  transportation_cost: '',
  transport_cost_responsibility: '',
  define_internal_route_now: false,
  bol_numbers: [],
  containers: [],
  container_numbers: [],
  container_number: '',
  pol: '',
  pod: '',
  vessel_name: '',
  vessel_imo: '',
  truck_plate_number: '',
  cmr: '',
  tanker_name: '',
  tanker_imo: '',
  lines: [],
  documentUploadMode: 'separate', // Default to separate uploads (existing behavior)
  documents: [],
  combinedDocumentBundle: null,
  notes: '',
  // Selling workflow defaults
  transport_mode: undefined,
  selling_status: undefined,
  source_imports: [],
  beyaname_number: '',
  beyaname_date: '',
  beyaname_status: undefined,
  // Sea transport costs
  vgm_cost: '',
  fumigation_cost: '',
  container_loading_cost: '',
  port_handling_cost: '',
  sea_freight_cost: '',
  customs_export_cost: '',
  sea_insurance_cost: '',
  // Land transport costs
  truck_transport_cost: '',
  loading_unloading_cost: '',
  border_crossing_cost: '',
  land_customs_cost: '',
  transit_fees_cost: '',
  land_insurance_cost: '',
  total_selling_costs: '',
};

export interface StepProps {
  formData: ShipmentFormData;
  onChange: (field: keyof ShipmentFormData, value: any) => void;
  errors: Partial<Record<keyof ShipmentFormData, string>>;
}

