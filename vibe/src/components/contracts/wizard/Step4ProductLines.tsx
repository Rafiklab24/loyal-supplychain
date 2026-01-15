/**
 * Contract Wizard V2 - Step 4: Product Lines
 * The most important step - matches proforma invoice line structure exactly
 * Auto-calculates quantities and amounts
 * Last updated: 2025-11-18 16:35 - COMPREHENSIVE UNITS SYSTEM
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CubeIcon, PlusIcon, TrashIcon, DocumentDuplicateIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import type { ContractFormData, ProductLine } from './types';
import { PACKAGE_TYPES, PACKAGE_SIZE_PRESETS, PRICING_METHODS, PACKAGE_SIZE_UNITS } from './types';
import { calculateTotalMT } from './units';
import { AutocompleteInput } from '../../common/AutocompleteInput';
import { createTrademark } from '../../../services/trademarks';

// Country options for product origin
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 
  'Brazil', 'Canada', 'China', 'Denmark', 'Egypt', 'France', 'Germany', 'Greece', 'India', 'Indonesia', 'Iran', 
  'Iraq', 'Ireland', 'Italy', 'Japan', 'Jordan', 'Kuwait', 'Lebanon', 'Malaysia', 'Mexico', 
  'Netherlands', 'New Zealand', 'Pakistan', 'Philippines', 'Poland', 'Qatar', 'Russia', 'Saudi Arabia', 'Singapore', 
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland', 'Syria', 'Thailand', 
  'Turkey', 'UAE', 'UK', 'Ukraine', 'USA', 'Vietnam', 'Yemen'
].sort();

// Currency options for pricing
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
];

interface Step4Props {
  data: ContractFormData;
  onArrayChange: (section: keyof ContractFormData, field: string, index: number, subField: string, value: any) => void;
  onArrayAdd: (section: keyof ContractFormData, field: string, item: any) => void;
  onArrayRemove: (section: keyof ContractFormData, field: string, index: number) => void;
}

export function Step4ProductLines({ data, onArrayChange, onArrayAdd, onArrayRemove }: Step4Props) {
  const { t } = useTranslation();
  
  // Track raw input values for unit_price to allow decimal input while typing
  const [unitPriceInputs, setUnitPriceInputs] = useState<Record<number, string>>({});
  
  // Track raw input values for exchange_rate_to_usd to allow decimal input while typing
  const [exchangeRateInputs, setExchangeRateInputs] = useState<Record<number, string>>({});
  
  // Trademark handling - track creation state
  const [creatingTrademark, setCreatingTrademark] = useState<{ lineIndex: number; name: string } | null>(null);
  
  // Handle creating a new trademark
  const handleCreateTrademark = async (name: string, lineIndex: number) => {
    setCreatingTrademark({ lineIndex, name });
    try {
      const newTrademark = await createTrademark({ name });
      // Update the line with the new trademark
      onArrayChange('lines', '', lineIndex, 'trademark', newTrademark.name);
    } catch (error) {
      console.error('Failed to create trademark:', error);
    } finally {
      setCreatingTrademark(null);
    }
  };
  
  // Sync unit price inputs when data changes externally (e.g., on load)
  useEffect(() => {
    const newInputs: Record<number, string> = {};
    data.lines?.forEach((line, index) => {
      if (unitPriceInputs[index] === undefined && line.unit_price) {
        newInputs[index] = String(line.unit_price);
      }
    });
    if (Object.keys(newInputs).length > 0) {
      setUnitPriceInputs(prev => ({ ...prev, ...newInputs }));
    }
  }, [data.lines]);

  // CRITICAL: Safety check FIRST - ensure data.lines is a valid array
  if (!data || !data.lines || !Array.isArray(data.lines)) {
    console.error('❌ Step4ProductLinesV2: data.lines is not a valid array!', { 
      hasData: !!data, 
      hasLines: !!data?.lines, 
      isArray: Array.isArray(data?.lines),
      linesType: typeof data?.lines,
      lines: data?.lines
    });
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 font-semibold">Error: Contract data is not properly initialized</p>
        <p className="text-sm text-red-600 mt-2">data.lines is not an array. Please try refreshing the page or going back to previous step.</p>
      </div>
    );
  }

  const handleAddLine = (packageSize?: number) => {
    const newLine: ProductLine = {
      id: `temp-${Date.now()}`,
      type_of_goods: '',
      kind_of_packages: 'BAGS',
      number_of_packages: 0,
      package_size: packageSize || 25,
      package_size_unit: 'KG', // Default to kilograms
      unit_size: packageSize || 25, // Backward compatibility
      quantity_mt: 0,
      pricing_method: 'per_mt', // Default to per MT
      unit_price: 0,
      rate_usd_per_mt: 0,
      amount_usd: 0,
      country_of_origin: '', // Per-product origin country
    };
    onArrayAdd('lines', 'lines', newLine);
  };

  const handleCopyLine = (index: number) => {
    const lineToCopy = data.lines[index];
    const newLine: ProductLine = {
      ...lineToCopy,
      id: `temp-${Date.now()}`,
    };
    onArrayAdd('lines', 'lines', newLine);
  };

  // Adaptive calculation based on pricing method - COMPREHENSIVE EDITION
  // Now with multi-currency support - calculates in original currency and converts to USD
  const calculateAmount = (line: ProductLine): number => {
    const currency = line.currency_code || 'USD';
    const exchangeRate = Number(line.exchange_rate_to_usd) || 1;
    
    // Calculate amount in original currency
    let originalAmount = 0;
    
    switch (line.pricing_method) {
      // Weight-based pricing
      case 'per_mt':
        originalAmount = line.quantity_mt * line.unit_price;
        break;
      case 'per_kg':
        originalAmount = (line.quantity_kg || line.quantity_mt * 1000) * line.unit_price;
        break;
      case 'per_lb':
        originalAmount = (line.quantity_lb || line.quantity_mt * 2204.62) * line.unit_price;
        break;
      case 'per_ton':
        originalAmount = (line.quantity_ton || line.quantity_mt * 1.10231) * line.unit_price;
        break;
      
      // Package-based pricing
      case 'per_package':
        originalAmount = line.number_of_packages * line.unit_price;
        break;
      case 'per_piece':
        originalAmount = line.number_of_packages * line.unit_price; // Assuming pieces = packages
        break;
      case 'per_pallet':
        originalAmount = (line.number_of_pallets || 0) * line.unit_price;
        break;
      
      // Volume-based pricing
      case 'per_cbm':
        originalAmount = (line.volume_cbm || 0) * line.unit_price;
        break;
      case 'per_liter':
        originalAmount = (line.volume_liters || 0) * line.unit_price;
        break;
      
      // Custom pricing
      case 'total':
        // For manual entry, if currency is not USD, use the original_amount with exchange rate
        if (currency !== 'USD' && line.original_amount) {
          return Number(line.original_amount) * exchangeRate;
        }
        return line.amount_usd; // Manual entry, no calculation
      
      default:
        return 0;
    }
    
    // Convert to USD if not already in USD
    if (currency !== 'USD') {
      return originalAmount * exchangeRate;
    }
    return originalAmount;
  };

  // Calculate Price per MT Equivalent - FOR CFO ANALYSIS
  const calculatePricePerMT = (line: ProductLine): number => {
    const quantityMT = Number(line.quantity_mt) || 0;
    const unitPrice = Number(line.unit_price) || 0;
    const amountUSD = Number(line.amount_usd) || 0;
    
    // If quantity_mt is 0, we can't calculate price per MT
    if (quantityMT <= 0) {
      return 0;
    }
    
    // For weight-based pricing methods, we can directly convert
    switch (line.pricing_method) {
      case 'per_mt':
        return unitPrice;
      case 'per_kg':
        return unitPrice * 1000; // 1 MT = 1000 KG
      case 'per_lb':
        return unitPrice * 2204.62; // 1 MT = 2204.62 LB
      case 'per_ton':
        return unitPrice / 1.10231; // 1 US TON = 0.907 MT (or 1 MT = 1.10231 TON)
      
      // For all other pricing methods, derive from total amount ÷ quantity
      case 'per_package':
      case 'per_piece':
      case 'per_pallet':
      case 'per_cbm':
      case 'per_liter':
      case 'total':
      default:
        return amountUSD / quantityMT;
    }
  };

  // Auto-calculate quantity when packages or size changes - UNIT-AWARE
  const handlePackageChange = (index: number, field: 'number_of_packages' | 'package_size' | 'package_size_unit', value: number | string) => {
    const line = data.lines[index];
    onArrayChange('lines', 'lines', index, field, value);
    
    // Get updated values
    const packages = field === 'number_of_packages' ? (value as number) : line.number_of_packages;
    const size = field === 'package_size' ? (value as number) : (line.package_size || line.unit_size || 0);
    const unit = field === 'package_size_unit' ? (value as string) : (line.package_size_unit || 'KG');
    
    // Calculate quantity_mt based on package unit
    let quantity_mt = 0;
    if (['KG', 'LB', 'G', 'OZ', 'MT', 'TON'].includes(unit)) {
      // Weight-based packages - convert to MT
      quantity_mt = calculateTotalMT(packages, size, unit as any);
    }
    // For volume/piece-based packages, quantity_mt should be entered manually or left as 0
    
    onArrayChange('lines', 'lines', index, 'quantity_mt', quantity_mt);
    onArrayChange('lines', 'lines', index, 'unit_size', unit === 'KG' ? size : 0); // Backward compatibility
    
    // Recalculate amount based on pricing method
    const updatedLine = { ...line, [field]: value, quantity_mt, package_size: size, package_size_unit: unit };
    const amount = calculateAmount(updatedLine);
    onArrayChange('lines', 'lines', index, 'amount_usd', amount);
    
    // Update rate_usd_per_mt for compatibility (if quantity > 0)
    if (quantity_mt > 0) {
      const rate_per_mt = amount / quantity_mt;
      onArrayChange('lines', 'lines', index, 'rate_usd_per_mt', rate_per_mt);
    }
  };

  // Handle pricing method change
  const handlePricingMethodChange = (index: number, method: ProductLine['pricing_method']) => {
    const line = data.lines[index];
    onArrayChange('lines', 'lines', index, 'pricing_method', method);
    
    // Recalculate with new method
    const updatedLine = { ...line, pricing_method: method };
    const amount = calculateAmount(updatedLine);
    onArrayChange('lines', 'lines', index, 'amount_usd', amount);
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      const rate_per_mt = amount / line.quantity_mt;
      onArrayChange('lines', 'lines', index, 'rate_usd_per_mt', rate_per_mt);
    }
  };

  // Handle unit price change
  const handleUnitPriceChange = (index: number, value: number) => {
    const line = data.lines[index];
    onArrayChange('lines', 'lines', index, 'unit_price', value);
    
    // Recalculate amount
    const updatedLine = { ...line, unit_price: value };
    const amount = calculateAmount(updatedLine);
    onArrayChange('lines', 'lines', index, 'amount_usd', amount);
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      const rate_per_mt = amount / line.quantity_mt;
      onArrayChange('lines', 'lines', index, 'rate_usd_per_mt', rate_per_mt);
    }
  };

  // Handle currency change
  const handleCurrencyChange = (index: number, currencyCode: string) => {
    const line = data.lines[index];
    onArrayChange('lines', 'lines', index, 'currency_code', currencyCode);
    
    // Set default exchange rate
    const newRate = currencyCode === 'USD' ? 1 : (line.exchange_rate_to_usd || 1);
    onArrayChange('lines', 'lines', index, 'exchange_rate_to_usd', newRate);
    
    // Recalculate amount
    const updatedLine = { ...line, currency_code: currencyCode, exchange_rate_to_usd: newRate };
    const amount = calculateAmount(updatedLine);
    onArrayChange('lines', 'lines', index, 'amount_usd', amount);
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      const rate_per_mt = amount / line.quantity_mt;
      onArrayChange('lines', 'lines', index, 'rate_usd_per_mt', rate_per_mt);
    }
  };

  // Handle exchange rate change
  const handleExchangeRateChange = (index: number, rate: number) => {
    const line = data.lines[index];
    onArrayChange('lines', 'lines', index, 'exchange_rate_to_usd', rate);
    
    // Recalculate amount with new exchange rate
    const updatedLine = { ...line, exchange_rate_to_usd: rate };
    const amount = calculateAmount(updatedLine);
    onArrayChange('lines', 'lines', index, 'amount_usd', amount);
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      const rate_per_mt = amount / line.quantity_mt;
      onArrayChange('lines', 'lines', index, 'rate_usd_per_mt', rate_per_mt);
    }
  };

  // Handle manual amount change (for total pricing method)
  const handleAmountChange = (index: number, value: number) => {
    const line = data.lines[index];
    onArrayChange('lines', 'lines', index, 'amount_usd', value);
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      const rate_per_mt = value / line.quantity_mt;
      onArrayChange('lines', 'lines', index, 'rate_usd_per_mt', rate_per_mt);
    }
  };

  // Handle number of pallets change (for per_pallet pricing)
  const handlePalletsChange = (index: number, value: number) => {
    const line = data.lines[index];
    onArrayChange('lines', 'lines', index, 'number_of_pallets', value);
    
    // Recalculate amount if pricing is per pallet
    if (line.pricing_method === 'per_pallet') {
      const updatedLine = { ...line, number_of_pallets: value };
      const amount = calculateAmount(updatedLine);
      onArrayChange('lines', 'lines', index, 'amount_usd', amount);
      
      // Update rate_usd_per_mt for compatibility
      if (line.quantity_mt > 0) {
        const rate_per_mt = amount / line.quantity_mt;
        onArrayChange('lines', 'lines', index, 'rate_usd_per_mt', rate_per_mt);
      }
    }
  };

  // Handle volume change (for per_cbm and per_liter pricing)
  const handleVolumeChange = (index: number, field: 'volume_cbm' | 'volume_liters', value: number) => {
    const line = data.lines[index];
    onArrayChange('lines', 'lines', index, field, value);
    
    // Recalculate amount if pricing is volume-based
    if (line.pricing_method === 'per_cbm' || line.pricing_method === 'per_liter') {
      const updatedLine = { ...line, [field]: value };
      const amount = calculateAmount(updatedLine);
      onArrayChange('lines', 'lines', index, 'amount_usd', amount);
      
      // Update rate_usd_per_mt for compatibility
      if (line.quantity_mt > 0) {
        const rate_per_mt = amount / line.quantity_mt;
        onArrayChange('lines', 'lines', index, 'rate_usd_per_mt', rate_per_mt);
      }
    }
  };

  // Calculate totals (with safety check for undefined data or lines)
  const calculateTotals = () => {
    // Triple safety check: data, data.lines, and ensure it's an array
    if (!data || !data.lines || !Array.isArray(data.lines)) {
      console.warn('⚠️ calculateTotals: data.lines is not a valid array, returning zeros', {
        hasData: !!data,
        hasLines: !!data?.lines,
        isArray: Array.isArray(data?.lines)
      });
      return { totalPackages: 0, totalMT: 0, totalAmount: 0 };
    }
    const lines = data.lines;
    const totalPackages = lines.reduce((sum, line) => sum + Number(line.number_of_packages || 0), 0);
    const totalMT = lines.reduce((sum, line) => sum + Number(line.quantity_mt || 0), 0);
    const totalAmount = lines.reduce((sum, line) => sum + Number(line.amount_usd || 0), 0);
    return { totalPackages, totalMT, totalAmount };
  };

  const { totalPackages, totalMT, totalAmount } = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200" data-field-name="lines">
        <div className="flex items-center gap-3 mb-2">
          <CubeIcon className="h-6 w-6 text-orange-600" />
          <h3 className="text-lg font-semibold text-orange-900">
            {t('contracts.productLines', 'Product Lines')}
          </h3>
        </div>
        <p className="text-sm text-orange-700">
          {t('contracts.productLinesDesc', 'Define products, packaging, quantities, and pricing')}
        </p>
      </div>

      {/* Quick Add Buttons */}
      <div className="flex flex-wrap gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {t('contracts.quickAdd', 'Quick Add')}:
          </span>
        </div>
        {PACKAGE_SIZE_PRESETS.map((size, index) => (
          <button
            key={size}
            type="button"
            onClick={() => handleAddLine(size)}
            // First button gets the data-action for FieldHighlighter to auto-add lines
            data-action={index === 0 ? 'add-product-line' : undefined}
            className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium"
          >
            + {size}kg {t('contracts.bagLine', 'Bag Line')}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleAddLine()}
          data-action="add-custom-line"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4 inline mr-1" />
          {t('contracts.addCustomLine', 'Add Custom Line')}
        </button>
      </div>

      {/* Product Lines Table */}
      {(data.lines || []).length === 0 ? (
        <div 
          className="relative text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300" 
          data-field-name="lines"
          data-field-name-alt="type_of_goods"
        >
          {/* Field markers for "Show in UI" functionality - highlighted field gets bright styling */}
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="type_of_goods">type_of_goods</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="quantity_mt">quantity_mt</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="amount_usd">amount_usd</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="rate_usd_per_mt">rate_usd_per_mt</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="unit_price">unit_price</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="pricing_method">pricing_method</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="brand">brand</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="kind_of_packages">kind_of_packages</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="number_of_packages">number_of_packages</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="package_size">package_size</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="number_of_pallets">number_of_pallets</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="volume_cbm">volume_cbm</span>
            <span className="inline-block px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-full transition-all duration-300 [&[data-highlighted='true']]:bg-blue-600 [&[data-highlighted='true']]:text-white [&[data-highlighted='true']]:ring-4 [&[data-highlighted='true']]:ring-blue-300 [&[data-highlighted='true']]:scale-110 [&[data-highlighted='true']]:font-bold" data-field-name="volume_liters">volume_liters</span>
          </div>
          <CubeIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">
            {t('contracts.noLinesAdded', 'No product lines added yet.')}
          </p>
          <p className="text-sm text-gray-400">
            {t('contracts.useQuickAdd', 'Use the quick add buttons above to get started')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1750px]">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 w-8">#</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[250px]">
                  {t('contracts.typeOfGoods', 'Type of Goods')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[140px]">
                  {t('contracts.trademark', 'Trademark')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[130px] bg-emerald-50 border-l-2 border-emerald-400">
                  <div className="flex items-center gap-1">
                    <GlobeAltIcon className="h-4 w-4 text-emerald-600" />
                    {t('contracts.originCountry', 'Origin')} 🌍
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.kindOfPackages', 'Kind')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.numberOfPackages', '# Packages')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.packageSize', 'Size (kg)')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.quantityMT', 'Quantity (MT)')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[180px]">
                  {t('contracts.pricingMethod', 'Pricing Method')} 🎯
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.quantityForPricing', 'Quantity')} 📊
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.currency', 'Currency')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.unitPrice', 'Unit Price')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.exchangeRate', 'Rate → USD')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 bg-yellow-100 border-l-2 border-yellow-400">
                  {t('contracts.pricePerMT', 'Price per MT')} 💎
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                  {t('contracts.amountUSD', 'Amount (USD)')}
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(data.lines || []).map((line, index) => (
                <tr key={line.id || index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-2 py-3 text-sm text-gray-700">{index + 1}</td>
                  
                  {/* Type of Goods - with product import option */}
                  <td className="px-3 py-3" data-field-name="type_of_goods">
                    <AutocompleteInput
                      type="product"
                      value={line.product_id || ''}
                      displayValue={line.type_of_goods || ''}
                      onChange={(id, name) => {
                        if (id) {
                          onArrayChange('lines', 'lines', index, 'product_id', id);
                          onArrayChange('lines', 'lines', index, 'product_name', name);
                        }
                        if (name) {
                          onArrayChange('lines', 'lines', index, 'type_of_goods', name);
                        }
                      }}
                      placeholder={t('contracts.typeOfGoodsPlaceholder', 'Enter or select product...')}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </td>
                  
                  {/* Trademark - with autocomplete and create new capability */}
                  <td className="px-3 py-3">
                    <AutocompleteInput
                      type="trademark"
                      value={line.trademark || ''}
                      displayValue={line.trademark || ''}
                      onChange={(value, displayName) => {
                        onArrayChange('lines', 'lines', index, 'trademark', displayName || value);
                      }}
                      onCreateNew={(name) => handleCreateTrademark(name, index)}
                      placeholder={t('contracts.selectTrademark', 'Select trademark...')}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      allowCreate={true}
                      data-field-name="trademark"
                    />
                    {creatingTrademark?.lineIndex === index && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('common.creating', 'Creating...')}
                      </div>
                    )}
                  </td>
                  
                  {/* Country of Origin - per product line */}
                  <td className="px-3 py-3 bg-emerald-50 border-l-2 border-emerald-400">
                    <select
                      value={line.country_of_origin || ''}
                      onChange={(e) => onArrayChange('lines', 'lines', index, 'country_of_origin', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-emerald-300 rounded bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      data-field-name="country_of_origin"
                    >
                      <option value="">{t('contracts.selectOrigin', 'Select...')}</option>
                      {COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Kind of Packages */}
                  <td className="px-3 py-3">
                    <select
                      value={line.kind_of_packages}
                      onChange={(e) => onArrayChange('lines', 'lines', index, 'kind_of_packages', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      data-field-name="kind_of_packages"
                    >
                      {PACKAGE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Number of Packages */}
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={line.number_of_packages || ''}
                      onChange={(e) => handlePackageChange(index, 'number_of_packages', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      min="0"
                      step="1"
                      data-field-name="number_of_packages"
                    />
                  </td>
                  
                  {/* Package Size - WITH UNIT DROPDOWN */}
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={line.package_size || line.unit_size || ''}
                        onChange={(e) => handlePackageChange(index, 'package_size', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                        min="0"
                        step="0.1"
                        placeholder="Size"
                        data-field-name="package_size"
                      />
                      <select
                        value={line.package_size_unit || 'KG'}
                        onChange={(e) => handlePackageChange(index, 'package_size_unit', e.target.value)}
                        className="w-14 px-1 py-1 text-xs border border-gray-300 rounded bg-gray-50"
                        title="Unit"
                        data-field-name="package_size_unit"
                      >
                        {PACKAGE_SIZE_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  
                  {/* Quantity (MT) - Auto-calculated */}
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={Number(line.quantity_mt || 0).toFixed(3)}
                      readOnly
                      className="w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50 font-medium"
                      step="0.001"
                      title={t('contracts.autoCalculated', 'Auto-calculated from packages × size')}
                      data-field-name="quantity_mt"
                    />
                  </td>
                  
                  {/* Pricing Method - NEW! */}
                  <td className="px-3 py-3">
                    <select
                      value={line.pricing_method || 'per_mt'}
                      onChange={(e) => handlePricingMethodChange(index, e.target.value as ProductLine['pricing_method'])}
                      className="w-full px-2 py-1 text-sm border border-orange-300 rounded bg-orange-50 font-medium"
                      data-field-name="pricing_method"
                    >
                      {PRICING_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.icon} {method.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Adaptive Quantity Field - COMPREHENSIVE EDITION */}
                  <td className="px-3 py-3">
                    {/* Weight-based pricing (read-only, auto-calculated) */}
                    {line.pricing_method === 'per_mt' && (
                      <input
                        type="number"
                        value={Number(line.quantity_mt || 0).toFixed(3)}
                        readOnly
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50 font-medium"
                        title="Metric Tons (auto-calculated)"
                      />
                    )}
                    {line.pricing_method === 'per_kg' && (
                      <input
                        type="number"
                        value={Number((line.quantity_kg || Number(line.quantity_mt) * 1000) || 0).toFixed(2)}
                        readOnly
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50 font-medium"
                        title="Kilograms (auto-calculated)"
                      />
                    )}
                    {line.pricing_method === 'per_lb' && (
                      <input
                        type="number"
                        value={Number((line.quantity_lb || Number(line.quantity_mt) * 2204.62) || 0).toFixed(2)}
                        readOnly
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50 font-medium"
                        title="Pounds (auto-calculated)"
                      />
                    )}
                    {line.pricing_method === 'per_ton' && (
                      <input
                        type="number"
                        value={Number((line.quantity_ton || Number(line.quantity_mt) * 1.10231) || 0).toFixed(3)}
                        readOnly
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50 font-medium"
                        title="US Tons (auto-calculated)"
                      />
                    )}
                    
                    {/* Package-based pricing */}
                    {(line.pricing_method === 'per_package' || line.pricing_method === 'per_piece') && (
                      <input
                        type="number"
                        value={line.number_of_packages || 0}
                        readOnly
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50 font-medium"
                        title={line.pricing_method === 'per_piece' ? 'Pieces (from packaging)' : 'Packages (from packaging)'}
                      />
                    )}
                    
                    {/* Pallet-based pricing (editable) */}
                    {line.pricing_method === 'per_pallet' && (
                      <input
                        type="number"
                        value={line.number_of_pallets || ''}
                        onChange={(e) => handlePalletsChange(index, parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-sm border border-orange-300 rounded bg-orange-50 font-medium"
                        placeholder="# Pallets"
                        min="0"
                        step="1"
                        title="Enter number of pallets"
                        data-field-name="number_of_pallets"
                      />
                    )}
                    
                    
                    {/* Volume-based pricing (editable) */}
                    {line.pricing_method === 'per_cbm' && (
                      <input
                        type="number"
                        value={line.volume_cbm || ''}
                        onChange={(e) => handleVolumeChange(index, 'volume_cbm', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-sm border border-purple-300 rounded bg-purple-50 font-medium"
                        placeholder="CBM"
                        min="0"
                        step="0.01"
                        title="Enter volume in cubic meters"
                        data-field-name="volume_cbm"
                      />
                    )}
                    {line.pricing_method === 'per_liter' && (
                      <input
                        type="number"
                        value={line.volume_liters || ''}
                        onChange={(e) => handleVolumeChange(index, 'volume_liters', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-sm border border-purple-300 rounded bg-purple-50 font-medium"
                        placeholder="Liters"
                        min="0"
                        step="0.01"
                        title="Enter volume in liters"
                        data-field-name="volume_liters"
                      />
                    )}
                    
                    {/* Total (no quantity needed) */}
                    {line.pricing_method === 'total' && (
                      <div className="text-xs text-gray-400 text-center">-</div>
                    )}
                  </td>
                  
                  {/* Currency Selector */}
                  <td className="px-2 py-3">
                    <select
                      data-field-name="currency_code"
                      value={line.currency_code || 'USD'}
                      onChange={(e) => handleCurrencyChange(index, e.target.value)}
                      className="w-20 px-1 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>
                          {curr.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Unit Price - Adaptive label */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-sm">
                        {CURRENCIES.find(c => c.code === (line.currency_code || 'USD'))?.symbol || '$'}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        lang="en"
                        value={unitPriceInputs[index] ?? (line.unit_price || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow typing decimals - validate the pattern
                          if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                            // Update local state to preserve the raw input (including trailing decimal)
                            setUnitPriceInputs(prev => ({ ...prev, [index]: val }));
                            // Update the actual data only if it's a valid number
                            const numVal = parseFloat(val);
                            if (!isNaN(numVal)) {
                              handleUnitPriceChange(index, numVal);
                            } else if (val === '' || val === '.') {
                              handleUnitPriceChange(index, 0);
                            }
                          }
                        }}
                        onBlur={(e) => {
                          // Clean up on blur - ensure proper number format
                          const numVal = parseFloat(e.target.value) || 0;
                          setUnitPriceInputs(prev => ({ ...prev, [index]: numVal ? String(numVal) : '' }));
                          handleUnitPriceChange(index, numVal);
                        }}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder={
                          line.pricing_method === 'per_mt' ? '/MT' :
                          line.pricing_method === 'per_kg' ? '/KG' :
                          line.pricing_method === 'per_lb' ? '/LB' :
                          line.pricing_method === 'per_ton' ? '/TON' :
                          line.pricing_method === 'per_package' ? '/Pkg' :
                          line.pricing_method === 'per_piece' ? '/Pc' :
                          line.pricing_method === 'per_pallet' ? '/Plt' :
                          line.pricing_method === 'per_cbm' ? '/CBM' :
                          line.pricing_method === 'per_liter' ? '/L' :
                          '0.00'
                        }
                        data-field-name="unit_price"
                      />
                    </div>
                  </td>
                  
                  {/* Exchange Rate to USD */}
                  <td className="px-2 py-3">
                    {(line.currency_code && line.currency_code !== 'USD') ? (
                      <div className="flex flex-col">
                        <input
                          data-field-name="exchange_rate_to_usd"
                          type="text"
                          inputMode="decimal"
                          lang="en"
                          value={exchangeRateInputs[index] ?? (line.exchange_rate_to_usd || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow typing decimals - validate the pattern
                            if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                              // Update local state to preserve the raw input (including trailing decimal)
                              setExchangeRateInputs(prev => ({ ...prev, [index]: val }));
                              // Update the actual data only if it's a valid number
                              const numVal = parseFloat(val);
                              if (!isNaN(numVal) && numVal > 0) {
                                handleExchangeRateChange(index, numVal);
                              } else if (val === '' || val === '.') {
                                handleExchangeRateChange(index, 1); // Default to 1 if empty
                              }
                            }
                          }}
                          onBlur={(e) => {
                            // Clean up on blur - ensure proper number format
                            const numVal = parseFloat(e.target.value) || 1;
                            setExchangeRateInputs(prev => ({ ...prev, [index]: numVal ? String(numVal) : '1' }));
                            handleExchangeRateChange(index, numVal);
                          }}
                          className="w-20 px-2 py-1 text-sm border border-blue-300 bg-blue-50 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="1.0000"
                          title={`1 ${line.currency_code} = X USD`}
                        />
                        <span className="text-xs text-gray-500 mt-0.5">
                          1 {line.currency_code} = $ {(line.exchange_rate_to_usd || 1).toFixed(4)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 text-center">-</div>
                    )}
                  </td>
                  
                  {/* Price per MT Equivalent - CFO's Standard Metric */}
                  <td className="px-3 py-3 bg-yellow-50 border-l-2 border-yellow-400" data-field-name="rate_usd_per_mt">
                    <div className="flex flex-col">
                      <input
                        type="number"
                        value={Number(calculatePricePerMT(line) || 0).toFixed(2)}
                        readOnly
                        className="w-full px-2 py-1 text-sm border-2 border-yellow-500 rounded bg-yellow-100 font-bold text-yellow-900"
                        title={t('contracts.pricePerMTEquivalent', 'Equivalent price per Metric Ton - standardized for CFO analysis')}
                      />
                      <span className="text-xs text-yellow-700 mt-1 font-semibold">
                        USD/MT
                      </span>
                    </div>
                  </td>
                  
                  {/* Amount (USD) - Editable for 'total' method, readonly otherwise */}
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={Number(line.amount_usd || 0).toFixed(2)}
                      onChange={(e) => handleAmountChange(index, parseFloat(e.target.value) || 0)}
                      readOnly={line.pricing_method !== 'total'}
                      className={`w-full px-2 py-1 text-sm border rounded font-semibold ${
                        line.pricing_method === 'total'
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-green-300 bg-green-50'
                      }`}
                      title={
                        line.pricing_method === 'total'
                          ? t('contracts.enterTotal', 'Enter total amount manually')
                          : t('contracts.autoCalculated', 'Auto-calculated')
                      }
                      data-field-name="amount_usd"
                    />
                  </td>
                  
                  {/* Actions */}
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLine(index)}
                        className="text-blue-600 hover:text-blue-800"
                        title={t('contracts.copyLine', 'Copy line')}
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onArrayRemove('lines', 'lines', index)}
                        className="text-red-600 hover:text-red-800"
                        title={t('common.delete', 'Delete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                {/* Columns 1-3: #, Type, Trademark */}
                <td colSpan={3} className="px-3 py-3 text-sm text-gray-900 text-right">
                  {t('common.total', 'TOTAL')}:
                </td>
                {/* Column 4: Origin (unique countries count) */}
                <td className="px-3 py-3 text-sm text-emerald-700 bg-emerald-50 border-l-2 border-emerald-400 text-center">
                  {(() => {
                    const origins = (data.lines || [])
                      .map(l => l.country_of_origin)
                      .filter(Boolean);
                    const uniqueOrigins = [...new Set(origins)];
                    return uniqueOrigins.length > 0 ? (
                      <span title={uniqueOrigins.join(', ')}>
                        {uniqueOrigins.length} {t('contracts.countries', 'countries')}
                      </span>
                    ) : '-';
                  })()}
                </td>
                {/* Column 5: Kind */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 6: # Packages */}
                <td className="px-3 py-3 text-sm text-gray-900">
                  {totalPackages.toLocaleString('en-US')}
                </td>
                {/* Column 7: Size */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 8: Quantity MT */}
                <td className="px-3 py-3 text-sm text-gray-900">
                  {totalMT.toFixed(3)}
                </td>
                {/* Column 9: Pricing Method */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 10: Quantity for Pricing */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 11: Currency */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 12: Unit Price */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 13: Exchange Rate */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 14: Price per MT (yellow highlighted) */}
                <td className="px-3 py-3 text-sm text-yellow-900 bg-yellow-100 border-l-2 border-yellow-400 font-bold">
                  {totalMT > 0 ? (
                    <div className="flex flex-col items-center">
                      <span>{(totalAmount / totalMT).toFixed(2)}</span>
                      <span className="text-xs">Avg USD/MT</span>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                {/* Column 15: Amount USD */}
                <td className="px-3 py-3 text-sm text-green-700 font-bold">
                  {totalAmount.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                {/* Column 16: Actions */}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* CFO's Price per MT Equivalent - Highlighted Feature */}
      <div className="bg-gradient-to-r from-yellow-100 via-yellow-50 to-orange-100 p-5 rounded-lg border-2 border-yellow-400 shadow-md">
        <div className="flex items-start gap-3">
          <div className="text-4xl">💎</div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-yellow-900 mb-2 flex items-center gap-2">
              {t('contracts.pricePerMTStandardized', 'Price per MT - Standardized for CFO Analysis')}
            </h4>
            <p className="text-sm text-yellow-800 mb-3">
              {t('contracts.pricePerMTDescription', 
                'No matter what pricing method you use (per LB, per Bag, per Container, etc.), the system automatically calculates the equivalent price per Metric Ton (MT). This ensures all contracts are comparable and accurate for financial analysis.'
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded border border-yellow-300">
                <div className="font-bold text-yellow-900 mb-1">📊 Example 1: Weight-Based</div>
                <div className="text-gray-700">
                  If priced at <strong>$2.20 per LB</strong><br/>
                  ↓ Converts to<br/>
                  <strong className="text-yellow-900">$4,850.16 per MT</strong>
                </div>
              </div>
              <div className="bg-white p-3 rounded border border-yellow-300">
                <div className="font-bold text-yellow-900 mb-1">📦 Example 2: Package-Based</div>
                <div className="text-gray-700">
                  If priced at <strong>$25 per 25kg Bag</strong><br/>
                  1000 bags = 25 MT<br/>
                  ↓ Calculates<br/>
                  <strong className="text-yellow-900">$1,000 per MT</strong>
                </div>
              </div>
              <div className="bg-white p-3 rounded border border-yellow-300">
                <div className="font-bold text-yellow-900 mb-1">🚢 Example 3: Container-Based</div>
                <div className="text-gray-700">
                  If priced at <strong>$25,000 per Container</strong><br/>
                  Container holds 25 MT<br/>
                  ↓ Derives<br/>
                  <strong className="text-yellow-900">$1,000 per MT</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-calculation Info - COMPREHENSIVE EDITION */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-orange-50 p-4 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-800 font-semibold mb-3 flex items-center gap-2">
          ⚡ {t('contracts.autoCalculations', 'Comprehensive Auto-Calculations')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <p className="text-xs font-semibold text-blue-700 mb-2">📊 Quantity Calculation:</p>
            <p className="text-xs text-gray-700 font-mono mb-1">
              Quantity (MT) = (# Packages × Size × Unit) ÷ 1000
            </p>
            <p className="text-xs text-gray-500 italic">
              Supports: KG, LB, G, OZ units
            </p>
          </div>
          
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <p className="text-xs font-semibold text-orange-700 mb-2">⚖️ Weight-Based Pricing:</p>
            <ul className="text-xs text-gray-700 space-y-0.5">
              <li><strong>Per MT:</strong> Qty (MT) × Price</li>
              <li><strong>Per KG:</strong> Qty (KG) × Price</li>
              <li><strong>Per LB:</strong> Qty (LB) × Price</li>
              <li><strong>Per TON:</strong> Qty (TON) × Price</li>
            </ul>
          </div>
          
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <p className="text-xs font-semibold text-green-700 mb-2">📦 Package/Shipping Pricing:</p>
            <ul className="text-xs text-gray-700 space-y-0.5">
              <li><strong>Per Package:</strong> # Pkgs × Price</li>
              <li><strong>Per Piece:</strong> # Pieces × Price</li>
              <li><strong>Per Pallet:</strong> # Pallets × Price</li>
              <li><strong>Per Container:</strong> # Containers × Price</li>
            </ul>
          </div>
          
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <p className="text-xs font-semibold text-purple-700 mb-2">🧴 Volume-Based Pricing:</p>
            <ul className="text-xs text-gray-700 space-y-0.5">
              <li><strong>Per CBM:</strong> Volume (m³) × Price</li>
              <li><strong>Per Liter:</strong> Volume (L) × Price</li>
            </ul>
            <p className="text-xs text-gray-500 italic mt-1">
              For liquids, chemicals, gases
            </p>
          </div>
          
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <p className="text-xs font-semibold text-yellow-700 mb-2">💰 Custom Pricing:</p>
            <p className="text-xs text-gray-700">
              <strong>Total Amount:</strong> Manual entry - no automatic calculation
            </p>
            <p className="text-xs text-gray-500 italic mt-1">
              For complex or negotiated pricing
            </p>
          </div>
          
          <div className="bg-white p-3 rounded-lg shadow-sm border-2 border-green-300">
            <p className="text-xs font-semibold text-green-700 mb-2">✅ Supported Units:</p>
            <p className="text-xs text-gray-700">
              <strong>Weight:</strong> MT, KG, LB, TON, G, OZ<br />
              <strong>Volume:</strong> L, ML, GAL, CBM, FL OZ<br />
              <strong>Count:</strong> Pieces, Packages, Pallets, Containers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

