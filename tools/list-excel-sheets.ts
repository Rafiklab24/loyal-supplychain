#!/usr/bin/env ts-node
/**
 * List all sheets in an Excel file
 */

import * as XLSX from 'xlsx';

const filePath = process.argv[2] || 'data/البضاعة القادمة محدث.xlsx';

console.log(`\n📂 Reading file: ${filePath}\n`);

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log('📑 Available sheets:\n');
  workbook.SheetNames.forEach((name, idx) => {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;
    
    console.log(`${idx + 1}. "${name}"`);
    console.log(`   Rows: ${rowCount}, Columns: ${colCount}`);
    
    // Show first few column headers if available
    const firstRow: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })[0] as any;
    if (firstRow && firstRow.length > 0) {
      const headers = firstRow.filter(h => h).slice(0, 5);
      console.log(`   Headers: ${headers.join(', ')}${firstRow.length > 5 ? '...' : ''}`);
    }
    console.log('');
  });
  
  console.log(`✅ Total sheets: ${workbook.SheetNames.length}\n`);
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

