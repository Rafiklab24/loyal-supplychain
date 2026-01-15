/**
 * Transfer Order Modal
 * Form for generating Yapi Kredi bank transfer orders with DOCX/PDF output
 */

import { useState, useRef, Fragment, useEffect } from 'react';
import { Dialog, Transition, RadioGroup } from '@headlessui/react';
import { XMarkIcon, DocumentArrowDownIcon, ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { renderAsync } from 'docx-preview';
import { apiClient } from '../../services/api';
import type { 
  TransferOrderData, 
  TransferOrderType, 
  ChargeType, 
  Company, 
  Shipment 
} from '../../types/api';

// Import the constant directly
const SENDER_INFO = {
  name: 'LOYAL INTERNATIONAL GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
  customer_number: '78265692',
  branch: 'MERSİN / Mersin Ticari Şube Müdürlüğü\'ne',
};

interface TransferOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Company | null;
  shipment?: Shipment | null;
}

const TRANSFER_TYPES: { value: TransferOrderType; label: string; labelTr: string }[] = [
  { value: 'import', label: 'Advance Import Transfer', labelTr: 'Peşin İthalat Transferi' },
  { value: 'domestic_international', label: 'Domestic/International Transfer', labelTr: 'Yurt İçi / Yurt Dışı Transfer' },
];

const CHARGE_TYPES: { value: ChargeType; label: string; description: string }[] = [
  { 
    value: 'SHA', 
    label: 'SHA', 
    description: 'Gönderici tarafındaki masraflar göndericiye, diğer tüm masraflar alıcıya aittir' 
  },
  { 
    value: 'OUR', 
    label: 'OUR', 
    description: 'Tüm masraflar gönderici tarafından ödenecektir' 
  },
  { 
    value: 'BEN', 
    label: 'BEN', 
    description: 'Tüm masraflar alıcı tarafından ödenecektir' 
  },
];

