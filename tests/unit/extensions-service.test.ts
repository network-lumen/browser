import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchInstalledExtensions,
  findExtensionByRuntimeId,
  getRuntimeIdFromExtensionUrl,
  installExtensionFromChromeWebStore,
  isChromeWebStoreUrl,
  listInstalledExtensions,
  normalizeInstalledExtension,
  toSyntheticTabId,
  upsertExtension,
} from '../../src/internal/services/extensions';
import type { InstalledExtension } from '../../src/types/extension';

/**
 * Shared access to the Chrome-extension host.
 *
 * The distinction that matters throughout is `null` versus `[]`: an
 * unreachable host returns `null` so six screens keep the list they already
 * have, where `[]` would blank the UI every time a call happened to fail. The
 * other half is `isChromeWebStoreUrl`, which decides whether the "install into
 * Lumen" button appears - matching it on a substring would offer that button
 * on `chromewebstore.google.com.evil.test`.
 */

function bridge(extensions: unknown) {
  (window as any).lumen = { extensions };
}

const ext = (over: Partial<InstalledExtension> = {}): InstalledExtension => ({
  id: 'aaa', runtimeId: 'rt-aaa', name: 'One', enabled: true, launchUrl: '', ...over,
});

afterEach(() => {
  delete (window as any).lumen;
  vi.restoreAllMocks();
});

describe('listInstalledExtensions', () => {
  it('returns the entries the host reports', async () => {
    bridge({ listExtensions: async () => ({ ok: true, extensions: [{ id: 'a' }] }) });
    await expect(listInstalledExtensions()).resolves.toEqual([{ id: 'a' }]);
  });

  it('returns null, not an empty list, when the host is unreachable', async () => {
    // Six screens read this. `[]` would blank all of them on a transient error.
    delete (window as any).lumen;
    await expect(listInstalledExtensions()).resolves.toBeNull();
    bridge({});
    await expect(listInstalledExtensions()).resolves.toBeNull();
    bridge({ listExtensions: async () => ({ ok: false }) });
    await expect(listInstalledExtensions()).resolves.toBeNull();
    bridge({ listExtensions: async () => { throw new Error('gone'); } });
    await expect(listInstalledExtensions()).resolves.toBeNull();
  });

  it('returns an empty list when the host genuinely has none', async () => {
    // Distinct from unreachable: this one does mean "show nothing".
    bridge({ listExtensions: async () => ({ ok: true, extensions: [] }) });
    await expect(listInstalledExtensions()).resolves.toEqual([]);
    bridge({ listExtensions: async () => ({ ok: true }) });
    await expect(listInstalledExtensions()).resolves.toEqual([]);
  });
});

describe('normalizeInstalledExtension', () => {
  it('shapes an entry and fills the name', () => {
    expect(normalizeInstalledExtension({ id: 'a', runtimeId: 'r', enabled: true }))
      .toEqual({ id: 'a', runtimeId: 'r', name: 'Extension', enabled: true, launchUrl: '' });
  });

  it('drops an entry with no id, which nothing could act on', () => {
    expect(normalizeInstalledExtension({ name: 'No id' })).toBeNull();
    expect(normalizeInstalledExtension(null)).toBeNull();
    expect(normalizeInstalledExtension({ id: '   ' })).toBeNull();
  });

  it('reads enabled as a real boolean', () => {
    expect(normalizeInstalledExtension({ id: 'a', enabled: 'yes' })?.enabled).toBe(true);
    expect(normalizeInstalledExtension({ id: 'a' })?.enabled).toBe(false);
  });
});

describe('fetchInstalledExtensions', () => {
  it('normalizes and drops the unusable entries', async () => {
    bridge({ listExtensions: async () => ({ ok: true, extensions: [{ id: 'a' }, { name: 'no id' }] }) });
    const list = await fetchInstalledExtensions();
    expect(list).toHaveLength(1);
    expect(list?.[0].id).toBe('a');
  });

  it('passes the unreachable case straight through as null', async () => {
    delete (window as any).lumen;
    await expect(fetchInstalledExtensions()).resolves.toBeNull();
  });
});

describe('upsertExtension', () => {
  it('appends a new entry', () => {
    expect(upsertExtension([ext()], ext({ id: 'bbb' }))).toHaveLength(2);
  });

  it('replaces the entry with the same id instead of duplicating it', () => {
    const next = upsertExtension([ext({ name: 'Old' })], ext({ name: 'New' }));
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('New');
  });

  it('leaves the list alone for nothing to insert', () => {
    const list = [ext()];
    expect(upsertExtension(list, null)).toBe(list);
  });
});

