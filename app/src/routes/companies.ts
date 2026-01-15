import { Router } from 'express';
import { pool } from '../db/client';
import { calculateSimilarity, findBestMatches, normalizeCompanyName } from '../utils/stringMatch';
import logger from '../utils/logger';

const router = Router();

// GET /api/companies/fuzzy-match - Find best matching companies using fuzzy matching
// This endpoint is specifically designed for OCR extraction results
router.get('/fuzzy-match', async (req, res, next) => {
  try {
    const { name, threshold = '0.6', limit = '5', type } = req.query;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ 
        error: 'Company name is required',
        message: 'Please provide a name query parameter' 
      });
    }
    
    const similarityThreshold = Math.max(0, Math.min(1, parseFloat(threshold as string) || 0.6));
    const maxResults = Math.min(20, parseInt(limit as string) || 5);
    
    // Build query based on type filter
    let typeFilter = '';
    if (type === 'supplier') {
      typeFilter = 'AND is_supplier = true';
    } else if (type === 'customer') {
      typeFilter = 'AND is_customer = true';
    } else if (type === 'shipping_line') {
      typeFilter = 'AND is_shipping_line = true';
    }
    
    // Fetch all potential candidates (we'll filter in application code for better fuzzy matching)
    // First, try to narrow down using normalized search
    const normalizedSearch = normalizeCompanyName(name);
    const searchTokens = normalizedSearch.split(' ').filter(t => t.length > 2);
    
    // If we have tokens, use them to pre-filter candidates
    let candidates;
    if (searchTokens.length > 0) {
      // Use first significant token to narrow down (most company names start with distinguishing word)
      const firstToken = searchTokens[0];
      const result = await pool.query(
        `SELECT id, name, is_supplier, is_customer, is_shipping_line, country
         FROM master_data.companies 
         WHERE is_deleted = false ${typeFilter}
         AND (
           LOWER(name) LIKE $1 OR
           LOWER(name) LIKE $2
         )
         LIMIT 500`,
        [`${firstToken}%`, `%${firstToken}%`]
      );
      candidates = result.rows;
      
      // If we got too few results with first token, broaden search
      if (candidates.length < 10) {
        const broadResult = await pool.query(
          `SELECT id, name, is_supplier, is_customer, is_shipping_line, country
           FROM master_data.companies 
           WHERE is_deleted = false ${typeFilter}
           LIMIT 2000`
        );
        candidates = broadResult.rows;
      }
    } else {
      // No tokens - get all companies (limited)
      const result = await pool.query(
        `SELECT id, name, is_supplier, is_customer, is_shipping_line, country
         FROM master_data.companies 
         WHERE is_deleted = false ${typeFilter}
         LIMIT 2000`
      );
      candidates = result.rows;
    }
    
    // Perform fuzzy matching
    const matches = findBestMatches(
      name,
      candidates.map((c: any) => ({ id: c.id, name: c.name })),
      similarityThreshold,
      maxResults
    );
    
    // Enrich results with full company data
    const enrichedMatches = matches.map(match => {
      const fullData = candidates.find((c: any) => c.id === match.id);
      return {
        ...match,
        is_supplier: fullData?.is_supplier || false,
        is_customer: fullData?.is_customer || false,
        is_shipping_line: fullData?.is_shipping_line || false,
        country: fullData?.country || null,
      };
    });
    
    logger.info(`[Companies] Fuzzy match for "${name}": found ${enrichedMatches.length} matches above ${similarityThreshold} threshold`);
    if (enrichedMatches.length > 0) {
      logger.info(`  Best match: "${enrichedMatches[0].name}" (score: ${(enrichedMatches[0].score * 100).toFixed(1)}%)`);
    }
    
    res.json({
      searchedName: name,
      normalizedName: normalizedSearch,
      threshold: similarityThreshold,
      matches: enrichedMatches,
      hasGoodMatch: enrichedMatches.length > 0 && enrichedMatches[0].score >= 0.7,
      bestMatch: enrichedMatches.length > 0 ? enrichedMatches[0] : null,
    });
  } catch (error) {
    logger.error('[Companies] Fuzzy match error:', error);
    next(error);
  }
});

