import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { DateInput } from '../common/DateInput';
import { financeService } from '../../services/finance';
import type { Fund, FinancialParty, ContractSearchResult, ShipmentSearchResult } from '../../types/api';

interface NewTransactionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewTransactionWizard({ isOpen, onClose, onSuccess }: NewTransactionWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0); // Start at step 0 for initial question
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial question state
  const [isRelatedToContract, setIsRelatedToContract] = useState<boolean | null>(null);
  const [isRelatedToShipment, setIsRelatedToShipment] = useState<boolean | null>(null);
  
  // Verification state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    type: 'contract' | 'shipment';
    existingTransactions: any[];
    totalAmount: number;
    recordDetails: any;
  } | null>(null);

  // Autocomplete data
  const [funds, setFunds] = useState<Fund[]>([]);
  const [parties, setParties] = useState<FinancialParty[]>([]);
  const [fundSearch, setFundSearch] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [showFundSuggestions, setShowFundSuggestions] = useState(false);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
  const [topFunds, setTopFunds] = useState<string[]>([]);
  const [topParties, setTopParties] = useState<string[]>([]);
  
  // Contract and Shipment search
  const [contracts, setContracts] = useState<ContractSearchResult[]>([]);
  const [shipments, setShipments] = useState<ShipmentSearchResult[]>([]);
  const [contractSearch, setContractSearch] = useState('');
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [showContractSuggestions, setShowContractSuggestions] = useState(false);
  const [showShipmentSuggestions, setShowShipmentSuggestions] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    amount_usd: undefined as any,
    amount_other: 0,
    currency: 'USD',
    transaction_type: 'bank_transfer',
    direction: 'out' as 'in' | 'out',
    fund_source: '',
    party_name: '',
    description: '',
    contract_id: '',
    shipment_id: '',
  });

  // Fetch funds and parties when wizard opens
  useEffect(() => {
    if (isOpen) {
      fetchFundsAndParties();
      fetchRecentContractsAndShipments();
    }
  }, [isOpen]);

  const fetchFundsAndParties = async () => {
    try {
      const [fundsData, partiesData, topUsedData] = await Promise.all([
        financeService.getFunds(),
        financeService.getParties(),
        financeService.getTopUsed(4),
      ]);
      setFunds(fundsData);
      setParties(partiesData);
      setTopFunds(topUsedData.topFunds);
      setTopParties(topUsedData.topParties);
    } catch (error) {
      console.error('Error fetching funds and parties:', error);
    }
  };

  const fetchRecentContractsAndShipments = async () => {
    try {
      const [contractsData, shipmentsData] = await Promise.all([
        financeService.getRecentContracts(5),
        financeService.getRecentShipments(5),
      ]);
      setContracts(contractsData);
      setShipments(shipmentsData);
    } catch (error) {
      console.error('Error fetching contracts and shipments:', error);
    }
  };

  // Search contracts as user types
  useEffect(() => {
    const searchContracts = async () => {
      if (contractSearch.trim()) {
        try {
          const results = await financeService.searchContracts(contractSearch, 10);
          setContracts(results);
        } catch (error) {
          console.error('Error searching contracts:', error);
        }
      } else {
        // If search is empty, show recent contracts
        fetchRecentContractsAndShipments();
      }
    };

    const debounce = setTimeout(searchContracts, 300);
    return () => clearTimeout(debounce);
  }, [contractSearch]);

  // Search shipments as user types
  useEffect(() => {
    const searchShipments = async () => {
      if (shipmentSearch.trim()) {
        try {
          const results = await financeService.searchShipments(shipmentSearch, 10);
          setShipments(results);
        } catch (error) {
          console.error('Error searching shipments:', error);
        }
      } else {
        // If search is empty, show recent shipments
        fetchRecentContractsAndShipments();
      }
    };

    const debounce = setTimeout(searchShipments, 300);
    return () => clearTimeout(debounce);
  }, [shipmentSearch]);

  const filteredFunds = funds.filter(f =>
    f.fund_name.toLowerCase().includes(fundSearch.toLowerCase())
  );

  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(partySearch.toLowerCase())
  );

  // Verify if contract/shipment has existing transactions
  const verifyExistingTransactions = async (id: string, type: 'contract' | 'shipment') => {
    try {
      // Fetch existing transactions for this contract/shipment
      const response = await financeService.getTransactions({
        [type === 'contract' ? 'contract_id' : 'shipment_id']: id,
        page: 1,
        limit: 100,
      });

      if (response.transactions.length > 0) {
        // Calculate total amount (convert to number in case it's a string)
        const totalAmount = response.transactions.reduce((sum, t) => {
          const amount = Number(t.amount_usd) || 0;
          return sum + (t.direction === 'in' ? amount : -amount);
        }, 0);

        // Get record details
        const recordDetails = type === 'contract' 
          ? contracts.find(c => c.id === id)
          : shipments.find(s => s.id === id);

        setVerificationData({
          type,
          existingTransactions: response.transactions,
          totalAmount,
          recordDetails,
        });
        setShowVerificationModal(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verifying transactions:', error);
      return false;
    }
  };

  // Handle contract selection and auto-populate description + party
  const handleContractSelect = async (contract: ContractSearchResult) => {
    // Determine party (ذمة) based on contract direction and available data
    // The ذمة is the trading counterparty (not the bank beneficiary)
    // For imports (incoming): ذمة = seller (supplier we're paying)
    // For exports (outgoing): ذمة = buyer (customer paying us)
    let partyName = '';
    
    if (contract.direction === 'incoming') {
      // We are buyer, so party (ذمة) is the seller (exporter/supplier)
      partyName = contract.seller_name || '';
    } else if (contract.direction === 'outgoing') {
      // We are seller, so party (ذمة) is the buyer (importer/customer)
      partyName = contract.buyer_name || '';
    } else {
      // Direction not set - default to seller since most transactions are import payments
      // If no seller, try buyer
      partyName = contract.seller_name || contract.buyer_name || '';
    }
    
    console.log('[Finance Wizard] Contract selected:', {
      contract_no: contract.contract_no,
      direction: contract.direction,
      buyer_name: contract.buyer_name,
      seller_name: contract.seller_name,
      resolved_party: partyName
    });
    
    setFormData({ 
      ...formData, 
      contract_id: contract.id,
      description: contract.subject || formData.description, // Auto-populate from contract subject
      party_name: partyName || formData.party_name // Auto-populate party from contract
    });
    setContractSearch(contract.contract_no);
    setShowContractSuggestions(false);
    
    // Also update partySearch to display the auto-populated value on step 2
    if (partyName) {
      setPartySearch(partyName);
    }

    // Verify if this contract has existing transactions
    if (step === 0) {
      await verifyExistingTransactions(contract.id, 'contract');
    }
  };

  // Handle shipment selection and auto-populate description
  const handleShipmentSelect = async (shipment: ShipmentSearchResult) => {
    setFormData({ 
      ...formData, 
      shipment_id: shipment.id,
      description: shipment.subject || shipment.product_text || formData.description // Auto-populate from shipment subject/product
    });
    setShipmentSearch(shipment.sn);
    setShowShipmentSuggestions(false);

    // Verify if this shipment has existing transactions
    if (step === 0) {
      await verifyExistingTransactions(shipment.id, 'shipment');
    }
  };

  // Handle continuing after verification
  const handleContinueAfterVerification = () => {
    setShowVerificationModal(false);
    setStep(1); // Move to main form
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Client-side validation
      if (!formData.transaction_date) {
        setError(t('finance.errors.transactionDateRequired') || 'Transaction date is required');
        setIsSubmitting(false);
        return;
      }
      const amountValue = typeof formData.amount_usd === 'string' ? parseFloat(formData.amount_usd) : formData.amount_usd;
      if (!amountValue || amountValue <= 0 || isNaN(amountValue)) {
        setError(t('finance.errors.amountRequired') || 'Amount (USD) must be greater than 0');
        setIsSubmitting(false);
        return;
      }
      if (!formData.fund_source || formData.fund_source.trim() === '') {
        setError(t('finance.errors.fundRequired') || 'Fund/Account is required');
        setIsSubmitting(false);
        return;
      }
      if (!formData.party_name || formData.party_name.trim() === '') {
        setError(t('finance.errors.partyRequired') || 'Party name is required');
        setIsSubmitting(false);
        return;
      }
      if (!formData.description || formData.description.trim() === '') {
        setError(t('finance.errors.descriptionRequired') || 'Description is required');
        setIsSubmitting(false);
        return;
      }

      await financeService.createTransaction({
        ...formData,
        amount_usd: typeof formData.amount_usd === 'string' ? parseFloat(formData.amount_usd) : formData.amount_usd,
        amount_other: formData.amount_other || undefined,
        contract_id: formData.contract_id || undefined,
        shipment_id: formData.shipment_id || undefined,
      });

      onSuccess();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || t('finance.messages.createError');
      const errorDetails = err.response?.data?.details;
      
      if (errorDetails) {
        const missingFields = Object.entries(errorDetails)
          .filter(([_, status]) => status === 'required')
          .map(([field, _]) => field)
          .join(', ');
        setError(`${errorMessage}. Missing: ${missingFields}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-5">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-2xl font-bold text-white">
                      {t('finance.newTransaction')}
                    </Dialog.Title>
                    <button onClick={onClose} className="text-white hover:text-blue-100">
                      <XMarkIcon className="h-7 w-7" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {[0, 1, 2].map((s) => (
                      <div
                        key={s}
                        className={`flex-1 h-2 rounded-full ${
                          s <= step ? 'bg-white' : 'bg-blue-400'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="px-8 py-6 max-h-[70vh] overflow-y-auto">
                  {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  {/* Step 0: Initial Question */}
                  {step === 0 && (
                    <div className="space-y-6">
                      <h3 className="text-2xl font-semibold text-gray-900 text-center mb-6">
                        {t('finance.wizard.initialQuestion')}
                      </h3>

                      {/* Contract Question */}
                      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">
                          {t('finance.wizard.relatedToContract')}
                        </h4>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              setIsRelatedToContract(true);
                              setIsRelatedToShipment(false);
                            }}
                            className={`flex-1 px-6 py-4 text-lg font-medium rounded-lg border-2 transition-all ${
                              isRelatedToContract === true
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                            }`}
                          >
                            {t('common.yes')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsRelatedToContract(false)}
                            className={`flex-1 px-6 py-4 text-lg font-medium rounded-lg border-2 transition-all ${
                              isRelatedToContract === false && isRelatedToShipment === null
                                ? 'bg-gray-600 text-white border-gray-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {t('common.no')}
                          </button>
                        </div>

                        {/* Contract Search - Show if YES */}
                        {isRelatedToContract === true && (
                          <div className="mt-4 relative">
                            <label className="block text-base font-medium text-gray-700 mb-2">
                              {t('finance.wizard.enterContractNumber')}
                            </label>
                            <input
                              type="text"
                              value={contractSearch}
                              onChange={(e) => setContractSearch(e.target.value)}
                              onFocus={() => setShowContractSuggestions(true)}
                              onBlur={() => setTimeout(() => setShowContractSuggestions(false), 200)}
                              placeholder={t('finance.wizard.contractPlaceholder')}
                              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                            />
                            {showContractSuggestions && contracts.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                {contracts.map((contract) => (
                                  <div
                                    key={contract.id}
                                    onMouseDown={() => handleContractSelect(contract)}
                                    className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-900">{contract.contract_no}</div>
                                    {contract.subject && (
                                      <div className="text-sm text-gray-600">{contract.subject}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Shipment Question - Only show if NOT related to contract */}
                      {isRelatedToContract === false && (
                        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6">
                          <h4 className="text-lg font-medium text-gray-900 mb-4">
                            {t('finance.wizard.relatedToShipment')}
                          </h4>
                          <div className="flex gap-4">
                            <button
                              type="button"
                              onClick={() => setIsRelatedToShipment(true)}
                              className={`flex-1 px-6 py-4 text-lg font-medium rounded-lg border-2 transition-all ${
                                isRelatedToShipment === true
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                              }`}
                            >
                              {t('common.yes')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsRelatedToShipment(false)}
                              className={`flex-1 px-6 py-4 text-lg font-medium rounded-lg border-2 transition-all ${
                                isRelatedToShipment === false
                                  ? 'bg-gray-600 text-white border-gray-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {t('common.no')}
                            </button>
                          </div>

                          {/* Shipment Search - Show if YES */}
                          {isRelatedToShipment === true && (
                            <div className="mt-4 relative">
                              <label className="block text-base font-medium text-gray-700 mb-2">
                                {t('finance.wizard.enterShipmentNumber')}
                              </label>
                              <input
                                type="text"
                                value={shipmentSearch}
                                onChange={(e) => setShipmentSearch(e.target.value)}
                                onFocus={() => setShowShipmentSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowShipmentSuggestions(false), 200)}
                                placeholder={t('finance.wizard.shipmentPlaceholder')}
                                className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                              />
                              {showShipmentSuggestions && shipments.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                  {shipments.map((shipment) => (
                                    <div
                                      key={shipment.id}
                                      onMouseDown={() => handleShipmentSelect(shipment)}
                                      className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="font-medium text-gray-900">{shipment.sn}</div>
                                      {(shipment.subject || shipment.product_text) && (
                                        <div className="text-sm text-gray-600">{shipment.subject || shipment.product_text}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Continue Button */}
                      {((isRelatedToContract === false && isRelatedToShipment === false) || 
                        (isRelatedToContract === true && formData.contract_id) ||
                        (isRelatedToShipment === true && formData.shipment_id)) && (
                        <div className="flex justify-center mt-6">
                          <Button
                            onClick={() => setStep(1)}
                            variant="primary"
                            className="px-8 py-3 text-lg"
                          >
                            {t('common.continue')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 1: Basic Information */}
                  {step === 1 && (
                    <div className="space-y-5">
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('finance.wizard.step1')}</h3>
                      
                      {/* Optional Links Section - MOVED TO TOP */}
                      <div className="border-b pb-4 mb-6">
                        <h4 className="text-base font-medium text-gray-700 mb-3">{t('finance.wizard.optionalLinks')}</h4>
                        <p className="text-sm text-gray-500 mb-4">{t('finance.wizard.optionalLinksDesc')}</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Contract Search */}
                          <div className="relative">
                            <label className="block text-base font-medium text-gray-700 mb-2">
                              {t('finance.linkedContract')} <span className="text-gray-500 text-sm">({t('finance.wizard.optionalField')})</span>
                            </label>
                            <input
                              type="text"
                              value={contractSearch}
                              onChange={(e) => setContractSearch(e.target.value)}
                              onFocus={() => setShowContractSuggestions(true)}
                              onBlur={() => setTimeout(() => setShowContractSuggestions(false), 200)}
                              placeholder={t('finance.wizard.contractPlaceholder')}
                              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                            {showContractSuggestions && contracts.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                {contracts.map((contract) => (
                                  <div
                                    key={contract.id}
                                    onMouseDown={() => handleContractSelect(contract)}
                                    className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-900">{contract.contract_no}</div>
                                    {contract.subject && (
                                      <div className="text-sm text-gray-600">{contract.subject}</div>
                                    )}
                                    {(contract.buyer_name || contract.seller_name) && (
                                      <div className="text-xs text-gray-500">
                                        {contract.buyer_name && contract.seller_name 
                                          ? `${contract.buyer_name} ↔ ${contract.seller_name}`
                                          : contract.buyer_name || contract.seller_name
                                        }
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">{t('finance.wizard.contractHint')}</p>
                          </div>

                          {/* Shipment Search */}
                          <div className="relative">
                            <label className="block text-base font-medium text-gray-700 mb-2">
                              {t('finance.linkedShipment')} <span className="text-gray-500 text-sm">({t('finance.wizard.optionalField')})</span>
                            </label>
                            <input
                              type="text"
                              value={shipmentSearch}
                              onChange={(e) => setShipmentSearch(e.target.value)}
                              onFocus={() => setShowShipmentSuggestions(true)}
                              onBlur={() => setTimeout(() => setShowShipmentSuggestions(false), 200)}
                              placeholder={t('finance.wizard.shipmentPlaceholder')}
                              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                            {showShipmentSuggestions && shipments.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                {shipments.map((shipment) => (
                                  <div
                                    key={shipment.id}
                                    onMouseDown={() => handleShipmentSelect(shipment)}
                                    className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-900">{shipment.sn}</div>
                                    {(shipment.subject || shipment.product_text) && (
                                      <div className="text-sm text-gray-600">{shipment.subject || shipment.product_text}</div>
                                    )}
                                    {(shipment.origin_port || shipment.destination_port) && (
                                      <div className="text-xs text-gray-500">
                                        {shipment.origin_port} → {shipment.destination_port}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">{t('finance.wizard.shipmentHint')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Description Field - MOVED TO TOP */}
                      <div className="border-b pb-4 mb-6">
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('common.description')} *
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={4}
                          placeholder={t('finance.wizard.descriptionPlaceholder')}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {t('finance.wizard.descriptionAutoFill')}
                        </p>
                      </div>

                      <div>
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('finance.transactionDate')} *
                        </label>
                        <DateInput
                          value={formData.transaction_date}
                          onChange={(val) => setFormData({ ...formData, transaction_date: val })}
                          className="w-full border-gray-300"
                        />
                      </div>

                      <div>
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('finance.amountUSD')} *
                        </label>
                        <input
                          type="number"
                          value={formData.amount_usd}
                          onChange={(e) => setFormData({ ...formData, amount_usd: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('finance.amountOther')}
                        </label>
                        <input
                          type="number"
                          value={formData.amount_other || ''}
                          onChange={(e) => setFormData({ ...formData, amount_other: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                          placeholder={t('finance.wizard.optionalField')}
                        />
                      </div>

                      <div>
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('finance.currency')}
                        </label>
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="USD">USD - US Dollar</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="TRY">TRY - Turkish Lira</option>
                          <option value="SAR">SAR - Saudi Riyal</option>
                          <option value="AED">AED - UAE Dirham</option>
                          <option value="EGP">EGP - Egyptian Pound</option>
                          <option value="SYP">SYP - Syrian Pound</option>
                          <option value="IQD">IQD - Iraqi Dinar</option>
                          <option value="JOD">JOD - Jordanian Dinar</option>
                          <option value="LBP">LBP - Lebanese Pound</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('finance.transactionType')} *
                        </label>
                        <select
                          value={formData.transaction_type}
                          onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="bank_transfer">{t('finance.transactionTypes.bank_transfer')}</option>
                          <option value="exchange">{t('finance.transactionTypes.exchange')}</option>
                          <option value="cash">{t('finance.transactionTypes.cash')}</option>
                          <option value="check">{t('finance.transactionTypes.check')}</option>
                          <option value="discount">{t('finance.transactionTypes.discount')}</option>
                          <option value="other">{t('finance.transactionTypes.other')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('finance.direction')} *
                        </label>
                        <select
                          value={formData.direction}
                          onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'in' | 'out' })}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="in">{t('finance.income')}</option>
                          <option value="out">{t('finance.expense')}</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Parties & Accounts */}
                  {step === 2 && (
                    <div className="space-y-5">
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('finance.wizard.step2')}</h3>
                      
                      <div className="relative">
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('finance.fundAccount')} *
                        </label>
                        <input
                          type="text"
                          value={fundSearch || formData.fund_source}
                          onChange={(e) => {
                            setFundSearch(e.target.value);
                            setFormData({ ...formData, fund_source: e.target.value });
                            setShowFundSuggestions(true);
                          }}
                          onFocus={() => setShowFundSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowFundSuggestions(false), 200)}
                          placeholder={t('finance.wizard.selectOrEnterFund')}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        {showFundSuggestions && fundSearch && filteredFunds.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredFunds.slice(0, 10).map((f) => (
                              <div
                                key={f.id}
                                onClick={() => {
                                  setFormData({ ...formData, fund_source: f.fund_name });
                                  setFundSearch(f.fund_name);
                                  setShowFundSuggestions(false);
                                }}
                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{f.fund_name}</div>
                                <div className="text-xs text-gray-500">{f.fund_type} • {f.currency_code}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Quick Select - Top Used Funds */}
                        {topFunds.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm text-gray-600 mb-2">{t('finance.wizard.mostUsed') || 'Most Used'}:</p>
                            <div className="flex flex-wrap gap-2">
                              {topFunds.map((fund, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, fund_source: fund });
                                    setFundSearch(fund);
                                  }}
                                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm rounded-lg border border-blue-200 transition-colors"
                                >
                                  {fund}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('finance.party')} *
                        </label>
                        <input
                          type="text"
                          value={partySearch || formData.party_name}
                          onChange={(e) => {
                            setPartySearch(e.target.value);
                            setFormData({ ...formData, party_name: e.target.value });
                            setShowPartySuggestions(true);
                          }}
                          onFocus={() => setShowPartySuggestions(true)}
                          onBlur={() => setTimeout(() => setShowPartySuggestions(false), 200)}
                          placeholder={t('finance.wizard.selectOrEnterParty')}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        {showPartySuggestions && partySearch && filteredParties.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredParties.slice(0, 10).map((p) => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setFormData({ ...formData, party_name: p.name });
                                  setPartySearch(p.name);
                                  setShowPartySuggestions(false);
                                }}
                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{p.name}</div>
                                {p.type && <div className="text-xs text-gray-500">{p.type}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Quick Select - Top Used Parties */}
                        {topParties.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm text-gray-600 mb-2">{t('finance.wizard.mostUsed') || 'Most Used'}:</p>
                            <div className="flex flex-wrap gap-2">
                              {topParties.map((party, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, party_name: party });
                                    setPartySearch(party);
                                  }}
                                  className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-sm rounded-lg border border-green-200 transition-colors"
                                >
                                  {party}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-5 flex items-center justify-between">
                  <Button
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    variant="secondary"
                    disabled={step === 0 || isSubmitting}
                  >
                    {t('common.previous')}
                  </Button>
                  <div className="flex gap-3">
                    <Button onClick={onClose} variant="secondary" disabled={isSubmitting}>
                      {t('common.cancel')}
                    </Button>
                    {step < 2 ? (
                      <Button 
                        onClick={() => setStep(s => s + 1)} 
                        variant="primary" 
                        disabled={
                          step === 0 || 
                          (step === 1 && (
                            !formData.transaction_date || 
                            !formData.amount_usd || 
                            (typeof formData.amount_usd === 'number' && formData.amount_usd <= 0) ||
                            (typeof formData.amount_usd === 'string' && (parseFloat(formData.amount_usd) <= 0 || isNaN(parseFloat(formData.amount_usd)))) ||
                            !formData.description.trim()
                          ))
                        }
                      >
                        {t('common.next')}
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleSubmit} 
                        variant="primary" 
                        isLoading={isSubmitting}
                        disabled={!formData.fund_source.trim() || !formData.party_name.trim()}
                      >
                        {t('common.submit')}
                      </Button>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>

        {/* Verification Modal */}
        {showVerificationModal && verificationData && (
          <Dialog open={showVerificationModal} onClose={() => setShowVerificationModal(false)} className="relative z-50">
            <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
                <div className="bg-yellow-600 px-6 py-4">
                  <Dialog.Title className="text-xl font-bold text-white flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {t('finance.wizard.verificationWarning')}
                  </Dialog.Title>
                </div>

                <div className="px-6 py-4 max-h-96 overflow-y-auto">
                  <p className="text-base text-gray-700 mb-4">
                    {t('finance.wizard.existingTransactionsFound')} ({verificationData.existingTransactions.length})
                  </p>

                  {/* Record Details */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {verificationData.type === 'contract' ? t('finance.contractDetails') : t('finance.shipmentDetails')}
                    </h4>
                    {verificationData.type === 'contract' ? (
                      <div className="text-sm text-gray-700">
                        <p><strong>{t('finance.contractNumber')}:</strong> {verificationData.recordDetails?.contract_no}</p>
                        {verificationData.recordDetails?.subject && (
                          <p><strong>{t('common.description')}:</strong> {verificationData.recordDetails.subject}</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700">
                        <p><strong>{t('finance.shipmentNumber')}:</strong> {verificationData.recordDetails?.sn}</p>
                        {(verificationData.recordDetails?.subject || verificationData.recordDetails?.product_text) && (
                          <p><strong>{t('common.description')}:</strong> {verificationData.recordDetails.subject || verificationData.recordDetails.product_text}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Existing Transactions */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {t('finance.wizard.existingTransactions')} ({verificationData.existingTransactions.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {verificationData.existingTransactions.map((transaction: any) => (
                        <div key={transaction.id} className="bg-white border border-gray-200 rounded p-3 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{transaction.description}</p>
                              <p className="text-xs text-gray-500">{transaction.transaction_date}</p>
                            </div>
                            <div className={`font-semibold ${transaction.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                              {transaction.direction === 'in' ? '+' : '-'}${Number(transaction.amount_usd).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Amount */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">{t('finance.wizard.totalAmount')}:</span>
                      <span className={`text-xl font-bold ${verificationData.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Math.abs(verificationData.totalAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mt-4">
                    {t('finance.wizard.doubleCheckMessage')}
                  </p>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                  <Button onClick={() => setShowVerificationModal(false)} variant="secondary">
                    {t('common.goBack')}
                  </Button>
                  <Button onClick={handleContinueAfterVerification} variant="primary">
                    {t('common.continue')}
                  </Button>
                </div>
              </Dialog.Panel>
            </div>
          </Dialog>
        )}
      </Dialog>
    </Transition>
  );
}

