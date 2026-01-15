/**
 * Commercial Invoice Upload Section Component
 * Handles Commercial Invoice document upload and OCR extraction
 * Extracts: cargo_type, incoterms, payment_terms
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CloudArrowUpIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { apiClient } from '../../../services/api';

interface CIUploadSectionProps {
  formData: any;
  onChange: (field: any, value: any) => void;
}

export function CIUploadSection({ formData, onChange }: CIUploadSectionProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Handle file upload and extraction
  const handleFileUpload = async (file: File) => {
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
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      console.log('📤 Uploading Commercial Invoice document for extraction...');

      // Call backend API (apiClient automatically includes auth token)
      // Extended timeout for AI processing of multi-page PDFs (90 seconds)
      const response = await apiClient.post(
        '/shipments/extract-from-ci',
        formDataUpload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 90000, // 90 seconds for AI OCR processing
        }
      );

      if (response.data.success) {
        setExtractionResult(response.data);
        
        // Auto-fill form with extracted data
        await autoFillForm(response.data.data);

        console.log('✅ Commercial Invoice Extraction complete!', response.data);
      } else {
        setExtractionError(response.data.error || 'Extraction failed');
      }
    } catch (error: any) {
      console.error('❌ Commercial Invoice Extraction error:', error);
      setExtractionError(error.message || 'Failed to process document');
    } finally {
      setIsExtracting(false);
    }
  };

  // Auto-fill form with extracted data from Commercial Invoice
  const autoFillForm = async (extractedData: any) => {
    console.log('🤖 Auto-filling form with Commercial Invoice data:', extractedData);

    // Only fill empty fields to preserve manual entries
    
    // 1. CRITICAL: Shipment Number (SN) = Commercial Invoice Number
    if (!formData.sn && extractedData.document_info?.invoice_number) {
      console.log('  📋 Setting Shipment Number (SN) from invoice:', extractedData.document_info.invoice_number);
      onChange('sn', extractedData.document_info.invoice_number);
    }

    // 2. Product Lines - extract from line_items
    // IMPORTANT: Keep track of lines locally since state updates are async
    let newProductLines: any[] = [];
    
    if ((!formData.lines || formData.lines.length === 0) && extractedData.line_items?.length > 0) {
      console.log('  📦 Setting product lines:', extractedData.line_items.length, 'items');
      newProductLines = extractedData.line_items.map((item: any, idx: number) => ({
        id: `line-${Date.now()}-${idx}`,
        product_name: item.product_name || '',
        type_of_goods: item.product_name || item.description || '',
        description: item.description || '',
        hs_code: item.hs_code || '',
        // Use the new quantity_mt field directly if available
        quantity_mt: item.quantity_mt || item.net_weight_mt || null,
        net_weight_mt: item.net_weight_mt || null,
        gross_weight_mt: item.gross_weight_mt || null,
        qty: item.quantity_mt || item.net_weight_mt || '',
        uom: 'MT',
        unit_price: item.unit_price || '',
        rate_usd_per_mt: item.unit_price || null,
        currency_code: item.currency || 'USD',
        amount_usd: item.total_amount || '',
        // Package information (may be overridden by Packing List below)
        package_count: item.package_count || null,
        package_type: item.package_type || null,
        package_size: item.package_weight_kg || 0,  // Map weight per bag to package_size
        package_size_unit: 'KG',
        unit_size: item.package_weight_kg || 0,     // Backward compatibility
        kind_of_packages: item.package_type || '',
        number_of_packages: item.package_count || 0,
        // Other fields
        brand: item.brand || '',
        lot_number: item.lot_number || '',
        notes: item.origin ? `Origin: ${item.origin}` : '',
      }));
      
      // Also set product_text from first product for summary display
      if (!formData.product_text && newProductLines.length > 0) {
        const productNames = newProductLines.map((l: any) => l.product_name || l.type_of_goods).filter(Boolean);
        onChange('product_text', productNames.join(', '));
      }
    }

    // 2b. PACKING DETAILS from Packing List (if present)
    // This updates packaging info that may not be in the Commercial Invoice
    if (extractedData.packing_details) {
      const packingDetails = extractedData.packing_details;
      console.log('  📦 Packing details found from:', packingDetails.source || 'UNKNOWN');
      
      // If package info came from Packing List, update line items
      if (packingDetails.source === 'PACKING_LIST') {
        console.log('  ⚠️ Packaging data extracted from PACKING LIST (not Commercial Invoice)');
        
        // Use the newProductLines we just created (not formData.lines which hasn't updated yet)
        const linesToUpdate = newProductLines.length > 0 ? newProductLines : (formData.lines || []);
        
        if (linesToUpdate.length > 0) {
          // Calculate number of packages per line based on total packages and lines
          const packagesPerLine = packingDetails.total_packages 
            ? Math.round(packingDetails.total_packages / linesToUpdate.length)
            : 0;
            
          newProductLines = linesToUpdate.map((line: any) => {
            // Update line with packing details
            const updatedLine = {
              ...line,
              // Set package type from Packing List if not already set
              kind_of_packages: line.kind_of_packages || packingDetails.package_type || 'BAGS',
              package_type: line.package_type || packingDetails.package_type || 'BAGS',
              // Set package weight from Packing List
              package_size: packingDetails.package_weight_kg || line.package_size || 0,
              package_size_unit: 'KG',
              unit_size: packingDetails.package_weight_kg || line.unit_size || 0,
              // Set number of packages - calculate from total or use line quantity
              number_of_packages: line.number_of_packages || packagesPerLine || 
                (line.quantity_mt && packingDetails.package_weight_kg 
                  ? Math.round((line.quantity_mt * 1000) / packingDetails.package_weight_kg) 
                  : 0),
            };
            console.log('  📦 Updated line with packing:', updatedLine.kind_of_packages, updatedLine.package_size, 'kg', updatedLine.number_of_packages, 'packages');
            return updatedLine;
          });
          console.log('  ✅ Updated', newProductLines.length, 'line items with Packing List packaging details');
        }
        
        // Set total packages on formData if available
        if (packingDetails.total_packages) {
          onChange('total_packages', packingDetails.total_packages);
          console.log('  📦 Set total packages:', packingDetails.total_packages);
        }
      }
      
      // Extract container breakdown if available and we're in containers mode
      if (packingDetails.container_breakdown?.length > 0) {
        console.log('  🚢 Container breakdown from Packing List:', packingDetails.container_breakdown.length, 'containers');
        // This will be handled when containers are set up in Step 4
      }
    }
    
    // NOW set the lines (after all processing is done)
    if (newProductLines.length > 0) {
      onChange('lines', newProductLines);
      console.log('  ✅ Final lines set with packaging:', newProductLines.map(l => ({ 
        name: l.product_name, 
        pkg_type: l.kind_of_packages, 
        pkg_size: l.package_size, 
        pkg_count: l.number_of_packages 
      })));
    }
    
    // 3. Total Weight
    const totalWeightMT = extractedData.goods?.total_weight_mt || formData.weight_ton;
    if (!formData.weight_ton && extractedData.goods?.total_weight_mt) {
      console.log('  ⚖️ Setting weight:', extractedData.goods.total_weight_mt, 'MT');
      onChange('weight_ton', extractedData.goods.total_weight_mt);
    }
    
    // 3b. Update container net weights if they are 0 but total weight is available
    // This handles the case where BOL extracted containers first but had no net weight info
    if (totalWeightMT && formData.containers && formData.containers.length > 0) {
      const containersNeedingNetWeight = formData.containers.filter(
        (c: any) => !c.net_weight_kg || c.net_weight_kg === 0 || c.net_weight_kg === ''
      );
      
      if (containersNeedingNetWeight.length > 0) {
        const totalNetWeightKg = totalWeightMT * 1000; // Convert MT to KG
        const netWeightPerContainer = Math.round(totalNetWeightKg / formData.containers.length);
        
        console.log('  ⚖️ Updating container net weights from CI total:');
        console.log(`     Total: ${totalNetWeightKg} kg ÷ ${formData.containers.length} containers = ${netWeightPerContainer} kg each`);
        
        const updatedContainers = formData.containers.map((container: any) => ({
          ...container,
          net_weight_kg: container.net_weight_kg && container.net_weight_kg > 0 
            ? container.net_weight_kg 
            : netWeightPerContainer,
        }));
        
        onChange('containers', updatedContainers);
      }
    }

    // 4. Cargo Type - map extracted cargo_type to form values
    if (!formData.cargo_type && extractedData.cargo_type) {
      console.log('  📦 Setting cargo type:', extractedData.cargo_type);
      const cargoTypeMap: Record<string, string> = {
        'containers': 'containers',
        'general_cargo': 'general_cargo',
        'tankers': 'tankers',
        'trucks': 'trucks',
      };
      const mappedCargoType = cargoTypeMap[extractedData.cargo_type] || extractedData.cargo_type;
      onChange('cargo_type', mappedCargoType);
    }

    // 5. Incoterms (Delivery Terms)
    if (!formData.incoterms && extractedData.incoterms) {
      console.log('  📋 Setting incoterms:', extractedData.incoterms);
      const incoterm = extractedData.incoterms.split(' ')[0].toUpperCase();
      const validIncoterms = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];
      if (validIncoterms.includes(incoterm)) {
        onChange('incoterms', incoterm);
      }
    }

    // 6. Payment Terms
    if (!formData.payment_terms && extractedData.payment_terms) {
      console.log('  💰 Setting payment terms:', extractedData.payment_terms);
      const paymentTermsLower = extractedData.payment_terms.toLowerCase();
      
      if (paymentTermsLower.includes('lc') || paymentTermsLower.includes('letter of credit')) {
        onChange('payment_method', 'lc');
      } else if (paymentTermsLower.includes('tt') || paymentTermsLower.includes('telegraphic')) {
        onChange('payment_method', 'tt');
      } else if (paymentTermsLower.includes('cad') || paymentTermsLower.includes('cash against')) {
        onChange('payment_method', 'cad');
      }
      
      onChange('payment_terms', extractedData.payment_terms);
    }

    // Helper: Extract core port name for better search matching
    const extractPortName = (fullPortName: string): string => {
      let name = fullPortName
        .replace(/,?\s*(PORT|TERMINAL|INDIA|TURKEY|CHINA|USA|UAE|SINGAPORE|MALAYSIA)\.?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const firstWord = name.split(/[\s,]/)[0];
      return firstWord.length >= 3 ? firstWord : name;
    };

    // 7. Shipping info (backup if BOL not uploaded)
    if (!formData.pol_id && extractedData.shipping_info?.origin_port) {
      const portName = extractPortName(extractedData.shipping_info.origin_port);
      console.log('  🌊 Setting POL from CI:', extractedData.shipping_info.origin_port, '→ searching:', portName);
      try {
        const polResponse = await apiClient.get(
          `/ports?search=${encodeURIComponent(portName)}&limit=5`
        );
        // API returns { data: [...] } not { ports: [...] }
        const ports = polResponse.data.data || polResponse.data.ports || [];
        if (ports.length > 0) {
          onChange('pol_id', ports[0].id);
          onChange('pol_name', ports[0].name);  // Set display name
          console.log('  ✅ POL matched:', ports[0].name);
        } else {
          // Auto-create port if not found
          console.log('  🆕 Auto-creating POL:', extractedData.shipping_info.origin_port);
          try {
            const createResponse = await apiClient.post('/ports', {
              name: portName,
              country: extractedData.shipping_info.country_of_origin || null,
            });
            if (createResponse.data.data?.id) {
              onChange('pol_id', createResponse.data.data.id);
              onChange('pol_name', createResponse.data.data.name);  // Set display name
              console.log('  ✅ POL auto-created:', createResponse.data.data.name);
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to auto-create POL:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to lookup POL from CI:', err);
      }
    }

    if (!formData.pod_id && extractedData.shipping_info?.destination_port) {
      const portName = extractPortName(extractedData.shipping_info.destination_port);
      console.log('  🌊 Setting POD from CI:', extractedData.shipping_info.destination_port, '→ searching:', portName);
      try {
        const podResponse = await apiClient.get(
          `/ports?search=${encodeURIComponent(portName)}&limit=5`
        );
        // API returns { data: [...] } not { ports: [...] }
        const ports = podResponse.data.data || podResponse.data.ports || [];
        if (ports.length > 0) {
          onChange('pod_id', ports[0].id);
          onChange('pod_name', ports[0].name);  // Set display name
          console.log('  ✅ POD matched:', ports[0].name);
        } else {
          // Auto-create port if not found
          console.log('  🆕 Auto-creating POD:', extractedData.shipping_info.destination_port);
          try {
            const createResponse = await apiClient.post('/ports', {
              name: portName,
              country: extractedData.shipping_info.country_of_destination || null,
            });
            if (createResponse.data.data?.id) {
              onChange('pod_id', createResponse.data.data.id);
              onChange('pod_name', createResponse.data.data.name);  // Set display name
              console.log('  ✅ POD auto-created:', createResponse.data.data.name);
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to auto-create POD:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to lookup POD from CI:', err);
      }
    }

    // 8. Parties info (if available and empty) - Using fuzzy matching for OCR names
    if (!formData.supplier_id && extractedData.parties?.exporter) {
      console.log('  🏢 Setting supplier from CI:', extractedData.parties.exporter);
      try {
        // First try fuzzy matching endpoint (better for OCR-extracted names)
        const fuzzyResponse = await apiClient.get(
          `/companies/fuzzy-match?name=${encodeURIComponent(extractedData.parties.exporter)}&type=supplier&threshold=0.6`
        );
        
        if (fuzzyResponse.data.hasGoodMatch && fuzzyResponse.data.bestMatch) {
          // Found a good fuzzy match (>70% similarity)
          const match = fuzzyResponse.data.bestMatch;
          onChange('supplier_id', match.id);
          onChange('supplier_name', match.name);
          console.log(`  ✅ Supplier fuzzy-matched: "${extractedData.parties.exporter}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
        } else if (fuzzyResponse.data.matches?.length > 0) {
          // Found a match above threshold but below 70%
          const match = fuzzyResponse.data.matches[0];
          onChange('supplier_id', match.id);
          onChange('supplier_name', match.name);
          console.log(`  ✅ Supplier matched (lower confidence): "${extractedData.parties.exporter}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
        } else {
          // No match found - use POST which will also do fuzzy matching before creating
          console.log('  🆕 Creating/matching supplier via POST:', extractedData.parties.exporter);
          try {
            const createResponse = await apiClient.post('/companies', {
              name: extractedData.parties.exporter,
              is_supplier: true,
            });
            if (createResponse.data.data?.id) {
              onChange('supplier_id', createResponse.data.data.id);
              onChange('supplier_name', createResponse.data.data.name);
              if (createResponse.data.matched) {
                console.log(`  ✅ Supplier matched via POST: "${createResponse.data.data.name}" (${createResponse.data.matchType})`);
              } else {
                console.log(`  ✅ Supplier created: "${createResponse.data.data.name}"`);
              }
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to create/match supplier:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to fuzzy-match supplier from CI:', err);
        // Fallback to regular search
        try {
          const supplierResponse = await apiClient.get(
            `/companies?search=${encodeURIComponent(extractedData.parties.exporter)}&limit=5`
          );
          const companies = supplierResponse.data.data || supplierResponse.data.companies || [];
          if (companies.length > 0) {
            onChange('supplier_id', companies[0].id);
            onChange('supplier_name', companies[0].name);
            console.log('  ✅ Supplier found (fallback):', companies[0].name);
          }
        } catch (fallbackErr) {
          console.warn('  ⚠️ Fallback search also failed:', fallbackErr);
        }
      }
    }

    // 9. Buyer/Importer (extract from parties.importer) - Using fuzzy matching
    if (!formData.buyer_id && extractedData.parties?.importer) {
      console.log('  🏢 Setting buyer/importer from CI:', extractedData.parties.importer);
      try {
        // First try fuzzy matching endpoint
        const fuzzyResponse = await apiClient.get(
          `/companies/fuzzy-match?name=${encodeURIComponent(extractedData.parties.importer)}&type=customer&threshold=0.6`
        );
        
        if (fuzzyResponse.data.hasGoodMatch && fuzzyResponse.data.bestMatch) {
          const match = fuzzyResponse.data.bestMatch;
          onChange('buyer_id', match.id);
          onChange('buyer_name', match.name);
          console.log(`  ✅ Buyer fuzzy-matched: "${extractedData.parties.importer}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
        } else if (fuzzyResponse.data.matches?.length > 0) {
          const match = fuzzyResponse.data.matches[0];
          onChange('buyer_id', match.id);
          onChange('buyer_name', match.name);
          console.log(`  ✅ Buyer matched (lower confidence): "${extractedData.parties.importer}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
        } else {
          // No match found - use POST which will also do fuzzy matching
          console.log('  🆕 Creating/matching buyer via POST:', extractedData.parties.importer);
          try {
            const createResponse = await apiClient.post('/companies', {
              name: extractedData.parties.importer,
              is_customer: true,
            });
            if (createResponse.data.data?.id) {
              onChange('buyer_id', createResponse.data.data.id);
              onChange('buyer_name', createResponse.data.data.name);
              if (createResponse.data.matched) {
                console.log(`  ✅ Buyer matched via POST: "${createResponse.data.data.name}" (${createResponse.data.matchType})`);
              } else {
                console.log(`  ✅ Buyer created: "${createResponse.data.data.name}"`);
              }
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to create/match buyer:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to fuzzy-match buyer from CI:', err);
        // Fallback to regular search
        try {
          const buyerResponse = await apiClient.get(
            `/companies?search=${encodeURIComponent(extractedData.parties.importer)}&limit=5`
          );
          const companies = buyerResponse.data.data || buyerResponse.data.companies || [];
          if (companies.length > 0) {
            onChange('buyer_id', companies[0].id);
            onChange('buyer_name', companies[0].name);
            console.log('  ✅ Buyer found (fallback):', companies[0].name);
          }
        } catch (fallbackErr) {
          console.warn('  ⚠️ Fallback search also failed:', fallbackErr);
        }
      }
    }

    // 10. Country of Export (from shipping_info)
    if (!formData.country_of_export && extractedData.shipping_info?.country_of_origin) {
      console.log('  🌍 Setting country of export from CI:', extractedData.shipping_info.country_of_origin);
      onChange('country_of_export', extractedData.shipping_info.country_of_origin);
    }
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            ⚡ {t('shipments.wizard.quickStartWithCI', 'Quick Start with Commercial Invoice')}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {t('shipments.wizard.uploadCIHint', 'Upload your Commercial Invoice and let AI extract cargo type, delivery terms, and payment terms automatically.')}
          </p>

          {/* Upload Area */}
          {!uploadedFile && !isExtracting && !extractionResult && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-amber-300 rounded-lg p-6 text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition-all"
            >
              <CloudArrowUpIcon className="h-12 w-12 mx-auto text-amber-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">
                {t('shipments.wizard.clickToUploadCI', 'Click to upload Commercial Invoice')}
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                🤖 {t('shipments.wizard.analyzingCI', 'AI is analyzing your Commercial Invoice...')}
              </p>
              <p className="text-xs text-gray-500">
                {t('shipments.wizard.pleaseWait', 'This usually takes 10-15 seconds')}
              </p>
            </div>
          )}

          {/* Success */}
          {extractionResult && !isExtracting && (
            <div className={`rounded-lg p-4 border ${
              extractionResult.data?.document_info?.data_source === 'fallback'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-start gap-3">
                <CheckCircleIcon className={`h-6 w-6 flex-shrink-0 ${
                  extractionResult.data?.document_info?.data_source === 'fallback'
                    ? 'text-amber-600'
                    : 'text-green-600'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium mb-2 ${
                    extractionResult.data?.document_info?.data_source === 'fallback'
                      ? 'text-amber-800'
                      : 'text-green-800'
                  }`}>
                    {extractionResult.data?.document_info?.data_source === 'fallback'
                      ? `⚠️ ${t('shipments.wizard.ciExtractionFallback', 'Data extracted from alternate source')} (${extractionResult.confidence}% confidence)`
                      : `✅ ${t('shipments.wizard.ciExtractionComplete', 'Commercial Invoice extraction complete!')} (${extractionResult.confidence}% confidence)`
                    }
                  </p>
                  
                  {/* Fallback Warning Banner */}
                  {extractionResult.data?.document_info?.data_source === 'fallback' && (
                    <div className="bg-amber-100 border border-amber-400 rounded-md p-3 mb-3">
                      <p className="text-sm text-amber-900 font-medium">
                        ⚠️ {t('shipments.wizard.noCommercialInvoiceFound', 'No Commercial Invoice found in document')}
                      </p>
                      <p className="text-xs text-amber-800 mt-1">
                        {t('shipments.wizard.fallbackDataWarning', 'Data was extracted from')} {extractionResult.data?.document_info?.fallback_document_type || 'an alternate document'}. 
                        {' '}{t('shipments.wizard.pleaseVerify', 'Please verify the Shipment Number and product details manually.')}
                      </p>
                    </div>
                  )}
                  
                  <p className={`text-xs mb-3 ${
                    extractionResult.data?.document_info?.data_source === 'fallback'
                      ? 'text-amber-700'
                      : 'text-green-700'
                  }`}>
                    {t('shipments.wizard.fieldsAutoFilled', 'Form fields have been auto-filled. Please review and correct if needed.')}
                  </p>
                  {extractionResult.warnings && extractionResult.warnings.length > 0 && (
                    <div className="text-xs text-yellow-700 space-y-1 mb-3">
                      <p className="font-medium">⚠️ {t('shipments.wizard.warnings', 'Warnings')}:</p>
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
                    className="text-xs text-amber-600 hover:text-amber-800"
                  >
                    {t('shipments.wizard.uploadAnother', 'Upload another document')}
                  </button>
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
                    ❌ {t('shipments.wizard.extractionFailed', 'Extraction failed')}
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
                    className="mt-3 text-xs text-amber-600 hover:text-amber-800"
                  >
                    {t('shipments.wizard.tryAgain', 'Try again')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

