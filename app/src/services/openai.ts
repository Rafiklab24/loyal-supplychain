/**
 * OpenAI GPT-4 Vision Service
 * Handles document extraction using OpenAI's Vision API
 */

import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Only include organization if it's set in .env
  ...(process.env.OPENAI_ORGANIZATION_ID && { organization: process.env.OPENAI_ORGANIZATION_ID }),
});

interface ExtractionResult {
  success: boolean;
  data: any;
  confidence: number;
  warnings: string[];
  processingTime: number;
  tokensUsed?: number;
  estimatedCost?: number;
}

// Usage tracking
let totalTokensUsed = 0;
let totalCost = 0;
let extractionCount = 0;

export async function extractFromProformaInvoice(
  imagePath: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    // Read image file and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' 
      ? 'image/png' 
      : 'image/jpeg';

    // Construct the prompt
    const prompt = buildExtractionPrompt();

    // OpenAI API call (logging handled elsewhere)

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
      temperature: 0.1, // Low temperature for consistency
    });

    // Track usage
    const usage = response.usage;
    if (usage) {
      totalTokensUsed += usage.total_tokens;
      extractionCount++;
      
      // GPT-4 Vision pricing (as of 2024)
      const inputCost = (usage.prompt_tokens / 1000000) * 10; // $10 per 1M tokens
      const outputCost = (usage.completion_tokens / 1000000) * 30; // $30 per 1M tokens
      const cost = inputCost + outputCost;
      totalCost += cost;
      
      // Token usage tracked in memory
    }

    // Parse the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Extract JSON from response (GPT sometimes wraps it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    // Calculate confidence score based on filled fields
    const confidence = calculateConfidence(extractedData);

    // Generate warnings for missing critical fields
    const warnings = generateWarnings(extractedData);

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: extractedData,
      confidence,
      warnings,
      processingTime,
      tokensUsed: usage?.total_tokens,
      estimatedCost: usage ? ((usage.prompt_tokens / 1000000) * 10 + (usage.completion_tokens / 1000000) * 30) : undefined,
    };
  } catch (error: any) {
    // Error logged by caller
    return {
      success: false,
      data: null,
      confidence: 0,
      warnings: [error.message || 'Unknown error'],
      processingTime: Date.now() - startTime,
    };
  }
}

