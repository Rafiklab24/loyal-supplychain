import { useState, useCallback } from 'react';

export interface UseLoadingStateReturn<T> {
  isLoading: boolean;
  error: Error | null;
  data: T | null;
  execute: (asyncFn: () => Promise<T>) => Promise<T>;
  reset: () => void;
}

/**
 * Hook for managing loading state, error handling, and data for async operations
 * 
 * @example
 * ```tsx
 * const { isLoading, error, data, execute } = useLoadingState<Shipment[]>();
 * 
 * useEffect(() => {
 *   execute(async () => {
 *     const response = await fetch('/api/shipments');
 *     return response.json();
 *   });
 * }, [execute]);
 * ```
 */
export function useLoadingState<T>(): UseLoadingStateReturn<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { isLoading, error, data, execute, reset };
}

