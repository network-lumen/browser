/**
 * Naming rules for stable links (the IPNS keys a site publishes under).
 *
 * These encode a convention rather than a preference: the browser stores such
 * keys in Kubo under a `stable:` prefix, which is what keeps them apart from
 * the raw keys a user creates by hand in Domains. DomainPage and
 * LumenSiteModalHost each carried their own copy, so changing the prefix or
 * the allowed characters in one would have silently desynchronised the other -
 * the same failure mode the Drive storage keys had before `driveStorage.ts`.
 */

/** Marks a Kubo key as site-managed. Changing this orphans every existing key. */
const STABLE_KEY_PREFIX = 'stable:';

/** Longest label kept, so a pasted essay cannot become a key name. */
const MAX_LABEL_LENGTH = 96;

/**
 * A user-typed label reduced to what may appear in a Kubo key name: spaces
 * become dashes, anything outside `[a-zA-Z0-9._-]` too, and runs of dashes at
 * either end are dropped. Returns `''` when nothing usable is left.
 */
export function sanitizeStableLinkLabel(input: string): string {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LABEL_LENGTH);
}

/** Full key name for a label, or `''` if the label sanitises to nothing. */
export function stableLinkKeyNameFromLabel(input: string): string {
  const label = sanitizeStableLinkLabel(input);
  return label ? `${STABLE_KEY_PREFIX}${label}` : '';
}

/**
 * The label to show for a key name - the inverse of the above. Anything that
 * is not one of our prefixed names is passed through untouched, since the list
 * this feeds also contains keys the user made themselves.
 */
export function stableLinkDisplayName(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
  if (parts[0] === 'stable' && parts.length > 1) return parts[parts.length - 1];
  return raw;
}
