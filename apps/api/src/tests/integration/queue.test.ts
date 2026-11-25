import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../db/client.ts';
import { EventBus } from '../../sse/eventBus.ts';
import { Metrics } from '../../metrics/registry.ts';
import { Worker } from '../../queue/worker.ts';
import type { Deliver } from '../../queue/delivery.ts';
import { verify } from '../../security/hmac.ts';
import { makeApp, makeDue, resetDb, seedSource, setDeliver, TEST_DB } from './helpers.ts';

const silentLog = { error() {}, warn() {}, info() {}, debug() {} } as never;

describe.skipIf(!TEST_DB)('postgres queue', async () => {
  const { app, ctx, db } = TEST_DB ? await makeApp() : ({} as Awaited<ReturnType<typeof makeApp>>);

  beforeEach(async () => {
    await ctx.worker.idle();
    setDeliver();
    await resetDb(db);
  });
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it('two concurrent workers deliver 10 events exactly once (SKIP LOCKED)', async () => {
    const source = await seedSource(db);
    for (let i = 0; i < 10; i++) {
      await app.inject({ method: 'POST', url: `/api/ingest/${source.ingestKey}`, payload: { type: 'order.created', n: i } });
    }
    await ctx.worker.idle(); // let the ingest nudges finish; the race below uses two fresh workers

    await db.webhookEvent.updateMany({ data: { status: 'PENDING', attemptCount: 0, nextAttemptAt: new Date(Date.now() - 1000) } });
    await db.deliveryAttempt.deleteMany();

    const calls = new Map<string, number>();
    const slowOk: Deliver = async (req) => {
      const id = req.headers['x-hookrelay-event-id']!;
      calls.set(id, (calls.get(id) ?? 0) + 1);
      await new Promise((r) => setTimeout(r, 40));
      return { status: 200, body: 'ok', latencyMs: 40, error: null, category: 'ok' };
    };
    const dbA = createDb(TEST_DB!);
    const dbB = createDb(TEST_DB!);
    const mk = (d: typeof db) => new Worker({ db: d, bus: new EventBus(), metrics: new Metrics(), log: silentLog, deliver: slowOk, batchSize: 3 });
    const [a, b] = await Promise.all([mk(dbA).tick(), mk(dbB).tick()]);

    expect(a + b).toBe(10);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect([...calls.values()].every((n) => n === 1)).toBe(true);
    expect(calls.size).toBe(10);
    expect(await db.deliveryAttempt.count()).toBe(10);
    expect(await db.webhookEvent.count({ where: { status: 'DELIVERED' } })).toBe(10);
    await Promise.all([dbA.$disconnect(), dbB.$disconnect()]);
  });

  it('deduplicates by Idempotency-Key', async () => {
    const source = await seedSource(db);
    const send = () =>
      app.inject({ method: 'POST', url: `/api/ingest/${source.ingestKey}`, headers: { 'idempotency-key': 'order-42' }, payload: { type: 'payment.succeeded' } });
    const first = await send();
    const second = await send();
    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ deduplicated: true, eventId: first.json().eventId });
    expect(await db.webhookEvent.count()).toBe(1);
  });

  it('500 → retries → DLQ → replay → 200 OK, with signed requests', async () => {
    const register = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'ops@example.com', password: 'correct-horse-9' } });
    const cookie = register.cookies.find((c) => c.name === 'hr_session')!;
    const userId = register.json().user.id as string;
    const source = await seedSource(db, { userId, maxAttempts: 3 });

    let healthy = false;
    const seen: Record<string, string>[] = [];
    const flaky: Deliver = async (req) => {
      seen.push(req.headers);
      return healthy
        ? { status: 200, body: '{"ok":true}', latencyMs: 12, error: null, category: 'ok' }
        : { status: 500, body: '{"error":"boom"}', latencyMs: 12, error: 'HTTP 500', category: 'upstream5xx' };
    };
    setDeliver(flaky);
    const worker = ctx.worker;

    const ingest = await app.inject({ method: 'POST', url: `/api/ingest/${source.ingestKey}`, payload: { type: 'invoice.paid' } });
    const eventId = ingest.json().eventId as string;
    await worker.idle(); // the ingest nudge makes attempt #1
    expect((await db.webhookEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe('RETRYING');

    for (const expected of ['RETRYING', 'DLQ']) {
      await makeDue(db);
      await worker.tick();
      expect((await db.webhookEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe(expected);
    }

    const sig = seen[0]!;
    const raw = (await db.webhookEvent.findUniqueOrThrow({ where: { id: eventId } })).rawBody;
    const now = Number(sig['x-hookrelay-timestamp']) * 1000;
    expect(verify(source.signingSecret, { timestamp: sig['x-hookrelay-timestamp'], signature: sig['x-hookrelay-signature'] }, raw, now).ok).toBe(true);

    const anon = await app.inject({ method: 'POST', url: `/api/events/${eventId}/replay` });
    expect(anon.statusCode).toBe(404); // not sandbox, not yours

    healthy = true;
    const replay = await app.inject({ method: 'POST', url: `/api/events/${eventId}/replay`, cookies: { hr_session: cookie.value } });
    expect(replay.statusCode).toBe(202);
    await worker.idle();
    await worker.tick();

    const final = await db.webhookEvent.findUniqueOrThrow({ where: { id: eventId }, include: { attempts: true } });
    expect(final.status).toBe('DELIVERED');
    expect(final.lastStatusCode).toBe(200);
    expect(final.attempts).toHaveLength(4);
  });

  it('returns stuck PROCESSING events to the queue', async () => {
    const source = await seedSource(db);
    await app.inject({ method: 'POST', url: `/api/ingest/${source.ingestKey}`, payload: { type: 'x' } });
    await ctx.worker.idle();
    await db.webhookEvent.updateMany({ data: { status: 'PROCESSING', lockedAt: new Date(Date.now() - 120_000) } });
    const { recoverStuck } = await import('../../queue/worker.ts');
    expect(await recoverStuck(db)).toBe(1);
    expect((await db.webhookEvent.findFirstOrThrow()).status).toBe('RETRYING');
  });
});

