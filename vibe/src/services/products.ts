/**
 * Products Service
 * API calls for product catalog, specs, price benchmarks, and seasons
 */

import { API_BASE_URL } from '../config/api';

// ========== TYPES ==========

export interface Product {
  id: string;
  name: string;
  sku?: string;
  hs_code?: string;
  category_type?: string;
  category_legacy?: string;
  uom?: string;
  pack_type?: string;
  net_weight_kg?: number;
  typical_origins?: string[];
  brand?: string;
  is_seasonal?: boolean;
  is_active?: boolean;
  description?: string;
  aliases?: string[];
  spec_json?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  latest_price?: number;
  latest_price_date?: string;
  latest_price_origin?: string;
  price_trend_pct?: number;
  grade?: string;
  certifications?: string[];
}

export interface ProductSpecs {
  id?: string;
  product_id: string;
  grade?: string;
  moisture_pct?: number;
  purity_pct?: number;
  ash_pct?: number;
  color_value?: number;
  grain_size_mm?: number;
  certifications?: string[];
  custom_specs?: Record<string, any>;
  temperature_min_c?: number;
  temperature_max_c?: number;
  humidity_max_pct?: number;
  shelf_life_days?: number;
  special_handling?: string[];
  packaging_requirements?: string;
  default_payment_terms?: string;
  default_inspection?: string;
  default_incoterm?: string;
}

export interface PriceBenchmark {
  id?: string;
  product_id: string;
  price_date: string;
  price_usd_per_mt: number;
  origin_country?: string;
  incoterm?: string;
  price_source?: string;
  notes?: string;
  created_at?: string;
  created_by?: string;
}

export interface ProductSeason {
  id?: string;
  product_id: string;
  origin_country: string;
  planting_start_month?: number;
  planting_end_month?: number;
  harvest_start_month?: number;
  harvest_end_month?: number;
  peak_start_month?: number;
  peak_end_month?: number;
  off_season_start_month?: number;
  off_season_end_month?: number;
  notes?: string;
  crop_year_pattern?: string;
}

export interface ProductCategory {
  code: string;
  name: string;
  name_ar?: string;
  icon?: string;
  typical_specs?: string[];
  sort_order?: number;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  active?: 'true' | 'false' | 'all';
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  products: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductDetail {
  product: Product & ProductSpecs;
  priceBenchmarks: PriceBenchmark[];
  seasons: ProductSeason[];
  stats: {
    shipment_count: number;
    contract_count: number;
    total_qty_shipped: number;
    avg_price: number;
  };
}

export interface ProductAnalytics {
  shipmentStats: Array<{
    month: string;
    shipment_count: number;
    total_qty: number;
    avg_price: number;
    total_value: number;
  }>;
  contractStats: Array<{
    month: string;
    contract_count: number;
    total_qty: number;
    avg_price: number;
    total_value: number;
  }>;
  topPartners: Array<{
    id: string;
    name: string;
    shipment_count: number;
    total_qty: number;
  }>;
  priceComparison: Array<{
    month: string;
    internal_avg: number;
    benchmark_avg: number;
    variance_pct: number;
  }>;
}

// ========== HELPER ==========

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token'); // Fixed: was 'token', should be 'auth_token'
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP error ${response.status}`);
  }
  return response.json();
}

// ========== PRODUCT CATALOG CRUD ==========

/**
 * Get paginated list of products with optional filters
 */
export async function getProducts(filters: ProductFilters = {}): Promise<PaginatedResponse<Product>> {
  const params = new URLSearchParams();
  
  if (filters.search) params.append('search', filters.search);
  if (filters.category) params.append('category', filters.category);
  if (filters.active) params.append('active', filters.active);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.sort) params.append('sort', filters.sort);
  if (filters.order) params.append('order', filters.order);

  const response = await fetch(`${API_BASE_URL}/products?${params}`, {
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

/**
 * Get product categories
 */
export async function getProductCategories(): Promise<{ categories: ProductCategory[] }> {
  const response = await fetch(`${API_BASE_URL}/products/categories`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Autocomplete search for products
 */
export async function searchProducts(query: string, limit = 10): Promise<{ suggestions: Array<{ id: string; value: string; sku?: string; category_type?: string; frequency: number }> }> {
  if (!query || query.length < 2) {
    return { suggestions: [] };
  }

  const response = await fetch(
    `${API_BASE_URL}/products/autocomplete?query=${encodeURIComponent(query)}&limit=${limit}`,
    { headers: getAuthHeaders() }
  );

  return handleResponse(response);
}

/**
 * Get single product with full details
 */
export async function getProduct(id: string): Promise<ProductDetail> {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Create new product
 */
export async function createProduct(data: Partial<Product> & { specs?: Partial<ProductSpecs> }): Promise<{ product: Product; message: string }> {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Update product
 */
export async function updateProduct(id: string, data: Partial<Product> & { specs?: Partial<ProductSpecs> }): Promise<{ product: Product; message: string }> {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Delete (deactivate) product
 */
export async function deleteProduct(id: string): Promise<{ message: string; product: { id: string; name: string } }> {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Bulk import products
 */
export async function importProducts(products: Partial<Product>[]): Promise<{ message: string; created: number; updated: number; errors: any[] }> {
  const response = await fetch(`${API_BASE_URL}/products/import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ products }),
  });
  return handleResponse(response);
}

