const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

// Read the original template
const templatePath = path.join(__dirname, '../templates/transfer_order_template.docx');
const content = fs.readFileSync(templatePath);
const zip = new PizZip(content);

// Get the document.xml
let documentXml = zip.file('word/document.xml').asText();

// Looking at the template, the cells are structured as:
// Row 1: "PEŞİN İTHALAT TRANSFER TALİMATI" (header spanning all cols)
// Row 2: "DÖVİZ CİNSİ VE TUTARI" | "USD" | "TARİH" | [empty - date]
// The first empty cell is for the DATE, not the amount
// The amount should go next to USD in the same cell

// Let's map the empty cells correctly:
// 1. First empty cell after TARİH -> transfer_date
// 2-3. Sender section: name, customer number
// 4-10. Beneficiary section: name, address, bank info, swift, iban, correspondent, invoice, payment

const placeholders = [
  '{{transfer_date}}',      // 0 - after TARİH
  '{{sender_name}}',        // 1 - after Adı Soyadı / Ünvanı (sender)
  '{{sender_customer_number}}', // 2 - after Müşteri Numarası
  '{{beneficiary_name}}',   // 3 - after Adı Soyadı / Ünvanı (beneficiary)
  '{{beneficiary_address}}', // 4 - after Adresi
  '{{bank_info}}',          // 5 - after Banka Adı, Şubesi ve Ülkesi
  '{{swift_code}}',         // 6 - after Banka SWIFT Kodu
  '{{iban_or_account}}',    // 7 - after IBAN Numarası
  '{{correspondent_bank}}', // 8 - after Hesap Bankasının Muhabiri
  '{{invoice_info}}',       // 9 - after Proforma / Fatura Tarih ve No
  '{{payment_details}}'     // 10 - after Ödeme Detayları
];

let cellIndex = 0;

// Replace empty cells - they appear as </w:tcPr><w:p/></w:tc>
documentXml = documentXml.replace(/<\/w:tcPr><w:p\/><\/w:tc>/g, (match) => {
  if (cellIndex < placeholders.length) {
    const placeholder = placeholders[cellIndex];
    cellIndex++;
    return '</w:tcPr><w:p><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>' + placeholder + '</w:t></w:r></w:p></w:tc>';
  }
  return match;
});

// Now we need to add the amount placeholder next to USD
// Find "USD" and add amount after it in the same cell or a nearby structure
// The pattern for the USD cell value is: <w:t>USD</w:t></w:r></w:p></w:tc>
// We need to add amount value after USD with a space
documentXml = documentXml.replace(
  /(<w:t>USD<\/w:t><\/w:r><\/w:p><\/w:tc>)/,
  '<w:t>USD {{amount}}</w:t></w:r></w:p></w:tc>'
);

// Remove the filled checkbox shape for SHA (make it empty like others)
// The SHA checkbox has <a:solidFill><a:srgbClr val="000000"/></a:solidFill> - change to noFill
documentXml = documentXml.replace(
  /<a:solidFill><a:srgbClr val="000000"\/><\/a:solidFill>(<a:ln w="12700" cap="flat">)/g,
  '<a:noFill/>$1'
);

// Also need to handle v:fill for fallback
documentXml = documentXml.replace(
  /<v:fill color="#000000" opacity="100\.0%" type="solid"\/>/g,
  '<v:fill on="f"/>'
);

// Add checkbox placeholders before SHA, OUR, BEN
documentXml = documentXml.replace(
  /(<w:r><w:rPr><w:b w:val="1"\/><w:bCs w:val="1"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:rtl w:val="0"\/><w:lang w:val="en-US"\/><\/w:rPr><w:t>SHA<\/w:t><\/w:r>)/,
  '<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>{{sha_checked}} </w:t></w:r>$1'
);

documentXml = documentXml.replace(
  /(<w:r><w:rPr><w:b w:val="1"\/><w:bCs w:val="1"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:rtl w:val="0"\/><w:lang w:val="en-US"\/><\/w:rPr><w:t>OUR<\/w:t><\/w:r>)/,
  '<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>{{our_checked}} </w:t></w:r>$1'
);

documentXml = documentXml.replace(
  /(<w:r><w:rPr><w:b w:val="1"\/><w:bCs w:val="1"\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><w:rtl w:val="0"\/><w:lang w:val="de-DE"\/><\/w:rPr><w:t>BEN<\/w:t><\/w:r>)/,
  '<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>{{ben_checked}} </w:t></w:r>$1'
);

// Update the zip with modified document.xml
zip.file('word/document.xml', documentXml);

// Write the new template
const outputPath = path.join(__dirname, '../templates/transfer_order_template_with_placeholders.docx');
const output = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(outputPath, output);

console.log('Created template with placeholders at:', outputPath);
console.log('Empty cells filled:', cellIndex);
