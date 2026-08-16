import type {
  DelegationResponse,
  RedelegationLockMap,
  RedelegationResponse,
  RewardResponse,
  StakePosition,
  StakePositionMap,
  StakePositionTotals,
  UnbondingResponse,
} from '../../types/stakePosition';

/**
 * Three chain queries, one answer per validator.
 *
 * Stake lives in three places at once and the chain reports each separately:
 * a delegation is bonded and earning, an undelegation has left the delegation
 * and sits in a queue for the unbonding period, and a redelegation shows up
 * against the *destination* validator the moment it is accepted. A screen that
 * reads only delegations - which is what the explorer did - tells a user who
 * has just redelegated that their stake is gone, because it looks at the
 * validator they moved it away from.
 *
 * Everything is ulmn. Rewards arrive as decimal strings ("2093587.34237940")
 * because they accrue continuously, so they are the one field that is not a
 * whole number.
 */

/** Tolerates the decimal strings the distribution module returns. */
function toUlmn(raw: unknown): number {
  const n = Number(String(raw ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function blank(): StakePosition {
  return { staked: 0, unbonding: 0, rewards: 0 };
}

function slot(map: StakePositionMap, validator: unknown): StakePosition | null {
  const address = String(validator ?? '').trim();
  if (!address) return null;
  if (!map[address]) map[address] = blank();
  return map[address];
}

export function buildStakePositions(input: {
  delegations?: DelegationResponse[] | null;
  unbonding?: UnbondingResponse[] | null;
  rewards?: RewardResponse[] | null;
  /** Rewards can be paid in several denoms; only this one is counted. */
  denom?: string;
}): StakePositionMap {
  const map: StakePositionMap = {};
  const denom = String(input.denom || 'ulmn');

  for (const entry of input.delegations || []) {
    const position = slot(map, entry?.delegation?.validator_address);
    if (position) position.staked += toUlmn(entry?.balance?.amount);
  }

  for (const entry of input.unbonding || []) {
    const position = slot(map, entry?.validator_address);
    if (!position) continue;
    // One undelegation per entry, each with its own completion time; the user
    // cares about the sum, not the schedule.
    for (const line of entry?.entries || []) {
      position.unbonding += toUlmn(line?.balance);
    }
  }

  for (const entry of input.rewards || []) {
    const position = slot(map, entry?.validator_address);
    if (!position) continue;
    for (const coin of entry?.reward || []) {
      if (String(coin?.denom || '') !== denom) continue;
      position.rewards += toUlmn(coin?.amount);
    }
  }

  return map;
}

export function totalStakePosition(map: StakePositionMap): StakePositionTotals {
  const totals: StakePositionTotals = { staked: 0, unbonding: 0, rewards: 0, validatorCount: 0 };
  for (const position of Object.values(map)) {
    totals.staked += position.staked;
    totals.unbonding += position.unbonding;
    totals.rewards += position.rewards;
    if (position.staked > 0 || position.unbonding > 0 || position.rewards > 0) {
      totals.validatorCount += 1;
    }
  }
  return totals;
}

/**
 * Which validators cannot currently be redelegated *away from*, and until when.
 *
 * Cosmos SDK v0.53 `BeginRedelegation` refuses with ErrTransitiveRedelegation
 * when the delegator has a redelegation still arriving at the source validator:
 *
 *     hasRecRedel, err := k.HasReceivingRedelegation(ctx, delAddr, valSrcAddr)
 *     if hasRecRedel { return time.Time{}, types.ErrTransitiveRedelegation }
 *
 * The rule stops a delegator hopping stake from validator to validator to
 * outrun a slashing, and it bites the obvious case: move stake to a validator,
 * then change your mind. That stake is pinned there for the unbonding period -
 * three weeks on this chain - and the only sign of it, before this, was a chain
 * error after signing.
 *
 * The latest completion time wins when several entries target one validator:
 * the lock lifts when the last of them does.
 */
export function buildRedelegationLocks(
  redelegations: RedelegationResponse[] | null | undefined
): RedelegationLockMap {
  const locks: RedelegationLockMap = {};

  for (const entry of redelegations || []) {
    const destination = String(entry?.redelegation?.validator_dst_address || '').trim();
    if (!destination) continue;

    for (const line of entry?.entries || []) {
      const completion = String(line?.redelegation_entry?.completion_time || '').trim();
      if (!completion) continue;
      const current = locks[destination];
      if (!current || Date.parse(completion) > Date.parse(current)) {
        locks[destination] = completion;
      }
    }
  }

  return locks;
}

/**
 * The lock only means anything while it lasts; a completion time in the past
 * belongs to an entry the chain has already cleared.
 */
export function redelegationLockUntil(
  locks: RedelegationLockMap,
  validatorAddress: string,
  now: number = Date.now()
): string {
  const until = locks[String(validatorAddress || '').trim()];
  if (!until) return '';
  const at = Date.parse(until);
  return Number.isFinite(at) && at > now ? until : '';
}

/** Whether the row is worth drawing anything for at all. */
export function hasStakePosition(position: StakePosition | undefined): boolean {
  if (!position) return false;
  return position.staked > 0 || position.unbonding > 0 || position.rewards > 0;
}
