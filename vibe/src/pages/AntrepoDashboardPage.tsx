/**
 * Antrepo Dashboard Page
 * Main interface for customs warehouse management
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CubeIcon,
  TruckIcon,
  ArrowRightOnRectangleIcon,
  ClockIcon,
  UserGroupIcon,
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import {
  useAntrepoDashboard,
  useAntrepoInventory,
  usePendingArrivals,
  useActivityLog,
  useAntrepoLots,
  useArchiveInventory,
} from '../hooks/useAntrepo';
import { useElleclemeRequests, useElleclemeDashboard } from '../hooks/useEllecleme';
import { getStatusColor, type ElleclemeRequest, type ElleclemeStatus } from '../services/ellecleme';
import { Link } from 'react-router-dom';
import { getExitTypeLabel, getStatusLabel } from '../services/antrepo';
import type { AntrepoInventory, PendingArrival, ActivityLogEntry } from '../services/antrepo';
import { SHIPMENT_STATUS_CONFIG } from '../types/api';
import AntrepoEntryModal from '../components/antrepo/AntrepoEntryModal';
import AntrepoExitModal from '../components/antrepo/AntrepoExitModal';
import ElleclemeRequestModal from '../components/ellecleme/ElleclemeRequestModal';

type TabType = 'stock' | 'arrivals' | 'activity' | 'ellecleme';

// Helper to get translated shipment status
const getShipmentStatusLabel = (status: string, isArabic: boolean): string => {
  const config = SHIPMENT_STATUS_CONFIG[status as keyof typeof SHIPMENT_STATUS_CONFIG];
  if (config) {
    return isArabic ? config.label_ar : config.label;
  }
  return status;
};

// Helper to get status badge colors
const getShipmentStatusColors = (status: string): string => {
  const config = SHIPMENT_STATUS_CONFIG[status as keyof typeof SHIPMENT_STATUS_CONFIG];
  if (config) {
    return `${config.bgColor} ${config.color}`;
  }
  return 'bg-slate-100 text-slate-700';
};

export default function AntrepoDashboardPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  // State
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [elleclemeModalOpen, setElleclemeModalOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<AntrepoInventory | null>(null);
  const [selectedArrival, setSelectedArrival] = useState<PendingArrival | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [inventoryToArchive, setInventoryToArchive] = useState<AntrepoInventory | null>(null);

  // Mutations
  const archiveInventory = useArchiveInventory();

  // Data queries - Antrepo is a single customs warehouse, no filtering needed
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useAntrepoDashboard();
  const { data: inventoryData, isLoading: inventoryLoading } = useAntrepoInventory({
    search: searchTerm || undefined,
    page: 1,
    limit: 50,
  });
  const { data: pendingArrivals, isLoading: arrivalsLoading } = usePendingArrivals();
  const { data: activityLog, isLoading: activityLoading } = useActivityLog({ limit: 50 });
  const { data: lots } = useAntrepoLots();
  
  // Elleçleme data for Hamza to see his requests
  const { data: elleclemeData, isLoading: elleclemeLoading, refetch: refetchEllecleme } = useElleclemeRequests({
    page: 1,
    limit: 50,
  });
  const { data: elleclemeDashboard } = useElleclemeDashboard();

  // Handlers
  const handleRecordEntry = (arrival?: PendingArrival) => {
    setSelectedArrival(arrival || null);
    setEntryModalOpen(true);
  };

  const handleRecordExit = (inventory: AntrepoInventory) => {
    setSelectedInventory(inventory);
    setExitModalOpen(true);
  };

  const handleEllecleme = (inventory: AntrepoInventory) => {
    setSelectedInventory(inventory);
    setElleclemeModalOpen(true);
  };

  const handleArchiveClick = (inventory: AntrepoInventory) => {
    setInventoryToArchive(inventory);
    setArchiveConfirmOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!inventoryToArchive) return;
    
    try {
      await archiveInventory.mutateAsync({ 
        id: inventoryToArchive.id, 
        reason: 'Reverted by user' 
      });
      setArchiveConfirmOpen(false);
      setInventoryToArchive(null);
    } catch (error) {
      console.error('Error archiving inventory:', error);
    }
  };

  const handleRefresh = () => {
    refetchDashboard();
  };

  // Format number - always use English numerals for consistency
  const formatNumber = (num: number | undefined, decimals = 2) => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  const tabs = [
    { id: 'stock' as const, label: t('antrepo.currentStock', 'المخزون الحالي'), icon: CubeIcon },
    { id: 'arrivals' as const, label: t('antrepo.pendingArrivals', 'الشحنات القادمة'), icon: TruckIcon },
    { id: 'ellecleme' as const, label: t('nav.ellecleme', 'إليجلمه'), icon: WrenchScrewdriverIcon, count: elleclemeDashboard?.summary?.active_requests || 0 },
    { id: 'activity' as const, label: t('antrepo.activityLog', 'سجل النشاط'), icon: ClockIcon },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <ArchiveBoxIcon className="h-8 w-8 text-indigo-600" />
              {t('antrepo.title', 'إدارة الأنتريبو')}
            </h1>
            <p className="text-slate-600 mt-1">
              {t('antrepo.subtitle', 'نظام إدارة المستودع الجمركي')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleRecordEntry()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              {t('antrepo.recordEntry', 'تسجيل دخول')}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards - Dual Stock Display */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* Customs Stock (Paperwork) */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 shadow-sm border border-amber-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <DocumentTextIcon className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm text-amber-700 font-medium">{t('antrepo.customsStock', 'المخزون الجمركي')}</span>
          </div>
          <div className="text-2xl font-bold text-amber-800">
            {dashboardLoading ? '...' : formatNumber(dashboardData?.summary.total_customs_mt || dashboardData?.summary.total_quantity_mt)} <span className="text-sm font-normal text-amber-600">MT</span>
          </div>
          <div className="text-xs text-amber-600 mt-1">
            {formatNumber(dashboardData?.summary.total_customs_bags || 0, 0)} {t('antrepo.bags', 'كيس')}
          </div>
        </div>

        {/* Actual Stock (Physical) */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 shadow-sm border border-emerald-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CubeIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm text-emerald-700 font-medium">{t('antrepo.actualStock', 'المخزون الفعلي')}</span>
          </div>
          <div className="text-2xl font-bold text-emerald-800">
            {dashboardLoading ? '...' : formatNumber(dashboardData?.summary.total_actual_mt || dashboardData?.summary.total_quantity_mt)} <span className="text-sm font-normal text-emerald-600">MT</span>
          </div>
          <div className="text-xs text-emerald-600 mt-1">
            {formatNumber(dashboardData?.summary.total_actual_bags || 0, 0)} {t('antrepo.bags', 'كيس')}
          </div>
        </div>

        {/* Discrepancy */}
        <div className={`rounded-xl p-4 shadow-sm border ${
          (dashboardData?.summary.total_discrepancy_mt || 0) !== 0 
            ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200' 
            : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${
              (dashboardData?.summary.total_discrepancy_mt || 0) !== 0 ? 'bg-red-100' : 'bg-slate-100'
            }`}>
              <ArrowRightOnRectangleIcon className={`h-5 w-5 ${
                (dashboardData?.summary.total_discrepancy_mt || 0) !== 0 ? 'text-red-600' : 'text-slate-500'
              }`} />
            </div>
            <span className={`text-sm font-medium ${
              (dashboardData?.summary.total_discrepancy_mt || 0) !== 0 ? 'text-red-700' : 'text-slate-600'
            }`}>{t('antrepo.discrepancy', 'الفرق')}</span>
          </div>
          <div className={`text-2xl font-bold ${
            (dashboardData?.summary.total_discrepancy_mt || 0) > 0 ? 'text-red-700' :
            (dashboardData?.summary.total_discrepancy_mt || 0) < 0 ? 'text-green-700' : 'text-slate-800'
          }`}>
            {dashboardLoading ? '...' : (
              <>
                {(dashboardData?.summary.total_discrepancy_mt || 0) > 0 ? '-' : '+'}
                {formatNumber(Math.abs(dashboardData?.summary.total_discrepancy_mt || 0))}
              </>
            )} <span className="text-sm font-normal text-slate-500">MT</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {dashboardData?.summary.items_with_discrepancy || 0} {t('antrepo.itemsWithDiff', 'عنصر بفرق')}
          </div>
        </div>

        {/* Lots in Use */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <ArchiveBoxIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-sm text-slate-600">{t('antrepo.lotsInUse', 'الأقسام')}</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {dashboardLoading ? '...' : dashboardData?.summary.lots_in_use || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {dashboardData?.summary.total_items || 0} {t('antrepo.items', 'عنصر')}
          </div>
        </div>

        {/* Pending Arrivals */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TruckIcon className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-slate-600">{t('antrepo.pendingArrivals', 'شحنات قادمة')}</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {dashboardLoading ? '...' : dashboardData?.pending_arrivals_count || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {t('antrepo.awaitingEntry', 'في انتظار الدخول')}
          </div>
        </div>
      </div>

      {/* By Lot Breakdown (compact bar) */}
      {dashboardData?.by_lot && dashboardData.by_lot.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('antrepo.byLot', 'حسب القسم')}</h3>
          <div className="flex flex-wrap gap-2">
            {dashboardData.by_lot.map((lot) => (
              <div
                key={lot.lot_id}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200"
              >
                <span className="font-mono text-sm font-semibold text-indigo-600">{lot.lot_code}</span>
                <span className="text-sm text-slate-600">
                  {formatNumber(lot.current_quantity_mt, 1)} MT
                </span>
                <span className="text-xs text-slate-400">({lot.item_count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="hidden md:inline">{tab.label}</span>
              {'count' in tab && tab.count > 0 && (
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs font-semibold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          
          {/* Search (shown on stock tab) */}
          {activeTab === 'stock' && (
            <div className="flex-1 flex justify-end px-4 py-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('common.search', 'بحث...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {/* Current Stock Tab */}
          {activeTab === 'stock' && (
            <div>
              {inventoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : inventoryData?.data.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CubeIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>{t('antrepo.noStock', 'لا توجد بضائع في المخزون')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-start py-3 px-2 font-semibold text-slate-700">{t('antrepo.lot', 'القسم')}</th>
                        <th className="text-start py-3 px-2 font-semibold text-slate-700">{t('common.product', 'المنتج')}</th>
                        <th className="text-start py-3 px-2 font-semibold text-amber-700 bg-amber-50">{t('antrepo.customsQty', 'جمركي')}</th>
                        <th className="text-start py-3 px-2 font-semibold text-emerald-700 bg-emerald-50">{t('antrepo.actualQty', 'فعلي')}</th>
                        <th className="text-start py-3 px-2 font-semibold text-slate-700">{t('antrepo.entryDate', 'الدخول')}</th>
                        <th className="text-start py-3 px-2 font-semibold text-slate-700">{t('common.status', 'الحالة')}</th>
                        <th className="text-start py-3 px-2 font-semibold text-slate-700">{t('common.actions', 'إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryData?.data.map((item) => {
                        const customsMt = item.customs_quantity_mt ?? item.original_quantity_mt;
                        const actualMt = item.actual_quantity_mt ?? item.current_quantity_mt;
                        const hasDiscrepancy = (item.weight_discrepancy_mt ?? 0) !== 0;
                        
                        return (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-2">
                              <span className="font-mono font-semibold text-indigo-600">{item.lot_code}</span>
                            </td>
                            <td className="py-3 px-2">
                              <div>
                                <span className="font-medium text-slate-800">{item.product_text || '-'}</span>
                                {item.shipment_sn && (
                                  <span className="block text-xs text-slate-500">{item.shipment_sn}</span>
                                )}
                              </div>
                            </td>
                            {/* Customs Stock (Paperwork) */}
                            <td className="py-3 px-2 bg-amber-50/50">
                              <span className="font-semibold text-amber-800">{formatNumber(customsMt)}</span>
                              <span className="text-amber-600 text-xs"> MT</span>
                              {item.customs_bags && (
                                <span className="block text-xs text-amber-600">
                                  {formatNumber(item.customs_bags, 0)} {t('antrepo.bags', 'كيس')}
                                </span>
                              )}
                            </td>
                            {/* Actual Stock (Physical) */}
                            <td className="py-3 px-2 bg-emerald-50/50">
                              <span className="font-semibold text-emerald-800">{formatNumber(actualMt)}</span>
                              <span className="text-emerald-600 text-xs"> MT</span>
                              {hasDiscrepancy && (
                                <span className={`block text-xs font-medium ${
                                  (item.weight_discrepancy_mt || 0) > 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {(item.weight_discrepancy_mt || 0) > 0 ? '▼' : '▲'} {Math.abs(item.weight_discrepancy_mt || 0).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-slate-600 text-xs">
                              {item.entry_date ? new Date(item.entry_date).toLocaleDateString('en-GB') : '-'}
                              <span className={`block ${
                                (item.days_in_antrepo || 0) > 30 ? 'text-amber-600 font-semibold' : 'text-slate-400'
                              }`}>
                                {item.days_in_antrepo || 0} {t('antrepo.days', 'يوم')}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === 'in_stock' ? 'bg-emerald-100 text-emerald-700' :
                                item.status === 'partial_exit' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {getStatusLabel(item.status, lang)}
                              </span>
                              {item.is_third_party && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                                  {t('antrepo.thirdPartyBadge', 'أمانة')}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleRecordExit(item)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                  {t('antrepo.exit', 'خروج')}
                                </button>
                                <button
                                  onClick={() => handleEllecleme(item)}
                                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title={t('nav.ellecleme', 'Elleçleme')}
                                >
                                  <WrenchScrewdriverIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleArchiveClick(item)}
                                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title={t('antrepo.archive', 'أرشفة')}
                                >
                                  <ArchiveBoxIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Pending Arrivals Tab */}
          {activeTab === 'arrivals' && (
            <div>
              {arrivalsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : !pendingArrivals || pendingArrivals.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <TruckIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>{t('antrepo.noPendingArrivals', 'لا توجد شحنات قادمة')}</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pendingArrivals.map((arrival) => (
                    <div
                      key={arrival.id}
                      className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="font-mono font-bold text-indigo-600">{arrival.sn}</span>
                          {arrival.lot_code && (
                            <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                              → {arrival.lot_code}
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getShipmentStatusColors(arrival.status)}`}>
                          {getShipmentStatusLabel(arrival.status, isRtl)}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm mb-4">
                        <p className="text-slate-800 font-medium">{arrival.product_text || '-'}</p>
                        <p className="text-slate-600" dir="ltr" style={{ textAlign: isRtl ? 'right' : 'left' }}>
                          {arrival.weight_ton ? `${formatNumber(arrival.weight_ton)} MT` : '-'}
                          {arrival.container_count ? ` • ${arrival.container_count} ${t('common.containers', 'Container')}` : ''}
                        </p>
                        {arrival.eta && (
                          <p className="text-slate-500" dir="ltr" style={{ textAlign: isRtl ? 'right' : 'left' }}>
                            ETA: {new Date(arrival.eta).toLocaleDateString('en-GB')}
                          </p>
                        )}
                        {arrival.supplier_name && (
                          <p className="text-slate-500">{arrival.supplier_name}</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleRecordEntry(arrival)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                      >
                        <PlusIcon className="h-4 w-4" />
                        {t('antrepo.recordEntry', 'تسجيل دخول')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Log Tab */}
          {activeTab === 'activity' && (
            <div>
              {activityLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : !activityLog || activityLog.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ClockIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>{t('antrepo.noActivity', 'لا يوجد نشاط مسجل')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLog.map((entry, index) => (
                    <div
                      key={`${entry.reference_id}-${index}`}
                      className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <div className={`p-2 rounded-lg ${
                        entry.activity_type === 'entry' ? 'bg-emerald-100' :
                        entry.activity_type.startsWith('exit') ? 'bg-red-100' :
                        'bg-blue-100'
                      }`}>
                        {entry.activity_type === 'entry' ? (
                          <PlusIcon className={`h-5 w-5 ${
                            entry.activity_type === 'entry' ? 'text-emerald-600' : 'text-blue-600'
                          }`} />
                        ) : entry.activity_type.startsWith('exit') ? (
                          <ArrowRightOnRectangleIcon className="h-5 w-5 text-red-600" />
                        ) : (
                          <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-semibold ${
                            entry.activity_type === 'entry' ? 'text-emerald-700' :
                            entry.activity_type.startsWith('exit') ? 'text-red-700' :
                            'text-blue-700'
                          }`}>
                            {entry.activity_type === 'entry' ? t('antrepo.entryActivity', 'دخول') :
                             entry.activity_type === 'exit_transit' ? t('antrepo.exitTransit', 'خروج ترانزيت') :
                             entry.activity_type === 'exit_port' ? t('antrepo.exitPort', 'خروج ميناء') :
                             entry.activity_type === 'exit_domestic' ? t('antrepo.exitDomestic', 'خروج محلي') :
                             entry.activity_type === 'handling' ? t('antrepo.handlingActivity', 'عملية إليجلمه') :
                             entry.activity_type}
                          </span>
                          <span className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                            {entry.lot_code}
                          </span>
                        </div>
                        
                        <p className="text-sm text-slate-700">
                          {entry.product_text || '-'}
                          {entry.quantity_mt && ` • ${formatNumber(entry.quantity_mt)} MT`}
                        </p>
                        
                        {entry.reference_no && (
                          <p className="text-xs text-slate-500 mt-0.5">{entry.reference_no}</p>
                        )}
                      </div>
                      
                      <div className="text-right text-xs text-slate-500 shrink-0">
                        <div>{new Date(entry.activity_date).toLocaleDateString('en-GB')}</div>
                        {entry.created_by_name && <div>{entry.created_by_name}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Elleçleme Tab - Hamza sees his requests */}
          {activeTab === 'ellecleme' && (
            <div>
              {elleclemeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : !elleclemeData?.data || elleclemeData.data.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <WrenchScrewdriverIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>{t('ellecleme.empty.noRequests', 'لا توجد طلبات إليجلمه')}</p>
                  <p className="text-xs mt-1">{t('ellecleme.empty.noRequestsHint', 'أنشئ طلباً من قائمة المخزون')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {elleclemeData.data.map((request: ElleclemeRequest) => (
                    <Link
                      key={request.id}
                      to={`/ellecleme/requests/${request.id}`}
                      className="block p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono font-bold text-blue-600">{request.request_number}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                              {t(`ellecleme.statuses.${request.status}`, request.status)}
                            </span>
                            {request.priority !== 'normal' && (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                request.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                request.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {t(`ellecleme.priorities.${request.priority}`, request.priority)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-800 font-medium mb-1">
                            {request.activity_code} - {lang === 'ar' ? request.activity_name_ar : lang === 'tr' ? request.activity_name_tr : request.activity_name}
                          </p>
                          <p className="text-sm text-slate-600">{request.product_text}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>{request.lot_code}</span>
                            {request.quantity_mt && <span>{formatNumber(request.quantity_mt)} MT</span>}
                            {request.processed_by_name && (
                              <span className="text-blue-600">
                                {t('ellecleme.workflow.processedBy', 'يعالج بواسطة')}: {request.processed_by_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {request.requested_date && new Date(request.requested_date).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                      
                      {/* Status hint for Hamza */}
                      {request.status === 'draft' && (
                        <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          {t('ellecleme.workflow.awaitingPickup', 'في انتظار استلام فريق التخليص')}
                        </div>
                      )}
                      {request.status === 'pending_confirmation' && (
                        <div className="mt-2 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                          {t('ellecleme.workflow.awaitingConfirmation', 'في انتظار تأكيدك')} - {t('common.clickToReview', 'انقر للمراجعة')}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {entryModalOpen && (
        <AntrepoEntryModal
          isOpen={entryModalOpen}
          onClose={() => {
            setEntryModalOpen(false);
            setSelectedArrival(null);
          }}
          pendingArrival={selectedArrival}
        />
      )}

      {exitModalOpen && selectedInventory && (
        <AntrepoExitModal
          isOpen={exitModalOpen}
          onClose={() => {
            setExitModalOpen(false);
            setSelectedInventory(null);
          }}
          inventory={selectedInventory}
        />
      )}

      {/* Elleçleme Request Modal */}
      {elleclemeModalOpen && selectedInventory && (
        <ElleclemeRequestModal
          isOpen={elleclemeModalOpen}
          onClose={() => {
            setElleclemeModalOpen(false);
            setSelectedInventory(null);
          }}
          inventory={selectedInventory}
          onSuccess={() => {
            // Optionally refetch data or show success message
          }}
        />
      )}

      {/* Archive Confirmation Dialog */}
      {archiveConfirmOpen && inventoryToArchive && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setArchiveConfirmOpen(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-100 rounded-full">
                  <ArchiveBoxIcon className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {t('antrepo.archiveTitle', 'أرشفة وإلغاء العملية')}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {t('antrepo.archiveSubtitle', 'سيتم التراجع عن عملية الاستلام')}
                  </p>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="text-sm">
                  <p className="font-medium text-slate-700 mb-2">
                    {t('antrepo.archiveDetails', 'تفاصيل البند:')}
                  </p>
                  <div className="space-y-1 text-slate-600">
                    <p><span className="font-medium">{t('common.product', 'المنتج')}:</span> {inventoryToArchive.product_text || '-'}</p>
                    <p><span className="font-medium">{t('antrepo.lot', 'القسم')}:</span> {inventoryToArchive.lot_code}</p>
                    <p><span className="font-medium">{t('antrepo.quantity', 'الكمية')}:</span> {inventoryToArchive.current_quantity_mt} MT</p>
                    {inventoryToArchive.shipment_sn && (
                      <p><span className="font-medium">{t('common.shipment', 'الشحنة')}:</span> {inventoryToArchive.shipment_sn}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
                <p className="text-sm text-amber-800">
                  {t('antrepo.archiveWarning', 'سيتم إلغاء تسجيل الاستلام وإعادة حالة الشحنة إلى ما قبل الاستلام.')}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setArchiveConfirmOpen(false);
                    setInventoryToArchive(null);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleArchiveConfirm}
                  disabled={archiveInventory.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 rounded-xl transition-colors"
                >
                  {archiveInventory.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span>
                      {t('common.processing', 'جاري المعالجة...')}
                    </span>
                  ) : (
                    t('antrepo.confirmArchive', 'تأكيد الأرشفة')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
