/** What kind of icon a listed URL gets, decided from the URL alone. */
export type SiteIconKind =
  /** An internal Lumen page - draw the Lumen mark. */
  | 'lumen'
  /** A Lumen domain or an http(s) site - draw its favicon. */
  | 'site'
  /** A file, a search, anything without an icon of its own. */
  | 'none';
