import { useState, type FormEvent } from 'react';
import { Button, SerifHeading, Empty } from '../../components/ui.tsx';
import { CopyButton } from '../../components/CodeBlock.tsx';
import { relativeTime } from '../../lib/format.ts';
import { useApiKeys, useVaultMutations } from './useVault.ts';

export function ApiKeysPanel() {
  const keys = useApiKeys(true);
  const m = useVaultMutations();
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    m.createKey.mutate(name.trim(), {
      onSuccess: (r) => {
        setSecret(r.secret);
        setName('');
      },
    });
  };

  return (
    <section aria-label="API keys" className="flex flex-col gap-6">
      <SerifHeading>API keys</SerifHeading>
      <form onSubmit={create} className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Key name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name, e.g. Production" className="hairline h-9 w-full rounded-[2px] border bg-sunken px-3 text-[13px]" />
        </label>
        <Button type="submit" variant="primary" disabled={m.createKey.isPending}>
          + Create key
        </Button>
      </form>
      {secret && (
        <div className="hairline flex flex-col gap-2 border border-accent/50 p-4" role="status">
          <span className="label text-accent">Shown once — store it now</span>
          <code className="num text-[12px] break-all">{secret}</code>
          <CopyButton text={secret} />
        </div>
      )}
      {keys.data?.length === 0 ? (
        <Empty>No keys yet.</Empty>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line-strong">
              {['Name', 'Key', 'Created', ''].map((h) => (
                <th key={h} scope="col" className="label pb-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.data?.map((k) => (
              <tr key={k.id} className="hairline border-b">
                <td className="py-3 pr-3">{k.name}</td>
                <td className="num pr-3 text-[12px] text-muted">{k.prefix}…</td>
                <td className="num pr-3 text-[12px] text-muted">{relativeTime(k.createdAt)}</td>
                <td className="text-right">
                  <button type="button" onClick={() => m.revokeKey.mutate(k.id)} className="text-[12px] text-muted hover:text-dlq">
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
