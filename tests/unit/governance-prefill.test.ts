import { describe, expect, it } from 'vitest';
import { prefillFromParams } from '../../src/internal/services/governancePrefill';
import type { GovernanceActionTemplate } from '../../src/types/networkGovernance';

/**
 * Showing the current on-chain values in the proposal form.
 *
 * MsgUpdateParams replaces the whole Params object, so a blank form suggests
 * one field is changing while the message rewrites all of them. The fixture is
 * this devnet's real dns params.
 *
 * The unit conversions are the point. Several fields are labelled LMN while the
 * param is in ulmn and the builder multiplies on the way out - prefilling the
 * raw figure would show a million times too much and then multiply it again.
 */

const DNS_PARAMS = {
  grace_days: '1',
  min_price_ulmn_per_month: '2000000',
  transfer_fee_ulmn: '1000000',
  update_fee_ulmn: '10000',
  update_rate_limit_seconds: '30',
  update_pow_difficulty: 0,
  domain_tiers: [
    { max_len: 4, multiplier_bps: 40000 },
    { multiplier_bps: 5000 },
  ],
  allowed_publishers: ['lmn1aaa', 'lmn1bbb'],
  // Not a dns param. It stands in for the one decimal string a template still
  // prefills, x/tokenomics' tax rate, which must reach the form unrounded.
  tx_tax_rate: '0.125',
};

const TEMPLATE: GovernanceActionTemplate = {
  id: 'test',
  module: 'DNS',
  label: 'test',
  summary: 'test',
  fields: [
    { key: 'updateFeeUlmn', label: 'fee', type: 'text', source: { key: 'update_fee_ulmn', unit: 'lmn' } },
    { key: 'transferFeeUlmn', label: 'transfer', type: 'text', source: { key: 'transfer_fee_ulmn', unit: 'lmn' } },
    { key: 'txTaxRate', label: 'rate', type: 'text', source: { key: 'tx_tax_rate' } },
    { key: 'updateRateLimitSeconds', label: 'limit', type: 'number', source: { key: 'update_rate_limit_seconds' } },
    { key: 'updatePowDifficulty', label: 'pow', type: 'number', source: { key: 'update_pow_difficulty' } },
    { key: 'domainTiers', label: 'tiers', type: 'textarea', source: { key: 'domain_tiers', unit: 'tiers' } },
    { key: 'allowedPublishers', label: 'pubs', type: 'textarea', source: { key: 'allowed_publishers', unit: 'lines' } },
    { key: 'auctionDays', label: 'auction', type: 'number', source: { key: 'auction_days' } },
    { key: 'height', label: 'height', type: 'number' },
  ],
};

describe('amounts the form shows in LMN', () => {
  it('divides a ulmn param by a million', () => {
    const values = prefillFromParams(TEMPLATE, DNS_PARAMS);
    expect(values.updateFeeUlmn).toBe('0.01');
    expect(values.transferFeeUlmn).toBe('1');
  });

  it('drops trailing zeros, since the field is typed by hand', () => {
    const values = prefillFromParams(TEMPLATE, { update_fee_ulmn: '50000' });
    expect(values.updateFeeUlmn).toBe('0.05');
  });

  it('round-trips: what it shows, multiplied back, is what the chain holds', () => {
    const values = prefillFromParams(TEMPLATE, DNS_PARAMS);
    expect(Math.round(Number(values.updateFeeUlmn) * 1_000_000)).toBe(10000);
    expect(Math.round(Number(values.transferFeeUlmn) * 1_000_000)).toBe(1000000);
  });
});

describe('values that are not numbers', () => {
  it('keeps a decimal string exactly, without rounding it', () => {
    expect(prefillFromParams(TEMPLATE, DNS_PARAMS).txTaxRate).toBe('0.125');
  });

  it('writes the tiers back in the form the parser reads', () => {
    expect(prefillFromParams(TEMPLATE, DNS_PARAMS).domainTiers).toBe('4:40000, 0:5000');
  });

  it('treats a tier with no max_len as the catch-all zero', () => {
    // proto3 omits a zero, so the absent field is the catch-all and not a gap.
    const values = prefillFromParams(TEMPLATE, { domain_tiers: [{ multiplier_bps: 5000 }] });
    expect(values.domainTiers).toBe('0:5000');
  });

  it('puts one address per line', () => {
    expect(prefillFromParams(TEMPLATE, DNS_PARAMS).allowedPublishers).toBe('lmn1aaa\nlmn1bbb');
  });

  it('keeps a real zero rather than blanking it', () => {
    expect(prefillFromParams(TEMPLATE, DNS_PARAMS).updatePowDifficulty).toBe('0');
  });
});