function buildExtractionPrompt(): string {
  return `
You are an expert at extracting data from proforma invoices for international trade.

Analyze this proforma invoice image and extract ALL information into a JSON format.

IMPORTANT RULES:
1. Return ONLY valid JSON, no markdown, no additional text
2. If a field is not visible or unclear, use null
3. Convert all dates to YYYY-MM-DD format
4. Standardize country names (e.g., "Turkey" not "TURKEY")
5. Extract port codes if visible (e.g., "INMUN1" for Mumbai)
6. Calculate totals if not explicitly stated
7. For product lines, extract ALL products if multiple exist
8. Be EXTREMELY careful with numbers - preserve EXACT values from the document
9. CRITICAL: Read package sizes carefully from the document (e.g., "20 KG", "25 KG", "50 KG")
10. NEVER assume standard package sizes - always extract the EXACT size stated in the document
11. Calculate number_of_packages by: (total_quantity_kg ÷ unit_size)
12. Do NOT confuse container quantities with package/bag quantities

JSON SCHEMA:
{
  "proforma_invoice": {
    "number": "string or null",
    "date": "YYYY-MM-DD or null",
    "reference": "string or null"
  },
  "commercial_parties": {
    "exporter": {
      "name": "string or null",
      "address": "string or null",
      "country": "string or null"
    },
    "buyer": {
      "name": "string or null",
      "address": "string or null",
      "country": "string or null"
    },
    "consignee": {
      "name": "string or null (if different from buyer)",
      "address": "string or null",
      "country": "string or null"
    }
  },
  "shipping_geography": {
    "country_of_origin": "string or null",
    "country_of_destination": "string or null",
    "port_of_loading": "string or null",
    "port_of_loading_code": "string or null (e.g., INMUN1)",
    "port_of_discharge": "string or null",
    "port_of_discharge_code": "string or null",
    "final_destination": "string or null",
    "pre_carriage_by": "string or null"
  },
  "contract_terms": {
    "incoterm": "string or null (CIF, FOB, CFR, etc.)",
    "delivery_terms_detail": "string or null",
    "payment_terms": "string or null",
    "payment_method": "string or null (L/C, T/T, CAD, etc.)",
    "currency": "string or null (USD, EUR, etc.)",
    "usd_equivalent_rate": "number or null (if currency is not USD)"
  },
  "special_clauses": [
    {
      "title": "string",
      "text": "string"
    }
  ],
  "product_lines": [
    {
      "type_of_goods": "string - full product description",
      "grade": "string or null - product grade (e.g., WW160, WW180, WS JUMBO, Grade A)",
      "brand": "string or null",
      "trademark": "string or null",
      "packaging_mode": "string - PACKAGED or BULK (detect from description: bulk, loose, سائب, بدون تغليف = BULK; bags, boxes, cartons, etc. = PACKAGED)",
      "kind_of_packages": "string or null (BAGS, BOXES, CARTONS, TINS, BULK, etc.) - use BULK if no packaging",
      "number_of_packages": "number or null - use 0 or null for BULK cargo",
      "unit_size": "number or null - weight per package in KG - use null for BULK cargo",
      "quantity_kg": "number or null - total weight in KG",
      "quantity_mt": "number or null - total weight in MT (quantity_kg / 1000)",
      "pricing_method": "string - one of: per_kg, per_mt, per_lb, per_package, total",
      "unit_price": "number - the EXACT price shown on invoice (e.g., 8.55 for USD/KG)",
      "rate_per_mt_equivalent": "number or null - calculated USD/MT equivalent",
      "amount": "number or null - total amount for this line",
      "notes": "string or null"
    }
  ],
  "banking_details": {
    "beneficiary_name": "string or null",
    "bank_name": "string or null",
    "account_number": "string or null",
    "swift_code": "string or null",
    "iban": "string or null",
    "bank_address": "string or null",
    "correspondent_bank": "string or null"
  },
  "document_requirements": [
    {
      "document_type": "string",
      "copies": "number or null",
      "attestation_required": "boolean or null",
      "notes": "string or null"
    }
  ],
  "totals": {
    "total_packages": "number or null",
    "total_quantity_mt": "number or null",
    "total_amount": "number or null",
    "currency": "string or null"
  },
  "additional_notes": "string or null"
}

EXTRACTION TIPS:
- Look for "Proforma Invoice" number near the top
- Exporter is usually "From" or "Shipper" or "Seller"
- Buyer is usually "To" or "Consignee" or "Buyer"
- Incoterm is often in caps: CIF, FOB, CFR
- ⚠️ NORMALIZE INCOTERM ALIASES: "CNF", "C&F", "C+F", "C AND F" should ALL be extracted as "CFR"
- Payment terms often include "days" or "arrival"
- Product lines are usually in a table format
- Banking details are often at the bottom
- Look for tolerance clauses (e.g., "10% plus/minus")

═══════════════════════════════════════════════════════════════════════════════
⚠️ BULK / UNPACKAGED GOODS DETECTION - IMPORTANT
═══════════════════════════════════════════════════════════════════════════════

Detect BULK (unpackaged) goods using these keywords (English and Arabic):
- "bulk", "in bulk", "loose", "unpackaged", "unpacked"
- "سائب", "بدون تغليف", "بضائع سائبة", "غير معبأ"
- No mention of bags, cartons, packages, or containers for the goods

When bulk goods are detected:
- Set packaging_mode: "BULK"
- Set kind_of_packages: "BULK"
- Set number_of_packages: null or 0
- Set unit_size: null
- quantity_mt is the primary quantity field for bulk goods

When packaged goods are detected (bags, boxes, cartons, tins, drums, etc.):
- Set packaging_mode: "PACKAGED"
- Set kind_of_packages to the appropriate type (BAGS, BOXES, CARTONS, etc.)
- Extract number_of_packages and unit_size as normal

═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL: SEPARATE PRODUCT LINES BY GRADE - THIS IS MANDATORY
═══════════════════════════════════════════════════════════════════════════════

If the invoice shows MULTIPLE product grades (e.g., WW160, WW180, WS JUMBO):
- Create ONE SEPARATE product_line object for EACH grade
- Each grade gets its own quantity, price, and amount
- NEVER combine different grades into one line

Example of CORRECT extraction for an invoice with 3 grades:
Invoice table shows:
| Description                           | Net Weight | Unit Price | Amount     |
| CASHEW KERNELS GRADE WW160           | 26,000 kg  | 8.55/KG    | 222,300.00 |
| CASHEW KERNELS GRADE WW180           | 26,000 kg  | 7.55/KG    | 196,300.00 |
| CASHEW KERNELS GRADE WS JUMBO BIG    | 26,000 kg  | 6.45/KG    | 167,700.00 |

MUST extract as 3 SEPARATE product_lines:
[
  {
    "type_of_goods": "CASHEW KERNELS",
    "grade": "WW160",
    "quantity_kg": 26000,
    "quantity_mt": 26,
    "pricing_method": "per_kg",
    "unit_price": 8.55,
    "rate_per_mt_equivalent": 8550,
    "amount": 222300
  },
  {
    "type_of_goods": "CASHEW KERNELS",
    "grade": "WW180",
    "quantity_kg": 26000,
    "quantity_mt": 26,
    "pricing_method": "per_kg",
    "unit_price": 7.55,
    "rate_per_mt_equivalent": 7550,
    "amount": 196300
  },
  {
    "type_of_goods": "CASHEW KERNELS",
    "grade": "WS JUMBO BIG SIZE",
    "quantity_kg": 26000,
    "quantity_mt": 26,
    "pricing_method": "per_kg",
    "unit_price": 6.45,
    "rate_per_mt_equivalent": 6450,
    "amount": 167700
  }
]

═══════════════════════════════════════════════════════════════════════════════
⚠️ PRICING METHOD DETECTION - PRESERVE ORIGINAL PRICING UNIT
═══════════════════════════════════════════════════════════════════════════════

Look at the column headers or price labels to determine the pricing unit:

1. Detect pricing_method from column headers:
   - "USD/KG", "$/KG", "Price/KG", "Unit Price (USD/KG)" → pricing_method: "per_kg"
   - "USD/MT", "$/MT", "Price/MT", "Unit Price (USD/MT)" → pricing_method: "per_mt"
   - "USD/LB", "$/LB", "Price/LB" → pricing_method: "per_lb"
   - "Per Bag", "Per Package", "Per Unit" → pricing_method: "per_package"
   - No unit visible or lump sum → pricing_method: "total"

2. Extract unit_price as the EXACT value shown (e.g., 8.55 for $8.55/KG)

3. Calculate rate_per_mt_equivalent based on pricing_method:
   - per_kg: rate_per_mt_equivalent = unit_price × 1000
   - per_lb: rate_per_mt_equivalent = unit_price × 2204.62
   - per_mt: rate_per_mt_equivalent = unit_price (same value)
   - per_package: rate_per_mt_equivalent = amount / quantity_mt

Example - USD/KG pricing:
Invoice shows: "$8.55/KG"
CORRECT extraction:
- pricing_method: "per_kg"
- unit_price: 8.55
- rate_per_mt_equivalent: 8550 (8.55 × 1000)

═══════════════════════════════════════════════════════════════════════════════
⚠️ QUANTITY EXTRACTION FOR CARTONS/TINS - STEP BY STEP
═══════════════════════════════════════════════════════════════════════════════

For invoices with CARTONS, TINS, or other containers:

1. Look for "Net Weight" columns:
   - One column may show weight per unit (e.g., "KGS/CTN" = 20.00)
   - Another column shows total weight (e.g., "Net Weight (KGS)" = 26,000.00)

2. Extract quantity_kg:
   - Find the TOTAL net weight column
   - This is the total weight in KG (e.g., 26,000)

3. Extract quantity_mt:
   - Calculate: quantity_mt = quantity_kg / 1000
   - Example: 26,000 kg → quantity_mt = 26

4. Extract number_of_packages:
   - Look for carton/tin count in description or table
   - Example: "1300 CARTONS" → number_of_packages = 1300

5. Extract unit_size:
   - Look for weight per package in the per-unit column
   - Example: "KGS/CTN = 20.00" → unit_size = 20

Verification formula:
number_of_packages × unit_size ≈ quantity_kg

Example with TINS/CARTONS:
Invoice table shows:
| Description          | Net Wt (KGS/CTN) | Net Weight (KGS) | Unit Price (USD/KG) |
| 1300 CARTONS WW160   | TINS 20.00       | 26,000.00        | 8.55                |

CORRECT extraction:
- kind_of_packages: "CARTONS" (or "TINS" if that's primary)
- number_of_packages: 1300
- unit_size: 20 (from KGS/CTN column)
- quantity_kg: 26000
- quantity_mt: 26
- unit_price: 8.55
- pricing_method: "per_kg"
- rate_per_mt_equivalent: 8550

CRITICAL PACKAGE SIZE EXTRACTION - STEP BY STEP:

STEP 1 - Find the TOTAL QUANTITY:
- Look in the "WEIGHT" column ONLY for the total MT/MTS or KG
- Read the number directly as stated: "26 MTS" means 26 MT, "26,000 KGS" means 26000 kg
- If you see "20 X 20 FEET CONTAINER WITH 26 METRIC TONS EACH", calculate: 20 × 26 = 520 MT
- Examples:
  * "26,000.00" in KGS column → quantity_kg = 26000, quantity_mt = 26
  * "26 MTS" → quantity_mt = 26, quantity_kg = 26000
  * "520 MT" → quantity_mt = 520, quantity_kg = 520000

STEP 2 - Find the PACKAGE SIZE:
- Look in "KGS/CTN", "NET WT/PKG", or product description
- Find text like "TINS 20.00", "IN 10KGS CARTONS", "PACKED IN 25KG BAGS"
- The number is the INDIVIDUAL package weight in KG
- Examples:
  * "TINS 20.00" → unit_size = 20
  * "IN 10KGS CARTONS" → unit_size = 10
  * "PACKED IN 25 KG BAGS" → unit_size = 25

STEP 3 - Find NUMBER OF PACKAGES:
- Look in product description for count: "1300 CARTONS", "500 BAGS"
- Or calculate: number_of_packages = quantity_kg ÷ unit_size
- Example: 26000 kg total, 20kg per package → 26000 ÷ 20 = 1300 packages

CRITICAL WARNINGS:
- ⚠️ NEVER use container count (like "3 FCL" or "40' containers") as number_of_packages
- ⚠️ NEVER use the package size as the package count
- ⚠️ Package size is weight PER package, NOT total weight
- ⚠️ Look for SEPARATE columns: one for per-unit weight, one for total weight

VERIFICATION:
- Check: quantity_mt × rate_per_mt_equivalent should approximately equal amount
- Check: number_of_packages × unit_size should equal quantity_kg
- Check: pricing_method matches the column header (USD/KG, USD/MT, etc.)

Return the extracted data as a JSON object now.
`.trim();
}

function calculateConfidence(data: any): number {
  let score = 0;
  let maxScore = 0;

  // Critical fields (higher weight)
  const criticalFields = [
    { path: 'proforma_invoice.number', weight: 10 },
    { path: 'proforma_invoice.date', weight: 10 },
    { path: 'commercial_parties.exporter.name', weight: 15 },
    { path: 'commercial_parties.buyer.name', weight: 15 },
    { path: 'contract_terms.incoterm', weight: 10 },
    { path: 'contract_terms.payment_terms', weight: 10 },
    { path: 'totals.total_amount', weight: 15 },
  ];

  // Product lines (weight based on count)
  const productLinesWeight = 15;

  criticalFields.forEach(({ path, weight }) => {
    maxScore += weight;
    const value = getNestedValue(data, path);
    if (value !== null && value !== undefined && value !== '') {
      score += weight;
    }
  });

  maxScore += productLinesWeight;
  if (data.product_lines && data.product_lines.length > 0) {
    score += productLinesWeight;
  }

  return Math.round((score / maxScore) * 100);
}

