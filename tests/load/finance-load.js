import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { sharedOptions, getBaseUrl, getAuthCredentials } from './k6.config.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 40 },
    { duration: '3m', target: 40 },
    { duration: '1m', target: 60 },
    { duration: '3m', target: 60 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    ...sharedOptions.thresholds,
  },
};

const BASE_URL = getBaseUrl();

export function setup() {
  const credentials = getAuthCredentials();
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(credentials),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.token };
  }

  return { token: null };
}

export default function (data) {
  if (!data.token) return;

  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test GET /api/finance/transactions
  const transactionsRes = http.get(`${BASE_URL}/api/finance/transactions?page=1&limit=50`, {
    headers,
  });

  const transactionsSuccess = check(transactionsRes, {
    'transactions status is 200': (r) => r.status === 200,
    'transactions has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined || Array.isArray(body);
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!transactionsSuccess);

  sleep(1);

  // Test finance summary
  const summaryRes = http.get(`${BASE_URL}/api/finance/summary`, {
    headers,
  });

  const summarySuccess = check(summaryRes, {
    'summary status is 200': (r) => r.status === 200,
  });

  errorRate.add(!summarySuccess);

  sleep(1);
}



