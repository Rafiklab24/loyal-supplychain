import clsx from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  className = '',
  label = 'Loading...'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={clsx('flex items-center justify-center', className)} role="status" aria-label={label}>
      <div
        className={clsx(
          sizeClasses[size],
          'border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin'
        )}
      >
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

