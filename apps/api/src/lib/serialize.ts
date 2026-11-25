import type { AttemptView, EventSummary } from '@hookrelay/shared';
import type { DeliveryAttempt, Endpoint, Source, WebhookEvent } from '../generated/prisma/client.ts';

export type EventRow = WebhookEvent & { endpoint: Pick<Endpoint, 'targetUrl'>; source: Pick<Source, 'isSandbox'> };

export const eventInclude = {
  endpoint: { select: { targetUrl: true } },
  source: { select: { isSandbox: true, userId: true } },
} as const;

export function toSummary(e: EventRow): EventSummary {
  return {
    id: e.id,
    sourceId: e.sourceId,
    eventType: e.eventType,
    status: e.status,
    attemptCount: e.attemptCount,
    maxAttempts: e.maxAttempts,
    lastStatusCode: e.lastStatusCode,
    lastLatencyMs: e.lastLatencyMs,
    lastError: e.lastError,
    targetUrl: e.endpoint.targetUrl,
    idempotencyKey: e.idempotencyKey,
    isSandbox: e.source.isSandbox,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export function toAttempt(a: DeliveryAttempt): AttemptView {
  return {
    id: a.id,
    attemptNumber: a.attemptNumber,
    responseStatus: a.responseStatus,
    latencyMs: a.latencyMs,
    errorMessage: a.errorMessage,
    responseBody: a.responseBody,
    requestHeaders: a.requestHeaders as Record<string, string>,
    createdAt: a.createdAt.toISOString(),
  };
}
