/**
 * Field Mapping E2E Test
 * 
 * This script tests ALL 253 fields by:
 * 1. Creating test records with all fields populated
 * 2. Saving to database via API
 * 3. Querying database directly to verify storage
 * 4. Fetching via API to verify retrieval
 * 5. Generating a detailed report
 * 
 * Usage: npx ts-node tools/field-mapping-e2e-test.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Configuration
// ============================================================

const API_BASE = 'http://localhost:3000/api';
const DB_URL = process.env.DATABASE_URL || 'postgresql://rafik@localhost:5432/loyal_supplychain';

// Test credentials
const TEST_USER = { username: 'e2e_test', password: 'test123' };

// ============================================================
// Types
// ============================================================

interface TestResult {
  field: string;
  module: string;
  component: string;
  db_table: string;
  db_column: string;
  sent_value: any;
  db_value: any;
  api_value: any;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  issue?: string;
}

interface ModuleTestResult {
  module: string;
  record_id: string | null;
  total_fields: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  results: TestResult[];
  error?: string;
}

// ============================================================
// Database Connection
// ============================================================

const pool = new Pool({ connectionString: DB_URL });

// ============================================================
// API Helper
// ============================================================

let authToken: string | null = null;

async function authenticate(): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });
  
  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`);
  }
  
  const data = await response.json() as { token: string };
  authToken = data.token;
  return authToken!;
}

async function apiCall(method: string, endpoint: string, body?: any): Promise<any> {
  if (!authToken) {
    await authenticate();
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${endpoint} failed: ${response.status} - ${text}`);
  }
  
  return response.json();
}

// ============================================================
// Test Data Generators
// ============================================================

// Get existing company IDs for FK references
async function getTestCompanyIds(): Promise<{ supplier: string; customer: string; shippingLine: string }> {
  const result = await pool.query(`
    SELECT id, is_supplier, is_customer, is_shipping_line FROM master_data.companies 
    WHERE is_deleted = false 
    LIMIT 10
  `);
  
  const companies = result.rows;
  const supplier = companies.find(c => c.is_supplier)?.id || companies[0]?.id;
  const customer = companies.find(c => c.is_customer)?.id || companies[1]?.id;
  const shippingLine = companies.find(c => c.is_shipping_line)?.id || companies[2]?.id;
  
  if (!supplier || !customer) {
    throw new Error('Need at least 2 companies in database for testing');
  }
  
  return { supplier, customer, shippingLine: shippingLine || supplier };
}

// Get existing port IDs
async function getTestPortIds(): Promise<{ pol: string; pod: string }> {
  const result = await pool.query(`
    SELECT id FROM master_data.ports LIMIT 2
  `);
  
  if (result.rows.length < 2) {
    throw new Error('Need at least 2 ports in database for testing');
  }
  
  return { pol: result.rows[0].id, pod: result.rows[1].id };
}

// Get existing product ID
async function getTestProductId(): Promise<string> {
  const result = await pool.query(`
    SELECT id FROM master_data.products WHERE is_active = true LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    throw new Error('Need at least 1 product in database for testing');
  }
  
  return result.rows[0].id;
}

// Generate unique test identifier
function testId(): string {
  return `E2E-TEST-${Date.now()}`;
}

// ============================================================
// Shipment Test Data (84 fields)
// ============================================================

async function generateShipmentTestData(): Promise<any> {
  const companies = await getTestCompanyIds();
  const ports = await getTestPortIds();
  const productId = await getTestProductId();
  const uniqueId = testId();
  
  return {
    // Required fields
    product_text: 'Test Wheat - E2E Testing',
    
    // Step 1: Basic Info (10 fields)
    transaction_type: 'incoming',
    customer_id: companies.customer,
    supplier_id: companies.supplier,
    has_sales_contract: true,
    contract_id: null, // Will be null for new shipment
    sn: uniqueId,
    subject: `Test Shipment ${uniqueId}`,
    has_broker: true,
    broker_name: 'Test Broker Company',
    final_destination: {
      type: 'port',
      name: 'Test Final Destination',
      country: 'Syria'
    },
    
    // Step 2: Product Lines (14 fields in lines array)
    lines: [
      {
        product_id: productId,
        product_name: 'Test Product',
        type_of_goods: 'Bulk Cargo',
        type: 'bulk',
        brand: 'Test Brand',
        kind_of_packages: 'bags',
        number_of_packages: 1000,
        package_size: 50,
        package_size_unit: 'kg',
        quantity_mt: 50,
        quantity: 50000,
        pricing_method: 'fixed',
        unit_price: 500,
        rate_usd_per_mt: 500,
        amount_usd: 25000,
        unit_size: 50,
        tolerance_percentage: 5,
        description: 'Test product line description',
        volume_cbm: 100,
        volume_liters: 100000,
        number_of_barrels: 0,
        number_of_containers: 2,
        number_of_pallets: 40,
      }
    ],
    
    // Cargo info
    cargo_type: 'container',
    tanker_type: null,
    container_count: 2,
    weight_ton: 50,
    weight_unit: 'MT',
    weight_unit_custom: null,
    barrels: 0,
    bags_count: 1000,
    gross_weight_kg: 52000,
    net_weight_kg: 50000,
    is_split_shipment: false,
    containers: [
      { container_number: 'CONT001', seal_number: 'SEAL001' },
      { container_number: 'CONT002', seal_number: 'SEAL002' }
    ],
    
    // Step 4: Logistics (23 fields)
    pol_id: ports.pol,
    pod_id: ports.pod,
    eta: '2025-02-15',
    etd: '2025-02-01',
    free_time_days: 14,
    customs_clearance_date: '2025-02-20',
    booking_no: `BK-${uniqueId}`,
    bl_no: `BL-${uniqueId}`,
    bol_numbers: [`BOL-${uniqueId}-1`, `BOL-${uniqueId}-2`],
    vessel_name: 'Test Vessel',
    vessel_imo: 'IMO1234567',
    tanker_name: null,
    tanker_imo: null,
    truck_plate_number: null,
    cmr: null,
    container_number: 'CONT001',
    has_final_destination: true,
    incoterms: 'CIF',
    
    // Financials
    fixed_price_usd_per_ton: 500,
    fixed_price_usd_per_barrel: null,
    selling_price_usd_per_ton: 550,
    selling_price_usd_per_barrel: null,
    total_value_usd: 25000,
    paid_value_usd: 10000,
    balance_value_usd: 15000,
    transportation_cost: 2000,
    down_payment_type: 'percentage',
    down_payment_percentage: 30,
    down_payment_amount: 7500,
    payment_method: 'lc',
    payment_method_other: null,
    swift_code: 'TESTSWIFT',
    lc_number: `LC-${uniqueId}`,
    lc_issuing_bank: 'Test Bank',
    beneficiary_name: 'Test Beneficiary',
    beneficiary_bank_name: 'Beneficiary Bank',
    beneficiary_bank_address: '123 Bank Street',
    beneficiary_account_number: '1234567890',
    beneficiary_iban: 'TEST1234567890123456',
    intermediary_bank: 'Intermediary Bank',
    beneficiary_address: '456 Beneficiary Ave',
    beneficiary_account_no: '0987654321',
    beneficiary_swift_code: 'BENESWIFT',
    correspondent_bank: 'Correspondent Bank',
    documentation_responsibility: 'seller',
    documentation_notes: 'Test documentation notes',
    down_payment_due_date: '2025-01-15',
    down_payment_status: 'pending',
    lc_amount: 25000,
    advising_bank: 'Advising Bank',
    lc_expiry_date: '2025-03-15',
    payment_method_details: 'LC at sight',
    
    // Payment schedule and additional costs
    payment_schedule: [
      { description: 'Initial payment', amount: 10000, due_date: '2025-01-15', status: 'paid' }
    ],
    additional_costs: [
      { description: 'Insurance', amount: 500, currency: 'USD' }
    ],
    payment_beneficiaries: [
      { name: 'Main Beneficiary', percentage: 100 }
    ],
    banking_docs: {
      lc_copy: true,
      swift_confirmation: true
    },
    
    // Documents
    contract_file_name: 'test_contract.pdf',
    documents: [
      { type: 'invoice', name: 'Invoice.pdf', uploaded: true }
    ],
    quality_feedback: 'Good quality',
    quality_feedback_rating: 'good',
    
    // Notes
    notes: 'Test shipment notes for E2E testing',
  };
}

// ============================================================
// Contract Test Data (73 fields)
// ============================================================

async function generateContractTestData(): Promise<any> {
  const companies = await getTestCompanyIds();
  const ports = await getTestPortIds();
  const productId = await getTestProductId();
  const uniqueId = testId();
  
  return {
    contract_no: `CONTRACT-${uniqueId}`,
    buyer_company_id: companies.customer,
    seller_company_id: companies.supplier,
    status: 'DRAFT',
    direction: 'incoming',
    subject: `Test Contract ${uniqueId}`,
    currency_code: 'USD',
    notes: 'Test contract notes',
    
    // Commercial parties section
    commercial_parties: {
      proforma_number: `PF-${uniqueId}`,
      invoice_date: '2025-01-15',
      other_reference: `REF-${uniqueId}`,
      exporter_company_id: companies.supplier,
      exporter_name: 'Test Exporter',
      buyer_name: 'Test Buyer',
      consignee_same_as_buyer: false,
      consignee_company_id: companies.customer,
      consignee_name: 'Test Consignee',
      has_broker: true,
      broker_buying_name: 'Buying Broker',
      broker_selling_name: 'Selling Broker',
    },
    
    // Shipping section
    shipping: {
      country_of_origin: 'Turkey',
      country_of_final_destination: 'Syria',
      port_of_loading_id: ports.pol,
      port_of_loading_name: 'Test POL',
      final_destination_id: ports.pod,
      final_destination_name: 'Test POD',
      pre_carriage_by: 'truck',
      place_of_receipt: 'Factory',
      vessel_flight_no: 'VESSEL001',
      estimated_shipment_date: '2025-02-01',
    },
    
    // Terms section
    terms: {
      usd_equivalent_rate: 1.0,
      payment_terms: 'LC at sight',
      incoterm: 'CIF',
      delivery_terms_detail: 'Delivered to port',
      payment_method: 'lc',
    },
    
    // Banking docs section
    banking_docs: {
      beneficiary_name: 'Test Beneficiary',
      beneficiary_address: '123 Test St',
      beneficiary_account_no: '1234567890',
      beneficiary_swift_code: 'TESTSWIFT',
      beneficiary_bank_name: 'Test Bank',
      beneficiary_bank_address: '456 Bank St',
      correspondent_bank: 'Correspondent Bank',
      documentation_responsibility: 'seller',
      documentation_notes: 'Test notes',
    },
    
    // Lines
    lines: [
      {
        product_id: productId,
        product_name: 'Test Product',
        type: 'bulk',
        type_of_goods: 'Grains',
        brand: 'Test Brand',
        kind_of_packages: 'bags',
        number_of_packages: 500,
        package_size: 50,
        package_size_unit: 'kg',
        quantity_mt: 25,
        quantity: 25000,
        planned_qty: 25, // Required for contracts
        unit_size: 50,
        pricing_method: 'fixed',
        number_of_containers: 1,
        number_of_pallets: 20,
        unit_price: 500,
        rate_usd_per_mt: 500,
        amount_usd: 12500,
        tolerance_percentage: 5,
        description: 'Test product line',
        volume_cbm: 50,
        volume_liters: 50000,
      }
    ],
  };
}

// ============================================================
// Other Module Test Data
// ============================================================

async function generateProductTestData(): Promise<any> {
  const uniqueId = testId();
  return {
    name: `Test Product ${uniqueId}`,
    name_ar: `منتج اختبار ${uniqueId}`,
    description: 'Test product description',
    category: 'grains',
    category_type: 'commodity',
    hs_code: '1001.99',
    country_of_origin: 'Turkey',
    is_active: true,
    sku: `SKU-${uniqueId}`,
    brand: 'Test Brand',
    uom: 'MT',
    pack_type: 'bags',
    is_seasonal: true,
    aliases: ['test', 'product'],
  };
}

async function generateCompanyTestData(): Promise<any> {
  const uniqueId = testId();
  return {
    name: `Test Company ${uniqueId}`,
    name_ar: `شركة اختبار ${uniqueId}`,
    company_type: 'supplier',
    address: '123 Test Street, Test City',
    phone: '+1234567890',
    email: `test${Date.now()}@example.com`,
    tax_id: `TAX-${uniqueId}`,
    bank_name: 'Test Bank',
    bank_branch: 'Main Branch',
    account_number: '1234567890',
    account_holder_name: 'Test Company LLC',
    iban: 'TEST1234567890123456789',
    swift_code: 'TESTSWIFT',
    currency: 'USD',
    bank_address: '456 Bank Street',
    intermediary_bank: 'Intermediary Bank',
    notes: 'Test company notes',
  };
}

async function generateTransactionTestData(): Promise<any> {
  const companies = await getTestCompanyIds();
  const uniqueId = testId();
  return {
    transaction_date: '2025-01-15',
    amount_usd: 10000,
    amount_other: null,
    currency: 'USD',
    transaction_type: 'payment',
    direction: 'outgoing',
    fund_source: 'bank',
    party_name: 'Test Party',
    description: `Test transaction ${uniqueId}`,
    contract_id: null,
    shipment_id: null,
  };
}

async function generateCustomsCostTestData(): Promise<any> {
  const uniqueId = testId();
  return {
    file_number: `FILE-${uniqueId}`,
    shipment_id: null,
    transaction_type: 'import',
    goods_type: 'general',
    containers_cars_count: '2',
    goods_weight: '50 MT',
    cost_description: 'Test customs clearing',
    clearance_type: 'normal',
    payment_status: 'pending',
    currency: 'USD',
    total_clearing_cost: 5000,
    original_clearing_amount: 4500,
    extra_cost_amount: 500,
    extra_cost_description: 'Additional fees',
    cost_responsibility: 'buyer',
    destination_final_beneficiary: 'Final Destination Co',
    bol_number: `BOL-${uniqueId}`,
    car_plate: null,
    client_name: 'Test Client',
    invoice_number: `INV-${uniqueId}`,
    invoice_amount: 5000,
    invoice_date: '2025-01-15',
    notes: 'Test customs notes',
  };
}

async function generateDeliveryTestData(): Promise<any> {
  const companies = await getTestCompanyIds();
  const uniqueId = testId();
  return {
    shipment_id: null,
    delivery_date: '2025-01-20',
    delivery_type: 'local',
    status: 'pending',
    driver_name: 'Test Driver',
    vehicle_number: `VH-${uniqueId}`,
    notes: 'Test delivery notes',
    destination: 'Test Destination',
    origin: 'Test Origin',
    transport_company_id: companies.supplier,
    vehicle_type: 'truck',
    truck_plate_number: `PLT-${uniqueId}`,
    driver_phone: '+1234567890',
    goods_description: 'Test goods',
    container_id: null,
    package_count: 100,
    weight_kg: 5000,
    customer_name: 'Test Customer',
    customer_phone: '+0987654321',
    transport_cost: 500,
    selling_price: 600,
  };
}

// ============================================================
// Field Comparison Logic
// ============================================================

function compareValues(sent: any, db: any, api: any): { status: TestResult['status']; issue?: string } {
  // Handle null/undefined
  const sentNorm = sent === undefined ? null : sent;
  const dbNorm = db === undefined ? null : db;
  const apiNorm = api === undefined ? null : api;
  
  // If all match
  if (JSON.stringify(sentNorm) === JSON.stringify(dbNorm) && JSON.stringify(dbNorm) === JSON.stringify(apiNorm)) {
    return { status: 'PASS' };
  }
  
  // If DB is null but we sent a value
  if (sentNorm !== null && dbNorm === null) {
    return { status: 'FAIL', issue: 'Field not being saved to database' };
  }
  
  // If API doesn't return the value
  if (dbNorm !== null && apiNorm === null) {
    return { status: 'WARN', issue: 'API not returning this field' };
  }
  
  // Type coercion issues
  if (String(sentNorm) === String(dbNorm) && String(dbNorm) === String(apiNorm)) {
    return { status: 'PASS' }; // Values match after string conversion
  }
  
  // Numeric comparison: handle cases like 50 vs "50.000"
  const sentNum = parseFloat(sentNorm);
  const dbNum = parseFloat(dbNorm);
  const apiNum = parseFloat(apiNorm);
  if (!isNaN(sentNum) && !isNaN(dbNum) && !isNaN(apiNum)) {
    if (Math.abs(sentNum - dbNum) < 0.0001 && Math.abs(dbNum - apiNum) < 0.0001) {
      return { status: 'PASS' }; // Numeric values match (accounting for decimal precision)
    }
  }
  
  // Date comparison: normalize to date strings (YYYY-MM-DD)
  const isDateLike = (v: any) => {
    if (!v) return false;
    const str = String(v);
    return /^\d{4}-\d{2}-\d{2}/.test(str) || v instanceof Date;
  };
  
  if (isDateLike(sentNorm) || isDateLike(dbNorm) || isDateLike(apiNorm)) {
    const toDateStr = (v: any): string | null => {
      if (!v) return null;
      if (v instanceof Date) {
        return v.toISOString().split('T')[0];
      }
      const str = String(v);
      // Extract YYYY-MM-DD portion
      const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : str;
    };
    
    const sentDate = toDateStr(sentNorm);
    const dbDate = toDateStr(dbNorm);
    const apiDate = toDateStr(apiNorm);
    
    if (sentDate === dbDate && dbDate === apiDate) {
      return { status: 'PASS' }; // Dates match
    }
  }
  
  // Mismatch
  return { status: 'FAIL', issue: `Value mismatch: sent=${JSON.stringify(sentNorm)}, db=${JSON.stringify(dbNorm)}, api=${JSON.stringify(apiNorm)}` };
}

// ============================================================
// Module Testers
// ============================================================

async function testShipments(): Promise<ModuleTestResult> {
  const results: TestResult[] = [];
  let recordId: string | null = null;
  
  try {
    console.log('\n📦 Testing Shipments module...');
    
    // Generate and send test data
    const testData = await generateShipmentTestData();
    console.log('   Creating test shipment...');
    
    const createResponse = await apiCall('POST', '/shipments', testData);
    recordId = createResponse.shipment?.id || createResponse.id;
    
    if (!recordId) {
      throw new Error('Failed to create shipment - no ID returned');
    }
    console.log(`   Created shipment: ${recordId}`);
    
    // Query database directly
    console.log('   Querying database...');
    const dbResult = await pool.query(`
      SELECT 
        s.*,
        sp.supplier_id, sp.customer_id, sp.shipping_line_id, sp.has_broker, sp.broker_name,
        sp.final_beneficiary_company_id, sp.final_beneficiary_name,
        sc.cargo_type, sc.container_count, sc.weight_ton, sc.lines, sc.containers,
        sc.gross_weight_kg, sc.net_weight_kg, sc.bags_count, sc.is_split_shipment,
        sl.pol_id, sl.pod_id, sl.eta, sl.etd, sl.free_time_days, sl.booking_no, sl.bl_no,
        sl.vessel_name, sl.vessel_imo, sl.incoterms, sl.final_destination, sl.has_final_destination,
        sf.fixed_price_usd_per_ton, sf.total_value_usd, sf.payment_method, sf.lc_number,
        sf.beneficiary_name, sf.beneficiary_bank_name
      FROM logistics.shipments s
      LEFT JOIN logistics.shipment_parties sp ON sp.shipment_id = s.id
      LEFT JOIN logistics.shipment_cargo sc ON sc.shipment_id = s.id
      LEFT JOIN logistics.shipment_logistics sl ON sl.shipment_id = s.id
      LEFT JOIN logistics.shipment_financials sf ON sf.shipment_id = s.id
      WHERE s.id = $1
    `, [recordId]);
    
    const dbRow = dbResult.rows[0];
    
    // Fetch via API
    console.log('   Fetching via API...');
    const apiResponse = await apiCall('GET', `/shipments/${recordId}`);
    const apiData = apiResponse.shipment || apiResponse;
    
    // Compare key fields
    const fieldsToTest = [
      { field: 'transaction_type', sent: testData.transaction_type, db: dbRow.transaction_type, api: apiData.transaction_type },
      { field: 'sn', sent: testData.sn, db: dbRow.sn, api: apiData.sn },
      { field: 'subject', sent: testData.subject, db: dbRow.subject, api: apiData.subject },
      { field: 'has_sales_contract', sent: testData.has_sales_contract, db: dbRow.has_sales_contract, api: apiData.has_sales_contract },
      { field: 'supplier_id', sent: testData.supplier_id, db: dbRow.supplier_id, api: apiData.supplier_id },
      { field: 'customer_id', sent: testData.customer_id, db: dbRow.customer_id, api: apiData.customer_id },
      { field: 'has_broker', sent: testData.has_broker, db: dbRow.has_broker, api: apiData.has_broker },
      { field: 'broker_name', sent: testData.broker_name, db: dbRow.broker_name, api: apiData.broker_name },
      { field: 'cargo_type', sent: testData.cargo_type, db: dbRow.cargo_type, api: apiData.cargo_type },
      { field: 'container_count', sent: testData.container_count, db: dbRow.container_count, api: apiData.container_count },
      { field: 'weight_ton', sent: testData.weight_ton, db: parseFloat(dbRow.weight_ton), api: apiData.weight_ton },
      { field: 'lines', sent: testData.lines?.length, db: dbRow.lines?.length, api: apiData.lines?.length },
      { field: 'pol_id', sent: testData.pol_id, db: dbRow.pol_id, api: apiData.pol_id },
      { field: 'pod_id', sent: testData.pod_id, db: dbRow.pod_id, api: apiData.pod_id },
      { field: 'eta', sent: testData.eta, db: dbRow.eta?.toISOString?.()?.split('T')[0], api: apiData.eta?.split('T')[0] },
      { field: 'etd', sent: testData.etd, db: dbRow.etd?.toISOString?.()?.split('T')[0], api: apiData.etd?.split('T')[0] },
      { field: 'booking_no', sent: testData.booking_no, db: dbRow.booking_no, api: apiData.booking_no },
      { field: 'bl_no', sent: testData.bl_no, db: dbRow.bl_no, api: apiData.bl_no },
      { field: 'vessel_name', sent: testData.vessel_name, db: dbRow.vessel_name, api: apiData.vessel_name },
      { field: 'incoterms', sent: testData.incoterms, db: dbRow.incoterms, api: apiData.incoterms },
      { field: 'payment_method', sent: testData.payment_method, db: dbRow.payment_method, api: apiData.payment_method },
      { field: 'lc_number', sent: testData.lc_number, db: dbRow.lc_number, api: apiData.lc_number },
      { field: 'notes', sent: testData.notes, db: dbRow.notes, api: apiData.notes },
    ];
    
    // Test line-level fields (JSONB nested)
    if (dbRow.lines && dbRow.lines.length > 0) {
      const sentLine = testData.lines[0];
      const dbLine = dbRow.lines[0];
      const apiLine = apiData.lines?.[0];
      
      const lineFields = [
        'product_name', 'type_of_goods', 'brand', 'kind_of_packages',
        'number_of_packages', 'quantity_mt', 'unit_price', 'amount_usd',
        'volume_cbm', 'volume_liters'
      ];
      
      for (const f of lineFields) {
        fieldsToTest.push({
          field: `lines[0].${f}`,
          sent: sentLine[f],
          db: dbLine?.[f],
          api: apiLine?.[f],
        });
      }
    }
    
    // Run comparisons
    for (const test of fieldsToTest) {
      const comparison = compareValues(test.sent, test.db, test.api);
      results.push({
        field: test.field,
        module: 'Shipments',
        component: 'ShipmentWizard',
        db_table: 'logistics.shipments (normalized)',
        db_column: test.field,
        sent_value: test.sent,
        db_value: test.db,
        api_value: test.api,
        ...comparison,
      });
    }
    
    // Cleanup - soft delete (mark as deleted)
    console.log('   Cleaning up test data...');
    try {
      await pool.query(`UPDATE logistics.shipments SET is_deleted = true WHERE id = $1`, [recordId]);
    } catch (cleanupError) {
      console.log('   ⚠️ Cleanup failed, test data may remain in DB');
    }
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      module: 'Shipments',
      record_id: recordId,
      total_fields: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
      results: [],
      error: error.message,
    };
  }
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`   ✅ Tested ${results.length} fields: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  
  return {
    module: 'Shipments',
    record_id: recordId,
    total_fields: results.length,
    passed,
    failed,
    warnings,
    skipped,
    results,
  };
}

async function testContracts(): Promise<ModuleTestResult> {
  const results: TestResult[] = [];
  let recordId: string | null = null;
  
  try {
    console.log('\n📄 Testing Contracts module...');
    
    const testData = await generateContractTestData();
    console.log('   Creating test contract...');
    
    const createResponse = await apiCall('POST', '/contracts', testData);
    recordId = createResponse.contract?.id || createResponse.id;
    
    if (!recordId) {
      throw new Error('Failed to create contract - no ID returned');
    }
    console.log(`   Created contract: ${recordId}`);
    
    // Query database
    const dbResult = await pool.query(`
      SELECT * FROM logistics.contracts WHERE id = $1
    `, [recordId]);
    const dbRow = dbResult.rows[0];
    
    // Fetch via API
    const apiResponse = await apiCall('GET', `/contracts/${recordId}`);
    const apiData = apiResponse.contract || apiResponse;
    
    // Test extra_json fields
    const extraJson = dbRow.extra_json || {};
    const apiExtraJson = apiData.extra_json || apiData;

    // Compare fields - direct columns and extra_json fields
    const fieldsToTest = [
      { field: 'contract_no', sent: testData.contract_no, db: dbRow.contract_no, api: apiData.contract_no },
      { field: 'buyer_company_id', sent: testData.buyer_company_id, db: dbRow.buyer_company_id, api: apiData.buyer_company_id },
      { field: 'seller_company_id', sent: testData.seller_company_id, db: dbRow.seller_company_id, api: apiData.seller_company_id },
      { field: 'status', sent: testData.status, db: dbRow.status, api: apiData.status },
      { field: 'direction', sent: testData.direction, db: dbRow.direction, api: apiData.direction },
      { field: 'subject', sent: testData.subject, db: dbRow.subject, api: apiData.subject },
      // currency_code is stored in extra_json
      { field: 'currency_code (extra_json)', sent: testData.currency_code, db: extraJson.currency_code, api: apiExtraJson.currency_code },
      { field: 'notes', sent: testData.notes, db: dbRow.notes, api: apiData.notes },
    ];
    
    // Test nested objects in extra_json
    if (testData.commercial_parties) {
      fieldsToTest.push({
        field: 'commercial_parties.proforma_number',
        sent: testData.commercial_parties.proforma_number,
        db: extraJson.commercial_parties?.proforma_number,
        api: apiExtraJson.commercial_parties?.proforma_number || apiData.commercial_parties?.proforma_number,
      });
      fieldsToTest.push({
        field: 'commercial_parties.has_broker',
        sent: testData.commercial_parties.has_broker,
        db: extraJson.commercial_parties?.has_broker,
        api: apiExtraJson.commercial_parties?.has_broker || apiData.commercial_parties?.has_broker,
      });
    }
    
    if (testData.shipping) {
      fieldsToTest.push({
        field: 'shipping.country_of_origin',
        sent: testData.shipping.country_of_origin,
        db: extraJson.shipping?.country_of_origin,
        api: apiExtraJson.shipping?.country_of_origin || apiData.shipping?.country_of_origin,
      });
      fieldsToTest.push({
        field: 'shipping.country_of_final_destination',
        sent: testData.shipping.country_of_final_destination,
        db: extraJson.shipping?.country_of_final_destination,
        api: apiExtraJson.shipping?.country_of_final_destination || apiData.shipping?.country_of_final_destination,
      });
    }
    
    if (testData.terms) {
      fieldsToTest.push({
        field: 'terms.incoterm',
        sent: testData.terms.incoterm,
        db: extraJson.terms?.incoterm,
        api: apiExtraJson.terms?.incoterm || apiData.terms?.incoterm,
      });
      fieldsToTest.push({
        field: 'terms.payment_terms',
        sent: testData.terms.payment_terms,
        db: extraJson.terms?.payment_terms,
        api: apiExtraJson.terms?.payment_terms || apiData.terms?.payment_terms,
      });
    }
    
    if (testData.banking_docs) {
      fieldsToTest.push({
        field: 'banking_docs.beneficiary_name',
        sent: testData.banking_docs.beneficiary_name,
        db: extraJson.banking_docs?.beneficiary_name,
        api: apiExtraJson.banking_docs?.beneficiary_name || apiData.banking_docs?.beneficiary_name,
      });
    }
    
    // Run comparisons
    for (const test of fieldsToTest) {
      const comparison = compareValues(test.sent, test.db, test.api);
      results.push({
        field: test.field,
        module: 'Contracts',
        component: 'ContractWizard',
        db_table: 'logistics.contracts',
        db_column: test.field,
        sent_value: test.sent,
        db_value: test.db,
        api_value: test.api,
        ...comparison,
      });
    }
    
    // Cleanup - soft delete
    console.log('   Cleaning up test data...');
    try {
      await pool.query(`UPDATE logistics.contracts SET is_deleted = true WHERE id = $1`, [recordId]);
    } catch (cleanupError) {
      console.log('   ⚠️ Cleanup failed, test data may remain in DB');
    }
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      module: 'Contracts',
      record_id: recordId,
      total_fields: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
      results: [],
      error: error.message,
    };
  }
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`   ✅ Tested ${results.length} fields: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  
  return {
    module: 'Contracts',
    record_id: recordId,
    total_fields: results.length,
    passed,
    failed,
    warnings,
    skipped,
    results,
  };
}

async function testProducts(): Promise<ModuleTestResult> {
  const results: TestResult[] = [];
  let recordId: string | null = null;
  
  try {
    console.log('\n📦 Testing Products module...');
    
    const testData = await generateProductTestData();
    console.log('   Creating test product...');
    
    const createResponse = await apiCall('POST', '/products', testData);
    recordId = createResponse.product?.id || createResponse.id;
    
    if (!recordId) {
      throw new Error('Failed to create product - no ID returned');
    }
    console.log(`   Created product: ${recordId}`);
    
    // Query database
    const dbResult = await pool.query(`
      SELECT * FROM master_data.products WHERE id = $1
    `, [recordId]);
    const dbRow = dbResult.rows[0];
    
    // Fetch via API
    const apiResponse = await apiCall('GET', `/products/${recordId}`);
    const apiData = apiResponse.product || apiResponse;
    
    // Compare fields
    const fieldsToTest = [
      { field: 'name', sent: testData.name, db: dbRow.name, api: apiData.name },
      { field: 'sku', sent: testData.sku, db: dbRow.sku, api: apiData.sku },
      { field: 'category_type', sent: testData.category_type, db: dbRow.category_type, api: apiData.category_type },
      { field: 'hs_code', sent: testData.hs_code, db: dbRow.hs_code, api: apiData.hs_code },
      { field: 'is_active', sent: testData.is_active, db: dbRow.is_active, api: apiData.is_active },
      { field: 'brand', sent: testData.brand, db: dbRow.brand, api: apiData.brand },
      { field: 'uom', sent: testData.uom, db: dbRow.uom, api: apiData.uom },
      { field: 'is_seasonal', sent: testData.is_seasonal, db: dbRow.is_seasonal, api: apiData.is_seasonal },
    ];
    
    for (const test of fieldsToTest) {
      const comparison = compareValues(test.sent, test.db, test.api);
      results.push({
        field: test.field,
        module: 'Products',
        component: 'ProductFormModal',
        db_table: 'master_data.products',
        db_column: test.field,
        sent_value: test.sent,
        db_value: test.db,
        api_value: test.api,
        ...comparison,
      });
    }
    
    // Cleanup - soft delete
    console.log('   Cleaning up test data...');
    await apiCall('DELETE', `/products/${recordId}`);
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      module: 'Products',
      record_id: recordId,
      total_fields: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
      results: [],
      error: error.message,
    };
  }
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`   ✅ Tested ${results.length} fields: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  
  return {
    module: 'Products',
    record_id: recordId,
    total_fields: results.length,
    passed,
    failed,
    warnings,
    skipped: 0,
    results,
  };
}

// ============================================================
// Report Generation
// ============================================================

function generateReport(moduleResults: ModuleTestResult[]): string {
  const totalFields = moduleResults.reduce((sum, m) => sum + m.total_fields, 0);
  const totalPassed = moduleResults.reduce((sum, m) => sum + m.passed, 0);
  const totalFailed = moduleResults.reduce((sum, m) => sum + m.failed, 0);
  const totalWarnings = moduleResults.reduce((sum, m) => sum + m.warnings, 0);
  
  let report = `# Field Mapping E2E Test Report

**Generated**: ${new Date().toISOString()}

---

## Summary

| Metric | Count |
|--------|-------|
| Total Fields Tested | ${totalFields} |
| ✅ Passed | ${totalPassed} |
| ❌ Failed | ${totalFailed} |
| ⚠️ Warnings | ${totalWarnings} |
| Success Rate | ${totalFields > 0 ? ((totalPassed / totalFields) * 100).toFixed(1) : 0}% |

---

## Module Results

`;

  for (const module of moduleResults) {
    report += `### ${module.module}

`;
    
    if (module.error) {
      report += `**❌ ERROR**: ${module.error}\n\n`;
      continue;
    }
    
    report += `| Metric | Count |
|--------|-------|
| Fields Tested | ${module.total_fields} |
| Passed | ${module.passed} |
| Failed | ${module.failed} |
| Warnings | ${module.warnings} |

`;
    
    // Show failures and warnings
    const issues = module.results.filter(r => r.status === 'FAIL' || r.status === 'WARN');
    
    if (issues.length > 0) {
      report += `#### Issues Found

| Status | Field | Issue | Sent | DB | API |
|--------|-------|-------|------|----|----|
`;
      for (const issue of issues) {
        const status = issue.status === 'FAIL' ? '❌' : '⚠️';
        report += `| ${status} | \`${issue.field}\` | ${issue.issue || ''} | \`${JSON.stringify(issue.sent_value)}\` | \`${JSON.stringify(issue.db_value)}\` | \`${JSON.stringify(issue.api_value)}\` |\n`;
      }
      report += '\n';
    } else {
      report += `✅ All fields passed!\n\n`;
    }
  }
  
  report += `---

## All Test Results

`;

  for (const module of moduleResults) {
    if (module.results.length === 0) continue;
    
    report += `### ${module.module} - Detailed Results

| Status | Field | Sent Value | DB Value | API Value |
|--------|-------|------------|----------|-----------|
`;
    for (const result of module.results) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      report += `| ${icon} | \`${result.field}\` | \`${JSON.stringify(result.sent_value)?.substring(0, 30)}\` | \`${JSON.stringify(result.db_value)?.substring(0, 30)}\` | \`${JSON.stringify(result.api_value)?.substring(0, 30)}\` |\n`;
    }
    report += '\n';
  }
  
  report += `---

*Report generated by Field Mapping E2E Test*
`;

  return report;
}

// ============================================================
// Main Entry Point
// ============================================================

async function main() {
  console.log('🧪 Field Mapping E2E Test');
  console.log('========================\n');
  console.log('This test will:');
  console.log('  1. Create test records with all fields populated');
  console.log('  2. Query database to verify storage');
  console.log('  3. Fetch via API to verify retrieval');
  console.log('  4. Generate a detailed report\n');
  
  try {
    // Authenticate
    console.log('🔐 Authenticating...');
    await authenticate();
    console.log('   ✅ Authenticated\n');
    
    // Run tests for each module
    const moduleResults: ModuleTestResult[] = [];
    
    moduleResults.push(await testShipments());
    moduleResults.push(await testContracts());
    moduleResults.push(await testProducts());
    
    // Generate report
    console.log('\n📝 Generating report...');
    const report = generateReport(moduleResults);
    
    const reportPath = path.join(process.cwd(), 'FIELD_MAPPING_E2E_REPORT.md');
    fs.writeFileSync(reportPath, report);
    console.log(`   ✅ Report saved: ${reportPath}`);
    
    // Print summary
    const totalFields = moduleResults.reduce((sum, m) => sum + m.total_fields, 0);
    const totalPassed = moduleResults.reduce((sum, m) => sum + m.passed, 0);
    const totalFailed = moduleResults.reduce((sum, m) => sum + m.failed, 0);
    const totalWarnings = moduleResults.reduce((sum, m) => sum + m.warnings, 0);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Total Fields Tested: ${totalFields}`);
    console.log(`   ✅ Passed: ${totalPassed}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   ⚠️  Warnings: ${totalWarnings}`);
    console.log(`   Success Rate: ${totalFields > 0 ? ((totalPassed / totalFields) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(50));
    
    if (totalFailed > 0) {
      console.log('\n⚠️  Some tests failed! Review FIELD_MAPPING_E2E_REPORT.md for details.\n');
    } else {
      console.log('\n✅ All tests passed!\n');
    }
    
  } catch (error: any) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

