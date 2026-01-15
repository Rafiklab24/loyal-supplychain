/**
 * Bank Account Selector Component
 * Allows selecting company bank accounts for receiving payments in selling workflow
 * Used when transaction_type = 'outgoing' (selling)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BanknotesIcon, 
  BuildingLibraryIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { financeService } from '../../../services/finance';
import type { Fund } from '../../../types/api';
import type { ShipmentFormData } from './types';
import { Spinner } from '../../common/Spinner';

interface BankAccountSelectorProps {
  formData: ShipmentFormData;
  onChange: (field: keyof ShipmentFormData, value: any) => void;
  errors?: Partial<Record<keyof ShipmentFormData, string>>;
}

export function BankAccountSelector({ formData, onChange, errors }: BankAccountSelectorProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [bankAccounts, setBankAccounts] = useState<Fund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch bank accounts on mount
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        setIsLoading(true);
        const funds = await financeService.getFunds();
        // Filter to only show bank accounts (not cash funds or exchange)
        const bankOnly = funds.filter(
          fund => fund.type === 'bank' || fund.fund_type === 'bank_account'
        );
        setBankAccounts(bankOnly);
      } catch (error) {
        console.error('Error fetching bank accounts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBankAccounts();
  }, []);

  // Handle selection - populate both payment fields and transfer details
  const handleSelect = (fund: Fund) => {
    const bankName = fund.bank_name || fund.fund_name || fund.name;
    const currency = fund.currency_code || fund.currency || 'USD';
    
    // Store the selected bank account info in formData
    onChange('payment_bank_account_id', fund.id);
    onChange('payment_bank_name', bankName);
    onChange('payment_account_number', fund.account_number || '');
    onChange('payment_currency', currency);
    
    // Also populate the transfer/beneficiary details section for documents
    onChange('beneficiary_bank_name', bankName);
    onChange('beneficiary_name', fund.account_holder || 'LOYAL INTERNATIONAL');
    onChange('beneficiary_account_number', fund.account_number || '');
    onChange('swift_code', fund.swift_code || '');
    onChange('beneficiary_iban', fund.iban || '');
    
    // Update the currency for selling costs
    onChange('selling_cost_currency', currency);
  };

  // Copy account number to clipboard
  const copyToClipboard = async (text: string, fundId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(fundId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const selectedAccountId = formData.payment_bank_account_id;

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-center justify-center py-4">
          <Spinner size="md" />
          <span className={`${isRtl ? 'me-2' : 'ms-2'} text-sm text-gray-600`}>
            {isRtl ? 'جاري تحميل الحسابات البنكية...' : 'Loading bank accounts...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <BuildingLibraryIcon className="h-5 w-5 text-emerald-600" />
        <h4 className="text-sm font-semibold text-emerald-900">
          {isRtl ? 'حسابنا البنكي (استلام الدفع)' : 'Our Bank Account (Receive Payment)'}
        </h4>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
          {isRtl ? 'يدفع المشتري هنا' : 'Buyer pays here'}
        </span>
      </div>
      
      <p className="text-sm text-emerald-800 mb-4">
        {isRtl 
          ? 'اختر الحساب البنكي للشركة الذي سيحول المشتري الدفع إليه.'
          : 'Select the company bank account where the buyer will transfer payment.'}
      </p>

      {bankAccounts.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
          {isRtl 
            ? 'لم يتم تكوين حسابات بنكية. يرجى إضافة حسابات بنكية في إعدادات المالية.'
            : 'No bank accounts configured. Please add bank accounts in Finance settings.'}
        </div>
      ) : (
        <div className="space-y-2">
          {bankAccounts.map((account) => {
            const isSelected = selectedAccountId === account.id;
            return (
              <div
                key={account.id}
                onClick={() => handleSelect(account)}
                className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-200' : 'bg-gray-100'}`}>
                      <BanknotesIcon className={`h-5 w-5 ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {account.bank_name || account.fund_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {account.account_number && (
                          <span className="font-mono">{account.account_number}</span>
                        )}
                        {account.currency_code && (
                          <span className={`${isRtl ? 'me-2' : 'ms-2'} text-xs bg-gray-100 px-1.5 py-0.5 rounded`}>
                            {account.currency_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {account.account_number && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(account.account_number || '', account.id);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          copiedId === account.id 
                            ? 'bg-green-100 text-green-600' 
                            : 'hover:bg-gray-100 text-gray-400'
                        }`}
                        title={isRtl ? 'نسخ رقم الحساب' : 'Copy account number'}
                      >
                        <ClipboardDocumentIcon className="h-4 w-4" />
                      </button>
                    )}
                    
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Show balance if available */}
                {account.current_balance !== undefined && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                    {isRtl ? 'الرصيد الحالي' : 'Current Balance'}: {' '}
                    <span className="font-medium">
                      {account.current_balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })} {account.currency_code || 'USD'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Show selected account details summary */}
      {selectedAccountId && (
        <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200">
          <div className="text-sm font-medium text-emerald-800 mb-2">
            {isRtl ? 'تفاصيل الحساب المختار:' : 'Selected Account Details:'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">{isRtl ? 'اسم البنك:' : 'Bank Name:'}</span>
              <span className={`${isRtl ? 'me-1' : 'ms-1'} font-medium`}>{formData.payment_bank_name}</span>
            </div>
            <div>
              <span className="text-gray-500">{isRtl ? 'العملة:' : 'Currency:'}</span>
              <span className={`${isRtl ? 'me-1' : 'ms-1'} font-medium`}>{formData.payment_currency}</span>
            </div>
            {formData.payment_account_number && (
              <div className="col-span-2">
                <span className="text-gray-500">{isRtl ? 'رقم الحساب:' : 'Account Number:'}</span>
                <span className={`${isRtl ? 'me-1' : 'ms-1'} font-mono font-medium`}>{formData.payment_account_number}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {errors?.payment_bank_account_id && (
        <p className="mt-2 text-sm text-red-600">{errors.payment_bank_account_id}</p>
      )}
    </div>
  );
}

