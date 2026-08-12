/**
 * A locale's catalogue: the English source string to its translation. An empty
 * value means "not translated yet" and falls back to the key, so a half-done
 * catalogue renders correctly rather than showing holes.
 */
export type MessageCatalog = Record<string, string>;

export type LocaleCode = 'en' | 'fr';

export interface LocaleOption {
  code: LocaleCode;
  /** Written in its own language, the way every language picker does it. */
  label: string;
}

/** Values spliced into `{name}` placeholders. */
export type MessageParams = Record<string, string | number>;
