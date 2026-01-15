import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  PlusIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { usePendingClearances, useCreateCostFromPending } from '../../hooks/useCustomsClearingCosts';
import type { PendingClearanceFilters, PendingClearanceShipment, CreateCostFromPendingInput } from '../../types/api';
import { formatNumber, formatDateString } from '../../utils/format';
import { TranslatedProductText } from '../common/TranslatedProductText';
import { TruncatedText } from '../common/TruncatedText';

// Clearance category badge styles
const CLEARANCE_CATEGORY_STYLES = {
  transit: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Transit', labelAr: 'ترانزيت' },
  domestic: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', label: 'Domestic', labelAr: 'محلي' },
  custom_clearance: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Custom Clearance', labelAr: 'تخليص جمركي' },
} as const;

interface PendingClearancesTableProps {
  filters: PendingClearanceFilters;
  onFiltersChange: (filters: PendingClearanceFilters) => void;
  showInlineEntry?: boolean;
  onInlineEntryClose?: () => void;
}

interface EditingRow {
  shipment_id: string;
  file_number: string;
  original_clearing_amount: number | '';
  extra_cost_amount: number | '';
  extra_cost_description: string;
  cost_description: string;
  clearance_type: string;
  payment_status: 'pending' | 'paid' | 'partial';
}

interface InlineEntryData {
  bol_search: string;
  file_number: string;
  original_clearing_amount: number | '';
  extra_cost_amount: number | '';
  cost_description: string;
  payment_status: 'pending' | 'paid' | 'partial';
}

