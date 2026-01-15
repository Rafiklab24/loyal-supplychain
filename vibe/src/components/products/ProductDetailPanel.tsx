/**
 * ProductDetailPanel - Side panel showing product details, price trend, seasons
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  BeakerIcon,
  TruckIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import {
  getProduct,
  type Product,
  PRODUCT_CATEGORIES,
  MONTH_NAMES_SHORT,
} from '../../services/products';
import { PriceBenchmarkModal } from './PriceBenchmarkModal';
import { SeasonFormModal } from './SeasonFormModal';

interface ProductDetailPanelProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProductDetailPanel({ product, onClose, onEdit, onDelete }: ProductDetailPanelProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);

  // Fetch full product details
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['product', product.id],
    queryFn: () => getProduct(product.id),
  });

  const detail = data;
  const specs = detail?.product;
  const prices = detail?.priceBenchmarks || [];
  const seasons = detail?.seasons || [];
  const stats = detail?.stats;

  // Get category name
  const getCategoryName = (code: string | undefined) => {
    if (!code) return '-';
    const cat = PRODUCT_CATEGORIES.find((c) => c.code === code);
    return isRTL && cat?.name_ar ? cat.name_ar : cat?.name || code;
  };

  // Format price trend
  const formatTrend = (latest: number, previous: number) => {
    if (!previous || previous === 0) return null;
    const change = ((latest - previous) / previous) * 100;
    const isPositive = change > 0;
    return (
      <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowTrendingUpIcon className="h-4 w-4 mr-1" /> : <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  // Render season bar
  const renderSeasonBar = (season: any) => {
    const months = Array(12).fill('bg-gray-100');
    
    // Fill harvest months
    if (season.harvest_start_month && season.harvest_end_month) {
      for (let i = season.harvest_start_month - 1; i <= season.harvest_end_month - 1; i++) {
        months[i] = 'bg-amber-400';
      }
    }
    
    // Fill peak months
    if (season.peak_start_month && season.peak_end_month) {
      for (let i = season.peak_start_month - 1; i <= season.peak_end_month - 1; i++) {
        months[i] = 'bg-emerald-500';
      }
    }

    return (
      <div className="flex gap-0.5">
        {months.map((color, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-sm ${color}`}
            title={MONTH_NAMES_SHORT[i]}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-fit sticky top-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title={t('common.edit', 'Edit')}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
            title={t('common.delete', 'Delete')}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Basic Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 w-20">{t('products.category', 'Category')}:</span>
              <span className="font-medium">{getCategoryName(product.category_type)}</span>
            </div>
            {product.sku && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-20">{t('products.sku', 'SKU')}:</span>
                <span className="font-medium">{product.sku}</span>
              </div>
            )}
            {product.hs_code && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-20">{t('products.hsCode', 'HS Code')}:</span>
                <span className="font-medium">{product.hs_code}</span>
              </div>
            )}
            {specs?.grade && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-20">{t('products.grade', 'Grade')}:</span>
                <span className="font-medium">{specs.grade}</span>
              </div>
            )}
          </div>

          {/* Price Section */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <CurrencyDollarIcon className="h-4 w-4 text-emerald-600" />
                {t('products.priceHistory', 'Price History')}
              </h4>
              <button
                onClick={() => setShowPriceModal(true)}
                className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
              >
                <PlusIcon className="h-3 w-3" />
                {t('products.addPrice', 'Add')}
              </button>
            </div>

            {prices.length > 0 ? (
              <div className="space-y-2">
                {/* Latest Price */}
                <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-emerald-700">
                        ${prices[0].price_usd_per_mt.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">/MT</span>
                    </div>
                    {prices.length > 1 && formatTrend(prices[0].price_usd_per_mt, prices[1].price_usd_per_mt)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(prices[0].price_date).toLocaleDateString('en-GB')}
                    {prices[0].origin_country && ` • ${prices[0].origin_country}`}
                    {prices[0].incoterm && ` • ${prices[0].incoterm}`}
                  </div>
                </div>

                {/* Price History */}
                {prices.length > 1 && (
                  <div className="space-y-1">
                    {prices.slice(1, 5).map((price) => (
                      <div key={price.id} className="flex items-center justify-between text-sm px-2 py-1.5 bg-gray-50 rounded">
                        <span className="text-gray-500">
                          {new Date(price.price_date).toLocaleDateString('en-GB')}
                        </span>
                        <span className="font-medium">${price.price_usd_per_mt.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-gray-500">
                {t('products.noPrices', 'No price benchmarks yet')}
              </div>
            )}
          </div>

          {/* Season Calendar */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <CalendarDaysIcon className="h-4 w-4 text-amber-600" />
                {t('products.seasonCalendar', 'Season Calendar')}
              </h4>
              <button
                onClick={() => setShowSeasonModal(true)}
                className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
              >
                <PlusIcon className="h-3 w-3" />
                {t('products.addSeason', 'Add')}
              </button>
            </div>

            {seasons.length > 0 ? (
              <div className="space-y-3">
                {/* Month labels */}
                <div className="flex gap-0.5 pl-16">
                  {MONTH_NAMES_SHORT.map((m) => (
                    <div key={m} className="w-4 text-[8px] text-gray-400 text-center">{m[0]}</div>
                  ))}
                </div>
                
                {seasons.map((season) => (
                  <div key={season.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14 truncate" title={season.origin_country}>
                      {season.origin_country}
                    </span>
                    {renderSeasonBar(season)}
                  </div>
                ))}
                
                {/* Legend */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                    <span>{t('products.peak', 'Peak')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-amber-400 rounded-sm" />
                    <span>{t('products.harvest', 'Harvest')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-gray-500">
                {t('products.noSeasons', 'No season data yet')}
              </div>
            )}
          </div>

          {/* Specs Summary */}
          {specs && (specs.moisture_pct || specs.purity_pct || specs.certifications?.length) && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1 mb-2">
                <BeakerIcon className="h-4 w-4 text-blue-600" />
                {t('products.specifications', 'Specifications')}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {specs.moisture_pct && (
                  <div>
                    <span className="text-gray-500">{t('products.moisture', 'Moisture')}:</span>
                    <span className="ml-1 font-medium">{specs.moisture_pct}%</span>
                  </div>
                )}
                {specs.purity_pct && (
                  <div>
                    <span className="text-gray-500">{t('products.purity', 'Purity')}:</span>
                    <span className="ml-1 font-medium">{specs.purity_pct}%</span>
                  </div>
                )}
                {specs.color_value && (
                  <div>
                    <span className="text-gray-500">{t('products.color', 'Color')}:</span>
                    <span className="ml-1 font-medium">{specs.color_value}</span>
                  </div>
                )}
              </div>
              {specs.certifications && specs.certifications.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {specs.certifications.map((cert: string) => (
                    <span key={cert} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                      {cert}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shipping Requirements */}
          {specs && (specs.temperature_min_c || specs.special_handling?.length) && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1 mb-2">
                <TruckIcon className="h-4 w-4 text-purple-600" />
                {t('products.shippingRequirements', 'Shipping Requirements')}
              </h4>
              {(specs.temperature_min_c || specs.temperature_max_c) && (
                <div className="text-sm mb-2">
                  <span className="text-gray-500">{t('products.tempRange', 'Temperature')}:</span>
                  <span className="ml-1 font-medium">
                    {specs.temperature_min_c}°C - {specs.temperature_max_c}°C
                  </span>
                </div>
              )}
              {specs.humidity_max_pct && (
                <div className="text-sm mb-2">
                  <span className="text-gray-500">{t('products.maxHumidity', 'Max Humidity')}:</span>
                  <span className="ml-1 font-medium">{specs.humidity_max_pct}%</span>
                </div>
              )}
              {specs.special_handling && specs.special_handling.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {specs.special_handling.map((handling: string) => (
                    <span key={handling} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded">
                      {handling}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Performance Stats */}
          {stats && (stats.shipment_count > 0 || stats.contract_count > 0) && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1 mb-2">
                <ChartBarIcon className="h-4 w-4 text-indigo-600" />
                {t('products.yourPerformance', 'Your Performance')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-indigo-50 rounded text-center">
                  <div className="text-xl font-bold text-indigo-700">{stats.shipment_count}</div>
                  <div className="text-xs text-indigo-600">{t('products.shipments', 'Shipments')}</div>
                </div>
                <div className="p-2 bg-purple-50 rounded text-center">
                  <div className="text-xl font-bold text-purple-700">{stats.contract_count}</div>
                  <div className="text-xs text-purple-600">{t('products.contracts', 'Contracts')}</div>
                </div>
                {stats.avg_price > 0 && (
                  <div className="col-span-2 p-2 bg-gray-50 rounded">
                    <div className="text-sm text-gray-500">{t('products.avgPrice', 'Avg Price')}</div>
                    <div className="text-lg font-bold text-gray-900">${stats.avg_price.toFixed(2)}/MT</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Price Modal */}
      {showPriceModal && (
        <PriceBenchmarkModal
          productId={product.id}
          productName={product.name}
          onClose={() => setShowPriceModal(false)}
          onSuccess={() => {
            setShowPriceModal(false);
            refetch();
          }}
        />
      )}

      {/* Season Modal */}
      {showSeasonModal && (
        <SeasonFormModal
          productId={product.id}
          productName={product.name}
          existingCountries={seasons.map((s) => s.origin_country)}
          onClose={() => setShowSeasonModal(false)}
          onSuccess={() => {
            setShowSeasonModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}


