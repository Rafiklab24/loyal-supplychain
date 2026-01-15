/**
 * ShipmentSummaryPopover
 * Shows a lightweight shipment summary popup on hover over shipment numbers
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CubeIcon,
  ScaleIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  TruckIcon,
  UserIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../../services/api';
import { formatCurrency, formatNumber } from '../../utils/format';

interface ShipmentSummary {
  id: string;
  sn: string;
  product_text: string;
  weight_ton: number;
  container_count: number;
  total_value_usd: number;
  fixed_price_usd_per_ton: number | null;
  selling_price_usd_per_ton: number | null;
  transaction_type: string;
  status: string;
  source: {
    pol_name: string | null;
    pol_country: string | null;
    supplier_name: string | null;
  };
  destination: {
    pod_name: string | null;
    pod_country: string | null;
    final_beneficiary: string | null;
    delivery_place: string | null;
  };
}

interface ShipmentSummaryPopoverProps {
  shipmentId: string;
  shipmentSn?: string;
  children?: React.ReactNode;
  className?: string;
}

export function ShipmentSummaryPopover({
  shipmentId,
  shipmentSn,
  children,
  className = '',
}: ShipmentSummaryPopoverProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<ShipmentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [isAbove, setIsAbove] = useState(false);
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);

  // Fetch summary on first hover
  const fetchSummary = async () => {
    if (fetchedRef.current || loading) return;
    
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/shipments/${shipmentId}/summary`);
      setSummary(response.data);
    } catch (err: any) {
      console.error('Failed to fetch shipment summary:', err);
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Calculate position based on viewport using fixed positioning
  const updatePosition = () => {
    if (!triggerRef.current) return;
    
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 320; // w-80 = 20rem = 320px
    const popoverHeight = 380; // Approximate height
    const gap = 8; // Gap between trigger and popover
    const padding = 16; // Keep 16px from screen edges
    
    // Calculate vertical position
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const showAbove = spaceBelow < popoverHeight && spaceAbove > spaceBelow;
    setIsAbove(showAbove);
    
    // Calculate horizontal position - try to center on trigger
    const triggerCenter = rect.left + rect.width / 2;
    let left = triggerCenter - popoverWidth / 2;
    
    // Clamp to screen bounds
    if (left < padding) {
      left = padding;
    } else if (left + popoverWidth > window.innerWidth - padding) {
      left = window.innerWidth - padding - popoverWidth;
    }
    
    // Calculate top position
    let top: number;
    if (showAbove) {
      top = rect.top - popoverHeight - gap;
    } else {
      top = rect.bottom + gap;
    }
    
    // Calculate arrow position relative to popover
    const arrowLeft = triggerCenter - left - 6; // 6 = half of arrow width (12px)
    
    setPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
    });
    
    setArrowStyle({
      left: `${Math.max(12, Math.min(arrowLeft, popoverWidth - 24))}px`,
    });
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
      updatePosition();
      fetchSummary();
    }, 300); // 300ms delay before showing
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150); // 150ms delay before hiding
  };

  const handleClick = () => {
    navigate(`/shipments/${shipmentId}`);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`font-medium hover:underline cursor-pointer ${className.includes('text-') ? className : `text-blue-600 hover:text-blue-800 ${className}`}`}
      >
        {children || shipmentSn || shipmentId.slice(0, 8) + '...'}
      </button>
      
      {isOpen && (
        <div
          ref={popoverRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="z-[9999] p-4 bg-white rounded-xl shadow-2xl border border-gray-200"
          style={{ 
            ...popoverStyle,
            animation: 'popoverFadeIn 0.2s ease-out',
          }}
        >
          {/* Arrow */}
          <div
            className={`
              absolute w-3 h-3 bg-white border-gray-200 transform rotate-45
              ${isAbove 
                ? 'bottom-[-6px] border-r border-b' 
                : 'top-[-6px] border-l border-t'
              }
            `}
            style={arrowStyle}
          />
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-6 text-red-500 text-sm">
              {error}
            </div>
          ) : summary ? (
            <div className="space-y-3">
              {/* Header - SN and Product */}
              <div className="border-b border-gray-100 pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-lg">{summary.sn}</span>
                  <button
                    onClick={handleClick}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                    title={t('accounting.viewDetails', 'View Details')}
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{summary.product_text}</p>
              </div>
              
              {/* Type of Goods, Quantity, Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <CubeIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('accounting.containers', 'Containers')}</p>
                    <p className="font-semibold text-gray-900">{summary.container_count || '—'}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-amber-100 rounded-lg">
                    <ScaleIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('accounting.weight', 'Weight')}</p>
                    <p className="font-semibold text-gray-900">
                      {summary.weight_ton ? `${formatNumber(summary.weight_ton)} MT` : '—'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Price */}
              <div className="flex items-start gap-2 bg-green-50 p-2 rounded-lg">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <CurrencyDollarIcon className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-green-700">{t('accounting.totalValue', 'Total Value')}</p>
                  <p className="font-bold text-green-800 text-lg">
                    {formatCurrency(summary.total_value_usd)}
                  </p>
                  {summary.fixed_price_usd_per_ton && (
                    <p className="text-xs text-green-600">
                      {formatCurrency(summary.fixed_price_usd_per_ton)}/MT
                    </p>
                  )}
                </div>
              </div>
              
              {/* Source */}
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg">
                  <MapPinIcon className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('accounting.source', 'Source')}</p>
                  <p className="font-medium text-gray-900 text-sm">
                    {summary.source.pol_name || summary.source.pol_country || '—'}
                    {summary.source.supplier_name && (
                      <span className="text-gray-500"> • {summary.source.supplier_name}</span>
                    )}
                  </p>
                </div>
              </div>
              
              {/* FB & FD (Final Beneficiary & Final Destination) */}
              <div className="flex items-start gap-2 bg-indigo-50 p-2 rounded-lg">
                <div className="p-1.5 bg-indigo-100 rounded-lg">
                  <UserIcon className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-indigo-700">{t('accounting.fbFd', 'FB & FD')}</p>
                  <p className="font-medium text-indigo-800 text-sm truncate">
                    {summary.destination.final_beneficiary || '—'}
                  </p>
                  {summary.destination.delivery_place && (
                    <p className="text-xs text-indigo-600 truncate flex items-center gap-1">
                      <TruckIcon className="w-3 h-3" />
                      {summary.destination.delivery_place}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
      
      <style>{`
        @keyframes popoverFadeIn {
          from {
            opacity: 0;
            transform: translateY(${isAbove ? '8px' : '-8px'});
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default ShipmentSummaryPopover;

