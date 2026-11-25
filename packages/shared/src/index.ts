import { z } from 'zod';
import { EVENT_STATUSES, PROVIDERS, SCENARIOS } from './constants.ts';

export { EVENT_STATUSES, PROVIDERS, SCENARIOS };

export const eventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const providerSchema = z.enum(PROVIDERS);

export const scenarioSchema = z.enum(SCENARIOS);
export type Scenario = z.infer<typeof scenarioSchema>;

export const credentialsSchema = z.object({
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const createSourceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  provider: providerSchema.default('custom'),
  targetUrl: z.url().max(2048),
  maxAttempts: z.number().int().min(1).max(10).default(5),
  timeoutMs: z.number().int().min(500).max(30_000).default(5000),
});

export const updateSourceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  targetUrl: z.url().max(2048).optional(),
  enabled: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  timeoutMs: z.number().int().min(500).max(30_000).optional(),
  telegramBotToken: z.string().max(200).nullable().optional(),
  telegramChatId: z.string().max(64).nullable().optional(),
});

export const eventsQuerySchema = z.object({
  status: eventStatusSchema.optional(),
  sourceId: z.string().optional(),
  search: z.string().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  sandbox: z.coerce.boolean().optional(),
});

export const bulkReplaySchema = z.object({
  eventIds: z.array(z.string()).max(500).optional(),
  all: z.boolean().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(60),
  scopes: z.array(z.enum(['ingest', 'read', 'replay'])).default(['read']),
});

export interface EventSummary {
  id: string;
  sourceId: string;
  eventType: string;
  status: EventStatus;
  attemptCount: number;
  maxAttempts: number;
  lastStatusCode: number | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  targetUrl: string;
  idempotencyKey: string | null;
  isSandbox: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttemptView {
  id: string;
  attemptNumber: number;
  responseStatus: number | null;
  latencyMs: number;
  errorMessage: string | null;
  responseBody: string;
  requestHeaders: Record<string, string>;
  createdAt: string;
}

export interface EventDetail extends EventSummary {
  headers: Record<string, string>;
  payload: unknown;
  signatureVerified: boolean;
  attempts: AttemptView[];
}

export type StreamMessage =
  | { type: 'event.updated'; event: EventSummary }
  | { type: 'attempt.created'; eventId: string; attempt: AttemptView }
  | { type: 'hello'; at: string };

export interface MetricsSummary {
  windowMinutes: number;
  bucketSec: number;
  throughput: number[];
  latencyBuckets: number[];
  p50: number;
  p95: number;
  successRate: number;
  delivered: number;
  failed: number;
  queueDepth: number;
  dlqTotal: number;
  dlqByCategory: { upstream5xx: number; timeout: number; ssrfDns: number; other: number };
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'connected' | 'down';
  uptimeSec: number;
  queueDepth: number;
}
