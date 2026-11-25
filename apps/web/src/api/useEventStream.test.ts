import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { EventSummary } from '@hookrelay/shared';
import { mergeEvent } from './useEventStream.ts';

const ev = (id: string, status: EventSummary['status'], updatedAt: string): EventSummary => ({
  id,
  sourceId: 's',
  eventType: 'payment.succeeded',
  status,
  attemptCount: 1,
  maxAttempts: 3,
  lastStatusCode: null,
  lastLatencyMs: null,
  lastError: null,
  targetUrl: 'https://x',
  idempotencyKey: null,
  isSandbox: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
});

const page = (qc: QueryClient, key: unknown[]) => qc.getQueryData<{ events: EventSummary[] }>(key)!.events;

describe('mergeEvent', () => {
  it('prepends new events into the unfiltered list', () => {
    const qc = new QueryClient();
    qc.setQueryData(['events', true, 'ALL', ''], { events: [ev('a', 'DELIVERED', 't1')], nextCursor: null });
    mergeEvent(qc, true, ev('b', 'PENDING', 't2'));
    expect(page(qc, ['events', true, 'ALL', '']).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('never lets an older snapshot overwrite a newer one', () => {
    const qc = new QueryClient();
    qc.setQueryData(['events', true, 'ALL', ''], { events: [ev('a', 'DELIVERED', '2026-01-01T00:00:02.000Z')], nextCursor: null });
    mergeEvent(qc, true, ev('a', 'PROCESSING', '2026-01-01T00:00:01.000Z'));
    expect(page(qc, ['events', true, 'ALL', ''])[0]!.status).toBe('DELIVERED');
  });

  it('drops an event from a status-filtered list once it no longer matches', () => {
    const qc = new QueryClient();
    qc.setQueryData(['events', true, 'DLQ', ''], { events: [ev('a', 'DLQ', 't1')], nextCursor: null });
    mergeEvent(qc, true, ev('a', 'PENDING', 't2'));
    expect(page(qc, ['events', true, 'DLQ', ''])).toHaveLength(0);
  });

  it('leaves the other workspace untouched', () => {
    const qc = new QueryClient();
    qc.setQueryData(['events', false, 'ALL', ''], { events: [], nextCursor: null });
    mergeEvent(qc, true, ev('a', 'PENDING', 't1'));
    expect(page(qc, ['events', false, 'ALL', ''])).toHaveLength(0);
  });
});
