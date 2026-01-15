import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo' | 'cyan' | 'emerald' | 'teal' | 'orange' | 'amber';
  size?: 'sm' | 'md';
}

export function Badge({ children, color = 'gray', size = 'md' }: BadgeProps) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    purple: 'bg-purple-100 text-purple-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    cyan: 'bg-cyan-100 text-cyan-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    teal: 'bg-teal-100 text-teal-800',
    orange: 'bg-orange-100 text-orange-800',
    amber: 'bg-amber-100 text-amber-800',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        colorClasses[color],
        sizeClasses[size]
      )}
    >
      {children}
    </span>
  );
}

