#!/usr/bin/env ts-node
/**
 * Data Quality Audit Script
 * 
 * Runs various QA checks on the database to identify data issues
 * 
 * Usage: ts-node etl/qa-checks.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface CheckResult {
  name: string;
  count: number;
  samples?: any[];
}

/**
 * Format number with padding
 */
function pad(num: number, width: number = 3): string {
  return num.toString().padStart(width, ' ');
}

/**
 * Print check result with samples
 */
function printCheck(index: number, result: CheckResult): void {
  const status = result.count === 0 ? '✓' : '⚠️';
  const countStr = pad(result.count);
  
  console.log(`${status} [${index}] ${result.name.padEnd(35, '.')} ${countStr}`);
  
  if (result.count > 0 && result.samples && result.samples.length > 0) {
    console.log(`    Samples (showing up to 10):`);
    result.samples.slice(0, 10).forEach((sample, i) => {
      const fields = Object.entries(sample)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      console.log(`      ${i + 1}. ${fields}`);
    });
    if (result.samples.length > 10) {
      console.log(`      ... and ${result.samples.length - 10} more`);
    }
    console.log();
  }
}

/**
 * Check 1: Missing SN
 */
async function checkMissingSn(): Promise<CheckResult> {
  const countResult = await pool.query(
    `SELECT COUNT(*) as count 
     FROM logistics.shipments 
     WHERE sn IS NULL OR trim(sn) = ''`
  );
  
  const samples = await pool.query(
    `SELECT id, direction, product_text, container_count 
     FROM logistics.shipments 
     WHERE sn IS NULL OR trim(sn) = ''
     LIMIT 10`
  );
  
  return {
    name: 'Missing SN',
    count: parseInt(countResult.rows[0].count),
    samples: samples.rows,
  };
}

/**
 * Check 2: Incomplete price/weight
 */
async function checkIncompletePriceWeight(): Promise<CheckResult> {
  const countResult = await pool.query(
    `SELECT COUNT(*) as count 
     FROM logistics.shipments 
     WHERE (weight_ton IS NULL OR fixed_price_usd_per_ton IS NULL)
       AND NOT is_deleted`
  );
  
  const samples = await pool.query(
    `SELECT sn, product_text, weight_ton, fixed_price_usd_per_ton 
     FROM logistics.shipments 
     WHERE (weight_ton IS NULL OR fixed_price_usd_per_ton IS NULL)
       AND NOT is_deleted
     LIMIT 10`
  );
  
  return {
    name: 'Incomplete price/weight',
    count: parseInt(countResult.rows[0].count),
    samples: samples.rows,
  };
}

/**
 * Check 3: Late ETA not arrived
 */
async function checkLateEta(): Promise<CheckResult> {
  const countResult = await pool.query(
    `SELECT COUNT(*) as count 
     FROM logistics.shipments 
     WHERE eta < CURRENT_DATE 
       AND status NOT IN ('arrived', 'delivered', 'invoiced')
       AND NOT is_deleted`
  );
  
  const samples = await pool.query(
    `SELECT sn, eta, status, product_text 
     FROM logistics.shipments 
     WHERE eta < CURRENT_DATE 
       AND status NOT IN ('arrived', 'delivered', 'invoiced')
       AND NOT is_deleted
     ORDER BY eta
     LIMIT 10`
  );
  
  return {
    name: 'Late ETA not arrived',
    count: parseInt(countResult.rows[0].count),
    samples: samples.rows,
  };
}

/**
 * Check 4: Transfers without shipment
 */
async function checkTransfersWithoutShipment(): Promise<CheckResult> {
  const countResult = await pool.query(
    `SELECT COUNT(*) as count 
     FROM finance.transfers 
     WHERE shipment_id IS NULL`
  );
  
  const samples = await pool.query(
    `SELECT id, transfer_date, direction, amount, currency, sender, receiver 
     FROM finance.transfers 
     WHERE shipment_id IS NULL
     ORDER BY transfer_date DESC
     LIMIT 10`
  );
  
  return {
    name: 'Transfers w/o shipment',
    count: parseInt(countResult.rows[0].count),
    samples: samples.rows,
  };
}

