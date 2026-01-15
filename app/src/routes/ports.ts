import { Router } from 'express';
import { pool } from '../db/client';
import logger from '../utils/logger';
import { parsePagination, createPaginatedResponse } from '../utils/pagination';

const router = Router();

// GET /api/ports - List all ports
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const pagination = parsePagination(req);
    
    let query = `
      SELECT * FROM master_data.ports
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (search) {
      const normalized = (search as string).replace(/[-_\s]/g, '').toLowerCase();
      params.push(`%${normalized}%`);
      const normalizedParam = params.length;
      params.push(`%${search}%`);
      const originalParam = params.length;
      query += ` AND (
        REPLACE(REPLACE(REPLACE(LOWER(name), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(unlocode), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        LOWER(country) LIKE LOWER($${originalParam})
      )`;
    }
    
    query += ` ORDER BY name`;
    
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pagination.limit, pagination.offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM master_data.ports WHERE 1=1';
    const countParams: any[] = [];
    if (search) {
      const normalized = (search as string).replace(/[-_\s]/g, '').toLowerCase();
      countParams.push(`%${normalized}%`);
      const normalizedParam = countParams.length;
      countParams.push(`%${search}%`);
      const originalParam = countParams.length;
      countQuery += ` AND (
        REPLACE(REPLACE(REPLACE(LOWER(name), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        REPLACE(REPLACE(REPLACE(LOWER(unlocode), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        LOWER(country) LIKE LOWER($${originalParam})
      )`;
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = Number(countResult.rows[0].count);
    
    res.json(createPaginatedResponse(result.rows, total, pagination));
  } catch (error) {
    next(error);
  }
});

// GET /api/ports/:id - Get single port
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM master_data.ports WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Port not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/ports/search - Search ports by name
router.get('/search/query', async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    
    const normalized = (q as string).replace(/[-_\s]/g, '').toLowerCase();
    const result = await pool.query(
      `SELECT * FROM master_data.ports 
       WHERE REPLACE(REPLACE(REPLACE(LOWER(name), '-', ''), '_', ''), ' ', '') LIKE $1 OR
             REPLACE(REPLACE(REPLACE(LOWER(unlocode), '-', ''), '_', ''), ' ', '') LIKE $1 OR
             LOWER(country) LIKE LOWER($2)
       ORDER BY name
       LIMIT 20`,
      [`%${normalized}%`, `%${q}%`]
    );
    
    res.json({
      query: q,
      count: result.rows.length,
      results: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ports - Create a new port (for auto-creation from OCR extraction)
router.post('/', async (req, res, next) => {
  try {
    const { name, country, unlocode, code } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Port name is required' });
    }
    
    // Check if port already exists (case-insensitive)
    const existingResult = await pool.query(
      `SELECT * FROM master_data.ports 
       WHERE LOWER(name) = LOWER($1) 
       AND (LOWER(COALESCE(country, '')) = LOWER(COALESCE($2, '')) OR $2 IS NULL)
       LIMIT 1`,
      [name, country]
    );
    
    if (existingResult.rows.length > 0) {
      // Port already exists, return it
      return res.json({ 
        data: existingResult.rows[0], 
        created: false,
        message: 'Port already exists' 
      });
    }
    
    // Create new port
    const result = await pool.query(
      `INSERT INTO master_data.ports (name, country, unlocode, code)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, country || null, unlocode || null, code || null]
    );
    
    logger.info(`[Ports] Auto-created port: ${name}, ${country}`);
    
    res.status(201).json({ 
      data: result.rows[0], 
      created: true,
      message: 'Port created successfully' 
    });
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      // Try to fetch the existing port
      const existingResult = await pool.query(
        `SELECT * FROM master_data.ports WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [req.body.name]
      );
      if (existingResult.rows.length > 0) {
        return res.json({ 
          data: existingResult.rows[0], 
          created: false,
          message: 'Port already exists' 
        });
      }
    }
    next(error);
  }
});

export default router;

