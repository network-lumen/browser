import { describe, expect, it } from 'vitest';
import { describeChainError } from '../../src/internal/services/chainErrors';

/**
 * Turning a module's refusal into something a user can act on.
 *
 * The strings below are verbatim from this chain, copied out of the app's own
 * console - not invented for the test. That matters: these rules match on
 * substrings of text the SDK owns, so a test written from memory would pass
 * against a message the chain never sends.
 */

const EMPTY_PROPOSAL =
  'failed to execute message; message index: 0: either metadata or Msgs length must be non-nil: no messages proposed';
const OUT_OF_GAS =
  'out of gas in location: WritePerByte; gasWanted: 250000, gasUsed: 255864: out of gas';

describe('refusals we recognise', () => {
  it('explains a proposal with nothing to execute', () => {
    expect(describeChainError(EMPTY_PROPOSAL)).toMatch(/at least one action/i);
  });

  it('explains running out of gas, and says it is not a fee', () => {
    expect(describeChainError(OUT_OF_GAS)).toMatch(/gas/i);
  });

  it('matches whatever the message index happens to be', () => {
    const other = EMPTY_PROPOSAL.replace('message index: 0', 'message index: 3');
    expect(describeChainError(other)).toBe(describeChainError(EMPTY_PROPOSAL));
  });

  it('is case-insensitive, since the casing differs by transport', () => {
    expect(describeChainError(EMPTY_PROPOSAL.toUpperCase())).not.toBe('');
    expect(describeChainError(EMPTY_PROPOSAL.toLowerCase())).not.toBe('');
  });
});

describe('refusals we do not', () => {
  it('says nothing rather than guessing, so the caller keeps its fallback', () => {
    expect(describeChainError('some brand new module error')).toBe('');
  });

  it('treats an absent or empty error as nothing to say', () => {
    expect(describeChainError('')).toBe('');
    expect(describeChainError('   ')).toBe('');
    expect(describeChainError(null)).toBe('');
    expect(describeChainError(undefined)).toBe('');
  });
});

describe('every rule', () => {
  it('produces a non-empty sentence', () => {
    for (const raw of [
      EMPTY_PROPOSAL,
      OUT_OF_GAS,
      'redelegation to this validator already in progress',
      'invalid shares amount',
      'insufficient funds for fee',
    ]) {
      expect(describeChainError(raw).length).toBeGreaterThan(0);
    }
  });

  it('ends its sentence, so it reads as prose in a toast', () => {
    expect(describeChainError(EMPTY_PROPOSAL).trim().endsWith('.')).toBe(true);
  });
});
