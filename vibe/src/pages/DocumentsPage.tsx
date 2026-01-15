/**
 * DocumentsPage - Central Documents Browser
 * List all documents with filters, search, and bulk actions
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { DocumentPermissionsModal } from '../components/documents/DocumentPermissionsModal';
import {
  listDocuments,
  downloadDocument,
  deleteDocument,
  getDocumentTypeName,
  getDocumentTypeIcon,
  formatFileSize,
  type Document,
  type DocumentType,
} from '../services/documents';

const DOC_TYPE_OPTIONS: DocumentType[] = [
  'proforma_invoice',
  'commercial_invoice',
  'packing_list',
  'bill_of_lading',
  'certificate_of_origin',
  'customs_declaration',
  'payment_receipt',
  'e_fatura',
  'other',
];

export function DocumentsPage() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('');
  const [draftFilter, setDraftFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('upload_ts');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [showFilters, setShowFilters] = useState(false);
  const limit = 20;

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [permissionsDoc, setPermissionsDoc] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Build query params
  const queryParams = useMemo(() => ({
    page,
    limit,
    search: search || undefined,
    doc_type: (docTypeFilter || undefined) as DocumentType | undefined,
    is_draft: draftFilter === 'draft' ? true : draftFilter === 'final' ? false : undefined,
    sort_by: sortBy as any,
    sort_dir: sortDir,
  }), [page, limit, search, docTypeFilter, draftFilter, sortBy, sortDir]);

  // Fetch documents
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['documents-list', queryParams],
    queryFn: () => listDocuments(queryParams),
  });

  const documents = data?.data || [];
  const pagination = data?.pagination;

  // Handle selection
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(documents.map((d) => d.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Handle actions
  const handleDownload = async (doc: Document) => {
    try {
      await downloadDocument(doc.id, doc.original_filename || doc.filename);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(isRtl ? 'هل أنت متأكد من حذف هذا المستند؟' : 'Are you sure you want to delete this document?')) {
      return;
    }
    try {
      await deleteDocument(doc.id);
      refetch();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleBulkDownload = async () => {
    const selectedDocs = documents.filter((d) => selectedIds.has(d.id));
    for (const doc of selectedDocs) {
      await handleDownload(doc);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(isRtl 
      ? `هل أنت متأكد من حذف ${selectedIds.size} مستند؟`
      : `Are you sure you want to delete ${selectedIds.size} documents?`
    )) {
      return;
    }
    for (const id of selectedIds) {
      try {
        await deleteDocument(id);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
    clearSelection();
    refetch();
  };

  // Clear filters
  const clearFilters = () => {
    setSearch('');
    setEntityTypeFilter('');
    setDocTypeFilter('');
    setDraftFilter('');
    setPage(1);
  };

  const activeFiltersCount = [search, entityTypeFilter, docTypeFilter, draftFilter].filter(Boolean).length;

  // Get entity info display
  const getEntityInfo = (doc: Document) => {
    if (doc.shipment_sn) return { type: 'shipment', ref: doc.shipment_sn, color: 'blue' };
    if (doc.contract_no) return { type: 'contract', ref: doc.contract_no, color: 'purple' };
    if (doc.transaction_description) return { type: 'finance', ref: doc.transaction_description.substring(0, 20), color: 'green' };
    if (doc.customs_batch_name) return { type: 'customs', ref: doc.customs_batch_name, color: 'orange' };
    if (doc.company_name) return { type: 'company', ref: doc.company_name, color: 'cyan' };
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FolderOpenIcon className="h-8 w-8 text-blue-600" />
            {isRtl ? 'المستندات' : 'Documents'}
          </h1>
          {pagination && (
            <p className="mt-1 text-sm text-gray-500">
              {isRtl ? 'الإجمالي' : 'Total'}: {pagination.total.toLocaleString()} {isRtl ? 'مستند' : 'documents'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <CloudArrowUpIcon className="h-5 w-5" />
            {isRtl ? 'رفع مستندات' : 'Upload Documents'}
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-900">
              {isRtl ? `${selectedIds.size} مستند محدد` : `${selectedIds.size} selected`}
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-blue-700 hover:text-blue-900 underline"
            >
              {isRtl ? 'إلغاء التحديد' : 'Clear selection'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDownload}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {isRtl ? 'تحميل' : 'Download'}
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="h-4 w-4" />
              {isRtl ? 'حذف' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <Card>
        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={isRtl ? 'البحث باسم الملف...' : 'Search by filename...'}
                className="w-full ps-10 pe-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                showFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="h-5 w-5" />
              {isRtl ? 'تصفية' : 'Filters'}
              {activeFiltersCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 w-5 text-xs font-bold bg-blue-600 text-white rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Document Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'نوع المستند' : 'Document Type'}
                  </label>
                  <select
                    value={docTypeFilter}
                    onChange={(e) => {
                      setDocTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{isRtl ? 'الكل' : 'All'}</option>
                    {DOC_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {getDocumentTypeIcon(type)} {getDocumentTypeName(type, isRtl ? 'ar' : 'en')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'الحالة' : 'Status'}
                  </label>
                  <select
                    value={draftFilter}
                    onChange={(e) => {
                      setDraftFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{isRtl ? 'الكل' : 'All'}</option>
                    <option value="final">{isRtl ? 'نهائي' : 'Final'}</option>
                    <option value="draft">{isRtl ? 'مسودة' : 'Draft'}</option>
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'ترتيب حسب' : 'Sort By'}
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="upload_ts">{isRtl ? 'تاريخ الرفع' : 'Upload Date'}</option>
                    <option value="filename">{isRtl ? 'اسم الملف' : 'Filename'}</option>
                    <option value="doc_type">{isRtl ? 'النوع' : 'Type'}</option>
                    <option value="file_size">{isRtl ? 'الحجم' : 'Size'}</option>
                  </select>
                </div>

                {/* Sort Direction */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'الاتجاه' : 'Direction'}
                  </label>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as 'ASC' | 'DESC')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="DESC">{isRtl ? 'الأحدث أولاً' : 'Newest First'}</option>
                    <option value="ASC">{isRtl ? 'الأقدم أولاً' : 'Oldest First'}</option>
                  </select>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {isRtl ? 'مسح جميع المرشحات' : 'Clear all filters'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Documents Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            {isRtl ? 'حدث خطأ في تحميل المستندات' : 'Error loading documents'}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">
              {search || activeFiltersCount > 0
                ? (isRtl ? 'لا توجد نتائج' : 'No results found')
                : (isRtl ? 'لا توجد مستندات بعد' : 'No documents yet')
              }
            </p>
            {(search || activeFiltersCount > 0) && (
              <button
                onClick={clearFilters}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                {isRtl ? 'مسح المرشحات' : 'Clear filters'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === documents.length && documents.length > 0}
                        onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {isRtl ? 'المستند' : 'Document'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {isRtl ? 'النوع' : 'Type'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {isRtl ? 'مرتبط بـ' : 'Linked To'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {isRtl ? 'الحجم' : 'Size'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {isRtl ? 'تاريخ الرفع' : 'Uploaded'}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {isRtl ? 'الإجراءات' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc) => {
                    const entityInfo = getEntityInfo(doc);
                    return (
                      <tr
                        key={doc.id}
                        className={`hover:bg-gray-50 transition-colors ${selectedIds.has(doc.id) ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(doc.id)}
                            onChange={() => toggleSelection(doc.id)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl flex-shrink-0">
                              {getDocumentTypeIcon(doc.doc_type)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                {doc.original_filename || doc.filename}
                              </p>
                              <div className="flex items-center gap-2">
                                {doc.is_draft && (
                                  <Badge color="yellow" size="sm">
                                    {isRtl ? 'مسودة' : 'Draft'}
                                  </Badge>
                                )}
                                {doc.version > 1 && (
                                  <span className="text-xs text-gray-500">
                                    v{doc.version}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">
                            {getDocumentTypeName(doc.doc_type, isRtl ? 'ar' : 'en')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {entityInfo ? (
                            <Badge color={entityInfo.color as any} size="sm">
                              {entityInfo.ref}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">
                            {formatFileSize(doc.file_size)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700">
                            {new Date(doc.upload_ts).toLocaleDateString(isRtl ? 'ar-SA' : 'en-GB')}
                          </div>
                          {doc.uploaded_by_name && (
                            <div className="text-xs text-gray-500">
                              {doc.uploaded_by_name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title={isRtl ? 'تحميل' : 'Download'}
                            >
                              <ArrowDownTrayIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setPermissionsDoc(doc)}
                              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title={isRtl ? 'الصلاحيات' : 'Permissions'}
                            >
                              <ShieldCheckIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title={isRtl ? 'حذف' : 'Delete'}
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  {isRtl
                    ? `عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, pagination.total)} من ${pagination.total}`
                    : `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, pagination.total)} of ${pagination.total}`
                  }
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRtl ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
                  </button>
                  <span className="text-sm text-gray-700">
                    {page} / {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRtl ? <ChevronLeftIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Upload Modal - Placeholder for general upload (no specific entity) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 text-center">
            <FolderOpenIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isRtl ? 'رفع المستندات' : 'Upload Documents'}
            </h3>
            <p className="text-gray-600 mb-4">
              {isRtl
                ? 'لرفع مستندات، يرجى الانتقال إلى صفحة الشحنة أو العقد المحدد واستخدام زر الرفع هناك.'
                : 'To upload documents, please navigate to the specific shipment or contract page and use the upload button there.'
              }
            </p>
            <button
              onClick={() => setShowUploadModal(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {isRtl ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {permissionsDoc && (
        <DocumentPermissionsModal
          isOpen={!!permissionsDoc}
          onClose={() => setPermissionsDoc(null)}
          document={permissionsDoc}
        />
      )}
    </div>
  );
}

export default DocumentsPage;

