import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';

// Types for user preferences
export interface DashboardPreferences {
  hide_tasks?: boolean;
}

export interface ShipmentsColumnPreferences {
  order?: string[];
  hidden?: string[];
}

export interface UserPreferences {
  dashboard?: DashboardPreferences;
  shipments_columns?: ShipmentsColumnPreferences;
}

// Default column order for shipments table
export const DEFAULT_SHIPMENT_COLUMNS = [
  'sn',
  'product',
  'status',
  'supplier',
  'origin',
  'pol',
  'pod',
  'eta',
  'container_count',
  'weight',
  'total_price',
];

// All available columns with display names
export const SHIPMENT_COLUMN_CONFIG: Record<string, { key: string; label: string; labelAr: string }> = {
  sn: { key: 'sn', label: 'Shipment No.', labelAr: 'رقم الشحنة' },
  product: { key: 'product', label: 'Type of Goods', labelAr: 'نوع البضاعة' },
  price_per_ton: { key: 'price_per_ton', label: 'Price per Ton', labelAr: 'السعر للطن' },
  origin: { key: 'origin', label: 'Origin', labelAr: 'المنشأ' },
  pol: { key: 'pol', label: 'POL', labelAr: 'ميناء التحميل' },
  pod: { key: 'pod', label: 'POD', labelAr: 'ميناء التفريغ' },
  status: { key: 'status', label: 'Status', labelAr: 'الحالة' },
  total_price: { key: 'total_price', label: 'Total Price', labelAr: 'السعر الإجمالي' },
  price_on_paper: { key: 'price_on_paper', label: 'Price on Paper', labelAr: 'السعر الورقي' },
  tax: { key: 'tax', label: 'Tax', labelAr: 'الضريبة' },
  eta: { key: 'eta', label: 'ETA', labelAr: 'وقت الوصول' },
  etd: { key: 'etd', label: 'ETD', labelAr: 'وقت المغادرة' },
  supplier: { key: 'supplier', label: 'Supplier', labelAr: 'المورد' },
  customer: { key: 'customer', label: 'Customer', labelAr: 'العميل' },
  container_count: { key: 'container_count', label: 'Containers', labelAr: 'الحاويات' },
  weight: { key: 'weight', label: 'Weight (MT)', labelAr: 'الوزن (طن)' },
  bl_no: { key: 'bl_no', label: 'BL No.', labelAr: 'رقم بوليصة الشحن' },
  vessel: { key: 'vessel', label: 'Vessel', labelAr: 'السفينة' },
  final_destination: { key: 'final_destination', label: 'Final Destination', labelAr: 'الوجهة النهائية' },
};

// Fetch current user's preferences
async function fetchMyPreferences(): Promise<UserPreferences> {
  const response = await apiClient.get('/auth/me/preferences');
  return response.data.preferences || {};
}

// Update current user's preferences
async function updateMyPreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const response = await apiClient.put('/auth/me/preferences', { preferences });
  return response.data.preferences;
}

// Fetch a specific user's preferences (admin only)
async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  const response = await apiClient.get(`/auth/users/${userId}/preferences`);
  return response.data.preferences || {};
}

// Update a specific user's preferences (admin only)
async function updateUserPreferences(userId: string, preferences: UserPreferences): Promise<UserPreferences> {
  const response = await apiClient.put(`/auth/users/${userId}/preferences`, { preferences });
  return response.data.user.ui_preferences;
}

/**
 * Hook to fetch and manage current user's UI preferences
 */
export function useUserPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading, error } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: fetchMyPreferences,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: updateMyPreferences,
    onSuccess: (newPreferences) => {
      queryClient.setQueryData(['user-preferences'], newPreferences);
    },
  });

  // Helper to check if tasks should be hidden on dashboard
  const shouldHideTasks = (): boolean => {
    return preferences?.dashboard?.hide_tasks === true;
  };

  // Get column order for shipments table
  const getShipmentColumns = (): string[] => {
    return preferences?.shipments_columns?.order || DEFAULT_SHIPMENT_COLUMNS;
  };

  // Get hidden columns for shipments table
  const getHiddenColumns = (): string[] => {
    return preferences?.shipments_columns?.hidden || [];
  };

  return {
    preferences: preferences || {},
    isLoading,
    error,
    updatePreferences: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    shouldHideTasks,
    getShipmentColumns,
    getHiddenColumns,
  };
}

/**
 * Hook for admins to manage other users' preferences
 */
export function useAdminUserPreferences(userId: string | null) {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading, error } = useQuery({
    queryKey: ['user-preferences', userId],
    queryFn: () => fetchUserPreferences(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (newPreferences: UserPreferences) => updateUserPreferences(userId!, newPreferences),
    onSuccess: (newPreferences) => {
      queryClient.setQueryData(['user-preferences', userId], newPreferences);
      // Also invalidate the users list to refresh any cached data
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return {
    preferences: preferences || {},
    isLoading,
    error,
    updatePreferences: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
