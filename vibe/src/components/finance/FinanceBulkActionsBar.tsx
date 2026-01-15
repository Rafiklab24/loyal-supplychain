import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon, TrashIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';

interface FinanceBulkActionsBarProps {
  selectedCount: number;
  onExport: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function FinanceBulkActionsBar({
  selectedCount,
  onExport,
  onArchive,
  onDelete,
  onClearSelection,
}: FinanceBulkActionsBarProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 start-0 end-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl z-40 animate-slide-up border-t-4 border-blue-400">
      <div className="py-4 px-4 sm:px-6 lg:px-8 max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center font-bold text-lg">
                {selectedCount}
              </div>
              <span className="font-semibold text-lg whitespace-nowrap">
                {isRtl ? 'معاملة مختارة' : 'transaction(s) selected'}
              </span>
            </div>
            <button
              onClick={onClearSelection}
              className="text-sm underline hover:no-underline whitespace-nowrap text-blue-100 hover:text-white transition-colors"
            >
              {isRtl ? 'إلغاء التحديد' : 'Clear selection'}
            </button>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-medium transition-colors shadow-md text-sm whitespace-nowrap"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
            </button>

            <button
              onClick={onArchive}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium transition-colors shadow-md text-sm whitespace-nowrap"
            >
              <ArchiveBoxIcon className="h-5 w-5" />
              {isRtl ? 'أرشفة' : 'Archive'}
            </button>

            <button
              onClick={onDelete}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-md text-sm whitespace-nowrap"
            >
              <TrashIcon className="h-5 w-5" />
              {isRtl ? 'حذف' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

