/**
 * Antrepo Lots Management Page
 * Manage physical storage locations within the antrepo
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@headlessui/react';
import {
  ArchiveBoxIcon,
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useAntrepoLots, useCreateLot, useUpdateLot } from '../hooks/useAntrepo';
import { getLotTypeLabel } from '../services/antrepo';
import type { AntrepoLot, CreateLotInput, UpdateLotInput } from '../services/antrepo';

// Hardcoded for now - in production would come from branch selection
const DEFAULT_ANTREPO_ID = '0c6dead9-7768-4a22-acc1-f0424004bd0a'; // LOYAL Antrepo

const LOT_TYPES = ['standard', 'cold_storage', 'hazmat', 'outdoor'] as const;

export default function AntrepoLotsPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  // State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<AntrepoLot | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  // Data
  const { data: lots, isLoading } = useAntrepoLots(DEFAULT_ANTREPO_ID, includeInactive);
  const createLot = useCreateLot();
  const updateLot = useUpdateLot();

  // Form state
  const [formData, setFormData] = useState<Partial<CreateLotInput | UpdateLotInput>>({
    code: '',
    name: '',
    name_ar: '',
    description: '',
    capacity_mt: undefined,
    lot_type: 'standard',
    sort_order: 0,
  });

  const openCreateModal = () => {
    setEditingLot(null);
    setFormData({
      code: '',
      name: '',
      name_ar: '',
      description: '',
      capacity_mt: undefined,
      lot_type: 'standard',
      sort_order: lots?.length || 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (lot: AntrepoLot) => {
    setEditingLot(lot);
    setFormData({
      code: lot.code,
      name: lot.name,
      name_ar: lot.name_ar || '',
      description: lot.description || '',
      capacity_mt: lot.capacity_mt,
      lot_type: lot.lot_type,
      sort_order: lot.sort_order,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingLot) {
        await updateLot.mutateAsync({
          id: editingLot.id,
          data: formData as UpdateLotInput,
        });
      } else {
        await createLot.mutateAsync({
          ...formData,
          antrepo_id: DEFAULT_ANTREPO_ID,
        } as CreateLotInput);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving lot:', error);
    }
  };

  const handleToggleActive = async (lot: AntrepoLot) => {
    try {
      await updateLot.mutateAsync({
        id: lot.id,
        data: { is_active: !lot.is_active },
      });
    } catch (error) {
      console.error('Error toggling lot status:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '-';
    return Number(num).toLocaleString('en-US', {
      maximumFractionDigits: 1,
    });
  };

  const getOccupancyPercent = (lot: AntrepoLot) => {
    if (!lot.capacity_mt || !lot.current_occupancy_mt) return 0;
    return Math.min((Number(lot.current_occupancy_mt) / Number(lot.capacity_mt)) * 100, 100);
  };

  const getOccupancyColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <ArchiveBoxIcon className="h-8 w-8 text-indigo-600" />
              {t('antrepo.lotsTitle', 'إدارة أقسام الأنتريبو')}
            </h1>
            <p className="text-slate-600 mt-1">
              {t('antrepo.lotsSubtitle', 'إدارة أماكن التخزين الفعلية')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
              />
              {t('antrepo.showInactive', 'إظهار الأقسام غير الفعالة')}
            </label>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              {t('antrepo.addLot', 'إضافة قسم')}
            </button>
          </div>
        </div>
      </div>

      {/* Lots Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : !lots || lots.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-100">
          <ArchiveBoxIcon className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            {t('antrepo.noLots', 'لا توجد أقسام')}
          </h3>
          <p className="text-slate-500 mb-4">
            {t('antrepo.createFirstLot', 'قم بإنشاء أول قسم للأنتريبو')}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            {t('antrepo.addLot', 'إضافة قسم')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => (
            <div
              key={lot.id}
              className={`bg-white rounded-xl p-5 shadow-sm border transition-all ${
                lot.is_active
                  ? 'border-slate-100 hover:border-indigo-200 hover:shadow-md'
                  : 'border-slate-200 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-bold text-indigo-600">{lot.code}</span>
                    {!lot.is_active && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded">
                        {t('antrepo.inactive', 'غير فعال')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {isRtl && lot.name_ar ? lot.name_ar : lot.name}
                  </h3>
                </div>
                <button
                  onClick={() => openEditModal(lot)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Type Badge */}
              <div className="mb-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  lot.lot_type === 'standard' ? 'bg-slate-100 text-slate-700' :
                  lot.lot_type === 'cold_storage' ? 'bg-blue-100 text-blue-700' :
                  lot.lot_type === 'hazmat' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {getLotTypeLabel(lot.lot_type, lang)}
                </span>
              </div>

              {/* Area & Occupancy */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-600">{t('antrepo.area', 'المساحة')}</span>
                  <span className="font-semibold text-slate-800">
                    {formatNumber(lot.capacity_mt)} M²
                  </span>
                </div>
                {lot.current_occupancy_mt !== undefined && lot.current_occupancy_mt > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-slate-500">{t('antrepo.currentStock', 'المخزون الحالي')}</span>
                      <span className="font-medium text-slate-700">
                        {formatNumber(lot.current_occupancy_mt)} MT
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getOccupancyColor(getOccupancyPercent(lot))} transition-all`}
                        style={{ width: `${Math.min(getOccupancyPercent(lot), 100)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-slate-500 pt-3 border-t border-slate-100">
                <span>{lot.item_count || 0} {t('antrepo.items', 'عنصر')}</span>
                <button
                  onClick={() => handleToggleActive(lot)}
                  className={`text-xs font-medium ${
                    lot.is_active ? 'text-red-600 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-700'
                  }`}
                >
                  {lot.is_active ? t('antrepo.deactivate', 'تعطيل') : t('antrepo.activate', 'تفعيل')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-2xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <Dialog.Title className="text-lg font-semibold text-slate-800">
                {editingLot ? t('antrepo.editLot', 'تعديل القسم') : t('antrepo.createLot', 'إنشاء قسم جديد')}
              </Dialog.Title>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.lotCode', 'رمز القسم')} *
                </label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  placeholder="A1, B2, COLD-1"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.lotName', 'الاسم (إنجليزي)')} *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.lotNameAr', 'الاسم (عربي)')}
                  </label>
                  <input
                    type="text"
                    value={formData.name_ar || ''}
                    onChange={(e) => handleChange('name_ar', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Type & Capacity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.lotType', 'النوع')}
                  </label>
                  <select
                    value={formData.lot_type || 'standard'}
                    onChange={(e) => handleChange('lot_type', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {LOT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {getLotTypeLabel(type, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.areaM2', 'المساحة (م²)')}
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.capacity_mt || ''}
                    onChange={(e) => handleChange('capacity_mt', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 2700"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.description', 'الوصف')}
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.sortOrder', 'ترتيب العرض')}
                </label>
                <input
                  type="number"
                  value={formData.sort_order || 0}
                  onChange={(e) => handleChange('sort_order', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={createLot.isPending || updateLot.isPending || !formData.code || !formData.name}
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 rounded-lg transition-colors"
                >
                  {(createLot.isPending || updateLot.isPending)
                    ? t('common.saving', 'جاري الحفظ...')
                    : editingLot
                      ? t('common.save', 'حفظ')
                      : t('common.create', 'إنشاء')}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
