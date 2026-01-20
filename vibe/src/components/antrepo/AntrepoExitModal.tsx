/**
 * Antrepo Exit Modal
 * Record goods exit from the antrepo (customs warehouse)
 * Supports three exit types: Transit (border), Port (re-export), Domestic (beyaname)
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, RadioGroup } from '@headlessui/react';
import {
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  TruckIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useCreateExit } from '../../hooks/useAntrepo';
import { getExitTypeLabel } from '../../services/antrepo';
import type { AntrepoInventory, CreateExitInput, ExitType } from '../../services/antrepo';

interface AntrepoExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: AntrepoInventory;
}

const EXIT_TYPES: { id: ExitType; icon: typeof TruckIcon }[] = [
  { id: 'transit', icon: TruckIcon },
  { id: 'port', icon: GlobeAltIcon },
  { id: 'domestic', icon: BuildingOfficeIcon },
];

export default function AntrepoExitModal({ isOpen, onClose, inventory }: AntrepoExitModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const createExit = useCreateExit();

  // Form state
  const [exitType, setExitType] = useState<ExitType>('transit');
  const [formData, setFormData] = useState({
    exit_date: new Date().toISOString().split('T')[0],
    quantity_mt: inventory.current_quantity_mt,
    quantity_bags: inventory.quantity_bags || undefined,
    declaration_no: '',
    declaration_date: '',
    notes: '',
    // Transit
    transit_destination: '',
    // Port
    vessel_name: '',
    bl_no: '',
    export_country: '',
    // Domestic
    beyaname_no: '',
    beyaname_date: '',
    tax_amount: undefined as number | undefined,
    tax_currency: 'TRY',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.quantity_mt <= 0 || formData.quantity_mt > inventory.current_quantity_mt) {
      return;
    }

    try {
      let exitData: CreateExitInput;
      
      if (exitType === 'transit') {
        exitData = {
          exit_type: 'transit',
          inventory_id: inventory.id,
          exit_date: formData.exit_date,
          quantity_mt: Number(formData.quantity_mt),
          quantity_bags: formData.quantity_bags,
          declaration_no: formData.declaration_no || undefined,
          declaration_date: formData.declaration_date || undefined,
          transit_destination: formData.transit_destination || undefined,
          notes: formData.notes || undefined,
        };
      } else if (exitType === 'port') {
        exitData = {
          exit_type: 'port',
          inventory_id: inventory.id,
          exit_date: formData.exit_date,
          quantity_mt: Number(formData.quantity_mt),
          quantity_bags: formData.quantity_bags,
          declaration_no: formData.declaration_no || undefined,
          declaration_date: formData.declaration_date || undefined,
          vessel_name: formData.vessel_name || undefined,
          bl_no: formData.bl_no || undefined,
          export_country: formData.export_country || undefined,
          notes: formData.notes || undefined,
        };
      } else {
        exitData = {
          exit_type: 'domestic',
          inventory_id: inventory.id,
          exit_date: formData.exit_date,
          quantity_mt: Number(formData.quantity_mt),
          quantity_bags: formData.quantity_bags,
          declaration_no: formData.declaration_no || undefined,
          declaration_date: formData.declaration_date || undefined,
          beyaname_no: formData.beyaname_no || undefined,
          beyaname_date: formData.beyaname_date || undefined,
          tax_amount: formData.tax_amount,
          tax_currency: formData.tax_currency,
          notes: formData.notes || undefined,
        };
      }

      await createExit.mutateAsync(exitData);
      onClose();
    } catch (error) {
      console.error('Error creating exit:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatNumber = (num: number | undefined, decimals = 2) => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  const isPartialExit = Number(formData.quantity_mt) < inventory.current_quantity_mt;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-xl w-full bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <Dialog.Title className="flex items-center gap-3 text-lg font-semibold text-slate-800">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowRightOnRectangleIcon className="h-5 w-5 text-red-600" />
              </div>
              {t('antrepo.recordExit', 'تسجيل خروج بضاعة')}
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
                  {formatNumber(inventory.current_quantity_mt)} MT {t('antrepo.available', 'متاح')}
                </span>
              </div>
              <p className="text-sm text-slate-600">{inventory.product_text || '-'}</p>
            </div>

            {/* Exit Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('antrepo.exitType', 'نوع الخروج')} *
              </label>
              <RadioGroup value={exitType} onChange={setExitType} className="grid grid-cols-3 gap-3">
                {EXIT_TYPES.map((type) => (
                  <RadioGroup.Option
                    key={type.id}
                    value={type.id}
                    className={({ checked }) =>
                      `relative flex cursor-pointer rounded-lg p-3 shadow-sm focus:outline-none ${
                        checked
                          ? 'bg-indigo-50 border-2 border-indigo-500 ring-2 ring-indigo-500'
                          : 'bg-white border border-slate-200 hover:border-indigo-300'
                      }`
                    }
                  >
                    {({ checked }) => (
                      <div className="flex flex-col items-center w-full">
                        <type.icon className={`h-6 w-6 mb-1.5 ${checked ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className={`text-sm font-medium ${checked ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {getExitTypeLabel(type.id, lang)}
                        </span>
                        {checked && (
                          <CheckCircleIcon className="h-4 w-4 text-indigo-600 absolute top-2 right-2" />
                        )}
                      </div>
                    )}
                  </RadioGroup.Option>
                ))}
              </RadioGroup>
            </div>

            {/* Quantity & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.quantityMT', 'الكمية (طن)')} *
                </label>
                <input
                  type="number"
                  step="0.001"
                  max={inventory.current_quantity_mt}
                  value={formData.quantity_mt || ''}
                  onChange={(e) => handleChange('quantity_mt', e.target.value)}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    Number(formData.quantity_mt) > inventory.current_quantity_mt
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300'
                  }`}
                />
                {isPartialExit && Number(formData.quantity_mt) <= inventory.current_quantity_mt && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t('antrepo.partialExit', 'خروج جزئي')} - {formatNumber(inventory.current_quantity_mt - Number(formData.quantity_mt))} MT {t('antrepo.willRemain', 'سيبقى')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.exitDate', 'تاريخ الخروج')}
                </label>
                <input
                  type="date"
                  value={formData.exit_date || ''}
                  onChange={(e) => handleChange('exit_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Exit Type Specific Fields */}
            {exitType === 'transit' && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                <h4 className="font-medium text-blue-800 flex items-center gap-2">
                  <TruckIcon className="h-5 w-5" />
                  {t('antrepo.transitDetails', 'تفاصيل الترانزيت')}
                </h4>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.transitDestination', 'وجهة الترانزيت')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('antrepo.destinationPlaceholder', 'مثل: سوريا، العراق')}
                    value={formData.transit_destination || ''}
                    onChange={(e) => handleChange('transit_destination', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {exitType === 'port' && (
              <div className="p-4 bg-teal-50 rounded-lg border border-teal-200 space-y-4">
                <h4 className="font-medium text-teal-800 flex items-center gap-2">
                  <GlobeAltIcon className="h-5 w-5" />
                  {t('antrepo.portDetails', 'تفاصيل إعادة التصدير')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.vesselName', 'اسم السفينة')}
                    </label>
                    <input
                      type="text"
                      value={formData.vessel_name || ''}
                      onChange={(e) => handleChange('vessel_name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.blNo', 'رقم بوليصة الشحن')}
                    </label>
                    <input
                      type="text"
                      value={formData.bl_no || ''}
                      onChange={(e) => handleChange('bl_no', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.exportCountry', 'بلد التصدير')}
                  </label>
                  <input
                    type="text"
                    value={formData.export_country || ''}
                    onChange={(e) => handleChange('export_country', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
            )}

            {exitType === 'domestic' && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-4">
                <h4 className="font-medium text-amber-800 flex items-center gap-2">
                  <BuildingOfficeIcon className="h-5 w-5" />
                  {t('antrepo.domesticDetails', 'تفاصيل التخليص المحلي')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.beyanameNo', 'رقم البيانامة')}
                    </label>
                    <input
                      type="text"
                      value={formData.beyaname_no || ''}
                      onChange={(e) => handleChange('beyaname_no', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.beyanameDate', 'تاريخ البيانامة')}
                    </label>
                    <input
                      type="date"
                      value={formData.beyaname_date || ''}
                      onChange={(e) => handleChange('beyaname_date', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.taxAmount', 'مبلغ الضريبة')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tax_amount || ''}
                      onChange={(e) => handleChange('tax_amount', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.taxCurrency', 'العملة')}
                    </label>
                    <select
                      value={formData.tax_currency}
                      onChange={(e) => handleChange('tax_currency', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Declaration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.exitDeclarationNo', 'رقم بيان الخروج')}
                </label>
                <input
                  type="text"
                  value={formData.declaration_no || ''}
                  onChange={(e) => handleChange('declaration_no', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.declarationDate', 'تاريخ البيان')}
                </label>
                <input
                  type="date"
                  value={formData.declaration_date || ''}
                  onChange={(e) => handleChange('declaration_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
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
                disabled={
                  createExit.isPending ||
                  !formData.quantity_mt ||
                  Number(formData.quantity_mt) > inventory.current_quantity_mt
                }
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-400 rounded-lg transition-colors"
              >
                {createExit.isPending
                  ? t('common.saving', 'جاري الحفظ...')
                  : t('antrepo.recordExit', 'تسجيل الخروج')}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