// ========== PRICE BENCHMARKS ==========

/**
 * Get price history for a product
 */
export async function getProductPrices(productId: string, days = 365, origin?: string): Promise<{ prices: PriceBenchmark[]; stats: { latest: number; min: number; max: number; avg: number; count: number } | null }> {
  const params = new URLSearchParams({ days: String(days) });
  if (origin) params.append('origin', origin);

  const response = await fetch(`${API_BASE_URL}/products/${productId}/prices?${params}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Add price benchmark
 */
export async function addPriceBenchmark(productId: string, data: Omit<PriceBenchmark, 'id' | 'product_id' | 'created_at' | 'created_by'>): Promise<{ price: PriceBenchmark; message: string }> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/prices`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Delete price benchmark
 */
export async function deletePriceBenchmark(productId: string, priceId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/prices/${priceId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

// ========== SEASONS ==========

/**
 * Get seasons for a product
 */
export async function getProductSeasons(productId: string): Promise<{ seasons: ProductSeason[] }> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/seasons`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Add/update season
 */
export async function saveProductSeason(productId: string, data: Omit<ProductSeason, 'id' | 'product_id'>): Promise<{ season: ProductSeason; message: string }> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/seasons`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Delete season
 */
export async function deleteProductSeason(productId: string, seasonId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/seasons/${seasonId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

// ========== ANALYTICS ==========

/**
 * Get product analytics
 */
export async function getProductAnalytics(productId: string, period = 12): Promise<ProductAnalytics> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/analytics?period=${period}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

// ========== CONSTANTS ==========

export const PRODUCT_CATEGORIES = [
  { code: 'sugar', name: 'Sugar', name_ar: 'سكر' },
  { code: 'salt', name: 'Salt', name_ar: 'ملح' },
  { code: 'grain', name: 'Grains & Cereals', name_ar: 'حبوب' },
  { code: 'legume', name: 'Legumes & Pulses', name_ar: 'بقوليات' },
  { code: 'spice', name: 'Spices', name_ar: 'بهارات' },
  { code: 'oil', name: 'Oils & Fats', name_ar: 'زيوت' },
  { code: 'flour', name: 'Flour & Starch', name_ar: 'طحين ونشا' },
  { code: 'rice', name: 'Rice', name_ar: 'أرز' },
  { code: 'dairy', name: 'Dairy Products', name_ar: 'منتجات ألبان' },
  { code: 'other', name: 'Other', name_ar: 'أخرى' },
];

export const UNITS_OF_MEASURE = [
  { value: 'MT', label: 'Metric Ton (MT)' },
  { value: 'KG', label: 'Kilogram (KG)' },
  { value: 'LB', label: 'Pound (LB)' },
  { value: 'BAG', label: 'Bag' },
  { value: 'CTN', label: 'Carton' },
  { value: 'PC', label: 'Piece' },
  { value: 'L', label: 'Liter' },
];

export const PACK_TYPES = [
  { value: 'BAGS', label: 'Bags' },
  { value: 'BULK', label: 'Bulk' },
  { value: 'CARTONS', label: 'Cartons' },
  { value: 'DRUMS', label: 'Drums' },
  { value: 'IBC', label: 'IBC Containers' },
  { value: 'JUMBO', label: 'Jumbo Bags' },
  { value: 'PALLETS', label: 'Pallets' },
];

export const INCOTERMS = [
  { value: 'FOB', label: 'FOB - Free On Board' },
  { value: 'CIF', label: 'CIF - Cost, Insurance & Freight' },
  { value: 'CFR', label: 'CFR - Cost & Freight' },
  { value: 'EXW', label: 'EXW - Ex Works' },
  { value: 'FCA', label: 'FCA - Free Carrier' },
  { value: 'DAP', label: 'DAP - Delivered at Place' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
];

export const CERTIFICATIONS = [
  'ISO 22000',
  'HACCP',
  'Halal',
  'Kosher',
  'Organic',
  'Non-GMO',
  'BRC',
  'FSSC 22000',
  'GMP',
  'FDA Approved',
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

