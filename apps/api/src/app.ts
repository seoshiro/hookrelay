import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import type { Env } from './config/env.ts';
import type { Db } from './db/client.ts';
import { EventBus } from './sse/eventBus.ts';
import { Metrics } from './metrics/registry.ts';
import { Worker } from './queue/worker.ts';
import type { Deliver } from './queue/delivery.ts';
import { HttpError, SESSION_COOKIE } from './security/auth.ts';
import { healthRoutes } from './routes/health.ts';
import { authRoutes } from './routes/auth.ts';
import { sourceRoutes } from './routes/sources.ts';
import { ingestRoutes } from './routes/ingest.ts';
import { eventRoutes } from './routes/events.ts';
import { streamRoutes } from './routes/stream.ts';
import { summaryRoutes } from './routes/summary.ts';
import { apiKeyRoutes } from './routes/apiKeys.ts';
import { sandboxRoutes } from './routes/sandbox.ts';

export interface AppContext {
  env: Env;
  db: Db;
  bus: EventBus;
  metrics: Metrics;
  worker: Worker;
  startedAt: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export function allowedOrigin(env: Env, origin: string | undefined): boolean {
  if (!origin) return true; // same-origin, curl, server-to-server
  if (origin === env.FRONTEND_URL) return true;
  return env.ALLOW_LOCALHOST_ORIGINS && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export async function buildApp(env: Env, db: Db, opts: { logger?: boolean; deliver?: Deliver } = {}): Promise<{ app: FastifyInstance; ctx: AppContext }> {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] },
    trustProxy: true,
    bodyLimit: 512 * 1024,
  });
  const bus = new EventBus();
  const metrics = new Metrics();
  const worker = new Worker({ db, bus, metrics, log: app.log, ...(opts.deliver ? { deliver: opts.deliver } : {}) });
  const ctx: AppContext = { env, db, bus, metrics, worker, startedAt: Date.now() };

  // keep the exact bytes: HMAC signatures are computed over the raw body, not a re-serialised one
  app.addContentTypeParser(['application/json', 'text/plain'], { parseAs: 'string' }, (req, body, done) => {
    const raw = body as string;
    req.rawBody = raw;
    if (!req.headers['content-type']?.includes('json')) return done(null, raw);
    try {
      done(null, raw.length ? JSON.parse(raw) : {});
    } catch {
      done(new HttpError(400, 'Body is not valid JSON', 'invalid_json'), undefined);
    }
  });

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, {
    credentials: true,
    origin: (origin, cb) => cb(null, allowedOrigin(env, origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.register(cookie);
  await app.register(jwt, { secret: env.JWT_SECRET, cookie: { cookieName: SESSION_COOKIE, signed: false }, sign: { expiresIn: '7d' } });
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'validation_failed', message: 'Request is invalid', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, 'unhandled error');
    return reply.status(status).send({ error: status === 429 ? 'rate_limited' : 'error', message: status >= 500 ? 'Internal error' : (err as Error).message });
  });

  for (const register of [healthRoutes, authRoutes, sourceRoutes, ingestRoutes, eventRoutes, streamRoutes, summaryRoutes, apiKeyRoutes, sandboxRoutes]) {
    await register(app, ctx);
  }
  return { app, ctx };
}
