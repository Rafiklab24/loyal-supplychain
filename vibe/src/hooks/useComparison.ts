import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Shipment {
  id: string;
  sn: string;
  product_text: string;
  eta: string;
  pol_name: string;
  pod_name: string;
  shipping_line_name: string;
  container_count: number;
  weight_ton: number;
  total_value_usd: number;
  balance_value_usd: number;
  fixed_price_usd_per_ton: number;
  // ... other fields
}

interface ComparisonResponse {
  shipments: Shipment[];
}

async function fetchComparison(ids: string[]): Promise<ComparisonResponse> {
  const response = await fetch(
    `${API_BASE_URL}/shipments/compare?ids=${ids.join(',')}`,
    { headers: getAuthHeaders() }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch comparison data');
  }
  
  return response.json();
}

export function useComparison(ids: string[]) {
  return useQuery({
    queryKey: ['comparison', ids],
    queryFn: () => fetchComparison(ids),
    enabled: ids.length >= 2 && ids.length <= 5,
  });
}

// Price trends hook
interface PriceTrend {
  month: string;
  product_text: string;
  avg_price: string;
  min_price: string;
  max_price: string;
  shipment_count: number;
}

interface PriceTrendsResponse {
  trends: PriceTrend[];
}

async function fetchPriceTrends(
  product: string,
  startDate?: string,
  endDate?: string
): Promise<PriceTrendsResponse> {
  let url = `${API_BASE_URL}/shipments/analytics/price-trends?product=${encodeURIComponent(product)}`;
  
  if (startDate) {
    url += `&startDate=${startDate}`;
  }
  if (endDate) {
    url += `&endDate=${endDate}`;
  }
  
  const response = await fetch(url, { headers: getAuthHeaders() });
  
  if (!response.ok) {
    throw new Error('Failed to fetch price trends');
  }
  
  return response.json();
}

export function usePriceTrends(product: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['priceTrends', product, startDate, endDate],
    queryFn: () => fetchPriceTrends(product, startDate, endDate),
    enabled: !!product && product.length > 0,
  });
}

