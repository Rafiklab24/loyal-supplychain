/**
 * Supplier Document Upload Portal
 * Allows suppliers to upload all required documents for a contract/shipment
 * Documents are organized in a grid with individual upload boxes
 */

import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';

// Document types that suppliers need to upload
const SUPPLIER_DOCUMENT_TYPES = [
  {
    id: 'proforma_invoice',
    nameEn: 'Proforma Invoice',
    nameAr: 'الفاتورة الأولية',
    required: true,
    icon: '📄',
  },
  {
    id: 'commercial_invoice',
    nameEn: 'Commercial Invoice',
    nameAr: 'الفاتورة التجارية',
    required: true,
    icon: '🧾',
  },
  {
    id: 'certificate_of_origin',
    nameEn: 'Certificate of Origin',
    nameAr: 'شهادة المنشأ',
    required: true,
    icon: '🌍',
  },
  {
    id: 'bill_of_lading',
    nameEn: 'Bill of Lading (B/L)',
    nameAr: 'بوليصة الشحن',
    required: true,
    icon: '🚢',
  },
  {
    id: 'packing_list',
    nameEn: 'Packing List',
    nameAr: 'قائمة التعبئة',
    required: true,
    icon: '📦',
  },
  {
    id: 'phytosanitary_certificate',
    nameEn: 'Phytosanitary Certificate',
    nameAr: 'الشهادة الصحية النباتية',
    required: true,
    icon: '🌿',
  },
  {
    id: 'fumigation_certificate',
    nameEn: 'Fumigation Certificate',
    nameAr: 'شهادة التبخير',
    required: true,
    icon: '💨',
  },
  {
    id: 'health_certificate',
    nameEn: 'Health Certificate',
    nameAr: 'الشهادة الصحية',
    required: false,
    icon: '🏥',
  },
  {
    id: 'quality_certificate',
    nameEn: 'Quality Certificate',
    nameAr: 'شهادة الجودة',
    required: false,
    icon: '✅',
  },
  {
    id: 'certificate_of_analysis',
    nameEn: 'Certificate of Analysis',
    nameAr: 'شهادة التحليل',
    required: false,
    icon: '🔬',
  },
  {
    id: 'insurance_certificate',
    nameEn: 'Insurance Certificate',
    nameAr: 'شهادة التأمين',
    required: false,
    icon: '🛡️',
  },
  {
    id: 'inspection_certificate',
    nameEn: 'Inspection Certificate',
    nameAr: 'شهادة المعاينة',
    required: false,
    icon: '🔍',
  },
];

interface UploadedDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  url?: string;
}

