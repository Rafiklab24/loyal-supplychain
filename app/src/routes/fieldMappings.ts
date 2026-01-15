/**
 * Field Mappings API Routes
 * Handles CRUD operations for field mapping audit data
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import logger from '../utils/logger';

const router = Router();

// Path to the field mappings JSON file
const MAPPINGS_FILE = path.join(process.cwd(), '..', 'tools', 'field-mappings.json');
const AUDIT_SCRIPT = path.join(process.cwd(), '..', 'tools', 'field-mapping-audit.ts');

// ============================================================
// Types
// ============================================================

interface FieldMapping {
  id: string;
  module: string;
  component: string;
  frontend_field: string;
  api_field: string;
  db_table: string;
  db_column: string;
  data_type: string;
  required: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'deprecated' | 'mismatch';
  notes: string;
}

interface AuditReport {
  generated_at: string;
  version: string;
  summary: {
    total_components: number;
    total_fields: number;
    by_status: Record<string, number>;
    by_module: Record<string, number>;
  };
  components: {
    component: string;
    path: string;
    module: string;
    fields: FieldMapping[];
    total_fields: number;
  }[];
  mismatches: FieldMapping[];
  deprecated_fields: FieldMapping[];
}

// ============================================================
// Helper Functions
// ============================================================

function loadMappings(): AuditReport | null {
  try {
    if (!fs.existsSync(MAPPINGS_FILE)) {
      logger.warn('Field mappings file not found:', MAPPINGS_FILE);
      return null;
    }
    const content = fs.readFileSync(MAPPINGS_FILE, 'utf-8');
    return JSON.parse(content) as AuditReport;
  } catch (error) {
    logger.error('Error loading field mappings:', error);
    return null;
  }
}

function saveMappings(data: AuditReport): boolean {
  try {
    fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logger.error('Error saving field mappings:', error);
    return false;
  }
}

function recalculateSummary(data: AuditReport): void {
  const byStatus: Record<string, number> = {};
  const byModule: Record<string, number> = {};
  let totalFields = 0;

  data.components.forEach(comp => {
    comp.fields.forEach(field => {
      totalFields++;
      byStatus[field.status] = (byStatus[field.status] || 0) + 1;
      byModule[field.module] = (byModule[field.module] || 0) + 1;
    });
  });

  data.summary.total_fields = totalFields;
  data.summary.by_status = byStatus;
  data.summary.by_module = byModule;
  
  // Update mismatches and deprecated
  const allFields = data.components.flatMap(c => c.fields);
  data.mismatches = allFields.filter(f => f.status === 'mismatch');
  data.deprecated_fields = allFields.filter(f => f.status === 'deprecated');
}

// ============================================================
// Routes
// ============================================================

/**
 * @route GET /api/field-mappings
 * @desc Get all field mappings with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = loadMappings();
    
    if (!data) {
      return res.status(404).json({
        error: 'Field mappings not found',
        message: 'Run the audit script first: npx ts-node tools/field-mapping-audit.ts'
      });
    }
    
    // Apply filters if provided
    const { module, status, component, search } = req.query;
    
    if (module || status || component || search) {
      const filteredComponents = data.components.map(comp => {
        let fields = comp.fields;
        
        if (module && module !== 'all') {
          fields = fields.filter(f => f.module === module);
        }
        
        if (status && status !== 'all') {
          fields = fields.filter(f => f.status === status);
        }
        
        if (component) {
          fields = fields.filter(f => f.component.toLowerCase().includes((component as string).toLowerCase()));
        }
        
        if (search) {
          const searchLower = (search as string).toLowerCase();
          fields = fields.filter(f => 
            f.frontend_field.toLowerCase().includes(searchLower) ||
            f.api_field.toLowerCase().includes(searchLower) ||
            f.db_table.toLowerCase().includes(searchLower) ||
            f.db_column.toLowerCase().includes(searchLower)
          );
        }
        
        return { ...comp, fields, total_fields: fields.length };
      }).filter(comp => comp.fields.length > 0);
      
      // Recalculate summary for filtered data
      const filteredData: AuditReport = {
        ...data,
        components: filteredComponents,
      };
      recalculateSummary(filteredData);
      
      return res.json(filteredData);
    }
    
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching field mappings:', error);
    res.status(500).json({ error: 'Failed to fetch field mappings', details: error.message });
  }
});

/**
 * @route GET /api/field-mappings/summary
 * @desc Get summary statistics for field mappings
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const data = loadMappings();
    
    if (!data) {
      return res.status(404).json({ error: 'Field mappings not found' });
    }
    
    res.json({
      generated_at: data.generated_at,
      version: data.version,
      summary: data.summary,
    });
  } catch (error: any) {
    logger.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary', details: error.message });
  }
});

/**
 * @route POST /api/field-mappings/refresh
 * @desc Re-run the field mapping audit
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Run the audit script
    const projectRoot = path.join(process.cwd(), '..');
    
    logger.info('Running field mapping audit...');
    execSync(`npx ts-node tools/field-mapping-audit.ts`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    // Load and return the new data
    const data = loadMappings();
    
    if (!data) {
      return res.status(500).json({ error: 'Audit completed but failed to load results' });
    }
    
    res.json({
      success: true,
      message: 'Field mapping audit completed',
      data,
    });
  } catch (error: any) {
    logger.error('Error running audit:', error);
    res.status(500).json({
      error: 'Failed to run audit',
      details: error.message,
      stderr: error.stderr,
    });
  }
});

/**
 * @route PUT /api/field-mappings/bulk-update
 * @desc Update multiple field mappings at once
 * NOTE: This route MUST come before /:id to avoid route conflicts
 */
