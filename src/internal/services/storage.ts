/**
 * Every `localStorage` key the renderer owns, plus never-throwing accessors.
 *
 * Keys used to be string literals scattered across 17 files, in four different
 * spellings, with each site re-writing its own `JSON.parse` guard. Collecting
 * them here makes collisions visible and gives one place to fix a read.
 *
 * ⚠️ The values below are FROZEN: they address data already sitting in users'
 * browsers. Renaming one silently orphans whatever it holds. The inconsistent
 * spellings (`lumen:x:v1` / `lumen_x` / `lumen-x` / no prefix at all) are
 * historical and kept on purpose — new keys should use `lumen:<area>:<name>:v1`.
 */
export const STORAGE_KEYS = {
  // Appearance
  theme: 'lumen-theme',
  fontSize: 'lumen-font-size',
  brightness: 'lumen-brightness',
  /** Profile-scoped via `profileScopedKey`; also written unscoped as the pre-profile fallback. */
  locale: 'lumen:locale:v1',
  /** Set once someone picks a language, so onboarding only ever asks on a fresh machine. */
  localeChosen: 'lumen:locale:chosen:v1',

  // Browser state
  favourites: 'lumen:favourites:v2',
  history: 'lumen:history:v1',
  historySettings: 'lumen:history:settings:v1',
  /** host -> favicon URL, pinned so shortcut and history lists draw instantly. */
  siteIcons: 'lumen:siteIcons:v1',

  // Home / new tab layout
  homeMySpaceCards: 'my_space_cards_order',
  homeLumenCards: 'lumen_cards_order',
  homeAllPagesOrder: 'lumen_all_pages_order',
  newTabOnboarding: 'lumen:onboarding:discover:v1',

  // Drive (profile-scoped: combine with `profileScopedKey`)
  driveFiles: 'lumen:drive:files:v1',
  driveLocalNames: 'lumen:drive:names:v1',
  driveHlsQueue: 'lumen:drive:hlsQueue:v1',
  driveBackupSeq: 'lumen:driveBackup:seq:v1',
  driveBackupLastExportAt: 'lumen:driveBackup:lastExportAt:v1',
  driveBackupLastImportAt: 'lumen:driveBackup:lastImportAt:v1',
  driveItemsPerPage: 'lumen:drive:itemsPerPage:v1',

  // Wallet
  chainRegistryCache: 'lumen_chain_registry_cache_v2',
  /**
   * The Cosmos chain directory, trimmed. See cosmosDirectory.ts.
   *
   * Bump the version whenever the trim changes. What is stored is the parsed
   * result, not the response, so a parser fix is invisible to anyone holding a
   * cached copy until its TTL expires - v1 shipped with `denom` reading
   * "[object Object]" and no image for the home chain, and re-reading it could
   * not repair either.
   */
  cosmosChainsCache: 'lumen:cosmos:chains:v4',
  /** The registry's IBC pair index, names only. See cosmosDirectory.ts. */
  cosmosIbcIndexCache: 'lumen:cosmos:ibcIndex:v1',
  /** Set once the Cosmos migration banner has been dismissed. */
  cosmosMigrationDismissed: 'lumen:cosmos:migrationDismissed:v1',
  /** Profile-scoped: suffixed with the profile id. Followed Cosmos chains. */
  cosmosFollowedPrefix: 'lumen:cosmos:followed:v1',
  recurringPayments: 'lumen_recurring_payments',
  paymentHistory: 'lumen_payment_history',
  paymentReminders: 'lumen_payment_reminders',
  /** Profile-scoped: suffixed with the profile id. */
  walletOnboardingCompletedPrefix: 'lumen_wallet_onboarding_completed_',

  // Misc
  thumbSafetyCache: 'lumen-search-thumb-safety-v1.2',
  releaseSnoozeUntil: 'lumen:release:snoozeUntil',
  /** Finished activity entries kept so the panel survives a restart. */
  activityHistory: 'lumen:activity:history:v1'
} as const;

/** Profile-less sessions get their own bucket rather than an empty suffix. */
const GUEST_PROFILE = 'guest';

/** Builds the `<prefix>:<profileId>` form used by every per-profile key. */
export function profileScopedKey(prefix: string, profileId: string): string {
  const pid = String(profileId || '').trim();
  return `${prefix}:${pid || GUEST_PROFILE}`;
}

/**
 * Reads and parses a JSON value, returning `fallback` for anything unusable
 * (missing, unparseable, or a browser that denies storage access).
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/** Serializes and stores a value. Returns `false` when storage rejected it. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded, or storage blocked entirely.
    return false;
  }
}

/** Raw string read; `null` when absent or unreadable. */
export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
