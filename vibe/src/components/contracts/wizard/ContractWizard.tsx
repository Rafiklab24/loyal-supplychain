/**
 * Contract Wizard - Main Orchestrator
 * Complete redesign matching actual proforma invoice structure
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, CheckIcon, CubeIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../../../services/api';
import type { ContractFormData } from './types';
import { Step1CommercialParties } from './Step1CommercialParties';
import { Step2ShippingGeography } from './Step2ShippingGeography';
import { DeliveryPaymentTerms } from '../../common/DeliveryPaymentTerms';
import { Step4ProductLines } from './Step4ProductLines';
import { Step5BankingDocs } from './Step5BankingDocs';
import { useCreateContract } from '../../../hooks/useContracts';
import { DateInput } from '../../common/DateInput';

const TOTAL_STEPS = 5;

interface ContractWizardProps {
  mode?: 'create' | 'edit';
  existingContract?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialStep?: number;
}

// Keep V2 export for backward compatibility
export { ContractWizard as ContractWizardV2 };

export function ContractWizard({ mode = 'create', existingContract, onSuccess, onCancel, initialStep = 1 }: ContractWizardProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createContract = useCreateContract();

  const [currentStep, setCurrentStep] = useState(initialStep);
  
  // Helper function to normalize product lines for backward compatibility
  const normalizeProductLines = (lines: any[]) => {
    return lines.map((line) => ({
      ...line,
      // Ensure new pricing fields exist (backward compatibility)
      pricing_method: line.pricing_method || 'per_mt',
      unit_price: line.unit_price || line.rate_usd_per_mt || 0,
      // Ensure all required fields exist
      rate_usd_per_mt: line.rate_usd_per_mt || line.unit_price || 0,
      amount_usd: line.amount_usd || 0,
    }));
  };
  
  // Initialize form data with existing contract if in edit mode
  const [formData, setFormData] = useState<ContractFormData>(() => {
    if (mode === 'edit' && existingContract) {
      // NORMALIZED: API now returns nested objects at top level, not inside extra_json
      // Fall back to extra_json for backward compatibility with old data
      const extraData = existingContract.extra_json || {};
      
      // Helper: Convert date from YYYY-MM-DD to YYYY-MM (for month input)
      const toMonthFormat = (dateStr: string | undefined): string | undefined => {
        if (!dateStr) return undefined;
        // If already in YYYY-MM format, return as is
        if (/^\d{4}-\d{2}$/.test(dateStr)) return dateStr;
        // If in YYYY-MM-DD format, convert to YYYY-MM
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.substring(0, 7);
        return dateStr;
      };
      
      // Use top-level normalized data first, fall back to extra_json for old contracts
      const commercialParties = existingContract.commercial_parties || extraData.commercial_parties;
      const rawShippingData = existingContract.shipping || extraData.shipping;
      // Normalize shipping data - convert date formats
      const shippingData = rawShippingData ? {
        ...rawShippingData,
        estimated_shipment_date: toMonthFormat(rawShippingData.estimated_shipment_date),
      } : null;
      const termsData = existingContract.terms || extraData.terms;
      const bankingDocsData = existingContract.banking_docs || extraData.banking_docs;
      const linesData = existingContract.lines || extraData.lines || [];
      
      console.log('📥 Loading contract for edit:', {
        id: existingContract.id,
        hasTopLevelBankingDocs: !!existingContract.banking_docs,
        hasExtraJsonBankingDocs: !!extraData.banking_docs,
        final_destination_name: bankingDocsData?.final_destination_name,
        final_destination_address: bankingDocsData?.final_destination_address,
      });
      
      console.log('📥 Shipping data for edit:', {
        fromTopLevel: existingContract.shipping,
        fromExtraJson: extraData.shipping,
        using: shippingData,
        port_of_loading_id: shippingData?.port_of_loading_id,
        port_of_loading_name: shippingData?.port_of_loading_name,
        final_destination_id: shippingData?.final_destination_id,
        final_destination_name: shippingData?.final_destination_name,
      });
      
      return {
        contract_no: existingContract.contract_no || '',
        status: existingContract.status || 'DRAFT',
        direction: existingContract.direction || extraData.direction || 'incoming',
        // Fix corrupted subject (might be an object instead of string)
        subject: typeof existingContract.subject === 'string' 
          ? existingContract.subject 
          : (existingContract.subject && typeof existingContract.subject === 'object' && '' in existingContract.subject)
            ? existingContract.subject['']
            : undefined,
        commercial_parties: commercialParties || {
          proforma_number: existingContract.contract_no,
          invoice_date: undefined,
          other_reference: undefined,
          exporter_company_id: existingContract.seller_company_id || '',
          exporter_name: existingContract.seller_name,
          buyer_company_id: existingContract.buyer_company_id || '',
          buyer_name: existingContract.buyer_name,
          consignee_same_as_buyer: true,
          consignee_company_id: undefined,
          consignee_name: undefined,
          has_broker: undefined,
          broker_buying_name: undefined,
          broker_selling_name: undefined,
        },
        shipping: shippingData || {
          country_of_export: '',
          country_of_final_destination: '',
          port_of_loading_id: undefined,
          port_of_loading_name: undefined,
          final_destination_id: undefined,
          final_destination_name: undefined,
          pre_carriage_by: undefined,
          place_of_receipt: undefined,
          vessel_flight_no: undefined,
          estimated_shipment_date: undefined,
        },
        terms: termsData || {
          cargo_type: undefined,
          tanker_type: undefined,
          barrels: '',
          weight_ton: '',
          weight_unit: 'tons',
          weight_unit_custom: '',
          container_count: '',
          incoterm: '',
          delivery_terms_detail: '',
          payment_terms: '',
          payment_method: undefined,
          currency_code: existingContract.currency_code || 'USD',
          special_clauses: [],
        },
        lines: normalizeProductLines(linesData),
        banking_docs: bankingDocsData || {
          beneficiary_name: '',
          beneficiary_address: '',
          beneficiary_account_no: '',
          beneficiary_bank_name: '',
          beneficiary_bank_address: '',
          beneficiary_swift_code: undefined,
          correspondent_bank: undefined,
          has_final_destination: false,
          final_destination_type: undefined,
          final_destination_company_id: undefined,
          final_destination_name: undefined,
          final_destination_delivery_place: undefined,
          final_destination_address: undefined,
          final_destination_contact: undefined,
          final_destination_selling_price: undefined,
          final_destination_notes: undefined,
          documentation: [],
          documentation_notes: undefined,
        },
        notes: existingContract.notes || extraData.extra_info,
      };
    }
    
    // Default form data for create mode
    // Calculate default shipment month (1 month from now)
    const defaultShipmentDate = new Date();
    defaultShipmentDate.setMonth(defaultShipmentDate.getMonth() + 1);
    const formattedDefaultDate = `${defaultShipmentDate.getFullYear()}-${String(defaultShipmentDate.getMonth() + 1).padStart(2, '0')}`;
    
    return {
    contract_no: '',
    status: 'DRAFT',
    direction: 'incoming',
    commercial_parties: {
      proforma_number: '',
      invoice_date: undefined,
      other_reference: undefined,
      exporter_company_id: '',
      exporter_name: undefined,
      buyer_company_id: '',
      buyer_name: undefined,
      consignee_same_as_buyer: true,
      consignee_company_id: undefined,
      consignee_name: undefined,
      has_broker: undefined,
      broker_buying_name: undefined,
      broker_selling_name: undefined,
    },
    shipping: {
      country_of_export: '',
      country_of_final_destination: '',
      port_of_loading_id: undefined,
      port_of_loading_name: undefined,
      final_destination_id: undefined,
      final_destination_name: undefined,
      pre_carriage_by: undefined,
      place_of_receipt: undefined,
      vessel_flight_no: undefined,
      estimated_shipment_date: formattedDefaultDate, // Default to 1 month from now (YYYY-MM format)
    },
    terms: {
      cargo_type: undefined,
      tanker_type: undefined,
      barrels: '',
      weight_ton: '',
      weight_unit: 'tons',
      weight_unit_custom: '',
      container_count: '',
      incoterm: '',
      delivery_terms_detail: '',
      payment_terms: '',
      payment_method: undefined,
      currency_code: 'USD',
      special_clauses: [],
    },
    lines: [],
    banking_docs: {
      beneficiary_name: '',
      beneficiary_address: '',
      beneficiary_account_no: '',
      beneficiary_bank_name: '',
      beneficiary_bank_address: '',
      beneficiary_swift_code: undefined,
      correspondent_bank: undefined,
      has_final_destination: false,
      final_destination_type: undefined,
      final_destination_company_id: undefined,
      final_destination_name: undefined,
      final_destination_delivery_place: undefined,
      final_destination_address: undefined,
      final_destination_contact: undefined,
      final_destination_selling_price: undefined,
      final_destination_notes: undefined,
      documentation: [],
      documentation_notes: undefined,
    },
    notes: undefined,
  };
});

  const [extraInfo, setExtraInfo] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // AI Extraction state (lifted from Step1 to be accessible from all steps)
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctedData, setCorrectedData] = useState<any>(null);
  const [isSavingCorrections, setIsSavingCorrections] = useState(false);

  // Update nested fields
  const handleChange = (section: keyof ContractFormData, field: string, value: any) => {
    setFormData((prev) => {
      // Handle top-level fields (direction, subject, contract_no, status, notes)
      const topLevelFields = ['direction', 'subject', 'contract_no', 'status', 'notes'];
      if (topLevelFields.includes(section)) {
        return {
          ...prev,
          [section]: value,
        };
      }
      
      // Handle nested sections (commercial_parties, shipping, terms, etc.)
      return {
        ...prev,
        [section]: {
          ...(prev[section] as any),
          [field]: value,
        },
      };
    });
  };

  // Update array fields
  const handleArrayChange = (
    section: keyof ContractFormData,
    field: string,
    index: number,
    subField: string,
    value: any
  ) => {
    setFormData((prev) => {
      // Special case: if section is 'lines' and it's a direct array (not nested)
      if (section === 'lines' && field === 'lines') {
        const array = [...(prev.lines || [])];
        array[index] = { ...array[index], [subField]: value };
        return {
          ...prev,
          lines: array,
        };
      }
      
      // Normal case: nested array like terms.special_clauses
      const sectionData = prev[section] as any;
      const array = [...(sectionData[field] || [])];
      array[index] = { ...array[index], [subField]: value };
      return {
        ...prev,
        [section]: {
          ...sectionData,
          [field]: array,
        },
      };
    });
  };

  // Add item to array
  const handleArrayAdd = (section: keyof ContractFormData, field: string, item: any) => {
    setFormData((prev) => {
      // Special case: if section is 'lines' and it's a direct array
      if (section === 'lines' && field === 'lines') {
        const array = [...(prev.lines || [])];
        array.push(item);
        return {
          ...prev,
          lines: array,
        };
      }
      
      // Normal case: nested array
      const sectionData = prev[section] as any;
      const array = [...(sectionData[field] || [])];
      array.push(item);
      return {
        ...prev,
        [section]: {
          ...sectionData,
          [field]: array,
        },
      };
    });
  };

  // Remove item from array
  const handleArrayRemove = (section: keyof ContractFormData, field: string, index: number) => {
    setFormData((prev) => {
      // Special case: if section is 'lines' and it's a direct array
      if (section === 'lines' && field === 'lines') {
        const array = [...(prev.lines || [])];
        array.splice(index, 1);
        return {
          ...prev,
          lines: array,
        };
      }
      
      // Normal case: nested array
      const sectionData = prev[section] as any;
      const array = [...(sectionData[field] || [])];
      array.splice(index, 1);
      return {
        ...prev,
        [section]: {
          ...sectionData,
          [field]: array,
        },
      };
    });
  };

  // Auto-fill form with extracted data (moved from Step1)
  const autoFillFormFromExtraction = async (extractedData: any) => {
    console.log('🤖 Auto-filling form with extracted data');

    // Step 1: Commercial Parties
    if (extractedData.proforma_invoice?.number) {
      handleChange('commercial_parties', 'proforma_number', extractedData.proforma_invoice.number);
    }
    if (extractedData.proforma_invoice?.date) {
      handleChange('commercial_parties', 'invoice_date', extractedData.proforma_invoice.date);
    }
    
    // Auto-match company names to IDs using fuzzy matching (better for OCR-extracted names)
    if (extractedData.commercial_parties?.exporter?.name || extractedData.commercial_parties?.buyer?.name) {
      // Match exporter using fuzzy matching
      if (extractedData.commercial_parties?.exporter?.name) {
        const exporterName = extractedData.commercial_parties.exporter.name;
        handleChange('commercial_parties', 'exporter_name', exporterName);
        
        try {
          const fuzzyResponse = await apiClient.get(
            `/companies/fuzzy-match?name=${encodeURIComponent(exporterName)}&type=supplier&threshold=0.6`
          );
          
          if (fuzzyResponse.data.hasGoodMatch && fuzzyResponse.data.bestMatch) {
            const match = fuzzyResponse.data.bestMatch;
            console.log(`✅ Exporter fuzzy-matched: "${exporterName}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
            handleChange('commercial_parties', 'exporter_company_id', match.id);
            handleChange('commercial_parties', 'exporter_name', match.name); // Update to canonical name
          } else if (fuzzyResponse.data.matches?.length > 0) {
            const match = fuzzyResponse.data.matches[0];
            console.log(`✅ Exporter matched (lower confidence): "${exporterName}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
            handleChange('commercial_parties', 'exporter_company_id', match.id);
            handleChange('commercial_parties', 'exporter_name', match.name);
          } else {
            // No match found - try to create/match via POST
            console.log('🆕 Creating/matching exporter:', exporterName);
            try {
              const createResponse = await apiClient.post('/companies', {
                name: exporterName,
                is_supplier: true,
              });
              if (createResponse.data.data?.id) {
                handleChange('commercial_parties', 'exporter_company_id', createResponse.data.data.id);
                handleChange('commercial_parties', 'exporter_name', createResponse.data.data.name);
                if (createResponse.data.matched) {
                  console.log(`✅ Exporter matched via POST: "${createResponse.data.data.name}"`);
                } else {
                  console.log(`✅ Exporter created: "${createResponse.data.data.name}"`);
                }
              }
            } catch (createErr) {
              console.warn('⚠️ Failed to create/match exporter:', createErr);
            }
          }
        } catch (err) {
          console.warn('⚠️ Fuzzy match failed for exporter:', err);
        }
      }
      
      // Match buyer using fuzzy matching
      if (extractedData.commercial_parties?.buyer?.name) {
        const buyerName = extractedData.commercial_parties.buyer.name;
        handleChange('commercial_parties', 'buyer_name', buyerName);
        
        try {
          const fuzzyResponse = await apiClient.get(
            `/companies/fuzzy-match?name=${encodeURIComponent(buyerName)}&type=customer&threshold=0.6`
          );
          
          if (fuzzyResponse.data.hasGoodMatch && fuzzyResponse.data.bestMatch) {
            const match = fuzzyResponse.data.bestMatch;
            console.log(`✅ Buyer fuzzy-matched: "${buyerName}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
            handleChange('commercial_parties', 'buyer_company_id', match.id);
            handleChange('commercial_parties', 'buyer_name', match.name); // Update to canonical name
          } else if (fuzzyResponse.data.matches?.length > 0) {
            const match = fuzzyResponse.data.matches[0];
            console.log(`✅ Buyer matched (lower confidence): "${buyerName}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
            handleChange('commercial_parties', 'buyer_company_id', match.id);
            handleChange('commercial_parties', 'buyer_name', match.name);
          } else {
            // No match found - try to create/match via POST
            console.log('🆕 Creating/matching buyer:', buyerName);
            try {
              const createResponse = await apiClient.post('/companies', {
                name: buyerName,
                is_customer: true,
              });
              if (createResponse.data.data?.id) {
                handleChange('commercial_parties', 'buyer_company_id', createResponse.data.data.id);
                handleChange('commercial_parties', 'buyer_name', createResponse.data.data.name);
                if (createResponse.data.matched) {
                  console.log(`✅ Buyer matched via POST: "${createResponse.data.data.name}"`);
                } else {
                  console.log(`✅ Buyer created: "${createResponse.data.data.name}"`);
                }
              }
            } catch (createErr) {
              console.warn('⚠️ Failed to create/match buyer:', createErr);
            }
          }
        } catch (err) {
          console.warn('⚠️ Fuzzy match failed for buyer:', err);
        }
      }
    }

    // Step 2: Shipping
    // NOTE: OCR extracts country_of_origin which we now use as country_of_export (POL country)
    // The actual product origin is set per product line in Step 4
    if (extractedData.shipping_geography?.country_of_origin) {
      handleChange('shipping', 'country_of_export', extractedData.shipping_geography.country_of_origin);
    }
    if (extractedData.shipping_geography?.country_of_destination) {
      handleChange('shipping', 'country_of_final_destination', extractedData.shipping_geography.country_of_destination);
    }
    if (extractedData.shipping_geography?.port_of_loading) {
      handleChange('shipping', 'port_of_loading_name', extractedData.shipping_geography.port_of_loading);
    }
    if (extractedData.shipping_geography?.port_of_discharge || extractedData.shipping_geography?.final_destination) {
      const finalDest = extractedData.shipping_geography.final_destination || extractedData.shipping_geography.port_of_discharge;
      handleChange('shipping', 'final_destination_name', finalDest);
    }

    // Step 3: Terms
    if (extractedData.contract_terms?.incoterm) {
      handleChange('terms', 'incoterm', extractedData.contract_terms.incoterm);
    }
    if (extractedData.contract_terms?.delivery_terms_detail) {
      handleChange('terms', 'delivery_terms_detail', extractedData.contract_terms.delivery_terms_detail);
    }
    if (extractedData.contract_terms?.payment_terms) {
      handleChange('terms', 'payment_terms', extractedData.contract_terms.payment_terms);
    }
    if (extractedData.contract_terms?.currency) {
      handleChange('terms', 'currency_code', extractedData.contract_terms.currency);
    }
    if (extractedData.special_clauses && extractedData.special_clauses.length > 0) {
      handleChange('terms', 'special_clauses', extractedData.special_clauses);
    }

    // Step 4: Product Lines
    if (extractedData.product_lines && extractedData.product_lines.length > 0) {
      const mappedLines = extractedData.product_lines.map((line: any) => {
        const packages = line.number_of_packages || 0;
        const sizeKg = line.unit_size || 25;
        const quantityMT = (packages * sizeKg) / 1000;
        const rate = line.rate_per_mt || 0;
        const amount = line.amount || (quantityMT * rate);

        // Determine pricing method from extraction (default: per_mt)
        // Future: AI can detect this from invoice context
        const pricingMethod = line.pricing_method || 'per_mt';
        const unitPrice = line.unit_price || rate;

        return {
          type_of_goods: line.type_of_goods || '',
          brand: line.brand || '',
          trademark: line.trademark || '',
          kind_of_packages: line.kind_of_packages || 'BAGS',
          number_of_packages: packages,
          unit_size: sizeKg,
          quantity_mt: quantityMT,
          pricing_method: pricingMethod,
          unit_price: unitPrice,
          rate_usd_per_mt: rate,
          amount_usd: amount,
          notes: line.notes || '',
        };
      });
      setFormData((prev) => ({ ...prev, lines: mappedLines }));
    }

    // Step 5: Banking
    if (extractedData.banking_details?.beneficiary_name) {
      handleChange('banking_docs', 'beneficiary_name', extractedData.banking_details.beneficiary_name);
    }
    if (extractedData.banking_details?.bank_name) {
      handleChange('banking_docs', 'beneficiary_bank_name', extractedData.banking_details.bank_name);
    }
    if (extractedData.banking_details?.account_number) {
      handleChange('banking_docs', 'beneficiary_account_no', extractedData.banking_details.account_number);
    }
    if (extractedData.banking_details?.swift_code) {
      handleChange('banking_docs', 'beneficiary_swift_code', extractedData.banking_details.swift_code);
    }
    if (extractedData.banking_details?.bank_address) {
      handleChange('banking_docs', 'beneficiary_bank_address', extractedData.banking_details.bank_address);
    }
    if (extractedData.commercial_parties?.exporter?.address) {
      handleChange('banking_docs', 'beneficiary_address', extractedData.commercial_parties.exporter.address);
    }

    console.log('✅ Auto-fill complete!');
  };

  const openCorrectionModal = () => {
    if (!extractionResult?.data) {
      console.error('❌ No extraction data available');
      return;
    }
    
    console.log('🔧 Opening correction modal with data:', extractionResult.data);
    
    // Deep clone the extraction data for editing
    const clonedData = JSON.parse(JSON.stringify(extractionResult.data));
    
    // Ensure product_lines exists
    if (!clonedData.product_lines) {
      clonedData.product_lines = [];
    }
    
    console.log('✅ Corrected data initialized with', clonedData.product_lines?.length || 0, 'product lines');
    
    setCorrectedData(clonedData);
    setShowCorrectionModal(true);
  };

  // Save corrections
  const handleSaveCorrections = async () => {
    if (!correctedData || !extractionResult?.trainingDataId) return;

    setIsSavingCorrections(true);
    try {
      await apiClient.post('/contracts/save-corrections', {
        trainingDataId: extractionResult.trainingDataId,
        corrections: correctedData,
        finalData: correctedData,
      });

      console.log('✅ Corrections saved successfully');

      // Update the form with corrected data
      await autoFillFormFromExtraction(correctedData);
      
      // Update extraction result to show corrected data
      setExtractionResult({
        ...extractionResult,
        data: correctedData,
        corrected: true,
      });

      setShowCorrectionModal(false);
    } catch (error: any) {
      console.error('❌ Failed to save corrections:', error);
      alert('Failed to save corrections. Please try again.');
    } finally {
      setIsSavingCorrections(false);
    }
  };

  // Validate current step
  const validateStep = (step: number): boolean => {
    const errors: string[] = [];

    switch (step) {
      case 1:
        if (!formData.commercial_parties.proforma_number) {
          errors.push(t('contracts.errors.proformaNumberRequired', 'Proforma Invoice Number is required'));
        }
        // Allow either company_id OR company_name (AI extraction provides names, manual selection provides IDs)
        if (!formData.commercial_parties.exporter_company_id && !formData.commercial_parties.exporter_name) {
          errors.push(t('contracts.errors.exporterRequired', 'Exporter is required'));
        }
        if (!formData.commercial_parties.buyer_company_id && !formData.commercial_parties.buyer_name) {
          errors.push(t('contracts.errors.buyerRequired', 'Buyer is required'));
        }
        break;

      case 2:
        if (formData.lines.length === 0) {
          errors.push(t('contracts.errors.atLeastOneLineRequired', 'At least one product line is required'));
        }
        formData.lines.forEach((line, index) => {
          if (!line.type_of_goods) {
            errors.push(t('contracts.errors.typeOfGoodsRequired', `Line ${index + 1}: Type of Goods is required`));
          }
          if (line.quantity_mt <= 0) {
            errors.push(t('contracts.errors.quantityMustBePositive', `Line ${index + 1}: Quantity must be positive`));
          }
          if (!line.rate_usd_per_mt || line.rate_usd_per_mt <= 0) {
            errors.push(t('contracts.errors.rateMustBePositive', `Line ${index + 1}: Rate must be positive`));
          }
        });
        break;

      case 3:
        if (!formData.shipping.country_of_export) {
          errors.push(t('contracts.errors.countryOfExportRequired', 'Country of Export is required'));
        }
        if (!formData.shipping.country_of_final_destination) {
          errors.push(t('contracts.errors.countryOfDestinationRequired', 'Country of Destination is required'));
        }
        break;

      case 4:
        if (!formData.terms.incoterm) {
          errors.push(t('contracts.errors.incotermRequired', 'Incoterm is required'));
        }
        if (!formData.terms.delivery_terms_detail) {
          errors.push(t('contracts.errors.deliveryTermsRequired', 'Delivery Terms Detail is required'));
        }
        if (!formData.terms.payment_terms) {
          errors.push(t('contracts.errors.paymentTermsRequired', 'Payment Terms is required'));
        }
        break;

      case 5:
        console.log('🔍 Validating Step 5 - Banking Docs:', formData.banking_docs);
        if (!formData.banking_docs.beneficiary_name) {
          console.log('❌ Missing beneficiary_name');
          errors.push(t('contracts.errors.beneficiaryNameRequired', 'Beneficiary Name is required'));
        }
        if (!formData.banking_docs.beneficiary_address) {
          console.log('❌ Missing beneficiary_address');
          errors.push(t('contracts.errors.beneficiaryAddressRequired', 'Beneficiary Address is required'));
        }
        if (!formData.banking_docs.beneficiary_account_no) {
          console.log('❌ Missing beneficiary_account_no');
          errors.push(t('contracts.errors.accountNumberRequired', 'Account Number is required'));
        }
        if (!formData.banking_docs.beneficiary_bank_name) {
          console.log('❌ Missing beneficiary_bank_name');
          errors.push(t('contracts.errors.bankNameRequired', 'Bank Name is required'));
        }
        if (!formData.banking_docs.beneficiary_bank_address) {
          console.log('❌ Missing beneficiary_bank_address');
          errors.push(t('contracts.errors.bankAddressRequired', 'Bank Address is required'));
        }
        break;
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Navigate to next step
  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
        window.scrollTo(0, 0);
      }
    }
  };

  // Navigate to previous step
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setValidationErrors([]);
      window.scrollTo(0, 0);
    }
  };

  // Cancel and go back
  const handleCancel = () => {
    if (confirm(t('contracts.confirmCancel', 'Are you sure you want to cancel? All data will be lost.'))) {
      if (onCancel) {
        onCancel();
      } else {
        navigate('/contracts');
      }
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      // Helper: Convert line fields to proper types (DB returns strings for numeric fields)
      const normalizeLines = (lines: any[]) => {
        return lines.map((line) => ({
          ...line,
          // Convert numeric fields from strings to numbers
          package_size: line.package_size ? Number(line.package_size) : null,
          number_of_packages: line.number_of_packages ? Number(line.number_of_packages) : null,
          quantity_mt: line.quantity_mt ? Number(line.quantity_mt) : null,
          unit_price: line.unit_price ? Number(line.unit_price) : null,
          rate_usd_per_mt: line.rate_usd_per_mt ? Number(line.rate_usd_per_mt) : null,
          amount_usd: line.amount_usd ? Number(line.amount_usd) : null,
          unit_size: line.unit_size ? Number(line.unit_size) : null,
          // Ensure string fields are strings or null
          product_name: line.product_name || null,
          brand: line.brand || null,
          trademark: line.trademark || null,
          marks: line.marks || null,
          notes: line.notes || null,
        }));
      };
      
      // Helper: Clean port IDs (remove "new:" prefix if present)
      const cleanPortId = (portId: string | undefined): string | undefined => {
        if (!portId) return undefined;
        if (portId.startsWith('new:')) {
          // This is a new port name typed by user - return undefined (backend will handle by name)
          return undefined;
        }
        return portId;
      };
      
      // Helper: Get port name (strip "new:" prefix if present)
      const getPortName = (portId: string | undefined, portName: string | undefined): string | undefined => {
        if (portId?.startsWith('new:')) {
          return portId.substring(4); // Remove "new:" prefix to get the name
        }
        return portName;
      };
      
      // Clean shipping data - handle new: prefixed ports
      const cleanedShipping = {
        ...formData.shipping,
        port_of_loading_id: cleanPortId(formData.shipping.port_of_loading_id),
        port_of_loading_name: getPortName(formData.shipping.port_of_loading_id, formData.shipping.port_of_loading_name),
        final_destination_id: cleanPortId(formData.shipping.final_destination_id),
        final_destination_name: getPortName(formData.shipping.final_destination_id, formData.shipping.final_destination_name),
      };
      
      // Prepare payload - NORMALIZED: Send nested objects at top level for normalized table storage
      const payload = {
        // Core contract fields
        contract_no: formData.commercial_parties.proforma_number,
        buyer_company_id: formData.commercial_parties.buyer_company_id || undefined,
        buyer_company_name: formData.commercial_parties.buyer_name || undefined,
        seller_company_id: formData.commercial_parties.exporter_company_id || undefined,
        seller_company_name: formData.commercial_parties.exporter_name || undefined,
        signed_at: formData.commercial_parties.invoice_date || undefined,
        status: formData.status,
        direction: formData.direction,
        subject: formData.subject || undefined,
        notes: extraInfo || formData.notes || undefined,
        
        // NORMALIZED: These go to separate tables (contract_parties, contract_shipping, etc.)
        commercial_parties: formData.commercial_parties,
        shipping: cleanedShipping,
        terms: formData.terms,
        banking_docs: formData.banking_docs,
        lines: normalizeLines(formData.lines),
        
        // Keep extra_json for truly extra/flexible data only
        extra_json: {
          extra_info: extraInfo,
        },
      };

      console.log('📤 Submitting contract payload (NORMALIZED):', payload);
      console.log('📤 Mode:', mode, 'Contract ID:', existingContract?.id);
      console.log('📤 commercial_parties:', formData.commercial_parties);
      console.log('📤 banking_docs:', formData.banking_docs);
      console.log('📤 shipping:', formData.shipping);
      console.log('📤 terms:', formData.terms);
      console.log('📤 lines:', formData.lines?.length, 'lines');

      if (mode === 'edit' && existingContract) {
        // Update existing contract
        const response = await apiClient.put(`/contracts/${existingContract.id}`, payload);
        console.log('✅ Contract updated successfully:', response.data);
        if (onSuccess) {
          onSuccess();
        } else {
          navigate(`/contracts/${existingContract.id}`);
        }
      } else {
        // Create new contract
        await createContract.mutateAsync(payload as any);
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/contracts');
        }
      }
    } catch (error: any) {
      console.error(`❌ Error ${mode === 'edit' ? 'updating' : 'creating'} contract:`, error);
      console.error('❌ Error response:', error.response?.data);
      
      // Extract error message and details from axios response
      const responseData = error.response?.data;
      const mainError = responseData?.error || error.message || 'Unknown error';
      
      // If there are validation details, format them nicely
      const errors: string[] = [];
      if (responseData?.details && Array.isArray(responseData.details)) {
        errors.push(`${mainError}:`);
        responseData.details.forEach((detail: any) => {
          errors.push(`  • ${detail.field}: ${detail.message}`);
        });
      } else {
        errors.push(`Failed to ${mode === 'edit' ? 'update' : 'create'} contract: ${mainError}`);
      }
      
      setValidationErrors(errors);
      
      // Scroll to top to show error
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === 'edit' 
              ? t('contracts.editContract', 'Edit Contract')
              : t('contracts.newContract', 'New Contract')}
          </h1>
          <button
            onClick={handleCancel}
            className="text-gray-600 hover:text-gray-900"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        {/* Progress Stepper */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex items-center">
                <div
                  onClick={() => mode === 'edit' && setCurrentStep(step)}
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2
                    ${
                      step < currentStep
                        ? 'bg-green-500 border-green-500 text-white'
                        : step === currentStep
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-500'
                    }
                    ${mode === 'edit' ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
                  `}
                  title={mode === 'edit' ? t('common.clickToJump', 'Click to jump to this step') : ''}
                >
                  {step < currentStep ? <CheckIcon className="h-5 w-5" /> : step}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p
                    onClick={() => mode === 'edit' && setCurrentStep(step)}
                    className={`text-sm font-medium ${
                      step <= currentStep ? 'text-gray-900' : 'text-gray-500'
                    } ${mode === 'edit' ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                    title={mode === 'edit' ? t('common.clickToJump', 'Click to jump to this step') : ''}
                  >
                    {t(`contracts.step${step}TitleV2`, `Step ${step}`)}
                  </p>
                </div>
              </div>
              {step < 5 && (
                <div
                  className={`flex-1 h-0.5 mx-4 ${
                    step < currentStep ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        
        {/* Edit Mode Info Banner */}
        {mode === 'edit' && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <InformationCircleIcon className="h-5 w-5 flex-shrink-0" />
              <span>
                {t('contracts.editModeNavInfo', 'Edit Mode: Click on any step number or title to jump directly to that section. All data is pre-filled and retained.')}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800 mb-2">
            {t('common.validationErrors', 'Please fix the following errors')}:
          </h3>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Floating Correct Extraction Button (appears on all steps when data exists) */}
      {extractionResult && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={openCorrectionModal}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200 font-semibold text-sm flex items-center gap-3 border-2 border-yellow-300"
          >
            <span className="text-xl">🔧</span>
            {t('contracts.correctExtraction', 'Correct AI Extraction')}
            {extractionResult.corrected && (
              <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">✓ {t('common.corrected', 'Corrected')}</span>
            )}
          </button>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {currentStep === 1 && (
          <Step1CommercialParties 
            data={formData} 
            onChange={handleChange} 
            setFormData={setFormData}
            extractionResult={extractionResult}
            setExtractionResult={setExtractionResult}
          />
        )}
        {currentStep === 2 && (
          <Step4ProductLines
            data={formData}
            onArrayChange={handleArrayChange}
            onArrayAdd={handleArrayAdd}
            onArrayRemove={handleArrayRemove}
          />
        )}
        {currentStep === 3 && (
          <Step2ShippingGeography data={formData} onChange={handleChange} />
        )}
        {currentStep === 4 && (
          <DeliveryPaymentTerms
            mode="contract"
            formData={formData}
            onChange={handleChange}
            onArrayChange={handleArrayChange}
            onArrayAdd={handleArrayAdd}
            onArrayRemove={handleArrayRemove}
          />
        )}
        {currentStep === 5 && (
          <>
            <Step5BankingDocs
              data={formData}
              onChange={handleChange}
              onArrayChange={handleArrayChange}
              onArrayAdd={handleArrayAdd}
              onArrayRemove={handleArrayRemove}
            />
            
            {/* Extra Info Field */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h4 className="text-md font-semibold text-gray-900 mb-4">
                {t('contracts.extraInfo', 'Additional Information')}
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                {t('contracts.extraInfoDesc', 'Use this field for any special information or clauses not covered by the form above')}
              </p>
              <textarea
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('contracts.extraInfoPlaceholder', 'Enter any additional information, special conditions, or notes here...')}
              />
            </div>
          </>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
        >
          {t('common.cancel', 'Cancel')}
        </button>

        <div className="flex gap-4">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              {t('common.back', 'Back')}
            </button>
          )}

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              {t('common.next', 'Next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || createContract.isPending}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(isSubmitting || createContract.isPending)
                ? mode === 'edit' ? t('common.updating', 'Updating...') : t('common.creating', 'Creating...')
                : mode === 'edit' ? t('contracts.updateContract', 'Update Contract') : t('contracts.createContract', 'Create Contract')}
            </button>
          )}
        </div>
      </div>

      {/* Correction Modal (accessible from all steps) */}
      {showCorrectionModal && extractionResult && correctedData && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
              onClick={() => !isSavingCorrections && setShowCorrectionModal(false)}
              aria-hidden="true"
            />

            {/* Centering spacer */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal Content - positioned above overlay */}
            <div className="relative z-10 inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <span className="text-2xl">🔧</span>
                    {t('contracts.correctAIExtraction', 'Correct AI Extraction')}
                  </h3>
                  <button
                    onClick={() => !isSavingCorrections && setShowCorrectionModal(false)}
                    className="text-white hover:text-gray-200 transition-colors"
                    disabled={isSavingCorrections}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <p className="text-sm text-yellow-100 mt-2">
                  {t('contracts.correctionsWillBeUsedForTraining', 'Your corrections will be saved and used to improve the AI accuracy for future extractions.')}
                </p>
              </div>

              {/* Body */}
              <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                {/* Product Lines Section (Most Important) */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CubeIcon className="h-5 w-5 text-blue-600" />
                    {t('contracts.productLines', 'Product Lines')}
                    <span className="text-sm text-yellow-600 font-normal">
                      ({t('contracts.mostCommonErrors', 'Most common errors here')})
                    </span>
                  </h4>
                  {correctedData.product_lines && correctedData.product_lines.length > 0 ? (
                  <div className="space-y-4">
                    {correctedData.product_lines.map((line: any, index: number) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-gray-700">Line {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...correctedData };
                              updated.product_lines.splice(index, 1);
                              setCorrectedData(updated);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            {t('common.delete', 'Delete')}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('contracts.typeOfGoods', 'Type of Goods')}
                            </label>
                            <input
                              type="text"
                              value={line.type_of_goods || ''}
                              onChange={(e) => {
                                const updated = { ...correctedData };
                                updated.product_lines[index].type_of_goods = e.target.value;
                                setCorrectedData(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <span className="text-yellow-600">⚠️</span> {t('contracts.packageSize', 'Package Size (kg)')}
                            </label>
                            <input
                              type="number"
                              value={line.unit_size || ''}
                              onChange={(e) => {
                                const updated = { ...correctedData };
                                updated.product_lines[index].unit_size = parseFloat(e.target.value) || 0;
                                setCorrectedData(updated);
                              }}
                              className="w-full px-3 py-2 border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-yellow-50"
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('contracts.numberOfPackages', 'Number of Packages')}
                            </label>
                            <input
                              type="number"
                              value={line.number_of_packages || ''}
                              onChange={(e) => {
                                const updated = { ...correctedData };
                                updated.product_lines[index].number_of_packages = parseInt(e.target.value) || 0;
                                setCorrectedData(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('contracts.quantityMT', 'Quantity (MT)')}
                            </label>
                            <input
                              type="number"
                              value={line.quantity_mt || ''}
                              onChange={(e) => {
                                const updated = { ...correctedData };
                                updated.product_lines[index].quantity_mt = parseFloat(e.target.value) || 0;
                                setCorrectedData(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                              step="0.001"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <span className="text-orange-600">🎯</span> {t('contracts.pricingMethod', 'Pricing Method')}
                            </label>
                            <select
                              value={line.pricing_method || 'per_mt'}
                              onChange={(e) => {
                                const updated = { ...correctedData };
                                updated.product_lines[index].pricing_method = e.target.value;
                                setCorrectedData(updated);
                              }}
                              className="w-full px-3 py-2 border-2 border-orange-400 rounded-lg focus:ring-2 focus:ring-orange-500 bg-orange-50"
                            >
                              <option value="per_mt">⚖️ Per MT</option>
                              <option value="per_package">📦 Per Package/Bag</option>
                              <option value="per_container">🚢 Per Container</option>
                              <option value="total">💰 Total Amount</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <span className="text-yellow-600">⚠️</span> {t('contracts.unitPrice', 'Unit Price (USD)')}
                            </label>
                            <input
                              type="number"
                              value={line.unit_price || line.rate_per_mt || ''}
                              onChange={(e) => {
                                const updated = { ...correctedData };
                                updated.product_lines[index].unit_price = parseFloat(e.target.value) || 0;
                                setCorrectedData(updated);
                              }}
                              className="w-full px-3 py-2 border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-yellow-50"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('contracts.amountUSD', 'Amount (USD)')}
                            </label>
                            <input
                              type="number"
                              value={line.amount || ''}
                              onChange={(e) => {
                                const updated = { ...correctedData };
                                updated.product_lines[index].amount = parseFloat(e.target.value) || 0;
                                setCorrectedData(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">
                      {t('contracts.noProductLines', 'No product lines extracted. Add them manually in the form.')}
                    </p>
                  </div>
                  )}
                </div>

                {/* Other Key Fields */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Proforma Details */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">
                      {t('contracts.proformaDetails', 'Proforma Invoice')}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('contracts.proformaNumber', 'Invoice Number')}
                        </label>
                        <input
                          type="text"
                          value={correctedData.proforma_invoice?.number || ''}
                          onChange={(e) => {
                            const updated = { ...correctedData };
                            if (!updated.proforma_invoice) updated.proforma_invoice = {};
                            updated.proforma_invoice.number = e.target.value;
                            setCorrectedData(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('contracts.invoiceDate', 'Date')}
                        </label>
                        <DateInput
                          value={correctedData.proforma_invoice?.date || ''}
                          onChange={(val) => {
                            const updated = { ...correctedData };
                            if (!updated.proforma_invoice) updated.proforma_invoice = {};
                            updated.proforma_invoice.date = val;
                            setCorrectedData(updated);
                          }}
                          className="w-full border-gray-300 focus:ring-yellow-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">
                      {t('contracts.shippingGeography', 'Shipping')}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('contracts.countryOfOrigin', 'Country of Origin')}
                        </label>
                        <input
                          type="text"
                          value={correctedData.shipping_geography?.country_of_origin || ''}
                          onChange={(e) => {
                            const updated = { ...correctedData };
                            if (!updated.shipping_geography) updated.shipping_geography = {};
                            updated.shipping_geography.country_of_origin = e.target.value;
                            setCorrectedData(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('contracts.countryOfDestination', 'Country of Destination')}
                        </label>
                        <input
                          type="text"
                          value={correctedData.shipping_geography?.country_of_destination || ''}
                          onChange={(e) => {
                            const updated = { ...correctedData };
                            if (!updated.shipping_geography) updated.shipping_geography = {};
                            updated.shipping_geography.country_of_destination = e.target.value;
                            setCorrectedData(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  <strong>{t('common.note', 'Note')}:</strong> {t('contracts.correctionsNote', 'These corrections will improve AI accuracy for all future invoices.')}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCorrectionModal(false)}
                    disabled={isSavingCorrections}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium disabled:opacity-50"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCorrections}
                    disabled={isSavingCorrections}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSavingCorrections ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {t('common.saving', 'Saving...')}
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        {t('contracts.saveCorrections', 'Save & Apply Corrections')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

