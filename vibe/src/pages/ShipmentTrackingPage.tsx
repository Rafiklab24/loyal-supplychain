import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlassIcon, TruckIcon, DocumentTextIcon, MapPinIcon, CalendarIcon, ClockIcon, XMarkIcon, ArrowsUpDownIcon, ChevronUpIcon, ChevronDownIcon, ArrowDownTrayIcon, ClipboardDocumentIcon, CheckIcon, PencilIcon, ArrowTopRightOnSquareIcon, BuildingOffice2Icon, ExclamationTriangleIcon, GlobeAltIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useShipments } from '../hooks/useShipments';
import { useBranches } from '../hooks/useBranches';
import { getFinalDestinationDisplay } from '../hooks/useFinalDestination';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Pagination } from '../components/common/Pagination';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { formatNumber, formatDateString, statusToArabic, getStatusColor } from '../utils/format';
import { DateInput } from '../components/common/DateInput';
import { shipmentsService } from '../services/shipments';
import { ETAVerificationModal } from '../components/tracking/ETAVerificationModal';
import { TranslatedProductText } from '../components/common/TranslatedProductText';
import { StatusOverrideModal } from '../components/shipments/StatusOverrideModal';
import type { Shipment, ShipmentStatus } from '../types/api';

type SortColumn = 'sn' | 'product_text' | 'eta' | 'weight_ton' | 'container_count' | 'status' | 'customs_clearance_date' | 'days_remaining';
type TrackingTab = 'active' | 'cleared';

