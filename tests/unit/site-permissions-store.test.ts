import { beforeEach, describe, expect, it } from 'vitest';
import { stubElectron, type ElectronStub } from './support/electronStub';

/**
 * Rights held one at a time, on top of the blanket "always allow" covered in
 * site-permissions.test.ts.
 *
 * The rule worth writing down is that a revoked right outranks that blanket
 * grant. Without it, taking away "send tokens" would last exactly until the
 * site asked for anything else and was granted "Always" again - so the one
 * thing the whole feature promises would quietly not hold.
 */

let env: ElectronStub;
let perms: any;

const SITE = 'domain:toto.lmn';

beforeEach(() => {
  env = stubElectron();
  perms = env.load('sites/permissions.cjs');
});

describe('one right at a time', () => {
  it('knows the difference between refused and never asked', () => {
    expect(perms.isActionAllowed(SITE, 'SendToken')).toBeNull();
    perms.setActionAllowed(SITE, 'SendToken', false);
    expect(perms.isActionAllowed(SITE, 'SendToken')).toBe(false);
    perms.setActionAllowed(SITE, 'SendToken', true);
    expect(perms.isActionAllowed(SITE, 'SendToken')).toBe(true);
  });

  it('will not invent an action kind nobody gates on', () => {
    expect(perms.setActionAllowed(SITE, 'Whatever', true)).toEqual({
      ok: false,
      error: 'unknown_action',
    });
    expect(perms.isActionAllowed(SITE, 'Whatever')).toBeNull();
  });

  it('records a grant, but never overwrites one taken away by hand', () => {
    perms.setActionAllowed(SITE, 'Save', false);
    perms.recordActionGrant(SITE, 'Save');
    expect(perms.isActionAllowed(SITE, 'Save')).toBe(false);

    perms.recordActionGrant(SITE, 'SiteData');
    expect(perms.isActionAllowed(SITE, 'SiteData')).toBe(true);
  });

  it('leaves the blanket grant alone when a single right changes', () => {
    perms.setAllowed(SITE, true);
    perms.setActionAllowed(SITE, 'Save', false);
    expect(perms.isAllowed(SITE)).toBe(true);
  });

  it('survives a restart, like the grant it hangs off', () => {
    perms.setActionAllowed(SITE, 'Save', false);
    const reloaded = env.load('sites/permissions.cjs');
    expect(reloaded.isActionAllowed(SITE, 'Save')).toBe(false);
  });
});

describe('listing and revoking', () => {
  it('reports each site with the rights it holds', () => {
    perms.setAllowed(SITE, true);
    perms.recordActionGrant(SITE, 'Save');
    perms.setActionAllowed(SITE, 'SendToken', false);

    const [entry] = perms.listSitePermissions();
    expect(entry.siteKey).toBe(SITE);
    expect(entry.allowModals).toBe(true);
    expect(entry.actions).toEqual([
      expect.objectContaining({ kind: 'SendToken', allowed: false }),
      expect.objectContaining({ kind: 'Save', allowed: true }),
    ]);
  });

  it('forgets a site entirely, so the next action asks again', () => {
    perms.setAllowed(SITE, true);
    perms.recordActionGrant(SITE, 'Save');

    expect(perms.revokeSite(SITE)).toEqual({ ok: true });
    expect(perms.isAllowed(SITE)).toBe(false);
    expect(perms.isActionAllowed(SITE, 'Save')).toBeNull();
    expect(perms.listSitePermissions()).toEqual([]);
  });

  it('says so when there is nothing to revoke', () => {
    expect(perms.revokeSite(SITE)).toEqual({ ok: false, error: 'not_found' });
  });
});
