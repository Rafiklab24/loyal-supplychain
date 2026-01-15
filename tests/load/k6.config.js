/**
 * Shared k6 Configuration
 * Common settings for all load tests
 */

export const sharedOptions = {
  // Default thresholds for all tests
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
    http_req_receiving: ['p(95)<500'],   // 95% receive time under 500ms
    http_req_waiting: ['p(95)<500'],     // 95% wait time under 500ms
  },
  // Summary output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)', 'p(99.99)', 'count'],
};

export const getBaseUrl = () => {
  return __ENV.BASE_URL || 'http://localhost:3000';
};

export const getAuthCredentials = () => {
  return {
    username: __ENV.TEST_USERNAME || 'admin',
    password: __ENV.TEST_PASSWORD || 'Admin123!',
  };
};



