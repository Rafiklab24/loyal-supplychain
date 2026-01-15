/**
 * ExcelImportModal - Bulk import products from Excel file
 */

import { useState, Fragment, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { importProducts, PRODUCT_CATEGORIES } from '../../services/products';
import * as XLSX from 'xlsx';

interface ExcelImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  name: string;
  sku?: string;
  hs_code?: string;
  category_type?: string;
  uom?: string;
  pack_type?: string;
  brand?: string;
  description?: string;
  [key: string]: any;
}

export function ExcelImportModal({ onClose, onSuccess }: ExcelImportModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: importProducts,
    onSuccess: () => {
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const TARGET_COLUMNS = [
    { key: 'name', label: 'Product Name', required: true },
    { key: 'sku', label: 'SKU / Code', required: false },
    { key: 'hs_code', label: 'HS Code', required: false },
    { key: 'category_type', label: 'Category', required: false },
    { key: 'uom', label: 'Unit of Measure', required: false },
    { key: 'pack_type', label: 'Pack Type', required: false },
    { key: 'brand', label: 'Brand', required: false },
    { key: 'description', label: 'Description', required: false },
  ];

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          setParseError('File appears to be empty or has no data rows');
          return;
        }

        // Get headers from first row
        const headers = jsonData[0].map((h: any) => String(h || '').trim());
        setAvailableColumns(headers);

        // Auto-map columns based on common names
        const autoMapping: Record<string, string> = {};
        headers.forEach((header) => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('name') || lowerHeader.includes('product')) {
            if (!autoMapping.name) autoMapping.name = header;
          }
          if (lowerHeader.includes('sku') || lowerHeader.includes('code')) {
            if (!autoMapping.sku) autoMapping.sku = header;
          }
          if (lowerHeader.includes('hs') || lowerHeader.includes('tariff')) {
            if (!autoMapping.hs_code) autoMapping.hs_code = header;
          }
          if (lowerHeader.includes('category') || lowerHeader.includes('type')) {
            if (!autoMapping.category_type) autoMapping.category_type = header;
          }
          if (lowerHeader.includes('unit') || lowerHeader.includes('uom')) {
            if (!autoMapping.uom) autoMapping.uom = header;
          }
          if (lowerHeader.includes('pack')) {
            if (!autoMapping.pack_type) autoMapping.pack_type = header;
          }
          if (lowerHeader.includes('brand')) {
            if (!autoMapping.brand) autoMapping.brand = header;
          }
          if (lowerHeader.includes('desc')) {
            if (!autoMapping.description) autoMapping.description = header;
          }
        });
        setColumnMapping(autoMapping);

        // Parse data rows
        const rows: ParsedRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const parsedRow: any = {};
          headers.forEach((header, index) => {
            parsedRow[header] = row[index];
          });
          if (Object.values(parsedRow).some((v) => v)) {
            rows.push(parsedRow);
          }
        }

        setParsedData(rows);
        setStep('preview');
      } catch (err: any) {
        setParseError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  }, []);

  const handleImport = () => {
    if (!columnMapping.name) {
      setParseError('Please map the Product Name column');
      return;
    }

    // Transform data using column mapping
    const products = parsedData.map((row) => {
      const product: any = {};
      TARGET_COLUMNS.forEach(({ key }) => {
        const sourceColumn = columnMapping[key];
        if (sourceColumn && row[sourceColumn]) {
          let value = row[sourceColumn];
          
          // Normalize category
          if (key === 'category_type' && typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            const match = PRODUCT_CATEGORIES.find(
              (c) => c.code === lowerValue || c.name.toLowerCase() === lowerValue
            );
            value = match?.code || value;
          }
          
          product[key] = value;
        }
      });
      return product;
    }).filter((p) => p.name);

    mutation.mutate(products);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
      const input = document.createElement('input');
      input.type = 'file';
      const dt = new DataTransfer();
      dt.items.add(droppedFile);
      input.files = dt.files;
      handleFileSelect({ target: input } as any);
    }
  }, [handleFileSelect]);

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-white flex items-center gap-2">
                      <DocumentArrowUpIcon className="h-6 w-6" />
                      {t('products.importProducts', 'Import Products from Excel')}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Step 1: Upload */}
                  {step === 'upload' && (
                    <div>
                      <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors"
                      >
                        <DocumentArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">
                          {t('products.dropFile', 'Drop your Excel file here, or')}
                        </p>
                        <label className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          {t('products.browseFiles', 'Browse Files')}
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={handleFileSelect}
                          />
                        </label>
                        <p className="text-xs text-gray-400 mt-3">
                          Supported: .xlsx, .xls, .csv
                        </p>
                      </div>

                      {parseError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                          {parseError}
                        </div>
                      )}

                      {/* Template */}
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          {t('products.expectedColumns', 'Expected Columns')}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {TARGET_COLUMNS.map((col) => (
                            <span
                              key={col.key}
                              className={`px-2 py-1 text-xs rounded ${
                                col.required
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {col.label}
                              {col.required && ' *'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Preview & Map Columns */}
                  {step === 'preview' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-medium text-gray-900">{file?.name}</h4>
                          <p className="text-sm text-gray-500">
                            {parsedData.length} {t('products.rowsFound', 'rows found')}
                          </p>
                        </div>
                        <button
                          onClick={() => { setStep('upload'); setFile(null); setParsedData([]); }}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          {t('products.changeFile', 'Change file')}
                        </button>
                      </div>

                      {/* Column Mapping */}
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-800 mb-3">
                          {t('products.mapColumns', 'Map Columns')}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {TARGET_COLUMNS.map((col) => (
                            <div key={col.key} className="flex items-center gap-2">
                              <span className={`text-sm w-28 ${col.required ? 'font-medium' : ''}`}>
                                {col.label}{col.required ? ' *' : ''}
                              </span>
                              <select
                                value={columnMapping[col.key] || ''}
                                onChange={(e) => setColumnMapping({ ...columnMapping, [col.key]: e.target.value })}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">-- Select --</option>
                                {availableColumns.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Preview Table */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                              {TARGET_COLUMNS.slice(0, 5).map((col) => (
                                <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-600">
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {parsedData.slice(0, 10).map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                                {TARGET_COLUMNS.slice(0, 5).map((col) => (
                                  <td key={col.key} className="px-3 py-2 truncate max-w-[150px]">
                                    {columnMapping[col.key] ? row[columnMapping[col.key]] || '-' : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {parsedData.length > 10 && (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center bg-gray-50 border-t">
                            ... and {parsedData.length - 10} more rows
                          </div>
                        )}
                      </div>

                      {parseError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                          {parseError}
                        </div>
                      )}

                      {mutation.error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                          {(mutation.error as Error).message}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Result */}
                  {step === 'result' && mutation.data && (
                    <div className="text-center py-6">
                      <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">
                        {t('products.importComplete', 'Import Complete!')}
                      </h4>
                      <div className="space-y-1 text-sm text-gray-600 mb-6">
                        <p>
                          <span className="font-medium text-green-600">{mutation.data.created}</span> products created
                        </p>
                        <p>
                          <span className="font-medium text-blue-600">{mutation.data.updated}</span> products updated
                        </p>
                        {mutation.data.errors.length > 0 && (
                          <p>
                            <span className="font-medium text-red-600">{mutation.data.errors.length}</span> errors
                          </p>
                        )}
                      </div>

                      {mutation.data.errors.length > 0 && (
                        <div className="text-left mb-6 max-h-32 overflow-y-auto bg-red-50 p-3 rounded-lg">
                          <h5 className="text-sm font-medium text-red-800 mb-2">Errors:</h5>
                          {mutation.data.errors.slice(0, 5).map((err, i) => (
                            <p key={i} className="text-xs text-red-700">
                              Row "{err.row?.name || 'Unknown'}": {err.error}
                            </p>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={onSuccess}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                      >
                        {t('common.done', 'Done')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {step === 'preview' && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={mutation.isPending || !columnMapping.name}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {mutation.isPending && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                      {t('products.importNow', 'Import')} ({parsedData.length} {t('products.rows', 'rows')})
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}


