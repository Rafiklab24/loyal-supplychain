import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { pool } from '../db/client';
import { logSecurityEvent } from '../middleware/security';
import { env } from '../config/env';
import { AUTH, JWT } from '../config/constants';
import { withTransaction } from '../utils/transactions';
import { User } from '../types/database';
import { Role, hasGlobalAccess, hasConditionalGlobalAccess } from '../middleware/permissions';

const router = Router();

// Security Configuration
// JWT_SECRET is validated on startup via env.ts - no default fallback
const JWT_SECRET = env.JWT_SECRET;

// Shorter token expiration in production for security (1 hour vs 24 hours in dev)
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || (env.NODE_ENV === 'production' ? JWT.DEFAULT_EXPIRATION_PROD : JWT.DEFAULT_EXPIRATION_DEV);

/**
 * Compute whether a user has global access based on their role and branch assignments
 * - Admin: Always global access
 * - Exec: Global access only if NO branches assigned
 * - Others: Never global access (use their assigned branches)
 */
async function computeHasGlobalAccess(userId: string, roles: string[]): Promise<boolean> {
  // Check if any role has unconditional global access (Admin)
  for (const role of roles) {
    if (hasGlobalAccess(role as Role)) {
      return true;
    }
  }
  
  // Check if any role has conditional global access (Exec)
  const hasConditional = roles.some(role => hasConditionalGlobalAccess(role as Role));
  if (hasConditional) {
    // Check if user has any branch assignments
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM security.user_branches WHERE user_id = $1`,
      [userId]
    );
    const branchCount = parseInt(result.rows[0]?.count || '0', 10);
    // Global access only if NO branches assigned
    return branchCount === 0;
  }
  
  return false;
}

// POST /api/auth/login - Authenticate user
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      // Log missing credentials attempt
      logSecurityEvent('login_failed', null, username || 'unknown', req, { 
        reason: 'missing_credentials' 
      });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required',
      });
    }

    // Find user in database
    const result = await pool.query<User & { roles: string[]; module_access: Record<string, boolean> | null }>(
      'SELECT id, username, password_hash, name, role, roles, is_locked, failed_login_attempts, module_access FROM security.users WHERE username = $1',
      [username]
    );

    const user = result.rows.length > 0 ? result.rows[0] : null;
    if (!user) {
      // Log failed attempt - user not found (don't reveal this to attacker)
      logSecurityEvent('login_failed', null, username, req, { 
        reason: 'user_not_found' 
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }

    // user is already defined above

    // Check if account is locked
    if (user.is_locked) {
      logSecurityEvent('login_failed', user.id, username, req, { 
        reason: 'account_locked' 
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Account is locked. Please contact an administrator.',
      });
    }

    // Verify password
    if (!user.password_hash) {
      logSecurityEvent('login_failed', user.id, username, req, { 
        reason: 'no_password_set' 
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Password not set for this user',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const shouldLock = newAttempts >= AUTH.MAX_FAILED_ATTEMPTS;
      const lockoutMinutes = AUTH.LOCKOUT_DURATION_MS / (60 * 1000);
      
      await pool.query(
        `UPDATE security.users 
         SET failed_login_attempts = $1, 
             is_locked = $2,
             locked_until = CASE WHEN $2 THEN NOW() + INTERVAL '${lockoutMinutes} minutes' ELSE NULL END
         WHERE id = $3`,
        [newAttempts, shouldLock, user.id]
      );

      logSecurityEvent('login_failed', user.id, username, req, { 
        reason: 'invalid_password',
        failed_attempts: newAttempts,
        account_locked: shouldLock
      });

      if (shouldLock) {
        const lockoutMinutes = AUTH.LOCKOUT_DURATION_MS / (60 * 1000);
        return res.status(401).json({
          error: 'Unauthorized',
          message: `Too many failed attempts. Account has been locked for ${lockoutMinutes} minutes.`,
        });
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }

    // Reset failed login attempts on successful login
    await pool.query(
      `UPDATE security.users 
       SET failed_login_attempts = 0, 
           is_locked = false, 
           locked_until = NULL,
           last_login_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Get effective roles (prefer roles array, fallback to legacy role)
    const userRoles = (user.roles && user.roles.length > 0) 
      ? user.roles 
      : (user.role ? [user.role] : []);
    
    // Primary role is the first role in the array (for backward compatibility)
    const primaryRole = userRoles[0] || user.role || 'Correspondence';

    // Log successful login
    logSecurityEvent('login_success', user.id, username, req, { 
      role: primaryRole,
      roles: userRoles 
    });

    // Get module_access (per-user access overrides)
    const moduleAccess = user.module_access || null;

    // Compute whether user has global access (for branch filtering)
    const userHasGlobalAccess = await computeHasGlobalAccess(user.id, userRoles);

    // Generate JWT token - include both role (legacy) and roles (new)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: primaryRole,
        roles: userRoles,
        module_access: moduleAccess,
        has_global_access: userHasGlobalAccess,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: primaryRole,
        roles: userRoles,
        module_access: moduleAccess,
        has_global_access: userHasGlobalAccess,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register - Create new user (admin only, or for initial setup)
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, name, role, roles } = req.body;

    // Accept either single role or roles array
    let userRoles: string[] = [];
    if (roles && Array.isArray(roles) && roles.length > 0) {
      userRoles = roles;
    } else if (role) {
      userRoles = [role];
    }

    if (!username || !password || userRoles.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username, password, and at least one role are required',
      });
    }

    // Validate all roles
    const validRoles = ['Exec', 'Correspondence', 'Logistics', 'Procurement', 'Inventory', 'Clearance', 'Accounting', 'Admin', 'Cafe', 'Bookkeeper'];
    const invalidRoles = userRoles.filter(r => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role(s): ${invalidRoles.join(', ')}. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT id FROM security.users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists',
      });
    }

    // Hash password
    const saltRounds = AUTH.BCRYPT_ROUNDS;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Primary role is the first in the array (for backward compatibility)
    const primaryRole = userRoles[0];

    // Insert user with role
    const result = await pool.query(
      `INSERT INTO security.users (username, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, name, role, created_at`,
      [username, passwordHash, name, primaryRole]
    );

    const newUser = result.rows[0];

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        roles: newUser.roles || [newUser.role],
        created_at: newUser.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/is-main-admin - Check if current user is the main admin
