import { randomBytes } from 'node:crypto';
import { loadEnv } from '../../config/env.ts';
import { createDb, type Db } from '../../db/client.ts';
import { buildApp } from '../../app.ts';
import { generateSecret } from '../../security/hmac.ts';
import type { Deliver } from '../../queue/delivery.ts';

const ok200: Deliver = async () => ({ status: 200, body: 'ok', latencyMs: 5, error: null, category: 'ok' });
let current: Deliver = ok200;
/** Swaps what the app's worker does on delivery; reset to 200 OK between tests. */
export const setDeliver = (d: Deliver = ok200) => {
  current = d;
};

export const TEST_DB = process.env.TEST_DATABASE_URL;
export const FRONTEND = 'https://hookrelay.example';
export const METRICS_TOKEN = 'test-metrics-token';

export const env = () =>
  loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DB,
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    METRICS_TOKEN,
    FRONTEND_URL: FRONTEND,
    PUBLIC_API_URL: 'http://localhost:8080',
    LOG_LEVEL: 'silent',
  });

export async function makeApp() {
  const db = createDb(TEST_DB!);
  const built = await buildApp(env(), db, { logger: false, deliver: (req) => current(req) });
  return { ...built, db };
}

export async function resetDb(db: Db) {
  await db.$executeRawUnsafe('TRUNCATE "DeliveryAttempt", "WebhookEvent", "Endpoint", "Source", "ApiKey", "User" CASCADE');
}

/** A real (non-sandbox) source pointing at a fake host; delivery is stubbed in tests, so DNS never runs. */
export async function seedSource(db: Db, opts: { userId?: string; maxAttempts?: number } = {}) {
  return db.source.create({
    data: {
      userId: opts.userId ?? null,
      name: 'Test source',
      ingestKey: `src_test_${randomBytes(6).toString('hex')}`,
      signingSecret: generateSecret(),
      endpoints: { create: { targetUrl: 'https://receiver.example/hook', maxAttempts: opts.maxAttempts ?? 3 } },
    },
    include: { endpoints: true },
  });
}

/** Pretends the backoff delay elapsed. */
export async function makeDue(db: Db) {
  await db.webhookEvent.updateMany({ where: { status: { in: ['PENDING', 'RETRYING'] } }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
}
