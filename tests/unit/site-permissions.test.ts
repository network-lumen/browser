import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stubElectron, type ElectronStub } from './support/electronStub';

/**
 * The "always allow" a user grants a site.
 *
 * This is the switch that stops asking. Once it is on for a site, that site's
 * pin requests, wallet prompts and stable-link publishes go through without a
 * further modal - so every default here has to fail closed: an unknown site,
 * an empty key, a corrupted file and a truthy-but-not-`true` stored value must
 * all read as "not allowed", and the permission must be scoped to exactly one
 * site key rather than to a prefix of it.
 */

let env: ElectronStub;
let perms: any;

function permissionsFile() {
  return join(env.userData, 'lumen_site_permissions.json');
}

beforeEach(() => {
  env = stubElectron();
  perms = env.load('sites/permissions.cjs');
});

describe('by default nothing is allowed', () => {
  it('refuses a site nobody has granted', () => {
    expect(perms.isAllowed('domain:example.lumen')).toBe(false);
  });

  it('refuses an empty or missing key', () => {
    for (const key of ['', '   ', null, undefined, 0]) {
      expect(perms.isAllowed(key)).toBe(false);
    }
  });
});

describe('granting', () => {
  it('remembers a grant', () => {
    expect(perms.setAllowed('domain:example.lumen', true)).toEqual({ ok: true });
    expect(perms.isAllowed('domain:example.lumen')).toBe(true);
  });

  it('revokes a grant', () => {
    perms.setAllowed('domain:example.lumen', true);
    perms.setAllowed('domain:example.lumen', false);
    expect(perms.isAllowed('domain:example.lumen')).toBe(false);
  });

  it('refuses to store a grant with no site to attach it to', () => {
    expect(perms.setAllowed('', true)).toEqual({ ok: false, error: 'missing_siteKey' });
    expect(perms.setAllowed(null, true)).toEqual({ ok: false, error: 'missing_siteKey' });
  });

  it('scopes a grant to exactly one site key', () => {
    // Not a prefix: granting example.lumen must not cover evil.example.lumen
    // or an ipfs CID that happens to start the same way.
    perms.setAllowed('domain:example.lumen', true);
    expect(perms.isAllowed('domain:example.lumen.evil.test')).toBe(false);
    expect(perms.isAllowed('domain:example')).toBe(false);
    expect(perms.isAllowed('ipfs:domain:example.lumen')).toBe(false);
  });

  it('trims the key, so the same site is not granted twice', () => {
    perms.setAllowed('  domain:example.lumen  ', true);
    expect(perms.isAllowed('domain:example.lumen')).toBe(true);
  });

  it('writes the grant to disk, so a restart does not re-ask', () => {
    perms.setAllowed('domain:example.lumen', true);
    const stored = JSON.parse(readFileSync(permissionsFile(), 'utf8'));
    expect(stored.sites['domain:example.lumen'].allowModals).toBe(true);
    expect(stored.sites['domain:example.lumen'].updatedAt).toBeGreaterThan(0);
  });

  it('reads a grant back from disk in a fresh process', () => {
    perms.setAllowed('domain:example.lumen', true);
    const reloaded = env.load('sites/permissions.cjs');
    expect(reloaded.isAllowed('domain:example.lumen')).toBe(true);
  });
});

describe('a file it cannot trust', () => {
  it('allows nothing when the file is corrupted', () => {
    writeFileSync(permissionsFile(), '{not json', 'utf8');
    const fresh = env.load('sites/permissions.cjs');
    expect(fresh.isAllowed('domain:example.lumen')).toBe(false);
  });

  it('allows nothing when the file is the wrong shape', () => {
    for (const body of ['null', '[]', '"a string"', '{"sites":"nope"}', '']) {
      writeFileSync(permissionsFile(), body, 'utf8');
      const fresh = env.load('sites/permissions.cjs');
      expect(fresh.isAllowed('domain:example.lumen')).toBe(false);
    }
  });

  it('requires the flag to be exactly true, not merely truthy', () => {
    // A hand-edited or half-migrated file must not read as a grant.
    for (const value of ['true', 1, {}, 'yes']) {
      writeFileSync(
        permissionsFile(),
        JSON.stringify({ version: 1, sites: { 'domain:a.lumen': { allowModals: value } } }),
        'utf8'
      );
      const fresh = env.load('sites/permissions.cjs');
      expect(fresh.isAllowed('domain:a.lumen')).toBe(false);
    }
  });

  it('still works after a corrupted read, rather than staying broken', () => {
    writeFileSync(permissionsFile(), '{not json', 'utf8');
    const fresh = env.load('sites/permissions.cjs');
    expect(fresh.setAllowed('domain:a.lumen', true)).toEqual({ ok: true });
    expect(fresh.isAllowed('domain:a.lumen')).toBe(true);
  });
});
