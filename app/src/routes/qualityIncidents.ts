/**
 * Quality Incidents API Routes
 * Full CRUD for quality incident reporting and review workflow
 * 
 * Features:
 * - Create incidents (applies HOLD to shipment)
 * - Add sample cards with defect measurements
 * - Upload media (photos/videos)
 * - Submit for review
 * - Review actions (keep hold, clear hold, request resampling, close)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';
import { authenticateToken } from '../middleware/auth';
import { withTransaction } from '../utils/transactions';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ============================================================
// FILE UPLOAD CONFIGURATION
// ============================================================

const QUALITY_MEDIA_PATH = process.env.QUALITY_MEDIA_PATH || 
  path.resolve(__dirname, '../../storage/quality-media');

// Ensure directory exists
if (!fs.existsSync(QUALITY_MEDIA_PATH)) {
  fs.mkdirSync(QUALITY_MEDIA_PATH, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const incidentId = req.params.id;
    const incidentPath = path.join(QUALITY_MEDIA_PATH, incidentId);
    if (!fs.existsSync(incidentPath)) {
      fs.mkdirSync(incidentPath, { recursive: true });
    }
    cb(null, incidentPath);
  },
  filename: (req, file, cb) => {
    const slot = req.body.slot || 'other';
    const sampleId = req.body.sample_id || '';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${slot}_${sampleId}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for videos
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos allowed.'));
    }
  }
});

// ============================================================
// TYPES
// ============================================================

type IssueType = 'broken' | 'mold' | 'moisture' | 'foreign_matter' | 'wrong_spec' | 'damaged';
type IncidentStatus = 'draft' | 'submitted' | 'under_review' | 'action_set' | 'closed';
type ActionType = 'request_resample' | 'keep_hold' | 'clear_hold' | 'close' | 'add_note';

// ============================================================
// GET /api/quality-incidents
// List incidents with filters
// ============================================================

router.get('/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { status, branch_id, shipment_id, created_by } = req.query;
      
      let whereConditions = ['qi.is_deleted = FALSE'];
      const params: any[] = [];
      
      // Filter by status
      if (status) {
        params.push(status);
        whereConditions.push(`qi.status = $${params.length}`);
      }
      
      // Filter by branch
      if (branch_id) {
        params.push(branch_id);
        whereConditions.push(`qi.branch_id = $${params.length}`);
      }
      
      // Filter by shipment
      if (shipment_id) {
        params.push(shipment_id);
        whereConditions.push(`qi.shipment_id = $${params.length}`);
      }
      
      // Filter by creator
      if (created_by) {
        params.push(created_by);
        whereConditions.push(`qi.created_by_user_id = $${params.length}`);
      }
      
      // Branch filtering for non-admin users
      if (!['Admin', 'Exec'].includes(user.role)) {
        const branchResult = await pool.query(`
          SELECT branch_id FROM security.user_branches WHERE user_id = $1
        `, [user.id]);
        
        if (branchResult.rows.length > 0) {
          const branchIds = branchResult.rows.map(r => r.branch_id);
          params.push(branchIds);
          whereConditions.push(`qi.branch_id = ANY($${params.length}::uuid[])`);
        }
      }
      
      const query = `
        SELECT * FROM logistics.v_quality_incidents_complete qi
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY qi.created_at DESC
      `;
      
      const result = await pool.query(query, params);
      
      res.json({
        incidents: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// GET /api/quality-incidents/:id
// Get single incident with full details
// ============================================================

router.get('/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT * FROM logistics.v_quality_incidents_complete
        WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      
      res.json({ incident: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// POST /api/quality-incidents
// Create new incident (applies HOLD to shipment)
// ============================================================

router.post('/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { 
        shipment_id, 
        issue_type, 
        issue_subtype, 
        description_short,
        branch_id 
      } = req.body;
      
      // Validate required fields
      if (!shipment_id || !issue_type) {
        return res.status(400).json({ 
          error: 'Missing required fields: shipment_id, issue_type' 
        });
      }
      
      // Validate issue_type (can be comma-separated for multiple types)
      const validIssueTypes: IssueType[] = ['broken', 'mold', 'moisture', 'foreign_matter', 'wrong_spec', 'damaged'];
      const issueTypes = (issue_type as string).split(',').map(t => t.trim());
      const invalidTypes = issueTypes.filter(t => !validIssueTypes.includes(t as IssueType));
      if (invalidTypes.length > 0) {
        return res.status(400).json({ 
          error: `Invalid issue_type(s): ${invalidTypes.join(', ')}. Valid types: ${validIssueTypes.join(', ')}` 
        });
      }
      
      // Verify shipment exists
      const shipmentResult = await pool.query(`
        SELECT id, sn FROM logistics.shipments 
        WHERE id = $1 AND is_deleted = FALSE
      `, [shipment_id]);
      
      if (shipmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      
      // Determine if weighing is required based on issue type
      // Weighing is required unless only 'damaged' type without internal damage subtypes
      const weighingRequired = !issueTypes.every(t => t === 'damaged') || 
        ['wet_external', 'dirty', 'torn_bag'].includes(issue_subtype || '');
      
      const incidentId = await withTransaction(async (client) => {
        // Create the incident (trigger will apply HOLD to shipment)
        const incidentResult = await client.query(`
          INSERT INTO logistics.quality_incidents (
            shipment_id, branch_id, created_by_user_id,
            issue_type, issue_subtype, description_short,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, 'draft')
          RETURNING id
        `, [shipment_id, branch_id, user.id, issue_type, issue_subtype, description_short]);
        
        const incidentId = incidentResult.rows[0].id;
        
        // Create the 9 sample cards
        const sampleIds = ['F1', 'F2', 'F3', 'M1', 'M2', 'M3', 'B1', 'B2', 'B3'];
        const sampleGroups: Record<string, string> = {
          'F1': 'front', 'F2': 'front', 'F3': 'front',
          'M1': 'middle', 'M2': 'middle', 'M3': 'middle',
          'B1': 'back', 'B2': 'back', 'B3': 'back'
        };
        
        for (const sampleId of sampleIds) {
          await client.query(`
            INSERT INTO logistics.quality_sample_cards (
              incident_id, sample_id, sample_group, weighing_required
            ) VALUES ($1, $2, $3, $4)
          `, [incidentId, sampleId, sampleGroups[sampleId], weighingRequired]);
        }
        
        return incidentId;
      });
      
      // Fetch the created incident with all details
      const result = await pool.query(`
        SELECT * FROM logistics.v_quality_incidents_complete
        WHERE id = $1
      `, [incidentId]);
      
      res.status(201).json({
        success: true,
        message: 'Quality incident created. HOLD applied to shipment.',
        incident: result.rows[0]
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// PUT /api/quality-incidents/:id
// Update incident (container conditions, estimates)
// ============================================================

router.put('/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        issue_type,
        issue_subtype,
        description_short,
        container_moisture_seen,
        container_bad_smell,
        container_torn_bags,
        container_torn_bags_count,
        container_condensation,
        affected_estimate_min,
        affected_estimate_max,
        affected_estimate_mode,
        // New measurement fields
        sample_weight_g,
        broken_g,
        mold_g,
        foreign_g,
        other_g,
        moisture_pct,
        total_defect_pct
      } = req.body;
      
      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [id];
      let paramIndex = 2;
      
      if (issue_type !== undefined) {
        updates.push(`issue_type = $${paramIndex++}`);
        params.push(issue_type);
      }
      if (issue_subtype !== undefined) {
        updates.push(`issue_subtype = $${paramIndex++}`);
        params.push(issue_subtype);
      }
      if (description_short !== undefined) {
        updates.push(`description_short = $${paramIndex++}`);
        params.push(description_short);
      }
      if (container_moisture_seen !== undefined) {
        updates.push(`container_moisture_seen = $${paramIndex++}`);
        params.push(container_moisture_seen);
      }
      if (container_bad_smell !== undefined) {
        updates.push(`container_bad_smell = $${paramIndex++}`);
        params.push(container_bad_smell);
      }
      if (container_torn_bags !== undefined) {
        updates.push(`container_torn_bags = $${paramIndex++}`);
        params.push(container_torn_bags);
      }
      if (container_torn_bags_count !== undefined) {
        updates.push(`container_torn_bags_count = $${paramIndex++}`);
        params.push(container_torn_bags_count);
      }
      if (container_condensation !== undefined) {
        updates.push(`container_condensation = $${paramIndex++}`);
        params.push(container_condensation);
      }
      if (affected_estimate_min !== undefined) {
        updates.push(`affected_estimate_min = $${paramIndex++}`);
        params.push(affected_estimate_min);
      }
      if (affected_estimate_max !== undefined) {
        updates.push(`affected_estimate_max = $${paramIndex++}`);
        params.push(affected_estimate_max);
      }
      if (affected_estimate_mode !== undefined) {
        updates.push(`affected_estimate_mode = $${paramIndex++}`);
        params.push(affected_estimate_mode);
      }
      // New measurement fields
      if (sample_weight_g !== undefined) {
        updates.push(`sample_weight_g = $${paramIndex++}`);
        params.push(sample_weight_g);
      }
      if (broken_g !== undefined) {
        updates.push(`broken_g = $${paramIndex++}`);
        params.push(broken_g);
      }
      if (mold_g !== undefined) {
        updates.push(`mold_g = $${paramIndex++}`);
        params.push(mold_g);
      }
      if (foreign_g !== undefined) {
        updates.push(`foreign_g = $${paramIndex++}`);
        params.push(foreign_g);
      }
      if (other_g !== undefined) {
        updates.push(`other_g = $${paramIndex++}`);
        params.push(other_g);
      }
      if (moisture_pct !== undefined) {
        updates.push(`moisture_pct = $${paramIndex++}`);
        params.push(moisture_pct);
      }
      if (total_defect_pct !== undefined) {
        updates.push(`avg_defect_pct = $${paramIndex++}`);
        params.push(total_defect_pct);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push('updated_at = NOW()');
      
      await pool.query(`
        UPDATE logistics.quality_incidents
        SET ${updates.join(', ')}
        WHERE id = $1 AND status IN ('draft', 'submitted')
      `, params);
      
      // Fetch updated incident
      const result = await pool.query(`
        SELECT * FROM logistics.v_quality_incidents_complete
        WHERE id = $1
      `, [id]);
      
      res.json({
        success: true,
        incident: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// POST /api/quality-incidents/:id/samples
// Add/update sample card
// ============================================================

router.post('/:id/samples',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        sample_id,
        sample_weight_g,
        broken_g,
        mold_g,
        foreign_g,
        other_g,
        is_complete,
        notes
      } = req.body;
      
      if (!sample_id) {
        return res.status(400).json({ error: 'sample_id is required' });
      }
      
      // Validate measurements
      const sampleWeight = sample_weight_g || 1000;
      const totalDefects = (broken_g || 0) + (mold_g || 0) + (foreign_g || 0) + (other_g || 0);
      
      if (totalDefects > sampleWeight) {
        return res.status(400).json({ 
          error: 'Total defects cannot exceed sample weight' 
        });
      }
      
      // Update the sample card
      await pool.query(`
        UPDATE logistics.quality_sample_cards
        SET 
          sample_weight_g = $3,
          broken_g = COALESCE($4, 0),
          mold_g = COALESCE($5, 0),
          foreign_g = COALESCE($6, 0),
          other_g = COALESCE($7, 0),
          is_complete = COALESCE($8, FALSE),
          notes = $9,
          updated_at = NOW()
        WHERE incident_id = $1 AND sample_id = $2
      `, [id, sample_id, sampleWeight, broken_g, mold_g, foreign_g, other_g, is_complete, notes]);
      
      // Fetch updated incident (stats will be recalculated by trigger)
      const result = await pool.query(`
        SELECT * FROM logistics.v_quality_incidents_complete
        WHERE id = $1
      `, [id]);
      
      res.json({
        success: true,
        incident: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// POST /api/quality-incidents/:id/media
// Upload media file
// ============================================================

router.post('/:id/media',
  authenticateToken,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { slot, sample_id, watermark_text } = req.body;
      const user = (req as any).user;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      if (!slot) {
        return res.status(400).json({ error: 'slot is required' });
      }
      
      // Get sample_card_id if sample_id provided
      let sampleCardId = null;
      if (sample_id) {
        const sampleResult = await pool.query(`
          SELECT id FROM logistics.quality_sample_cards
          WHERE incident_id = $1 AND sample_id = $2
        `, [id, sample_id]);
        
        if (sampleResult.rows.length > 0) {
          sampleCardId = sampleResult.rows[0].id;
        }
      }
      
      // Determine media type
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'photo';
      
      // Insert media record
      const mediaResult = await pool.query(`
        INSERT INTO logistics.quality_media (
          incident_id, sample_card_id, media_type, slot,
          file_path, file_name, file_size, mime_type,
          watermark_text, created_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, file_path
      `, [
        id, sampleCardId, mediaType, slot,
        file.path, file.filename, file.size, file.mimetype,
        watermark_text, user.id
      ]);
      
      // Build the file URL for client access (includes incident ID subfolder)
      const fileUrl = `/uploads/quality/${id}/${file.filename}`;
      
      res.status(201).json({
        success: true,
        media: {
          id: mediaResult.rows[0].id,
          file_path: mediaResult.rows[0].file_path,
          file_url: fileUrl,
          file_name: file.filename,
          media_type: mediaType,
          slot,
          sample_id: sample_id || null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// DELETE /api/quality-incidents/:id/media/:mediaId
// Delete media file
// ============================================================

router.delete('/:id/media/:mediaId',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, mediaId } = req.params;
      
      // Get file path before deleting
      const mediaResult = await pool.query(`
        SELECT file_path FROM logistics.quality_media
        WHERE id = $1 AND incident_id = $2
      `, [mediaId, id]);
      
      if (mediaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Media not found' });
      }
      
      const filePath = mediaResult.rows[0].file_path;
      
      // Delete from database
      await pool.query(`
        DELETE FROM logistics.quality_media
        WHERE id = $1 AND incident_id = $2
      `, [mediaId, id]);
      
      // Delete file from disk
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// POST /api/quality-incidents/:id/submit
// Submit incident for review
// ============================================================

router.post('/:id/submit',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      // Verify incident exists and is in draft status
      const incidentResult = await pool.query(`
        SELECT qi.*, 
          (SELECT COUNT(*) FROM logistics.quality_sample_cards sc 
           WHERE sc.incident_id = qi.id AND sc.is_complete = TRUE) as completed_samples,
          (SELECT COUNT(*) FROM logistics.quality_media qm 
           WHERE qm.incident_id = qi.id) as media_count
        FROM logistics.quality_incidents qi
        WHERE qi.id = $1 AND qi.is_deleted = FALSE
      `, [id]);
      
      if (incidentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      
      const incident = incidentResult.rows[0];
      
      if (incident.status !== 'draft') {
        return res.status(400).json({ 
          error: 'Incident can only be submitted from draft status' 
        });
      }
      
      // Validation: require at least some samples or media
      if (incident.completed_samples < 1 && incident.media_count < 1) {
        return res.status(400).json({ 
          error: 'At least one sample must be completed or media must be uploaded' 
        });
      }
      
      // Update status to submitted
      await pool.query(`
        UPDATE logistics.quality_incidents
        SET 
          status = 'submitted',
          submitted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [id]);
      
      // Fetch updated incident
      const result = await pool.query(`
        SELECT * FROM logistics.v_quality_incidents_complete
        WHERE id = $1
      `, [id]);
      
      res.json({
        success: true,
        message: 'Incident submitted for review. Supervisor and HQ have been notified.',
        incident: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// POST /api/quality-incidents/:id/review
// Add review action (Supervisor/HQ only)
// ============================================================

router.post('/:id/review',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { action_type, notes, target_sample_ids } = req.body;
      const user = (req as any).user;
      
      // Validate user role - only Supervisor-like roles can review
      const allowedRoles = ['Admin', 'Exec', 'Inventory']; // Inventory for branch supervisors
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          error: 'Only supervisors and HQ can perform review actions' 
        });
      }
      
      // Validate action type
      const validActions: ActionType[] = ['request_resample', 'keep_hold', 'clear_hold', 'close', 'add_note'];
      if (!validActions.includes(action_type)) {
        return res.status(400).json({ 
          error: `Invalid action_type. Must be one of: ${validActions.join(', ')}` 
        });
      }
      
      // Verify incident exists
      const incidentResult = await pool.query(`
        SELECT qi.*, s.id as shipment_id
        FROM logistics.quality_incidents qi
        JOIN logistics.shipments s ON s.id = qi.shipment_id
        WHERE qi.id = $1 AND qi.is_deleted = FALSE
      `, [id]);
      
      if (incidentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      
      const incident = incidentResult.rows[0];
      
      await withTransaction(async (client) => {
        // Record the review action
        await client.query(`
          INSERT INTO logistics.quality_review_actions (
            incident_id, by_user_id, by_role, action_type, notes, target_sample_ids
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [id, user.id, user.role, action_type, notes, target_sample_ids]);
        
        // Handle action-specific logic
        if (action_type === 'clear_hold') {
          // Clear hold on shipment
          await client.query(`
            UPDATE logistics.shipments
            SET hold_status = FALSE, hold_reason = NULL, updated_at = NOW()
            WHERE id = $1
          `, [incident.shipment_id]);
          
          // Update incident status
          await client.query(`
            UPDATE logistics.quality_incidents
            SET status = 'action_set', updated_at = NOW()
            WHERE id = $1
          `, [id]);
          
        } else if (action_type === 'keep_hold') {
          // Update incident status but keep hold
          await client.query(`
            UPDATE logistics.quality_incidents
            SET status = 'action_set', updated_at = NOW()
            WHERE id = $1
          `, [id]);
          
        } else if (action_type === 'close') {
          // Close the incident
          await client.query(`
            UPDATE logistics.quality_incidents
            SET status = 'closed', closed_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `, [id]);
          
          // Update supplier delivery record with final outcome
          const outcome = incident.avg_defect_pct > 5 ? 'major_issue' : 'partial_issue';
          await client.query(`
            UPDATE logistics.supplier_delivery_records
            SET final_outcome = $2
            WHERE shipment_id = $1
          `, [incident.shipment_id, outcome]);
          
        } else if (action_type === 'request_resample') {
          // Mark specified samples as incomplete
          if (target_sample_ids && target_sample_ids.length > 0) {
            await client.query(`
              UPDATE logistics.quality_sample_cards
              SET is_complete = FALSE, updated_at = NOW()
              WHERE incident_id = $1 AND sample_id = ANY($2::text[])
            `, [id, target_sample_ids]);
          }
          
          // Set status back to under_review
          await client.query(`
            UPDATE logistics.quality_incidents
            SET status = 'under_review', updated_at = NOW()
            WHERE id = $1
          `, [id]);
        }
      });
      
      // Fetch updated incident
      const result = await pool.query(`
        SELECT * FROM logistics.v_quality_incidents_complete
        WHERE id = $1
      `, [id]);
        
      res.json({
        success: true,
        message: `Action '${action_type}' recorded successfully`,
        incident: result.rows[0]
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// GET /api/quality-incidents/stats/summary
// Get summary statistics for dashboard
// ============================================================

router.get('/stats/summary',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { branch_id } = req.query;
      
      let branchFilter = '';
      const params: any[] = [];
      
      if (branch_id) {
        params.push(branch_id);
        branchFilter = `AND branch_id = $${params.length}`;
      } else if (!['Admin', 'Exec'].includes(user.role)) {
        // Get user's branches
        const branchResult = await pool.query(`
          SELECT branch_id FROM security.user_branches WHERE user_id = $1
        `, [user.id]);
        
        if (branchResult.rows.length > 0) {
          params.push(branchResult.rows.map(r => r.branch_id));
          branchFilter = `AND branch_id = ANY($${params.length}::uuid[])`;
        }
      }
      
      const result = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'draft') as draft,
          COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
          COUNT(*) FILTER (WHERE status = 'under_review') as under_review,
          COUNT(*) FILTER (WHERE status = 'action_set') as action_set,
          COUNT(*) FILTER (WHERE status = 'closed') as closed,
          COUNT(*) as total,
          AVG(avg_defect_pct) FILTER (WHERE avg_defect_pct IS NOT NULL) as overall_avg_defect_pct
        FROM logistics.quality_incidents
        WHERE is_deleted = FALSE ${branchFilter}
      `, params);
      
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

