/**
 * ShipmentTimeline Component
 * Displays a chronological timeline of shipment milestones and key dates
 * Part of the Shipment Final Report redesign
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { formatDateString } from '../../utils/format';
import type { Shipment } from '../../types/api';

export interface TimelineMilestone {
  id: string;
  label: string;
  labelAr?: string;
  date: string | null;
  status: 'completed' | 'current' | 'upcoming' | 'overdue';
  icon: React.ReactNode;
  description?: string;
  descriptionAr?: string;
  sectionLink?: string; // ID of the section this milestone links to
}

interface ShipmentTimelineProps {
  shipment: Shipment;
  onMilestoneClick?: (milestone: TimelineMilestone) => void;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
}

export function ShipmentTimeline({
  shipment,
  onMilestoneClick,
  orientation = 'horizontal',
  compact = false,
}: ShipmentTimelineProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  // Generate milestones based on shipment data
  const milestones = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const getStatus = (date: string | null, isRequired: boolean = false): 'completed' | 'current' | 'upcoming' | 'overdue' => {
      if (!date) return isRequired ? 'upcoming' : 'upcoming';
      const milestoneDate = new Date(date);
      milestoneDate.setHours(0, 0, 0, 0);
      
      if (milestoneDate < today) return 'completed';
      if (milestoneDate.toDateString() === today.toDateString()) return 'current';
      return 'upcoming';
    };
    
    const shipmentMilestones: TimelineMilestone[] = [
      // 1. Contract/Order Created
      {
        id: 'created',
        label: t('shipments.timeline.created', 'Order Created'),
        labelAr: 'إنشاء الطلب',
        date: shipment.created_at,
        status: 'completed',
        icon: <DocumentTextIcon className="w-5 h-5" />,
        description: t('shipments.timeline.createdDesc', 'Shipment order initiated'),
        descriptionAr: 'تم إنشاء أمر الشحنة',
        sectionLink: 'basic-info',
      },
      
      // 2. Booking Confirmed
      {
        id: 'booked',
        label: t('shipments.timeline.booked', 'Booking Confirmed'),
        labelAr: 'تأكيد الحجز',
        date: shipment.booking_no ? shipment.created_at : null,
        status: shipment.booking_no ? 'completed' : 'upcoming',
        icon: <CheckCircleIcon className="w-5 h-5" />,
        description: shipment.booking_no 
          ? `${t('shipments.timeline.bookingNo', 'Booking')}: ${shipment.booking_no}`
          : t('shipments.timeline.awaitingBooking', 'Awaiting booking confirmation'),
        sectionLink: 'international-logistics',
      },
      
      // 3. Departure (ETD)
      {
        id: 'departed',
        label: t('shipments.timeline.departed', 'Departed'),
        labelAr: 'المغادرة',
        date: shipment.etd,
        status: getStatus(shipment.etd),
        icon: <TruckIcon className="w-5 h-5" />,
        description: shipment.pol_name 
          ? `${t('shipments.timeline.from', 'From')}: ${shipment.pol_name}`
          : t('shipments.timeline.departurePort', 'Departure from origin port'),
        descriptionAr: shipment.pol_name ? `من: ${shipment.pol_name}` : 'المغادرة من ميناء الأصل',
        sectionLink: 'international-logistics',
      },
      
      // 4. Arrival (ETA)
      {
        id: 'arrived',
        label: t('shipments.timeline.arrived', 'Arrived'),
        labelAr: 'الوصول',
        date: shipment.eta,
        status: getStatus(shipment.eta),
        icon: <MapPinIcon className="w-5 h-5" />,
        description: shipment.pod_name 
          ? `${t('shipments.timeline.at', 'At')}: ${shipment.pod_name}`
          : t('shipments.timeline.arrivalPort', 'Arrival at destination port'),
        descriptionAr: shipment.pod_name ? `في: ${shipment.pod_name}` : 'الوصول إلى ميناء الوجهة',
        sectionLink: 'international-logistics',
      },
      
      // 5. Customs Clearance
      {
        id: 'cleared',
        label: t('shipments.timeline.cleared', 'Customs Cleared'),
        labelAr: 'التخليص الجمركي',
        date: shipment.customs_clearance_date,
        status: getStatus(shipment.customs_clearance_date),
        icon: <ShieldCheckIcon className="w-5 h-5" />,
        description: shipment.customs_clearance_date 
          ? t('shipments.timeline.clearedOn', 'Cleared on {{date}}', { date: formatDateString(shipment.customs_clearance_date) })
          : t('shipments.timeline.awaitingClearance', 'Pending customs clearance'),
        descriptionAr: shipment.customs_clearance_date 
          ? `تم التخليص في ${formatDateString(shipment.customs_clearance_date)}`
          : 'في انتظار التخليص الجمركي',
        sectionLink: 'financial-accounting',
      },
      
      // 6. Final Delivery
      {
        id: 'delivered',
        label: t('shipments.timeline.delivered', 'Delivered'),
        labelAr: 'التسليم',
        date: shipment.status === 'delivered' ? shipment.updated_at : null,
        status: shipment.status === 'delivered' ? 'completed' : 'upcoming',
        icon: <CubeIcon className="w-5 h-5" />,
        description: shipment.final_destination?.delivery_place 
          ? `${t('shipments.timeline.to', 'To')}: ${shipment.final_destination.delivery_place}`
          : t('shipments.timeline.finalDelivery', 'Final delivery to destination'),
        descriptionAr: shipment.final_destination?.delivery_place 
          ? `إلى: ${shipment.final_destination.delivery_place}`
          : 'التسليم النهائي إلى الوجهة',
        sectionLink: 'domestic-logistics',
      },
    ];
    
    // Calculate current milestone (the first non-completed one)
    const currentIndex = shipmentMilestones.findIndex(m => m.status !== 'completed');
    if (currentIndex > 0) {
      shipmentMilestones[currentIndex].status = 'current';
    }
    
    return shipmentMilestones;
  }, [shipment, t]);
  
  // Calculate progress percentage
  const progress = useMemo(() => {
    const completedCount = milestones.filter(m => m.status === 'completed').length;
    return Math.round((completedCount / milestones.length) * 100);
  }, [milestones]);
  
  if (orientation === 'horizontal') {
    return (
      <div className="bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ClockIcon className="w-4 h-4" />
            {t('shipments.timeline.title', 'Shipment Timeline')}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {t('shipments.timeline.progress', 'Progress')}
            </span>
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700">{progress}%</span>
          </div>
        </div>
        
        {/* Timeline Track */}
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Milestones */}
          <div className={`relative flex justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
            {milestones.map((milestone, index) => (
              <div 
                key={milestone.id}
                className={`
                  flex flex-col items-center text-center flex-1
                  ${onMilestoneClick ? 'cursor-pointer' : ''}
                `}
                onClick={() => onMilestoneClick?.(milestone)}
              >
                {/* Icon Circle */}
                <div className={`
                  relative z-10 w-10 h-10 rounded-full flex items-center justify-center
                  transition-all duration-300 transform hover:scale-110
                  ${milestone.status === 'completed' 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                    : milestone.status === 'current'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 ring-4 ring-blue-100 animate-pulse'
                    : milestone.status === 'overdue'
                    ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                    : 'bg-slate-200 text-slate-400'
                  }
                `}>
                  {milestone.status === 'completed' ? (
                    <CheckCircleSolidIcon className="w-6 h-6" />
                  ) : (
                    milestone.icon
                  )}
                </div>
                
                {/* Label */}
                <div className="mt-3 max-w-[100px]">
                  <p className={`
                    text-xs font-semibold leading-tight
                    ${milestone.status === 'completed' ? 'text-emerald-700' : 
                      milestone.status === 'current' ? 'text-blue-700' : 
                      milestone.status === 'overdue' ? 'text-red-700' : 'text-slate-500'}
                  `}>
                    {isRtl && milestone.labelAr ? milestone.labelAr : milestone.label}
                  </p>
                  
                  {/* Date */}
                  {milestone.date && !compact && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formatDateString(milestone.date)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Vertical orientation
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <ClockIcon className="w-4 h-4" />
        {t('shipments.timeline.title', 'Shipment Timeline')}
        <span className="ms-auto text-xs bg-slate-100 px-2 py-0.5 rounded-full">
          {progress}% {t('shipments.timeline.complete', 'complete')}
        </span>
      </h3>
      
      <div className="relative">
        {milestones.map((milestone, index) => (
          <div 
            key={milestone.id}
            className={`
              relative flex gap-4 pb-6 last:pb-0
              ${onMilestoneClick ? 'cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors' : ''}
            `}
            onClick={() => onMilestoneClick?.(milestone)}
          >
            {/* Vertical Line */}
            {index < milestones.length - 1 && (
              <div className={`
                absolute top-10 left-4 w-0.5 h-[calc(100%-2.5rem)]
                ${milestone.status === 'completed' 
                  ? 'bg-emerald-300' 
                  : 'bg-slate-200'
                }
              `} />
            )}
            
            {/* Icon */}
            <div className={`
              relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
              ${milestone.status === 'completed' 
                ? 'bg-emerald-500 text-white' 
                : milestone.status === 'current'
                ? 'bg-blue-500 text-white ring-4 ring-blue-100'
                : milestone.status === 'overdue'
                ? 'bg-red-500 text-white'
                : 'bg-slate-200 text-slate-400'
              }
            `}>
              {milestone.status === 'completed' ? (
                <CheckCircleSolidIcon className="w-5 h-5" />
              ) : (
                <span className="scale-75">{milestone.icon}</span>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`
                  text-sm font-semibold
                  ${milestone.status === 'completed' ? 'text-emerald-700' : 
                    milestone.status === 'current' ? 'text-blue-700' : 
                    milestone.status === 'overdue' ? 'text-red-700' : 'text-slate-600'}
                `}>
                  {isRtl && milestone.labelAr ? milestone.labelAr : milestone.label}
                </p>
                
                {milestone.date && (
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${milestone.status === 'completed' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : milestone.status === 'current'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                    }
                  `}>
                    {formatDateString(milestone.date)}
                  </span>
                )}
              </div>
              
              {milestone.description && (
                <p className="text-xs text-slate-500 mt-1">
                  {isRtl && milestone.descriptionAr ? milestone.descriptionAr : milestone.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Helper component for quick status summary
 * Status is AUTO-CALCULATED by the backend status engine - never manually set
 * 
 * Status Workflow:
 * 1. planning           - Initial state when shipment is created
 * 2. delayed            - Agreed shipping date passed, no BL/AWB
 * 3. sailed             - BL/AWB entered AND ETA available
 * 4. awaiting_clearance - ETA date <= current date (arrived at port)
 * 5. loaded_to_final    - Clearance date recorded
 * 6. received           - Warehouse confirmed without issues
 * 7. quality_issue      - Warehouse confirmed with issues
 */
export function ShipmentStatusSummary({ shipment }: { shipment: Shipment }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const getStatusInfo = () => {
    switch (shipment.status) {
      case 'planning':
        return { 
          label: isRtl ? 'تخطيط' : 'Planning', 
          color: 'bg-gray-100 text-gray-700',
          step: 1 
        };
      case 'delayed':
        return { 
          label: isRtl ? 'متأخر' : 'Delayed', 
          color: 'bg-red-100 text-red-700',
          step: 2 
        };
      case 'sailed':
        return { 
          label: isRtl ? 'أبحرت / في الطريق' : 'Sailed / In Transit', 
          color: 'bg-blue-100 text-blue-700',
          step: 3 
        };
      case 'awaiting_clearance':
        return { 
          label: isRtl ? 'في انتظار التخليص' : 'Awaiting Clearance', 
          color: 'bg-amber-100 text-amber-700',
          step: 4 
        };
      case 'loaded_to_final':
        return { 
          label: isRtl ? 'محملة للوجهة النهائية' : 'Loaded to Final', 
          color: 'bg-purple-100 text-purple-700',
          step: 5 
        };
      case 'received':
        return { 
          label: isRtl ? 'تم الاستلام' : 'Received', 
          color: 'bg-green-100 text-green-700',
          step: 6 
        };
      case 'quality_issue':
        return { 
          label: isRtl ? 'مشكلة جودة' : 'Quality Issue', 
          color: 'bg-orange-100 text-orange-700',
          step: 7 
        };
      // Legacy status mappings for backwards compatibility
      case 'booked':
      case 'gate_in':
        return { 
          label: isRtl ? 'تخطيط' : 'Planning', 
          color: 'bg-gray-100 text-gray-700',
          step: 1 
        };
      case 'loaded':
        return { 
          label: isRtl ? 'أبحرت' : 'Sailed', 
          color: 'bg-blue-100 text-blue-700',
          step: 3 
        };
      case 'arrived':
        return { 
          label: isRtl ? 'في انتظار التخليص' : 'Awaiting Clearance', 
          color: 'bg-amber-100 text-amber-700',
          step: 4 
        };
      case 'delivered':
      case 'invoiced':
        return { 
          label: isRtl ? 'تم الاستلام' : 'Received', 
          color: 'bg-green-100 text-green-700',
          step: 6 
        };
      default:
        return { 
          label: shipment.status || (isRtl ? 'غير معروف' : 'Unknown'), 
          color: 'bg-gray-100 text-gray-700',
          step: 0 
        };
    }
  };
  
  const statusInfo = getStatusInfo();
  
  return (
    <div className="group relative">
      <span className={`
        inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
        ${statusInfo.color}
      `}>
        {statusInfo.label}
      </span>
      {/* Show status reason as tooltip if available */}
      {shipment.status_reason && (
        <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -bottom-8 left-0 whitespace-nowrap max-w-[300px] truncate">
          {shipment.status_reason}
        </div>
      )}
    </div>
  );
}

export default ShipmentTimeline;

