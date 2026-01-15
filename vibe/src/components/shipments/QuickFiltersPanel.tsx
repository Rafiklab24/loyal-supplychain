import { useTranslation } from 'react-i18next';

interface FilterSuggestion {
  name: string;
  count: number;
}

interface QuickFiltersPanelProps {
  suggestions: {
    topOrigins: FilterSuggestion[];
    topDestinations: FilterSuggestion[];
    topProducts: FilterSuggestion[];
    shippingLines: FilterSuggestion[];
  } | undefined;
  onFilterChange: (type: 'origin' | 'destination' | 'product' | 'shippingLine' | 'valueRange' | 'dateRange', value: string | null) => void;
  activeFilters: {
    origin: string | null;
    destination: string | null;
    product: string | null;
    shippingLine: string | null;
    valueRange: string | null;
    dateRange: string | null;
  };
}

export function QuickFiltersPanel({ suggestions, onFilterChange, activeFilters }: QuickFiltersPanelProps) {
  const { t } = useTranslation();

  const valueRanges = [
    { label: t('filters.lessThan10K', '<$10K'), value: '<10000' },
    { label: t('filters.10Kto50K', '$10K-50K'), value: '10000-50000' },
    { label: t('filters.50Kto100K', '$50K-100K'), value: '50000-100000' },
    { label: t('filters.moreThan100K', '>$100K'), value: '>100000' },
  ];

  const dateRanges = [
    { label: t('filters.thisMonth', 'This Month'), value: 'thisMonth' },
    { label: t('filters.lastMonth', 'Last Month'), value: 'lastMonth' },
    { label: t('filters.thisQuarter', 'This Quarter'), value: 'thisQuarter' },
    { label: t('filters.thisYear', 'This Year'), value: 'thisYear' },
  ];

  const renderFilterSection = (
    title: string,
    items: FilterSuggestion[],
    type: 'origin' | 'destination' | 'product' | 'shippingLine'
  ) => (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive = activeFilters[type] === item.name;
          return (
            <button
              key={item.name}
              onClick={() => onFilterChange(type, isActive ? null : item.name)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              {item.name} {item.count > 0 && `(${item.count})`}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderSimpleFilterSection = (
    title: string,
    items: { label: string; value: string }[],
    type: 'valueRange' | 'dateRange'
  ) => (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive = activeFilters[type] === item.value;
          return (
            <button
              key={item.value}
              onClick={() => onFilterChange(type, isActive ? null : item.value)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!suggestions) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderFilterSection(
        t('filters.topOrigins', 'Top Origins'),
        suggestions.topOrigins.slice(0, 5),
        'origin'
      )}

      {renderFilterSection(
        t('filters.topDestinations', 'Top Destinations'),
        suggestions.topDestinations.slice(0, 5),
        'destination'
      )}

      {renderFilterSection(
        t('filters.topProducts', 'Top Products'),
        suggestions.topProducts.slice(0, 5),
        'product'
      )}

      {renderSimpleFilterSection(
        t('filters.valueRanges', 'Value Ranges'),
        valueRanges,
        'valueRange'
      )}

      {renderSimpleFilterSection(
        t('filters.dateRanges', 'Date Ranges'),
        dateRanges,
        'dateRange'
      )}
    </div>
  );
}
