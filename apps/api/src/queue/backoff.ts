export const PROD_BASE_DELAY_MS = 5_000;
export const PROD_MAX_DELAY_MS = 30 * 60_000;
export const SANDBOX_SCHEDULE_MS = [1_000, 2_000, 3_000];

/**
 * Delay before the next attempt, given how many attempts already ran.
 * Production: 5s · 5^(n-1), capped at 30m → 5s, 25s, ~2m, ~10m, 30m. ±10% jitter avoids thundering herds.
 * Sandbox: fixed 1s, 2s, 3s so a visitor sees the full retry → DLQ cycle within seconds.
 */
export function nextDelayMs(attemptsDone: number, opts: { sandbox: boolean; random?: () => number }): number {
  if (attemptsDone < 1) throw new RangeError('attemptsDone must be >= 1');
  if (opts.sandbox) return SANDBOX_SCHEDULE_MS[Math.min(attemptsDone, SANDBOX_SCHEDULE_MS.length) - 1]!;
  const base = Math.min(PROD_BASE_DELAY_MS * 5 ** (attemptsDone - 1), PROD_MAX_DELAY_MS);
  const jitter = 1 + ((opts.random ?? Math.random)() * 0.2 - 0.1);
  return Math.round(base * jitter);
}

export function scheduleLabels(maxAttempts: number, sandbox: boolean): string[] {
  const fmt = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)}m`);
  return Array.from({ length: Math.max(maxAttempts - 1, 0) }, (_, i) =>
    fmt(sandbox ? nextDelayMs(i + 1, { sandbox }) : Math.min(PROD_BASE_DELAY_MS * 5 ** i, PROD_MAX_DELAY_MS)),
  );
}
