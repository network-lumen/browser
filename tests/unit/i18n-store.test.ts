import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCALES,
  hasChosenLocale,
  initLocale,
  setLocale,
  suggestedLocale,
  systemLanguages,
  t,
  useI18n
} from '../../src/stores/i18nStore';
import { activeProfileId } from '../../src/stores/profilesStore';
import { STORAGE_KEYS, profileScopedKey } from '../../src/internal/services/storage';
import { nextTick } from 'vue';

/**
 * The store is thin over `internal/services/i18n`, so this covers what the
 * service cannot see: that a language change is reactive, that the choice
 * survives a restart, and that a profile keeps its own language while a new one
 * inherits rather than asking again.
 */

function bridge(languages: unknown) {
  (window as any).lumen = { appSystemLanguages: languages };
}

// Storage is cleared *last*: resetting the module state goes through
// `setLocale`, which persists, so clearing first would leave every test
// starting from a machine that has already saved a preference - and a saved
// preference legitimately beats the OS.
beforeEach(async () => {
  delete (window as any).lumen;
  activeProfileId.value = '';
  setLocale('en');
  await nextTick();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  delete (window as any).lumen;
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
    bridge(['de-DE']);
    setLocale('fr');
    initLocale();
    expect(useI18n().locale.value).toBe('fr');
  });

  it('falls back to English for a language with no catalogue', () => {
    setLocale('sv');
    expect(useI18n().locale.value).toBe('en');
  });

  it('still renders the English source for a string nobody has translated', () => {
    setLocale('fr');
    expect(t('A string that is in no catalogue')).toBe('A string that is in no catalogue');
  });
});

describe('what the OS suggests', () => {
  it('prefers the main process list over the navigator', () => {
    bridge(['ja-JP', 'en-US']);
    expect(systemLanguages()[0]).toBe('ja-JP');
    expect(suggestedLocale()).toBe('ja');
  });

  it('reduces a region tag to a language we ship', () => {
    bridge(['pt-BR']);
    expect(suggestedLocale()).toBe('pt');
    bridge(['zh-Hans-CN']);
    expect(suggestedLocale()).toBe('zh');
  });

  it('takes the first OS language it has a catalogue for', () => {
    bridge(['sv-SE', 'nb-NO', 'de-DE', 'en-GB']);
    expect(suggestedLocale()).toBe('de');
  });

  it('answers English when the machine speaks nothing we ship', () => {
    bridge(['sv-SE', 'nb-NO']);
    expect(suggestedLocale()).toBe('en');
  });

  it('survives a bridge that is missing or answers rubbish', () => {
    bridge(undefined);
    expect(() => suggestedLocale()).not.toThrow();
    bridge('ja');
    expect(() => suggestedLocale()).not.toThrow();
  });
});

describe('whether onboarding should ask', () => {
  it('asks on a machine that has never answered', () => {
    initLocale();
    expect(hasChosenLocale()).toBe(false);
  });

  it('stops asking once someone answers, across a restart', () => {
    setLocale('ja', { chosen: true });
    initLocale();
    expect(hasChosenLocale()).toBe(true);
  });

  it('does not count the OS suggestion as an answer', () => {
    bridge(['ja-JP']);
    initLocale();
    expect(useI18n().locale.value).toBe('ja');
    expect(hasChosenLocale()).toBe(false);
  });
});

describe('a language per profile', () => {
  it('remembers each profile separately', async () => {
    activeProfileId.value = 'alice';
    await nextTick();
    setLocale('zh');

    activeProfileId.value = 'bob';
    await nextTick();
    setLocale('de');

    activeProfileId.value = 'alice';
    await nextTick();
    expect(useI18n().locale.value).toBe('zh');
  });

  // The whole point of storing it per profile: a profile created from a Chinese
  // one starts in Chinese, and nobody is asked a second time.
  it('gives a brand new profile the language in use when it appeared', async () => {
    activeProfileId.value = 'alice';
    await nextTick();
    setLocale('zh');

    activeProfileId.value = 'fresh';
    await nextTick();
    expect(useI18n().locale.value).toBe('zh');
    expect(localStorage.getItem(profileScopedKey(STORAGE_KEYS.locale, 'fresh'))).toBe('zh');
  });

  it('leaves a profile that predates per-profile languages on the current one', async () => {
    setLocale('it');
    activeProfileId.value = 'legacy';
    await nextTick();
    expect(useI18n().locale.value).toBe('it');
  });
});

describe('the shipped locales', () => {
  it('names each language in its own language', () => {
    expect(LOCALES.map((l) => l.code)).toContain('ar');
    expect(LOCALES.find((l) => l.code === 'ja')?.label).toBe('日本語');
    expect(LOCALES.find((l) => l.code === 'ru')?.label).toBe('Русский');
  });

  it('marks Arabic, and only Arabic, right-to-left', () => {
    expect(LOCALES.filter((l) => l.rtl).map((l) => l.code)).toEqual(['ar']);
  });

  it('has no duplicate code or label', () => {
    expect(new Set(LOCALES.map((l) => l.code)).size).toBe(LOCALES.length);
    expect(new Set(LOCALES.map((l) => l.label)).size).toBe(LOCALES.length);
  });

  it('sets the document direction from the language', () => {
    setLocale('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    setLocale('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });
});
