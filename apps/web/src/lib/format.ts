import type { EventStatus } from '@hookrelay/shared';

export const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 12)}…` : id);

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function statusLabel(status: EventStatus, code: number | null): string {
  if (status === 'DELIVERED') return code ? `${code} OK` : 'DELIVERED';
  if (status === 'PROCESSING') return 'SENDING';
  return status;
}

export const statusTone: Record<EventStatus, string> = {
  DELIVERED: 'text-ok',
  RETRYING: 'text-retry',
  DLQ: 'text-dlq',
  PENDING: 'text-muted',
  PROCESSING: 'text-ink',
};

export const pct = (v: number) => `${(v * 100).toFixed(v === 1 ? 0 : 1)}`;

export function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