router.get('/is-main-admin', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };

    // Main admin is the user with username 'admin'
    const isMainAdmin = decoded.username === 'admin';

    res.json({
      isMainAdmin,
      canManageCredentials: isMainAdmin,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };

    // Fetch fresh user data
    const result = await pool.query(
      'SELECT id, username, name, role, roles, module_access, created_at FROM security.users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const userData = result.rows[0];
    // Ensure roles array is populated
    const userRoles = (userData.roles && userData.roles.length > 0) 
      ? userData.roles 
      : (userData.role ? [userData.role] : []);

    // Compute whether user has global access
    const userHasGlobalAccess = await computeHasGlobalAccess(userData.id, userRoles);

    res.json({
      ...userData,
      roles: userRoles,
      module_access: userData.module_access || null,
      has_global_access: userHasGlobalAccess,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// GET /api/auth/users - List all users (admin only)
router.get('/users', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };

    // Check if user is admin
    if (decoded.role !== 'Admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    // Fetch all users with their branch assignments
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        u.name, 
        u.email, 
        u.phone, 
        u.role,
        u.roles,
        u.module_access,
        u.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', b.id,
            'name', b.name,
            'name_ar', b.name_ar,
            'branch_type', b.branch_type,
            'access_level', ub.access_level
          ))
          FROM security.user_branches ub
          JOIN master_data.branches b ON b.id = ub.branch_id
          WHERE ub.user_id = u.id),
          '[]'::json
        ) as branches
      FROM security.users u
      ORDER BY u.created_at DESC
    `);

    // Ensure each user has a roles array and module_access
    const usersWithRoles = result.rows.map(user => ({
      ...user,
      roles: (user.roles && user.roles.length > 0) 
        ? user.roles 
        : (user.role ? [user.role] : []),
      module_access: user.module_access || null,
    }));

    res.json({
      users: usersWithRoles,
      count: usersWithRoles.length,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// PUT /api/auth/users/:userId - Update user (admin only)
// Note: Only the main admin (username: 'admin') can change usernames and passwords
router.put('/users/:userId', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };

    // Only admin can update users
    if (decoded.role !== 'Admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const { userId } = req.params;
    const { name, role, roles, email, phone, password, username: newUsername, module_access } = req.body;

    // Check if current user is the main admin (username: 'admin')
    const isMainAdmin = decoded.username === 'admin';

    // Verify user exists
    const userCheck = await pool.query(
      'SELECT id, username FROM security.users WHERE id = $1',
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const targetUser = userCheck.rows[0];

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    // Handle roles array (new multi-role support)
    const validRoles = ['Exec', 'Correspondence', 'Logistics', 'Procurement', 'Inventory', 'Clearance', 'Accounting', 'Admin', 'Cafe', 'Bookkeeper'];
    
    if (roles !== undefined && Array.isArray(roles)) {
      // Validate all roles in the array
      const invalidRoles = roles.filter((r: string) => !validRoles.includes(r));
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid role(s): ${invalidRoles.join(', ')}. Must be one of: ${validRoles.join(', ')}`,
        });
      }
      
      // Update both role (primary/legacy) and roles array
      const primaryRole = roles[0] || 'Correspondence';
      updates.push(`role = $${paramIndex++}`);
      values.push(primaryRole);
      updates.push(`roles = $${paramIndex++}`);
      values.push(roles);
    } else if (role !== undefined) {
      // Legacy single role update - also update roles array
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        });
      }
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
      updates.push(`roles = $${paramIndex++}`);
      values.push([role]);
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email || null);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone || null);
    }

    // Module access overrides - allows toggling specific modules on/off
    if (module_access !== undefined) {
      // Validate module_access is an object or null
      if (module_access !== null && typeof module_access !== 'object') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'module_access must be an object or null',
        });
      }
      
      // Validate all keys are valid module names and values are booleans
      const validModules = ['users', 'dashboard', 'contracts', 'shipments', 'finance', 'customs', 
                           'land_transport', 'companies', 'products', 'analytics', 'accounting', 
                           'audit_logs', 'inventory', 'quality', 'cafe', 'cashbox'];
      
      if (module_access !== null) {
        for (const [key, value] of Object.entries(module_access)) {
          if (!validModules.includes(key)) {
            return res.status(400).json({
              error: 'Bad Request',
              message: `Invalid module name: ${key}. Valid modules: ${validModules.join(', ')}`,
            });
          }
          if (typeof value !== 'boolean') {
            return res.status(400).json({
              error: 'Bad Request',
              message: `module_access values must be booleans, got ${typeof value} for ${key}`,
            });
          }
        }
      }
      
      updates.push(`module_access = $${paramIndex++}`);
      values.push(module_access ? JSON.stringify(module_access) : null);
    }

    // Username change - ONLY main admin can do this
    if (newUsername !== undefined && newUsername !== targetUser.username) {
      if (!isMainAdmin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only the main administrator can change usernames',
        });
      }
      
      // Check if new username is already taken
      const usernameCheck = await pool.query(
        'SELECT id FROM security.users WHERE username = $1 AND id != $2',
        [newUsername, userId]
      );
      if (usernameCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Username already exists',
        });
      }
      
      updates.push(`username = $${paramIndex++}`);
      values.push(newUsername);
    }

    // Password change - ONLY main admin can do this for other users
    if (password !== undefined && password.length > 0) {
      if (!isMainAdmin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only the main administrator can reset user passwords',
        });
      }
      
      if (password.length < 6) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Password must be at least 6 characters',
        });
      }
      const saltRounds = AUTH.BCRYPT_ROUNDS;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update',
      });
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);

    // Add userId as last parameter
    values.push(userId);

    const result = await pool.query(`
      UPDATE security.users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, name, role, roles, email, phone, module_access, created_at, updated_at
    `, values);

    // Log the update as suspicious_activity for audit trail
    logSecurityEvent('suspicious_activity', decoded.id, decoded.username, req, {
      action: 'user_updated',
      target_user_id: userId,
      updated_fields: updates.map(u => u.split(' = ')[0]),
      is_main_admin: isMainAdmin,
    });

    const updatedUser = result.rows[0];
    // Ensure roles array is populated in response
    const userRoles = (updatedUser.roles && updatedUser.roles.length > 0) 
      ? updatedUser.roles 
      : (updatedUser.role ? [updatedUser.role] : []);

    res.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser,
        roles: userRoles,
        module_access: updatedUser.module_access || null,
      },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// DELETE /api/auth/users/:userId - Delete user (admin only)
