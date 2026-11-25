import type { MetricsSummary } from '@hookrelay/shared';
import { SegmentBar, StepLine, ThinBars } from '../../components/charts.tsx';
import { pct } from '../../lib/format.ts';

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-serif text-[48px] leading-none tracking-[-0.03em]">
        {value}
        {unit && <small className="ml-1 text-[0.4em] text-muted">{unit}</small>}
      </span>
      <span className="label">{label}</span>
    </div>
  );
}

export function AnalyticsView({ data }: { data: MetricsSummary | undefined }) {
  const d = data;
  const axis = ['−30 min', '−20', '−10', 'now'];
  return (
    <div className="flex flex-col">
      <section aria-label="Totals" className="hairline grid grid-cols-2 gap-8 border-b py-9 md:grid-cols-4">
        <Figure label="Delivered" value={String(d?.delivered ?? '—')} />
        <Figure label="Dead-lettered" value={String(d?.failed ?? '—')} />
        <Figure label="Success rate" value={d ? pct(d.successRate) : '—'} unit="%" />
        <Figure label="In queue now" value={String(d?.queueDepth ?? '—')} />
      </section>

      <section aria-label="Throughput" className="hairline grid gap-10 border-b py-9 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="flex justify-between">
            <span className="label">Attempts per minute</span>
            <span className="label num">peak {Math.max(...(d?.throughput ?? [0]))}</span>
          </div>
          <ThinBars values={d?.throughput ?? Array(30).fill(0)} height={160} label="Delivery attempts per minute over 30 minutes" />
          <div className="num flex justify-between text-[11px] text-faint">{axis.map((a) => <span key={a}>{a}</span>)}</div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex justify-between">
            <span className="label">Average latency per minute</span>
            <span className="label num">
              p50 {d?.p50 ?? 0} · p95 {d?.p95 ?? 0} ms
            </span>
          </div>
          <StepLine values={d?.latencyBuckets ?? []} height={160} label="Average delivery latency per minute over 30 minutes" />
          <div className="num flex justify-between text-[11px] text-faint">{axis.map((a) => <span key={a}>{a}</span>)}</div>
        </div>
      </section>

      <section aria-label="Dead-letter causes" className="flex flex-col gap-5 py-9">
        <div className="flex justify-between">
          <span className="label">Why events died</span>
          <span className="label num">{d?.dlqTotal ?? 0} in DLQ</span>
        </div>
        <SegmentBar parts={[d?.dlqByCategory.upstream5xx ?? 0, d?.dlqByCategory.timeout ?? 0, d?.dlqByCategory.ssrfDns ?? 0, d?.dlqByCategory.other ?? 0]} label="Dead-letter causes" />
        <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {(
            [
              ['5xx upstream', d?.dlqByCategory.upstream5xx],
              ['Timeouts', d?.dlqByCategory.timeout],
              ['SSRF / DNS', d?.dlqByCategory.ssrfDns],
              ['Other', d?.dlqByCategory.other],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-2">
              <dt className="label">{k}</dt>
              <dd className="num text-[20px]">{v ?? 0}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
