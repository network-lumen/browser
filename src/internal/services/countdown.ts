import { t } from '../../stores/i18nStore';

/**
 * How long until a deadline, in the largest unit that still says something.
 *
 * Governance deadlines span three orders of magnitude on the same screen: this
 * chain votes for two days on mainnet and two minutes on a devnet, and an
 * unbonding runs three weeks. "Ends 2026-08-14T16:31:04Z" answers none of the
 * questions anyone actually has - is it over, do I have time to read it, should
 * I vote now.
 *
 * Deliberately coarse: one unit, rounded down. "1 day left" for anything
 * between one and two days is honest, where "1 day 3 hours 12 minutes" is
 * precision nobody can act on and that is wrong a second later.
 */
export function timeLeftLabel(deadline: string, now: number = Date.now()): string {
  const at = Date.parse(String(deadline || ''));
  if (!Number.isFinite(at)) return '';

  const seconds = Math.floor((at - now) / 1000);
  if (seconds <= 0) return t('Ended');

  const days = Math.floor(seconds / 86400);
  if (days >= 1) return t('{count}d left', { count: days });

  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return t('{count}h left', { count: hours });

  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) return t('{count}m left', { count: minutes });

  // Under a minute is worth saying as its own thing: a two-minute devnet vote
  // spends most of its life here, and "0m left" reads as over when it is not.
  return t('Less than a minute left');
}

/**
 * Seconds still to wait before the chain will accept another update.
 *
 * The dns module refuses a second update inside `update_rate_limit_seconds`
 * with "domain updated too recently", which says nothing about how long. Both
 * halves of the answer are already on screen - the domain carries its
 * `updated_at`, the module params carry the limit - so the wait can be stated
 * instead of discovered by signing.
 *
 * @returns 0 when the wait is over, when either input is missing, or when the
 *   chain sets no limit at all. Never a guess: an unknown is not a wait.
 */
export function updateCooldownSeconds(
  updatedAtSeconds: number | null | undefined,
  rateLimitSeconds: number | null | undefined,
  now: number = Date.now()
): number {
  const updatedAt = Number(updatedAtSeconds);
  const limit = Number(rateLimitSeconds);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return 0;
  if (!Number.isFinite(limit) || limit <= 0) return 0;

  const elapsed = Math.floor(now / 1000) - updatedAt;
  const remaining = limit - elapsed;
  return remaining > 0 ? remaining : 0;
}

/** Whether a deadline has passed, for deciding what to draw rather than what to say. */
export function hasEnded(deadline: string, now: number = Date.now()): boolean {
  const at = Date.parse(String(deadline || ''));
  return Number.isFinite(at) && at <= now;
}
