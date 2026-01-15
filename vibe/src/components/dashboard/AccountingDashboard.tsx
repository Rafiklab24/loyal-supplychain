import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  BanknotesIcon, 
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentCheckIcon,
  ArrowRightIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../common/Card';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { formatCurrency, formatDateString } from '../../utils/format';
import { apiClient } from '../../services/api';

interface AccountingStats {
  total_paid: number;
  total_pending: number;
  this_month_payments: number;
  pending_clearance_costs: number;
}

interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  currency_code: string;
  party_name: string;
  transaction_date: string;
  status: string;
}

export function AccountingDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  // Fetch accounting-specific stats
  const { data: stats, isLoading: statsLoading } = useQuery<AccountingStats>({
    queryKey: ['accounting-dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/accounting-stats');
      return response.data;
    },
  });

  // Fetch recent transactions
  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery<RecentTransaction[]>({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const response = await apiClient.get('/finance/transactions', {
        params: {
          limit: 5,
          sortBy: 'transaction_date',
          sortOrder: 'desc',
        },
      });
      return response.data.transactions || [];
    },
  });

  const statCards = [
    {
      title: t('dashboard.totalPaid', 'Total Paid'),
      value: stats?.total_paid ?? 0,
      icon: <ArrowTrendingUpIcon className="h-6 w-6" />,
      color: 'bg-green-500',
      onClick: () => navigate('/finance?type=payment'),
    },
    {
      title: t('dashboard.pendingPayments', 'Pending Payments'),
      value: stats?.total_pending ?? 0,
      icon: <ArrowTrendingDownIcon className="h-6 w-6" />,
      color: 'bg-amber-500',
      onClick: () => navigate('/finance?status=pending'),
    },
    {
      title: t('dashboard.thisMonthPayments', 'This Month'),
      value: stats?.this_month_payments ?? 0,
      icon: <BanknotesIcon className="h-6 w-6" />,
      color: 'bg-blue-500',
      onClick: () => navigate('/accounting'),
    },
    {
      title: t('dashboard.pendingClearanceCosts', 'Pending CC Costs'),
      value: stats?.pending_clearance_costs ?? 0,
      icon: <DocumentCheckIcon className="h-6 w-6" />,
      color: 'bg-purple-500',
      onClick: () => navigate('/customs-clearing-costs'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-100 rounded-lg">
          <BanknotesIcon className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.accountingTitle', 'Finance Dashboard')}</h1>
          <p className="text-gray-500">{t('dashboard.accountingSubtitle', 'Track payments and transactions')}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl shadow p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))
        ) : (
          statCards.map((card, idx) => (
            <button
              key={idx}
              onClick={card.onClick}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-start hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${card.color} text-white`}>
                  {card.icon}
                </div>
                <ArrowRightIcon className={`h-5 w-5 text-gray-400 ${isRtl ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-sm text-gray-500 mb-1">{card.title}</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(card.value)}</p>
            </button>
          ))
        )}
      </div>

      {/* Recent Transactions */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5 text-green-500" />
              {t('dashboard.recentTransactions', 'Recent Transactions')}
            </span>
            <button
              onClick={() => navigate('/finance')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('common.viewAll', 'View All')}
              <ArrowRightIcon className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>
        }
      >
        {transactionsLoading ? (
          <LoadingSkeleton lines={5} />
        ) : recentTransactions && recentTransactions.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => navigate(`/finance/${tx.id}`)}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-4 px-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tx.type === 'payment' ? 'bg-red-50' : 'bg-green-50'}`}>
                    {tx.type === 'payment' ? (
                      <ArrowTrendingDownIcon className="h-5 w-5 text-red-600" />
                    ) : (
                      <ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{tx.party_name || '—'}</p>
                    <p className="text-sm text-gray-500">{tx.type}</p>
                  </div>
                </div>
                <div className="text-end">
                  <p className={`text-sm font-bold ${tx.type === 'payment' ? 'text-red-600' : 'text-green-600'}`}>
                    {tx.type === 'payment' ? '-' : '+'}{formatCurrency(tx.amount)} {tx.currency_code}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateString(tx.transaction_date)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BanknotesIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">{t('dashboard.noRecentTransactions', 'No recent transactions')}</p>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/finance')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="p-2 bg-green-100 rounded-lg">
            <BanknotesIcon className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900">{t('nav.finance', 'Finance')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.manageTransactions', 'Manage transactions')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/customs-clearing-costs')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="p-2 bg-purple-100 rounded-lg">
            <DocumentCheckIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900">{t('nav.customsClearance', 'Customs Costs')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.viewClearanceCosts', 'View clearance costs')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/accounting')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <ArrowTrendingUpIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900">{t('nav.accounting', 'Accounting')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.viewReports', 'View reports')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

