/**
 * The document-backed corners of lumen://settings: per-site permissions, the
 * record of which sites hold data, the address book, the private-cloud config
 * and the debug report.
 *
 * None of these needed a daemon on the desktop either - they are lists kept on
 * disk and edited from a settings screen - so the port is the same data under
 * the same shapes, living in Preferences instead of a file.
 *
 * The one that is genuinely narrower here is `siteData`. On the desktop it
 * enumerates what Chromium's session partition actually stores for an origin.
 * A WebView gives no such inventory, and an iframe's storage belongs to the
 * site, not to us, so the list is what Lumen itself recorded about a site
 * rather than a true accounting - and `delete` forgets our record rather than
 * claiming to have wiped the site's own. Saying that plainly beats a button
 * that looks like it cleared something and did not.
 */

import type { SitePermission, SiteDataRecord } from '../../../src/types/platformBridge';
import { readDoc, writeDoc } from './storage';
import { getSettings } from './settings';

const SITE_PERMISSIONS_KEY = 'sites/permissions.json';
const SITE_DATA_KEY = 'sites/data.json';
const ADDRESS_BOOK_KEY = 'addressbook.json';
const PRIVATE_CLOUD_KEY = 'private-cloud.json';

/** What a private-cloud config looks like when none has been saved. */
const PRIVATE_CLOUD_DEFAULTS = Object.freeze({
  enabled: false,
  gatewayIds: [] as string[],
  preferPrivate: false,
  fallbackToDAO: true,
  timeout: 5000,
  maxRetries: 3
});

const str = (value: unknown, max = 256) => String(value ?? '').trim().slice(0, max);

