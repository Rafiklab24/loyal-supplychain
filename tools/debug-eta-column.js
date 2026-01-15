const XLSX = require('xlsx');

const wb = XLSX.readFile('data/البضاعة القادمة محدث.xlsx');
const sheet = wb.Sheets['جدول وصول البضائع'];

// Read first 10 rows as arrays to see the structure
const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

console.log('\n📋 Sheet Structure - First 3 rows:\n');

// Row 0 (date header)
console.log('Row 0 (Header date):', allRows[0].slice(0, 12));

// Row 1 (column headers)
console.log('\nRow 1 (Column names):', allRows[1]);

// Row 2-5 (actual data for SN 291)
console.log('\n📦 First Data Rows:\n');
for (let i = 2; i <= 6; i++) {
  const row = allRows[i];
  console.log(`\nRow ${i} (SN: ${row[0]}):`);
  console.log('  Columns 0-11:', row.slice(0, 12));
}

// Now check which column has "2001" dates
console.log('\n\n🔍 Looking for problem shipments (SN 351, 377, 375):\n');

for (let i = 2; i < allRows.length; i++) {
  const row = allRows[i];
  const sn = row[0];
  
  if (['351', '377', '375', '374', '346'].includes(String(sn))) {
    console.log(`\n📦 SN ${sn}:`);
    console.log('  All columns:', row);
    console.log(`  Column 7 (ETA position): "${row[7]}"`);
  }
}

