/**
 * Create Test Data for SELLER Notification System
 * Run: node create-seller-test-data.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createSellerTestData() {
  console.log('🧪 Creating SELLER test data for notification system...\n');

  try {
    // Clean up existing seller test data
    console.log('🧹 Cleaning up old seller test data...');
    await pool.query(`DELETE FROM logistics.notifications WHERE message LIKE '%SELLER-TEST%'`);
    await pool.query(`DELETE FROM logistics.shipments WHERE sn LIKE 'SELLER-TEST-%'`);
    
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

    // ========== SELLER TEST SCENARIOS ==========

    // TEST 1: Shipping Deadline Approaching (5 days) - Notify Ayah & Khatib
    console.log('📝 SELLER TEST 1: Shipping Deadline - 5 days (warning/orange)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, direction, contract_ship_date, status, pol_id, pod_id, created_at
      ) VALUES ($1, $2, 'outgoing', CURRENT_DATE + INTERVAL '5 days', 'planning', $3, $4, NOW())
    `, ['SELLER-TEST-SHIP-5D', 'SELLER-TEST Product - Deadline 5 days', port1.id, port2.id]);

    // TEST 2: Shipping Deadline CRITICAL (1 day)
    console.log('📝 SELLER TEST 2: Shipping Deadline - 1 day CRITICAL (error/red)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, direction, contract_ship_date, status, pol_id, pod_id, created_at
      ) VALUES ($1, $2, 'outgoing', CURRENT_DATE + INTERVAL '1 day', 'planning', $3, $4, NOW())
    `, ['SELLER-TEST-SHIP-1D', 'SELLER-TEST Product - URGENT Tomorrow', port1.id, port2.id]);

    // TEST 3: Booking Details - Share with customer
    console.log('📝 SELLER TEST 3: Booking Details - Share with CT (info/blue)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, direction, status, pol_id, pod_id, eta, created_at
      ) VALUES ($1, $2, 'outgoing', 'booked', $3, $4, CURRENT_DATE + INTERVAL '20 days', NOW())
    `, ['SELLER-TEST-BOOKED', 'SELLER-TEST Product - Booked', port1.id, port2.id]);

    // TEST 4: Goods Loaded - Issue documents
    console.log('📝 SELLER TEST 4: Goods Loaded - Issue Documents (warning/orange)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, direction, status, pol_id, pod_id, eta, created_at
      ) VALUES ($1, $2, 'outgoing', 'loaded', $3, $4, CURRENT_DATE + INTERVAL '15 days', NOW())
    `, ['SELLER-TEST-LOADED', 'SELLER-TEST Product - Loaded', port1.id, port2.id]);

    // TEST 5: Request Balance Payment (14 days before ETA)
    console.log('📝 SELLER TEST 5: Request Balance Payment - 14 days (info/blue)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, direction, status, pol_id, pod_id, eta,
        total_value_usd, paid_value_usd, balance_value_usd, created_at
      ) VALUES ($1, $2, 'outgoing', 'sailed', $3, $4, CURRENT_DATE + INTERVAL '14 days',
        100000, 30000, 70000, NOW())
    `, ['SELLER-TEST-BALANCE-14D', 'SELLER-TEST Product - Balance 14d', port1.id, port2.id]);

    // TEST 6: Arrival Follow-up (2 days after arrival)
    console.log('📝 SELLER TEST 6: Arrival Follow-up (info/blue)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, direction, status, pol_id, pod_id, eta, created_at
      ) VALUES ($1, $2, 'outgoing', 'arrived', $3, $4, CURRENT_DATE - INTERVAL '2 days', NOW())
    `, ['SELLER-TEST-ARRIVED', 'SELLER-TEST Product - Arrived 2d ago', port1.id, port2.id]);

    // TEST 7: Quality Feedback Request (10 days after ETA)
    console.log('📝 SELLER TEST 7: Quality Feedback Request (info/blue)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, direction, status, pol_id, pod_id, eta,
        quality_feedback_requested, created_at
      ) VALUES ($1, $2, 'outgoing', 'delivered', $3, $4, CURRENT_DATE - INTERVAL '10 days',
        FALSE, NOW())
    `, ['SELLER-TEST-QUALITY-10D', 'SELLER-TEST Product - Quality Check', port1.id, port2.id]);

    // TEST 8: Send Original Docs (payment received + draft approved)
    console.log('📝 SELLER TEST 8: Send Original Documents (warning/orange)...');
    await pool.query(`
      INSERT INTO logistics.shipments (
        sn, product_text, direction, status, pol_id, pod_id, eta,
        total_value_usd, paid_value_usd, balance_value_usd,
        docs_draft_approved, original_docs_sent, created_at
      ) VALUES ($1, $2, 'outgoing', 'sailed', $3, $4, CURRENT_DATE + INTERVAL '5 days',
        100000, 100000, 0,
        TRUE, FALSE, NOW())
    `, ['SELLER-TEST-SEND-DOCS', 'SELLER-TEST Product - Send Docs', port1.id, port2.id]);

    // Count created records
    const shipmentCount = await pool.query(`SELECT COUNT(*) FROM logistics.shipments WHERE sn LIKE 'SELLER-TEST-%'`);

    console.log('\n✅ SELLER test data created successfully!');
    console.log(`   📦 Created ${shipmentCount.rows[0].count} seller (outgoing) test shipments`);
    console.log('\n🔄 Now triggering notification check...');

    // Trigger notification check via API
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/notifications/check',
      method: 'POST',
    };

    const req = http.request(options, (res) => {
      console.log(`✅ Notification check triggered (status: ${res.statusCode})`);
      
      console.log('\n✅ Done! Check your SELLER notifications:');
      console.log('   1. Go to: http://localhost:5173/tasks');
      console.log('   2. Click the "تحديث" (Refresh) button');
      console.log('   3. You should see ~8 SELLER notifications');
      console.log('   4. These are for OUTGOING (seller) shipments');
      console.log('   5. Different from BUYER (incoming) notifications\n');
      console.log('📊 SELLER Notification Types:');
      console.log('   🔴 Critical: Shipping deadline 1 day');
      console.log('   🟠 Warning: Shipping deadline 5 days, Goods loaded, Send docs');
      console.log('   🔵 Info: Booking share, Balance request, Arrival follow-up, Quality feedback\n');
      
      pool.end();
    });

    req.on('error', (error) => {
      console.error('❌ Error triggering notification check:', error);
      pool.end();
    });

    req.end();

  } catch (error) {
    console.error('❌ Error creating seller test data:', error);
    await pool.end();
  }
}

createSellerTestData();

