import { CheckIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
  onStepClick?: (step: number) => void;
  allowSkipToAll?: boolean; // New prop for edit mode - allows jumping to any step
}

export function ProgressStepper({ currentStep, totalSteps, stepTitles, onStepClick, allowSkipToAll = false }: ProgressStepperProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;
          // In edit mode (allowSkipToAll), all steps are clickable; otherwise only completed and current
          const isClickable = onStepClick && (allowSkipToAll || isCompleted || isCurrent);

          return (
            <li key={stepNumber} className="relative flex-1">
              {/* Connector line */}
              {stepNumber < totalSteps && (
                <div
                  className={clsx(
                    'absolute top-5 h-0.5 w-full',
                    isRTL ? 'right-1/2' : 'left-1/2',
                    isCompleted ? 'bg-blue-600' : allowSkipToAll ? 'bg-blue-200' : 'bg-gray-300'
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step indicator */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(stepNumber)}
                disabled={!isClickable}
                className={clsx(
                  'relative flex flex-col items-center group w-full',
                  isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
                  !isClickable && 'cursor-not-allowed'
                )}
                aria-label={`${stepTitles[index]} - ${isCurrent ? 'Current step' : isCompleted ? 'Completed step' : 'Upcoming step'}`}
              >
                <span
                  className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all z-10',
                    isCompleted && 'bg-blue-600 border-blue-600',
                    isCurrent && 'border-blue-600 bg-white ring-4 ring-blue-100',
                    isUpcoming && !allowSkipToAll && 'border-gray-300 bg-white',
                    isUpcoming && allowSkipToAll && 'border-blue-300 bg-white', // Lighter blue border in edit mode
                    isClickable && 'group-hover:ring-4 group-hover:ring-blue-100'
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  ) : (
                    <span
                      className={clsx(
                        'text-sm font-semibold',
                        isCurrent && 'text-blue-600',
                        isUpcoming && !allowSkipToAll && 'text-gray-500',
                        isUpcoming && allowSkipToAll && 'text-blue-400' // Lighter blue text in edit mode
                      )}
                    >
                      {stepNumber}
                    </span>
                  )}
                </span>

                {/* Step title */}
                <span
                  className={clsx(
                    'mt-2 text-xs font-medium text-center px-2',
                    isCurrent && 'text-blue-600 font-semibold',
                    isCompleted && 'text-gray-900',
                    isUpcoming && !allowSkipToAll && 'text-gray-500',
                    isUpcoming && allowSkipToAll && 'text-blue-400', // Lighter blue text in edit mode
                    isClickable && 'group-hover:text-blue-700'
                  )}
                >
                  {stepTitles[index]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

