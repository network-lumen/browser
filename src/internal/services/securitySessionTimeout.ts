import { t } from '../../stores/i18nStore';
import { markForTranslation } from './i18n';
import type { SecuritySessionTimeoutMs } from "../../types/settings";

export type { SecuritySessionTimeoutMs };

export const DEFAULT_SECURITY_SESSION_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * 5 minutes used to be the shortest option. It is gone rather than deprecated:
 * a setting stored at that value no longer normalizes, so it falls back to the
 * default above - which lengthens nobody's lock but shortens nobody's session
 * either. Keep this list in step with electron/settings.cjs, which validates
 * the same values on the way in.
 */
const VALID_SECURITY_SESSION_TIMEOUTS = new Set<number>([
  15 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
]);

export const SECURITY_SESSION_TIMEOUT_OPTIONS = Object.freeze([
  {
    value: 15 * 60 * 1000,
    serialized: "900000",
    label: markForTranslation("15 min"),
    durationText: markForTranslation("15 minutes"),
  },
  {
    value: 30 * 60 * 1000,
    serialized: "1800000",
    label: markForTranslation("30 min"),
    durationText: markForTranslation("30 minutes"),
  },
  {
    value: 2 * 60 * 60 * 1000,
    serialized: "7200000",
    label: markForTranslation("2 hours"),
    durationText: markForTranslation("2 hours"),
  },
  {
    value: null,
    serialized: "restart",
    label: markForTranslation("Until restart"),
    durationText: markForTranslation("until restart"),
  },
] as const);

export function normalizeSecuritySessionTimeoutMs(
  input: unknown,
  fallback: SecuritySessionTimeoutMs = DEFAULT_SECURITY_SESSION_TIMEOUT_MS,
): SecuritySessionTimeoutMs {
  if (input === null) return null;
  if (typeof input !== "number" || !Number.isFinite(input)) return fallback;
  return VALID_SECURITY_SESSION_TIMEOUTS.has(input) ? input : fallback;
}

export function stringifySecuritySessionTimeoutMs(value: SecuritySessionTimeoutMs): string {
  const normalized = normalizeSecuritySessionTimeoutMs(value);
  return normalized === null ? "restart" : String(normalized);
}

export function parseSecuritySessionTimeoutMs(value: string): SecuritySessionTimeoutMs {
  if (value === "restart") return null;
  return normalizeSecuritySessionTimeoutMs(Number(value));
}

function getSecuritySessionTimeoutOption(value: SecuritySessionTimeoutMs) {
  const normalized = normalizeSecuritySessionTimeoutMs(value);
  return (
    SECURITY_SESSION_TIMEOUT_OPTIONS.find((option) => option.value === normalized) ||
    SECURITY_SESSION_TIMEOUT_OPTIONS[0]
  );
}

// The duration goes in as a {placeholder} rather than being concatenated:
// "for 15 minutes" is not "pour" + the same words in every language, and a
// sentence assembled from fragments cannot be reordered by a translator.
function getSecuritySessionTimeoutDurationText(value: SecuritySessionTimeoutMs): string {
  return t(getSecuritySessionTimeoutOption(value).durationText);
}

export function getSecuritySessionTimeoutCacheText(value: SecuritySessionTimeoutMs): string {
  if (normalizeSecuritySessionTimeoutMs(value) === null) return t('until restart');
  return t('for {duration}', { duration: getSecuritySessionTimeoutDurationText(value) });
}

export function getSecuritySessionTimeoutHelpText(value: SecuritySessionTimeoutMs): string {
  if (normalizeSecuritySessionTimeoutMs(value) === null) return t('until the app restarts');
  return t('for {duration}', { duration: getSecuritySessionTimeoutDurationText(value) });
}

export function getSecuritySessionTimeoutIdleText(value: SecuritySessionTimeoutMs): string | null {
  if (normalizeSecuritySessionTimeoutMs(value) === null) return null;
  return t('{duration} of inactivity', { duration: getSecuritySessionTimeoutDurationText(value) });
}
