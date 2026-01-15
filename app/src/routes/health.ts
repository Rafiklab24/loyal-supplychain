import { Router, Request } from 'express';
import { pool, checkPoolHealth, getPoolMetrics } from '../db/client';
import { authenticateToken } from '../middleware/auth';
import { loadUserBranches, buildShipmentBranchFilter, BranchFilterRequest } from '../middleware/branchFilter';
import { checkOpenAIConnection } from '../services/openai';
import { checkDiskSpaceInfo, checkMemoryUsage } from '../utils/system';
import logger from '../utils/logger';

const router = Router();

// Import shutdown state from index.ts (will be set by graceful shutdown handler)
let isShuttingDown = false;

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Returns the health status of the API and database connection
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       503:
 *         description: API is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/health/live:
 *   get:
 *     summary: Liveness probe
 *     tags: [Health]
 *     description: Kubernetes liveness probe endpoint. Returns 200 if the application is running.
 *     responses:
 *       200:
 *         description: Application is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: alive
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Application is shutting down
 */

/**
 * @swagger
 * /api/v1/health/ready:
 *   get:
 *     summary: Readiness probe
 *     tags: [Health]
 *     description: Kubernetes readiness probe endpoint. Returns 200 if the application is ready to serve traffic.
 *     responses:
 *       200:
 *         description: Application is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         healthy:
 *                           type: boolean
 *                         message:
 *                           type: string
 *       503:
 *         description: Application is not ready
 */

export function setShuttingDown(value: boolean) {
  isShuttingDown = value;
}

// Liveness probe - is the app running?
router.get('/live', (_req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ 
      status: 'shutting_down',
      timestamp: new Date().toISOString(),
    });
  }
  res.json({ 
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe - is the app ready to serve traffic?
router.get('/ready', async (_req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ 
      status: 'not_ready',
      reason: 'shutting_down',
      timestamp: new Date().toISOString(),
    });
  }

  const checks = {
    database: { healthy: false, message: '' },
    openai: { healthy: false, message: '' },
    disk: { healthy: false, message: '' },
    memory: { healthy: false, message: '' },
  };

  // Check database
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;
    checks.database = { 
      healthy: true, 
      message: `Connected (${duration}ms)` 
    };
  } catch (error: any) {
    checks.database = { 
      healthy: false, 
      message: error.message || 'Connection failed' 
    };
  }

  // Check OpenAI (optional)
  try {
    if (process.env.OPENAI_API_KEY) {
      await checkOpenAIConnection();
      checks.openai = { healthy: true, message: 'Connected' };
    } else {
      checks.openai = { healthy: true, message: 'Not configured' };
    }
  } catch (error: any) {
    checks.openai = { 
      healthy: false, 
      message: error.message || 'Connection failed' 
    };
  }

  // Check disk space
  try {
    const diskInfo = await checkDiskSpaceInfo();
    const freeSpaceGB = parseFloat(diskInfo.freeGB);
    if (freeSpaceGB < 1) {
      checks.disk = { 
        healthy: false, 
        message: `Low disk space: ${diskInfo.freeGB}GB free` 
      };
    } else {
      checks.disk = { 
        healthy: true, 
        message: `${diskInfo.freeGB}GB free (${diskInfo.usedPercent}% used)` 
      };
    }
  } catch (error: any) {
    checks.disk = { 
      healthy: false, 
      message: error.message || 'Check failed' 
    };
  }

  // Check memory
  try {
    const memInfo = checkMemoryUsage();
    const utilization = parseFloat(memInfo.utilization);
    
    if (utilization > 90) {
      checks.memory = { 
        healthy: false, 
        message: `High memory usage: ${memInfo.heapUsed}MB (${memInfo.utilization}%)` 
      };
    } else {
      checks.memory = { 
        healthy: true, 
        message: `${memInfo.heapUsed}MB used (${memInfo.utilization}%)` 
      };
    }
  } catch (error: any) {
    checks.memory = { 
      healthy: false, 
      message: error.message || 'Check failed' 
    };
  }

  const allHealthy = Object.values(checks).every(c => c.healthy);
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/health - Detailed health check (public, no auth needed)
router.get('/', async (_req, res, _next) => {
  try {
    const start = Date.now();
    await pool.query('SELECT NOW()');
    const dbLatency = Date.now() - start;
    
    const poolHealth = await checkPoolHealth();
    const poolMetrics = getPoolMetrics();
    const memInfo = checkMemoryUsage();
    
    let diskInfo;
    let openaiCheck;
    
    try {
      diskInfo = await checkDiskSpaceInfo();
    } catch (error: any) {
      diskInfo = { error: error.message };
    }

    try {
      if (process.env.OPENAI_API_KEY) {
        await checkOpenAIConnection();
        openaiCheck = { healthy: true, message: 'Connected' };
      } else {
        openaiCheck = { healthy: true, message: 'Not configured' };
      }
    } catch (error: any) {
      openaiCheck = { healthy: false, message: error.message };
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: {
          healthy: true,
          latency: `${dbLatency}ms`,
          pool: poolHealth,
          metrics: poolMetrics,
        },
        openai: openaiCheck,
        disk: diskInfo,
        memory: memInfo,
      },
    });
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
    });
  }
});

