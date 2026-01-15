import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  TruckIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  DocumentTextIcon,
  CubeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useOngoingTransports, useDeliveryMutations } from '../../hooks/useLandTransport';
import type { OngoingTransportFilters, OngoingTransport, DeliveryStatus } from '../../types/api';
import { formatDateString, formatNumber } from '../../utils/format';
import { Pagination } from '../common/Pagination';

interface OngoingTransportBoardProps {
  filters: OngoingTransportFilters;
  onFiltersChange: (filters: OngoingTransportFilters) => void;
  onTransportUpdated?: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <ClockIcon className="h-4 w-4" />,
  in_transit: <TruckIcon className="h-4 w-4" />,
};

export const OngoingTransportBoard: React.FC<OngoingTransportBoardProps> = ({
  filters,
  onFiltersChange,
  onTransportUpdated,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const { data, loading, error, pagination, stats, refresh } = useOngoingTransports(filters);
  const { updateStatus, loading: mutationLoading } = useDeliveryMutations();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_transit'>('all');

  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchTerm, page: 1 });
  };

  const handleStatusFilterChange = (status: 'all' | 'pending' | 'in_transit') => {
    setStatusFilter(status);
    if (status === 'all') {
      const { status: _, ...rest } = filters;
      onFiltersChange({ ...rest, page: 1 });
    } else {
      onFiltersChange({ ...filters, status, page: 1 });
    }
  };

  const handlePageChange = (page: number) => {
    onFiltersChange({ ...filters, page });
  };

  const handleStatusChange = async (id: string, newStatus: DeliveryStatus) => {
    const result = await updateStatus(id, newStatus);
    if (result) {
      refresh();
      onTransportUpdated?.();
    }
  };

  // Render route with POD → Border → Final Destination
  const renderRoute = (transport: OngoingTransport) => {
    const pod = transport.pod_name;
    const border = isRtl && transport.border_crossing_name_ar 
      ? transport.border_crossing_name_ar 
      : transport.border_crossing_name;
    const finalDest = transport.final_destination_place || transport.destination;

    return (
      <div className="flex items-center gap-1 text-sm" dir="ltr">
        <span className="font-medium text-gray-900 dark:text-white">{pod || '—'}</span>
        {transport.is_cross_border && border && (
          <>
            <span className="text-gray-400">→</span>
            <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
              🚧 {border}
            </span>
          </>
        )}
        <span className="text-gray-400">→</span>
        <span className="font-medium text-emerald-600 dark:text-emerald-400">{finalDest || '—'}</span>
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div 
          onClick={() => handleStatusFilterChange('all')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            statusFilter === 'all' 
              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('landTransport.totalOngoing', 'Total Ongoing')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.total_ongoing}
              </p>
            </div>
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <TruckIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusFilterChange('pending')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            statusFilter === 'pending' 
              ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 ring-2 ring-yellow-500' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-yellow-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-500 uppercase tracking-wider">
                {t('landTransport.pending', 'Pending')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.pending_count}
              </p>
            </div>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusFilterChange('in_transit')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            statusFilter === 'in_transit' 
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-500 uppercase tracking-wider">
                {t('landTransport.inTransit', 'In Transit')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.in_transit_count}
              </p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TruckIcon className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('landTransport.searchOngoing', 'Search shipment, container, driver, truck...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* Loading State */}
      {loading && data.length === 0 ? (
        <div className="p-12 text-center">
          <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center">
          <TruckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('landTransport.noOngoingTransports', 'No Ongoing Transports')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {t('landTransport.noOngoingDescription', 'There are no pending or in-transit deliveries at the moment.')}
          </p>
        </div>
      ) : (
        <>
          {/* Transport Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((transport) => (
              <div
                key={transport.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden ${
                  transport.status === 'in_transit' 
                    ? 'border-blue-200 dark:border-blue-800' 
                    : 'border-yellow-200 dark:border-yellow-800'
                }`}
              >
                {/* Card Header */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  transport.status === 'in_transit' 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : 'bg-yellow-50 dark:bg-yellow-900/20'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[transport.status]}`}>
                      {statusIcons[transport.status]}
                      {t(`landTransport.status_${transport.status}`, transport.status === 'in_transit' ? 'In Transit' : 'Pending')}
                    </span>
                    {transport.delivery_number && (
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        #{transport.delivery_number}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateString(transport.delivery_date)}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Shipment Info */}
                  {transport.shipment_sn && (
                    <div className="flex items-start gap-3">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/shipments/${transport.shipment_id}`}
                          className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {transport.shipment_sn}
                        </Link>
                        <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {transport.shipment_product}
                        </p>
                        {transport.supplier_name && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {transport.supplier_name}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Route */}
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('landTransport.route', 'Route')}
                      </p>
                      {renderRoute(transport)}
                    </div>
                  </div>

                  {/* Container */}
                  {transport.container_id && (
                    <div className="flex items-center gap-3">
                      <CubeIcon className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-mono text-gray-900 dark:text-white">
                          {transport.container_id}
                        </p>
                        {transport.weight_kg && (
                          <p className="text-xs text-gray-500">
                            {formatNumber(transport.weight_kg)} kg
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Driver & Truck */}
                  <div className="flex items-start gap-3">
                    <TruckIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {transport.truck_plate_number ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {transport.truck_plate_number}
                          </p>
                          {transport.driver_name && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {transport.driver_name}
                            </p>
                          )}
                          {transport.transport_company_name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {transport.transport_company_name}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                          {t('landTransport.noTruckAssigned', 'No truck assigned')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact */}
                  {transport.driver_phone && (
                    <div className="flex items-center gap-3">
                      <PhoneIcon className="h-5 w-5 text-gray-400" />
                      <a 
                        href={`tel:${transport.driver_phone}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {transport.driver_phone}
                      </a>
                    </div>
                  )}

                  {/* Border ETA */}
                  {transport.is_cross_border && transport.border_eta && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <ClockIcon className="h-4 w-4 text-amber-600" />
                      <span className="text-xs text-amber-700 dark:text-amber-300">
                        {t('landTransport.borderETA', 'Border ETA')}: {formatDateString(transport.border_eta)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer - Actions */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {transport.transport_cost && (
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {formatNumber(transport.transport_cost)} {transport.transport_currency || 'USD'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {transport.status === 'pending' && (
                      <button
                        onClick={() => handleStatusChange(transport.id, 'in_transit')}
                        disabled={mutationLoading}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {t('landTransport.markInTransit', 'Start Transit')}
                      </button>
                    )}
                    {transport.status === 'in_transit' && (
                      <button
                        onClick={() => handleStatusChange(transport.id, 'delivered')}
                        disabled={mutationLoading}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {t('landTransport.markDelivered', 'Mark Delivered')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OngoingTransportBoard;

