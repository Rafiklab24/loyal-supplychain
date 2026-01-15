import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XMarkIcon,
  PrinterIcon,
  ShareIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { OutboundDelivery } from '../../types/api';
import { formatNumber, formatDateString } from '../../utils/format';

interface DeliveryReceiptProps {
  delivery: OutboundDelivery;
  onClose: () => void;
}

export const DeliveryReceipt: React.FC<DeliveryReceiptProps> = ({
  delivery,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && receiptRef.current) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="${isRTL ? 'rtl' : 'ltr'}">
        <head>
          <title>${t('landTransport.deliveryReceipt', 'Delivery Receipt')} - ${delivery.delivery_number}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { 
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              padding: 40px;
              color: #1f2937;
              background-color: #fff;
            }
            .receipt-container {
              max-width: 800px;
              margin: 0 auto;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              overflow: hidden;
            }
            .header {
              background: #f0fdf4;
              padding: 32px;
              border-bottom: 1px solid #dcfce7;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .brand h1 {
              font-size: 24px;
              font-weight: 700;
              color: #047857;
              margin-bottom: 4px;
            }
            .brand p {
              font-size: 14px;
              color: #059669;
            }
            .meta {
              text-align: right;
            }
            .meta-item {
              margin-bottom: 4px;
            }
            .meta-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .meta-value {
              font-size: 16px;
              font-weight: 600;
              color: #111827;
            }
            .content {
              padding: 32px;
            }
            .section {
              margin-bottom: 32px;
            }
            .section:last-child {
              margin-bottom: 0;
            }
            .section-title {
              font-size: 14px;
              font-weight: 600;
              color: #374151;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 16px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 8px;
            }
            .route-visual {
              display: flex;
              align-items: center;
              gap: 24px;
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 24px;
            }
            .location {
              flex: 1;
            }
            .location-label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .location-value {
              font-size: 16px;
              font-weight: 600;
              color: #111827;
            }
            .arrow {
              color: #9ca3af;
              font-size: 20px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 24px;
            }
            .field {
              margin-bottom: 0;
            }
            .field-label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .field-value {
              font-size: 15px;
              font-weight: 500;
              color: #111827;
            }
            .footer {
              background: #f9fafb;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
            @media print {
              body { padding: 0; }
              .receipt-container { border: none; border-radius: 0; }
              .no-print { display: none; }
            }
            ${isRTL ? `
              body { direction: rtl; }
              .meta { text-align: left; }
              .header { flex-direction: row-reverse; }
              .arrow { transform: scaleX(-1); }
            ` : ''}
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="brand">
                <h1>${t('landTransport.deliveryReceipt', 'Delivery Receipt')}</h1>
                <p>Loyal Supply Chain Management</p>
              </div>
              <div class="meta">
                <div class="meta-item">
                  <div class="meta-label">${t('landTransport.receiptNumber', 'Receipt No')}</div>
                  <div class="meta-value">#${delivery.receipt_number || delivery.delivery_number}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">${t('landTransport.date', 'Date')}</div>
                  <div class="meta-value">${formatDateString(delivery.delivery_date)}</div>
                </div>
              </div>
            </div>

            <div class="content">
              <div class="section">
                <div class="section-title">${t('landTransport.routeDetails', 'Route Information')}</div>
                <div class="route-visual">
                  <div class="location">
                    <div class="location-label">${t('landTransport.origin', 'Origin')}</div>
                    <div class="location-value">${delivery.origin || '—'}</div>
                  </div>
                  <div class="arrow">➔</div>
                  <div class="location">
                    <div class="location-label">${t('landTransport.destination', 'Destination')}</div>
                    <div class="location-value">${delivery.destination}</div>
                  </div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">${t('landTransport.cargoDetails', 'Cargo Details')}</div>
                <div class="grid">
                  <div class="field">
                    <div class="field-label">${t('landTransport.goodsDescription', 'Description')}</div>
                    <div class="field-value">${delivery.goods_description || '—'}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">${t('landTransport.containerId', 'Container ID')}</div>
                    <div class="field-value" style="font-family: monospace;">${delivery.container_id || '—'}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">${t('landTransport.packages', 'Packages')}</div>
                    <div class="field-value">${delivery.package_count || '—'}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">${t('landTransport.weight', 'Weight')}</div>
                    <div class="field-value">${delivery.weight_kg ? `${formatNumber(delivery.weight_kg)} kg` : '—'}</div>
                  </div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">${t('landTransport.transportDetails', 'Transport Details')}</div>
                <div class="grid">
                  <div class="field">
                    <div class="field-label">${t('landTransport.transportCompany', 'Carrier')}</div>
                    <div class="field-value">${delivery.transport_company_name || '—'}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">${t('landTransport.truckPlate', 'Vehicle Plate')}</div>
                    <div class="field-value" style="font-family: monospace;">${delivery.truck_plate_number || '—'}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">${t('landTransport.driverName', 'Driver Name')}</div>
                    <div class="field-value">${delivery.driver_name || '—'}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">${t('landTransport.driverPhone', 'Driver Phone')}</div>
                    <div class="field-value">${delivery.driver_phone || '—'}</div>
                  </div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">${t('landTransport.customerDetails', 'Customer Details')}</div>
                <div class="grid">
                  <div class="field">
                    <div class="field-label">${t('landTransport.customerName', 'Customer')}</div>
                    <div class="field-value">${delivery.customer_name || '—'}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">${t('landTransport.customerPhone', 'Contact')}</div>
                    <div class="field-value">${delivery.customer_phone || '—'}</div>
                  </div>
                  <div class="field" style="grid-column: span 2;">
                    <div class="field-label">${t('landTransport.customerReference', 'Reference')}</div>
                    <div class="field-value">${delivery.customer_reference || '—'}</div>
                  </div>
                </div>
              </div>

              ${delivery.notes ? `
              <div class="section">
                <div class="section-title">${t('common.notes', 'Notes')}</div>
                <div style="background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 14px;">
                  ${delivery.notes}
                </div>
              </div>
              ` : ''}
            </div>

            <div class="footer">
              <p>Generated on ${new Date().toLocaleString(i18n.language)}</p>
              <p style="margin-top: 4px; font-size: 11px; color: #9ca3af;">This document is an official delivery receipt generated by the system.</p>
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
      printWindow.print();
      }, 250);
    }
  };

  const handleShare = async () => {
    const text = `
🚚 Delivery Receipt #${delivery.delivery_number}
📅 ${formatDateString(delivery.delivery_date)}

📍 Route
From: ${delivery.origin || 'Warehouse'}
To: ${delivery.destination}

📦 Cargo
${delivery.goods_description || 'General Cargo'}
${delivery.container_id ? `Container: ${delivery.container_id}` : ''}
${delivery.package_count ? `Packages: ${delivery.package_count}` : ''}

🚛 Transport
Truck: ${delivery.truck_plate_number || '—'}
Driver: ${delivery.driver_name || '—'} (${delivery.driver_phone || '—'})

👤 Customer
${delivery.customer_name || '—'}
Ref: ${delivery.customer_reference || '—'}
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Delivery Receipt ${delivery.delivery_number}`,
          text: text,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      try {
        // Try modern Clipboard API first (requires secure context)
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for non-secure contexts (HTTP on LAN)
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          textArea.style.top = '-9999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        alert(t('landTransport.copiedToClipboard', 'Receipt details copied to clipboard'));
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80" onClick={onClose} />

        <div className="inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          {/* Actions Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('landTransport.deliveryReceipt', 'Delivery Receipt')}
            </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                #{delivery.receipt_number || delivery.delivery_number}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                <ShareIcon className="h-4 w-4" />
                {t('common.share', 'Share')}
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <PrinterIcon className="h-4 w-4" />
                {t('common.print', 'Print')}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Preview Content */}
          <div className="p-8 bg-gray-100 dark:bg-gray-900 overflow-y-auto max-h-[70vh]" ref={receiptRef}>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm max-w-2xl mx-auto overflow-hidden">
              {/* Receipt Header */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-8 border-b border-emerald-100 dark:border-emerald-800/30">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">Delivery Receipt</h1>
                    <p className="text-emerald-600 dark:text-emerald-400 mt-1">Loyal Supply Chain Management</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Receipt No</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">#{delivery.receipt_number || delivery.delivery_number}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatDateString(delivery.delivery_date)}</div>
                </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Route */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Route Information</h4>
                  <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Origin</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{delivery.origin || 'Warehouse'}</div>
                  </div>
                    <ArrowPathIcon className="h-5 w-5 text-gray-400" />
                    <div className="flex-1 text-right">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Destination</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{delivery.destination}</div>
                    </div>
                  </div>
                </div>

                {/* Cargo */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Cargo Details</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</div>
                      <div className="font-medium text-gray-900 dark:text-white">{delivery.goods_description || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Container ID</div>
                      <div className="font-mono font-medium text-gray-900 dark:text-white">{delivery.container_id || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Packages</div>
                      <div className="font-medium text-gray-900 dark:text-white">{delivery.package_count || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weight</div>
                      <div className="font-medium text-gray-900 dark:text-white">{delivery.weight_kg ? `${formatNumber(delivery.weight_kg)} kg` : '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Transport */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Transport Details</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Carrier</div>
                      <div className="font-medium text-gray-900 dark:text-white">{delivery.transport_company_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Vehicle Plate</div>
                      <div className="font-mono font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded inline-block">{delivery.truck_plate_number || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Driver</div>
                      <div className="font-medium text-gray-900 dark:text-white">{delivery.driver_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Driver Phone</div>
                      <div className="font-medium text-gray-900 dark:text-white">{delivery.driver_phone || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Customer */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Customer Details</h4>
                  <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Name</div>
                        <div className="font-medium text-gray-900 dark:text-white">{delivery.customer_name || '—'}</div>
                    </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Phone</div>
                        <div className="font-medium text-gray-900 dark:text-white">{delivery.customer_phone || '—'}</div>
                    </div>
                      <div className="col-span-2 border-t border-gray-200 dark:border-gray-600 pt-3 mt-1">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reference Number</div>
                        <div className="font-medium text-gray-900 dark:text-white">{delivery.customer_reference || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                Generated on {new Date().toLocaleString(i18n.language)} • Official Receipt
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
