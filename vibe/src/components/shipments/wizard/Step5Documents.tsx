/**
 * Step 5: Document Upload
 * Integrated document upload into the shipment wizard
 * Supports both separate per-document uploads AND combined single-file upload
 */

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  XMarkIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import type { 
  StepProps, 
  ShipmentDocument, 
  DocumentType, 
  DocumentUploadMode,
  CombinedDocumentBundle 
} from './types';
import { BeyanameSection } from './BeyanameSection';
import { CertificateGeneration } from './CertificateGeneration';

// Document types configuration (same as supplier portal)
interface DocumentTypeConfig {
  id: DocumentType;
  nameEn: string;
  nameAr: string;
  required: boolean;
  icon: string;
  forDirection: 'both' | 'incoming' | 'outgoing'; // Which shipment direction needs this
}

const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  // Common documents (both buyer and seller)
  {
    id: 'proforma_invoice',
    nameEn: 'Proforma Invoice',
    nameAr: 'الفاتورة الأولية',
    required: true,
    icon: '📄',
    forDirection: 'both',
  },
  {
    id: 'commercial_invoice',
    nameEn: 'Commercial Invoice',
    nameAr: 'الفاتورة التجارية',
    required: true,
    icon: '🧾',
    forDirection: 'both',
  },
  {
    id: 'packing_list',
    nameEn: 'Packing List',
    nameAr: 'قائمة التعبئة',
    required: true,
    icon: '📦',
    forDirection: 'both',
  },
  {
    id: 'bill_of_lading',
    nameEn: 'Bill of Lading (B/L)',
    nameAr: 'بوليصة الشحن',
    required: true,
    icon: '🚢',
    forDirection: 'both',
  },
  {
    id: 'certificate_of_origin',
    nameEn: 'Certificate of Origin',
    nameAr: 'شهادة المنشأ',
    required: true,
    icon: '🌍',
    forDirection: 'both',
  },
  // Quality & Compliance
  {
    id: 'phytosanitary_certificate',
    nameEn: 'Phytosanitary Certificate',
    nameAr: 'الشهادة الصحية النباتية',
    required: true,
    icon: '🌿',
    forDirection: 'both',
  },
  {
    id: 'fumigation_certificate',
    nameEn: 'Fumigation Certificate',
    nameAr: 'شهادة التبخير',
    required: true,
    icon: '💨',
    forDirection: 'both',
  },
  {
    id: 'health_certificate',
    nameEn: 'Health Certificate',
    nameAr: 'الشهادة الصحية',
    required: false,
    icon: '🏥',
    forDirection: 'both',
  },
  {
    id: 'quality_certificate',
    nameEn: 'Quality Certificate',
    nameAr: 'شهادة الجودة',
    required: false,
    icon: '✅',
    forDirection: 'both',
  },
  {
    id: 'certificate_of_analysis',
    nameEn: 'Certificate of Analysis',
    nameAr: 'شهادة التحليل',
    required: false,
    icon: '🔬',
    forDirection: 'both',
  },
  {
    id: 'insurance_certificate',
    nameEn: 'Insurance Certificate',
    nameAr: 'شهادة التأمين',
    required: false,
    icon: '🛡️',
    forDirection: 'both',
  },
  // Import documents (buyer)
  {
    id: 'purchase_order',
    nameEn: 'Purchase Order',
    nameAr: 'أمر الشراء',
    required: false,
    icon: '📝',
    forDirection: 'incoming',
  },
  {
    id: 'import_license',
    nameEn: 'Import License',
    nameAr: 'رخصة الاستيراد',
    required: false,
    icon: '📑',
    forDirection: 'incoming',
  },
  {
    id: 'customs_declaration',
    nameEn: 'Customs Declaration',
    nameAr: 'البيان الجمركي',
    required: false,
    icon: '🛃',
    forDirection: 'incoming',
  },
  // Export documents (seller)
  {
    id: 'sales_contract',
    nameEn: 'Sales Contract',
    nameAr: 'عقد البيع',
    required: false,
    icon: '📋',
    forDirection: 'outgoing',
  },
  {
    id: 'export_license',
    nameEn: 'Export License',
    nameAr: 'رخصة التصدير',
    required: false,
    icon: '📜',
    forDirection: 'outgoing',
  },
  // Financial
  {
    id: 'letter_of_credit',
    nameEn: 'Letter of Credit',
    nameAr: 'خطاب الاعتماد',
    required: false,
    icon: '💳',
    forDirection: 'both',
  },
  {
    id: 'payment_receipt',
    nameEn: 'Payment Receipt',
    nameAr: 'إيصال الدفع',
    required: false,
    icon: '🧾',
    forDirection: 'both',
  },
];

