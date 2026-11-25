import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSourceSchema, updateSourceSchema } from '@hookrelay/shared';
import type { AppContext } from '../app.ts';
import { HttpError, requireViewer } from '../security/auth.ts';
import { assertPublicUrl, SsrfError } from '../security/ssrfGuard.ts';
import { generateSecret } from '../security/hmac.ts';
import { generateIngestKey } from '../security/apiKey.ts';
import { maskToken, sendTelegram } from '../alerts/telegram.ts';
import { scheduleLabels } from '../queue/backoff.ts';
import type { Endpoint, Source } from '../generated/prisma/client.ts';

export function sourceView(ctx: AppContext, s: Source & { endpoints: Endpoint[] }) {
  const ep = s.endpoints[0];
  return {
    id: s.id,
    name: s.name,
    provider: s.provider,
    isSandbox: s.isSandbox,
    ingestUrl: `${ctx.env.PUBLIC_API_URL}/api/ingest/${s.ingestKey}`,
    signingSecretPreview: `${s.signingSecret.slice(0, 10)}${'•'.repeat(18)}`,
    createdAt: s.createdAt.toISOString(),
    endpoint: ep && {
      id: ep.id,
      targetUrl: ep.targetUrl,
      maxAttempts: ep.maxAttempts,
      timeoutMs: ep.timeoutMs,
      enabled: ep.enabled,
      retrySchedule: scheduleLabels(ep.maxAttempts, s.isSandbox),
      telegram: { configured: !!(ep.telegramBotToken && ep.telegramChatId), botToken: maskToken(ep.telegramBotToken), chatId: ep.telegramChatId },
    },
  };
}

async function checkTarget(url: string) {
  try {
    const { addresses } = await assertPublicUrl(url);
    return { ok: true as const, addresses };
  } catch (err) {
    if (err instanceof SsrfError) return { ok: false as const, code: err.code, message: err.message };
    throw err;
  }
}

const idParam = z.object({ id: z.string().min(1) });

export async function sourceRoutes(app: FastifyInstance, ctx: AppContext) {
  const owned = async (userId: string, id: string) => {
    const source = await ctx.db.source.findFirst({ where: { id, userId }, include: { endpoints: true } });
    if (!source) throw new HttpError(404, 'Source not found', 'not_found');
    return source;
  };

  app.post('/api/endpoints/check', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const { url } = z.object({ url: z.string().max(2048) }).parse(req.body);
    return checkTarget(url);
  });

  app.get('/api/sources', async (req) => {
    const viewer = await requireViewer(req, ctx.db, 'read');
    const sources = await ctx.db.source.findMany({ where: { userId: viewer.userId }, include: { endpoints: true }, orderBy: { createdAt: 'desc' } });
    return { sources: sources.map((s) => sourceView(ctx, s)) };
  });

  app.post('/api/sources', async (req, reply) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const body = createSourceSchema.parse(req.body);
    const check = await checkTarget(body.targetUrl);
    if (!check.ok) throw new HttpError(422, check.message, `ssrf_${check.code.toLowerCase()}`);
    const source = await ctx.db.source.create({
      data: {
        userId: viewer.userId,
        name: body.name,
        provider: body.provider,
        ingestKey: generateIngestKey(),
        signingSecret: generateSecret(),
        endpoints: { create: { targetUrl: body.targetUrl, maxAttempts: body.maxAttempts, timeoutMs: body.timeoutMs } },
      },
      include: { endpoints: true },
    });
    return reply.status(201).send({ source: sourceView(ctx, source), signingSecret: source.signingSecret });
  });

  app.patch('/api/sources/:id', async (req) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const { id } = idParam.parse(req.params);
    const body = updateSourceSchema.parse(req.body);
    const source = await owned(viewer.userId, id);
    if (body.targetUrl) {
      const check = await checkTarget(body.targetUrl);
      if (!check.ok) throw new HttpError(422, check.message, `ssrf_${check.code.toLowerCase()}`);
    }
    const { name, ...endpoint } = body;
    const updated = await ctx.db.source.update({
      where: { id: source.id },
      data: { ...(name ? { name } : {}), endpoints: source.endpoints[0] ? { update: { where: { id: source.endpoints[0].id }, data: endpoint } } : undefined },
      include: { endpoints: true },
    });
    return { source: sourceView(ctx, updated) };
  });

  app.delete('/api/sources/:id', async (req, reply) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const { id } = idParam.parse(req.params);
    await owned(viewer.userId, id);
    await ctx.db.source.delete({ where: { id } });
    return reply.status(204).send();
  });

  app.post('/api/sources/:id/rotate-secret', async (req) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const { id } = idParam.parse(req.params);
    await owned(viewer.userId, id);
    const updated = await ctx.db.source.update({ where: { id }, data: { signingSecret: generateSecret() } });
    return { signingSecret: updated.signingSecret };
  });

  app.post('/api/sources/:id/reveal-secret', async (req) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const { id } = idParam.parse(req.params);
    return { signingSecret: (await owned(viewer.userId, id)).signingSecret };
  });

  app.post('/api/endpoints/:id/test-telegram', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const { id } = idParam.parse(req.params);
    const ep = await ctx.db.endpoint.findFirst({ where: { id, source: { userId: viewer.userId } } });
    if (!ep) throw new HttpError(404, 'Endpoint not found', 'not_found');
    if (!ep.telegramBotToken || !ep.telegramChatId) throw new HttpError(422, 'Telegram bot token and chat id are not set', 'telegram_not_configured');
    const res = await sendTelegram({ botToken: ep.telegramBotToken, chatId: ep.telegramChatId }, '<b>HookRelay</b> · test alert. Dead-letter alerts will arrive here.');
    if (!res.ok) throw new HttpError(502, `Telegram rejected the message: ${res.error}`, 'telegram_failed');
    return { ok: true };
  });
}
