/**
 * CollapsibleSection Component
 * A reusable accordion-style collapsible section with summary and expanded states
 * Used in Shipment Final Report and other detail pages
 */

import { useState, ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export interface CollapsibleSectionProps {
  /** Unique identifier for the section */
  id: string;
  /** Section title displayed in the header */
  title: string;
  /** Icon component to display next to the title */
  icon?: ReactNode;
  /** Summary content shown when collapsed (optional - defaults to showing collapsed indicator) */
  summary?: ReactNode;
  /** Full detailed content shown when expanded */
  children: ReactNode;
  /** Initial expanded state */
  defaultExpanded?: boolean;
  /** Controlled expanded state (optional) */
  isExpanded?: boolean;
  /** Callback when expanded state changes */
  onToggle?: (isExpanded: boolean) => void;
  /** Badge to show in header (e.g., count, status) */
  badge?: ReactNode;
  /** Color theme for the section header */
  theme?: 'default' | 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'indigo';
  /** Whether the section has any content to display */
  hasContent?: boolean;
  /** Empty state message when hasContent is false */
  emptyMessage?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether section is in loading state */
  isLoading?: boolean;
  /** Disable toggle functionality */
  disabled?: boolean;
}

const themeStyles = {
  default: {
    border: 'border-gray-200',
    headerBg: 'bg-gray-50',
    headerHover: 'hover:bg-gray-100',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    titleColor: 'text-gray-900',
  },
  blue: {
    border: 'border-blue-200',
    headerBg: 'bg-blue-50',
    headerHover: 'hover:bg-blue-100',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
  },
  green: {
    border: 'border-green-200',
    headerBg: 'bg-green-50',
    headerHover: 'hover:bg-green-100',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    titleColor: 'text-green-900',
  },
  purple: {
    border: 'border-purple-200',
    headerBg: 'bg-purple-50',
    headerHover: 'hover:bg-purple-100',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    titleColor: 'text-purple-900',
  },
  amber: {
    border: 'border-amber-200',
    headerBg: 'bg-amber-50',
    headerHover: 'hover:bg-amber-100',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
  },
  red: {
    border: 'border-red-200',
    headerBg: 'bg-red-50',
    headerHover: 'hover:bg-red-100',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    titleColor: 'text-red-900',
  },
  indigo: {
    border: 'border-indigo-200',
    headerBg: 'bg-indigo-50',
    headerHover: 'hover:bg-indigo-100',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    titleColor: 'text-indigo-900',
  },
};

export function CollapsibleSection({
  id,
  title,
  icon,
  summary,
  children,
  defaultExpanded = false,
  isExpanded: controlledExpanded,
  onToggle,
  badge,
  theme = 'default',
  hasContent = true,
  emptyMessage = 'No data available',
  className = '',
  isLoading = false,
  disabled = false,
}: CollapsibleSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  
  // Use controlled state if provided, otherwise use internal state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  
  const handleToggle = () => {
    if (disabled || isLoading) return;
    
    const newState = !expanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(newState);
    }
    onToggle?.(newState);
  };
  
  const styles = themeStyles[theme];
  
  return (
    <div 
      id={id}
      className={`
        bg-white rounded-xl border-2 ${styles.border} 
        overflow-hidden transition-all duration-200 
        shadow-sm hover:shadow-md
        ${className}
      `}
    >
      {/* Header - Always visible, acts as toggle */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || isLoading}
        className={`
          w-full px-5 py-4 flex items-center justify-between
          ${styles.headerBg} ${!disabled && !isLoading ? styles.headerHover : ''}
          transition-colors duration-150 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500
          ${disabled ? 'cursor-not-allowed opacity-60' : ''}
        `}
        aria-expanded={expanded}
        aria-controls={`${id}-content`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          {icon && (
            <div className={`
              flex-shrink-0 p-2 rounded-lg ${styles.iconBg}
            `}>
              <span className={`block w-5 h-5 ${styles.iconColor}`}>
                {icon}
              </span>
            </div>
          )}
          
          {/* Title and Summary */}
          <div className="flex-1 min-w-0 text-start">
            <h3 className={`text-base font-semibold ${styles.titleColor} truncate`}>
              {title}
            </h3>
            
            {/* Summary shown when collapsed */}
            {!expanded && summary && (
              <div className="mt-1 text-sm text-gray-600 line-clamp-1">
                {summary}
              </div>
            )}
          </div>
          
          {/* Badge */}
          {badge && (
            <div className="flex-shrink-0">
              {badge}
            </div>
          )}
        </div>
        
        {/* Expand/Collapse indicator */}
        <div className={`
          flex-shrink-0 ms-3 p-1.5 rounded-full
          transition-transform duration-200
          ${expanded ? 'rotate-180' : 'rotate-0'}
          ${styles.iconColor}
        `}>
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ChevronDownIcon className="w-5 h-5" />
          )}
        </div>
      </button>
      
      {/* Expandable Content */}
      <div
        id={`${id}-content`}
        role="region"
        aria-labelledby={id}
        className={`
          transition-all duration-300 ease-in-out
          ${expanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}
        `}
      >
        <div className={`
          px-5 py-5 border-t ${styles.border}
          ${expanded ? 'animate-fadeIn' : ''}
        `}>
          {hasContent ? (
            children
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage multiple collapsible sections' expanded states
 * Useful for "expand all" / "collapse all" functionality
 */
export function useCollapsibleSections(sectionIds: string[], defaultExpanded: boolean = false) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    defaultExpanded ? new Set(sectionIds) : new Set()
  );
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };
  
  const expandAll = () => {
    setExpandedSections(new Set(sectionIds));
  };
  
  const collapseAll = () => {
    setExpandedSections(new Set());
  };
  
  const isSectionExpanded = (sectionId: string) => expandedSections.has(sectionId);
  
  const allExpanded = expandedSections.size === sectionIds.length;
  const allCollapsed = expandedSections.size === 0;
  
  return {
    expandedSections,
    toggleSection,
    expandAll,
    collapseAll,
    isSectionExpanded,
    allExpanded,
    allCollapsed,
  };
}

export default CollapsibleSection;

