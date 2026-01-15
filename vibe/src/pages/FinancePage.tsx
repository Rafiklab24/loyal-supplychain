import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, FunnelIcon, MagnifyingGlassIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { financeService } from '../services/finance';
import { NewTransactionWizard } from '../components/finance/NewTransactionWizard';
import { FinanceBulkActionsBar } from '../components/finance/FinanceBulkActionsBar';
import type { FinancialTransaction, Fund, FinancialParty } from '../types/api';
import { formatCurrency, formatDateString } from '../utils/format';
import { DateInput } from '../components/common/DateInput';
import { parseFinanceSearch, getFinanceSearchExamples, type ParsedFinanceSearch } from '../utils/financeSearchParser';

export function FinancePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [parties, setParties] = useState<FinancialParty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Smart search
  const [rawSearch, setRawSearch] = useState('');
  const [parsedSearch, setParsedSearch] = useState<ParsedFinanceSearch>({});
  const [showSmartSearchHint, setShowSmartSearchHint] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [direction, setDirection] = useState<'in' | 'out' | ''>('');
  const [fund, setFund] = useState('');
  const [party, setParty] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Autocomplete states
  const [fundSearch, setFundSearch] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [showFundSuggestions, setShowFundSuggestions] = useState(false);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);

  // Bulk selection
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Parse search query whenever it changes
  useEffect(() => {
    const parsed = parseFinanceSearch(rawSearch);
    setParsedSearch(parsed);
    setPage(1);
    
    // Apply parsed filters
    if (parsed.direction) setDirection(parsed.direction);
    if (parsed.dateFrom) setDateFrom(parsed.dateFrom);
    if (parsed.dateTo) setDateTo(parsed.dateTo);
  }, [rawSearch]);

  // Auto-dismiss smart search hint
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSmartSearchHint(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [page, dateFrom, dateTo, direction, fund, party, parsedSearch]);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [fundsData, partiesData] = await Promise.all([
        financeService.getFunds(),
        financeService.getParties(),
      ]);
      setFunds(fundsData);
      setParties(partiesData);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const filters = {
        page,
        limit: 50,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        direction: direction === '' ? undefined : direction,
        fund: fund || undefined,
        party: party || undefined,
      };

      const transactionsData = await financeService.getTransactions(filters);

      setTransactions(transactionsData.transactions);
      setTotalPages(transactionsData.pagination.pages);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    }
  };

  const handleClearFilters = () => {
    setRawSearch('');
    setParsedSearch({});
    setDateFrom('');
    setDateTo('');
    setDirection('');
    setFund('');
    setParty('');
    setFundSearch('');
    setPartySearch('');
    setPage(1);
  };

  const filteredFunds = funds.filter(f =>
    f.fund_name.toLowerCase().includes(fundSearch.toLowerCase())
  );

  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(partySearch.toLowerCase())
  );

  const getDirectionColor = (dir: 'in' | 'out') => {
    return dir === 'in' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (!transactions || transactions.length === 0) return;
    const allIds = new Set(transactions.map(t => t.id));
    setSelectedTransactions(allIds);
  };

  const handleClearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const handleToggleSelection = (id: string) => {
    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedTransactions(newSelection);
  };

  // Bulk action handlers
  const handleBulkExport = () => {
    if (!transactions || selectedTransactions.size === 0) return;
    
    const selectedData = transactions.filter(t => selectedTransactions.has(t.id));
    const headers = [
      'Seq ID',
      'Date',
      'Direction',
      'Amount (USD)',
      'Amount (Other)',
      'Currency',
      'Type',
      'Fund/Account',
      'Party',
      'Description',
      'Contract',
      'Shipment'
    ];
    
    const rows = selectedData.map((transaction, index) => [
      (page - 1) * 50 + index + 1,
      transaction.transaction_date,
      transaction.direction === 'in' ? 'Income' : 'Expense',
      transaction.amount_usd,
      transaction.amount_other || '',
      transaction.currency !== 'USD' ? transaction.currency : '',
      transaction.transaction_type,
      transaction.fund_source,
      transaction.party_name,
      transaction.description,
      transaction.contract_no || '',
      transaction.shipment_sn || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clear selection after export
    handleClearSelection();
  };

  const handleBulkArchive = async () => {
    if (!confirm(isRtl 
      ? `هل أنت متأكد من أرشفة ${selectedTransactions.size} معاملة؟`
      : `Are you sure you want to archive ${selectedTransactions.size} transaction(s)?`
    )) {
      return;
    }
    
    try {
      await financeService.bulkArchiveTransactions(Array.from(selectedTransactions));
      alert(isRtl 
        ? `تم أرشفة ${selectedTransactions.size} معاملة بنجاح`
        : `Successfully archived ${selectedTransactions.size} transaction(s)`
      );
      handleClearSelection();
      fetchTransactions();
    } catch (error) {
      console.error('Error archiving transactions:', error);
      alert(isRtl ? 'حدث خطأ أثناء الأرشفة' : 'Error archiving transactions');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(isRtl 
      ? `هل أنت متأكد من حذف ${selectedTransactions.size} معاملة؟ هذا الإجراء لا يمكن التراجع عنه.`
      : `Are you sure you want to delete ${selectedTransactions.size} transaction(s)? This action cannot be undone.`
    )) {
      return;
    }
    
    try {
      await financeService.bulkDeleteTransactions(Array.from(selectedTransactions));
      alert(isRtl 
        ? `تم حذف ${selectedTransactions.size} معاملة بنجاح`
        : `Successfully deleted ${selectedTransactions.size} transaction(s)`
      );
      handleClearSelection();
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transactions:', error);
      alert(isRtl ? 'حدث خطأ أثناء الحذف' : 'Error deleting transactions');
    }
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('finance.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('finance.summary')}</p>
        </div>
        <Button
          onClick={() => setShowWizard(true)}
          variant="primary"
          className="inline-flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          {t('finance.newTransaction')}
        </Button>
      </div>

      {/* Smart Search Bar */}
      <Card>
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder={t('common.search') + '...'}
              className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {rawSearch && (
              <button
                onClick={() => setRawSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Smart Search Hint */}
          {showSmartSearchHint && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <SparklesIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  {isRtl ? 'بحث ذكي' : 'Smart Search'}
                </p>
                <p className="text-xs text-blue-700">
                  {isRtl ? 'جرب: ' : 'Try: '}
                  {getFinanceSearchExamples(isRtl ? 'ar' : 'en').map((example, i) => (
                    <span key={i}>
                      <button
                        onClick={() => setRawSearch(example)}
                        className="underline hover:text-blue-900"
                      >
                        {example}
                      </button>
                      {i < getFinanceSearchExamples(isRtl ? 'ar' : 'en').length - 1 && ' • '}
                    </span>
                  ))}
                </p>
              </div>
              <button
                onClick={() => setShowSmartSearchHint(false)}
                className="text-blue-400 hover:text-blue-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Active Filters Display */}
          {(parsedSearch.direction || parsedSearch.dateFrom || parsedSearch.transactionType) && (
            <div className="flex flex-wrap gap-2">
              {parsedSearch.direction && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {parsedSearch.direction === 'in' ? t('finance.income') : t('finance.expense')}
                </span>
              )}
              {parsedSearch.dateFrom && parsedSearch.dateTo && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {parsedSearch.dateFrom} → {parsedSearch.dateTo}
                </span>
              )}
              {parsedSearch.transactionType && parsedSearch.transactionType.map((type) => (
                <span key={type} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {t(`finance.transactionTypes.${type}`)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Advanced Filters */}
      <Card>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 w-full text-left"
        >
          <FunnelIcon className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">{t('common.filter')}</h3>
          <span className="text-sm text-gray-500 ml-auto">
            {showFilters ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? 'إظهار' : 'Show')}
          </span>
        </button>
        
        {showFilters && (
          <div className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.from')}
            </label>
            <DateInput
              value={dateFrom}
              onChange={(val) => setDateFrom(val)}
              className="w-full border-gray-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.to')}
            </label>
            <DateInput
              value={dateTo}
              onChange={(val) => setDateTo(val)}
              className="w-full border-gray-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('finance.direction')}
            </label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as '' | 'in' | 'out')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('finance.filters.allDirections')}</option>
              <option value="in">{t('finance.income')}</option>
              <option value="out">{t('finance.expense')}</option>
            </select>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('finance.fundAccount')}
            </label>
            <input
              type="text"
              value={fundSearch}
              onChange={(e) => {
                setFundSearch(e.target.value);
                setShowFundSuggestions(true);
              }}
              onFocus={() => setShowFundSuggestions(true)}
              onBlur={() => setTimeout(() => setShowFundSuggestions(false), 200)}
              placeholder={t('finance.filters.allFunds')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            {showFundSuggestions && fundSearch && filteredFunds.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredFunds.slice(0, 10).map((f) => (
                  <div
                    key={f.id}
                    onClick={() => {
                      setFund(f.fund_name);
                      setFundSearch(f.fund_name);
                      setShowFundSuggestions(false);
                    }}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                  >
                    {f.fund_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('finance.party')}
            </label>
            <input
              type="text"
              value={partySearch}
              onChange={(e) => {
                setPartySearch(e.target.value);
                setShowPartySuggestions(true);
              }}
              onFocus={() => setShowPartySuggestions(true)}
              onBlur={() => setTimeout(() => setShowPartySuggestions(false), 200)}
              placeholder={t('finance.filters.allParties')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            {showPartySuggestions && partySearch && filteredParties.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredParties.slice(0, 10).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setParty(p.name);
                      setPartySearch(p.name);
                      setShowPartySuggestions(false);
                    }}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleClearFilters} variant="secondary">
                {t('common.clear')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Transactions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-center bg-white sticky start-0 z-10 border-e border-gray-200 shadow-sm w-12">
                  <input
                    type="checkbox"
                    checked={transactions.length > 0 && selectedTransactions.size === transactions.length}
                    onChange={() => {
                      if (selectedTransactions.size === transactions.length) {
                        handleClearSelection();
                      } else {
                        handleSelectAll();
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.sequenceId')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.transactionDate')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.direction')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.amountUSD')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.amountOther')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.currency')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.transactionType')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.fundAccount')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.party')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.description')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.linkedContract')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('finance.linkedShipment')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                    {t('finance.noTransactions')}
                  </td>
                </tr>
              ) : (
                transactions.map((transaction, index) => (
                  <tr 
                    key={transaction.id} 
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedTransactions.has(transaction.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-3 text-center bg-white sticky start-0 z-10 border-e border-gray-200 shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(transaction.id)}
                        onChange={() => handleToggleSelection(transaction.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      #{(page - 1) * 50 + index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDateString(transaction.transaction_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDirectionColor(transaction.direction)}`}>
                        {transaction.direction === 'in' ? t('finance.income') : t('finance.expense')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {formatCurrency(transaction.amount_usd)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {transaction.amount_other ? formatCurrency(transaction.amount_other) : '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {transaction.currency !== 'USD' ? transaction.currency : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t(`finance.transactionTypes.${transaction.transaction_type}`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {transaction.fund_source}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {transaction.party_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transaction.contract_id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/contracts/${transaction.contract_id}`);
                          }}
                          className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded hover:bg-purple-200 transition-colors cursor-pointer"
                          title={t('contracts.viewDetails', 'View Contract Details')}
                        >
                          {transaction.contract_no || transaction.contract_id}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transaction.shipment_id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/shipments/${transaction.shipment_id}`);
                          }}
                          className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded hover:bg-indigo-200 transition-colors cursor-pointer"
                          title={t('shipments.viewDetails', 'View Shipment Details')}
                        >
                          {transaction.shipment_sn || transaction.shipment_id}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
            <Button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              variant="secondary"
            >
              {t('common.previous')}
            </Button>
            <span className="text-sm text-gray-700">
              {t('common.page')} {page} {t('common.of')} {totalPages}
            </span>
            <Button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              variant="secondary"
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </Card>

      {/* Bulk Actions Bar */}
      {selectedTransactions.size > 0 && (
        <FinanceBulkActionsBar
          selectedCount={selectedTransactions.size}
          onExport={handleBulkExport}
          onArchive={handleBulkArchive}
          onDelete={handleBulkDelete}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* New Transaction Wizard */}
      {showWizard && (
        <NewTransactionWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            setShowWizard(false);
            fetchTransactions();
          }}
        />
      )}
    </div>
  );
}
