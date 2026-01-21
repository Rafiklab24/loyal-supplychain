/**
 * Elleçleme Dashboard Page
 * Main interface for handling operations management
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  WrenchScrewdriverIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useElleclemeDashboard, useElleclemeRequests, useActivityTypes } from '../hooks/useEllecleme';
import { getStatusColor, getPriorityColor, type ElleclemeStatus, type ElleclemeRequest } from '../services/ellecleme';

type TabType = 'all' | 'active' | 'pending_permit' | 'in_progress' | 'completed';

const STATUS_TABS: { key: TabType; labelKey: string; statuses: ElleclemeStatus[] | undefined }[] = [
  { key: 'all', labelKey: 'common.all', statuses: undefined },
  { key: 'active', labelKey: 'ellecleme.summary.inProgressCount', statuses: ['draft', 'pending_permit', 'approved', 'in_progress'] },
  { key: 'pending_permit', labelKey: 'ellecleme.statuses.pending_permit', statuses: ['pending_permit'] },
  { key: 'in_progress', labelKey: 'ellecleme.statuses.in_progress', statuses: ['in_progress'] },
  { key: 'completed', labelKey: 'ellecleme.statuses.completed', statuses: ['completed'] },
];

export default function ElleclemeDashboardPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language;

  // State
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Get current tab's status filter
  const currentTab = STATUS_TABS.find(tab => tab.key === activeTab);
  const statusFilter = currentTab?.statuses?.length === 1 ? currentTab.statuses[0] : undefined;

  // Data queries
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useElleclemeDashboard();
  const { data: requestsData, isLoading: requestsLoading } = useElleclemeRequests({
    status: statusFilter,
    search: searchTerm || undefined,
    page,
    limit: 20,
  });
  const { data: activityTypes } = useActivityTypes();

  // Format number
  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US');
  };

  // Format currency
  const formatCurrency = (amount: number | undefined, currency = 'TRY') => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get activity name based on language
  const getActivityName = (request: ElleclemeRequest) => {
    if (lang === 'ar' && request.activity_name_ar) return request.activity_name_ar;
    if (lang === 'tr' && request.activity_name_tr) return request.activity_name_tr;
    return request.activity_name || request.activity_code;
  };

  // Get translated status
  const getStatusLabel = (status: ElleclemeStatus) => {
    return t(`ellecleme.statuses.${status}`, status);
  };

  // Get translated priority
  const getPriorityLabel = (priority: string) => {
    return t(`ellecleme.priorities.${priority}`, priority);
  };

  const summary = dashboardData?.summary;
  const requests = requestsData?.data || [];
  const pagination = requestsData?.pagination;

  return (
    <div className={`min-h-screen bg-slate-50 p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <WrenchScrewdriverIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {t('ellecleme.title', 'Elleçleme Management')}
              </h1>
              <p className="text-sm text-slate-500">
                {t('ellecleme.subtitle', 'Handling Operations Management (Ek-63)')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetchDashboard()}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title={t('common.refresh', 'Refresh')}
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            <Link
              to="/ellecleme/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              {t('ellecleme.newRequest', 'New Request')}
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <DocumentTextIcon className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800" dir="ltr">
                {formatNumber(summary?.draft_count)}
              </p>
              <p className="text-xs text-slate-500">{t('ellecleme.statuses.draft', 'Draft')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-800" dir="ltr">
                {formatNumber(summary?.pending_permit_count)}
              </p>
              <p className="text-xs text-amber-600">{t('ellecleme.statuses.pending_permit', 'Pending Permit')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-800" dir="ltr">
                {formatNumber(summary?.approved_count)}
              </p>
              <p className="text-xs text-green-600">{t('ellecleme.statuses.approved', 'Approved')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClockIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-800" dir="ltr">
                {formatNumber(summary?.in_progress_count)}
              </p>
              <p className="text-xs text-blue-600">{t('ellecleme.statuses.in_progress', 'In Progress')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-800" dir="ltr">
                {formatNumber(summary?.completed_count)}
              </p>
              <p className="text-xs text-emerald-600">{t('ellecleme.statuses.completed', 'Completed')}</p>
            </div>
          </div>
        </div>

        {(summary?.overdue_count || 0) > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-red-200 bg-red-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-800" dir="ltr">
                  {formatNumber(summary?.overdue_count)}
                </p>
                <p className="text-xs text-red-600">{t('ellecleme.summary.overdueCount', 'Overdue')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.key
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <MagnifyingGlassIcon className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRtl ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder={t('common.search', 'Search...')}
                className={`w-full sm:w-64 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Request List */}
        <div className="divide-y divide-slate-100">
          {requestsLoading ? (
            <div className="p-8 text-center text-slate-500">
              {t('common.loading', 'Loading...')}
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center">
              <WrenchScrewdriverIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">{t('ellecleme.empty.noRequests', 'No requests found')}</p>
              <p className="text-sm text-slate-400 mt-1">
                {t('ellecleme.empty.noRequestsHint', 'Create a new request to start a handling operation')}
              </p>
            </div>
          ) : (
            requests.map((request: ElleclemeRequest) => (
              <Link
                key={request.id}
                to={`/ellecleme/requests/${request.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Activity Code Badge */}
                  <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-lg shrink-0">
                    <span className="text-lg font-bold text-blue-700">{request.activity_code}</span>
                  </div>

                  {/* Request Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-indigo-600">
                        {request.request_number}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>
                      {request.priority !== 'normal' && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(request.priority)}`}>
                          {getPriorityLabel(request.priority)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 truncate mt-0.5">
                      {getActivityName(request)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {request.lot_code && (
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {request.lot_code}
                        </span>
                      )}
                      {request.shipment_sn && (
                        <span>{request.shipment_sn}</span>
                      )}
                      {request.product_text && (
                        <span className="truncate max-w-[200px]">{request.product_text}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side */}
                <div className={`flex items-center gap-6 shrink-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {/* Quantity */}
                  {request.quantity_mt && (
                    <div className="text-right">
                      <p className="font-semibold text-slate-800" dir="ltr">
                        {formatNumber(request.quantity_mt)} MT
                      </p>
                      {request.quantity_bags && (
                        <p className="text-xs text-slate-500" dir="ltr">
                          {formatNumber(request.quantity_bags)} {t('antrepo.bags', 'bags')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Cost */}
                  {request.total_cost > 0 && (
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-slate-600">
                        <CurrencyDollarIcon className="h-4 w-4" />
                        <span className="font-medium" dir="ltr">
                          {formatCurrency(request.total_cost, request.cost_currency || 'TRY')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  <div className="text-right text-xs text-slate-500 w-20">
                    <p>{new Date(request.requested_date).toLocaleDateString('en-GB')}</p>
                    {request.planned_execution_date && (
                      <p className="text-slate-400">
                        → {new Date(request.planned_execution_date).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>

                  <ChevronRightIcon className={`h-5 w-5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {t('common.showingOf', 'Showing {{from}}-{{to}} of {{total}}', {
                from: (pagination.page - 1) * pagination.limit + 1,
                to: Math.min(pagination.page * pagination.limit, pagination.total),
                total: pagination.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.previous', 'Previous')}
              </button>
              <span className="text-sm text-slate-600">
                {page} / {pagination.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
