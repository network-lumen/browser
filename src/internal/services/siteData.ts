import { t } from '../../stores/i18nStore';
import type { SiteDataRecord } from '../../types/drivePage';

/**
 * Reading the per-site data records the browser keeps - one dedicated key per
 * site, holding whatever JSON that site chose to store about you.
 *
 * These lived in DrivePage and were handed to the dialog as five function
 * props, which had the dialog asking its parent how to draw its own contents.
 * They are here rather than inside the dialog because two of them are also the
 * page's: it needs the row id to drop a deleted record from the list, and the
 * label to name the record in the confirmation prompt.
 */

function shortId(id: string): string {
  const value = String(id || '');
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

/** A record is identified by its site and profile together, not by either alone. */
export function siteDataRowId(record: SiteDataRecord): string {
  return `${record?.siteKey || ''}|${record?.profileId || ''}`;
}

/**
 * The site, not the title the site chose for its own record: two different
 * sites can easily both call theirs "My profile", so the key has to lead.
 */
export function siteDataSiteLabel(record: SiteDataRecord): string {
  const key = String(record?.siteKey || '').trim();
  if (key.startsWith('domain:')) return key.slice('domain:'.length);
  if (key.startsWith('ipfs:')) return `ipfs:${shortId(key.slice('ipfs:'.length))}`;
  if (key.startsWith('ipns:')) return `ipns:${shortId(key.slice('ipns:'.length))}`;
  return key || t('Unknown site');
}

/**
 * Nested values are summarised rather than dumped: `datas` is arbitrary
 * site-defined JSON, and a flat scannable table is the point of this view.
 * The raw JSON is one click away for anyone who wants everything.
 */
export function formatSiteDataFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') {
    const count = Object.keys(value as object).length;
    return `${count} field${count === 1 ? '' : 's'}`;
  }
  const text = String(value);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

export function siteDataFields(record: SiteDataRecord): { key: string; value: string }[] {
  const datas = record?.datas;
  const source = datas && typeof datas === 'object' && !Array.isArray(datas) ? datas : {};
  return Object.entries(source).map(([key, value]) => ({
    key,
    value: formatSiteDataFieldValue(value),
  }));
}

export function siteDataJson(record: SiteDataRecord): string {
  try {
    return JSON.stringify(record?.datas ?? {}, null, 2);
  } catch {
    // Arbitrary site-defined JSON can carry a cycle; an empty pane beats a
    // thrown render.
    return '';
  }
}
