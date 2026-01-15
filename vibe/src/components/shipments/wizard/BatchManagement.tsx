import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { AutocompleteInput } from '../../common/AutocompleteInput';
import { DateInput } from '../../common/DateInput';
import { DocumentUploadSection } from './DocumentUploadSection';
import type { ShipmentBatch, ShipmentFormData } from './types';

interface BatchManagementProps {
  formData: ShipmentFormData;
  batches: ShipmentBatch[];
  onChange: (batches: ShipmentBatch[]) => void;
}

export function BatchManagement({ formData, batches, onChange }: BatchManagementProps) {
  const { t } = useTranslation();
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const isFreightContainers = formData.cargo_type === 'containers';
  const isGeneralCargo = formData.cargo_type === 'general_cargo';
  const isTrucks = formData.cargo_type === 'trucks';
  const isTankers = formData.cargo_type === 'tankers';
  const isCrudeOil = isTankers && formData.tanker_type === 'crude_oil';

  const createEmptyBatch = (): ShipmentBatch => ({
    id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    batch_number: `${batches.length + 1}`,
    batch_name: '',
    weight_ton: '',
    container_count: '',
    barrels: '',
    pol_id: formData.pol_id, // Pre-fill from parent shipment
    pod_id: formData.pod_id,
    etd: '',
    eta: '',
    shipping_line_id: formData.shipping_line_id,
    booking_no: '',
    bl_no: '',
    bol_numbers: [],
    container_numbers: [],
    container_number: '',
    vessel_name: '',
    vessel_imo: '',
    truck_plate_number: '',
    cmr: '',
    tanker_name: '',
    tanker_imo: '',
    documents: [],
    status: 'planning',
    notes: '',
  });

  const handleAddBatch = () => {
    const newBatch = createEmptyBatch();
    onChange([...batches, newBatch]);
    setExpandedBatch(newBatch.id);
  };

  const handleRemoveBatch = (batchId: string) => {
    const updatedBatches = batches.filter(b => b.id !== batchId);
    // Re-number remaining batches
    updatedBatches.forEach((batch, index) => {
      batch.batch_number = `${index + 1}`;
    });
    onChange(updatedBatches);
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
    }
  };

  const handleBatchChange = (batchId: string, field: keyof ShipmentBatch, value: any) => {
    const updatedBatches = batches.map(batch =>
      batch.id === batchId ? { ...batch, [field]: value } : batch
    );
    onChange(updatedBatches);
  };

  const toggleExpanded = (batchId: string) => {
    setExpandedBatch(expandedBatch === batchId ? null : batchId);
  };

  // Calculate totals for display
  const totalWeight = batches.reduce((sum, b) => sum + (Number(b.weight_ton) || 0), 0);
  const totalContainers = batches.reduce((sum, b) => sum + (Number(b.container_count) || 0), 0);
  const totalBarrels = batches.reduce((sum, b) => sum + (Number(b.barrels) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-md font-semibold text-gray-900">
            📦 {t('shipments.wizard.batches', 'Shipment Batches')}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {t('shipments.wizard.batchesHint', 'Split this order into multiple batches for tracking')}
          </p>
          {batches.length > 0 && (
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-gray-600">
                {t('shipments.wizard.totalBatches', 'Total Batches')}: <strong>{batches.length}</strong>
              </span>
              {totalWeight > 0 && (
                <span className="text-gray-600">
                  {t('shipments.wizard.totalWeight', 'Total Weight')}: <strong>{totalWeight.toFixed(2)} {formData.weight_unit}</strong>
                </span>
              )}
              {totalContainers > 0 && (
                <span className="text-gray-600">
                  {t('shipments.wizard.totalContainers', 'Total Containers')}: <strong>{totalContainers}</strong>
                </span>
              )}
              {totalBarrels > 0 && (
                <span className="text-gray-600">
                  {t('shipments.wizard.totalBarrels', 'Total Barrels')}: <strong>{totalBarrels}</strong>
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddBatch}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 me-2" />
          {t('shipments.wizard.addBatch', 'Add Batch')}
        </button>
      </div>

      {/* Batches List */}
      {batches.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-500">
            {t('shipments.wizard.noBatches', 'No batches added yet. Click "Add Batch" to split this shipment.')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const isExpanded = expandedBatch === batch.id;
            return (
              <div
                key={batch.id}
                className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
              >
                {/* Batch Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleExpanded(batch.id)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                      {batch.batch_number}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {batch.batch_name || `${t('shipments.wizard.batch', 'Batch')} ${batch.batch_number}`}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          batch.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          batch.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                          batch.status === 'arrived' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {batch.status}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500 mt-1">
                        {batch.weight_ton && <span>⚖️ {batch.weight_ton} {formData.weight_unit}</span>}
                        {batch.container_count && <span>📦 {batch.container_count} containers</span>}
                        {batch.barrels && <span>🛢️ {batch.barrels} barrels</span>}
                        {batch.eta && <span>📅 ETA: {new Date(batch.eta).toLocaleDateString('en-GB')}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBatch(batch.id);
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title={t('common.delete', 'Delete')}
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Batch Details (Expanded) */}
                {isExpanded && (
                  <div className="p-4 space-y-6">
                    {/* Batch Name & Quantities */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('shipments.wizard.batchName', 'Batch Name')}
                        </label>
                        <input
                          type="text"
                          value={batch.batch_name}
                          onChange={(e) => handleBatchChange(batch.id, 'batch_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t('shipments.wizard.batchNamePlaceholder', 'e.g., First Shipment, Vessel A')}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('shipments.wizard.status', 'Status')}
                        </label>
                        <select
                          value={batch.status}
                          onChange={(e) => handleBatchChange(batch.id, 'status', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="planning">{t('shipments.status.planning', 'Planning')}</option>
                          <option value="in_transit">{t('shipments.status.in_transit', 'In Transit')}</option>
                          <option value="arrived">{t('shipments.status.arrived', 'Arrived')}</option>
                          <option value="delivered">{t('shipments.status.delivered', 'Delivered')}</option>
                        </select>
                      </div>

                      {/* Weight */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('shipments.wizard.weight', 'Weight')} ({formData.weight_unit})
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={batch.weight_ton}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty string, numbers, and decimal point
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              handleBatchChange(batch.id, 'weight_ton', value === '' ? '' : Number(value) || value);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Containers (if cargo type is containers or general cargo) */}
                      {(isFreightContainers || isGeneralCargo) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {isGeneralCargo
                              ? t('shipments.wizard.units', 'Units')
                              : t('shipments.wizard.containerCount', 'Container Count')}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={batch.container_count}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Allow empty string and positive integers only
                              if (value === '' || /^\d+$/.test(value)) {
                                handleBatchChange(batch.id, 'container_count', value === '' ? '' : Number(value));
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                      )}

                      {/* Barrels (for crude oil) */}
                      {isCrudeOil && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('shipments.wizard.barrels', 'Barrels')}
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={batch.barrels}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Allow empty string, numbers, and decimal point
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                handleBatchChange(batch.id, 'barrels', value === '' ? '' : Number(value) || value);
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>

                    {/* Logistics Details */}
                    <div className="border-t pt-4">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3">
                        🚢 {t('shipments.wizard.logisticsDetails', 'Logistics Details')}
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* POL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('shipments.origin')} (POL)
                          </label>
                          <AutocompleteInput
                            type="port"
                            value={batch.pol_id}
                            onChange={(value) => handleBatchChange(batch.id, 'pol_id', value)}
                            placeholder={t('shipments.wizard.polPlaceholder', 'Search port...')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* POD */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('shipments.destination')} (POD)
                          </label>
                          <AutocompleteInput
                            type="port"
                            value={batch.pod_id}
                            onChange={(value) => handleBatchChange(batch.id, 'pod_id', value)}
                            placeholder={t('shipments.wizard.podPlaceholder', 'Search port...')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* ETD */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('shipments.etd', 'ETD')}
                          </label>
                          <DateInput
                            value={batch.etd}
                            onChange={(val) => handleBatchChange(batch.id, 'etd', val)}
                            className="w-full border-gray-300"
                          />
                        </div>

                        {/* ETA */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('shipments.eta', 'ETA')}
                          </label>
                          <DateInput
                            value={batch.eta}
                            onChange={(val) => handleBatchChange(batch.id, 'eta', val)}
                            className="w-full border-gray-300"
                          />
                        </div>

                        {/* Shipping Line */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('shipments.shippingLine')}
                          </label>
                          <AutocompleteInput
                            type="shippingLine"
                            value={batch.shipping_line_id}
                            onChange={(value) => handleBatchChange(batch.id, 'shipping_line_id', value)}
                            placeholder={t('shipments.wizard.shippingLinePlaceholder', 'Search shipping line...')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* Booking No */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('shipments.bookingNo')}
                          </label>
                          <input
                            type="text"
                            value={batch.booking_no}
                            onChange={(e) => handleBatchChange(batch.id, 'booking_no', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={t('shipments.wizard.bookingNoPlaceholder', 'Enter booking number')}
                          />
                        </div>

                        {/* BL No */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('shipments.blNo')}
                          </label>
                          <input
                            type="text"
                            value={batch.bl_no}
                            onChange={(e) => handleBatchChange(batch.id, 'bl_no', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={t('shipments.wizard.blNoPlaceholder', 'Enter B/L number')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cargo-Specific Tracking */}
                    <div className="border-t pt-4">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3">
                        {t('shipments.wizard.trackingInfo', 'Tracking Information')}
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Freight Containers: Container Number */}
                        {isFreightContainers && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {t('shipments.wizard.containerNumber', 'Container Number')}
                            </label>
                            <input
                              type="text"
                              value={batch.container_number}
                              onChange={(e) => handleBatchChange(batch.id, 'container_number', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder={t('shipments.wizard.containerNumberPlaceholder', 'Enter container number')}
                            />
                          </div>
                        )}

                        {/* General Cargo: Vessel */}
                        {isGeneralCargo && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('shipments.wizard.vesselName', 'Vessel Name')}
                              </label>
                              <input
                                type="text"
                                value={batch.vessel_name}
                                onChange={(e) => handleBatchChange(batch.id, 'vessel_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder={t('shipments.wizard.vesselNamePlaceholder', 'Enter vessel name')}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('shipments.wizard.vesselIMO', 'Vessel IMO')}
                              </label>
                              <input
                                type="text"
                                value={batch.vessel_imo}
                                onChange={(e) => handleBatchChange(batch.id, 'vessel_imo', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder={t('shipments.wizard.vesselIMOPlaceholder', 'Enter IMO')}
                              />
                            </div>
                          </>
                        )}

                        {/* Trucks */}
                        {isTrucks && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('shipments.wizard.truckPlate', 'Truck Plate')}
                              </label>
                              <input
                                type="text"
                                value={batch.truck_plate_number}
                                onChange={(e) => handleBatchChange(batch.id, 'truck_plate_number', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder={t('shipments.wizard.truckPlatePlaceholder', 'Enter truck plate')}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('shipments.wizard.cmr', 'CMR')}
                              </label>
                              <input
                                type="text"
                                value={batch.cmr}
                                onChange={(e) => handleBatchChange(batch.id, 'cmr', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder={t('shipments.wizard.cmrPlaceholder', 'Enter CMR')}
                              />
                            </div>
                          </>
                        )}

                        {/* Tankers */}
                        {isTankers && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('shipments.wizard.tankerName', 'Tanker Name')}
                              </label>
                              <input
                                type="text"
                                value={batch.tanker_name}
                                onChange={(e) => handleBatchChange(batch.id, 'tanker_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder={t('shipments.wizard.tankerNamePlaceholder', 'Enter tanker name')}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('shipments.wizard.tankerIMO', 'Tanker IMO')}
                              </label>
                              <input
                                type="text"
                                value={batch.tanker_imo}
                                onChange={(e) => handleBatchChange(batch.id, 'tanker_imo', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder={t('shipments.wizard.tankerIMOPlaceholder', 'Enter IMO')}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Documents for this batch */}
                    <div className="border-t pt-4 mt-4">
                      <DocumentUploadSection
                        direction={formData.transaction_type}
                        documents={batch.documents}
                        onChange={(docs) => handleBatchChange(batch.id, 'documents', docs)}
                      />
                    </div>

                    {/* Notes */}
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('common.notes')}
                      </label>
                      <textarea
                        value={batch.notes}
                        onChange={(e) => handleBatchChange(batch.id, 'notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t('shipments.wizard.batchNotesPlaceholder', 'Notes for this batch...')}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

