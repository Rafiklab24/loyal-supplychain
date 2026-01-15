import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon, XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { DuplicateMatch } from '../../hooks/useDuplicateCheck';
import { formatSimilarityScore } from '../../hooks/useDuplicateCheck';

interface DuplicateEntityWarningProps {
  /** Whether currently checking for duplicates */
  isChecking: boolean;
  /** Whether a potential duplicate was found (warning level) */
  hasPotentialDuplicate: boolean;
  /** Whether the duplicate blocks creation (>= 70% match) */
  isDuplicateBlocked: boolean;
  /** The best matching entity */
  bestMatch: DuplicateMatch | null;
  /** All matches above threshold */
  matches?: DuplicateMatch[];
  /** Callback when user selects an existing entity */
  onSelectExisting?: (match: DuplicateMatch) => void;
  /** Custom class name */
  className?: string;
}

/**
 * Warning component that displays when a potential duplicate entity is detected
 * 
 * Shows three levels:
 * - Blocked (>= 70%): Red banner, prevents creation
 * - Warning (50-70%): Amber banner, allows creation with caution
 * - Info (< 50%): No display
 * 
 * Includes:
 * - Similarity percentage
 * - Name of matched entity
 * - "Use existing" button to select the matched entity
 */
export function DuplicateEntityWarning({
  isChecking,
  hasPotentialDuplicate,
  isDuplicateBlocked,
  bestMatch,
  matches = [],
  onSelectExisting,
  className = '',
}: DuplicateEntityWarningProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // Don't show anything if no duplicates or still checking
  if (!hasPotentialDuplicate || !bestMatch) {
    if (isChecking) {
      return (
        <div className={`flex items-center gap-2 text-xs text-gray-500 mt-1 ${className}`}>
          <div className="animate-spin h-3 w-3 border-2 border-gray-300 border-t-gray-600 rounded-full" />
          <span>{t('common.checkingDuplicates', 'Checking for duplicates...')}</span>
        </div>
      );
    }
    return null;
  }

  const similarityPercent = formatSimilarityScore(bestMatch.score);

  // Blocked state (>= 70% match)
  if (isDuplicateBlocked) {
    return (
      <div className={`mt-2 p-3 bg-red-50 border border-red-300 rounded-lg ${className}`}>
        <div className="flex items-start gap-3">
          <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">
              {t('common.duplicateBlocked', 'Cannot create - similar entity exists')}
            </p>
            <p className="text-sm text-red-700 mt-1">
              {isArabic ? (
                <>
                  <span className="font-semibold">{bestMatch.name}</span>
                  {' '}
                  ({similarityPercent} {t('common.similar', 'similar')})
                </>
              ) : (
                <>
                  Found <span className="font-semibold">"{bestMatch.name}"</span>
                  {' '}
                  ({similarityPercent} similar)
                </>
              )}
            </p>
            <p className="text-xs text-red-600 mt-1.5">
              {t('common.duplicateBlockedHint', 'Entities with 70% or higher similarity are blocked to prevent duplicates.')}
            </p>
            {onSelectExisting && (
              <button
                type="button"
                onClick={() => onSelectExisting(bestMatch)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {t('common.useExisting', 'Use existing')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Warning state (50-70% match)
  return (
    <div className={`mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg ${className}`}>
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            {t('common.potentialDuplicate', 'Potential duplicate detected')}
          </p>
          <p className="text-sm text-amber-700 mt-1">
            {isArabic ? (
              <>
                {t('common.similarTo', 'Similar to')}{' '}
                <span className="font-semibold">{bestMatch.name}</span>
                {' '}
                ({similarityPercent})
              </>
            ) : (
              <>
                Similar to <span className="font-semibold">"{bestMatch.name}"</span>
                {' '}
                ({similarityPercent})
              </>
            )}
          </p>
          
          {/* Show other matches if there are more */}
          {matches.length > 1 && (
            <div className="mt-2 text-xs text-amber-600">
              <span>{t('common.otherMatches', 'Other possible matches')}:</span>
              <ul className="mt-1 space-y-0.5">
                {matches.slice(1, 3).map((match) => (
                  <li key={match.id} className="flex items-center gap-2">
                    <span>• {match.name}</span>
                    <span className="text-amber-500">({formatSimilarityScore(match.score)})</span>
                    {onSelectExisting && (
                      <button
                        type="button"
                        onClick={() => onSelectExisting(match)}
                        className="text-amber-700 hover:text-amber-900 underline"
                      >
                        {t('common.select', 'select')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onSelectExisting && (
            <button
              type="button"
              onClick={() => onSelectExisting(bestMatch)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-800 bg-amber-100 rounded-md hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 border border-amber-300"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {t('common.useExistingInstead', 'Use existing instead')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline warning badge for showing duplicate status in a more compact form
 */
export function DuplicateBadge({
  isChecking,
  isDuplicateBlocked,
  hasPotentialDuplicate,
  bestMatch,
}: Pick<DuplicateEntityWarningProps, 'isChecking' | 'isDuplicateBlocked' | 'hasPotentialDuplicate' | 'bestMatch'>) {
  if (isChecking) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <div className="animate-spin h-2.5 w-2.5 border border-gray-400 border-t-gray-600 rounded-full" />
      </span>
    );
  }

  if (!hasPotentialDuplicate || !bestMatch) {
    return null;
  }

  if (isDuplicateBlocked) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-full">
        <XCircleIcon className="h-3 w-3" />
        {formatSimilarityScore(bestMatch.score)} match
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
      <ExclamationTriangleIcon className="h-3 w-3" />
      {formatSimilarityScore(bestMatch.score)} similar
    </span>
  );
}

export default DuplicateEntityWarning;

