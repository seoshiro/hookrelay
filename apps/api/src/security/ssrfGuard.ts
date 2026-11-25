import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export class SsrfError extends Error {
  constructor(message: string, readonly code: 'SCHEME' | 'CREDENTIALS' | 'PRIVATE_IP' | 'DNS' | 'INVALID_URL') {
    super(message);
    this.name = 'SsrfError';
  }
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');

/** Unwraps IPv4-mapped IPv6 (`::ffff:127.0.0.1`, `::ffff:7f00:1`) so it is checked as IPv4. */
function normalize(address: string): { address: string; family: 'ipv4' | 'ipv6' } {
  const lower = address.toLowerCase();
  const mapped = /^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return { address: mapped[1], family: 'ipv4' };
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hexMapped?.[1] && hexMapped[2]) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    return { address: `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, family: 'ipv4' };
  }
  return { address: lower, family: isIP(lower) === 6 ? 'ipv6' : 'ipv4' };
}

export function isPrivateAddress(address: string): boolean {
  const n = normalize(address);
  return blocked.check(n.address, n.family);
}

export type Resolver = (hostname: string) => Promise<string[]>;

const systemResolver: Resolver = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map((r) => r.address);

/** Validates an outbound URL and returns the resolved public addresses. Throws SsrfError otherwise. */
export async function assertPublicUrl(raw: string, resolve: Resolver = systemResolver): Promise<{ url: URL; addresses: string[] }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError('URL is not valid', 'INVALID_URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SsrfError(`Scheme ${url.protocol} is not allowed`, 'SCHEME');
  if (url.username || url.password) throw new SsrfError('Credentials in URL are not allowed', 'CREDENTIALS');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    try {
      addresses = await resolve(host);
    } catch {
      throw new SsrfError(`DNS lookup failed for ${host}`, 'DNS');
    }
  }
  if (addresses.length === 0) throw new SsrfError(`No addresses for ${host}`, 'DNS');
  const bad = addresses.find(isPrivateAddress);
  if (bad) throw new SsrfError(`${host} resolves to private address ${bad}`, 'PRIVATE_IP');
  return { url, addresses };
}
