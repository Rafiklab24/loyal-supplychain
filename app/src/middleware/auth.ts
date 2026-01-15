import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  Module,
  Role,
  hasAccess,
  hasWriteAccess,
  hasGlobalAccess,
  getPermissionLevel,
  // GLOBAL_ACCESS_ROLES, // Unused for now
} from './permissions';
import { env } from '../config/env';
import logger from '../utils/logger';

// JWT_SECRET is validated on startup via env.ts
const JWT_SECRET = env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: Role;
  };
  // Branch IDs the user can access (null = global access)
  userBranchIds?: string[] | null;
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: Role;
    };
    
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    logger.error('JWT verification failed', {
      error: (error as Error).message,
      tokenPrefix: token.substring(0, 20),
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token',
    });
  }
}

// Role-based authorization middleware (legacy - for backward compatibility)
export function authorizeRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Module-based authorization middleware
 * Checks if the user's role has access to a specific module
 * @param module - The module to check access for
 * @param requireWrite - If true, requires write access; otherwise read access is sufficient
 */
export function authorizeModule(module: Module, requireWrite: boolean = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRole = authReq.user.role as Role;
    
    // Check if user has required access level
    if (requireWrite) {
      if (!hasWriteAccess(userRole, module)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Write access to ${module} is not allowed for role: ${userRole}`,
          requiredAccess: 'write',
          module,
        });
      }
    } else {
      if (!hasAccess(userRole, module)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access to ${module} is not allowed for role: ${userRole}`,
          module,
        });
      }
    }

    next();
  };
}

/**
 * Require read access to a module
 */
export function requireRead(module: Module) {
  return authorizeModule(module, false);
}

/**
 * Require write access to a module
 */
export function requireWrite(module: Module) {
  return authorizeModule(module, true);
}

/**
 * Check if request method requires write access
 */
export function isWriteMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

/**
 * Auto-detect read/write based on HTTP method
 * GET/HEAD = read access, POST/PUT/PATCH/DELETE = write access
 */
export function authorizeModuleAuto(module: Module) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requireWrite = isWriteMethod(req.method);
    return authorizeModule(module, requireWrite)(req, res, next);
  };
}

/**
 * Check if user has global access (Admin/Exec)
 */
export function checkGlobalAccess(req: AuthRequest): boolean {
  if (!req.user) return false;
  return hasGlobalAccess(req.user.role as Role);
}

/**
 * Get permission info for the current user
 */
export function getUserPermissionInfo(req: AuthRequest, module: Module) {
  if (!req.user) {
    return { hasAccess: false, canWrite: false, level: 'none' as const };
  }
  
  const role = req.user.role as Role;
  return {
    hasAccess: hasAccess(role, module),
    canWrite: hasWriteAccess(role, module),
    level: getPermissionLevel(role, module),
    isGlobalAccess: hasGlobalAccess(role),
  };
}