function validateProductLines(lines: any[]): string[] {
  const warnings: string[] = [];
  
  if (!lines || lines.length === 0) {
    return warnings;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const linePrefix = `Product line ${i + 1}`;

    // Check if package size seems too large (likely an error)
    if (line.unit_size && line.unit_size > 1000) {
      warnings.push(`${linePrefix}: Package size ${line.unit_size}kg seems unusually large - please verify`);
    }

    // Check if package count calculation matches
    if (line.quantity_mt && line.unit_size && line.number_of_packages) {
      const expectedPackages = Math.round((line.quantity_mt * 1000) / line.unit_size);
      const difference = Math.abs(line.number_of_packages - expectedPackages);
      
      // Allow 1% tolerance for rounding
      if (difference > expectedPackages * 0.01 && difference > 10) {
        warnings.push(
          `${linePrefix}: Package count mismatch - expected ~${expectedPackages} packages ` +
          `(${line.quantity_mt} MT ÷ ${line.unit_size}kg), but got ${line.number_of_packages}`
        );
      }
    }

    // Check if amount calculation matches
    if (line.quantity_mt && line.rate_per_mt && line.amount) {
      const expectedAmount = Math.round(line.quantity_mt * line.rate_per_mt * 100) / 100;
      const difference = Math.abs(line.amount - expectedAmount);
      
      // Allow $1 tolerance for rounding
      if (difference > 1) {
        warnings.push(
          `${linePrefix}: Amount mismatch - expected $${expectedAmount.toFixed(2)} ` +
          `(${line.quantity_mt} MT × $${line.rate_per_mt}/MT), but got $${line.amount}`
        );
      }
    }

    // Check for suspiciously low package sizes
    if (line.unit_size && line.unit_size < 0.1) {
      warnings.push(`${linePrefix}: Package size ${line.unit_size}kg seems too small - please verify`);
    }
  }

  return warnings;
}

function generateWarnings(data: any): string[] {
  const warnings: string[] = [];

  if (!data.proforma_invoice?.number) {
    warnings.push('Proforma invoice number not found');
  }
  if (!data.commercial_parties?.exporter?.name) {
    warnings.push('Exporter name not found');
  }
  if (!data.commercial_parties?.buyer?.name) {
    warnings.push('Buyer name not found');
  }
  if (!data.product_lines || data.product_lines.length === 0) {
    warnings.push('No product lines found');
  } else {
    // Add product line validation warnings
    const productWarnings = validateProductLines(data.product_lines);
    warnings.push(...productWarnings);
  }
  if (!data.banking_details?.bank_name) {
    warnings.push('Banking details not found - may need manual entry');
  }
  if (!data.totals?.total_amount) {
    warnings.push('Total amount not found');
  }

  return warnings;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Extract data from Bill of Lading or CMR documents
 */
export async function extractFromBillOfLading(
  imagePath: string | string[]  // Can be single path or array for multi-page PDFs
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    // Handle both single image and array of images (for multi-page PDFs)
    const imagePaths = Array.isArray(imagePath) ? imagePath : [imagePath];
    
    // Build image content array for OpenAI Vision API
    const imageContents: any[] = [];
    for (const imgPath of imagePaths) {
      const imageBuffer = await fs.readFile(imgPath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = path.extname(imgPath).toLowerCase() === '.png' 
        ? 'image/png' 
        : 'image/jpeg';
      
      imageContents.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
        },
      });
    }

    // Construct the prompt
    const prompt = buildBOLExtractionPrompt();

    // OpenAI BOL extraction call with all pages
    logger.info(`🤖 Sending ${imagePaths.length} page(s) to OpenAI for BOL extraction...`);

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            ...imageContents,  // Include all page images
          ],
        },
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
      temperature: 0.1, // Low temperature for consistency
    });

    // Track usage
    const usage = response.usage;
    if (usage) {
      totalTokensUsed += usage.total_tokens;
      extractionCount++;
      
      // GPT-4 Vision pricing (as of 2024)
      const inputCost = (usage.prompt_tokens / 1000000) * 10; // $10 per 1M tokens
      const outputCost = (usage.completion_tokens / 1000000) * 30; // $30 per 1M tokens
      const cost = inputCost + outputCost;
      totalCost += cost;
      
      // BOL extraction token usage tracked
    }

    // Parse the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Extract JSON from response (GPT sometimes wraps it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    // Check if document was not found in multi-document file
    // Accept FALLBACK as a valid result - we want to use data from alternate documents
    if (extractedData.document_info?.document_type === 'NOT_FOUND') {
      const processingTime = Date.now() - startTime;
      return {
        success: false,
        data: null,
        confidence: 0,
        warnings: [extractedData.error || 'No Bill of Lading or transport document found in the provided file. The file may contain other documents (Certificate of Origin, Packing List, etc.) but no B/L.'],
        processingTime,
        tokensUsed: usage?.total_tokens,
        estimatedCost: usage ? ((usage.prompt_tokens / 1000000) * 10 + (usage.completion_tokens / 1000000) * 30) : undefined,
      };
    }

    // If fallback document was used, treat it as successful extraction
    if (extractedData.document_info?.document_type === 'FALLBACK' || 
        extractedData.document_info?.data_source === 'fallback') {
      logger.info(`📋 BOL extraction used fallback: ${extractedData.document_info?.fallback_document_type || 'unknown'}`);
    }

    // Calculate confidence score based on filled fields
    const confidence = calculateBOLConfidence(extractedData);

    // Generate warnings for missing critical fields
    let warnings = generateBOLWarnings(extractedData);
    
    // Add warning if data came from fallback source (not primary B/L document)
    if (extractedData.document_info?.data_source === 'fallback') {
      const fallbackType = extractedData.document_info?.fallback_document_type || 'another document';
      warnings = [
        `⚠️ No Bill of Lading found. Data was extracted from ${fallbackType}. Please verify shipping details.`,
        ...warnings
      ];
    }

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: extractedData,
      confidence,
      warnings,
      processingTime,
      tokensUsed: usage?.total_tokens,
      estimatedCost: usage ? ((usage.prompt_tokens / 1000000) * 10 + (usage.completion_tokens / 1000000) * 30) : undefined,
    };
  } catch (error: any) {
    // Error logged by caller
    return {
      success: false,
      data: null,
      confidence: 0,
      warnings: [error.message || 'Unknown error'],
      processingTime: Date.now() - startTime,
    };
  }
}

