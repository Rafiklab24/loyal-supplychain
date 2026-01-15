/**
 * PriceBenchmarkModal - Quick entry for market price benchmarks
 */

import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { addPriceBenchmark, INCOTERMS } from '../../services/products';
import { DateInput } from '../common/DateInput';

interface PriceBenchmarkModalProps {
  productId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_ORIGINS = [
  'Brazil', 'India', 'Thailand', 'Vietnam', 'Indonesia', 'China',
  'USA', 'Australia', 'Turkey', 'Egypt', 'Ukraine', 'Russia',
];

const PRICE_SOURCES = [
  'Broker quote',
  'Supplier offer',
  'Market report',
  'Exchange price',
  'Contract price',
  'Spot price',
];

export function PriceBenchmarkModal({ productId, productName, onClose, onSuccess }: PriceBenchmarkModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    price_date: new Date().toISOString().split('T')[0],
    price_usd_per_mt: '',
    origin_country: '',
    incoterm: 'FOB',
    price_source: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () => addPriceBenchmark(productId, {
      price_date: formData.price_date,
      price_usd_per_mt: parseFloat(formData.price_usd_per_mt),
      origin_country: formData.origin_country || undefined,
      incoterm: formData.incoterm || undefined,
      price_source: formData.price_source || undefined,
      notes: formData.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.price_usd_per_mt) return;
    mutation.mutate();
  };

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-white flex items-center gap-2">
                      <CurrencyDollarIcon className="h-5 w-5" />
                      {t('products.addPriceBenchmark', 'Add Price Benchmark')}
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
                  {/* Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('products.pricePerMT', 'Price (USD/MT)')} *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.price_usd_per_mt}
                        onChange={(e) => setFormData({ ...formData, price_usd_per_mt: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        placeholder="520.00"
                      />
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('products.priceDate', 'Date')} *
                    </label>
                    <DateInput
                      value={formData.price_date}
                      onChange={(val) => setFormData({ ...formData, price_date: val })}
                      className="w-full border-gray-300 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Origin */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('products.origin', 'Origin Country')}
                    </label>
                    <select
                      value={formData.origin_country}
                      onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">{t('products.selectOrigin', 'Select origin...')}</option>
                      {COMMON_ORIGINS.map((origin) => (
                        <option key={origin} value={origin}>{origin}</option>
                      ))}
                    </select>
                  </div>

                  {/* Incoterm */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('products.incoterm', 'Incoterm')}
                    </label>
                    <select
                      value={formData.incoterm}
                      onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      {INCOTERMS.map((term) => (
                        <option key={term.value} value={term.value}>{term.value}</option>
                      ))}
                    </select>
                  </div>

                  {/* Source */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('products.priceSource', 'Price Source')}
                    </label>
                    <select
                      value={formData.price_source}
                      onChange={(e) => setFormData({ ...formData, price_source: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">{t('products.selectSource', 'Select source...')}</option>
                      {PRICE_SOURCES.map((source) => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="Optional notes..."
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
                      className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
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










