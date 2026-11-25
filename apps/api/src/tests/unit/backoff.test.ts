import { describe, expect, it } from 'vitest';
import { nextDelayMs, scheduleLabels } from '../../queue/backoff.ts';

const noJitter = () => 0.5; // maps to a 1.0 multiplier

describe('backoff', () => {
  it('grows 5s · 5^(n-1)', () => {
    expect([1, 2, 3, 4].map((n) => nextDelayMs(n, { sandbox: false, random: noJitter }))).toEqual([5_000, 25_000, 125_000, 625_000]);
  });

  it('caps at 30 minutes', () => {
    expect(nextDelayMs(5, { sandbox: false, random: noJitter })).toBe(1_800_000);
    expect(nextDelayMs(20, { sandbox: false, random: noJitter })).toBe(1_800_000);
  });

  it('keeps jitter within ±10%', () => {
    expect(nextDelayMs(1, { sandbox: false, random: () => 0 })).toBe(4_500);
    expect(nextDelayMs(1, { sandbox: false, random: () => 0.999999 })).toBeLessThanOrEqual(5_500);
  });

  it('uses the short 1s/2s/3s sandbox schedule', () => {
    expect([1, 2, 3, 9].map((n) => nextDelayMs(n, { sandbox: true }))).toEqual([1_000, 2_000, 3_000, 3_000]);
  });

  it('rejects attempt 0', () => {
    expect(() => nextDelayMs(0, { sandbox: false })).toThrow(RangeError);
  });

  it('labels the production schedule', () => {
    expect(scheduleLabels(6, false)).toEqual(['5s', '25s', '2m', '10m', '30m']);
    expect(scheduleLabels(3, true)).toEqual(['1s', '2s']);
  });
});
