/**
 * Antrepo Handling Activity Modal
 * Record Elleçleme (usual handling) activities per Ek-63 regulations
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Combobox } from '@headlessui/react';
import {
  XMarkIcon,
  WrenchScrewdriverIcon,
  CheckIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useCreateHandlingActivity, useActivityTypes } from '../../hooks/useAntrepo';
import type { AntrepoInventory, CreateHandlingActivityInput, ActivityType } from '../../services/antrepo';

interface AntrepoHandlingModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: AntrepoInventory;
}

export default function AntrepoHandlingModal({ isOpen, onClose, inventory }: AntrepoHandlingModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const { data: activityTypes, isLoading: typesLoading } = useActivityTypes();
  const createHandling = useCreateHandlingActivity();

  // State
  const [query, setQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [formData, setFormData] = useState({
    performed_date: new Date().toISOString().split('T')[0],
    customs_permission_ref: '',
    quantity_affected_mt: inventory.current_quantity_mt,
    before_description: '',
    after_description: '',
    gtip_changed: false,
    old_gtip: inventory.product_gtip || '',
    new_gtip: '',
    notes: '',
  });

  // Filter activities based on search
  const filteredActivities = activityTypes?.filter((activity) => {
    if (!query) return true;
    const searchLower = query.toLowerCase();
    return (
      activity.code.includes(searchLower) ||
      activity.name.toLowerCase().includes(searchLower) ||
      activity.name_ar?.includes(query) ||
      activity.name_tr?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedActivity) {
      return;
    }

    try {
      const data: CreateHandlingActivityInput = {
        inventory_id: inventory.id,
        activity_code: selectedActivity.code,
        activity_name: selectedActivity.name,
        activity_name_ar: selectedActivity.name_ar,
        performed_date: formData.performed_date || undefined,
        customs_permission_ref: formData.customs_permission_ref || undefined,
        quantity_affected_mt: Number(formData.quantity_affected_mt) || undefined,
        before_description: formData.before_description || undefined,
        after_description: formData.after_description || undefined,
        gtip_changed: formData.gtip_changed,
        old_gtip: formData.gtip_changed ? formData.old_gtip : undefined,
        new_gtip: formData.gtip_changed ? formData.new_gtip : undefined,
        notes: formData.notes || undefined,
      };

      await createHandling.mutateAsync(data);
      onClose();
    } catch (error) {
      console.error('Error creating handling activity:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-200 z-10">
            <Dialog.Title className="flex items-center gap-3 text-lg font-semibold text-slate-800">
              <div className="p-2 bg-blue-100 rounded-lg">
                <WrenchScrewdriverIcon className="h-5 w-5 text-blue-600" />
              </div>
              {t('antrepo.recordHandling', 'تسجيل عملية إليجلمه')}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Inventory Info */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-600">{inventory.lot_code}</span>
                  {inventory.shipment_sn && (
                    <span className="text-sm text-slate-500">• {inventory.shipment_sn}</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-slate-800">
                  {formatNumber(inventory.current_quantity_mt)} MT
                </span>
              </div>
              <p className="text-sm text-slate-600">{inventory.product_text || '-'}</p>
              {inventory.product_gtip && (
                <p className="text-xs text-slate-500 mt-1">GTİP: {inventory.product_gtip}</p>
              )}
            </div>

            {/* Activity Selection (Ek-63) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('antrepo.selectActivity', 'اختر نوع العملية (Ek-63)')} *
              </label>
              <Combobox value={selectedActivity} onChange={setSelectedActivity}>
                <div className="relative">
                  <div className="relative w-full cursor-default overflow-hidden rounded-lg border border-slate-300 bg-white text-left focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <Combobox.Input
                      className="w-full border-none py-3 pl-3 pr-10 text-sm leading-5 text-slate-900 focus:ring-0"
                      displayValue={(activity: ActivityType | null) =>
                        activity ? `${activity.code} - ${isRtl && activity.name_ar ? activity.name_ar : activity.name}` : ''
                      }
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t('antrepo.searchActivity', 'ابحث عن نوع العملية...')}
                    />
                    <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronUpDownIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    </Combobox.Button>
                  </div>
                  <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {typesLoading ? (
                      <div className="px-4 py-2 text-slate-500">{t('common.loading', 'جاري التحميل...')}</div>
                    ) : filteredActivities.length === 0 ? (
                      <div className="px-4 py-2 text-slate-500">{t('common.noResults', 'لا توجد نتائج')}</div>
                    ) : (
                      filteredActivities.map((activity) => (
                        <Combobox.Option
                          key={activity.code}
                          className={({ active }) =>
                            `relative cursor-default select-none py-3 pl-10 pr-4 ${
                              active ? 'bg-blue-50 text-blue-900' : 'text-slate-900'
                            }`
                          }
                          value={activity}
                        >
                          {({ selected, active }) => (
                            <>
                              <div className="flex items-start gap-2">
                                <span className="font-mono font-bold text-blue-600 shrink-0">{activity.code}</span>
                                <div>
                                  <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                    {isRtl && activity.name_ar ? activity.name_ar : activity.name}
                                  </span>
                                  {activity.may_change_gtip && (
                                    <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                      <ExclamationTriangleIcon className="h-3 w-3" />
                                      {t('antrepo.mayChangeGtip', 'قد يغير رمز التعريفة')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {selected && (
                                <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                  active ? 'text-blue-600' : 'text-blue-600'
                                }`}>
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Combobox.Option>
                      ))
                    )}
                  </Combobox.Options>
                </div>
              </Combobox>
              
              {/* Selected activity description */}
              {selectedActivity && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                  {selectedActivity.description || selectedActivity.name}
                </div>
              )}
            </div>

            {/* Date & Permission */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.performedDate', 'تاريخ التنفيذ')}
                </label>
                <input
                  type="date"
                  value={formData.performed_date || ''}
                  onChange={(e) => handleChange('performed_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.customsPermission', 'مرجع إذن الجمارك')}
                </label>
                <input
                  type="text"
                  value={formData.customs_permission_ref || ''}
                  onChange={(e) => handleChange('customs_permission_ref', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('antrepo.quantityAffected', 'الكمية المتأثرة (طن)')}
              </label>
              <input
                type="number"
                step="0.001"
                max={inventory.current_quantity_mt}
                value={formData.quantity_affected_mt || ''}
                onChange={(e) => handleChange('quantity_affected_mt', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Before/After Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.beforeDescription', 'الحالة قبل')}
                </label>
                <textarea
                  value={formData.before_description || ''}
                  onChange={(e) => handleChange('before_description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.afterDescription', 'الحالة بعد')}
                </label>
                <textarea
                  value={formData.after_description || ''}
                  onChange={(e) => handleChange('after_description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* GTİP Change */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="gtip_changed"
                  checked={formData.gtip_changed}
                  onChange={(e) => handleChange('gtip_changed', e.target.checked)}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-slate-300 rounded"
                />
                <label htmlFor="gtip_changed" className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  {t('antrepo.gtipChanged', 'تغيير رمز التعريفة الجمركية (GTİP)')}
                </label>
              </div>
              
              {formData.gtip_changed && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.oldGtip', 'الرمز القديم')}
                    </label>
                    <input
                      type="text"
                      value={formData.old_gtip || ''}
                      onChange={(e) => handleChange('old_gtip', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.newGtip', 'الرمز الجديد')}
                    </label>
                    <input
                      type="text"
                      value={formData.new_gtip || ''}
                      onChange={(e) => handleChange('new_gtip', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('common.notes', 'ملاحظات')}
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                disabled={createHandling.isPending || !selectedActivity}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 rounded-lg transition-colors"
              >
                {createHandling.isPending
                  ? t('common.saving', 'جاري الحفظ...')
                  : t('antrepo.recordActivity', 'تسجيل العملية')}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
