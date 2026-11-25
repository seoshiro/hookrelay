// k6 load test for the ingest path.
//   k6 run -e BASE_URL=http://localhost:8080 -e INGEST_KEY=src_sbx_public loadtest/ingest.js
// The API must run with INGEST_RATE_LIMIT_PER_MIN raised, otherwise the per-key limit (120/min) answers 429.
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const KEY = __ENV.INGEST_KEY || 'src_sbx_public';

export const options = {
  scenarios: {
    ingest: { executor: 'constant-vus', vus: Number(__ENV.VUS || 50), duration: __ENV.DURATION || '30s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<250'],
  },
};

export default function () {
  const body = JSON.stringify({ type: 'payment.succeeded', data: { amount: 4200, vu: __VU, iter: __ITER } });
  const res = http.post(`${BASE_URL}/api/ingest/${KEY}`, body, {
    headers: { 'content-type': 'application/json', 'idempotency-key': `k6-${__VU}-${__ITER}` },
  });
  check(res, { 'accepted (202)': (r) => r.status === 202 });
}