export function Step5Documents({ formData, onChange }: StepProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const fileInputRefs = useRef<Record<DocumentType, HTMLInputElement | null>>({} as any);
  const combinedFileInputRef = useRef<HTMLInputElement | null>(null);
  
  // State for combined upload mode - doc types tagging (optional)
  const [selectedContainedTypes, setSelectedContainedTypes] = useState<DocumentType[]>([]);
  const [showDocTypeSelector, setShowDocTypeSelector] = useState(false);

  // Get upload mode from form data (default to 'separate')
  const uploadMode: DocumentUploadMode = formData.documentUploadMode || 'separate';

  // Filter documents based on shipment direction
  const relevantDocTypes = DOCUMENT_TYPES.filter(
    (doc) => doc.forDirection === 'both' || doc.forDirection === formData.transaction_type
  );

  // Handle upload mode change
  const handleModeChange = (mode: DocumentUploadMode) => {
    onChange('documentUploadMode', mode);
    // Don't clear documents when switching - user might want to go back
  };

  // ========== SEPARATE MODE HANDLERS ==========

  // Handle file selection for separate mode
  const handleFileSelect = (documentType: DocumentType, file: File) => {
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert(t('documents.fileTooLarge', 'File size must be less than 10MB'));
      return;
    }

    // Validate file type (PDF, images, Word docs)
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      alert(t('documents.invalidFileType', 'Only PDF, images, and Word documents are allowed'));
      return;
    }

    // Check if document already exists
    const existingIndex = formData.documents.findIndex((doc) => doc.type === documentType);

    const newDocument: ShipmentDocument = {
      id: `${documentType}-${Date.now()}`,
      type: documentType,
      file,
      fileName: file.name,
      uploadDate: new Date().toISOString(),
      notes: '',
    };

    if (existingIndex >= 0) {
      // Replace existing document
      const updatedDocuments = [...formData.documents];
      updatedDocuments[existingIndex] = newDocument;
      onChange('documents', updatedDocuments);
    } else {
      // Add new document
      onChange('documents', [...formData.documents, newDocument]);
    }
  };

  // Handle file input click
  const handleUploadClick = (documentType: DocumentType) => {
    fileInputRefs.current[documentType]?.click();
  };

  // Remove uploaded document
  const handleRemoveDocument = (documentType: DocumentType) => {
    if (confirm(t('documents.confirmRemove', 'Are you sure you want to remove this document?'))) {
      const updatedDocuments = formData.documents.filter((doc) => doc.type !== documentType);
      onChange('documents', updatedDocuments);
    }
  };

  // Get uploaded document for a specific type
  const getUploadedDocument = (documentType: DocumentType): ShipmentDocument | undefined => {
    return formData.documents.find((doc) => doc.type === documentType);
  };

  // ========== COMBINED MODE HANDLERS ==========

  // Handle combined file selection
  const handleCombinedFileSelect = (file: File) => {
    if (!file) return;

    // Validate file size (max 50MB for combined file)
    if (file.size > 50 * 1024 * 1024) {
      alert(isRtl 
        ? 'حجم الملف كبير جداً. الحد الأقصى 50 ميغابايت.' 
        : 'File too large. Maximum size is 50MB.');
      return;
    }

    // Validate file type (prefer PDF for combined)
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      alert(t('documents.invalidFileType', 'Only PDF, images, and Word documents are allowed'));
      return;
    }

    const bundle: CombinedDocumentBundle = {
      file,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadDate: new Date().toISOString(),
      containedDocTypes: selectedContainedTypes,
      notes: '',
    };

    onChange('combinedDocumentBundle', bundle);
  };

  // Handle combined file removal
  const handleRemoveCombinedFile = () => {
    if (confirm(isRtl 
      ? 'هل أنت متأكد من حذف ملف المستندات الكامل؟' 
      : 'Are you sure you want to remove the combined documents file?')) {
      onChange('combinedDocumentBundle', null);
      setSelectedContainedTypes([]);
    }
  };

  // Toggle contained document type
  const toggleContainedType = (docType: DocumentType) => {
    const updated = selectedContainedTypes.includes(docType)
      ? selectedContainedTypes.filter(t => t !== docType)
      : [...selectedContainedTypes, docType];
    setSelectedContainedTypes(updated);
    
    // Update bundle if it exists
    if (formData.combinedDocumentBundle) {
      onChange('combinedDocumentBundle', {
        ...formData.combinedDocumentBundle,
        containedDocTypes: updated,
      });
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Calculate progress for separate mode
  const requiredDocsCount = relevantDocTypes.filter((doc) => doc.required).length;
  const uploadedRequiredCount = relevantDocTypes.filter(
    (doc) => doc.required && getUploadedDocument(doc.id)
  ).length;
  const progressPercentage = requiredDocsCount > 0 ? (uploadedRequiredCount / requiredDocsCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <DocumentTextIcon className="h-8 w-8 text-blue-600" />
        <div>
          <h3 className="text-2xl font-bold text-gray-900">
            {isRtl ? 'رفع المستندات' : 'Document Upload'}
          </h3>
          <p className="text-sm text-gray-600">
            {isRtl 
              ? 'قم بتحميل المستندات المطلوبة لهذه الشحنة' 
              : 'Upload required documents for this shipment'}
          </p>
        </div>
      </div>

      {/* ========== UPLOAD MODE TOGGLE ========== */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <DocumentDuplicateIcon className="h-5 w-5 text-indigo-600" />
          {isRtl ? 'طريقة رفع المستندات' : 'Document Upload Method'}
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Separate Upload Option */}
          <button
            type="button"
            onClick={() => handleModeChange('separate')}
            className={`
              relative p-4 rounded-lg border-2 text-start transition-all duration-200
              ${uploadMode === 'separate'
                ? 'border-indigo-500 bg-white shadow-md ring-2 ring-indigo-200'
                : 'border-gray-200 bg-white/50 hover:border-indigo-300 hover:bg-white'
              }
            `}
          >
            {uploadMode === 'separate' && (
              <div className="absolute top-3 end-3">
                <CheckCircleIcon className="h-6 w-6 text-indigo-600" />
              </div>
            )}
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${uploadMode === 'separate' ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                <DocumentDuplicateIcon className={`h-6 w-6 ${uploadMode === 'separate' ? 'text-indigo-600' : 'text-gray-500'}`} />
              </div>
              <span className={`font-medium ${uploadMode === 'separate' ? 'text-indigo-900' : 'text-gray-700'}`}>
                {isRtl ? 'رفع كل مستند بشكل منفصل' : 'Upload Each Document Separately'}
              </span>
            </div>
            <p className="text-xs text-gray-500 ps-11">
              {isRtl 
                ? 'اختر ملف لكل نوع من المستندات المطلوبة' 
                : 'Select a file for each required document type'}
            </p>
          </button>

          {/* Combined Upload Option */}
          <button
            type="button"
            onClick={() => handleModeChange('combined')}
            className={`
              relative p-4 rounded-lg border-2 text-start transition-all duration-200
              ${uploadMode === 'combined'
                ? 'border-emerald-500 bg-white shadow-md ring-2 ring-emerald-200'
                : 'border-gray-200 bg-white/50 hover:border-emerald-300 hover:bg-white'
              }
            `}
          >
            {uploadMode === 'combined' && (
              <div className="absolute top-3 end-3">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
              </div>
            )}
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${uploadMode === 'combined' ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <DocumentTextIcon className={`h-6 w-6 ${uploadMode === 'combined' ? 'text-emerald-600' : 'text-gray-500'}`} />
              </div>
              <span className={`font-medium ${uploadMode === 'combined' ? 'text-emerald-900' : 'text-gray-700'}`}>
                {isRtl ? 'رفع كامل المستندات في ملف واحد' : 'Upload All Documents in One File'}
              </span>
            </div>
            <p className="text-xs text-gray-500 ps-11">
              {isRtl 
                ? 'ارفع ملف PDF واحد يحتوي على جميع المستندات' 
                : 'Upload a single PDF containing all documents'}
            </p>
          </button>
        </div>
      </div>

      {/* ========== COMBINED MODE UI ========== */}
      {uploadMode === 'combined' && (
        <div className="space-y-4">
          {/* Helper Message */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              💡 {isRtl 
                ? 'يفضل رفع ملف PDF واحد يحتوي على جميع المستندات المطلوبة. يمكنك أيضاً تحديد أنواع المستندات المتضمنة (اختياري).'
                : 'It is recommended to upload a single PDF file containing all required documents. You can optionally specify which document types are included.'}
            </p>
          </div>

          {/* Combined File Uploader */}
          {!formData.combinedDocumentBundle ? (
            <div
              onClick={() => combinedFileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 rounded-xl p-8 bg-gradient-to-br from-emerald-50 to-teal-50 hover:border-emerald-500 hover:bg-emerald-100/50 cursor-pointer transition-all duration-300"
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                  <CloudArrowUpIcon className="h-8 w-8 text-emerald-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {isRtl ? 'ملف المستندات الكامل' : 'Combined Documents File'}
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  {isRtl 
                    ? 'اضغط لاختيار ملف PDF يحتوي على جميع المستندات' 
                    : 'Click to select a PDF containing all documents'}
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                  <CloudArrowUpIcon className="h-5 w-5" />
                  <span className="font-medium">
                    {isRtl ? 'اختر الملف' : 'Select File'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  PDF, JPG, PNG, DOCX • {isRtl ? 'الحد الأقصى 50 ميغابايت' : 'Max 50MB'}
                </p>
              </div>
              <input
                ref={combinedFileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCombinedFileSelect(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            /* Combined File Preview */
            <div className="border-2 border-emerald-400 rounded-xl p-6 bg-gradient-to-br from-emerald-50 to-teal-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">📚</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1 truncate">
                      {formData.combinedDocumentBundle.fileName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {formatFileSize(formData.combinedDocumentBundle.fileSize)}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span>
                        {new Date(formData.combinedDocumentBundle.uploadDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-GB')}
                      </span>
                    </div>
                    {formData.combinedDocumentBundle.containedDocTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {formData.combinedDocumentBundle.containedDocTypes.map(type => {
                          const docConfig = DOCUMENT_TYPES.find(d => d.id === type);
                          return (
                            <span 
                              key={type}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/70 text-gray-700 rounded text-xs"
                            >
                              <span>{docConfig?.icon}</span>
                              {isRtl ? docConfig?.nameAr : docConfig?.nameEn}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Preview button - only for PDFs */}
                  {formData.combinedDocumentBundle.mimeType === 'application/pdf' && formData.combinedDocumentBundle.file && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.combinedDocumentBundle?.file) {
                          const url = URL.createObjectURL(formData.combinedDocumentBundle.file);
                          window.open(url, '_blank');
                        }
                      }}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={isRtl ? 'معاينة' : 'Preview'}
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                  )}
                  {/* Replace button */}
                  <button
                    type="button"
                    onClick={() => combinedFileInputRef.current?.click()}
                    className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title={isRtl ? 'استبدال' : 'Replace'}
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                  </button>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={handleRemoveCombinedFile}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={isRtl ? 'حذف' : 'Remove'}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Hidden input for replace */}
              <input
                ref={combinedFileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCombinedFileSelect(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {/* Optional: Document Types Selector */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDocTypeSelector(!showDocTypeSelector)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 text-start flex items-center justify-between transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                {isRtl ? 'تحديد أنواع المستندات المتضمنة (اختياري)' : 'Specify Included Document Types (Optional)'}
              </span>
              <span className={`transform transition-transform ${showDocTypeSelector ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {showDocTypeSelector && (
              <div className="p-4 bg-white border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-3">
                  {isRtl 
                    ? 'حدد المستندات المتضمنة في الملف لتسهيل البحث والمراجعة لاحقاً'
                    : 'Check which documents are included in the file for easier search and review later'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {relevantDocTypes.map(docType => (
                    <label
                      key={docType.id}
                      className={`
                        flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                        ${selectedContainedTypes.includes(docType.id)
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={selectedContainedTypes.includes(docType.id)}
                        onChange={() => toggleContainedType(docType.id)}
                        className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm flex items-center gap-1">
                        <span>{docType.icon}</span>
                        {isRtl ? docType.nameAr : docType.nameEn}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== SEPARATE MODE UI ========== */}
      {uploadMode === 'separate' && (
        <>
          {/* Progress Bar */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {t('documents.uploadProgress', 'Upload Progress')}
              </span>
              <span className="text-sm font-semibold text-blue-600">
                {uploadedRequiredCount} / {requiredDocsCount} {t('documents.required', 'Required')}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-600 to-green-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            {progressPercentage === 100 && (
              <p className="mt-2 text-sm text-green-600 font-medium flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />
                {t('documents.allRequiredUploaded', 'All required documents uploaded!')}
              </p>
            )}
          </div>

          {/* Document Upload Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relevantDocTypes.map((docType) => {
              const uploadedDoc = getUploadedDocument(docType.id);
              const isUploaded = !!uploadedDoc;

              return (
                <div
                  key={docType.id}
                  className={`
                    relative border-2 rounded-lg p-4 transition-all duration-300
                    ${isUploaded
                      ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50'
                      : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
                    }
                  `}
                >

                  {/* Upload Status Badge */}
                  {isUploaded && (
                    <div className="absolute top-2 right-2">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    </div>
                  )}

                  {/* Document Icon & Name */}
                  <div className="text-center mb-3">
                    <div className="text-4xl mb-2">{docType.icon}</div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      {isRtl ? docType.nameAr : docType.nameEn}
                    </h4>
                  </div>

                  {/* Upload Status */}
                  {isUploaded ? (
                    <div className="space-y-2">
                      <div className="bg-white rounded-md p-2 border border-green-200">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {uploadedDoc.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {uploadedDoc.file ? `${(uploadedDoc.file.size / 1024).toFixed(0)} KB` : 'Uploaded'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUploadClick(docType.id)}
                          className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          {t('documents.replace', 'Replace')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(docType.id)}
                          className="px-2 py-1.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUploadClick(docType.id)}
                      className={`
                        w-full py-3 rounded-md border-2 border-dashed transition-all
                        ${docType.required
                          ? 'border-red-300 hover:border-red-500 hover:bg-red-50'
                          : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                        }
                      `}
                    >
                      <CloudArrowUpIcon className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                      <p className="text-xs font-medium text-gray-700">
                        {t('documents.clickToUpload', 'Click to Upload')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        PDF, JPG, PNG
                      </p>
                    </button>
                  )}

                  {/* Hidden File Input */}
                  <input
                    ref={(el) => {
                      fileInputRefs.current[docType.id] = el;
                    }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(docType.id, file);
                      }
                      e.target.value = ''; // Reset input
                    }}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Selling Workflow Sections - Only show for outgoing (sales) shipments */}
      {formData.transaction_type === 'outgoing' && (
        <>
          {/* Beyaname Section */}
          <BeyanameSection 
            formData={formData} 
            onChange={onChange} 
          />

          {/* Certificate Generation */}
          <CertificateGeneration 
            formData={formData}
            onChange={onChange}
          />
        </>
      )}

      {/* Informational Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 {isRtl 
            ? 'يمكنك تخطي هذه الخطوة ورفع المستندات لاحقاً، لكن يجب رفع جميع المستندات المطلوبة قبل بدء التخليص الجمركي.'
            : 'You can skip this step and upload documents later, but all required documents must be uploaded before customs clearance can begin.'}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2 text-sm">
          📋 {t('documents.importantNote', 'Important Note')}
        </h4>
        <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
          <li>{t('documents.note2', 'Documents should be clear, legible, and properly attested if required')}</li>
          <li>{t('documents.note5', 'You can replace documents anytime before final submission')}</li>
          <li>{t('shipments.wizard.documentsNote', 'Missing documents can be uploaded later from the shipment detail page')}</li>
        </ul>
      </div>
    </div>
  );
}
