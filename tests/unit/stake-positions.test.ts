import { describe, expect, it } from 'vitest';
import {
  buildRedelegationLocks,
  buildStakePositions,
  hasStakePosition,
  redelegationLockUntil,
  totalStakePosition,
} from '../../src/internal/services/stakePositions';

/**
 * Where a wallet's stake actually is.
 *
 * Built from a real account that had just redelegated and reported its money
 * missing: 1 LMN delegated to one validator, 10 LMN delegated to a second
 * because a redelegation had moved it there, and 10 LMN unbonding from a third.
 * Reading delegations alone - which the explorer did - shows the source
 * validator at zero and nothing else, which is exactly what "je retrouve plus
 * mon argent" looks like.
 */

const A = 'lmnvaloper1ksjeadh54n72f5792c9nn6xqdjvtp85j80lhlx';
const B = 'lmnvaloper1mysu0pflkdk386mvttc0gv3hv4a7pv0kzmzpyx';
const C = 'lmnvaloper1m574sszvqxqpxwyf7huqdft54gu2897hprtder';

const LIVE = {
  delegations: [
    { delegation: { validator_address: A }, balance: { amount: '1000000' } },
    { delegation: { validator_address: B }, balance: { amount: '10000000' } },
  ],
  unbonding: [
    { validator_address: C, entries: [{ balance: '5000000' }, { balance: '5000000' }] },
  ],
  rewards: [
    { validator_address: A, reward: [{ denom: 'ulmn', amount: '2093587.342379405193' }] },
    { validator_address: B, reward: [{ denom: 'ulmn', amount: '7633.398393301320' }] },
  ],
};

describe('the three places stake lives', () => {
  it('finds the redelegated stake on the validator it moved to', () => {
    const map = buildStakePositions(LIVE);
    expect(map[B].staked).toBe(10_000_000);
  });

  it('keeps unbonding stake visible against the validator it left', () => {
    const map = buildStakePositions(LIVE);
    expect(map[C]).toMatchObject({ staked: 0, unbonding: 10_000_000, rewards: 0 });
  });

  it('sums the entries of one unbonding queue', () => {
    const map = buildStakePositions({ unbonding: LIVE.unbonding });
    expect(map[C].unbonding).toBe(10_000_000);
  });

  it('keeps the fractional part of a reward rather than truncating it here', () => {
    const map = buildStakePositions(LIVE);
    expect(map[A].rewards).toBeCloseTo(2_093_587.342379, 4);
  });

  it('accounts for every validator the wallet touches', () => {
    expect(Object.keys(buildStakePositions(LIVE)).sort()).toEqual([A, B, C].sort());
  });
});

describe('totals', () => {
  it('adds the three columns and counts the validators involved', () => {
    expect(totalStakePosition(buildStakePositions(LIVE))).toMatchObject({
      staked: 11_000_000,
      unbonding: 10_000_000,
      validatorCount: 3,
    });
  });

  it('is all zero for a wallet that has never staked', () => {
    expect(totalStakePosition(buildStakePositions({}))).toEqual({
      staked: 0,
      unbonding: 0,
      rewards: 0,
      validatorCount: 0,
    });
  });
});

describe('what is ignored', () => {
  it('skips a reward paid in another denom', () => {
    const map = buildStakePositions({
      rewards: [{ validator_address: A, reward: [{ denom: 'uatom', amount: '500' }] }],
    });
    expect(map[A].rewards).toBe(0);
  });

  it('drops an entry with no validator rather than keying it on an empty string', () => {
    const map = buildStakePositions({
      delegations: [{ delegation: {}, balance: { amount: '1000' } }],
    });
    expect(Object.keys(map)).toEqual([]);
  });

  it('survives nulls, missing fields and unparseable amounts', () => {
    const map = buildStakePositions({
      delegations: [{ delegation: { validator_address: A }, balance: { amount: 'not-a-number' } }],
      unbonding: null,
      rewards: undefined,
    });
    expect(map[A]).toEqual({ staked: 0, unbonding: 0, rewards: 0 });
  });
});

/**
 * The rule that made "le redelegate ne marche juste pas du tout" true.
 *
 * Cosmos SDK refuses a redelegation away from a validator that is still
 * receiving one - so the validator holding the stake somebody just moved is
 * exactly the one they cannot move it from again. Live shape below: 10 LMN
 * arrived at B from C and lock B until the 3rd of September.
 */
const LIVE_REDELEGATIONS = [
  {
    redelegation: { validator_src_address: C, validator_dst_address: B },
    entries: [{ redelegation_entry: { completion_time: '2026-09-03T15:22:58.274132785Z' } }],
  },
];

describe('a validator locked as a redelegation source', () => {
  it('is the destination of the redelegation, not its source', () => {
    const locks = buildRedelegationLocks(LIVE_REDELEGATIONS);
    expect(Object.keys(locks)).toEqual([B]);
    expect(locks[C]).toBeUndefined();
  });

  it('reports the lock while it lasts', () => {
    const locks = buildRedelegationLocks(LIVE_REDELEGATIONS);
    const during = Date.parse('2026-08-14T00:00:00Z');
    expect(redelegationLockUntil(locks, B, during)).toBe('2026-09-03T15:22:58.274132785Z');
  });

  it('stops reporting it once the entry has completed', () => {
    const locks = buildRedelegationLocks(LIVE_REDELEGATIONS);
    const after = Date.parse('2026-09-04T00:00:00Z');
    expect(redelegationLockUntil(locks, B, after)).toBe('');
  });

  it('says nothing about a validator with no redelegation arriving', () => {
    const locks = buildRedelegationLocks(LIVE_REDELEGATIONS);
    expect(redelegationLockUntil(locks, A, Date.parse('2026-08-14T00:00:00Z'))).toBe('');
  });

  it('holds the lock until the last of several entries clears', () => {
    const locks = buildRedelegationLocks([
      {
        redelegation: { validator_src_address: C, validator_dst_address: B },
        entries: [
          { redelegation_entry: { completion_time: '2026-09-03T00:00:00Z' } },
          { redelegation_entry: { completion_time: '2026-09-20T00:00:00Z' } },
          { redelegation_entry: { completion_time: '2026-09-11T00:00:00Z' } },
        ],
      },
    ]);
    expect(locks[B]).toBe('2026-09-20T00:00:00Z');
  });

  it('ignores entries with no destination or no completion time', () => {
    expect(buildRedelegationLocks([{ redelegation: {}, entries: [] }])).toEqual({});
    expect(buildRedelegationLocks([{ redelegation: { validator_dst_address: B }, entries: [{}] }])).toEqual({});
    expect(buildRedelegationLocks(null)).toEqual({});
  });

  it('treats an unparseable completion time as no lock', () => {
    const locks = buildRedelegationLocks([
      {
        redelegation: { validator_dst_address: B },
        entries: [{ redelegation_entry: { completion_time: 'soon' } }],
      },
    ]);
    expect(redelegationLockUntil(locks, B)).toBe('');
  });
});

describe('whether a row shows anything', () => {
  it('is true when any one of the three is non-zero', () => {
    expect(hasStakePosition({ staked: 1, unbonding: 0, rewards: 0 })).toBe(true);
    expect(hasStakePosition({ staked: 0, unbonding: 1, rewards: 0 })).toBe(true);
    expect(hasStakePosition({ staked: 0, unbonding: 0, rewards: 1 })).toBe(true);
  });

  it('is false for an untouched validator', () => {
    expect(hasStakePosition({ staked: 0, unbonding: 0, rewards: 0 })).toBe(false);
    expect(hasStakePosition(undefined)).toBe(false);
  });
});
