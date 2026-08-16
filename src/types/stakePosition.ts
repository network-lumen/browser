/** What a wallet holds with one validator, in ulmn. */
export type StakePosition = {
  /** Bonded and earning. */
  staked: number;
  /** Left the delegation, not yet spendable. */
  unbonding: number;
  /** Accrued, unclaimed. Fractional: the chain accrues between blocks. */
  rewards: number;
};

/** Keyed by validator operator address. */
export type StakePositionMap = Record<string, StakePosition>;

export type StakePositionTotals = StakePosition & {
  /** How many validators the wallet has any of the three with. */
  validatorCount: number;
};

/**
 * The three Cosmos SDK query responses, as they arrive.
 *
 * Every field is optional because these come off the wire: a node that answers
 * with a shape we did not expect must produce a zero, not a crash on a screen
 * showing someone their money.
 */
export type DelegationResponse = {
  delegation?: { validator_address?: string };
  balance?: { amount?: string };
};

export type UnbondingResponse = {
  validator_address?: string;
  /** One per undelegation, each completing at its own time. */
  entries?: Array<{ balance?: string }>;
};

export type RewardResponse = {
  validator_address?: string;
  reward?: Array<{ denom?: string; amount?: string }>;
};

export type RedelegationResponse = {
  redelegation?: { validator_src_address?: string; validator_dst_address?: string };
  entries?: Array<{ redelegation_entry?: { completion_time?: string } }>;
};

/**
 * Validator operator address -> when it stops being locked as a redelegation
 * source, as an ISO timestamp. Absent means not locked.
 */
export type RedelegationLockMap = Record<string, string>;
