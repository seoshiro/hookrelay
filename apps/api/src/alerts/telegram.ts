import { request } from 'undici';

export interface TelegramTarget {
  botToken: string;
  chatId: string;
}

export async function sendTelegram(target: TelegramTarget, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d+:[\w-]{20,}$/.test(target.botToken)) return { ok: false, error: 'Bot token has an invalid format' };
  try {
    const res = await request(`https://api.telegram.org/bot${target.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: target.chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      headersTimeout: 5000,
      bodyTimeout: 5000,
    });
    const body = (await res.body.json()) as { ok?: boolean; description?: string };
    return body.ok ? { ok: true } : { ok: false, error: body.description ?? `HTTP ${res.statusCode}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function dlqAlertText(e: { id: string; eventType: string; attempts: number; lastStatusCode: number | null; targetUrl: string }): string {
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
  return [
    '<b>HookRelay · dead letter</b>',
    `<code>${esc(e.id)}</code> ${esc(e.eventType)}`,
    `${e.attempts} attempts, last status ${e.lastStatusCode ?? 'network error'}`,
    esc(e.targetUrl),
  ].join('\n');
}

export function maskToken(token: string | null): string | null {
  return token ? `${token.slice(0, 4)}••••${token.slice(-4)}` : null;
}
