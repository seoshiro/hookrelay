import { useState } from 'react';
import { EditorialTabs } from '../../components/EditorialTabs.tsx';
import { KpiRow } from '../../components/KpiRow.tsx';
import { EventsTable } from '../../components/EventsTable.tsx';
import { SerifHeading } from '../../components/ui.tsx';
import { useEvents, useSummary } from '../../api/hooks.ts';
import { useConsole } from '../../store/console.ts';
import { SandboxStrip } from './SandboxStrip.tsx';
import { AnalyticsView } from './AnalyticsView.tsx';
import { StreamControls } from './StreamControls.tsx';

const TABS = ['Sandbox', 'Live stream', 'Analytics'] as const;
type Tab = (typeof TABS)[number];

const ASIDE: Record<Tab, string> = {
  Sandbox: 'A public sandbox on a real Postgres queue. Send a payment, break the receiver, watch retries settle into the dead-letter queue, then replay.',
  'Live stream': 'Every status change arrives over Server-Sent Events the moment the worker commits it. Pause the stream to read without the table moving.',
  Analytics: 'Aggregated straight from delivery attempts in Postgres over the last fifteen minutes, in thirty-second buckets. Nothing is sampled or estimated.',
};

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>('Sandbox');
  const status = useConsole((s) => s.status);
  const workspace = useConsole((s) => s.workspace);
  const summary = useSummary();
  const events = useEvents({ status: tab === 'Live stream' ? status : 'ALL', limit: tab === 'Sandbox' ? 8 : 40 });

  return (
    <>
      <header className="hairline grid gap-8 border-b pt-12 pb-9 md:grid-cols-[1fr_minmax(0,360px)] md:items-end md:gap-12 md:pt-14">
        <div>
          <div className="mb-7 flex justify-between gap-4">
            <span className="label">01 / 04 — {workspace === 'sandbox' ? 'Public sandbox' : 'My sources'}</span>
            <span className="label num hidden sm:inline">ISS. 01 · 2026</span>
          </div>
          <h1 className="sr-only">Console</h1>
          <EditorialTabs tabs={TABS} value={tab} onChange={setTab} label="Console views" />
        </div>
        <p className="max-w-[38ch] text-[15px] text-muted">{ASIDE[tab]}</p>
      </header>

      {tab === 'Analytics' ? (
        <AnalyticsView data={summary.data} />
      ) : (
        <>
          {tab === 'Sandbox' && (
            <>
              <section aria-label="Queue health" className="hairline border-b">
                <KpiRow data={summary.data} />
              </section>
              {workspace === 'sandbox' && <SandboxStrip />}
            </>
          )}
          <section aria-label="Live events" className="pt-9">
            <div className="flex flex-wrap items-baseline justify-between gap-4 pb-5">
              <SerifHeading>{tab === 'Sandbox' ? 'Latest events' : 'Live events'}</SerifHeading>
              <StreamControls showFilter={tab === 'Live stream'} />
            </div>
            <EventsTable events={events.data?.events ?? []} loading={events.isPending} />
          </section>
        </>
      )}
    </>
  );
}
