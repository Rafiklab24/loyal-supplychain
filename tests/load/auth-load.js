import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { sharedOptions, getBaseUrl, getAuthCredentials } from './k6.config.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    ...sharedOptions.thresholds,
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
  },
};

const BASE_URL = getBaseUrl();

export default function () {
  const credentials = getAuthCredentials();
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(credentials),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const success = check(loginRes, {
    'status is 200': (r) => r.status === 200,
    'has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  sleep(1);
}

