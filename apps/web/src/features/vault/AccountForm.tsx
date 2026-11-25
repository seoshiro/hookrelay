import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.ts';
import { Button, SerifHeading } from '../../components/ui.tsx';
import { useConsole } from '../../store/console.ts';

export function AccountForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const qc = useQueryClient();
  const setWorkspace = useConsole((s) => s.setWorkspace);
  const submit = useMutation({
    mutationFn: () => api(`/api/auth/${mode}`, { method: 'POST', body: { email, password } }),
    onSuccess: async () => {
      setWorkspace('mine');
      await qc.invalidateQueries();
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit.mutate();
  };

  return (
    <section aria-label="Account" className="flex flex-col gap-6">
      <SerifHeading>{mode === 'login' ? 'Sign in' : 'Create an account'}</SerifHeading>
      <p className="text-[13px] text-muted">Your own sources, API keys and Telegram alerts. The sandbox stays open without an account.</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="label">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="hairline h-10 rounded-[2px] border bg-sunken px-3 text-[13px]" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label">Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="hairline h-10 rounded-[2px] border bg-sunken px-3 text-[13px]"
          />
        </label>
        {submit.error && (
          <p className="text-[12px] text-dlq" role="alert">
            {submit.error.message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-5">
          <Button type="submit" variant="primary" disabled={submit.isPending}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="link-quiet text-[13px] text-muted">
            {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </button>
        </div>
      </form>
    </section>
  );
}
