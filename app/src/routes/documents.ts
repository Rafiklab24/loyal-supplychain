/**
 * Documents API Routes
 * Handles document upload, download, listing, and permission management
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../db/client';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';
import {
  saveFile,
  readFile,
  getFileStats,
  deleteFile,
  archiveDocument,
  getEntityRef,
  createContractShipmentLink,
  initializeStorage,
  EntityType,
  DOCUMENTS_PATH,
} from '../services/fileStorage';

const router = Router();

// Initialize storage on module load
initializeStorage().catch((err) => logger.error('Failed to initialize storage:', err));

/**
 * Fix double-encoded UTF-8 filenames (Mojibake fix)
 * When files are uploaded via multipart/form-data, some browsers/servers
 * interpret UTF-8 bytes as Latin-1 and then re-encode to UTF-8, causing garbled text.
 * This function attempts to reverse that process.
 */
function fixEncodedFilename(filename: string): string {
  try {
    // Check if the filename contains typical mojibake patterns
    // These are common when UTF-8 is misinterpreted as Latin-1
    if (filename.includes('Ø') || filename.includes('Ù') || filename.includes('Ã')) {
      // Convert each character to its Latin-1 byte value, then decode as UTF-8
      const bytes = new Uint8Array(filename.length);
      for (let i = 0; i < filename.length; i++) {
        bytes[i] = filename.charCodeAt(i) & 0xff;
      }
      const decoder = new TextDecoder('utf-8');
      const fixed = decoder.decode(bytes);
      
      // Verify the result looks reasonable (contains actual Arabic/other Unicode)
      if (fixed && !fixed.includes('\ufffd') && fixed !== filename) {
        return fixed;
      }
    }
    return filename;
  } catch {
    // If decoding fails, return original
    return filename;
  }
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10)) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png,gif')
      .split(',')
      .map(t => t.trim().toLowerCase());
    
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  },
});

