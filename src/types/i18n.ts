/**
 * A locale's catalogue: the English source string to its translation. An empty
 * value means "not translated yet" and falls back to the key, so a half-done
 * catalogue renders correctly rather than showing holes.
 */
export type MessageCatalog = Record<string, string>;

export type LocaleCode =
  | 'en'
  | 'fr'
  | 'es'
  | 'pt'
  | 'de'
  | 'it'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'id'
  | 'zh'
  | 'ja'
  | 'ko';

export interface LocaleOption {
  code: LocaleCode;
  /** Written in its own language, the way every language picker does it. */
  label: string;
  /**
   * A flag for the picker, as a regional-indicator pair.
   *
   * A language is not a country - Spanish, Portuguese and Arabic are spoken in
   * dozens - so this is the conventional shorthand a picker uses, not a claim
   * about where the language belongs. Windows ships no flag glyphs, and
   * Chromium falls back to drawing the two letters there, which still reads as
   * a country marker; the endonym beside it is what actually names the
   * language.
   */
  flag: string;
  /**
   * Writing direction. Only Arabic is right-to-left here, and it is what the
   * `dir` attribute on `<html>` is set from - without it the whole interface
   * stays mirrored the wrong way round however good the translation is.
   */
  rtl?: boolean;
}

/** Values spliced into `{name}` placeholders. */
export type MessageParams = Record<string, string | number>;
