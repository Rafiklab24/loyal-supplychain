/**
 * ProductsPage - Main product catalog management page
 * Features: searchable table, filters, pagination, create/edit modal, price trends, seasons
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SunIcon,
  CloudIcon,
} from '@heroicons/react/24/outline';
import { Pagination } from '../components/common/Pagination';
import { FieldHighlighter } from '../components/common/FieldHighlighter';
import { LoadingState } from '../components/common/LoadingState';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { ProductDetailPanel } from '../components/products/ProductDetailPanel';
import { ExcelImportModal } from '../components/products/ExcelImportModal';
import {
  getProducts,
  getProductCategories,
  deleteProduct,
  type Product,
  type ProductFilters,
  PRODUCT_CATEGORIES,
} from '../services/products';

export default function ProductsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const queryClient = useQueryClient();

  // State
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    category: 'all',
    active: 'true',
    page: 1,
    limit: 25,
    sort: 'name',
    order: 'asc',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchInput, setSearchInput] = useState('');

  // URL params for field highlighting (from Field Mapping Manager)
  const [searchParams] = useSearchParams();
  const highlightField = searchParams.get('highlight');
  const highlightStep = searchParams.get('step');
  
  // Auto-open modal if highlight param is present
  useEffect(() => {
    if (highlightField) {
      // Step 1 = Product Form, Step 2 = Price Benchmark, Step 3 = Season Form
      // For now, just open the Product Form for step 1
      if (highlightStep === '1' || !highlightStep) {
        setShowCreateModal(true);
      }
      // TODO: Add support for Price Benchmark (step 2) and Season Form (step 3) modals
    }
  }, [highlightField, highlightStep]);

  // Fetch products
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => getProducts(filters),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: getProductCategories,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const categories = categoriesData?.categories || PRODUCT_CATEGORIES;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedProduct(null);
    },
  });

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle sort
  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sort: column,
      order: prev.sort === column && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (filters.sort !== column) return null;
    return filters.order === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 inline ml-1" />
    );
  };

  // Format price trend
  const formatTrend = (trend: number | null | undefined) => {
    if (trend === null || trend === undefined) return null;
    const isPositive = trend > 0;
    const isNegative = trend < 0;
    return (
      <span className={`flex items-center text-xs font-medium ${
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
      }`}>
        {isPositive ? (
          <ArrowTrendingUpIcon className="h-4 w-4 mr-0.5" />
        ) : isNegative ? (
          <ArrowTrendingDownIcon className="h-4 w-4 mr-0.5" />
        ) : (
          <MinusIcon className="h-4 w-4 mr-0.5" />
        )}
        {Math.abs(trend).toFixed(1)}%
      </span>
    );
  };

  // Get category name
  const getCategoryName = (code: string | undefined) => {
    if (!code) return '-';
    const cat = categories.find((c) => c.code === code);
    return isRTL && cat?.name_ar ? cat.name_ar : cat?.name || code;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CubeIcon className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {t('products.title', 'Product Catalog')}
                </h1>
                <p className="text-sm text-gray-500">
                  {t('products.subtitle', 'Manage your product master data, specifications, and market intelligence')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <DocumentArrowUpIcon className="h-4 w-4" />
                {t('products.import', 'Import')}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                {t('products.addProduct', 'Add Product')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('products.searchPlaceholder', 'Search by name, SKU, or HS code...')}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value, page: 1 }))}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white min-w-[180px]"
            >
              <option value="all">{t('products.allCategories', 'All Categories')}</option>
              {categories.map((cat) => (
                <option key={cat.code} value={cat.code}>
                  {isRTL && cat.name_ar ? cat.name_ar : cat.name}
                </option>
              ))}
            </select>

            {/* Active Filter */}
            <select
              value={filters.active}
              onChange={(e) => setFilters((prev) => ({ ...prev, active: e.target.value as any, page: 1 }))}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white min-w-[140px]"
            >
              <option value="true">{t('products.activeOnly', 'Active Only')}</option>
              <option value="false">{t('products.inactiveOnly', 'Inactive Only')}</option>
              <option value="all">{t('products.all', 'All')}</option>
            </select>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              className="p-2.5 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Results summary */}
          {data && (
            <div className="mt-3 text-sm text-gray-500">
              {t('products.showing', 'Showing')} {((filters.page || 1) - 1) * (filters.limit || 25) + 1} -{' '}
              {Math.min((filters.page || 1) * (filters.limit || 25), data.pagination.total)}{' '}
              {t('products.of', 'of')} {data.pagination.total} {t('products.products', 'products')}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex gap-6">
          {/* Products Table */}
          <div className={`flex-1 ${selectedProduct ? 'max-w-3xl' : ''}`}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <LoadingState
                isLoading={isLoading}
                error={error ? (error instanceof Error ? error : new Error(String(error))) : null}
                data={data?.products}
                skeleton={
                  <div className="p-6">
                    <TableSkeleton rows={5} columns={4} />
                  </div>
                }
                emptyState={
                  <div className="text-center py-20">
                    <CubeIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
                    <p className="text-gray-500">{t('products.noProducts', 'No products found')}</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded"
                      aria-label={t('products.createFirst', 'Create your first product')}
                    >
                      {t('products.createFirst', 'Create your first product')}
                    </button>
                  </div>
                }
              >
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('name')}
                          >
                            {t('products.name', 'Product Name')}
                            {getSortIcon('name')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            {t('products.category', 'Category')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            {t('products.sku', 'SKU')}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            {t('products.price', 'Price ($/MT)')}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            {t('products.trend', 'Trend')}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            {t('products.season', 'Season')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data?.products?.map((product) => (
                          <tr
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            className={`hover:bg-emerald-50 cursor-pointer transition-colors ${
                              selectedProduct?.id === product.id ? 'bg-emerald-50' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center">
                                  <span className="text-lg font-bold text-emerald-700">
                                    {product.name?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{product.name}</div>
                                  {product.hs_code && (
                                    <div className="text-xs text-gray-500">HS: {product.hs_code}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {getCategoryName(product.category_type)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {product.sku || '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {product.latest_price ? (
                                <span className="font-semibold text-gray-900">
                                  ${product.latest_price.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {formatTrend(product.price_trend_pct)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {product.is_seasonal ? (
                                <SunIcon className="h-5 w-5 text-amber-500 mx-auto" title="Seasonal" />
                              ) : (
                                <CloudIcon className="h-5 w-5 text-gray-400 mx-auto" title="Year-round" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {data && data.pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-200">
                      <Pagination
                        currentPage={filters.page || 1}
                        totalPages={data.pagination.totalPages}
                        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                      />
                    </div>
                  )}
                </>
              </LoadingState>
            </div>
          </div>

          {/* Detail Panel */}
          {selectedProduct && (
            <div className="w-[450px] flex-shrink-0">
              <ProductDetailPanel
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onEdit={() => {
                  setEditingProduct(selectedProduct);
                  setShowCreateModal(true);
                }}
                onDelete={() => {
                  if (confirm(t('products.confirmDelete', 'Are you sure you want to deactivate this product?'))) {
                    deleteMutation.mutate(selectedProduct.id);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProduct(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingProduct(null);
            queryClient.invalidateQueries({ queryKey: ['products'] });
          }}
        />
      )}
      
      {/* Field Highlighter for Field Mapping Manager */}
      {showCreateModal && highlightField && (
        <FieldHighlighter
          currentStep={1}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ExcelImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            queryClient.invalidateQueries({ queryKey: ['products'] });
          }}
        />
      )}
    </div>
  );
}


