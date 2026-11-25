import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@hookrelay/shared';
import { api } from '../../api/client.ts';
import { useSummary } from '../../api/hooks.ts';
import { ThinBars } from '../../components/charts.tsx';
import { SerifHeading } from '../../components/ui.tsx';

export function QueueHealth() {
  const { data: s } = useSummary();
  const { data: h } = useQuery({ queryKey: ['health'], queryFn: () => api<HealthResponse>('/api/health'), refetchInterval: 10_000 });
  const depth = s?.queueDepth ?? 0;
  const tags = [h?.db === 'connected' ? 'Healthy' : 'Degraded', depth === 0 ? 'Idle' : 'Draining'];

  return (
    <section aria-label="Postgres queue health" className="flex flex-col gap-7 py-9 lg:pr-10">
      <SerifHeading>Postgres queue</SerifHeading>
      <div className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3">
          <span className="label">Attempts per 30 s · last 15 min</span>
          <ThinBars values={s?.throughput ?? Array(30).fill(0)} height={120} label="Queue throughput per 30 seconds" />
          <div className="num flex justify-between text-[11px] text-faint">
            <span>−15 min</span>
            <span>−7.5</span>
            <span>now</span>
          </div>
        </div>
        <dl className="flex flex-col gap-5 md:min-w-[200px]">
          <div className="flex flex-col gap-2">
            <dt className="label">Claim strategy</dt>
            <dd className="num text-[13px]">FOR UPDATE SKIP LOCKED</dd>
          </div>
          <div className="flex flex-col gap-2">
            <dt className="label">Depth · p50</dt>
            <dd className="num text-[13px]">
              {depth} waiting · {s?.p50 ?? 0} ms
            </dd>
          </div>
          <div className="flex flex-col gap-2">
            <dt className="label">Uptime</dt>
            <dd className="num text-[13px]">{h ? `${Math.floor(h.uptimeSec / 60)} min` : '…'}</dd>
          </div>
          <dd className="flex gap-2">
            {tags.map((t) => (
              <span key={t} className={`hairline num border px-2 py-1 text-[11px] ${t === 'Degraded' ? 'text-dlq' : t === 'Healthy' ? 'text-ok' : 'text-muted'}`}>
                {t}
              </span>
            ))}
          </dd>
        </dl>
      </div>
    </section>
  );
}
