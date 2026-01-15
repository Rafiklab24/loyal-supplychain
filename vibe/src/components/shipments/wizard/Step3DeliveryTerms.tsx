/**
 * Shipment Wizard - Step 3: Delivery & Payment Terms
 * 
 * This is a wrapper around the shared DeliveryPaymentTerms component.
 * The actual implementation is in ../common/DeliveryPaymentTerms.tsx
 * which is shared between Contract and Shipment wizards.
 * 
 * This wrapper adds validation banners for commercial terms.
 * For selling (outgoing) shipments, also includes:
 * - SellingCostsSection for sea/land transport costs
 * - BankAccountSelector for receiving payments
 */

import { DeliveryPaymentTerms } from '../../common/DeliveryPaymentTerms';
import { ValidationBanner } from '../../common/ValidationBanner';
import { SellingCostsSection } from './SellingCostsSection';
import { BankAccountSelector } from './BankAccountSelector';
import { validateCommercialTerms } from '../../../utils/shipmentValidation';
import type { StepProps } from './types';

interface Step3DeliveryTermsProps extends StepProps {
  acknowledgedWarnings?: Set<string>;
  onAcknowledgeWarning?: (warningId: string) => void;
  onAcknowledgeAll?: () => void;
}

export function Step3DeliveryTerms({ 
  formData, 
  onChange, 
  errors,
  acknowledgedWarnings = new Set(),
  onAcknowledgeWarning,
  onAcknowledgeAll,
}: Step3DeliveryTermsProps) {
  // Run validation for commercial terms
  const validation = validateCommercialTerms(formData);

  return (
    <div className="space-y-4">
      {/* Validation Banner */}
      <ValidationBanner
        errors={validation.errors}
        warnings={validation.warnings}
        acknowledgedWarnings={acknowledgedWarnings}
        onAcknowledgeWarning={onAcknowledgeWarning}
        onAcknowledgeAll={onAcknowledgeAll}
        showAcknowledgeButton={true}
      />

      {/* Main Form */}
      <DeliveryPaymentTerms
        mode="shipment"
        formData={formData}
        onChange={onChange}
        errors={errors}
      />

      {/* Selling-specific sections - Only show for outgoing (sales) shipments */}
      {formData.transaction_type === 'outgoing' && (
        <>
          {/* Selling Costs Section */}
          <div className="mt-6">
            <SellingCostsSection
              formData={formData}
              onChange={onChange}
              errors={errors}
            />
          </div>
          
          {/* Bank Account Selector - Where buyer sends payment */}
          <div className="mt-6">
            <BankAccountSelector
              formData={formData}
              onChange={onChange}
              errors={errors}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default Step3DeliveryTerms;

