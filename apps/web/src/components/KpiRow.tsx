import type { MetricsSummary } from '@hookrelay/shared';
import { DotMatrix, StepLine, ThinBars } from './charts.tsx';
import { pct } from '../lib/format.ts';

const placeholder = (n: number) => Array.from({ length: n }, () => 0);

function columnEdge(index: number, compact: boolean): string {
  if (index > 0) return compact ? 'border-l' : 'border-t md:border-t-0 md:border-l';
  return compact ? '' : 'md:pl-0';
}

/** Three editorial columns: delivery rate, throughput, latency. Used on the dashboard and in the hero preview. */
export function KpiRow({ data, compact = false }: { data: MetricsSummary | undefined; compact?: boolean }) {
  const throughput = data?.throughput ?? placeholder(30);
  // attempts per minute over the last two minutes of 30-second buckets
  const perMin = throughput.slice(-4).reduce((a, b) => a + b, 0) / 2;
  const latency = (data?.latencyBuckets ?? []).slice(-12);
  const cols = [
    {
      label: 'Delivery rate',
      unit: '15 min',
      value: data ? pct(data.successRate) : '—',
      suffix: '%',
      chart: <ThinBars values={throughput} label="Delivery attempts per 30 seconds, last 15 minutes" />,
    },
    {
      label: 'Queue throughput',
      unit: 'attempts / min',
      value: data ? perMin.toFixed(perMin >= 10 ? 0 : 1) : '—',
      suffix: '/m',
      chart: <DotMatrix values={throughput.slice(-24)} label="Queue throughput per 30 seconds, last 12 minutes" />,
    },
    {
      label: 'Latency p95',
      unit: `p50 ${data?.p50 ?? 0} ms`,
      value: data ? String(data.p95) : '—',
      suffix: 'ms',
      chart: <StepLine values={latency} label="Average delivery latency per 30 seconds, last 6 minutes; gaps mean no traffic" />,
    },
  ];
  return (
    <div className={`grid grid-cols-1 ${compact ? 'grid-cols-3' : 'md:grid-cols-3'}`}>
      {cols.map((c, i) => (
        <div
          key={c.label}
          className={`hairline flex flex-col gap-5 ${compact ? 'gap-4 px-3 py-5 sm:px-5' : 'py-7 md:px-8'} ${columnEdge(i, compact)}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="label">{c.label}</span>
            {!compact && <span className="label num normal-case tracking-[0.08em]">{c.unit}</span>}
          </div>
          <div className={`font-serif leading-none tracking-[-0.03em] ${compact ? 'text-[26px] sm:text-[40px]' : 'text-[64px]'}`}>
            {c.value}
            <small className="ml-1 text-[0.36em] text-muted">{c.suffix}</small>
          </div>
          {c.chart}
        </div>
      ))}
    </div>
  );
}
