import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initLocale, setLocale, t, useI18n } from '../../src/stores/i18nStore';
import { STORAGE_KEYS } from '../../src/internal/services/storage';

/**
 * The store is thin over `internal/services/i18n`, so this only covers what the
 * service cannot see: that a language change is reactive, and that the choice
 * survives a restart.
 */

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
});

afterEach(() => {
  localStorage.clear();
});

describe('the language a user picked', () => {
  it('changes what t() answers, without anything re-subscribing', () => {
    expect(t('Cancel')).toBe('Cancel');
    setLocale('fr');
    expect(t('Cancel')).toBe('Annuler');
  });

  it('is written to storage under the locale key', () => {
    setLocale('fr');
    expect(localStorage.getItem(STORAGE_KEYS.locale)).toBe('fr');
  });

  it('is read back on the next start, ahead of the OS languages', () => {
    setLocale('fr');
    initLocale();
    expect(useI18n().locale.value).toBe('fr');
  });

  it('falls back to English for a language with no catalogue', () => {
    setLocale('de');
    expect(useI18n().locale.value).toBe('en');
  });

  it('still renders the English source for a string nobody has translated', () => {
    setLocale('fr');
    expect(t('A string that is in no catalogue')).toBe('A string that is in no catalogue');
  });
});
