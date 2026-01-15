/**
 * Contract Wizard V2 - Step 5: Banking & Documentation
 * Beneficiary banking details and documentation requirements matrix
 */

import { useTranslation } from 'react-i18next';
import { BuildingLibraryIcon, DocumentTextIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ContractFormData, DocumentationRequirement } from './types';
import { DOCUMENT_TYPES, ATTESTATION_AUTHORITIES } from './types';

interface Step5Props {
  data: ContractFormData;
  onChange: (section: keyof ContractFormData, field: string, value: any) => void;
  onArrayChange: (section: keyof ContractFormData, field: string, index: number, subField: string, value: any) => void;
  onArrayAdd: (section: keyof ContractFormData, field: string, item: any) => void;
  onArrayRemove: (section: keyof ContractFormData, field: string, index: number) => void;
}

export function Step5BankingDocs({ data, onChange, onArrayChange, onArrayAdd, onArrayRemove }: Step5Props) {
  const { t } = useTranslation();

  const handleChange = (field: string, value: any) => {
    onChange('banking_docs', field, value);
  };

  const handleAddDocument = () => {
    const newDoc: DocumentationRequirement = {
      id: `temp-${Date.now()}`,
      document_type: '',
      required: true,
      legalization_required: false,
      quantity: 1,
    };
    onArrayAdd('banking_docs', 'documentation', newDoc);
  };

  return (
    <div className="space-y-8">
      {/* Header - data-field-name="banking_docs" for section-level field highlighting */}
      <div data-field-name="banking_docs" className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
        <div className="flex items-center gap-3 mb-2">
          <BuildingLibraryIcon className="h-6 w-6 text-indigo-600" />
          <h3 className="text-lg font-semibold text-indigo-900">
            {t('contracts.bankingDocumentation', 'Banking & Documentation')}
          </h3>
        </div>
        <p className="text-sm text-indigo-700">
          {t('contracts.bankingDocumentationDesc', 'Beneficiary payment details and required documents')}
        </p>
      </div>

      {/* Beneficiary Banking Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BuildingLibraryIcon className="h-5 w-5 text-gray-600" />
          {t('contracts.beneficiaryBanking', 'Beneficiary Banking Details')}
        </h4>
        
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.beneficiaryName', 'Beneficiary Name')} *
            </label>
            <input
              type="text"
              data-field-name="beneficiary_name"
              value={data.banking_docs.beneficiary_name}
              onChange={(e) => handleChange('beneficiary_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="BHARAT INDUSTRIAL ENTERPRISES PVT. LTD"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.beneficiaryAddress', 'Beneficiary Address')} *
            </label>
            <textarea
              data-field-name="beneficiary_address"
              value={data.banking_docs.beneficiary_address}
              onChange={(e) => handleChange('beneficiary_address', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="RAILWAY ROAD, TARAORI 132116, KARNAL (HARYANA) INDIA"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('contracts.accountNumber', 'Account Number')} *
              </label>
              <input
                type="text"
                data-field-name="beneficiary_account_no"
                value={data.banking_docs.beneficiary_account_no}
                onChange={(e) => handleChange('beneficiary_account_no', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="A/C NO. 37438747338"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('contracts.swiftCode', 'SWIFT Code')}
              </label>
              <input
                type="text"
                data-field-name="beneficiary_swift_code"
                value={data.banking_docs.beneficiary_swift_code || ''}
                onChange={(e) => handleChange('beneficiary_swift_code', e.target.value || undefined)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="SBININBB187"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.bankName', 'Bank Name')} *
            </label>
            <input
              type="text"
              data-field-name="beneficiary_bank_name"
              value={data.banking_docs.beneficiary_bank_name}
              onChange={(e) => handleChange('beneficiary_bank_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="STATE BANK OF INDIA"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.bankAddress', 'Bank Address')} *
            </label>
            <textarea
              data-field-name="beneficiary_bank_address"
              value={data.banking_docs.beneficiary_bank_address}
              onChange={(e) => handleChange('beneficiary_bank_address', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="SPECIALISED COMMERCIAL BRANCH, KARNAL, HARYANA (INDIA)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.correspondentBank', 'Correspondent Bank')}
            </label>
            <input
              type="text"
              data-field-name="correspondent_bank"
              value={data.banking_docs.correspondent_bank || ''}
              onChange={(e) => handleChange('correspondent_bank', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="IRVTUS3N THE BANK OF NEW YORK MELLON"
            />
          </div>
        </div>
      </div>

      {/* Documentation Requirements */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-gray-600" />
            {t('contracts.documentationRequirements', 'Documentation Requirements')}
          </h4>
          <button
            type="button"
            onClick={handleAddDocument}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <PlusIcon className="h-4 w-4" />
            {t('contracts.addDocument', 'Add Document')}
          </button>
        </div>

        {/* Document List */}
        {data.banking_docs.documentation.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p>{t('contracts.noDocumentsAdded', 'No documents added yet.')}</p>
            <p className="text-sm mt-2">
              {t('contracts.addDocumentHint', 'Click "Add Document" to specify required documentation')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.banking_docs.documentation.map((doc, index) => (
              <div key={doc.id || index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    {t('contracts.document', 'Document')} #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onArrayRemove('banking_docs', 'documentation', index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('contracts.documentType', 'Document Type')} *
                    </label>
                    <select
                      value={doc.document_type}
                      onChange={(e) => onArrayChange('banking_docs', 'documentation', index, 'document_type', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">{t('common.select', 'Select...')}</option>
                      {DOCUMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('contracts.attestedBy', 'Attested By')}
                    </label>
                    <select
                      value={doc.attested_by || ''}
                      onChange={(e) => onArrayChange('banking_docs', 'documentation', index, 'attested_by', e.target.value || undefined)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    >
                      <option value="">{t('common.none', 'None')}</option>
                      {ATTESTATION_AUTHORITIES.map((authority) => (
                        <option key={authority} value={authority}>
                          {authority}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('contracts.copies', 'Copies')}
                    </label>
                    <input
                      type="number"
                      value={doc.quantity || 1}
                      onChange={(e) => onArrayChange('banking_docs', 'documentation', index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      min="1"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={doc.required}
                      onChange={(e) => onArrayChange('banking_docs', 'documentation', index, 'required', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">{t('contracts.required', 'Required')}</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={doc.legalization_required}
                      onChange={(e) => onArrayChange('banking_docs', 'documentation', index, 'legalization_required', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">{t('contracts.legalizationRequired', 'Legalization Required')}</span>
                  </label>
                </div>

                {doc.notes !== undefined && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('common.notes', 'Notes')}
                    </label>
                    <input
                      type="text"
                      value={doc.notes || ''}
                      onChange={(e) => onArrayChange('banking_docs', 'documentation', index, 'notes', e.target.value || undefined)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      placeholder={t('contracts.documentNotesPlaceholder', 'Special instructions or notes...')}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Documentation Notes */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('contracts.documentationNotes', 'Documentation Notes')}
          </label>
          <textarea
            data-field-name="documentation_notes"
            value={data.banking_docs.documentation_notes || ''}
            onChange={(e) => handleChange('documentation_notes', e.target.value || undefined)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('contracts.documentationNotesPlaceholder', 'Additional notes about documentation requirements...')}
          />
        </div>
      </div>

      {/* Example */}
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <p className="text-sm text-green-800 font-medium mb-2">
          {t('contracts.exampleFromInvoice', 'Example from Proforma Invoice')}:
        </p>
        <p className="text-sm text-green-700">
          "WE WILL PROVIDE: INVOICE, CERT. OF ORIGIN ATTESTED BY CHAMBER OF COMMERCE ALONGWITH B/L, PACKING LIST, PHYTO. & FUMIGATION WITHOUT LEGALIZATION, ONLY CHAMBER"
        </p>
      </div>
    </div>
  );
}

