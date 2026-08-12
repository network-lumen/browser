import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  auditCatalog,
  interpolate,
  isLocaleCode,
  normalizeLocale,
  resolveInitialLocale,
  translate
} from '../../src/internal/services/i18n';
import fr from '../../src/locales/fr.json';

describe('locale resolution', () => {
  it('accepts a bare code', () => {
    expect(normalizeLocale('fr')).toBe('fr');
  });

  it('reduces a region tag to its language', () => {
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('FR_ca')).toBe('fr');
  });

  it('falls back rather than throwing on a language with no catalogue', () => {
    expect(normalizeLocale('de')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(42)).toBe(DEFAULT_LOCALE);
  });

  it('takes the first candidate it has a catalogue for', () => {
    expect(resolveInitialLocale([null, '', 'de-DE', 'fr-FR', 'en'])).toBe('fr');
  });

  it('falls back to English when nothing matches', () => {
    expect(resolveInitialLocale(['de', 'ja'])).toBe('en');
    expect(resolveInitialLocale([])).toBe('en');
  });

  it('knows which codes are real', () => {
    expect(isLocaleCode('fr')).toBe(true);
    expect(isLocaleCode('de')).toBe(false);
  });
});

describe('translation', () => {
  const catalog = { Cancel: 'Annuler', Empty: '' };

  it('returns the translation when there is one', () => {
    expect(translate(catalog, 'Cancel')).toBe('Annuler');
  });

  it('falls back to the English key, which is the source text', () => {
    expect(translate(catalog, 'Save')).toBe('Save');
  });

  it('treats an empty entry as untranslated rather than rendering a hole', () => {
    expect(translate(catalog, 'Empty')).toBe('Empty');
  });

  it('splices named params', () => {
    expect(translate({}, 'Delete {name}?', { name: 'Alice' })).toBe('Delete Alice?');
  });

  it('splices into the translation, not the key', () => {
    expect(
      translate({ 'Delete {name}?': 'Supprimer {name} ?' }, 'Delete {name}?', { name: 'Alice' })
    ).toBe('Supprimer Alice ?');
  });

  it('leaves an unknown placeholder visible instead of writing undefined', () => {
    expect(interpolate('Hello {who} from {where}', { who: 'Bob' })).toBe('Hello Bob from {where}');
  });

  it('repeats a placeholder used twice', () => {
    expect(interpolate('{n} of {n}', { n: 3 })).toBe('3 of 3');
  });
});

describe('the shipped French catalogue', () => {
  const catalog = fr as Record<string, string>;

  it('has no empty entry, which would silently fall back to English', () => {
    const empty = Object.entries(catalog).filter(([, value]) => !String(value).trim());
    expect(empty).toEqual([]);
  });

  it('keeps every placeholder its English source declares', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, value] of Object.entries(catalog)) {
      expect(placeholders(value), `placeholders drifted in ${JSON.stringify(key)}`).toEqual(
        placeholders(key)
      );
    }
  });
});

describe('auditing a catalogue', () => {
  it('reports what is missing and what no longer has a source string', () => {
    const result = auditCatalog(['A', 'B'], { A: 'a', C: 'c' });
    expect(result).toEqual({ missing: ['B'], orphaned: ['C'], total: 2 });
  });
});
