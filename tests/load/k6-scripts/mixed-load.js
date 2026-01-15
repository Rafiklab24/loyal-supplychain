import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Simulate realistic user behavior mix
export default function () {
  const endpoints = [
    { method: 'GET', path: '/api/shipments?page=1&limit=20', weight: 40 },
    { method: 'GET', path: '/api/contracts?page=1&limit=20', weight: 30 },
    { method: 'GET', path: '/api/companies', weight: 15 },
    { method: 'GET', path: '/api/ports', weight: 10 },
    { method: 'GET', path: '/api/notifications', weight: 5 },
  ];

  // Weighted random selection
  const random = Math.random() * 100;
  let cumulative = 0;
  let selected = endpoints[0];
  
  for (const endpoint of endpoints) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      selected = endpoint;
      break;
    }
  }

  const res = http.request(selected.method, `${BASE_URL}${selected.path}`, null, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const success = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  errorRate.add(!success);

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

