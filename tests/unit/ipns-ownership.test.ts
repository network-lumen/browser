import { beforeEach, describe, expect, it } from 'vitest';
import { stubElectron, type ElectronStub } from './support/electronStub';

/**
 * Which site owns an IPNS key name.
 *
 * `window.lumen.ipfsPublishToIPNS(cid, key)` takes the name from the page, and
 * the keys live on the one local node every site shares. Nothing tied a name to
 * a caller, so a site that knew the name another site publishes its live stream
 * under could publish over it - whoever published last decided what the name
 * resolved to.
 *
 * Ownership on first use, rather than a per-site namespace, because a site
 * publishes under a name and then resolves that same name back.
 */

let env: ElectronStub;
let ipns: any;

const SITE_A = 'domain:a.lmn';
const SITE_B = 'domain:b.lmn';

beforeEach(() => {
  env = stubElectron();
  ipns = env.load('sites/ipns_ownership.cjs');
});

describe('claiming a name', () => {
  it('gives a free name to the first site that publishes under it', () => {
    expect(ipns.claimKeyForSite('live', SITE_A)).toEqual({ ok: true });
    expect(ipns.ownerOfKey('live')).toBe(SITE_A);
  });

  it('lets the owner keep publishing under it', () => {
    ipns.claimKeyForSite('live', SITE_A);
    expect(ipns.claimKeyForSite('live', SITE_A)).toEqual({ ok: true });
  });

  it('refuses a name another site already publishes under', () => {
    ipns.claimKeyForSite('live', SITE_A);
    expect(ipns.claimKeyForSite('live', SITE_B)).toEqual({
      ok: false,
      error: 'key_owned_by_another_site',
    });
    expect(ipns.ownerOfKey('live')).toBe(SITE_A);
  });

  it('survives a restart, or the name would be free again next launch', () => {
    ipns.claimKeyForSite('live', SITE_A);
    const reloaded = env.load<any>('sites/ipns_ownership.cjs');
    expect(reloaded.claimKeyForSite('live', SITE_B)).toEqual({
      ok: false,
      error: 'key_owned_by_another_site',
    });
  });
});

describe('names no site may take', () => {
  it('refuses the keys the site-data subsystem manages', () => {
    // Those are reached through lumenSite:siteDataPublish, which derives the
    // key from the sender and prompts. Reaching them from the raw channel
    // would be the same hijack by another door.
    expect(ipns.isReservedKeyName('sitedata:abc123')).toBe(true);
    expect(ipns.claimKeyForSite('sitedata:abc123', SITE_A)).toEqual({
      ok: false,
      error: 'reserved_key',
    });
  });

  it('is not fooled by case', () => {
    expect(ipns.isReservedKeyName('SiteData:abc')).toBe(true);
  });

  it('leaves an ordinary name alone', () => {
    expect(ipns.isReservedKeyName('live')).toBe(false);
    expect(ipns.isReservedKeyName('my-sitedata')).toBe(false);
  });
});

describe('what it refuses to answer', () => {
  it('needs both a name and a site', () => {
    expect(ipns.claimKeyForSite('', SITE_A)).toEqual({ ok: false, error: 'missing_key' });
    expect(ipns.claimKeyForSite('live', '')).toEqual({ ok: false, error: 'missing_siteKey' });
  });

  it('reports no owner for a name nobody has taken', () => {
    expect(ipns.ownerOfKey('never-used')).toBeNull();
    expect(ipns.ownerOfKey('')).toBeNull();
  });
});
