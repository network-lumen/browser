import { describe, expect, it } from 'vitest';

import {
  canCancelProposal,
  cancelChargeUlmn,
  cancelDestination,
  cancelRatioPercent
} from '../../src/internal/services/governanceCancel';

/**
 * Cancelling a proposal.
 *
 * Written against x/gov's own `CancelProposal` and `ChargeDeposit`: a cancel
 * button offered where the chain refuses signs a failed transaction, and a
 * charge stated wrongly is a confirmation dialog lying about money.
 */

const ME = 'lmn1sql46fuynnn4q9yne8xrezn0e3qyvk83nrmd3k';
const SOMEONE_ELSE = 'lmn1apzz96g5jl4w9shj5g7yek79fyretmuwtcmuht';
const NOW = Date.parse('2026-09-13T14:10:00Z');

const voting = (overrides: Record<string, string> = {}) => ({
  status: 'PROPOSAL_STATUS_VOTING_PERIOD',
  proposer: ME,
  votingEnd: '2026-09-15T14:03:43Z',
  ...overrides
});

describe('canCancelProposal', () => {
  it('lets the proposer cancel a proposal that is still being voted on', () => {
    expect(canCancelProposal(voting(), ME, NOW)).toBe(true);
  });

  it('lets the proposer cancel during the deposit period', () => {
    expect(canCancelProposal(voting({ status: 'PROPOSAL_STATUS_DEPOSIT_PERIOD', votingEnd: '' }), ME, NOW)).toBe(true);
  });

  it('ignores a placeholder voting end on a proposal whose vote has not started', () => {
    // Voting has no end until it starts. A zero date read as "ended" would hide
    // the button on the cheapest proposals to withdraw.
    const proposal = voting({ status: 'PROPOSAL_STATUS_DEPOSIT_PERIOD', votingEnd: '0001-01-01T00:00:00Z' });
    expect(canCancelProposal(proposal, ME, NOW)).toBe(true);
  });

  it('refuses anyone but the proposer', () => {
    // The chain checks `proposal.Proposer != proposer`.
    expect(canCancelProposal(voting(), SOMEONE_ELSE, NOW)).toBe(false);
    expect(canCancelProposal(voting(), '', NOW)).toBe(false);
  });

  it('refuses a proposal with no proposer on record, for everyone', () => {
    expect(canCancelProposal(voting({ proposer: '' }), ME, NOW)).toBe(false);
  });

  it('refuses once the voting period has ended', () => {
    expect(canCancelProposal(voting({ votingEnd: '2026-09-13T14:09:59Z' }), ME, NOW)).toBe(false);
    expect(canCancelProposal(voting({ votingEnd: '2026-09-13T14:10:00Z' }), ME, NOW)).toBe(false);
  });

  it('refuses a proposal that has already been decided', () => {
    for (const status of ['PROPOSAL_STATUS_PASSED', 'PROPOSAL_STATUS_REJECTED', 'PROPOSAL_STATUS_FAILED', 'PROPOSAL_STATUS_UNSPECIFIED']) {
      expect(canCancelProposal(voting({ status }), ME, NOW)).toBe(false);
    }
  });

  it('refuses when there is no proposal', () => {
    expect(canCancelProposal(null, ME, NOW)).toBe(false);
  });
});

describe('cancelChargeUlmn', () => {
  it('splits the deposit the way testnet charges it today', () => {
    // proposal_cancel_ratio 0.5 on a 10 LMN deposit.
    expect(cancelChargeUlmn('10000000', '0.500000000000000000')).toEqual({ charged: '5000000', refunded: '5000000' });
  });

  it('truncates the charge to a whole ulmn, as ChargeDeposit does', () => {
    expect(cancelChargeUlmn('3', '0.5')).toEqual({ charged: '1', refunded: '2' });
  });

  it('charges nothing at a ratio of zero and everything at one', () => {
    expect(cancelChargeUlmn('10000000', '0')).toEqual({ charged: '0', refunded: '10000000' });
    expect(cancelChargeUlmn('10000000', '1.000000000000000000')).toEqual({ charged: '10000000', refunded: '0' });
  });

  it('keeps every digit of a deposit too large for a float', () => {
    expect(cancelChargeUlmn('9007199254740993000000', '0.5')).toEqual({
      charged: '4503599627370496500000',
      refunded: '4503599627370496500000'
    });
  });

  it('has no answer for an unreadable deposit or ratio, or a ratio above one', () => {
    expect(cancelChargeUlmn('', '0.5')).toBeNull();
    expect(cancelChargeUlmn('1.5', '0.5')).toBeNull();
    expect(cancelChargeUlmn('10', '')).toBeNull();
    expect(cancelChargeUlmn('10', 'half')).toBeNull();
    expect(cancelChargeUlmn('10', '1.5')).toBeNull();
  });
});

describe('cancelRatioPercent', () => {
  it('turns the chain decimal into a percentage for a sentence', () => {
    expect(cancelRatioPercent('0.500000000000000000')).toBe('50');
    expect(cancelRatioPercent('0.125')).toBe('12.5');
    expect(cancelRatioPercent('1')).toBe('100');
    expect(cancelRatioPercent('0')).toBe('0');
  });

  it('is empty when the ratio cannot be read', () => {
    expect(cancelRatioPercent('')).toBe('');
    expect(cancelRatioPercent('abc')).toBe('');
  });
});

describe('cancelDestination', () => {
  it('burns when proposal_cancel_dest is empty, which is testnet today', () => {
    expect(cancelDestination('')).toEqual({ kind: 'burn' });
    expect(cancelDestination(undefined)).toEqual({ kind: 'burn' });
  });

  it('names the address the charge is sent to otherwise', () => {
    expect(cancelDestination(` ${SOMEONE_ELSE} `)).toEqual({ kind: 'address', address: SOMEONE_ELSE });
  });
});
