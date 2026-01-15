/**
 * Contract Wizard V2 - Step 1: Commercial Parties
 * Proforma Invoice details, Exporter, Buyer, Consignee
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import {
  BuildingOfficeIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../../../services/api';
import type { ContractFormData } from './types';
import { AutocompleteInput } from '../../common/AutocompleteInput';
import { DateInput } from '../../common/DateInput';
import { useBranches } from '../../../hooks/useBranches';
import { useDuplicateCheck } from '../../../hooks/useDuplicateCheck';
import { DuplicateEntityWarning } from '../../common/DuplicateEntityWarning';

interface Step1Props {
  data: ContractFormData;
  onChange: (section: keyof ContractFormData, field: string, value: any) => void;
  setFormData?: React.Dispatch<React.SetStateAction<ContractFormData>>;
  extractionResult?: any;
  setExtractionResult?: (result: any) => void;
}

export function Step1CommercialParties({ data, onChange, setFormData, extractionResult: extractionResultProp, setExtractionResult: setExtractionResultProp }: Step1Props) {
  const { t } = useTranslation();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  // Use parent's extraction state if provided, otherwise use local state
  const [localExtractionResult, setLocalExtractionResult] = useState<any>(null);
  const extractionResult = extractionResultProp !== undefined ? extractionResultProp : localExtractionResult;
  const setExtractionResult = setExtractionResultProp || setLocalExtractionResult;
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: branchesData, isLoading: branchesLoading } = useBranches();
  const isArabic = i18n.language === 'ar';

  // Duplicate check for Final Destination customer/consignment name
  // Only check when type is 'customer' or 'consignment' (branch type uses dropdown so no duplicates possible)
  const shouldCheckFinalDestDuplicates = 
    data.banking_docs.final_destination_type === 'customer' || 
    data.banking_docs.final_destination_type === 'consignment';
  
  const finalDestDuplicateCheck = useDuplicateCheck(
    data.banking_docs.final_destination_name || '',
    {
      entityType: 'customer',
      warningThreshold: 0.5,
      blockingThreshold: 0.7,
      debounceMs: 600,
      minLength: 3,
      skip: !shouldCheckFinalDestDuplicates,
    }
  );

  // Handler for selecting an existing entity from duplicate warning
  const handleSelectExistingFinalDest = (match: { id: string; name: string }) => {
    onChange('banking_docs', 'final_destination_name', match.name);
    onChange('banking_docs', 'final_destination_company_id', match.id);
  };

  // EDIT MODE FIX: When branches data loads, match saved branch name to branch ID
  // This handles contracts saved with name but missing company_id
  useEffect(() => {
    if (!branchesData?.branches || branchesLoading) return;
    
    const bankingDocs = data.banking_docs;
    
    // Only run if type is 'branch' and we have a name but no company_id
    if (
      bankingDocs.final_destination_type === 'branch' &&
      !bankingDocs.final_destination_company_id &&
      bankingDocs.final_destination_name
    ) {
      console.log('🔧 Attempting to match branch name to ID:', bankingDocs.final_destination_name);
      
      // Try to find matching branch by name (check both name and name_ar)
      const matchedBranch = branchesData.branches.find((b: any) => {
        const savedName = bankingDocs.final_destination_name?.toLowerCase().trim();
        return (
          b.name?.toLowerCase().trim() === savedName ||
          b.name_ar?.toLowerCase().trim() === savedName ||
          b.name?.toLowerCase().includes(savedName || '') ||
          b.name_ar?.toLowerCase().includes(savedName || '') ||
          savedName?.includes(b.name?.toLowerCase() || '') ||
          savedName?.includes(b.name_ar?.toLowerCase() || '')
        );
      });
      
      if (matchedBranch) {
        console.log('✅ Matched branch:', matchedBranch.name, '→ ID:', matchedBranch.id);
        onChange('banking_docs', 'final_destination_company_id', matchedBranch.id);
      } else {
        console.warn('⚠️ Could not match branch name to any branch:', bankingDocs.final_destination_name);
        console.log('   Available branches:', branchesData.branches.map((b: any) => ({ name: b.name, name_ar: b.name_ar })));
      }
    }
  }, [branchesData, branchesLoading, data.banking_docs.final_destination_type, data.banking_docs.final_destination_company_id, data.banking_docs.final_destination_name, onChange]);

  // Handle file upload and extraction
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setExtractionError(t('documents.invalidFileType', 'Invalid file type. Only PDF, JPG, and PNG allowed.'));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setExtractionError(t('documents.fileTooLarge', 'File size must be less than 10MB'));
      return;
    }

    setUploadedFile(file);
    setIsExtracting(true);
    setExtractionError(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Call backend API (apiClient automatically includes auth token)
      // Use extended timeout (90 seconds) for AI document processing which can take 40-60 seconds
      const response = await apiClient.post(
        '/contracts/extract-from-proforma',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 90000, // 90 seconds for AI processing
        }
      );

      if (response.data.success) {
        setExtractionResult(response.data);
        
        // Auto-fill form with extracted data
        await autoFillForm(response.data.data);
        
        console.log('✅ Extraction complete!', response.data);
      } else {
        setExtractionError(response.data.error || 'Extraction failed');
      }
    } catch (error: any) {
      console.error('❌ Extraction error:', error);
      setExtractionError(error.response?.data?.error || 'Failed to process document');
    } finally {
      setIsExtracting(false);
    }
  };

  // Auto-fill form with extracted data
  const autoFillForm = async (extractedData: any) => {
    console.log('🤖 Auto-filling form with extracted data:', extractedData);

    // Step 1: Proforma & Commercial Parties
    if (extractedData.proforma_invoice?.number) {
      console.log('  📋 Setting proforma_number:', extractedData.proforma_invoice.number);
      onChange('commercial_parties', 'proforma_number', extractedData.proforma_invoice.number);
    }
    if (extractedData.proforma_invoice?.date) {
      console.log('  📅 Setting invoice_date:', extractedData.proforma_invoice.date);
      onChange('commercial_parties', 'invoice_date', extractedData.proforma_invoice.date);
    }
    
    // Auto-match company names to IDs
    if (extractedData.commercial_parties?.exporter?.name || extractedData.commercial_parties?.buyer?.name) {
      try {
        // Fetch all companies to match names
        const companiesResponse = await apiClient.get('/companies?limit=1000');
        const companies = companiesResponse.data.companies || [];
        
        // Match exporter
        if (extractedData.commercial_parties?.exporter?.name) {
          const exporterName = extractedData.commercial_parties.exporter.name;
          console.log('  🏢 Setting exporter_name:', exporterName);
          onChange('commercial_parties', 'exporter_name', exporterName);
          
          const matchedExporter = companies.find((c: any) => 
            c.name?.toLowerCase().includes(exporterName.toLowerCase()) ||
            exporterName.toLowerCase().includes(c.name?.toLowerCase())
          );
          
          if (matchedExporter) {
            console.log('  ✅ Auto-matched exporter:', matchedExporter.name, '(ID:', matchedExporter.id, ')');
            onChange('commercial_parties', 'exporter_company_id', matchedExporter.id);
          } else {
            console.warn('  ⚠️  No company found matching exporter:', exporterName);
          }
        }
        
        // Match buyer
        if (extractedData.commercial_parties?.buyer?.name) {
          const buyerName = extractedData.commercial_parties.buyer.name;
          console.log('  🏢 Setting buyer_name:', buyerName);
          onChange('commercial_parties', 'buyer_name', buyerName);
          
          const matchedBuyer = companies.find((c: any) => 
            c.name?.toLowerCase().includes(buyerName.toLowerCase()) ||
            buyerName.toLowerCase().includes(c.name?.toLowerCase())
          );
          
          if (matchedBuyer) {
            console.log('  ✅ Auto-matched buyer:', matchedBuyer.name, '(ID:', matchedBuyer.id, ')');
            onChange('commercial_parties', 'buyer_company_id', matchedBuyer.id);
          } else {
            console.warn('  ⚠️  No company found matching buyer:', buyerName);
          }
        }
      } catch (error) {
        console.error('  ❌ Failed to auto-match companies:', error);
        // Continue with names only - user can manually select
        if (extractedData.commercial_parties?.exporter?.name) {
          onChange('commercial_parties', 'exporter_name', extractedData.commercial_parties.exporter.name);
        }
        if (extractedData.commercial_parties?.buyer?.name) {
          onChange('commercial_parties', 'buyer_name', extractedData.commercial_parties.buyer.name);
        }
      }
    }
    if (extractedData.commercial_parties?.consignee?.name) {
      onChange('commercial_parties', 'consignee_name', extractedData.commercial_parties.consignee.name);
      // If consignee is different from buyer, uncheck the checkbox
      if (extractedData.commercial_parties.consignee.name !== extractedData.commercial_parties.buyer?.name) {
        onChange('commercial_parties', 'consignee_same_as_buyer', false);
      }
    }

    // Step 2: Shipping Geography
    // NOTE: OCR extracts country_of_origin which we now use as country_of_export (POL country)
    if (extractedData.shipping_geography?.country_of_origin) {
      console.log('  🌍 Setting country_of_export:', extractedData.shipping_geography.country_of_origin);
      onChange('shipping', 'country_of_export', extractedData.shipping_geography.country_of_origin);
    }
    if (extractedData.shipping_geography?.country_of_destination) {
      console.log('  🌍 Setting country_of_final_destination:', extractedData.shipping_geography.country_of_destination);
      onChange('shipping', 'country_of_final_destination', extractedData.shipping_geography.country_of_destination);
    }
    if (extractedData.shipping_geography?.port_of_loading) {
      onChange('shipping', 'port_of_loading_name', extractedData.shipping_geography.port_of_loading);
    }
    if (extractedData.shipping_geography?.port_of_discharge || extractedData.shipping_geography?.final_destination) {
      const finalDest = extractedData.shipping_geography.final_destination || extractedData.shipping_geography.port_of_discharge;
      console.log('  🚢 Setting final_destination_name:', finalDest);
      onChange('shipping', 'final_destination_name', finalDest);
    }
    if (extractedData.shipping_geography?.pre_carriage_by) {
      onChange('shipping', 'pre_carriage_by', extractedData.shipping_geography.pre_carriage_by);
    }
    
    // Estimated Shipment Date - Priority: extracted date > manual input > default (30 days)
    if (extractedData.shipping_geography?.estimated_shipment_date) {
      console.log('  📅 Setting estimated_shipment_date from proforma:', extractedData.shipping_geography.estimated_shipment_date);
      onChange('shipping', 'estimated_shipment_date', extractedData.shipping_geography.estimated_shipment_date);
    } else if (extractedData.proforma_invoice?.shipment_date) {
      // Also check proforma_invoice.shipment_date as an alternative
      console.log('  📅 Setting estimated_shipment_date from proforma invoice:', extractedData.proforma_invoice.shipment_date);
      onChange('shipping', 'estimated_shipment_date', extractedData.proforma_invoice.shipment_date);
    }
    // If no date found, keep the default (30 days from now) that was set in initial form data

    // Step 3: Contract Terms
    if (extractedData.contract_terms?.incoterm) {
      console.log('  📦 Setting incoterm:', extractedData.contract_terms.incoterm);
      onChange('terms', 'incoterm', extractedData.contract_terms.incoterm);
    }
    if (extractedData.contract_terms?.delivery_terms_detail) {
      onChange('terms', 'delivery_terms_detail', extractedData.contract_terms.delivery_terms_detail);
    }
    if (extractedData.contract_terms?.payment_terms) {
      console.log('  💳 Setting payment_terms:', extractedData.contract_terms.payment_terms);
      onChange('terms', 'payment_terms', extractedData.contract_terms.payment_terms);
    }
    if (extractedData.contract_terms?.payment_method) {
      onChange('terms', 'payment_method', extractedData.contract_terms.payment_method);
    }
    if (extractedData.contract_terms?.currency) {
      onChange('terms', 'currency_code', extractedData.contract_terms.currency);
    }
    // Special clauses
    if (extractedData.special_clauses && extractedData.special_clauses.length > 0) {
      console.log('  📜 Setting special_clauses:', extractedData.special_clauses.length, 'clauses');
      onChange('terms', 'special_clauses', extractedData.special_clauses);
    }
    
    // Cargo Details (infer from product description or totals)
    // Try to infer cargo type from product description
    const productDescription = extractedData.product_lines?.[0]?.type_of_goods?.toLowerCase() || '';
    if (productDescription.includes('container') || productDescription.includes('fcl') || productDescription.includes('20 ft') || productDescription.includes('40 ft')) {
      console.log('  🚢 Detected cargo_type: containers');
      onChange('terms', 'cargo_type', 'containers');
      // Extract container count if mentioned
      const containerMatch = productDescription.match(/(\d+)\s*x\s*\d+\s*(ft|feet)/i);
      if (containerMatch) {
        const containerCount = parseInt(containerMatch[1]);
        console.log('  📦 Setting container_count:', containerCount);
        onChange('terms', 'container_count', containerCount);
      }
    } else if (productDescription.includes('crude oil') || productDescription.includes('petroleum')) {
      console.log('  🛢️  Detected cargo_type: tankers (crude_oil)');
      onChange('terms', 'cargo_type', 'tankers');
      onChange('terms', 'tanker_type', 'crude_oil');
    } else if (productDescription.includes('lpg') || productDescription.includes('liquefied petroleum gas')) {
      console.log('  🛢️  Detected cargo_type: tankers (lpg)');
      onChange('terms', 'cargo_type', 'tankers');
      onChange('terms', 'tanker_type', 'lpg');
    } else if (extractedData.totals?.total_quantity_mt) {
      console.log('  📦 Detected cargo_type: general_cargo');
      onChange('terms', 'cargo_type', 'general_cargo');
    }
    
    // Set weight from totals
    if (extractedData.totals?.total_quantity_mt) {
      console.log('  ⚖️  Setting weight_ton:', extractedData.totals.total_quantity_mt);
      onChange('terms', 'weight_ton', extractedData.totals.total_quantity_mt);
      onChange('terms', 'weight_unit', 'tons');
    }

    // Step 4: Product Lines - Set directly as array with NEW pricing logic
    if (extractedData.product_lines && extractedData.product_lines.length > 0 && setFormData) {
      console.log('  📦 Setting product lines:', extractedData.product_lines.length, 'lines');
      
      // Map the extracted product lines to the form structure with FULL pricing support
      const mappedLines = extractedData.product_lines.map((line: any, index: number) => {
        // Extract quantities - prefer AI's direct values
        const quantityKg = line.quantity_kg || 0;
        const quantityMTFromAI = line.quantity_mt || 0;
        
        // Extract package info
        const packages = line.number_of_packages || 0;
        const sizeKg = line.unit_size || (quantityKg > 0 && packages > 0 ? Math.round(quantityKg / packages) : 20);
        
        // Calculate quantity_mt - prefer AI's value, fallback to calculation
        const quantityMT = quantityMTFromAI > 0 
          ? quantityMTFromAI 
          : (quantityKg > 0 ? quantityKg / 1000 : (packages * sizeKg) / 1000);
        
        // Extract pricing method from AI (NEW!)
        const pricingMethod = line.pricing_method || 'per_mt';
        
        // Extract unit price - the actual price shown on invoice (NEW!)
        const unitPrice = line.unit_price || 0;
        
        // Calculate rate_usd_per_mt based on pricing method (NEW!)
        let ratePerMT = line.rate_per_mt_equivalent || line.rate_per_mt || 0;
        if (!ratePerMT && unitPrice > 0) {
          switch (pricingMethod) {
            case 'per_kg':
              ratePerMT = unitPrice * 1000; // 1 MT = 1000 KG
              break;
            case 'per_lb':
              ratePerMT = unitPrice * 2204.62; // 1 MT = 2204.62 LB
              break;
            case 'per_package':
              if (sizeKg > 0) {
                ratePerMT = unitPrice * (1000 / sizeKg);
              }
              break;
            case 'per_mt':
            default:
              ratePerMT = unitPrice;
              break;
          }
        }
        
        // Calculate amount based on pricing method
        const amount = line.amount || (
          pricingMethod === 'per_kg' ? (quantityKg || quantityMT * 1000) * unitPrice :
          pricingMethod === 'per_lb' ? ((quantityKg || quantityMT * 1000) * 2.20462) * unitPrice :
          pricingMethod === 'per_package' ? packages * unitPrice :
          quantityMT * ratePerMT
        );
        
        // Build type_of_goods - include grade if present
        let typeOfGoods = line.type_of_goods || '';
        if (line.grade && !typeOfGoods.includes(line.grade)) {
          typeOfGoods = typeOfGoods ? `${typeOfGoods} - ${line.grade}` : line.grade;
        }

        console.log(`    Line ${index + 1}: ${packages} × ${sizeKg}kg = ${quantityMT.toFixed(3)} MT | Price: ${pricingMethod} @ ${unitPrice} → ${ratePerMT.toFixed(2)} USD/MT | Amount: ${amount.toFixed(2)}`);

        return {
          type_of_goods: typeOfGoods,
          brand: line.brand || '',
          trademark: line.trademark || '',
          kind_of_packages: line.kind_of_packages || 'CARTONS',
          number_of_packages: packages,
          package_size: sizeKg,
          package_size_unit: 'KG',
          unit_size: sizeKg, // Backward compatibility
          quantity_mt: quantityMT,
          pricing_method: pricingMethod,  // NEW!
          unit_price: unitPrice,          // NEW!
          rate_usd_per_mt: ratePerMT,
          amount_usd: amount,
          notes: line.notes || '',
        };
      });
      
      setFormData((prev) => ({
        ...prev,
        lines: mappedLines,
      }));
    }

    // Step 5: Banking Details
    if (extractedData.banking_details?.beneficiary_name) {
      console.log('  🏦 Setting beneficiary_name:', extractedData.banking_details.beneficiary_name);
      onChange('banking_docs', 'beneficiary_name', extractedData.banking_details.beneficiary_name);
    }
    if (extractedData.banking_details?.bank_name) {
      onChange('banking_docs', 'beneficiary_bank_name', extractedData.banking_details.bank_name);
    }
    if (extractedData.banking_details?.account_number) {
      onChange('banking_docs', 'beneficiary_account_no', extractedData.banking_details.account_number);
    }
    if (extractedData.banking_details?.swift_code) {
      onChange('banking_docs', 'beneficiary_swift_code', extractedData.banking_details.swift_code);
    }
    if (extractedData.banking_details?.bank_address) {
      onChange('banking_docs', 'beneficiary_bank_address', extractedData.banking_details.bank_address);
    }
    if (extractedData.banking_details?.correspondent_bank) {
      onChange('banking_docs', 'correspondent_bank', extractedData.banking_details.correspondent_bank);
    }
    // Use exporter address as beneficiary address if not provided
    if (extractedData.commercial_parties?.exporter?.address) {
      onChange('banking_docs', 'beneficiary_address', extractedData.commercial_parties.exporter.address);
    }

    console.log('✅ Auto-fill complete!');
  };

  const handleChange = (field: string, value: any) => {
    onChange('commercial_parties', field, value);
  };

  return (
    <div className="space-y-8">
      {/* Header - data-field-name="commercial_parties" for section-level field highlighting */}
      <div data-field-name="commercial_parties" className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3 mb-2">
          <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">
            {t('contracts.commercialParties', 'Commercial Parties')}
          </h3>
        </div>
        <p className="text-sm text-blue-700">
          {t('contracts.commercialPartiesDesc', 'Exporter, buyer, and consignee information')}
        </p>
      </div>

      {/* Direction Selection: Purchase (Buyer) vs Sale (Seller) */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-900 mb-3">
          {t('contracts.transactionType', 'Transaction Type')} <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            data.direction === 'incoming' 
              ? 'border-blue-600 bg-blue-100' 
              : 'border-gray-300 bg-white hover:border-blue-300'
          }`}>
            <input
              type="radio"
              data-field-name="direction"
              value="incoming"
              checked={data.direction === 'incoming'}
              onChange={() => {
                onChange('direction' as any, '', 'incoming');
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ms-3 text-sm font-medium text-gray-900">
              📦 {t('contracts.directionIncoming', 'Purchase (We are the Buyer)')}
            </span>
          </label>
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            data.direction === 'outgoing' 
              ? 'border-green-600 bg-green-100' 
              : 'border-gray-300 bg-white hover:border-green-300'
          }`}>
            <input
              type="radio"
              data-field-name="direction"
              value="outgoing"
              checked={data.direction === 'outgoing'}
              onChange={() => {
                onChange('direction' as any, '', 'outgoing');
              }}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
            />
            <span className="ms-3 text-sm font-medium text-gray-900">
              🚚 {t('contracts.directionOutgoing', 'Sale (We are the Seller)')}
            </span>
          </label>
        </div>
      </div>

      {/* AI-Powered Quick Start */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ⚡ {t('contracts.quickStartWithAI', 'Quick Start with AI')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('contracts.uploadProformaHint', 'Upload your proforma invoice and let AI extract all information automatically. Takes about 10 seconds.')}
            </p>

            {/* Upload Area */}
            {!uploadedFile && !isExtracting && !extractionResult && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <CloudArrowUpIcon className="h-12 w-12 mx-auto text-blue-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  {t('contracts.clickToUpload', 'Click to upload proforma invoice')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, JPG, PNG (max 10MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </div>
            )}

            {/* Processing */}
            {isExtracting && (
              <div className="bg-white rounded-lg p-6 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  🤖 {t('contracts.analyzingDocument', 'AI is analyzing your document...')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('contracts.pleaseWait', 'This usually takes 10-15 seconds')}
                </p>
              </div>
            )}

            {/* Success */}
            {extractionResult && !isExtracting && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      ✅ {t('contracts.extractionComplete', 'Extraction complete!')} ({extractionResult.confidence}% confidence)
                    </p>
                    <p className="text-xs text-green-700 mb-3">
                      {t('contracts.fieldsAutoFilled', 'Form fields have been auto-filled. Please review and correct if needed.')}
                    </p>
                    {extractionResult.warnings && extractionResult.warnings.length > 0 && (
                      <div className="text-xs text-yellow-700 space-y-1 mb-3">
                        <p className="font-medium">⚠️ {t('contracts.warnings', 'Warnings')}:</p>
                        <ul className="list-disc list-inside ml-2">
                          {extractionResult.warnings.map((warning: string, idx: number) => (
                            <li key={idx}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFile(null);
                        setExtractionResult(null);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {t('contracts.uploadAnother', 'Upload another document')}
                    </button>
                    <p className="text-xs text-green-600 mt-2">
                      💡 {t('contracts.useCorrectionButton', 'Use the floating "Correct Extraction" button to review and fix any errors')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {extractionError && (
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 mb-2">
                      ❌ {t('contracts.extractionFailed', 'Extraction failed')}
                    </p>
                    <p className="text-xs text-red-700">
                      {extractionError}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFile(null);
                        setExtractionError(null);
                      }}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-800"
                    >
                      {t('contracts.tryAgain', 'Try again')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center my-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">
              {t('contracts.orEnterManually', 'Or enter manually')}
            </span>
          </div>
        </div>
      </div>

      {/* Subject Field */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('contracts.subject', 'Contract Subject')}
        </label>
        <input
          type="text"
          value={
            // Handle corrupted data where subject might be an object instead of string
            typeof data.subject === 'string' 
              ? data.subject 
              : (data.subject && typeof data.subject === 'object' && '' in data.subject) 
                ? (data.subject as any)[''] 
                : ''
          }
          onChange={(e) => {
            // Use setFormData directly for top-level field (not nested)
            if (setFormData) {
              setFormData((prev) => ({ ...prev, subject: e.target.value || undefined }));
            }
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('contracts.subjectPlaceholder', 'e.g., "520 MT Basmati Rice from India" or "Wheat Export to Saudi Arabia"')}
        />
        <p className="mt-2 text-xs text-gray-500">
          {t('contracts.subjectHint', 'Brief description of what this contract is about (optional but recommended)')}
        </p>
      </div>

      {/* Proforma Invoice Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('contracts.proformaDetails', 'Proforma Invoice Details')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.proformaNumber', 'Proforma Invoice Number')} *
            </label>
            <input
              type="text"
              data-field-name="proforma_number"
              value={data.commercial_parties.proforma_number}
              onChange={(e) => handleChange('proforma_number', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="BIEPL/IN/PI/24-25/..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.invoiceDate', 'Invoice Date')}
            </label>
            <DateInput
              value={data.commercial_parties.invoice_date || ''}
              onChange={(val) => handleChange('invoice_date', val || undefined)}
              className="w-full border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.otherReference', 'Other Reference')}
            </label>
            <input
              type="text"
              data-field-name="other_reference"
              value={data.commercial_parties.other_reference || ''}
              onChange={(e) => handleChange('other_reference', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="IEC NO., License No., etc."
            />
          </div>
        </div>
      </div>

      {/* Exporter */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('contracts.exporter', 'Exporter')}
        </h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('contracts.exporterCompany', 'Exporter Company')} *
          </label>
          <AutocompleteInput
            type="company"
            data-field-name="exporter_company_id"
            value={data.commercial_parties.exporter_company_id}
            displayValue={data.commercial_parties.exporter_name || ''}
            onChange={(id, name) => {
              handleChange('exporter_company_id', id);
              handleChange('exporter_name', name);
            }}
            placeholder={t('contracts.selectExporter', 'Select exporter company...')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Buyer */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('contracts.buyer', 'Buyer')}
        </h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('contracts.buyerCompany', 'Buyer Company')} *
          </label>
          <AutocompleteInput
            type="company"
            data-field-name="buyer_company_id"
            value={data.commercial_parties.buyer_company_id}
            displayValue={data.commercial_parties.buyer_name || ''}
            onChange={(id, name) => {
              handleChange('buyer_company_id', id);
              handleChange('buyer_name', name);
            }}
            placeholder={t('contracts.selectBuyer', 'Select buyer company...')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Consignee */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          {t('contracts.consignee', 'Consignee')}
        </h4>
        
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              data-field-name="consignee_same_as_buyer"
              checked={data.commercial_parties.consignee_same_as_buyer}
              onChange={(e) => {
                handleChange('consignee_same_as_buyer', e.target.checked);
                if (e.target.checked) {
                  // Copy buyer info to consignee
                  handleChange('consignee_company_id', data.commercial_parties.buyer_company_id);
                  handleChange('consignee_name', data.commercial_parties.buyer_name);
                }
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              {t('contracts.consigneeSameAsBuyer', 'Consignee is same as Buyer')}
            </span>
          </label>
        </div>

        {!data.commercial_parties.consignee_same_as_buyer && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('contracts.consigneeCompany', 'Consignee Company')}
            </label>
            <AutocompleteInput
              type="company"
              value={data.commercial_parties.consignee_company_id || ''}
              displayValue={data.commercial_parties.consignee_name || ''}
              onChange={(id, name) => {
                handleChange('consignee_company_id', id || undefined);
                handleChange('consignee_name', name || undefined);
              }}
              placeholder={t('contracts.selectConsignee', 'Select consignee company (if different from buyer)...')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500">
              {t('contracts.consigneeHint', 'Leave blank if consignee is the same as buyer')}
            </p>
          </div>
        )}
      </div>

      {/* Broker Information */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-900 mb-3">
          {t('contracts.hasBroker', 'Is there a Broker involved?')}
        </label>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            data.commercial_parties.has_broker === true
              ? 'border-purple-600 bg-purple-100' 
              : 'border-gray-300 bg-white hover:border-purple-300'
          }`}>
            <input
              type="radio"
              data-field-name="has_broker"
              checked={data.commercial_parties.has_broker === true}
              onChange={() => handleChange('has_broker', true)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
            />
            <span className="ms-3 text-sm font-medium text-gray-900">
              ✅ {t('contracts.yesBroker', 'Yes - Broker Involved')}
            </span>
          </label>
          <label className={`flex-1 flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            data.commercial_parties.has_broker === false
              ? 'border-gray-600 bg-gray-100' 
              : 'border-gray-300 bg-white hover:border-gray-400'
          }`}>
            <input
              type="radio"
              checked={data.commercial_parties.has_broker === false}
              onChange={() => {
                handleChange('has_broker', false);
                handleChange('broker_buying_name', undefined);
                handleChange('broker_selling_name', undefined);
              }}
              className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300"
            />
            <span className="ms-3 text-sm font-medium text-gray-900">
              ❌ {t('contracts.noBroker', 'No - Direct Transaction')}
            </span>
          </label>
        </div>

        {data.commercial_parties.has_broker && (
          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-purple-900 mb-3">
              {t('contracts.brokerDetails', 'Broker Details')}
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('contracts.brokerBuyingName', 'Buying Broker Name')}
                </label>
                <input
                  type="text"
                  data-field-name="broker_buying_name"
                  value={data.commercial_parties.broker_buying_name || ''}
                  onChange={(e) => handleChange('broker_buying_name', e.target.value || undefined)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder={t('contracts.brokerBuyingPlaceholder', 'Enter broker name for purchasing')}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('contracts.brokerBuyingHint', 'Broker representing the buyer side')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('contracts.brokerSellingName', 'Selling Broker Name')}
                </label>
                <input
                  type="text"
                  value={data.commercial_parties.broker_selling_name || ''}
                  onChange={(e) => handleChange('broker_selling_name', e.target.value || undefined)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder={t('contracts.brokerSellingPlaceholder', 'Enter broker name for selling')}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('contracts.brokerSellingHint', 'Broker representing the seller side')}
                </p>
              </div>
            </div>
          </div>
        )}
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
                  data.banking_docs.final_destination_type === 'branch'
                    ? 'border-blue-600 bg-blue-100' 
                    : 'border-gray-300 bg-white hover:border-blue-300'
                }`}>
                  <input
                    type="radio"
                    data-field-name="final_destination_type"
                    value="branch"
                    checked={data.banking_docs.final_destination_type === 'branch'}
                    onChange={() => {
                      onChange('banking_docs', 'final_destination_type', 'branch');
                      // Clear selling price for branches
                      onChange('banking_docs', 'final_destination_selling_price', undefined);
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ms-3 text-sm font-medium text-gray-900">
                    🏢 {t('contracts.destinationBranch', 'Branch')}
                  </span>
                </label>
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  data.banking_docs.final_destination_type === 'customer'
                    ? 'border-green-600 bg-green-100' 
                    : 'border-gray-300 bg-white hover:border-green-300'
                }`}>
                  <input
                    type="radio"
                    data-field-name="final_destination_type"
                    value="customer"
                    checked={data.banking_docs.final_destination_type === 'customer'}
                    onChange={() => onChange('banking_docs', 'final_destination_type', 'customer')}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                  />
                  <span className="ms-3 text-sm font-medium text-gray-900">
                    👤 {t('contracts.destinationCustomer', 'External Customer')}
                  </span>
                </label>
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  data.banking_docs.final_destination_type === 'consignment'
                    ? 'border-purple-600 bg-purple-100' 
                    : 'border-gray-300 bg-white hover:border-purple-300'
                }`}>
                  <input
                    type="radio"
                    data-field-name="final_destination_type"
                    value="consignment"
                    checked={data.banking_docs.final_destination_type === 'consignment'}
                    onChange={() => {
                      onChange('banking_docs', 'final_destination_type', 'consignment');
                      // Clear selling price for consignment
                      onChange('banking_docs', 'final_destination_selling_price', undefined);
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
              {data.banking_docs.final_destination_type === 'branch' ? (
                <>
                  {/* Branch Name - Parent branches dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.branchName', 'Branch Name')} *
                    </label>
                    <select
                      value={data.banking_docs.final_destination_company_id || ''}
                      onChange={(e) => {
                        const selectedBranch = branchesData?.branches.find(b => b.id === e.target.value);
                        onChange('banking_docs', 'final_destination_company_id', e.target.value || undefined);
                        onChange('banking_docs', 'final_destination_delivery_place', ''); // Reset warehouse when branch changes
                        onChange('banking_docs', 'final_destination_name', selectedBranch ? (isArabic ? selectedBranch.name_ar : selectedBranch.name) : undefined);
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
                  </div>

                  {/* Final Destination - Child warehouses dropdown (filtered by selected branch) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDeliveryPlace', 'Final Place of Delivery')} *
                    </label>
                    <select
                      value={data.banking_docs.final_destination_delivery_place || ''}
                      onChange={(e) => {
                        onChange('banking_docs', 'final_destination_delivery_place', e.target.value || undefined);
                      }}
                      disabled={!data.banking_docs.final_destination_company_id}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white ${
                        !data.banking_docs.final_destination_company_id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">
                        {!data.banking_docs.final_destination_company_id 
                          ? t('contracts.selectBranchFirst', 'Select a branch first...')
                          : t('contracts.selectWarehouse', 'Select final destination...')
                        }
                      </option>
                      {data.banking_docs.final_destination_company_id && branchesData?.branches
                        .filter(b => 
                          b.branch_type === 'warehouse' && (
                            // Direct child warehouse
                            b.parent_id === data.banking_docs.final_destination_company_id ||
                            // Shared warehouse - branch has access
                            (b.is_shared && b.shared_with_branches?.includes(data.banking_docs.final_destination_company_id || ''))
                          )
                        )
                        .map((warehouse) => {
                          const warehouseName = isArabic ? (warehouse.name_ar || warehouse.name) : warehouse.name;
                          return (
                            <option key={warehouse.id} value={warehouseName}>
                              {warehouseName}{warehouse.is_shared ? ' ⭐' : ''}
                            </option>
                          );
                        })
                      }
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('contracts.warehouseHint', 'Select the specific warehouse or location within the branch')}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Company/Owner Name - Text input for non-branch types with duplicate checking */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDestinationName', 'Company / Customer Name')} *
                    </label>
                    <input
                      type="text"
                      value={data.banking_docs.final_destination_name || ''}
                      onChange={(e) => onChange('banking_docs', 'final_destination_name', e.target.value || undefined)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                        finalDestDuplicateCheck.isDuplicateBlocked
                          ? 'border-red-400 bg-red-50 focus:ring-red-500'
                          : finalDestDuplicateCheck.hasPotentialDuplicate
                            ? 'border-amber-400 bg-amber-50 focus:ring-amber-500'
                            : 'border-gray-300 focus:ring-amber-500'
                      }`}
                      placeholder={t('contracts.customerNamePlaceholder', 'e.g., ABC Trading LLC')}
                    />
                    {/* Duplicate Entity Warning */}
                    <DuplicateEntityWarning
                      isChecking={finalDestDuplicateCheck.isChecking}
                      hasPotentialDuplicate={finalDestDuplicateCheck.hasPotentialDuplicate}
                      isDuplicateBlocked={finalDestDuplicateCheck.isDuplicateBlocked}
                      bestMatch={finalDestDuplicateCheck.bestMatch}
                      matches={finalDestDuplicateCheck.matches}
                      onSelectExisting={handleSelectExistingFinalDest}
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
                  value={data.banking_docs.final_destination_delivery_place || ''}
                  onChange={(e) => onChange('banking_docs', 'final_destination_delivery_place', e.target.value || undefined)}
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
              {data.banking_docs.final_destination_type === 'customer' && (
                <>
                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.finalDestinationAddress', 'Full Address')} *
                    </label>
                    <textarea
                      value={data.banking_docs.final_destination_address || ''}
                      onChange={(e) => onChange('banking_docs', 'final_destination_address', e.target.value || undefined)}
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
                      value={data.banking_docs.final_destination_contact || ''}
                      onChange={(e) => onChange('banking_docs', 'final_destination_contact', e.target.value || undefined)}
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
                        value={data.banking_docs.final_destination_selling_price || ''}
                        onChange={(e) => onChange('banking_docs', 'final_destination_selling_price', e.target.value ? Number(e.target.value) : undefined)}
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
                      value={data.banking_docs.final_destination_notes || ''}
                      onChange={(e) => onChange('banking_docs', 'final_destination_notes', e.target.value || undefined)}
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
          <strong>{t('common.note', 'Note')}:</strong> {t('contracts.step1Note', 'The exporter is the seller/supplier providing the goods. The buyer is the purchasing company. The consignee is who receives the goods (often same as buyer).')}
        </p>
      </div>
    </div>
  );
}
