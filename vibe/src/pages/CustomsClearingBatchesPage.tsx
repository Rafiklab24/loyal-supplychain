import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  useCustomsClearingBatches,
  useCustomsClearingBatch,
  useCustomsClearingBatchSummary,
  useCustomsClearingBatchMutations,
} from '../hooks/useCustomsClearingBatches';
import type { CustomsClearingBatchFilters } from '../types/api';
import BatchStatusBadge from '../components/customs/BatchStatusBadge';

const CustomsClearingBatchesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'archived'>('pending');
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState<CustomsClearingBatchFilters>({
    page: 1,
    limit: 50,
    sort_by: 'created_at',
    sort_order: 'desc',
    status: 'pending',
  });

  // Fetch data
  const { data, loading, error, pagination, refresh } = useCustomsClearingBatches(filters);
  const { data: summary } = useCustomsClearingBatchSummary();
  const { data: expandedBatch, loading: loadingDetails } = useCustomsClearingBatch(expandedBatchId);
  const { approveBatch, archiveBatch, deleteBatch, exportBatch, loading: mutationLoading } = useCustomsClearingBatchMutations();

  // Handle tab change
  const handleTabChange = (tab: 'pending' | 'approved' | 'archived') => {
    setActiveTab(tab);
    setFilters(prev => ({ ...prev, status: tab, page: 1 }));
    setExpandedBatchId(null);
  };

  // Handle expand/collapse
  const handleToggleExpand = (batchId: string) => {
    setExpandedBatchId(expandedBatchId === batchId ? null : batchId);
  };

  // Handle approve
  const handleApproveBatch = async (batchId: string) => {
    if (!window.confirm(t('batches.confirmApprove'))) {
      return;
    }

    try {
      await approveBatch(batchId);
      refresh();
      setExpandedBatchId(null);
    } catch (err) {
      console.error('Error approving batch:', err);
    }
  };

  // Handle archive
  const handleArchiveBatch = async (batchId: string) => {
    if (!window.confirm(t('batches.confirmArchive'))) {
      return;
    }

    try {
      await archiveBatch(batchId);
      refresh();
      setExpandedBatchId(null);
    } catch (err) {
      console.error('Error archiving batch:', err);
    }
  };

  // Handle delete
  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm(t('batches.confirmDelete'))) {
      return;
    }

    try {
      await deleteBatch(batchId);
      refresh();
      setExpandedBatchId(null);
    } catch (err) {
      console.error('Error deleting batch:', err);
    }
  };

  // Handle export
  const handleExportBatch = async (batchId: string, batchNumber: string) => {
    try {
      await exportBatch(batchId, batchNumber);
    } catch (err) {
      console.error('Error exporting batch:', err);
    }
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '—';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('batches.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('batches.subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                  {t('batches.pendingReview')}
                </div>
                <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
                  {summary.pending_count}
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  {formatCurrency(summary.total_pending_cost)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-green-700 dark:text-green-300 font-medium">
                  {t('batches.approved')}
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                  {summary.approved_count}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {formatCurrency(summary.total_approved_cost)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-gray-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                  {t('batches.archived')}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.archived_count}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {formatCurrency(summary.total_archived_cost)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => handleTabChange('pending')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pending'
                  ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t('batches.pendingReview')} {summary && `(${summary.pending_count})`}
            </button>
            <button
              onClick={() => handleTabChange('approved')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'approved'
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t('batches.approved')} {summary && `(${summary.approved_count})`}
            </button>
            <button
              onClick={() => handleTabChange('archived')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'archived'
                  ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t('batches.archived')} {summary && `(${summary.archived_count})`}
            </button>
          </nav>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {t('batches.loading')}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {t('batches.noBatches')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {t('batches.batchNumber')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {t('batches.status')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {t('batches.itemCount')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {t('batches.totalCost')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {t('batches.createdBy')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {t('batches.createdDate')}
                  </th>
                  {activeTab !== 'pending' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      {t('batches.reviewedBy')}
                    </th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((batch) => (
                  <React.Fragment key={batch.id}>
                    {/* Main Row */}
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleToggleExpand(batch.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {expandedBatchId === batch.id ? (
                            <ChevronDownIcon className="h-5 w-5" />
                          ) : (
                            <ChevronRightIcon className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {batch.batch_number}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <BatchStatusBadge status={batch.status} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        {batch.item_count}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(batch.total_clearing_cost)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {batch.created_by}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(batch.created_at)}
                      </td>
                      {activeTab !== 'pending' && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {batch.reviewed_by || '—'}
                        </td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {/* Approve Button (Accountant only, pending only) */}
                          {activeTab === 'pending' && (user?.role === 'Accounting' || user?.role === 'Admin') && (
                            <button
                              onClick={() => handleApproveBatch(batch.id)}
                              disabled={mutationLoading}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                              title={t('batches.approveBatch')}
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                          )}

                          {/* Archive Button (Accountant only, approved only) */}
                          {activeTab === 'approved' && (user?.role === 'Accounting' || user?.role === 'Admin') && (
                            <button
                              onClick={() => handleArchiveBatch(batch.id)}
                              disabled={mutationLoading}
                              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                              title={t('batches.archiveBatch')}
                            >
                              <ArchiveBoxIcon className="h-5 w-5" />
                            </button>
                          )}

                          {/* Export Button */}
                          <button
                            onClick={() => handleExportBatch(batch.id, batch.batch_number)}
                            disabled={mutationLoading}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                            title={t('batches.exportBatch')}
                          >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                          </button>

                          {/* Delete Button (pending only) */}
                          {activeTab === 'pending' && (user?.role === 'Clearance' || user?.role === 'Admin') && (
                            <button
                              onClick={() => handleDeleteBatch(batch.id)}
                              disabled={mutationLoading}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                              title={t('batches.deleteBatch')}
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedBatchId === batch.id && (
                      <tr>
                        <td colSpan={activeTab !== 'pending' ? 9 : 8} className="px-4 py-4 bg-gray-50 dark:bg-gray-900">
                          {loadingDetails ? (
                            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                              {t('batches.loadingDetails')}
                            </div>
                          ) : expandedBatch ? (
                            <div className="space-y-4">
                              {/* Notes */}
                              {expandedBatch.notes && (
                                <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                    {t('batches.notes')}
                                  </div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">
                                    {expandedBatch.notes}
                                  </div>
                                </div>
                              )}

                              {/* Items Table */}
                              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t('batches.batchItems')} ({expandedBatch.items.length})
                                </div>
                                <div className="overflow-x-auto max-h-96">
                                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                          {t('customsClearingCosts.fileNumber')}
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                          {t('customsClearingCosts.transactionType')}
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                          {t('customsClearingCosts.goodsType')}
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                                          {t('customsClearingCosts.totalClearingCost')}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                      {expandedBatch.items.map((item) => (
                                        <tr key={item.id}>
                                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                            {item.file_number}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                                            {item.transaction_type || '—'}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                                            {item.goods_type || '—'}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">
                                            {formatCurrency(item.total_clearing_cost)}
                                          </td>
                                        </tr>
                                      ))}
                                      {/* Totals Row */}
                                      <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                                        <td colSpan={3} className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">
                                          {t('batches.total')}:
                                        </td>
                                        <td className="px-3 py-2 text-sm text-right text-blue-600 dark:text-blue-400">
                                          {formatCurrency(expandedBatch.total_clearing_cost)}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {t('common.showingPage')} {pagination.page} {t('common.of')} {pagination.pages} ({pagination.total} {t('common.total')})
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page! - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.previous')}
                </button>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page! + 1 }))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomsClearingBatchesPage;

