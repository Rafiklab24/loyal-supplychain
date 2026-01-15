import type { ErrorInfo } from 'react';

/**
 * Initialize error reporting service (Sentry, LogRocket, etc.)
 * This should be called once at app startup
 */
export function initErrorReporting() {
  // In production, initialize error tracking service
  if (import.meta.env.PROD) {
    // Example: Sentry initialization
    // import * as Sentry from '@sentry/react';
    // Sentry.init({
    //   dsn: import.meta.env.VITE_SENTRY_DSN,
    //   environment: import.meta.env.MODE,
    //   integrations: [
    //     new Sentry.BrowserTracing(),
    //     new Sentry.Replay(),
    //   ],
    //   tracesSampleRate: 0.1,
    //   replaysSessionSampleRate: 0.1,
    //   replaysOnErrorSampleRate: 1.0,
    // });
    
    // For now, just log to console in production
    console.log('Error reporting initialized (production mode)');
  } else {
    console.log('Error reporting initialized (development mode)');
  }

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    reportError(error);
  });
}

/**
 * Report an error to the error tracking service
 */
export function reportError(error: Error, errorInfo?: ErrorInfo) {
  if (import.meta.env.PROD) {
    // In production, send to error tracking service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
    console.error('Error reported to tracking service:', error, errorInfo);
    
    // You can also send to your backend API
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ error: error.message, stack: error.stack, errorInfo }),
    // }).catch(() => {});
  } else {
    // In development, log to console with full details
    console.error('Error in development:', error, errorInfo);
  }
}

/**
 * Set user context for error reporting
 */
export function setUserContext(user: { id: string; username: string; email?: string }) {
  if (import.meta.env.PROD) {
    // Example: Sentry.setUser({ id: user.id, username: user.username, email: user.email });
    console.log('User context set for error reporting:', user);
  }
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext() {
  if (import.meta.env.PROD) {
    // Example: Sentry.setUser(null);
    console.log('User context cleared');
  }
}

