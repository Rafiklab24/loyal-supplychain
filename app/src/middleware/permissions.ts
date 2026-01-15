/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * Defines which roles can access which modules and with what permissions.
 * - 'full': Read and write access
 * - 'read': Read-only access
 * - undefined or not listed: No access
 */

// All available roles in the system
export const ROLES = [
  'Admin',
  'Exec',
  'Correspondence',
  'Logistics',
  'Procurement',
  'Inventory',
  'Clearance',
  'Accounting',
  'Cafe',
  'Bookkeeper',
] as const;

export type Role = typeof ROLES[number];

// Permission levels
export type PermissionLevel = 'full' | 'read' | 'none';

// All modules/resources in the system
export const MODULES = [
  'users',
  'dashboard',
  'contracts',
  'shipments',
  'finance',
  'customs',
  'land_transport',
  'companies',
  'products',
  'analytics',
  'accounting',
  'audit_logs',
  'cafe',
  'cashbox',
] as const;

export type Module = typeof MODULES[number];

// Role-to-Module permission matrix
// Based on the plan's permission matrix
export const PERMISSIONS: Record<Role, Partial<Record<Module, PermissionLevel>>> = {
  Admin: {
    users: 'full',
    dashboard: 'full',
    contracts: 'full',
    shipments: 'full',
    finance: 'full',
    customs: 'full',
    land_transport: 'full',
    companies: 'full',
    products: 'full',
    analytics: 'full',
    accounting: 'full',
    audit_logs: 'full',
    cafe: 'full',
    cashbox: 'full',
  },
  Exec: {
    users: 'none',
    dashboard: 'read',
    contracts: 'read',
    shipments: 'read',
    finance: 'read',
    customs: 'read',
    land_transport: 'read',
    companies: 'none', // Admin-only per user request
    products: 'read',
    analytics: 'read',
    accounting: 'read',
    audit_logs: 'read',
    cafe: 'read',
  },
  Correspondence: {
    users: 'none',
    dashboard: 'read',
    contracts: 'read',
    shipments: 'read',
    finance: 'none',
    customs: 'none',
    land_transport: 'none',
    companies: 'none', // Admin-only per user request
    products: 'none',
    analytics: 'none',
    accounting: 'none',
    audit_logs: 'none',
    cafe: 'read',
  },
  Logistics: {
    users: 'none',
    dashboard: 'read',
    contracts: 'full',
    shipments: 'full',
    finance: 'none',
    customs: 'none',
    land_transport: 'full',
    companies: 'none', // Admin-only per user request
    products: 'read',
    analytics: 'read',
    accounting: 'none',
    audit_logs: 'none',
    cafe: 'read',
  },
  Procurement: {
    users: 'none',
    dashboard: 'read',
    contracts: 'full',
    shipments: 'read',
    finance: 'none',
    customs: 'none',
    land_transport: 'none',
    companies: 'none', // Admin-only per user request
    products: 'full',
    analytics: 'read',
    accounting: 'none',
    audit_logs: 'none',
    cafe: 'read',
  },
  Inventory: {
    users: 'none',
    dashboard: 'read',
    contracts: 'read',
    shipments: 'read',
    finance: 'none',
    customs: 'none',
    land_transport: 'full',
    companies: 'none', // Admin-only per user request
    products: 'full',
    analytics: 'read',
    accounting: 'none',
    audit_logs: 'none',
    cafe: 'read',
  },
  Clearance: {
    users: 'none',
    dashboard: 'read',
    contracts: 'read',
    shipments: 'read',
    finance: 'none',
    customs: 'full',
    land_transport: 'read',
    companies: 'none', // Admin-only per user request
    products: 'none',
    analytics: 'read',
    accounting: 'none',
    audit_logs: 'none',
    cafe: 'read',
  },
  Accounting: {
    users: 'none',
    dashboard: 'read',
    contracts: 'read',
    shipments: 'read',
    finance: 'full',
    customs: 'read',
    land_transport: 'read',
    companies: 'none', // Admin-only per user request
    products: 'none',
    analytics: 'read',
    accounting: 'full',
    audit_logs: 'read',
    cafe: 'read', // Can vote like any user
    cashbox: 'read', // View cash boxes but not record transactions
  },
  Cafe: {
    users: 'none',
    dashboard: 'read',
    contracts: 'none',
    shipments: 'none',
    finance: 'none',
    customs: 'none',
    land_transport: 'none',
    companies: 'none',
    products: 'none',
    analytics: 'none',
    accounting: 'none',
    audit_logs: 'none',
    cafe: 'full', // Full access to cafe management
    cashbox: 'none',
  },
  Bookkeeper: {
    users: 'none',
    dashboard: 'read',
    contracts: 'none',
    shipments: 'none',
    finance: 'none',
    customs: 'none',
    land_transport: 'none',
    companies: 'none',
    products: 'none',
    analytics: 'none',
    accounting: 'none',
    audit_logs: 'none',
    cafe: 'read', // Can vote like any user
    cashbox: 'full', // Full access to cash boxes
  },
};

// Global access roles - these bypass branch filtering
export const GLOBAL_ACCESS_ROLES: Role[] = ['Admin', 'Exec'];

/**
 * Check if a role has access to a module
 */
export function hasAccess(role: Role, module: Module): boolean {
  const permission = PERMISSIONS[role]?.[module];
  return permission === 'full' || permission === 'read';
}

