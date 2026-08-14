import { describe, expect, it } from 'vitest';
import { hasEnded, timeLeftLabel } from '../../src/internal/services/countdown';

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
