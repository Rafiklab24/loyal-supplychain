/**
 * Elleçleme Execution Form
 * Record execution details and complete the request
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@headlessui/react';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useCompleteRequest } from '../../hooks/useEllecleme';
import type { ElleclemeRequest, CompleteRequestInput } from '../../services/ellecleme';

interface ElleclemeExecutionFormProps {
  isOpen: boolean;
  onClose: () => void;
  request: ElleclemeRequest;
  onSuccess?: () => void;
}

export default function ElleclemeExecutionForm({
  isOpen,
  onClose,
  request,
  onSuccess,
}: ElleclemeExecutionFormProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const completeRequest = useCompleteRequest();

  // Form state
  const [formData, setFormData] = useState<CompleteRequestInput>({
    before_description: request.before_description || '',
    after_description: request.after_description || '',
    new_gtip: request.new_gtip || '',
    gtip_changed: request.gtip_changed || false,
    execution_notes: request.execution_notes || '',
    actual_completion_date: new Date().toISOString().split('T')[0],
  });

  const handleChange = (field: keyof CompleteRequestInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await completeRequest.mutateAsync({
        id: request.id,
        data: formData,
      });
      onSuccess?.();
    } catch (error) {
      console.error('Error completing request:', error);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`mx-auto max-w-2xl w-full bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto ${isRtl ? 'rtl' : 'ltr'}`}>
          {/* Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-200 z-10">
            <Dialog.Title className="flex items-center gap-3 text-lg font-semibold text-slate-800">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              </div>
              {t('ellecleme.actions.completeRequest', 'Complete Request')}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Request Info */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-indigo-600">{request.request_number}</span>
                <span className="text-sm font-semibold text-slate-800">
                  {request.activity_code} - {request.activity_name}
                </span>
              </div>
              <p className="text-sm text-slate-600">{request.product_text}</p>
            </div>

            {/* Before Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('ellecleme.execution.beforeDescription', 'State Before Handling')}
              </label>
              <textarea
                value={formData.before_description || ''}
                onChange={(e) => handleChange('before_description', e.target.value)}
                rows={3}
                placeholder={t('ellecleme.execution.beforePlaceholder', 'Describe the state of goods before handling...')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* After Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('ellecleme.execution.afterDescription', 'State After Handling')} *
              </label>
              <textarea
                value={formData.after_description || ''}
                onChange={(e) => handleChange('after_description', e.target.value)}
                rows={3}
                placeholder={t('ellecleme.execution.afterPlaceholder', 'Describe the state of goods after handling...')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                required
              />
            </div>

            {/* GTİP Change Section */}
            {request.gtip_may_change && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 mb-3">
                      {t('ellecleme.gtip.mayChange', 'This activity may change the GTİP code')}
                    </p>
                    
                    {/* GTİP Changed Toggle */}
                    <label className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        checked={formData.gtip_changed}
                        onChange={(e) => handleChange('gtip_changed', e.target.checked)}
                        className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-amber-800">
                        {t('ellecleme.gtip.changed', 'GTİP Changed')}
                      </span>
                    </label>

                    {/* New GTİP Input */}
                    {formData.gtip_changed && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-amber-700 mb-1">
                            {t('ellecleme.gtip.original', 'Original GTİP')}
                          </label>
                          <input
                            type="text"
                            value={request.original_gtip || ''}
                            disabled
                            className="w-full px-3 py-2 bg-amber-100 border border-amber-200 rounded-lg text-amber-800 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-amber-700 mb-1">
                            {t('ellecleme.gtip.new', 'New GTİP')} *
                          </label>
                          <input
                            type="text"
                            value={formData.new_gtip || ''}
                            onChange={(e) => handleChange('new_gtip', e.target.value)}
                            placeholder="e.g., 1001.99.00"
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                            required={formData.gtip_changed}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Completion Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('ellecleme.completionDate', 'Completion Date')}
              </label>
              <input
                type="date"
                value={formData.actual_completion_date || ''}
                onChange={(e) => handleChange('actual_completion_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Execution Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('ellecleme.execution.notes', 'Execution Notes')}
              </label>
              <textarea
                value={formData.execution_notes || ''}
                onChange={(e) => handleChange('execution_notes', e.target.value)}
                rows={2}
                placeholder={t('common.notesPlaceholder', 'Additional notes...')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Reminder */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-start gap-2">
              <DocumentTextIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                {t('ellecleme.execution.reminder', 'Remember to upload before/after photos and any relevant documents in the Documents tab.')}
              </p>
            </div>

            {/* Actions */}
            <div className={`flex items-center justify-end gap-3 pt-4 border-t border-slate-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={completeRequest.isPending || !formData.after_description}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 rounded-lg transition-colors"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {completeRequest.isPending
                  ? t('common.saving', 'Saving...')
                  : t('ellecleme.execution.complete', 'Complete')}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