export function TransferOrderModal({ isOpen, onClose, supplier, shipment }: TransferOrderModalProps) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<TransferOrderData>({
    transfer_type: 'import',
    currency: 'USD',
    amount: 0,
    transfer_date: new Date().toISOString().split('T')[0],
    value_date: '',
    sender_name: SENDER_INFO.name,
    sender_customer_number: SENDER_INFO.customer_number,
    sender_branch: SENDER_INFO.branch,
    beneficiary_name: '',
    beneficiary_address: '',
    bank_name: '',
    bank_branch: '',
    bank_country: '',
    bank_address: '',
    swift_code: '',
    iban_unknown: false,
    iban_or_account: '',
    correspondent_bank: '',
    invoice_info: '',
    payment_details: 'PAYMENT OF GOODS',
    charge_type: 'SHA',
  });

  // Auto-populate from supplier when modal opens or supplier changes
  useEffect(() => {
    if (isOpen && supplier) {
      const banking = supplier.extra_json?.banking;
      
      setFormData(prev => ({
        ...prev,
        beneficiary_name: supplier.name || '',
        beneficiary_address: supplier.address || '',
        bank_name: banking?.bank_name || '',
        bank_branch: banking?.branch || '',
        bank_address: banking?.bank_address || '',
        swift_code: banking?.swift_code || '',
        iban_or_account: banking?.iban || banking?.account_number || '',
        correspondent_bank: banking?.intermediary_bank || '',
        // Auto-detect if IBAN is unknown (if account number is provided instead of IBAN)
        iban_unknown: !!(banking?.account_number && !banking?.iban),
      }));
    }
  }, [isOpen, supplier]);

  // Auto-populate shipment-related fields
  useEffect(() => {
    if (isOpen && shipment) {
      // Try to get amount from shipment's total value
      const amount = shipment.total_value_usd ? parseFloat(String(shipment.total_value_usd)) : 0;
      
      // Build invoice info from shipment data
      let invoiceInfo = '';
      if (shipment.sn) {
        invoiceInfo = `SHIPMENT: ${shipment.sn}`;
        if (shipment.contract_no) {
          invoiceInfo += `, CONTRACT: ${shipment.contract_no}`;
        }
        invoiceInfo += '\nPAYMENT OF GOODS';
      }

      setFormData(prev => ({
        ...prev,
        amount: amount || prev.amount,
        invoice_info: invoiceInfo || prev.invoice_info,
      }));
    }
  }, [isOpen, shipment]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      // Clear preview container
      if (previewContainerRef.current) {
        previewContainerRef.current.innerHTML = '';
      }
    }
  }, [isOpen]);

  const handleFieldChange = (field: keyof TransferOrderData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.amount || formData.amount <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    if (!formData.beneficiary_name.trim()) {
      setError('Beneficiary name is required');
      return false;
    }
    if (!formData.bank_name.trim()) {
      setError('Bank name is required');
      return false;
    }
    if (!formData.swift_code.trim()) {
      setError('SWIFT code is required');
      return false;
    }
    if (!formData.iban_or_account.trim()) {
      setError('IBAN or Account number is required');
      return false;
    }
    if (!formData.invoice_info.trim()) {
      setError('Invoice information is required');
      return false;
    }
    return true;
  };

  const getFormPayload = () => ({
    currency: formData.currency,
    amount: String(formData.amount),
    transfer_date: formData.transfer_date,
    sender_name: formData.sender_name,
    sender_customer_number: formData.sender_customer_number,
    beneficiary_name: formData.beneficiary_name,
    beneficiary_address: formData.beneficiary_address,
    bank_name: formData.bank_name,
    bank_branch: formData.bank_branch,
    bank_country: formData.bank_country,
    swift_code: formData.swift_code,
    iban_or_account: formData.iban_or_account,
    correspondent_bank: formData.correspondent_bank,
    invoice_info: formData.invoice_info,
    payment_details: formData.payment_details,
    charge_type: formData.charge_type,
  });

  const handlePreview = async () => {
    if (!validateForm()) return;
    if (!previewContainerRef.current) return;

    setIsLoadingPreview(true);
    setError(null);

    try {
      // Call the backend to generate DOCX
      const response = await apiClient.post('/transfers/generate-order', getFormPayload(), {
        responseType: 'blob',
      });

      // Clear previous preview
      previewContainerRef.current.innerHTML = '';

      // Render the DOCX preview
      await renderAsync(response.data, previewContainerRef.current, undefined, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        experimental: false,
        trimXmlDeclaration: true,
        useBase64URL: true,
      });
    } catch (err: any) {
      console.error('Preview generation error:', err);
      setError('Failed to generate preview. Please try again.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadDOCX = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Call the backend endpoint to generate DOCX
      const response = await apiClient.post('/transfers/generate-order', getFormPayload(), {
        responseType: 'blob',
      });

      // Create download link
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const sanitizedName = formData.beneficiary_name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      link.download = `Transfer_Order_${sanitizedName}_${formData.transfer_date}.docx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('DOCX generation error:', err);
      setError('Failed to generate DOCX. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Call the backend endpoint to generate PDF (converted from DOCX)
      const response = await apiClient.post('/transfers/generate-order-pdf', getFormPayload(), {
        responseType: 'blob',
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const sanitizedName = formData.beneficiary_name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      link.download = `Transfer_Order_${sanitizedName}_${formData.transfer_date}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {/* Header */}
                <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <Dialog.Title className="text-xl font-bold text-white">
                        Generate Transfer Order
                      </Dialog.Title>
                      <p className="text-emerald-100 text-sm mt-1">
                        Yapi Kredi Bank - Import Transfer Form
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="rounded-lg p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Content - Two Column Layout */}
                <div className="flex h-[70vh]">
                  {/* Left: Form */}
                  <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
                    <div className="space-y-6">
                      {/* Error Alert */}
                      {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">
                          {error}
                        </div>
                      )}

                      {/* Transfer Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Transfer Type
                        </label>
                        <RadioGroup 
                          value={formData.transfer_type} 
                          onChange={(value) => handleFieldChange('transfer_type', value)}
                          className="space-y-2"
                        >
                          {TRANSFER_TYPES.map((type) => (
                            <RadioGroup.Option
                              key={type.value}
                              value={type.value}
                              className={({ checked }) =>
                                `relative flex cursor-pointer rounded-lg border px-4 py-3 focus:outline-none ${
                                  checked
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                }`
                              }
                            >
                              {({ checked }) => (
                                <div className="flex w-full items-center justify-between">
                                  <div>
                                    <RadioGroup.Label
                                      as="p"
                                      className={`font-medium ${
                                        checked ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'
                                      }`}
                                    >
                                      {type.labelTr}
                                    </RadioGroup.Label>
                                    <RadioGroup.Description
                                      as="span"
                                      className="text-xs text-gray-500 dark:text-gray-400"
                                    >
                                      {type.label}
                                    </RadioGroup.Description>
                                  </div>
                                  {checked && (
                                    <div className="shrink-0 text-emerald-500">
                                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="12" fill="currentColor" fillOpacity="0.2" />
                                        <path d="M7 13l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              )}
                            </RadioGroup.Option>
                          ))}
                        </RadioGroup>
                      </div>

                      {/* Amount and Currency */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Currency
                          </label>
                          <select
                            value={formData.currency}
                            onChange={(e) => handleFieldChange('currency', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="TRY">TRY</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Amount *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.amount || ''}
                            onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Transfer Date *
                          </label>
                          <input
                            type="date"
                            value={formData.transfer_date}
                            onChange={(e) => handleFieldChange('transfer_date', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Value Date (Optional)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={formData.value_date === 'TODAY' ? '' : formData.value_date}
                              onChange={(e) => handleFieldChange('value_date', e.target.value)}
                              disabled={formData.value_date === 'TODAY'}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => handleFieldChange('value_date', formData.value_date === 'TODAY' ? '' : 'TODAY')}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                formData.value_date === 'TODAY'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              Today
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Beneficiary Section */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">2</span>
                          Beneficiary Details
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Beneficiary Name *
                            </label>
                            <input
                              type="text"
                              value={formData.beneficiary_name}
                              onChange={(e) => handleFieldChange('beneficiary_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              placeholder="Company name"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Address
                            </label>
                            <textarea
                              value={formData.beneficiary_address}
                              onChange={(e) => handleFieldChange('beneficiary_address', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                              placeholder="Full address"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bank Details Section */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">3</span>
                          Bank Details
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Bank Name *
                            </label>
                            <input
                              type="text"
                              value={formData.bank_name}
                              onChange={(e) => handleFieldChange('bank_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              placeholder="Bank name"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Bank Address
                            </label>
                            <textarea
                              value={formData.bank_address}
                              onChange={(e) => handleFieldChange('bank_address', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                              placeholder="Bank address"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                SWIFT Code *
                              </label>
                              <input
                                type="text"
                                value={formData.swift_code}
                                onChange={(e) => handleFieldChange('swift_code', e.target.value.toUpperCase())}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                                placeholder="XXXXXXXX"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                IBAN / Account No *
                              </label>
                              <input
                                type="text"
                                value={formData.iban_or_account}
                                onChange={(e) => handleFieldChange('iban_or_account', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                                placeholder="Account number"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="iban_unknown"
                              checked={formData.iban_unknown}
                              onChange={(e) => handleFieldChange('iban_unknown', e.target.checked)}
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                            />
                            <label htmlFor="iban_unknown" className="text-sm text-gray-600 dark:text-gray-400">
                              IBAN unknown (using account number)
                            </label>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Correspondent Bank
                            </label>
                            <input
                              type="text"
                              value={formData.correspondent_bank}
                              onChange={(e) => handleFieldChange('correspondent_bank', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              placeholder="Intermediary bank (if known)"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Invoice & Payment Section */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">4</span>
                          Invoice & Payment
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Invoice / Reference Info *
                            </label>
                            <textarea
                              value={formData.invoice_info}
                              onChange={(e) => handleFieldChange('invoice_info', e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                              placeholder="Invoice number, date, and description"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Payment Details
                            </label>
                            <input
                              type="text"
                              value={formData.payment_details}
                              onChange={(e) => handleFieldChange('payment_details', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              placeholder="e.g., PAYMENT OF GOODS"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Charge Type */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">5</span>
                          Charges (Masraflar)
                        </h3>

                        <RadioGroup 
                          value={formData.charge_type} 
                          onChange={(value) => handleFieldChange('charge_type', value)}
                          className="space-y-2"
                        >
                          {CHARGE_TYPES.map((type) => (
                            <RadioGroup.Option
                              key={type.value}
                              value={type.value}
                              className={({ checked }) =>
                                `relative flex cursor-pointer rounded-lg border px-4 py-3 focus:outline-none ${
                                  checked
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                }`
                              }
                            >
                              {({ checked }) => (
                                <div className="flex w-full items-center gap-3">
                                  <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                                    checked 
                                      ? 'bg-emerald-500 text-white' 
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {type.value}
                                  </div>
                                  <div className="flex-1">
                                    <RadioGroup.Description
                                      as="span"
                                      className={`text-sm ${
                                        checked ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
                                      }`}
                                    >
                                      {type.description}
                                    </RadioGroup.Description>
                                  </div>
                                </div>
                              )}
                            </RadioGroup.Option>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                  </div>

                  {/* Right: Preview */}
                  <div className="w-1/2 bg-gray-50 dark:bg-gray-900/50 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">Preview</h3>
                      <button
                        onClick={handlePreview}
                        disabled={isLoadingPreview}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                      >
                        {isLoadingPreview ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Loading...
                          </>
                        ) : (
                          <>
                            <ArrowPathIcon className="w-4 h-4" />
                            Refresh
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                      <div 
                        ref={previewContainerRef}
                        className="bg-white shadow-lg min-h-full"
                        style={{ minHeight: '500px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      * Required fields
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDownloadDOCX}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
                      >
                        {isGenerating ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <DocumentTextIcon className="w-5 h-5" />
                            Download DOCX
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
                      >
                        {isGenerating ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <DocumentArrowDownIcon className="w-5 h-5" />
                            Download PDF
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
