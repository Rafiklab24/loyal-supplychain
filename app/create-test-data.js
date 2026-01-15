/**
 * Create Test Data for Notification System
 * Run: node create-test-data.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTestData() {
  console.log('🧪 Creating test data for notification system...\n');

  try {
    // Clean up existing test data
    console.log('🧹 Cleaning up old test data...');
    await pool.query(`DELETE FROM logistics.notifications WHERE message LIKE '%Test Product%'`);
    await pool.query(`DELETE FROM logistics.shipments WHERE sn LIKE 'TEST-%'`);
    // Skip contract cleanup if there are dependencies
    try {
      await pool.query(`DELETE FROM logistics.contracts WHERE contract_no LIKE 'TEST-%' AND id NOT IN (SELECT contract_id FROM logistics.proforma_invoices WHERE contract_id IS NOT NULL)`);
    } catch (e) {
      console.log('   (Skipping contract cleanup due to dependencies)');
    }
    
    // Get company and port IDs
    const companies = await pool.query('SELECT id FROM master_data.companies LIMIT 2');
    const ports = await pool.query('SELECT id FROM master_data.ports LIMIT 2');
    
    if (companies.rows.length < 2 || ports.rows.length < 2) {
      console.error('❌ Need at least 2 companies and 2 ports in database');
      return;
    }

    const [company1, company2] = companies.rows;
    const [port1, port2] = ports.rows;

    console.log('✅ Cleanup complete\n');

    // TEST 1: Contract Creation
    console.log('📝 Creating TEST 1: Contract Creation (info/blue)...');
    await pool.query(`
      INSERT INTO logistics.contracts (
        contract_no, status, currency_code, signed_at,
        buyer_company_id, seller_company_id, created_at
      ) VALUES ($1, 'ACTIVE', 'USD', NOW(), $2, $3, NOW())
    `, ['TEST-CONTRACT-001', company1.id, company2.id]);

    // TEST 2: Shipping Deadline - 6 days (warning)
    console.log('📝 Creating TEST 2: Shipping Deadline - 6 days (warning/orange)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, contract_ship_date, status, pol_id, pod_id, created_at
      ) VALUES ($1, $2, CURRENT_DATE + INTERVAL '6 days', 'planning', $3, $4, NOW())
    `, ['TEST-SHIP-DEADLINE-6D', 'Test Product - Deadline 6 days', port1.id, port2.id]);

    // TEST 3: Shipping Deadline - 1 day CRITICAL (error)
    console.log('📝 Creating TEST 3: Shipping Deadline - 1 day CRITICAL (error/red)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, contract_ship_date, status, pol_id, pod_id, created_at
      ) VALUES ($1, $2, CURRENT_DATE + INTERVAL '1 day', 'planning', $3, $4, NOW())
    `, ['TEST-SHIP-DEADLINE-1D', 'Test Product - URGENT Tomorrow', port1.id, port2.id]);

    // TEST 4: Documents Needed
    console.log('📝 Creating TEST 4: Documents Needed (warning/orange)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, status, pol_id, pod_id, eta, created_at
      ) VALUES ($1, $2, 'booked', $3, $4, CURRENT_DATE + INTERVAL '15 days', NOW())
    `, ['TEST-DOCS-NEEDED', 'Test Product - Need Documents', port1.id, port2.id]);

    // TEST 5: Balance Payment Planning - 14 days
    console.log('📝 Creating TEST 5: Balance Payment Planning - 14 days (warning/orange)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, status, pol_id, pod_id, eta,
        total_value_usd, paid_value_usd, balance_value_usd, created_at
      ) VALUES ($1, $2, 'sailed', $3, $4, CURRENT_DATE + INTERVAL '14 days',
        100000, 30000, 70000, NOW())
    `, ['TEST-BALANCE-14D', 'Test Product - Balance Planning', port1.id, port2.id]);

    // TEST 6: Balance Payment CRITICAL - 7 days
    console.log('📝 Creating TEST 6: Balance Payment CRITICAL - 7 days (error/red)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, status, pol_id, pod_id, eta,
        total_value_usd, paid_value_usd, balance_value_usd, created_at
      ) VALUES ($1, $2, 'sailed', $3, $4, CURRENT_DATE + INTERVAL '7 days',
        150000, 50000, 100000, NOW())
    `, ['TEST-BALANCE-7D-CRITICAL', 'Test Product - CRITICAL PAYMENT', port1.id, port2.id]);

    // TEST 7: Send Docs to Customs - 2 days
    console.log('📝 Creating TEST 7: Send Docs to Customs - 2 days (warning/orange)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, status, pol_id, pod_id, eta, created_at
      ) VALUES ($1, $2, 'sailed', $3, $4, CURRENT_DATE + INTERVAL '2 days', NOW())
    `, ['TEST-CUSTOMS-DOCS', 'Test Product - Send to Customs', port1.id, port2.id]);

    // TEST 8: POD Clearance Check - 2 days after arrival
    console.log('📝 Creating TEST 8: POD Clearance Check (info/blue)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, status, pol_id, pod_id, eta, created_at
      ) VALUES ($1, $2, 'arrived', $3, $4, CURRENT_DATE - INTERVAL '2 days', NOW())
    `, ['TEST-CLEARANCE-CHECK', 'Test Product - Check Clearance', port1.id, port2.id]);

    // TEST 9: Delivery Status Check - 7 days overdue
    console.log('📝 Creating TEST 9: Delivery Status Check (warning/orange)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, status, pol_id, pod_id, eta, created_at
      ) VALUES ($1, $2, 'arrived', $3, $4, CURRENT_DATE - INTERVAL '7 days', NOW())
    `, ['TEST-DELIVERY-STATUS', 'Test Product - Status Update', port1.id, port2.id]);

    // TEST 10: Quality Check Required
    console.log('📝 Creating TEST 10: Quality Check (info/blue)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, status, pol_id, pod_id, eta, created_at
      ) VALUES ($1, $2, 'delivered', $3, $4, CURRENT_DATE - INTERVAL '1 day', NOW())
    `, ['TEST-QUALITY-CHECK', 'Test Product - Quality Check', port1.id, port2.id]);

    // Count created records
    const shipmentCount = await pool.query(`SELECT COUNT(*) FROM logistics.shipments WHERE sn LIKE 'TEST-%'`);
    const contractCount = await pool.query(`SELECT COUNT(*) FROM logistics.contracts WHERE contract_no LIKE 'TEST-%'`);

    console.log('\n✅ Test data created successfully!');
    console.log(`   📦 Created ${shipmentCount.rows[0].count} test shipments`);
    console.log(`   📄 Created ${contractCount.rows[0].count} test contracts`);
    console.log('\n🔄 Now triggering notification check...');

    // Import and run notification service
    const { notificationService } = require('./src/services/notificationService');
    await notificationService.checkAndGenerateNotifications();

    console.log('\n✅ Done! Check your notifications:');
    console.log('   1. Go to: http://localhost:5173/tasks');
    console.log('   2. Click the "تحديث" (Refresh) button');
    console.log('   3. You should see ~10 notifications in different colors');
    console.log('   4. Check Critical 🔴, Warning 🟠, and Info 🔵 tabs');
    console.log('   5. Try marking some as completed\n');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await pool.end();
  }
}

createTestData();

