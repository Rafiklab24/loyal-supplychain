/**
 * Invoice Preview Modal
 * Modal for previewing, printing, and downloading invoices
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@headlessui/react';
import {
  XMarkIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  LanguageIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { InvoiceTemplate } from './InvoiceTemplate';
import { downloadPDF, printElement } from '../../utils/pdfGenerator';
import { Spinner } from '../common/Spinner';
import type { Invoice, InvoiceLanguage } from '../../types/invoice';

interface InvoicePreviewModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InvoicePreviewModal({ invoice, isOpen, onClose }: InvoicePreviewModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const [language, setLanguage] = useState<InvoiceLanguage>('bilingual');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleDownloadPDF = useCallback(async () => {
    if (!invoiceRef.current || !invoice) return;
    
    setIsGeneratingPDF(true);
    try {
      const filename = `${invoice.type === 'purchase' ? 'purchase' : 'sales'}_invoice_${invoice.invoice_number}.pdf`;
      await downloadPDF(invoiceRef.current, {
        filename,
        format: 'a4',
        quality: 2,
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [invoice]);

  const handlePrint = useCallback(() => {
    if (!invoiceRef.current) return;
    
    setIsPrinting(true);
    try {
      printElement(invoiceRef.current);
    } catch (error) {
      console.error('Failed to print:', error);
    } finally {
      setIsPrinting(false);
    }
  }, []);

  if (!invoice) return null;

  const languageOptions: { value: InvoiceLanguage; label: string }[] = [
    { value: 'bilingual', label: isRtl ? 'ثنائي اللغة' : 'Bilingual' },
    { value: 'ar', label: isRtl ? 'العربية' : 'Arabic' },
    { value: 'en', label: isRtl ? 'الإنجليزية' : 'English' },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-5xl bg-white rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-3">
                <DocumentTextIcon className="w-6 h-6 text-white" />
                <Dialog.Title className="text-lg font-semibold text-white">
                  {t('invoice.preview', 'معاينة الفاتورة')}
                </Dialog.Title>
                <span className="px-2 py-0.5 text-xs font-medium bg-white/20 text-white rounded">
                  {invoice.invoice_number}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-gray-50 border-b">
              {/* Language Selector */}
              <div className="flex items-center gap-2">
                <LanguageIcon className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600">{t('invoice.language', 'اللغة')}:</span>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  {languageOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setLanguage(option.value)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        language === option.value
                          ? 'bg-red-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {isPrinting ? (
                    <Spinner size="sm" />
                  ) : (
                    <PrinterIcon className="w-4 h-4" />
                  )}
                  {t('invoice.print', 'طباعة')}
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {isGeneratingPDF ? (
                    <Spinner size="sm" />
                  ) : (
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  )}
                  {t('invoice.downloadPdf', 'تحميل PDF')}
                </button>
              </div>
            </div>

            {/* Invoice Preview */}
            <div className="p-6 bg-gray-100 max-h-[70vh] overflow-auto">
              <div className="mx-auto shadow-lg" style={{ width: 'fit-content' }}>
                <InvoiceTemplate
                  ref={invoiceRef}
                  invoice={invoice}
                  language={language}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
              <div className="text-sm text-gray-500">
                {t('invoice.type', 'النوع')}: {' '}
                <span className="font-medium">
                  {invoice.type === 'purchase' 
                    ? (isRtl ? 'فاتورة شراء' : 'Purchase Invoice')
                    : (isRtl ? 'فاتورة مبيع' : 'Sales Invoice')
                  }
                </span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('common.close', 'إغلاق')}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}

export default InvoicePreviewModal;

