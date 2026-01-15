import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  DocumentCheckIcon, 
  ClockIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../common/Card';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { formatNumber } from '../../utils/format';
import { apiClient } from '../../services/api';

interface ClearanceStats {
  pending_clearance: number;
  in_progress: number;
  cleared_this_week: number;
  at_border: number;
}

interface PendingClearance {
  id: string;
  shipment_sn: string;
  product_text: string;
  pod_name: string;
  eta: string;
  clearance_status: string;
}

export function ClearanceDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  // Fetch clearance-specific stats
  const { data: stats, isLoading: statsLoading } = useQuery<ClearanceStats>({
    queryKey: ['clearance-dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/clearance-stats');
      return response.data;
    },
  });

  // Fetch pending clearances
  const { data: pendingClearances, isLoading: clearancesLoading } = useQuery<PendingClearance[]>({
    queryKey: ['pending-clearances-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/customs-clearing-costs/pending-clearances', {
        params: { limit: 5 },
      });
      return response.data || [];
    },
  });

  const statCards = [
    {
      title: t('dashboard.pendingClearance', 'Pending Clearance'),
      value: stats?.pending_clearance ?? 0,
      icon: <ClockIcon className="h-6 w-6" />,
      color: 'bg-amber-500',
      onClick: () => navigate('/customs-clearing-costs'),
    },
    {
      title: t('dashboard.inProgress', 'In Progress'),
      value: stats?.in_progress ?? 0,
      icon: <DocumentCheckIcon className="h-6 w-6" />,
      color: 'bg-blue-500',
      onClick: () => navigate('/customs-clearing-costs?status=in_progress'),
    },
    {
      title: t('dashboard.clearedThisWeek', 'Cleared This Week'),
      value: stats?.cleared_this_week ?? 0,
      icon: <TruckIcon className="h-6 w-6" />,
      color: 'bg-green-500',
      onClick: () => navigate('/customs-clearing-costs?status=cleared'),
    },
    {
      title: t('dashboard.atBorder', 'At Border'),
      value: stats?.at_border ?? 0,
      icon: <BuildingOfficeIcon className="h-6 w-6" />,
      color: 'bg-purple-500',
      onClick: () => navigate('/border-agent'),
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'cleared': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <DocumentCheckIcon className="h-8 w-8 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.clearanceTitle', 'Customs Clearance Dashboard')}</h1>
          <p className="text-gray-500">{t('dashboard.clearanceSubtitle', 'Track clearance operations')}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl shadow p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))
        ) : (
          statCards.map((card, idx) => (
            <button
              key={idx}
              onClick={card.onClick}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-start hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${card.color} text-white`}>
                  {card.icon}
                </div>
                <ArrowRightIcon className={`h-5 w-5 text-gray-400 ${isRtl ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-sm text-gray-500 mb-1">{card.title}</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(card.value)}</p>
            </button>
          ))
        )}
      </div>

      {/* Pending Clearances */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
              {t('dashboard.pendingClearances', 'Pending Clearances')}
            </span>
            <button
              onClick={() => navigate('/customs-clearing-costs')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('common.viewAll', 'View All')}
              <ArrowRightIcon className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>
        }
      >
        {clearancesLoading ? (
          <LoadingSkeleton lines={5} />
        ) : pendingClearances && pendingClearances.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {pendingClearances.map((clearance) => (
              <div
                key={clearance.id}
                onClick={() => navigate('/customs-clearing-costs')}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-4 px-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <TruckIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{clearance.shipment_sn}</p>
                    <p className="text-sm text-gray-500">{clearance.product_text}</p>
                  </div>
                </div>
                <div className="text-end">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(clearance.clearance_status)}`}>
                    {clearance.clearance_status || 'pending'}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{clearance.pod_name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <DocumentCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">{t('dashboard.noPendingClearances', 'No pending clearances')}</p>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/customs-clearing-costs')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="p-2 bg-purple-100 rounded-lg">
            <DocumentCheckIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900">{t('nav.customsClearance', 'Customs Clearance')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.manageClearances', 'Manage clearances')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/border-agent')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="p-2 bg-amber-100 rounded-lg">
            <BuildingOfficeIcon className="h-6 w-6 text-amber-600" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900">{t('nav.borderAgent', 'Border Agent')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.borderOperations', 'Border operations')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