router.delete('/users/:userId', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };

    // Only admin can delete users
    if (decoded.role !== 'Admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const { userId } = req.params;

    // Prevent self-deletion
    if (userId === decoded.id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'You cannot delete your own account',
      });
    }

    // Verify user exists
    const userCheck = await pool.query(
      'SELECT id, username, name FROM security.users WHERE id = $1',
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const deletedUser = userCheck.rows[0];

    // Use a transaction to clean up related data
    await withTransaction(async (client) => {
      // Delete branch assignments
      await client.query(
        'DELETE FROM security.user_branches WHERE user_id = $1',
        [userId]
      );

      // Delete the user
      await client.query(
        'DELETE FROM security.users WHERE id = $1',
        [userId]
      );
    });

    // Log the deletion as suspicious_activity for audit trail
    logSecurityEvent('suspicious_activity', decoded.id, decoded.username, req, {
      action: 'user_deleted',
      deleted_user_id: userId,
      deleted_username: deletedUser.username,
      deleted_name: deletedUser.name,
    });

    res.json({
      message: 'User deleted successfully',
      deleted_user: {
        id: deletedUser.id,
        username: deletedUser.username,
        name: deletedUser.name,
      },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// ========== BRANCH MANAGEMENT ENDPOINTS ==========

// GET /api/auth/branches - List all branches (for assignment UI)
router.get('/branches', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    jwt.verify(token, JWT_SECRET);

    // Fetch all branches with hierarchy info
    const result = await pool.query(`
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
        pb.name as parent_name,
        pb.name_ar as parent_name_ar
      FROM master_data.branches b
      LEFT JOIN master_data.branches pb ON pb.id = b.parent_id
      WHERE b.is_active = true
      ORDER BY b.sort_order, b.name
    `);

    res.json({
      branches: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// GET /api/auth/users/:userId/branches - Get user's assigned branches
router.get('/users/:userId/branches', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
    };

    // Only admin can view other users' branches
    if (decoded.role !== 'Admin' && decoded.id !== req.params.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const { userId } = req.params;

    const result = await pool.query(`
      SELECT 
        ub.id as assignment_id,
        ub.access_level,
        ub.created_at as assigned_at,
        b.id as branch_id,
        b.name,
        b.name_ar,
        b.branch_type,
        b.country,
        b.city,
        pb.name as parent_name,
        pb.name_ar as parent_name_ar
      FROM security.user_branches ub
      JOIN master_data.branches b ON b.id = ub.branch_id
      LEFT JOIN master_data.branches pb ON pb.id = b.parent_id
      WHERE ub.user_id = $1
      ORDER BY b.sort_order, b.name
    `, [userId]);

    res.json({
      user_id: userId,
      branches: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// POST /api/auth/users/:userId/branches - Assign branches to user
router.post('/users/:userId/branches', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };

    // Only admin can assign branches
    if (decoded.role !== 'Admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const { userId } = req.params;
    const { branch_ids, access_level = 'full' } = req.body;

    if (!branch_ids || !Array.isArray(branch_ids) || branch_ids.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'branch_ids array is required',
      });
    }

    // Validate access_level
    if (!['full', 'read_only'].includes(access_level)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'access_level must be "full" or "read_only"',
      });
    }

    // Verify user exists
    const userCheck = await pool.query(
      'SELECT id FROM security.users WHERE id = $1',
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Insert branch assignments (ignore duplicates)
    const insertedBranches = [];
    for (const branchId of branch_ids) {
      try {
        const result = await pool.query(`
          INSERT INTO security.user_branches (user_id, branch_id, access_level, created_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, branch_id) 
          DO UPDATE SET access_level = $3
          RETURNING id
        `, [userId, branchId, access_level, decoded.username]);
        insertedBranches.push({ branch_id: branchId, id: result.rows[0].id });
      } catch (err: any) {
        // Skip invalid branch IDs
        if (err.code !== '23503') throw err; // Not a foreign key violation
      }
    }

    res.status(201).json({
      message: 'Branches assigned successfully',
      assigned: insertedBranches.length,
      assignments: insertedBranches,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// DELETE /api/auth/users/:userId/branches/:branchId - Remove branch assignment
router.delete('/users/:userId/branches/:branchId', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
    };

    // Only admin can remove branch assignments
    if (decoded.role !== 'Admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const { userId, branchId } = req.params;

    const result = await pool.query(`
      DELETE FROM security.user_branches
      WHERE user_id = $1 AND branch_id = $2
      RETURNING id
    `, [userId, branchId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Branch assignment not found',
      });
    }

    res.json({
      message: 'Branch assignment removed successfully',
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// PUT /api/auth/users/:userId/branches - Replace all branch assignments
router.put('/users/:userId/branches', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };

    // Only admin can modify branch assignments
    if (decoded.role !== 'Admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const { userId } = req.params;
    const { branch_ids = [], access_level = 'full' } = req.body;

    // Verify user exists
    const userCheck = await pool.query(
      'SELECT id FROM security.users WHERE id = $1',
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const insertedBranches = await withTransaction(async (client) => {
      // Remove all existing assignments
      await client.query(
        'DELETE FROM security.user_branches WHERE user_id = $1',
        [userId]
      );

      // Insert new assignments
      const insertedBranches = [];
      for (const branchId of branch_ids) {
        try {
          const result = await client.query(`
            INSERT INTO security.user_branches (user_id, branch_id, access_level, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [userId, branchId, access_level, decoded.username]);
          insertedBranches.push({ branch_id: branchId, id: result.rows[0].id });
        } catch (err: any) {
          // Skip invalid branch IDs
          if (err.code !== '23503') throw err;
        }
      }

      return insertedBranches;
    });

    res.json({
      message: 'Branch assignments updated successfully',
      assigned: insertedBranches.length,
      assignments: insertedBranches,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

// GET /api/auth/me/branches - Get current user's branches
router.get('/me/branches', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
      roles?: string[];
    };

    // Get user's roles (prefer array, fallback to single role)
    const userRoles = decoded.roles || (decoded.role ? [decoded.role] : []);

    // Compute whether user has global access
    const isGlobalAccess = await computeHasGlobalAccess(decoded.id, userRoles);

    if (isGlobalAccess) {
      // Return all branches for global access users
      const result = await pool.query(`
        SELECT 
          b.id as branch_id,
          b.name,
          b.name_ar,
          b.branch_type,
          b.country,
          b.city,
          pb.name as parent_name
        FROM master_data.branches b
        LEFT JOIN master_data.branches pb ON pb.id = b.parent_id
        WHERE b.is_active = true
        ORDER BY b.sort_order, b.name
      `);

      return res.json({
        global_access: true,
        branches: result.rows,
        count: result.rows.length,
      });
    }

    // Get user's assigned branches
    const result = await pool.query(`
      SELECT 
        b.id as branch_id,
        b.name,
        b.name_ar,
        b.branch_type,
        b.country,
        b.city,
        ub.access_level,
        pb.name as parent_name
      FROM security.user_branches ub
      JOIN master_data.branches b ON b.id = ub.branch_id
      LEFT JOIN master_data.branches pb ON pb.id = b.parent_id
      WHERE ub.user_id = $1 AND b.is_active = true
      ORDER BY b.sort_order, b.name
    `, [decoded.id]);

    res.json({
      global_access: false,
      branches: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
});

export default router;

