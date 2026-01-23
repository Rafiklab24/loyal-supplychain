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
  CameraIcon,
} from '@heroicons/react/24/outline';
import { useCompleteRequest } from '../../hooks/useEllecleme';
import type { ElleclemeRequest, CompleteRequestInput, PackageType } from '../../services/ellecleme';
import PackagingDetailsSection from './PackagingDetailsSection';

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
    // BEFORE packaging
    before_package_type: request.before_package_type,
    before_weight_per_package: request.before_weight_per_package,
    before_pieces_per_package: request.before_pieces_per_package,
    before_package_count: request.before_package_count,
    before_packages_per_pallet: request.before_packages_per_pallet,
    before_total_pallets: request.before_total_pallets,
    // AFTER packaging
    after_package_type: request.after_package_type,
    after_weight_per_package: request.after_weight_per_package,
    after_pieces_per_package: request.after_pieces_per_package,
    after_package_count: request.after_package_count,
    after_packages_per_pallet: request.after_packages_per_pallet,
    after_total_pallets: request.after_total_pallets,
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
        <Dialog.Panel className={`mx-auto max-w-3xl w-full bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto ${isRtl ? 'rtl' : 'ltr'}`}>
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

            {/* BEFORE HANDLING Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 border-b border-amber-200 pb-2">
                <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">1</span>
                {t('ellecleme.execution.beforeHandling', 'BEFORE Handling')}
              </h3>
              
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

              {/* Before Packaging Details */}
              <PackagingDetailsSection
                title={t('ellecleme.packaging.beforePackaging', 'Before Packaging Details')}
                variant="before"
                data={{
                  package_type: formData.before_package_type,
                  weight_per_package: formData.before_weight_per_package,
                  pieces_per_package: formData.before_pieces_per_package,
                  package_count: formData.before_package_count,
                  packages_per_pallet: formData.before_packages_per_pallet,
                  total_pallets: formData.before_total_pallets,
                }}
                onChange={(data) => {
                  setFormData((prev) => ({
                    ...prev,
                    before_package_type: data.package_type,
                    before_weight_per_package: data.weight_per_package,
                    before_pieces_per_package: data.pieces_per_package,
                    before_package_count: data.package_count,
                    before_packages_per_pallet: data.packages_per_pallet,
                    before_total_pallets: data.total_pallets,
                  }));
                }}
              />

              {/* Photo reminder for Before */}
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-700">
                <CameraIcon className="h-4 w-4 shrink-0" />
                <span>{t('ellecleme.packaging.uploadBeforePhoto', 'Upload before photos in the Documents tab')}</span>
              </div>
            </div>

            {/* AFTER HANDLING Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-2 border-b border-emerald-200 pb-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">2</span>
                {t('ellecleme.execution.afterHandling', 'AFTER Handling')}
              </h3>

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

              {/* After Packaging Details */}
              <PackagingDetailsSection
                title={t('ellecleme.packaging.afterPackaging', 'After Packaging Details')}
                variant="after"
                data={{
                  package_type: formData.after_package_type,
                  weight_per_package: formData.after_weight_per_package,
                  pieces_per_package: formData.after_pieces_per_package,
                  package_count: formData.after_package_count,
                  packages_per_pallet: formData.after_packages_per_pallet,
                  total_pallets: formData.after_total_pallets,
                }}
                onChange={(data) => {
                  setFormData((prev) => ({
                    ...prev,
                    after_package_type: data.package_type,
                    after_weight_per_package: data.weight_per_package,
                    after_pieces_per_package: data.pieces_per_package,
                    after_package_count: data.package_count,
                    after_packages_per_pallet: data.packages_per_pallet,
                    after_total_pallets: data.total_pallets,
                  }));
                }}
              />

              {/* Photo reminder for After */}
              <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-sm text-emerald-700">
                <CameraIcon className="h-4 w-4 shrink-0" />
                <span>{t('ellecleme.packaging.uploadAfterPhoto', 'Upload after photos in the Documents tab')}</span>
              </div>
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
