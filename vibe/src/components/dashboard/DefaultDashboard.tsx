import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  TruckIcon, 
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { usePermissions } from '../../contexts/PermissionContext';
import { useAuth } from '../../contexts/AuthContext';

interface QuickLink {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  module: string;
  color: string;
}

export function DefaultDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAccess } = usePermissions();
  const { user } = useAuth();

  const allLinks: QuickLink[] = [
    {
      title: t('nav.shipments', 'Shipments'),
      description: t('dashboard.viewShipments', 'View and track shipments'),
      icon: <TruckIcon className="h-8 w-8" />,
      path: '/shipments',
      module: 'shipments',
      color: 'bg-blue-500',
    },
    {
      title: t('nav.contracts', 'Contracts'),
      description: t('dashboard.viewContracts', 'View contracts'),
      icon: <DocumentTextIcon className="h-8 w-8" />,
      path: '/contracts',
      module: 'contracts',
      color: 'bg-indigo-500',
    },
    {
      title: t('nav.products', 'Products'),
      description: t('dashboard.viewProducts', 'View product catalog'),
      icon: <CubeIcon className="h-8 w-8" />,
      path: '/products',
      module: 'products',
      color: 'bg-purple-500',
    },
    {
      title: t('nav.finance', 'Finance'),
      description: t('dashboard.viewFinance', 'View financial transactions'),
      icon: <BanknotesIcon className="h-8 w-8" />,
      path: '/finance',
      module: 'finance',
      color: 'bg-green-500',
    },
    {
      title: t('nav.companies', 'Companies'),
      description: t('dashboard.viewCompanies', 'View suppliers and customers'),
      icon: <BuildingStorefrontIcon className="h-8 w-8" />,
      path: '/companies',
      module: 'companies',
      color: 'bg-amber-500',
    },
    {
      title: t('nav.analytics', 'Analytics'),
      description: t('dashboard.viewAnalytics', 'View reports and analytics'),
      icon: <ChartBarIcon className="h-8 w-8" />,
      path: '/analytics',
      module: 'analytics',
      color: 'bg-cyan-500',
    },
    {
      title: t('nav.tasks', 'Tasks'),
      description: t('dashboard.viewTasks', 'View your tasks'),
      icon: <ClipboardDocumentListIcon className="h-8 w-8" />,
      path: '/tasks',
      module: 'dashboard',
      color: 'bg-rose-500',
    },
  ];

  // Filter links based on user permissions
  const accessibleLinks = allLinks.filter(link => hasAccess(link.module as any));

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          {t('dashboard.welcome', 'Welcome')}, {user?.name || user?.username}!
        </h1>
        <p className="text-primary-100 text-lg">
          {t('dashboard.welcomeMessage', 'Here are your quick access links')}
        </p>
      </div>

      {/* Quick Access Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t('dashboard.quickAccess', 'Quick Access')}
        </h2>
        
        {accessibleLinks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessibleLinks.map((link, idx) => (
              <button
                key={idx}
                onClick={() => navigate(link.path)}
                className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-start"
              >
                <div className={`p-3 rounded-xl ${link.color} text-white flex-shrink-0`}>
                  {link.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{link.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{link.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <UserGroupIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">{t('dashboard.noAccessibleModules', 'No modules available')}</p>
            <p className="text-gray-400 mt-1">{t('dashboard.contactAdmin', 'Contact your administrator for access')}</p>
          </div>
        )}
      </div>

      {/* Role Info */}
      <div className="bg-gray-50 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-200 rounded-lg">
            <UserGroupIcon className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('dashboard.yourRole', 'Your Role')}</p>
            <p className="font-medium text-gray-900">{user?.role || 'User'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

