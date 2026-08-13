import { describe, expect, it } from 'vitest';
import {
  STAKE_ACTION_LABELS,
  STAKE_AMOUNT_LABELS,
  STAKE_CONFIRM_LABELS,
  stakeActionLabel,
} from '../../src/internal/services/stakeActions';
import type { StakeAction } from '../../src/types/networkPage';

/**
 * The four stake actions, named the same way in both places that name them.
 *
 * They used to be a table inside the dialog, which meant the page raising the
 * toast after a delegation had no way to reach them and built its own label by
 * interpolating the chain's enum - "Delegate successful!", in English, in every
 * language.
 */

const ACTIONS: StakeAction[] = ['Delegate', 'Undelegate', 'Redelegate', 'Withdraw'];

describe('every action is named', () => {
  it('has an entry in all three tables', () => {
    for (const action of ACTIONS) {
      expect(typeof STAKE_ACTION_LABELS[action]).toBe('function');
      expect(typeof STAKE_AMOUNT_LABELS[action]).toBe('function');
      expect(typeof STAKE_CONFIRM_LABELS[action]).toBe('function');
    }
  });

  it('holds no action the chain does not have', () => {
    expect(Object.keys(STAKE_ACTION_LABELS).sort()).toEqual([...ACTIONS].sort());
  });

  it('resolves to a non-empty label', () => {
    for (const action of ACTIONS) {
      expect(stakeActionLabel(action).length).toBeGreaterThan(0);
    }
  });

  it('gives each action a distinct label, so a toast names the right one', () => {
    const labels = ACTIONS.map(stakeActionLabel);
    expect(new Set(labels).size).toBe(ACTIONS.length);
  });
});

describe('the labels are read at call time', () => {
  it('is a function per entry, not a string', () => {
    // A string here would freeze whichever language was active when the module
    // first loaded; the app changes language without reloading.
    for (const entry of Object.values(STAKE_ACTION_LABELS)) {
      expect(typeof entry).toBe('function');
    }
  });
});

describe('an action outside the four', () => {
  it('falls back to the chain spelling rather than an empty label', () => {
    expect(stakeActionLabel('Sideways' as StakeAction)).toBe('Sideways');
  });
});
