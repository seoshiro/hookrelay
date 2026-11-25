import { Link } from 'react-router';
import { Brand } from '../../components/ui.tsx';
import { DOCS_URL } from './HeroHeader.tsx';

const STEPS = [
  {
    n: '01',
    title: 'Accept',
    lead: '202 in milliseconds.',
    body: 'The ingest route writes the raw body to Postgres and returns. An Idempotency-Key is enforced by a unique index, so a retried send from Stripe is stored once, not twice.',
    code: 'POST /api/ingest/:key → 202 { eventId }',
  },
  {
    n: '02',
    title: 'Sign & deliver',
    lead: 'One worker or ten, never twice.',
    body: 'Workers claim due events with FOR UPDATE SKIP LOCKED, sign them with HMAC-SHA256 and post them through a guard that resolves every address and refuses private ranges and redirects.',
    code: 'X-HookRelay-Signature: v1=hmac(ts.body)',
  },
  {
    n: '03',
    title: 'Recover',
    lead: 'Failures wait, they are not lost.',
    body: 'Errors back off at 5s, 25s, 2m, 10m and 30m with jitter. What still fails lands in the dead-letter queue with every response kept, a Telegram alert, and a replay button.',
    code: 'RETRYING → DLQ → replay → 200 OK',
  },
];

export function Principles() {
  return (
    <section id="principles" aria-labelledby="principles-title" className="mx-auto max-w-[1320px] scroll-mt-10 px-6 pt-[clamp(72px,12vh,140px)] md:px-12">
      <div className="hairline grid gap-8 border-b pb-10 md:grid-cols-[1fr_minmax(0,380px)] md:items-end">
        <div>
          <span className="label">02 / How it holds</span>
          <h2 id="principles-title" className="display mt-6 text-[clamp(44px,6vw,84px)]">
            Three promises, <em className="text-muted">kept in Postgres.</em>
          </h2>
        </div>
        <p className="text-[15px] text-muted">No Redis, no broker, no paid queue. The database you already run is the queue, the ledger and the audit trail.</p>
      </div>
      <ol className="grid md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.n} className={`hairline flex flex-col gap-5 border-b py-10 md:border-b-0 md:px-8 ${i === 0 ? 'md:pl-0' : 'md:border-l'}`}>
            <span className="label num">{s.n}</span>
            <h3 className="font-serif text-[40px] leading-none tracking-[-0.03em]">{s.title}</h3>
            <p className="font-serif text-[22px] leading-tight text-[#e9d9bf] italic">{s.lead}</p>
            <p className="text-muted">{s.body}</p>
            <code className="num mt-auto border-t border-line pt-4 text-[12px] text-faint">{s.code}</code>
          </li>
        ))}
      </ol>
      <footer className="hairline mt-[clamp(64px,10vh,120px)] flex flex-wrap items-end justify-between gap-6 border-t py-10">
        <Brand />
        <div className="flex flex-wrap gap-8 text-[13px]">
          <Link to="/dashboard" className="link-quiet">
            Open the sandbox ↗
          </Link>
          <a href={DOCS_URL} target="_blank" rel="noreferrer" className="link-quiet">
            Architecture & ADRs ↗
          </a>
          <a href="https://seoshiro.github.io" target="_blank" rel="noreferrer" className="link-quiet text-muted">
            Beibars Ileskhan ↗
          </a>
        </div>
      </footer>
    </section>
  );
}
