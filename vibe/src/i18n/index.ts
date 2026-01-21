import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Arabic namespace imports
import arCommon from './locales/ar/common.json';
import arDashboard from './locales/ar/dashboard.json';
import arShipments from './locales/ar/shipments.json';
import arContracts from './locales/ar/contracts.json';
import arFinance from './locales/ar/finance.json';
import arDocuments from './locales/ar/documents.json';
import arCustoms from './locales/ar/customs.json';
import arOperations from './locales/ar/operations.json';
import arEllecleme from './locales/ar/ellecleme.json';

// English namespace imports
import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enShipments from './locales/en/shipments.json';
import enContracts from './locales/en/contracts.json';
import enFinance from './locales/en/finance.json';
import enDocuments from './locales/en/documents.json';
import enCustoms from './locales/en/customs.json';
import enOperations from './locales/en/operations.json';
import enEllecleme from './locales/en/ellecleme.json';

// Turkish namespace imports
import trCommon from './locales/tr/common.json';
import trDashboard from './locales/tr/dashboard.json';
import trShipments from './locales/tr/shipments.json';
import trContracts from './locales/tr/contracts.json';
import trFinance from './locales/tr/finance.json';
import trDocuments from './locales/tr/documents.json';
import trCustoms from './locales/tr/customs.json';
import trOperations from './locales/tr/operations.json';
import trEllecleme from './locales/tr/ellecleme.json';

// Merge all namespaces into single translation object per language
// This maintains backward compatibility - all keys work with default namespace
const mergeNamespaces = (...namespaces: Record<string, unknown>[]) => {
  return namespaces.reduce((acc, ns) => ({ ...acc, ...ns }), {});
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: {
        translation: mergeNamespaces(
          arCommon,
          arDashboard,
          arShipments,
          arContracts,
          arFinance,
          arDocuments,
          arCustoms,
          arOperations,
          arEllecleme
        ),
      },
      en: {
        translation: mergeNamespaces(
          enCommon,
          enDashboard,
          enShipments,
          enContracts,
          enFinance,
          enDocuments,
          enCustoms,
          enOperations,
          enEllecleme
        ),
      },
      tr: {
        translation: mergeNamespaces(
          trCommon,
          trDashboard,
          trShipments,
          trContracts,
          trFinance,
          trDocuments,
          trCustoms,
          trOperations,
          trEllecleme
        ),
      },
    },
    fallbackLng: 'ar', // Arabic is primary
    lng: 'ar', // Default language
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