function buildBOLExtractionPrompt(): string {
  return `
You are an expert at extracting data from Bill of Lading (BOL) and CMR transport documents.

IMPORTANT: This document may contain MULTIPLE pages or documents bundled together (e.g., Commercial Invoice, Packing List, Certificate of Origin, Phytosanitary Certificate, Insurance Certificate, etc.).

YOUR TASK: Identify and extract data ONLY from the Bill of Lading (BOL) or its equivalents:
- Bill of Lading (B/L)
- Sea Waybill
- CMR (Convention on the Contract for the International Carriage of Goods by Road)
- Airway Bill (AWB)
- Multimodal Transport Document

IGNORE other documents in the file such as:
- Commercial Invoice
- Packing List
- Certificate of Origin
- Phytosanitary Certificate
- Fumigation Certificate
- Insurance Certificate
- Inspection Certificates

⚠️ CRITICAL FALLBACK BEHAVIOR - ALWAYS EXTRACT DATA:
If no Bill of Lading or transport document is found, you MUST still extract useful shipping information 
from ANY document present in the file. This includes:
- Commercial Invoice → Extract: ports, vessel name, shipping dates, container numbers if present
- Packing List → Extract: container numbers, weights, package counts, shipping marks
- Certificate of Origin → Extract: origin/destination, exporter/importer details

DO NOT return NOT_FOUND if there is ANY useful shipping data in the documents!
Instead, extract what you can and mark it as fallback:
- Set "document_info.data_source": "fallback"
- Set "document_info.fallback_document_type": "COMMERCIAL_INVOICE" (or "PACKING_LIST", etc.)
- Set "document_info.document_type": "FALLBACK" (not "NOT_FOUND")

Only return NOT_FOUND if the file is completely empty, corrupted, or contains no shipping-related 
information at all.

Analyze the transport document and extract ALL logistics information into a JSON format.

IMPORTANT RULES:
1. Return ONLY valid JSON, no markdown, no additional text
2. If a field is not visible or unclear, use null
3. Convert all dates to YYYY-MM-DD format
4. Identify transport mode: "SEA" for Bill of Lading, "LAND" for CMR/truck transport, "AIR" for Airway Bill
5. Extract all container numbers as an array
6. Be precise with port names and shipping line names
7. Extract vessel/truck information based on transport mode
8. Focus ONLY on the Bill of Lading / transport document pages
9. CRITICAL - DO NOT CONFUSE THESE DOCUMENT NUMBERS:
   - "S/B NO." or "SB NO." = Shipping Bill Number (Indian customs export document) - DO NOT extract this
   - "BOOKING NO." or "BOOKING REF." or "BKG" = Carrier booking reference - extract this as booking_number
   - "B/L NO." or "BILL OF LADING No." = Bill of Lading number - extract this as bl_number
   - "INVOICE NO." = Commercial Invoice number - DO NOT extract this as booking_number

⚠️ B/L NUMBER vs BOOKING REF - CRITICAL DISTINCTION:
- The B/L NUMBER is the MAIN document identifier, typically shown PROMINENTLY in the HEADER/TOP of the document
- The BOOKING REF is a separate internal carrier reference, usually shown in the BODY of the document
- These are TWO DIFFERENT numbers - never use booking ref as bl_number!

MSC B/L Number Examples (always in header, format: MEDUxxxxxx or similar):
- "BILL OF LADING No. MEDUJH438155" → bl_number: "MEDUJH438155"
- "B/L NO.: MEDUJH412739" → bl_number: "MEDUJH412739"
- "BILL OF LADING No: MSCU1234567" → bl_number: "MSCU1234567"

BOOKING REF Examples (in body, often starts with numbers):
- "BOOKING REF: 177GPPPPXTNN4356" → booking_number: "177GPPPPXTNN4356"
- "BKG: 457-9865-ST" → booking_number: "457-9865-ST"

WHERE TO FIND B/L NUMBER:
- Look at the TOP RIGHT or TOP CENTER of the first page
- It's usually the LARGEST/MOST PROMINENT document number
- MSC B/Ls: Usually starts with "MEDU" or "MSCU"
- Maersk B/Ls: Usually starts with "MAEU"
- CMA CGM: Usually starts with "CMAU"
- The label will say "BILL OF LADING No." or "B/L NO."

JSON SCHEMA:
{
  "document_info": {
    "document_type": "string (BOL, CMR, or other)",
    "transport_mode": "string (SEA or LAND)",
    "bl_number": "string or null (Bill of Lading number)",
    "cmr_number": "string or null (CMR number for land transport)",
    "booking_number": "string or null (ONLY actual carrier booking reference, NOT S/B or Invoice numbers)",
    "bl_date": "YYYY-MM-DD or null"
  },
  "shipping_line": {
    "name": "string or null (shipping line or transport company name)",
    "scac_code": "string or null"
  },
  "ports": {
    "port_of_loading": "string or null (full port name)",
    "port_of_loading_code": "string or null (e.g., USNYC, INMUN1)",
    "port_of_discharge": "string or null (full port name)",
    "port_of_discharge_code": "string or null",
    "place_of_receipt": "string or null",
    "place_of_delivery": "string or null"
  },
  "dates": {
    "etd": "YYYY-MM-DD or null (Estimated/Actual departure date)",
    "eta": "YYYY-MM-DD or null (Estimated/Actual arrival date)",
    "on_board_date": "YYYY-MM-DD or null"
  },
  "vessel_info": {
    "vessel_name": "string or null (for sea freight)",
    "vessel_imo": "string or null (IMO number for sea freight)",
    "voyage_number": "string or null"
  },
  "truck_info": {
    "truck_plate_number": "string or null (for land transport)",
    "driver_name": "string or null"
  },
  "cargo_details": {
    "packaging_mode": "string - PACKAGED or BULK (detect bulk cargo from description: bulk, loose, سائب, بدون تغليف)",
    "containers": [
      {
        "container_number": "string (format: ABCD1234567)",
        "size_code": "string or null (20GP, 40GP, 40HC, 45HC, etc.)",
        "gross_weight_kg": "number or null (gross weight in KG)",
        "net_weight_kg": "number or null (net weight in KG)",
        "seal_number": "string or null",
        "package_count": "number or null (packages in this container - null for BULK cargo)"
      }
    ],
    "container_numbers": ["array of container numbers or empty array - for backwards compatibility"],
    "container_types": ["array of container types (20GP, 40HC, etc.) or empty array"],
    "number_of_containers": "number or null",
    "total_gross_weight_kg": "number or null (total gross weight in KG)",
    "total_net_weight_kg": "number or null (total net weight in KG)",
    "cargo_description": "string or null",
    "package_type": "string or null (BAGS, CARTONS, DRUMS, BULK, etc.)",
    "total_packages": "number or null (total package count - null for BULK cargo)",
    "measurement": "number or null (CBM)"
  },
  "parties": {
    "shipper": "string or null",
    "consignee": "string or null",
    "notify_party": "string or null"
  },
  "terms": {
    "freight_payment": "string or null (PREPAID, COLLECT, etc.)",
    "number_of_originals": "number or null",
    "free_time_days": "number or null"
  },
  "additional_info": {
    "marks_and_numbers": "string or null",
    "special_instructions": "string or null"
  }
}

EXTRACTION GUIDELINES:

FOR BILL OF LADING (SEA FREIGHT):
- Look for "BILL OF LADING" header
- B/L Number is usually prominently displayed at top
- Vessel name and voyage number are key identifiers
- Container numbers are usually in format: ABCD1234567
- Port codes follow UN/LOCODE format (e.g., USNYC, INMUN1, AEJEA)
- Extract all container numbers as separate array items

FOR CMR (LAND TRANSPORT):
- Look for "CMR" or "Convention Merchandises Routieres"
- CMR number is the document identifier
- Truck plate number and driver info instead of vessel
- Loading and unloading locations instead of ports
- Transport company name is critical

CRITICAL FIELDS TO PRIORITIZE:
1. Document number (B/L or CMR number)
2. Shipping line or transport company name
3. Port of Loading (POL) / Loading place
4. Port of Discharge (POD) / Unloading place  
5. ETD and ETA dates
6. Container numbers (for sea) or truck plate (for land)
7. Vessel name (for sea) or truck info (for land)

DATE EXTRACTION (IMPORTANT):
- Look for: "SHIPPED ON BOARD DATE", "On Board Date", "ETD", "ETA", "Date of Issue", "B/L Date"
- Common formats: DD/MM/YYYY, MM/DD/YYYY, DD-MMM-YYYY, DD.MM.YYYY
- Always convert to YYYY-MM-DD format
- If only month/year visible, use first day of month
- SHIPPED ON BOARD DATE = when cargo loaded onto vessel → use as ETD if explicit ETD not shown
- For ETD: Look for departure date, sailing date, or shipped on board date
- For ETA: Look for arrival date, expected delivery date
- on_board_date: Extract the "SHIPPED ON BOARD DATE" separately (this is critical for trade documents)
- bl_date: Extract the B/L issue date (usually at bottom: "PLACE AND DATE OF ISSUE")

⚠️ ETD FALLBACK PRIORITY:
1. Explicit ETD/Departure Date → use as etd
2. "SHIPPED ON BOARD DATE" → use as on_board_date (system will use as ETD fallback)
3. B/L Issue Date → use as bl_date (system will use as final ETD fallback if no other dates found)

CONTAINER DETAILS (CRITICAL - Extract Per-Container Information):
- Container Number Format: 4 letters + 7 digits (e.g., MSCU1234567)
- Look for container tables that list each container with details
- For EACH container, extract:
  1. container_number: The unique container ID (e.g., MSCU1234567)
  2. size_code: Container type (20GP, 40GP, 40HC, 45HC, 20RF, 40RF)
     - 20GP = 20ft General Purpose
     - 40GP = 40ft General Purpose  
     - 40HC = 40ft High Cube
     - 45HC = 45ft High Cube
     - 20RF/40RF = Refrigerated
  3. gross_weight_kg: Total weight including container (in KG)
  4. net_weight_kg: Weight of goods only (in KG)
  5. seal_number: Seal number if shown (often near container number)
  6. package_count: Number of packages in this container

- Also populate the legacy container_numbers array for backwards compatibility
- Calculate totals: total_gross_weight_kg, total_net_weight_kg, number_of_containers

WEIGHT EXTRACTION FROM BOL TABLES:
- Look for columns like "Gross Weight", "Net Weight", "G.W.", "N.W."
- Weights may be in KG, KGS, MT, TONS - convert to KG
- If weight is in MT/TONS, multiply by 1000 to get KG
- Common table formats:
  | Container No | Type | Gross Wt (KG) | Net Wt (KG) | Seal No |
  | MSCU1234567  | 40HC | 26500        | 24000       | SL12345 |

⚠️ IMPORTANT - HANDLING MISSING INDIVIDUAL NET WEIGHTS:
Some BOLs only show GROSS weight per container but NET weight as a TOTAL only.
In this case:
1. Set net_weight_kg to null for each container (don't guess)
2. Make sure to extract the TOTAL net weight into total_net_weight_kg
3. Look for total net weight in places like:
   - "Total Net Weight: 110,000 kg" 
   - "Net Weight: 110 MT" (convert to KG: 110,000)

═══════════════════════════════════════════════════════════════════════════════
BULK / UNPACKAGED CARGO DETECTION (IMPORTANT)
═══════════════════════════════════════════════════════════════════════════════

Detect BULK (unpackaged) cargo using these keywords (English and Arabic):
- "bulk cargo", "in bulk", "loose", "bulk", "unpackaged"  
- "سائب", "بدون تغليف", "بضائع سائبة", "غير معبأ"
- Break bulk cargo without individual packaging
- Grain, ore, coal, liquid cargo in tanks (tanker vessels)

When bulk cargo is detected:
- Set cargo_details.packaging_mode: "BULK"
- Set cargo_details.package_type: "BULK"
- Set cargo_details.total_packages: null
- Weight (gross/net) becomes the primary quantity indicator
- Container package_count can be null for bulk

When packaged cargo is detected:
- Set cargo_details.packaging_mode: "PACKAGED"
- Extract package_type, total_packages, and per-container package_count as normal
   - Summary rows at bottom of container table
   - Commercial Invoice reference showing net weight
4. The system will automatically divide total net weight by container count

Example BOL showing only gross per container:
  | Container     | Gross Weight |
  | MEDU7188398   | 22,088 kgs   |
  | FSCU8806900   | 22,088 kgs   |
  Total: 110,440 kgs gross, 110,000 kgs net (5 containers)
  
→ Set each container's net_weight_kg: null
→ Set total_net_weight_kg: 110000
→ System calculates: 110000 / 5 = 22000 kg net per container

SEAL NUMBERS:
- Format varies: alphanumeric, often starts with letters
- May be labeled "Seal No", "Seal #", "Container Seal"
- Often in same row as container number

SHIPPING LINE NAMES:
- Look for carrier name at top of document
- Common examples: Maersk, MSC, CMA CGM, Hapag-Lloyd, COSCO, ONE
- For land: company operating the truck transport
- Extract full company name as shown

PORT CODES:
- UN/LOCODE format: 2-letter country + 3-letter location
- Examples: USNYC (New York), INMUN1 (Mumbai), AEJEA (Jebel Ali)
- May be in parentheses after port name
- Extract both full name and code if available

FREE TIME:
- Look for "Free Time", "Free Days", "Detention Free Days"
- Usually a number of days (e.g., "7 days", "14 days free time")
- Extract as integer number

TRANSPORT MODE DETECTION:
- If you see "BILL OF LADING", "VESSEL", "VOYAGE", "IMO" → transport_mode: "SEA"
- If you see "CMR", "TRUCK", "DRIVER", "PLATE NUMBER" → transport_mode: "LAND"

EXAMPLES:

Example 1 - Sea Freight BOL:
Document shows:
- Header: "BILL OF LADING"
- B/L No: MAEU123456789
- Vessel: MSC MAYA / Voyage: 234W
- Port of Loading: Mumbai, India (INMUN1)
- Port of Discharge: Jebel Ali, UAE (AEJEA)
- Containers: MSCU1234567, MSCU2345678
- On Board: 15 Jan 2024

CORRECT EXTRACTION:
{
  "document_info": {
    "document_type": "BOL",
    "transport_mode": "SEA",
    "bl_number": "MAEU123456789",
    "booking_number": null,
    "bl_date": "2024-01-15"
  },
  "shipping_line": {
    "name": "MSC"
  },
  "ports": {
    "port_of_loading": "Mumbai, India",
    "port_of_loading_code": "INMUN1",
    "port_of_discharge": "Jebel Ali, UAE",
    "port_of_discharge_code": "AEJEA"
  },
  "dates": {
    "etd": "2024-01-15",
    "eta": null
  },
  "vessel_info": {
    "vessel_name": "MSC MAYA",
    "voyage_number": "234W"
  },
  "cargo_details": {
    "containers": [
      {
        "container_number": "MSCU1234567",
        "size_code": "40HC",
        "gross_weight_kg": 26500,
        "net_weight_kg": 24000,
        "seal_number": "SL123456",
        "package_count": 1200
      },
      {
        "container_number": "MSCU2345678",
        "size_code": "40HC",
        "gross_weight_kg": 26800,
        "net_weight_kg": 24200,
        "seal_number": "SL123457",
        "package_count": 1250
      }
    ],
    "container_numbers": ["MSCU1234567", "MSCU2345678"],
    "number_of_containers": 2,
    "total_gross_weight_kg": 53300,
    "total_net_weight_kg": 48200
  }
}

Example 2 - Land Transport CMR:
Document shows:
- CMR International Consignment Note
- CMR No: CMR-2024-001234
- Carrier: ABC Transport Ltd
- Loading: Istanbul, Turkey
- Unloading: Baghdad, Iraq
- Truck: 34 ABC 123
- Date: 20.02.2024

CORRECT EXTRACTION:
{
  "document_info": {
    "document_type": "CMR",
    "transport_mode": "LAND",
    "cmr_number": "CMR-2024-001234",
    "bl_date": "2024-02-20"
  },
  "shipping_line": {
    "name": "ABC Transport Ltd"
  },
  "ports": {
    "port_of_loading": "Istanbul, Turkey",
    "port_of_discharge": "Baghdad, Iraq"
  },
  "dates": {
    "etd": "2024-02-20"
  },
  "truck_info": {
    "truck_plate_number": "34 ABC 123"
  },
  "cargo_details": {
    "container_numbers": []
  }
}

FALLBACK BEHAVIOR:
REMEMBER: If you cannot find a Bill of Lading, you MUST still extract shipping data from whatever 
documents ARE present (Commercial Invoice, Packing List, Certificate of Origin, etc.). 

When using fallback documents:
- Set "document_info.document_type": "FALLBACK" 
- Set "document_info.data_source": "fallback"
- Set "document_info.fallback_document_type": "COMMERCIAL_INVOICE" or "PACKING_LIST" or "CERTIFICATE_OF_ORIGIN"
- Extract as much useful shipping data as you can find (containers, ports, vessel, weights, dates, etc.)

The user wants ANY useful shipping data, even if it's not from a Bill of Lading!

Return the extracted data as a JSON object now.
`.trim();
}

