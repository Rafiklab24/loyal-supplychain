import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, DocumentTextIcon, MapPinIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useDeliveryMutations, useDestinationSuggestions } from '../../hooks/useLandTransport';
import type { ReadyForDeliveryShipment, OutboundDelivery, CreateDeliveryInput, DeliveryStatus, ContainerDetailAPI } from '../../types/api';
import { TransportCompanySelect } from './TransportCompanySelect';
import { useBorderCrossings } from '../../hooks/useBorderCrossings';
import type { BorderCrossing } from '../../services/borderCrossings';
import { DateInput } from '../common/DateInput';

interface DeliveryFormModalProps {
  shipment?: ReadyForDeliveryShipment | null;
  container?: ContainerDetailAPI | null;
  delivery?: OutboundDelivery | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeliveryFormModal: React.FC<DeliveryFormModalProps> = ({
  shipment,
  container,
  delivery,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const isEditing = !!delivery;
  
  const { create, update, loading } = useDeliveryMutations();
  const { suggestions: destinationSuggestions } = useDestinationSuggestions();
  
  const [formData, setFormData] = useState<CreateDeliveryInput & { border_crossing_id?: string | null; border_eta?: string | null; delivery_leg?: string }>({
    delivery_date: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    shipment_id: null,
    container_id: '',
    transport_company_id: null,
    driver_name: '',
    driver_phone: '',
    truck_plate_number: '',
    vehicle_type: '',
    transport_cost: null,
    transport_currency: 'USD',
    insurance_cost: null,
    package_count: null,
    weight_kg: null,
    goods_description: '',
    customer_name: '',
    customer_phone: '',
    customer_reference: '',
    selling_price: null,
    currency: 'USD',
    status: 'pending' as DeliveryStatus,
    notes: '',
    border_crossing_id: null,
    border_eta: null,
    delivery_leg: 'pod_to_fd',
  });
  
  // Currency options for transport costs
  const TRANSPORT_CURRENCIES = [
    { code: 'USD', symbol: '$' },
    { code: 'TRY', symbol: '₺' },
    { code: 'EUR', symbol: '€' },
  ];
  
  const getCurrencySymbol = (code: string) => {
    const curr = TRANSPORT_CURRENCIES.find(c => c.code === code);
    return curr?.symbol || '$';
  };
  
  // Get border crossings for dropdown
  const borderCrossingsQuery = useBorderCrossings();
  const borderCrossings = borderCrossingsQuery.data?.data || [];
  
  // Check if the linked shipment is cross-border
  const isCrossBorder = shipment?.is_cross_border || false;
  
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (delivery) {
      setFormData({
        delivery_date: delivery.delivery_date,
        origin: delivery.origin || '',
        destination: delivery.destination,
        shipment_id: delivery.shipment_id,
        container_id: delivery.container_id || '',
        transport_company_id: delivery.transport_company_id,
        driver_name: delivery.driver_name || '',
        driver_phone: delivery.driver_phone || '',
        truck_plate_number: delivery.truck_plate_number || '',
        vehicle_type: delivery.vehicle_type || '',
        transport_cost: delivery.transport_cost,
        transport_currency: delivery.transport_currency || 'USD',
        insurance_cost: delivery.insurance_cost,
        package_count: delivery.package_count,
        weight_kg: delivery.weight_kg,
        goods_description: delivery.goods_description || '',
        customer_name: delivery.customer_name || '',
        customer_phone: delivery.customer_phone || '',
        customer_reference: delivery.customer_reference || '',
        selling_price: delivery.selling_price,
        currency: delivery.currency || 'USD',
        status: delivery.status,
        notes: delivery.notes || '',
        border_crossing_id: (delivery as any).border_crossing_id || null,
        border_eta: (delivery as any).border_eta || null,
        delivery_leg: (delivery as any).delivery_leg || 'pod_to_fd',
      });
    } else if (shipment) {
      // Use container-specific data if available, otherwise use shipment-level data
      // Pre-fill border crossing from shipment if it's a cross-border shipment
      setFormData(prev => ({
        ...prev,
        shipment_id: shipment.id,
        container_id: container?.container_number || shipment.container_number || '',
        goods_description: shipment.product_text || '',
        weight_kg: container?.net_weight_kg || (shipment.weight_ton ? Number(shipment.weight_ton) * 1000 : null),
        package_count: container?.package_count || null,
        customer_name: shipment.final_beneficiary_name || shipment.supplier_name || '',
        origin: shipment.pod_name || '',
        // Border crossing fields - pre-fill from shipment
        border_crossing_id: (shipment as any).primary_border_crossing_id || null,
        delivery_leg: shipment.is_cross_border ? 'pod_to_border' : 'pod_to_fd',
      }));
    }
  }, [delivery, shipment, container]);

  const handleChange = (field: keyof CreateDeliveryInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationError(null);
  };

