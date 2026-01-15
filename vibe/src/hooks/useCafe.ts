import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as cafeService from '../services/cafe';

// Check if user is authenticated
function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}

// Query keys
export const cafeKeys = {
  all: ['cafe'] as const,
  status: () => [...cafeKeys.all, 'status'] as const,
  today: () => [...cafeKeys.all, 'today'] as const,
  tomorrow: () => [...cafeKeys.all, 'tomorrow'] as const,
  myVote: () => [...cafeKeys.all, 'myVote'] as const,
  suggestions: () => [...cafeKeys.all, 'suggestions'] as const,
  voteCounts: () => [...cafeKeys.all, 'voteCounts'] as const,
  history: (limit?: number, offset?: number) => [...cafeKeys.all, 'history', { limit, offset }] as const,
};

// ============================================
// PUBLIC HOOKS (All Users)
// ============================================

// Get cafe status (for widget)
export function useCafeStatus() {
  return useQuery({
    queryKey: cafeKeys.status(),
    queryFn: cafeService.getCafeStatus,
    enabled: isAuthenticated(), // Only fetch when logged in
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  });
}

// Get today's menu
export function useTodayMenu() {
  return useQuery({
    queryKey: cafeKeys.today(),
    queryFn: cafeService.getTodayMenu,
    enabled: isAuthenticated(), // Only fetch when logged in
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get tomorrow's options
export function useTomorrowOptions() {
  return useQuery({
    queryKey: cafeKeys.tomorrow(),
    queryFn: cafeService.getTomorrowOptions,
    enabled: isAuthenticated(), // Only fetch when logged in
    refetchInterval: 30000, // Refetch every 30 seconds when voting
    staleTime: 15000,
  });
}

// Get my vote
export function useMyVote() {
  return useQuery({
    queryKey: cafeKeys.myVote(),
    queryFn: cafeService.getMyVote,
    enabled: isAuthenticated(), // Only fetch when logged in
    staleTime: 30000,
  });
}

// Submit/change vote
export function useSubmitVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (optionId: string) => cafeService.submitVote(optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.tomorrow() });
      queryClient.invalidateQueries({ queryKey: cafeKeys.myVote() });
      queryClient.invalidateQueries({ queryKey: cafeKeys.status() });
    },
  });
}

// Get suggestions
export function useSuggestions() {
  return useQuery({
    queryKey: cafeKeys.suggestions(),
    queryFn: cafeService.getSuggestions,
    enabled: isAuthenticated(), // Only fetch when logged in
    staleTime: 30000,
  });
}

// Submit suggestion
export function useSubmitSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (suggestionText: string) => cafeService.submitSuggestion(suggestionText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.suggestions() });
    },
  });
}

// Upvote suggestion
export function useUpvoteSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (suggestionId: string) => cafeService.upvoteSuggestion(suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.suggestions() });
    },
  });
}

// Remove upvote
export function useRemoveUpvote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (suggestionId: string) => cafeService.removeUpvote(suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.suggestions() });
    },
  });
}

// ============================================
// CHEF ONLY HOOKS
// ============================================

// Post menu
export function usePostMenu() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ menuDate, options }: { menuDate: string; options: cafeService.PostMenuOption[] }) =>
      cafeService.postMenu(menuDate, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.tomorrow() });
      queryClient.invalidateQueries({ queryKey: cafeKeys.status() });
    },
  });
}

// Update menu option
export function useUpdateMenuOption() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ optionId, updates }: { optionId: string; updates: Partial<cafeService.PostMenuOption> }) =>
      cafeService.updateMenuOption(optionId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.tomorrow() });
    },
  });
}

// Delete menu option
export function useDeleteMenuOption() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (optionId: string) => cafeService.deleteMenuOption(optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.tomorrow() });
      queryClient.invalidateQueries({ queryKey: cafeKeys.status() });
    },
  });
}

// Get vote counts (chef only)
export function useVoteCounts() {
  return useQuery({
    queryKey: cafeKeys.voteCounts(),
    queryFn: cafeService.getVoteCounts,
    enabled: isAuthenticated(), // Only fetch when logged in
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

// Close voting
export function useCloseVoting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => cafeService.closeVoting(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.all });
    },
  });
}

// Decide tie
export function useDecideTie() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ menuDate, winningOptionId }: { menuDate: string; winningOptionId: string }) =>
      cafeService.decideTie(menuDate, winningOptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.all });
    },
  });
}

// Get menu history
export function useMenuHistory(limit = 30, offset = 0) {
  return useQuery({
    queryKey: cafeKeys.history(limit, offset),
    queryFn: () => cafeService.getMenuHistory(limit, offset),
    enabled: isAuthenticated(), // Only fetch when logged in
    staleTime: 5 * 60 * 1000,
  });
}

// Open suggestions
export function useOpenSuggestions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => cafeService.openSuggestions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.suggestions() });
      queryClient.invalidateQueries({ queryKey: cafeKeys.status() });
    },
  });
}

// Close suggestions
export function useCloseSuggestions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => cafeService.closeSuggestions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.suggestions() });
      queryClient.invalidateQueries({ queryKey: cafeKeys.status() });
    },
  });
}

// Delete suggestion (chef only)
export function useDeleteSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (suggestionId: string) => cafeService.deleteSuggestion(suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cafeKeys.suggestions() });
    },
  });
}



