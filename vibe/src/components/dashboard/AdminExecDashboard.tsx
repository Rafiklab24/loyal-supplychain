import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  TruckIcon, 
  CurrencyDollarIcon, 
  ScaleIcon,
  BuildingStorefrontIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useStats } from '../../hooks/useStats';
import { useTopTasks } from '../../hooks/useTasks';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { StatCard } from '../common/StatCard';
import { Card } from '../common/Card';
import { LoadingState } from '../common/LoadingState';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { TaskCard } from './TaskCard';
import { formatCurrency, formatNumber, formatWeight } from '../../utils/format';

export function AdminExecDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useStats();
  const { data: topTasks, isLoading: tasksLoading, totalTasks } = useTopTasks(5);
  const { shouldHideTasks } = useUserPreferences();
  
  // Check if tasks section should be hidden based on user preferences
  const hideTasks = shouldHideTasks();

  return (
    <LoadingState
      isLoading={isLoading}
      error={error || (!stats ? new Error('Failed to load dashboard data') : null)}
      data={stats ? [stats] : null}
      skeleton={
        <div className="space-y-6">
          <LoadingSkeleton lines={1} showHeader />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                <div className="h-8 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      }
      emptyState={
        <div className="text-center py-12">
          <p className="text-gray-600">{t('dashboard.noData', 'No dashboard data available')}</p>
        </div>
      }
    >
      {stats && (
        <div className="space-y-6">
          {/* Page Title */}
          <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.title')}</h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title={t('dashboard.totalShipments')}
              value={formatNumber(stats.overview.total_shipments)}
              icon={<TruckIcon className="h-6 w-6" />}
              color="primary"
            />
            <StatCard
              title={t('dashboard.totalValue')}
              value={formatCurrency(stats.overview.total_value_usd)}
              icon={<CurrencyDollarIcon className="h-6 w-6" />}
              color="green"
            />
            <StatCard
              title={t('dashboard.totalWeight')}
              value={formatWeight(stats.overview.total_weight_tons)}
              icon={<ScaleIcon className="h-6 w-6" />}
              color="blue"
            />
            <StatCard
              title={t('dashboard.suppliers')}
              value={formatNumber(stats.overview.total_suppliers)}
              icon={<BuildingStorefrontIcon className="h-6 w-6" />}
              color="purple"
            />
          </div>

          {/* Top 5 Priority Tasks - conditionally rendered based on user preferences */}
          {!hideTasks && (
            <Card 
              title={
                <div className="flex items-center justify-between">
                  <span>{t('dashboard.priorityTasks', 'Priority Tasks')}</span>
                  {totalTasks > 0 && (
                    <button
                      onClick={() => navigate('/tasks')}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {t('dashboard.viewAllTasks', 'View All')} ({totalTasks})
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              }
            >
              {tasksLoading ? (
                <LoadingSkeleton lines={3} />
              ) : topTasks && topTasks.length > 0 ? (
                <div className="space-y-3">
                  {topTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-gray-600">{t('dashboard.noTasks', 'No pending tasks')}</p>
                  <p className="text-sm text-gray-500 mt-1">{t('dashboard.allCaughtUp', 'You\'re all caught up!')}</p>
                </div>
              )}
            </Card>
          )}

          {/* Top Ports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Origins */}
            <Card title={t('dashboard.topOrigins')}>
              <div className="space-y-3">
                {stats.topOrigins.map((origin, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">{origin.port}</span>
                    <span className="text-sm font-semibold text-primary-600">
                      {formatNumber(origin.shipment_count)} {t('dashboard.shipmentCount')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Destinations */}
            <Card title={t('dashboard.topDestinations')}>
              <div className="space-y-3">
                {stats.topDestinations.map((dest, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">{dest.port}</span>
                    <span className="text-sm font-semibold text-primary-600">
                      {formatNumber(dest.shipment_count)} {t('dashboard.shipmentCount')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </LoadingState>
  );
}