router.put('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { ids, status, notes } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    
    const data = loadMappings();
    
    if (!data) {
      return res.status(404).json({ error: 'Field mappings not found' });
    }
    
    const idSet = new Set(ids);
    let updatedCount = 0;
    
    for (const comp of data.components) {
      for (const field of comp.fields) {
        if (idSet.has(field.id)) {
          if (status) field.status = status;
          if (notes !== undefined) field.notes = notes;
          updatedCount++;
        }
      }
    }
    
    // Recalculate summary
    recalculateSummary(data);
    
    // Save changes
    if (!saveMappings(data)) {
      return res.status(500).json({ error: 'Failed to save changes' });
    }
    
    res.json({
      success: true,
      message: `Updated ${updatedCount} field mappings`,
      updated_count: updatedCount,
    });
  } catch (error: any) {
    logger.error('Error bulk updating field mappings:', error);
    res.status(500).json({ error: 'Failed to bulk update', details: error.message });
  }
});

/**
 * @route GET /api/field-mappings/export/json
 * @desc Export field mappings as JSON file
 * NOTE: This route MUST come before /:id to avoid route conflicts
 */
router.get('/export/json', async (req: Request, res: Response) => {
  try {
    const data = loadMappings();
    
    if (!data) {
      return res.status(404).json({ error: 'Field mappings not found' });
    }
    
    // Filter by status if requested
    const { status } = req.query;
    
    if (status && status !== 'all') {
      const filteredComponents = data.components.map(comp => ({
        ...comp,
        fields: comp.fields.filter(f => f.status === status),
      })).filter(comp => comp.fields.length > 0);
      
      const filteredData = { ...data, components: filteredComponents };
      recalculateSummary(filteredData);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="field-mappings-${status}.json"`);
      return res.send(JSON.stringify(filteredData, null, 2));
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="field-mappings.json"');
    res.send(JSON.stringify(data, null, 2));
  } catch (error: any) {
    logger.error('Error exporting field mappings:', error);
    res.status(500).json({ error: 'Failed to export', details: error.message });
  }
});

/**
 * @route GET /api/field-mappings/mismatches
 * @desc Get only mismatched fields
 * NOTE: This route MUST come before /:id to avoid route conflicts
 */
router.get('/mismatches', async (req: Request, res: Response) => {
  try {
    const data = loadMappings();
    
    if (!data) {
      return res.status(404).json({ error: 'Field mappings not found' });
    }
    
    res.json({
      count: data.mismatches.length,
      mismatches: data.mismatches,
    });
  } catch (error: any) {
    logger.error('Error fetching mismatches:', error);
    res.status(500).json({ error: 'Failed to fetch mismatches', details: error.message });
  }
});

/**
 * @route GET /api/field-mappings/:id
 * @desc Get a single field mapping by ID
 * NOTE: Parameterized routes must come AFTER static routes
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = loadMappings();
    
    if (!data) {
      return res.status(404).json({ error: 'Field mappings not found' });
    }
    
    for (const comp of data.components) {
      const field = comp.fields.find(f => f.id === id);
      if (field) {
        return res.json(field);
      }
    }
    
    res.status(404).json({ error: 'Field mapping not found' });
  } catch (error: any) {
    logger.error('Error fetching field mapping:', error);
    res.status(500).json({ error: 'Failed to fetch field mapping', details: error.message });
  }
});

/**
 * @route PUT /api/field-mappings/:id
 * @desc Update a single field mapping
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const data = loadMappings();
    
    if (!data) {
      return res.status(404).json({ error: 'Field mappings not found' });
    }
    
    let found = false;
    
    for (const comp of data.components) {
      const fieldIndex = comp.fields.findIndex(f => f.id === id);
      if (fieldIndex !== -1) {
        // Only allow updating certain fields
        const allowedUpdates = ['status', 'notes', 'db_table', 'db_column', 'data_type'];
        for (const key of allowedUpdates) {
          if (updates[key] !== undefined) {
            (comp.fields[fieldIndex] as any)[key] = updates[key];
          }
        }
        found = true;
        break;
      }
    }
    
    if (!found) {
      return res.status(404).json({ error: 'Field mapping not found' });
    }
    
    // Recalculate summary
    recalculateSummary(data);
    
    // Save changes
    if (!saveMappings(data)) {
      return res.status(500).json({ error: 'Failed to save changes' });
    }
    
    res.json({ success: true, message: 'Field mapping updated' });
  } catch (error: any) {
    logger.error('Error updating field mapping:', error);
    res.status(500).json({ error: 'Failed to update field mapping', details: error.message });
  }
});

export default router;

