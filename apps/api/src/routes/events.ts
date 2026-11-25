import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { bulkReplaySchema, eventsQuerySchema, type EventDetail } from '@hookrelay/shared';
import type { AppContext } from '../app.ts';
import { HttpError } from '../security/auth.ts';
import { verify } from '../security/hmac.ts';
import { canAccess, resolveScope } from '../lib/scope.ts';
import { eventInclude, toAttempt, toSummary } from '../lib/serialize.ts';
import type { Prisma } from '../generated/prisma/client.ts';

/** Puts events back on the queue with a fresh attempt budget, in one statement. */
export async function requeue(ctx: AppContext, where: Prisma.WebhookEventWhereInput, extraHeaders?: Record<string, string>): Promise<string[]> {
  const targets = await ctx.db.webhookEvent.findMany({ where, select: { id: true, headers: true }, take: 500 });
  if (targets.length === 0) return [];
  const ids = targets.map((t) => t.id);
  await ctx.db.$transaction(async (tx) => {
    await tx.webhookEvent.updateMany({
      where: { id: { in: ids }, status: { not: 'PROCESSING' } },
      data: { status: 'PENDING', attemptCount: 0, nextAttemptAt: new Date(), lockedAt: null, deliveredAt: null },
    });
    if (extraHeaders) {
      for (const t of targets) {
        await tx.webhookEvent.update({ where: { id: t.id }, data: { headers: { ...(t.headers as Record<string, string>), ...extraHeaders } } });
      }
    }
  });
  const updated = await ctx.db.webhookEvent.findMany({ where: { id: { in: ids } }, include: eventInclude });
  for (const e of updated) ctx.bus.publish({ type: 'event.updated', event: toSummary(e), sandbox: e.source.isSandbox, ownerId: e.source.userId });
  ctx.worker.nudge();
  return ids;
}

export async function eventRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get('/api/events', async (req) => {
    const q = eventsQuerySchema.parse(req.query);
    const { sourceWhere } = await resolveScope(req, ctx.db, q.sandbox);
    const where: Prisma.WebhookEventWhereInput = {
      source: sourceWhere,
      ...(q.status ? { status: q.status } : {}),
      ...(q.sourceId ? { sourceId: q.sourceId } : {}),
      ...(q.search ? { OR: [{ id: { contains: q.search } }, { eventType: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const rows = await ctx.db.webhookEvent.findMany({
      where,
      include: eventInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, q.limit);
    return { events: page.map(toSummary), nextCursor: rows.length > q.limit ? (page.at(-1)?.id ?? null) : null };
  });

  app.get('/api/events/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { viewer } = await resolveScope(req, ctx.db, true);
    const e = await ctx.db.webhookEvent.findUnique({
      where: { id },
      include: { ...eventInclude, source: { select: { isSandbox: true, userId: true, signingSecret: true } }, attempts: { orderBy: { attemptNumber: 'asc' } } },
    });
    if (!e || !canAccess(e.source, viewer?.userId)) throw new HttpError(404, 'Event not found', 'not_found');
    const last = e.attempts.at(-1);
    const sent = last?.requestHeaders as Record<string, string> | undefined;
    const ts = Number(sent?.['x-hookrelay-timestamp']);
    // re-verify what we actually sent, at the time we sent it
    const signatureVerified = !!sent && verify(e.source.signingSecret, { timestamp: sent['x-hookrelay-timestamp'], signature: sent['x-hookrelay-signature'] }, e.rawBody, ts * 1000).ok;
    const detail: EventDetail = {
      ...toSummary(e),
      headers: e.headers as Record<string, string>,
      payload: e.payload,
      signatureVerified,
      attempts: e.attempts.map(toAttempt),
    };
    return { event: detail };
  });

  app.post('/api/events/:id/replay', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { viewer } = await resolveScope(req, ctx.db, true);
    const e = await ctx.db.webhookEvent.findUnique({ where: { id }, select: { status: true, source: { select: { isSandbox: true, userId: true } } } });
    if (!e || !canAccess(e.source, viewer?.userId)) throw new HttpError(404, 'Event not found', 'not_found');
    if (e.status === 'PROCESSING') throw new HttpError(409, 'Event is being delivered right now', 'in_flight');
    await requeue(ctx, { id }, e.source.isSandbox ? { 'x-sandbox-receiver': 'healthy' } : undefined);
    return reply.status(202).send({ eventId: id, status: 'PENDING' });
  });

  app.post('/api/dlq/replay-bulk', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = bulkReplaySchema.parse(req.body);
    const sandbox = (req.query as { sandbox?: string }).sandbox === 'true' ? true : undefined;
    const { sourceWhere, sandbox: isSandbox } = await resolveScope(req, ctx.db, sandbox);
    if (!body.all && !body.eventIds?.length) throw new HttpError(400, 'Pass eventIds or all: true', 'nothing_to_replay');
    const ids = await requeue(
      ctx,
      { status: 'DLQ', source: sourceWhere, ...(body.all ? {} : { id: { in: body.eventIds! } }) },
      isSandbox ? { 'x-sandbox-receiver': 'healthy' } : undefined,
    );
    return reply.status(202).send({ replayed: ids.length, eventIds: ids });
  });
}
