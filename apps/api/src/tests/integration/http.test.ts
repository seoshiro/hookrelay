import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FRONTEND, makeApp, METRICS_TOKEN, resetDb, TEST_DB } from './helpers.ts';

describe.skipIf(!TEST_DB)('http surface', async () => {
  const { app, db } = TEST_DB ? await makeApp() : ({} as Awaited<ReturnType<typeof makeApp>>);

  beforeEach(() => resetDb(db));
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it('health reports a live database', async () => {
    const res = await app.inject('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'connected' });
  });

  it('protects /metrics with a bearer token', async () => {
    expect((await app.inject('/metrics')).statusCode).toBe(401);
    expect((await app.inject({ url: '/metrics', headers: { authorization: 'Bearer wrong-token-xx' } })).statusCode).toBe(401);
    const ok = await app.inject({ url: '/metrics', headers: { authorization: `Bearer ${METRICS_TOKEN}` } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain('hookrelay_queue_depth');
    expect(ok.body).toContain('hookrelay_delivery_duration_ms_bucket');
  });

  it('allows CORS only for the configured frontend', async () => {
    const good = await app.inject({ url: '/api/health', headers: { origin: FRONTEND } });
    expect(good.headers['access-control-allow-origin']).toBe(FRONTEND);
    const evil = await app.inject({ url: '/api/health', headers: { origin: 'https://evil.example' } });
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    const localhost = await app.inject({ url: '/api/health', headers: { origin: 'http://localhost:5173' } });
    expect(localhost.headers['access-control-allow-origin']).toBeUndefined(); // ALLOW_LOCALHOST_ORIGINS is off
  });

  it('rate-limits login after 10 attempts', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: '203.0.113.9', payload: { email: 'x@example.com', password: 'wrong-password' } });
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes[10]).toBe(429);
  });

  it('shows an API key once and stores only its hash', async () => {
    const reg = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'keys@example.com', password: 'correct-horse-9' } });
    const cookies = { hr_session: reg.cookies.find((c) => c.name === 'hr_session')!.value };
    const created = await app.inject({ method: 'POST', url: '/api/api-keys', cookies, payload: { name: 'CI', scopes: ['read'] } });
    const secret = created.json().secret as string;
    expect(secret).toMatch(/^hr_live_[0-9a-f]{32}$/);
    const row = await db.apiKey.findFirstOrThrow();
    expect(row.keyHash).not.toContain(secret.slice(8));
    expect(JSON.stringify((await app.inject({ url: '/api/api-keys', cookies })).json())).not.toContain(secret);

    const viaKey = await app.inject({ url: '/api/sources', headers: { authorization: `Bearer ${secret}` } });
    expect(viaKey.statusCode).toBe(200);
  });

  it('rejects private targets when creating a source', async () => {
    const reg = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'ssrf@example.com', password: 'correct-horse-9' } });
    const cookies = { hr_session: reg.cookies.find((c) => c.name === 'hr_session')!.value };
    const res = await app.inject({ method: 'POST', url: '/api/sources', cookies, payload: { name: 'meta', targetUrl: 'http://169.254.169.254/latest' } });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('ssrf_private_ip');
  });

  it('runs the public sandbox end to end', async () => {
    const sim = await app.inject({ method: 'POST', url: '/api/sandbox/simulate', payload: { scenario: 'ok_payment' } });
    expect(sim.statusCode).toBe(202);
    const id = sim.json().eventId as string;
    for (let i = 0; i < 50; i++) {
      const e = await db.webhookEvent.findUniqueOrThrow({ where: { id } });
      if (e.status === 'DELIVERED') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const detail = await app.inject(`/api/events/${id}`);
    expect(detail.json().event).toMatchObject({ status: 'DELIVERED', signatureVerified: true });
  });
});
