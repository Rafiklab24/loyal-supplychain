/**
 * Merged Component: Delivery & Payment Terms
 * Combines Commercial Terms from Shipment Wizard + Terms & Payment from Contract Wizard
 * Used in both Contract and Shipment wizards
 */

import { useTranslation } from 'react-i18next';
import { TruckIcon, PlusIcon, TrashIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { DateInput } from './DateInput';

// Type definitions for the component based on which wizard is using it
type WizardMode = 'contract' | 'shipment';

interface DeliveryPaymentTermsProps {
  mode: WizardMode;
  formData: any; // Generic to support both wizard types
  onChange: (...args: any[]) => void; // Generic onChange handler
  onArrayChange?: (...args: any[]) => void;
  onArrayAdd?: (...args: any[]) => void;
  onArrayRemove?: (...args: any[]) => void;
  errors?: any;
}

// Constants
const INCOTERMS_OPTIONS = [
  { value: 'EXW', label: 'EXW - Ex Works' },
  { value: 'FCA', label: 'FCA - Free Carrier' },
  { value: 'FAS', label: 'FAS - Free Alongside Ship' },
  { value: 'FOB', label: 'FOB - Free on Board' },
  { value: 'CFR', label: 'CFR - Cost and Freight' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
  { value: 'CPT', label: 'CPT - Carriage Paid To' },
  { value: 'CIP', label: 'CIP - Carriage and Insurance Paid To' },
  { value: 'DAP', label: 'DAP - Delivered at Place' },
  { value: 'DPU', label: 'DPU - Delivered at Place Unloaded' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'TRY', label: 'TRY - Turkish Lira' },
];

// Standardized international trade payment methods
const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقداً', labelEn: 'Cash' },
  { value: 'bank_transfer', label: 'تحويل بنكي', labelEn: 'Bank Transfer' },
  { value: 'letter_of_credit', label: 'اعتماد مستندي (LC)', labelEn: 'Letter of Credit (LC)' },
  { value: 'documentary_collection', label: 'تحصيل مستندي (CAD/DAP)', labelEn: 'Documentary Collection (CAD/DAP)' },
  { value: 'open_account', label: 'حساب مفتوح', labelEn: 'Open Account' },
  { value: 'advance_payment', label: 'دفعة مقدمة', labelEn: 'Advance Payment' },
  { value: 'partial_advance', label: 'مقدم + رصيد', labelEn: 'Partial Advance + Balance' },
  { value: 'swift', label: 'SWIFT Transfer', labelEn: 'SWIFT Transfer' }, // Legacy
  { value: 'other', label: 'أخرى', labelEn: 'Other' },
];

const PAYMENT_TERM_DAYS_OPTIONS = [
  { value: 30, label: 'صافي 30 يوم', labelEn: 'Net 30 days' },
  { value: 60, label: 'صافي 60 يوم', labelEn: 'Net 60 days' },
  { value: 90, label: 'صافي 90 يوم', labelEn: 'Net 90 days' },
  { value: 120, label: 'صافي 120 يوم', labelEn: 'Net 120 days' },
];

const LC_TYPES = [
  { value: 'sight', label: 'عند الاطلاع (Sight)', labelEn: 'At Sight' },
  { value: 'usance', label: 'آجل (Usance)', labelEn: 'Usance/Deferred' },
];

export function DeliveryPaymentTerms({ mode, formData, onChange, onArrayChange, onArrayAdd, onArrayRemove, errors = {} }: DeliveryPaymentTermsProps) {
  const { t } = useTranslation();

  // Safety check: Ensure formData.terms exists for contract mode
  if (mode === 'contract' && !formData.terms) {
    console.error('❌ DeliveryPaymentTerms: formData.terms is undefined in contract mode!', formData);
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 font-semibold">Error: Contract terms data is not initialized</p>
        <p className="text-sm text-red-600 mt-2">formData.terms is undefined. Please check the contract wizard setup.</p>
      </div>
    );
  }

  // Helper functions for handling changes based on wizard mode
  const handleFieldChange = (field: string, value: any) => {
    if (mode === 'contract') {
      // Contract wizard: onChange('terms', field, value)
      onChange('terms', field, value);
    } else {
      // Shipment wizard: onChange(field, value)
      onChange(field, value);
    }
  };

  const handleArrayFieldChange = (field: string, index: number, subField: string, value: any) => {
    if (mode === 'contract' && onArrayChange) {
      onArrayChange('terms', field, index, subField, value);
    }
  };

  const handleAddClause = () => {
    if (mode === 'contract' && onArrayAdd) {
      const newClause = {
        id: `temp-${Date.now()}`,
        type: 'other',
        description: '',
      };
      onArrayAdd('terms', 'special_clauses', newClause);
    }
  };

  const handleRemoveClause = (index: number) => {
    if (mode === 'contract' && onArrayRemove) {
      onArrayRemove('terms', 'special_clauses', index);
    }
  };

  // Get values based on wizard mode
  const getData = (field: string) => {
    if (mode === 'contract') {
      return formData.terms?.[field];
    } else {
      return formData[field];
    }
  };

  // Cargo type checks (work for both modes)
  const cargoType = getData('cargo_type');
  const tankerType = getData('tanker_type');
  const isTanker = cargoType === 'tankers';
  const isCrudeOil = isTanker && tankerType === 'crude_oil';
  const isLPG = isTanker && tankerType === 'lpg';
  // Show USD equivalent for both contract and shipment wizards when currency is not USD
  const showUsdEquivalent = getData('currency_code') && getData('currency_code') !== 'USD';
  const specialClauses = mode === 'contract' ? (formData.terms?.special_clauses || []) : [];

  return (
    <div className="space-y-6">
      {/* Header - data-field-name="terms" for section-level field highlighting */}
      <div data-field-name="terms" className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
        <div className="flex items-center gap-3 mb-2">
          <TruckIcon className="h-7 w-7 text-purple-600" />
          <h3 className="text-xl font-bold text-purple-900">
            {t('common.deliveryPaymentTerms', 'Delivery & Payment Terms')}
          </h3>
        </div>
        <p className="text-sm text-purple-700">
          {t('common.deliveryPaymentTermsDesc', 'Cargo details, delivery terms, payment conditions, and special clauses')}
        </p>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        
        {/* Section 1: Cargo Details (Both Wizards) */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            {t('common.cargoDetails', 'Cargo Details')}
          </h4>
            
            {/* Cargo Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('shipments.wizard.cargoType', 'Cargo Type')} <span className="text-red-500">*</span>
              </label>
              <select
                data-field-name="cargo_type"
                value={getData('cargo_type') || ''}
                onChange={(e) => {
                  handleFieldChange('cargo_type', e.target.value || undefined);
                  // Reset tanker-specific fields when changing cargo type
                  if (e.target.value !== 'tankers') {
                    handleFieldChange('tanker_type', undefined);
                    handleFieldChange('barrels', '');
                  }
                }}
                className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  errors.cargo_type ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">{t('shipments.wizard.selectCargoType', 'Select cargo type')}</option>
                <option value="general_cargo">{t('shipments.wizard.cargoTypes.generalCargo', 'General Cargo')}</option>
                <option value="tankers">{t('shipments.wizard.cargoTypes.tankers', 'Tankers')}</option>
                <option value="containers">{t('shipments.wizard.cargoTypes.containers', 'Freight Containers')}</option>
                <option value="trucks">{t('shipments.wizard.cargoTypes.trucks', 'Trucks')}</option>
              </select>
              {errors.cargo_type && (
                <p className="mt-1 text-sm text-red-600">{errors.cargo_type}</p>
              )}
            </div>

            {/* Tanker Type */}
            {isTanker && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shipments.wizard.tankerType', 'Tanker Type')} <span className="text-red-500">*</span>
                </label>
                <select
                  data-field-name="tanker_type"
                  value={getData('tanker_type') || ''}
                  onChange={(e) => {
                    handleFieldChange('tanker_type', e.target.value || undefined);
                    handleFieldChange('barrels', '');
                    handleFieldChange('weight_ton', '');
                  }}
                  className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.tanker_type ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">{t('shipments.wizard.selectTankerType', 'Select tanker type')}</option>
                  <option value="crude_oil">{t('shipments.wizard.tankerTypes.crudeOil', 'Crude Oil')}</option>
                  <option value="lpg">{t('shipments.wizard.tankerTypes.lpg', 'LPG (Liquefied Petroleum Gas)')}</option>
                </select>
                {errors.tanker_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.tanker_type}</p>
                )}
              </div>
            )}

            {/* Truck Count (Required when cargo_type = 'trucks') */}
            {cargoType === 'trucks' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shipments.wizard.truckCount', 'عدد الشاحنات')} <span className="text-red-500">*</span>
                </label>
                <input
                  data-field-name="truck_count"
                  type="number"
                  min="1"
                  step="1"
                  value={getData('truck_count') || ''}
                  onChange={(e) => handleFieldChange('truck_count', e.target.value ? Number(e.target.value) : '')}
                  className={`w-full md:w-1/2 px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.truck_count ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="1"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('shipments.wizard.truckCountHint', 'أدخل عدد الشاحنات المطلوبة للشحنة')}
                </p>
                {errors.truck_count && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <ExclamationCircleIcon className="h-4 w-4" />
                    {errors.truck_count}
                  </p>
                )}
              </div>
            )}

            {/* Quantity Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Barrels (Crude Oil) */}
              {isCrudeOil && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipments.wizard.barrels', 'Barrels')}
                  </label>
                  <input
                    data-field-name="barrels"
                    type="number"
                    min="0"
                    step="0.01"
                    value={getData('barrels') || ''}
                    onChange={(e) => handleFieldChange('barrels', e.target.value ? Number(e.target.value) : '')}
                    className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.barrels ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {errors.barrels && (
                    <p className="mt-1 text-sm text-red-600">{errors.barrels}</p>
                  )}
                </div>
              )}

              {/* Weight (LPG or other cargo types) */}
              {(isLPG || (!isTanker && cargoType)) && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      {t('shipments.weight')}
                    </label>
                    <span className="text-gray-400">-</span>
                    <select
                      data-field-name="weight_unit"
                      value={getData('weight_unit') || 'tons'}
                      onChange={(e) => {
                        handleFieldChange('weight_unit', e.target.value);
                        if (e.target.value !== 'other') {
                          handleFieldChange('weight_unit_custom', '');
                        }
                      }}
                      className="text-sm font-medium text-gray-700 border-0 border-b border-gray-300 focus:ring-0 focus:border-purple-500 bg-transparent cursor-pointer hover:border-purple-500 transition-colors px-1 py-0"
                    >
                      <option value="tons">{t('shipments.wizard.weightUnits.tons', 'Metric Tons')}</option>
                      <option value="kg">{t('shipments.wizard.weightUnits.kg', 'Kilograms (KG)')}</option>
                      <option value="other">{t('shipments.wizard.weightUnits.other', 'Other')}</option>
                    </select>
                  </div>
                  
                  {getData('weight_unit') === 'other' && (
                    <div className="mb-2">
                      <input
                        type="text"
                        value={getData('weight_unit_custom') || ''}
                        onChange={(e) => handleFieldChange('weight_unit_custom', e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder={t('shipments.wizard.customWeightUnitPlaceholder', 'Enter custom unit (e.g., lbs, barrels)')}
                      />
                    </div>
                  )}
                  
                  <input
                    data-field-name="weight_ton"
                    type="number"
                    min="0"
                    step="0.01"
                    value={getData('weight_ton') || ''}
                    onChange={(e) => handleFieldChange('weight_ton', e.target.value ? Number(e.target.value) : '')}
                    className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.weight_ton ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {errors.weight_ton && (
                    <p className="mt-1 text-sm text-red-600">{errors.weight_ton}</p>
                  )}
                </div>
              )}

              {/* Units/Containers */}
              {(cargoType === 'general_cargo' || cargoType === 'containers') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {cargoType === 'general_cargo' 
                      ? t('shipments.wizard.units', 'Units')
                      : t('shipments.containers')}
                  </label>
                  {cargoType === 'general_cargo' && (
                    <p className="text-xs text-gray-500 mb-2">
                      {t('shipments.wizard.unitsHint', 'Number of units (bags, boxes, pallets, etc.) - Optional')}
                    </p>
                  )}
                  <input
                    data-field-name="container_count"
                    type="number"
                    min="0"
                    value={getData('container_count') || ''}
                    onChange={(e) => handleFieldChange('container_count', e.target.value ? Number(e.target.value) : '')}
                    className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.container_count ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.container_count && (
                    <p className="mt-1 text-sm text-red-600">{errors.container_count}</p>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* Section 2: Delivery Terms */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            {t('contracts.deliveryTerms', 'Delivery Terms')}
          </h4>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.incoterm', 'Incoterm')} <span className="text-red-500">*</span>
            </label>
            <select
              data-field-name={mode === 'contract' ? 'incoterm' : 'incoterms'}
              value={getData('incoterm') || getData('incoterms') || ''}
              onChange={(e) => handleFieldChange(mode === 'contract' ? 'incoterm' : 'incoterms', e.target.value)}
              className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                (errors.incoterm || errors.incoterms) ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            >
              <option value="">{t('common.select', 'Select...')}</option>
              {INCOTERMS_OPTIONS.map((term) => (
                <option key={term.value} value={term.value}>
                  {term.label}
                </option>
              ))}
            </select>
            {(errors.incoterm || errors.incoterms) && (
              <p className="mt-1 text-sm text-red-600">{errors.incoterm || errors.incoterms}</p>
            )}
          </div>
          
          {/* Delivery Terms Detail (Contract mode only) */}
          {mode === 'contract' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('contracts.deliveryTermsDetail', 'Delivery Terms Detail')} <span className="text-red-500">*</span>
              </label>
              <input
                data-field-name="delivery_terms_detail"
                type="text"
                value={getData('delivery_terms_detail') || ''}
                onChange={(e) => handleFieldChange('delivery_terms_detail', e.target.value)}
                className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  errors.delivery_terms_detail ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., CIF MERSIN, TURKEY"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('contracts.deliveryTermsHint', 'Full delivery terms including destination')}
              </p>
              {errors.delivery_terms_detail && (
                <p className="mt-1 text-sm text-red-600">{errors.delivery_terms_detail}</p>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Payment Terms */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            {t('contracts.paymentTerms', 'Payment Terms')}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {/* Currency - Only show in contract mode (shipments inherit from commercial terms) */}
            {mode === 'contract' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('contracts.currency', 'Currency')} <span className="text-red-500">*</span>
                </label>
                <select
                  data-field-name="currency_code"
                  value={getData('currency_code') || 'USD'}
                  onChange={(e) => handleFieldChange('currency_code', e.target.value)}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={mode === 'contract' ? '' : 'md:col-span-2'}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('contracts.paymentMethod', 'طريقة الدفع / Payment Method')}
              </label>
              <select
                data-field-name="payment_method"
                value={getData('payment_method') || ''}
                onChange={(e) => {
                  handleFieldChange('payment_method', e.target.value || undefined);
                  // Clear conditional fields when payment method changes
                  if (e.target.value !== 'letter_of_credit') {
                    handleFieldChange('lc_number', '');
                    handleFieldChange('lc_issuing_bank', '');
                    handleFieldChange('lc_type', '');
                    handleFieldChange('lc_expiry_date', '');
                  }
                  if (!['bank_transfer', 'open_account', 'swift'].includes(e.target.value)) {
                    handleFieldChange('transfer_reference', '');
                  }
                  if (!['bank_transfer', 'open_account'].includes(e.target.value)) {
                    handleFieldChange('payment_term_days', '');
                  }
                }}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">{t('common.select', 'اختر...')}</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label} / {method.labelEn}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {t('contracts.paymentMethodHint', 'حدد طريقة الدفع المتفق عليها')}
              </p>
            </div>
          </div>

          {/* Conditional Sub-fields based on Payment Method */}
          
          {/* Letter of Credit (LC) Fields */}
          {getData('payment_method') === 'letter_of_credit' && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-900 mb-3">
                {t('contracts.lcDetails', 'تفاصيل الاعتماد المستندي / LC Details')}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contracts.lcNumber', 'رقم الاعتماد / LC Number')}
                  </label>
                  <input
                    data-field-name="lc_number"
                    type="text"
                    value={getData('lc_number') || ''}
                    onChange={(e) => handleFieldChange('lc_number', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="LC-2025-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contracts.lcIssuingBank', 'البنك المصدر / Issuing Bank')}
                  </label>
                  <input
                    data-field-name="lc_issuing_bank"
                    type="text"
                    value={getData('lc_issuing_bank') || ''}
                    onChange={(e) => handleFieldChange('lc_issuing_bank', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('contracts.bankNamePlaceholder', 'اسم البنك')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contracts.lcType', 'نوع الاعتماد / LC Type')}
                  </label>
                  <select
                    data-field-name="lc_type"
                    value={getData('lc_type') || ''}
                    onChange={(e) => handleFieldChange('lc_type', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t('common.select', 'اختر...')}</option>
                    {LC_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contracts.lcExpiryDate', 'تاريخ انتهاء الصلاحية / Expiry Date')}
                  </label>
                  <DateInput
                    value={getData('lc_expiry_date') || ''}
                    onChange={(val) => handleFieldChange('lc_expiry_date', val)}
                    className="w-full border-gray-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bank Transfer / SWIFT Fields - Hide for outgoing (selling) shipments as they use BankAccountSelector */}
          {['bank_transfer', 'swift'].includes(getData('payment_method') || '') && 
           getData('transaction_type') !== 'outgoing' && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h5 className="text-sm font-semibold text-green-900 mb-3">
                {t('contracts.transferDetails', 'تفاصيل التحويل / Transfer Details')}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contracts.beneficiaryBankName', 'اسم البنك / Bank Name')}
                  </label>
                  <input
                    data-field-name="beneficiary_bank_name"
                    type="text"
                    value={getData('beneficiary_bank_name') || ''}
                    onChange={(e) => handleFieldChange('beneficiary_bank_name', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder={t('contracts.bankNamePlaceholder', 'اسم البنك')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contracts.beneficiaryName', 'اسم المستفيد / Beneficiary')}
                  </label>
                  <input
                    data-field-name="beneficiary_name"
                    type="text"
                    value={getData('beneficiary_name') || ''}
                    onChange={(e) => handleFieldChange('beneficiary_name', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder={t('contracts.beneficiaryPlaceholder', 'اسم المستفيد')}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contracts.transferReference', 'مرجع التحويل / Reference')} <span className="text-gray-400">(اختياري)</span>
                  </label>
                  <input
                    data-field-name="transfer_reference"
                    type="text"
                    value={getData('transfer_reference') || ''}
                    onChange={(e) => handleFieldChange('transfer_reference', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="TRF-2025-001"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Payment Term Days (for Open Account, Bank Transfer) */}
          {['open_account', 'bank_transfer'].includes(getData('payment_method') || '') && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h5 className="text-sm font-semibold text-amber-900 mb-3">
                {t('contracts.paymentTermDays', 'مدة السداد / Payment Term')}
              </h5>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('contracts.netDays', 'صافي الأيام / Net Days')}
                </label>
                <select
                  data-field-name="payment_term_days"
                  value={getData('payment_term_days') || ''}
                  onChange={(e) => handleFieldChange('payment_term_days', e.target.value ? Number(e.target.value) : '')}
                  className="w-full md:w-1/2 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">{t('common.select', 'اختر...')}</option>
                  {PAYMENT_TERM_DAYS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-amber-700">
                  {t('contracts.paymentTermDaysHint', 'عدد الأيام من تاريخ الفاتورة حتى السداد')}
                </p>
              </div>
            </div>
          )}

          {/* USD Equivalent Field - Only show in contract mode and when currency is not USD */}
          {mode === 'contract' && showUsdEquivalent && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <ExclamationCircleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-yellow-900 mb-2">
                    {t('contracts.usdEquivalent', 'USD Equivalent')}
                  </label>
                  <input
                    type="number"
                    value={getData('usd_equivalent_rate') || ''}
                    onChange={(e) => handleFieldChange('usd_equivalent_rate', parseFloat(e.target.value) || undefined)}
                    className="w-full md:w-1/2 px-4 py-2 text-base border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white"
                    placeholder="1.00"
                    step="0.0001"
                  />
                  <p className="mt-2 text-xs text-yellow-800">
                    {t('contracts.usdEquivalentHint', 'Enter the USD exchange rate for record-keeping (e.g., if 1 INR = 0.012 USD)')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.paymentTermsDetail', 'تفاصيل شروط الدفع / Payment Terms Detail')} <span className="text-red-500">*</span>
            </label>
            <textarea
              data-field-name="payment_terms"
              value={getData('payment_terms') || ''}
              onChange={(e) => handleFieldChange('payment_terms', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              placeholder="30 DAYS FROM ARRIVAL AT DESTINATION, CIF MERSIN, TURKEY"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('contracts.paymentTermsHint', 'شروط الدفع الكاملة بما في ذلك الجدول الزمني')}
            </p>
          </div>
        </div>

        {/* Section 4: Special Clauses (Contract Wizard Only) */}
        {mode === 'contract' && (
          <div data-field-name="special_clauses">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">
                {t('contracts.specialClauses', 'Special Clauses')}
              </h4>
              <button
                type="button"
                onClick={handleAddClause}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                {t('contracts.addClause', 'Add Clause')}
              </button>
            </div>

            {specialClauses.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600 mb-2">
                  {t('contracts.noClausesAdded', 'No special clauses added yet.')}
                </p>
                <p className="text-sm text-gray-500">
                  {t('contracts.addClauseHint', 'Add tolerance, payment conditions, or custom terms')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {specialClauses.map((clause: any, index: number) => (
                  <div key={clause.id || index} className="bg-gradient-to-r from-gray-50 to-blue-50 p-5 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-4">
                      <h5 className="text-sm font-semibold text-gray-900">
                        {t('contracts.clause', 'Clause')} #{index + 1}
                      </h5>
                      <button
                        type="button"
                        onClick={() => handleRemoveClause(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title={t('common.delete', 'Delete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('contracts.clauseType', 'Type')}
                        </label>
                        <select
                          value={clause.type}
                          onChange={(e) => handleArrayFieldChange('special_clauses', index, 'type', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="tolerance">{t('contracts.clauseTypes.tolerance', 'Tolerance (+/- %)')}</option>
                          <option value="payment_condition">{t('contracts.clauseTypes.paymentCondition', 'Payment Condition')}</option>
                          <option value="quality_standard">{t('contracts.clauseTypes.qualityStandard', 'Quality Standard')}</option>
                          <option value="inspection">{t('contracts.clauseTypes.inspection', 'Inspection')}</option>
                          <option value="penalty">{t('contracts.clauseTypes.penalty', 'Penalty/Late Fee')}</option>
                          <option value="other">{t('contracts.clauseTypes.other', 'Other')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('contracts.description', 'Description')}
                        </label>
                        <textarea
                          data-field-name="description"
                          value={clause.description}
                          onChange={(e) => handleArrayFieldChange('special_clauses', index, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          placeholder={t('contracts.clauseDescriptionPlaceholder', 'Enter clause details...')}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