export function SupplierDocumentUploadPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();

  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, UploadedDocument>>({});
  const [uploadingDocs, setUploadingDocs] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Handle file selection
  const handleFileSelect = async (documentType: string, file: File) => {
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

    // Set uploading state
    setUploadingDocs(prev => ({ ...prev, [documentType]: true }));

    try {
      // TODO: Replace with actual API call
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // For now, create a local URL
      const fileUrl = URL.createObjectURL(file);

      const uploadedDoc: UploadedDocument = {
        id: `${documentType}-${Date.now()}`,
        documentType,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date(),
        url: fileUrl,
      };

      setUploadedDocuments(prev => ({ ...prev, [documentType]: uploadedDoc }));
      
      // Show success message
      alert(t('documents.uploadSuccess', 'Document uploaded successfully!'));
    } catch (error) {
      console.error('Error uploading document:', error);
      alert(t('documents.uploadError', 'Failed to upload document. Please try again.'));
    } finally {
      setUploadingDocs(prev => ({ ...prev, [documentType]: false }));
    }
  };

  // Handle file input click
  const handleUploadClick = (documentType: string) => {
    fileInputRefs.current[documentType]?.click();
  };

  // Remove uploaded document
  const handleRemoveDocument = (documentType: string) => {
    if (confirm(t('documents.confirmRemove', 'Are you sure you want to remove this document?'))) {
      setUploadedDocuments(prev => {
        const updated = { ...prev };
        delete updated[documentType];
        return updated;
      });
    }
  };

  // Submit all documents
  const handleSubmitAll = async () => {
    // Check if all required documents are uploaded
    const missingRequired = SUPPLIER_DOCUMENT_TYPES
      .filter(doc => doc.required && !uploadedDocuments[doc.id])
      .map(doc => isRtl ? doc.nameAr : doc.nameEn);

    if (missingRequired.length > 0) {
      alert(
        `${t('documents.missingRequired', 'Missing required documents')}:\n${missingRequired.join('\n')}`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call to submit all documents
      await new Promise(resolve => setTimeout(resolve, 2000));

      alert(t('documents.submitSuccess', 'All documents submitted successfully! Customs department has been notified.'));
      
      // Navigate back or to confirmation page
      // navigate(`/contracts/${contractId}`);
    } catch (error) {
      console.error('Error submitting documents:', error);
      alert(t('documents.submitError', 'Failed to submit documents. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate progress
  const requiredDocsCount = SUPPLIER_DOCUMENT_TYPES.filter(doc => doc.required).length;
  const uploadedRequiredCount = SUPPLIER_DOCUMENT_TYPES.filter(
    doc => doc.required && uploadedDocuments[doc.id]
  ).length;
  const progressPercentage = (uploadedRequiredCount / requiredDocsCount) * 100;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('documents.supplierPortal', 'Supplier Document Upload Portal')}
            </h1>
            <p className="text-gray-600">
              {t('documents.uploadInstructions', 'Upload all required documents for contract')} #{contractId || 'N/A'}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            ✕ {t('common.close', 'Close')}
          </button>
        </div>

        {/* Progress Bar */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
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
              <p className="mt-3 text-sm text-green-600 font-medium flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />
                {t('documents.allRequiredUploaded', 'All required documents uploaded!')}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Document Upload Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {SUPPLIER_DOCUMENT_TYPES.map((docType) => {
          const isUploaded = !!uploadedDocuments[docType.id];
          const isUploading = uploadingDocs[docType.id];
          const uploadedDoc = uploadedDocuments[docType.id];

          return (
            <div
              key={docType.id}
              className={`
                relative border-2 rounded-xl p-6 transition-all duration-300
                ${isUploaded 
                  ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50' 
                  : docType.required 
                  ? 'border-red-300 bg-gradient-to-br from-red-50 to-orange-50'
                  : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-lg'
                }
              `}
            >
              {/* Required Badge */}
              {docType.required && !isUploaded && (
                <div className="absolute top-3 right-3">
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {t('documents.required', 'Required')}
                  </span>
                </div>
              )}

              {/* Upload Status Badge */}
              {isUploaded && (
                <div className="absolute top-3 right-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
              )}

              {/* Document Icon & Name */}
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">{docType.icon}</div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {isRtl ? docType.nameAr : docType.nameEn}
                </h3>
              </div>

              {/* Upload Status */}
              {isUploading ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <Spinner size="md" />
                  <p className="text-sm text-gray-600 mt-2">
                    {t('documents.uploading', 'Uploading...')}
                  </p>
                </div>
              ) : isUploaded ? (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-xs font-medium text-gray-900 truncate mb-1">
                      {uploadedDoc.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(uploadedDoc.fileSize / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUploadClick(docType.id)}
                      className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {t('documents.replace', 'Replace')}
                    </button>
                    <button
                      onClick={() => handleRemoveDocument(docType.id)}
                      className="px-3 py-2 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleUploadClick(docType.id)}
                  className={`
                    w-full py-4 rounded-lg border-2 border-dashed transition-all
                    ${docType.required 
                      ? 'border-red-300 hover:border-red-500 hover:bg-red-50' 
                      : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                    }
                  `}
                >
                  <CloudArrowUpIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">
                    {t('documents.clickToUpload', 'Click to Upload')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, JPG, PNG (max 10MB)
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

      {/* Submit Button */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-lg"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleSubmitAll}
          disabled={progressPercentage < 100 || isSubmitting}
          className={`
            px-12 py-4 rounded-xl font-semibold text-lg transition-all
            ${progressPercentage === 100
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" />
              {t('documents.submitting', 'Submitting...')}
            </span>
          ) : (
            <>
              ✓ {t('documents.submitToCustoms', 'Submit to Customs Department')}
            </>
          )}
        </button>
      </div>

      {/* Information Box */}
      <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">
              {t('documents.importantNote', 'Important Note')}
            </h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>{t('documents.note1', 'All required documents must be uploaded before submission')}</li>
              <li>{t('documents.note2', 'Documents should be clear, legible, and properly attested if required')}</li>
              <li>{t('documents.note3', 'Once submitted, documents will be forwarded to the customs department')}</li>
              <li>{t('documents.note4', 'Customs broker will be notified automatically')}</li>
              <li>{t('documents.note5', 'You can replace documents anytime before final submission')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupplierDocumentUploadPage;

