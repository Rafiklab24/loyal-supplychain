/**
 * Field Mapping Audit Script
 * Scans frontend components and extracts field mappings to API/DB
 * 
 * Usage: npx ts-node tools/field-mapping-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Types
// ============================================================

interface FieldMapping {
  id: string;
  module: string;
  component: string;
  frontend_field: string;
  api_field: string;
  db_table: string;
  db_column: string;
  data_type: string;
  required: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'deprecated' | 'mismatch';
  notes: string;
  source_line?: number;
}

interface ComponentAudit {
  component: string;
  path: string;
  module: string;
  fields: FieldMapping[];
  total_fields: number;
  timestamp: string;
}

interface AuditReport {
  generated_at: string;
  version: string;
  summary: {
    total_components: number;
    total_fields: number;
    by_status: Record<string, number>;
    by_module: Record<string, number>;
  };
  components: ComponentAudit[];
  mismatches: FieldMapping[];
  deprecated_fields: FieldMapping[];
}

// ============================================================
// Database Schema Reference (from migrations)
// ============================================================

const DB_SCHEMA: Record<string, Record<string, { type: string; table: string }>> = {
  // Shipments main table
  shipments: {
    id: { type: 'UUID', table: 'logistics.shipments' },
    sn: { type: 'TEXT', table: 'logistics.shipments' },
    subject: { type: 'TEXT', table: 'logistics.shipments' },
    transaction_type: { type: 'VARCHAR', table: 'logistics.shipments' },
    status: { type: 'VARCHAR', table: 'logistics.shipments' },
    contract_id: { type: 'UUID', table: 'logistics.shipments' },
    product_text: { type: 'TEXT', table: 'logistics.shipments' },
    notes: { type: 'TEXT', table: 'logistics.shipments' },
    is_deleted: { type: 'BOOLEAN', table: 'logistics.shipments' },
    has_sales_contract: { type: 'BOOLEAN', table: 'logistics.shipments' },
    proforma_id: { type: 'UUID', table: 'logistics.shipments' },
  },
  // Shipment Parties (normalized)
  shipment_parties: {
    supplier_id: { type: 'UUID', table: 'logistics.shipment_parties' },
    customer_id: { type: 'UUID', table: 'logistics.shipment_parties' },
    shipping_line_id: { type: 'UUID', table: 'logistics.shipment_parties' },
    has_broker: { type: 'BOOLEAN', table: 'logistics.shipment_parties' },
    broker_name: { type: 'VARCHAR', table: 'logistics.shipment_parties' },
    final_beneficiary_company_id: { type: 'UUID', table: 'logistics.shipment_parties' },
    final_beneficiary_name: { type: 'TEXT', table: 'logistics.shipment_parties' },
    final_beneficiary_account_no: { type: 'TEXT', table: 'logistics.shipment_parties' },
    final_beneficiary_bank_name: { type: 'TEXT', table: 'logistics.shipment_parties' },
    final_beneficiary_bank_address: { type: 'TEXT', table: 'logistics.shipment_parties' },
    final_beneficiary_swift_code: { type: 'TEXT', table: 'logistics.shipment_parties' },
  },
  // Shipment Cargo (normalized)
  shipment_cargo: {
    product_text: { type: 'TEXT', table: 'logistics.shipment_cargo' },
    cargo_type: { type: 'VARCHAR', table: 'logistics.shipment_cargo' },
    tanker_type: { type: 'VARCHAR', table: 'logistics.shipment_cargo' },
    container_count: { type: 'INTEGER', table: 'logistics.shipment_cargo' },
    weight_ton: { type: 'NUMERIC', table: 'logistics.shipment_cargo' },
    weight_unit: { type: 'VARCHAR', table: 'logistics.shipment_cargo' },
    weight_unit_custom: { type: 'VARCHAR', table: 'logistics.shipment_cargo' },
    barrels: { type: 'INTEGER', table: 'logistics.shipment_cargo' },
    bags_count: { type: 'INTEGER', table: 'logistics.shipment_cargo' },
    gross_weight_kg: { type: 'NUMERIC', table: 'logistics.shipment_cargo' },
    net_weight_kg: { type: 'NUMERIC', table: 'logistics.shipment_cargo' },
    is_split_shipment: { type: 'BOOLEAN', table: 'logistics.shipment_cargo' },
    batches: { type: 'JSONB', table: 'logistics.shipment_cargo' },
    lines: { type: 'JSONB', table: 'logistics.shipment_cargo' },
    containers: { type: 'JSONB', table: 'logistics.shipment_cargo' },
    // Nested fields inside lines[] JSONB array
    product_id: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    product_name: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    type_of_goods: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    type: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    brand: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    kind_of_packages: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    number_of_packages: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    package_size: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    package_size_unit: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    quantity_mt: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    quantity: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    pricing_method: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    number_of_barrels: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    number_of_containers: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    number_of_pallets: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    unit_price: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    rate_usd_per_mt: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    amount_usd: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    unit_size: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    tolerance_percentage: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    description: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    volume_cbm: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    volume_liters: { type: 'JSONB', table: 'logistics.shipment_cargo.lines[]' },
    // Note: Document array fields (document_type, attested_by, required, legalization_required) 
    // are part of dynamic documentation arrays and don't need individual field tracking
    // Batch fields
    batch_name: { type: 'JSONB', table: 'logistics.shipment_cargo.batches[]' },
  },
  // Shipment Logistics (normalized)
  shipment_logistics: {
    pol_id: { type: 'UUID', table: 'logistics.shipment_logistics' },
    pod_id: { type: 'UUID', table: 'logistics.shipment_logistics' },
    pol_name: { type: 'DERIVED', table: 'UI-ONLY (lookup from pol_id)' },
    pod_name: { type: 'DERIVED', table: 'UI-ONLY (lookup from pod_id)' },
    eta: { type: 'DATE', table: 'logistics.shipment_logistics' },
    etd: { type: 'DATE', table: 'logistics.shipment_logistics' },
    free_time_days: { type: 'INTEGER', table: 'logistics.shipment_logistics' },
    customs_clearance_date: { type: 'DATE', table: 'logistics.shipment_logistics' },
    booking_no: { type: 'TEXT', table: 'logistics.shipment_logistics' },
    bl_no: { type: 'TEXT', table: 'logistics.shipment_logistics' },
    bol_numbers: { type: 'JSONB', table: 'logistics.shipment_logistics' },
    vessel_name: { type: 'VARCHAR', table: 'logistics.shipment_logistics' },
    vessel_imo: { type: 'VARCHAR', table: 'logistics.shipment_logistics' },
    tanker_name: { type: 'VARCHAR', table: 'logistics.shipment_logistics' },
    tanker_imo: { type: 'VARCHAR', table: 'logistics.shipment_logistics' },
    truck_plate_number: { type: 'VARCHAR', table: 'logistics.shipment_logistics' },
    cmr: { type: 'VARCHAR', table: 'logistics.shipment_logistics' },
    container_number: { type: 'VARCHAR', table: 'logistics.shipment_logistics' },
    has_final_destination: { type: 'BOOLEAN', table: 'logistics.shipment_logistics' },
    final_destination: { type: 'JSONB', table: 'logistics.shipment_logistics' },
    incoterms: { type: 'VARCHAR', table: 'logistics.shipment_logistics' },
  },
  // Shipment Financials (normalized)
  shipment_financials: {
    fixed_price_usd_per_ton: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    fixed_price_usd_per_barrel: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    selling_price_usd_per_ton: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    selling_price_usd_per_barrel: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    total_value_usd: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    paid_value_usd: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    balance_value_usd: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    transportation_cost: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    down_payment_type: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    down_payment_percentage: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    down_payment_amount: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    payment_method: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    payment_method_other: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    swift_code: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    lc_number: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    lc_issuing_bank: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    beneficiary_name: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    beneficiary_bank_name: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    beneficiary_bank_address: { type: 'TEXT', table: 'logistics.shipment_financials' },
    beneficiary_account_number: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    beneficiary_iban: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    intermediary_bank: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    payment_schedule: { type: 'JSONB', table: 'logistics.shipment_financials' },
    additional_costs: { type: 'JSONB', table: 'logistics.shipment_financials' },
    payment_beneficiaries: { type: 'JSONB', table: 'logistics.shipment_financials' },
    // Banking docs fields
    banking_docs: { type: 'JSONB', table: 'logistics.shipment_financials' },
    beneficiary_address: { type: 'TEXT', table: 'logistics.shipment_financials' },
    beneficiary_account_no: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    beneficiary_swift_code: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    correspondent_bank: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    documentation_responsibility: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    documentation_notes: { type: 'TEXT', table: 'logistics.shipment_financials' },
    // Additional financial fields
    down_payment_due_date: { type: 'DATE', table: 'logistics.shipment_financials' },
    down_payment_status: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    lc_amount: { type: 'NUMERIC', table: 'logistics.shipment_financials' },
    advising_bank: { type: 'VARCHAR', table: 'logistics.shipment_financials' },
    lc_expiry_date: { type: 'DATE', table: 'logistics.shipment_financials' },
    payment_method_details: { type: 'TEXT', table: 'logistics.shipment_financials' },
    // Delivery/payment terms object (contains incoterms, payment conditions, etc.)
    terms: { type: 'JSONB', table: 'logistics.shipment_financials (embedded in payment fields)' },
  },
  // Shipment Documents (normalized)
  shipment_documents: {
    contract_file_name: { type: 'VARCHAR', table: 'logistics.shipment_documents' },
    documents: { type: 'JSONB', table: 'logistics.shipment_documents' },
    quality_feedback: { type: 'TEXT', table: 'logistics.shipment_documents' },
    quality_feedback_rating: { type: 'VARCHAR', table: 'logistics.shipment_documents' },
  },
  // Contracts
  contracts: {
    id: { type: 'UUID', table: 'logistics.contracts' },
    contract_no: { type: 'VARCHAR', table: 'logistics.contracts' },
    buyer_company_id: { type: 'UUID', table: 'logistics.contracts' },
    seller_company_id: { type: 'UUID', table: 'logistics.contracts' },
    status: { type: 'VARCHAR', table: 'logistics.contracts' },
    direction: { type: 'VARCHAR', table: 'logistics.contracts' },
    subject: { type: 'TEXT', table: 'logistics.contracts' },
    currency_code: { type: 'VARCHAR', table: 'logistics.contracts' },
    notes: { type: 'TEXT', table: 'logistics.contracts' },
    extra_json: { type: 'JSONB', table: 'logistics.contracts' },
    // These are JSONB sections stored in extra_json
    commercial_parties: { type: 'JSONB', table: 'logistics.contracts (extra_json)' },
    shipping: { type: 'JSONB', table: 'logistics.contracts (extra_json)' },
    terms: { type: 'JSONB', table: 'logistics.contracts (extra_json)' },
    banking_docs: { type: 'JSONB', table: 'logistics.contracts (extra_json)' },
    lines: { type: 'JSONB', table: 'logistics.contracts (extra_json)' },
    // Nested contract fields - commercial_parties section
    proforma_number: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    invoice_date: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    other_reference: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    exporter_company_id: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    exporter_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    buyer_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    consignee_same_as_buyer: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    consignee_company_id: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    consignee_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    has_broker: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    broker_buying_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    broker_selling_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.commercial_parties)' },
    // Nested contract fields - shipping section
    country_of_origin: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    country_of_final_destination: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    port_of_loading_id: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    port_of_loading_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    final_destination_id: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    final_destination_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    pre_carriage_by: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    place_of_receipt: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    vessel_flight_no: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    estimated_shipment_date: { type: 'JSONB', table: 'logistics.contracts (extra_json.shipping)' },
    // Nested contract fields - terms section
    usd_equivalent_rate: { type: 'JSONB', table: 'logistics.contracts (extra_json.terms)' },
    payment_terms: { type: 'JSONB', table: 'logistics.contracts (extra_json.terms)' },
    incoterm: { type: 'JSONB', table: 'logistics.contracts (extra_json.terms)' },
    delivery_terms_detail: { type: 'JSONB', table: 'logistics.contracts (extra_json.terms)' },
    payment_method: { type: 'JSONB', table: 'logistics.contracts (extra_json.terms)' },
    // Nested contract fields - banking_docs section
    beneficiary_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
    beneficiary_address: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
    beneficiary_account_no: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
    beneficiary_swift_code: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
    beneficiary_bank_name: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
    beneficiary_bank_address: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
    correspondent_bank: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
    documentation_responsibility: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
    documentation_notes: { type: 'JSONB', table: 'logistics.contracts (extra_json.banking_docs)' },
  },
  // Contract Lines
  contract_lines: {
    contract_id: { type: 'UUID', table: 'logistics.contract_lines' },
    product_id: { type: 'UUID', table: 'logistics.contract_lines' },
    product_name: { type: 'VARCHAR', table: 'logistics.contract_lines' },
    planned_qty: { type: 'NUMERIC', table: 'logistics.contract_lines' },
    unit_price: { type: 'NUMERIC', table: 'logistics.contract_lines' },
    uom: { type: 'VARCHAR', table: 'logistics.contract_lines' },
    // Nested contract line fields (stored in contract extra_json.lines[])
    type: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    type_of_goods: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    brand: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    kind_of_packages: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    number_of_packages: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    package_size: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    package_size_unit: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    quantity_mt: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    quantity: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    unit_size: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    pricing_method: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    number_of_containers: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    number_of_pallets: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    rate_usd_per_mt: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    amount_usd: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    tolerance_percentage: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    description: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    volume_cbm: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    volume_liters: { type: 'JSONB', table: 'logistics.contracts (extra_json.lines[])' },
    // Note: Document array fields (document_type, attested_by, required, legalization_required) 
    // are part of dynamic documentation arrays and don't need individual field tracking
  },
  // Finance Transactions
  transactions: {
    id: { type: 'UUID', table: 'finance.transactions' },
    transaction_date: { type: 'DATE', table: 'finance.transactions' },
    amount_usd: { type: 'NUMERIC', table: 'finance.transactions' },
    amount_other: { type: 'NUMERIC', table: 'finance.transactions' },
    currency: { type: 'VARCHAR', table: 'finance.transactions' },
    transaction_type: { type: 'VARCHAR', table: 'finance.transactions' },
    direction: { type: 'VARCHAR', table: 'finance.transactions' },
    fund_source: { type: 'VARCHAR', table: 'finance.transactions' },
    party_name: { type: 'VARCHAR', table: 'finance.transactions' },
    description: { type: 'TEXT', table: 'finance.transactions' },
    contract_id: { type: 'UUID', table: 'finance.transactions' },
    shipment_id: { type: 'UUID', table: 'finance.transactions' },
  },
  // Companies (master_data schema)
  // Banking info stored in extra_json JSONB column
  companies: {
    id: { type: 'UUID', table: 'master_data.companies' },
    name: { type: 'VARCHAR', table: 'master_data.companies' },
    name_ar: { type: 'VARCHAR', table: 'master_data.companies' },
    company_type: { type: 'VARCHAR', table: 'master_data.companies' },
    address: { type: 'TEXT', table: 'master_data.companies' },
    phone: { type: 'VARCHAR', table: 'master_data.companies' },
    email: { type: 'VARCHAR', table: 'master_data.companies' },
    tax_id: { type: 'VARCHAR', table: 'master_data.companies' },
    // Banking info (stored in extra_json.banking JSONB)
    bank_name: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    bank_branch: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    branch: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    account_number: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    account_holder_name: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    iban: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    swift_code: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    currency: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    bank_address: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    intermediary_bank: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
    notes: { type: 'JSONB', table: 'master_data.companies (extra_json.banking)' },
  },
  // Products (master_data schema)
  products: {
    id: { type: 'UUID', table: 'master_data.products' },
    name: { type: 'VARCHAR', table: 'master_data.products' },
    name_ar: { type: 'VARCHAR', table: 'master_data.products' },
    description: { type: 'TEXT', table: 'master_data.products' },
    category: { type: 'VARCHAR', table: 'master_data.products' },
    category_type: { type: 'VARCHAR', table: 'master_data.products' },
    hs_code: { type: 'VARCHAR', table: 'master_data.products' },
    country_of_origin: { type: 'VARCHAR', table: 'master_data.products' },
    is_active: { type: 'BOOLEAN', table: 'master_data.products' },
    sku: { type: 'VARCHAR', table: 'master_data.products' },
    brand: { type: 'VARCHAR', table: 'master_data.products' },
    uom: { type: 'VARCHAR', table: 'master_data.products' },
    pack_type: { type: 'VARCHAR', table: 'master_data.products' },
    is_seasonal: { type: 'BOOLEAN', table: 'master_data.products' },
    // Price benchmark fields (master_data.product_price_benchmarks table)
    price_usd_per_mt: { type: 'NUMERIC', table: 'master_data.product_price_benchmarks' },
    price_date: { type: 'DATE', table: 'master_data.product_price_benchmarks' },
    price_source: { type: 'VARCHAR', table: 'master_data.product_price_benchmarks' },
    incoterm: { type: 'VARCHAR', table: 'master_data.product_price_benchmarks' },
    // Season calendar fields (master_data.product_seasons table)
    origin_country: { type: 'VARCHAR', table: 'master_data.product_seasons' },
    planting_start_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    planting_end_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    harvest_start_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    harvest_end_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    peak_start_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    peak_end_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    off_season_start_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    off_season_end_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    // Notes field - exists in both products table and price_benchmarks table
    // In ProductFormModal context: master_data.products
    // In PriceBenchmarkModal context: master_data.product_price_benchmarks
    notes: { type: 'TEXT', table: 'master_data.products' },
  },
  // Price Benchmarks (separate table for price history tracking)
  product_price_benchmarks: {
    id: { type: 'UUID', table: 'master_data.product_price_benchmarks' },
    product_id: { type: 'UUID', table: 'master_data.product_price_benchmarks' },
    price_date: { type: 'DATE', table: 'master_data.product_price_benchmarks' },
    price_usd_per_mt: { type: 'NUMERIC', table: 'master_data.product_price_benchmarks' },
    origin_country: { type: 'TEXT', table: 'master_data.product_price_benchmarks' },
    incoterm: { type: 'TEXT', table: 'master_data.product_price_benchmarks' },
    price_source: { type: 'TEXT', table: 'master_data.product_price_benchmarks' },
    notes: { type: 'TEXT', table: 'master_data.product_price_benchmarks' },
  },
  // Product Seasons (seasonal availability by country)
  product_seasons: {
    id: { type: 'UUID', table: 'master_data.product_seasons' },
    product_id: { type: 'UUID', table: 'master_data.product_seasons' },
    origin_country: { type: 'TEXT', table: 'master_data.product_seasons' },
    planting_start_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    planting_end_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    harvest_start_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    harvest_end_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    peak_start_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    peak_end_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    off_season_start_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    off_season_end_month: { type: 'INTEGER', table: 'master_data.product_seasons' },
    notes: { type: 'TEXT', table: 'master_data.product_seasons' },
  },
  // Deliveries / Land Transport (logistics.outbound_deliveries table)
  deliveries: {
    id: { type: 'UUID', table: 'logistics.outbound_deliveries' },
    shipment_id: { type: 'UUID', table: 'logistics.outbound_deliveries' },
    delivery_date: { type: 'DATE', table: 'logistics.outbound_deliveries' },
    delivery_number: { type: 'TEXT', table: 'logistics.outbound_deliveries' },
    status: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    driver_name: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    vehicle_number: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    notes: { type: 'TEXT', table: 'logistics.outbound_deliveries' },
    destination: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    origin: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    transport_company_id: { type: 'UUID', table: 'logistics.outbound_deliveries' },
    vehicle_type: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    truck_plate_number: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    driver_phone: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    goods_description: { type: 'TEXT', table: 'logistics.outbound_deliveries' },
    container_id: { type: 'TEXT', table: 'logistics.outbound_deliveries' },
    package_count: { type: 'INTEGER', table: 'logistics.outbound_deliveries' },
    weight_kg: { type: 'NUMERIC', table: 'logistics.outbound_deliveries' },
    customer_name: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    customer_phone: { type: 'VARCHAR', table: 'logistics.outbound_deliveries' },
    transport_cost: { type: 'NUMERIC', table: 'logistics.outbound_deliveries' },
    selling_price: { type: 'NUMERIC', table: 'logistics.outbound_deliveries' },
  },
  // Customs Clearing Costs
  customs_clearing_costs: {
    file_number: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    shipment_id: { type: 'UUID', table: 'finance.customs_clearing_costs' },
    transaction_type: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    goods_type: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    containers_cars_count: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    goods_weight: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    cost_description: { type: 'TEXT', table: 'finance.customs_clearing_costs' },
    clearance_type: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    payment_status: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    currency: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    total_clearing_cost: { type: 'NUMERIC', table: 'finance.customs_clearing_costs' },
    original_clearing_amount: { type: 'NUMERIC', table: 'finance.customs_clearing_costs' },
    extra_cost_amount: { type: 'NUMERIC', table: 'finance.customs_clearing_costs' },
    extra_cost_description: { type: 'TEXT', table: 'finance.customs_clearing_costs' },
    cost_responsibility: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    destination_final_beneficiary: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    bol_number: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    car_plate: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    client_name: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    invoice_number: { type: 'VARCHAR', table: 'finance.customs_clearing_costs' },
    invoice_amount: { type: 'NUMERIC', table: 'finance.customs_clearing_costs' },
    invoice_date: { type: 'DATE', table: 'finance.customs_clearing_costs' },
    notes: { type: 'TEXT', table: 'finance.customs_clearing_costs' },
  },
};

// ============================================================
// Component Definitions
// ============================================================

interface ComponentDef {
  name: string;
  path: string;
  module: string;
  db_tables: string[];
}

// All shipment-related tables (normalized structure)
const ALL_SHIPMENT_TABLES = ['shipments', 'shipment_parties', 'shipment_cargo', 'shipment_logistics', 'shipment_financials', 'shipment_documents'];

// All contract-related tables
const ALL_CONTRACT_TABLES = ['contracts', 'contract_lines'];

// ============================================================
// Module names aligned with Sidebar navigation (Sidebar.tsx)
// ============================================================
// Sidebar Module Key  | Arabic Name           | Audit Module Name
// --------------------|----------------------|------------------
// shipments           | الشحنات              | Shipments
// contracts           | العقود               | Contracts
// products            | المنتجات             | Products
// dashboard (tasks)   | المهام               | Tasks
// companies           | الشركات              | Companies
// finance             | المالية              | Finance
// accounting          | المحاسبة             | Accounting
// customs             | التخليص الجمركي      | CustomsClearance
// land_transport      | النقل البري          | LandTransport
// analytics           | تحليل البيانات       | Analytics
// ============================================================

const COMPONENTS_TO_AUDIT: ComponentDef[] = [
  // ============================================================
  // SHIPMENTS MODULE (الشحنات)
  // Route: /shipments
  // ============================================================
  { name: 'Step1BasicInfo.tsx', path: 'vibe/src/components/shipments/wizard/Step1BasicInfo.tsx', module: 'Shipments', db_tables: ALL_SHIPMENT_TABLES },
  { name: 'Step2ProductLines.tsx', path: 'vibe/src/components/shipments/wizard/Step2ProductLines.tsx', module: 'Shipments', db_tables: ALL_SHIPMENT_TABLES },
  { name: 'Step3DeliveryTerms.tsx', path: 'vibe/src/components/shipments/wizard/Step3DeliveryTerms.tsx', module: 'Shipments', db_tables: ALL_SHIPMENT_TABLES },
  { name: 'DeliveryPaymentTerms.tsx', path: 'vibe/src/components/common/DeliveryPaymentTerms.tsx', module: 'Shipments', db_tables: [...ALL_SHIPMENT_TABLES, 'contracts'] },
  { name: 'Step4Logistics.tsx', path: 'vibe/src/components/shipments/wizard/Step4Logistics.tsx', module: 'Shipments', db_tables: ALL_SHIPMENT_TABLES },
  { name: 'Step5Documents.tsx', path: 'vibe/src/components/shipments/wizard/Step5Documents.tsx', module: 'Shipments', db_tables: ALL_SHIPMENT_TABLES },
  { name: 'Step2Financial.tsx', path: 'vibe/src/components/shipments/wizard/Step2Financial.tsx', module: 'Shipments', db_tables: ALL_SHIPMENT_TABLES },
  { name: 'Step5BankingDocs.tsx', path: 'vibe/src/components/shipments/wizard/Step5BankingDocs.tsx', module: 'Shipments', db_tables: ALL_SHIPMENT_TABLES },
  { name: 'BatchManagement.tsx', path: 'vibe/src/components/shipments/wizard/BatchManagement.tsx', module: 'Shipments', db_tables: ALL_SHIPMENT_TABLES },
  
  // ============================================================
  // CONTRACTS MODULE (العقود)
  // Route: /contracts
  // ============================================================
  { name: 'Step1CommercialParties.tsx', path: 'vibe/src/components/contracts/wizard/Step1CommercialParties.tsx', module: 'Contracts', db_tables: ALL_CONTRACT_TABLES },
  { name: 'Step2ShippingGeography.tsx', path: 'vibe/src/components/contracts/wizard/Step2ShippingGeography.tsx', module: 'Contracts', db_tables: ALL_CONTRACT_TABLES },
  { name: 'Step3TermsPayment.tsx', path: 'vibe/src/components/contracts/wizard/Step3TermsPayment.tsx', module: 'Contracts', db_tables: ALL_CONTRACT_TABLES },
  { name: 'Step4ProductLines.tsx', path: 'vibe/src/components/contracts/wizard/Step4ProductLines.tsx', module: 'Contracts', db_tables: ALL_CONTRACT_TABLES },
  { name: 'Step5BankingDocs.tsx', path: 'vibe/src/components/contracts/wizard/Step5BankingDocs.tsx', module: 'Contracts', db_tables: ALL_CONTRACT_TABLES },
  { name: 'ContractUpdateRequestModal.tsx', path: 'vibe/src/components/contracts/ContractUpdateRequestModal.tsx', module: 'Contracts', db_tables: ALL_CONTRACT_TABLES },
  
  // ============================================================
  // PRODUCTS MODULE (المنتجات)
  // Route: /products
  // DB Schema: master_data (products, product_price_benchmarks, product_seasons)
  // ============================================================
  { name: 'ProductFormModal.tsx', path: 'vibe/src/components/products/ProductFormModal.tsx', module: 'Products', db_tables: ['products'] },
  { name: 'PriceBenchmarkModal.tsx', path: 'vibe/src/components/products/PriceBenchmarkModal.tsx', module: 'Products', db_tables: ['product_price_benchmarks'] },
  { name: 'SeasonFormModal.tsx', path: 'vibe/src/components/products/SeasonFormModal.tsx', module: 'Products', db_tables: ['product_seasons'] },
  
  // ============================================================
  // TASKS MODULE (المهام)
  // Route: /tasks
  // Note: Read-only display page - tasks are auto-generated from shipment/contract status
  // ============================================================
  // No form components - TasksPage.tsx is display-only
  
  // ============================================================
  // COMPANIES MODULE (الشركات)
  // Route: /companies
  // ============================================================
  { name: 'BankingInfoForm.tsx', path: 'vibe/src/components/companies/BankingInfoForm.tsx', module: 'Companies', db_tables: ['companies'] },
  
  // ============================================================
  // FINANCE MODULE (المالية)
  // Route: /finance
  // ============================================================
  { name: 'NewTransactionWizard.tsx', path: 'vibe/src/components/finance/NewTransactionWizard.tsx', module: 'Finance', db_tables: ['transactions'] },
  { name: 'FinancialWizard.tsx', path: 'vibe/src/components/finance/FinancialWizard.tsx', module: 'Finance', db_tables: ['transactions'] },
  
  // ============================================================
  // ACCOUNTING MODULE (المحاسبة)
  // Route: /accounting
  // Note: Read-only display page - shows aggregated data from other modules
  // ============================================================
  // No form components - AccountingPage.tsx is display-only
  
  // ============================================================
  // CUSTOMS CLEARANCE MODULE (التخليص الجمركي)
  // Route: /customs-clearing-costs, /customs-clearing-batches
  // ============================================================
  { name: 'CustomsClearingCostModal.tsx', path: 'vibe/src/components/customs/CustomsClearingCostModal.tsx', module: 'CustomsClearance', db_tables: ['customs_clearing_costs'] },
  { name: 'FileFirstCostEntry.tsx', path: 'vibe/src/components/customs/FileFirstCostEntry.tsx', module: 'CustomsClearance', db_tables: ['customs_clearing_costs'] },
  { name: 'CreateBatchModal.tsx', path: 'vibe/src/components/customs/CreateBatchModal.tsx', module: 'CustomsClearance', db_tables: ['customs_clearing_costs'] },
  
  // ============================================================
  // LAND TRANSPORT MODULE (النقل البري)
  // Route: /land-transport
  // ============================================================
  { name: 'DeliveryFormModal.tsx', path: 'vibe/src/components/land-transport/DeliveryFormModal.tsx', module: 'LandTransport', db_tables: ['deliveries'] },
  
  // ============================================================
  // ANALYTICS MODULE (تحليل البيانات والإحصاء)
  // Route: /analytics
  // Note: Read-only display page - shows price trends and analytics
  // ============================================================
  // No form components - AnalyticsPage.tsx is display-only
];

// ============================================================
// Field Extraction Logic
// ============================================================

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function extractFieldsFromOnChange(content: string, componentName: string, module: string, dbTables: string[]): FieldMapping[] {
  const fields: FieldMapping[] = [];
  const seenFields = new Set<string>();
  
  const addField = (fieldName: string, isNested: boolean = false) => {
    if (seenFields.has(fieldName)) return;
    seenFields.add(fieldName);
    
    const snakeCase = camelToSnake(fieldName);
    const dbInfo = findDbColumn(snakeCase, dbTables);
    
    fields.push({
      id: `${module.toLowerCase()}-${componentName.replace('.tsx', '').replace('.ts', '')}-${fieldName}`,
      module,
      component: componentName,
      frontend_field: isNested ? `lines[].${fieldName}` : fieldName,
      api_field: snakeCase,
      db_table: dbInfo?.table || 'UNKNOWN',
      db_column: dbInfo?.column || snakeCase,
      data_type: dbInfo?.type || 'UNKNOWN',
      required: false,
      status: dbInfo ? 'approved' : 'mismatch',
      notes: isNested ? 'Nested field inside lines[] array (JSONB)' : (dbInfo ? '' : 'DB column not found in schema'),
    });
  };
  
  let match;
  
  // Pattern 1: onChange('field_name', value) or onChange("field_name", value)
  const onChangeRegex = /onChange\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = onChangeRegex.exec(content)) !== null) {
    addField(match[1]);
  }
  
  // Pattern 2: setFormData({ ...formData, field_name: value })
  const setFormDataRegex = /setFormData\s*\(\s*\{\s*\.\.\.formData\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  while ((match = setFormDataRegex.exec(content)) !== null) {
    addField(match[1]);
  }
  
  // Pattern 3: updateLineField(index, 'field_name', value) - for nested product line fields
  const updateLineFieldRegex = /updateLineField\s*\(\s*\w+\s*,\s*['"]([^'"]+)['"]/g;
  while ((match = updateLineFieldRegex.exec(content)) !== null) {
    addField(match[1], true); // Mark as nested
  }
  
  // Pattern 4: handleFieldChange('field_name', value) - for shared components like DeliveryPaymentTerms
  const handleFieldChangeRegex = /handleFieldChange\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = handleFieldChangeRegex.exec(content)) !== null) {
    addField(match[1]);
  }
  
  // Pattern 4b: handleChange('field_name', value) - for modals like CustomsClearingCostModal
  const handleChangeRegex = /handleChange\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = handleChangeRegex.exec(content)) !== null) {
    addField(match[1]);
  }
  
  // Pattern 6: updateFormData('field_name', value) - for Step2Financial
  const updateFormDataRegex = /updateFormData\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = updateFormDataRegex.exec(content)) !== null) {
    addField(match[1]);
  }
  
  // Pattern 7: handleBatchChange(id, 'field_name', value) - for BatchManagement
  const handleBatchChangeRegex = /handleBatchChange\s*\([^,]+,\s*['"]([^'"]+)['"]/g;
  while ((match = handleBatchChangeRegex.exec(content)) !== null) {
    addField(match[1], true); // Nested in batch
  }
  
  // Pattern 8: onArrayChange('section', 'array', index, 'field_name', value) - for contract product lines
  const onArrayChangeRegex = /onArrayChange\s*\([^,]+,\s*[^,]+,\s*[^,]+,\s*['"]([^'"]+)['"]/g;
  while ((match = onArrayChangeRegex.exec(content)) !== null) {
    addField(match[1], true); // Nested in array
  }
  
  // Pattern 9: handlePackageChange(index, 'field_name', value)
  const handlePackageChangeRegex = /handlePackageChange\s*\([^,]+,\s*['"]([^'"]+)['"]/g;
  while ((match = handlePackageChangeRegex.exec(content)) !== null) {
    addField(match[1], true);
  }
  
  // Pattern 10: updateField('field_name', value) - for FinancialWizard
  const updateFieldRegex = /updateField\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = updateFieldRegex.exec(content)) !== null) {
    addField(match[1]);
  }
  
  // Pattern 5: data-field-name="field_name" - direct extraction from data attributes
  const dataFieldNameRegex = /data-field-name=["']([^"']+)["']/g;
  while ((match = dataFieldNameRegex.exec(content)) !== null) {
    const fieldName = match[1];
    // Skip type-suffixed attributes like "final_destination_type"
    if (!fieldName.endsWith('_type') && !fieldName.endsWith('_alt')) {
      addField(fieldName);
    }
  }
  
  return fields;
}

function extractFieldsFromInterface(content: string, componentName: string, module: string, dbTables: string[]): FieldMapping[] {
  const fields: FieldMapping[] = [];
  const seenFields = new Set<string>();
  
  // Match interface/type definitions with their fields
  const interfaceRegex = /(?:interface|type)\s+\w+\s*(?:=\s*)?\{([^}]+)\}/g;
  let interfaceMatch;
  
  while ((interfaceMatch = interfaceRegex.exec(content)) !== null) {
    const interfaceBody = interfaceMatch[1];
    
    // Extract field definitions: fieldName: type or fieldName?: type
    const fieldRegex = /(\w+)\s*\??\s*:\s*([^;,\n]+)/g;
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(interfaceBody)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2].trim();
      
      // Skip method definitions and complex types
      if (fieldType.includes('=>') || fieldName === 'id') continue;
      if (seenFields.has(fieldName)) continue;
      seenFields.add(fieldName);
      
      const snakeCase = camelToSnake(fieldName);
      const dbInfo = findDbColumn(snakeCase, dbTables);
      const isRequired = !fieldMatch[0].includes('?');
      
      fields.push({
        id: `${module.toLowerCase()}-${componentName.replace('.tsx', '').replace('.ts', '')}-${fieldName}`,
        module,
        component: componentName,
        frontend_field: fieldName,
        api_field: snakeCase,
        db_table: dbInfo?.table || 'UNKNOWN',
        db_column: dbInfo?.column || snakeCase,
        data_type: dbInfo?.type || mapTsTypeToDb(fieldType),
        required: isRequired,
        status: dbInfo ? 'approved' : 'mismatch',
        notes: dbInfo ? '' : 'DB column not found in schema',
      });
    }
  }
  
  return fields;
}

function findDbColumn(snakeField: string, dbTables: string[]): { table: string; column: string; type: string } | null {
  for (const tableName of dbTables) {
    const tableSchema = DB_SCHEMA[tableName];
    if (tableSchema && tableSchema[snakeField]) {
      return {
        table: tableSchema[snakeField].table,
        column: snakeField,
        type: tableSchema[snakeField].type,
      };
    }
  }
  return null;
}

function mapTsTypeToDb(tsType: string): string {
  const cleanType = tsType.replace(/\s/g, '').toLowerCase();
  
  if (cleanType.includes('string')) return 'TEXT';
  if (cleanType.includes('number')) return 'NUMERIC';
  if (cleanType.includes('boolean')) return 'BOOLEAN';
  if (cleanType.includes('date')) return 'DATE';
  if (cleanType.includes('[]') || cleanType.includes('array')) return 'JSONB';
  if (cleanType.includes('{')) return 'JSONB';
  
  return 'UNKNOWN';
}

// ============================================================
// Main Audit Function
// ============================================================

function auditComponent(componentDef: ComponentDef, basePath: string): ComponentAudit {
  const fullPath = path.join(basePath, componentDef.path);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${fullPath}`);
    return {
      component: componentDef.name,
      path: componentDef.path,
      module: componentDef.module,
      fields: [],
      total_fields: 0,
      timestamp: new Date().toISOString(),
    };
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  let fields: FieldMapping[] = [];
  
  if (componentDef.name.endsWith('.ts') && componentDef.name.includes('types')) {
    // Type definition file - extract from interfaces
    fields = extractFieldsFromInterface(content, componentDef.name, componentDef.module, componentDef.db_tables);
  } else {
    // Component file - extract from onChange calls
    fields = extractFieldsFromOnChange(content, componentDef.name, componentDef.module, componentDef.db_tables);
  }
  
  // Mark required fields (look for required asterisks)
  const requiredPattern = /<span[^>]*className[^>]*text-red[^>]*>\s*\*\s*<\/span>/g;
  fields.forEach(field => {
    // Check if field label has required indicator
    const fieldLabelPattern = new RegExp(`['"]${field.frontend_field}['"][^}]*\\*`, 'i');
    if (fieldLabelPattern.test(content) || content.includes(`{t('${field.frontend_field}')}`)) {
      // Additional check - not a robust solution but helps
    }
  });
  
  return {
    component: componentDef.name,
    path: componentDef.path,
    module: componentDef.module,
    fields,
    total_fields: fields.length,
    timestamp: new Date().toISOString(),
  };
}

function runAudit(): AuditReport {
  const basePath = process.cwd();
  console.log('🔍 Starting Field Mapping Audit...\n');
  console.log(`📂 Base path: ${basePath}\n`);
  
  const componentAudits: ComponentAudit[] = [];
  const allFields: FieldMapping[] = [];
  
  for (const componentDef of COMPONENTS_TO_AUDIT) {
    console.log(`📄 Auditing ${componentDef.name}...`);
    const audit = auditComponent(componentDef, basePath);
    componentAudits.push(audit);
    allFields.push(...audit.fields);
    console.log(`   Found ${audit.total_fields} fields`);
  }
  
  // Calculate summary statistics
  const byStatus: Record<string, number> = {};
  const byModule: Record<string, number> = {};
  
  // Initialize all sidebar modules (even those with 0 fields) to ensure they appear in output
  // Order matches sidebar: Shipments, Contracts, Products, Tasks, Companies, Finance, Accounting, CustomsClearance, LandTransport, Analytics
  const ALL_SIDEBAR_MODULES = [
    'Shipments',       // الشحنات
    'Contracts',       // العقود
    'Products',        // المنتجات
    'Tasks',           // المهام (read-only)
    'Companies',       // الشركات
    'Finance',         // المالية
    'Accounting',      // المحاسبة (read-only)
    'CustomsClearance', // التخليص الجمركي
    'LandTransport',   // النقل البري
    'Analytics',       // تحليل البيانات (read-only)
  ];
  
  ALL_SIDEBAR_MODULES.forEach(module => {
    byModule[module] = 0;
  });
  
  allFields.forEach(field => {
    byStatus[field.status] = (byStatus[field.status] || 0) + 1;
    byModule[field.module] = (byModule[field.module] || 0) + 1;
  });
  
  const mismatches = allFields.filter(f => f.status === 'mismatch');
  const deprecated = allFields.filter(f => f.status === 'deprecated');
  
  const report: AuditReport = {
    generated_at: new Date().toISOString(),
    version: '1.0.0',
    summary: {
      total_components: componentAudits.length,
      total_fields: allFields.length,
      by_status: byStatus,
      by_module: byModule,
    },
    components: componentAudits,
    mismatches,
    deprecated_fields: deprecated,
  };
  
  console.log('\n✅ Audit complete!\n');
  console.log('📊 Summary:');
  console.log(`   Total Components: ${report.summary.total_components}`);
  console.log(`   Total Fields: ${report.summary.total_fields}`);
  console.log(`   Mismatches: ${mismatches.length}`);
  console.log(`   By Status:`, byStatus);
  console.log(`   By Module:`, byModule);
  
  return report;
}

// ============================================================
// Output Generation
// ============================================================

function saveReport(report: AuditReport, basePath: string): void {
  // Save JSON mapping file
  const jsonPath = path.join(basePath, 'tools', 'field-mappings.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 JSON saved: ${jsonPath}`);
  
  // Generate markdown report
  const mdPath = path.join(basePath, 'FIELD_MAPPING_AUDIT_REPORT.md');
  const mdContent = generateMarkdownReport(report);
  fs.writeFileSync(mdPath, mdContent);
  console.log(`📝 Markdown saved: ${mdPath}`);
}

function generateMarkdownReport(report: AuditReport): string {
  let md = `# Field Mapping Audit Report

**Generated**: ${report.generated_at}  
**Version**: ${report.version}

---

## Summary

| Metric | Count |
|--------|-------|
| Total Components Audited | ${report.summary.total_components} |
| Total Fields Found | ${report.summary.total_fields} |
| Mismatches | ${report.mismatches.length} |

### By Status

| Status | Count |
|--------|-------|
${Object.entries(report.summary.by_status).map(([status, count]) => `| ${status} | ${count} |`).join('\n')}

### By Module (Aligned with Sidebar)

| Module | Arabic Name | Fields | Notes |
|--------|-------------|--------|-------|
${Object.entries(report.summary.by_module).map(([module, count]) => {
  const moduleInfo: Record<string, { ar: string; note: string }> = {
    'Shipments': { ar: 'الشحنات', note: '' },
    'Contracts': { ar: 'العقود', note: '' },
    'Products': { ar: 'المنتجات', note: '' },
    'Tasks': { ar: 'المهام', note: 'Read-only (auto-generated)' },
    'Companies': { ar: 'الشركات', note: '' },
    'Finance': { ar: 'المالية', note: '' },
    'Accounting': { ar: 'المحاسبة', note: 'Read-only (display-only)' },
    'CustomsClearance': { ar: 'التخليص الجمركي', note: '' },
    'LandTransport': { ar: 'النقل البري', note: '' },
    'Analytics': { ar: 'تحليل البيانات', note: 'Read-only (display-only)' },
  };
  const info = moduleInfo[module] || { ar: '', note: '' };
  return `| ${module} | ${info.ar} | ${count} | ${info.note} |`;
}).join('\n')}

---

## Mismatches (Require Attention)

${report.mismatches.length === 0 ? '*No mismatches found*' : ''}

${report.mismatches.map(m => `
### ${m.component} - \`${m.frontend_field}\`

| Property | Value |
|----------|-------|
| Module | ${m.module} |
| Frontend Field | \`${m.frontend_field}\` |
| Expected API Field | \`${m.api_field}\` |
| Expected DB Table | ${m.db_table} |
| Status | **${m.status}** |
| Notes | ${m.notes} |
`).join('\n')}

---

## Component Details

${report.components.map(comp => `
### ${comp.module}: ${comp.component}

**Path**: \`${comp.path}\`  
**Fields Found**: ${comp.total_fields}

| Frontend Field | API Field | DB Table | DB Column | Type | Status |
|----------------|-----------|----------|-----------|------|--------|
${comp.fields.map(f => `| \`${f.frontend_field}\` | \`${f.api_field}\` | ${f.db_table} | ${f.db_column} | ${f.data_type} | ${f.status} |`).join('\n')}
`).join('\n')}

---

## Mapping Quick Reference

### Shipments Module

| Frontend (camelCase) | API/DB (snake_case) | Normalized Table |
|---------------------|---------------------|------------------|
| supplierCompanyId | supplier_id | shipment_parties |
| customerCompanyId | customer_id | shipment_parties |
| shippingLineId | shipping_line_id | shipment_parties |
| cargoType | cargo_type | shipment_cargo |
| containerCount | container_count | shipment_cargo |
| weightTon | weight_ton | shipment_cargo |
| polId | pol_id | shipment_logistics |
| podId | pod_id | shipment_logistics |
| eta | eta | shipment_logistics |
| etd | etd | shipment_logistics |
| fixedPriceUsdPerTon | fixed_price_usd_per_ton | shipment_financials |
| paymentMethod | payment_method | shipment_financials |

### Contracts Module

| Frontend (camelCase) | API/DB (snake_case) | Table |
|---------------------|---------------------|-------|
| contractNo | contract_no | contracts |
| buyerCompanyId | buyer_company_id | contracts |
| sellerCompanyId | seller_company_id | contracts |
| currencyCode | currency_code | contracts |

### Finance Module

| Frontend (camelCase) | API/DB (snake_case) | Table |
|---------------------|---------------------|-------|
| transactionDate | transaction_date | transactions |
| amountUsd | amount_usd | transactions |
| fundSource | fund_source | transactions |
| partyName | party_name | transactions |

---

*Report generated by Field Mapping Audit Tool*
`;

  return md;
}

// ============================================================
// Run the Audit
// ============================================================

const report = runAudit();
saveReport(report, process.cwd());

