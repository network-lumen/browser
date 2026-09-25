import { describe, expect, it } from 'vitest';
import {
  buildCandidateUrl,
  gatewayMediaUrl,
  webHrefToLumenUrl,
  isCidLike,
  normalizePath,
  pickRecordTarget,
} from '../../src/internal/services/contentResolver';
import type { DomainTarget, ResolverRecord } from '../../src/types/domain';

/**
 * Turning a domain's on-chain records into a URL to fetch.
 *
 * Two decisions live here and both are deliberate. The record keys are tried
 * in a fixed order - a domain with both `cid` and `ipns` set resolves to the
 * `cid`, every time - and a CIDv1 on a local gateway is served from an
 * `<cid>.ipfs.localhost` subdomain, because an SPA built with absolute paths
 * requests `/assets/x.js` and a path-based gateway answers that with the
 * gateway's own root instead of the site's.
 */

const records = (map: Record<string, string>): ResolverRecord[] =>
  Object.entries(map).map(([key, value]) => ({ key, value }));

const CID_V0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
const CID_V1 = 'bafybeigdyrztktx5w6c7ldrmpmuvxvmxvzgmz2gk3qk3sczlnbltbztbla';

describe('normalizePath', () => {
  it('always yields something rooted', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('   ')).toBe('/');
    expect(normalizePath('a/b')).toBe('/a/b');
    expect(normalizePath('/a/b')).toBe('/a/b');
  });

  it('drops the query and the fragment, which belong to the caller', () => {
    expect(normalizePath('/a?x=1')).toBe('/a');
    expect(normalizePath('/a#top')).toBe('/a');
    expect(normalizePath('/a?x=1#top')).toBe('/a');
  });
});

describe('isCidLike', () => {
  it('recognises a v0 and a v1 CID', () => {
    expect(isCidLike(CID_V0)).toBe(true);
    expect(isCidLike(CID_V1)).toBe(true);
  });

  it('rejects things that merely look close', () => {
    expect(isCidLike('Qmtooshort')).toBe(false);
    expect(isCidLike('bafy')).toBe(false);
    expect(isCidLike('example.lumen')).toBe(false);
    expect(isCidLike('')).toBe(false);
    expect(isCidLike(null as never)).toBe(false);
  });
});

describe('pickRecordTarget', () => {
  it('reads each protocol spelling a record may use', () => {
    expect(pickRecordTarget(records({ cid: `ipfs://${CID_V1}` }))).toMatchObject({ proto: 'ipfs', id: CID_V1 });
    expect(pickRecordTarget(records({ cid: `/ipfs/${CID_V1}` }))).toMatchObject({ proto: 'ipfs', id: CID_V1 });
    expect(pickRecordTarget(records({ cid: `lumen://ipfs/${CID_V1}` }))).toMatchObject({ proto: 'ipfs', id: CID_V1 });
    expect(pickRecordTarget(records({ cid: CID_V1 }))).toMatchObject({ proto: 'ipfs', id: CID_V1 });
    expect(pickRecordTarget(records({ ipns: 'ipns://k51abc' }))).toMatchObject({ proto: 'ipns', id: 'k51abc' });
  });

  it('accepts a bare name under the ipns key, which a plain CID rule would reject', () => {
    expect(pickRecordTarget(records({ ipns: 'k51qzi5uqu5dk' }))).toMatchObject({ proto: 'ipns', id: 'k51qzi5uqu5dk' });
  });

  it('prefers cid over everything else', () => {
    // A domain carrying both must resolve the same way on every machine.
    const target = pickRecordTarget(records({ ipns: 'ipns://k51abc', cid: `ipfs://${CID_V1}` }));
    expect(target).toMatchObject({ proto: 'ipfs', id: CID_V1 });
  });

  it('falls down the key order when the preferred key is unusable', () => {
    expect(pickRecordTarget(records({ cid: 'not a target', ipns: 'ipns://k51abc' })))
      .toMatchObject({ proto: 'ipns', id: 'k51abc' });
  });

  it('keeps a path carried by the record, and the query with it', () => {
    expect(pickRecordTarget(records({ cid: `ipfs://${CID_V1}/site/index.html?v=2` })))
      .toMatchObject({ proto: 'ipfs', id: CID_V1, basePath: '/site/index.html', suffix: '?v=2' });
  });

  it('ignores a key nobody asked for', () => {
    expect(pickRecordTarget(records({ email: 'a@b.c' }))).toBeNull();
  });

  it('returns null rather than a half-built target', () => {
    expect(pickRecordTarget([])).toBeNull();
    expect(pickRecordTarget(records({ cid: '' }))).toBeNull();
    expect(pickRecordTarget(records({ cid: 'ipfs://' }))).toBeNull();
    expect(pickRecordTarget(null as never)).toBeNull();
  });
});

