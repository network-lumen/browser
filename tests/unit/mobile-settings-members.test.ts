import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The members lumen://settings reaches for on the mobile target.
 *
 * Preferences is stubbed with a Map for the same reason as in
 * mobile-security-profiles.test.ts: its web fallback is localStorage, which
 * would carry one test file's state into the next.
 */
const store = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    remove: async ({ key }: { key: string }) => void store.delete(key),
    keys: async () => ({ keys: [...store.keys()] })
  }
}));

const { SITE_MEMBERS } = await import('../../platform/mobile/impl/sites');
const { IPFS_MEMBERS } = await import('../../platform/mobile/impl/ipfs');
const { resetSettingsCache, setSettings } = await import('../../platform/mobile/impl/settings');

beforeEach(() => {
  store.clear();
  resetSettingsCache();
});

describe('site permissions', () => {
  it('remembers an answer and hands it back', async () => {
    await SITE_MEMBERS['sitePermissions.setAction']('lumen.lmn', 'camera', true);
    const listed: any = await SITE_MEMBERS['sitePermissions.list']();
    expect(listed.sites).toEqual([{ siteKey: 'lumen.lmn', actions: { camera: true } }]);
  });

  it('merges a second action into the same site rather than duplicating it', async () => {
    await SITE_MEMBERS['sitePermissions.setAction']('lumen.lmn', 'camera', true);
    await SITE_MEMBERS['sitePermissions.setAction']('lumen.lmn', 'clipboard', false);
    const listed: any = await SITE_MEMBERS['sitePermissions.list']();
    expect(listed.sites).toHaveLength(1);
    expect(listed.sites[0].actions).toEqual({ camera: true, clipboard: false });
  });

  it('revokes a site outright', async () => {
    await SITE_MEMBERS['sitePermissions.setAction']('a.lmn', 'camera', true);
    await SITE_MEMBERS['sitePermissions.setAction']('b.lmn', 'camera', true);
    await SITE_MEMBERS['sitePermissions.revokeSite']('a.lmn');
    const listed: any = await SITE_MEMBERS['sitePermissions.list']();
    expect(listed.sites.map((s: any) => s.siteKey)).toEqual(['b.lmn']);
  });

  it('refuses an incomplete request instead of storing a blank key', async () => {
    await expect(SITE_MEMBERS['sitePermissions.setAction']('', 'camera', true)).resolves.toEqual({
      ok: false,
      error: 'missing_site_or_action'
    });
  });
});

describe('address book', () => {
  it('adds, updates and deletes an entry', async () => {
    const added: any = await SITE_MEMBERS['addressBook.add']({ name: 'Ben', address: 'lmn1abc' });
    expect(added.ok).toBe(true);

    await SITE_MEMBERS['addressBook.update'](added.entry.id, { name: 'Benjamin' });
    let listed: any = await SITE_MEMBERS['addressBook.list']();
    expect(listed.entries[0].name).toBe('Benjamin');

    await SITE_MEMBERS['addressBook.delete'](added.entry.id);
    listed = await SITE_MEMBERS['addressBook.list']();
    expect(listed.entries).toEqual([]);
  });

  it('refuses the same address twice', async () => {
    await SITE_MEMBERS['addressBook.add']({ name: 'Ben', address: 'lmn1abc' });
    await expect(
      SITE_MEMBERS['addressBook.add']({ name: 'Other', address: 'lmn1abc' })
    ).resolves.toEqual({ ok: false, error: 'address_already_saved' });
  });
});

describe('private cloud config', () => {
  it('answers with the defaults before anything is saved', async () => {
    await expect(SITE_MEMBERS.settingsLoadPrivateCloudConfig()).resolves.toMatchObject({
      enabled: false,
      gatewayIds: [],
      fallbackToDAO: true
    });
  });

  it('round-trips a saved config', async () => {
    await SITE_MEMBERS.settingsSavePrivateCloudConfig({ enabled: true, timeout: 9000 });
    const loaded: any = await SITE_MEMBERS.settingsLoadPrivateCloudConfig();
    expect(loaded.enabled).toBe(true);
    expect(loaded.timeout).toBe(9000);
    // Untouched fields keep their defaults rather than going missing.
    expect(loaded.maxRetries).toBe(3);
  });
});

describe('debug report', () => {
  it('copies a report and leaves the password hash out of it', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t: string) => void written.push(t) }
    });

    await setSettings({
      lumenNetwork: 'mainnet',
      securityPasswordEnabled: true,
      securityPasswordHash: { hash: 'SECRET-HASH', salt: 'SECRET-SALT' }
    });

    const result: any = await SITE_MEMBERS['troubleshooting.copyDebugReport']();
    expect(result.ok).toBe(true);
    expect(written).toHaveLength(1);

    // The promise the desktop's version makes, kept here: the report says a
    // password is set without carrying anything that helps attack it.
    expect(result.report).toContain('lumenNetwork');
    expect(result.report).toContain('securityPasswordEnabled');
    expect(result.report).not.toContain('SECRET-HASH');
    expect(result.report).not.toContain('SECRET-SALT');
    expect(result.report).not.toContain('securityPasswordHash');
  });
});

describe('ipfs against a remote node', () => {
  it('tries loopback rather than refusing it, so an embedded node would answer', async () => {
    await setSettings({ ipfsApiBase: 'http://127.0.0.1:5001' });
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ ID: 'embedded-peer' }), { status: 200 });
    });

    // kubo cross-compiles for Android, so 127.0.0.1 is where a node bound into
    // the app would live. Refusing it up front would block that outright.
    await expect(IPFS_MEMBERS.ipfsStatus()).resolves.toMatchObject({
      ok: true,
      id: 'embedded-peer'
    });
    expect(calls[0]).toContain('http://127.0.0.1:5001/api/v0/id');
    vi.unstubAllGlobals();
  });

  it('says nothing answered on the device when loopback is silent', async () => {
    await setSettings({ ipfsApiBase: 'http://127.0.0.1:5001' });
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(IPFS_MEMBERS.ipfsStatus()).resolves.toEqual({
      ok: false,
      error: 'no_node_answered_on_device'
    });
    vi.unstubAllGlobals();
  });

  it('says so when no API has been configured at all', async () => {
    await setSettings({ ipfsApiBase: '' });
    await expect(IPFS_MEMBERS.ipfsStats()).resolves.toEqual({
      ok: false,
      error: 'ipfs_api_not_configured'
    });
  });

  it('calls a configured node with POST, which is all the Kubo RPC accepts', async () => {
    await setSettings({ ipfsApiBase: 'https://ipfs.example.test/' });
    const calls: { url: string; method?: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method });
      return new Response(JSON.stringify({ ID: 'peer-id' }), { status: 200 });
    });

    const result: any = await IPFS_MEMBERS.ipfsStatus();
    expect(result).toMatchObject({ ok: true, id: 'peer-id' });
    expect(calls[0].method).toBe('POST');
    // The trailing slash on the configured base must not become a double one.
    expect(calls[0].url).toContain('https://ipfs.example.test/api/v0/id');
    vi.unstubAllGlobals();
  });

  it('names the likely cause when the request never lands', async () => {
    await setSettings({ ipfsApiBase: 'https://ipfs.example.test' });
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(IPFS_MEMBERS.ipfsPinList()).resolves.toEqual({
      ok: false,
      error: 'request_failed_check_cors_and_reachability'
    });
    vi.unstubAllGlobals();
  });
});