function calculateBOLConfidence(data: any): number {
  let score = 0;
  let maxScore = 0;

  // Critical fields for BOL (higher weight)
  const criticalFields = [
    { path: 'document_info.bl_number', weight: 15 },
    { path: 'document_info.cmr_number', weight: 15 },
    { path: 'shipping_line.name', weight: 15 },
    { path: 'ports.port_of_loading', weight: 15 },
    { path: 'ports.port_of_discharge', weight: 15 },
    { path: 'dates.etd', weight: 10 },
    { path: 'dates.eta', weight: 10 },
  ];

  criticalFields.forEach(({ path, weight }) => {
    maxScore += weight;
    const value = getNestedValue(data, path);
    if (value !== null && value !== undefined && value !== '') {
      score += weight;
    }
  });

  // Additional points for vessel or truck info
  const transportWeight = 10;
  maxScore += transportWeight;
  if (data.vessel_info?.vessel_name || data.truck_info?.truck_plate_number) {
    score += transportWeight;
  }

  // Additional points for containers
  const containerWeight = 5;
  maxScore += containerWeight;
  if (data.cargo_details?.container_numbers && data.cargo_details.container_numbers.length > 0) {
    score += containerWeight;
  }

  return Math.round((score / maxScore) * 100);
}

function generateBOLWarnings(data: any): string[] {
  const warnings: string[] = [];

  if (!data.document_info?.bl_number && !data.document_info?.cmr_number) {
    warnings.push('Document number (B/L or CMR) not found');
  }
  if (!data.shipping_line?.name) {
    warnings.push('Shipping line/transport company name not found');
  }
  if (!data.ports?.port_of_loading) {
    warnings.push('Port of loading not found');
  }
  if (!data.ports?.port_of_discharge) {
    warnings.push('Port of discharge not found');
  }
  if (!data.dates?.etd && !data.dates?.eta) {
    warnings.push('No departure or arrival dates found');
  }
  
  // Transport mode specific warnings
  if (data.document_info?.transport_mode === 'SEA') {
    if (!data.vessel_info?.vessel_name) {
      warnings.push('Vessel name not found (sea freight)');
    }
    if (!data.cargo_details?.container_numbers || data.cargo_details.container_numbers.length === 0) {
      warnings.push('No container numbers found (sea freight)');
    }
  } else if (data.document_info?.transport_mode === 'LAND') {
    if (!data.truck_info?.truck_plate_number) {
      warnings.push('Truck plate number not found (land transport)');
    }
  }

  return warnings;
}

