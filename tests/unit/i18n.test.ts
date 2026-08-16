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
import frCatalogue from '../../src/locales/fr.json';
import arCatalogue from '../../src/locales/ar.json';
import deCatalogue from '../../src/locales/de.json';
import esCatalogue from '../../src/locales/es.json';
import hiCatalogue from '../../src/locales/hi.json';
import idCatalogue from '../../src/locales/id.json';
import itCatalogue from '../../src/locales/it.json';
import jaCatalogue from '../../src/locales/ja.json';
import koCatalogue from '../../src/locales/ko.json';
import ptCatalogue from '../../src/locales/pt.json';
import ruCatalogue from '../../src/locales/ru.json';
import zhCatalogue from '../../src/locales/zh.json';

// Aliased: Italian is `it`, which would shadow vitest's own `it`.
const CATALOGUES = {
  fr: frCatalogue,
  es: esCatalogue,
  pt: ptCatalogue,
  de: deCatalogue,
  it: itCatalogue,
  ru: ruCatalogue,
  ar: arCatalogue,
  hi: hiCatalogue,
  id: idCatalogue,
  zh: zhCatalogue,
  ja: jaCatalogue,
  ko: koCatalogue
};

describe('locale resolution', () => {
  it('accepts a bare code', () => {
    expect(normalizeLocale('fr')).toBe('fr');
  });

  it('reduces a region tag to its language', () => {
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('FR_ca')).toBe('fr');
  });

  it('reduces a script-and-region tag to its language', () => {
    expect(normalizeLocale('zh-Hans-CN')).toBe('zh');
    expect(normalizeLocale('pt-BR')).toBe('pt');
  });

  it('falls back rather than throwing on a language with no catalogue', () => {
    // Swedish is the stand-in for "not shipped" throughout these tests: it has
    // to be a real language nobody has added, or the test starts passing for
    // the wrong reason the day that language is added.
    expect(normalizeLocale('sv')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(42)).toBe(DEFAULT_LOCALE);
  });

  it('takes the first candidate it has a catalogue for', () => {
    expect(resolveInitialLocale([null, '', 'sv-SE', 'fr-FR', 'en'])).toBe('fr');
  });

  it('falls back to English when nothing matches', () => {
    expect(resolveInitialLocale(['sv', 'nb'])).toBe('en');
    expect(resolveInitialLocale([])).toBe('en');
  });

  it('knows which codes are real', () => {
    expect(isLocaleCode('fr')).toBe(true);
    expect(isLocaleCode('ar')).toBe(true);
    expect(isLocaleCode('sv')).toBe(false);
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

/**
 * Every shipped catalogue, held to the same three rules.
 *
 * An empty entry is the normal state of a string nobody has translated yet -
 * `translate` falls back to the key, which is the English - so the assertions
 * only cover entries that carry a value. A dropped `{placeholder}` is the one
 * failure that is invisible in review and obvious to a user: the sentence
 * simply loses the number or the name it was about.
 */
describe.each(Object.entries(CATALOGUES))('the shipped %s catalogue', (_code, raw) => {
  const catalog = raw as Record<string, string>;
  const translated = Object.entries(catalog).filter(([, value]) => value.trim());

  it('keeps every placeholder its English source declares', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, value] of translated) {
      expect(placeholders(value), `placeholders drifted in ${JSON.stringify(key)}`).toEqual(
        placeholders(key)
      );
    }
  });

  it('never holds a whitespace-only translation, which would render as a blank label', () => {
    const blank = Object.entries(catalog).filter(([, v]) => v.length > 0 && !v.trim());
    expect(blank).toEqual([]);
  });

  it('translates only strings the source actually asks for', () => {
    const sourceKeys = new Set(Object.keys(frCatalogue));
    const strays = Object.keys(catalog).filter((key) => !sourceKeys.has(key));
    expect(strays).toEqual([]);
  });
});

describe('auditing a catalogue', () => {
  it('reports what is missing and what no longer has a source string', () => {
    const result = auditCatalog(['A', 'B'], { A: 'a', C: 'c' });
    expect(result).toEqual({ missing: ['B'], orphaned: ['C'], total: 2 });
  });
});
