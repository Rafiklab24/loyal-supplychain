import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  QueueListIcon,
  CheckIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

// Clearance category badge styles
const CLEARANCE_CATEGORY_STYLES = {
  transit: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Transit', labelAr: 'ترانزيت' },
  domestic: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', label: 'Domestic', labelAr: 'محلي' },
  custom_clearance: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Custom Clearance', labelAr: 'تخليص جمركي' },
} as const;
import { useCustomsClearingCosts, useCustomsClearingCostMutations, useCustomsClearingCostsExport, useCustomsClearingCostsSummary } from '../hooks/useCustomsClearingCosts';
import type { CustomsClearingCostFilters, CustomsClearingCost, PendingClearanceFilters } from '../types/api';
import CustomsClearingCostModal from '../components/customs/CustomsClearingCostModal';
import CreateBatchModal from '../components/customs/CreateBatchModal';
import { PendingClearancesTable } from '../components/customs/PendingClearancesTable';
import FileFirstCostEntry from '../components/customs/FileFirstCostEntry';
import { DateInput } from '../components/common/DateInput';

const CustomsClearingCostsPage: React.FC = () => {
  const { t } = useTranslation();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'costs' | 'pending'>('costs');
  
  const [filters, setFilters] = useState<CustomsClearingCostFilters>({
    page: 1,
    limit: 50,
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  
  // Pending clearances filters
  const [pendingFilters, setPendingFilters] = useState<PendingClearanceFilters>({
    page: 1,
    limit: 50,
    sort_by: 'customs_clearance_date',
    sort_order: 'desc',
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Selection state for batch creation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  
  // File-first cost entry modal state
  const [isFileFirstEntryOpen, setIsFileFirstEntryOpen] = useState(false);
  
  // Inline editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<CustomsClearingCost>>({});
  const [newRows, setNewRows] = useState<Array<{ tempId: string; data: Partial<CustomsClearingCost> }>>([]);

  // Fetch data
  const { data, loading, error, pagination, refresh } = useCustomsClearingCosts(filters);
  const { data: summary } = useCustomsClearingCostsSummary();
  const { create, update, remove } = useCustomsClearingCostMutations();
  const { exportData, loading: exportLoading } = useCustomsClearingCostsExport();

  // Handle search
  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchTerm, page: 1 }));
  };

  // Handle filter change
  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    setSearchTerm('');
  };

  // Handle export
  const handleExport = async () => {
    try {
      await exportData(filters);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!window.confirm(t('customsClearingCosts.confirmDelete'))) {
      return;
    }

    try {
      await remove(id);
      refresh();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedId(null);
    refresh();
  };

  // Handle selection
  const handleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(item => item.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Handle batch creation
  const handleCreateBatch = () => {
    if (selectedIds.size === 0) {
      alert(t('batches.noItemsSelected'));
      return;
    }
    setIsCreateBatchModalOpen(true);
  };

  const handleBatchCreated = () => {
    setIsCreateBatchModalOpen(false);
    setSelectedIds(new Set());
    refresh();
  };

  // Calculate total of selected items
  const calculateSelectedTotal = () => {
    return data
      .filter(item => selectedIds.has(item.id))
      .reduce((sum, item) => sum + (item.total_clearing_cost || 0), 0);
  };

  // Add new empty row
  const handleAddNewRow = () => {
    const tempId = `temp-${Date.now()}`;
    const newRow = {
      tempId,
      data: {
        file_number: '',
        transaction_type: '',
        goods_type: '',
        containers_cars_count: '',
        goods_weight: '',
        cost_description: '',
        clearance_type: null,
        payment_status: 'pending' as const,
        currency: 'USD',
        cost_responsibility: '',
        original_clearing_amount: 0,
        extra_cost_amount: 0,
        total_clearing_cost: 0,
      } satisfies Partial<CustomsClearingCost>,
    };
    setNewRows([newRow, ...newRows]);
    setEditingRowId(tempId);
    setEditingData(newRow.data as Partial<CustomsClearingCost>);
  };

  // Start editing existing row
  const handleStartEdit = (item: CustomsClearingCost) => {
    setEditingRowId(item.id);
    // Convert date format for the input field
    const editData = { ...item };
    if (editData.invoice_date) {
      const date = new Date(editData.invoice_date);
      if (!isNaN(date.getTime())) {
        editData.invoice_date = date.toISOString().split('T')[0];
      }
    }
    setEditingData(editData);
  };

  // Cancel editing
  const handleCancelEdit = (id: string) => {
    setEditingRowId(null);
    setEditingData({});
    
    // Remove from newRows if it's a temporary row
    if (id.startsWith('temp-')) {
      setNewRows(newRows.filter(row => row.tempId !== id));
    }
  };

  // Handle inline field change
  const handleInlineFieldChange = (field: string, value: any) => {
    setEditingData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate total if cost fields change
      if (['original_clearing_amount', 'extra_cost_amount'].includes(field)) {
        const originalAmount = Number(updated.original_clearing_amount) || 0;
        const extra = Number(updated.extra_cost_amount) || 0;
        updated.total_clearing_cost = originalAmount + extra;
      }
      
      return updated;
    });
  };

  // Save inline edit
  const handleSaveInlineEdit = async (id: string) => {
    try {
      // Validate required fields
      if (!editingData.file_number?.trim()) {
        alert(t('customsClearingCosts.requiredField') + ': ' + t('customsClearingCosts.fileNumber'));
        return;
      }

      const originalAmount = Number(editingData.original_clearing_amount) || 0;
      const extra = Number(editingData.extra_cost_amount) || 0;

      // At least one cost must be specified
      if (originalAmount === 0 && extra === 0) {
        alert(t('customsClearingCosts.atLeastOneCost'));
        return;
      }

      // Prepare data for save - fix date format and handle backward compatibility
      const dataToSave: Record<string, unknown> = { ...editingData };
      
      // Convert ISO date to YYYY-MM-DD if present
      if (dataToSave.invoice_date) {
        const date = new Date(dataToSave.invoice_date as string);
        if (!isNaN(date.getTime())) {
          dataToSave.invoice_date = date.toISOString().split('T')[0];
        }
      }
      
      // Convert string numbers to actual numbers for validation
      const numericFields = [
        'cost_paid_by_company',
        'cost_paid_by_fb',
        'original_clearing_amount',
        'extra_cost_amount',
        'total_clearing_cost',
        'invoice_amount'
      ];
      
      numericFields.forEach(field => {
        if (dataToSave[field] !== null && dataToSave[field] !== undefined) {
          const value = typeof dataToSave[field] === 'string' 
            ? parseFloat(dataToSave[field] as string) 
            : dataToSave[field] as number;
          dataToSave[field] = isNaN(value) ? null : value;
        }
      });
      
      // Clean up legacy fields - set to null if they're 0 to avoid validation conflicts
      if (dataToSave.cost_paid_by_company === 0) {
        dataToSave.cost_paid_by_company = null;
      }
      if (dataToSave.cost_paid_by_fb === 0) {
        dataToSave.cost_paid_by_fb = null;
      }
      
      // Backward compatibility: If editing old data, migrate old fields to new ones
      if (!id.startsWith('temp-')) {
        // If original_clearing_amount not set but old fields exist, use them
        if (!dataToSave.original_clearing_amount && 
            (dataToSave.cost_paid_by_company || dataToSave.cost_paid_by_fb)) {
          dataToSave.original_clearing_amount = 
            dataToSave.cost_paid_by_company || dataToSave.cost_paid_by_fb;
        }
      }

      console.log('Saving data:', JSON.stringify(dataToSave, null, 2));

      if (id.startsWith('temp-')) {
        // Create new record
        await create(dataToSave);
        setNewRows(newRows.filter(row => row.tempId !== id));
      } else {
        // Update existing record
        await update(id, dataToSave);
      }

      setEditingRowId(null);
      setEditingData({});
      refresh();
    } catch (err: any) {
      console.error('Error saving:', err);
      console.error('Error details:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save';
      alert(`Failed to save: ${errorMessage}`);
    }
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined, currency: string = 'USD') => {
    if (amount === null || amount === undefined) return '—';
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  // Format date
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB');
  };

  // Render editable row
  const renderEditableRow = (id: string, rowData: Partial<CustomsClearingCost>, isEditing: boolean, isNew: boolean) => {
    if (isEditing) {
      // Edit mode - render input fields
      return (
        <>
          {/* File Number */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.file_number || ''}
              onChange={(e) => handleInlineFieldChange('file_number', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="File #"
            />
          </td>
          {/* Transaction Type */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.transaction_type || ''}
              onChange={(e) => handleInlineFieldChange('transaction_type', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Transaction"
            />
          </td>
          {/* Goods Type */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.goods_type || ''}
              onChange={(e) => handleInlineFieldChange('goods_type', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Goods"
            />
          </td>
          {/* Containers/Cars */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.containers_cars_count || ''}
              onChange={(e) => handleInlineFieldChange('containers_cars_count', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Count"
            />
          </td>
          {/* Weight */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.goods_weight || ''}
              onChange={(e) => handleInlineFieldChange('goods_weight', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Weight"
            />
          </td>
          {/* Clearance Type */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              list="clearance-type-suggestions"
              value={rowData.clearance_type || ''}
              onChange={(e) => handleInlineFieldChange('clearance_type', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="نوع التخليص"
            />
            <datalist id="clearance-type-suggestions">
              <option value="تخليص" />
              <option value="تحميل" />
              <option value="تخليص + تحميل" />
              <option value="إدخالات" />
              <option value="اخراجات" />
            </datalist>
          </td>
          {/* Clearance Category - Display only (from shipment) */}
          <td className="px-2 py-2 whitespace-nowrap text-sm">
            {(rowData as any).shipment_clearance_category ? (
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                CLEARANCE_CATEGORY_STYLES[(rowData as any).shipment_clearance_category as keyof typeof CLEARANCE_CATEGORY_STYLES]?.bg
              } ${CLEARANCE_CATEGORY_STYLES[(rowData as any).shipment_clearance_category as keyof typeof CLEARANCE_CATEGORY_STYLES]?.text} ${
                CLEARANCE_CATEGORY_STYLES[(rowData as any).shipment_clearance_category as keyof typeof CLEARANCE_CATEGORY_STYLES]?.border
              }`}>
                {CLEARANCE_CATEGORY_STYLES[(rowData as any).shipment_clearance_category as keyof typeof CLEARANCE_CATEGORY_STYLES]?.labelAr}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>
          {/* Cost Description */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.cost_description || ''}
              onChange={(e) => handleInlineFieldChange('cost_description', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Description"
            />
          </td>
          {/* Destination */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.destination_final_beneficiary || ''}
              onChange={(e) => handleInlineFieldChange('destination_final_beneficiary', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Destination"
            />
          </td>
          {/* Cost Responsibility - Editable field */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.cost_responsibility || ''}
              onChange={(e) => handleInlineFieldChange('cost_responsibility', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Responsibility"
            />
          </td>
          {/* Original Clearing Amount - Single field */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              step="0.01"
              value={rowData.original_clearing_amount || ''}
              onChange={(e) => handleInlineFieldChange('original_clearing_amount', parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Amount"
            />
          </td>
          {/* Extra Cost */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              step="0.01"
              value={rowData.extra_cost_amount || ''}
              onChange={(e) => handleInlineFieldChange('extra_cost_amount', parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
              placeholder="Extra"
            />
          </td>
          {/* Total (calculated) */}
          <td className="px-2 py-2 text-sm font-bold text-gray-900 dark:text-white text-right">
            {formatCurrency(rowData.total_clearing_cost, rowData.currency)}
          </td>
          {/* Client Name */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.client_name || ''}
              onChange={(e) => handleInlineFieldChange('client_name', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Client"
            />
          </td>
          {/* Invoice Amount */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              step="0.01"
              value={rowData.invoice_amount || ''}
              onChange={(e) => handleInlineFieldChange('invoice_amount', parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Amount"
            />
          </td>
          {/* Currency */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <select
              value={rowData.currency || 'USD'}
              onChange={(e) => handleInlineFieldChange('currency', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="TRY">TRY</option>
              <option value="AED">AED</option>
              <option value="SAR">SAR</option>
            </select>
          </td>
          {/* Invoice Number */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={rowData.invoice_number || ''}
              onChange={(e) => handleInlineFieldChange('invoice_number', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Invoice #"
            />
          </td>
          {/* Invoice Date */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <DateInput
              value={rowData.invoice_date || ''}
              onChange={(val) => handleInlineFieldChange('invoice_date', val)}
              className="w-full border-gray-300 dark:bg-gray-700 dark:text-white"
            />
          </td>
          {/* Payment Status */}
          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
            <select
              value={rowData.payment_status || 'pending'}
              onChange={(e) => handleInlineFieldChange('payment_status', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="pending">{t('customsClearingCosts.pending')}</option>
              <option value="paid">{t('customsClearingCosts.paid')}</option>
              <option value="partial">{t('customsClearingCosts.partial')}</option>
            </select>
          </td>
          {/* Actions */}
          <td className="px-2 py-2 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleSaveInlineEdit(id)}
                className="p-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                title="Save"
              >
                <CheckIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleCancelEdit(id)}
                className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                title="Cancel"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </td>
        </>
      );
    } else {
      // View mode - render static content
      return (
        <>
          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
            {rowData.file_number}
          </td>
          <td className="px-4 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
            {rowData.transaction_type || '—'}
          </td>
          <td className="px-4 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
            {rowData.goods_type || '—'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {rowData.containers_cars_count || '—'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {rowData.goods_weight || '—'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
            {rowData.clearance_type || '—'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm">
            {(rowData as any).shipment_clearance_category ? (
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                CLEARANCE_CATEGORY_STYLES[(rowData as any).shipment_clearance_category as keyof typeof CLEARANCE_CATEGORY_STYLES]?.bg
              } ${CLEARANCE_CATEGORY_STYLES[(rowData as any).shipment_clearance_category as keyof typeof CLEARANCE_CATEGORY_STYLES]?.text} ${
                CLEARANCE_CATEGORY_STYLES[(rowData as any).shipment_clearance_category as keyof typeof CLEARANCE_CATEGORY_STYLES]?.border
              }`}>
                {CLEARANCE_CATEGORY_STYLES[(rowData as any).shipment_clearance_category as keyof typeof CLEARANCE_CATEGORY_STYLES]?.labelAr}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>
          <td className="px-4 py-4 text-sm text-gray-900 dark:text-white max-w-md truncate">
            {rowData.cost_description || (rowData as any).transaction_description || '—'}
          </td>
          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
            {rowData.destination_final_beneficiary || '—'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
            {rowData.cost_responsibility || '—'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white font-medium">
            {rowData.original_clearing_amount
              ? formatCurrency(rowData.original_clearing_amount, rowData.currency)
              : <span className="text-gray-400">—</span>
            }
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
            {rowData.extra_cost_amount 
              ? <span className="font-medium text-orange-600 dark:text-orange-400">
                  {formatCurrency(rowData.extra_cost_amount, rowData.currency)}
                </span>
              : <span className="text-gray-400">—</span>
            }
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
            {formatCurrency(rowData.total_clearing_cost, rowData.currency)}
          </td>
          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
            {rowData.client_name || '—'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white font-medium">
            {rowData.invoice_amount 
              ? formatCurrency(rowData.invoice_amount, rowData.currency)
              : <span className="text-gray-400">—</span>
            }
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600 dark:text-gray-400">
            {rowData.currency || 'USD'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
            {rowData.invoice_number || '—'}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {formatDate(rowData.invoice_date)}
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-sm">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                rowData.payment_status === 'paid'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : rowData.payment_status === 'partial'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {t(`customsClearingCosts.${rowData.payment_status}`)}
            </span>
          </td>
          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
            {!isNew && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(rowData as CustomsClearingCost);
                  }}
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                  title="Edit"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete((rowData as CustomsClearingCost).id);
                  }}
                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  title="Delete"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </td>
        </>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('customsClearingCosts.title')}
        </h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('costs')}
            className={`${
              activeTab === 'costs'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            {t('customsClearingCosts.costsTab', 'Customs Costs')}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            {t('pendingClearances.title', 'Pending Clearances')}
          </button>
        </nav>
      </div>

      {/* Conditional rendering based on active tab */}
      {activeTab === 'pending' ? (
        <div className="space-y-4">
          {/* Entry Options - Wizard only (inline button is inside table) */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsFileFirstEntryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              title={t('fileFirstEntry.wizardTooltip', 'Open full wizard modal for detailed entry')}
            >
              <span className="text-lg">🔮</span>
              {t('fileFirstEntry.wizard', 'Wizard')}
            </button>
          </div>
          
          <PendingClearancesTable
            filters={pendingFilters}
            onFiltersChange={setPendingFilters}
          />
        </div>
      ) : (
        <>
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('customsClearingCosts.totalRecords')}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.total_records}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('customsClearingCosts.totalCost')}
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              ${summary.total_clearing_cost.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('customsClearingCosts.totalPaidByCompany')}
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              ${summary.total_paid_by_company.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('customsClearingCosts.totalPaidByFB')}
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              ${summary.total_paid_by_fb.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('customsClearingCosts.totalExtraCosts')}
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              ${summary.total_extra_costs.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={t('customsClearingCosts.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('customsClearingCosts.search')}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handleCreateBatch}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <QueueListIcon className="h-5 w-5" />
                {t('batches.createBatch')} ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FunnelIcon className="h-5 w-5" />
              {t('customsClearingCosts.filters')}
            </button>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {t('customsClearingCosts.export')}
            </button>
            <button
              onClick={handleAddNewRow}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              title={t('customsClearingCosts.addNewInline', 'Add new row inline')}
            >
              <PlusIcon className="h-5 w-5" />
              {t('customsClearingCosts.addNew')}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* File Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('customsClearingCosts.fileNumber')}
                </label>
                <input
                  type="text"
                  value={filters.file_number || ''}
                  onChange={(e) => handleFilterChange('file_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Clearance Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('customsClearingCosts.clearanceType')}
                </label>
                <select
                  value={filters.clearance_type || ''}
                  onChange={(e) => handleFilterChange('clearance_type', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">All</option>
                  <option value="inbound">{t('customsClearingCosts.inbound')}</option>
                  <option value="outbound">{t('customsClearingCosts.outbound')}</option>
                </select>
              </div>

              {/* Clearance Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('clearanceCategory.label', 'Clearance Category')}
                </label>
                <select
                  value={filters.clearance_category || ''}
                  onChange={(e) => handleFilterChange('clearance_category', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{t('common.all', 'All')}</option>
                  <option value="transit">{t('clearanceCategory.transit', 'Transit')} - ترانزيت</option>
                  <option value="domestic">{t('clearanceCategory.domestic', 'Domestic')} - محلي</option>
                  <option value="custom_clearance">{t('clearanceCategory.customClearance', 'Custom Clearance')} - تخليص جمركي</option>
                </select>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('customsClearingCosts.destination', 'Destination')}
                </label>
                <input
                  type="text"
                  value={filters.destination || ''}
                  onChange={(e) => handleFilterChange('destination', e.target.value || undefined)}
                  placeholder={t('customsClearingCosts.destinationPlaceholder', 'Filter by destination...')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('customsClearingCosts.paymentStatus')}
                </label>
                <select
                  value={filters.payment_status || ''}
                  onChange={(e) => handleFilterChange('payment_status', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">All</option>
                  <option value="pending">{t('customsClearingCosts.pending')}</option>
                  <option value="paid">{t('customsClearingCosts.paid')}</option>
                  <option value="partial">{t('customsClearingCosts.partial')}</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('customsClearingCosts.from')}
                </label>
                <DateInput
                  value={filters.invoice_date_from || ''}
                  onChange={(val) => handleFilterChange('invoice_date_from', val || undefined)}
                  className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('customsClearingCosts.to')}
                </label>
                <DateInput
                  value={filters.invoice_date_to || ''}
                  onChange={(val) => handleFilterChange('invoice_date_to', val || undefined)}
                  className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('customsClearingCosts.clearFilters')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {t('customsClearingCosts.loading')}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {t('customsClearingCosts.noRecords')}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={data.length > 0 && selectedIds.size === data.length}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.fileNumber')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.transactionType')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.goodsType')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.containersOrCars')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.goodsWeight')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.clearanceType')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('clearanceCategory.label', 'Category')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.costDescription')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.finalDestination')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.costResponsibility')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.originalClearanceAmount')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.extraCostAmount')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.totalClearingCost')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.clientName')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.invoiceAmount')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.currency')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.invoiceNumber')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.invoiceDate')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('customsClearingCosts.paymentStatus')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {/* New rows (temporary) */}
                  {newRows.map((newRow) => {
                    const isEditing = editingRowId === newRow.tempId;
                    const rowData = isEditing ? editingData : newRow.data;
                    
                    return (
                      <tr key={newRow.tempId} className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500">
                        <td className="px-4 py-2">
                          <span className="text-xs text-green-600 dark:text-green-400 font-semibold">NEW</span>
                        </td>
                        {renderEditableRow(newRow.tempId, rowData, isEditing, true)}
                      </tr>
                    );
                  })}
                  
                  {/* Existing rows */}
                  {data.map((item) => {
                    const isEditing = editingRowId === item.id;
                    const rowData = isEditing ? editingData : item;
                    
                    return (
                      <tr 
                        key={item.id} 
                        className={`transition-colors ${
                          isEditing 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                        }`}
                        onClick={() => !isEditing && handleStartEdit(item)}
                      >
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled={isEditing}
                          />
                        </td>
                        {renderEditableRow(item.id, rowData, isEditing, false)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Showing page {pagination.page} of {pagination.pages} ({pagination.total}{' '}
                    total)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFilterChange('page', pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handleFilterChange('page', pagination.page + 1)}
                      disabled={pagination.page >= pagination.pages}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
        </>
      )}

      {/* Cost Entry Modal */}
      {isModalOpen && (
        <CustomsClearingCostModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          costId={selectedId}
        />
      )}

      {/* Create Batch Modal */}
      {isCreateBatchModalOpen && (
        <CreateBatchModal
          isOpen={isCreateBatchModalOpen}
          onClose={() => setIsCreateBatchModalOpen(false)}
          selectedIds={Array.from(selectedIds)}
          selectedItems={data.filter(item => selectedIds.has(item.id))}
          totalCost={calculateSelectedTotal()}
          onSuccess={handleBatchCreated}
        />
      )}

      {/* File-First Cost Entry Modal */}
      <FileFirstCostEntry
        isOpen={isFileFirstEntryOpen}
        onClose={() => setIsFileFirstEntryOpen(false)}
        onSuccess={() => {
          setIsFileFirstEntryOpen(false);
          refresh();
        }}
      />
    </div>
  );
};

export default CustomsClearingCostsPage;

