import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@hookrelay/shared';
import type { AppContext } from '../app.ts';
import { pingDb } from '../db/client.ts';

export async function queueDepth(ctx: AppContext): Promise<number> {
  return ctx.db.webhookEvent.count({ where: { status: { in: ['PENDING', 'RETRYING', 'PROCESSING'] } } });
}

function tokenMatches(given: string | undefined, expected: string): boolean {
  if (!given?.startsWith('Bearer ')) return false;
  const a = Buffer.from(given.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function healthRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get('/api/health', async (_req, reply) => {
    const db = await pingDb(ctx.db);
    const body: HealthResponse = {
      status: db ? 'ok' : 'degraded',
      db: db ? 'connected' : 'down',
      uptimeSec: Math.round((Date.now() - ctx.startedAt) / 1000),
      queueDepth: db ? await queueDepth(ctx) : -1,
    };
    return reply.status(db ? 200 : 503).send(body);
  });

  app.get('/metrics', async (req, reply) => {
    if (!tokenMatches(req.headers.authorization, ctx.env.METRICS_TOKEN)) {
      return reply.status(401).header('www-authenticate', 'Bearer').send({ error: 'unauthorized', message: 'Metrics token required' });
    }
    const depth = await queueDepth(ctx);
    return reply.type('text/plain; version=0.0.4').send(ctx.metrics.render(depth));
  });
}
