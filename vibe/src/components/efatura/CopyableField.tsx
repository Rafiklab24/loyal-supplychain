/**
 * CopyableField Component
 * A field with click-to-copy functionality for E-Fatura data entry
 */

import { useState } from 'react';
import { ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { useToast } from '../common/Toast';

interface CopyableFieldProps {
  label: string;
  labelAr?: string;
  value: string | number | null | undefined;
  className?: string;
  formatValue?: (value: string | number) => string;
  copyValue?: string; // Optional: different value to copy than display
  isRtl?: boolean;
}

export function CopyableField({
  label,
  labelAr,
  value,
  className = '',
  formatValue,
  copyValue,
  isRtl = true,
}: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const displayValue = value != null && value !== '' 
    ? (formatValue ? formatValue(value) : String(value))
    : '—';
  
  const valueToCopy = copyValue ?? (value != null ? String(value) : '');

  const handleCopy = async () => {
    if (!valueToCopy) {
      toast.warning(isRtl ? 'لا يوجد قيمة للنسخ' : 'No value to copy');
      return;
    }

    try {
      // Try modern Clipboard API first (requires secure context)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(valueToCopy);
      } else {
        // Fallback for non-secure contexts (HTTP on LAN)
        const textArea = document.createElement('textarea');
        textArea.value = valueToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success(isRtl ? 'تم النسخ ✓' : 'Copied ✓', 1500);
      
      // Reset copied state after animation
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error(isRtl ? 'فشل النسخ' : 'Failed to copy');
    }
  };

  return (
    <div className={`flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${className}`}>
      <div className={`flex flex-col min-w-0 flex-1 ${isRtl ? 'items-end' : 'items-start'}`}>
        <span className="text-xs text-gray-500 leading-tight">
          {isRtl ? (labelAr || label) : label}
        </span>
        <span className={`text-sm font-medium text-gray-900 truncate max-w-full ${!value && value !== 0 ? 'text-gray-400' : ''}`}>
          {displayValue}
        </span>
      </div>
      
      <button
        type="button"
        onClick={handleCopy}
        disabled={!valueToCopy}
        className={`
          ms-2 p-1.5 rounded-md transition-all duration-200 flex-shrink-0
          ${valueToCopy 
            ? 'hover:bg-emerald-100 text-gray-400 hover:text-emerald-600 cursor-pointer' 
            : 'text-gray-300 cursor-not-allowed'
          }
          ${copied ? 'bg-emerald-100 text-emerald-600' : ''}
        `}
        title={isRtl ? 'انقر للنسخ' : 'Click to copy'}
      >
        {copied ? (
          <ClipboardDocumentCheckIcon className="h-4 w-4 text-emerald-600" />
        ) : (
          <ClipboardIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

/**
 * CopyableFieldCompact - Smaller version for delivery details
 */
export function CopyableFieldCompact({
  label,
  labelAr,
  value,
  className = '',
  isRtl = true,
}: Omit<CopyableFieldProps, 'formatValue' | 'copyValue'>) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const displayValue = value != null && value !== '' ? String(value) : '—';
  const valueToCopy = value != null ? String(value) : '';

  const handleCopy = async () => {
    if (!valueToCopy) return;

    try {
      // Try modern Clipboard API first (requires secure context)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(valueToCopy);
      } else {
        // Fallback for non-secure contexts (HTTP on LAN)
        const textArea = document.createElement('textarea');
        textArea.value = valueToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success(isRtl ? 'تم النسخ ✓' : 'Copied ✓', 1500);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(isRtl ? 'فشل النسخ' : 'Failed to copy');
    }
  };

  return (
    <div className={`flex items-center justify-between py-1 ${className}`}>
      <span className="text-xs text-gray-500">
        {isRtl ? (labelAr || label) : label}:
      </span>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-medium truncate max-w-[120px] ${!value && value !== 0 ? 'text-gray-400' : 'text-gray-800'}`}>
          {displayValue}
        </span>
        {valueToCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className={`
              p-1 rounded transition-all duration-200
              hover:bg-emerald-100 text-gray-400 hover:text-emerald-600
              ${copied ? 'bg-emerald-100 text-emerald-600' : ''}
            `}
            title={isRtl ? 'انقر للنسخ' : 'Click to copy'}
          >
            {copied ? (
              <ClipboardDocumentCheckIcon className="h-4 w-4 text-emerald-600" />
            ) : (
              <ClipboardIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default CopyableField;







