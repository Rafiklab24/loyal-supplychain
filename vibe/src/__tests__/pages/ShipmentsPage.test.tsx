import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ShipmentsPage } from '../../../pages/ShipmentsPage';
import { AuthProvider } from '../../../contexts/AuthContext';
import * as useShipmentsHook from '../../../hooks/useShipments';

// Mock hooks
vi.mock('../../../hooks/useShipments');
vi.mock('../../../hooks/useSearchHistory');
vi.mock('../../../hooks/useFilterSuggestions');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('ShipmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderShipmentsPage = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <ShipmentsPage />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('should render shipments page', () => {
    vi.spyOn(useShipmentsHook, 'useShipments').mockReturnValue({
      data: { data: [], pagination: { page: 1, limit: 20, total: 0 } },
      isLoading: false,
      error: null,
    } as any);

    renderShipmentsPage();

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('should show loading state', () => {
    vi.spyOn(useShipmentsHook, 'useShipments').mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    renderShipmentsPage();

    // Should show spinner or loading state
    expect(screen.getByRole('status') || screen.queryByText(/loading/i)).toBeDefined();
  });

  it('should render shipments list', async () => {
    const mockShipments = {
      data: [
        {
          id: '1',
          sn: 'SN-001',
          product_text: 'Rice',
          eta: '2024-01-15',
          status: 'sailed',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1 },
    };

    vi.spyOn(useShipmentsHook, 'useShipments').mockReturnValue({
      data: mockShipments,
      isLoading: false,
      error: null,
    } as any);

    renderShipmentsPage();

    await waitFor(() => {
      expect(screen.getByText(/SN-001/i)).toBeInTheDocument();
    });
  });
});
