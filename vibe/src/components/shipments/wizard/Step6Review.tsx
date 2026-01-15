import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { 
  ExclamationTriangleIcon, 
  PencilSquareIcon,
  BuildingOfficeIcon,
  UserIcon,
  MapPinIcon,
  TruckIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatNumber } from '../../../utils/format';
import { ValidationBanner } from '../../common/ValidationBanner';
import { validateShipment, type ValidationIssue } from '../../../utils/shipmentValidation';
import { getCargoDisplay } from '../../../utils/cargoDisplay';
import { useBranches } from '../../../hooks/useBranches';
import type { StepProps } from './types';

interface Step6ReviewProps extends StepProps {
  onNavigateToStep?: (step: number) => void;
  validationErrors?: string[];
  // Smart validation
  smartValidationErrors?: ValidationIssue[];
  smartValidationWarnings?: ValidationIssue[];
  acknowledgedWarnings?: Set<string>;
  onAcknowledgeWarning?: (warningId: string) => void;
  onAcknowledgeAll?: () => void;
}

/**
 * Shipment Wizard - Step 6: Review & Confirm
 * Shows complete summary including Commercial & Ownership Summary with validation
 */
export function Step6Review({ 
  formData, 
  onNavigateToStep, 
  validationErrors = [],
  smartValidationErrors,
  smartValidationWarnings,
  acknowledgedWarnings = new Set(),
  onAcknowledgeWarning,
  onAcknowledgeAll,
}: Step6ReviewProps) {
  const { t } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  // Fetch branches to resolve branch names from IDs
  const { data: branchesData } = useBranches();
  
  // Run full validation if not provided externally
  const internalValidation = validateShipment(formData);
  const errors = smartValidationErrors || internalValidation.errors;
  const warnings = smartValidationWarnings || internalValidation.warnings;

  const isTanker = formData.cargo_type === 'tankers';
  const isCrudeOil = isTanker && formData.tanker_type === 'crude_oil';
  const isLPG = isTanker && formData.tanker_type === 'lpg';
  
  // Cargo type checks for tracking info
  const isFreightContainers = formData.cargo_type === 'containers';
  const isGeneralCargo = formData.cargo_type === 'general_cargo';
  const isTrucks = formData.cargo_type === 'trucks';
  const isTankers = formData.cargo_type === 'tankers';

  // =====================================================
  // COMMERCIAL & OWNERSHIP DATA RESOLUTION
  // =====================================================
  
  // Resolve Supplier (for incoming/purchase) or Customer (for outgoing/sale)
  const getCounterpartyInfo = () => {
    if (formData.transaction_type === 'incoming') {
      // We're buying - counterparty is the supplier
      return {
        label: t('shipments.wizard.review.supplier', 'المورد'),
        name: formData.supplier_name || '',
        id: formData.supplier_id || formData.supplier_company_id || '',
        type: 'supplier' as const,
        editStep: 1,
      };
    } else {
      // We're selling - counterparty is the customer
      return {
        label: t('shipments.wizard.review.customer', 'المشتري'),
        name: formData.customer_name || '',
        id: formData.customer_id || formData.customer_company_id || '',
        type: 'customer' as const,
        editStep: 1,
      };
    }
  };
  
  // Resolve Buyer/Importer
  const getBuyerInfo = () => {
    return {
      label: t('shipments.wizard.review.buyer', 'المشتري / المستورد'),
      name: formData.buyer_name || '',
      id: formData.buyer_id || '',
      editStep: 1,
    };
  };
  
  // Resolve Final Owner - based on destination type
  const getFinalOwnerInfo = () => {
    const destType = formData.final_destination?.type;
    
    if (destType === 'branch') {
      // For branches, the branch itself is the owner
      // Look up the branch name from branch_id since it may not be stored in final_destination.name
      const branchId = formData.final_destination?.branch_id;
      let branchName = formData.final_destination?.name || '';
      
      // If no name but we have branch_id, look it up from branchesData
      if (!branchName && branchId && branchesData?.branches) {
        const branch = branchesData.branches.find(b => b.id === branchId);
        if (branch) {
          branchName = isArabic ? (branch.name_ar || branch.name) : branch.name;
        }
      }
      
      return {
        label: t('shipments.wizard.review.finalOwner', 'المالك النهائي'),
        type: t('shipments.wizard.review.ownerTypeBranch', 'فرع'),
        name: branchName,
        editStep: 1,
      };
    } else if (destType === 'customer') {
      return {
        label: t('shipments.wizard.review.finalOwner', 'المالك النهائي'),
        type: t('shipments.wizard.review.ownerTypeCustomer', 'عميل خارجي'),
        name: formData.final_destination?.name || '',
        editStep: 1,
      };
    } else if (destType === 'consignment') {
      return {
        label: t('shipments.wizard.review.finalOwner', 'المالك النهائي'),
        type: t('shipments.wizard.review.ownerTypeConsignment', 'بضائع بالأمانة'),
        name: formData.final_destination?.name || t('shipments.wizard.review.consignmentOwner', 'بالأمانة - لم يتحدد المالك'),
        editStep: 1,
      };
    }
    
    return {
      label: t('shipments.wizard.review.finalOwner', 'المالك النهائي'),
      type: '',
      name: '',
      editStep: 1,
    };
  };
  
  // Resolve Final Destination
  const getFinalDestinationInfo = () => {
    const destType = formData.final_destination?.type;
    const deliveryPlace = formData.final_destination?.delivery_place || '';
    const address = formData.final_destination?.address || '';
    
    let location = deliveryPlace || address;
    
    // For branches, combine branch name + warehouse
    if (destType === 'branch') {
      // Look up branch name if not stored in final_destination.name
      let branchName = formData.final_destination?.name || '';
      if (!branchName && formData.final_destination?.branch_id && branchesData?.branches) {
        const branch = branchesData.branches.find(b => b.id === formData.final_destination?.branch_id);
        if (branch) {
          branchName = isArabic ? (branch.name_ar || branch.name) : branch.name;
        }
      }
      
      if (branchName) {
        location = deliveryPlace 
          ? `${branchName} - ${deliveryPlace}` 
          : branchName;
      }
    }
    
    return {
      label: t('shipments.wizard.review.finalDestination', 'الوجهة النهائية'),
      type: destType ? t(`shipments.wizard.review.destType_${destType}`, destType) : '',
      location,
      editStep: 1,
    };
  };
  
  const counterparty = getCounterpartyInfo();
  const buyer = getBuyerInfo();
  const finalOwner = getFinalOwnerInfo();
  const finalDestination = getFinalDestinationInfo();

  // Get weight unit display label
  const getWeightUnitLabel = () => {
    switch (formData.weight_unit) {
      case 'tons':
        return t('shipments.wizard.weightUnits.tons', 'Metric Tons');
      case 'kg':
        return t('shipments.wizard.weightUnits.kg', 'Kilograms (KG)');
      case 'other':
        return formData.weight_unit_custom || t('shipments.wizard.weightUnits.other', 'Other');
      default:
        return t('shipments.wizard.weightUnits.tons', 'Metric Tons');
    }
  };

  const getWeightUnitShort = () => {
    switch (formData.weight_unit) {
      case 'tons':
        return 'tons';
      case 'kg':
        return 'kg';
      case 'other':
        return formData.weight_unit_custom || '';
      default:
        return 'tons';
    }
  };

  const primaryContainerNumber =
    formData.container_numbers?.[0] || formData.container_number || '';

  // Calculate total value based on cargo type or product lines
  // CRITICAL: Use pre-calculated amount_usd from each line - this respects all pricing methods
  // (per_mt, per_package, per_barrel, per_container, etc.) and currency conversions
  let totalValue = 0;
  let avgPricePerMT = 0;
  let totalWeightFromLines = 0;
  
  // First check if we have product lines with pricing
  if (formData.lines && formData.lines.length > 0) {
    formData.lines.forEach((line: any) => {
      // Use the pre-calculated amount_usd from the line (calculated in Step2ProductLines.tsx)
      // This correctly handles all pricing methods and multi-currency support
      const lineAmount = Number(line.amount_usd) || 0;
      const qty = Number(line.quantity_mt) || 0;
      totalValue += lineAmount;
      totalWeightFromLines += qty;
    });
    
    // Calculate average price per MT
    if (totalWeightFromLines > 0) {
      avgPricePerMT = totalValue / totalWeightFromLines;
    }
  }
  // Fall back to single-price calculation
  else if (isCrudeOil && formData.barrels && formData.fixed_price_usd_per_barrel) {
    totalValue = Number(formData.barrels) * Number(formData.fixed_price_usd_per_barrel);
  } else if (formData.weight_ton && formData.fixed_price_usd_per_ton) {
    totalValue = Number(formData.weight_ton) * Number(formData.fixed_price_usd_per_ton);
    avgPricePerMT = Number(formData.fixed_price_usd_per_ton);
  }

  const incotermsMap: Record<string, string> = {
    'EXW': 'EXW - Ex Works',
    'FCA': 'FCA - Free Carrier',
    'FAS': 'FAS - Free Alongside Ship',
    'FOB': 'FOB - Free on Board',
    'CFR': 'CFR - Cost and Freight',
    'CIF': 'CIF - Cost, Insurance and Freight',
    'CPT': 'CPT - Carriage Paid To',
    'CIP': 'CIP - Carriage and Insurance Paid To',
    'DAP': 'DAP - Delivered at Place',
    'DPU': 'DPU - Delivered at Place Unloaded',
    'DDP': 'DDP - Delivered Duty Paid',
  };

  const paymentTermsMap: Record<string, string> = {
    'advance': 'Advance Payment',
    'lc': 'Letter of Credit (LC)',
    'net30': 'Net 30 Days',
    'net60': 'Net 60 Days',
    'cod': 'Cash on Delivery (COD)',
  };

  const cargoTypeMap: Record<string, string> = {
    'general_cargo': 'General Cargo',
    'tankers': 'Tankers',
    'containers': 'Freight Containers',
    'trucks': 'Trucks',
  };

  const tankerTypeMap: Record<string, string> = {
    'crude_oil': 'Crude Oil',
    'lpg': 'LPG (Liquefied Petroleum Gas)',
  };

  // Helper component for missing field warning
  const MissingFieldWarning = ({ 
    label, 
    editStep 
  }: { 
    label: string; 
    editStep: number;
  }) => (
    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
        <div>
          <span className="text-sm font-medium text-amber-800">{label}</span>
          <span className="text-sm text-amber-600 ms-2">
            {t('shipments.wizard.review.notSet', 'غير محدد')}
          </span>
        </div>
      </div>
      {onNavigateToStep && (
        <button
          type="button"
          onClick={() => onNavigateToStep(editStep)}
          className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
        >
          <PencilSquareIcon className="h-4 w-4" />
          {t('common.edit', 'تعديل')}
        </button>
      )}
    </div>
  );

  // Helper component for filled field display
  const FilledField = ({ 
    label, 
    value, 
    subValue,
    icon: Icon,
    editStep 
  }: { 
    label: string; 
    value: string;
    subValue?: string;
    icon?: React.ComponentType<{ className?: string }>;
    editStep: number;
  }) => (
    <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="p-2 bg-blue-100 rounded-lg mt-0.5">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
        )}
        <div>
          <span className="text-xs text-gray-500 block">{label}</span>
          <span className="text-sm font-semibold text-gray-900">{value}</span>
          {subValue && (
            <span className="text-xs text-gray-500 block mt-0.5">{subValue}</span>
          )}
        </div>
      </div>
      {onNavigateToStep && (
        <button
          type="button"
          onClick={() => onNavigateToStep(editStep)}
          className="text-gray-400 hover:text-blue-600 transition-colors p-1"
          title={t('common.edit', 'تعديل')}
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('shipments.wizard.step6ReviewTitle', 'المراجعة والتأكيد')}
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {t('shipments.wizard.step6ReviewDescription', 'يرجى مراجعة جميع المعلومات قبل الإرسال')}
        </p>
      </div>

      {/* ========================================= */}
      {/* SMART VALIDATION BANNER (New) */}
      {/* ========================================= */}
      <ValidationBanner
        errors={errors}
        warnings={warnings}
        acknowledgedWarnings={acknowledgedWarnings}
        onAcknowledgeWarning={onAcknowledgeWarning}
        onAcknowledgeAll={onAcknowledgeAll}
        showAcknowledgeButton={true}
        collapsible={false}
        defaultExpanded={true}
      />

      {/* ========================================= */}
      {/* LEGACY VALIDATION ERRORS BANNER */}
      {/* ========================================= */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 mb-2">
                {t('shipments.wizard.review.validationErrorTitle', 'يرجى إكمال الحقول المطلوبة قبل الإرسال')}
              </h4>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* COMMERCIAL & OWNERSHIP SUMMARY - TOP PRIORITY */}
      {/* ========================================= */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border-2 border-blue-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-600 rounded-lg">
            <BuildingOfficeIcon className="h-5 w-5 text-white" />
          </div>
          <h4 className="font-bold text-lg text-blue-900">
            {t('shipments.wizard.review.commercialOwnershipSummary', 'ملخص الأطراف التجارية والملكية')}
          </h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Supplier / Customer (Counterparty) */}
          {counterparty.name ? (
            <FilledField
              label={counterparty.label}
              value={counterparty.name}
              subValue={counterparty.id ? `ID: ${counterparty.id.substring(0, 8)}...` : undefined}
              icon={UserIcon}
              editStep={counterparty.editStep}
            />
          ) : (
            <MissingFieldWarning 
              label={counterparty.label} 
              editStep={counterparty.editStep} 
            />
          )}

          {/* Buyer / Importer */}
          {buyer.name ? (
            <FilledField
              label={buyer.label}
              value={buyer.name}
              subValue={buyer.id ? `ID: ${buyer.id.substring(0, 8)}...` : undefined}
              icon={BuildingOfficeIcon}
              editStep={buyer.editStep}
            />
          ) : (
            <FilledField
              label={buyer.label}
              value={t('shipments.wizard.review.notSpecified', 'غير محدد (اختياري)')}
              icon={BuildingOfficeIcon}
              editStep={buyer.editStep}
            />
          )}

          {/* Final Owner */}
          {finalOwner.name ? (
            <FilledField
              label={finalOwner.label}
              value={finalOwner.name}
              subValue={finalOwner.type}
              icon={UserIcon}
              editStep={finalOwner.editStep}
            />
          ) : (
            <MissingFieldWarning 
              label={finalOwner.label} 
              editStep={finalOwner.editStep} 
            />
          )}

          {/* Final Destination */}
          {finalDestination.location ? (
            <FilledField
              label={finalDestination.label}
              value={finalDestination.location}
              subValue={finalDestination.type}
              icon={MapPinIcon}
              editStep={finalDestination.editStep}
            />
          ) : (
            <MissingFieldWarning 
              label={finalDestination.label} 
              editStep={finalDestination.editStep} 
            />
          )}
        </div>

        {/* Internal Route Summary (if cross-border) */}
        {formData.is_cross_border && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <TruckIcon className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-blue-900">
                {t('shipments.wizard.review.internalRoute', 'المسار الداخلي (عبر الحدود)')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="bg-blue-100 px-2 py-1 rounded text-blue-800">
                {formData.pod_name || formData.pod || 'POD'}
              </span>
              <span className="text-blue-400">→</span>
              {formData.primary_border_name && (
                <>
                  <span className="bg-amber-100 px-2 py-1 rounded text-amber-800">
                    🚧 {formData.primary_border_name}
                  </span>
                  <span className="text-blue-400">→</span>
                </>
              )}
              <span className="bg-green-100 px-2 py-1 rounded text-green-800">
                {finalDestination.location || t('shipments.wizard.review.notSet', 'غير محدد')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="space-y-4">
        {/* Basic Information */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">
              {t('shipments.wizard.step1Title', 'المعلومات الأساسية')}
            </h4>
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => onNavigateToStep(1)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <PencilSquareIcon className="h-4 w-4" />
                {t('common.edit', 'تعديل')}
              </button>
            )}
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <dt className="text-sm text-gray-600">{t('shipments.wizard.transactionType', 'نوع المعاملة')}</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formData.transaction_type === 'incoming' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                    📦 {t('shipments.wizard.directionIncoming', 'شراء (نحن المشتري)')}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                    🚚 {t('shipments.wizard.directionOutgoing', 'بيع (نحن البائع)')}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.sn')}</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.sn || '-'}</dd>
            </div>
            {formData.subject && (
              <div className="md:col-span-2">
                <dt className="text-sm text-gray-600">{t('shipments.wizard.subject', 'الموضوع')}</dt>
                <dd className="text-sm font-medium text-gray-900">{formData.subject}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.product')}</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.product_text || '-'}</dd>
            </div>
            {formData.country_of_export && (
              <div>
                <dt className="text-sm text-gray-600">{t('shipments.wizard.countryOfExport', 'بلد التصدير')}</dt>
                <dd className="text-sm font-medium text-gray-900">🌍 {formData.country_of_export}</dd>
              </div>
            )}
            {formData.has_broker && (
              <div className="md:col-span-2 pt-2 border-t border-gray-300">
                <dt className="text-sm text-gray-600">{t('shipments.wizard.brokerName', 'اسم الوسيط')}</dt>
                <dd className="text-sm font-medium text-gray-900">{formData.broker_name || '-'}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Product Lines Summary (if exists) */}
        {formData.lines && formData.lines.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">
                📦 {t('shipments.wizard.productLines', 'بنود المنتجات')} ({formData.lines.length})
              </h4>
              {onNavigateToStep && (
                <button
                  type="button"
                  onClick={() => onNavigateToStep(2)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  {t('common.edit', 'تعديل')}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-start py-2 text-gray-600 font-medium">{t('shipments.wizard.product', 'المنتج')}</th>
                    <th className="text-end py-2 text-gray-600 font-medium">{t('shipments.wizard.quantity', 'الكمية (MT)')}</th>
                    <th className="text-end py-2 text-gray-600 font-medium">{t('shipments.wizard.unitPrice', 'سعر الوحدة')}</th>
                    <th className="text-end py-2 text-gray-600 font-medium">{t('shipments.wizard.amount', 'المبلغ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.lines.map((line: any, idx: number) => {
                    const qty = Number(line.quantity_mt) || 0;
                    const price = Number(line.unit_price) || 0;
                    const exchangeRate = Number(line.exchange_rate_to_usd) || 1;
                    // CRITICAL: Use the pre-calculated amount_usd from the line
                    // This correctly handles all pricing methods (per_mt, per_package, per_barrel, etc.)
                    const lineAmount = Number(line.amount_usd) || 0;
                    const pricingMethod = line.pricing_method || 'per_mt';
                    return (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 text-gray-900">{line.product_name || line.type_of_goods || '-'}</td>
                        <td className="py-2 text-end text-gray-900">{formatNumber(qty)}</td>
                        <td className="py-2 text-end text-gray-900">
                          {formatCurrency(price)} {line.currency_code || 'USD'}
                          {pricingMethod !== 'per_mt' && (
                            <span className="text-xs text-gray-500 block">({pricingMethod.replace('per_', '/')})</span>
                          )}
                          {line.currency_code && line.currency_code !== 'USD' && exchangeRate !== 1 && (
                            <span className="text-xs text-gray-500 block">×{exchangeRate}</span>
                          )}
                        </td>
                        <td className="py-2 text-end font-medium text-gray-900">{formatCurrency(lineAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-100">
                    <td className="py-2 font-semibold text-gray-900">{t('common.total', 'الإجمالي')}</td>
                    <td className="py-2 text-end font-semibold text-gray-900">{formatNumber(totalWeightFromLines)} MT</td>
                    <td className="py-2 text-end font-medium text-amber-600">
                      {avgPricePerMT > 0 && `${t('shipments.wizard.review.avg', 'متوسط')}: ${formatCurrency(avgPricePerMT)}/MT`}
                    </td>
                    <td className="py-2 text-end font-bold text-blue-600">{formatCurrency(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Commercial Terms */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">
              {t('shipments.wizard.step3CommercialTitle', 'شروط التسليم والدفع')}
            </h4>
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => onNavigateToStep(3)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <PencilSquareIcon className="h-4 w-4" />
                {t('common.edit', 'تعديل')}
              </button>
            )}
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Dynamic Cargo Display - Shows cargo type with count */}
            <div className="md:col-span-2 bg-gray-50 p-3 rounded-lg">
              <dt className="text-sm text-gray-600 mb-1">{t('shipments.cargo', 'الشحنة')}</dt>
              <dd className="text-base font-semibold text-gray-900">
                {(() => {
                  const cargoInfo = getCargoDisplay({
                    cargo_type: formData.cargo_type,
                    tanker_type: formData.tanker_type,
                    container_count: formData.container_count,
                    truck_count: formData.truck_count,
                    barrels: formData.barrels,
                    unit_count: formData.unit_count || formData.package_count,
                    package_count: formData.package_count,
                  });
                  // Use Arabic or English based on current language
                  const isArabic = document.documentElement.lang === 'ar' || 
                    document.documentElement.dir === 'rtl';
                  return isArabic ? cargoInfo.displayAr : cargoInfo.displayEn;
                })()}
              </dd>
            </div>
            
            {/* Show cost per barrel for Crude Oil */}
            {isCrudeOil && (
              <>
                <div>
                  <dt className="text-sm text-gray-600">{t('shipments.wizard.costPerBarrel', 'التكلفة لكل برميل')}</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formData.fixed_price_usd_per_barrel ? formatCurrency(Number(formData.fixed_price_usd_per_barrel)) : '-'}
                  </dd>
                </div>
                {formData.transaction_type === 'outgoing' && formData.selling_price_usd_per_barrel && (
                  <div>
                    <dt className="text-sm text-gray-600">{t('shipments.wizard.sellingPricePerBarrel', 'سعر البيع لكل برميل')}</dt>
                    <dd className="text-sm font-medium text-green-700">
                      {formatCurrency(Number(formData.selling_price_usd_per_barrel))}
                    </dd>
                  </div>
                )}
              </>
            )}
            
            {/* Show Weight for LPG and non-tanker cargo */}
            {(isLPG || (!isTanker && formData.cargo_type)) && (
              <>
                <div>
                  <dt className="text-sm text-gray-600">{t('shipments.weight')}</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formData.weight_ton ? `${formatNumber(Number(formData.weight_ton))} ${getWeightUnitShort()}` : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">{t('shipments.wizard.weightUnit', 'وحدة الوزن')}</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {getWeightUnitLabel()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">{t('shipments.wizard.costPerTon', 'التكلفة لكل طن')}</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formData.fixed_price_usd_per_ton ? formatCurrency(Number(formData.fixed_price_usd_per_ton)) : '-'}
                  </dd>
                </div>
                {formData.transaction_type === 'outgoing' && formData.selling_price_usd_per_ton && (
                  <div>
                    <dt className="text-sm text-gray-600">{t('shipments.wizard.sellingPricePerTon', 'سعر البيع لكل طن')}</dt>
                    <dd className="text-sm font-medium text-green-700">
                      {formatCurrency(Number(formData.selling_price_usd_per_ton))}
                    </dd>
                  </div>
                )}
              </>
            )}
            
            {/* Average Price per MT (when product lines exist) */}
            {avgPricePerMT > 0 && (
              <div>
                <dt className="text-sm text-gray-600">{t('shipments.wizard.avgPricePerMT', 'متوسط السعر لكل MT')}</dt>
                <dd className="text-sm font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block">
                  {formatCurrency(avgPricePerMT)} /MT
                </dd>
              </div>
            )}
            <div className="md:col-span-2">
              <dt className="text-sm text-gray-600 font-semibold">{t('shipments.totalValue')}</dt>
              <dd className="text-sm font-bold text-blue-600">
                {totalValue > 0 ? formatCurrency(totalValue) : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.wizard.paymentTerms', 'شروط الدفع')}</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formData.payment_terms ? paymentTermsMap[formData.payment_terms] : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.wizard.incoterms', 'شروط التسليم')}</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formData.incoterms ? incotermsMap[formData.incoterms] : '-'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Logistics Details */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">
              🚢 {t('shipments.wizard.logisticsDetails', 'التفاصيل اللوجستية')}
            </h4>
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => onNavigateToStep(4)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <PencilSquareIcon className="h-4 w-4" />
                {t('common.edit', 'تعديل')}
              </button>
            )}
          </div>

          {/* Check if split shipment mode */}
          {formData.is_split_shipment && formData.batches && formData.batches.length > 0 ? (
            // BATCH MODE DISPLAY
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm font-medium text-blue-900">
                  📦 {t('shipments.wizard.splitShipment', 'شحنة مقسمة')} - {formData.batches.length} {t('shipments.wizard.batches', 'دفعات')}
                </p>
              </div>

              {formData.batches.map((batch) => (
                <div key={batch.id} className="border border-gray-300 rounded-lg p-4 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">
                      {batch.batch_number}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {batch.batch_name || `${t('shipments.wizard.batch', 'دفعة')} ${batch.batch_number}`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ms-auto ${
                      batch.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      batch.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                      batch.status === 'arrived' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {batch.status}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {batch.weight_ton && (
                      <div>
                        <dt className="text-xs text-gray-500">{t('shipments.wizard.weight', 'الوزن')}</dt>
                        <dd className="font-medium text-gray-900">{batch.weight_ton} {getWeightUnitShort()}</dd>
                      </div>
                    )}
                    {batch.container_count && (
                      <div>
                        <dt className="text-xs text-gray-500">
                          {isGeneralCargo ? t('shipments.wizard.units', 'الوحدات') : t('shipments.wizard.containerCount', 'الحاويات')}
                        </dt>
                        <dd className="font-medium text-gray-900">{batch.container_count}</dd>
                      </div>
                    )}
                    {batch.etd && (
                      <div>
                        <dt className="text-xs text-gray-500">{t('shipments.etd', 'ETD')}</dt>
                        <dd className="font-medium text-gray-900">{new Date(batch.etd).toLocaleDateString('en-GB')}</dd>
                      </div>
                    )}
                    {batch.eta && (
                      <div>
                        <dt className="text-xs text-gray-500">{t('shipments.eta', 'ETA')}</dt>
                        <dd className="font-medium text-gray-900">{new Date(batch.eta).toLocaleDateString('en-GB')}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            // SINGLE SHIPMENT MODE DISPLAY
            <>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.origin')} (POL)</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.pol_name || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.destination')} (POD)</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.pod_name || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.etd', 'ETD')}</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.etd || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.eta')}</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.eta || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.freeTime')}</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formData.free_time_days ? `${formData.free_time_days} ${t('common.days', 'يوم')}` : '-'}
              </dd>
            </div>
            {/* Note: Customs clearance date is entered post-arrival in Shipment Tracking */}
            <div className="md:col-span-2">
              <dt className="text-sm text-gray-600">{t('shipments.shippingLine')}</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.shipping_line_name || formData.shipping_line_id || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.bookingNo')}</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.booking_no || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">{t('shipments.blNo')}</dt>
              <dd className="text-sm font-medium text-gray-900">{formData.bl_no || '-'}</dd>
            </div>
            {formData.transportation_cost && (
              <div className="md:col-span-2">
                <dt className="text-sm text-gray-600">{t('shipments.wizard.transportationCost', 'تكلفة النقل')}</dt>
                <dd className="text-sm font-medium text-gray-900">
                  <span className="flex items-center gap-2">
                    {formatCurrency(Number(formData.transportation_cost))}
                    {formData.transport_cost_responsibility && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        formData.transport_cost_responsibility === 'ours'
                          ? 'bg-green-100 text-green-800'
                          : formData.transport_cost_responsibility === 'counterparty'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {formData.transport_cost_responsibility === 'ours' && t('shipments.wizard.review.ourCost', 'على عاتقنا')}
                        {formData.transport_cost_responsibility === 'counterparty' && t('shipments.wizard.review.counterpartyCost', 'على الطرف الآخر')}
                        {formData.transport_cost_responsibility === 'unspecified' && t('shipments.wizard.review.unspecifiedCost', 'غير محدد')}
                      </span>
                    )}
                  </span>
                  {formData.transport_cost_responsibility === 'ours' && (
                    <p className="text-xs text-green-600 mt-1">✓ {t('shipments.wizard.review.includedInCOGS', 'يُحتسب ضمن تكلفة البضاعة')}</p>
                  )}
                  {formData.transport_cost_responsibility === 'counterparty' && (
                    <p className="text-xs text-blue-600 mt-1">ℹ️ {t('shipments.wizard.review.referenceOnly', 'مرجعي فقط - لا يُحتسب ضمن مصاريفنا')}</p>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {/* Cargo-Specific Tracking Info */}
          {((isFreightContainers && primaryContainerNumber) ||
            (isGeneralCargo && (formData.vessel_name || formData.vessel_imo)) ||
            (isTrucks && (formData.truck_plate_number || formData.cmr)) ||
            (isTankers && (formData.tanker_name || formData.tanker_imo))) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <dt className="text-sm text-gray-600 font-semibold mb-2">
                {t('shipments.wizard.trackingInfo', 'معلومات التتبع')}
              </dt>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {isFreightContainers && primaryContainerNumber && (
                  <div>
                    <dt className="text-xs text-gray-500">{t('shipments.wizard.containerNumber', 'رقم الحاوية')}</dt>
                    <dd className="text-sm font-medium text-gray-900">{primaryContainerNumber}</dd>
                  </div>
                )}
                {isGeneralCargo && formData.vessel_name && (
                  <div>
                    <dt className="text-xs text-gray-500">{t('shipments.wizard.vesselName', 'اسم السفينة')}</dt>
                    <dd className="text-sm font-medium text-gray-900">{formData.vessel_name}</dd>
                  </div>
                )}
                {isGeneralCargo && formData.vessel_imo && (
                  <div>
                    <dt className="text-xs text-gray-500">{t('shipments.wizard.vesselIMO', 'IMO')}</dt>
                    <dd className="text-sm font-medium text-gray-900">{formData.vessel_imo}</dd>
                  </div>
                )}
                {isTrucks && formData.truck_plate_number && (
                  <div>
                    <dt className="text-xs text-gray-500">{t('shipments.wizard.truckPlate', 'لوحة الشاحنة')}</dt>
                    <dd className="text-sm font-medium text-gray-900">{formData.truck_plate_number}</dd>
                  </div>
                )}
                {isTrucks && formData.cmr && (
                  <div>
                    <dt className="text-xs text-gray-500">{t('shipments.wizard.cmr', 'CMR')}</dt>
                    <dd className="text-sm font-medium text-gray-900">{formData.cmr}</dd>
                  </div>
                )}
                {isTankers && formData.tanker_name && (
                  <div>
                    <dt className="text-xs text-gray-500">{t('shipments.wizard.tankerName', 'اسم الناقلة')}</dt>
                    <dd className="text-sm font-medium text-gray-900">{formData.tanker_name}</dd>
                  </div>
                )}
                {isTankers && formData.tanker_imo && (
                  <div>
                    <dt className="text-xs text-gray-500">{t('shipments.wizard.tankerIMO', 'IMO')}</dt>
                    <dd className="text-sm font-medium text-gray-900">{formData.tanker_imo}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          </>
          )}
        </div>

        {/* Documents */}
        {formData.documents && formData.documents.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">
                📄 {t('documents.title', 'المستندات')}
              </h4>
              {onNavigateToStep && (
                <button
                  type="button"
                  onClick={() => onNavigateToStep(5)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  {t('common.edit', 'تعديل')}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {formData.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl">📎</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t(`documents.types.${doc.type}`, doc.type)}
                        {doc.notes && ` • ${doc.notes}`}
                      </p>
                      {doc.file && (
                        <p className="text-xs text-gray-400">
                          {(doc.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded">
                    {t('documents.uploaded', 'تم التحميل')}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {t('documents.totalDocuments', {
                count: formData.documents.length,
                defaultValue: `${formData.documents.length} مستند(ات) جاهزة للتحميل`
              })}
            </p>
          </div>
        )}

        {/* Notes */}
        {formData.notes && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">{t('common.notes')}</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.notes}</p>
          </div>
        )}
      </div>

      {/* Status Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>{t('common.note', 'ملاحظة')}:</strong>{' '}
          {t('shipments.wizard.statusNote', 'سيتم إنشاء هذه الشحنة بحالة "التخطيط". يمكنك تحديث الحالة لاحقاً مع تقدم الشحنة.')}
        </p>
      </div>
    </div>
  );
}
