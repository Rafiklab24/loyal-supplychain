import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import type { CashBox, RecordTransactionInput } from '../../services/cashbox';
import { formatCurrency } from '../../services/cashbox';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashBox: CashBox | null;
  transactionType: 'in' | 'out';
  onSubmit: (input: RecordTransactionInput) => void;
  isLoading: boolean;
}

export function TransactionModal({
  isOpen,
  onClose,
  cashBox,
  transactionType,
  onSubmit,
  isLoading,
}: TransactionModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [amount, setAmount] = useState('');
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  if (!isOpen || !cashBox) return null;

  const isDeposit = transactionType === 'in';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      cash_box_id: cashBox.id,
      transaction_type: transactionType,
      amount: parseFloat(amount),
      party_name: partyName,
      description: description || undefined,
      transaction_date: transactionDate,
    });
  };

  const handleClose = () => {
    setAmount('');
    setPartyName('');
    setDescription('');
    setTransactionDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  const themeColor = isDeposit ? 'green' : 'red';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b bg-${themeColor}-50`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              {isDeposit ? (
                <ArrowUpIcon className={`w-5 h-5 text-${themeColor}-600`} />
              ) : (
                <ArrowDownIcon className={`w-5 h-5 text-${themeColor}-600`} />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isDeposit ? t('cashbox.deposit') : t('cashbox.withdraw')}
              </h2>
              <p className="text-sm text-gray-500">
                {isRtl ? cashBox.name_ar || cashBox.name : cashBox.name}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Current Balance Display */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">{t('cashbox.currentBalance')}</div>
            <div className="text-xl font-semibold text-gray-900">
              {formatCurrency(Number(cashBox.current_balance), cashBox.currency_code)}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cashbox.amount')} *
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
                required
                className={`w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                placeholder="0.00"
                dir="ltr"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                {cashBox.currency_code}
              </div>
            </div>
          </div>

          {/* Party Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isDeposit ? t('cashbox.receivedFrom') : t('cashbox.paidTo')} *
            </label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={isDeposit ? t('cashbox.receivedFromPlaceholder') : t('cashbox.paidToPlaceholder')}
            />
          </div>

          {/* Transaction Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cashbox.transactionDate')}
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              dir="ltr"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cashbox.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('cashbox.descriptionPlaceholder')}
            />
          </div>

          {/* New Balance Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className={`bg-${themeColor}-50 rounded-lg p-3 border border-${themeColor}-200`}>
              <div className="text-sm text-gray-600">{t('cashbox.newBalance')}</div>
              <div className={`text-xl font-semibold text-${themeColor}-700`}>
                {formatCurrency(
                  isDeposit 
                    ? Number(cashBox.current_balance) + parseFloat(amount)
                    : Number(cashBox.current_balance) - parseFloat(amount),
                  cashBox.currency_code
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !amount || !partyName}
              className={`flex-1 px-4 py-2 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

