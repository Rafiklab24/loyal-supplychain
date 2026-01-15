import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCustomsClearingCost, useCustomsClearingCostMutations } from '../../hooks/useCustomsClearingCosts';
import type { CustomsClearingCost } from '../../types/api';
import { DateInput } from '../common/DateInput';

interface CustomsClearingCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  costId: string | null;
}

const CustomsClearingCostModal: React.FC<CustomsClearingCostModalProps> = ({
  isOpen,
  onClose,
  costId,
}) => {
  const { t } = useTranslation();
  const isEdit = Boolean(costId);
  
  // Fetch existing data if editing
  const { data: existingData, loading: loadingData } = useCustomsClearingCost(costId);
  const { create, update, loading, error } = useCustomsClearingCostMutations();

  // Form state - using NEW fields only
  const [formData, setFormData] = useState<Partial<CustomsClearingCost>>({
    file_number: '',
    transaction_type: '',
    goods_type: '',
    containers_cars_count: '',
    goods_weight: '',
    cost_description: '',
    clearance_type: 'inbound',
    payment_status: 'pending',
    currency: 'USD',
    total_clearing_cost: 0,
    original_clearing_amount: undefined,
    extra_cost_amount: undefined,
    cost_responsibility: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load existing data when editing
  useEffect(() => {
    if (existingData && isEdit) {
      // Migrate old data to new fields if needed
      const migratedData = { ...existingData };
      
      // If old fields have data but new field doesn't, migrate
      if (!migratedData.original_clearing_amount && 
          (migratedData.cost_paid_by_company || migratedData.cost_paid_by_fb)) {
        migratedData.original_clearing_amount = 
          migratedData.cost_paid_by_company || migratedData.cost_paid_by_fb || undefined;
        migratedData.cost_responsibility = 
          migratedData.cost_paid_by_company ? 'company' : 
          migratedData.cost_paid_by_fb ? 'final_beneficiary' : '';
      }
      
      setFormData(migratedData);
    }
  }, [existingData, isEdit]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        file_number: '',
        transaction_type: '',
        goods_type: '',
        containers_cars_count: '',
        goods_weight: '',
        cost_description: '',
        clearance_type: 'inbound',
        payment_status: 'pending',
        currency: 'USD',
        total_clearing_cost: 0,
        original_clearing_amount: undefined,
        extra_cost_amount: undefined,
        cost_responsibility: '',
      });
      setFormErrors({});
    }
  }, [isOpen]);

  // Handle input change
  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Auto-calculate total if cost fields change
    if (['original_clearing_amount', 'extra_cost_amount'].includes(field)) {
      calculateTotal({
        ...formData,
        [field]: value,
      });
    }
  };

  // Calculate total clearing cost (NEW simplified logic)
  const calculateTotal = (data: Partial<CustomsClearingCost>) => {
    const original = Number(data.original_clearing_amount) || 0;
    const extra = Number(data.extra_cost_amount) || 0;
    const total = original + extra;
    
    setFormData((prev) => ({ ...prev, total_clearing_cost: total }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.file_number?.trim()) {
      errors.file_number = t('customsClearingCosts.requiredField');
    }

    const original = Number(formData.original_clearing_amount) || 0;
    const extra = Number(formData.extra_cost_amount) || 0;

    // At least one cost must be specified
    if (original === 0 && extra === 0) {
      errors.original_clearing_amount = t('customsClearingCosts.atLeastOneCost');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Prepare data - ensure we're using new fields
      const submitData = {
        ...formData,
        // Clear deprecated fields
        cost_paid_by_company: undefined,
        cost_paid_by_fb: undefined,
      };

      if (isEdit && costId) {
        await update(costId, submitData);
      } else {
        await create(submitData);
      }
      onClose();
    } catch (err) {
      console.error('Error saving customs clearing cost:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? t('customsClearingCosts.edit') : t('customsClearingCosts.addNew')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6">
            {loadingData ? (
              <div className="text-center py-8">
                <div className="text-gray-500 dark:text-gray-400">Loading...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Row 1: File Number, Clearance Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.fileNumber')} *
                    </label>
                    <input
                      type="text"
                      value={formData.file_number || ''}
                      onChange={(e) => handleChange('file_number', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                        formErrors.file_number
                          ? 'border-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    {formErrors.file_number && (
                      <p className="text-red-500 text-sm mt-1">{formErrors.file_number}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.clearanceType')}
                    </label>
                    <input
                      type="text"
                      list="clearance-type-modal-suggestions"
                      value={formData.clearance_type || ''}
                      onChange={(e) => handleChange('clearance_type', e.target.value)}
                      placeholder="نوع التخليص"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                    <datalist id="clearance-type-modal-suggestions">
                      <option value="تخليص" />
                      <option value="تحميل" />
                      <option value="تخليص + تحميل" />
                      <option value="إدخالات" />
                      <option value="اخراجات" />
                    </datalist>
                  </div>
                </div>

                {/* Row 2: Transaction Details (5 separate fields) */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    {t('customsClearingCosts.transactionDetails')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('customsClearingCosts.transactionType')}
                      </label>
                      <input
                        type="text"
                        value={formData.transaction_type || ''}
                        onChange={(e) => handleChange('transaction_type', e.target.value)}
                        placeholder={t('customsClearingCosts.transactionTypePlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('customsClearingCosts.goodsType')}
                      </label>
                      <input
                        type="text"
                        value={formData.goods_type || ''}
                        onChange={(e) => handleChange('goods_type', e.target.value)}
                        placeholder={t('customsClearingCosts.goodsTypePlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('customsClearingCosts.containersOrCars')}
                      </label>
                      <input
                        type="text"
                        value={formData.containers_cars_count || ''}
                        onChange={(e) => handleChange('containers_cars_count', e.target.value)}
                        placeholder={t('customsClearingCosts.containersOrCarsPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('customsClearingCosts.goodsWeight')}
                      </label>
                      <input
                        type="text"
                        value={formData.goods_weight || ''}
                        onChange={(e) => handleChange('goods_weight', e.target.value)}
                        placeholder={t('customsClearingCosts.goodsWeightPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('customsClearingCosts.costDescription')}
                      </label>
                      <textarea
                        value={formData.cost_description || ''}
                        onChange={(e) => handleChange('cost_description', e.target.value)}
                        rows={3}
                        placeholder={t('customsClearingCosts.costDescriptionPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Destination, BOL, Car Plate */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.destinationFinalBeneficiary')}
                    </label>
                    <input
                      type="text"
                      value={formData.destination_final_beneficiary || ''}
                      onChange={(e) => handleChange('destination_final_beneficiary', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.bolNumber')}
                    </label>
                    <input
                      type="text"
                      value={formData.bol_number || ''}
                      onChange={(e) => handleChange('bol_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.carPlate')}
                    </label>
                    <input
                      type="text"
                      value={formData.car_plate || ''}
                      onChange={(e) => handleChange('car_plate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Row 4: Costs - NEW SIMPLIFIED LAYOUT */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {t('customsClearingCosts.costBreakdown', 'Cost Breakdown')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Original Clearing Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('customsClearingCosts.originalClearingAmount', 'Original Clearing Cost')} *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.original_clearing_amount || ''}
                          onChange={(e) =>
                            handleChange('original_clearing_amount', e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          placeholder="0.00"
                          className={`w-full pl-8 pr-3 py-2 border rounded-lg dark:bg-gray-600 dark:text-white ${
                            formErrors.original_clearing_amount
                              ? 'border-red-500'
                              : 'border-gray-300 dark:border-gray-500'
                          }`}
                        />
                      </div>
                      {formErrors.original_clearing_amount && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.original_clearing_amount}
                        </p>
                      )}
                    </div>

                    {/* Extra Cost Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('customsClearingCosts.extraCostAmount')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.extra_cost_amount || ''}
                          onChange={(e) =>
                            handleChange('extra_cost_amount', e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          placeholder="0.00"
                          className="w-full pl-8 pr-3 py-2 border border-orange-300 dark:border-orange-500 rounded-lg dark:bg-gray-600 dark:text-white focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>

                    {/* Cost Responsibility */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('customsClearingCosts.costResponsibility', 'Who Pays?')}
                      </label>
                      <select
                        value={formData.cost_responsibility || ''}
                        onChange={(e) => handleChange('cost_responsibility', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white"
                      >
                        <option value="">{t('customsClearingCosts.selectResponsibility', '-- Select --')}</option>
                        <option value="company">{t('customsClearingCosts.company', 'Company')}</option>
                        <option value="final_beneficiary">{t('customsClearingCosts.finalBeneficiary', 'Final Beneficiary')}</option>
                        <option value="shared">{t('customsClearingCosts.shared', 'Shared')}</option>
                        <option value="other">{t('customsClearingCosts.other', 'Other')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.extraCostDescription')}
                    </label>
                    <input
                      type="text"
                      value={formData.extra_cost_description || ''}
                      onChange={(e) => handleChange('extra_cost_description', e.target.value)}
                      placeholder={t('customsClearingCosts.extraCostDescriptionPlaceholder', 'Describe any extra costs...')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white"
                    />
                  </div>

                  {/* Total */}
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.totalClearingCost')}
                    </label>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {(formData.total_clearing_cost || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {formData.currency}
                    </div>
                  </div>
                </div>

                {/* Row 5: Invoice Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.clientName')}
                    </label>
                    <input
                      type="text"
                      value={formData.client_name || ''}
                      onChange={(e) => handleChange('client_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.invoiceNumber')}
                    </label>
                    <input
                      type="text"
                      value={formData.invoice_number || ''}
                      onChange={(e) => handleChange('invoice_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.invoiceAmount')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.invoice_amount || ''}
                      onChange={(e) =>
                        handleChange('invoice_amount', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.currency')}
                    </label>
                    <select
                      value={formData.currency || 'USD'}
                      onChange={(e) => handleChange('currency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="TRY">TRY</option>
                      <option value="AED">AED</option>
                      <option value="SAR">SAR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.invoiceDate')}
                    </label>
                    <DateInput
                      value={formData.invoice_date || ''}
                      onChange={(val) => handleChange('invoice_date', val)}
                      className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('customsClearingCosts.paymentStatus')}
                    </label>
                    <select
                      value={formData.payment_status || 'pending'}
                      onChange={(e) => handleChange('payment_status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                      <option value="pending">{t('customsClearingCosts.pending')}</option>
                      <option value="paid">{t('customsClearingCosts.paid')}</option>
                      <option value="partial">{t('customsClearingCosts.partial')}</option>
                    </select>
                  </div>
                </div>

                {/* Row 6: Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('customsClearingCosts.notes')}
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Error message */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 rounded-lg">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || loadingData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('common.saving', 'Saving...') : isEdit ? t('common.update', 'Update') : t('common.create', 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomsClearingCostModal;
