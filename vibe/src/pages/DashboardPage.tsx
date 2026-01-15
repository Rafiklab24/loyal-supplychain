import { useAuth } from '../contexts/AuthContext';
import { 
  AdminExecDashboard, 
  LogisticsDashboard, 
  AccountingDashboard, 
  ClearanceDashboard,
  DefaultDashboard 
} from '../components/dashboard';

export function DashboardPage() {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';

  // Route to appropriate dashboard based on role
  switch (userRole) {
    case 'admin':
    case 'exec':
      return <AdminExecDashboard />;
    
    case 'logistics':
      return <LogisticsDashboard />;
    
    case 'accounting':
      return <AccountingDashboard />;
    
    case 'clearance':
      return <ClearanceDashboard />;
    
    // Inventory role should go to inventory page directly
    case 'inventory':
      return <DefaultDashboard />;
    
    // All other roles get the default dashboard
    case 'procurement':
    case 'correspondence':
    case 'cafe':
    default:
      return <DefaultDashboard />;
  }
}
