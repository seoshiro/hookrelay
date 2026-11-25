import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/client.ts';
import type { EventBus } from '../sse/eventBus.ts';
import type { Metrics } from '../metrics/registry.ts';
import { signatureHeaders } from '../security/hmac.ts';
import { nextDelayMs } from './backoff.ts';
import { deliverHttp, type Deliver, type DeliveryResult } from './delivery.ts';
import { sandboxReceive, SANDBOX_RECEIVER_PATH } from './sandboxReceiver.ts';
import { dlqAlertText, sendTelegram } from '../alerts/telegram.ts';
import { eventInclude, toAttempt, toSummary } from '../lib/serialize.ts';

export interface WorkerDeps {
  db: Db;
  bus: EventBus;
  metrics: Metrics;
  log: FastifyBaseLogger;
  deliver?: Deliver;
  batchSize?: number;
  pollMs?: number;
}

/** Atomically claims due events. SKIP LOCKED lets any number of workers run without double delivery. */
export async function claimBatch(db: Db, limit: number): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "WebhookEvent" SET status = 'PROCESSING', "lockedAt" = NOW(), "updatedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "WebhookEvent"
      WHERE status IN ('PENDING', 'RETRYING') AND "nextAttemptAt" <= NOW()
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows.map((r) => r.id);
}

/** Returns events stuck in PROCESSING (a worker died mid-delivery) to the retry queue. */
export async function recoverStuck(db: Db, olderThanSec = 60): Promise<number> {
  return db.$executeRaw`
    UPDATE "WebhookEvent" SET status = 'RETRYING', "lockedAt" = NULL, "nextAttemptAt" = NOW(), "updatedAt" = NOW()
    WHERE status = 'PROCESSING' AND "lockedAt" < NOW() - make_interval(secs => ${olderThanSec})`;
}

function outcomeStatus(ok: boolean, exhausted: boolean): 'DELIVERED' | 'DLQ' | 'RETRYING' {
  if (ok) return 'DELIVERED';
  if (exhausted) return 'DLQ';
  return 'RETRYING';
}

export async function processEvent(deps: WorkerDeps, id: string): Promise<void> {
  const { db, bus, metrics } = deps;
  const event = await db.webhookEvent.findUnique({
    where: { id },
    include: { endpoint: true, source: { select: { isSandbox: true, userId: true, signingSecret: true } } },
  });
  if (!event) return;

  const attemptNumber = event.attemptCount + 1;
  const requestHeaders: Record<string, string> = {
    ...signatureHeaders(event.source.signingSecret, event.id, event.rawBody),
    'x-hookrelay-attempt': String(attemptNumber),
    ...(event.idempotencyKey ? { 'idempotency-key': event.idempotencyKey } : {}),
  };
  const req = { url: event.endpoint.targetUrl, headers: requestHeaders, body: event.rawBody, timeoutMs: event.endpoint.timeoutMs };

  const isSandboxTarget = event.source.isSandbox && new URL(event.endpoint.targetUrl).pathname === SANDBOX_RECEIVER_PATH;
  const stored = event.headers as Record<string, string>;
  const result: DeliveryResult = isSandboxTarget
    ? await sandboxReceive({ ...req, headers: { ...stored, ...requestHeaders } }, attemptNumber)
    : await (deps.deliver ?? deliverHttp)(req);

  const ok = result.category === 'ok';
  const exhausted = !ok && attemptNumber >= event.maxAttempts;
  const status = outcomeStatus(ok, exhausted);
  const now = new Date();
  const nextAttemptAt = ok || exhausted ? now : new Date(now.getTime() + nextDelayMs(attemptNumber, { sandbox: event.source.isSandbox }));

  const [attempt, updated] = await db.$transaction([
    db.deliveryAttempt.create({
      data: {
        eventId: event.id,
        attemptNumber,
        requestHeaders,
        responseStatus: result.status,
        responseBody: result.body,
        latencyMs: result.latencyMs,
        errorMessage: result.error,
      },
    }),
    db.webhookEvent.update({
      where: { id: event.id },
      data: {
        status,
        attemptCount: attemptNumber,
        lockedAt: null,
        lastError: result.error,
        lastStatusCode: result.status,
        lastLatencyMs: result.latencyMs,
        deliveredAt: ok ? now : null,
        nextAttemptAt,
      },
      include: eventInclude,
    }),
  ]);

  metrics.observeDelivery(result.latencyMs);
  metrics.incEvent(status);
  const scope = { sandbox: event.source.isSandbox, ownerId: event.source.userId };
  bus.publish({ type: 'attempt.created', eventId: event.id, attempt: toAttempt(attempt), ...scope });
  bus.publish({ type: 'event.updated', event: toSummary(updated), ...scope });

  const { telegramBotToken: botToken, telegramChatId: chatId } = event.endpoint;
  if (status === 'DLQ' && botToken && chatId) {
    const text = dlqAlertText({ id: event.id, eventType: event.eventType, attempts: attemptNumber, lastStatusCode: result.status, targetUrl: event.endpoint.targetUrl });
    void sendTelegram({ botToken, chatId }, text).then((r) => {
      if (!r.ok) deps.log.warn({ eventId: event.id, err: r.error }, 'telegram alert failed');
    });
  }
}

export class Worker {
  private timer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private running = false;
  private rerun = false;

  constructor(private readonly deps: WorkerDeps) {}

  /** Drains every due event. Overlapping calls coalesce into one more pass instead of running in parallel. */
  async tick(): Promise<number> {
    if (this.running) {
      this.rerun = true;
      return 0;
    }
    this.running = true;
    let processed = 0;
    try {
      do {
        this.rerun = false;
        const ids = await claimBatch(this.deps.db, this.deps.batchSize ?? 10);
        await Promise.all(
          ids.map((id) =>
            processEvent(this.deps, id).catch((err) => this.deps.log.error({ err, eventId: id }, 'delivery crashed; recovery will retry it')),
          ),
        );
        processed += ids.length;
        if (ids.length > 0) this.rerun = true;
      } while (this.rerun);
    } catch (err) {
      this.deps.log.error({ err }, 'worker tick failed');
    } finally {
      this.running = false;
    }
    return processed;
  }

  /** Called on ingest so a new event doesn't wait for the next poll. */
  nudge(): void {
    void this.tick();
  }

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.deps.pollMs ?? 750);
    this.recoveryTimer = setInterval(() => {
      recoverStuck(this.deps.db).then(
        (n) => {
          if (n > 0) this.deps.log.warn({ recovered: n }, 'recovered stuck events');
        },
        (err) => this.deps.log.error({ err }, 'recovery failed'),
      );
    }, 30_000);
  }

  /** Resolves once no tick is in flight. */
  async idle(): Promise<void> {
    while (this.running) await new Promise((r) => setTimeout(r, 25));
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    await this.idle();
  }
}
