import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanies, useSuppliers, useShippingLines } from '../hooks/useCompanies';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Pagination } from '../components/common/Pagination';
import { SearchInput } from '../components/common/SearchInput';
import { CompanyBankingModal } from '../components/companies/CompanyBankingModal';
import type { Company } from '../types/api';
import clsx from 'clsx';

type TabType = 'all' | 'suppliers' | 'shipping-lines';

export function CompaniesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const allQuery = useCompanies({ page, limit: 20, search });
  const suppliersQuery = useSuppliers({ page, limit: 20 });
  const shippingLinesQuery = useShippingLines({ page, limit: 20 });

  const currentQuery = 
    activeTab === 'suppliers' ? suppliersQuery :
    activeTab === 'shipping-lines' ? shippingLinesQuery :
    allQuery;

  const { data, isLoading, error } = currentQuery;

  const tabs = [
    { id: 'all' as TabType, label: t('companies.allCompanies') },
    { id: 'suppliers' as TabType, label: t('companies.suppliers') },
    { id: 'shipping-lines' as TabType, label: t('companies.shippingLines') },
  ];

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-900">{t('companies.title')}</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={clsx(
                  'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Search (only for "all" tab) */}
        {activeTab === 'all' && (
          <Card>
            <SearchInput
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder={t('companies.search')}
            />
          </Card>
        )}

        {/* Table */}
        <Card>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              {t('common.error')}
            </div>
          ) : !data?.data.length ? (
            <div className="text-center py-12 text-gray-500">
              {t('common.noData')}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('companies.name')}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('companies.country')}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('companies.productTypes', 'Product Types')}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('companies.lastPurchase', 'Last Purchase')}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('companies.phone')}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('companies.actions', 'Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.data.map((company) => (
                      <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {company.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {company.country}
                          {company.city && (
                            <span className="text-gray-500 text-xs block">{company.city}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {company.extra_json?.product_categories && company.extra_json.product_categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {company.extra_json.product_categories.slice(0, 3).map((category, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {category}
                                </span>
                              ))}
                              {company.extra_json.product_categories.length > 3 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  +{company.extra_json.product_categories.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Not specified</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {company.last_product ? (
                            <div>
                              <div className="text-gray-900 font-medium">{company.last_product}</div>
                              {company.last_purchase_date && (
                                <div className="text-gray-500 text-xs">
                                  {new Date(company.last_purchase_date).toLocaleDateString('en-GB')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">No purchases yet</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div>{company.phone || '—'}</div>
                          {company.email && (
                            <div className="text-gray-500 text-xs">{company.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <button
                            onClick={() => setSelectedCompany(company)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                          >
                            <span>🏦</span>
                            <span>{company.extra_json?.banking ? t('companies.viewInfo', 'View Info') : t('companies.addInfo', 'Add Info')}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.pagination && (
                <Pagination
                  currentPage={page}
                  totalPages={data.pagination.totalPages || Math.ceil(data.pagination.total / data.pagination.limit)}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </Card>

        {/* Banking Info Modal */}
        {selectedCompany && (
          <CompanyBankingModal
            company={selectedCompany}
            isOpen={true}
            onClose={() => setSelectedCompany(null)}
          />
        )}
      </div>
  );
}

