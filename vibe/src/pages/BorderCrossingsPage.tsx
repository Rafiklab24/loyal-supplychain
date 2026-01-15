import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Transition } from '@headlessui/react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MapPinIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import {
  useBorderCrossings,
  useCreateBorderCrossing,
  useUpdateBorderCrossing,
  useDeleteBorderCrossing,
} from '../hooks/useBorderCrossings';
import type { BorderCrossing, CreateBorderCrossingData } from '../services/borderCrossings';

// ============================================================
// MODAL COMPONENT
// ============================================================

interface BorderCrossingModalProps {
  isOpen: boolean;
  onClose: () => void;
  borderCrossing?: BorderCrossing | null;
}

function BorderCrossingModal({ isOpen, onClose, borderCrossing }: BorderCrossingModalProps) {
  const { t } = useTranslation();
  const isEditing = !!borderCrossing;

  const createMutation = useCreateBorderCrossing();
  const updateMutation = useUpdateBorderCrossing();

  const [formData, setFormData] = useState<CreateBorderCrossingData>({
    name: borderCrossing?.name || '',
    name_ar: borderCrossing?.name_ar || '',
    country_from: borderCrossing?.country_from || '',
    country_to: borderCrossing?.country_to || '',
    location: borderCrossing?.location || '',
    is_active: borderCrossing?.is_active ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = t('validation.required', 'Required');
    if (!formData.country_from.trim()) newErrors.country_from = t('validation.required', 'Required');
    if (!formData.country_to.trim()) newErrors.country_to = t('validation.required', 'Required');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      if (isEditing && borderCrossing) {
        await updateMutation.mutateAsync({
          id: borderCrossing.id,
          data: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onClose();
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || t('errors.saveFailed', 'Failed to save') });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 mb-4">
                  {isEditing
                    ? t('borderCrossings.editTitle', 'Edit Border Crossing')
                    : t('borderCrossings.addTitle', 'Add Border Crossing')}
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('borderCrossings.name', 'Name (English)')} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Habur"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                  </div>

                  {/* Arabic Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('borderCrossings.nameAr', 'Name (Arabic)')}
                    </label>
                    <input
                      type="text"
                      value={formData.name_ar || ''}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="مثال: معبر الخابور"
                      dir="rtl"
                    />
                  </div>

                  {/* Country From */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('borderCrossings.countryFrom', 'Country From')} *
                    </label>
                    <input
                      type="text"
                      value={formData.country_from}
                      onChange={(e) => setFormData({ ...formData, country_from: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.country_from ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Turkey"
                    />
                    {errors.country_from && (
                      <p className="mt-1 text-sm text-red-500">{errors.country_from}</p>
                    )}
                  </div>

                  {/* Country To */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('borderCrossings.countryTo', 'Country To')} *
                    </label>
                    <input
                      type="text"
                      value={formData.country_to}
                      onChange={(e) => setFormData({ ...formData, country_to: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.country_to ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Iraq"
                    />
                    {errors.country_to && (
                      <p className="mt-1 text-sm text-red-500">{errors.country_to}</p>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('borderCrossings.location', 'Location / Description')}
                    </label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Şırnak Province, Turkey"
                    />
                  </div>

                  {/* Active Status */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                      {t('borderCrossings.isActive', 'Active')}
                    </label>
                  </div>

                  {/* Error Message */}
                  {errors.submit && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{errors.submit}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onClose}
                      className="flex-1"
                      disabled={isPending}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="flex-1"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Spinner size="sm" />
                      ) : isEditing ? (
                        t('common.save', 'Save')
                      ) : (
                        t('common.create', 'Create')
                      )}
                    </Button>
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

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export function BorderCrossingsPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBorderCrossing, setEditingBorderCrossing] = useState<BorderCrossing | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, error } = useBorderCrossings({
    search: searchQuery || undefined,
    is_active: showActiveOnly ? true : undefined,
  });

  const deleteMutation = useDeleteBorderCrossing();

  const handleEdit = (borderCrossing: BorderCrossing) => {
    setEditingBorderCrossing(borderCrossing);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('borderCrossings.confirmDelete', 'Are you sure you want to delete this border crossing?'))) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBorderCrossing(null);
  };

  const handleAddNew = () => {
    setEditingBorderCrossing(null);
    setIsModalOpen(true);
  };

  // Group border crossings by country_from
  const groupedBorderCrossings = data?.data?.reduce((acc, bc) => {
    const key = bc.country_from;
    if (!acc[key]) acc[key] = [];
    acc[key].push(bc);
    return acc;
  }, {} as Record<string, BorderCrossing[]>) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('borderCrossings.title', 'Border Crossings')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('borderCrossings.subtitle', 'Manage land border crossing points for internal routes')}
          </p>
        </div>
        <Button onClick={handleAddNew} className="flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          {t('borderCrossings.addNew', 'Add Border Crossing')}
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('borderCrossings.searchPlaceholder', 'Search by name or location...')}
              className="w-full ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">
              {t('borderCrossings.showActiveOnly', 'Show active only')}
            </span>
          </label>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-center text-red-600">
            {t('errors.loadFailed', 'Failed to load data')}
          </p>
        </Card>
      ) : !data?.data?.length ? (
        <Card className="p-12">
          <div className="text-center">
            <MapPinIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('borderCrossings.noData', 'No border crossings found')}
            </h3>
            <p className="text-gray-600 mb-4">
              {t('borderCrossings.noDataDescription', 'Get started by adding your first border crossing point.')}
            </p>
            <Button onClick={handleAddNew}>
              <PlusIcon className="w-5 h-5 me-2" />
              {t('borderCrossings.addFirst', 'Add First Border Crossing')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedBorderCrossings).map(([countryFrom, crossings]) => (
            <Card key={countryFrom} className="overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-gray-500" />
                  {t('borderCrossings.fromCountry', 'From {{country}}', { country: countryFrom })}
                </h2>
              </div>
              <div className="divide-y divide-gray-200">
                {crossings.map((bc) => (
                  <div
                    key={bc.id}
                    className={`p-4 flex items-center justify-between gap-4 ${
                      !bc.is_active ? 'bg-gray-50 opacity-75' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900">
                          {isArabic && bc.name_ar ? bc.name_ar : bc.name}
                        </h3>
                        <Badge color={bc.is_active ? 'green' : 'gray'}>
                          {bc.is_active
                            ? t('common.active', 'Active')
                            : t('common.inactive', 'Inactive')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <span>{bc.country_from}</span>
                        <ArrowRightIcon className="w-4 h-4" />
                        <span>{bc.country_to}</span>
                        {bc.location && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{bc.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(bc)}
                        title={t('common.edit', 'Edit')}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bc.id)}
                        disabled={deletingId === bc.id}
                        title={t('common.delete', 'Delete')}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deletingId === bc.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <TrashIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {/* Summary */}
          <div className="text-sm text-gray-500 text-center">
            {t('borderCrossings.totalCount', '{{count}} border crossing(s)', {
              count: data.total,
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      <BorderCrossingModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        borderCrossing={editingBorderCrossing}
      />
    </div>
  );
}

export default BorderCrossingsPage;

