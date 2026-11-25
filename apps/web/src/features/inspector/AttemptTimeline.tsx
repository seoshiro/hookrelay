import { motion } from 'motion/react';
import type { AttemptView, EventStatus } from '@hookrelay/shared';
import { clock } from '../../lib/format.ts';

const REASONS: Record<number, string> = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request', 404: 'Not Found', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };

function tone(a: AttemptView) {
  if (a.responseStatus && a.responseStatus < 300) return 'bg-ok';
  return 'bg-dlq';
}

/** Vertical ledger of attempts: a hairline spine with one mark per try. */
export function AttemptTimeline({ attempts, status }: { attempts: AttemptView[]; status: EventStatus }) {
  if (attempts.length === 0) return <p className="text-[13px] text-muted">Queued. The first attempt runs within a second.</p>;
  return (
    <ol className="relative flex flex-col gap-5 pl-7 before:absolute before:top-2 before:bottom-2 before:left-[3px] before:w-px before:bg-line-strong">
      {attempts.map((a) => (
        <motion.li key={a.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="relative grid gap-1">
          <span aria-hidden className={`absolute top-[7px] -left-7 size-[7px] rounded-full ${tone(a)}`} />
          <div className="flex flex-wrap items-baseline gap-x-3 text-[14px]">
            <span className="num text-muted">#{a.attemptNumber}</span>
            <span>{a.responseStatus ? `${a.responseStatus} ${REASONS[a.responseStatus] ?? ''}` : (a.errorMessage ?? 'Network error')}</span>
            <span className="num text-[12px] text-muted">{a.latencyMs} ms</span>
            <span className="num ml-auto text-[11px] text-faint">{clock(a.createdAt)}</span>
          </div>
        </motion.li>
      ))}
      {status === 'RETRYING' && <li className="label relative pl-0 text-retry">Next retry scheduled</li>}
      {status === 'DLQ' && <li className="label relative text-dlq">Moved to dead letters</li>}
    </ol>
  );
}
