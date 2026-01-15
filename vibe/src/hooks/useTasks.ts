import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

export type Task = {
  id: string;
  type: string;
  title: string;
  title_ar?: string;
  message: string;
  message_ar?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  action_required: string;
  action_required_ar?: string;
  due_date: string | null;
  days_until_due: number | null;
  shipment_id: string | null;
  contract_id: string | null;
  sn?: string;
  product_text?: string;
  eta?: string;
  contract_no?: string;
  shipment_status?: string;
  pol_name?: string;
  pod_name?: string;
  created_at: string;
};

interface TasksResponse {
  total: number;
  tasks: Task[];
  grouped: {
    critical: Task[];
    warning: Task[];
    info: Task[];
  };
  timestamp: string;
}

export function useTasks() {
  return useQuery<TasksResponse>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications/pending');
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useTopTasks(limit: number = 5) {
  const { data, ...rest } = useTasks();

  // Priority order: error > warning > info
  const topTasks = data?.tasks
    .sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2, success: 3 };
      const priorityA = severityOrder[a.severity];
      const priorityB = severityOrder[b.severity];
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same severity, sort by due date (earliest first)
      if (a.days_until_due !== null && b.days_until_due !== null) {
        return a.days_until_due - b.days_until_due;
      }
      
      // If one has no due date, prioritize the one with a due date
      if (a.days_until_due !== null) return -1;
      if (b.days_until_due !== null) return 1;
      
      return 0;
    })
    .slice(0, limit);

  return {
    ...rest,
    data: topTasks || [],
    totalTasks: data?.total || 0,
  };
}

