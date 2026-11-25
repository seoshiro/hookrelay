import { useState, type FormEvent } from 'react';
import { Button, SerifHeading } from '../../components/ui.tsx';
import { CopyButton } from '../../components/CodeBlock.tsx';
import { useVaultMutations } from './useVault.ts';

export function NewSourceForm() {
  const { createSource } = useVaultMutations();
  const [name, setName] = useState('Production webhooks');
  const [targetUrl, setTargetUrl] = useState('https://');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    createSource.mutate({ name, targetUrl });
  };
  return (
    <section aria-label="Create a source" className="hairline grid gap-8 border-b py-9 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-4">
        <SerifHeading>Create your first source.</SerifHeading>
        <p className="max-w-[44ch] text-muted">A source gets its own ingest URL and signing secret. Point Stripe, GitHub or anything that sends webhooks at it, and HookRelay forwards to your target.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="hairline h-10 rounded-[2px] border bg-sunken px-3 text-[13px]" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label">Target URL (public, http/https)</span>
          <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} required className="hairline num h-10 rounded-[2px] border bg-sunken px-3 text-[12px]" />
        </label>
        {createSource.error && (
          <p role="alert" className="text-[12px] text-dlq">
            {createSource.error.message}
          </p>
        )}
        {createSource.data && (
          <div role="status" className="flex flex-col gap-2 border border-accent/50 p-4">
            <span className="label text-accent">Signing secret</span>
            <code className="num text-[12px] break-all">{createSource.data.signingSecret}</code>
            <CopyButton text={createSource.data.signingSecret} />
          </div>
        )}
        <Button type="submit" variant="primary" disabled={createSource.isPending} className="self-start">
          Create source
        </Button>
      </form>
    </section>
  );
}
