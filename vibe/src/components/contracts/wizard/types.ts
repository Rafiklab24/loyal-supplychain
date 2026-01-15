/**
 * Contract Wizard Types V2
 * Redesigned to match actual proforma invoice structure
 */

// ========== STEP 1: COMMERCIAL PARTIES ==========

export interface CommercialParties {
  // Proforma Invoice Details
  proforma_number: string;
  invoice_date?: string;
  other_reference?: string;
  
  // Exporter
  exporter_company_id: string;
  exporter_name?: string;
  
  // Buyer
  buyer_company_id: string;
  buyer_name?: string;
  
  // Consignee (can be same as buyer or different)
  consignee_same_as_buyer: boolean;
  consignee_company_id?: string;
  consignee_name?: string;
  
  // Broker Information
  has_broker?: boolean; // Whether a broker is involved
  broker_buying_name?: string; // Broker name for buying/purchasing
  broker_selling_name?: string; // Broker name for selling
}

// ========== STEP 2: SHIPPING & GEOGRAPHY ==========

export interface ShippingGeography {
  // Country of Export = Country of Port of Loading
  // NOTE: This is NOT necessarily where the goods originate or where the exporting company is registered
  // Example: A company in Denmark exports from Singapore → country_of_export = "Singapore"
  country_of_export: string;
  
  // Country of Final Destination = Where goods will be delivered to final beneficiary
  country_of_final_destination: string;
  
  // Ports & Locations
  port_of_loading_id?: string;
  port_of_loading_name?: string;
  final_destination_id?: string;
  final_destination_name?: string;
  
  // Pre-carriage (optional)
  pre_carriage_by?: string;
  place_of_receipt?: string;
  
  // Vessel/Flight details (optional)
  vessel_flight_no?: string;
  
  // Estimated Shipment Date/Period
  estimated_shipment_date?: string; // ISO date string, defaults to 30 days from creation if not provided
}

// ========== STEP 3: TERMS & PAYMENT ==========

export interface ContractTerms {
  // Cargo Details (from proforma invoice)
  cargo_type?: string; // general_cargo, tankers, containers, trucks
  tanker_type?: string; // crude_oil, lpg
  barrels?: number | ''; // For crude oil tankers
  weight_ton?: number | ''; // Weight in tons (or custom unit)
  weight_unit?: string; // tons, kg, other
  weight_unit_custom?: string; // Custom unit if "other" selected
  container_count?: number | ''; // Number of containers/units
  
  // Delivery Terms
  incoterm: string; // CIF, FOB, CFR, etc.
  delivery_terms_detail: string; // e.g., "CIF MERSIN, TURKEY"
  
  // Payment Terms
  payment_terms: string; // e.g., "30 DAYS FROM ARRIVAL AT DESTINATION"
  payment_method?: string; // e.g., "L/C", "T/T", "CAD"
  
  // Currency
  currency_code: string;
  usd_equivalent_rate?: number; // Exchange rate to USD (if currency is not USD)
  
  // Special Clauses
  special_clauses: SpecialClause[];
}

export interface SpecialClause {
  id?: string;
  type: 'tolerance' | 'payment_condition' | 'detention_demurrage' | 'inspection' | 'other';
  description: string;
  tolerance_percentage?: number; // For tolerance clauses
}

// ========== STEP 4: PRODUCT LINES ==========

export interface ProductLine {
  id?: string; // Temporary for UI
  
  // Product Description
  type_of_goods: string; // Full description e.g., "45X20 FT CONTAINERS 1125 M.TONS INDIAN SELLA RICE..."
  product_id?: string; // Link to master products if exists
  product_name?: string;
  brand?: string; // LOYAL, LOYAL GOLDEN, ALMAEDA, BAN BAN
  trademark?: string; // Product trademark (e.g., "LOYAL GOLDEN", "ROYAL", etc.)
  
  // Country of Origin of Goods (per product line)
  // NOTE: Different products in the same shipment can have different origins
  // Example: Mixed shipment from Dubai with Vietnamese pepper + Brazilian pepper + Indian cumin
  country_of_origin?: string;
  
  // Packaging - WITH UNIT SUPPORT
  kind_of_packages: string; // BAGS, BOXES, CARTONS, etc.
  number_of_packages: number; // e.g., 10000 BAGS
  package_size: number; // e.g., 25
  package_size_unit: string; // KG, LB, L, ML, PIECE, etc. (from PACKAGE_SIZE_UNITS)
  unit_size?: number; // DEPRECATED - Kept for backward compatibility
  
  // Quantities - MULTI-UNIT SUPPORT
  quantity_mt: number; // Metric Tons (primary)
  quantity_kg?: number; // Kilograms (calculated or manual)
  quantity_lb?: number; // Pounds (calculated or manual)
  quantity_ton?: number; // US Tons (calculated or manual)
  
  // Volume (for liquid/gas products)
  volume_liters?: number;
  volume_cbm?: number;
  volume_gallons?: number;
  
  // Shipping Units
  number_of_containers?: number; // For container-based pricing (e.g., 20 containers)
  number_of_pallets?: number; // For pallet-based pricing
  
  // FLEXIBLE PRICING - Adaptive to different scenarios
  pricing_method: 
    | 'per_mt' | 'per_kg' | 'per_lb' | 'per_ton'
    | 'per_package' | 'per_piece' | 'per_pallet'
    | 'per_cbm' | 'per_liter'
    | 'total';
  unit_price: number; // Price per unit (MT, package, container, etc.)
  rate_usd_per_mt?: number; // USD per MT (for compatibility, calculated if needed)
  
