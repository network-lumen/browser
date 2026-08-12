import { computed, ref } from 'vue';
import {
  DEFAULT_LOCALE,
  LOCALES,
  normalizeLocale,
  resolveInitialLocale,
  translate
} from '../internal/services/i18n';
import { STORAGE_KEYS, readString, writeString } from '../internal/services/storage';
import fr from '../locales/fr.json';
import type { LocaleCode, MessageCatalog, MessageParams } from '../types/i18n';

export { LOCALES };
export type { LocaleCode };

/**
 * English is the source language, so it has no catalogue: `translate` falls
 * back to the key, which *is* the English text.
 */
const CATALOGS: Record<LocaleCode, MessageCatalog> = {
  en: {},
  fr: fr as MessageCatalog
};

const locale = ref<LocaleCode>(DEFAULT_LOCALE);
const catalog = computed<MessageCatalog>(() => CATALOGS[locale.value] || {});

export function setLocale(next: unknown) {
  locale.value = normalizeLocale(next);
  writeString(STORAGE_KEYS.locale, locale.value);
}

export function initLocale() {
  locale.value = resolveInitialLocale([
    readString(STORAGE_KEYS.locale),
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language
  ]);
}

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
