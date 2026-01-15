/**
 * Security Middleware - Defense in Depth
 * 
 * Provides multiple layers of security:
 * 1. Sets PostgreSQL session context for Row-Level Security (RLS)
 * 2. Logs security events for audit trail
 * 3. Detects and blocks suspicious activity
 * 4. Validates input to prevent injection attacks
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';
import { AuthRequest } from './auth';
import { createHash } from 'crypto';
import logger from '../utils/logger';

/**
 * Set PostgreSQL session context for Row-Level Security
 * This MUST be called after authentication for RLS policies to work
 */
export async function setDatabaseUserContext(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authReq = req as AuthRequest;
  
  try {
    if (authReq.user) {
      // Set the user context in PostgreSQL for RLS
      await pool.query(
        `SELECT security.set_current_user_context($1, $2)`,
        [authReq.user.id, authReq.user.role]
      );
    }
    next();
  } catch (error) {
    logger.error('Failed to set database user context', { error });
    // Continue anyway - RLS will fall back to restrictive mode
    next();
  }
}

/**
 * Log security events to the database
 */
export async function logSecurityEvent(
  eventType: 'login_success' | 'login_failed' | 'unauthorized_access' | 'suspicious_activity' | 'rls_violation',
  userId: string | null,
  username: string | null,
  req: Request,
  details?: Record<string, any>
): Promise<void> {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const endpoint = req.originalUrl || req.url;
    const method = req.method;

    await pool.query(
      `SELECT security.log_security_event($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventType,
        userId,
        username,
        ip,
        userAgent,
        endpoint,
        method,
        details ? JSON.stringify(details) : null
      ]
    );
  } catch (error) {
    logger.error('Failed to log security event', { error });
    // Don't throw - logging failure shouldn't break the request
  }
}

/**
 * Check for suspicious activity from an IP address
 */
export async function checkSuspiciousActivity(ip: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM security.suspicious_activity WHERE ip_address = $1::inet`,
      [ip]
    );
    return parseInt(result.rows[0]?.count || '0') > 0;
  } catch (error) {
    logger.error('Failed to check suspicious activity', { error });
    return false;
  }
}

/**
 * Middleware to block suspicious IPs
 */
export async function blockSuspiciousIPs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ip = req.ip || req.socket.remoteAddress;
  
  if (!ip) {
    return next();
  }

  try {
    const isSuspicious = await checkSuspiciousActivity(ip);
    
    if (isSuspicious) {
      logger.warn('Blocked suspicious IP', { ip });
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Your IP has been temporarily blocked due to suspicious activity. Please try again later.',
      });
    }
    
    next();
  } catch (error) {
    // Don't block on error - fail open for availability
    next();
  }
}

/**
 * Sanitize string input to prevent SQL injection
 * Note: We use parameterized queries, so this is an extra layer
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Remove common SQL injection patterns (extra layer on top of parameterized queries)
  const sqlPatterns = [
    /--/g,           // SQL comments
    /;/g,            // Statement terminator
    /\/\*/g,         // Block comment start
    /\*\//g,         // Block comment end
    /xp_/gi,         // SQL Server extended procedures
    /EXEC(\s|\()/gi, // EXEC statements
  ];
  
  for (const pattern of sqlPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized;
}

/**
 * Middleware to sanitize request body
 */
export function sanitizeRequestBody(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      sanitized[sanitizeInput(key)] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Middleware to validate UUID parameters
 */
export function validateUUIDParams(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      if (value && !isValidUUID(value)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid ${paramName} format`,
        });
      }
    }
    next();
  };
}

/**
 * Security headers middleware (supplementary to helmet)
 */
export function additionalSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent caching of authenticated responses
  if (req.headers.authorization) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
}

/**
 * Detect potential token theft (same token used from different IPs in short time)
 * Uses database-backed storage instead of in-memory Map for persistence and multi-instance support
 */
export async function detectTokenTheft(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authReq = req as AuthRequest;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token || !authReq.user) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  
  // Skip if IP is invalid for PostgreSQL INET type
  const ipPart = ip?.split(':')[0];
  if (!ip || ip === 'unknown' || !ipPart || !/^[\d.]+$/.test(ipPart)) {
    return next();
  }

  try {
    // Hash the token for storage (don't store full token)
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Record this usage in database
    // Extract IPv4 from IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 -> 192.168.1.1)
    const ipv4 = ip.includes('::ffff:') ? ip.split('::ffff:')[1] : ip.split(':')[0];
    
    await pool.query(
      `INSERT INTO security.token_usage (token_hash, ip_address, user_id, username, timestamp)
       VALUES ($1, $2::inet, $3, $4, now())`,
      [tokenHash, ipv4, authReq.user.id, authReq.user.username]
    );

    // Get all usages for this token in the last 5 minutes
    const usageResult = await pool.query(
      `SELECT DISTINCT ip_address::text as ip
       FROM security.token_usage
       WHERE token_hash = $1
         AND timestamp > now() - INTERVAL '5 minutes'`,
      [tokenHash]
    );

    const uniqueIPs = new Set(usageResult.rows.map((r: any) => r.ip));
    
    if (uniqueIPs.size > 2) {
      // Token used from more than 2 different IPs in 5 minutes - suspicious
      logger.warn('Potential token theft detected', {
        username: authReq.user.username,
        userId: authReq.user.id,
        ipCount: uniqueIPs.size,
        ips: Array.from(uniqueIPs),
      });
      
      await logSecurityEvent(
        'suspicious_activity',
        authReq.user.id,
        authReq.user.username,
        req,
        { 
          reason: 'token_used_from_multiple_ips', 
          ip_count: uniqueIPs.size,
          ips: Array.from(uniqueIPs)
        }
      );
      
      // Clean up all entries for this token
      await pool.query(
        'DELETE FROM security.token_usage WHERE token_hash = $1',
        [tokenHash]
      );
      
      return res.status(401).json({
        error: 'Session Invalid',
        message: 'Your session has been invalidated due to suspicious activity. Please login again.',
        code: 'TOKEN_THEFT_DETECTED'
      });
    }

    // Periodic cleanup of old entries (run cleanup every 1000 requests to avoid overhead)
    if (Math.random() < 0.001) {
      await pool.query('SELECT security.cleanup_old_token_usage()');
    }
    
    next();
  } catch (error) {
    // If database operation fails, log but don't block the request
    logger.error('Token theft detection error', {
      error: (error as Error).message,
      username: authReq.user.username,
    });
    // Fail open - allow request to proceed
    next();
  }
}

