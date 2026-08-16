import { computed, ref, watch } from 'vue';
import {
  DEFAULT_LOCALE,
  LOCALES,
  isRightToLeft,
  normalizeLocale,
  resolveInitialLocale,
  translate
} from '../internal/services/i18n';
import { STORAGE_KEYS, profileScopedKey, readString, writeString } from '../internal/services/storage';
import { useInternalLumen } from '../composables/useInternalLumen';
import { activeProfileId } from './profilesStore';
import ar from '../locales/ar.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import hi from '../locales/hi.json';
import id from '../locales/id.json';
import it from '../locales/it.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import pt from '../locales/pt.json';
import ru from '../locales/ru.json';
import zh from '../locales/zh.json';
import type { LocaleCode, MessageCatalog, MessageParams } from '../types/i18n';

export { LOCALES };
export type { LocaleCode };

/**
 * English is the source language, so it has no catalogue: `translate` falls
 * back to the key, which *is* the English text.
 */
const CATALOGS: Record<LocaleCode, MessageCatalog> = {
  en: {},
  fr: fr as MessageCatalog,
  es: es as MessageCatalog,
  pt: pt as MessageCatalog,
  de: de as MessageCatalog,
  it: it as MessageCatalog,
  ru: ru as MessageCatalog,
  ar: ar as MessageCatalog,
  hi: hi as MessageCatalog,
  id: id as MessageCatalog,
  zh: zh as MessageCatalog,
  ja: ja as MessageCatalog,
  ko: ko as MessageCatalog
};

const locale = ref<LocaleCode>(DEFAULT_LOCALE);
const catalog = computed<MessageCatalog>(() => CATALOGS[locale.value] || {});

/**
 * Whether the user has ever chosen a language, as opposed to being given the
 * one the OS suggested. Onboarding asks once, on a machine that has never
 * answered; every profile after that inherits instead.
 */
const chosen = ref(false);

/** The language a profile is in, remembered per profile rather than per app. */
function localeKeyFor(profileId: string): string {
  return profileScopedKey(STORAGE_KEYS.locale, profileId);
}

/**
 * Also written unscoped. At the next cold start the renderer picks its language
 * before the profile list has loaded, and starting in the last language used
 * beats starting in English and switching a moment later.
 */
function persist(code: LocaleCode) {
  writeString(STORAGE_KEYS.locale, code);
  writeString(localeKeyFor(activeProfileId.value), code);
  writeString(STORAGE_KEYS.localeChosen, chosen.value ? '1' : '');
}

/**
 * A language is a reading direction as much as a vocabulary: without `dir` the
 * whole interface stays mirrored the wrong way round for Arabic, however good
 * the translation is. `lang` is what a screen reader picks its voice from.
 */
function applyDocumentLanguage(code: LocaleCode) {
  try {
    const root = document.documentElement;
    root.setAttribute('lang', code);
    root.setAttribute('dir', isRightToLeft(code) ? 'rtl' : 'ltr');
  } catch {
    // No document in a unit test; the language itself is unaffected.
  }
}

export function setLocale(next: unknown, options: { chosen?: boolean } = {}) {
  locale.value = normalizeLocale(next);
  if (options.chosen) chosen.value = true;
  applyDocumentLanguage(locale.value);
  persist(locale.value);
}

/** True once someone has picked a language, which is what onboarding asks about. */
export function hasChosenLocale(): boolean {
  return chosen.value;
}

/**
 * The languages the OS is set to, best first.
 *
 * Read from the main process rather than from `navigator.languages`: that one
 * is Chromium's UI locale, which reports a single language where the OS holds
 * an ordered list. The navigator list is still consulted after it, for the
 * browser-only runs the end-to-end tests use.
 */
export function systemLanguages(): string[] {
  const fromBridge = useInternalLumen()?.appSystemLanguages;
  return [
    ...(Array.isArray(fromBridge) ? fromBridge : []),
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language
  ].filter(Boolean);
}

/** The language the OS suggests, or English when it suggests nothing we ship. */
export function suggestedLocale(): LocaleCode {
  return resolveInitialLocale(systemLanguages());
}

export function initLocale() {
  chosen.value = readString(STORAGE_KEYS.localeChosen) === '1';
  locale.value = resolveInitialLocale([readString(STORAGE_KEYS.locale), ...systemLanguages()]);
  applyDocumentLanguage(locale.value);
}

/**
 * Switching profile switches language with it; a profile that has never had one
 * takes the language in use at the moment it appears.
 *
 * That second half is the whole point: a new profile created from a Chinese one
 * starts in Chinese, and nobody is asked again. It also covers every profile
 * that predates this being per-profile at all.
 */
watch(activeProfileId, (id) => {
  const saved = readString(localeKeyFor(id));
  if (saved) {
    locale.value = normalizeLocale(saved);
    applyDocumentLanguage(locale.value);
    return;
  }
  persist(locale.value);
});

/**
 * Reads `locale` on every call, which is what makes a language change re-render
 * every template that uses it without anything having to subscribe.
 */
export function t(key: string, params?: MessageParams): string {
  return translate(catalog.value, key, params);
}

export function useI18n() {
  return { locale, locales: LOCALES, setLocale, t };
}
