import type { DeliveryRequest, DeliveryResult } from './delivery.ts';

export const SANDBOX_RECEIVER_PATH = '/api/sandbox/receiver';

/**
 * The sandbox target is answered in-process, never over the network: the SSRF guard stays
 * strict for every real endpoint, and sandbox traffic cannot be pointed anywhere else.
 * Behaviour is driven by headers stamped at simulation time.
 */
export async function sandboxReceive(req: DeliveryRequest, attemptNumber: number): Promise<DeliveryResult> {
  const scenario = req.headers['x-sandbox-scenario'];
  const healthy = req.headers['x-sandbox-receiver'] === 'healthy';
  const latencyMs = 18 + Math.round(Math.random() * 42);
  await new Promise((r) => setTimeout(r, latencyMs));

  const fail = !healthy && (scenario === 'fail_500_to_dlq' || (scenario === 'flaky_recover' && attemptNumber < 3));
  if (fail) {
    const status = attemptNumber % 2 === 0 ? 500 : 502;
    const body = JSON.stringify({ error: status === 500 ? 'internal_error' : 'bad_gateway', message: 'Sandbox receiver is down', attempt: attemptNumber });
    return { status, body, latencyMs, error: `HTTP ${status}`, category: 'upstream5xx' };
  }
  return { status: 200, body: JSON.stringify({ received: true, attempt: attemptNumber }), latencyMs, error: null, category: 'ok' };
}
