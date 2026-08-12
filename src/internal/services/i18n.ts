import type { LocaleCode, LocaleOption, MessageCatalog, MessageParams } from '../../types/i18n';

export type { LocaleCode, MessageCatalog, MessageParams };

/**
 * Translation keyed on the English source string, not on an invented id.
 *
 * The alternative - `t('navbar.profile.export')` - needs a name invented for
 * every one of ~2 000 strings, and gets one wrong the moment two people name
 * the same button differently. Keying on the English means the migration of a
 * call site is mechanical (`Save` becomes `t('Save')`), a missing translation
 * renders the original rather than a key, and the extractor below can read the
 * whole catalogue straight out of the source.
 *
 * The cost is that changing the English wording orphans the translation. That
 * is the right trade here: `npm run i18n:extract` reports orphans, and the
 * repo's own rule is that a user-facing message has one wording anyway.
 */
export const LOCALES: readonly LocaleOption[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' }
];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export function isLocaleCode(value: unknown): value is LocaleCode {
  return LOCALES.some((locale) => locale.code === value);
}

/**
 * `fr-CA` and `FR` both mean the `fr` catalogue. Anything unrecognised falls
 * back rather than throwing: a locale is a display preference, and refusing to
 * start over one would be worse than showing English.
 */
export function normalizeLocale(value: unknown): LocaleCode {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return DEFAULT_LOCALE;
  const base = raw.split(/[-_]/)[0];
  return isLocaleCode(base) ? base : DEFAULT_LOCALE;
}

/** The first candidate with a catalogue - a saved choice, then the OS languages. */
export function resolveInitialLocale(candidates: readonly (string | null | undefined)[]): LocaleCode {
  for (const candidate of candidates) {
    const raw = String(candidate ?? '').trim();
    if (!raw) continue;
    const base = raw.toLowerCase().split(/[-_]/)[0];
    if (isLocaleCode(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * Splices `{name}` placeholders. An unknown placeholder is left as written
 * rather than replaced with `undefined`, so a translation that invents a name
 * shows the mistake instead of hiding it.
 */
export function interpolate(text: string, params?: MessageParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  );
}

/**
 * Marks a string in a data table as translatable without translating it here.
 *
 * A module-level `const` is built once, at import, so calling `t()` in one
 * freezes whatever language was active then - the table would keep its first
 * language for the rest of the session. The fix is to translate where the value
 * is rendered, but then the English never appears inside a `t()` and
 * `npm run i18n:extract` cannot see it, so it ships untranslated instead.
 *
 * This is the gettext `N_()` idiom: it returns its argument unchanged and
 * exists only so the extractor has something to find. Use it in the table, and
 * `t()` at the point of display.
 */
export function markForTranslation(text: string): string {
  return text;
}

export function translate(catalog: MessageCatalog, key: string, params?: MessageParams): string {
  const source = String(key ?? '');
  const translated = catalog?.[source];
  return interpolate(translated ? translated : source, params);
}

/** What `npm run i18n:extract` reports: what a catalogue is missing, and what it still carries. */
export function auditCatalog(sourceKeys: readonly string[], catalog: MessageCatalog) {
  const known = new Set(sourceKeys);
  const missing = sourceKeys.filter((key) => !String(catalog[key] || '').trim());
  const orphaned = Object.keys(catalog).filter((key) => !known.has(key));
  return { missing, orphaned, total: sourceKeys.length };
}
