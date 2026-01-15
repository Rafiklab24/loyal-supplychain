/**
 * Products API Routes
 * Full CRUD for product catalog + specs, price benchmarks, and seasons
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';
import { authenticateToken } from '../middleware/auth';
import { withTransaction } from '../utils/transactions';
import { parsePagination, createPaginatedResponse } from '../utils/pagination';

const router = Router();

// Apply auth to all routes
router.use(authenticateToken);

// ========== PRODUCT CATALOG CRUD ==========

/**
 * GET /api/products - List all products with filters
 * Query params: search, category, active, page, limit, sort, order
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      category,
      active = 'true',
      sort = 'name',
      order = 'asc'
    } = req.query;

    const pagination = parsePagination(req);

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Active filter
    if (active !== 'all') {
      conditions.push(`(p.is_active = $${paramIndex} OR p.is_active IS NULL)`);
      params.push(active === 'true');
      paramIndex++;
    }

    // Category filter
    if (category && category !== 'all') {
      conditions.push(`p.category_type = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Search filter (name, SKU, aliases)
    if (search) {
      conditions.push(`(
        p.name ILIKE $${paramIndex} OR 
        p.sku ILIKE $${paramIndex} OR 
        p.hs_code ILIKE $${paramIndex} OR
        EXISTS (SELECT 1 FROM unnest(p.aliases) AS alias WHERE alias ILIKE $${paramIndex})
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column
    const validSortColumns = ['name', 'sku', 'category_type', 'created_at', 'updated_at'];
    const sortColumn = validSortColumns.includes(sort as string) ? sort : 'name';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM master_data.products p
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get products with latest price and season status
    const query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.hs_code,
        p.category_type,
        p.category AS category_legacy,
        p.uom,
        p.pack_type,
        p.net_weight_kg,
        p.typical_origins,
        p.brand,
        p.is_seasonal,
        p.is_active,
        p.description,
        p.aliases,
        p.spec_json,
        p.created_at,
        p.updated_at,
        
        -- Latest price benchmark
        lpb.price_usd_per_mt AS latest_price,
        lpb.price_date AS latest_price_date,
        lpb.origin_country AS latest_price_origin,
        
        -- Price trend
        CASE 
          WHEN prev_price.price_usd_per_mt IS NOT NULL AND prev_price.price_usd_per_mt > 0 THEN
            ROUND(((lpb.price_usd_per_mt - prev_price.price_usd_per_mt) / prev_price.price_usd_per_mt * 100)::numeric, 1)
          ELSE NULL
        END AS price_trend_pct,
        
        -- Specs summary
        specs.grade,
        specs.certifications
        
      FROM master_data.products p
      
      -- Latest price
      LEFT JOIN LATERAL (
        SELECT price_usd_per_mt, price_date, origin_country
        FROM master_data.product_price_benchmarks
        WHERE product_id = p.id
        ORDER BY price_date DESC
        LIMIT 1
      ) lpb ON true
      
      -- Previous price (25-30 days ago for trend)
      LEFT JOIN LATERAL (
        SELECT price_usd_per_mt
        FROM master_data.product_price_benchmarks
        WHERE product_id = p.id 
          AND price_date <= CURRENT_DATE - INTERVAL '25 days'
        ORDER BY price_date DESC
        LIMIT 1
      ) prev_price ON true
      
      -- Specs
      LEFT JOIN master_data.product_specs specs ON specs.product_id = p.id
      
      ${whereClause}
      ORDER BY p.${sortColumn} ${sortOrder} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(pagination.limit, pagination.offset);
    const result = await pool.query(query, params);

    res.json(createPaginatedResponse(result.rows, total, pagination));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/categories - Get all product categories
 */
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT code, name, name_ar, icon, typical_specs, sort_order
      FROM master_data.product_categories
      ORDER BY sort_order, name
    `);
    res.json({ categories: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/autocomplete - Autocomplete search for products
 */
router.get('/autocomplete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, limit = '10' } = req.query;
    
    if (!query || (query as string).length < 2) {
      return res.json({ suggestions: [] });
    }

    const searchTerm = `%${query}%`;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);

    const result = await pool.query(`
      SELECT 
        p.id,
        p.name AS value,
        p.sku,
        p.category_type,
        p.hs_code,
        COALESCE(
          (SELECT COUNT(*) FROM logistics.shipment_lines sl WHERE sl.product_id = p.id),
          0
        ) AS frequency
      FROM master_data.products p
      WHERE (p.is_active = true OR p.is_active IS NULL)
        AND (
          p.name ILIKE $1 OR 
          p.sku ILIKE $1 OR
          EXISTS (SELECT 1 FROM unnest(p.aliases) AS alias WHERE alias ILIKE $1)
        )
      ORDER BY frequency DESC, p.name
      LIMIT $2
    `, [searchTerm, limitNum]);

    res.json({ suggestions: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/:id - Get single product with full details
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get product with specs
    const productResult = await pool.query(`
      SELECT 
        p.*,
        specs.id AS specs_id,
        specs.grade,
        specs.moisture_pct,
        specs.purity_pct,
        specs.ash_pct,
        specs.color_value,
        specs.grain_size_mm,
        specs.certifications,
        specs.custom_specs,
        specs.temperature_min_c,
        specs.temperature_max_c,
        specs.humidity_max_pct,
        specs.shelf_life_days,
        specs.special_handling,
        specs.packaging_requirements,
        specs.default_payment_terms,
        specs.default_inspection,
        specs.default_incoterm
      FROM master_data.products p
      LEFT JOIN master_data.product_specs specs ON specs.product_id = p.id
      WHERE p.id = $1
    `, [id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get price benchmarks (last 90 days)
    const pricesResult = await pool.query(`
      SELECT id, price_date, price_usd_per_mt, origin_country, incoterm, source, notes
      FROM master_data.product_price_benchmarks
      WHERE product_id = $1
        AND price_date >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY price_date DESC
    `, [id]);

    // Get seasons
    const seasonsResult = await pool.query(`
      SELECT *
      FROM master_data.product_seasons
      WHERE product_id = $1
      ORDER BY origin_country
    `, [id]);

    // Get usage stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT sl.shipment_id) AS shipment_count,
        COUNT(DISTINCT cl.contract_id) AS contract_count,
        COALESCE(SUM(sl.qty), 0) AS total_qty_shipped,
        COALESCE(AVG(sl.unit_price), 0) AS avg_price
      FROM master_data.products p
      LEFT JOIN logistics.shipment_lines sl ON sl.product_id = p.id
      LEFT JOIN logistics.contract_lines cl ON cl.product_id = p.id
      WHERE p.id = $1
    `, [id]);

    res.json({
      product,
      priceBenchmarks: pricesResult.rows,
      seasons: seasonsResult.rows,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products - Create new product
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      name,
      sku,
      hs_code,
      category_type,
      uom,
      pack_type,
      net_weight_kg,
      typical_origins,
      brand,
      is_seasonal,
      description,
      aliases,
      spec_json,
      // Specs (optional, can be added later)
      specs
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const user = (req as any).user?.username || 'system';

    // Insert product
    const productResult = await client.query(`
      INSERT INTO master_data.products (
        name, sku, hs_code, category_type, uom, pack_type, net_weight_kg,
        typical_origins, brand, is_seasonal, description, aliases, spec_json,
        is_active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14, $14)
      RETURNING *
    `, [
      name, sku, hs_code, category_type, uom, pack_type, net_weight_kg,
      typical_origins, brand, is_seasonal ?? true, description, aliases, spec_json || {},
      user
    ]);

    const product = productResult.rows[0];

    // Insert specs if provided
    if (specs) {
      await client.query(`
        INSERT INTO master_data.product_specs (
          product_id, grade, moisture_pct, purity_pct, ash_pct, color_value, grain_size_mm,
          certifications, custom_specs, temperature_min_c, temperature_max_c, humidity_max_pct,
          shelf_life_days, special_handling, packaging_requirements,
          default_payment_terms, default_inspection, default_incoterm,
          created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)
      `, [
        product.id,
        specs.grade, specs.moisture_pct, specs.purity_pct, specs.ash_pct,
        specs.color_value, specs.grain_size_mm, specs.certifications,
        specs.custom_specs || {}, specs.temperature_min_c, specs.temperature_max_c,
        specs.humidity_max_pct, specs.shelf_life_days, specs.special_handling,
        specs.packaging_requirements, specs.default_payment_terms,
        specs.default_inspection, specs.default_incoterm, user
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ product, message: 'Product created successfully' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Product with this name already exists' });
    }
    next(error);
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/products/:id - Update product
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const user = (req as any).user?.username || 'system';

    // Check product exists
    const existing = await client.query('SELECT id FROM master_data.products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const {
      name, sku, hs_code, category_type, uom, pack_type, net_weight_kg,
      typical_origins, brand, is_seasonal, description, aliases, spec_json, is_active,
      specs
    } = req.body;

    // Update product
    const updateResult = await client.query(`
      UPDATE master_data.products SET
        name = COALESCE($1, name),
        sku = COALESCE($2, sku),
        hs_code = COALESCE($3, hs_code),
        category_type = COALESCE($4, category_type),
        uom = COALESCE($5, uom),
        pack_type = COALESCE($6, pack_type),
        net_weight_kg = COALESCE($7, net_weight_kg),
        typical_origins = COALESCE($8, typical_origins),
        brand = COALESCE($9, brand),
        is_seasonal = COALESCE($10, is_seasonal),
        description = COALESCE($11, description),
        aliases = COALESCE($12, aliases),
        spec_json = COALESCE($13, spec_json),
        is_active = COALESCE($14, is_active),
        updated_at = now(),
        updated_by = $15
      WHERE id = $16
      RETURNING *
    `, [
      name, sku, hs_code, category_type, uom, pack_type, net_weight_kg,
      typical_origins, brand, is_seasonal, description, aliases, spec_json, is_active,
      user, id
    ]);

    // Update or insert specs if provided
    if (specs) {
      await client.query(`
        INSERT INTO master_data.product_specs (
          product_id, grade, moisture_pct, purity_pct, ash_pct, color_value, grain_size_mm,
          certifications, custom_specs, temperature_min_c, temperature_max_c, humidity_max_pct,
          shelf_life_days, special_handling, packaging_requirements,
          default_payment_terms, default_inspection, default_incoterm,
          created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)
        ON CONFLICT (product_id) DO UPDATE SET
          grade = COALESCE(EXCLUDED.grade, master_data.product_specs.grade),
          moisture_pct = COALESCE(EXCLUDED.moisture_pct, master_data.product_specs.moisture_pct),
          purity_pct = COALESCE(EXCLUDED.purity_pct, master_data.product_specs.purity_pct),
          ash_pct = COALESCE(EXCLUDED.ash_pct, master_data.product_specs.ash_pct),
          color_value = COALESCE(EXCLUDED.color_value, master_data.product_specs.color_value),
          grain_size_mm = COALESCE(EXCLUDED.grain_size_mm, master_data.product_specs.grain_size_mm),
          certifications = COALESCE(EXCLUDED.certifications, master_data.product_specs.certifications),
          custom_specs = COALESCE(EXCLUDED.custom_specs, master_data.product_specs.custom_specs),
          temperature_min_c = COALESCE(EXCLUDED.temperature_min_c, master_data.product_specs.temperature_min_c),
          temperature_max_c = COALESCE(EXCLUDED.temperature_max_c, master_data.product_specs.temperature_max_c),
          humidity_max_pct = COALESCE(EXCLUDED.humidity_max_pct, master_data.product_specs.humidity_max_pct),
          shelf_life_days = COALESCE(EXCLUDED.shelf_life_days, master_data.product_specs.shelf_life_days),
          special_handling = COALESCE(EXCLUDED.special_handling, master_data.product_specs.special_handling),
          packaging_requirements = COALESCE(EXCLUDED.packaging_requirements, master_data.product_specs.packaging_requirements),
          default_payment_terms = COALESCE(EXCLUDED.default_payment_terms, master_data.product_specs.default_payment_terms),
          default_inspection = COALESCE(EXCLUDED.default_inspection, master_data.product_specs.default_inspection),
          default_incoterm = COALESCE(EXCLUDED.default_incoterm, master_data.product_specs.default_incoterm),
          updated_at = now(),
          updated_by = EXCLUDED.updated_by
      `, [
        id,
        specs.grade, specs.moisture_pct, specs.purity_pct, specs.ash_pct,
        specs.color_value, specs.grain_size_mm, specs.certifications,
        specs.custom_specs || {}, specs.temperature_min_c, specs.temperature_max_c,
        specs.humidity_max_pct, specs.shelf_life_days, specs.special_handling,
        specs.packaging_requirements, specs.default_payment_terms,
        specs.default_inspection, specs.default_incoterm, user
      ]);
    }

    await client.query('COMMIT');
    res.json({ product: updateResult.rows[0], message: 'Product updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/products/:id - Soft delete product
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user?.username || 'system';

    const result = await pool.query(`
      UPDATE master_data.products 
      SET is_active = false, updated_at = now(), updated_by = $1
      WHERE id = $2
      RETURNING id, name
    `, [user, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deactivated', product: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ========== PRICE BENCHMARKS ==========

/**
 * GET /api/products/:id/prices - Get price history for a product
 */
router.get('/:id/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { days = '365', origin } = req.query;

    const conditions = ['product_id = $1', `price_date >= CURRENT_DATE - INTERVAL '${parseInt(days as string) || 365} days'`];
    const params: any[] = [id];

    if (origin) {
      conditions.push(`origin_country = $${params.length + 1}`);
      params.push(origin);
    }

    const result = await pool.query(`
      SELECT id, price_date, price_usd_per_mt, origin_country, incoterm, source, notes, created_at, created_by
      FROM master_data.product_price_benchmarks
      WHERE ${conditions.join(' AND ')}
      ORDER BY price_date DESC
    `, params);

    // Calculate stats
    const prices = result.rows.map(r => r.price_usd_per_mt);
    const stats = prices.length > 0 ? {
      latest: prices[0],
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      count: prices.length
    } : null;

    res.json({ prices: result.rows, stats });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products/:id/prices - Add price benchmark
 */
router.post('/:id/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { price_date, price_usd_per_mt, origin_country, incoterm, source, notes } = req.body;
    const user = (req as any).user?.username || 'system';

    if (!price_date || !price_usd_per_mt) {
      return res.status(400).json({ error: 'Price date and price are required' });
    }

    const result = await pool.query(`
      INSERT INTO master_data.product_price_benchmarks (
        product_id, price_date, price_usd_per_mt, origin_country, incoterm, source, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (product_id, price_date, origin_country, incoterm) 
      DO UPDATE SET 
        price_usd_per_mt = EXCLUDED.price_usd_per_mt,
        source = EXCLUDED.source,
        notes = EXCLUDED.notes
      RETURNING *
    `, [id, price_date, price_usd_per_mt, origin_country, incoterm, source, notes, user]);

    res.status(201).json({ price: result.rows[0], message: 'Price benchmark added' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/products/:id/prices/:priceId - Delete price benchmark
 */
router.delete('/:id/prices/:priceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, priceId } = req.params;

    const result = await pool.query(`
      DELETE FROM master_data.product_price_benchmarks
      WHERE id = $1 AND product_id = $2
      RETURNING id
    `, [priceId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price benchmark not found' });
    }

    res.json({ message: 'Price benchmark deleted' });
  } catch (error) {
    next(error);
  }
});

// ========== SEASONS ==========

/**
 * GET /api/products/:id/seasons - Get seasons for a product
 */
router.get('/:id/seasons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT *
      FROM master_data.product_seasons
      WHERE product_id = $1
      ORDER BY origin_country
    `, [id]);

    res.json({ seasons: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products/:id/seasons - Add/update season
 */
router.post('/:id/seasons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      origin_country,
      planting_start_month, planting_end_month,
      harvest_start_month, harvest_end_month,
      peak_start_month, peak_end_month,
      off_season_start_month, off_season_end_month,
      notes, crop_year_pattern
    } = req.body;
    const user = (req as any).user?.username || 'system';

    if (!origin_country) {
      return res.status(400).json({ error: 'Origin country is required' });
    }

    const result = await pool.query(`
      INSERT INTO master_data.product_seasons (
        product_id, origin_country,
        planting_start_month, planting_end_month,
        harvest_start_month, harvest_end_month,
        peak_start_month, peak_end_month,
        off_season_start_month, off_season_end_month,
        notes, crop_year_pattern, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (product_id, origin_country) DO UPDATE SET
        planting_start_month = EXCLUDED.planting_start_month,
        planting_end_month = EXCLUDED.planting_end_month,
        harvest_start_month = EXCLUDED.harvest_start_month,
        harvest_end_month = EXCLUDED.harvest_end_month,
        peak_start_month = EXCLUDED.peak_start_month,
        peak_end_month = EXCLUDED.peak_end_month,
        off_season_start_month = EXCLUDED.off_season_start_month,
        off_season_end_month = EXCLUDED.off_season_end_month,
        notes = EXCLUDED.notes,
        crop_year_pattern = EXCLUDED.crop_year_pattern,
        updated_at = now()
      RETURNING *
    `, [
      id, origin_country,
      planting_start_month, planting_end_month,
      harvest_start_month, harvest_end_month,
      peak_start_month, peak_end_month,
      off_season_start_month, off_season_end_month,
      notes, crop_year_pattern, user
    ]);

    res.status(201).json({ season: result.rows[0], message: 'Season saved' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/products/:id/seasons/:seasonId - Delete season
 */
router.delete('/:id/seasons/:seasonId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, seasonId } = req.params;

    const result = await pool.query(`
      DELETE FROM master_data.product_seasons
      WHERE id = $1 AND product_id = $2
      RETURNING id
    `, [seasonId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Season not found' });
    }

    res.json({ message: 'Season deleted' });
  } catch (error) {
    next(error);
  }
});

// ========== BULK IMPORT ==========

/**
 * POST /api/products/import - Bulk import products from Excel/JSON
 */
router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { products } = req.body;
    const user = (req as any).user?.username || 'system';

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products array is required' });
    }

    const results = await withTransaction(async (client) => {
      const results = {
        created: 0,
        updated: 0,
        errors: [] as any[]
      };

      for (const product of products) {
        try {
          if (!product.name) {
            results.errors.push({ row: product, error: 'Name is required' });
            continue;
          }

          // Upsert product
          const result = await client.query(`
            INSERT INTO master_data.products (
              name, sku, hs_code, category_type, uom, pack_type, net_weight_kg,
              typical_origins, brand, is_seasonal, description, aliases,
              is_active, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, $13)
            ON CONFLICT (lower(name), coalesce(lower(country), '')) DO UPDATE SET
              sku = COALESCE(EXCLUDED.sku, master_data.products.sku),
              hs_code = COALESCE(EXCLUDED.hs_code, master_data.products.hs_code),
              category_type = COALESCE(EXCLUDED.category_type, master_data.products.category_type),
              uom = COALESCE(EXCLUDED.uom, master_data.products.uom),
              pack_type = COALESCE(EXCLUDED.pack_type, master_data.products.pack_type),
              updated_at = now(),
              updated_by = EXCLUDED.updated_by
            RETURNING id, (xmax = 0) AS inserted
          `, [
            product.name, product.sku, product.hs_code, product.category_type,
            product.uom, product.pack_type, product.net_weight_kg,
            product.typical_origins, product.brand, product.is_seasonal ?? true,
            product.description, product.aliases, user
          ]);

          if (result.rows[0]?.inserted) {
            results.created++;
          } else {
            results.updated++;
          }
        } catch (err: any) {
          results.errors.push({ row: product, error: err.message });
        }
      }

      return results;
    });

    res.json({
      message: `Import complete: ${results.created} created, ${results.updated} updated`,
      ...results
    });
  } catch (error) {
    next(error);
  }
});

// ========== ANALYTICS ==========

/**
 * GET /api/products/:id/analytics - Get product performance analytics
 */
router.get('/:id/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { period = '12' } = req.query; // months

    const monthsAgo = parseInt(period as string) || 12;

    // Get shipment stats
    const shipmentStats = await pool.query(`
      SELECT 
        DATE_TRUNC('month', s.created_at) AS month,
        COUNT(DISTINCT s.id) AS shipment_count,
        SUM(sl.qty) AS total_qty,
        AVG(sl.unit_price) AS avg_price,
        SUM(sl.total_amount) AS total_value
      FROM logistics.v_shipments_complete s
      JOIN logistics.shipment_lines sl ON sl.shipment_id = s.id
      WHERE sl.product_id = $1
        AND s.created_at >= CURRENT_DATE - INTERVAL '${monthsAgo} months'
      GROUP BY DATE_TRUNC('month', s.created_at)
      ORDER BY month DESC
    `, [id]);

    // Get contract stats
    const contractStats = await pool.query(`
      SELECT 
        DATE_TRUNC('month', c.created_at) AS month,
        COUNT(DISTINCT c.id) AS contract_count,
        SUM(cl.planned_qty) AS total_qty,
        AVG(cl.unit_price) AS avg_price,
        SUM(cl.total_amount) AS total_value
      FROM logistics.contracts c
      JOIN logistics.contract_lines cl ON cl.contract_id = c.id
      WHERE cl.product_id = $1
        AND c.created_at >= CURRENT_DATE - INTERVAL '${monthsAgo} months'
      GROUP BY DATE_TRUNC('month', c.created_at)
      ORDER BY month DESC
    `, [id]);

    // Get top trading partners for this product
    const topPartners = await pool.query(`
      SELECT 
        co.id,
        co.name,
        COUNT(DISTINCT s.id) AS shipment_count,
        SUM(sl.qty) AS total_qty
      FROM logistics.v_shipments_complete s
      JOIN logistics.shipment_lines sl ON sl.shipment_id = s.id
      JOIN master_data.companies co ON co.id = s.shipping_line_id
      WHERE sl.product_id = $1
      GROUP BY co.id, co.name
      ORDER BY total_qty DESC
      LIMIT 5
    `, [id]);

    // Compare internal vs benchmark prices
    const priceComparison = await pool.query(`
      WITH internal_prices AS (
        SELECT 
          DATE_TRUNC('month', s.created_at) AS month,
          AVG(sl.unit_price) AS internal_avg
        FROM logistics.v_shipments_complete s
        JOIN logistics.shipment_lines sl ON sl.shipment_id = s.id
        WHERE sl.product_id = $1
          AND s.created_at >= CURRENT_DATE - INTERVAL '${monthsAgo} months'
        GROUP BY DATE_TRUNC('month', s.created_at)
      ),
      benchmark_prices AS (
        SELECT 
          DATE_TRUNC('month', price_date) AS month,
          AVG(price_usd_per_mt) AS benchmark_avg
        FROM master_data.product_price_benchmarks
        WHERE product_id = $1
          AND price_date >= CURRENT_DATE - INTERVAL '${monthsAgo} months'
        GROUP BY DATE_TRUNC('month', price_date)
      )
      SELECT 
        COALESCE(i.month, b.month) AS month,
        i.internal_avg,
        b.benchmark_avg,
        CASE 
          WHEN b.benchmark_avg > 0 THEN 
            ROUND(((i.internal_avg - b.benchmark_avg) / b.benchmark_avg * 100)::numeric, 1)
          ELSE NULL
        END AS variance_pct
      FROM internal_prices i
      FULL OUTER JOIN benchmark_prices b ON i.month = b.month
      ORDER BY month DESC
    `, [id]);

    res.json({
      shipmentStats: shipmentStats.rows,
      contractStats: contractStats.rows,
      topPartners: topPartners.rows,
      priceComparison: priceComparison.rows
    });
  } catch (error) {
    next(error);
  }
});

export default router;

