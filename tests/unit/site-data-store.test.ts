import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * The per-site data store: one IPNS key per (site, profile) pair, and the
 * bounds on what a site may put in it.
 *
 * A site calls `window.lumen.siteData.publish()` itself, and once the user has
 * granted "always allow" nothing else asks them again - so these limits are
 * the only thing standing between an ordinary page and an unbounded write to
 * the user's disk plus an IPNS publish per call. The key naming carries the
 * other rule: an import must never reuse the deterministic name, because an
 * IPNS identity cannot be revoked and overwriting the outgoing key would make
 * a mis-click permanent.
 */

let siteData: any;

beforeEach(() => {
  siteData = stubElectron().load('site_data.cjs');
});

describe('key naming', () => {
  it('gives the same pair the same key, always', () => {
    // Otherwise a site would get a new identity on every publish.
    const a = siteData.siteDataKeyName('domain:example.lumen', 'p1');
    const b = siteData.siteDataKeyName('domain:example.lumen', 'p1');
    expect(a).toBe(b);
    expect(a.startsWith('sitedata:')).toBe(true);
  });

  it('gives different pairs different keys', () => {
    const base = siteData.siteDataKeyName('domain:a.lumen', 'p1');
    expect(siteData.siteDataKeyName('domain:b.lumen', 'p1')).not.toBe(base);
    expect(siteData.siteDataKeyName('domain:a.lumen', 'p2')).not.toBe(base);
  });

  it('does not leak the site or the profile into the key name', () => {
    const name = siteData.siteDataKeyName('domain:secret-site.lumen', 'profile-42');
    expect(name).not.toContain('secret-site');
    expect(name).not.toContain('profile-42');
  });

  it('never reuses the deterministic name for an import', () => {
    // An IPNS identity cannot be revoked or reissued. Overwriting the outgoing
    // key would make a mis-clicked import permanent; instead the old key stays
    // in the keystore under its own name and only the pointer moves.
    const deterministic = siteData.siteDataKeyName('domain:a.lumen', 'p1');
    const imported = siteData.importedSiteDataKeyName('domain:a.lumen', 'p1');
    expect(imported).not.toBe(deterministic);
    expect(imported.startsWith(deterministic)).toBe(true);
  });

  it('gives every import its own name, since Kubo key names must be unique', () => {
    const names = new Set(
      Array.from({ length: 50 }, () => siteData.importedSiteDataKeyName('domain:a.lumen', 'p1'))
    );
    expect(names.size).toBe(50);
  });
});

describe('the records', () => {
  it('stores and reads back a record', () => {
    siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', {
      keyName: 'k', ipnsName: 'k51abc', datas: { hello: 'world' },
    });
    expect(siteData.getSiteDataRecord('domain:a.lumen', 'p1')).toMatchObject({
      siteKey: 'domain:a.lumen', profileId: 'p1', ipnsName: 'k51abc', datas: { hello: 'world' },
    });
  });

  it('keeps one site’s record out of another’s', () => {
    siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', { keyName: 'k', ipnsName: 'a', datas: {} });
    expect(siteData.getSiteDataRecord('domain:b.lumen', 'p1')).toBeNull();
    expect(siteData.getSiteDataRecord('domain:a.lumen', 'p2')).toBeNull();
  });

  it('keeps createdAt across an update and moves updatedAt', () => {
    const first = siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', {
      keyName: 'k', ipnsName: 'a', datas: { v: 1 },
    });
    const second = siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', {
      keyName: 'k', ipnsName: 'a', datas: { v: 2 },
    });
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
  });

  it('keeps the previous datas when an update does not carry any', () => {
    siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', { keyName: 'k', ipnsName: 'a', datas: { v: 1 } });
    siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', { keyName: 'k', ipnsName: 'b' });
    expect(siteData.getSiteDataRecord('domain:a.lumen', 'p1').datas).toEqual({ v: 1 });
  });

  it('resets datas when an update explicitly carries an empty object', () => {
    // What an identity import does: the cached JSON described the previous
    // identity and means nothing for the new one.
    siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', { keyName: 'k', ipnsName: 'a', datas: { v: 1 } });
    siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', { keyName: 'k2', ipnsName: 'b', datas: {} });
    expect(siteData.getSiteDataRecord('domain:a.lumen', 'p1').datas).toEqual({});
  });

  it('deletes, returning what was removed so the caller can free the Kubo key', () => {
    siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', { keyName: 'kubo-key', ipnsName: 'a', datas: {} });
    const removed = siteData.deleteSiteDataRecord('domain:a.lumen', 'p1');
    expect(removed.keyName).toBe('kubo-key');
    expect(siteData.getSiteDataRecord('domain:a.lumen', 'p1')).toBeNull();
    expect(siteData.deleteSiteDataRecord('domain:a.lumen', 'p1')).toBeNull();
  });

  it('lists every record', () => {
    siteData.upsertSiteDataRecord('domain:a.lumen', 'p1', { keyName: 'k', ipnsName: 'a', datas: {} });
    siteData.upsertSiteDataRecord('domain:b.lumen', 'p1', { keyName: 'k', ipnsName: 'b', datas: {} });
    expect(siteData.listSiteDataRecords()).toHaveLength(2);
    expect(siteData.listSiteDataRecords().map((r: any) => r.siteKey).sort())
      .toEqual(['domain:a.lumen', 'domain:b.lumen']);
  });

  it('starts empty for a fresh profile folder', () => {
    expect(siteData.listSiteDataRecords()).toEqual([]);
  });
});

