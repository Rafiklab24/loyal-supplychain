import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  LinkIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useSearchShipments, useCreateCostFromPending, type ShipmentSearchResult } from '../../hooks/useCustomsClearingCosts';
import { formatNumber, formatDateString } from '../../utils/format';
import { TranslatedProductText } from '../common/TranslatedProductText';
import type { CreateCostFromPendingInput } from '../../types/api';

interface FileFirstCostEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FileFirstCostEntry: React.FC<FileFirstCostEntryProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  
  // File number state
  const [fileNumber, setFileNumber] = useState('');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults, loading: searchLoading, search, clearResults } = useSearchShipments();
  
  // Selected shipment state
  const [selectedShipment, setSelectedShipment] = useState<ShipmentSearchResult | null>(null);
  
  // Cost entry state
  const [originalCost, setOriginalCost] = useState<string>('');
  const [extraCost, setExtraCost] = useState<string>('');
  const [description, setDescription] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'partial'>('pending');
  
  // Save state
  const { createFromPending, loading: saveLoading } = useCreateCostFromPending();

  // Handle search
  const handleSearch = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      search(searchQuery);
    }
  }, [searchQuery, search]);

  // Debounced search on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        search(searchQuery);
      } else {
        clearResults();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, search, clearResults]);

  // Handle shipment selection
  const handleSelectShipment = (shipment: ShipmentSearchResult) => {
    setSelectedShipment(shipment);
    setSearchQuery('');
    clearResults();
  };

  // Handle unlink
  const handleUnlink = () => {
    setSelectedShipment(null);
  };

  // Calculate total
  const calculateTotal = () => {
    const original = parseFloat(originalCost) || 0;
    const extra = parseFloat(extraCost) || 0;
    return original + extra;
  };

  // Handle save
  const handleSave = async () => {
    // Validate
    if (!fileNumber.trim()) {
      alert(t('fileFirstEntry.fileNumberRequired', 'File number is required'));
      return;
    }

    if (!selectedShipment) {
      alert(t('fileFirstEntry.shipmentRequired', 'Please select a shipment to link'));
      return;
    }

    const total = calculateTotal();
    if (total <= 0) {
      alert(t('fileFirstEntry.costRequired', 'At least one cost must be greater than zero'));
      return;
    }

    try {
      const input: CreateCostFromPendingInput = {
        shipment_id: selectedShipment.id,
        file_number: fileNumber.trim(),
        original_clearing_amount: parseFloat(originalCost) || null,
        extra_cost_amount: parseFloat(extraCost) || null,
        cost_description: description || null,
        payment_status: paymentStatus,
        clearance_type: 'inbound',
        bol_number: selectedShipment.bl_no || null,
      };

      await createFromPending(input);
      
      // Reset form
      setFileNumber('');
      setSelectedShipment(null);
      setOriginalCost('');
      setExtraCost('');
      setDescription('');
      setPaymentStatus('pending');
      
      onSuccess();
    } catch (err: any) {
      alert(err.message || t('fileFirstEntry.saveFailed', 'Failed to save'));
    }
  };

  // Handle close
  const handleClose = () => {
    setFileNumber('');
    setSelectedShipment(null);
    setSearchQuery('');
    setOriginalCost('');
    setExtraCost('');
    setDescription('');
    setPaymentStatus('pending');
    clearResults();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('fileFirstEntry.title', 'Enter Clearance Cost')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('fileFirstEntry.subtitle', 'Link ATB file to shipment and enter costs')}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1: File Number */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                {t('fileFirstEntry.fileNumber', 'File Number (ATB Reference)')}
              </label>
              <input
                type="text"
                value={fileNumber}
                onChange={(e) => setFileNumber(e.target.value)}
                placeholder={t('fileFirstEntry.fileNumberPlaceholder', 'e.g., LAG-1872, BAYRAK-47')}
                className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Step 2: Search & Link Shipment */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
                {t('fileFirstEntry.searchShipment', 'Search & Link Shipment')}
              </label>

              {!selectedShipment ? (
                <>
                  {/* Search Input */}
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                          placeholder={t('fileFirstEntry.searchPlaceholder', 'Search by BOL, Shipment ID, or Product...')}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <MagnifyingGlassIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                      </div>
                      <button
                        onClick={handleSearch}
                        disabled={searchLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {searchLoading ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <MagnifyingGlassIcon className="h-5 w-5" />
                        )}
                        {t('common.search', 'Search')}
                      </button>
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              {t('fileFirstEntry.shipmentId', 'ID')}
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              {t('fileFirstEntry.bol', 'BOL')}
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              {t('fileFirstEntry.product', 'Product')}
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              {t('fileFirstEntry.clearanceDate', 'Clearance')}
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              {t('common.action', 'Action')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {searchResults.map((shipment) => (
                            <tr 
                              key={shipment.id}
                              className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${shipment.has_cost_entry ? 'opacity-50' : ''}`}
                            >
                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {shipment.sn || shipment.id.slice(0, 8)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                {shipment.bl_no || '—'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                                <TranslatedProductText text={shipment.product_text} />
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                {shipment.customs_clearance_date 
                                  ? formatDateString(shipment.customs_clearance_date)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-center">
                                {shipment.has_cost_entry ? (
                                  <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                    {t('fileFirstEntry.alreadyLinked', 'Already linked')}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleSelectShipment(shipment)}
                                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1 mx-auto"
                                  >
                                    <LinkIcon className="h-4 w-4" />
                                    {t('fileFirstEntry.link', 'Link')}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {t('fileFirstEntry.noResults', 'No shipments found')}
                    </div>
                  )}
                </>
              ) : (
                /* Selected Shipment Details */
                <div className="border-2 border-green-500 rounded-lg overflow-hidden">
                  <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 flex items-center justify-between border-b border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                      <CheckIcon className="h-5 w-5" />
                      {t('fileFirstEntry.linkedShipment', 'Linked Shipment')}
                    </div>
                    <button
                      onClick={handleUnlink}
                      className="text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      {t('fileFirstEntry.unlink', 'Unlink')}
                    </button>
                  </div>
                  
                  <div className="p-4 bg-white dark:bg-gray-800">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.shipmentId', 'Shipment ID')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedShipment.sn || selectedShipment.id.slice(0, 8)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.bol', 'BOL')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedShipment.bl_no || '—'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.product', 'Product')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          <TranslatedProductText text={selectedShipment.product_text} />
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.supplier', 'Supplier')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedShipment.supplier_name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.finalBeneficiary', 'Final Beneficiary')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedShipment.final_beneficiary_name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.weight', 'Weight')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {selectedShipment.weight_ton ? `${formatNumber(selectedShipment.weight_ton)} MT` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.containers', 'Containers')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedShipment.container_count || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.route', 'Route')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {selectedShipment.pol_name || '—'} → {selectedShipment.pod_name || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('fileFirstEntry.clearanceDate', 'Clearance Date')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {selectedShipment.customs_clearance_date 
                            ? formatDateString(selectedShipment.customs_clearance_date)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Step 3: Enter Costs */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
                {t('fileFirstEntry.enterCosts', 'Enter Clearance Costs')}
              </label>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('fileFirstEntry.originalCost', 'Original Cost')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={originalCost}
                      onChange={(e) => setOriginalCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('fileFirstEntry.extraCost', 'Extra Cost')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={extraCost}
                      onChange={(e) => setExtraCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2 border border-orange-300 dark:border-orange-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('fileFirstEntry.total', 'Total')}
                  </label>
                  <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      ${formatNumber(calculateTotal().toFixed(2))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('fileFirstEntry.description', 'Description')}
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('fileFirstEntry.descriptionPlaceholder', 'Cost description...')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('fileFirstEntry.paymentStatus', 'Payment Status')}
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="pending">{t('customsClearingCosts.pending', 'Pending')}</option>
                    <option value="paid">{t('customsClearingCosts.paid', 'Paid')}</option>
                    <option value="partial">{t('customsClearingCosts.partial', 'Partial')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saveLoading || !fileNumber.trim() || !selectedShipment || calculateTotal() <= 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {saveLoading ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <CheckIcon className="h-5 w-5" />
              )}
              {t('fileFirstEntry.saveAndLink', 'Save & Link')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileFirstCostEntry;

