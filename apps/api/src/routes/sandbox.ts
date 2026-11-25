import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { scenarioSchema, type Scenario } from '@hookrelay/shared';
import type { AppContext } from '../app.ts';
import { generateSecret } from '../security/hmac.ts';
import { SANDBOX_RECEIVER_PATH } from '../queue/sandboxReceiver.ts';
import { enqueue } from './ingest.ts';
import { HEALTHY_RECEIVER, requeue } from './events.ts';
import { sourceView } from './sources.ts';

export const SANDBOX_INGEST_KEY = 'src_sbx_public';
const SANDBOX_MAX_ATTEMPTS = 3;
const SANDBOX_TTL_MS = 2 * 60 * 60_000;

/** Idempotently creates the shared public sandbox source and its in-process receiver endpoint. */
export async function ensureSandbox(ctx: AppContext) {
  const targetUrl = `${ctx.env.PUBLIC_API_URL}${SANDBOX_RECEIVER_PATH}`;
  const source = await ctx.db.source.upsert({
    where: { ingestKey: SANDBOX_INGEST_KEY },
    update: {},
    create: { name: 'Public sandbox', provider: 'stripe', ingestKey: SANDBOX_INGEST_KEY, signingSecret: generateSecret(), isSandbox: true },
    include: { endpoints: true },
  });
  if (source.endpoints[0]?.targetUrl === targetUrl) return { source, endpoint: source.endpoints[0] };
  await ctx.db.endpoint.deleteMany({ where: { sourceId: source.id } });
  const endpoint = await ctx.db.endpoint.create({ data: { sourceId: source.id, targetUrl, maxAttempts: SANDBOX_MAX_ATTEMPTS, timeoutMs: 3000 } });
  return { source: { ...source, endpoints: [endpoint] }, endpoint };
}

function samplePayload(scenario: Scenario, id: string) {
  const amount = 1200 + Math.floor(Math.random() * 48_000);
  const types: Record<Scenario, string> = { ok_payment: 'payment.succeeded', fail_500_to_dlq: 'invoice.payment_failed', flaky_recover: 'customer.subscription.updated' };
  return {
    id: `evt_src_${id}`,
    object: 'event',
    type: types[scenario],
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: `py_${randomBytes(6).toString('hex')}`, amount, currency: 'usd', customer: `cus_${randomBytes(5).toString('hex')}` } },
  };
}

export async function sandboxRoutes(app: FastifyInstance, ctx: AppContext) {
  let sandbox = await ensureSandbox(ctx);

  const cleanup = setInterval(() => {
    ctx.db.webhookEvent
      .deleteMany({ where: { source: { isSandbox: true }, createdAt: { lt: new Date(Date.now() - SANDBOX_TTL_MS) } } })
      .catch((err) => app.log.warn({ err }, 'sandbox cleanup failed'));
  }, 10 * 60_000);
  app.addHook('onClose', async () => clearInterval(cleanup));

  app.get('/api/sandbox', async () => ({ source: sourceView(ctx, sandbox.source) }));

  // documented target for the sandbox; real sandbox deliveries are answered in-process (see sandboxReceiver.ts)
  app.post(SANDBOX_RECEIVER_PATH, async () => ({ received: true }));

  app.post('/api/sandbox/simulate', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { scenario } = z.object({ scenario: scenarioSchema }).parse(req.body);
    sandbox = await ensureSandbox(ctx);
    const payload = samplePayload(scenario, randomBytes(4).toString('hex'));
    const rawBody = JSON.stringify(payload);
    const result = await enqueue(ctx, {
      sourceId: sandbox.source.id,
      endpointId: sandbox.endpoint.id,
      maxAttempts: SANDBOX_MAX_ATTEMPTS,
      isSandbox: true,
      ownerId: null,
      rawBody,
      payload,
      headers: { 'content-type': 'application/json', 'x-sandbox-scenario': scenario },
      eventType: payload.type,
      idempotencyKey: `idk_${randomBytes(6).toString('hex')}`,
    });
    return reply.status(202).send(result);
  });

  app.post('/api/sandbox/replay-all', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (_req, reply) => {
    // replays flip the receiver to healthy so the visitor sees recovery, not the same failure again
    const ids = await requeue(ctx, { status: 'DLQ', source: { isSandbox: true } }, HEALTHY_RECEIVER);
    return reply.status(202).send({ replayed: ids.length, eventIds: ids });
  });
}
