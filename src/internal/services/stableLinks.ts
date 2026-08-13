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

/**
 * Key names other parts of the app own, which must never be offered as a
 * domain of the user's.
 *
 * `sitedata:` is one key per (site, profile) - the identity a site publishes
 * its own record under, created without the user ever naming it. They were
 * listed in Domains beside the names the user made by hand, where renaming one
 * breaks that site's data and the list itself says which sites have stored
 * anything. Kept in step with `RESERVED_KEY_PREFIXES` in
 * `electron/sites/ipns_ownership.cjs`, which refuses the same names from the
 * publish side.
 */
const RESERVED_KEY_PREFIXES = ['sitedata:', 'siteidentity:'];

/** The node's own key, which is not a name at all. */
const SELF_KEY_NAME = 'self';

/**
 * Whether a Kubo key is one of the user's own names, rather than one the app
 * created and manages on their behalf.
 */
export function isUserFacingKeyName(name: string): boolean {
  const raw = String(name || '').trim();
  if (!raw || raw === SELF_KEY_NAME) return false;
  const lowered = raw.toLowerCase();
  return !RESERVED_KEY_PREFIXES.some((prefix) => lowered.startsWith(prefix));
}

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
