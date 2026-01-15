import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../../../pages/DashboardPage';
import { AuthProvider } from '../../../contexts/AuthContext';
import * as useStatsHook from '../../../hooks/useStats';
import * as useTasksHook from '../../../hooks/useTasks';

// Mock hooks
vi.mock('../../../hooks/useStats');
vi.mock('../../../hooks/useTasks');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('should render loading state', () => {
    vi.spyOn(useStatsHook, 'useStats').mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    vi.spyOn(useTasksHook, 'useTopTasks').mockReturnValue({
      data: [],
      isLoading: true,
      totalTasks: 0,
    } as any);

    renderDashboard();

    // Should show loading skeleton
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render dashboard stats when loaded', async () => {
    const mockStats = {
      overview: {
        total_shipments: 100,
        total_value_usd: 1000000,
        total_weight_tons: 5000,
        total_suppliers: 50,
      },
    };

    vi.spyOn(useStatsHook, 'useStats').mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useTasksHook, 'useTopTasks').mockReturnValue({
      data: [],
      isLoading: false,
      totalTasks: 0,
    } as any);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/dashboard.title/i)).toBeInTheDocument();
    });
  });

  it('should render error state', () => {
    vi.spyOn(useStatsHook, 'useStats').mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    vi.spyOn(useTasksHook, 'useTopTasks').mockReturnValue({
      data: [],
      isLoading: false,
      totalTasks: 0,
    } as any);

    renderDashboard();

    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
