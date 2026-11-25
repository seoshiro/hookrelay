import { Link } from 'react-router';
import type { EventSummary } from '@hookrelay/shared';
import { useReplay } from '../../api/hooks.ts';
import { useConsole } from '../../store/console.ts';
import { Empty } from '../../components/ui.tsx';

const box = 'size-4 appearance-none border border-line-strong bg-transparent checked:border-ink checked:bg-ink cursor-pointer';

export function DlqTable({ events, loading, focused, onFocus }: { events: EventSummary[]; loading: boolean; focused: string | null; onFocus: (id: string) => void }) {
  const { dlqSelection, toggleDlq, setDlqSelection } = useConsole();
  const replay = useReplay();
  if (!loading && events.length === 0) return <Empty>The dead letter queue is empty. Simulate a 500 on the Sandbox screen to fill it.</Empty>;
  const all = events.length > 0 && events.every((e) => dlqSelection.includes(e.id));

  return (
    <div className="-mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="w-10 pb-3">
              <input type="checkbox" className={box} checked={all} onChange={() => setDlqSelection(all ? [] : events.map((e) => e.id))} aria-label="Select all dead letters" />
            </th>
            {['Event', 'Target URL', 'Failure', ''].map((h) => (
              <th key={h} scope="col" className="label pb-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className={`hairline border-b ${focused === e.id ? 'bg-surface' : ''}`} onClick={() => onFocus(e.id)}>
              <td className="py-4">
                <input type="checkbox" className={box} checked={dlqSelection.includes(e.id)} onChange={() => toggleDlq(e.id)} onClick={(ev) => ev.stopPropagation()} aria-label={`Select ${e.id}`} />
              </td>
              <td className="num pr-4 text-[12px]">{e.id}</td>
              <td className="num max-w-[320px] truncate pr-4 text-[12px] text-muted">{e.targetUrl}</td>
              <td className="num pr-4 text-[12px] text-dlq">
                {e.lastStatusCode ?? 'ERR'} — {e.attemptCount}/{e.maxAttempts} attempts
              </td>
              <td className="py-3 text-right whitespace-nowrap">
                <Link to={`/events/${e.id}`} className="hairline mr-2 inline-flex h-8 items-center border px-3 text-[12px] text-muted hover:border-ink hover:text-ink">
                  Inspect
                </Link>
                <button
                  type="button"
                  disabled={replay.isPending}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    replay.mutate(e.id);
                  }}
                  className="inline-flex h-8 items-center border border-line-strong px-3 text-[12px] hover:border-ink disabled:opacity-40"
                >
                  Replay
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