describe('buildCandidateUrl', () => {
  const ipfs = (id: string, rest: Partial<DomainTarget> = {}): DomainTarget =>
    ({ proto: 'ipfs', id, ...rest }) as DomainTarget;

  it('builds a path-based URL for a remote gateway', () => {
    expect(buildCandidateUrl('https://ipfs.io', ipfs(CID_V1), '/', ''))
      .toBe(`https://ipfs.io/ipfs/${CID_V1}/`);
  });

  it('does not double the slash when the base carries one', () => {
    expect(buildCandidateUrl('https://ipfs.io/', ipfs(CID_V1), '/a', ''))
      .toBe(`https://ipfs.io/ipfs/${CID_V1}/a`);
  });

  it('serves a CIDv1 from a subdomain on a local gateway', () => {
    // Without this an SPA asking for /assets/x.js gets the gateway's root.
    expect(buildCandidateUrl('http://127.0.0.1:8080', ipfs(CID_V1), '/assets/x.js', ''))
      .toBe(`http://${CID_V1}.ipfs.localhost:8080/assets/x.js`);
  });

  it('keeps CIDv0 on the path even locally, because DNS would lowercase it', () => {
    // A v0 CID is case-sensitive base58; a subdomain is not.
    expect(buildCandidateUrl('http://127.0.0.1:8080', ipfs(CID_V0), '/', ''))
      .toBe(`http://127.0.0.1:8080/ipfs/${CID_V0}/`);
  });

  it('leaves a remote gateway on the path even for a CIDv1', () => {
    expect(buildCandidateUrl('https://ipfs.io', ipfs(CID_V1), '/a', ''))
      .toContain('https://ipfs.io/ipfs/');
  });

  it('prefixes the record’s own base path', () => {
    const target = ipfs(CID_V1, { basePath: '/site' });
    expect(buildCandidateUrl('https://ipfs.io', target, '/page', ''))
      .toBe(`https://ipfs.io/ipfs/${CID_V1}/site/page`);
  });

  it('does not repeat a base path the caller already included', () => {
    const target = ipfs(CID_V1, { basePath: '/site' });
    expect(buildCandidateUrl('https://ipfs.io', target, '/site/page', ''))
      .toBe(`https://ipfs.io/ipfs/${CID_V1}/site/page`);
  });

  it('lands on the base path itself for the root request', () => {
    const target = ipfs(CID_V1, { basePath: '/site' });
    expect(buildCandidateUrl('https://ipfs.io', target, '/', ''))
      .toBe(`https://ipfs.io/ipfs/${CID_V1}/site/`);
  });

  it('applies the record’s own suffix only at the root', () => {
    const target = ipfs(CID_V1, { suffix: '?v=2' });
    expect(buildCandidateUrl('https://ipfs.io', target, '/', '')).toContain('?v=2');
    expect(buildCandidateUrl('https://ipfs.io', target, '/page', '')).not.toContain('?v=2');
  });

  it('lets the caller’s suffix win', () => {
    const target = ipfs(CID_V1, { suffix: '?v=2' });
    expect(buildCandidateUrl('https://ipfs.io', target, '/', '#top')).toContain('#top');
  });

  it('builds an ipns URL the same way', () => {
    expect(buildCandidateUrl('https://ipfs.io', { proto: 'ipns', id: 'k51abc' } as DomainTarget, '/', ''))
      .toBe('https://ipfs.io/ipns/k51abc/');
  });

  it('survives a base that is not a URL at all', () => {
    // The subdomain branch parses the base; a bad one must fall through to the
    // path form rather than throw inside a resolver.
    expect(() => buildCandidateUrl('not a url', ipfs(CID_V1), '/', '')).not.toThrow();
  });
});

/**
 * The URL a media element gets, which is not the one a document gets.
 *
 * Measured on Android, on a directory CID holding one mp4: the subdomain form
 * never loads - `readyState 0`, no error, forever - while the path form has
 * metadata in under a second. Playback is handed to the platform's own
 * pipeline, which does not go through the WebView request interceptor that
 * makes `<cid>.ipfs.localhost` answer at all, so the name has to resolve for
 * real and nothing resolves it.
 */
