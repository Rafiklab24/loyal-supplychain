/**
 * Elleçleme Document Upload
 * Upload and manage documents for an Elleçleme request
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  PhotoIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useElleclemeDocuments, useUploadDocument, useDeleteDocument } from '../../hooks/useEllecleme';
import type { ElleclemeDocument, DocumentType } from '../../services/ellecleme';

interface ElleclemeDocumentUploadProps {
  requestId: string;
  onUpdate?: () => void;
}

const DOCUMENT_TYPES: { value: DocumentType; labelKey: string; icon: any }[] = [
  { value: 'permit_application', labelKey: 'ellecleme.document.types.permit_application', icon: DocumentTextIcon },
  { value: 'permit_approval', labelKey: 'ellecleme.document.types.permit_approval', icon: DocumentTextIcon },
  { value: 'photo_before', labelKey: 'ellecleme.document.types.photo_before', icon: PhotoIcon },
  { value: 'photo_after', labelKey: 'ellecleme.document.types.photo_after', icon: PhotoIcon },
  { value: 'lab_report', labelKey: 'ellecleme.document.types.lab_report', icon: DocumentTextIcon },
  { value: 'tutanak', labelKey: 'ellecleme.document.types.tutanak', icon: DocumentTextIcon },
  { value: 'other', labelKey: 'ellecleme.document.types.other', icon: DocumentTextIcon },
];

export default function ElleclemeDocumentUpload({ requestId, onUpdate }: ElleclemeDocumentUploadProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [selectedType, setSelectedType] = useState<DocumentType>('photo_before');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Data
  const { data: documents, isLoading, refetch } = useElleclemeDocuments(requestId);

  // Mutations
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  // Group documents by type
  const groupedDocuments = documents?.reduce((acc: Record<string, ElleclemeDocument[]>, doc: ElleclemeDocument) => {
    if (!acc[doc.document_type]) {
      acc[doc.document_type] = [];
    }
    acc[doc.document_type].push(doc);
    return acc;
  }, {}) || {};

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('request_id', requestId);
      formData.append('document_type', selectedType);
      if (title) formData.append('title', title);
      if (description) formData.append('description', description);

      await uploadDocument.mutateAsync(formData);
      
      // Reset form
      setTitle('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      refetch();
      onUpdate?.();
    } catch (error) {
      console.error('Error uploading document:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument.mutateAsync(id);
      setDeleteConfirm(null);
      refetch();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const isImage = (mimeType: string | undefined) => {
    return mimeType?.startsWith('image/');
  };

  const getDocumentUrl = (doc: ElleclemeDocument) => {
    // Construct the URL to download/view the document
    return `/api/v1/documents/ellecleme/${doc.id}`;
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Upload Form */}
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h4 className="font-medium text-slate-800 mb-3">
          {t('ellecleme.document.upload', 'Upload Document')}
        </h4>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('ellecleme.document.type', 'Document Type')}
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t(type.labelKey, type.value)}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('common.title', 'Title')} ({t('common.optional', 'Optional')})
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('ellecleme.document.titlePlaceholder', 'Brief title')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t('common.description', 'Description')} ({t('common.optional', 'Optional')})
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('ellecleme.document.descriptionPlaceholder', 'Additional details')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Upload Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            uploading
              ? 'border-blue-300 bg-blue-50'
              : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            accept="image/*,.pdf"
            className="hidden"
            disabled={uploading}
          />
          
          {uploading ? (
            <div>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-sm text-blue-600">{t('common.uploading', 'Uploading...')}</p>
            </div>
          ) : (
            <div>
              <CloudArrowUpIcon className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-1">
                {t('common.dropOrClick', 'Click to upload or drag and drop')}
              </p>
              <p className="text-xs text-slate-400">
                {t('common.fileTypes', 'JPEG, PNG, WebP or PDF (max 10MB)')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      {!documents || documents.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <PhotoIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('ellecleme.empty.noDocuments', 'No documents uploaded')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Before/After Photos Section */}
          {(groupedDocuments['photo_before']?.length > 0 || groupedDocuments['photo_after']?.length > 0) && (
            <div>
              <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                <PhotoIcon className="h-5 w-5 text-slate-500" />
                {t('ellecleme.document.beforeAfterPhotos', 'Before/After Photos')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Before Photos */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
                    {t('ellecleme.document.types.photo_before', 'Before')}
                  </p>
                  <div className="space-y-2">
                    {groupedDocuments['photo_before']?.map((doc: ElleclemeDocument) => (
                      <DocumentCard
                        key={doc.id}
                        document={doc}
                        onDelete={() => setDeleteConfirm(doc.id)}
                        onPreview={() => isImage(doc.mime_type) && setPreviewImage(doc.file_path)}
                      />
                    )) || (
                      <p className="text-sm text-slate-400 italic p-3 bg-slate-50 rounded-lg">
                        {t('common.none', 'None')}
                      </p>
                    )}
                  </div>
                </div>

                {/* After Photos */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
                    {t('ellecleme.document.types.photo_after', 'After')}
                  </p>
                  <div className="space-y-2">
                    {groupedDocuments['photo_after']?.map((doc: ElleclemeDocument) => (
                      <DocumentCard
                        key={doc.id}
                        document={doc}
                        onDelete={() => setDeleteConfirm(doc.id)}
                        onPreview={() => isImage(doc.mime_type) && setPreviewImage(doc.file_path)}
                      />
                    )) || (
                      <p className="text-sm text-slate-400 italic p-3 bg-slate-50 rounded-lg">
                        {t('common.none', 'None')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other Documents */}
          {Object.entries(groupedDocuments)
            .filter(([type]) => !['photo_before', 'photo_after'].includes(type))
            .map(([type, docs]) => (
              <div key={type}>
                <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-slate-500" />
                  {t(`ellecleme.document.types.${type}`, type)}
                </h4>
                <div className="space-y-2">
                  {(docs as ElleclemeDocument[]).map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      onDelete={() => setDeleteConfirm(doc.id)}
                      onPreview={() => isImage(doc.mime_type) && setPreviewImage(doc.file_path)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className={`relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                {t('common.confirmDelete', 'Confirm Delete')}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {t('common.deleteDocumentMessage', 'Are you sure you want to delete this document?')}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleteDocument.isPending}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {deleteDocument.isPending ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl max-h-[90vh] p-4">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Document Card Component
function DocumentCard({
  document,
  onDelete,
  onPreview,
}: {
  document: ElleclemeDocument;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();

  const isImage = document.mime_type?.startsWith('image/');

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {/* Thumbnail or Icon */}
        {isImage ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
            <img
              src={document.file_path}
              alt={document.file_name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <DocumentTextIcon className="h-5 w-5 text-slate-500" />
          </div>
        )}

        {/* Info */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {document.title || document.file_name}
          </p>
          <p className="text-xs text-slate-500">
            {formatFileSize(document.file_size)} • {new Date(document.uploaded_at).toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isImage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={t('common.preview', 'Preview')}
          >
            <EyeIcon className="h-4 w-4" />
          </button>
        )}
        <a
          href={document.file_path}
          download={document.file_name}
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title={t('common.download', 'Download')}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title={t('common.delete', 'Delete')}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
