// Load environment variables from .env file
import 'dotenv/config';

// Validate environment variables (must be imported before anything else)
import './config/env';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'http';
import { env } from './config/env';
import logger from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import healthRoutes, { setShuttingDown } from './routes/health';
import shipmentsRoutes from './routes/shipments';
import companiesRoutes from './routes/companies';
import transfersRoutes from './routes/transfers';
import portsRoutes from './routes/ports';
import notificationsRoutes from './routes/notifications';
import contractsRoutes from './routes/contracts';
import proformasRoutes from './routes/proformas';
import fundsRoutes from './routes/funds';
import auditsRoutes from './routes/audits';
import financeRoutes from './routes/finance';
import blackdayRoutes from './routes/blackday';
import customsClearingCostsRoutes from './routes/customsClearingCosts';
import customsClearingBatchesRoutes from './routes/customsClearingBatches';
import landTransportRoutes from './routes/landTransport';
import productsRoutes from './routes/products';
import accountingRoutes from './routes/accounting';
import branchesRoutes from './routes/branches';
import fieldMappingsRoutes from './routes/fieldMappings';
import efaturaRoutes from './routes/efatura';
import documentsRoutes from './routes/documents';
import borderCrossingsRoutes from './routes/borderCrossings';
import inventoryRoutes from './routes/inventory';
import qualityIncidentsRoutes from './routes/qualityIncidents';
import cafeRoutes from './routes/cafe';
import cashboxRoutes from './routes/cashbox';
import trademarksRoutes from './routes/trademarks';
import translateRoutes from './routes/translate';
import certificatesRoutes from './routes/certificates';
import dashboardRoutes from './routes/dashboard';
import antrepoRoutes from './routes/antrepo';
import elleclemeRoutes from './routes/ellecleme';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { requestTimeout } from './middleware/timeout';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { authenticateToken } from './middleware/auth';
import { checkBlackDayMode, checkAccountLocked } from './middleware/blackday';
import { 
  setDatabaseUserContext, 
  sanitizeRequestBody, 
  additionalSecurityHeaders,
  blockSuspiciousIPs,
  detectTokenTheft 
} from './middleware/security';
import { RATE_LIMIT, REQUEST_LIMITS } from './config/constants';

// Import scheduler
import { initializeScheduler } from './services/scheduler';

// Import Swagger
import { setupSwagger } from './swagger';

const app = express();
const PORT = env.PORT;

// Trust proxy - essential when behind reverse proxy (Caddy, nginx, etc.)
// This ensures rate limiting uses the real client IP from X-Forwarded-For header
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Request ID middleware (must be early in the chain for logging and tracing)
app.use(requestIdMiddleware);

// Request timeout middleware (must be early to catch all requests)
app.use(requestTimeout);

// Metrics middleware (must be early to track all requests)
app.use(metricsMiddleware);

// Rate limiting - always enabled, with different limits per environment
const limiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: env.NODE_ENV === 'production' ? RATE_LIMIT.MAX_REQUESTS_PROD : RATE_LIMIT.MAX_REQUESTS_DEV,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Always enable rate limiting (not just in production)
app.use(limiter);

// Stricter rate limiting for login/register endpoints
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_AUTH_ATTEMPTS,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  // Only apply to login and register routes
  skip: (req) => {
    const path = req.path.toLowerCase();
    return !path.includes('/login') && !path.includes('/register');
  },
});

// Stricter rate limiting for password reset
// Note: passwordResetLimiter can be applied to password reset routes if needed
// const passwordResetLimiter = rateLimit({
//   windowMs: RATE_LIMIT.PASSWORD_RESET_WINDOW_MS,
//   max: RATE_LIMIT.MAX_PASSWORD_RESET_ATTEMPTS,
//   message: 'Too many password reset attempts, please try again later.',
// });

// Stricter rate limiting for document upload
const documentUploadLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_DOCUMENT_UPLOADS,
  message: 'Too many document uploads, please try again later.',
});

