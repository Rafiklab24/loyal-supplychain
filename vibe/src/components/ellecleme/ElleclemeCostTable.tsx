/**
 * Elleçleme Cost Table
 * Display and manage costs for an Elleçleme request
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@headlessui/react';
import {
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useElleçlemeCosts, useElleçlemeCostSummary, useCreateCost, useDeleteCost } from '../../hooks/useEllecleme';
import { getCostTypeIcon, type CostType, type CreateCostInput, type ElleçlemeCost } from '../../services/ellecleme';

interface ElleclemeCostTableProps {
  requestId: string;
  onUpdate?: () => void;
}

const COST_TYPES: { value: CostType; labelKey: string }[] = [
  { value: 'labor', labelKey: 'ellecleme.cost.types.labor' },
  { value: 'materials', labelKey: 'ellecleme.cost.types.materials' },
  { value: 'external_service', labelKey: 'ellecleme.cost.types.external_service' },
  { value: 'equipment', labelKey: 'ellecleme.cost.types.equipment' },
  { value: 'lab_testing', labelKey: 'ellecleme.cost.types.lab_testing' },
  { value: 'other', labelKey: 'ellecleme.cost.types.other' },
];

export default function ElleclemeCostTable({ requestId, onUpdate }: ElleclemeCostTableProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language;

  // State
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Data
  const { data: costs, isLoading, refetch } = useElleçlemeCosts(requestId);
  const { data: summary } = useElleçlemeCostSummary(requestId);

  // Mutations
  const createCost = useCreateCost();
  const deleteCost = useDeleteCost();

  // Helpers
  const formatCurrency = (amount: number | undefined, currency = 'TRY') => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getDescription = (cost: ElleçlemeCost) => {
    if (lang === 'ar' && cost.description_ar) return cost.description_ar;
    if (lang === 'tr' && cost.description_tr) return cost.description_tr;
    return cost.description;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCost.mutateAsync(id);
      setDeleteConfirm(null);
      refetch();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting cost:', error);
    }
  };

  const handleAddSuccess = () => {
    setShowAddForm(false);
    refetch();
    onUpdate?.();
  };

  // Calculate totals from summary
  const totalCost = summary?.totals?.reduce((sum: number, t: any) => sum + Number(t.grand_total || 0), 0) || 0;
  const customsValueCost = summary?.totals?.reduce((sum: number, t: any) => sum + Number(t.customs_value_total || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          {t('ellecleme.cost.title', 'Costs')}
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t('ellecleme.cost.addCost', 'Add Cost')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">{t('ellecleme.cost.totalCost', 'Total Cost')}</p>
          <p className="text-xl font-bold text-slate-800" dir="ltr">
            {formatCurrency(totalCost, 'TRY')}
          </p>
        </div>
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-600 mb-1">{t('ellecleme.cost.customsValueCost', 'Customs Value Cost')}</p>
          <p className="text-xl font-bold text-amber-800" dir="ltr">
            {formatCurrency(customsValueCost, 'TRY')}
          </p>
        </div>
      </div>

      {/* Costs List */}
      {!costs || costs.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <CurrencyDollarIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('ellecleme.empty.noCosts', 'No costs recorded')}</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            {t('ellecleme.cost.addCost', 'Add Cost')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {costs.map((cost: ElleçlemeCost) => (
            <div
              key={cost.id}
              className={`p-4 rounded-lg border ${
                cost.include_in_customs_value
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getCostTypeIcon(cost.cost_type)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {t(`ellecleme.cost.types.${cost.cost_type}`, cost.cost_type)}
                      </span>
                      {cost.include_in_customs_value && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                          {t('ellecleme.cost.includeInCustomsValue', 'Customs Value')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{getDescription(cost)}</p>
                    {cost.vendor_name && (
                      <p className="text-xs text-slate-500 mt-1">{cost.vendor_name}</p>
                    )}
                    {cost.invoice_no && (
                      <p className="text-xs text-slate-400 font-mono">{cost.invoice_no}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-slate-800" dir="ltr">
                      {formatCurrency(cost.amount, cost.currency)}
                    </p>
                    {cost.labor_hours && (
                      <p className="text-xs text-slate-500">
                        {cost.labor_hours}h × {cost.worker_count || 1} workers
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(cost.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Cost Form Modal */}
      {showAddForm && (
        <AddCostForm
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          requestId={requestId}
          onSuccess={handleAddSuccess}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className={`relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                {t('common.confirmDelete', 'Confirm Delete')}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {t('common.deleteConfirmMessage', 'Are you sure you want to delete this item?')}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleteCost.isPending}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {deleteCost.isPending ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add Cost Form Component
function AddCostForm({
  isOpen,
  onClose,
  requestId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  onSuccess: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const createCost = useCreateCost();

  const [formData, setFormData] = useState<Partial<CreateCostInput>>({
    request_id: requestId,
    cost_type: 'labor',
    description: '',
    amount: 0,
    currency: 'TRY',
    include_in_customs_value: false,
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount) return;

    try {
      await createCost.mutateAsync(formData as CreateCostInput);
      onSuccess();
    } catch (error) {
      console.error('Error creating cost:', error);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`mx-auto max-w-lg w-full bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto ${isRtl ? 'rtl' : 'ltr'}`}>
          {/* Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-200 z-10">
            <Dialog.Title className="flex items-center gap-3 text-lg font-semibold text-slate-800">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CurrencyDollarIcon className="h-5 w-5 text-blue-600" />
              </div>
              {t('ellecleme.cost.addCost', 'Add Cost')}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Cost Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('ellecleme.cost.type', 'Cost Type')} *
              </label>
              <select
                value={formData.cost_type}
                onChange={(e) => handleChange('cost_type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COST_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {getCostTypeIcon(type.value)} {t(type.labelKey, type.value)}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('ellecleme.cost.description', 'Description')} *
              </label>
              <input
                type="text"
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Amount & Currency */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('ellecleme.cost.amount', 'Amount')} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount || ''}
                  onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('ellecleme.cost.currency', 'Currency')}
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Labor-specific fields */}
            {formData.cost_type === 'labor' && (
              <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {t('ellecleme.cost.laborHours', 'Hours')}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.labor_hours || ''}
                    onChange={(e) => handleChange('labor_hours', parseFloat(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {t('ellecleme.cost.laborRate', 'Rate/hr')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.labor_rate || ''}
                    onChange={(e) => handleChange('labor_rate', parseFloat(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {t('ellecleme.cost.workerCount', 'Workers')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.worker_count || ''}
                    onChange={(e) => handleChange('worker_count', parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Vendor Info */}
            {(formData.cost_type === 'external_service' || formData.cost_type === 'materials') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('ellecleme.cost.vendorName', 'Vendor Name')}
                  </label>
                  <input
                    type="text"
                    value={formData.vendor_name || ''}
                    onChange={(e) => handleChange('vendor_name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('ellecleme.cost.invoiceNo', 'Invoice No')}
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_no || ''}
                    onChange={(e) => handleChange('invoice_no', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Include in Customs Value */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.include_in_customs_value}
                  onChange={(e) => handleChange('include_in_customs_value', e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-amber-800">
                    {t('ellecleme.cost.includeInCustomsValue', 'Include in Customs Value')}
                  </span>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {t('ellecleme.cost.customsValueHint', 'This cost will be added to the customs value declaration')}
                  </p>
                </div>
              </label>
              
              {formData.include_in_customs_value && (
                <div className="mt-3">
                  <label className="block text-xs text-amber-700 mb-1">
                    {t('ellecleme.cost.customsJustification', 'Justification')}
                  </label>
                  <input
                    type="text"
                    value={formData.customs_value_justification || ''}
                    onChange={(e) => handleChange('customs_value_justification', e.target.value)}
                    placeholder={t('ellecleme.cost.justificationPlaceholder', 'Why include in customs value?')}
                    className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className={`flex items-center justify-end gap-3 pt-4 border-t border-slate-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={createCost.isPending || !formData.description || !formData.amount}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {createCost.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