// GET /api/companies - List all companies
router.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '50', search } = req.query;
    
    // Using v_shipments_complete view which joins all normalized shipment tables
    let query = `
      SELECT c.*,
        s_last.product_text as last_product,
        s_last.created_at as last_purchase_date
      FROM master_data.companies c
      LEFT JOIN LATERAL (
        SELECT product_text, created_at
        FROM logistics.v_shipments_complete
        WHERE (supplier_id = c.id OR customer_id = c.id)
          AND transaction_type = 'incoming'
        ORDER BY created_at DESC
        LIMIT 1
      ) s_last ON true
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
        REPLACE(REPLACE(REPLACE(LOWER(c.name), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        LOWER(c.country) LIKE LOWER($${originalParam})
      )`;
    }
    
    query += ` ORDER BY c.name`;
    
    const offset = (Number(page) - 1) * Number(limit);
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM master_data.companies WHERE 1=1';
    const countParams: any[] = [];
    if (search) {
      const normalized = (search as string).replace(/[-_\s]/g, '').toLowerCase();
      countParams.push(`%${normalized}%`);
      const normalizedParam = countParams.length;
      countParams.push(`%${search}%`);
      const originalParam = countParams.length;
      countQuery += ` AND (
        REPLACE(REPLACE(REPLACE(LOWER(name), '-', ''), '_', ''), ' ', '') LIKE $${normalizedParam} OR
        LOWER(country) LIKE LOWER($${originalParam})
      )`;
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

// GET /api/companies/:id - Get single company
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM master_data.companies WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/companies/suppliers - List suppliers only
router.get('/type/suppliers', async (req, res, next) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    // Using v_shipments_complete view which joins all normalized shipment tables
    const result = await pool.query(
      `SELECT c.*,
         s_last.product_text as last_product,
         s_last.created_at as last_purchase_date
       FROM master_data.companies c
       LEFT JOIN LATERAL (
         SELECT product_text, created_at
         FROM logistics.v_shipments_complete
         WHERE supplier_id = c.id
           AND transaction_type = 'incoming'
         ORDER BY created_at DESC
         LIMIT 1
       ) s_last ON true
       WHERE c.is_supplier = true 
       ORDER BY c.name 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM master_data.companies WHERE is_supplier = true'
    );
    
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

// GET /api/companies/shipping-lines - List shipping lines only
router.get('/type/shipping-lines', async (req, res, next) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    const result = await pool.query(
      `SELECT * FROM master_data.companies 
       WHERE is_shipping_line = true 
       ORDER BY name 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM master_data.companies WHERE is_shipping_line = true'
    );
    
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

// PATCH /api/companies/:id/banking - Update company banking and product categories
router.patch('/:id/banking', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { banking: bankingInfo, product_categories } = req.body;
    
    // Validate that company exists
    const companyCheck = await pool.query(
      'SELECT id, extra_json FROM master_data.companies WHERE id = $1',
      [id]
    );
    
    if (companyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    // Get current extra_json
    const currentExtraJson = companyCheck.rows[0].extra_json || {};
    
    // Add audit fields to banking info
    const updatedBankingInfo = bankingInfo ? {
      ...bankingInfo,
      last_updated: new Date().toISOString(),
      updated_by: 'system', // TODO: Replace with actual user ID from auth
    } : currentExtraJson.banking;
    
    // Merge both banking info and product categories into extra_json
    const updatedExtraJson = {
      ...currentExtraJson,
      banking: updatedBankingInfo,
      product_categories: product_categories || currentExtraJson.product_categories || [],
    };
    
    // Update company
    const result = await pool.query(
      `UPDATE master_data.companies 
       SET extra_json = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(updatedExtraJson), id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating company info:', error);
    next(error);
  }
});

// POST /api/companies - Create a new company (for auto-creation from OCR extraction)
// Now uses fuzzy matching to avoid creating duplicates
router.post('/', async (req, res, next) => {
  try {
    const { 
      name, 
      country, 
      is_supplier = false, 
      is_customer = false, 
      is_shipping_line = false,
      is_forwarder = false,
      skip_fuzzy_match = false  // Option to skip fuzzy matching for manual entry
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    
    // First, check exact match (case-insensitive)
    const exactMatchResult = await pool.query(
      `SELECT * FROM master_data.companies 
       WHERE LOWER(name) = LOWER($1) 
       AND is_deleted = false
       LIMIT 1`,
      [name]
    );
    
    if (exactMatchResult.rows.length > 0) {
      // Exact match found - return existing company
      const existing = exactMatchResult.rows[0];
      
      // Update the company type flags if needed
      if ((is_shipping_line && !existing.is_shipping_line) || 
          (is_supplier && !existing.is_supplier) ||
          (is_customer && !existing.is_customer)) {
        await pool.query(
          `UPDATE master_data.companies SET 
            is_shipping_line = is_shipping_line OR $1,
            is_supplier = is_supplier OR $2,
            is_customer = is_customer OR $3,
            updated_at = NOW()
           WHERE id = $4`,
          [is_shipping_line, is_supplier, is_customer, existing.id]
        );
      }
      
      logger.info(`[Companies] Exact match found for "${name}": returning existing "${existing.name}"`);
      return res.json({ 
        data: { ...existing, is_shipping_line: existing.is_shipping_line || is_shipping_line },
        created: false,
        matched: true,
        matchType: 'exact',
        message: 'Company already exists (exact match)' 
      });
    }
    
    // If not skipping fuzzy match, check for similar companies
    if (!skip_fuzzy_match) {
      // Fetch candidates for fuzzy matching
      const normalizedName = normalizeCompanyName(name);
      const searchTokens = normalizedName.split(' ').filter(t => t.length > 2);
      
      let candidates;
      if (searchTokens.length > 0) {
        const firstToken = searchTokens[0];
        const result = await pool.query(
          `SELECT id, name, is_supplier, is_customer, is_shipping_line, country
           FROM master_data.companies 
           WHERE is_deleted = false
           AND LOWER(name) LIKE $1
           LIMIT 500`,
          [`%${firstToken}%`]
        );
        candidates = result.rows;
      } else {
        candidates = [];
      }
      
      if (candidates.length > 0) {
        // Find best match with 70% threshold
        const matches = findBestMatches(
          name,
          candidates.map((c: any) => ({ id: c.id, name: c.name })),
          0.70,  // 70% similarity threshold
          1
        );
        
        if (matches.length > 0) {
          const bestMatch = candidates.find((c: any) => c.id === matches[0].id);
          
          logger.info(`[Companies] Fuzzy match found for "${name}": "${bestMatch.name}" (${(matches[0].score * 100).toFixed(1)}% similar)`);
          
          // Update flags if needed
          if ((is_shipping_line && !bestMatch.is_shipping_line) || 
              (is_supplier && !bestMatch.is_supplier) ||
              (is_customer && !bestMatch.is_customer)) {
            await pool.query(
              `UPDATE master_data.companies SET 
                is_shipping_line = is_shipping_line OR $1,
                is_supplier = is_supplier OR $2,
                is_customer = is_customer OR $3,
                updated_at = NOW()
               WHERE id = $4`,
              [is_shipping_line, is_supplier, is_customer, bestMatch.id]
            );
          }
          
          return res.json({ 
            data: { ...bestMatch, is_shipping_line: bestMatch.is_shipping_line || is_shipping_line },
            created: false,
            matched: true,
            matchType: 'fuzzy',
            matchScore: matches[0].score,
            originalName: name,
            message: `Matched to existing company "${bestMatch.name}" (${(matches[0].score * 100).toFixed(0)}% similar)` 
          });
        }
      }
    }
    
    // No match found - create new company
    const result = await pool.query(
      `INSERT INTO master_data.companies (name, country, is_supplier, is_customer, is_shipping_line, is_forwarder)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, country || null, is_supplier, is_customer, is_shipping_line, is_forwarder]
    );
    
    logger.info(`[Companies] Created new company: "${name}" (no match found above 70% threshold)`);
    
    res.status(201).json({ 
      data: result.rows[0], 
      created: true,
      matched: false,
      message: 'Company created successfully' 
    });
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      const existingResult = await pool.query(
        `SELECT * FROM master_data.companies WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [req.body.name]
      );
      if (existingResult.rows.length > 0) {
        return res.json({ 
          data: existingResult.rows[0], 
          created: false,
          matched: true,
          matchType: 'exact',
          message: 'Company already exists' 
        });
      }
    }
    next(error);
  }
});

export default router;

