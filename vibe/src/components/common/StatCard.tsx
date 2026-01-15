import type { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string;
  icon?: ReactNode;
  color?: string;
}

export function StatCard({ title, value, icon, color = 'primary' }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card>
      <div className="flex items-center">
        {icon && (
          <div className={`flex-shrink-0 p-3 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
        <div className={icon ? 'ms-4' : ''}>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
      </div>
    </Card>
  );
}

