import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  HomeIcon,
  TruckIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  XMarkIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  MapPinIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserGroupIcon,
  ArchiveBoxIcon,
  RectangleStackIcon,
  CubeIcon,
  CalculatorIcon,
  CircleStackIcon,
  InboxStackIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import type { Module } from '../../contexts/PermissionContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  module?: Module; // Module for permission checking
  subItems?: {
    name: string;
    href: string;
    icon: any;
    module?: Module;
  }[];
}

// Navigation with module permissions
const navigation: NavItem[] = [
  { name: 'nav.dashboard', href: '/', icon: HomeIcon, module: 'dashboard' },
  { name: 'nav.shipments', href: '/shipments', icon: TruckIcon, module: 'shipments' },
  { name: 'nav.shipmentTracking', href: '/shipments/tracking', icon: MapPinIcon, module: 'shipments' },
  { name: 'nav.contracts', href: '/contracts', icon: DocumentTextIcon, module: 'contracts' },
  { name: 'nav.products', href: '/products', icon: CubeIcon, module: 'products' },
  { name: 'nav.tasks', href: '/tasks', icon: ClipboardDocumentCheckIcon, module: 'dashboard' },
  { name: 'nav.companies', href: '/companies', icon: BuildingOfficeIcon, module: 'companies' },
  { name: 'nav.finance', href: '/finance', icon: BanknotesIcon, module: 'finance' },
  { name: 'nav.accounting', href: '/accounting', icon: CalculatorIcon, module: 'accounting' },
  { 
    name: 'nav.clearance', 
    href: '/customs-clearing-costs', 
    icon: ArchiveBoxIcon,
    module: 'customs',
    subItems: [
      { name: 'customsClearingCosts.title', href: '/customs-clearing-costs', icon: ArchiveBoxIcon, module: 'customs' },
      { name: 'customsClearingCosts.batches', href: '/customs-clearing-batches', icon: RectangleStackIcon, module: 'customs' },
      { name: 'nav.borderAgent', href: '/border-agent', icon: TruckIcon, module: 'customs' },
      { name: 'nav.efatura', href: '/e-fatura', icon: DocumentTextIcon, module: 'customs' },
    ]
  },
  { name: 'nav.landTransport', href: '/land-transport', icon: TruckIcon, module: 'land_transport' },
  { name: 'nav.analytics', href: '/analytics', icon: ChartBarIcon, module: 'analytics' },
  { 
    name: 'nav.inventory', 
    href: '/inventory', 
    icon: InboxStackIcon,
    module: 'inventory',
    subItems: [
      { name: 'nav.inventoryDashboard', href: '/inventory', icon: InboxStackIcon, module: 'inventory' },
      { name: 'nav.qualityIncidents', href: '/quality-incidents', icon: ExclamationTriangleIcon, module: 'quality' },
    ]
  },
  { 
    name: 'nav.stock', 
    href: '/stock', 
    icon: CircleStackIcon,
    module: 'antrepo',
    subItems: [
      { name: 'nav.stockDashboard', href: '/stock', icon: ChartBarIcon, module: 'antrepo' },
      { name: 'nav.antrepoDashboard', href: '/antrepo', icon: CircleStackIcon, module: 'antrepo' },
      { name: 'nav.elleclemeDashboard', href: '/ellecleme', icon: WrenchScrewdriverIcon, module: 'ellecleme' },
    ]
  },
  { name: 'nav.cafeDashboard', href: '/cafe', icon: CubeIcon, module: 'cafe' },
  { name: 'nav.cashBoxes', href: '/cashbox', icon: BanknotesIcon, module: 'cashbox' },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { hasAccess } = usePermissions();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  // Auto-expand if current path matches a sub-item
  const isExpanded = (item: NavItem) => {
    if (item.subItems) {
      const hasActiveSubItem = item.subItems.some(sub => location.pathname === sub.href);
      return expandedItems.includes(item.name) || hasActiveSubItem;
    }
    return false;
  };
  
  // Check if user has access to a nav item
  const canAccessItem = (item: NavItem | { module?: Module }) => {
    if (!item.module) return true; // No module restriction
    return hasAccess(item.module);
  };
  
  // Filter navigation items by access
  const filteredNavigation = navigation.filter(item => {
    // Check main item access
    if (!canAccessItem(item)) return false;
    
    // Filter sub-items if present
    if (item.subItems) {
      const accessibleSubItems = item.subItems.filter(sub => canAccessItem(sub));
      // Show parent if at least one sub-item is accessible
      return accessibleSubItems.length > 0;
    }
    
    return true;
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:relative inset-y-0 z-50 w-64 bg-white flex flex-col transition-all duration-300 ease-in-out',
          // RTL: sidebar on right (end), LTR: sidebar on left (start)
          'ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l border-gray-200',
          // Mobile: show/hide based on isOpen, Desktop (lg): always visible
          'lg:translate-x-0 lg:translate-y-0',
          // Mobile only: apply transform based on isOpen
          isOpen 
            ? 'translate-x-0 translate-y-0' 
            : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full'
        )}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 lg:hidden border-b border-gray-200">
          <h2 className="text-lg font-bold text-primary-600">{t('app.title')}</h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label={t('nav.closeMenu', 'Close navigation menu')}
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 relative z-50 overflow-y-auto flex-1" aria-label={t('nav.mainNavigation', 'Main navigation')}>
          {/* Admin-only Users Management */}
          {user?.role === 'Admin' && (
            <>
            <NavLink
              to="/users"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setTimeout(() => onClose(), 0);
                }
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors no-underline block',
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700 border-2 border-purple-200'
                )
              }
            >
              <UserGroupIcon className="h-5 w-5" />
              <span>User Management</span>
            </NavLink>
            <NavLink
              to="/admin/field-mappings"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setTimeout(() => onClose(), 0);
                }
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors no-underline block',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border-2 border-indigo-200'
                )
              }
            >
              <CircleStackIcon className="h-5 w-5" />
              <span>Field Mappings</span>
            </NavLink>
            <NavLink
              to="/border-crossings"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setTimeout(() => onClose(), 0);
                }
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors no-underline block',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border-2 border-indigo-200'
                )
              }
            >
              <MapPinIcon className="h-5 w-5" />
              <span>{t('nav.borderCrossings', 'Border Crossings')}</span>
            </NavLink>
            </>
          )}

          {filteredNavigation.map((item) => (
            <div key={item.name}>
              {item.subItems ? (
                <>
                  {/* Parent with sub-items */}
                  <div className="flex items-center">
                    <NavLink
                      to={item.href}
                      end={item.href === '/'}
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          setTimeout(() => onClose(), 0);
                        }
                      }}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors no-underline flex-1',
                          isActive && location.pathname === item.href
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{t(item.name)}</span>
                    </NavLink>
                    <button
                      onClick={() => toggleExpand(item.name)}
                      className="p-2 rounded-md hover:bg-gray-100 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      aria-label={isExpanded(item) ? t('nav.collapseMenu', 'Collapse menu') : t('nav.expandMenu', 'Expand menu')}
                      aria-expanded={isExpanded(item)}
                      aria-controls={`submenu-${item.name}`}
                    >
                      {isExpanded(item) ? (
                        <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  
                  {/* Sub-items - only show accessible ones */}
                  {isExpanded(item) && (
                    <div 
                      id={`submenu-${item.name}`}
                      className="ms-8 mt-1 space-y-1"
                      role="menu"
                      aria-label={t('nav.submenu', 'Submenu')}
                    >
                      {item.subItems.filter(sub => canAccessItem(sub)).map((subItem) => (
                        <NavLink
                          key={subItem.name}
                          to={subItem.href}
                          onClick={() => {
                            if (window.innerWidth < 1024) {
                              setTimeout(() => onClose(), 0);
                            }
                          }}
                          className={({ isActive }) =>
                            clsx(
                              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors no-underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                              isActive
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            )
                          }
                          role="menuitem"
                        >
                          <subItem.icon className="h-4 w-4" aria-hidden="true" />
                          <span>{t(subItem.name)}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Regular item without sub-items */
            <NavLink
              to={item.href}
              end={item.href === '/' || item.href === '/shipments'}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setTimeout(() => onClose(), 0);
                }
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors no-underline block focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )
              }
              aria-label={t(item.name)}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span>{t(item.name)}</span>
            </NavLink>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">{t('app.subtitle')}</p>
        </div>
      </aside>
    </>
  );
}

