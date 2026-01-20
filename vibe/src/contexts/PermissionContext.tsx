/**
 * Permission Context for Role-Based Access Control
 * 
 * Provides role and branch-based permission checking throughout the app.
 * Works in conjunction with AuthContext.
 * 
 * MULTI-ROLE SUPPORT:
 * Users can have multiple roles. Permission checks use the HIGHEST permission
 * level across all assigned roles. If ANY role grants 'full' access, the user
 * has full access. If ANY role grants 'read' access (and none grant 'full'),
 * the user has read access.
 * 
 * PER-USER MODULE ACCESS OVERRIDES:
 * Admins can override role-based permissions for individual users via module_access.
 * - If module_access[module] === false → deny access (override role)
 * - If module_access[module] === true → grant read access (override role)
 * - If module_access[module] is undefined → use role-based permissions
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Types matching backend permissions.ts
export type Role = 
  | 'Admin' 
  | 'Exec' 
  | 'Correspondence' 
  | 'Logistics' 
  | 'Procurement' 
  | 'Inventory' 
  | 'Clearance' 
  | 'Accounting'
  | 'Cafe'
  | 'Bookkeeper'
  | 'Antrepo';

// All valid roles for validation
export const ALL_ROLES: Role[] = [
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
  'Antrepo',
];

export type Module = 
  | 'users'
  | 'dashboard'
  | 'contracts'
  | 'shipments'
  | 'finance'
  | 'customs'
  | 'land_transport'
  | 'companies'
  | 'products'
  | 'analytics'
  | 'accounting'
  | 'audit_logs'
  | 'inventory'
  | 'quality'
  | 'cafe'
  | 'cashbox'
  | 'antrepo';

export type PermissionLevel = 'full' | 'read' | 'none';

// Permission matrix - mirrors backend
const PERMISSIONS: Record<Role, Partial<Record<Module, PermissionLevel>>> = {
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
    inventory: 'full',
    quality: 'full',
    cafe: 'full',
    cashbox: 'full',
    antrepo: 'full',
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
    inventory: 'read',
    quality: 'full', // Exec can review quality incidents
    cafe: 'read', // Can vote
    antrepo: 'read',
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
    inventory: 'none',
    quality: 'none',
    cafe: 'read', // Can vote
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
    inventory: 'none',
    quality: 'none',
    cafe: 'read', // Can vote
    antrepo: 'read', // Can view antrepo inventory
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
    inventory: 'none',
    quality: 'none',
    cafe: 'read', // Can vote
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
    inventory: 'full', // Inventory role has full access to FB interface
    quality: 'full', // Can create and manage quality incidents
    cafe: 'read', // Can vote
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
    inventory: 'none',
    quality: 'none',
    cafe: 'read', // Can vote
    antrepo: 'read', // Can view antrepo for customs purposes
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
    inventory: 'none',
    quality: 'none',
    cafe: 'read', // Can vote
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
    inventory: 'none',
    quality: 'none',
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
    inventory: 'none',
    quality: 'none',
    cafe: 'read', // Can vote like any user
    cashbox: 'full', // Full access to cash boxes
  },
  Antrepo: {
    users: 'none',
    dashboard: 'read',
    contracts: 'read',
    shipments: 'read',
    finance: 'none',
    customs: 'read',
    land_transport: 'read',
    companies: 'none',
    products: 'read',
    analytics: 'none',
    accounting: 'none',
    audit_logs: 'none',
    inventory: 'none',
    quality: 'none',
    cafe: 'read',
    cashbox: 'none',
    antrepo: 'full', // Full access to antrepo management
  },
};

// Global access roles - Admin ALWAYS has global access
// Exec has conditional global access (only if no branches assigned)
// The actual computation is done on the backend and returned as has_global_access
const UNCONDITIONAL_GLOBAL_ROLES: Role[] = ['Admin'];

// Per-user module access type
export type ModuleAccess = Record<string, boolean> | null;

// Map paths to modules
export const PATH_TO_MODULE: Record<string, Module> = {
  '/users': 'users',
  '/': 'dashboard',
  '/contracts': 'contracts',
  '/contracts/new': 'contracts',
  '/shipments': 'shipments',
  '/shipments/tracking': 'shipments',
  '/finance': 'finance',
  '/customs-clearing-costs': 'customs',
  '/customs-clearing-batches': 'customs',
  '/land-transport': 'land_transport',
  '/companies': 'companies',
  '/products': 'products',
  '/analytics': 'analytics',
  '/accounting': 'accounting',
  '/tasks': 'dashboard',
  '/inventory': 'inventory',
  '/quality-incidents': 'quality',
  '/quality-incident': 'quality',
  '/cafe': 'cafe',
  '/cashbox': 'cashbox',
  '/antrepo': 'antrepo',
  '/antrepo-lots': 'antrepo',
};

interface PermissionContextType {
  role: Role | null;           // Primary role (legacy, backward compatible)
  roles: Role[];               // All roles assigned to user
  moduleAccess: ModuleAccess;  // Per-user module access overrides
  hasAccess: (module: Module) => boolean;
  hasWriteAccess: (module: Module) => boolean;
  hasReadOnlyAccess: (module: Module) => boolean;
  getPermissionLevel: (module: Module) => PermissionLevel;
  hasGlobalAccess: () => boolean;
  canAccessPath: (path: string) => boolean;
  canWritePath: (path: string) => boolean;
  getAccessibleModules: () => Module[];
  hasRole: (role: Role) => boolean;  // Check if user has a specific role
  isModuleExplicitlyDenied: (module: Module) => boolean;  // Check if module is explicitly denied via override
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Support both single role (legacy) and roles array (new multi-role)
  const userRoles: Role[] = useMemo(() => {
    if (!user) return [];
    
    // Prefer roles array if present
    if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
      return user.roles as Role[];
    }
    
    // Fallback to single role
    if (user.role) {
      return [user.role as Role];
    }
    
    return [];
  }, [user]);
  
  // Primary role for backward compatibility
  const primaryRole = userRoles[0] || null;
  
  // Per-user module access overrides
  const moduleAccess: ModuleAccess = useMemo(() => {
    if (!user) return null;
    return (user as any).module_access || null;
  }, [user]);

  const value = useMemo<PermissionContextType>(() => {
    // Get highest permission level across all roles for a module (without overrides)
    const getRoleBasedPermission = (module: Module): PermissionLevel => {
      let highest: PermissionLevel = 'none';
      
      for (const role of userRoles) {
        const permission = PERMISSIONS[role]?.[module];
        if (permission === 'full') return 'full'; // Can't get higher
        if (permission === 'read') highest = 'read';
      }
      
      return highest;
    };
    
    // Get permission level considering per-user overrides
    const getHighestPermission = (module: Module): PermissionLevel => {
      // Check per-user override first
      if (moduleAccess && typeof moduleAccess[module] === 'boolean') {
        // If explicitly denied, return 'none'
        if (moduleAccess[module] === false) return 'none';
        // If explicitly granted, check if role has 'full', otherwise return 'read'
        const roleLevel = getRoleBasedPermission(module);
        if (roleLevel === 'full') return 'full';
        return 'read';
      }
      
      // Fall back to role-based permissions
      return getRoleBasedPermission(module);
    };
    
    // Check if a module is explicitly denied via override
    const isModuleExplicitlyDenied = (module: Module): boolean => {
      return moduleAccess !== null && moduleAccess[module] === false;
    };

    const hasAccess = (module: Module): boolean => {
      const permission = getHighestPermission(module);
      return permission === 'full' || permission === 'read';
    };

    const hasWriteAccess = (module: Module): boolean => {
      return getHighestPermission(module) === 'full';
    };

    const hasReadOnlyAccess = (module: Module): boolean => {
      const permission = getHighestPermission(module);
      // Read-only means has read but NOT full
      return permission === 'read';
    };

    const getPermissionLevel = (module: Module): PermissionLevel => {
      return getHighestPermission(module);
    };

    const hasGlobalAccess = (): boolean => {
      // Use backend-computed value if available (accounts for branch assignments)
      const backendHasGlobalAccess = (user as any)?.has_global_access;
      if (typeof backendHasGlobalAccess === 'boolean') {
        return backendHasGlobalAccess;
      }
      
      // Fallback for backward compatibility: Admin always has global access
      // For other roles, we don't know their branch status, so be conservative
      return userRoles.some(role => UNCONDITIONAL_GLOBAL_ROLES.includes(role));
    };

    const hasRole = (role: Role): boolean => {
      return userRoles.includes(role);
    };

    const canAccessPath = (path: string): boolean => {
      // Always allow login
      if (path === '/login') return true;
      
      // Check exact path match first
      let module = PATH_TO_MODULE[path];
      
      // Check partial path matches (for dynamic routes like /contracts/:id)
      if (!module) {
        const basePath = '/' + path.split('/').filter(Boolean)[0];
        module = PATH_TO_MODULE[basePath];
      }
      
      // If no module mapping, allow access (dashboard/public)
      if (!module) return true;
      
      return hasAccess(module);
    };

    const canWritePath = (path: string): boolean => {
      let module = PATH_TO_MODULE[path];
      
      if (!module) {
        const basePath = '/' + path.split('/').filter(Boolean)[0];
        module = PATH_TO_MODULE[basePath];
      }
      
      if (!module) return false;
      
      return hasWriteAccess(module);
    };

    const getAccessibleModules = (): Module[] => {
      // Get all modules accessible by any of the user's roles
      const accessibleModules = new Set<Module>();
      
      for (const role of userRoles) {
        const rolePermissions = PERMISSIONS[role];
        if (!rolePermissions) continue;
        
        Object.entries(rolePermissions).forEach(([module, permission]) => {
          if (permission === 'full' || permission === 'read') {
            accessibleModules.add(module as Module);
          }
        });
      }
      
      return Array.from(accessibleModules);
    };

    return {
      role: primaryRole,
      roles: userRoles,
      moduleAccess,
      hasAccess,
      hasWriteAccess,
      hasReadOnlyAccess,
      getPermissionLevel,
      hasGlobalAccess,
      canAccessPath,
      canWritePath,
      getAccessibleModules,
      hasRole,
      isModuleExplicitlyDenied,
    };
  }, [userRoles, primaryRole, moduleAccess]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  
  return context;
}

/**
 * Hook for checking access to a specific module
 */
export function useModuleAccess(module: Module) {
  const { hasAccess, hasWriteAccess, hasReadOnlyAccess, getPermissionLevel } = usePermissions();
  
  return {
    canAccess: hasAccess(module),
    canWrite: hasWriteAccess(module),
    isReadOnly: hasReadOnlyAccess(module),
    level: getPermissionLevel(module),
  };
}

/**
 * Hook for checking if user has global (branch-unrestricted) access
 */
export function useGlobalAccess() {
  const { hasGlobalAccess, role, roles } = usePermissions();
  return { hasGlobalAccess: hasGlobalAccess(), role, roles };
}

/**
 * Hook for checking if user has a specific role
 */
export function useHasRole(role: Role) {
  const { hasRole } = usePermissions();
  return hasRole(role);
}

