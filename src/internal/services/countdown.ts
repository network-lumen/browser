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

/** Whether a deadline has passed, for deciding what to draw rather than what to say. */
export function hasEnded(deadline: string, now: number = Date.now()): boolean {
  const at = Date.parse(String(deadline || ''));
  return Number.isFinite(at) && at <= now;
}
