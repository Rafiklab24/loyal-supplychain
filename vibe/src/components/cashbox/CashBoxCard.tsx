import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BanknotesIcon, 
  ArrowUpIcon, 
  ArrowDownIcon,
  ClockIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import type { CashBox } from '../../services/cashbox';
import { formatCurrency } from '../../services/cashbox';
import { usePermissions } from '../../contexts/PermissionContext';

interface CashBoxCardProps {
  cashBox: CashBox;
  onDeposit: (cashBox: CashBox) => void;
  onWithdraw: (cashBox: CashBox) => void;
  onEditBalance?: (cashBox: CashBox) => void;
}

export function CashBoxCard({ 
  cashBox, 
  onDeposit, 
  onWithdraw,
  onEditBalance,
}: CashBoxCardProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { role } = usePermissions();
  const isAdmin = role === 'Admin';

  // Currency-specific colors
  const currencyColors: Record<string, { bg: string; text: string; accent: string }> = {
    USD: { bg: 'bg-emerald-50', text: 'text-emerald-800', accent: 'border-emerald-400' },
    EUR: { bg: 'bg-blue-50', text: 'text-blue-800', accent: 'border-blue-400' },
    TRY: { bg: 'bg-amber-50', text: 'text-amber-800', accent: 'border-amber-400' },
  };

  const colors = currencyColors[cashBox.currency_code] || currencyColors.USD;

  return (
    <div className={`${colors.bg} rounded-xl border-2 ${colors.accent} p-6 shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.text} bg-white/50`}>
            <BanknotesIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${colors.text}`}>
              {isRtl ? cashBox.name_ar || cashBox.name : cashBox.name}
            </h3>
            <span className="text-sm text-gray-500">{cashBox.currency_code}</span>
          </div>
        </div>
        {isAdmin && onEditBalance && (
          <button
            onClick={() => onEditBalance(cashBox)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded-lg transition-colors"
            title={t('cashbox.editOpeningBalance')}
          >
            <PencilSquareIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Balance */}
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-1">{t('cashbox.currentBalance')}</div>
        <div className={`text-3xl font-bold ${colors.text}`}>
          {formatCurrency(Number(cashBox.current_balance), cashBox.currency_code)}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="bg-white/50 rounded-lg p-2">
          <div className="text-gray-500 flex items-center gap-1">
            <ArrowUpIcon className="w-3 h-3 text-green-600" />
            {t('cashbox.totalIn')}
          </div>
          <div className="font-semibold text-green-700">
            {formatCurrency(Number(cashBox.total_in), cashBox.currency_code)}
          </div>
        </div>
        <div className="bg-white/50 rounded-lg p-2">
          <div className="text-gray-500 flex items-center gap-1">
            <ArrowDownIcon className="w-3 h-3 text-red-600" />
            {t('cashbox.totalOut')}
          </div>
          <div className="font-semibold text-red-700">
            {formatCurrency(Number(cashBox.total_out), cashBox.currency_code)}
          </div>
        </div>
      </div>

      {/* Last Transaction */}
      {cashBox.last_transaction_date && (
        <div className="text-xs text-gray-500 mb-4 flex items-center gap-1">
          <ClockIcon className="w-3 h-3" />
          {t('cashbox.lastTransaction')}: {new Date(cashBox.last_transaction_date).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onDeposit(cashBox)}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          <ArrowUpIcon className="w-4 h-4" />
          {t('cashbox.deposit')}
        </button>
        <button
          onClick={() => onWithdraw(cashBox)}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          <ArrowDownIcon className="w-4 h-4" />
          {t('cashbox.withdraw')}
        </button>
      </div>
    </div>
  );
}