describe('findExtensionByRuntimeId', () => {
  it('finds by runtime id', () => {
    expect(findExtensionByRuntimeId([ext(), ext({ id: 'b', runtimeId: 'rt-b' })], 'rt-b')?.id).toBe('b');
  });

  it('returns null for an unknown or empty runtime id', () => {
    expect(findExtensionByRuntimeId([ext()], 'nope')).toBeNull();
    expect(findExtensionByRuntimeId([ext()], '')).toBeNull();
    expect(findExtensionByRuntimeId([], 'rt-aaa')).toBeNull();
  });
});

describe('toSyntheticTabId', () => {
  it('passes a numeric id through', () => {
    expect(toSyntheticTabId('42')).toBe(42);
    expect(toSyntheticTabId('7.9')).toBe(7);
  });

  it('hashes a Lumen tab id into a stable number', () => {
    const a = toSyntheticTabId('tab-abc');
    expect(a).toBe(toSyntheticTabId('tab-abc'));
    expect(a).not.toBe(toSyntheticTabId('tab-abd'));
  });

  it('stays clear of the range Electron hands out itself', () => {
    // A collision would have the shim report one tab's events against another.
    for (const id of ['tab-a', 'x', '', 'a-very-long-tab-identifier-0000']) {
      expect(toSyntheticTabId(id)).toBeGreaterThanOrEqual(1000);
    }
  });

  it('always yields a whole number', () => {
    for (const id of ['tab-a', '42', '', 'zzz']) {
      expect(Number.isInteger(toSyntheticTabId(id))).toBe(true);
    }
  });
});

describe('getRuntimeIdFromExtensionUrl', () => {
  it('reads the runtime id out of an extension URL', () => {
    expect(getRuntimeIdFromExtensionUrl('chrome-extension://abcdef/popup.html')).toBe('abcdef');
  });

  it('gives an empty string for anything that is not a URL', () => {
    expect(getRuntimeIdFromExtensionUrl('not a url')).toBe('');
    expect(getRuntimeIdFromExtensionUrl('')).toBe('');
    expect(getRuntimeIdFromExtensionUrl(null as never)).toBe('');
  });
});

describe('isChromeWebStoreUrl', () => {
  it('accepts the store and its subdomains', () => {
    expect(isChromeWebStoreUrl('https://chromewebstore.google.com/detail/x')).toBe(true);
    expect(isChromeWebStoreUrl('https://www.chromewebstore.google.com/')).toBe(true);
    expect(isChromeWebStoreUrl('HTTPS://ChromeWebStore.Google.Com/')).toBe(true);
  });

  it('rejects a host that merely contains the name', () => {
    // This decides whether the "install into Lumen" button appears, so a
    // substring match would offer it on an attacker's domain.
    expect(isChromeWebStoreUrl('https://chromewebstore.google.com.evil.test/x')).toBe(false);
    expect(isChromeWebStoreUrl('https://evil.test/chromewebstore.google.com')).toBe(false);
    expect(isChromeWebStoreUrl('https://notchromewebstore.google.com/')).toBe(false);
  });

  it('rejects junk without throwing', () => {
    expect(isChromeWebStoreUrl('not a url')).toBe(false);
    expect(isChromeWebStoreUrl('')).toBe(false);
    expect(isChromeWebStoreUrl(null as never)).toBe(false);
  });
});

describe('installExtensionFromChromeWebStore', () => {
  it('reports success', async () => {
    bridge({ installFromChromeWebStore: async () => ({ ok: true }) });
    await expect(installExtensionFromChromeWebStore('abc', 'test')).resolves.toEqual({ ok: true });
  });

  it('reports an unavailable host with a code rather than throwing', async () => {
    delete (window as any).lumen;
    await expect(installExtensionFromChromeWebStore('abc', 'test'))
      .resolves.toEqual({ ok: false, error: 'extensions_unavailable' });
  });

  it('passes the host’s own error back, and logs where it came from', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    bridge({ installFromChromeWebStore: async () => ({ ok: false, error: 'crx_signature_verification_failed' }) });
    await expect(installExtensionFromChromeWebStore('abc', 'ExtensionsPage'))
      .resolves.toEqual({ ok: false, error: 'crx_signature_verification_failed' });
    expect(warn.mock.calls[0][0]).toContain('ExtensionsPage');
  });

  it('turns a thrown error into a result', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    bridge({ installFromChromeWebStore: async () => { throw new Error('network down'); } });
    await expect(installExtensionFromChromeWebStore('abc', 'test'))
      .resolves.toEqual({ ok: false, error: 'network down' });
  });

  it('never reports success without a reason to', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    bridge({ installFromChromeWebStore: async () => null });
    await expect(installExtensionFromChromeWebStore('abc', 'test'))
      .resolves.toMatchObject({ ok: false });
  });
});
