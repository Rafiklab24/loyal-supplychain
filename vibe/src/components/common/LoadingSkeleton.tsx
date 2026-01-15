interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
  showHeader?: boolean;
}

export function LoadingSkeleton({ 
  lines = 3, 
  className = '',
  showHeader = false 
}: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse space-y-4 ${className}`} aria-label="Loading content">
      {showHeader && (
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded w-3/4" />
      ))}
    </div>
  );
}

/**
 * Table skeleton loader
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse" aria-label="Loading table">
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded flex-1" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div key={colIdx} className="h-4 bg-gray-200 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Card skeleton loader
 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse bg-white rounded-lg shadow p-6">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-full" />
        </div>
      ))}
    </div>
  );
}

