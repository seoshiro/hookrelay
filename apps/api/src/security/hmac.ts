import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_TOLERANCE_SEC = 300;

export function generateSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}

export function sign(secret: string, timestamp: number, rawBody: string): string {
  return `v1=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

export function signatureHeaders(secret: string, eventId: string, rawBody: string, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  return {
    'x-hookrelay-event-id': eventId,
    'x-hookrelay-timestamp': String(timestamp),
    'x-hookrelay-signature': sign(secret, timestamp, rawBody),
  };
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'malformed' | 'expired' | 'mismatch' };

export function verify(
  secret: string,
  header: { timestamp: string | undefined; signature: string | undefined },
  rawBody: string,
  now = Date.now(),
): VerifyResult {
  const ts = Number(header.timestamp);
  if (!header.signature?.startsWith('v1=') || !Number.isInteger(ts)) return { ok: false, reason: 'malformed' };
  if (Math.abs(Math.floor(now / 1000) - ts) > SIGNATURE_TOLERANCE_SEC) return { ok: false, reason: 'expired' };
  const expected = Buffer.from(sign(secret, ts, rawBody));
  const given = Buffer.from(header.signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'mismatch' };
  return { ok: true };
}
