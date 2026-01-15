import { Router } from 'express';
import { pool } from '../db/client';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger';

const execAsync = promisify(exec);
const router = Router();

// Interface for transfer order generation
interface TransferOrderData {
  currency: string;
  amount: string;
  transfer_date: string;
  sender_name: string;
  sender_customer_number: string;
  beneficiary_name: string;
  beneficiary_address: string;
  bank_name: string;
  bank_branch?: string;
  bank_country?: string;
  swift_code: string;
  iban_or_account: string;
  correspondent_bank?: string;
  invoice_info: string;
  payment_details?: string;
  charge_type: 'SHA' | 'OUR' | 'BEN';
}

// POST /api/transfers/generate-order - Generate transfer order DOCX
// NOTE: This route MUST be defined BEFORE /:id to avoid parameter matching issues
router.post('/generate-order', async (req, res, next) => {
  try {
    const data: TransferOrderData = req.body;
    
    // Validate required fields
    if (!data.currency || !data.amount || !data.transfer_date || !data.beneficiary_name) {
      return res.status(400).json({ 
        error: 'Missing required fields: currency, amount, transfer_date, beneficiary_name' 
      });
    }
    
    // Read the BANK template (with Yapi Kredi logo and exact formatting)
    // In dev (ts-node): __dirname is src/routes, template is in ../../templates
    // In prod (dist): __dirname is dist/routes, template is in ../templates
    let templatePath = path.join(__dirname, '../../templates/yapi_kredi_transfer_template.docx');
    if (!fs.existsSync(templatePath)) {
      // Try production path
      templatePath = path.join(__dirname, '../templates/yapi_kredi_transfer_template.docx');
    }
    
    if (!fs.existsSync(templatePath)) {
      logger.error('Template not found at:', templatePath);
      return res.status(500).json({ error: 'Transfer order template not found', path: templatePath });
    }
    
    const content = fs.readFileSync(templatePath, 'binary');
    
    // Create a zip instance
    const zip = new PizZip(content);
    
    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '{{',
        end: '}}'
      }
    });
    
    // Prepare checkbox values
    const sha_checked = data.charge_type === 'SHA' ? '☑' : '☐';
    const our_checked = data.charge_type === 'OUR' ? '☑' : '☐';
    const ben_checked = data.charge_type === 'BEN' ? '☑' : '☐';
    
    // Format amount with commas
    const formattedAmount = Number(data.amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    // Build bank info string
    const bankInfo = [data.bank_name, data.bank_branch, data.bank_country]
      .filter(Boolean)
      .join(', ');
    
    // Set the template data
    doc.render({
      currency: data.currency || 'USD',
      amount: formattedAmount,
      transfer_date: data.transfer_date,
      sender_name: data.sender_name || 'LOYAL INTERNATIONAL GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
      sender_customer_number: data.sender_customer_number || '78265692',
      beneficiary_name: data.beneficiary_name,
      beneficiary_address: data.beneficiary_address || '',
      bank_info: bankInfo,
      swift_code: data.swift_code || '',
      iban_or_account: data.iban_or_account || '',
      correspondent_bank: data.correspondent_bank || '',
      invoice_info: data.invoice_info || '',
      payment_details: data.payment_details || '',
      sha_checked,
      our_checked,
      ben_checked
    });
    
    // Generate the output
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });
    
    // Set response headers for file download
    const filename = `Transfer_Order_${data.beneficiary_name.replace(/[^a-zA-Z0-9]/g, '_')}_${data.transfer_date}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    
    res.send(buf);
  } catch (error: any) {
    logger.error('Error generating transfer order:', error);
    if (error.properties && error.properties.errors) {
      logger.error('Docxtemplater errors:', JSON.stringify(error.properties.errors));
    }
    next(error);
  }
});

// Helper function to generate DOCX buffer
function generateDocxBuffer(data: TransferOrderData): Buffer {
  // Read the BANK template
  let templatePath = path.join(__dirname, '../../templates/yapi_kredi_transfer_template.docx');
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(__dirname, '../templates/yapi_kredi_transfer_template.docx');
  }
  
  if (!fs.existsSync(templatePath)) {
    throw new Error('Transfer order template not found');
  }
  
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' }
  });
  
  // Prepare checkbox values
  const sha_checked = data.charge_type === 'SHA' ? '☑' : '☐';
  const our_checked = data.charge_type === 'OUR' ? '☑' : '☐';
  const ben_checked = data.charge_type === 'BEN' ? '☑' : '☐';
  
  // Format amount with commas
  const formattedAmount = Number(data.amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  // Build bank info string
  const bankInfo = [data.bank_name, data.bank_branch, data.bank_country]
    .filter(Boolean)
    .join(', ');
  
  // Render the template
  doc.render({
    currency: data.currency || 'USD',
    amount: formattedAmount,
    transfer_date: data.transfer_date,
    sender_name: data.sender_name || 'LOYAL INTERNATIONAL GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    sender_customer_number: data.sender_customer_number || '78265692',
    beneficiary_name: data.beneficiary_name,
    beneficiary_address: data.beneficiary_address || '',
    bank_info: bankInfo,
    swift_code: data.swift_code || '',
    iban_or_account: data.iban_or_account || '',
    correspondent_bank: data.correspondent_bank || '',
    invoice_info: data.invoice_info || '',
    payment_details: data.payment_details || '',
    sha_checked,
    our_checked,
    ben_checked
  });
  
  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
}

// POST /api/transfers/generate-order-pdf - Generate transfer order as PDF
router.post('/generate-order-pdf', async (req, res, next) => {
  try {
    const data: TransferOrderData = req.body;
    
    // Validate required fields
    if (!data.currency || !data.amount || !data.transfer_date || !data.beneficiary_name) {
      return res.status(400).json({ 
        error: 'Missing required fields: currency, amount, transfer_date, beneficiary_name' 
      });
    }
    
    // Generate DOCX buffer
    const docxBuffer = generateDocxBuffer(data);
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write DOCX to temp file
    const timestamp = Date.now();
    const docxPath = path.join(tempDir, `transfer_${timestamp}.docx`);
    const pdfPath = path.join(tempDir, `transfer_${timestamp}.pdf`);
    
    fs.writeFileSync(docxPath, docxBuffer);
    
    try {
      // Try LibreOffice conversion (works on macOS and Linux)
      // First try the macOS path, then Linux path
      const libreOfficePaths = [
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
        '/usr/bin/soffice',
        '/usr/bin/libreoffice',
        'soffice'
      ];
      
      let conversionSuccess = false;
      let lastError = '';
      
      for (const sofficePath of libreOfficePaths) {
        try {
          await execAsync(`"${sofficePath}" --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`, {
            timeout: 30000 // 30 second timeout
          });
          conversionSuccess = true;
          break;
        } catch (err: any) {
          lastError = err.message;
          continue;
        }
      }
      
      if (!conversionSuccess) {
        // Clean up temp DOCX
        if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
        return res.status(500).json({ 
          error: 'PDF conversion failed. LibreOffice is required but not found.',
          details: lastError
        });
      }
      
      // Read the generated PDF
      if (!fs.existsSync(pdfPath)) {
        // Clean up temp DOCX
        if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
        return res.status(500).json({ error: 'PDF file was not generated' });
      }
      
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      // Clean up temp files
      if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      
      // Send PDF response
      const filename = `Transfer_Order_${data.beneficiary_name.replace(/[^a-zA-Z0-9]/g, '_')}_${data.transfer_date}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (convError: any) {
      // Clean up temp files on error
      if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      throw convError;
    }
  } catch (error: any) {
    logger.error('Error generating transfer order PDF:', error);
    next(error);
  }
});