export const SITE_MEMBERS = {
  'sitePermissions.list': async () => ({
    ok: true,
    sites: (await readDoc<SitePermission[]>(SITE_PERMISSIONS_KEY)) ?? []
  }),

  'sitePermissions.setAction': async (siteKey: string, actionKind: string, allowed: unknown) => {
    const key = str(siteKey);
    const kind = str(actionKind, 64);
    if (!key || !kind) return { ok: false, error: 'missing_site_or_action' };

    const sites = (await readDoc<SitePermission[]>(SITE_PERMISSIONS_KEY)) ?? [];
    const existing = sites.find((s) => s.siteKey === key);
    if (existing) {
      existing.actions = { ...existing.actions, [kind]: allowed === true };
    } else {
      sites.push({ siteKey: key, actions: { [kind]: allowed === true } });
    }

    await writeDoc(SITE_PERMISSIONS_KEY, sites);
    return { ok: true };
  },

  'sitePermissions.revokeSite': async (siteKey: string) => {
    const key = str(siteKey);
    if (!key) return { ok: false, error: 'missing_site' };
    const sites = (await readDoc<SitePermission[]>(SITE_PERMISSIONS_KEY)) ?? [];
    await writeDoc(
      SITE_PERMISSIONS_KEY,
      sites.filter((s) => s.siteKey !== key)
    );
    return { ok: true };
  },

  'siteData.list': async () => ({
    ok: true,
    records: (await readDoc<SiteDataRecord[]>(SITE_DATA_KEY)) ?? []
  }),

  'siteData.delete': async (siteKey: string, profileId: string) => {
    const key = str(siteKey);
    const profile = str(profileId);
    if (!key || !profile) return { ok: false, error: 'missing_site_or_profile' };

    const records = (await readDoc<SiteDataRecord[]>(SITE_DATA_KEY)) ?? [];
    const next = records.filter((r) => !(r.siteKey === key && r.profileId === profile));
    if (next.length === records.length) return { ok: false, error: 'not_found' };

    await writeDoc(SITE_DATA_KEY, next);
    return { ok: true };
  },

  'addressBook.list': async () => ({
    ok: true,
    entries: (await readDoc<Record<string, unknown>[]>(ADDRESS_BOOK_KEY)) ?? []
  }),

  'addressBook.add': async (entry: { name?: string; address?: string }) => {
    const name = str(entry?.name, 128);
    const address = str(entry?.address);
    if (!name || !address) return { ok: false, error: 'missing_name_or_address' };

    const entries = (await readDoc<Record<string, unknown>[]>(ADDRESS_BOOK_KEY)) ?? [];
    if (entries.some((e) => e.address === address)) {
      return { ok: false, error: 'address_already_saved' };
    }

    const created = { id: `ab_${Date.now().toString(36)}`, name, address, createdAt: Date.now() };
    entries.push(created);
    await writeDoc(ADDRESS_BOOK_KEY, entries);
    return { ok: true, entry: created };
  },

  'addressBook.update': async (id: string, updates: { name?: string; address?: string }) => {
    const entryId = str(id);
    const entries = (await readDoc<Record<string, unknown>[]>(ADDRESS_BOOK_KEY)) ?? [];
    const found = entries.find((e) => e.id === entryId);
    if (!found) return { ok: false, error: 'not_found' };

    if (updates?.name !== undefined) found.name = str(updates.name, 128);
    if (updates?.address !== undefined) found.address = str(updates.address);
    await writeDoc(ADDRESS_BOOK_KEY, entries);
    return { ok: true, entry: found };
  },

  'addressBook.delete': async (id: string) => {
    const entryId = str(id);
    const entries = (await readDoc<Record<string, unknown>[]>(ADDRESS_BOOK_KEY)) ?? [];
    const next = entries.filter((e) => e.id !== entryId);
    if (next.length === entries.length) return { ok: false, error: 'not_found' };
    await writeDoc(ADDRESS_BOOK_KEY, next);
    return { ok: true };
  },

  settingsLoadPrivateCloudConfig: async () => ({
    ...PRIVATE_CLOUD_DEFAULTS,
    ...((await readDoc<Record<string, unknown>>(PRIVATE_CLOUD_KEY)) ?? {})
  }),

  settingsSavePrivateCloudConfig: async (config: Record<string, unknown>) => {
    const next = { ...PRIVATE_CLOUD_DEFAULTS, ...(config ?? {}) };
    await writeDoc(PRIVATE_CLOUD_KEY, next);
    return { ok: true, config: next };
  },

  /**
   * The support bundle, minus everything that could compromise the wallet.
   *
   * The desktop's version promises that passwords, password hashes, API keys
   * and private keys are excluded, and the settings document holds a password
   * hash - so the redaction is by allow-list rather than by removing the field
   * names known today. A key added to settings next year is excluded by
   * default instead of leaking until someone notices.
   */
  'troubleshooting.copyDebugReport': async () => {
    try {
      const settings = await getSettings();
      const safeKeys = [
        'lumenNetwork',
        'ipfsApiBase',
        'ipfsConnectivityMode',
        'localGatewayBase',
        'localDriveMaxUploadSizeGb',
        'securitySessionTimeoutMs',
        'securityPasswordEnabled'
      ];
      const safeSettings = Object.fromEntries(
        safeKeys.filter((k) => k in settings).map((k) => [k, settings[k]])
      );

      const bridge = (globalThis as any).__lumenBridgeReport?.();
      const report = [
        '# Lumen debug report',
        `generated: ${new Date().toISOString()}`,
        `platform: android`,
        `userAgent: ${navigator.userAgent}`,
        `language: ${navigator.language}`,
        `viewport: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`,
        `online: ${navigator.onLine}`,
        '',
        '## settings (redacted to a safe allow-list)',
        JSON.stringify(safeSettings, null, 2),
        '',
        '## window.lumen bridge',
        bridge
          ? `implemented ${bridge.implemented.length}, stubbed ${bridge.stubbed.length}, unsupported ${bridge.unsupported.length} of ${bridge.total}`
          : 'unavailable'
      ].join('\n');

      await navigator.clipboard.writeText(report);
      return { ok: true, report, copied: true };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  }
};
