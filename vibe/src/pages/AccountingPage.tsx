/**
 * Accounting Page
 * Displays shipments with all financial transactions detailed
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowsUpDownIcon,
  XMarkIcon,
  BanknotesIcon,
  TruckIcon,
  DocumentTextIcon,
  CalculatorIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  ArrowUturnLeftIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { useShipmentFinancials, useClearanceCosts, useTransportDeliveries, useFinancialTransactions, useInventoryTransactions, useDocumentRecord, useUndocumentRecord } from '../hooks/useAccounting';
import { DateInput } from '../components/common/DateInput';
import { InvoicePreviewModal } from '../components/invoice';
import { invoiceService } from '../services/invoice';
import { useToast } from '../components/common/Toast';
import type { Invoice, InvoiceType, InvoiceLanguage } from '../types/invoice';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Pagination } from '../components/common/Pagination';
import { ShipmentSummaryPopover } from '../components/common/ShipmentSummaryPopover';
import { formatCurrency, formatNumber, formatDateString, statusToArabic, getStatusColor } from '../utils/format';
import { TranslatedProductText } from '../components/common/TranslatedProductText';
import { TruncatedText } from '../components/common/TruncatedText';
import type { AccountingFilters, ShipmentFinancialSummary, ClearanceCostRow, TransportRow, TransactionRow, InventoryTransactionRow } from '../services/accounting';

type TabType = 'summary' | 'clearance' | 'transport' | 'transactions' | 'inventory';

type SortColumn = 'sn' | 'total_value_usd' | 'advance_paid' | 'balance_paid' | 'clearance_cost' | 'internal_transport' | 'total_paid' | 'remaining_balance' | 'payment_percentage' | 'eta' | 'created_at';

export function AccountingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('clearance');
  
  // Filters state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'incoming' | 'outgoing' | ''>('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'has_balance' | 'fully_paid'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortColumn>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  
  // Tab-specific pagination
  const [clearancePage, setClearancePage] = useState(1);
  const [transportPage, setTransportPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [tabSearch, setTabSearch] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'' | 'شراء' | 'مبيع'>('');
  
  // Documentation (ترحيل) filter - false = show pending, true = show documented
  const [showDocumented, setShowDocumented] = useState(false);

  // Invoice generation state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [invoiceDropdownOpen, setInvoiceDropdownOpen] = useState<string | null>(null);

  // Build filters object
  const filters: AccountingFilters = useMemo(() => ({
    page,
    limit: 50,
    search: search || undefined,
    status: statusFilter || undefined,
    direction: directionFilter || undefined,
    hasBalance: balanceFilter === 'has_balance' ? true : balanceFilter === 'fully_paid' ? false : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sortBy as any,
    sortDir,
  }), [page, search, statusFilter, directionFilter, balanceFilter, dateFrom, dateTo, sortBy, sortDir]);

  // Fetch data for each tab
  const { data, isLoading, error, refetch } = useShipmentFinancials(filters);
  const { data: clearanceData, isLoading: clearanceLoading } = useClearanceCosts({ 
    page: clearancePage, 
    search: tabSearch,
    documented: showDocumented,
  });
  const { data: transportData, isLoading: transportLoading } = useTransportDeliveries({ 
    page: transportPage, 
    search: tabSearch,
    documented: showDocumented,
  });
  const { data: transactionsData, isLoading: transactionsLoading } = useFinancialTransactions({ 
    page: transactionsPage, 
    search: tabSearch,
    documented: showDocumented,
  });
  const { data: inventoryData, isLoading: inventoryLoading } = useInventoryTransactions({
    page: inventoryPage,
    search: tabSearch,
    invoice_type: inventoryTypeFilter || undefined,
  });

  // Documentation mutations
  const documentMutation = useDocumentRecord();
  const undocumentMutation = useUndocumentRecord();
  
  // Toast notifications
  const toast = useToast();

  // Handlers
  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDirectionFilter('');
    setBalanceFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleExport = () => {
    if (!data || !data.data || data.data.length === 0) return;

    // Define CSV headers
    const headers = [
      t('accounting.sn', 'Contract/SN'),
      t('accounting.product', 'Product'),
      t('accounting.subject', 'Subject'),
      t('accounting.direction', 'Direction'),
      t('accounting.status', 'Status'),
      t('accounting.totalValue', 'Total Value'),
      t('accounting.advancePaid', 'Advance Paid'),
      t('accounting.balancePaid', 'Balance Paid'),
      t('accounting.clearanceCost', 'Clearance Cost'),
      t('accounting.internalTransport', 'Internal Transport'),
      t('accounting.otherCosts', 'Other Costs'),
      t('accounting.totalPaid', 'Total Paid'),
      t('accounting.remainingBalance', 'Remaining Balance'),
      t('accounting.paymentPercentage', 'Payment %'),
      t('accounting.eta', 'ETA'),
      t('accounting.clearanceDate', 'Clearance Date'),
    ];

    // Get data to export (selected or all)
    const exportData = selectedRows.size > 0 
      ? data.data.filter(d => selectedRows.has(d.shipment_id))
      : data.data;

    // Convert to CSV rows
    const rows = exportData.map((row) => [
      row.sn || '',
      row.product_text || '',
      row.subject || '',
      row.direction === 'incoming' ? (isRtl ? 'وارد' : 'Incoming') : (isRtl ? 'صادر' : 'Outgoing'),
      isRtl ? statusToArabic(row.status) : (row.status || ''),
      row.total_value_usd?.toFixed(2) || '0',
      row.advance_paid?.toFixed(2) || '0',
      row.balance_paid?.toFixed(2) || '0',
      row.clearance_cost?.toFixed(2) || '0',
      row.internal_transport?.toFixed(2) || '0',
      row.other_costs?.toFixed(2) || '0',
      row.total_paid?.toFixed(2) || '0',
      row.remaining_balance?.toFixed(2) || '0',
      row.payment_percentage?.toFixed(1) || '0',
      row.eta || '',
      row.customs_clearance_date || '',
    ]);

    // Create CSV content with UTF-8 BOM for Arabic support
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `accounting_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectAll = () => {
    if (!data?.data) return;
    if (selectedRows.size === data.data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data.data.map(d => d.shipment_id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRows(newSelection);
  };

  // Invoice generation handler
  const handleGenerateInvoice = useCallback(async (
    shipmentId: string,
    type: InvoiceType,
    language: InvoiceLanguage = 'bilingual',
    saveToDatabase: boolean = false
  ) => {
    setIsGeneratingInvoice(true);
    setInvoiceDropdownOpen(null);
    
    try {
      let invoice;
      
      if (saveToDatabase) {
        // Generate and save to database (gets real invoice number)
        invoice = await invoiceService.generateAndSaveInvoice({
        shipment_id: shipmentId,
        type,
        language,
        include_bank_details: true,
      });
        
        if (invoice) {
          toast.success(
            isRtl 
              ? `تم إنشاء الفاتورة ${invoice.invoice_number} وحفظها بنجاح` 
              : `Invoice ${invoice.invoice_number} created and saved successfully`
          );
        }
      } else {
        // Just generate preview (not saved)
        invoice = await invoiceService.generateFromShipment({
          shipment_id: shipmentId,
          type,
          language,
          include_bank_details: true,
        });
      }
      
      if (invoice) {
        setCurrentInvoice(invoice);
        setInvoiceModalOpen(true);
      }
    } catch (error: any) {
      console.error('Failed to generate invoice:', error);
      toast.error(
        isRtl 
          ? `فشل في إنشاء الفاتورة: ${error.message || 'خطأ غير معروف'}` 
          : `Failed to generate invoice: ${error.message || 'Unknown error'}`
      );
    } finally {
      setIsGeneratingInvoice(false);
    }
  }, [isRtl, toast]);

  // Get payment status badge
  const getPaymentStatusBadge = (row: ShipmentFinancialSummary) => {
    if (row.payment_percentage >= 100) {
      return (
        <Badge color="green">
          <CheckCircleIcon className="w-3 h-3 me-1" />
          {isRtl ? 'مدفوع بالكامل' : 'Fully Paid'}
        </Badge>
      );
    } else if (row.payment_percentage >= 50) {
      return (
        <Badge color="yellow">
          <ClockIcon className="w-3 h-3 me-1" />
          {isRtl ? 'مدفوع جزئياً' : 'Partial'}
        </Badge>
      );
    } else if (row.payment_percentage > 0) {
      return (
        <Badge color="orange">
          <ExclamationTriangleIcon className="w-3 h-3 me-1" />
          {isRtl ? 'دفعة أولى' : 'Advance Only'}
        </Badge>
      );
    } else {
      return (
        <Badge color="red">
          <ExclamationTriangleIcon className="w-3 h-3 me-1" />
          {isRtl ? 'غير مدفوع' : 'Unpaid'}
        </Badge>
      );
    }
  };

  // Sort icon component
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) {
      return <ArrowsUpDownIcon className="w-4 h-4 opacity-30" />;
    }
    return sortDir === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 text-blue-600" /> : 
      <ChevronDownIcon className="w-4 h-4 text-blue-600" />;
  };

  // Active filters count
  const activeFiltersCount = [search, statusFilter, directionFilter, balanceFilter !== 'all', dateFrom, dateTo].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <CalculatorIcon className="w-8 h-8 text-blue-600" />
            {t('accounting.title', 'المحاسبة')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('accounting.subtitle', 'عرض تفصيلي للمعاملات المالية لكل شحنة')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FunnelIcon className="w-5 h-5 me-2" />
            {t('common.filter', 'تصفية')}
            {activeFiltersCount > 0 && (
              <span className="ms-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!data?.data?.length}
            className="bg-green-600 hover:bg-green-700"
          >
            <ArrowDownTrayIcon className="w-5 h-5 me-2" />
            {t('common.export', 'تصدير')}
            {selectedRows.size > 0 && ` (${selectedRows.size})`}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-2" aria-label="Tabs">
          <button
            onClick={() => { setActiveTab('clearance'); setTabSearch(''); }}
            className={`group inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'clearance'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DocumentTextIcon className="w-5 h-5" />
            {t('accounting.tabs.clearance', 'تكاليف التخليص')}
            {clearanceData?.pagination?.total ? (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-cyan-100 text-cyan-700 rounded-full">
                {clearanceData.pagination.total}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => { setActiveTab('transport'); setTabSearch(''); }}
            className={`group inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'transport'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TruckIcon className="w-5 h-5" />
            {t('accounting.tabs.transport', 'النقل الداخلي')}
            {transportData?.pagination?.total ? (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                {transportData.pagination.total}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => { setActiveTab('transactions'); setTabSearch(''); }}
            className={`group inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'transactions'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CurrencyDollarIcon className="w-5 h-5" />
            {t('accounting.tabs.transactions', 'المعاملات المالية')}
            {transactionsData?.pagination?.total ? (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full">
                {transactionsData.pagination.total}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => { setActiveTab('inventory'); setTabSearch(''); setInventoryTypeFilter(''); }}
            className={`group inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'inventory'
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BanknotesIcon className="w-5 h-5" />
            {t('accounting.tabs.inventory', 'حركة البضاعة')}
            {inventoryData?.pagination?.total ? (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-violet-100 text-violet-700 rounded-full">
                {inventoryData.pagination.total}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => { setActiveTab('summary'); setTabSearch(''); }}
            className={`group inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardDocumentListIcon className="w-5 h-5" />
            {t('accounting.tabs.summary', 'ملخص الشحنات')}
          </button>
        </nav>
      </div>

      {/* Summary Cards - Only show on summary tab */}
      {activeTab === 'summary' && data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="text-center">
              <p className="text-xs text-blue-600 font-medium uppercase">{t('accounting.totalValue', 'القيمة الإجمالية')}</p>
              <p className="text-xl font-bold text-blue-900">{formatCurrency(data.summary.total_value)}</p>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="text-center">
              <p className="text-xs text-green-600 font-medium uppercase">{t('accounting.totalPaid', 'إجمالي المدفوع')}</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(data.summary.total_paid)}</p>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="text-center">
              <p className="text-xs text-orange-600 font-medium uppercase">{t('accounting.totalRemaining', 'المتبقي')}</p>
              <p className="text-xl font-bold text-orange-900">{formatCurrency(data.summary.total_remaining)}</p>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="text-center">
              <p className="text-xs text-purple-600 font-medium uppercase">{t('accounting.advancePaid', 'الدفعات المقدمة')}</p>
              <p className="text-xl font-bold text-purple-900">{formatCurrency(data.summary.total_advance_paid)}</p>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
            <div className="text-center">
              <p className="text-xs text-cyan-600 font-medium uppercase">{t('accounting.clearanceCosts', 'تكاليف التخليص')}</p>
              <p className="text-xl font-bold text-cyan-900">{formatCurrency(data.summary.total_clearance_costs)}</p>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <div className="text-center">
              <p className="text-xs text-amber-600 font-medium uppercase">{t('accounting.transportCosts', 'تكاليف النقل')}</p>
              <p className="text-xl font-bold text-amber-900">{formatCurrency(data.summary.total_internal_transport)}</p>
            </div>
          </Card>
        </div>
      )}

      {/* ================= SUMMARY TAB ================= */}
      {activeTab === 'summary' && (
        <>
      {/* Search & Filters */}
      <Card>
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('accounting.searchPlaceholder', 'البحث برقم العقد أو المنتج أو الموضوع...')}
              className="w-full ps-10 pe-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setBalanceFilter('all'); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                balanceFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('accounting.filterAll', 'الكل')}
              {data && <span className="ms-1">({data.pagination.total})</span>}
            </button>
            <button
              onClick={() => { setBalanceFilter('has_balance'); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                balanceFilter === 'has_balance' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}
            >
              <ExclamationTriangleIcon className="w-4 h-4 inline me-1" />
              {t('accounting.filterHasBalance', 'عليها رصيد متبقي')}
            </button>
            <button
              onClick={() => { setBalanceFilter('fully_paid'); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                balanceFilter === 'fully_paid' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              <CheckCircleIcon className="w-4 h-4 inline me-1" />
              {t('accounting.filterFullyPaid', 'مدفوعة بالكامل')}
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('accounting.status', 'الحالة')}
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('common.all', 'الكل')}</option>
                    <option value="planning">{statusToArabic('planning')}</option>
                    <option value="booked">{statusToArabic('booked')}</option>
                    <option value="sailed">{statusToArabic('sailed')}</option>
                    <option value="arrived">{statusToArabic('arrived')}</option>
                    <option value="delivered">{statusToArabic('delivered')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('accounting.direction', 'الاتجاه')}
                  </label>
                  <select
                    value={directionFilter}
                    onChange={(e) => { setDirectionFilter(e.target.value as any); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('common.all', 'الكل')}</option>
                    <option value="incoming">{isRtl ? 'وارد' : 'Incoming'}</option>
                    <option value="outgoing">{isRtl ? 'صادر' : 'Outgoing'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('common.from', 'من تاريخ')}
                  </label>
                  <DateInput
                    value={dateFrom}
                    onChange={(val) => { setDateFrom(val); setPage(1); }}
                    className="w-full border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('common.to', 'إلى تاريخ')}
                  </label>
                  <DateInput
                    value={dateTo}
                    onChange={(val) => { setDateTo(val); setPage(1); }}
                    className="w-full border-gray-300"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button variant="secondary" onClick={handleClearFilters}>
                  {t('common.clearFilters', 'مسح التصفية')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Main Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{t('common.error', 'حدث خطأ')}</p>
            <Button variant="secondary" onClick={() => refetch()} className="mt-4">
              {t('common.retry', 'إعادة المحاولة')}
            </Button>
          </div>
        ) : !data?.data?.length ? (
          <div className="text-center py-12">
            <BanknotesIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('accounting.noResults', 'لا توجد نتائج')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1600px' }}>
                <thead className="bg-gray-50">
                  <tr>
                    {/* Checkbox */}
                    <th className="px-3 py-3 text-center w-12 sticky start-0 bg-gray-50 z-10">
                      <input
                        type="checkbox"
                        checked={data.data.length > 0 && selectedRows.size === data.data.length}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>

                    {/* SN */}
                    <th
                      onClick={() => handleSort('sn')}
                      className="px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="w-4 h-4" />
                        {t('accounting.sn', 'رقم العقد')}
                        <SortIcon column="sn" />
                      </div>
                    </th>

                    {/* Product */}
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('accounting.product', 'المنتج')}
                    </th>

                    {/* Final Owner (FB) */}
                    <th className="px-4 py-3 text-start text-xs font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50/50">
                      {t('accounting.finalOwner', 'المالك النهائي')}
                    </th>

                    {/* Final Place */}
                    <th className="px-4 py-3 text-start text-xs font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50/50">
                      {t('accounting.finalPlace', 'المكان النهائي')}
                    </th>

                    {/* Status */}
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('accounting.status', 'الحالة')}
                    </th>

                    {/* Total Value */}
                    <th
                      onClick={() => handleSort('total_value_usd')}
                      className="px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        {t('accounting.totalValue', 'القيمة الإجمالية')}
                        <SortIcon column="total_value_usd" />
                      </div>
                    </th>

                    {/* Advance Paid */}
                    <th
                      onClick={() => handleSort('advance_paid')}
                      className="px-4 py-3 text-start text-xs font-semibold text-purple-600 uppercase tracking-wider cursor-pointer hover:bg-purple-50 bg-purple-50/50"
                    >
                      <div className="flex items-center gap-2">
                        {t('accounting.advancePaid', 'الدفعة المقدمة')}
                        <SortIcon column="advance_paid" />
                      </div>
                    </th>

                    {/* Balance Paid */}
                    <th
                      onClick={() => handleSort('balance_paid')}
                      className="px-4 py-3 text-start text-xs font-semibold text-green-600 uppercase tracking-wider cursor-pointer hover:bg-green-50 bg-green-50/50"
                    >
                      <div className="flex items-center gap-2">
                        {t('accounting.balancePaid', 'الرصيد المدفوع')}
                        <SortIcon column="balance_paid" />
                      </div>
                    </th>

                    {/* Clearance Cost */}
                    <th
                      onClick={() => handleSort('clearance_cost')}
                      className="px-4 py-3 text-start text-xs font-semibold text-cyan-600 uppercase tracking-wider cursor-pointer hover:bg-cyan-50 bg-cyan-50/50"
                    >
                      <div className="flex items-center gap-2">
                        {t('accounting.clearanceCost', 'تكلفة التخليص')}
                        <SortIcon column="clearance_cost" />
                      </div>
                    </th>

                    {/* Internal Transport */}
                    <th
                      onClick={() => handleSort('internal_transport')}
                      className="px-4 py-3 text-start text-xs font-semibold text-amber-600 uppercase tracking-wider cursor-pointer hover:bg-amber-50 bg-amber-50/50"
                    >
                      <div className="flex items-center gap-2">
                        <TruckIcon className="w-4 h-4" />
                        {t('accounting.internalTransport', 'النقل الداخلي')}
                        <SortIcon column="internal_transport" />
                      </div>
                    </th>

                    {/* Other Costs */}
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                      {t('accounting.otherCosts', 'تكاليف أخرى')}
                    </th>

                    {/* Total Paid */}
                    <th
                      onClick={() => handleSort('total_paid')}
                      className="px-4 py-3 text-start text-xs font-semibold text-blue-600 uppercase tracking-wider cursor-pointer hover:bg-blue-50 bg-blue-50/50"
                    >
                      <div className="flex items-center gap-2">
                        {t('accounting.totalPaid', 'إجمالي المدفوع')}
                        <SortIcon column="total_paid" />
                      </div>
                    </th>

                    {/* Remaining Balance */}
                    <th
                      onClick={() => handleSort('remaining_balance')}
                      className="px-4 py-3 text-start text-xs font-semibold text-orange-600 uppercase tracking-wider cursor-pointer hover:bg-orange-50 bg-orange-50/50"
                    >
                      <div className="flex items-center gap-2">
                        {t('accounting.remainingBalance', 'المتبقي')}
                        <SortIcon column="remaining_balance" />
                      </div>
                    </th>

                    {/* Payment % */}
                    <th
                      onClick={() => handleSort('payment_percentage')}
                      className="px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        {t('accounting.paymentStatus', 'حالة الدفع')}
                        <SortIcon column="payment_percentage" />
                      </div>
                    </th>

                    {/* ETA */}
                    <th
                      onClick={() => handleSort('eta')}
                      className="px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        {t('accounting.eta', 'تاريخ الوصول')}
                        <SortIcon column="eta" />
                      </div>
                    </th>

                    {/* Actions - Invoice */}
                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50">
                      {t('invoice.generate', 'إنشاء فاتورة')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.data.map((row) => (
                    <tr
                      key={row.shipment_id}
                      className={`hover:bg-gray-50 transition-colors ${selectedRows.has(row.shipment_id) ? 'bg-blue-50' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center sticky start-0 bg-white z-10">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.shipment_id)}
                          onChange={() => handleToggleSelect(row.shipment_id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>

                      {/* SN */}
                      <td className="px-4 py-3">
                        {row.shipment_id ? (
                          <ShipmentSummaryPopover 
                            shipmentId={row.shipment_id} 
                            shipmentSn={row.sn || '—'}
                          />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                        <TruncatedText text={row.product_text} maxWidth="200px">
                          <TranslatedProductText text={row.product_text} />
                        </TruncatedText>
                      </td>

                      {/* Final Owner */}
                      <td className="px-4 py-3 text-sm text-indigo-700 bg-indigo-50/30 max-w-xs truncate" title={row.final_owner || undefined}>
                        {row.final_owner || <span className="text-gray-400">—</span>}
                      </td>

                      {/* Final Place */}
                      <td className="px-4 py-3 text-sm text-indigo-700 bg-indigo-50/30 max-w-xs truncate" title={row.final_place || undefined}>
                        {row.final_place || <span className="text-gray-400">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge color={getStatusColor(row.status) as any}>
                          {isRtl ? statusToArabic(row.status) : row.status}
                        </Badge>
                      </td>

                      {/* Total Value */}
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatCurrency(row.total_value_usd)}
                      </td>

                      {/* Advance Paid */}
                      <td className="px-4 py-3 text-sm font-medium text-purple-700 bg-purple-50/30">
                        {row.advance_paid > 0 ? formatCurrency(row.advance_paid) : <span className="text-gray-400">—</span>}
                      </td>

                      {/* Balance Paid */}
                      <td className="px-4 py-3 text-sm font-medium text-green-700 bg-green-50/30">
                        {row.balance_paid > 0 ? formatCurrency(row.balance_paid) : <span className="text-gray-400">—</span>}
                      </td>

                      {/* Clearance Cost */}
                      <td className="px-4 py-3 text-sm font-medium text-cyan-700 bg-cyan-50/30">
                        {row.clearance_cost > 0 ? formatCurrency(row.clearance_cost) : <span className="text-gray-400">—</span>}
                      </td>

                      {/* Internal Transport */}
                      <td className="px-4 py-3 text-sm font-medium text-amber-700 bg-amber-50/30">
                        {row.internal_transport > 0 ? formatCurrency(row.internal_transport) : <span className="text-gray-400">—</span>}
                      </td>

                      {/* Other Costs */}
                      <td className="px-4 py-3 text-sm text-gray-500 bg-gray-50/30">
                        {row.other_costs > 0 ? formatCurrency(row.other_costs) : <span className="text-gray-400">—</span>}
                      </td>

                      {/* Total Paid */}
                      <td className="px-4 py-3 text-sm font-bold text-blue-700 bg-blue-50/30">
                        {formatCurrency(row.total_paid)}
                      </td>

                      {/* Remaining Balance */}
                      <td className="px-4 py-3 text-sm font-bold bg-orange-50/30">
                        <span className={row.remaining_balance > 0 ? 'text-orange-600' : 'text-green-600'}>
                          {formatCurrency(row.remaining_balance)}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getPaymentStatusBadge(row)}
                          <span className="text-xs text-gray-500">
                            ({formatNumber(row.payment_percentage.toFixed(0))}%)
                          </span>
                        </div>
                      </td>

                      {/* ETA */}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDateString(row.eta)}
                      </td>

                      {/* Invoice Actions */}
                      <td className="px-4 py-3 bg-gray-50">
                        <div className="relative">
                          <button
                            onClick={() => setInvoiceDropdownOpen(invoiceDropdownOpen === row.shipment_id ? null : row.shipment_id)}
                            disabled={isGeneratingInvoice}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors"
                          >
                            <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                            {t('invoice.generate', 'إنشاء فاتورة')}
                          </button>
                          
                          {/* Dropdown */}
                          {invoiceDropdownOpen === row.shipment_id && (
                            <div className="absolute end-0 mt-1 w-56 bg-white rounded-lg shadow-lg border z-20 max-h-96 overflow-y-auto">
                              <div className="py-1">
                                {/* Purchase Invoice - Preview */}
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b bg-gray-50">
                                  {t('invoice.purchaseInvoice', 'فاتورة شراء')} - {isRtl ? 'معاينة' : 'Preview'}
                                </div>
                                <button
                                  onClick={() => handleGenerateInvoice(row.shipment_id, 'purchase', 'bilingual', false)}
                                  className="w-full text-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {isRtl ? 'ثنائي اللغة' : 'Bilingual'}
                                </button>
                                <button
                                  onClick={() => handleGenerateInvoice(row.shipment_id, 'purchase', 'ar', false)}
                                  className="w-full text-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {isRtl ? 'العربية فقط' : 'Arabic Only'}
                                </button>
                                <button
                                  onClick={() => handleGenerateInvoice(row.shipment_id, 'purchase', 'en', false)}
                                  className="w-full text-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {isRtl ? 'الإنجليزية فقط' : 'English Only'}
                                </button>
                                
                                {/* Purchase Invoice - Save */}
                                <div className="px-3 py-2 text-xs font-semibold text-green-600 border-t border-b mt-1 bg-green-50">
                                  {t('invoice.purchaseInvoice', 'فاتورة شراء')} - {isRtl ? 'حفظ' : 'Save'}
                                </div>
                                <button
                                  onClick={() => handleGenerateInvoice(row.shipment_id, 'purchase', 'bilingual', true)}
                                  className="w-full text-start px-3 py-2 text-sm text-green-700 hover:bg-green-50"
                                >
                                  {isRtl ? 'ثنائي اللغة (حفظ)' : 'Bilingual (Save)'}
                                </button>
                                
                                {/* Sales Invoice - Preview */}
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-t border-b mt-1 bg-gray-50">
                                  {t('invoice.salesInvoice', 'فاتورة مبيع')} - {isRtl ? 'معاينة' : 'Preview'}
                                </div>
                                <button
                                  onClick={() => handleGenerateInvoice(row.shipment_id, 'sales', 'bilingual', false)}
                                  className="w-full text-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {isRtl ? 'ثنائي اللغة' : 'Bilingual'}
                                </button>
                                <button
                                  onClick={() => handleGenerateInvoice(row.shipment_id, 'sales', 'ar', false)}
                                  className="w-full text-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {isRtl ? 'العربية فقط' : 'Arabic Only'}
                                </button>
                                <button
                                  onClick={() => handleGenerateInvoice(row.shipment_id, 'sales', 'en', false)}
                                  className="w-full text-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {isRtl ? 'الإنجليزية فقط' : 'English Only'}
                                </button>
                                
                                {/* Sales Invoice - Save */}
                                <div className="px-3 py-2 text-xs font-semibold text-green-600 border-t border-b mt-1 bg-green-50">
                                  {t('invoice.salesInvoice', 'فاتورة مبيع')} - {isRtl ? 'حفظ' : 'Save'}
                                </div>
                                <button
                                  onClick={() => handleGenerateInvoice(row.shipment_id, 'sales', 'bilingual', true)}
                                  className="w-full text-start px-3 py-2 text-sm text-green-700 hover:bg-green-50"
                                >
                                  {isRtl ? 'ثنائي اللغة (حفظ)' : 'Bilingual (Save)'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer with totals */}
                {data.summary && (
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm text-gray-700">
                        {t('accounting.totals', 'الإجماليات')} ({data.data.length} {t('accounting.shipments', 'شحنات')})
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(data.summary.total_value)}
                      </td>
                      <td className="px-4 py-3 text-sm text-purple-700 bg-purple-100/50">
                        {formatCurrency(data.summary.total_advance_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-700 bg-green-100/50">
                        {formatCurrency(data.summary.total_balance_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-cyan-700 bg-cyan-100/50">
                        {formatCurrency(data.summary.total_clearance_costs)}
                      </td>
                      <td className="px-4 py-3 text-sm text-amber-700 bg-amber-100/50">
                        {formatCurrency(data.summary.total_internal_transport)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 bg-gray-100/50">
                        {formatCurrency(data.summary.total_other_costs)}
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-700 bg-blue-100/50">
                        {formatCurrency(data.summary.total_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-orange-700 bg-orange-100/50">
                        {formatCurrency(data.summary.total_remaining)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatNumber(data.summary.average_payment_percentage.toFixed(0))}%
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination */}
            {data.pagination && data.pagination.pages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={page}
                  totalPages={data.pagination.pages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </Card>
        </>
      )}

      {/* ================= CLEARANCE COSTS TAB ================= */}
      {activeTab === 'clearance' && (
        <Card>
          <div className="space-y-4">
            {/* Search and Toggle */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={tabSearch}
                  onChange={(e) => { setTabSearch(e.target.value); setClearancePage(1); }}
                  placeholder={t('accounting.searchClearance', 'البحث برقم الملف، البوليصة، الفاتورة...')}
                  className="w-full ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
              {/* Documentation Toggle */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setShowDocumented(false)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    !showDocumented 
                      ? 'bg-cyan-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ClockIcon className="w-4 h-4 inline me-1" />
                  {t('accounting.showPending', 'عرض المعلق')}
                </button>
                <button
                  onClick={() => setShowDocumented(true)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    showDocumented 
                      ? 'bg-green-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <DocumentCheckIcon className="w-4 h-4 inline me-1" />
                  {t('accounting.showDocumented', 'عرض المُرحّل')}
                </button>
              </div>
            </div>

            {clearanceLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : !clearanceData?.data?.length ? (
              <div className="text-center py-12 text-gray-500">
                <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>{showDocumented ? t('accounting.noDocumentedClearance', 'لا توجد تكاليف تخليص مُرحّلة') : t('accounting.noClearanceCosts', 'لا توجد تكاليف تخليص')}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={showDocumented ? 'bg-green-50' : 'bg-cyan-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-cyan-700'}`}>{t('accounting.fileNumber', 'رقم الملف')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-cyan-700'}`}>{t('accounting.shipmentSn', 'رقم الشحنة')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-cyan-700'}`}>{t('accounting.description', 'الوصف')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-cyan-700'}`}>{t('accounting.clearanceType', 'نوع التخليص')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-cyan-700'}`}>{t('accounting.extraCost', 'تكلفة إضافية')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-cyan-700'}`}>{t('accounting.totalCost', 'الإجمالي')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-cyan-700'}`}>{t('accounting.clearanceDate', 'تاريخ التخليص')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-cyan-700'}`}>{t('accounting.actions', 'إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {clearanceData.data.map((row: ClearanceCostRow) => (
                        <tr key={row.id} className={`hover:bg-cyan-50/30 ${showDocumented ? 'bg-green-50/20' : ''}`}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.file_number || '—'}</td>
                          <td className="px-4 py-3 text-sm">
                            {row.shipment_id && row.shipment_sn ? (
                              <ShipmentSummaryPopover 
                                shipmentId={row.shipment_id} 
                                shipmentSn={row.shipment_sn}
                              />
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={row.transaction_description}>{row.transaction_description || '—'}</td>
                          <td className="px-4 py-3">
                            <Badge color={row.clearance_type === 'inbound' ? 'blue' : 'orange'}>
                              {row.clearance_type === 'inbound' ? (isRtl ? 'وارد' : 'Inbound') : (isRtl ? 'صادر' : 'Outbound')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-orange-600">{row.extra_cost_amount ? formatCurrency(row.extra_cost_amount) : '—'}</td>
                          <td className="px-4 py-3 text-sm font-bold text-cyan-700">{formatCurrency(row.total_clearing_cost)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDateString(row.customs_clearance_date)}</td>
                          <td className="px-4 py-3">
                            {showDocumented ? (
                              <button
                                onClick={() => undocumentMutation.mutate({ record_type: 'clearance_cost', record_id: row.id })}
                                disabled={undocumentMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition-colors"
                              >
                                <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                                {t('accounting.undocument', 'إلغاء الترحيل')}
                              </button>
                            ) : (
                              <button
                                onClick={() => documentMutation.mutate({ record_type: 'clearance_cost', record_id: row.id })}
                                disabled={documentMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
                              >
                                <DocumentCheckIcon className="w-3.5 h-3.5" />
                                {t('accounting.document', 'ترحيل')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {clearanceData.pagination && clearanceData.pagination.pages > 1 && (
                  <div className="mt-4">
                    <Pagination currentPage={clearancePage} totalPages={clearanceData.pagination.pages} onPageChange={setClearancePage} />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* ================= TRANSPORT TAB ================= */}
      {activeTab === 'transport' && (
        <Card>
          <div className="space-y-4">
            {/* Search and Toggle */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={tabSearch}
                  onChange={(e) => { setTabSearch(e.target.value); setTransportPage(1); }}
                  placeholder={t('accounting.searchTransport', 'البحث بشركة النقل، شركة التأمين، رقم الشاحنة...')}
                  className="w-full ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              {/* Documentation Toggle */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setShowDocumented(false)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    !showDocumented 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ClockIcon className="w-4 h-4 inline me-1" />
                  {t('accounting.showPending', 'عرض المعلق')}
                </button>
                <button
                  onClick={() => setShowDocumented(true)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    showDocumented 
                      ? 'bg-green-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <DocumentCheckIcon className="w-4 h-4 inline me-1" />
                  {t('accounting.showDocumented', 'عرض المُرحّل')}
                </button>
              </div>
            </div>

            {transportLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : !transportData?.data?.length ? (
              <div className="text-center py-12 text-gray-500">
                <TruckIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>{showDocumented ? t('accounting.noDocumentedTransport', 'لا توجد عمليات نقل مُرحّلة') : t('accounting.noTransport', 'لا توجد عمليات نقل')}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={showDocumented ? 'bg-green-50' : 'bg-amber-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.deliveryNumber', 'رقم التسليم')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.shipmentSn', 'رقم الشحنة')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.transportCompany', 'شركة النقل')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.truckPlate', 'رقم الشاحنة')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.origin', 'من')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.destination', 'إلى')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.transportCost', 'تكلفة النقل')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.insuranceCompany', 'شركة التأمين')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.insuranceCost', 'تكلفة التأمين')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.totalCost', 'الإجمالي')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.status', 'الحالة')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.departureDate', 'تاريخ المغادرة')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold uppercase ${showDocumented ? 'text-green-700' : 'text-amber-700'}`}>{t('accounting.actions', 'إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {transportData.data.map((row: TransportRow) => (
                        <tr key={row.id} className={`hover:bg-amber-50/30 ${showDocumented ? 'bg-green-50/20' : ''}`}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.delivery_number || '—'}</td>
                          <td className="px-4 py-3 text-sm">
                            {row.shipment_sn ? (
                              <button onClick={() => navigate(`/shipments/${row.shipment_id}`)} className="text-blue-600 hover:underline">
                                {row.shipment_sn}
                              </button>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-amber-800">{row.transport_company || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.truck_plate || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.origin || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.destination || '—'}</td>
                          <td className="px-4 py-3 text-sm text-amber-700">{row.transport_cost ? formatCurrency(row.transport_cost) : '—'}</td>
                          <td className="px-4 py-3 text-sm text-purple-700">{row.insurance_company || '—'}</td>
                          <td className="px-4 py-3 text-sm text-purple-600">{row.insurance_cost ? formatCurrency(row.insurance_cost) : '—'}</td>
                          <td className="px-4 py-3 text-sm font-bold text-amber-800">{formatCurrency(row.total_cost || 0)}</td>
                          <td className="px-4 py-3">
                            <Badge color={row.status === 'delivered' ? 'green' : row.status === 'in_transit' ? 'blue' : 'gray'}>
                              {row.status === 'delivered' ? (isRtl ? 'تم التسليم' : 'Delivered') : row.status === 'in_transit' ? (isRtl ? 'في الطريق' : 'In Transit') : (isRtl ? 'معلق' : 'Pending')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDateString(row.departure_date)}</td>
                          <td className="px-4 py-3">
                            {showDocumented ? (
                              <button
                                onClick={() => undocumentMutation.mutate({ record_type: 'transport', record_id: row.id })}
                                disabled={undocumentMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition-colors"
                              >
                                <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                                {t('accounting.undocument', 'إلغاء الترحيل')}
                              </button>
                            ) : (
                              <button
                                onClick={() => documentMutation.mutate({ record_type: 'transport', record_id: row.id })}
                                disabled={documentMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
                              >
                                <DocumentCheckIcon className="w-3.5 h-3.5" />
                                {t('accounting.document', 'ترحيل')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {transportData.pagination && transportData.pagination.pages > 1 && (
                  <div className="mt-4">
                    <Pagination currentPage={transportPage} totalPages={transportData.pagination.pages} onPageChange={setTransportPage} />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* ================= TRANSACTIONS TAB ================= */}
      {activeTab === 'transactions' && (
        <Card>
          <div className="space-y-4">
            {/* Search and Toggle */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={tabSearch}
                  onChange={(e) => { setTabSearch(e.target.value); setTransactionsPage(1); }}
                  placeholder={t('accounting.searchTransactions', 'البحث بالمرجع، الوصف، الطرف...')}
                  className="w-full ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              {/* Documentation Toggle */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setShowDocumented(false)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    !showDocumented 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ClockIcon className="w-4 h-4 inline me-1" />
                  {t('accounting.showPending', 'عرض المعلق')}
                </button>
                <button
                  onClick={() => setShowDocumented(true)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    showDocumented 
                      ? 'bg-green-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <DocumentCheckIcon className="w-4 h-4 inline me-1" />
                  {t('accounting.showDocumented', 'عرض المُرحّل')}
                </button>
              </div>
            </div>

            {transactionsLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : !transactionsData?.data?.length ? (
              <div className="text-center py-12 text-gray-500">
                <CurrencyDollarIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>{showDocumented ? t('accounting.noDocumentedTransactions', 'لا توجد معاملات مالية مُرحّلة') : t('accounting.noTransactions', 'لا توجد معاملات مالية')}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={showDocumented ? 'bg-green-100' : 'bg-green-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.transactionDate', 'التاريخ')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.shipmentSn', 'رقم الشحنة')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.transactionType', 'النوع')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.amount', 'المبلغ')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.otherCurrency', 'العملة الأخرى')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.currency', 'العملة')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.fromFund', 'من صندوق')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.toFund', 'إلى صندوق')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.description', 'الوصف')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.status', 'الحالة')}</th>
                        <th className={`px-4 py-3 text-start text-xs font-semibold text-green-700 uppercase`}>{t('accounting.actions', 'إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {transactionsData.data.map((row: TransactionRow) => (
                        <tr key={row.id} className={`hover:bg-green-50/30 ${showDocumented ? 'bg-green-50/20' : ''}`}>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDateString(row.transaction_date)}</td>
                          <td className="px-4 py-3 text-sm">
                            {row.shipment_sn ? (
                              <button onClick={() => navigate(`/shipments/${row.shipment_id}`)} className="text-blue-600 hover:underline">
                                {row.shipment_sn}
                              </button>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge color={
                              row.transaction_type === 'advance_payment' ? 'purple' :
                              row.transaction_type === 'balance_payment' ? 'green' :
                              row.transaction_type === 'customs_clearing_cost' ? 'cyan' :
                              row.transaction_type === 'transport_cost' ? 'amber' : 'gray'
                            }>
                              {row.transaction_type === 'advance_payment' ? (isRtl ? 'دفعة مقدمة' : 'Advance') :
                               row.transaction_type === 'balance_payment' ? (isRtl ? 'رصيد' : 'Balance') :
                               row.transaction_type === 'customs_clearing_cost' ? (isRtl ? 'تخليص' : 'Clearance') :
                               row.transaction_type === 'transport_cost' ? (isRtl ? 'نقل' : 'Transport') :
                               row.transaction_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-green-700">{formatCurrency(row.amount)}</td>
                          <td className="px-4 py-3 text-sm text-blue-600">
                            {row.currency !== 'USD' && row.amount_other ? (
                              <span>{row.amount_other.toLocaleString()} {row.currency}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.currency}</td>
                          <td className="px-4 py-3 text-sm text-red-600">
                            {row.direction === 'out' ? (row.fund_source || '—') : (row.party_name || '—')}
                          </td>
                          <td className="px-4 py-3 text-sm text-emerald-600">
                            {row.direction === 'out' ? (row.party_name || '—') : (row.fund_source || '—')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={row.description || undefined}>{row.description || '—'}</td>
                          <td className="px-4 py-3">
                            <Badge color={row.status === 'completed' ? 'green' : row.status === 'pending' ? 'yellow' : 'gray'}>
                              {row.status === 'completed' ? (isRtl ? 'مكتمل' : 'Completed') : row.status === 'pending' ? (isRtl ? 'معلق' : 'Pending') : row.status || '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {showDocumented ? (
                              <button
                                onClick={() => undocumentMutation.mutate({ record_type: 'transaction', record_id: row.id })}
                                disabled={undocumentMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition-colors"
                              >
                                <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                                {t('accounting.undocument', 'إلغاء الترحيل')}
                              </button>
                            ) : (
                              <button
                                onClick={() => documentMutation.mutate({ record_type: 'transaction', record_id: row.id })}
                                disabled={documentMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
                              >
                                <DocumentCheckIcon className="w-3.5 h-3.5" />
                                {t('accounting.document', 'ترحيل')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {transactionsData.pagination && transactionsData.pagination.pages > 1 && (
                  <div className="mt-4">
                    <Pagination currentPage={transactionsPage} totalPages={transactionsData.pagination.pages} onPageChange={setTransactionsPage} />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* ================= INVENTORY TAB (حركة البضاعة) ================= */}
      {activeTab === 'inventory' && (
        <Card>
          <div className="space-y-4">
            {/* Header with Summary Cards */}
            {inventoryData?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-violet-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-violet-600 font-medium">{t('accounting.totalRecords', 'إجمالي السجلات')}</p>
                  <p className="text-lg font-bold text-violet-900">{inventoryData.summary.total_records}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 font-medium">{t('accounting.purchases', 'المشتريات')}</p>
                  <p className="text-lg font-bold text-green-900">{inventoryData.summary.purchase_count}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">{t('accounting.sales', 'المبيعات')}</p>
                  <p className="text-lg font-bold text-blue-900">{inventoryData.summary.sale_count}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-amber-600 font-medium">{t('accounting.totalQuantity', 'الكمية الإجمالية')}</p>
                  <p className="text-lg font-bold text-amber-900">{formatNumber(inventoryData.summary.total_quantity)} {t('accounting.ton', 'طن')}</p>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={tabSearch}
                  onChange={(e) => { setTabSearch(e.target.value); setInventoryPage(1); }}
                  placeholder={t('accounting.searchInventory', 'البحث بالصنف، المورد، المالك النهائي...')}
                  className="w-full ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>
              {/* Invoice Type Filter */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => { setInventoryTypeFilter(''); setInventoryPage(1); }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    inventoryTypeFilter === '' 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('accounting.all', 'الكل')}
                </button>
                <button
                  onClick={() => { setInventoryTypeFilter('شراء'); setInventoryPage(1); }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    inventoryTypeFilter === 'شراء' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('accounting.purchase', 'شراء')}
                </button>
                <button
                  onClick={() => { setInventoryTypeFilter('مبيع'); setInventoryPage(1); }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    inventoryTypeFilter === 'مبيع' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('accounting.sale', 'مبيع')}
                </button>
              </div>
            </div>

            {inventoryLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : !inventoryData?.data?.length ? (
              <div className="text-center py-12 text-gray-500">
                <BanknotesIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>{t('accounting.noInventory', 'لا توجد حركة بضاعة')}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-violet-50">
                      <tr>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">#</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.invoiceType', 'نوع الفاتورة')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.productName', 'اسم الصنف')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.packaging', 'التعبئة')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.packageCount', 'عدد العبوات')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase" title="الكمية من بنود المنتجات (المصدر المعتمد تجارياً)">
                          {t('accounting.quantity', 'الكمية')}
                        </th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.unit', 'الوحدة')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase text-gray-400" title="وزن البوليصة (مرجعي للوجستيات فقط)">
                          {t('accounting.bolWeight', 'وزن ب/ل')}
                        </th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.purchasePrice', 'سعر الشراء')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.total', 'الإجمالي')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.supplier', 'المورد')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.arrivalDate', 'تاريخ الوصول')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.finalOwner', 'المالك النهائي')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.pod', 'الميناء')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.route', 'المسار')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.salePrice', 'سعر المبيع')}</th>
                        <th className="px-3 py-3 text-start text-xs font-semibold text-violet-700 uppercase">{t('accounting.notes', 'ملاحظات')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {inventoryData.data.map((row: InventoryTransactionRow) => (
                        <tr key={row.id} className="hover:bg-violet-50/30">
                          <td className="px-3 py-3 text-sm text-gray-500">{row.row_number}</td>
                          <td className="px-3 py-3">
                            <Badge color={row.invoice_type === 'شراء' ? 'green' : 'blue'}>
                              {row.invoice_type}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900 max-w-xs">
                            <TruncatedText text={row.product_name} maxWidth="200px">
                              {row.sn ? (
                                <button onClick={() => navigate(`/shipments/${row.id}`)} className="text-violet-600 hover:underline truncate">
                                  {row.product_name || row.sn}
                                </button>
                              ) : <span className="truncate">{row.product_name || '—'}</span>}
                            </TruncatedText>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">{row.packaging || '—'}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{row.package_count ? formatNumber(row.package_count) : '—'}</td>
                          <td className="px-3 py-3 text-sm text-gray-900 font-medium" title="الكمية من بنود المنتجات (المصدر المعتمد)">
                            {row.quantity ? formatNumber(row.quantity, 3) : '—'}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">{row.unit || 'MT'}</td>
                          <td className="px-3 py-3 text-sm text-gray-400" title="وزن البوليصة (مرجعي فقط)">
                            {row.bol_weight_mt ? formatNumber(row.bol_weight_mt, 3) : '—'}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">{row.purchase_price ? formatCurrency(row.purchase_price) : '—'}</td>
                          <td className="px-3 py-3 text-sm font-bold text-violet-700">{row.total ? formatCurrency(row.total) : '—'}</td>
                          <td className="px-3 py-3 text-sm text-gray-600 max-w-xs truncate" title={row.supplier}>{row.supplier || '—'}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{row.arrival_date ? formatDateString(row.arrival_date) : '—'}</td>
                          <td className="px-3 py-3 text-sm text-gray-600 max-w-xs truncate" title={row.final_owner}>{row.final_owner || '—'}</td>
                          <td className="px-3 py-3 text-sm text-cyan-600">{row.pod || '—'}</td>
                          <td className="px-3 py-3 text-sm text-indigo-600 max-w-xs" title={row.pod && row.final_destination_place ? `${row.pod}${row.is_cross_border && row.primary_border_name ? ` → ${row.primary_border_name}` : ''} → ${row.final_destination_place}` : ''}>
                            {row.pod && row.final_destination_place ? (
                              <div className="flex items-center gap-1 flex-wrap" dir="ltr">
                                <span>{row.pod}</span>
                                {row.is_cross_border && row.primary_border_name && (
                                  <>
                                    <span className="text-amber-500">→</span>
                                    <span className="text-amber-600 bg-amber-50 px-1 py-0.5 rounded text-xs whitespace-nowrap">
                                      🚧 {row.primary_border_name}
                                    </span>
                                  </>
                                )}
                                <span className={row.is_cross_border ? 'text-amber-500' : 'text-indigo-400'}>→</span>
                                <span className="truncate">{row.final_destination_place}</span>
                              </div>
                            ) : row.pod || row.final_destination_place || '—'}
                          </td>
                          <td className="px-3 py-3 text-sm text-blue-600">{row.sale_price ? formatCurrency(row.sale_price) : '—'}</td>
                          <td className="px-3 py-3 text-sm text-gray-500 max-w-xs truncate" title={row.notes || undefined}>{row.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {inventoryData.pagination && inventoryData.pagination.pages > 1 && (
                  <div className="mt-4">
                    <Pagination currentPage={inventoryPage} totalPages={inventoryData.pagination.pages} onPageChange={setInventoryPage} />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        invoice={currentInvoice}
        isOpen={invoiceModalOpen}
        onClose={() => {
          setInvoiceModalOpen(false);
          setCurrentInvoice(null);
        }}
      />

      {/* Click outside to close dropdown */}
      {invoiceDropdownOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setInvoiceDropdownOpen(null)}
        />
      )}
    </div>
  );
}

export default AccountingPage;

