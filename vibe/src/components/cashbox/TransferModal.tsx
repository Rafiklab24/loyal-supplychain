import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import type { CashBox, TransferInput } from '../../services/cashbox';
import { formatCurrency, getCurrencySymbol } from '../../services/cashbox';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashBoxes: CashBox[];
  onSubmit: (input: TransferInput) => void;
  isLoading: boolean;
}

export function TransferModal({
  isOpen,
  onClose,
  cashBoxes,
  onSubmit,
  isLoading,
}: TransferModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [fromBoxId, setFromBoxId] = useState('');
  const [toBoxId, setToBoxId] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const fromBox = useMemo(() => 
    cashBoxes.find(b => b.id === fromBoxId), 
    [cashBoxes, fromBoxId]
  );
  
  const toBox = useMemo(() => 
    cashBoxes.find(b => b.id === toBoxId), 
    [cashBoxes, toBoxId]
  );

  const availableToBoxes = useMemo(() => 
    cashBoxes.filter(b => b.id !== fromBoxId),
    [cashBoxes, fromBoxId]
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      from_cash_box_id: fromBoxId,
      to_cash_box_id: toBoxId,
      from_amount: parseFloat(fromAmount),
      to_amount: parseFloat(toAmount),
      description: description || undefined,
      transaction_date: transactionDate,
    });
  };

  const handleClose = () => {
    setFromBoxId('');
    setToBoxId('');
    setFromAmount('');
    setToAmount('');
    setDescription('');
    setTransactionDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  // When from amount changes, auto-fill to amount if same currency
  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);
    if (fromBox && toBox && fromBox.currency_code === toBox.currency_code) {
      setToAmount(value);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <ArrowsRightLeftIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('cashbox.transferBetweenBoxes')}
              </h2>
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
          {/* From Box */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cashbox.fromBox')} *
            </label>
            <select
              value={fromBoxId}
              onChange={(e) => {
                setFromBoxId(e.target.value);
                setToBoxId(''); // Reset to box when from changes
              }}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">{t('cashbox.selectBox')}</option>
              {cashBoxes.map(box => (
                <option key={box.id} value={box.id}>
                  {isRtl ? box.name_ar || box.name : box.name} 
                  ({formatCurrency(Number(box.current_balance), box.currency_code)})
                </option>
              ))}
            </select>
          </div>

          {/* From Amount */}
          {fromBox && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('cashbox.amountToTransfer')} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => handleFromAmountChange(e.target.value)}
                  min="0.01"
                  step="0.01"
                  required
                  className="w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="0.00"
                  dir="ltr"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                  {fromBox.currency_code}
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {t('cashbox.available')}: {formatCurrency(Number(fromBox.current_balance), fromBox.currency_code)}
              </div>
            </div>
          )}

          {/* Arrow Indicator */}
          {fromBox && (
            <div className="flex justify-center">
              <div className="p-2 bg-indigo-100 rounded-full">
                <ArrowsRightLeftIcon className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          )}

          {/* To Box */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cashbox.toBox')} *
            </label>
            <select
              value={toBoxId}
              onChange={(e) => setToBoxId(e.target.value)}
              required
              disabled={!fromBoxId}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
            >
              <option value="">{t('cashbox.selectBox')}</option>
              {availableToBoxes.map(box => (
                <option key={box.id} value={box.id}>
                  {isRtl ? box.name_ar || box.name : box.name} 
                  ({formatCurrency(Number(box.current_balance), box.currency_code)})
                </option>
              ))}
            </select>
          </div>

          {/* To Amount */}
          {toBox && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('cashbox.amountReceived')} *
                {fromBox && fromBox.currency_code !== toBox.currency_code && (
                  <span className="text-amber-600 text-xs ml-2">
                    ({t('cashbox.differentCurrency')})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  required
                  className="w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0.00"
                  dir="ltr"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                  {toBox.currency_code}
                </div>
              </div>
            </div>
          )}

          {/* Transaction Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cashbox.transactionDate')}
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={t('cashbox.transferDescriptionPlaceholder')}
            />
          </div>

          {/* Summary */}
          {fromBox && toBox && fromAmount && toAmount && (
            <div className="bg-indigo-50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium text-indigo-900">{t('cashbox.transferSummary')}</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{isRtl ? fromBox.name_ar : fromBox.name}:</span>
                <span className="font-semibold text-red-600">
                  -{getCurrencySymbol(fromBox.currency_code)}{fromAmount}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{isRtl ? toBox.name_ar : toBox.name}:</span>
                <span className="font-semibold text-green-600">
                  +{getCurrencySymbol(toBox.currency_code)}{toAmount}
                </span>
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
              disabled={isLoading || !fromBoxId || !toBoxId || !fromAmount || !toAmount}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('common.saving') : t('cashbox.confirmTransfer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

