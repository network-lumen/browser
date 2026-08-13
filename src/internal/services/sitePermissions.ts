import { t } from '../../stores/i18nStore';
import { markForTranslation } from './i18n';
import { siteDataSiteLabel } from './siteData';
import type { SitePermissionAction, SitePermissionRecord } from '../../types/sitePermissions';

/**
 * Reading the rights a site holds.
 *
 * The main process names an action the way the code does - "SendToken",
 * "StableLink" - which is no way to tell someone what they granted. The table
 * below is the only place those names become sentences, and it is here rather
 * than in the dialog because the page needs the same words for its counts and
 * its confirmation prompts.
 */

/** The site a right belongs to, named the same way as its data record. */
export function sitePermissionSiteLabel(record: SitePermissionRecord): string {
  return siteDataSiteLabel({ siteKey: record?.siteKey });
}

const ACTION_LABELS: Record<string, string> = {
  SendToken: markForTranslation('Send tokens from your wallet'),
  Save: markForTranslation('Save files to your Drive'),
  StableLink: markForTranslation('Publish a stable link'),
  SiteData: markForTranslation('Keep its own data record'),
};

export function sitePermissionActionLabel(kind: string): string {
  const known = ACTION_LABELS[String(kind || '').trim()];
  return known ? t(known) : String(kind || '').trim() || t('Unknown right');
}

/** Rights still in force, which is what the count on the settings row means. */
export function countAllowedActions(record: SitePermissionRecord): number {
  return (record?.actions || []).filter((action) => action.allowed).length;
}

export function sortSitePermissionActions(actions: SitePermissionAction[]): SitePermissionAction[] {
  return [...(actions || [])].sort((a, b) =>
    sitePermissionActionLabel(a.kind).localeCompare(sitePermissionActionLabel(b.kind)),
  );
}

/**
 * How a site's standing reads at a glance.
 *
 * A site keeps its entry after every right is revoked - that is not the same as
 * never having been granted anything, and hiding it would leave no way to give
 * a right back.
 */
export function summarizeSitePermission(record: SitePermissionRecord): string {
  const allowed = countAllowedActions(record);
  if (!allowed) return t('No rights');
  return allowed === 1 ? t('1 right') : t('{count} rights', { count: allowed });
}
