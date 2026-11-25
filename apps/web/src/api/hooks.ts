import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventDetail, EventSummary, MetricsSummary, Scenario } from '@hookrelay/shared';
import { api, qs } from './client.ts';
import { useConsole, useSandboxFlag } from '../store/console.ts';

export interface SourceView {
  id: string;
  name: string;
  provider: string;
  isSandbox: boolean;
  ingestUrl: string;
  signingSecretPreview: string;
  endpoint?: {
    id: string;
    targetUrl: string;
    maxAttempts: number;
    timeoutMs: number;
    enabled: boolean;
    retrySchedule: string[];
    telegram: { configured: boolean; botToken: string | null; chatId: string | null };
  };
}

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export const keys = {
  events: (sandbox: boolean, status?: string, search?: string) => ['events', sandbox, status ?? 'ALL', search ?? ''] as const,
  event: (id: string) => ['event', id] as const,
  summary: (sandbox: boolean) => ['summary', sandbox] as const,
};

export function useEvents(opts: { status?: string; limit?: number } = {}) {
  const sandbox = useSandboxFlag();
  const search = useConsole((s) => s.search);
  const status = opts.status && opts.status !== 'ALL' ? opts.status : undefined;
  return useQuery({
    queryKey: keys.events(sandbox, status, search),
    queryFn: ({ signal }) =>
      api<{ events: EventSummary[]; nextCursor: string | null }>(`/api/events${qs({ sandbox, status, search, limit: opts.limit ?? 40 })}`, { signal }),
  });
}

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: keys.event(id ?? ''),
    queryFn: ({ signal }) => api<{ event: EventDetail }>(`/api/events/${id}`, { signal }).then((r) => r.event),
    enabled: !!id,
  });
}

export function useSummary(refetchMs = 5000) {
  const sandbox = useSandboxFlag();
  return useQuery({
    queryKey: keys.summary(sandbox),
    queryFn: ({ signal }) => api<MetricsSummary>(`/api/metrics/summary${qs({ sandbox })}`, { signal }),
    refetchInterval: refetchMs,
  });
}

export function useSandboxSource() {
  return useQuery({ queryKey: ['sandbox-source'], queryFn: () => api<{ source: SourceView }>('/api/sandbox').then((r) => r.source), staleTime: 60_000 });
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: { id: string; email: string } | null }>('/api/auth/me').then((r) => r.user),
    staleTime: 5 * 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['events'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
    void qc.invalidateQueries({ queryKey: ['event'] });
  };
}

export function useSimulate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (scenario: Scenario) => api<{ eventId: string }>('/api/sandbox/simulate', { method: 'POST', body: { scenario } }),
    onSuccess: invalidate,
  });
}

export function useReplay() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api(`/api/events/${id}/replay`, { method: 'POST' }), onSuccess: invalidate });
}

export function useReplayBulk() {
  const sandbox = useSandboxFlag();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { eventIds?: string[]; all?: boolean }) =>
      sandbox && body.all
        ? api<{ replayed: number }>('/api/sandbox/replay-all', { method: 'POST' })
        : api<{ replayed: number }>(`/api/dlq/replay-bulk${qs({ sandbox })}`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}
