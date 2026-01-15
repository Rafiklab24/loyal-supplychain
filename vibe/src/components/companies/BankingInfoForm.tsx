import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Company, CompanyBankingInfo } from '../../types/api';

interface BankingInfoFormProps {
  company: Company;
  onSave: (bankingInfo: CompanyBankingInfo, productCategories?: string[]) => Promise<void>;
}

export function BankingInfoForm({ company, onSave }: BankingInfoFormProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const [bankingInfo, setBankingInfo] = useState<CompanyBankingInfo>(
    company.extra_json?.banking || {}
  );
  const [productCategories, setProductCategories] = useState<string[]>(
    company.extra_json?.product_categories || []
  );
  const [newCategory, setNewCategory] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    try {
      // Save both banking info and product categories
      await onSave(bankingInfo, productCategories);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save information');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !productCategories.includes(newCategory.trim())) {
      setProductCategories([...productCategories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (category: string) => {
    setProductCategories(productCategories.filter(c => c !== category));
  };

  const handleFieldChange = (field: keyof CompanyBankingInfo, value: string) => {
    setBankingInfo({ ...bankingInfo, [field]: value });
  };

  const hasBankingInfo = company.extra_json?.banking && Object.keys(company.extra_json.banking).length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          🏦 {isRtl ? 'المعلومات البنكية' : 'Banking Information'}
        </h3>
        {hasBankingInfo && (
          <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full font-medium">
            ✓ {isRtl ? 'محفوظة' : 'Saved'}
          </span>
        )}
      </div>

      {showSuccess && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✅ {isRtl ? 'تم حفظ المعلومات البنكية بنجاح' : 'Banking information saved successfully'}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            ⚠️ {error}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Categories Section */}
        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            📦 {isRtl ? 'فئات المنتجات' : 'Product Categories'}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            {isRtl 
              ? 'ما هي أنواع البضائع التي يتعامل بها هذا المورد؟' 
              : 'What types of goods does this supplier deal with?'}
          </p>
          
          {/* Add Category Input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={isRtl ? 'مثال: أرز، قمح، ذرة' : 'e.g., Rice, Wheat, Corn'}
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              {isRtl ? 'إضافة' : 'Add'}
            </button>
          </div>

          {/* Category Tags */}
          {productCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {productCategories.map((category, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                >
                  <span>{category}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(category)}
                    className="hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              {isRtl ? 'لم يتم إضافة فئات بعد' : 'No categories added yet'}
            </p>
          )}
        </div>

        {/* Banking Information Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Account Holder Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'اسم صاحب الحساب' : 'Account Holder Name'}
            </label>
            <input
              type="text"
              value={bankingInfo.account_holder_name || ''}
              onChange={(e) => handleFieldChange('account_holder_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={company.name}
            />
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'اسم البنك' : 'Bank Name'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankingInfo.bank_name || ''}
              onChange={(e) => handleFieldChange('bank_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={isRtl ? 'مثال: بنك HSBC الإمارات' : 'e.g., HSBC UAE'}
              required
            />
          </div>

          {/* Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'الفرع' : 'Branch'}
            </label>
            <input
              type="text"
              value={bankingInfo.branch || ''}
              onChange={(e) => handleFieldChange('branch', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={isRtl ? 'مثال: فرع دبي الرئيسي' : 'e.g., Dubai Main Branch'}
            />
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'رقم الحساب' : 'Account Number'}
            </label>
            <input
              type="text"
              value={bankingInfo.account_number || ''}
              onChange={(e) => handleFieldChange('account_number', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
              placeholder="1234567890"
            />
          </div>

          {/* IBAN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'رقم IBAN' : 'IBAN'}
            </label>
            <input
              type="text"
              value={bankingInfo.iban || ''}
              onChange={(e) => handleFieldChange('iban', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
              placeholder="AE070331234567890123456"
            />
          </div>

          {/* SWIFT Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'رمز SWIFT' : 'SWIFT Code'}
            </label>
            <input
              type="text"
              value={bankingInfo.swift_code || ''}
              onChange={(e) => handleFieldChange('swift_code', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono uppercase"
              placeholder="BBMEAEAD"
              maxLength={11}
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'العملة' : 'Currency'}
            </label>
            <select
              value={bankingInfo.currency || 'USD'}
              onChange={(e) => handleFieldChange('currency', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="SAR">SAR - Saudi Riyal</option>
              <option value="QAR">QAR - Qatari Riyal</option>
              <option value="KWD">KWD - Kuwaiti Dinar</option>
              <option value="BHD">BHD - Bahraini Dinar</option>
              <option value="OMR">OMR - Omani Rial</option>
            </select>
          </div>

          {/* Bank Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'عنوان البنك' : 'Bank Address'}
            </label>
            <input
              type="text"
              value={bankingInfo.bank_address || ''}
              onChange={(e) => handleFieldChange('bank_address', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={isRtl ? 'مثال: شارع الشيخ زايد، دبي، الإمارات' : 'e.g., Sheikh Zayed Road, Dubai, UAE'}
            />
          </div>

          {/* Intermediary Bank */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'البنك الوسيط' : 'Intermediary Bank'} 
              <span className="text-gray-500 text-xs ml-2">
                ({isRtl ? 'اختياري' : 'Optional'})
              </span>
            </label>
            <input
              type="text"
              value={bankingInfo.intermediary_bank || ''}
              onChange={(e) => handleFieldChange('intermediary_bank', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={isRtl ? 'إذا لزم الأمر للتحويلات الدولية' : 'If required for international transfers'}
            />
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isRtl ? 'ملاحظات' : 'Notes'}
            </label>
            <textarea
              value={bankingInfo.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder={isRtl ? 'أي معلومات إضافية حول الحساب البنكي' : 'Any additional information about the bank account'}
            />
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 dark:text-blue-400 text-xl">💡</span>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">
                {isRtl ? 'نصيحة أمنية' : 'Security Tip'}
              </p>
              <p>
                {isRtl 
                  ? 'سيتم استخدام هذه المعلومات تلقائياً عند إنشاء شحنات جديدة. إذا تم إدخال معلومات بنكية مختلفة في الشحنة، سيظهر تنبيه أمني للتحقق من التغيير.'
                  : 'This information will be automatically imported when creating new shipments. If different banking details are entered in a shipment, a security alert will prompt verification.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">🔄</span>
                {isRtl ? 'جاري الحفظ...' : 'Saving...'}
              </>
            ) : (
              <>
                <span>💾</span>
                {isRtl ? 'حفظ المعلومات البنكية' : 'Save Banking Info'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Last Updated Info */}
      {company.extra_json?.banking?.last_updated && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isRtl ? 'آخر تحديث: ' : 'Last updated: '}
            {new Date(company.extra_json.banking.last_updated).toLocaleString('en-US')}
            {company.extra_json.banking.updated_by && (
              <> {isRtl ? 'بواسطة' : 'by'} {company.extra_json.banking.updated_by}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

