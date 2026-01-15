import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { sharedOptions, getBaseUrl, getAuthCredentials } from './k6.config.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
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

  // Test GET /api/contracts
  const listRes = http.get(`${BASE_URL}/api/contracts?page=1&limit=20`, {
    headers,
  });

  const listSuccess = check(listRes, {
    'list status is 200': (r) => r.status === 200,
    'list has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!listSuccess);

  sleep(1);

  // Test filtering
  const filterRes = http.get(`${BASE_URL}/api/contracts?status=ACTIVE&page=1&limit=20`, {
    headers,
  });

  const filterSuccess = check(filterRes, {
    'filter status is 200': (r) => r.status === 200,
  });

  errorRate.add(!filterSuccess);

  sleep(1);
}

