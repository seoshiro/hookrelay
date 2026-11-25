import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { Agent, request } from 'undici';
import { assertPublicUrl, isPrivateAddress, SsrfError } from '../security/ssrfGuard.ts';

export interface DeliveryRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

export interface DeliveryResult {
  status: number | null;
  body: string;
  latencyMs: number;
  error: string | null;
  category: 'ok' | 'upstream5xx' | 'client4xx' | 'redirect' | 'timeout' | 'ssrfDns' | 'network';
}

export const MAX_RESPONSE_BYTES = 4096;

/**
 * Connection-time guard: every socket re-checks the resolved address, so a DNS answer that
 * flips to 127.0.0.1 after validation (rebinding) is still refused.
 */
const guardedAgent = new Agent({
  connect: {
    lookup(hostname, options, cb) {
      dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return cb(err, '', 0);
        const list = addresses as unknown as LookupAddress[];
        const bad = list.find((a) => isPrivateAddress(a.address));
        if (bad) return cb(new SsrfError(`${hostname} resolved to private address ${bad.address}`, 'PRIVATE_IP'), '', 0);
        const first = list[0]!;
        if ((options as { all?: boolean }).all) (cb as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
        else cb(null, first.address, first.family);
      });
    },
  },
});

export type Deliver = (req: DeliveryRequest) => Promise<DeliveryResult>;

export const deliverHttp: Deliver = async ({ url, headers, body, timeoutMs }) => {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    await assertPublicUrl(url);
    const res = await request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'HookRelay/1.0', ...headers },
      body,
      dispatcher: guardedAgent,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      signal: AbortSignal.timeout(timeoutMs),
      // undici.request never follows redirects; a 3xx is recorded as a failure, not chased.
    });
    const text = await readCapped(res.body);
    const status = res.statusCode;
    const category = status < 300 ? 'ok' : status < 400 ? 'redirect' : status < 500 ? 'client4xx' : 'upstream5xx';
    return { status, body: text, latencyMs: elapsed(), error: category === 'ok' ? null : `HTTP ${status}`, category };
  } catch (err) {
    const e = err as Error & { code?: string; cause?: unknown };
    const ssrf = e instanceof SsrfError || e.cause instanceof SsrfError;
    const timeout = e.name === 'TimeoutError' || e.code === 'UND_ERR_HEADERS_TIMEOUT' || e.code === 'UND_ERR_BODY_TIMEOUT';
    const dns = e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN';
    return {
      status: null,
      body: '',
      latencyMs: elapsed(),
      error: ssrf ? `SSRF guard: ${(e.cause instanceof SsrfError ? e.cause : e).message}` : timeout ? `Timed out after ${timeoutMs}ms` : e.message,
      category: ssrf || dns ? 'ssrfDns' : timeout ? 'timeout' : 'network',
    };
  }
};

async function readCapped(stream: AsyncIterable<Buffer>): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    if (size < MAX_RESPONSE_BYTES) chunks.push(chunk);
    size += chunk.length; // keep draining so the socket can be reused
  }
  return Buffer.concat(chunks).subarray(0, MAX_RESPONSE_BYTES).toString('utf8');
}
