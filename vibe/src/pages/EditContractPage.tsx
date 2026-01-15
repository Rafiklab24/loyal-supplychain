/**
 * Edit Contract Page
 * Loads existing contract data and opens the wizard in edit mode
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContract } from '../hooks/useContracts';
import { Spinner } from '../components/common/Spinner';
import { ContractWizard } from '../components/contracts/wizard/ContractWizard';

export default function EditContractPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contract, isLoading, error } = useContract(id || '');

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

  return (
    <div className="container mx-auto px-4 py-8">
      <ContractWizard
        mode="edit"
        existingContract={contract}
        onSuccess={() => {
          navigate(`/contracts/${id}`);
        }}
        onCancel={() => {
          navigate(`/contracts/${id}`);
        }}
      />
    </div>
  );
}

