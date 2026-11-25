import { useState } from 'react';
import type { EventSummary } from '@hookrelay/shared';
import { Button, Masthead } from '../../components/ui.tsx';
import { useEvents, useReplayBulk } from '../../api/hooks.ts';
import { useConsole } from '../../store/console.ts';
import { CauseColumns } from './CauseColumns.tsx';
import { DlqTable } from './DlqTable.tsx';
import { ResponseTrace } from './ResponseTrace.tsx';

export function DlqPage() {
  const events = useEvents({ status: 'DLQ', limit: 100 });
  const list: EventSummary[] = events.data?.events ?? [];
  const { dlqSelection, setDlqSelection } = useConsole();
  const selected = dlqSelection.filter((id) => list.some((e) => e.id === id));
  const replay = useReplayBulk();
  const [focus, setFocus] = useState<string | null>(null);
  const traced = focus ?? list[0]?.id ?? null;

  return (
    <>
      <Masthead
        index="03 / 04 — Dead letters"
        meta={`${list.length} held`}
        title={
          <>
            Dead letter <em className="text-muted">queue.</em>
          </>
        }
        aside={
          <div className="flex flex-col items-start gap-5">
            <p>Events land here after their last retry. Nothing is dropped: inspect the response, fix the receiver, replay.</p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                disabled={selected.length === 0 || replay.isPending}
                onClick={() => replay.mutate({ eventIds: selected }, { onSuccess: () => setDlqSelection([]) })}
              >
                Replay selected ({selected.length})
              </Button>
              <Button disabled={list.length === 0 || replay.isPending} onClick={() => replay.mutate({ all: true }, { onSuccess: () => setDlqSelection([]) })}>
                Replay all
              </Button>
            </div>
          </div>
        }
      />
      <CauseColumns events={list} />
      <section aria-label="Dead-lettered events" className="pt-9">
        <DlqTable events={list} loading={events.isPending} onFocus={setFocus} focused={traced} />
      </section>
      {traced && <ResponseTrace id={traced} />}
    </>
  );
}
