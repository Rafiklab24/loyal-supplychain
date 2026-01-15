import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="text-2xl text-gray-600 mt-4">{t('common.error')}</p>
        <p className="text-gray-500 mt-2">{t('common.noData')}</p>
        <Button onClick={() => navigate('/')} className="mt-6">
          {t('common.back')}
        </Button>
      </div>
    </div>
  );
}

