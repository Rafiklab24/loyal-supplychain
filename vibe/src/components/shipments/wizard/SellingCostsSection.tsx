/**
 * Selling Costs Section Component
 * Displays sea or land transport costs based on transport mode
 * Used in the selling workflow when transaction_type = 'outgoing'
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  TruckIcon, 
  GlobeAltIcon, 
  CurrencyDollarIcon,
  CalculatorIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import type { ShipmentFormData } from './types';
import { getCurrencySymbol, type CurrencyCode } from '../../contracts/wizard/units';

interface SellingCostsSectionProps {
  formData: ShipmentFormData;
  onChange: (field: keyof ShipmentFormData, value: any) => void;
  errors?: Partial<Record<keyof ShipmentFormData, string>>;
}

// Cost field configuration
interface CostField {
  key: keyof ShipmentFormData;
  label: string;
  labelAr?: string;
  hint?: string;
  hintAr?: string;
  isSpecial?: boolean; // For fields with special handling (e.g., DHL dropdown)
}

// Available currencies for costs
const COST_CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD - دولار أمريكي' },
  { code: 'TRY', symbol: '₺', label: 'TRY - ليرة تركية' },
  { code: 'EUR', symbol: '€', label: 'EUR - يورو' },
  { code: 'INR', symbol: '₹', label: 'INR - روبية هندية' },
  { code: 'BRL', symbol: 'R$', label: 'BRL - ريال برازيلي' },
];

// Port Handling service types with predefined costs
const PORT_HANDLING_SERVICES = [
  { value: 'standard', label: 'Standard Port Handling', labelAr: 'مناولة الميناء القياسية' },
  { value: 'dhl', label: 'DHL Express', labelAr: 'DHL السريع' },
  { value: 'custom', label: 'Custom Amount', labelAr: 'مبلغ مخصص' },
];

const SEA_COSTS: CostField[] = [
  { key: 'vgm_cost', label: 'VGM (Verified Gross Mass)', hint: 'Container weight verification fee', hintAr: 'رسوم التحقق من وزن الحاوية' },
  { key: 'fumigation_cost', label: 'Fumigation (İlaçlama)', hint: 'Pest control treatment cost', hintAr: 'تكلفة معالجة مكافحة الآفات' },
  { key: 'container_loading_cost', label: 'Container Loading', hint: 'Loading goods into container', hintAr: 'تحميل البضائع في الحاوية' },
  { key: 'port_handling_cost', label: 'DHL / Port Handling', hint: 'Port terminal or DHL charges', hintAr: 'رسوم الميناء أو DHL', isSpecial: true },
  { key: 'sea_freight_cost', label: 'Navlun / Sea Freight (All in)', hint: 'All-inclusive ocean shipping cost', hintAr: 'تكلفة الشحن البحري الشاملة' },
  { key: 'customs_export_cost', label: 'Customs Export', hint: 'Export customs clearance fees', hintAr: 'رسوم التخليص الجمركي للتصدير' },
  { key: 'sea_insurance_cost', label: 'Marine Insurance', hint: 'Cargo insurance for sea transport', hintAr: 'تأمين البضائع للنقل البحري' },
];

const LAND_COSTS: CostField[] = [
  { key: 'truck_transport_cost', label: 'Truck Transport', hint: 'Road freight cost', hintAr: 'تكلفة الشحن البري' },
  { key: 'loading_unloading_cost', label: 'Loading/Unloading', hint: 'Cargo handling fees', hintAr: 'رسوم مناولة البضائع' },
  { key: 'border_crossing_cost', label: 'Border Crossing', hint: 'Border fees and documentation', hintAr: 'رسوم الحدود والتوثيق' },
  { key: 'land_customs_cost', label: 'Customs Clearance', hint: 'Land customs fees', hintAr: 'رسوم الجمارك البرية' },
  { key: 'transit_fees_cost', label: 'Transit Fees', hint: 'Transit country charges', hintAr: 'رسوم دول العبور' },
  { key: 'land_insurance_cost', label: 'Land Insurance', hint: 'Cargo insurance for land transport', hintAr: 'تأمين البضائع للنقل البري' },
];

export function SellingCostsSection({ formData, onChange, errors }: SellingCostsSectionProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [portHandlingService, setPortHandlingService] = useState<string>('custom');
  
  const transportMode = formData.transport_mode || 'sea';
  const costs = transportMode === 'land' ? LAND_COSTS : SEA_COSTS;
  
  // Get selected cost currency (separate from payment currency)
  const costCurrency = (formData.selling_cost_currency || formData.payment_currency || 'USD') as CurrencyCode;
  const currencySymbol = getCurrencySymbol(costCurrency);
  
  // Calculate total selling costs
  const calculateTotal = (): number => {
    const allCostFields = [...SEA_COSTS, ...LAND_COSTS];
    return allCostFields.reduce((total, field) => {
      const value = formData[field.key];
      return total + (typeof value === 'number' ? value : parseFloat(value as string) || 0);
    }, 0);
  };
  
  const totalCosts = calculateTotal();
  
  // Update total when any cost changes
  const handleCostChange = (field: keyof ShipmentFormData, value: string) => {
    const numValue = value === '' ? '' : parseFloat(value) || 0;
    onChange(field, numValue);
    
    // Recalculate total
    setTimeout(() => {
      const newTotal = calculateTotal();
      onChange('total_selling_costs', newTotal);
    }, 0);
  };

  // Handle port handling service type change
  const handlePortHandlingServiceChange = (serviceType: string) => {
    setPortHandlingService(serviceType);
    // If custom, keep the existing value; otherwise could set defaults
  };

  // Handle currency change
  const handleCurrencyChange = (currency: string) => {
    onChange('selling_cost_currency', currency);
  };

  return (
    <div className="space-y-6">
      {/* Currency Selection */}
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <BanknotesIcon className="h-5 w-5 text-purple-600" />
          <label className="block text-sm font-medium text-gray-900">
            {isRtl ? 'عملة التكاليف' : 'Cost Currency'} <span className="text-red-500">*</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {COST_CURRENCIES.map((currency) => (
            <button
              key={currency.code}
              type="button"
              onClick={() => handleCurrencyChange(currency.code)}
              className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                costCurrency === currency.code
                  ? 'border-purple-600 bg-purple-100 text-purple-800'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300'
              }`}
            >
              <span className="text-lg me-1">{currency.symbol}</span>
              <span className="text-sm">{currency.code}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-purple-700 mt-2">
          {isRtl ? 'اختر العملة لجميع تكاليف البيع أدناه' : 'Select currency for all selling costs below'}
        </p>
      </div>

      {/* Transport Mode Selection */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-900 mb-3">
          {t('selling.transportMode', isRtl ? 'وضع النقل' : 'Transport Mode')} <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            transportMode === 'sea' 
              ? 'border-blue-600 bg-blue-100' 
              : 'border-gray-300 bg-white hover:border-blue-300'
          }`}>
            <input
              type="radio"
              value="sea"
              checked={transportMode === 'sea'}
              onChange={(e) => onChange('transport_mode', e.target.value)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <GlobeAltIcon className="h-5 w-5 ms-3 text-blue-600" />
            <span className="ms-2 text-sm font-medium text-gray-900">
              🚢 {isRtl ? 'النقل البحري (Deniz Yolu)' : 'Sea Transport (Deniz Yolu)'}
            </span>
          </label>
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            transportMode === 'land' 
              ? 'border-green-600 bg-green-100' 
              : 'border-gray-300 bg-white hover:border-green-300'
          }`}>
            <input
              type="radio"
              value="land"
              checked={transportMode === 'land'}
              onChange={(e) => onChange('transport_mode', e.target.value)}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
            />
            <TruckIcon className="h-5 w-5 ms-3 text-green-600" />
            <span className="ms-2 text-sm font-medium text-gray-900">
              🚛 {isRtl ? 'النقل البري (Kara Yolu)' : 'Land Transport (Kara Yolu)'}
            </span>
          </label>
        </div>
      </div>

      {/* Cost Fields */}
      <div className={`border rounded-lg p-4 ${
        transportMode === 'sea' 
          ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200' 
          : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'
      }`}>
        <div className="flex items-center gap-2 mb-4">
          <CurrencyDollarIcon className={`h-5 w-5 ${transportMode === 'sea' ? 'text-cyan-600' : 'text-emerald-600'}`} />
          <h4 className="text-sm font-semibold text-gray-900">
            {transportMode === 'sea' 
              ? (isRtl ? 'تكاليف النقل البحري' : 'Sea Transport Costs')
              : (isRtl ? 'تكاليف النقل البري' : 'Land Transport Costs')
            }
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {costs.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t(`selling.costs.${field.key}`, field.label)}
              </label>
              
              {/* Special handling for DHL/Port Handling field */}
              {field.isSpecial && field.key === 'port_handling_cost' ? (
                <div className="space-y-2">
                  <select
                    value={portHandlingService}
                    onChange={(e) => handlePortHandlingServiceChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {PORT_HANDLING_SERVICES.map((service) => (
                      <option key={service.value} value={service.value}>
                        {isRtl ? service.labelAr : service.label}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <span className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 text-sm`}>{currencySymbol}</span>
                    <input
                      type="number"
                      value={formData[field.key] as string | number || ''}
                      onChange={(e) => handleCostChange(field.key, e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={`w-full ${isRtl ? 'pr-7 pl-4' : 'pl-7 pr-4'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    />
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <span className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 text-sm`}>{currencySymbol}</span>
                  <input
                    type="number"
                    value={formData[field.key] as string | number || ''}
                    onChange={(e) => handleCostChange(field.key, e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`w-full ${isRtl ? 'pr-7 pl-4' : 'pl-7 pr-4'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  />
                </div>
              )}
              
              {field.hint && (
                <p className="mt-1 text-xs text-gray-500">{isRtl && field.hintAr ? field.hintAr : field.hint}</p>
              )}
            </div>
          ))}
        </div>

        {/* Total Costs Summary */}
        <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalculatorIcon className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                {isRtl ? 'إجمالي تكاليف البيع' : 'Total Selling Costs'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">
                {currencySymbol}{totalCosts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {costCurrency}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Notes for Costs */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {isRtl ? 'ملاحظات التكلفة / المراجع' : 'Cost Notes / References'}
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={3}
          placeholder={isRtl ? 'أضف أي ملاحظات حول التكاليف، مراجع الفواتير، أو الترتيبات الخاصة...' : 'Add any notes about costs, invoice references, or special arrangements...'}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

