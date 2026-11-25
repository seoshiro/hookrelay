import { Link } from 'react-router';
import { useSummary } from '../../api/hooks.ts';
import { KpiRow } from '../../components/KpiRow.tsx';

/** A quiet window onto the real console: live sandbox metrics, the whole frame links into the dashboard. */
export function ConsolePreview() {
  const { data, isError } = useSummary(8000);
  return (
    <Link
      to="/dashboard"
      aria-label="Open the live console"
      className="group block border border-ink/15 bg-[rgba(30,26,21,0.86)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-colors duration-500 hover:border-ink/30"
    >
      <div className="hairline flex items-center justify-between border-b px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <i key={i} className="size-2 rounded-full border border-ink/25" />
          ))}
        </span>
        <span className="num text-[11px] text-muted">hookrelay.dev/dashboard</span>
        <span className="label flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${isError ? 'bg-dlq' : 'bg-ok'}`} />
          {isError ? 'Offline' : 'Live'}
        </span>
      </div>
      <div className="flex items-end justify-between gap-4 px-5 pt-6 pb-5 md:px-6">
        <div className="flex gap-6 font-serif text-[clamp(26px,3.4vw,44px)] leading-none tracking-[-0.03em]">
          <span>Overview</span>
          <span className="hidden text-faint sm:inline">Events</span>
          <span className="hidden text-faint sm:inline">Dead letters</span>
        </div>
        <span className="label hidden transition-colors group-hover:text-ink sm:inline">Open console ↗</span>
      </div>
      <div className="hairline border-t">
        <KpiRow data={data} compact />
      </div>
    </Link>
  );
}