export function ShipmentTrackingPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [destinationTypeFilter, setDestinationTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortColumn>('eta');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
  const [editingETA, setEditingETA] = useState<string | null>(null);
  const [etaValue, setEtaValue] = useState<string>('');
  const [editingDocStatus, setEditingDocStatus] = useState<string | null>(null);
  const [docStatusValue, setDocStatusValue] = useState<string>('');
  const [editingClearanceDate, setEditingClearanceDate] = useState<string | null>(null);
  const [clearanceDateValue, setClearanceDateValue] = useState<string>('');
  // Status override modal state
  const [overrideModalShipment, setOverrideModalShipment] = useState<Shipment | null>(null);
  
  // Tab state - active (uncleared) or cleared shipments
  const [activeTab, setActiveTab] = useState<TrackingTab>('active');
  
  // ETA Verification Modal state
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [selectedShipmentForVerification, setSelectedShipmentForVerification] = useState<Shipment | null>(null);
  // When true, shows CC cost verification section in the modal
  const [showCostVerification, setShowCostVerification] = useState(false);

  const queryClient = useQueryClient();
  
  // Fetch branches for resolving branch names from IDs
  const { data: branchesData } = useBranches();

  // Destination type options for filter
  const destinationTypeOptions = [
    { value: '', label: isArabic ? 'الكل' : 'All' },
    { value: 'branch', label: isArabic ? 'الفرع' : 'Branch' },
    { value: 'customer', label: isArabic ? 'عميل خارجي' : 'External Customer' },
    { value: 'consignment', label: isArabic ? 'بضائع بالأمانة' : 'Goods in Custody' },
  ];

  // For client-side sorting of calculated fields
  const [clientSortColumn, setClientSortColumn] = useState<'days_remaining' | null>(null);
  const [clientSortDir, setClientSortDir] = useState<'asc' | 'desc'>('asc');

  // Always fetch all data to properly support tab filtering (cleared vs uncleared)
  // Client-side pagination will be applied after filtering
  const { data: rawData, isLoading, error } = useShipments({
    page: 1, // Always fetch from beginning
    limit: 1000, // Fetch all data for client-side filtering
    search: search || undefined,
    status: statusFilter || undefined,
    destinationType: destinationTypeFilter || undefined,
    sortBy: clientSortColumn ? undefined : sortBy, // Disable server sort if client sorting
    sortDir: clientSortColumn ? undefined : sortDir,
  });

  // Calculate days remaining for each shipment and apply client-side sorting if needed
  const allShipmentsWithDays = rawData ? rawData.data.map(shipment => ({
    ...shipment,
    calculated_days_remaining: (() => {
      if (!shipment.eta || !shipment.free_time_days) return null;
      const etaDate = new Date(shipment.eta);
      const deadlineDate = new Date(etaDate);
      const freeTimeDays = typeof shipment.free_time_days === 'string' 
        ? parseInt(shipment.free_time_days, 10) 
        : shipment.free_time_days;
      deadlineDate.setDate(deadlineDate.getDate() + freeTimeDays);
      const comparisonDate = shipment.customs_clearance_date 
        ? new Date(shipment.customs_clearance_date)
        : new Date();
      comparisonDate.setHours(0, 0, 0, 0);
      deadlineDate.setHours(0, 0, 0, 0);
      const diffMs = deadlineDate.getTime() - comparisonDate.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    })()
  })) : [];

  // Split shipments into cleared and uncleared
  const clearedShipments = allShipmentsWithDays.filter(s => s.customs_clearance_date);
  const unclearedShipments = allShipmentsWithDays.filter(s => !s.customs_clearance_date);

  // Client-side pagination settings
  const PAGE_SIZE = 20;

  const data = rawData ? (() => {
    // Select which shipments to show based on active tab
    let shipmentsToShow = activeTab === 'cleared' ? clearedShipments : unclearedShipments;

    // Apply client-side sorting if days_remaining is selected
    if (clientSortColumn === 'days_remaining') {
      shipmentsToShow = [...shipmentsToShow].sort((a, b) => {
        // Put shipments with data first, then those without
        if (a.calculated_days_remaining === null && b.calculated_days_remaining === null) return 0;
        if (a.calculated_days_remaining === null) return 1;
        if (b.calculated_days_remaining === null) return -1;
        
        return clientSortDir === 'asc' 
          ? a.calculated_days_remaining - b.calculated_days_remaining 
          : b.calculated_days_remaining - a.calculated_days_remaining;
      });
    }

    // Apply client-side pagination
    const totalItems = shipmentsToShow.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    const startIndex = (page - 1) * PAGE_SIZE;
    const paginatedData = shipmentsToShow.slice(startIndex, startIndex + PAGE_SIZE);

    return {
      ...rawData,
      data: paginatedData,
      pagination: {
        total: totalItems,
        totalPages: totalPages,
        page: page,
        limit: PAGE_SIZE,
      }
    };
  })() : undefined;

  const handleRowClick = (id: string) => {
    navigate(`/shipments/${id}`);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDestinationTypeFilter('');
    setSortBy('eta');
    setSortDir('asc');
    setClientSortColumn(null);
    setClientSortDir('asc');
    setPage(1);
  };

  const activeFiltersCount = [search, statusFilter, destinationTypeFilter].filter(Boolean).length;

  const handleSort = (column: SortColumn) => {
    // Handle client-side sorting for calculated fields
    if (column === 'days_remaining') {
      if (clientSortColumn === 'days_remaining') {
        setClientSortDir(clientSortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setClientSortColumn('days_remaining');
        setClientSortDir('asc');
      }
      setPage(1);
      return;
    }

    // Server-side sorting for regular fields
    setClientSortColumn(null); // Clear client sorting
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    // Handle client-sorted columns
    if (column === 'days_remaining') {
      if (clientSortColumn !== 'days_remaining') {
        return <ArrowsUpDownIcon className="w-4 h-4 opacity-30" />;
      }
      return clientSortDir === 'asc' ? 
        <ChevronUpIcon className="w-4 h-4 text-primary-600" /> : 
        <ChevronDownIcon className="w-4 h-4 text-primary-600" />;
    }

    // Handle server-sorted columns
    if (sortBy !== column) {
      return <ArrowsUpDownIcon className="w-4 h-4 opacity-30" />;
    }
    return sortDir === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 text-primary-600" /> : 
      <ChevronDownIcon className="w-4 h-4 text-primary-600" />;
  };

  // Copy tracking number to clipboard (with fallback for non-secure contexts)
  const handleCopyTracking = async (trackingNumber: string, shipmentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    try {
      // Try modern Clipboard API first (requires secure context)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(trackingNumber);
      } else {
        // Fallback for non-secure contexts (HTTP on LAN)
        const textArea = document.createElement('textarea');
        textArea.value = trackingNumber;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedTracking(shipmentId);
      setTimeout(() => setCopiedTracking(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Mutation to update ETA
  const updateETAMutation = useMutation({
    mutationFn: async ({ id, eta }: { id: string; eta: string }) => {
      return await shipmentsService.update(id, { eta });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setEditingETA(null);
    },
    onError: (error) => {
      console.error('Failed to update ETA:', error);
      alert(i18n.language === 'ar' ? 'فشل تحديث موعد الوصول' : 'Failed to update ETA');
    },
  });

  // Mutation to update document status
  const updateDocStatusMutation = useMutation({
    mutationFn: async ({ id, paperwork_status }: { id: string; paperwork_status: string }) => {
      return await shipmentsService.update(id, { paperwork_status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setEditingDocStatus(null);
    },
    onError: (error) => {
      console.error('Failed to update document status:', error);
      alert(i18n.language === 'ar' ? 'فشل تحديث حالة الأوراق' : 'Failed to update document status');
    },
  });

  // Mutation to update clearance date
  const updateClearanceDateMutation = useMutation({
    mutationFn: async ({ id, customs_clearance_date }: { id: string; customs_clearance_date: string }) => {
      return await shipmentsService.update(id, { customs_clearance_date });
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setEditingClearanceDate(null);
      
      // If a clearance date was set (not cleared), trigger the verification modal
      if (variables.customs_clearance_date) {
        // Find the shipment in the current data
        const shipment = data?.data.find(s => s.id === variables.id);
        if (shipment) {
          // Update the shipment with the new CC date for the modal
          const updatedShipment = {
            ...shipment,
            customs_clearance_date: variables.customs_clearance_date,
          };
          setSelectedShipmentForVerification(updatedShipment);
          setShowCostVerification(true);
          setVerificationModalOpen(true);
        }
      }
    },
    onError: (error) => {
      console.error('Failed to update clearance date:', error);
      alert(i18n.language === 'ar' ? 'فشل تحديث تاريخ التخليص' : 'Failed to update clearance date');
    },
  });

  // NOTE: Status is now auto-calculated by the status engine
  // Manual status updates are NOT allowed - status is derived from:
  // - Agreed shipping date vs current date (delayed detection)
  // - BL/AWB number + ETA (sailed detection)
  // - ETA vs current date (awaiting clearance detection)
  // - Clearance date (loaded to final detection)
  // - Warehouse confirmation event (received/quality_issue detection)

  // Start editing ETA
  const handleEditETA = (shipmentId: string, currentETA: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingETA(shipmentId);
    setEtaValue(currentETA || '');
  };

  // Save ETA
  const handleSaveETA = (shipmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (etaValue) {
      updateETAMutation.mutate({ id: shipmentId, eta: etaValue });
    } else {
      alert(i18n.language === 'ar' ? 'الرجاء إدخال تاريخ صالح' : 'Please enter a valid date');
    }
  };

  // Cancel editing
  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingETA(null);
    setEtaValue('');
  };

  // Start editing document status
  const handleEditDocStatus = (shipmentId: string, currentStatus: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDocStatus(shipmentId);
    setDocStatusValue(currentStatus || '');
  };

  // Save document status (allow empty to clear the status)
  const handleSaveDocStatus = (shipmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateDocStatusMutation.mutate({ id: shipmentId, paperwork_status: docStatusValue || '' });
  };

  // Cancel document status editing
  const handleCancelDocStatusEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDocStatus(null);
    setDocStatusValue('');
  };

  // NOTE: Status editing functions removed - status is auto-calculated by the status engine
  // Status transitions are triggered by:
  // - Data changes (BL number, ETA, clearance date)
  // - Date-based checks (agreed shipping date, ETA arrival)
  // - Warehouse confirmation events

  // Start editing clearance date
  const handleEditClearanceDate = (shipmentId: string, currentDate: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClearanceDate(shipmentId);
    setClearanceDateValue(currentDate || '');
  };

  // Save clearance date
  const handleSaveClearanceDate = (shipmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (clearanceDateValue) {
      updateClearanceDateMutation.mutate({ id: shipmentId, customs_clearance_date: clearanceDateValue });
    } else {
      // Allow clearing the date
      updateClearanceDateMutation.mutate({ id: shipmentId, customs_clearance_date: '' });
    }
  };

  // Cancel clearance date editing
  const handleCancelClearanceDateEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClearanceDate(null);
    setClearanceDateValue('');
  };

  // Document status options (Paper Status)
  const docStatusOptions = [
    { value: '', label: i18n.language === 'ar' ? '— فارغ —' : '— Empty —' },
    { value: 'office', label: i18n.language === 'ar' ? 'المكتب' : 'Office' },
    { value: 'office_no_bl', label: i18n.language === 'ar' ? 'المكتب بدون بوليصة' : 'Office (No B/L)' },
    { value: 'dhl', label: 'DHL' },
    { value: 'bank', label: i18n.language === 'ar' ? 'البنك' : 'Bank' },
    { value: 'customs_broker', label: i18n.language === 'ar' ? 'المخلص' : 'Customs Broker' },
    { value: 'telex_ready', label: 'TELEX READY' },
    { value: 'telex_pending', label: 'TELEX PENDING' },
  ];

  // Shipment status options (for filtering only - status is auto-calculated, not manually selectable)
  // These match the new status engine workflow
  const statusOptions = [
    { value: 'planning', label: i18n.language === 'ar' ? 'تخطيط' : 'Planning' },
    { value: 'delayed', label: i18n.language === 'ar' ? 'متأخر' : 'Delayed' },
    { value: 'sailed', label: i18n.language === 'ar' ? 'أبحرت' : 'Sailed' },
    { value: 'awaiting_clearance', label: i18n.language === 'ar' ? 'في انتظار التخليص' : 'Awaiting Clearance' },
    { value: 'pending_transport', label: i18n.language === 'ar' ? 'في انتظار تعيين النقل' : 'Pending Transport' },
    { value: 'loaded_to_final', label: i18n.language === 'ar' ? 'في الطريق للوجهة' : 'On Way to Destination' },
    { value: 'received', label: i18n.language === 'ar' ? 'تم الاستلام' : 'Received' },
    { value: 'quality_issue', label: i18n.language === 'ar' ? 'مشكلة جودة' : 'Quality Issue' },
  ];

  // Open shipping company website
  const handleOpenTrackingWebsite = (companyName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Common shipping line tracking URLs
    const trackingUrls: Record<string, string> = {
      'maersk': 'https://www.maersk.com/tracking',
      'msc': 'https://www.msc.com/track-a-shipment',
      'cma cgm': 'https://www.cma-cgm.com/ebusiness/tracking',
      'hapag': 'https://www.hapag-lloyd.com/en/online-business/track-trace.html',
      'hapag-lloyd': 'https://www.hapag-lloyd.com/en/online-business/track-trace.html',
      'cosco': 'https://elines.coscoshipping.com/ebusiness/cargoTracking',
      'evergreen': 'https://www.shipmentlink.com/tvs2/jsp/TVS2_InteractiveTVS.jsp',
      'yang ming': 'https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx',
      'one': 'https://ecomm.one-line.com/ecom/CUP_HOM_3301.do',
      'zim': 'https://www.zim.com/tools/track-a-shipment',
      'hyundai': 'https://www.hmm21.com/cms/business/ebiz/trackTrace/trackTrace/index.jsp',
      'default': 'https://www.google.com/search?q='
    };
    
    const companyLower = companyName.toLowerCase();
    let trackingUrl = trackingUrls.default + encodeURIComponent(companyName + ' shipping tracking');
    
    // Find matching tracking URL
    for (const [key, url] of Object.entries(trackingUrls)) {
      if (companyLower.includes(key)) {
        trackingUrl = url;
        break;
      }
    }
    
    window.open(trackingUrl, '_blank');
  };

  // Export to Excel (CSV format)
  const handleExport = () => {
    if (!data || !data.data || data.data.length === 0) {
      return;
    }

    const headers = [
      i18n.language === 'ar' ? 'رقم العقد' : 'Contract No.',
      i18n.language === 'ar' ? 'نوع البضاعة' : 'Type of Goods',
      i18n.language === 'ar' ? 'الحالة' : 'Status',
      i18n.language === 'ar' ? 'عدد الحاويات' : 'Containers',
      i18n.language === 'ar' ? 'الوزن (طن)' : 'Weight (tons)',
      i18n.language === 'ar' ? 'الوجهة' : 'POD',
      i18n.language === 'ar' ? 'الوجهة النهائية' : 'Final Destination',
      i18n.language === 'ar' ? 'موعد الوصول' : 'ETA',
      i18n.language === 'ar' ? 'الأيام المتبقية (Demurrage)' : 'Days Remaining (Demurrage)',
      i18n.language === 'ar' ? 'تاريخ التخليص' : 'Customs Date',
      i18n.language === 'ar' ? 'حالة الأوراق' : 'Document Status',
      i18n.language === 'ar' ? 'شركة الشحن' : 'Shipping Company',
      i18n.language === 'ar' ? 'رقم التتبع' : 'Tracking No.'
    ];

    const rows = data.data.map(shipment => {
      const destInfo = getFinalDestinationDisplay(shipment.final_destination as any, branchesData?.branches, isArabic);
      return [
        shipment.sn || '',
        shipment.product_text || '',
        shipment.status || '',
        shipment.container_count || '',
        shipment.weight_ton || '',
        shipment.pod_name || '',
        destInfo.deliveryPlace || '',
        shipment.eta ? formatDateString(shipment.eta) : '',
        (() => {
          if (!shipment.eta || !shipment.free_time_days) return '';
          const etaDate = new Date(shipment.eta);
          const deadlineDate = new Date(etaDate);
          const freeTimeDays = typeof shipment.free_time_days === 'string' 
            ? parseInt(shipment.free_time_days, 10) 
            : shipment.free_time_days;
          deadlineDate.setDate(deadlineDate.getDate() + freeTimeDays);
          const comparisonDate = shipment.customs_clearance_date 
            ? new Date(shipment.customs_clearance_date)
            : new Date();
          comparisonDate.setHours(0, 0, 0, 0);
          deadlineDate.setHours(0, 0, 0, 0);
          const diffMs = deadlineDate.getTime() - comparisonDate.getTime();
          const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (daysRemaining < 0) return `${Math.abs(daysRemaining)} days overdue`;
          return `${daysRemaining} days left`;
        })(),
        shipment.customs_clearance_date ? formatDateString(shipment.customs_clearance_date) : '',
        shipment.paperwork_status || (i18n.language === 'ar' ? 'غير محدد' : 'Not specified'),
        shipment.shipping_line_name || '',
        shipment.bl_no || shipment.booking_no || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shipment_tracking_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick status categories
  const statusCategories = [
    { value: '', label: i18n.language === 'ar' ? 'الكل' : 'All', count: data?.pagination.total || 0 },
    { value: 'planning', label: statusToArabic('planning') },
    { value: 'booked', label: statusToArabic('booked') },
    { value: 'sailed', label: statusToArabic('sailed') },
    { value: 'arrived', label: statusToArabic('arrived') },
    { value: 'delivered', label: statusToArabic('delivered') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <TruckIcon className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              {i18n.language === 'ar' ? 'تتبع الشحنات' : 'Shipment Tracking'}
            </h1>
          </div>
          {data?.pagination && (
            <p className="mt-2 text-sm text-gray-500">
              {i18n.language === 'ar' ? 'إجمالي' : 'Total'}: {formatNumber(data.pagination.total)} {i18n.language === 'ar' ? 'شحنة' : 'shipments'}
            </p>
          )}
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={() => navigate('/shipments')}
          >
            <DocumentTextIcon className="w-5 h-5 me-2" />
            {i18n.language === 'ar' ? 'العرض الكامل' : 'Full View'}
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!data || !data.data || data.data.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg"
          >
            <ArrowDownTrayIcon className="w-5 h-5 me-2" />
            {i18n.language === 'ar' ? 'تصدير' : 'Export'}
          </Button>
        </div>
      </div>

      {/* Info Banners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
            <MapPinIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                {i18n.language === 'ar' ? 'عرض التتبع المبسط' : 'Simplified Tracking View'}
              </h3>
              <p className="text-xs text-blue-700">
                {i18n.language === 'ar' 
                  ? 'يعرض هذا القسم المعلومات الأساسية لتتبع الشحنات فقط. للحصول على التفاصيل الكاملة، انتقل إلى العرض الكامل.'
                  : 'This section displays essential shipment tracking information only. For complete details, navigate to the full view.'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
            <TruckIcon className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-green-900 mb-1">
                {i18n.language === 'ar' ? 'سير العمل السريع' : 'Quick Tracking Workflow'}
              </h3>
              <p className="text-xs text-green-700">
                {i18n.language === 'ar' 
                  ? '1️⃣ انقر على رقم التتبع لنسخه • 2️⃣ انقر على اسم شركة الشحن لفتح موقعهم • 3️⃣ الصق الرقم وتحقق من التحديثات • 4️⃣ انقر على موعد الوصول أو تاريخ التخليص أو حالة الأوراق لتحديثهم مباشرة'
                  : '1️⃣ Click tracking number to copy • 2️⃣ Click shipping company to open their site • 3️⃣ Paste and check updates • 4️⃣ Click ETA, Customs Date, or document status to update directly'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Tabs">
          <button
            onClick={() => {
              setActiveTab('active');
              setPage(1);
            }}
            className={`py-4 px-1 relative font-semibold text-base transition-colors flex items-center gap-2 ${
              activeTab === 'active'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
            }`}
          >
            <TruckIcon className="w-5 h-5" />
            {i18n.language === 'ar' ? 'تتبع الشحنات' : 'Track Shipments'}
            <Badge color={activeTab === 'active' ? 'blue' : 'gray'}>
              {unclearedShipments.length}
            </Badge>
          </button>
          <button
            onClick={() => {
              setActiveTab('cleared');
              setPage(1);
            }}
            className={`py-4 px-1 relative font-semibold text-base transition-colors flex items-center gap-2 ${
              activeTab === 'cleared'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
            }`}
          >
            <CheckCircleIcon className="w-5 h-5" />
            {i18n.language === 'ar' ? 'الشحنات المخلصة' : 'Cleared Shipments'}
            <Badge color={activeTab === 'cleared' ? 'emerald' : 'gray'}>
              {clearedShipments.length}
            </Badge>
          </button>
        </nav>
      </div>

      {/* Quick Status Categories - Only show on active tab */}
      {activeTab === 'active' && (
        <div className="flex flex-wrap gap-2">
          {statusCategories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {
                setStatusFilter(cat.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === cat.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Destination Type Filter Buttons */}
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-gray-600">
            <BuildingOffice2Icon className="w-5 h-5" />
            <span className="text-sm font-medium">
              {isArabic ? 'نوع الوجهة:' : 'Destination Type:'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {destinationTypeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setDestinationTypeFilter(option.value);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  destinationTypeFilter === option.value
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Search & Filters */}
      <Card>
        <div className="space-y-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={i18n.language === 'ar' 
                ? '🔍 البحث في رقم العقد، نوع البضاعة، الوجهة، شركة الشحن...' 
                : '🔍 Search by contract number, goods type, destination, shipping company...'}
              className="w-full ps-10 pe-10 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                {activeFiltersCount} {i18n.language === 'ar' ? 'فلتر نشط' : 'active filter(s)'}
              </span>
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 hover:text-primary-700 underline"
              >
                {i18n.language === 'ar' ? 'مسح الكل' : 'Clear All'}
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* ETA Verification Modal */}
      {selectedShipmentForVerification && (
        <ETAVerificationModal
          isOpen={verificationModalOpen}
          onClose={() => {
            setVerificationModalOpen(false);
            setSelectedShipmentForVerification(null);
            setShowCostVerification(false);
          }}
          shipment={selectedShipmentForVerification}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['shipments'] });
          }}
          showCostVerification={showCostVerification}
        />
      )}

      {/* Status Override Modal */}
      {overrideModalShipment && (
        <StatusOverrideModal
          shipmentId={overrideModalShipment.id}
          shipmentSN={overrideModalShipment.sn}
          currentStatus={overrideModalShipment.status as ShipmentStatus}
          currentReason={overrideModalShipment.status_reason}
          isOverridden={!!overrideModalShipment.status_override_by}
          overrideBy={overrideModalShipment.status_override_by}
          onClose={() => setOverrideModalShipment(null)}
        />
      )}

      {/* Arriving Today - ETA Verification Required - Only show on active tab */}
      {activeTab === 'active' && unclearedShipments.length > 0 && (() => {
        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        // Filter shipments arriving today (ETA = today) that haven't been cleared yet
        const arrivingToday = unclearedShipments.filter(s => {
          if (!s.eta) return false;
          const etaDate = s.eta.split('T')[0];
          return etaDate === todayStr;
        });
        
        if (arrivingToday.length === 0) return null;
        
        // Helper to check if shipment needs verification
        const needsVerification = (shipment: Shipment & { calculated_days_remaining?: number | null }) => {
          const missingFB = !shipment.final_beneficiary_name;
          const missingFD = !shipment.final_destination?.delivery_place && !shipment.final_destination?.warehouse_id;
          const needsBorder = shipment.pod_country?.toLowerCase().includes('turk') && !shipment.primary_border_crossing_id;
          return { missingFB, missingFD, needsBorder, hasMissing: missingFB || missingFD || needsBorder };
        };
        
        // Count shipments needing verification
        const shipmentsNeedingVerification = arrivingToday.filter(s => needsVerification(s).hasMissing);
        
        return (
          <Card>
            <div className="border-b border-amber-200 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center animate-pulse">
                    <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                      {i18n.language === 'ar' ? '⚠️ واصلة اليوم - تحتاج تأكيد' : '⚠️ Arriving Today - Verification Needed'}
                      <Badge color="amber">{arrivingToday.length}</Badge>
                      {shipmentsNeedingVerification.length > 0 && (
                        <Badge color="red">{shipmentsNeedingVerification.length} {i18n.language === 'ar' ? 'ناقص' : 'incomplete'}</Badge>
                      )}
                    </h2>
                    <p className="text-sm text-amber-700">
                      {i18n.language === 'ar' 
                        ? 'يرجى التأكد من بيانات المستفيد النهائي والوجهة ونقطة العبور'
                        : 'Please verify Final Beneficiary, Destination & Border Crossing'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-amber-700">
                    {formatNumber(arrivingToday.reduce((sum, s) => sum + (Number(s.weight_ton) || 0), 0))} MT
                  </div>
                  <div className="text-xs text-amber-600">
                    {i18n.language === 'ar' ? 'إجمالي الوزن الواصل' : 'Total Arriving Weight'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'رقم العقد' : 'Contract No.'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-amber-700 uppercase tracking-wider">
                      {i18n.language === 'ar' ? 'نوع البضاعة' : 'Type of Goods'}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'الوزن (طن)' : 'Weight (MT)'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'ميناء التفريغ' : 'POD'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'المستفيد (FB)' : 'FB'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'الوجهة (FD)' : 'FD'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'نقطة العبور' : 'Border'}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'إجراء' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {arrivingToday.map((shipment) => {
                    const verification = needsVerification(shipment);
                    return (
                      <tr
                        key={shipment.id}
                        className={`transition-colors ${verification.hasMissing ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {verification.hasMissing ? (
                              <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                            ) : (
                              <CheckIcon className="w-4 h-4 text-emerald-500" />
                            )}
                            <span 
                              className="text-sm font-medium text-primary-600 cursor-pointer hover:underline"
                              onClick={() => handleRowClick(shipment.id)}
                            >
                              {shipment.sn || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                          <TranslatedProductText text={shipment.product_text} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-end">
                          {shipment.weight_ton ? formatNumber(shipment.weight_ton) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4 text-gray-400" />
                            {shipment.pod_name || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {shipment.final_beneficiary_name ? (
                            <span className="text-emerald-700 font-medium">{shipment.final_beneficiary_name}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <ExclamationTriangleIcon className="w-4 h-4" />
                              {i18n.language === 'ar' ? 'ناقص' : 'Missing'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {(() => {
                            const destInfo = getFinalDestinationDisplay(shipment.final_destination as any, branchesData?.branches, isArabic);
                            return destInfo.displayText ? (
                              <span className="text-emerald-700 font-medium">
                                {destInfo.displayText}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                {i18n.language === 'ar' ? 'ناقص' : 'Missing'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {shipment.primary_border_name ? (
                            <div className="flex items-center gap-1">
                              <GlobeAltIcon className="w-4 h-4 text-indigo-500" />
                              <span className="text-indigo-700 font-medium">{shipment.primary_border_name}</span>
                            </div>
                          ) : shipment.pod_country?.toLowerCase().includes('turk') ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <GlobeAltIcon className="w-4 h-4" />
                              {i18n.language === 'ar' ? 'مطلوب' : 'Required'}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedShipmentForVerification(shipment as Shipment);
                              setShowCostVerification(false); // ETA verification, no cost check needed
                              setVerificationModalOpen(true);
                            }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              verification.hasMissing
                                ? 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {verification.hasMissing 
                              ? (i18n.language === 'ar' ? '⚠️ تأكيد' : '⚠️ Verify')
                              : (i18n.language === 'ar' ? '✓ تعديل' : '✓ Edit')
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-amber-100">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-amber-800">
                      {i18n.language === 'ar' ? 'الإجمالي' : 'TOTAL'}: {arrivingToday.length} {i18n.language === 'ar' ? 'شحنة' : 'shipment(s)'}
                      {shipmentsNeedingVerification.length > 0 && (
                        <span className="ms-2 text-red-700">
                          ({shipmentsNeedingVerification.length} {i18n.language === 'ar' ? 'تحتاج تأكيد' : 'need verification'})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-amber-800 text-end">
                      {formatNumber(arrivingToday.reduce((sum, s) => sum + (Number(s.weight_ton) || 0), 0))} MT
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* Summary Header for Cleared Tab */}
      {activeTab === 'cleared' && clearedShipments.length > 0 && (
        <Card>
          <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-emerald-900">
                  {i18n.language === 'ar' ? 'الشحنات المخلصة - انتهاء التتبع الدولي' : 'Cleared Shipments - International Tracking Complete'}
                </h2>
                <p className="text-sm text-emerald-700">
                  {i18n.language === 'ar' 
                    ? 'الشحنات التي تم إدخال تاريخ تخليصها'
                    : 'Shipments with customs clearance date entered'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-emerald-700">
                {formatNumber(clearedShipments.reduce((sum, s) => sum + (Number(s.weight_ton) || 0), 0))} MT
              </div>
              <div className="text-sm text-emerald-600">
                {clearedShipments.reduce((sum, s) => sum + (Number(s.container_count) || 0), 0)} {i18n.language === 'ar' ? 'حاوية' : 'containers'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tracking Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            {t('common.error')}
          </div>
        ) : !data?.data.length ? (
          <div className="text-center py-12">
            <TruckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">{t('shipments.noResults')}</p>
            {(search || statusFilter) && (
              <Button variant="primary" onClick={clearFilters} className="mt-4">
                {t('shipments.clearFilters')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={activeTab === 'cleared' ? 'bg-emerald-50' : 'bg-gray-50'}>
                  <tr>
                    <th
                      onClick={() => handleSort('sn')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        {i18n.language === 'ar' ? 'رقم العقد' : 'Contract No.'}
                        <SortIcon column="sn" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('product_text')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none min-w-[200px]"
                    >
                      <div className="flex items-center gap-2">
                        {i18n.language === 'ar' ? 'نوع البضاعة' : 'Type of Goods'}
                        <SortIcon column="product_text" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        {i18n.language === 'ar' ? 'الحالة' : 'Status'}
                        <SortIcon column="status" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('container_count')}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center justify-center gap-2">
                        {i18n.language === 'ar' ? 'الحاويات' : 'Containers'}
                        <SortIcon column="container_count" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('weight_ton')}
                      className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-2">
                        {i18n.language === 'ar' ? 'الوزن (طن)' : 'Weight (tons)'}
                        <SortIcon column="weight_ton" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'الوجهة' : 'POD'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <BuildingOffice2Icon className="w-4 h-4" />
                        {i18n.language === 'ar' ? 'الوجهة النهائية' : 'Final Destination'}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('eta')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {i18n.language === 'ar' ? 'موعد الوصول' : 'ETA'}
                        <SortIcon column="eta" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('days_remaining')}
                      className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none w-24"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        <span className="whitespace-normal leading-tight">{i18n.language === 'ar' ? 'الأيام المتبقية' : 'Days Left'}</span>
                        <SortIcon column="days_remaining" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('customs_clearance_date')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        {i18n.language === 'ar' ? 'تاريخ التخليص' : 'Customs Date'}
                        <SortIcon column="customs_clearance_date" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      <DocumentTextIcon className="w-4 h-4 inline me-1" />
                      {i18n.language === 'ar' ? 'حالة الأوراق' : 'Document Status'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'شركة الشحن' : 'Shipping Company'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {i18n.language === 'ar' ? 'رقم التتبع' : 'Tracking No.'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.data.map((shipment) => (
                    <tr
                      key={shipment.id}
                      onClick={() => handleRowClick(shipment.id)}
                      className={`transition-colors cursor-pointer ${activeTab === 'cleared' ? 'hover:bg-emerald-50' : 'hover:bg-blue-50'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-primary-600">
                        {shipment.sn || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 min-w-[200px] max-w-[280px]">
                        <div className="line-clamp-2">
                          <TranslatedProductText text={shipment.product_text} />
                        </div>
                      </td>
                      {/* Status column - click to override */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div 
                          className="group relative cursor-pointer"
                          onClick={() => setOverrideModalShipment(shipment)}
                          title={isArabic ? 'انقر لتغيير الحالة' : 'Click to override status'}
                        >
                          <div className="flex items-center gap-2">
                            <Badge color={getStatusColor(shipment.status) as any}>
                              {(() => {
                                // Map status to display label
                                const statusLabels: Record<string, { en: string; ar: string }> = {
                                  planning: { en: 'Planning', ar: 'تخطيط' },
                                  delayed: { en: 'Delayed', ar: 'متأخر' },
                                  sailed: { en: 'Sailed', ar: 'أبحرت' },
                                  awaiting_clearance: { en: 'Awaiting Clearance', ar: 'في انتظار التخليص' },
                                  pending_transport: { en: 'Pending Transport', ar: 'في انتظار تعيين النقل' },
                                  loaded_to_final: { en: 'On Way to Destination', ar: 'في الطريق للوجهة' },
                                  received: { en: 'Received', ar: 'تم الاستلام' },
                                  quality_issue: { en: 'Quality Issue', ar: 'مشكلة جودة' },
                                  // Legacy status mappings
                                  booked: { en: 'Planning', ar: 'تخطيط' },
                                  gate_in: { en: 'Planning', ar: 'تخطيط' },
                                  loaded: { en: 'Sailed', ar: 'أبحرت' },
                                  arrived: { en: 'Awaiting Clearance', ar: 'في انتظار التخليص' },
                                  delivered: { en: 'Received', ar: 'تم الاستلام' },
                                  invoiced: { en: 'Received', ar: 'تم الاستلام' },
                                };
                                const label = statusLabels[shipment.status || ''] || { en: shipment.status || '—', ar: shipment.status || '—' };
                                return i18n.language === 'ar' ? label.ar : label.en;
                              })()}
                            </Badge>
                            {/* Show edit icon on hover */}
                            <PencilIcon className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {/* Override indicator */}
                          {shipment.status_override_by && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              {isArabic ? 'تم التجاوز يدوياً' : 'Manually overridden'}
                            </div>
                          )}
                          {/* Tooltip showing status reason */}
                          {shipment.status_reason && (
                            <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -bottom-10 left-0 whitespace-nowrap max-w-[250px] truncate">
                              {shipment.status_reason}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                        {shipment.container_count ? formatNumber(shipment.container_count) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-end">
                        {shipment.weight_ton ? formatNumber(shipment.weight_ton) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center gap-1">
                          <MapPinIcon className="w-4 h-4 text-gray-400" />
                          {shipment.pod_name || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {(() => {
                          const destInfo = getFinalDestinationDisplay(shipment.final_destination as any, branchesData?.branches, isArabic);
                          // Only show the delivery place (final destination), not the owner
                          const destination = destInfo.deliveryPlace;
                          return destination ? (
                            <div className="flex items-center gap-1">
                              <BuildingOffice2Icon className="w-4 h-4 text-emerald-500" />
                              <span className="text-emerald-700 font-medium max-w-[150px] truncate" title={destination}>
                                {destination}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          );
                        })()}
                      </td>
                      <td 
                        className="px-4 py-3 whitespace-nowrap text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingETA === shipment.id ? (
                          <div className="flex items-center gap-1">
                            <DateInput
                              value={etaValue}
                              onChange={(val) => setEtaValue(val)}
                              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveETA(shipment.id, e as unknown as React.MouseEvent);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit(e as unknown as React.MouseEvent);
                                }
                              }}
                            />
                            <button
                              onClick={(e) => handleSaveETA(shipment.id, e)}
                              disabled={updateETAMutation.isPending}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              title={i18n.language === 'ar' ? 'حفظ' : 'Save'}
                            >
                              {updateETAMutation.isPending ? (
                                <Spinner size="sm" />
                              ) : (
                                <CheckIcon className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={updateETAMutation.isPending}
                              className="p-1 text-gray-500 hover:bg-gray-50 rounded disabled:opacity-50"
                              title={i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleEditETA(shipment.id, shipment.eta, e)}
                            className="flex items-center gap-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors group"
                            title={i18n.language === 'ar' ? 'انقر للتعديل' : 'Click to edit'}
                          >
                            <CalendarIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            <span>{formatDateString(shipment.eta)}</span>
                            <PencilIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-3 text-sm text-center w-24">
                        {(() => {
                          // Use pre-calculated days remaining
                          const daysRemaining = shipment.calculated_days_remaining;
                          
                          if (daysRemaining === null || daysRemaining === undefined) {
                            return <span className="text-gray-400">—</span>;
                          }
                          
                          // If already exceeded (negative)
                          if (daysRemaining < 0) {
                            return (
                              <span className="text-red-700 font-bold text-xs leading-tight block">
                                {Math.abs(daysRemaining)} {i18n.language === 'ar' ? 'يوم' : 'd'} ⛔
                              </span>
                            );
                          }
                          
                          // If 7 days or less: RED ALERT
                          if (daysRemaining <= 7) {
                            return (
                              <span className="text-red-600 font-bold text-sm">
                                {daysRemaining} {i18n.language === 'ar' ? 'يوم' : 'd'} ⚠️
                              </span>
                            );
                          }
                          
                          // Normal display (more than 7 days)
                          return (
                            <span className="text-gray-700 text-sm">
                              {daysRemaining} {i18n.language === 'ar' ? 'يوم' : 'd'}
                            </span>
                          );
                        })()}
                      </td>
                      <td 
                        className="px-4 py-3 whitespace-nowrap text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingClearanceDate === shipment.id ? (
                          <div className="flex items-center gap-1">
                            <DateInput
                              value={clearanceDateValue}
                              onChange={(val) => setClearanceDateValue(val)}
                              className="border-green-300 focus:ring-green-500 focus:border-green-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveClearanceDate(shipment.id, e as unknown as React.MouseEvent);
                                } else if (e.key === 'Escape') {
                                  handleCancelClearanceDateEdit(e as unknown as React.MouseEvent);
                                }
                              }}
                            />
                            <button
                              onClick={(e) => handleSaveClearanceDate(shipment.id, e)}
                              disabled={updateClearanceDateMutation.isPending}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              title={i18n.language === 'ar' ? 'حفظ' : 'Save'}
                            >
                              {updateClearanceDateMutation.isPending ? (
                                <Spinner size="sm" />
                              ) : (
                                <CheckIcon className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={handleCancelClearanceDateEdit}
                              disabled={updateClearanceDateMutation.isPending}
                              className="p-1 text-gray-500 hover:bg-gray-50 rounded disabled:opacity-50"
                              title={i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleEditClearanceDate(shipment.id, shipment.customs_clearance_date, e)}
                            className="flex items-center gap-2 text-gray-700 hover:text-green-600 hover:bg-green-50 px-2 py-1 rounded transition-colors group"
                            title={i18n.language === 'ar' ? 'انقر للتعديل' : 'Click to edit'}
                          >
                            <CalendarIcon className="w-4 h-4 text-gray-400 group-hover:text-green-500" />
                            <span>{shipment.customs_clearance_date ? formatDateString(shipment.customs_clearance_date) : (i18n.language === 'ar' ? 'غير محدد' : 'Not set')}</span>
                            <PencilIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-green-500" />
                          </button>
                        )}
                      </td>
                      <td 
                        className="px-4 py-3 whitespace-nowrap text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingDocStatus === shipment.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={docStatusValue}
                              onChange={(e) => setDocStatusValue(e.target.value)}
                              className="px-2 py-1 border border-purple-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-w-[140px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveDocStatus(shipment.id, e as any);
                                } else if (e.key === 'Escape') {
                                  handleCancelDocStatusEdit(e as any);
                                }
                              }}
                            >
                              {docStatusOptions.map(opt => (
                                <option key={opt.value || 'empty'} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={(e) => handleSaveDocStatus(shipment.id, e)}
                              disabled={updateDocStatusMutation.isPending}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              title={i18n.language === 'ar' ? 'حفظ' : 'Save'}
                            >
                              {updateDocStatusMutation.isPending ? (
                                <Spinner size="sm" />
                              ) : (
                                <CheckIcon className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={handleCancelDocStatusEdit}
                              disabled={updateDocStatusMutation.isPending}
                              className="p-1 text-gray-500 hover:bg-gray-50 rounded disabled:opacity-50"
                              title={i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleEditDocStatus(shipment.id, shipment.paperwork_status, e)}
                            className="flex items-center gap-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition-colors group w-full"
                            title={i18n.language === 'ar' ? 'انقر للتعديل' : 'Click to edit'}
                          >
                            <DocumentTextIcon className="w-4 h-4 text-gray-400 group-hover:text-purple-500" />
                            <span className="flex-1 text-start">
                              {shipment.paperwork_status ? (
                                docStatusOptions.find(opt => opt.value === shipment.paperwork_status)?.label || shipment.paperwork_status
                              ) : (
                                <span className="text-gray-400 italic">{i18n.language === 'ar' ? 'غير محدد' : 'Not set'}</span>
                              )}
                            </span>
                            <PencilIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-500" />
                          </button>
                        )}
                      </td>
                      <td 
                        className="px-4 py-3 whitespace-nowrap text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {shipment.shipping_line_name ? (
                          <button
                            onClick={(e) => handleOpenTrackingWebsite(shipment.shipping_line_name!, e)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            title={i18n.language === 'ar' ? 'فتح موقع التتبع' : 'Open tracking website'}
                          >
                            <span>{shipment.shipping_line_name}</span>
                            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td 
                        className="px-4 py-3 whitespace-nowrap text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(shipment.bl_no || shipment.booking_no) ? (
                          <button
                            onClick={(e) => handleCopyTracking(shipment.bl_no || shipment.booking_no || '', shipment.id, e)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md transition-all font-mono text-xs border ${
                              copiedTracking === shipment.id 
                                ? 'bg-green-100 border-green-300 text-green-700 scale-105' 
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300 hover:shadow-sm'
                            }`}
                            title={i18n.language === 'ar' ? '📋 انقر للنسخ' : '📋 Click to copy'}
                          >
                            {copiedTracking === shipment.id ? (
                              <>
                                <CheckIcon className="w-4 h-4 text-green-600 animate-pulse" />
                                <span className="text-green-700 font-semibold">
                                  {i18n.language === 'ar' ? '✓ تم النسخ!' : '✓ Copied!'}
                                </span>
                              </>
                            ) : (
                              <>
                                <ClipboardDocumentIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate max-w-[150px]">{shipment.bl_no || shipment.booking_no}</span>
                                <span className="text-[10px] bg-blue-200 text-blue-800 px-1 rounded hidden sm:inline">
                                  {i18n.language === 'ar' ? 'نسخ' : 'COPY'}
                                </span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {clientSortColumn ? (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  {i18n.language === 'ar' 
                    ? `عرض جميع الشحنات (${data.data.length}) مرتبة حسب الأيام المتبقية`
                    : `Showing all shipments (${data.data.length}) sorted by days remaining`}
                </p>
                <button
                  onClick={() => {
                    setClientSortColumn(null);
                    setPage(1);
                  }}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-700 underline"
                >
                  {i18n.language === 'ar' ? 'العودة إلى الترتيب العادي' : 'Return to normal view'}
                </button>
              </div>
            ) : data.pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={page}
                  totalPages={data.pagination.totalPages || Math.ceil(data.pagination.total / data.pagination.limit)}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

