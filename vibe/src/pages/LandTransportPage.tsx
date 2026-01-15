import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TruckIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CheckCircleIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import { useDeliveryStats } from '../hooks/useLandTransport';
import type { DeliveryFilters, ReadyForDeliveryFilters, OngoingTransportFilters } from '../types/api';
import { ReadyForDeliveryTable } from '../components/land-transport/ReadyForDeliveryTable';
import { OutboundDeliveriesTable } from '../components/land-transport/OutboundDeliveriesTable';
import { OngoingTransportBoard } from '../components/land-transport/OngoingTransportBoard';

type TabType = 'ready' | 'ongoing' | 'deliveries';

const LandTransportPage: React.FC = () => {
  const { t } = useTranslation();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('ongoing');
  
  // Ready for delivery filters
  const [readyFilters, setReadyFilters] = useState<ReadyForDeliveryFilters>({
    page: 1,
    limit: 20,
  });
  
  // Ongoing transport filters
  const [ongoingFilters, setOngoingFilters] = useState<OngoingTransportFilters>({
    page: 1,
    limit: 50,
  });
  
  // Deliveries filters
  const [deliveryFilters, setDeliveryFilters] = useState<DeliveryFilters>({
    page: 1,
    limit: 20,
    sort_by: 'delivery_date',
    sort_dir: 'desc',
  });
  
  // Statistics
  const { stats, loading: statsLoading, refresh: refreshStats } = useDeliveryStats();

  const tabs = [
    {
      id: 'ongoing' as TabType,
      label: t('landTransport.ongoingTransports', 'Ongoing Transports'),
      icon: MapIcon,
    },
    {
      id: 'ready' as TabType,
      label: t('landTransport.readyForDelivery', 'Ready for Delivery'),
      icon: ClipboardDocumentListIcon,
    },
    {
      id: 'deliveries' as TabType,
      label: t('landTransport.outboundDeliveries', 'Outbound Deliveries'),
      icon: TruckIcon,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <TruckIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            {t('landTransport.title', 'Land Transport')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 ml-14">
            {t('landTransport.description', 'Manage outbound deliveries and transport assignments')}
          </p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 min-w-[400px]">
          <div className="bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-900/50 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-yellow-600 dark:text-yellow-500 uppercase tracking-wider mb-1">
                {t('landTransport.pending', 'Pending')}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {statsLoading ? '...' : stats?.pending_count || 0}
              </div>
            </div>
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-blue-600 dark:text-blue-500 uppercase tracking-wider mb-1">
                {t('landTransport.inTransit', 'In Transit')}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {statsLoading ? '...' : stats?.in_transit_count || 0}
              </div>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <TruckIcon className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-900/50 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-green-600 dark:text-green-500 uppercase tracking-wider mb-1">
                {t('landTransport.delivered', 'Delivered')}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {statsLoading ? '...' : stats?.delivered_count || 0}
              </div>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                  ${isActive
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[500px]">
        {activeTab === 'ongoing' && (
          <OngoingTransportBoard
            filters={ongoingFilters}
            onFiltersChange={setOngoingFilters}
            onTransportUpdated={refreshStats}
          />
        )}
        
        {activeTab === 'ready' && (
          <ReadyForDeliveryTable
            filters={readyFilters}
            onFiltersChange={setReadyFilters}
            onDeliveryCreated={() => {
              refreshStats();
              // Optionally switch to deliveries tab
            }}
          />
        )}
        
        {activeTab === 'deliveries' && (
          <OutboundDeliveriesTable
            filters={deliveryFilters}
            onFiltersChange={setDeliveryFilters}
            onDeliveryUpdated={refreshStats}
          />
        )}
      </div>
    </div>
  );
};

export default LandTransportPage;
