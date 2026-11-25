import { NavLink, Outlet, Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Brand } from '../../components/ui.tsx';
import { useEventStream, type StreamState } from '../../api/useEventStream.ts';
import { useMe } from '../../api/hooks.ts';
import { api } from '../../api/client.ts';
import { useConsole } from '../../store/console.ts';

const NAV = [
  ['/dashboard', 'Sandbox'],
  ['/events', 'Events'],
  ['/dlq', 'Dead letters'],
  ['/endpoints', 'Endpoints'],
] as const;

const streamText: Record<StreamState, string> = { live: 'Stream live', connecting: 'Connecting', paused: 'Stream paused', offline: 'Offline' };
const streamTone: Record<StreamState, string> = { live: 'bg-ok', connecting: 'bg-retry animate-pulse', paused: 'bg-faint', offline: 'bg-dlq' };

function Account() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { workspace, setWorkspace } = useConsole();
  if (!me) return <Link to="/endpoints#account" className="text-[13px] text-muted hover:text-ink">Sign in</Link>;
  return (
    <div className="flex items-center gap-4 text-[13px]">
      <div role="group" aria-label="Workspace" className="hairline flex border">
        {(['sandbox', 'mine'] as const).map((w) => (
          <button key={w} type="button" aria-pressed={workspace === w} onClick={() => setWorkspace(w)} className={`px-3 py-1.5 ${workspace === w ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>
            {w === 'sandbox' ? 'Sandbox' : 'My sources'}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-muted hover:text-ink"
        onClick={async () => {
          await api('/api/auth/logout', { method: 'POST' });
          setWorkspace('sandbox');
          await qc.invalidateQueries();
        }}
      >
        Sign out
      </button>
    </div>
  );
}

export function ConsoleLayout() {
  const stream = useEventStream();
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <header className="hairline sticky top-0 z-20 border-b bg-bg/92 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-6 px-6 md:gap-10 md:px-12">
          <Brand />
          <nav aria-label="Console" className="-mb-px flex flex-1 gap-6 overflow-x-auto [scrollbar-width:none] md:ml-auto md:flex-none md:gap-7 [&::-webkit-scrollbar]:hidden">
            {NAV.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative py-[22px] text-[13px] whitespace-nowrap transition-colors ${isActive ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-ink' : 'text-muted hover:text-ink'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="hairline hidden items-center gap-6 border-l pl-6 lg:flex">
            <span className="label flex items-center gap-2" aria-live="polite">
              <span aria-hidden className={`size-1.5 rounded-full ${streamTone[stream]}`} />
              {streamText[stream]}
            </span>
            <Account />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1320px] px-6 pb-20 md:px-12">
        <Outlet />
      </main>
      <footer className="hairline mx-auto flex max-w-[1320px] flex-wrap justify-between gap-4 border-t px-6 py-10 md:px-12">
        <span className="label">Postgres · FOR UPDATE SKIP LOCKED · HMAC-SHA256</span>
        <a className="label link-quiet" href="https://github.com/seoshiro/hookrelay" target="_blank" rel="noreferrer">
          Source on GitHub ↗
        </a>
      </footer>
    </div>
  );
}
