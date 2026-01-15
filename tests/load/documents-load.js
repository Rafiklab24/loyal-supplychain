import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { sharedOptions, getBaseUrl, getAuthCredentials } from './k6.config.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '3m', target: 30 },
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    ...sharedOptions.thresholds,
    http_req_duration: ['p(95)<2000'], // Documents may take longer
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

  // Test GET /api/documents
  const listRes = http.get(`${BASE_URL}/api/documents?page=1&limit=20`, {
    headers,
  });

  const listSuccess = check(listRes, {
    'list status is 200': (r) => r.status === 200,
    'list has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined || Array.isArray(body);
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!listSuccess);

  sleep(1);

  // Test document search
  const searchRes = http.get(`${BASE_URL}/api/documents?search=test&page=1&limit=20`, {
    headers,
  });

  const searchSuccess = check(searchRes, {
    'search status is 200': (r) => r.status === 200,
  });

  errorRate.add(!searchSuccess);

  sleep(1);
}



