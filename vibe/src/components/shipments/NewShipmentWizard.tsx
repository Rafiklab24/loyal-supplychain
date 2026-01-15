import { useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { ProgressStepper } from './wizard/ProgressStepper';
import { Step1BasicInfo } from './wizard/Step1BasicInfo';
import { Step2ProductLines } from './wizard/Step2ProductLines';
import { Step3DeliveryTerms } from './wizard/Step3DeliveryTerms';
import { Step4Logistics } from './wizard/Step4Logistics';
import { Step5Documents } from './wizard/Step5Documents';
import { Step6Review } from './wizard/Step6Review';
import { initialFormData, type ShipmentFormData } from './wizard/types';
import { createShipment } from '../../services/shipments';
import { uploadDocument, type DocumentType } from '../../services/documents';
import { useShipmentValidation } from '../../hooks/useShipmentValidation';

interface NewShipmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialContractId?: string;
  initialContractNo?: string;
  initialContract?: any; // Full contract object
  initialStep?: number; // For field highlighting from mapping audit
}

export function NewShipmentWizard({ isOpen, onClose, onSuccess, initialContractId, initialContractNo, initialContract, initialStep }: NewShipmentWizardProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(initialStep || 1);
  
  // Update current step when initialStep prop changes (for field highlighting)
  useEffect(() => {
    if (initialStep && initialStep !== currentStep) {
      setCurrentStep(initialStep);
    }
  }, [initialStep]);
  
  // Extract contract lines if provided
  // NORMALIZED: Contract now returns lines at top level, fallback to extra_json for old data
  const contractLines = initialContract?.lines || initialContract?.extra_json?.lines || [];
  
  // Initialize form data with contract info if provided
  // NORMALIZED: Contract API now returns structured nested objects (commercial_parties, shipping, terms, banking_docs)
  const [formData, setFormData] = useState<ShipmentFormData>(() => {
    const baseData = { ...initialFormData };
    
    if (initialContract) {
      // Pre-fill from contract data
      // NORMALIZED: Read from structured response first, fallback to extra_json for backward compatibility
      const extraData = initialContract.extra_json || {};
      const commercial = initialContract.commercial_parties || extraData.commercial_parties || {};
      const shipping = initialContract.shipping || extraData.shipping || {};
      const terms = initialContract.terms || extraData.terms || {};
      const banking = initialContract.banking_docs || extraData.banking_docs || {};
      const lines = initialContract.lines || extraData.lines || [];
      
      console.log('📦 Importing contract data to shipment wizard:', initialContract.contract_no);
      console.log('  commercial_parties:', initialContract.commercial_parties ? 'from response' : 'from extra_json');
      console.log('  shipping:', initialContract.shipping ? 'from response' : 'from extra_json');
      console.log('  terms:', initialContract.terms ? 'from response' : 'from extra_json');
      console.log('  banking_docs:', initialContract.banking_docs ? 'from response' : 'from extra_json');
      console.log('  lines:', lines.length, 'lines');
      
      baseData.contract_id = initialContract.id;
      baseData.has_sales_contract = true;
      baseData.sn = `${initialContract.contract_no}-SHIP-${Date.now().toString().slice(-6)}`;
      
      // ========== Commercial parties ==========
      if (initialContract.seller_company_id || commercial.exporter_company_id) {
        baseData.supplier_company_id = initialContract.seller_company_id || commercial.exporter_company_id;
        baseData.supplier_name = initialContract.seller_name || commercial.exporter_name || '';
      }
      if (initialContract.buyer_company_id || commercial.buyer_company_id) {
        baseData.customer_company_id = initialContract.buyer_company_id || commercial.buyer_company_id;
        baseData.customer_name = initialContract.buyer_name || commercial.buyer_name || '';
      }
      
      // Broker info
      if (commercial.has_broker) {
        baseData.has_broker = true;
        baseData.broker_name = commercial.broker_buying_name || commercial.broker_selling_name || '';
      }
      
      // ========== Direction ==========
      baseData.transaction_type = initialContract.direction || extraData.direction || 'incoming';
      
      // ========== Terms ==========
      if (terms) {
        baseData.incoterms = terms.incoterm || baseData.incoterms;
        baseData.currency_code = terms.currency_code || baseData.currency_code || 'USD';
        baseData.cargo_type = terms.cargo_type || '';
        baseData.tanker_type = terms.tanker_type || '';
        baseData.payment_terms = terms.payment_terms || '';
        if (terms.container_count) baseData.container_count = terms.container_count;
        if (terms.weight_ton) baseData.weight_ton = terms.weight_ton;
        if (terms.barrels) baseData.barrels = terms.barrels;
      }
      
      // ========== Shipping ==========
      if (shipping) {
        baseData.country_of_export = shipping.country_of_export || '';
        // POL/POD are IDs in the normalized structure
        if (shipping.port_of_loading_id) {
          // Store the ID - the frontend will resolve the name
          baseData.pol = shipping.port_of_loading_id;
        }
        if (shipping.final_destination_id) {
          baseData.pod = shipping.final_destination_id;
        }
      }
      
      // ========== Final Destination (from banking_docs) ==========
      if (banking && banking.has_final_destination) {
        baseData.has_final_destination = true;
        baseData.final_destination = {
          type: banking.final_destination_type || '',
          name: banking.final_destination_name || '',
          delivery_place: banking.final_destination_delivery_place || '',
          address: banking.final_destination_address || '',
          contact: banking.final_destination_contact || '',
          selling_price: banking.final_destination_selling_price || '',
          notes: banking.final_destination_notes || '',
          branch_id: banking.final_destination_type === 'branch' ? banking.final_destination_company_id : undefined,
        };
        console.log('  ✅ Imported final_destination:', baseData.final_destination);
      }
      
      // ========== Lines ==========
      if (lines && lines.length > 0) {
        const totalQuantity = lines.reduce((sum: number, line: any) => {
          return sum + (parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || parseFloat(line.quantity) || 0);
        }, 0);
        if (totalQuantity > 0) {
          baseData.weight_value = totalQuantity.toString();
          baseData.weight_unit = 'MT';
        }
        
        // Import product lines from contract - normalize field names and ensure numeric types
        // CRITICAL: Must set ALL fields needed for price calculation to work properly
        baseData.lines = lines.map((line: any) => {
          // Get fulfillment data from contract line
          const contractQty = parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || parseFloat(line.quantity) || 0;
          const shippedQty = parseFloat(line.shipped_quantity_mt) || 0;
          const pendingQty = contractQty - shippedQty;
          
          return {
            ...line,
            id: line.id || `imported-${Date.now()}-${Math.random()}`,
            // Link back to contract line for fulfillment tracking
            contract_line_id: line.id,
            // Normalize field names for shipment wizard compatibility
            product_name: line.product_name || line.type_of_goods || line.product_description || '',
            type_of_goods: line.type_of_goods || line.product_name || '',
            // CRITICAL: Default to PENDING quantity for partial shipments (not full contract qty)
            quantity_mt: pendingQty > 0 ? pendingQty : contractQty,
            quantity: pendingQty > 0 ? pendingQty : contractQty,
            unit_price: parseFloat(line.unit_price) || parseFloat(line.rate_usd_per_mt) || 0,
            amount_usd: parseFloat(line.amount_usd) || 0,
            number_of_packages: parseInt(line.number_of_packages) || 0,
            // CRITICAL: Fields required for price calculation auto-calc to work
            pricing_method: line.pricing_method || 'per_mt',  // Default to per MT pricing
            package_size: parseFloat(line.package_size) || parseFloat(line.unit_size) || 25,
            package_size_unit: line.package_size_unit || 'KG',
            kind_of_packages: line.kind_of_packages || 'BAGS',
            rate_usd_per_mt: parseFloat(line.rate_usd_per_mt) || parseFloat(line.unit_price) || 0,
            uom: line.uom || line.extra_json?.uom || 'MT',
            // Store fulfillment info in extra_json for display in Step 2
            extra_json: {
              ...(line.extra_json || {}),
              contract_quantity_mt: contractQty,
              shipped_quantity_mt: shippedQty,
              pending_quantity_mt: pendingQty,
            },
          };
        });
        console.log('  ✅ Imported', baseData.lines.length, 'product lines with fulfillment tracking');
      }
      
    } else if (initialContractId) {
      // Fallback: just set the contract ID
      baseData.contract_id = initialContractId;
      if (initialContractNo) {
        baseData.sn = `${initialContractNo}-SHIP-${Date.now().toString().slice(-6)}`;
      }
    }
    
    return baseData;
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ShipmentFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewValidationErrors, setReviewValidationErrors] = useState<string[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ type: 'next' | 'submit' } | null>(null);

  // Smart validation hook
  const validation = useShipmentValidation(formData);

  const totalSteps = 6;
  const stepTitles = [
    t('shipments.wizard.step1Title', 'Basic Info'),
    t('shipments.wizard.step2ProductLinesTitle', 'Product Lines'),
    t('shipments.wizard.step3CommercialTitle', 'Commercial'),
    t('shipments.wizard.step4LogisticsTitle', 'Logistics'),
    t('shipments.wizard.step5DocumentsTitle', 'Documents'),
    t('shipments.wizard.step6ReviewTitle', 'Review'),
  ];

  const handleChange = (field: keyof ShipmentFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user makes changes
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof ShipmentFormData, string>> = {};

    if (step === 1) {
      // Only require SN if there's a sales contract
      if (formData.has_sales_contract && !formData.sn.trim()) {
        newErrors.sn = t('validation.required', 'This field is required');
      }
      // Validate that has_sales_contract is selected
      if (formData.has_sales_contract === undefined) {
        newErrors.has_sales_contract = t('validation.required', 'Please select an option');
      }
      
      // Validate final destination based on type
      if (formData.final_destination?.type === 'customer') {
        // External customer: require company name and delivery place
        if (!formData.final_destination?.name?.trim()) {
          newErrors.final_destination = t('validation.customerNameRequired', 'Customer name is required');
        } else if (!formData.final_destination?.delivery_place?.trim()) {
          newErrors.final_destination = t('validation.deliveryPlaceRequired', 'Delivery place is required');
        }
      } else if (formData.final_destination?.type === 'branch') {
        // Branch type: require branch selection
        if (!formData.final_destination?.branch_id) {
          newErrors.final_destination = t('validation.required', 'Please select a branch');
        }
      }
      // Note: consignment type has no special validation - name and delivery_place are optional
    }

    // Step 3 validation: Truck count required when cargo_type is 'trucks'
    if (step === 3) {
      if (formData.cargo_type === 'trucks') {
        const truckCount = Number(formData.truck_count);
        if (!formData.truck_count || truckCount < 1 || !Number.isInteger(truckCount)) {
          newErrors.truck_count = t('validation.truckCountRequired', 'يرجى إدخال عدد الشاحنات (عدد صحيح ≥ 1)');
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    // First check required field validation
    if (!validateStep(currentStep)) {
      return;
    }
    
    // Then check smart validation for blocking errors
    if (validation.hasErrors) {
      // Cannot proceed with hard errors
      return;
    }
    
    // Check for unacknowledged warnings on relevant steps
    const stepsWithWarnings = [3, 4, 6]; // Commercial, Logistics, Review
    if (stepsWithWarnings.includes(currentStep) && validation.hasUnacknowledgedWarnings) {
      // Show warning modal to allow proceeding with acknowledgment
      setPendingNavigation({ type: 'next' });
      setShowWarningModal(true);
      return;
    }
    
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };
  
  // Handler for proceeding after acknowledging warnings
  const handleProceedWithWarnings = () => {
    validation.acknowledgeAllWarnings();
    setShowWarningModal(false);
    
    if (pendingNavigation?.type === 'next') {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    } else if (pendingNavigation?.type === 'submit') {
      // Trigger submit after acknowledging
      executeSubmit();
    }
    setPendingNavigation(null);
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setSubmitError(null);
  };

  const handleStepClick = (step: number) => {
    // Allow navigation to current step and completed steps
    if (step <= currentStep) {
      setCurrentStep(step);
      setSubmitError(null);
      setReviewValidationErrors([]);
    }
  };

  // Navigate directly to a specific step (used by Review step edit links)
  const handleNavigateToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
      setSubmitError(null);
      setReviewValidationErrors([]);
    }
  };

  // Validate commercial & ownership fields required for submission
  const validateReviewFields = (): string[] => {
    const validationErrors: string[] = [];

    // 1. Supplier (for incoming) or Customer (for outgoing) - required
    if (formData.transaction_type === 'incoming') {
      if (!formData.supplier_name && !formData.supplier_id && !formData.supplier_company_id) {
        validationErrors.push(t('shipments.wizard.review.missingSupplier', 'المورد: غير محدد - يرجى تحديد المورد'));
      }
    } else {
      if (!formData.customer_name && !formData.customer_id && !formData.customer_company_id) {
        validationErrors.push(t('shipments.wizard.review.missingCustomer', 'المشتري: غير محدد - يرجى تحديد المشتري'));
      }
    }

    // 2. Final Destination type - required
    if (!formData.final_destination?.type) {
      validationErrors.push(t('shipments.wizard.review.missingFinalDestinationType', 'الوجهة النهائية: لم يتم تحديد نوع الوجهة'));
    } else {
      // 3. Final Owner / Name - required based on type
      if (formData.final_destination.type === 'branch') {
        if (!formData.final_destination.branch_id) {
          validationErrors.push(t('shipments.wizard.review.missingBranch', 'المالك النهائي: لم يتم تحديد الفرع'));
        }
      } else if (formData.final_destination.type === 'customer') {
        if (!formData.final_destination.name?.trim()) {
          validationErrors.push(t('shipments.wizard.review.missingCustomerName', 'المالك النهائي: لم يتم تحديد اسم العميل'));
        }
        if (!formData.final_destination.delivery_place?.trim()) {
          validationErrors.push(t('shipments.wizard.review.missingDeliveryPlace', 'الوجهة النهائية: لم يتم تحديد مكان التسليم'));
        }
      }
      // Consignment type doesn't require name (it's optional)
    }

    return validationErrors;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }
    
    // Check smart validation errors - block submission
    if (validation.hasErrors) {
      return;
    }
    
    // Check for unacknowledged warnings - require confirmation
    if (validation.hasUnacknowledgedWarnings) {
      setPendingNavigation({ type: 'submit' });
      setShowWarningModal(true);
      return;
    }
    
    await executeSubmit();
  };
  
  const executeSubmit = async () => {

    // Validate commercial & ownership fields before submission
    const reviewErrors = validateReviewFields();
    if (reviewErrors.length > 0) {
      setReviewValidationErrors(reviewErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setReviewValidationErrors([]);

    try {
      // Prepare data for API (exclude documents as they need separate file upload)
      // Generate product_text from lines for backward compatibility
      const productText = formData.lines && formData.lines.length > 0
        ? formData.lines.map((line: any) => line.type_of_goods || line.product_name || '').filter(Boolean).join(', ')
        : formData.product_text || 'Various Products';
      
      const shipmentData = {
        // ========== Basic Info ==========
        transaction_type: formData.transaction_type,
        sn: formData.sn,
        subject: formData.subject || null,
        contract_id: formData.contract_id || null, // Link to contract if created from contract
        product_text: productText,
        supplier_id: formData.transaction_type === 'incoming' ? (formData.supplier_id || null) : null,
        customer_id: formData.transaction_type === 'outgoing' ? (formData.customer_id || null) : null,
        // Buyer/Importer
        buyer_id: formData.buyer_id || null,
        buyer_name: formData.buyer_name || null,
        
        // ========== Cargo Details ==========
        cargo_type: formData.cargo_type || null,
        tanker_type: formData.tanker_type || null,
        container_count: formData.container_count || null,
        truck_count: formData.truck_count || null, // Number of trucks when cargo_type = 'trucks'
        weight_ton: formData.weight_ton || null,
        weight_unit: formData.weight_unit || 'tons',
        barrels: formData.barrels || null,
        country_of_export: formData.country_of_export || null,
        
        // ========== Pricing ==========
        fixed_price_usd_per_ton: formData.fixed_price_usd_per_ton || null,
        selling_price_usd_per_ton: formData.selling_price_usd_per_ton || null,
        fixed_price_usd_per_barrel: formData.fixed_price_usd_per_barrel || null,
        selling_price_usd_per_barrel: formData.selling_price_usd_per_barrel || null,
        
        // ========== Logistics ==========
        // Send port/shipping line IDs - can be UUID, "new:Name", or name string
        // Backend will resolve existing or create new entries via resolveOrCreatePort/resolveOrCreateShippingLine
        pol_id: formData.pol_id || null,
        pod_id: formData.pod_id || null,
        shipping_line_id: formData.shipping_line_id || null,
        etd: formData.etd || null,
        eta: formData.eta || null,
        free_time_days: formData.free_time_days || null,
        customs_clearance_date: formData.customs_clearance_date || null,
        booking_no: formData.booking_no || null,
        bl_no: formData.bl_no || null,
        vessel_name: formData.vessel_name || null,
        vessel_imo: formData.vessel_imo || null,
        
        // ========== Commercial Terms ==========
        notes: formData.notes || null,
        payment_terms: formData.payment_terms || null,
        incoterms: formData.incoterms || null,
        currency_code: formData.currency_code || 'USD',
        payment_method: formData.payment_method || null,
        
        // ========== Banking/Beneficiary ==========
        beneficiary_name: formData.beneficiary_name || null,
        beneficiary_bank_name: formData.beneficiary_bank_name || null,
        beneficiary_bank_address: formData.beneficiary_bank_address || null,
        beneficiary_account_number: formData.beneficiary_account_number || null,
        beneficiary_iban: formData.beneficiary_iban || null,
        swift_code: formData.swift_code || null,
        intermediary_bank: formData.intermediary_bank || null,
        lc_number: formData.lc_number || null,
        lc_issuing_bank: formData.lc_issuing_bank || null,
        lc_type: formData.lc_type || null,
        lc_expiry_date: formData.lc_expiry_date || null,
        payment_term_days: formData.payment_term_days || null,
        transfer_reference: formData.transfer_reference || null,
        
        // ========== Transportation Cost ==========
        transportation_cost: formData.transportation_cost || null,
        transport_cost_responsibility: formData.transport_cost_responsibility || null,
        
        // ========== Down Payment ==========
        down_payment_type: formData.down_payment_type || null,
        down_payment_percentage: formData.down_payment_percentage || null,
        down_payment_amount: formData.down_payment_amount || null,
        
        // ========== Final Destination / Owner ==========
        has_final_destination: formData.has_final_destination || false,
        final_destination: formData.has_final_destination ? formData.final_destination : null,
        
        // ========== Product Lines & Containers ==========
        // CRITICAL: Include product lines
        lines: formData.lines || [],
        // Container details
        containers: formData.containers || [],
        
        // ========== Broker Info ==========
        has_broker: formData.has_broker || false,
        broker_name: formData.broker_name || null,
        
        // ========== Internal Route (POD → Final Destination) ==========
        is_cross_border: formData.is_cross_border || false,
        primary_border_crossing_id: formData.primary_border_crossing_id || null,
        internal_transport_mode: formData.internal_transport_mode || 'truck',
        
        // Note: Documents will be uploaded separately after shipment creation
        document_count: formData.documents.length, // Just send the count for now
      };

      const createdShipment = await createShipment(shipmentData);
      
      // Upload documents based on upload mode
      if (createdShipment.id) {
        const uploadMode = formData.documentUploadMode || 'separate';
        
        if (uploadMode === 'combined' && formData.combinedDocumentBundle?.file) {
          // Upload combined document bundle
          console.log(`📚 Uploading combined document bundle for shipment ${createdShipment.id}`);
          try {
            await uploadDocument({
              file: formData.combinedDocumentBundle.file,
              entity_type: 'shipment',
              entity_id: createdShipment.id,
              doc_type: 'combined_documents' as DocumentType,
              is_draft: false,
              notes: formData.combinedDocumentBundle.containedDocTypes.length > 0
                ? `Contains: ${formData.combinedDocumentBundle.containedDocTypes.join(', ')}`
                : undefined,
            });
            console.log('✅ Combined document bundle uploaded successfully');
          } catch (err) {
            console.warn('⚠️ Failed to upload combined document bundle:', err);
          }
        }
        
        // Also upload any individual documents (in case user uploaded both)
        if (formData.documents.length > 0) {
          console.log(`📄 Uploading ${formData.documents.length} individual documents for shipment ${createdShipment.id}`);
          
          const uploadResults = await Promise.allSettled(
            formData.documents.map(async (doc) => {
              if (doc.file) {
                return uploadDocument({
                  file: doc.file,
                  entity_type: 'shipment',
                  entity_id: createdShipment.id,
                  doc_type: doc.type as DocumentType,
                  is_draft: false,
                  notes: doc.notes || undefined,
                });
              }
              return null;
            })
          );
          
          // Log any upload errors but don't fail the shipment creation
          const uploadErrors = uploadResults.filter(r => r.status === 'rejected');
          if (uploadErrors.length > 0) {
            console.warn(`⚠️ ${uploadErrors.length} document(s) failed to upload:`, uploadErrors);
          }
          
          const successCount = uploadResults.filter(r => r.status === 'fulfilled' && r.value).length;
          console.log(`✅ Successfully uploaded ${successCount} of ${formData.documents.length} documents`);
        }
      }

      // Success! Reset form and close
      setFormData(initialFormData);
      setCurrentStep(1);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to create shipment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setSubmitError(
        `${t('shipments.wizard.createError', 'Failed to create shipment')}: ${errorMessage}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData(initialFormData);
      setCurrentStep(1);
      setErrors({});
      setSubmitError(null);
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-xl font-semibold text-gray-900">
                      {t('shipments.newShipment', 'New Shipment')}
                    </Dialog.Title>
                    <button
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Progress Stepper */}
                  <div className="mt-6">
                    <ProgressStepper
                      currentStep={currentStep}
                      totalSteps={totalSteps}
                      stepTitles={stepTitles}
                      onStepClick={handleStepClick}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
                  {submitError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{submitError}</p>
                    </div>
                  )}

                  {currentStep === 1 && (
                    <Step1BasicInfo 
                      formData={formData} 
                      onChange={handleChange} 
                      errors={errors} 
                      contractLines={contractLines}
                    />
                  )}
                  {currentStep === 2 && (
                    <Step2ProductLines formData={formData} onChange={handleChange} />
                  )}
                  {currentStep === 3 && (
                    <Step3DeliveryTerms 
                      formData={formData} 
                      onChange={handleChange} 
                      errors={errors}
                      acknowledgedWarnings={validation.acknowledgedWarnings}
                      onAcknowledgeWarning={validation.acknowledgeWarning}
                      onAcknowledgeAll={validation.acknowledgeAllWarnings}
                    />
                  )}
                  {currentStep === 4 && (
                    <Step4Logistics 
                      formData={formData} 
                      onChange={handleChange} 
                      errors={errors}
                      acknowledgedWarnings={validation.acknowledgedWarnings}
                      onAcknowledgeWarning={validation.acknowledgeWarning}
                      onAcknowledgeAll={validation.acknowledgeAllWarnings}
                    />
                  )}
                  {currentStep === 5 && (
                    <Step5Documents formData={formData} onChange={handleChange} errors={errors} />
                  )}
                  {currentStep === 6 && (
                    <Step6Review 
                      formData={formData} 
                      onChange={handleChange} 
                      errors={errors}
                      onNavigateToStep={handleNavigateToStep}
                      validationErrors={reviewValidationErrors}
                      smartValidationErrors={validation.errors}
                      smartValidationWarnings={validation.warnings}
                      acknowledgedWarnings={validation.acknowledgedWarnings}
                      onAcknowledgeWarning={validation.acknowledgeWarning}
                      onAcknowledgeAll={validation.acknowledgeAllWarnings}
                    />
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                  <div className="flex justify-between">
                    <div>
                      {currentStep > 1 && (
                        <Button
                          variant="secondary"
                          onClick={handlePrevious}
                          disabled={isSubmitting}
                        >
                          {t('common.previous', 'Previous')}
                        </Button>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={isSubmitting}
                      >
                        {t('common.cancel', 'Cancel')}
                      </Button>

                      {currentStep < totalSteps ? (
                        <Button
                          variant="primary"
                          onClick={handleNext}
                          disabled={isSubmitting}
                        >
                          {t('common.next', 'Next')}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="min-w-[120px]"
                        >
                          {isSubmitting ? (
                            <>
                              <Spinner size="sm" className="me-2" />
                              {t('common.saving', 'Saving...')}
                            </>
                          ) : (
                            t('shipments.wizard.createShipment', 'Create Shipment')
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

      {/* Warning Acknowledgment Modal */}
      <Transition appear show={showWarningModal} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setShowWarningModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-40" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-xl transition-all">
                  <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-full">
                        <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                      </div>
                      <Dialog.Title className="text-lg font-semibold text-amber-900">
                        {t('validation.warningsTitle', 'Review Warnings')}
                      </Dialog.Title>
                    </div>
                  </div>

                  <div className="px-6 py-4">
                    <p className="text-sm text-gray-700 mb-4">
                      {t('validation.warningsDescription', 'The following items may need your attention. You can proceed, but please review:')}
                    </p>
                    
                    <ul className="space-y-2 mb-4">
                      {validation.warnings
                        .filter(w => !validation.acknowledgedWarnings.has(w.id))
                        .map((warning) => (
                          <li key={warning.id} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-md">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{warning.message}</span>
                          </li>
                        ))
                      }
                    </ul>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowWarningModal(false);
                        setPendingNavigation(null);
                      }}
                    >
                      {t('common.goBack', 'Go Back')}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleProceedWithWarnings}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {t('validation.proceedAnyway', 'I understand, proceed')}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </Transition>
  );
}