// =====================================================
// COMMERCIAL INVOICE EXTRACTION FOR SHIPMENTS
// =====================================================

function buildCIExtractionPrompt(): string {
  return `
You are an expert at extracting data from Commercial Invoices and related trade documents.

IMPORTANT: This document may contain MULTIPLE pages or documents bundled together (e.g., Bill of Lading, Packing List, Certificate of Origin, Phytosanitary Certificate, Insurance Certificate, etc.).

YOUR TASK: 
1. PRIMARY: Extract core trade data from the Commercial Invoice (or equivalent)
2. SECONDARY: Extract PACKAGING DETAILS from the Packing List if present (this is CRITICAL!)

STEP 1 - Find and extract from Commercial Invoice:
- Commercial Invoice / Sales Invoice / Export Invoice
- Tax Invoice (if it contains trade terms)
- Proforma Invoice (if actual Commercial Invoice is not present)

STEP 2 - Find and extract PACKAGING INFO from Packing List:
The Packing List often contains CRITICAL details not in the Commercial Invoice:
- Bag Type / Package Type (e.g., "Polylaminated 20 Kg", "Jute Bags 50 Kg", "Vacuum Bags 25 Kg")
- Number of packages/bags per container
- Net weight per bag/package
- Gross weight per package
- Container-level breakdown (which containers have which products)

⚠️ IMPORTANT: If the Commercial Invoice doesn't have packaging details but you find a Packing List 
in the document bundle, EXTRACT the packaging information from the Packing List and include it!
Mark these fields with "source": "packing_list" in the data_sources object.

⚠️ CRITICAL FALLBACK BEHAVIOR - ALWAYS EXTRACT DATA:
If no Commercial Invoice is found, you MUST still extract useful trade/shipping information from ANY 
document present in the file. This includes:
- Bill of Lading (B/L) → Extract: products, weights, container details, ports, vessel, dates
- Packing List → Extract: products, quantities, package details, weights, container breakdown
- Certificate of Origin → Extract: products, origin country, exporter/importer names
- Proforma Invoice → Extract: products, prices, quantities, terms

DO NOT return NOT_FOUND if there is ANY useful data in the documents!
Instead, extract what you can and mark it as fallback:
- Set "document_info.data_source": "fallback"
- Set "document_info.fallback_document_type": "BILL_OF_LADING" (or "PACKING_LIST", etc.)
- Set "document_info.document_type": "FALLBACK" (not "NOT_FOUND")

Only return NOT_FOUND if the file is completely empty, corrupted, or contains no trade-related 
information at all (e.g., a random image with no shipping/trade data).

Analyze the Commercial Invoice and extract ALL relevant shipping and trade information into a JSON format.

IMPORTANT RULES:
1. Return ONLY valid JSON, no markdown, no additional text
2. If a field is not visible or unclear, use null
3. Infer cargo type from the goods description
4. Extract Incoterms (delivery terms) exactly as shown
5. Extract payment terms in full
6. Focus ONLY on the Commercial Invoice pages
7. CRITICAL - DOCUMENT NUMBER EXTRACTION:
   - "INVOICE NO." or "INV NO." = Commercial Invoice number - extract this as invoice_number
   - "S/B NO." or "SB NO." = Shipping Bill Number (Indian customs export document) - DO NOT extract this as invoice_number
   - "CONTRACT NO." = Purchase/Sales contract reference - this is NOT the invoice number
   - "B/L NO." = Bill of Lading number - this is NOT the invoice number
   - Always look for the ACTUAL Commercial Invoice number, typically labeled "INVOICE NO."

JSON SCHEMA:
{
  "document_info": {
    "document_type": "COMMERCIAL_INVOICE",
    "invoice_number": "string or null (ONLY the actual Commercial Invoice number, labeled 'INVOICE NO.' - NOT S/B NO., CONTRACT NO., or B/L NO.)",
    "invoice_date": "YYYY-MM-DD or null",
    "currency": "string or null (USD, EUR, AED, etc.)"
  },
  "cargo_type": "string (containers, general_cargo, tankers, trucks) - infer from description",
  "incoterms": "string or null (FOB, CIF, CFR, EXW, DDP, DAP, FCA, CPT, CIP, etc.)",
  "payment_terms": "string or null (e.g., '30 days', 'CAD', 'LC at sight', 'TT 50% advance')",
  "shipping_info": {
    "origin_port": "string or null (port of loading if mentioned)",
    "destination_port": "string or null (port of discharge if mentioned)",
    "country_of_origin": "string or null",
    "country_of_destination": "string or null"
  },
  "parties": {
    "exporter": "string or null (seller/shipper name)",
    "importer": "string or null (buyer/consignee name)",
    "exporter_address": "string or null",
    "importer_address": "string or null"
  },
  "goods": {
    "description": "string or null (main goods description - summarize all products)",
    "total_quantity": "number or null (total quantity across all items)",
    "quantity_unit": "string or null (PCS, KGS, MT, etc.)",
    "total_value": "number or null (total invoice value)",
    "total_weight_mt": "number or null (total weight in metric tons)"
  },
  "line_items": [
    {
      "product_name": "string (FULL product name including grade/count/specification - e.g., 'GROUNDNUT KERNELS JAVA COUNT 80/90' not just 'Groundnut Kernels')",
      "description": "string or null (additional detailed description)",
      "hs_code": "string or null (harmonized system code)",
      "packaging_mode": "string - PACKAGED or BULK (detect from description: bulk, loose, سائب, بدون تغليف = BULK)",
      "quantity_mt": "number or null (quantity in metric tons - CAREFUL with decimal notation!)",
      "net_weight_mt": "number or null (net weight in MT)",
      "gross_weight_mt": "number or null (gross weight in MT)",
      "unit_price": "number or null (price per unit, usually per MT)",
      "currency": "string or null (USD, EUR, etc.)",
      "total_amount": "number or null",
      "package_count": "number or null (total number of bags/packages - use null/0 for BULK)",
      "package_type": "string or null (BAGS, CARTONS, DRUMS, VACUUM BAGS, POLYLAMINATED BAGS, JUTE BAGS, PP BAGS, BULK, etc.)",
      "package_weight_kg": "number or null (weight per package in KG - e.g., 20, 25, 50 - use null for BULK)",
      "brand": "string or null",
      "origin": "string or null (country of origin)",
      "lot_number": "string or null",
      "size_grade": "string or null (product size/grade like '22/64 UP', '80/90', etc.)",
      "crop_year": "string or null (e.g., '2025', '2024/2025')",
      "production_date": "string or null",
      "expiry_date": "string or null"
    }
  ],
  "packing_details": {
    "source": "string (COMMERCIAL_INVOICE or PACKING_LIST - indicate where this data came from)",
    "total_packages": "number or null (total number of packages/bags)",
    "package_type": "string or null (detailed package type from Packing List, e.g., 'Polylaminated 20 Kg. Net Weight')",
    "package_weight_kg": "number or null (net weight per package in KG)",
    "bags_per_container": "number or null (if uniform across containers)",
    "container_breakdown": [
      {
        "container_number": "string",
        "seal_number": "string or null",
        "package_count": "number (bags/packages in this container)",
        "gross_weight_kg": "number or null",
        "net_weight_kg": "number or null"
      }
    ]
  },
  "additional_info": {
    "bank_details": "string or null",
    "special_instructions": "string or null"
  },
  "data_sources": {
    "invoice_data": "COMMERCIAL_INVOICE",
    "packing_data": "string or null (PACKING_LIST if packaging came from Packing List, null if from CI)",
    "notes": "string or null (any notes about where data was sourced from)"
  }
}

EXTRACTION GUIDELINES:

PRODUCT LINE ITEMS (CRITICAL):
- Look for product tables, line items, or goods descriptions
- Extract EACH distinct product as a separate item in line_items array
- Common table columns: Description, Quantity, Unit Price, Amount, HS Code
- If products are listed in a table, extract each row as a line item
- Extract HS codes if visible (usually 6-10 digit numbers)

PRODUCT NAME EXTRACTION (VERY IMPORTANT):
- ALWAYS capture the COMPLETE product name including ALL specifications, grades, and counts
- Product specifications like "COUNT 80/90", "GRADE A", "TYPE II", "SIZE 25MM" are CRITICAL
- Example: "GROUNDNUT KERNELS JAVA : COUNT 80/90" → product_name: "GROUNDNUT KERNELS JAVA COUNT 80/90"
- Example: "BASMATI RICE 1121 SELLA" → product_name: "BASMATI RICE 1121 SELLA"  
- Example: "SUGAR ICUMSA 45" → product_name: "SUGAR ICUMSA 45"
- DO NOT truncate or simplify product names - traders need the exact specification
- Include brand names, variety codes, quality grades, size specifications
- The "COUNT", "GRADE", "TYPE", "ICUMSA", size codes are as important as the base product name

QUANTITY PARSING (VERY IMPORTANT - READ CAREFULLY):
- Many international invoices use EUROPEAN DECIMAL NOTATION where periods are decimal points
- "54.000 MT" means 54.000 (FIFTY-FOUR) metric tons, NOT 54,000 (fifty-four thousand)
- "1.500 MT" means 1.5 (one and a half) metric tons, NOT 1,500
- When unit is MT (Metric Tons), typical cargo quantities range from 10 to 5,000 MT
- ALWAYS VALIDATE: quantity × unit_price should approximately equal the total_amount shown
- Example: "54.000 MT" at "USD 1145.00/MT" = "USD 61,830.00" → quantity is 54 (not 54000)
- If your calculation doesn't match the invoice total, RE-EXAMINE the quantity decimal placement
- The period in "54.000" is a DECIMAL point showing precision, not a thousands separator
- Cross-check: if quantity seems too large (e.g., 54000 MT), verify against total amount

PACKAGE INFORMATION (IMPORTANT):
- Look for "TOTAL X BAGS", "X CARTONS", "X PACKAGES", etc.
- Extract the package type: BAGS, VACUUM BAGS, CARTONS, DRUMS, BIG BAGS, JUMBO BAGS, etc.
- Extract weight per package if shown (e.g., "25 KG NET EACH", "50 KG/BAG")
- Look for packaging details in the description area, often separate from main goods description
- Example: "TOTAL 2160 BAGS", "VACUUM BAGS OUT SIDE P.P. BAGS EACH 25 KG NET"
  → package_count: 2160, package_type: "VACUUM BAGS", package_weight_kg: 25

BULK / UNPACKAGED GOODS DETECTION (IMPORTANT):
Detect BULK (unpackaged) goods using these keywords (English and Arabic):
- "bulk", "in bulk", "loose", "unpackaged", "unpacked", "bulk cargo"
- "سائب", "بدون تغليف", "بضائع سائبة", "غير معبأ"
- No mention of bags, cartons, packages, boxes for the goods themselves

When bulk goods are detected:
- Set packaging_mode: "BULK"
- Set package_type: "BULK"
- Set package_count: null (not applicable)
- Set package_weight_kg: null (not applicable)
- quantity_mt is the primary quantity field for bulk goods

When packaged goods are detected:
- Set packaging_mode: "PACKAGED"
- Extract package_type, package_count, package_weight_kg as normal

⚠️ PACKING LIST EXTRACTION (CRITICAL - DO NOT SKIP):
If you find a PACKING LIST document in the bundle, extract the following into "packing_details":
- Look for document titled "Packing List" or "Packing Specification"
- "Bag Type:" field → e.g., "Polylaminated 20 Kg. Net Weight" → package_type: "Polylaminated", package_weight_kg: 20
- "Size:" field → e.g., "22/64 UP" → this is the product size/grade
- Total number of bags/packages
- Container breakdown table with:
  - Container numbers (e.g., "TCLU 154641-6", "MRKU 632670-2")
  - Seal numbers (e.g., "BAI 61884")
  - Bags per container (e.g., 1,100 bags per container)
  - Gross weight per container (e.g., 22,120 Kg)
  - Net weight per container (e.g., 22,000 Kg)
- Also extract: Vessel name, ETD, Port of Discharge, Brand, Lot Number, Crop year, Production/Expiry dates
- Mark "packing_details.source": "PACKING_LIST" if this data came from the Packing List

Example Packing List extraction:
  Bag Type: Polylaminated 20 Kg. Net Weight
  Container table: TCLU 154641-6 | BAI 61884 | 1,100 bags | 22,120 Kg Gross | 22,000 Kg Net
  → packing_details: {
      "source": "PACKING_LIST",
      "package_type": "Polylaminated 20 Kg. Net Weight",
      "package_weight_kg": 20,
      "total_packages": 5500,
      "bags_per_container": 1100,
      "container_breakdown": [
        {"container_number": "TCLU 154641-6", "seal_number": "BAI 61884", "package_count": 1100, "gross_weight_kg": 22120, "net_weight_kg": 22000}
      ]
    }

CARGO TYPE INFERENCE:
- Look at goods description AND transport method to determine cargo type:
  - "containers", "containerized", "FCL", "LCL", "40HC", "40'", "20GP", "HIGH CUBE" → cargo_type: "containers"
  - "bulk", "tanker", "liquid", "oil", "fuel" → cargo_type: "tankers"
  - "truck", "land transport", "road freight" → cargo_type: "trucks"
  - Otherwise → cargo_type: "general_cargo"

⚠️ IMPORTANT: Sea freight with packaged goods (cartons, bags, pallets) is almost ALWAYS containerized:
  - If transport is "BY SEA" and goods are in CARTONS, BAGS, PALLETS, CASES → cargo_type: "containers"
  - If Incoterms mentions a PORT (CIF Mersin, FOB Shanghai, etc.) → likely "containers"
  - Only use "general_cargo" for break-bulk or loose cargo shipped by vessel without containers

INCOTERMS (Delivery Terms):
- Common Incoterms to look for:
  - FOB (Free On Board)
  - CIF (Cost, Insurance, Freight)
  - CFR (Cost and Freight)
  - EXW (Ex Works)
  - DDP (Delivered Duty Paid)
  - DAP (Delivered At Place)
  - FCA (Free Carrier)
  - CPT (Carriage Paid To)
  - CIP (Carriage Insurance Paid)

⚠️ INCOTERM ALIASES - NORMALIZE THESE:
  - "CNF" = "CFR" (CNF is older/informal term for Cost and Freight, extract as "CFR")
  - "C&F" = "CFR" (same as above)
  - "C+F" = "CFR" (same as above)
  - "C AND F" = "CFR" (same as above)
  Example: If document shows "CNF MERSIN", extract incoterms as "CFR MERSIN"

- Extract the normalized Incoterm including the location (e.g., "FOB Shanghai", "CFR Jebel Ali")
- May appear near price or after delivery terms label

PAYMENT TERMS:
- Look for labels: "Payment Terms", "Terms of Payment", "Payment"
- Common formats:
  - "Net 30 days", "30 days from B/L date"
  - "CAD" (Cash Against Documents)
  - "LC at sight", "LC 30 days"
  - "TT" (Telegraphic Transfer) with percentage
  - "50% advance, 50% before shipment"
- Extract the full payment term string as shown

SHIPPING INFORMATION:
- Port of Loading (POL): Origin port for shipping
- Port of Discharge (POD): Destination port
- May be in shipping details section or after Incoterms

EXAMPLES:

Example 1 - Commercial Invoice with containerized goods:
Document shows:
- Invoice No: CI-2024-00123
- Date: January 15, 2024
- Seller: ABC Trading Co., Shanghai, China
- Buyer: XYZ Imports LLC, Dubai, UAE
- Terms: CIF Jebel Ali Port
- Payment: LC at sight
- Goods: 3x40HC containers of ceramic tiles
- Value: USD 125,000

CORRECT EXTRACTION:
{
  "document_info": {
    "document_type": "COMMERCIAL_INVOICE",
    "invoice_number": "CI-2024-00123",
    "invoice_date": "2024-01-15",
    "currency": "USD"
  },
  "cargo_type": "containers",
  "incoterms": "CIF Jebel Ali Port",
  "payment_terms": "LC at sight",
  "shipping_info": {
    "origin_port": null,
    "destination_port": "Jebel Ali Port",
    "country_of_origin": "China",
    "country_of_destination": "UAE"
  },
  "parties": {
    "exporter": "ABC Trading Co.",
    "importer": "XYZ Imports LLC"
  },
  "goods": {
    "description": "Ceramic tiles",
    "total_value": 125000,
    "total_weight_mt": 78
  },
  "line_items": [
    {
      "product_name": "Ceramic Floor Tiles 60x60",
      "description": "Glazed ceramic floor tiles, Grade A",
      "hs_code": "6908.90",
      "quantity": 52000,
      "quantity_unit": "SQM",
      "unit_price": 2.40,
      "currency": "USD",
      "total_amount": 125000
    }
  ]
}

Example 2 - Commercial Invoice with bulk cargo:
Document shows:
- Invoice: INV-2024-789
- Terms: FOB Fujairah
- Payment: 30% TT advance, 70% against B/L copy
- Goods: Fuel Oil 380 CST, 5000 MT
- Buyer in Iraq

CORRECT EXTRACTION:
{
  "document_info": {
    "document_type": "COMMERCIAL_INVOICE",
    "invoice_number": "INV-2024-789",
    "currency": null
  },
  "cargo_type": "tankers",
  "incoterms": "FOB Fujairah",
  "payment_terms": "30% TT advance, 70% against B/L copy",
  "shipping_info": {
    "origin_port": "Fujairah",
    "destination_port": null,
    "country_of_origin": null,
    "country_of_destination": "Iraq"
  },
  "goods": {
    "description": "Fuel Oil 380 CST",
    "total_quantity": 5000,
    "quantity_unit": "MT",
    "total_weight_mt": 5000
  },
  "line_items": [
    {
      "product_name": "Fuel Oil 380 CST",
      "quantity": 5000,
      "quantity_unit": "MT",
      "origin": "UAE"
    }
  ]
}

FALLBACK BEHAVIOR:
REMEMBER: If you cannot find a Commercial Invoice, you MUST still extract data from whatever 
documents ARE present (B/L, Packing List, Certificate of Origin, etc.). 

When using fallback documents:
- Set "document_info.document_type": "FALLBACK" 
- Set "document_info.data_source": "fallback"
- Set "document_info.fallback_document_type": "BILL_OF_LADING" or "PACKING_LIST" or "CERTIFICATE_OF_ORIGIN"
- Extract as much useful data as you can find (products, weights, prices, parties, ports, etc.)

The user wants ANY useful trade data, even if it's not from a Commercial Invoice!

Return the extracted data as a JSON object now.
`.trim();
}