describe('what stays blank', () => {
  it('leaves a param the chain omitted blank, which means keep', () => {
    // auction_days is not in the fixture. Blank keeps whatever is on-chain,
    // which is the only honest answer when proto3 has hidden a zero.
    expect(prefillFromParams(TEMPLATE, DNS_PARAMS).auctionDays).toBe('');
  });

  it('leaves a field with no on-chain counterpart blank', () => {
    expect(prefillFromParams(TEMPLATE, DNS_PARAMS).height).toBe('');
  });

  it('blanks every field when the params could not be read', () => {
    const values = prefillFromParams(TEMPLATE, null);
    expect(Object.values(values).every((v) => v === '')).toBe(true);
  });

  it('still names every field, so no key goes missing from the draft', () => {
    expect(Object.keys(prefillFromParams(TEMPLATE, null))).toHaveLength(TEMPLATE.fields.length);
  });
});

/**
 * The shapes x/gov, x/pqc and x/slashing answer with.
 *
 * These three templates carry no MsgUpdateParams - each sends a dedicated
 * message that replaces only the values it names - but they still have to show
 * what is on the chain before replacing it. Without that the form is a blank
 * with an invented placeholder beside it, which reads as a current value and is
 * not one: the deposit placeholder said 100 while the chain ran 10.
 *
 * The fixtures are the live devnet's own answers, padding included.
 */

const GOV_DEPOSIT_PARAMS = {
  min_deposit: [{ denom: 'ulmn', amount: '10000000' }],
  expedited_min_deposit: [{ denom: 'ulmn', amount: '50000000' }],
  min_initial_deposit_ratio: '0.000000000000000000',
};

const PQC_PARAMS = {
  min_balance_for_link: { denom: 'ulmn', amount: '1000' },
  link_fee_ulmn: '1000',
  pow_difficulty_bits: 21,
};

const COIN_TEMPLATE: GovernanceActionTemplate = {
  id: 'coins',
  module: 'Tokenomics',
  label: 'coins',
  summary: 'coins',
  fields: [
    { key: 'minDepositLmn', label: 'min', type: 'text', source: { key: 'min_deposit', unit: 'coins' } },
    { key: 'ratio', label: 'ratio', type: 'text', source: { key: 'min_initial_deposit_ratio', unit: 'dec' } },
    { key: 'minBalanceForLinkLmn', label: 'floor', type: 'text', source: { key: 'min_balance_for_link', unit: 'coin' } },
    { key: 'powDifficultyBits', label: 'pow', type: 'number', source: { key: 'pow_difficulty_bits' } },
  ],
};

describe('coins, and the decimals the SDK pads', () => {
  it('reads a repeated Coin as the LMN of its first entry', () => {
    expect(prefillFromParams(COIN_TEMPLATE, GOV_DEPOSIT_PARAMS).minDepositLmn).toBe('10');
  });

  it('reads a single Coin the same way', () => {
    expect(prefillFromParams(COIN_TEMPLATE, PQC_PARAMS).minBalanceForLinkLmn).toBe('0.001');
  });

  it('strips the padding off a cosmos Dec', () => {
    // Eighteen decimals is how the SDK answers; a form field is typed by hand.
    expect(prefillFromParams(COIN_TEMPLATE, GOV_DEPOSIT_PARAMS).ratio).toBe('0');
    expect(prefillFromParams(COIN_TEMPLATE, { min_initial_deposit_ratio: '0.050000000000000000' }).ratio).toBe('0.05');
    expect(prefillFromParams(COIN_TEMPLATE, { min_initial_deposit_ratio: '1.000000000000000000' }).ratio).toBe('1');
  });

  it('leaves a decimal that is not padded alone', () => {
    expect(prefillFromParams(COIN_TEMPLATE, { min_initial_deposit_ratio: '0.5' }).ratio).toBe('0.5');
  });

  it('blanks an empty coin list rather than showing a zero', () => {
    // Blank means "keep what is there", and there is nothing to name here.
    expect(prefillFromParams(COIN_TEMPLATE, { min_deposit: [] }).minDepositLmn).toBe('');
  });

  it('round-trips: what it shows, multiplied back, is what the chain holds', () => {
    const values = prefillFromParams(COIN_TEMPLATE, GOV_DEPOSIT_PARAMS);
    expect(Math.round(Number(values.minDepositLmn) * 1_000_000)).toBe(10_000_000);
    expect(Math.round(Number(values.minBalanceForLinkLmn) * 1_000_000)).toBe(0);
  });

  it('keeps a plain number as it stands', () => {
    expect(prefillFromParams(COIN_TEMPLATE, PQC_PARAMS).powDifficultyBits).toBe('21');
  });
});
