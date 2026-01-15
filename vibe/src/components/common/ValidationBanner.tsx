/**
 * ValidationBanner Component
 * 
 * Displays validation errors (red) and warnings (yellow/amber) in a banner format.
 * Supports collapsible list of issues and acknowledgment actions.
 */

import React, { useState } from 'react';
import {
  ExclamationTriangleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { ValidationIssue } from '../../utils/shipmentValidation';

interface ValidationBannerProps {
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  acknowledgedWarnings?: Set<string>;
  onAcknowledgeWarning?: (warningId: string) => void;
  onAcknowledgeAll?: () => void;
  showAcknowledgeButton?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({
  errors = [],
  warnings = [],
  acknowledgedWarnings = new Set(),
  onAcknowledgeWarning,
  onAcknowledgeAll,
  showAcknowledgeButton = true,
  collapsible = true,
  defaultExpanded = true,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const unacknowledgedWarnings = warnings.filter(w => !acknowledgedWarnings.has(w.id));

  if (!hasErrors && !hasWarnings) {
    return null;
  }

  const getMessage = (issue: ValidationIssue): string => {
    if (isRtl && issue.messageAr) {
      return issue.messageAr;
    }
    return issue.message;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Errors Banner */}
      {hasErrors && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-red-800">
                  {t('validation.errorsFound', 'Errors Found')} ({errors.length})
                </h4>
                {collapsible && errors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-red-600 hover:text-red-800 p-1"
                  >
                    {expanded ? (
                      <ChevronUpIcon className="h-4 w-4" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              
              {(expanded || errors.length === 1) && (
                <ul className="mt-2 space-y-1.5">
                  {errors.map((error) => (
                    <li key={error.id} className="text-sm text-red-700">
                      <div className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        <div>
                          <span>{getMessage(error)}</span>
                          {error.details && (
                            <p className="text-xs text-red-500 mt-0.5">{error.details}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              <p className="mt-2 text-xs text-red-600">
                {t('validation.mustFixErrors', 'You must fix these errors before proceeding.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warnings Banner */}
      {hasWarnings && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-amber-800">
                  {t('validation.warningsFound', 'Warnings')} ({warnings.length})
                  {unacknowledgedWarnings.length < warnings.length && (
                    <span className="ml-2 text-xs font-normal text-amber-600">
                      ({warnings.length - unacknowledgedWarnings.length} {t('validation.acknowledged', 'acknowledged')})
                    </span>
                  )}
                </h4>
                {collapsible && warnings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-amber-600 hover:text-amber-800 p-1"
                  >
                    {expanded ? (
                      <ChevronUpIcon className="h-4 w-4" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              
              {(expanded || warnings.length === 1) && (
                <ul className="mt-2 space-y-2">
                  {warnings.map((warning) => {
                    const isAcknowledged = acknowledgedWarnings.has(warning.id);
                    return (
                      <li
                        key={warning.id}
                        className={`text-sm ${isAcknowledged ? 'text-amber-500 line-through' : 'text-amber-700'}`}
                      >
                        <div className="flex items-start gap-2">
                          {isAcknowledged ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <span className="text-amber-400">•</span>
                          )}
                          <div className="flex-1">
                            <span>{getMessage(warning)}</span>
                            {warning.details && (
                              <p className="text-xs text-amber-500 mt-0.5">{warning.details}</p>
                            )}
                          </div>
                          {!isAcknowledged && showAcknowledgeButton && onAcknowledgeWarning && (
                            <button
                              type="button"
                              onClick={() => onAcknowledgeWarning(warning.id)}
                              className="text-xs text-amber-700 hover:text-amber-900 underline flex-shrink-0"
                            >
                              {t('validation.acknowledgeThis', 'OK')}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              
              {showAcknowledgeButton && unacknowledgedWarnings.length > 0 && onAcknowledgeAll && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onAcknowledgeAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 transition-colors"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    {t('validation.acknowledgeAllWarnings', 'I understand, proceed anyway')}
                  </button>
                </div>
              )}
              
              {unacknowledgedWarnings.length === 0 && warnings.length > 0 && (
                <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircleIcon className="h-4 w-4" />
                  {t('validation.allWarningsAcknowledged', 'All warnings acknowledged')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simplified version for inline use in form fields
interface InlineValidationProps {
  issue?: ValidationIssue;
  className?: string;
}

export const InlineValidation: React.FC<InlineValidationProps> = ({ issue, className = '' }) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  if (!issue) return null;

  const isError = issue.severity === 'error';
  const message = isRtl && issue.messageAr ? issue.messageAr : issue.message;

  return (
    <div
      className={`flex items-center gap-1.5 mt-1 text-xs ${
        isError ? 'text-red-600' : 'text-amber-600'
      } ${className}`}
    >
      {isError ? (
        <XCircleIcon className="h-3.5 w-3.5" />
      ) : (
        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
      )}
      <span>{message}</span>
    </div>
  );
};

export default ValidationBanner;



