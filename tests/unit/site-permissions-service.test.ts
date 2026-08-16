import { describe, expect, it } from 'vitest';
import {
  countAllowedActions,
  sitePermissionActionLabel,
  sitePermissionSiteLabel,
  sortSitePermissionActions,
  summarizeSitePermission,
} from '../../src/internal/services/sitePermissions';
import type { SitePermissionAction, SitePermissionRecord } from '../../src/types/sitePermissions';

/**
 * Turning the main process's vocabulary into something a person can act on.
 *
 * The action kinds are code names ("SendToken"), and a right that was taken
 * away still has to be listed - otherwise there is no way to give it back.
 */

const action = (kind: string, allowed: boolean): SitePermissionAction => ({
  kind,
  allowed,
  updatedAt: 0,
});

const record = (over: Partial<SitePermissionRecord> = {}): SitePermissionRecord => ({
  siteKey: 'domain:toto.lmn',
  allowModals: true,
  updatedAt: 0,
  actions: [],
  ...over,
});

describe('naming a right', () => {
  it('spells out the kinds a site can be granted', () => {
    expect(sitePermissionActionLabel('SendToken')).toBe('Send tokens from your wallet');
    expect(sitePermissionActionLabel('SiteData')).toBe('Keep its own data record');
  });

  it('shows an unknown kind rather than hiding it', () => {
    expect(sitePermissionActionLabel('SomethingNew')).toBe('SomethingNew');
    expect(sitePermissionActionLabel('')).toBe('Unknown right');
  });

  it('orders rights by what they read as, not by their code name', () => {
    const sorted = sortSitePermissionActions([action('SendToken', true), action('Save', true)]);
    expect(sorted.map((a) => a.kind)).toEqual(['Save', 'SendToken']);
  });
});

describe('naming the site', () => {
  it('reads a domain key as the domain', () => {
    expect(sitePermissionSiteLabel(record())).toBe('toto.lmn');
  });
});

describe('summarising what a site holds', () => {
  it('counts only the rights still in force', () => {
    const held = record({ actions: [action('Save', true), action('SendToken', false)] });
    expect(countAllowedActions(held)).toBe(1);
    expect(summarizeSitePermission(held)).toBe('1 right');
  });

  it('keeps a site that had everything revoked, so it can be granted again', () => {
    const stripped = record({ actions: [action('Save', false)] });
    expect(summarizeSitePermission(stripped)).toBe('No rights');
  });

  it('pluralises', () => {
    const two = record({ actions: [action('Save', true), action('SendToken', true)] });
    expect(summarizeSitePermission(two)).toBe('2 rights');
  });
});
