import type { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  title?: string | ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, title, className, onClick }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-md p-6',
        onClick && 'cursor-pointer hover:shadow-lg transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      {children}
    </div>
  );
}

