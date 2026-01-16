import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FieldHighlighter } from '../components/common/FieldHighlighter';
import { MagnifyingGlassIcon, FunnelIcon, ArrowsUpDownIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, SparklesIcon, ClockIcon, BookmarkIcon, TrashIcon, ArrowDownTrayIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useShipments } from '../hooks/useShipments';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useFilterSuggestions } from '../hooks/useFilterSuggestions';
import { useUserPreferences, SHIPMENT_COLUMN_CONFIG, DEFAULT_SHIPMENT_COLUMNS } from '../hooks/useUserPreferences';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Pagination } from '../components/common/Pagination';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { QuickFiltersPanel } from '../components/shipments/QuickFiltersPanel';
import { BulkActionsBar } from '../components/shipments/BulkActionsBar';
import { ComparisonModal } from '../components/shipments/ComparisonModal';
import { NewShipmentWizard } from '../components/shipments/NewShipmentWizard';
import { DemurrageInlineBadge } from '../components/shipments/DemurrageStatusBadge';
import { TranslatedProductText } from '../components/common/TranslatedProductText';
import { TruncatedText } from '../components/common/TruncatedText';
import { formatNumber, formatCurrency, formatDateString, statusToArabic, getStatusColor } from '../utils/format';
import { parseSearch, getSearchExamples, type ParsedSearch } from '../utils/searchParser';
import { bulkDeleteShipments } from '../services/shipments';

type SortColumn = 'sn' | 'product_text' | 'eta' | 'weight_ton' | 'total_value_usd' | 'fixed_price_usd_per_ton' | 'container_count' | 'balance_value_usd' | 'status' | 'created_at' | 'updated_at' | 'etd';

