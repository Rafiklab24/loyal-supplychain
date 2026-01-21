import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionProvider } from './contexts/PermissionContext';
import { Layout } from './components/layout/Layout';
import { Spinner } from './components/common/Spinner';
import { ToastProvider } from './components/common/Toast';
import { RoleGuard } from './components/common/RoleGuard';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { initErrorReporting } from './utils/errorReporting';
import { useDisableNumberInputScroll } from './hooks/useDisableNumberInputScroll';
import type { Module } from './contexts/PermissionContext';

const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ShipmentsPage = lazy(() => import('./pages/ShipmentsPage').then(m => ({ default: m.ShipmentsPage })));
const ShipmentTrackingPage = lazy(() => import('./pages/ShipmentTrackingPage').then(m => ({ default: m.ShipmentTrackingPage })));
const ShipmentDetailPage = lazy(() => import('./pages/ShipmentDetailPage').then(m => ({ default: m.ShipmentDetailPage })));
const ShipmentFinalReport = lazy(() => import('./pages/ShipmentFinalReport').then(m => ({ default: m.ShipmentFinalReport })));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const ContractsPage = lazy(() => import('./pages/ContractsPage'));
const NewContractPage = lazy(() => import('./pages/NewContractPage'));
const EditContractPage = lazy(() => import('./pages/EditContractPage'));
const ContractDetailPage = lazy(() => import('./pages/ContractDetailPage'));
const SupplierDocumentUploadPage = lazy(() => import('./pages/SupplierDocumentUploadPage'));
const TasksPage = lazy(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })));
const FinancePage = lazy(() => import('./pages/FinancePage').then(m => ({ default: m.FinancePage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })));
const CustomsClearingCostsPage = lazy(() => import('./pages/CustomsClearingCostsPage'));
const CustomsClearingBatchesPage = lazy(() => import('./pages/CustomsClearingBatchesPage'));
const LandTransportPage = lazy(() => import('./pages/LandTransportPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const AccountingPage = lazy(() => import('./pages/AccountingPage'));
const EFaturaPage = lazy(() => import('./pages/EFaturaPage'));
const FieldMappingsPage = lazy(() => import('./pages/admin/FieldMappingsPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const BorderCrossingsPage = lazy(() => import('./pages/BorderCrossingsPage'));
const BorderAgentPage = lazy(() => import('./pages/BorderAgentPage'));
const InventoryDashboardPage = lazy(() => import('./pages/InventoryDashboardPage'));
const QualityReviewPage = lazy(() => import('./pages/QualityReviewPage'));
const QualityIncidentWizardPage = lazy(() => import('./components/quality/QualityIncidentWizard').then(m => ({ default: m.QualityIncidentWizard })));
const CafeDashboardPage = lazy(() => import('./pages/CafeDashboardPage'));
const CashBoxPage = lazy(() => import('./pages/CashBoxPage'));
const AntrepoDashboardPage = lazy(() => import('./pages/AntrepoDashboardPage'));
const AntrepoLotsPage = lazy(() => import('./pages/AntrepoLotsPage'));
const ElleclemeDashboardPage = lazy(() => import('./pages/ElleclemeDashboardPage'));
const ElleclemeRequestDetailPage = lazy(() => import('./pages/ElleclemeRequestDetailPage'));
const StockDashboardPage = lazy(() => import('./pages/StockDashboardPage'));

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
});

// Protected Route wrapper with Layout
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <PageLoader />
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

// Protected Route with Module-based access control
interface ProtectedModuleRouteProps {
  children: React.ReactNode;
  module: Module;
  requireWrite?: boolean;
}

function ProtectedModuleRoute({ children, module, requireWrite = false }: ProtectedModuleRouteProps) {
  return (
    <ProtectedRoute>
      <RoleGuard module={module} requireWrite={requireWrite}>
        {children}
      </RoleGuard>
    </ProtectedRoute>
  );
}

function App() {
  const { i18n } = useTranslation();

  // Initialize error reporting on app startup
  useEffect(() => {
    initErrorReporting();
  }, []);

  // Set HTML direction based on language
  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Disable mouse wheel scroll on number inputs globally
  // Prevents accidental value changes when scrolling over numeric fields
  useDisableNumberInputScroll();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <PermissionProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <Suspense fallback={<PageLoader />}>
                <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />

                {/* Dashboard - accessible by all authenticated users */}
              <Route
                path="/"
                element={
                  <ErrorBoundary>
                    <ProtectedModuleRoute module="dashboard">
                      <DashboardPage />
                    </ProtectedModuleRoute>
                  </ErrorBoundary>
                }
              />

                {/* Shipments */}
              <Route
                path="/shipments"
                element={
                  <ErrorBoundary>
                    <ProtectedModuleRoute module="shipments">
                      <ShipmentsPage />
                    </ProtectedModuleRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/shipments/tracking"
                element={
                    <ProtectedModuleRoute module="shipments">
                    <ShipmentTrackingPage />
                    </ProtectedModuleRoute>
                }
              />
              {/* Redirect /shipments/new to /shipments - new shipment wizard opens as modal */}
              <Route
                path="/shipments/new"
                element={<Navigate to="/shipments" replace />}
              />
              <Route
                path="/shipments/:id"
                element={
                    <ProtectedModuleRoute module="shipments">
                    <ShipmentFinalReport />
                    </ProtectedModuleRoute>
                }
              />
              {/* Legacy detail page route (for comparison/fallback) */}
              <Route
                path="/shipments/:id/legacy"
                element={
                    <ProtectedModuleRoute module="shipments">
                    <ShipmentDetailPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Contracts */}
              <Route
                path="/contracts/new"
                element={
                  <ErrorBoundary>
                    <ProtectedModuleRoute module="contracts" requireWrite>
                      <NewContractPage />
                    </ProtectedModuleRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/contracts/:id/edit"
                element={
                  <ErrorBoundary>
                    <ProtectedModuleRoute module="contracts" requireWrite>
                      <EditContractPage />
                    </ProtectedModuleRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/contracts/:id"
                element={
                  <ErrorBoundary>
                    <ProtectedModuleRoute module="contracts">
                      <ContractDetailPage />
                    </ProtectedModuleRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/contracts"
                element={
                  <ErrorBoundary>
                    <ProtectedModuleRoute module="contracts">
                      <ContractsPage />
                    </ProtectedModuleRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/supplier/upload/:contractId"
                element={
                    <ProtectedModuleRoute module="contracts">
                    <SupplierDocumentUploadPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Companies */}
              <Route
                path="/companies"
                element={
                    <ProtectedModuleRoute module="companies">
                    <CompaniesPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Finance */}
              <Route
                path="/finance"
                element={
                    <ProtectedModuleRoute module="finance">
                    <FinancePage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Analytics */}
              <Route
                path="/analytics"
                element={
                    <ProtectedModuleRoute module="analytics">
                    <AnalyticsPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Tasks */}
              <Route
                path="/tasks"
                element={
                    <ProtectedModuleRoute module="dashboard">
                    <TasksPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* User Management - Admin Only */}
              <Route
                path="/users"
                element={
                    <ProtectedModuleRoute module="users">
                    <UsersPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Customs Clearing */}
              <Route
                path="/customs-clearing-costs"
                element={
                    <ProtectedModuleRoute module="customs">
                    <CustomsClearingCostsPage />
                    </ProtectedModuleRoute>
                }
              />
              <Route
                path="/customs-clearing-batches"
                element={
                    <ProtectedModuleRoute module="customs">
                    <CustomsClearingBatchesPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Land Transport */}
              <Route
                path="/land-transport"
                element={
                    <ProtectedModuleRoute module="land_transport">
                    <LandTransportPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Products */}
              <Route
                path="/products"
                element={
                    <ProtectedModuleRoute module="products">
                    <ProductsPage />
                    </ProtectedModuleRoute>
                }
              />

                {/* Accounting */}
              <Route
                path="/accounting"
                element={
                    <ProtectedModuleRoute module="accounting">
                    <AccountingPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* E-Fatura (Turkish Invoice) */}
              <Route
                path="/e-fatura"
                element={
                    <ProtectedModuleRoute module="customs">
                    <EFaturaPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Admin: Field Mappings */}
              <Route
                path="/admin/field-mappings"
                element={
                    <ProtectedModuleRoute module="users">
                    <FieldMappingsPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Documents */}
              <Route
                path="/documents"
                element={
                    <ProtectedModuleRoute module="dashboard">
                    <DocumentsPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Border Crossings - Admin */}
              <Route
                path="/border-crossings"
                element={
                    <ProtectedModuleRoute module="users">
                    <BorderCrossingsPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Border Agent Interface - Mobile-friendly */}
              <Route
                path="/border-agent"
                element={
                    <ProtectedModuleRoute module="shipments">
                    <BorderAgentPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Inventory Dashboard - Final Beneficiary Interface */}
              <Route
                path="/inventory"
                element={
                    <ProtectedModuleRoute module="inventory">
                    <InventoryDashboardPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Quality Incidents */}
              <Route
                path="/quality-incidents"
                element={
                    <ProtectedModuleRoute module="quality">
                    <QualityReviewPage />
                    </ProtectedModuleRoute>
                }
              />
              <Route
                path="/quality-incident/new"
                element={
                    <ProtectedModuleRoute module="inventory">
                    <QualityIncidentWizardPage />
                    </ProtectedModuleRoute>
                }
              />
              <Route
                path="/quality-incident/:id"
                element={
                    <ProtectedModuleRoute module="quality">
                    <QualityIncidentWizardPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Cafeteria - Chef Dashboard */}
              <Route
                path="/cafe"
                element={
                    <ProtectedModuleRoute module="cafe">
                    <CafeDashboardPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Cash Box - Bookkeeper Dashboard */}
              <Route
                path="/cashbox"
                element={
                    <ProtectedModuleRoute module="cashbox">
                    <CashBoxPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Stock Dashboard - Global Stock Management */}
              <Route
                path="/stock"
                element={
                    <ProtectedModuleRoute module="antrepo">
                    <StockDashboardPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Antrepo - Customs Warehouse Management (legacy routes) */}
              <Route
                path="/antrepo"
                element={
                    <ProtectedModuleRoute module="antrepo">
                    <AntrepoDashboardPage />
                    </ProtectedModuleRoute>
                }
              />
              <Route
                path="/antrepo-lots"
                element={
                    <ProtectedModuleRoute module="antrepo" requireWrite>
                    <AntrepoLotsPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* Elleçleme - Handling Operations Management */}
              <Route
                path="/ellecleme"
                element={
                    <ProtectedModuleRoute module="ellecleme">
                    <ElleclemeDashboardPage />
                    </ProtectedModuleRoute>
                }
              />
              <Route
                path="/ellecleme/requests/:id"
                element={
                    <ProtectedModuleRoute module="ellecleme">
                    <ElleclemeRequestDetailPage />
                    </ProtectedModuleRoute>
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </BrowserRouter>
            </Suspense>
          </ToastProvider>
        </QueryClientProvider>
      </PermissionProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export default App;
