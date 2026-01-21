/**
 * Antrepo Lots Management Page
 * Manage physical storage locations within the antrepo
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@headlessui/react';
import {
  ArchiveBoxIcon,
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  EyeIcon,
  CubeIcon,
  DocumentTextIcon,
  ScaleIcon,
  ChevronLeftIcon,
  TruckIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import ExcelJS from 'exceljs';
import { useAntrepoLots, useCreateLot, useUpdateLot, useAntrepoInventory } from '../hooks/useAntrepo';
import { getLotTypeLabel, getStatusLabel, getLotOccupancyReport } from '../services/antrepo';
import type { AntrepoLot, CreateLotInput, UpdateLotInput } from '../services/antrepo';

// Hardcoded for now - in production would come from branch selection
const DEFAULT_ANTREPO_ID = '0c6dead9-7768-4a22-acc1-f0424004bd0a'; // LOYAL Antrepo

const LOT_TYPES = ['standard', 'cold_storage', 'hazmat', 'outdoor'] as const;

export default function AntrepoLotsPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  // State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<AntrepoLot | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [viewingLot, setViewingLot] = useState<AntrepoLot | null>(null);

  // Data
  const { data: lots, isLoading } = useAntrepoLots(DEFAULT_ANTREPO_ID, includeInactive);
  const { data: lotInventory, isLoading: inventoryLoading } = useAntrepoInventory(
    viewingLot ? { lot_id: viewingLot.id, page: 1, limit: 100 } : undefined
  );
  const createLot = useCreateLot();
  const updateLot = useUpdateLot();

  // Form state
  const [formData, setFormData] = useState<Partial<CreateLotInput | UpdateLotInput>>({
    code: '',
    name: '',
    name_ar: '',
    description: '',
    capacity_mt: undefined,
    lot_type: 'standard',
    sort_order: 0,
  });

  const openCreateModal = () => {
    setEditingLot(null);
    setFormData({
      code: '',
      name: '',
      name_ar: '',
      description: '',
      capacity_mt: undefined,
      lot_type: 'standard',
      sort_order: lots?.length || 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (lot: AntrepoLot) => {
    setEditingLot(lot);
    setFormData({
      code: lot.code,
      name: lot.name,
      name_ar: lot.name_ar || '',
      description: lot.description || '',
      capacity_mt: lot.capacity_mt,
      lot_type: lot.lot_type,
      sort_order: lot.sort_order,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingLot) {
        await updateLot.mutateAsync({
          id: editingLot.id,
          data: formData as UpdateLotInput,
        });
      } else {
        await createLot.mutateAsync({
          ...formData,
          antrepo_id: DEFAULT_ANTREPO_ID,
        } as CreateLotInput);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving lot:', error);
    }
  };

  const handleToggleActive = async (lot: AntrepoLot) => {
    try {
      await updateLot.mutateAsync({
        id: lot.id,
        data: { is_active: !lot.is_active },
      });
    } catch (error) {
      console.error('Error toggling lot status:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const openLotDetails = (lot: AntrepoLot) => {
    setViewingLot(lot);
  };

  const closeLotDetails = () => {
    setViewingLot(null);
  };

  // Export lots summary to Excel
  const [isExporting, setIsExporting] = useState(false);
  
  const exportLotsToExcel = async () => {
    if (!lots || lots.length === 0) return;
    
    setIsExporting(true);
    try {
      // Get translations with proper fallbacks
      const lang = i18n.language;
      const translations = {
        lotCode: lang === 'ar' ? 'رمز القسم' : lang === 'tr' ? 'Lot Kodu' : 'Lot Code',
        lotName: lang === 'ar' ? 'اسم القسم' : lang === 'tr' ? 'Lot Adı' : 'Lot Name',
        customsStock: lang === 'ar' ? 'المخزون الجمركي (طن)' : lang === 'tr' ? 'Gümrük Stoğu (MT)' : 'Customs Stock (MT)',
        actualStock: lang === 'ar' ? 'المخزون الفعلي (طن)' : lang === 'tr' ? 'Fiili Stok (MT)' : 'Actual Stock (MT)',
        items: lang === 'ar' ? 'العناصر' : lang === 'tr' ? 'Öğeler' : 'Items',
        total: lang === 'ar' ? 'الإجمالي' : lang === 'tr' ? 'Toplam' : 'Total',
        reportTitle: lang === 'ar' ? 'تقرير مخزون الأقسام' : lang === 'tr' ? 'Lot Stok Raporu' : 'Lots Stock Report',
        generatedOn: lang === 'ar' ? 'تاريخ التقرير:' : lang === 'tr' ? 'Oluşturulma:' : 'Generated:',
      };

      // Prepare data
      let lotsData: { code: string; name: string; customs_mt: number; actual_mt: number; items: number }[] = [];
      let totals = { customs_mt: 0, actual_mt: 0, items: 0 };

      try {
        const report = await getLotOccupancyReport(DEFAULT_ANTREPO_ID);
        lotsData = report.data.map((lot) => ({
          code: lot.lot_code,
          name: isRtl && lot.lot_name_ar ? lot.lot_name_ar : lot.lot_name,
          customs_mt: Number(lot.customs_stock_mt || 0),
          actual_mt: Number(lot.actual_stock_mt || 0),
          items: lot.item_count || 0,
        }));
        totals = {
          customs_mt: report.totals.total_customs_stock_mt || 0,
          actual_mt: report.totals.total_actual_stock_mt || 0,
          items: report.totals.total_items || 0,
        };
      } catch {
        lotsData = lots.filter(lot => lot.is_active).map((lot) => ({
          code: lot.code,
          name: isRtl && lot.name_ar ? lot.name_ar : lot.name,
          customs_mt: Number(lot.current_occupancy_mt || 0),
          actual_mt: Number(lot.current_occupancy_mt || 0),
          items: lot.item_count || 0,
        }));
        totals = {
          customs_mt: lotsData.reduce((sum, l) => sum + l.customs_mt, 0),
          actual_mt: lotsData.reduce((sum, l) => sum + l.actual_mt, 0),
          items: lotsData.reduce((sum, l) => sum + l.items, 0),
        };
      }

      // Create workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Loyal International';
      workbook.created = new Date();
      
      const sheetName = lang === 'ar' ? 'مخزون الأقسام' : lang === 'tr' ? 'Lot Stokları' : 'Lots Stock';
      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ rightToLeft: isRtl, showGridLines: false }],
      });

      // Column widths
      worksheet.columns = [
        { width: 18 },  // Lot Code
        { width: 28 },  // Lot Name
        { width: 25 },  // Customs Stock
        { width: 25 },  // Actual Stock
        { width: 15 },  // Items
      ];

      // Row 1: Logo row - merge cells and center logo
      worksheet.mergeCells('A1:E1');
      worksheet.getRow(1).height = 65;
      // Remove any borders from logo row
      const logoCell = worksheet.getCell('A1');
      logoCell.border = {};
      logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

      // Load and add logo - centered in merged cell
      try {
        const logoUrl = isRtl ? '/images/Logo-ar.png' : '/images/Logo-en.png';
        const response = await fetch(logoUrl);
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const logoId = workbook.addImage({
            buffer: arrayBuffer,
            extension: 'png',
          });
          // Calculate center position: total width ~111 (18+28+25+25+15), logo at middle
          worksheet.addImage(logoId, {
            tl: { col: 2, row: 0.15 },
            ext: { width: 145, height: 50 },
          });
        }
      } catch (e) {
        console.log('Could not load logo:', e);
      }

      // Row 2: Report Title
      worksheet.mergeCells('A2:E2');
      const titleCell = worksheet.getCell('A2');
      titleCell.value = translations.reportTitle;
      titleCell.font = { bold: true, size: 18, color: { argb: 'FF1E3A5F' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.border = {};
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      worksheet.getRow(2).height = 40;

      // Row 3: Generated date
      worksheet.mergeCells('A3:E3');
      const dateCell = worksheet.getCell('A3');
      const now = new Date();
      const dateStr = lang === 'ar' 
        ? now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
        : now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      dateCell.value = `${translations.generatedOn} ${dateStr} - ${timeStr}`;
      dateCell.font = { size: 11, color: { argb: 'FF666666' }, italic: true };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      dateCell.border = {};
      dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      worksheet.getRow(3).height = 25;

      // Row 4: Empty spacer
      worksheet.mergeCells('A4:E4');
      const spacerCell = worksheet.getCell('A4');
      spacerCell.border = {};
      spacerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      worksheet.getRow(4).height = 15;

      // Row 5: Column Headers
      const headerRow = worksheet.getRow(5);
      headerRow.values = [
        translations.lotCode, 
        translations.lotName, 
        translations.customsStock, 
        translations.actualStock, 
        translations.items
      ];
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A5F' }, // Dark blue
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1E3A5F' } },
          bottom: { style: 'thin', color: { argb: 'FF1E3A5F' } },
          left: { style: 'thin', color: { argb: 'FF1E3A5F' } },
          right: { style: 'thin', color: { argb: 'FF1E3A5F' } },
        };
      });

      // Data rows
      lotsData.forEach((lot, index) => {
        const rowNum = 6 + index;
        const row = worksheet.getRow(rowNum);
        row.values = [
          lot.code,
          lot.name,
          lot.customs_mt.toFixed(3),
          lot.actual_mt.toFixed(3),
          lot.items,
        ];
        row.height = 24;
        
        const isEven = index % 2 === 0;
        row.eachCell((cell) => {
          cell.font = { size: 11 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFF3F4F6' : 'FFFFFFFF' },
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        });
      });

      // Totals row
      const totalsRowNum = 6 + lotsData.length;
      const totalsRow = worksheet.getRow(totalsRowNum);
      totalsRow.values = [
        translations.total,
        '',
        totals.customs_mt.toFixed(3),
        totals.actual_mt.toFixed(3),
        totals.items,
      ];
      totalsRow.height = 28;
      totalsRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF059669' }, // Green
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF047857' } },
          bottom: { style: 'medium', color: { argb: 'FF047857' } },
          left: { style: 'thin', color: { argb: 'FF047857' } },
          right: { style: 'thin', color: { argb: 'FF047857' } },
        };
      });

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `Antrepo_Lots_Stock_${today}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert(t('common.exportError', 'Export failed. Please try again.'));
    } finally {
      setIsExporting(false);
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '-';
    return Number(num).toLocaleString('en-US', {
      maximumFractionDigits: 1,
    });
  };

  const getOccupancyPercent = (lot: AntrepoLot) => {
    if (!lot.capacity_mt || !lot.current_occupancy_mt) return 0;
    return Math.min((Number(lot.current_occupancy_mt) / Number(lot.capacity_mt)) * 100, 100);
  };

  const getOccupancyColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <ArchiveBoxIcon className="h-8 w-8 text-indigo-600" />
              {t('antrepo.lotsTitle', 'إدارة أقسام الأنتريبو')}
            </h1>
            <p className="text-slate-600 mt-1">
              {t('antrepo.lotsSubtitle', 'إدارة أماكن التخزين الفعلية')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
              />
              {t('antrepo.showInactive', 'إظهار الأقسام غير الفعالة')}
            </label>
            <button
              onClick={exportLotsToExcel}
              disabled={isExporting || !lots || lots.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 transition-colors shadow-sm"
            >
              {isExporting ? (
                <>
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  {t('common.exporting', 'جاري التصدير...')}
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  {t('antrepo.exportExcel', 'تصدير Excel')}
                </>
              )}
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              {t('antrepo.addLot', 'إضافة قسم')}
            </button>
          </div>
        </div>
      </div>

      {/* Lots Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : !lots || lots.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-100">
          <ArchiveBoxIcon className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            {t('antrepo.noLots', 'لا توجد أقسام')}
          </h3>
          <p className="text-slate-500 mb-4">
            {t('antrepo.createFirstLot', 'قم بإنشاء أول قسم للأنتريبو')}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            {t('antrepo.addLot', 'إضافة قسم')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => (
            <div
              key={lot.id}
              className={`bg-white rounded-xl p-5 shadow-sm border transition-all ${
                lot.is_active
                  ? 'border-slate-100 hover:border-indigo-200 hover:shadow-md'
                  : 'border-slate-200 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-bold text-indigo-600">{lot.code}</span>
                    {!lot.is_active && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded">
                        {t('antrepo.inactive', 'غير فعال')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {isRtl && lot.name_ar ? lot.name_ar : lot.name}
                  </h3>
                </div>
                <button
                  onClick={() => openEditModal(lot)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Type Badge */}
              <div className="mb-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  lot.lot_type === 'standard' ? 'bg-slate-100 text-slate-700' :
                  lot.lot_type === 'cold_storage' ? 'bg-blue-100 text-blue-700' :
                  lot.lot_type === 'hazmat' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {getLotTypeLabel(lot.lot_type, lang)}
                </span>
              </div>

              {/* Area & Occupancy */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-600">{t('antrepo.area', 'المساحة')}</span>
                  <span className="font-semibold text-slate-800">
                    {formatNumber(lot.capacity_mt)} M²
                  </span>
                </div>
                {lot.current_occupancy_mt !== undefined && lot.current_occupancy_mt > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-slate-500">{t('antrepo.currentStock', 'المخزون الحالي')}</span>
                      <span className="font-medium text-slate-700">
                        {formatNumber(lot.current_occupancy_mt)} MT
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getOccupancyColor(getOccupancyPercent(lot))} transition-all`}
                        style={{ width: `${Math.min(getOccupancyPercent(lot), 100)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-slate-500 pt-3 border-t border-slate-100">
                <span>{lot.item_count || 0} {t('antrepo.items', 'عنصر')}</span>
                <button
                  onClick={() => handleToggleActive(lot)}
                  className={`text-xs font-medium ${
                    lot.is_active ? 'text-red-600 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-700'
                  }`}
                >
                  {lot.is_active ? t('antrepo.deactivate', 'تعطيل') : t('antrepo.activate', 'تفعيل')}
                </button>
              </div>

              {/* View Details Button */}
              {(lot.item_count || 0) > 0 && (
                <button
                  onClick={() => openLotDetails(lot)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 rounded-lg hover:from-indigo-100 hover:to-blue-100 transition-all border border-indigo-200 font-medium text-sm"
                >
                  <EyeIcon className="h-4 w-4" />
                  {t('antrepo.viewLotContents', 'عرض المحتويات')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-2xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <Dialog.Title className="text-lg font-semibold text-slate-800">
                {editingLot ? t('antrepo.editLot', 'تعديل القسم') : t('antrepo.createLot', 'إنشاء قسم جديد')}
              </Dialog.Title>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.lotCode', 'رمز القسم')} *
                </label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  placeholder="A1, B2, COLD-1"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.lotName', 'الاسم (إنجليزي)')} *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.lotNameAr', 'الاسم (عربي)')}
                  </label>
                  <input
                    type="text"
                    value={formData.name_ar || ''}
                    onChange={(e) => handleChange('name_ar', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Type & Capacity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.lotType', 'النوع')}
                  </label>
                  <select
                    value={formData.lot_type || 'standard'}
                    onChange={(e) => handleChange('lot_type', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {LOT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {getLotTypeLabel(type, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.areaM2', 'المساحة (م²)')}
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.capacity_mt || ''}
                    onChange={(e) => handleChange('capacity_mt', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 2700"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.description', 'الوصف')}
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('antrepo.sortOrder', 'ترتيب العرض')}
                </label>
                <input
                  type="number"
                  value={formData.sort_order || 0}
                  onChange={(e) => handleChange('sort_order', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={createLot.isPending || updateLot.isPending || !formData.code || !formData.name}
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 rounded-lg transition-colors"
                >
                  {(createLot.isPending || updateLot.isPending)
                    ? t('common.saving', 'جاري الحفظ...')
                    : editingLot
                      ? t('common.save', 'حفظ')
                      : t('common.create', 'إنشاء')}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Lot Details Modal */}
      <Dialog open={!!viewingLot} onClose={closeLotDetails} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
              <div className="flex items-center gap-4">
                <button
                  onClick={closeLotDetails}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div>
                  <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                    <ArchiveBoxIcon className="h-5 w-5" />
                    {t('antrepo.lotContents', 'محتويات القسم')} - {viewingLot?.code}
                  </Dialog.Title>
                  <p className="text-sm text-white/80">
                    {isRtl && viewingLot?.name_ar ? viewingLot.name_ar : viewingLot?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={closeLotDetails}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Summary Stats */}
            {viewingLot && (
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Total Items */}
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                      <CubeIcon className="h-4 w-4" />
                      {t('antrepo.totalItems', 'إجمالي العناصر')}
                    </div>
                    <div className="text-xl font-bold text-slate-800">
                      {lotInventory?.data?.length || 0}
                    </div>
                  </div>
                  
                  {/* Customs Stock Total */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-600 text-xs mb-1">
                      <DocumentTextIcon className="h-4 w-4" />
                      {t('antrepo.customsStock', 'المخزون الجمركي')}
                    </div>
                    <div className="text-xl font-bold text-amber-800">
                      {formatNumber(
                        lotInventory?.data?.reduce((sum, item) => 
                          sum + (item.customs_quantity_mt ?? item.original_quantity_mt ?? 0), 0
                        )
                      )} <span className="text-sm font-normal">MT</span>
                    </div>
                  </div>
                  
                  {/* Actual Stock Total */}
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-200">
                    <div className="flex items-center gap-2 text-emerald-600 text-xs mb-1">
                      <ScaleIcon className="h-4 w-4" />
                      {t('antrepo.actualStock', 'المخزون الفعلي')}
                    </div>
                    <div className="text-xl font-bold text-emerald-800">
                      {formatNumber(
                        lotInventory?.data?.reduce((sum, item) => 
                          sum + (item.actual_quantity_mt ?? item.current_quantity_mt ?? 0), 0
                        )
                      )} <span className="text-sm font-normal">MT</span>
                    </div>
                  </div>
                  
                  {/* Discrepancy Total */}
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                      <ScaleIcon className="h-4 w-4" />
                      {t('antrepo.discrepancy', 'الفرق')}
                    </div>
                    {(() => {
                      const totalDiscrepancy = lotInventory?.data?.reduce((sum, item) => 
                        sum + (item.weight_discrepancy_mt ?? 0), 0
                      ) || 0;
                      return (
                        <div className={`text-xl font-bold ${
                          totalDiscrepancy > 0 ? 'text-red-600' : 
                          totalDiscrepancy < 0 ? 'text-green-600' : 'text-slate-800'
                        }`}>
                          {totalDiscrepancy > 0 ? '-' : totalDiscrepancy < 0 ? '+' : ''}
                          {formatNumber(Math.abs(totalDiscrepancy))} <span className="text-sm font-normal">MT</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {inventoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : !lotInventory?.data || lotInventory.data.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CubeIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>{t('antrepo.noItemsInLot', 'لا توجد عناصر في هذا القسم')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lotInventory.data.map((item) => {
                    const customsMt = item.customs_quantity_mt ?? item.original_quantity_mt ?? 0;
                    const actualMt = item.actual_quantity_mt ?? item.current_quantity_mt ?? 0;
                    const customsBags = item.customs_bags ?? item.quantity_bags ?? 0;
                    const actualBags = item.actual_bags ?? item.quantity_bags ?? 0;
                    const weightDiscrepancy = item.weight_discrepancy_mt ?? (customsMt - actualMt);
                    const bagsDiscrepancy = item.bags_discrepancy ?? (customsBags - actualBags);
                    const hasDiscrepancy = Math.abs(weightDiscrepancy) > 0.001 || Math.abs(bagsDiscrepancy) > 0;

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-xl border ${
                          hasDiscrepancy ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
                        } overflow-hidden`}
                      >
                        {/* Item Header */}
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-100 rounded-lg">
                                <CubeIcon className="h-5 w-5 text-indigo-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-800">{item.product_text || t('common.noProduct', 'بدون منتج')}</h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  {item.shipment_sn && (
                                    <span className="flex items-center gap-1">
                                      <TruckIcon className="h-3 w-3" />
                                      {item.shipment_sn}
                                    </span>
                                  )}
                                  {item.origin_country && (
                                    <span>• {item.origin_country}</span>
                                  )}
                                  {item.entry_date && (
                                    <span>• {new Date(item.entry_date).toLocaleDateString('en-GB')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.status === 'in_stock' ? 'bg-emerald-100 text-emerald-700' :
                              item.status === 'partial_exit' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {getStatusLabel(item.status, lang)}
                            </span>
                          </div>
                        </div>

                        {/* Dual Stock Display */}
                        <div className="p-4">
                          <div className="grid grid-cols-3 gap-4">
                            {/* Customs Stock */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-200">
                              <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium mb-2">
                                <DocumentTextIcon className="h-4 w-4" />
                                {t('antrepo.customsStock', 'الجمركي')}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-amber-600">{t('antrepo.weight', 'الوزن')}</span>
                                  <span className="font-bold text-amber-800">{formatNumber(customsMt)} MT</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-amber-600">{t('antrepo.bags', 'الأكياس')}</span>
                                  <span className="font-semibold text-amber-800">{customsBags.toLocaleString('en-US')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Actual Stock */}
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-200">
                              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium mb-2">
                                <ScaleIcon className="h-4 w-4" />
                                {t('antrepo.actualStock', 'الفعلي')}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-emerald-600">{t('antrepo.weight', 'الوزن')}</span>
                                  <span className="font-bold text-emerald-800">{formatNumber(actualMt)} MT</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-emerald-600">{t('antrepo.bags', 'الأكياس')}</span>
                                  <span className="font-semibold text-emerald-800">{actualBags.toLocaleString('en-US')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Discrepancy */}
                            <div className={`rounded-lg p-3 border ${
                              hasDiscrepancy 
                                ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200' 
                                : 'bg-slate-50 border-slate-200'
                            }`}>
                              <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${
                                hasDiscrepancy ? 'text-red-700' : 'text-slate-500'
                              }`}>
                                <ScaleIcon className="h-4 w-4" />
                                {t('antrepo.discrepancy', 'الفرق')}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs ${hasDiscrepancy ? 'text-red-600' : 'text-slate-500'}`}>
                                    {t('antrepo.weight', 'الوزن')}
                                  </span>
                                  <span className={`font-bold ${
                                    weightDiscrepancy > 0 ? 'text-red-700' : 
                                    weightDiscrepancy < 0 ? 'text-green-700' : 'text-slate-600'
                                  }`}>
                                    {weightDiscrepancy > 0 ? '-' : weightDiscrepancy < 0 ? '+' : ''}
                                    {formatNumber(Math.abs(weightDiscrepancy))} MT
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs ${hasDiscrepancy ? 'text-red-600' : 'text-slate-500'}`}>
                                    {t('antrepo.bags', 'الأكياس')}
                                  </span>
                                  <span className={`font-semibold ${
                                    bagsDiscrepancy > 0 ? 'text-red-700' : 
                                    bagsDiscrepancy < 0 ? 'text-green-700' : 'text-slate-600'
                                  }`}>
                                    {bagsDiscrepancy > 0 ? '-' : bagsDiscrepancy < 0 ? '+' : ''}
                                    {Math.abs(bagsDiscrepancy).toLocaleString('en-US')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Discrepancy Notes */}
                          {item.discrepancy_notes && (
                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                              <span className="font-medium">{t('antrepo.discrepancyNotes', 'ملاحظات')}: </span>
                              {item.discrepancy_notes}
                            </div>
                          )}

                          {/* Additional Info */}
                          {(item.entry_declaration_no || item.supplier_name) && (
                            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap gap-4">
                              {item.entry_declaration_no && (
                                <span>
                                  <span className="font-medium">{t('antrepo.beyanameNo', 'البيانامة')}: </span>
                                  {item.entry_declaration_no}
                                </span>
                              )}
                              {item.supplier_name && (
                                <span>
                                  <span className="font-medium">{t('common.supplier', 'المورد')}: </span>
                                  {item.supplier_name}
                                </span>
                              )}
                              {item.days_in_antrepo !== undefined && (
                                <span className={item.days_in_antrepo > 30 ? 'text-amber-600 font-medium' : ''}>
                                  <span className="font-medium">{t('antrepo.daysInAntrepo', 'الأيام')}: </span>
                                  {item.days_in_antrepo}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={closeLotDetails}
                className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
              >
                {t('common.close', 'إغلاق')}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