export async function extractFromCommercialInvoice(imagePath: string | string[]): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  try {
    // Handle both single image and array of images (for multi-page PDFs)
    const imagePaths = Array.isArray(imagePath) ? imagePath : [imagePath];
    
    // Build image content array for OpenAI Vision API
    const imageContents: any[] = [];
    for (const imgPath of imagePaths) {
      const imageData = await fs.readFile(imgPath);
      const base64Image = imageData.toString('base64');
      const mimeType = imgPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      imageContents.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
          detail: 'high',
        },
      });
    }

    logger.info(`🤖 Sending ${imagePaths.length} page(s) to OpenAI for Commercial Invoice extraction...`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildCIExtractionPrompt(),
            },
            ...imageContents,  // Include all page images
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    // Update usage metrics
    if (response.usage) {
      totalTokensUsed += response.usage.total_tokens;
      const inputCost = (response.usage.prompt_tokens || 0) * 0.005 / 1000;
      const outputCost = (response.usage.completion_tokens || 0) * 0.015 / 1000;
      totalCost += inputCost + outputCost;
      extractionCount++;
    }

    const content = response.choices[0]?.message?.content || '';
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    const extractedData = JSON.parse(cleanedContent);

    // Check if document was not found in multi-document file
    // Accept FALLBACK as a valid result - we want to use data from alternate documents
    if (extractedData.document_info?.document_type === 'NOT_FOUND') {
      const processingTime = Date.now() - startTime;
      return {
        success: false,
        data: null,
        confidence: 0,
        warnings: [extractedData.error || 'No Commercial Invoice found in the provided file. The file may contain other documents (B/L, Certificate of Origin, etc.) but no Commercial Invoice.'],
        processingTime,
      };
    }
    
    // If fallback document was used, treat it as successful extraction
    if (extractedData.document_info?.document_type === 'FALLBACK' || 
        extractedData.document_info?.data_source === 'fallback') {
      logger.info(`📋 CI extraction used fallback: ${extractedData.document_info?.fallback_document_type || 'unknown'}`);
    }

    const confidence = calculateCIConfidence(extractedData);
    let warnings = generateCIWarnings(extractedData);
    
    // Add warning if data came from fallback source (not primary CI document)
    if (extractedData.document_info?.data_source === 'fallback') {
      const fallbackType = extractedData.document_info?.fallback_document_type || 'another document';
      warnings = [
        `⚠️ No Commercial Invoice found. Data was extracted from ${fallbackType}. Please verify invoice number and product details.`,
        ...warnings
      ];
    }

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: extractedData,
      confidence,
      warnings,
      processingTime,
    };
  } catch (error) {
    logger.error('[OpenAI] Commercial Invoice extraction error:', error);
    const processingTime = Date.now() - startTime;
    return {
      success: false,
      data: null,
      confidence: 0,
      warnings: [error instanceof Error ? error.message : 'Unknown error during extraction'],
      processingTime,
    };
  }
}

