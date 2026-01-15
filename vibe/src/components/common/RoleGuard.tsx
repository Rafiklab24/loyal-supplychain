/**
 * RoleGuard Component
 * 
 * Protects routes/components based on user role and module access.
 * Shows access denied page or redirects unauthorized users.
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions, useModuleAccess } from '../../contexts/PermissionContext';
import type { Module } from '../../contexts/PermissionContext';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface RoleGuardProps {
  children: ReactNode;
  module?: Module;
  requireWrite?: boolean;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * RoleGuard - Protects routes based on module access
 */
export function RoleGuard({ 
  children, 
  module, 
  requireWrite = false,
  fallback,
  redirectTo,
}: RoleGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasAccess, hasWriteAccess, canAccessPath, role } = usePermissions();
  const location = useLocation();
  useTranslation(); // Hook for potential future translations

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check module-specific access
  let hasPermission = true;
  
  if (module) {
    hasPermission = requireWrite ? hasWriteAccess(module) : hasAccess(module);
  } else {
    // Use path-based checking
    hasPermission = canAccessPath(location.pathname);
  }

  // If no permission, show fallback or access denied
  if (!hasPermission) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default access denied page
    return (
      <AccessDeniedPage 
        module={module}
        requireWrite={requireWrite}
        role={role}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Access Denied Page Component
 */
interface AccessDeniedPageProps {
  module?: Module;
  requireWrite?: boolean;
  role?: string | null;
}

export function AccessDeniedPage({ module, requireWrite, role }: AccessDeniedPageProps) {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center p-8">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <ShieldExclamationIcon className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('access.denied', 'Access Denied')}
        </h1>
        <p className="text-gray-600 mb-6">
          {requireWrite 
            ? t('access.noWritePermission', 'You do not have permission to modify this resource.')
            : t('access.noAccessPermission', 'You do not have permission to access this page.')}
        </p>
        <div className="text-sm text-gray-500 bg-gray-100 rounded-lg p-4">
          <p className="mb-1">
            <strong>{t('access.yourRole', 'Your role')}:</strong> {role || 'Unknown'}
          </p>
          {module && (
            <p>
              <strong>{t('access.requiredModule', 'Required module')}:</strong> {module}
            </p>
          )}
        </div>
        <div className="mt-6">
          <a 
            href="/"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('access.backToDashboard', 'Back to Dashboard')}
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple component to conditionally render based on access
 */
interface CanAccessProps {
  module: Module;
  requireWrite?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function CanAccess({ module, requireWrite = false, children, fallback = null }: CanAccessProps) {
  const { canAccess, canWrite } = useModuleAccess(module);
  
  const hasPermission = requireWrite ? canWrite : canAccess;
  
  if (!hasPermission) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Component that shows content only for Admin users
 */
export function AdminOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { role } = usePermissions();
  
  if (role !== 'Admin') {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Component that shows content for global access roles (Admin, Exec)
 */
export function GlobalAccessOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { hasGlobalAccess } = usePermissions();
  
  if (!hasGlobalAccess()) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Component that shows content when user can write to a module
 */
export function CanWrite({ module, children, fallback = null }: { module: Module; children: ReactNode; fallback?: ReactNode }) {
  const { canWrite } = useModuleAccess(module);
  
  if (!canWrite) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Show a read-only indicator when user can only read
 */
export function ReadOnlyBanner({ module }: { module: Module }) {
  const { isReadOnly, canAccess } = useModuleAccess(module);
  const { t } = useTranslation();
  
  if (!canAccess || !isReadOnly) {
    return null;
  }
  
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg mb-4 text-sm flex items-center gap-2">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
      {t('access.readOnly', 'You have read-only access to this section. Contact an administrator for edit permissions.')}
    </div>
  );
}

export default RoleGuard;

