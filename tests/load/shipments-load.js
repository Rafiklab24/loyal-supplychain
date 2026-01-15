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
    http_req_duration: ['p(95)<1000'], // 95% under 1s for list endpoint
  },
};

const BASE_URL = getBaseUrl();

// Setup: Login once to get token
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
  if (!data.token) {
    console.error('No auth token available');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test GET /api/shipments
  const listRes = http.get(`${BASE_URL}/api/shipments?page=1&limit=20`, {
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

  // Test search
  const searchRes = http.get(`${BASE_URL}/api/shipments?search=test&page=1&limit=20`, {
    headers,
  });

  const searchSuccess = check(searchRes, {
    'search status is 200': (r) => r.status === 200,
  });

  errorRate.add(!searchSuccess);

  sleep(1);
}

