import type { GovernanceProposal } from '../../types/networkGovernance';

/**
 * Cancelling a governance proposal, as x/gov decides it.
 *
 * `Keeper.CancelProposal` (cosmos-sdk v0.53.3, x/gov/keeper/proposal.go) accepts
 * the message only from the proposal's own proposer, only in the deposit or
 * voting period, and not once the voting period has ended. A button offered
 * outside those three conditions signs a transaction the chain refuses, so the
 * page asks this before drawing it.
 *
 * What cancelling costs is `Keeper.ChargeDeposit`: every deposit on the
 * proposal - not only the proposer's - is charged `proposal_cancel_ratio`,
 * truncated to a whole ulmn per coin, and the rest is refunded to whoever
 * deposited it. The charge is burned when `proposal_cancel_dest` is empty and
 * sent there otherwise.
 */

const CANCELLABLE_STATUSES = new Set(['PROPOSAL_STATUS_DEPOSIT_PERIOD', 'PROPOSAL_STATUS_VOTING_PERIOD']);

/** LegacyDec carries 18 decimals; the ratio is compared at that precision. */
const DEC_ONE = 10n ** 18n;

export function canCancelProposal(
  proposal: Pick<GovernanceProposal, 'status' | 'proposer' | 'votingEnd'> | null | undefined,
  address: string,
  now: number = Date.now(),
): boolean {
  if (!proposal) return false;
  const me = String(address || '').trim();
  const proposer = String(proposal.proposer || '').trim();
  // An old proposal can have no proposer on record, and the chain refuses to
  // cancel those for anyone.
  if (!me || !proposer || me !== proposer) return false;
  if (!CANCELLABLE_STATUSES.has(proposal.status)) return false;

  // The end only exists once voting has started. A deposit-period proposal has
  // none, and reading a placeholder date there as "ended" would hide the button
  // on exactly the proposals that can still be withdrawn most cheaply.
  if (proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD' && proposal.votingEnd) {
    const end = Date.parse(proposal.votingEnd);
    // The chain compares against block time, which trails the wall clock, so
    // the last seconds of a vote are treated as over rather than offered.
    if (Number.isFinite(end) && end <= now) return false;
  }
  return true;
}

/** A decimal string such as "0.500000000000000000", scaled by 10^18. Null when unusable. */
function parseDec(input: unknown): bigint | null {
  const match = String(input ?? '').trim().match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const fraction = (match[2] || '').slice(0, 18).padEnd(18, '0');
  return BigInt(match[1]) * DEC_ONE + BigInt(fraction);
}

/**
 * What cancelling takes from a deposit and what it gives back, in ulmn.
 *
 * Computed over the proposal's total deposit. The chain truncates per deposit,
 * so with several depositors the real charge can be lower by up to one ulmn
 * per depositor - never higher.
 *
 * @returns null when the deposit or the ratio cannot be read, or the ratio is
 *   above 1, so the caller says the share is unknown instead of guessing it.
 */
export function cancelChargeUlmn(depositUlmn: unknown, ratio: unknown): { charged: string; refunded: string } | null {
  const raw = String(depositUlmn ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const rate = parseDec(ratio);
  if (rate === null || rate > DEC_ONE) return null;
  const total = BigInt(raw);
  const charged = (total * rate) / DEC_ONE;
  return { charged: charged.toString(), refunded: (total - charged).toString() };
}

/** The ratio as a percentage for a sentence: "0.5" is "50", "0.125" is "12.5". Empty when unusable. */
export function cancelRatioPercent(ratio: unknown): string {
  const rate = parseDec(ratio);
  if (rate === null) return '';
  const scaled = rate * 100n;
  const whole = (scaled / DEC_ONE).toString();
  const fraction = (scaled % DEC_ONE).toString().padStart(18, '0').replace(/0+$/, '').slice(0, 4);
  return fraction ? `${whole}.${fraction}` : whole;
}

/** Where the charge goes: burned when the param is empty, sent to the address otherwise. */
export function cancelDestination(dest: unknown): { kind: 'burn' } | { kind: 'address'; address: string } {
  const address = String(dest ?? '').trim();
  return address ? { kind: 'address', address } : { kind: 'burn' };
}
