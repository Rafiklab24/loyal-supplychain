import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  TruckIcon, 
  ClockIcon,
  MapPinIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../common/Card';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { formatNumber, formatDateString } from '../../utils/format';
import { apiClient } from '../../services/api';

interface LogisticsStats {
  in_transit: number;
  arriving_this_week: number;
  pending_documents: number;
  pending_delivery: number;
}

interface UpcomingShipment {
  id: string;
  sn: string;
  product_text: string;
  eta: string;
  pod_name: string;
  status: string;
}

export function LogisticsDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  // Fetch logistics-specific stats
  const { data: stats, isLoading: statsLoading } = useQuery<LogisticsStats>({
    queryKey: ['logistics-dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/logistics-stats');
      return response.data;
    },
  });

  // Fetch upcoming arrivals
  const { data: upcomingShipments, isLoading: shipmentsLoading } = useQuery<UpcomingShipment[]>({
    queryKey: ['upcoming-shipments'],
    queryFn: async () => {
      const response = await apiClient.get('/shipments', {
        params: {
          status: 'in_transit,arrived',
          sortBy: 'eta',
          sortOrder: 'asc',
          limit: 5,
        },
      });
      return response.data.shipments || [];
    },
  });

  const statCards = [
    {
      title: t('dashboard.inTransit', 'In Transit'),
      value: stats?.in_transit ?? 0,
      icon: <TruckIcon className="h-6 w-6" />,
      color: 'bg-blue-500',
      onClick: () => navigate('/shipments?status=in_transit'),
    },
    {
      title: t('dashboard.arrivingThisWeek', 'Arriving This Week'),
      value: stats?.arriving_this_week ?? 0,
      icon: <ClockIcon className="h-6 w-6" />,
      color: 'bg-amber-500',
      onClick: () => navigate('/shipment-tracking'),
    },
    {
      title: t('dashboard.pendingDocuments', 'Pending Documents'),
      value: stats?.pending_documents ?? 0,
      icon: <DocumentTextIcon className="h-6 w-6" />,
      color: 'bg-red-500',
      onClick: () => navigate('/shipments?paperwork_status=incomplete'),
    },
    {
      title: t('dashboard.pendingDelivery', 'Pending Delivery'),
      value: stats?.pending_delivery ?? 0,
      icon: <MapPinIcon className="h-6 w-6" />,
      color: 'bg-green-500',
      onClick: () => navigate('/land-transport'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <TruckIcon className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.logisticsTitle', 'Logistics Dashboard')}</h1>
          <p className="text-gray-500">{t('dashboard.logisticsSubtitle', 'Track shipments and deliveries')}</p>
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

      {/* Upcoming Arrivals */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-amber-500" />
              {t('dashboard.upcomingArrivals', 'Upcoming Arrivals')}
            </span>
            <button
              onClick={() => navigate('/shipment-tracking')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('common.viewAll', 'View All')}
              <ArrowRightIcon className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>
        }
      >
        {shipmentsLoading ? (
          <LoadingSkeleton lines={5} />
        ) : upcomingShipments && upcomingShipments.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {upcomingShipments.map((shipment) => (
              <div
                key={shipment.id}
                onClick={() => navigate(`/shipments/${shipment.id}`)}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-4 px-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <TruckIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{shipment.sn}</p>
                    <p className="text-sm text-gray-500">{shipment.product_text}</p>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-sm font-medium text-gray-900">
                    {shipment.eta ? formatDateString(shipment.eta) : '—'}
                  </p>
                  <p className="text-xs text-gray-500">{shipment.pod_name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <TruckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">{t('dashboard.noUpcomingArrivals', 'No upcoming arrivals')}</p>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/shipments')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <TruckIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900">{t('nav.shipments', 'Shipments')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.viewAllShipments', 'View all shipments')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/shipment-tracking')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="p-2 bg-amber-100 rounded-lg">
            <MapPinIcon className="h-6 w-6 text-amber-600" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900">{t('nav.shipmentTracking', 'Tracking')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.trackShipments', 'Track shipments')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/land-transport')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="p-2 bg-green-100 rounded-lg">
            <ExclamationTriangleIcon className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900">{t('nav.landTransport', 'Land Transport')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.manageDeliveries', 'Manage deliveries')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

