import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../contexts/AuthContext';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockAxios = vi.mocked(axios);

// Mock API config
vi.mock('../../../config/api', () => ({
  API_BASE_URL: 'http://localhost:3000/api',
}));

const TestComponent = () => {
  const { isAuthenticated, user, login, logout, isLoading, error } = useAuth();

  return (
    <div>
      <div data-testid="isAuthenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="isLoading">{isLoading ? 'true' : 'false'}</div>
      <div data-testid="user">{user ? user.username : 'null'}</div>
      <div data-testid="error">{error || 'null'}</div>
      <button onClick={() => login('testuser', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should provide initial unauthenticated state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('should restore authentication from localStorage', async () => {
    const userData = { id: '1', username: 'testuser', name: 'Test User', role: 'user' };
    localStorage.setItem('auth_token', 'stored-token');
    localStorage.setItem('user_data', JSON.stringify(userData));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });

  it('should handle login successfully', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: {
        token: 'new-token',
        user: { id: '1', username: 'testuser', name: 'Test User', role: 'user' },
      },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    expect(localStorage.getItem('auth_token')).toBe('new-token');
  });

  it('should handle login failure', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: {
        data: { message: 'Invalid credentials' },
      },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
    });

    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
  });

  it('should handle logout', async () => {
    const userData = { id: '1', username: 'testuser', name: 'Test User', role: 'user' };
    localStorage.setItem('auth_token', 'token');
    localStorage.setItem('user_data', JSON.stringify(userData));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should clear invalid stored data', async () => {
    localStorage.setItem('auth_token', 'token');
    localStorage.setItem('user_data', 'invalid-json');

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
  });
});
