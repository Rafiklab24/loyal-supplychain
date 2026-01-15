import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface BulkActionsBarProps {
  selectedCount: number;
  onExport: () => void;
  onCompare?: () => void;
  onChangeStatus: (status: string) => void;
  onMarkAsDelivered: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onExport,
  onCompare,
  onChangeStatus,
  onMarkAsDelivered,
  onDelete,
  onClearSelection,
}: BulkActionsBarProps) {
  const { t } = useTranslation();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    }

    if (showStatusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStatusMenu]);

  if (selectedCount === 0) return null;

  const handleStatusChange = (status: string) => {
    onChangeStatus(status);
    setShowStatusMenu(false);
  };

  return (
    <div className="fixed bottom-0 start-0 end-0 bg-blue-600 text-white shadow-lg z-40 animate-slide-up">
      <div className="py-4 px-4 sm:px-6 lg:px-8 max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-semibold whitespace-nowrap">
              {selectedCount} {t('shipments.selected', 'selected')}
            </span>
            <button
              onClick={onClearSelection}
              className="text-sm underline hover:no-underline whitespace-nowrap"
            >
              {t('common.clearSelection', 'Clear selection')}
            </button>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={onExport}
              className="px-3 py-2 bg-white text-blue-600 rounded-md hover:bg-gray-100 font-medium transition-colors text-sm whitespace-nowrap"
            >
              📥 {t('shipments.export', 'Export')}
            </button>

            {onCompare && selectedCount >= 2 && selectedCount <= 5 && (
              <button
                onClick={onCompare}
                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium transition-colors text-sm whitespace-nowrap"
              >
                🔍 {t('shipments.compare', 'Compare')}
              </button>
            )}

            <button
              onClick={onMarkAsDelivered}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors text-sm whitespace-nowrap"
            >
              ✅ {t('shipments.markDelivered', 'Mark as Delivered')}
            </button>

            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 font-medium transition-colors text-sm whitespace-nowrap"
              >
                🔄 {t('shipments.changeStatus', 'Change Status')}
              </button>
              {showStatusMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 rounded-md shadow-xl py-1 min-w-[150px] border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleStatusChange('planning')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    📋 Planning
                  </button>
                  <button
                    onClick={() => handleStatusChange('booked')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    📝 Booked
                  </button>
                  <button
                    onClick={() => handleStatusChange('sailed')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    🚢 Sailed
                  </button>
                  <button
                    onClick={() => handleStatusChange('arrived')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    ✈️ Arrived
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onDelete}
              className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors text-sm whitespace-nowrap"
            >
              🗑️ {t('common.delete', 'Delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

