import type { MetricsSummary } from '@hookrelay/shared';
import { DotMatrix, StepLine, ThinBars } from './charts.tsx';
import { pct } from '../lib/format.ts';

const placeholder = (n: number) => Array.from({ length: n }, () => 0);

/** Three editorial columns: delivery rate, throughput, latency. Used on the dashboard and in the hero preview. */
export function KpiRow({ data, compact = false }: { data: MetricsSummary | undefined; compact?: boolean }) {
  const throughput = data?.throughput ?? placeholder(30);
  const perMin = throughput.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const cols = [
    {
      label: 'Delivery rate',
      unit: '30 min',
      value: data ? pct(data.successRate) : '—',
      suffix: '%',
      chart: <ThinBars values={throughput} label="Delivery attempts per minute, last 30 minutes" />,
    },
    {
      label: 'Queue throughput',
      unit: 'attempts / min',
      value: data ? perMin.toFixed(perMin >= 10 ? 0 : 1) : '—',
      suffix: '/m',
      chart: <DotMatrix values={throughput.slice(-24)} label="Queue throughput, last 24 minutes" />,
    },
    {
      label: 'Latency p95',
      unit: `p50 ${data?.p50 ?? 0} ms`,
      value: data ? String(data.p95) : '—',
      suffix: 'ms',
      chart: <StepLine values={(data?.latencyBuckets ?? placeholder(30)).slice(-10)} label="Average delivery latency per minute" />,
    },
  ];
  return (
    <div className={`grid grid-cols-1 ${compact ? 'grid-cols-3' : 'md:grid-cols-3'}`}>
      {cols.map((c, i) => (
        <div
          key={c.label}
          className={`hairline flex flex-col gap-5 ${compact ? 'gap-4 px-3 py-5 sm:px-5' : 'py-7 md:px-8'} ${i > 0 ? (compact ? 'border-l' : 'border-t md:border-t-0 md:border-l') : compact ? '' : 'md:pl-0'}`}
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
