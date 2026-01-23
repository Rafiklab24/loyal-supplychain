/**
 * Shipment Wizard - Step 2: Product Lines
 * Product lines for shipments - matches proforma invoice line structure exactly
 * Auto-calculates quantities and amounts
 * Imported from Contract Wizard
 * 
 * Note: Previously named Step4ProductLines.tsx - renamed to match actual wizard position
 */

import { useState, Fragment, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Transition } from '@headlessui/react';
import { CubeIcon, PlusIcon, TrashIcon, DocumentDuplicateIcon, ScissorsIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ShipmentFormData, ProductLine } from './types';
import { PACKAGE_TYPES, PACKAGE_SIZE_PRESETS, PRICING_METHODS, PACKAGE_SIZE_UNITS } from '../../contracts/wizard/types';
import { calculateTotalMT } from '../../contracts/wizard/units';
import { AutocompleteInput } from '../../common/AutocompleteInput';
import { createTrademark } from '../../../services/trademarks';

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

interface Step2Props {
  formData: ShipmentFormData;
  onChange: (field: keyof ShipmentFormData, value: any) => void;
  contractData?: {
    lines?: Array<{
      id: string;
      product_name?: string;
      planned_qty: number;
      unit_price: number;
      tolerance_pct?: number;
    }>;
  };
}

