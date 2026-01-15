/**
 * SeasonFormModal - Add crop season calendar by origin country
 */

import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { saveProductSeason, MONTH_NAMES } from '../../services/products';

interface SeasonFormModalProps {
  productId: string;
  productName: string;
  existingCountries: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_ORIGINS = [
  'Brazil', 'India', 'Thailand', 'Vietnam', 'Indonesia', 'China',
  'USA', 'Australia', 'Turkey', 'Egypt', 'Ukraine', 'Russia',
  'Pakistan', 'Myanmar', 'Cambodia', 'Argentina', 'Mexico', 'Spain',
];

export function SeasonFormModal({ productId, productName, existingCountries, onClose, onSuccess }: SeasonFormModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    origin_country: '',
    planting_start_month: '',
    planting_end_month: '',
    harvest_start_month: '',
    harvest_end_month: '',
    peak_start_month: '',
    peak_end_month: '',
    off_season_start_month: '',
    off_season_end_month: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () => saveProductSeason(productId, {
      origin_country: formData.origin_country,
      planting_start_month: formData.planting_start_month ? parseInt(formData.planting_start_month) : undefined,
      planting_end_month: formData.planting_end_month ? parseInt(formData.planting_end_month) : undefined,
      harvest_start_month: formData.harvest_start_month ? parseInt(formData.harvest_start_month) : undefined,
      harvest_end_month: formData.harvest_end_month ? parseInt(formData.harvest_end_month) : undefined,
      peak_start_month: formData.peak_start_month ? parseInt(formData.peak_start_month) : undefined,
      peak_end_month: formData.peak_end_month ? parseInt(formData.peak_end_month) : undefined,
      off_season_start_month: formData.off_season_start_month ? parseInt(formData.off_season_start_month) : undefined,
      off_season_end_month: formData.off_season_end_month ? parseInt(formData.off_season_end_month) : undefined,
      notes: formData.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.origin_country) return;
    mutation.mutate();
  };

  const availableCountries = COMMON_ORIGINS.filter(c => !existingCountries.includes(c));

  const MonthSelect = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">-</option>
        {MONTH_NAMES.map((month, i) => (
          <option key={month} value={i + 1}>{month}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-white flex items-center gap-2">
                      <CalendarDaysIcon className="h-5 w-5" />
                      {t('products.addSeasonCalendar', 'Add Season Calendar')}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-sm text-white/80 mt-1">{productName}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  {/* Origin Country */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('products.originCountry', 'Origin Country')} *
                    </label>
                    <select
                      required
                      value={formData.origin_country}
                      onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">{t('products.selectCountry', 'Select country...')}</option>
                      {availableCountries.map((country) => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                    {existingCountries.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        Already added: {existingCountries.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Planting Period */}
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 mb-2">
                      🌱 {t('products.plantingPeriod', 'Planting Period')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <MonthSelect
                        value={formData.planting_start_month}
                        onChange={(v) => setFormData({ ...formData, planting_start_month: v })}
                        label={t('common.start', 'Start')}
                      />
                      <MonthSelect
                        value={formData.planting_end_month}
                        onChange={(v) => setFormData({ ...formData, planting_end_month: v })}
                        label={t('common.end', 'End')}
                      />
                    </div>
                  </div>

                  {/* Harvest Period */}
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <h4 className="text-sm font-medium text-amber-800 mb-2">
                      🌾 {t('products.harvestPeriod', 'Harvest Period')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <MonthSelect
                        value={formData.harvest_start_month}
                        onChange={(v) => setFormData({ ...formData, harvest_start_month: v })}
                        label={t('common.start', 'Start')}
                      />
                      <MonthSelect
                        value={formData.harvest_end_month}
                        onChange={(v) => setFormData({ ...formData, harvest_end_month: v })}
                        label={t('common.end', 'End')}
                      />
                    </div>
                  </div>

                  {/* Peak Availability */}
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <h4 className="text-sm font-medium text-emerald-800 mb-2">
                      📈 {t('products.peakAvailability', 'Peak Availability')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <MonthSelect
                        value={formData.peak_start_month}
                        onChange={(v) => setFormData({ ...formData, peak_start_month: v })}
                        label={t('common.start', 'Start')}
                      />
                      <MonthSelect
                        value={formData.peak_end_month}
                        onChange={(v) => setFormData({ ...formData, peak_end_month: v })}
                        label={t('common.end', 'End')}
                      />
                    </div>
                  </div>

                  {/* Off Season (optional) */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      📉 {t('products.offSeason', 'Off Season')} ({t('common.optional', 'optional')})
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <MonthSelect
                        value={formData.off_season_start_month}
                        onChange={(v) => setFormData({ ...formData, off_season_start_month: v })}
                        label={t('common.start', 'Start')}
                      />
                      <MonthSelect
                        value={formData.off_season_end_month}
                        onChange={(v) => setFormData({ ...formData, off_season_end_month: v })}
                        label={t('common.end', 'End')}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('common.notes', 'Notes')}
                    </label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., Main crop, Second harvest..."
                    />
                  </div>

                  {/* Error */}
                  {mutation.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {(mutation.error as Error).message}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={mutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {mutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}