  // Multi-currency support
  currency_code?: string;        // Original currency (USD, EUR, GBP, AED, etc.)
  original_amount?: number;      // Amount in original currency
  exchange_rate_to_usd?: number; // Exchange rate: 1 original_currency = X USD
  amount_usd: number;            // Final amount in USD (calculated)
  
  // Additional
  marks?: string;
  notes?: string;
}

// ========== STEP 5: BANKING & DOCUMENTATION ==========

export interface BankingDocumentation {
  // Primary Beneficiary Banking Details (Usually the Seller)
  beneficiary_name: string;
  beneficiary_address: string;
  beneficiary_account_no: string;
  beneficiary_bank_name: string;
  beneficiary_bank_address: string;
  beneficiary_swift_code?: string;
  correspondent_bank?: string;
  
  // Final Destination/Owner (If different from buyer - e.g., branch, warehouse, customer)
  has_final_destination: boolean; // Toggle to show/hide final destination fields
  final_destination_type?: 'branch' | 'customer' | 'consignment'; // Warehouse, external customer, or consignment goods
  final_destination_company_id?: string; // Link to companies table
  final_destination_name?: string; // Company/Warehouse name
  final_destination_delivery_place?: string; // Final place of delivery (beneficiary may have multiple locations)
  final_destination_address?: string; // Full address of destination
  final_destination_contact?: string; // Contact person/phone
  final_destination_selling_price?: number; // Only for customers, not branches
  final_destination_notes?: string; // Additional notes about destination
  
  // Documentation Requirements
  documentation: DocumentationRequirement[];
  documentation_notes?: string;
}

export interface DocumentationRequirement {
  id?: string;
  document_type: string; // "Invoice", "Certificate of Origin", "B/L", "Packing List", etc.
  required: boolean;
  attested_by?: string; // "Chamber of Commerce", "Embassy", etc.
  legalization_required: boolean;
  quantity?: number; // Number of copies
  notes?: string;
}

// ========== MAIN CONTRACT FORM DATA ==========

export interface ContractFormData {
  // Internal
  contract_no: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  direction: 'incoming' | 'outgoing'; // incoming = purchase (buyer), outgoing = sale (seller)
  subject?: string; // Brief description/subject of the contract
  
  // Step 1: Commercial Parties
  commercial_parties: CommercialParties;
  
  // Step 2: Shipping & Geography
  shipping: ShippingGeography;
  
  // Step 3: Terms & Payment
  terms: ContractTerms;
  
  // Step 4: Product Lines
  lines: ProductLine[];
  
  // Step 5: Banking & Documentation
  banking_docs: BankingDocumentation;
  
  // General
  notes?: string;
}

// ========== CONSTANTS ==========

export const INCOTERMS_V2 = [
  { value: 'EXW', label: 'EXW - Ex Works' },
  { value: 'FCA', label: 'FCA - Free Carrier' },
  { value: 'FAS', label: 'FAS - Free Alongside Ship' },
  { value: 'FOB', label: 'FOB - Free on Board' },
  { value: 'CFR', label: 'CFR - Cost and Freight' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
  { value: 'CPT', label: 'CPT - Carriage Paid To' },
  { value: 'CIP', label: 'CIP - Carriage and Insurance Paid To' },
  { value: 'DAP', label: 'DAP - Delivered at Place' },
  { value: 'DPU', label: 'DPU - Delivered at Place Unloaded' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
];

export const PAYMENT_METHODS = [
  { value: 'LC', label: 'Letter of Credit (L/C)' },
  { value: 'TT', label: 'Telegraphic Transfer (T/T)' },
  { value: 'CAD', label: 'Cash Against Documents (CAD)' },
  { value: 'DP', label: 'Documents Against Payment (D/P)' },
  { value: 'DA', label: 'Documents Against Acceptance (D/A)' },
  { value: 'OA', label: 'Open Account (O/A)' },
];

export const PACKAGE_TYPES = [
  { value: 'BAGS', label: 'Bags (أكياس)' },
  { value: 'BOXES', label: 'Boxes (صناديق)' },
  { value: 'CARTONS', label: 'Cartons (كراتين)' },
  { value: 'PALLETS', label: 'Pallets (منصات نقالة)' },
  { value: 'DRUMS', label: 'Drums (براميل)' },
  { value: 'BARRELS', label: 'Barrels (برميل)' },
  { value: 'CONTAINERS', label: 'Containers (حاويات)' },
  { value: 'BULK', label: 'Bulk (بدون تغليف / سائب)' },
];

export const BRAND_PRESETS = ['LOYAL', 'LOYAL GOLDEN', 'ALMAEDA', 'BAN BAN'];

export const PACKAGE_SIZE_PRESETS = [10, 25, 50];

// Import comprehensive pricing methods and units from units.ts
export { PRICING_METHODS, PACKAGE_SIZE_UNITS, CURRENCIES } from './units';

export const DOCUMENT_TYPES = [
  'Commercial Invoice',
  'Certificate of Origin',
  'Bill of Lading (B/L)',
  'Packing List',
  'Phytosanitary Certificate',
  'Fumigation Certificate',
  'Health Certificate',
  'Quality Certificate',
  'Certificate of Analysis',
  'Insurance Certificate',
  'Inspection Certificate',
];

export const ATTESTATION_AUTHORITIES = [
  'Chamber of Commerce',
  'Embassy',
  'Consulate',
  'Ministry of Commerce',
  'Notary Public',
  'None',
];

