import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { getBaseUrl, getAuthCredentials } from './k6.config.js';

const errorRate = new Rate('errors');

/**
 * Spike Test - Tests system recovery from sudden load spikes
 * Simulates sudden traffic increase (e.g., marketing campaign, news event)
 */
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Normal load
    { duration: '30s', target: 500 },  // Sudden spike
    { duration: '1m', target: 500 },   // Maintain spike
    { duration: '30s', target: 50 },   // Sudden drop
    { duration: '1m', target: 50 },   // Recovery
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // More lenient for spike
    http_req_failed: ['rate<0.10'],     // Allow up to 10% errors during spike
    errors: ['rate<0.10'],
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

  // Test critical endpoints during spike
  const endpoints = [
    `${BASE_URL}/api/shipments?page=1&limit=20`,
    `${BASE_URL}/api/contracts?page=1&limit=20`,
    `${BASE_URL}/api/auth/login`, // Some users might be logging in
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  let res;
  if (endpoint.includes('/login')) {
    // For login endpoint, use POST
    res = http.post(endpoint, JSON.stringify(getAuthCredentials()), {
      headers: { 'Content-Type': 'application/json' },
    });
  } else {
    res = http.get(endpoint, { headers });
  }

  const success = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  errorRate.add(!success);

  sleep(Math.random() * 0.5 + 0.1); // Short sleep during spike
}



