import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { sharedOptions, getBaseUrl, getAuthCredentials } from './k6.config.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 150 },
    { duration: '5m', target: 150 },
    { duration: '2m', target: 0 },
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

  // Simulate realistic user behavior mix
  const actions = [
    () => {
      // View shipments
      const res = http.get(`${BASE_URL}/api/shipments?page=1&limit=20`, { headers });
      return check(res, { 'shipments status is 200': (r) => r.status === 200 });
    },
    () => {
      // View contracts
      const res = http.get(`${BASE_URL}/api/contracts?page=1&limit=20`, { headers });
      return check(res, { 'contracts status is 200': (r) => r.status === 200 });
    },
    () => {
      // View notifications
      const res = http.get(`${BASE_URL}/api/notifications?limit=50`, { headers });
      return check(res, { 'notifications status is 200': (r) => r.status === 200 });
    },
    () => {
      // View finance transactions
      const res = http.get(`${BASE_URL}/api/finance/transactions?page=1&limit=50`, { headers });
      return check(res, { 'transactions status is 200': (r) => r.status === 200 });
    },
    () => {
      // Search shipments
      const res = http.get(`${BASE_URL}/api/shipments?search=test&page=1&limit=20`, { headers });
      return check(res, { 'search status is 200': (r) => r.status === 200 });
    },
  ];

  // Randomly select an action
  const action = actions[Math.floor(Math.random() * actions.length)];
  const success = action();

  errorRate.add(!success);

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

