/**
 * Global Stock Dashboard
 * Single source of truth for all stock-related information
 * Consolidates: Overview, Lots Management, Stock by Product, Reports
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CubeIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
  DocumentChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import ExcelJS from 'exceljs';
import { useAntrepoLots, useAntrepoInventory, useCreateLot, useUpdateLot } from '../hooks/useAntrepo';
import { getLotOccupancyReport, getLotTypeLabel } from '../services/antrepo';
import type { AntrepoLot, CreateLotInput, UpdateLotInput, AntrepoInventory } from '../services/antrepo';

// Default antrepo ID - in production would come from context/selection
const DEFAULT_ANTREPO_ID = '0c6dead9-7768-4a22-acc1-f0424004bd0a';

type TabId = 'overview' | 'lots' | 'products' | 'reports';

interface TabConfig {
  id: TabId;
  icon: typeof CubeIcon;
  labelKey: string;
}

const TABS: TabConfig[] = [
  { id: 'overview', icon: ChartBarIcon, labelKey: 'stock.overview' },
  { id: 'lots', icon: ArchiveBoxIcon, labelKey: 'stock.lots' },
  { id: 'products', icon: CubeIcon, labelKey: 'stock.byProduct' },
  { id: 'reports', icon: DocumentChartBarIcon, labelKey: 'stock.reports' },
];

export default function StockDashboardPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language;

  // State
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const { data: lots, isLoading: lotsLoading } = useAntrepoLots(DEFAULT_ANTREPO_ID, includeInactive);
  const { data: inventoryData, isLoading: inventoryLoading } = useAntrepoInventory({ 
    antrepo_id: DEFAULT_ANTREPO_ID, 
    page: 1, 
    limit: 500 
  });

  const inventory = inventoryData?.data || [];

  // Calculate totals
  const stockTotals = useMemo(() => {
    if (!inventory.length) return {
      totalActualMT: 0,
      totalCustomsMT: 0,
      totalDiscrepancy: 0,
      totalItems: 0,
      totalBags: 0,
    };

    return inventory.reduce((acc, item) => {
      const actualMT = item.actual_quantity_mt ?? item.current_quantity_mt ?? 0;
      const customsMT = item.customs_quantity_mt ?? item.current_quantity_mt ?? 0;
      return {
        totalActualMT: acc.totalActualMT + Number(actualMT),
        totalCustomsMT: acc.totalCustomsMT + Number(customsMT),
        totalDiscrepancy: acc.totalDiscrepancy + (Number(customsMT) - Number(actualMT)),
        totalItems: acc.totalItems + 1,
        totalBags: acc.totalBags + (item.actual_bags ?? item.quantity_bags ?? 0),
      };
    }, { totalActualMT: 0, totalCustomsMT: 0, totalDiscrepancy: 0, totalItems: 0, totalBags: 0 });
  }, [inventory]);

  // Group by product
  const productGroups = useMemo(() => {
    const groups: Record<string, {
      product: string;
      actualMT: number;
      customsMT: number;
      items: number;
      bags: number;
    }> = {};

    inventory.forEach(item => {
      const product = item.product_text || 'Unknown';
      if (!groups[product]) {
        groups[product] = { product, actualMT: 0, customsMT: 0, items: 0, bags: 0 };
      }
      groups[product].actualMT += Number(item.actual_quantity_mt ?? item.current_quantity_mt ?? 0);
      groups[product].customsMT += Number(item.customs_quantity_mt ?? item.current_quantity_mt ?? 0);
      groups[product].items += 1;
      groups[product].bags += item.actual_bags ?? item.quantity_bags ?? 0;
    });

    return Object.values(groups).sort((a, b) => b.actualMT - a.actualMT);
  }, [inventory]);

  // Group by lot
  const lotGroups = useMemo(() => {
    const groups: Record<string, {
      lotCode: string;
      lotName: string;
      actualMT: number;
      customsMT: number;
      items: number;
    }> = {};

    inventory.forEach(item => {
      const lotCode = item.lot_code || 'Unknown';
      if (!groups[lotCode]) {
        groups[lotCode] = { 
          lotCode, 
          lotName: isRtl ? (item.lot_name_ar || item.lot_name || '') : (item.lot_name || ''),
          actualMT: 0, 
          customsMT: 0, 
          items: 0 
        };
      }
      groups[lotCode].actualMT += Number(item.actual_quantity_mt ?? item.current_quantity_mt ?? 0);
      groups[lotCode].customsMT += Number(item.customs_quantity_mt ?? item.current_quantity_mt ?? 0);
      groups[lotCode].items += 1;
    });

    return Object.values(groups).sort((a, b) => b.actualMT - a.actualMT);
  }, [inventory, isRtl]);

  const formatNumber = (num: number, decimals = 3) => {
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  const getTabLabel = (tab: TabConfig) => {
    const labels: Record<string, Record<string, string>> = {
      'stock.overview': { en: 'Overview', ar: 'نظرة عامة', tr: 'Genel Bakış' },
      'stock.lots': { en: 'Lots', ar: 'الأقسام', tr: 'Lotlar' },
      'stock.byProduct': { en: 'By Product', ar: 'حسب المنتج', tr: 'Ürüne Göre' },
      'stock.reports': { en: 'Reports', ar: 'التقارير', tr: 'Raporlar' },
    };
    return labels[tab.labelKey]?.[lang] || labels[tab.labelKey]?.['en'] || tab.labelKey;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <CubeIcon className="h-7 w-7 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">
                    {lang === 'ar' ? 'لوحة المخزون' : lang === 'tr' ? 'Stok Paneli' : 'Stock Dashboard'}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {lang === 'ar' ? 'المصدر الموحد لجميع معلومات المخزون' : lang === 'tr' ? 'Tüm stok bilgileri için tek kaynak' : 'Single source of truth for all stock information'}
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{formatNumber(stockTotals.totalActualMT)}</p>
                  <p className="text-xs text-slate-500">{lang === 'ar' ? 'المخزون الفعلي (طن)' : 'Actual (MT)'}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{formatNumber(stockTotals.totalCustomsMT)}</p>
                  <p className="text-xs text-slate-500">{lang === 'ar' ? 'المخزون الجمركي (طن)' : 'Customs (MT)'}</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${stockTotals.totalDiscrepancy >= 0 ? 'text-slate-600' : 'text-red-600'}`}>
                    {stockTotals.totalDiscrepancy >= 0 ? '+' : ''}{formatNumber(stockTotals.totalDiscrepancy)}
                  </p>
                  <p className="text-xs text-slate-500">{lang === 'ar' ? 'الفرق' : 'Diff'}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex items-center gap-1 border-b border-slate-200 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  {getTabLabel(tab)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            stockTotals={stockTotals}
            lotGroups={lotGroups}
            productGroups={productGroups}
            inventory={inventory}
            isLoading={inventoryLoading}
            lang={lang}
            formatNumber={formatNumber}
          />
        )}

        {activeTab === 'lots' && (
          <LotsTab
            lots={lots || []}
            isLoading={lotsLoading}
            includeInactive={includeInactive}
            setIncludeInactive={setIncludeInactive}
            inventory={inventory}
            lang={lang}
            isRtl={isRtl}
            formatNumber={formatNumber}
            antrepoId={DEFAULT_ANTREPO_ID}
          />
        )}

        {activeTab === 'products' && (
          <ProductsTab
            productGroups={productGroups}
            inventory={inventory}
            isLoading={inventoryLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            lang={lang}
            formatNumber={formatNumber}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab
            stockTotals={stockTotals}
            lotGroups={lotGroups}
            productGroups={productGroups}
            lots={lots || []}
            lang={lang}
            isRtl={isRtl}
            formatNumber={formatNumber}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================
interface OverviewTabProps {
  stockTotals: {
    totalActualMT: number;
    totalCustomsMT: number;
    totalDiscrepancy: number;
    totalItems: number;
    totalBags: number;
  };
  lotGroups: { lotCode: string; lotName: string; actualMT: number; customsMT: number; items: number }[];
  productGroups: { product: string; actualMT: number; customsMT: number; items: number; bags: number }[];
  inventory: AntrepoInventory[];
  isLoading: boolean;
  lang: string;
  formatNumber: (num: number, decimals?: number) => string;
}

function OverviewTab({ stockTotals, lotGroups, productGroups, inventory, isLoading, lang, formatNumber }: OverviewTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const discrepancyPercent = stockTotals.totalCustomsMT > 0 
    ? ((stockTotals.totalDiscrepancy / stockTotals.totalCustomsMT) * 100).toFixed(2)
    : '0';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Actual Stock Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">
              {lang === 'ar' ? 'المخزون الفعلي' : lang === 'tr' ? 'Fiili Stok' : 'Actual Stock'}
            </span>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CubeIcon className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{formatNumber(stockTotals.totalActualMT)}</p>
          <p className="text-sm text-slate-500 mt-1">MT</p>
        </div>

        {/* Customs Stock Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">
              {lang === 'ar' ? 'المخزون الجمركي' : lang === 'tr' ? 'Gümrük Stoğu' : 'Customs Stock'}
            </span>
            <div className="p-2 bg-amber-100 rounded-lg">
              <DocumentChartBarIcon className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-600">{formatNumber(stockTotals.totalCustomsMT)}</p>
          <p className="text-sm text-slate-500 mt-1">MT</p>
        </div>

        {/* Discrepancy Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">
              {lang === 'ar' ? 'الفرق' : lang === 'tr' ? 'Fark' : 'Discrepancy'}
            </span>
            <div className={`p-2 rounded-lg ${stockTotals.totalDiscrepancy >= 0 ? 'bg-slate-100' : 'bg-red-100'}`}>
              {stockTotals.totalDiscrepancy >= 0 
                ? <ArrowTrendingUpIcon className="h-5 w-5 text-slate-600" />
                : <ArrowTrendingDownIcon className="h-5 w-5 text-red-600" />
              }
            </div>
          </div>
          <p className={`text-3xl font-bold ${stockTotals.totalDiscrepancy >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
            {stockTotals.totalDiscrepancy >= 0 ? '+' : ''}{formatNumber(stockTotals.totalDiscrepancy)}
          </p>
          <p className="text-sm text-slate-500 mt-1">MT ({discrepancyPercent}%)</p>
        </div>

        {/* Items Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">
              {lang === 'ar' ? 'العناصر' : lang === 'tr' ? 'Öğeler' : 'Items'}
            </span>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <ArchiveBoxIcon className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-indigo-600">{stockTotals.totalItems}</p>
          <p className="text-sm text-slate-500 mt-1">{formatNumber(stockTotals.totalBags, 0)} {lang === 'ar' ? 'كيس' : 'bags'}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Lot */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            {lang === 'ar' ? 'المخزون حسب القسم' : lang === 'tr' ? 'Lota Göre Stok' : 'Stock by Lot'}
          </h3>
          <div className="space-y-3">
            {lotGroups.slice(0, 6).map((lot) => {
              const maxMT = Math.max(...lotGroups.map(l => l.actualMT));
              const percentage = maxMT > 0 ? (lot.actualMT / maxMT) * 100 : 0;
              return (
                <div key={lot.lotCode} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{lot.lotCode} - {lot.lotName}</span>
                    <span className="text-slate-500">{formatNumber(lot.actualMT)} MT</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {lotGroups.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                {lang === 'ar' ? 'لا توجد بيانات' : 'No data available'}
              </p>
            )}
          </div>
        </div>

        {/* Stock by Product */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            {lang === 'ar' ? 'المخزون حسب المنتج' : lang === 'tr' ? 'Ürüne Göre Stok' : 'Stock by Product'}
          </h3>
          <div className="space-y-3">
            {productGroups.slice(0, 6).map((product) => {
              const maxMT = Math.max(...productGroups.map(p => p.actualMT));
              const percentage = maxMT > 0 ? (product.actualMT / maxMT) * 100 : 0;
              return (
                <div key={product.product} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{product.product}</span>
                    <span className="text-slate-500">{formatNumber(product.actualMT)} MT</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {productGroups.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                {lang === 'ar' ? 'لا توجد بيانات' : 'No data available'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {stockTotals.totalDiscrepancy < -1 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">
                {lang === 'ar' ? 'تنبيه: فرق في المخزون' : 'Alert: Stock Discrepancy'}
              </h4>
              <p className="text-sm text-red-600 mt-1">
                {lang === 'ar' 
                  ? `يوجد فرق ${formatNumber(Math.abs(stockTotals.totalDiscrepancy))} طن بين المخزون الفعلي والجمركي. يرجى التحقق من السجلات.`
                  : `There is a ${formatNumber(Math.abs(stockTotals.totalDiscrepancy))} MT discrepancy between actual and customs stock. Please review records.`
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LOTS TAB
// ============================================================
interface LotsTabProps {
  lots: AntrepoLot[];
  isLoading: boolean;
  includeInactive: boolean;
  setIncludeInactive: (value: boolean) => void;
  inventory: AntrepoInventory[];
  lang: string;
  isRtl: boolean;
  formatNumber: (num: number, decimals?: number) => string;
  antrepoId: string;
}

function LotsTab({ lots, isLoading, includeInactive, setIncludeInactive, inventory, lang, isRtl, formatNumber, antrepoId }: LotsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<AntrepoLot | null>(null);
  const [viewingLot, setViewingLot] = useState<AntrepoLot | null>(null);
  const createLot = useCreateLot();
  const updateLot = useUpdateLot();

  const [formData, setFormData] = useState<Partial<CreateLotInput | UpdateLotInput>>({
    code: '',
    name: '',
    name_ar: '',
    description: '',
    capacity_mt: undefined,
    lot_type: 'standard',
    sort_order: 0,
  });

  // Get inventory for viewing lot
  const lotInventory = useMemo(() => {
    if (!viewingLot) return [];
    return inventory.filter(item => item.lot_id === viewingLot.id);
  }, [viewingLot, inventory]);

  // Calculate lot stock from inventory
  const getLotStock = (lotId: string) => {
    const items = inventory.filter(item => item.lot_id === lotId);
    return items.reduce((acc, item) => ({
      actualMT: acc.actualMT + Number(item.actual_quantity_mt ?? item.current_quantity_mt ?? 0),
      customsMT: acc.customsMT + Number(item.customs_quantity_mt ?? item.current_quantity_mt ?? 0),
      items: acc.items + 1,
    }), { actualMT: 0, customsMT: 0, items: 0 });
  };

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
        await updateLot.mutateAsync({ id: editingLot.id, data: formData as UpdateLotInput });
      } else {
        await createLot.mutateAsync({ ...formData, antrepo_id: antrepoId } as CreateLotInput);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving lot:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Lot detail view
  if (viewingLot) {
    const lotStock = getLotStock(viewingLot.id);
    return (
      <div className="space-y-4">
        {/* Back button and header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewingLot(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <span>←</span>
            <span>{lang === 'ar' ? 'العودة للأقسام' : 'Back to Lots'}</span>
          </button>
        </div>

        {/* Lot header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                {viewingLot.code} - {isRtl && viewingLot.name_ar ? viewingLot.name_ar : viewingLot.name}
              </h2>
              <p className="text-slate-500">{getLotTypeLabel(viewingLot.lot_type, isRtl ? 'ar' : 'en')}</p>
            </div>
          </div>

          {/* Stock summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-600">{lang === 'ar' ? 'المخزون الفعلي' : 'Actual Stock'}</p>
              <p className="text-2xl font-bold text-emerald-700">{formatNumber(lotStock.actualMT)} MT</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-600">{lang === 'ar' ? 'المخزون الجمركي' : 'Customs Stock'}</p>
              <p className="text-2xl font-bold text-amber-700">{formatNumber(lotStock.customsMT)} MT</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm text-indigo-600">{lang === 'ar' ? 'العناصر' : 'Items'}</p>
              <p className="text-2xl font-bold text-indigo-700">{lotStock.items}</p>
            </div>
          </div>
        </div>

        {/* Inventory table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">
              {lang === 'ar' ? 'محتويات القسم' : 'Lot Contents'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    {lang === 'ar' ? 'المنتج' : 'Product'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    {lang === 'ar' ? 'الشحنة' : 'Shipment'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    {lang === 'ar' ? 'المخزون الفعلي' : 'Actual'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    {lang === 'ar' ? 'المخزون الجمركي' : 'Customs'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    {lang === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lotInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{item.product_text || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{item.shipment_sn || '-'}</td>
                    <td className="px-4 py-3 text-sm text-center text-emerald-600 font-medium">
                      {formatNumber(item.actual_quantity_mt ?? item.current_quantity_mt ?? 0)} MT
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-amber-600 font-medium">
                      {formatNumber(item.customs_quantity_mt ?? item.current_quantity_mt ?? 0)} MT
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        item.status === 'in_stock' ? 'bg-green-100 text-green-700' :
                        item.status === 'partial_exit' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {lotInventory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      {lang === 'ar' ? 'لا توجد عناصر في هذا القسم' : 'No items in this lot'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 text-indigo-600 rounded"
          />
          {lang === 'ar' ? 'إظهار الأقسام غير الفعالة' : 'Show inactive lots'}
        </label>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <PlusIcon className="h-5 w-5" />
          {lang === 'ar' ? 'إضافة قسم' : 'Add Lot'}
        </button>
      </div>

      {/* Lots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lots.map((lot) => {
          const stock = getLotStock(lot.id);
          return (
            <div
              key={lot.id}
              className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer ${
                !lot.is_active ? 'opacity-60' : ''
              }`}
              onClick={() => setViewingLot(lot)}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{lot.code}</h3>
                  <p className="text-sm text-slate-500">
                    {isRtl && lot.name_ar ? lot.name_ar : lot.name}
                  </p>
                </div>
                <span className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded">
                  {getLotTypeLabel(lot.lot_type, isRtl ? 'ar' : 'en')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-2 bg-emerald-50 rounded">
                  <p className="text-xs text-emerald-600">{lang === 'ar' ? 'فعلي' : 'Actual'}</p>
                  <p className="font-bold text-emerald-700">{formatNumber(stock.actualMT)} MT</p>
                </div>
                <div className="p-2 bg-amber-50 rounded">
                  <p className="text-xs text-amber-600">{lang === 'ar' ? 'جمركي' : 'Customs'}</p>
                  <p className="font-bold text-amber-700">{formatNumber(stock.customsMT)} MT</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{stock.items} {lang === 'ar' ? 'عنصر' : 'items'}</span>
                {lot.capacity_mt && (
                  <span className="text-slate-400">
                    {lang === 'ar' ? 'السعة:' : 'Cap:'} {formatNumber(lot.capacity_mt, 0)} MT
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(lot); }}
                  className="flex-1 px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  {lang === 'ar' ? 'تعديل' : 'Edit'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {lots.length === 0 && (
        <div className="text-center py-12">
          <ArchiveBoxIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{lang === 'ar' ? 'لا توجد أقسام' : 'No lots found'}</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              {editingLot 
                ? (lang === 'ar' ? 'تعديل القسم' : 'Edit Lot')
                : (lang === 'ar' ? 'إضافة قسم جديد' : 'Add New Lot')
              }
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {lang === 'ar' ? 'الرمز' : 'Code'} *
                  </label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {lang === 'ar' ? 'النوع' : 'Type'}
                  </label>
                  <select
                    value={formData.lot_type || 'standard'}
                    onChange={(e) => setFormData({ ...formData, lot_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="standard">{lang === 'ar' ? 'قياسي' : 'Standard'}</option>
                    <option value="cold_storage">{lang === 'ar' ? 'تبريد' : 'Cold Storage'}</option>
                    <option value="hazmat">{lang === 'ar' ? 'مواد خطرة' : 'Hazmat'}</option>
                    <option value="outdoor">{lang === 'ar' ? 'خارجي' : 'Outdoor'}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'} *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {lang === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}
                </label>
                <input
                  type="text"
                  value={formData.name_ar || ''}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {lang === 'ar' ? 'السعة (طن)' : 'Capacity (MT)'}
                </label>
                <input
                  type="number"
                  value={formData.capacity_mt || ''}
                  onChange={(e) => setFormData({ ...formData, capacity_mt: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={createLot.isPending || updateLot.isPending}
                  className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:bg-slate-400"
                >
                  {lang === 'ar' ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PRODUCTS TAB
// ============================================================
interface ProductsTabProps {
  productGroups: { product: string; actualMT: number; customsMT: number; items: number; bags: number }[];
  inventory: AntrepoInventory[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  lang: string;
  formatNumber: (num: number, decimals?: number) => string;
}

function ProductsTab({ productGroups, inventory, isLoading, searchQuery, setSearchQuery, lang, formatNumber }: ProductsTabProps) {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const filteredProducts = productGroups.filter(p =>
    p.product.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProductItems = (product: string) => {
    return inventory.filter(item => item.product_text === product);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder={lang === 'ar' ? 'البحث عن منتج...' : 'Search products...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Products List */}
      <div className="space-y-3">
        {filteredProducts.map((product) => (
          <div key={product.product} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div
              className="p-4 cursor-pointer hover:bg-slate-50"
              onClick={() => setExpandedProduct(expandedProduct === product.product ? null : product.product)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-slate-800">{product.product}</h3>
                  <p className="text-sm text-slate-500">{product.items} {lang === 'ar' ? 'عنصر' : 'items'}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">{formatNumber(product.actualMT)} MT</p>
                    <p className="text-xs text-slate-500">{lang === 'ar' ? 'فعلي' : 'Actual'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-600">{formatNumber(product.customsMT)} MT</p>
                    <p className="text-xs text-slate-500">{lang === 'ar' ? 'جمركي' : 'Customs'}</p>
                  </div>
                  <span className={`transform transition-transform ${expandedProduct === product.product ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </div>
            </div>

            {expandedProduct === product.product && (
              <div className="border-t border-slate-200 bg-slate-50 p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left pb-2">{lang === 'ar' ? 'القسم' : 'Lot'}</th>
                      <th className="text-left pb-2">{lang === 'ar' ? 'الشحنة' : 'Shipment'}</th>
                      <th className="text-center pb-2">{lang === 'ar' ? 'فعلي' : 'Actual'}</th>
                      <th className="text-center pb-2">{lang === 'ar' ? 'جمركي' : 'Customs'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getProductItems(product.product).map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="py-2 font-medium">{item.lot_code}</td>
                        <td className="py-2 text-slate-500">{item.shipment_sn || '-'}</td>
                        <td className="py-2 text-center text-emerald-600">
                          {formatNumber(item.actual_quantity_mt ?? item.current_quantity_mt ?? 0)} MT
                        </td>
                        <td className="py-2 text-center text-amber-600">
                          {formatNumber(item.customs_quantity_mt ?? item.current_quantity_mt ?? 0)} MT
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <CubeIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{lang === 'ar' ? 'لا توجد منتجات' : 'No products found'}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// REPORTS TAB
// ============================================================
interface ReportsTabProps {
  stockTotals: {
    totalActualMT: number;
    totalCustomsMT: number;
    totalDiscrepancy: number;
    totalItems: number;
    totalBags: number;
  };
  lotGroups: { lotCode: string; lotName: string; actualMT: number; customsMT: number; items: number }[];
  productGroups: { product: string; actualMT: number; customsMT: number; items: number; bags: number }[];
  lots: AntrepoLot[];
  lang: string;
  isRtl: boolean;
  formatNumber: (num: number, decimals?: number) => string;
}

function ReportsTab({ stockTotals, lotGroups, productGroups, lots, lang, isRtl, formatNumber }: ReportsTabProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = async (reportType: 'lots' | 'products' | 'summary') => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Loyal International';
      workbook.created = new Date();

      const translations = {
        lotCode: lang === 'ar' ? 'رمز القسم' : 'Lot Code',
        lotName: lang === 'ar' ? 'اسم القسم' : 'Lot Name',
        product: lang === 'ar' ? 'المنتج' : 'Product',
        actualStock: lang === 'ar' ? 'المخزون الفعلي (طن)' : 'Actual Stock (MT)',
        customsStock: lang === 'ar' ? 'المخزون الجمركي (طن)' : 'Customs Stock (MT)',
        items: lang === 'ar' ? 'العناصر' : 'Items',
        total: lang === 'ar' ? 'الإجمالي' : 'Total',
        reportTitle: lang === 'ar' ? 'تقرير المخزون' : 'Stock Report',
      };

      const sheetName = lang === 'ar' ? 'تقرير المخزون' : 'Stock Report';
      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ rightToLeft: isRtl, showGridLines: false }],
      });

      // Try to add logo
      try {
        const logoUrl = isRtl ? '/images/Logo-ar.png' : '/images/Logo-en.png';
        const response = await fetch(logoUrl);
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const logoId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
          worksheet.addImage(logoId, { tl: { col: 2, row: 0.15 }, ext: { width: 150, height: 50 } });
        }
      } catch (e) {
        console.log('Could not load logo');
      }

      // Header styling
      worksheet.mergeCells('A1:E1');
      worksheet.getRow(1).height = 60;
      worksheet.getCell('A1').border = {};

      worksheet.mergeCells('A2:E2');
      const titleCell = worksheet.getCell('A2');
      titleCell.value = translations.reportTitle;
      titleCell.font = { bold: true, size: 18, color: { argb: 'FF1E3A5F' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.border = {};
      worksheet.getRow(2).height = 35;

      worksheet.mergeCells('A3:E3');
      const dateCell = worksheet.getCell('A3');
      const now = new Date();
      dateCell.value = `${lang === 'ar' ? 'تاريخ التقرير:' : 'Generated:'} ${now.toLocaleDateString()} - ${now.toLocaleTimeString()}`;
      dateCell.font = { size: 11, color: { argb: 'FF666666' }, italic: true };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      dateCell.border = {};
      worksheet.getRow(3).height = 22;

      worksheet.getRow(4).height = 15;
      worksheet.mergeCells('A4:E4');
      worksheet.getCell('A4').border = {};

      // Data based on report type
      let data: any[] = [];
      let headers: string[] = [];

      if (reportType === 'lots') {
        headers = [translations.lotCode, translations.lotName, translations.actualStock, translations.customsStock, translations.items];
        data = lotGroups.map(lot => [lot.lotCode, lot.lotName, lot.actualMT.toFixed(3), lot.customsMT.toFixed(3), lot.items]);
        data.push([translations.total, '', stockTotals.totalActualMT.toFixed(3), stockTotals.totalCustomsMT.toFixed(3), stockTotals.totalItems]);
      } else if (reportType === 'products') {
        headers = [translations.product, translations.actualStock, translations.customsStock, translations.items, ''];
        data = productGroups.map(p => [p.product, p.actualMT.toFixed(3), p.customsMT.toFixed(3), p.items, '']);
        data.push([translations.total, stockTotals.totalActualMT.toFixed(3), stockTotals.totalCustomsMT.toFixed(3), stockTotals.totalItems, '']);
      } else {
        headers = ['', translations.actualStock, translations.customsStock, '', ''];
        data = [
          [lang === 'ar' ? 'إجمالي المخزون' : 'Total Stock', stockTotals.totalActualMT.toFixed(3), stockTotals.totalCustomsMT.toFixed(3), '', ''],
          [lang === 'ar' ? 'عدد العناصر' : 'Total Items', stockTotals.totalItems, stockTotals.totalItems, '', ''],
          [lang === 'ar' ? 'عدد الأقسام' : 'Total Lots', lots.length, lots.length, '', ''],
          [lang === 'ar' ? 'عدد المنتجات' : 'Total Products', productGroups.length, productGroups.length, '', ''],
        ];
      }

      // Headers row
      const headerRow = worksheet.getRow(5);
      headerRow.values = headers;
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1E3A5F' } },
          bottom: { style: 'thin', color: { argb: 'FF1E3A5F' } },
          left: { style: 'thin', color: { argb: 'FF1E3A5F' } },
          right: { style: 'thin', color: { argb: 'FF1E3A5F' } },
        };
      });

      // Data rows
      data.forEach((rowData, index) => {
        const row = worksheet.getRow(6 + index);
        row.values = rowData;
        row.height = 24;
        const isLast = index === data.length - 1;
        row.eachCell((cell) => {
          cell.font = isLast ? { bold: true, size: 12, color: { argb: 'FFFFFFFF' } } : { size: 11 };
          cell.fill = isLast 
            ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
            : { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? 'FFF3F4F6' : 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: isLast ? 'FF047857' : 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: isLast ? 'FF047857' : 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: isLast ? 'FF047857' : 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: isLast ? 'FF047857' : 'FFD1D5DB' } },
          };
        });
      });

      // Column widths
      worksheet.columns = [
        { width: reportType === 'products' ? 40 : 18 },
        { width: 28 },
        { width: 25 },
        { width: 25 },
        { width: 15 },
      ];

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `Stock_Report_${reportType}_${today}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lots Report */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <ArchiveBoxIcon className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {lang === 'ar' ? 'تقرير الأقسام' : 'Lots Report'}
              </h3>
              <p className="text-sm text-slate-500">
                {lang === 'ar' ? 'المخزون حسب القسم' : 'Stock by lot'}
              </p>
            </div>
          </div>
          <button
            onClick={() => exportToExcel('lots')}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {lang === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          </button>
        </div>

        {/* Products Report */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CubeIcon className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {lang === 'ar' ? 'تقرير المنتجات' : 'Products Report'}
              </h3>
              <p className="text-sm text-slate-500">
                {lang === 'ar' ? 'المخزون حسب المنتج' : 'Stock by product'}
              </p>
            </div>
          </div>
          <button
            onClick={() => exportToExcel('products')}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {lang === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          </button>
        </div>

        {/* Summary Report */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <DocumentChartBarIcon className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {lang === 'ar' ? 'تقرير ملخص' : 'Summary Report'}
              </h3>
              <p className="text-sm text-slate-500">
                {lang === 'ar' ? 'ملخص عام للمخزون' : 'Overall stock summary'}
              </p>
            </div>
          </div>
          <button
            onClick={() => exportToExcel('summary')}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-slate-400"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {lang === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">
          {lang === 'ar' ? 'إحصائيات سريعة' : 'Quick Stats'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-3xl font-bold text-slate-700">{formatNumber(stockTotals.totalActualMT)}</p>
            <p className="text-sm text-slate-500">{lang === 'ar' ? 'إجمالي المخزون الفعلي (طن)' : 'Total Actual (MT)'}</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-3xl font-bold text-slate-700">{formatNumber(stockTotals.totalCustomsMT)}</p>
            <p className="text-sm text-slate-500">{lang === 'ar' ? 'إجمالي المخزون الجمركي (طن)' : 'Total Customs (MT)'}</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-3xl font-bold text-slate-700">{stockTotals.totalItems}</p>
            <p className="text-sm text-slate-500">{lang === 'ar' ? 'عدد العناصر' : 'Total Items'}</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-3xl font-bold text-slate-700">{productGroups.length}</p>
            <p className="text-sm text-slate-500">{lang === 'ar' ? 'عدد المنتجات' : 'Product Types'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
