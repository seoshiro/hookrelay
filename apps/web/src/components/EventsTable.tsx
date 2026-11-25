import { Link } from 'react-router';
import type { EventSummary } from '@hookrelay/shared';
import { StatusMark, Empty } from './ui.tsx';
import { hostOf, relativeTime } from '../lib/format.ts';
import { useNow } from '../lib/useNow.ts';

/** Live events ledger. Rows link to the inspector. */
export function EventsTable({ events, loading }: { events: EventSummary[]; loading: boolean }) {
  const now = useNow(5000);
  if (!loading && events.length === 0) return <Empty>No events yet. Run a simulation above to see the queue work.</Empty>;
  return (
    <div className="-mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="hairline border-b border-line-strong">
            {['Event', 'Type', 'Attempt', 'Status', 'Destination', 'Received'].map((h, i) => (
              <th key={h} scope="col" className={`label pb-3 font-medium ${i === 5 ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="hairline group border-b transition-colors hover:bg-surface/60">
              <td className="py-[15px] pr-4">
                <Link to={`/events/${e.id}`} className="num text-[12px] text-ink group-hover:text-accent">
                  {e.id}
                </Link>
              </td>
              <td className="pr-4 text-[13px]">{e.eventType}</td>
              <td className="num pr-4 text-[12px] text-muted">
                {e.attemptCount} / {e.maxAttempts}
              </td>
              <td className="pr-4">
                <StatusMark status={e.status} code={e.lastStatusCode} />
              </td>
              <td className="num max-w-[220px] truncate pr-4 text-[12px] text-muted">{hostOf(e.targetUrl)}</td>
              <td className="num text-right text-[12px] text-muted">{relativeTime(e.createdAt, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
