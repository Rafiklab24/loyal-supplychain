import { ReactNode } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingStateProps {
  isLoading: boolean;
  error?: Error | null;
  children: ReactNode;
  skeleton?: ReactNode;
  emptyState?: ReactNode;
  data?: any[] | null;
  loadingLabel?: string;
}

export function LoadingState({
  isLoading,
  error,
  children,
  skeleton,
  emptyState,
  data,
  loadingLabel = 'Loading...',
}: LoadingStateProps) {
  if (isLoading) {
    return <>{skeleton || <LoadingSpinner size="lg" className="py-12" label={loadingLabel} />}</>;
  }

  if (error) {
    return (
      <div className="text-center py-12" role="alert">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-600 mb-4 font-medium">Error loading data</p>
          <p className="text-gray-600 mb-4 text-sm">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            aria-label="Retry loading data"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (emptyState && (!data || data.length === 0)) {
    return <>{emptyState}</>;
  }

  return <>{children}</>;
}

