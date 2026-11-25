import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { EventSummary, StreamMessage } from '@hookrelay/shared';
import { API_URL } from './client.ts';
import { useConsole, useSandboxFlag } from '../store/console.ts';

type EventsPage = { events: EventSummary[]; nextCursor: string | null };
export type StreamState = 'connecting' | 'live' | 'paused' | 'offline';

/** Folds one updated event into every cached list of the same workspace, respecting each list's status filter. */
export function mergeEvent(qc: QueryClient, sandbox: boolean, event: EventSummary) {
  for (const [key, page] of qc.getQueriesData<EventsPage>({ queryKey: ['events', sandbox] })) {
    if (!page) continue;
    const status = key[2] as string;
    const matches = status === 'ALL' || status === event.status;
    const idx = page.events.findIndex((e) => e.id === event.id);
    // messages can arrive out of order (requeue vs worker); never let an older snapshot win
    if (idx >= 0 && page.events[idx]!.updatedAt > event.updatedAt) continue;
    let events = page.events;
    if (idx >= 0) events = matches ? events.map((e, i) => (i === idx ? event : e)) : events.filter((_, i) => i !== idx);
    else if (matches && !key[3]) events = [event, ...events].slice(0, 60);
    qc.setQueryData<EventsPage>(key, { ...page, events });
  }
}

/** One SSE connection per workspace; updates the TanStack cache so every screen stays live. */
export function useEventStream(): StreamState {
  const qc = useQueryClient();
  const sandbox = useSandboxFlag();
  const paused = useConsole((s) => s.paused);
  const [state, setState] = useState<StreamState>('connecting');

  useEffect(() => {
    if (paused) {
      setState('paused');
      return;
    }
    setState('connecting');
    const source = new EventSource(`${API_URL}/api/events/stream?sandbox=${sandbox}`, { withCredentials: true });
    let summaryTimer: number | undefined;
    const refreshSummary = () => {
      window.clearTimeout(summaryTimer);
      summaryTimer = window.setTimeout(() => void qc.invalidateQueries({ queryKey: ['summary', sandbox] }), 600);
    };

    source.onopen = () => setState('live');
    source.onerror = () => setState(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
    source.onmessage = (msg) => {
      const data = JSON.parse(msg.data as string) as StreamMessage;
      if (data.type === 'event.updated') {
        mergeEvent(qc, sandbox, data.event);
        void qc.invalidateQueries({ queryKey: ['event', data.event.id] });
        refreshSummary();
      }
    };
    return () => {
      window.clearTimeout(summaryTimer);
      source.close();
    };
  }, [qc, sandbox, paused]);

  return state;
}