// GET /api/transfers - List all transfers
router.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '50', direction } = req.query;
    
    let query = `
      SELECT t.*, s.sn as shipment_sn
      FROM finance.transfers t
      LEFT JOIN logistics.v_shipments_complete s ON t.shipment_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (direction) {
      params.push(direction);
      query += ` AND t.direction = $${params.length}`;
    }
    
    query += ` ORDER BY t.transfer_date DESC`;
    
    const offset = (Number(page) - 1) * Number(limit);
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM finance.transfers WHERE 1=1';
    const countParams: any[] = [];
    if (direction) {
      countParams.push(direction);
      countQuery += ` AND direction = $${countParams.length}`;
    }
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(countResult.rows[0].count),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/transfers/:id - Get single transfer
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT t.*, s.sn as shipment_sn
       FROM finance.transfers t
       LEFT JOIN logistics.v_shipments_complete s ON t.shipment_id = s.id
       WHERE t.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/transfers/shipment/:shipmentId - Get transfers for a shipment
router.get('/shipment/:shipmentId', async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM finance.transfers 
       WHERE shipment_id = $1 
       ORDER BY transfer_date DESC`,
      [shipmentId]
    );
    
    res.json({
      shipment_id: shipmentId,
      count: result.rows.length,
      transfers: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/transfers - Create new transfer
router.post('/', async (req, res, next) => {
  try {
    const {
      direction,
      amount,
      currency,
      transfer_date,
      bank_name,
      bank_account,
      sender,
      receiver,
      reference,
      notes,
      shipment_id,
      pi_no,
    } = req.body;
    
    if (!direction || !amount || !currency) {
      return res.status(400).json({ 
        error: 'Missing required fields: direction, amount, currency' 
      });
    }
    
    const result = await pool.query(
      `INSERT INTO finance.transfers (
        direction, amount, currency, transfer_date, bank_name, bank_account,
        sender, receiver, reference, notes, shipment_id, pi_no
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        direction, amount, currency, transfer_date || new Date(), bank_name, bank_account,
        sender, receiver, reference, notes, shipment_id, pi_no
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;