function calculateCIConfidence(data: any): number {
  let score = 0;
  let maxScore = 0;

  // Critical fields for Commercial Invoice (higher weight)
  const criticalFields = [
    { path: 'cargo_type', weight: 20 },
    { path: 'incoterms', weight: 20 },
    { path: 'payment_terms', weight: 20 },
    { path: 'document_info.invoice_number', weight: 10 },
    { path: 'parties.exporter', weight: 10 },
    { path: 'parties.importer', weight: 10 },
    { path: 'goods.description', weight: 10 },
  ];

  criticalFields.forEach(({ path, weight }) => {
    maxScore += weight;
    const value = getNestedValue(data, path);
    if (value !== null && value !== undefined && value !== '') {
      score += weight;
    }
  });

  return Math.round((score / maxScore) * 100);
}

function generateCIWarnings(data: any): string[] {
  const warnings: string[] = [];

  if (!data.cargo_type) {
    warnings.push('Could not determine cargo type from document');
  }
  if (!data.incoterms) {
    warnings.push('Incoterms (delivery terms) not found');
  }
  if (!data.payment_terms) {
    warnings.push('Payment terms not found');
  }
  if (!data.document_info?.invoice_number) {
    warnings.push('Invoice number not found');
  }
  if (!data.parties?.exporter && !data.parties?.importer) {
    warnings.push('Neither exporter nor importer identified');
  }
  
  // Add warning if packaging data came from Packing List
  if (data.packing_details?.source === 'PACKING_LIST') {
    warnings.push('📦 Packaging details (bag type, weight per bag) extracted from PACKING LIST - please verify');
  }
  
  // Add warning about data sources
  if (data.data_sources?.packing_data === 'PACKING_LIST') {
    warnings.push('ℹ️ Some data was extracted from supplementary Packing List document');
  }

  return warnings;
}

/**
 * Check OpenAI API connection
 * Returns true if connection is successful, throws error otherwise
 */
export async function checkOpenAIConnection(): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    // Simple API call to verify connection
    await openai.models.list();
    return true;
  } catch (error: any) {
    throw new Error(`OpenAI connection failed: ${error.message}`);
  }
}

export function getUsageMetrics() {
  return {
    totalTokensUsed,
    totalCost: totalCost.toFixed(2),
    extractionCount,
    avgCostPerExtraction: extractionCount > 0 ? (totalCost / extractionCount).toFixed(4) : '0.0000',
  };
}

