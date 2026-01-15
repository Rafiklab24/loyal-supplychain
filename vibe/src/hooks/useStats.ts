import { useQuery } from '@tanstack/react-query';
import { healthService } from '../services/health';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => healthService.stats(),
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => healthService.check(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

