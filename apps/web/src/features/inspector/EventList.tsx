import { Link } from 'react-router';
import { EVENT_STATUSES, type EventStatus, type EventSummary } from '@hookrelay/shared';
import { useConsole } from '../../store/console.ts';
import { clock, statusTone } from '../../lib/format.ts';
import { Empty } from '../../components/ui.tsx';

export function EventList({ events, loading, selectedId }: { events: EventSummary[]; loading: boolean; selectedId: string | null }) {
  const { search, setSearch, status, setStatus } = useConsole();
  return (
    <section aria-label="Webhook events" className="flex flex-col gap-5 lg:pr-12">
      <div className="flex gap-3">
        <label className="flex-1">
          <span className="sr-only">Search events</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search id or type"
            className="hairline num h-9 w-full rounded-[2px] border bg-sunken px-3 text-[12px] text-ink placeholder:text-faint"
          />
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus | 'ALL')} className="hairline num h-9 rounded-[2px] border bg-bg px-2 text-[12px]">
            <option value="ALL">All</option>
            {EVENT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {!loading && events.length === 0 ? (
        <Empty>No events match.</Empty>
      ) : (
        <ol className="hairline max-h-[70vh] overflow-y-auto border-t">
          {events.map((e) => {
            const active = e.id === selectedId;
            return (
              <li key={e.id}>
                <Link
                  to={`/events/${e.id}`}
                  aria-current={active ? 'true' : undefined}
                  className={`hairline grid grid-cols-[10px_1fr_auto] items-baseline gap-3 border-b px-3 py-3.5 transition-colors ${active ? 'bg-ink text-bg' : 'hover:bg-surface'}`}
                >
                  <span aria-hidden className={`size-1.5 translate-y-[-2px] rounded-full bg-current ${active ? '' : statusTone[e.status]}`} />
                  <span className="min-w-0">
                    <span className="num block truncate text-[12px]">{e.id}</span>
                    <span className={`block truncate text-[13px] ${active ? 'text-bg/70' : 'text-muted'}`}>{e.eventType}</span>
                  </span>
                  <span className={`num text-[11px] ${active ? 'text-bg/70' : 'text-faint'}`}>{clock(e.createdAt)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
