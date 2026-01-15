/**
 * Contract Wizard V2 - Step 2: Shipping & Geography
 * Country of origin, destination, ports, vessel info
 */

import { useTranslation } from 'react-i18next';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import type { ContractFormData } from './types';
import { AutocompleteInput } from '../../common/AutocompleteInput';

interface Step2Props {
  data: ContractFormData;
  onChange: (section: keyof ContractFormData, field: string, value: any) => void;
}

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 
  'Brazil', 'Canada', 'China', 'Egypt', 'France', 'Germany', 'Greece', 'India', 'Indonesia', 'Iran', 
  'Iraq', 'Ireland', 'Italy', 'Japan', 'Jordan', 'Kuwait', 'Lebanon', 'Malaysia', 'Mexico', 
  'Netherlands', 'Pakistan', 'Philippines', 'Poland', 'Qatar', 'Russia', 'Saudi Arabia', 'Singapore', 
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Syria', 'Thailand', 
  'Turkey', 'UAE', 'UK', 'Ukraine', 'USA', 'Vietnam', 'Yemen'
].sort();

export function Step2ShippingGeography({ data, onChange }: Step2Props) {
  const { t } = useTranslation();

  const handleChange = (field: string, value: any) => {
    onChange('shipping', field, value);
  };

  return (
    <div className="space-y-8">
      {/* Header - data-field-name="shipping" for section-level field highlighting */}
      <div data-field-name="shipping" className="bg-green-50 p-4 rounded-lg border border-green-200">
        <div className="flex items-center gap-3 mb-2">
          <GlobeAltIcon className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-semibold text-green-900">
            {t('contracts.shippingGeography', 'Shipping & Geography')}
          </h3>
        </div>
        <p className="text-sm text-green-700">
          {t('contracts.shippingGeographyDesc', 'Origin, destination, and routing information')}
        </p>
      </div>

      {/* Countries */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('contracts.countries', 'Countries')}
        </h4>
        
        {/* Info Box explaining country concepts */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 {t('contracts.countryFieldsExplanation', 'Country Fields Explanation')}:</strong>
          </p>
          <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
            <li><strong>{t('contracts.countryOfExport', 'Country of Export')}</strong>: {t('contracts.countryOfExportDesc', 'Country of the Port of Loading (POL). Not necessarily where goods originate.')}</li>
            <li><strong>{t('contracts.countryOfOriginGoods', 'Country of Origin')}</strong>: {t('contracts.countryOfOriginDesc', 'Where goods actually originate. Set per product in Step 4 (Product Lines).')}</li>
            <li><strong>{t('contracts.countryOfDestination', 'Country of Destination')}</strong>: {t('contracts.countryOfDestinationDesc', 'Final beneficiary country where goods will be delivered.')}</li>
          </ul>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="contract_country_of_export" className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.countryOfExport', 'Country of Export (POL Country)')} *
            </label>
            <input
              id="contract_country_of_export"
              type="text"
              list="contract-countries-export-list"
              data-field-name="country_of_export"
              value={data.shipping.country_of_export || ''}
              onChange={(e) => handleChange('country_of_export', e.target.value)}
              placeholder={t('contracts.countryOfExportPlaceholder', 'Country of Port of Loading...')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <datalist id="contract-countries-export-list">
              {COUNTRIES.map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-500">
              {t('contracts.countryOfExportHint', 'The country where goods are loaded for export (e.g., Singapore, UAE)')}
            </p>
          </div>

          <div>
            <label htmlFor="contract_country_of_destination" className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.countryOfDestination', 'Country of Final Destination')} *
            </label>
            <input
              id="contract_country_of_destination"
              type="text"
              list="contract-countries-dest-list"
              data-field-name="country_of_final_destination"
              value={data.shipping.country_of_final_destination || ''}
              onChange={(e) => handleChange('country_of_final_destination', e.target.value)}
              placeholder={t('contracts.countryOfDestinationPlaceholder', 'Type or select a country...')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <datalist id="contract-countries-dest-list">
              {COUNTRIES.map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
          </div>
        </div>
        
        {/* Note about Country of Origin */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>📦 {t('contracts.countryOfOriginNote', 'Country of Origin of Goods')}:</strong>{' '}
            {t('contracts.countryOfOriginNoteDesc', 'Set per product line in Step 4. Different products can have different origins (e.g., Vietnamese pepper + Brazilian pepper in same shipment).')}
          </p>
        </div>
      </div>

      {/* Ports & Locations */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('contracts.portsLocations', 'Ports & Locations')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.portOfLoading', 'Port of Loading (POL)')}
            </label>
            <AutocompleteInput
              type="port"
              data-field-name="port_of_loading_id"
              value={data.shipping.port_of_loading_id || ''}
              displayValue={data.shipping.port_of_loading_name || ''}
              onChange={(id, name) => {
                handleChange('port_of_loading_id', id || undefined);
                handleChange('port_of_loading_name', name || undefined);
              }}
              placeholder={t('contracts.selectPOL', 'Select port of loading...')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.portOfDischarge', 'Port of Discharge (POD)')}
            </label>
            <AutocompleteInput
              type="port"
              data-field-name="final_destination_id"
              value={data.shipping.final_destination_id || ''}
              displayValue={data.shipping.final_destination_name || ''}
              onChange={(id, name) => {
                handleChange('final_destination_id', id || undefined);
                handleChange('final_destination_name', name || undefined);
              }}
              placeholder={t('contracts.selectPOD', 'Select port of discharge...')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Pre-carriage & Vessel (Optional) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('contracts.transportDetails', 'Transport Details')} ({t('common.optional', 'Optional')})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.preCarriageBy', 'Pre-Carriage By')}
            </label>
            <input
              type="text"
              data-field-name="pre_carriage_by"
              value={data.shipping.pre_carriage_by || ''}
              onChange={(e) => handleChange('pre_carriage_by', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Truck, Rail, Barge, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.placeOfReceipt', 'Place of Receipt')}
            </label>
            <input
              type="text"
              data-field-name="place_of_receipt"
              value={data.shipping.place_of_receipt || ''}
              onChange={(e) => handleChange('place_of_receipt', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Warehouse, Factory, etc."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.vesselFlightNo', 'Vessel/Flight No.')}
            </label>
            <input
              type="text"
              data-field-name="vessel_flight_no"
              value={data.shipping.vessel_flight_no || ''}
              onChange={(e) => handleChange('vessel_flight_no', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Vessel name or flight number (if known)"
            />
          </div>
        </div>
      </div>

      {/* Estimated Shipment Date */}
      <div className="bg-white border border-blue-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('contracts.estimatedShipmentDate', 'Estimated Date/Period of Shipment')}
        </h4>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.shipmentDate', 'Shipment Month/Year')}
            </label>
            <input
              type="month"
              data-field-name="estimated_shipment_date"
              value={data.shipping.estimated_shipment_date || ''}
              onChange={(e) => handleChange('estimated_shipment_date', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500">
              {t('contracts.shipmentDateHint', 'Specify the expected month and year for shipment. If not specified, defaults to 1 month from contract creation date.')}
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <p className="text-sm text-yellow-800">
          <strong>{t('common.tip', 'Tip')}:</strong> {t('contracts.step2Tip', 'Country of Export and Destination are required. Country of Origin is set per product in Step 4.')}
        </p>
      </div>
    </div>
  );
}

