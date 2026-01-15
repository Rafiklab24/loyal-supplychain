/**
 * TransactionsPanel - Displays financial transactions for a shipment or contract
 * Used in ShipmentDetailPage and ContractDetailPage
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  BanknotesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Spinner } from '../common/Spinner';
import { apiClient } from '../../services/api';
import { formatCurrency, formatDateString } from '../../utils/format';

interface Transaction {
  id: string;
  transaction_date: string;
  amount_usd: number;
  amount_other?: number;
  currency: string;
  transaction_type: string;
  direction: 'in' | 'out';
  fund_source: string;
  fund_name?: string;
  party_name: string;
  description?: string;
  reference?: string;
  contract_id?: string;
  contract_no?: string;
  shipment_id?: string;
  shipment_sn?: string;
  created_at: string;
}

interface TransactionsPanelProps {
  entityType: 'shipment' | 'contract';
  entityId: string;
  entityRef?: string; // SN or contract_no for display
  onCreateTransaction?: () => void;
}

export function TransactionsPanel({ 
  entityType, 
  entityId, 
  entityRef,
  onCreateTransaction 
}: TransactionsPanelProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate totals
  const totals = transactions.reduce(
    (acc, tx) => {
      if (tx.direction === 'in') {
        acc.totalIn += Number(tx.amount_usd) || 0;
      } else {
        acc.totalOut += Number(tx.amount_usd) || 0;
      }
      return acc;
    },
    { totalIn: 0, totalOut: 0 }
  );
  const netBalance = totals.totalIn - totals.totalOut;

  useEffect(() => {
    fetchTransactions();
  }, [entityId, entityType]);

  const fetchTransactions = async () => {
    if (!entityId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const filterParam = entityType === 'shipment' ? 'shipment_id' : 'contract_id';
      const response = await apiClient.get(`/finance/transactions?${filterParam}=${entityId}&limit=100`);
      setTransactions(response.data.transactions || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.response?.data?.error || t('common.error', 'Failed to load transactions'));
    } finally {
      setIsLoading(false);
    }
  };

  const getDirectionBadge = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      return (
        <Badge color="green" size="sm">
          <ArrowDownTrayIcon className="h-3 w-3 me-1" />
          {t('finance.received', 'Received')}
        </Badge>
      );
    }
    return (
      <Badge color="red" size="sm">
        <ArrowUpTrayIcon className="h-3 w-3 me-1" />
        {t('finance.paid', 'Paid')}
      </Badge>
    );
  };

  const getTransactionTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      bank_transfer: t('finance.types.bankTransfer', 'Bank Transfer'),
      cash: t('finance.types.cash', 'Cash'),
      check: t('finance.types.check', 'Check'),
      lc: t('finance.types.lc', 'Letter of Credit'),
      other: t('finance.types.other', 'Other'),
    };
    return typeLabels[type] || type;
  };

  const handleNavigateToFinance = () => {
    // Navigate to finance page with filter pre-applied
    const filterParam = entityType === 'shipment' ? 'shipment_id' : 'contract_id';
    navigate(`/finance?${filterParam}=${entityId}`);
  };

  const handleAddTransaction = () => {
    if (onCreateTransaction) {
      onCreateTransaction();
    } else {
      // Navigate to finance page with the entity pre-selected
      const params = new URLSearchParams();
      params.set('new', 'true');
      if (entityType === 'shipment') {
        params.set('shipment_id', entityId);
        if (entityRef) params.set('shipment_sn', entityRef);
      } else {
        params.set('contract_id', entityId);
        if (entityRef) params.set('contract_no', entityRef);
      }
      navigate(`/finance?${params.toString()}`);
    }
  };

  return (
    <Card>
      {/* Header */}
      <div 
        className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <BanknotesIcon className="h-6 w-6 text-green-600" />
          {t('finance.transactions', 'Financial Transactions')}
          {transactions.length > 0 && (
            <Badge color="blue">{transactions.length}</Badge>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddTransaction();
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            {t('finance.addTransaction', 'Add Transaction')}
          </button>
          <ChevronRightIcon 
            className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p>{error}</p>
              <button 
                onClick={fetchTransactions}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <BanknotesIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">
                {t('finance.noTransactions', 'No financial transactions recorded for this')} {
                  entityType === 'shipment' 
                    ? t('common.shipment', 'shipment')
                    : t('common.contract', 'contract')
                }
              </p>
              <button
                onClick={handleAddTransaction}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                {t('finance.recordFirstTransaction', 'Record First Transaction')}
              </button>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownTrayIcon className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                      {t('finance.totalReceived', 'Total Received')}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {formatCurrency(totals.totalIn)}
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpTrayIcon className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                      {t('finance.totalPaid', 'Total Paid')}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-red-900">
                    {formatCurrency(totals.totalOut)}
                  </div>
                </div>

                <div className={`border rounded-lg p-4 ${
                  netBalance >= 0 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <BanknotesIcon className={`h-5 w-5 ${netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
                    <span className={`text-sm font-medium ${netBalance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                      {t('finance.netBalance', 'Net Balance')}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-900' : 'text-amber-900'}`}>
                    {formatCurrency(netBalance)}
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                        {t('finance.date', 'Date')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                        {t('finance.type', 'Type')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                        {t('finance.party', 'Party')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                        {t('finance.fund', 'Fund/Account')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                        {t('finance.direction', 'Direction')}
                      </th>
                      <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase">
                        {t('finance.amount', 'Amount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((tx) => (
                      <tr 
                        key={tx.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/finance?transaction=${tx.id}`)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-gray-900">
                            {formatDateString(tx.transaction_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-gray-600">
                            {getTransactionTypeLabel(tx.transaction_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{tx.party_name}</div>
                          {tx.description && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {tx.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-gray-600">
                            {tx.fund_name || tx.fund_source}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getDirectionBadge(tx.direction)}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-end font-semibold ${
                          tx.direction === 'in' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {tx.direction === 'in' ? '+' : '-'}
                          {formatCurrency(tx.amount_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* View All Link */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleNavigateToFinance}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  {t('finance.viewAllTransactions', 'View All Transactions')}
                  <ChevronRightIcon className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}

export default TransactionsPanel;









