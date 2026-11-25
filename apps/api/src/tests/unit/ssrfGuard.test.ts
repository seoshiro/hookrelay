import { describe, expect, it } from 'vitest';
import { assertPublicUrl, isPrivateAddress, SsrfError } from '../../security/ssrfGuard.ts';

const resolveTo = (...ips: string[]) => async () => ips;

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe'])(
    'blocks %s',
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows %s', (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe('assertPublicUrl', () => {
  it('passes a public host', async () => {
    const { addresses } = await assertPublicUrl('https://example.com/hook', resolveTo('93.184.215.14'));
    expect(addresses).toEqual(['93.184.215.14']);
  });

  it.each([
    ['http://127.0.0.1/admin', 'PRIVATE_IP'],
    ['http://10.0.0.1/', 'PRIVATE_IP'],
    ['http://169.254.169.254/latest/meta-data', 'PRIVATE_IP'],
    ['http://[::1]:8080/', 'PRIVATE_IP'],
    ['http://[::ffff:127.0.0.1]/', 'PRIVATE_IP'],
    ['file:///etc/passwd', 'SCHEME'],
    ['gopher://example.com', 'SCHEME'],
    ['https://user:pass@example.com', 'CREDENTIALS'],
    ['not a url', 'INVALID_URL'],
  ])('rejects %s (%s)', async (url, code) => {
    await expect(assertPublicUrl(url, resolveTo('93.184.215.14'))).rejects.toMatchObject({ code });
  });

  it('rejects a hostname when any resolved address is private', async () => {
    await expect(assertPublicUrl('https://rebind.example', resolveTo('93.184.215.14', '127.0.0.1'))).rejects.toBeInstanceOf(SsrfError);
  });

  it('reports DNS failures as SsrfError', async () => {
    const failing = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(assertPublicUrl('https://nope.invalid', failing)).rejects.toMatchObject({ code: 'DNS' });
  });
});
