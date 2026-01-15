import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadingState } from '../../../hooks/useLoadingState';

describe('useLoadingState', () => {
  it('should initialize with loading false', () => {
    const { result } = renderHook(() => useLoadingState());

    expect(result.current.isLoading).toBe(false);
  });

  it('should set loading to true', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should set loading to false', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setLoading(true);
      result.current.setLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should set error', () => {
    const { result } = renderHook(() => useLoadingState());
    const error = new Error('Test error');

    act(() => {
      result.current.setError(error);
    });

    expect(result.current.error).toBe(error);
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setError(new Error('Test error'));
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should execute async function with loading state', async () => {
    const { result } = renderHook(() => useLoadingState());

    const asyncFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'result';
    };

    let executionResult: string | undefined;

    await act(async () => {
      executionResult = await result.current.execute(asyncFn);
    });

    expect(executionResult).toBe('result');
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle errors in async function', async () => {
    const { result } = renderHook(() => useLoadingState());

    const asyncFn = async () => {
      throw new Error('Async error');
    };

    await act(async () => {
      await result.current.execute(asyncFn).catch(() => {});
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.isLoading).toBe(false);
  });
});
