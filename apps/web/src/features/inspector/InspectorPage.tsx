import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Masthead } from '../../components/ui.tsx';
import { useEvents } from '../../api/hooks.ts';
import { useConsole } from '../../store/console.ts';
import { EventList } from './EventList.tsx';
import { EventDetailPanel } from './EventDetailPanel.tsx';

export function InspectorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const status = useConsole((s) => s.status);
  const events = useEvents({ status, limit: 60 });
  const list = events.data?.events ?? [];
  const selected = id ?? list[0]?.id ?? null;

  // keep the URL as the source of truth for the selected event on wide screens
  useEffect(() => {
    if (!id && list[0] && window.matchMedia('(min-width: 1024px)').matches) navigate(`/events/${list[0].id}`, { replace: true });
  }, [id, list, navigate]);

  return (
    <>
      <Masthead
        index="02 / 04 — Events"
        meta="Attempts · Signatures · Payloads"
        title={
          <>
            Event <em className="text-muted">inspector.</em>
          </>
        }
        aside="Every attempt is stored with its status, latency, signed headers and the first 4 KB of the response, so a failure can be read rather than guessed."
      />
      <div className="grid gap-10 pt-9 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-0">
        <EventList events={list} loading={events.isPending} selectedId={selected} />
        <div className="hairline lg:border-l lg:pl-12">
          {selected ? <EventDetailPanel id={selected} /> : <p className="py-10 text-muted">Select an event to inspect it.</p>}
        </div>
      </div>
    </>
  );
}