describe('gatewayMediaUrl', () => {
  const CID = 'bafybeifrmi3wdmxopdykacbezbosep5jttretvix3czpjhyyrsqx6u3ds4';

  it('uses the path form, never the subdomain the interceptor invents', () => {
    const url = gatewayMediaUrl('http://127.0.0.1:8088', 'ipfs', CID, 'Earl S01 E02.mp4');
    expect(url).toBe(`http://127.0.0.1:8088/ipfs/${CID}/Earl%20S01%20E02.mp4`);
    expect(url).not.toContain('.ipfs.localhost');
  });

  it('encodes each segment without eating the separators', () => {
    expect(gatewayMediaUrl('http://127.0.0.1:8088', 'ipfs', CID, 'My Shows/S01 E01.mp4')).toBe(
      `http://127.0.0.1:8088/ipfs/${CID}/My%20Shows/S01%20E01.mp4`
    );
  });

  it('does not encode an already-encoded path twice', () => {
    // The page hands over what the address bar held, which is already encoded:
    // encoding it again would ask the gateway for a file named "%2520".
    expect(gatewayMediaUrl('http://127.0.0.1:8088', 'ipfs', CID, 'S01%20E01.mp4')).toBe(
      `http://127.0.0.1:8088/ipfs/${CID}/S01%20E01.mp4`
    );
  });

  it('keeps ipns as its own namespace', () => {
    expect(gatewayMediaUrl('http://127.0.0.1:8088', 'ipns', 'k51example', 'a.mp4')).toBe(
      'http://127.0.0.1:8088/ipns/k51example/a.mp4'
    );
  });

  it('addresses the root when there is no path', () => {
    expect(gatewayMediaUrl('http://127.0.0.1:8088/', 'ipfs', CID, '')).toBe(
      `http://127.0.0.1:8088/ipfs/${CID}`
    );
  });

  it('carries a query or fragment through', () => {
    expect(gatewayMediaUrl('http://127.0.0.1:8088', 'ipfs', CID, 'a.mp4', '?t=30')).toBe(
      `http://127.0.0.1:8088/ipfs/${CID}/a.mp4?t=30`
    );
  });

  it('has nothing to build without a CID', () => {
    expect(gatewayMediaUrl('http://127.0.0.1:8088', 'ipfs', '', 'a.mp4')).toBe('');
  });
});

/**
 * The URL the address bar shows while a site navigates inside itself.
 *
 * A site under a domain is loaded from one of two places: the custom scheme
 * origin the desktop registers - `lumen://lumen.lmn/community/` - or a gateway
 * address on mobile. Only the gateway shapes were handled, so on the desktop
 * clicking a link inside a site left the bar on the page it was opened at, and
 * with no history entry for what was on screen the back button walked out of
 * the site entirely.
 */
describe('webHrefToLumenUrl', () => {
  const CID = 'bafybeifsjp2ukyhteh7svhnfezyrwcbws4xznynrdqhphm3a4q6embktlq';
  const ctx = (basePath?: string) => ({
    host: 'lumen.lmn',
    target: { proto: 'ipfs' as const, id: CID, ...(basePath ? { basePath } : {}) }
  });

  it('reads the custom scheme the desktop serves a site from', () => {
    expect(webHrefToLumenUrl('lumen://lumen.lmn/community/', ctx())).toBe(
      'lumen://lumen.lmn/community/'
    );
  });

  it('keeps a query and a fragment, which a router uses', () => {
    expect(webHrefToLumenUrl('lumen://lumen.lmn/docs/?page=2#install', ctx())).toBe(
      'lumen://lumen.lmn/docs/?page=2#install'
    );
  });

  it('refuses another domain on that scheme', () => {
    // A site must not be able to put someone else's address in the bar.
    expect(webHrefToLumenUrl('lumen://evil.lmn/community/', ctx())).toBeNull();
  });

  it('reads the path form of a gateway URL', () => {
    expect(webHrefToLumenUrl(`http://127.0.0.1:8088/ipfs/${CID}/docs/`, ctx())).toBe(
      'lumen://lumen.lmn/docs/'
    );
  });

  it('reads the subdomain form too', () => {
    expect(webHrefToLumenUrl(`http://${CID}.ipfs.localhost:8088/docs/`, ctx())).toBe(
      'lumen://lumen.lmn/docs/'
    );
  });

  it('refuses a gateway URL for another CID', () => {
    expect(webHrefToLumenUrl('http://127.0.0.1:8088/ipfs/bafyother/docs/', ctx())).toBeNull();
  });

  it('shows the directory rather than its index.html', () => {
    expect(webHrefToLumenUrl(`http://127.0.0.1:8088/ipfs/${CID}/docs/index.html`, ctx())).toBe(
      'lumen://lumen.lmn/docs/'
    );
  });

  it('strips the basePath, which belongs to the target and not to the address', () => {
    const url = `http://127.0.0.1:8088/ipfs/${CID}/site/docs/`;
    expect(webHrefToLumenUrl(url, ctx('/site'))).toBe('lumen://lumen.lmn/docs/');
  });

  it('answers null rather than guessing, when there is nothing to map', () => {
    expect(webHrefToLumenUrl('https://example.com/docs/', ctx())).toBeNull();
    expect(webHrefToLumenUrl('', ctx())).toBeNull();
    expect(webHrefToLumenUrl('not a url', ctx())).toBeNull();
    expect(webHrefToLumenUrl('lumen://lumen.lmn/', null)).toBeNull();
  });
});
