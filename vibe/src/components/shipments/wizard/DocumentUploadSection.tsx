import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentArrowUpIcon, XMarkIcon, DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { ShipmentDocument, DocumentType } from './types';

interface DocumentUploadSectionProps {
  direction: 'incoming' | 'outgoing';
  documents: ShipmentDocument[];
  onChange: (documents: ShipmentDocument[]) => void;
}

export function DocumentUploadSection({ direction, documents, onChange }: DocumentUploadSectionProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<DocumentType>('commercial_invoice');
  const [documentNotes, setDocumentNotes] = useState('');

  // Document types based on direction
  const getDocumentTypes = (): { value: DocumentType; label: string; category: string }[] => {
    const commonDocs = [
      { value: 'proforma_invoice' as DocumentType, label: t('documents.types.proforma_invoice', 'Proforma Invoice'), category: 'Common' },
      { value: 'commercial_invoice' as DocumentType, label: t('documents.types.commercial_invoice', 'Commercial Invoice'), category: 'Common' },
      { value: 'packing_list' as DocumentType, label: t('documents.types.packing_list', 'Packing List'), category: 'Common' },
      { value: 'bill_of_lading' as DocumentType, label: t('documents.types.bill_of_lading', 'Bill of Lading'), category: 'Common' },
      { value: 'certificate_of_origin' as DocumentType, label: t('documents.types.certificate_of_origin', 'Certificate of Origin'), category: 'Common' },
      { value: 'product_specification' as DocumentType, label: t('documents.types.product_specification', 'Product Specification'), category: 'Common' },
    ];

    const buyingDocs = [
      { value: 'purchase_order' as DocumentType, label: t('documents.types.purchase_order', 'Purchase Order'), category: 'Import/Buying' },
      { value: 'import_license' as DocumentType, label: t('documents.types.import_license', 'Import License'), category: 'Import/Buying' },
      { value: 'customs_declaration' as DocumentType, label: t('documents.types.customs_declaration', 'Customs Declaration'), category: 'Import/Buying' },
      { value: 'goods_receipt_note' as DocumentType, label: t('documents.types.goods_receipt_note', 'Goods Receipt Note'), category: 'Import/Buying' },
    ];

    const sellingDocs = [
      { value: 'sales_contract' as DocumentType, label: t('documents.types.sales_contract', 'Sales Contract'), category: 'Export/Selling' },
      { value: 'export_license' as DocumentType, label: t('documents.types.export_license', 'Export License'), category: 'Export/Selling' },
      { value: 'shipping_instructions' as DocumentType, label: t('documents.types.shipping_instructions', 'Shipping Instructions'), category: 'Export/Selling' },
    ];

    const qualityDocs = [
      { value: 'health_certificate' as DocumentType, label: t('documents.types.health_certificate', 'Health Certificate'), category: 'Quality & Compliance' },
      { value: 'phytosanitary_certificate' as DocumentType, label: t('documents.types.phytosanitary_certificate', 'Phytosanitary Certificate'), category: 'Quality & Compliance' },
      { value: 'fumigation_certificate' as DocumentType, label: t('documents.types.fumigation_certificate', 'Fumigation Certificate'), category: 'Quality & Compliance' },
      { value: 'quality_certificate' as DocumentType, label: t('documents.types.quality_certificate', 'Quality Certificate'), category: 'Quality & Compliance' },
      { value: 'certificate_of_analysis' as DocumentType, label: t('documents.types.certificate_of_analysis', 'Certificate of Analysis'), category: 'Quality & Compliance' },
      { value: 'halal_certificate' as DocumentType, label: t('documents.types.halal_certificate', 'Halal Certificate'), category: 'Quality & Compliance' },
      { value: 'insurance_certificate' as DocumentType, label: t('documents.types.insurance_certificate', 'Insurance Certificate'), category: 'Quality & Compliance' },
    ];

    const financialDocs = [
      { value: 'letter_of_credit' as DocumentType, label: t('documents.types.letter_of_credit', 'Letter of Credit'), category: 'Financial' },
      { value: 'bank_guarantee' as DocumentType, label: t('documents.types.bank_guarantee', 'Bank Guarantee'), category: 'Financial' },
      { value: 'payment_receipt' as DocumentType, label: t('documents.types.payment_receipt', 'Payment Receipt'), category: 'Financial' },
    ];

    const otherDocs = [
      { value: 'other' as DocumentType, label: t('documents.types.other', 'Other'), category: 'Other' },
    ];

    if (direction === 'incoming') {
      return [...commonDocs, ...buyingDocs, ...qualityDocs, ...financialDocs, ...otherDocs];
    } else {
      return [...commonDocs, ...sellingDocs, ...qualityDocs, ...financialDocs, ...otherDocs];
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!validTypes.includes(file.type)) {
        alert(t('documents.invalidFileType', 'Please upload images, PDF, Word, or Excel files only'));
        return;
      }

      // Check file size (max 20MB)
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(t('documents.fileTooLarge', 'File size must be less than 20MB'));
        return;
      }

      const newDocument: ShipmentDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: selectedType,
        file: file,
        fileName: file.name,
        uploadDate: new Date().toISOString(),
        notes: documentNotes,
      };

      onChange([...documents, newDocument]);
      setDocumentNotes('');
      // Reset file input
      e.target.value = '';
    }
  };

  const handleRemoveDocument = (id: string) => {
    onChange(documents.filter(doc => doc.id !== id));
  };

  const getDocumentTypeLabel = (type: DocumentType): string => {
    const docTypes = getDocumentTypes();
    return docTypes.find(dt => dt.value === type)?.label || type;
  };

  // Group documents by category for display
  const groupedDocs = documents.reduce((acc, doc) => {
    const typeInfo = getDocumentTypes().find(dt => dt.value === doc.type);
    const category = typeInfo?.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, ShipmentDocument[]>);

  return (
    <div className="border-t pt-6 mt-6">
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-900 mb-2">
          📄 {t('documents.title', 'Shipment Documents')}
        </h4>
        <p className="text-xs text-gray-500">
          {direction === 'incoming' 
            ? t('documents.buyerHint', 'Upload documents you receive from the supplier')
            : t('documents.sellerHint', 'Upload documents you need to provide to the customer')}
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Document Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('documents.documentType', 'Document Type')}
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {getDocumentTypes().map((docType, idx, arr) => {
                const showCategory = idx === 0 || arr[idx - 1].category !== docType.category;
                return (
                  <optgroup key={docType.value} label={showCategory ? docType.category : undefined}>
                    <option value={docType.value}>{docType.label}</option>
                  </optgroup>
                );
              })}
            </select>
          </div>

          {/* Document Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('documents.notes', 'Notes')} ({t('common.optional', 'Optional')})
            </label>
            <input
              type="text"
              value={documentNotes}
              onChange={(e) => setDocumentNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('documents.notesPlaceholder', 'e.g., Revision 2, Final version')}
            />
          </div>
        </div>

        {/* File Upload */}
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
          <div className="flex flex-col items-center justify-center">
            <DocumentArrowUpIcon className="w-8 h-8 text-blue-600 mb-1" />
            <p className="text-sm text-blue-700 font-medium">
              <PlusIcon className="w-4 h-4 inline me-1" />
              {t('documents.uploadFile', 'Upload Document')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('documents.supportedFormats', 'PDF, Images, Word, Excel (max 20MB)')}
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* Uploaded Documents List */}
      {documents.length > 0 ? (
        <div className="space-y-4">
          {Object.keys(groupedDocs).sort().map(category => (
            <div key={category} className="border border-gray-200 rounded-lg p-3">
              <h5 className="text-sm font-semibold text-gray-700 mb-2">{category}</h5>
              <div className="space-y-2">
                {groupedDocs[category].map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <DocumentTextIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getDocumentTypeLabel(doc.type)}
                          {doc.notes && ` • ${doc.notes}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {doc.file ? `${(doc.file.size / 1024 / 1024).toFixed(2)} MB` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                      aria-label={t('common.remove', 'Remove')}
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {t('documents.noDocuments', 'No documents uploaded yet')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {t('documents.uploadHint', 'Select a document type and upload files above')}
          </p>
        </div>
      )}
    </div>
  );
}

