import { createHash, randomBytes } from 'node:crypto';

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Returns the plaintext key exactly once; only the hash and prefix are stored. */
export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const key = `hr_live_${randomBytes(16).toString('hex')}`;
  return { key, prefix: key.slice(0, 12), keyHash: hashKey(key) };
}

export function generateIngestKey(sandbox = false): string {
  return `${sandbox ? 'src_sbx' : 'src_live'}_${randomBytes(12).toString('hex')}`;
}

export function newEventId(): string {
  // time-ordered: ms timestamp + random tail, so ids sort by creation
  return `evt_${Date.now().toString(36)}${randomBytes(5).toString('hex')}`;
}
