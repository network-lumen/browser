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