export function Step2ProductLines({ formData, onChange, contractData }: Step2Props) {
  const data = formData;
  const { t } = useTranslation();
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitLineIndex, setSplitLineIndex] = useState<number | null>(null);
  const [splitQuantities, setSplitQuantities] = useState<number[]>([]);
  const initialRecalcDone = useRef(false);
  
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
      updateLineField(lineIndex, 'trademark', newTrademark.name);
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

  // Auto-recalculate amounts for imported lines on initial render
  // This ensures lines imported from contracts have proper calculated amounts
  useEffect(() => {
    if (initialRecalcDone.current || !data?.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
      return;
    }
    
    // Check if any lines need recalculation
    const linesNeedRecalc = data.lines.some(line => {
      const hasQuantityOrPkg = (Number(line.quantity_mt) > 0 || Number(line.number_of_packages) > 0);
      const hasPrice = Number(line.unit_price) > 0;
      const currentAmount = Number(line.amount_usd) || 0;
      
      // Calculate what the amount SHOULD be
      const pricingMethod = line.pricing_method || 'per_mt';
      const unitPrice = Number(line.unit_price) || 0;
      const quantityMt = Number(line.quantity_mt) || 0;
      let expectedAmount = 0;
      
      if (pricingMethod === 'per_mt') {
        expectedAmount = quantityMt * unitPrice;
      } else if (pricingMethod === 'per_package' || pricingMethod === 'per_piece') {
        expectedAmount = (Number(line.number_of_packages) || 0) * unitPrice;
      }
      
      // Line needs recalc if it has values but amount is zero or significantly different
      return hasQuantityOrPkg && hasPrice && (currentAmount === 0 || Math.abs(currentAmount - expectedAmount) > 1);
    });
    
    if (linesNeedRecalc) {
      console.log('📊 Auto-recalculating amounts for imported lines...');
      const recalcedLines = data.lines.map(line => {
        const pricingMethod = line.pricing_method || 'per_mt';
        const unitPrice = Number(line.unit_price) || 0;
        const quantityMt = Number(line.quantity_mt) || 0;
        
        let newAmount = Number(line.amount_usd) || 0;
        
        // Recalculate based on pricing method
        switch (pricingMethod) {
          case 'per_mt':
            newAmount = quantityMt * unitPrice;
            break;
          case 'per_kg':
            newAmount = (Number(line.quantity_kg) || quantityMt * 1000) * unitPrice;
            break;
          case 'per_package':
          case 'per_piece':
            newAmount = (Number(line.number_of_packages) || 0) * unitPrice;
            break;
          case 'per_barrel':
            newAmount = (Number(line.number_of_barrels) || 0) * unitPrice;
            break;
          case 'total':
          case 'fixed':
            // Keep manual amount
            break;
          default:
            newAmount = quantityMt * unitPrice;
        }
        
        // Calculate rate_usd_per_mt for compatibility
        const ratePerMt = quantityMt > 0 ? newAmount / quantityMt : 0;
        
        return {
          ...line,
          amount_usd: newAmount,
          rate_usd_per_mt: ratePerMt,
        };
      });
      
      onChange('lines', recalcedLines);
    }
    
    initialRecalcDone.current = true;
  }, [data?.lines?.length]);

  // Helper function to get contract line data for comparison
  const getContractLine = (line: ProductLine) => {
    if (!contractData?.lines || !line.contract_line_id) return null;
    return contractData.lines.find(cl => cl.id === line.contract_line_id);
  };

  // Helper function to calculate variance
  const calculateVariance = (actual: number, contract: number): { percentage: number; color: string; display: string } => {
    const variance = ((actual - contract) / contract) * 100;
    const absVariance = Math.abs(variance);
    
    let color = 'text-gray-600';
    if (absVariance > 5) {
      color = 'text-red-600';
    } else if (absVariance > 2) {
      color = 'text-orange-600';
    } else if (absVariance > 0.1) {
      color = 'text-yellow-600';
    } else {
      color = 'text-green-600';
    }

    const display = variance > 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`;
    return { percentage: variance, color, display };
  };

  // CRITICAL: Safety check FIRST - ensure data.lines is a valid array
  if (!data || !data.lines || !Array.isArray(data.lines)) {
    console.error('❌ Step4ProductLines: data.lines is not a valid array!', { 
      hasData: !!data, 
      hasLines: !!data?.lines, 
      isArray: Array.isArray(data?.lines),
      linesType: typeof data?.lines,
      lines: data?.lines
    });
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 font-semibold">Error: Shipment data is not properly initialized</p>
        <p className="text-sm text-red-600 mt-2">data.lines is not an array. Please try refreshing the page or going back to previous step.</p>
      </div>
    );
  }

  // Helper to update a single line field (for simple single-field updates only)
  const updateLineField = (index: number, field: string, value: any) => {
    const updatedLines = [...data.lines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    onChange('lines', updatedLines);
  };

  // Helper to update multiple fields at once (CRITICAL: avoids race conditions)
  const updateLineMultipleFields = (index: number, updates: Record<string, any>) => {
    const updatedLines = [...data.lines];
    updatedLines[index] = { ...updatedLines[index], ...updates };
    onChange('lines', updatedLines);
  };

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
    };
    onChange('lines', [...data.lines, newLine]);
  };

  // Add a bulk line (no packages, direct MT entry)
  const handleAddBulkLine = () => {
    const newLine: ProductLine = {
      id: `temp-bulk-${Date.now()}`,
      type_of_goods: '',
      kind_of_packages: 'BULK',
      number_of_packages: 0,
      package_size: 0,
      package_size_unit: 'KG',
      unit_size: 0,
      quantity_mt: 0,
      pricing_method: 'per_mt', // Default to per MT for bulk
      unit_price: 0,
      rate_usd_per_mt: 0,
      amount_usd: 0,
    };
    onChange('lines', [...data.lines, newLine]);
  };

  const handleCopyLine = (index: number) => {
    const lineToCopy = data.lines[index];
    const newLine: ProductLine = {
      ...lineToCopy,
      id: `temp-${Date.now()}`,
    };
    onChange('lines', [...data.lines, newLine]);
  };
  
  const handleRemoveLine = (index: number) => {
    const updatedLines = data.lines.filter((_, i) => i !== index);
    onChange('lines', updatedLines);
  };

  const handleOpenSplitModal = (index: number) => {
    setSplitLineIndex(index);
    setSplitQuantities([data.lines[index].quantity_mt / 2, data.lines[index].quantity_mt / 2]);
    setShowSplitModal(true);
  };

  const handleAddSplitLine = () => {
    setSplitQuantities([...splitQuantities, 0]);
  };

  const handleRemoveSplitLine = (idx: number) => {
    setSplitQuantities(splitQuantities.filter((_, i) => i !== idx));
  };

  const handleSplitQuantityChange = (idx: number, value: number) => {
    const updated = [...splitQuantities];
    updated[idx] = value;
    setSplitQuantities(updated);
  };

  const handleConfirmSplit = () => {
    if (splitLineIndex === null) return;

    const originalLine = data.lines[splitLineIndex];
    const totalSplitQty = splitQuantities.reduce((sum, qty) => sum + qty, 0);
    
    // Validate total doesn't exceed original (with small tolerance)
    const tolerance = originalLine.quantity_mt * 0.05; // 5% tolerance
    if (totalSplitQty > originalLine.quantity_mt + tolerance) {
      alert(t('contracts.splitExceedsOriginal', 'Total split quantity exceeds original quantity'));
      return;
    }

    // Create new lines for each split quantity
    const newLines: ProductLine[] = splitQuantities.map((qty, idx) => ({
      ...originalLine,
      id: `temp-split-${Date.now()}-${idx}`,
      quantity_mt: qty,
      number_of_packages: Math.round((qty / originalLine.quantity_mt) * originalLine.number_of_packages),
    }));

    // Calculate amounts for new lines
    newLines.forEach(line => {
      line.amount_usd = calculateAmount(line);
    });

    // Remove original line and add split lines
    const updatedLines = [...data.lines];
    updatedLines.splice(splitLineIndex, 1, ...newLines);
    onChange('lines', updatedLines);

    // Reset modal state
    setShowSplitModal(false);
    setSplitLineIndex(null);
    setSplitQuantities([]);
  };

  // Adaptive calculation based on pricing method - COMPREHENSIVE EDITION
  // Now with multi-currency support - calculates in original currency and converts to USD
  const calculateAmount = (line: ProductLine): number => {
    // Get pricing method, default to 'per_mt' if not set
    const pricingMethod = line.pricing_method || 'per_mt';
    const unitPrice = Number(line.unit_price) || 0;
    const quantityMt = Number(line.quantity_mt) || 0;
    const currency = line.currency_code || 'USD';
    const exchangeRate = Number(line.exchange_rate_to_usd) || 1;
    
    // Calculate amount in original currency
    let originalAmount = 0;
    
    switch (pricingMethod) {
      // Weight-based pricing
      case 'per_mt':
        originalAmount = quantityMt * unitPrice;
        break;
      case 'per_kg':
        originalAmount = (Number(line.quantity_kg) || quantityMt * 1000) * unitPrice;
        break;
      case 'per_lb':
        originalAmount = (Number(line.quantity_lb) || quantityMt * 2204.62) * unitPrice;
        break;
      case 'per_ton':
        originalAmount = (Number(line.quantity_ton) || quantityMt * 1.10231) * unitPrice;
        break;
      
      // Volume-based pricing (for crude oil, liquids)
      case 'per_barrel':
        originalAmount = (Number(line.number_of_barrels) || 0) * unitPrice;
        break;
      
      // Package-based pricing
      case 'per_package':
        originalAmount = (Number(line.number_of_packages) || 0) * unitPrice;
        break;
      case 'per_piece':
        originalAmount = (Number(line.number_of_packages) || 0) * unitPrice; // Assuming pieces = packages
        break;
      case 'per_pallet':
        originalAmount = (Number(line.number_of_pallets) || 0) * unitPrice;
        break;
      
      // Shipping-based pricing
      case 'per_container':
        originalAmount = (Number(line.number_of_containers) || 0) * unitPrice;
        break;
      
      // Volume-based pricing
      case 'per_cbm':
        originalAmount = (Number(line.volume_cbm) || 0) * unitPrice;
        break;
      case 'per_liter':
        originalAmount = (Number(line.volume_liters) || 0) * unitPrice;
        break;
      
      // Custom pricing
      case 'total':
      case 'fixed':
        // For manual entry, if currency is not USD, use the original_amount with exchange rate
        if (currency !== 'USD' && line.original_amount) {
          return Number(line.original_amount) * exchangeRate;
        }
        return Number(line.amount_usd) || 0;
      
      default:
        // Fallback: use per_mt calculation if pricing method is unknown
        originalAmount = quantityMt * unitPrice;
    }
    
    // Convert to USD if not already in USD
    if (currency !== 'USD') {
      return originalAmount * exchangeRate;
    }
    return originalAmount;
  };

  // Calculate Price per MT Equivalent - FOR CFO ANALYSIS
  const calculatePricePerMT = (line: ProductLine): number => {
    // If quantity_mt is 0, we can't calculate price per MT
    if (!line.quantity_mt || line.quantity_mt <= 0) {
      return 0;
    }
    
    // For weight-based pricing methods, we can directly convert
    switch (line.pricing_method) {
      case 'per_mt':
        return line.unit_price;
      case 'per_kg':
        return line.unit_price * 1000; // 1 MT = 1000 KG
      case 'per_lb':
        return line.unit_price * 2204.62; // 1 MT = 2204.62 LB
      case 'per_ton':
        return line.unit_price / 1.10231; // 1 US TON = 0.907 MT (or 1 MT = 1.10231 TON)
      
      // For all other pricing methods, derive from total amount ÷ quantity
      case 'per_barrel':
      case 'per_package':
      case 'per_piece':
      case 'per_pallet':
      case 'per_container':
      case 'per_cbm':
      case 'per_liter':
      case 'total':
      default:
        return line.amount_usd / line.quantity_mt;
    }
  };

  // Auto-calculate quantity when packages or size changes - UNIT-AWARE
  // FIXED: Now uses single atomic update to avoid race conditions
  const handlePackageChange = (index: number, field: 'number_of_packages' | 'package_size' | 'package_size_unit', value: number | string) => {
    const line = data.lines[index];
    
    // Get updated values
    const packages = field === 'number_of_packages' ? (value as number) : line.number_of_packages;
    const size = field === 'package_size' ? (value as number) : (line.package_size || line.unit_size || 0);
    const unit = field === 'package_size_unit' ? (value as string) : (line.package_size_unit || 'KG');
    
    // Calculate quantity_mt based on package unit
    let quantity_mt = 0;
    if (['KG', 'LB', 'G', 'OZ', 'MT', 'TON'].includes(unit)) {
      quantity_mt = calculateTotalMT(packages, size, unit as any);
    }
    
    // Build updated line with all changes
    const updatedLine = { 
      ...line, 
      [field]: value, 
      quantity_mt, 
      package_size: size, 
      package_size_unit: unit,
      unit_size: unit === 'KG' ? size : 0,
    };
    
    // Calculate amount
    const amount = calculateAmount(updatedLine);
    updatedLine.amount_usd = amount;
    
    // Calculate rate_usd_per_mt for compatibility
    if (quantity_mt > 0) {
      updatedLine.rate_usd_per_mt = amount / quantity_mt;
    }
    
    // ONE atomic update with all changes
    updateLineMultipleFields(index, updatedLine);
  };

  // Handle pricing method change
  // FIXED: Now uses single atomic update
  const handlePricingMethodChange = (index: number, method: ProductLine['pricing_method']) => {
    const line = data.lines[index];
    
    // Build updated line
    const updatedLine = { ...line, pricing_method: method };
    const amount = calculateAmount(updatedLine);
    updatedLine.amount_usd = amount;
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      updatedLine.rate_usd_per_mt = amount / line.quantity_mt;
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updatedLine);
  };

  // Handle unit price change
  // FIXED: Now uses single atomic update
  const handleUnitPriceChange = (index: number, value: number) => {
    const line = data.lines[index];
    
    // Build updated line
    const updatedLine = { ...line, unit_price: value };
    const amount = calculateAmount(updatedLine);
    updatedLine.amount_usd = amount;
    
    // Also store as original_amount for non-USD currencies
    if (line.currency_code && line.currency_code !== 'USD') {
      const originalAmount = value * (Number(line.number_of_packages) || Number(line.quantity_mt) || 1);
      updatedLine.original_amount = originalAmount;
    }
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      updatedLine.rate_usd_per_mt = amount / line.quantity_mt;
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updatedLine);
  };

  // Handle currency change
  const handleCurrencyChange = (index: number, currencyCode: string) => {
    const line = data.lines[index];
    
    // Build updated line with new currency
    const updatedLine = { 
      ...line, 
      currency_code: currencyCode,
      // Set default exchange rate to 1 for USD, keep existing for others
      exchange_rate_to_usd: currencyCode === 'USD' ? 1 : (line.exchange_rate_to_usd || 1)
    };
    
    // Recalculate amount with new currency settings
    const amount = calculateAmount(updatedLine);
    updatedLine.amount_usd = amount;
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      updatedLine.rate_usd_per_mt = amount / line.quantity_mt;
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updatedLine);
  };

  // Handle exchange rate change
  const handleExchangeRateChange = (index: number, rate: number) => {
    const line = data.lines[index];
    
    // Build updated line with new exchange rate
    const updatedLine = { 
      ...line, 
      exchange_rate_to_usd: rate
    };
    
    // Recalculate amount with new exchange rate
    const amount = calculateAmount(updatedLine);
    updatedLine.amount_usd = amount;
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      updatedLine.rate_usd_per_mt = amount / line.quantity_mt;
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updatedLine);
  };

  // Handle manual amount change (for total pricing method)
  // FIXED: Now uses single atomic update
  const handleAmountChange = (index: number, value: number) => {
    const line = data.lines[index];
    
    const updates: Record<string, any> = { amount_usd: value };
    
    // Update rate_usd_per_mt for compatibility
    if (line.quantity_mt > 0) {
      updates.rate_usd_per_mt = value / line.quantity_mt;
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updates);
  };

  // Handle number of containers change (for per_container pricing)
  // FIXED: Now uses single atomic update
  const handleContainersChange = (index: number, value: number) => {
    const line = data.lines[index];
    
    const updates: Record<string, any> = { number_of_containers: value };
    
    // Recalculate amount if pricing is per container
    if (line.pricing_method === 'per_container') {
      const updatedLine = { ...line, number_of_containers: value };
      const amount = calculateAmount(updatedLine);
      updates.amount_usd = amount;
      
      // Update rate_usd_per_mt for compatibility
      if (line.quantity_mt > 0) {
        updates.rate_usd_per_mt = amount / line.quantity_mt;
      }
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updates);
  };

  // Handle number of pallets change (for per_pallet pricing)
  // FIXED: Now uses single atomic update
  const handlePalletsChange = (index: number, value: number) => {
    const line = data.lines[index];
    
    const updates: Record<string, any> = { number_of_pallets: value };
    
    // Recalculate amount if pricing is per pallet
    if (line.pricing_method === 'per_pallet') {
      const updatedLine = { ...line, number_of_pallets: value };
      const amount = calculateAmount(updatedLine);
      updates.amount_usd = amount;
      
      // Update rate_usd_per_mt for compatibility
      if (line.quantity_mt > 0) {
        updates.rate_usd_per_mt = amount / line.quantity_mt;
      }
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updates);
  };

  // Handle volume change (for per_cbm and per_liter pricing)
  // FIXED: Now uses single atomic update
  const handleVolumeChange = (index: number, field: 'volume_cbm' | 'volume_liters', value: number) => {
    const line = data.lines[index];
    
    const updates: Record<string, any> = { [field]: value };
    
    // Recalculate amount if pricing is volume-based
    if (line.pricing_method === 'per_cbm' || line.pricing_method === 'per_liter') {
      const updatedLine = { ...line, [field]: value };
      const amount = calculateAmount(updatedLine);
      updates.amount_usd = amount;
      
      // Update rate_usd_per_mt for compatibility
      if (line.quantity_mt > 0) {
        updates.rate_usd_per_mt = amount / line.quantity_mt;
      }
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updates);
  };

  // Handle number of barrels change (for per_barrel pricing - crude oil)
  const handleBarrelsChange = (index: number, value: number) => {
    const line = data.lines[index];
    
    const updates: Record<string, any> = { number_of_barrels: value };
    
    // Recalculate amount if pricing is per barrel
    if (line.pricing_method === 'per_barrel') {
      const updatedLine = { ...line, number_of_barrels: value };
      const amount = calculateAmount(updatedLine);
      updates.amount_usd = amount;
      
      // Update rate_usd_per_mt for compatibility
      if (line.quantity_mt > 0) {
        updates.rate_usd_per_mt = amount / line.quantity_mt;
      }
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updates);
  };

  // Handle direct quantity_mt change (for BULK cargo or direct MT entry)
  const handleQuantityMtChange = (index: number, value: number) => {
    const line = data.lines[index];
    
    const updates: Record<string, any> = { quantity_mt: value };
    
    // Recalculate amount based on new quantity
    const updatedLine = { ...line, quantity_mt: value };
    const amount = calculateAmount(updatedLine);
    updates.amount_usd = amount;
    
    // Update rate_usd_per_mt for compatibility
    if (value > 0) {
      updates.rate_usd_per_mt = amount / value;
    } else {
      updates.rate_usd_per_mt = 0;
    }
    
    // ONE atomic update
    updateLineMultipleFields(index, updates);
  };

  // Helper to check if a line is bulk cargo (no packages)
  const isBulkLine = (line: ProductLine): boolean => {
    return line.kind_of_packages === 'BULK';
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
    const totalPackages = lines.reduce((sum, line) => sum + (Number(line.number_of_packages) || 0), 0);
    const totalMT = lines.reduce((sum, line) => sum + (Number(line.quantity_mt) || 0), 0);
    const totalAmount = lines.reduce((sum, line) => sum + (Number(line.amount_usd) || 0), 0);
    return { totalPackages, totalMT, totalAmount };
  };

  const { totalPackages, totalMT, totalAmount } = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
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
        {PACKAGE_SIZE_PRESETS.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => handleAddLine(size)}
            className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium"
          >
            + {size}kg {t('contracts.bagLine', 'Bag Line')}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleAddBulkLine()}
          className="px-4 py-2 bg-amber-100 border border-amber-400 text-amber-800 rounded-lg hover:bg-amber-200 text-sm font-medium"
          data-action="add-bulk-line"
        >
          + {t('contracts.bulkLine', 'Bulk (No Packages)')}
        </button>
        <button
          type="button"
          onClick={() => handleAddLine()}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium"
          data-action="add-product-line"
        >
          <PlusIcon className="h-4 w-4 inline mr-1" />
          {t('contracts.addCustomLine', 'Add Custom Line')}
        </button>
      </div>

      {/* Product Lines Table */}
      {(data.lines || []).length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
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
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[140px]">
                  {t('contracts.countryOfOrigin', 'Country of Origin')} 🌍
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[100px]">
                  {t('contracts.kindOfPackages', 'Kind')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[100px]">
                  {t('contracts.numberOfPackages', '# Packages')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[120px]">
                  {t('contracts.packageSize', 'Size (kg)')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[160px]">
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
                  <td className="px-3 py-3">
                    <AutocompleteInput
                      type="product"
                      value={line.product_id || ''}
                      displayValue={line.type_of_goods || ''}
                      onChange={(id, name) => {
                        if (id) {
                          updateLineField(index, 'product_id', id);
                          updateLineField(index, 'product_name', name);
                        }
                        if (name) {
                          updateLineField(index, 'type_of_goods', name);
                        }
                      }}
                      placeholder={t('contracts.typeOfGoodsPlaceholder', 'Enter or select product...')}
                      className="w-full px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded"
                      data-field-name="type_of_goods"
                      data-field-product-id="product_id"
                      data-field-product-name="product_name"
                    />
                  </td>
                  
                  {/* Trademark - with autocomplete and create new capability */}
                  <td className="px-3 py-3">
                    <AutocompleteInput
                      type="trademark"
                      value={line.trademark || ''}
                      displayValue={line.trademark || ''}
                      onChange={(value, displayName) => {
                        updateLineField(index, 'trademark', displayName || value);
                      }}
                      onCreateNew={(name) => handleCreateTrademark(name, index)}
                      placeholder={t('contracts.selectTrademark', 'Select trademark...')}
                      className="w-full px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  
                  {/* Country of Origin */}
                  <td className="px-3 py-3">
                    <AutocompleteInput
                      type="country"
                      value={line.country_of_origin || ''}
                      displayValue={line.country_of_origin || ''}
                      onChange={(value) => updateLineField(index, 'country_of_origin', value)}
                      placeholder={t('contracts.selectCountry', 'Select country...')}
                      className="w-full px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      data-field-name="country_of_origin"
                    />
                  </td>
                  
                  {/* Kind of Packages */}
                  <td className="px-3 py-3">
                    <select
                      data-field-name="kind_of_packages"
                      value={line.kind_of_packages}
                      onChange={(e) => {
                        const newKind = e.target.value;
                        const wasBulk = line.kind_of_packages === 'BULK';
                        const isBulk = newKind === 'BULK';
                        
                        if (isBulk && !wasBulk) {
                          // Switching TO bulk - clear package fields, keep quantity_mt and recalc
                          updateLineMultipleFields(index, {
                            kind_of_packages: newKind,
                            number_of_packages: 0,
                            package_size: 0,
                          });
                        } else if (!isBulk && wasBulk) {
                          // Switching FROM bulk - set default package values
                          updateLineMultipleFields(index, {
                            kind_of_packages: newKind,
                            package_size: 25,
                            package_size_unit: 'KG',
                          });
                        } else {
                          // Same type, just update
                          updateLineField(index, 'kind_of_packages', newKind);
                        }
                      }}
                      className={`w-full px-2 py-1 text-sm text-gray-900 border rounded ${
                        line.kind_of_packages === 'BULK' 
                          ? 'border-amber-400 bg-amber-50 font-medium' 
                          : 'border-gray-300'
                      }`}
                    >
                      {PACKAGE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Number of Packages - Disabled for BULK cargo */}
                  <td className="px-3 py-3">
                    {isBulkLine(line) ? (
                      <div className="text-center text-gray-400 text-xs italic">N/A</div>
                    ) : (
                      <input
                        data-field-name="number_of_packages"
                        type="text"
                        inputMode="numeric"
                        value={line.number_of_packages}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          handlePackageChange(index, 'number_of_packages', val === '' ? 0 : parseInt(val, 10));
                        }}
                        className="w-24 px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    )}
                  </td>
                  
                  {/* Package Size - WITH UNIT DROPDOWN - Disabled for BULK cargo */}
                  <td className="px-3 py-3">
                    {isBulkLine(line) ? (
                      <div className="text-center text-gray-400 text-xs italic">N/A</div>
                    ) : (
                      <div className="flex gap-1">
                        <input
                          data-field-name="package_size"
                          data-field-unit-size="unit_size"
                          type="text"
                          inputMode="decimal"
                          value={line.package_size || line.unit_size || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            handlePackageChange(index, 'package_size', val === '' ? 0 : parseFloat(val) || 0);
                          }}
                          className="w-20 px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                        <select
                          data-field-name="package_size_unit"
                          value={line.package_size_unit || 'KG'}
                          onChange={(e) => handlePackageChange(index, 'package_size_unit', e.target.value)}
                          className="w-14 px-1 py-1 text-xs text-gray-900 border border-gray-300 rounded bg-gray-50"
                          title="Unit"
                        >
                          {PACKAGE_SIZE_UNITS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.symbol}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  
                  {/* Quantity (MT) - ALWAYS EDITABLE for direct entry */}
                  <td className="px-3 py-3">
                    {(() => {
                      // Get fulfillment info from line (populated from contract)
                      const contractQty = parseFloat(line.extra_json?.contract_quantity_mt) || 0;
                      const alreadyShipped = parseFloat(line.extra_json?.shipped_quantity_mt) || 0;
                      const pendingQty = contractQty - alreadyShipped;
                      const currentQty = Number(line.quantity_mt) || 0;
                      const hasContractLink = !!line.contract_line_id;
                      const exceedsPending = hasContractLink && contractQty > 0 && currentQty > pendingQty + 0.01;
                      const atLimit = hasContractLink && contractQty > 0 && Math.abs(currentQty - pendingQty) < 0.01;
                      
                      // Calculate projected fulfillment percentage after this shipment
                      const currentFulfillmentPct = contractQty > 0 ? (alreadyShipped / contractQty) * 100 : 0;
                      const projectedShipped = alreadyShipped + currentQty;
                      const projectedFulfillmentPct = contractQty > 0 ? Math.min((projectedShipped / contractQty) * 100, 100) : 0;
                      
                      return (
                        <>
                          {/* Contract Line Info Card - Show if linked to contract */}
                          {hasContractLink && contractQty > 0 && (
                            <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-medium text-gray-700">{t('contracts.contractLine', 'Contract Line')}</span>
                                <span className="text-gray-600">{contractQty.toFixed(2)} MT</span>
                              </div>
                              
                              {/* Progress Bar */}
                              <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                {/* Already shipped portion */}
                                <div 
                                  className="absolute h-full bg-blue-500 transition-all"
                                  style={{ width: `${Math.min(currentFulfillmentPct, 100)}%` }}
                                />
                                {/* This shipment portion (preview) */}
                                {currentQty > 0 && (
                                  <div 
                                    className={`absolute h-full transition-all ${
                                      exceedsPending ? 'bg-red-400' : 'bg-emerald-400'
                                    }`}
                                    style={{ 
                                      left: `${Math.min(currentFulfillmentPct, 100)}%`,
                                      width: `${Math.min(projectedFulfillmentPct - currentFulfillmentPct, 100 - currentFulfillmentPct)}%`
                                    }}
                                  />
                                )}
                                {/* Overflow indicator */}
                                {exceedsPending && (
                                  <div className="absolute right-0 top-0 h-full w-1 bg-red-600 animate-pulse" />
                                )}
                              </div>
                              
                              {/* Stats Row */}
                              <div className="flex justify-between text-[10px] mt-1">
                                <span className="text-blue-600">{t('contracts.shipped', 'Shipped')}: {alreadyShipped.toFixed(1)} MT</span>
                                <span className={pendingQty <= 0 ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                                  {t('contracts.pending', 'Pending')}: {pendingQty.toFixed(1)} MT
                                </span>
                              </div>
                              
                              {/* Projection */}
                              {currentQty > 0 && (
                                <div className={`text-[10px] mt-1 font-medium ${
                                  exceedsPending ? 'text-red-600' : 'text-emerald-600'
                                }`}>
                                  {t('contracts.afterThisShipment', 'After this shipment')}: {projectedFulfillmentPct.toFixed(0)}% {t('contracts.fulfilled', 'fulfilled')}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Quantity Input */}
                          <input
                            data-field-name="quantity_mt"
                            type="text"
                            inputMode="decimal"
                            value={line.quantity_mt || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              handleQuantityMtChange(index, val === '' ? 0 : parseFloat(val) || 0);
                            }}
                            className={`w-full px-2 py-1.5 text-sm text-gray-900 border-2 rounded-lg font-medium focus:ring-2 focus:outline-none transition-colors ${
                              exceedsPending
                                ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500'
                                : atLimit
                                  ? 'border-yellow-400 bg-yellow-50 focus:ring-yellow-500 focus:border-yellow-500'
                                  : hasContractLink && contractQty > 0
                                    ? 'border-emerald-400 bg-emerald-50 focus:ring-emerald-500 focus:border-emerald-500'
                                    : isBulkLine(line) 
                                      ? 'border-green-400 bg-green-50 focus:ring-green-500 focus:border-green-500' 
                                      : 'border-blue-400 bg-blue-50 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            step="0.001"
                            placeholder={hasContractLink && pendingQty > 0 ? `${pendingQty.toFixed(1)} MT` : t('contracts.enterQuantityMT', 'Enter MT')}
                            title={t('contracts.enterQuantityMT', 'Enter total quantity in Metric Tons')}
                          />
                          
                          {/* Warning if exceeds pending */}
                          {exceedsPending && (
                            <div className="mt-2 px-2 py-1.5 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800 flex items-start gap-1">
                              <span className="text-sm">⚠️</span>
                              <div>
                                <div className="font-medium">{t('contracts.exceedsPending', 'Exceeds contract pending')}</div>
                                <div>{t('contracts.exceedsPendingDetail', 'This shipment exceeds the pending quantity by {{excess}} MT. The shipment can still proceed, but the contract will be over-fulfilled.', {
                                  excess: (currentQty - pendingQty).toFixed(2)
                                })}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* Legacy variance display for non-fulfillment contract data */}
                          {(() => {
                            const contractLine = getContractLine(line);
                            if (contractLine && contractLine.planned_qty && !hasContractLink) {
                              const variance = calculateVariance(currentQty, contractLine.planned_qty);
                              return (
                                <div className="mt-1 text-xs">
                                  <span className="text-gray-500">
                                    {t('contracts.contractQty', 'Contract')}: {contractLine.planned_qty.toFixed(2)} MT
                                  </span>
                                  <span className={`ml-2 font-semibold ${variance.color}`}>
                                    {variance.display}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      );
                    })()}
                  </td>
                  
                  {/* Pricing Method - NEW! */}
                  <td className="px-3 py-3">
                    <select
                      data-field-name="pricing_method"
                      value={line.pricing_method || 'per_mt'}
                      onChange={(e) => handlePricingMethodChange(index, e.target.value as ProductLine['pricing_method'])}
                      className="w-full px-2 py-1 text-sm text-gray-900 border border-orange-300 rounded bg-orange-50 font-medium"
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
                        value={(Number(line.quantity_mt) || 0).toFixed(3)}
                        readOnly
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-blue-300 rounded bg-blue-50 font-medium"
                        title="Metric Tons (auto-calculated)"
                      />
                    )}
                    {line.pricing_method === 'per_kg' && (
                      <input
                        type="number"
                        value={((line.quantity_kg || Number(line.quantity_mt) * 1000) || 0).toFixed(2)}
                        readOnly
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-blue-300 rounded bg-blue-50 font-medium"
                        title="Kilograms (auto-calculated)"
                      />
                    )}
                    {line.pricing_method === 'per_lb' && (
                      <input
                        type="number"
                        value={((line.quantity_lb || Number(line.quantity_mt) * 2204.62) || 0).toFixed(2)}
                        readOnly
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-blue-300 rounded bg-blue-50 font-medium"
                        title="Pounds (auto-calculated)"
                      />
                    )}
                    {line.pricing_method === 'per_ton' && (
                      <input
                        type="number"
                        value={((line.quantity_ton || Number(line.quantity_mt) * 1.10231) || 0).toFixed(3)}
                        readOnly
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-blue-300 rounded bg-blue-50 font-medium"
                        title="US Tons (auto-calculated)"
                      />
                    )}
                    
                    {/* Package-based pricing */}
                    {(line.pricing_method === 'per_package' || line.pricing_method === 'per_piece') && (
                      <input
                        type="number"
                        value={line.number_of_packages || 0}
                        readOnly
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-blue-300 rounded bg-blue-50 font-medium"
                        title={line.pricing_method === 'per_piece' ? 'Pieces (from packaging)' : 'Packages (from packaging)'}
                      />
                    )}
                    
                    {/* Pallet-based pricing (editable) */}
                    {line.pricing_method === 'per_pallet' && (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={line.number_of_pallets || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          handlePalletsChange(index, val === '' ? 0 : parseInt(val, 10));
                        }}
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-orange-300 rounded bg-orange-50 font-medium focus:ring-2 focus:ring-orange-500"
                        placeholder="# Pallets"
                        title="Enter number of pallets"
                      />
                    )}
                    
                    {/* Container-based pricing (editable) */}
                    {line.pricing_method === 'per_container' && (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={line.number_of_containers || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          handleContainersChange(index, val === '' ? 0 : parseInt(val, 10));
                        }}
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-orange-300 rounded bg-orange-50 font-medium focus:ring-2 focus:ring-orange-500"
                        placeholder="# Containers"
                        title="Enter number of containers"
                      />
                    )}
                    
                    {/* Barrel-based pricing (for crude oil, liquids) */}
                    {line.pricing_method === 'per_barrel' && (
                      <input
                        data-field-name="number_of_barrels"
                        type="text"
                        inputMode="decimal"
                        value={line.number_of_barrels || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          handleBarrelsChange(index, val === '' ? 0 : parseFloat(val) || 0);
                        }}
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-amber-300 rounded bg-amber-50 font-medium focus:ring-2 focus:ring-amber-500"
                        placeholder="# Barrels"
                        title="Enter number of barrels"
                      />
                    )}
                    
                    {/* Volume-based pricing (editable) */}
                    {line.pricing_method === 'per_cbm' && (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={line.volume_cbm || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          handleVolumeChange(index, 'volume_cbm', val === '' ? 0 : parseFloat(val) || 0);
                        }}
                        className="w-full px-2 py-1 text-sm border border-purple-300 rounded bg-purple-50 font-medium focus:ring-2 focus:ring-purple-500"
                        placeholder="CBM"
                        title="Enter volume in cubic meters"
                      />
                    )}
                    {line.pricing_method === 'per_liter' && (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={line.volume_liters || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          handleVolumeChange(index, 'volume_liters', val === '' ? 0 : parseFloat(val) || 0);
                        }}
                        className="w-full px-2 py-1 text-sm border border-purple-300 rounded bg-purple-50 font-medium focus:ring-2 focus:ring-purple-500"
                        placeholder="Liters"
                        title="Enter volume in liters"
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
                      className="w-20 px-1 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        data-field-name="unit_price"
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
                        className="w-20 px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={
                          line.pricing_method === 'per_mt' ? '/MT' :
                          line.pricing_method === 'per_kg' ? '/KG' :
                          line.pricing_method === 'per_lb' ? '/LB' :
                          line.pricing_method === 'per_ton' ? '/TON' :
                          line.pricing_method === 'per_barrel' ? '/Bbl' :
                          line.pricing_method === 'per_package' ? '/Pkg' :
                          line.pricing_method === 'per_piece' ? '/Pc' :
                          line.pricing_method === 'per_pallet' ? '/Plt' :
                          line.pricing_method === 'per_container' ? '/Cnt' :
                          line.pricing_method === 'per_cbm' ? '/CBM' :
                          line.pricing_method === 'per_liter' ? '/L' :
                          '0.00'
                        }
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
                          className="w-20 px-2 py-1 text-sm text-gray-900 border border-blue-300 bg-blue-50 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <td className="px-3 py-3 bg-yellow-50 border-l-2 border-yellow-400">
                    <div className="flex flex-col">
                      <input
                        type="number"
                        value={calculatePricePerMT(line).toFixed(2)}
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
                    {line.pricing_method === 'total' ? (
                      <input
                        data-field-name="amount_usd"
                        type="text"
                        inputMode="decimal"
                        value={line.amount_usd || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          handleAmountChange(index, val === '' ? 0 : parseFloat(val) || 0);
                        }}
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-yellow-300 bg-yellow-50 rounded font-semibold focus:ring-2 focus:ring-yellow-500"
                        placeholder="Enter amount"
                        title={t('contracts.enterTotal', 'Enter total amount manually')}
                      />
                    ) : (
                      <input
                        data-field-name="amount_usd"
                        type="text"
                        value={(line.amount_usd || 0).toFixed(2)}
                        readOnly
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-green-300 bg-green-50 rounded font-semibold"
                        title={t('contracts.autoCalculated', 'Auto-calculated')}
                      />
                    )}
                  </td>
                  
                  {/* Actions */}
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenSplitModal(index)}
                        className="text-green-600 hover:text-green-800"
                        title={t('contracts.splitLine', 'Split line')}
                      >
                        <ScissorsIcon className="h-4 w-4" />
                      </button>
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
                        onClick={() => handleRemoveLine(index)}
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
                {/* Columns 1-4: #, Type, Trademark, Kind */}
                <td colSpan={4} className="px-3 py-3 text-sm text-gray-900 text-right">
                  {t('common.total', 'TOTAL')}:
                </td>
                {/* Column 5: # Packages */}
                <td className="px-3 py-3 text-sm text-gray-900">
                  {totalPackages.toLocaleString('en-US')}
                </td>
                {/* Column 6: Size */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 7: Quantity MT */}
                <td className="px-3 py-3 text-sm text-gray-900">
                  {totalMT.toFixed(3)}
                </td>
                {/* Column 8: Pricing Method */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 9: Quantity for Pricing */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 10: Currency */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 11: Unit Price */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 12: Exchange Rate */}
                <td className="px-3 py-3 text-sm text-gray-500 text-center">-</td>
                {/* Column 13: Price per MT (yellow highlighted) */}
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
                {/* Column 14: Amount USD */}
                <td className="px-3 py-3 text-sm text-green-700 font-bold">
                  {totalAmount.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                {/* Column 15: Actions */}
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

      {/* Quantity vs Weight Clarification - Source of Truth Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800 flex items-start gap-2">
          <span className="text-lg">💡</span>
          <span>
            {t('products.quantityVsWeightNote', 
              'الكمية ووحدة الكمية هي المعتمدة تجارياً ومحاسبياً. الوزن للاطلاع وللعمليات اللوجستية فقط.')}
            <span className="block mt-1 text-xs text-amber-600">
              {t('products.quantityVsWeightNoteEN', 
                'Quantity and unit from product lines are authoritative for commercial and accounting purposes. Weight is for reference and logistics only.')}
            </span>
          </span>
        </p>
      </div>

      {/* Split Line Modal */}
      <Transition appear show={showSplitModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowSplitModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-bold text-gray-900">
                      {t('contracts.splitLineTitle', 'Split Product Line')}
                    </Dialog.Title>
                    <button
                      onClick={() => setShowSplitModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {splitLineIndex !== null && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{t('contracts.originalQuantity', 'Original Quantity')}:</span>{' '}
                        {data.lines[splitLineIndex].quantity_mt} MT
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        <span className="font-medium">{t('contracts.product', 'Product')}:</span>{' '}
                        {data.lines[splitLineIndex].type_of_goods}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 mb-4">
                    {splitQuantities.map((qty, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 w-24">
                          {t('contracts.shipment', 'Shipment')} {idx + 1}:
                        </label>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => handleSplitQuantityChange(idx, parseFloat(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          placeholder="Quantity (MT)"
                          step="0.01"
                        />
                        <span className="text-sm text-gray-500">MT</span>
                        {splitQuantities.length > 2 && (
                          <button
                            onClick={() => handleRemoveSplitLine(idx)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{t('contracts.totalSplit', 'Total Split')}:</span>{' '}
                      {splitQuantities.reduce((sum, qty) => sum + qty, 0).toFixed(2)} MT
                    </p>
                    {splitLineIndex !== null && (
                      <p className={`text-sm mt-1 ${
                        splitQuantities.reduce((sum, qty) => sum + qty, 0) > data.lines[splitLineIndex].quantity_mt * 1.05
                          ? 'text-red-600 font-semibold'
                          : 'text-gray-700'
                      }`}>
                        <span className="font-medium">{t('contracts.remaining', 'Difference')}:</span>{' '}
                        {(Number(data.lines[splitLineIndex].quantity_mt) - splitQuantities.reduce((sum, qty) => sum + qty, 0)).toFixed(2)} MT
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleAddSplitLine}
                    className="w-full mb-4 px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
                  >
                    + {t('contracts.addAnotherSplit', 'Add Another Shipment')}
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSplitModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={handleConfirmSplit}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {t('contracts.confirmSplit', 'Confirm Split')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

