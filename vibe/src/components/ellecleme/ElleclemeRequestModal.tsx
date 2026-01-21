/**
 * Elleçleme Request Modal
 * Create a new Elleçleme (handling) request for an inventory item
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Listbox } from '@headlessui/react';
import {
  XMarkIcon,
  WrenchScrewdriverIcon,
  CheckIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useCreateRequest, useActivityTypes } from '../../hooks/useEllecleme';
import type { ActivityType, CreateRequestInput, Priority } from '../../services/ellecleme';
import type { AntrepoInventory } from '../../services/antrepo';

interface ElleclemeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: AntrepoInventory;
  onSuccess?: () => void;
}

const PRIORITIES: { value: Priority; labelKey: string; fallback: string; color: string }[] = [
  { value: 'low', labelKey: 'ellecleme.priorities.low', fallback: 'Low', color: 'bg-slate-100 text-slate-600' },
  { value: 'normal', labelKey: 'ellecleme.priorities.normal', fallback: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', labelKey: 'ellecleme.priorities.high', fallback: 'High', color: 'bg-amber-100 text-amber-700' },
  { value: 'urgent', labelKey: 'ellecleme.priorities.urgent', fallback: 'Urgent', color: 'bg-red-100 text-red-700' },
];

export default function ElleclemeRequestModal({ 
  isOpen, 
  onClose, 
  inventory,
  onSuccess 
}: ElleclemeRequestModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language;

  const { data: activityTypes, isLoading: typesLoading } = useActivityTypes();
  const createRequest = useCreateRequest();

  // State
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [formData, setFormData] = useState<Partial<CreateRequestInput>>({
    priority: 'normal',
    quantity_mt: inventory.current_quantity_mt,
    quantity_bags: inventory.quantity_bags || undefined,
    original_gtip: inventory.product_gtip || '',
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedActivity(null);
      setFormData({
        priority: 'normal',
        quantity_mt: inventory.current_quantity_mt,
        quantity_bags: inventory.quantity_bags || undefined,
        original_gtip: inventory.product_gtip || '',
      });
    }
  }, [isOpen, inventory]);

  // All activities for dropdown
  const allActivities = activityTypes || [];

  // Get activity name based on language
  const getActivityName = (activity: ActivityType) => {
    if (lang === 'ar' && activity.name_ar) return activity.name_ar;
    if (lang === 'tr' && activity.name_tr) return activity.name_tr;
    return activity.name;
  };

  // Get activity description based on language
  const getActivityDescription = (activity: ActivityType) => {
    if (lang === 'ar' && activity.description_ar) return activity.description_ar;
    if (lang === 'tr' && activity.description_tr) return activity.description_tr;
    return activity.description;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedActivity) {
      return;
    }

    try {
      const data: CreateRequestInput = {
        inventory_id: inventory.id,
        activity_code: selectedActivity.code,
        priority: formData.priority || 'normal',
        quantity_mt: formData.quantity_mt ? Number(formData.quantity_mt) : undefined,
        quantity_bags: formData.quantity_bags ? Number(formData.quantity_bags) : undefined,
        reason: formData.reason,
        description: formData.description,
        customer_requirement: formData.customer_requirement,
        original_gtip: formData.original_gtip,
        planned_execution_date: formData.planned_execution_date,
      };

      await createRequest.mutateAsync(data);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating ellecleme request:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US', {
      maximumFractionDigits: 3,
    });
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <WrenchScrewdriverIcon className="h-5 w-5 text-blue-600" />
              </div>
              {t('ellecleme.createRequest', 'Create Elleçleme Request')}
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
                <span className="text-sm font-semibold text-slate-800" dir="ltr">
                  {formatNumber(inventory.current_quantity_mt)} MT
                </span>
              </div>
              <p className="text-sm text-slate-600">{inventory.product_text || '-'}</p>
              {inventory.product_gtip && (
                <p className="text-xs text-slate-500 mt-1">GTİP: {inventory.product_gtip}</p>
              )}
            </div>

            {/* Activity Selection (Ek-63) - Dropdown Menu */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('ellecleme.selectActivity', 'Select Activity (Ek-63)')} *
              </label>
              <Listbox value={selectedActivity} onChange={setSelectedActivity}>
                <div className="relative">
                  <Listbox.Button className={`relative w-full cursor-pointer rounded-lg border border-slate-300 bg-white py-3 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:bg-slate-50 ${isRtl ? 'pr-3 pl-10' : 'pl-3 pr-10'}`}>
                    <span className={`block truncate ${selectedActivity ? 'text-slate-900' : 'text-slate-400'}`}>
                      {selectedActivity 
                        ? `${selectedActivity.code} - ${getActivityName(selectedActivity)}`
                        : t('ellecleme.selectActivityPlaceholder', 'Select an Elleçleme activity...')
                      }
                    </span>
                    <span className={`pointer-events-none absolute inset-y-0 flex items-center ${isRtl ? 'left-0 pl-2' : 'right-0 pr-2'}`}>
                      <ChevronUpDownIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    </span>
                  </Listbox.Button>

                  <Listbox.Options className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {typesLoading ? (
                      <div className="px-4 py-3 text-slate-500">{t('common.loading', 'Loading...')}</div>
                    ) : allActivities.length === 0 ? (
                      <div className="px-4 py-3 text-slate-500">{t('common.noData', 'No activities available')}</div>
                    ) : (
                      allActivities.map((activity) => (
                        <Listbox.Option
                          key={activity.code}
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-3 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} ${
                              active ? 'bg-blue-50 text-blue-900' : 'text-slate-900'
                            }`
                          }
                          value={activity}
                        >
                          {({ selected, active }) => (
                            <>
                              <div className="flex items-start gap-2">
                                <span className={`font-mono font-bold shrink-0 ${selected ? 'text-blue-700' : 'text-blue-600'}`}>
                                  {activity.code}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className={`block ${selected ? 'font-semibold' : 'font-normal'}`}>
                                    {getActivityName(activity)}
                                  </span>
                                  {activity.may_change_gtip && (
                                    <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                      <ExclamationTriangleIcon className="h-3 w-3" />
                                      {t('ellecleme.gtip.mayChange', 'May change GTİP')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {selected && (
                                <span className={`absolute inset-y-0 flex items-center ${isRtl ? 'right-0 pr-3' : 'left-0 pl-3'} text-blue-600`}>
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                      ))
                    )}
                  </Listbox.Options>
                </div>
              </Listbox>
              
              {/* Selected activity description */}
              {selectedActivity && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
                  <div className="font-medium text-blue-900 mb-1">{selectedActivity.code}</div>
                  {getActivityDescription(selectedActivity) || getActivityName(selectedActivity)}
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('ellecleme.priority', 'Priority')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handleChange('priority', p.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      formData.priority === p.value
                        ? `${p.color} ring-2 ring-offset-1 ring-blue-500`
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t(p.labelKey, p.fallback)}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('ellecleme.quantityAffected', 'Quantity Affected')} (MT)
                </label>
                <input
                  type="number"
                  step="0.001"
                  max={inventory.current_quantity_mt}
                  value={formData.quantity_mt || ''}
                  onChange={(e) => handleChange('quantity_mt', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.bags', 'Bags')}
                </label>
                <input
                  type="number"
                  value={formData.quantity_bags || ''}
                  onChange={(e) => handleChange('quantity_bags', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('ellecleme.reason', 'Reason for Handling')}
              </label>
              <textarea
                value={formData.reason || ''}
                onChange={(e) => handleChange('reason', e.target.value)}
                rows={2}
                placeholder={t('ellecleme.reasonPlaceholder', 'Why is this handling operation needed?')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('ellecleme.description', 'Description')}
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                placeholder={t('ellecleme.descriptionPlaceholder', 'Detailed description of work to be performed')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Planned Date & GTİP */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('ellecleme.plannedDate', 'Planned Execution Date')}
                </label>
                <input
                  type="date"
                  value={formData.planned_execution_date || ''}
                  onChange={(e) => handleChange('planned_execution_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('ellecleme.gtip.original', 'Original GTİP')}
                </label>
                <input
                  type="text"
                  value={formData.original_gtip || ''}
                  onChange={(e) => handleChange('original_gtip', e.target.value)}
                  placeholder="e.g., 1001.99.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* GTİP Warning */}
            {selectedActivity?.may_change_gtip && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">{t('ellecleme.gtip.mayChange', 'This activity may change the GTİP code')}</p>
                  <p className="text-amber-700 mt-1">
                    {t('ellecleme.gtip.mayChangeInfo', 'The new GTİP will be recorded when the operation is completed.')}
                  </p>
                </div>
              </div>
            )}

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
                disabled={createRequest.isPending || !selectedActivity}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 rounded-lg transition-colors"
              >
                {createRequest.isPending
                  ? t('common.saving', 'Saving...')
                  : t('ellecleme.createRequest', 'Create Request')}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
