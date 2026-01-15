/**
 * Source Import Selector Component
 * Allows selecting source imports for sales with quantity tracking
 * Used in the selling workflow when transaction_type = 'outgoing'
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, PlusIcon, TrashIcon, CubeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { getSourceImports, type SourceImportAvailable } from '../../../services/certificates';
import type { SourceImportLink, ShipmentFormData } from './types';
import { Spinner } from '../../common/Spinner';

interface SourceImportSelectorProps {
  formData: ShipmentFormData;
  onChange: (field: keyof ShipmentFormData, value: any) => void;
  errors?: Partial<Record<keyof ShipmentFormData, string>>;
}

export function SourceImportSelector({ formData, onChange, errors }: SourceImportSelectorProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SourceImportAvailable[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedImport, setSelectedImport] = useState<SourceImportAvailable | null>(null);
  const [quantityToSell, setQuantityToSell] = useState<string>('');
  const [quantityUnit, setQuantityUnit] = useState<string>('MT');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Search imports - accepts empty query for "load recent"
  const searchImports = useCallback(async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      // Search even with 1 character, or empty for recent imports
      const response = await getSourceImports({ 
        search: query || undefined, 
        min_remaining: 0.01 
      });
      console.log('Source imports response:', response);
      setSearchResults(response.imports || []);
      if (!response.imports || response.imports.length === 0) {
        if (query) {
          setSearchError(`No incoming shipments found matching "${query}"`);
        } else {
          setSearchError('No incoming shipments with available quantity found');
        }
      }
    } catch (error: any) {
      console.error('Error searching imports:', error);
      setSearchError(error.message || 'Failed to search imports');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Load recent imports when search panel opens
  useEffect(() => {
    if (showSearch && !hasSearched) {
      searchImports(''); // Load all recent imports
    }
  }, [showSearch, hasSearched, searchImports]);

  // Debounce search when typing
  useEffect(() => {
    if (!showSearch) return;
    
    const timer = setTimeout(() => {
      searchImports(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchImports, showSearch]);

  // Helper to get display reference for an import
  const getImportDisplayRef = (imp: SourceImportAvailable): string => {
    return imp.display_label || imp.sn || imp.booking_no || imp.bl_no || 'Import';
  };

  // Add source import link
  const handleAddSourceImport = () => {
    if (!selectedImport || !quantityToSell) return;
    
    const qty = parseFloat(quantityToSell);
    if (isNaN(qty) || qty <= 0) return;
    
    const availableQty = parseFloat(String(selectedImport.quantity_remaining || 0));
    if (qty > availableQty) {
      alert(t('selling.quantityExceedsAvailable', 'Quantity exceeds available amount'));
      return;
    }
    
    // Use sn/booking_no/bl_no as reference identifier
    const sourceRef = selectedImport.sn || selectedImport.booking_no || selectedImport.bl_no || '';
    
    const newLink: SourceImportLink = {
      source_shipment_id: selectedImport.shipment_id,
      source_ci_number: sourceRef,
      quantity_sold: qty,
      quantity_unit: quantityUnit,
      source_product: selectedImport.product_text,
      source_total_quantity: parseFloat(String(selectedImport.total_quantity || 0)),
      quantity_remaining: availableQty - qty,
    };
    
    const currentLinks = formData.source_imports || [];
    onChange('source_imports', [...currentLinks, newLink]);
    
    // Reset selection
    setSelectedImport(null);
    setQuantityToSell('');
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Remove source import link
  const handleRemoveLink = (index: number) => {
    const currentLinks = formData.source_imports || [];
    const newLinks = currentLinks.filter((_, i) => i !== index);
    onChange('source_imports', newLinks);
  };

  // Calculate total quantity from all links
  const totalQuantitySold = (formData.source_imports || []).reduce(
    (sum, link) => sum + (link.quantity_sold || 0), 0
  );

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <CubeIcon className="h-5 w-5 text-amber-600" />
        <h4 className="text-sm font-semibold text-amber-900">
          {isRtl ? 'الواردات المصدر' : 'Source Imports'}
        </h4>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
          {isRtl ? 'مطلوب للمبيعات' : 'Required for Sales'}
        </span>
      </div>
      
      <p className="text-sm text-amber-800 mb-4">
        {isRtl 
          ? 'اختر الشحنة/الشحنات الأصلية التي تم استيرادها والتي يتم البيع منها. هذا يربط البيع بمخزونك.'
          : 'Select the original import shipment(s) that this sale is sourced from. This links the sale to your inventory.'}
      </p>

      {/* Current Links */}
      {(formData.source_imports || []).length > 0 && (
        <div className="mb-4 space-y-2">
          <label className="block text-xs font-medium text-amber-800 mb-2">
            {isRtl ? 'الواردات المرتبطة:' : 'Linked Source Imports:'}
          </label>
          {formData.source_imports?.map((link, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 bg-white border border-amber-200 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-amber-900">
                    {link.source_ci_number}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({link.source_product})
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">{link.quantity_sold}</span> {link.quantity_unit}
                  {link.source_total_quantity && (
                    <span className={`text-xs text-gray-400 ${isRtl ? 'me-2' : 'ms-2'}`}>
                      ({isRtl ? `من ${link.source_total_quantity} ${link.quantity_unit} إجمالي` : `of ${link.source_total_quantity} ${link.quantity_unit} total`})
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveLink(index)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title={isRtl ? 'إزالة' : 'Remove'}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          {/* Total Summary */}
          <div className="flex items-center justify-between p-2 bg-amber-100 rounded-lg">
            <span className="text-sm font-medium text-amber-900">
              {isRtl ? 'الكمية الإجمالية:' : 'Total Quantity:'}
            </span>
            <span className="text-sm font-bold text-amber-900">
              {totalQuantitySold.toFixed(2)} {quantityUnit}
            </span>
          </div>
        </div>
      )}

      {/* Add New Link */}
      {!showSearch ? (
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {isRtl ? 'إضافة واردة مصدر' : 'Add Source Import'}
        </button>
      ) : (
        <div className="space-y-3 p-3 bg-white border border-amber-200 rounded-lg">
          {/* Search Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {isRtl ? 'البحث في الشحنات الواردة' : 'Search Import Shipments'}
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? 'ابحث برقم الشحنة، رقم البوليصة، رقم الحجز، أو المنتج...' : 'Search by SN, B/L, booking number, or product...'}
                className={`w-full ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500`}
                autoFocus
              />
              {isSearching && (
                <div className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2`}>
                  <Spinner size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && !selectedImport && (
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
              {searchResults.map((imp) => (
                <button
                  key={imp.shipment_id}
                  type="button"
                  onClick={() => {
                    setSelectedImport(imp);
                    setQuantityToSell(parseFloat(String(imp.quantity_remaining || 0)).toString());
                    setQuantityUnit(imp.weight_unit || 'MT');
                  }}
                  className={`w-full ${isRtl ? 'text-right' : 'text-left'} p-3 hover:bg-amber-50 transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{getImportDisplayRef(imp)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      parseFloat(String(imp.quantity_remaining)) > 0 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {parseFloat(String(imp.quantity_remaining || 0)).toFixed(2)} {imp.weight_unit || 'MT'} {isRtl ? 'متاح' : 'available'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{imp.product_text || (isRtl ? 'لم يحدد المنتج' : 'No product specified')}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {imp.supplier_name && (
                      <span>{isRtl ? 'المورد' : 'Supplier'}: {imp.supplier_name}</span>
                    )}
                    {imp.eta && (
                      <span>ETA: {new Date(imp.eta).toLocaleDateString()}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected Import - Quantity Input */}
          {selectedImport && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-mono text-sm font-medium">{getImportDisplayRef(selectedImport)}</span>
                  <div className="text-sm text-gray-600">{selectedImport.product_text || (isRtl ? 'لم يحدد المنتج' : 'No product specified')}</div>
                  {selectedImport.supplier_name && (
                    <div className="text-xs text-gray-400">{selectedImport.supplier_name}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImport(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {isRtl ? 'تغيير' : 'Change'}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'الكمية للبيع' : 'Quantity to Sell'}
                  </label>
                  <input
                    type="number"
                    value={quantityToSell}
                    onChange={(e) => setQuantityToSell(e.target.value)}
                    min="0.01"
                    max={parseFloat(String(selectedImport.quantity_remaining || 0))}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'الوحدة' : 'Unit'}
                  </label>
                  <select
                    value={quantityUnit}
                    onChange={(e) => setQuantityUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="MT">MT</option>
                    <option value="KG">KG</option>
                    <option value="LB">LB</option>
                    <option value="pieces">{isRtl ? 'قطع' : 'Pieces'}</option>
                  </select>
                </div>
              </div>
              
              {/* Available quantity warning */}
              {parseFloat(quantityToSell) > parseFloat(String(selectedImport.quantity_remaining || 0)) && (
                <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  {isRtl ? 'تتجاوز الكمية المتاحة' : 'Exceeds available quantity'} ({parseFloat(String(selectedImport.quantity_remaining || 0)).toFixed(2)} {quantityUnit})
                </div>
              )}
              
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleAddSourceImport}
                  disabled={!quantityToSell || parseFloat(quantityToSell) <= 0 || parseFloat(quantityToSell) > parseFloat(String(selectedImport.quantity_remaining || 0))}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRtl ? 'إضافة رابط' : 'Add Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(false);
                    setSelectedImport(null);
                    setSearchQuery('');
                    setSearchResults([]);
                    setHasSearched(false);
                    setSearchError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* No results */}
          {hasSearched && !isSearching && searchResults.length === 0 && !selectedImport && (
            <div className="text-center py-4 text-sm text-gray-500">
              {searchError || (isRtl ? 'لا توجد واردات بكمية متاحة' : 'No imports found with available quantity')}
              <p className="mt-2 text-xs text-gray-400">
                {isRtl ? 'تأكد من وجود شحنات واردة مسجلة في النظام' : 'Make sure you have incoming shipments recorded in the system'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {errors?.source_imports && (
        <p className="mt-2 text-sm text-red-600">{errors.source_imports}</p>
      )}
    </div>
  );
}