export const PendingClearancesTable: React.FC<PendingClearancesTableProps> = ({
  filters,
  onFiltersChange,
  showInlineEntry = false,
  onInlineEntryClose,
}) => {
  const { t } = useTranslation();
  const { data, loading, error, pagination, refresh } = usePendingClearances(filters);
  const { createFromPending, loading: createLoading } = useCreateCostFromPending();

  const [searchTerm, setSearchTerm] = useState('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingRow | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Inline entry state
  const [inlineEntryVisible, setInlineEntryVisible] = useState(showInlineEntry);
  const [inlineData, setInlineData] = useState<InlineEntryData>({
    bol_search: '',
    file_number: '',
    original_clearing_amount: '',
    extra_cost_amount: '',
    cost_description: '',
    payment_status: 'pending',
  });
  const [matchedShipment, setMatchedShipment] = useState<PendingClearanceShipment | null>(null);
  const [bolSearchStatus, setBolSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  
  // Sync with prop
  useEffect(() => {
    setInlineEntryVisible(showInlineEntry);
  }, [showInlineEntry]);
  
  // BOL auto-match logic - search in current data
  const searchBolInData = useCallback((bol: string) => {
    if (!bol || bol.trim().length < 2) {
      setMatchedShipment(null);
      setBolSearchStatus('idle');
      return;
    }
    
    setBolSearchStatus('searching');
    const searchLower = bol.toLowerCase().trim();
    
    // Search in current pending clearances data
    const found = data.find(shipment => 
      shipment.bl_no?.toLowerCase().includes(searchLower) ||
      shipment.booking_no?.toLowerCase().includes(searchLower)
    );
    
    if (found) {
      setMatchedShipment(found);
      setBolSearchStatus('found');
    } else {
      setMatchedShipment(null);
      setBolSearchStatus('not_found');
    }
  }, [data]);
  
  // Debounced BOL search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchBolInData(inlineData.bol_search);
    }, 300);
    return () => clearTimeout(timer);
  }, [inlineData.bol_search, searchBolInData]);
  
  // Auto-populate file_number when a shipment is matched
  useEffect(() => {
    if (matchedShipment && !inlineData.file_number) {
      setInlineData(prev => ({
        ...prev,
        file_number: matchedShipment.sn || '',
      }));
    }
  }, [matchedShipment]);
  
  // Handle inline entry field change
  const handleInlineFieldChange = (field: keyof InlineEntryData, value: any) => {
    setInlineData(prev => ({ ...prev, [field]: value }));
  };
  
  // Calculate inline total
  const calculateInlineTotal = () => {
    const original = Number(inlineData.original_clearing_amount) || 0;
    const extra = Number(inlineData.extra_cost_amount) || 0;
    return original + extra;
  };
  
  // Save inline entry
  const handleInlineSave = async () => {
    if (!matchedShipment) {
      alert(t('inlineEntry.noShipmentMatched', 'Please enter a BOL that matches a pending shipment'));
      return;
    }
    
    if (!inlineData.file_number.trim()) {
      alert(t('pendingClearances.fileNumberRequired', 'File number is required'));
      return;
    }
    
    const originalAmount = Number(inlineData.original_clearing_amount) || 0;
    const extraAmount = Number(inlineData.extra_cost_amount) || 0;
    
    if (originalAmount === 0 && extraAmount === 0) {
      alert(t('pendingClearances.atLeastOneCost', 'At least one cost field must be greater than zero'));
      return;
    }
    
    try {
      const input: CreateCostFromPendingInput = {
        shipment_id: matchedShipment.id,
        file_number: inlineData.file_number.trim(),
        original_clearing_amount: originalAmount > 0 ? originalAmount : null,
        extra_cost_amount: extraAmount > 0 ? extraAmount : null,
        cost_description: inlineData.cost_description || null,
        clearance_type: 'inbound',
        payment_status: inlineData.payment_status,
        bol_number: matchedShipment.bl_no || null,
      };
      
      await createFromPending(input);
      
      // Success - reset inline entry
      setInlineData({
        bol_search: '',
        file_number: '',
        original_clearing_amount: '',
        extra_cost_amount: '',
        cost_description: '',
        payment_status: 'pending',
      });
      setMatchedShipment(null);
      setBolSearchStatus('idle');
      setInlineEntryVisible(false);
      onInlineEntryClose?.();
      refresh();
    } catch (err: any) {
      console.error('Error saving inline cost:', err);
      alert(err.message || t('pendingClearances.saveFailed', 'Failed to save cost'));
    }
  };
  
  // Cancel inline entry
  const handleInlineCancel = () => {
    setInlineData({
      bol_search: '',
      file_number: '',
      original_clearing_amount: '',
      extra_cost_amount: '',
      cost_description: '',
      payment_status: 'pending',
    });
    setMatchedShipment(null);
    setBolSearchStatus('idle');
    setInlineEntryVisible(false);
    onInlineEntryClose?.();
  };
  
  // Toggle inline entry visibility
  const toggleInlineEntry = () => {
    if (inlineEntryVisible) {
      handleInlineCancel();
    } else {
      setInlineEntryVisible(true);
      // Cancel any row editing
      setEditingRowId(null);
      setEditingData(null);
    }
  };

  // Handle search
  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchTerm, page: 1 });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    onFiltersChange({ ...filters, page: newPage });
  };

  // Handle sorting
  const handleSort = (column: PendingClearanceFilters['sort_by']) => {
    if (filters.sort_by === column) {
      // Toggle sort order
      onFiltersChange({
        ...filters,
        sort_order: filters.sort_order === 'asc' ? 'desc' : 'asc',
        page: 1,
      });
    } else {
      // New column, default to descending
      onFiltersChange({
        ...filters,
        sort_by: column,
        sort_order: 'desc',
        page: 1,
      });
    }
  };

  // Render sort icon
  const renderSortIcon = (column: PendingClearanceFilters['sort_by']) => {
    if (filters.sort_by !== column) {
      return <span className="text-gray-300 ml-1">↕</span>;
    }
    return filters.sort_order === 'asc' 
      ? <ChevronUpIcon className="h-4 w-4 inline ml-1 text-blue-600" />
      : <ChevronDownIcon className="h-4 w-4 inline ml-1 text-blue-600" />;
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    onFiltersChange({
      page: 1,
      limit: filters.limit,
    });
  };

  // Start editing a row - triggered by clicking the row
  const handleRowClick = (shipment: PendingClearanceShipment) => {
    // Don't start new edit if already editing
    if (editingRowId !== null && editingRowId !== shipment.id) {
      return;
    }
    
    if (editingRowId === shipment.id) {
      // Already editing this row, do nothing
      return;
    }
    
    setEditingRowId(shipment.id);
    setEditingData({
      shipment_id: shipment.id,
      file_number: shipment.sn || '', // Auto-populate from shipment SN
      original_clearing_amount: '',
      extra_cost_amount: '',
      extra_cost_description: '',
      cost_description: '',
      clearance_type: shipment.transaction_type === 'outgoing' ? 'outbound' : 'inbound',
      payment_status: 'pending',
    });
  };

  // Cancel editing
  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRowId(null);
    setEditingData(null);
  };

  // Handle field change
  const handleFieldChange = (field: keyof EditingRow, value: any) => {
    if (!editingData) return;
    setEditingData({ ...editingData, [field]: value });
  };

  // Calculate total cost
  const calculateTotal = () => {
    if (!editingData) return 0;
    const original = Number(editingData.original_clearing_amount) || 0;
    const extra = Number(editingData.extra_cost_amount) || 0;
    return original + extra;
  };

  // Save the cost entry
  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingData) return;

    const originalAmount = Number(editingData.original_clearing_amount) || 0;
    const extraAmount = Number(editingData.extra_cost_amount) || 0;

    // Validate
    if (originalAmount === 0 && extraAmount === 0) {
      alert(t('pendingClearances.atLeastOneCost', 'At least one cost field must be greater than zero'));
      return;
    }

    if (!editingData.file_number.trim()) {
      alert(t('pendingClearances.fileNumberRequired', 'File number is required'));
      return;
    }

    try {
      const input: CreateCostFromPendingInput = {
        shipment_id: editingData.shipment_id,
        file_number: editingData.file_number.trim(),
        original_clearing_amount: originalAmount > 0 ? originalAmount : null,
        extra_cost_amount: extraAmount > 0 ? extraAmount : null,
        extra_cost_description: editingData.extra_cost_description || null,
        cost_description: editingData.cost_description || null,
        clearance_type: editingData.clearance_type,
        payment_status: editingData.payment_status,
      };

      await createFromPending(input);
      
      // Success - clear editing and refresh
      setEditingRowId(null);
      setEditingData(null);
      refresh();
    } catch (err: any) {
      console.error('Error saving cost:', err);
      alert(err.message || t('pendingClearances.saveFailed', 'Failed to save cost'));
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and filters toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('pendingClearances.searchPlaceholder', 'Search by SN or product...')}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
            {t('common.search', 'Search')}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-md flex items-center gap-2 ${
              showFilters
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            {t('common.filters', 'Filters')}
          </button>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
          >
            <ArrowPathIcon className="h-5 w-5" />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {t('pendingClearances.totalPending', 'Total pending: {{count}}', { count: pagination.total })}
          </div>
          <button
            onClick={toggleInlineEntry}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
              inlineEntryVisible
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {inlineEntryVisible ? (
              <>
                <XMarkIcon className="h-5 w-5" />
                {t('inlineEntry.cancel', 'Cancel Entry')}
              </>
            ) : (
              <>
                <PlusIcon className="h-5 w-5" />
                {t('inlineEntry.addInline', '+ Add Inline')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Clearance Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('clearanceCategory.label', 'Clearance Category')}
              </label>
              <select
                value={filters.clearance_category || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  clearance_category: e.target.value as any || undefined,
                  page: 1,
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('common.all', 'All')}</option>
                <option value="transit">{t('clearanceCategory.transit', 'Transit')} - ترانزيت</option>
                <option value="domestic">{t('clearanceCategory.domestic', 'Domestic')} - محلي</option>
                <option value="custom_clearance">{t('clearanceCategory.customClearance', 'Custom Clearance')} - تخليص جمركي</option>
              </select>
            </div>

            {/* POD Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('shipments.pod', 'Port of Discharge')}
              </label>
              <input
                type="text"
                value={filters.pod_name || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  pod_name: e.target.value || undefined,
                  page: 1,
                })}
                placeholder={t('pendingClearances.podFilter', 'Filter by POD...')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('pendingClearances.dateFrom', 'Clearance Date From')}
              </label>
              <input
                type="date"
                value={filters.clearance_date_from || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  clearance_date_from: e.target.value || undefined,
                  page: 1,
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('pendingClearances.dateTo', 'Clearance Date To')}
              </label>
              <input
                type="date"
                value={filters.clearance_date_to || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  clearance_date_to: e.target.value || undefined,
                  page: 1,
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            >
              {t('common.clearFilters', 'Clear Filters')}
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-500 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
        <span className="font-medium text-blue-700 dark:text-blue-300">
          {t('pendingClearances.clickToEdit', 'Click on any row to enter the clearance costs')}
        </span>
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500 text-lg">
            {t('pendingClearances.noPending', 'No pending clearances')}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {t('pendingClearances.noPendingDesc', 'Shipments will appear here when SCLM enters a clearance date')}
          </p>
        </div>
      ) : (
        <div ref={tableRef} className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {t('pendingClearances.shipmentId', 'Shipment ID')}
                </th>
                <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {t('shipments.blNo', 'BOL No')}
                </th>
                <th 
                  className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('sn')}
                >
                  {t('shipments.sn', 'SN')} {renderSortIcon('sn')}
                </th>
                <th 
                  className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('product_text')}
                >
                  {t('shipments.product', 'Product')} {renderSortIcon('product_text')}
                </th>
                <th 
                  className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('customs_clearance_date')}
                >
                  {t('shipments.customsClearanceDate', 'Clearance Date')} {renderSortIcon('customs_clearance_date')}
                </th>
                <th 
                  className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('container_count')}
                >
                  {t('shipments.containers', 'Containers')} {renderSortIcon('container_count')}
                </th>
                <th 
                  className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('weight_ton')}
                >
                  {t('shipments.weight', 'Weight (Ton)')} {renderSortIcon('weight_ton')}
                </th>
                <th 
                  className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('clearance_category')}
                >
                  {t('clearanceCategory.label', 'Category')} {renderSortIcon('clearance_category')}
                </th>
                <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {t('shipments.route', 'المسار')}
                </th>
                <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-blue-50 border-l-2 border-blue-300">
                  {t('pendingClearances.fileNumber', 'File No.')}
                </th>
                <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-blue-50">
                  {t('pendingClearances.originalCost', 'Original Cost')}
                </th>
                <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-blue-50">
                  {t('pendingClearances.extraCost', 'Extra Cost')}
                </th>
                <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-blue-50">
                  {t('pendingClearances.totalCost', 'Total Cost')}
                </th>
                <th className="px-3 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-blue-50">
                  {t('pendingClearances.description', 'Description')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Inline Entry Row */}
              {inlineEntryVisible && (
                <tr className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400">
                  {/* Shipment ID - auto from match */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm">
                    {matchedShipment ? (
                      <div className="font-mono text-green-700 font-medium">
                        {matchedShipment.id.slice(0, 8)}...
                        <div className="text-xs text-green-600">✓ Matched</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                  
                  {/* BOL Search Input */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="relative">
                      <input
                        type="text"
                        value={inlineData.bol_search}
                        onChange={(e) => handleInlineFieldChange('bol_search', e.target.value)}
                        placeholder={t('inlineEntry.enterBol', 'Enter BOL...')}
                        className={`w-36 px-2 py-1.5 text-sm border rounded focus:ring-2 focus:outline-none ${
                          bolSearchStatus === 'found'
                            ? 'border-green-500 bg-green-50 focus:ring-green-500'
                            : bolSearchStatus === 'not_found'
                            ? 'border-red-400 bg-red-50 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        autoFocus
                      />
                      {bolSearchStatus === 'searching' && (
                        <ArrowPathIcon className="absolute right-2 top-2 h-4 w-4 animate-spin text-gray-400" />
                      )}
                      {bolSearchStatus === 'found' && (
                        <CheckIcon className="absolute right-2 top-2 h-4 w-4 text-green-600" />
                      )}
                    </div>
                    {bolSearchStatus === 'not_found' && inlineData.bol_search.length >= 2 && (
                      <div className="text-xs text-red-600 mt-1">
                        {t('inlineEntry.noMatch', 'No match found')}
                      </div>
                    )}
                  </td>
                  
                  {/* SN - auto from match */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                    {matchedShipment?.sn || <span className="text-gray-400">—</span>}
                  </td>
                  
                  {/* Product - auto from match */}
                  <td className="px-3 py-3 text-sm text-gray-700 max-w-[180px]">
                    <TruncatedText text={matchedShipment?.product_text} maxWidth="180px">
                      <TranslatedProductText text={matchedShipment?.product_text} />
                    </TruncatedText>
                  </td>
                  
                  {/* Clearance Date - auto from match */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-green-700 bg-green-50/50">
                    {matchedShipment?.customs_clearance_date 
                      ? formatDateString(matchedShipment.customs_clearance_date)
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  
                  {/* Containers - auto from match */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {matchedShipment?.container_count || <span className="text-gray-400">—</span>}
                  </td>
                  
                  {/* Weight - auto from match */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                    {matchedShipment?.weight_ton 
                      ? formatNumber(matchedShipment.weight_ton)
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  
                  {/* Clearance Category - auto from match */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm">
                    {matchedShipment?.clearance_category ? (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        CLEARANCE_CATEGORY_STYLES[matchedShipment.clearance_category]?.bg
                      } ${CLEARANCE_CATEGORY_STYLES[matchedShipment.clearance_category]?.text} ${
                        CLEARANCE_CATEGORY_STYLES[matchedShipment.clearance_category]?.border
                      }`}>
                        {CLEARANCE_CATEGORY_STYLES[matchedShipment.clearance_category]?.labelAr}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  
                  {/* POD → Border → Final Destination - auto from match */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                    {matchedShipment ? (
                      <div className="flex items-center gap-1 flex-wrap" dir="ltr">
                        <span>{matchedShipment.pod_name || '—'}</span>
                        {matchedShipment.is_cross_border && matchedShipment.primary_border_name && (
                          <>
                            <span className="text-amber-500">→</span>
                            <span className="text-amber-600 bg-amber-50 px-1 py-0.5 rounded text-xs">
                              🚧 {matchedShipment.primary_border_name}
                            </span>
                          </>
                        )}
                        <span className={matchedShipment.is_cross_border ? 'text-amber-500' : 'text-gray-400'}>→</span>
                        <span>{matchedShipment.final_destination_name || '—'}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  
                  {/* File Number Input */}
                  <td className="px-3 py-3 whitespace-nowrap bg-blue-100/70 border-l-2 border-blue-400">
                    <input
                      type="text"
                      value={inlineData.file_number}
                      onChange={(e) => handleInlineFieldChange('file_number', e.target.value)}
                      placeholder={t('inlineEntry.fileNo', 'LAG-1872')}
                      className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  
                  {/* Original Cost Input */}
                  <td className="px-3 py-3 whitespace-nowrap bg-blue-100/70">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={inlineData.original_clearing_amount}
                      onChange={(e) => handleInlineFieldChange('original_clearing_amount', e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                      className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  
                  {/* Extra Cost Input */}
                  <td className="px-3 py-3 whitespace-nowrap bg-blue-100/70">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={inlineData.extra_cost_amount}
                      onChange={(e) => handleInlineFieldChange('extra_cost_amount', e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                      className="w-24 px-2 py-1.5 text-sm border border-orange-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </td>
                  
                  {/* Total - calculated */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-blue-700 bg-blue-100/70">
                    ${formatNumber(calculateInlineTotal().toFixed(2))}
                  </td>
                  
                  {/* Description + Actions */}
                  <td className="px-3 py-3 bg-blue-100/70">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inlineData.cost_description}
                        onChange={(e) => handleInlineFieldChange('cost_description', e.target.value)}
                        placeholder={t('inlineEntry.description', 'Description...')}
                        className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={handleInlineSave}
                        disabled={createLoading || !matchedShipment || !inlineData.file_number.trim()}
                        className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('common.save', 'Save')}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleInlineCancel}
                        disabled={createLoading}
                        className="p-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                        title={t('common.cancel', 'Cancel')}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              
              {/* Existing data rows */}
              {data.map((shipment) => {
                const isEditing = editingRowId === shipment.id;
                
                return (
                  <tr 
                    key={shipment.id} 
                    onClick={() => handleRowClick(shipment)}
                    className={`
                      ${isEditing ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset' : 'hover:bg-gray-100 cursor-pointer'}
                      ${editingRowId !== null && !isEditing ? 'opacity-50' : ''}
                      transition-colors duration-150
                    `}
                  >
                    {/* Shipment ID */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-mono text-blue-600 dark:text-blue-400">
                      <div className="truncate max-w-[80px]" title={shipment.id}>
                        {shipment.id.slice(0, 8)}...
                      </div>
                    </td>
                    
                    {/* BOL No */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="truncate max-w-[140px]" title={shipment.bl_no || (shipment.bol_numbers?.[0]) || ''}>
                        {shipment.bl_no || (shipment.bol_numbers?.[0]) || '—'}
                      </div>
                      {shipment.bol_numbers && shipment.bol_numbers.length > 1 && (
                        <div className="text-xs text-gray-500">
                          +{shipment.bol_numbers.length - 1} more
                        </div>
                      )}
                      {shipment.booking_no && (
                        <div className="text-xs text-gray-500 truncate" title={`Booking: ${shipment.booking_no}`}>
                          {shipment.booking_no}
                        </div>
                      )}
                    </td>
                    
                    {/* SN */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                      {shipment.sn || '—'}
                    </td>
                    
                    {/* Product */}
                    <td className="px-3 py-3 text-sm text-gray-900 max-w-[200px]">
                      <TruncatedText text={shipment.product_text} maxWidth="200px">
                        <TranslatedProductText text={shipment.product_text} />
                      </TruncatedText>
                      {shipment.subject && (
                        <TruncatedText text={shipment.subject} className="text-xs text-gray-500" maxWidth="200px" />
                      )}
                    </td>
                    
                    {/* Clearance Date */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-green-700 bg-green-50">
                      {shipment.customs_clearance_date ? formatDateString(shipment.customs_clearance_date) : '—'}
                    </td>
                    
                    {/* Containers */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                      {shipment.container_count || '—'}
                    </td>
                    
                    {/* Weight */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                      {shipment.weight_ton ? formatNumber(shipment.weight_ton) : '—'}
                    </td>
                    
                    {/* Clearance Category */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm">
                      {shipment.clearance_category ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                          CLEARANCE_CATEGORY_STYLES[shipment.clearance_category]?.bg
                        } ${CLEARANCE_CATEGORY_STYLES[shipment.clearance_category]?.text} ${
                          CLEARANCE_CATEGORY_STYLES[shipment.clearance_category]?.border
                        }`}>
                          {CLEARANCE_CATEGORY_STYLES[shipment.clearance_category]?.labelAr}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    
                    {/* POD → Final Destination */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1" dir="ltr">
                        <span className="font-medium">{shipment.pod_name || '—'}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{shipment.final_destination_name || '—'}</span>
                      </div>
                      {shipment.pod_country && (
                        <div className="text-xs text-gray-500">
                          {shipment.pod_country}
                        </div>
                      )}
                    </td>
                    
                    {/* Cost Entry Section - highlighted */}
                    {isEditing && editingData ? (
                      <>
                        {/* File Number */}
                        <td className="px-3 py-3 whitespace-nowrap bg-blue-100 border-l-2 border-blue-400">
                          <input
                            type="text"
                            value={editingData.file_number}
                            onChange={(e) => handleFieldChange('file_number', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-32 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={t('pendingClearances.fileNumberPlaceholder', 'Enter file no...')}
                            autoFocus
                          />
                        </td>
                        {/* Original Cost */}
                        <td className="px-3 py-3 whitespace-nowrap bg-blue-100">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingData.original_clearing_amount}
                            onChange={(e) => handleFieldChange('original_clearing_amount', e.target.value === '' ? '' : Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            className="w-28 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap bg-blue-100">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingData.extra_cost_amount}
                            onChange={(e) => handleFieldChange('extra_cost_amount', e.target.value === '' ? '' : Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            className="w-28 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-blue-700 bg-blue-100">
                          ${formatNumber(calculateTotal().toFixed(2))}
                        </td>
                        <td className="px-3 py-3 bg-blue-100">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingData.cost_description}
                              onChange={(e) => handleFieldChange('cost_description', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-40 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder={t('pendingClearances.descriptionPlaceholder', 'Enter description...')}
                            />
                            <button
                              onClick={handleSave}
                              disabled={createLoading}
                              className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              title={t('common.save', 'Save')}
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={createLoading}
                              className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              title={t('common.cancel', 'Cancel')}
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-400 italic bg-gray-50 border-l-2 border-gray-300">
                          {t('pendingClearances.clickToEnter', 'Click to enter')}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-400 italic bg-gray-50">
                          {t('pendingClearances.clickToEnter', 'Click to enter')}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-400 italic bg-gray-50">
                          {t('pendingClearances.clickToEnter', 'Click to enter')}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-400 bg-gray-50">—</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-400 bg-gray-50">—</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.previous', 'Previous')}
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next', 'Next')}
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                {t('common.showing', 'Showing')}{' '}
                <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
                {' '}{t('common.to', 'to')}{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>
                {' '}{t('common.of', 'of')}{' '}
                <span className="font-medium">{pagination.total}</span>
                {' '}{t('common.results', 'results')}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">{t('common.previous', 'Previous')}</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  let pageNum;
                  if (pagination.pages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.pages - 2) {
                    pageNum = pagination.pages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pagination.page === pageNum
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">{t('common.next', 'Next')}</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
