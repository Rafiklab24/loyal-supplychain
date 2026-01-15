import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, error: authError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    if (!username || !password) {
      setLocalError(t('auth.fillAllFields') || 'Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(username, password);
      // Navigate to dashboard on successful login
      navigate('/');
    } catch (err: any) {
      setLocalError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Only enable quick login in development with explicit flag
  const enableQuickLogin = 
    import.meta.env.VITE_ENABLE_QUICK_LOGIN === 'true' &&
    import.meta.env.MODE === 'development';

  const handleDirectLogin = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    
    try {
      // Double-check flag before attempting quick login
      if (!enableQuickLogin) {
        setLocalError('Quick login is not available in this environment.');
        setIsSubmitting(false);
        return;
      }

      // Try default test credentials (only in development with flag enabled)
      await login('admin', 'Admin123!');
      navigate('/');
    } catch (err: any) {
      setLocalError('Quick login failed. Please use the form above.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600 mb-2">
              {t('app.title')}
            </h1>
            <p className="text-gray-600">{t('app.subtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {(localError || authError) && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg" role="alert" aria-live="assertive">
                <p className="text-sm text-red-600">{localError || authError}</p>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.username')}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                required
                autoComplete="username"
                aria-required="true"
                aria-invalid={localError ? 'true' : 'false'}
                aria-describedby={localError ? 'username-error' : undefined}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={t('auth.username')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={localError ? 'true' : 'false'}
                aria-describedby={localError ? 'password-error' : undefined}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={t('auth.password')}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="remember-me"
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  aria-label={t('auth.rememberMe', 'Remember me')}
                />
                <span className="ms-2 text-sm text-gray-700">{t('auth.rememberMe')}</span>
              </label>
              <a 
                href="#" 
                className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
                aria-label={t('auth.forgotPassword', 'Forgot password')}
              >
                {t('auth.forgotPassword')}
              </a>
            </div>

            {/* Submit Button - Very Visible */}
            <button
              type="submit"
              disabled={isSubmitting}
              aria-label={isSubmitting ? t('auth.loggingIn') || 'Logging in...' : t('auth.login') || 'Login'}
              aria-busy={isSubmitting}
              className="w-full px-4 py-3.5 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {isSubmitting ? t('auth.loggingIn') || 'Logging in...' : t('auth.login')}
            </button>
          </form>

          {/* Quick Login Button for Testing - Only in Development */}
          {enableQuickLogin && (
            <button
              onClick={handleDirectLogin}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed mt-4"
              aria-label="Quick login with test credentials (development only)"
            >
              🚀 Quick Login (Dev Only)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

