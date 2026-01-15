import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon, CheckCircleIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export interface FuzzyMatch {
  id: string;
  name: string;
  score: number;
  country?: string;
}

interface FuzzyMatchWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  typedName: string;
  matches: FuzzyMatch[];
  onSelectExisting: (match: FuzzyMatch) => void;
  onCreateNew: (name: string) => void;
  entityType?: 'supplier' | 'customer' | 'company';
}

export function FuzzyMatchWarningModal({
  isOpen,
  onClose,
  typedName,
  matches,
  onSelectExisting,
  onCreateNew,
  entityType = 'supplier',
}: FuzzyMatchWarningModalProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // Get the best match (highest score)
  const bestMatch = matches.length > 0 ? matches[0] : null;

  const entityLabels = {
    supplier: { en: 'Supplier', ar: 'مورد' },
    customer: { en: 'Customer', ar: 'عميل' },
    company: { en: 'Company', ar: 'شركة' },
  };

  const entityLabel = isArabic 
    ? entityLabels[entityType].ar 
    : entityLabels[entityType].en;

  const handleSelectExisting = () => {
    if (bestMatch) {
      onSelectExisting(bestMatch);
      onClose();
    }
  };

  const handleCreateNew = () => {
    onCreateNew(typedName);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-start align-middle shadow-xl transition-all">
                {/* Header with warning icon */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900"
                    >
                      {isArabic ? `${entityLabel} مشابه موجود` : `Similar ${entityLabel} Found`}
                    </Dialog.Title>
                    <p className="text-sm text-gray-500">
                      {isArabic 
                        ? 'وجدنا سجلاً مشابهاً في النظام'
                        : 'We found a similar record in the system'}
                    </p>
                  </div>
                </div>

                {/* Comparison Section */}
                <div className="mt-4 space-y-3">
                  {/* What user typed */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">
                      {isArabic ? 'ما أدخلته:' : 'You typed:'}
                    </p>
                    <p className="font-medium text-gray-900">{typedName}</p>
                  </div>

                  {/* Arrow indicator */}
                  <div className="flex justify-center">
                    <div className="text-gray-400 text-lg">↓</div>
                  </div>

                  {/* Matched record */}
                  {bestMatch && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-amber-700 mb-1">
                            {isArabic ? 'السجل الموجود:' : 'Existing record:'}
                          </p>
                          <p className="font-medium text-gray-900">{bestMatch.name}</p>
                          {bestMatch.country && (
                            <p className="text-xs text-gray-500 mt-0.5">{bestMatch.country}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {Math.round(bestMatch.score * 100)}% {isArabic ? 'تطابق' : 'match'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Other matches (if any) */}
                  {matches.length > 1 && (
                    <div className="text-xs text-gray-500">
                      <p className="mb-1">
                        {isArabic 
                          ? `${matches.length - 1} نتائج أخرى مشابهة:`
                          : `${matches.length - 1} other similar result${matches.length > 2 ? 's' : ''}:`}
                      </p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {matches.slice(1, 4).map((match, idx) => (
                          <li key={idx} className="text-gray-600">
                            {match.name} ({Math.round(match.score * 100)}%)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Question */}
                <div className="mt-5 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 font-medium">
                    {isArabic 
                      ? `هل تقصد "${bestMatch?.name}"؟`
                      : `Did you mean "${bestMatch?.name}"?`}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    onClick={handleSelectExisting}
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    {isArabic ? 'استخدام الموجود' : 'Use Existing'}
                  </button>
                  <button
                    type="button"
                    className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    onClick={handleCreateNew}
                  >
                    <PlusCircleIcon className="h-5 w-5" />
                    {isArabic ? 'إنشاء جديد' : 'Create New'}
                  </button>
                </div>

                {/* Help text */}
                <p className="mt-3 text-xs text-center text-gray-500">
                  {isArabic 
                    ? 'اختيار "استخدام الموجود" سيربط هذه الشحنة بالسجل الموجود. اختيار "إنشاء جديد" سينشئ سجلاً جديداً.'
                    : 'Choosing "Use Existing" will link this shipment to the existing record. Choosing "Create New" will create a new record.'}
                </p>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