  const handleDestinationSelect = (destination: string) => {
    handleChange('destination', destination);
    setShowDestinationSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.destination?.trim()) {
      setValidationError(t('landTransport.destinationRequired', 'Destination is required'));
      return;
    }

    let result;
    if (isEditing && delivery) {
      result = await update(delivery.id, formData);
    } else {
      result = await create(formData);
    }

    if (result) {
      onSuccess();
    }
  };

  // Shared input styles
  const inputClasses = "w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
  const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const sectionTitleClasses = "text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditing ? t('landTransport.editDelivery', 'Edit Delivery') : t('landTransport.newDelivery', 'New Delivery')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="delivery-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Validation Error Alert */}
            {validationError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {validationError}
              </div>
            )}

            {/* Linked Shipment Info */}
            {shipment && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-3">
                <DocumentTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                    {t('landTransport.linkedShipment', 'Linked Shipment')}
                  </h3>
                  <div className="text-sm text-blue-700 dark:text-blue-400 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1">
                    <p>SN: {shipment.sn}</p>
                    <p>Product: {shipment.product_text}</p>
                    <p>Weight: {shipment.weight_ton} MT</p>
                  </div>
                </div>
              </div>
            )}

            {/* Section 1: Route & Basic Info */}
            <div>
              <h3 className={sectionTitleClasses}>{t('landTransport.routeAndInfo', 'Route & Information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClasses}>{t('landTransport.deliveryDate', 'Delivery Date')} *</label>
                  <DateInput
                    value={formData.delivery_date || ''}
                    onChange={(val) => handleChange('delivery_date', val)}
                    className={inputClasses}
                  />
                </div>
                
                <div>
                  <label className={labelClasses}>{t('landTransport.status', 'Status')}</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className={inputClasses}
                  >
                    <option value="pending">{t('landTransport.statusPending', 'Pending')}</option>
                    <option value="in_transit">{t('landTransport.statusInTransit', 'In Transit')}</option>
                    <option value="delivered">{t('landTransport.statusDelivered', 'Delivered')}</option>
                  </select>
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.origin', 'Origin')}</label>
                  <input
                    type="text"
                    value={formData.origin || ''}
                    onChange={(e) => handleChange('origin', e.target.value)}
                    className={inputClasses}
                    placeholder={t('landTransport.originPlaceholder', 'Warehouse / Port...')}
                  />
                </div>

                <div className="relative">
                  <label className={labelClasses}>{t('landTransport.destination', 'Destination')} *</label>
                  <input
                    type="text"
                    required
                    value={formData.destination || ''}
                    onChange={(e) => handleChange('destination', e.target.value)}
                    onFocus={() => setShowDestinationSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowDestinationSuggestions(false), 200)}
                    className={inputClasses}
                    placeholder={t('landTransport.destinationPlaceholder', 'Enter destination...')}
                    autoComplete="off"
                  />
                  {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {destinationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleDestinationSelect(suggestion)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Border Crossing (only for cross-border shipments) */}
            {isCrossBorder && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <MapPinIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">
                    {t('landTransport.borderCrossing', 'Border Crossing')}
                  </h3>
                </div>
                
                {/* Route Display */}
                {shipment && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 mb-4 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                    <span>{shipment.pod_name || 'POD'}</span>
                    <ArrowRightIcon className="w-4 h-4" />
                    <span className="font-medium">🚧 {t('landTransport.border', 'Border')}</span>
                    <ArrowRightIcon className="w-4 h-4" />
                    <span>{shipment.final_destination_place || 'Final Destination'}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Border Crossing Select */}
                  <div>
                    <label className={labelClasses}>{t('landTransport.selectBorderCrossing', 'Border Crossing Point')}</label>
                    <select
                      value={formData.border_crossing_id || ''}
                      onChange={(e) => handleChange('border_crossing_id', e.target.value || null)}
                      className={inputClasses}
                    >
                      <option value="">{t('common.select', 'Select...')}</option>
                      {borderCrossings.map((bc: BorderCrossing) => (
                        <option key={bc.id} value={bc.id}>
                          {bc.name} ({bc.country_from} → {bc.country_to})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Border ETA */}
                  <div>
                    <label className={labelClasses}>{t('landTransport.borderEta', 'Estimated Arrival at Border')}</label>
                    <DateInput
                      value={formData.border_eta || ''}
                      onChange={(val) => handleChange('border_eta', val || null)}
                      className={inputClasses}
                    />
                  </div>

                  {/* Delivery Leg */}
                  <div className="md:col-span-2">
                    <label className={labelClasses}>{t('landTransport.deliveryLeg', 'Delivery Leg')}</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="delivery_leg"
                          value="pod_to_border"
                          checked={formData.delivery_leg === 'pod_to_border'}
                          onChange={() => handleChange('delivery_leg', 'pod_to_border')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {t('landTransport.podToBorder', 'POD → Border')}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="delivery_leg"
                          value="border_to_fd"
                          checked={formData.delivery_leg === 'border_to_fd'}
                          onChange={() => handleChange('delivery_leg', 'border_to_fd')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {t('landTransport.borderToFd', 'Border → Final Destination')}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="delivery_leg"
                          value="pod_to_fd"
                          checked={formData.delivery_leg === 'pod_to_fd'}
                          onChange={() => handleChange('delivery_leg', 'pod_to_fd')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {t('landTransport.podToFdDirect', 'POD → FD (Direct)')}
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('landTransport.deliveryLegHint', 'Select which part of the route this delivery covers')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Transport Details */}
            <div>
              <h3 className={sectionTitleClasses}>{t('landTransport.transportDetails', 'Transport Details')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClasses}>{t('landTransport.transportCompany', 'Transport Company')}</label>
                  <TransportCompanySelect
                    value={formData.transport_company_id}
                    onChange={(id) => handleChange('transport_company_id', id)}
                  />
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.vehicleType', 'Vehicle Type')}</label>
                  <input
                    type="text"
                    value={formData.vehicle_type || ''}
                    onChange={(e) => handleChange('vehicle_type', e.target.value)}
                    className={inputClasses}
                    placeholder="Truck type..."
                  />
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.truckPlate', 'Truck Plate Number')}</label>
                  <input
                    type="text"
                    value={formData.truck_plate_number || ''}
                    onChange={(e) => handleChange('truck_plate_number', e.target.value)}
                    className={inputClasses}
                    placeholder="ABC-123"
                  />
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.driverName', 'Driver Name')}</label>
                  <input
                    type="text"
                    value={formData.driver_name || ''}
                    onChange={(e) => handleChange('driver_name', e.target.value)}
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.driverPhone', 'Driver Phone')}</label>
                  <input
                    type="tel"
                    value={formData.driver_phone || ''}
                    onChange={(e) => handleChange('driver_phone', e.target.value)}
                    className={inputClasses}
                    placeholder="+90..."
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Cargo Details */}
            <div>
              <h3 className={sectionTitleClasses}>{t('landTransport.cargoDetails', 'Cargo Details')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className={labelClasses}>{t('landTransport.goodsDescription', 'Goods Description')}</label>
                  <input
                    type="text"
                    value={formData.goods_description || ''}
                    onChange={(e) => handleChange('goods_description', e.target.value)}
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.containerId', 'Container ID')}</label>
                  <input
                    type="text"
                    value={formData.container_id || ''}
                    onChange={(e) => handleChange('container_id', e.target.value)}
                    className={inputClasses}
                    placeholder="ABCD1234567"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClasses}>{t('landTransport.packageCount', 'Packages')}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.package_count || ''}
                      onChange={(e) => handleChange('package_count', e.target.value ? parseInt(e.target.value) : null)}
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>{t('landTransport.weightKg', 'Weight (kg)')}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={formData.weight_kg || ''}
                      onChange={(e) => handleChange('weight_kg', e.target.value ? parseFloat(e.target.value) : null)}
                      className={inputClasses}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Customer & Financials */}
            <div>
              <h3 className={sectionTitleClasses}>{t('landTransport.customerAndFinancials', 'Customer & Financials')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClasses}>{t('landTransport.customerName', 'Customer Name')}</label>
                  <input
                    type="text"
                    value={formData.customer_name || ''}
                    onChange={(e) => handleChange('customer_name', e.target.value)}
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.customerPhone', 'Customer Phone')}</label>
                  <input
                    type="tel"
                    value={formData.customer_phone || ''}
                    onChange={(e) => handleChange('customer_phone', e.target.value)}
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.transportCost', 'Transport Cost')}</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.transport_currency || 'USD'}
                      onChange={(e) => handleChange('transport_currency', e.target.value)}
                      className="w-20 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                    >
                      {TRANSPORT_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.transport_cost || ''}
                      onChange={(e) => handleChange('transport_cost', e.target.value ? parseFloat(e.target.value) : null)}
                      className={`flex-1 ${inputClasses}`}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClasses}>{t('landTransport.sellingPrice', 'Selling Price')}</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.currency || 'USD'}
                      onChange={(e) => handleChange('currency', e.target.value)}
                      className="w-20 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                    >
                      {TRANSPORT_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.selling_price || ''}
                      onChange={(e) => handleChange('selling_price', e.target.value ? parseFloat(e.target.value) : null)}
                      className={`flex-1 ${inputClasses}`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelClasses}>{t('common.notes', 'Notes')}</label>
              <textarea
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                className={inputClasses}
                placeholder="Additional notes..."
              />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            form="delivery-form"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            {loading ? t('common.processing', 'Processing...') : (isEditing ? t('common.save', 'Save') : t('common.create', 'Create'))}
          </button>
        </div>
      </div>
    </div>
  );
};
