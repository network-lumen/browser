import { describe, expect, it } from 'vitest';
import {
  buildCandidateUrl,
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