/**
 * Check 5: Suspicious ports
 */
async function checkSuspiciousPorts(): Promise<CheckResult> {
  const countResult = await pool.query(
    `SELECT COUNT(*) as count 
     FROM master_data.ports 
     WHERE length(trim(name)) < 2 
        OR trim(name) ~ '^[0-9]+$'`
  );
  
  const samples = await pool.query(
    `SELECT id, name, country, unlocode 
     FROM master_data.ports 
     WHERE length(trim(name)) < 2 
        OR trim(name) ~ '^[0-9]+$'
     LIMIT 10`
  );
  
  return {
    name: 'Suspicious ports',
    count: parseInt(countResult.rows[0].count),
    samples: samples.rows,
  };
}

/**
 * Check 6: Suspicious shipping lines
 */
async function checkSuspiciousShippingLines(): Promise<CheckResult> {
  const countResult = await pool.query(
    `SELECT COUNT(*) as count 
     FROM master_data.companies 
     WHERE is_shipping_line = true 
       AND length(trim(name)) < 3`
  );
  
  const samples = await pool.query(
    `SELECT id, name, country, is_shipping_line 
     FROM master_data.companies 
     WHERE is_shipping_line = true 
       AND length(trim(name)) < 3
     LIMIT 10`
  );
  
  return {
    name: 'Suspicious shipping lines',
    count: parseInt(countResult.rows[0].count),
    samples: samples.rows,
  };
}

/**
 * Check 7: Orphaned milestones
 */
async function checkOrphanedMilestones(): Promise<CheckResult> {
  const countResult = await pool.query(
    `SELECT COUNT(*) as count 
     FROM logistics.milestones m
     LEFT JOIN logistics.shipments s ON m.shipment_id = s.id
     WHERE s.id IS NULL`
  );
  
  const samples = await pool.query(
    `SELECT m.id, m.shipment_id, m.code, m.ts 
     FROM logistics.milestones m
     LEFT JOIN logistics.shipments s ON m.shipment_id = s.id
     WHERE s.id IS NULL
     LIMIT 10`
  );
  
  return {
    name: 'Orphaned milestones',
    count: parseInt(countResult.rows[0].count),
    samples: samples.rows,
  };
}

/**
 * Check 8: Duplicate SNs
 */
async function checkDuplicateSns(): Promise<CheckResult> {
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM (
       SELECT sn, COUNT(*) as cnt
       FROM logistics.shipments
       WHERE sn IS NOT NULL AND trim(sn) != ''
       GROUP BY sn
       HAVING COUNT(*) > 1
     ) sub`
  );
  
  const samples = await pool.query(
    `SELECT sn, COUNT(*) as duplicate_count
     FROM logistics.shipments
     WHERE sn IS NOT NULL AND trim(sn) != ''
     GROUP BY sn
     HAVING COUNT(*) > 1
     LIMIT 10`
  );
  
  return {
    name: 'Duplicate SNs',
    count: parseInt(countResult.rows[0].count),
    samples: samples.rows,
  };
}

/**
 * Main QA function
 */
async function runQaChecks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📋 QA CHECKS SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  const checks = [
    checkMissingSn,
    checkIncompletePriceWeight,
    checkLateEta,
    checkTransfersWithoutShipment,
    checkSuspiciousPorts,
    checkSuspiciousShippingLines,
    checkOrphanedMilestones,
    checkDuplicateSns,
  ];
  
  let totalIssues = 0;
  
  for (let i = 0; i < checks.length; i++) {
    try {
      const result = await checks[i]();
      printCheck(i + 1, result);
      totalIssues += result.count;
    } catch (error) {
      console.error(`✗ Check ${i + 1} failed:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log('='.repeat(60));
  if (totalIssues === 0) {
    console.log('✅ All checks passed - no issues found!');
  } else {
    console.log(`⚠️  Found ${totalIssues} total issue(s) - review samples above`);
  }
  console.log('='.repeat(60) + '\n');
}

/**
 * CLI entry point
 */
async function main() {
  try {
    await runQaChecks();
  } catch (error) {
    console.error('\n✗ QA checks failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { runQaChecks };

