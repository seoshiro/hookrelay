import { useState, type FormEvent } from 'react';
import type { SourceView } from '../../api/hooks.ts';
import { Button, SerifHeading } from '../../components/ui.tsx';
import { CopyButton } from '../../components/CodeBlock.tsx';
import { useVaultMutations } from './useVault.ts';

const inputClass = 'hairline num h-9 rounded-[2px] border bg-sunken px-3 text-[12px]';

function TelegramForm({ source }: { source: SourceView }) {
  const m = useVaultMutations();
  const tg = source.endpoint?.telegram;
  const [token, setToken] = useState('');
  const [chat, setChat] = useState(tg?.chatId ?? '');
  const error = m.testTelegram.error ?? m.updateSource.error;
  const save = (e: FormEvent) => {
    e.preventDefault();
    m.updateSource.mutate({ id: source.id, telegramBotToken: token || undefined, telegramChatId: chat || null });
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={tg?.botToken ?? 'Bot token'} aria-label="Telegram bot token" className={inputClass} />
      <input value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Chat id" aria-label="Telegram chat id" className={inputClass} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={m.updateSource.isPending}>
          Save
        </Button>
        <Button type="button" variant="ghost" disabled={!tg?.configured || m.testTelegram.isPending} onClick={() => source.endpoint && m.testTelegram.mutate(source.endpoint.id)}>
          Send test alert ↗
        </Button>
      </div>
      <p className="text-[12px]" aria-live="polite">
        {m.testTelegram.isSuccess && <span className="text-ok">Test alert delivered.</span>}
        {error && <span className="text-dlq">{error.message}</span>}
      </p>
    </form>
  );
}

export function SigningPanel({ source, editable }: { source: SourceView | undefined; editable: boolean }) {
  const m = useVaultMutations();
  const [secret, setSecret] = useState<string | null>(null);
  const shown = secret ?? source?.signingSecretPreview ?? '…';
  const showSecret = (r: { signingSecret: string }) => setSecret(r.signingSecret);
  return (
    <section aria-label="Signing and alerts" className="hairline flex flex-col gap-7 border-t py-9 lg:border-t-0 lg:border-l lg:pl-10">
      <SerifHeading>HMAC-SHA256 & alerts</SerifHeading>
      <div className="flex flex-col gap-3">
        <span className="label">Signing secret</span>
        <code className="num text-[13px] break-all">{shown}</code>
        {editable && source ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => m.revealSecret.mutate(source.id, { onSuccess: showSecret })}>Reveal</Button>
            <Button onClick={() => m.rotateSecret.mutate(source.id, { onSuccess: showSecret })}>Rotate</Button>
            {secret && <CopyButton text={secret} />}
          </div>
        ) : (
          <p className="text-[12px] text-faint">The sandbox secret stays server-side. Deliveries carry X-HookRelay-Signature: v1=…</p>
        )}
      </div>
      <div className="hairline flex flex-col gap-3 border-t pt-7">
        <span className="label">Telegram alerts on dead letter</span>
        {editable && source ? (
          <TelegramForm source={source} />
        ) : (
          <p className="text-[13px] text-muted">Sign in to connect a bot. Each event that exhausts its retries posts its id, attempts and last status to your chat.</p>
        )}
      </div>
    </section>
  );
}
