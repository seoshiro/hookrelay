import { describe, expect, it } from 'vitest';
import { sign, signatureHeaders, verify } from '../../security/hmac.ts';

const secret = 'whsec_test_secret';
const body = '{"id":"evt_1","type":"payment.succeeded"}';
const now = 1_760_000_000_000;

describe('hmac', () => {
  it('produces v1=<hex sha256> over "timestamp.body"', () => {
    expect(sign(secret, 1700000000, body)).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it('verifies its own headers', () => {
    const h = signatureHeaders(secret, 'evt_1', body, now);
    expect(verify(secret, { timestamp: h['x-hookrelay-timestamp'], signature: h['x-hookrelay-signature'] }, body, now)).toEqual({ ok: true });
  });

  it('rejects a tampered payload', () => {
    const h = signatureHeaders(secret, 'evt_1', body, now);
    const res = verify(secret, { timestamp: h['x-hookrelay-timestamp'], signature: h['x-hookrelay-signature'] }, body.replace('succeeded', 'refunded'), now);
    expect(res).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects the wrong secret', () => {
    const h = signatureHeaders(secret, 'evt_1', body, now);
    expect(verify('other', { timestamp: h['x-hookrelay-timestamp'], signature: h['x-hookrelay-signature'] }, body, now).ok).toBe(false);
  });

  it('rejects timestamps outside the 300s window (replay)', () => {
    const h = signatureHeaders(secret, 'evt_1', body, now);
    const later = now + 301_000;
    expect(verify(secret, { timestamp: h['x-hookrelay-timestamp'], signature: h['x-hookrelay-signature'] }, body, later)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects malformed headers without throwing', () => {
    expect(verify(secret, { timestamp: 'abc', signature: 'v1=00' }, body, now)).toEqual({ ok: false, reason: 'malformed' });
    expect(verify(secret, { timestamp: '1', signature: undefined }, body, now)).toEqual({ ok: false, reason: 'malformed' });
    expect(verify(secret, { timestamp: String(now / 1000), signature: 'v1=short' }, body, now)).toEqual({ ok: false, reason: 'mismatch' });
  });
});
