/**
 * Trademarks API Routes
 * Manages product trademarks/brands master data
 */
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';

const router = Router();

/**
 * GET /api/trademarks - List all trademarks with search
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, active_only = 'true', limit = '50' } = req.query;
    
    let query = `
      SELECT id, name, name_ar, description, logo_path, is_active, created_at
      FROM master_data.trademarks
      WHERE 1=1
    `;
    const params: any[] = [];
    
    // Filter active only
    if (active_only === 'true') {
      query += ' AND is_active = TRUE';
    }
    
    // Search by name
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (LOWER(name) LIKE LOWER($${params.length}) OR LOWER(name_ar) LIKE $${params.length})`;
    }
    
    query += ' ORDER BY name ASC';
    
    // Limit results
    params.push(Number(limit));
    query += ` LIMIT $${params.length}`;
    
    const result = await pool.query(query, params);
    
    res.json({
      trademarks: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/trademarks/:id - Get single trademark
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT id, name, name_ar, description, logo_path, is_active, created_at, updated_at
      FROM master_data.trademarks
      WHERE id = $1
    `, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Trademark not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/trademarks - Create new trademark
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, name_ar, description } = req.body;
    const user = (req as any).user?.id;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Trademark name is required' });
    }
    
    // Check if trademark already exists (case-insensitive)
    const existing = await pool.query(`
      SELECT id, name FROM master_data.trademarks
      WHERE LOWER(name) = LOWER($1)
    `, [name.trim()]);
    
    if (existing.rowCount && existing.rowCount > 0) {
      // Return existing trademark instead of error (upsert behavior)
      return res.status(200).json({
        ...existing.rows[0],
        already_existed: true,
      });
    }
    
    // Create new trademark
    const result = await pool.query(`
      INSERT INTO master_data.trademarks (name, name_ar, description, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING id, name, name_ar, description, is_active, created_at
    `, [name.trim(), name_ar?.trim() || null, description?.trim() || null, user]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/trademarks/:id - Update trademark
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, name_ar, description, is_active } = req.body;
    const user = (req as any).user?.id;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Trademark name is required' });
    }
    
    // Check if another trademark has the same name
    const existing = await pool.query(`
      SELECT id FROM master_data.trademarks
      WHERE LOWER(name) = LOWER($1) AND id != $2
    `, [name.trim(), id]);
    
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(400).json({ error: 'Another trademark with this name already exists' });
    }
    
    const result = await pool.query(`
      UPDATE master_data.trademarks
      SET name = $1, name_ar = $2, description = $3, is_active = $4, updated_by = $5
      WHERE id = $6
      RETURNING id, name, name_ar, description, is_active, updated_at
    `, [name.trim(), name_ar?.trim() || null, description?.trim() || null, is_active ?? true, user, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Trademark not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/trademarks/:id - Delete/deactivate trademark
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user?.id;
    
    // Soft delete by marking inactive
    const result = await pool.query(`
      UPDATE master_data.trademarks
      SET is_active = FALSE, updated_by = $1
      WHERE id = $2
      RETURNING id
    `, [user, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Trademark not found' });
    }
    
    res.json({ success: true, message: 'Trademark deactivated' });
  } catch (error) {
    next(error);
  }
});

export default router;







