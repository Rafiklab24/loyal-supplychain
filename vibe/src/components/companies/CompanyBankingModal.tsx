import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { Company, CompanyBankingInfo } from '../../types/api';
import { BankingInfoForm } from './BankingInfoForm';
import { companiesService } from '../../services/companies';
import { useQueryClient } from '@tanstack/react-query';

interface CompanyBankingModalProps {
  company: Company;
  isOpen: boolean;
  onClose: () => void;
}

export function CompanyBankingModal({ company, isOpen, onClose }: CompanyBankingModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const handleSaveBankingInfo = async (bankingInfo: CompanyBankingInfo, productCategories?: string[]) => {
    try {
      await companiesService.updateBankingInfo(company.id, bankingInfo, productCategories);
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', company.id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-lines'] });
      
      // Keep modal open after save so user can see success message
    } catch (error) {
      console.error('Failed to save company info:', error);
      throw error;
    }
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {company.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {company.country}
                        {company.city && ` • ${company.city}`}
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                  <BankingInfoForm 
                    company={company} 
                    onSave={handleSaveBankingInfo}
                  />
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex justify-end">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {t('common.close', 'Close')}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