/**
 * Check if a user has access to a module, considering per-user overrides
 * @param roles - User's assigned roles
 * @param module - Module to check
 * @param moduleAccess - Per-user module access overrides (from user.module_access)
 * @returns true if user has access
 * 
 * Logic:
 * 1. If moduleAccess[module] === false → deny access (override role)
 * 2. If moduleAccess[module] === true → grant read access (override role)
 * 3. If moduleAccess[module] is undefined → use role-based permissions
 */
export function hasAccessWithOverrides(
  roles: Role[], 
  module: Module, 
  moduleAccess: Record<string, boolean> | null | undefined
): boolean {
  // Check per-user override first
  if (moduleAccess && typeof moduleAccess[module] === 'boolean') {
    return moduleAccess[module];
  }
  
  // Fall back to role-based permissions
  return hasAccessMultiRole(roles, module);
}

/**
 * Get the permission level for a user, considering per-user overrides
 */
export function getPermissionLevelWithOverrides(
  roles: Role[], 
  module: Module, 
  moduleAccess: Record<string, boolean> | null | undefined
): PermissionLevel {
  // Check per-user override first
  if (moduleAccess && typeof moduleAccess[module] === 'boolean') {
    // If explicitly denied, return 'none'
    if (moduleAccess[module] === false) return 'none';
    // If explicitly granted but role has 'full', keep 'full'
    // If explicitly granted but role has 'none' or 'read', return 'read'
    const roleLevel = getPermissionLevelMultiRole(roles, module);
    if (roleLevel === 'full') return 'full';
    return 'read';
  }
  
  // Fall back to role-based permissions
  return getPermissionLevelMultiRole(roles, module);
}

/**
 * Check if ANY of the given roles has access to a module (multi-role support)
 */
export function hasAccessMultiRole(roles: Role[], module: Module): boolean {
  return roles.some(role => hasAccess(role, module));
}

/**
 * Check if a role has write access to a module
 */
export function hasWriteAccess(role: Role, module: Module): boolean {
  return PERMISSIONS[role]?.[module] === 'full';
}

/**
 * Check if ANY of the given roles has write access to a module (multi-role support)
 */
export function hasWriteAccessMultiRole(roles: Role[], module: Module): boolean {
  return roles.some(role => hasWriteAccess(role, module));
}

/**
 * Check if a role has read-only access to a module
 */
export function hasReadOnlyAccess(role: Role, module: Module): boolean {
  return PERMISSIONS[role]?.[module] === 'read';
}

/**
 * Get the permission level for a role and module
 */
export function getPermissionLevel(role: Role, module: Module): PermissionLevel {
  return PERMISSIONS[role]?.[module] || 'none';
}

/**
 * Get the highest permission level across multiple roles (multi-role support)
 * Returns 'full' if any role has full access, 'read' if any has read, else 'none'
 */
export function getPermissionLevelMultiRole(roles: Role[], module: Module): PermissionLevel {
  let highestLevel: PermissionLevel = 'none';
  
  for (const role of roles) {
    const level = getPermissionLevel(role, module);
    if (level === 'full') return 'full'; // Can't get higher than full
    if (level === 'read') highestLevel = 'read';
  }
  
  return highestLevel;
}

/**
 * Check if a role has global access (bypasses branch filtering)
 */
export function hasGlobalAccess(role: Role): boolean {
  return GLOBAL_ACCESS_ROLES.includes(role);
}

/**
 * Check if ANY of the given roles has global access (multi-role support)
 */
export function hasGlobalAccessMultiRole(roles: Role[]): boolean {
  return roles.some(role => hasGlobalAccess(role));
}

/**
 * Get all modules a role can access
 */
export function getAccessibleModules(role: Role): Module[] {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return [];
  
  return Object.entries(rolePermissions)
    .filter(([_, permission]) => permission === 'full' || permission === 'read')
    .map(([module]) => module as Module);
}

/**
 * Get all modules accessible by any of the given roles (multi-role support)
 */
export function getAccessibleModulesMultiRole(roles: Role[]): Module[] {
  const accessibleModules = new Set<Module>();
  
  for (const role of roles) {
    const modules = getAccessibleModules(role);
    modules.forEach(m => accessibleModules.add(m));
  }
  
  return Array.from(accessibleModules);
}

/**
 * Map URL paths to modules for route protection
 */
export const PATH_TO_MODULE: Record<string, Module> = {
  '/users': 'users',
  '/': 'dashboard',
  '/contracts': 'contracts',
  '/shipments': 'shipments',
  '/finance': 'finance',
  '/customs-clearing-costs': 'customs',
  '/customs-clearing-batches': 'customs',
  '/land-transport': 'land_transport',
  '/companies': 'companies',
  '/products': 'products',
  '/analytics': 'analytics',
  '/accounting': 'accounting',
  '/tasks': 'dashboard', // Tasks is part of dashboard
  '/cafe': 'cafe',
  '/cashbox': 'cashbox',
};

/**
 * Map API routes to modules for backend route protection
 */
export const API_ROUTE_TO_MODULE: Record<string, Module> = {
  '/api/auth/users': 'users',
  '/api/contracts': 'contracts',
  '/api/shipments': 'shipments',
  '/api/finance': 'finance',
  '/api/funds': 'finance',
  '/api/customs-clearing-costs': 'customs',
  '/api/customs-clearing-batches': 'customs',
  '/api/land-transport': 'land_transport',
  '/api/companies': 'companies',
  '/api/products': 'products',
  '/api/accounting': 'accounting',
  '/api/audit-log': 'audit_logs',
  '/api/notifications': 'dashboard',
  '/api/transfers': 'finance',
  '/api/proformas': 'contracts',
  '/api/ports': 'shipments',
  '/api/cafe': 'cafe',
  '/api/cashbox': 'cashbox',
};

