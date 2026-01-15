/**
 * DocumentPanel Component
 * Inline document viewer/uploader for entity detail pages
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  FolderOpenIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { Spinner } from '../common/Spinner';
import {
  getDocumentsForEntity,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  getDocumentTypeName,
  getDocumentTypeIcon,
  formatFileSize,
  type EntityType,
  type Document,
  type DocumentType,
} from '../../services/documents';

interface DocumentPanelProps {
  entityType: EntityType;
  entityId: string;
  entityRef?: string; // SN, contract_no, etc. for display
  compact?: boolean;
  readOnly?: boolean;
}

export function DocumentPanel({
  entityType,
  entityId,
  entityRef,
  compact = false,
  readOnly = false,
}: DocumentPanelProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('other');
  
  // Fetch documents for this entity
  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: () => getDocumentsForEntity(entityType, entityId),
    enabled: !!entityId,
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
    },
  });
  
  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      await uploadDocument({
        file,
        entity_type: entityType,
        entity_id: entityId,
        doc_type: selectedDocType,
        is_draft: false,
      });
      
      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle download
  const handleDownload = async (doc: Document) => {
    try {
      await downloadDocument(doc.id, doc.original_filename || doc.filename);
    } catch (err) {
      console.error('Download error:', err);
    }
  };
  
  // Handle delete
  const handleDelete = async (doc: Document) => {
    if (!confirm(isRtl ? 'هل أنت متأكد من حذف هذا المستند؟' : 'Are you sure you want to delete this document?')) {
      return;
    }
    
    try {
      await deleteMutation.mutateAsync(doc.id);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };
  
  // Group documents by type, with combined_documents first
  const groupedDocs = documents.reduce((acc, doc) => {
    const type = doc.doc_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);
  
  // Check if there's a combined documents file
  const hasCombinedDocs = !!groupedDocs['combined_documents'];
  
  // Common document types for quick selection
  const commonDocTypes: DocumentType[] = [
    'proforma_invoice',
    'commercial_invoice',
    'packing_list',
    'bill_of_lading',
    'certificate_of_origin',
    'customs_declaration',
    'payment_receipt',
    'e_fatura',
    'combined_documents',
    'other',
  ];
  
  if (compact) {
    // Compact view - just a count and link
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <DocumentTextIcon className="h-4 w-4" />
        <span>{documents.length} {isRtl ? 'مستند' : 'documents'}</span>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FolderOpenIcon className="h-5 w-5 text-blue-600" />
          {isRtl ? 'المستندات' : 'Documents'}
          {documents.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              {documents.length}
            </span>
          )}
        </h3>
        {entityRef && (
          <span className="text-xs text-gray-500">{entityRef}</span>
        )}
      </div>
      
      {/* Upload Section */}
      {!readOnly && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            {/* Document Type Select */}
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500"
            >
              {commonDocTypes.map((type) => (
                <option key={type} value={type}>
                  {getDocumentTypeIcon(type)} {getDocumentTypeName(type, isRtl ? 'ar' : 'en')}
                </option>
              ))}
            </select>
            
            {/* Upload Button */}
            <label className={`
              flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer
              ${isUploading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}>
              {isUploading ? (
                <Spinner size="sm" />
              ) : (
                <CloudArrowUpIcon className="h-4 w-4" />
              )}
              {isRtl ? 'رفع مستند' : 'Upload'}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </label>
          </div>
          
          {uploadError && (
            <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <ExclamationCircleIcon className="h-4 w-4" />
              {uploadError}
            </div>
          )}
        </div>
      )}
      
      {/* Documents List */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center">
            <Spinner size="md" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            {isRtl ? 'فشل في تحميل المستندات' : 'Failed to load documents'}
          </div>
        ) : documents.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">{isRtl ? 'لا توجد مستندات' : 'No documents yet'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Show combined documents first if they exist */}
            {hasCombinedDocs && groupedDocs['combined_documents']?.map((doc) => (
              <div key={doc.id} className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">📚</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.original_filename || doc.filename}
                        </p>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-medium">
                          {isRtl ? 'ملف مجمع' : 'Bundle'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.file_size)}
                        {doc.notes && (
                          <span className="ms-2 text-emerald-600">{doc.notes}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title={isRtl ? 'تحميل' : 'Download'}
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                    {!readOnly && (
                      <button
                        onClick={() => handleDelete(doc)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title={isRtl ? 'حذف' : 'Delete'}
                        disabled={deleteMutation.isPending}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Show other document types */}
            {Object.entries(groupedDocs)
              .filter(([docType]) => docType !== 'combined_documents')
              .map(([docType, docs]) => (
              <div key={docType} className="px-4 py-2">
                <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <span>{getDocumentTypeIcon(docType as DocumentType)}</span>
                  {getDocumentTypeName(docType as DocumentType, isRtl ? 'ar' : 'en')}
                  <span className="text-gray-400">({docs.length})</span>
                </h4>
                <div className="space-y-1">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {doc.original_filename || doc.filename}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(doc.file_size)}
                            {doc.is_draft && (
                              <span className="ms-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px]">
                                {isRtl ? 'مسودة' : 'Draft'}
                              </span>
                            )}
                            {doc.version > 1 && (
                              <span className="ms-2 text-gray-400">v{doc.version}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title={isRtl ? 'تحميل' : 'Download'}
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        {!readOnly && (
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title={isRtl ? 'حذف' : 'Delete'}
                            disabled={deleteMutation.isPending}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer - Show all documents link */}
      {documents.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <button
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={() => {
              // TODO: Navigate to documents page with filter
              console.log('Navigate to documents page');
            }}
          >
            {isRtl ? 'عرض جميع المستندات' : 'View all documents'} →
          </button>
        </div>
      )}
    </div>
  );
}

export default DocumentPanel;

