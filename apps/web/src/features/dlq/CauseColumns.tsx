import type { EventSummary } from '@hookrelay/shared';

export function causeOf(e: Pick<EventSummary, 'lastError'>): 'upstream5xx' | 'timeout' | 'ssrfDns' | 'other' {
  const err = e.lastError ?? '';
  if (/^HTTP 5/.test(err)) return 'upstream5xx';
  if (/^Timed out/.test(err)) return 'timeout';
  if (/^SSRF|ENOTFOUND|EAI_AGAIN/.test(err)) return 'ssrfDns';
  return 'other';
}

const COLUMNS = [
  ['upstream5xx', '5xx upstream', 'The receiver answered, but with a server error.'],
  ['timeout', 'Timeouts', 'No response inside the endpoint timeout.'],
  ['ssrfDns', 'SSRF / DNS', 'Blocked by the guard or the host did not resolve.'],
] as const;

/** One dot per dead-lettered event, so the columns stay literal rather than decorative. */
function Dots({ n }: { n: number }) {
  const shown = Math.min(n, 36);
  return (
    <div aria-hidden className="grid h-[40px] grid-cols-12 content-end gap-[7px]">
      {Array.from({ length: 36 }).map((_, i) => (
        <i key={i} className={`size-1 rounded-full ${i >= 36 - shown ? 'bg-ink' : 'bg-faint/50'}`} />
      ))}
    </div>
  );
}

export function CauseColumns({ events }: { events: EventSummary[] }) {
  const counts = events.reduce<Record<string, number>>((acc, e) => {
    const c = causeOf(e);
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <section aria-label="Failure causes" className="hairline grid border-b md:grid-cols-3">
      {COLUMNS.map(([key, title, note], i) => (
        <div key={key} className={`hairline flex flex-col gap-4 py-7 md:px-8 ${i === 0 ? 'md:pl-0' : 'border-t md:border-t-0 md:border-l'}`}>
          <div className="flex items-baseline justify-between">
            <span className="label">{title}</span>
            <span className={`font-serif text-[40px] leading-none ${counts[key] ? 'text-dlq' : 'text-faint'}`}>{counts[key] ?? 0}</span>
          </div>
          <Dots n={counts[key] ?? 0} />
          <p className="text-[12px] text-muted">{note}</p>
        </div>
      ))}
    </section>
  );
}
