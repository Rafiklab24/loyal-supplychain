import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTransportCompanies, useTransportCompanyMutations } from '../../hooks/useLandTransport';
import type { CreateTransportCompanyInput } from '../../types/api';

interface TransportCompanySelectProps {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
}

export const TransportCompanySelect: React.FC<TransportCompanySelectProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const { data: companies, loading, refresh } = useTransportCompanies({ is_active: true });
  const { create, loading: creating } = useTransportCompanyMutations();
  
  const [showAddNew, setShowAddNew] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyContact, setNewCompanyContact] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddNew = async () => {
    if (!newCompanyName.trim()) {
      setError(t('landTransport.companyNameRequired', 'Company name is required'));
      return;
    }

    const input: CreateTransportCompanyInput = {
      name: newCompanyName.trim(),
      phone: newCompanyPhone.trim() || null,
      contact_person: newCompanyContact.trim() || null,
      is_active: true,
    };

    const result = await create(input);
    if (result) {
      onChange(result.id);
      setShowAddNew(false);
      setNewCompanyName('');
      setNewCompanyPhone('');
      setNewCompanyContact('');
      setError(null);
      refresh();
    }
  };

  const handleCancel = () => {
    setShowAddNew(false);
    setNewCompanyName('');
    setNewCompanyPhone('');
    setNewCompanyContact('');
    setError(null);
  };

  if (showAddNew) {
    return (
      <div className="space-y-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {t('landTransport.addTransportCompany', 'Add Transport Company')}
          </span>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        
        <div className="space-y-2">
          <input
            type="text"
            value={newCompanyName}
            onChange={(e) => {
              setNewCompanyName(e.target.value);
              setError(null);
            }}
            placeholder={t('landTransport.companyName', 'Company Name') + ' *'}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
            autoFocus
          />
          <input
            type="text"
            value={newCompanyContact}
            onChange={(e) => setNewCompanyContact(e.target.value)}
            placeholder={t('landTransport.contactPerson', 'Contact Person')}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="tel"
            value={newCompanyPhone}
            onChange={(e) => setNewCompanyPhone(e.target.value)}
            placeholder={t('landTransport.phone', 'Phone')}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={creating}
            className="flex-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleAddNew}
            disabled={creating}
            className="flex-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? '...' : t('common.add', 'Add')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
      >
        <option value="">
          {loading ? t('common.loading', 'Loading...') : t('landTransport.selectCompany', 'Select company...')}
        </option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
            {company.contact_person && ` (${company.contact_person})`}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setShowAddNew(true)}
        className="px-3 py-2 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
        title={t('landTransport.addNew', 'Add New')}
      >
        <PlusIcon className="h-5 w-5" />
      </button>
    </div>
  );
};
