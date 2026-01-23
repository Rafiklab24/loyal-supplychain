/**
 * Packaging Details Section
 * Captures before/after packaging information for Elleçleme handling operations
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CubeIcon,
  ScaleIcon,
  SquaresPlusIcon,
} from '@heroicons/react/24/outline';
import { PACKAGE_TYPES, PackageType } from '../../services/ellecleme';

interface PackagingData {
  package_type?: PackageType;
  weight_per_package?: number;
  pieces_per_package?: number;
  package_count?: number;
  packages_per_pallet?: number;
  total_pallets?: number;
}

interface PackagingDetailsSectionProps {
  title: string;
  data: PackagingData;
  onChange: (data: PackagingData) => void;
  defaultExpanded?: boolean;
  variant?: 'before' | 'after';
}

function PackagingForm({ data, onChange, variant }: {
  data: PackagingData;
  onChange: (data: PackagingData) => void;
  variant: 'before' | 'after';
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const handleChange = (field: keyof PackagingData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  // Calculate total weight for display
  const totalWeight = (data.weight_per_package && data.package_count) 
    ? (data.weight_per_package * data.package_count).toFixed(2)
    : null;

  // Calculate total pieces for display
  const totalPieces = (data.pieces_per_package && data.package_count)
    ? (data.pieces_per_package * data.package_count)
    : null;

  // Get package type label based on language
  const getPackageLabel = (type: { labelEn: string; labelAr: string; labelTr: string }) => {
    if (i18n.language === 'ar') return type.labelAr;
    if (i18n.language === 'tr') return type.labelTr;
    return type.labelEn;
  };

  const variantColors = variant === 'before' 
    ? 'border-amber-200 bg-amber-50/50'
    : 'border-emerald-200 bg-emerald-50/50';

  return (
    <div className={`p-4 rounded-lg border ${variantColors}`}>
      {/* Row 1: Package Type and Weight */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Package Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <CubeIcon className="h-4 w-4 inline-block mr-1" />
            {t('ellecleme.packaging.type', 'Package Type')}
          </label>
          <select
            value={data.package_type || ''}
            onChange={(e) => handleChange('package_type', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">{t('common.select', 'Select...')}</option>
            {PACKAGE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {getPackageLabel(type)}
              </option>
            ))}
          </select>
        </div>

        {/* Weight per Package */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <ScaleIcon className="h-4 w-4 inline-block mr-1" />
            {t('ellecleme.packaging.weightPerPackage', 'Weight/Package')} (kg)
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={data.weight_per_package ?? ''}
            onChange={(e) => handleChange('weight_per_package', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="e.g., 25"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Row 2: Pieces and Package Count */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Pieces per Package */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t('ellecleme.packaging.piecesPerPackage', 'Pieces/Package')}
          </label>
          <input
            type="number"
            min="0"
            value={data.pieces_per_package ?? ''}
            onChange={(e) => handleChange('pieces_per_package', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="e.g., 1"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Package Count */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <SquaresPlusIcon className="h-4 w-4 inline-block mr-1" />
            {t('ellecleme.packaging.packageCount', 'Package Count')}
          </label>
          <input
            type="number"
            min="0"
            value={data.package_count ?? ''}
            onChange={(e) => handleChange('package_count', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="e.g., 100"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Row 3: Pallet Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Packages per Pallet */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t('ellecleme.packaging.packagesPerPallet', 'Packages/Pallet')}
          </label>
          <input
            type="number"
            min="0"
            value={data.packages_per_pallet ?? ''}
            onChange={(e) => handleChange('packages_per_pallet', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="e.g., 40"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Total Pallets */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t('ellecleme.packaging.totalPallets', 'Total Pallets')}
          </label>
          <input
            type="number"
            min="0"
            value={data.total_pallets ?? ''}
            onChange={(e) => handleChange('total_pallets', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="e.g., 3"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Calculated Summary */}
      {(totalWeight || totalPieces) && (
        <div className={`mt-3 pt-3 border-t ${variant === 'before' ? 'border-amber-200' : 'border-emerald-200'}`}>
          <div className="flex flex-wrap gap-4 text-sm">
            {totalWeight && (
              <div className="flex items-center gap-1 text-slate-600">
                <ScaleIcon className="h-4 w-4" />
                <span>{t('ellecleme.packaging.totalWeight', 'Total Weight')}:</span>
                <span className="font-semibold text-slate-800">{totalWeight} kg</span>
              </div>
            )}
            {totalPieces && (
              <div className="flex items-center gap-1 text-slate-600">
                <SquaresPlusIcon className="h-4 w-4" />
                <span>{t('ellecleme.packaging.totalPieces', 'Total Pieces')}:</span>
                <span className="font-semibold text-slate-800">{totalPieces.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PackagingDetailsSection({
  title,
  data,
  onChange,
  defaultExpanded = false,
  variant = 'before',
}: PackagingDetailsSectionProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Check if any packaging data is filled
  const hasData = Boolean(
    data.package_type ||
    data.weight_per_package ||
    data.pieces_per_package ||
    data.package_count ||
    data.packages_per_pallet ||
    data.total_pallets
  );

  const variantStyles = variant === 'before' 
    ? {
        headerBg: 'bg-amber-100 hover:bg-amber-200',
        headerText: 'text-amber-800',
        icon: 'text-amber-600',
      }
    : {
        headerBg: 'bg-emerald-100 hover:bg-emerald-200',
        headerText: 'text-emerald-800',
        icon: 'text-emerald-600',
      };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 ${variantStyles.headerBg} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <CubeIcon className={`h-5 w-5 ${variantStyles.icon}`} />
          <span className={`font-medium ${variantStyles.headerText}`}>
            {title}
          </span>
          {hasData && !isExpanded && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-white/60 rounded-full text-slate-600">
              {t('common.filled', 'Filled')}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUpIcon className={`h-5 w-5 ${variantStyles.icon}`} />
        ) : (
          <ChevronDownIcon className={`h-5 w-5 ${variantStyles.icon}`} />
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 bg-white">
          <PackagingForm data={data} onChange={onChange} variant={variant} />
        </div>
      )}
    </div>
  );
}

// Also export a compact display component for viewing saved packaging data
export function PackagingDataDisplay({ 
  data, 
  variant = 'before',
  label 
}: { 
  data: PackagingData; 
  variant?: 'before' | 'after';
  label?: string;
}) {
  const { t, i18n } = useTranslation();

  const hasData = Boolean(
    data.package_type ||
    data.weight_per_package ||
    data.pieces_per_package ||
    data.package_count ||
    data.packages_per_pallet ||
    data.total_pallets
  );

  if (!hasData) return null;

  const getPackageLabel = (type: PackageType | undefined) => {
    if (!type) return '-';
    const found = PACKAGE_TYPES.find(pt => pt.value === type);
    if (!found) return type;
    if (i18n.language === 'ar') return found.labelAr;
    if (i18n.language === 'tr') return found.labelTr;
    return found.labelEn;
  };

  const variantColors = variant === 'before' 
    ? 'bg-amber-50 border-amber-200'
    : 'bg-emerald-50 border-emerald-200';

  const totalWeight = (data.weight_per_package && data.package_count) 
    ? (data.weight_per_package * data.package_count).toFixed(2)
    : null;

  return (
    <div className={`p-3 rounded-lg border ${variantColors}`}>
      {label && (
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          {label}
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {data.package_type && (
          <>
            <span className="text-slate-500">{t('ellecleme.packaging.type', 'Type')}:</span>
            <span className="font-medium text-slate-800">{getPackageLabel(data.package_type)}</span>
          </>
        )}
        {data.weight_per_package && (
          <>
            <span className="text-slate-500">{t('ellecleme.packaging.weightPerPackage', 'Weight/Pkg')}:</span>
            <span className="font-medium text-slate-800">{data.weight_per_package} kg</span>
          </>
        )}
        {data.pieces_per_package && (
          <>
            <span className="text-slate-500">{t('ellecleme.packaging.piecesPerPackage', 'Pieces/Pkg')}:</span>
            <span className="font-medium text-slate-800">{data.pieces_per_package}</span>
          </>
        )}
        {data.package_count && (
          <>
            <span className="text-slate-500">{t('ellecleme.packaging.packageCount', 'Packages')}:</span>
            <span className="font-medium text-slate-800">{data.package_count.toLocaleString()}</span>
          </>
        )}
        {data.packages_per_pallet && (
          <>
            <span className="text-slate-500">{t('ellecleme.packaging.packagesPerPallet', 'Pkgs/Pallet')}:</span>
            <span className="font-medium text-slate-800">{data.packages_per_pallet}</span>
          </>
        )}
        {data.total_pallets !== undefined && data.total_pallets !== null && (
          <>
            <span className="text-slate-500">{t('ellecleme.packaging.totalPallets', 'Pallets')}:</span>
            <span className="font-medium text-slate-800">{data.total_pallets}</span>
          </>
        )}
        {totalWeight && (
          <>
            <span className="text-slate-500">{t('ellecleme.packaging.totalWeight', 'Total Weight')}:</span>
            <span className="font-semibold text-slate-800">{totalWeight} kg</span>
          </>
        )}
      </div>
    </div>
  );
}
