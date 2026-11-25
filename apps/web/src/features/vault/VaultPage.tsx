import { Masthead } from '../../components/ui.tsx';
import { useMe, useSandboxSource } from '../../api/hooks.ts';
import { useConsole } from '../../store/console.ts';
import { useSources } from './useVault.ts';
import { IngestionPanel } from './IngestionPanel.tsx';
import { SigningPanel } from './SigningPanel.tsx';
import { QueueHealth } from './QueueHealth.tsx';
import { ApiKeysPanel } from './ApiKeysPanel.tsx';
import { AccountForm } from './AccountForm.tsx';
import { NewSourceForm } from './NewSourceForm.tsx';

export function VaultPage() {
  const { data: me } = useMe();
  const workspace = useConsole((s) => s.workspace);
  const sandbox = useSandboxSource();
  const mine = useSources(!!me && workspace === 'mine');
  const own = workspace === 'mine' && !!me;
  const source = own ? mine.data?.[0] : sandbox.data;

  return (
    <>
      <Masthead
        index="04 / 04 — Endpoints"
        meta="SSRF · HMAC · Alerts"
        title={
          <>
            Endpoints & <em className="text-muted">keys.</em>
          </>
        }
        aside={
          own
            ? 'Your source: where webhooks come in, where they go, how they are signed and who is told when one dies.'
            : 'This is the public sandbox source. Sign in and switch to My sources to point HookRelay at your own receiver.'
        }
      />
      {own && !mine.isPending && !source ? (
        <NewSourceForm />
      ) : (
        <div className="hairline grid border-b lg:grid-cols-[1.35fr_1fr]">
          <IngestionPanel source={source} />
          <SigningPanel source={source} editable={own} />
        </div>
      )}
      <div className="hairline grid border-b lg:grid-cols-[1.35fr_1fr]">
        <QueueHealth />
        <div id="account" className="hairline scroll-mt-24 border-t py-9 lg:border-t-0 lg:border-l lg:pl-10">
          {me ? <ApiKeysPanel /> : <AccountForm />}
        </div>
      </div>
    </>
  );
}
