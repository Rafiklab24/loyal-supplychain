# Vibe UI Integration Guide

Guide for integrating the Loyal Supply Chain API with Vibe (React-based frontend).

## API Configuration

### Environment Variables

Create a `.env` file in your Vibe project:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_TIMEOUT=30000
```

### API Client Setup

Create an API client using axios:

```typescript
// src/lib/api-client.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (for adding auth tokens in future)
apiClient.interceptors.request.use((config) => {
  // Add auth token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor (for error handling)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## TypeScript Interfaces

### Data Models

```typescript
// src/types/api.ts

export interface Shipment {
  id: string;
  sn: string;
  direction: 'incoming' | 'outgoing';
  product_text: string;
  container_count: number | null;
  weight_ton: string;
  fixed_price_usd_per_ton: string | null;
  total_value_usd: string | null;
  paid_value_usd: string;
  balance_value_usd: string;
  pol_id: string | null;
  pod_id: string | null;
  pol_name?: string;
  pod_name?: string;
  shipping_line_id: string | null;
  shipping_line_name?: string;
  status: ShipmentStatus | null;
  eta: string | null;
  created_at: string;
  updated_at: string;
}

export type ShipmentStatus = 
  | 'planning'
  | 'booked'
  | 'gate_in'
  | 'loaded'
  | 'sailed'
  | 'arrived'
  | 'delivered'
  | 'invoiced';

export interface Company {
  id: string;
  name: string;
  country: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  is_supplier: boolean;
  is_customer: boolean;
  is_shipping_line: boolean;
  is_forwarder: boolean;
  is_bank: boolean;
}

export interface Port {
  id: string;
  name: string;
  country: string;
  unlocode?: string;
  code?: string;
}

export interface Transfer {
  id: string;
  direction: 'received' | 'paid';
  amount: string;
  currency: string;
  transfer_date: string;
  bank_name?: string;
  bank_account?: string;
  sender?: string;
  receiver?: string;
  reference?: string;
  notes?: string;
  shipment_id?: string;
  pi_no?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Stats {
  overview: {
    total_shipments: string;
    unique_contracts: string;
    total_containers: string;
    total_weight_tons: string;
    total_value_usd: string;
    total_suppliers: string;
    total_shipping_lines: string;
    total_ports: string;
    total_transfers: string;
  };
  shipmentsByStatus: Array<{ status: string; count: string }>;
  topOrigins: Array<{ port: string; shipment_count: string }>;
  topDestinations: Array<{ port: string; shipment_count: string }>;
}
```

## API Service Functions

### Shipments Service

```typescript
// src/services/shipments.ts
import { apiClient } from '../lib/api-client';
import type { Shipment, PaginatedResponse } from '../types/api';

export const shipmentsService = {
  // List shipments with filters
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    product?: string;
    sn?: string;
  }): Promise<PaginatedResponse<Shipment>> => {
    const { data } = await apiClient.get('/shipments', { params });
    return data;
  },

  // Get single shipment
  getById: async (id: string): Promise<Shipment> => {
    const { data } = await apiClient.get(`/shipments/${id}`);
    return data;
  },

  // Get shipments by contract number
  getBySN: async (sn: string): Promise<{ sn: string; count: number; shipments: Shipment[] }> => {
    const { data } = await apiClient.get(`/shipments/sn/${sn}`);
    return data;
  },

  // Get transfers for shipment
  getTransfers: async (id: string) => {
    const { data } = await apiClient.get(`/shipments/${id}/transfers`);
    return data;
  },

  // Add milestone
  addMilestone: async (id: string, milestone: { code: string; notes?: string }) => {
    const { data } = await apiClient.post(`/shipments/${id}/milestone`, milestone);
    return data;
  },
};
```

### Companies Service

```typescript
// src/services/companies.ts
import { apiClient } from '../lib/api-client';
import type { Company, PaginatedResponse } from '../types/api';

export const companiesService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Company>> => {
    const { data } = await apiClient.get('/companies', { params });
    return data;
  },

  getById: async (id: string): Promise<Company> => {
    const { data } = await apiClient.get(`/companies/${id}`);
    return data;
  },

  getSuppliers: async (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Company>> => {
    const { data } = await apiClient.get('/companies/type/suppliers', { params });
    return data;
  },

  getShippingLines: async (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Company>> => {
    const { data} = await apiClient.get('/companies/type/shipping-lines', { params });
    return data;
  },
};
```

### Health/Stats Service

```typescript
// src/services/health.ts
import { apiClient } from '../lib/api-client';
import type { Stats } from '../types/api';

export const healthService = {
  check: async () => {
    const { data } = await apiClient.get('/health');
    return data;
  },

  getStats: async (): Promise<Stats> => {
    const { data } = await apiClient.get('/health/stats');
    return data;
  },
};
```

## React Hooks

### Custom Hook for Shipments

```typescript
// src/hooks/useShipments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shipmentsService } from '../services/shipments';

export function useShipments(params?: {
  page?: number;
  limit?: number;
  status?: string;
  product?: string;
}) {
  return useQuery({
    queryKey: ['shipments', params],
    queryFn: () => shipmentsService.list(params),
  });
}

export function useShipment(id: string) {
  return useQuery({
    queryKey: ['shipment', id],
    queryFn: () => shipmentsService.getById(id),
    enabled: !!id,
  });
}

export function useAddMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, milestone }: { id: string; milestone: { code: string; notes?: string } }) =>
      shipmentsService.addMilestone(id, milestone),
    onSuccess: (_, variables) => {
      // Invalidate shipment query to refresh data
      queryClient.invalidateQueries({ queryKey: ['shipment', variables.id] });
    },
  });
}
```

### Custom Hook for Stats

```typescript
// src/hooks/useStats.ts
import { useQuery } from '@tanstack/react-query';
import { healthService } from '../services/health';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => healthService.getStats(),
    refetchInterval: 60000, // Refresh every minute
  });
}
```

## Component Examples

### Shipments List Component

```typescript
// src/components/ShipmentsList.tsx
import { useState } from 'react';
import { useShipments } from '../hooks/useShipments';

export function ShipmentsList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const { data, isLoading, error } = useShipments({ page, limit: 20, status });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading shipments</div>;

  return (
    <div>
      <h2>Shipments</h2>
      
      {/* Status Filter */}
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All Statuses</option>
        <option value="sailed">Sailed</option>
        <option value="arrived">Arrived</option>
        <option value="delivered">Delivered</option>
      </select>

      {/* Shipments Table */}
      <table>
        <thead>
          <tr>
            <th>SN</th>
            <th>Product</th>
            <th>Origin</th>
            <th>Destination</th>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((shipment) => (
            <tr key={shipment.id}>
              <td>{shipment.sn}</td>
              <td>{shipment.product_text}</td>
              <td>{shipment.pol_name}</td>
              <td>{shipment.pod_name}</td>
              <td>${shipment.total_value_usd}</td>
              <td>{shipment.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div>
        <button 
          onClick={() => setPage(page - 1)} 
          disabled={page === 1}
        >
          Previous
        </button>
        <span>Page {page} of {data?.pagination.totalPages}</span>
        <button 
          onClick={() => setPage(page + 1)}
          disabled={page >= (data?.pagination.totalPages || 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

### Dashboard Component

```typescript
// src/components/Dashboard.tsx
import { useStats } from '../hooks/useStats';

export function Dashboard() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) return <div>Loading...</div>;

  const overview = stats?.overview;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Shipments</h3>
          <p className="stat-value">{overview?.total_shipments}</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Value</h3>
          <p className="stat-value">${parseFloat(overview?.total_value_usd || '0').toLocaleString()}</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Weight</h3>
          <p className="stat-value">{parseFloat(overview?.total_weight_tons || '0').toLocaleString()} tons</p>
        </div>
        
        <div className="stat-card">
          <h3>Suppliers</h3>
          <p className="stat-value">{overview?.total_suppliers}</p>
        </div>
      </div>

      <div className="top-routes">
        <h2>Top Origins</h2>
        <ul>
          {stats?.topOrigins.map((origin) => (
            <li key={origin.port}>
              {origin.port}: {origin.shipment_count} shipments
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

## Error Handling

```typescript
// src/utils/error-handler.ts
export function handleApiError(error: any): string {
  if (error.response) {
    // Server responded with error
    return error.response.data.message || 'An error occurred';
  } else if (error.request) {
    // Request made but no response
    return 'No response from server';
  } else {
    // Something else happened
    return error.message || 'An unexpected error occurred';
  }
}

// Usage in component
import { handleApiError } from '../utils/error-handler';

try {
  const shipment = await shipmentsService.getById(id);
} catch (error) {
  const errorMessage = handleApiError(error);
  toast.error(errorMessage);
}
```

## Best Practices

1. **Use React Query** for data fetching and caching
2. **Type Safety** - Use TypeScript interfaces for all API responses
3. **Error Boundaries** - Wrap components in error boundaries
4. **Loading States** - Show loading indicators during API calls
5. **Optimistic Updates** - Update UI immediately, rollback on error
6. **Debounce Search** - Debounce search inputs to reduce API calls
7. **Cache Strategy** - Configure appropriate cache times for different data types

## Deployment

### Production API URL

Update `.env.production`:

```env
VITE_API_BASE_URL=https://api.loyalsupplychain.com
```

### CORS Configuration

Ensure the API server allows your frontend domain:

```typescript
// On API server
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

## Next Steps

1. Implement authentication (JWT tokens)
2. Add WebSocket support for real-time updates
3. Implement offline support with service workers
4. Add data export functionality (CSV, Excel)
5. Implement advanced filtering and search
6. Add file upload for documents

## Support

For questions or issues, refer to API.md or contact the development team.

