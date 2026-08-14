import { describe, expect, it } from 'vitest';
import { hasEnded, timeLeftLabel, updateCooldownSeconds } from '../../src/internal/services/countdown';

/**
 * How long is left on a governance deadline.
 *
 * The range matters: this chain votes for two days on mainnet and two minutes
 * on a devnet, so the same label has to stay useful across both. Proposal #1's
 * real window is used below - it opened and closed inside two minutes.
 */

const NOW = Date.parse('2026-08-14T16:29:04Z');
const VOTING_END = '2026-08-14T16:31:04.322190202Z';

describe('a deadline still ahead', () => {
  it('counts days when there are days', () => {
    expect(timeLeftLabel('2026-08-17T16:29:04Z', NOW)).toMatch(/3/);
  });

  it('counts hours below a day', () => {
    expect(timeLeftLabel('2026-08-14T21:29:04Z', NOW)).toMatch(/5/);
  });

  it('counts minutes below an hour - the devnet case', () => {
    expect(timeLeftLabel(VOTING_END, NOW)).toMatch(/2/);
  });

  it('says so rather than showing zero under a minute', () => {
    expect(timeLeftLabel('2026-08-14T16:29:34Z', NOW)).toMatch(/minute/i);
  });

  it('rounds down, so a unit is never claimed before it is whole', () => {
    // 47 hours is one day and change, not two days.
    expect(timeLeftLabel('2026-08-16T15:29:04Z', NOW)).toMatch(/1/);
  });
});

describe('a deadline behind us', () => {
  it('reports it as over', () => {
    expect(timeLeftLabel('2026-08-14T16:00:00Z', NOW)).toBe('Ended');
  });

  it('treats the exact instant as over', () => {
    expect(timeLeftLabel('2026-08-14T16:29:04Z', NOW)).toBe('Ended');
  });
});

describe('a deadline that is not one', () => {
  it('says nothing rather than guessing', () => {
    expect(timeLeftLabel('', NOW)).toBe('');
    expect(timeLeftLabel('soon', NOW)).toBe('');
  });
});

/**
 * How long before the dns module will take another update.
 *
 * It refuses one inside update_rate_limit_seconds with "domain updated too
 * recently: invalid request", which does not say how long - and both numbers
 * needed to answer are already on screen.
 */
describe('the update cooldown', () => {
  const UPDATED_AT = 1786620417; // seconds, as the chain reports it
  const at = (offsetSeconds: number) => (UPDATED_AT + offsetSeconds) * 1000;

  it('counts down from the moment of the last update', () => {
    expect(updateCooldownSeconds(UPDATED_AT, 60, at(0))).toBe(60);
    expect(updateCooldownSeconds(UPDATED_AT, 60, at(25))).toBe(35);
  });

  it('is over once the limit has elapsed', () => {
    expect(updateCooldownSeconds(UPDATED_AT, 60, at(60))).toBe(0);
    expect(updateCooldownSeconds(UPDATED_AT, 60, at(600))).toBe(0);
  });

  it('is nothing when the chain sets no limit', () => {
    expect(updateCooldownSeconds(UPDATED_AT, 0, at(0))).toBe(0);
    expect(updateCooldownSeconds(UPDATED_AT, null, at(0))).toBe(0);
  });

  it('is nothing when the domain has never been updated', () => {
    expect(updateCooldownSeconds(null, 60, at(0))).toBe(0);
    expect(updateCooldownSeconds(0, 60, at(0))).toBe(0);
  });

  it('does not invent a wait out of unparseable input', () => {
    expect(updateCooldownSeconds(Number.NaN, 60, at(0))).toBe(0);
    expect(updateCooldownSeconds(UPDATED_AT, Number.NaN, at(0))).toBe(0);
    expect(updateCooldownSeconds(undefined, undefined, at(0))).toBe(0);
  });

  it('never reports a negative wait', () => {
    expect(updateCooldownSeconds(UPDATED_AT, 30, at(10_000))).toBe(0);
  });
});

describe('hasEnded', () => {
  it('answers the same question as the label, for drawing rather than saying', () => {
    expect(hasEnded(VOTING_END, NOW)).toBe(false);
    expect(hasEnded(VOTING_END, Date.parse('2026-08-14T16:32:00Z'))).toBe(true);
  });

  it('is false for an unparseable deadline, so nothing is hidden by accident', () => {
    expect(hasEnded('', NOW)).toBe(false);
    expect(hasEnded('whenever', NOW)).toBe(false);
  });
});
