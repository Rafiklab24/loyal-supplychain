/**
 * Contract Detail Page
 * Displays full contract details organized by wizard steps
 * Allows inline editing of all fields (like ShipmentDetailPage)
 */

import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, Transition, Menu } from '@headlessui/react';
import {
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  PencilSquareIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
  BanknotesIcon,
  CubeIcon,
  BuildingLibraryIcon,
  PlusIcon,
  TruckIcon,
  LinkIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useContract } from '../hooks/useContracts';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Spinner } from '../components/common/Spinner';
import { NewShipmentWizard } from '../components/shipments/NewShipmentWizard';
import { AuditLogViewer } from '../components/audit/AuditLogViewer';
import { DocumentPanel } from '../components/documents';
import { TransactionsPanel } from '../components/finance';
import { apiClient } from '../services/api';
import contractsService from '../services/contracts';
import { TranslatedProductText } from '../components/common/TranslatedProductText';

export function ContractDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contract, isLoading, error } = useContract(id || '');

  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [showEditWizardDialog, setShowEditWizardDialog] = useState(false);
  const [showNewShipmentWizard, setShowNewShipmentWizard] = useState(false);
  const [showLinkShipmentDialog, setShowLinkShipmentDialog] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [, setLoadingRequests] = useState(false);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [traceability, setTraceability] = useState<any>(null);
  const [showTraceability, setShowTraceability] = useState(false);
  const [loadingTraceability, setLoadingTraceability] = useState(false);

  // Fetch traceability data
  const fetchTraceability = async () => {
    if (!id || loadingTraceability) return;
    setLoadingTraceability(true);
    try {
      const response = await apiClient.get(`/contracts/${id}/traceability`);
      setTraceability(response.data);
    } catch (error) {
      console.error('Error fetching traceability:', error);
    } finally {
      setLoadingTraceability(false);
    }
  };

  // Fetch pending update requests
  useEffect(() => {
    if (id) {
      fetchPendingRequests();
    }
  }, [id]);

  const fetchPendingRequests = async () => {
    if (!id) return;
    try {
      setLoadingRequests(true);
      const response = await apiClient.get('/contracts/update-requests/pending');
      const contractRequests = response.data.requests.filter((req: any) => req.contract_id === id);
      setPendingRequests(contractRequests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await contractsService.approveContractUpdate(requestId);
      alert(t('contracts.sync.updateApproved', 'Contract update approved successfully'));
      fetchPendingRequests();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const reason = prompt(t('contracts.sync.enterRejectionReason', 'Enter rejection reason:'));
    if (!reason) return;
    
    try {
      await contractsService.rejectContractUpdate(requestId, reason);
      alert(t('contracts.sync.updateRejected', 'Contract update rejected'));
      fetchPendingRequests();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reject request');
    }
  };

  // Search for shipments to link
  const handleShipmentSearch = async (query: string) => {
    setShipmentSearch(query);
    
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await apiClient.get(`/finance/shipments/search?q=${encodeURIComponent(query)}&limit=20`);
      setSearchResults(response.data || []);
    } catch (error) {
      console.error('Error searching shipments:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Link existing shipment to this contract
  const handleLinkShipment = async (shipmentId: string) => {
    if (!id) return;

    try {
      setIsLinking(true);
      
      // First, fetch the current shipment data
      const shipmentResponse = await apiClient.get(`/shipments/${shipmentId}`);
      const currentShipment = shipmentResponse.data;
      
      // Update only the contract_id field
      await apiClient.put(`/shipments/${shipmentId}`, {
        ...currentShipment,
        contract_id: id
      });
      
      alert(t('contracts.shipmentLinkedSuccess', 'Shipment linked successfully'));
      setShowLinkShipmentDialog(false);
      setShipmentSearch('');
      setSearchResults([]);
      
      // Refresh the page to show the linked shipment
      window.location.reload();
    } catch (error: any) {
      console.error('Error linking shipment:', error);
      alert(error.response?.data?.message || t('contracts.shipmentLinkError', 'Failed to link shipment'));
    } finally {
      setIsLinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600 mb-4">{t('common.error', 'Error loading contract')}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t('common.back', 'Back to Contracts')}
        </button>
      </div>
    );
  }

  const handleInlineEditStart = () => {
    setIsInlineEditing(true);
    setEditedData({
      contract_no: contract.contract_no,
      status: contract.status,
      notes: contract.notes || extraData.extra_info || '',
      // Terms
      incoterm: terms.incoterm || '',
      delivery_terms_detail: terms.delivery_terms_detail || '',
      payment_terms: terms.payment_terms || '',
      payment_method: terms.payment_method || '',
      // Shipping
      country_of_origin: shipping.country_of_origin || '',
      country_of_final_destination: shipping.country_of_final_destination || '',
      port_of_loading_name: shipping.port_of_loading_name || '',
      final_destination_name: shipping.final_destination_name || '',
      // Banking
      beneficiary_name: bankingDocs.beneficiary_name || '',
      beneficiary_account_no: bankingDocs.beneficiary_account_no || '',
      beneficiary_address: bankingDocs.beneficiary_address || '',
      beneficiary_bank_name: bankingDocs.beneficiary_bank_name || '',
      beneficiary_bank_address: bankingDocs.beneficiary_bank_address || '',
      beneficiary_swift_code: bankingDocs.beneficiary_swift_code || '',
      // Commercial Parties (read-only in quick edit, changeable in wizard)
      seller_name: contract.seller_name || '',
      buyer_name: contract.buyer_name || '',
    });
  };

  const handleInlineEditCancel = () => {
    setIsInlineEditing(false);
    setEditedData({});
  };

  const handleInlineEditSave = async () => {
    try {
      // Prepare the update payload
      const payload: any = {
        contract_no: editedData.contract_no,
        status: editedData.status,
        notes: editedData.notes,
      };

      // Update extra_json with all edited fields
      if (contract.extra_json) {
        payload.extra_json = {
          ...contract.extra_json,
          terms: {
            ...terms,
            incoterm: editedData.incoterm,
            delivery_terms_detail: editedData.delivery_terms_detail,
            payment_terms: editedData.payment_terms,
            payment_method: editedData.payment_method,
          },
          shipping: {
            ...shipping,
            country_of_origin: editedData.country_of_origin,
            country_of_final_destination: editedData.country_of_final_destination,
            port_of_loading_name: editedData.port_of_loading_name,
            final_destination_name: editedData.final_destination_name,
          },
          banking_docs: {
            ...bankingDocs,
            beneficiary_name: editedData.beneficiary_name,
            beneficiary_account_no: editedData.beneficiary_account_no,
            beneficiary_address: editedData.beneficiary_address,
            beneficiary_bank_name: editedData.beneficiary_bank_name,
            beneficiary_bank_address: editedData.beneficiary_bank_address,
            beneficiary_swift_code: editedData.beneficiary_swift_code,
          },
        };
      }

      // Call API to update contract
      await apiClient.put(`/contracts/${contract.id}`, payload);
      
      // Refresh the contract data
      window.location.reload();
    } catch (error: any) {
      console.error('Error updating contract:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to update contract';
      alert(errorMsg);
    }
  };

  const handleOpenEditWizard = () => {
    setShowEditWizardDialog(true);
  };

  const handleConfirmEditWizard = () => {
    setShowEditWizardDialog(false);
    navigate(`/contracts/${id}/edit`);
  };

  // Parse contract data - NORMALIZED: API now returns nested objects at top level
  // Fall back to extra_json for backward compatibility with old data
  // Type assertion needed as these normalized properties may come from API but aren't in base type
  const contractAny = contract as any;
  const extraData = contract.extra_json || {};
  const commercialParties = contractAny.commercial_parties || extraData.commercial_parties || {};
  const shipping = contractAny.shipping || extraData.shipping || {};
  const terms = contractAny.terms || extraData.terms || {};
  const lines = contract.lines || extraData.lines || [];
  const bankingDocs = contractAny.banking_docs || extraData.banking_docs || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          {t('common.back', 'Back to Contracts')}
        </button>

        <div className="flex items-center justify-between">
          <div>
            {isInlineEditing ? (
              <input
                type="text"
                value={editedData.contract_no}
                onChange={(e) => setEditedData({ ...editedData, contract_no: e.target.value })}
                className="text-3xl font-bold text-gray-900 mb-2 px-3 py-1 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            ) : (
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {contract.contract_no}
              </h1>
            )}
            <div className="flex items-center gap-4">
              {isInlineEditing ? (
                <select
                  value={editedData.status}
                  onChange={(e) => setEditedData({ ...editedData, status: e.target.value })}
                  className="px-3 py-1 border-2 border-blue-500 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="FULFILLED">FULFILLED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              ) : (
                <Badge
                  color={
                    contract.status === 'ACTIVE' ? 'green' :
                    contract.status === 'DRAFT' ? 'gray' :
                    contract.status === 'FULFILLED' ? 'emerald' :
                    contract.status === 'COMPLETED' ? 'blue' : 'red'
                  }
                >
                  {t(`contracts.status${contract.status}`, contract.status)}
                </Badge>
              )}
              <span className="text-sm text-gray-500">
                {t('common.created', 'Created')}: {new Date(contract.created_at).toLocaleDateString('en-GB')}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            {!isInlineEditing ? (
              <>
                <Menu as="div" className="relative inline-block text-left">
                  <Menu.Button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <TruckIcon className="h-5 w-5" />
                    {t('contracts.manageShipments', 'Manage Shipments')}
                    <ChevronDownIcon className="h-4 w-4" />
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute left-0 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                      <div className="py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => setShowNewShipmentWizard(true)}
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } group flex w-full items-center px-4 py-2 text-sm text-gray-700`}
                            >
                              <PlusIcon className="mr-3 h-5 w-5 text-green-600" />
                              {t('contracts.createNewShipment', 'Create New Shipment')}
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => setShowLinkShipmentDialog(true)}
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } group flex w-full items-center px-4 py-2 text-sm text-gray-700`}
                            >
                              <LinkIcon className="mr-3 h-5 w-5 text-blue-600" />
                              {t('contracts.linkExistingShipment', 'Link Existing Shipment')}
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </Menu.Items>
                  </Transition>
                </Menu>
                <button
                  onClick={() => setShowAuditLog(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {t('contracts.viewChangeHistory', 'View Change History')}
                </button>
                <button
                  onClick={handleInlineEditStart}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                  {t('common.quickEdit', 'Quick Edit')}
                </button>
                <button
                  onClick={handleOpenEditWizard}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <PencilIcon className="h-5 w-5" />
                  {t('common.editWithWizard', 'Edit with Wizard')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleInlineEditSave}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckIcon className="h-5 w-5" />
                  {t('common.save', 'Save Changes')}
                </button>
                <button
                  onClick={handleInlineEditCancel}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <XMarkIcon className="h-5 w-5" />
                  {t('common.cancel', 'Cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1: Commercial Parties */}
        <Card>
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
              {t('contracts.step1TitleV2', 'Commercial Parties')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.transactionType', 'Transaction Type')}
              </dt>
              <dd className="text-base font-semibold">
                <Badge color={contract.direction === 'incoming' ? 'blue' : 'green'}>
                  {contract.direction === 'incoming' 
                    ? t('shipments.wizard.directionIncoming', 'Purchase (Buyer)')
                    : t('shipments.wizard.directionOutgoing', 'Sale (Seller)')
                  }
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.proformaNumber', 'Proforma Invoice Number')}
              </dt>
              <dd className="text-base font-semibold text-gray-900">
                {commercialParties.proforma_number || contract.contract_no}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.exporter', 'Exporter / Seller')}
              </dt>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={editedData.seller_name}
                  onChange={(e) => setEditedData({ ...editedData, seller_name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Seller/Exporter company name"
                  disabled
                  title="Use 'Edit with Wizard' to change companies"
                />
              ) : (
                <dd className="text-base text-gray-900">{contract.seller_name || '—'}</dd>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {isInlineEditing && t('contracts.useWizardToChangeCompany', 'Note: Use "Edit with Wizard" to change companies')}
              </p>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.buyer', 'Buyer')}
              </dt>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={editedData.buyer_name}
                  onChange={(e) => setEditedData({ ...editedData, buyer_name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Buyer company name"
                  disabled
                  title="Use 'Edit with Wizard' to change companies"
                />
              ) : (
                <dd className="text-base text-gray-900">{contract.buyer_name || '—'}</dd>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {isInlineEditing && t('contracts.useWizardToChangeCompany', 'Note: Use "Edit with Wizard" to change companies')}
              </p>
            </div>
            {commercialParties.consignee_name && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.consignee', 'Consignee')}
                </dt>
                <dd className="text-base text-gray-900">{commercialParties.consignee_name}</dd>
              </div>
            )}
            {commercialParties.invoice_date && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.invoiceDate', 'Invoice Date')}
                </dt>
                <dd className="text-base text-gray-900">
                  {new Date(commercialParties.invoice_date).toLocaleDateString('en-GB')}
                </dd>
              </div>
            )}
            {commercialParties.other_reference && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.otherReference', 'Other Reference')}
                </dt>
                <dd className="text-base text-gray-900">{commercialParties.other_reference}</dd>
              </div>
            )}
          </div>
        </Card>

        {/* Step 2: Shipping & Geography */}
        <Card>
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <GlobeAltIcon className="h-6 w-6 text-green-600" />
              {t('contracts.step2TitleV2', 'Shipping & Geography')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.countryOfOrigin', 'Country of Origin')}
              </dt>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={editedData.country_of_origin}
                  onChange={(e) => setEditedData({ ...editedData, country_of_origin: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g., Turkey, Argentina"
                />
              ) : (
                <dd className="text-base text-gray-900">{shipping.country_of_origin || '—'}</dd>
              )}
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.countryOfDestination', 'Country of Destination')}
              </dt>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={editedData.country_of_final_destination}
                  onChange={(e) => setEditedData({ ...editedData, country_of_final_destination: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g., Saudi Arabia, Jordan"
                />
              ) : (
                <dd className="text-base text-gray-900">{shipping.country_of_final_destination || '—'}</dd>
              )}
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.portOfLoading', 'Port of Loading (POL)')}
              </dt>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={editedData.port_of_loading_name}
                  onChange={(e) => setEditedData({ ...editedData, port_of_loading_name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g., Mersin, Buenos Aires"
                />
              ) : (
                <dd className="text-base text-gray-900">{shipping.port_of_loading_name || '—'}</dd>
              )}
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.portOfDischarge', 'Port of Discharge (POD)')}
              </dt>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={editedData.final_destination_name}
                  onChange={(e) => setEditedData({ ...editedData, final_destination_name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g., Jeddah, Mersin"
                />
              ) : (
                <dd className="text-base text-gray-900">{shipping.final_destination_name || '—'}</dd>
              )}
            </div>
            {shipping.pre_carriage_by && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.preCarriageBy', 'Pre-Carriage By')}
                </dt>
                <dd className="text-base text-gray-900">{shipping.pre_carriage_by}</dd>
              </div>
            )}
            {shipping.place_of_receipt && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.placeOfReceipt', 'Place of Receipt')}
                </dt>
                <dd className="text-base text-gray-900">{shipping.place_of_receipt}</dd>
              </div>
            )}
            {shipping.vessel_flight_no && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.vesselFlightNo', 'Vessel/Flight No.')}
                </dt>
                <dd className="text-base text-gray-900">{shipping.vessel_flight_no}</dd>
              </div>
            )}
            {shipping.estimated_shipment_date && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.estimatedShipmentDate', 'Est. Shipment Date')}
                </dt>
                <dd className="text-base text-gray-900">
                  {shipping.estimated_shipment_date.includes('-') 
                    ? new Date(shipping.estimated_shipment_date + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                    : shipping.estimated_shipment_date}
                </dd>
              </div>
            )}
          </div>
        </Card>

        {/* Step 3: Terms & Payment */}
        <Card>
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BanknotesIcon className="h-6 w-6 text-purple-600" />
              {t('contracts.step3TitleV2', 'Terms & Payment')}
            </h2>
          </div>
          <div className="space-y-6">
            {/* Cargo Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {terms.cargo_type && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">
                    {t('contracts.cargoType', 'Cargo Type')}
                  </dt>
                  <dd className="text-base font-semibold text-gray-900 capitalize">{terms.cargo_type}</dd>
                </div>
              )}
              {terms.weight_ton && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">
                    {t('contracts.totalWeight', 'Total Weight')}
                  </dt>
                  <dd className="text-base font-semibold text-blue-900">
                    {Number(terms.weight_ton).toLocaleString()} {terms.weight_unit || 'tons'}
                  </dd>
                </div>
              )}
              {terms.container_count && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">
                    {t('contracts.containerCount', 'Containers')}
                  </dt>
                  <dd className="text-base font-semibold text-gray-900">{terms.container_count}</dd>
                </div>
              )}
              {terms.barrels && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">
                    {t('contracts.barrels', 'Barrels')}
                  </dt>
                  <dd className="text-base font-semibold text-gray-900">{terms.barrels}</dd>
                </div>
              )}
            </div>

            {/* Delivery & Payment Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 border-t border-gray-200 pt-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.incoterm', 'Incoterm')}
                </dt>
                {isInlineEditing ? (
                  <input
                    type="text"
                    value={editedData.incoterm}
                    onChange={(e) => setEditedData({ ...editedData, incoterm: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                ) : (
                  <dd className="text-base font-semibold text-gray-900">{terms.incoterm || '—'}</dd>
                )}
              </div>
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.deliveryTermsDetail', 'Delivery Terms Detail')}
                </dt>
                {isInlineEditing ? (
                  <textarea
                    value={editedData.delivery_terms_detail}
                    onChange={(e) => setEditedData({ ...editedData, delivery_terms_detail: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                ) : (
                  <dd className="text-base text-gray-900">{terms.delivery_terms_detail || '—'}</dd>
                )}
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.currency', 'Currency')}
                </dt>
                <dd className="text-base font-semibold text-gray-900">{terms.currency_code || 'USD'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.paymentMethod', 'Payment Method')}
                </dt>
                {isInlineEditing ? (
                  <input
                    type="text"
                    value={editedData.payment_method}
                    onChange={(e) => setEditedData({ ...editedData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="e.g., T/T, L/C, etc."
                  />
                ) : (
                  <dd className="text-base text-gray-900">{terms.payment_method || '—'}</dd>
                )}
              </div>
              {terms.usd_equivalent_rate && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">
                    {t('contracts.usdEquivalent', 'USD Equivalent Rate')}
                  </dt>
                  <dd className="text-base text-gray-900">{terms.usd_equivalent_rate}</dd>
                </div>
              )}
              <div className="md:col-span-3">
                <dt className="text-sm font-medium text-gray-500 mb-1">
                  {t('contracts.paymentTermsDetail', 'Payment Terms')}
                </dt>
                {isInlineEditing ? (
                  <textarea
                    value={editedData.payment_terms}
                    onChange={(e) => setEditedData({ ...editedData, payment_terms: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Enter payment terms details..."
                  />
                ) : (
                  <dd className="text-base text-gray-900">{terms.payment_terms || '—'}</dd>
                )}
              </div>
            </div>

            {/* Special Clauses */}
            {terms.special_clauses && terms.special_clauses.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3">
                  {t('contracts.specialClauses', 'Special Clauses')}
                </h3>
                <div className="space-y-3">
                  {terms.special_clauses.map((clause: any, index: number) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {clause.type 
                            ? t(
                                `contracts.clause${clause.type.charAt(0).toUpperCase() + clause.type.slice(1).replace('_', '')}`,
                                { defaultValue: clause.type }
                              )
                            : t('contracts.clause', 'Clause')}
                        </span>
                        {clause.tolerance_percentage && (
                          <Badge color="yellow">{clause.tolerance_percentage}% ±</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 ml-8">{clause.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Step 4: Product Lines */}
        <Card>
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <CubeIcon className="h-6 w-6 text-orange-600" />
              {t('contracts.step4TitleV2', 'Product Lines')}
              {lines.length > 0 && <Badge color="orange">{lines.length}</Badge>}
            </h2>
          </div>
          {lines.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('contracts.typeOfGoods', 'Type of Goods')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('contracts.brand', 'Brand')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('contracts.kindOfPackages', 'Kind')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('contracts.numberOfPackages', '# Pkgs')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('contracts.packageSize', 'Size (kg)')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('contracts.quantityMT', 'Qty (MT)')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('contracts.rateUSD', 'Rate')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('contracts.amountUSD', 'Amount')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((line: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <TranslatedProductText text={line.type_of_goods || line.product_name} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{line.brand || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{line.kind_of_packages || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {Number(line.number_of_packages || 0).toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{line.unit_size || line.package_size || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-blue-900 text-right">
                        {Number(line.quantity_mt || 0).toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        ${Number(line.rate_usd_per_mt || line.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-900 text-right">
                        ${Number(line.amount_usd || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 text-right">
                      {t('common.total', 'TOTAL')}:
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {lines.reduce((sum: number, line: any) => sum + Number(line.number_of_packages || 0), 0).toLocaleString('en-US')}
                    </td>
                    <td></td>
                    <td className="px-4 py-3 text-sm text-blue-900 text-right">
                      {lines.reduce((sum: number, line: any) => sum + Number(line.quantity_mt || 0), 0).toFixed(3)}
                    </td>
                    <td></td>
                    <td className="px-4 py-3 text-sm text-green-900 text-right">
                      ${lines.reduce((sum: number, line: any) => sum + Number(line.amount_usd || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">{t('contracts.noProductLines', 'No product lines added yet')}</p>
          )}
        </Card>

        {/* Step 5: Banking & Documentation */}
        <Card>
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BuildingLibraryIcon className="h-6 w-6 text-indigo-600" />
              {t('contracts.step5TitleV2', 'Banking & Documentation')}
            </h2>
          </div>
          <div className="space-y-6">
            {/* Final Destination */}
            {(bankingDocs.has_final_destination || bankingDocs.final_destination_name) && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-md font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <TruckIcon className="h-5 w-5" />
                  {t('contracts.finalDestination', 'Final Destination')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bankingDocs.final_destination_type && (
                    <div>
                      <dt className="text-sm font-medium text-blue-700 mb-1">
                        {t('contracts.destinationType', 'Destination Type')}
                      </dt>
                      <dd className="text-base text-blue-900 capitalize">{bankingDocs.final_destination_type}</dd>
                    </div>
                  )}
                  {bankingDocs.final_destination_name && (
                    <div>
                      <dt className="text-sm font-medium text-blue-700 mb-1">
                        {t('contracts.destinationName', 'Destination Name')}
                      </dt>
                      <dd className="text-base font-semibold text-blue-900">{bankingDocs.final_destination_name}</dd>
                    </div>
                  )}
                  {bankingDocs.final_destination_address && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-blue-700 mb-1">
                        {t('contracts.destinationAddress', 'Destination Address')}
                      </dt>
                      <dd className="text-base text-blue-900">{bankingDocs.final_destination_address}</dd>
                    </div>
                  )}
                  {bankingDocs.final_destination_delivery_place && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-blue-700 mb-1">
                        {t('contracts.deliveryPlace', 'Delivery Place')}
                      </dt>
                      <dd className="text-base text-blue-900">{bankingDocs.final_destination_delivery_place}</dd>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Beneficiary Banking */}
            {bankingDocs.beneficiary_name && (
              <div>
                <h3 className="text-md font-semibold text-gray-900 mb-3">
                  {t('contracts.beneficiaryBanking', 'Beneficiary Banking Details')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">
                      {t('contracts.beneficiaryName', 'Beneficiary Name')}
                    </dt>
                    {isInlineEditing ? (
                      <input
                        type="text"
                        value={editedData.beneficiary_name}
                        onChange={(e) => setEditedData({ ...editedData, beneficiary_name: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Beneficiary name"
                      />
                    ) : (
                      <dd className="text-base font-semibold text-gray-900">{bankingDocs.beneficiary_name}</dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">
                      {t('contracts.accountNumber', 'Account Number')}
                    </dt>
                    {isInlineEditing ? (
                      <input
                        type="text"
                        value={editedData.beneficiary_account_no}
                        onChange={(e) => setEditedData({ ...editedData, beneficiary_account_no: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Account number"
                      />
                    ) : (
                      <dd className="text-base text-gray-900">{bankingDocs.beneficiary_account_no || '—'}</dd>
                    )}
                  </div>
                  {bankingDocs.beneficiary_address && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 mb-1">
                        {t('contracts.beneficiaryAddress', 'Beneficiary Address')}
                      </dt>
                      {isInlineEditing ? (
                        <textarea
                          value={editedData.beneficiary_address}
                          onChange={(e) => setEditedData({ ...editedData, beneficiary_address: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                          placeholder="Beneficiary address"
                        />
                      ) : (
                        <dd className="text-base text-gray-900">{bankingDocs.beneficiary_address}</dd>
                      )}
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">
                      {t('contracts.bankName', 'Bank Name')}
                    </dt>
                    {isInlineEditing ? (
                      <input
                        type="text"
                        value={editedData.beneficiary_bank_name}
                        onChange={(e) => setEditedData({ ...editedData, beneficiary_bank_name: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Bank name"
                      />
                    ) : (
                      <dd className="text-base font-semibold text-gray-900">{bankingDocs.beneficiary_bank_name || '—'}</dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">
                      {t('contracts.swiftCode', 'SWIFT Code')}
                    </dt>
                    {isInlineEditing ? (
                      <input
                        type="text"
                        value={editedData.beneficiary_swift_code}
                        onChange={(e) => setEditedData({ ...editedData, beneficiary_swift_code: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="SWIFT/BIC code"
                      />
                    ) : (
                      <dd className="text-base text-gray-900">{bankingDocs.beneficiary_swift_code || '—'}</dd>
                    )}
                  </div>
                  {bankingDocs.beneficiary_bank_address && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 mb-1">
                        {t('contracts.bankAddress', 'Bank Address')}
                      </dt>
                      {isInlineEditing ? (
                        <textarea
                          value={editedData.beneficiary_bank_address}
                          onChange={(e) => setEditedData({ ...editedData, beneficiary_bank_address: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                          placeholder="Bank address"
                        />
                      ) : (
                        <dd className="text-base text-gray-900">{bankingDocs.beneficiary_bank_address}</dd>
                      )}
                    </div>
                  )}
                  {bankingDocs.correspondent_bank && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 mb-1">
                        {t('contracts.correspondentBank', 'Correspondent Bank')}
                      </dt>
                      <dd className="text-base text-gray-900">{bankingDocs.correspondent_bank}</dd>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No banking info message */}
            {!bankingDocs.beneficiary_name && !bankingDocs.final_destination_name && (
              <p className="text-gray-500 text-center py-4">{t('contracts.noBankingInfo', 'No banking or final destination info added yet')}</p>
            )}

            {/* Documentation */}
            {bankingDocs.documentation && bankingDocs.documentation.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-md font-semibold text-gray-900 mb-3">
                  {t('contracts.documentationRequirements', 'Documentation Requirements')}
                </h3>
                <div className="space-y-2">
                  {bankingDocs.documentation.map((doc: any, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckIcon className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">{doc.document_type}</span>
                        {doc.attested_by && (
                          <Badge color="blue">{t('contracts.attestedBy', 'Attested by')}: {doc.attested_by}</Badge>
                        )}
                        {doc.legalization_required && (
                          <Badge color="red">{t('contracts.legalizationRequired', 'Legalization Required')}</Badge>
                        )}
                      </div>
                      {doc.quantity > 1 && (
                        <span className="text-xs text-gray-500">{doc.quantity} {t('contracts.copies', 'copies')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Fulfillment Progress */}
        {contract.fulfillment && (
          <Card>
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <TruckIcon className="h-6 w-6 text-emerald-600" />
                {t('contracts.fulfillmentProgress', 'Fulfillment Progress')}
                <Badge color={contract.fulfillment.is_fully_shipped ? 'green' : contract.fulfillment.total_shipped_mt > 0 ? 'yellow' : 'gray'}>
                  {contract.fulfillment.overall_percentage}%
                </Badge>
              </h2>
            </div>
            
            {/* Overall Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {t('contracts.overallFulfillment', 'Overall Fulfillment')}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {contract.fulfillment.total_shipped_mt.toFixed(2)} / {contract.fulfillment.total_contracted_mt.toFixed(2)} MT
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    contract.fulfillment.is_fully_shipped 
                      ? 'bg-emerald-500' 
                      : contract.fulfillment.overall_percentage > 50 
                        ? 'bg-blue-500' 
                        : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(contract.fulfillment.overall_percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>{t('contracts.shipped', 'Shipped')}: {contract.fulfillment.total_shipped_mt.toFixed(2)} MT</span>
                <span>{t('contracts.pending', 'Pending')}: {contract.fulfillment.total_pending_mt.toFixed(2)} MT</span>
              </div>
            </div>

            {/* Per-Line Fulfillment Table */}
            {lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('contracts.product', 'Product')}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('contracts.contracted', 'Contracted')}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('contracts.shipped', 'Shipped')}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('contracts.pending', 'Pending')}</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">{t('contracts.progress', 'Progress')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lines.map((line: any, index: number) => {
                      const contracted = parseFloat(line.quantity_mt) || 0;
                      const shipped = parseFloat(line.shipped_quantity_mt) || 0;
                      const pending = contracted - shipped;
                      const percentage = contracted > 0 ? Math.round((shipped / contracted) * 100) : 0;
                      const isComplete = pending <= 0 && contracted > 0;
                      
                      return (
                        <tr key={index} className={isComplete ? 'bg-emerald-50' : ''}>
                          <td className="px-4 py-3 text-gray-900">
                            <div className="flex items-center gap-2">
                              <TranslatedProductText text={line.type_of_goods || line.product_name} />
                              {isComplete && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                                  ✓
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900">{contracted.toFixed(2)} MT</td>
                          <td className="px-4 py-3 text-right font-medium text-blue-700">{shipped.toFixed(2)} MT</td>
                          <td className={`px-4 py-3 text-right font-semibold ${isComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {pending.toFixed(2)} MT
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-600 w-10 text-right">{percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Status Message */}
            <div className={`mt-4 p-3 rounded-lg ${
              contract.fulfillment.is_fully_shipped 
                ? 'bg-emerald-50 border border-emerald-200' 
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <p className={`text-sm font-medium ${
                contract.fulfillment.is_fully_shipped ? 'text-emerald-800' : 'text-amber-800'
              }`}>
                {contract.fulfillment.is_fully_shipped 
                  ? `✅ ${t('contracts.fullyShipped', 'This contract has been fully shipped')}`
                  : `📦 ${t('contracts.pendingShipment', '{{pending}} MT pending to be shipped', { pending: contract.fulfillment.total_pending_mt.toFixed(2) })}`
                }
              </p>
              {contract.fulfillment.shipment_count > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  {t('contracts.shipmentCountInfo', 'Fulfilled across {{count}} shipment(s)', { count: contract.fulfillment.shipment_count })}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Linked Shipments */}
        {contract.linked_shipments && contract.linked_shipments.length > 0 && (
          <Card>
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <TruckIcon className="h-6 w-6 text-indigo-600" />
                {t('contracts.linkedShipments', 'Linked Shipments')}
                <Badge color="indigo">{contract.linked_shipments.length}</Badge>
              </h2>
            </div>
            <div className="space-y-3">
              {contract.linked_shipments.map((shipment) => (
                <div
                  key={shipment.id}
                  onClick={() => navigate(`/shipments/${shipment.id}`)}
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors border border-gray-200 hover:border-indigo-300"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <TruckIcon className="h-6 w-6 text-indigo-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">{shipment.sn}</p>
                        {shipment.status && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            shipment.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            shipment.status === 'sailed' ? 'bg-blue-100 text-blue-800' :
                            shipment.status === 'arrived' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {shipment.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {shipment.subject || shipment.product_text || t('common.noDescription', 'No description')}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        {shipment.origin_port && shipment.destination_port && (
                          <span>{shipment.origin_port} → {shipment.destination_port}</span>
                        )}
                        {shipment.weight_ton && (
                          <span>{shipment.weight_ton} MT</span>
                        )}
                        {shipment.container_count && (
                          <span>{shipment.container_count} containers</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {shipment.eta && (
                        <div>
                          <p className="text-xs text-gray-500">{t('shipments.eta', 'ETA')}</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(shipment.eta).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Traceability Chain */}
        <Card>
          <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <ArrowPathIcon className="h-6 w-6 text-purple-600" />
              {t('contracts.traceability', 'Traceability Chain')}
              {traceability && (
                <Badge color="purple">
                  {traceability.summary?.total_shipments || 0} {t('common.shipments', 'shipments')}
                </Badge>
              )}
            </h2>
            <button
              onClick={() => {
                if (!traceability && !loadingTraceability) {
                  fetchTraceability();
                }
                setShowTraceability(!showTraceability);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              {loadingTraceability ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  {t('common.loading', 'Loading')}...
                </>
              ) : (
                <>
                  {showTraceability ? t('common.hide', 'Hide') : t('common.showChain', 'Show Chain')}
                  <ChevronRightIcon className={`h-4 w-4 transition-transform ${showTraceability ? 'rotate-90' : ''}`} />
                </>
              )}
            </button>
          </div>

          {!showTraceability && !traceability && (
            <p className="text-sm text-gray-500">
              {t('contracts.traceabilityDescription', 'View the complete chain from this contract through shipments, customs clearance, and final delivery.')}
            </p>
          )}

          {showTraceability && traceability && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{traceability.summary?.line_count || 0}</div>
                  <div className="text-xs text-gray-500">{t('contracts.lines', 'Contract Lines')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{traceability.summary?.total_shipments || 0}</div>
                  <div className="text-xs text-gray-500">{t('contracts.shipments', 'Shipments')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{traceability.summary?.total_clearances || 0}</div>
                  <div className="text-xs text-gray-500">{t('contracts.clearances', 'Clearances')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{traceability.summary?.total_deliveries || 0}</div>
                  <div className="text-xs text-gray-500">{t('contracts.deliveries', 'Deliveries')}</div>
                </div>
              </div>

              {/* Chain Visualization */}
              {traceability.lines && traceability.lines.length > 0 ? (
                <div className="space-y-3">
                  {traceability.lines.map((line: any, lineIndex: number) => (
                    <div key={line.contract_line_id || lineIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Contract Line Header */}
                      <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CubeIcon className="h-5 w-5 text-gray-600" />
                          <span className="font-medium text-gray-900">
                            <TranslatedProductText text={line.product_name} fallback="Product Line" />
                          </span>
                          <span className="text-sm text-gray-500">({parseFloat(line.contracted_mt)?.toFixed(2) || 0} MT)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {line.has_clearance && <Badge color="amber">Has Clearance</Badge>}
                          {line.has_delivery && <Badge color="emerald">Has Delivery</Badge>}
                        </div>
                      </div>

                      {/* Shipment Chain */}
                      {line.shipment_chain && line.shipment_chain.length > 0 ? (
                        <div className="p-3 space-y-2">
                          {line.shipment_chain.map((shipment: any, shipIdx: number) => (
                            <div key={shipment.shipment_id || shipIdx} className="flex items-start gap-2">
                              {/* Shipment */}
                              <div 
                                onClick={() => navigate(`/shipments/${shipment.shipment_id}`)}
                                className="flex-shrink-0 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                              >
                                <div className="flex items-center gap-1 text-sm font-medium text-blue-800">
                                  <TruckIcon className="h-4 w-4" />
                                  {shipment.shipment_sn}
                                </div>
                                <div className="text-xs text-blue-600">{parseFloat(shipment.shipped_mt)?.toFixed(2) || 0} MT</div>
                              </div>

                              {/* Arrow */}
                              <div className="flex items-center text-gray-400 pt-3">
                                <ChevronRightIcon className="h-4 w-4" />
                              </div>

                              {/* Clearance (if any) */}
                              {shipment.clearance && shipment.clearance.length > 0 ? (
                                <>
                                  <div className="flex-shrink-0 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    {shipment.clearance.map((cc: any, ccIdx: number) => (
                                      <div key={cc.clearance_id || ccIdx}>
                                        <div className="text-sm font-medium text-amber-800">{cc.file_number}</div>
                                        <div className="text-xs text-amber-600">
                                          {cc.clearance_type} • ${cc.total_cost?.toLocaleString() || 0}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center text-gray-400 pt-3">
                                    <ChevronRightIcon className="h-4 w-4" />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex-shrink-0 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg border-dashed">
                                    <div className="text-xs text-gray-400">{t('contracts.noClearance', 'No clearance')}</div>
                                  </div>
                                  <div className="flex items-center text-gray-400 pt-3">
                                    <ChevronRightIcon className="h-4 w-4" />
                                  </div>
                                </>
                              )}

                              {/* Delivery (if any) */}
                              {shipment.deliveries && shipment.deliveries.length > 0 ? (
                                <div className="flex-shrink-0 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                                  {shipment.deliveries.map((del: any, delIdx: number) => (
                                    <div key={del.delivery_id || delIdx}>
                                      <div className="text-sm font-medium text-emerald-800">{del.delivery_number}</div>
                                      <div className="text-xs text-emerald-600">
                                        {del.destination} • {del.status}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex-shrink-0 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg border-dashed">
                                  <div className="text-xs text-gray-400">{t('contracts.noDelivery', 'No delivery')}</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-sm text-gray-400">
                          {t('contracts.noShipmentsLinked', 'No shipments linked to this contract line yet')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ArrowPathIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>{t('contracts.noTraceabilityData', 'No traceability data available yet')}</p>
                  <p className="text-sm">{t('contracts.createShipmentToStart', 'Create a shipment from this contract to start tracking')}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Pending Update Requests */}
        {pendingRequests.length > 0 && (
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {t('contracts.sync.pendingApprovals', 'Pending Approval Requests')}
              <Badge color="yellow">{pendingRequests.length}</Badge>
            </h2>
            <div className="space-y-3">
              {pendingRequests.map((request: any) => (
                <div key={request.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {t('contracts.sync.updateRequestFrom', 'Update request from shipment')}: {request.shipment_sn || request.shipment_id}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {t('common.requestedBy', 'Requested by')}: {request.requested_by} • {new Date(request.requested_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveRequest(request.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                      >
                        {t('common.approve', 'Approve')}
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                      >
                        {t('common.reject', 'Reject')}
                      </button>
                    </div>
                  </div>
                  {request.changes_json && Array.isArray(request.changes_json) && (
                    <div className="space-y-2">
                      {request.changes_json.map((change: any, idx: number) => (
                        <div key={idx} className="text-sm bg-white p-2 rounded border border-gray-200">
                          <span className="font-medium">{change.field}:</span>{' '}
                          <span className="text-red-600">{change.old_value}</span> →{' '}
                          <span className="text-green-600">{change.new_value}</span>
                          {change.reason && (
                            <p className="text-xs text-gray-600 mt-1">
                              {t('contracts.sync.reason', 'Reason')}: {change.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Extra Info / Notes */}
        {(contract.notes || extraData.extra_info || isInlineEditing) && (
          <Card>
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {t('contracts.extraInfo', 'Additional Information')}
              </h2>
            </div>
            <div className="prose max-w-none">
              {isInlineEditing ? (
                <textarea
                  value={editedData.notes}
                  onChange={(e) => setEditedData({ ...editedData, notes: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-blue-500 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Enter additional information, special conditions, or notes..."
                />
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">
                  {extraData.extra_info || contract.notes}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Documents Section */}
        {id && (
          <DocumentPanel
            entityType="contract"
            entityId={id}
            entityRef={contract.contract_no}
            readOnly={false}
          />
        )}

        {/* Financial Transactions */}
        {id && (
          <TransactionsPanel
            entityType="contract"
            entityId={id}
            entityRef={contract.contract_no}
          />
        )}
      </div>

      {/* Edit Wizard Confirmation Dialog */}
      <Transition appear show={showEditWizardDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowEditWizardDialog(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    {t('contracts.editWithWizard', 'Edit with Wizard')}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {t('contracts.editWizardConfirm', 'This will open the full wizard with all contract details pre-filled. You can edit any section and save changes.')}
                    </p>
                  </div>

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                      onClick={() => setShowEditWizardDialog(false)}
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700"
                      onClick={handleConfirmEditWizard}
                    >
                      {t('common.openWizard', 'Open Wizard')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* New Shipment Wizard */}
      <NewShipmentWizard
        isOpen={showNewShipmentWizard}
        onClose={() => setShowNewShipmentWizard(false)}
        onSuccess={() => {
          setShowNewShipmentWizard(false);
          // Optionally navigate to shipments page or refresh
        }}
        initialContractId={id}
        initialContractNo={contract.contract_no}
        initialContract={contract}
      />

      {/* Link Shipment Dialog */}
      <Transition appear show={showLinkShipmentDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowLinkShipmentDialog(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center gap-2">
                    <LinkIcon className="h-6 w-6 text-blue-600" />
                    {t('contracts.linkExistingShipment', 'Link Existing Shipment')}
                  </Dialog.Title>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contracts.searchShipment', 'Search for a shipment')}
                    </label>
                    <input
                      type="text"
                      value={shipmentSearch}
                      onChange={(e) => handleShipmentSearch(e.target.value)}
                      placeholder={t('contracts.searchShipmentPlaceholder', 'Enter shipment number, product, or booking number...')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="mt-4 max-h-96 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex justify-center py-8">
                        <Spinner size="md" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-2">
                        {searchResults.map((shipment) => (
                          <div
                            key={shipment.id}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900">{shipment.sn}</span>
                                {shipment.status && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    shipment.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                    shipment.status === 'sailed' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {shipment.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                <TranslatedProductText text={shipment.product_text || shipment.subject} fallback="No description" />
                              </p>
                              {shipment.contract_id && shipment.contract_id === id ? (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                  ✓ {t('contracts.alreadyLinkedToThisContract', 'Already linked to this contract')}
                                </p>
                              ) : shipment.contract_id ? (
                                <p className="text-xs text-orange-600 mt-1">
                                  ⚠️ {t('contracts.alreadyLinkedToContract', 'Already linked to another contract')}
                                </p>
                              ) : null}
                            </div>
                            <button
                              onClick={() => handleLinkShipment(shipment.id)}
                              disabled={isLinking || (shipment.contract_id && shipment.contract_id !== id)}
                              className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                shipment.contract_id && shipment.contract_id !== id
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : shipment.contract_id === id
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {isLinking ? t('common.linking', 'Linking...') : t('common.link', 'Link')}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : shipmentSearch.length >= 2 ? (
                      <div className="text-center py-8 text-gray-500">
                        {t('contracts.noShipmentsFound', 'No shipments found')}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {t('contracts.enterSearchTerm', 'Enter at least 2 characters to search')}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                      onClick={() => {
                        setShowLinkShipmentDialog(false);
                        setShipmentSearch('');
                        setSearchResults([]);
                      }}
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Audit Log Viewer */}
      {id && (
        <AuditLogViewer
          isOpen={showAuditLog}
          onClose={() => setShowAuditLog(false)}
          entityType="contract"
          entityId={id}
        />
      )}
    </div>
  );
}

export default ContractDetailPage;

