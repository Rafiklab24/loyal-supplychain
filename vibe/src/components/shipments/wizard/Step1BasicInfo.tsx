import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { CubeIcon, BuildingOfficeIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { AutocompleteInput, type FuzzyMatchResult } from '../../common/AutocompleteInput';
import { FuzzyMatchWarningModal, type FuzzyMatch } from '../../common/FuzzyMatchWarningModal';
import { useBranches } from '../../../hooks/useBranches';
import { CIUploadSection } from './CIUploadSection';
import { BOLUploadSection } from './BOLUploadSection';
import { SourceImportSelector } from './SourceImportSelector';
import type { StepProps } from './types';

// Expanded countries list for country of origin dropdown - covers major trading partners
const COUNTRIES = [
  // Asia
  'Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia',
  'China', 'Georgia', 'Hong Kong', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 
  'Jordan', 'Kazakhstan', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Maldives', 
  'Mongolia', 'Myanmar', 'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 
  'Qatar', 'Saudi Arabia', 'Singapore', 'South Korea', 'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan', 
  'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan', 'UAE', 'Uzbekistan', 'Vietnam', 'Yemen',
  // Europe
  'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 
  'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 
  'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Liechtenstein', 
  'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 
  'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia', 
  'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'UK', 'Ukraine', 'Vatican City',
  // Africa
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cape Verde',
  'Central African Republic', 'Chad', 'Comoros', 'Congo', 'DR Congo', 'Djibouti', 'Egypt', 
  'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 
  'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 
  'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 
  'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 
  'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
  // Americas
  'Argentina', 'Bahamas', 'Barbados', 'Belize', 'Bolivia', 'Brazil', 'Canada', 'Chile', 'Colombia', 
  'Costa Rica', 'Cuba', 'Dominican Republic', 'Ecuador', 'El Salvador', 'Guatemala', 'Guyana', 
  'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Paraguay', 'Peru', 'Suriname', 
  'Trinidad and Tobago', 'Uruguay', 'USA', 'Venezuela',
  // Oceania
  'Australia', 'Fiji', 'New Zealand', 'Papua New Guinea', 'Samoa', 'Solomon Islands', 'Tonga', 'Vanuatu'
].sort();

// Special value for "Other" option
const OTHER_COUNTRY_VALUE = '__OTHER__';

interface Step1BasicInfoProps extends StepProps {
  contractLines?: any[];
}

export function Step1BasicInfo({ formData, onChange, errors, contractLines }: Step1BasicInfoProps) {
  const { t } = useTranslation();
  const { data: branchesData, isLoading: branchesLoading } = useBranches();
  const isArabic = i18n.language === 'ar';
  
  // Track if "Other" is selected for country of export
  const isCustomCountry = formData.country_of_export && !COUNTRIES.includes(formData.country_of_export);
  const [showOtherInput, setShowOtherInput] = useState(isCustomCountry);
  const [customCountry, setCustomCountry] = useState(isCustomCountry ? formData.country_of_export : '');
  
  // Fuzzy match modal state for supplier/customer
  const [fuzzyMatchModalOpen, setFuzzyMatchModalOpen] = useState(false);
  const [fuzzyMatchData, setFuzzyMatchData] = useState<{
    typedName: string;
    matches: FuzzyMatch[];
    fieldType: 'supplier' | 'customer';
  } | null>(null);
  
  // Handle fuzzy match found callback
  const handleFuzzyMatchFound = (fieldType: 'supplier' | 'customer') => (typedName: string, matches: FuzzyMatchResult[]) => {
    setFuzzyMatchData({
      typedName,
      matches: matches.map(m => ({
        id: m.id,
        name: m.name,
        score: m.score,
        country: m.country,
      })),
      fieldType,
    });
    setFuzzyMatchModalOpen(true);
  };
  
  // Handle user selecting existing match
  const handleSelectExistingMatch = (match: FuzzyMatch) => {
    if (fuzzyMatchData) {
      const idField = fuzzyMatchData.fieldType === 'supplier' ? 'supplier_id' : 'customer_id';
      const nameField = fuzzyMatchData.fieldType === 'supplier' ? 'supplier_name' : 'customer_name';
      onChange(idField, match.id);
      onChange(nameField, match.name);
    }
    setFuzzyMatchModalOpen(false);
    setFuzzyMatchData(null);
  };
  
  // Handle user choosing to create new
  const handleCreateNew = (name: string) => {
    if (fuzzyMatchData) {
      const idField = fuzzyMatchData.fieldType === 'supplier' ? 'supplier_id' : 'customer_id';
      const nameField = fuzzyMatchData.fieldType === 'supplier' ? 'supplier_name' : 'customer_name';
      onChange(idField, `new:${name}`);
      onChange(nameField, name);
    }
    setFuzzyMatchModalOpen(false);
    setFuzzyMatchData(null);
  };
  
  // Helper function to get warehouses accessible by a branch
  // Includes: 1) Direct children (parent_id match), 2) Shared warehouses (via shared_with_branches)
  const getAccessibleWarehouses = (branchId: string | undefined) => {
    if (!branchId || !branchesData?.branches) return [];
    return branchesData.branches.filter(b => 
      b.branch_type === 'warehouse' && (
        // Direct child warehouse
        b.parent_id === branchId ||
        // Shared warehouse - branch has access
        (b.is_shared && b.shared_with_branches?.includes(branchId))
      )
    );
  };
  
  // Sync custom country state when formData changes (e.g., from AI extraction)
  // Only reset showOtherInput when a country from the list is selected (not when empty)
  useEffect(() => {
    const isCustom = formData.country_of_export && !COUNTRIES.includes(formData.country_of_export);
    if (isCustom) {
      setShowOtherInput(true);
      setCustomCountry(formData.country_of_export || '');
    } else if (formData.country_of_export && COUNTRIES.includes(formData.country_of_export)) {
      // Only reset when a valid country from the list is selected
      setShowOtherInput(false);
      setCustomCountry('');
    }
  }, [formData.country_of_export]);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('shipments.wizard.step1Title', 'Basic Information')}
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {t('shipments.wizard.step1Description', 'Enter the basic shipment details')}
        </p>
      </div>

      {/* AI OCR Document Upload Section - At the top for quick data entry */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🤖</span>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('shipments.wizard.aiDocumentExtraction', 'AI Document Extraction')}
          </h3>
          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
            {t('common.recommended', 'Recommended')}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {t('shipments.wizard.uploadDocumentsHint', 'Upload your Commercial Invoice and/or Bill of Lading to automatically extract shipment details including invoice number, products, and shipping information.')}
        </p>

        <div className="space-y-4">
          {/* Commercial Invoice Upload */}
          <CIUploadSection formData={formData} onChange={onChange} />

          {/* Bill of Lading / CMR Upload */}
          <BOLUploadSection formData={formData} onChange={onChange} />
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white text-gray-500">
            {t('shipments.wizard.orFillManually', 'Or fill in manually below')}
          </span>
        </div>
      </div>

      {/* Direction Selection: Purchase (Buyer) vs Sale (Seller) */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-900 mb-3">
          {t('shipments.wizard.transactionType', 'Transaction Type')} <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            formData.transaction_type === 'incoming' 
              ? 'border-blue-600 bg-blue-100' 
              : 'border-gray-300 bg-white hover:border-blue-300'
          }`}>
            <input
              type="radio"
              value="incoming"
              data-field-name="transaction_type"
              checked={formData.transaction_type === 'incoming'}
              onChange={(e) => {
                onChange('transaction_type', e.target.value);
                // Clear the opposite counterparty when switching
                onChange('customer_id', '');
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ms-3 text-sm font-medium text-gray-900">
              📦 {t('shipments.wizard.directionIncoming', 'Purchase (We are the Buyer)')}
            </span>
          </label>
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            formData.transaction_type === 'outgoing' 
              ? 'border-green-600 bg-green-100' 
              : 'border-gray-300 bg-white hover:border-green-300'
          }`}>
            <input
              type="radio"
              value="outgoing"
              data-field-name="transaction_type"
              checked={formData.transaction_type === 'outgoing'}
              onChange={(e) => {
                onChange('transaction_type', e.target.value);
                // Clear the opposite counterparty when switching
                onChange('supplier_id', '');
              }}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
            />
            <span className="ms-3 text-sm font-medium text-gray-900">
              🚚 {t('shipments.wizard.directionOutgoing', 'Sale (We are the Seller)')}
            </span>
          </label>
        </div>
      </div>

      {/* Source Import Selector - Only show for outgoing (sales) shipments */}
      {formData.transaction_type === 'outgoing' && (
        <SourceImportSelector 
          formData={formData} 
          onChange={onChange} 
          errors={errors}
        />
      )}

      {/* Has Contract */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-900 mb-3">
          {t('shipments.wizard.hasSalesContract', 'Is there a Contract?')} <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            formData.has_sales_contract === true
              ? 'border-green-600 bg-green-100' 
              : 'border-gray-300 bg-white hover:border-green-300'
          }`}>
            <input
              type="radio"
              value="yes"
              data-field-name="has_sales_contract"
              checked={formData.has_sales_contract === true}
              onChange={() => onChange('has_sales_contract', true)}
              disabled={!!contractLines && contractLines.length > 0}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
            />
            <span className="ms-3 text-sm font-medium text-gray-900">
              ✅ {t('shipments.wizard.yesSalesContract', 'Yes - Contract Exists')}
            </span>
          </label>
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            formData.has_sales_contract === false
              ? 'border-orange-600 bg-orange-100' 
              : 'border-gray-300 bg-white hover:border-orange-300'
          }`}>
            <input
              type="radio"
              value="no"
              data-field-name="has_sales_contract"
              checked={formData.has_sales_contract === false}
              onChange={() => {
                onChange('has_sales_contract', false);
                onChange('contract_id', '');
              }}
              disabled={!!contractLines && contractLines.length > 0}
              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
            />
            <span className="ms-3 text-sm font-medium text-gray-900">
              ❌ {t('shipments.wizard.noSalesContract', 'No - Direct Shipment')}
            </span>
          </label>
        </div>
        {contractLines && contractLines.length > 0 && (
          <p className="mt-2 text-xs text-blue-600">
            {t('shipments.wizard.createdFromContract', '✓ This shipment was created from a contract')}
          </p>
        )}
        {errors.has_sales_contract && (
          <p className="mt-2 text-sm text-red-600">{errors.has_sales_contract}</p>
        )}
      </div>

      {/* Contract Information - Only show if has_sales_contract is true */}
      {formData.has_sales_contract && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-3">
            📋 {t('shipments.wizard.salesContractInfo', 'Contract Information')}
          </h4>
          
          {contractLines && contractLines.length > 0 && formData.contract_id ? (
            <div className="mb-3 p-3 bg-white rounded border border-blue-300">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{t('contracts.contractNumber', 'Contract Number')}:</span>{' '}
                <span className="text-blue-600 font-mono">{formData.sn.split('-SHIP-')[0]}</span>
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shipments.wizard.searchContract', 'Search for Contract')}
                  <span className="text-red-500"> *</span>
                </label>
                <div data-field-name="contract_id">
                <AutocompleteInput
                  type="contract"
                  value={formData.contract_id || ''}
                  displayValue={formData.sn}
                  onChange={(contractId, contractNo) => {
                    onChange('contract_id', contractId);
                    if (contractNo) {
                      onChange('sn', contractNo);
                    }
                  }}
                  placeholder={t('shipments.wizard.contractSearchPlaceholder', 'Type to search for a contract...')}
                  className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.contract_id || errors.sn ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                </div>
                {(errors.contract_id || errors.sn) && (
                  <p className="mt-1 text-sm text-red-600">{errors.contract_id || errors.sn}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {t('shipments.wizard.contractSearchHint', 'Start typing the contract number to see suggestions')}
                </p>
              </div>
              
              <p className="text-xs text-gray-600">
                {t('shipments.wizard.salesContractNote', 'You can upload the sales contract document or link it to an existing contract in the system.')}
              </p>
            </>
          )}
        </div>
      )}

      {/* Shipment Number (SN) - Commercial Invoice Number
          For buying (incoming): Always required - enter CI number
          For selling (outgoing) with linked imports: Hidden - auto-generated from sale
      */}
      {!(formData.transaction_type === 'outgoing' && formData.source_imports && formData.source_imports.length > 0) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {formData.transaction_type === 'outgoing' 
              ? t('shipments.wizard.saleInvoiceNumber', 'Sale Invoice Number')
              : t('shipments.wizard.shipmentNumber', 'Shipment Number')
            } <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            data-field-name="sn"
            value={formData.sn}
            onChange={(e) => onChange('sn', e.target.value)}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.sn ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={formData.transaction_type === 'outgoing'
              ? t('shipments.wizard.saleInvoicePlaceholder', 'Enter your sale invoice number')
              : t('shipments.wizard.shipmentNumberPlaceholder', 'Enter Commercial Invoice number')
            }
          />
          {errors.sn && <p className="mt-1 text-sm text-red-600">{errors.sn}</p>}
          <p className="mt-1 text-xs text-gray-500">
            {formData.transaction_type === 'outgoing'
              ? t('shipments.wizard.saleInvoiceHint', 'Your sale/proforma invoice number for this sale')
              : t('shipments.wizard.shipmentNumberHint', 'The Commercial Invoice number for this shipment (required)')
            }
          </p>
        </div>
      )}

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('shipments.subject', 'Shipment Subject')}
        </label>
        <input
          type="text"
          data-field-name="subject"
          value={formData.subject || ''}
          onChange={(e) => onChange('subject', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={t('shipments.wizard.subjectPlaceholder', 'e.g., "520 MT Basmati Rice" or "Container #ABCD1234"')}
        />
        <p className="mt-1 text-xs text-gray-500">
          {t('shipments.wizard.subjectHint', 'Brief description of this shipment (optional but recommended)')}
        </p>
      </div>

      {/* Country of Export */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-green-100 rounded-lg">
            <GlobeAltIcon className="h-5 w-5 text-green-600" />
          </div>
          <label htmlFor="country_of_export" className="block text-sm font-semibold text-green-900">
            {t('shipments.wizard.countryOfExport', 'Country of Export')}
          </label>
        </div>
        
        {/* Country Dropdown */}
        <div className="space-y-3">
          <select
            id="country_of_export"
            data-field-name="country_of_export"
            value={showOtherInput ? OTHER_COUNTRY_VALUE : (formData.country_of_export || '')}
            onChange={(e) => {
              const value = e.target.value;
              if (value === OTHER_COUNTRY_VALUE) {
                setShowOtherInput(true);
                setCustomCountry('');
                onChange('country_of_export', '');
              } else {
                setShowOtherInput(false);
                setCustomCountry('');
                onChange('country_of_export', value);
              }
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 
                       focus:ring-2 focus:ring-green-500 focus:border-green-500 
                       hover:border-green-400 transition-colors cursor-pointer
                       appearance-none bg-no-repeat bg-right"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1.25em 1.25em',
              paddingRight: '2.5rem'
            }}
          >
            <option value="" className="text-gray-400">
              {t('shipments.wizard.selectCountryOfExport', '-- Select Country of Export --')}
            </option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
            <option value={OTHER_COUNTRY_VALUE} className="font-medium text-green-700">
              ➕ {t('shipments.wizard.otherCountry', 'Other (Enter Custom)')}
            </option>
          </select>
          
          {/* Custom Country Input - Shows when "Other" is selected */}
          {showOtherInput && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-medium text-green-800 mb-1.5">
                {t('shipments.wizard.enterCustomCountry', 'Enter country name:')}
              </label>
              <input
                type="text"
                value={customCountry}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomCountry(value);
                  onChange('country_of_export', value);
                }}
                placeholder={t('shipments.wizard.customCountryPlaceholder', 'e.g., Somaliland, Kurdistan, etc.')}
                className="w-full px-4 py-2.5 border border-green-300 rounded-lg bg-white text-gray-900
                           focus:ring-2 focus:ring-green-500 focus:border-green-500 
                           placeholder:text-gray-400"
                autoFocus
              />
            </div>
          )}
        </div>
        
        {/* Selected Country Display */}
        {formData.country_of_export && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-800 bg-green-100 px-3 py-2 rounded-lg">
            <span className="text-lg">🌍</span>
            <span>
              {t('shipments.wizard.selectedExport', 'Export Country:')} <strong>{formData.country_of_export}</strong>
            </span>
          </div>
        )}
        
        <p className="mt-3 text-xs text-green-700">
          {t('shipments.wizard.countryOfExportHint', 'Country of the Port of Loading. This is NOT necessarily where the goods originate or where the exporting company is registered.')}
        </p>
      </div>

      {/* Contract Lines - Show if creating from contract */}
      {contractLines && contractLines.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <CubeIcon className="h-5 w-5 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-900">
                {t('shipments.wizard.contractProducts', 'Products from Contract')}
              </h4>
            </div>
            {/* Fulfillment Summary Badge */}
            {(() => {
              const totalContracted = contractLines.reduce((sum: number, line: any) => 
                sum + (parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || 0), 0);
              const totalShipped = contractLines.reduce((sum: number, line: any) => 
                sum + (parseFloat(line.shipped_quantity_mt) || 0), 0);
              const totalPending = totalContracted - totalShipped;
              const percentage = totalContracted > 0 ? Math.round((totalShipped / totalContracted) * 100) : 0;
              
              if (totalShipped > 0 || totalPending < totalContracted) {
                return (
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    percentage >= 100 
                      ? 'bg-green-100 text-green-800' 
                      : percentage > 0 
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {percentage}% {t('contracts.shipped', 'Shipped')} ({totalShipped.toFixed(2)} / {totalContracted.toFixed(2)} MT)
                  </div>
                );
              }
              return null;
            })()}
          </div>
          
          {/* Fulfillment Alert - Show if partially shipped */}
          {(() => {
            const totalContracted = contractLines.reduce((sum: number, line: any) => 
              sum + (parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || 0), 0);
            const totalShipped = contractLines.reduce((sum: number, line: any) => 
              sum + (parseFloat(line.shipped_quantity_mt) || 0), 0);
            const totalPending = totalContracted - totalShipped;
            
            if (totalShipped > 0 && totalPending > 0) {
              return (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">⚠️ {t('contracts.partiallyShipped', 'Partially Shipped Contract')}:</span>{' '}
                    {t('contracts.pendingShipmentNote', 'This contract has {{pending}} MT pending to be shipped.', { pending: totalPending.toFixed(2) })}
                  </p>
                </div>
              );
            }
            return null;
          })()}
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('contracts.product', 'Product')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('contracts.contractQty', 'Contract Qty')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('contracts.shipped', 'Shipped')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('contracts.pending', 'Pending')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('contracts.unitPrice', 'Unit Price')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contractLines.map((line: any, index: number) => {
                  // Get product name from various possible fields
                  const productName = line.product_name || line.type_of_goods || line.product_description || '—';
                  // Get quantity from various possible fields (quantity_mt is the normalized column)
                  const contractQty = parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || parseFloat(line.quantity) || 0;
                  const shippedQty = parseFloat(line.shipped_quantity_mt) || 0;
                  const pendingQty = contractQty - shippedQty;
                  // Get unit of measure
                  const uom = line.uom || line.extra_json?.uom || 'MT';
                  // Fulfillment status
                  const isFullyShipped = pendingQty <= 0;
                  const isPartiallyShipped = shippedQty > 0 && pendingQty > 0;
                  
                  return (
                    <tr key={line.id || index} className={isFullyShipped ? 'bg-green-50' : ''}>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          {productName}
                          {isFullyShipped && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              ✓ {t('contracts.complete', 'Complete')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">
                        {contractQty > 0 ? contractQty.toFixed(2) : '—'} {uom}
                      </td>
                      <td className={`px-3 py-2 text-sm text-right font-medium ${shippedQty > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                        {shippedQty.toFixed(2)} {uom}
                      </td>
                      <td className={`px-3 py-2 text-sm text-right font-semibold ${
                        isFullyShipped ? 'text-green-600' : isPartiallyShipped ? 'text-amber-600' : 'text-gray-900'
                      }`}>
                        {pendingQty.toFixed(2)} {uom}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">
                        ${Number(line.unit_price || line.rate_usd_per_mt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr className="font-semibold">
                  <td className="px-3 py-2 text-sm text-gray-900">
                    {t('common.total', 'Total')}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">
                    {contractLines.reduce((sum: number, line: any) => sum + (parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || 0), 0).toFixed(2)} MT
                  </td>
                  <td className="px-3 py-2 text-sm text-blue-700 text-right">
                    {contractLines.reduce((sum: number, line: any) => sum + (parseFloat(line.shipped_quantity_mt) || 0), 0).toFixed(2)} MT
                  </td>
                  <td className="px-3 py-2 text-sm text-amber-600 text-right">
                    {contractLines.reduce((sum: number, line: any) => {
                      const contractQty = parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || 0;
                      const shippedQty = parseFloat(line.shipped_quantity_mt) || 0;
                      return sum + (contractQty - shippedQty);
                    }, 0).toFixed(2)} MT
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 text-right">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-blue-700">
            {t('shipments.wizard.contractProductsNote', 'These products will be imported into the shipment. You can adjust quantities in the next steps if needed.')}
          </p>
        </div>
      )}

      {/* Broker Information */}
      <div className="border-t pt-6">
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="has_broker"
            data-field-name="has_broker"
            checked={formData.has_broker}
            onChange={(e) => {
              onChange('has_broker', e.target.checked);
              // Clear broker name if unchecked
              if (!e.target.checked) {
                onChange('broker_name', '');
              }
            }}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="has_broker" className="ms-3 text-sm font-medium text-gray-700">
            {formData.transaction_type === 'incoming' 
              ? t('shipments.wizard.boughtThroughBroker', 'Bought through broker')
              : t('shipments.wizard.soldThroughBroker', 'Sold through broker')
            }
          </label>
        </div>

        {/* Broker Name - Only show if checkbox is checked */}
        {formData.has_broker && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('shipments.wizard.brokerName', 'Broker Name')}
            </label>
            <input
              type="text"
              data-field-name="broker_name"
              value={formData.broker_name}
              onChange={(e) => onChange('broker_name', e.target.value)}
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.broker_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('shipments.wizard.brokerNamePlaceholder', 'Enter broker name')}
            />
            {errors.broker_name && (
              <p className="mt-1 text-sm text-red-600">{errors.broker_name}</p>
            )}
          </div>
        )}
      </div>

      {/* Conditional: Supplier (for Purchase) or Customer (for Sale) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {formData.transaction_type === 'incoming' 
            ? t('shipments.wizard.supplier', 'Supplier') 
            : t('shipments.wizard.customer', 'Customer')}
        </label>
        <div 
          data-field-name={formData.transaction_type === 'incoming' ? 'supplier_id' : 'customer_id'}
          data-field-name-alt={formData.transaction_type === 'incoming' ? 'customer_id' : 'supplier_id'}
          data-field-supplier="supplier_id"
          data-field-customer="customer_id"
        >
        <AutocompleteInput
            type={formData.transaction_type === 'incoming' ? 'supplier' : 'customer'}
            value={formData.transaction_type === 'incoming' ? formData.supplier_id : formData.customer_id}
            displayValue={formData.transaction_type === 'incoming' ? formData.supplier_name : formData.customer_name}
            onChange={(id, name) => {
              onChange(formData.transaction_type === 'incoming' ? 'supplier_id' : 'customer_id', id || '');
              onChange(formData.transaction_type === 'incoming' ? 'supplier_name' : 'customer_name', name || '');
            }}
            onFuzzyMatchFound={handleFuzzyMatchFound(formData.transaction_type === 'incoming' ? 'supplier' : 'customer')}
            fuzzyMatchThreshold={0.7}
          placeholder={
              formData.transaction_type === 'incoming'
              ? t('shipments.wizard.supplierPlaceholder', 'Search for supplier...')
              : t('shipments.wizard.customerPlaceholder', 'Search for customer...')
          }
          className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.supplier_id || errors.customer_id ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        </div>
        {(errors.supplier_id || errors.customer_id) && (
          <p className="mt-1 text-sm text-red-600">{errors.supplier_id || errors.customer_id}</p>
        )}
      </div>

      {/* Buyer/Importer - The party for documentation purposes */}
      <div className={`border rounded-lg p-4 ${
        formData.transaction_type === 'outgoing' 
          ? 'bg-green-50 border-green-200' 
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <BuildingOfficeIcon className={`h-5 w-5 ${
            formData.transaction_type === 'outgoing' ? 'text-green-600' : 'text-blue-600'
          }`} />
          <label className={`block text-sm font-medium ${
            formData.transaction_type === 'outgoing' ? 'text-green-900' : 'text-blue-900'
          }`}>
            {formData.transaction_type === 'outgoing' 
              ? t('shipments.wizard.buyerOnDocuments', 'Buyer (for Documents)')
              : t('shipments.wizard.buyerImporter', 'Buyer / Importer')}
          </label>
          {formData.transaction_type === 'outgoing' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {t('selling.forCertificates', 'For COO, Certificates')}
            </span>
          )}
        </div>
        <div data-field-name="buyer_id">
          {/* Text input with optional autocomplete - allows typing new names or selecting existing */}
          <input
            type="text"
            value={formData.buyer_name || ''}
            onChange={(e) => {
              const newName = e.target.value;
              onChange('buyer_name', newName);
              // Clear ID if user is typing a new name (not selecting from dropdown)
              if (formData.buyer_id && newName !== formData.buyer_name) {
                onChange('buyer_id', '');
              }
            }}
            placeholder={formData.transaction_type === 'outgoing'
              ? t('shipments.wizard.buyerDocPlaceholder', 'Type or search for company to appear on documents...')
              : t('shipments.wizard.buyerPlaceholder', 'Type or search for buyer/importer company...')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            list="buyer-suggestions"
          />
          {/* Datalist for suggestions - allows free text while showing options */}
          <datalist id="buyer-suggestions">
            {/* Suggestions will be populated by autocomplete hook if needed */}
          </datalist>
        </div>
        <p className={`mt-2 text-xs ${
          formData.transaction_type === 'outgoing' ? 'text-green-700' : 'text-blue-700'
        }`}>
          {formData.transaction_type === 'outgoing' 
            ? t('shipments.wizard.buyerDocHint', 'Type the company name that will appear on certificates of origin, customs declarations, and other export documents. You can type a new name or select from existing companies.')
            : t('shipments.wizard.buyerHint', 'The company acting as buyer/importer for documentation (certificates of origin, customs declarations, etc.)')}
        </p>
      </div>

      {/* Final Destination/Owner - Always Required */}
      <div className="bg-white border border-amber-200 rounded-lg p-6">
        <div className="mb-4">
          <h4 className="text-md font-semibold text-amber-900 flex items-center gap-2">
            <BuildingOfficeIcon className="h-5 w-5 text-amber-600" />
            {t('contracts.finalDestination', 'Final Destination / Owner')} <span className="text-red-500">*</span>
          </h4>
        </div>

        <>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
              <p className="text-sm text-amber-800">
                <strong>{t('contracts.finalDestinationNote', 'Note:')}</strong>{' '}
                {t('contracts.finalDestinationDescription', 'Use this section when the goods are going to a different location/owner than the buyer (e.g., branch warehouse, customer warehouse, or final end customer).')}
              </p>
            </div>

            {/* Destination Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-3">
                {t('contracts.destinationType', 'Destination Type')} *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.final_destination?.type === 'branch'
                    ? 'border-blue-600 bg-blue-100' 
                    : 'border-gray-300 bg-white hover:border-blue-300'
                }`}>
                  <input
                    type="radio"
                    data-field-name="final_destination_type"
                    value="branch"
                    checked={formData.final_destination?.type === 'branch'}
                    onChange={() => {
                      onChange('final_destination', {
                        ...formData.final_destination,
                        type: 'branch',
                        selling_price: '', // Clear selling price for branches
                      });
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ms-3 text-sm font-medium text-gray-900">
                    🏢 {t('contracts.destinationBranch', 'Branch')}
                  </span>
                </label>
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.final_destination?.type === 'customer'
                    ? 'border-green-600 bg-green-100' 
                    : 'border-gray-300 bg-white hover:border-green-300'
                }`}>
                  <input
                    type="radio"
                    data-field-name="final_destination_type"
                    value="customer"
                    checked={formData.final_destination?.type === 'customer'}
                    onChange={() => {
                      onChange('final_destination', {
                        ...formData.final_destination,
                        type: 'customer',
                      });
                    }}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                  />
                  <span className="ms-3 text-sm font-medium text-gray-900">
                    👤 {t('contracts.destinationCustomer', 'External Customer')}
                  </span>
                </label>
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.final_destination?.type === 'consignment'
                    ? 'border-purple-600 bg-purple-100' 
                    : 'border-gray-300 bg-white hover:border-purple-300'
                }`}>
                  <input
                    type="radio"
                    data-field-name="final_destination_type"
                    value="consignment"
                    checked={formData.final_destination?.type === 'consignment'}
                    onChange={() => {
                      onChange('final_destination', {
                        ...formData.final_destination,
                        type: 'consignment',
                        selling_price: '', // Clear selling price for consignment
                      });
                    }}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                  />
                  <span className="ms-3 text-sm font-medium text-gray-900">
                    📦 {t('contracts.destinationConsignment', 'بضائع بالأمانة')}
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {formData.final_destination?.type === 'branch' ? (
                <>
                  {/* Branch Name - Parent branches dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.branchName', 'Branch Name')} *
                    </label>
                    <select
                      value={formData.final_destination?.branch_id || ''}
                      onChange={(e) => {
                        const selectedBranch = branchesData?.branches.find(b => b.id === e.target.value);
                        onChange('final_destination', {
                          ...formData.final_destination,
                          branch_id: e.target.value,
                          warehouse_id: '', // Reset warehouse when branch changes
                          name: selectedBranch ? (isArabic ? selectedBranch.name_ar : selectedBranch.name) : '',
                          delivery_place: '', // Reset delivery place when branch changes
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                    >
                      <option value="">{t('contracts.selectBranch', 'Select a branch...')}</option>
                      {branchesLoading ? (
                        <option disabled>{t('common.loading', 'Loading...')}</option>
                      ) : (
                        branchesData?.branches
                          .filter(b => b.branch_type === 'region') // Only regions, not holding company
                          .map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {isArabic ? (branch.name_ar || branch.name) : branch.name}
                            </option>
                          ))
                      )}
                    </select>
                    <p className="mt-1 text-xs text-blue-600">
                      ℹ️ {t('contracts.branchIsDefaultOwner', 'The branch is the default final owner')}
                    </p>
                  </div>

                  {/* Final Destination - Child warehouses dropdown (filtered by selected branch) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDeliveryPlace', 'Final Place of Delivery')} *
                    </label>
                    <select
                      value={
                        // Try warehouse_id first, then try to match by delivery_place name
                        formData.final_destination?.warehouse_id || 
                        (formData.final_destination?.delivery_place && formData.final_destination?.branch_id
                          ? getAccessibleWarehouses(formData.final_destination?.branch_id)
                              .find(w => 
                                w.name === formData.final_destination?.delivery_place || 
                                w.name_ar === formData.final_destination?.delivery_place
                              )?.id || ''
                          : ''
                        )
                      }
                      onChange={(e) => {
                        const selectedWarehouse = branchesData?.branches.find(b => b.id === e.target.value);
                        onChange('final_destination', {
                          ...formData.final_destination,
                          warehouse_id: e.target.value,
                          delivery_place: selectedWarehouse ? (isArabic ? selectedWarehouse.name_ar : selectedWarehouse.name) : '',
                        });
                      }}
                      disabled={!formData.final_destination?.branch_id}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white ${
                        !formData.final_destination?.branch_id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">
                        {!formData.final_destination?.branch_id 
                          ? t('contracts.selectBranchFirst', 'Select a branch first...')
                          : t('contracts.selectWarehouse', 'Select final destination...')
                        }
                      </option>
                      {formData.final_destination?.branch_id && getAccessibleWarehouses(formData.final_destination?.branch_id)
                        .map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {isArabic ? (warehouse.name_ar || warehouse.name) : warehouse.name}
                            {warehouse.is_shared ? ' ⭐' : ''}
                          </option>
                        ))
                      }
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('contracts.warehouseHint', 'Select the specific warehouse or location within the branch')}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Company/Owner Name - Text input for non-branch types */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDestinationName', 'Company / Customer Name')} *
                    </label>
                    <input
                      type="text"
                      key={`name-${formData.final_destination?.name || 'empty'}`}
                      defaultValue={formData.final_destination?.name || ''}
                      onChange={(e) => onChange('final_destination', {
                        ...formData.final_destination,
                        name: e.target.value
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder={t('contracts.customerNamePlaceholder', 'e.g., ABC Trading LLC')}
                    />
                  </div>

                  {/* Final Place of Delivery - Text input for non-branch types */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDeliveryPlace', 'Final Place of Delivery')} *
                    </label>
                    <input
                      type="text"
                      data-field-name="final_destination"
                      data-field-name-alt="delivery_place"
                      key={`delivery-${formData.final_destination?.delivery_place || 'empty'}`}
                      defaultValue={formData.final_destination?.delivery_place || ''}
                      onChange={(e) => onChange('final_destination', {
                        ...formData.final_destination,
                        delivery_place: e.target.value
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder={t('contracts.finalDeliveryPlacePlaceholder', 'e.g., Jeddah Port, Riyadh Warehouse, Damascus City Center')}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {t('contracts.finalDeliveryPlaceHint', 'Specify the exact delivery location (beneficiary may have multiple locations)')}
                    </p>
                  </div>
                </>
              )}

              {/* Customer-Only Fields */}
              {formData.final_destination?.type === 'customer' && (
                <>
                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDestinationAddress', 'Full Address')} *
                    </label>
                    <textarea
                      value={formData.final_destination?.address || ''}
                      onChange={(e) => onChange('final_destination', {
                        ...formData.final_destination,
                        address: e.target.value
                      })}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder={t('contracts.addressPlaceholder', 'Street address, City, Country')}
                    />
                  </div>

                  {/* Contact */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDestinationContact', 'Contact Person / Phone')}
                    </label>
                    <input
                      type="text"
                      value={formData.final_destination?.contact || ''}
                      onChange={(e) => onChange('final_destination', {
                        ...formData.final_destination,
                        contact: e.target.value
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder={t('contracts.contactPlaceholder', 'Name and phone number')}
                    />
                  </div>

                  {/* Selling Price */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <label className="block text-sm font-medium text-green-900 mb-2">
                      {t('contracts.finalDestinationSellingPrice', 'Selling Price (for Customer)')}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 start-0 flex items-center ps-4 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.final_destination?.selling_price || ''}
                        onChange={(e) => onChange('final_destination', {
                          ...formData.final_destination,
                          selling_price: e.target.value ? Number(e.target.value) : ''
                        })}
                        className="w-full ps-8 pe-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder={t('contracts.sellingPricePlaceholder', 'Enter selling price per unit')}
                      />
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                      {t('contracts.sellingPriceHint', 'This is the price you are selling to the customer (not applicable for internal branches)')}
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDestinationNotes', 'Additional Notes')}
                    </label>
                    <textarea
                      value={formData.final_destination?.notes || ''}
                      onChange={(e) => onChange('final_destination', {
                        ...formData.final_destination,
                        notes: e.target.value
                      })}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder={t('contracts.destinationNotesPlaceholder', 'Any special instructions or notes about the destination')}
                    />
                  </div>
                </>
              )}
            </div>
          </>
      </div>

      {/* Info Box */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-700">
          <strong>{t('common.note', 'Note')}:</strong>{' '}
          {t('contracts.step1Note', 'The exporter is the seller/supplier providing the goods. The buyer is the purchasing company. The consignee is who receives the goods (often same as buyer).')}
        </p>
      </div>
      
      {/* Fuzzy Match Warning Modal */}
      <FuzzyMatchWarningModal
        isOpen={fuzzyMatchModalOpen}
        onClose={() => {
          setFuzzyMatchModalOpen(false);
          setFuzzyMatchData(null);
        }}
        typedName={fuzzyMatchData?.typedName || ''}
        matches={fuzzyMatchData?.matches || []}
        onSelectExisting={handleSelectExistingMatch}
        onCreateNew={handleCreateNew}
        entityType={fuzzyMatchData?.fieldType || 'supplier'}
      />
    </div>
  );
}

