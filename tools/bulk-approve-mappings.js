#!/usr/bin/env node
/**
 * Emergency Recovery Script
 * Bulk approves all field mappings that have known database tables
 * 
 * Run with: node tools/bulk-approve-mappings.js
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'field-mappings.json');

console.log('Reading field-mappings.json...');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

let approvedCount = 0;
let skippedCount = 0;
let mismatchCount = 0;

// Process each component's fields
data.components.forEach(component => {
  component.fields.forEach(field => {
    // Skip fields with UNKNOWN db_table - these need manual review
    if (field.db_table === 'UNKNOWN') {
      skippedCount++;
      console.log(`  SKIP (UNKNOWN): ${field.id}`);
      return;
    }
    
    // Keep mismatch status if it was explicitly marked
    if (field.status === 'mismatch') {
      mismatchCount++;
      console.log(`  KEEP MISMATCH: ${field.id}`);
      return;
    }
    
    // Approve all fields with known db_table
    if (field.status === 'pending') {
      field.status = 'approved';
      approvedCount++;
    }
  });
});

// Update the summary
data.summary.by_status = {
  approved: approvedCount,
  pending: skippedCount,
  mismatch: mismatchCount
};

// Write the updated JSON
console.log('\nWriting updated field-mappings.json...');
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

console.log('\n=== RECOVERY COMPLETE ===');
console.log(`Approved: ${approvedCount} fields`);
console.log(`Skipped (UNKNOWN): ${skippedCount} fields`);
console.log(`Kept as mismatch: ${mismatchCount} fields`);
console.log('\nYour field mappings have been restored!');












