import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { getBaseUrl, getAuthCredentials } from './k6.config.js';

const errorRate = new Rate('errors');

/**
 * Stress Test - Tests system limits
 * Gradually increases load to find breaking point
 */
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Warm up
    { duration: '2m', target: 100 },  // Normal load
    { duration: '2m', target: 200 },  // High load
    { duration: '2m', target: 300 },  // Very high load
    { duration: '2m', target: 400 },  // Extreme load
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // More lenient for stress test
    http_req_failed: ['rate<0.05'],    // Allow up to 5% errors under stress
    errors: ['rate<0.05'],
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

  // Mix of endpoints to simulate realistic stress
  const endpoints = [
    `${BASE_URL}/api/shipments?page=1&limit=20`,
    `${BASE_URL}/api/contracts?page=1&limit=20`,
    `${BASE_URL}/api/finance/transactions?page=1&limit=50`,
    `${BASE_URL}/api/notifications?limit=50`,
    `${BASE_URL}/api/companies`,
    `${BASE_URL}/api/ports`,
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(endpoint, { headers });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!success);

  sleep(Math.random() * 1 + 0.5); // Random sleep 0.5-1.5 seconds
}



