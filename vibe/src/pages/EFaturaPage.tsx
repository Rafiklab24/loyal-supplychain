/**
 * E-Fatura Page
 * Turkish electronic invoice management interface
 * 
 * Three tabs:
 * - Pending: Cross-border AND selling shipments that need E-Fatura assignment (mandatory)
 * - Archive: Completed E-Fatura + Non-cross-border shipments (not required)
 * - Beyaname: Import shipments destined to Antrepo warehouse (customs declaration)
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  XMarkIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { EFaturaCard } from '../components/efatura/EFaturaCard';
import { BeyanameCard } from '../components/efatura/BeyanameCard';
import { Pagination } from '../components/common/Pagination';
import { Spinner } from '../components/common/Spinner';
import { useToast } from '../components/common/Toast';
import {
  getPendingEFatura,
  getArchiveEFatura,
  getEFaturaSummary,
  saveEFaturaNumber,
  getBeyanamePending,
  getBeyanameSummary,
  saveBeyaname,
  updateBeyanameStatus,
} from '../services/efatura';
import type { 
  EFaturaShipment, 
  EFaturaPendingParams, 
  EFaturaArchiveParams, 
  EFaturaSummary,
  BeyanameShipment,
  BeyanamePendingParams,
  BeyanameSummary,
} from '../services/efatura';
import { uploadDocument } from '../services/documents';

type TabType = 'pending' | 'archive' | 'beyaname';

const EFaturaPage = () => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const toast = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // State
  const [shipments, setShipments] = useState<EFaturaShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Archive filters
  const [crossBorderOnly, setCrossBorderOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Summary stats
  const [summary, setSummary] = useState<EFaturaSummary>({
    pending: 0,
    archive: 0,
    completed: 0,
    not_required: 0,
    sales_pending: 0,
  });

  // Beyaname state
  const [beyanameShipments, setBeyanameShipments] = useState<BeyanameShipment[]>([]);
  const [beyanameSummary, setBeyanameSummary] = useState<BeyanameSummary>({
    pending: 0,
    issued: 0,
    completed: 0,
    total: 0,
  });
  const [beyanameStatus, setBeyanameStatus] = useState<'pending' | 'issued' | 'completed' | 'all'>('pending');

  // Fetch summary counts
  const fetchSummary = useCallback(async () => {
    try {
      const [efaturaData, beyanameData] = await Promise.all([
        getEFaturaSummary(),
        getBeyanameSummary(),
      ]);
      setSummary(efaturaData);
      setBeyanameSummary(beyanameData);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  }, []);

  // Fetch data based on active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const params: EFaturaPendingParams = {
          page: pagination.page,
          limit: pagination.limit,
          search: search || undefined,
        };
        const response = await getPendingEFatura(params);
        setShipments(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          pages: response.pagination.pages,
        }));
      } else if (activeTab === 'archive') {
        const params: EFaturaArchiveParams = {
          page: pagination.page,
          limit: pagination.limit,
          search: search || undefined,
          cross_border_only: crossBorderOnly || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        };
        const response = await getArchiveEFatura(params);
        setShipments(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          pages: response.pagination.pages,
        }));
      } else if (activeTab === 'beyaname') {
        const params: BeyanamePendingParams = {
          page: pagination.page,
          limit: pagination.limit,
          search: search || undefined,
          status: beyanameStatus,
        };
        const response = await getBeyanamePending(params);
        setBeyanameShipments(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          pages: response.pagination.pages,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Don't show toast on every retry - just log the error
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pagination.page, pagination.limit, search, crossBorderOnly, dateFrom, dateTo, beyanameStatus, isRtl]);

  // Initial load
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle search with debounce
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch('');
    setSearchInput('');
    setPagination(prev => ({ ...prev, page: 1 }));
    // Reset filters when switching tabs
    if (tab === 'pending' || tab === 'beyaname') {
      setCrossBorderOnly(false);
      setDateFrom('');
      setDateTo('');
    }
    if (tab !== 'beyaname') {
      setBeyanameStatus('pending');
    }
  };

  // Handle saving beyaname
  const handleSaveBeyaname = async (shipmentId: string, beyanameNumber: string, beyanameDate?: string, file?: File) => {
    try {
      // If file is provided, upload it first
      if (file) {
        console.log('📄 Uploading Beyaname document:', file.name);
        await uploadDocument({
          file,
          entity_type: 'shipment',
          entity_id: shipmentId,
          doc_type: 'beyaname',
          is_draft: false,
          notes: `Beyaname: ${beyanameNumber}`,
        });
        console.log('✅ Beyaname document uploaded successfully');
      }
      
      await saveBeyaname(shipmentId, beyanameNumber, beyanameDate);
      toast.success(isRtl ? 'تم حفظ البيانامة بنجاح' : 'Beyaname saved successfully');
      
      // Refresh data and summary
      fetchData();
      fetchSummary();
    } catch (error: any) {
      console.error('❌ Failed to save Beyaname:', error);
      toast.error(isRtl ? 'فشل في حفظ البيانامة' : 'Failed to save Beyaname');
    }
  };

  // Handle marking beyaname as complete
  const handleMarkBeyanameComplete = async (shipmentId: string) => {
    try {
      await updateBeyanameStatus(shipmentId, 'completed');
      toast.success(isRtl ? 'تم تحديث الحالة بنجاح' : 'Status updated successfully');
      fetchData();
      fetchSummary();
    } catch (error) {
      console.error('Failed to update beyaname status:', error);
      toast.error(isRtl ? 'فشل في تحديث الحالة' : 'Failed to update status');
    }
  };

  // Handle mark complete (with optional file upload)
  const handleMarkComplete = async (shipmentId: string, eFaturaNumber: string, file?: File) => {
    try {
      // If file is provided, upload it first
      if (file) {
        console.log('📄 Uploading E-Fatura document:', file.name);
        await uploadDocument({
          file,
          entity_type: 'shipment',
          entity_id: shipmentId,
          doc_type: 'e_fatura',
          is_draft: false,
          notes: `E-Fatura: ${eFaturaNumber}`,
        });
        console.log('✅ E-Fatura document uploaded successfully');
      }
      
      await saveEFaturaNumber(shipmentId, eFaturaNumber);
      toast.success(isRtl ? 'تم حفظ الفاتورة الإلكترونية بنجاح' : 'E-Fatura saved successfully');
      
      // Refresh data and summary
      fetchData();
      fetchSummary();
    } catch (error: any) {
      console.error('❌ Failed to save E-Fatura:', error);
      toast.error(isRtl ? 'فشل في حفظ الفاتورة الإلكترونية' : 'Failed to save E-Fatura');
    }
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Clear archive filters
  const clearFilters = () => {
    setCrossBorderOnly(false);
    setDateFrom('');
    setDateTo('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = crossBorderOnly || dateFrom || dateTo;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DocumentTextIcon className="h-8 w-8 text-emerald-600" />
            </div>
            {isRtl ? 'الفاتورة الإلكترونية (E-Fatura)' : 'E-Fatura (Turkish Invoice)'}
          </h1>
          <p className="text-gray-600 mt-1 ms-14">
            {isRtl 
              ? 'إدارة الفواتير الإلكترونية التركية للشحنات العابرة للحدود' 
              : 'Manage Turkish electronic invoices for cross-border shipments'
            }
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 min-w-[450px]">
          <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">
                {isRtl ? 'قيد الانتظار' : 'Pending'}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {loading && activeTab === 'pending' ? '...' : summary.pending}
              </div>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <ClockIcon className="h-6 w-6 text-amber-600" />
            </div>
          </div>

          <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-1">
                {isRtl ? 'البيانامة' : 'Beyaname'}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {loading && activeTab === 'beyaname' ? '...' : beyanameSummary.pending}
              </div>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg">
              <BuildingOfficeIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-white border border-green-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">
                {isRtl ? 'الأرشيف' : 'Archive'}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {loading && activeTab === 'archive' ? '...' : summary.archive}
              </div>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <ArchiveBoxIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              type="button"
              onClick={() => handleTabChange('pending')}
              className={`
                flex-1 py-4 px-6 text-center font-medium text-sm transition-colors
                flex items-center justify-center gap-2
                ${activeTab === 'pending'
                  ? 'border-b-2 border-amber-500 text-amber-600 bg-amber-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <ExclamationTriangleIcon className="h-5 w-5" />
              <span>{isRtl ? 'قيد الانتظار (إلزامي)' : 'Pending (Mandatory)'}</span>
              {summary.pending > 0 && (
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {summary.pending}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('beyaname')}
              className={`
                flex-1 py-4 px-6 text-center font-medium text-sm transition-colors
                flex items-center justify-center gap-2
                ${activeTab === 'beyaname'
                  ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <BuildingOfficeIcon className="h-5 w-5" />
              <span>{isRtl ? 'البيانامة (أنتريبو)' : 'Beyaname (Antrepo)'}</span>
              {beyanameSummary.pending > 0 && (
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {beyanameSummary.pending}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('archive')}
              className={`
                flex-1 py-4 px-6 text-center font-medium text-sm transition-colors
                flex items-center justify-center gap-2
                ${activeTab === 'archive'
                  ? 'border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <ArchiveBoxIcon className="h-5 w-5" />
              <span>{isRtl ? 'الأرشيف' : 'Archive'}</span>
              {summary.archive > 0 && (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {summary.archive}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Description */}
        <div className={`px-6 py-3 text-sm ${
          activeTab === 'pending' ? 'bg-amber-50 text-amber-800' : 
          activeTab === 'beyaname' ? 'bg-purple-50 text-purple-800' :
          'bg-emerald-50 text-emerald-800'
        }`}>
          {activeTab === 'pending' ? (
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {isRtl 
                ? 'الشحنات العابرة للحدود + شحنات البيع التي تحتاج إلى فاتورة إلكترونية (E-Fatura) - إلزامي'
                : 'Cross-border + Selling shipments that require E-Fatura assignment - Mandatory'
              }
            </div>
          ) : activeTab === 'beyaname' ? (
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="h-4 w-4" />
              {isRtl 
                ? 'شحنات الاستيراد المتجهة إلى الأنتريبو - تحتاج إلى بيانامة'
                : 'Import shipments destined to Antrepo warehouse - Require Beyaname'
              }
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4" />
              {isRtl 
                ? 'الشحنات المكتملة + الشحنات غير العابرة للحدود (لا تحتاج E-Fatura)'
                : 'Completed shipments + Non-cross-border shipments (E-Fatura not required)'
              }
            </div>
          )}
        </div>

        {/* Filters Bar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  activeTab === 'pending'
                    ? (isRtl ? 'البحث برقم الشحنة، المورد، المشتري...' : 'Search by shipment #, supplier, buyer...')
                    : (isRtl ? 'البحث برقم الشحنة، رقم E-Fatura...' : 'Search by shipment #, E-Fatura number...')
                }
                className="w-full ps-10 pe-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Beyaname Status Filter */}
              {activeTab === 'beyaname' && (
                <select
                  value={beyanameStatus}
                  onChange={(e) => {
                    setBeyanameStatus(e.target.value as 'pending' | 'issued' | 'completed' | 'all');
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="pending">{isRtl ? 'معلق' : 'Pending'}</option>
                  <option value="issued">{isRtl ? 'صدرت' : 'Issued'}</option>
                  <option value="completed">{isRtl ? 'مكتمل' : 'Completed'}</option>
                  <option value="all">{isRtl ? 'الكل' : 'All'}</option>
                </select>
              )}

              {/* Archive Filters Toggle */}
              {activeTab === 'archive' && (
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors
                    ${showFilters || hasActiveFilters
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <FunnelIcon className="h-5 w-5" />
                  <span>{isRtl ? 'فلاتر' : 'Filters'}</span>
                  {hasActiveFilters && (
                    <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                      !
                    </span>
                  )}
                </button>
              )}

              {/* Refresh */}
              <button
                type="button"
                onClick={() => {
                  fetchData();
                  fetchSummary();
                }}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Archive Filters Panel */}
          {activeTab === 'archive' && showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                {/* Cross-border only toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crossBorderOnly}
                    onChange={(e) => {
                      setCrossBorderOnly(e.target.checked);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">
                    {isRtl ? 'عابر للحدود فقط' : 'Cross-border only'}
                  </span>
                </label>

                {/* Date From */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {isRtl ? 'من تاريخ' : 'From Date'}
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {isRtl ? 'إلى تاريخ' : 'To Date'}
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    {isRtl ? 'مسح الفلاتر' : 'Clear Filters'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : activeTab === 'beyaname' ? (
            // Beyaname Tab Content
            beyanameShipments.length === 0 ? (
              <div className="py-12 text-center">
                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {isRtl ? 'لا توجد شحنات' : 'No Shipments'}
                </h3>
                <p className="text-gray-500">
                  {search 
                    ? (isRtl ? 'لم يتم العثور على نتائج للبحث' : 'No results found for your search')
                    : (isRtl ? 'لا توجد شحنات أنتريبو تحتاج بيانامة' : 'No Antrepo shipments need Beyaname')
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Beyaname Cards - Two Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {beyanameShipments.map((shipment) => (
                    <BeyanameCard
                      key={shipment.id}
                      shipment={shipment}
                      onSaveBeyaname={handleSaveBeyaname}
                      onMarkComplete={handleMarkBeyanameComplete}
                      isRtl={isRtl}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="flex justify-center mt-6">
                    <Pagination
                      currentPage={pagination.page}
                      totalPages={pagination.pages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )
          ) : shipments.length === 0 ? (
            <div className="py-12 text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isRtl ? 'لا توجد شحنات' : 'No Shipments'}
              </h3>
              <p className="text-gray-500">
                {search 
                  ? (isRtl ? 'لم يتم العثور على نتائج للبحث' : 'No results found for your search')
                  : activeTab === 'pending'
                    ? (isRtl ? 'لا توجد شحنات عابرة للحدود أو بيع تحتاج E-Fatura' : 'No cross-border or selling shipments need E-Fatura')
                    : (isRtl ? 'لا توجد شحنات في الأرشيف' : 'No shipments in archive')
                }
              </p>
            </div>
          ) : (
            <>
              {/* E-Fatura Shipment Cards - Two Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {shipments.map((shipment) => (
                  <div key={shipment.id} className="relative">
                    {/* Sale Badge for outgoing shipments */}
                    {shipment.transaction_type === 'outgoing' && (
                      <div className="absolute -top-2 -right-2 z-10">
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-orange-500 text-white shadow-lg">
                          {isRtl ? 'بيع' : 'SALE'}
                        </span>
                      </div>
                    )}
                    <EFaturaCard
                      shipment={shipment}
                      onMarkComplete={handleMarkComplete}
                      isRtl={isRtl}
                      isArchiveView={activeTab === 'archive'}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex justify-center mt-6">
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
      </div>
    </div>
  );
};

export default EFaturaPage;
