import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';

interface Notification {
  id: string;
  shipment_id: string;
  contract_id?: string | null;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  due_date?: string | null;
  action_required?: string | null;
  action_completed?: boolean;
  action_completed_at?: string | null;
  metadata: any;
  sn: string;
  product_text: string;
  eta: string;
  pol_name: string;
  pod_name: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

async function fetchNotifications(isRead?: boolean): Promise<NotificationsResponse> {
  const params = isRead !== undefined ? { isRead } : {};
  const response = await apiClient.get('/notifications', { params });
  return response.data;
}

async function markAsRead(id: string): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`);
}

async function markAllAsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all');
}

async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}

async function generateNotifications(): Promise<void> {
  await apiClient.post('/notifications/generate');
}

export function useNotifications(isRead?: boolean) {
  return useQuery({
    queryKey: ['notifications', isRead],
    queryFn: () => fetchNotifications(isRead),
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useGenerateNotifications() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: generateNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

