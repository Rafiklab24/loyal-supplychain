const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

// Read the ORIGINAL bank template (with logo and exact formatting)
const templatePath = path.join(__dirname, '../../data/YAPI KREDI - LOYAL INTERNATIONAL- USD - TEMPLATES OF TRANSFERS ORDERS/TRANSFER ORDER EMPTY .docx');
const content = fs.readFileSync(templatePath);
const zip = new PizZip(content);

let documentXml = zip.file('word/document.xml').asText();

// Based on XML analysis, the table structure is:
// Row 1: [DÖVİZ CİNSİ VE TUTARI | USD | TARİH | EMPTY-date]
// Row 3: [Adı Soyadı / Ünvanı | EMPTY-sender_name]
// Row 4: [Müşteri Numarası | EMPTY-customer_number]
// Row 6: [Adı Soyadı / Ünvanı | EMPTY-beneficiary_name]
// Row 7: [Adresi | EMPTY-address]
// Row 8: [Banka Adı, Şubesi ve Ülkesi | EMPTY-bank_info]
// Row 9: [Banka SWIFT Kodu | EMPTY-swift]
// Row 10: [IBAN Numarası | EMPTY-iban]
// Row 11: [Hesap Bankasının Muhabiri | EMPTY-correspondent]
// Row 12: [Proforma / Fatura | EMPTY-invoice]
// Row 13: [Ödeme Detayları | EMPTY-payment_details]

// Step 1: Add amount placeholder after "USD" in the same cell
// Find the USD text and append the amount placeholder
documentXml = documentXml.replace(
  /(<w:t[^>]*>)(USD)(<\/w:t>)/i,
  '$1$2 {{amount}}$3'
);
console.log('Added {{amount}} after USD');

// Step 2: Replace empty cells with placeholders in order
// The order based on the table structure analysis:
const placeholders = [
  '{{transfer_date}}',       // First empty cell (after TARİH)
  '{{sender_name}}',         // Second empty (Adı Soyadı - sender section)
  '{{sender_customer_number}}', // Third empty (Müşteri Numarası)
  '{{beneficiary_name}}',    // Fourth empty (Adı Soyadı - beneficiary section)
  '{{beneficiary_address}}', // Fifth empty (Adresi)
  '{{bank_info}}',           // Sixth empty (Banka Adı, Şubesi ve Ülkesi)
  '{{swift_code}}',          // Seventh empty (Banka SWIFT Kodu)
  '{{iban_or_account}}',     // Eighth empty (IBAN Numarası)
  '{{correspondent_bank}}',  // Ninth empty (Hesap Bankasının Muhabiri)
  '{{invoice_info}}',        // Tenth empty (Proforma / Fatura)
  '{{payment_details}}',     // Eleventh empty (Ödeme Detayları)
];

// Process by splitting on </w:tc> and finding empty cells
const cells = documentXml.split(/<\/w:tc>/);
let processedXml = '';
let placeholderIndex = 0;

for (let i = 0; i < cells.length; i++) {
  let cell = cells[i];
  
  // Check if this cell contains only <w:p/> (empty paragraph) and no meaningful text
  const hasEmptyParagraph = cell.includes('<w:p/>');
  const hasText = /<w:t[^>]*>[^<]+<\/w:t>/.test(cell);
  
  if (hasEmptyParagraph && !hasText) {
    if (placeholderIndex < placeholders.length) {
      cell = cell.replace(
        /<w:p\/>/g, 
        `<w:p><w:r><w:t>${placeholders[placeholderIndex]}</w:t></w:r></w:p>`
      );
      console.log(`Replaced empty cell with ${placeholders[placeholderIndex]}`);
      placeholderIndex++;
    }
  }
  
  processedXml += cell;
  if (i < cells.length - 1) {
    processedXml += '</w:tc>';
  }
}

documentXml = processedXml;

// Step 3: Add checkbox placeholders before SHA, OUR, BEN
// The text tags contain just "SHA", "OUR", "BEN" without trailing chars

// For SHA - SHA is its own text run
documentXml = documentXml.replace(
  /(<w:t[^>]*>)(SHA)(<\/w:t>)/,
  '$1{{sha_checked}} $2$3'
);
console.log('Added {{sha_checked}}');

// For OUR
documentXml = documentXml.replace(
  /(<w:t[^>]*>)(OUR)(<\/w:t>)/,
  '$1{{our_checked}} $2$3'
);
console.log('Added {{our_checked}}');

// For BEN (may have trailing space or tab)
documentXml = documentXml.replace(
  /(<w:t[^>]*>)(BEN[\s\t]*)(<\/w:t>)/,
  '$1{{ben_checked}} $2$3'
);
console.log('Added {{ben_checked}}');

console.log(`Total empty cells replaced: ${placeholderIndex}`);

// Update the document.xml in the zip
zip.file('word/document.xml', documentXml);

// Generate new docx
const outputPath = path.join(__dirname, '../templates/yapi_kredi_transfer_template.docx');
const output = zip.generate({
  type: 'nodebuffer',
  compression: 'DEFLATE',
});

fs.writeFileSync(outputPath, output);
console.log(`Template saved to: ${outputPath}`);