// ========== GET /api/documents - List documents with filters ==========
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      shipment_id,
      contract_id,
      transaction_id,
      company_id,
      customs_batch_id,
      doc_type,
      is_draft,
      search,
      sort_by = 'upload_ts',
      sort_dir = 'DESC',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let query = `
      SELECT * FROM archive.v_documents_complete
      WHERE 1=1
    `;
    const params: any[] = [];

    // Apply filters
    if (shipment_id) {
      params.push(shipment_id);
      query += ` AND shipment_id = $${params.length}`;
    }

    if (contract_id) {
      params.push(contract_id);
      query += ` AND contract_id = $${params.length}`;
    }

    if (transaction_id) {
      params.push(transaction_id);
      query += ` AND transaction_id = $${params.length}`;
    }

    if (company_id) {
      params.push(company_id);
      query += ` AND company_id = $${params.length}`;
    }

    if (customs_batch_id) {
      params.push(customs_batch_id);
      query += ` AND customs_batch_id = $${params.length}`;
    }

    if (doc_type) {
      params.push(doc_type);
      query += ` AND doc_type = $${params.length}`;
    }

    if (is_draft !== undefined) {
      params.push(is_draft === 'true');
      query += ` AND is_draft = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (filename ILIKE $${params.length} OR original_filename ILIKE $${params.length} OR notes ILIKE $${params.length})`;
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) subq`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Add sorting
    const validSortFields = ['upload_ts', 'filename', 'doc_type', 'file_size', 'created_at'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by : 'upload_ts';
    const sortDirection = (sort_dir as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortDirection}`;

    // Add pagination
    params.push(limitNum, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ========== POST /api/documents - Upload document ==========
router.post('/', authenticateToken, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const {
      entity_type,   // 'shipment', 'contract', 'finance', 'customs', 'company'
      entity_id,     // UUID of the entity
      doc_type,      // 'proforma_invoice', 'bill_of_lading', etc.
      is_draft = 'false',
      notes,
    } = req.body;

    if (!entity_type || !entity_id || !doc_type) {
      return res.status(400).json({ 
        error: 'Missing required fields: entity_type, entity_id, doc_type' 
      });
    }

    const isDraft = is_draft === 'true' || is_draft === true;
    const userId = (req as any).user?.id;

    // Get entity reference for path building
    const entityInfo = await getEntityRef(entity_type as EntityType, entity_id);

    // Fix double-encoded UTF-8 filenames (common with Arabic/Unicode filenames)
    const originalFilename = fixEncodedFilename(file.originalname);

    // Save file to storage
    const { filePath, filename } = await saveFile(
      file.buffer,
      entity_type as EntityType,
      entityInfo.ref,
      doc_type,
      originalFilename,
      isDraft,
      entityInfo.year
    );

    // Build the entity ID columns based on type
    const entityColumns: Record<string, string | null> = {
      shipment_id: null,
      contract_id: null,
      transaction_id: null,
      company_id: null,
      customs_batch_id: null,
    };

    switch (entity_type) {
      case 'shipment':
        entityColumns.shipment_id = entity_id;
        // Also link to contract if shipment is linked
        if (entityInfo.contractId) {
          entityColumns.contract_id = entityInfo.contractId;
        }
        break;
      case 'contract':
        entityColumns.contract_id = entity_id;
        break;
      case 'finance':
        entityColumns.transaction_id = entity_id;
        break;
      case 'customs':
        entityColumns.customs_batch_id = entity_id;
        break;
      case 'company':
        entityColumns.company_id = entity_id;
        break;
    }

    // Insert document record
    const insertResult = await pool.query(
      `INSERT INTO archive.documents (
        shipment_id, contract_id, transaction_id, company_id, customs_batch_id,
        doc_type, filename, original_filename, file_path, file_size, mime_type,
        is_draft, notes, uploaded_by_user_id, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        entityColumns.shipment_id,
        entityColumns.contract_id,
        entityColumns.transaction_id,
        entityColumns.company_id,
        entityColumns.customs_batch_id,
        doc_type,
        filename,
        originalFilename,
        filePath,
        file.size,
        file.mimetype,
        isDraft,
        notes || null,
        userId,
        (req as any).user?.name || 'system',
      ]
    );

    const document = insertResult.rows[0];

    // Create contract-shipment symlink if applicable
    if (entity_type === 'shipment' && entityInfo.contractNo) {
      await createContractShipmentLink(
        entityInfo.contractNo,
        entityInfo.ref,
        entityInfo.year,
        entityInfo.year
      );
    }

    // If user specified permissions, add default permission for uploader
    await pool.query(
      `INSERT INTO archive.document_permissions (document_id, user_id, permission, granted_by)
       VALUES ($1, $2, 'manage', $2)`,
      [document.id, userId]
    );

    logger.info(`📄 Document uploaded: ${filename} (${file.size} bytes) for ${entity_type} ${entityInfo.ref}`);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document,
    });
  } catch (error) {
    next(error);
  }
});

// ========== POST /api/documents/bulk - Upload multiple documents ==========
router.post('/bulk', authenticateToken, upload.array('files', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const {
      entity_type,
      entity_id,
      doc_types,  // JSON array of doc types matching files order
    } = req.body;

    if (!entity_type || !entity_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: entity_type, entity_id' 
      });
    }

    const docTypes = JSON.parse(doc_types || '[]');
    const userId = (req as any).user?.id;
    const entityInfo = await getEntityRef(entity_type as EntityType, entity_id);

    const uploadedDocs: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docType = docTypes[i] || 'other';

      try {
        // Fix double-encoded UTF-8 filenames (common with Arabic/Unicode filenames)
        const originalFilename = fixEncodedFilename(file.originalname);

        const { filePath, filename } = await saveFile(
          file.buffer,
          entity_type as EntityType,
          entityInfo.ref,
          docType,
          originalFilename,
          false,
          entityInfo.year
        );

        // Build entity columns
        const entityColumns: Record<string, string | null> = {
          shipment_id: entity_type === 'shipment' ? entity_id : null,
          contract_id: entity_type === 'contract' ? entity_id : (entity_type === 'shipment' && entityInfo.contractId ? entityInfo.contractId : null),
          transaction_id: entity_type === 'finance' ? entity_id : null,
          company_id: entity_type === 'company' ? entity_id : null,
          customs_batch_id: entity_type === 'customs' ? entity_id : null,
        };

        const insertResult = await pool.query(
          `INSERT INTO archive.documents (
            shipment_id, contract_id, transaction_id, company_id, customs_batch_id,
            doc_type, filename, original_filename, file_path, file_size, mime_type,
            uploaded_by_user_id, uploaded_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            entityColumns.shipment_id,
            entityColumns.contract_id,
            entityColumns.transaction_id,
            entityColumns.company_id,
            entityColumns.customs_batch_id,
            docType,
            filename,
            originalFilename,
            filePath,
            file.size,
            file.mimetype,
            userId,
            (req as any).user?.name || 'system',
          ]
        );

        uploadedDocs.push(insertResult.rows[0]);
      } catch (err: any) {
        errors.push({
          filename: file.originalname,
          error: err.message,
        });
      }
    }

    // Create symlink if applicable
    if (entity_type === 'shipment' && entityInfo.contractNo) {
      await createContractShipmentLink(
        entityInfo.contractNo,
        entityInfo.ref,
        entityInfo.year,
        entityInfo.year
      );
    }

    res.status(201).json({
      message: `Uploaded ${uploadedDocs.length} of ${files.length} documents`,
      documents: uploadedDocs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/documents/:id - Get document metadata ==========
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM archive.v_documents_complete WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/documents/:id/download - Download file ==========
router.get('/:id/download', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM archive.documents WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];
    
    if (!doc.file_path) {
      return res.status(404).json({ error: 'File path not found' });
    }

    try {
      const fileBuffer = await readFile(doc.file_path);
      
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.original_filename || doc.filename}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      
      res.send(fileBuffer);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found on disk' });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

// ========== PUT /api/documents/:id - Update document metadata or replace file ==========
router.put('/:id', authenticateToken, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const { doc_type, is_draft, notes } = req.body;
    const userId = (req as any).user?.id;

    // Get existing document
    const existingResult = await pool.query(
      'SELECT * FROM archive.documents WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const existing = existingResult.rows[0];

    // If new file provided, archive old version and save new
    let filePath = existing.file_path;
    let filename = existing.filename;
    let fileSize = existing.file_size;
    let mimeType = existing.mime_type;
    let originalFilename = existing.original_filename;
    let newVersion = existing.version;

    if (file) {
      // Archive the old file
      if (existing.file_path) {
        await archiveDocument(existing.file_path, existing.version);
      }
      newVersion = existing.version + 1;

      // Determine entity type and info
      let entityType: EntityType = 'shipment';
      let entityId = existing.shipment_id;
      
      if (existing.contract_id && !existing.shipment_id) {
        entityType = 'contract';
        entityId = existing.contract_id;
      } else if (existing.transaction_id) {
        entityType = 'finance';
        entityId = existing.transaction_id;
      } else if (existing.customs_batch_id) {
        entityType = 'customs';
        entityId = existing.customs_batch_id;
      } else if (existing.company_id) {
        entityType = 'company';
        entityId = existing.company_id;
      }

      const entityInfo = await getEntityRef(entityType, entityId);
      
      // Fix double-encoded UTF-8 filenames (common with Arabic/Unicode filenames)
      const fixedOriginalFilename = fixEncodedFilename(file.originalname);

      const saved = await saveFile(
        file.buffer,
        entityType,
        entityInfo.ref,
        doc_type || existing.doc_type,
        fixedOriginalFilename,
        is_draft === 'true',
        entityInfo.year
      );

      filePath = saved.filePath;
      filename = saved.filename;
      fileSize = file.size;
      mimeType = file.mimetype;
      originalFilename = fixedOriginalFilename;
    }

    // Update document record
    const updateResult = await pool.query(
      `UPDATE archive.documents SET
        doc_type = COALESCE($1, doc_type),
        is_draft = COALESCE($2, is_draft),
        notes = COALESCE($3, notes),
        file_path = $4,
        filename = $5,
        file_size = $6,
        mime_type = $7,
        original_filename = $8,
        version = $9
      WHERE id = $10
      RETURNING *`,
      [
        doc_type,
        is_draft === 'true' ? true : is_draft === 'false' ? false : null,
        notes,
        filePath,
        filename,
        fileSize,
        mimeType,
        originalFilename,
        newVersion,
        id,
      ]
    );

    res.json({
      message: file ? 'Document replaced successfully' : 'Document updated successfully',
      document: updateResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ========== DELETE /api/documents/:id - Soft delete document ==========
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const result = await pool.query(
      `UPDATE archive.documents SET
        is_deleted = true,
        deleted_at = NOW(),
        deleted_by = $1
      WHERE id = $2 AND is_deleted = false
      RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Optionally move file to archive
    const doc = result.rows[0];
    if (doc.file_path) {
      try {
        await deleteFile(doc.file_path, false); // Move to archive, not permanent delete
      } catch (err) {
        logger.error('Failed to move file to archive:', err);
      }
    }

    res.json({
      message: 'Document deleted successfully',
      document: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET /api/documents/:id/permissions - Get document permissions ==========
router.get('/:id/permissions', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        dp.*,
        u.name as user_name,
        u.username,
        b.name as branch_name,
        g.name as granted_by_name
      FROM archive.document_permissions dp
      LEFT JOIN security.users u ON dp.user_id = u.id
      LEFT JOIN master_data.branches b ON dp.branch_id = b.id
      LEFT JOIN security.users g ON dp.granted_by = g.id
      WHERE dp.document_id = $1
      ORDER BY dp.created_at DESC`,
      [id]
    );

    res.json({
      document_id: id,
      permissions: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ========== POST /api/documents/:id/permissions - Add document permission ==========
router.post('/:id/permissions', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { user_id, branch_id, role, permission } = req.body;
    const grantedBy = (req as any).user?.id;

    if (!permission) {
      return res.status(400).json({ error: 'Permission type is required' });
    }

    if (!user_id && !branch_id && !role) {
      return res.status(400).json({ 
        error: 'At least one of user_id, branch_id, or role is required' 
      });
    }

    const result = await pool.query(
      `INSERT INTO archive.document_permissions 
        (document_id, user_id, branch_id, role, permission, granted_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [id, user_id || null, branch_id || null, role || null, permission, grantedBy]
    );

    res.status(201).json({
      message: 'Permission added successfully',
      permission: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ========== DELETE /api/documents/:id/permissions/:permissionId - Remove permission ==========
router.delete('/:id/permissions/:permissionId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, permissionId } = req.params;

    const result = await pool.query(
      'DELETE FROM archive.document_permissions WHERE id = $1 AND document_id = $2 RETURNING *',
      [permissionId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    res.json({
      message: 'Permission removed successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

