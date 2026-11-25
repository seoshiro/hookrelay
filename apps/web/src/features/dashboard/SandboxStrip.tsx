import { useState } from 'react';
import type { Scenario } from '@hookrelay/shared';
import { Button } from '../../components/ui.tsx';
import { useReplayBulk, useSimulate, useSummary } from '../../api/hooks.ts';

/** The three-button sandbox: success, failure into the DLQ, and recovery by replay. */
export function SandboxStrip() {
  const simulate = useSimulate();
  const replay = useReplayBulk();
  const { data } = useSummary();
  const [note, setNote] = useState<string | null>(null);
  const dlq = data?.dlqTotal ?? 0;

  const run = (scenario: Scenario, text: string) =>
    simulate.mutate(scenario, {
      onSuccess: (r) => setNote(`${r.eventId} · ${text}`),
      onError: (e) => setNote(e.message),
    });

  return (
    <section aria-label="Interactive sandbox" className="hairline grid gap-6 border-b py-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-10">
      <h2 className="font-serif text-[30px] leading-none tracking-[-0.02em]">Try the failure.</h2>
      <div className="max-w-[56ch] text-muted">
        <p>Each run signs a Stripe-style event and queues it. Retries are compressed to 1s → 2s so the whole cycle ends in the DLQ within three seconds.</p>
        <p className="num mt-2 min-h-[18px] text-[12px] text-faint" aria-live="polite">
          {note}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={simulate.isPending} onClick={() => run('ok_payment', 'queued, expect 200 OK')}>
          Simulate 200 OK
        </Button>
        <Button disabled={simulate.isPending} onClick={() => run('fail_500_to_dlq', 'queued, the receiver will fail')}>
          Simulate 500 → DLQ
        </Button>
        <Button
          variant="ghost"
          disabled={replay.isPending || dlq === 0}
          onClick={() => replay.mutate({ all: true }, { onSuccess: (r) => setNote(`${r.replayed} replayed with the receiver healthy again`) })}
          className="px-2 underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
        >
          Replay all DLQ{dlq > 0 ? ` (${dlq})` : ''}
        </Button>
      </div>
    </section>
  );
}
