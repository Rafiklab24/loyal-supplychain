/**
 * Invoice Template Component
 * Bilingual (Arabic/English) invoice layout for print and PDF
 */

import { forwardRef } from 'react';
import type { Invoice, InvoiceLanguage } from '../../types/invoice';

interface InvoiceTemplateProps {
  invoice: Invoice;
  language?: InvoiceLanguage;
}

export const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(
  ({ invoice, language = invoice.language }, ref) => {
    const isArabic = language === 'ar';
    const isBilingual = language === 'bilingual';
    const dir = isArabic ? 'rtl' : 'ltr';

    // Select logo based on language
    const logoUrl = isArabic ? '/images/Logo-ar.png' : '/images/Logo-en.png';

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString(isArabic ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Labels based on language
    const labels = {
      invoiceTitle: {
        ar: invoice.type === 'purchase' ? 'فاتورة شراء' : 'فاتورة مبيع',
        en: invoice.type === 'purchase' ? 'Purchase Invoice' : 'Sales Invoice',
      },
      invoiceNumber: { ar: 'رقم الفاتورة', en: 'Invoice No.' },
      invoiceDate: { ar: 'تاريخ الفاتورة', en: 'Invoice Date' },
      seller: { ar: 'البائع', en: 'Seller' },
      buyer: { ar: 'المشتري', en: 'Buyer' },
      itemNo: { ar: 'م', en: '#' },
      description: { ar: 'الوصف', en: 'Description' },
      origin: { ar: 'المنشأ', en: 'Origin' },
      quantity: { ar: 'الكمية', en: 'Quantity' },
      unit: { ar: 'الوحدة', en: 'Unit' },
      unitPrice: { ar: 'سعر الوحدة', en: 'Unit Price' },
      total: { ar: 'الإجمالي', en: 'Total' },
      subtotal: { ar: 'المجموع الفرعي', en: 'Subtotal' },
      grandTotal: { ar: 'المجموع الكلي', en: 'Grand Total' },
      amountInWords: { ar: 'المبلغ كتابة', en: 'Amount in Words' },
      shippingDetails: { ar: 'تفاصيل الشحن', en: 'Shipping Details' },
      vessel: { ar: 'السفينة', en: 'Vessel' },
      blNumber: { ar: 'رقم بوليصة الشحن', en: 'B/L Number' },
      portOfLoading: { ar: 'ميناء التحميل', en: 'Port of Loading' },
      portOfDischarge: { ar: 'ميناء التفريغ', en: 'Port of Discharge' },
      containers: { ar: 'عدد الحاويات', en: 'Containers' },
      eta: { ar: 'تاريخ الوصول المتوقع', en: 'ETA' },
      paymentTerms: { ar: 'شروط الدفع', en: 'Payment Terms' },
      bankDetails: { ar: 'التفاصيل المصرفية', en: 'Bank Details' },
      bankName: { ar: 'اسم البنك', en: 'Bank Name' },
      accountName: { ar: 'اسم الحساب', en: 'Account Name' },
      accountNumber: { ar: 'رقم الحساب', en: 'Account Number' },
      iban: { ar: 'آيبان', en: 'IBAN' },
      swift: { ar: 'سويفت', en: 'SWIFT' },
      notes: { ar: 'ملاحظات', en: 'Notes' },
      reference: { ar: 'المرجع', en: 'Reference' },
      signature: { ar: 'التوقيع', en: 'Signature' },
      authorizedSignature: { ar: 'التوقيع المعتمد', en: 'Authorized Signature' },
    };

    const getLabel = (key: keyof typeof labels) => {
      if (isBilingual) {
        return `${labels[key].en} / ${labels[key].ar}`;
      }
      return isArabic ? labels[key].ar : labels[key].en;
    };

    return (
      <div
        ref={ref}
        dir={isBilingual ? 'ltr' : dir}
        className="bg-white"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm',
          fontFamily: isArabic || isBilingual ? "'Cairo', 'Tajawal', sans-serif" : "'Inter', sans-serif",
          fontSize: '11px',
          lineHeight: '1.5',
          color: '#1f2937',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-red-600 pb-4 mb-6">
          {/* Company Info with Logo */}
          <div className={isBilingual ? '' : (isArabic ? 'text-right' : 'text-left')}>
            <img 
              src={logoUrl} 
              alt="Loyal International" 
              className="h-16 mb-2"
              style={{ maxWidth: '180px', objectFit: 'contain' }}
            />
            <h2 className="text-xl font-bold text-red-800">
              {isBilingual 
                ? `${invoice.company.name} / ${invoice.company.name_ar}`
                : (isArabic ? invoice.company.name_ar : invoice.company.name)
              }
            </h2>
            <p className="text-gray-600 text-xs">
              {isBilingual
                ? `${invoice.company.address} / ${invoice.company.address_ar}`
                : (isArabic ? invoice.company.address_ar : invoice.company.address)
              }
            </p>
            <p className="text-gray-600 text-xs">
              {invoice.company.phone} | {invoice.company.email}
            </p>
          </div>

          {/* Invoice Info */}
          <div className={`text-${isArabic && !isBilingual ? 'left' : 'right'}`}>
            <h1 className="text-2xl font-bold text-red-800 mb-2">
              {isBilingual 
                ? `${labels.invoiceTitle.en} / ${labels.invoiceTitle.ar}`
                : getLabel('invoiceTitle')
              }
            </h1>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-semibold">{getLabel('invoiceNumber')}:</span>{' '}
                <span className="text-red-700 font-mono">{invoice.invoice_number}</span>
              </p>
              <p>
                <span className="font-semibold">{getLabel('invoiceDate')}:</span>{' '}
                {formatDate(invoice.invoice_date)}
              </p>
              {invoice.shipment_sn && (
                <p>
                  <span className="font-semibold">{getLabel('reference')}:</span>{' '}
                  {invoice.shipment_sn}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Parties Section */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Seller */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50/30">
            <h3 className="font-bold text-red-700 mb-2 border-b border-red-200 pb-1">
              {getLabel('seller')}
            </h3>
            <p className="font-semibold">
              {isBilingual && invoice.seller.name_ar
                ? `${invoice.seller.name} / ${invoice.seller.name_ar}`
                : (isArabic && invoice.seller.name_ar ? invoice.seller.name_ar : invoice.seller.name)
              }
            </p>
            {invoice.seller.address && (
              <p className="text-gray-600 text-xs">{invoice.seller.address}</p>
            )}
            {invoice.seller.country && (
              <p className="text-gray-600 text-xs">{invoice.seller.country}</p>
            )}
            {invoice.seller.phone && (
              <p className="text-gray-600 text-xs">{invoice.seller.phone}</p>
            )}
            {invoice.seller.email && (
              <p className="text-gray-600 text-xs">{invoice.seller.email}</p>
            )}
          </div>

          {/* Buyer */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50/30">
            <h3 className="font-bold text-red-700 mb-2 border-b border-red-200 pb-1">
              {getLabel('buyer')}
            </h3>
            <p className="font-semibold">
              {isBilingual && invoice.buyer.name_ar
                ? `${invoice.buyer.name} / ${invoice.buyer.name_ar}`
                : (isArabic && invoice.buyer.name_ar ? invoice.buyer.name_ar : invoice.buyer.name)
              }
            </p>
            {invoice.buyer.address && (
              <p className="text-gray-600 text-xs">{invoice.buyer.address}</p>
            )}
            {invoice.buyer.country && (
              <p className="text-gray-600 text-xs">{invoice.buyer.country}</p>
            )}
            {invoice.buyer.phone && (
              <p className="text-gray-600 text-xs">{invoice.buyer.phone}</p>
            )}
            {invoice.buyer.email && (
              <p className="text-gray-600 text-xs">{invoice.buyer.email}</p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-red-700 text-white">
                <th className="border border-red-800 px-2 py-2 text-xs w-8">{getLabel('itemNo')}</th>
                <th className="border border-red-800 px-2 py-2 text-xs">{getLabel('description')}</th>
                <th className="border border-red-800 px-2 py-2 text-xs w-20">{getLabel('origin')}</th>
                <th className="border border-red-800 px-2 py-2 text-xs w-16">{getLabel('quantity')}</th>
                <th className="border border-red-800 px-2 py-2 text-xs w-12">{getLabel('unit')}</th>
                <th className="border border-red-800 px-2 py-2 text-xs w-24">{getLabel('unitPrice')}</th>
                <th className="border border-red-800 px-2 py-2 text-xs w-28">{getLabel('total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="border px-2 py-2 text-center">{item.item_number}</td>
                  <td className="border px-2 py-2">
                    <p className="font-medium">
                      {isBilingual && item.product_name_ar
                        ? `${item.product_name} / ${item.product_name_ar}`
                        : (isArabic && item.product_name_ar ? item.product_name_ar : item.product_name)
                      }
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-500">{item.description}</p>
                    )}
                  </td>
                  <td className="border px-2 py-2 text-center text-xs">
                    {isBilingual && item.origin_ar
                      ? `${item.origin} / ${item.origin_ar}`
                      : (isArabic && item.origin_ar ? item.origin_ar : item.origin)
                    }
                  </td>
                  <td className="border px-2 py-2 text-center">{formatCurrency(item.quantity)}</td>
                  <td className="border px-2 py-2 text-center text-xs">
                    {isArabic && item.unit_ar ? item.unit_ar : item.unit}
                  </td>
                  <td className="border px-2 py-2 text-right font-mono">
                    ${formatCurrency(item.unit_price)}
                  </td>
                  <td className="border px-2 py-2 text-right font-mono font-semibold">
                    ${formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-red-100 font-bold">
                <td colSpan={6} className="border px-2 py-2 text-right">
                  {getLabel('grandTotal')}
                </td>
                <td className="border px-2 py-2 text-right font-mono text-red-800">
                  {invoice.currency} {formatCurrency(invoice.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm">
            <span className="font-semibold">{getLabel('amountInWords')}:</span>{' '}
            {isBilingual 
              ? `${invoice.amount_in_words} / ${invoice.amount_in_words_ar}`
              : (isArabic ? invoice.amount_in_words_ar : invoice.amount_in_words)
            }
          </p>
        </div>

        {/* Shipping Details */}
        {invoice.shipping && (invoice.shipping.vessel_name || invoice.shipping.bl_number) && (
          <div className="mb-6">
            <h3 className="font-bold text-red-700 mb-2 border-b border-red-200 pb-1">
              {getLabel('shippingDetails')}
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {invoice.shipping.vessel_name && (
                <p><span className="font-semibold">{getLabel('vessel')}:</span> {invoice.shipping.vessel_name}</p>
              )}
              {invoice.shipping.bl_number && (
                <p><span className="font-semibold">{getLabel('blNumber')}:</span> {invoice.shipping.bl_number}</p>
              )}
              {invoice.shipping.container_count && (
                <p><span className="font-semibold">{getLabel('containers')}:</span> {invoice.shipping.container_count}</p>
              )}
              {invoice.shipping.port_of_loading && (
                <p><span className="font-semibold">{getLabel('portOfLoading')}:</span> {invoice.shipping.port_of_loading}</p>
              )}
              {invoice.shipping.port_of_discharge && (
                <p><span className="font-semibold">{getLabel('portOfDischarge')}:</span> {invoice.shipping.port_of_discharge}</p>
              )}
              {invoice.shipping.eta && (
                <p><span className="font-semibold">{getLabel('eta')}:</span> {formatDate(invoice.shipping.eta)}</p>
              )}
            </div>
          </div>
        )}

        {/* Payment Terms & Bank Details */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Payment Terms */}
          <div>
            <h3 className="font-bold text-red-700 mb-2 border-b border-red-200 pb-1">
              {getLabel('paymentTerms')}
            </h3>
            <p className="text-sm">
              {isBilingual && invoice.payment_terms_ar
                ? `${invoice.payment_terms} / ${invoice.payment_terms_ar}`
                : (isArabic && invoice.payment_terms_ar ? invoice.payment_terms_ar : invoice.payment_terms)
              }
            </p>
          </div>

          {/* Bank Details */}
          {invoice.bank_details && (
            <div>
              <h3 className="font-bold text-red-700 mb-2 border-b border-red-200 pb-1">
                {getLabel('bankDetails')}
              </h3>
              <div className="text-sm space-y-1">
                <p><span className="font-semibold">{getLabel('bankName')}:</span> {invoice.bank_details.bank_name}</p>
                <p><span className="font-semibold">{getLabel('accountName')}:</span> {invoice.bank_details.account_name}</p>
                <p><span className="font-semibold">{getLabel('accountNumber')}:</span> {invoice.bank_details.account_number}</p>
                {invoice.bank_details.iban && (
                  <p><span className="font-semibold">{getLabel('iban')}:</span> {invoice.bank_details.iban}</p>
                )}
                {invoice.bank_details.swift_code && (
                  <p><span className="font-semibold">{getLabel('swift')}:</span> {invoice.bank_details.swift_code}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {(invoice.notes || invoice.notes_ar) && (
          <div className="mb-6">
            <h3 className="font-bold text-red-700 mb-2 border-b border-red-200 pb-1">
              {getLabel('notes')}
            </h3>
            <p className="text-sm text-gray-600">
              {isBilingual && invoice.notes_ar
                ? `${invoice.notes} / ${invoice.notes_ar}`
                : (isArabic && invoice.notes_ar ? invoice.notes_ar : invoice.notes)
              }
            </p>
          </div>
        )}

        {/* Signature Section */}
        <div className="mt-12 pt-8 border-t border-red-200">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="border-t border-red-400 mt-16 pt-2">
                <p className="text-sm font-semibold">{getLabel('authorizedSignature')}</p>
                <p className="text-xs text-gray-500">{invoice.company.name}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-red-400 mt-16 pt-2">
                <p className="text-sm font-semibold">{getLabel('signature')}</p>
                <p className="text-xs text-gray-500">{invoice.buyer.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-red-200 text-center text-xs text-gray-400">
          <p>
            {isBilingual 
              ? 'This is a computer-generated invoice / هذه فاتورة صادرة إلكترونياً'
              : (isArabic ? 'هذه فاتورة صادرة إلكترونياً' : 'This is a computer-generated invoice')
            }
          </p>
        </div>
      </div>
    );
  }
);

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;
