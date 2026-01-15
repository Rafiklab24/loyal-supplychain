import { Router } from 'express';
import { pool } from '../db/client';

interface Branch {
  id: string;
  name: string;
  name_ar: string;
  parent_id: string | null;
  branch_type: string;
  country: string | null;
  city: string | null;
  sort_order: number;
  is_shared?: boolean;
  shared_with_branches?: string[]; // Array of branch IDs that can access this warehouse
  children?: Branch[];
}

const router = Router();

// GET /api/branches - Get all branches with hierarchy
router.get('/', async (req, res, next) => {
  try {
    const { type, active_only = 'true' } = req.query;
    
    let query = `
      SELECT 
        b.id,
        b.name,
        b.name_ar,
        b.parent_id,
        b.branch_type,
        b.country,
        b.city,
        b.is_active,
        b.sort_order,
        p.name as parent_name,
        p.name_ar as parent_name_ar
      FROM master_data.branches b
      LEFT JOIN master_data.branches p ON b.parent_id = p.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (active_only === 'true') {
      query += ` AND b.is_active = true`;
    }
    
    if (type) {
      params.push(type);
      query += ` AND b.branch_type = $${params.length}`;
    }
    
    query += ` ORDER BY b.sort_order, b.name`;
    
    const result = await pool.query(query, params);
    
    res.json({ 
      branches: result.rows,
      total: result.rows.length 
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/branches/tree - Get branches as hierarchical tree
router.get('/tree', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        b.name,
        b.name_ar,
        b.parent_id,
        b.branch_type,
        b.country,
        b.city,
        b.sort_order
      FROM master_data.branches b
      WHERE b.is_active = true
      ORDER BY b.sort_order, b.name
    `);
    
    // Build tree structure
    const branches: Branch[] = result.rows;
    const branchMap = new Map<string, Branch & { children: Branch[] }>();
    const roots: (Branch & { children: Branch[] })[] = [];
    
    // First pass: create map
    branches.forEach((branch: Branch) => {
      branchMap.set(branch.id, { ...branch, children: [] });
    });
    
    // Second pass: build tree
    branches.forEach((branch: Branch) => {
      const node = branchMap.get(branch.id);
      if (branch.parent_id && node) {
        const parent = branchMap.get(branch.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      } else if (node) {
        roots.push(node);
      }
    });
    
    res.json({ tree: roots });
  } catch (error) {
    next(error);
  }
});

// GET /api/branches/warehouses - Get only warehouse-type branches (for dropdown)
// Includes shared warehouse access information
router.get('/warehouses', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        b.name,
        b.name_ar,
        b.parent_id,
        b.branch_type,
        b.country,
        b.city,
        b.is_shared,
        b.is_active,
        b.sort_order,
        p.name as parent_name,
        p.name_ar as parent_name_ar,
        CASE 
          WHEN p.name IS NOT NULL THEN p.name || ' > ' || b.name
          ELSE b.name
        END as full_path,
        CASE 
          WHEN p.name_ar IS NOT NULL THEN p.name_ar || ' > ' || b.name_ar
          ELSE b.name_ar
        END as full_path_ar,
        -- Get array of branch IDs that can access this warehouse (for shared warehouses)
        COALESCE(
          (SELECT array_agg(wba.branch_id::text)
           FROM master_data.warehouse_branch_access wba
           WHERE wba.warehouse_id = b.id),
          ARRAY[]::text[]
        ) as shared_with_branches
      FROM master_data.branches b
      LEFT JOIN master_data.branches p ON b.parent_id = p.id
      WHERE b.is_active = true
      ORDER BY b.sort_order, b.name
    `);
    
    res.json({ 
      branches: result.rows,
      total: result.rows.length 
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/branches/:id - Get single branch by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        b.*,
        p.name as parent_name,
        p.name_ar as parent_name_ar
      FROM master_data.branches b
      LEFT JOIN master_data.branches p ON b.parent_id = p.id
      WHERE b.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;

