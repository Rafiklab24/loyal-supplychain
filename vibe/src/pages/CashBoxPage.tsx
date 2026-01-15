import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BanknotesIcon, 
  ArrowsRightLeftIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { 
  CashBoxCard, 
  TransactionModal, 
  TransferModal, 
  TransactionHistory,
} from '../components/cashbox';
import { 
  useCashBoxes, 
  useAllTransactions, 
  useRecordTransaction, 
  useTransfer,
} from '../hooks/useCashbox';
import type { CashBox, RecordTransactionInput, TransferInput, TransactionFilters } from '../services/cashbox';
import { formatCurrency } from '../services/cashbox';

export default function CashBoxPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  // State for modals
  const [selectedCashBox, setSelectedCashBox] = useState<CashBox | null>(null);
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in');
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 20,
  });

  // Queries
  const { data: cashBoxes = [], isLoading: isLoadingBoxes, refetch: refetchBoxes } = useCashBoxes();
  const { data: transactionsData, isLoading: isLoadingTransactions } = useAllTransactions(filters);

  // Mutations
  const recordTransactionMutation = useRecordTransaction();
  const transferMutation = useTransfer();

  // Handlers
  const handleDeposit = (cashBox: CashBox) => {
    setSelectedCashBox(cashBox);
    setTransactionType('in');
    setIsTransactionModalOpen(true);
  };

  const handleWithdraw = (cashBox: CashBox) => {
    setSelectedCashBox(cashBox);
    setTransactionType('out');
    setIsTransactionModalOpen(true);
  };

  const handleTransactionSubmit = async (input: RecordTransactionInput) => {
    try {
      await recordTransactionMutation.mutateAsync(input);
      setIsTransactionModalOpen(false);
      setSelectedCashBox(null);
    } catch (error) {
      console.error('Failed to record transaction:', error);
    }
  };

  const handleTransferSubmit = async (input: TransferInput) => {
    try {
      await transferMutation.mutateAsync(input);
      setIsTransferModalOpen(false);
    } catch (error) {
      console.error('Failed to record transfer:', error);
    }
  };

  // Calculate total balance in base currency (USD for display)
  const totalBalanceUSD = cashBoxes
    .filter(b => b.currency_code === 'USD')
    .reduce((sum, b) => sum + Number(b.current_balance), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BanknotesIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('cashbox.title')}</h1>
            <p className="text-gray-500 text-sm">{t('cashbox.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Cash Box Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {isLoadingBoxes ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-64" />
            ))}
          </>
        ) : (
          cashBoxes.map((cashBox) => (
            <CashBoxCard
              key={cashBox.id}
              cashBox={cashBox}
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
            />
          ))
        )}
      </div>

      {/* Transfer Button */}
      <div className="mb-6">
        <button
          onClick={() => setIsTransferModalOpen(true)}
          disabled={cashBoxes.length < 2}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowsRightLeftIcon className="w-5 h-5" />
          {t('cashbox.transferBetweenBoxes')}
        </button>
      </div>

      {/* Transaction History */}
      <TransactionHistory
        transactions={transactionsData?.transactions || []}
        cashBoxes={cashBoxes}
        pagination={transactionsData?.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 }}
        filters={filters}
        onFilterChange={setFilters}
        isLoading={isLoadingTransactions}
      />

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setSelectedCashBox(null);
        }}
        cashBox={selectedCashBox}
        transactionType={transactionType}
        onSubmit={handleTransactionSubmit}
        isLoading={recordTransactionMutation.isPending}
      />

      {/* Transfer Modal */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        cashBoxes={cashBoxes}
        onSubmit={handleTransferSubmit}
        isLoading={transferMutation.isPending}
      />
    </div>
  );
}

