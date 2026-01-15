/**
 * Problem Type Selector
 * Big icon-based selector for quality issue types
 * Supports MULTIPLE selections (e.g., Moisture + Mold)
 * Designed for low-literacy users
 */

import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { Spinner } from '../common/Spinner';
import { ISSUE_TYPES } from '../../services/qualityIncidents';
import type { IssueType } from '../../services/qualityIncidents';

interface ProblemTypeSelectorProps {
  selectedTypes: IssueType[];
  onToggleType: (type: IssueType) => void;
  onContinue: () => void;
  isLoading: boolean;
  isRtl: boolean;
}

export function ProblemTypeSelector({
  selectedTypes,
  onToggleType,
  onContinue,
  isLoading,
  isRtl
}: ProblemTypeSelectorProps) {
  const hasSelection = selectedTypes.length > 0;
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
        {isRtl ? 'ما هي المشكلة؟' : 'What is the problem?'}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
        {isRtl ? 'اختر نوع المشكلة (يمكن اختيار أكثر من نوع)' : 'Select issue type(s) - you can select multiple'}
      </p>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        {(Object.keys(ISSUE_TYPES) as IssueType[]).map((type) => {
          const isSelected = selectedTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              disabled={isLoading}
              className={`relative p-6 rounded-2xl border-2 flex flex-col items-center justify-center transition-all disabled:opacity-50 ${
                isSelected
                  ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 ring-2 ring-amber-500 ring-offset-2'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-amber-400'
              }`}
            >
              {/* Checkmark for selected items */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <CheckCircleIcon className="h-6 w-6 text-amber-600" />
                </div>
              )}
              
              <span className="text-4xl mb-3">{ISSUE_TYPES[type].icon}</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {isRtl ? ISSUE_TYPES[type].labelAr : ISSUE_TYPES[type].label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Selected summary */}
      {hasSelection && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
            {isRtl ? 'تم اختيار:' : 'Selected:'}{' '}
            <strong>
              {selectedTypes.map(t => isRtl ? ISSUE_TYPES[t].labelAr : ISSUE_TYPES[t].label).join(' + ')}
            </strong>
          </p>
        </div>
      )}
      
      {/* Continue Button */}
      <button
        onClick={onContinue}
        disabled={!hasSelection || isLoading}
        className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            {isRtl ? 'التالي: التقاط الصور' : 'Next: Capture Photos'}
          </>
        )}
      </button>
    </div>
  );
}

export default ProblemTypeSelector;
