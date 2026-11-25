import { Fragment, useState, type FormEvent } from 'react';
import type { SourceView } from '../../api/hooks.ts';
import { CopyButton } from '../../components/CodeBlock.tsx';
import { SerifHeading } from '../../components/ui.tsx';
import { useSsrfCheck } from './useVault.ts';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function SsrfProbe() {
  const [url, setUrl] = useState('http://169.254.169.254/latest/meta-data');
  const check = useSsrfCheck();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    check.mutate(url);
  };
  const r = check.data;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">URL to check</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="hairline num h-9 w-full rounded-[2px] border bg-sunken px-3 text-[12px]" />
        </label>
        <button type="submit" disabled={check.isPending} className="h-9 border border-line-strong px-4 text-[12px] hover:border-ink disabled:opacity-40">
          Check
        </button>
      </div>
      <p className="num min-h-[18px] text-[12px]" aria-live="polite">
        {r && r.ok && <span className="text-ok">✓ SSRF guard: public IP verified · {r.addresses.join(', ')}</span>}
        {r && !r.ok && <span className="text-dlq">✕ Blocked · {r.message}</span>}
        {check.error && <span className="text-dlq">{check.error.message}</span>}
        {!r && !check.error && <span className="text-faint">Try 127.0.0.1, [::ffff:127.0.0.1] or https://example.com</span>}
      </p>
    </form>
  );
}

export function IngestionPanel({ source }: { source: SourceView | undefined }) {
  const ep = source?.endpoint;
  const schedule = ep ? [...ep.retrySchedule, 'DLQ'] : [];
  return (
    <section aria-label="Ingestion and SSRF guard" className="flex flex-col gap-7 py-9 lg:pr-10">
      <div className="flex flex-wrap items-baseline gap-4">
        <SerifHeading>Ingestion & SSRF guard</SerifHeading>
        <span className="label text-ok">Active</span>
      </div>
      <Field label="Ingestion URL">
        <div className="flex items-center justify-between gap-4">
          <code className="num truncate text-[13px]">{source?.ingestUrl ?? '…'}</code>
          {source && <CopyButton text={source.ingestUrl} />}
        </div>
      </Field>
      <Field label="Target URL">
        <code className="num truncate text-[13px] text-muted">{ep?.targetUrl ?? '…'}</code>
        {source?.isSandbox && <span className="text-[12px] text-faint">Answered in-process. The guard stays strict for every real endpoint.</span>}
      </Field>
      <Field label="Check any URL against the guard">
        <SsrfProbe />
      </Field>
      <Field label={`Retry schedule · ${ep?.maxAttempts ?? '–'} attempts`}>
        <ol className="num flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
          {schedule.map((s, i) => (
            <Fragment key={`${s}-${i}`}>
              {i > 0 && <li aria-hidden className="h-px w-8 bg-line-strong md:w-12" />}
              <li className={s === 'DLQ' ? 'hairline border px-2 py-0.5 text-[12px] text-dlq' : ''}>{s}</li>
            </Fragment>
          ))}
        </ol>
      </Field>
    </section>
  );
}