export function ShipmentsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { getShipmentColumns } = useUserPreferences();
  const [page, setPage] = useState(1);
  const [rawSearch, setRawSearch] = useState('');
  const [parsedSearch, setParsedSearch] = useState<ParsedSearch>({});
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortColumn>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Manual numeric filter states
  const [manualValueOp, setManualValueOp] = useState<string>('');
  const [manualValueNum, setManualValueNum] = useState<string>('');
  const [manualContainerOp, setManualContainerOp] = useState<string>('');
  const [manualContainerNum, setManualContainerNum] = useState<string>('');
  const [manualWeightOp, setManualWeightOp] = useState<string>('');
  const [manualWeightNum, setManualWeightNum] = useState<string>('');
  const [manualBalanceOp, setManualBalanceOp] = useState<string>('');
  const [manualBalanceNum, setManualBalanceNum] = useState<string>('');
  
  // Search history
  const { history, savedSearches, addToHistory, removeHistoryItem, saveSearch, removeSavedSearch } = useSearchHistory();
  const [showHistory, setShowHistory] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Quick filters
  const [showQuickFilters, setShowQuickFilters] = useState(false);
  const [quickFilterOrigin, setQuickFilterOrigin] = useState<string | null>(null);
  const [quickFilterDestination, setQuickFilterDestination] = useState<string | null>(null);
  const [quickFilterProduct, setQuickFilterProduct] = useState<string | null>(null);
  const [quickFilterShippingLine, setQuickFilterShippingLine] = useState<string | null>(null);
  const [quickFilterValueRange, setQuickFilterValueRange] = useState<string | null>(null);
  const [quickFilterDateRange, setQuickFilterDateRange] = useState<string | null>(null);
  
  // New shipment wizard
  const [showNewShipmentWizard, setShowNewShipmentWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  
  // URL params for field highlighting (from Field Mapping Manager)
  const [searchParams] = useSearchParams();
  const highlightField = searchParams.get('highlight');
  const highlightStep = searchParams.get('step');
  
  // Auto-open wizard if highlight param is present
  useEffect(() => {
    if (highlightField) {
      setShowNewShipmentWizard(true);
      if (highlightStep) {
        setWizardStep(parseInt(highlightStep));
      }
    }
  }, [highlightField, highlightStep]);
  
  // Smart search hint dismissal
  const [showSmartSearchHint, setShowSmartSearchHint] = useState(true);
  
  // Auto-dismiss smart search hint after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSmartSearchHint(false);
    }, 8000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Fetch dynamic filter suggestions based on active filters
  const { data: filterSuggestions } = useFilterSuggestions({
    origin: quickFilterOrigin,
    destination: quickFilterDestination,
    product: quickFilterProduct,
    shippingLine: quickFilterShippingLine,
    valueRange: quickFilterValueRange,
    dateRange: quickFilterDateRange,
  });
  
  // Bulk selection and comparison
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Parse search query whenever it changes
  useEffect(() => {
    const parsed = parseSearch(rawSearch);
    setParsedSearch(parsed);
    setPage(1); // Reset to first page
    
    // Apply auto-sort if detected in query (e.g., "lowest price")
    if (parsed.sortBy) {
      setSortBy(parsed.sortBy as SortColumn);
    }
    if (parsed.sortDir) {
      setSortDir(parsed.sortDir);
    }
    
    // Add to search history if there's actual content
    if (rawSearch && rawSearch.trim().length > 0) {
      addToHistory(rawSearch);
      setShowHistory(false); // Hide history dropdown when searching
    }
  }, [rawSearch, addToHistory]);

  // Manual filters take precedence over smart search filters
  const effectiveValueOp = manualValueOp || parsedSearch.totalValue?.operator;
  const effectiveValue = manualValueNum ? parseFloat(manualValueNum) : parsedSearch.totalValue?.value;
  const effectiveContainerOp = manualContainerOp || parsedSearch.containerCount?.operator;
  const effectiveContainer = manualContainerNum ? parseFloat(manualContainerNum) : parsedSearch.containerCount?.value;
  const effectiveWeightOp = manualWeightOp || parsedSearch.weight?.operator;
  const effectiveWeight = manualWeightNum ? parseFloat(manualWeightNum) : parsedSearch.weight?.value;
  const effectiveBalanceOp = manualBalanceOp || parsedSearch.balance?.operator;
  const effectiveBalance = manualBalanceNum ? parseFloat(manualBalanceNum) : parsedSearch.balance?.value;

  // Combine parsed search filters with quick filters
  const effectivePol = parsedSearch.pol && parsedSearch.pol.length > 0 
    ? parsedSearch.pol.join(',') 
    : (quickFilterOrigin || undefined);
  const effectivePod = parsedSearch.pod && parsedSearch.pod.length > 0 
    ? parsedSearch.pod.join(',') 
    : (quickFilterDestination || undefined);
  const effectiveProduct = parsedSearch.products && parsedSearch.products.length > 0
    ? parsedSearch.products[0] // Use first product from parsed search
    : (quickFilterProduct || undefined);

  const { data, isLoading, error, refetch } = useShipments({
    page,
    limit: 20,
    search: parsedSearch.generalSearch || undefined,
    // Convert arrays to comma-separated strings for API
    pol: effectivePol,
    pod: effectivePod,
    product: effectiveProduct,
    excludeProduct: parsedSearch.excludeProducts && parsedSearch.excludeProducts.length > 0 ? parsedSearch.excludeProducts.join(',') : undefined,
    // Date filters - date range takes precedence over month/year
    etaFrom: parsedSearch.etaFrom || undefined,
    etaTo: parsedSearch.etaTo || undefined,
    etaMonth: (!parsedSearch.etaFrom && !parsedSearch.etaTo) ? (parsedSearch.month || undefined) : undefined,
    etaYear: (!parsedSearch.etaFrom && !parsedSearch.etaTo) ? (parsedSearch.year || undefined) : undefined,
    // Numeric filters - manual takes precedence
    totalValueOp: effectiveValueOp,
    totalValue: effectiveValue,
    containerCountOp: effectiveContainerOp,
    containerCount: effectiveContainer,
    weightOp: effectiveWeightOp,
    weight: effectiveWeight,
    balanceOp: effectiveBalanceOp,
    balance: effectiveBalance,
    status: statusFilter || undefined,
    sortBy: parsedSearch.sortBy || sortBy, // Smart search sort takes precedence
    sortDir: parsedSearch.sortDir || sortDir,
  });

  // Get user-configured column order
  const userColumns = getShipmentColumns();

  const handleRowClick = (id: string) => {
    navigate(`/shipments/${id}`);
  };

  const clearFilters = () => {
    setRawSearch('');
    setParsedSearch({});
    setStatusFilter('');
    setSortBy('eta');
    setSortDir('asc');
    setPage(1);
    // Clear manual filters
    setManualValueOp('');
    setManualValueNum('');
    setManualContainerOp('');
    setManualContainerNum('');
    setManualWeightOp('');
    setManualWeightNum('');
    setManualBalanceOp('');
    setManualBalanceNum('');
  };

  // Count active filters (including manual filters and arrays)
  const activeFiltersCount = [
    parsedSearch.generalSearch,
    parsedSearch.products && parsedSearch.products.length > 0,
    parsedSearch.pol && parsedSearch.pol.length > 0,
    parsedSearch.pod && parsedSearch.pod.length > 0,
    parsedSearch.excludeProducts && parsedSearch.excludeProducts.length > 0,
    effectiveValue ? true : false,
    effectiveContainer ? true : false,
    effectiveWeight ? true : false,
    effectiveBalance ? true : false,
    parsedSearch.etaFrom || parsedSearch.etaTo, // Date range
    (!parsedSearch.etaFrom && !parsedSearch.etaTo) && parsedSearch.month, // Single month (only if no date range)
    (!parsedSearch.etaFrom && !parsedSearch.etaTo) && parsedSearch.year, // Single year (only if no date range)
    statusFilter,
  ].filter(Boolean).length;

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      // Toggle direction if same column
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1); // Reset to first page
  };

  // Sort icon component for column headers
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) {
      return <ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />;
    }
    return sortDir === 'asc' 
      ? <ChevronUpIcon className="h-4 w-4 text-primary-600" />
      : <ChevronDownIcon className="h-4 w-4 text-primary-600" />;
  };

  // Column rendering configuration - maps column keys to render functions
  const columnRenderers: Record<string, { header: () => JSX.Element; cell: (shipment: any) => JSX.Element }> = {
    sn: {
      header: () => (
        <th
          key="sn"
          onClick={() => handleSort('sn')}
          className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
        >
          <div className="flex items-center gap-2">
            {t('shipments.sn')}
            <SortIcon column="sn" />
          </div>
        </th>
      ),
      cell: (shipment: any) => (
        <td
          key="sn"
          onClick={() => handleRowClick(shipment.id)}
          className="px-3 py-3 whitespace-nowrap text-sm font-medium text-primary-600 cursor-pointer"
        >
          {shipment.sn || '—'}
        </td>
      ),
    },
    product: {
      header: () => (
        <th
          key="product"
          onClick={() => handleSort('product_text')}
          className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
        >
          <div className="flex items-center gap-2">
            {t('shipments.product')}
            <SortIcon column="product_text" />
          </div>
        </th>
      ),
      cell: (shipment: any) => (
        <td key="product" className="px-4 py-3 text-sm text-gray-900 max-w-xs">
          <TruncatedText text={shipment.product_text} maxWidth="200px">
            <TranslatedProductText text={shipment.product_text} />
          </TruncatedText>
        </td>
      ),
    },
    price_per_ton: {
      header: () => (
        <th key="price_per_ton" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {i18n.language === 'ar' ? 'السعر الحقيقي' : 'Real Price'}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="price_per_ton" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-end">
          {shipment.fixed_price_usd_per_ton ? formatCurrency(shipment.fixed_price_usd_per_ton) : '—'}
        </td>
      ),
    },
    origin: {
      header: () => (
        <th key="origin" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {i18n.language === 'ar' ? 'بلد المنشأ' : 'Country of Origin'}
        </th>
      ),
      cell: (shipment: any) => {
        // Get country of origin from the first product line, or fall back to country_of_export
        const countryOfOrigin = shipment.lines?.[0]?.country_of_origin || shipment.country_of_export || '—';
        return (
          <td key="origin" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
            {countryOfOrigin}
          </td>
        );
      },
    },
    pol: {
      header: () => (
        <th key="pol" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {t('shipments.pol', 'POL')}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="pol" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {shipment.pol_name || '—'}
        </td>
      ),
    },
    pod: {
      header: () => (
        <th key="pod" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {t('shipments.destination')}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="pod" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {shipment.pod_name || '—'}
        </td>
      ),
    },
    status: {
      header: () => (
        <th
          key="status"
          onClick={() => handleSort('status')}
          className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
        >
          <div className="flex items-center gap-2">
            {t('shipments.status')}
            <SortIcon column="status" />
          </div>
        </th>
      ),
      cell: (shipment: any) => (
        <td key="status" className="px-4 py-3 whitespace-nowrap">
          <Badge color={getStatusColor(shipment.status) as any}>
            {i18n.language === 'ar' ? statusToArabic(shipment.status) : shipment.status}
          </Badge>
        </td>
      ),
    },
    total_price: {
      header: () => (
        <th
          key="total_price"
          onClick={() => handleSort('total_value_usd')}
          className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
        >
          <div className="flex items-center gap-2">
            {i18n.language === 'ar' ? 'الإجمالي' : 'Total'}
            <SortIcon column="total_value_usd" />
          </div>
        </th>
      ),
      cell: (shipment: any) => (
        <td key="total_price" className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-end">
          {shipment.total_value_usd ? formatCurrency(shipment.total_value_usd) : '—'}
        </td>
      ),
    },
    price_on_paper: {
      header: () => (
        <th key="price_on_paper" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {i18n.language === 'ar' ? 'السعر الورقي' : 'Price on Paper'}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="price_on_paper" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-end">
          {shipment.price_on_paper_usd ? (
            <div>
              <div>{formatCurrency(shipment.price_on_paper_usd)}</div>
              {shipment.price_on_paper_try && (
                <div className="text-xs text-gray-500">₺{formatNumber(shipment.price_on_paper_try)}</div>
              )}
            </div>
          ) : '—'}
        </td>
      ),
    },
    tax: {
      header: () => (
        <th key="tax" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {i18n.language === 'ar' ? 'الضريبة' : 'Tax'}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="tax" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-end">
          {shipment.tax_usd ? (
            <div>
              <div>{formatCurrency(shipment.tax_usd)}</div>
              {shipment.tax_try && (
                <div className="text-xs text-gray-500">₺{formatNumber(shipment.tax_try)}</div>
              )}
            </div>
          ) : '—'}
        </td>
      ),
    },
    eta: {
      header: () => (
        <th
          key="eta"
          onClick={() => handleSort('eta')}
          className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
        >
          <div className="flex items-center gap-2">
            {t('shipments.eta')}
            <SortIcon column="eta" />
          </div>
        </th>
      ),
      cell: (shipment: any) => (
        <td key="eta" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {formatDateString(shipment.eta)}
        </td>
      ),
    },
    etd: {
      header: () => (
        <th
          key="etd"
          onClick={() => handleSort('etd')}
          className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
        >
          <div className="flex items-center gap-2">
            {t('shipments.etd', 'ETD')}
            <SortIcon column="etd" />
          </div>
        </th>
      ),
      cell: (shipment: any) => (
        <td key="etd" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {formatDateString(shipment.etd)}
        </td>
      ),
    },
    supplier: {
      header: () => (
        <th key="supplier" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {t('shipments.supplier', 'Supplier')}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="supplier" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {shipment.supplier_name || '—'}
        </td>
      ),
    },
    customer: {
      header: () => (
        <th key="customer" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {t('shipments.customer', 'Customer')}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="customer" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {shipment.customer_name || '—'}
        </td>
      ),
    },
    container_count: {
      header: () => (
        <th
          key="container_count"
          onClick={() => handleSort('container_count')}
          className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
        >
          <div className="flex items-center gap-2">
            {t('shipments.containers', 'Containers')}
            <SortIcon column="container_count" />
          </div>
        </th>
      ),
      cell: (shipment: any) => (
        <td key="container_count" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-end">
          {shipment.container_count || '—'}
        </td>
      ),
    },
    weight: {
      header: () => (
        <th
          key="weight"
          onClick={() => handleSort('weight_ton')}
          className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
        >
          <div className="flex items-center gap-2">
            {t('shipments.weight')}
            <SortIcon column="weight_ton" />
          </div>
        </th>
      ),
      cell: (shipment: any) => (
        <td key="weight" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-end">
          {shipment.weight_ton ? formatNumber(shipment.weight_ton) : '—'}
        </td>
      ),
    },
    bl_no: {
      header: () => (
        <th key="bl_no" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {t('shipments.blNo', 'BL No.')}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="bl_no" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {shipment.bl_no || '—'}
        </td>
      ),
    },
    vessel: {
      header: () => (
        <th key="vessel" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {t('shipments.vessel', 'Vessel')}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="vessel" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {shipment.vessel_name || '—'}
        </td>
      ),
    },
    final_destination: {
      header: () => (
        <th key="final_destination" className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          {t('shipments.finalDestination', 'Final Destination')}
        </th>
      ),
      cell: (shipment: any) => (
        <td key="final_destination" className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
          {shipment.final_destination?.branch_name || shipment.final_destination?.customer_name || '—'}
        </td>
      ),
    },
  };

  // Filter to only include columns that have renderers
  const activeColumns = userColumns.filter(col => columnRenderers[col]);

  // Export to Excel (CSV format)
  const handleExport = () => {
    if (!data || !data.data || data.data.length === 0) {
      return;
    }

    // Define CSV headers
    const headers = [
      'Shipment ID', 'Contract', 'Status', 'Product', 'Weight (tons)',
      'Price/Ton ($)', 'Total Amount ($)', 'POL', 'POD', 'ETA', 'Clearance Date', 'Delivery Delay'
    ];

    // Convert data to CSV rows
    const rows = data.data.map(shipment => [
      shipment.sn || '',
      shipment.contract_no || '',
      shipment.status || '',
      shipment.product_text || '',
      shipment.weight_ton || '',
      shipment.fixed_price_usd_per_ton || '',
      shipment.total_value_usd || '',
      shipment.pol_name || '',
      shipment.pod_name || '',
      shipment.eta ? formatDateString(shipment.eta) : '',
      shipment.customs_clearance_date ? formatDateString(shipment.customs_clearance_date) : '',
      shipment.status || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shipments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk action handlers
  const handleSelectAll = () => {
    if (!data || !data.data) return;
    const allIds = new Set(data.data.map(s => s.id));
    setSelectedShipments(allIds);
  };

  const handleClearSelection = () => {
    setSelectedShipments(new Set());
  };

  const handleToggleSelection = (id: string) => {
    const newSelection = new Set(selectedShipments);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedShipments(newSelection);
  };

  const handleBulkExport = () => {
    if (!data || !data.data || selectedShipments.size === 0) return;
    
    const selectedData = data.data.filter(s => selectedShipments.has(s.id));
    const headers = [
      'Shipment ID', 'Contract', 'Status', 'Product', 'Weight (tons)',
      'Price/Ton ($)', 'Total Amount ($)', 'POL', 'POD', 'ETA', 'Clearance Date', 'Delivery Delay'
    ];
    
    const rows = selectedData.map(shipment => [
      shipment.sn || '',
      shipment.contract_no || '',
      shipment.status || '',
      shipment.product_text || '',
      shipment.weight_ton || '',
      shipment.fixed_price_usd_per_ton || '',
      shipment.total_value_usd || '',
      shipment.pol_name || '',
      shipment.pod_name || '',
      shipment.eta ? formatDateString(shipment.eta) : '',
      shipment.customs_clearance_date ? formatDateString(shipment.customs_clearance_date) : '',
      shipment.status || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `selected_shipments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkChangeStatus = (status: string) => {
    // TODO: Implement bulk status change API call
    console.log('Change status for:', Array.from(selectedShipments), 'to:', status);
    alert(`Status change to "${status}" for ${selectedShipments.size} shipments would be implemented here`);
  };

  const handleBulkMarkAsDelivered = () => {
    // TODO: Implement bulk mark as delivered API call
    console.log('Mark as delivered:', Array.from(selectedShipments));
    alert(`Marking ${selectedShipments.size} shipments as delivered would be implemented here`);
  };

  const handleBulkDelete = async () => {
    const count = selectedShipments.size;
    if (!confirm(`Are you sure you want to delete ${count} shipment(s)? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const ids = Array.from(selectedShipments);
      const result = await bulkDeleteShipments(ids);
      
      // Clear selection and refresh the list
      setSelectedShipments(new Set());
      refetch();
      
      alert(`✅ ${result.count} shipment(s) deleted successfully`);
    } catch (error: any) {
      console.error('Failed to delete shipments:', error);
      alert(`❌ Failed to delete shipments: ${error.message || 'Unknown error'}`);
    }
  };

  const handleCompare = () => {
    if (selectedShipments.size < 2 || selectedShipments.size > 5) {
      alert('Please select 2-5 shipments to compare');
      return;
    }
    setShowComparisonModal(true);
  };

  const handleQuickFilterChange = (
    type: 'origin' | 'destination' | 'product' | 'shippingLine' | 'valueRange' | 'dateRange',
    value: string | null
  ) => {
    setPage(1);
    switch (type) {
      case 'origin':
        setQuickFilterOrigin(value);
        break;
      case 'destination':
        setQuickFilterDestination(value);
        break;
      case 'product':
        setQuickFilterProduct(value);
        break;
      case 'shippingLine':
        setQuickFilterShippingLine(value);
        break;
      case 'valueRange':
        setQuickFilterValueRange(value);
        // Parse value range and set manual filters
        if (value) {
          if (value.startsWith('<')) {
            setManualValueOp('<');
            setManualValueNum(value.substring(1));
          } else if (value.startsWith('>')) {
            setManualValueOp('>');
            setManualValueNum(value.substring(1));
          } else if (value.includes('-')) {
            const [min] = value.split('-');
            setManualValueOp('>=');
            setManualValueNum(min);
            // Note: This only sets the min value; a proper implementation would need range support
          }
        } else {
          setManualValueOp('');
          setManualValueNum('');
        }
        break;
      case 'dateRange':
        setQuickFilterDateRange(value);
        // Set search query to trigger smart date parsing
        if (value) {
          setRawSearch(value);
        }
        break;
    }
  };

  // Handle preset sort options
  const handleSortPreset = (preset: string) => {
    setPage(1);
    switch (preset) {
      case 'newest':
        setSortBy('created_at');
        setSortDir('desc');
        break;
      case 'oldest':
        setSortBy('created_at');
        setSortDir('asc');
        break;
      case 'recently_updated':
        setSortBy('updated_at');
        setSortDir('desc');
        break;
      case 'etd_soonest':
        setSortBy('etd');
        setSortDir('asc');
        break;
      case 'etd_latest':
        setSortBy('etd');
        setSortDir('desc');
        break;
      case 'eta_soonest':
        setSortBy('eta');
        setSortDir('asc');
        break;
      case 'eta_latest':
        setSortBy('eta');
        setSortDir('desc');
        break;
      case 'value_high':
        setSortBy('total_value_usd');
        setSortDir('desc');
        break;
      case 'value_low':
        setSortBy('total_value_usd');
        setSortDir('asc');
        break;
      case 'weight_high':
        setSortBy('weight_ton');
        setSortDir('desc');
        break;
      case 'weight_low':
        setSortBy('weight_ton');
        setSortDir('asc');
        break;
      case 'product_az':
        setSortBy('product_text');
        setSortDir('asc');
        break;
      case 'product_za':
        setSortBy('product_text');
        setSortDir('desc');
        break;
      case 'contract_az':
        setSortBy('sn');
        setSortDir('asc');
        break;
      case 'balance_high':
        setSortBy('balance_value_usd');
        setSortDir('desc');
        break;
    }
  };

  // Get current sort preset value
  const getSortPresetValue = () => {
    const sortKey = `${sortBy}_${sortDir}`;
    const presetMap: Record<string, string> = {
      'created_at_desc': 'newest',
      'created_at_asc': 'oldest',
      'updated_at_desc': 'recently_updated',
      'etd_asc': 'etd_soonest',
      'etd_desc': 'etd_latest',
      'eta_asc': 'eta_soonest',
      'eta_desc': 'eta_latest',
      'total_value_usd_desc': 'value_high',
      'total_value_usd_asc': 'value_low',
      'weight_ton_desc': 'weight_high',
      'weight_ton_asc': 'weight_low',
      'product_text_asc': 'product_az',
      'product_text_desc': 'product_za',
      'sn_asc': 'contract_az',
      'balance_value_usd_desc': 'balance_high',
    };
    return presetMap[sortKey] || 'newest';
  };

  // Quick status categories
  const statusCategories = [
    { value: '', label: i18n.language === 'ar' ? 'الكل' : 'All', count: data?.pagination.total || 0 },
    { value: 'planning', label: statusToArabic('planning') },
    { value: 'booked', label: statusToArabic('booked') },
    { value: 'sailed', label: statusToArabic('sailed') },
    { value: 'arrived', label: statusToArabic('arrived') },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('shipments.title')}</h1>
            {data?.pagination && (
              <p className="mt-1 text-sm text-gray-500">
                {i18n.language === 'ar' ? 'إجمالي' : 'Total'}: {formatNumber(data.pagination.total)} {i18n.language === 'ar' ? 'شحنة' : 'shipments'}
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-shrink-0 flex-wrap">
            {/* New Shipment Button */}
            <button
              onClick={() => setShowNewShipmentWizard(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="w-5 h-5 me-2" />
              {t('shipments.newShipment', 'New Shipment')}
            </button>

            {/* Quick Filters Dropdown Button */}
            <div className="relative">
              <Button
                variant="secondary"
                onClick={() => setShowQuickFilters(!showQuickFilters)}
              >
                <SparklesIcon className="w-5 h-5 me-2" />
                {i18n.language === 'ar' ? 'تصفية سريعة' : 'Quick Filters'}
                {(quickFilterOrigin || quickFilterDestination || quickFilterProduct || quickFilterShippingLine || quickFilterValueRange || quickFilterDateRange) && (
                  <span className="ms-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary-600 rounded-full">
                    {[quickFilterOrigin, quickFilterDestination, quickFilterProduct, quickFilterShippingLine, quickFilterValueRange, quickFilterDateRange].filter(Boolean).length}
                  </span>
                )}
              </Button>
              
              {/* Quick Filters Dropdown Panel */}
              {showQuickFilters && filterSuggestions && (
                <div className="absolute start-0 mt-2 w-[800px] bg-white border border-gray-200 rounded-lg shadow-2xl z-50 p-6 max-h-[600px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {i18n.language === 'ar' ? 'تصفية سريعة' : 'Quick Filters'}
                    </h3>
                    <button
                      onClick={() => setShowQuickFilters(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <QuickFiltersPanel
                    suggestions={filterSuggestions}
                    onFilterChange={(type, value) => {
                      handleQuickFilterChange(type, value);
                    }}
                    activeFilters={{
                      origin: quickFilterOrigin,
                      destination: quickFilterDestination,
                      product: quickFilterProduct,
                      shippingLine: quickFilterShippingLine,
                      valueRange: quickFilterValueRange,
                      dateRange: quickFilterDateRange,
                    }}
                  />
                  
                  <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setQuickFilterOrigin(null);
                        setQuickFilterDestination(null);
                        setQuickFilterProduct(null);
                        setQuickFilterShippingLine(null);
                        setQuickFilterValueRange(null);
                        setQuickFilterDateRange(null);
                      }}
                    >
                      {i18n.language === 'ar' ? 'مسح الكل' : 'Clear All'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowQuickFilters(false)}
                    >
                      {i18n.language === 'ar' ? 'تطبيق' : 'Apply'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FunnelIcon className="w-5 h-5 me-2" />
              {t('shipments.filter')}
              {activeFiltersCount > 0 && (
                <span className="ms-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary-600 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            <Button
              variant="primary"
              onClick={handleExport}
              disabled={!data || !data.data || data.data.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg"
            >
              <ArrowDownTrayIcon className="w-5 h-5 me-2" />
              {i18n.language === 'ar' ? 'تصدير إلى Excel' : 'Export to Excel'}
            </Button>
          </div>
        </div>

        {/* Quick Status Categories */}
        <div className="flex flex-wrap gap-2">
          {statusCategories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {
                setStatusFilter(cat.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === cat.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown - Positioned between status bar and search */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <ArrowsUpDownIcon className="w-5 h-5 text-gray-500" />
            {t('shipments.sortBy', 'Sort By')}:
          </label>
          <select
            value={getSortPresetValue()}
            onChange={(e) => handleSortPreset(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer appearance-none min-w-[240px]"
            style={{ 
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: `${i18n.language === 'ar' ? 'left 0.5rem' : 'right 0.5rem'} center`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
              paddingRight: i18n.language === 'ar' ? '0.75rem' : '2.5rem',
              paddingLeft: i18n.language === 'ar' ? '2.5rem' : '0.75rem',
            }}
          >
            <optgroup label={t('shipments.sort.dateCreated', 'Date Created')}>
              <option value="newest">🆕 {t('shipments.sort.newestFirst', 'Newest First')}</option>
              <option value="oldest">📅 {t('shipments.sort.oldestFirst', 'Oldest First')}</option>
              <option value="recently_updated">🔄 {t('shipments.sort.recentlyUpdated', 'Recently Updated')}</option>
            </optgroup>
            <optgroup label={t('shipments.sort.shippingDates', 'Shipping Dates')}>
              <option value="etd_soonest">🚢 {t('shipments.sort.etdSoonest', 'ETD - Soonest')}</option>
              <option value="etd_latest">📆 {t('shipments.sort.etdLatest', 'ETD - Latest')}</option>
              <option value="eta_soonest">🛬 {t('shipments.sort.etaSoonest', 'ETA - Soonest')}</option>
              <option value="eta_latest">📍 {t('shipments.sort.etaLatest', 'ETA - Latest')}</option>
            </optgroup>
            <optgroup label={t('shipments.sort.value', 'Value')}>
              <option value="value_high">💰 {t('shipments.sort.valueHighest', 'Highest Value')}</option>
              <option value="value_low">💵 {t('shipments.sort.valueLowest', 'Lowest Value')}</option>
              <option value="balance_high">⚠️ {t('shipments.sort.balanceHighest', 'Highest Balance')}</option>
            </optgroup>
            <optgroup label={t('shipments.sort.quantity', 'Quantity')}>
              <option value="weight_high">⚖️ {t('shipments.sort.weightHeaviest', 'Heaviest')}</option>
              <option value="weight_low">📦 {t('shipments.sort.weightLightest', 'Lightest')}</option>
            </optgroup>
            <optgroup label={t('shipments.sort.other', 'Other')}>
              <option value="product_az">🔤 {t('shipments.sort.productAZ', 'Product A-Z')}</option>
              <option value="product_za">🔡 {t('shipments.sort.productZA', 'Product Z-A')}</option>
              <option value="contract_az">📋 {t('shipments.sort.contractAZ', 'Contract Number A-Z')}</option>
            </optgroup>
          </select>
        </div>

        {/* Active Filters Tags - Show parsed search components */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <SparklesIcon className="w-4 h-4 text-primary-600" />
              {i18n.language === 'ar' ? 'البحث الذكي:' : 'Smart Search:'}
            </span>
            {parsedSearch.generalSearch && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                {parsedSearch.generalSearch}
                <button onClick={() => setRawSearch('')} className="hover:text-primary-900">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </span>
            )}
            
            {/* Multiple Products */}
            {parsedSearch.products && parsedSearch.products.length > 0 && parsedSearch.products.map((product, idx) => (
              <span key={`product-${idx}`} className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                {product}
              </span>
            ))}
            
            {/* Multiple Origins (POL) */}
            {parsedSearch.pol && parsedSearch.pol.length > 0 && parsedSearch.pol.map((origin, idx) => (
              <span key={`pol-${idx}`} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                {i18n.language === 'ar' ? 'من' : 'From'}: {origin}
              </span>
            ))}
            
            {/* Multiple Destinations (POD) */}
            {parsedSearch.pod && parsedSearch.pod.length > 0 && parsedSearch.pod.map((destination, idx) => (
              <span key={`pod-${idx}`} className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                {i18n.language === 'ar' ? 'إلى' : 'To'}: {destination}
              </span>
            ))}
            
            {/* Excluded Products */}
            {parsedSearch.excludeProducts && parsedSearch.excludeProducts.length > 0 && parsedSearch.excludeProducts.map((product, idx) => (
              <span key={`exclude-${idx}`} className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                {i18n.language === 'ar' ? 'عدا' : 'Except'}: {product}
              </span>
            ))}
            
            {/* Date Range Filter */}
            {(parsedSearch.etaFrom || parsedSearch.etaTo) && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                {i18n.language === 'ar' ? 'التاريخ' : 'Date'}: {parsedSearch.etaFrom ? formatDateString(parsedSearch.etaFrom) : '—'} {parsedSearch.etaTo ? ` - ${formatDateString(parsedSearch.etaTo)}` : ''}
              </span>
            )}
            
            {/* Single Month/Year (only shown if no date range) */}
            {!parsedSearch.etaFrom && !parsedSearch.etaTo && parsedSearch.month && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                {i18n.language === 'ar' ? 'شهر' : 'Month'}: {parsedSearch.month}
              </span>
            )}
            {!parsedSearch.etaFrom && !parsedSearch.etaTo && parsedSearch.year && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                {parsedSearch.year}
              </span>
            )}
            {parsedSearch.totalValue && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                {i18n.language === 'ar' ? 'القيمة' : 'Value'}: {parsedSearch.totalValue.operator} ${formatNumber(parsedSearch.totalValue.value)}
              </span>
            )}
            {parsedSearch.containerCount && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
                {i18n.language === 'ar' ? 'حاويات' : 'Containers'}: {parsedSearch.containerCount.operator} {parsedSearch.containerCount.value}
              </span>
            )}
            {parsedSearch.weight && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                {i18n.language === 'ar' ? 'الوزن' : 'Weight'}: {parsedSearch.weight.operator} {parsedSearch.weight.value} {i18n.language === 'ar' ? 'طن' : 'tons'}
              </span>
            )}
            {parsedSearch.balance && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                {i18n.language === 'ar' ? 'الرصيد' : 'Balance'}: {parsedSearch.balance.operator} ${formatNumber(parsedSearch.balance.value)}
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              {t('shipments.clearFilters')}
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <Card>
          <div className="space-y-4">
            {/* Smart Search - Always visible */}
            <div className="relative">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <SparklesIcon className="absolute start-10 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-600" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={rawSearch}
                  onChange={(e) => setRawSearch(e.target.value)}
                  onFocus={() => {
                    setShowHistory(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowHistory(false);
                    }, 200);
                  }}
                  placeholder={i18n.language === 'ar' 
                    ? '🔍 بحث ذكي - جرب: "بهار من مصر إلى العراق" أو "rice from India November 2025"' 
                    : '🔍 Smart Search - Try: "spices from Egypt to Iraq" or "رز من الهند نوفمبر 2025"'}
                  className="w-full ps-16 pe-24 py-3 border-2 border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                />
                {rawSearch && activeFiltersCount > 0 && (
                  <button
                    onClick={() => setShowSaveDialog(true)}
                    className="absolute end-12 top-1/2 -translate-y-1/2 text-primary-600 hover:text-primary-700"
                    title={i18n.language === 'ar' ? 'حفظ البحث' : 'Save Search'}
                  >
                    <BookmarkIcon className="w-5 h-5" />
                  </button>
                )}
                {rawSearch && (
                  <button
                    onClick={() => setRawSearch('')}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Search History & Examples Dropdown */}
              {showHistory && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
                  {/* Saved Searches */}
                  {savedSearches.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                          <BookmarkIcon className="w-3 h-3" />
                          {i18n.language === 'ar' ? 'عمليات بحث محفوظة' : 'Saved Searches'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {savedSearches.map((saved) => (
                          <div key={saved.id} className="flex items-center gap-2 group">
                            <button
                              onClick={() => {
                                setRawSearch(saved.query);
                                setShowHistory(false);
                              }}
                              className="flex-1 text-start px-3 py-2 text-sm text-gray-700 hover:bg-primary-50 rounded-md transition-colors"
                            >
                              <div className="font-medium text-primary-700">{saved.name}</div>
                              <div className="text-xs text-gray-500 truncate">{saved.query}</div>
                            </button>
                            <button
                              onClick={() => removeSavedSearch(saved.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 transition-opacity"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent History */}
                  {history.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {i18n.language === 'ar' ? 'عمليات بحث سابقة' : 'Recent Searches'}
                      </div>
                      <div className="space-y-1">
                        {history.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 group">
                            <button
                              onClick={() => {
                                setRawSearch(item.query);
                                setShowHistory(false);
                              }}
                              className="flex-1 text-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors truncate"
                            >
                              {item.query}
                            </button>
                            <button
                              onClick={() => removeHistoryItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Examples */}
                  {!rawSearch && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        {i18n.language === 'ar' ? 'أمثلة للبحث الذكي:' : 'Smart Search Examples:'}
                      </div>
                      <div className="space-y-1">
                        {getSearchExamples(i18n.language as 'ar' | 'en').map((example, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setRawSearch(example);
                              setShowHistory(false);
                            }}
                            className="w-full text-start px-3 py-2 text-sm text-gray-700 hover:bg-primary-50 rounded-md transition-colors"
                          >
                            <SparklesIcon className="w-3 h-3 inline me-2 text-primary-600" />
                            {example}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                        {i18n.language === 'ar' 
                          ? '💡 يمكنك البحث بالعربي أو English - النظام يفهم كلاهما!' 
                          : '💡 You can search in Arabic or English - the system understands both!'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Save Search Dialog */}
              {showSaveDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSaveDialog(false)}>
                  <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-bold mb-4">
                      {i18n.language === 'ar' ? 'حفظ عملية البحث' : 'Save Search'}
                    </h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {i18n.language === 'ar' ? 'اسم البحث' : 'Search Name'}
                      </label>
                      <input
                        type="text"
                        value={saveSearchName}
                        onChange={(e) => setSaveSearchName(e.target.value)}
                        placeholder={i18n.language === 'ar' ? 'مثال: شحنات مصر للعراق' : 'Example: Egypt to Iraq Shipments'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        autoFocus
                      />
                    </div>
                    <div className="mb-4 p-3 bg-gray-50 rounded-md">
                      <div className="text-xs text-gray-500 mb-1">
                        {i18n.language === 'ar' ? 'البحث:' : 'Query:'}
                      </div>
                      <div className="text-sm text-gray-700 font-mono break-all">
                        {rawSearch}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowSaveDialog(false);
                          setSaveSearchName('');
                        }}
                        className="flex-1"
                      >
                        {i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => {
                          if (saveSearchName.trim()) {
                            saveSearch(rawSearch, saveSearchName);
                            setShowSaveDialog(false);
                            setSaveSearchName('');
                          }
                        }}
                        className="flex-1"
                        disabled={!saveSearchName.trim()}
                      >
                        {i18n.language === 'ar' ? 'حفظ' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Filters - Collapsible */}
            {showFilters && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    {i18n.language === 'ar' ? 'تصفية متقدمة' : 'Advanced Filters'}
                  </h3>
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    {t('shipments.clearFilters')}
                  </Button>
                </div>
                
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <SparklesIcon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-primary-900 mb-1">
                        {i18n.language === 'ar' ? 'استخدم البحث الذكي!' : 'Use Smart Search!'}
                      </h4>
                      <p className="text-xs text-primary-700">
                        {i18n.language === 'ar' 
                          ? 'اكتب استعلامك بشكل طبيعي مثل: "بهار من مصر إلى العراق" - النظام يفهم العربية والإنجليزية!' 
                          : 'Type your query naturally like: "spices from Egypt to Iraq" - the system understands Arabic and English!'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('shipments.status')}
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">{t('common.all')}</option>
                      <option value="planning">{statusToArabic('planning')}</option>
                      <option value="booked">{statusToArabic('booked')}</option>
                      <option value="sailed">{statusToArabic('sailed')}</option>
                      <option value="arrived">{statusToArabic('arrived')}</option>
                      <option value="delivered">{statusToArabic('delivered')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {i18n.language === 'ar' ? 'ترتيب حسب' : 'Sort By'}
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value as SortColumn);
                        setPage(1);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="eta">{t('shipments.eta')}</option>
                      <option value="sn">{t('shipments.sn')}</option>
                      <option value="product_text">{t('shipments.product')}</option>
                      <option value="total_value_usd">{t('shipments.totalValue')}</option>
                      <option value="weight_ton">{t('shipments.weight')}</option>
                      <option value="created_at">{i18n.language === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {i18n.language === 'ar' ? 'الاتجاه' : 'Direction'}
                    </label>
                    <select
                      value={sortDir}
                      onChange={(e) => {
                        setSortDir(e.target.value as 'asc' | 'desc');
                        setPage(1);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="asc">{i18n.language === 'ar' ? 'تصاعدي' : 'Ascending'}</option>
                      <option value="desc">{i18n.language === 'ar' ? 'تنازلي' : 'Descending'}</option>
                    </select>
                  </div>
                </div>

                {/* Manual Numeric Filters */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-4">
                    {i18n.language === 'ar' ? 'تصفية رقمية يدوية' : 'Manual Numeric Filters'}
                    <span className="ms-2 text-xs font-normal text-gray-500">
                      {i18n.language === 'ar' ? '(بديل للبحث الذكي)' : '(Alternative to smart search)'}
                    </span>
                  </h4>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Total Value Filter */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {i18n.language === 'ar' ? 'القيمة الإجمالية ($)' : 'Total Value ($)'}
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={manualValueOp}
                            onChange={(e) => {
                              setManualValueOp(e.target.value);
                              setPage(1);
                            }}
                            className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm min-w-[100px]"
                          >
                            <option value="">{i18n.language === 'ar' ? 'أي' : 'Any'}</option>
                            <option value="<">{i18n.language === 'ar' ? 'أقل من' : 'Less than'}</option>
                            <option value=">">{i18n.language === 'ar' ? 'أكثر من' : 'Greater than'}</option>
                            <option value="<=">{i18n.language === 'ar' ? 'أقل من أو يساوي' : 'Less or equal'}</option>
                            <option value=">=">{i18n.language === 'ar' ? 'أكثر من أو يساوي' : 'Greater or equal'}</option>
                            <option value="=">{i18n.language === 'ar' ? 'يساوي' : 'Equals'}</option>
                          </select>
                          <input
                            type="number"
                            value={manualValueNum}
                            onChange={(e) => {
                              setManualValueNum(e.target.value);
                              setPage(1);
                            }}
                            placeholder={i18n.language === 'ar' ? 'أدخل المبلغ' : 'Enter amount'}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cargo Units Filter */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {i18n.language === 'ar' ? 'عدد الوحدات' : 'Cargo Units'}
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={manualContainerOp}
                            onChange={(e) => {
                              setManualContainerOp(e.target.value);
                              setPage(1);
                            }}
                            className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm min-w-[100px]"
                          >
                            <option value="">{i18n.language === 'ar' ? 'أي' : 'Any'}</option>
                            <option value="<">{i18n.language === 'ar' ? 'أقل من' : 'Less than'}</option>
                            <option value=">">{i18n.language === 'ar' ? 'أكثر من' : 'Greater than'}</option>
                            <option value="<=">{i18n.language === 'ar' ? 'أقل من أو يساوي' : 'Less or equal'}</option>
                            <option value=">=">{i18n.language === 'ar' ? 'أكثر من أو يساوي' : 'Greater or equal'}</option>
                            <option value="=">{i18n.language === 'ar' ? 'يساوي' : 'Equals'}</option>
                          </select>
                          <input
                            type="number"
                            value={manualContainerNum}
                            onChange={(e) => {
                              setManualContainerNum(e.target.value);
                              setPage(1);
                            }}
                            placeholder={i18n.language === 'ar' ? 'أدخل العدد' : 'Enter count'}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Weight Filter */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {i18n.language === 'ar' ? 'الوزن (طن)' : 'Weight (tons)'}
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={manualWeightOp}
                            onChange={(e) => {
                              setManualWeightOp(e.target.value);
                              setPage(1);
                            }}
                            className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-[100px]"
                          >
                            <option value="">{i18n.language === 'ar' ? 'أي' : 'Any'}</option>
                            <option value="<">{i18n.language === 'ar' ? 'أقل من' : 'Less than'}</option>
                            <option value=">">{i18n.language === 'ar' ? 'أكثر من' : 'Greater than'}</option>
                            <option value="<=">{i18n.language === 'ar' ? 'أقل من أو يساوي' : 'Less or equal'}</option>
                            <option value=">=">{i18n.language === 'ar' ? 'أكثر من أو يساوي' : 'Greater or equal'}</option>
                            <option value="=">{i18n.language === 'ar' ? 'يساوي' : 'Equals'}</option>
                          </select>
                          <input
                            type="number"
                            value={manualWeightNum}
                            onChange={(e) => {
                              setManualWeightNum(e.target.value);
                              setPage(1);
                            }}
                            placeholder={i18n.language === 'ar' ? 'أدخل الوزن' : 'Enter weight'}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Balance Filter */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {i18n.language === 'ar' ? 'الرصيد المتبقي ($)' : 'Balance Remaining ($)'}
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={manualBalanceOp}
                            onChange={(e) => {
                              setManualBalanceOp(e.target.value);
                              setPage(1);
                            }}
                            className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm min-w-[100px]"
                          >
                            <option value="">{i18n.language === 'ar' ? 'أي' : 'Any'}</option>
                            <option value="<">{i18n.language === 'ar' ? 'أقل من' : 'Less than'}</option>
                            <option value=">">{i18n.language === 'ar' ? 'أكثر من' : 'Greater than'}</option>
                            <option value="<=">{i18n.language === 'ar' ? 'أقل من أو يساوي' : 'Less or equal'}</option>
                            <option value=">=">{i18n.language === 'ar' ? 'أكثر من أو يساوي' : 'Greater or equal'}</option>
                            <option value="=">{i18n.language === 'ar' ? 'يساوي' : 'Equals'}</option>
                          </select>
                          <input
                            type="number"
                            value={manualBalanceNum}
                            onChange={(e) => {
                              setManualBalanceNum(e.target.value);
                              setPage(1);
                            }}
                            placeholder={i18n.language === 'ar' ? 'أدخل المبلغ' : 'Enter amount'}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="mt-3 text-xs text-gray-500">
                    {i18n.language === 'ar' 
                      ? '💡 التصفية اليدوية لها الأولوية على البحث الذكي إذا تم تعيين كليهما' 
                      : '💡 Manual filters take precedence over smart search if both are set'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Table */}
        <Card>
          {/* Smart Search Hint - Auto-dismisses after 8 seconds */}
          {showSmartSearchHint && (
            <div className="mb-4 px-4 py-3 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg relative animate-fade-in">
              <button
                onClick={() => setShowSmartSearchHint(false)}
                className="absolute top-2 end-2 text-gray-400 hover:text-gray-600 transition-colors"
                title={i18n.language === 'ar' ? 'إخفاء' : 'Dismiss'}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            <div className="flex items-center gap-2 mb-1">
              <SparklesIcon className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-semibold text-primary-900">
                {i18n.language === 'ar' ? 'بحث ذكي يفهم العربية والإنجليزية!' : 'Smart Search understands Arabic & English!'}
              </span>
            </div>
              <p className="text-xs text-gray-700 pe-6">
              {i18n.language === 'ar' 
                ? 'جرب: "بهار من مصر إلى العراق" أو "rice from India November" - النظام يستخرج المنتج والأصل والوجهة والتاريخ تلقائياً' 
                : 'Try: "spices from Egypt to Iraq" or "رز من الهند نوفمبر" - system extracts product, origin, destination & date automatically'}
            </p>
          </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              {t('common.error')}
            </div>
          ) : !data?.data.length ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-4 text-gray-500">{t('shipments.noResults')}</p>
              {(rawSearch || statusFilter) && (
                <Button variant="primary" onClick={clearFilters} className="mt-4">
                  {t('shipments.clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {/* Fixed: Checkbox column */}
                      <th className="px-3 py-3 text-center bg-white sticky start-0 z-10 border-e border-gray-200 shadow-sm w-12">
                        <input
                          type="checkbox"
                          checked={data?.data && selectedShipments.size === data.data.length && data.data.length > 0}
                          onChange={() => {
                            if (selectedShipments.size === data?.data?.length) {
                              handleClearSelection();
                            } else {
                              handleSelectAll();
                            }
                          }}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                      </th>
                      {/* Dynamic columns based on user preferences */}
                      {activeColumns.map(col => columnRenderers[col]?.header())}
                      {/* Fixed: Linked Contract column */}
                      <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {t('shipments.linkedContract', 'Linked Contract')}
                      </th>
                      {/* Fixed: Customs Clearance Date */}
                      <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {t('shipments.customsClearanceDate')}
                      </th>
                      {/* Fixed: Demurrage Status */}
                      <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {t('shipments.demurrageStatus')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.data.map((shipment) => (
                      <tr
                        key={shipment.id}
                        onClick={() => handleRowClick(shipment.id)}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedShipments.has(shipment.id) ? 'bg-blue-50' : ''}`}
                      >
                        {/* Fixed: Checkbox cell */}
                        <td
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-3 text-center bg-white sticky start-0 z-10 border-e border-gray-200 shadow-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedShipments.has(shipment.id)}
                            onChange={() => handleToggleSelection(shipment.id)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                        </td>
                        {/* Dynamic cells based on user preferences */}
                        {activeColumns.map(col => columnRenderers[col]?.cell(shipment))}
                        {/* Fixed: Linked Contract cell */}
                        <td className="px-3 py-3 whitespace-nowrap text-sm">
                          {shipment.contract_id ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/contracts/${shipment.contract_id}`);
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {shipment.contract_no || t('shipments.viewContract', 'View Contract')}
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        {/* Fixed: Customs Clearance Date cell */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {formatDateString(shipment.customs_clearance_date)}
                        </td>
                        {/* Fixed: Demurrage Status cell */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <DemurrageInlineBadge
                            eta={shipment.eta}
                            freeTimeDays={shipment.free_time_days}
                            customsClearanceDate={shipment.customs_clearance_date}
                            status={shipment.status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.pagination && (
                <Pagination
                  currentPage={page}
                  totalPages={data.pagination.totalPages || Math.ceil(data.pagination.total / data.pagination.limit)}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </Card>
      </div>

      {/* Bulk Actions Bar */}
      {selectedShipments.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedShipments.size}
          onExport={handleBulkExport}
          onCompare={handleCompare}
          onChangeStatus={handleBulkChangeStatus}
          onMarkAsDelivered={handleBulkMarkAsDelivered}
          onDelete={handleBulkDelete}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Comparison Modal */}
      {showComparisonModal && (
        <ComparisonModal
          shipmentIds={Array.from(selectedShipments)}
          onClose={() => setShowComparisonModal(false)}
        />
      )}

      {/* New Shipment Wizard */}
      <NewShipmentWizard
        isOpen={showNewShipmentWizard}
        onClose={() => setShowNewShipmentWizard(false)}
        onSuccess={() => {
          refetch(); // Refresh the shipments list
        }}
        initialStep={highlightField ? wizardStep : undefined}
      />
      
      {/* Field Highlighter for mapping audit tool */}
      {showNewShipmentWizard && highlightField && (
        <FieldHighlighter
          currentStep={wizardStep}
          onStepChange={setWizardStep}
      />
      )}
    </>
  );
}
