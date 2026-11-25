import { useEvent, useReplay } from '../../api/hooks.ts';
import { Button, StatusMark } from '../../components/ui.tsx';
import { CodeBlock, pretty } from '../../components/CodeBlock.tsx';
import { AttemptTimeline } from './AttemptTimeline.tsx';

export function EventDetailPanel({ id }: { id: string }) {
  const { data: e, isPending, error } = useEvent(id);
  const replay = useReplay();

  if (isPending) return <p className="label py-10">Loading event…</p>;
  if (error || !e) return <p className="py-10 text-dlq">{error?.message ?? 'Event not found'}</p>;

  const last = e.attempts.at(-1);
  return (
    <article className="flex flex-col gap-9" aria-labelledby="event-title">
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex flex-col gap-3">
            <span className="num text-[12px] text-muted">{e.id}</span>
            <h2 id="event-title" className="font-serif text-[clamp(32px,3.4vw,44px)] leading-none tracking-[-0.025em]">
              {e.eventType}
            </h2>
          </div>
          <Button variant="primary" disabled={replay.isPending || e.status === 'PROCESSING'} onClick={() => replay.mutate(e.id)}>
            {replay.isPending ? 'Replaying…' : 'Replay event'}
          </Button>
        </div>
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px]">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Status</dt>
            <dd>
              <StatusMark status={e.status} code={e.lastStatusCode} />
            </dd>
          </div>
          <div className={`num flex items-center gap-2 ${e.signatureVerified ? 'text-ok' : 'text-faint'}`}>
            <dt className="sr-only">Signature</dt>
            <dd>{e.signatureVerified ? '✓ HMAC-SHA256 verified' : 'Not signed yet'}</dd>
          </div>
          {e.idempotencyKey && (
            <div className="hairline num flex items-center gap-2 border px-2.5 py-1 text-muted">
              <dt>Idempotency</dt>
              <dd className="text-ink">{e.idempotencyKey}</dd>
            </div>
          )}
          <div className="num text-muted">
            <dt className="sr-only">Target</dt>
            <dd>→ {e.targetUrl}</dd>
          </div>
        </dl>
      </header>

      <section aria-label="Delivery attempts" className="flex flex-col gap-5">
        <div className="flex justify-between">
          <span className="label">Delivery attempts</span>
          <span className="label num">
            {e.attemptCount} / {e.maxAttempts}
          </span>
        </div>
        <AttemptTimeline attempts={e.attempts} status={e.status} />
      </section>

      <CodeBlock title="Payload" code={pretty(e.payload)} />
      {last && <CodeBlock title={`Response · attempt #${last.attemptNumber}`} code={last.responseBody ? pretty(last.responseBody) : last.errorMessage ?? '(empty body)'} maxHeight={200} />}
      {last && <CodeBlock title="Signed request headers" code={pretty(last.requestHeaders)} maxHeight={220} />}
    </article>
  );
}