// CORS middleware - environment-based configuration
app.use(cors({
  origin: (origin, callback) => {
    if (env.NODE_ENV === 'production') {
      // Production: Only allow whitelisted origins
      const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS: Blocked request from unauthorized origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Development: Allow all origins but log warning
      if (origin) {
        logger.debug(`CORS: Allowing origin ${origin} in development`);
      }
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware with size limits
app.use(express.json({ limit: REQUEST_LIMITS.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_LIMITS.URL_ENCODED_LIMIT }));

// Static file serving for uploads
import path from 'path';
const QUALITY_MEDIA_PATH = process.env.QUALITY_MEDIA_PATH || 
  path.resolve(__dirname, '../storage/quality-media');
app.use('/uploads/quality', express.static(QUALITY_MEDIA_PATH));

// Security middleware - additional headers and input sanitization
app.use(additionalSecurityHeaders);
app.use(sanitizeRequestBody);

// Block suspicious IPs (in production)
if (process.env.NODE_ENV === 'production') {
  app.use(blockSuspiciousIPs);
}

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Black Day protection middleware
app.use(checkBlackDayMode);
app.use(checkAccountLocked);

// Public routes (no authentication required)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/health', healthRoutes); // Health check should be public for monitoring
app.use('/api/blackday', blackdayRoutes); // Emergency shutdown system (special auth)
app.get('/metrics', metricsHandler); // Prometheus metrics endpoint (public for monitoring)

// API Version 1 routes (recommended)
// Public routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/blackday', blackdayRoutes);

// Protected v1 routes (authentication required)
// Security chain: authenticate -> detect token theft -> set DB context -> route handler
app.use('/api/v1/shipments', authenticateToken, detectTokenTheft, setDatabaseUserContext, shipmentsRoutes);
app.use('/api/v1/companies', authenticateToken, detectTokenTheft, setDatabaseUserContext, companiesRoutes);
app.use('/api/v1/transfers', authenticateToken, detectTokenTheft, setDatabaseUserContext, transfersRoutes);
app.use('/api/v1/ports', authenticateToken, detectTokenTheft, setDatabaseUserContext, portsRoutes);
app.use('/api/v1/notifications', authenticateToken, detectTokenTheft, setDatabaseUserContext, notificationsRoutes);
app.use('/api/v1/contracts', authenticateToken, detectTokenTheft, setDatabaseUserContext, contractsRoutes);
app.use('/api/v1/proformas', authenticateToken, detectTokenTheft, setDatabaseUserContext, proformasRoutes);
app.use('/api/v1/funds', authenticateToken, detectTokenTheft, setDatabaseUserContext, fundsRoutes);
app.use('/api/v1/audit-log', authenticateToken, detectTokenTheft, setDatabaseUserContext, auditsRoutes);
app.use('/api/v1/finance', authenticateToken, detectTokenTheft, setDatabaseUserContext, financeRoutes);
app.use('/api/v1/customs-clearing-costs', authenticateToken, detectTokenTheft, setDatabaseUserContext, customsClearingCostsRoutes);
app.use('/api/v1/customs-clearing-batches', authenticateToken, detectTokenTheft, setDatabaseUserContext, customsClearingBatchesRoutes);
app.use('/api/v1/land-transport', authenticateToken, detectTokenTheft, setDatabaseUserContext, landTransportRoutes);
app.use('/api/v1/products', authenticateToken, detectTokenTheft, setDatabaseUserContext, productsRoutes);
app.use('/api/v1/accounting', authenticateToken, detectTokenTheft, setDatabaseUserContext, accountingRoutes);
app.use('/api/v1/branches', authenticateToken, detectTokenTheft, setDatabaseUserContext, branchesRoutes);
app.use('/api/v1/field-mappings', authenticateToken, detectTokenTheft, setDatabaseUserContext, fieldMappingsRoutes);
app.use('/api/v1/e-fatura', authenticateToken, detectTokenTheft, setDatabaseUserContext, efaturaRoutes);
app.use('/api/v1/documents', documentUploadLimiter, authenticateToken, detectTokenTheft, setDatabaseUserContext, documentsRoutes);
app.use('/api/v1/border-crossings', authenticateToken, detectTokenTheft, setDatabaseUserContext, borderCrossingsRoutes);
app.use('/api/v1/inventory', authenticateToken, detectTokenTheft, setDatabaseUserContext, inventoryRoutes);
app.use('/api/v1/quality-incidents', authenticateToken, detectTokenTheft, setDatabaseUserContext, qualityIncidentsRoutes);
app.use('/api/v1/cafe', authenticateToken, detectTokenTheft, setDatabaseUserContext, cafeRoutes);
app.use('/api/v1/cashbox', authenticateToken, detectTokenTheft, setDatabaseUserContext, cashboxRoutes);
app.use('/api/v1/trademarks', authenticateToken, detectTokenTheft, setDatabaseUserContext, trademarksRoutes);
app.use('/api/v1/translate', authenticateToken, detectTokenTheft, setDatabaseUserContext, translateRoutes);
app.use('/api/v1/certificates', authenticateToken, detectTokenTheft, setDatabaseUserContext, certificatesRoutes);
app.use('/api/v1/dashboard', authenticateToken, detectTokenTheft, setDatabaseUserContext, dashboardRoutes);
app.use('/api/v1/antrepo', authenticateToken, detectTokenTheft, setDatabaseUserContext, antrepoRoutes);
app.use('/api/v1/ellecleme', authenticateToken, detectTokenTheft, setDatabaseUserContext, elleclemeRoutes);

// Legacy routes (deprecated - use /api/v1/* instead)
// These routes will log deprecation warnings and redirect to v1
const deprecationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.warn('Legacy API endpoint used', { 
    path: req.path, 
    method: req.method,
    recommended: req.path.replace('/api/', '/api/v1/'),
  });
  // Add deprecation header
  res.set('X-API-Deprecated', 'true');
  res.set('X-API-Version-Recommended', 'v1');
  next();
};

app.use('/api/shipments', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, shipmentsRoutes);
app.use('/api/companies', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, companiesRoutes);
app.use('/api/transfers', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, transfersRoutes);
app.use('/api/ports', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, portsRoutes);
app.use('/api/notifications', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, notificationsRoutes);
app.use('/api/contracts', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, contractsRoutes);
app.use('/api/proformas', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, proformasRoutes);
app.use('/api/funds', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, fundsRoutes);
app.use('/api/audit-log', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, auditsRoutes);
app.use('/api/finance', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, financeRoutes);
app.use('/api/customs-clearing-costs', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, customsClearingCostsRoutes);
app.use('/api/customs-clearing-batches', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, customsClearingBatchesRoutes);
app.use('/api/land-transport', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, landTransportRoutes);
app.use('/api/products', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, productsRoutes);
app.use('/api/accounting', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, accountingRoutes);
app.use('/api/branches', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, branchesRoutes);
app.use('/api/field-mappings', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, fieldMappingsRoutes);
app.use('/api/e-fatura', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, efaturaRoutes);
app.use('/api/documents', deprecationMiddleware, documentUploadLimiter, authenticateToken, detectTokenTheft, setDatabaseUserContext, documentsRoutes);
app.use('/api/border-crossings', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, borderCrossingsRoutes);
app.use('/api/inventory', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, inventoryRoutes);
app.use('/api/quality-incidents', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, qualityIncidentsRoutes);
app.use('/api/cafe', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, cafeRoutes);
app.use('/api/cashbox', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, cashboxRoutes);
app.use('/api/trademarks', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, trademarksRoutes);
app.use('/api/translate', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, translateRoutes);
app.use('/api/certificates', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, certificatesRoutes);
app.use('/api/dashboard', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, dashboardRoutes);
app.use('/api/antrepo', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, antrepoRoutes);
app.use('/api/ellecleme', deprecationMiddleware, authenticateToken, detectTokenTheft, setDatabaseUserContext, elleclemeRoutes);

// Setup Swagger documentation
setupSwagger(app);

// Root route
app.get('/', (_req, res) => {
  res.json({
    message: 'Loyal Supply Chain API',
    version: '1.0.0',
    apiVersion: 'v1',
    endpoints: {
      v1: {
        auth: '/api/v1/auth/login',
        health: '/api/v1/health',
        stats: '/api/v1/health/stats',
        shipments: '/api/v1/shipments',
        companies: '/api/v1/companies',
        transfers: '/api/v1/transfers',
        ports: '/api/v1/ports',
        notifications: '/api/v1/notifications',
        contracts: '/api/v1/contracts',
        proformas: '/api/v1/proformas',
        funds: '/api/v1/funds',
        auditLog: '/api/v1/audit-log',
        finance: '/api/v1/finance',
        customsClearingCosts: '/api/v1/customs-clearing-costs',
        customsClearingBatches: '/api/v1/customs-clearing-batches',
        landTransport: '/api/v1/land-transport',
        products: '/api/v1/products',
        efatura: '/api/v1/e-fatura',
        documents: '/api/v1/documents',
      },
      legacy: {
        note: 'Legacy endpoints at /api/* are deprecated. Please migrate to /api/v1/*',
      health: '/api/health',
      stats: '/api/health/stats',
      },
    },
    documentation: '/api-docs',
    metrics: '/metrics',
    note: 'Most endpoints require authentication. Use /api/v1/auth/login to get a JWT token.',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Store server reference for graceful shutdown
let server: Server;
let isShuttingDown = false;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  setShuttingDown(true);
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed');

    // Close database pool
    const { pool } = require('./db/client');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 second timeout
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  gracefulShutdown('unhandledRejection');
});

// Start server - bind to 0.0.0.0 to allow network access
server = app.listen(Number(PORT), '0.0.0.0', () => {
  logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Loyal Supply Chain API Server                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

✓ Server running on port ${PORT}
✓ Environment: ${env.NODE_ENV}
✓ Database: ${env.DATABASE_URL ? 'Connected' : 'Not configured'}

📚 API Documentation:
   http://localhost:${PORT}/
   http://localhost:${PORT}/api/health
   http://localhost:${PORT}/api/shipments
   http://localhost:${PORT}/api/companies
   http://localhost:${PORT}/api/transfers
   http://localhost:${PORT}/api/ports
   http://localhost:${PORT}/api/notifications
   http://localhost:${PORT}/api/contracts
   http://localhost:${PORT}/api/proformas
   http://localhost:${PORT}/api/funds
   http://localhost:${PORT}/api/audit-log
   http://localhost:${PORT}/api/customs-clearing-costs
   http://localhost:${PORT}/api/customs-clearing-batches
   http://localhost:${PORT}/api/land-transport
   http://localhost:${PORT}/api/products

Press Ctrl+C to stop
  `);
  
  // Initialize notification scheduler
  initializeScheduler();
});

// Export shutdown state for health checks
export { isShuttingDown };

export default app;