// GET /api/health/stats - Dashboard statistics (authenticated + branch filtered)
// NOTE: Uses v_shipments_complete view which joins all normalized shipment tables
router.get('/stats', authenticateToken, loadUserBranches, async (req: Request, res, next) => {
  try {
    const branchReq = req as BranchFilterRequest;
    const branchFilter = buildShipmentBranchFilter(branchReq, 's');
    
    // Build WHERE clause for shipments (using the unified view)
    let shipmentWhere = 's.is_deleted = false';
    const params: any[] = [...branchFilter.params];
    
    if (branchFilter.clause !== '1=1') {
      shipmentWhere += ` AND ${branchFilter.clause}`;
    }

    // Stats with branch filtering - using v_shipments_complete view
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM logistics.v_shipments_complete s WHERE ${shipmentWhere}) as total_shipments,
        (SELECT COUNT(DISTINCT s.sn) FROM logistics.v_shipments_complete s WHERE ${shipmentWhere}) as unique_contracts,
        (SELECT COALESCE(SUM(s.container_count), 0) FROM logistics.v_shipments_complete s WHERE ${shipmentWhere}) as total_containers,
        (SELECT ROUND(COALESCE(SUM(s.weight_ton), 0)::numeric, 2) FROM logistics.v_shipments_complete s WHERE ${shipmentWhere}) as total_weight_tons,
        (SELECT ROUND(COALESCE(SUM(s.total_value_usd), 0)::numeric, 2) FROM logistics.v_shipments_complete s WHERE ${shipmentWhere} AND s.total_value_usd IS NOT NULL) as total_value_usd,
        (SELECT COUNT(*) FROM master_data.companies WHERE is_supplier = true) as total_suppliers,
        (SELECT COUNT(*) FROM master_data.companies WHERE is_shipping_line = true) as total_shipping_lines,
        (SELECT COUNT(*) FROM master_data.ports) as total_ports,
        (SELECT COUNT(*) FROM finance.transfers) as total_transfers
    `, params);

    const shipmentsByStatus = await pool.query(`
      SELECT s.status, COUNT(*) as count
      FROM logistics.v_shipments_complete s
      WHERE s.status IS NOT NULL AND ${shipmentWhere}
      GROUP BY s.status
      ORDER BY count DESC
    `, params);

    const topOrigins = await pool.query(`
      SELECT p.name as port, COUNT(*) as shipment_count
      FROM logistics.v_shipments_complete s
      JOIN master_data.ports p ON s.pol_id = p.id
      WHERE ${shipmentWhere} AND s.pol_id IS NOT NULL
      GROUP BY p.name
      ORDER BY shipment_count DESC
      LIMIT 5
    `, params);

    const topDestinations = await pool.query(`
      SELECT p.name as port, COUNT(*) as shipment_count
      FROM logistics.v_shipments_complete s
      JOIN master_data.ports p ON s.pod_id = p.id
      WHERE ${shipmentWhere} AND s.pod_id IS NOT NULL
      GROUP BY p.name
      ORDER BY shipment_count DESC
      LIMIT 5
    `, params);

    res.json({
      overview: stats.rows[0],
      shipmentsByStatus: shipmentsByStatus.rows,
      topOrigins: topOrigins.rows,
      topDestinations: topDestinations.rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

