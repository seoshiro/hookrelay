import { EVENT_STATUSES, type EventStatus } from '@hookrelay/shared';
import { useConsole } from '../../store/console.ts';

export function StreamControls({ showFilter }: { showFilter: boolean }) {
  const { paused, togglePaused, status, setStatus } = useConsole();
  return (
    <div className="flex flex-wrap items-center gap-5">
      {showFilter && (
        <label className="flex items-center gap-3">
          <span className="label">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EventStatus | 'ALL')}
            className="hairline num h-8 border bg-bg px-2 text-[12px] text-ink"
          >
            <option value="ALL">All</option>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" onClick={togglePaused} aria-pressed={paused} className="label transition-colors hover:text-ink">
        {paused ? 'Resume stream ▸' : 'Pause stream ‖'}
      </button>
    </div>
  );
}
