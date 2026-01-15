import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCustomsClearingBatchMutations } from '../../hooks/useCustomsClearingBatches';
import type { CustomsClearingCost } from '../../types/api';

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  selectedItems: CustomsClearingCost[];
  totalCost: number;
  onSuccess: () => void;
}

const CreateBatchModal: React.FC<CreateBatchModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  selectedItems,
  totalCost,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { createBatch, loading, error } = useCustomsClearingBatchMutations();
  
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!batchNumber.trim()) {
      setFormError(t('batches.batchNumberRequired'));
      return;
    }

    try {
      await createBatch(batchNumber.trim(), selectedIds, notes.trim() || undefined);
      onSuccess();
      onClose();
    } catch (err: any) {
      setFormError(err.message);
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
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('batches.createBatch')}
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
            <div className="space-y-6">
              {/* Batch Number Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('batches.batchNumber')} *
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => {
                    setBatchNumber(e.target.value);
                    setFormError('');
                  }}
                  placeholder={t('batches.batchNumberPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {formError && (
                  <p className="text-red-500 text-sm mt-1">{formError}</p>
                )}
              </div>

              {/* Summary Card */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  {t('batches.batchSummary')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('batches.itemCount')}
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedItems.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('batches.totalClearingCost')}
                    </div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Items List */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('batches.selectedItems')}
                </h3>
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                          {t('customsClearingCosts.fileNumber')}
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                          {t('customsClearingCosts.transactionType')}
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">
                          {t('customsClearingCosts.totalClearingCost')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {item.file_number}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {item.transaction_type || '—'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                            ${item.total_clearing_cost?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('batches.notes')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t('batches.notesPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* API Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('common.creating') : t('batches.createBatch')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateBatchModal;