describe('what a site is allowed to store', () => {
  it('accepts ordinary JSON', () => {
    expect(siteData.validateDatas({ user: 'ada', prefs: { theme: 'dark' }, tags: ['a', 'b'] }))
      .toEqual({ ok: true });
    expect(siteData.validateDatas({})).toEqual({ ok: true });
    expect(siteData.validateDatas(undefined)).toEqual({ ok: true });
  });

  it('refuses more than half a megabyte in total', () => {
    const big = { blob: 'x'.repeat(siteData.MAX_DATAS_BYTES + 1) };
    expect(siteData.validateDatas(big)).toEqual({ ok: false, error: 'datas_too_large' });
  });

  it('refuses one absurd string, which the size check alone would catch late', () => {
    expect(siteData.validateDatas({ s: 'x'.repeat(10_001) }).ok).toBe(false);
    expect(siteData.validateDatas({ s: 'x'.repeat(10_000) })).toEqual({ ok: true });
  });

  it('refuses unbounded nesting', () => {
    let deep: any = 'leaf';
    for (let i = 0; i < 8; i += 1) deep = { next: deep };
    expect(siteData.validateDatas(deep)).toEqual({ ok: false, error: 'datas_structure_invalid' });
  });

  it('accepts nesting up to the limit', () => {
    expect(siteData.validateDatas({ a: { b: { c: { d: 'leaf' } } } })).toEqual({ ok: true });
  });

  it('refuses a huge array even when it is small in bytes', () => {
    // Front-loading one field is how a payload sneaks past a size-only check.
    expect(siteData.validateDatas({ list: new Array(501).fill(0) }))
      .toEqual({ ok: false, error: 'datas_structure_invalid' });
    expect(siteData.validateDatas({ list: new Array(500).fill(0) })).toEqual({ ok: true });
  });

  it('refuses values JSON cannot carry', () => {
    expect(siteData.validateDatas({ fn: () => {} }).ok).toBe(false);
    const cyclic: any = {};
    cyclic.self = cyclic;
    expect(siteData.validateDatas(cyclic)).toEqual({ ok: false, error: 'datas_too_large' });
  });

  it('reports the size problem before the structural one', () => {
    // The caller shows this to the site; the more actionable reason wins.
    const both = { s: 'x'.repeat(siteData.MAX_DATAS_BYTES + 1) };
    expect(siteData.validateDatas(both).error).toBe('datas_too_large');
  });
});

describe('the publish rate limit', () => {
  it('allows the first publish', () => {
    expect(siteData.canPublishNow('domain:a.lumen', 'p1')).toBe(true);
  });

  it('refuses a second one straight away', () => {
    // Once "always allow" is granted nothing else throttles repeated calls.
    siteData.markPublished('domain:a.lumen', 'p1');
    expect(siteData.canPublishNow('domain:a.lumen', 'p1')).toBe(false);
  });

  it('allows it again after the window', () => {
    vi.useFakeTimers();
    siteData.markPublished('domain:a.lumen', 'p1');
    vi.setSystemTime(Date.now() + siteData.PUBLISH_RATE_LIMIT_MS + 1);
    expect(siteData.canPublishNow('domain:a.lumen', 'p1')).toBe(true);
    vi.useRealTimers();
  });

  it('limits each site and profile separately', () => {
    // One site being throttled must not lock out another.
    siteData.markPublished('domain:a.lumen', 'p1');
    expect(siteData.canPublishNow('domain:b.lumen', 'p1')).toBe(true);
    expect(siteData.canPublishNow('domain:a.lumen', 'p2')).toBe(true);
  });
});
