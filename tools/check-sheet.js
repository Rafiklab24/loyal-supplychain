const XLSX = require('xlsx');

const wb = XLSX.readFile('data/البضاعة القادمة محدث.xlsx');
const sheet = wb.Sheets['جدول وصول البضائع'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

console.log('\n📋 First 10 rows of "جدول وصول البضائع":\n');
data.slice(0, 10).forEach((row, idx) => {
  const displayRow = row.slice(0, 8).map(cell => cell === null ? '—' : String(cell).substring(0, 15));
  console.log(`Row ${idx}: [${displayRow.join(' | ')}]`);
});

console.log('\n✅ Total rows:', data.length);

