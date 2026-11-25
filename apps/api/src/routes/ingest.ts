import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../app.ts';
import { HttpError } from '../security/auth.ts';
import { newEventId } from '../security/apiKey.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { eventInclude, toSummary } from '../lib/serialize.ts';

const FORWARDED_HEADERS = ['content-type', 'user-agent', 'stripe-signature', 'x-github-event', 'x-github-delivery', 'x-hub-signature-256', 'x-telegram-bot-api-secret-token'];

export interface IngestInput {
  sourceId: string;
  endpointId: string;
  maxAttempts: number;
  isSandbox: boolean;
  ownerId: string | null;
  rawBody: string;
  payload: unknown;
  headers: Record<string, string>;
  eventType: string;
  idempotencyKey: string | null;
}

export function inferEventType(payload: unknown, headers: Record<string, string>): string {
  const p = payload as Record<string, unknown> | null;
  if (typeof p?.type === 'string') return p.type.slice(0, 120); // Stripe, most SaaS
  if (headers['x-github-event']) return `github.${headers['x-github-event']}`;
  if (p && typeof p === 'object' && 'update_id' in p) return 'telegram.update';
  if (typeof p?.event === 'string') return p.event.slice(0, 120);
  return 'webhook.received';
}

/** Persists an event. Dedup is enforced by the (sourceId, idempotencyKey) unique index, not a read-then-write race. */
export async function enqueue(ctx: AppContext, input: IngestInput) {
  try {
    const event = await ctx.db.webhookEvent.create({
      data: {
        id: newEventId(),
        sourceId: input.sourceId,
        endpointId: input.endpointId,
        idempotencyKey: input.idempotencyKey,
        eventType: input.eventType,
        headers: input.headers,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        rawBody: input.rawBody,
        maxAttempts: input.maxAttempts,
      },
      include: eventInclude,
    });
    ctx.metrics.incEvent('PENDING');
    ctx.bus.publish({ type: 'event.updated', event: toSummary(event), sandbox: input.isSandbox, ownerId: input.ownerId });
    ctx.worker.nudge();
    return { deduplicated: false as const, eventId: event.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && input.idempotencyKey) {
      const existing = await ctx.db.webhookEvent.findUniqueOrThrow({
        where: { sourceId_idempotencyKey: { sourceId: input.sourceId, idempotencyKey: input.idempotencyKey } },
        select: { id: true },
      });
      return { deduplicated: true as const, eventId: existing.id };
    }
    throw err;
  }
}

export async function ingestRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post(
    '/api/ingest/:ingestKey',
    {
      config: {
        rateLimit: { max: ctx.env.INGEST_RATE_LIMIT_PER_MIN, timeWindow: '1 minute', keyGenerator: (req) => (req.params as { ingestKey?: string }).ingestKey ?? req.ip },
      },
    },
    async (req, reply) => {
      const { ingestKey } = z.object({ ingestKey: z.string().min(8).max(64) }).parse(req.params);
      const source = await ctx.db.source.findUnique({ where: { ingestKey }, include: { endpoints: { where: { enabled: true }, take: 1 } } });
      const endpoint = source?.endpoints[0];
      if (!source || !endpoint) throw new HttpError(404, 'Unknown ingest key', 'not_found');

      const idem = req.headers['idempotency-key'];
      const idempotencyKey = typeof idem === 'string' && idem.length > 0 ? idem.slice(0, 200) : null;
      const headers = Object.fromEntries(FORWARDED_HEADERS.flatMap((h) => (typeof req.headers[h] === 'string' ? [[h, req.headers[h] as string]] : [])));
      const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
      const payload = typeof req.body === 'string' ? { raw: req.body } : req.body;

      const result = await enqueue(ctx, {
        sourceId: source.id,
        endpointId: endpoint.id,
        maxAttempts: endpoint.maxAttempts,
        isSandbox: source.isSandbox,
        ownerId: source.userId,
        rawBody,
        payload,
        headers,
        eventType: inferEventType(payload, headers),
        idempotencyKey,
      });
      return reply.status(result.deduplicated ? 200 : 202).send(result);
    },
  );
}
