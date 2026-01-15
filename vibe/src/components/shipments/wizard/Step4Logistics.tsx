import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { PlusIcon, XMarkIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { AutocompleteInput } from '../../common/AutocompleteInput';
import { DateInput } from '../../common/DateInput';
import { BatchManagement } from './BatchManagement';
import { ValidationBanner } from '../../common/ValidationBanner';
import { validateLogistics } from '../../../utils/shipmentValidation';
import type { StepProps, ContainerDetail } from './types';

// Transport cost responsibility options
const TRANSPORT_RESPONSIBILITY_OPTIONS = [
  { value: 'ours', label: 'على عاتقنا', labelEn: 'Our cost' },
  { value: 'counterparty', label: 'على عاتق الطرف الآخر', labelEn: 'Counterparty' },
  { value: 'unspecified', label: 'غير محدد', labelEn: 'Unspecified' },
];

interface Step4LogisticsProps extends StepProps {
  acknowledgedWarnings?: Set<string>;
  onAcknowledgeWarning?: (warningId: string) => void;
  onAcknowledgeAll?: () => void;
}

/**
 * Shipment Wizard - Step 4: Logistics Details
 * Note: Previously named Step3Logistics.tsx - renamed to match actual wizard position
 */
export function Step4Logistics({ 
  formData, 
  onChange, 
  errors,
  acknowledgedWarnings = new Set(),
  onAcknowledgeWarning,
  onAcknowledgeAll,
}: Step4LogisticsProps) {
  const { t } = useTranslation();
  
  // Run validation for logistics fields
  const validation = validateLogistics(formData);

  const isFreightContainers = formData.cargo_type === 'containers';
  const isGeneralCargo = formData.cargo_type === 'general_cargo';
  const isTrucks = formData.cargo_type === 'trucks';
  const isTankers = formData.cargo_type === 'tankers';

  // Auto-create container fields based on container_count (for freight containers)
  useEffect(() => {
    if (!isFreightContainers) return;
    
    const targetCount = typeof formData.container_count === 'number' ? formData.container_count : 0;
    const existingCount = formData.containers?.length || 0;
    
    // Auto-create containers if we have a target count and fewer existing containers
    if (targetCount > 0 && existingCount < targetCount) {
      const newContainers: ContainerDetail[] = [];
      
      // Keep existing containers
      if (formData.containers) {
        newContainers.push(...formData.containers);
      }
      
      // Add new empty containers to reach the target count
      for (let i = existingCount; i < targetCount; i++) {
        newContainers.push({
          id: `container-${Date.now()}-${i}`,
          container_number: '',
          net_weight_kg: '',
          gross_weight_kg: '',
          package_count: '',
          seal_number: '',
        });
      }
      
      onChange('containers', newContainers);
    }
  }, [formData.container_count, isFreightContainers, formData.containers?.length]);

  // Container detail handlers
  const handleAddContainer = () => {
    const newContainer: ContainerDetail = {
      id: `container-${Date.now()}`,
      container_number: '',
      net_weight_kg: '',
      gross_weight_kg: '',
      package_count: '',
      seal_number: '',
    };
    onChange('containers', [...(formData.containers || []), newContainer]);
  };

  const handleRemoveContainer = (index: number) => {
    onChange(
      'containers',
      (formData.containers || []).filter((_, i) => i !== index)
    );
  };

  const handleContainerFieldChange = (index: number, field: keyof ContainerDetail, value: string | number) => {
    const next = [...(formData.containers || [])];
    next[index] = { ...next[index], [field]: value };
    onChange('containers', next);
  };

  const singleShipmentContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('shipments.origin')} (POL)
          </label>
          <div>
          <AutocompleteInput
            type="port"
            value={formData.pol_id}
            displayValue={formData.pol_name || ''}
            onChange={(id, name) => {
              onChange('pol_id', id || '');
              onChange('pol_name', name || '');
            }}
            placeholder={t('shipments.wizard.polPlaceholder', 'Search port of loading...')}
            data-field-name="pol_id"
            data-field-pol-name="pol_name"
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.pol_id ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          </div>
          {errors.pol_id && <p className="mt-1 text-sm text-red-600">{errors.pol_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('shipments.destination')} (POD)
          </label>
          <div>
          <AutocompleteInput
            type="port"
            value={formData.pod_id}
            displayValue={formData.pod_name || ''}
            onChange={(id, name) => {
              onChange('pod_id', id || '');
              onChange('pod_name', name || '');
            }}
            placeholder={t('shipments.wizard.podPlaceholder', 'Search port of discharge...')}
            data-field-name="pod_id"
            data-field-pod-name="pod_name"
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.pod_id ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          </div>
          {errors.pod_id && <p className="mt-1 text-sm text-red-600">{errors.pod_id}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('shipments.etd', 'ETD (Estimated Date of Shipping)')}
          </label>
          <DateInput
            value={formData.etd}
            onChange={(val) => onChange('etd', val)}
            className={`w-full ${errors.etd ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.etd && <p className="mt-1 text-sm text-red-600">{errors.etd}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('shipments.eta')}
          </label>
          <DateInput
            value={formData.eta}
            onChange={(val) => onChange('eta', val)}
            className={`w-full ${errors.eta ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.eta && <p className="mt-1 text-sm text-red-600">{errors.eta}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('shipments.freeTime')}
          </label>
          <input
            type="text"
            inputMode="numeric"
            data-field-name="free_time_days"
            value={formData.free_time_days}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string and positive integers only
              if (value === '' || /^\d+$/.test(value)) {
                onChange('free_time_days', value === '' ? '' : Number(value));
              }
            }}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.free_time_days ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="0"
          />
          {errors.free_time_days && (
            <p className="mt-1 text-sm text-red-600">{errors.free_time_days}</p>
          )}
        </div>

      </div>
      
      {/* Note: Customs Clearance Date is entered post-arrival in Shipment Tracking */}
      <p className="text-xs text-gray-500 italic mt-2">
        {t('shipments.wizard.customsClearanceNote', '* تاريخ التخليص الجمركي يُدخل بعد وصول الشحنة (في قسم تتبع الشحنات)')}
      </p>

      {/* Internal Route Section with Toggle */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start gap-3 mb-3">
          <input
            type="checkbox"
            id="define-internal-route-toggle"
            data-field-name="define_internal_route_now"
            checked={formData.define_internal_route_now || false}
            onChange={(e) => onChange('define_internal_route_now', e.target.checked)}
            className="mt-1 h-5 w-5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
          />
          <div className="flex-1">
            <label
              htmlFor="define-internal-route-toggle"
              className="text-sm font-semibold text-purple-800 cursor-pointer flex items-center gap-2"
            >
              🚛 {t('shipments.wizard.defineInternalRouteNow', 'تحديد المسار الداخلي الآن')}
            </label>
            <p className="text-xs text-gray-600 mt-1">
              {t(
                'shipments.wizard.internalRouteHint',
                'حدد هذا الخيار لإدخال تفاصيل النقل الداخلي الآن. يمكن تخطي هذا وإكماله لاحقاً.'
              )}
            </p>
          </div>
        </div>

        {/* Internal Route Fields - shown only when toggle is checked */}
        {formData.define_internal_route_now && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Transport Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shipments.transportMode', 'وسيلة النقل الداخلي')}
                </label>
                <select
                  value={formData.internal_transport_mode || 'truck'}
                  onChange={(e) => onChange('internal_transport_mode', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="truck">🚛 شاحنة / Truck</option>
                  <option value="rail">🚂 قطار / Rail</option>
                  <option value="sea">🚢 بحري / Sea</option>
                  <option value="air">✈️ جوي / Air</option>
                  <option value="other">أخرى / Other</option>
                </select>
              </div>

              {/* Border Crossing */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shipments.borderCrossing', 'نقطة العبور الحدودية')}
                  <span className="text-xs text-gray-500 ms-2">
                    ({t('shipments.wizard.optionalIfCrossBorder', 'إذا كان عبر الحدود')})
                  </span>
                </label>
                <AutocompleteInput
                  type="borderCrossing"
                  value={formData.primary_border_crossing_id || ''}
                  displayValue={formData.primary_border_name || ''}
                  onChange={(id, name) => {
                    onChange('primary_border_crossing_id', id || '');
                    onChange('primary_border_name', name || '');
                    onChange('is_cross_border', !!id);
                  }}
                  placeholder={t('shipments.wizard.borderCrossingPlaceholder', 'اختر نقطة العبور...')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Route Preview */}
            {formData.pod_name && (
              <div className="mt-4 p-3 bg-white rounded-md border border-purple-100">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{t('shipments.wizard.routePreview', 'المسار')}:</span>{' '}
                  <span className="text-purple-700" dir="ltr" style={{ unicodeBidi: 'embed' }}>
                    {formData.pod_name || 'POD'} → 
                    {formData.primary_border_name && `${formData.primary_border_name} → `}
                    {formData.final_destination?.delivery_place || formData.final_destination?.name || 'الوجهة النهائية'}
                  </span>
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clearance Category Section */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <label className="block text-sm font-semibold text-amber-800 mb-2">
          🏛️ {t('clearanceCategory.label', 'فئة التخليص / Clearance Category')}
        </label>
        <p className="text-xs text-gray-600 mb-3">
          {t('clearanceCategory.hint', 'حدد نوع التخليص الجمركي لهذه الشحنة')}
        </p>
        <select
          data-field-name="clearance_category"
          value={formData.clearance_category || ''}
          onChange={(e) => onChange('clearance_category', e.target.value || null)}
          className="w-full px-4 py-2 border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
        >
          <option value="">{t('common.select', 'اختر...')}</option>
          <option value="transit">🔵 {t('clearanceCategory.transit', 'ترانزيت / Transit')} - بضائع عابرة</option>
          <option value="domestic">🟢 {t('clearanceCategory.domestic', 'محلي / Domestic')} - استهلاك محلي</option>
          <option value="custom_clearance">🟠 {t('clearanceCategory.customClearance', 'تخليص جمركي / Custom Clearance')} - رسوم استيراد</option>
        </select>
        <div className="mt-2 text-xs text-gray-500 space-y-1">
          <p>• <strong>{t('clearanceCategory.transit', 'ترانزيت')}</strong>: {t('clearanceCategory.transitDesc', 'بضائع تمر عبر تركيا إلى العراق/سوريا')}</p>
          <p>• <strong>{t('clearanceCategory.domestic', 'محلي')}</strong>: {t('clearanceCategory.domesticDesc', 'بضائع تبقى في تركيا للاستهلاك المحلي')}</p>
          <p>• <strong>{t('clearanceCategory.customClearance', 'تخليص جمركي')}</strong>: {t('clearanceCategory.customClearanceDesc', 'تخليص قياسي مع دفع الرسوم الجمركية')}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('shipments.shippingLine')}
        </label>
        <div data-field-name="shipping_line_id">
        <AutocompleteInput
          type="shippingLine"
          value={formData.shipping_line_id}
          displayValue={formData.shipping_line_name || ''}
          onChange={(id, name) => {
            onChange('shipping_line_id', id || '');
            onChange('shipping_line_name', name || '');
          }}
          placeholder={t('shipments.wizard.shippingLinePlaceholder', 'Search shipping line...')}
          className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.shipping_line_id ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        </div>
        {errors.shipping_line_id && (
          <p className="mt-1 text-sm text-red-600">{errors.shipping_line_id}</p>
        )}
      </div>

      {/* Transportation Cost with Responsibility Selector */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h5 className="text-sm font-semibold text-gray-800 mb-3">
          {t('shipments.wizard.transportationCost', 'تكلفة النقل / Transportation Cost')}
        </h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cost Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('shipments.wizard.transportCostAmount', 'المبلغ / Amount')}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 start-0 flex items-center ps-4 text-gray-500">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                data-field-name="transportation_cost"
                value={formData.transportation_cost}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty string, numbers, and decimal point
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    onChange('transportation_cost', value === '' ? '' : Number(value) || value);
                  }
                }}
                className={`w-full ps-8 pe-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.transportation_cost ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Responsibility Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('shipments.wizard.transportResponsibility', 'المسؤولية / Responsibility')}
              {formData.transportation_cost && !formData.transport_cost_responsibility && (
                <span className="text-amber-600 text-xs ms-1">*</span>
              )}
            </label>
            <select
              data-field-name="transport_cost_responsibility"
              value={formData.transport_cost_responsibility || ''}
              onChange={(e) => onChange('transport_cost_responsibility', e.target.value)}
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                (formData.transportation_cost && !formData.transport_cost_responsibility) 
                  ? 'border-amber-500 bg-amber-50' 
                  : 'border-gray-300'
              }`}
            >
              <option value="">{t('common.select', 'اختر...')}</option>
              {TRANSPORT_RESPONSIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} / {option.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Warning if cost entered but responsibility not selected */}
        {formData.transportation_cost && !formData.transport_cost_responsibility && (
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
            <ExclamationCircleIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              {t('shipments.wizard.transportResponsibilityWarning', 
                'يرجى تحديد المسؤول عن تكلفة النقل لتفعيل الحساب المالي الصحيح'
              )}
            </p>
          </div>
        )}

        {/* Info about financial impact */}
        {formData.transport_cost_responsibility === 'ours' && formData.transportation_cost && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✓ {t('shipments.wizard.transportCostOursNote', 
                'سيتم احتساب هذه التكلفة ضمن تكلفة البضاعة المباعة (COGS)'
              )}
            </p>
          </div>
        )}

        {formData.transport_cost_responsibility === 'counterparty' && formData.transportation_cost && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              ℹ️ {t('shipments.wizard.transportCostCounterpartyNote', 
                'تكلفة مرجعية فقط - لن تُحتسب ضمن مصاريفنا'
              )}
            </p>
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500">
          {t(
            'shipments.wizard.transportationCostHint',
            'اختياري - يمكن إضافتها لاحقاً إذا لم تكن متوفرة الآن'
          )}
        </p>
        {errors.transportation_cost && (
          <p className="mt-1 text-sm text-red-600">{errors.transportation_cost}</p>
        )}
        {errors.transport_cost_responsibility && (
          <p className="mt-1 text-sm text-red-600">{errors.transport_cost_responsibility}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('shipments.bookingNo')}
          </label>
          <input
            type="text"
            data-field-name="booking_no"
            value={formData.booking_no}
            onChange={(e) => onChange('booking_no', e.target.value)}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.booking_no ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={t('shipments.wizard.bookingNoPlaceholder', 'Enter booking number')}
          />
          {errors.booking_no && (
            <p className="mt-1 text-sm text-red-600">{errors.booking_no}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('shipments.blNo')}
          </label>
          <input
            type="text"
            data-field-name="bl_no"
            value={formData.bl_no}
            onChange={(e) => onChange('bl_no', e.target.value)}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.bl_no ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={t('shipments.wizard.blNoPlaceholder', 'Enter B/L number')}
          />
          {errors.bl_no && <p className="mt-1 text-sm text-red-600">{errors.bl_no}</p>}
        </div>
      </div>

      {formData.cargo_type && (
        <div className="border-t pt-6 mt-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {t('shipments.wizard.trackingInfo', 'Tracking Information')}
          </h4>

          <div className="grid grid-cols-1 gap-6">
            {isFreightContainers && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t('shipments.wizard.containerDetails', 'Container Details')}
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('shipments.wizard.containerDetailsHint', 'Enter details for each container including weights and package count')}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-action="add-container"
                    onClick={handleAddContainer}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {t('shipments.wizard.addContainer', 'Add Container')}
                  </button>
                </div>
                
                {(!formData.containers || formData.containers.length === 0) ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-sm text-gray-500 mb-3">
                      {t('shipments.wizard.noContainers', 'No containers added yet')}
                    </p>
                    <button
                      type="button"
                      data-action="add-container"
                      onClick={handleAddContainer}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      <PlusIcon className="h-5 w-5" />
                      {t('shipments.wizard.addFirstContainer', 'Add First Container')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.containers.map((container, index) => (
                      <div key={container.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-700">
                            {t('shipments.wizard.container', 'Container')} #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveContainer(index)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title={t('common.remove', 'Remove')}
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('shipments.wizard.containerNumber', 'Container ID')} *
                            </label>
                            <input
                              type="text"
                              data-field-name="containers"
                              value={container.container_number}
                              onChange={(e) => handleContainerFieldChange(index, 'container_number', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="ABCD1234567"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('shipments.wizard.netWeight', 'Net Weight (kg)')}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={container.net_weight_kg}
                              onChange={(e) => handleContainerFieldChange(index, 'net_weight_kg', e.target.value ? parseFloat(e.target.value) : '')}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('shipments.wizard.grossWeight', 'Gross Weight (kg)')}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={container.gross_weight_kg}
                              onChange={(e) => handleContainerFieldChange(index, 'gross_weight_kg', e.target.value ? parseFloat(e.target.value) : '')}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('shipments.wizard.packageCount', 'Packages')}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={container.package_count}
                              onChange={(e) => handleContainerFieldChange(index, 'package_count', e.target.value ? parseInt(e.target.value) : '')}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('shipments.wizard.sealNumber', 'Seal #')}
                            </label>
                            <input
                              type="text"
                              value={container.seal_number || ''}
                              onChange={(e) => handleContainerFieldChange(index, 'seal_number', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isGeneralCargo && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipments.wizard.vesselName', 'Vessel Name')}
                  </label>
                  <input
                    type="text"
                    data-field-name="vessel_name"
                    value={formData.vessel_name}
                    onChange={(e) => onChange('vessel_name', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.vessel_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={t('shipments.wizard.vesselNamePlaceholder', 'Enter vessel name')}
                  />
                  {errors.vessel_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.vessel_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipments.wizard.vesselIMO', 'Vessel IMO Number')}
                  </label>
                  <input
                    type="text"
                    data-field-name="vessel_imo"
                    value={formData.vessel_imo}
                    onChange={(e) => onChange('vessel_imo', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.vessel_imo ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={t('shipments.wizard.vesselIMOPlaceholder', 'Enter IMO number')}
                  />
                  {errors.vessel_imo && (
                    <p className="mt-1 text-sm text-red-600">{errors.vessel_imo}</p>
                  )}
                </div>
              </>
            )}

            {isTrucks && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipments.wizard.truckPlate', 'Truck Plate Number')}
                  </label>
                  <input
                    type="text"
                    data-field-name="truck_plate_number"
                    value={formData.truck_plate_number}
                    onChange={(e) => onChange('truck_plate_number', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.truck_plate_number ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={t('shipments.wizard.truckPlatePlaceholder', 'Enter truck plate number')}
                  />
                  {errors.truck_plate_number && (
                    <p className="mt-1 text-sm text-red-600">{errors.truck_plate_number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipments.wizard.cmr', 'CMR Number')}
                  </label>
                  <input
                    type="text"
                    data-field-name="cmr"
                    value={formData.cmr}
                    onChange={(e) => onChange('cmr', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.cmr ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={t('shipments.wizard.cmrPlaceholder', 'Enter CMR number')}
                  />
                  {errors.cmr && (
                    <p className="mt-1 text-sm text-red-600">{errors.cmr}</p>
                  )}
                </div>
              </>
            )}

            {isTankers && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipments.wizard.tankerName', 'Tanker Name')}
                  </label>
                  <input
                    type="text"
                    data-field-name="tanker_name"
                    value={formData.tanker_name}
                    onChange={(e) => onChange('tanker_name', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.tanker_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={t('shipments.wizard.tankerNamePlaceholder', 'Enter tanker name')}
                  />
                  {errors.tanker_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.tanker_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('shipments.wizard.tankerIMO', 'Tanker IMO Number')}
                  </label>
                  <input
                    type="text"
                    data-field-name="tanker_imo"
                    value={formData.tanker_imo}
                    onChange={(e) => onChange('tanker_imo', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.tanker_imo ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={t('shipments.wizard.tankerIMOPlaceholder', 'Enter IMO number')}
                  />
                  {errors.tanker_imo && (
                    <p className="mt-1 text-sm text-red-600">{errors.tanker_imo}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('shipments.wizard.step3Title', 'Logistics Details')}
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {t('shipments.wizard.step3Description', 'Enter shipping and logistics information')}
        </p>
      </div>

      {/* Validation Banner for date logic */}
      <ValidationBanner
        errors={validation.errors}
        warnings={validation.warnings}
        acknowledgedWarnings={acknowledgedWarnings}
        onAcknowledgeWarning={onAcknowledgeWarning}
        onAcknowledgeAll={onAcknowledgeAll}
        showAcknowledgeButton={true}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="split-shipment-toggle"
            data-field-name="is_split_shipment"
            checked={formData.is_split_shipment}
            onChange={(e) => onChange('is_split_shipment', e.target.checked)}
            className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
          />
          <div className="flex-1">
            <label
              htmlFor="split-shipment-toggle"
              className="text-sm font-semibold text-gray-900 cursor-pointer"
            >
              📦 {t('shipments.wizard.splitIntoMultipleBatches', 'Split into Multiple Batches')}
            </label>
            <p className="text-xs text-gray-600 mt-1">
              {t(
                'shipments.wizard.splitShipmentHint',
                'Enable this if your order will be shipped in multiple batches with different vessels, containers, or dates. Each batch can be tracked separately.'
              )}
            </p>
          </div>
        </div>
      </div>

      {formData.is_split_shipment ? (
        <BatchManagement
          formData={formData}
          batches={formData.batches}
          onChange={(batches) => onChange('batches', batches)}
        />
      ) : (
        <>
          {singleShipmentContent}

          {/* Notes for single shipment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.notes')}
            </label>
            <textarea
              data-field-name="notes"
              value={formData.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              rows={4}
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.notes ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('shipments.wizard.notesPlaceholder', 'Add any additional notes...')}
            />
            {errors.notes && <p className="mt-1 text-sm text-red-600">{errors.notes}</p>}
          </div>
        </>
      )}
    </div>
  );
}
