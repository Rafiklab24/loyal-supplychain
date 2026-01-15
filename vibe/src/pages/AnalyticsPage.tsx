import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { usePriceTrends } from '../hooks/useComparison';
import { formatNumber, formatCurrency } from '../utils/format';
import { AutocompleteInput } from '../components/common/AutocompleteInput';
import { apiClient } from '../services/api';
import { DateInput } from '../components/common/DateInput';
import {
  MapPinIcon,
  TruckIcon,
  BanknotesIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const { data: trendsData, isLoading, error } = usePriceTrends(
    selectedProduct,
    startDate,
    endDate
  );

  const formatCurrencyValue = (value: number) => formatCurrency(value.toString());

  const handleAnalyze = () => {
    // Trigger analysis by setting dates if empty
    if (!startDate) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      setStartDate(sixMonthsAgo.toISOString().split('T')[0]);
    }
    if (!endDate) {
      setEndDate(new Date().toISOString().split('T')[0]);
    }
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('analytics.title', 'Price Analytics')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('analytics.subtitle', 'Track price trends and compare products over time')}
          </p>
        </div>

        {/* Filters */}
        <Card>
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('analytics.filters', 'Analysis Filters')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('analytics.product', 'Product')}
                </label>
                <AutocompleteInput
                  type="product"
                  value={selectedProduct}
                  onChange={setSelectedProduct}
                  placeholder={t('analytics.selectProduct', 'Select a product...')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('analytics.startDate', 'Start Date')}
                </label>
                <DateInput
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('analytics.endDate', 'End Date')}
                </label>
                <DateInput
                  value={endDate}
                  onChange={(val) => setEndDate(val)}
                  className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleAnalyze}
                disabled={!selectedProduct}
              >
                {t('analytics.analyze', 'Analyze Trends')}
              </Button>
            </div>
          </div>
        </Card>

        {/* Results */}
        {selectedProduct && (
          <>
            {isLoading && (
              <Card>
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <p className="mt-4 text-gray-500">{t('common.loading', 'Loading...')}</p>
                </div>
              </Card>
            )}

            {error && (
              <Card>
                <div className="p-12 text-center">
                  <p className="text-red-600">{t('analytics.error', 'Failed to load analytics data')}</p>
                </div>
              </Card>
            )}

            {trendsData && trendsData.trends && trendsData.trends.length > 0 && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card>
                    <div className="p-6">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t('analytics.avgPrice', 'Average Price')}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrencyValue(
                          trendsData.trends.reduce((sum, t) => sum + parseFloat(t.avg_price), 0) / trendsData.trends.length
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {t('analytics.perTon', 'per ton')}
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="p-6">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t('analytics.lowestPrice', 'Lowest Price')}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-green-600">
                        {formatCurrencyValue(
                          Math.min(...trendsData.trends.map(t => parseFloat(t.min_price)))
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {t('analytics.perTon', 'per ton')}
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="p-6">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t('analytics.highestPrice', 'Highest Price')}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-red-600">
                        {formatCurrencyValue(
                          Math.max(...trendsData.trends.map(t => parseFloat(t.max_price)))
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {t('analytics.perTon', 'per ton')}
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="p-6">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t('analytics.totalShipments', 'Total Shipments')}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-primary-600">
                        {formatNumber(
                          trendsData.trends.reduce((sum, t) => sum + t.shipment_count, 0)
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {t('analytics.inPeriod', 'in this period')}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Price Trends Chart (Simple Table Implementation) */}
                <Card>
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                      {t('analytics.priceTrends', 'Price Trends Over Time')}
                    </h2>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('analytics.month', 'Month')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('analytics.avgPrice', 'Avg Price')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('analytics.minPrice', 'Min Price')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('analytics.maxPrice', 'Max Price')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('analytics.shipments', 'Shipments')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t('analytics.trend', 'Trend')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {trendsData.trends.map((trend, index) => {
                            const prevTrend = index > 0 ? trendsData.trends[index - 1] : null;
                            const priceDiff = prevTrend
                              ? parseFloat(trend.avg_price) - parseFloat(prevTrend.avg_price)
                              : 0;
                            const percentChange = prevTrend
                              ? ((priceDiff / parseFloat(prevTrend.avg_price)) * 100).toFixed(1)
                              : 0;

                            return (
                              <tr key={trend.month} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                  {new Date(trend.month).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                  })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white font-semibold">
                                  {formatCurrency(trend.avg_price)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                                  {formatCurrency(trend.min_price)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                                  {formatCurrency(trend.max_price)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                                  {formatNumber(trend.shipment_count)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                  {prevTrend && (
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        priceDiff > 0
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                          : priceDiff < 0
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      {priceDiff > 0 ? '↑' : priceDiff < 0 ? '↓' : '→'} {Math.abs(Number(percentChange))}%
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡 {t('analytics.chartNote', 'Visual charts with line graphs will be added in the next update. For now, use the table above to analyze trends and price changes over time.')}
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {trendsData && trendsData.trends && trendsData.trends.length === 0 && (
              <Card>
                <div className="p-12 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <p className="mt-4 text-gray-500">
                    {t('analytics.noData', 'No data available for this product in the selected period')}
                  </p>
                </div>
              </Card>
            )}
          </>
        )}

        {!selectedProduct && (
          <Card>
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                {t('analytics.getStarted', 'Get Started with Analytics')}
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t('analytics.instructions', 'Select a product above to analyze price trends and view historical data')}
              </p>
            </div>
          </Card>
        )}

        {/* Route-Based Cost Breakdown Section */}
        <RouteCostBreakdown />
      </div>
  );
}

// ============================================================
// ROUTE-BASED COST BREAKDOWN COMPONENT
// ============================================================

interface BorderCostData {
  border_crossing_id: string;
  border_name: string;
  total_cost: number;
  count: number;
  avg_cost: number;
  country_from: string;
  country_to: string;
}

function RouteCostBreakdown() {
  const { t } = useTranslation();

  // Fetch cost data by clearance type
  const { data: costData, isLoading } = useQuery({
    queryKey: ['route-cost-breakdown'],
    queryFn: async () => {
      const response = await apiClient.get('/customs-clearing-costs/summary');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch border crossing costs
  const { data: borderCostData } = useQuery<BorderCostData[]>({
    queryKey: ['border-crossing-costs'],
    queryFn: async (): Promise<BorderCostData[]> => {
      // This query aggregates costs by border crossing
      const response = await apiClient.get('/customs-clearing-costs?clearance_type=border_crossing&limit=1000');
      const costs = response.data?.data || [];
      
      // Group by border crossing
      const grouped = costs.reduce((acc: Record<string, BorderCostData>, cost: any) => {
        const key = cost.border_crossing_id || 'unknown';
        if (!acc[key]) {
          acc[key] = {
            border_crossing_id: key,
            border_name: cost.border_name || 'Unknown',
            total_cost: 0,
            count: 0,
            avg_cost: 0,
            country_from: cost.border_country_from || '',
            country_to: cost.border_country_to || '',
          };
        }
        acc[key].total_cost += parseFloat(cost.total_clearing_cost || 0);
        acc[key].count += 1;
        acc[key].avg_cost = acc[key].total_cost / acc[key].count;
        return acc;
      }, {});

      return Object.values(grouped) as BorderCostData[];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <div className="p-6 flex justify-center">
          <Spinner size="lg" />
        </div>
      </Card>
    );
  }

  const clearanceTypeCosts = [
    { 
      type: 'inbound', 
      label: t('analytics.podClearance', 'POD Customs Clearance'),
      icon: TruckIcon,
      color: 'bg-blue-100 text-blue-800',
      total: costData?.byStatus?.pending?.total + costData?.byStatus?.paid?.total || 0,
      count: costData?.byStatus?.pending?.count + costData?.byStatus?.paid?.count || 0,
    },
    {
      type: 'border_crossing',
      label: t('analytics.borderClearance', 'Border Crossing Clearance'),
      icon: MapPinIcon,
      color: 'bg-amber-100 text-amber-800',
      total: borderCostData?.reduce((sum: number, b: BorderCostData) => sum + b.total_cost, 0) || 0,
      count: borderCostData?.reduce((sum: number, b: BorderCostData) => sum + b.count, 0) || 0,
    },
  ];

  return (
    <>
      {/* Section Header */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BanknotesIcon className="w-6 h-6 text-purple-600" />
          {t('analytics.routeCostBreakdown', 'Route-Based Cost Analysis')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('analytics.routeCostSubtitle', 'Breakdown of clearance costs by type and location')}
        </p>
      </div>

      {/* Cost by Clearance Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {clearanceTypeCosts.map((item) => {
          const Icon = item.icon;
          const avgCost = item.count > 0 ? item.total / item.count : 0;
          return (
            <Card key={item.type} className="p-5">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${item.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-500">
                    {item.label}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(item.total.toFixed(2))}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>{item.count} {t('analytics.entries', 'entries')}</span>
                    <span>•</span>
                    <span>{t('analytics.avgCost', 'Avg')}: {formatCurrency(avgCost.toFixed(2))}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Border Crossing Details */}
      {borderCostData && borderCostData.length > 0 && (
        <Card className="mt-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MapPinIcon className="w-5 h-5 text-amber-600" />
              {t('analytics.borderCrossingDetails', 'By Border Crossing')}
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {borderCostData.map((border: BorderCostData) => (
              <div 
                key={border.border_crossing_id} 
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-amber-400 rounded-full" />
                  <div>
                    <p className="font-medium text-gray-900">{border.border_name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      {border.country_from}
                      <ArrowRightIcon className="w-3 h-3" />
                      {border.country_to}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(border.total_cost.toFixed(2))}
                  </p>
                  <p className="text-sm text-gray-500">
                    {border.count} {t('analytics.entries', 'entries')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

