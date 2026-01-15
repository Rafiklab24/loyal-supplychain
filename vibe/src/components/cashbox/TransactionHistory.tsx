import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  ArrowsRightLeftIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { CashBoxTransaction, CashBox, TransactionFilters } from '../../services/cashbox';
import { formatCurrency, getTransactionTypeLabel, getTransactionTypeColor } from '../../services/cashbox';

interface TransactionHistoryProps {
  transactions: CashBoxTransaction[];
  cashBoxes: CashBox[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  filters: TransactionFilters;
  onFilterChange: (filters: TransactionFilters) => void;
  isLoading: boolean;
}

export function TransactionHistory({
  transactions,
  cashBoxes,
  pagination,
  filters,
  onFilterChange,
  isLoading,
}: TransactionHistoryProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [showFilters, setShowFilters] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <ArrowUpIcon className="w-4 h-4 text-green-600" />;
      case 'out':
        return <ArrowDownIcon className="w-4 h-4 text-red-600" />;
      case 'transfer_in':
      case 'transfer_out':
        return <ArrowsRightLeftIcon className="w-4 h-4 text-indigo-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('cashbox.transactionHistory')}
        </h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border ${
            showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FunnelIcon className="w-4 h-4" />
          {t('common.filters')}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-gray-50 border-b grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Cash Box Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cashbox.cashBox')}
            </label>
            <select
              value={filters.cash_box_id || ''}
              onChange={(e) => onFilterChange({ ...filters, cash_box_id: e.target.value || undefined, page: 1 })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">{t('common.all')}</option>
              {cashBoxes.map(box => (
                <option key={box.id} value={box.id}>
                  {isRtl ? box.name_ar || box.name : box.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cashbox.transactionType')}
            </label>
            <select
              value={filters.transaction_type || ''}
              onChange={(e) => onFilterChange({ 
                ...filters, 
                transaction_type: e.target.value as TransactionFilters['transaction_type'] || undefined,
                page: 1 
              })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">{t('common.all')}</option>
              <option value="in">{t('cashbox.deposit')}</option>
              <option value="out">{t('cashbox.withdraw')}</option>
              <option value="transfer_in">{t('cashbox.transferIn')}</option>
              <option value="transfer_out">{t('cashbox.transferOut')}</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.fromDate')}
            </label>
            <input
              type="date"
              value={filters.from_date || ''}
              onChange={(e) => onFilterChange({ ...filters, from_date: e.target.value || undefined, page: 1 })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              dir="ltr"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.toDate')}
            </label>
            <input
              type="date"
              value={filters.to_date || ''}
              onChange={(e) => onFilterChange({ ...filters, to_date: e.target.value || undefined, page: 1 })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              dir="ltr"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('common.date')}
              </th>
              <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('cashbox.cashBox')}
              </th>
              <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('cashbox.type')}
              </th>
              <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('cashbox.party')}
              </th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase">
                {t('cashbox.amount')}
              </th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase">
                {t('cashbox.balance')}
              </th>
              <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('cashbox.recordedBy')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t('common.loading')}
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t('cashbox.noTransactions')}
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(txn.transaction_date).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-900">
                      {isRtl ? txn.cash_box_name_ar || txn.cash_box_name : txn.cash_box_name}
                    </span>
                    <span className="text-gray-500 text-xs ml-1">({txn.currency_code})</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeColor(txn.transaction_type)}`}>
                      {getTypeIcon(txn.transaction_type)}
                      {getTransactionTypeLabel(txn.transaction_type, isRtl ? 'ar' : 'en')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {txn.party_name || '-'}
                    {txn.description && (
                      <p className="text-xs text-gray-500 truncate max-w-[200px]" title={txn.description}>
                        {txn.description}
                      </p>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium text-end ${
                    txn.transaction_type === 'in' || txn.transaction_type === 'transfer_in'
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {txn.transaction_type === 'in' || txn.transaction_type === 'transfer_in' ? '+' : '-'}
                    {formatCurrency(Number(txn.amount), txn.currency_code)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-end">
                    {formatCurrency(Number(txn.running_balance), txn.currency_code)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {txn.recorded_by_name || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="p-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {t('common.showing')} {((pagination.page - 1) * pagination.limit) + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} {t('common.of')} {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onFilterChange({ ...filters, page: pagination.page - 1 })}
              disabled={pagination.page <= 1}
              className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">
              {pagination.page} / {pagination.total_pages}
            </span>
            <button
              onClick={() => onFilterChange({ ...filters, page: pagination.page + 1 })}
              disabled={pagination.page >= pagination.total_pages}
              className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

