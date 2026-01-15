import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';

// Middleware to check if system is in Black Day mode
export async function checkBlackDayMode(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Skip check for blackday routes
    if (req.path.startsWith('/api/blackday')) {
      return next();
    }

    // Check if maintenance mode is active
    const result = await pool.query(`
      SELECT enabled FROM system.maintenance_mode 
      WHERE id = 1 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);

    const maintenanceMode = result.rows[0]?.enabled || false;

    if (maintenanceMode) {
      // System is in Black Day mode
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'System is currently in maintenance mode',
        code: 'BLACK_DAY_ACTIVE',
        recovery: 'Contact system administrator (blackadmin) for recovery',
      });
    }

    next();
  } catch (error) {
    // If table doesn't exist, system is not in maintenance mode
    next();
  }
}

// Middleware to check if user account is locked
export async function checkAccountLocked(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Only check on login routes
    if (!req.path.includes('/auth/login')) {
      return next();
    }

    const { username } = req.body;

    if (!username) {
      return next();
    }

    // Check if account is locked
    const result = await pool.query(`
      SELECT is_locked FROM security.users WHERE username = $1
    `, [username]);

    if (result.rows[0]?.is_locked) {
      return res.status(403).json({
        error: 'Account Locked',
        message: 'This account has been locked due to system emergency protocol',
        code: 'ACCOUNT_LOCKED',
      });
    }

    next();
  } catch (error) {
    // If column doesn't exist, account locking is not active
    next();
  }
}

